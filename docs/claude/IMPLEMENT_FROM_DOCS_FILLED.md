You are a principal engineer. Implement the TurtleTrading system exactly as specified in the split docs. Produce complete, runnable code and configurations with 100% unit, branch, and integration coverage, plus Playwright E2E. Do not return analysis—return the file plan and full file contents only.

STACK = python-fastapi-sqlalchemy-pytest-coverage + react18-typescript-jest-rtl + playwright + postgres + redis
REPO CONVENTIONS (must honor):
- Backend: FastAPI (async), SQLAlchemy, Alembic, Pydantic, JWT, Redis cache & rate-limit, LSTM boundary (TensorFlow later), yfinance primary + Alpha Vantage fallback (completed).
- Frontend: React 18 + TypeScript, Tailwind, React Query, React Router, RTL, Socket.io, Recharts.
- Infra: Docker/Compose, Nginx, Makefile targets (make dev/test/test-e2e/etc.).
- Tests: Backend PyTest; Frontend Jest+RTL; E2E Playwright in root `tests/`.
- DB: Postgres; Redis. Deterministic seeds for CI/local.
- Docs: Integration home `docs/claude/Claude.md`; modules under `docs/claude/modules/`.

INPUT (paste the results of the split here)
<<<DOCS_INPUT_START>>>
File plan:
- docs/claude/Claude.md: Integration/orchestration home and contracts
- docs/claude/modules/Claude.Authentication.md: Auth, JWT, permissions, rate limiting
- docs/claude/modules/Claude.DataSources.md: External data sources, fallback, rate limiting, health
- docs/claude/modules/Claude.Infrastructure.md: Docker, Postgres, Redis, monitoring, backups
- docs/claude/modules/Claude.MarketData.md: WebSocket streaming, market breadth, sentiment
- docs/claude/modules/Claude.StockAnalysis.md: Technicals, LSTM, multi-factor scoring
- docs/claude/modules/Claude.Testing.md: Test strategy, coverage enforcement
- docs/claude/modules/Claude.UserInterface.md: React app architecture and UI contracts
- docs/claude/tests/config/coverage.md: Coverage commands and CI gates (100%)
- docs/claude/tests/integration/real_time_data_flow.md: Real-time streaming integration specs
- docs/claude/tests/integration/stock_analysis_flow.md: Stock analysis integration specs
- docs/claude/tests/specs/authentication/jwt_security_tests.md: JWT security unit/edge/property tests
- docs/claude/tests/specs/market-data/real_time_streaming_tests.md: Market data unit/edge/property tests
- docs/claude/tests/specs/stock-analysis/lstm_prediction_tests.md: LSTM unit/edge/property tests
- docs/claude/tests/specs/stock-analysis/technical_analysis_tests.md: Technicals unit/edge/property tests

### docs/claude/Claude.md
```markdown
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
```

### docs/claude/modules/Claude.Authentication.md
```markdown
# Claude.Authentication

- **Purpose**: Provide comprehensive user authentication, authorization, session management, and security policies with JWT token handling, rate limiting, and multi-tier access control for secure trading platform access
- **Scope (in/out)**:
  - **In**: JWT token generation/validation, user registration/login, password hashing, session management, rate limiting, permission validation, security policies, multi-factor authentication
  - **Out**: User interface rendering (handled by UserInterface), business logic processing (handled by StockAnalysis/MarketData), data storage implementation (handled by Infrastructure)
- **Public API (signatures, inputs/outputs, errors)**:
  - `AuthService.register_user(email, password, profile) → UserAccount | ValidationError`
  - `AuthService.authenticate_user(email, password) → AuthResult | AuthenticationError`
  - `AuthService.generate_tokens(user_id) → TokenPair | TokenError`
  - `AuthService.refresh_token(refresh_token) → TokenPair | InvalidTokenError`
  - `AuthService.validate_jwt(token) → UserContext | TokenValidationError`
  - `RateLimitService.check_rate_limit(user_id, endpoint) → RateLimitResult | None`
  - `PermissionService.check_permission(user_context, resource) → PermissionResult | None`
- **Data contracts (schemas, invariants)**:
  - UserAccount: user_id(UUID), email(str, unique), password_hash(str), subscription_tier('free'|'pro'|'enterprise'), created_at(datetime), is_active(bool)
  - AuthResult: success(bool), user_context(UserContext|None), access_token(str|None), refresh_token(str|None), expires_in(int)
  - UserContext: user_id(UUID), email(str), subscription_tier(str), permissions(List[str]), session_expires_at(datetime), rate_limit_remaining(int)
  - TokenPair: access_token(str, 15min expiry), refresh_token(str, 7day expiry), token_type('Bearer'), expires_in(int)
  - RateLimitResult: allowed(bool), remaining(int≥0), reset_time(datetime), tier_limit(int>0)
- **Dependencies (internal/external)**:
  - **Internal**: Infrastructure (PostgreSQL user storage, Redis sessions), UserInterface (auth status), MarketData (user subscriptions), StockAnalysis (user preferences)
  - **External**: bcrypt, PyJWT, passlib, python-multipart, redis, sqlalchemy, pydantic, email-validator
- **State & concurrency model**: Stateless JWT validation with Redis session storage, async password hashing, concurrent rate limiting with atomic Redis operations
- **Failure modes & retries**: No retries for authentication (security), session cleanup on token expiry, password reset via email, account lockout after failed attempts
- **Performance/SLOs**: <100ms token validation, <200ms login/registration, <50ms rate limit checks, 99.9% authentication success for valid credentials
- **Security/permissions**: bcrypt password hashing, JWT with strong secrets, secure session cookies, rate limiting per user/IP, input validation, SQL injection prevention
- **Observability (logs/metrics/traces)**: Authentication success/failure rates, token generation/validation metrics, rate limit violations, session durations, security event logging
- **Change risks & migration notes**: JWT secret rotation requires careful token migration, password policy changes need user notification, rate limit updates require cache invalidation

## TDD: Requirements → Tests

### REQ-AUTH-01: User registration and authentication with secure password handling and session management
- **Unit tests**:
  - UT-AUTH-01.1: Given valid email/password When register_user() Then create account with hashed password and return user_id
  - UT-AUTH-01.2: Given valid credentials When authenticate_user() Then return JWT tokens and user context
  - UT-AUTH-01.3: Given user session When validate_jwt() Then verify token signature and return user permissions
- **Edge/negative/property tests**:
  - ET-AUTH-01.1: Given duplicate email When register_user() Then return ValidationError with clear message
  - ET-AUTH-01.2: Given invalid password When authenticate_user() Then return AuthenticationError and log attempt
  - PT-AUTH-01.1: Property: passwords always hashed with bcrypt, JWT tokens contain valid claims, user_ids are unique UUIDs
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock bcrypt with controlled hash generation for testing
  - Stub JWT with deterministic token generation
  - Fake Redis sessions for session management testing
- **Coverage mapping**:
  - Lines/branches/functions covered: register_user(), authenticate_user(), hash_password(), validate_jwt(), create_session()

### REQ-AUTH-02: JWT token management with access/refresh token rotation and secure validation
- **Unit tests**:
  - UT-AUTH-02.1: Given authenticated user When generate_tokens() Then return access token (15min) and refresh token (7day)
  - UT-AUTH-02.2: Given valid refresh token When refresh_token() Then return new token pair and invalidate old refresh token
  - UT-AUTH-02.3: Given expired access token When validate_jwt() Then return TokenValidationError with expiry details
- **Edge/negative/property tests**:
  - ET-AUTH-02.1: Given malformed JWT When validate_jwt() Then reject with proper error message and security logging
  - ET-AUTH-02.2: Given revoked refresh token When refresh_token() Then return InvalidTokenError and require re-authentication
  - PT-AUTH-02.1: Property: access tokens expire in 15 minutes, refresh tokens unique per user, token revocation is immediate
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock JWT library with controllable expiration times
  - Stub Redis for token blacklist management
  - Fake system clock for token expiry testing
- **Coverage mapping**:
  - Lines/branches/functions covered: generate_tokens(), refresh_token(), validate_jwt(), revoke_token(), check_blacklist()

### REQ-AUTH-03: Rate limiting and permission management with tier-based access control and security policies
- **Unit tests**:
  - UT-AUTH-03.1: Given user tier When check_rate_limit() Then enforce tier-specific limits (free: 100/hour, pro: 1000/hour, enterprise: unlimited)
  - UT-AUTH-03.2: Given user permissions When check_permission() Then validate access to premium features based on subscription
  - UT-AUTH-03.3: Given security policy When validate_request() Then enforce IP restrictions and suspicious activity detection
- **Edge/negative/property tests**:
  - ET-AUTH-03.1: Given rate limit exceeded When make_request() Then return 429 status with reset time headers
  - ET-AUTH-03.2: Given subscription downgrade When access_premium_feature() Then revoke permissions immediately
  - PT-AUTH-03.1: Property: rate limits reset at specified intervals, permissions consistent with subscription tier, security logs immutable
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Redis atomic operations for rate limiting
  - Stub subscription service for tier validation
  - Fake IP geolocation for security policy testing
- **Coverage mapping**:
  - Lines/branches/functions covered: check_rate_limit(), check_permission(), validate_subscription(), enforce_security_policy()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-AUTH-01 | UT-AUTH-01.1-3 | ET-AUTH-01.1-2 | PT-AUTH-01.1 | IT-AUTH-01 |
| REQ-AUTH-02 | UT-AUTH-02.1-3 | ET-AUTH-02.1-2 | PT-AUTH-02.1 | IT-AUTH-02 |
| REQ-AUTH-03 | UT-AUTH-03.1-3 | ET-AUTH-03.1-2 | PT-AUTH-03.1 | IT-AUTH-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **User Registration**: validate_input() → check_email_unique() → hash_password() → create_user_record() → generate_tokens() → setup_session()
2. **Authentication**: validate_credentials() → verify_password() → check_account_status() → generate_tokens() → create_session() → return_auth_result()
3. **Token Validation**: parse_jwt() → verify_signature() → check_expiry() → validate_claims() → check_blacklist() → return_user_context()

### Pseudocode (reference)
```python
async def authenticate_user(email: str, password: str) -> AuthResult:
    # Input validation
    if not validate_email(email) or not password:
        return AuthResult(success=False, error="Invalid credentials format")

    # Rate limiting check
    rate_limit = await rate_limiter.check_login_attempts(email)
    if not rate_limit.allowed:
        await security_logger.log_rate_limit_violation(email, "login")
        return AuthResult(success=False, error="Too many login attempts")

    # Fetch user from database
    user = await user_repository.get_by_email(email)
    if not user or not user.is_active:
        await security_logger.log_failed_login(email, "user_not_found")
        return AuthResult(success=False, error="Invalid credentials")

    # Verify password
    is_valid = await bcrypt.verify(password, user.password_hash)
    if not is_valid:
        await security_logger.log_failed_login(email, "invalid_password")
        await rate_limiter.increment_failed_attempts(email)
        return AuthResult(success=False, error="Invalid credentials")

    # Generate JWT tokens
    token_payload = {
        "user_id": str(user.user_id),
        "email": user.email,
        "subscription_tier": user.subscription_tier,
        "permissions": get_user_permissions(user.subscription_tier),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=15)
    }

    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
    refresh_token = await generate_refresh_token(user.user_id)

    # Create session
    session_data = {
        "user_id": str(user.user_id),
        "login_time": datetime.utcnow().isoformat(),
        "ip_address": get_client_ip(),
        "user_agent": get_user_agent()
    }
    await redis.setex(f"session:{user.user_id}", 3600, json.dumps(session_data))

    # Update user last login
    await user_repository.update_last_login(user.user_id)

    # Log successful authentication
    await security_logger.log_successful_login(user.email, get_client_ip())

    return AuthResult(
        success=True,
        user_context=UserContext(
            user_id=user.user_id,
            email=user.email,
            subscription_tier=user.subscription_tier,
            permissions=get_user_permissions(user.subscription_tier),
            session_expires_at=datetime.utcnow() + timedelta(minutes=15),
            rate_limit_remaining=rate_limit.remaining
        ),
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=900  # 15 minutes
    )

async def validate_jwt(token: str) -> Optional[UserContext]:
    try:
        # Parse and verify JWT
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

        # Check token blacklist
        is_blacklisted = await redis.get(f"blacklist:{token}")
        if is_blacklisted:
            raise TokenValidationError("Token has been revoked")

        # Validate user still exists and is active
        user = await user_repository.get_by_id(payload["user_id"])
        if not user or not user.is_active:
            raise TokenValidationError("User account is inactive")

        # Check subscription tier for permission changes
        current_permissions = get_user_permissions(user.subscription_tier)
        if current_permissions != payload.get("permissions", []):
            # Permissions changed, require re-authentication
            raise TokenValidationError("Permissions have changed, please re-authenticate")

        # Return user context
        return UserContext(
            user_id=UUID(payload["user_id"]),
            email=payload["email"],
            subscription_tier=user.subscription_tier,
            permissions=current_permissions,
            session_expires_at=datetime.fromtimestamp(payload["exp"]),
            rate_limit_remaining=await get_rate_limit_remaining(payload["user_id"])
        )

    except jwt.ExpiredSignatureError:
        raise TokenValidationError("Token has expired")
    except jwt.InvalidTokenError as e:
        await security_logger.log_invalid_token_attempt(token, str(e))
        raise TokenValidationError("Invalid token")
```

### Error Handling & Retries
- **Authentication failures**: No retries for security, log all attempts, implement account lockout
- **Token validation errors**: Immediate rejection, security logging, force re-authentication
- **Database connection issues**: Graceful degradation, cached user validation for short periods
- **Rate limiting**: Clear error messages with reset times, distinguish between user and IP limits

### Config/flags
```python
AUTH_CONFIG = {
    "JWT_CONFIG": {
        "SECRET_KEY": "your-256-bit-secret",  # From environment
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 15,
        "REFRESH_TOKEN_EXPIRE_DAYS": 7,
        "ISSUER": "turtletrading.com",
        "AUDIENCE": "turtletrading-api"
    },
    "PASSWORD_POLICY": {
        "MIN_LENGTH": 8,
        "MAX_LENGTH": 128,
        "REQUIRE_UPPERCASE": True,
        "REQUIRE_LOWERCASE": True,
        "REQUIRE_DIGITS": True,
        "REQUIRE_SPECIAL_CHARS": True,
        "BCRYPT_ROUNDS": 12
    },
    "RATE_LIMITS": {
        "LOGIN_ATTEMPTS": {
            "free": {"limit": 5, "window": 300},      # 5 attempts per 5 minutes
            "pro": {"limit": 10, "window": 300},      # 10 attempts per 5 minutes
            "enterprise": {"limit": 20, "window": 300} # 20 attempts per 5 minutes
        },
        "API_REQUESTS": {
            "free": {"limit": 100, "window": 3600},     # 100 requests per hour
            "pro": {"limit": 1000, "window": 3600},     # 1000 requests per hour
            "enterprise": {"limit": -1, "window": 3600} # Unlimited
        },
        "REGISTRATION": {"limit": 3, "window": 86400}   # 3 registrations per day per IP
    },
    "SECURITY_POLICIES": {
        "SESSION_TIMEOUT": 3600,  # 1 hour
        "MAX_CONCURRENT_SESSIONS": 5,
        "REQUIRE_EMAIL_VERIFICATION": True,
        "ENABLE_MFA": False,  # Future implementation
        "PASSWORD_RESET_EXPIRE_MINUTES": 30,
        "ACCOUNT_LOCKOUT_ATTEMPTS": 10,
        "ACCOUNT_LOCKOUT_DURATION": 1800  # 30 minutes
    },
    "SUBSCRIPTION_PERMISSIONS": {
        "free": [
            "view_basic_charts",
            "access_basic_indicators",
            "create_watchlist"
        ],
        "pro": [
            "view_basic_charts", "access_basic_indicators", "create_watchlist",
            "view_advanced_charts",
            "access_all_indicators",
            "lstm_predictions",
            "sentiment_analysis",
            "real_time_data"
        ],
        "enterprise": [
            "view_basic_charts", "access_basic_indicators", "create_watchlist",
            "view_advanced_charts", "access_all_indicators", "lstm_predictions",
            "sentiment_analysis", "real_time_data",
            "api_access",
            "bulk_analysis",
            "custom_indicators",
            "priority_support"
        ]
    }
}
```
```

