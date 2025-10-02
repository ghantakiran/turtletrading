"""
Simple integration test for Issue #4 without complex fixtures
Tests the actual API endpoint functionality
"""

import pytest
import httpx
import asyncio


@pytest.mark.asyncio
async def test_stock_analysis_endpoint_simple():
    """Simple test that the analysis endpoint works"""

    # Test with a simple HTTP client
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=30.0) as client:
        try:
            # Test health endpoint first
            health_response = await client.get("/health")
            print(f"Health check: {health_response.status_code}")

            # Test stock price endpoint
            price_response = await client.get("/api/v1/stocks/AAPL/price")
            print(f"Price endpoint: {price_response.status_code}")

            if price_response.status_code == 200:
                price_data = price_response.json()
                print(f"Price data: {price_data}")

            # Test stock analysis endpoint (the one from Issue #4)
            analysis_response = await client.get("/api/v1/stocks/AAPL/analysis")
            print(f"Analysis endpoint: {analysis_response.status_code}")

            if analysis_response.status_code == 200:
                data = analysis_response.json()
                print(f"Analysis data keys: {data.keys()}")

                # Verify required fields
                assert "symbol" in data
                assert data["symbol"] == "AAPL"
                assert "price" in data
                assert "timestamp" in data

                print("✅ Test PASSED: Analysis endpoint works correctly")
            else:
                print(f"❌ Analysis failed with status {analysis_response.status_code}")
                print(f"Response: {analysis_response.text}")
                pytest.fail(f"Analysis endpoint returned {analysis_response.status_code}")

        except httpx.ConnectError:
            pytest.skip("Backend server not running on localhost:8000")


if __name__ == "__main__":
    # Run the test directly
    asyncio.run(test_stock_analysis_endpoint_simple())
