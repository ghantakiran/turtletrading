# 🐢 TurtleTrading - Advanced Stock Market Analysis Platform

<div align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-blue.svg" alt="Python Version">
  <img src="https://img.shields.io/badge/React-18+-blue.svg" alt="React Version">
  <img src="https://img.shields.io/badge/FastAPI-0.104+-green.svg" alt="FastAPI Version">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue.svg" alt="TypeScript Version">
  <img src="https://img.shields.io/badge/Docker-Ready-brightgreen.svg" alt="Docker Ready">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</div>

<p align="center">
  <strong>A comprehensive web-based stock market analysis platform featuring LSTM predictions, real-time sentiment analysis, and advanced technical indicators.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-api-documentation">API</a> •
  <a href="#-development">Development</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## 🚀 Features

### 📊 **Advanced Analytics**
- **LSTM Price Predictions** - Deep learning models for 1-30 day price forecasting
- **Technical Analysis** - 15+ technical indicators with weighted scoring
- **Sentiment Analysis** - Real-time news and social media sentiment tracking
- **Market Overview** - Comprehensive market indices and trends analysis

### 🔄 **Real-Time Data**
- **WebSocket Streaming** - Live price updates and market data
- **Real-Time Sentiment** - Instant sentiment changes and news alerts
- **Market Breadth** - Live advancing/declining stocks ratio
- **Volume Analysis** - Real-time trading volume insights

### 📈 **Interactive Dashboards**
- **Stock Analysis Dashboard** - Deep dive into individual stocks
- **Market Sentiment Center** - Aggregated market sentiment visualization  
- **Portfolio Tracker** - Personal watchlist and portfolio management
- **Trend Analysis** - Historical and predictive trend visualization

### 🎯 **Smart Features**
- **Intelligent Alerts** - Price, sentiment, and technical indicator alerts
- **Risk/Reward Analysis** - Automated risk assessment with stop-loss recommendations
- **Seasonality Analysis** - Historical performance patterns analysis
- **Correlation Matrix** - Asset correlation analysis for portfolio optimization

### 🔐 **Enterprise Ready**
- **User Authentication** - Secure JWT-based authentication system
- **Role-Based Access** - Admin, premium, and free user tiers
- **API Rate Limiting** - Configurable rate limits per user tier
- **Comprehensive Logging** - Full audit trail and performance monitoring

---

## ⚡ Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### 🐳 Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TurtleTrading
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

3. **Start the complete stack**
   ```bash
   make setup  # Complete setup for new developers
   make dev    # Start development environment
   ```

4. **Access the application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **API Documentation**: http://localhost:8000/api/docs
   - **WebSocket Test**: http://localhost:8000/ws/test

### 🛠️ Local Development Setup

1. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```

3. **Database Setup**
   ```bash
   docker-compose up -d postgres redis
   # Run migrations when implemented
   ```

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[React TypeScript App]
        B[TailwindCSS Styling]
        C[React Query State Management]
    end
    
    subgraph "API Gateway"
        D[FastAPI Backend]
        E[WebSocket Server]
        F[Authentication Middleware]
    end
    
    subgraph "Services Layer"
        G[Stock Service]
        H[Market Service]
        I[Sentiment Service]
        J[LSTM Service]
        K[Auth Service]
    end
    
    subgraph "Data Layer"
        L[PostgreSQL Database]
        M[Redis Cache]
        N[External APIs]
    end
    
    A --> D
    A --> E
    D --> G
    D --> H
    D --> I
    D --> J
    D --> K
    G --> L
    G --> M
    G --> N
    H --> L
    H --> M
    I --> N
```

### Technology Stack

**Backend**
- **FastAPI** - High-performance Python web framework
- **SQLAlchemy** - Database ORM with async support  
- **PostgreSQL** - Primary database for persistent data
- **Redis** - Caching and session storage
- **TensorFlow** - LSTM model training and inference
- **WebSocket** - Real-time data streaming

**Frontend**
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type safety and enhanced developer experience
- **TailwindCSS** - Utility-first CSS framework
- **React Query** - Server state management and caching
- **React Router** - Client-side routing
- **Socket.io** - WebSocket client integration

