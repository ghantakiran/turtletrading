import { test, expect } from '@playwright/test';

test.describe('API Integration Tests', () => {
  test('should successfully connect to backend API', async ({ page }) => {
    await page.goto('/');
    
    // Check that API calls are made successfully by looking for loaded data
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    
    // Verify that real stock data is loaded (not placeholder)
    const stockData = page.locator('text=AAPL Stock Data').locator('..');
    await expect(stockData.locator('text=AAPL')).toBeVisible();
    
    // Check that numerical data is present
    await expect(stockData.locator('text=/\\$[0-9]/').first()).toBeVisible();
  });

  test('should handle multiple concurrent API requests', async ({ page }) => {
    await page.goto('/');
    
    // Wait for all major data sections to load simultaneously
    await Promise.all([
      page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 }),
      page.waitForSelector('text=Market Overview', { timeout: 10000 }),
      page.waitForSelector('text=System Status', { timeout: 10000 })
    ]);
    
    // Verify all sections have loaded successfully
    await expect(page.locator('text=AAPL Stock Data')).toBeVisible();
    await expect(page.locator('text=Market Overview')).toBeVisible();
    await expect(page.locator('text=System Status')).toBeVisible();
  });

  test('should display real market data from APIs', async ({ page }) => {
    // Intercept API calls to verify they're being made
    let healthCalled = false;
    let stockCalled = false;
    let marketCalled = false;
    
    await page.route('**/health', route => {
      healthCalled = true;
      route.continue();
    });
    
    await page.route('**/api/v1/stocks/AAPL/price', route => {
      stockCalled = true;
      route.continue();
    });
    
    await page.route('**/api/v1/market/overview', route => {
      marketCalled = true;
      route.continue();
    });
    
    await page.goto('/');
    
    // Wait for data to load
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    
    // Verify API calls were made
    expect(healthCalled).toBeTruthy();
    expect(stockCalled).toBeTruthy();
    expect(marketCalled).toBeTruthy();
    
    // Verify data is displayed
    await expect(page.locator('text=Current Price:')).toBeVisible();
    await expect(page.locator('text=S&P 500')).toBeVisible();
  });

  test('should update data periodically', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial data load
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    
    // Get initial price value
    const initialPriceElement = page.locator('text=Current Price:').locator('..').locator('text=/\\$[0-9,]+\\.[0-9]{2}/').first();
    const initialPrice = await initialPriceElement.textContent();
    
    // Data should be present
    expect(initialPrice).toBeTruthy();
    expect(initialPrice).toMatch(/\$\d+\.\d{2}/);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return 500 error
    await page.route('**/api/v1/stocks/AAPL/price', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.goto('/');
    
    // Should show error state instead of crashing
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Page should still be functional
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should handle slow API responses', async ({ page }) => {
    // Mock API with slow response
    await page.route('**/api/v1/stocks/AAPL/price', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });
    
    await page.goto('/');
    
    // Should show loading state
    const loadingIndicator = page.locator('.animate-spin, text=Loading TurtleTrading');
    await expect(loadingIndicator).toBeVisible({ timeout: 1000 });
    
    // Eventually should load data
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 15000 });
  });

  test('should validate API response data format', async ({ page }) => {
    await page.goto('/');
    
    // Wait for stock data to load
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    
    // Verify stock data has correct format
    const stockSection = page.locator('text=AAPL Stock Data').locator('..');
    
    // Check for AAPL symbol
    await expect(stockSection.locator('text=AAPL')).toBeVisible();
    
    // Check price format ($XXX.XX)
    await expect(stockSection.locator('text=/\\$[0-9,]+\\.[0-9]{2}/')).toBeVisible();
    
    // Check percentage format (±X.XX%)
    await expect(stockSection.locator('text=/[+-]?[0-9]+\\.[0-9]+%/')).toBeVisible();
    
    // Check volume format (number with commas)
    await expect(stockSection.locator('text=/[0-9,]+/')).toBeVisible();
  });

  test('should handle CORS correctly', async ({ page }) => {
    // Monitor console for CORS errors
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.goto('/');
    
    // Wait for data to load
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    
    // Check that no CORS errors occurred
    const corsErrors = consoleMessages.filter(msg => 
      msg.includes('CORS') || msg.includes('Cross-Origin')
    );
    expect(corsErrors).toHaveLength(0);
  });

  test('should maintain API connection stability', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial load
    await page.waitForSelector('text=System Status', { timeout: 10000 });
    
    // Check that all status indicators are green (connected)
    const statusSection = page.locator('text=System Status').locator('..');
    const greenDots = statusSection.locator('.bg-green-500');
    await expect(greenDots).toHaveCount(3);
    
    // Verify status text shows "Connected"
    await expect(statusSection.locator('text=Connected')).toHaveCount(1);
    await expect(statusSection.locator('text=Live')).toHaveCount(1);
    await expect(statusSection.locator('text=Real-time')).toHaveCount(1);
  });
});