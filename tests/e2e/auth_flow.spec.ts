/**
 * E2E Authentication Flow Tests
 * Implements comprehensive authentication scenarios from docs/claude/tests/specs/authentication/jwt_security_tests.md
 * Tests login, logout, token refresh, rate limiting, and security measures
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

// Test users
const TEST_USERS = {
  valid: {
    email: 'test@example.com',
    password: 'ValidPassword123!',
    name: 'Test User'
  },
  admin: {
    email: 'admin@example.com',
    password: 'AdminPassword123!',
    name: 'Admin User'
  },
  invalid: {
    email: 'invalid@example.com',
    password: 'WrongPassword'
  }
};

test.describe('Authentication Flow - JWT Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.context().clearCookies();
    await page.goto(BASE_URL);
  });

  test.describe('Login Flow Tests', () => {
    test('should display login form with accessibility compliance', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Check form accessibility
      await expect(page.locator('form[role="form"]')).toBeVisible();
      await expect(page.locator('input[aria-label="Email"]')).toBeVisible();
      await expect(page.locator('input[aria-label="Password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"][aria-label="Sign In"]')).toBeVisible();

      // Test keyboard navigation
      await page.keyboard.press('Tab'); // Focus email field
      await expect(page.locator('input[type="email"]')).toBeFocused();

      await page.keyboard.press('Tab'); // Focus password field
      await expect(page.locator('input[type="password"]')).toBeFocused();

      await page.keyboard.press('Tab'); // Focus submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused();
    });

    test('should successfully login with valid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Fill login form
      await page.fill('input[type="email"]', TEST_USERS.valid.email);
      await page.fill('input[type="password"]', TEST_USERS.valid.password);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });

      // Verify successful login
      await expect(page.locator('[data-testid="user-profile"]')).toContainText(TEST_USERS.valid.name);
      await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();

      // Verify authentication token is stored
      const tokenExists = await page.evaluate(() => {
        return localStorage.getItem('access_token') !== null;
      });
      expect(tokenExists).toBe(true);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Fill with invalid credentials
      await page.fill('input[type="email"]', TEST_USERS.invalid.email);
      await page.fill('input[type="password"]', TEST_USERS.invalid.password);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');

      // Verify still on login page
      await expect(page).toHaveURL(`${BASE_URL}/login`);

      // Verify no token stored
      const tokenExists = await page.evaluate(() => {
        return localStorage.getItem('access_token') !== null;
      });
      expect(tokenExists).toBe(false);
    });

    test('should validate empty form submission', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Submit empty form
      await page.click('button[type="submit"]');

      // Check for validation errors
      await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
      await expect(page.locator('[data-testid="password-error"]')).toContainText('Password is required');

      // Verify still on login page
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    });

    test('should enforce rate limiting after multiple failed attempts', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Attempt login 5 times with invalid credentials
      for (let i = 0; i < 5; i++) {
        await page.fill('input[type="email"]', TEST_USERS.invalid.email);
        await page.fill('input[type="password"]', TEST_USERS.invalid.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000); // Wait between attempts
      }

      // 6th attempt should be rate limited
      await page.fill('input[type="email"]', TEST_USERS.invalid.email);
      await page.fill('input[type="password"]', TEST_USERS.invalid.password);
      await page.click('button[type="submit"]');

      // Check for rate limiting message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Too many attempts');
    });
  });

  test.describe('Protected Routes Tests', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access protected dashboard
      await page.goto(`${BASE_URL}/dashboard`);

      // Should redirect to login
      await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should allow authenticated users to access protected routes', async ({ page }) => {
      // Login first
      await loginUser(page, TEST_USERS.valid);

      // Navigate to protected routes
      await page.goto(`${BASE_URL}/stock/AAPL`);
      await expect(page.locator('[data-testid="stock-analysis"]')).toBeVisible();

      await page.goto(`${BASE_URL}/portfolio`);
      await expect(page.locator('[data-testid="portfolio-view"]')).toBeVisible();
    });

    test('should handle expired tokens gracefully', async ({ page }) => {
      // Set expired token
      await page.evaluate(() => {
        localStorage.setItem('access_token', 'expired.jwt.token');
        localStorage.setItem('refresh_token', 'expired.refresh.token');
      });

      // Try to access protected route
      await page.goto(`${BASE_URL}/dashboard`);

      // Should redirect to login due to expired token
      await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
      await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    });
  });

  test.describe('Logout Flow Tests', () => {
    test('should successfully logout and clear session', async ({ page }) => {
      // Login first
      await loginUser(page, TEST_USERS.valid);

      // Click logout button
      await page.click('[data-testid="logout-button"]');

      // Wait for redirect to home/login
      await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });

      // Verify tokens are cleared
      const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
      const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));

      expect(accessToken).toBeNull();
      expect(refreshToken).toBeNull();

      // Verify can't access protected routes
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    });

    test('should handle logout across multiple tabs', async ({ context }) => {
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      // Login in first tab
      await loginUser(page1, TEST_USERS.valid);

      // Navigate to dashboard in second tab
      await page2.goto(`${BASE_URL}/dashboard`);
      await expect(page2.locator('[data-testid="user-profile"]')).toBeVisible();

      // Logout from first tab
      await page1.click('[data-testid="logout-button"]');

      // Verify second tab is also logged out
      await page2.reload();
      await page2.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    });
  });

  test.describe('Session Management Tests', () => {
    test('should maintain authentication across page refreshes', async ({ page }) => {
      // Login
      await loginUser(page, TEST_USERS.valid);

      // Refresh page
      await page.reload();

      // Verify still authenticated
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    });

    test('should auto-refresh tokens before expiration', async ({ page }) => {
      // Mock short-lived tokens for testing
      await page.route('**/api/v1/auth/token', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            access_token: 'mock.access.token',
            refresh_token: 'mock.refresh.token',
            expires_in: 5 // 5 seconds for testing
          })
        });
      });

      await loginUser(page, TEST_USERS.valid);

      // Wait for token refresh (should happen automatically)
      await page.waitForTimeout(6000);

      // Verify still authenticated and can make API calls
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    });
  });

  test.describe('API Integration Tests', () => {
    test('should send proper authentication headers', async ({ page }) => {
      let authHeader: string | null = null;

      // Intercept API calls to check headers
      await page.route('**/api/v1/**', (route) => {
        authHeader = route.request().headers()['authorization'];
        route.continue();
      });

      // Login and make authenticated request
      await loginUser(page, TEST_USERS.valid);

      // Trigger an API call
      await page.goto(`${BASE_URL}/dashboard`);

      // Verify authentication header is present and properly formatted
      expect(authHeader).toMatch(/^Bearer [A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
    });

    test('should handle API authentication errors', async ({ page }) => {
      // Mock 401 response
      await page.route('**/api/v1/**', (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      });

      await loginUser(page, TEST_USERS.valid);

      // Try to access a page that makes API calls
      await page.goto(`${BASE_URL}/dashboard`);

      // Should redirect to login
      await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    });
  });

  test.describe('Security Tests', () => {
    test('should prevent XSS in login form', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      const xssPayload = '<script>alert("xss")</script>';

      // Try XSS in email field
      await page.fill('input[type="email"]', xssPayload);
      await page.fill('input[type="password"]', 'password');
      await page.click('button[type="submit"]');

      // Verify script doesn't execute (no alert dialog)
      const dialogs: string[] = [];
      page.on('dialog', (dialog) => {
        dialogs.push(dialog.message());
        dialog.accept();
      });

      await page.waitForTimeout(1000);
      expect(dialogs).toHaveLength(0);
    });

    test('should handle SQL injection attempts safely', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // SQL injection payload
      const sqlPayload = "admin@test.com'; DROP TABLE users; --";

      await page.fill('input[type="email"]', sqlPayload);
      await page.fill('input[type="password"]', 'password');
      await page.click('button[type="submit"]');

      // Should get invalid credentials error, not SQL error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should meet WCAG AA standards for authentication forms', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Check color contrast (simplified check)
      const button = page.locator('button[type="submit"]');
      const buttonStyles = await button.evaluate((el) => getComputedStyle(el));

      // Verify button has sufficient contrast (this is a basic check)
      expect(buttonStyles.backgroundColor).not.toBe('transparent');
      expect(buttonStyles.color).not.toBe('transparent');

      // Check ARIA labels
      await expect(page.locator('input[aria-label="Email"]')).toBeVisible();
      await expect(page.locator('input[aria-label="Password"]')).toBeVisible();

      // Check form has proper role
      await expect(page.locator('form[role="form"]')).toBeVisible();
    });

    test('should support screen reader navigation', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Check that form elements have proper labels
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      await expect(emailInput).toHaveAttribute('aria-label');
      await expect(passwordInput).toHaveAttribute('aria-label');

      // Check for proper heading structure
      await expect(page.locator('h1')).toBeVisible();
    });
  });
});

// Helper function to login a user
async function loginUser(page: Page, user: typeof TEST_USERS.valid) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
}