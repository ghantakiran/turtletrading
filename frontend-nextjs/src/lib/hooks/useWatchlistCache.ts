/**
 * useWatchlistCache Hook
 * Manages watchlist data with offline caching and queue support
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { turtleTradingStorage } from '@/lib/storage/indexeddb-storage'
import { OfflineQueue } from '@/lib/sync/offline-queue'

interface WatchlistStock {
  symbol: string
  name: string
  price: number
  change: number
  lastUpdated: number
}

interface UseWatchlistCacheReturn {
  watchlist: WatchlistStock[]
  isLoading: boolean
  error: Error | null
  loadWatchlist: () => Promise<void>
  addStock: (symbol: string) => Promise<void>
  removeStock: (symbol: string) => Promise<void>
}

export function useWatchlistCache(autoLoad = true): UseWatchlistCacheReturn {
  const [watchlist, setWatchlist] = useState<WatchlistStock[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const queueRef = useRef<OfflineQueue | null>(null)

  // Initialize storage and queue
  useEffect(() => {
    turtleTradingStorage.init()
    const queue = new OfflineQueue()
    queueRef.current = queue
    queue.init()
  }, [])

  // Load watchlist data
  const loadWatchlist = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (navigator.onLine) {
        // Fetch from API when online
        const response = await fetch('/api/watchlist')

        if (!response.ok) {
          throw new Error('Failed to fetch watchlist')
        }

        const data = await response.json()

        // Update state
        setWatchlist(data)

        // Cache the data
        await turtleTradingStorage.saveWatchlist(data)
      } else {
        // Load from cache when offline
        const cachedData = await turtleTradingStorage.getWatchlist()
        setWatchlist(cachedData)
      }
    } catch (err) {
      console.error('Failed to load watchlist:', err)
      setError(err as Error)

      // Try to load from cache on error
      try {
        const cachedData = await turtleTradingStorage.getWatchlist()
        setWatchlist(cachedData)
      } catch (cacheErr) {
        console.error('Failed to load from cache:', cacheErr)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Add stock to watchlist
  const addStock = useCallback(
    async (symbol: string) => {
      try {
        if (navigator.onLine) {
          // Call API when online
          const response = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol }),
          })

          if (!response.ok) {
            throw new Error('Failed to add stock to watchlist')
          }

          // Reload watchlist
          await loadWatchlist()
        } else {
          // Queue action when offline
          if (queueRef.current) {
            await queueRef.current.enqueue({
              type: 'ADD_TO_WATCHLIST',
              payload: { symbol },
            })
          }
        }
      } catch (err) {
        console.error('Failed to add stock:', err)
        setError(err as Error)
      }
    },
    [loadWatchlist]
  )

  // Remove stock from watchlist
  const removeStock = useCallback(
    async (symbol: string) => {
      try {
        if (navigator.onLine) {
          // Call API when online
          const response = await fetch(`/api/watchlist/${symbol}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            throw new Error('Failed to remove stock from watchlist')
          }

          // Reload watchlist
          await loadWatchlist()
        } else {
          // Queue action when offline
          if (queueRef.current) {
            await queueRef.current.enqueue({
              type: 'REMOVE_FROM_WATCHLIST',
              payload: { symbol },
            })
          }
        }
      } catch (err) {
        console.error('Failed to remove stock:', err)
        setError(err as Error)
      }
    },
    [loadWatchlist]
  )

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadWatchlist()
    }
  }, [autoLoad, loadWatchlist])

  return {
    watchlist,
    isLoading,
    error,
    loadWatchlist,
    addStock,
    removeStock,
  }
}
