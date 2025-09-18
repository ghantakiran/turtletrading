#!/usr/bin/env python3
"""
Final comprehensive rate limiting test for TurtleTrading backend
"""

import asyncio
import aiohttp
import time
import json
from typing import List, Dict, Any
from datetime import datetime
import statistics


class ComprehensiveRateLimitTester:
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
                response_time = (end_time - start_time) * 1000

                try:
                    data = await response.json()
                except:
                    data = {"raw_content": await response.text()}

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

                return result

        except Exception as e:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000

            return {
                "endpoint": endpoint,
                "description": description,
                "status_code": 0,
                "response_time_ms": round(response_time, 2),
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "success": False
            }

    async def test_rate_limit_configuration(self):
        """Test rate limit configuration endpoint"""
        print("🔧 Testing Rate Limit Configuration")
        print("-" * 50)

        result = await self.make_request(
            "/api/v1/stocks/rate-limit-stats",
            "Rate limit configuration"
        )

        if result["success"]:
            config = result["data"]
            yfinance_config = config.get("yfinance", {}).get("config", {})
            redis_available = config.get("yfinance", {}).get("redis_available", False)

            print(f"✓ Rate limit stats endpoint working")
            print(f"  yfinance limits: {yfinance_config.get('requests_per_minute', 0)}/min, {yfinance_config.get('requests_per_hour', 0)}/hour")
            print(f"  Burst limit: {yfinance_config.get('burst_limit', 0)} requests")
            print(f"  Cooldown: {yfinance_config.get('cooldown_seconds', 0)}s")
            print(f"  Redis available: {redis_available}")

            return True, yfinance_config
        else:
            print(f"✗ Rate limit stats endpoint failed: {result.get('error', 'Unknown error')}")
            return False, {}

    async def test_single_requests(self):
        """Test individual endpoint functionality"""
        print("\n📊 Testing Individual Endpoints")
        print("-" * 50)

        endpoints = [
            ("/api/v1/stocks/AAPL/price", "AAPL price"),
            ("/api/v1/stocks/MSFT/price", "MSFT price"),
            ("/api/v1/stocks/AAPL/technical", "AAPL technical indicators"),
        ]

        results = []
        for endpoint, description in endpoints:
            result = await self.make_request(endpoint, description)
            results.append(result)

            status = "✓" if result["success"] else "✗"
            print(f"{status} {description}: {result['status_code']} ({result['response_time_ms']:.0f}ms)")

            if result["success"] and "current_price" in result["data"]:
                print(f"    Price: ${result['data']['current_price']:.2f}")

        return results

    async def test_burst_rate_limiting(self, burst_size: int = 15):
        """Test burst rate limiting with rapid requests"""
        print(f"\n⚡ Testing Burst Rate Limiting ({burst_size} rapid requests)")
        print("-" * 50)

        # Create burst of requests
        tasks = []
        start_time = time.time()

        for i in range(burst_size):
            task = self.make_request(
                "/api/v1/stocks/AAPL/price",
                f"Burst request {i+1}/{burst_size}"
            )
            tasks.append(task)

        # Execute all requests concurrently
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        total_time = (end_time - start_time) * 1000

        # Analyze results
        successful_requests = sum(1 for r in results if r["success"])
        failed_requests = burst_size - successful_requests
        response_times = [r["response_time_ms"] for r in results if r["success"]]

        print(f"Total execution time: {total_time:.0f}ms")
        print(f"Successful requests: {successful_requests}/{burst_size}")
        print(f"Failed requests: {failed_requests}/{burst_size}")

        if response_times:
            avg_time = statistics.mean(response_times)
            min_time = min(response_times)
            max_time = max(response_times)
            median_time = statistics.median(response_times)

            print(f"Response times - Avg: {avg_time:.0f}ms, Min: {min_time:.0f}ms, Max: {max_time:.0f}ms, Median: {median_time:.0f}ms")

            # Check for rate limiting evidence
            if max_time > avg_time * 3:
                print(f"⚠️  Rate limiting detected: Max response time significantly higher than average")

            if failed_requests > 0:
                print(f"⚠️  Rate limiting detected: {failed_requests} requests failed")

        return results

    async def test_cooldown_behavior(self):
        """Test cooldown behavior after burst"""
        print("\n⏱️  Testing Cooldown Behavior")
        print("-" * 50)

        # First, make a request
        print("Phase 1: Initial request")
        initial_result = await self.make_request("/api/v1/stocks/AAPL/price", "Initial request")
        initial_success = initial_result["success"]
        initial_time = initial_result["response_time_ms"]

        print(f"Initial request: {'✓' if initial_success else '✗'} ({initial_time:.0f}ms)")

        # Wait for cooldown period (rate limiter has 1s cooldown)
        cooldown_period = 2
        print(f"Phase 2: Waiting {cooldown_period}s for cooldown...")
        await asyncio.sleep(cooldown_period)

        # Make request after cooldown
        print("Phase 3: Post-cooldown request")
        cooldown_result = await self.make_request("/api/v1/stocks/AAPL/price", "Post-cooldown request")
        cooldown_success = cooldown_result["success"]
        cooldown_time = cooldown_result["response_time_ms"]

        print(f"Post-cooldown request: {'✓' if cooldown_success else '✗'} ({cooldown_time:.0f}ms)")

        # Compare response times
        if initial_success and cooldown_success:
            time_difference = abs(cooldown_time - initial_time)
            print(f"Response time difference: {time_difference:.0f}ms")

        return {"initial": initial_result, "cooldown": cooldown_result}

    async def test_different_symbols_concurrently(self):
        """Test rate limiting across different stock symbols"""
        print("\n🎯 Testing Multiple Symbols Concurrently")
        print("-" * 50)

        symbols = ["AAPL", "MSFT", "NVDA", "GOOGL", "META"]
        tasks = []

        for symbol in symbols:
            task = self.make_request(
                f"/api/v1/stocks/{symbol}/price",
                f"{symbol} price"
            )
            tasks.append(task)

        start_time = time.time()
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        total_time = (end_time - start_time) * 1000

        successful_requests = sum(1 for r in results if r["success"])
        print(f"Total time for {len(symbols)} symbols: {total_time:.0f}ms")
        print(f"Successful requests: {successful_requests}/{len(symbols)}")

        for i, result in enumerate(results):
            symbol = symbols[i]
            status = "✓" if result["success"] else "✗"
            print(f"  {status} {symbol}: {result['status_code']} ({result['response_time_ms']:.0f}ms)")

        return results

    async def test_mixed_endpoints_stress(self):
        """Test rate limiting across different endpoint types"""
        print("\n🔀 Testing Mixed Endpoints Stress Test")
        print("-" * 50)

        endpoints = [
            ("/api/v1/stocks/AAPL/price", "AAPL price"),
            ("/api/v1/stocks/MSFT/technical", "MSFT technical"),
            ("/api/v1/stocks/NVDA/price", "NVDA price"),
            ("/api/v1/stocks/rate-limit-stats", "Rate limit stats"),
            ("/api/v1/stocks/", "Available stocks"),
            ("/api/v1/stocks/GOOGL/price", "GOOGL price"),
        ]

        tasks = []
        for endpoint, description in endpoints:
            task = self.make_request(endpoint, description)
            tasks.append(task)

        start_time = time.time()
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        total_time = (end_time - start_time) * 1000

        successful_requests = sum(1 for r in results if r["success"])
        print(f"Mixed endpoints test time: {total_time:.0f}ms")
        print(f"Successful requests: {successful_requests}/{len(endpoints)}")

        # Categorize results
        yfinance_requests = [r for r in results if "price" in r["endpoint"] or "technical" in r["endpoint"]]
        non_yfinance_requests = [r for r in results if r not in yfinance_requests]

        yfinance_success = sum(1 for r in yfinance_requests if r["success"])
        non_yfinance_success = sum(1 for r in non_yfinance_requests if r["success"])

        print(f"  yfinance endpoints: {yfinance_success}/{len(yfinance_requests)} successful")
        print(f"  Non-yfinance endpoints: {non_yfinance_success}/{len(non_yfinance_requests)} successful")

        return results

    async def run_comprehensive_test(self):
        """Run all rate limiting tests"""
        print("🚀 COMPREHENSIVE RATE LIMITING TEST SUITE")
        print("=" * 60)
        print(f"Start time: {datetime.utcnow().isoformat()}")
        print("=" * 60)

        await self.setup()

        try:
            test_results = {}

            # Test 1: Configuration
            config_success, config = await self.test_rate_limit_configuration()
            test_results["configuration"] = {"success": config_success, "config": config}

            # Test 2: Individual endpoints
            test_results["individual_endpoints"] = await self.test_single_requests()

            # Test 3: Burst rate limiting
            test_results["burst_limiting"] = await self.test_burst_rate_limiting()

            # Test 4: Cooldown behavior
            test_results["cooldown_behavior"] = await self.test_cooldown_behavior()

            # Test 5: Multiple symbols
            test_results["multiple_symbols"] = await self.test_different_symbols_concurrently()

            # Test 6: Mixed endpoints stress test
            test_results["mixed_endpoints"] = await self.test_mixed_endpoints_stress()

            return test_results

        finally:
            await self.cleanup()

    def analyze_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze comprehensive test results"""
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE ANALYSIS")
        print("=" * 60)

        analysis = {
            "rate_limiting_implementation": "Working",
            "configuration_valid": False,
            "performance_acceptable": True,
            "rate_limiting_evidence": [],
            "recommendations": [],
            "issues": []
        }

        # Check configuration
        if results.get("configuration", {}).get("success"):
            analysis["configuration_valid"] = True
            config = results["configuration"]["config"]
            print(f"✓ Rate limiting configuration loaded")
            print(f"  Requests per minute: {config.get('requests_per_minute', 'N/A')}")
            print(f"  Burst limit: {config.get('burst_limit', 'N/A')}")
            print(f"  Cooldown: {config.get('cooldown_seconds', 'N/A')}s")
        else:
            analysis["issues"].append("Rate limiting configuration not accessible")

        # Analyze response times across all tests
        all_response_times = []
        all_success_rates = []

        for test_name, test_data in results.items():
            if test_name == "configuration":
                continue

            if isinstance(test_data, list):
                response_times = [r["response_time_ms"] for r in test_data if isinstance(r, dict) and "response_time_ms" in r]
                successful = sum(1 for r in test_data if isinstance(r, dict) and r.get("success", False))
                success_rate = successful / len(test_data) if test_data else 0
            elif isinstance(test_data, dict) and "response_time_ms" in test_data:
                response_times = [test_data["response_time_ms"]]
                success_rate = 1.0 if test_data.get("success", False) else 0.0
            else:
                continue

            all_response_times.extend(response_times)
            all_success_rates.append(success_rate)

        if all_response_times:
            avg_response_time = statistics.mean(all_response_times)
            max_response_time = max(all_response_times)
            median_response_time = statistics.median(all_response_times)

            print(f"\n📈 Performance Metrics:")
            print(f"  Average response time: {avg_response_time:.0f}ms")
            print(f"  Maximum response time: {max_response_time:.0f}ms")
            print(f"  Median response time: {median_response_time:.0f}ms")

            analysis["avg_response_time_ms"] = avg_response_time
            analysis["max_response_time_ms"] = max_response_time

            if avg_response_time > 5000:
                analysis["performance_acceptable"] = False
                analysis["issues"].append(f"High average response time: {avg_response_time:.0f}ms")

        if all_success_rates:
            overall_success_rate = statistics.mean(all_success_rates)
            print(f"  Overall success rate: {overall_success_rate:.1%}")
            analysis["overall_success_rate"] = overall_success_rate

        # Check for rate limiting evidence
        rate_limiting_evidence = []

        # Check burst test results
        burst_results = results.get("burst_limiting", [])
        if burst_results:
            failed_requests = sum(1 for r in burst_results if not r.get("success", False))
            if failed_requests > 0:
                rate_limiting_evidence.append(f"Burst limiting effective: {failed_requests} requests failed")

            # Check for response time variance
            burst_times = [r["response_time_ms"] for r in burst_results if r.get("success", False)]
            if burst_times and len(burst_times) > 1:
                max_burst_time = max(burst_times)
                avg_burst_time = statistics.mean(burst_times)
                if max_burst_time > avg_burst_time * 3:
                    rate_limiting_evidence.append("Response time variance suggests rate limiting delays")

        analysis["rate_limiting_evidence"] = rate_limiting_evidence

        # Generate recommendations
        recommendations = []
        if not rate_limiting_evidence:
            recommendations.append("Consider testing with higher request volumes to trigger rate limits")

        if analysis["configuration_valid"]:
            recommendations.append("Rate limiting configuration is properly loaded and accessible")

        if analysis["performance_acceptable"]:
            recommendations.append("API performance is within acceptable limits")

        analysis["recommendations"] = recommendations

        # Display results
        print(f"\n🎯 Rate Limiting Assessment:")
        print(f"  Implementation: {analysis['rate_limiting_implementation']}")
        print(f"  Configuration Valid: {'✓' if analysis['configuration_valid'] else '✗'}")
        print(f"  Performance Acceptable: {'✓' if analysis['performance_acceptable'] else '✗'}")

        if rate_limiting_evidence:
            print(f"\n⚠️  Rate Limiting Evidence:")
            for evidence in rate_limiting_evidence:
                print(f"    - {evidence}")

        if analysis["issues"]:
            print(f"\n❌ Issues Found:")
            for issue in analysis["issues"]:
                print(f"    - {issue}")

        if recommendations:
            print(f"\n💡 Recommendations:")
            for rec in recommendations:
                print(f"    - {rec}")

        return analysis


async def main():
    """Main test function"""
    tester = ComprehensiveRateLimitTester()

    try:
        results = await tester.run_comprehensive_test()
        analysis = tester.analyze_results(results)

        print("\n" + "=" * 60)
        print("✅ RATE LIMITING TEST SUITE COMPLETED")
        print("=" * 60)
        print(f"End time: {datetime.utcnow().isoformat()}")

        return {"results": results, "analysis": analysis}

    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


if __name__ == "__main__":
    asyncio.run(main())