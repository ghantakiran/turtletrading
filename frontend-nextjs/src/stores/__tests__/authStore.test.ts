/**
 * Authentication Store Unit Tests
 * 100% coverage for Zustand authentication state management
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { useAuthStore } from '../authStore'

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock fetch for API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  log: jest.spyOn(console, 'log').mockImplementation(),
}

describe('Authentication Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useAuthStore.getState().logout()
    })

    // Clear localStorage mock
    mockLocalStorage.clear()

    // Clear all mocks
    jest.clearAllMocks()

    // Reset fetch mock
    mockFetch.mockReset()
  })

  afterAll(() => {
    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore())
  })

  describe('Initial State', () => {
    it('should initialize with unauthenticated state', () => {
      const { result } = renderHook(() => useAuthStore())
      const state = result.current

      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastActivity).toBeNull()
      expect(state.sessionExpiry).toBeNull()
    })

    it('should restore session from localStorage on initialization', () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        subscription: 'free' as const,
        preferences: {
          theme: 'light' as const,
          notifications: true,
          currency: 'USD',
          timezone: 'America/New_York'
        }
      }
      const mockTokens = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600
      }

      // Simulate existing session in localStorage
      mockLocalStorage.setItem('auth_token', mockTokens.access_token)
      mockLocalStorage.setItem('refresh_token', mockTokens.refresh_token)
      mockLocalStorage.setItem('user_data', JSON.stringify(mockUser))

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.initializeAuth()
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.token).toBe(mockTokens.access_token)
      expect(result.current.refreshToken).toBe(mockTokens.refresh_token)
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('Login Functionality', () => {
    it('should handle user login with JWT tokens', async () => {
      const { result } = renderHook(() => useAuthStore())
      const mockResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user' as const,
          subscription: 'free' as const,
          preferences: {
            theme: 'light' as const,
            notifications: true,
            currency: 'USD',
            timezone: 'America/New_York'
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockResponse.user)
      expect(result.current.token).toBe(mockResponse.access_token)
      expect(result.current.refreshToken).toBe(mockResponse.refresh_token)
      expect(result.current.error).toBeNull()

      // Verify localStorage calls
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', mockResponse.access_token)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refresh_token', mockResponse.refresh_token)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user_data', JSON.stringify(mockResponse.user))
    })

    it('should handle login errors gracefully', async () => {
      const { result } = renderHook(() => useAuthStore())
      const mockError = {
        detail: 'Invalid credentials'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
        status: 401
      })

      await act(async () => {
        await result.current.login('invalid@example.com', 'wrongpassword')
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
      expect(result.current.error).toBe('Invalid credentials')
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle network errors during login', async () => {
      const { result } = renderHook(() => useAuthStore())

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBe('Network error occurred')
      expect(result.current.isLoading).toBe(false)
    })

    it('should set loading state during login', async () => {
      const { result } = renderHook(() => useAuthStore())

      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            user: { id: '1', email: 'test@example.com', name: 'Test' }
          })
        }), 100))
      )

      const loginPromise = act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      // Check loading state immediately after starting login
      expect(result.current.isLoading).toBe(true)

      await loginPromise

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Registration Functionality', () => {
    it('should handle user registration', async () => {
      const { result } = renderHook(() => useAuthStore())
      const mockResponse = {
        message: 'User created successfully',
        user: {
          id: 'user-1',
          email: 'newuser@example.com',
          name: 'New User',
          role: 'user' as const,
          subscription: 'free' as const
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 201
      })

      let result_value: any
      await act(async () => {
        result_value = await result.current.register({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User'
        })
      })

      expect(result_value).toBe(true)
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle registration errors', async () => {
      const { result } = renderHook(() => useAuthStore())
      const mockError = {
        detail: 'Email already exists'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
        status: 400
      })

      let result_value: any
      await act(async () => {
        result_value = await result.current.register({
          email: 'existing@example.com',
          password: 'password123',
          name: 'Existing User'
        })
      })

      expect(result_value).toBe(false)
      expect(result.current.error).toBe('Email already exists')
    })
  })

  describe('Token Management', () => {
    it('should manage token refresh automatically', async () => {
      const { result } = renderHook(() => useAuthStore())
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      }

      // Set initial auth state
      act(() => {
        result.current.setAuthData({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            subscription: 'free',
            preferences: {
              theme: 'light',
              notifications: true,
              currency: 'USD',
              timezone: 'America/New_York'
            }
          },
          token: 'old-token',
          refreshToken: 'old-refresh-token'
        })
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse,
        status: 200
      })

      let result_value: any
      await act(async () => {
        result_value = await result.current.refreshAccessToken()
      })

      expect(result_value).toBe(true)
      expect(result.current.token).toBe(mockRefreshResponse.access_token)
      expect(result.current.refreshToken).toBe(mockRefreshResponse.refresh_token)
    })

    it('should handle refresh token failure', async () => {
      const { result } = renderHook(() => useAuthStore())

      // Set initial auth state
      act(() => {
        result.current.setAuthData({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            subscription: 'free'
          },
          token: 'old-token',
          refreshToken: 'invalid-refresh-token'
        })
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Invalid refresh token' }),
        status: 401
      })

      let result_value: any
      await act(async () => {
        result_value = await result.current.refreshAccessToken()
      })

      expect(result_value).toBe(false)
      // Should logout user when refresh fails
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
    })

    it('should check token expiration', () => {
      const { result } = renderHook(() => useAuthStore())

      // Test with no session expiry
      expect(result.current.isTokenExpired()).toBe(true)

      // Set future expiry
      const futureExpiry = new Date(Date.now() + 3600000) // 1 hour from now
      act(() => {
        result.current.setSessionExpiry(futureExpiry)
      })
      expect(result.current.isTokenExpired()).toBe(false)

      // Set past expiry
      const pastExpiry = new Date(Date.now() - 3600000) // 1 hour ago
      act(() => {
        result.current.setSessionExpiry(pastExpiry)
      })
      expect(result.current.isTokenExpired()).toBe(true)
    })
  })

  describe('Logout Functionality', () => {
    it('should clear sensitive data on logout', () => {
      const { result } = renderHook(() => useAuthStore())

      // Set authenticated state
      act(() => {
        result.current.setAuthData({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            subscription: 'free'
          },
          token: 'access-token',
          refreshToken: 'refresh-token'
        })
      })

      expect(result.current.isAuthenticated).toBe(true)

      act(() => {
        result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
      expect(result.current.refreshToken).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.sessionExpiry).toBeNull()

      // Verify localStorage cleanup
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refresh_token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user_data')
    })
  })

  describe('User Profile Management', () => {
    it('should update user profile', async () => {
      const { result } = renderHook(() => useAuthStore())
      const updatedUser = {
        id: 'user-1',
        email: 'updated@example.com',
        name: 'Updated User',
        role: 'user' as const,
        subscription: 'pro' as const,
        preferences: {
          theme: 'dark' as const,
          notifications: false,
          currency: 'EUR',
          timezone: 'Europe/London'
        }
      }

      // Set initial auth state
      act(() => {
        result.current.setAuthData({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            subscription: 'free'
          },
          token: 'access-token',
          refreshToken: 'refresh-token'
        })
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: updatedUser }),
        status: 200
      })

      let result_value: any
      await act(async () => {
        result_value = await result.current.updateProfile({
          name: 'Updated User',
          email: 'updated@example.com'
        })
      })

      expect(result_value).toBe(true)
      expect(result.current.user).toEqual(updatedUser)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user_data', JSON.stringify(updatedUser))
    })

    it('should update user preferences', () => {
      const { result } = renderHook(() => useAuthStore())

      // Set initial user
      act(() => {
        result.current.setAuthData({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            subscription: 'free',
            preferences: {
              theme: 'light',
              notifications: true,
              currency: 'USD',
              timezone: 'America/New_York'
            }
          },
          token: 'access-token',
          refreshToken: 'refresh-token'
        })
      })

      const newPreferences = {
        theme: 'dark' as const,
        notifications: false,
        currency: 'EUR',
        timezone: 'Europe/London'
      }

      act(() => {
        result.current.updateUserPreferences(newPreferences)
      })

      expect(result.current.user?.preferences).toEqual(newPreferences)
    })
  })

  describe('Session Management', () => {
    it('should persist authentication across sessions', () => {
      const { result } = renderHook(() => useAuthStore())
      const userData = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        subscription: 'free' as const
      }

      act(() => {
        result.current.setAuthData({
          user: userData,
          token: 'access-token',
          refreshToken: 'refresh-token'
        })
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'access-token')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refresh_token', 'refresh-token')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user_data', JSON.stringify(userData))
    })

    it('should track last activity', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.updateLastActivity()
      })

      expect(result.current.lastActivity).not.toBeNull()
      expect(result.current.lastActivity).toBeInstanceOf(Date)
    })

    it('should handle authentication errors', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setError('Authentication failed')
      })

      expect(result.current.error).toBe('Authentication failed')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('Role and Subscription Management', () => {
    it('should check user permissions and roles', () => {
      const { result } = renderHook(() => useAuthStore())

      // Test unauthenticated user
      expect(result.current.hasRole('admin')).toBe(false)
      expect(result.current.hasSubscription('pro')).toBe(false)

      // Set admin user
      act(() => {
        result.current.setAuthData({
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin',
            subscription: 'enterprise'
          },
          token: 'admin-token',
          refreshToken: 'admin-refresh'
        })
      })

      expect(result.current.hasRole('admin')).toBe(true)
      expect(result.current.hasRole('user')).toBe(false)
      expect(result.current.hasSubscription('enterprise')).toBe(true)
      expect(result.current.hasSubscription('pro')).toBe(false)
    })

    it('should validate subscription tiers', () => {
      const { result } = renderHook(() => useAuthStore())

      // Free user
      act(() => {
        result.current.setAuthData({
          user: {
            id: 'user-1',
            email: 'free@example.com',
            name: 'Free User',
            role: 'user',
            subscription: 'free'
          },
          token: 'token',
          refreshToken: 'refresh'
        })
      })

      expect(result.current.canAccessFeature('basic_charts')).toBe(true)
      expect(result.current.canAccessFeature('advanced_analytics')).toBe(false)
      expect(result.current.canAccessFeature('real_time_data')).toBe(false)

      // Pro user
      act(() => {
        result.current.updateUserSubscription('pro')
      })

      expect(result.current.canAccessFeature('basic_charts')).toBe(true)
      expect(result.current.canAccessFeature('advanced_analytics')).toBe(true)
      expect(result.current.canAccessFeature('real_time_data')).toBe(false)

      // Enterprise user
      act(() => {
        result.current.updateUserSubscription('enterprise')
      })

      expect(result.current.canAccessFeature('basic_charts')).toBe(true)
      expect(result.current.canAccessFeature('advanced_analytics')).toBe(true)
      expect(result.current.canAccessFeature('real_time_data')).toBe(true)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed localStorage data', () => {
      const { result } = renderHook(() => useAuthStore())

      // Set malformed data
      mockLocalStorage.setItem('user_data', 'invalid-json')
      mockLocalStorage.setItem('auth_token', 'valid-token')

      act(() => {
        result.current.initializeAuth()
      })

      // Should not crash and should remain unauthenticated
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    it('should handle missing localStorage data', () => {
      const { result } = renderHook(() => useAuthStore())

      // localStorage returns null
      mockLocalStorage.getItem.mockReturnValue(null)

      act(() => {
        result.current.initializeAuth()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    it('should handle concurrent login attempts', async () => {
      const { result } = renderHook(() => useAuthStore())

      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            user: { id: '1', email: 'test@example.com', name: 'Test' }
          })
        }), 100))
      )

      // Start two concurrent login attempts
      const login1 = act(async () => {
        await result.current.login('test1@example.com', 'password')
      })

      const login2 = act(async () => {
        await result.current.login('test2@example.com', 'password')
      })

      await Promise.all([login1, login2])

      // Should handle gracefully without crashes
      expect(result.current.isAuthenticated).toBe(true)
    })
  })
})