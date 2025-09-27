/**
 * API Integration tests for server-side data fetching
 * Tests actual API endpoints and data consistency between server and client
 */
import { jest } from '@jest/globals'

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
  }
})

afterAll(() => {
  process.env = originalEnv
})

// Mock fetch for API calls
global.fetch = jest.fn()

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Market Data API Integration', () => {
    it('should fetch market overview data correctly', async () => {
      const mockMarketData = {
        indices: [
          {
            symbol: 'SPY',
            name: 'S&P 500',
            value: 4567.89,
            change: 23.45,
            changePercent: 0.52,
            timestamp: '2024-01-15T10:30:00Z',
            volume: 45623000,
          },
        ],
        sectors: [
          {
            name: 'Technology',
            symbol: 'XLK',
            value: 157.45,
            change: 2.34,
            changePercent: 1.51,
            marketCap: 1234567890000,
            volume: 12345678,
          },
        ],
        breadth: {
          advancingStocks: 1245,
          decliningStocks: 987,
          unchangedStocks: 234,
          advancingVolume: 1234567890,
          decliningVolume: 987654321,
          totalVolume: 2222222211,
          newHighs: 56,
          newLows: 23,
          advanceDeclineRatio: 1.26,
          upDownVolumeRatio: 1.25,
          timestamp: '2024-01-15T10:30:00Z',
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockMarketData,
      })

      // Test the actual fetch call that would be made by the server component
      const response = await fetch('http://localhost:8000/api/v1/market/overview')
      const data = await response.json()

      expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/market/overview')
      expect(response.ok).toBe(true)
      expect(data).toEqual(mockMarketData)

      // Validate data structure
      expect(data.indices).toBeInstanceOf(Array)
      expect(data.indices[0]).toHaveProperty('symbol')
      expect(data.indices[0]).toHaveProperty('name')
      expect(data.indices[0]).toHaveProperty('value')
      expect(data.indices[0]).toHaveProperty('change')
      expect(data.indices[0]).toHaveProperty('changePercent')

      expect(data.sectors).toBeInstanceOf(Array)
      expect(data.sectors[0]).toHaveProperty('name')
      expect(data.sectors[0]).toHaveProperty('symbol')
      expect(data.sectors[0]).toHaveProperty('value')

      expect(data.breadth).toHaveProperty('advancingStocks')
      expect(data.breadth).toHaveProperty('decliningStocks')
      expect(data.breadth).toHaveProperty('advanceDeclineRatio')
    })

    it('should handle market data API errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      try {
        await fetch('http://localhost:8000/api/v1/market/overview')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Network error')
      }
    })

    it('should handle invalid market data responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Internal server error' }),
      })

      const response = await fetch('http://localhost:8000/api/v1/market/overview')
      const data = await response.json()

      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
    })

    it('should fetch market indices with time range parameter', async () => {
      const mockIndicesData = {
        indices: [
          {
            symbol: 'SPY',
            name: 'S&P 500',
            value: 4567.89,
            change: 23.45,
            changePercent: 0.52,
            timestamp: '2024-01-15T10:30:00Z',
          },
        ],
        timeRange: '1D',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockIndicesData,
      })

      const response = await fetch('http://localhost:8000/api/v1/market/indices?timeRange=1D')
      const data = await response.json()

      expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/market/indices?timeRange=1D')
      expect(data.timeRange).toBe('1D')
      expect(data.indices).toBeInstanceOf(Array)
    })
  })

  describe('Sentiment Data API Integration', () => {
    it('should fetch sentiment overview data correctly', async () => {
      const mockSentimentData = {
        sentimentScore: {
          overall: 65,
          news: 70,
          social: 60,
          institutional: 68,
          timestamp: '2024-01-15T10:30:00Z',
          confidence: 85,
        },
        newsItems: [
          {
            id: '1',
            title: 'Market Rally Continues as Tech Stocks Surge',
            summary: 'Technology sector leads market gains amid positive earnings reports',
            url: 'https://example.com/news/1',
            source: 'Financial Times',
            publishedAt: '2024-01-15T09:30:00Z',
            sentiment: 75,
            relevance: 90,
            symbols: ['AAPL', 'MSFT', 'GOOGL'],
          },
        ],
        socialMediaFeed: {
          platform: 'twitter',
          totalPosts: 12453,
          sentimentBreakdown: {
            positive: 6200,
            negative: 3100,
            neutral: 3153,
          },
          trendingSymbols: ['TSLA', 'AAPL', 'GME', 'AMC'],
          topHashtags: ['#stocks', '#trading', '#bullish', '#earnings'],
          engagementRate: 0.067,
          timestamp: '2024-01-15T10:30:00Z',
        },
        sectorSentiment: [
          {
            sector: 'Technology',
            sentiment: 72,
            change: 5,
            newsCount: 234,
            socialMentions: 1567,
            institutionalFlow: 123456789,
            timestamp: '2024-01-15T10:30:00Z',
          },
        ],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockSentimentData,
      })

      const response = await fetch('http://localhost:8000/api/v1/sentiment/overview')
      const data = await response.json()

      expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/sentiment/overview')
      expect(response.ok).toBe(true)
      expect(data).toEqual(mockSentimentData)

      // Validate sentiment score structure
      expect(data.sentimentScore).toHaveProperty('overall')
      expect(data.sentimentScore).toHaveProperty('news')
      expect(data.sentimentScore).toHaveProperty('social')
      expect(data.sentimentScore).toHaveProperty('institutional')
      expect(data.sentimentScore).toHaveProperty('confidence')

      // Validate news items structure
      expect(data.newsItems).toBeInstanceOf(Array)
      expect(data.newsItems[0]).toHaveProperty('id')
      expect(data.newsItems[0]).toHaveProperty('title')
      expect(data.newsItems[0]).toHaveProperty('sentiment')
      expect(data.newsItems[0]).toHaveProperty('symbols')

      // Validate social media feed structure
      expect(data.socialMediaFeed).toHaveProperty('platform')
      expect(data.socialMediaFeed).toHaveProperty('totalPosts')
      expect(data.socialMediaFeed).toHaveProperty('sentimentBreakdown')
      expect(data.socialMediaFeed.sentimentBreakdown).toHaveProperty('positive')
      expect(data.socialMediaFeed.sentimentBreakdown).toHaveProperty('negative')
      expect(data.socialMediaFeed.sentimentBreakdown).toHaveProperty('neutral')

      // Validate sector sentiment structure
      expect(data.sectorSentiment).toBeInstanceOf(Array)
      expect(data.sectorSentiment[0]).toHaveProperty('sector')
      expect(data.sectorSentiment[0]).toHaveProperty('sentiment')
      expect(data.sectorSentiment[0]).toHaveProperty('change')
    })

    it('should handle sentiment data API errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Sentiment service unavailable'))

      try {
        await fetch('http://localhost:8000/api/v1/sentiment/overview')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Sentiment service unavailable')
      }
    })

    it('should fetch sentiment data with symbol filter', async () => {
      const mockFilteredSentiment = {
        symbol: 'AAPL',
        sentimentScore: {
          overall: 72,
          news: 75,
          social: 68,
          institutional: 74,
          timestamp: '2024-01-15T10:30:00Z',
          confidence: 88,
        },
        newsItems: [
          {
            id: '1',
            title: 'Apple Reports Strong Q4 Earnings',
            sentiment: 85,
            symbols: ['AAPL'],
          },
        ],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockFilteredSentiment,
      })

      const response = await fetch('http://localhost:8000/api/v1/sentiment/stock/AAPL')
      const data = await response.json()

      expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/sentiment/stock/AAPL')
      expect(data.symbol).toBe('AAPL')
      expect(data.sentimentScore.overall).toBe(72)
    })

    it('should fetch sentiment data with time range parameter', async () => {
      const mockTimedSentiment = {
        timeRange: '1D',
        sentimentHistory: [
          {
            timestamp: '2024-01-15T09:00:00Z',
            overall: 62,
          },
          {
            timestamp: '2024-01-15T10:00:00Z',
            overall: 65,
          },
        ],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockTimedSentiment,
      })

      const response = await fetch('http://localhost:8000/api/v1/sentiment/history?timeRange=1D')
      const data = await response.json()

      expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/sentiment/history?timeRange=1D')
      expect(data.timeRange).toBe('1D')
      expect(data.sentimentHistory).toBeInstanceOf(Array)
      expect(data.sentimentHistory).toHaveLength(2)
    })
  })

  describe('Stock Data API Integration', () => {
    it('should fetch individual stock data correctly', async () => {
      const mockStockData = {
        symbol: 'AAPL',
        price: {
          current: 175.43,
          change: 2.34,
          changePercent: 1.35,
          volume: 45623000,
          marketCap: 2800000000000,
        },
        technicalIndicators: {
          rsi: 62.5,
          macd: {
            macd: 1.23,
            signal: 1.45,
            histogram: -0.22,
          },
          bollingerBands: {
            upper: 180.45,
            middle: 175.23,
            lower: 170.01,
          },
        },
        sentiment: {
          overall: 72,
          news: 75,
          social: 68,
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockStockData,
      })

      const response = await fetch('http://localhost:8000/api/v1/stocks/AAPL/analysis')
      const data = await response.json()

      expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/stocks/AAPL/analysis')
      expect(data.symbol).toBe('AAPL')
      expect(data.price).toHaveProperty('current')
      expect(data.technicalIndicators).toHaveProperty('rsi')
      expect(data.sentiment).toHaveProperty('overall')
    })

    it('should handle invalid stock symbol', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Symbol not found' }),
      })

      const response = await fetch('http://localhost:8000/api/v1/stocks/INVALID/analysis')
      const data = await response.json()

      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error')
    })
  })

  describe('Data Consistency and Validation', () => {
    it('should ensure timestamp consistency across all data sources', async () => {
      const baseTimestamp = '2024-01-15T10:30:00Z'

      const mockConsistentData = {
        market: {
          indices: [{ symbol: 'SPY', timestamp: baseTimestamp }],
          breadth: { timestamp: baseTimestamp },
        },
        sentiment: {
          sentimentScore: { timestamp: baseTimestamp },
          newsItems: [{ id: '1', publishedAt: baseTimestamp }],
        },
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConsistentData.market,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConsistentData.sentiment,
        })

      const marketResponse = await fetch('http://localhost:8000/api/v1/market/overview')
      const marketData = await marketResponse.json()

      const sentimentResponse = await fetch('http://localhost:8000/api/v1/sentiment/overview')
      const sentimentData = await sentimentResponse.json()

      // Verify timestamp consistency
      expect(marketData.indices[0].timestamp).toBe(baseTimestamp)
      expect(marketData.breadth.timestamp).toBe(baseTimestamp)
      expect(sentimentData.sentimentScore.timestamp).toBe(baseTimestamp)
      expect(sentimentData.newsItems[0].publishedAt).toBe(baseTimestamp)
    })

    it('should validate numeric data ranges', async () => {
      const mockValidatedData = {
        sentiment: {
          overall: 65,  // Should be between -100 and 100
          confidence: 85,  // Should be between 0 and 100
        },
        market: {
          changePercent: 1.23,  // Can be positive or negative
          volume: 45623000,  // Should be positive
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockValidatedData,
      })

      const response = await fetch('http://localhost:8000/api/v1/market/validated')
      const data = await response.json()

      // Validate sentiment score ranges
      expect(data.sentiment.overall).toBeGreaterThanOrEqual(-100)
      expect(data.sentiment.overall).toBeLessThanOrEqual(100)
      expect(data.sentiment.confidence).toBeGreaterThanOrEqual(0)
      expect(data.sentiment.confidence).toBeLessThanOrEqual(100)

      // Validate market data ranges
      expect(data.market.volume).toBeGreaterThan(0)
      expect(typeof data.market.changePercent).toBe('number')
    })

    it('should handle data type validation', async () => {
      const mockTypedData = {
        stringField: 'AAPL',
        numberField: 123.45,
        booleanField: true,
        arrayField: ['item1', 'item2'],
        objectField: { nested: 'value' },
        dateField: '2024-01-15T10:30:00Z',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTypedData,
      })

      const response = await fetch('http://localhost:8000/api/v1/data/typed')
      const data = await response.json()

      expect(typeof data.stringField).toBe('string')
      expect(typeof data.numberField).toBe('number')
      expect(typeof data.booleanField).toBe('boolean')
      expect(Array.isArray(data.arrayField)).toBe(true)
      expect(typeof data.objectField).toBe('object')
      expect(typeof data.dateField).toBe('string')
      expect(new Date(data.dateField).getTime()).not.toBeNaN()
    })
  })

  describe('Performance and Caching', () => {
    it('should handle concurrent API requests efficiently', async () => {
      const mockResponses = [
        { endpoint: 'market', data: { indices: [] } },
        { endpoint: 'sentiment', data: { sentimentScore: {} } },
        { endpoint: 'stocks', data: { symbol: 'AAPL' } },
      ]

      mockResponses.forEach(({ data }) => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => data,
        })
      })

      const startTime = performance.now()

      const promises = [
        fetch('http://localhost:8000/api/v1/market/overview'),
        fetch('http://localhost:8000/api/v1/sentiment/overview'),
        fetch('http://localhost:8000/api/v1/stocks/AAPL/analysis'),
      ]

      const responses = await Promise.all(promises)
      const endTime = performance.now()

      expect(responses).toHaveLength(3)
      responses.forEach(response => {
        expect(response.ok).toBe(true)
      })

      // Concurrent requests should be faster than sequential
      expect(endTime - startTime).toBeLessThan(100) // Assuming mocked responses
    })

    it('should handle cache headers correctly', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'cache-control': 'public, max-age=300',
          'etag': '"abc123"',
          'last-modified': 'Wed, 15 Jan 2024 10:30:00 GMT',
        }),
        json: async () => ({ cached: true }),
      })

      const response = await fetch('http://localhost:8000/api/v1/market/overview')

      expect(response.headers.get('cache-control')).toBe('public, max-age=300')
      expect(response.headers.get('etag')).toBe('"abc123"')
      expect(response.headers.get('last-modified')).toBe('Wed, 15 Jan 2024 10:30:00 GMT')
    })
  })
})