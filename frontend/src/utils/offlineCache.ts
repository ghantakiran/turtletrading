/**
 * Offline Cache Management System
 * Comprehensive caching strategy for stock data, user preferences, and application state
 */

import { pwaManager } from './pwa';

// Cache configuration
export interface CacheConfig {
  name: string;
  version: string;
  maxAge: number; // in milliseconds
  maxEntries: number;
  strategy: 'network-first' | 'cache-first' | 'stale-while-revalidate';
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
  etag?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SyncQueueItem {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  priority: number;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// Cache configurations for different data types
export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  STOCK_PRICES: {
    name: 'stock-prices',
    version: '1.0',
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 500,
    strategy: 'network-first'
  },
  STOCK_DETAILS: {
    name: 'stock-details',
    version: '1.0',
    maxAge: 30 * 60 * 1000, // 30 minutes
    maxEntries: 200,
    strategy: 'stale-while-revalidate'
  },
  TECHNICAL_INDICATORS: {
    name: 'technical-indicators',
    version: '1.0',
    maxAge: 15 * 60 * 1000, // 15 minutes
    maxEntries: 300,
    strategy: 'network-first'
  },
  MARKET_DATA: {
    name: 'market-data',
    version: '1.0',
    maxAge: 10 * 60 * 1000, // 10 minutes
    maxEntries: 100,
    strategy: 'network-first'
  },
  USER_PREFERENCES: {
    name: 'user-preferences',
    version: '1.0',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxEntries: 50,
    strategy: 'cache-first'
  },
  NEWS_DATA: {
    name: 'news-data',
    version: '1.0',
    maxAge: 60 * 60 * 1000, // 1 hour
    maxEntries: 200,
    strategy: 'stale-while-revalidate'
  }
};

export class OfflineCacheManager {
  private static instance: OfflineCacheManager;
  private dbName = 'TurtleTradingCache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  private constructor() {
    this.initializeDatabase();
    this.setupEventListeners();
    this.loadSyncQueue();
  }

  public static getInstance(): OfflineCacheManager {
    if (!OfflineCacheManager.instance) {
      OfflineCacheManager.instance = new OfflineCacheManager();
    }
    return OfflineCacheManager.instance;
  }

