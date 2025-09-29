'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'

export default function TestDashboard() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Loading Dashboard...</h1>
          <p className="text-muted-foreground">Authentication Disabled - Testing Core Functionality</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">TurtleTrading Dashboard</h1>
          <Badge variant="secondary" className="mb-4">
            🧪 Test Mode - Authentication Disabled
          </Badge>
          <p className="text-muted-foreground">
            Core application functionality testing - Authentication has been temporarily disabled.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$45,231.89</div>
              <p className="text-xs text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +20.1% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's P&L</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+$1,234.56</div>
              <p className="text-xs text-muted-foreground">
                +2.8% today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">
                8 long, 4 short
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Market Status</CardTitle>
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Open</div>
              <p className="text-xs text-muted-foreground">
                NYSE & NASDAQ
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { symbol: 'AAPL', action: 'BUY', shares: 100, price: '$150.25', time: '2 min ago' },
                  { symbol: 'TSLA', action: 'SELL', shares: 50, price: '$245.80', time: '15 min ago' },
                  { symbol: 'MSFT', action: 'BUY', shares: 75, price: '$310.50', time: '1 hour ago' },
                ].map((trade, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center space-x-3">
                      <Badge variant={trade.action === 'BUY' ? 'default' : 'destructive'}>
                        {trade.action}
                      </Badge>
                      <div>
                        <p className="font-medium">{trade.symbol}</p>
                        <p className="text-sm text-muted-foreground">{trade.shares} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{trade.price}</p>
                      <p className="text-sm text-muted-foreground">{trade.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Market Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'S&P 500', value: '4,185.47', change: '+0.8%', positive: true },
                  { name: 'Dow Jones', value: '33,274.15', change: '+1.2%', positive: true },
                  { name: 'NASDAQ', value: '12,910.50', change: '-0.3%', positive: false },
                  { name: 'VIX', value: '18.45', change: '-2.1%', positive: false },
                ].map((index, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{index.name}</p>
                      <p className="text-2xl font-bold">{index.value}</p>
                    </div>
                    <div className={`flex items-center ${index.positive ? 'text-green-600' : 'text-red-600'}`}>
                      {index.positive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                      <span className="font-medium">{index.change}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-muted-foreground">
          <p>✅ Core Application Successfully Loaded</p>
          <p>🔧 Authentication Temporarily Disabled for Testing</p>
          <p>📊 All UI Components and Data Rendering Working</p>
        </div>
      </div>
    </div>
  )
}