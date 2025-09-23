/**
 * Mobile Stock Detail Navigation E2E Tests
 * Tests swipe navigation between stocks, tab interactions, and mobile-specific features
 */

import { test, expect, devices, type Page } from '@playwright/test';

// Test across multiple mobile devices
const mobileDevices = [
  { name: 'iPhone 14 Pro', device: devices['iPhone 14 Pro'] },
  { name: 'iPhone 13', device: devices['iPhone 13'] },
  { name: 'Samsung Galaxy S23', device: devices['Galaxy S9+'] },
  { name: 'Google Pixel 7', device: devices['Pixel 5'] }
];

const testStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

mobileDevices.forEach(({ name, device }) => {
  test.describe(`Mobile Stock Detail Navigation - ${name}`, () => {
    test.use(device);

    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('auth-token', 'mock-token');
        localStorage.setItem('user', JSON.stringify({
          id: '1',
          email: 'demo@turtletrading.com',
          firstName: 'Demo',
          lastName: 'User'
        }));
      });

      // Mock stock data
      await page.route('/api/v1/stocks/*/price', route => {
        const url = route.request().url();
        const symbol = url.match(/stocks\/([^\/]+)\/price/)?.[1] || 'UNKNOWN';

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            symbol,
            price: 150 + Math.random() * 100,
            previousClose: 145,
            change: 5.25,
            changePercent: 3.62,
            volume: 1234567,
            marketCap: 2500000000000,
            dayHigh: 155.50,
            dayLow: 148.25
          })
        });
      });

      await page.route('/api/v1/stocks/*/technical', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rsi: 65.5,
            macd: { value: 2.5, signal: 2.1, histogram: 0.4, trend: 1.0 },
            bollinger: { upper: 160, middle: 150, lower: 140, position: 0.7 },
            sma20: 148.5,
            sma50: 145.2,
            technicalScore: 0.72
          })
        });
      });

      await page.goto('/stock/AAPL');
    });

    test('should display mobile stock detail view', async ({ page }) => {
      // Should show mobile stock detail container
      await expect(page.locator('[data-testid="mobile-stock-detail"]')).toBeVisible();

      // Should display stock header with key info
      await expect(page.locator('[data-testid="stock-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('AAPL');
      await expect(page.locator('[data-testid="stock-price"]')).toBeVisible();
      await expect(page.locator('[data-testid="stock-change"]')).toBeVisible();

      // Should show swipe navigation indicators
      await expect(page.locator('[data-testid="navigation-dots"]')).toBeVisible();
      await expect(page.locator('[data-testid="swipe-hint"]')).toBeVisible();

      // Should display tab navigation
      await expect(page.locator('[data-testid="tab-navigation"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-technical"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-ai"]')).toBeVisible();
    });

    test('should handle swipe navigation between stocks', async ({ page }) => {
      // Get initial stock symbol
      const initialSymbol = await page.locator('[data-testid="stock-symbol"]').textContent();

      // Get container for swipe gesture
      const container = page.locator('[data-testid="mobile-stock-detail"]');
      const box = await container.boundingBox();
      if (!box) throw new Error('Stock detail container not found');

      // Swipe left to next stock
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      // Should navigate to next stock
      await page.waitForTimeout(500);
      const newSymbol = await page.locator('[data-testid="stock-symbol"]').textContent();
      expect(newSymbol).not.toBe(initialSymbol);

      // Should update URL
      await expect(page).toHaveURL(new RegExp(`/stock/${newSymbol}`));

      // Should update navigation dots
      await expect(page.locator('[data-testid="navigation-dots"] .active')).toBeVisible();
    });

    test('should handle swipe back to previous stock', async ({ page }) => {
      // Navigate to next stock first
      const container = page.locator('[data-testid="mobile-stock-detail"]');
      const box = await container.boundingBox();
      if (!box) throw new Error('Container not found');

      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);
      const secondSymbol = await page.locator('[data-testid="stock-symbol"]').textContent();

      // Swipe right to go back
      await page.mouse.move(box.x + 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);
      const backSymbol = await page.locator('[data-testid="stock-symbol"]').textContent();
      expect(backSymbol).not.toBe(secondSymbol);
    });

    test('should handle tab navigation', async ({ page }) => {
      // Should start on Overview tab
      await expect(page.locator('[data-testid="tab-overview"]')).toHaveClass(/active/);
      await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();

      // Switch to Technical tab
      await page.click('[data-testid="tab-technical"]');
      await expect(page.locator('[data-testid="tab-technical"]')).toHaveClass(/active/);
      await expect(page.locator('[data-testid="technical-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="overview-content"]')).not.toBeVisible();

      // Switch to AI tab
      await page.click('[data-testid="tab-ai"]');
      await expect(page.locator('[data-testid="tab-ai"]')).toHaveClass(/active/);
      await expect(page.locator('[data-testid="ai-content"]')).toBeVisible();

      // Should maintain tab state during stock navigation
      await page.mouse.move(100, 300);
      await page.mouse.down();
      await page.mouse.move(300, 300, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);
      await expect(page.locator('[data-testid="tab-ai"]')).toHaveClass(/active/);
    });

    test('should handle horizontal scrolling in tabs', async ({ page }) => {
      // Go to Technical tab
      await page.click('[data-testid="tab-technical"]');

      // Should have horizontally scrollable indicators
      const scrollContainer = page.locator('[data-testid="technical-indicators-scroll"]');
      await expect(scrollContainer).toBeVisible();

      const box = await scrollContainer.boundingBox();
      if (!box) throw new Error('Scroll container not found');

      // Scroll horizontally through indicators
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      // Should show different indicators
      await expect(page.locator('[data-testid="indicator-rsi"]')).toBeVisible();
      await expect(page.locator('[data-testid="indicator-macd"]')).toBeVisible();
    });

    test('should handle pinch-to-zoom on charts', async ({ page }) => {
      // Go to overview tab with chart
      await page.click('[data-testid="tab-overview"]');
      await expect(page.locator('[data-testid="price-chart"]')).toBeVisible();

      const chart = page.locator('[data-testid="price-chart"]');
      const box = await chart.boundingBox();
      if (!box) throw new Error('Chart not found');

      // Simulate pinch gesture
      await page.evaluate((rect) => {
        const chart = document.querySelector('[data-testid="price-chart"]');
        if (chart) {
          // Mock touch events for pinch
          const touchStart = new TouchEvent('touchstart', {
            touches: [
              new Touch({ identifier: 0, target: chart, clientX: rect.x + 100, clientY: rect.y + 100 }),
              new Touch({ identifier: 1, target: chart, clientX: rect.x + 200, clientY: rect.y + 100 })
            ]
          });

          chart.dispatchEvent(touchStart);

          // Pinch out (zoom in)
          setTimeout(() => {
            const touchMove = new TouchEvent('touchmove', {
              touches: [
                new Touch({ identifier: 0, target: chart, clientX: rect.x + 50, clientY: rect.y + 100 }),
                new Touch({ identifier: 1, target: chart, clientX: rect.x + 250, clientY: rect.y + 100 })
              ]
            });
            chart.dispatchEvent(touchMove);
          }, 100);
        }
      }, box);

      // Should zoom chart
      await expect(page.locator('[data-testid="chart-zoom-level"]')).toContainText(/zoom/i);
    });

    test('should handle quick actions on mobile', async ({ page }) => {
      // Should show mobile action buttons
      await expect(page.locator('[data-testid="mobile-actions"]')).toBeVisible();
      await expect(page.locator('[data-testid="add-watchlist-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="set-alert-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="share-btn"]')).toBeVisible();

      // Test add to watchlist
      await page.click('[data-testid="add-watchlist-btn"]');
      await expect(page.locator('[data-testid="watchlist-confirmation"]')).toBeVisible();

      // Test share functionality
      await page.addInitScript(() => {
        navigator.share = jest.fn().mockResolvedValue(undefined);
      });

      await page.click('[data-testid="share-btn"]');
      const shareWasCalled = await page.evaluate(() => navigator.share?.mock?.calls?.length > 0);
      expect(shareWasCalled).toBe(true);
    });

    test('should handle pull-to-refresh on stock detail', async ({ page }) => {
      const container = page.locator('[data-testid="mobile-stock-detail"]');
      const box = await container.boundingBox();
      if (!box) throw new Error('Container not found');

      // Pull down to refresh
      await page.mouse.move(box.x + box.width / 2, box.y + 10);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 150, { steps: 15 });

      // Should show refresh indicator
      await expect(page.locator('[data-testid="refresh-indicator"]')).toBeVisible();

      await page.mouse.up();

      // Should trigger data refresh
      await expect(page.locator('[data-testid="refreshing-spinner"]')).toBeVisible();
      await page.waitForTimeout(2000);
      await expect(page.locator('[data-testid="refreshing-spinner"]')).not.toBeVisible();
    });

    test('should handle landscape orientation', async ({ page, context }) => {
      // Simulate landscape orientation
      await page.setViewportSize({ width: 812, height: 375 });

      // Should adapt layout for landscape
      await expect(page.locator('[data-testid="landscape-layout"]')).toBeVisible();

      // Tabs should be side-by-side in landscape
      const tabContainer = page.locator('[data-testid="tab-navigation"]');
      const containerClass = await tabContainer.getAttribute('class');
      expect(containerClass).toContain('landscape');

      // Chart should take more space
      const chart = page.locator('[data-testid="price-chart"]');
      const chartHeight = await chart.evaluate(el => el.getBoundingClientRect().height);
      expect(chartHeight).toBeGreaterThan(200);
    });

    test('should handle navigation edge cases', async ({ page }) => {
      // Test swipe at beginning of stock list
      const container = page.locator('[data-testid="mobile-stock-detail"]');
      const box = await container.boundingBox();
      if (!box) throw new Error('Container not found');

      // Try to swipe right when at first stock
      await page.mouse.move(box.x + 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      // Should show bounce effect but not navigate
      await expect(page.locator('[data-testid="bounce-indicator"]')).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.locator('[data-testid="bounce-indicator"]')).not.toBeVisible();
    });

    test('should handle loading states during navigation', async ({ page }) => {
      // Mock slow API response
      await page.route('/api/v1/stocks/*/price', route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              symbol: 'SLOW',
              price: 100,
              change: 0,
              changePercent: 0
            })
          });
        }, 2000);
      });

      const container = page.locator('[data-testid="mobile-stock-detail"]');
      const box = await container.boundingBox();
      if (!box) throw new Error('Container not found');

      // Navigate to next stock
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      // Should show loading state
      await expect(page.locator('[data-testid="stock-loading"]')).toBeVisible();

      // Navigation should be disabled during loading
      const navigationDots = page.locator('[data-testid="navigation-dots"]');
      await expect(navigationDots).toHaveClass(/disabled/);
    });

    test('should handle accessibility with voice navigation', async ({ page }) => {
      // Mock screen reader
      await page.addInitScript(() => {
        window.speechSynthesis = {
          speak: jest.fn(),
          cancel: jest.fn(),
          getVoices: jest.fn(() => [])
        };
      });

      // Enable voice navigation
      await page.click('[data-testid="accessibility-menu"]');
      await page.click('[data-testid="enable-voice-nav"]');

      // Should announce stock changes
      const container = page.locator('[data-testid="mobile-stock-detail"]');
      const box = await container.boundingBox();
      if (!box) throw new Error('Container not found');

      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(1000);

      const speechCalls = await page.evaluate(() => window.speechSynthesis?.speak?.mock?.calls?.length || 0);
      expect(speechCalls).toBeGreaterThan(0);
    });

    test('should handle offline stock detail viewing', async ({ page, context }) => {
      // Load stock data first
      await page.waitForLoadState('networkidle');

      // Go offline
      await context.setOffline(true);

      // Should show offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

      // Navigation should still work with cached data
      const container = page.locator('[data-testid="mobile-stock-detail"]');
      const box = await container.boundingBox();
      if (!box) throw new Error('Container not found');

      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      // Should show cached data indicator
      await expect(page.locator('[data-testid="cached-data-indicator"]')).toBeVisible();
    });
  });
});

