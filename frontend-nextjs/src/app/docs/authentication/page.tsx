import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

export default function AuthenticationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Authentication</h1>
        <p className="text-xl text-muted-foreground">
          API authentication and security guide
        </p>
      </div>

      {/* Current Status */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-amber-900 dark:text-amber-100">Development Mode</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-amber-800 dark:text-amber-200">
            The API is currently in development mode and does not require authentication.
            JWT-based authentication will be implemented in a future release (see Issue #2).
          </p>
        </CardContent>
      </Card>

      {/* Future Authentication */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Planned Authentication Flow</h2>
        <Card>
          <CardHeader>
            <CardTitle>JWT Token-Based Authentication</CardTitle>
            <CardDescription>Coming in Phase 2</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Register / Login</h3>
              <p className="text-sm text-muted-foreground mb-2">Obtain access and refresh tokens</p>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <code>POST /api/v1/auth/login</code>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Include Token in Requests</h3>
              <p className="text-sm text-muted-foreground mb-2">Add Authorization header to API calls</p>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <code>Authorization: Bearer {'<'}your-access-token{'>'}</code>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Token Refresh</h3>
              <p className="text-sm text-muted-foreground mb-2">Refresh expired access tokens</p>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <code>POST /api/v1/auth/refresh</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Best Practices */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Security Best Practices</h2>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Secure Token Storage</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Store tokens securely using httpOnly cookies or encrypted local storage. Never expose tokens in URLs or console logs.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">HTTPS Only</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Always use HTTPS in production to encrypt data in transit and protect against man-in-the-middle attacks.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Token Expiration</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Access tokens will expire after 15 minutes. Use refresh tokens to obtain new access tokens without re-authentication.
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Current Development Access */}
      <Card>
        <CardHeader>
          <CardTitle>Current Development Access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            During development, the API is open and does not require authentication:
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm">
              # No authentication required<br/>
              curl http://localhost:8000/api/v1/stocks/AAPL/price
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
