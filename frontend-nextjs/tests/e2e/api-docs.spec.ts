import { test, expect } from '@playwright/test';

test.describe('API Documentation Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/docs');
  });

  test('should load the page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/TurtleTrading/);
    await expect(page.getByRole('heading', { name: /TurtleTrading API Documentation/ })).toBeVisible();
  });

  test('should display hero section with correct content', async ({ page }) => {
    // Check hero heading
    await expect(page.getByRole('heading', { name: /TurtleTrading API Documentation/ })).toBeVisible();

    // Check description
    await expect(page.getByText(/AI-powered stock market analysis/)).toBeVisible();

    // Check CTA buttons
    await expect(page.getByRole('link', { name: /Try Interactive Docs/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /View OpenAPI Schema/ })).toBeVisible();
  });

  test('should have functional navigation links', async ({ page }) => {
    // Check Interactive Docs link
    const interactiveLink = page.getByRole('link', { name: /Try Interactive Docs/ });
    await expect(interactiveLink).toHaveAttribute('href', /\/api\/docs/);

    // Check OpenAPI Schema link
    const schemaLink = page.getByRole('link', { name: /View OpenAPI Schema/ });
    await expect(schemaLink).toHaveAttribute('href', /\/api\/openapi\.json/);
  });

  test('should display code examples section', async ({ page }) => {
    await expect(page.getByText(/Code Examples/)).toBeVisible();
    await expect(page.getByText(/Get started with these examples/)).toBeVisible();
  });

  test('should have working code tabs', async ({ page }) => {
    // Check tab buttons exist
    await expect(page.getByRole('tab', { name: 'Python' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'JavaScript' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'cURL' })).toBeVisible();

    // Default should be Python
    const pythonTab = page.getByRole('tab', { name: 'Python' });
    await expect(pythonTab).toHaveAttribute('data-state', 'active');

    // Click JavaScript tab
    await page.getByRole('tab', { name: 'JavaScript' }).click();
    await expect(page.getByText(/const response = await fetch/)).toBeVisible();

    // Click cURL tab
    await page.getByRole('tab', { name: 'cURL' }).click();
    await expect(page.getByText(/curl http:\/\/localhost:8000/)).toBeVisible();
  });

  test('should have copy buttons for code examples', async ({ page }) => {
    // Find copy buttons - there should be 3 (one for each code example)
    const copyButtons = page.getByRole('button', { name: /Copy/i });
    const count = await copyButtons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should test copy button functionality', async ({ page }) => {
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click first copy button
    const firstCopyButton = page.getByRole('button', { name: /Copy/i }).first();
    await firstCopyButton.click();

    // Verify button text changes to "Copied!"
    await expect(firstCopyButton).toContainText(/Copied/i);

    // Wait for timeout and verify it changes back
    await page.waitForTimeout(2500);
    await expect(firstCopyButton).toContainText(/Copy/i);
  });

  test('should display API endpoints reference', async ({ page }) => {
    await expect(page.getByText(/API Endpoint Reference/)).toBeVisible();

    // Check for key endpoints
    await expect(page.getByText(/\/api\/v1\/stocks\/{symbol}\/price/)).toBeVisible();
    await expect(page.getByText(/\/api\/v1\/stocks\/{symbol}\/technical/)).toBeVisible();
    await expect(page.getByText(/\/api\/v1\/stocks\/{symbol}\/lstm/)).toBeVisible();
    await expect(page.getByText(/\/api\/v1\/sentiment\/{symbol}/)).toBeVisible();
  });

  test('should display endpoint descriptions', async ({ page }) => {
    // Check for endpoint descriptions
    await expect(page.getByText(/Get current stock price and basic information/)).toBeVisible();
    await expect(page.getByText(/Get technical analysis with 15\+ indicators/)).toBeVisible();
    await expect(page.getByText(/Get AI-powered price predictions using LSTM models/)).toBeVisible();
    await expect(page.getByText(/Get sentiment analysis from news and social media/)).toBeVisible();
  });

  test('should display GET method badges', async ({ page }) => {
    // All endpoints should have GET method badges
    const getBadges = page.getByText('GET', { exact: true });
    const count = await getBadges.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('should display features section', async ({ page }) => {
    await expect(page.getByText(/Key Features/)).toBeVisible();

    // Check for feature cards
    await expect(page.getByText(/Real-time Market Data/)).toBeVisible();
    await expect(page.getByText(/AI-Powered Predictions/)).toBeVisible();
    await expect(page.getByText(/Technical Analysis/)).toBeVisible();
    await expect(page.getByText(/Sentiment Analysis/)).toBeVisible();
  });

  test('should display resources section', async ({ page }) => {
    await expect(page.getByText(/Resources/)).toBeVisible();

    // Check for resource links
    await expect(page.getByRole('link', { name: /Interactive API Docs/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /OpenAPI Specification/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Health Check/ })).toBeVisible();
  });

  test('should have correct resource link URLs', async ({ page }) => {
    // Interactive docs
    const interactiveLink = page.getByRole('link', { name: /Interactive API Docs/ });
    await expect(interactiveLink).toHaveAttribute('href', /\/api\/docs/);

    // OpenAPI spec
    const specLink = page.getByRole('link', { name: /OpenAPI Specification/ });
    await expect(specLink).toHaveAttribute('href', /\/api\/openapi\.json/);

    // Health check
    const healthLink = page.getByRole('link', { name: /Health Check/ });
    await expect(healthLink).toHaveAttribute('href', /\/api\/health/);
  });

  test('should verify Python code example content', async ({ page }) => {
    // Ensure we're on Python tab
    await page.getByRole('tab', { name: 'Python' }).click();

    // Check for Python-specific code patterns
    await expect(page.getByText(/import requests/)).toBeVisible();
    await expect(page.getByText(/requests\.get/)).toBeVisible();
    await expect(page.getByText(/response\.json\(\)/)).toBeVisible();
  });

  test('should verify JavaScript code example content', async ({ page }) => {
    await page.getByRole('tab', { name: 'JavaScript' }).click();

    // Check for JavaScript-specific code patterns
    await expect(page.getByText(/const response = await fetch/)).toBeVisible();
    await expect(page.getByText(/await response\.json\(\)/)).toBeVisible();
  });

  test('should verify cURL code example content', async ({ page }) => {
    await page.getByRole('tab', { name: 'cURL' }).click();

    // Check for cURL-specific code patterns
    await expect(page.getByText(/curl/)).toBeVisible();
    await expect(page.getByText(/http:\/\/localhost:8000/)).toBeVisible();
  });

  test('should be responsive and mobile-friendly', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Main heading should still be visible
    await expect(page.getByRole('heading', { name: /TurtleTrading API Documentation/ })).toBeVisible();

    // Tabs should still be functional
    await expect(page.getByRole('tab', { name: 'Python' })).toBeVisible();
  });
});
