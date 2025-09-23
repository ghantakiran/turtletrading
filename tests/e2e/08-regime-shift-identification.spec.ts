/**
 * E2E Tests for Regime Shift Identification
 * Tests complete user workflow for detecting and analyzing volatility regime changes
 */

import { test, expect, Page } from '@playwright/test';
import { APIResponse } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  retries: 2,
  symbols: ['AAPL', 'MSFT', 'NVDA'],
  apiBaseUrl: 'http://localhost:8000',
  frontendUrl: 'http://localhost:3003'
};

// Test data for regime analysis
const mockRegimeData = {
  symbol: 'AAPL',
  regimes: [
    { date: '2024-01-01', regime: 0, regime_name: 'Low Volatility', confidence: 0.85 },
    { date: '2024-01-15', regime: 1, regime_name: 'Medium Volatility', confidence: 0.78 },
    { date: '2024-02-01', regime: 2, regime_name: 'High Volatility', confidence: 0.92 },
    { date: '2024-02-15', regime: 1, regime_name: 'Medium Volatility', confidence: 0.83 }
  ],
  transitions: [
    { date: '2024-01-15', from_regime: 'low', to_regime: 'medium', confidence: 0.78 },
    { date: '2024-02-01', from_regime: 'medium', to_regime: 'high', confidence: 0.92 },
    { date: '2024-02-15', from_regime: 'high', to_regime: 'medium', confidence: 0.83 }
  ],
  confidence: 0.84,
  metadata: {
    lookback_days: 100,
    n_regimes: 3,
    regime_descriptions: [
      { id: 0, name: 'Low Volatility', description: 'Stable market conditions' },
      { id: 1, name: 'Medium Volatility', description: 'Normal market conditions' },
      { id: 2, name: 'High Volatility', description: 'Elevated market uncertainty' }
    ]
  }
};

const mockAnomalies = [
  {
    index: 45,
    timestamp: '2024-01-20T10:30:00Z',
    value: 150.25,
    score: 3.2,
    severity: 'high',
    detector_type: 'z_score',
    description: 'Z-score spike: 3.20 (threshold: 2.0)',
    confidence: 0.89
  },
  {
    index: 78,
    timestamp: '2024-02-05T14:15:00Z',
    value: 145.80,
    score: -2.8,
    severity: 'moderate',
    detector_type: 'ewma',
    description: 'EWMA deviation: -2.80 (threshold: 2.5)',
    confidence: 0.76
  },
  {
    index: 92,
    timestamp: '2024-02-12T11:45:00Z',
    value: 155.10,
    score: 4.1,
    severity: 'critical',
    detector_type: 'garch',
    description: 'GARCH volatility anomaly: 4.10 (vol: 0.0342)',
    confidence: 0.94
  }
];

// Helper functions
async function loginUser(page: Page) {
  await page.goto(`${TEST_CONFIG.frontendUrl}/login`);

  // Use demo credentials for testing
  await page.fill('[data-testid="email-input"]', 'demo@turtletrading.com');
  await page.fill('[data-testid="password-input"]', 'demo123');
  await page.click('[data-testid="login-button"]');

  // Wait for successful login
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 });
}

async function mockApiResponses(page: Page) {
  // Mock regime timeline API
  await page.route('**/api/v1/regimes/*/timeline*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockRegimeData)
    });
  });

  // Mock anomaly detection API
  await page.route('**/api/v1/regimes/*/anomalies*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAnomalies)
    });
  });

  // Mock current regime API
  await page.route('**/api/v1/regimes/*/current*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        regime: 'Medium Volatility',
        regime_id: 1,
        confidence: 0.83,
        timestamp: '2024-02-15T16:00:00Z'
      })
    });
  });

  // Mock comprehensive analysis API
  await page.route('**/api/v1/regimes/analyze*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol: 'AAPL',
        analysis_date: '2024-02-15T16:00:00Z',
        regime_analysis: mockRegimeData,
        anomaly_detection: mockAnomalies,
        current_regime: {
          regime: 'Medium Volatility',
          regime_id: 1,
          confidence: 0.83,
          timestamp: '2024-02-15T16:00:00Z'
        },
        insights: [
          'Regime transition detected 2 weeks ago',
          'High confidence in current regime classification',
          'Multiple anomalies detected during high volatility period'
        ],
        risk_assessment: {
          risk_level: 'Medium',
          risk_score: 0.65,
          risk_factors: ['Recent regime transition', 'High-severity anomalies detected'],
          recommendation: 'Monitor conditions carefully and maintain standard risk management practices.'
        }
      })
    });
  });
}

