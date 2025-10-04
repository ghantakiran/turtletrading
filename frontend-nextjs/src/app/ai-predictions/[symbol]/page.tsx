'use client'

import React, { use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Brain, TrendingUp, Sparkles } from 'lucide-react'
import LSTMPredictions from '@/components/LSTMPredictions'
import Link from 'next/link'

interface PageProps {
  params: Promise<{
    symbol: string
  }>
}

export default function AIPredictionsPage({ params }: PageProps) {
  const { symbol } = use(params)
  const router = useRouter()
  const upperSymbol = symbol.toUpperCase()

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{upperSymbol}</h1>
              <Badge variant="secondary" className="gap-1">
                <Brain className="h-3 w-3" />
                AI Predictions
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Advanced LSTM neural network price forecasts
            </p>
          </div>
        </div>

        <Link href={`/stock/${upperSymbol}`}>
          <Button variant="outline">
            View Full Analysis
          </Button>
        </Link>
      </div>

      {/* Feature Overview */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Price Predictions
          </CardTitle>
          <CardDescription>
            Our LSTM (Long Short-Term Memory) neural network analyzes historical price patterns,
            market trends, and volatility to generate price forecasts with confidence intervals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Neural Network</p>
                <p className="text-sm text-muted-foreground">
                  Advanced LSTM architecture trained on historical data
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Multiple Time Horizons</p>
                <p className="text-sm text-muted-foreground">
                  Forecasts from 7 to 90 days ahead
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Confidence Intervals</p>
                <p className="text-sm text-muted-foreground">
                  Upper and lower bounds for each prediction
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LSTM Predictions Component */}
      <LSTMPredictions symbol={upperSymbol} initialDays={30} />

      {/* Methodology */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>Understanding our AI prediction methodology</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">1. Data Collection</h3>
            <p className="text-sm text-muted-foreground">
              We collect historical price data, trading volumes, and market indicators for comprehensive analysis.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">2. Neural Network Processing</h3>
            <p className="text-sm text-muted-foreground">
              Our LSTM model processes sequential patterns in the data to identify trends and relationships
              that inform price predictions.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">3. Prediction Generation</h3>
            <p className="text-sm text-muted-foreground">
              The model generates price forecasts with confidence intervals based on historical volatility
              and pattern recognition.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">4. Continuous Learning</h3>
            <p className="text-sm text-muted-foreground">
              The model is regularly retrained with new data to maintain accuracy and adapt to changing
              market conditions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-amber-600 dark:text-amber-500">Important Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            AI predictions are probabilistic forecasts based on historical data and should not be considered
            as financial advice or guarantees of future performance.
          </p>
          <p>
            Stock markets are influenced by numerous factors including economic events, company news, and
            market sentiment that may not be fully captured by historical patterns.
          </p>
          <p className="font-medium">
            Always conduct your own research and consult with a financial advisor before making investment decisions.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