### docs/claude/modules/Claude.DataSources.md
```markdown
# Claude.DataSources

- **Purpose**: Provide reliable multi-source data integration with fallback mechanisms for market data, news, and external API management
- **Scope (in/out)**:
  - **In**: yfinance integration, Alpha Vantage fallback, NewsAPI, external API rate limiting, data source health monitoring, API response caching
  - **Out**: Data processing/analysis (handled by StockAnalysis/MarketData), user management (handled by Authentication), UI presentation (handled by UserInterface)
- **Public API (signatures, inputs/outputs, errors)**:
  - `DataSourceManager.get_price_data(symbol) → StockPrice | None`
  - `DataSourceManager.get_historical_data(symbol, period) → DataFrame | None`
  - `AlphaVantageService.get_quote(symbol) → StockPrice | APIError`
  - `RateLimiter.check_limit(api_name, key) → boolean`
  - `HealthMonitor.check_source_health(source) → HealthStatus`
- **Data contracts (schemas, invariants)**:
  - StockPrice: symbol(str), current_price(float>0), volume(int≥0), market_cap(int≥0), timestamp(datetime)
  - APIResponse: status_code(int), data(dict), headers(dict), response_time_ms(int>0), source(str)
  - HealthStatus: source(str), is_healthy(boolean), last_check(datetime), error_count(int≥0), uptime_percentage(0≤float≤100)
  - RateLimit: api_name(str), requests_made(int≥0), limit(int>0), reset_time(datetime)
- **Dependencies (internal/external)**:
  - **Internal**: Infrastructure (Redis for rate limiting and caching), StockAnalysis (price data consumer), MarketData (real-time updates)
  - **External**: yfinance, alpha-vantage, newsapi-python, requests, aiohttp, pandas
- **State & concurrency model**: Stateless data fetching with Redis-based rate limiting, concurrent API calls with asyncio, connection pooling for HTTP clients
- **Failure modes & retries**: Primary API failure → secondary API → cached data → error response; 3 retries with exponential backoff for network errors
- **Performance/SLOs**: <500ms for price data, <1s for historical data, <2s for news data, 99% API success rate, <10ms rate limit checks
- **Security/permissions**: API key management via environment variables, request signing where required, no sensitive data logged, IP-based rate limiting
- **Observability (logs/metrics/traces)**: API response times, success/failure rates, rate limit usage, cache hit ratios, data source health metrics
- **Change risks & migration notes**: API provider changes require adapter updates; rate limit changes need configuration updates; new data sources need health monitoring integration

## TDD: Requirements → Tests

### REQ-DATA-01: Multi-source data fetching with automatic fallback chains
- **Unit tests**:
  - UT-DATA-01.1: Given yfinance available When get_price_data("AAPL") Then return StockPrice from primary source
  - UT-DATA-01.2: Given yfinance timeout When get_price_data("AAPL") Then fallback to Alpha Vantage successfully
  - UT-DATA-01.3: Given all sources fail When get_price_data("AAPL") Then return cached data or None
- **Edge/negative/property tests**:
  - ET-DATA-01.1: Given malformed API response When parse_response() Then handle gracefully and try next source
  - ET-DATA-01.2: Given network partition When fetch_data() Then timeout appropriately and fallback
  - PT-DATA-01.1: Property: fallback chain always preserves data contract, response time increases with fallback depth
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock yfinance with controllable timeout/success scenarios
  - Stub Alpha Vantage API with rate limiting simulation
  - Fake network conditions for fallback testing
- **Coverage mapping**:
  - Lines/branches/functions covered: DataSourceManager, get_price_data(), fallback_chain(), parse_response()

### REQ-DATA-02: Rate limiting with distributed Redis-based tracking
- **Unit tests**:
  - UT-DATA-02.1: Given API rate limit When check_limit() Then return False and prevent API call
  - UT-DATA-02.2: Given limit reset time passed When check_limit() Then reset counter and allow requests
  - UT-DATA-02.3: Given concurrent requests When rate_limit() Then prevent race conditions with atomic operations
- **Edge/negative/property tests**:
  - ET-DATA-02.1: Given Redis connection failure When check_limit() Then fail-open and allow requests with warning
  - ET-DATA-02.2: Given clock skew When rate_limit_reset() Then handle gracefully with tolerance
  - PT-DATA-02.1: Property: rate limit never exceeded, requests distributed evenly over time window
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Redis with controllable connection failures
  - Stub time provider for deterministic rate limit testing
  - Fake concurrent request scenarios
- **Coverage mapping**:
  - Lines/branches/functions covered: RateLimiter, check_limit(), reset_limit(), atomic_increment()

### REQ-DATA-03: Health monitoring with automatic source degradation
- **Unit tests**:
  - UT-DATA-03.1: Given healthy data source When monitor_health() Then update status and maintain availability
  - UT-DATA-03.2: Given failing data source When monitor_health() Then mark unhealthy and trigger alerts
  - UT-DATA-03.3: Given recovered data source When health_check() Then restore to healthy status
- **Edge/negative/property tests**:
  - ET-DATA-03.1: Given intermittent failures When calculate_uptime() Then use sliding window average
  - ET-DATA-03.2: Given false positive health check When validate_health() Then require sustained recovery
  - PT-DATA-03.1: Property: 0 ≤ uptime_percentage ≤ 100, health status reflects recent performance
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock health check endpoints with controllable responses
  - Stub metrics collection with deterministic failure patterns
  - Fake time series data for uptime calculation
- **Coverage mapping**:
  - Lines/branches/functions covered: HealthMonitor, check_health(), calculate_uptime(), trigger_alerts()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-DATA-01 | UT-DATA-01.1-3 | ET-DATA-01.1-2 | PT-DATA-01.1 | IT-DATA-01 |
| REQ-DATA-02 | UT-DATA-02.1-3 | ET-DATA-02.1-2 | PT-DATA-02.1 | IT-DATA-02 |
| REQ-DATA-03 | UT-DATA-03.1-3 | ET-DATA-03.1-2 | PT-DATA-03.1 | IT-DATA-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Data Fetching**: validate_symbol() → check_cache() → try_primary_source() → try_fallback() → cache_result() → return_data()
2. **Rate Limiting**: get_current_usage() → check_against_limit() → allow_or_deny() → increment_counter() → schedule_reset()
3. **Health Monitoring**: periodic_health_check() → collect_metrics() → calculate_status() → update_availability() → alert_if_needed()

### Pseudocode (reference)
```python
async def get_price_data(symbol: str) -> Optional[StockPrice]:
    # Check cache first
    cache_key = f"price:{symbol}"
    cached = await redis.get(cache_key)
    if cached and not is_stale(cached):
        return StockPrice.parse_raw(cached)

    # Try primary source (yfinance)
    if await rate_limiter.check_limit("yfinance", symbol):
        try:
            data = await yfinance_client.get_quote(symbol)
            if data:
                await cache_result(cache_key, data, ttl=60)
                return data
        except Exception as e:
            logger.warning(f"yfinance failed for {symbol}: {e}")

    # Fallback to Alpha Vantage
    if await rate_limiter.check_limit("alpha_vantage", symbol):
        try:
            data = await alpha_vantage_client.get_quote(symbol)
            if data:
                await cache_result(cache_key, data, ttl=300)
                return data
        except Exception as e:
            logger.error(f"Alpha Vantage failed for {symbol}: {e}")

    # Return stale cache or None
    if cached:
        logger.info(f"Returning stale data for {symbol}")
        return StockPrice.parse_raw(cached)

    return None
```

### Error Handling & Retries
- **Network timeouts**: 30s timeout with 3 retries, exponential backoff (1s, 2s, 4s)
- **API rate limits**: Respect limits, queue requests, circuit breaker after sustained failures
- **Invalid responses**: Skip malformed data, log for debugging, continue with fallback
- **Cache failures**: Graceful degradation to direct API calls, alert operations team

### Config/flags
```python
DATA_SOURCES_CONFIG = {
    "YFINANCE_TIMEOUT": 30,
    "ALPHA_VANTAGE_TIMEOUT": 30,
    "NEWSAPI_TIMEOUT": 15,
    "MAX_RETRIES": 3,
    "RETRY_BACKOFF_FACTOR": 2,
    "HEALTH_CHECK_INTERVAL": 300,  # 5 minutes
    "RATE_LIMITS": {
        "yfinance": {"requests": 1000, "window": 3600},
        "alpha_vantage": {"requests": 500, "window": 3600},
        "newsapi": {"requests": 1000, "window": 3600}
    },
    "CACHE_TTLS": {
        "price_data": 60,
        "historical_data": 300,
        "news_data": 900
    }
}
```
```

### docs/claude/modules/Claude.Infrastructure.md
```markdown
# Claude.Infrastructure

- **Purpose**: Provide robust, scalable infrastructure foundation with Docker orchestration, database management, caching, monitoring, and deployment automation
- **Scope (in/out)**:
  - **In**: Docker containerization, PostgreSQL database, Redis caching, Nginx reverse proxy, monitoring/logging, backup systems, CI/CD pipelines
  - **Out**: Application business logic (handled by other modules), frontend components (handled by UserInterface), external API integrations (handled by DataSources)
- **Public API (signatures, inputs/outputs, errors)**:
  - `DockerManager.start_services() → ServiceStatus`
  - `DatabaseManager.create_connection_pool() → ConnectionPool`
  - `RedisManager.get_cache_client() → RedisClient`
  - `MonitoringService.collect_metrics() → MetricsData`
  - `BackupManager.create_backup() → BackupResult`
- **Data contracts (schemas, invariants)**:
  - ServiceStatus: service_name(str), status("running"|"stopped"|"error"), uptime_seconds(int≥0), health_check_url(str|null)
  - ConnectionPool: max_connections(int>0), active_connections(int≥0), available_connections(int≥0), connection_timeout(int>0)
  - MetricsData: timestamp(datetime), cpu_usage(0≤float≤100), memory_usage(0≤float≤100), response_time_ms(int≥0)
  - BackupResult: backup_id(str), timestamp(datetime), size_bytes(int≥0), status("success"|"failed"), location(str)
- **Dependencies (internal/external)**:
  - **Internal**: All application modules require infrastructure services
  - **External**: Docker, PostgreSQL, Redis, Nginx, Prometheus, Grafana, Loki, docker-compose, kubernetes (planned)
- **State & concurrency model**: Stateful services with persistent storage, connection pooling for concurrency, graceful shutdown procedures, health monitoring
- **Failure modes & retries**: Service auto-restart on failure, database connection retry with exponential backoff, Redis failover to direct database queries
- **Performance/SLOs**: <1s service startup, <100ms database queries, 99.9% uptime, <5s backup completion, <10s deployment time
- **Security/permissions**: Container isolation, environment variable secrets, database encryption at rest, TLS termination, firewall rules
- **Observability (logs/metrics/traces)**: Structured logging with ELK stack, Prometheus metrics, Grafana dashboards, distributed tracing, alert management
- **Change risks & migration notes**: Database schema changes require migration scripts; Docker image updates need rolling deployment; Redis cache invalidation on data model changes

## TDD: Requirements → Tests

### REQ-INFRA-01: Docker container orchestration with service dependency management
- **Unit tests**:
  - UT-INFRA-01.1: Given docker-compose.yml When start_services() Then start containers in correct dependency order
  - UT-INFRA-01.2: Given container failure When monitor_health() Then restart failed container and update status
  - UT-INFRA-01.3: Given graceful shutdown When stop_services() Then stop containers with proper cleanup sequence
- **Edge/negative/property tests**:
  - ET-INFRA-01.1: Given insufficient system resources When start_containers() Then handle resource constraints gracefully
  - ET-INFRA-01.2: Given network partition When container_communication() Then maintain service isolation
  - PT-INFRA-01.1: Property: container restart preserves data persistence, service startup order maintains dependencies
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Docker daemon with controllable container states
  - Stub system resources for resource testing
  - Fake network conditions for isolation testing
- **Coverage mapping**:
  - Lines/branches/functions covered: DockerManager, start_services(), health_monitor(), graceful_shutdown()

### REQ-INFRA-02: PostgreSQL database with connection pooling and backup automation
- **Unit tests**:
  - UT-INFRA-02.1: Given database configuration When create_connection_pool() Then establish pool with specified parameters
  - UT-INFRA-02.2: Given connection pool exhaustion When request_connection() Then queue request and handle timeout
  - UT-INFRA-02.3: Given backup schedule When run_backup() Then create consistent backup and verify integrity
- **Edge/negative/property tests**:
  - ET-INFRA-02.1: Given database crash When connection_attempt() Then handle gracefully and attempt reconnection
  - ET-INFRA-02.2: Given corrupted backup When restore_backup() Then detect corruption and fallback to previous backup
  - PT-INFRA-02.1: Property: connection pool never exceeds max connections, backup integrity always verifiable
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock PostgreSQL with controllable failure scenarios
  - Stub file system for backup testing
  - Fake time provider for backup scheduling
- **Coverage mapping**:
  - Lines/branches/functions covered: DatabaseManager, connection_pool(), backup_manager(), integrity_check()

### REQ-INFRA-03: Redis caching with failover and monitoring integration
- **Unit tests**:
  - UT-INFRA-03.1: Given Redis configuration When initialize_cache() Then establish connection with proper settings
  - UT-INFRA-03.2: Given cache miss When get_cached_data() Then fallback to database and cache result
  - UT-INFRA-03.3: Given Redis failure When cache_operation() Then degrade gracefully to direct database access
- **Edge/negative/property tests**:
  - ET-INFRA-03.1: Given Redis memory exhaustion When cache_write() Then handle eviction policies correctly
  - ET-INFRA-03.2: Given network timeout When Redis_operation() Then timeout gracefully and log error
  - PT-INFRA-03.1: Property: cache coherence maintained, fallback preserves application functionality
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Redis with controllable memory and network scenarios
  - Stub cache operations with deterministic timing
  - Fake memory pressure for eviction testing
- **Coverage mapping**:
  - Lines/branches/functions covered: RedisManager, cache_client(), failover_handler(), memory_monitor()

### REQ-INFRA-04: Monitoring and alerting with Prometheus and Grafana integration
- **Unit tests**:
  - UT-INFRA-04.1: Given metrics collection When collect_system_metrics() Then gather CPU, memory, and disk usage
  - UT-INFRA-04.2: Given alert threshold When metric_exceeds_threshold() Then trigger alert and notify operators
  - UT-INFRA-04.3: Given dashboard configuration When render_dashboard() Then display real-time metrics visualization
- **Edge/negative/property tests**:
  - ET-INFRA-04.1: Given metrics collection failure When monitoring_error() Then handle gracefully and alert
  - ET-INFRA-04.2: Given alert spam When multiple_alerts() Then implement alert deduplication and rate limiting
  - PT-INFRA-04.1: Property: metrics accuracy within 5% tolerance, alert delivery within 30 seconds
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Prometheus with controllable metric scenarios
  - Stub Grafana API for dashboard testing
  - Fake system metrics for threshold testing
- **Coverage mapping**:
  - Lines/branches/functions covered: MonitoringService, collect_metrics(), alert_manager(), dashboard_renderer()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-INFRA-01 | UT-INFRA-01.1-3 | ET-INFRA-01.1-2 | PT-INFRA-01.1 | IT-INFRA-01 |
| REQ-INFRA-02 | UT-INFRA-02.1-3 | ET-INFRA-02.1-2 | PT-INFRA-02.1 | IT-INFRA-02 |
| REQ-INFRA-03 | UT-INFRA-03.1-3 | ET-INFRA-03.1-2 | PT-INFRA-03.1 | IT-INFRA-03 |
| REQ-INFRA-04 | UT-INFRA-04.1-3 | ET-INFRA-04.1-2 | PT-INFRA-04.1 | IT-INFRA-04 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Service Startup**: validate_config() → initialize_dependencies() → start_core_services() → health_check() → register_monitoring()
2. **Database Management**: create_pool() → validate_connections() → setup_monitoring() → schedule_backups() → enable_replication()
3. **Cache Management**: initialize_redis() → setup_failover() → configure_eviction() → monitor_memory() → handle_failures()
4. **Monitoring Setup**: install_agents() → configure_dashboards() → setup_alerts() → test_notification() → enable_collection()

### Pseudocode (reference)
```yaml
# docker-compose.yml infrastructure
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: turtletrading
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - backend
      - frontend

  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/dashboards:/etc/grafana/provisioning/dashboards
