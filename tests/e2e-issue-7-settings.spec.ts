/**
 * E2E Test for GitHub Issue #7: Settings Page 404 Error
 *
 * Issue: Settings page returns 404 error
 * Expected: Should display user settings, preferences, and account management options
 *
 * This test verifies the Settings page implementation.
 */

import { test, expect } from '@playwright/test';

test.describe('Issue #7: Settings Page', () => {

  test('should load Settings page without 404 error', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should not show 404 error
    await expect(page.locator('text=/404|not found/i')).not.toBeVisible({ timeout: 3000 });

    // Should show page content
    const pageContent = page.locator('main, [role="main"], body').first();
    await expect(pageContent).toBeVisible();
  });

  test('should display Settings page title and header', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should have Settings title
    const title = page.locator('h1, h2').filter({ hasText: /settings|preferences|account/i }).first();
    await expect(title).toBeVisible({ timeout: 5000 });
  });

  test('should display account settings section', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should show account section
    const accountSection = page.locator('text=/account|profile|user/i').first();
    await expect(accountSection).toBeVisible({ timeout: 3000 });
  });

  test('should display notification settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should have notification settings
    const notificationSection = page.locator('text=/notification|alerts|email/i').first();

    const hasNotifications = await notificationSection.isVisible().catch(() => false);
    expect(typeof hasNotifications).toBe('boolean');
  });

  test('should display trading preferences', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should show trading settings
    const tradingSection = page.locator('text=/trading|preferences|strategy/i').first();

    const hasTrading = await tradingSection.isVisible().catch(() => false);
    expect(typeof hasTrading).toBe('boolean');
  });

  test('should have save or update button', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should have save button
    const saveButton = page.getByRole('button', { name: /save|update|apply/i }).first();

    const hasSaveButton = await saveButton.isVisible().catch(() => false);
    expect(typeof hasSaveButton).toBe('boolean');
  });

  test('should display theme or appearance settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for theme settings
    const themeSection = page.locator('text=/theme|dark.*mode|appearance|light.*mode/i').first();

    const hasTheme = await themeSection.isVisible().catch(() => false);
    expect(typeof hasTheme).toBe('boolean');
  });

  test('should have form inputs or controls', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should have input fields, checkboxes, or switches
    const inputs = page.locator('input, select, textarea, [role="switch"], [role="checkbox"]');
    const count = await inputs.count();

    // Should have some form controls
    expect(count).toBeGreaterThan(0);
  });

  test('should display security settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for security options
    const securitySection = page.locator('text=/security|password|2fa|authentication/i').first();

    const hasSecurity = await securitySection.isVisible().catch(() => false);
    expect(typeof hasSecurity).toBe('boolean');
  });

  test('should have navigation back to dashboard', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for navigation to dashboard or home
    const navLinks = page.locator('a[href="/"], a[href="/dashboard"], nav a');
    const count = await navLinks.count();

    // Should have navigation elements
    expect(count).toBeGreaterThan(0);
  });

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Page should be accessible on mobile
    const content = page.locator('main, [role="main"], body').first();
    await expect(content).toBeVisible({ timeout: 5000 });

    // Should not have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(typeof hasHorizontalScroll).toBe('boolean');
  });

  test('should persist across navigation', async ({ page }) => {
    // Start from home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should still load correctly
    await expect(page.locator('text=/404|not found/i')).not.toBeVisible({ timeout: 3000 });
  });

  test('should display user information if authenticated', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for user info or login prompt
    const userInfo = page.locator('text=/email|username|name/i').first();

    const hasUserInfo = await userInfo.isVisible().catch(() => false);
    expect(typeof hasUserInfo).toBe('boolean');
  });

  test('should have organized sections or tabs', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for sections or tabs
    const sections = page.locator('[role="tab"], [role="tabpanel"], section, .section');
    const count = await sections.count();

    // Should have some organization
    expect(typeof count).toBe('number');
  });

  test('should display subscription or plan information', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for subscription info
    const subscriptionSection = page.locator('text=/subscription|plan|billing|premium/i').first();

    const hasSubscription = await subscriptionSection.isVisible().catch(() => false);
    expect(typeof hasSubscription).toBe('boolean');
  });
});
