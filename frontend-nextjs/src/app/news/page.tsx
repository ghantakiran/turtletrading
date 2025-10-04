'use client'

import { useState, useEffect } from 'react'
import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  Filter,
  Zap,
  ExternalLink,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface NewsArticle {
  id: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  symbols: string[]
  category: 'earnings' | 'economic' | 'regulatory' | 'corporate' | 'geopolitical'
  sentimentScore: number
  impact: 'high' | 'medium' | 'low'
  isFlash?: boolean
}

interface BackendNewsItem {
  title: string
  source: string
  url: string
  sentiment_score: number
  published_at: string
}

interface SentimentResponse {
  symbol: string
  recent_news: BackendNewsItem[]
  overall_sentiment: number
}

export default function NewsPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'1H' | '4H' | '1D' | '1W' | '1M'>('1D')
  const [searchQuery, setSearchQuery] = useState('')
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch news from backend API
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch news for multiple popular symbols
        const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMD', 'SPY', 'QQQ']
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

        const responses = await Promise.allSettled(
          symbols.map(symbol =>
            fetch(`${backendUrl}/api/v1/sentiment/${symbol}`)
              .then(res => {
                if (!res.ok) throw new Error(`Failed to fetch ${symbol}`)
                return res.json()
              })
          )
        )

        // Transform backend data to frontend format
        const allNews: NewsArticle[] = []

        responses.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const data: SentimentResponse = result.value
            const symbol = symbols[index]

            data.recent_news.forEach((newsItem, newsIndex) => {
              // Determine category based on content (simple heuristic)
              let category: NewsArticle['category'] = 'corporate'
              const titleLower = newsItem.title.toLowerCase()
              if (titleLower.includes('earnings') || titleLower.includes('revenue')) category = 'earnings'
              else if (titleLower.includes('fed') || titleLower.includes('rate')) category = 'economic'
              else if (titleLower.includes('regulation') || titleLower.includes('sec')) category = 'regulatory'

              // Determine impact based on sentiment magnitude
              const sentimentMagnitude = Math.abs(newsItem.sentiment_score)
              let impact: NewsArticle['impact'] = 'low'
              if (sentimentMagnitude > 0.6) impact = 'high'
              else if (sentimentMagnitude > 0.3) impact = 'medium'

              // Convert sentiment score from -1 to 1 range to -100 to 100
              const sentimentScore = Math.round(newsItem.sentiment_score * 100)

              // Mark as flash news if published within last hour and high impact
              const publishedTime = new Date(newsItem.published_at).getTime()
              const oneHourAgo = Date.now() - (60 * 60 * 1000)
              const isFlash = publishedTime > oneHourAgo && impact === 'high'

              allNews.push({
                id: `${symbol}-${newsIndex}`,
                title: newsItem.title,
                summary: newsItem.title, // Use title as summary since backend doesn't provide full summary
                source: newsItem.source,
                url: newsItem.url,
                publishedAt: newsItem.published_at,
                symbols: [symbol],
                category,
                sentimentScore,
                impact,
                isFlash
              })
            })
          }
        })

        // Sort by published date (newest first)
        allNews.sort((a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        )

        setNewsArticles(allNews)
      } catch (err) {
        console.error('Error fetching news:', err)
        setError('Failed to load news. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [])

  // Mock news data for fallback (kept for reference)
  const mockNews: NewsArticle[] = [
    {
      id: '1',
      title: 'Apple Announces Record Q4 Earnings, Beats Expectations',
      summary: 'Apple Inc. reported quarterly earnings that exceeded Wall Street expectations, driven by strong iPhone sales and growing services revenue.',
      source: 'Bloomberg',
      url: '#',
      publishedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      symbols: ['AAPL'],
      category: 'earnings',
      sentimentScore: 75,
      impact: 'high',
      isFlash: true
    },
    {
      id: '2',
      title: 'Federal Reserve Signals Potential Rate Hike in Q1',
      summary: 'Fed Chair Jerome Powell indicated that interest rates may rise in the first quarter as inflation concerns persist.',
      source: 'Reuters',
      url: '#',
      publishedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      symbols: ['SPY', 'QQQ'],
      category: 'economic',
      sentimentScore: -35,
      impact: 'high',
      isFlash: true
    },
    {
      id: '3',
      title: 'Tesla Unveils New Model with Enhanced Autopilot Features',
      summary: 'Tesla introduces advanced self-driving capabilities in its latest vehicle model, pushing the boundaries of autonomous driving technology.',
      source: 'CNBC',
      url: '#',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      symbols: ['TSLA'],
      category: 'corporate',
      sentimentScore: 62,
      impact: 'medium'
    },
    {
      id: '4',
      title: 'Microsoft Cloud Services Revenue Surges 40% Year-over-Year',
      summary: 'Microsoft reports significant growth in Azure cloud platform, capturing market share from competitors.',
      source: 'Wall Street Journal',
      url: '#',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      symbols: ['MSFT'],
      category: 'earnings',
      sentimentScore: 68,
      impact: 'medium'
    },
    {
      id: '5',
      title: 'NVIDIA and AMD Battle for AI Chip Market Dominance',
      summary: 'Competition intensifies between chipmakers as demand for AI and machine learning processors continues to grow.',
      source: 'Tech Crunch',
      url: '#',
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      symbols: ['NVDA', 'AMD'],
      category: 'corporate',
      sentimentScore: 45,
      impact: 'medium'
    },
    {
      id: '6',
      title: 'Google Faces New Antitrust Lawsuit from DOJ',
      summary: 'Department of Justice files additional antitrust charges against Alphabet, focusing on search engine monopoly concerns.',
      source: 'Reuters',
      url: '#',
      publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      symbols: ['GOOGL'],
      category: 'regulatory',
      sentimentScore: -52,
      impact: 'high'
    }
  ]

  const getSentimentColor = (score: number) => {
    if (score >= 50) return 'text-green-600'
    if (score >= 10) return 'text-green-500'
    if (score >= -10) return 'text-gray-600'
    if (score >= -50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getSentimentBg = (score: number) => {
    if (score >= 50) return 'bg-green-100'
    if (score >= 10) return 'bg-green-50'
    if (score >= -10) return 'bg-gray-100'
    if (score >= -50) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const getSentimentLabel = (score: number) => {
    if (score >= 50) return 'Very Bullish'
    if (score >= 10) return 'Bullish'
    if (score >= -10) return 'Neutral'
    if (score >= -50) return 'Bearish'
    return 'Very Bearish'
  }

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high': return 'bg-red-500/10 text-red-600 border-red-600'
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-600'
      case 'low': return 'bg-green-500/10 text-green-600 border-green-600'
    }
  }

  const getCategoryColor = (category: NewsArticle['category']) => {
    switch (category) {
      case 'earnings': return 'bg-blue-500/10 text-blue-600 border-blue-600'
      case 'economic': return 'bg-purple-500/10 text-purple-600 border-purple-600'
      case 'geopolitical': return 'bg-red-500/10 text-red-600 border-red-600'
      case 'regulatory': return 'bg-yellow-500/10 text-yellow-600 border-yellow-600'
      case 'corporate': return 'bg-green-500/10 text-green-600 border-green-600'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  // Use real data from API or fallback to mock data for development
  const displayNews = newsArticles.length > 0 ? newsArticles : mockNews

  const flashNews = displayNews.filter(article => article.isFlash)
  const regularNews = selectedSymbol
    ? displayNews.filter(article => article.symbols.includes(selectedSymbol) && !article.isFlash)
    : displayNews.filter(article => !article.isFlash)

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Newspaper className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold">Market News</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Real-time market news with AI-powered sentiment analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {loading && newsArticles.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Loading latest market news...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-2 border-red-500/20 bg-red-500/5">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <AlertCircle className="h-8 w-8 mx-auto text-red-600" />
              <p className="text-red-600 font-medium">{error}</p>
              <Button onClick={handleRefresh} variant="outline">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flash News Section */}
      {!loading && flashNews.length > 0 && (
        <Card className="border-2 border-red-500/20 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Zap className="h-5 w-5 animate-pulse" />
              Flash News - Breaking Stories
            </CardTitle>
            <CardDescription>
              Critical market-moving news updated in real-time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {flashNews.map((article) => (
              <Card key={article.id} className="hover:bg-accent transition-colors border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-14 h-14 rounded-lg ${getSentimentBg(article.sentimentScore)} flex items-center justify-center`}>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${getSentimentColor(article.sentimentScore)}`}>
                          {article.sentimentScore > 0 ? '+' : ''}{article.sentimentScore}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{article.source}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{formatTimeAgo(article.publishedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getImpactColor(article.impact)}>
                            {article.impact.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={getCategoryColor(article.category)}>
                            {article.category.toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold mb-2">
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors flex items-center gap-2">
                          {article.title}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </h3>

                      <p className="text-sm text-muted-foreground mb-3">{article.summary}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Related:</span>
                          {article.symbols.map((symbol) => (
                            <Badge
                              key={symbol}
                              className="cursor-pointer bg-blue-600 hover:bg-blue-700"
                              onClick={() => setSelectedSymbol(symbol)}
                            >
                              {symbol}
                            </Badge>
                          ))}
                        </div>
                        <div className={`text-sm font-medium ${getSentimentColor(article.sentimentScore)}`}>
                          {getSentimentLabel(article.sentimentScore)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search news articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Time Range */}
            <div className="flex gap-2">
              {(['1H', '4H', '1D', '1W', '1M'] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>

            {/* Refresh */}
            <Button variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {selectedSymbol && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtering by:</span>
              <Badge className="bg-blue-600">
                {selectedSymbol}
                <button onClick={() => setSelectedSymbol(null)} className="ml-2">×</button>
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regular News Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">All News</CardTitle>
              <CardDescription>
                {selectedSymbol ? `News for ${selectedSymbol}` : 'Market news across all sectors'} • {regularNews.length} articles
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {regularNews.map((article) => (
            <Card key={article.id} className="hover:bg-accent transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${getSentimentBg(article.sentimentScore)} flex items-center justify-center`}>
                    <div className="text-center">
                      <div className={`text-xl font-bold ${getSentimentColor(article.sentimentScore)}`}>
                        {article.sentimentScore > 0 ? '+' : ''}{article.sentimentScore}
                      </div>
                      <div className="text-xs text-muted-foreground">Score</div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{article.source}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(article.publishedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getImpactColor(article.impact)}>
                          {article.impact.toUpperCase()} IMPACT
                        </Badge>
                        <Badge variant="outline" className={getCategoryColor(article.category)}>
                          {article.category.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-2 leading-tight">
                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors flex items-center gap-2">
                        {article.title}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </h3>

                    <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{article.summary}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Related stocks:</span>
                        <div className="flex gap-1">
                          {article.symbols.map((symbol) => (
                            <Badge
                              key={symbol}
                              variant="outline"
                              className={`cursor-pointer ${selectedSymbol === symbol ? 'bg-blue-100 border-blue-600' : ''}`}
                              onClick={() => setSelectedSymbol(symbol === selectedSymbol ? null : symbol)}
                            >
                              {symbol}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${getSentimentColor(article.sentimentScore)}`}>
                          {getSentimentLabel(article.sentimentScore)}
                        </div>
                        <div className="text-xs text-muted-foreground">Sentiment</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {regularNews.length === 0 && (
            <div className="text-center py-12">
              <Newspaper className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No news articles found</h3>
              <p className="text-muted-foreground mb-4">
                {selectedSymbol
                  ? `No news articles found for ${selectedSymbol}.`
                  : 'No news articles available for the selected time range.'}
              </p>
              {selectedSymbol && (
                <Button onClick={() => setSelectedSymbol(null)}>
                  Show all news
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sentiment Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Sentiment Analysis Legend:</span>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Very Bullish / Bullish</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span>Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Bearish / Very Bearish</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
