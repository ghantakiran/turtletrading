import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | TurtleTrading Pro',
    default: 'TurtleTrading Pro - Advanced Stock Analysis',
  },
  description: 'Advanced stock analysis with AI predictions, technical indicators, and real-time sentiment analysis.',
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Authentication completely disabled - render children directly
  return <>{children}</>
}