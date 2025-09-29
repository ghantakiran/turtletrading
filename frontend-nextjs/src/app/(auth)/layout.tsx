import { Metadata } from 'next'
import { ErrorBoundary } from '@/components/error-boundary'

export const metadata: Metadata = {
  title: {
    template: '%s | TurtleTrading',
    default: 'Sign In | TurtleTrading',
  },
  description: 'Sign in to TurtleTrading to access AI-powered stock analysis and trading insights.',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Authentication disabled - no session checks or redirects

  return (
    <ErrorBoundary level="page">
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md space-y-8">
            {/* Logo and branding */}
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <svg
                  className="h-8 w-8 text-primary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 9.74s9-4.19 9-9.74V7l-10-5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                TurtleTrading
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                AI-powered stock analysis platform
              </p>
            </div>

            {/* Auth forms */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg">
              {children}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground">
              <p>
                © 2024 TurtleTrading. All rights reserved.
              </p>
              <div className="mt-2 space-x-4">
                <a href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
                <a href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}