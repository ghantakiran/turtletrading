/**
 * Unit tests for usePortfolioCache hook
 * TDD approach - write tests first, then implement
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { usePortfolioCache } from '@/lib/hooks/usePortfolioCache'
import { turtleTradingStorage } from '@/lib/storage/indexeddb-storage'

// Mock storage
jest.mock('@/lib/storage/indexeddb-storage', () => ({
  turtleTradingStorage: {
    init: jest.fn().mockResolvedValue(undefined),
    savePortfolio: jest.fn().mockResolvedValue(undefined),
    getPortfolio: jest.fn().mockResolvedValue([]),
    deletePortfolioHolding: jest.fn().mockResolvedValue(undefined),
  },
}))

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  configurable: true,
  value: true,
})

describe('usePortfolioCache', () => {
  const mockPortfolioData = [
    {
      symbol: 'AAPL',
      shares: 10,
      avgCost: 150.0,
      currentPrice: 175.0,
      lastUpdated: Date.now(),
    },
    {
      symbol: 'GOOGL',
      shares: 5,
      avgCost: 2800.0,
      currentPrice: 2900.0,
      lastUpdated: Date.now(),
    },
  ]

  beforeEach(() => {
    ;(navigator.onLine as any) = true
    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    test('should initialize storage on mount', async () => {
      renderHook(() => usePortfolioCache(false))

      await waitFor(() => {
        expect(turtleTradingStorage.init).toHaveBeenCalled()
      })
    })

    test('should return portfolio data', () => {
      const { result } = renderHook(() => usePortfolioCache(false))

      expect(result.current.portfolio).toBeDefined()
      expect(Array.isArray(result.current.portfolio)).toBe(true)
    })

    test('should return loading state', () => {
      const { result } = renderHook(() => usePortfolioCache(false))

      expect(typeof result.current.isLoading).toBe('boolean')
    })

    test('should return error state initially null', () => {
      const { result } = renderHook(() => usePortfolioCache(false))

      expect(result.current.error).toBeNull()
    })
  })

  describe('Load Portfolio', () => {
    test('should load from cache when offline', async () => {
      ;(navigator.onLine as any) = false
      ;(turtleTradingStorage.getPortfolio as jest.Mock).mockResolvedValue(mockPortfolioData)

      const { result } = renderHook(() => usePortfolioCache())

      await act(async () => {
        await result.current.loadPortfolio()
      })

      await waitFor(() => {
        expect(turtleTradingStorage.getPortfolio).toHaveBeenCalled()
        expect(result.current.portfolio).toEqual(mockPortfolioData)
      })
    })

    test('should fetch from API when online', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPortfolioData,
      })

      const { result } = renderHook(() => usePortfolioCache())

      await act(async () => {
        await result.current.loadPortfolio()
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/portfolio')
      })
    })

    test('should cache data after fetching from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPortfolioData,
      })

      const { result } = renderHook(() => usePortfolioCache())

      await act(async () => {
        await result.current.loadPortfolio()
      })

      await waitFor(() => {
        expect(turtleTradingStorage.savePortfolio).toHaveBeenCalledWith(mockPortfolioData)
      })
    })

    test('should fallback to cache on API error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
      ;(turtleTradingStorage.getPortfolio as jest.Mock).mockResolvedValue(mockPortfolioData)

      const { result } = renderHook(() => usePortfolioCache())

      await act(async () => {
        await result.current.loadPortfolio()
      })

      await waitFor(() => {
        expect(turtleTradingStorage.getPortfolio).toHaveBeenCalled()
        expect(result.current.portfolio).toEqual(mockPortfolioData)
      })
    })

    test('should set loading state during fetch', async () => {
      global.fetch = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => [] }), 100)
          )
      )

      const { result } = renderHook(() => usePortfolioCache())

      act(() => {
        result.current.loadPortfolio()
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    test('should set error on failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
      ;(turtleTradingStorage.getPortfolio as jest.Mock).mockResolvedValue([])

      const { result } = renderHook(() => usePortfolioCache())

      await act(async () => {
        await result.current.loadPortfolio()
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('Cache Management', () => {
    test('should update cache when portfolio changes', async () => {
      const { result } = renderHook(() => usePortfolioCache())

      await act(async () => {
        await result.current.updateCache(mockPortfolioData)
      })

      expect(turtleTradingStorage.savePortfolio).toHaveBeenCalledWith(mockPortfolioData)
    })

    test('should return isCached status', () => {
      const { result } = renderHook(() => usePortfolioCache())

      expect(typeof result.current.isCached).toBe('boolean')
    })

    test('should return lastUpdated timestamp', () => {
      const { result } = renderHook(() => usePortfolioCache())

      expect(result.current.lastUpdated).toBeNull()
    })
  })

  describe('Auto-load on mount', () => {
    test('should auto-load portfolio on mount', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPortfolioData,
      })

      renderHook(() => usePortfolioCache())

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/portfolio')
      })
    })

    test('should not auto-load if disabled', () => {
      global.fetch = jest.fn()

      renderHook(() => usePortfolioCache(false))

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
