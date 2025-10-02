import { Metadata } from 'next'

// Force dynamic rendering for authentication-protected routes
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, TrendingUp, TrendingDown, AlertCircle, LineChart, Sparkles } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI Analysis',
  description: 'AI-powered stock analysis and machine learning insights for trading decisions.',
}

export default function AIAnalysisPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">AI Analysis</h1>
        </div>
        <p className="text-muted-foreground">
          AI-powered stock analysis with LSTM predictions, technical indicators, and machine learning insights.
        </p>
      </div>

      {/* AI Model Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LSTM Model Accuracy</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87.3%</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days prediction accuracy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Predictions</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              Stocks with AI predictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence Level</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">High</div>
            <p className="text-xs text-muted-foreground">
              95% confidence interval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Predictions */}
      <Card>
        <CardHeader>
          <CardTitle>AI Stock Predictions</CardTitle>
          <CardDescription>
            LSTM neural network predictions for trending stocks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/analysis/AAPL" className="block hover:bg-accent rounded-lg p-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-600">AAPL</Badge>
                <div>
                  <div className="font-medium">Apple Inc.</div>
                  <div className="text-sm text-muted-foreground">Technology</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">$175.43</span>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span>+2.3%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">AI: Strong Buy</div>
              </div>
            </div>
          </Link>

          <Link href="/analysis/GOOGL" className="block hover:bg-accent rounded-lg p-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-purple-600">GOOGL</Badge>
                <div>
                  <div className="font-medium">Alphabet Inc.</div>
                  <div className="text-sm text-muted-foreground">Technology</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">$142.65</span>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span>+1.8%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">AI: Buy</div>
              </div>
            </div>
          </Link>

          <Link href="/analysis/MSFT" className="block hover:bg-accent rounded-lg p-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-600">MSFT</Badge>
                <div>
                  <div className="font-medium">Microsoft Corporation</div>
                  <div className="text-sm text-muted-foreground">Technology</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">$378.85</span>
                  <div className="flex items-center text-sm text-red-600">
                    <TrendingDown className="h-4 w-4 mr-1" />
                    <span>-0.5%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">AI: Hold</div>
              </div>
            </div>
          </Link>

          <Link href="/analysis/TSLA" className="block hover:bg-accent rounded-lg p-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-red-600">TSLA</Badge>
                <div>
                  <div className="font-medium">Tesla Inc.</div>
                  <div className="text-sm text-muted-foreground">Automotive</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">$242.84</span>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span>+3.2%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">AI: Buy</div>
              </div>
            </div>
          </Link>

          <Link href="/analysis/NVDA" className="block hover:bg-accent rounded-lg p-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-yellow-600">NVDA</Badge>
                <div>
                  <div className="font-medium">NVIDIA Corporation</div>
                  <div className="text-sm text-muted-foreground">Semiconductors</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">$875.28</span>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span>+4.1%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">AI: Strong Buy</div>
              </div>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Technical Indicators AI</CardTitle>
            <CardDescription>
              Machine learning analysis of technical patterns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">RSI Analysis</span>
              <Badge variant="outline">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">MACD Signals</span>
              <Badge variant="outline">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Moving Average Crossover</span>
              <Badge variant="outline">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Bollinger Bands</span>
              <Badge variant="outline">Active</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>LSTM Model Details</CardTitle>
            <CardDescription>
              Deep learning model configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Model Type</span>
              <span className="text-sm font-medium">LSTM Neural Network</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Training Data</span>
              <span className="text-sm font-medium">5 Years Historical</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Prediction Window</span>
              <span className="text-sm font-medium">30 Days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Last Updated</span>
              <span className="text-sm font-medium">2 hours ago</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
