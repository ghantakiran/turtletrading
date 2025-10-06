'use client'

/**
 * LiveMarketIndices Component
 * Displays real-time market indices (S&P 500, NASDAQ, Dow Jones) with live updates
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import useMarketStore from '@/stores/marketStore'
import { useEffect } from 'react'

export function LiveMarketIndices() {
  const { marketIndices, connectionStatus } = useMarketStore()

  // Get major indices
  const majorIndices = ['SPY', 'QQQ', 'DIA']
  const indices = majorIndices
    .map(symbol => marketIndices[symbol])
    .filter(Boolean)

  const isConnected = connectionStatus === 'connected'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Market Indices</CardTitle>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Activity className="w-3 h-3 mr-1" />
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-600 border-gray-600">
                Offline
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {indices.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            <p className="text-sm">Loading market data...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {indices.map((index) => {
              const isPositive = index.changePercent >= 0

              return (
                <div
                  key={index.symbol}
                  className="flex items-center justify-between border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{index.symbol}</Badge>
                    <div>
                      <p className="font-medium">{index.name}</p>
                      <p className="text-2xl font-bold">{index.value.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>{isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isPositive ? '+' : ''}{index.change.toFixed(2)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
