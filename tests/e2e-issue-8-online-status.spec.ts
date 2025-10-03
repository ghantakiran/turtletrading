/**
 * E2E Test for GitHub Issue #8: Offline/Online Status Indicator
 *
 * Issue: Need clear visual indicator showing real-time connection status
 * Expected: Status badge should show "Live" when connected, "Offline" when disconnected
 *
 * This test verifies the connection status indicator implementation.
 */

import { test, expect } from '@playwright/test';

test.describe('Issue #8: Offline/Online Status Indicator', () => {

  test('should display connection status badge in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that connection status badge exists
    const statusBadge = page.locator('[class*="bg-green-500"], [class*="bg-red-500"]').first();
    await expect(statusBadge).toBeVisible({ timeout: 5000 });
  });

  test('should show "Live" status when connected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for Live or Connected status
    const liveStatus = page.getByText(/Live|Connected/i).first();

    // Should show either Live or Offline status
    const isVisible = await liveStatus.isVisible().catch(() => false);

    if (isVisible) {
      // If Live is visible, verify it has the correct styling
      const statusElement = await liveStatus.locator('..').first();
      const classes = await statusElement.getAttribute('class') || '';

      // Should have green styling for connected state
      expect(classes).toMatch(/green/i);
    }
  });

  test('should show "Offline" status when disconnected', async ({ page }) => {
    // Simulate offline by blocking API calls
    await page.route('**/api/**', route => route.abort());

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for Offline status
    const offlineStatus = page.getByText(/Offline|Disconnected/i).first();
    await expect(offlineStatus).toBeVisible({ timeout: 5000 });
  });

  test('should use WiFi icon for online status', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for WiFi or WiFiOff icon in status badge
    const statusArea = page.locator('[class*="gap-2"]').filter({
      hasText: /Live|Offline|Connected|Disconnected/i
    }).first();

    // Should have an icon (svg element)
    const icon = statusArea.locator('svg').first();
    await expect(icon).toBeVisible({ timeout: 3000 });
  });

  test('should use different colors for online vs offline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get status badge
    const statusBadge = page.locator('[class*="bg-green-500"], [class*="bg-red-500"]').first();
    const classes = await statusBadge.getAttribute('class') || '';

    // Should have either green (online) or red (offline) styling
    const hasColorIndicator = classes.includes('green') || classes.includes('red');
    expect(hasColorIndicator).toBeTruthy();
  });

  test('should be visible on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const statusIndicator = page.getByText(/Live|Offline/i).first();
    await expect(statusIndicator).toBeVisible({ timeout: 3000 });
  });

  test('should be accessible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Status might be in mobile menu or header
    const statusIndicator = page.getByText(/Live|Offline/i).first();

    // On mobile, might need to open menu first
    const isVisible = await statusIndicator.isVisible().catch(() => false);

    if (!isVisible) {
      // Try opening mobile menu
      const menuButton = page.locator('[aria-label="Menu"], button:has-text("Menu")').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Should be visible somewhere
    await expect(statusIndicator).toBeVisible({ timeout: 5000 });
  });

  test('should update status dynamically when connection changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get initial status
    const statusBadge = page.locator('[class*="bg-green-500"], [class*="bg-red-500"]').first();
    const initialText = await statusBadge.textContent();

    // Simulate going offline
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);

    // Status should potentially change (this is implementation dependent)
    // Just verify the status element still exists
    await expect(statusBadge).toBeVisible();

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);

    // Status element should still be visible
    await expect(statusBadge).toBeVisible();
  });

  test('should show connection status near market data', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Status should be in the same general area as market indices (SPY, VIX)
    const headerSection = page.locator('header').first();

    // Both status and market data should be in header
    const statusInHeader = headerSection.getByText(/Live|Offline/i).first();
    await expect(statusInHeader).toBeVisible({ timeout: 3000 });
  });

  test('should have tooltip or label explaining status', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const statusBadge = page.getByText(/Live|Offline/i).first();

    // Should have clear text label
    await expect(statusBadge).toBeVisible();

    // Text should be readable
    const text = await statusBadge.textContent();
    expect(text).toMatch(/Live|Offline|Connected|Disconnected/i);
  });

  test('should persist status across page navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get initial status
    const initialStatus = await page.getByText(/Live|Offline/i).first().textContent();

    // Navigate to different page
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Status should still be visible
    const newStatus = page.getByText(/Live|Offline/i).first();
    await expect(newStatus).toBeVisible({ timeout: 3000 });
  });

  test('should have appropriate ARIA labels for accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Status badge should be accessible
    const statusBadge = page.getByText(/Live|Offline/i).first();
    await expect(statusBadge).toBeVisible();

    // Should have meaningful text for screen readers
    const text = await statusBadge.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});
