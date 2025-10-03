'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Star, Plus, X, TrendingUp, TrendingDown, Search } from 'lucide-react'
import Link from 'next/link'
import { useMarketStore } from '@/stores'

interface WatchlistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WatchlistModal({ open, onOpenChange }: WatchlistModalProps) {
  const { watchlists, selectedWatchlist, selectWatchlist, addToWatchlist, removeFromWatchlist } = useMarketStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Get selected watchlist
  const currentWatchlist = watchlists.find(w => w.id === selectedWatchlist)

  // Mock stock data for display
  const getStockData = (symbol: string) => {
    const mockData: Record<string, { price: number; change: number }> = {
      'AAPL': { price: 175.43, change: 2.3 },
      'GOOGL': { price: 142.65, change: 1.8 },
      'MSFT': { price: 378.85, change: -0.5 },
      'AMZN': { price: 178.35, change: 1.2 },
      'TSLA': { price: 242.84, change: 3.2 },
      'META': { price: 481.92, change: -1.1 },
      'NVDA': { price: 875.28, change: 4.1 },
      'AMD': { price: 142.17, change: 2.8 }
    }
    return mockData[symbol] || { price: 100.00, change: 0 }
  }

  const handleAddStock = () => {
    if (searchQuery.trim() && selectedWatchlist) {
      const symbol = searchQuery.trim().toUpperCase()
      addToWatchlist(selectedWatchlist, symbol)
      setSearchQuery('')
      setIsAdding(false)
    }
  }

  const handleRemoveStock = (symbol: string) => {
    if (selectedWatchlist) {
      removeFromWatchlist(selectedWatchlist, symbol)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddStock()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="watchlist-panel">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Star className="h-6 w-6 text-primary" />
            My Watchlist
          </DialogTitle>
          <DialogDescription>
            Track and monitor your favorite stocks
          </DialogDescription>
        </DialogHeader>

        {/* Watchlist Tabs */}
        <div className="flex gap-2 border-b pb-2">
          {watchlists.map((watchlist) => (
            <Button
              key={watchlist.id}
              variant={selectedWatchlist === watchlist.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => selectWatchlist(watchlist.id)}
            >
              {watchlist.name}
            </Button>
          ))}
        </div>

        {/* Add Stock Section */}
        {isAdding ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter stock symbol (e.g., AAPL)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                autoFocus
              />
            </div>
            <Button onClick={handleAddStock} disabled={!searchQuery.trim()}>
              Add
            </Button>
            <Button variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4" />
            Add Stock to Watchlist
          </Button>
        )}

        {/* Stocks List */}
        <div className="space-y-2">
          {currentWatchlist && currentWatchlist.symbols.length > 0 ? (
            currentWatchlist.symbols.map((symbol) => {
              const data = getStockData(symbol)
              const isPositive = data.change >= 0

              return (
                <Card key={symbol} className="hover:bg-accent transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      {/* Left: Stock Symbol */}
                      <Link
                        href={`/analysis/${symbol}`}
                        className="flex items-center gap-3 flex-1 hover:underline"
                      >
                        <Badge className="text-base font-bold px-3 py-1 bg-blue-600">
                          {symbol}
                        </Badge>
                        <div>
                          <div className="font-medium">${data.price.toFixed(2)}</div>
                          <div className={`flex items-center gap-1 text-sm ${
                            isPositive ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {isPositive ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {isPositive ? '+' : ''}{data.change.toFixed(2)}%
                          </div>
                        </div>
                      </Link>

                      {/* Right: Remove Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveStock(symbol)}
                        aria-label={`Remove ${symbol} from watchlist`}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Your watchlist is empty</p>
              <p className="text-sm">Add stocks to start tracking them</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        {currentWatchlist && currentWatchlist.symbols.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              Tracking {currentWatchlist.symbols.length} {currentWatchlist.symbols.length === 1 ? 'stock' : 'stocks'}.
              Click on any stock to view detailed analysis.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
