#!/usr/bin/env python3
"""
Simple test to debug API endpoints
"""

import requests
import json

def test_endpoints():
    base_url = "http://localhost:8000"

    print("Testing rate limit stats endpoint:")
    try:
        response = requests.get(f"{base_url}/api/v1/stocks/rate-limit-stats")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {json.dumps(response.json(), indent=2)}")
        else:
            print(f"Error response: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

    print("\n" + "="*50)
    print("Testing stock price endpoint:")
    try:
        response = requests.get(f"{base_url}/api/v1/stocks/AAPL/price")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {json.dumps(response.json(), indent=2)}")
        else:
            print(f"Error response: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

    print("\n" + "="*50)
    print("Testing available stocks endpoint:")
    try:
        response = requests.get(f"{base_url}/api/v1/stocks/")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {json.dumps(response.json(), indent=2)}")
        else:
            print(f"Error response: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_endpoints()