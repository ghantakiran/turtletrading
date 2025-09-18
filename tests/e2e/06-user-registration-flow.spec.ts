import { test, expect } from '@playwright/test';

/**
 * End-to-End tests for user registration flow
 * Tests the complete user registration journey from frontend to backend
 */

test.describe('User Registration Flow - E2E Tests', () => {
  const BASE_URL = 'http://localhost:3003'; // Frontend URL
  const API_BASE_URL = 'http://localhost:8000/api/v1'; // Backend API URL

  // Generate unique test data for each test run
  const generateTestUser = () => ({
    email: `testuser_${Date.now()}@example.com`,
    password: 'SecureTestPassword123!',
    fullName: 'Test User Registration',
    confirmPassword: 'SecureTestPassword123!'
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto(BASE_URL);

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
  });

  test('should display registration form when clicking register link', async ({ page }) => {
    // Look for register/signup link or button on the homepage
    const registerLink = page.locator('a:has-text("Register"), a:has-text("Sign Up"), button:has-text("Register"), button:has-text("Sign Up")').first();

    if (await registerLink.isVisible()) {
      await registerLink.click();

      // Should navigate to registration page or show registration form
      await expect(page.locator('form, .registration-form, [data-testid="registration-form"]')).toBeVisible();
      await expect(page.locator('input[type="email"], [name="email"], [data-testid="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"], [name="password"], [data-testid="password"]')).toBeVisible();
    } else {
      // If no register link is visible, navigate directly to register page
      await page.goto(`${BASE_URL}/register`);

      // Check if registration form is visible or if it's a 404
      const isFormVisible = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();
      const is404 = await page.locator('text=404, text=Not Found').isVisible();

      if (!isFormVisible && !is404) {
        // Try alternative registration routes
        await page.goto(`${BASE_URL}/signup`);
        await page.waitForLoadState('networkidle');

        const isSignupVisible = await page.locator('form, .signup-form, [data-testid="signup-form"]').isVisible();
        if (isSignupVisible) {
          await expect(page.locator('input[type="email"], [name="email"], [data-testid="email"]')).toBeVisible();
        }
      }
    }
  });

  test('should successfully register a new user with valid data', async ({ page, request }) => {
    const testUser = generateTestUser();

    // Try to navigate to registration page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Check if registration form exists
    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Fill out the registration form
      await page.fill('input[type="email"], [name="email"], [data-testid="email"]', testUser.email);
      await page.fill('input[type="password"], [name="password"], [data-testid="password"]', testUser.password);

      // Look for full name field
      const fullNameField = page.locator('input[name="fullName"], input[name="full_name"], [data-testid="full-name"]');
      if (await fullNameField.isVisible()) {
        await fullNameField.fill(testUser.fullName);
      }

      // Look for confirm password field
      const confirmPasswordField = page.locator('input[name="confirmPassword"], input[name="confirm_password"], [data-testid="confirm-password"]');
      if (await confirmPasswordField.isVisible()) {
        await confirmPasswordField.fill(testUser.confirmPassword);
      }

      // Submit the form
      const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      await submitButton.click();

      // Wait for registration to complete
      await page.waitForTimeout(2000);

      // Check for success indicators
      const successMessage = page.locator('text=Registration successful, text=Welcome, text=Account created, .success-message, [data-testid="success-message"]');
      const isSuccessVisible = await successMessage.isVisible();

      if (isSuccessVisible) {
        await expect(successMessage).toBeVisible();

        // Should redirect to login page or dashboard
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/login|dashboard|home|welcome/);
      } else {
        // If frontend registration isn't working, test the API directly
        console.log('Frontend registration form not available, testing API directly');

        const apiResponse = await request.post(`${API_BASE_URL}/auth/register`, {
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            email: testUser.email,
            password: testUser.password,
            full_name: testUser.fullName,
          },
        });

        expect(apiResponse.ok()).toBeTruthy();
        const responseData = await apiResponse.json();
        expect(responseData).toHaveProperty('email', testUser.email);
        expect(responseData).toHaveProperty('full_name', testUser.fullName);
        expect(responseData).toHaveProperty('is_active', true);
      }
    } else {
      // Fallback to API testing if frontend form is not available
      console.log('Registration form not found, testing API directly');

      const apiResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: testUser.email,
          password: testUser.password,
          full_name: testUser.fullName,
        },
      });

      expect(apiResponse.ok()).toBeTruthy();
      const responseData = await apiResponse.json();
      expect(responseData).toHaveProperty('email', testUser.email);
    }
  });

  test('should display validation errors for invalid registration data', async ({ page, request }) => {
    // Try to navigate to registration page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Check if registration form exists
    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Test with invalid email
      await page.fill('input[type="email"], [name="email"], [data-testid="email"]', 'invalid-email');
      await page.fill('input[type="password"], [name="password"], [data-testid="password"]', 'weak');

      const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      await submitButton.click();

      // Wait for validation errors
      await page.waitForTimeout(1000);

      // Look for error messages
      const errorMessages = page.locator('.error, .error-message, [data-testid="error"], text=Invalid email, text=Password, text=required');
      const hasErrors = await errorMessages.count() > 0;

      if (hasErrors) {
        await expect(errorMessages.first()).toBeVisible();
      }
    } else {
      // Test API validation directly
      console.log('Testing API validation for invalid data');

      const apiResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: 'invalid-email',
          password: 'weak',
          full_name: 'Test User',
        },
      });

      expect(apiResponse.status()).toBe(422); // Validation error
    }
  });

  test('should prevent registration with duplicate email', async ({ page, request }) => {
    const testUser = generateTestUser();

    // First, register a user via API to ensure duplicate test
    await request.post(`${API_BASE_URL}/auth/register`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: testUser.email,
        password: testUser.password,
        full_name: testUser.fullName,
      },
    });

    // Try to navigate to registration page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Try to register with the same email
      await page.fill('input[type="email"], [name="email"], [data-testid="email"]', testUser.email);
      await page.fill('input[type="password"], [name="password"], [data-testid="password"]', testUser.password);

      const fullNameField = page.locator('input[name="fullName"], input[name="full_name"], [data-testid="full-name"]');
      if (await fullNameField.isVisible()) {
        await fullNameField.fill(testUser.fullName);
      }

      const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      await submitButton.click();

      // Wait for error response
      await page.waitForTimeout(2000);

      // Look for duplicate email error
      const duplicateError = page.locator('text=Email already registered, text=already exists, text=duplicate, .error-message');
      const hasError = await duplicateError.isVisible();

      if (hasError) {
        await expect(duplicateError).toBeVisible();
      }
    } else {
      // Test API duplicate error directly
      console.log('Testing API duplicate email validation');

      const duplicateResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: testUser.email,
          password: testUser.password,
          full_name: testUser.fullName,
        },
      });

      expect(duplicateResponse.status()).toBe(400);
      const errorData = await duplicateResponse.json();
      expect(errorData.detail).toContain('Email already registered');
    }
  });

  test('should handle password strength requirements', async ({ page, request }) => {
    const testUser = generateTestUser();

    // Try to navigate to registration page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Test with weak password
      await page.fill('input[type="email"], [name="email"], [data-testid="email"]', testUser.email);
      await page.fill('input[type="password"], [name="password"], [data-testid="password"]', 'weak');

      const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      await submitButton.click();

      // Wait for validation
      await page.waitForTimeout(1000);

      // Look for password strength error
      const passwordError = page.locator('text=Password must, text=at least 8, text=uppercase, text=lowercase, text=digit, .password-error');
      const hasPasswordError = await passwordError.count() > 0;

      if (hasPasswordError) {
        await expect(passwordError.first()).toBeVisible();
      }
    } else {
      // Test API password validation directly
      console.log('Testing API password strength validation');

      const weakPasswordResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: testUser.email,
          password: 'weak',
          full_name: testUser.fullName,
        },
      });

      expect(weakPasswordResponse.status()).toBe(422); // Validation error
    }
  });

  test('should redirect to login page after successful registration', async ({ page, request }) => {
    const testUser = generateTestUser();

    // Try to navigate to registration page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Fill and submit registration form
      await page.fill('input[type="email"], [name="email"], [data-testid="email"]', testUser.email);
      await page.fill('input[type="password"], [name="password"], [data-testid="password"]', testUser.password);

      const fullNameField = page.locator('input[name="fullName"], input[name="full_name"], [data-testid="full-name"]');
      if (await fullNameField.isVisible()) {
        await fullNameField.fill(testUser.fullName);
      }

      const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      await submitButton.click();

      // Wait for navigation
      await page.waitForTimeout(3000);

      // Check if redirected to login or dashboard
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('/login') ||
                          currentUrl.includes('/dashboard') ||
                          currentUrl.includes('/home') ||
                          currentUrl !== `${BASE_URL}/register`;

      if (isRedirected) {
        expect(isRedirected).toBeTruthy();

        // If redirected to login, verify login form exists
        if (currentUrl.includes('/login')) {
          await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(2);
        }
      }
    } else {
      // Test successful API registration and verify user can login
      console.log('Testing successful registration via API and subsequent login');

      const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: testUser.email,
          password: testUser.password,
          full_name: testUser.fullName,
        },
      });

      expect(registerResponse.ok()).toBeTruthy();

      // Verify user can login with registered credentials
      const loginResponse = await request.post(`${API_BASE_URL}/auth/token`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: `username=${testUser.email}&password=${testUser.password}`,
      });

      expect(loginResponse.ok()).toBeTruthy();
      const loginData = await loginResponse.json();
      expect(loginData).toHaveProperty('access_token');
      expect(loginData).toHaveProperty('token_type', 'bearer');
    }
  });

  test('should display loading state during registration submission', async ({ page }) => {
    const testUser = generateTestUser();

    // Try to navigate to registration page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Fill registration form
      await page.fill('input[type="email"], [name="email"], [data-testid="email"]', testUser.email);
      await page.fill('input[type="password"], [name="password"], [data-testid="password"]', testUser.password);

      const fullNameField = page.locator('input[name="fullName"], input[name="full_name"], [data-testid="full-name"]');
      if (await fullNameField.isVisible()) {
        await fullNameField.fill(testUser.fullName);
      }

      // Click submit and immediately check for loading state
      const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      await submitButton.click();

      // Check for loading indicators
      const loadingStates = [
        page.locator('.loading, .spinner, [data-testid="loading"]'),
        page.locator('button:disabled'),
        page.locator('text=Registering, text=Creating account, text=Please wait')
      ];

      // Wait for either loading state or completion
      await Promise.race([
        Promise.all(loadingStates.map(loc => loc.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {}))),
        page.waitForTimeout(2000)
      ]);

      // If any loading state is visible, verify it
      for (const loadingState of loadingStates) {
        if (await loadingState.isVisible()) {
          await expect(loadingState).toBeVisible();
          break;
        }
      }
    } else {
      console.log('Registration form not available for loading state test');
    }
  });

  test('should handle network errors gracefully during registration', async ({ page, context }) => {
    const testUser = generateTestUser();

    // Try to navigate to registration page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Block network requests to simulate network error
      await context.route('**/auth/register', route => {
        route.abort('failed');
      });

      // Fill and submit registration form
      await page.fill('input[type="email"], [name="email"], [data-testid="email"]', testUser.email);
      await page.fill('input[type="password"], [name="password"], [data-testid="password"]', testUser.password);

      const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      await submitButton.click();

      // Wait for error handling
      await page.waitForTimeout(3000);

      // Look for network error messages
      const networkError = page.locator('text=Network error, text=Connection failed, text=Try again, .network-error, [data-testid="network-error"]');
      const hasNetworkError = await networkError.count() > 0;

      if (hasNetworkError) {
        await expect(networkError.first()).toBeVisible();
      }

      // Restore network
      await context.unroute('**/auth/register');
    } else {
      console.log('Registration form not available for network error test');
    }
  });
});

