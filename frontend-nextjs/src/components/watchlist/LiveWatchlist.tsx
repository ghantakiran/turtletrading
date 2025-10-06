'use client'

/**
 * LiveWatchlist Component
 * Displays user's watchlist with real-time stock prices
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import useMarketStore from '@/stores/marketStore'

export function LiveWatchlist() {
  const { stockPrices, watchlists, selectedWatchlist, connectionStatus } = useMarketStore()

  // Get selected watchlist
  const activeWatchlist = watchlists.find(w => w.id === selectedWatchlist)
  const isConnected = connectionStatus === 'connected'

  if (!activeWatchlist) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Watchlist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">No watchlist selected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Market Watchlist</CardTitle>
            <CardDescription>Stocks you're monitoring</CardDescription>
          </div>
          {isConnected && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Activity className="w-3 h-3 mr-1" />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeWatchlist.symbols.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No stocks in watchlist</p>
            <p className="text-sm mt-2">Add stocks to start tracking prices</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeWatchlist.symbols.map((symbol) => {
              const stockData = stockPrices[symbol]
              const hasData = !!stockData
              const isPositive = stockData ? stockData.changePercent >= 0 : false

              return (
                <div
                  key={symbol}
                  className="flex items-center justify-between border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{symbol}</Badge>
                    {hasData ? (
                      <span className="text-sm font-medium">${stockData.price.toFixed(2)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    )}
                  </div>

                  {hasData && (
                    <div className={`flex items-center text-sm font-medium ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {isPositive ? '+' : ''}{stockData.changePercent.toFixed(2)}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
