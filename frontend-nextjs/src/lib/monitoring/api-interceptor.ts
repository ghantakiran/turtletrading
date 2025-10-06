/**
 * API Performance Interceptor
 * Automatically tracks all fetch API calls for performance monitoring
 */

import { BusinessMetricsTracker } from './business-metrics'
import { PerformanceTracker } from './performance'

// Store original fetch (only in browser)
const originalFetch = typeof window !== 'undefined' ? window.fetch : undefined

/**
 * Install API performance tracking interceptor
 */
export function installAPIInterceptor() {
  if (typeof window === 'undefined' || !originalFetch) return

  // Override global fetch
  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const [resource, config] = args
    const url = resource.toString()
    const method = config?.method || 'GET'
    const startTime = performance.now()

    try {
      const response = await originalFetch!.apply(this, args)
      const duration = performance.now() - startTime

      // Track API performance
      PerformanceTracker.trackAPIRequest(url, duration, response.status)
      BusinessMetricsTracker.trackAPICall(url, method, response.status, duration)

      return response
    } catch (error) {
      const duration = performance.now() - startTime

      // Track failed API call
      BusinessMetricsTracker.trackAPICall(url, method, 0, duration)
      BusinessMetricsTracker.trackError(
        error instanceof Error ? error : new Error('API call failed'),
        'api_interceptor',
        { url, method }
      )

      throw error
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[API Interceptor] Performance tracking installed')
  }
}

/**
 * Uninstall API interceptor (restore original fetch)
 */
export function uninstallAPIInterceptor() {
  if (typeof window === 'undefined' || !originalFetch) return

  window.fetch = originalFetch

  if (process.env.NODE_ENV === 'development') {
    console.log('[API Interceptor] Performance tracking uninstalled')
  }
}
