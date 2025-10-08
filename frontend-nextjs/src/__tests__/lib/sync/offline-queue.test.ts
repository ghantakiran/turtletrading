/**
 * Unit tests for Offline Sync Queue
 * TDD approach - write tests first, then implement
 */

import { OfflineQueue } from '@/lib/sync/offline-queue'

// Mock fetch
global.fetch = jest.fn()

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
})

describe('OfflineQueue', () => {
  let queue: OfflineQueue

  beforeEach(() => {
    queue = new OfflineQueue()
    localStorage.clear()
    jest.clearAllMocks()
    ;(navigator.onLine as any) = true
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
  })

  describe('Initialization', () => {
    test('should initialize with empty queue', async () => {
      const size = await queue.size()
      expect(size).toBe(0)
    })

    test('should load existing queue from localStorage', async () => {
      const existingQueue = [
        {
          id: '1',
          type: 'ADD_TO_WATCHLIST',
          payload: { symbol: 'AAPL' },
          timestamp: Date.now(),
          retries: 0,
        },
      ]

      localStorage.setItem('offline-queue', JSON.stringify(existingQueue))

      const newQueue = new OfflineQueue()
      await newQueue.init()

      const size = await newQueue.size()
      expect(size).toBe(1)
    })
  })

  describe('Enqueue Operations', () => {
    test('should add action to queue', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      const size = await queue.size()
      expect(size).toBe(1)
    })

    test('should generate unique ID for each action', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'GOOGL' },
      })

      const items = await queue.getAll()
      expect(items[0].id).not.toBe(items[1].id)
    })

    test('should set timestamp for action', async () => {
      const before = Date.now()
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })
      const after = Date.now()

      const items = await queue.getAll()
      expect(items[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(items[0].timestamp).toBeLessThanOrEqual(after)
    })

    test('should initialize retry count to 0', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      const items = await queue.getAll()
      expect(items[0].retries).toBe(0)
    })

    test('should persist queue to localStorage', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      const saved = localStorage.getItem('offline-queue')
      expect(saved).toBeTruthy()

      const parsed = JSON.parse(saved!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].payload.symbol).toBe('AAPL')
    })
  })

  describe('Process Queue', () => {
    test('should process actions when online', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.processQueue()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/watchlist',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    test('should remove actions after successful processing', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.processQueue()

      const size = await queue.size()
      expect(size).toBe(0)
    })

    test('should not process when offline', async () => {
      ;(navigator.onLine as any) = false

      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.processQueue()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('should increment retry count on failure', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.processQueue()

      const items = await queue.getAll()
      expect(items[0].retries).toBe(1)
    })

    test('should remove action after max retries', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      // Process 3 times (max retries)
      await queue.processQueue()
      await queue.processQueue()
      await queue.processQueue()

      const size = await queue.size()
      expect(size).toBe(0)
    })

    test('should process multiple actions in order', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.enqueue({
        type: 'REMOVE_FROM_WATCHLIST',
        payload: { symbol: 'GOOGL' },
      })

      await queue.processQueue()

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Action Types', () => {
    test('should handle ADD_TO_WATCHLIST action', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.processQueue()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/watchlist',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ symbol: 'AAPL' }),
        })
      )
    })

    test('should handle REMOVE_FROM_WATCHLIST action', async () => {
      await queue.enqueue({
        type: 'REMOVE_FROM_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.processQueue()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/watchlist/AAPL',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })

    test('should handle SET_ALERT action', async () => {
      await queue.enqueue({
        type: 'SET_ALERT',
        payload: { symbol: 'AAPL', price: 150 },
      })

      await queue.processQueue()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/alerts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ symbol: 'AAPL', price: 150 }),
        })
      )
    })

    test('should handle UPDATE_PORTFOLIO action', async () => {
      await queue.enqueue({
        type: 'UPDATE_PORTFOLIO',
        payload: { symbol: 'AAPL', shares: 10 },
      })

      await queue.processQueue()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/portfolio',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ symbol: 'AAPL', shares: 10 }),
        })
      )
    })
  })

  describe('Queue Management', () => {
    test('should get all queued actions', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.enqueue({
        type: 'SET_ALERT',
        payload: { symbol: 'GOOGL', price: 2800 },
      })

      const items = await queue.getAll()
      expect(items).toHaveLength(2)
    })

    test('should clear all actions', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.clear()

      const size = await queue.size()
      expect(size).toBe(0)
    })

    test('should get queue size', async () => {
      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.enqueue({
        type: 'SET_ALERT',
        payload: { symbol: 'GOOGL', price: 2800 },
      })

      const size = await queue.size()
      expect(size).toBe(2)
    })
  })

  describe('Event Listeners', () => {
    test('should notify when queue changes', async () => {
      const listener = jest.fn()
      queue.on('change', listener)

      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      expect(listener).toHaveBeenCalledWith(1)
    })

    test('should notify when processing starts', async () => {
      const listener = jest.fn()
      queue.on('processing', listener)

      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.processQueue()

      expect(listener).toHaveBeenCalled()
    })

    test('should notify when processing completes', async () => {
      const listener = jest.fn()
      queue.on('processed', listener)

      await queue.enqueue({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })

      await queue.processQueue()

      expect(listener).toHaveBeenCalled()
    })
  })
})
