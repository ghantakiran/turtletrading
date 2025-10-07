/**
 * TurtleTrading SDK Client Unit Tests
 * Following TDD - tests written before implementation
 */

import { TurtleTradingClient } from '../client'
import type { SDKConfig } from '../types'

// Mock fetch
global.fetch = jest.fn()

describe('TurtleTradingClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with API key', () => {
      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      expect(client).toBeInstanceOf(TurtleTradingClient)
    })

    it('should use default baseURL if not provided', () => {
      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      expect(client['config'].baseURL).toBe('http://localhost:8000')
    })

    it('should accept custom baseURL', () => {
      const client = new TurtleTradingClient({
        apiKey: 'test-key',
        baseURL: 'https://api.turtletrading.com',
      })
      expect(client['config'].baseURL).toBe('https://api.turtletrading.com')
    })

    it('should throw error if API key is missing', () => {
      expect(() => new TurtleTradingClient({} as SDKConfig)).toThrow('API key is required')
    })
  })

  describe('Stock Price', () => {
    it('should fetch stock price', async () => {
      const mockResponse = {
        symbol: 'AAPL',
        current_price: 150.25,
        change: 2.5,
        change_percent: 1.69,
        timestamp: '2025-01-01T12:00:00Z',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      const result = await client.stocks.getPrice('AAPL')

      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/stocks/AAPL/price',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
          }),
        })
      )
    })

    it('should handle API errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Stock not found' }),
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })

      await expect(client.stocks.getPrice('INVALID')).rejects.toThrow('Stock not found')
    })
  })

  describe('Technical Analysis', () => {
    it('should fetch technical indicators', async () => {
      const mockResponse = {
        symbol: 'AAPL',
        rsi: { value: 65, signal: 'neutral' as const },
        macd: { value: 1.5, signal: 1.2, histogram: 0.3 },
        recommendation: 'buy' as const,
        score: 75,
        timestamp: '2025-01-01T12:00:00Z',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      const result = await client.stocks.getTechnical('AAPL')

      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/stocks/AAPL/technical',
        expect.any(Object)
      )
    })
  })

  describe('AI Predictions', () => {
    it('should fetch AI predictions with default days', async () => {
      const mockResponse = {
        symbol: 'AAPL',
        current_price: 150.25,
        predictions: [
          { date: '2025-01-02', price: 151.5 },
          { date: '2025-01-03', price: 152.0 },
        ],
        confidence_intervals: [],
        model_confidence: 0.85,
        horizon_days: 30,
        timestamp: '2025-01-01T12:00:00Z',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      const result = await client.ai.getPredictions('AAPL')

      expect(result).toEqual(mockResponse)
    })

    it('should fetch AI predictions with custom days', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ symbol: 'AAPL', predictions: [] }),
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      await client.ai.getPredictions('AAPL', 7)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/stocks/AAPL/lstm?days=7',
        expect.any(Object)
      )
    })
  })

  describe('Sentiment Analysis', () => {
    it('should fetch sentiment analysis', async () => {
      const mockResponse = {
        symbol: 'AAPL',
        overall_sentiment: 'bullish' as const,
        sentiment_score: 0.75,
        news_sentiment: 0.8,
        social_sentiment: 0.7,
        sources: [],
        timestamp: '2025-01-01T12:00:00Z',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      const result = await client.sentiment.getAnalysis('AAPL')

      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/sentiment/AAPL',
        expect.any(Object)
      )
    })
  })

  describe('Market Data', () => {
    it('should fetch market indices', async () => {
      const mockResponse = {
        sp500: { value: 4500, change: 25, change_percent: 0.56 },
        nasdaq: { value: 15000, change: 100, change_percent: 0.67 },
        dow: { value: 35000, change: 150, change_percent: 0.43 },
        vix: { value: 18.5, change: -0.5, change_percent: -2.63 },
        timestamp: '2025-01-01T12:00:00Z',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      const result = await client.market.getIndices()

      expect(result).toEqual(mockResponse)
    })
  })

  describe('Request Options', () => {
    it('should support AbortSignal', async () => {
      const controller = new AbortController()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ symbol: 'AAPL', current_price: 150 }),
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      await client.stocks.getPrice('AAPL', { signal: controller.signal })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      )
    })

    it('should support custom headers', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ symbol: 'AAPL', current_price: 150 }),
      })

      const client = new TurtleTradingClient({ apiKey: 'test-key' })
      await client.stocks.getPrice('AAPL', {
        headers: { 'X-Custom-Header': 'value' },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'value',
          }),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const client = new TurtleTradingClient({ apiKey: 'test-key' })

      await expect(client.stocks.getPrice('AAPL')).rejects.toThrow('Network error')
    })

    it('should handle timeout errors', async () => {
      const client = new TurtleTradingClient({ apiKey: 'test-key', timeout: 100 })

      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      )

      // Note: Actual timeout implementation would be in the client
      await expect(client.stocks.getPrice('AAPL')).rejects.toThrow()
    })

    it('should parse API error responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Invalid API key',
          code: 'INVALID_API_KEY',
        }),
      })

      const client = new TurtleTradingClient({ apiKey: 'invalid-key' })

      await expect(client.stocks.getPrice('AAPL')).rejects.toThrow('Invalid API key')
    })
  })
})
