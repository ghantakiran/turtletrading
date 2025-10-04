'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NewsItem {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string
  symbols: string[]
  sentimentScore: number
  impact: 'high' | 'medium' | 'low'
}

interface NewsPreviewProps {
  limit?: number
  className?: string
}

export function NewsPreview({ limit = 5, className }: NewsPreviewProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const symbols = ['AAPL', 'MSFT', 'GOOGL']

        const responses = await Promise.allSettled(
          symbols.map(symbol =>
            fetch(`${backendUrl}/api/v1/sentiment/${symbol}`)
              .then(res => res.json())
          )
        )

        const allNews: NewsItem[] = []

        responses.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const data = result.value
            const symbol = symbols[index]

            data.recent_news?.slice(0, 2).forEach((newsItem: any, newsIndex: number) => {
              const sentimentScore = Math.round(newsItem.sentiment_score * 100)
              const sentimentMagnitude = Math.abs(newsItem.sentiment_score)

              let impact: NewsItem['impact'] = 'low'
              if (sentimentMagnitude > 0.6) impact = 'high'
              else if (sentimentMagnitude > 0.3) impact = 'medium'

              allNews.push({
                id: `${symbol}-${newsIndex}`,
                title: newsItem.title,
                source: newsItem.source,
                url: newsItem.url,
                publishedAt: newsItem.published_at,
                symbols: [symbol],
                sentimentScore,
                impact
              })
            })
          }
        })

        allNews.sort((a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        )

        setNews(allNews.slice(0, limit))
      } catch (error) {
        console.error('Error fetching news:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [limit])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const getSentimentColor = (score: number) => {
    if (score >= 50) return 'text-green-600'
    if (score >= 10) return 'text-green-500'
    if (score >= -10) return 'text-gray-600'
    if (score >= -50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getSentimentIcon = (score: number) => {
    if (score > 10) return <TrendingUp className="h-3 w-3" />
    if (score < -10) return <TrendingDown className="h-3 w-3" />
    return null
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            <CardTitle>Latest Market News</CardTitle>
          </div>
          <Link href="/news">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          AI-powered sentiment analysis on market news
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent news available</p>
        ) : (
          <div className="space-y-4">
            {news.map(article => (
              <div key={article.id} className="group border-b last:border-0 pb-4 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline group-hover:text-primary"
                    >
                      {article.title}
                    </a>
                    <div className="flex items-center gap-2 flex-wrap">
                      {article.symbols.map(symbol => (
                        <Badge key={symbol} variant="outline" className="text-xs">
                          {symbol}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">{article.source}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(article.publishedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={cn('flex items-center gap-1 text-xs font-medium', getSentimentColor(article.sentimentScore))}>
                      {getSentimentIcon(article.sentimentScore)}
                      <span>{article.sentimentScore > 0 ? '+' : ''}{article.sentimentScore}</span>
                    </div>
                    {article.impact === 'high' && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        HIGH
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
