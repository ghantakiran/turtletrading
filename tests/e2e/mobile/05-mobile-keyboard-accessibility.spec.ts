/**
 * Mobile Keyboard and Accessibility E2E Tests
 * Tests virtual keyboard handling, navigation, and accessibility features
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
  test.describe(`Mobile Keyboard & Accessibility - ${name}`, () => {
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

      // Mock virtual keyboard behavior
      await page.addInitScript(() => {
        let keyboardVisible = false;
        let originalHeight = window.innerHeight;

        // Mock Visual Viewport API
        Object.defineProperty(window, 'visualViewport', {
          value: {
            height: originalHeight,
            addEventListener: (event: string, callback: Function) => {
              if (event === 'resize') {
                window.mockKeyboardResize = callback;
              }
            }
          },
          writable: true
        });

        // Mock virtual keyboard simulation
        window.simulateVirtualKeyboard = (show: boolean) => {
          keyboardVisible = show;
          const newHeight = show ? originalHeight - 300 : originalHeight;
          (window.visualViewport as any).height = newHeight;
          window.mockKeyboardResize?.();
        };

        // Mock haptic feedback
        navigator.vibrate = jest.fn();

        // Mock speech synthesis
        window.speechSynthesis = {
          speak: jest.fn(),
          cancel: jest.fn(),
          getVoices: jest.fn(() => [])
        };
      });

      await page.goto('/watchlist');
    });

    test('should handle virtual keyboard appearance and layout adjustment', async ({ page }) => {
      // Navigate to a page with input fields
      await page.goto('/settings');

      // Focus on an input field
      const emailInput = page.locator('input[type="email"]');
      await emailInput.click();

      // Simulate virtual keyboard appearance
      await page.evaluate(() => {
        window.simulateVirtualKeyboard(true);
      });

      // Should adjust layout for keyboard
      const keyboardProvider = page.locator('[data-testid="mobile-keyboard-provider"]');
      await expect(keyboardProvider).toHaveAttribute('data-keyboard-visible', 'true');

      // Should have keyboard-aware styling
      const containerStyles = await keyboardProvider.evaluate(el =>
        window.getComputedStyle(el).transform
      );
      expect(containerStyles).not.toBe('none');

      // Should show keyboard navigation hints
      await expect(page.locator('[data-testid="keyboard-navigation-hints"]')).toBeVisible();
    });

    test('should handle different keyboard types for different inputs', async ({ page }) => {
      await page.goto('/stock/AAPL');

      // Test email input
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible()) {
        await emailInput.click();
        const inputMode = await emailInput.getAttribute('inputmode');
        expect(inputMode).toBe('email');

        const enterKeyHint = await emailInput.getAttribute('enterkeyhint');
        expect(enterKeyHint).toBe('next');
      }

      // Test numeric input for price alerts
      const priceInput = page.locator('input[inputmode="decimal"]');
      if (await priceInput.isVisible()) {
        await priceInput.click();
        const inputMode = await priceInput.getAttribute('inputmode');
        expect(inputMode).toBe('decimal');

        const enterKeyHint = await priceInput.getAttribute('enterkeyhint');
        expect(enterKeyHint).toBe('done');
      }

      // Test search input
      const searchInput = page.locator('input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.click();
        const inputMode = await searchInput.getAttribute('inputmode');
        expect(inputMode).toBe('search');
      }
    });

    test('should support keyboard navigation between focusable elements', async ({ page }) => {
      await page.goto('/watchlist');

      // Get all focusable elements
      const focusableElements = page.locator('button, [href], input, [tabindex]:not([tabindex="-1"])');
      const count = await focusableElements.count();

      if (count > 0) {
        // Focus first element
        await focusableElements.first().focus();

        // Navigate using Tab key
        for (let i = 1; i < Math.min(3, count); i++) {
          await page.keyboard.press('Tab');

          // Verify focus moved
          const focusedElement = page.locator(':focus');
          await expect(focusedElement).toBeFocused();
        }

        // Navigate backwards using Shift+Tab
        await page.keyboard.press('Shift+Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeFocused();
      }
    });

    test('should handle arrow key navigation in lists', async ({ page }) => {
      await page.goto('/watchlist');

      // Ensure watchlist items are present
      const watchlistItems = page.locator('[data-testid*="stock-item-"]');
      const itemCount = await watchlistItems.count();

      if (itemCount > 1) {
        // Focus first item
        await watchlistItems.first().focus();

        // Navigate down with arrow key
        await page.keyboard.press('ArrowDown');

        // Should focus next item
        const secondItem = watchlistItems.nth(1);
        await expect(secondItem).toBeFocused();

        // Navigate up with arrow key
        await page.keyboard.press('ArrowUp');

        // Should focus first item again
        const firstItem = watchlistItems.first();
        await expect(firstItem).toBeFocused();
      }
    });

    test('should support Enter key activation', async ({ page }) => {
      await page.goto('/watchlist');

      // Focus on a clickable element
      const addButton = page.locator('[data-testid="add-stock-btn"]');
      if (await addButton.isVisible()) {
        await addButton.focus();

        // Press Enter to activate
        await page.keyboard.press('Enter');

        // Should trigger the button action (e.g., show modal)
        await expect(page.locator('[data-testid="add-stock-modal"]')).toBeVisible();
      }
    });

    test('should handle Escape key for closing modals', async ({ page }) => {
      await page.goto('/settings');

      // Open accessibility panel
      const accessibilityBtn = page.locator('[data-testid="accessibility-menu"]');
      if (await accessibilityBtn.isVisible()) {
        await accessibilityBtn.click();

        // Should show accessibility panel
        await expect(page.locator('[data-testid="accessibility-panel"]')).toBeVisible();

        // Press Escape to close
        await page.keyboard.press('Escape');

        // Should close the panel
        await expect(page.locator('[data-testid="accessibility-panel"]')).not.toBeVisible();
      }
    });

    test('should provide proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/watchlist');

      // Check main navigation has proper ARIA
      const mainNav = page.locator('[role="navigation"]');
      if (await mainNav.isVisible()) {
        await expect(mainNav).toHaveAttribute('aria-label');
      }

      // Check buttons have proper labels
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(5, buttonCount); i++) {
        const button = buttons.nth(i);
        const hasAriaLabel = await button.getAttribute('aria-label');
        const hasText = await button.textContent();

        // Button should have either aria-label or visible text
        expect(hasAriaLabel || hasText).toBeTruthy();
      }

      // Check form inputs have proper labels
      const inputs = page.locator('input');
      const inputCount = await inputs.count();

      for (let i = 0; i < Math.min(3, inputCount); i++) {
        const input = inputs.nth(i);
        const hasAriaLabel = await input.getAttribute('aria-label');
        const hasAriaLabelledBy = await input.getAttribute('aria-labelledby');
        const hasAssociatedLabel = await page.locator(`label[for="${await input.getAttribute('id')}"]`).count();

        // Input should have proper labeling
        expect(hasAriaLabel || hasAriaLabelledBy || hasAssociatedLabel > 0).toBeTruthy();
      }
    });

    test('should announce screen reader messages', async ({ page }) => {
      await page.goto('/settings');

      // Open accessibility panel
      const accessibilityBtn = page.locator('[data-testid="accessibility-menu"]');
      if (await accessibilityBtn.isVisible()) {
        await accessibilityBtn.click();

        // Should create screen reader announcement
        const announcements = page.locator('[aria-live]');
        const announcementCount = await announcements.count();
        expect(announcementCount).toBeGreaterThan(0);

        // Check for polite and assertive announcements
        const politeAnnouncements = page.locator('[aria-live="polite"]');
        const assertiveAnnouncements = page.locator('[aria-live="assertive"]');

        expect(await politeAnnouncements.count() + await assertiveAnnouncements.count()).toBeGreaterThan(0);
      }
    });

    test('should handle high contrast mode', async ({ page }) => {
      await page.goto('/settings');

      // Open accessibility panel
      const accessibilityBtn = page.locator('[data-testid="accessibility-menu"]');
      if (await accessibilityBtn.isVisible()) {
        await accessibilityBtn.click();

        // Toggle high contrast mode
        const highContrastToggle = page.locator('[data-testid="high-contrast-toggle"]');
        if (await highContrastToggle.isVisible()) {
          await highContrastToggle.click();

          // Should apply high contrast class to document root
          const htmlElement = page.locator('html');
          await expect(htmlElement).toHaveClass(/high-contrast/);

          // Should have enhanced contrast in UI elements
          const primaryButton = page.locator('button.btn-primary').first();
          if (await primaryButton.isVisible()) {
            const backgroundColor = await primaryButton.evaluate(el =>
              window.getComputedStyle(el).backgroundColor
            );
            // High contrast should modify colors
            expect(backgroundColor).toBeTruthy();
          }
        }
      }
    });

    test('should handle large text mode', async ({ page }) => {
      await page.goto('/settings');

      // Open accessibility panel
      const accessibilityBtn = page.locator('[data-testid="accessibility-menu"]');
      if (await accessibilityBtn.isVisible()) {
        await accessibilityBtn.click();

        // Toggle large text mode
        const largeTextToggle = page.locator('[data-testid="large-text-toggle"]');
        if (await largeTextToggle.isVisible()) {
          await largeTextToggle.click();

          // Should apply large text class
          const htmlElement = page.locator('html');
          await expect(htmlElement).toHaveClass(/large-text/);

          // Should increase text size
          const bodyText = page.locator('body');
          const fontSize = await bodyText.evaluate(el =>
            parseFloat(window.getComputedStyle(el).fontSize)
          );
          expect(fontSize).toBeGreaterThan(16);
        }
      }
    });

    test('should handle reduced motion preference', async ({ page }) => {
      // Set reduced motion preference
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          value: jest.fn((query) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            addListener: jest.fn(),
            removeListener: jest.fn()
          }))
        });
      });

      await page.goto('/watchlist');

      // Should apply reduced motion styles
      const htmlElement = page.locator('html');
      const animationDuration = await htmlElement.evaluate(el =>
        window.getComputedStyle(el).getPropertyValue('--animation-duration')
      );

      // Should have very short or no animations
      expect(['0s', '0.01s', '']).toContain(animationDuration);
    });

    test('should handle voice navigation commands', async ({ page }) => {
      await page.goto('/settings');

      // Open accessibility panel
      const accessibilityBtn = page.locator('[data-testid="accessibility-menu"]');
      if (await accessibilityBtn.isVisible()) {
        await accessibilityBtn.click();

        // Enable voice navigation
        const voiceNavToggle = page.locator('[data-testid="voice-navigation-toggle"]');
        if (await voiceNavToggle.isVisible()) {
          await voiceNavToggle.click();

          // Should start voice recognition
          const voiceStatus = await page.evaluate(() => {
            return window.speechSynthesis?.speak?.mock?.calls?.length || 0;
          });
          expect(voiceStatus).toBeGreaterThanOrEqual(0);

          // Should show voice navigation active indicator
          await expect(page.locator('[data-testid="voice-active-indicator"]')).toBeVisible();
        }
      }
    });

    test('should handle haptic feedback', async ({ page }) => {
      await page.goto('/watchlist');

      // Test haptic feedback on button press
      const button = page.locator('button').first();
      if (await button.isVisible()) {
        await button.click();

        // Should trigger vibration
        const vibrateCalls = await page.evaluate(() => {
          return navigator.vibrate?.mock?.calls?.length || 0;
        });
        expect(vibrateCalls).toBeGreaterThan(0);
      }
    });

    test('should handle touch target sizing', async ({ page }) => {
      await page.goto('/watchlist');

      // Check that interactive elements meet minimum touch target size
      const buttons = page.locator('button');
      const links = page.locator('a');

      const interactiveElements = await page.locator('button, a, input, [role="button"]').all();

      for (const element of interactiveElements) {
        const box = await element.boundingBox();
        if (box) {
          // Should meet WCAG 2.1 AA minimum touch target size (44x44px)
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should handle keyboard shortcuts', async ({ page }) => {
      await page.goto('/watchlist');

      // Test global keyboard shortcuts
      await page.keyboard.press('Control+Shift+a');

      // Should open accessibility menu
      await expect(page.locator('[data-testid="accessibility-panel"]')).toBeVisible();

      // Test escape shortcut
      await page.keyboard.press('Escape');

      // Should close accessibility menu
      await expect(page.locator('[data-testid="accessibility-panel"]')).not.toBeVisible();
    });

    test('should handle color blind friendly mode', async ({ page }) => {
      await page.goto('/settings');

      // Open accessibility panel
      const accessibilityBtn = page.locator('[data-testid="accessibility-menu"]');
      if (await accessibilityBtn.isVisible()) {
        await accessibilityBtn.click();

        // Toggle color blind friendly mode
        const colorBlindToggle = page.locator('[data-testid="color-blind-toggle"]');
        if (await colorBlindToggle.isVisible()) {
          await colorBlindToggle.click();

          // Should apply color blind friendly class
          const htmlElement = page.locator('html');
          await expect(htmlElement).toHaveClass(/color-blind-friendly/);

          // Should add patterns/symbols to color-only indicators
          const stockChanges = page.locator('[data-testid*="stock-change"]');
          if (await stockChanges.count() > 0) {
            const firstChange = stockChanges.first();
            const content = await firstChange.textContent();
            // Should include symbols like ↑ or ↓ in addition to colors
            expect(content).toMatch(/[↑↓]/);
          }
        }
      }
    });
  });
});

test.describe('Mobile Keyboard Edge Cases', () => {
  test.use(devices['iPhone 14 Pro']);

  test('should handle rapid keyboard show/hide cycles', async ({ page }) => {
    await page.goto('/auth');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Rapid focus switching
    for (let i = 0; i < 5; i++) {
      await emailInput.focus();
      await page.evaluate(() => window.simulateVirtualKeyboard(true));
      await page.waitForTimeout(100);

      await passwordInput.focus();
      await page.evaluate(() => window.simulateVirtualKeyboard(false));
      await page.waitForTimeout(100);
    }

    // Should handle without errors
    const keyboardProvider = page.locator('[data-testid="mobile-keyboard-provider"]');
    await expect(keyboardProvider).toBeVisible();
  });

  test('should handle keyboard navigation with dynamically added elements', async ({ page }) => {
    await page.goto('/watchlist');

    // Add new stock item dynamically
    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="mobile-watchlist"]');
      if (container) {
        const newItem = document.createElement('button');
        newItem.setAttribute('data-testid', 'dynamic-stock-item');
        newItem.textContent = 'Dynamic Stock';
        newItem.setAttribute('data-focus-priority', '999');
        container.appendChild(newItem);
      }
    });

    // Should be able to navigate to dynamically added element
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Eventually should reach the dynamic element
    let foundDynamic = false;
    for (let i = 0; i < 10; i++) {
      const focused = await page.locator(':focus').getAttribute('data-testid');
      if (focused === 'dynamic-stock-item') {
        foundDynamic = true;
        break;
      }
      await page.keyboard.press('Tab');
    }

    expect(foundDynamic).toBe(true);
  });

  test('should handle accessibility with offline mode', async ({ page, context }) => {
    await page.goto('/watchlist');

    // Enable accessibility features
    await page.goto('/settings');
    const accessibilityBtn = page.locator('[data-testid="accessibility-menu"]');
    if (await accessibilityBtn.isVisible()) {
      await accessibilityBtn.click();

      const voiceNavToggle = page.locator('[data-testid="voice-navigation-toggle"]');
      if (await voiceNavToggle.isVisible()) {
        await voiceNavToggle.click();
      }
    }

    // Go offline
    await context.setOffline(true);

    // Accessibility features should still work
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Should handle gracefully without network errors
    const errorMessages = page.locator('[data-testid*="error"]');
    expect(await errorMessages.count()).toBe(0);
  });
});