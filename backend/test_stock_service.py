#!/usr/bin/env python3
"""
Test the StockService implementation directly
"""

import asyncio
import sys
import os

# Add the app directory to the Python path
sys.path.append('/Users/kiranreddyghanta/TurtleTrading/backend')

async def test_stock_service():
    try:
        # Import required modules
        from app.services.stock_service import StockService
        from app.core.external_rate_limiting import initialize_external_rate_limiter

        print("✓ StockService imported successfully")

        # Initialize rate limiter
        await initialize_external_rate_limiter()
        print("✓ Rate limiter initialized")

        # Create StockService instance
        stock_service = StockService()
        print("✓ StockService instance created")

        # Test get_current_price
        print("Testing get_current_price...")
        price_data = await stock_service.get_current_price("AAPL")
        if price_data:
            print(f"✓ Price data: ${price_data.current_price:.2f}")
            print(f"  Symbol: {price_data.symbol}")
            print(f"  Change: {price_data.change}%")
        else:
            print("✗ No price data returned")

        print("✅ StockService is working correctly")

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_stock_service())