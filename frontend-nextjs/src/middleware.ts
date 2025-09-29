import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  // Middleware function
  function middleware(req) {
    // Add security headers
    const response = NextResponse.next()

    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Public routes that don't require authentication
        const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password']
        if (publicRoutes.includes(pathname)) {
          return true
        }

        // Protected routes require authentication
        const protectedRoutes = ['/dashboard', '/market', '/sentiment', '/analysis', '/portfolio', '/alerts', '/settings', '/watchlist']
        if (protectedRoutes.some(route => pathname.startsWith(route))) {
          return !!token
        }

        // Admin routes require admin role
        const adminRoutes = ['/admin']
        if (adminRoutes.some(route => pathname.startsWith(route))) {
          return token?.role === 'admin'
        }

        // Default to allowing the request
        return true
      },
    },
    pages: {
      signIn: '/login',
      error: '/login',
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}