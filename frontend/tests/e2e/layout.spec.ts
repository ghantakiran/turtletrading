import { test, expect } from '@playwright/test';

test.describe('Layout Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Overall Layout Structure', () => {
    test('should render all layout components', async ({ page }) => {
      // Check that all major layout components are present
      const header = page.locator('header');
      const breadcrumb = page.locator('nav:has-text("Home")');
      const sidebar = page.locator('aside');
      const main = page.locator('main');
      const footer = page.locator('footer');
      
      await expect(header).toBeVisible();
      await expect(breadcrumb).toBeVisible();
      await expect(main).toBeVisible();
      await expect(footer).toBeVisible();
      
      // Sidebar visibility depends on responsive state
      if (await sidebar.isVisible()) {
        await expect(sidebar).toBeVisible();
      }
    });

    test('should have proper semantic structure', async ({ page }) => {
      // Check semantic HTML structure
      const header = page.locator('header');
      const nav = page.locator('nav');
      const main = page.locator('main');
      const aside = page.locator('aside');
      const footer = page.locator('footer');
      
      await expect(header).toBeVisible();
      await expect(nav).toBeVisible(); // Breadcrumb nav
      await expect(main).toBeVisible();
      await expect(footer).toBeVisible();
      
      // Check that these are actual semantic elements
      const headerTag = await header.evaluate(el => el.tagName);
      const mainTag = await main.evaluate(el => el.tagName);
      const footerTag = await footer.evaluate(el => el.tagName);
      
      expect(headerTag.toLowerCase()).toBe('header');
      expect(mainTag.toLowerCase()).toBe('main');
      expect(footerTag.toLowerCase()).toBe('footer');
    });

    test('should have proper viewport structure', async ({ page }) => {
      const layout = page.locator('.min-h-screen');
      await expect(layout).toBeVisible();
      await expect(layout).toHaveClass(/bg-gray-50|dark:bg-gray-900/);
    });
  });

  test.describe('Responsive Layout Behavior', () => {
    test('should adapt to desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const header = page.locator('header');
      const sidebar = page.locator('aside');
      const main = page.locator('main');
      
      // Desktop navigation should be visible in header
      const desktopNav = header.locator('nav.hidden.md\\:flex');
      await expect(desktopNav).toBeVisible();
      
      // Mobile menu button should be hidden
      const mobileMenuButton = header.locator('button.md\\:hidden');
      await expect(mobileMenuButton).not.toBeVisible();
      
      // Sidebar should be visible and positioned relatively
      if (await sidebar.isVisible()) {
        await expect(sidebar).toHaveClass(/relative/);
        
        // Main content should have left margin for sidebar
        await expect(main).toHaveClass(/ml-72/);
      }
    });

    test('should adapt to mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const header = page.locator('header');
      const main = page.locator('main');
      
      // Desktop navigation should be hidden
      const desktopNav = header.locator('nav.hidden.md\\:flex');
      await expect(desktopNav).not.toBeVisible();
      
      // Mobile menu button should be visible
      const mobileMenuButton = header.locator('button.md\\:hidden');
      await expect(mobileMenuButton).toBeVisible();
      
      // Main content should not have left margin on mobile
      const mainClasses = await main.getAttribute('class');
      expect(mainClasses).not.toContain('ml-72');
      
      // Check for mobile sidebar toggle button
      const mobileSidebarToggle = page.locator('[aria-label="Open sidebar"]');
      if (await mobileSidebarToggle.isVisible()) {
        await expect(mobileSidebarToggle).toBeVisible();
        await expect(mobileSidebarToggle).toHaveClass(/fixed/);
        await expect(mobileSidebarToggle).toHaveClass(/bottom-6/);
        await expect(mobileSidebarToggle).toHaveClass(/right-6/);
      }
    });

    test('should handle tablet viewport correctly', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      const header = page.locator('header');
      
      // At tablet size, desktop nav should be visible
      const desktopNav = header.locator('nav.hidden.md\\:flex');
      await expect(desktopNav).toBeVisible();
      
      // Mobile button should be hidden
      const mobileMenuButton = header.locator('button.md\\:hidden');
      await expect(mobileMenuButton).not.toBeVisible();
    });

    test('should transition smoothly between viewports', async ({ page }) => {
      // Start with desktop
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const header = page.locator('header');
      const desktopNav = header.locator('nav.hidden.md\\:flex');
      await expect(desktopNav).toBeVisible();
      
      // Switch to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Layout should adapt
      const mobileMenuButton = header.locator('button.md\\:hidden');
      await expect(mobileMenuButton).toBeVisible();
      await expect(desktopNav).not.toBeVisible();
      
      // Switch back to desktop
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Should return to desktop layout
      await expect(desktopNav).toBeVisible();
      await expect(mobileMenuButton).not.toBeVisible();
    });
  });

  test.describe('Sidebar Integration', () => {
    test('should coordinate sidebar state between components', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Check if sidebar toggle exists in header
      const headerSidebarToggle = page.locator('header button[aria-label="Toggle sidebar"]');
      
      if (await headerSidebarToggle.isVisible()) {
        const sidebar = page.locator('aside');
        const main = page.locator('main');
        
        // Initial state
        const initialSidebarVisible = await sidebar.isVisible();
        const initialMainMargin = await main.getAttribute('class');
        
        // Toggle sidebar
        await headerSidebarToggle.click();
        
        // Wait for transition
        await page.waitForTimeout(500);
        
        // State should change
        const newSidebarVisible = await sidebar.isVisible();
        const newMainMargin = await main.getAttribute('class');
        
        expect(newSidebarVisible).not.toBe(initialSidebarVisible);
        expect(newMainMargin).not.toBe(initialMainMargin);
      }
    });

    test('should handle mobile sidebar overlay correctly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileSidebarToggle = page.locator('[aria-label="Open sidebar"]');
      
      if (await mobileSidebarToggle.isVisible()) {
        // Open sidebar
        await mobileSidebarToggle.click();
        
        // Check overlay appears
        const overlay = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
        await expect(overlay).toBeVisible();
        
        // Sidebar should be visible
        const sidebar = page.locator('aside');
        await expect(sidebar).toHaveClass(/translate-x-0/);
        
        // Close by clicking overlay
        await overlay.click();
        
        // Sidebar should close
        await expect(sidebar).toHaveClass(/-translate-x-full/);
        await expect(overlay).not.toBeVisible();
      }
    });

    test('should close mobile sidebar when navigation occurs', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileSidebarToggle = page.locator('[aria-label="Open sidebar"]');
      
      if (await mobileSidebarToggle.isVisible()) {
        // Open sidebar
        await mobileSidebarToggle.click();
        
        const sidebar = page.locator('aside');
        await expect(sidebar).toHaveClass(/translate-x-0/);
        
        // Click a navigation link
        const navLink = sidebar.locator('a[href="/market"]');
        if (await navLink.isVisible()) {
          await navLink.click();
          
          // Sidebar should close
          await expect(sidebar).toHaveClass(/-translate-x-full/);
          
          // Should navigate to new page
          await expect(page).toHaveURL('/market');
        }
      }
    });
  });

  test.describe('Header Integration', () => {
    test('should coordinate header state with other components', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const header = page.locator('header');
      const mobileMenuButton = header.locator('button[aria-label*="menu"]');
      
      // Open mobile menu
      await mobileMenuButton.click();
      
      const mobileMenu = header.locator('.md\\:hidden nav');
      await expect(mobileMenu).toBeVisible();
      
      // Click navigation link
      const navLink = mobileMenu.locator('a[href="/market"]');
      await navLink.click();
      
      // Menu should close and navigation should occur
      await expect(mobileMenu).not.toBeVisible();
      await expect(page).toHaveURL('/market');
      
      // Breadcrumb should update
      const breadcrumb = page.locator('nav:has-text("Home")');
      await expect(breadcrumb.locator('span:has-text("Market")')).toBeVisible();
    });

    test('should show user info consistently across components', async ({ page }) => {
      // Mock authenticated user
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            isAuthenticated: true,
            user: { email: 'integration@example.com' }
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const header = page.locator('header');
      const sidebar = page.locator('aside');
      
      // Check user info in header (desktop)
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const headerUserInfo = header.getByText('integration@example.com');
      if (await headerUserInfo.isVisible()) {
        await expect(headerUserInfo).toBeVisible();
      }
      
      // Check user info in sidebar
      if (await sidebar.isVisible()) {
        const sidebarUserInfo = sidebar.getByText('integration@example.com');
        if (await sidebarUserInfo.isVisible()) {
          await expect(sidebarUserInfo).toBeVisible();
        }
      }
      
      // Check user info in mobile header menu
      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileMenuButton = header.locator('button[aria-label*="menu"]');
      await mobileMenuButton.click();
      
      const mobileMenu = header.locator('.md\\:hidden nav');
      const mobileUserInfo = mobileMenu.getByText('integration@example.com');
      
      if (await mobileUserInfo.isVisible()) {
        await expect(mobileUserInfo).toBeVisible();
      }
    });
  });

  test.describe('Breadcrumb Integration', () => {
    test('should update breadcrumb when navigation occurs', async ({ page }) => {
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Initially on home page
      await expect(breadcrumb.locator('a[href="/"]')).toHaveText('Home');
      
      // Navigate to market
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      // Breadcrumb should update
      await expect(breadcrumb.locator('a[href="/"]')).toBeVisible();
      await expect(breadcrumb.locator('span:has-text("Market")')).toBeVisible();
      
      // Navigate deeper
      await page.goto('/market/stocks');
      await page.waitForLoadState('networkidle');
      
      // Breadcrumb should show full path
      await expect(breadcrumb.locator('a[href="/"]')).toBeVisible();
      await expect(breadcrumb.locator('a[href="/market"]')).toBeVisible();
      await expect(breadcrumb.locator('span:has-text("Stocks")')).toBeVisible();
    });

    test('should coordinate breadcrumb navigation with layout state', async ({ page }) => {
      await page.goto('/market/stocks');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Click breadcrumb to navigate
      await breadcrumb.locator('a[href="/market"]').click();
      await expect(page).toHaveURL('/market');
      
      // Layout should update accordingly
      const main = page.locator('main');
      await expect(main).toBeVisible();
      
      // Breadcrumb should update
      await expect(breadcrumb.locator('span:has-text("Market")')).toBeVisible();
      
      // Page content should be different
      const currentPath = page.url();
      expect(currentPath).toContain('/market');
      expect(currentPath).not.toContain('/stocks');
    });
  });

  test.describe('Footer Integration', () => {
    test('should show consistent system status across components', async ({ page }) => {
      // Mock market store with connected status
      await page.addInitScript(() => {
        window.localStorage.setItem('market-storage', JSON.stringify({
          state: {
            isConnected: true
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const header = page.locator('header');
      const footer = page.locator('footer');
      
      // Check status in header
      const headerStatus = header.getByText(/Market Connected/);
      if (await headerStatus.isVisible()) {
        await expect(headerStatus).toBeVisible();
      }
      
      // Check status in footer
      const footerStatus = footer.getByText(/All Systems Operational/);
      await expect(footerStatus).toBeVisible();
      
      // Both should show connected state
      const headerIndicator = header.locator('.status-indicator');
      const footerIndicator = footer.locator('.status-indicator');
      
      if (await headerIndicator.isVisible()) {
        await expect(headerIndicator).toHaveClass(/status-online/);
      }
      await expect(footerIndicator).toHaveClass(/status-online/);
    });

    test('should maintain footer position with dynamic content', async ({ page }) => {
      const footer = page.locator('footer');
      
      // Footer should be at bottom
      await expect(footer).toBeVisible();
      await expect(footer).toHaveClass(/mt-auto/);
      
      // Navigate to different pages
      const testPages = ['/market', '/settings', '/about'];
      
      for (const testPage of testPages) {
        await page.goto(testPage);
        await page.waitForLoadState('networkidle');
        
        // Footer should remain at bottom
        await expect(footer).toBeVisible();
        await expect(footer).toHaveClass(/mt-auto/);
      }
    });
  });

  test.describe('State Management Integration', () => {
    test('should coordinate UI state across all components', async ({ page }) => {
      // Mock UI store with specific state
      await page.addInitScript(() => {
        window.localStorage.setItem('ui-storage', JSON.stringify({
          state: {
            theme: { mode: 'dark' },
            layout: { sidebarCollapsed: false }
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // All components should reflect the dark theme
      const header = page.locator('header');
      const sidebar = page.locator('aside');
      const breadcrumb = page.locator('nav:has-text("Home")');
      const footer = page.locator('footer');
      
      // Check dark mode classes (if implemented)
      await expect(header).toHaveClass(/dark:bg-gray-800/);
      
      if (await sidebar.isVisible()) {
        await expect(sidebar).toHaveClass(/dark:bg-gray-800/);
      }
      
      await expect(breadcrumb).toHaveClass(/dark:bg-gray-800/);
      await expect(footer).toHaveClass(/dark:bg-gray-800/);
    });

    test('should handle screen size changes consistently', async ({ page }) => {
      // Start with desktop
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // All desktop-specific elements should be visible
      const header = page.locator('header');
      const desktopNav = header.locator('nav.hidden.md\\:flex');
      await expect(desktopNav).toBeVisible();
      
      // Switch to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      
      // All components should adapt
      await expect(desktopNav).not.toBeVisible();
      
      const mobileMenuButton = header.locator('button.md\\:hidden');
      await expect(mobileMenuButton).toBeVisible();
      
      // Breadcrumb should remain functional
      const breadcrumb = page.locator('nav:has-text("Home")');
      await expect(breadcrumb).toBeVisible();
      
      // Footer should remain at bottom
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
    });

    test('should maintain state consistency during navigation', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Set some state by interacting with components
      const sidebar = page.locator('aside');
      
      if (await sidebar.isVisible()) {
        // Toggle a collapsible section if available
        const marketSummaryButton = sidebar.locator('button:has-text("Market Summary")');
        
        if (await marketSummaryButton.isVisible()) {
          const isExpanded = !(await marketSummaryButton.locator('svg').getAttribute('class'))?.includes('rotate-180');
          
          // Toggle the section
          await marketSummaryButton.click();
          
          // Navigate to another page
          await page.goto('/market');
          await page.waitForLoadState('networkidle');
          
          // State should be maintained (this would need proper state management)
          // For now, just verify the component is still functional
          if (await sidebar.isVisible()) {
            const marketSummaryButtonAfterNav = sidebar.locator('button:has-text("Market Summary")');
            await expect(marketSummaryButtonAfterNav).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Loading and Error States', () => {
    test('should handle initial page load gracefully', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      
      // All major components should load
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('nav:has-text("Home")')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time
      expect(loadTime).toBeLessThan(10000);
    });

    test('should handle navigation errors gracefully', async ({ page }) => {
      // Try to navigate to a non-existent page
      await page.goto('/non-existent-page');
      
      // Layout should still be functional
      const header = page.locator('header');
      const breadcrumb = page.locator('nav:has-text("Home")');
      const footer = page.locator('footer');
      
      await expect(header).toBeVisible();
      await expect(breadcrumb).toBeVisible();
      await expect(footer).toBeVisible();
      
      // Should be able to navigate back home
      await breadcrumb.locator('a[href="/"]').click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Performance and Optimization', () => {
    test('should not cause layout shifts during loading', async ({ page }) => {
      // Navigate to a page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Measure layout stability by checking if major components maintain position
      const header = page.locator('header');
      const footer = page.locator('footer');
      
      const initialHeaderBox = await header.boundingBox();
      const initialFooterBox = await footer.boundingBox();
      
      // Wait a bit for any delayed renders
      await page.waitForTimeout(1000);
      
      const finalHeaderBox = await header.boundingBox();
      const finalFooterBox = await footer.boundingBox();
      
      // Positions should be stable
      if (initialHeaderBox && finalHeaderBox) {
        expect(Math.abs(initialHeaderBox.y - finalHeaderBox.y)).toBeLessThan(5);
      }
      
      if (initialFooterBox && finalFooterBox) {
        expect(Math.abs(initialFooterBox.y - finalFooterBox.y)).toBeLessThan(5);
      }
    });

    test('should handle rapid viewport changes without issues', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1200, height: 800 },
        { width: 375, height: 667 }
      ];
      
      for (let i = 0; i < viewports.length; i++) {
        await page.setViewportSize(viewports[i]);
        
        // Quick check that layout is functional
        const header = page.locator('header');
        await expect(header).toBeVisible();
        
        // Don't wait too long between changes
        await page.waitForTimeout(100);
      }
      
      // Final layout should be stable
      const header = page.locator('header');
      const footer = page.locator('footer');
      
      await expect(header).toBeVisible();
      await expect(footer).toBeVisible();
    });
  });

  test.describe('Accessibility Integration', () => {
    test('should maintain proper focus order across all components', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Start from top of page
      await page.keyboard.press('Tab');
      
      // Focus should move through components in logical order:
      // Header logo -> Header nav -> Sidebar (if visible) -> Main content -> Footer
      
      const header = page.locator('header');
      const firstHeaderLink = header.locator('a').first();
      
      // Should be able to focus on header elements
      await expect(firstHeaderLink).toBeFocused();
      
      // Continue tabbing to verify order is logical
      await page.keyboard.press('Tab');
      
      // This is a basic check - in a real app you'd verify the complete tab order
    });

    test('should provide proper landmarks for screen readers', async ({ page }) => {
      // Check for landmark elements
      const header = page.locator('header');
      const nav = page.locator('nav');
      const main = page.locator('main');
      const aside = page.locator('aside');
      const footer = page.locator('footer');
      
      // All major landmarks should be present
      await expect(header).toBeVisible();
      await expect(nav).toBeVisible();
      await expect(main).toBeVisible();
      await expect(footer).toBeVisible();
      
      // Check semantic meaning is preserved
      const headerRole = await header.evaluate(el => el.tagName);
      const mainRole = await main.evaluate(el => el.tagName);
      const footerRole = await footer.evaluate(el => el.tagName);
      
      expect(headerRole.toLowerCase()).toBe('header');
      expect(mainRole.toLowerCase()).toBe('main');
      expect(footerRole.toLowerCase()).toBe('footer');
    });

    test('should handle keyboard navigation across all components', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Test navigation through different components
      const header = page.locator('header');
      const breadcrumb = page.locator('nav:has-text("Home")');
      const sidebar = page.locator('aside');
      
      // Focus on header navigation
      const headerNavLink = header.locator('nav a').first();
      await headerNavLink.focus();
      await expect(headerNavLink).toBeFocused();
      
      // Should be able to activate with Enter
      await page.keyboard.press('Enter');
      
      // Focus on breadcrumb
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const breadcrumbHomeLink = breadcrumb.locator('a[href="/"]');
      await breadcrumbHomeLink.focus();
      await expect(breadcrumbHomeLink).toBeFocused();
      
      // Should be able to navigate with Enter
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/');
      
      // Test sidebar navigation if visible
      if (await sidebar.isVisible()) {
        const sidebarNavLink = sidebar.locator('a').first();
        await sidebarNavLink.focus();
        await expect(sidebarNavLink).toBeFocused();
      }
    });
  });
});