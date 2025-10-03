"use client"

import { useEffect } from 'react'
import { useMarketStore } from '@/stores'

/**
 * Connection Monitor Component
 *
 * Simple connectivity monitor that checks backend health on mount and periodically.
 * Assumes backend is available if the app is running (simplified approach).
 */
export function ConnectionMonitor() {
  const setConnectionStatus = useMarketStore(state => state.setConnectionStatus)

  useEffect(() => {
    // Simple approach: assume connected when component mounts
    // The actual backend connectivity will be checked when API calls are made
    setConnectionStatus('connected')

    // Set up periodic health check every 30 seconds
    const interval = setInterval(async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)

        const response = await fetch('http://localhost:8000/health', {
          signal: controller.signal,
          cache: 'no-store'
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          setConnectionStatus('connected')
        } else {
          setConnectionStatus('disconnected')
        }
      } catch (error) {
        setConnectionStatus('disconnected')
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [setConnectionStatus])

  return null
}