```

### Error Handling & Retries
- **Container failures**: Automatic restart with health checks, exponential backoff for persistent failures
- **Database failures**: Connection retry (3 attempts), read replica failover, backup restoration procedures
- **Cache failures**: Graceful degradation to database, automatic Redis restart, memory optimization
- **Monitoring failures**: Alert escalation, backup monitoring systems, manual intervention procedures

### Config/flags
```python
INFRASTRUCTURE_CONFIG = {
    "DOCKER_COMPOSE_FILE": "docker-compose.yml",
    "DB_POOL_SIZE": 10,
    "DB_MAX_OVERFLOW": 20,
    "DB_POOL_TIMEOUT": 30,
    "REDIS_MAX_MEMORY": "512mb",
    "REDIS_EVICTION_POLICY": "allkeys-lru",
    "BACKUP_SCHEDULE": "0 2 * * *",  # Daily at 2 AM
    "BACKUP_RETENTION_DAYS": 30,
    "MONITORING_INTERVAL": 60,  # seconds
    "ALERT_COOLDOWN": 300,  # 5 minutes
    "HEALTH_CHECK_TIMEOUT": 30,
    "SERVICE_RESTART_ATTEMPTS": 3,
    "NGINX_WORKER_PROCESSES": "auto",
    "SSL_CERTIFICATE_PATH": "/etc/ssl/certs/turtletrading.crt"
}
```
```

### docs/claude/modules/Claude.MarketData.md
```markdown
# Claude.MarketData

- **Purpose**: Provide real-time market data streaming, sentiment analysis, WebSocket management, and comprehensive market breadth analysis for live trading insights and market condition assessment
- **Scope (in/out)**:
  - **In**: WebSocket data streaming, sentiment analysis, market indices tracking, market breadth calculations, real-time price broadcasting, connection management, data validation
  - **Out**: Raw data fetching (handled by DataSources), stock-specific analysis (handled by StockAnalysis), user interface rendering (handled by UserInterface), data storage (handled by Infrastructure)
- **Public API (signatures, inputs/outputs, errors)**:
  - `MarketDataService.get_market_overview() → MarketOverview | None`
  - `MarketDataService.get_market_indices() → Dict[str, IndexData] | None`
  - `MarketDataService.get_market_breadth() → MarketBreadth | None`
  - `MarketDataService.get_sentiment_overview() → SentimentOverview | None`
  - `WebSocketManager.connect_client(client_id, auth_token) → WebSocketConnection | ConnectionError`
  - `WebSocketManager.subscribe_to_symbols(client_id, symbols) → SubscriptionResult | None`
  - `WebSocketManager.broadcast_update(market_update) → BroadcastResult | None`
- **Data contracts (schemas, invariants)**:
  - MarketOverview: indices(Dict[str, IndexData]), market_status('OPEN'|'CLOSED'|'PRE_MARKET'|'AFTER_HOURS'), sentiment_score(-100≤float≤100), breadth(MarketBreadth), timestamp(datetime)
  - IndexData: symbol(str), current_value(float>0), change_percent(float), volume(int≥0), timestamp(datetime)
  - MarketBreadth: advancing(int≥0), declining(int≥0), unchanged(int≥0), ratio(0≤float≤∞), new_highs(int≥0), new_lows(int≥0)
  - SentimentOverview: overall_score(-100≤float≤100), news_sentiment(float), social_sentiment(float), confidence(0≤float≤1), trending_keywords(List[str])
  - WebSocketConnection: client_id(str), subscriptions(Set[str]), connected_at(datetime), last_ping(datetime)
- **Dependencies (internal/external)**:
  - **Internal**: DataSources (real-time feeds), Authentication (user validation), Infrastructure (Redis pub/sub), StockAnalysis (symbol validation)
  - **External**: WebSocket, asyncio, redis, aiohttp, websockets, sentiment analysis APIs, market data providers
- **State & concurrency model**: Stateful WebSocket connection pool with Redis pub/sub for message broadcasting, asyncio event loop for concurrent connection management, sentiment analysis caching
- **Failure modes & retries**: WebSocket reconnection with exponential backoff, sentiment API fallback to cached data, market data source failover, connection cleanup on errors
- **Performance/SLOs**: <100ms WebSocket message delivery, <500ms market overview aggregation, 99.9% WebSocket uptime, support 1000+ concurrent connections
- **Security/permissions**: WebSocket authentication via JWT, rate limiting per connection, subscription validation, no sensitive data in WebSocket messages
- **Observability (logs/metrics/traces)**: WebSocket connection metrics, message throughput, sentiment API response times, market data latency, connection failure rates
- **Change risks & migration notes**: WebSocket protocol changes require client updates, sentiment model updates need confidence recalibration, market data schema changes need message format versioning

## TDD: Requirements → Tests

### REQ-MARKET-01: Real-time WebSocket data streaming with connection management and subscription handling
- **Unit tests**:
  - UT-MARKET-01.1: Given valid auth token When connect_websocket() Then establish connection and return client_id
  - UT-MARKET-01.2: Given client connection When subscribe_to_symbols(['AAPL', 'TSLA']) Then confirm subscription and start data streaming
  - UT-MARKET-01.3: Given market data update When broadcast_update() Then deliver to all subscribed clients within 100ms
- **Edge/negative/property tests**:
  - ET-MARKET-01.1: Given invalid auth token When connect_websocket() Then reject connection with proper error message
  - ET-MARKET-01.2: Given connection drop When reconnect_attempt() Then restore subscriptions with exponential backoff
  - PT-MARKET-01.1: Property: message delivery order preserved, no duplicate messages, all subscribed clients receive updates
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock WebSocket connections with controllable network conditions
  - Stub Redis pub/sub for deterministic message broadcasting
  - Fake market data updates for subscription testing
- **Coverage mapping**:
  - Lines/branches/functions covered: connect_websocket(), subscribe_symbols(), broadcast_update(), handle_disconnect(), validate_subscription()

### REQ-MARKET-02: Market indices and breadth analysis with real-time aggregation and performance tracking
- **Unit tests**:
  - UT-MARKET-02.1: Given market open When get_market_indices() Then return SPY, QQQ, DIA, IWM with current values and changes
  - UT-MARKET-02.2: Given stock universe When calculate_market_breadth() Then return advancing/declining ratio and new highs/lows
  - UT-MARKET-02.3: Given market close When get_market_overview() Then return comprehensive market status with indices and breadth
- **Edge/negative/property tests**:
  - ET-MARKET-02.1: Given market closed When get_live_data() Then return cached data with proper staleness indicators
  - ET-MARKET-02.2: Given data source failure When aggregate_indices() Then fallback to alternative sources and log errors
  - PT-MARKET-02.1: Property: breadth ratios mathematically consistent, index changes sum correctly, timestamps within acceptable variance
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock market data providers with various market conditions
  - Stub time functions for market hours testing
  - Fake index calculations with known market scenarios
- **Coverage mapping**:
  - Lines/branches/functions covered: get_market_indices(), calculate_breadth(), aggregate_market_data(), validate_market_hours()

### REQ-MARKET-03: Sentiment analysis aggregation with multi-source integration and confidence scoring
- **Unit tests**:
  - UT-MARKET-03.1: Given news articles When analyze_sentiment() Then return aggregated sentiment score with confidence levels
  - UT-MARKET-03.2: Given social media data When process_social_sentiment() Then extract trending keywords and sentiment scores
  - UT-MARKET-03.3: Given multiple sentiment sources When calculate_overall_sentiment() Then weight by reliability and recency
- **Edge/negative/property tests**:
  - ET-MARKET-03.1: Given sentiment API timeout When get_sentiment() Then return cached sentiment with reduced confidence
  - ET-MARKET-03.2: Given conflicting sentiment signals When resolve_conflicts() Then apply confidence-weighted averaging
  - PT-MARKET-03.1: Property: sentiment scores bounded -100 to +100, confidence decreases with data age, keyword relevance scores consistent
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock sentiment APIs with various response patterns
  - Stub natural language processing with controlled sentiment outputs
  - Fake social media feeds with known sentiment patterns
- **Coverage mapping**:
  - Lines/branches/functions covered: analyze_sentiment(), process_social_data(), calculate_confidence(), aggregate_sentiment_sources()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-MARKET-01 | UT-MARKET-01.1-3 | ET-MARKET-01.1-2 | PT-MARKET-01.1 | IT-MARKET-01 |
| REQ-MARKET-02 | UT-MARKET-02.1-3 | ET-MARKET-02.1-2 | PT-MARKET-02.1 | IT-MARKET-02 |
| REQ-MARKET-03 | UT-MARKET-03.1-3 | ET-MARKET-03.1-2 | PT-MARKET-03.1 | IT-MARKET-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **WebSocket Management**: authenticate_connection() → establish_websocket() → manage_subscriptions() → handle_messages() → cleanup_on_disconnect()
2. **Market Data Streaming**: fetch_real_time_data() → validate_data() → broadcast_to_subscribers() → update_cache() → log_metrics()
3. **Sentiment Analysis**: gather_news_data() → analyze_sentiment() → aggregate_social_data() → calculate_confidence() → cache_results()

### Pseudocode (reference)
```python
async def broadcast_market_update(market_update: MarketUpdate) -> BroadcastResult:
    # Validate market update
    if not validate_market_update(market_update):
        raise ValueError("Invalid market update format")

    # Get all subscribers for this symbol
    subscribers = await redis.get_subscribers(market_update.symbol)
    if not subscribers:
        return BroadcastResult(delivered=0, symbol=market_update.symbol)

    # Prepare WebSocket message
    ws_message = {
        "type": "market_update",
        "symbol": market_update.symbol,
        "price": market_update.price,
        "change_percent": market_update.change_percent,
        "volume": market_update.volume,
        "timestamp": market_update.timestamp.isoformat()
    }

    # Broadcast to all subscribers concurrently
    delivery_tasks = []
    for client_id in subscribers:
        connection = websocket_pool.get_connection(client_id)
        if connection and connection.is_active:
            task = asyncio.create_task(
                connection.send_json(ws_message)
            )
            delivery_tasks.append(task)

    # Wait for all deliveries with timeout
    delivered_count = 0
    try:
        results = await asyncio.wait_for(
            asyncio.gather(*delivery_tasks, return_exceptions=True),
            timeout=0.1  # 100ms timeout
        )

        delivered_count = sum(1 for result in results if not isinstance(result, Exception))

    except asyncio.TimeoutError:
        logger.warning(f"Broadcast timeout for {market_update.symbol}")

    # Update metrics
    await metrics.record_broadcast_stats(
        symbol=market_update.symbol,
        subscribers=len(subscribers),
        delivered=delivered_count,
        duration_ms=(datetime.utcnow() - start_time).total_seconds() * 1000
    )

    return BroadcastResult(
        delivered=delivered_count,
        total_subscribers=len(subscribers),
        symbol=market_update.symbol
    )

async def get_market_overview() -> Optional[MarketOverview]:
    # Get market status
    market_status = await get_market_status()

    # Fetch major indices concurrently
    indices_task = asyncio.create_task(get_market_indices())
    breadth_task = asyncio.create_task(calculate_market_breadth())
    sentiment_task = asyncio.create_task(get_sentiment_overview())

    # Wait for all components
    try:
        indices = await asyncio.wait_for(indices_task, timeout=2.0)
        breadth = await asyncio.wait_for(breadth_task, timeout=1.0)
        sentiment = await asyncio.wait_for(sentiment_task, timeout=3.0)
    except asyncio.TimeoutError as e:
        logger.error(f"Market overview timeout: {e}")
        return None

    # Aggregate into overview
    overview = MarketOverview(
        indices=indices,
        market_status=market_status,
        sentiment_score=sentiment.overall_score if sentiment else 0,
        breadth=breadth,
        timestamp=datetime.utcnow()
    )

    # Cache result for 30 seconds
    await redis.setex(
        "market_overview",
        30,
        overview.json()
    )

    return overview
```

### Error Handling & Retries
- **WebSocket failures**: Automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- **Sentiment API errors**: Fallback to cached sentiment data, degrade confidence scores
- **Market data source failures**: Circuit breaker pattern, failover to backup providers
- **Redis connection issues**: Local caching fallback, alert for infrastructure issues

### Config/flags
```python
MARKET_DATA_CONFIG = {
    "WEBSOCKET_CONFIG": {
        "MAX_CONNECTIONS": 1000,
        "HEARTBEAT_INTERVAL": 30,  # seconds
        "CONNECTION_TIMEOUT": 60,
        "MESSAGE_QUEUE_SIZE": 100,
        "RECONNECT_BACKOFF": [1, 2, 4, 8, 16, 30]  # seconds
    },
    "MARKET_INDICES": {
        "PRIMARY": ["SPY", "QQQ", "DIA", "IWM", "VIX"],
        "INTERNATIONAL": ["EWJ", "EFA", "EEM", "FXI"],
        "SECTOR_ETFS": ["XLK", "XLF", "XLE", "XLV", "XLP"],
        "REFRESH_INTERVAL": 5  # seconds
    },
    "SENTIMENT_CONFIG": {
        "NEWS_SOURCES": ["reuters", "bloomberg", "cnbc", "marketwatch"],
        "SOCIAL_SOURCES": ["twitter", "reddit", "stocktwits"],
        "SENTIMENT_WEIGHTS": {
            "news": 0.6,
            "social": 0.3,
            "analyst": 0.1
        },
        "CACHE_TTL": 300,  # 5 minutes
        "CONFIDENCE_DECAY": 0.1  # per hour
    },
    "MARKET_BREADTH": {
        "UNIVERSE_SIZE": 3000,  # stocks to analyze
        "UPDATE_FREQUENCY": 60,  # seconds
        "CHANGE_THRESHOLD": 0.01,  # 1% for advancing/declining
        "NEW_HIGH_LOW_PERIOD": 52  # weeks
    },
    "PERFORMANCE_TARGETS": {
        "WEBSOCKET_LATENCY_MS": 100,
        "MARKET_OVERVIEW_MS": 500,
        "SENTIMENT_ANALYSIS_MS": 3000,
        "CONNECTION_SUCCESS_RATE": 0.999,
        "MESSAGE_DELIVERY_RATE": 0.995
    }
}
```
```

