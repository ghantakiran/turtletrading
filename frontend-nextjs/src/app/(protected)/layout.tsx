import { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { ErrorBoundary } from '@/components/error-boundary'

export const metadata: Metadata = {
  title: {
    template: '%s | TurtleTrading Pro',
    default: 'TurtleTrading Pro - Advanced Stock Analysis',
  },
  description: 'Advanced stock analysis with AI predictions, technical indicators, and real-time sentiment analysis.',
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Authentication temporarily disabled for core app testing
  const mockUser = {
    id: '1',
    email: 'demo@turtletrading.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'user' as const,
    subscription: 'free' as const,
    isVerified: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  }

  return (
    <ErrorBoundary level="page">
      <AppShell user={mockUser}>
        {children}
      </AppShell>
    </ErrorBoundary>
  )
}