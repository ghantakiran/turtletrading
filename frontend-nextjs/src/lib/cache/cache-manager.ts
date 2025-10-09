/**
 * Cache Manager with TTL (Time To Live)
 * Manages key-value cache with automatic expiration
 */

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds (0 = infinite)
}

export class CacheManager {
  private cache: Map<string, CacheEntry>
  private storageKey: string

  constructor(storageKey = 'turtle-trading-cache') {
    this.cache = new Map()
    this.storageKey = storageKey
    this.loadFromStorage()
  }

  /**
   * Set a cache entry with TTL
   */
  async set(key: string, value: any, ttl: number): Promise<void> {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid cache key')
    }

    if (typeof ttl !== 'number' || isNaN(ttl)) {
      throw new Error('Invalid TTL value')
    }

    const entry: CacheEntry = {
      data: value,
      timestamp: Date.now(),
      ttl,
    }

    this.cache.set(key, entry)
    await this.saveToStorage()
  }

  /**
   * Get a cache entry (returns null if expired or not found)
   */
  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    if (this.isExpired(entry)) {
      await this.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Check if a key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    if (this.isExpired(entry)) {
      await this.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key)
    await this.saveToStorage()
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear()
    await this.saveToStorage()
  }

  /**
   * Remove expired entries and return count
   */
  async prune(): Promise<number> {
    let removed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      await this.saveToStorage()
    }

    return removed
  }

  /**
   * Get cache size (excluding expired entries)
   */
  async size(): Promise<number> {
    await this.prune()
    return this.cache.size
  }

  /**
   * Get all cache keys (excluding expired entries)
   */
  async keys(): Promise<string[]> {
    await this.prune()
    return Array.from(this.cache.keys())
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    // TTL of 0 or negative means infinite
    if (entry.ttl <= 0) {
      return false
    }

    const now = Date.now()
    const age = now - entry.timestamp

    return age > entry.ttl
  }

  /**
   * Save cache to localStorage
   */
  private async saveToStorage(): Promise<void> {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const cacheData = Array.from(this.cache.entries())
      localStorage.setItem(this.storageKey, JSON.stringify(cacheData))
    } catch (error) {
      console.error('Failed to save cache to storage:', error)
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const cacheData = JSON.parse(stored)
        this.cache = new Map(cacheData)
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error)
      this.cache = new Map()
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager()
