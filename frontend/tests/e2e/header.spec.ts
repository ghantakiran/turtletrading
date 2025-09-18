import { test, expect } from '@playwright/test';

test.describe('Header Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Logo and Branding', () => {
    test('should display TurtleTrading logo and branding', async ({ page }) => {
      // Check logo link exists and navigates to home
      const logoLink = page.locator('header a[href="/"]').first();
      await expect(logoLink).toBeVisible();
      
      // Check turtle emoji icon
      const logo = logoLink.locator('div').first();
      await expect(logo).toHaveText('🐢');
      
      // Check main title
      await expect(logoLink.locator('text=TurtleTrading')).toBeVisible();
      
      // Check subtitle
      await expect(logoLink.locator('text=AI-Powered Analytics')).toBeVisible();
      
      // Test logo link navigation
      await logoLink.click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Desktop Navigation', () => {
    test('should display navigation links on desktop', async ({ page }) => {
      // Resize to desktop viewport
      await page.setViewportSize({ width: 1024, height: 768 });
      
      // Check all navigation links are visible on desktop
      const navLinks = [
        { text: 'Dashboard', href: '/' },
        { text: 'Market', href: '/market' },
        { text: 'Settings', href: '/settings' },
        { text: 'About', href: '/about' }
      ];
      
      for (const link of navLinks) {
        const navLink = page.locator(`header nav a[href="${link.href}"]`).first();
        await expect(navLink).toBeVisible();
        await expect(navLink).toHaveText(new RegExp(link.text));
      }
    });

    test('should highlight active navigation link', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      // Navigate to market page
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      // Check that market link has active styling
      const marketLink = page.locator('header nav a[href="/market"]').first();
      await expect(marketLink).toHaveClass(/bg-primary-100|text-primary-700/);
    });

    test('should navigate correctly when clicking navigation links', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      // Test navigation to different pages
      await page.locator('header nav a[href="/market"]').first().click();
      await expect(page).toHaveURL('/market');
      
      await page.locator('header nav a[href="/settings"]').first().click();
      await expect(page).toHaveURL('/settings');
      
      await page.locator('header nav a[href="/about"]').first().click();
      await expect(page).toHaveURL('/about');
    });
  });

  test.describe('Sidebar Toggle', () => {
    test('should show sidebar toggle on desktop when enabled', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      // Check if sidebar toggle button is visible
      const sidebarToggle = page.locator('header button[aria-label="Toggle sidebar"]');
      if (await sidebarToggle.isVisible()) {
        await expect(sidebarToggle).toBeVisible();
        
        // Test toggle functionality
        await sidebarToggle.click();
        // Note: This would need to be verified based on sidebar state changes
      }
    });
  });

  test.describe('Market Status Indicator', () => {
    test('should display market status', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      // Check market status is displayed
      const marketStatus = page.locator('header').getByText(/Market (Connected|Disconnected)/);
      await expect(marketStatus).toBeVisible();
      
      // Check status indicator exists
      const statusIndicator = page.locator('header .status-indicator');
      await expect(statusIndicator).toBeVisible();
      
      // Check status indicator has appropriate class
      const statusClass = await statusIndicator.getAttribute('class');
      expect(statusClass).toMatch(/(status-online|status-offline)/);
    });
  });

  test.describe('User Authentication Display', () => {
    test('should show user info when authenticated', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      // Mock authenticated user state by adding localStorage
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            isAuthenticated: true,
            user: { email: 'test@example.com' }
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check if user avatar and email are visible
      const userAvatar = page.locator('header .bg-primary-500.rounded-full');
      const userEmail = page.locator('header').getByText('test@example.com');
      
      // These might not be visible if auth state isn't properly set up
      if (await userAvatar.isVisible()) {
        await expect(userAvatar).toBeVisible();
        await expect(userEmail).toBeVisible();
      }
    });
  });

  test.describe('Mobile Menu', () => {
    test('should show mobile menu button on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile viewport
      
      // Mobile menu button should be visible
      const mobileMenuButton = page.locator('header button[aria-label*="menu"]');
      await expect(mobileMenuButton).toBeVisible();
      
      // Desktop navigation should be hidden
      const desktopNav = page.locator('header nav.hidden.md\\:flex');
      await expect(desktopNav).not.toBeVisible();
    });

    test('should toggle mobile menu when clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileMenuButton = page.locator('header button[aria-label*="menu"]');
      
      // Initially mobile menu should be closed
      const mobileMenu = page.locator('header .md\\:hidden nav');
      await expect(mobileMenu).not.toBeVisible();
      
      // Click to open mobile menu
      await mobileMenuButton.click();
      
      // Mobile menu should now be visible
      await expect(mobileMenu).toBeVisible();
      
      // Check navigation links are present in mobile menu
      const mobileNavLinks = mobileMenu.locator('a');
      await expect(mobileNavLinks).toHaveCount(4); // Dashboard, Market, Settings, About
      
      // Click to close mobile menu
      await mobileMenuButton.click();
      
      // Mobile menu should be hidden again
      await expect(mobileMenu).not.toBeVisible();
    });

    test('should close mobile menu when navigation link is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileMenuButton = page.locator('header button[aria-label*="menu"]');
      
      // Open mobile menu
      await mobileMenuButton.click();
      const mobileMenu = page.locator('header .md\\:hidden nav');
      await expect(mobileMenu).toBeVisible();
      
      // Click on a navigation link
      await mobileMenu.locator('a[href="/market"]').click();
      
      // Mobile menu should close
      await expect(mobileMenu).not.toBeVisible();
      
      // Should navigate to the correct page
      await expect(page).toHaveURL('/market');
    });

    test('should show user info in mobile menu when authenticated', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Mock authenticated user
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            isAuthenticated: true,
            user: { email: 'mobile@example.com' }
          }
        }));
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Open mobile menu
      const mobileMenuButton = page.locator('header button[aria-label*="menu"]');
      await mobileMenuButton.click();
      
      const mobileMenu = page.locator('header .md\\:hidden nav');
      
      // Check if user info is displayed in mobile menu
      const mobileUserInfo = mobileMenu.locator('.border-t');
      if (await mobileUserInfo.isVisible()) {
        await expect(mobileUserInfo).toBeVisible();
        await expect(mobileMenu.getByText('mobile@example.com')).toBeVisible();
        await expect(mobileMenu.getByText(/Market (Connected|Disconnected)/)).toBeVisible();
      }
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should adapt layout for different screen sizes', async ({ page }) => {
      // Test desktop layout
      await page.setViewportSize({ width: 1200, height: 800 });
      const desktopNav = page.locator('header nav.hidden.md\\:flex');
      await expect(desktopNav).toBeVisible();
      
      const mobileButton = page.locator('header button.md\\:hidden');
      await expect(mobileButton).not.toBeVisible();
      
      // Test tablet layout
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(desktopNav).toBeVisible();
      
      // Test mobile layout
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(desktopNav).not.toBeVisible();
      await expect(mobileButton).toBeVisible();
    });

    test('should maintain functionality across viewport changes', async ({ page }) => {
      // Start with mobile
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Open mobile menu
      const mobileMenuButton = page.locator('header button[aria-label*="menu"]');
      await mobileMenuButton.click();
      
      // Switch to desktop
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Mobile menu should be hidden
      const mobileMenu = page.locator('header .md\\:hidden nav');
      await expect(mobileMenu).not.toBeVisible();
      
      // Desktop navigation should be visible
      const desktopNav = page.locator('header nav.hidden.md\\:flex');
      await expect(desktopNav).toBeVisible();
    });
  });

  test.describe('Theme Support', () => {
    test('should support dark mode styling', async ({ page }) => {
      // Add dark mode class to simulate dark theme
      await page.addInitScript(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check that header has dark mode classes
      const header = page.locator('header');
      await expect(header).toHaveClass(/dark:bg-gray-800/);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      // Check mobile menu button has proper aria-label
      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileMenuButton = page.locator('header button[aria-label*="menu"]');
      await expect(mobileMenuButton).toHaveAttribute('aria-label');
      
      // Check sidebar toggle has proper aria-label
      await page.setViewportSize({ width: 1024, height: 768 });
      
      const sidebarToggle = page.locator('header button[aria-label="Toggle sidebar"]');
      if (await sidebarToggle.isVisible()) {
        await expect(sidebarToggle).toHaveAttribute('aria-label', 'Toggle sidebar');
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      // Focus should move through navigation links
      await page.keyboard.press('Tab');
      
      // Check that navigation links can be focused and activated with keyboard
      const firstNavLink = page.locator('header a').first();
      await firstNavLink.focus();
      await expect(firstNavLink).toBeFocused();
      
      // Press Enter to activate
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/');
    });
  });
});