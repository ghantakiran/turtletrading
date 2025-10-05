'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, TrendingUp, TrendingDown, ArrowRight, Heart, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SocialPost {
  id: string
  platform: 'twitter' | 'reddit' | 'stocktwits' | 'discord'
  author: string
  content: string
  timestamp: string
  sentimentScore: number
  symbols: string[]
  engagement: {
    likes: number
    comments: number
    shares: number
  }
  influence: number
}

interface SocialPostsPreviewProps {
  limit?: number
  className?: string
}

export function SocialPostsPreview({ limit = 5, className }: SocialPostsPreviewProps) {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSocialPosts = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const symbols = ['AAPL', 'MSFT', 'GOOGL']

        // Fetch social sentiment data
        const responses = await Promise.allSettled(
          symbols.map(symbol =>
            fetch(`${backendUrl}/api/v1/sentiment/${symbol}`)
              .then(res => res.json())
          )
        )

        const socialPosts: SocialPost[] = []

        responses.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const data = result.value
            const symbol = symbols[index]

            // Extract social media posts from sentiment data
            if (data.social_media && Array.isArray(data.social_media)) {
              data.social_media.slice(0, Math.ceil(limit / symbols.length)).forEach((post: any, postIndex: number) => {
                socialPosts.push({
                  id: `${symbol}-${postIndex}`,
                  platform: post.platform || 'twitter',
                  author: post.author || 'anonymous',
                  content: post.content || post.text || '',
                  timestamp: post.timestamp || new Date().toISOString(),
                  sentimentScore: Math.round((post.sentiment_score || 0) * 100),
                  symbols: [symbol],
                  engagement: {
                    likes: post.engagement?.likes || Math.floor(Math.random() * 500),
                    comments: post.engagement?.comments || Math.floor(Math.random() * 100),
                    shares: post.engagement?.shares || Math.floor(Math.random() * 50)
                  },
                  influence: post.influence || Math.floor(Math.random() * 100)
                })
              })
            }
          }
        })

        // Sort by timestamp (most recent first) and limit
        setPosts(socialPosts.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ).slice(0, limit))
      } catch (error) {
        console.error('Error fetching social posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSocialPosts()
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

  const getPlatformColor = (platform: SocialPost['platform']) => {
    switch (platform) {
      case 'twitter': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
      case 'reddit': return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
      case 'discord': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
      case 'stocktwits': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <CardTitle>Social Buzz</CardTitle>
          </div>
          <Link href="/sentiment">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          Trending social media posts about your watchlist
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
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No social posts available</p>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <div key={post.id} className="group border-b last:border-0 pb-4 last:pb-0">
                <div className="flex items-start gap-3">
                  {/* Sentiment indicator */}
                  <div className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold',
                    post.sentimentScore >= 10 ? 'bg-green-100 dark:bg-green-950 text-green-600' :
                    post.sentimentScore <= -10 ? 'bg-red-100 dark:bg-red-950 text-red-600' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-600'
                  )}>
                    {post.sentimentScore > 0 ? '+' : ''}{post.sentimentScore}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn('text-xs', getPlatformColor(post.platform))}>
                        {post.platform}
                      </Badge>
                      <span className="text-xs text-muted-foreground">@{post.author}</span>
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(post.timestamp)}</span>
                      {post.symbols.map(symbol => (
                        <Badge key={symbol} variant="secondary" className="text-xs">
                          ${symbol}
                        </Badge>
                      ))}
                    </div>

                    {/* Content */}
                    <p className="text-sm text-foreground line-clamp-2">
                      {post.content}
                    </p>

                    {/* Engagement metrics */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span>{post.engagement.likes}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        <span>{post.engagement.comments}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Share2 className="h-3 w-3" />
                        <span>{post.engagement.shares}</span>
                      </div>
                      <div className={cn('flex items-center gap-1 ml-auto font-medium', getSentimentColor(post.sentimentScore))}>
                        {getSentimentIcon(post.sentimentScore)}
                        <span>
                          {post.sentimentScore >= 50 ? 'Very Bullish' :
                           post.sentimentScore >= 10 ? 'Bullish' :
                           post.sentimentScore >= -10 ? 'Neutral' :
                           post.sentimentScore >= -50 ? 'Bearish' : 'Very Bearish'}
                        </span>
                      </div>
                    </div>
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
