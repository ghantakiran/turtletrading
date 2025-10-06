/**
 * Performance Monitoring Utilities
 * Tracks Web Vitals and custom performance metrics
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'
import * as Sentry from '@sentry/nextjs'

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  INP: { good: 200, needsImprovement: 500 },   // Interaction to Next Paint (replaces FID)
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
  onCLS(sendToAnalytics)
  onFCP(sendToAnalytics)
  onINP(sendToAnalytics)
  onLCP(sendToAnalytics)
  onTTFB(sendToAnalytics)
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

  // Send to Sentry using setMeasurement
  Sentry.setMeasurement(name, value, name === 'CLS' ? 'ratio' : 'millisecond')

  // Add context to current scope
  Sentry.setContext('web_vitals', {
    [name]: {
      value: Math.round(value),
      rating,
      delta: Math.round(delta),
    }
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

    Sentry.setMeasurement('api.request.duration', duration, 'millisecond')
    Sentry.setContext('api_performance', {
      endpoint,
      status,
      rating,
      duration: Math.round(duration),
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

    Sentry.setMeasurement('page.load.duration', duration, 'millisecond')
    Sentry.setContext('page_load', {
      path,
      rating,
      duration: Math.round(duration),
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

    Sentry.setMeasurement('websocket.latency', latency, 'millisecond')
    Sentry.setContext('websocket_performance', {
      symbol,
      rating,
      latency: Math.round(latency),
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

    Sentry.setMeasurement('user.action.duration', duration, 'millisecond')
    Sentry.setContext('user_action', {
      action,
      duration: Math.round(duration),
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
