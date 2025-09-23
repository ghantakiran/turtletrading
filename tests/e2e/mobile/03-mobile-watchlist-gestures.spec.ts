/**
 * Mobile Watchlist Gestures E2E Tests
 * Tests swipe actions, pull-to-refresh, and gesture-based interactions
 */

import { test, expect, devices, type Page } from '@playwright/test';

// Test across multiple mobile devices
const mobileDevices = [
  { name: 'iPhone 14 Pro', device: devices['iPhone 14 Pro'] },
  { name: 'iPhone 13', device: devices['iPhone 13'] },
  { name: 'Samsung Galaxy S23', device: devices['Galaxy S9+'] },
  { name: 'Google Pixel 7', device: devices['Pixel 5'] }
];

mobileDevices.forEach(({ name, device }) => {
  test.describe(`Mobile Watchlist Gestures - ${name}`, () => {
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

      // Mock touch events for gesture testing
      await page.addInitScript(() => {
        // Enhanced touch event simulation
        class MockTouch {
          constructor(
            public identifier: number,
            public clientX: number,
            public clientY: number,
            public pageX: number,
            public pageY: number,
            public target: Element
          ) {}
        }

        class MockTouchList extends Array {
          item(index: number) {
            return this[index];
          }
        }

        window.createTouchEvent = (type: string, touches: any[], target: Element) => {
          const touchList = new MockTouchList();
          touches.forEach(touch => touchList.push(new MockTouch(
            touch.identifier || 0,
            touch.clientX,
            touch.clientY,
            touch.pageX || touch.clientX,
            touch.pageY || touch.clientY,
            target
          )));

          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperties(event, {
            touches: { value: touchList },
            targetTouches: { value: touchList },
            changedTouches: { value: touchList }
          });
          return event;
        };
      });

      await page.goto('/watchlist');
    });

    test('should display mobile watchlist with touch targets', async ({ page }) => {
      // Should show mobile watchlist container
      await expect(page.locator('[data-testid="mobile-watchlist"]')).toBeVisible();

      // Should have touch-friendly stock items
      const stockItems = page.locator('[data-testid*="stock-item-"]');
      expect(await stockItems.count()).toBeGreaterThan(0);

      // Check touch target size
      const firstItem = stockItems.first();
      const height = await firstItem.evaluate(el => el.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44); // iOS minimum touch target

      // Should show swipe indicators
      await expect(page.locator('[data-testid="swipe-hint"]')).toBeVisible();
    });

    test('should handle swipe-to-delete gesture', async ({ page }) => {
      const stockItem = page.locator('[data-testid="stock-item-AAPL"]');
      await expect(stockItem).toBeVisible();

      // Get item position for swipe calculation
      const box = await stockItem.boundingBox();
      if (!box) throw new Error('Stock item not found');

      // Perform swipe left gesture
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      // Should reveal delete action
      await expect(page.locator('[data-testid="delete-action-AAPL"]')).toBeVisible();

      // Click delete
      await page.click('[data-testid="delete-action-AAPL"]');

      // Should show confirmation dialog
      await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();

      // Confirm deletion
      await page.click('[data-testid="confirm-delete"]');

      // Stock should be removed
      await expect(stockItem).not.toBeVisible();
    });

    test('should handle swipe-to-favorite gesture', async ({ page }) => {
      const stockItem = page.locator('[data-testid="stock-item-MSFT"]');
      await expect(stockItem).toBeVisible();

      const box = await stockItem.boundingBox();
      if (!box) throw new Error('Stock item not found');

      // Perform swipe right gesture
      await page.mouse.move(box.x + 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      // Should reveal favorite action
      await expect(page.locator('[data-testid="favorite-action-MSFT"]')).toBeVisible();

      // Click favorite
      await page.click('[data-testid="favorite-action-MSFT"]');

      // Should show favorite indicator
      await expect(page.locator('[data-testid="favorite-indicator-MSFT"]')).toBeVisible();
    });

    test('should handle pull-to-refresh gesture', async ({ page }) => {
      const watchlist = page.locator('[data-testid="mobile-watchlist"]');

      // Get initial scroll position
      const box = await watchlist.boundingBox();
      if (!box) throw new Error('Watchlist not found');

      // Perform pull-to-refresh gesture
      await page.mouse.move(box.x + box.width / 2, box.y + 10);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 150, { steps: 15 });

      // Should show refresh indicator
      await expect(page.locator('[data-testid="refresh-indicator"]')).toBeVisible();

      await page.mouse.up();

      // Should trigger refresh
      await expect(page.locator('[data-testid="refreshing-spinner"]')).toBeVisible();

      // Wait for refresh to complete
      await page.waitForTimeout(2000);
      await expect(page.locator('[data-testid="refreshing-spinner"]')).not.toBeVisible();
    });

    test('should handle long press for context menu', async ({ page }) => {
      const stockItem = page.locator('[data-testid="stock-item-GOOGL"]');
      await expect(stockItem).toBeVisible();

      // Simulate long press
      const box = await stockItem.boundingBox();
      if (!box) throw new Error('Stock item not found');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(800); // Long press duration
      await page.mouse.up();

      // Should show context menu
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      // Should have context menu options
      await expect(page.locator('[data-testid="context-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="context-favorite"]')).toBeVisible();
      await expect(page.locator('[data-testid="context-remove"]')).toBeVisible();
      await expect(page.locator('[data-testid="context-alert"]')).toBeVisible();
    });

    test('should handle two-finger gesture for batch selection', async ({ page }) => {
      // Enable multi-select mode with two-finger gesture
      const watchlist = page.locator('[data-testid="mobile-watchlist"]');
      const box = await watchlist.boundingBox();
      if (!box) throw new Error('Watchlist not found');

      // Simulate two-finger touch
      await page.evaluate((rect) => {
        const element = document.querySelector('[data-testid="mobile-watchlist"]');
        if (element) {
          const event = window.createTouchEvent('touchstart', [
            { identifier: 0, clientX: rect.x + 100, clientY: rect.y + 100 },
            { identifier: 1, clientX: rect.x + 200, clientY: rect.y + 100 }
          ], element);
          element.dispatchEvent(event);
        }
      }, box);

      // Should enter selection mode
      await expect(page.locator('[data-testid="selection-mode"]')).toBeVisible();
      await expect(page.locator('[data-testid="batch-actions"]')).toBeVisible();

      // Select multiple items
      await page.click('[data-testid="stock-item-AAPL"]');
      await page.click('[data-testid="stock-item-MSFT"]');

      // Should show selection count
      await expect(page.locator('[data-testid="selection-count"]')).toContainText('2');

      // Should enable batch actions
      await expect(page.locator('[data-testid="batch-delete"]')).toBeEnabled();
      await expect(page.locator('[data-testid="batch-favorite"]')).toBeEnabled();
    });

    test('should handle gesture feedback and haptics', async ({ page }) => {
      const stockItem = page.locator('[data-testid="stock-item-TSLA"]');

      // Mock haptic feedback
      await page.addInitScript(() => {
        window.hapticFeedback = jest.fn();
        navigator.vibrate = jest.fn();
      });

      const box = await stockItem.boundingBox();
      if (!box) throw new Error('Stock item not found');

      // Perform swipe with haptic feedback
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });

      // Should provide visual feedback during swipe
      await expect(stockItem).toHaveClass(/swiping/);

      await page.mouse.up();

      // Check haptic feedback was triggered
      const hapticCalled = await page.evaluate(() => window.hapticFeedback?.mock?.calls?.length || 0);
      expect(hapticCalled).toBeGreaterThan(0);
    });

    test('should handle gesture conflicts and cancellation', async ({ page }) => {
      const stockItem = page.locator('[data-testid="stock-item-META"]');
      const box = await stockItem.boundingBox();
      if (!box) throw new Error('Stock item not found');

      // Start swipe gesture
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 30, box.y + box.height / 2);

      // Cancel gesture by moving vertically
      await page.mouse.move(box.x + 30, box.y + box.height / 2 + 50);
      await page.mouse.up();

      // Should cancel swipe action
      await expect(page.locator('[data-testid="delete-action-META"]')).not.toBeVisible();
      await expect(stockItem).not.toHaveClass(/swiping/);
    });

    test('should handle accessibility with gestures', async ({ page }) => {
      // Enable screen reader mode
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgent', {
          value: navigator.userAgent + ' ScreenReader'
        });
      });

      const stockItem = page.locator('[data-testid="stock-item-NVDA"]');

      // Should have proper ARIA labels for gestures
      await expect(stockItem).toHaveAttribute('aria-label');

      // Should announce swipe actions
      const ariaDescription = await stockItem.getAttribute('aria-describedby');
      expect(ariaDescription).toBeTruthy();

      // Check gesture alternatives for accessibility
      await expect(page.locator('[data-testid="accessible-actions-NVDA"]')).toBeVisible();
    });

    test('should handle performance with many watchlist items', async ({ page }) => {
      // Mock large watchlist
      await page.route('/api/v1/watchlist', route => {
        const largeWatchlist = Array.from({ length: 100 }, (_, i) => ({
          symbol: `STOCK${i}`,
          name: `Stock Company ${i}`,
          price: 100 + Math.random() * 50,
          change: Math.random() * 10 - 5,
          changePercent: Math.random() * 10 - 5
        }));

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeWatchlist)
        });
      });

      await page.reload();

      // Should handle virtualization for performance
      const visibleItems = page.locator('[data-testid*="stock-item-"]:visible');
      const visibleCount = await visibleItems.count();

      // Should only render visible items (not all 100)
      expect(visibleCount).toBeLessThan(20);

      // Should maintain smooth scrolling
      const startTime = Date.now();
      await page.mouse.wheel(0, 1000);
      const scrollTime = Date.now() - startTime;
      expect(scrollTime).toBeLessThan(100); // Smooth scroll performance
    });

    test('should handle offline gesture functionality', async ({ page, context }) => {
      // Go offline
      await context.setOffline(true);

      const stockItem = page.locator('[data-testid="stock-item-AAPL"]');
      const box = await stockItem.boundingBox();
      if (!box) throw new Error('Stock item not found');

      // Gestures should still work offline
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      // Should show offline actions
      await expect(page.locator('[data-testid="offline-delete-action-AAPL"]')).toBeVisible();

      // Actions should be queued for when online
      await page.click('[data-testid="offline-delete-action-AAPL"]');
      await expect(page.locator('[data-testid="offline-queue-indicator"]')).toBeVisible();
    });
  });
});

