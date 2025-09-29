import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import FacebookProvider from 'next-auth/providers/facebook'
import AppleProvider from 'next-auth/providers/apple'
import CredentialsProvider from 'next-auth/providers/credentials'
import { JWT } from 'next-auth/jwt'
import { User as NextAuthUser, Session } from 'next-auth'

// Force Node.js runtime to avoid Vercel Edge runtime DNS issues
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Extend NextAuth types to include our custom user properties
declare module 'next-auth' {
  interface User {
    id: string
    email: string
    firstName?: string
    lastName?: string
    role?: 'user' | 'admin' | 'pro'
    subscription?: 'free' | 'pro' | 'enterprise'
    isVerified?: boolean
    createdAt?: string
    lastLoginAt?: string
  }

  interface Session {
    user: {
      id: string
      email: string
      firstName?: string
      lastName?: string
      role?: 'user' | 'admin' | 'pro'
      subscription?: 'free' | 'pro' | 'enterprise'
      isVerified?: boolean
      createdAt?: string
      lastLoginAt?: string
    }
    accessToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    subscription?: string
    isVerified?: boolean
    createdAt?: string
    lastLoginAt?: string
    accessToken?: string
  }
}

// Mock users for development (same as existing system)
const MOCK_USERS = {
  'admin@turtletrading.com': {
    id: '1',
    email: 'admin@turtletrading.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin' as const,
    subscription: 'enterprise' as const,
    isVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  'user@turtletrading.com': {
    id: '2',
    email: 'user@turtletrading.com',
    password: 'user123',
    firstName: 'Test',
    lastName: 'User',
    role: 'user' as const,
    subscription: 'free' as const,
    isVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLoginAt: new Date().toISOString(),
  }
};

// Check if backend is available
async function isBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log('Backend not available, using mock authentication');
    return false;
  }
}

// Authenticate with backend or mock
async function authenticateUser(email: string, password: string) {
  const backendAvailable = await isBackendAvailable();

  if (!backendAvailable) {
    // Use mock authentication
    const mockUser = MOCK_USERS[email as keyof typeof MOCK_USERS];
    if (!mockUser || mockUser.password !== password) {
      return null;
    }

    return {
      id: mockUser.id,
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      role: mockUser.role,
      subscription: mockUser.subscription,
      isVerified: mockUser.isVerified,
      createdAt: mockUser.createdAt,
      lastLoginAt: mockUser.lastLoginAt,
    };
  }

  // Use real backend authentication
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: email,
        password: password,
      }),
    });

    if (!response.ok) {
      console.log('Backend authentication failed with status:', response.status);
      // Fall back to mock authentication for 401/422 errors
      if (response.status === 401 || response.status === 422) {
        console.log('Falling back to mock authentication');
        const mockUser = MOCK_USERS[email as keyof typeof MOCK_USERS];
        if (mockUser && mockUser.password === password) {
          return {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            role: mockUser.role,
            subscription: mockUser.subscription,
            isVerified: mockUser.isVerified,
            createdAt: mockUser.createdAt,
            lastLoginAt: mockUser.lastLoginAt,
          };
        }
      }
      return null;
    }

    const data = await response.json();
    return {
      id: data.user.id || data.user_id,
      email: data.user.email,
      firstName: data.user.first_name || data.user.firstName || '',
      lastName: data.user.last_name || data.user.lastName || '',
      role: data.user.role || 'user',
      subscription: data.user.subscription || 'free',
      isVerified: data.user.is_verified || data.user.isVerified || false,
      createdAt: data.user.created_at || data.user.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      accessToken: data.access_token,
    };
  } catch (error) {
    console.error('Backend authentication failed:', error);
    // Fall back to mock authentication on network error
    console.log('Network error, falling back to mock authentication');
    const mockUser = MOCK_USERS[email as keyof typeof MOCK_USERS];
    if (mockUser && mockUser.password === password) {
      return {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        subscription: mockUser.subscription,
        isVerified: mockUser.isVerified,
        createdAt: mockUser.createdAt,
        lastLoginAt: mockUser.lastLoginAt,
      };
    }
    return null;
  }
}

const handler = NextAuth({
  trustHost: true, // Allow NextAuth to infer the URL from the request
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-key-change-in-production',
  // Explicit URL configuration for Vercel
  ...(process.env.NEXTAUTH_URL && {
    url: process.env.NEXTAUTH_URL,
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await authenticateUser(credentials.email, credentials.password);
        return user;
      }
    })
  ],
  pages: {
    signIn: '/login',
    signUp: '/register',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 15 * 60, // 15 minutes (same as existing JWT)
  },
  jwt: {
    maxAge: 15 * 60, // 15 minutes
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        token.id = user.id;
        token.role = user.role || 'user';
        token.subscription = user.subscription || 'free';
        token.isVerified = user.isVerified || false;
        token.createdAt = user.createdAt;
        token.lastLoginAt = user.lastLoginAt;

        // Store access token for credentials provider
        if (account.provider === 'credentials' && 'accessToken' in user) {
          token.accessToken = user.accessToken as string;
        }

        // For OAuth providers, create user profile in backend if available
        if (account.provider !== 'credentials') {
          const backendAvailable = await isBackendAvailable();
          if (backendAvailable) {
            try {
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/oauth-register`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email: user.email,
                  firstName: user.firstName || user.name?.split(' ')[0] || '',
                  lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
                  provider: account.provider,
                  providerId: account.providerAccountId,
                }),
              });

              if (response.ok) {
                const data = await response.json();
                token.accessToken = data.access_token;
              }
            } catch (error) {
              console.error('OAuth user registration failed:', error);
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'user' | 'admin' | 'pro';
        session.user.subscription = token.subscription as 'free' | 'pro' | 'enterprise';
        session.user.isVerified = token.isVerified as boolean;
        session.user.createdAt = token.createdAt as string;
        session.user.lastLoginAt = token.lastLoginAt as string;
        session.accessToken = token.accessToken as string;
      }

      return session;
    },
    async signIn({ user, account, profile }) {
      // Allow all sign-ins for now
      // Add additional validation logic here if needed
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Enhanced redirect logic for Vercel deployment
      try {
        // Use environment NEXTAUTH_URL if available, fallback to baseUrl
        const siteUrl = process.env.NEXTAUTH_URL || baseUrl;

        // Handle relative URLs
        if (url.startsWith('/')) {
          return `${siteUrl}${url}`;
        }

        // Handle absolute URLs - check if they match our domain
        const urlObj = new URL(url);
        const siteUrlObj = new URL(siteUrl);

        if (urlObj.hostname === siteUrlObj.hostname) {
          return url;
        }

        // Default redirect to dashboard
        return `${siteUrl}/dashboard`;
      } catch (error) {
        console.error('Redirect callback error:', error);
        // Fallback to dashboard
        return `${baseUrl}/dashboard`;
      }
    },
  },
  events: {
    async signIn(message) {
      console.log('User signed in:', message.user.email);
    },
    async signOut(message) {
      console.log('User signed out:', message.token?.email);
    },
  },
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, metadata) {
      console.error('NextAuth Error:', code, metadata);
    },
    warn(code) {
      console.warn('NextAuth Warning:', code);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === 'development') {
        console.log('NextAuth Debug:', code, metadata);
      }
    }
  },
});

export { handler as GET, handler as POST }