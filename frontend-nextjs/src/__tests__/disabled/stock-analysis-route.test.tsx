import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getStockAnalysisData, getStockPrice, getTechnicalIndicators, getLSTMPrediction, getSentimentData } from '@/lib/api/stock-data'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Stock Analysis Route Data Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getStockPrice', () => {
    it('fetches stock price data successfully', async () => {
      const mockData = {
        symbol: 'AAPL',
        current_price: 150.25,
        change: 2.50,
        change_percent: 1.69,
        volume: 45000000,
        market_cap: 2800000000000
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      })

      const result = await getStockPrice('AAPL')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/stocks/AAPL/price',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          next: { revalidate: 60 }
        })
      )

      expect(result).toEqual(mockData)
    })

    it('throws error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(getStockPrice('INVALID')).rejects.toThrow('HTTP 404: Not Found')
    })
  })

  describe('getTechnicalIndicators', () => {
    it('fetches technical indicators with default period', async () => {
      const mockData = {
        rsi: 65.5,
        macd: 1.2,
        sma_20: 148.0,
        technical_score: 0.75
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      })

      const result = await getTechnicalIndicators('AAPL')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/stocks/AAPL/technical?period=1y',
        expect.any(Object)
      )

      expect(result).toEqual(mockData)
    })

    it('fetches technical indicators with custom period', async () => {
      const mockData = {
        rsi: 70.0,
        macd: 0.8,
        technical_score: 0.65
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      })

      await getTechnicalIndicators('AAPL', '3m')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/stocks/AAPL/technical?period=3m',
        expect.any(Object)
      )
    })
  })

  describe('getLSTMPrediction', () => {
    it('fetches LSTM prediction with default days', async () => {
      const mockData = {
        predicted_price: 155.0,
        confidence: 0.82,
        trend: 'bullish',
        time_horizon: '5 days',
        lstm_score: 0.78,
        predictions: []
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      })

      const result = await getLSTMPrediction('AAPL')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/stocks/AAPL/lstm?days=5',
        expect.any(Object)
      )

      expect(result).toEqual(mockData)
    })

    it('fetches LSTM prediction with custom days', async () => {
      const mockData = {
        predicted_price: 160.0,
        confidence: 0.78,
        trend: 'bullish'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      })

      await getLSTMPrediction('AAPL', 10)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/stocks/AAPL/lstm?days=10',
        expect.any(Object)
      )
    })
  })

  describe('getSentimentData', () => {
    it('fetches sentiment data successfully', async () => {
      const mockData = {
        sentiment_score: 0.15,
        articles_count: 25,
        social_mentions: 150,
        news_sentiment: 0.1,
        social_sentiment: 0.2
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      })

      const result = await getSentimentData('AAPL')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sentiment/stock/AAPL',
        expect.any(Object)
      )

      expect(result).toEqual(mockData)
    })
  })

  describe('getStockAnalysisData (aggregate)', () => {
    it('fetches all data successfully and calculates analysis score', async () => {
      const mockStockData = {
        symbol: 'AAPL',
        current_price: 150.25,
        change: 2.50,
        change_percent: 1.69
      }

      const mockTechnicalData = {
        rsi: 65.5,
        technical_score: 0.75
      }

      const mockLSTMData = {
        predicted_price: 155.0,
        lstm_score: 0.78
      }

      const mockSentimentData = {
        sentiment_score: 0.15
      }

      // Mock all four API calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStockData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTechnicalData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLSTMData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentData
        })

      const result = await getStockAnalysisData('AAPL')

      expect(result.stockData).toEqual(mockStockData)
      expect(result.technicalData).toEqual(mockTechnicalData)
      expect(result.lstmData).toEqual(mockLSTMData)
      expect(result.sentimentData).toEqual(mockSentimentData)

      // Check analysis score calculation
      expect(result.analysisScore).toBeDefined()
      expect(result.analysisScore?.final_score).toBeGreaterThan(0)
      expect(result.analysisScore?.recommendation).toMatch(/STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL/)

      // Check that all errors are null on success
      expect(result.errors.stockData).toBeNull()
      expect(result.errors.technicalData).toBeNull()
      expect(result.errors.lstmData).toBeNull()
      expect(result.errors.sentimentData).toBeNull()
    })

    it('handles partial failures gracefully', async () => {
      const mockStockData = {
        symbol: 'AAPL',
        current_price: 150.25
      }

      // Mock: stock succeeds, technical fails, LSTM succeeds, sentiment fails
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStockData
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ lstm_score: 0.65 })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })

      const result = await getStockAnalysisData('AAPL')

      expect(result.stockData).toEqual(mockStockData)
      expect(result.technicalData).toBeNull()
      expect(result.lstmData).toEqual({ lstm_score: 0.65 })
      expect(result.sentimentData).toBeNull()

      // Check error messages
      expect(result.errors.stockData).toBeNull()
      expect(result.errors.technicalData).toContain('HTTP 500')
      expect(result.errors.lstmData).toBeNull()
      expect(result.errors.sentimentData).toContain('HTTP 404')

      // Analysis score should still be calculated with partial data
      expect(result.analysisScore).toBeDefined()
    })

    it('calculates correct analysis score weights', async () => {
      const mockData = {
        stockData: { current_price: 100 },
        technicalData: { technical_score: 0.8 },
        lstmData: { lstm_score: 0.6 },
        sentimentData: { sentiment_score: 0.2 }
      }

      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockData.stockData })
        .mockResolvedValueOnce({ ok: true, json: async () => mockData.technicalData })
        .mockResolvedValueOnce({ ok: true, json: async () => mockData.lstmData })
        .mockResolvedValueOnce({ ok: true, json: async () => mockData.sentimentData })

      const result = await getStockAnalysisData('TEST')

      const analysisScore = result.analysisScore!

      expect(analysisScore.technical_weight).toBe(50)
      expect(analysisScore.lstm_weight).toBe(30)
      expect(analysisScore.sentiment_weight).toBe(20)
      expect(analysisScore.seasonality_weight).toBe(0)

      // Test final score calculation: 0.8 * 0.5 + 0.6 * 0.3 + 0.6 * 0.2 = 0.4 + 0.18 + 0.12 = 0.7
      // (sentiment_score 0.2 normalized to 0.6 for calculation)
      expect(analysisScore.final_score).toBeCloseTo(0.7, 1)
    })
  })

  describe('Error handling', () => {
    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(getStockPrice('AAPL')).rejects.toThrow('Network error')
    })

    it('handles malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      })

      await expect(getStockPrice('AAPL')).rejects.toThrow('Invalid JSON')
    })
  })

  describe('Caching behavior', () => {
    it('sets correct cache headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ symbol: 'AAPL' })
      })

      await getStockPrice('AAPL')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          next: { revalidate: 60 }
        })
      )
    })
  })
})