'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, TrendingUp, TrendingDown, Zap, Clock } from 'lucide-react'
import Link from 'next/link'

interface AIInsight {
  symbol: string
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'
  confidence: number
  prediction: string
  currentPrice: number
  targetPrice: number
  change: number
}

interface AIInsightsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AIInsightsModal({ open, onOpenChange }: AIInsightsModalProps) {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('')

  useEffect(() => {
    if (open) {
      // Simulate AI insights data
      // In production, this would fetch from API
      const mockInsights: AIInsight[] = [
        {
          symbol: 'AAPL',
          recommendation: 'STRONG_BUY',
          confidence: 87,
          prediction: 'Bullish trend expected',
          currentPrice: 175.43,
          targetPrice: 195.00,
          change: 2.3
        },
        {
          symbol: 'NVDA',
          recommendation: 'STRONG_BUY',
          confidence: 92,
          prediction: 'Strong AI sector momentum',
          currentPrice: 875.28,
          targetPrice: 950.00,
          change: 4.1
        },
        {
          symbol: 'GOOGL',
          recommendation: 'BUY',
          confidence: 78,
          prediction: 'Positive earnings outlook',
          currentPrice: 142.65,
          targetPrice: 155.00,
          change: 1.8
        },
        {
          symbol: 'TSLA',
          recommendation: 'BUY',
          confidence: 73,
          prediction: 'Recovery pattern forming',
          currentPrice: 242.84,
          targetPrice: 265.00,
          change: 3.2
        },
        {
          symbol: 'MSFT',
          recommendation: 'HOLD',
          confidence: 65,
          prediction: 'Consolidation phase',
          currentPrice: 378.85,
          targetPrice: 385.00,
          change: -0.5
        }
      ]

      setInsights(mockInsights)
      setLastUpdated(new Date().toLocaleTimeString())
    }
  }, [open])

  const getRecommendationColor = (recommendation: AIInsight['recommendation']) => {
    switch (recommendation) {
      case 'STRONG_BUY':
        return 'bg-green-600 text-white'
      case 'BUY':
        return 'bg-green-500 text-white'
      case 'HOLD':
        return 'bg-yellow-500 text-white'
      case 'SELL':
        return 'bg-red-500 text-white'
      case 'STRONG_SELL':
        return 'bg-red-600 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getRecommendationLabel = (recommendation: AIInsight['recommendation']) => {
    return recommendation.replace('_', ' ')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="ai-insights-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Brain className="h-6 w-6 text-primary" />
            AI Insights & Recommendations
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Last Updated: {lastUpdated}
          </DialogDescription>
        </DialogHeader>

        {/* AI Model Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">LSTM Model Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">87.3%</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.length}</div>
              <p className="text-xs text-muted-foreground">High confidence signals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {insights.length > 0
                  ? Math.round(insights.reduce((acc, i) => acc + i.confidence, 0) / insights.length)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">Across all signals</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Recommendations */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Top AI Recommendations
          </h3>

          {insights.map((insight) => (
            <Link
              key={insight.symbol}
              href={`/analysis/${insight.symbol}`}
              className="block"
            >
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    {/* Left: Stock Info */}
                    <div className="flex items-center gap-4">
                      <Badge className="text-base font-bold px-3 py-1 bg-blue-600">
                        {insight.symbol}
                      </Badge>
                      <div>
                        <div className="font-medium">{insight.prediction}</div>
                        <div className="text-sm text-muted-foreground">
                          ${insight.currentPrice.toFixed(2)} → ${insight.targetPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Right: Recommendation */}
                    <div className="text-right space-y-2">
                      <Badge className={getRecommendationColor(insight.recommendation)}>
                        {getRecommendationLabel(insight.recommendation)}
                      </Badge>
                      <div className="flex items-center gap-2 justify-end text-sm">
                        {insight.change >= 0 ? (
                          <div className="flex items-center text-green-600">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            +{insight.change.toFixed(1)}%
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600">
                            <TrendingDown className="h-4 w-4 mr-1" />
                            {insight.change.toFixed(1)}%
                          </div>
                        )}
                        <span className="text-muted-foreground">
                          {insight.confidence}% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            AI recommendations are generated using LSTM neural networks and technical analysis.
            Past performance does not guarantee future results. Always do your own research.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
