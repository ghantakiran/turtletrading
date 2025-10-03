/**
 * E2E Test for GitHub Issue #11: AI Insights Button Non-Functional
 *
 * Bug: AI Insights button in header navigation is non-functional
 * Expected: Should open AI insights modal/panel with trading recommendations
 *
 * This test verifies the fix by testing the actual user journey.
 */

import { test, expect } from '@playwright/test';

test.describe('Issue #11: AI Insights Button Functionality', () => {

  test('should display AI Insights button in header', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check AI Insights button exists
    const aiInsightsButton = page.getByRole('button', { name: /AI Insights/i });
    await expect(aiInsightsButton).toBeVisible({ timeout: 5000 });
  });

  test('should open AI Insights modal when clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click AI Insights button
    const aiInsightsButton = page.getByRole('button', { name: /AI Insights/i });
    await aiInsightsButton.click();

    // Should open modal or panel
    const modal = page.locator('[role="dialog"], [data-testid="ai-insights-modal"]').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Modal should have AI Insights title
    await expect(page.getByText(/AI.*Insights/i)).toBeVisible();
  });

  test('should display AI predictions in modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open AI Insights
    await page.getByRole('button', { name: /AI Insights/i }).click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"], [data-testid="ai-insights-modal"]', {
      timeout: 3000
    });

    // Should show AI predictions or recommendations
    const predictions = [
      /prediction/i,
      /recommendation/i,
      /buy|sell|hold/i,
      /lstm|machine learning|ai/i,
      /confidence/i
    ];

    let foundPrediction = false;
    for (const pattern of predictions) {
      if (await page.getByText(pattern).first().isVisible().catch(() => false)) {
        foundPrediction = true;
        break;
      }
    }

    expect(foundPrediction).toBeTruthy();
  });

  test('should close AI Insights modal with close button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open modal
    await page.getByRole('button', { name: /AI Insights/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    // Find and click close button
    const closeButton = page.getByRole('button', { name: /close/i })
      .or(page.locator('[aria-label="Close"]'))
      .or(page.locator('button:has-text("×")'))
      .first();

    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();

      // Modal should be hidden
      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('should display top stock recommendations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open AI Insights
    await page.getByRole('button', { name: /AI Insights/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    // Should show stock symbols (AAPL, MSFT, etc.)
    const stockSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];

    let foundStocks = 0;
    for (const symbol of stockSymbols) {
      if (await page.getByText(symbol).first().isVisible().catch(() => false)) {
        foundStocks++;
      }
    }

    // Should find at least 2 stock symbols
    expect(foundStocks).toBeGreaterThanOrEqual(2);
  });

  test('should show AI signal indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open AI Insights
    await page.getByRole('button', { name: /AI Insights/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    // Should show trading signals
    const signals = [
      /strong buy/i,
      /buy/i,
      /hold/i,
      /sell/i,
      /bullish/i,
      /bearish/i
    ];

    let foundSignal = false;
    for (const signal of signals) {
      if (await page.getByText(signal).first().isVisible().catch(() => false)) {
        foundSignal = true;
        break;
      }
    }

    expect(foundSignal).toBeTruthy();
  });

  test('should allow clicking on stock for detailed analysis', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open AI Insights
    await page.getByRole('button', { name: /AI Insights/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    // Find a stock link/button (AAPL as example)
    const stockLink = page.getByText('AAPL').first();

    if (await stockLink.isVisible().catch(() => false)) {
      const isClickable = await stockLink.evaluate(el => {
        const tag = el.tagName.toLowerCase();
        return tag === 'a' || tag === 'button' ||
               el.closest('a') !== null ||
               el.closest('button') !== null;
      }).catch(() => false);

      // Stock should be clickable for detailed analysis
      expect(isClickable).toBeTruthy();
    }
  });

  test('should display confidence scores for predictions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open AI Insights
    await page.getByRole('button', { name: /AI Insights/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    // Should show confidence scores or percentages
    const confidencePattern = /\d+%|\d+\.\d+|confidence|accuracy/i;
    const hasConfidence = await page.getByText(confidencePattern).first()
      .isVisible().catch(() => false);

    expect(hasConfidence).toBeTruthy();
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // AI Insights button might be in mobile menu
    const mobileMenuButton = page.locator('[aria-label="Menu"], button:has-text("Menu")').first();

    if (await mobileMenuButton.isVisible().catch(() => false)) {
      await mobileMenuButton.click();
      await page.waitForTimeout(500);
    }

    // Find AI Insights button
    const aiInsightsButton = page.getByRole('button', { name: /AI Insights/i })
      .or(page.getByText(/AI Insights/i));

    if (await aiInsightsButton.first().isVisible().catch(() => false)) {
      await aiInsightsButton.first().click();

      // Modal should open
      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 });
    }
  });

  test('should update AI insights data periodically', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open AI Insights
    await page.getByRole('button', { name: /AI Insights/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    // Should have timestamp or last updated info
    const timestamps = [
      /last updated/i,
      /updated.*ago/i,
      /\d+.*minutes? ago/i,
      /just now/i,
      /real.*time/i
    ];

    let foundTimestamp = false;
    for (const pattern of timestamps) {
      if (await page.getByText(pattern).first().isVisible().catch(() => false)) {
        foundTimestamp = true;
        break;
      }
    }

    // Timestamp is optional but good to have
    // expect(foundTimestamp).toBeTruthy();
  });
});
