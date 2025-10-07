/**
 * E2E Tests for Developer Portal - Onboarding Flow
 * Tests complete developer onboarding journey
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Developer Portal - Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/developer/onboarding`);
  });

  test('should load onboarding page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/TurtleTrading/);
    await expect(page.getByRole('heading', { name: /Developer Onboarding/i })).toBeVisible();
  });

  test('should display progress bar', async ({ page }) => {
    // Look for progress indicator
    await expect(page.getByText(/Complete/i)).toBeVisible();
    // Progress bar should start at 0%
    await expect(page.getByText(/0%/)).toBeVisible();
  });

  test('should display 5 onboarding steps', async ({ page }) => {
    // Check for all 5 steps
    await expect(page.getByText(/Generate API Key/i)).toBeVisible();
    await expect(page.getByText(/Install SDK/i)).toBeVisible();
    await expect(page.getByText(/Make First API Call/i)).toBeVisible();
    await expect(page.getByText(/View Analytics/i)).toBeVisible();
    await expect(page.getByText(/Join Community/i)).toBeVisible();
  });

  test('should have action buttons for each step', async ({ page }) => {
    // Step 1: Go to API Keys
    await expect(page.getByRole('link', { name: /Go to API Keys/i })).toBeVisible();

    // Step 2: View Docs
    await expect(page.getByRole('link', { name: /View Docs/i })).toBeVisible();

    // Step 3: Try Example
    await expect(page.getByRole('link', { name: /Try Example/i })).toBeVisible();

    // Step 4: View Analytics
    await expect(page.getByRole('link', { name: /View Analytics/i })).toBeVisible();

    // Step 5: Join Discord
    await expect(page.getByRole('link', { name: /Join Discord/i })).toBeVisible();
  });

  test('should navigate to API keys page from step 1', async ({ page }) => {
    const apiKeysLink = page.getByRole('link', { name: /Go to API Keys/i });
    await expect(apiKeysLink).toHaveAttribute('href', /\/developer\/api-keys/);

    await apiKeysLink.click();
    await expect(page).toHaveURL(/\/developer\/api-keys/);
  });

  test('should navigate to docs from step 2', async ({ page }) => {
    const docsLink = page.getByRole('link', { name: /View Docs/i });
    await expect(docsLink).toHaveAttribute('href', /\/docs/);

    await docsLink.click();
    await expect(page).toHaveURL(/\/docs/);
  });

  test('should navigate to analytics from step 4', async ({ page }) => {
    const analyticsLink = page.getByRole('link', { name: /View Analytics/i });
    await expect(analyticsLink).toHaveAttribute('href', /\/developer\/analytics/);

    await analyticsLink.click();
    await expect(page).toHaveURL(/\/developer\/analytics/);
  });

  test.describe('Step Completion', () => {
    test.skip('should mark step as complete when clicked', async ({ page }) => {
      // This test requires localStorage or state management
      // Implementation depends on actual completion tracking mechanism
      const step1 = page.getByText(/Generate API Key/i).first();
      await step1.click();

      // Should show completion indicator
      await expect(page.getByText(/20%/)).toBeVisible();
    });

    test.skip('should persist completion state', async ({ page }) => {
      // Test localStorage persistence
      // Requires actual implementation of completion tracking
    });

    test.skip('should update progress bar when steps completed', async ({ page }) => {
      // Test progress bar updates
      // Should go from 0% to 20% to 40% etc.
    });
  });

  test.describe('Quick Links Section', () => {
    test('should display quick links section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Quick Links/i })).toBeVisible();
    });

    test('should have link to API documentation', async ({ page }) => {
      const docsLink = page.getByRole('link', { name: /API Documentation/i });
      await expect(docsLink).toBeVisible();
    });

    test('should have link to SDK reference', async ({ page }) => {
      const sdkLink = page.getByRole('link', { name: /SDK Reference/i });
      await expect(sdkLink).toBeVisible();
    });

    test('should have link to API status', async ({ page }) => {
      const statusLink = page.getByRole('link', { name: /API Status/i });
      await expect(statusLink).toBeVisible();
      await expect(statusLink).toHaveAttribute('href', /\/developer\/status/);
    });

    test('should have link to support', async ({ page }) => {
      const supportLink = page.getByRole('link', { name: /Support/i });
      await expect(supportLink).toBeVisible();
      await expect(supportLink).toHaveAttribute('href', /\/developer\/support/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should be mobile responsive', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Steps should stack vertically
      await expect(page.getByText(/Generate API Key/i)).toBeVisible();
      await expect(page.getByText(/Install SDK/i)).toBeVisible();
    });

    test('should be tablet responsive', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await expect(page.getByRole('heading', { name: /Developer Onboarding/i })).toBeVisible();
      await expect(page.getByText(/Progress:/i)).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const mainHeading = page.getByRole('heading', { level: 1 });
      await expect(mainHeading).toBeVisible();
    });

    test('should have accessible navigation links', async ({ page }) => {
      const links = page.getByRole('link');
      const count = await links.count();

      expect(count).toBeGreaterThan(0);

      // Check first few links have href attributes
      for (let i = 0; i < Math.min(count, 5); i++) {
        const link = links.nth(i);
        await expect(link).toHaveAttribute('href');
      }
    });

    test('should have descriptive text for each step', async ({ page }) => {
      // Each step should have a description
      await expect(page.getByText(/Create your first API key to authenticate requests/i)).toBeVisible();
      await expect(page.getByText(/Install the TurtleTrading SDK/i)).toBeVisible();
    });
  });

  test.describe('Icons and Visual Elements', () => {
    test('should display icons for each step', async ({ page }) => {
      // Check that step cards have visual elements
      // This is a basic check - actual icon testing would need more specific selectors
      const stepCards = page.locator('[class*="rounded"]').filter({ hasText: /Generate API Key|Install SDK|Make First API Call|View Analytics|Join Community/i });
      const count = await stepCards.count();

      expect(count).toBeGreaterThanOrEqual(5);
    });
  });
});