  /**
   * Initialize IndexedDB database
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores for each cache type
        Object.values(CACHE_CONFIGS).forEach(config => {
          if (!db.objectStoreNames.contains(config.name)) {
            const store = db.createObjectStore(config.name, { keyPath: 'key' });
            store.createIndex('timestamp', 'timestamp');
            store.createIndex('expiresAt', 'expiresAt');
            store.createIndex('priority', 'priority');
          }
        });

        // Create sync queue store
        if (!db.objectStoreNames.contains('sync-queue')) {
          const syncStore = db.createObjectStore('sync-queue', { keyPath: 'id' });
          syncStore.createIndex('priority', 'priority');
          syncStore.createIndex('timestamp', 'timestamp');
        }

        // Create metadata store
        if (!db.objectStoreNames.contains('cache-metadata')) {
          db.createObjectStore('cache-metadata', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Cleanup expired entries periodically
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Get data from cache or network
   */
  public async get<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    key: string,
    fetchFn?: () => Promise<T>,
    options?: { force?: boolean; priority?: 'high' | 'medium' | 'low' }
  ): Promise<T | null> {
    const config = CACHE_CONFIGS[cacheType];
    const fullKey = `${config.name}:${key}`;

    try {
      // Check cache first unless forced refresh
      if (!options?.force) {
        const cachedData = await this.getCachedData<T>(config.name, fullKey);

        if (cachedData && !this.isExpired(cachedData)) {
          // Return cached data and optionally update in background
          if (config.strategy === 'stale-while-revalidate' && fetchFn && this.isOnline) {
            this.updateInBackground(config, fullKey, fetchFn, options?.priority);
          }
          return cachedData.data;
        }
      }

      // Fetch from network if online and fetch function provided
      if (this.isOnline && fetchFn) {
        try {
          const freshData = await fetchFn();
          await this.setCachedData(config, fullKey, freshData, options?.priority);
          return freshData;
        } catch (error) {
          console.error('Network fetch failed, falling back to cache:', error);

          // Return stale cache if available
          const staleData = await this.getCachedData<T>(config.name, fullKey);
          return staleData?.data || null;
        }
      }

      // Return cached data even if expired when offline
      if (!this.isOnline) {
        const offlineData = await this.getCachedData<T>(config.name, fullKey);
        return offlineData?.data || null;
      }

      return null;
    } catch (error) {
      console.error('Cache get operation failed:', error);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  public async set<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    key: string,
    data: T,
    options?: { priority?: 'high' | 'medium' | 'low'; customTTL?: number }
  ): Promise<void> {
    const config = CACHE_CONFIGS[cacheType];
    const fullKey = `${config.name}:${key}`;

    try {
      await this.setCachedData(config, fullKey, data, options?.priority, options?.customTTL);
    } catch (error) {
      console.error('Cache set operation failed:', error);
    }
  }

  /**
   * Remove data from cache
   */
  public async remove(cacheType: keyof typeof CACHE_CONFIGS, key: string): Promise<void> {
    const config = CACHE_CONFIGS[cacheType];
    const fullKey = `${config.name}:${key}`;

    if (!this.db) return;

    try {
      const transaction = this.db.transaction([config.name], 'readwrite');
      const store = transaction.objectStore(config.name);
      await store.delete(fullKey);
    } catch (error) {
      console.error('Cache remove operation failed:', error);
    }
  }

  /**
   * Clear entire cache for a specific type
   */
  public async clearCache(cacheType: keyof typeof CACHE_CONFIGS): Promise<void> {
    const config = CACHE_CONFIGS[cacheType];

    if (!this.db) return;

    try {
      const transaction = this.db.transaction([config.name], 'readwrite');
      const store = transaction.objectStore(config.name);
      await store.clear();
    } catch (error) {
      console.error('Cache clear operation failed:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<Record<string, any>> {
    if (!this.db) return {};

    const stats: Record<string, any> = {};

    try {
      for (const [type, config] of Object.entries(CACHE_CONFIGS)) {
        const transaction = this.db.transaction([config.name], 'readonly');
        const store = transaction.objectStore(config.name);
        const count = await store.count();

        // Get size estimation
        const cursor = await store.openCursor();
        let totalSize = 0;
        let expiredCount = 0;
        const now = Date.now();

        if (cursor) {
          do {
            const entry = cursor.value as CacheEntry;
            totalSize += JSON.stringify(entry).length;
            if (entry.expiresAt < now) {
              expiredCount++;
            }
          } while (await cursor.continue());
        }

        stats[type] = {
          entries: count,
          estimatedSize: totalSize,
          expiredEntries: expiredCount,
          hitRate: await this.getHitRate(config.name)
        };
      }

      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {};
    }
  }

  /**
   * Add request to sync queue for offline execution
   */
  public async addToSyncQueue(
    url: string,
    method: string = 'GET',
    headers: Record<string, string> = {},
    body?: string,
    priority: number = 5
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      url,
      method,
      headers,
      body,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    this.syncQueue.push(item);
    await this.saveSyncQueue();

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  /**
   * Process sync queue when online
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || this.syncQueue.length === 0) return;

    this.syncInProgress = true;

    try {
      // Sort by priority and timestamp
      this.syncQueue.sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);

      for (let i = this.syncQueue.length - 1; i >= 0; i--) {
        const item = this.syncQueue[i];

        try {
          const response = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: item.body
          });

          if (response.ok) {
            // Success - remove from queue
            this.syncQueue.splice(i, 1);
          } else {
            // Failed - increment retry count
            item.retryCount++;
            if (item.retryCount >= item.maxRetries) {
              this.syncQueue.splice(i, 1);
              console.error('Sync item exceeded max retries:', item);
            }
          }
        } catch (error) {
          item.retryCount++;
          if (item.retryCount >= item.maxRetries) {
            this.syncQueue.splice(i, 1);
            console.error('Sync item failed permanently:', error);
          }
        }
      }

      await this.saveSyncQueue();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Private helper methods
   */
  private async getCachedData<T>(storeName: string, key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null;

    try {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const result = await store.get(key);
      return result || null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  private async setCachedData<T>(
    config: CacheConfig,
    key: string,
    data: T,
    priority: 'high' | 'medium' | 'low' = 'medium',
    customTTL?: number
  ): Promise<void> {
    if (!this.db) return;

    const now = Date.now();
    const ttl = customTTL || config.maxAge;

    const entry: CacheEntry<T> & { key: string } = {
      key,
      data,
      timestamp: now,
      expiresAt: now + ttl,
      version: config.version,
      priority
    };

    try {
      const transaction = this.db.transaction([config.name], 'readwrite');
      const store = transaction.objectStore(config.name);

      await store.put(entry);

      // Update hit rate tracking
      await this.updateHitRate(config.name, true);

      // Cleanup if over max entries
      await this.enforceMaxEntries(config);
    } catch (error) {
      console.error('Failed to set cached data:', error);
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private async updateInBackground<T>(
    config: CacheConfig,
    key: string,
    fetchFn: () => Promise<T>,
    priority?: 'high' | 'medium' | 'low'
  ): Promise<void> {
    try {
      const freshData = await fetchFn();
      await this.setCachedData(config, key, freshData, priority);
    } catch (error) {
      console.error('Background update failed:', error);
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    if (!this.db) return;

    const now = Date.now();

    try {
      for (const config of Object.values(CACHE_CONFIGS)) {
        const transaction = this.db.transaction([config.name], 'readwrite');
        const store = transaction.objectStore(config.name);
        const index = store.index('expiresAt');

        const range = IDBKeyRange.upperBound(now);
        const cursor = await index.openCursor(range);

        if (cursor) {
          do {
            await cursor.delete();
          } while (await cursor.continue());
        }
      }
    } catch (error) {
      console.error('Cleanup expired entries failed:', error);
    }
  }

  private async enforceMaxEntries(config: CacheConfig): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([config.name], 'readwrite');
      const store = transaction.objectStore(config.name);
      const count = await store.count();

      if (count > config.maxEntries) {
        const index = store.index('timestamp');
        const cursor = await index.openCursor();
        let deleted = 0;
        const toDelete = count - config.maxEntries;

        if (cursor) {
          do {
            await cursor.delete();
            deleted++;
            if (deleted >= toDelete) break;
          } while (await cursor.continue());
        }
      }
    } catch (error) {
      console.error('Enforce max entries failed:', error);
    }
  }

  private async getHitRate(storeName: string): Promise<number> {
    try {
      const metadata = await this.getCacheMetadata(`${storeName}_stats`);
      if (metadata) {
        const { hits = 0, misses = 0 } = metadata;
        return hits + misses > 0 ? hits / (hits + misses) : 0;
      }
    } catch (error) {
      console.error('Failed to get hit rate:', error);
    }
    return 0;
  }

  private async updateHitRate(storeName: string, hit: boolean): Promise<void> {
    try {
      const key = `${storeName}_stats`;
      const metadata = await this.getCacheMetadata(key) || { hits: 0, misses: 0 };

      if (hit) {
        metadata.hits++;
      } else {
        metadata.misses++;
      }

      await this.setCacheMetadata(key, metadata);
    } catch (error) {
      console.error('Failed to update hit rate:', error);
    }
  }

  private async getCacheMetadata(key: string): Promise<any> {
    if (!this.db) return null;

    try {
      const transaction = this.db.transaction(['cache-metadata'], 'readonly');
      const store = transaction.objectStore('cache-metadata');
      const result = await store.get(key);
      return result?.data || null;
    } catch (error) {
      console.error('Failed to get cache metadata:', error);
      return null;
    }
  }

  private async setCacheMetadata(key: string, data: any): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['cache-metadata'], 'readwrite');
      const store = transaction.objectStore('cache-metadata');
      await store.put({ key, data });
    } catch (error) {
      console.error('Failed to set cache metadata:', error);
    }
  }

  private async loadSyncQueue(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['sync-queue'], 'readonly');
      const store = transaction.objectStore('sync-queue');
      const cursor = await store.openCursor();

      this.syncQueue = [];
      if (cursor) {
        do {
          this.syncQueue.push(cursor.value);
        } while (await cursor.continue());
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private async saveSyncQueue(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['sync-queue'], 'readwrite');
      const store = transaction.objectStore('sync-queue');

      // Clear existing queue
      await store.clear();

      // Add current queue items
      for (const item of this.syncQueue) {
        await store.add(item);
      }
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }
}

// Export singleton instance
export const offlineCache = OfflineCacheManager.getInstance();

// React hooks for cache management
import { useState, useEffect } from 'react';

export function useCachedData<T>(
  cacheType: keyof typeof CACHE_CONFIGS,
  key: string,
  fetchFn?: () => Promise<T>,
  options?: { enabled?: boolean; refetchInterval?: number }
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isCached: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCached, setIsCached] = useState(false);

  const refetch = async () => {
    if (!fetchFn) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await offlineCache.get(cacheType, key, fetchFn, { force: true });
      setData(result);
      setIsCached(false);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!options?.enabled) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await offlineCache.get(cacheType, key, fetchFn);
        setData(result);

        // Check if data came from cache
        const cachedResult = await offlineCache.get(cacheType, key);
        setIsCached(!!cachedResult);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Set up refetch interval if specified
    let intervalId: NodeJS.Timeout;
    if (options?.refetchInterval) {
      intervalId = setInterval(loadData, options.refetchInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [cacheType, key, options?.enabled, options?.refetchInterval]);

  return { data, isLoading, error, refetch, isCached };
}

export function useCacheStats() {
  const [stats, setStats] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const cacheStats = await offlineCache.getCacheStats();
        setStats(cacheStats);
      } catch (error) {
        console.error('Failed to load cache stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();

    // Refresh stats every 30 seconds
    const intervalId = setInterval(loadStats, 30000);
    return () => clearInterval(intervalId);
  }, []);

  return { stats, isLoading };
}