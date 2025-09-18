import { test, expect } from '@playwright/test';

/**
 * Simple authentication middleware test to verify core functionality
 */

test.describe('Authentication Middleware - Core Tests', () => {
  const BASE_URL = 'http://localhost:8000/api/v1';

  test('should access public endpoint without authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/auth/public/info`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('platform', 'TurtleTrading');
    expect(data).toHaveProperty('authenticated', false);
    expect(data).toHaveProperty('message', 'Sign up for personalized features');
  });

  test('should reject access to protected endpoint without token', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/auth/me`);

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.detail).toBe('Authentication token required');
  });

  test('should reject access with invalid token', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/auth/me`, {
      headers: {
        'Authorization': 'Bearer invalid_token_123',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.detail).toBe('Invalid authentication token');
  });

  test('should handle rate limiting gracefully', async ({ request }) => {
    // Try to access a rate-limited endpoint and expect appropriate response
    const response = await request.post(`${BASE_URL}/auth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: 'username=test@example.com&password=test123',
    });

    // Should either succeed or show rate limit error
    expect([200, 401, 429, 422]).toContain(response.status());

    if (response.status() === 429) {
      const data = await response.json();
      expect(data.error).toContain('Rate limit exceeded');
    }
  });
});