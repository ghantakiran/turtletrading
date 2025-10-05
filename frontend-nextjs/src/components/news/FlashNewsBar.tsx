'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FlashNewsItem {
  id: string
  title: string
  symbol: string
  impact: 'high' | 'medium' | 'low'
  sentiment: number
  timestamp: string
  url: string
}

export function FlashNewsBar() {
  const [flashNews, setFlashNews] = useState<FlashNewsItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFlashNews = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']

        const response = await fetch(
          `${backendUrl}/api/v1/news/market/enhanced?${symbols.map(s => `symbols=${s}`).join('&')}&limit_per_symbol=2&use_ai=true`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch flash news')
        }

        const data = await response.json()

        // Extract flash news items
        const flashItems: FlashNewsItem[] = (data.flash_news || []).map((item: any, index: number) => ({
          id: `flash-${index}`,
          title: item.title,
          symbol: item.symbols[0] || 'MARKET',
          impact: item.impact_level,
          sentiment: item.sentiment_score,
          timestamp: item.published_at,
          url: item.url
        }))

        setFlashNews(flashItems)
      } catch (error) {
        console.error('Error fetching flash news:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFlashNews()
    // Refresh flash news every 5 minutes
    const interval = setInterval(fetchFlashNews, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (flashNews.length === 0) return

    // Rotate through flash news items
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % flashNews.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [flashNews.length])

  if (loading || flashNews.length === 0) {
    return null
  }

  const currentNews = flashNews[currentIndex]
  const impactColor = {
    high: 'border-red-500 bg-red-50 dark:bg-red-950/20',
    medium: 'border-orange-500 bg-orange-50 dark:bg-orange-950/20',
    low: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
  }

  return (
    <Alert
      className={cn(
        'border-l-4 transition-all duration-500',
        impactColor[currentNews.impact]
      )}
    >
      <div className="flex items-center gap-3 w-full">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-orange-600 animate-pulse" />
          <span className="text-xs font-semibold text-muted-foreground">FLASH NEWS</span>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {currentNews.symbol}
          </Badge>

          <AlertDescription className="text-sm font-medium flex-1 truncate">
            <a
              href={currentNews.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {currentNews.title}
            </a>
          </AlertDescription>

          <div className="flex items-center gap-2">
            {currentNews.sentiment > 0.3 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : currentNews.sentiment < -0.3 ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : null}

            <Badge
              variant={currentNews.impact === 'high' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {currentNews.impact.toUpperCase()}
            </Badge>
          </div>
        </div>

        {flashNews.length > 1 && (
          <div className="flex gap-1">
            {flashNews.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-all',
                  index === currentIndex ? 'bg-primary w-4' : 'bg-muted-foreground/30'
                )}
              />
            ))}
          </div>
        )}
      </div>
    </Alert>
  )
}
