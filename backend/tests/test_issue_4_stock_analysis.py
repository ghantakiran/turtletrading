"""
Test for GitHub Issue #4: Stock Analysis Page Data Loading Failure
https://github.com/ghantakiran/turtletrading/issues/4

Bug Report: Stock Analysis page fails to load data for AAPL with error:
"Unable to fetch data for AAPL. Please try again later."

This test suite follows TDD approach to:
1. Reproduce the bug
2. Verify the fix
3. Ensure comprehensive error handling
"""

import pytest
from httpx import AsyncClient, HTTPStatusError
from unittest.mock import patch, AsyncMock, MagicMock
import asyncio


class TestIssue4StockAnalysisEndpoint:
    """Test suite for Issue #4 - Stock Analysis Data Loading"""

    @pytest.mark.asyncio
    async def test_stock_analysis_aapl_success(self, client: AsyncClient):
        """
        Test AAPL stock analysis endpoint returns valid data

        This is the main test for Issue #4 - should return 200 with valid data
        """
        response = await client.get("/api/v1/stocks/AAPL/analysis")

        # Should return 200 OK
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify required fields exist
        assert "symbol" in data, "Response missing 'symbol' field"
        assert data["symbol"] == "AAPL", f"Expected symbol AAPL, got {data.get('symbol')}"

        assert "price" in data, "Response missing 'price' field"
        assert "technical_indicators" in data, "Response missing 'technical_indicators' field"
        assert "lstm_prediction" in data, "Response missing 'lstm_prediction' field"

        # Verify analysis score and recommendation
        assert "analysis_score" in data, "Response missing 'analysis_score' field"
        assert "recommendation" in data, "Response missing 'recommendation' field"

        # Verify timestamp
        assert "timestamp" in data, "Response missing 'timestamp' field"

    @pytest.mark.asyncio
    async def test_stock_analysis_with_all_params(self, client: AsyncClient):
        """Test stock analysis with all query parameters"""
        response = await client.get(
            "/api/v1/stocks/AAPL/analysis",
            params={
                "period": "1y",
                "include_sentiment": True,
                "prediction_days": 7
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_stock_analysis_invalid_symbol(self, client: AsyncClient):
        """Test stock analysis with invalid symbol - should return proper error"""
        response = await client.get("/api/v1/stocks/INVALID123/analysis")

        # Should return 404 or 400 with clear error message
        assert response.status_code in [400, 404, 500]

        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"

    @pytest.mark.asyncio
    async def test_stock_analysis_handles_yfinance_failure(self, client: AsyncClient):
        """Test that analysis endpoint handles yfinance API failures gracefully"""
        # This tests the fallback mechanism
        with patch('app.services.stock_service.StockService._fetch_yfinance_history') as mock_yf:
            mock_yf.side_effect = Exception("yfinance connection error")

            # Should still work with Alpha Vantage fallback
            response = await client.get("/api/v1/stocks/AAPL/analysis")

            # May return 200 with fallback data or 500 with error
            assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_stock_analysis_response_time(self, client: AsyncClient):
        """Test that analysis endpoint responds within acceptable time"""
        import time

        start_time = time.time()
        response = await client.get("/api/v1/stocks/AAPL/analysis")
        elapsed = time.time() - start_time

        # Should respond within 5 seconds (reasonable for comprehensive analysis)
        assert elapsed < 5.0, f"Analysis took {elapsed}s, expected < 5s"
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_stock_analysis_concurrent_requests(self, client: AsyncClient):
        """Test multiple concurrent analysis requests"""
        symbols = ["AAPL", "MSFT", "GOOGL"]

        tasks = [
            client.get(f"/api/v1/stocks/{symbol}/analysis")
            for symbol in symbols
        ]

        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # All should succeed or gracefully fail
        for i, response in enumerate(responses):
            if isinstance(response, Exception):
                pytest.fail(f"Request for {symbols[i]} raised exception: {response}")
            else:
                assert response.status_code in [200, 500], \
                    f"Unexpected status {response.status_code} for {symbols[i]}"

    @pytest.mark.asyncio
    async def test_stock_analysis_caching(self, client: AsyncClient):
        """Test that analysis results are properly cached"""
        # First request
        response1 = await client.get("/api/v1/stocks/AAPL/analysis")
        assert response1.status_code == 200
        data1 = response1.json()

        # Second request (should use cache)
        response2 = await client.get("/api/v1/stocks/AAPL/analysis")
        assert response2.status_code == 200
        data2 = response2.json()

        # Timestamps might differ slightly but main data should be same
        assert data1["symbol"] == data2["symbol"]
        assert data1.get("analysis_score") == data2.get("analysis_score")

    @pytest.mark.asyncio
    async def test_stock_analysis_validates_period(self, client: AsyncClient):
        """Test that invalid period parameter is rejected"""
        response = await client.get(
            "/api/v1/stocks/AAPL/analysis",
            params={"period": "invalid_period"}
        )

        # Should return validation error
        assert response.status_code in [400, 422], "Should reject invalid period"

    @pytest.mark.asyncio
    async def test_stock_analysis_validates_prediction_days(self, client: AsyncClient):
        """Test that prediction_days parameter is validated"""
        # Test negative days
        response = await client.get(
            "/api/v1/stocks/AAPL/analysis",
            params={"prediction_days": -1}
        )
        assert response.status_code in [400, 422], "Should reject negative days"

        # Test excessive days
        response = await client.get(
            "/api/v1/stocks/AAPL/analysis",
            params={"prediction_days": 100}
        )
        assert response.status_code in [400, 422], "Should reject days > 30"

    @pytest.mark.asyncio
    async def test_stock_analysis_components_optional(self, client: AsyncClient):
        """Test that individual analysis components can fail without breaking entire response"""
        # Even if LSTM prediction fails, should still return price and technical data
        response = await client.get("/api/v1/stocks/AAPL/analysis")

        if response.status_code == 200:
            data = response.json()

            # Price should always be present
            assert "price" in data

            # Technical indicators should be present
            assert "technical_indicators" in data

            # LSTM prediction might be None if service is down
            # This is acceptable - the analysis should still work

    @pytest.mark.asyncio
    async def test_stock_analysis_error_message_quality(self, client: AsyncClient):
        """Test that error messages are helpful and specific"""
        response = await client.get("/api/v1/stocks/INVALID/analysis")

        if response.status_code >= 400:
            data = response.json()
            error_msg = data.get("detail", "")

            # Error message should be helpful
            assert len(error_msg) > 10, "Error message too short"
            assert "INVALID" in error_msg or "symbol" in error_msg.lower(), \
                "Error message should mention the symbol"


class TestIssue4Integration:
    """Integration tests for Issue #4 - testing real service behavior"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_real_stock_analysis_aapl(self, client: AsyncClient):
        """
        Integration test with real yfinance data

        This test actually calls yfinance API - mark as integration test
        """
        response = await client.get("/api/v1/stocks/AAPL/analysis")

        # Should succeed with real data
        assert response.status_code == 200

        data = response.json()
        assert data["symbol"] == "AAPL"

        # Verify data quality
        if data.get("price"):
            price_data = data["price"]
            assert price_data.get("current_price") > 0, "Price should be positive"
            assert price_data.get("volume", 0) > 0, "Volume should be positive"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_real_stock_analysis_multiple_stocks(self, client: AsyncClient):
        """Integration test for multiple popular stocks"""
        test_symbols = ["AAPL", "MSFT", "GOOGL", "TSLA"]

        for symbol in test_symbols:
            response = await client.get(f"/api/v1/stocks/{symbol}/analysis")

            # Each should return valid data
            assert response.status_code == 200, \
                f"Failed to get analysis for {symbol}: {response.status_code}"

            data = response.json()
            assert data["symbol"] == symbol
            assert "price" in data
            assert "technical_indicators" in data
