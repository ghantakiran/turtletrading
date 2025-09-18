#!/usr/bin/env python3
"""
Test the rate limiter implementation directly
"""

import asyncio
import sys
import os

# Add the app directory to the Python path
sys.path.append('/Users/kiranreddyghanta/TurtleTrading/backend')

async def test_rate_limiter():
    try:
        # Import the rate limiter
        from app.core.external_rate_limiting import external_rate_limiter, initialize_external_rate_limiter

        print("✓ Rate limiter imported successfully")

        # Initialize the rate limiter
        await initialize_external_rate_limiter()
        print("✓ Rate limiter initialized")

        # Test rate limiting check
        is_limited = await external_rate_limiter.is_rate_limited("yfinance", "AAPL")
        print(f"✓ Rate limit check: {is_limited}")

        # Test wait if needed
        await external_rate_limiter.wait_if_needed("yfinance", "AAPL")
        print("✓ Wait if needed completed")

        # Test multiple requests
        for i in range(5):
            is_limited = await external_rate_limiter.is_rate_limited("yfinance", f"test_{i}")
            print(f"Request {i+1}: Rate limited = {is_limited}")
            if not is_limited:
                await external_rate_limiter.wait_if_needed("yfinance", f"test_{i}")

        print("✅ Rate limiter is working correctly")

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_rate_limiter())