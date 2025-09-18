#!/usr/bin/env python3
"""
Debug the API endpoints to see what's causing 500 errors
"""

import requests
import json
import time

def debug_api():
    base_url = "http://localhost:8000"

    print("Debugging API endpoints:")
    print("=" * 50)

    endpoints = [
        ("/api/v1/stocks/rate-limit-stats", "Rate limit stats"),
        ("/api/v1/stocks/", "Available stocks"),
        ("/health", "Health check"),
        ("/api/v1/stocks/AAPL/price", "AAPL price"),
        ("/api/v1/stocks/MSFT/price", "MSFT price"),
        ("/api/v1/stocks/AAPL/technical", "AAPL technical"),
    ]

    results = {}

    for endpoint, description in endpoints:
        print(f"\nTesting: {description}")
        print(f"URL: {base_url}{endpoint}")

        try:
            start_time = time.time()
            response = requests.get(f"{base_url}{endpoint}", timeout=30)
            end_time = time.time()
            response_time = (end_time - start_time) * 1000

            result = {
                "status": response.status_code,
                "response_time_ms": round(response_time, 2),
                "headers": dict(response.headers),
                "success": 200 <= response.status_code < 300
            }

            print(f"Status: {response.status_code}")
            print(f"Response time: {response_time:.0f}ms")
            print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")

            if response.status_code == 200:
                try:
                    data = response.json()
                    result["data"] = data
                    if isinstance(data, dict):
                        print(f"Response keys: {list(data.keys())}")
                    elif isinstance(data, list):
                        print(f"Response length: {len(data)}")
                except:
                    result["text"] = response.text[:500]
                    print(f"Raw response: {response.text[:200]}...")
            else:
                result["error_text"] = response.text
                print(f"Error response: {response.text}")

            results[endpoint] = result

        except Exception as e:
            print(f"Exception: {e}")
            results[endpoint] = {"error": str(e)}

    print("\n" + "=" * 50)
    print("SUMMARY:")
    print("=" * 50)

    for endpoint, result in results.items():
        status = "✓" if result.get("success") else "✗"
        status_code = result.get("status", "ERR")
        response_time = result.get("response_time_ms", 0)
        print(f"{status} {endpoint}: {status_code} ({response_time:.0f}ms)")

    return results

if __name__ == "__main__":
    debug_api()