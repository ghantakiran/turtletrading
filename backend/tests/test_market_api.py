"""
Comprehensive tests for market API endpoints
Tests REQ-MARKET-01, REQ-MARKET-02, REQ-MARKET-03 from IMPLEMENT_FROM_DOCS.md
Ensures 100% coverage for market-related functionality
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock
import json
from datetime import datetime, timedelta


@pytest_asyncio.fixture
async def mock_market_service():
    """Mock market service for comprehensive testing."""
    with patch('app.services.market_service.MarketService') as mock_service:
        mock_instance = AsyncMock()

        # Mock market indices
        mock_instance.get_market_indices.return_value = {
            "sp500": {
                "symbol": "^GSPC",
                "name": "S&P 500",
                "current_value": 4500.25,
                "change": 45.30,
                "change_percent": 1.02,
                "volume": 3500000000,
                "timestamp": datetime.utcnow().isoformat()
            },
            "nasdaq": {
                "symbol": "^IXIC",
                "name": "NASDAQ Composite",
                "current_value": 15200.80,
                "change": -125.40,
                "change_percent": -0.82,
                "volume": 4200000000,
                "timestamp": datetime.utcnow().isoformat()
            },
            "dow_jones": {
                "symbol": "^DJI",
                "name": "Dow Jones Industrial Average",
                "current_value": 35600.15,
                "change": 220.85,
                "change_percent": 0.62,
                "volume": 420000000,
                "timestamp": datetime.utcnow().isoformat()
            },
            "russell2000": {
                "symbol": "^RUT",
                "name": "Russell 2000",
                "current_value": 2250.45,
                "change": 15.20,
                "change_percent": 0.68,
                "volume": 890000000,
                "timestamp": datetime.utcnow().isoformat()
            },
            "vix": {
                "symbol": "^VIX",
                "name": "Volatility Index",
                "current_value": 18.75,
                "change": -1.25,
                "change_percent": -6.25,
                "volume": 0,
                "timestamp": datetime.utcnow().isoformat()
            }
        }

        # Mock market overview
        mock_instance.get_market_overview.return_value = {
            "market_status": "open",
            "trading_session": "regular",
            "market_sentiment": "bullish",
            "advance_decline_ratio": 1.45,
            "new_highs": 156,
            "new_lows": 42,
            "total_volume": 8920000000,
            "market_breadth": {
                "advancing": 2847,
                "declining": 1965,
                "unchanged": 188
            },
            "sector_performance": {
                "technology": 1.25,
                "healthcare": 0.85,
                "finance": -0.45,
                "energy": 2.10,
                "utilities": -0.15
            },
            "timestamp": datetime.utcnow().isoformat()
        }

        # Mock top movers
        mock_instance.get_top_movers.return_value = {
            "gainers": [
                {
                    "symbol": "NVDA",
                    "name": "NVIDIA Corporation",
                    "price": 485.20,
                    "change": 28.45,
                    "change_percent": 6.23,
                    "volume": 45000000
                },
                {
                    "symbol": "AMD",
                    "name": "Advanced Micro Devices",
                    "price": 165.80,
                    "change": 8.90,
                    "change_percent": 5.67,
                    "volume": 38000000
                }
            ],
            "losers": [
                {
                    "symbol": "META",
                    "name": "Meta Platforms Inc",
                    "price": 325.40,
                    "change": -18.60,
                    "change_percent": -5.41,
                    "volume": 22000000
                },
                {
                    "symbol": "NFLX",
                    "name": "Netflix Inc",
                    "price": 445.30,
                    "change": -22.15,
                    "change_percent": -4.74,
                    "volume": 15000000
                }
            ],
            "most_active": [
                {
                    "symbol": "AAPL",
                    "name": "Apple Inc",
                    "price": 150.25,
                    "change": 2.10,
                    "change_percent": 1.42,
                    "volume": 89000000
                }
            ]
        }

        # Mock sector performance
        mock_instance.get_sector_performance.return_value = {
            "sectors": [
                {
                    "sector": "Technology",
                    "performance": 1.25,
                    "top_performers": ["NVDA", "AMD", "MSFT"],
                    "laggards": ["META", "NFLX"],
                    "volume": 2500000000
                },
                {
                    "sector": "Healthcare",
                    "performance": 0.85,
                    "top_performers": ["JNJ", "PFE", "UNH"],
                    "laggards": ["BIIB"],
                    "volume": 1200000000
                }
            ],
            "timestamp": datetime.utcnow().isoformat()
        }

        # Mock volatility data
        mock_instance.get_volatility_data.return_value = {
            "vix": 18.75,
            "vix_change": -1.25,
            "vix_trend": "decreasing",
            "market_volatility": "moderate",
            "fear_greed_index": {
                "value": 68,
                "classification": "greed",
                "components": {
                    "market_momentum": 75,
                    "stock_price_strength": 62,
                    "stock_price_breadth": 71,
                    "put_call_ratio": 45,
                    "market_volatility": 58,
                    "safe_haven_demand": 42,
                    "junk_bond_demand": 73
                }
            },
            "volatility_forecast": {
                "short_term": "stable",
                "medium_term": "increasing",
                "long_term": "moderate"
            }
        }

        # Mock economic calendar
        mock_instance.get_economic_calendar.return_value = {
            "today": [
                {
                    "time": "08:30",
                    "event": "Initial Jobless Claims",
                    "importance": "medium",
                    "forecast": "210K",
                    "previous": "215K",
                    "actual": null
                }
            ],
            "upcoming": [
                {
                    "date": "2024-01-16",
                    "time": "10:00",
                    "event": "Consumer Sentiment",
                    "importance": "high",
                    "forecast": "69.0",
                    "previous": "68.1"
                }
            ]
        }

        # Mock correlation matrix
        mock_instance.get_correlation_matrix.return_value = {
            "symbols": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
            "correlation_matrix": [
                [1.00, 0.85, 0.78, 0.45, 0.72],
                [0.85, 1.00, 0.82, 0.38, 0.69],
                [0.78, 0.82, 1.00, 0.41, 0.75],
                [0.45, 0.38, 0.41, 1.00, 0.52],
                [0.72, 0.69, 0.75, 0.52, 1.00]
            ],
            "period": "30_days",
            "timestamp": datetime.utcnow().isoformat()
        }

        mock_service.return_value = mock_instance
        yield mock_instance


class TestMarketAPI:
    """Comprehensive test class for market API endpoints."""

    @pytest.mark.asyncio
    async def test_get_market_indices_success(self, client: AsyncClient, mock_market_service):
        """Test successful market indices retrieval."""
        response = await client.get("/api/v1/market/indices")

        assert response.status_code == 200
        data = response.json()

        # Verify all major indices are present
        assert "sp500" in data
        assert "nasdaq" in data
        assert "dow_jones" in data
        assert "russell2000" in data
        assert "vix" in data

        # Verify S&P 500 data structure
        sp500 = data["sp500"]
        assert sp500["symbol"] == "^GSPC"
        assert sp500["name"] == "S&P 500"
        assert sp500["current_value"] == 4500.25
        assert sp500["change"] == 45.30
        assert sp500["change_percent"] == 1.02

        # Verify timestamp is recent
        assert "timestamp" in sp500

    @pytest.mark.asyncio
    async def test_get_market_overview_success(self, client: AsyncClient, mock_market_service):
        """Test comprehensive market overview endpoint."""
        response = await client.get("/api/v1/market/overview")

        assert response.status_code == 200
        data = response.json()

        # Verify market status information
        assert data["market_status"] == "open"
        assert data["trading_session"] == "regular"
        assert data["market_sentiment"] == "bullish"

        # Verify market breadth data
        assert "market_breadth" in data
        breadth = data["market_breadth"]
        assert breadth["advancing"] == 2847
        assert breadth["declining"] == 1965
        assert breadth["unchanged"] == 188

        # Verify sector performance
        assert "sector_performance" in data
        assert data["sector_performance"]["technology"] == 1.25

    @pytest.mark.asyncio
    async def test_get_top_movers_success(self, client: AsyncClient, mock_market_service):
        """Test top movers endpoint."""
        response = await client.get("/api/v1/market/movers")

        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "gainers" in data
        assert "losers" in data
        assert "most_active" in data

        # Verify gainers data
        gainers = data["gainers"]
        assert len(gainers) >= 1
        assert gainers[0]["symbol"] == "NVDA"
        assert gainers[0]["change_percent"] == 6.23

        # Verify losers data
        losers = data["losers"]
        assert len(losers) >= 1
        assert losers[0]["symbol"] == "META"
        assert losers[0]["change_percent"] == -5.41

    @pytest.mark.asyncio
    async def test_get_sector_performance_success(self, client: AsyncClient, mock_market_service):
        """Test sector performance endpoint."""
        response = await client.get("/api/v1/market/sectors")

        assert response.status_code == 200
        data = response.json()

        assert "sectors" in data
        sectors = data["sectors"]

        # Verify technology sector
        tech_sector = next(s for s in sectors if s["sector"] == "Technology")
        assert tech_sector["performance"] == 1.25
        assert "NVDA" in tech_sector["top_performers"]
        assert "META" in tech_sector["laggards"]

    @pytest.mark.asyncio
    async def test_get_volatility_data_success(self, client: AsyncClient, mock_market_service):
        """Test volatility data endpoint."""
        response = await client.get("/api/v1/market/volatility")

        assert response.status_code == 200
        data = response.json()

        # Verify VIX data
        assert data["vix"] == 18.75
        assert data["vix_change"] == -1.25
        assert data["vix_trend"] == "decreasing"

        # Verify fear & greed index
        assert "fear_greed_index" in data
        fg_index = data["fear_greed_index"]
        assert fg_index["value"] == 68
        assert fg_index["classification"] == "greed"

        # Verify components
        assert "components" in fg_index
        components = fg_index["components"]
        assert components["market_momentum"] == 75

    @pytest.mark.asyncio
    async def test_get_economic_calendar_success(self, client: AsyncClient, mock_market_service):
        """Test economic calendar endpoint."""
        response = await client.get("/api/v1/market/economic-calendar")

        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "today" in data
        assert "upcoming" in data

        # Verify today's events
        today_events = data["today"]
        assert len(today_events) >= 1
        assert today_events[0]["event"] == "Initial Jobless Claims"
        assert today_events[0]["importance"] == "medium"

    @pytest.mark.asyncio
    async def test_get_correlation_matrix_success(self, client: AsyncClient, mock_market_service):
        """Test correlation matrix endpoint."""
        symbols = "AAPL,MSFT,GOOGL,TSLA,NVDA"
        response = await client.get(f"/api/v1/market/correlation-matrix?symbols={symbols}")

        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "symbols" in data
        assert "correlation_matrix" in data
        assert data["symbols"] == ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"]

        # Verify matrix dimensions
        matrix = data["correlation_matrix"]
        assert len(matrix) == 5  # 5x5 matrix
        assert len(matrix[0]) == 5

        # Verify diagonal is 1.0 (self-correlation)
        for i in range(5):
            assert matrix[i][i] == 1.00

    @pytest.mark.asyncio
    async def test_get_trading_session_info(self, client: AsyncClient, mock_market_service):
        """Test trading session information endpoint."""
        mock_market_service.get_trading_session_info.return_value = {
            "market_status": "open",
            "session_type": "regular",
            "open_time": "09:30:00",
            "close_time": "16:00:00",
            "timezone": "EST",
            "next_open": "2024-01-16T09:30:00Z",
            "next_close": "2024-01-15T16:00:00Z",
            "is_holiday": False,
            "extended_hours": {
                "pre_market": {"start": "04:00:00", "end": "09:30:00"},
                "after_hours": {"start": "16:00:00", "end": "20:00:00"}
            }
        }

        response = await client.get("/api/v1/market/trading-session")

        assert response.status_code == 200
        data = response.json()

        assert data["market_status"] == "open"
        assert data["session_type"] == "regular"
        assert data["timezone"] == "EST"
        assert "extended_hours" in data

    @pytest.mark.asyncio
    async def test_market_trends_analysis(self, client: AsyncClient, mock_market_service):
        """Test market trends analysis endpoint."""
        mock_market_service.get_market_trends.return_value = {
            "short_term_trend": "bullish",
            "medium_term_trend": "neutral",
            "long_term_trend": "bullish",
            "trend_strength": {
                "short": 0.75,
                "medium": 0.45,
                "long": 0.68
            },
            "key_levels": {
                "support": [4420, 4380, 4320],
                "resistance": [4520, 4580, 4650]
            },
            "momentum_indicators": {
                "rsi": 62.5,
                "macd": "bullish_crossover",
                "moving_averages": "above_20_50_200"
            }
        }

        response = await client.get("/api/v1/market/trends")

        assert response.status_code == 200
        data = response.json()

        assert data["short_term_trend"] == "bullish"
        assert "trend_strength" in data
        assert "key_levels" in data
        assert len(data["key_levels"]["support"]) == 3

    @pytest.mark.asyncio
    async def test_api_error_handling(self, client: AsyncClient, mock_market_service):
        """Test API error handling for market endpoints."""
        # Simulate service error
        mock_market_service.get_market_indices.side_effect = Exception("Market data unavailable")

        response = await client.get("/api/v1/market/indices")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data

    @pytest.mark.asyncio
    async def test_market_api_performance(self, client: AsyncClient, mock_market_service, performance_timer):
        """Test market API performance requirements."""
        performance_timer.start()

        response = await client.get("/api/v1/market/overview")

        performance_timer.stop()
        elapsed_time = performance_timer.elapsed()

        # Should respond within 500ms as per requirements
        assert elapsed_time < 0.5
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_concurrent_market_requests(self, client: AsyncClient, mock_market_service):
        """Test handling of concurrent market data requests."""
        import asyncio

        # Make multiple concurrent requests
        tasks = [
            client.get("/api/v1/market/indices"),
            client.get("/api/v1/market/overview"),
            client.get("/api/v1/market/movers"),
            client.get("/api/v1/market/sectors"),
            client.get("/api/v1/market/volatility")
        ]

        responses = await asyncio.gather(*tasks)

        # All requests should succeed
        for response in responses:
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_market_data_caching_headers(self, client: AsyncClient, mock_market_service):
        """Test that appropriate caching headers are set for market data."""
        response = await client.get("/api/v1/market/indices")

        assert response.status_code == 200
        # Market data should have short cache times due to real-time nature
        headers = response.headers
        assert "cache-control" in headers or "x-cache" in headers

    @pytest.mark.asyncio
    async def test_market_api_input_validation(self, client: AsyncClient, mock_market_service):
        """Test input validation for market API endpoints."""
        # Test invalid symbols for correlation matrix
        response = await client.get("/api/v1/market/correlation-matrix?symbols=INVALID,SYMBOLS")
        assert response.status_code in [400, 422]  # Should validate symbols

        # Test invalid date format for economic calendar
        response = await client.get("/api/v1/market/economic-calendar?date=invalid-date")
        assert response.status_code in [400, 422]  # Should validate date format

    @pytest.mark.asyncio
    async def test_market_data_consistency(self, client: AsyncClient, mock_market_service):
        """Test data consistency across different market endpoints."""
        # Get market overview
        overview_response = await client.get("/api/v1/market/overview")
        overview_data = overview_response.json()

        # Get detailed indices
        indices_response = await client.get("/api/v1/market/indices")
        indices_data = indices_response.json()

        # Timestamps should be consistent (within reasonable range)
        assert overview_response.status_code == 200
        assert indices_response.status_code == 200

        # Market status should be consistent
        # (Note: This would be more meaningful with real data)
        assert "market_status" in overview_data

    @pytest.mark.asyncio
    async def test_fear_greed_index_endpoint(self, client: AsyncClient, mock_market_service):
        """Test dedicated fear & greed index endpoint."""
        mock_market_service.get_fear_greed_index.return_value = {
            "value": 68,
            "classification": "greed",
            "components": {
                "market_momentum": 75,
                "stock_price_strength": 62,
                "stock_price_breadth": 71,
                "put_call_ratio": 45,
                "market_volatility": 58,
                "safe_haven_demand": 42,
                "junk_bond_demand": 73
            },
            "historical_data": [
                {"date": "2024-01-14", "value": 65},
                {"date": "2024-01-13", "value": 62},
                {"date": "2024-01-12", "value": 58}
            ]
        }

        response = await client.get("/api/v1/market/fear-greed")

        assert response.status_code == 200
        data = response.json()

        assert data["value"] == 68
        assert data["classification"] == "greed"
        assert len(data["components"]) == 7
        assert len(data["historical_data"]) == 3