### docs/claude/modules/Claude.StockAnalysis.md
```markdown
# Claude.StockAnalysis

- **Purpose**: Provide comprehensive stock data analysis through LSTM neural network predictions, 15+ technical indicators, risk assessment, and multi-factor scoring algorithms for intelligent trading recommendations
- **Scope (in/out)**:
  - **In**: LSTM model training and inference, technical indicator calculations (RSI, MACD, Bollinger Bands, etc.), risk analysis, weighted scoring, seasonality analysis, batch processing
  - **Out**: Raw market data fetching (handled by DataSources), user interface rendering (handled by UserInterface), real-time data streaming (handled by MarketData)
- **Public API (signatures, inputs/outputs, errors)**:
  - `StockService.get_current_price(symbol) → StockPrice | None`
  - `StockService.get_technical_indicators(symbol, period) → TechnicalIndicators | None`
  - `StockService.get_lstm_prediction(symbol, horizon_days) → LSTMPrediction | None`
  - `StockService.get_comprehensive_analysis(symbol, period) → AnalysisResult | None`
  - `StockService.batch_analyze(symbols) → Dict[str, AnalysisResult]`
- **Data contracts (schemas, invariants)**:
  - StockPrice: symbol(str), current_price(float>0), volume(int≥0), market_cap(int≥0), change_percent(float), timestamp(datetime)
  - TechnicalIndicators: rsi(0≤float≤100), macd(dict), bollinger_bands(dict), technical_score(0≤float≤1), recommendation('BUY'|'SELL'|'HOLD')
  - LSTMPrediction: predictions(Array[float]), confidence_intervals(dict), horizon_days(int>0), model_accuracy(0≤float≤1)
  - AnalysisResult: technical_score(float), lstm_score(float), sentiment_score(float), final_score(float), recommendation(str)
- **Dependencies (internal/external)**:
  - **Internal**: DataSources (market data), Infrastructure (caching), Authentication (user context)
  - **External**: yfinance, ta, TA-Lib, pandas, numpy, tensorflow, scikit-learn, redis
- **State & concurrency model**: Stateless analysis service with Redis caching, ThreadPoolExecutor for concurrent I/O operations, async LSTM model inference
- **Failure modes & retries**: Data source failures handled by DataSources fallback, model failures return confidence=0, cache failures degrade gracefully to direct computation
- **Performance/SLOs**: <500ms technical analysis, <2s LSTM prediction, <100ms cached results, 95% success rate for valid symbols
- **Security/permissions**: No sensitive data stored, user-tier based features (Pro gets advanced indicators), input validation for all symbols
- **Observability (logs/metrics/traces)**: Analysis duration, cache hit ratios, model performance metrics, error rates by symbol, prediction accuracy tracking
- **Change risks & migration notes**: LSTM model updates require retraining pipeline, new indicators need weight calibration, cache schema changes need migration

## TDD: Requirements → Tests

### REQ-STOCK-01: Technical indicator calculations with 15+ indicators and weighted scoring
- **Unit tests**:
  - UT-STOCK-01.1: Given AAPL historical data When calculate_rsi() Then return RSI between 0-100 with proper overbought/oversold signals
  - UT-STOCK-01.2: Given NVDA price data When calculate_macd() Then return MACD line, signal line, and histogram with buy/sell crossovers
  - UT-STOCK-01.3: Given TSLA data When calculate_bollinger_bands() Then return upper, middle, lower bands with price position indicators
- **Edge/negative/property tests**:
  - ET-STOCK-01.1: Given insufficient data (< 20 periods) When calculate_indicators() Then handle gracefully and return partial results
  - ET-STOCK-01.2: Given extreme price movements (circuit breakers) When technical_analysis() Then maintain mathematical stability
  - PT-STOCK-01.1: Property: RSI values always between 0-100, MACD crossovers generate consistent signals, indicator weights sum to 1.0
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock yfinance with controllable price data scenarios
  - Stub TA-Lib with known indicator outputs for validation
  - Fake market conditions (bull/bear/sideways) for scoring tests
- **Coverage mapping**:
  - Lines/branches/functions covered: calculate_all_indicators(), weighted_technical_score(), get_recommendation(), validate_symbol()

### REQ-STOCK-02: LSTM neural network predictions with confidence intervals and model performance tracking
- **Unit tests**:
  - UT-STOCK-02.1: Given trained LSTM model When predict_price(symbol, 5_days) Then return predictions with 80% and 95% confidence intervals
  - UT-STOCK-02.2: Given 90-day lookback window When prepare_lstm_features() Then create feature matrix with price + 15 technical indicators
  - UT-STOCK-02.3: Given model predictions When calculate_directional_accuracy() Then track prediction vs actual direction success rate
- **Edge/negative/property tests**:
  - ET-STOCK-02.1: Given model loading failure When lstm_predict() Then fallback to trend analysis and return confidence=0
  - ET-STOCK-02.2: Given market volatility spike When model_inference() Then adjust confidence intervals dynamically
  - PT-STOCK-02.1: Property: prediction confidence inversely correlates with market volatility, longer horizons have lower confidence
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock TensorFlow model with deterministic prediction outputs
  - Stub feature engineering with known technical indicator values
  - Fake GPU availability for CPU-only testing environments
- **Coverage mapping**:
  - Lines/branches/functions covered: lstm_predict(), prepare_features(), calculate_confidence(), track_performance()

### REQ-STOCK-03: Multi-factor analysis combining LSTM, technical, sentiment, and seasonality scores
- **Unit tests**:
  - UT-STOCK-03.1: Given all analysis components When generate_final_score() Then combine 50% LSTM + 30% technical + 10% sentiment + 10% seasonality
  - UT-STOCK-03.2: Given conflicting signals (bullish technical, bearish LSTM) When resolve_conflicts() Then weight by confidence levels
  - UT-STOCK-03.3: Given seasonal patterns When apply_seasonality_boost() Then enhance scores during historically strong periods
- **Edge/negative/property tests**:
  - ET-STOCK-03.1: Given missing sentiment data When calculate_final_score() Then adjust weights proportionally (technical + LSTM = 100%)
  - ET-STOCK-03.2: Given extreme market conditions When multi_factor_analysis() Then prevent score amplification beyond reasonable bounds
  - PT-STOCK-03.1: Property: final score bounded 0-1, recommendation consistency with score ranges, all factors contribute meaningfully
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock sentiment service with controllable sentiment scores
  - Stub seasonality data with known historical patterns
  - Fake market conditions for comprehensive scoring scenarios
- **Coverage mapping**:
  - Lines/branches/functions covered: generate_final_score(), resolve_signal_conflicts(), apply_seasonality(), get_recommendation()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-STOCK-01 | UT-STOCK-01.1-3 | ET-STOCK-01.1-2 | PT-STOCK-01.1 | IT-STOCK-01 |
| REQ-STOCK-02 | UT-STOCK-02.1-3 | ET-STOCK-02.1-2 | PT-STOCK-02.1 | IT-STOCK-02 |
| REQ-STOCK-03 | UT-STOCK-03.1-3 | ET-STOCK-03.1-2 | PT-STOCK-03.1 | IT-STOCK-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Technical Analysis**: fetch_data() → calculate_indicators() → apply_weights() → generate_score() → cache_results()
2. **LSTM Prediction**: prepare_features() → load_model() → predict() → calculate_confidence() → format_output()
3. **Multi-factor Analysis**: gather_all_scores() → resolve_conflicts() → apply_seasonality() → final_recommendation()

### Pseudocode (reference)
```python
async def get_comprehensive_analysis(symbol: str, period: str = "1y") -> Optional[AnalysisResult]:
    # Validate input
    if not validate_symbol(symbol):
        return None

    # Check cache first
    cache_key = f"analysis:{symbol}:{period}"
    cached = await redis.get(cache_key)
    if cached:
        return AnalysisResult.parse_raw(cached)

    # Fetch base data
    price_data = await data_sources.get_price_history(symbol, period)
    if not price_data:
        return None

    # Run analysis components concurrently
    technical_task = asyncio.create_task(calculate_technical_score(price_data))
    lstm_task = asyncio.create_task(get_lstm_prediction(symbol, horizon=5))
    sentiment_task = asyncio.create_task(get_sentiment_score(symbol))

    # Wait for all components
    technical_score = await technical_task
    lstm_score = await lstm_task
    sentiment_score = await sentiment_task

    # Apply seasonality
    seasonality_boost = calculate_seasonality_factor(symbol, datetime.now())

    # Generate final score (50% LSTM + 30% technical + 10% sentiment + 10% seasonality)
    final_score = (
        0.5 * lstm_score.confidence * lstm_score.direction +
        0.3 * technical_score +
        0.1 * sentiment_score +
        0.1 * seasonality_boost
    )

    # Generate recommendation
    recommendation = get_recommendation(final_score, confidence=min(lstm_score.confidence, 0.8))

    result = AnalysisResult(
        symbol=symbol,
        technical_score=technical_score,
        lstm_score=lstm_score.confidence,
        sentiment_score=sentiment_score,
        final_score=final_score,
        recommendation=recommendation,
        timestamp=datetime.utcnow()
    )

    # Cache result
    await redis.setex(cache_key, 300, result.json())  # 5-minute cache

    return result
```

### Error Handling & Retries
- **Data fetch failures**: Automatic fallback through DataSources module, degrade gracefully with partial analysis
- **Model inference errors**: Return confidence=0, fallback to pure technical analysis, log for model retraining
- **Calculation errors**: Skip problematic indicators, adjust weights, continue with available data
- **Cache failures**: Continue with direct computation, log cache issues for infrastructure team

### Config/flags
```python
STOCK_ANALYSIS_CONFIG = {
    "TECHNICAL_WEIGHTS": {
        "RSI": 0.12, "MACD": 0.16, "EMA20": 0.12, "SMA50": 0.10, "SMA200": 0.10,
        "Stochastic": 0.10, "Bollinger": 0.10, "ADX": 0.12, "OBV": 0.08
    },
    "LSTM_CONFIG": {
        "LOOKBACK_WINDOW": 90,
        "PREDICTION_HORIZON": [1, 5, 10, 30],
        "MODEL_PATH": "/models/lstm_v2.h5",
        "FEATURE_COUNT": 20,  # Price + volume + 18 technical indicators
        "CONFIDENCE_THRESHOLD": 0.6
    },
    "SCORING_WEIGHTS": {
        "LSTM_WEIGHT": 0.5,
        "TECHNICAL_WEIGHT": 0.3,
        "SENTIMENT_WEIGHT": 0.1,
        "SEASONALITY_WEIGHT": 0.1
    },
    "CACHE_TTL": {
        "TECHNICAL_ANALYSIS": 300,  # 5 minutes
        "LSTM_PREDICTION": 1800,    # 30 minutes
        "COMPREHENSIVE_ANALYSIS": 300  # 5 minutes
    },
    "PERFORMANCE_TARGETS": {
        "TECHNICAL_ANALYSIS_MS": 500,
        "LSTM_PREDICTION_MS": 2000,
        "CACHE_HIT_RATIO": 0.8,
        "SUCCESS_RATE": 0.95
    }
}
```
```

