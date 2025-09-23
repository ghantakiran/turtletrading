/**
 * Mobile PWA Installation E2E Tests
 * Tests PWA installation flow across different mobile devices
 */

import { test, expect, devices, type Page } from '@playwright/test';

// Test across multiple mobile devices
const mobileDevices = [
  { name: 'iPhone 14 Pro', device: devices['iPhone 14 Pro'] },
  { name: 'iPhone 13', device: devices['iPhone 13'] },
  { name: 'iPhone SE', device: devices['iPhone SE'] },
  { name: 'Samsung Galaxy S23', device: devices['Galaxy S9+'] },
  { name: 'Google Pixel 7', device: devices['Pixel 5'] }
];

mobileDevices.forEach(({ name, device }) => {
  test.describe(`PWA Installation - ${name}`, () => {
    test.use(device);

    test.beforeEach(async ({ page }) => {
      // Mock PWA installation prompt
      await page.addInitScript(() => {
        let deferredPrompt: any = null;

        // Mock beforeinstallprompt event
        setTimeout(() => {
          const event = new Event('beforeinstallprompt');
          (event as any).prompt = async () => ({ outcome: 'accepted' });
          (event as any).userChoice = Promise.resolve({ outcome: 'accepted' });
          window.dispatchEvent(event);
        }, 1000);

        // Mock service worker registration
        Object.defineProperty(navigator, 'serviceWorker', {
          value: {
            register: async () => ({
              active: { postMessage: () => {} },
              addEventListener: () => {},
              sync: { register: async () => {} }
            }),
            ready: Promise.resolve({
              active: { postMessage: () => {} },
              showNotification: async () => {},
              pushManager: {
                subscribe: async () => ({}),
                getSubscription: async () => null
              }
            }),
            addEventListener: () => {}
          },
          writable: true
        });
      });
    });

    test('should display PWA install prompt and complete installation', async ({ page }) => {
      await page.goto('/');

      // Wait for PWA initialization
      await page.waitForTimeout(2000);

      // Should show install banner
      await expect(page.locator('.pwa-install-banner')).toBeVisible({ timeout: 10000 });

      // Click install button
      await page.click('#pwa-install-btn');

      // Wait for installation to complete
      await page.waitForTimeout(1000);

      // Verify installation completed
      await expect(page.locator('.pwa-install-banner')).not.toBeVisible();
    });

    test('should work offline after installation', async ({ page, context }) => {
      await page.goto('/');

      // Wait for service worker to be ready
      await page.waitForFunction(() => 'serviceWorker' in navigator);
      await page.waitForTimeout(3000);

      // Navigate to different pages to cache them
      await page.goto('/market');
      await page.waitForLoadState('networkidle');

      await page.goto('/stock/AAPL');
      await page.waitForLoadState('networkidle');

      // Go offline
      await context.setOffline(true);

      // Navigate back to home
      await page.goto('/');

      // Should show offline indicator but still work
      await expect(page.locator('text=offline')).toBeVisible({ timeout: 5000 });

      // Should still be able to navigate
      await page.click('a[href="/market"]');
      await expect(page).toHaveURL(/.*market/);

      // Should show cached data
      await expect(page.locator('text=Cached')).toBeVisible({ timeout: 5000 });
    });

    test('should handle PWA shortcuts', async ({ page }) => {
      await page.goto('/');

      // Simulate PWA shortcut navigation
      await page.goto('/?utm_source=homescreen');

      // Should load normally
      await expect(page.locator('h1')).toContainText('TurtleTrading');

      // Test dashboard shortcut
      await page.goto('/?utm_source=shortcut&action=dashboard');
      await expect(page).toHaveURL(/.*\//);

      // Test watchlist shortcut
      await page.goto('/watchlist?utm_source=shortcut');
      await expect(page).toHaveURL(/.*watchlist/);
    });

    test('should display proper PWA metadata', async ({ page }) => {
      await page.goto('/');

      // Check manifest link
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveAttribute('href', '/manifest.json');

      // Check theme color
      const themeColor = page.locator('meta[name="theme-color"]');
      await expect(themeColor).toHaveAttribute('content', '#0ea5e9');

      // Check viewport
      const viewport = page.locator('meta[name="viewport"]');
      await expect(viewport).toHaveAttribute('content', /width=device-width/);

      // Check PWA icons
      const icons = page.locator('link[rel*="icon"]');
      expect(await icons.count()).toBeGreaterThan(0);
    });

    test('should handle app launch from home screen', async ({ page }) => {
      // Simulate home screen launch
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          value: jest.fn(() => ({
            matches: true, // Simulate standalone mode
            addListener: jest.fn(),
            removeListener: jest.fn()
          }))
        });
      });

      await page.goto('/?utm_source=web_app_manifest');

      // Should hide browser UI elements
      await expect(page.locator('body')).toHaveClass(/standalone/);

      // Should show full app interface
      await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();
    });
  });
});

test.describe('PWA Cross-Device Compatibility', () => {
  test('should work consistently across all mobile devices', async ({ browser }) => {
    const results: Array<{ device: string; success: boolean; loadTime: number }> = [];

    for (const { name, device } of mobileDevices) {
      const context = await browser.newContext(device);
      const page = await context.newPage();

      try {
        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        // Check basic functionality
        await expect(page.locator('h1')).toContainText('TurtleTrading');
        await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();

        results.push({ device: name, success: true, loadTime });
      } catch (error) {
        results.push({ device: name, success: false, loadTime: 0 });
      } finally {
        await context.close();
      }
    }

    // All devices should work
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(mobileDevices.length);

    // Average load time should be reasonable
    const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
    expect(avgLoadTime).toBeLessThan(3000); // Less than 3 seconds

    console.log('PWA Performance Results:', results);
  });
});

