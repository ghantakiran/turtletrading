import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/actions'
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
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <ErrorBoundary level="page">
      <AppShell user={session}>
        {children}
      </AppShell>
    </ErrorBoundary>
  )
}