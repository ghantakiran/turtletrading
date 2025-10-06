/**
 * Performance Monitoring Utilities
 * Tracks Web Vitals and custom performance metrics
 */

import { getCLS, getFCP, getFID, getLCP, getTTFB, Metric } from 'web-vitals'
import * as Sentry from '@sentry/nextjs'

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },   // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte

  // Custom thresholds
  API_RESPONSE: { good: 200, needsImprovement: 500 },
  PAGE_LOAD: { good: 2000, needsImprovement: 4000 },
  WEBSOCKET_LATENCY: { good: 100, needsImprovement: 300 },
}

/**
 * Initialize Web Vitals monitoring
 */
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return

  // Track Core Web Vitals
  getCLS(sendToAnalytics)
  getFCP(sendToAnalytics)
  getFID(sendToAnalytics)
  getLCP(sendToAnalytics)
  getTTFB(sendToAnalytics)
}

/**
 * Send metrics to analytics and Sentry
 */
function sendToAnalytics(metric: Metric) {
  const { name, value, rating, delta } = metric

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${name}:`, {
      value: Math.round(value),
      rating,
      delta: Math.round(delta),
    })
  }

  // Send to Sentry
  Sentry.metrics.distribution(name, value, {
    tags: { rating },
    unit: name === 'CLS' ? 'ratio' : 'millisecond',
  })

  // Track as custom event
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', name, {
      value: Math.round(value),
      metric_rating: rating,
      metric_delta: Math.round(delta),
    })
  }
}

/**
 * Track custom performance metrics
 */
export class PerformanceTracker {
  /**
   * Track API request performance
   */
  static trackAPIRequest(endpoint: string, duration: number, status: number) {
    const rating = this.getRating(duration, PERFORMANCE_THRESHOLDS.API_RESPONSE)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Performance] ${endpoint}:`, {
        duration: Math.round(duration),
        status,
        rating,
      })
    }

    Sentry.metrics.distribution('api.request.duration', duration, {
      tags: {
        endpoint,
        status: status.toString(),
        rating,
      },
      unit: 'millisecond',
    })
  }

  /**
   * Track page load performance
   */
  static trackPageLoad(path: string, duration: number) {
    const rating = this.getRating(duration, PERFORMANCE_THRESHOLDS.PAGE_LOAD)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Page Load] ${path}:`, {
        duration: Math.round(duration),
        rating,
      })
    }

    Sentry.metrics.distribution('page.load.duration', duration, {
      tags: {
        path,
        rating,
      },
      unit: 'millisecond',
    })
  }

  /**
   * Track WebSocket latency
   */
  static trackWebSocketLatency(symbol: string, latency: number) {
    const rating = this.getRating(latency, PERFORMANCE_THRESHOLDS.WEBSOCKET_LATENCY)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[WebSocket] ${symbol}:`, {
        latency: Math.round(latency),
        rating,
      })
    }

    Sentry.metrics.distribution('websocket.latency', latency, {
      tags: {
        symbol,
        rating,
      },
      unit: 'millisecond',
    })
  }

  /**
   * Track custom user action duration
   */
  static trackUserAction(action: string, duration: number) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[User Action] ${action}:`, {
        duration: Math.round(duration),
      })
    }

    Sentry.metrics.distribution('user.action.duration', duration, {
      tags: { action },
      unit: 'millisecond',
    })
  }

  /**
   * Get performance rating based on thresholds
   */
  private static getRating(
    value: number,
    threshold: { good: number; needsImprovement: number }
  ): 'good' | 'needs-improvement' | 'poor' {
    if (value <= threshold.good) return 'good'
    if (value <= threshold.needsImprovement) return 'needs-improvement'
    return 'poor'
  }
}

/**
 * Performance monitoring hook for React components
 */
export function usePerformanceMonitor(componentName: string) {
  if (typeof window === 'undefined') return

  const startTime = performance.now()

  return {
    /**
     * Mark end of operation and track duration
     */
    end: (operation: string = 'render') => {
      const duration = performance.now() - startTime
      PerformanceTracker.trackUserAction(`${componentName}.${operation}`, duration)
    },
  }
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}
