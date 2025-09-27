import { Metadata } from 'next'
import { cache } from 'react'
import { Suspense } from 'react'
import { SentimentClient } from './SentimentClient'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Market Sentiment - TurtleTrading Pro',
  description: 'Real-time market sentiment analysis from news, social media, and institutional data with AI-powered insights.',
  keywords: 'market sentiment, news analysis, social media sentiment, fear greed index, sentiment score, market psychology',
  openGraph: {
    title: 'Market Sentiment - TurtleTrading Pro',
    description: 'AI-powered sentiment analysis for informed trading decisions',
    type: 'website',
  },
}

// Types for sentiment data
export interface SentimentScore {
  overall: number // -100 to 100
  news: number
  social: number
  institutional: number
  timestamp: string
  confidence: number
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  sentimentScore: number
  impact: 'high' | 'medium' | 'low'
  symbols: string[]
  category: 'earnings' | 'economic' | 'geopolitical' | 'regulatory' | 'corporate'
}

export interface SocialMediaFeed {
  id: string
  platform: 'twitter' | 'reddit' | 'discord' | 'stocktwits'
  content: string
  author: string
  timestamp: string
  sentimentScore: number
  engagement: {
    likes: number
    shares: number
    comments: number
  }
  symbols: string[]
  influence: number // 1-100
}

export interface SectorSentiment {
  sector: string
  score: number
  change24h: number
  newsCount: number
  socialMentions: number
  keyThemes: string[]
  topStocks: {
    symbol: string
    score: number
    mentions: number
  }[]
}

export interface SentimentIndicators {
  fearGreedIndex: number
  putCallRatio: number
  vixSentiment: number
  insiderActivity: number
  institutionalFlow: number
  retailSentiment: number
}

export interface SentimentData {
  overallSentiment: SentimentScore
  news: NewsItem[]
  socialMedia: SocialMediaFeed[]
  sectorSentiment: SectorSentiment[]
  indicators: SentimentIndicators
  lastUpdated: string
}

// Cached data fetcher with React cache API
const getSentimentData = cache(async (): Promise<SentimentData> => {
  console.log('🚀 Fetching sentiment data on server...')

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

    const [sentimentResponse, newsResponse, socialResponse, sectorsResponse] = await Promise.allSettled([
      fetch(`${baseUrl}/api/v1/sentiment/overall`, {
        next: { revalidate: 300 }, // Cache for 5 minutes
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TurtleTrading-NextJS/1.0',
        },
      }),
      fetch(`${baseUrl}/api/v1/sentiment/news`, {
        next: { revalidate: 600 }, // Cache for 10 minutes
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TurtleTrading-NextJS/1.0',
        },
      }),
      fetch(`${baseUrl}/api/v1/sentiment/social`, {
        next: { revalidate: 300 }, // Cache for 5 minutes
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TurtleTrading-NextJS/1.0',
        },
      }),
      fetch(`${baseUrl}/api/v1/sentiment/sectors`, {
        next: { revalidate: 900 }, // Cache for 15 minutes
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TurtleTrading-NextJS/1.0',
        },
      }),
    ])

    // Handle overall sentiment
    let overallSentiment: SentimentScore
    if (sentimentResponse.status === 'fulfilled' && sentimentResponse.value.ok) {
      overallSentiment = await sentimentResponse.value.json()
    } else {
      console.warn('Failed to fetch overall sentiment, using mock data')
      overallSentiment = getMockOverallSentiment()
    }

    // Handle news data
    let news: NewsItem[] = []
    if (newsResponse.status === 'fulfilled' && newsResponse.value.ok) {
      news = await newsResponse.value.json()
    } else {
      console.warn('Failed to fetch news, using mock data')
      news = getMockNews()
    }

    // Handle social media data
    let socialMedia: SocialMediaFeed[] = []
    if (socialResponse.status === 'fulfilled' && socialResponse.value.ok) {
      socialMedia = await socialResponse.value.json()
    } else {
      console.warn('Failed to fetch social media, using mock data')
      socialMedia = getMockSocialMedia()
    }

    // Handle sector sentiment
    let sectorSentiment: SectorSentiment[] = []
    if (sectorsResponse.status === 'fulfilled' && sectorsResponse.value.ok) {
      sectorSentiment = await sectorsResponse.value.json()
    } else {
      console.warn('Failed to fetch sector sentiment, using mock data')
      sectorSentiment = getMockSectorSentiment()
    }

    console.log('📊 Using real sentiment data from API')
    return {
      overallSentiment,
      news,
      socialMedia,
      sectorSentiment,
      indicators: getMockIndicators(),
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('❌ Failed to fetch sentiment data:', error)
    console.log('📊 Falling back to mock sentiment data')

    return {
      overallSentiment: getMockOverallSentiment(),
      news: getMockNews(),
      socialMedia: getMockSocialMedia(),
      sectorSentiment: getMockSectorSentiment(),
      indicators: getMockIndicators(),
      lastUpdated: new Date().toISOString(),
    }
  }
})

// Mock data functions
function getMockOverallSentiment(): SentimentScore {
  return {
    overall: 23,
    news: 18,
    social: 35,
    institutional: 15,
    timestamp: new Date().toISOString(),
    confidence: 0.78,
  }
}

