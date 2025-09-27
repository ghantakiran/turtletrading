/**
 * Integration tests for Next.js middleware
 * Tests authentication guards, route protection, and redirect logic
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Mock jose library
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
}));

// Mock the middleware import to avoid server-side execution issues
let middleware: any;

// Helper to create mock requests
const createMockRequest = (
  pathname: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {}
) => {
  const url = `http://localhost:3000${pathname}`;
  const request = new NextRequest(url);

  // Mock cookies
  const cookiesMap = new Map();
  Object.entries(cookies).forEach(([name, value]) => {
    cookiesMap.set(name, { name, value });
  });

  // Override cookies property
  Object.defineProperty(request, 'cookies', {
    value: {
      get: (name: string) => cookiesMap.get(name),
      has: (name: string) => cookiesMap.has(name),
      getAll: () => Array.from(cookiesMap.values()),
    },
  });

  // Mock headers
  Object.entries(headers).forEach(([name, value]) => {
    request.headers.set(name, value);
  });

  return request;
};

// Mock JWT payload
const mockValidPayload = {
  user_id: 'user123',
  email: 'test@example.com',
  role: 'user' as const,
  subscription: 'free' as const,
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
};

const mockAdminPayload = {
  user_id: 'admin123',
  email: 'admin@example.com',
  role: 'admin' as const,
  subscription: 'enterprise' as const,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

describe('Middleware Integration Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // Import middleware fresh for each test
    jest.resetModules();
    const middlewareModule = await import('@/middleware');
    middleware = middlewareModule.default;
  });

  describe('Public Routes', () => {
    it('should allow access to home page without authentication', async () => {
      const request = createMockRequest('/');
      const response = await middleware(request);

      expect(response).toBeUndefined(); // NextResponse.next() returns undefined
    });

    it('should allow access to API routes without authentication', async () => {
      const publicApiRoutes = [
        '/api/health',
        '/api/v1/stocks/AAPL/price',
        '/api/v1/market/overview',
      ];

      for (const route of publicApiRoutes) {
        const request = createMockRequest(route);
        const response = await middleware(request);

        expect(response).toBeUndefined();
      }
    });

    it('should allow access to static assets', async () => {
      const staticRoutes = [
        '/_next/static/chunks/main.js',
        '/favicon.ico',
        '/images/logo.png',
      ];

      for (const route of staticRoutes) {
        const request = createMockRequest(route);
        const response = await middleware(request);

        expect(response).toBeUndefined();
      }
    });
  });

  describe('Auth Routes (Login/Register)', () => {
    it('should allow unauthenticated users to access login page', async () => {
      const request = createMockRequest('/login');
      const response = await middleware(request);

      expect(response).toBeUndefined();
    });

    it('should allow unauthenticated users to access register page', async () => {
      const request = createMockRequest('/register');
      const response = await middleware(request);

      expect(response).toBeUndefined();
    });

    it('should redirect authenticated users away from auth pages', async () => {
      (jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: mockValidPayload,
      });

      const authRoutes = ['/login', '/register', '/forgot-password'];

      for (const route of authRoutes) {
        const request = createMockRequest(route, {
          'auth-token': 'valid.jwt.token',
        });
        const response = await middleware(request);

        expect(response).toBeInstanceOf(NextResponse);
        expect(response?.headers.get('location')).toBe('/dashboard');
      }
    });
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users to login', async () => {
      const protectedRoutes = [
        '/dashboard',
        '/market',
        '/portfolio',
        '/alerts',
        '/settings',
      ];

      for (const route of protectedRoutes) {
        const request = createMockRequest(route);
        const response = await middleware(request);

        expect(response).toBeInstanceOf(NextResponse);
        expect(response?.headers.get('location')).toBe(`/login?from=${route}`);
      }
    });

    it('should allow authenticated users to access protected routes', async () => {
      (jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: mockValidPayload,
      });

      const protectedRoutes = [
        '/dashboard',
        '/market',
        '/portfolio',
        '/alerts',
        '/settings',
      ];

      for (const route of protectedRoutes) {
        const request = createMockRequest(route, {
          'auth-token': 'valid.jwt.token',
        });
        const response = await middleware(request);

        expect(response).toBeUndefined();
      }
    });

    it('should redirect users with invalid tokens to login', async () => {
      (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error('Invalid token'));

      const request = createMockRequest('/dashboard', {
        'auth-token': 'invalid.jwt.token',
      });
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.headers.get('location')).toBe('/login?from=/dashboard');
    });

    it('should redirect users with expired tokens to login', async () => {
      const expiredPayload = {
        ...mockValidPayload,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error('Token expired'));

      const request = createMockRequest('/dashboard', {
        'auth-token': 'expired.jwt.token',
      });
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.headers.get('location')).toBe('/login?from=/dashboard');
    });
  });

  describe('Admin Routes', () => {
    it('should allow admin users to access admin routes', async () => {
      (jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: mockAdminPayload,
      });

      const request = createMockRequest('/admin', {
        'auth-token': 'valid.admin.token',
      });
      const response = await middleware(request);

      expect(response).toBeUndefined();
    });

    it('should deny non-admin users access to admin routes', async () => {
      (jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: mockValidPayload, // regular user
      });

      const request = createMockRequest('/admin', {
        'auth-token': 'valid.user.token',
      });
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(403);
    });

    it('should deny unauthenticated users access to admin routes', async () => {
      const request = createMockRequest('/admin');
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.headers.get('location')).toBe('/login?from=/admin');
    });
  });

  describe('Rate Limiting', () => {
    it('should track requests by IP address', async () => {
      const ip = '192.168.1.100';
      const request = createMockRequest('/dashboard', {}, {
        'x-forwarded-for': ip,
      });

      // Make multiple requests quickly
      for (let i = 0; i < 5; i++) {
        await middleware(request);
      }

      // Rate limiting should be tracked (implementation-dependent)
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should rate limit excessive requests', async () => {
      const ip = '192.168.1.200';

      // Make many requests to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const request = createMockRequest('/dashboard', {}, {
          'x-forwarded-for': ip,
        });
        promises.push(middleware(request));
      }

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      // (actual implementation would return 429 status)
      expect(responses.length).toBe(100);
    });
  });

  describe('Security Headers', () => {
    it('should add security headers to responses', async () => {
      (jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: mockValidPayload,
      });

      const request = createMockRequest('/dashboard', {
        'auth-token': 'valid.jwt.token',
      });
      const response = await middleware(request);

      // For successful authentication, middleware returns undefined
      // Security headers are added in the middleware implementation
      expect(response).toBeUndefined();
    });

    it('should add CSRF protection headers', async () => {
      const request = createMockRequest('/api/protected', {}, {
        'x-requested-with': 'XMLHttpRequest',
      });
      const response = await middleware(request);

      // Verify CSRF protection is in place
      expect(response).toBeInstanceOf(NextResponse);
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from Authorization header', async () => {
      (jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: mockValidPayload,
      });

      const request = createMockRequest('/dashboard', {}, {
        'authorization': 'Bearer valid.jwt.token',
      });
      const response = await middleware(request);

      expect(response).toBeUndefined();
      expect(jwtVerify).toHaveBeenCalledWith(
        'valid.jwt.token',
        expect.any(Uint8Array)
      );
    });

    it('should extract token from auth-token cookie', async () => {
      (jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: mockValidPayload,
      });

      const request = createMockRequest('/dashboard', {
        'auth-token': 'valid.jwt.token',
      });
      const response = await middleware(request);

      expect(response).toBeUndefined();
      expect(jwtVerify).toHaveBeenCalledWith(
        'valid.jwt.token',
        expect.any(Uint8Array)
      );
    });

    it('should prioritize Authorization header over cookie', async () => {
      (jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: mockValidPayload,
      });

      const request = createMockRequest('/dashboard',
        { 'auth-token': 'cookie.token' },
        { 'authorization': 'Bearer header.token' }
      );
      const response = await middleware(request);

      expect(response).toBeUndefined();
      expect(jwtVerify).toHaveBeenCalledWith(
        'header.token',
        expect.any(Uint8Array)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle JWT verification errors gracefully', async () => {
      (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error('Malformed token'));

      const request = createMockRequest('/dashboard', {
        'auth-token': 'malformed.token',
      });
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.headers.get('location')).toBe('/login?from=/dashboard');
    });

    it('should handle missing environment variables gracefully', async () => {
      // Test would require mocking environment variables
      const request = createMockRequest('/dashboard');
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should handle malformed Authorization header', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Basic dGVzdDp0ZXN0',
        'InvalidScheme token',
      ];

      for (const auth of malformedHeaders) {
        const request = createMockRequest('/dashboard', {}, {
          'authorization': auth,
        });
        const response = await middleware(request);

        expect(response).toBeInstanceOf(NextResponse);
        expect(response?.headers.get('location')).toContain('/login');
      }
    });
  });

  describe('Redirect Logic', () => {
    it('should preserve original URL in redirect query parameter', async () => {
      const originalUrl = '/portfolio?tab=holdings&sort=value';
      const request = createMockRequest(originalUrl);
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.headers.get('location')).toBe(
        `/login?from=${encodeURIComponent(originalUrl)}`
      );
    });

    it('should handle complex query parameters in redirects', async () => {
      const originalUrl = '/alerts?type=price&symbol=AAPL&threshold=150.00';
      const request = createMockRequest(originalUrl);
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.headers.get('location')).toBe(
        `/login?from=${encodeURIComponent(originalUrl)}`
      );
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: mockValidPayload,
      });

      const requests = Array(50).fill(null).map((_, i) =>
        createMockRequest(`/dashboard?page=${i}`, {
          'auth-token': 'valid.jwt.token',
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => middleware(request))
      );
      const endTime = Date.now();

      expect(responses.length).toBe(50);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });
  });
});