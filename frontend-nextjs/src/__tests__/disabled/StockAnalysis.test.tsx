import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import StockAnalysisClient from '@/app/(protected)/analysis/[symbol]/StockAnalysisClient'

// Mock the stores
vi.mock('@/stores', () => ({
  useMarketStore: () => ({
    stockPrices: {},
    addToWatchlist: vi.fn(),
    isConnected: true,
    updateStockPrice: vi.fn(),
    technicalIndicators: {},
    aiAnalysis: {},
    marketSentiment: {}
  })
}))

// Mock the WebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useStockWebSocket: () => ({
    isConnected: true,
    connectionStatus: 'connected',
    subscribe: vi.fn(),
    unsubscribe: vi.fn()
  })
}))

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('StockAnalysisClient', () => {
  const mockInitialData = {
    stockData: {
      symbol: 'AAPL',
      current_price: 150.25,
      change: 2.50,
      change_percent: 1.69,
      volume: 45000000,
      market_cap: 2800000000000,
      high_52_week: 180.00,
      low_52_week: 120.00
    },
    technicalData: {
      rsi: 65.5,
      macd: 1.2,
      sma_20: 148.0,
      sma_50: 145.0,
      sma_200: 140.0,
      bollinger_upper: 155.0,
      bollinger_lower: 145.0,
      bollinger_middle: 150.0,
      technical_score: 0.75
    },
    lstmData: {
      predicted_price: 155.0,
      predictions: [
        { date: '2024-01-01', price: 152.0, confidence: 0.85 },
        { date: '2024-01-02', price: 154.0, confidence: 0.82 },
        { date: '2024-01-03', price: 155.0, confidence: 0.80 }
      ],
      confidence: 0.82,
      trend: 'bullish' as const,
      time_horizon: '5 days',
      lstm_score: 0.78
    },
    sentimentData: {
      sentiment_score: 0.15,
      articles_count: 25,
      social_mentions: 150,
      news_sentiment: 0.1,
      social_sentiment: 0.2
    },
    analysisScore: {
      final_score: 0.72,
      technical_weight: 50,
      lstm_weight: 30,
      sentiment_weight: 20,
      seasonality_weight: 0,
      recommendation: 'BUY' as const,
      key_factors: ['Strong technical indicators', 'Positive AI prediction'],
      risk_level: 'MEDIUM' as const,
      target_price: 175.0,
      stop_loss: 135.0
    },
    priceHistory: [
      { date: '2024-01-01', price: 148.0, volume: 40000000, high: 150.0, low: 147.0 },
      { date: '2024-01-02', price: 149.0, volume: 42000000, high: 151.0, low: 148.0 },
      { date: '2024-01-03', price: 150.25, volume: 45000000, high: 152.0, low: 149.0 }
    ],
    symbol: 'AAPL',
    errors: {
      stockData: null,
      technicalData: null,
      lstmData: null,
      sentimentData: null
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders stock analysis header correctly', async () => {
    render(<StockAnalysisClient initialData={mockInitialData} />)

    expect(screen.getByText('AAPL Analysis')).toBeInTheDocument()
    expect(screen.getByText('$150.25')).toBeInTheDocument()
    expect(screen.getByText('+$2.50')).toBeInTheDocument()
    expect(screen.getByText('(1.69%)')).toBeInTheDocument()
  })

  it('displays overall analysis score', async () => {
    render(<StockAnalysisClient initialData={mockInitialData} />)

    expect(screen.getByText('Overall Analysis Score')).toBeInTheDocument()
    expect(screen.getByText('BUY')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('shows market cap and volume in overview tab', async () => {
    render(<StockAnalysisClient initialData={mockInitialData} />)

    // Market cap should be displayed in billions
    expect(screen.getByText('$2800.00B')).toBeInTheDocument()

    // Volume should be displayed in millions
    expect(screen.getByText('45.00M')).toBeInTheDocument()
  })

  it('displays technical indicators', async () => {
    render(<StockAnalysisClient initialData={mockInitialData} />)

    // Click on Technical tab
    const technicalTab = screen.getByText('Technical')
    technicalTab.click()

    await waitFor(() => {
      expect(screen.getByText('65.50')).toBeInTheDocument() // RSI value
      expect(screen.getByText('75%')).toBeInTheDocument() // Technical score
    })
  })

  it('shows LSTM prediction in AI tab', async () => {
    render(<StockAnalysisClient initialData={mockInitialData} />)

    // Click on AI Analysis tab
    const aiTab = screen.getByText('AI Analysis')
    aiTab.click()

    await waitFor(() => {
      expect(screen.getByText('$155.00')).toBeInTheDocument() // Predicted price
      expect(screen.getByText('82%')).toBeInTheDocument() // Confidence
      expect(screen.getByText('BULLISH')).toBeInTheDocument() // Trend
    })
  })

  it('displays sentiment data', async () => {
    render(<StockAnalysisClient initialData={mockInitialData} />)

    // Click on Sentiment tab
    const sentimentTab = screen.getByText('Sentiment')
    sentimentTab.click()

    await waitFor(() => {
      expect(screen.getByText('Positive')).toBeInTheDocument() // Overall sentiment
      expect(screen.getByText('25')).toBeInTheDocument() // Articles count
      expect(screen.getByText('150')).toBeInTheDocument() // Social mentions
    })
  })

  it('handles error state when stock data is missing', async () => {
    const errorData = {
      ...mockInitialData,
      stockData: null,
      errors: {
        ...mockInitialData.errors,
        stockData: 'Stock not found'
      }
    }

    render(<StockAnalysisClient initialData={errorData} />)

    expect(screen.getByText('Error Loading Stock Data')).toBeInTheDocument()
    expect(screen.getByText('Stock not found')).toBeInTheDocument()
  })

  it('shows partial data warning when some data is missing', async () => {
    const partialData = {
      ...mockInitialData,
      technicalData: null,
      errors: {
        ...mockInitialData.errors,
        technicalData: 'Technical analysis failed'
      }
    }

    render(<StockAnalysisClient initialData={partialData} />)

    expect(screen.getByText('Partial Data')).toBeInTheDocument()
  })

  it('displays connection status badge', async () => {
    render(<StockAnalysisClient initialData={mockInitialData} />)

    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})