import { Metadata } from 'next'
import { cache } from 'react'
import { Suspense } from 'react'
import { MarketClient } from './MarketClient'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Market Overview - TurtleTrading Pro',
  description: 'Comprehensive market analysis with real-time indices, sector heatmaps, market breadth, and institutional-grade insights.',
  keywords: 'market overview, indices, sectors, market breadth, S&P 500, NASDAQ, Dow Jones, VIX',
  openGraph: {
    title: 'Market Overview - TurtleTrading Pro',
    description: 'Real-time market analysis with institutional-grade insights',
    type: 'website',
  },
}

// Types for market data
export interface MarketIndex {
  symbol: string
  name: string
  value: number
  change: number
  changePercent: number
  timestamp: string
  volume?: number
  high52Week?: number
  low52Week?: number
}

export interface SectorData {
  sector: string
  change: number
  changePercent: number
  marketCap: number
  volume: number
  topStocks: {
    symbol: string
    change: number
    changePercent: number
  }[]
}

export interface MarketBreadth {
  advancingStocks: number
  decliningStocks: number
  unchangedStocks: number
  advanceDeclineRatio: number
  newHighs: number
  newLows: number
  upVolume: number
  downVolume: number
  volumeRatio: number
}

export interface MarketData {
  indices: MarketIndex[]
  sectors: SectorData[]
  marketBreadth: MarketBreadth
  lastUpdated: string
}

// Cached data fetcher with React cache API
const getMarketData = cache(async (): Promise<MarketData> => {
  console.log('🚀 Fetching market data on server...')

  // For development, use mock data directly
  const mockData: MarketData = {
    indices: [
      {
        symbol: 'SPY',
        name: 'S&P 500',
        value: 4456.24,
        change: 12.45,
        changePercent: 0.28,
        previousClose: 4443.79,
        high52Week: 4607.07,
        low52Week: 3808.10,
        volume: 85420000,
        marketCap: 40200000000000
      },
      {
        symbol: 'QQQ',
        name: 'NASDAQ 100',
        value: 387.42,
        change: -2.15,
        changePercent: -0.55,
        previousClose: 389.57,
        high52Week: 408.71,
        low52Week: 315.71,
        volume: 42150000,
        marketCap: 16800000000000
      },
      {
        symbol: 'DIA',
        name: 'Dow Jones',
        value: 349.85,
        change: 5.23,
        changePercent: 0.15,
        previousClose: 344.62,
        high52Week: 365.25,
        low52Week: 296.48,
        volume: 3250000,
        marketCap: 12100000000000
      },
      {
        symbol: 'IWM',
        name: 'Russell 2000',
        value: 198.76,
        change: -1.87,
        changePercent: -0.93,
        previousClose: 200.63,
        high52Week: 230.94,
        low52Week: 166.25,
        volume: 28750000,
        marketCap: 2800000000000
      },
      {
        symbol: 'VIX',
        name: 'Volatility Index',
        value: 18.45,
        change: 0.82,
        changePercent: 4.65,
        previousClose: 17.63,
        high52Week: 65.54,
        low52Week: 12.45
      }
    ],
    sectors: [
      {
        sector: 'Technology',
        change: 1.24,
        changePercent: 0.85,
        volume: 2450000000,
        marketCap: 15200000000000,
        companies: 75,
        topPerformers: ['AAPL', 'MSFT', 'NVDA'],
        laggards: ['META', 'GOOGL', 'AMZN']
      },
      {
        sector: 'Healthcare',
        change: 0.67,
        changePercent: 0.42,
        volume: 1120000000,
        marketCap: 8900000000000,
        companies: 63,
        topPerformers: ['JNJ', 'UNH', 'PFE'],
        laggards: ['ABBV', 'TMO', 'ABT']
      },
      {
        sector: 'Financial',
        change: -0.89,
        changePercent: -0.31,
        volume: 1890000000,
        marketCap: 6700000000000,
        companies: 68,
        topPerformers: ['JPM', 'BAC', 'WFC'],
        laggards: ['C', 'GS', 'MS']
      },
      {
        sector: 'Energy',
        change: -2.14,
        changePercent: -1.87,
        volume: 980000000,
        marketCap: 2100000000000,
        companies: 24,
        topPerformers: ['XOM', 'CVX', 'COP'],
        laggards: ['SLB', 'EOG', 'PXD']
      }
    ],
    marketBreadth: {
      advancingStocks: 1847,
      decliningStocks: 1653,
      unchangedStocks: 245,
      totalStocks: 3745,
      advanceDeclineRatio: 1.12,
      newHighs: 89,
      newLows: 34,
      volumeAdvancing: 4250000000,
      volumeDeclining: 3890000000
    },
    lastUpdated: new Date().toISOString()
  }

  return mockData
})

