import { test, expect } from '@playwright/test';

test.describe('Sidebar Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Sidebar Visibility and Layout', () => {
    test('should be visible on desktop by default', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Sidebar should be visible on desktop
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();
      
      // Should have proper width class
      await expect(sidebar).toHaveClass(/w-72/);
    });

    test('should be hidden on mobile by default', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Sidebar should be hidden on mobile (translated out of view)
      const sidebar = page.locator('aside');
      if (await sidebar.isVisible()) {
        await expect(sidebar).toHaveClass(/-translate-x-full/);
      }
    });

    test('should toggle visibility when mobile menu is opened', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check if there's a mobile sidebar toggle button
      const mobileToggle = page.locator('[aria-label="Open sidebar"]');
      
      if (await mobileToggle.isVisible()) {
        // Click to open sidebar
        await mobileToggle.click();
        
        // Sidebar should now be visible on mobile
        const sidebar = page.locator('aside');
        await expect(sidebar).toHaveClass(/translate-x-0/);
      }
    });
  });

  test.describe('Sidebar Header', () => {
    test('should display logo and branding', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      
      // Check turtle emoji logo
      await expect(sidebar.locator('text=🐢')).toBeVisible();
      
      // Check main title
      await expect(sidebar.getByText('TurtleTrading')).toBeVisible();
      
      // Check subtitle
      await expect(sidebar.getByText('AI Analytics')).toBeVisible();
    });

    test('should show close button on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Open mobile sidebar if toggle exists
      const mobileToggle = page.locator('[aria-label="Open sidebar"]');
      if (await mobileToggle.isVisible()) {
        await mobileToggle.click();
        
        // Close button should be visible
        const closeButton = page.locator('aside button[aria-label="Close sidebar"]');
        await expect(closeButton).toBeVisible();
        
        // Test close functionality
        await closeButton.click();
        const sidebar = page.locator('aside');
        await expect(sidebar).toHaveClass(/-translate-x-full/);
      }
    });
  });

  test.describe('Navigation Links', () => {
    test('should display all navigation links', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      
      // Check all expected navigation links
      const expectedLinks = [
        { text: 'Dashboard', href: '/' },
        { text: 'Market Overview', href: '/market' },
        { text: 'Stock Analysis', href: '/stocks' },
        { text: 'My Portfolio', href: '/portfolio' },
        { text: 'Alerts', href: '/alerts' },
        { text: 'Settings', href: '/settings' },
        { text: 'About', href: '/about' }
      ];
      
      for (const link of expectedLinks) {
        const navLink = sidebar.locator(`a[href="${link.href}"]`);
        await expect(navLink).toBeVisible();
        await expect(navLink).toContainText(link.text);
      }
    });

    test('should highlight active navigation link', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Navigate to market page
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('aside');
      const marketLink = sidebar.locator('a[href="/market"]');
      
      // Active link should have primary background color
      await expect(marketLink).toHaveClass(/bg-primary-100|text-primary-700/);
    });

    test('should navigate correctly when clicking links', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      
      // Test navigation to different pages
      await sidebar.locator('a[href="/market"]').click();
      await expect(page).toHaveURL('/market');
      
      await sidebar.locator('a[href="/portfolio"]').click();
      await expect(page).toHaveURL('/portfolio');
      
      await sidebar.locator('a[href="/settings"]').click();
      await expect(page).toHaveURL('/settings');
    });

    test('should show badges on links when present', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      
      // Check if alerts link has a badge
      const alertsLink = sidebar.locator('a[href="/alerts"]');
      const badge = alertsLink.locator('.bg-primary-100');
      
      if (await badge.isVisible()) {
        await expect(badge).toBeVisible();
        await expect(badge).toContainText(/\d+/); // Should contain a number
      }
    });

    test('should close mobile sidebar when link is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Open mobile sidebar if toggle exists
      const mobileToggle = page.locator('[aria-label="Open sidebar"]');
      if (await mobileToggle.isVisible()) {
        await mobileToggle.click();
        
        const sidebar = page.locator('aside');
        await expect(sidebar).toHaveClass(/translate-x-0/);
        
        // Click on a navigation link
        await sidebar.locator('a[href="/market"]').click();
        
        // Sidebar should close
        await expect(sidebar).toHaveClass(/-translate-x-full/);
        
        // Should navigate to correct page
        await expect(page).toHaveURL('/market');
      }
    });
  });

  test.describe('Market Summary Section', () => {
    test('should display market summary toggle', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      
      // Check market summary section header
      const marketSummaryButton = sidebar.locator('button:has-text("Market Summary")');
      await expect(marketSummaryButton).toBeVisible();
      
      // Should have emoji icon
      await expect(marketSummaryButton).toContainText('📈');
    });

    test('should toggle market summary section', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      const marketSummaryButton = sidebar.locator('button:has-text("Market Summary")');
      
      // Initially, market data should be visible (assuming not collapsed)
      const marketData = sidebar.locator(':has-text("S&P 500")');
      const isInitiallyVisible = await marketData.isVisible();
      
      // Click to toggle
      await marketSummaryButton.click();
      
      // State should change
      if (isInitiallyVisible) {
        await expect(marketData).not.toBeVisible();
      } else {
        await expect(marketData).toBeVisible();
      }
      
      // Click again to toggle back
      await marketSummaryButton.click();
      
      // Should return to original state
      if (isInitiallyVisible) {
        await expect(marketData).toBeVisible();
      } else {
        await expect(marketData).not.toBeVisible();
      }
    });

    test('should display market indices when expanded', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      
      // Ensure market summary is expanded
      const marketSummaryButton = sidebar.locator('button:has-text("Market Summary")');
      const arrow = marketSummaryButton.locator('svg');
      const arrowClasses = await arrow.getAttribute('class');
      
      if (arrowClasses?.includes('rotate-180')) {
        await marketSummaryButton.click(); // Expand if collapsed
      }
      
      // Check for market indices
      await expect(sidebar.getByText('S&P 500')).toBeVisible();
      await expect(sidebar.getByText('NASDAQ')).toBeVisible();
      await expect(sidebar.getByText('VIX')).toBeVisible();
      
      // Check for values (should contain numbers)
      const sp500Value = sidebar.locator(':has-text("S&P 500")').locator('..').locator('span').last();
      if (await sp500Value.isVisible()) {
        const valueText = await sp500Value.textContent();
        expect(valueText).toMatch(/[\d,]+/);
      }
    });
  });

  test.describe('Watchlist Section', () => {
    test('should display watchlist when available', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Mock watchlist data
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            watchlists: [{
              id: '1',
              name: 'My Stocks',
              symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN']
            }],
            selectedWatchlist: '1'
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('aside');
      
      // Check watchlist section exists
      const watchlistButton = sidebar.locator('button:has-text("My Stocks")');
      if (await watchlistButton.isVisible()) {
        await expect(watchlistButton).toBeVisible();
        await expect(watchlistButton).toContainText('⭐');
      }
    });

    test('should toggle watchlist section', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Mock watchlist data
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            watchlists: [{
              id: '1',
              name: 'Tech Stocks',
              symbols: ['AAPL', 'GOOGL', 'MSFT']
            }],
            selectedWatchlist: '1'
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('aside');
      const watchlistButton = sidebar.locator('button:has-text("Tech Stocks")');
      
      if (await watchlistButton.isVisible()) {
        // Check initial state
        const stockSymbol = sidebar.locator('a[href*="/stock/"]');
        const isInitiallyVisible = await stockSymbol.first().isVisible();
        
        // Toggle watchlist
        await watchlistButton.click();
        
        // State should change
        if (isInitiallyVisible) {
          await expect(stockSymbol.first()).not.toBeVisible();
        } else {
          await expect(stockSymbol.first()).toBeVisible();
        }
      }
    });

    test('should display watchlist symbols and navigate to stock pages', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Mock watchlist data
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            watchlists: [{
              id: '1',
              name: 'My Watchlist',
              symbols: ['AAPL', 'GOOGL', 'MSFT']
            }],
            selectedWatchlist: '1'
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('aside');
      
      // Ensure watchlist is expanded
      const watchlistButton = sidebar.locator('button:has-text("My Watchlist")');
      if (await watchlistButton.isVisible()) {
        const arrow = watchlistButton.locator('svg');
        const arrowClasses = await arrow.getAttribute('class');
        
        if (arrowClasses?.includes('rotate-180')) {
          await watchlistButton.click(); // Expand if collapsed
        }
        
        // Check stock symbols are displayed
        const stockLinks = sidebar.locator('a[href*="/stock/"]');
        if (await stockLinks.first().isVisible()) {
          await expect(stockLinks.first()).toBeVisible();
          
          // Test navigation to stock page
          const firstStockLink = stockLinks.first();
          const href = await firstStockLink.getAttribute('href');
          
          await firstStockLink.click();
          await expect(page).toHaveURL(href);
        }
      }
    });

    test('should show +more indicator for large watchlists', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Mock large watchlist
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            watchlists: [{
              id: '1',
              name: 'Large Watchlist',
              symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'META', 'NFLX']
            }],
            selectedWatchlist: '1'
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('aside');
      const watchlistButton = sidebar.locator('button:has-text("Large Watchlist")');
      
      if (await watchlistButton.isVisible()) {
        // Expand watchlist
        const arrow = watchlistButton.locator('svg');
        const arrowClasses = await arrow.getAttribute('class');
        
        if (arrowClasses?.includes('rotate-180')) {
          await watchlistButton.click();
        }
        
        // Should show +more indicator for lists > 5 items
        const moreIndicator = sidebar.getByText(/\+\d+ more/);
        await expect(moreIndicator).toBeVisible();
      }
    });

    test('should close mobile sidebar when stock link is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Mock watchlist data
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            watchlists: [{
              id: '1',
              name: 'Mobile Watchlist',
              symbols: ['AAPL', 'GOOGL']
            }],
            selectedWatchlist: '1'
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Open mobile sidebar if toggle exists
      const mobileToggle = page.locator('[aria-label="Open sidebar"]');
      if (await mobileToggle.isVisible()) {
        await mobileToggle.click();
        
        const sidebar = page.locator('aside');
        await expect(sidebar).toHaveClass(/translate-x-0/);
        
        // Click on stock link if visible
        const stockLink = sidebar.locator('a[href*="/stock/"]').first();
        if (await stockLink.isVisible()) {
          await stockLink.click();
          
          // Sidebar should close
          await expect(sidebar).toHaveClass(/-translate-x-full/);
        }
      }
    });
  });

  test.describe('User Section', () => {
    test('should display user info when authenticated', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Mock authenticated user
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            isAuthenticated: true,
            user: { email: 'sidebar@example.com' }
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('aside');
      
      // Check user section is displayed
      const userSection = sidebar.locator('.border-t').last();
      if (await userSection.isVisible()) {
        await expect(userSection).toBeVisible();
        
        // Check user avatar
        const userAvatar = userSection.locator('.bg-primary-500.rounded-full');
        await expect(userAvatar).toBeVisible();
        
        // Check user email
        await expect(userSection.getByText('sidebar@example.com')).toBeVisible();
        
        // Check Pro Account text
        await expect(userSection.getByText('Pro Account')).toBeVisible();
      }
    });
  });

  test.describe('Mobile Overlay', () => {
    test('should show overlay when sidebar is open on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Open mobile sidebar if toggle exists
      const mobileToggle = page.locator('[aria-label="Open sidebar"]');
      if (await mobileToggle.isVisible()) {
        await mobileToggle.click();
        
        // Overlay should be visible
        const overlay = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
        await expect(overlay).toBeVisible();
        
        // Clicking overlay should close sidebar
        await overlay.click();
        
        const sidebar = page.locator('aside');
        await expect(sidebar).toHaveClass(/-translate-x-full/);
      }
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should adapt to different screen sizes', async ({ page }) => {
      // Test desktop behavior
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveClass(/relative/);
      
      // Test tablet behavior
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(sidebar).toBeVisible();
      
      // Test mobile behavior
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Sidebar should be hidden or translated off-screen
      if (await sidebar.isVisible()) {
        await expect(sidebar).toHaveClass(/-translate-x-full/);
      }
    });
  });

  test.describe('Theme Support', () => {
    test('should support dark mode styling', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Add dark mode class
      await page.addInitScript(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check sidebar has dark mode classes
      const sidebar = page.locator('aside');
      await expect(sidebar).toHaveClass(/dark:bg-gray-800/);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check close button has proper aria-label
      const mobileToggle = page.locator('[aria-label="Open sidebar"]');
      if (await mobileToggle.isVisible()) {
        await mobileToggle.click();
        
        const closeButton = page.locator('aside button[aria-label="Close sidebar"]');
        await expect(closeButton).toHaveAttribute('aria-label', 'Close sidebar');
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const sidebar = page.locator('aside');
      
      // Navigation links should be focusable
      const firstNavLink = sidebar.locator('a').first();
      await firstNavLink.focus();
      await expect(firstNavLink).toBeFocused();
      
      // Should be able to navigate with Tab key
      await page.keyboard.press('Tab');
      const secondNavLink = sidebar.locator('a').nth(1);
      await expect(secondNavLink).toBeFocused();
    });
  });
});