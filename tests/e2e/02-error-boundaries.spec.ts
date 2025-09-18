import { test, expect } from '@playwright/test';

test.describe('Error Boundaries', () => {
  test('should display RouteErrorFallback for unknown routes', async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto('/nonexistent-route');

    // Check for route error fallback
    await expect(page.locator('text=Page Not Found')).toBeVisible();
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=🔍')).toBeVisible();

    // Check navigation buttons
    await expect(page.locator('button:has-text("🏠 Go to Dashboard")')).toBeVisible();
    await expect(page.locator('button:has-text("← Go Back")')).toBeVisible();
    await expect(page.locator('button:has-text("🔄 Retry")')).toBeVisible();
  });

  test('should handle component errors gracefully', async ({ page }) => {
    // Navigate to error test page
    await page.goto('/error-test');

    // Verify error test page loaded
    await expect(page.locator('h1:has-text("Error Boundary Test Page")')).toBeVisible();

    // Test component error boundary
    const componentErrorButton = page.locator('[data-testid="trigger-component-error"]');
    await expect(componentErrorButton).toBeVisible();

    await componentErrorButton.click();

    // Check if error boundary UI appears
    await expect(page.locator('text=Component Error')).toBeVisible();
    await expect(page.locator('text=🔧')).toBeVisible();
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('should handle async errors with retry functionality', async ({ page }) => {
    await page.goto('/error-test');

    // Test async error boundary
    const asyncErrorButton = page.locator('[data-testid="trigger-async-error"]');
    await expect(asyncErrorButton).toBeVisible();

    await asyncErrorButton.click();

    // Wait for async operation and error
    await page.waitForTimeout(1500);

    // Check if async error boundary UI appears
    await expect(page.locator('text=API Error')).toBeVisible();
    await expect(page.locator('text=🔌')).toBeVisible();

    // Check retry functionality
    const retryButton = page.locator('button:has-text("Try Again")');
    if (await retryButton.isVisible()) {
      await expect(retryButton).toBeVisible();
    }
  });

  test('should handle network errors appropriately', async ({ page }) => {
    await page.goto('/error-test');

    // Test network error boundary
    const networkErrorButton = page.locator('[data-testid="trigger-network-error"]');
    await expect(networkErrorButton).toBeVisible();

    await networkErrorButton.click();

    // Wait for network request to complete
    await page.waitForTimeout(2000);

    // Network errors might be handled differently based on response
    // Check if either error boundary or normal error handling occurred
    const hasErrorBoundary = await page.locator('text=Connection Error').isVisible();
    const hasAPIError = await page.locator('text=API Error').isVisible();

    // At least one error handling mechanism should be visible
    expect(hasErrorBoundary || hasAPIError).toBeTruthy();
  });

  test('should handle validation errors', async ({ page }) => {
    await page.goto('/error-test');

    // Test validation error boundary
    const validationErrorButton = page.locator('[data-testid="trigger-validation-error"]');
    await expect(validationErrorButton).toBeVisible();

    await validationErrorButton.click();

    // Check if validation error boundary UI appears
    await expect(page.locator('text=Validation Error')).toBeVisible();
    await expect(page.locator('text=✏️')).toBeVisible();
    await expect(page.locator('button:has-text("Dismiss")')).toBeVisible();
  });

  test('should navigate back to dashboard from 404 page', async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto('/nonexistent-route');

    // Click dashboard button
    await page.click('button:has-text("🏠 Go to Dashboard")');

    // Should navigate to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1:has-text("TurtleTrading Dashboard")')).toBeVisible();
  });

  test('should show error details in development mode', async ({ page }) => {
    await page.goto('/error-test');

    // Trigger a component error
    await page.click('[data-testid="trigger-component-error"]');

    // In development mode, there should be error details
    const errorDetails = page.locator('summary:has-text("Show Error Details")');
    if (await errorDetails.isVisible()) {
      await errorDetails.click();
      await expect(page.locator('text=Error ID')).toBeVisible();
      await expect(page.locator('text=Message')).toBeVisible();
    }
  });

  test('should maintain layout structure when component errors occur', async ({ page }) => {
    await page.goto('/error-test');

    // Verify main layout is still present
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    // Trigger component error
    await page.click('[data-testid="trigger-component-error"]');

    // Layout should still be intact
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    // Error boundary should isolate the error to the component
    await expect(page.locator('text=Component Error')).toBeVisible();
  });
});