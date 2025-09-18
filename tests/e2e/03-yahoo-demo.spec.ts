import { test, expect } from '@playwright/test';

test.describe('Yahoo Finance Demo Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Yahoo Demo page
    await page.goto('/yahoo-demo');
  });

  test('should display Yahoo Demo page with all components', async ({ page }) => {
    // Check page title and header
    await expect(page.locator('h1')).toContainText('Yahoo Finance UI Demo');
    await expect(page.locator('h2')).toContainText('Professional Trading Interface');

    // Check feature cards in hero section
    await expect(page.locator('text=Interactive Charts')).toBeVisible();
    await expect(page.locator('text=Real-time Data')).toBeVisible();
    await expect(page.locator('text=Modern Components')).toBeVisible();
    await expect(page.locator('text=Yahoo Finance UI')).toBeVisible();

    // Check component tags
    await expect(page.locator('text=Market Overview Dashboard')).toBeVisible();
    await expect(page.locator('text=Stock Price Cards')).toBeVisible();
    await expect(page.locator('text=Interactive Charts')).toBeVisible();
    await expect(page.locator('text=Trending Stocks Carousel')).toBeVisible();
  });

  test('should display market indices with dynamic data', async ({ page }) => {
    // Wait for market indices to load
    await page.waitForSelector('[class*="grid"][class*="grid-cols-2"]');

    // Check if market indices are displayed
    await expect(page.locator('text=S&P 500')).toBeVisible();
    await expect(page.locator('text=NASDAQ')).toBeVisible();
    await expect(page.locator('text=Dow Jones')).toBeVisible();
    await expect(page.locator('text=Russell 2000')).toBeVisible();

    // Check if price data is displayed (should show numbers)
    const priceElements = page.locator('[class*="text-xl"][class*="font-bold"]');
    await expect(priceElements.first()).toBeVisible();
  });

  test('should display trending stocks carousel', async ({ page }) => {
    // Check trending stocks carousel
    await expect(page.locator('text=Trending Now')).toBeVisible();

    // Check if stock symbols are displayed
    await expect(page.locator('text=AAPL')).toBeVisible();
    await expect(page.locator('text=MSFT')).toBeVisible();
    await expect(page.locator('text=NVDA')).toBeVisible();

    // Check carousel navigation
    const nextButton = page.locator('button').filter({ has: page.locator('svg') }).last();
    const prevButton = page.locator('button').filter({ has: page.locator('svg') }).first();

    await expect(nextButton).toBeVisible();
    await expect(prevButton).toBeVisible();
  });

  test('should display top gainers section', async ({ page }) => {
    // Check top gainers
    await expect(page.locator('text=Top Gainers')).toBeVisible();

    // Check if gainer stocks are displayed
    await expect(page.locator('text=AMD')).toBeVisible();
    await expect(page.locator('text=COIN')).toBeVisible();
  });

  test('should display stock price card with details', async ({ page }) => {
    // Check main stock price card (Apple)
    await expect(page.locator('text=Apple Inc.')).toBeVisible();

    // Check if price information is displayed
    await expect(page.locator('text=Live')).toBeVisible();

    // Check if key metrics are shown
    await expect(page.locator('text=Volume')).toBeVisible();
    await expect(page.locator('text=Market Cap')).toBeVisible();
    await expect(page.locator('text=P/E Ratio')).toBeVisible();
  });

  test('should display market news feed', async ({ page }) => {
    // Check market news section
    await expect(page.locator('text=Market News')).toBeVisible();

    // Check if news items are displayed
    await expect(page.locator('text=Federal Reserve')).toBeVisible();
    await expect(page.locator('text=Apple Reports Record')).toBeVisible();
    await expect(page.locator('text=NVIDIA AI Chip')).toBeVisible();

    // Check news filters
    await expect(page.locator('text=All News')).toBeVisible();
    await expect(page.locator('text=Breaking')).toBeVisible();
    await expect(page.locator('text=Earnings')).toBeVisible();
  });

  test('should have working navigation back button', async ({ page }) => {
    // Check back button
    const backButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(backButton).toBeVisible();

    // Check external link to Yahoo Finance
    const yahooLink = page.locator('a[href="https://finance.yahoo.com"]');
    await expect(yahooLink).toBeVisible();
    await expect(yahooLink).toContainText('Yahoo Finance');
  });

  test('should display footer information', async ({ page }) => {
    // Check footer elements
    await expect(page.locator('text=Live Demo Active')).toBeVisible();
    await expect(page.locator('text=Built with')).toBeVisible();
    await expect(page.locator('text=React + TypeScript')).toBeVisible();
    await expect(page.locator('text=© 2025 TurtleTrading')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check if page is still accessible
    await expect(page.locator('h1')).toContainText('Yahoo Finance UI Demo');

    // Check if components adapt to mobile
    const heroSection = page.locator('[class*="gradient"]').first();
    await expect(heroSection).toBeVisible();
  });

  test('should have proper theme support', async ({ page }) => {
    // The components should work in both light and dark themes
    // Check if theme-aware classes are present
    const pageContainer = page.locator('body');
    await expect(pageContainer).toBeVisible();

    // Check if dark mode classes exist in the DOM
    const darkModeElements = page.locator('[class*="dark:"]');
    await expect(darkModeElements.first()).toBeVisible();
  });
});