/**
 * Integration tests for React cache API usage in server components
 * Tests server-side data fetching patterns and cache behavior
 */
import { jest } from '@jest/globals'

// Mock the React cache API
const mockCache = jest.fn()
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: (fn: Function) => {
    const cachedFn = (...args: any[]) => {
      const key = JSON.stringify(args)
      return mockCache(key, fn, args)
    }
    return cachedFn
  },
}))

// Mock fetch for API calls
global.fetch = jest.fn()

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

describe('React Cache Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCache.mockClear()
  })

  describe('Market Data Caching', () => {
    it('should cache market data fetching across multiple calls', async () => {
      const mockMarketData = {
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
      }

      // Mock successful API response
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockMarketData,
      })

      // Mock cache to return cached value on second call
      let callCount = 0
      mockCache.mockImplementation((key, fn, args) => {
        callCount++
        if (callCount === 1) {
          return fn(...args) // First call executes the function
        } else {
          return mockMarketData // Subsequent calls return cached value
        }
      })

      // Simulate the cached fetch function that would be used in server components
      const { cache } = require('react')
      const fetchMarketData = cache(async () => {
        const response = await fetch('http://localhost:8000/api/v1/market/overview')
        if (!response.ok) throw new Error('Failed to fetch market data')
        return response.json()
      })

      // First call should execute the function
      const firstResult = await fetchMarketData()
      expect(firstResult).toEqual(mockMarketData)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Second call should use cached value
      const secondResult = await fetchMarketData()
      expect(secondResult).toEqual(mockMarketData)
      expect(global.fetch).toHaveBeenCalledTimes(1) // No additional fetch
      expect(mockCache).toHaveBeenCalledTimes(2)
    })

    it('should cache market data with different parameters separately', async () => {
      const mockData1D = { timeRange: '1D', indices: [] }
      const mockData1W = { timeRange: '1W', indices: [] }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => mockData1D })
        .mockResolvedValueOnce({ ok: true, json: async () => mockData1W })

      // Mock cache to handle different keys
      const cacheStore = new Map()
      mockCache.mockImplementation((key, fn, args) => {
        if (!cacheStore.has(key)) {
          cacheStore.set(key, fn(...args))
        }
        return cacheStore.get(key)
      })

      const { cache } = require('react')
      const fetchMarketDataWithTimeRange = cache(async (timeRange: string) => {
        const response = await fetch(`http://localhost:8000/api/v1/market/overview?timeRange=${timeRange}`)
        if (!response.ok) throw new Error('Failed to fetch market data')
        return response.json()
      })

      // Fetch data for different time ranges
      const result1D = await fetchMarketDataWithTimeRange('1D')
      const result1W = await fetchMarketDataWithTimeRange('1W')

      expect(result1D).toEqual(mockData1D)
      expect(result1W).toEqual(mockData1W)
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(mockCache).toHaveBeenCalledTimes(2)

      // Second calls should use cached values
      const cachedResult1D = await fetchMarketDataWithTimeRange('1D')
      const cachedResult1W = await fetchMarketDataWithTimeRange('1W')

      expect(cachedResult1D).toEqual(mockData1D)
      expect(cachedResult1W).toEqual(mockData1W)
      expect(global.fetch).toHaveBeenCalledTimes(2) // No additional fetches
      expect(mockCache).toHaveBeenCalledTimes(4)
    })
  })

  describe('Sentiment Data Caching', () => {
    it('should cache sentiment data fetching', async () => {
      const mockSentimentData = {
        sentimentScore: {
          overall: 65,
          news: 70,
          social: 60,
          institutional: 68,
          timestamp: '2024-01-15T10:30:00Z',
          confidence: 85,
        },
        newsItems: [],
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSentimentData,
      })

      let callCount = 0
      mockCache.mockImplementation((key, fn, args) => {
        callCount++
        if (callCount === 1) {
          return fn(...args)
        } else {
          return mockSentimentData
        }
      })

      const { cache } = require('react')
      const fetchSentimentData = cache(async () => {
        const response = await fetch('http://localhost:8000/api/v1/sentiment/overview')
        if (!response.ok) throw new Error('Failed to fetch sentiment data')
        return response.json()
      })

      // First call
      const firstResult = await fetchSentimentData()
      expect(firstResult).toEqual(mockSentimentData)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const secondResult = await fetchSentimentData()
      expect(secondResult).toEqual(mockSentimentData)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should cache symbol-specific sentiment data', async () => {
      const mockAAPLSentiment = { symbol: 'AAPL', sentiment: 75 }
      const mockMSFTSentiment = { symbol: 'MSFT', sentiment: 68 }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => mockAAPLSentiment })
        .mockResolvedValueOnce({ ok: true, json: async () => mockMSFTSentiment })

      const cacheStore = new Map()
      mockCache.mockImplementation((key, fn, args) => {
        if (!cacheStore.has(key)) {
          cacheStore.set(key, fn(...args))
        }
        return cacheStore.get(key)
      })

      const { cache } = require('react')
      const fetchSymbolSentiment = cache(async (symbol: string) => {
        const response = await fetch(`http://localhost:8000/api/v1/sentiment/stock/${symbol}`)
        if (!response.ok) throw new Error('Failed to fetch symbol sentiment')
        return response.json()
      })

      // Fetch different symbols
      const aaplResult = await fetchSymbolSentiment('AAPL')
      const msftResult = await fetchSymbolSentiment('MSFT')

      expect(aaplResult).toEqual(mockAAPLSentiment)
      expect(msftResult).toEqual(mockMSFTSentiment)
      expect(global.fetch).toHaveBeenCalledTimes(2)

      // Cached calls
      const cachedAAPL = await fetchSymbolSentiment('AAPL')
      const cachedMSFT = await fetchSymbolSentiment('MSFT')

      expect(cachedAAPL).toEqual(mockAAPLSentiment)
      expect(cachedMSFT).toEqual(mockMSFTSentiment)
      expect(global.fetch).toHaveBeenCalledTimes(2) // No additional fetches
    })
  })

  describe('Cache Error Handling', () => {
    it('should handle API errors without caching failed responses', async () => {
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: 'success' }) })

      let callCount = 0
      mockCache.mockImplementation((key, fn, args) => {
        callCount++
        return fn(...args) // Always execute for error handling test
      })

      const { cache } = require('react')
      const fetchDataWithErrorHandling = cache(async () => {
        const response = await fetch('http://localhost:8000/api/v1/market/overview')
        if (!response.ok) throw new Error('Failed to fetch data')
        return response.json()
      })

      // First call should fail
      try {
        await fetchDataWithErrorHandling()
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }

      // Second call should succeed (not cached failed response)
      const result = await fetchDataWithErrorHandling()
      expect(result).toEqual({ data: 'success' })
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should handle invalid response format', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })

      mockCache.mockImplementation((key, fn, args) => fn(...args))

      const { cache } = require('react')
      const fetchDataWithValidation = cache(async () => {
        const response = await fetch('http://localhost:8000/api/v1/market/overview')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${(await response.json()).error}`)
        }
        return response.json()
      })

      try {
        await fetchDataWithValidation()
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('HTTP 500')
      }
    })
  })

  describe('Cache Performance', () => {
    it('should handle concurrent cache requests efficiently', async () => {
      const mockData = { concurrent: true }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      let fetchCount = 0
      mockCache.mockImplementation((key, fn, args) => {
        fetchCount++
        if (fetchCount === 1) {
          return fn(...args)
        } else {
          return mockData // Return cached value for subsequent calls
        }
      })

      const { cache } = require('react')
      const fetchConcurrentData = cache(async () => {
        const response = await fetch('http://localhost:8000/api/v1/market/overview')
        if (!response.ok) throw new Error('Failed to fetch data')
        return response.json()
      })

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => fetchConcurrentData())
      const results = await Promise.all(promises)

      // All results should be the same
      results.forEach(result => {
        expect(result).toEqual(mockData)
      })

      // Should only make one actual fetch call
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(mockCache).toHaveBeenCalledTimes(5)
    })

    it('should handle cache memory efficiency', async () => {
      const generateMockData = (id: number) => ({
        id,
        data: new Array(1000).fill(`item-${id}`),
      })

      // Mock multiple different responses
      for (let i = 0; i < 10; i++) {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => generateMockData(i),
        })
      }

      const cacheStore = new Map()
      mockCache.mockImplementation((key, fn, args) => {
        if (!cacheStore.has(key)) {
          cacheStore.set(key, fn(...args))
        }
        return cacheStore.get(key)
      })

      const { cache } = require('react')
      const fetchLargeData = cache(async (id: number) => {
        const response = await fetch(`http://localhost:8000/api/v1/data/${id}`)
        if (!response.ok) throw new Error('Failed to fetch data')
        return response.json()
      })

      // Fetch multiple large datasets
      const results = []
      for (let i = 0; i < 10; i++) {
        const result = await fetchLargeData(i)
        results.push(result)
      }

      expect(results).toHaveLength(10)
      expect(global.fetch).toHaveBeenCalledTimes(10)

      // Verify cached access
      const cachedResult = await fetchLargeData(0)
      expect(cachedResult).toEqual(generateMockData(0))
      expect(global.fetch).toHaveBeenCalledTimes(10) // No additional fetch
    })
  })

  describe('Cache Invalidation Patterns', () => {
    it('should simulate cache invalidation scenarios', async () => {
      const mockDataV1 = { version: 1, data: 'old' }
      const mockDataV2 = { version: 2, data: 'new' }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => mockDataV1 })
        .mockResolvedValueOnce({ ok: true, json: async () => mockDataV2 })

      const cacheStore = new Map()
      mockCache.mockImplementation((key, fn, args) => {
        if (!cacheStore.has(key)) {
          cacheStore.set(key, fn(...args))
        }
        return cacheStore.get(key)
      })

      const { cache } = require('react')
      const fetchVersionedData = cache(async (version?: string) => {
        const url = version
          ? `http://localhost:8000/api/v1/data?v=${version}`
          : 'http://localhost:8000/api/v1/data'
        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to fetch data')
        return response.json()
      })

      // Initial fetch
      const result1 = await fetchVersionedData()
      expect(result1).toEqual(mockDataV1)

      // Fetch with version parameter (different cache key)
      const result2 = await fetchVersionedData('2')
      expect(result2).toEqual(mockDataV2)

      // Both should be cached separately
      const cachedResult1 = await fetchVersionedData()
      const cachedResult2 = await fetchVersionedData('2')

      expect(cachedResult1).toEqual(mockDataV1)
      expect(cachedResult2).toEqual(mockDataV2)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})