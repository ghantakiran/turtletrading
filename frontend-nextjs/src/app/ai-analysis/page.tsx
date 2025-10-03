import { Metadata } from 'next'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Brain, TrendingUp, TrendingDown, AlertCircle, LineChart, Sparkles, Target, Activity } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI Analysis | TurtleTrading',
  description: 'AI-powered market analysis with LSTM predictions and machine learning insights.',
}

export default function AIAnalysisPage() {
  // Mock data for AI analysis
  const lstmStats = {
    accuracy: 87.3,
    activePredictions: 24,
    confidenceLevel: 'High',
    lastUpdated: '2 hours ago'
  }

  const topPredictions = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      price: 175.43,
      change: 2.3,
      signal: 'STRONG_BUY',
      confidence: 89
    },
    {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      sector: 'Semiconductors',
      price: 875.28,
      change: 4.1,
      signal: 'STRONG_BUY',
      confidence: 92
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      sector: 'Technology',
      price: 142.65,
      change: 1.8,
      signal: 'BUY',
      confidence: 78
    },
    {
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      sector: 'Automotive',
      price: 242.84,
      change: 3.2,
      signal: 'BUY',
      confidence: 75
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      sector: 'Technology',
      price: 378.85,
      change: -0.5,
      signal: 'HOLD',
      confidence: 71
    }
  ]

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'STRONG_BUY':
        return 'bg-green-600 hover:bg-green-700'
      case 'BUY':
        return 'bg-green-500 hover:bg-green-600'
      case 'HOLD':
        return 'bg-yellow-500 hover:bg-yellow-600'
      case 'SELL':
        return 'bg-orange-500 hover:bg-orange-600'
      case 'STRONG_SELL':
        return 'bg-red-600 hover:bg-red-700'
      default:
        return 'bg-gray-500 hover:bg-gray-600'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Brain className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold">AI Analysis</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            AI-powered market analysis with LSTM neural network predictions and machine learning insights
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* LSTM Model Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Accuracy</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{lstmStats.accuracy}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 30 days predictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Predictions</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{lstmStats.activePredictions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Stocks with AI signals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence Level</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{lstmStats.confidenceLevel}</div>
            <p className="text-xs text-muted-foreground mt-1">
              95% confidence interval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Live</div>
            <p className="text-xs text-muted-foreground mt-1">
              {lstmStats.lastUpdated}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top AI Predictions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Top AI Predictions</CardTitle>
              <CardDescription className="mt-1">
                LSTM neural network recommendations based on technical analysis and market trends
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              Updated Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {topPredictions.map((prediction) => {
            const isPositive = prediction.change >= 0

            return (
              <Link
                key={prediction.symbol}
                href={`/analysis/${prediction.symbol}`}
                className="block"
              >
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Stock Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <Badge className="text-base font-bold px-3 py-1.5 bg-blue-600">
                          {prediction.symbol}
                        </Badge>
                        <div className="flex-1">
                          <div className="font-semibold text-base">{prediction.name}</div>
                          <div className="text-sm text-muted-foreground">{prediction.sector}</div>
                        </div>
                      </div>

                      {/* Center: Price & Change */}
                      <div className="text-right">
                        <div className="font-semibold text-lg">${prediction.price.toFixed(2)}</div>
                        <div className={`flex items-center gap-1 text-sm ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isPositive ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>{isPositive ? '+' : ''}{prediction.change.toFixed(2)}%</span>
                        </div>
                      </div>

                      {/* Right: AI Signal */}
                      <div className="text-right">
                        <Badge className={`${getSignalColor(prediction.signal)} text-white font-semibold px-3 py-1`}>
                          {prediction.signal.replace('_', ' ')}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {prediction.confidence}% confidence
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      {/* AI Model Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              LSTM Model Details
            </CardTitle>
            <CardDescription>
              Deep learning neural network configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Model Type</span>
              <span className="text-sm">LSTM Neural Network</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Training Data</span>
              <span className="text-sm">5 Years Historical</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Prediction Window</span>
              <span className="text-sm">30 Days Forward</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Update Frequency</span>
              <span className="text-sm">Real-time</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">Features Used</span>
              <span className="text-sm">15+ Indicators</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Technical Indicators
            </CardTitle>
            <CardDescription>
              Active machine learning indicators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">RSI Analysis</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-600">Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">MACD Signals</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-600">Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Moving Averages</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-600">Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Bollinger Bands</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-600">Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">Volume Analysis</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-600">Active</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Market Overview
          </CardTitle>
          <CardDescription>
            AI-powered market sentiment and analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Overall Sentiment</div>
              <div className="text-2xl font-bold text-green-600">Bullish</div>
              <div className="text-xs text-muted-foreground mt-1">Based on 24 predictions</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Trending Sector</div>
              <div className="text-2xl font-bold text-blue-600">Technology</div>
              <div className="text-xs text-muted-foreground mt-1">Strongest AI signals</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Risk Level</div>
              <div className="text-2xl font-bold text-yellow-600">Moderate</div>
              <div className="text-xs text-muted-foreground mt-1">Market volatility</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
