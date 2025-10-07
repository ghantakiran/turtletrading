'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function APIDocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const codeExamples = {
    python: {
      getPrice: `import requests

# Get stock price
response = requests.get('http://localhost:8000/api/v1/stocks/AAPL/price')
data = response.json()
print(f"Price: ${'$'}{data['current_price']}")`,

      getTechnical: `import requests

# Get technical analysis
response = requests.get('http://localhost:8000/api/v1/stocks/AAPL/technical')
data = response.json()
print(f"RSI: {data['rsi']['value']}")
print(f"Recommendation: {data['recommendation']}")`,

      getLSTM: `import requests

# Get AI predictions
response = requests.get('http://localhost:8000/api/v1/stocks/AAPL/lstm?days=5')
data = response.json()
print(f"Current: ${'$'}{data['current_price']}")
print(f"Predictions: {data['predictions']}")`,
    },
    javascript: {
      getPrice: `// Get stock price
const response = await fetch('http://localhost:8000/api/v1/stocks/AAPL/price');
const data = await response.json();
console.log(\`Price: $\${data.current_price}\`);`,

      getTechnical: `// Get technical analysis
const response = await fetch('http://localhost:8000/api/v1/stocks/AAPL/technical');
const data = await response.json();
console.log(\`RSI: \${data.rsi.value}\`);
console.log(\`Recommendation: \${data.recommendation}\`);`,

      getLSTM: `// Get AI predictions
const response = await fetch('http://localhost:8000/api/v1/stocks/AAPL/lstm?days=5');
const data = await response.json();
console.log(\`Current: $\${data.current_price}\`);
console.log(\`Predictions:\`, data.predictions);`,
    },
    curl: {
      getPrice: `# Get stock price
curl http://localhost:8000/api/v1/stocks/AAPL/price`,

      getTechnical: `# Get technical analysis
curl http://localhost:8000/api/v1/stocks/AAPL/technical`,

      getLSTM: `# Get AI predictions
curl "http://localhost:8000/api/v1/stocks/AAPL/lstm?days=5"`,
    },
  }

  const endpoints = [
    {
      method: 'GET',
      path: '/api/v1/stocks/{symbol}/price',
      description: 'Get current stock price and basic information',
      params: [{ name: 'symbol', type: 'string', description: 'Stock ticker symbol (e.g., AAPL)' }],
    },
    {
      method: 'GET',
      path: '/api/v1/stocks/{symbol}/technical',
      description: 'Get technical analysis with 15+ indicators',
      params: [{ name: 'symbol', type: 'string', description: 'Stock ticker symbol' }],
    },
    {
      method: 'GET',
      path: '/api/v1/stocks/{symbol}/lstm',
      description: 'Get AI-powered price predictions using LSTM models',
      params: [
        { name: 'symbol', type: 'string', description: 'Stock ticker symbol' },
        { name: 'days', type: 'integer', description: 'Prediction horizon (1-90 days)', default: '30' },
      ],
    },
    {
      method: 'GET',
      path: '/api/v1/sentiment/{symbol}',
      description: 'Get sentiment analysis from news and social media',
      params: [{ name: 'symbol', type: 'string', description: 'Stock ticker symbol' }],
    },
    {
      method: 'GET',
      path: '/health',
      description: 'Check API health and service status',
      params: [],
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4">TurtleTrading API Documentation</h1>
          <p className="text-xl mb-8">
            AI-powered stock market analysis API with real-time data, technical indicators, and ML predictions
          </p>
          <div className="flex gap-4">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100"
              onClick={() => window.open('http://localhost:8000/api/docs', '_blank')}
            >
              Interactive API Docs
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              onClick={() => window.open('http://localhost:8000/health', '_blank')}
            >
              API Status
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Quick Start */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Quick Start</CardTitle>
            <CardDescription>Get started with the TurtleTrading API in 3 simple steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold mb-3">
                  1
                </div>
                <h3 className="font-semibold mb-2">Choose Your Language</h3>
                <p className="text-sm text-muted-foreground">
                  Python, JavaScript/Node.js, or simple curl commands
                </p>
              </div>
              <div>
                <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold mb-3">
                  2
                </div>
                <h3 className="font-semibold mb-2">Make Your First Request</h3>
                <p className="text-sm text-muted-foreground">
                  Try our example code snippets below
                </p>
              </div>
              <div>
                <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold mb-3">
                  3
                </div>
                <h3 className="font-semibold mb-2">Build Your App</h3>
                <p className="text-sm text-muted-foreground">
                  Integrate our AI-powered insights into your application
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Code Examples</CardTitle>
            <CardDescription>Copy and paste these examples to get started quickly</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="python" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
              </TabsList>

              {/* Python Examples */}
              <TabsContent value="python" className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get Stock Price</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.python.getPrice, 'py-price')}
                    >
                      {copiedCode === 'py-price' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.python.getPrice}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get Technical Analysis</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.python.getTechnical, 'py-tech')}
                    >
                      {copiedCode === 'py-tech' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.python.getTechnical}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get AI Predictions</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.python.getLSTM, 'py-lstm')}
                    >
                      {copiedCode === 'py-lstm' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.python.getLSTM}</code>
                  </pre>
                </div>
              </TabsContent>

              {/* JavaScript Examples */}
              <TabsContent value="javascript" className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get Stock Price</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.javascript.getPrice, 'js-price')}
                    >
                      {copiedCode === 'js-price' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.javascript.getPrice}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get Technical Analysis</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.javascript.getTechnical, 'js-tech')}
                    >
                      {copiedCode === 'js-tech' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.javascript.getTechnical}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get AI Predictions</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.javascript.getLSTM, 'js-lstm')}
                    >
                      {copiedCode === 'js-lstm' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.javascript.getLSTM}</code>
                  </pre>
                </div>
              </TabsContent>

              {/* cURL Examples */}
              <TabsContent value="curl" className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get Stock Price</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.curl.getPrice, 'curl-price')}
                    >
                      {copiedCode === 'curl-price' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.curl.getPrice}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get Technical Analysis</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.curl.getTechnical, 'curl-tech')}
                    >
                      {copiedCode === 'curl-tech' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.curl.getTechnical}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Get AI Predictions</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(codeExamples.curl.getLSTM, 'curl-lstm')}
                    >
                      {copiedCode === 'curl-lstm' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeExamples.curl.getLSTM}</code>
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* API Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">API Endpoints</CardTitle>
            <CardDescription>Complete list of available endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {endpoints.map((endpoint, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={endpoint.method === 'GET' ? 'default' : 'secondary'}>
                      {endpoint.method}
                    </Badge>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{endpoint.path}</code>
                  </div>
                  <p className="text-sm mb-3">{endpoint.description}</p>
                  {endpoint.params.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Parameters:</p>
                      {endpoint.params.map((param, pidx) => (
                        <div key={pidx} className="text-sm text-muted-foreground ml-4">
                          • <code>{param.name}</code> ({param.type})
                          {param.default && ` - default: ${param.default}`}: {param.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SDK Usage */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">SDK Usage</CardTitle>
            <CardDescription>Use our official TypeScript/JavaScript SDK for easier integration</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="install" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="install">Installation</TabsTrigger>
                <TabsTrigger value="usage">Basic Usage</TabsTrigger>
                <TabsTrigger value="react">React Components</TabsTrigger>
              </TabsList>

              <TabsContent value="install" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Install via npm</h4>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{`npm install @turtletrading/sdk`}</code>
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Or use directly in your project</h4>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{`import { TurtleTradingClient } from '@/sdk'`}</code>
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="usage" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Initialize Client</h4>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{`import { TurtleTradingClient } from '@turtletrading/sdk'

const client = new TurtleTradingClient({
  apiKey: 'your-api-key',
  baseURL: 'http://localhost:8000'
})

// Get stock price
const price = await client.stocks.getPrice('AAPL')
console.log(price.current_price)

// Get AI predictions
const predictions = await client.ai.getPredictions('AAPL', 7)
console.log(predictions.predictions)

// Get sentiment
const sentiment = await client.sentiment.getAnalysis('AAPL')
console.log(sentiment.overall_sentiment)`}</code>
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="react" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Use React Components</h4>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{`import { StockPrice } from '@turtletrading/sdk/components'

function Dashboard() {
  return (
    <StockPrice
      symbol="AAPL"
      apiKey="your-api-key"
      refreshInterval={5000}
    />
  )
}`}</code>
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>✨ Key Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>• 🤖 AI-powered LSTM price predictions</div>
              <div>• 📊 15+ technical indicators (RSI, MACD, Bollinger Bands, etc.)</div>
              <div>• 📰 Real-time sentiment analysis from news & social media</div>
              <div>• ⚡ Fast response times (&lt;200ms)</div>
              <div>• 📈 Real-time market data via WebSocket</div>
              <div>• 🔒 Secure and reliable infrastructure</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📚 Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => window.open('http://localhost:8000/api/docs', '_blank')}
              >
                → Interactive API Documentation (Swagger)
              </Button>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => window.open('http://localhost:8000/api/openapi.json', '_blank')}
              >
                → OpenAPI Schema (JSON)
              </Button>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => window.open('http://localhost:8000/health', '_blank')}
              >
                → API Health Status
              </Button>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => window.open('https://github.com/ghantakiran/turtletrading', '_blank')}
              >
                → GitHub Repository
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
