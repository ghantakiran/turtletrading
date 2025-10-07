/**
 * E2E Tests for Developer Portal - API Key Management
 * Tests complete user workflows for managing API keys
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Developer Portal - API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/developer/api-keys`);
  });

  test('should load API keys page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/TurtleTrading/);
    await expect(page.getByRole('heading', { name: /API Keys/i, level: 1 })).toBeVisible();
    await expect(page.getByText(/Manage your API keys for TurtleTrading API access/)).toBeVisible();
  });

  test('should display empty state when no API keys exist', async ({ page }) => {
    // Check empty state
    await expect(page.getByRole('heading', { name: /No API Keys Yet/i })).toBeVisible();
    await expect(page.getByText(/Get started by generating your first API key/)).toBeVisible();

    // Check generate button exists
    await expect(page.getByRole('button', { name: /Generate Your First Key/i })).toBeVisible();
  });

  test('should have Generate New API Key button in header', async ({ page }) => {
    const generateButton = page.getByRole('button', { name: /Generate New API Key/i });
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();
  });

  test('should display API documentation section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /API Documentation/i, level: 3 })).toBeVisible();
    await expect(page.getByText(/Learn how to use your API keys/)).toBeVisible();

    const docsLink = page.getByRole('link', { name: /View Documentation/i });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute('href', /\/developer\/docs/);
  });

  test('should open create API key modal when clicking generate button', async ({ page }) => {
    // Click the generate button
    await page.getByRole('button', { name: /Generate New API Key/i }).click();

    // Modal should appear
    // Note: This test assumes modal implementation - may need adjustment based on actual implementation
    await expect(page.getByText(/Create New API Key/i)).toBeVisible();
  });

  test('should navigate to documentation when clicking docs link', async ({ page }) => {
    const docsLink = page.getByRole('link', { name: /View Documentation/i });
    await docsLink.click();

    // Should navigate to docs page
    await expect(page).toHaveURL(/\/developer\/docs/);
  });

  test.describe('API Key List (when keys exist)', () => {
    test.skip('should display list of API keys', async ({ page }) => {
      // This test requires mock data or actual API keys
      // Skip until we have proper test data setup
      await expect(page.getByText(/API Key:/)).toBeVisible();
    });

    test.skip('should show key permissions', async ({ page }) => {
      // Test to verify permissions display (read, write, delete)
      await expect(page.getByText(/Permissions:/)).toBeVisible();
    });

    test.skip('should show last used timestamp', async ({ page }) => {
      // Test to verify last used timestamp display
      await expect(page.getByText(/Last used:/)).toBeVisible();
    });

    test.skip('should have copy button for each API key', async ({ page }) => {
      // Test clipboard functionality
      const copyButton = page.getByRole('button', { name: /Copy/i }).first();
      await expect(copyButton).toBeVisible();
    });

    test.skip('should have revoke button for each API key', async ({ page }) => {
      // Test revoke functionality
      const revokeButton = page.getByRole('button', { name: /Revoke/i }).first();
      await expect(revokeButton).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be mobile responsive', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Page should still be accessible
      await expect(page.getByRole('heading', { name: /API Keys/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Generate/i })).toBeVisible();
    });

    test('should be tablet responsive', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Page should still be accessible
      await expect(page.getByRole('heading', { name: /API Keys/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Generate New API Key/i })).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();

      const h3 = page.getByRole('heading', { level: 3 });
      await expect(h3).toBeVisible();
    });

    test('should have accessible buttons', async ({ page }) => {
      const buttons = page.getByRole('button');
      const count = await buttons.count();

      expect(count).toBeGreaterThan(0);

      // All buttons should have accessible names
      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    });

    test('should have accessible links', async ({ page }) => {
      const link = page.getByRole('link', { name: /View Documentation/i });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href');
    });
  });
});
