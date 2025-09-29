'use client'

import { SessionProvider as NextAuthSessionProvider, useSession, signIn, signOut } from 'next-auth/react'
import { ReactNode } from 'react'

interface SessionProviderProps {
  children: ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  )
}

// Export NextAuth hooks for authentication
export { useSession, signIn, signOut } from 'next-auth/react'

// Create compatibility hook for existing code
export function useAuth() {
  const { data: session, status } = useSession()

  return {
    user: session?.user || null,
    isAuthenticated: !!session,
    isLoading: status === 'loading',
    login: async (email: string, password: string) => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })
      return !!result && !result.error
    },
    logout: () => signOut({ callbackUrl: '/login' }),
    refreshToken: async () => true // NextAuth handles this automatically
  }
}