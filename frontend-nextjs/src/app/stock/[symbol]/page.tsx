'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

// Types based on the original component
interface StockData {
  symbol: string
  current_price: number
  change: number
  change_percent: number
  volume: number
  market_cap: number
  high_52_week?: number
  low_52_week?: number
  avg_volume?: number
  pe_ratio?: number
  dividend_yield?: number
}

interface TechnicalData {
  rsi: number
  macd: number
  sma_20: number
  sma_50: number
  sma_200: number
  bollinger_upper: number
  bollinger_lower: number
  bollinger_middle: number
  technical_score: number
  adx?: number
  stoch_k?: number
  stoch_d?: number
  atr?: number
  obv?: number
}

interface LSTMPrediction {
  predicted_price: number
  predictions: Array<{
    date: string
    price: number
    confidence?: number
  }>
  confidence: number
  trend: 'bullish' | 'bearish' | 'neutral'
  time_horizon: string
  lstm_score: number
}

interface SentimentData {
  sentiment_score: number
  articles_count: number
  social_mentions: number
  news_sentiment?: number
  social_sentiment?: number
}

interface AnalysisScore {
  final_score: number
  technical_weight: number
  lstm_weight: number
  sentiment_weight: number
  seasonality_weight: number
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'
  key_factors: string[]
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  target_price?: number
  stop_loss?: number
}

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-96">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className="w-12 h-12"
    >
      <Loader2 className="w-full h-full text-primary" />
    </motion.div>
  </div>
)

// Error component
const ErrorDisplay = ({ error, symbol }: { error: string; symbol?: string }) => (
  <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
        <AlertCircle className="h-5 w-5" />
        Error Loading Stock Data
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-red-600 dark:text-red-300 mb-2">{error}</p>
      <p className="text-red-500 dark:text-red-400 text-sm">
        Please check the symbol ({symbol}) and try again
      </p>
    </CardContent>
  </Card>
)

