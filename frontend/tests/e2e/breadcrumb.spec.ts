import { test, expect } from '@playwright/test';

test.describe('Breadcrumb Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Breadcrumb Visibility and Layout', () => {
    test('should be visible with proper styling', async ({ page }) => {
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Breadcrumb should be visible
      await expect(breadcrumb).toBeVisible();
      
      // Should have proper styling classes
      await expect(breadcrumb).toHaveClass(/bg-white|dark:bg-gray-800/);
      await expect(breadcrumb).toHaveClass(/border-b/);
      await expect(breadcrumb).toHaveClass(/border-gray-200|dark:border-gray-700/);
    });

    test('should have proper container and height', async ({ page }) => {
      const breadcrumb = page.locator('nav:has-text("Home")');
      const container = breadcrumb.locator('.max-w-7xl.mx-auto');
      const content = container.locator('.flex.items-center.h-12');
      
      await expect(container).toBeVisible();
      await expect(container).toHaveClass(/px-4|sm:px-6|lg:px-8/);
      await expect(content).toHaveClass(/h-12/);
      await expect(content).toHaveClass(/text-sm/);
    });
  });

  test.describe('Home Page Breadcrumb', () => {
    test('should show only Home on root path', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Should show Home link
      const homeLink = breadcrumb.locator('a[href="/"]');
      await expect(homeLink).toBeVisible();
      await expect(homeLink).toHaveText('Home');
      
      // Should not show separator after Home on root page
      const separator = breadcrumb.locator('text=/');
      if (await separator.isVisible()) {
        // If separator exists, there should be additional path segments
        const pathSegments = await breadcrumb.locator('span, a').count();
        expect(pathSegments).toBeGreaterThan(1);
      }
    });

    test('should have proper home link styling', async ({ page }) => {
      const breadcrumb = page.locator('nav:has-text("Home")');
      const homeLink = breadcrumb.locator('a[href="/"]');
      
      await expect(homeLink).toHaveClass(/text-gray-500/);
      await expect(homeLink).toHaveClass(/hover:text-gray-700/);
      await expect(homeLink).toHaveClass(/dark:text-gray-400/);
      await expect(homeLink).toHaveClass(/dark:hover:text-gray-300/);
      await expect(homeLink).toHaveClass(/transition-colors/);
    });

    test('should navigate to home when clicked', async ({ page }) => {
      // Start from a different page
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      const homeLink = breadcrumb.locator('a[href="/"]');
      
      await homeLink.click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Path Navigation', () => {
    test('should show correct breadcrumb for single level path', async ({ page }) => {
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Should show Home link
      await expect(breadcrumb.locator('a[href="/"]')).toBeVisible();
      await expect(breadcrumb.locator('a[href="/"]')).toHaveText('Home');
      
      // Should show separator
      await expect(breadcrumb.locator('text=/')).toBeVisible();
      
      // Should show current page as non-link
      await expect(breadcrumb.locator('span:has-text("Market")')).toBeVisible();
    });

    test('should show correct breadcrumb for multi-level path', async ({ page }) => {
      await page.goto('/market/stocks');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Should show Home link
      await expect(breadcrumb.locator('a[href="/"]')).toBeVisible();
      
      // Should show Market link
      const marketLink = breadcrumb.locator('a[href="/market"]');
      await expect(marketLink).toBeVisible();
      await expect(marketLink).toHaveText('Market');
      
      // Should show separators
      const separators = breadcrumb.locator('text=/');
      await expect(separators.first()).toBeVisible();
      await expect(separators.nth(1)).toBeVisible();
      
      // Should show current page as non-link
      await expect(breadcrumb.locator('span:has-text("Stocks")')).toBeVisible();
    });

    test('should show correct breadcrumb for deep path', async ({ page }) => {
      await page.goto('/market/stocks/analysis');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Check all levels
      await expect(breadcrumb.locator('a[href="/"]')).toContainText('Home');
      await expect(breadcrumb.locator('a[href="/market"]')).toContainText('Market');
      await expect(breadcrumb.locator('a[href="/market/stocks"]')).toContainText('Stocks');
      await expect(breadcrumb.locator('span:has-text("Analysis")')).toBeVisible();
      
      // Should have correct number of separators
      const separators = breadcrumb.locator('text=/');
      await expect(separators).toHaveCount(3);
    });
  });

  test.describe('Path Segment Formatting', () => {
    test('should capitalize path segments correctly', async ({ page }) => {
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      const currentSegment = breadcrumb.locator('span').last();
      
      await expect(currentSegment).toHaveText('Market');
      await expect(currentSegment).toHaveClass(/capitalize/);
    });

    test('should handle complex path segments', async ({ page }) => {
      await page.goto('/stock-analysis');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Should capitalize first letter and handle hyphens
      const segment = breadcrumb.locator('span').last();
      await expect(segment).toContainText('Stock-analysis');
      await expect(segment).toHaveClass(/capitalize/);
    });

    test('should handle URL encoded segments', async ({ page }) => {
      await page.goto('/my%20portfolio');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      const segment = breadcrumb.locator('span').last();
      
      // Should decode and capitalize URL segments
      const text = await segment.textContent();
      expect(text).toMatch(/My.*portfolio/i);
    });
  });

  test.describe('Navigation Functionality', () => {
    test('should navigate correctly when intermediate segments are clicked', async ({ page }) => {
      await page.goto('/market/stocks/analysis');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Click on Market breadcrumb
      const marketLink = breadcrumb.locator('a[href="/market"]');
      await marketLink.click();
      await expect(page).toHaveURL('/market');
      
      // Go back to deep path
      await page.goto('/market/stocks/analysis');
      await page.waitForLoadState('networkidle');
      
      // Click on Stocks breadcrumb
      const stocksLink = breadcrumb.locator('a[href="/market/stocks"]');
      await stocksLink.click();
      await expect(page).toHaveURL('/market/stocks');
    });

    test('should maintain breadcrumb state after navigation', async ({ page }) => {
      // Start from market page
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      // Navigate to another page
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Breadcrumb should update to show current path
      await expect(breadcrumb.locator('span:has-text("Settings")')).toBeVisible();
      
      // Home link should still work
      await breadcrumb.locator('a[href="/"]').click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Current Page Highlighting', () => {
    test('should style current page segment differently', async ({ page }) => {
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      const currentSegment = breadcrumb.locator('span').last();
      
      // Current segment should have different styling
      await expect(currentSegment).toHaveClass(/text-gray-900/);
      await expect(currentSegment).toHaveClass(/dark:text-gray-100/);
      await expect(currentSegment).toHaveClass(/font-medium/);
      
      // Should not be a link
      await expect(currentSegment).not.toHaveAttribute('href');
    });

    test('should style intermediate segments as links', async ({ page }) => {
      await page.goto('/market/stocks');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      const marketLink = breadcrumb.locator('a[href="/market"]');
      
      // Intermediate segments should be styled as links
      await expect(marketLink).toHaveClass(/text-gray-500/);
      await expect(marketLink).toHaveClass(/hover:text-gray-700/);
      await expect(marketLink).toHaveClass(/dark:text-gray-400/);
      await expect(marketLink).toHaveClass(/dark:hover:text-gray-300/);
      await expect(marketLink).toHaveClass(/transition-colors/);
      await expect(marketLink).toHaveClass(/capitalize/);
    });
  });

  test.describe('Separator Handling', () => {
    test('should use default separator', async ({ page }) => {
      await page.goto('/market/stocks');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      const separators = breadcrumb.locator('.mx-2');
      
      // Should use forward slash as default separator
      const firstSeparator = separators.first();
      await expect(firstSeparator).toHaveText('/');
      
      const secondSeparator = separators.nth(1);
      await expect(secondSeparator).toHaveText('/');
    });

    test('should style separators properly', async ({ page }) => {
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      const separator = breadcrumb.locator('.mx-2').first();
      
      // Separators should have proper styling
      await expect(separator).toHaveClass(/mx-2/);
      await expect(separator).toHaveClass(/text-gray-400/);
    });

    test('should not show separator after last segment', async ({ page }) => {
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Get all elements in breadcrumb
      const allElements = breadcrumb.locator('*');
      const lastElement = allElements.last();
      
      // Last element should be the current page span, not a separator
      const tagName = await lastElement.evaluate(el => el.tagName);
      expect(tagName.toLowerCase()).toBe('span');
      
      const text = await lastElement.textContent();
      expect(text).not.toBe('/');
    });
  });

  test.describe('Custom Props', () => {
    test('should handle custom home label if supported', async ({ page }) => {
      const breadcrumb = page.locator('nav:has-text("Home")');
      const homeLink = breadcrumb.locator('a[href="/"]');
      
      // Default home label should be "Home"
      await expect(homeLink).toHaveText('Home');
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should maintain functionality on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/market/stocks');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Breadcrumb should still be visible and functional on mobile
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb.locator('a[href="/"]')).toBeVisible();
      await expect(breadcrumb.locator('a[href="/market"]')).toBeVisible();
      
      // Navigation should work on mobile
      await breadcrumb.locator('a[href="/market"]').click();
      await expect(page).toHaveURL('/market');
    });

    test('should maintain readability across screen sizes', async ({ page }) => {
      const screenSizes = [
        { width: 375, height: 667 },  // Mobile
        { width: 768, height: 1024 }, // Tablet  
        { width: 1024, height: 768 }, // Desktop
      ];
      
      for (const size of screenSizes) {
        await page.setViewportSize(size);
        await page.goto('/market/stocks/analysis');
        await page.waitForLoadState('networkidle');
        
        const breadcrumb = page.locator('nav:has-text("Home")');
        
        // Should be readable at all sizes
        await expect(breadcrumb).toBeVisible();
        await expect(breadcrumb.locator('a[href="/"]')).toBeVisible();
        
        // Text should be appropriately sized
        await expect(breadcrumb.locator('.text-sm')).toBeVisible();
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
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Check dark mode classes are applied
      await expect(breadcrumb).toHaveClass(/dark:bg-gray-800/);
      await expect(breadcrumb).toHaveClass(/dark:border-gray-700/);
      
      // Links should have dark mode colors
      const homeLink = breadcrumb.locator('a[href="/"]');
      await expect(homeLink).toHaveClass(/dark:text-gray-400/);
      await expect(homeLink).toHaveClass(/dark:hover:text-gray-300/);
    });

    test('should maintain contrast in both themes', async ({ page }) => {
      await page.goto('/market');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Test light mode visibility
      await expect(breadcrumb).toBeVisible();
      
      // Switch to dark mode
      await page.addInitScript(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be visible in dark mode
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb.locator('a[href="/"]')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should use semantic navigation element', async ({ page }) => {
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Should use nav element for semantic meaning
      await expect(breadcrumb).toBeVisible();
      
      const tagName = await breadcrumb.evaluate(el => el.tagName);
      expect(tagName.toLowerCase()).toBe('nav');
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/market/stocks');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Focus first link
      const homeLink = breadcrumb.locator('a[href="/"]');
      await homeLink.focus();
      await expect(homeLink).toBeFocused();
      
      // Tab to next link
      await page.keyboard.press('Tab');
      const marketLink = breadcrumb.locator('a[href="/market"]');
      await expect(marketLink).toBeFocused();
      
      // Enter should navigate
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/market');
    });

    test('should provide clear visual hierarchy', async ({ page }) => {
      await page.goto('/market/stocks/analysis');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Links should be visually distinct from current page
      const homeLink = breadcrumb.locator('a[href="/"]');
      const currentPage = breadcrumb.locator('span').last();
      
      // Current page should have stronger visual weight
      await expect(currentPage).toHaveClass(/font-medium/);
      await expect(homeLink).not.toHaveClass(/font-medium/);
      
      // Current page should have different color
      const currentPageColor = await currentPage.getAttribute('class');
      const linkColor = await homeLink.getAttribute('class');
      
      expect(currentPageColor).toContain('text-gray-900');
      expect(linkColor).toContain('text-gray-500');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle empty path segments gracefully', async ({ page }) => {
      await page.goto('/market//stocks');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Should not create empty segments
      const segments = breadcrumb.locator('span, a');
      const segmentCount = await segments.count();
      
      for (let i = 0; i < segmentCount; i++) {
        const segment = segments.nth(i);
        const text = await segment.textContent();
        expect(text?.trim()).toBeTruthy();
      }
    });

    test('should handle special characters in paths', async ({ page }) => {
      await page.goto('/market?tab=analysis');
      await page.waitForLoadState('networkidle');
      
      const breadcrumb = page.locator('nav:has-text("Home")');
      
      // Should still show breadcrumb for path portion
      await expect(breadcrumb.locator('a[href="/"]')).toBeVisible();
      await expect(breadcrumb.locator('span:has-text("Market")')).toBeVisible();
    });
  });
});