test.describe('Regime Shift Identification E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set test timeout
    test.setTimeout(TEST_CONFIG.timeout);

    // Mock API responses for consistent testing
    await mockApiResponses(page);

    // Login user
    await loginUser(page);
  });

  test('should display regime analysis widget and detect regime shifts', async ({ page }) => {
    // Navigate to stock analysis page
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for page to load
    await expect(page.locator('[data-testid="stock-analysis-page"]')).toBeVisible();

    // Look for regime analysis widget
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();

    // Verify current regime display
    await expect(page.locator('[data-testid="current-regime"]')).toContainText('Medium Volatility');
    await expect(page.locator('[data-testid="regime-confidence"]')).toContainText('83%');

    // Check for regime transition indicators
    await expect(page.locator('[data-testid="regime-transitions"]')).toBeVisible();

    // Verify transition count
    const transitionElements = page.locator('[data-testid="regime-transition"]');
    await expect(transitionElements).toHaveCount(3);
  });

  test('should navigate through regime analysis tabs', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for regime analysis widget
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();

    // Test Overview tab (default)
    await expect(page.locator('[data-testid="overview-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-regime-summary"]')).toContainText('Medium Volatility');

    // Click Regimes tab
    await page.click('[data-testid="regimes-tab"]');
    await expect(page.locator('[data-testid="regimes-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="regime-descriptions"]')).toBeVisible();

    // Click Anomalies tab
    await page.click('[data-testid="anomalies-tab"]');
    await expect(page.locator('[data-testid="anomalies-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="anomaly-list"]')).toBeVisible();

    // Verify anomaly count
    const anomalyElements = page.locator('[data-testid="anomaly-item"]');
    await expect(anomalyElements).toHaveCount(3);

    // Click Insights tab
    await page.click('[data-testid="insights-tab"]');
    await expect(page.locator('[data-testid="insights-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-assessment"]')).toContainText('Medium');
  });

  test('should display chart overlays for regime visualization', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for chart to load
    await expect(page.locator('[data-testid="stock-chart"]')).toBeVisible();

    // Check for regime overlay elements
    await expect(page.locator('[data-testid="regime-overlay"]')).toBeVisible();

    // Verify regime background segments
    const regimeSegments = page.locator('[data-testid="regime-segment"]');
    await expect(regimeSegments.first()).toBeVisible();

    // Check for transition lines
    const transitionLines = page.locator('[data-testid="transition-line"]');
    await expect(transitionLines.first()).toBeVisible();

    // Verify anomaly markers
    const anomalyMarkers = page.locator('[data-testid="anomaly-marker"]');
    await expect(anomalyMarkers.first()).toBeVisible();

    // Check legend
    await expect(page.locator('[data-testid="regime-legend"]')).toBeVisible();
    await expect(page.locator('[data-testid="anomaly-badge"]')).toBeVisible();
  });

  test('should show anomaly details on click', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for regime analysis widget
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();

    // Click on anomalies tab
    await page.click('[data-testid="anomalies-tab"]');

    // Click on first anomaly
    await page.click('[data-testid="anomaly-item"]');

    // Verify anomaly tooltip appears
    await expect(page.locator('[data-testid="anomaly-tooltip"]')).toBeVisible();

    // Check tooltip content
    await expect(page.locator('[data-testid="anomaly-severity"]')).toContainText('high');
    await expect(page.locator('[data-testid="anomaly-detector"]')).toContainText('z_score');
    await expect(page.locator('[data-testid="anomaly-confidence"]')).toContainText('89%');

    // Close tooltip
    await page.click('[data-testid="close-tooltip"]');
    await expect(page.locator('[data-testid="anomaly-tooltip"]')).not.toBeVisible();
  });

  test('should handle regime shift alerts', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Mock regime shift alert
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('regime-shift-alert', {
        detail: {
          symbol: 'AAPL',
          from_regime: 'Medium Volatility',
          to_regime: 'High Volatility',
          confidence: 0.89,
          timestamp: new Date().toISOString()
        }
      }));
    });

    // Check for alert notification
    await expect(page.locator('[data-testid="regime-shift-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-message"]')).toContainText('Regime shift detected');
    await expect(page.locator('[data-testid="alert-details"]')).toContainText('Medium Volatility → High Volatility');
  });

  test('should display accessibility features', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check for ARIA labels
    const regimeWidget = page.locator('[data-testid="regime-analysis-widget"]');
    await expect(regimeWidget).toHaveAttribute('role', 'tabpanel');

    // Check chart overlay accessibility
    const chartOverlay = page.locator('[data-testid="regime-overlay"]');
    await expect(chartOverlay).toHaveAttribute('role', 'img');
    await expect(chartOverlay).toHaveAttribute('aria-label');

    // Test screen reader announcements
    const announcements = page.locator('[aria-live="polite"]');
    await expect(announcements.first()).toBeInViewport();
  });

  test('should handle real-time regime updates', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for initial load
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();

    // Simulate WebSocket regime update
    await page.evaluate(() => {
      const mockWebSocket = {
        send: () => {},
        close: () => {},
        readyState: 1
      };

      // Dispatch regime update event
      window.dispatchEvent(new CustomEvent('regime-update', {
        detail: {
          symbol: 'AAPL',
          regime: 'High Volatility',
          regime_id: 2,
          confidence: 0.91,
          timestamp: new Date().toISOString()
        }
      }));
    });

    // Wait for UI update
    await page.waitForTimeout(1000);

    // Verify regime display updated
    await expect(page.locator('[data-testid="current-regime"]')).toContainText('High Volatility');
    await expect(page.locator('[data-testid="regime-confidence"]')).toContainText('91%');
  });

  test('should export regime analysis data', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for regime analysis widget
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();

    // Set up download expectation
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('[data-testid="export-analysis"]');

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/regime-analysis-AAPL.*\.json/);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Override API mocks to return errors
    await page.route('**/api/v1/regimes/*/timeline*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Check for error state
    await expect(page.locator('[data-testid="regime-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load regime analysis');

    // Test retry functionality
    await page.click('[data-testid="retry-analysis"]');
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  });

  test('should validate regime analysis across different timeframes', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for widget to load
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();

    // Test different timeframe selections
    const timeframes = ['30d', '90d', '180d', '1y'];

    for (const timeframe of timeframes) {
      // Select timeframe
      await page.selectOption('[data-testid="timeframe-selector"]', timeframe);

      // Wait for update
      await page.waitForTimeout(1000);

      // Verify regime data updates
      await expect(page.locator('[data-testid="regime-timeline"]')).toBeVisible();
      await expect(page.locator('[data-testid="analysis-period"]')).toContainText(timeframe);
    }
  });

  test('should display regime confidence bands correctly', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Enable confidence bands
    await page.check('[data-testid="show-confidence-bands"]');

    // Verify confidence visualization
    await expect(page.locator('[data-testid="confidence-band"]')).toBeVisible();

    // Check that confidence affects opacity
    const regimeSegments = page.locator('[data-testid="regime-segment"]');
    const firstSegment = regimeSegments.first();

    const opacity = await firstSegment.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });

    expect(parseFloat(opacity)).toBeGreaterThan(0);
    expect(parseFloat(opacity)).toBeLessThanOrEqual(1);
  });

  test('should detect regime shift patterns', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Navigate to insights tab
    await page.click('[data-testid="insights-tab"]');

    // Check for regime shift pattern analysis
    await expect(page.locator('[data-testid="regime-patterns"]')).toBeVisible();

    // Verify pattern insights
    const insights = page.locator('[data-testid="pattern-insight"]');
    await expect(insights.first()).toBeVisible();

    // Check for regime stability metrics
    await expect(page.locator('[data-testid="regime-stability"]')).toBeVisible();
    await expect(page.locator('[data-testid="transition-frequency"]')).toBeVisible();
  });

  test('should validate cross-browser regime visualization', async ({ page, browserName }) => {
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for chart to load
    await expect(page.locator('[data-testid="stock-chart"]')).toBeVisible();

    // Verify SVG elements render correctly across browsers
    const svgElements = page.locator('svg');
    await expect(svgElements.first()).toBeVisible();

    // Check regime overlay SVG
    const regimeOverlay = page.locator('[data-testid="regime-overlay"] svg');
    await expect(regimeOverlay).toBeVisible();

    // Verify chart interactions work
    await page.hover('[data-testid="anomaly-marker"]');
    await expect(page.locator('[data-testid="anomaly-tooltip"]')).toBeVisible();

    // Browser-specific checks
    if (browserName === 'webkit') {
      // Safari-specific checks
      const computedStyle = await page.locator('[data-testid="regime-segment"]').first().evaluate((el) => {
        return window.getComputedStyle(el);
      });
      expect(computedStyle).toBeDefined();
    }
  });
});

