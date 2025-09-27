'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Home, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logoutAction } from '@/lib/auth/actions'

interface ProtectedErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ProtectedError({ error, reset }: ProtectedErrorProps) {
  const router = useRouter()

  useEffect(() => {
    // Log the error to monitoring service
    console.error('Protected route error:', error)

    // You could send error to monitoring service here
    // e.g., Sentry, LogRocket, etc.
  }, [error])

  const handleLogout = async () => {
    try {
      await logoutAction()
    } catch (err) {
      console.error('Logout error:', err)
      // Force redirect even if logout fails
      router.push('/login')
    }
  }

  const isAuthError = error.message.includes('auth') ||
                     error.message.includes('token') ||
                     error.message.includes('session') ||
                     error.message.includes('unauthorized')

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-card/50 backdrop-blur-sm border-destructive/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl font-semibold text-foreground">
            {isAuthError ? 'Authentication Error' : 'Something went wrong'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isAuthError
              ? 'Your session has expired or is invalid. Please sign in again.'
              : 'An unexpected error occurred while loading this page.'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center">
          {!isAuthError && (
            <details className="mt-4 text-sm text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition-colors">
                Error details
              </summary>
              <div className="mt-2 p-3 bg-muted/50 rounded-lg text-left font-mono text-xs break-all">
                {error.message}
                {error.digest && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Error ID: {error.digest}
                  </div>
                )}
              </div>
            </details>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2">
          {isAuthError ? (
            <>
              <Button
                onClick={handleLogout}
                className="w-full sm:w-auto"
                variant="outline"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
              <Button
                onClick={() => router.push('/login')}
                className="w-full sm:w-auto"
              >
                Sign In Again
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={reset}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}