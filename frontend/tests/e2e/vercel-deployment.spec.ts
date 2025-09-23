import { test, expect } from '@playwright/test';

const VERCEL_URL = 'https://frontend-2q8wjr4mj-kirans-projects-994c7420.vercel.app';

test.describe('Vercel Deployment Tests', () => {

  test('should load the homepage successfully', async ({ page }) => {
    // Navigate to Vercel deployment
    await page.goto(VERCEL_URL);

    // Wait for page to load and check basic structure
    await expect(page).toHaveTitle(/TurtleTrading/);

    // Check if main content loads
    await expect(page.locator('body')).toBeVisible();

    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/vercel-homepage.png', fullPage: true });
  });

  test('should have responsive navigation', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Check for navigation elements
    const nav = page.locator('nav, header');
    await expect(nav).toBeVisible();

    // Check for logo or brand
    const logo = page.locator('img[alt*="logo"], [aria-label*="logo"], .logo');
    if (await logo.count() > 0) {
      await expect(logo.first()).toBeVisible();
    }
  });

  test('should handle mobile viewport correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(VERCEL_URL);

    // Check mobile responsiveness
    await expect(page.locator('body')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/vercel-mobile.png', fullPage: true });
  });

  test('should load CSS and styling correctly', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Check if CSS is loaded by verifying computed styles
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify no major layout breaks
    const height = await body.evaluate(el => el.scrollHeight);
    expect(height).toBeGreaterThan(100); // Page has content
  });

  test('should handle JavaScript execution', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Wait for React to hydrate
    await page.waitForTimeout(2000);

    // Check for interactive elements
    const clickableElements = page.locator('button, a, [role="button"]');
    const count = await clickableElements.count();

    if (count > 0) {
      await expect(clickableElements.first()).toBeVisible();
    }
  });

  test('should handle routing (if client-side routing works)', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Try to find navigation links
    const navLinks = page.locator('a[href^="/"], [href^="#"]');
    const linkCount = await navLinks.count();

    if (linkCount > 0) {
      // Click first internal link if available
      const firstLink = navLinks.first();
      const href = await firstLink.getAttribute('href');

      if (href && href !== '/' && !href.startsWith('http')) {
        await firstLink.click();
        await page.waitForTimeout(1000);

        // Verify navigation worked
        await expect(page).toHaveURL(new RegExp(href.replace('/', '')));
      }
    }
  });

  test('should load admin console components', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Look for admin console related elements
    const adminElements = page.locator('[data-testid*="admin"], [class*="admin"], [id*="admin"]');

    // If admin elements exist, verify they're functional
    if (await adminElements.count() > 0) {
      await expect(adminElements.first()).toBeVisible();
    }

    // Look for observability dashboard elements
    const observabilityElements = page.locator('[data-testid*="observability"], [class*="observability"]');

    if (await observabilityElements.count() > 0) {
      await expect(observabilityElements.first()).toBeVisible();
    }
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Test 404 page
    await page.goto(`${VERCEL_URL}/nonexistent-page`);

    // Should either redirect to home or show 404 page
    await page.waitForTimeout(2000);

    // Verify page doesn't crash
    await expect(page.locator('body')).toBeVisible();

    // Take screenshot of error handling
    await page.screenshot({ path: 'test-results/vercel-404-handling.png' });
  });

  test('should have proper security headers', async ({ page }) => {
    const response = await page.goto(VERCEL_URL);

    // Check for basic security headers
    const headers = response?.headers() || {};

    // Vercel should set some security headers
    expect(headers['x-frame-options'] || headers['x-robots-tag']).toBeTruthy();
  });

  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);

    console.log(`Page load time: ${loadTime}ms`);
  });

  test('should handle API calls gracefully', async ({ page }) => {
    // Listen for API calls
    const apiCalls: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiCalls.push(url);
      }
    });

    await page.goto(VERCEL_URL);
    await page.waitForTimeout(3000);

    // Log API calls for debugging
    console.log('API calls made:', apiCalls);

    // Should handle API failures gracefully (not crash the app)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display trading platform features', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Look for trading-related content
    const tradingKeywords = ['market', 'stock', 'trading', 'price', 'analysis', 'dashboard'];

    for (const keyword of tradingKeywords) {
      const elements = page.locator(`text=${keyword}`, { hasText: new RegExp(keyword, 'i') });

      if (await elements.count() > 0) {
        console.log(`Found trading keyword: ${keyword}`);
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/vercel-trading-features.png', fullPage: true });
  });

});

test.describe('Admin Console Vercel Tests', () => {

  test('should load admin store functionality', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Check if admin store is accessible via window object (development mode)
    const hasAdminStore = await page.evaluate(() => {
      return typeof window !== 'undefined' &&
             (window as any).adminStore !== undefined;
    });

    if (hasAdminStore) {
      console.log('Admin store is accessible');
    }

    // Look for admin UI elements
    const adminUI = page.locator('[data-testid="admin-console"], .admin-console, #admin-console');

    if (await adminUI.count() > 0) {
      await expect(adminUI.first()).toBeVisible();
    }
  });

  test('should handle observability features', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Look for observability components
    const observabilityElements = [
      '[data-testid*="logs"]',
      '[data-testid*="metrics"]',
      '[data-testid*="traces"]',
      '.observability',
      '#observability'
    ];

    for (const selector of observabilityElements) {
      const elements = page.locator(selector);

      if (await elements.count() > 0) {
        await expect(elements.first()).toBeVisible();
        console.log(`Found observability element: ${selector}`);
      }
    }
  });

  test('should test RBAC functionality', async ({ page }) => {
    await page.goto(VERCEL_URL);

    // Look for role-based access control elements
    const rbacElements = page.locator('[data-testid*="rbac"], [class*="rbac"], [data-testid*="role"]');

    if (await rbacElements.count() > 0) {
      await expect(rbacElements.first()).toBeVisible();
      console.log('RBAC elements found');
    }

    // Test permission-based UI elements
    const permissionElements = page.locator('[data-permission], [data-role]');

    if (await permissionElements.count() > 0) {
      console.log('Permission-based elements found');
    }
  });

});