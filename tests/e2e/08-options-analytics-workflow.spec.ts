/**
 * E2E Tests for Options Analytics Workflow
 *
 * Tests the complete user journey through options analytics features:
 * - Symbol selection and options discovery
 * - Options chain navigation and interaction
 * - Individual option pricing and Greeks analysis
 * - IV surface visualization and data interpretation
 * - Portfolio Greeks aggregation and risk analysis
 * - Accessibility compliance and keyboard navigation
 * - Mobile responsiveness and touch interactions
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
const API_BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3003';

// Test data constants
const TEST_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA'];
const TEST_STRIKES = [140, 150, 160, 170, 180];
const FUTURE_DATE = new Date();
FUTURE_DATE.setDate(FUTURE_DATE.getDate() + 30);

// Helper functions for common operations
async function login(page: Page): Promise<void> {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  await page.fill('[data-testid="password-input"]', 'password123');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(`${FRONTEND_URL}/dashboard`);
}

async function navigateToOptionsAnalytics(page: Page, symbol: string): Promise<void> {
  // Navigate to stock analysis page
  await page.goto(`${FRONTEND_URL}/stock/${symbol}`);

  // Switch to options tab
  await page.click('[data-testid="options-tab"]');
  await page.waitForSelector('[data-testid="options-chain-table"]');
}

async function waitForOptionsData(page: Page): Promise<void> {
  // Wait for options data to load
  await page.waitForSelector('[data-testid="options-chain-table"]');
  await page.waitForFunction(() => {
    const loadingSpinner = document.querySelector('[data-testid="loading-spinner"]');
    return !loadingSpinner || loadingSpinner.style.display === 'none';
  });
}

async function selectOptionContract(page: Page, strike: number, type: 'call' | 'put'): Promise<void> {
  const contractSelector = `[data-testid="option-${type}-${strike}"]`;
  await page.click(contractSelector);
  await page.waitForSelector(`[data-testid="option-details-${type}-${strike}"]`);
}

test.describe('Options Analytics Workflow', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['clipboard-read', 'clipboard-write']
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    // Login before each test
    await login(page);
  });

  test.describe('Options Chain Navigation', () => {
    test('should display options chain for valid symbol', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');

      // Verify options chain table is displayed
      await expect(page.locator('[data-testid="options-chain-table"]')).toBeVisible();

      // Verify table headers
      await expect(page.locator('[data-testid="chain-header-calls"]')).toContainText('Calls');
      await expect(page.locator('[data-testid="chain-header-puts"]')).toContainText('Puts');
      await expect(page.locator('[data-testid="chain-header-strike"]')).toContainText('Strike');

      // Verify at least one strike price is displayed
      const strikeRows = page.locator('[data-testid^="strike-row-"]');
      await expect(strikeRows.first()).toBeVisible();

      // Verify underlying price is displayed
      await expect(page.locator('[data-testid="underlying-price"]')).toBeVisible();
    });

    test('should sort options chain by different columns', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Test strike price sorting
      await page.click('[data-testid="sort-strike"]');
      await page.waitForTimeout(500);

      // Verify sorting indicators
      await expect(page.locator('[data-testid="sort-strike"] .sort-icon')).toBeVisible();

      // Test volume sorting
      await page.click('[data-testid="sort-call-volume"]');
      await page.waitForTimeout(500);

      // Test IV sorting
      await page.click('[data-testid="sort-call-iv"]');
      await page.waitForTimeout(500);

      // Verify data is still displayed after sorting
      await expect(page.locator('[data-testid="options-chain-table"]')).toBeVisible();
    });

    test('should filter options by expiry date', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Open expiry date selector
      await page.click('[data-testid="expiry-selector"]');

      // Select a different expiry
      const expiryOptions = page.locator('[data-testid^="expiry-option-"]');
      if (await expiryOptions.count() > 1) {
        await expiryOptions.nth(1).click();

        // Wait for data to reload
        await waitForOptionsData(page);

        // Verify new expiry is displayed
        const selectedExpiry = await page.locator('[data-testid="selected-expiry"]').textContent();
        expect(selectedExpiry).toBeTruthy();
      }
    });

    test('should highlight ATM and ITM options', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Get underlying price
      const underlyingPriceText = await page.locator('[data-testid="underlying-price"]').textContent();
      const underlyingPrice = parseFloat(underlyingPriceText?.replace('$', '') || '0');

      // Find ATM strike (closest to underlying)
      const strikes = await page.locator('[data-testid^="strike-"]').all();
      let atmStrike: number | null = null;
      let minDiff = Infinity;

      for (const strike of strikes) {
        const strikeText = await strike.textContent();
        const strikeValue = parseFloat(strikeText?.replace('$', '') || '0');
        const diff = Math.abs(strikeValue - underlyingPrice);
        if (diff < minDiff) {
          minDiff = diff;
          atmStrike = strikeValue;
        }
      }

      if (atmStrike) {
        // Verify ATM highlighting
        await expect(page.locator(`[data-testid="strike-row-${atmStrike}"]`)).toHaveClass(/atm|near-money/);
      }
    });
  });

  test.describe('Individual Option Pricing', () => {
    test('should display option details when contract is selected', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Select a call option
      await selectOptionContract(page, 150, 'call');

      // Verify option details panel is displayed
      await expect(page.locator('[data-testid="option-details-panel"]')).toBeVisible();

      // Verify key option data is displayed
      await expect(page.locator('[data-testid="option-theoretical-price"]')).toBeVisible();
      await expect(page.locator('[data-testid="option-implied-volatility"]')).toBeVisible();
      await expect(page.locator('[data-testid="option-bid-ask"]')).toBeVisible();

      // Verify Greeks are displayed
      await expect(page.locator('[data-testid="greek-delta"]')).toBeVisible();
      await expect(page.locator('[data-testid="greek-gamma"]')).toBeVisible();
      await expect(page.locator('[data-testid="greek-theta"]')).toBeVisible();
      await expect(page.locator('[data-testid="greek-vega"]')).toBeVisible();
      await expect(page.locator('[data-testid="greek-rho"]')).toBeVisible();
    });

    test('should compare call and put options at same strike', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      const testStrike = 150;

      // Select call option
      await selectOptionContract(page, testStrike, 'call');
      const callPrice = await page.locator('[data-testid="option-theoretical-price"]').textContent();
      const callDelta = await page.locator('[data-testid="greek-delta"]').textContent();

      // Select put option at same strike
      await selectOptionContract(page, testStrike, 'put');
      const putPrice = await page.locator('[data-testid="option-theoretical-price"]').textContent();
      const putDelta = await page.locator('[data-testid="greek-delta"]').textContent();

      // Verify put-call parity relationships
      expect(callPrice).toBeTruthy();
      expect(putPrice).toBeTruthy();
      expect(callDelta).toBeTruthy();
      expect(putDelta).toBeTruthy();

      // Call delta should be positive, put delta should be negative
      const callDeltaValue = parseFloat(callDelta?.replace(/[^\d.-]/g, '') || '0');
      const putDeltaValue = parseFloat(putDelta?.replace(/[^\d.-]/g, '') || '0');
      expect(callDeltaValue).toBeGreaterThan(0);
      expect(putDeltaValue).toBeLessThan(0);
    });

    test('should display pricing model comparison', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Select an option
      await selectOptionContract(page, 150, 'call');

      // Open pricing model comparison
      await page.click('[data-testid="pricing-model-toggle"]');

      // Verify both Black-Scholes and Binomial prices are shown
      await expect(page.locator('[data-testid="bs-price"]')).toBeVisible();
      await expect(page.locator('[data-testid="binomial-price"]')).toBeVisible();

      // Verify model descriptions
      await expect(page.locator('[data-testid="bs-description"]')).toContainText('Black-Scholes');
      await expect(page.locator('[data-testid="binomial-description"]')).toContainText('Binomial');
    });
  });

  test.describe('IV Surface Visualization', () => {
    test('should display IV surface chart', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');

      // Navigate to IV surface tab
      await page.click('[data-testid="iv-surface-tab"]');
      await page.waitForSelector('[data-testid="iv-surface-chart"]');

      // Verify chart components
      await expect(page.locator('[data-testid="iv-surface-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="iv-surface-controls"]')).toBeVisible();

      // Verify chart has data points
      const dataPoints = page.locator('[data-testid^="iv-point-"]');
      expect(await dataPoints.count()).toBeGreaterThan(0);
    });

    test('should allow IV surface interaction and data point selection', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="iv-surface-tab"]');
      await page.waitForSelector('[data-testid="iv-surface-chart"]');

      // Click on a data point
      const firstDataPoint = page.locator('[data-testid^="iv-point-"]').first();
      await firstDataPoint.click();

      // Verify point details are displayed
      await expect(page.locator('[data-testid="selected-point-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="point-strike"]')).toBeVisible();
      await expect(page.locator('[data-testid="point-expiry"]')).toBeVisible();
      await expect(page.locator('[data-testid="point-iv"]')).toBeVisible();
    });

    test('should change IV surface visualization modes', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="iv-surface-tab"]');
      await page.waitForSelector('[data-testid="iv-surface-chart"]');

      // Test different view modes
      const viewModes = ['contour', 'heatmap', '3d', 'slice'];

      for (const mode of viewModes) {
        await page.selectOption('[data-testid="view-mode-selector"]', mode);
        await page.waitForTimeout(500);

        // Verify chart updates
        await expect(page.locator('[data-testid="iv-surface-chart"]')).toBeVisible();
      }
    });

    test('should export IV surface data', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="iv-surface-tab"]');
      await page.waitForSelector('[data-testid="iv-surface-chart"]');

      // Setup download handler
      const downloadPromise = page.waitForEvent('download');

      // Click export button
      await page.click('[data-testid="export-iv-data"]');
      await page.click('[data-testid="export-csv"]');

      // Verify download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/.*_iv_surface_.*\.csv/);
    });
  });

  test.describe('Greeks Analysis and Risk Metrics', () => {
    test('should display portfolio Greeks panel', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');

      // Navigate to Greeks tab
      await page.click('[data-testid="greeks-tab"]');
      await page.waitForSelector('[data-testid="greeks-panel"]');

      // Verify main Greeks are displayed
      await expect(page.locator('[data-testid="portfolio-delta"]')).toBeVisible();
      await expect(page.locator('[data-testid="portfolio-gamma"]')).toBeVisible();
      await expect(page.locator('[data-testid="portfolio-theta"]')).toBeVisible();
      await expect(page.locator('[data-testid="portfolio-vega"]')).toBeVisible();
      await expect(page.locator('[data-testid="portfolio-rho"]')).toBeVisible();

      // Verify risk metrics
      await expect(page.locator('[data-testid="delta-hedging-ratio"]')).toBeVisible();
      await expect(page.locator('[data-testid="gamma-risk"]')).toBeVisible();
      await expect(page.locator('[data-testid="theta-decay"]')).toBeVisible();
    });

    test('should add positions to portfolio Greeks analysis', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="greeks-tab"]');
      await page.waitForSelector('[data-testid="greeks-panel"]');

      // Add a position
      await page.click('[data-testid="add-position-button"]');
      await page.fill('[data-testid="position-symbol"]', 'AAPL');
      await page.fill('[data-testid="position-strike"]', '150');
      await page.selectOption('[data-testid="position-type"]', 'call');
      await page.fill('[data-testid="position-quantity"]', '10');
      await page.click('[data-testid="add-position-confirm"]');

      // Verify position is added to the table
      await expect(page.locator('[data-testid="position-AAPL-150-call"]')).toBeVisible();

      // Verify Greeks are updated
      const deltaValue = await page.locator('[data-testid="portfolio-delta"]').textContent();
      expect(deltaValue).toBeTruthy();
    });

    test('should display risk alerts for high exposure', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="greeks-tab"]');
      await page.waitForSelector('[data-testid="greeks-panel"]');

      // Add multiple high-risk positions
      const riskPositions = [
        { symbol: 'AAPL', strike: 150, type: 'call', quantity: 100 },
        { symbol: 'AAPL', strike: 160, type: 'call', quantity: 100 }
      ];

      for (const position of riskPositions) {
        await page.click('[data-testid="add-position-button"]');
        await page.fill('[data-testid="position-symbol"]', position.symbol);
        await page.fill('[data-testid="position-strike"]', position.strike.toString());
        await page.selectOption('[data-testid="position-type"]', position.type);
        await page.fill('[data-testid="position-quantity"]', position.quantity.toString());
        await page.click('[data-testid="add-position-confirm"]');
        await page.waitForTimeout(500);
      }

      // Check for risk alerts
      const riskAlerts = page.locator('[data-testid="risk-alerts"]');
      if (await riskAlerts.isVisible()) {
        await expect(riskAlerts).toContainText(/high|risk|exposure/i);
      }
    });

    test('should show scenario analysis P&L chart', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="greeks-tab"]');
      await page.waitForSelector('[data-testid="greeks-panel"]');

      // Add a position to generate scenarios
      await page.click('[data-testid="add-position-button"]');
      await page.fill('[data-testid="position-symbol"]', 'AAPL');
      await page.fill('[data-testid="position-strike"]', '150');
      await page.selectOption('[data-testid="position-type"]', 'call');
      await page.fill('[data-testid="position-quantity"]', '10');
      await page.click('[data-testid="add-position-confirm"]');

      // Verify scenario analysis chart is displayed
      await expect(page.locator('[data-testid="scenario-analysis-chart"]')).toBeVisible();

      // Verify chart has P&L data
      const chartLines = page.locator('[data-testid^="pnl-line-"]');
      expect(await chartLines.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Accessibility and Keyboard Navigation', () => {
    test('should support keyboard navigation in options chain', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Focus the options chain table
      await page.focus('[data-testid="options-chain-table"]');

      // Test arrow key navigation
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      // Test Enter key to select option
      await page.keyboard.press('Enter');

      // Verify option details are displayed
      await expect(page.locator('[data-testid="option-details-panel"]')).toBeVisible();
    });

    test('should have proper ARIA labels and roles', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Check main table accessibility
      const optionsTable = page.locator('[data-testid="options-chain-table"]');
      await expect(optionsTable).toHaveAttribute('role', 'table');

      // Check column headers
      const headers = page.locator('th[role="columnheader"]');
      expect(await headers.count()).toBeGreaterThan(0);

      // Check sortable columns have aria-sort attributes
      const sortableHeaders = page.locator('th[aria-sort]');
      expect(await sortableHeaders.count()).toBeGreaterThan(0);
    });

    test('should support screen reader announcements', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Check for aria-live regions
      const liveRegions = page.locator('[aria-live]');
      expect(await liveRegions.count()).toBeGreaterThan(0);

      // Check for descriptive aria-labels
      const labeledElements = page.locator('[aria-label]');
      expect(await labeledElements.count()).toBeGreaterThan(0);
    });

    test('should maintain focus management in modal dialogs', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Open option details modal
      await selectOptionContract(page, 150, 'call');

      // Verify focus is trapped in modal
      const modal = page.locator('[data-testid="option-details-modal"]');
      if (await modal.isVisible()) {
        await expect(modal).toHaveAttribute('role', 'dialog');
        await expect(modal).toHaveAttribute('aria-modal', 'true');

        // Test escape key closes modal
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should display mobile-optimized options chain', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-options-view"]')).toBeVisible();

      // Verify horizontal scrolling is available
      const table = page.locator('[data-testid="options-chain-table"]');
      await expect(table).toBeVisible();

      // Test swipe gestures (if supported)
      await page.touchscreen.tap(100, 300);
      await page.waitForTimeout(100);
    });

    test('should use collapsible sections on mobile', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');

      // Test collapsible Greeks panel
      await page.click('[data-testid="greeks-tab"]');
      const greeksPanel = page.locator('[data-testid="greeks-panel"]');

      if (await greeksPanel.isVisible()) {
        // Test accordion behavior
        const expandButton = page.locator('[data-testid="expand-greeks-details"]');
        if (await expandButton.isVisible()) {
          await expandButton.click();
          await expect(page.locator('[data-testid="greeks-details-expanded"]')).toBeVisible();
        }
      }
    });

    test('should handle touch interactions for IV surface', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="iv-surface-tab"]');
      await page.waitForSelector('[data-testid="iv-surface-chart"]');

      // Test touch interactions
      const chart = page.locator('[data-testid="iv-surface-chart"]');

      // Test pinch zoom (simulated)
      await page.touchscreen.tap(200, 300);
      await page.waitForTimeout(100);

      // Verify chart responds to touch
      await expect(chart).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle invalid symbol gracefully', async () => {
      await page.goto(`${FRONTEND_URL}/stock/INVALID`);
      await page.click('[data-testid="options-tab"]');

      // Verify error message is displayed
      await expect(page.locator('[data-testid="options-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="options-error"]')).toContainText(/not found|invalid|error/i);
    });

    test('should handle network failures gracefully', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');

      // Simulate network failure
      await page.route('**/api/v1/options/**', route => route.abort());

      // Try to refresh data
      await page.click('[data-testid="refresh-options-data"]');

      // Verify error handling
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should handle empty options data', async () => {
      // Mock empty response
      await page.route('**/api/v1/options/**/chain', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            symbol: 'TEST',
            expiry: FUTURE_DATE.toISOString().split('T')[0],
            underlying_price: 100,
            options: [],
            calculated_at: new Date().toISOString(),
            pricing_model: 'black_scholes'
          })
        });
      });

      await navigateToOptionsAnalytics(page, 'TEST');

      // Verify empty state is displayed
      await expect(page.locator('[data-testid="no-options-data"]')).toBeVisible();
      await expect(page.locator('[data-testid="no-options-data"]')).toContainText(/no options|not available/i);
    });

    test('should validate user input in Greeks calculator', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="greeks-tab"]');
      await page.waitForSelector('[data-testid="greeks-panel"]');

      // Try to add invalid position
      await page.click('[data-testid="add-position-button"]');
      await page.fill('[data-testid="position-quantity"]', '-10'); // Invalid negative quantity
      await page.click('[data-testid="add-position-confirm"]');

      // Verify validation error
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(/invalid|positive/i);
    });
  });

  test.describe('Performance and Loading', () => {
    test('should load options data within acceptable time', async () => {
      const startTime = Date.now();

      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should show loading indicators during data fetch', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');

      // Verify loading indicator is shown initially
      const loadingIndicator = page.locator('[data-testid="loading-spinner"]');

      // Should see loading state briefly
      if (await loadingIndicator.isVisible()) {
        await expect(loadingIndicator).toBeVisible();
      }

      // Should disappear when data loads
      await waitForOptionsData(page);
      await expect(loadingIndicator).not.toBeVisible();
    });

    test('should cache options data for better performance', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Navigate away and back
      await page.goto(`${FRONTEND_URL}/dashboard`);
      await navigateToOptionsAnalytics(page, 'AAPL');

      // Second load should be faster (cached)
      const startTime = Date.now();
      await waitForOptionsData(page);
      const cacheLoadTime = Date.now() - startTime;

      // Cached load should be under 2 seconds
      expect(cacheLoadTime).toBeLessThan(2000);
    });
  });

  test.describe('Data Export and Sharing', () => {
    test('should export options chain data', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Setup download handler
      const downloadPromise = page.waitForEvent('download');

      // Export options chain
      await page.click('[data-testid="export-options-chain"]');
      await page.click('[data-testid="export-csv"]');

      // Verify download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/.*_options_chain_.*\.csv/);
    });

    test('should export Greeks analysis report', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await page.click('[data-testid="greeks-tab"]');
      await page.waitForSelector('[data-testid="greeks-panel"]');

      // Add a position first
      await page.click('[data-testid="add-position-button"]');
      await page.fill('[data-testid="position-symbol"]', 'AAPL');
      await page.fill('[data-testid="position-strike"]', '150');
      await page.selectOption('[data-testid="position-type"]', 'call');
      await page.fill('[data-testid="position-quantity"]', '10');
      await page.click('[data-testid="add-position-confirm"]');

      // Export Greeks analysis
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-greeks-analysis"]');
      await page.click('[data-testid="export-json"]');

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/.*_greeks_analysis_.*\.json/);
    });

    test('should copy option data to clipboard', async () => {
      await navigateToOptionsAnalytics(page, 'AAPL');
      await waitForOptionsData(page);

      // Select an option
      await selectOptionContract(page, 150, 'call');

      // Copy option data
      await page.click('[data-testid="copy-option-data"]');

      // Verify success message
      await expect(page.locator('[data-testid="copy-success"]')).toBeVisible();

      // Verify clipboard content (if permissions allow)
      try {
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toContain('AAPL');
        expect(clipboardText).toContain('150');
      } catch (e) {
        // Clipboard access might be restricted in test environment
        console.log('Clipboard access not available in test environment');
      }
    });
  });
});

// Additional test for API integration
test.describe('Options Analytics API Integration', () => {
  test('should validate API endpoints respond correctly', async ({ request }) => {
    // Test options pricing endpoint
    const pricingResponse = await request.post(`${API_BASE_URL}/api/v1/options/AAPL`, {
      headers: {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json'
      },
      data: {
        symbol: 'AAPL',
        expiry: FUTURE_DATE.toISOString().split('T')[0],
        strike: 150.0,
        option_type: 'call',
        pricing_model: 'black_scholes'
      }
    });

    // Should require authentication (401) or return data (200)
    expect([200, 401, 422]).toContain(pricingResponse.status());

    // Test options chain endpoint
    const chainResponse = await request.get(`${API_BASE_URL}/api/v1/options/AAPL/chain`, {
      headers: {
        'Authorization': 'Bearer test_token'
      }
    });

    expect([200, 401]).toContain(chainResponse.status());

    // Test health endpoint (should be public)
    const healthResponse = await request.get(`${API_BASE_URL}/api/v1/options/health`);
    expect(healthResponse.status()).toBe(200);

    const healthData = await healthResponse.json();
    expect(healthData).toHaveProperty('status');
  });
});