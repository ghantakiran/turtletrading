import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'pro';
  isVerified: boolean;
  subscription: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthState {
  // Authentication state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Tokens
  accessToken: string | null;
  refreshToken: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state - Authentication disabled
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      accessToken: null,
      refreshToken: null,

      // Disabled login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        // Simulate a brief loading state, then show authentication disabled message
        setTimeout(() => {
          set({
            error: 'Authentication is temporarily disabled for core app testing',
            isLoading: false,
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null
          });
        }, 1000);
      },

      // Disabled logout action
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          error: null,
          isLoading: false
        });

        // Clear any stored tokens
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage');
        }
      },

      // Disabled register action
      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });

        // Simulate a brief loading state, then show authentication disabled message
        setTimeout(() => {
          set({
            error: 'Registration is temporarily disabled for core app testing',
            isLoading: false
          });
        }, 1000);
      },

      // Disabled refresh authentication
      refreshAuth: async () => {
        // No-op when authentication is disabled
        return;
      },

      // Update user data
      updateUser: (updates: Partial<User>) => {
        // No-op when authentication is disabled
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Set loading state
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist user data and tokens, not loading states
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

export default useAuthStore;