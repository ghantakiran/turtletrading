import { test, expect } from '@playwright/test';

test.describe('TA-Lib Integration Tests', () => {
  const testSymbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA'];
  const testPeriods = ['1y', '6mo', '3mo'];

  test.beforeEach(async ({ page }) => {
    // Set up console logging to catch any errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
  });

  test('should successfully fetch enhanced technical analysis for AAPL', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verify basic structure
    expect(data.symbol).toBe('AAPL');
    expect(data.current_price).toBeDefined();
    expect(typeof data.current_price).toBe('number');

    // Verify enhanced score structure
    expect(data.enhanced_score).toBeDefined();
    expect(typeof data.enhanced_score).toBe('number');
    expect(data.enhanced_score).toBeGreaterThanOrEqual(0);
    expect(data.enhanced_score).toBeLessThanOrEqual(100);

    // Verify enhanced recommendation
    expect(data.enhanced_recommendation).toBeDefined();
    expect(['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']).toContain(data.enhanced_recommendation);

    // Verify analysis details (actual structure)
    expect(data.analysis_details).toBeDefined();
    expect(data.analysis_details.criteria).toBeDefined();
    expect(data.analysis_details.signals).toBeDefined();
    expect(data.analysis_details.indicators).toBeDefined();

    // Verify traditional indicators (string format in actual response)
    expect(data.traditional_indicators).toBeDefined();
    expect(typeof data.traditional_indicators).toBe('string');

    // Verify timestamp
    expect(data.timestamp).toBeDefined();
  });

  test('should handle multiple stock symbols correctly', async ({ request }) => {
    for (const symbol of testSymbols) {
      const response = await request.get(`http://localhost:8000/api/v1/stocks/${symbol}/enhanced-technical?period=1y`);

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Basic structure validation for each symbol
      expect(data.symbol).toBe(symbol);
      expect(data.enhanced_score).toBeDefined();
      expect(data.enhanced_recommendation).toBeDefined();
      expect(data.analysis_details).toBeDefined();
      expect(data.traditional_indicators).toBeDefined();
      expect(data.candlestick_patterns).toBeDefined();

      // Verify score is within valid range
      expect(data.enhanced_score).toBeGreaterThanOrEqual(0);
      expect(data.enhanced_score).toBeLessThanOrEqual(100);
    }
  });

  test('should handle different time periods correctly', async ({ request }) => {
    for (const period of testPeriods) {
      const response = await request.get(`http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=${period}`);

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Verify response structure is consistent across periods
      expect(data.period).toBe(period);
      expect(data.enhanced_score).toBeDefined();
      expect(data.enhanced_recommendation).toBeDefined();
      expect(data.analysis_details).toBeDefined();

      // Verify that different periods might have different data points
      expect(data.analysis_details.data_points).toBeDefined();
      expect(typeof data.analysis_details.data_points).toBe('number');
      expect(data.analysis_details.data_points).toBeGreaterThan(0);
    }
  });

  test('should return comprehensive TA-Lib indicators', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');

    expect(response.status()).toBe(200);

    const data = await response.json();
    const talibSignals = data.analysis_details.talib_signals;

    // Verify TA-Lib specific indicators are present
    expect(talibSignals).toBeDefined();
    expect(typeof talibSignals).toBe('object');

    // Check for key TA-Lib indicators that should be available
    const expectedIndicators = [
      'trend_indicators',
      'momentum_indicators',
      'volatility_indicators',
      'volume_indicators'
    ];

    for (const indicator of expectedIndicators) {
      expect(talibSignals[indicator]).toBeDefined();
    }
  });

  test('should return comprehensive traditional indicators', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');

    expect(response.status()).toBe(200);

    const data = await response.json();
    const traditional = data.traditional_indicators;

    // Verify traditional indicators structure
    expect(traditional.rsi).toBeDefined();
    expect(traditional.rsi.value).toBeDefined();
    expect(traditional.rsi.signal).toBeDefined();

    expect(traditional.macd).toBeDefined();
    expect(traditional.macd.macd).toBeDefined();
    expect(traditional.macd.signal).toBeDefined();
    expect(traditional.macd.histogram).toBeDefined();

    expect(traditional.bollinger_bands).toBeDefined();
    expect(traditional.bollinger_bands.upper).toBeDefined();
    expect(traditional.bollinger_bands.middle).toBeDefined();
    expect(traditional.bollinger_bands.lower).toBeDefined();

    // Verify RSI is within valid range (0-100)
    expect(traditional.rsi.value).toBeGreaterThanOrEqual(0);
    expect(traditional.rsi.value).toBeLessThanOrEqual(100);
  });

  test('should include candlestick pattern recognition', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verify candlestick patterns structure
    expect(data.candlestick_patterns).toBeDefined();
    expect(Array.isArray(data.candlestick_patterns)).toBe(true);

    // If patterns are found, verify their structure
    if (data.candlestick_patterns.length > 0) {
      const pattern = data.candlestick_patterns[0];
      expect(pattern.name).toBeDefined();
      expect(pattern.value).toBeDefined();
      expect(pattern.signal).toBeDefined();
    }
  });

  test('should handle invalid stock symbol gracefully', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/INVALID/enhanced-technical?period=1y');

    // Should return appropriate error status
    expect([400, 404, 422]).toContain(response.status());

    const data = await response.json();
    expect(data.detail || data.error).toBeDefined();
  });

  test('should handle invalid time period gracefully', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=invalid');

    // Should return appropriate error status
    expect([400, 422]).toContain(response.status());

    const data = await response.json();
    expect(data.detail || data.error).toBeDefined();
  });

  test('should return data within acceptable response time', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status()).toBe(200);

    // Response should be under 5 seconds for comprehensive analysis
    expect(responseTime).toBeLessThan(5000);

    console.log(`Enhanced technical analysis response time: ${responseTime}ms`);
  });

  test('should provide consistent scoring across multiple requests', async ({ request }) => {
    // Make multiple requests for the same symbol and period
    const responses = await Promise.all([
      request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y'),
      request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y'),
      request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y')
    ]);

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });

    const data = await Promise.all(responses.map(r => r.json()));

    // Scores should be identical for same symbol/period
    const scores = data.map(d => d.enhanced_score);
    expect(scores[0]).toBe(scores[1]);
    expect(scores[1]).toBe(scores[2]);

    // Recommendations should be identical
    const recommendations = data.map(d => d.enhanced_recommendation);
    expect(recommendations[0]).toBe(recommendations[1]);
    expect(recommendations[1]).toBe(recommendations[2]);
  });

  test('should demonstrate enhanced scoring vs traditional scoring', async ({ request }) => {
    const [enhancedResponse, traditionalResponse] = await Promise.all([
      request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y'),
      request.get('http://localhost:8000/api/v1/stocks/AAPL/technical')
    ]);

    expect(enhancedResponse.status()).toBe(200);
    expect(traditionalResponse.status()).toBe(200);

    const enhancedData = await enhancedResponse.json();
    const traditionalData = await traditionalResponse.json();

    // Enhanced endpoint should have additional fields
    expect(enhancedData.enhanced_score).toBeDefined();
    expect(enhancedData.enhanced_recommendation).toBeDefined();
    expect(enhancedData.analysis_details.talib_signals).toBeDefined();
    expect(enhancedData.candlestick_patterns).toBeDefined();

    // Traditional endpoint should not have enhanced fields
    expect(traditionalData.enhanced_score).toBeUndefined();
    expect(traditionalData.enhanced_recommendation).toBeUndefined();

    // But both should have basic technical indicators
    expect(enhancedData.traditional_indicators).toBeDefined();
    expect(traditionalData.rsi).toBeDefined();
    expect(traditionalData.macd).toBeDefined();
  });

  test('should handle concurrent requests efficiently', async ({ request }) => {
    const startTime = Date.now();

    // Make concurrent requests for different symbols
    const promises = testSymbols.map(symbol =>
      request.get(`http://localhost:8000/api/v1/stocks/${symbol}/enhanced-technical?period=1y`)
    );

    const responses = await Promise.all(promises);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });

    // Concurrent requests should complete in reasonable time
    expect(totalTime).toBeLessThan(10000); // 10 seconds for 5 concurrent requests

    console.log(`Concurrent requests (${testSymbols.length} symbols) completed in: ${totalTime}ms`);

    // Verify all responses have valid data
    const data = await Promise.all(responses.map(r => r.json()));
    data.forEach((stockData, index) => {
      expect(stockData.symbol).toBe(testSymbols[index]);
      expect(stockData.enhanced_score).toBeDefined();
      expect(stockData.enhanced_recommendation).toBeDefined();
    });
  });

  test('should validate enhanced scoring ranges and logic', async ({ request }) => {
    // Test multiple symbols to get varied scores
    const responses = await Promise.all(
      testSymbols.map(symbol =>
        request.get(`http://localhost:8000/api/v1/stocks/${symbol}/enhanced-technical?period=1y`)
      )
    );

    const data = await Promise.all(responses.map(r => r.json()));

    data.forEach(stockData => {
      const score = stockData.enhanced_score;
      const recommendation = stockData.enhanced_recommendation;

      // Verify score-recommendation alignment
      if (score >= 80) {
        expect(['Strong Buy', 'Buy']).toContain(recommendation);
      } else if (score >= 60) {
        expect(['Buy', 'Hold']).toContain(recommendation);
      } else if (score >= 40) {
        expect(['Hold']).toContain(recommendation);
      } else if (score >= 20) {
        expect(['Hold', 'Sell']).toContain(recommendation);
      } else {
        expect(['Sell', 'Strong Sell']).toContain(recommendation);
      }

      // Verify analysis details provide reasoning
      expect(stockData.analysis_details.signal_summary).toBeDefined();
      expect(stockData.analysis_details.confidence_level).toBeDefined();
    });
  });

  test('should provide comprehensive analysis metadata', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verify metadata is included
    expect(data.metadata).toBeDefined();
    expect(data.metadata.calculation_time).toBeDefined();
    expect(data.metadata.library_versions).toBeDefined();
    expect(data.metadata.library_versions.talib).toBeDefined();
    expect(data.metadata.library_versions.ta).toBeDefined();

    // Verify timestamp information
    expect(data.metadata.analysis_timestamp).toBeDefined();
    expect(data.metadata.data_period).toBeDefined();

    // Verify analysis quality metrics
    expect(data.analysis_details.data_quality).toBeDefined();
    expect(data.analysis_details.data_points).toBeDefined();
    expect(typeof data.analysis_details.data_points).toBe('number');
  });
});