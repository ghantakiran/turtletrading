/**
 * E2E Tests for Backend-Frontend Integration
 * Testing Issue #15: Backend-Frontend API Connection
 */

import { test, expect } from '@playwright/test';

test.describe('Backend-Frontend Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('https://frontend-nextjs-jua5sqa4s-kirans-projects-994c7420.vercel.app');
  });

  test('should connect to backend API for stock data', async ({ page }) => {
    // Test that frontend can successfully call backend APIs

    // Navigate to stock analysis page
    await page.click('[data-testid="stock-analysis-link"]');

    // Wait for API call to complete
    const response = await page.waitForResponse(response =>
      response.url().includes('/api/v1/stocks/') && response.status() === 200
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toHaveProperty('symbol');

    // Verify stock data is displayed
    await expect(page.locator('[data-testid="stock-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="stock-chart"]')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Test error handling when backend is unavailable

    // Mock API failure
    await page.route('**/api/v1/stocks/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.click('[data-testid="stock-analysis-link"]');

    // Verify error state is shown
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should load watchlist data from backend', async ({ page }) => {
    // Test watchlist integration with backend

    await page.click('[data-testid="watchlist-button"]');

    // Wait for watchlist API call
    const response = await page.waitForResponse(response =>
      response.url().includes('/api/v1/watchlist') && response.status() === 200
    );

    expect(response.status()).toBe(200);

    // Verify watchlist items are displayed
    await expect(page.locator('[data-testid="watchlist-items"]')).toBeVisible();
  });

  test('should receive real-time price updates via WebSocket', async ({ page }) => {
    // Test WebSocket connection for real-time data

    await page.goto('/dashboard');

    // Listen for WebSocket messages
    let websocketConnected = false;
    page.on('websocket', ws => {
      ws.on('framerecieved', event => {
        const data = JSON.parse(event.payload);
        if (data.type === 'price_update') {
          websocketConnected = true;
        }
      });
    });

    // Wait for WebSocket connection and data
    await page.waitForTimeout(5000);
    expect(websocketConnected).toBe(true);
  });
});