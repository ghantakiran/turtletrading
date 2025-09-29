'use client'

import { ReactNode } from 'react'
import { useAuthStore } from '@/stores'

interface SessionProviderProps {
  children: ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  // Authentication is disabled - just pass through children
  return <>{children}</>
}

// Disabled authentication hooks for compatibility
export function useSession() {
  return {
    data: null,
    status: 'unauthenticated' as const
  }
}

export function signIn() {
  console.log('Authentication is temporarily disabled')
}

export function signOut() {
  console.log('Authentication is temporarily disabled')
}

// Create compatibility hook for existing code
export function useAuth() {
  const authStore = useAuthStore()

  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: authStore.login,
    logout: authStore.logout,
    refreshToken: async () => true
  }
}