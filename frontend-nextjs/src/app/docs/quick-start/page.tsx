'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Copy, Terminal } from 'lucide-react'

export default function QuickStartPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const installCode = `pip install requests`
  const exampleCode = `import requests

# Initialize the API client
BASE_URL = "http://localhost:8000"

# Get stock price
def get_stock_price(symbol):
    response = requests.get(f"{BASE_URL}/api/v1/stocks/{symbol}/price")
    return response.json()

# Example usage
price_data = get_stock_price("AAPL")
print(f"Current Price: ${'$'}{price_data['current_price']}")
print(f"Change: {price_data['change_percent']:.2f}%")`

  const quickExample = `# Quick example - Get technical analysis
response = requests.get(f"{BASE_URL}/api/v1/stocks/AAPL/technical")
data = response.json()

print(f"RSI: {data['rsi']['value']:.2f}")
print(f"Signal: {data['rsi']['signal']}")
print(f"Recommendation: {data['recommendation']}")`

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Quick Start Guide</h1>
        <p className="text-xl text-muted-foreground">
          Get up and running with the TurtleTrading API in minutes
        </p>
      </div>

      {/* Prerequisites */}
      <Card>
        <CardHeader>
          <CardTitle>Prerequisites</CardTitle>
          <CardDescription>What you need before starting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Python 3.8+</p>
              <p className="text-sm text-muted-foreground">
                Or Node.js 16+ for JavaScript/TypeScript
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">HTTP Client</p>
              <p className="text-sm text-muted-foreground">
                requests (Python), fetch (JavaScript), or curl (CLI)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">API Access</p>
              <p className="text-sm text-muted-foreground">
                API is currently open for development (authentication coming soon)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">1. Installation</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Install HTTP Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code className="text-sm">{installCode}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyCode(installCode, 'install')}
              >
                {copiedId === 'install' ? 'Copied!' : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your First Request */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">2. Your First Request</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Example</CardTitle>
            <CardDescription>
              Make your first API call to get stock price data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code className="text-sm whitespace-pre">{exampleCode}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyCode(exampleCode, 'example')}
              >
                {copiedId === 'example' ? 'Copied!' : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Examples */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">3. Try More Features</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Technical Analysis</CardTitle>
            <CardDescription>
              Get AI-powered technical indicators and trading signals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code className="text-sm whitespace-pre">{quickExample}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyCode(quickExample, 'quick')}
              >
                {copiedId === 'quick' ? 'Copied!' : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Endpoints */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Available Endpoints</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Stock Price</CardTitle>
                <Badge>GET</Badge>
              </div>
              <CardDescription>/api/v1/stocks/{'{symbol}'}/price</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Real-time stock prices, changes, and market data
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Technical Analysis</CardTitle>
                <Badge>GET</Badge>
              </div>
              <CardDescription>/api/v1/stocks/{'{symbol}'}/technical</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                15+ indicators, signals, and AI recommendations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">AI Predictions</CardTitle>
                <Badge>GET</Badge>
              </div>
              <CardDescription>/api/v1/stocks/{'{symbol}'}/lstm</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                LSTM neural network price predictions (1-90 days)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Sentiment Analysis</CardTitle>
                <Badge>GET</Badge>
              </div>
              <CardDescription>/api/v1/sentiment/{'{symbol}'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Market sentiment from news and social media sources
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Next Steps */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Explore the full <a href="/docs" className="text-primary hover:underline">API Reference</a></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Learn about <a href="/docs/errors" className="text-primary hover:underline">Error Handling</a></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Check out <a href="/docs/schemas" className="text-primary hover:underline">Data Models</a></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Try the <a href="/api/docs" target="_blank" className="text-primary hover:underline">Interactive API Docs</a></span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
