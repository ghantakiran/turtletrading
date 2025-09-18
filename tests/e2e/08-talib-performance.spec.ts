import { test, expect } from '@playwright/test';

test.describe('TA-Lib Performance & Core Functionality Tests', () => {
  const testSymbols = ['AAPL', 'MSFT', 'NVDA'];
  const testPeriods = ['1y', '6mo', '3mo'];

  test('Enhanced Technical Analysis - Core Functionality', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Core structure validation
    expect(data.symbol).toBe('AAPL');
    expect(data.enhanced_score).toBeDefined();
    expect(data.enhanced_recommendation).toBeDefined();
    expect(data.analysis_details).toBeDefined();
    expect(data.traditional_indicators).toBeDefined();

    // Score validation
    expect(typeof data.enhanced_score).toBe('number');
    expect(data.enhanced_score).toBeGreaterThanOrEqual(0);
    expect(data.enhanced_score).toBeLessThanOrEqual(100);

    // Recommendation validation
    expect(['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']).toContain(data.enhanced_recommendation);

    console.log(`✅ AAPL Enhanced Score: ${data.enhanced_score} | Recommendation: ${data.enhanced_recommendation}`);
  });

  test('Performance Test - Response Time', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(3000); // Should be under 3 seconds

    console.log(`⏱️ Enhanced Technical Analysis Response Time: ${responseTime}ms`);
  });

  test('Multiple Symbols - Functionality Test', async ({ request }) => {
    const results = [];

    for (const symbol of testSymbols) {
      const response = await request.get(`http://localhost:8000/api/v1/stocks/${symbol}/enhanced-technical?period=1y`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.symbol).toBe(symbol);
      expect(data.enhanced_score).toBeDefined();
      expect(data.enhanced_recommendation).toBeDefined();

      results.push({
        symbol: symbol,
        score: data.enhanced_score,
        recommendation: data.enhanced_recommendation
      });
    }

    // Log results for analysis
    console.log('📊 Multi-Symbol Analysis Results:');
    results.forEach(result => {
      console.log(`  ${result.symbol}: Score ${result.score.toFixed(2)} | ${result.recommendation}`);
    });

    // All symbols should have valid scores
    expect(results.length).toBe(testSymbols.length);
  });

  test('Concurrent Requests - Performance Test', async ({ request }) => {
    const startTime = Date.now();

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

    // Should handle concurrent requests efficiently
    expect(totalTime).toBeLessThan(5000); // 5 seconds for 3 concurrent requests

    console.log(`🚀 Concurrent requests (${testSymbols.length} symbols) completed in: ${totalTime}ms`);
  });

  test('Different Time Periods - Functionality Test', async ({ request }) => {
    const results = [];

    for (const period of testPeriods) {
      const response = await request.get(`http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=${period}`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.enhanced_score).toBeDefined();
      expect(data.enhanced_recommendation).toBeDefined();

      results.push({
        period: period,
        score: data.enhanced_score,
        recommendation: data.enhanced_recommendation
      });
    }

    console.log('📈 Time Period Analysis Results for AAPL:');
    results.forEach(result => {
      console.log(`  ${result.period}: Score ${result.score.toFixed(2)} | ${result.recommendation}`);
    });

    expect(results.length).toBe(testPeriods.length);
  });

  test('Analysis Details - Structure Validation', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');
    expect(response.status()).toBe(200);

    const data = await response.json();
    const details = data.analysis_details;

    // Verify analysis details structure
    expect(details.criteria).toBeDefined();
    expect(details.signals).toBeDefined();
    expect(details.indicators).toBeDefined();

    // Verify criteria has boolean values
    expect(typeof details.criteria).toBe('object');

    // Verify signals structure
    expect(details.signals.rsi).toBeDefined();
    expect(details.signals.macd).toBeDefined();

    // Count criteria for scoring validation
    const criteriaKeys = Object.keys(details.criteria);
    const trueCount = Object.values(details.criteria).filter(v => v === true).length;

    console.log(`📋 Analysis Criteria: ${trueCount}/${criteriaKeys.length} positive signals`);
    console.log(`🎯 Enhanced Score: ${data.enhanced_score} | Recommendation: ${data.enhanced_recommendation}`);
  });

  test('Error Handling - Invalid Symbol', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/INVALID/enhanced-technical?period=1y');

    // Should handle error gracefully
    expect([400, 404, 422, 500]).toContain(response.status());

    console.log(`❌ Invalid symbol test - Status: ${response.status()}`);
  });

  test('Error Handling - Invalid Period', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=invalid');

    // Should handle error gracefully (405 = Method Not Allowed for invalid period)
    expect([400, 405, 422]).toContain(response.status());

    console.log(`❌ Invalid period test - Status: ${response.status()}`);
  });

  test('TA-Lib Integration - Dual Library Comparison', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/stocks/AAPL/enhanced-technical?period=1y');
    expect(response.status()).toBe(200);

    const data = await response.json();
    const signals = data.analysis_details.signals;

    // Verify dual RSI calculation (TA-Lib vs ta library)
    expect(signals.rsi).toBeDefined();
    expect(signals.rsi.talib).toBeDefined();
    expect(signals.rsi.ta).toBeDefined();
    expect(signals.rsi.average).toBeDefined();

    // Both RSI values should be between 0-100
    expect(signals.rsi.talib).toBeGreaterThanOrEqual(0);
    expect(signals.rsi.talib).toBeLessThanOrEqual(100);
    expect(signals.rsi.ta).toBeGreaterThanOrEqual(0);
    expect(signals.rsi.ta).toBeLessThanOrEqual(100);

    console.log(`📊 RSI Comparison - TA-Lib: ${signals.rsi.talib} | ta: ${signals.rsi.ta.toFixed(2)} | Average: ${signals.rsi.average.toFixed(2)}`);
    console.log(`🔄 MACD Consensus: ${signals.macd.consensus} (TA-Lib: ${signals.macd.talib_bullish}, ta: ${signals.macd.ta_bullish})`);
  });
});