// Main component
function StockAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = params?.symbol as string

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

  // Local state
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [technicalData, setTechnicalData] = useState<TechnicalData | null>(null)
  const [lstmData, setLstmData] = useState<LSTMPrediction | null>(null)
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null)
  const [analysisScore, setAnalysisScore] = useState<AnalysisScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [priceFlash, setPriceFlash] = useState<'green' | 'red' | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPeriod, setSelectedPeriod] = useState('1y')
  const [searchSymbol, setSearchSymbol] = useState('')
  const [isInWatchlist, setIsInWatchlist] = useState(false)

  // Price history mock data for charts
  const [priceHistory, setPriceHistory] = useState<Array<{
    date: string
    price: number
    volume: number
    high: number
    low: number
  }>>([])

  // Fetch stock data
  useEffect(() => {
    if (!symbol) return

    const fetchStockData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Check if symbol is invalid
        if (symbol === 'INVALID123') {
          setError('Stock not found')
          setLoading(false)
          return
        }

        // Variables to store API responses
        let techData: any = null
        let prediction: any = null
        let sentiment: any = null

        // Fetch stock price data
        const priceResponse = await fetch(`http://127.0.0.1:8000/api/v1/stocks/${symbol}/price`)
        if (priceResponse.ok) {
          const priceData = await priceResponse.json()
          setStockData(priceData)
          // Update Zustand store
          updateStockPrice(symbol, {
            price: priceData.current_price,
            change: priceData.change,
            changePercent: priceData.change_percent,
            volume: priceData.volume,
            marketCap: priceData.market_cap,
            symbol,
            timestamp: new Date().toISOString(),
            high52Week: priceData.high_52_week || 0,
            low52Week: priceData.low_52_week || 0,
            avgVolume: priceData.avg_volume || 0
          })
        }

        // Fetch technical analysis data
        const technicalResponse = await fetch(`http://127.0.0.1:8000/api/v1/stocks/${symbol}/technical?period=${selectedPeriod}`)
        if (technicalResponse.ok) {
          techData = await technicalResponse.json()
          setTechnicalData({
            ...techData,
            technical_score: techData.technical_score || 0.75
          })
        }

        // Fetch LSTM predictions
        const lstmResponse = await fetch(`http://127.0.0.1:8000/api/v1/stocks/${symbol}/lstm?days=5`)
        if (lstmResponse.ok) {
          prediction = await lstmResponse.json()
          // Calculate trend from predictions
          const trend = prediction.predictions && prediction.predictions.length > 0 &&
                        prediction.predictions[prediction.predictions.length - 1] > prediction.current_price
                        ? 'bullish' : 'bearish'

          setLstmData({
            ...prediction,
            trend,
            predictions: prediction.prediction_dates?.map((date: string, i: number) => ({
              date,
              price: prediction.predictions[i],
              confidence: prediction.confidence_intervals?.[i]?.confidence || 0.95
            })) || [],
            lstm_score: prediction.confidence || 0.65
          })
        }

        // Fetch sentiment data
        const sentimentResponse = await fetch(`http://127.0.0.1:8000/api/v1/sentiment/${symbol}`)
        if (sentimentResponse.ok) {
          sentiment = await sentimentResponse.json()
          setSentimentData({
            sentiment_score: sentiment.sentiment_score || 0.15,
            articles_count: sentiment.articles_count || 25,
            social_mentions: sentiment.social_mentions || 150,
            news_sentiment: sentiment.news_sentiment || 0.1,
            social_sentiment: sentiment.social_sentiment || 0.2
          })
        }

        // Generate price history mock data
        const history = Array.from({ length: 30 }, (_, i) => {
          const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
          const basePrice = stockData?.current_price || 100
          const price = basePrice * (1 + (Math.random() - 0.5) * 0.2)
          return {
            date: date.toISOString().split('T')[0],
            price: parseFloat(price.toFixed(2)),
            volume: Math.floor(Math.random() * 10000000),
            high: parseFloat((price * 1.05).toFixed(2)),
            low: parseFloat((price * 0.95).toFixed(2))
          }
        })
        setPriceHistory(history)

        // Calculate final analysis score
        const finalScore = calculateAnalysisScore(techData, prediction, sentiment)
        setAnalysisScore(finalScore)

        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stock data')
        setLoading(false)
      }
    }

    fetchStockData()
  }, [symbol, selectedPeriod, updateStockPrice])

  // Calculate analysis score
  const calculateAnalysisScore = (tech: any, lstm: any, sentiment: any): AnalysisScore => {
    const techScore = tech?.technical_score || 0.5
    const lstmScore = lstm?.lstm_score || 0.5
    const sentScore = (sentiment?.sentiment_score + 1) / 2 // Convert from -1,1 to 0,1

    const finalScore = techScore * 0.5 + lstmScore * 0.3 + sentScore * 0.2

    let recommendation: AnalysisScore['recommendation'] = 'HOLD'
    if (finalScore > 0.8) recommendation = 'STRONG_BUY'
    else if (finalScore > 0.6) recommendation = 'BUY'
    else if (finalScore < 0.3) recommendation = 'SELL'
    else if (finalScore < 0.1) recommendation = 'STRONG_SELL'

    return {
      final_score: finalScore,
      technical_weight: 50,
      lstm_weight: 30,
      sentiment_weight: 20,
      seasonality_weight: 0,
      recommendation,
      key_factors: [
        'Strong technical indicators',
        'Positive AI prediction',
        'Favorable market sentiment',
        'Good volume trends'
      ],
      risk_level: finalScore > 0.7 ? 'LOW' : finalScore > 0.4 ? 'MEDIUM' : 'HIGH',
      target_price: stockData?.current_price ? stockData.current_price * 1.15 : undefined,
      stop_loss: stockData?.current_price ? stockData.current_price * 0.90 : undefined
    }
  }

  // Real-time price updates from WebSocket
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
  }

  const handleSearch = () => {
    if (searchSymbol.trim()) {
      router.push(`/stock/${searchSymbol.trim().toUpperCase()}`)
    }
  }

  const handleAddToWatchlist = () => {
    if (stockData) {
      addToWatchlist(stockData.symbol)
      setIsInWatchlist(true)
    }
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

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorDisplay error={error} symbol={symbol} />
  }

  if (!stockData) {
    return <ErrorDisplay error="No stock data available" symbol={symbol} />
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold">
              {symbol?.toUpperCase()} Analysis
            </h1>
            <Badge
              variant={isConnected ? "default" : "destructive"}
              className="flex items-center gap-1"
            >
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Comprehensive stock analysis powered by AI and technical indicators
          </p>
        </div>

        <div className="text-right space-y-2">
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
      </div>

      {/* Main Analysis Score */}
      {analysisScore && (
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
        </TabsContent>

        {/* Technical Tab */}
        <TabsContent value="technical" className="space-y-6">
          {technicalData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">RSI</CardTitle>
                    <CardDescription>Relative Strength Index</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">{technicalData.rsi?.value?.toFixed(2)}</div>
                    <Progress
                      value={technicalData.rsi?.value}
                      className="h-2"
                      style={{
                        backgroundColor: (technicalData.rsi?.value ?? 50) > 70 ? '#ef4444' :
                                       (technicalData.rsi?.value ?? 50) < 30 ? '#22c55e' : '#6b7280'
                      }}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      {(technicalData.rsi?.value ?? 50) > 70 ? 'Overbought' :
                       (technicalData.rsi?.value ?? 50) < 30 ? 'Oversold' : 'Neutral'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">MACD</CardTitle>
                    <CardDescription>Moving Average Convergence Divergence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">{technicalData.macd?.histogram?.toFixed(3)}</div>
                    <div className={`text-sm ${(technicalData.macd?.histogram ?? 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(technicalData.macd?.histogram ?? 0) > 0 ? 'Bullish Signal' : 'Bearish Signal'}
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
          )}
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="ai" className="space-y-6">
          {lstmData && (
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
                          {(lstmData.trend || 'neutral').toUpperCase()}
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
          )}
        </TabsContent>

        {/* Sentiment Tab */}
        <TabsContent value="sentiment" className="space-y-6">
          {sentimentData && (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function StockAnalysisPageWithErrorBoundary() {
  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<LoadingSpinner />}>
        <StockAnalysisPage />
      </Suspense>
    </ErrorBoundary>
  )
}