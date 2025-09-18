#!/usr/bin/env python3
"""
Test yfinance directly to see if the issue is with the library
"""

import sys
import traceback

try:
    import yfinance as yf
    print("✓ yfinance imported successfully")

    # Test basic functionality
    ticker = yf.Ticker("AAPL")
    print("✓ Ticker object created")

    # Test history
    hist = ticker.history(period="2d", interval="1d")
    print(f"✓ History data fetched: {len(hist)} rows")
    print(f"Latest close: {hist['Close'].iloc[-1]:.2f}")

    # Test info
    info = ticker.info
    print(f"✓ Info data fetched: {info.get('symbol', 'N/A')}")

except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Error: {e}")
    print("Traceback:")
    traceback.print_exc()
    sys.exit(1)

print("✅ yfinance is working correctly")