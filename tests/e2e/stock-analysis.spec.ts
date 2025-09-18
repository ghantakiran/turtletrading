/**
 * Stock Analysis E2E Tests
 * Tests for REQ-STOCK-01, REQ-STOCK-02, REQ-STOCK-03 per IMPLEMENT_FROM_DOCS.md
 * Includes accessibility, performance, and golden path testing
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

test.describe('Stock Analysis E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(`${BASE_URL}?e2e-test=true`);
  });

  // REQ-STOCK-01: Stock Analysis Golden Path
  test('E2E-STOCK-01: Complete stock analysis flow with AAPL', async () => {
    // Navigate to stock analysis page
    await page.click('[data-testid="nav-stock-analysis"]');
    await expect(page).toHaveURL(/.*stock\/.*$/);

    // Search for AAPL
    await page.fill('[data-testid="stock-search-input"]', 'AAPL');
    await page.click('[data-testid="search-button"]');

    // Wait for stock data to load
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('AAPL');
    await expect(page.locator('[data-testid="current-price"]')).toBeVisible();

    // Verify technical indicators are displayed
    await expect(page.locator('[data-testid="rsi-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="macd-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="bollinger-bands"]')).toBeVisible();

    // Verify LSTM predictions are shown
    await expect(page.locator('[data-testid="lstm-predictions"]')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-chart"]')).toBeVisible();

    // Verify comprehensive analysis score
    await expect(page.locator('[data-testid="analysis-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendation"]')).toBeVisible();

    // Check for key factors and warnings
    await expect(page.locator('[data-testid="key-factors"]')).toBeVisible();

    // Verify price chart is interactive
    const chart = page.locator('[data-testid="price-chart"]');
    await expect(chart).toBeVisible();

    // Test chart interaction
    await chart.hover();
    await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
  });

  // REQ-STOCK-02: Multi-Factor Analysis Integration
  test('E2E-STOCK-02: Multi-factor analysis displays all components', async () => {
    await page.goto(`${BASE_URL}/stock/MSFT`);

    // Wait for all analysis components to load
    await Promise.all([
      page.waitForSelector('[data-testid="technical-score"]'),
      page.waitForSelector('[data-testid="lstm-score"]'),
      page.waitForSelector('[data-testid="sentiment-score"]'),
      page.waitForSelector('[data-testid="final-score"]')
    ]);

    // Verify weight distribution is shown
    await expect(page.locator('[data-testid="weight-technical"]')).toContainText('50%');
    await expect(page.locator('[data-testid="weight-lstm"]')).toContainText('30%');
    await expect(page.locator('[data-testid="weight-sentiment"]')).toContainText('10%');
    await expect(page.locator('[data-testid="weight-seasonality"]')).toContainText('10%');

    // Verify final score is calculated correctly
    const finalScore = await page.locator('[data-testid="final-score"]').textContent();
    expect(parseFloat(finalScore || '0')).toBeGreaterThanOrEqual(0);
    expect(parseFloat(finalScore || '0')).toBeLessThanOrEqual(1);

    // Test recommendation logic
    const recommendation = await page.locator('[data-testid="recommendation"]').textContent();
    expect(['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL']).toContain(recommendation);
  });

  // REQ-STOCK-03: Real-time Data Updates
  test('E2E-STOCK-03: Real-time data updates work correctly', async () => {
    await page.goto(`${BASE_URL}/stock/NVDA`);

    // Get initial price
    const initialPrice = await page.locator('[data-testid="current-price"]').textContent();

    // Wait for WebSocket connection indicator
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');

    // Mock real-time price update (this would normally come from WebSocket)
    await page.evaluate(() => {
      // Simulate WebSocket message
      window.dispatchEvent(new CustomEvent('websocket-price-update', {
        detail: {
          symbol: 'NVDA',
          price: 888.50,
          change: 1.25,
          timestamp: new Date().toISOString()
        }
      }));
    });

    // Wait for price update
    await page.waitForFunction(() => {
      const priceElement = document.querySelector('[data-testid="current-price"]');
      return priceElement && priceElement.textContent !== initialPrice;
    });

    // Verify price flash animation
    await expect(page.locator('[data-testid="price-flash"]')).toHaveClass(/flash-green/);
  });

  // Performance Testing
  test('E2E-STOCK-04: Stock analysis page loads within 2 seconds', async () => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/stock/GOOGL`);

    // Wait for critical elements to load
    await Promise.all([
      page.waitForSelector('[data-testid="current-price"]'),
      page.waitForSelector('[data-testid="technical-indicators"]'),
      page.waitForSelector('[data-testid="analysis-score"]')
    ]);

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000); // 2 second requirement
  });

  // Error Handling
  test('E2E-STOCK-05: Invalid stock symbol shows appropriate error', async () => {
    await page.goto(`${BASE_URL}/stock/INVALID123`);

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Stock not found');
    await expect(page.locator('[data-testid="error-suggestion"]')).toContainText('Please check the symbol');

    // Should not show analysis components
    await expect(page.locator('[data-testid="technical-indicators"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="lstm-predictions"]')).not.toBeVisible();
  });

  // Accessibility Testing
  test('E2E-STOCK-06: Stock analysis page is accessible', async () => {
    await page.goto(`${BASE_URL}/stock/META`);

    // Check for proper heading structure
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('META');

    // Check for ARIA labels
    await expect(page.locator('[data-testid="current-price"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="analysis-score"]')).toHaveAttribute('aria-label');

    // Check color contrast (basic check)
    const priceElement = page.locator('[data-testid="current-price"]');
    const color = await priceElement.evaluate(el => getComputedStyle(el).color);
    const backgroundColor = await priceElement.evaluate(el => getComputedStyle(el).backgroundColor);

    // Basic contrast check (would need more sophisticated testing in real scenario)
    expect(color).not.toBe(backgroundColor);

    // Check keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  // API Integration Testing
  test('E2E-STOCK-07: Backend API integration works correctly', async () => {
    // Test direct API call
    const response = await page.request.get(`${API_BASE_URL}/api/v1/stocks/AAPL/price`);
    expect(response.status()).toBe(200);

    const priceData = await response.json();
    expect(priceData).toHaveProperty('symbol', 'AAPL');
    expect(priceData).toHaveProperty('current_price');
    expect(typeof priceData.current_price).toBe('number');

    // Test technical indicators API
    const techResponse = await page.request.get(`${API_BASE_URL}/api/v1/stocks/AAPL/technical?period=1y`);
    expect(techResponse.status()).toBe(200);

    const techData = await techResponse.json();
    expect(techData).toHaveProperty('rsi');
    expect(techData).toHaveProperty('macd');
    expect(techData).toHaveProperty('technical_score');

    // Test LSTM predictions API
    const lstmResponse = await page.request.get(`${API_BASE_URL}/api/v1/stocks/AAPL/lstm?days=5`);
    expect(lstmResponse.status()).toBe(200);

    const lstmData = await lstmResponse.json();
    expect(lstmData).toHaveProperty('predictions');
    expect(Array.isArray(lstmData.predictions)).toBe(true);
    expect(lstmData.predictions).toHaveLength(5);
  });

  // Batch Analysis Testing
  test('E2E-STOCK-08: Batch analysis for multiple stocks', async () => {
    await page.goto(`${BASE_URL}/analysis/batch`);

    // Add multiple stocks
    const symbols = ['AAPL', 'MSFT', 'GOOGL'];

    for (const symbol of symbols) {
      await page.fill('[data-testid="symbol-input"]', symbol);
      await page.click('[data-testid="add-symbol"]');
    }

    // Start batch analysis
    await page.click('[data-testid="start-batch-analysis"]');

    // Wait for all results
    await page.waitForSelector('[data-testid="batch-results"]');

    // Verify all symbols are processed
    for (const symbol of symbols) {
      await expect(page.locator(`[data-testid="result-${symbol}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="score-${symbol}"]`)).toBeVisible();
    }

    // Check batch completion time
    const completionTime = await page.locator('[data-testid="batch-completion-time"]').textContent();
    const timeValue = parseFloat(completionTime || '0');
    expect(timeValue).toBeLessThan(30); // Should complete within 30 seconds
  });

  // Data Persistence Testing
  test('E2E-STOCK-09: Analysis results are cached and persistent', async () => {
    // First visit
    await page.goto(`${BASE_URL}/stock/TSLA`);
    await page.waitForSelector('[data-testid="analysis-score"]');

    const firstScore = await page.locator('[data-testid="analysis-score"]').textContent();

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="analysis-score"]');

    const secondScore = await page.locator('[data-testid="analysis-score"]').textContent();

    // Should be the same (from cache)
    expect(firstScore).toBe(secondScore);

    // Check cache indicator
    await expect(page.locator('[data-testid="cache-indicator"]')).toBeVisible();
  });

  // Error Recovery Testing
  test('E2E-STOCK-10: Graceful handling of API failures', async () => {
    // Mock API failure
    await page.route(`${API_BASE_URL}/api/v1/stocks/*/technical`, route => {
      route.fulfill({ status: 500, body: 'Server Error' });
    });

    await page.goto(`${BASE_URL}/stock/AAPL`);

    // Should show partial data with error indicators
    await expect(page.locator('[data-testid="technical-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="partial-analysis-warning"]')).toBeVisible();

    // Price data should still load (different endpoint)
    await expect(page.locator('[data-testid="current-price"]')).toBeVisible();
  });

  // Mobile Responsiveness
  test('E2E-STOCK-11: Mobile responsive design works correctly', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/stock/AAPL`);

    // Check mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-trigger"]')).toBeVisible();
    await page.click('[data-testid="mobile-menu-trigger"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Check collapsible sections
    await page.click('[data-testid="technical-indicators-toggle"]');
    await expect(page.locator('[data-testid="technical-indicators-content"]')).toBeVisible();

    // Verify touch interactions
    const chart = page.locator('[data-testid="price-chart"]');
    await chart.tap();
    await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
  });

  // Advanced Features Testing
  test('E2E-STOCK-12: Advanced analysis features work correctly', async () => {
    await page.goto(`${BASE_URL}/stock/AAPL`);

    // Test time period selection
    await page.selectOption('[data-testid="period-selector"]', '6mo');
    await page.waitForResponse(response =>
      response.url().includes('/technical') && response.url().includes('period=6mo')
    );

    // Test indicator customization
    await page.click('[data-testid="customize-indicators"]');
    await page.uncheck('[data-testid="indicator-rsi"]');
    await page.click('[data-testid="apply-customization"]');

    // RSI should no longer be visible
    await expect(page.locator('[data-testid="rsi-indicator"]')).not.toBeVisible();

    // Test comparison mode
    await page.click('[data-testid="compare-stocks"]');
    await page.fill('[data-testid="comparison-symbol"]', 'MSFT');
    await page.click('[data-testid="add-comparison"]');

    // Should show comparison chart
    await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();
  });

  // Data Export Testing
  test('E2E-STOCK-13: Data export functionality works', async () => {
    await page.goto(`${BASE_URL}/stock/AAPL`);

    // Test PDF export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-pdf"]')
    ]);

    expect(download.suggestedFilename()).toMatch(/AAPL.*\.pdf$/);

    // Test CSV export
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-csv"]')
    ]);

    expect(csvDownload.suggestedFilename()).toMatch(/AAPL.*\.csv$/);

    // Test sharing
    await page.click('[data-testid="share-analysis"]');
    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();

    const shareUrl = await page.locator('[data-testid="share-url"]').inputValue();
    expect(shareUrl).toContain('/stock/AAPL');
  });

  // WebSocket Testing
  test('E2E-STOCK-14: WebSocket real-time updates', async () => {
    await page.goto(`${BASE_URL}/stock/AAPL`);

    // Wait for WebSocket connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');

    // Monitor WebSocket messages
    const wsMessages: any[] = [];
    await page.evaluateOnNewDocument(() => {
      const originalWebSocket = window.WebSocket;
      window.WebSocket = class extends originalWebSocket {
        constructor(url: string, protocols?: string | string[]) {
          super(url, protocols);
          this.addEventListener('message', (event) => {
            (window as any).wsMessages = (window as any).wsMessages || [];
            (window as any).wsMessages.push(JSON.parse(event.data));
          });
        }
      };
    });

    // Wait for at least one WebSocket message
    await page.waitForFunction(() => (window as any).wsMessages && (window as any).wsMessages.length > 0);

    const messages = await page.evaluate(() => (window as any).wsMessages);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toHaveProperty('type');
    expect(messages[0]).toHaveProperty('data');
  });

  // Load Testing Simulation
  test('E2E-STOCK-15: Multiple concurrent symbol requests', async () => {
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
    const startTime = Date.now();

    // Open multiple tabs/pages for concurrent testing
    const pages = await Promise.all(
      symbols.map(async (symbol) => {
        const newPage = await page.context().newPage();
        await newPage.goto(`${BASE_URL}/stock/${symbol}`);
        return newPage;
      })
    );

    // Wait for all pages to load
    await Promise.all(
      pages.map(async (testPage) => {
        await testPage.waitForSelector('[data-testid="analysis-score"]');
      })
    );

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

    // Clean up
    await Promise.all(pages.map(testPage => testPage.close()));
  });
});