test.describe('Mobile Watchlist Edge Cases', () => {
  test.use(devices['iPhone 14 Pro']);

  test('should handle rapid gesture sequences', async ({ page }) => {
    await page.goto('/watchlist');

    const stockItems = page.locator('[data-testid*="stock-item-"]');
    const itemCount = await stockItems.count();

    // Rapid swipe gestures
    for (let i = 0; i < Math.min(3, itemCount); i++) {
      const item = stockItems.nth(i);
      const box = await item.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 3 });
        await page.mouse.up();
        await page.waitForTimeout(100);
      }
    }

    // Should handle all gestures without conflicts
    await expect(page.locator('[data-testid*="delete-action-"]')).toHaveCount(3);
  });

  test('should handle gesture on loading states', async ({ page }) => {
    // Mock slow loading
    await page.route('/api/v1/watchlist', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      }, 3000);
    });

    await page.goto('/watchlist');

    // Should show loading state
    await expect(page.locator('[data-testid="watchlist-loading"]')).toBeVisible();

    // Gestures should be disabled during loading
    const loadingArea = page.locator('[data-testid="watchlist-loading"]');
    const box = await loadingArea.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 50);
      await page.mouse.up();
    }

    // Should not trigger any gesture actions
    await expect(page.locator('[data-testid*="delete-action-"]')).toHaveCount(0);
  });
});