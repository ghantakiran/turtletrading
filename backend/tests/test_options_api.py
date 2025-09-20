"""
Integration tests for Options Analytics API endpoints

Tests the full API stack including request validation, service integration,
and response formatting for all options analytics endpoints.
"""

import pytest
import httpx
from fastapi.testclient import TestClient
from datetime import date, datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

from app.main import app
from app.models.options_models import (
    OptionType, ExerciseStyle, PricingModel, VolatilityMethod,
    OptionPricingInput, ImpliedVolatilityRequest
)


class TestOptionsAnalyticsAPI:
    """Test options analytics API endpoints"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)

    @pytest.fixture
    def mock_options_service(self):
        """Mock options analytics service"""
        with patch('app.core.dependencies.get_options_service') as mock:
            service = Mock()
            service.get_options_analytics = AsyncMock()
            service.data_provider.fetch_options_chain = AsyncMock()
            service.price_option = AsyncMock()
            service.calculate_implied_volatility = AsyncMock()
            service._calculate_volatility_surface = AsyncMock()
            service.risk_free_rate = 0.05
            service.dividend_yield = 0.02
            mock.return_value = service
            yield service

    def test_get_options_analytics_success(self, client, mock_options_service):
        """Test successful options analytics retrieval"""
        # Mock response
        mock_response = {
            "symbol": "AAPL",
            "spot_price": 150.0,
            "calculation_time": datetime.now().isoformat(),
            "chains": [],
            "total_volume": 1000,
            "total_open_interest": 5000,
            "put_call_ratio": 0.8
        }
        mock_options_service.get_options_analytics.return_value = mock_response

        response = client.get("/api/v1/options/AAPL/analytics")

        assert response.status_code == 200
        data = response.json()
        assert data["symbol"] == "AAPL"
        assert data["spot_price"] == 150.0
        assert "calculation_time" in data

    def test_get_options_analytics_with_parameters(self, client, mock_options_service):
        """Test options analytics with query parameters"""
        mock_options_service.get_options_analytics.return_value = {
            "symbol": "AAPL",
            "spot_price": 150.0,
            "calculation_time": datetime.now().isoformat(),
            "chains": [],
            "total_volume": 1000,
            "total_open_interest": 5000,
            "put_call_ratio": 0.8
        }

        response = client.get(
            "/api/v1/options/AAPL/analytics"
            "?expiry=2024-12-20"
            "&strike=150.0"
            "&option_type=CALL"
            "&calculate_greeks=true"
            "&include_surface=true"
            "&pricing_model=BLACK_SCHOLES"
        )

        assert response.status_code == 200

        # Verify service was called with correct parameters
        call_args = mock_options_service.get_options_analytics.call_args[0][0]
        assert call_args.symbol == "AAPL"
        assert call_args.strike == 150.0
        assert call_args.option_type == OptionType.CALL
        assert call_args.calculate_greeks == True
        assert call_args.include_surface == True
        assert call_args.pricing_model == PricingModel.BLACK_SCHOLES

    def test_get_options_chain_success(self, client, mock_options_service):
        """Test successful options chain retrieval"""
        # Mock chain data
        mock_chains = [
            {
                "symbol": "AAPL",
                "expiry_date": "2024-12-20",
                "spot_price": 150.0,
                "calls": [],
                "puts": [],
                "total_call_volume": 500,
                "total_put_volume": 400,
                "put_call_ratio": 0.8
            }
        ]
        mock_options_service.data_provider.fetch_options_chain.return_value = mock_chains

        response = client.get("/api/v1/options/AAPL/chain")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["symbol"] == "AAPL"

    def test_get_options_chain_not_found(self, client, mock_options_service):
        """Test options chain not found"""
        mock_options_service.data_provider.fetch_options_chain.return_value = []

        response = client.get("/api/v1/options/INVALID/chain")

        assert response.status_code == 404
        assert "No options data found" in response.json()["detail"]

    def test_price_option_success(self, client, mock_options_service):
        """Test successful option pricing"""
        # Mock pricing result
        mock_result = {
            "price": 5.25,
            "greeks": {
                "delta": 0.6,
                "gamma": 0.03,
                "theta": -0.02,
                "vega": 0.15,
                "rho": 0.08
            },
            "model_used": "BLACK_SCHOLES",
            "intrinsic_value": 0.0,
            "time_value": 5.25,
            "calculation_time_ms": 1.5,
            "convergence_achieved": True
        }
        mock_options_service.price_option.return_value = mock_result

        pricing_request = {
            "spot_price": 150.0,
            "strike_price": 155.0,
            "time_to_expiry": 0.25,
            "risk_free_rate": 0.05,
            "volatility": 0.25,
            "option_type": "CALL",
            "exercise_style": "EUROPEAN"
        }

        response = client.post("/api/v1/options/AAPL/price", json=pricing_request)

        assert response.status_code == 200
        data = response.json()
        assert data["price"] == 5.25
        assert data["greeks"]["delta"] == 0.6
        assert data["model_used"] == "BLACK_SCHOLES"

    def test_price_option_invalid_input(self, client, mock_options_service):
        """Test option pricing with invalid input"""
        invalid_request = {
            "spot_price": -100.0,  # Invalid negative price
            "strike_price": 155.0,
            "time_to_expiry": 0.25,
            "risk_free_rate": 0.05,
            "volatility": 0.25,
            "option_type": "CALL",
            "exercise_style": "EUROPEAN"
        }

        response = client.post("/api/v1/options/AAPL/price", json=invalid_request)

        assert response.status_code == 422  # Validation error

    def test_calculate_implied_volatility_success(self, client, mock_options_service):
        """Test successful implied volatility calculation"""
        mock_result = {
            "implied_volatility": 0.247,
            "iterations_used": 5,
            "convergence_achieved": True,
            "final_price": 5.25,
            "price_error": 0.001,
            "calculation_time_ms": 2.3
        }
        mock_options_service.calculate_implied_volatility.return_value = mock_result

        iv_request = {
            "market_price": 5.25,
            "spot_price": 150.0,
            "strike_price": 155.0,
            "time_to_expiry": 0.25,
            "risk_free_rate": 0.05,
            "option_type": "CALL",
            "method": "BRENT",
            "tolerance": 1e-6
        }

        response = client.post("/api/v1/options/AAPL/implied-volatility", json=iv_request)

        assert response.status_code == 200
        data = response.json()
        assert data["implied_volatility"] == 0.247
        assert data["convergence_achieved"] == True

    def test_get_volatility_surface_success(self, client, mock_options_service):
        """Test successful volatility surface retrieval"""
        # Mock chains for surface calculation
        mock_chains = [
            {
                "symbol": "AAPL",
                "expiry_date": "2024-12-20",
                "spot_price": 150.0,
                "calls": [],
                "puts": [],
                "total_call_volume": 500,
                "total_put_volume": 400,
                "put_call_ratio": 0.8
            }
        ]
        mock_options_service.data_provider.fetch_options_chain.return_value = mock_chains

        # Mock surface result
        mock_surface = {
            "symbol": "AAPL",
            "calculation_time": datetime.now().isoformat(),
            "spot_price": 150.0,
            "strikes": [140, 145, 150, 155, 160],
            "expiries": ["2024-12-20", "2025-01-17"],
            "implied_volatilities": [[0.2, 0.22, 0.25, 0.22, 0.2], [0.25, 0.27, 0.3, 0.27, 0.25]],
            "atm_term_structure": {"2024-12-20": 0.25, "2025-01-17": 0.3},
            "skew_by_expiry": {"2024-12-20": 0.02, "2025-01-17": 0.02},
            "volatility_of_volatility": 0.15
        }
        mock_options_service._calculate_volatility_surface.return_value = mock_surface

        response = client.get("/api/v1/options/AAPL/volatility-surface")

        assert response.status_code == 200
        data = response.json()
        assert data["symbol"] == "AAPL"
        assert len(data["strikes"]) == 5
        assert len(data["expiries"]) == 2

    def test_get_options_greeks_success(self, client, mock_options_service):
        """Test successful Greeks calculation"""
        mock_analytics_result = {
            "symbol": "AAPL",
            "spot_price": 150.0,
            "calculation_time": datetime.now().isoformat(),
            "chains": [],
            "pricing_results": [
                {
                    "price": 5.25,
                    "greeks": {
                        "delta": 0.6,
                        "gamma": 0.03,
                        "theta": -0.02,
                        "vega": 0.15,
                        "rho": 0.08
                    },
                    "model_used": "BLACK_SCHOLES",
                    "intrinsic_value": 0.0,
                    "time_value": 5.25,
                    "calculation_time_ms": 1.5,
                    "convergence_achieved": True
                }
            ],
            "total_volume": 1000,
            "total_open_interest": 5000,
            "put_call_ratio": 0.8
        }
        mock_options_service.get_options_analytics.return_value = mock_analytics_result

        response = client.get("/api/v1/options/AAPL/greeks")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["greeks"]["delta"] == 0.6

    def test_get_options_greeks_not_found(self, client, mock_options_service):
        """Test Greeks calculation when no options found"""
        mock_analytics_result = {
            "symbol": "AAPL",
            "spot_price": 150.0,
            "calculation_time": datetime.now().isoformat(),
            "chains": [],
            "pricing_results": None,  # No pricing results
            "total_volume": 0,
            "total_open_interest": 0,
            "put_call_ratio": 0
        }
        mock_options_service.get_options_analytics.return_value = mock_analytics_result

        response = client.get("/api/v1/options/INVALID/greeks")

        assert response.status_code == 404
        assert "No options Greeks found" in response.json()["detail"]

    def test_get_available_expiries_success(self, client, mock_options_service):
        """Test successful expiries retrieval"""
        mock_chains = [
            Mock(expiry_date=date(2024, 12, 20)),
            Mock(expiry_date=date(2025, 1, 17)),
            Mock(expiry_date=date(2025, 3, 21))
        ]
        mock_options_service.data_provider.fetch_options_chain.return_value = mock_chains

        response = client.get("/api/v1/options/AAPL/expiries")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert "2024-12-20" in data
        assert "2025-01-17" in data

    def test_get_available_strikes_success(self, client, mock_options_service):
        """Test successful strikes retrieval"""
        # Mock chain with calls and puts
        mock_call1 = Mock(strike=145.0)
        mock_call2 = Mock(strike=150.0)
        mock_put1 = Mock(strike=150.0)
        mock_put2 = Mock(strike=155.0)

        mock_chain = Mock()
        mock_chain.calls = [mock_call1, mock_call2]
        mock_chain.puts = [mock_put1, mock_put2]

        mock_options_service.data_provider.fetch_options_chain.return_value = [mock_chain]

        response = client.get("/api/v1/options/AAPL/strikes")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # Unique strikes: 145, 150, 155
        assert 145.0 in data
        assert 150.0 in data
        assert 155.0 in data

    def test_get_pricing_models(self, client):
        """Test pricing models endpoint"""
        response = client.get("/api/v1/options/models/pricing")

        assert response.status_code == 200
        data = response.json()
        assert "BLACK_SCHOLES" in data
        assert "BINOMIAL_CRR" in data

    def test_get_volatility_methods(self, client):
        """Test volatility methods endpoint"""
        response = client.get("/api/v1/options/models/volatility")

        assert response.status_code == 200
        data = response.json()
        assert "BRENT" in data
        assert "BISECTION" in data
        assert "NEWTON_RAPHSON" in data

    def test_options_health_check(self, client):
        """Test options service health check"""
        response = client.get("/api/v1/options/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "options_analytics"
        assert "models" in data
        assert "features" in data
        assert "black_scholes_pricing" in data["features"]
        assert "greeks_calculation" in data["features"]

    def test_api_error_handling(self, client, mock_options_service):
        """Test API error handling"""
        # Mock service to raise exception
        mock_options_service.get_options_analytics.side_effect = Exception("Service error")

        response = client.get("/api/v1/options/AAPL/analytics")

        assert response.status_code == 500
        assert "Error fetching options analytics" in response.json()["detail"]

    def test_parameter_validation(self, client):
        """Test parameter validation"""
        # Test invalid option type
        response = client.get("/api/v1/options/AAPL/analytics?option_type=INVALID")
        assert response.status_code == 422

        # Test invalid pricing model
        response = client.get("/api/v1/options/AAPL/analytics?pricing_model=INVALID")
        assert response.status_code == 422

        # Test invalid date format
        response = client.get("/api/v1/options/AAPL/analytics?expiry=invalid-date")
        assert response.status_code == 422


class TestOptionsAPIPerformance:
    """Test options API performance characteristics"""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_api_response_headers(self, client):
        """Test that API returns proper headers"""
        with patch('app.core.dependencies.get_options_service') as mock:
            service = Mock()
            service.get_options_analytics = AsyncMock(return_value={
                "symbol": "AAPL",
                "spot_price": 150.0,
                "calculation_time": datetime.now().isoformat(),
                "chains": [],
                "total_volume": 1000,
                "total_open_interest": 5000,
                "put_call_ratio": 0.8
            })
            mock.return_value = service

            response = client.get("/api/v1/options/AAPL/analytics")

            assert response.status_code == 200
            assert "X-Request-ID" in response.headers
            assert "X-Process-Time" in response.headers
            assert "X-API-Version" in response.headers

    def test_concurrent_requests(self, client):
        """Test handling of concurrent requests"""
        import asyncio
        import httpx

        async def make_request(client: httpx.AsyncClient, symbol: str):
            response = await client.get(f"/api/v1/options/{symbol}/analytics")
            return response.status_code

        async def test_concurrent():
            async with httpx.AsyncClient(app=app, base_url="http://test") as async_client:
                with patch('app.core.dependencies.get_options_service') as mock:
                    service = Mock()
                    service.get_options_analytics = AsyncMock(return_value={
                        "symbol": "TEST",
                        "spot_price": 100.0,
                        "calculation_time": datetime.now().isoformat(),
                        "chains": [],
                        "total_volume": 0,
                        "total_open_interest": 0,
                        "put_call_ratio": 0
                    })
                    mock.return_value = service

                    # Make 10 concurrent requests
                    tasks = [make_request(async_client, f"TEST{i}") for i in range(10)]
                    results = await asyncio.gather(*tasks)

                    # All should succeed
                    assert all(status == 200 for status in results)

        asyncio.run(test_concurrent())


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])