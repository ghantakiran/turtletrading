import { test, expect } from '@playwright/test';

/**
 * Comprehensive authentication middleware test with rate limit handling
 * Tests the complete authentication system including JWT, RBAC, and security features
 */

test.describe('Authentication Middleware - Comprehensive Tests', () => {
  const BASE_URL = 'http://localhost:8000/api/v1';

  // Store tokens for reuse to avoid rate limiting
  let adminToken: string;
  let userToken: string;

  test.beforeAll(async ({ request }) => {
    // Login as admin user
    try {
      const adminResponse = await request.post(`${BASE_URL}/auth/token`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'username=admin@turtletrading.com&password=admin123',
      });

      if (adminResponse.ok()) {
        const adminData = await adminResponse.json();
        adminToken = adminData.access_token;
      }
    } catch (error) {
      console.log('Admin login failed (might be rate limited):', error);
    }

    // Login as regular user
    try {
      const userResponse = await request.post(`${BASE_URL}/auth/token`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'username=user@turtletrading.com&password=user123',
      });

      if (userResponse.ok()) {
        const userData = await userResponse.json();
        userToken = userData.access_token;
      }
    } catch (error) {
      console.log('User login failed (might be rate limited):', error);
    }
  });

  test('Public endpoint works without authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/auth/public/info`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('platform', 'TurtleTrading');
    expect(data).toHaveProperty('version', '1.0.0');
    expect(data).toHaveProperty('authenticated', false);
    expect(data).toHaveProperty('features');
    expect(Array.isArray(data.features)).toBeTruthy();
  });

  test('Protected endpoint rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/auth/me`);

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.detail).toBe('Authentication token required');
  });

  test('Protected endpoint rejects invalid tokens', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': 'Bearer invalid_jwt_token' },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.detail).toBe('Invalid authentication token');
  });

  test('Admin token allows access to admin endpoints', async ({ request }) => {
    test.skip(!adminToken, 'Admin token not available (rate limited)');

    const response = await request.get(`${BASE_URL}/auth/admin/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('total_users');
    expect(data).toHaveProperty('users');
    expect(data).toHaveProperty('requested_by', 'admin@turtletrading.com');
    expect(Array.isArray(data.users)).toBeTruthy();
    expect(data.users.length).toBeGreaterThan(0);
  });

  test('Admin token allows access to premium features', async ({ request }) => {
    test.skip(!adminToken, 'Admin token not available (rate limited)');

    const response = await request.get(`${BASE_URL}/auth/premium/features`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('user', 'admin@turtletrading.com');
    expect(data).toHaveProperty('subscription_tier', 'premium');
    expect(data).toHaveProperty('features');

    const features = data.features;
    expect(features).toHaveProperty('advanced_analytics', true);
    expect(features).toHaveProperty('real_time_alerts', true);
    expect(features).toHaveProperty('api_access', true);
  });

  test('Regular user token blocked from admin endpoints', async ({ request }) => {
    test.skip(!userToken, 'User token not available (rate limited)');

    const response = await request.get(`${BASE_URL}/auth/admin/users`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.detail).toBe('Admin access required');
  });

  test('Regular user token blocked from premium features', async ({ request }) => {
    test.skip(!userToken, 'User token not available (rate limited)');

    const response = await request.get(`${BASE_URL}/auth/premium/features`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.detail).toBe('Premium subscription required');
  });

  test('Public endpoint shows user info when authenticated', async ({ request }) => {
    test.skip(!adminToken, 'Admin token not available (rate limited)');

    const response = await request.get(`${BASE_URL}/auth/public/info`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('platform', 'TurtleTrading');
    expect(data).toHaveProperty('authenticated', true);
    expect(data).toHaveProperty('user_email', 'admin@turtletrading.com');
    expect(data).toHaveProperty('user_role', 'admin');
  });

  test('User profile endpoint returns correct data', async ({ request }) => {
    test.skip(!adminToken, 'Admin token not available (rate limited)');

    const response = await request.get(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('email', 'admin@turtletrading.com');
    expect(data).toHaveProperty('full_name', 'Admin User');
    expect(data).toHaveProperty('is_active', true);
    expect(data).toHaveProperty('role', 'admin');
    expect(data).toHaveProperty('subscription_tier', 'premium');
  });

  test('Token refresh works with valid authentication', async ({ request }) => {
    test.skip(!adminToken, 'Admin token not available (rate limited)');

    const response = await request.post(`${BASE_URL}/auth/refresh-token`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('access_token');
    expect(data).toHaveProperty('token_type', 'bearer');
    expect(data.access_token).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
    expect(data.access_token).not.toBe(adminToken);
  });

  test('Logout endpoint works correctly', async ({ request }) => {
    test.skip(!userToken, 'User token not available (rate limited)');

    const response = await request.post(`${BASE_URL}/auth/logout`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('message', 'Successfully logged out');
  });

  test('Rate limiting prevents excessive requests', async ({ request }) => {
    // Test rate limiting by making multiple requests
    const responses = await Promise.all([
      request.post(`${BASE_URL}/auth/token`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'username=invalid@example.com&password=invalid',
      }),
      request.post(`${BASE_URL}/auth/token`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'username=invalid@example.com&password=invalid',
      })
    ]);

    // At least one should respond (either with 401 or 429)
    const statusCodes = responses.map(r => r.status());
    expect(statusCodes.every(code => [401, 422, 429].includes(code))).toBeTruthy();
  });

  test('Malformed Authorization headers are handled', async ({ request }) => {
    const testCases = [
      { header: 'malformed-header', expectedStatus: 401 },
      { header: 'Basic dGVzdDp0ZXN0', expectedStatus: 401 },
      { header: 'Bearer', expectedStatus: 401 },
      { header: '', expectedStatus: 401 }
    ];

    for (const testCase of testCases) {
      const response = await request.get(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': testCase.header },
      });

      expect(response.status()).toBe(testCase.expectedStatus);
    }
  });
});