**Infrastructure**
- **Docker** - Containerization for all services
- **Nginx** - Reverse proxy and static file serving
- **Playwright** - End-to-end testing framework

---

## 📚 API Documentation

### Authentication Endpoints

```typescript
POST /api/v1/auth/register
POST /api/v1/auth/token
GET  /api/v1/auth/me
PUT  /api/v1/auth/me
```

### Stock Analysis Endpoints

```typescript
GET  /api/v1/stocks/                    // Available stocks
GET  /api/v1/stocks/{symbol}/price      // Current price
GET  /api/v1/stocks/{symbol}/technical  // Technical indicators
GET  /api/v1/stocks/{symbol}/lstm       // LSTM predictions
GET  /api/v1/stocks/{symbol}/analysis   // Comprehensive analysis
POST /api/v1/stocks/batch-analysis     // Multiple stock analysis
```

### Market Data Endpoints

```typescript
GET /api/v1/market/overview       // Market overview
GET /api/v1/market/indices        // Major indices
GET /api/v1/market/movers         // Top gainers/losers
GET /api/v1/market/trends         // Market trends
GET /api/v1/market/sectors        // Sector performance
```

### Sentiment Analysis Endpoints

```typescript
GET /api/v1/sentiment/market              // Overall market sentiment
GET /api/v1/sentiment/{symbol}            // Stock sentiment
GET /api/v1/sentiment/{symbol}/news       // News articles with sentiment
GET /api/v1/sentiment/{symbol}/social     // Social media sentiment
```

### WebSocket Events

```typescript
// Connection
ws://localhost:8000/ws/{client_id}

// Subscribe to symbols
{ "type": "subscribe", "symbols": ["AAPL", "MSFT"] }

// Market updates
{ "type": "market_update", "symbol": "AAPL", "data": {...} }

// Sentiment updates  
{ "type": "sentiment_update", "symbol": "AAPL", "sentiment": {...} }
```

---

## 🔧 Development

### Available Make Commands

```bash
make help              # Show all available commands
make setup             # Complete setup for new developers
make dev               # Start development environment
make build             # Build all services for production
make test              # Run all tests
make test-e2e          # Run E2E tests with Playwright
make logs              # View logs from all services
make clean             # Clean up containers and volumes
```

### Development Workflow

1. **Start Development Environment**
   ```bash
   make dev
   ```

2. **Run Tests**
   ```bash
   make test              # All tests
   make test-backend      # Backend tests only
   make test-frontend     # Frontend tests only
   make test-e2e          # E2E tests
   ```

3. **Code Quality**
   ```bash
   make backend-lint      # Format backend code
   make frontend-lint     # Lint frontend code
   make backend-typecheck # Type checking
   ```

4. **Database Operations**
   ```bash
   make db-migrate        # Run database migrations
   make db-shell          # Open database shell
   make db-reset          # Reset database (WARNING: destroys data)
   ```

### Project Structure

```
TurtleTrading/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Core configuration
│   │   ├── models/         # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   ├── ml/             # LSTM models
│   │   └── sentiment/      # Sentiment analysis
│   ├── tests/              # Backend tests
│   └── requirements.txt
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Route components
│   │   ├── services/       # API clients
│   │   ├── hooks/          # Custom React hooks
│   │   └── contexts/       # Context providers
│   └── package.json
├── tests/                  # E2E Playwright tests
├── database/               # Database initialization
├── nginx/                  # Nginx configuration
├── docker-compose.yml      # Docker services
├── Makefile               # Development commands
└── README.md
```

---

## 📊 LSTM Model Configuration

The platform uses LSTM (Long Short-Term Memory) neural networks for stock price prediction:

### Model Architecture
- **Input Features**: Price, Volume, Technical Indicators (RSI, MACD, EMA, etc.)
- **Sequence Length**: 90 days lookback window
- **Model Structure**: Stacked LSTM layers with dropout regularization
- **Output**: 1-30 day price predictions with confidence intervals

