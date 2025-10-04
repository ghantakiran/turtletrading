'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SentimentGaugeProps {
  symbol: string
  sentimentScore: number // -1 to 1 scale
  sentimentLabel: string // Bullish, Bearish, Neutral
  confidence: number // 0 to 1 scale
  totalMentions?: number
  trendingScore?: number
  className?: string
}

export function SentimentGauge({
  symbol,
  sentimentScore,
  sentimentLabel,
  confidence,
  totalMentions,
  trendingScore,
  className
}: SentimentGaugeProps) {
  // Convert sentiment score (-1 to 1) to gauge position (0 to 100)
  const gaugePosition = ((sentimentScore + 1) / 2) * 100

  // Determine color based on sentiment
  const getSentimentColor = () => {
    if (sentimentScore > 0.3) return 'text-green-600'
    if (sentimentScore > 0.1) return 'text-green-500'
    if (sentimentScore > -0.1) return 'text-gray-600'
    if (sentimentScore > -0.3) return 'text-orange-500'
    return 'text-red-600'
  }

  const getSentimentBgColor = () => {
    if (sentimentScore > 0.3) return 'bg-green-600'
    if (sentimentScore > 0.1) return 'bg-green-500'
    if (sentimentScore > -0.1) return 'bg-gray-400'
    if (sentimentScore > -0.3) return 'bg-orange-500'
    return 'bg-red-600'
  }

  const getSentimentIcon = () => {
    if (sentimentScore > 0.1) return <TrendingUp className="h-5 w-5" />
    if (sentimentScore < -0.1) return <TrendingDown className="h-5 w-5" />
    return <Minus className="h-5 w-5" />
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{symbol}</CardTitle>
            <Badge variant={sentimentScore > 0 ? 'default' : sentimentScore < 0 ? 'destructive' : 'secondary'}>
              {sentimentLabel}
            </Badge>
          </div>
          <div className={cn('flex items-center gap-1', getSentimentColor())}>
            {getSentimentIcon()}
            <span className="font-bold">
              {sentimentScore > 0 ? '+' : ''}{(sentimentScore * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        <CardDescription>Market sentiment analysis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sentiment Gauge */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Very Bearish</span>
            <span>Neutral</span>
            <span>Very Bullish</span>
          </div>
          <div className="relative h-3 bg-gradient-to-r from-red-500 via-gray-300 to-green-500 rounded-full">
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-all duration-500',
                getSentimentBgColor()
              )}
              style={{ left: `${gaugePosition}%`, transform: 'translateX(-50%) translateY(-50%)' }}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-current" />
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <p className="text-sm font-medium">{(confidence * 100).toFixed(0)}%</p>
            </div>
          </div>

          {totalMentions !== undefined && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Mentions</p>
              <p className="text-sm font-bold">{totalMentions.toLocaleString()}</p>
            </div>
          )}

          {trendingScore !== undefined && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Trending</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${trendingScore * 100}%` }}
                  />
                </div>
                <p className="text-sm font-medium">{(trendingScore * 100).toFixed(0)}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Sentiment Description */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {sentimentScore > 0.5 && 'Strong positive sentiment indicates bullish market mood'}
            {sentimentScore > 0.1 && sentimentScore <= 0.5 && 'Moderate bullish sentiment detected'}
            {sentimentScore >= -0.1 && sentimentScore <= 0.1 && 'Neutral sentiment with mixed signals'}
            {sentimentScore >= -0.5 && sentimentScore < -0.1 && 'Moderate bearish sentiment detected'}
            {sentimentScore < -0.5 && 'Strong negative sentiment indicates bearish market mood'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