### docs/claude/modules/Claude.Testing.md
```markdown
# Claude.Testing

- **Purpose**: Provide comprehensive testing framework with unit, integration, and E2E testing capabilities ensuring 100% coverage across all modules
- **Scope (in/out)**:
  - **In**: Pytest backend testing, Vitest frontend testing, Playwright E2E testing, test data fixtures, mocking frameworks, coverage reporting, CI/CD integration
  - **Out**: Production monitoring (handled by Infrastructure), user acceptance testing (handled by UserInterface), performance benchmarking (handled by specific modules)
- **Public API (signatures, inputs/outputs, errors)**:
  - `TestRunner.run_unit_tests() → TestResults`
  - `TestRunner.run_integration_tests() → TestResults`
  - `PlaywrightRunner.run_e2e_tests() → E2EResults`
  - `CoverageReporter.generate_report() → CoverageReport`
  - `MockDataFactory.create_stock_data(symbol) → MockStockData`
- **Data contracts (schemas, invariants)**:
  - TestResults: total_tests(int≥0), passed(int≥0), failed(int≥0), coverage_percentage(0≤float≤100), duration_ms(int>0)
  - MockStockData: symbol(str), prices(Array<float>), volume(Array<int>), timestamps(Array<datetime>), valid_date_range(boolean)
  - CoverageReport: module_name(str), line_coverage(0≤float≤100), branch_coverage(0≤float≤100), function_coverage(0≤float≤100)
  - E2EResults: scenarios_run(int≥0), scenarios_passed(int≥0), browser_coverage(Array<string>), screenshots(Array<string>)
- **Dependencies (internal/external)**:
  - **Internal**: All modules (StockAnalysis, MarketData, Authentication, UserInterface, DataSources, Infrastructure)
  - **External**: pytest, pytest-asyncio, pytest-cov, vitest, playwright, faker, factory-boy, responses, aioresponses
- **State & concurrency model**: Stateless test execution with isolated test environments, parallel test execution with resource locking, deterministic test data generation
- **Failure modes & retries**: Test environment isolation prevents cross-test contamination; flaky test detection with 3 retries; test data cleanup on failure
- **Performance/SLOs**: Unit tests <10s total, integration tests <60s total, E2E tests <300s total, 100% line/branch/function coverage mandatory
- **Security/permissions**: Test environment isolation, no production data access, mock credential management, secure test data generation
- **Observability (logs/metrics/traces)**: Test execution timing, coverage trends, failure analysis, flaky test detection, CI/CD integration metrics
- **Change risks & migration notes**: New modules require test specs; coverage thresholds block deployment; test data schema changes need fixture updates

## TDD: Requirements → Tests

### REQ-TEST-01: 100% code coverage enforcement with branch and function coverage
- **Unit tests**:
  - UT-TEST-01.1: Given module with uncovered lines When run_coverage_check() Then fail build and report missing lines
  - UT-TEST-01.2: Given module with uncovered branches When run_coverage_check() Then fail build and report missing branches
  - UT-TEST-01.3: Given module with 100% coverage When run_coverage_check() Then pass and generate coverage badge
- **Edge/negative/property tests**:
  - ET-TEST-01.1: Given malformed source code When calculate_coverage() Then handle gracefully and report parsing errors
  - ET-TEST-01.2: Given dynamic code execution When measure_coverage() Then capture runtime coverage accurately
  - PT-TEST-01.1: Property: coverage percentage monotonic with test additions, no false positives in coverage reporting
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock coverage.py with controllable coverage scenarios
  - Stub file system for coverage report generation
  - Fake source code with known coverage patterns
- **Coverage mapping**:
  - Lines/branches/functions covered: CoverageReporter, CoverageEnforcer, coverage_check(), generate_badge()

### REQ-TEST-02: Comprehensive mock data generation for all trading scenarios
- **Unit tests**:
  - UT-TEST-02.1: Given stock symbol When generate_mock_price_data() Then return realistic OHLCV data with proper trends
  - UT-TEST-02.2: Given market scenario When generate_mock_market_data() Then return consistent index and sentiment data
  - UT-TEST-02.3: Given user profile When generate_mock_user_data() Then return valid user with proper permissions
- **Edge/negative/property tests**:
  - ET-TEST-02.1: Given extreme market conditions When generate_mock_data() Then handle edge cases like market crashes
  - ET-TEST-02.2: Given invalid input parameters When create_mock_data() Then validate inputs and return appropriate errors
  - PT-TEST-02.1: Property: generated data maintains financial constraints (volume≥0, price>0), temporal consistency
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock external APIs with deterministic responses
  - Stub random number generation for reproducible tests
  - Fake time providers for temporal testing
- **Coverage mapping**:
  - Lines/branches/functions covered: MockDataFactory, generate_stock_data(), generate_user_data(), validate_mock_data()

### REQ-TEST-03: Playwright E2E testing with multi-browser support and CI integration
- **Unit tests**:
  - UT-TEST-03.1: Given browser configuration When launch_playwright() Then start browser with proper capabilities
  - UT-TEST-03.2: Given E2E test scenario When execute_test() Then navigate UI and validate interactions
  - UT-TEST-03.3: Given test failure When capture_evidence() Then save screenshots and logs for debugging
- **Edge/negative/property tests**:
  - ET-TEST-03.1: Given browser crash When handle_browser_failure() Then restart browser and retry test
  - ET-TEST-03.2: Given network interruption When E2E_test_running() Then handle gracefully with timeout
  - PT-TEST-03.1: Property: tests idempotent across browsers, UI state consistent after test completion
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock backend APIs with controllable responses
  - Stub browser APIs for headless testing
  - Fake network conditions for resilience testing
- **Coverage mapping**:
  - Lines/branches/functions covered: PlaywrightRunner, execute_e2e_test(), capture_screenshot(), browser_manager()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-TEST-01 | UT-TEST-01.1-3 | ET-TEST-01.1-2 | PT-TEST-01.1 | IT-TEST-01 |
| REQ-TEST-02 | UT-TEST-02.1-3 | ET-TEST-02.1-2 | PT-TEST-02.1 | IT-TEST-02 |
| REQ-TEST-03 | UT-TEST-03.1-3 | ET-TEST-03.1-2 | PT-TEST-03.1 | IT-TEST-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Test Execution**: discover_tests() → setup_environment() → run_parallel_tests() → collect_results() → generate_reports()
2. **Coverage Analysis**: instrument_code() → execute_tests() → measure_coverage() → enforce_thresholds() → generate_badges()
3. **E2E Testing**: start_services() → launch_browsers() → execute_scenarios() → capture_evidence() → cleanup()

### Pseudocode (reference)
```python
class TestRunner:
    async def run_comprehensive_tests(self) -> TestResults:
        # Setup test environment
        await self.setup_test_db()
        await self.start_mock_services()

        # Run unit tests with coverage
        unit_results = await self.run_unit_tests_with_coverage()
        if unit_results.coverage < 100:
            raise CoverageThresholdError(f"Coverage {unit_results.coverage}% < 100%")

        # Run integration tests
        integration_results = await self.run_integration_tests()

        # Run E2E tests
        e2e_results = await self.run_e2e_tests()

        # Generate comprehensive report
        return TestResults(
            unit=unit_results,
            integration=integration_results,
            e2e=e2e_results,
            total_coverage=unit_results.coverage
        )
```

### Error Handling & Retries
- **Flaky tests**: 3 automatic retries with exponential backoff, quarantine persistently failing tests
- **Environment failures**: Clean test database recreation, service restart, browser session reset
- **Coverage failures**: Detailed line-by-line reporting, suggest missing test cases
- **CI integration**: Fail-fast on coverage violations, detailed failure reports, parallel execution

### Config/flags
```python
TESTING_CONFIG = {
    "COVERAGE_THRESHOLD": 100,  # Mandatory 100% coverage
    "PARALLEL_WORKERS": 4,
    "TEST_TIMEOUT": 300,  # 5 minutes max per test
    "RETRY_FLAKY_TESTS": 3,
    "BROWSER_HEADLESS": True,
    "MOCK_EXTERNAL_APIS": True,
    "TEST_DB_URL": "postgresql://test:test@localhost:5432/test_db",
    "E2E_BROWSERS": ["chromium", "firefox", "webkit"],
    "COVERAGE_FORMATS": ["html", "xml", "json", "lcov"]
}
```
```

### docs/claude/modules/Claude.UserInterface.md
```markdown
# Claude.UserInterface

- **Purpose**: Provide responsive, accessible frontend interface with state management, routing, and real-time updates for trading platform users
- **Scope (in/out)**:
  - **In**: React components, routing, state management (Zustand + React Query), responsive design, error boundaries, form validation, WebSocket integration
  - **Out**: Backend API logic (handled by other modules), data persistence (handled by Infrastructure), business calculations (handled by StockAnalysis/MarketData)
- **Public API (signatures, inputs/outputs, errors)**:
  - Routes: `/`, `/stock/:symbol`, `/market`, `/settings`, `/about`
  - Components: `<Layout />`, `<Dashboard />`, `<StockAnalysis />`, `<LoginForm />`, `<ErrorBoundary />`
  - Hooks: `useStockData(symbol)`, `useMarketData()`, `useAuth()`, `useWebSocket()`
  - State: `useAuthStore()`, `useMarketStore()`, `useUIStore()`
- **Data contracts (schemas, invariants)**:
  - AuthState: isAuthenticated(boolean), user(UserProfile|null), loading(boolean), error(string|null)
  - MarketState: stockPrices(Map<string, StockPrice>), watchlists(Array), isConnected(boolean), lastUpdate(timestamp)
  - UIState: theme("light"|"dark"|"system"), sidebarOpen(boolean), notifications(Array), screenSize(string)
  - RouteParams: symbol(valid_stock_symbol), period(valid_timeframe), filters(object)
- **Dependencies (internal/external)**:
  - **Internal**: Authentication (JWT tokens), StockAnalysis (price/technical data), MarketData (real-time updates), Infrastructure (WebSocket)
  - **External**: React 18, TypeScript, Vite, TailwindCSS, React Router, Zustand, React Query, Socket.io-client
- **State & concurrency model**: Hybrid state management with Zustand for client state, React Query for server state, optimistic updates with rollback on error
- **Failure modes & retries**: Network errors → retry with exponential backoff; component errors → error boundary isolation; WebSocket disconnect → auto-reconnection
- **Performance/SLOs**: <2s initial load, <100ms state updates, <50ms component renders, <500ms route transitions, 60fps animations
- **Security/permissions**: XSS protection via React, CSRF protection via tokens, input sanitization, secure token storage, no sensitive data in localStorage
- **Observability (logs/metrics/traces)**: User interaction tracking, performance metrics, error tracking, route timing, component render counts
- **Change risks & migration notes**: State schema changes need migration functions; React version updates require dependency testing; design system changes affect all components

## TDD: Requirements → Tests

### REQ-UI-01: Responsive layout with mobile-first design and accessibility
- **Unit tests**:
  - UT-UI-01.1: Given mobile viewport (320px) When render Layout Then show hamburger menu and collapse sidebar
  - UT-UI-01.2: Given desktop viewport (1024px) When render Layout Then show full navigation and expanded sidebar
  - UT-UI-01.3: Given keyboard navigation When tab through components Then focus follows logical order with visible indicators
- **Edge/negative/property tests**:
  - ET-UI-01.1: Given extremely narrow viewport (100px) When render Then maintain minimum usable layout
  - ET-UI-01.2: Given screen reader enabled When navigate interface Then announce all interactive elements
  - PT-UI-01.1: Property: all interactive elements have aria-labels, color contrast ≥ 4.5:1, touch targets ≥ 44px
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock window.matchMedia for viewport testing
  - Stub ResizeObserver with controllable viewport changes
  - Fake touch events for mobile interaction testing
- **Coverage mapping**:
  - Lines/branches/functions covered: Layout component, responsive hooks, accessibility helpers, breakpoint utilities

### REQ-UI-02: State management with Zustand and React Query integration
- **Unit tests**:
  - UT-UI-02.1: Given user login action When updateAuthState() Then persist authentication and sync across components
  - UT-UI-02.2: Given stock price update When useStockData() Then update cache and trigger re-render
  - UT-UI-02.3: Given network error When API call fails Then show error state and enable retry
- **Edge/negative/property tests**:
  - ET-UI-02.1: Given localStorage unavailable When persist state Then gracefully degrade without errors
  - ET-UI-02.2: Given stale cache data When network available Then background refresh and update
  - PT-UI-02.1: Property: state updates are atomic, no intermediate invalid states, cache coherence maintained
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Zustand store with controllable state scenarios
  - Stub React Query with deterministic cache behavior
  - Fake localStorage with quota exceeded simulation
- **Coverage mapping**:
  - Lines/branches/functions covered: useAuthStore, useMarketStore, useUIStore, React Query hooks, cache invalidation

### REQ-UI-03: Real-time WebSocket integration with connection management
- **Unit tests**:
  - UT-UI-03.1: Given WebSocket connection When price update received Then update UI without full re-render
  - UT-UI-03.2: Given connection lost When useWebSocket() Then show disconnected state and attempt reconnection
  - UT-UI-03.3: Given subscription to symbol When user navigates away Then unsubscribe to prevent memory leaks
- **Edge/negative/property tests**:
  - ET-UI-03.1: Given malformed WebSocket message When received Then ignore and maintain connection
  - ET-UI-03.2: Given rapid connection/disconnection When network unstable Then debounce reconnection attempts
  - PT-UI-03.1: Property: subscriptions cleaned up on unmount, no duplicate subscriptions, message order preserved
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock WebSocket with controllable connect/disconnect scenarios
  - Stub message queue with deterministic delivery
  - Fake network conditions for connection testing
- **Coverage mapping**:
  - Lines/branches/functions covered: useWebSocket hook, connection manager, subscription cleanup, message handlers

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-UI-01 | UT-UI-01.1-3 | ET-UI-01.1-2 | PT-UI-01.1 | IT-UI-01 |
| REQ-UI-02 | UT-UI-02.1-3 | ET-UI-02.1-2 | PT-UI-02.1 | IT-UI-02 |
| REQ-UI-03 | UT-UI-03.1-3 | ET-UI-03.1-2 | PT-UI-03.1 | IT-UI-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Component Lifecycle**: mount → load_initial_state() → subscribe_to_updates() → handle_user_interactions() → cleanup_on_unmount()
2. **State Synchronization**: user_action() → optimistic_update() → api_call() → success ? confirm : rollback()
3. **Route Navigation**: route_change() → load_route_data() → update_breadcrumbs() → render_page_component()

### Pseudocode (reference)
```typescript
const useStockData = (symbol: string) => {
  const { data, error, isLoading } = useQuery(
    ['stock', symbol],
    () => fetchStockPrice(symbol),
    {
      staleTime: 60000, // 1 minute
      refetchInterval: 30000, // 30 seconds
      onError: (error) => useUIStore.getState().showNotification({
        type: 'error',
        message: `Failed to load ${symbol} data`
      })
    }
  );

  // Subscribe to WebSocket updates
  useEffect(() => {
    const unsubscribe = websocketManager.subscribe(symbol, (update) => {
      queryClient.setQueryData(['stock', symbol], update);
    });

    return unsubscribe;
  }, [symbol]);

  return { data, error, isLoading };
};
```

### Error Handling & Retries
- **Component errors**: Error boundaries isolate failures, show fallback UI, enable retry
- **Network errors**: Exponential backoff (1s, 2s, 4s), max 3 retries, user notification
- **State corruption**: Reset to last known good state, re-fetch critical data
- **WebSocket errors**: Auto-reconnect with increasing delays, fallback to polling

### Config/flags
```typescript
UI_CONFIG = {
  "WEBSOCKET_RECONNECT_INTERVAL": 5000,
  "MAX_RECONNECT_ATTEMPTS": 10,
  "CACHE_STALE_TIME": 60000,
  "REFETCH_INTERVAL": 30000,
  "ANIMATION_DURATION": 300,
  "BREAKPOINTS": {
    "mobile": 768,
    "tablet": 1024,
    "desktop": 1280
  },
  "THEME_STORAGE_KEY": "turtle-trading-theme"
}
```
```

### docs/claude/tests/config/coverage.md
```markdown
# Coverage Configuration (100% enforced)

- **Tooling (language/framework)**:
  - **Backend**: Python with pytest-cov and coverage.py
  - **Frontend**: Vitest with v8 coverage provider
  - **E2E**: Playwright with code coverage collection
  - **Integration**: Combined coverage reporting across all layers

- **Commands to run locally**:

## Backend Coverage (Python/FastAPI)
```bash
# Install coverage dependencies
pip install pytest pytest-cov pytest-asyncio coverage

# Run unit tests with coverage
cd backend
pytest --cov=app --cov-report=html --cov-report=term --cov-report=xml --cov-fail-under=100

# Detailed coverage report
coverage report --show-missing --fail-under=100

# Generate HTML coverage report
coverage html
open htmlcov/index.html  # View detailed coverage report

# Coverage for specific modules
pytest tests/test_stock_service.py --cov=app.services.stock_service --cov-report=term-missing
```

## Frontend Coverage (TypeScript/React/Vitest)
```bash
# Install testing dependencies
cd frontend
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom

# Run unit tests with coverage
npm run test:coverage

# Generate detailed coverage report
npm run test:coverage -- --reporter=html
open coverage/index.html

# Watch mode with coverage
npm run test:watch -- --coverage

# Coverage for specific components
npx vitest run --coverage src/components/StockAnalysis.test.tsx
```

## E2E Coverage (Playwright)
```bash
# Install Playwright coverage tools
cd tests
npm install --save-dev @playwright/test playwright-coverage

# Run E2E tests with coverage
npm run test:e2e:coverage

# Generate combined coverage report (frontend + E2E)
npm run coverage:merge

# View E2E coverage report
open playwright-report/coverage/index.html
```

## Combined Coverage Report
```bash
# Generate unified coverage report across all layers
cd /Users/kiranreddyghanta/TurtleTrading
make coverage:all

# Commands defined in Makefile:
# make coverage:backend    # Backend Python coverage
# make coverage:frontend   # Frontend TypeScript coverage
# make coverage:e2e        # E2E Playwright coverage
# make coverage:merge      # Merge all coverage reports
# make coverage:enforce    # Fail if any module < 100%
```

- **CI configuration (threshold gates)**:

## GitHub Actions Workflow (.github/workflows/test-coverage.yml)
```yaml
name: Test Coverage Enforcement