### Configuration Parameters
```python
LSTM_LOOKBACK_DAYS = 90        # Historical data window
LSTM_PREDICTION_DAYS = 5       # Prediction horizon
LSTM_UNITS = 50               # LSTM layer units
LSTM_EPOCHS = 75              # Training epochs
LSTM_BATCH_SIZE = 32          # Training batch size
LSTM_VALIDATION_SPLIT = 0.2   # Validation data percentage
```

### Performance Metrics
- **Accuracy Tracking**: MAE, MSE, and percentage accuracy
- **Model Validation**: Train/test split with cross-validation
- **Confidence Intervals**: 95% confidence bounds for predictions
- **Feature Importance**: Analysis of most predictive features

---

## 🔍 Technical Indicators

### Weighted Scoring System

The platform uses a sophisticated weighted scoring system for technical analysis:

```python
DEFAULT_WEIGHTS = {
    "RSI": 0.12,           # Momentum indicator
    "MACD": 0.16,          # Trend following
    "EMA20": 0.12,         # Short-term trend
    "SMA50": 0.10,         # Medium-term trend
    "SMA200": 0.10,        # Long-term trend
    "Stoch": 0.10,         # Momentum oscillator
    "Bollinger": 0.10,     # Volatility indicator
    "ADX": 0.12,           # Trend strength
    "OBV": 0.08,           # Volume indicator
}
```

### Implemented Indicators
- **RSI** - Relative Strength Index
- **MACD** - Moving Average Convergence Divergence
- **Bollinger Bands** - Volatility bands
- **Stochastic Oscillator** - Momentum indicator
- **ADX** - Average Directional Index
- **OBV** - On-Balance Volume
- **ATR** - Average True Range
- **Moving Averages** - EMA20, SMA50, SMA200

---

## 🌐 Deployment

### Production Deployment

1. **Build Production Images**
   ```bash
   make build
   ```

2. **Set Production Environment Variables**
   ```bash
   # Set secure values for production
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   SECRET_KEY=secure-random-key
   ALPHA_VANTAGE_API_KEY=your-key
   FINNHUB_API_KEY=your-key
   ```

3. **Deploy with Docker Compose**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### Environment Variables

**Backend Configuration**
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
SECRET_KEY=your-secret-key
ALPHA_VANTAGE_API_KEY=your-api-key
FINNHUB_API_KEY=your-api-key
DEBUG=False
```

**Frontend Configuration**
```env
REACT_APP_API_BASE_URL=https://your-api-domain.com/api/v1
REACT_APP_WS_URL=wss://your-api-domain.com/ws
```

### Security Considerations

- **Environment Variables**: Never commit sensitive keys to version control
- **JWT Tokens**: Use strong secret keys and appropriate expiration times
- **HTTPS**: Always use HTTPS in production
- **Rate Limiting**: Configure appropriate rate limits for your use case
- **CORS**: Restrict allowed origins in production
- **Database**: Use connection pooling and proper indexing

---

## 📈 Performance & Monitoring

### Key Metrics Tracked
- **API Response Times** - Average and 95th percentile response times
- **WebSocket Connections** - Active connections and message throughput
- **Database Performance** - Query execution times and connection usage
- **LSTM Model Accuracy** - Prediction accuracy and error rates
- **Cache Hit Rates** - Redis cache performance metrics

### Health Check Endpoints
```bash
GET /health              # Overall system health
GET /api/v1/ws-info/health # WebSocket service health
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Quality Standards
- **Backend**: Black formatting, isort imports, flake8 linting, mypy type checking
- **Frontend**: ESLint, Prettier formatting, TypeScript strict mode
- **Testing**: 90%+ code coverage required
- **Documentation**: All public APIs must be documented

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **TensorFlow** - Machine learning framework
- **FastAPI** - High-performance Python web framework  
- **React** - Frontend library
- **TailwindCSS** - CSS framework
- **Alpha Vantage** - Financial data API
- **Finnhub** - Market data provider

---

## 📞 Support

- **Documentation**: [API Docs](http://localhost:8000/api/docs)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

---

<div align="center">
  <p>Built with ❤️ by the TurtleTrading Team</p>
  <p>
    <a href="#-turtletrading---advanced-stock-market-analysis-platform">Back to Top</a>
  </p>
</div>