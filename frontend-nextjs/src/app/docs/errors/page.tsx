import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function ErrorsPage() {
  const errorCodes = [
    { code: 400, name: 'Bad Request', description: 'Invalid request parameters or malformed JSON' },
    { code: 404, name: 'Not Found', description: 'Stock symbol not found or endpoint does not exist' },
    { code: 429, name: 'Too Many Requests', description: 'Rate limit exceeded (see Rate Limiting)' },
    { code: 500, name: 'Internal Server Error', description: 'Server error, please try again later' },
    { code: 503, name: 'Service Unavailable', description: 'External data provider temporarily unavailable' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Error Handling</h1>
        <p className="text-xl text-muted-foreground">
          Understanding API errors and how to handle them
        </p>
      </div>

      {/* Error Response Format */}
      <Card>
        <CardHeader>
          <CardTitle>Error Response Format</CardTitle>
          <CardDescription>All errors follow a consistent JSON structure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm overflow-x-auto">{`{
  "detail": "Stock symbol 'INVALID' not found",
  "status_code": 404,
  "timestamp": "2025-10-04T12:00:00Z"
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* HTTP Status Codes */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">HTTP Status Codes</h2>
        <div className="space-y-3">
          {errorCodes.map((error) => (
            <Card key={error.code}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{error.name}</CardTitle>
                  <Badge variant={error.code >= 500 ? 'destructive' : 'secondary'}>
                    {error.code}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{error.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Common Error Scenarios */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Common Error Scenarios</h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invalid Stock Symbol</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="bg-muted p-3 rounded-lg">
              <code className="text-sm text-red-600">GET /api/v1/stocks/INVALID/price</code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <pre className="text-sm">{`{"detail": "Stock symbol 'INVALID' not found", "status_code": 404}`}</pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invalid Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="bg-muted p-3 rounded-lg">
              <code className="text-sm text-red-600">GET /api/v1/stocks/AAPL/lstm?days=invalid</code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <pre className="text-sm">{`{"detail": "days must be an integer between 1 and 90", "status_code": 400}`}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Handling Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Error Handling Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">1. Always Check Status Codes</h3>
            <div className="bg-muted p-3 rounded-lg text-sm">
              <code>{`if response.status_code != 200:
    print(f"Error: {response.json()['detail']}")`}</code>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">2. Implement Retry Logic</h3>
            <p className="text-sm text-muted-foreground">
              For 503 errors, implement exponential backoff retry logic (wait 1s, 2s, 4s, etc.)
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">3. Log Errors for Debugging</h3>
            <p className="text-sm text-muted-foreground">
              Include timestamp, endpoint, parameters, and error details in logs
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
