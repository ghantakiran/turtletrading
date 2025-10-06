/**
 * Business Metrics Tracker - Unit Tests
 * Following TDD approach: Write tests first, then implementation
 */

import { BusinessMetricsTracker } from '../business-metrics'
import * as Sentry from '@sentry/nextjs'

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  setMeasurement: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
}))

describe('BusinessMetricsTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('trackUserAction', () => {
    it('should track user action with action name and duration', () => {
      BusinessMetricsTracker.trackUserAction('portfolio_view', 1250)

      expect(Sentry.setMeasurement).toHaveBeenCalledWith(
        'user.action.duration',
        1250,
        'millisecond'
      )
      expect(Sentry.setContext).toHaveBeenCalledWith('user_action', {
        action: 'portfolio_view',
        duration: 1250,
        timestamp: expect.any(Number),
      })
    })

    it('should add breadcrumb for user action', () => {
      BusinessMetricsTracker.trackUserAction('watchlist_add', 500)

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'user.action',
        message: 'watchlist_add',
        level: 'info',
        data: {
          duration: 500,
        },
      })
    })

    it('should handle metadata in user actions', () => {
      BusinessMetricsTracker.trackUserAction('stock_search', 300, {
        query: 'AAPL',
        results: 1,
      })

      expect(Sentry.setContext).toHaveBeenCalledWith('user_action', {
        action: 'stock_search',
        duration: 300,
        timestamp: expect.any(Number),
        metadata: {
          query: 'AAPL',
          results: 1,
        },
      })
    })
  })

  describe('trackPageView', () => {
    it('should track page view with path and load time', () => {
      BusinessMetricsTracker.trackPageView('/dashboard', 1800)

      expect(Sentry.setMeasurement).toHaveBeenCalledWith(
        'page.view.duration',
        1800,
        'millisecond'
      )
      expect(Sentry.setContext).toHaveBeenCalledWith('page_view', {
        path: '/dashboard',
        loadTime: 1800,
        timestamp: expect.any(Number),
      })
    })

    it('should add breadcrumb for page navigation', () => {
      BusinessMetricsTracker.trackPageView('/portfolio', 1200)

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'navigation',
        message: 'Page view: /portfolio',
        level: 'info',
        data: {
          path: '/portfolio',
          loadTime: 1200,
        },
      })
    })
  })

  describe('trackAPICall', () => {
    it('should track successful API call', () => {
      BusinessMetricsTracker.trackAPICall('/api/stocks/AAPL', 'GET', 200, 150)

      expect(Sentry.setMeasurement).toHaveBeenCalledWith(
        'api.call.duration',
        150,
        'millisecond'
      )
      expect(Sentry.setContext).toHaveBeenCalledWith('api_call', {
        endpoint: '/api/stocks/AAPL',
        method: 'GET',
        status: 200,
        duration: 150,
        performance: 'good',
        timestamp: expect.any(Number),
      })
    })

    it('should track failed API call', () => {
      BusinessMetricsTracker.trackAPICall('/api/portfolio', 'POST', 500, 3000)

      expect(Sentry.setContext).toHaveBeenCalledWith('api_call', {
        endpoint: '/api/portfolio',
        method: 'POST',
        status: 500,
        duration: 3000,
        performance: 'poor',
        timestamp: expect.any(Number),
      })

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'api.error',
        message: 'API call failed: POST /api/portfolio',
        level: 'error',
        data: {
          status: 500,
          duration: 3000,
        },
      })
    })

    it('should categorize API performance', () => {
      // Fast API call
      BusinessMetricsTracker.trackAPICall('/api/quick', 'GET', 200, 50)

      let context = (Sentry.setContext as any).mock.calls[0][1]
      expect(context.performance).toBe('excellent')

      jest.clearAllMocks()

      // Slow API call
      BusinessMetricsTracker.trackAPICall('/api/slow', 'GET', 200, 600)

      context = (Sentry.setContext as any).mock.calls[0][1]
      expect(context.performance).toBe('poor')
    })
  })

  describe('trackFeatureUsage', () => {
    it('should track feature usage', () => {
      BusinessMetricsTracker.trackFeatureUsage('ai_predictions', 'AAPL')

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'feature.usage',
        message: 'Feature used: ai_predictions',
        level: 'info',
        data: {
          feature: 'ai_predictions',
          context: 'AAPL',
          timestamp: expect.any(Number),
        },
      })
    })

    it('should increment feature usage counter', () => {
      BusinessMetricsTracker.trackFeatureUsage('watchlist_add', 'TSLA')

      expect(Sentry.setContext).toHaveBeenCalledWith('feature_usage', {
        feature: 'watchlist_add',
        context: 'TSLA',
        timestamp: expect.any(Number),
      })
    })
  })

  describe('trackError', () => {
    it('should track application error', () => {
      const error = new Error('Test error')
      BusinessMetricsTracker.trackError(error, 'user_action', { action: 'test' })

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'error',
        message: 'Test error',
        level: 'error',
        data: {
          errorContext: 'user_action',
          metadata: { action: 'test' },
        },
      })
    })
  })

  describe('Business Metrics Analytics', () => {
    it('should calculate session metrics', () => {
      const metrics = BusinessMetricsTracker.getSessionMetrics()

      expect(metrics).toHaveProperty('pageViews')
      expect(metrics).toHaveProperty('apiCalls')
      expect(metrics).toHaveProperty('userActions')
      expect(metrics).toHaveProperty('sessionDuration')
    })

    it('should reset session metrics', () => {
      BusinessMetricsTracker.trackUserAction('test', 100)
      BusinessMetricsTracker.resetSessionMetrics()

      const metrics = BusinessMetricsTracker.getSessionMetrics()
      expect(metrics.userActions).toBe(0)
    })
  })
})
