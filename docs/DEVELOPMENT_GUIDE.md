# Development Guide

## Development Guidelines

### Backend Development Standards
- **FastAPI Patterns**: Use dependency injection for services and database connections
- **Async Programming**: Leverage async/await for all I/O operations
- **Error Handling**: Comprehensive exception handling with proper HTTP status codes
- **Logging**: Structured logging with loguru for debugging and monitoring
- **Type Safety**: Full type hints with Pydantic models for data validation
- **Testing**: Unit tests with pytest and async test support

### Frontend Development Standards
- **TypeScript**: Strict type checking enabled for all components
- **Component Architecture**: Functional components with hooks and context patterns
- **State Management**: React Query for server state, React Context for client state
- **Styling**: TailwindCSS utility classes with custom component patterns
- **Performance**: Code splitting, lazy loading, and React.memo optimization
- **Testing**: Jest and React Testing Library for component testing

### Code Quality & Formatting
- **Backend**: Black formatting, isort imports, flake8 linting, mypy type checking
- **Frontend**: ESLint configuration, Prettier formatting, TypeScript strict mode
- **Git Hooks**: Pre-commit hooks for code quality enforcement
- **Documentation**: Comprehensive docstrings and API documentation

### Database Development
- **Migrations**: Alembic for database schema versioning
- **Connections**: Connection pooling with async SQLAlchemy
- **Caching**: Redis for session storage and API response caching
- **Indexing**: Proper database indexing for performance optimization

## API Design Principles
- **RESTful Endpoints**: Clear resource-based URL structure
- **Consistent Responses**: Standardized response formats with proper HTTP status codes
- **Pagination**: Cursor-based pagination for large datasets
- **Rate Limiting**: User-based rate limiting with Redis backend
- **Authentication**: JWT tokens with refresh token support
- **Documentation**: Auto-generated OpenAPI documentation

## Real-time Architecture
- **WebSocket Management**: Connection pooling and subscription management
- **Message Broadcasting**: Efficient message routing to subscribed clients
- **Reconnection Logic**: Automatic reconnection with exponential backoff
- **Data Streaming**: Real-time price updates and sentiment changes
- **Load Balancing**: Horizontal scaling support for WebSocket servers

## Security Best Practices
- **Environment Variables**: All sensitive configuration in environment variables
- **JWT Security**: Strong secret keys with appropriate expiration times
- **Input Validation**: Comprehensive data validation with Pydantic
- **SQL Injection**: Parameterized queries with SQLAlchemy ORM
- **CORS Configuration**: Restrictive CORS policies for production
- **Rate Limiting**: API rate limiting to prevent abuse

## Performance Optimization
- **Database Queries**: Efficient queries with proper indexing and joins
- **Caching Strategy**: Multi-layer caching (Redis, browser, CDN)
- **API Response Times**: Target <500ms for all API endpoints
- **Bundle Optimization**: Frontend code splitting and tree shaking
- **Image Optimization**: Lazy loading and responsive images
- **WebSocket Efficiency**: Connection pooling and message batching

## Testing Strategy
- **Unit Testing**: 90%+ code coverage for both backend and frontend
- **Integration Testing**: API endpoint testing with test database
- **E2E Testing**: Playwright tests for complete user workflows
- **Performance Testing**: Load testing for API endpoints and WebSocket connections
- **Security Testing**: Automated security scanning and vulnerability assessment

## Deployment & DevOps
- **Containerization**: Docker containers for all services
- **Orchestration**: Docker Compose for development, Kubernetes for production
- **CI/CD Pipeline**: Automated testing, building, and deployment
- **Monitoring**: Application performance monitoring and logging aggregation
- **Backup Strategy**: Automated database backups and disaster recovery

## Development Workflow
1. **Local Development**: `make dev` - Start complete development environment
2. **Testing**: `make test` - Run all test suites
3. **Code Quality**: `make lint` - Run code formatting and linting
4. **Database Management**: `make db-migrate` - Apply database migrations
5. **Production Build**: `make build` - Build production Docker images

## Performance & Scalability Requirements

### Response Time Targets
- API responses: <200ms for 95th percentile
- WebSocket message delivery: <100ms
- Page load times: <2 seconds on 3G
- Database queries: <50ms for 90th percentile

### Scale Targets
- Support 10,000 concurrent users
- Handle 100,000 API requests per minute
- Process 1M WebSocket messages per minute
- 99.9% uptime availability

## Development & Testing Configuration

### Environment Setup
```bash
# Backend Development
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend Development
cd frontend
npm install && npm start  # Port 3000

# Test Frontend (for E2E)
cd test-frontend
npm install && PORT=3003 npm start

# E2E Testing
cd tests
npm install && npm test  # Playwright tests
```

### Docker Commands
```bash
docker-compose up --build     # Full stack
docker-compose up backend     # Backend only
docker-compose up frontend    # Frontend only
```

### Testing Commands
```bash
# Backend Unit Tests
cd backend && pytest

# Frontend Component Tests
cd frontend && npm test

# E2E Tests with Playwright
cd tests && npm test
npm run test:headed          # With browser UI
npm run test:debug           # Debug mode
```

## Security & Compliance

### Authentication & Authorization
- JWT tokens with 15-minute expiry + refresh tokens
- Rate limiting: 1000 requests/hour per user
- Multi-factor authentication support (planned)
- API key management for external integrations

### Data Protection
- AES-256 encryption for sensitive data at rest
- TLS 1.3 for all data in transit
- PII anonymization in logs
- GDPR/CCPA compliance framework

## Quick Start Commands
```bash
# Complete Development Setup
make setup    # Complete setup for new developers
make dev      # Start development environment
make test     # Run all tests (unit + integration + E2E)
make lint     # Code formatting and quality checks
make build    # Build production Docker images
make clean    # Clean up containers and volumes

# Development Shortcuts
make backend-dev    # Start only backend services
make frontend-dev   # Start only frontend services
make test-e2e      # Run Playwright E2E tests only
make db-reset      # Reset database with test data
```

## Reference Links
- **PRD Document**: `./PRD.md` - Comprehensive product requirements
- **API Documentation**: `http://localhost:8000/docs` - Interactive API docs
- **E2E Test Reports**: `http://localhost:9323` - Playwright test results
- **Architecture Diagrams**: `./docs/architecture/` - System design docs