// Mock data for development
function getMockIndices(): MarketIndex[] {
  return [
    {
      symbol: 'SPY',
      name: 'S&P 500',
      value: 4567.89,
      change: 23.45,
      changePercent: 0.52,
      timestamp: new Date().toISOString(),
      volume: 45623000,
      high52Week: 4800.00,
      low52Week: 3500.00,
    },
    {
      symbol: 'QQQ',
      name: 'NASDAQ 100',
      value: 387.23,
      change: -5.67,
      changePercent: -1.44,
      timestamp: new Date().toISOString(),
      volume: 32145000,
      high52Week: 410.00,
      low52Week: 290.00,
    },
    {
      symbol: 'DIA',
      name: 'Dow Jones',
      value: 34567.12,
      change: 156.78,
      changePercent: 0.46,
      timestamp: new Date().toISOString(),
      volume: 12345000,
      high52Week: 36000.00,
      low52Week: 28000.00,
    },
    {
      symbol: 'VIX',
      name: 'Volatility Index',
      value: 18.45,
      change: 2.34,
      changePercent: 14.56,
      timestamp: new Date().toISOString(),
    },
  ]
}

function getMockSectors(): SectorData[] {
  return [
    {
      sector: 'Technology',
      change: 145.67,
      changePercent: 1.23,
      marketCap: 12500000000000,
      volume: 2500000000,
      topStocks: [
        { symbol: 'AAPL', change: 2.45, changePercent: 1.67 },
        { symbol: 'MSFT', change: 3.21, changePercent: 0.89 },
        { symbol: 'GOOGL', change: -1.56, changePercent: -0.78 },
      ],
    },
    {
      sector: 'Healthcare',
      change: -23.45,
      changePercent: -0.34,
      marketCap: 8500000000000,
      volume: 1200000000,
      topStocks: [
        { symbol: 'JNJ', change: -0.89, changePercent: -0.45 },
        { symbol: 'PFE', change: 1.23, changePercent: 2.34 },
        { symbol: 'UNH', change: 4.56, changePercent: 0.78 },
      ],
    },
    {
      sector: 'Financial Services',
      change: 67.89,
      changePercent: 0.89,
      marketCap: 9200000000000,
      volume: 1800000000,
      topStocks: [
        { symbol: 'JPM', change: 2.34, changePercent: 1.23 },
        { symbol: 'BAC', change: 0.78, changePercent: 2.45 },
        { symbol: 'WFC', change: -0.45, changePercent: -0.67 },
      ],
    },
    {
      sector: 'Consumer Cyclical',
      change: 34.56,
      changePercent: 0.45,
      marketCap: 6800000000000,
      volume: 1500000000,
      topStocks: [
        { symbol: 'AMZN', change: 5.67, changePercent: 1.89 },
        { symbol: 'TSLA', change: -8.90, changePercent: -3.45 },
        { symbol: 'HD', change: 1.23, changePercent: 0.34 },
      ],
    },
  ]
}

function getMockMarketBreadth(): MarketBreadth {
  return {
    advancingStocks: 1234,
    decliningStocks: 987,
    unchangedStocks: 156,
    advanceDeclineRatio: 1.25,
    newHighs: 89,
    newLows: 45,
    upVolume: 2345000000,
    downVolume: 1876000000,
    volumeRatio: 1.25,
  }
}

// Loading component for market data
function MarketDataLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-muted-foreground">Loading market data...</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

// Server Component wrapper for data fetching
async function MarketDataProvider() {
  const marketData = await getMarketData()

  return (
    <ErrorBoundary level="page">
      <MarketClient initialData={marketData} />
    </ErrorBoundary>
  )
}

// Main page component with SSR
export default function MarketPage() {
  console.log('🚀 Rendering Market page (Server Component)')

  return (
    <MarketDataLoader>
      <MarketDataProvider />
    </MarketDataLoader>
  )
}