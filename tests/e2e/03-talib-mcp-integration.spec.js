const { test, expect } = require('@playwright/test');

test.describe('TA-Lib MCP Integration Tests', () => {

  test('Backend health check', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health');
    expect(response.ok()).toBeTruthy();

    const health = await response.json();
    expect(health.status).toBe('healthy');
    expect(health.services.database.status).toBe('healthy');
  });

  test('Enhanced technical indicators endpoint - AAPL', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.symbol).toBe('AAPL');
    expect(data.enhanced_score).toBeGreaterThanOrEqual(0);
    expect(data.enhanced_score).toBeLessThanOrEqual(100);
    expect(['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']).toContain(data.enhanced_recommendation);
    expect(data.analysis_details).toBeDefined();
    expect(data.analysis_details.signals).toBeDefined();
    expect(data.analysis_details.criteria).toBeDefined();
  });

  test('Enhanced technical indicators - Multiple stocks', async ({ request }) => {
    const stocks = ['AAPL', 'MSFT', 'NVDA'];

    for (const stock of stocks) {
      const response = await request.get(`http://localhost:8000/api/v1/stocks/${stock}/enhanced-technical?period=6mo`);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.symbol).toBe(stock);
      expect(data.enhanced_score).toBeGreaterThanOrEqual(0);
      expect(data.current_price).toBeGreaterThan(0);
    }
  });

  test('Enhanced technical indicators - Different time periods', async ({ request }) => {
    const periods = ['6mo', '1y'];

    for (const period of periods) {
      const response = await request.get(`http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=${period}`);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.analysis_details.signals.rsi).toBeDefined();
      expect(data.analysis_details.signals.macd).toBeDefined();
      expect(data.analysis_details.signals.bollinger).toBeDefined();
    }
  });

  test('TA-Lib dual library validation', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const rsi = data.analysis_details.signals.rsi;

    // Verify both TA-Lib and ta library RSI values are present
    expect(rsi.talib).toBeDefined();
    expect(rsi.ta).toBeDefined();
    expect(rsi.average).toBeDefined();
    expect(rsi.signal).toBeDefined();

    // Verify MACD consensus from both libraries
    const macd = data.analysis_details.signals.macd;
    expect(macd.talib_bullish).toBeDefined();
    expect(macd.ta_bullish).toBeDefined();
    expect(macd.consensus).toBeDefined();
  });

  test('Enhanced scoring system validation', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const criteria = data.analysis_details.criteria;

    // Verify key technical criteria are evaluated
    expect(criteria['RSI Bullish']).toBeDefined();
    expect(criteria['MACD Bullish (TA-Lib)']).toBeDefined();
    expect(criteria['Price Above SMA20']).toBeDefined();
    expect(criteria['Golden Cross']).toBeDefined();
    expect(criteria['Strong Trend']).toBeDefined();

    // Verify recommendation mapping
    expect(['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']).toContain(data.enhanced_recommendation);
  });

  test('Performance benchmark - Response time', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');
    const endTime = Date.now();

    expect(response.ok()).toBeTruthy();

    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(5000); // 5 second timeout

    console.log(`Enhanced technical analysis response time: ${responseTime}ms`);
  });

  test('Error handling - Invalid symbol', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/INVALID/enhanced-technical?period=1y');
    expect(response.status()).toBe(500);
  });

  test('Error handling - Invalid period', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=invalid');
    expect(response.status()).toBe(500);
  });

  test('Concurrent requests handling', async ({ request }) => {
    const promises = [
      request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y'),
      request.get('http://localhost:8000/api/v1/stocks/MSFT/enhanced-technical?period=1y'),
      request.get('http://localhost:8000/api/v1/stocks/NVDA/enhanced-technical?period=1y')
    ];

    const responses = await Promise.all(promises);

    for (const response of responses) {
      expect(response.ok()).toBeTruthy();
    }
  });

});