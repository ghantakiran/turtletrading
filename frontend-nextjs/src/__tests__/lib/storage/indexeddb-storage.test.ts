/**
 * Unit tests for IndexedDB Storage Layer
 * TDD approach - write tests first, then implement
 */

import { TurtleTradingStorage } from '@/lib/storage/indexeddb-storage'
import 'fake-indexeddb/auto'

// Polyfill for structuredClone (not available in test environment)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj))
}

describe('TurtleTradingStorage', () => {
  let storage: TurtleTradingStorage

  beforeEach(async () => {
    storage = new TurtleTradingStorage()
    await storage.init()
  })

  afterEach(async () => {
    await storage.clear()
  })

  describe('Initialization', () => {
    test('should initialize database successfully', async () => {
      const isInitialized = await storage.isInitialized()
      expect(isInitialized).toBe(true)
    })

    test('should create required object stores', async () => {
      const stores = await storage.getStoreNames()

      expect(stores).toContain('portfolio')
      expect(stores).toContain('watchlist')
      expect(stores).toContain('priceHistory')
    })
  })

  describe('Portfolio Operations', () => {
    const mockPortfolio = [
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

    test('should save portfolio holdings', async () => {
      await storage.savePortfolio(mockPortfolio)

      const saved = await storage.getPortfolio()
      expect(saved).toHaveLength(2)
      expect(saved[0].symbol).toBe('AAPL')
    })

    test('should update existing portfolio holdings', async () => {
      await storage.savePortfolio(mockPortfolio)

      const updated = [
        {
          symbol: 'AAPL',
          shares: 15, // Updated shares
          avgCost: 150.0,
          currentPrice: 180.0,
          lastUpdated: Date.now(),
        },
      ]

      await storage.savePortfolio(updated)

      const portfolio = await storage.getPortfolio()
      const aapl = portfolio.find(h => h.symbol === 'AAPL')
      expect(aapl?.shares).toBe(15)
    })

    test('should get empty array when no portfolio', async () => {
      const portfolio = await storage.getPortfolio()
      expect(portfolio).toEqual([])
    })

    test('should delete portfolio holding', async () => {
      await storage.savePortfolio(mockPortfolio)
      await storage.deletePortfolioHolding('AAPL')

      const portfolio = await storage.getPortfolio()
      expect(portfolio).toHaveLength(1)
      expect(portfolio[0].symbol).toBe('GOOGL')
    })
  })

  describe('Watchlist Operations', () => {
    const mockWatchlist = [
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        price: 250.0,
        change: 5.0,
        lastUpdated: Date.now(),
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        price: 500.0,
        change: -2.5,
        lastUpdated: Date.now(),
      },
    ]

    test('should save watchlist stocks', async () => {
      await storage.saveWatchlist(mockWatchlist)

      const saved = await storage.getWatchlist()
      expect(saved).toHaveLength(2)
      expect(saved.map(s => s.symbol)).toContain('TSLA')
      expect(saved.map(s => s.symbol)).toContain('NVDA')
    })

    test('should update existing watchlist stocks', async () => {
      await storage.saveWatchlist(mockWatchlist)

      const updated = [
        {
          symbol: 'TSLA',
          name: 'Tesla Inc.',
          price: 260.0, // Updated price
          change: 15.0,
          lastUpdated: Date.now(),
        },
      ]

      await storage.saveWatchlist(updated)

      const watchlist = await storage.getWatchlist()
      const tsla = watchlist.find(s => s.symbol === 'TSLA')
      expect(tsla?.price).toBe(260.0)
    })

    test('should get empty array when no watchlist', async () => {
      const watchlist = await storage.getWatchlist()
      expect(watchlist).toEqual([])
    })

    test('should delete watchlist stock', async () => {
      await storage.saveWatchlist(mockWatchlist)
      await storage.deleteWatchlistStock('TSLA')

      const watchlist = await storage.getWatchlist()
      expect(watchlist).toHaveLength(1)
      expect(watchlist[0].symbol).toBe('NVDA')
    })
  })

  describe('Price History Operations', () => {
    const mockPriceHistory = [
      {
        symbol: 'AAPL',
        timestamp: Date.now() - 86400000, // 1 day ago
        open: 170.0,
        high: 175.0,
        low: 169.0,
        close: 174.0,
        volume: 50000000,
      },
      {
        symbol: 'AAPL',
        timestamp: Date.now(),
        open: 174.0,
        high: 178.0,
        low: 173.0,
        close: 177.0,
        volume: 55000000,
      },
    ]

    test('should save price history', async () => {
      await storage.savePriceHistory('AAPL', mockPriceHistory)

      const saved = await storage.getPriceHistory('AAPL', 7)
      expect(saved).toHaveLength(2)
      expect(saved[0].symbol).toBe('AAPL')
    })

    test('should get price history for specific symbol', async () => {
      await storage.savePriceHistory('AAPL', mockPriceHistory)

      const history = await storage.getPriceHistory('AAPL', 7)
      expect(history.every(h => h.symbol === 'AAPL')).toBe(true)
    })

    test('should limit price history by days', async () => {
      const oldData = {
        symbol: 'AAPL',
        timestamp: Date.now() - 86400000 * 10, // 10 days ago
        open: 150.0,
        high: 155.0,
        low: 149.0,
        close: 154.0,
        volume: 40000000,
      }

      await storage.savePriceHistory('AAPL', [...mockPriceHistory, oldData])

      // Get last 7 days only
      const history = await storage.getPriceHistory('AAPL', 7)
      expect(history).toHaveLength(2) // Should exclude 10-day-old data
    })

    test('should get empty array when no price history', async () => {
      const history = await storage.getPriceHistory('AAPL', 7)
      expect(history).toEqual([])
    })
  })

  describe('Data Cleanup', () => {
    test('should clear all data', async () => {
      await storage.savePortfolio([
        {
          symbol: 'AAPL',
          shares: 10,
          avgCost: 150.0,
          currentPrice: 175.0,
          lastUpdated: Date.now(),
        },
      ])

      await storage.clear()

      const portfolio = await storage.getPortfolio()
      expect(portfolio).toEqual([])
    })

    test('should remove expired data', async () => {
      const expiredData = {
        symbol: 'AAPL',
        shares: 10,
        avgCost: 150.0,
        currentPrice: 175.0,
        lastUpdated: Date.now() - 86400000 * 31, // 31 days ago
      }

      await storage.savePortfolio([expiredData])
      await storage.cleanupExpiredData(30) // Remove data older than 30 days

      const portfolio = await storage.getPortfolio()
      expect(portfolio).toEqual([])
    })
  })

  describe('Storage Stats', () => {
    test('should get storage statistics', async () => {
      await storage.savePortfolio([
        {
          symbol: 'AAPL',
          shares: 10,
          avgCost: 150.0,
          currentPrice: 175.0,
          lastUpdated: Date.now(),
        },
      ])

      await storage.saveWatchlist([
        {
          symbol: 'TSLA',
          name: 'Tesla Inc.',
          price: 250.0,
          change: 5.0,
          lastUpdated: Date.now(),
        },
      ])

      const stats = await storage.getStats()

      expect(stats.portfolioCount).toBe(1)
      expect(stats.watchlistCount).toBe(1)
      expect(stats.priceHistoryCount).toBe(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid data gracefully', async () => {
      const invalidData = [{ invalid: 'data' }] as any

      await expect(storage.savePortfolio(invalidData)).rejects.toThrow()
    })

    test('should handle database errors', async () => {
      // Create a new storage instance to test error handling
      const testStorage = new TurtleTradingStorage()

      // Try to use without initializing
      try {
        await testStorage.getPortfolio()
        fail('Should have thrown an error')
      } catch (error) {
        expect((error as Error).message).toBe('Database not initialized')
      }
    })
  })
})