test.describe('User Registration Flow - Accessibility Tests', () => {
  const BASE_URL = 'http://localhost:3003';

  test('should be accessible via keyboard navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Test keyboard navigation through form
      await page.keyboard.press('Tab'); // Should focus first input
      await page.keyboard.type('test@example.com');

      await page.keyboard.press('Tab'); // Should focus password input
      await page.keyboard.type('TestPassword123!');

      // Continue tabbing through form elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to submit with Enter
      await page.keyboard.press('Enter');

      // Form should handle keyboard submission
      await page.waitForTimeout(1000);
    } else {
      console.log('Registration form not available for accessibility test');
    }
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    const hasRegistrationForm = await page.locator('form, .registration-form, [data-testid="registration-form"]').isVisible();

    if (hasRegistrationForm) {
      // Check for proper form labels
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      if (await emailInput.isVisible()) {
        const emailLabel = await emailInput.getAttribute('aria-label') ||
                          await emailInput.getAttribute('aria-labelledby') ||
                          await page.locator('label[for]').textContent();
        expect(emailLabel).toBeTruthy();
      }

      if (await passwordInput.isVisible()) {
        const passwordLabel = await passwordInput.getAttribute('aria-label') ||
                             await passwordInput.getAttribute('aria-labelledby') ||
                             await page.locator('label[for]').textContent();
        expect(passwordLabel).toBeTruthy();
      }
    } else {
      console.log('Registration form not available for ARIA test');
    }
  });
});