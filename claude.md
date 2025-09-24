# CLAUDE.md - TurtleTrading AI-Powered Trading Platform

Always read PLANNING.md at the start of every new conversation, check TASKS.md before starting your work, mark completed tasks to TASKS.md immediately, and add newly discovered tasks to TASKS.md when found.

## 📚 Documentation Structure

This documentation has been split into logical sections for better workspace management:

### 📋 Core Documentation
- **[PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md)** - Project overview, business context, architecture, and features
- **[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** - Development guidelines, standards, workflow, and best practices
- **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - Complete API documentation, endpoints, and integration guides
- **[SESSION_SUMMARIES.md](./docs/SESSION_SUMMARIES.md)** - Detailed development session summaries and progress tracking

### 🔗 Quick Navigation

#### Project Essentials
- **Project Overview**: [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md#project-overview)
- **Architecture**: [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md#architecture-overview)
- **Technology Stack**: [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md#technology-stack)
- **Project Structure**: [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md#project-structure)

#### Development
- **Development Guidelines**: [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md#development-guidelines)
- **Quick Start Commands**: [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md#quick-start-commands)
- **Testing Strategy**: [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md#testing-strategy)
- **Security & Compliance**: [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md#security--compliance)

#### API & Integration
- **API Endpoints**: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md#api-endpoint-reference)
- **Authentication**: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md#authentication-apiv1auth)
- **Data Sources**: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md#data-sources--external-apis)
- **Error Handling**: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md#error-handling--monitoring)

#### Session History
- **Development Progress**: [docs/SESSION_SUMMARIES.md](./docs/SESSION_SUMMARIES.md#development-session-summaries)
- **Technical Accomplishments**: [docs/SESSION_SUMMARIES.md](./docs/SESSION_SUMMARIES.md#technical-accomplishments)

## 🚀 Current Platform Status

### ✅ Completed Major Components
- **Backend Foundation**: FastAPI server with JWT authentication, comprehensive API endpoints
- **Frontend Foundation**: Modern React TypeScript app with Vite, Tailwind CSS, React Router
- **State Management**: Hybrid architecture with Zustand (client) + React Query (server)
- **Authentication System**: Complete JWT implementation with login/registration forms
- **Error Handling**: Multi-layer error boundary system with graceful degradation
- **Testing Infrastructure**: Playwright MCP E2E testing with cross-browser support
- **Stock Data Service**: Production-ready service with yfinance + Alpha Vantage fallback
- **Professional UI**: Modern trading dashboard with clean, consistent design

### 🚧 Current Focus
- **UI Enhancement**: Continuing dashboard modernization and user experience improvements
- **Data Integration**: Enhancing real-time market data streaming and caching
- **Technical Analysis**: Expanding indicator library and LSTM model integration

### 📈 Recent UI Transformation
**Latest Achievement**: Successfully transformed the basic interface into a modern, professional trading dashboard with:
- Clean, card-based design system
- Professional market index displays
- Color-coded financial data visualization
- Responsive design patterns
- Modern typography and spacing

## 🎯 Development Workflow

### Essential Commands
```bash
# Complete Development Setup
make dev                    # Start full development environment
make test                   # Run all tests (unit + integration + E2E)
make lint                   # Code formatting and quality checks

# Development Servers
cd backend && uvicorn app.main:app --reload    # Backend (port 8000)
cd frontend && npm run dev                     # Frontend (port 3000)

# Testing
cd tests && npm test                           # E2E Playwright tests
```

### Key Development URLs
- **Backend API**: http://localhost:8000
- **Interactive API Docs**: http://localhost:8000/docs
- **Frontend Application**: http://localhost:3000
- **E2E Test Reports**: http://localhost:9323

## 📋 Task Management

**Important**: Always check TASKS.md before starting work and update it immediately when completing tasks.

- **TASKS.md** - Current development tasks and milestones
- **PLANNING.md** - Strategic planning and roadmap information

## 🏗️ Architecture Highlights

### Technology Stack
- **Backend**: FastAPI + PostgreSQL + Redis + WebSocket
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Zustand + React Query
- **Testing**: Playwright MCP for E2E, pytest for backend, Vitest for frontend
- **Infrastructure**: Docker + Docker Compose for development

### Key Features
- **Real-time Market Data**: Live price streaming with WebSocket connections
- **AI-Powered Analysis**: LSTM neural network predictions with confidence intervals
- **Advanced Technical Indicators**: 15+ indicators with weighted scoring system
- **Sentiment Analysis**: Multi-source news and social media sentiment tracking
- **Professional Trading UI**: Modern dashboard optimized for financial data

### Data Sources
- **Primary**: Yahoo Finance (yfinance) for real-time market data
- **Fallback**: Alpha Vantage for enhanced reliability and redundancy
- **Sentiment**: NewsAPI, Twitter API v2, Reddit API for sentiment analysis
- **Economic**: FRED API for Federal Reserve economic indicators

## 🔐 Security & Standards

### Authentication
- JWT tokens with refresh token flow
- Strong password policies with bcrypt hashing
- Rate limiting and brute force protection
- Secure session management

### Code Quality
- **Backend**: Black, isort, flake8, mypy for Python
- **Frontend**: ESLint, Prettier, TypeScript strict mode
- **Testing**: 90%+ code coverage target
- **Documentation**: Comprehensive docstrings and API docs

## 📊 Performance Targets

### Response Times
- API responses: <200ms for 95th percentile
- WebSocket message delivery: <100ms
- Page load times: <2 seconds on 3G
- Database queries: <50ms for 90th percentile

### Scale Requirements
- Support 10,000 concurrent users
- Handle 100,000 API requests per minute
- Process 1M WebSocket messages per minute
- 99.9% uptime availability

---

## 📝 Documentation Maintenance

This modular documentation structure enables:
- **Better Organization**: Each section focuses on specific aspects
- **Easier Navigation**: Quick access to relevant information
- **Improved Maintainability**: Updates isolated to specific domains
- **Enhanced Collaboration**: Team members can focus on their areas of expertise

For detailed information on any aspect of the TurtleTrading platform, refer to the appropriate documentation file linked above.

---

**Last Updated**: September 2025
**Status**: ✅ Active Development - Professional Trading Platform with Modern UI