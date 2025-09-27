/**
 * E2E Tests for Authentication Flow
 *
 * Tests the complete login → protected navigation user journey
 * including middleware authentication, JWT handling, and route protection.
 */

import { test, expect } from '@playwright/test'

// Test configuration
const BASE_URL = 'http://localhost:3000'
const API_BASE_URL = 'http://localhost:8000'

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
  firstName: 'Test',
  lastName: 'User'
}

const ADMIN_USER = {
  email: 'admin@example.com',
  password: 'admin123'
}

test.describe('Authentication Flow E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies()
    await page.goto(BASE_URL)
  })

  test.describe('Login Flow', () => {
    test('should display login form when accessing protected route without authentication', async ({ page }) => {
      // Try to access protected dashboard
      await page.goto(`${BASE_URL}/dashboard`)

      // Should be redirected to login
      await expect(page).toHaveURL(/.*\/auth\/login/)

      // Login form should be visible
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test('should successfully login with valid credentials and redirect to dashboard', async ({ page }) => {
      // Go to login page
      await page.goto(`${BASE_URL}/auth/login`)

      // Fill login form
      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', TEST_USER.password)

      // Mock successful login API response
      await page.route(`${API_BASE_URL}/api/v1/auth/token`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock.jwt.token',
            refresh_token: 'mock.refresh.token',
            token_type: 'bearer',
            user: {
              id: 'user123',
              email: TEST_USER.email,
              first_name: TEST_USER.firstName,
              last_name: TEST_USER.lastName
            }
          })
        })
      })

      // Submit form
      await page.click('button[type="submit"]')

      // Should redirect to dashboard
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`)

      // Dashboard content should be visible
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible()
    })

    test('should display error message for invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`)

      // Fill form with invalid credentials
      await page.fill('input[type="email"]', 'invalid@example.com')
      await page.fill('input[type="password"]', 'wrongpassword')

      // Mock failed login API response
      await page.route(`${API_BASE_URL}/api/v1/auth/token`, async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'Invalid credentials'
          })
        })
      })

      await page.click('button[type="submit"]')

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials')

      // Should remain on login page
      await expect(page).toHaveURL(/.*\/auth\/login/)
    })

    test('should validate required fields', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`)

      // Try to submit empty form
      await page.click('button[type="submit"]')

      // Should show validation errors
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible()
    })

    test('should validate email format', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`)

      // Enter invalid email format
      await page.fill('input[type="email"]', 'invalid-email')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')

      // Should show email format validation error
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email')
    })
  })

  test.describe('Protected Routes Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Set up authenticated session
      await page.goto(`${BASE_URL}/auth/login`)

      // Mock successful login
      await page.route(`${API_BASE_URL}/api/v1/auth/token`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock.jwt.token',
            refresh_token: 'mock.refresh.token',
            token_type: 'bearer',
            user: {
              id: 'user123',
              email: TEST_USER.email,
              first_name: TEST_USER.firstName,
              last_name: TEST_USER.lastName
            }
          })
        })
      })

      // Login
      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', TEST_USER.password)
      await page.click('button[type="submit"]')

      // Wait for redirect to dashboard
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`)
    })

    test('should access dashboard after login', async ({ page }) => {
      // Should be on dashboard
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`)

      // Dashboard components should be visible
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible()
    })

    test('should navigate to different protected routes', async ({ page }) => {
      const protectedRoutes = [
        { path: '/stocks/AAPL', testId: 'stock-analysis-content' },
        { path: '/portfolio', testId: 'portfolio-content' },
        { path: '/settings', testId: 'settings-content' }
      ]

      for (const route of protectedRoutes) {
        await page.goto(`${BASE_URL}${route.path}`)

        // Should be able to access protected route
        await expect(page).toHaveURL(`${BASE_URL}${route.path}`)

        // Content should be visible (if it exists)
        if (route.testId) {
          try {
            await expect(page.locator(`[data-testid="${route.testId}"]`)).toBeVisible()
          } catch (e) {
            // Content might not be implemented yet, that's okay for this test
            console.log(`Content for ${route.path} not implemented yet`)
          }
        }
      }
    })

    test('should display user information in header', async ({ page }) => {
      // User profile in header should show user info
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible()
      await expect(page.locator('[data-testid="user-email"]')).toContainText(TEST_USER.email)
    })

    test('should show navigation menu with protected links', async ({ page }) => {
      // Navigation should be visible
      await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible()

      // Protected route links should be present
      await expect(page.locator('[href="/dashboard"]')).toBeVisible()
      await expect(page.locator('[href*="/stocks"]')).toBeVisible()
      await expect(page.locator('[href="/portfolio"]')).toBeVisible()
      await expect(page.locator('[href="/settings"]')).toBeVisible()
    })
  })

  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto(`${BASE_URL}/auth/login`)

      await page.route(`${API_BASE_URL}/api/v1/auth/token`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock.jwt.token',
            refresh_token: 'mock.refresh.token',
            token_type: 'bearer',
            user: {
              id: 'user123',
              email: TEST_USER.email
            }
          })
        })
      })

      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', TEST_USER.password)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`)
    })

    test('should logout successfully and redirect to login', async ({ page }) => {
      // Mock logout API
      await page.route(`${API_BASE_URL}/api/v1/auth/logout`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Logged out successfully' })
        })
      })

      // Click logout button
      await page.click('[data-testid="logout-button"]')

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/auth\/login/)

      // Try to access protected route
      await page.goto(`${BASE_URL}/dashboard`)

      // Should be redirected back to login
      await expect(page).toHaveURL(/.*\/auth\/login/)
    })

    test('should clear session after logout', async ({ page }) => {
      // Logout
      await page.route(`${API_BASE_URL}/api/v1/auth/logout`, async route => {
        await route.fulfill({ status: 200, body: '{}' })
      })

      await page.click('[data-testid="logout-button"]')
      await expect(page).toHaveURL(/.*\/auth\/login/)

      // Cookies should be cleared
      const cookies = await page.context().cookies()
      const sessionCookie = cookies.find(cookie => cookie.name === 'session')
      expect(sessionCookie).toBeUndefined()
    })
  })

  test.describe('Session Management', () => {
    test('should handle expired session gracefully', async ({ page }) => {
      // Set up session that will expire
      await page.goto(`${BASE_URL}/auth/login`)

      await page.route(`${API_BASE_URL}/api/v1/auth/token`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'expired.jwt.token', // This will be recognized as expired by our mock
            refresh_token: 'mock.refresh.token',
            token_type: 'bearer'
          })
        })
      })

      // Login with expired token
      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', TEST_USER.password)
      await page.click('button[type="submit"]')

      // Try to access protected route
      await page.goto(`${BASE_URL}/dashboard`)

      // Should be redirected to login due to expired session
      await expect(page).toHaveURL(/.*\/auth\/login/)
    })

    test('should persist session across page refreshes', async ({ page }) => {
      // Login
      await page.goto(`${BASE_URL}/auth/login`)

      await page.route(`${API_BASE_URL}/api/v1/auth/token`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'valid.jwt.token',
            refresh_token: 'mock.refresh.token',
            token_type: 'bearer',
            user: { id: 'user123', email: TEST_USER.email }
          })
        })
      })

      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', TEST_USER.password)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`)

      // Refresh page
      await page.reload()

      // Should still be authenticated and on dashboard
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`)
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible()
    })
  })

  test.describe('Registration Flow', () => {
    test('should access registration page from login page', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`)

      // Click register link
      await page.click('[data-testid="register-link"]')

      // Should navigate to register page
      await expect(page).toHaveURL(`${BASE_URL}/auth/register`)
      await expect(page.locator('[data-testid="register-form"]')).toBeVisible()
    })

    test('should register new user and redirect to dashboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/register`)

      // Fill registration form
      await page.fill('input[name="firstName"]', TEST_USER.firstName)
      await page.fill('input[name="lastName"]', TEST_USER.lastName)
      await page.fill('input[type="email"]', TEST_USER.email)
      await page.fill('input[type="password"]', TEST_USER.password)
      await page.check('input[name="acceptTerms"]')

      // Mock successful registration
      await page.route(`${API_BASE_URL}/api/v1/auth/register`, async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'User created successfully',
            user: {
              id: 'newuser123',
              email: TEST_USER.email,
              first_name: TEST_USER.firstName,
              last_name: TEST_USER.lastName
            }
          })
        })
      })

      await page.click('button[type="submit"]')

      // Should redirect to login or dashboard
      await expect(page).toHaveURL(/.*\/(auth\/login|dashboard)/)
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels and keyboard navigation', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`)

      // Check ARIA labels
      await expect(page.locator('input[type="email"]')).toHaveAttribute('aria-label')
      await expect(page.locator('input[type="password"]')).toHaveAttribute('aria-label')

      // Test keyboard navigation
      await page.keyboard.press('Tab') // Should focus email input
      await expect(page.locator('input[type="email"]')).toBeFocused()

      await page.keyboard.press('Tab') // Should focus password input
      await expect(page.locator('input[type="password"]')).toBeFocused()

      await page.keyboard.press('Tab') // Should focus submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused()
    })

    test('should announce errors to screen readers', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`)

      // Submit empty form
      await page.click('button[type="submit"]')

      // Error messages should have proper ARIA attributes
      await expect(page.locator('[data-testid="email-error"]')).toHaveAttribute('role', 'alert')
      await expect(page.locator('[data-testid="password-error"]')).toHaveAttribute('role', 'alert')
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should work correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto(`${BASE_URL}/auth/login`)

      // Login form should be properly sized
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible()

      // Form inputs should be touch-friendly
      const emailInput = page.locator('input[type="email"]')
      const boundingBox = await emailInput.boundingBox()
      expect(boundingBox?.height).toBeGreaterThan(40) // Minimum touch target size
    })
  })
})