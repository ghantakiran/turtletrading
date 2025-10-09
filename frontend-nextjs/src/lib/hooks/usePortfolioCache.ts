/**
 * usePortfolioCache Hook
 * Manages portfolio data with offline caching support
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { turtleTradingStorage } from '@/lib/storage/indexeddb-storage'

interface PortfolioHolding {
  symbol: string
  shares: number
  avgCost: number
  currentPrice: number
  lastUpdated: number
}

interface UsePortfolioCacheReturn {
  portfolio: PortfolioHolding[]
  isLoading: boolean
  error: Error | null
  isCached: boolean
  lastUpdated: number | null
  loadPortfolio: () => Promise<void>
  updateCache: (data: PortfolioHolding[]) => Promise<void>
}

export function usePortfolioCache(autoLoad = true): UsePortfolioCacheReturn {
  const [portfolio, setPortfolio] = useState<PortfolioHolding[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [isCached, setIsCached] = useState<boolean>(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  // Initialize storage
  useEffect(() => {
    turtleTradingStorage.init()
  }, [])

  // Load portfolio data
  const loadPortfolio = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (navigator.onLine) {
        // Fetch from API when online
        const response = await fetch('/api/portfolio')

        if (!response.ok) {
          throw new Error('Failed to fetch portfolio')
        }

        const data = await response.json()

        // Update state
        setPortfolio(data)
        setLastUpdated(Date.now())
        setIsCached(false)

        // Cache the data
        await turtleTradingStorage.savePortfolio(data)
      } else {
        // Load from cache when offline
        const cachedData = await turtleTradingStorage.getPortfolio()

        setPortfolio(cachedData)
        setIsCached(true)

        if (cachedData.length > 0) {
          setLastUpdated(cachedData[0]?.lastUpdated || null)
        }
      }
    } catch (err) {
      console.error('Failed to load portfolio:', err)
      setError(err as Error)

      // Try to load from cache on error
      try {
        const cachedData = await turtleTradingStorage.getPortfolio()
        setPortfolio(cachedData)
        setIsCached(true)

        if (cachedData.length > 0) {
          setLastUpdated(cachedData[0]?.lastUpdated || null)
        }
      } catch (cacheErr) {
        console.error('Failed to load from cache:', cacheErr)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update cache
  const updateCache = useCallback(async (data: PortfolioHolding[]) => {
    await turtleTradingStorage.savePortfolio(data)
    setPortfolio(data)
    setLastUpdated(Date.now())
    setIsCached(true)
  }, [])

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadPortfolio()
    }
  }, [autoLoad, loadPortfolio])

  return {
    portfolio,
    isLoading,
    error,
    isCached,
    lastUpdated,
    loadPortfolio,
    updateCache,
  }
}
