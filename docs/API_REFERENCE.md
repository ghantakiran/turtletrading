# API Reference

## API Endpoint Reference

### Stock Analysis (`/api/v1/stocks/`)
- `GET /{symbol}/price` - Current stock price and market data
- `GET /{symbol}/technical` - Technical indicators (RSI, MACD, Bollinger Bands, etc.)
- `GET /{symbol}/lstm` - LSTM prediction with confidence intervals
- `GET /{symbol}/sentiment` - Sentiment analysis from news and social media
- `GET /{symbol}/analysis` - Comprehensive multi-factor analysis
- `GET /{symbol}/history` - Historical price data with technical indicators

### Market Data (`/api/v1/market/`)
- `GET /overview` - Market overview with major indices
- `GET /indices` - S&P 500, NASDAQ, Dow Jones, Russell 2000, VIX
- `GET /movers` - Top gainers and losers
- `GET /trends` - Market trends and sector performance
- `GET /volatility` - Volatility metrics and fear/greed index
- `GET /correlation` - Stock correlation analysis

### Sentiment Analysis (`/api/v1/sentiment/`)
- `GET /market` - Overall market sentiment
- `GET /stock/{symbol}` - Stock-specific sentiment analysis
- `GET /news/trending` - Trending financial news with sentiment scores
- `GET /social/{symbol}` - Social media sentiment aggregation
- `GET /summary` - Sentiment dashboard summary

### Authentication (`/api/v1/auth/`)
- `POST /register` - User registration with email verification
- `POST /token` - JWT token generation and login
- `GET /me` - Current user profile information
- `PUT /me` - Update user profile and preferences
- `POST /refresh-token` - Refresh JWT tokens
- `POST /change-password` - Secure password updates

### WebSocket (`/api/v1/websocket/`)
- `GET /connections` - Active WebSocket connection statistics
- `GET /subscriptions/{client_id}` - Client subscription management
- `POST /broadcast/test` - Test message broadcasting
- `GET /health` - WebSocket service health check

## Data Sources & External APIs

### Market Data
- **Yahoo Finance API** (via yfinance): Real-time prices, historical data, company info
- **Alpha Vantage**: Alternative market data with API redundancy
- **Financial Modeling Prep**: Company fundamentals and ratios

### News & Sentiment
- **NewsAPI**: Multi-source financial news aggregation
- **Twitter API v2**: Social media sentiment analysis
- **Reddit API**: Community sentiment from finance subreddits

### Economic Data
- **FRED API**: Federal Reserve economic indicators
- **Census Bureau**: Economic statistics and reports

## User Experience & Design Principles

### Core UX Principles
1. **Data-Driven Decisions**: All recommendations backed by quantitative analysis
2. **Real-Time Relevance**: Instant market updates and alerts
3. **Transparent Intelligence**: Clear AI prediction explanations and confidence levels
4. **Progressive Disclosure**: Advanced features accessible without overwhelming novices
5. **Mobile-First**: Responsive design optimized for all devices

### Key User Workflows
1. **New User Onboarding**: Registration → tour → watchlist setup → first analysis
2. **Daily Trading**: Market check → watchlist review → detailed analysis → decision making
3. **Research Process**: Stock discovery → multi-factor analysis → sentiment review → risk assessment

## AI/ML Model Configuration

### LSTM Prediction Service
- **Input Features**: Price, volume, 15+ technical indicators
- **Architecture**: Stacked LSTM layers with dropout regularization
- **Training**: 75 epochs with early stopping and validation split
- **Lookback Window**: 90 days historical data
- **Prediction Horizon**: 1-30 days forward predictions
- **Performance Metrics**: MAE, MSE, directional accuracy with confidence intervals

### Sentiment Analysis Engine
- **Sources**: Financial news, social media, economic reports
- **Processing**: Keyword-based NLP with financial lexicon
- **Scoring**: -100 to +100 sentiment scale with confidence levels
- **Aggregation**: Weighted scores by source reliability
- **Real-time**: WebSocket streaming of sentiment changes

## Business Logic & Rules

### Multi-Factor Analysis Scoring
- **50% LSTM Signal**: AI prediction confidence and direction
- **30% Technical Analysis**: Weighted combination of 15+ indicators
- **10% Sentiment Score**: News and social media sentiment
- **10% Seasonality**: Historical performance patterns

### Risk Management
- **Position Sizing**: Based on volatility and risk tolerance
- **Stop-Loss**: Automated recommendations using ATR and support levels
- **Portfolio Correlation**: Diversification analysis and warnings
- **Drawdown Monitoring**: Maximum loss tracking and alerts

### Alert System
- **Price Alerts**: Threshold-based and percentage change alerts
- **Technical Alerts**: Indicator crossovers and pattern recognition
- **Sentiment Alerts**: Significant sentiment shifts and news events
- **AI Alerts**: High-confidence LSTM predictions and model updates

## Error Handling & Monitoring

### Error Response Patterns
```python
# Standardized API error responses
{
    "error": "STOCK_NOT_FOUND",
    "message": "Stock symbol INVALID not found",
    "code": 404,
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### Monitoring & Alerting
- **Application Metrics**: Response times, error rates, user activity
- **Business Metrics**: Prediction accuracy, user engagement, revenue
- **Infrastructure Metrics**: CPU, memory, database performance
- **Real-time Dashboards**: Grafana dashboards for operations

## Feature Flags & A/B Testing

### Experimental Features
- New ML model variants
- UI/UX improvements
- Algorithm parameter tuning
- Pricing and tier experiments

### Feature Toggle Framework
```python
# Feature flag implementation
@feature_flag("lstm_v2_enabled")
def get_lstm_prediction(symbol: str, user_tier: str):
    if is_feature_enabled("lstm_v2_enabled", user_tier):
        return lstm_v2_service.predict(symbol)
    return lstm_v1_service.predict(symbol)
```

## Integration Guidelines

### Third-Party Integrations
- **Brokerage APIs**: TD Ameritrade, Interactive Brokers (planned)
- **Data Providers**: Multiple redundant sources for reliability
- **Payment Processing**: Stripe integration for subscriptions
- **Analytics**: Mixpanel for user behavior tracking

### API Design Standards
- RESTful endpoints with consistent naming conventions
- OpenAPI 3.0 documentation with examples
- Pagination with cursor-based navigation
- Rate limiting with clear headers
- Comprehensive error responses with actionable messages