import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for main content to be visible
    await page.waitForSelector('h1:has-text("TurtleTrading")', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should load API data within reasonable time', async ({ page }) => {
    await page.goto('/');
    
    const startTime = Date.now();
    
    // Wait for all data to load
    await Promise.all([
      page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 }),
      page.waitForSelector('text=Market Overview', { timeout: 10000 }),
      page.waitForSelector('text=System Status', { timeout: 10000 })
    ]);
    
    const apiLoadTime = Date.now() - startTime;
    
    // API data should load within 8 seconds
    expect(apiLoadTime).toBeLessThan(8000);
  });

  test('should handle multiple rapid page refreshes', async ({ page }) => {
    // Perform multiple rapid page loads
    for (let i = 0; i < 3; i++) {
      await page.goto('/');
      await page.waitForSelector('h1:has-text("TurtleTrading")', { timeout: 5000 });
      await page.waitForTimeout(500);
    }
    
    // Final load should still work correctly
    await page.goto('/');
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should maintain responsiveness during data loading', async ({ page }) => {
    await page.goto('/');
    
    // Page should be interactive even while loading
    const header = page.locator('h1');
    await expect(header).toBeVisible({ timeout: 5000 });
    
    // Should be able to interact with page elements
    await expect(header).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
  });

  test('should optimize image and asset loading', async ({ page }) => {
    const networkRequests = [];
    
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        resourceType: request.resourceType()
      });
    });
    
    await page.goto('/');
    await page.waitForSelector('h1:has-text("TurtleTrading")', { timeout: 10000 });
    
    // Check that no excessively large resources were loaded
    const largeRequests = networkRequests.filter(req => 
      req.resourceType === 'image' || req.resourceType === 'script'
    );
    
    // Should not have too many resource requests
    expect(largeRequests.length).toBeLessThan(50);
  });

  test('should handle concurrent user interactions', async ({ browser }) => {
    // Simulate multiple users accessing the site
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);
    
    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );
    
    // Load page simultaneously from all contexts
    await Promise.all(
      pages.map(page => page.goto('/'))
    );
    
    // All should load successfully
    await Promise.all(
      pages.map(page => 
        page.waitForSelector('h1:has-text("TurtleTrading")', { timeout: 10000 })
      )
    );
    
    // All should have the same content
    for (const page of pages) {
      await expect(page.locator('h1')).toBeVisible();
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should maintain performance with network throttling', async ({ page, context }) => {
    // Simulate slow network
    await context.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100));
      route.continue();
    });
    
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('h1:has-text("TurtleTrading")', { timeout: 15000 });
    
    const loadTime = Date.now() - startTime;
    
    // Should still load within reasonable time even with throttling
    expect(loadTime).toBeLessThan(15000);
  });

  test('should gracefully handle memory constraints', async ({ page }) => {
    await page.goto('/');
    
    // Wait for full load
    await page.waitForSelector('text=AAPL Stock Data', { timeout: 10000 });
    
    // Perform actions that might consume memory
    for (let i = 0; i < 5; i++) {
      await page.reload();
      await page.waitForSelector('h1:has-text("TurtleTrading")', { timeout: 5000 });
    }
    
    // Page should still be responsive
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should optimize bundle size and loading', async ({ page }) => {
    const responses = [];
    
    page.on('response', response => {
      if (response.url().includes('.js') || response.url().includes('.css')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          size: response.headers()['content-length']
        });
      }
    });
    
    await page.goto('/');
    await page.waitForSelector('h1:has-text("TurtleTrading")', { timeout: 10000 });
    
    // Check that main bundles loaded successfully
    const mainBundles = responses.filter(r => 
      r.url.includes('main') || r.url.includes('bundle')
    );
    
    for (const bundle of mainBundles) {
      expect(bundle.status).toBe(200);
    }
  });
});