test.describe('Regime Analysis Performance Tests', () => {
  test('should load regime analysis within performance thresholds', async ({ page }) => {
    const startTime = Date.now();

    await mockApiResponses(page);
    await loginUser(page);
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for regime analysis to fully load
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-regime"]')).toBeVisible();

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    // Mock large dataset
    const largeRegimeData = {
      ...mockRegimeData,
      regimes: Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        regime: i % 3,
        regime_name: ['Low Volatility', 'Medium Volatility', 'High Volatility'][i % 3],
        confidence: 0.7 + Math.random() * 0.3
      }))
    };

    await page.route('**/api/v1/regimes/*/timeline*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeRegimeData)
      });
    });

    await loginUser(page);
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Should still load and render efficiently
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();

    // Check that chart rendering completes
    await expect(page.locator('[data-testid="regime-overlay"]')).toBeVisible();

    // Verify no performance issues with scrolling
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Should remain responsive
    await page.click('[data-testid="regimes-tab"]');
    await expect(page.locator('[data-testid="regimes-panel"]')).toBeVisible();
  });
});

test.describe('API Integration Tests', () => {
  test('should make correct API calls for regime analysis', async ({ page }) => {
    const apiCalls: any[] = [];

    // Monitor API calls
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/regimes/')) {
        apiCalls.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      }
    });

    await loginUser(page);
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Wait for API calls to complete
    await page.waitForTimeout(3000);

    // Verify correct API endpoints were called
    const timelineCall = apiCalls.find(call => call.url.includes('/timeline'));
    expect(timelineCall).toBeDefined();
    expect(timelineCall?.method).toBe('GET');

    const currentRegimeCall = apiCalls.find(call => call.url.includes('/current'));
    expect(currentRegimeCall).toBeDefined();

    // Verify authentication headers
    expect(timelineCall?.headers['authorization']).toMatch(/Bearer .+/);
  });

  test('should handle WebSocket regime updates', async ({ page }) => {
    await mockApiResponses(page);
    await loginUser(page);
    await page.goto(`${TEST_CONFIG.frontendUrl}/stock/AAPL`);

    // Mock WebSocket connection
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(public url: string) {}
        send(data: string) {}
        close() {}
        addEventListener(event: string, handler: Function) {
          if (event === 'open') {
            setTimeout(() => handler({}), 100);
          }
        }
      }
      (window as any).WebSocket = MockWebSocket;
    });

    // Wait for initial load
    await expect(page.locator('[data-testid="regime-analysis-widget"]')).toBeVisible();

    // Simulate regime update via WebSocket
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('websocket-message', {
        detail: {
          type: 'regime_update',
          data: {
            symbol: 'AAPL',
            regime: 'High Volatility',
            regime_id: 2,
            confidence: 0.95
          }
        }
      }));
    });

    // Verify UI updates in response to WebSocket message
    await expect(page.locator('[data-testid="current-regime"]')).toContainText('High Volatility');
  });
});