# TurtleTrading - Project Overview

## Project Overview
**TurtleTrading** is an advanced AI-powered stock market analysis platform that democratizes institutional-grade trading tools for retail investors. The platform combines real-time market data, LSTM neural network predictions, sentiment analysis, and comprehensive technical indicators to provide sophisticated investment insights.

**Mission**: Empower every trader with institutional-grade market intelligence through AI-driven insights and real-time analytics.

**Vision**: Level the playing field between retail and institutional traders through advanced, affordable, and user-friendly market analysis tools.

## Business Context
- **Target Market**: $70M serviceable obtainable market in AI-enhanced trading analytics
- **User Personas**: Active day traders, long-term investors, investment professionals
- **Business Model**: Freemium SaaS with Pro and Enterprise tiers
- **Key Metrics**: 10,000 MAU and $2M ARR targets within 18 months

## Architecture Overview
- **Backend**: FastAPI with async Python services
- **Frontend**: React 18 with TypeScript and TailwindCSS
- **Database**: PostgreSQL with Redis caching
- **Real-time**: WebSocket connections for live data
- **Infrastructure**: Docker-based development and deployment
- **Testing**: MCP Playwright for end-to-end testing

## Project Structure
```
TurtleTrading/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API endpoints (stocks, market, sentiment, auth)
│   │   ├── core/           # Configuration and logging
│   │   ├── models/         # Pydantic schemas
│   │   ├── services/       # Business logic services
│   │   ├── ml/             # LSTM model services
│   │   └── sentiment/      # Sentiment analysis services
│   ├── tests/              # Backend tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # React TypeScript application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components (Dashboard, StockAnalysis, etc.)
│   │   ├── services/       # API clients and data fetching
│   │   ├── hooks/          # Custom React hooks
│   │   ├── contexts/       # Context providers (Auth, Theme, WebSocket)
│   │   └── types/          # TypeScript type definitions
│   ├── tests/              # Frontend tests
│   └── package.json        # Node.js dependencies
├── tests/                  # E2E Playwright tests
├── database/               # Database initialization and migrations
├── nginx/                  # Reverse proxy configuration
├── docker-compose.yml      # Multi-service Docker setup
├── Makefile               # Development automation
└── README.md              # Comprehensive documentation
```

## Technology Stack

### Backend Technologies
- **FastAPI**: High-performance async Python web framework
- **SQLAlchemy**: Database ORM with async support
- **PostgreSQL**: Primary database for persistent data
- **Redis**: Caching and real-time session management
- **TensorFlow**: LSTM model training and inference
- **WebSocket**: Real-time data streaming
- **JWT Authentication**: Secure user authentication
- **Pydantic**: Data validation and serialization

### Frontend Technologies
- **React 18**: Modern React with concurrent features
- **TypeScript**: Type safety and enhanced developer experience
- **TailwindCSS**: Utility-first CSS framework with custom design system
- **React Query**: Server state management and caching
- **React Router**: Client-side routing and navigation
- **Socket.io**: WebSocket client for real-time data
- **React Hook Form**: Form handling with validation
- **Recharts**: Interactive financial charts and visualizations

### Development & Infrastructure
- **Docker**: Containerized development and deployment
- **Docker Compose**: Multi-service orchestration
- **Nginx**: Reverse proxy and static file serving
- **Playwright**: End-to-end testing framework
- **GitHub Actions**: CI/CD pipeline (planned)
- **Make**: Development automation and workflow management

## Core Platform Features

### 1. Web Application Pages
- **Dashboard**: Market overview with key metrics and trending stocks
- **Stock Analysis**: Deep dive analysis with LSTM predictions and technical indicators
- **Market Overview**: Comprehensive market indices, trends, and breadth analysis
- **Sentiment Center**: Real-time sentiment analysis from news and social media
- **Portfolio Tracker**: Personal watchlist and portfolio performance monitoring
- **Settings**: User preferences, alerts configuration, and account management

### 2. API Endpoints Architecture
- **Authentication**: User registration, login, JWT token management
- **Stock Analysis**: Price data, technical indicators, LSTM predictions
- **Market Data**: Indices, top movers, sector performance, volatility
- **Sentiment Analysis**: News sentiment, social media sentiment, trending keywords
- **WebSocket**: Real-time market updates and sentiment changes

### 3. LSTM Model Service (Migrated from Original Script)
- **Lookback Period**: 90 days historical data window
- **Prediction Horizon**: 1-30 days forward predictions
- **Model Architecture**: Stacked LSTM layers with dropout regularization
- **Features**: Price, volume, and 15+ technical indicators
- **Training**: 75 epochs with early stopping and validation
- **Performance Metrics**: MAE, MSE, accuracy tracking with confidence intervals

### 4. Advanced Technical Analysis
- **15+ Indicators**: RSI, MACD, Bollinger Bands, ADX, OBV, Stochastic, ATR, etc.
- **Weighted Scoring**: Configurable weights for different indicator categories
- **Seasonality Analysis**: Historical performance patterns by day/month/year
- **Risk/Reward Calculations**: Automated stop-loss and target price recommendations

### 5. Real-time Data Streaming
- **WebSocket Connections**: Live price updates and market changes
- **Sentiment Streaming**: Real-time sentiment score updates
- **Market Breadth**: Live advancing/declining stocks ratio
- **Alert System**: Instant notifications for price and sentiment thresholds

### 6. Weighted Scoring System (Enhanced)
```python
DEFAULT_WEIGHTS = {
    "RSI": 0.12,      # Momentum indicator weight
    "MACD": 0.16,     # Trend following weight
    "EMA20": 0.12,    # Short-term trend weight
    "SMA50": 0.10,    # Medium-term trend weight
    "SMA200": 0.10,   # Long-term trend weight
    "Stoch": 0.10,    # Momentum oscillator weight
    "Bollinger": 0.10, # Volatility indicator weight
    "ADX": 0.12,      # Trend strength weight
    "OBV": 0.08,      # Volume indicator weight
}
```

### 7. Final Analysis Score Calculation
- **50% LSTM Signal** - Deep learning price prediction confidence
- **50% Weighted Technical Score** - Multi-indicator technical analysis
- **10% Seasonality Boost** - Historical performance patterns
- **Risk Assessment** - Volatility and drawdown analysis

## Current Implementation Status
### ✅ Completed Components
- FastAPI backend with comprehensive API endpoints
- React frontend with TypeScript and modern tooling
- Docker-based development environment
- WebSocket real-time data streaming
- User authentication and authorization
- Comprehensive project documentation

### 🚧 In Progress
- Database models and migrations
- LSTM model service migration from original script
- MCP Playwright testing framework
- Frontend UI components and pages

### 📋 Upcoming Features
- Advanced charting and visualization
- Portfolio optimization algorithms
- Mobile-responsive design enhancements
- Advanced alert and notification system
- Backtesting and strategy validation
- Multi-language support

## Default Stock Universe
The platform analyzes major US stocks including:
`["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "JPM", "QQQ", "SPY", "SE", "MRVL", "CRM", "UNH", "NFLX"]`

Additional symbols can be analyzed on-demand through the web interface.

## Key Service Classes
- **StockService**: Stock price data, technical analysis, and LSTM predictions
- **MarketService**: Market indices, trends, and breadth analysis
- **SentimentService**: News and social media sentiment analysis
- **AuthService**: User authentication and session management
- **WebSocketManager**: Real-time connection and subscription management