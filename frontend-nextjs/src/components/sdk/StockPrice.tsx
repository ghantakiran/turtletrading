/**
 * StockPrice React Component
 * Ready-to-use component for displaying stock prices
 */

'use client'

import { useState, useEffect } from 'react'
import { TurtleTradingClient } from '@/sdk'
import type { StockPrice as StockPriceType } from '@/sdk'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface StockPriceProps {
  symbol: string
  apiKey: string
  refreshInterval?: number
  className?: string
}

export function StockPrice({ symbol, apiKey, refreshInterval = 0, className }: StockPriceProps) {
  const [data, setData] = useState<StockPriceType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const client = new TurtleTradingClient({ apiKey })

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await client.stocks.getPrice(symbol)
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stock price')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [symbol, apiKey, refreshInterval])

  if (loading && !data) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center text-destructive">{error}</div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const isPositive = (data.change || 0) >= 0

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{data.symbol}</span>
          <Badge variant={isPositive ? 'default' : 'destructive'}>
            {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {data.change_percent?.toFixed(2)}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${data.current_price.toFixed(2)}</span>
            <span className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{data.change?.toFixed(2)}
            </span>
          </div>
          {data.previous_close && (
            <div className="text-sm text-muted-foreground">
              Previous Close: ${data.previous_close.toFixed(2)}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Last updated: {new Date(data.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
