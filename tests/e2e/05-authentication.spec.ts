import { test, expect } from '@playwright/test';

/**
 * Comprehensive authentication middleware testing suite
 * Tests JWT authentication, role-based access control, and API security
 */

test.describe('Authentication Middleware Tests', () => {
  const BASE_URL = 'http://localhost:8000/api/v1';

  // Test users
  const ADMIN_USER = {
    username: 'admin@turtletrading.com',
    password: 'admin123'
  };

  const REGULAR_USER = {
    username: 'user@turtletrading.com',
    password: 'user123'
  };

  let adminToken: string;
  let userToken: string;

  test.beforeAll(async ({ request }) => {
    // Get admin token
    const adminLoginResponse = await request.post(`${BASE_URL}/auth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: `username=${ADMIN_USER.username}&password=${ADMIN_USER.password}`,
    });

    expect(adminLoginResponse.ok()).toBeTruthy();
    const adminLoginData = await adminLoginResponse.json();
    adminToken = adminLoginData.access_token;
    expect(adminToken).toBeTruthy();

    // Get regular user token
    const userLoginResponse = await request.post(`${BASE_URL}/auth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: `username=${REGULAR_USER.username}&password=${REGULAR_USER.password}`,
    });

    expect(userLoginResponse.ok()).toBeTruthy();
    const userLoginData = await userLoginResponse.json();
    userToken = userLoginData.access_token;
    expect(userToken).toBeTruthy();
  });

  test.describe('Authentication Flow', () => {
    test('should successfully login with valid credentials', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/auth/token`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: `username=${ADMIN_USER.username}&password=${ADMIN_USER.password}`,
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('access_token');
      expect(data).toHaveProperty('token_type', 'bearer');
      expect(data).toHaveProperty('expires_in', 3600);
      expect(data.access_token).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/); // JWT format
    });

    test('should reject invalid credentials', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/auth/token`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: 'username=invalid@example.com&password=wrongpassword',
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.detail).toBe('Incorrect email or password');
    });

    test('should get current user profile with valid token', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email', ADMIN_USER.username);
      expect(data).toHaveProperty('full_name');
      expect(data).toHaveProperty('is_active', true);
      expect(data).toHaveProperty('role', 'admin');
      expect(data).toHaveProperty('subscription_tier', 'premium');
    });

    test('should reject access without token', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.detail).toBe('Authentication token required');
    });

    test('should reject access with invalid token', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/me`, {
        headers: {
          'Authorization': 'Bearer invalid_token_here',
        },
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.detail).toBe('Invalid authentication token');
    });
  });

  test.describe('Role-Based Access Control', () => {
    test('admin user should access admin endpoints', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/admin/users`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('total_users');
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('requested_by', ADMIN_USER.username);
      expect(Array.isArray(data.users)).toBeTruthy();
      expect(data.users.length).toBeGreaterThan(0);

      // Check user data structure
      const firstUser = data.users[0];
      expect(firstUser).toHaveProperty('id');
      expect(firstUser).toHaveProperty('email');
      expect(firstUser).toHaveProperty('role');
      expect(firstUser).toHaveProperty('subscription_tier');
    });

    test('regular user should be blocked from admin endpoints', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/admin/users`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      expect(response.status()).toBe(403);
      const data = await response.json();
      expect(data.detail).toBe('Admin access required');
    });

    test('unauthenticated request should be blocked from admin endpoints', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/admin/users`);

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.detail).toBe('Authentication token required');
    });
  });

  test.describe('Subscription-Based Access Control', () => {
    test('admin user (premium) should access premium features', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/premium/features`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('user', ADMIN_USER.username);
      expect(data).toHaveProperty('subscription_tier', 'premium');
      expect(data).toHaveProperty('features');
      expect(data).toHaveProperty('message', 'Premium features available');

      // Check premium features
      const features = data.features;
      expect(features).toHaveProperty('advanced_analytics', true);
      expect(features).toHaveProperty('real_time_alerts', true);
      expect(features).toHaveProperty('api_access', true);
      expect(features).toHaveProperty('custom_indicators', true);
      expect(features).toHaveProperty('portfolio_optimization', true);
      expect(features).toHaveProperty('unlimited_watchlists', true);
      expect(features).toHaveProperty('priority_support', true);
      expect(features).toHaveProperty('export_data', true);
    });

    test('regular user (free) should be blocked from premium features', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/premium/features`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      expect(response.status()).toBe(403);
      const data = await response.json();
      expect(data.detail).toBe('Premium subscription required');
    });
  });

  test.describe('Optional Authentication Endpoints', () => {
    test('public endpoint should work without authentication', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/public/info`);

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('platform', 'TurtleTrading');
      expect(data).toHaveProperty('version', '1.0.0');
      expect(data).toHaveProperty('features');
      expect(data).toHaveProperty('authenticated', false);
      expect(data).toHaveProperty('message', 'Sign up for personalized features');
      expect(Array.isArray(data.features)).toBeTruthy();
    });

    test('public endpoint should show user info when authenticated', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/public/info`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('platform', 'TurtleTrading');
      expect(data).toHaveProperty('version', '1.0.0');
      expect(data).toHaveProperty('authenticated', true);
      expect(data).toHaveProperty('user_email', ADMIN_USER.username);
      expect(data).toHaveProperty('user_role', 'admin');
      expect(data).not.toHaveProperty('message');
    });

    test('public endpoint should gracefully handle invalid token', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/public/info`, {
        headers: {
          'Authorization': 'Bearer invalid_token',
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Should fall back to unauthenticated behavior
      expect(data).toHaveProperty('authenticated', false);
      expect(data).toHaveProperty('message', 'Sign up for personalized features');
    });
  });

  test.describe('Token Management', () => {
    test('should refresh token with valid authentication', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/auth/refresh-token`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('access_token');
      expect(data).toHaveProperty('token_type', 'bearer');
      expect(data.access_token).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);

      // New token should be different from original
      expect(data.access_token).not.toBe(adminToken);
    });

    test('should handle logout request', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/auth/logout`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('message', 'Successfully logged out');
    });
  });

  test.describe('Security Features', () => {
    test('should validate JWT token format', async ({ request }) => {
      // Test various invalid token formats
      const invalidTokens = [
        'not.a.jwt',
        'too.few.parts',
        'too.many.parts.here.invalid',
        '',
        'Bearer token-without-bearer-prefix'
      ];

      for (const invalidToken of invalidTokens) {
        const response = await request.get(`${BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${invalidToken}`,
          },
        });

        expect(response.status()).toBe(401);
        const data = await response.json();
        expect(data.detail).toBe('Invalid authentication token');
      }
    });

    test('should require Bearer scheme', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Basic ${adminToken}`, // Wrong scheme
        },
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.detail).toBe('Authentication token required');
    });

    test('should handle malformed Authorization header', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/auth/me`, {
        headers: {
          'Authorization': 'malformed-header-without-space',
        },
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.detail).toBe('Authentication token required');
    });
  });

  test.describe('Rate Limiting (if implemented)', () => {
    test('should respect rate limits on auth endpoints', async ({ request }) => {
      // This test assumes rate limiting is configured
      // Adjust limits based on your actual configuration

      const loginAttempts = [];
      const maxAttempts = 10; // Test a reasonable number

      for (let i = 0; i < maxAttempts; i++) {
        const promise = request.post(`${BASE_URL}/auth/token`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          data: 'username=invalid@example.com&password=invalid',
        });
        loginAttempts.push(promise);
      }

      const responses = await Promise.all(loginAttempts);

      // All should return 401 (not rate limited with this number)
      // If rate limiting is stricter, some might return 429
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status());
      });
    });
  });

  test.describe('API Integration with Authentication', () => {
    test('should maintain backward compatibility with existing endpoints', async ({ request }) => {
      // Test that non-auth endpoints still work
      const response = await request.get('http://localhost:8000/health');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('status', 'healthy');
    });

    test('should include proper CORS headers for auth endpoints', async ({ request }) => {
      const response = await request.options(`${BASE_URL}/auth/token`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });

      // Should handle preflight requests
      expect([200, 204]).toContain(response.status());
    });
  });

  test.describe('Error Handling', () => {
    test('should provide clear error messages for authentication failures', async ({ request }) => {
      const testCases = [
        {
          endpoint: '/auth/me',
          method: 'GET',
          headers: {},
          expectedStatus: 401,
          expectedMessage: 'Authentication token required'
        },
        {
          endpoint: '/auth/admin/users',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${userToken}` },
          expectedStatus: 403,
          expectedMessage: 'Admin access required'
        },
        {
          endpoint: '/auth/premium/features',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${userToken}` },
          expectedStatus: 403,
          expectedMessage: 'Premium subscription required'
        }
      ];

      for (const testCase of testCases) {
        const response = await request.fetch(`${BASE_URL}${testCase.endpoint}`, {
          method: testCase.method,
          headers: testCase.headers,
        });

        expect(response.status()).toBe(testCase.expectedStatus);
        const data = await response.json();
        expect(data.detail).toBe(testCase.expectedMessage);
      }
    });
  });
});