on: [push, pull_request]

jobs:
  backend-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest-cov coverage

      - name: Run backend tests with coverage
        run: |
          cd backend
          pytest --cov=app --cov-report=xml --cov-fail-under=100

      - name: Upload backend coverage
        uses: codecov/codecov-action@v3
        with:
          file: backend/coverage.xml
          flags: backend
          fail_ci_if_error: true

  frontend-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Run frontend tests with coverage
        run: |
          cd frontend
          npm run test:coverage -- --run

      - name: Enforce 100% coverage threshold
        run: |
          cd frontend
          npm run coverage:check  # Custom script that fails if < 100%

      - name: Upload frontend coverage
        uses: codecov/codecov-action@v3
        with:
          file: frontend/coverage/lcov.info
          flags: frontend
          fail_ci_if_error: true

  e2e-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd tests
          npm ci
          npx playwright install

      - name: Start services for E2E tests
        run: |
          docker-compose up -d --build
          # Wait for services to be ready
          ./scripts/wait-for-services.sh

      - name: Run E2E tests with coverage
        run: |
          cd tests
          npm run test:e2e:coverage

      - name: Upload E2E coverage
        uses: codecov/codecov-action@v3
        with:
          file: tests/coverage/lcov.info
          flags: e2e
          fail_ci_if_error: true

  coverage-merge:
    needs: [backend-coverage, frontend-coverage, e2e-coverage]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download all coverage reports
        uses: actions/download-artifact@v3

      - name: Merge coverage reports
        run: |
          ./scripts/merge-coverage.sh

      - name: Enforce combined 100% coverage
        run: |
          ./scripts/enforce-coverage-thresholds.sh
          # Fails CI if any module below 100%

      - name: Generate coverage badge
        run: |
          ./scripts/generate-coverage-badge.sh
```

## Coverage Enforcement Scripts
```bash
# scripts/enforce-coverage-thresholds.sh
#!/bin/bash
set -e

echo "Enforcing 100% coverage thresholds..."

# Backend coverage check
cd backend
coverage report --fail-under=100 || {
    echo "❌ Backend coverage below 100%"
    exit 1
}

# Frontend coverage check
cd ../frontend
npm run coverage:check || {
    echo "❌ Frontend coverage below 100%"
    exit 1
}

# E2E coverage check
cd ../tests
./check-e2e-coverage.sh || {
    echo "❌ E2E coverage below 100%"
    exit 1
}

echo "✅ All modules meet 100% coverage requirement"
```

- **Reporting (HTML/LCOV/JUnit)**:

## Coverage Report Formats
```json
{
  "coverage_formats": {
    "backend": {
      "html": "backend/htmlcov/index.html",
      "xml": "backend/coverage.xml",
      "json": "backend/coverage.json",
      "terminal": "pytest --cov-report=term-missing"
    },
    "frontend": {
      "html": "frontend/coverage/index.html",
      "lcov": "frontend/coverage/lcov.info",
      "json": "frontend/coverage/coverage-final.json",
      "text": "frontend/coverage/coverage.txt"
    },
    "e2e": {
      "html": "tests/coverage/index.html",
      "lcov": "tests/coverage/lcov.info",
      "json": "tests/coverage/coverage.json"
    },
    "combined": {
      "html": "coverage/combined/index.html",
      "json": "coverage/combined/coverage.json",
      "badge": "coverage/badge.svg"
    }
  }
}
```

## Package.json Scripts (Frontend)
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch",
    "coverage:check": "vitest run --coverage --reporter=json && node scripts/check-coverage.js",
    "coverage:html": "vitest run --coverage --reporter=html",
    "coverage:lcov": "vitest run --coverage --reporter=lcov"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "@vitest/ui": "^1.0.0"
  }
}
```

## Pytest Configuration (Backend)
```ini
# pytest.ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    --cov=app
    --cov-report=html
    --cov-report=term-missing
    --cov-report=xml
    --cov-fail-under=100
    --strict-markers
    --disable-warnings
asyncio_mode = auto

[coverage:run]
source = app
omit =
    app/main.py
    */tests/*
    */venv/*
    */__pycache__/*

[coverage:report]
precision = 2
show_missing = true
skip_covered = false
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
```

- **How to debug missed lines/branches**:

## Coverage Debugging Guide
```bash
# 1. Generate detailed HTML report
cd backend
pytest --cov=app --cov-report=html
open htmlcov/index.html

# 2. Identify missed lines
coverage report --show-missing

# 3. Debug specific module
pytest tests/test_stock_service.py --cov=app.services.stock_service --cov-report=term-missing -v

# 4. Branch coverage analysis
coverage report --show-missing --skip-covered

# 5. Interactive coverage debugging
coverage debug sys  # Show coverage configuration
coverage debug data  # Show coverage data file location

# 6. Find untested code paths
coverage html --show-contexts
# Open htmlcov/index.html and look for red (uncovered) lines

# 7. Test specific scenarios for missed branches
pytest tests/ -k "test_error_handling" --cov-branch --cov-report=term-missing
```

## Frontend Coverage Debugging
```bash
# 1. Detailed component coverage
cd frontend
npx vitest run --coverage --reporter=verbose src/components/

# 2. Interactive coverage UI
npx vitest --ui --coverage

# 3. Coverage for specific files
npx vitest run --coverage src/services/stockService.ts

# 4. Debug uncovered branches
npm run test:coverage -- --reporter=html
open coverage/index.html
# Look for yellow (partial) and red (uncovered) lines

# 5. Component interaction testing
npx vitest run --coverage src/components/ src/hooks/
```

## Common Coverage Issues and Solutions
```bash
# Issue: Async code not covered
# Solution: Use proper async test patterns
async def test_async_function():
    result = await async_function()
    assert result is not None

# Issue: Exception handling not covered
# Solution: Test both success and failure paths
def test_error_handling():
    with pytest.raises(CustomException):
        function_that_raises()

# Issue: Complex conditional logic not covered
# Solution: Test all branch combinations
@pytest.mark.parametrize("condition,expected", [
    (True, "success"),
    (False, "failure")
])
def test_conditional_logic(condition, expected):
    result = complex_function(condition)
    assert result == expected

# Issue: React component props not covered
# Solution: Test all prop variations
test('Component with different props', () => {
    render(<Component variant="primary" />)
    render(<Component variant="secondary" />)
    render(<Component disabled={true} />)
})
```
```

### docs/claude/tests/integration/real_time_data_flow.md
```markdown
# Integration: Real-time Market Data Flow

- **Modules involved**: MarketData, DataSources, UserInterface, Infrastructure, Authentication
- **Contracts validated**:
  - MarketData ↔ DataSources: Live price feed integration and failover
  - MarketData ↔ UserInterface: WebSocket real-time updates to frontend
  - MarketData ↔ Infrastructure: Redis caching and WebSocket connection management
  - Authentication ↔ MarketData: User subscription-based data access control

- **Scenarios (happy, failure, timeout, retry, idempotent)**:

## Happy Path: Real-time Price Streaming
**Given**: Authenticated user subscribes to real-time price updates
**When**: Market data flows through WebSocket connection
**Then**: Frontend receives price updates within 100ms of market changes

```python
async def test_real_time_price_streaming_happy_path():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    websocket_client = await connect_websocket(auth_token)

    # Subscribe to real-time updates
    await websocket_client.send_json({
        'action': 'subscribe',
        'symbols': ['AAPL', 'TSLA', 'NVDA'],
        'data_types': ['price', 'volume']
    })

    # Act - Simulate market data update
    market_update = {
        'symbol': 'AAPL',
        'price': 150.25,
        'volume': 1000000,
        'timestamp': datetime.utcnow().isoformat()
    }
    await market_data_service.broadcast_update(market_update)

    # Assert
    start_time = time.time()
    received_update = await websocket_client.receive_json()
    latency_ms = (time.time() - start_time) * 1000

    assert latency_ms < 100  # Sub-100ms latency requirement
    assert received_update['symbol'] == 'AAPL'
    assert received_update['price'] == 150.25
    assert received_update['type'] == 'price_update'

    # Cleanup
    await websocket_client.close()
```

## Failure Path: WebSocket Connection Drop
**Given**: Active WebSocket connection with subscriptions
**When**: Network interruption causes connection drop
**Then**: Automatic reconnection with subscription restoration

```python
async def test_websocket_reconnection_flow():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'basic')
    websocket_client = await connect_websocket(auth_token)

    # Establish subscriptions
    await websocket_client.send_json({
        'action': 'subscribe',
        'symbols': ['SPY', 'QQQ']
    })

    # Confirm subscription
    subscription_ack = await websocket_client.receive_json()
    assert subscription_ack['status'] == 'subscribed'

    # Act - Simulate connection drop
    await websocket_client.force_disconnect()

    # Automatic reconnection should occur
    await asyncio.sleep(2)  # Allow time for reconnection

    # Assert - Reconnection and subscription restoration
    reconnected_client = await get_reconnected_websocket(auth_token)

    # Send test update to verify subscriptions restored
    test_update = {'symbol': 'SPY', 'price': 450.00}
    await market_data_service.broadcast_update(test_update)

    received_update = await reconnected_client.receive_json()
    assert received_update['symbol'] == 'SPY'
    assert received_update['price'] == 450.00

    # Verify subscription persistence
    connection_state = await market_data_service.get_connection_state(auth_token)
    assert 'SPY' in connection_state['subscriptions']
    assert 'QQQ' in connection_state['subscriptions']
```

## Timeout Scenario: Data Source Response Timeout
**Given**: External market data API experiences high latency
**When**: Real-time data request times out (>5 seconds)
**Then**: Fallback to cached data and log timeout event

```python
async def test_data_source_timeout_handling():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    websocket_client = await connect_websocket(auth_token)

    # Simulate slow external API
    mock_external_apis.set_response_delay('alpha_vantage', 7)  # 7 second delay

    # Act - Request real-time data that will timeout
    await websocket_client.send_json({
        'action': 'get_quote',
        'symbol': 'MSFT'
    })

    # Assert
    start_time = time.time()
    response = await websocket_client.receive_json()
    duration = time.time() - start_time

    assert duration < 6  # Should timeout before 6 seconds
    assert response['status'] == 'partial_data'
    assert response['data_source'] == 'cache'
    assert response['warning'] == 'external_api_timeout'
    assert 'last_updated' in response

    # Verify fallback data is still useful
    assert response['symbol'] == 'MSFT'
    assert 'price' in response
    assert response['age_seconds'] < 300  # Cache data less than 5 minutes old
```

## Retry Scenario: Intermittent API Failures
**Given**: External data source has intermittent failures (50% success rate)
**When**: Real-time data service attempts multiple API calls
**Then**: Retry with exponential backoff, succeed within 3 attempts

```python
async def test_api_retry_logic():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'basic')

    # Simulate intermittent failures (fail, fail, succeed pattern)
    mock_external_apis.set_failure_rate('yfinance', 0.67)  # 67% failure rate
    mock_external_apis.set_retry_pattern([False, False, True])  # Succeed on 3rd try

    # Act
    start_time = time.time()
    quote_result = await market_data_service.get_real_time_quote('AMZN')
    duration = time.time() - start_time

    # Assert
    assert quote_result['success'] == True
    assert quote_result['symbol'] == 'AMZN'
    assert quote_result['retry_attempts'] == 3

    # Verify exponential backoff timing (1s + 2s + success = ~3+ seconds)
    assert duration >= 3.0
    assert duration < 8.0  # But not excessive

    # Verify data quality despite retries
    assert quote_result['price'] > 0
    assert quote_result['timestamp'] is not None
    assert quote_result['data_source'] in ['yfinance', 'alpha_vantage']
```

## Idempotency: Duplicate Subscription Requests
**Given**: User sends multiple identical subscription requests
**When**: WebSocket handler processes duplicate subscriptions
**Then**: Maintain single subscription per symbol, no duplicate updates

```python
async def test_subscription_idempotency():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    websocket_client = await connect_websocket(auth_token)

    # Act - Send multiple identical subscription requests
    for i in range(5):
        await websocket_client.send_json({
            'action': 'subscribe',
            'symbols': ['GOOGL'],
            'request_id': f'req_{i}'
        })

    # Receive acknowledgments
    ack_responses = []
    for i in range(5):
        ack = await websocket_client.receive_json()
        ack_responses.append(ack)

    # Assert - All requests acknowledged but single subscription maintained
    for ack in ack_responses:
        assert ack['status'] == 'subscribed'
        assert ack['symbol'] == 'GOOGL'

    # Verify only one subscription exists
    connection_state = await market_data_service.get_connection_state(auth_token)
    googl_subscriptions = [sub for sub in connection_state['subscriptions'] if sub['symbol'] == 'GOOGL']
    assert len(googl_subscriptions) == 1

    # Test that only one update is sent per market change
    await market_data_service.broadcast_update({'symbol': 'GOOGL', 'price': 2750.00})

    # Should receive exactly one update, not five
    update_count = 0
    try:
        while True:
            await asyncio.wait_for(websocket_client.receive_json(), timeout=1.0)
            update_count += 1
    except asyncio.TimeoutError:
        pass  # Expected after receiving all updates

    assert update_count == 1  # Exactly one update received
```

## Performance: High-Frequency Update Handling
**Given**: High-frequency market data (100 updates/second)
**When**: WebSocket service processes rapid price changes
**Then**: Maintain sub-50ms processing time per update

```python
async def test_high_frequency_update_performance():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    websocket_client = await connect_websocket(auth_token)

    await websocket_client.send_json({
        'action': 'subscribe',
        'symbols': ['SPY'],
        'high_frequency': True
    })

    # Act - Generate 100 rapid updates
    update_times = []
    for i in range(100):
        start_time = time.time()

        market_update = {
            'symbol': 'SPY',
            'price': 450.00 + (i * 0.01),  # Incrementing price
            'timestamp': datetime.utcnow().isoformat()
        }

        await market_data_service.broadcast_update(market_update)
        received_update = await websocket_client.receive_json()

        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        update_times.append(processing_time)

    # Assert performance requirements
    avg_processing_time = sum(update_times) / len(update_times)
    max_processing_time = max(update_times)
    p95_processing_time = sorted(update_times)[94]  # 95th percentile

    assert avg_processing_time < 25  # Average under 25ms
    assert p95_processing_time < 50  # 95th percentile under 50ms
    assert max_processing_time < 100  # No update over 100ms

    # Verify data integrity under high frequency
    final_update = received_update
    assert final_update['symbol'] == 'SPY'
    assert final_update['price'] == 450.99  # Last price in sequence
```

- **Data fixtures & golden files**:
  - `fixtures/market_hours_schedule.json`: Trading hours and market status
  - `fixtures/high_frequency_price_data.json`: Sample rapid price movements
  - `golden/websocket_message_format.json`: Standard WebSocket message structure
  - `fixtures/connection_failure_scenarios.json`: Network failure simulation data

- **Observability assertions**:
  - WebSocket connection metrics (active connections, messages/second)
  - Data source health checks and failover events
  - Redis cache hit/miss ratios for real-time data
  - Alert triggers for connection drops or high latency

