/**
 * Business Metrics Tracker
 * Tracks custom business metrics for analytics and monitoring
 */

import * as Sentry from '@sentry/nextjs'

// Session metrics storage
interface SessionMetrics {
  pageViews: number
  apiCalls: number
  userActions: number
  sessionStart: number
  sessionDuration: number
}

class BusinessMetrics {
  private sessionMetrics: SessionMetrics = {
    pageViews: 0,
    apiCalls: 0,
    userActions: 0,
    sessionStart: Date.now(),
    sessionDuration: 0,
  }

  /**
   * Track user action with duration and optional metadata
   */
  trackUserAction(action: string, duration: number, metadata?: Record<string, any>) {
    this.sessionMetrics.userActions++

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Business Metrics] User Action: ${action}`, {
        duration,
        metadata,
      })
    }

    // Send to Sentry
    Sentry.setMeasurement('user.action.duration', duration, 'millisecond')

    const context: any = {
      action,
      duration,
      timestamp: Date.now(),
    }

    if (metadata) {
      context.metadata = metadata
    }

    Sentry.setContext('user_action', context)

    // Add breadcrumb for tracking user flow
    Sentry.addBreadcrumb({
      category: 'user.action',
      message: action,
      level: 'info',
      data: {
        duration,
      },
    })
  }

  /**
   * Track page view with load time
   */
  trackPageView(path: string, loadTime: number) {
    this.sessionMetrics.pageViews++

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Business Metrics] Page View: ${path}`, { loadTime })
    }

    Sentry.setMeasurement('page.view.duration', loadTime, 'millisecond')

    Sentry.setContext('page_view', {
      path,
      loadTime,
      timestamp: Date.now(),
    })

    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `Page view: ${path}`,
      level: 'info',
      data: {
        path,
        loadTime,
      },
    })
  }

  /**
   * Track API call with method, status, and duration
   */
  trackAPICall(
    endpoint: string,
    method: string,
    status: number,
    duration: number
  ) {
    this.sessionMetrics.apiCalls++

    const performance = this.categorizeAPIPerformance(duration)
    const isError = status >= 400

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Business Metrics] API Call: ${method} ${endpoint}`, {
        status,
        duration,
        performance,
      })
    }

    Sentry.setMeasurement('api.call.duration', duration, 'millisecond')

    Sentry.setContext('api_call', {
      endpoint,
      method,
      status,
      duration,
      performance,
      timestamp: Date.now(),
    })

    // Add error breadcrumb for failed API calls
    if (isError) {
      Sentry.addBreadcrumb({
        category: 'api.error',
        message: `API call failed: ${method} ${endpoint}`,
        level: 'error',
        data: {
          status,
          duration,
        },
      })
    } else {
      Sentry.addBreadcrumb({
        category: 'api.call',
        message: `${method} ${endpoint}`,
        level: 'info',
        data: {
          status,
          duration,
        },
      })
    }
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature: string, context?: string) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Business Metrics] Feature Usage: ${feature}`, { context })
    }

    Sentry.setContext('feature_usage', {
      feature,
      context,
      timestamp: Date.now(),
    })

    Sentry.addBreadcrumb({
      category: 'feature.usage',
      message: `Feature used: ${feature}`,
      level: 'info',
      data: {
        feature,
        context,
        timestamp: Date.now(),
      },
    })
  }

  /**
   * Track application error with context
   */
  trackError(error: Error, errorContext: string, metadata?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Business Metrics] Error in ${errorContext}:`, error, metadata)
    }

    Sentry.addBreadcrumb({
      category: 'error',
      message: error.message,
      level: 'error',
      data: {
        errorContext,
        metadata,
      },
    })
  }

  /**
   * Get current session metrics
   */
  getSessionMetrics(): SessionMetrics {
    this.sessionMetrics.sessionDuration = Date.now() - this.sessionMetrics.sessionStart
    return { ...this.sessionMetrics }
  }

  /**
   * Reset session metrics
   */
  resetSessionMetrics() {
    this.sessionMetrics = {
      pageViews: 0,
      apiCalls: 0,
      userActions: 0,
      sessionStart: Date.now(),
      sessionDuration: 0,
    }
  }

  /**
   * Categorize API performance based on duration
   */
  private categorizeAPIPerformance(duration: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (duration < 100) return 'excellent'
    if (duration < 300) return 'good'
    if (duration < 500) return 'fair'
    return 'poor'
  }
}

// Export singleton instance
export const BusinessMetricsTracker = new BusinessMetrics()
