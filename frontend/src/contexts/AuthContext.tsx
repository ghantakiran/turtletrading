import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthTokens } from '@/types';
import { authService } from '@/services/authService';
import { apiClient } from '@/services/apiClient';

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: { email: string; password: string; full_name: string }) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'turtletrading-tokens';
const USER_STORAGE_KEY = 'turtletrading-user';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = Boolean(user && tokens);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);

        if (storedTokens && storedUser) {
          const parsedTokens: AuthTokens = JSON.parse(storedTokens);
          const parsedUser: User = JSON.parse(storedUser);

          // Check if token is expired
          const now = Date.now() / 1000;
          const tokenExp = parseJWT(parsedTokens.access_token)?.exp;

          if (tokenExp && tokenExp > now) {
            setTokens(parsedTokens);
            setUser(parsedUser);
            
            // Set the authorization header for API requests
            apiClient.setAuthToken(parsedTokens.access_token);
            
            // Try to refresh user data
            try {
              const currentUser = await authService.getCurrentUser();
              setUser(currentUser);
              localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
            } catch (error) {
              console.warn('Failed to refresh user data:', error);
              // Keep using stored user data if refresh fails
            }
          } else {
            // Token expired, clear storage
            clearAuthData();
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Set up token refresh timer
  useEffect(() => {
    if (!tokens) return;

    const tokenExp = parseJWT(tokens.access_token)?.exp;
    if (!tokenExp) return;

    const now = Date.now() / 1000;
    const timeUntilExpiry = tokenExp - now;
    const refreshTime = timeUntilExpiry - 300; // Refresh 5 minutes before expiry

    if (refreshTime > 0) {
      const timer = setTimeout(async () => {
        try {
          // In a real app, you'd call a refresh token endpoint
          console.log('Token refresh would happen here');
        } catch (error) {
          console.error('Token refresh failed:', error);
          logout();
        }
      }, refreshTime * 1000);

      return () => clearTimeout(timer);
    }
  }, [tokens]);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const authData = await authService.login(email, password);
      
      setTokens(authData.tokens);
      setUser(authData.user);
      
      // Store in localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authData.tokens));
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authData.user));
      
      // Set the authorization header
      apiClient.setAuthToken(authData.tokens.access_token);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: { email: string; password: string; full_name: string }) => {
    try {
      setIsLoading(true);
      const authData = await authService.register(userData);
      
      setTokens(authData.tokens);
      setUser(authData.user);
      
      // Store in localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authData.tokens));
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authData.user));
      
      // Set the authorization header
      apiClient.setAuthToken(authData.tokens.access_token);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuthData();
    setUser(null);
    setTokens(null);
    
    // Clear the authorization header
    apiClient.clearAuthToken();
    
    // Optionally call logout endpoint
    try {
      authService.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;

    try {
      const updatedUser = await authService.updateUser(userData);
      setUser(updatedUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    } catch (error) {
      throw error;
    }
  };

  const clearAuthData = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  const value: AuthContextType = {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// Helper function to parse JWT token
function parseJWT(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}