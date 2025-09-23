/**
 * Mobile Authentication Flow E2E Tests
 * Tests biometric authentication, form validation, and mobile keyboard handling
 */

import { test, expect, devices, type Page } from '@playwright/test';

// Test across multiple mobile devices
const mobileDevices = [
  { name: 'iPhone 14 Pro', device: devices['iPhone 14 Pro'] },
  { name: 'iPhone 13', device: devices['iPhone 13'] },
  { name: 'Samsung Galaxy S23', device: devices['Galaxy S9+'] },
  { name: 'Google Pixel 7', device: devices['Pixel 5'] }
];

mobileDevices.forEach(({ name, device }) => {
  test.describe(`Mobile Authentication - ${name}`, () => {
    test.use(device);

    test.beforeEach(async ({ page }) => {
      // Mock biometric authentication API
      await page.addInitScript(() => {
        // Mock WebAuthn API for biometric testing
        Object.defineProperty(navigator, 'credentials', {
          value: {
            create: async (options: any) => ({
              id: 'mock-credential-id',
              type: 'public-key',
              rawId: new ArrayBuffer(32),
              response: {
                clientDataJSON: new ArrayBuffer(128),
                attestationObject: new ArrayBuffer(256)
              }
            }),
            get: async (options: any) => ({
              id: 'mock-credential-id',
              type: 'public-key',
              rawId: new ArrayBuffer(32),
              response: {
                clientDataJSON: new ArrayBuffer(128),
                authenticatorData: new ArrayBuffer(256),
                signature: new ArrayBuffer(64)
              }
            })
          },
          writable: true
        });

        // Mock FaceID/TouchID availability
        Object.defineProperty(window, 'PublicKeyCredential', {
          value: {
            isUserVerifyingPlatformAuthenticatorAvailable: async () => true
          },
          writable: true
        });
      });
    });

    test('should display mobile authentication form', async ({ page }) => {
      await page.goto('/auth');

      // Should show mobile-optimized login form
      await expect(page.locator('[data-testid="mobile-auth-container"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-login-form"]')).toBeVisible();

      // Should have biometric login option
      await expect(page.locator('[data-testid="biometric-login-btn"]')).toBeVisible();

      // Should have proper mobile form styling
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveCSS('font-size', /16px|1rem/); // Prevent zoom on iOS

      // Should have touch-friendly buttons
      const loginButton = page.locator('[data-testid="login-submit-btn"]');
      const buttonHeight = await loginButton.evaluate(el => window.getComputedStyle(el).height);
      expect(parseInt(buttonHeight)).toBeGreaterThanOrEqual(44); // iOS touch target
    });

    test('should handle successful biometric authentication', async ({ page }) => {
      await page.goto('/auth');

      // Click biometric login
      await page.click('[data-testid="biometric-login-btn"]');

      // Should show biometric prompt
      await expect(page.locator('[data-testid="biometric-prompt"]')).toBeVisible();

      // Wait for biometric authentication
      await page.waitForTimeout(2000);

      // Should redirect to dashboard after success
      await expect(page).toHaveURL(/.*dashboard/);
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    });

    test('should handle form validation with mobile keyboard', async ({ page }) => {
      await page.goto('/auth');

      // Test email validation
      const emailInput = page.locator('input[type="email"]');
      await emailInput.click();
      await emailInput.fill('invalid-email');

      // Should show validation error
      await page.click('[data-testid="login-submit-btn"]');
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();

      // Test password validation
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.click();
      await passwordInput.fill('123'); // Too short

      await page.click('[data-testid="login-submit-btn"]');
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    });

    test('should handle mobile keyboard interactions', async ({ page }) => {
      await page.goto('/auth');

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      // Test email keyboard type
      await emailInput.click();
      const emailInputType = await emailInput.getAttribute('inputmode');
      expect(emailInputType).toBe('email');

      // Test password visibility toggle
      await passwordInput.fill('testpassword');

      const toggleButton = page.locator('[data-testid="password-toggle"]');
      await toggleButton.click();

      const passwordType = await passwordInput.getAttribute('type');
      expect(passwordType).toBe('text');

      await toggleButton.click();
      const hiddenType = await passwordInput.getAttribute('type');
      expect(hiddenType).toBe('password');
    });

    test('should handle registration flow on mobile', async ({ page }) => {
      await page.goto('/auth');

      // Switch to registration
      await page.click('[data-testid="switch-to-register"]');
      await expect(page.locator('[data-testid="mobile-register-form"]')).toBeVisible();

      // Fill registration form
      await page.fill('input[name="firstName"]', 'John');
      await page.fill('input[name="lastName"]', 'Doe');
      await page.fill('input[name="email"]', 'john.doe@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.fill('input[name="confirmPassword"]', 'SecurePass123!');

      // Should show password strength indicator
      await expect(page.locator('[data-testid="password-strength"]')).toBeVisible();

      // Accept terms
      await page.click('input[name="acceptTerms"]');

      // Submit registration
      await page.click('[data-testid="register-submit-btn"]');

      // Should show success state
      await expect(page.locator('[data-testid="registration-success"]')).toBeVisible();
    });

    test('should handle biometric enrollment', async ({ page }) => {
      await page.goto('/auth');

      // Login first
      await page.fill('input[type="email"]', 'demo@turtletrading.com');
      await page.fill('input[type="password"]', 'demo123');
      await page.click('[data-testid="login-submit-btn"]');

      await page.waitForURL(/.*dashboard/);

      // Go to settings
      await page.goto('/settings');

      // Should show biometric setup option
      await expect(page.locator('[data-testid="biometric-setup"]')).toBeVisible();

      // Click setup biometric
      await page.click('[data-testid="setup-biometric-btn"]');

      // Should show enrollment flow
      await expect(page.locator('[data-testid="biometric-enrollment"]')).toBeVisible();

      // Complete enrollment
      await page.click('[data-testid="complete-enrollment-btn"]');

      // Should show success
      await expect(page.locator('[data-testid="biometric-enabled"]')).toBeVisible();
    });

    test('should handle logout on mobile', async ({ page }) => {
      await page.goto('/auth');

      // Login
      await page.fill('input[type="email"]', 'demo@turtletrading.com');
      await page.fill('input[type="password"]', 'demo123');
      await page.click('[data-testid="login-submit-btn"]');

      await page.waitForURL(/.*dashboard/);

      // Open mobile menu
      await page.click('[data-testid="mobile-menu-trigger"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

      // Click logout
      await page.click('[data-testid="logout-btn"]');

      // Should redirect to auth page
      await expect(page).toHaveURL(/.*auth/);
      await expect(page.locator('[data-testid="mobile-login-form"]')).toBeVisible();
    });

    test('should handle session persistence', async ({ page }) => {
      await page.goto('/auth');

      // Login with remember me
      await page.fill('input[type="email"]', 'demo@turtletrading.com');
      await page.fill('input[type="password"]', 'demo123');
      await page.click('input[name="rememberMe"]');
      await page.click('[data-testid="login-submit-btn"]');

      await page.waitForURL(/.*dashboard/);

      // Refresh page
      await page.reload();

      // Should remain logged in
      await expect(page).toHaveURL(/.*dashboard/);
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    });

    test('should handle authentication errors gracefully', async ({ page }) => {
      await page.goto('/auth');

      // Mock network error
      await page.route('/api/v1/auth/token', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      await page.fill('input[type="email"]', 'demo@turtletrading.com');
      await page.fill('input[type="password"]', 'demo123');
      await page.click('[data-testid="login-submit-btn"]');

      // Should show error message
      await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="auth-error"]')).toContainText(/error/i);

      // Should allow retry
      await expect(page.locator('[data-testid="retry-auth-btn"]')).toBeVisible();
    });

    test('should handle offline authentication state', async ({ page, context }) => {
      await page.goto('/auth');

      // Login first
      await page.fill('input[type="email"]', 'demo@turtletrading.com');
      await page.fill('input[type="password"]', 'demo123');
      await page.click('[data-testid="login-submit-btn"]');

      await page.waitForURL(/.*dashboard/);

      // Go offline
      await context.setOffline(true);

      // Navigate to different page
      await page.goto('/market');

      // Should show offline indicator but maintain auth state
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    });
  });
});

test.describe('Mobile Authentication Accessibility', () => {
  test.use(devices['iPhone 14 Pro']);

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/auth');

    // Test tab navigation
    await page.keyboard.press('Tab');
    let focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focused).toBe('email-input');

    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focused).toBe('password-input');

    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focused).toBe('login-submit-btn');
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/auth');

    // Check form accessibility
    const form = page.locator('[data-testid="mobile-login-form"]');
    await expect(form).toHaveAttribute('role', 'form');

    // Check input labels
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('aria-label');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('aria-label');

    // Check button accessibility
    const loginButton = page.locator('[data-testid="login-submit-btn"]');
    await expect(loginButton).toHaveAttribute('aria-label');
  });

  test('should support screen readers', async ({ page }) => {
    await page.goto('/auth');

    // Check for screen reader announcements
    const errorMessage = page.locator('[data-testid="auth-error"]');
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    }

    // Check form validation announcements
    await page.click('[data-testid="login-submit-btn"]');

    const emailError = page.locator('[data-testid="email-error"]');
    if (await emailError.isVisible()) {
      await expect(emailError).toHaveAttribute('role', 'alert');
    }
  });

  test('should handle reduced motion preferences', async ({ page }) => {
    // Mock reduced motion preference
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          addListener: jest.fn(),
          removeListener: jest.fn()
        }))
      });
    });

    await page.goto('/auth');

    // Animations should be reduced or disabled
    const authContainer = page.locator('[data-testid="mobile-auth-container"]');
    const animationDuration = await authContainer.evaluate(el =>
      window.getComputedStyle(el).animationDuration
    );

    // Should be instant or very fast animations
    expect(['0s', '0.01s']).toContain(animationDuration);
  });
});