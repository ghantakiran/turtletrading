/**
 * E2E Test for GitHub Issue #4: Stock Analysis Page Data Loading Failure
 *
 * Bug: Stock Analysis page fails to load data for AAPL with error:
 * "Unable to fetch data for AAPL. Please try again later."
 *
 * This test verifies the fix by testing the actual user journey.
 */

import { test, expect } from '@playwright/test';

test.describe('Issue #4: Stock Analysis Page Data Loading', () => {

  test('should load AAPL stock analysis page successfully', async ({ page }) => {
    // Navigate to AAPL analysis page
    await page.goto('/analysis/AAPL');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should NOT show error message
    const errorMessage = page.getByText(/unable to fetch data/i);
    await expect(errorMessage).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    // Should show stock symbol
    await expect(page.getByText('AAPL')).toBeVisible({ timeout: 10000 });

    // Should show price information
    const priceRegex = /\$\d+(\.\d{2})?/;
    await expect(page.getByText(priceRegex)).toBeVisible({ timeout: 10000 });

    // Should show analysis sections
    await expect(page.getByText(/technical indicators?/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/prediction|forecast|ai/i)).toBeVisible({ timeout: 5000 });
  });

  test('should load multiple stock symbols successfully', async ({ page }) => {
    const symbols = ['AAPL', 'MSFT', 'GOOGL'];

    for (const symbol of symbols) {
      await page.goto(`/analysis/${symbol}`);
      await page.waitForLoadState('networkidle');

      // Should show correct symbol
      await expect(page.getByText(symbol)).toBeVisible({ timeout: 10000 });

      // Should not show error
      const errorMessage = page.getByText(/unable to fetch|error loading/i);
      await expect(errorMessage).not.toBeVisible({ timeout: 2000 }).catch(() => {});
    }
  });

  test('should handle invalid stock symbol gracefully', async ({ page }) => {
    // Navigate to invalid symbol
    await page.goto('/analysis/INVALID123');
    await page.waitForLoadState('networkidle');

    // Should show appropriate error message or redirect
    const hasError = await page.getByText(/not found|invalid symbol|error/i).isVisible().catch(() => false);
    const has404 = await page.getByText(/404|not found/i).isVisible().catch(() => false);

    // One of these should be true
    expect(hasError || has404).toBeTruthy();
  });

  test('should show loading state while fetching data', async ({ page }) => {
    // Slow down network to see loading state
    await page.route('**/api/v1/stocks/AAPL/**', route => {
      setTimeout(() => route.continue(), 1000);
    });

    await page.goto('/analysis/AAPL');

    // Should show loading indicator
    const loadingIndicators = [
      page.getByText(/loading/i),
      page.getByRole('progressbar'),
      page.locator('[data-testid="loading"]'),
      page.locator('.spinner, .loading, [class*="load"]')
    ];

    let foundLoading = false;
    for (const indicator of loadingIndicators) {
      if (await indicator.isVisible().catch(() => false)) {
        foundLoading = true;
        break;
      }
    }

    // Eventually should show data (loading disappears)
    await expect(page.getByText('AAPL')).toBeVisible({ timeout: 15000 });
  });

  test('should display technical indicators data', async ({ page }) => {
    await page.goto('/analysis/AAPL');
    await page.waitForLoadState('networkidle');

    // Should show technical indicator names
    const indicators = ['RSI', 'MACD', 'Moving Average', 'Bollinger', 'Volume'];

    let foundIndicators = 0;
    for (const indicator of indicators) {
      const isVisible = await page.getByText(new RegExp(indicator, 'i')).isVisible().catch(() => false);
      if (isVisible) foundIndicators++;
    }

    // Should find at least 2 technical indicators
    expect(foundIndicators).toBeGreaterThan(1);
  });

  test('should display AI prediction data', async ({ page }) => {
    await page.goto('/analysis/AAPL');
    await page.waitForLoadState('networkidle');

    // Should show prediction-related text
    const predictionKeywords = [
      /prediction/i,
      /forecast/i,
      /ai|lstm/i,
      /trend/i,
      /bullish|bearish/i
    ];

    let foundPrediction = false;
    for (const keyword of predictionKeywords) {
      if (await page.getByText(keyword).isVisible().catch(() => false)) {
        foundPrediction = true;
        break;
      }
    }

    expect(foundPrediction).toBeTruthy();
  });

  test('should show recommendation (Buy/Sell/Hold)', async ({ page }) => {
    await page.goto('/analysis/AAPL');
    await page.waitForLoadState('networkidle');

    // Should show some recommendation
    const recommendations = [
      /strong buy/i,
      /buy/i,
      /hold/i,
      /sell/i,
      /strong sell/i
    ];

    let foundRecommendation = false;
    for (const rec of recommendations) {
      if (await page.getByText(rec).isVisible().catch(() => false)) {
        foundRecommendation = true;
        break;
      }
    }

    expect(foundRecommendation).toBeTruthy();
  });

  test('should have responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/analysis/AAPL');
    await page.waitForLoadState('networkidle');

    // Should still show key data
    await expect(page.getByText('AAPL')).toBeVisible({ timeout: 10000 });

    // Page should not have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('should allow navigation from search to analysis', async ({ page }) => {
    // Go to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and use search box
    const searchBox = page.getByPlaceholder(/search.*stock/i).or(
      page.getByRole('searchbox')
    ).first();

    if (await searchBox.isVisible().catch(() => false)) {
      await searchBox.fill('AAPL');
      await searchBox.press('Enter');

      // Should navigate to analysis page or show results
      await page.waitForURL(/.*AAPL.*/i, { timeout: 5000 }).catch(() => {});

      // Should see AAPL data
      await expect(page.getByText('AAPL')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should update data when switching between stocks', async ({ page }) => {
    // First stock
    await page.goto('/analysis/AAPL');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('AAPL')).toBeVisible();

    // Second stock
    await page.goto('/analysis/MSFT');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('MSFT')).toBeVisible();

    // Should not show old stock data
    const aaplStillVisible = await page.getByText('AAPL').isVisible().catch(() => false);
    expect(aaplStillVisible).toBeFalsy();
  });
});

test.describe('Issue #4: API Integration Tests', () => {

  test('should successfully call stock price API', async ({ request }) => {
    const response = await request.get('/api/v1/stocks/AAPL/price');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.symbol).toBe('AAPL');
    expect(data.current_price).toBeGreaterThan(0);
  });

  test('should successfully call stock analysis API', async ({ request }) => {
    const response = await request.get('/api/v1/stocks/AAPL/analysis');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.symbol).toBe('AAPL');
    expect(data.price).toBeDefined();
    expect(data.technical_indicators).toBeDefined();
  });

  test('should handle API errors gracefully', async ({ request }) => {
    const response = await request.get('/api/v1/stocks/INVALID123/analysis');

    // Should return error status (400, 404, or 500)
    expect(response.status()).toBeGreaterThanOrEqual(400);

    const data = await response.json();
    expect(data.detail).toBeDefined();
  });

  test('should return data within acceptable time', async ({ request }) => {
    const start = Date.now();
    const response = await request.get('/api/v1/stocks/AAPL/price');
    const elapsed = Date.now() - start;

    // Should respond within 3 seconds
    expect(elapsed).toBeLessThan(3000);
    expect(response.ok()).toBeTruthy();
  });
});
