'use server';

// Authentication is completely disabled for core app testing
// This file provides no-op implementations for compatibility

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

// JWT utilities - DISABLED
export async function createJWT(payload: any, expiresIn: number): Promise<string> {
  // Authentication disabled - return empty token
  return '';
}

export async function verifyJWT(token: string): Promise<any> {
  // Authentication disabled - return null
  return null;
}

// Session management - DISABLED FOR CORE APP TESTING
export async function getSession(): Promise<User | null> {
  // Authentication is temporarily disabled for core app testing
  return null;
}

export async function setSession(user: User, accessToken: string, refreshToken: string) {
  // Authentication disabled - no-op
  return;
}

export async function clearSession() {
  // Authentication disabled - no-op
  return;
}

// Authentication actions - ALL DISABLED
export async function loginAction(
  credentials: LoginCredentials
): Promise<AuthResponse> {
  // Authentication disabled - return error
  return {
    success: false,
    error: 'Authentication is temporarily disabled for core app testing',
  };
}

export async function registerAction(
  userData: RegisterData
): Promise<AuthResponse> {
  // Authentication disabled - return error
  return {
    success: false,
    error: 'Registration is temporarily disabled for core app testing',
  };
}

export async function logoutAction() {
  // Authentication disabled - no-op, no redirect
  return;
}

export async function refreshTokenAction(): Promise<AuthResponse> {
  // Authentication disabled - return error
  return {
    success: false,
    error: 'Token refresh is disabled - authentication is temporarily disabled',
  };
}

// Protected action wrapper - DISABLED
export async function requireAuth<T extends any[]>(
  action: (...args: T) => Promise<any>
): Promise<(...args: T) => Promise<any>> {
  return async (...args: T) => {
    // Authentication disabled - just run the action without protection
    return action(...args);
  };
}

// Admin-only action wrapper - DISABLED
export async function requireAdmin<T extends any[]>(
  action: (...args: T) => Promise<any>
): Promise<(...args: T) => Promise<any>> {
  return async (...args: T) => {
    // Authentication disabled - just run the action without protection
    return action(...args);
  };
}