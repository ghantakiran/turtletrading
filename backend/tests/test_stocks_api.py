"""
Comprehensive tests for stocks API endpoints
Tests REQ-STOCK-01, REQ-STOCK-02, REQ-STOCK-03 from IMPLEMENT_FROM_DOCS.md
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
import json


@pytest_asyncio.fixture
async def mock_stock_service():
    """Mock stock service for testing."""
    with patch('app.services.stock_service.StockService') as mock_service:
        mock_instance = AsyncMock()

        # Mock price data
        mock_instance.get_stock_price.return_value = {
            "symbol": "AAPL",
            "current_price": 150.25,
            "previous_close": 149.00,
            "change": 1.25,
            "change_percent": 0.84,
            "day_high": 151.50,
            "day_low": 148.75,
            "volume": 45678900,
            "market_cap": 2450000000000.0,
            "timestamp": "2024-01-15T10:30:00Z"
        }

        # Mock technical indicators
        mock_instance.get_technical_indicators.return_value = {
            "symbol": "AAPL",
            "rsi": 65.42,
            "macd": {
                "macd": 2.34,
                "signal": 2.12,
                "histogram": 0.22
            },
            "bollinger_bands": {
                "upper": 155.67,
                "middle": 150.25,
                "lower": 144.83
            },
            "stochastic": {
                "k": 68.5,
                "d": 72.3
            },
            "adx": 45.6,
            "obv": 125000000,
            "atr": 3.45,
            "technical_score": 72.5,
            "recommendation": "BUY"
        }

        # Mock enhanced technical analysis
        mock_instance.get_enhanced_technical_analysis.return_value = {
            "symbol": "AAPL",
            "enhanced_score": 78.5,
            "enhanced_recommendation": "STRONG_BUY",
            "confidence": 0.87,
            "key_factors": [
                "Strong momentum indicators",
                "Bullish trend continuation",
                "High volume confirmation"
            ],
            "warnings": [],
            "support_levels": [147.50, 145.00, 142.25],
            "resistance_levels": [152.00, 155.50, 158.75],
            "volatility_analysis": {
                "current_volatility": 0.25,
                "avg_volatility": 0.28,
                "volatility_trend": "decreasing"
            }
        }

        # Mock historical data
        mock_instance.get_historical_data.return_value = {
            "symbol": "AAPL",
            "data": [
                {
                    "date": "2024-01-15",
                    "open": 149.50,
                    "high": 151.75,
                    "low": 148.25,
                    "close": 150.25,
                    "volume": 45678900,
                    "adj_close": 150.25
                },
                {
                    "date": "2024-01-14",
                    "open": 148.00,
                    "high": 150.00,
                    "low": 147.50,
                    "close": 149.00,
                    "volume": 42345600,
                    "adj_close": 149.00
                }
            ],
            "period": "1mo",
            "interval": "1d"
        }

        # Mock LSTM predictions
        mock_instance.get_lstm_prediction.return_value = {
            "symbol": "AAPL",
            "predictions": [
                {"date": "2024-01-16", "predicted_price": 151.75, "confidence": 0.82},
                {"date": "2024-01-17", "predicted_price": 153.20, "confidence": 0.79},
                {"date": "2024-01-18", "predicted_price": 152.80, "confidence": 0.76}
            ],
            "model_accuracy": 0.85,
            "prediction_horizon": "3_days",
            "risk_assessment": {
                "volatility_forecast": 0.24,
                "downside_risk": 0.15,
                "upside_potential": 0.18
            }
        }

        # Mock comprehensive analysis
        mock_instance.get_comprehensive_analysis.return_value = {
            "symbol": "AAPL",
            "overall_score": 76.8,
            "overall_recommendation": "BUY",
            "confidence": 0.84,
            "analysis_components": {
                "technical_score": 72.5,
                "lstm_score": 81.2,
                "sentiment_score": 75.6,
                "fundamental_score": 78.1
            },
            "key_insights": [
                "Strong technical momentum confirmed by multiple indicators",
                "LSTM model predicts continued upward trend",
                "Positive market sentiment supporting price action"
            ],
            "risk_factors": [
                "General market volatility",
                "Sector rotation risk"
            ]
        }

        mock_service.return_value = mock_instance
        yield mock_instance


class TestStocksAPI:
    """Test class for stocks API endpoints."""

    @pytest.mark.asyncio
    async def test_get_stock_price_success(self, client: AsyncClient, mock_stock_service):
        """Test successful stock price retrieval."""
        response = await client.get("/api/v1/stocks/AAPL/price")

        assert response.status_code == 200
        data = response.json()

        assert data["symbol"] == "AAPL"
        assert data["current_price"] == 150.25
        assert data["change"] == 1.25
        assert data["change_percent"] == 0.84
        assert "timestamp" in data

    @pytest.mark.asyncio
    async def test_get_stock_price_invalid_symbol(self, client: AsyncClient, mock_stock_service):
        """Test stock price with invalid symbol."""
        mock_stock_service.get_stock_price.side_effect = ValueError("Invalid symbol")

        response = await client.get("/api/v1/stocks/INVALID/price")

        assert response.status_code == 400
        data = response.json()
        assert "error" in data

    @pytest.mark.asyncio
    async def test_get_technical_indicators_success(self, client: AsyncClient, mock_stock_service):
        """Test successful technical indicators retrieval."""
        response = await client.get("/api/v1/stocks/AAPL/technical")

        assert response.status_code == 200
        data = response.json()

        assert data["symbol"] == "AAPL"
        assert data["rsi"] == 65.42
        assert "macd" in data
        assert "bollinger_bands" in data
        assert data["technical_score"] == 72.5
        assert data["recommendation"] == "BUY"

    @pytest.mark.asyncio
    async def test_get_enhanced_technical_analysis(self, client: AsyncClient, mock_stock_service):
        """Test enhanced technical analysis endpoint."""
        response = await client.get("/api/v1/stocks/AAPL/enhanced-technical?period=1y")

        assert response.status_code == 200
        data = response.json()

        assert data["symbol"] == "AAPL"
        assert data["enhanced_score"] == 78.5
        assert data["enhanced_recommendation"] == "STRONG_BUY"
        assert data["confidence"] == 0.87
        assert "key_factors" in data
        assert "support_levels" in data
        assert "resistance_levels" in data

    @pytest.mark.asyncio
    async def test_get_historical_data_success(self, client: AsyncClient, mock_stock_service):
        """Test historical data retrieval."""
        response = await client.get("/api/v1/stocks/AAPL/history?period=1mo&interval=1d")

        assert response.status_code == 200
        data = response.json()

        assert data["symbol"] == "AAPL"
        assert len(data["data"]) == 2
        assert data["period"] == "1mo"
        assert data["interval"] == "1d"

        # Check first data point
        first_point = data["data"][0]
        assert first_point["date"] == "2024-01-15"
        assert first_point["close"] == 150.25

    @pytest.mark.asyncio
    async def test_get_lstm_prediction_success(self, client: AsyncClient, mock_stock_service):
        """Test LSTM prediction endpoint."""
        response = await client.get("/api/v1/stocks/AAPL/lstm?days=3")

        assert response.status_code == 200
        data = response.json()

        assert data["symbol"] == "AAPL"
        assert len(data["predictions"]) == 3
        assert data["model_accuracy"] == 0.85
        assert data["prediction_horizon"] == "3_days"
        assert "risk_assessment" in data

    @pytest.mark.asyncio
    async def test_get_comprehensive_analysis_success(self, client: AsyncClient, mock_stock_service):
        """Test comprehensive analysis endpoint."""
        response = await client.get("/api/v1/stocks/AAPL/analysis")

        assert response.status_code == 200
        data = response.json()

        assert data["symbol"] == "AAPL"
        assert data["overall_score"] == 76.8
        assert data["overall_recommendation"] == "BUY"
        assert data["confidence"] == 0.84
        assert "analysis_components" in data
        assert "key_insights" in data
        assert "risk_factors" in data

    @pytest.mark.asyncio
    async def test_batch_analysis_success(self, client: AsyncClient, mock_stock_service):
        """Test batch analysis endpoint."""
        symbols = ["AAPL", "MSFT", "GOOGL"]

        response = await client.post(
            "/api/v1/stocks/batch-analysis",
            json={"symbols": symbols}
        )

        assert response.status_code == 200
        data = response.json()

        assert "results" in data
        assert len(data["results"]) == 3
        assert data["timestamp"]

    @pytest.mark.asyncio
    async def test_get_available_stocks_success(self, client: AsyncClient, mock_stock_service):
        """Test available stocks endpoint."""
        mock_stock_service.get_available_stocks.return_value = {
            "stocks": [
                {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
                {"symbol": "MSFT", "name": "Microsoft Corporation", "sector": "Technology"},
                {"symbol": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology"}
            ],
            "total_count": 3,
            "sectors": ["Technology"]
        }

        response = await client.get("/api/v1/stocks/")

        assert response.status_code == 200
        data = response.json()

        assert "stocks" in data
        assert data["total_count"] == 3
        assert len(data["stocks"]) == 3

    @pytest.mark.asyncio
    async def test_rate_limit_stats(self, client: AsyncClient):
        """Test rate limit statistics endpoint."""
        response = await client.get("/api/v1/stocks/rate-limit-stats")

        assert response.status_code == 200
        data = response.json()

        assert "requests_made" in data
        assert "requests_remaining" in data
        assert "reset_time" in data

    @pytest.mark.asyncio
    async def test_performance_requirements(self, client: AsyncClient, mock_stock_service, performance_timer):
        """Test API performance requirements."""
        performance_timer.start()

        response = await client.get("/api/v1/stocks/AAPL/price")

        performance_timer.stop()
        elapsed_time = performance_timer.elapsed()

        # API should respond within 500ms as per requirements
        assert elapsed_time < 0.5
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_error_handling_network_failure(self, client: AsyncClient, mock_stock_service):
        """Test error handling for network failures."""
        mock_stock_service.get_stock_price.side_effect = Exception("Network timeout")

        response = await client.get("/api/v1/stocks/AAPL/price")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data

    @pytest.mark.asyncio
    async def test_input_validation(self, client: AsyncClient, mock_stock_service):
        """Test input validation for various endpoints."""
        # Test invalid period parameter
        response = await client.get("/api/v1/stocks/AAPL/history?period=invalid")
        assert response.status_code == 422  # Validation error

        # Test invalid days parameter for LSTM
        response = await client.get("/api/v1/stocks/AAPL/lstm?days=-1")
        assert response.status_code == 422  # Validation error

        # Test empty symbol
        response = await client.get("/api/v1/stocks//price")
        assert response.status_code == 404  # Not found

    @pytest.mark.asyncio
    async def test_concurrent_requests(self, client: AsyncClient, mock_stock_service):
        """Test handling of concurrent requests."""
        import asyncio

        # Make multiple concurrent requests
        tasks = [
            client.get("/api/v1/stocks/AAPL/price"),
            client.get("/api/v1/stocks/MSFT/price"),
            client.get("/api/v1/stocks/GOOGL/price")
        ]

        responses = await asyncio.gather(*tasks)

        # All requests should succeed
        for response in responses:
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_data_consistency(self, client: AsyncClient, mock_stock_service):
        """Test data consistency across endpoints."""
        # Get price data
        price_response = await client.get("/api/v1/stocks/AAPL/price")
        price_data = price_response.json()

        # Get technical analysis
        tech_response = await client.get("/api/v1/stocks/AAPL/technical")
        tech_data = tech_response.json()

        # Symbol should be consistent
        assert price_data["symbol"] == tech_data["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_api_response_format(self, client: AsyncClient, mock_stock_service):
        """Test API response format compliance."""
        response = await client.get("/api/v1/stocks/AAPL/price")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

        data = response.json()

        # Check required fields
        required_fields = ["symbol", "current_price", "timestamp"]
        for field in required_fields:
            assert field in data

    @pytest.mark.asyncio
    async def test_cache_headers(self, client: AsyncClient, mock_stock_service):
        """Test appropriate cache headers are set."""
        response = await client.get("/api/v1/stocks/AAPL/price")

        assert response.status_code == 200
        # Should have cache control headers for stock data
        assert "cache-control" in response.headers or "x-cache" in response.headers

    @pytest.mark.asyncio
    async def test_cors_headers(self, client: AsyncClient, mock_stock_service):
        """Test CORS headers are properly set."""
        response = await client.options("/api/v1/stocks/AAPL/price")

        # Should allow CORS for OPTIONS request
        assert response.status_code in [200, 204]

    @pytest.mark.asyncio
    async def test_api_versioning(self, client: AsyncClient, mock_stock_service):
        """Test API versioning is properly implemented."""
        response = await client.get("/api/v1/stocks/AAPL/price")

        assert response.status_code == 200
        # API version should be in headers
        assert "x-api-version" in response.headers or "api-version" in response.headers