#!/usr/bin/env python3
"""
Comprehensive Rate Limiting Test Script for TurtleTrading Backend
Tests external API rate limiting implementation
"""

import asyncio
import aiohttp
import time
import json
from typing import List, Dict, Any
from datetime import datetime


class RateLimitTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        self.test_results = []

    async def setup(self):
        """Initialize test session"""
        self.session = aiohttp.ClientSession()

    async def cleanup(self):
        """Clean up test session"""
        if self.session:
            await self.session.close()

    async def make_request(self, endpoint: str, description: str = "") -> Dict[str, Any]:
        """Make a single HTTP request and measure timing"""
        url = f"{self.base_url}{endpoint}"
        start_time = time.time()

        try:
            async with self.session.get(url) as response:
                end_time = time.time()
                response_time = (end_time - start_time) * 1000  # Convert to milliseconds

                content = await response.text()
                if response.headers.get('content-type', '').startswith('application/json'):
                    try:
                        data = json.loads(content)
                    except json.JSONDecodeError:
                        data = {"raw_content": content}
                else:
                    data = {"raw_content": content}

                result = {
                    "endpoint": endpoint,
                    "description": description,
                    "status_code": response.status,
                    "response_time_ms": round(response_time, 2),
                    "timestamp": datetime.utcnow().isoformat(),
                    "headers": dict(response.headers),
                    "data": data,
                    "success": 200 <= response.status < 300
                }

                print(f"✓ {description}: {response.status} ({response_time:.0f}ms)")
                return result

        except Exception as e:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000

            result = {
                "endpoint": endpoint,
                "description": description,
                "status_code": 0,
                "response_time_ms": round(response_time, 2),
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "success": False
            }

            print(f"✗ {description}: ERROR - {str(e)}")
            return result

    async def test_rate_limit_stats(self) -> Dict[str, Any]:
        """Test the rate limiting stats endpoint"""
        print("\n=== Testing Rate Limit Stats Endpoint ===")

        result = await self.make_request(
            "/api/v1/stocks/rate-limit-stats",
            "Rate limit stats endpoint"
        )

        # Analyze the response
        if result["success"] and "data" in result:
            data = result["data"]
            if "yfinance" in data and "alpha_vantage" in data:
                print(f"✓ yfinance config: {data['yfinance'].get('config', 'N/A')}")
                print(f"✓ alpha_vantage config: {data['alpha_vantage'].get('config', 'N/A')}")
                print(f"✓ Redis available: {data['yfinance'].get('redis_available', 'N/A')}")

        return result

    async def test_single_stock_price(self, symbol: str = "AAPL") -> Dict[str, Any]:
        """Test a single stock price request"""
        print(f"\n=== Testing Stock Price Endpoint ({symbol}) ===")

        result = await self.make_request(
            f"/api/v1/stocks/{symbol}/price",
            f"Stock price for {symbol}"
        )

        # Analyze the response
        if result["success"] and "data" in result:
            data = result["data"]
            if "current_price" in data and "symbol" in data:
                print(f"✓ Price: ${data['current_price']}")
                print(f"✓ Change: {data.get('change', 'N/A')}%")

        return result

    async def test_technical_indicators(self, symbol: str = "AAPL") -> Dict[str, Any]:
        """Test technical indicators endpoint"""
        print(f"\n=== Testing Technical Indicators Endpoint ({symbol}) ===")

        result = await self.make_request(
            f"/api/v1/stocks/{symbol}/technical",
            f"Technical indicators for {symbol}"
        )

        # Analyze the response
        if result["success"] and "data" in result:
            data = result["data"]
            if "rsi" in data and "technical_score" in data:
                print(f"✓ RSI: {data['rsi'].get('value', 'N/A')}")
                print(f"✓ Technical Score: {data.get('technical_score', 'N/A')}")
                print(f"✓ Recommendation: {data.get('recommendation', 'N/A')}")

        return result

    async def test_rapid_fire_requests(self, count: int = 20, symbol: str = "AAPL") -> List[Dict[str, Any]]:
        """Test multiple rapid requests to observe rate limiting"""
        print(f"\n=== Testing Rapid Fire Requests ({count} requests) ===")

        tasks = []
        for i in range(count):
            endpoint = f"/api/v1/stocks/{symbol}/price"
            task = self.make_request(endpoint, f"Rapid request {i+1}/{count}")
            tasks.append(task)

        # Execute all requests concurrently
        results = await asyncio.gather(*tasks)

        # Analyze timing patterns
        response_times = [r["response_time_ms"] for r in results if r["success"]]
        successful_requests = sum(1 for r in results if r["success"])

        if response_times:
            avg_time = sum(response_times) / len(response_times)
            min_time = min(response_times)
            max_time = max(response_times)

            print(f"✓ Successful requests: {successful_requests}/{count}")
            print(f"✓ Response time - Avg: {avg_time:.0f}ms, Min: {min_time:.0f}ms, Max: {max_time:.0f}ms")

            # Check for rate limiting evidence
            if max_time > avg_time * 3:
                print(f"⚠ Rate limiting detected: Max response time ({max_time:.0f}ms) significantly higher than average")
            else:
                print(f"✓ No obvious rate limiting detected in response times")

        return results

    async def test_different_endpoints_concurrently(self, symbol: str = "AAPL") -> List[Dict[str, Any]]:
        """Test different endpoints concurrently to stress test rate limiting"""
        print(f"\n=== Testing Multiple Endpoints Concurrently ({symbol}) ===")

        endpoints = [
            (f"/api/v1/stocks/{symbol}/price", "Price endpoint"),
            (f"/api/v1/stocks/{symbol}/technical", "Technical indicators"),
            (f"/api/v1/stocks/{symbol}/lstm", "LSTM prediction"),
            (f"/api/v1/stocks/{symbol}/history", "Price history"),
            ("/api/v1/stocks/rate-limit-stats", "Rate limit stats")
        ]

        tasks = []
        for endpoint, description in endpoints:
            task = self.make_request(endpoint, description)
            tasks.append(task)

        results = await asyncio.gather(*tasks)

        successful_requests = sum(1 for r in results if r["success"])
        print(f"✓ Successful concurrent requests: {successful_requests}/{len(endpoints)}")

        return results

    async def test_burst_and_cooldown(self, symbol: str = "AAPL") -> Dict[str, Any]:
        """Test burst requests followed by cooldown period"""
        print(f"\n=== Testing Burst and Cooldown Pattern ({symbol}) ===")

        # First burst of requests
        print("Phase 1: Burst requests")
        burst_tasks = []
        for i in range(15):  # Exceed burst limit of 10
            task = self.make_request(
                f"/api/v1/stocks/{symbol}/price",
                f"Burst request {i+1}/15"
            )
            burst_tasks.append(task)

        burst_results = await asyncio.gather(*burst_tasks)
        burst_success = sum(1 for r in burst_results if r["success"])

        print(f"Burst phase: {burst_success}/15 successful")

        # Wait for cooldown (rate limiter has 1s cooldown)
        print("Phase 2: Cooldown period (3 seconds)")
        await asyncio.sleep(3)

        # Test after cooldown
        print("Phase 3: Post-cooldown requests")
        cooldown_result = await self.make_request(
            f"/api/v1/stocks/{symbol}/price",
            "Post-cooldown request"
        )

        return {
            "burst_results": burst_results,
            "burst_success_rate": burst_success / 15,
            "cooldown_result": cooldown_result,
            "cooldown_successful": cooldown_result["success"]
        }

    async def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run all rate limiting tests"""
        print("🚀 Starting Comprehensive Rate Limiting Test Suite")
        print("=" * 60)

        await self.setup()

        try:
            test_results = {}

            # Test 1: Rate limit stats endpoint
            test_results["rate_limit_stats"] = await self.test_rate_limit_stats()

            # Test 2: Single stock price request
            test_results["single_stock_price"] = await self.test_single_stock_price()

            # Test 3: Technical indicators
            test_results["technical_indicators"] = await self.test_technical_indicators()

            # Test 4: Rapid fire requests
            test_results["rapid_fire"] = await self.test_rapid_fire_requests()

            # Test 5: Concurrent different endpoints
            test_results["concurrent_endpoints"] = await self.test_different_endpoints_concurrently()

            # Test 6: Burst and cooldown pattern
            test_results["burst_and_cooldown"] = await self.test_burst_and_cooldown()

            return test_results

        finally:
            await self.cleanup()

    def analyze_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze test results and generate report"""
        analysis = {
            "overall_success": True,
            "rate_limiting_working": False,
            "performance_acceptable": True,
            "issues": [],
            "recommendations": []
        }

        # Check if rate limit stats endpoint works
        if results.get("rate_limit_stats", {}).get("success"):
            analysis["rate_limit_endpoint_working"] = True
        else:
            analysis["overall_success"] = False
            analysis["issues"].append("Rate limit stats endpoint not working")

        # Check response times
        all_response_times = []
        for test_name, test_result in results.items():
            if isinstance(test_result, list):
                all_response_times.extend([r["response_time_ms"] for r in test_result if "response_time_ms" in r])
            elif isinstance(test_result, dict) and "response_time_ms" in test_result:
                all_response_times.append(test_result["response_time_ms"])

        if all_response_times:
            avg_response_time = sum(all_response_times) / len(all_response_times)
            max_response_time = max(all_response_times)

            analysis["avg_response_time_ms"] = avg_response_time
            analysis["max_response_time_ms"] = max_response_time

            if avg_response_time > 5000:  # 5 seconds
                analysis["performance_acceptable"] = False
                analysis["issues"].append(f"High average response time: {avg_response_time:.0f}ms")

            # Check for rate limiting evidence
            if max_response_time > avg_response_time * 5:
                analysis["rate_limiting_working"] = True
                analysis["recommendations"].append("Rate limiting appears to be working - significant delays observed")
            else:
                analysis["recommendations"].append("Consider testing with higher request volumes to verify rate limiting")

        # Check burst pattern results
        if "burst_and_cooldown" in results:
            burst_data = results["burst_and_cooldown"]
            if burst_data.get("burst_success_rate", 1) < 0.8:  # Less than 80% success
                analysis["rate_limiting_working"] = True
                analysis["recommendations"].append("Burst rate limiting appears effective")

        return analysis


async def main():
    """Main test function"""
    tester = RateLimitTester()

    try:
        results = await tester.run_comprehensive_test()
        analysis = tester.analyze_results(results)

        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)

        print(f"Overall Success: {'✓' if analysis['overall_success'] else '✗'}")
        print(f"Rate Limiting Working: {'✓' if analysis['rate_limiting_working'] else '?'}")
        print(f"Performance Acceptable: {'✓' if analysis['performance_acceptable'] else '✗'}")

        if "avg_response_time_ms" in analysis:
            print(f"Average Response Time: {analysis['avg_response_time_ms']:.0f}ms")
            print(f"Maximum Response Time: {analysis['max_response_time_ms']:.0f}ms")

        if analysis["issues"]:
            print(f"\n⚠ Issues Found ({len(analysis['issues'])}):")
            for issue in analysis["issues"]:
                print(f"  - {issue}")

        if analysis["recommendations"]:
            print(f"\n💡 Recommendations ({len(analysis['recommendations'])}):")
            for rec in analysis["recommendations"]:
                print(f"  - {rec}")

        print("\n" + "=" * 60)
        print("✅ Rate Limiting Test Suite Completed")

        return analysis

    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        return {"error": str(e)}


if __name__ == "__main__":
    asyncio.run(main())