```python
def assert_real_time_observability(websocket_session):
    # Connection metrics
    assert_metric_recorded("websocket_active_connections", min_value=1)
    assert_metric_recorded("messages_per_second", min_value=0)

    # Performance metrics
    assert_metric_recorded("websocket_message_latency_ms", max_value=100)
    assert_metric_recorded("data_source_response_time_ms", max_value=5000)

    # Health check assertions
    assert_log_entry_exists("websocket_connection_established")
    assert_log_entry_exists("subscription_processed", {"symbols_count": ">0"})

    # Cache performance
    assert_metric_recorded("redis_cache_hit_ratio", min_value=0.8)
```
```

### docs/claude/tests/integration/stock_analysis_flow.md
```markdown
# Integration: Stock Analysis End-to-End Flow

- **Modules involved**: StockAnalysis, DataSources, Authentication, MarketData, UserInterface
- **Contracts validated**:
  - StockAnalysis ↔ DataSources: Stock price data retrieval and caching
  - Authentication ↔ StockAnalysis: User permissions for advanced features
  - MarketData ↔ StockAnalysis: Real-time price updates integration
  - UserInterface ↔ StockAnalysis: Frontend display of analysis results

- **Scenarios (happy, failure, timeout, retry, idempotent)**:

## Happy Path: Complete Stock Analysis Flow
**Given**: Authenticated user requests analysis for AAPL
**When**: Full analysis pipeline executes (data fetch → technical analysis → LSTM prediction → sentiment analysis)
**Then**: Return comprehensive analysis with 95% confidence scores

```python
async def test_complete_stock_analysis_happy_path():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    symbol = 'AAPL'

    # Act - Execute full analysis pipeline
    response = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    # Assert
    assert response.status_code == 200
    analysis = response.json()

    # Validate contract compliance
    assert analysis['symbol'] == symbol
    assert 'technical_score' in analysis
    assert 'lstm_prediction' in analysis
    assert 'sentiment_score' in analysis
    assert analysis['confidence'] >= 0.95

    # Validate cross-module integration
    assert analysis['technical_score']['rsi'] is not None  # StockAnalysis module
    assert analysis['data_sources']['primary'] == 'yfinance'  # DataSources module
    assert analysis['user_tier'] == 'pro'  # Authentication module
    assert analysis['real_time_price'] is not None  # MarketData module
```

## Failure Path: External API Unavailable
**Given**: Primary data source (yfinance) is unavailable
**When**: Stock analysis request attempts data retrieval
**Then**: Automatically fallback to Alpha Vantage and complete analysis

```python
async def test_data_source_failover():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'basic')
    symbol = 'TSLA'

    # Simulate yfinance failure
    mock_external_apis.yfinance.set_unavailable()

    # Act
    response = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    # Assert
    assert response.status_code == 200
    analysis = response.json()

    # Validate fallback behavior
    assert analysis['data_sources']['primary'] == 'alpha_vantage'
    assert analysis['data_sources']['fallback_used'] == True
    assert analysis['symbol'] == symbol
    assert 'technical_score' in analysis  # Analysis still completes
```

## Timeout Scenario: LSTM Model Prediction Timeout
**Given**: LSTM model prediction takes longer than 30 seconds
**When**: Analysis request waits for prediction
**Then**: Return partial analysis without LSTM prediction, log timeout

```python
async def test_lstm_prediction_timeout():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    symbol = 'NVDA'

    # Simulate slow LSTM prediction
    mock_lstm_service.set_prediction_delay(35)  # 35 second delay

    # Act
    start_time = time.time()
    response = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=32  # 32 second timeout
    )
    duration = time.time() - start_time

    # Assert
    assert response.status_code == 200
    assert duration < 32  # Request completed within timeout

    analysis = response.json()
    assert analysis['lstm_prediction']['status'] == 'timeout'
    assert analysis['lstm_prediction']['error'] == 'prediction_timeout_30s'
    assert 'technical_score' in analysis  # Other analysis components completed
    assert 'sentiment_score' in analysis
```

## Retry Scenario: Temporary Network Failure
**Given**: Intermittent network failures during data retrieval
**When**: Stock analysis attempts external API calls
**Then**: Retry 3 times with exponential backoff, succeed on 3rd attempt

```python
async def test_network_retry_logic():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'basic')
    symbol = 'META'

    # Simulate network failures (fail first 2 attempts, succeed on 3rd)
    mock_external_apis.set_failure_pattern([True, True, False])

    # Act
    start_time = time.time()
    response = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    duration = time.time() - start_time

    # Assert
    assert response.status_code == 200
    analysis = response.json()

    # Validate retry behavior
    assert analysis['data_sources']['retry_attempts'] == 3
    assert analysis['data_sources']['final_attempt_success'] == True
    assert duration > 3  # Should take time due to retries (1s + 2s + success)
    assert duration < 10  # But not excessive
```

## Idempotency: Repeated Analysis Requests
**Given**: Multiple identical analysis requests within cache TTL
**When**: Same user requests same symbol analysis repeatedly
**Then**: Return cached results with consistent data

```python
async def test_analysis_idempotency():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    symbol = 'GOOGL'

    # Act - Make multiple identical requests
    responses = []
    for i in range(5):
        response = await client.get(
            f"/api/v1/stocks/{symbol}/analysis",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        responses.append(response.json())

    # Assert
    # All responses should be identical (cached)
    first_response = responses[0]
    for response in responses[1:]:
        assert response['symbol'] == first_response['symbol']
        assert response['technical_score'] == first_response['technical_score']
        assert response['lstm_prediction'] == first_response['lstm_prediction']
        assert response['cache_hit'] == True  # Except first request

    # Validate cache metadata
    assert first_response['cache_hit'] == False  # First request was cache miss
    assert all(resp['cache_hit'] == True for resp in responses[1:])
```

- **Data fixtures & golden files**:
  - `fixtures/aapl_historical_data.json`: 1 year of AAPL OHLCV data
  - `fixtures/market_crash_scenario.json`: 2008-style market crash data
  - `golden/aapl_technical_analysis.json`: Expected technical indicator values
  - `golden/lstm_prediction_output.json`: Reference LSTM prediction format

- **Observability assertions**:
  - Log entries for each module interaction
  - Metrics collection for response times and error rates
  - Tracing headers propagated through all service calls
  - Alert triggers for analysis failures or timeout scenarios

```python
def assert_observability_compliance(analysis_response):
    # Log assertions
    assert_log_entry_exists("stock_analysis_started", {"symbol": "AAPL"})
    assert_log_entry_exists("data_source_selected", {"source": "yfinance"})
    assert_log_entry_exists("technical_analysis_completed", {"indicators_count": 15})

    # Metrics assertions
    assert_metric_recorded("stock_analysis_duration_ms", min_value=0, max_value=30000)
    assert_metric_recorded("data_source_success_rate", min_value=0.95)

    # Tracing assertions
    assert_trace_header_present("X-Request-ID")
    assert_trace_spans_connected(["auth", "data_fetch", "analysis", "response"])
```
```

### docs/claude/tests/specs/authentication/jwt_security_tests.md
```markdown
# Authentication • JWT Security Tests

- **REQ-IDs covered**: REQ-AUTH-01, REQ-AUTH-02, REQ-AUTH-03
- **Given/When/Then scenarios**:

## UT-AUTH-01.1: JWT Token Generation and Validation
**Given**: Valid user credentials and authentication request
**When**: generate_jwt_token() creates access and refresh tokens
**Then**: Tokens are properly signed, have correct expiration, and validate successfully

```python
def test_jwt_token_generation():
    # Arrange
    user_data = {
        'user_id': 'user123',
        'email': 'test@example.com',
        'subscription_tier': 'pro'
    }

    # Act
    tokens = auth_service.generate_jwt_token(user_data)

    # Assert
    assert 'access_token' in tokens
    assert 'refresh_token' in tokens

    # Validate access token
    decoded = jwt.decode(tokens['access_token'], JWT_SECRET, algorithms=['HS256'])
    assert decoded['user_id'] == 'user123'
    assert decoded['exp'] > time.time()  # Not expired
    assert decoded['iat'] <= time.time()  # Issued in past or now

    # Validate refresh token
    refresh_decoded = jwt.decode(tokens['refresh_token'], JWT_SECRET, algorithms=['HS256'])
    assert refresh_decoded['type'] == 'refresh'
    assert refresh_decoded['user_id'] == 'user123'
```

## UT-AUTH-01.2: Token Expiration Handling
**Given**: Expired JWT access token
**When**: validate_jwt_token() processes expired token
**Then**: Return token expired error and suggest refresh

```python
def test_expired_token_handling():
    # Arrange
    expired_token = auth_service.generate_expired_token('user123')  # Test helper

    # Act
    validation_result = auth_service.validate_jwt_token(expired_token)

    # Assert
    assert validation_result['valid'] == False
    assert validation_result['error'] == 'TOKEN_EXPIRED'
    assert validation_result['suggestion'] == 'refresh_token_required'
    assert 'user_id' not in validation_result  # No user data for expired token
```

## UT-AUTH-02.1: Rate Limiting Authentication Attempts
**Given**: Multiple failed login attempts from same IP
**When**: attempt_login() is called repeatedly with wrong credentials
**Then**: Implement rate limiting after 5 failed attempts in 15 minutes

```python
async def test_authentication_rate_limiting():
    # Arrange
    ip_address = '192.168.1.100'
    invalid_credentials = {'email': 'test@example.com', 'password': 'wrong_password'}

    # Act - Make 5 failed attempts
    failed_attempts = []
    for i in range(5):
        result = await auth_service.attempt_login(invalid_credentials, ip_address)
        failed_attempts.append(result)

    # 6th attempt should be rate limited
    rate_limited_result = await auth_service.attempt_login(invalid_credentials, ip_address)

    # Assert
    for attempt in failed_attempts:
        assert attempt['success'] == False
        assert attempt['error'] == 'INVALID_CREDENTIALS'

    assert rate_limited_result['success'] == False
    assert rate_limited_result['error'] == 'RATE_LIMITED'
    assert rate_limited_result['retry_after'] > 0  # Seconds until retry allowed
```

## UT-AUTH-03.1: Password Security and Hashing
**Given**: User registration with plaintext password
**When**: hash_password() processes the password
**Then**: Store bcrypt hashed password, never store plaintext

```python
def test_password_hashing_security():
    # Arrange
    plaintext_password = 'MySecurePassword123!'

    # Act
    hashed = auth_service.hash_password(plaintext_password)

    # Assert
    assert hashed != plaintext_password  # Never store plaintext
    assert hashed.startswith('$2b$')  # bcrypt hash format
    assert len(hashed) == 60  # Standard bcrypt hash length

    # Verify password can be validated
    is_valid = auth_service.verify_password(plaintext_password, hashed)
    assert is_valid == True

    # Verify wrong password fails
    is_invalid = auth_service.verify_password('WrongPassword', hashed)
    assert is_invalid == False
```

## ET-AUTH-01.1: Malformed JWT Token Handling
**Given**: Malformed or tampered JWT token
**When**: validate_jwt_token() processes invalid token
**Then**: Handle gracefully without exposing internal errors

```python
def test_malformed_jwt_handling():
    # Arrange
    malformed_tokens = [
        'invalid.jwt.token',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.tampered.signature',
        '',
        None,
        'Bearer malformed_token_here'
    ]

    for token in malformed_tokens:
        # Act
        result = auth_service.validate_jwt_token(token)

        # Assert
        assert result['valid'] == False
        assert result['error'] in ['INVALID_TOKEN', 'MALFORMED_TOKEN']
        assert 'user_id' not in result
        # Ensure no internal error details leaked
        assert 'traceback' not in result
        assert 'exception' not in result
```

## ET-AUTH-02.1: SQL Injection in Authentication
**Given**: Malicious SQL injection attempt in email field
**When**: attempt_login() processes malicious input
**Then**: Parameterized queries prevent SQL injection attacks

```python
async def test_sql_injection_prevention():
    # Arrange
    malicious_credentials = {
        'email': "admin@example.com'; DROP TABLE users; --",
        'password': 'any_password'
    }

    # Act
    result = await auth_service.attempt_login(malicious_credentials)

    # Assert
    assert result['success'] == False
    assert result['error'] == 'INVALID_CREDENTIALS'

    # Verify database integrity - users table should still exist
    user_count = await db_service.count_users()
    assert user_count >= 0  # Table exists and queryable
```

## PT-AUTH-01.1: Session Security Properties
**Given**: Valid authentication session
**When**: User performs authenticated actions
**Then**: Session maintains security properties throughout lifecycle

```python
async def test_session_security_properties():
    # Arrange
    user_credentials = {'email': 'test@example.com', 'password': 'ValidPassword123!'}

    # Act - Create session
    login_result = await auth_service.attempt_login(user_credentials)
    access_token = login_result['access_token']

    # Property 1: Token should validate consistently
    for _ in range(10):
        validation = auth_service.validate_jwt_token(access_token)
        assert validation['valid'] == True
        assert validation['user_id'] == login_result['user_id']

    # Property 2: Token should expire at predicted time
    token_payload = jwt.decode(access_token, options={"verify_signature": False})
    predicted_expiry = token_payload['exp']

    # Wait until just before expiry
    time_until_expiry = predicted_expiry - time.time()
    if time_until_expiry > 1:
        await asyncio.sleep(max(0, time_until_expiry - 0.5))

    validation_before_expiry = auth_service.validate_jwt_token(access_token)
    assert validation_before_expiry['valid'] == True

    # Wait past expiry
    await asyncio.sleep(1)
    validation_after_expiry = auth_service.validate_jwt_token(access_token)
    assert validation_after_expiry['valid'] == False
```

- **Mocks/stubs/fakes**:
  - MockDatabase for user credential storage testing
  - Stub Redis for rate limiting and session management
  - Fake time provider for token expiration testing

- **Deterministic seeds & time controls**:
  - Fixed JWT secret for reproducible token generation
  - Controlled time advancement for expiration testing
  - Deterministic user IDs and email addresses

- **Expected coverage deltas**:
  - Lines: +98 lines (JWT handling, password hashing, rate limiting, validation)
  - Branches: +18 branches (token validation paths, error handling, security checks)
  - Functions: +7 functions (generate_token, validate_token, hash_password, rate_limit_check)
```

### docs/claude/tests/specs/market-data/real_time_streaming_tests.md
```markdown
# MarketData • Real-time Streaming Tests

- **REQ-IDs covered**: REQ-MARKET-01, REQ-MARKET-02
- **Given/When/Then scenarios**:

## UT-MARKET-01.1: WebSocket Connection Management
**Given**: WebSocket server configured for market data streaming
**When**: establish_websocket_connection() is called
**Then**: Successfully connect and maintain heartbeat with <100ms latency

```python
async def test_websocket_connection_establishment():
    # Arrange
    websocket_config = {
        'url': 'ws://localhost:8080/market-stream',
        'heartbeat_interval': 30,
        'reconnect_attempts': 3
    }

    # Act
    connection = await websocket_manager.establish_connection(websocket_config)

    # Assert
    assert connection.is_connected == True
    assert connection.latency_ms < 100
    assert connection.heartbeat_active == True

    # Cleanup
    await connection.close()
```

## UT-MARKET-01.2: Real-time Price Update Processing
**Given**: Active WebSocket connection with price subscriptions
**When**: receive_price_update() processes incoming market data
**Then**: Update in-memory cache and notify subscribers within 50ms

