# Claude (Integration & Orchestration)

## System Overview & Architecture Diagram

**TurtleTrading** is an AI-powered stock market analysis platform that democratizes institutional-grade trading tools for retail investors. The platform combines real-time market data, LSTM neural network predictions, sentiment analysis, and comprehensive technical indicators through a modular architecture design.

```
┌─────────────────────────────────────────────────────────────────┐
│                        TurtleTrading Platform                   │
│  Mission: Empower traders with institutional-grade AI insights  │
└─────────────────────────────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UserInterface │────│   Authentication│────│   Infrastructure│
│   (React/TS)    │    │   (JWT/Security) │    │   (Docker/DB)   │
│ • Vite Build    │    │ • Rate Limiting  │    │ • PostgreSQL    │
│ • Tailwind CSS  │    │ • Session Mgmt   │    │ • Redis Cache   │
│ • State Mgmt    │    │ • Password Hash  │    │ • Docker Compose│
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   StockAnalysis │────│   MarketData    │────│   DataSources   │
│   (LSTM/TA)     │    │   (WebSocket)   │    │   (APIs/Cache)  │
│ • 15+ Indicators│    │ • Real-time     │    │ • yfinance      │
│ • LSTM Predict  │    │ • Sentiment     │    │ • Alpha Vantage │
│ • Risk Analysis │    │ • Broadcasting  │    │ • Fallback Chain│
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   ▼
                        ┌─────────────────┐
                        │     Testing     │
                        │   (100% Cov)    │
                        │ • Unit Tests    │
                        │ • Integration   │
                        │ • E2E Testing   │
                        └─────────────────┘
```

## Module Registry with Links

### Core Business Modules
- **[StockAnalysis](./modules/Claude.StockAnalysis.md)** → Stock data analysis, technical indicators, LSTM neural network predictions, risk assessment
- **[MarketData](./modules/Claude.MarketData.md)** → Real-time market data streaming, sentiment analysis, WebSocket management, market breadth
- **[Authentication](./modules/Claude.Authentication.md)** → JWT authentication, user management, security policies, rate limiting, session management

### Platform Modules
- **[UserInterface](./modules/Claude.UserInterface.md)** → React frontend, TypeScript, Tailwind CSS, state management, responsive design
- **[DataSources](./modules/Claude.DataSources.md)** → External API integrations, fallback mechanisms, caching strategy, rate limiting
- **[Infrastructure](./modules/Claude.Infrastructure.md)** → Docker orchestration, PostgreSQL, Redis, monitoring, deployment automation
- **[Testing](./modules/Claude.Testing.md)** → Comprehensive testing framework, 100% coverage enforcement, CI/CD integration

## Cross-Module Contracts & Versioning

### API Contracts (Producer ↔ Consumer)
| Producer | Consumer | Contract | Version |
|----------|----------|----------|---------|
| StockAnalysis | UserInterface | `/api/v1/stocks/{symbol}/analysis` → `AnalysisResponse` | v1.0 |
| MarketData | StockAnalysis | `WebSocket:price_update` → `PriceUpdateEvent` | v1.0 |
| Authentication | All Modules | `JWT Bearer Token` → `UserContext` | v1.0 |
| DataSources | StockAnalysis | `get_stock_data(symbol)` → `StockData | null` | v1.0 |
| Infrastructure | All Modules | Database connections, Redis cache, monitoring | v1.0 |

### Data Flow Contracts
```typescript
// Core data contracts between modules
interface StockData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: datetime;
  source: 'yfinance' | 'alpha_vantage';
}

interface AnalysisResult {
  technical_score: number;
  lstm_prediction: LSTMPrediction;
  sentiment_score: number;
  confidence: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
}

interface UserContext {
  user_id: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  session_expires_at: datetime;
}
```

## Message/Data Flow (Sequence Diagrams)

### Stock Analysis Request Flow
```
User → UserInterface → Authentication → StockAnalysis → DataSources → External API
                           ↓              ↓              ↓
                      JWT Validation → Technical Analysis → Cache/Fallback
                           ↓              ↓              ↓
User ← UserInterface ← AnalysisResult ← LSTM Prediction ← Historical Data
```

### Real-time Data Streaming Flow
```
External API → DataSources → MarketData → WebSocket → UserInterface → User
      ↓            ↓           ↓           ↓           ↓
  Rate Limit → Cache Update → Broadcast → State Update → UI Render
```

## Orchestration Patterns & Error Propagation

### Error Handling Hierarchy
1. **Component-level**: UI error boundaries isolate failures
2. **Service-level**: API error responses with proper HTTP status codes
3. **Integration-level**: Circuit breakers and fallback mechanisms
4. **System-level**: Global error monitoring and alerting

### Retry Policies
- **DataSources**: 3 retries with exponential backoff (1s, 2s, 4s)
- **Authentication**: No retries for security (fail fast)
- **MarketData**: WebSocket auto-reconnection with increasing delays
- **StockAnalysis**: Retry on network errors, fail on validation errors

