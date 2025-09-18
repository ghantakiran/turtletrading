# TurtleTrading API Documentation

Welcome to the TurtleTrading API documentation! This comprehensive guide covers all aspects of our AI-powered trading platform API.

## 🚀 Quick Start

### Base URLs
- **Development**: `http://localhost:8000`
- **Production**: `https://api.turtletrading.com` (coming soon)

### Interactive Documentation
- **Swagger UI**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **ReDoc**: [http://localhost:8000/api/redoc](http://localhost:8000/api/redoc)
- **OpenAPI Schema**: [http://localhost:8000/api/openapi.json](http://localhost:8000/api/openapi.json)

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
   - [Stocks](#stocks-api)
   - [Market Data](#market-data-api)
   - [Sentiment Analysis](#sentiment-analysis-api)
   - [Authentication](#authentication-api)
   - [WebSocket](#websocket-api)
3. [Response Formats](#response-formats)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [WebSocket Events](#websocket-events)
7. [Code Examples](#code-examples)

## 🔐 Authentication

TurtleTrading uses JWT (JSON Web Tokens) for authentication. All authenticated endpoints require a valid JWT token in the Authorization header.

### Authentication Flow

1. **Register/Login**: Obtain JWT tokens via `/api/v1/auth/token`
2. **Include Token**: Add to headers: `Authorization: Bearer <your_token>`
3. **Refresh Token**: Use refresh endpoint before token expires

### Authentication Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

## 🔗 API Endpoints

All API endpoints are prefixed with `/api/v1/` and return JSON responses.

### Stocks API (`/api/v1/stocks/`)

#### Stock Price Data
```http
GET /api/v1/stocks/{symbol}/price
```
Get current stock price and basic market data.

**Parameters:**
- `symbol` (string): Stock symbol (e.g., "AAPL", "MSFT")

**Response:**
```json
{
  "symbol": "AAPL",
  "price": 150.25,
  "change": 2.50,
  "change_percent": 1.69,
  "volume": 50000000,
  "market_cap": 2500000000000,
  "timestamp": "2024-01-15T15:30:00Z"
}
```

#### Technical Analysis
```http
GET /api/v1/stocks/{symbol}/technical
```
Get comprehensive technical analysis indicators.

**Response:**
```json
{
  "symbol": "AAPL",
  "indicators": {
    "rsi": {"value": 65.2, "signal": "neutral"},
    "macd": {"value": 1.23, "signal": "buy"},
    "bollinger_bands": {
      "upper": 155.30,
      "middle": 150.25,
      "lower": 145.20,
      "position": "middle"
    }
  },
  "score": 75.5,
  "recommendation": "buy"
}
```

#### LSTM Predictions
```http
GET /api/v1/stocks/{symbol}/lstm
```
Get AI-powered price predictions using LSTM neural networks.

**Parameters:**
- `days` (integer, optional): Prediction horizon (1-30 days, default: 5)

**Response:**
```json
{
  "symbol": "AAPL",
  "predictions": [
    {
      "date": "2024-01-16",
      "predicted_price": 151.80,
      "confidence": 0.85,
      "direction": "up"
    }
  ],
  "model_accuracy": 0.72,
  "confidence_interval": {"lower": 148.30, "upper": 155.20}
}
```

### Market Data API (`/api/v1/market/`)

#### Market Overview
```http
GET /api/v1/market/overview
```
Get comprehensive market overview with major indices.

**Response:**
```json
{
  "market_status": "open",
  "indices": {
    "sp500": {"value": 4500.25, "change": 1.2},
    "nasdaq": {"value": 14000.30, "change": -0.5},
    "dow": {"value": 35000.45, "change": 0.8}
  },
  "market_breadth": {
    "advancing": 1850,
    "declining": 1350,
    "unchanged": 300
  },
  "sentiment": "bullish"
}
```

### Sentiment Analysis API (`/api/v1/sentiment/`)

#### Stock Sentiment
```http
GET /api/v1/sentiment/stock/{symbol}
```
Get sentiment analysis for a specific stock.

**Response:**
```json
{
  "symbol": "AAPL",
  "sentiment_score": 75.5,
  "sentiment_label": "positive",
  "sources": {
    "news": {"score": 80.2, "articles": 25},
    "social": {"score": 70.8, "mentions": 1500}
  },
  "trending_keywords": ["earnings", "iPhone", "AI"],
  "last_updated": "2024-01-15T15:30:00Z"
}
```

### Authentication API (`/api/v1/auth/`)

#### User Registration
```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "full_name": "John Doe"
}
```

#### Login / Token Generation
```http
POST /api/v1/auth/token
```

**Request Body:**
```json
{
  "username": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

### WebSocket API (`/api/v1/ws-info/`)

#### Connection Info
```http
GET /api/v1/ws-info/health
```
Get WebSocket service health and connection statistics.

## 📊 Response Formats

### Success Response Format
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T15:30:00Z",
    "request_id": "req_12345",
    "version": "1.0.0"
  }
}
```

### Error Response Format
```json
{
  "error": {
    "code": "STOCK_NOT_FOUND",
    "message": "Stock symbol 'INVALID' not found",
    "details": "Please provide a valid stock symbol",
    "timestamp": "2024-01-15T15:30:00Z",
    "request_id": "req_12345"
  }
}
```

## ⚠️ Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_SYMBOL` | Stock symbol not found or invalid |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| `INVALID_TOKEN` | JWT token is invalid or expired |
| `MISSING_PARAMETER` | Required parameter missing |
| `PREDICTION_UNAVAILABLE` | LSTM prediction temporarily unavailable |
| `MARKET_CLOSED` | Market is closed, limited data available |

## 🔒 Rate Limiting

### Rate Limits by Tier

| Tier | Requests/Hour | Requests/Day |
|------|---------------|--------------|
| Free | 1,000 | 10,000 |
| Pro | 10,000 | 100,000 |
| Enterprise | Unlimited | Unlimited |

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1642262400
X-RateLimit-Retry-After: 3600
```

## 🔌 WebSocket Events

Connect to WebSocket at: `ws://localhost:8000/ws/{client_id}`

### Subscription Events
```json
{
  "type": "subscribe",
  "symbols": ["AAPL", "MSFT", "TSLA"]
}
```

### Real-time Price Updates
```json
{
  "type": "price_update",
  "symbol": "AAPL",
  "price": 151.25,
  "change": 1.00,
  "volume": 1000000,
  "timestamp": "2024-01-15T15:30:00Z"
}
```

### Sentiment Updates
```json
{
  "type": "sentiment_update",
  "symbol": "AAPL",
  "sentiment_score": 78.5,
  "change": 3.2,
  "timestamp": "2024-01-15T15:30:00Z"
}
```

## 💻 Code Examples

### Python Example
```python
import requests
import json

# Base configuration
BASE_URL = "http://localhost:8000/api/v1"
headers = {"Authorization": "Bearer YOUR_TOKEN_HERE"}

# Get stock price
response = requests.get(f"{BASE_URL}/stocks/AAPL/price", headers=headers)
data = response.json()
print(f"AAPL Price: ${data['price']}")

# Get technical analysis
response = requests.get(f"{BASE_URL}/stocks/AAPL/technical", headers=headers)
analysis = response.json()
print(f"Technical Score: {analysis['score']}")
```

### JavaScript Example
```javascript
const BASE_URL = 'http://localhost:8000/api/v1';
const token = 'YOUR_TOKEN_HERE';

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// Get stock price
async function getStockPrice(symbol) {
  const response = await fetch(`${BASE_URL}/stocks/${symbol}/price`, { headers });
  const data = await response.json();
  return data;
}

// Get LSTM predictions
async function getLSTMPrediction(symbol, days = 5) {
  const response = await fetch(
    `${BASE_URL}/stocks/${symbol}/lstm?days=${days}`, 
    { headers }
  );
  const data = await response.json();
  return data;
}
```

### WebSocket Example
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/my-client-id');

ws.onopen = function() {
  // Subscribe to stock updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    symbols: ['AAPL', 'MSFT', 'TSLA']
  }));
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  if (data.type === 'price_update') {
    console.log(`${data.symbol}: $${data.price}`);
  }
};
```

### cURL Examples
```bash
# Get stock price
curl -X GET "http://localhost:8000/api/v1/stocks/AAPL/price" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get market overview
curl -X GET "http://localhost:8000/api/v1/market/overview"

# Login to get token
curl -X POST "http://localhost:8000/api/v1/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=password123"
```

## 🔧 SDK & Libraries

### Official Libraries (Coming Soon)
- **Python SDK**: `pip install turtletrading-python`
- **JavaScript SDK**: `npm install turtletrading-js`
- **TypeScript Types**: `npm install @turtletrading/types`

### Third-party Libraries
- **Postman Collection**: Import our API collection for easy testing
- **OpenAPI Generator**: Generate client libraries in 40+ languages

## 📚 Additional Resources

### Developer Tools
- [API Status Page](http://localhost:8000/health) - Service health monitoring
- [WebSocket Tester](http://localhost:8000/ws/test) - Interactive WebSocket testing
- [Rate Limit Calculator](docs/rate-limits.md) - Calculate your usage

### Guides & Tutorials
- [Getting Started Guide](getting-started.md)
- [Authentication Tutorial](authentication.md)
- [WebSocket Integration](websocket-guide.md)
- [Error Handling Best Practices](error-handling.md)

### Support
- **Documentation**: This guide and inline API docs
- **GitHub Issues**: Report bugs and request features
- **Discord Community**: Real-time developer support
- **Email Support**: api-support@turtletrading.com

---

## 📄 API Versioning

The TurtleTrading API uses semantic versioning. The current version is `v1`.

### Version Headers
```http
X-API-Version: 1.0.0
```

### Deprecation Policy
- **Minor versions**: New features, backward compatible
- **Major versions**: Breaking changes with 6-month notice
- **Patch versions**: Bug fixes and security updates

---

**Last Updated**: September 2025  
**API Version**: v1.0.0  
**Documentation Version**: 1.0.0