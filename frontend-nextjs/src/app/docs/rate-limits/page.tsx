import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Clock, Zap } from 'lucide-react'

export default function RateLimitsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Rate Limiting</h1>
        <p className="text-xl text-muted-foreground">
          API request limits and best practices
        </p>
      </div>

      {/* Current Status */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-900 dark:text-blue-100">Development Mode</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-blue-800 dark:text-blue-200">
            Rate limiting is currently disabled in development mode. Production rate limits will be enforced once authentication is implemented.
          </p>
        </CardContent>
      </Card>

      {/* Planned Rate Limits */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Planned Rate Limits</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Free Tier
                </CardTitle>
                <Badge>Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Requests per minute</span>
                <span className="font-semibold">60</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Requests per hour</span>
                <span className="font-semibold">1,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Requests per day</span>
                <span className="font-semibold">10,000</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pro Tier
                </CardTitle>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Requests per minute</span>
                <span className="font-semibold">300</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Requests per hour</span>
                <span className="font-semibold">10,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Requests per day</span>
                <span className="font-semibold">100,000</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Response Headers */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Headers</CardTitle>
          <CardDescription>Included in all API responses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <code className="text-sm bg-muted px-2 py-1 rounded">X-RateLimit-Limit</code>
            <p className="text-sm text-muted-foreground ml-4">
              Maximum number of requests allowed per time window
            </p>
          </div>
          <div className="space-y-2">
            <code className="text-sm bg-muted px-2 py-1 rounded">X-RateLimit-Remaining</code>
            <p className="text-sm text-muted-foreground ml-4">
              Number of requests remaining in current time window
            </p>
          </div>
          <div className="space-y-2">
            <code className="text-sm bg-muted px-2 py-1 rounded">X-RateLimit-Reset</code>
            <p className="text-sm text-muted-foreground ml-4">
              Unix timestamp when the rate limit resets
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Best Practices</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Monitor Rate Limit Headers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Check headers in every response to track remaining requests
              </p>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <code>{`remaining = int(response.headers['X-RateLimit-Remaining'])
if remaining < 10:
    print("Warning: Approaching rate limit")`}</code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Implement Exponential Backoff</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                When you receive a 429 (Too Many Requests) response, wait before retrying. Double the wait time with each retry (1s, 2s, 4s, 8s).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Cache Responses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cache API responses locally to reduce the number of requests. Stock prices can be cached for 1-5 minutes depending on your needs.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Batch Requests When Possible</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Instead of making separate requests for each stock, consider fetching data for multiple symbols in fewer requests when batch endpoints are available.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 429 Response Example */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Exceeded Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm overflow-x-auto">{`HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1696435200

{
  "detail": "Rate limit exceeded. Try again in 45 seconds.",
  "status_code": 429
}`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