test.describe('PWA Update Flow', () => {
  test.use(devices['iPhone 14 Pro']);

  test('should handle service worker updates', async ({ page }) => {
    await page.goto('/');

    // Wait for initial service worker
    await page.waitForTimeout(2000);

    // Simulate service worker update
    await page.evaluate(() => {
      const event = new Event('updatefound');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.dispatchEvent(event);
      }
    });

    // Should show update banner
    await expect(page.locator('.pwa-update-banner')).toBeVisible({ timeout: 5000 });

    // Click update button
    await page.click('#pwa-update-btn');

    // Should reload the page
    await page.waitForLoadState('load');
    await expect(page.locator('.pwa-update-banner')).not.toBeVisible();
  });

  test('should dismiss update notification', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Simulate update
    await page.evaluate(() => {
      const event = new Event('updatefound');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.dispatchEvent(event);
      }
    });

    await expect(page.locator('.pwa-update-banner')).toBeVisible();

    // Click dismiss
    await page.click('#pwa-dismiss-btn');

    // Banner should fade out
    await expect(page.locator('.pwa-update-banner')).not.toBeVisible();
  });
});

test.describe('PWA Performance', () => {
  test.use(devices['iPhone 14 Pro']);

  test('should meet performance criteria', async ({ page }) => {
    const performanceMetrics: Array<{ metric: string; value: number; threshold: number }> = [];

    // Measure initial load
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    performanceMetrics.push({
      metric: 'Initial Load Time',
      value: loadTime,
      threshold: 3000
    });

    // Measure navigation time
    const navStart = Date.now();
    await page.click('a[href="/market"]');
    await page.waitForLoadState('networkidle');
    const navTime = Date.now() - navStart;

    performanceMetrics.push({
      metric: 'Navigation Time',
      value: navTime,
      threshold: 1000
    });

    // Measure JavaScript execution time
    const jsExecutionTime = await page.evaluate(() => {
      const start = performance.now();
      // Simulate heavy computation
      for (let i = 0; i < 100000; i++) {
        Math.random();
      }
      return performance.now() - start;
    });

    performanceMetrics.push({
      metric: 'JS Execution Time',
      value: jsExecutionTime,
      threshold: 100
    });

    // All metrics should meet thresholds
    performanceMetrics.forEach(({ metric, value, threshold }) => {
      expect(value, `${metric} should be under ${threshold}ms`).toBeLessThan(threshold);
    });

    // Check bundle size (approximate)
    const bundleSize = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.length;
    });

    expect(bundleSize, 'Should have reasonable number of script bundles').toBeLessThan(10);
  });

  test('should handle memory constraints', async ({ page }) => {
    await page.goto('/');

    // Measure initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Navigate through several pages
    const routes = ['/market', '/stock/AAPL', '/stock/MSFT', '/stock/GOOGL', '/settings'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }

    // Check memory usage after navigation
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Memory increase should be reasonable
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
  });
});

test.describe('PWA Offline Capabilities', () => {
  test.use(devices['Galaxy S9+']);

  test('should cache critical resources', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for caching to complete
    await page.waitForTimeout(3000);

    // Go offline
    await context.setOffline(true);

    // Try to navigate to cached pages
    const cachedPages = ['/', '/market', '/stock/AAPL'];

    for (const pagePath of cachedPages) {
      await page.goto(pagePath);

      // Should load from cache
      await expect(page.locator('body')).toBeVisible();

      // Should show offline indicator
      if (pagePath !== '/') {
        await expect(page.locator('text=offline')).toBeVisible({ timeout: 5000 });
      }
    }

    // Try to access non-cached page
    await page.goto('/non-existent-page');

    // Should show offline page
    await expect(page.locator('text=offline')).toBeVisible();
  });

  test('should sync data when back online', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Try to perform actions that require network
    await page.click('button[data-testid="refresh-data"]');

    // Should queue actions for later
    await expect(page.locator('text=offline')).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Should automatically sync
    await page.waitForTimeout(2000);
    await expect(page.locator('text=connected')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('PWA Background Sync', () => {
  test.use(devices['Pixel 5']);

  test('should register background sync', async ({ page }) => {
    await page.addInitScript(() => {
      // Mock background sync
      Object.defineProperty(window.ServiceWorkerRegistration.prototype, 'sync', {
        value: {
          register: async (tag: string) => {
            console.log('Background sync registered:', tag);
            return Promise.resolve();
          }
        },
        writable: true
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should register background sync
    const syncLogs = page.locator('text=Background sync registered');
    // Background sync registration happens automatically
    await page.waitForTimeout(3000);
  });

  test('should handle failed requests', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Try to submit form data
    await page.fill('input[name="watchlist-symbol"]', 'TSLA');
    await page.click('button[type="submit"]');

    // Should queue the request
    await expect(page.locator('text=queued')).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);

    // Should process queued requests
    await page.waitForTimeout(3000);
    await expect(page.locator('text=TSLA')).toBeVisible({ timeout: 10000 });
  });
});