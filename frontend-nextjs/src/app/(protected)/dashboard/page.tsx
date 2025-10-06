import { Metadata } from 'next'

// Force dynamic rendering for authentication-protected routes
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react'
import { MarketSentimentOverview } from '@/components/sentiment/MarketSentimentOverview'
import { NewsPreview } from '@/components/news/NewsPreview'
import { FlashNewsBar } from '@/components/news/FlashNewsBar'
import { SocialPostsPreview } from '@/components/social/SocialPostsPreview'
import { LiveMarketIndices } from '@/components/market/LiveMarketIndices'
import { LiveWatchlist } from '@/components/watchlist/LiveWatchlist'
import { LiveAlertsPanel } from '@/components/alerts/LiveAlertsPanel'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'TurtleTrading dashboard with market insights and portfolio overview.',
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Flash News Bar - Breaking market news */}
      <FlashNewsBar />

      {/* Welcome header with enhanced visual hierarchy */}
      <div className="border-b pb-6">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Welcome back!
        </h1>
        <p className="text-muted-foreground text-lg">
          Here's what's happening with your portfolio and the markets today.
        </p>
      </div>

      {/* Portfolio Overview Section - Enhanced with clear boundaries */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-1 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
          <h2 className="text-2xl font-bold">Portfolio Overview</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.89</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              +2.5% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily P&L</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+$1,234.56</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              +2.8% today
            </div>
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
              8 stocks, 4 options
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">73%</div>
            <p className="text-xs text-muted-foreground">
              Last 30 trades
            </p>
          </CardContent>
        </Card>
      </div>
      </section>

      {/* Live Alerts Section - Real-time notifications */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-1 bg-gradient-to-b from-red-600 to-rose-600 rounded-full" />
          <h2 className="text-2xl font-bold">Live Alerts</h2>
        </div>
        <LiveAlertsPanel />
      </section>

      {/* Market Indices Section - Real-time market data */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-1 bg-gradient-to-b from-blue-600 to-cyan-600 rounded-full" />
          <h2 className="text-2xl font-bold">Market Indices</h2>
        </div>
        <LiveMarketIndices />
      </section>

      {/* Market Sentiment Section - Enhanced with clear boundaries */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-1 bg-gradient-to-b from-green-600 to-emerald-600 rounded-full" />
          <h2 className="text-2xl font-bold">Market Sentiment</h2>
        </div>
        <MarketSentimentOverview />

      </section>

      {/* News & Activity Section - Enhanced with clear boundaries */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-1 bg-gradient-to-b from-purple-600 to-violet-600 rounded-full" />
          <h2 className="text-2xl font-bold">News & Activity</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* News Preview */}
          <NewsPreview limit={5} />

          {/* Social Posts Preview */}
          <SocialPostsPreview limit={5} />

          {/* Recent Trades */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
              <CardDescription>
                Your latest trading activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">AAPL</Badge>
                  <span className="text-sm">Buy 100 shares</span>
                </div>
                <div className="text-sm text-green-600">+$150.00</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GOOGL</Badge>
                  <span className="text-sm">Sell 50 shares</span>
                </div>
                <div className="text-sm text-red-600">-$75.50</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">TSLA</Badge>
                  <span className="text-sm">Buy 25 shares</span>
                </div>
                <div className="text-sm text-green-600">+$425.75</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Market Watchlist Section - Real-time stock prices */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-1 bg-gradient-to-b from-orange-600 to-amber-600 rounded-full" />
          <h2 className="text-2xl font-bold">Your Watchlist</h2>
        </div>
        <LiveWatchlist />
      </section>
    </div>
  )
}