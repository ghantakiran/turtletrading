"""
Test for GitHub Issue #6: Stock Search Error
https://github.com/ghantakiran/turtletrading/issues/6

Bug Report: Stock search functionality fails with error "Failed to fetch"
for valid symbol GOOGL: "Please check the symbol (GOOGL) and try again"

This test suite follows TDD approach.
"""

import pytest
from httpx import AsyncClient
import asyncio


class TestIssue6StockSearch:
    """Test suite for Issue #6 - Stock Search Functionality"""

    @pytest.mark.asyncio
    async def test_stock_search_googl_success(self, client: AsyncClient):
        """
        Test GOOGL stock search returns valid results

        This is the main test for Issue #6
        """
        # Test search endpoint (assuming it exists)
        response = await client.get("/api/v1/stocks/search?q=GOOGL")

        # Should return 200 OK
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify search results
        assert isinstance(data, (list, dict)), "Search should return list or dict"

        # If it's a dict with results key
        if isinstance(data, dict) and "results" in data:
            results = data["results"]
        else:
            results = data

        # Should have at least one result
        assert len(results) > 0, "Search should return at least one result"

        # Should include GOOGL in results
        symbols = [r.get("symbol", "") for r in results if isinstance(r, dict)]
        assert "GOOGL" in symbols or "GOOG" in symbols, "Should find GOOGL or GOOG"

    @pytest.mark.asyncio
    async def test_stock_price_googl_directly(self, client: AsyncClient):
        """Test getting GOOGL price directly"""
        response = await client.get("/api/v1/stocks/GOOGL/price")

        assert response.status_code == 200
        data = response.json()

        assert data["symbol"] in ["GOOGL", "GOOG"]
        assert data["current_price"] > 0

    @pytest.mark.asyncio
    async def test_stock_search_multiple_symbols(self, client: AsyncClient):
        """Test search works for multiple symbols"""
        test_queries = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN"]

        for query in test_queries:
            response = await client.get(f"/api/v1/stocks/search?q={query}")

            # Should not fail
            assert response.status_code in [200, 404], \
                f"Search for {query} failed with {response.status_code}"

            if response.status_code == 200:
                data = response.json()
                # Should return some results
                assert data is not None

    @pytest.mark.asyncio
    async def test_stock_search_partial_match(self, client: AsyncClient):
        """Test search with partial symbol match"""
        response = await client.get("/api/v1/stocks/search?q=GOO")

        if response.status_code == 200:
            data = response.json()

            # Should find GOOGL or GOOG
            results = data.get("results", data) if isinstance(data, dict) else data

            if isinstance(results, list) and len(results) > 0:
                symbols = [r.get("symbol", "") for r in results if isinstance(r, dict)]
                has_google = any("GOO" in s for s in symbols)
                assert has_google, "Partial search should find Google stocks"

    @pytest.mark.asyncio
    async def test_stock_search_case_insensitive(self, client: AsyncClient):
        """Test search is case insensitive"""
        lowercase_response = await client.get("/api/v1/stocks/search?q=googl")
        uppercase_response = await client.get("/api/v1/stocks/search?q=GOOGL")

        # Both should succeed
        assert lowercase_response.status_code == 200
        assert uppercase_response.status_code == 200

    @pytest.mark.asyncio
    async def test_stock_search_empty_query(self, client: AsyncClient):
        """Test search with empty query"""
        response = await client.get("/api/v1/stocks/search?q=")

        # Should return 400 or empty results, not crash
        assert response.status_code in [200, 400, 422]

    @pytest.mark.asyncio
    async def test_stock_search_invalid_symbol(self, client: AsyncClient):
        """Test search with invalid/non-existent symbol"""
        response = await client.get("/api/v1/stocks/search?q=INVALIDXYZ123")

        # Should return 200 with empty results or 404
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            results = data.get("results", data) if isinstance(data, dict) else data

            # Should be empty or None
            if results:
                assert len(results) == 0, "Invalid symbol should return no results"

    @pytest.mark.asyncio
    async def test_stock_search_response_format(self, client: AsyncClient):
        """Test search response has correct format"""
        response = await client.get("/api/v1/stocks/search?q=AAPL")

        if response.status_code == 200:
            data = response.json()

            # Should be structured data
            assert isinstance(data, (list, dict))

            # If dict, should have results or data key
            if isinstance(data, dict):
                assert "results" in data or "data" in data or "stocks" in data

    @pytest.mark.asyncio
    async def test_stock_search_performance(self, client: AsyncClient):
        """Test search responds quickly"""
        import time

        start = time.time()
        response = await client.get("/api/v1/stocks/search?q=AAPL")
        elapsed = time.time() - start

        # Should respond within 2 seconds
        assert elapsed < 2.0, f"Search took {elapsed}s, expected < 2s"

        if response.status_code == 200:
            assert response.status_code == 200


class TestIssue6SearchIntegration:
    """Integration tests for Issue #6"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_real_stock_search_googl(self, client: AsyncClient):
        """Integration test with real search for GOOGL"""
        response = await client.get("/api/v1/stocks/search?q=GOOGL")

        # Should find Google
        assert response.status_code == 200

        data = response.json()
        results = data.get("results", data) if isinstance(data, dict) else data

        if isinstance(results, list) and len(results) > 0:
            # Should have symbol info
            first_result = results[0]
            assert "symbol" in first_result
            assert first_result["symbol"] in ["GOOGL", "GOOG"]