### Circuit Breaker Patterns
- **External APIs**: Open circuit after 5 consecutive failures
- **Database**: Connection pool management with health checks
- **Cache**: Graceful degradation to direct data sources

## Non-Functional Requirements

### Reliability
- **Uptime SLO**: 99.9% availability (8.76 hours downtime/year)
- **Data Consistency**: Eventual consistency for market data, strong consistency for user data
- **Backup & Recovery**: Daily automated backups with 4-hour RTO

### Performance
- **API Response**: <500ms for 95th percentile
- **WebSocket Latency**: <100ms for real-time updates
- **Database Queries**: <50ms for 90th percentile
- **Frontend Load**: <2 seconds on 3G networks

### Security
- **Authentication**: JWT with 15-minute expiry + refresh tokens
- **Rate Limiting**: 1000 requests/hour per user, 100/minute burst
- **Data Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Input Validation**: Comprehensive sanitization and validation

### Compliance
- **Data Privacy**: GDPR/CCPA compliant data handling
- **Financial Regulations**: SEC compliance for investment advice disclaimers
- **Security Standards**: OWASP Top 10 mitigation

## Operational Runbooks

### Startup Sequence
1. Infrastructure: PostgreSQL → Redis → Nginx
2. Backend: Database migrations → FastAPI server
3. Frontend: Vite build → Static file serving
4. Services: External API health checks → WebSocket initialization

### Shutdown Sequence
1. Stop accepting new requests (graceful degradation)
2. Complete in-flight requests (30-second timeout)
3. Close WebSocket connections
4. Flush cache and close database connections

### Backup Procedures
```bash
# Daily automated backup
pg_dump turtletrading > backup_$(date +%Y%m%d).sql
aws s3 cp backup_$(date +%Y%m%d).sql s3://turtletrading-backups/

# Redis cache backup
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb backup_redis_$(date +%Y%m%d).rdb
```

## TDD Integration Plan

### Contract Tests Matrix (Producer ↔ Consumer)
| Test Type | Producer | Consumer | Validates |
|-----------|----------|----------|-----------|
| Contract | StockAnalysis API | UserInterface | Response schema, error codes |
| Contract | MarketData WebSocket | UserInterface | Message format, event types |
| Contract | DataSources | StockAnalysis | Data format, null handling |
| Contract | Authentication | All Modules | JWT format, permissions |

### End-to-End Test Flows
- **[Stock Analysis Flow](./tests/integration/stock_analysis_flow.md)** → Complete user analysis journey
- **[Real-time Data Flow](./tests/integration/real_time_data_flow.md)** → WebSocket streaming validation
- **User Registration Flow** → Account creation and verification
- **Authentication Flow** → Login, logout, token refresh

### Failure Injection & Chaos Tests
- **Network Partitions**: Simulate network failures between modules
- **Database Failures**: Test failover and recovery procedures
- **External API Outages**: Validate fallback mechanisms
- **High Load**: Stress test with 10x normal traffic
- **Security Attacks**: SQL injection, XSS, CSRF validation

### Rollback & Idempotency Checks
- **Database Migrations**: Reversible migration scripts
- **API Changes**: Backward compatibility validation
- **Cache Invalidation**: Consistent cache clearing
- **User Actions**: Idempotent operations (duplicate prevention)

## CI/CD

### How to Run All Tests
```bash
# Backend tests with coverage
cd backend && pytest --cov=app --cov-report=xml --cov-fail-under=100

# Frontend tests with coverage
cd frontend && npm run test:coverage -- --run

# E2E tests
cd tests && npm run test:e2e

# Integration tests
make test:integration

# Complete test suite
make test:all
```

### Coverage Thresholds = 100% (branch/line/function)
- **Backend**: pytest-cov with 100% line, branch, function coverage
- **Frontend**: Vitest with v8 coverage provider, 100% enforcement
- **E2E**: Playwright with code coverage collection
- **Integration**: Combined coverage reporting across all layers

### Gates that Fail the Build if Thresholds are Not Met

#### GitHub Actions Enforcement
```yaml
- name: Enforce Backend Coverage
  run: pytest --cov-fail-under=100

- name: Enforce Frontend Coverage
  run: npm run coverage:check # Fails if < 100%

- name: Enforce E2E Coverage
  run: npm run test:e2e:coverage:check
```

#### Pre-commit Hooks
```bash
#!/bin/bash
# Fail commit if coverage below 100%
coverage report --fail-under=100 || exit 1
npm run coverage:check || exit 1
```

#### Coverage Reporting
- **HTML Reports**: Detailed line-by-line coverage analysis
- **Badge Generation**: Coverage badges for README
- **Trend Tracking**: Coverage metrics over time
- **Alert Integration**: Slack notifications for coverage drops

### Detailed Coverage Configuration
See **[Coverage Configuration](./tests/config/coverage.md)** for:
- Tool-specific commands (pytest, vitest, playwright)
- CI configuration files
- Local development workflows
- Debugging guidance for missed coverage