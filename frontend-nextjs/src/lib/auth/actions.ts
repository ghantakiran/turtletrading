'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// JWT cookie configuration
const TOKEN_COOKIE_NAME = 'turtle_auth_token';
const REFRESH_COOKIE_NAME = 'turtle_refresh_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

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

// Get current session from JWT token in cookies
export async function getSession(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    // Validate token with backend
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Token invalid or expired, clear cookies
      await clearSession();
      return null;
    }

    const userData = await response.json();

    return {
      id: userData.id,
      email: userData.email,
      firstName: userData.full_name?.split(' ')[0] || '',
      lastName: userData.full_name?.split(' ').slice(1).join(' ') || '',
      role: userData.role || 'user',
      subscription: userData.subscription_tier || 'free',
      isVerified: userData.is_active || false,
      createdAt: userData.created_at,
      lastLoginAt: userData.last_login,
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

// Set session cookies after successful login
export async function setSession(accessToken: string, rememberMe: boolean = false) {
  const cookieStore = await cookies();
  const maxAge = rememberMe ? COOKIE_MAX_AGE : undefined;

  cookieStore.set(TOKEN_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

// Clear session cookies
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

// Login action
export async function loginAction(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    // Create form data for OAuth2 password flow
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login failed' }));
      return {
        success: false,
        error: error.detail || 'Invalid email or password',
      };
    }

    const data = await response.json();

    // Set session cookies
    await setSession(data.access_token, credentials.rememberMe);

    // Get user data
    const user = await getSession();

    return {
      success: true,
      user: user || undefined,
      message: 'Login successful',
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

// Register action
export async function registerAction(userData: RegisterData): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        full_name: `${userData.firstName} ${userData.lastName}`,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Registration failed' }));
      return {
        success: false,
        error: error.detail || 'Registration failed',
      };
    }

    const data = await response.json();

    // Auto-login after successful registration
    const loginResult = await loginAction({
      email: userData.email,
      password: userData.password,
      rememberMe: true,
    });

    return {
      success: true,
      user: loginResult.user,
      message: 'Registration successful',
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

// Logout action
export async function logoutAction() {
  await clearSession();
  redirect('/login');
}

// Refresh token action (for future use)
export async function refreshTokenAction(): Promise<AuthResponse> {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

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
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await clearSession();
      return {
        success: false,
        error: 'Token refresh failed',
      };
    }

    const data = await response.json();
    await setSession(data.access_token);

    return {
      success: true,
      message: 'Token refreshed successfully',
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      success: false,
      error: 'Network error during token refresh',
    };
  }
}

// Protected action wrapper
export async function requireAuth<T extends any[]>(
  action: (...args: T) => Promise<any>
): Promise<(...args: T) => Promise<any>> {
  return async (...args: T) => {
    const user = await getSession();
    if (!user) {
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
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      redirect('/login');
    }
    return action(...args);
  };
}
