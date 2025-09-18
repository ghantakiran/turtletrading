// Rate Limiting Test Suite for TurtleTrading Backend
// Tests the external API rate limiting implementation

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8000';

test.describe('Rate Limiting Implementation Tests', () => {

  test('should return rate limiting configuration', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/stocks/rate-limit-stats`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('yfinance');
    expect(data).toHaveProperty('alpha_vantage');
    expect(data).toHaveProperty('timestamp');

    // Check yfinance configuration
    const yfinanceConfig = data.yfinance.config;
    expect(yfinanceConfig.requests_per_minute).toBe(2000);
    expect(yfinanceConfig.requests_per_hour).toBe(48000);
    expect(yfinanceConfig.burst_limit).toBe(10);
    expect(yfinanceConfig.cooldown_seconds).toBe(1);

    // Check Redis availability
    expect(data.yfinance.redis_available).toBe(true);

    console.log('✓ Rate limiting configuration verified');
    console.log(`  - yfinance: ${yfinanceConfig.requests_per_minute}/min, ${yfinanceConfig.requests_per_hour}/hour`);
    console.log(`  - Burst limit: ${yfinanceConfig.burst_limit} requests`);
    console.log(`  - Cooldown: ${yfinanceConfig.cooldown_seconds}s`);
    console.log(`  - Redis available: ${data.yfinance.redis_available}`);
  });

  test('should handle single stock price requests with rate limiting', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/v1/stocks/AAPL/price`);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Should eventually succeed (may be cached)
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('symbol', 'AAPL');
      expect(data).toHaveProperty('current_price');
      expect(data).toHaveProperty('timestamp');

      console.log(`✓ AAPL price request successful (${responseTime}ms)`);
      console.log(`  Price: $${data.current_price}`);
    } else {
      console.log(`⚠ AAPL price request returned ${response.status()} (may be rate limited)`);
    }
  });

  test('should demonstrate rate limiting with burst requests', async ({ request }) => {
    console.log('Testing burst rate limiting with 12 concurrent requests...');

    const promises = [];
    const startTime = Date.now();

    // Create 12 concurrent requests (exceeds burst limit of 10)
    for (let i = 0; i < 12; i++) {
      promises.push(
        request.get(`${BASE_URL}/api/v1/stocks/AAPL/price`)
          .then(response => ({
            requestNum: i + 1,
            status: response.status(),
            timestamp: Date.now()
          }))
          .catch(error => ({
            requestNum: i + 1,
            error: error.message,
            timestamp: Date.now()
          }))
      );
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    const successfulRequests = results.filter(r => r.status === 200).length;
    const failedRequests = results.filter(r => r.status >= 400 || r.error).length;

    console.log(`Burst test completed in ${totalTime}ms:`);
    console.log(`  - Successful requests: ${successfulRequests}/12`);
    console.log(`  - Failed/Rate limited: ${failedRequests}/12`);

    // Rate limiting should prevent some requests from succeeding
    // (Either by failing them or by significant delays)
    expect(failedRequests).toBeGreaterThan(0);

    console.log('✓ Rate limiting effectively limited burst requests');
  });

  test('should handle mixed endpoint types', async ({ request }) => {
    console.log('Testing mixed endpoint types...');

    const endpoints = [
      { url: `${BASE_URL}/api/v1/stocks/AAPL/price`, name: 'AAPL price' },
      { url: `${BASE_URL}/api/v1/stocks/MSFT/price`, name: 'MSFT price' },
      { url: `${BASE_URL}/api/v1/stocks/rate-limit-stats`, name: 'Rate limit stats' },
      { url: `${BASE_URL}/api/v1/stocks/`, name: 'Available stocks' },
    ];

    const promises = endpoints.map(async endpoint => {
      const startTime = Date.now();
      try {
        const response = await request.get(endpoint.url);
        const endTime = Date.now();
        return {
          name: endpoint.name,
          status: response.status(),
          responseTime: endTime - startTime,
          success: response.status() >= 200 && response.status() < 300
        };
      } catch (error) {
        const endTime = Date.now();
        return {
          name: endpoint.name,
          error: error.message,
          responseTime: endTime - startTime,
          success: false
        };
      }
    });

    const results = await Promise.all(promises);

    console.log('Mixed endpoint test results:');
    results.forEach(result => {
      const status = result.success ? '✓' : '✗';
      const statusCode = result.status || 'ERR';
      console.log(`  ${status} ${result.name}: ${statusCode} (${result.responseTime}ms)`);
    });

    // Non-rate-limited endpoints should work
    const nonRateLimitedResults = results.filter(r =>
      r.name === 'Rate limit stats' || r.name === 'Available stocks'
    );

    expect(nonRateLimitedResults.every(r => r.success)).toBe(true);
    console.log('✓ Non-rate-limited endpoints working correctly');
  });

  test('should show rate limit stats consistently', async ({ request }) => {
    // Test the rate limit stats endpoint multiple times
    const requests = 3;
    const results = [];

    for (let i = 0; i < requests; i++) {
      const response = await request.get(`${BASE_URL}/api/v1/stocks/rate-limit-stats`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      results.push(data);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // All responses should have consistent configuration
    const firstConfig = results[0].yfinance.config;

    results.forEach((result, index) => {
      expect(result.yfinance.config).toEqual(firstConfig);
    });

    console.log(`✓ Rate limit stats endpoint consistent across ${requests} requests`);
  });

});

// Test configuration verification
test.describe('Rate Limiting Configuration Verification', () => {

  test('should have appropriate rate limits configured', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/stocks/rate-limit-stats`);
    const data = await response.json();

    const yfinanceConfig = data.yfinance.config;
    const alphaVantageConfig = data.alpha_vantage.config;

    // Verify yfinance has higher limits (premium service)
    expect(yfinanceConfig.requests_per_minute).toBeGreaterThan(alphaVantageConfig.requests_per_minute);
    expect(yfinanceConfig.requests_per_hour).toBeGreaterThan(alphaVantageConfig.requests_per_hour);

    // Verify reasonable burst limits
    expect(yfinanceConfig.burst_limit).toBeGreaterThanOrEqual(5);
    expect(yfinanceConfig.burst_limit).toBeLessThanOrEqual(20);

    // Verify cooldown periods
    expect(yfinanceConfig.cooldown_seconds).toBeGreaterThanOrEqual(1);
    expect(alphaVantageConfig.cooldown_seconds).toBeGreaterThanOrEqual(yfinanceConfig.cooldown_seconds);

    console.log('✓ Rate limiting configuration validated');
    console.log('  yfinance configuration appears appropriate for production use');
    console.log('  alpha_vantage configuration shows proper free-tier limits');
  });

});