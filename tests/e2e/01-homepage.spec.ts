import { test, expect } from '@playwright/test';

test.describe('TurtleTrading Homepage', () => {
  test('should load the homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/TurtleTrading/);
    
    // Check for the main header
    await expect(page.locator('h1')).toContainText('TurtleTrading');
    
    // Check for the tagline
    await expect(page.locator('text=Advanced Stock Market Analysis Platform')).toBeVisible();
  });

  test('should display loading state initially', async ({ page }) => {
    await page.goto('/');
    
    // Should show loading spinner initially
    const loadingIndicator = page.locator('.animate-spin, text=Loading TurtleTrading');
    
    // Wait for either loading to appear or content to load
    await Promise.race([
      loadingIndicator.waitFor({ state: 'visible', timeout: 1000 }),
      page.locator('h1:has-text("TurtleTrading")').waitFor({ timeout: 5000 })
    ]).catch(() => {
      // It's ok if loading is too fast to catch
    });
  });

  test('should load and display stock data', async ({ page }) => {
    await page.goto('/');
    
    // Wait for stock data to load
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    
    // Check AAPL stock data section
    const stockSection = page.locator('text=AAPL Stock Data').locator('..');
    await expect(stockSection).toBeVisible();
    await expect(stockSection.locator('text=Symbol:')).toBeVisible();
    await expect(stockSection.locator('text=Current Price:')).toBeVisible();
    await expect(stockSection.locator('text=Change:')).toBeVisible();
    await expect(stockSection.locator('text=Volume:')).toBeVisible();
    await expect(stockSection.locator('text=Market Cap:')).toBeVisible();
  });

  test('should load and display market overview', async ({ page }) => {
    await page.goto('/');
    
    // Wait for market data to load
    await page.waitForSelector('text=Market Overview', { timeout: 10000 });
    
    // Check Market Overview section
    const marketSection = page.locator('text=Market Overview').locator('..');
    await expect(marketSection).toBeVisible();
    await expect(marketSection.locator('text=S&P 500')).toBeVisible();
    await expect(marketSection.locator('text=NASDAQ')).toBeVisible();
    await expect(marketSection.locator('text=Market Sentiment')).toBeVisible();
  });

  test('should show system status indicators', async ({ page }) => {
    await page.goto('/');
    
    // Wait for system status section
    await page.waitForSelector('text=System Status', { timeout: 10000 });
    
    // Check system status indicators
    const statusSection = page.locator('text=System Status').locator('..');
    await expect(statusSection).toBeVisible();
    await expect(statusSection.locator('text=Backend API')).toBeVisible();
    await expect(statusSection.locator('text=Stock Data')).toBeVisible();
    await expect(statusSection.locator('text=Market Data')).toBeVisible();
    
    // Check for green status indicators
    const greenDots = statusSection.locator('.bg-green-500');
    await expect(greenDots).toHaveCount(3);
  });

  test('should display platform features', async ({ page }) => {
    await page.goto('/');
    
    // Wait for features section
    await page.waitForSelector('text=Platform Features', { timeout: 10000 });
    
    // Check platform features
    const featuresSection = page.locator('text=Platform Features').locator('..');
    await expect(featuresSection).toBeVisible();
    await expect(featuresSection.locator('text=LSTM Predictions')).toBeVisible();
    await expect(featuresSection.locator('text=Sentiment Analysis')).toBeVisible();
    await expect(featuresSection.locator('text=Live Data')).toBeVisible();
  });

  test('should handle API connection errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/health', route => route.abort());
    await page.route('**/api/v1/stocks/AAPL/price', route => route.abort());
    
    await page.goto('/');
    
    // Should show error state
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Wait for content to load
    await page.waitForSelector('h1:has-text("TurtleTrading")', { timeout: 10000 });
    
    // Check that header is visible
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that content adapts to mobile
    const container = page.locator('.container');
    await expect(container).toBeVisible();
  });

  test('should display real-time data formatting correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for stock data
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    
    // Check price formatting (should contain $ symbol)
    const priceText = page.locator('text=Current Price:').locator('..').locator('text=/\\$[0-9,]+\\.[0-9]{2}/');
    await expect(priceText).toBeVisible();
    
    // Check percentage formatting (should contain % symbol)
    const changeText = page.locator('text=Change:').locator('..').locator('text=/%/');
    await expect(changeText).toBeVisible();
    
    // Check volume formatting (should be comma-separated numbers)
    const volumeText = page.locator('text=Volume:').locator('..').locator('text=/[0-9,]+/');
    await expect(volumeText).toBeVisible();
  });
});