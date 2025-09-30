'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Brain,
  BarChart3,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  DollarSign,
  Volume2,
  Calendar,
  TrendingUp as TrendingUpIcon,
  Star,
  Bookmark,
  Share2,
  Download,
  Settings,
  Info,
  Zap,
  Shield,
  Eye,
  Loader2
} from 'lucide-react'
import { useMarketStore } from '@/stores'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useStockWebSocket } from '@/hooks/useWebSocket'
import { StockData, TechnicalData, LSTMPrediction, SentimentData, AnalysisScore } from '@/lib/api/stock-data'

interface StockAnalysisClientProps {
  initialData: {
    stockData: StockData | null
    technicalData: TechnicalData | null
    lstmData: LSTMPrediction | null
    sentimentData: SentimentData | null
    analysisScore: AnalysisScore | null
    priceHistory: Array<{
      date: string
      price: number
      volume: number
      high: number
      low: number
    }>
    symbol: string
    errors: {
      stockData: string | null
      technicalData: string | null
      lstmData: string | null
      sentimentData: string | null
    }
  }
}

export default function StockAnalysisClient({ initialData }: StockAnalysisClientProps) {
  const router = useRouter()

  // Destructure server data
  const {
    stockData: initialStockData,
    technicalData,
    lstmData,
    sentimentData,
    analysisScore,
    priceHistory,
    symbol,
    errors
  } = initialData

  // Zustand stores
  const {
    stockPrices,
    addToWatchlist,
    isConnected,
    updateStockPrice,
    technicalIndicators,
    aiAnalysis,
    marketSentiment
  } = useMarketStore()

  // Local state - initialize with server data
  const [stockData, setStockData] = useState<StockData | null>(initialStockData)
  const [priceFlash, setPriceFlash] = useState<'green' | 'red' | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPeriod, setSelectedPeriod] = useState('1y')
  const [searchSymbol, setSearchSymbol] = useState('')
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // WebSocket integration - temporarily disabled to avoid infinite loop
  const wsConnected = false
  const connectionStatus = 'disconnected'
  const subscribe = () => {}
  const unsubscribe = () => {}

  // TODO: Re-enable WebSocket after fixing infinite loop issue
  // const {
  //   isConnected: wsConnected,
  //   connectionStatus,
  //   subscribe,
  //   unsubscribe
  // } = useStockWebSocket(symbol, {
  //   onMessage: (message) => {
  //     console.log('WebSocket message received:', message)
  //   },
  //   onError: (error) => {
  //     console.error('WebSocket error:', error)
  //   }
  // })

  // Real-time price updates from WebSocket via Zustand
  useEffect(() => {
    const currentPrice = stockPrices[symbol]
    if (currentPrice && stockData) {
      const prevPrice = stockData.current_price
      const newPrice = currentPrice.price

      if (newPrice !== prevPrice) {
        setStockData(prev => prev ? {
          ...prev,
          current_price: newPrice,
          change: currentPrice.change,
          change_percent: currentPrice.changePercent
        } : null)

        // Flash animation
        setPriceFlash(currentPrice.change >= 0 ? 'green' : 'red')
        setTimeout(() => setPriceFlash(null), 1000)
      }
    }
  }, [stockPrices, symbol, stockData])

  // Handlers
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    // In a real app, this would trigger a new data fetch
  }

  const handleSearch = () => {
    if (searchSymbol.trim()) {
      router.push(`/analysis/${searchSymbol.trim().toUpperCase()}`)
    }
  }

  const handleAddToWatchlist = () => {
    if (stockData) {
      addToWatchlist(stockData.symbol)
      setIsInWatchlist(true)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Trigger a page refresh to get new server-side data
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'STRONG_BUY': return 'bg-green-500'
      case 'BUY': return 'bg-green-400'
      case 'HOLD': return 'bg-yellow-500'
      case 'SELL': return 'bg-red-400'
      case 'STRONG_SELL': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  // Error display for failed data
  if (!stockData && errors.stockData) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 m-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5" />
            Error Loading Stock Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-300 mb-2">{errors.stockData}</p>
          <p className="text-red-500 dark:text-red-400 text-sm">
            Please check the symbol ({symbol}) and try again
          </p>
          <Button onClick={handleRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold">
              {symbol} Analysis
            </h1>
            <Badge
              variant={isConnected ? "default" : "destructive"}
              className="flex items-center gap-1"
            >
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
            {/* Show errors for partial data load */}
            {(errors.technicalData || errors.lstmData || errors.sentimentData) && (
              <Badge variant="outline" className="text-yellow-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                Partial Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Comprehensive stock analysis powered by AI and technical indicators
          </p>
        </div>

        <div className="text-right space-y-2">
          {stockData && (
            <>
              <motion.div
                className={`text-4xl font-bold ${priceFlash ? `flash-${priceFlash}` : ''}`}
                animate={priceFlash ? { scale: [1, 1.05, 1] } : {}}
              >
                ${stockData.current_price?.toFixed(2)}
              </motion.div>
              <motion.div
                className={`text-xl font-semibold flex items-center gap-1 ${
                  stockData.change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
                animate={priceFlash ? { scale: [1, 1.05, 1] } : {}}
              >
                {stockData.change >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {stockData.change >= 0 ? '+' : ''}${stockData.change?.toFixed(2)}
                ({stockData.change_percent?.toFixed(2)}%)
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search stock (e.g. AAPL)"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-48"
          />
          <Button onClick={handleSearch} size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Button
          onClick={handleAddToWatchlist}
          variant={isInWatchlist ? "default" : "outline"}
          size="sm"
        >
          {isInWatchlist ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />}
          Watchlist
        </Button>

        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4" />
          Share
        </Button>

        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" />
          Export
        </Button>

        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main Analysis Score */}
      {analysisScore && stockData && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Overall Analysis Score</span>
              <Badge className={getRecommendationColor(analysisScore.recommendation)}>
                {analysisScore.recommendation}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Confidence Score</span>
                  <span className="font-bold">{(analysisScore.final_score * 100).toFixed(0)}%</span>
                </div>
                <Progress value={analysisScore.final_score * 100} className="h-3" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Technical</p>
                  <p className="text-2xl font-bold">{analysisScore.technical_weight}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AI Prediction</p>
                  <p className="text-2xl font-bold">{analysisScore.lstm_weight}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sentiment</p>
                  <p className="text-2xl font-bold">{analysisScore.sentiment_weight}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <Badge variant={analysisScore.risk_level === 'LOW' ? 'default' : analysisScore.risk_level === 'MEDIUM' ? 'secondary' : 'destructive'}>
                    {analysisScore.risk_level}
                  </Badge>
                </div>
              </div>

              {analysisScore.target_price && analysisScore.stop_loss && (
                <div className="flex gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Target: ${analysisScore.target_price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <span className="text-sm">Stop Loss: ${analysisScore.stop_loss.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="technical" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Technical
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Sentiment
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {stockData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Market Cap</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${(stockData.market_cap / 1e9).toFixed(2)}B
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(stockData.volume / 1e6).toFixed(2)}M
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">52W High</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${stockData.high_52_week?.toFixed(2) || 'N/A'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">52W Low</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${stockData.low_52_week?.toFixed(2) || 'N/A'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Price Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Price Chart</CardTitle>
                  <div className="flex gap-2">
                    {['1d', '7d', '1m', '3m', '1y'].map((period) => (
                      <Button
                        key={period}
                        variant={selectedPeriod === period ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePeriodChange(period)}
                      >
                        {period}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Technical Tab */}
        <TabsContent value="technical" className="space-y-6">
          {technicalData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">RSI</CardTitle>
                    <CardDescription>Relative Strength Index</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">{technicalData.rsi?.toFixed(2)}</div>
                    <Progress
                      value={technicalData.rsi}
                      className="h-2"
                      style={{
                        backgroundColor: technicalData.rsi > 70 ? '#ef4444' :
                                       technicalData.rsi < 30 ? '#22c55e' : '#6b7280'
                      }}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      {technicalData.rsi > 70 ? 'Overbought' :
                       technicalData.rsi < 30 ? 'Oversold' : 'Neutral'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">MACD</CardTitle>
                    <CardDescription>Moving Average Convergence Divergence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">{technicalData.macd?.toFixed(3)}</div>
                    <div className={`text-sm ${technicalData.macd > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {technicalData.macd > 0 ? 'Bullish Signal' : 'Bearish Signal'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Technical Score</CardTitle>
                    <CardDescription>Overall Technical Rating</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">
                      {(technicalData.technical_score * 100).toFixed(0)}%
                    </div>
                    <Progress value={technicalData.technical_score * 100} className="h-2" />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Moving Averages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">SMA 20</p>
                      <p className="text-2xl font-bold">${technicalData.sma_20?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">SMA 50</p>
                      <p className="text-2xl font-bold">${technicalData.sma_50?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">SMA 200</p>
                      <p className="text-2xl font-bold">${technicalData.sma_200?.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bollinger Bands</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Upper Band</p>
                      <p className="text-2xl font-bold">${technicalData.bollinger_upper?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Middle Band</p>
                      <p className="text-2xl font-bold">${technicalData.bollinger_middle?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lower Band</p>
                      <p className="text-2xl font-bold">${technicalData.bollinger_lower?.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-5 w-5" />
                  Technical Data Unavailable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-600 dark:text-yellow-300">
                  {errors.technicalData || 'Technical analysis data could not be loaded'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="ai" className="space-y-6">
          {lstmData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    LSTM Prediction
                  </CardTitle>
                  <CardDescription>
                    AI-powered price prediction for next {lstmData.time_horizon}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Predicted Price</p>
                        <p className="text-3xl font-bold">${lstmData.predicted_price?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Confidence</p>
                        <p className="text-3xl font-bold">{(lstmData.confidence * 100).toFixed(0)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Trend</p>
                        <Badge
                          className={
                            lstmData.trend === 'bullish' ? 'bg-green-500' :
                            lstmData.trend === 'bearish' ? 'bg-red-500' : 'bg-gray-500'
                          }
                        >
                          {lstmData.trend.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">5-Day Forecast</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={lstmData.predictions}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key AI Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysisScore?.key_factors.map((factor, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>{factor}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-5 w-5" />
                  LSTM Data Unavailable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-600 dark:text-yellow-300">
                  {errors.lstmData || 'AI prediction data could not be loaded'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sentiment Tab */}
        <TabsContent value="sentiment" className="space-y-6">
          {sentimentData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Overall Sentiment</CardTitle>
                    <CardDescription>Combined news and social</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">
                      {sentimentData.sentiment_score > 0 ? 'Positive' :
                       sentimentData.sentiment_score < 0 ? 'Negative' : 'Neutral'}
                    </div>
                    <Progress
                      value={(sentimentData.sentiment_score + 1) * 50}
                      className="h-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">News Articles</CardTitle>
                    <CardDescription>Recent coverage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{sentimentData.articles_count}</div>
                    <p className="text-sm text-muted-foreground">Articles analyzed</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Social Mentions</CardTitle>
                    <CardDescription>Social media buzz</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{sentimentData.social_mentions}</div>
                    <p className="text-sm text-muted-foreground">Mentions tracked</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Sentiment Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">News Sentiment</p>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={(sentimentData.news_sentiment || 0 + 1) * 50}
                          className="h-2 flex-1"
                        />
                        <span className="text-sm font-medium">
                          {((sentimentData.news_sentiment || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Social Sentiment</p>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={(sentimentData.social_sentiment || 0 + 1) * 50}
                          className="h-2 flex-1"
                        />
                        <span className="text-sm font-medium">
                          {((sentimentData.social_sentiment || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-5 w-5" />
                  Sentiment Data Unavailable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-600 dark:text-yellow-300">
                  {errors.sentimentData || 'Sentiment analysis data could not be loaded'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}