```python
async def test_real_time_price_updates():
    # Arrange
    mock_price_update = {
        'symbol': 'AAPL',
        'price': 150.25,
        'volume': 1000000,
        'timestamp': '2024-01-15T15:30:00Z'
    }

    # Act
    start_time = time.time()
    await market_stream.receive_price_update(mock_price_update)
    processing_time = (time.time() - start_time) * 1000

    # Assert
    assert processing_time < 50  # Under 50ms processing
    cached_price = await cache_manager.get_price('AAPL')
    assert cached_price == 150.25
    assert len(market_stream.subscribers) > 0
```

## UT-MARKET-02.1: Market Sentiment Aggregation
**Given**: Multiple sentiment data sources (news, social media)
**When**: aggregate_market_sentiment() combines sentiment scores
**Then**: Return weighted sentiment score between -100 and +100

```python
def test_market_sentiment_aggregation():
    # Arrange
    sentiment_sources = {
        'news_sentiment': {'score': 75, 'weight': 0.6, 'confidence': 0.85},
        'social_sentiment': {'score': -20, 'weight': 0.3, 'confidence': 0.70},
        'analyst_sentiment': {'score': 50, 'weight': 0.1, 'confidence': 0.95}
    }

    # Act
    aggregated = sentiment_service.aggregate_market_sentiment(sentiment_sources)

    # Assert
    assert -100 <= aggregated['score'] <= 100
    assert aggregated['confidence'] > 0.5
    assert 'weighted_score' in aggregated
    expected_score = (75*0.6 + (-20)*0.3 + 50*0.1)
    assert abs(aggregated['weighted_score'] - expected_score) < 0.1
```

## ET-MARKET-01.1: WebSocket Disconnection Recovery
**Given**: Active WebSocket connection experiences network interruption
**When**: handle_disconnection() attempts reconnection
**Then**: Automatically reconnect with exponential backoff, max 3 attempts

```python
async def test_websocket_reconnection():
    # Arrange
    connection = MockWebSocketConnection(auto_disconnect_after=5)
    reconnection_attempts = []

    # Act
    with pytest.raises(ConnectionError):
        await websocket_manager.handle_disconnection(connection)

    # Assert
    assert len(websocket_manager.reconnection_log) <= 3
    assert websocket_manager.reconnection_log[0]['delay'] == 1  # First attempt: 1s
    assert websocket_manager.reconnection_log[1]['delay'] == 2  # Second attempt: 2s
    assert websocket_manager.reconnection_log[2]['delay'] == 4  # Third attempt: 4s
```

## PT-MARKET-01.1: Message Ordering Property
**Given**: Rapid sequence of price updates for same symbol
**When**: process_message_queue() handles concurrent updates
**Then**: Final price reflects the most recent timestamp, no race conditions

```python
async def test_message_ordering_property():
    # Arrange
    price_updates = [
        {'symbol': 'TSLA', 'price': 200.00, 'timestamp': '2024-01-15T15:30:00Z'},
        {'symbol': 'TSLA', 'price': 201.50, 'timestamp': '2024-01-15T15:30:02Z'},
        {'symbol': 'TSLA', 'price': 199.75, 'timestamp': '2024-01-15T15:30:01Z'},  # Out of order
    ]

    # Act
    for update in price_updates:
        await market_stream.process_price_update(update)

    # Assert
    final_price = await cache_manager.get_price('TSLA')
    assert final_price == 201.50  # Most recent timestamp wins

    price_history = await cache_manager.get_price_history('TSLA')
    timestamps = [entry['timestamp'] for entry in price_history]
    assert timestamps == sorted(timestamps)  # Chronological order maintained
```

- **Mocks/stubs/fakes**:
  - MockWebSocketConnection for controllable connection scenarios
  - Stub external market data providers (Alpha Vantage, yfinance)
  - Fake network conditions for disconnection/latency testing

- **Deterministic seeds & time controls**:
  - Fixed timestamps for consistent message ordering tests
  - Controlled network delay simulation: 10ms, 50ms, 100ms scenarios
  - Deterministic market data generation with predictable patterns

- **Expected coverage deltas**:
  - Lines: +127 lines (WebSocket management, sentiment aggregation, message processing)
  - Branches: +22 branches (reconnection logic, sentiment weighting, error handling)
  - Functions: +9 functions (connection handlers, sentiment calculators, stream processors)
```

### docs/claude/tests/specs/stock-analysis/lstm_prediction_tests.md
```markdown
# StockAnalysis • LSTM Prediction Tests

- **REQ-IDs covered**: REQ-STOCK-02, REQ-STOCK-04
- **Given/When/Then scenarios**:

## UT-STOCK-02.1: LSTM Model Training and Prediction
**Given**: 90 days of preprocessed stock data with technical indicators
**When**: train_lstm_model() is called with proper parameters
**Then**: Model achieves >70% directional accuracy on validation set

```python
def test_lstm_training_accuracy():
    # Arrange
    training_data = MockDataFactory.create_lstm_training_data("AAPL", days=365)
    model_config = {
        'lookback_window': 90,
        'prediction_horizon': 5,
        'epochs': 75,
        'batch_size': 32
    }

    # Act
    model, metrics = lstm_service.train_lstm_model(training_data, model_config)

    # Assert
    assert metrics['directional_accuracy'] > 0.70
    assert metrics['mae'] < 0.05  # Mean Absolute Error threshold
    assert model.get_config()['layers'][0]['units'] == 128  # Architecture validation
```

## UT-STOCK-02.2: Prediction Confidence Intervals
**Given**: Trained LSTM model and recent stock data
**When**: generate_prediction_with_confidence() is called
**Then**: Return prediction with realistic confidence intervals (80%, 95%)

```python
def test_prediction_confidence_intervals():
    # Arrange
    model = MockModelFactory.create_trained_lstm_model("AAPL")
    recent_data = MockDataFactory.create_stock_data("AAPL", days=90)

    # Act
    prediction = lstm_service.generate_prediction_with_confidence(model, recent_data)

    # Assert
    assert 'price_prediction' in prediction
    assert 'confidence_80' in prediction
    assert 'confidence_95' in prediction
    assert prediction['confidence_95']['lower'] < prediction['confidence_80']['lower']
    assert prediction['confidence_80']['upper'] < prediction['confidence_95']['upper']
```

## ET-STOCK-02.1: Model Overfitting Detection
**Given**: LSTM model trained on limited data
**When**: validate_model_performance() checks training vs validation metrics
**Then**: Detect overfitting when validation loss > training loss * 1.5

```python
def test_overfitting_detection():
    # Arrange
    overfitted_model = MockModelFactory.create_overfitted_model("TSLA")
    validation_data = MockDataFactory.create_stock_data("TSLA", days=30)

    # Act
    validation_result = lstm_service.validate_model_performance(overfitted_model, validation_data)

    # Assert
    assert validation_result['is_overfitted'] == True
    assert validation_result['training_loss'] < validation_result['validation_loss']
    assert validation_result['recommendation'] == 'retrain_with_regularization'
```

## PT-STOCK-02.1: Prediction Stability Property
**Given**: Same input data fed to model multiple times
**When**: generate_prediction() is called repeatedly
**Then**: Predictions remain consistent within 2% variance

```python
def test_prediction_stability():
    # Arrange
    model = MockModelFactory.create_deterministic_model("NVDA")
    input_data = MockDataFactory.create_stock_data("NVDA", days=90)
    predictions = []

    # Act
    for _ in range(10):
        prediction = lstm_service.generate_prediction(model, input_data)
        predictions.append(prediction['price_prediction'])

    # Assert
    mean_prediction = np.mean(predictions)
    for pred in predictions:
        variance_pct = abs(pred - mean_prediction) / mean_prediction
        assert variance_pct < 0.02  # Within 2% variance
```

- **Mocks/stubs/fakes**:
  - MockModelFactory for pre-trained LSTM models with known characteristics
  - Stub TensorFlow/Keras for deterministic model behavior
  - Fake GPU availability for CPU-only testing environments

- **Deterministic seeds & time controls**:
  - TensorFlow random seed: 123 for reproducible model training
  - NumPy random seed: 456 for consistent data preprocessing
  - Fixed validation split: 80/20 train/validation consistently

- **Expected coverage deltas**:
  - Lines: +89 lines (LSTM training, prediction, validation methods)
  - Branches: +16 branches (overfitting checks, confidence calculations)
  - Functions: +5 functions (train_model, predict, validate_performance)
```

### docs/claude/tests/specs/stock-analysis/technical_analysis_tests.md
```markdown
# StockAnalysis • Technical Analysis Tests

- **REQ-IDs covered**: REQ-STOCK-01, REQ-STOCK-02, REQ-STOCK-03
- **Given/When/Then scenarios**:

## UT-STOCK-01.1: Technical Indicator Calculation Accuracy
**Given**: Historical OHLCV data for AAPL (90 days)
**When**: calculate_technical_indicators() is called
**Then**: Return accurate RSI, MACD, Bollinger Bands within 0.01% tolerance

```python
def test_technical_indicators_accuracy():
    # Arrange
    mock_data = MockDataFactory.create_stock_data("AAPL", days=90)
    expected_rsi = 45.67  # Pre-calculated reference value

    # Act
    indicators = technical_service.calculate_technical_indicators(mock_data)

    # Assert
    assert abs(indicators['rsi'][-1] - expected_rsi) < 0.01
    assert indicators['macd']['signal'][-1] is not None
    assert len(indicators['bollinger']['upper']) == len(mock_data)
```

## UT-STOCK-01.2: Multi-timeframe Analysis Consistency
**Given**: Stock data across different timeframes (1d, 1w, 1m)
**When**: analyze_multi_timeframe() is called
**Then**: Signals maintain logical consistency across timeframes

```python
def test_multi_timeframe_consistency():
    # Arrange
    daily_data = MockDataFactory.create_stock_data("AAPL", timeframe="1d")
    weekly_data = MockDataFactory.aggregate_to_weekly(daily_data)

    # Act
    daily_signals = technical_service.analyze_multi_timeframe(daily_data, "1d")
    weekly_signals = technical_service.analyze_multi_timeframe(weekly_data, "1w")

    # Assert
    assert daily_signals['trend'] in ['bullish', 'bearish', 'neutral']
    assert weekly_signals['strength'] >= daily_signals['strength'] - 0.1
```

## ET-STOCK-01.1: Extreme Market Conditions Handling
**Given**: Market crash scenario with -20% daily drop
**When**: calculate_technical_indicators() processes extreme data
**Then**: Handle gracefully without mathematical errors or infinite values

```python
def test_market_crash_handling():
    # Arrange
    crash_data = MockDataFactory.create_market_crash_scenario("SPY")

    # Act & Assert
    indicators = technical_service.calculate_technical_indicators(crash_data)

    assert not any(math.isinf(val) for val in indicators['rsi'])
    assert not any(math.isnan(val) for val in indicators['macd']['histogram'])
    assert indicators['volatility'] > 0.5  # High volatility expected
```

- **Mocks/stubs/fakes**:
  - MockDataFactory for deterministic OHLCV data generation
  - Stub external price data APIs (yfinance, Alpha Vantage)
  - Fake time provider for consistent timestamp testing

- **Deterministic seeds & time controls**:
  - Random seed: 42 for reproducible price movements
  - Fixed timestamp: 2024-01-15T10:00:00Z for all test scenarios
  - Controlled market hours: 9:30 AM - 4:00 PM EST

- **Expected coverage deltas**:
  - Lines: +156 lines (calculate_technical_indicators, multi_timeframe_analysis)
  - Branches: +24 branches (error handling, timeframe logic)
  - Functions: +8 functions (all technical analysis methods)
```

<<<DOCS_INPUT_END>>>

OBJECTIVE
- Implement code, tests, CI, DB schema/migrations/seeds, and UI skeleton strictly per the above docs. Every public function/endpoint/state transition must have positive/negative/edge tests. Contracts must have integration tests. E2E must cover golden/failure/retry/timeout/idempotency/a11y. Achieve 100% coverage gates locally and in CI.

OUTPUT FORMAT (STRICT)
1) File plan: bullet list of every file you create/update with one-line purpose.
2) Full file contents for each path in fenced code blocks. No placeholders, no “…”; everything must be runnable.
3) Final checklist with pass/fail for:
   - All specs implemented
   - 100% unit/branch/integration coverage
   - E2E scenarios implemented (with traces/videos)
   - DB migrations + seeds wired in CI
   - Makefile scripts preserved and working

IMPLEMENTATION TARGETS (exact paths)
- backend/app/** (FastAPI routers, services, models, deps, auth, caching, rate-limit, AV fallback adapter)
- backend/app/alembic/** (migrations) and/or database/migrations/0001_initial.sql
- backend/tests/unit/** and backend/tests/integration/**
- frontend/src/** (components, pages, services, hooks, contexts, types)
- frontend/tests/unit/** and frontend/tests/integration/**
- tests/e2e/** (Playwright specs, fixtures)
- database/schema.sql, database/seed/dev.sql
- docs/claude/tests/config/coverage.md (implemented as tooling/config files below)
- .github/workflows/ci.yml (coverage gates 100%; services: postgres, redis)
- jest.config.(ts|js), tsconfig.json, playwright.config.(ts|js)
- pyproject.toml or requirements.txt + pytest.ini + coverage config (branch=true, fail-under=100)
- .env.example (safe defaults; no secrets)
- README.md (how to run app/tests/coverage; links to docs)

TEST & COVERAGE REQUIREMENTS (NON-NEGOTIABLE)
- PyTest command must pass with 100%: 
  pytest -q --cov=backend/app --cov-branch --cov-report=term-missing --cov-report=xml --cov-fail-under=100
- Jest command must pass with 100% thresholds (branches/statements/functions/lines) and produce lcov + html.
- Playwright runs against local app, with retries, traces, video-on-failure, and accessibility scan. Include scripts to start/stop app for CI.
- Contract tests: UI↔API, API↔DB/Redis, yfinance↔AlphaVantage adapter seam.
- Deterministic seeds, fake timers/clocks, controlled randomness. No flaky tests.

CI/CD (GITHUB ACTIONS)
- Matrix: Python 3.11+, Node 18+ (Linux). Cache deps.
- Services: postgres:14, redis:7 with health checks.
- Steps: checkout → setup/caches → install → lint/typecheck → backend unit (100%) → backend integration (100%) → frontend unit/integration (100%) → spin app → Playwright e2e → upload coverage artifacts (HTML/LCOV/JUnit). Fail build on <100%.

UI: PERPLEXITY FINANCE PLUS
- Implement a robust skeleton that fulfills docs/ui/PerplexityFinancePlus.md: global search+compare, narratives with rationale transparency, audit trails, hypothesis testing, keyboard-first, a11y (WCAG AA), perf budgets. Provide components, routes, loading/error/empty states, i18n hooks.

CONSTRAINTS
- Match repo structure and Makefile commands; don’t break existing workflows.
- Use environment variables via .env.example; never commit secrets.
- Keep error handling, logging, and rate limiting consistent with docs.
- Use relative links in docs; no duplication.

DELIVERABLES
- Complete file plan and full file contents for ALL changes above.
- All tests and coverage configs included and passing under the documented commands.
- CI workflow that enforces the gates and uploads artifacts.
