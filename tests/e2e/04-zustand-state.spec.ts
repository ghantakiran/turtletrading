import { test, expect } from '@playwright/test';

test.describe('Zustand State Management Tests', () => {
  test('should display market connection status from market store', async ({ page }) => {
    await page.goto('/');
    
    // Check header market status indicator
    const headerStatus = page.locator('text=Market Disconnected').first();
    await expect(headerStatus).toBeVisible();
    
    // Check footer status indicator
    const footerStatus = page.locator('text=Connection Issues').first();
    await expect(footerStatus).toBeVisible();
  });

  test('should show watchlist data from market store', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await page.waitForSelector('h1:has-text("Dashboard")');
    
    // Check that watchlist card shows stock count from Zustand store
    const watchlistCard = page.locator('text=My Watchlist').locator('..');
    await expect(watchlistCard).toBeVisible();
    
    // Should show default watchlist with 5 stocks
    const stockCount = watchlistCard.locator('text=5').first();
    await expect(stockCount).toBeVisible();
  });

  test('should display mock market indices data', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await page.waitForSelector('h1:has-text("Dashboard")');
    
    // Check S&P 500 card with mock data
    const spCard = page.locator('text=S&P 500').locator('..');
    await expect(spCard).toBeVisible();
    await expect(spCard.locator('text=4,530.25')).toBeVisible();
    
    // Check NASDAQ card with mock data
    const nasdaqCard = page.locator('text=NASDAQ').locator('..');
    await expect(nasdaqCard).toBeVisible();
    await expect(nasdaqCard.locator('text=15,845.73')).toBeVisible();
  });

  test('should show top movers from mock data', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await page.waitForSelector('h1:has-text("Dashboard")');
    
    // Check top movers section
    const topMoversSection = page.locator('text=Top Movers').locator('..');
    await expect(topMoversSection).toBeVisible();
    
    // Check for AAPL stock data
    const aaplStock = topMoversSection.locator('text=AAPL').locator('..');
    await expect(aaplStock).toBeVisible();
    await expect(aaplStock.locator('text=Apple Inc.')).toBeVisible();
    await expect(aaplStock.locator('text=$175.23')).toBeVisible();
    
    // Check for MSFT stock data
    const msftStock = topMoversSection.locator('text=MSFT').locator('..');
    await expect(msftStock).toBeVisible();
    await expect(msftStock.locator('text=Microsoft Corp.')).toBeVisible();
    await expect(msftStock.locator('text=$378.91')).toBeVisible();
  });

  test('should navigate to different pages and update current page in UI store', async ({ page }) => {
    await page.goto('/');
    
    // Check initial page
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    
    // Navigate to Market page
    await page.click('text=Market');
    await expect(page.locator('h1:has-text("Market Overview")')).toBeVisible();
    
    // Navigate to Settings page
    await page.click('text=Settings');
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
    
    // Navigate back to Dashboard
    await page.click('text=Dashboard');
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  });

  test('should show responsive design changes on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Wait for dashboard to load
    await page.waitForSelector('h1:has-text("Dashboard")');
    
    // Check that mobile menu button is visible
    const mobileMenuButton = page.locator('button[aria-label*="menu"], button:has(svg)').first();
    await expect(mobileMenuButton).toBeVisible();
    
    // Click mobile menu button
    await mobileMenuButton.click();
    
    // Check that mobile navigation is visible
    const mobileNav = page.locator('nav').last();
    await expect(mobileNav).toBeVisible();
  });

  test('should handle state persistence across page reloads', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial load
    await page.waitForSelector('h1:has-text("Dashboard")');
    
    // Reload the page
    await page.reload();
    
    // Check that the page loads correctly again
    await page.waitForSelector('h1:has-text("Dashboard")');
    
    // Verify watchlist data is still there (from persisted state)
    const watchlistCard = page.locator('text=My Watchlist').locator('..');
    await expect(watchlistCard).toBeVisible();
    await expect(watchlistCard.locator('text=5')).toBeVisible();
  });

  test('should show error states gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await page.waitForSelector('h1:has-text("Dashboard")');
    
    // The dashboard should load without error states visible
    // Error states would be shown if there were actual API failures
    const errorCards = page.locator('.bg-bear-50');
    await expect(errorCards).toHaveCount(0);
  });

  test('should display quick actions section', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await page.waitForSelector('h1:has-text("Dashboard")');
    
    // Check quick actions section
    const quickActionsSection = page.locator('text=Quick Actions').locator('..');
    await expect(quickActionsSection).toBeVisible();
    
    // Check for action buttons
    await expect(quickActionsSection.locator('text=📊 Analyze Stock')).toBeVisible();
    await expect(quickActionsSection.locator('text=📈 View Market')).toBeVisible();
    await expect(quickActionsSection.locator('text=🔔 Set Alert')).toBeVisible();
    await expect(quickActionsSection.locator('text=📋 Portfolio')).toBeVisible();
  });
});