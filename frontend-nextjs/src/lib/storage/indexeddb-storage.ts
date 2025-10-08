/**
 * IndexedDB Storage Layer for TurtleTrading
 * Provides offline data persistence for portfolio, watchlist, and price history
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

// Database schema definition
interface TurtleTradingDB extends DBSchema {
  portfolio: {
    key: string
    value: {
      symbol: string
      shares: number
      avgCost: number
      currentPrice: number
      lastUpdated: number
    }
  }
  watchlist: {
    key: string
    value: {
      symbol: string
      name: string
      price: number
      change: number
      lastUpdated: number
    }
  }
  priceHistory: {
    key: [string, number]
    value: {
      symbol: string
      timestamp: number
      open: number
      high: number
      low: number
      close: number
      volume: number
    }
    indexes: { 'by-symbol': string; 'by-timestamp': number }
  }
}

export class TurtleTradingStorage {
  private db: IDBPDatabase<TurtleTradingDB> | null = null
  private readonly dbName = 'turtletrading-db'
  private readonly dbVersion = 1

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return

    this.db = await openDB<TurtleTradingDB>(this.dbName, this.dbVersion, {
      upgrade(db) {
        // Create portfolio object store
        if (!db.objectStoreNames.contains('portfolio')) {
          db.createObjectStore('portfolio', { keyPath: 'symbol' })
        }

        // Create watchlist object store
        if (!db.objectStoreNames.contains('watchlist')) {
          db.createObjectStore('watchlist', { keyPath: 'symbol' })
        }

        // Create price history object store with indexes
        if (!db.objectStoreNames.contains('priceHistory')) {
          const priceStore = db.createObjectStore('priceHistory', {
            keyPath: ['symbol', 'timestamp'],
          })
          priceStore.createIndex('by-symbol', 'symbol')
          priceStore.createIndex('by-timestamp', 'timestamp')
        }
      },
    })
  }

  /**
   * Check if database is initialized
   */
  async isInitialized(): Promise<boolean> {
    return this.db !== null
  }

  /**
   * Get list of object store names
   */
  async getStoreNames(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized')
    return Array.from(this.db.objectStoreNames)
  }

  // ===== Portfolio Operations =====

  /**
   * Save portfolio holdings
   */
  async savePortfolio(
    holdings: Array<{
      symbol: string
      shares: number
      avgCost: number
      currentPrice: number
      lastUpdated: number
    }>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const tx = this.db.transaction('portfolio', 'readwrite')
    const store = tx.objectStore('portfolio')

    await Promise.all(holdings.map(holding => store.put(holding)))
    await tx.done
  }

  /**
   * Get all portfolio holdings
   */
  async getPortfolio(): Promise<
    Array<{
      symbol: string
      shares: number
      avgCost: number
      currentPrice: number
      lastUpdated: number
    }>
  > {
    if (!this.db) throw new Error('Database not initialized')
    return await this.db.getAll('portfolio')
  }

  /**
   * Delete a portfolio holding
   */
  async deletePortfolioHolding(symbol: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    await this.db.delete('portfolio', symbol)
  }

  // ===== Watchlist Operations =====

  /**
   * Save watchlist stocks
   */
  async saveWatchlist(
    stocks: Array<{
      symbol: string
      name: string
      price: number
      change: number
      lastUpdated: number
    }>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const tx = this.db.transaction('watchlist', 'readwrite')
    const store = tx.objectStore('watchlist')

    await Promise.all(stocks.map(stock => store.put(stock)))
    await tx.done
  }

  /**
   * Get all watchlist stocks
   */
  async getWatchlist(): Promise<
    Array<{
      symbol: string
      name: string
      price: number
      change: number
      lastUpdated: number
    }>
  > {
    if (!this.db) throw new Error('Database not initialized')
    return await this.db.getAll('watchlist')
  }

  /**
   * Delete a watchlist stock
   */
  async deleteWatchlistStock(symbol: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    await this.db.delete('watchlist', symbol)
  }

  // ===== Price History Operations =====

  /**
   * Save price history for a symbol
   */
  async savePriceHistory(
    symbol: string,
    data: Array<{
      symbol: string
      timestamp: number
      open: number
      high: number
      low: number
      close: number
      volume: number
    }>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const tx = this.db.transaction('priceHistory', 'readwrite')
    const store = tx.objectStore('priceHistory')

    await Promise.all(data.map(entry => store.put(entry)))
    await tx.done
  }

  /**
   * Get price history for a symbol (limited by days)
   */
  async getPriceHistory(symbol: string, days: number): Promise<
    Array<{
      symbol: string
      timestamp: number
      open: number
      high: number
      low: number
      close: number
      volume: number
    }>
  > {
    if (!this.db) throw new Error('Database not initialized')

    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000
    const tx = this.db.transaction('priceHistory', 'readonly')
    const index = tx.objectStore('priceHistory').index('by-symbol')

    const allHistory = await index.getAll(symbol)

    // Filter by time range
    return allHistory.filter(entry => entry.timestamp >= cutoffTime)
  }

  // ===== Data Cleanup =====

  /**
   * Clear all data from database
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const tx = this.db.transaction(['portfolio', 'watchlist', 'priceHistory'], 'readwrite')

    await tx.objectStore('portfolio').clear()
    await tx.objectStore('watchlist').clear()
    await tx.objectStore('priceHistory').clear()

    await tx.done
  }

  /**
   * Remove data older than specified days
   */
  async cleanupExpiredData(maxAgeDays: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

    // Clean portfolio
    const portfolio = await this.getPortfolio()
    const expiredPortfolio = portfolio.filter(h => h.lastUpdated < cutoffTime)
    for (const holding of expiredPortfolio) {
      await this.deletePortfolioHolding(holding.symbol)
    }

    // Clean watchlist
    const watchlist = await this.getWatchlist()
    const expiredWatchlist = watchlist.filter(s => s.lastUpdated < cutoffTime)
    for (const stock of expiredWatchlist) {
      await this.deleteWatchlistStock(stock.symbol)
    }

    // Clean price history
    const tx = this.db.transaction('priceHistory', 'readwrite')
    const store = tx.objectStore('priceHistory')
    const allHistory = await store.getAll()

    const expiredHistory = allHistory.filter(entry => entry.timestamp < cutoffTime)
    for (const entry of expiredHistory) {
      await store.delete([entry.symbol, entry.timestamp])
    }

    await tx.done
  }

  // ===== Statistics =====

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    portfolioCount: number
    watchlistCount: number
    priceHistoryCount: number
  }> {
    if (!this.db) throw new Error('Database not initialized')

    const [portfolioCount, watchlistCount, priceHistoryCount] = await Promise.all([
      this.db.count('portfolio'),
      this.db.count('watchlist'),
      this.db.count('priceHistory'),
    ])

    return {
      portfolioCount,
      watchlistCount,
      priceHistoryCount,
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// Export singleton instance
export const turtleTradingStorage = new TurtleTradingStorage()
