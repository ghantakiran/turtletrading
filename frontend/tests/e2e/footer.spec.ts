import { test, expect } from '@playwright/test';

test.describe('Footer Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Footer Visibility and Layout', () => {
    test('should be visible and positioned at bottom', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Footer should be visible
      await expect(footer).toBeVisible();
      
      // Should have proper styling classes
      await expect(footer).toHaveClass(/bg-white|dark:bg-gray-800/);
      await expect(footer).toHaveClass(/border-t/);
      await expect(footer).toHaveClass(/mt-auto/);
    });

    test('should span full width with proper container', async ({ page }) => {
      const footer = page.locator('footer');
      const container = footer.locator('.max-w-7xl.mx-auto');
      
      await expect(container).toBeVisible();
      await expect(container).toHaveClass(/px-4|sm:px-6|lg:px-8/);
    });
  });

  test.describe('Copyright and Branding', () => {
    test('should display copyright information', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Check copyright text
      await expect(footer.getByText('© 2025 TurtleTrading')).toBeVisible();
      
      // Check branding text
      await expect(footer.getByText('AI-Powered Trading Platform')).toBeVisible();
      
      // Check separator
      await expect(footer.locator('text=•').first()).toBeVisible();
    });

    test('should have proper text styling for branding', async ({ page }) => {
      const footer = page.locator('footer');
      const brandingSection = footer.locator('div:has-text("© 2025 TurtleTrading")');
      
      await expect(brandingSection).toHaveClass(/text-sm/);
      await expect(brandingSection).toHaveClass(/text-gray-600|dark:text-gray-400/);
    });
  });

  test.describe('Footer Links', () => {
    test('should display default footer links', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Check API Docs link
      const apiDocsLink = footer.locator('a[href="/api/v1/docs"]');
      await expect(apiDocsLink).toBeVisible();
      await expect(apiDocsLink).toHaveText('API Docs');
      
      // Should have external link attributes
      await expect(apiDocsLink).toHaveAttribute('target', '_blank');
      await expect(apiDocsLink).toHaveAttribute('rel', 'noopener noreferrer');
      
      // Check Support link
      const supportLink = footer.locator('a[href="mailto:support@turtletrading.ai"]');
      await expect(supportLink).toBeVisible();
      await expect(supportLink).toHaveText('Support');
      
      // Should have external link attributes
      await expect(supportLink).toHaveAttribute('target', '_blank');
      await expect(supportLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('should have proper link styling and hover effects', async ({ page }) => {
      const footer = page.locator('footer');
      const apiDocsLink = footer.locator('a[href="/api/v1/docs"]');
      
      await expect(apiDocsLink).toHaveClass(/text-gray-600/);
      await expect(apiDocsLink).toHaveClass(/hover:text-primary-600/);
      await expect(apiDocsLink).toHaveClass(/transition-colors/);
      
      // Test hover state (visual check)
      await apiDocsLink.hover();
    });

    test('should open external links correctly', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Test API Docs link opens in new tab
      const [newPage] = await Promise.all([
        page.waitForEvent('popup'),
        footer.locator('a[href="/api/v1/docs"]').click()
      ]);
      
      expect(newPage.url()).toContain('/api/v1/docs');
      await newPage.close();
      
      // Test support email link
      const supportLink = footer.locator('a[href="mailto:support@turtletrading.ai"]');
      const href = await supportLink.getAttribute('href');
      expect(href).toBe('mailto:support@turtletrading.ai');
    });
  });

  test.describe('System Status Indicator', () => {
    test('should display system status by default', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Check system status text
      const statusText = footer.getByText(/All Systems Operational|Connection Issues/);
      await expect(statusText).toBeVisible();
      
      // Check status indicator
      const statusIndicator = footer.locator('.status-indicator');
      await expect(statusIndicator).toBeVisible();
      
      // Should have proper ARIA label
      await expect(statusIndicator).toHaveAttribute('aria-label', /Systems operational|Connection issues/);
    });

    test('should reflect market store connection status', async ({ page }) => {
      const footer = page.locator('footer');
      const statusIndicator = footer.locator('.status-indicator');
      
      // Check status indicator has appropriate classes
      const statusClass = await statusIndicator.getAttribute('class');
      expect(statusClass).toMatch(/(status-online|status-offline)/);
      
      // Check corresponding text matches the status
      if (statusClass?.includes('status-online')) {
        await expect(footer.getByText('All Systems Operational')).toBeVisible();
      } else if (statusClass?.includes('status-offline')) {
        await expect(footer.getByText('Connection Issues')).toBeVisible();
      }
    });

    test('should update when market connection status changes', async ({ page }) => {
      // Mock disconnected state
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            isConnected: false
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const footer = page.locator('footer');
      
      // Should show offline status
      await expect(footer.getByText('Connection Issues')).toBeVisible();
      const statusIndicator = footer.locator('.status-indicator');
      await expect(statusIndicator).toHaveClass(/status-offline/);
      
      // Mock connected state
      await page.evaluate(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            isConnected: true
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should show online status
      await expect(footer.getByText('All Systems Operational')).toBeVisible();
      await expect(statusIndicator).toHaveClass(/status-online/);
    });
  });

  test.describe('Additional Footer Information', () => {
    test('should display version and technology information', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Check version
      await expect(footer.getByText('Version 1.0.0')).toBeVisible();
      
      // Check technology stack
      await expect(footer.getByText('Built with React & FastAPI')).toBeVisible();
      
      // Check AI branding
      await expect(footer.getByText('Powered by AI')).toBeVisible();
      
      // Check separators
      const separators = footer.locator('text=•');
      await expect(separators.nth(1)).toBeVisible(); // Second separator in tech section
      await expect(separators.nth(2)).toBeVisible(); // Third separator in tech section
    });

    test('should display legal and policy links', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Check Privacy Policy link
      const privacyLink = footer.locator('a[href="/privacy"]');
      await expect(privacyLink).toBeVisible();
      await expect(privacyLink).toHaveText('Privacy Policy');
      
      // Check Terms of Service link
      const termsLink = footer.locator('a[href="/terms"]');
      await expect(termsLink).toBeVisible();
      await expect(termsLink).toHaveText('Terms of Service');
      
      // Check System Status link
      const statusLink = footer.locator('a[href="/status"]');
      await expect(statusLink).toBeVisible();
      await expect(statusLink).toHaveText('System Status');
    });

    test('should navigate to legal pages correctly', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Test Privacy Policy navigation
      await footer.locator('a[href="/privacy"]').click();
      await expect(page).toHaveURL('/privacy');
      
      // Go back to home
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test Terms of Service navigation
      await footer.locator('a[href="/terms"]').click();
      await expect(page).toHaveURL('/terms');
      
      // Go back to home
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test System Status navigation
      await footer.locator('a[href="/status"]').click();
      await expect(page).toHaveURL('/status');
    });

    test('should have proper styling for legal links', async ({ page }) => {
      const footer = page.locator('footer');
      const privacyLink = footer.locator('a[href="/privacy"]');
      
      await expect(privacyLink).toHaveClass(/hover:text-gray-700/);
      await expect(privacyLink).toHaveClass(/dark:hover:text-gray-300/);
      await expect(privacyLink).toHaveClass(/transition-colors/);
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should adapt layout for mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const footer = page.locator('footer');
      
      // Main section should stack vertically on mobile
      const mainSection = footer.locator('.flex.flex-col.md\\:flex-row');
      await expect(mainSection).toHaveClass(/flex-col/);
      await expect(mainSection).toHaveClass(/md:flex-row/);
      
      // Should have proper spacing
      await expect(mainSection).toHaveClass(/space-y-4/);
      await expect(mainSection).toHaveClass(/md:space-y-0/);
    });

    test('should stack additional info section on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 800 });
      
      const footer = page.locator('footer');
      const additionalInfo = footer.locator('.flex.flex-col.sm\\:flex-row');
      
      await expect(additionalInfo).toHaveClass(/flex-col/);
      await expect(additionalInfo).toHaveClass(/sm:flex-row/);
      await expect(additionalInfo).toHaveClass(/space-y-2/);
      await expect(additionalInfo).toHaveClass(/sm:space-y-0/);
    });

    test('should maintain readability across all screen sizes', async ({ page }) => {
      const screenSizes = [
        { width: 375, height: 667 },  // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1024, height: 768 }, // Desktop
        { width: 1920, height: 1080 } // Large Desktop
      ];
      
      for (const size of screenSizes) {
        await page.setViewportSize(size);
        
        const footer = page.locator('footer');
        
        // Footer should always be visible
        await expect(footer).toBeVisible();
        
        // Key elements should be visible
        await expect(footer.getByText('© 2025 TurtleTrading')).toBeVisible();
        await expect(footer.locator('.status-indicator')).toBeVisible();
        await expect(footer.getByText(/All Systems Operational|Connection Issues/)).toBeVisible();
      }
    });
  });

  test.describe('Theme Support', () => {
    test('should support dark mode styling', async ({ page }) => {
      // Add dark mode class
      await page.addInitScript(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const footer = page.locator('footer');
      
      // Check dark mode classes are applied
      await expect(footer).toHaveClass(/dark:bg-gray-800/);
      await expect(footer).toHaveClass(/dark:border-gray-700/);
      
      // Check text colors adapt to dark mode
      const brandingText = footer.locator('text=© 2025 TurtleTrading').locator('..');
      await expect(brandingText).toHaveClass(/dark:text-gray-400/);
    });

    test('should maintain contrast in both light and dark modes', async ({ page }) => {
      // Test light mode
      const footer = page.locator('footer');
      const statusText = footer.getByText(/All Systems Operational|Connection Issues/);
      
      await expect(statusText).toBeVisible();
      
      // Switch to dark mode
      await page.addInitScript(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Status text should still be visible in dark mode
      await expect(statusText).toBeVisible();
    });
  });

  test.describe('Integration with Market Store', () => {
    test('should show connected status when market store is connected', async ({ page }) => {
      // Mock connected market store
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            isConnected: true
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const footer = page.locator('footer');
      
      // Should show connected status
      await expect(footer.getByText('All Systems Operational')).toBeVisible();
      const statusIndicator = footer.locator('.status-indicator');
      await expect(statusIndicator).toHaveClass(/status-online/);
      await expect(statusIndicator).toHaveAttribute('aria-label', 'Systems operational');
    });

    test('should show disconnected status when market store is disconnected', async ({ page }) => {
      // Mock disconnected market store
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            isConnected: false
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const footer = page.locator('footer');
      
      // Should show disconnected status
      await expect(footer.getByText('Connection Issues')).toBeVisible();
      const statusIndicator = footer.locator('.status-indicator');
      await expect(statusIndicator).toHaveClass(/status-offline/);
      await expect(statusIndicator).toHaveAttribute('aria-label', 'Connection issues');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper semantic structure', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Footer should use semantic footer element
      await expect(footer).toBeVisible();
      
      // Links should be properly accessible
      const links = footer.locator('a');
      const linkCount = await links.count();
      
      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        
        // Each link should have text or aria-label
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');
        
        expect(text || ariaLabel).toBeTruthy();
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Focus should move through footer links
      const firstLink = footer.locator('a').first();
      await firstLink.focus();
      await expect(firstLink).toBeFocused();
      
      // Tab to next link
      await page.keyboard.press('Tab');
      const secondLink = footer.locator('a').nth(1);
      await expect(secondLink).toBeFocused();
      
      // Enter should activate the link
      const href = await secondLink.getAttribute('href');
      await page.keyboard.press('Enter');
      
      if (href?.startsWith('http') || href?.startsWith('mailto:')) {
        // External link - check it has proper attributes
        await expect(secondLink).toHaveAttribute('target', '_blank');
      } else if (href?.startsWith('/')) {
        // Internal link - check navigation
        await expect(page).toHaveURL(href);
      }
    });

    test('should have proper ARIA attributes for status indicators', async ({ page }) => {
      const footer = page.locator('footer');
      const statusIndicator = footer.locator('.status-indicator');
      
      // Status indicator should have aria-label
      const ariaLabel = await statusIndicator.getAttribute('aria-label');
      expect(ariaLabel).toMatch(/(Systems operational|Connection issues)/);
      
      // Status indicator should convey meaning beyond color
      const statusText = footer.getByText(/All Systems Operational|Connection Issues/);
      await expect(statusText).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load quickly and not block page rendering', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Footer should load within reasonable time (5 seconds is generous for E2E)
      expect(loadTime).toBeLessThan(5000);
    });
  });
});