/**
 * Unit tests for useWatchlistCache hook
 * TDD approach - write tests first, then implement
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useWatchlistCache } from '@/lib/hooks/useWatchlistCache'
import { turtleTradingStorage } from '@/lib/storage/indexeddb-storage'
import { OfflineQueue } from '@/lib/sync/offline-queue'

// Mock storage
jest.mock('@/lib/storage/indexeddb-storage', () => ({
  turtleTradingStorage: {
    init: jest.fn().mockResolvedValue(undefined),
    saveWatchlist: jest.fn().mockResolvedValue(undefined),
    getWatchlist: jest.fn().mockResolvedValue([]),
    deleteWatchlistStock: jest.fn().mockResolvedValue(undefined),
  },
}))

// Mock offline queue
jest.mock('@/lib/sync/offline-queue')

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  configurable: true,
  value: true,
})

describe('useWatchlistCache', () => {
  let mockQueue: jest.Mocked<OfflineQueue>

  const mockWatchlistData = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 175.0,
      change: 2.5,
      lastUpdated: Date.now(),
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      price: 2900.0,
      change: -1.2,
      lastUpdated: Date.now(),
    },
  ]

  beforeEach(() => {
    ;(navigator.onLine as any) = true

    mockQueue = {
      init: jest.fn().mockResolvedValue(undefined),
      enqueue: jest.fn().mockResolvedValue(undefined),
      processQueue: jest.fn().mockResolvedValue(undefined),
      getAll: jest.fn().mockResolvedValue([]),
      size: jest.fn().mockResolvedValue(0),
      clear: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
    } as any

    ;(OfflineQueue as jest.Mock).mockImplementation(() => mockQueue)

    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    test('should initialize storage on mount', async () => {
      renderHook(() => useWatchlistCache(false))

      await waitFor(() => {
        expect(turtleTradingStorage.init).toHaveBeenCalled()
      })
    })

    test('should return watchlist data', () => {
      const { result } = renderHook(() => useWatchlistCache(false))

      expect(result.current.watchlist).toBeDefined()
      expect(Array.isArray(result.current.watchlist)).toBe(true)
    })

    test('should return loading state', () => {
      const { result } = renderHook(() => useWatchlistCache(false))

      expect(typeof result.current.isLoading).toBe('boolean')
    })
  })

  describe('Load Watchlist', () => {
    test('should load from cache when offline', async () => {
      ;(navigator.onLine as any) = false
      ;(turtleTradingStorage.getWatchlist as jest.Mock).mockResolvedValue(mockWatchlistData)

      const { result } = renderHook(() => useWatchlistCache(false))

      await act(async () => {
        await result.current.loadWatchlist()
      })

      await waitFor(() => {
        expect(turtleTradingStorage.getWatchlist).toHaveBeenCalled()
        expect(result.current.watchlist).toEqual(mockWatchlistData)
      })
    })

    test('should fetch from API when online', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockWatchlistData,
      })

      const { result } = renderHook(() => useWatchlistCache(false))

      await act(async () => {
        await result.current.loadWatchlist()
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/watchlist')
      })
    })

    test('should cache data after fetching from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockWatchlistData,
      })

      const { result } = renderHook(() => useWatchlistCache(false))

      await act(async () => {
        await result.current.loadWatchlist()
      })

      await waitFor(() => {
        expect(turtleTradingStorage.saveWatchlist).toHaveBeenCalledWith(mockWatchlistData)
      })
    })
  })

  describe('Add to Watchlist', () => {
    test('should call API when online', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

      const { result } = renderHook(() => useWatchlistCache(false))

      await act(async () => {
        await result.current.addStock('TSLA')
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'TSLA' }),
      })
    })

    test('should queue action when offline', async () => {
      ;(navigator.onLine as any) = false

      const { result } = renderHook(() => useWatchlistCache(false))

      await act(async () => {
        await result.current.addStock('TSLA')
      })

      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'TSLA' },
      })
    })

    test('should reload watchlist after adding', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWatchlistData,
        })

      const { result } = renderHook(() => useWatchlistCache(false))

      await act(async () => {
        await result.current.addStock('TSLA')
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/watchlist')
      })
    })
  })

  describe('Remove from Watchlist', () => {
    test('should call DELETE API when online', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

      const { result } = renderHook(() => useWatchlistCache(false))

      await act(async () => {
        await result.current.removeStock('AAPL')
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/watchlist/AAPL', {
        method: 'DELETE',
      })
    })

    test('should queue action when offline', async () => {
      ;(navigator.onLine as any) = false

      const { result } = renderHook(() => useWatchlistCache(false))

      await act(async () => {
        await result.current.removeStock('AAPL')
      })

      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        type: 'REMOVE_FROM_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })
    })
  })

  describe('Auto-load', () => {
    test('should auto-load watchlist on mount', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockWatchlistData,
      })

      renderHook(() => useWatchlistCache())

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/watchlist')
      })
    })

    test('should not auto-load if disabled', () => {
      global.fetch = jest.fn()

      renderHook(() => useWatchlistCache(false))

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