// Helper test for data validation
test.describe('Data Validation Tests', () => {
  test('Technical indicators have valid ranges', async ({ page }) => {
    await page.goto(`${BASE_URL}/stock/AAPL`);
    await page.waitForSelector('[data-testid="rsi-value"]');

    // RSI should be between 0 and 100
    const rsiText = await page.locator('[data-testid="rsi-value"]').textContent();
    const rsiValue = parseFloat(rsiText || '0');
    expect(rsiValue).toBeGreaterThanOrEqual(0);
    expect(rsiValue).toBeLessThanOrEqual(100);

    // Technical score should be between 0 and 1
    const scoreText = await page.locator('[data-testid="technical-score"]').textContent();
    const scoreValue = parseFloat(scoreText || '0');
    expect(scoreValue).toBeGreaterThanOrEqual(0);
    expect(scoreValue).toBeLessThanOrEqual(1);
  });

  test('LSTM predictions are realistic', async ({ page }) => {
    await page.goto(`${BASE_URL}/stock/AAPL`);
    await page.waitForSelector('[data-testid="prediction-values"]');

    const currentPriceText = await page.locator('[data-testid="current-price"]').textContent();
    const currentPrice = parseFloat(currentPriceText?.replace(/[^0-9.]/g, '') || '0');

    const predictions = await page.locator('[data-testid="prediction-value"]').allTextContents();

    for (const predictionText of predictions) {
      const prediction = parseFloat(predictionText.replace(/[^0-9.]/g, ''));
      // Predictions should be within reasonable range (±50% of current price)
      expect(prediction).toBeGreaterThan(currentPrice * 0.5);
      expect(prediction).toBeLessThan(currentPrice * 1.5);
    }
  });
});