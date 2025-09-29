import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Environment configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/market',
  '/sentiment',
  '/analysis',
  '/portfolio',
  '/alerts',
  '/settings',
  '/watchlist',
  '/api/protected'
];

// Public routes that should redirect to dashboard if authenticated
const AUTH_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password'
];

// Admin-only routes
const ADMIN_ROUTES = [
  '/admin',
  '/api/admin'
];

interface TokenPayload {
  id?: string;
  email?: string;
  role?: 'user' | 'admin' | 'pro';
  subscription?: 'free' | 'pro' | 'enterprise';
  isVerified?: boolean;
  exp?: number;
  iat?: number;
  jti?: string;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-here-make-it-secure-in-production'
);

// Demo users for lookup (same as in auth endpoints)
const DEMO_USERS = {
  '1': {
    id: '1',
    email: 'admin@turtletrading.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    subscription: 'premium',
  },
  '2': {
    id: '2',
    email: 'user@turtletrading.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'user',
    subscription: 'free',
  }
};

// Get JWT token from request headers or cookies and verify it
async function getJWTToken(request: NextRequest): Promise<TokenPayload | null> {
  try {
    // First try Authorization header
    let token = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no header, try cookies (for browser requests)
    if (!token) {
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        token = cookieToken;
      }
    }

    if (!token) {
      return null;
    }

    // Verify JWT token directly
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (!payload.sub || typeof payload.sub !== 'string') {
      return null;
    }

    // Get user data from our demo users
    const user = DEMO_USERS[payload.sub as keyof typeof DEMO_USERS];
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as 'user' | 'admin' | 'pro',
      subscription: user.subscription as 'free' | 'pro' | 'enterprise',
      isVerified: true, // Assume verified for demo users
    } as TokenPayload;
  } catch (error) {
    console.error('JWT token verification failed:', error);
    return null;
  }
}

// Check if path matches protected routes
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route =>
    pathname.startsWith(route) || pathname === route
  );
}

// Check if path matches auth routes
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route =>
    pathname.startsWith(route) || pathname === route
  );
}

// Check if path matches admin routes
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route =>
    pathname.startsWith(route) || pathname === route
  );
}

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // per window (increased for development)
  adminMaxRequests: 2000, // higher limit for admins
};

// Simple in-memory rate limiting (for production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, isAdmin: boolean = false): boolean {
  const now = Date.now();
  const windowMs = RATE_LIMIT_CONFIG.windowMs;
  const maxRequests = isAdmin ? RATE_LIMIT_CONFIG.adminMaxRequests : RATE_LIMIT_CONFIG.maxRequests;

  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    // Reset window
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

// Main middleware function
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  try {
    // TEMPORARILY DISABLED: JWT verification causing edge runtime issues
    const user = null; // await getJWTToken(request);

    // Rate limiting check
    if (!checkRateLimit(ip, user?.role === 'admin')) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '900', // 15 minutes
          },
        }
      );
    }

    // TEMPORARILY DISABLED: Handle protected routes
    // Will be implemented with client-side protection
    // if (isProtectedRoute(pathname)) {
    //   if (!user) {
    //     // Store the intended destination for redirect after login
    //     const loginUrl = new URL('/login', request.url);
    //     loginUrl.searchParams.set('redirect', pathname);
    //     return NextResponse.redirect(loginUrl);
    //   }

    //   // Check admin routes
    //   if (isAdminRoute(pathname) && user.role !== 'admin') {
    //     return new NextResponse(
    //       JSON.stringify({
    //         error: 'Forbidden',
    //         message: 'Admin access required',
    //       }),
    //       {
    //         status: 403,
    //         headers: {
    //           'Content-Type': 'application/json',
    //         },
    //       }
    //     );
    //   }
    // }

    // Handle auth routes - redirect to dashboard if already authenticated
    if (isAuthRoute(pathname) && user) {
      const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    // Add user context to headers for server components
    const response = NextResponse.next();

    if (user) {
      if (user.id) response.headers.set('x-user-id', user.id);
      if (user.email) response.headers.set('x-user-email', user.email);
      if (user.role) response.headers.set('x-user-role', user.role);
      if (user.subscription) response.headers.set('x-user-subscription', user.subscription);
    }

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss: " + API_BASE_URL
    );

    return response;

  } catch (error) {
    console.error('Middleware error:', error);

    // In case of critical errors, allow the request but log it
    const response = NextResponse.next();
    response.headers.set('x-middleware-error', 'true');
    return response;
  }
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/public (public API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api/public|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};