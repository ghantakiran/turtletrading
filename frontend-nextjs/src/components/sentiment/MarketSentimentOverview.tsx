'use client'

import { useEffect, useState } from 'react'
import { SentimentGauge } from './SentimentGauge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Activity } from 'lucide-react'

interface SentimentData {
  symbol: string
  overall_sentiment: number
  sentiment_label: string
  confidence: number
  total_mentions: number
  trending_score: number
}

export function MarketSentimentOverview() {
  const [sentiments, setSentiments] = useState<SentimentData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSentiments = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const symbols = ['AAPL', 'MSFT', 'GOOGL']

        const responses = await Promise.allSettled(
          symbols.map(symbol =>
            fetch(`${backendUrl}/api/v1/sentiment/${symbol}`)
              .then(res => res.json())
          )
        )

        const sentimentData: SentimentData[] = []

        responses.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const data = result.value
            sentimentData.push({
              symbol: symbols[index],
              overall_sentiment: data.overall_sentiment,
              sentiment_label: data.sentiment_label,
              confidence: data.confidence,
              total_mentions: data.total_mentions,
              trending_score: data.trending_score
            })
          }
        })

        setSentiments(sentimentData)
      } catch (error) {
        console.error('Error fetching sentiments:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSentiments()
  }, [])

  const averageSentiment = sentiments.length > 0
    ? sentiments.reduce((sum, s) => sum + s.overall_sentiment, 0) / sentiments.length
    : 0

  const getMarketMood = (sentiment: number) => {
    if (sentiment > 0.3) return { mood: 'Very Bullish', color: 'text-green-600' }
    if (sentiment > 0.1) return { mood: 'Bullish', color: 'text-green-500' }
    if (sentiment > -0.1) return { mood: 'Neutral', color: 'text-gray-600' }
    if (sentiment > -0.3) return { mood: 'Bearish', color: 'text-orange-500' }
    return { mood: 'Very Bearish', color: 'text-red-600' }
  }

  const marketMood = getMarketMood(averageSentiment)

  return (
    <div className="space-y-4">
      {/* Overall Market Mood */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <CardTitle>Market Sentiment</CardTitle>
            </div>
            <div className={`flex items-center gap-2 ${marketMood.color}`}>
              <TrendingUp className="h-5 w-5" />
              <span className="font-bold text-lg">{marketMood.mood}</span>
            </div>
          </div>
          <CardDescription>
            AI-powered sentiment analysis across major stocks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading sentiment data...</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Bearish</span>
                <span>Neutral</span>
                <span>Bullish</span>
              </div>
              <div className="relative h-4 bg-gradient-to-r from-red-500 via-gray-300 to-green-500 rounded-full">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-6 bg-white border-2 border-gray-800 rounded-full transition-all duration-500 shadow-lg"
                  style={{
                    left: `${((averageSentiment + 1) / 2) * 100}%`,
                    transform: 'translateX(-50%) translateY(-50%)'
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Overall market sentiment: {(averageSentiment * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Stock Sentiments */}
      {!loading && sentiments.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sentiments.map(sentiment => (
            <SentimentGauge
              key={sentiment.symbol}
              symbol={sentiment.symbol}
              sentimentScore={sentiment.overall_sentiment}
              sentimentLabel={sentiment.sentiment_label}
              confidence={sentiment.confidence}
              totalMentions={sentiment.total_mentions}
              trendingScore={sentiment.trending_score}
            />
          ))}
        </div>
      )}
    </div>
  )
}
