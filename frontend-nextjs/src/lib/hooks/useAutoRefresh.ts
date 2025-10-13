/**
 * useAutoRefresh Hook
 * Custom React hook for auto-refreshing data at specified intervals
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseAutoRefreshOptions<T> {
  enabled?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface UseAutoRefreshResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  lastUpdate: Date | null
  refresh: () => void
  pause: () => void
  resume: () => void
  isPaused: boolean
}

export function useAutoRefresh<T>(
  fetchFn: () => Promise<T>,
  interval: number = 30000,
  options: UseAutoRefreshOptions<T> = {}
): UseAutoRefreshResult<T> {
  const { enabled = true, onSuccess, onError } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      const result = await fetchFn()

      setData(result)
      setLastUpdate(new Date())

      if (onSuccess) {
        onSuccess(result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)

      if (onError) {
        onError(error)
      }
    } finally {
      setLoading(false)
    }
  }, [fetchFn, enabled, onSuccess, onError])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  const pause = useCallback(() => {
    setIsPaused(true)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const resume = useCallback(() => {
    setIsPaused(false)
  }, [])

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData()
    }
  }, [enabled, fetchData])

  // Setup auto-refresh interval
  useEffect(() => {
    if (!enabled || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Set up interval
    intervalRef.current = setInterval(() => {
      fetchData()
    }, interval)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, isPaused, interval, fetchData])

  return {
    data,
    loading,
    error,
    lastUpdate,
    refresh,
    pause,
    resume,
    isPaused,
  }
}