function getMockNews(): NewsItem[] {
  return [
    {
      id: '1',
      title: 'Federal Reserve Signals Potential Rate Changes',
      summary: 'The Federal Reserve indicated potential monetary policy adjustments in the coming months, citing inflation concerns and economic growth targets.',
      source: 'Reuters',
      url: 'https://example.com/news/1',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      sentimentScore: -15,
      impact: 'high',
      symbols: ['SPY', 'QQQ', 'DIA'],
      category: 'economic',
    },
    {
      id: '2',
      title: 'Tech Earnings Beat Expectations Across Sector',
      summary: 'Major technology companies reported strong quarterly earnings, boosting investor confidence in the sector despite macroeconomic headwinds.',
      source: 'Bloomberg',
      url: 'https://example.com/news/2',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      sentimentScore: 45,
      impact: 'medium',
      symbols: ['AAPL', 'MSFT', 'GOOGL', 'META'],
      category: 'earnings',
    },
    {
      id: '3',
      title: 'Oil Prices Surge on Supply Chain Concerns',
      summary: 'Crude oil prices jumped 3% following reports of potential supply disruptions and increased demand forecasts.',
      source: 'CNBC',
      url: 'https://example.com/news/3',
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      sentimentScore: 25,
      impact: 'medium',
      symbols: ['XOM', 'CVX', 'USO'],
      category: 'economic',
    },
  ]
}

function getMockSocialMedia(): SocialMediaFeed[] {
  return [
    {
      id: '1',
      platform: 'twitter',
      content: 'Just analyzed the latest market trends. Seeing strong bullish signals in tech sector. $AAPL $MSFT looking strong! 📈',
      author: '@TechTrader_Pro',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      sentimentScore: 65,
      engagement: {
        likes: 234,
        shares: 45,
        comments: 67,
      },
      symbols: ['AAPL', 'MSFT'],
      influence: 78,
    },
    {
      id: '2',
      platform: 'reddit',
      content: 'Market volatility increasing. VIX levels suggest we might see more turbulence ahead. Stay cautious with position sizing.',
      author: 'u/MarketWatcher_2024',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      sentimentScore: -25,
      engagement: {
        likes: 156,
        shares: 23,
        comments: 89,
      },
      symbols: ['VIX', 'SPY'],
      influence: 65,
    },
    {
      id: '3',
      platform: 'stocktwits',
      content: '$TSLA breaking out of resistance! Volume is picking up. Could see a run to $300. #bullish #momentum',
      author: 'MomentumTrader23',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      sentimentScore: 80,
      engagement: {
        likes: 89,
        shares: 34,
        comments: 23,
      },
      symbols: ['TSLA'],
      influence: 45,
    },
  ]
}

function getMockSectorSentiment(): SectorSentiment[] {
  return [
    {
      sector: 'Technology',
      score: 35,
      change24h: 8,
      newsCount: 147,
      socialMentions: 2341,
      keyThemes: ['earnings', 'AI advancement', 'cloud growth'],
      topStocks: [
        { symbol: 'AAPL', score: 42, mentions: 567 },
        { symbol: 'MSFT', score: 38, mentions: 432 },
        { symbol: 'GOOGL', score: 28, mentions: 321 },
      ],
    },
    {
      sector: 'Healthcare',
      score: 15,
      change24h: -5,
      newsCount: 89,
      socialMentions: 1234,
      keyThemes: ['drug approvals', 'regulatory concerns', 'biotech IPOs'],
      topStocks: [
        { symbol: 'JNJ', score: 22, mentions: 234 },
        { symbol: 'PFE', score: 18, mentions: 189 },
        { symbol: 'UNH', score: 8, mentions: 156 },
      ],
    },
    {
      sector: 'Financial Services',
      score: -12,
      change24h: -18,
      newsCount: 76,
      socialMentions: 987,
      keyThemes: ['interest rates', 'banking stress', 'credit concerns'],
      topStocks: [
        { symbol: 'JPM', score: -8, mentions: 198 },
        { symbol: 'BAC', score: -15, mentions: 167 },
        { symbol: 'WFC', score: -18, mentions: 134 },
      ],
    },
  ]
}

function getMockIndicators(): SentimentIndicators {
  return {
    fearGreedIndex: 67, // 0-100 (0 = extreme fear, 100 = extreme greed)
    putCallRatio: 0.85,
    vixSentiment: 18.5,
    insiderActivity: 45,
    institutionalFlow: 1250000000, // Net flow in dollars
    retailSentiment: 62,
  }
}

// Loading component for sentiment data
function SentimentDataLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-muted-foreground">Loading sentiment analysis...</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

// Server Component wrapper for data fetching
async function SentimentDataProvider() {
  const sentimentData = await getSentimentData()

  return (
    <ErrorBoundary level="page">
      <SentimentClient initialData={sentimentData} />
    </ErrorBoundary>
  )
}

// Main page component with SSR
export default function SentimentPage() {
  console.log('🚀 Rendering Sentiment page (Server Component)')

  return (
    <SentimentDataLoader>
      <SentimentDataProvider />
    </SentimentDataLoader>
  )
}