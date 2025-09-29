'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify, SignJWT } from 'jose';

// Environment configuration
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key'
);
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

// Mock users for demo when backend is not available
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
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(`${API_BASE_URL}/health`, {
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

// Token configuration
const ACCESS_TOKEN_EXPIRE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRE = 7 * 24 * 60 * 60; // 7 days

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'pro';
  subscription: 'free' | 'pro' | 'enterprise';
  isVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  message?: string;
}

// JWT utilities
export async function createJWT(payload: any, expiresIn: number): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// Session management - DISABLED FOR CORE APP TESTING
export async function getSession(): Promise<User | null> {
  // Authentication is temporarily disabled for core app testing
  return null;
}

export async function setSession(user: User, accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();

  // Create JWT payload
  const payload = {
    user_id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    subscription: user.subscription,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };

  // Create access token
  const jwtToken = await createJWT(payload, ACCESS_TOKEN_EXPIRE);

  // Set cookies
  cookieStore.set('auth-token', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_EXPIRE,
    path: '/',
  });

  cookieStore.set('refresh-token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRE,
    path: '/',
  });
}

export async function clearSession() {
  const cookieStore = await cookies();

  cookieStore.delete('auth-token');
  cookieStore.delete('refresh-token');
}

// Mock authentication function
async function mockLoginAction(credentials: LoginCredentials): Promise<AuthResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const mockUser = MOCK_USERS[credentials.email as keyof typeof MOCK_USERS];

  if (!mockUser || mockUser.password !== credentials.password) {
    return {
      success: false,
      error: 'Invalid credentials',
    };
  }

  const user: User = {
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

  // Create mock tokens
  const mockAccessToken = await createJWT({ user_id: user.id, email: user.email }, ACCESS_TOKEN_EXPIRE);
  const mockRefreshToken = await createJWT({ user_id: user.id, email: user.email }, REFRESH_TOKEN_EXPIRE);

  // Set session
  await setSession(user, mockAccessToken, mockRefreshToken);

  return {
    success: true,
    user,
  };
}

// Authentication actions
export async function loginAction(
  credentials: LoginCredentials
): Promise<AuthResponse> {
  try {
    // Check if backend is available
    const backendAvailable = await isBackendAvailable();

    if (!backendAvailable) {
      console.log('Using mock authentication for demo');
      return await mockLoginAction(credentials);
    }

    // Use real backend authentication
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      return {
        success: false,
        error: error.message || 'Invalid credentials',
      };
    }

    const data = await response.json();

    // Create user object from API response
    const user: User = {
      id: data.user.id || data.user_id,
      email: data.user.email,
      firstName: data.user.first_name || data.user.firstName || '',
      lastName: data.user.last_name || data.user.lastName || '',
      role: data.user.role || 'user',
      subscription: data.user.subscription || 'free',
      isVerified: data.user.is_verified || data.user.isVerified || false,
      createdAt: data.user.created_at || data.user.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    // Set session
    await setSession(user, data.access_token, data.refresh_token);

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error('Login action failed:', error);
    // Fallback to mock authentication on network error
    console.log('Network error, falling back to mock authentication');
    return await mockLoginAction(credentials);
  }
}

export async function registerAction(
  userData: RegisterData
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        first_name: userData.firstName,
        last_name: userData.lastName,
        accept_terms: userData.acceptTerms,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Registration failed' }));
      return {
        success: false,
        error: error.message || 'Registration failed',
      };
    }

    const data = await response.json();

    // If registration includes login (access token), set session
    if (data.access_token) {
      const user: User = {
        id: data.user.id || data.user_id,
        email: data.user.email,
        firstName: data.user.first_name || data.user.firstName || userData.firstName,
        lastName: data.user.last_name || data.user.lastName || userData.lastName,
        role: data.user.role || 'user',
        subscription: data.user.subscription || 'free',
        isVerified: data.user.is_verified || data.user.isVerified || false,
        createdAt: data.user.created_at || data.user.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      await setSession(user, data.access_token, data.refresh_token);

      return {
        success: true,
        user,
        message: 'Registration successful! Please check your email for verification.',
      };
    }

    return {
      success: true,
      message: 'Registration successful! Please check your email for verification.',
    };
  } catch (error) {
    console.error('Registration action failed:', error);
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

export async function logoutAction() {
  try {
    // Call backend logout if needed
    const session = await getSession();
    if (session) {
      const cookieStore = await cookies();
      const token = cookieStore.get('auth-token')?.value;

      if (token) {
        // Optional: Call backend logout endpoint
        fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => {
          // Ignore errors on logout
        });
      }
    }

    // Clear session
    await clearSession();
  } catch (error) {
    console.error('Logout action failed:', error);
    // Still clear session even if API call fails
    await clearSession();
  }

  // Redirect to login
  redirect('/login');
}

export async function refreshTokenAction(): Promise<AuthResponse> {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh-token')?.value;

    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      // Clear invalid tokens
      await clearSession();
      return {
        success: false,
        error: 'Token refresh failed',
      };
    }

    const data = await response.json();

    // Create user object
    const user: User = {
      id: data.user.id || data.user_id,
      email: data.user.email,
      firstName: data.user.first_name || data.user.firstName || '',
      lastName: data.user.last_name || data.user.lastName || '',
      role: data.user.role || 'user',
      subscription: data.user.subscription || 'free',
      isVerified: data.user.is_verified || data.user.isVerified || false,
      createdAt: data.user.created_at || data.user.createdAt || new Date().toISOString(),
      lastLoginAt: data.user.last_login_at || data.user.lastLoginAt,
    };

    // Set new session
    await setSession(user, data.access_token, data.refresh_token);

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    await clearSession();
    return {
      success: false,
      error: 'Token refresh failed',
    };
  }
}

// Protected action wrapper
export async function requireAuth<T extends any[]>(
  action: (...args: T) => Promise<any>
): Promise<(...args: T) => Promise<any>> {
  return async (...args: T) => {
    const session = await getSession();
    if (!session) {
      redirect('/login');
    }
    return action(...args);
  };
}

// Admin-only action wrapper
export async function requireAdmin<T extends any[]>(
  action: (...args: T) => Promise<any>
): Promise<(...args: T) => Promise<any>> {
  return async (...args: T) => {
    const session = await getSession();
    if (!session) {
      redirect('/login');
    }
    if (session.role !== 'admin') {
      throw new Error('Admin access required');
    }
    return action(...args);
  };
}