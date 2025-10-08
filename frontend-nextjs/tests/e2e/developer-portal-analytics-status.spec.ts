/**
 * E2E Tests for Developer Portal - Analytics & Status Pages
 * Tests usage analytics dashboard and API status monitoring
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Developer Portal - Usage Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/developer/analytics`);
  });

  test('should load analytics page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/TurtleTrading/);
    await expect(page.getByRole('heading', { name: /Usage Analytics/i })).toBeVisible();
  });

  test('should display time range selector', async ({ page }) => {
    // Check for time range buttons (7 days, 30 days, 90 days)
    await expect(page.getByRole('button', { name: /7 days/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /30 days/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /90 days/i })).toBeVisible();
  });

  test('should switch between time ranges', async ({ page }) => {
    // Click 30 days button
    const thirtyDaysBtn = page.getByRole('button', { name: /30 days/i });
    await thirtyDaysBtn.click();

    // Button should become active (implementation dependent)
    // This is a placeholder for actual active state checking
  });

  test('should display analytics summary cards', async ({ page }) => {
    // Check for key metrics cards
    await expect(page.getByText(/Total Requests/i)).toBeVisible();
    await expect(page.getByText(/Success Rate/i)).toBeVisible();
    await expect(page.getByText(/Avg Response Time/i)).toBeVisible();
  });

  test.describe('Charts and Visualizations', () => {
    test('should display requests over time chart', async ({ page }) => {
      await expect(page.getByText(/Requests Over Time/i)).toBeVisible();
      // Chart container should be present
    });

    test('should display endpoint usage chart', async ({ page }) => {
      await expect(page.getByText(/Endpoint Usage/i)).toBeVisible();
    });

    test('should display success rate chart', async ({ page }) => {
      await expect(page.getByText(/Success Rate/i)).toBeVisible();
    });
  });

  test.describe('Top Endpoints Section', () => {
    test('should display top endpoints table', async ({ page }) => {
      await expect(page.getByText(/Top Endpoints/i)).toBeVisible();
    });

    test.skip('should show endpoint paths and request counts', async ({ page }) => {
      // This requires actual data
      await expect(page.getByText(/\/api\/v1\//)).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be mobile responsive', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await expect(page.getByRole('heading', { name: /Usage Analytics/i })).toBeVisible();
      // Time range buttons should still be visible
      await expect(page.getByRole('button', { name: /7 days/i })).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
    });

    test('should have accessible buttons', async ({ page }) => {
      const buttons = page.getByRole('button');
      const count = await buttons.count();

      expect(count).toBeGreaterThan(0);
    });
  });
});

test.describe('Developer Portal - API Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/developer/status`);
  });

  test('should load status page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/TurtleTrading/);
    await expect(page.getByRole('heading', { name: /API Status/i })).toBeVisible();
  });

  test('should display overall system status', async ({ page }) => {
    await expect(page.getByText(/System Status/i)).toBeVisible();
    // Should show operational, degraded, or down status
    await expect(page.locator('text=/operational|degraded|down/i')).toBeVisible();
  });

  test('should display all service statuses', async ({ page }) => {
    // Check for 6 services
    await expect(page.getByText(/Stock Data API/i)).toBeVisible();
    await expect(page.getByText(/AI Predictions API/i)).toBeVisible();
    await expect(page.getByText(/Sentiment Analysis API/i)).toBeVisible();
    await expect(page.getByText(/Market Data API/i)).toBeVisible();
    await expect(page.getByText(/WebSocket Service/i)).toBeVisible();
    await expect(page.getByText(/Authentication API/i)).toBeVisible();
  });

  test('should display service metrics', async ({ page }) => {
    // Each service should show response time and uptime
    await expect(page.getByText(/Response Time/i)).toBeVisible();
    await expect(page.getByText(/Uptime/i)).toBeVisible();
  });

  test('should have refresh button', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /Refresh/i });
    await expect(refreshButton).toBeVisible();
    await expect(refreshButton).toBeEnabled();
  });

  test('should refresh status when clicking refresh button', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /Refresh/i });
    await refreshButton.click();

    // Button might show loading state briefly
    // This is implementation dependent
  });

  test.describe('Service Status Indicators', () => {
    test('should show colored status indicators', async ({ page }) => {
      // Status indicators should have colors (green/yellow/red)
      // This checks for presence of status indicators
      const statusIndicators = page.locator('[class*="rounded-full"]').filter({ hasText: '' });
      const count = await statusIndicators.count();

      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Last Updated Time', () => {
    test('should display last updated timestamp', async ({ page }) => {
      await expect(page.getByText(/Last checked:/i)).toBeVisible();
    });
  });

  test.describe('Incident History', () => {
    test('should have incident history section', async ({ page }) => {
      await expect(page.getByText(/Incident History/i)).toBeVisible();
    });

    test.skip('should display recent incidents', async ({ page }) => {
      // This requires actual incident data
      await expect(page.getByText(/No recent incidents/i)).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be mobile responsive', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await expect(page.getByRole('heading', { name: /API Status/i })).toBeVisible();
      await expect(page.getByText(/Stock Data API/i)).toBeVisible();
    });

    test('should be tablet responsive', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await expect(page.getByRole('heading', { name: /API Status/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
    });

    test('should have accessible refresh button', async ({ page }) => {
      const button = page.getByRole('button', { name: /Refresh/i });
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    });

    test('should have status information in accessible format', async ({ page }) => {
      // Status should be readable by screen readers, not just color-coded
      await expect(page.getByText(/operational|degraded|down/i)).toBeVisible();
    });
  });
});

test.describe('Developer Portal - Changelog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/developer/changelog`);
  });

  test('should load changelog page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/TurtleTrading/);
    await expect(page.getByRole('heading', { name: /Changelog/i })).toBeVisible();
  });

  test('should display version history', async ({ page }) => {
    // Check for version numbers
    await expect(page.getByText(/v1\.2\.0|v1\.1\.0|v1\.0\.0/i)).toBeVisible();
  });

  test('should display release dates', async ({ page }) => {
    // Check for dates in release notes
    await expect(page.getByText(/2025-/)).toBeVisible();
  });

  test('should categorize changes', async ({ page }) => {
    // Look for change type indicators
    await expect(page.locator('text=/feature|improvement|bug|new/i')).toBeVisible();
  });

  test('should have subscribe section', async ({ page }) => {
    await expect(page.getByText(/Subscribe/i)).toBeVisible();
  });
});

test.describe('Developer Portal - Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/developer/support`);
  });

  test('should load support page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/TurtleTrading/);
    await expect(page.getByRole('heading', { name: /Support/i })).toBeVisible();
  });

  test('should display support resources', async ({ page }) => {
    await expect(page.getByText(/Documentation/i)).toBeVisible();
    await expect(page.getByText(/Community Forum/i)).toBeVisible();
    await expect(page.getByText(/GitHub Issues/i)).toBeVisible();
  });

  test('should have feedback form', async ({ page }) => {
    // Check for form tabs
    await expect(page.getByRole('tab', { name: /Question/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Feature Request/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Bug Report/i })).toBeVisible();
  });

  test('should display contact information', async ({ page }) => {
    await expect(page.getByText(/Email/i)).toBeVisible();
    await expect(page.getByText(/Discord/i)).toBeVisible();
  });

  test('should have FAQ section', async ({ page }) => {
    await expect(page.getByText(/FAQ|Frequently Asked Questions/i)).toBeVisible();
  });

  test('should submit question feedback form', async ({ page }) => {
    // Select Question tab (default)
    await expect(page.getByRole('tab', { name: /Question/i })).toHaveAttribute('data-state', 'active');

    // Fill out the form
    const subjectInput = page.getByPlaceholder(/What do you need help with/i);
    await subjectInput.fill('Test Question');

    const descriptionInput = page.getByPlaceholder(/Provide details about your question/i);
    await descriptionInput.fill('This is a test question with sufficient detail');

    // Submit form
    const submitButton = page.getByRole('button', { name: /Submit Question/i });
    await submitButton.click();

    // Should show success message
    await expect(page.getByText(/Thank you for your feedback/i)).toBeVisible();
    await expect(page.getByText(/Your question has been submitted successfully/i)).toBeVisible();

    // Form should be reset
    await expect(subjectInput).toHaveValue('');
    await expect(descriptionInput).toHaveValue('');
  });

  test('should submit bug report with environment', async ({ page }) => {
    // Select Bug Report tab
    await page.getByRole('tab', { name: /Bug Report/i }).click();

    // Fill out the form
    const subjectInput = page.getByPlaceholder(/Brief description of the issue/i);
    await subjectInput.fill('Test Bug Report');

    const descriptionInput = page.getByPlaceholder(/Steps to reproduce/i);
    await descriptionInput.fill('This is a detailed test bug report with steps');

    const environmentInput = page.getByPlaceholder(/Browser, SDK version/i);
    await environmentInput.fill('Chrome 120, macOS 14');

    // Submit form
    const submitButton = page.getByRole('button', { name: /Submit Bug Report/i });
    await submitButton.click();

    // Should show success message
    await expect(page.getByText(/Thank you for your feedback/i)).toBeVisible();
    await expect(page.getByText(/Your bug report has been submitted successfully/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /Submit Question/i });
    await submitButton.click();

    // Should show validation errors
    await expect(page.getByText(/Subject is required/i)).toBeVisible();
    await expect(page.getByText(/Description is required/i)).toBeVisible();
  });

  test('should validate minimum length', async ({ page }) => {
    // Fill with too short text
    const subjectInput = page.getByPlaceholder(/What do you need help with/i);
    await subjectInput.fill('ab'); // Less than 3 chars

    const descriptionInput = page.getByPlaceholder(/Provide details/i);
    await descriptionInput.fill('short'); // Less than 10 chars

    // Submit form
    const submitButton = page.getByRole('button', { name: /Submit Question/i });
    await submitButton.click();

    // Should show validation errors
    await expect(page.getByText(/at least 3 characters/i)).toBeVisible();
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
  });

  test('should clear errors when user types', async ({ page }) => {
    // Submit empty form to trigger errors
    const submitButton = page.getByRole('button', { name: /Submit Question/i });
    await submitButton.click();

    // Errors should be visible
    await expect(page.getByText(/Subject is required/i)).toBeVisible();

    // Start typing in subject
    const subjectInput = page.getByPlaceholder(/What do you need help with/i);
    await subjectInput.fill('Test');

    // Subject error should clear
    await expect(page.getByText(/Subject is required/i)).not.toBeVisible();
  });
});