test.describe('Mobile Stock Detail Performance', () => {
  test.use(devices['iPhone 14 Pro']);

  test('should handle rapid navigation without performance issues', async ({ page }) => {
    await page.goto('/stock/AAPL');

    const container = page.locator('[data-testid="mobile-stock-detail"]');
    const box = await container.boundingBox();
    if (!box) throw new Error('Container not found');

    const startTime = Date.now();

    // Rapid navigation sequence
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 3 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(3000); // Should complete in under 3 seconds

    // UI should remain responsive
    await expect(page.locator('[data-testid="stock-symbol"]')).toBeVisible();
  });

  test('should maintain 60fps during animations', async ({ page }) => {
    await page.goto('/stock/AAPL');

    // Monitor frame rate during navigation
    await page.evaluate(() => {
      window.frameCount = 0;
      window.startTime = performance.now();

      function countFrames() {
        window.frameCount++;
        if (performance.now() - window.startTime < 1000) {
          requestAnimationFrame(countFrames);
        }
      }
      requestAnimationFrame(countFrames);
    });

    const container = page.locator('[data-testid="mobile-stock-detail"]');
    const box = await container.boundingBox();
    if (!box) throw new Error('Container not found');

    // Perform navigation with animation
    await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(1000);

    const fps = await page.evaluate(() => window.frameCount);
    expect(fps).toBeGreaterThan(50); // Close to 60fps
  });
});