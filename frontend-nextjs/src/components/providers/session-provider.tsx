'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role?: 'user' | 'admin' | 'pro'
  subscription?: 'free' | 'pro' | 'enterprise'
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  refreshToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Set up automatic token refresh in a separate useEffect
  useEffect(() => {
    if (!user) return

    const refreshInterval = setInterval(() => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        refreshToken()
      }
    }, 14 * 60 * 1000) // Refresh every 14 minutes (tokens expire in 15 minutes)

    return () => clearInterval(refreshInterval)
  }, [user?.id]) // Only re-run when user ID changes (login/logout)

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('auth_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        setUser(data.user)
        return true
      }
      return false
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  const logout = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      setUser(null)
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) return false

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('auth_token', data.access_token)
        return true
      }
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Keep the old name for compatibility during transition
export { AuthProvider as SessionProvider }