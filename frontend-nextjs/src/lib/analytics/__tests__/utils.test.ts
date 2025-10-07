/**
 * Analytics Utilities Unit Tests
 * Following TDD - tests written before implementation
 */

import {
  createAPIRequest,
  saveAPIRequest,
  loadAPIRequests,
  getUsageStats,
  getAnalyticsSummary,
  getRequestsByDateRange,
  getRequestsByEndpoint,
  calculateSuccessRate,
  calculateAverageResponseTime,
  getTopEndpoints,
  getRecentErrors,
  cleanupOldRequests,
} from '../utils'
import type { APIRequest } from '@/types/analytics'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('Analytics Utilities', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('createAPIRequest', () => {
    it('should create an API request with required fields', () => {
      const request = createAPIRequest({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/stocks/AAPL/price',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
      })

      expect(request).toMatchObject({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/stocks/AAPL/price',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        success: true,
      })
      expect(request.id).toBeDefined()
      expect(request.timestamp).toBeDefined()
    })

    it('should mark failed requests (4xx/5xx) as unsuccessful', () => {
      const request404 = createAPIRequest({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/stocks/INVALID',
        method: 'GET',
        statusCode: 404,
        responseTime: 50,
      })

      expect(request404.success).toBe(false)

      const request500 = createAPIRequest({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/stocks/AAPL',
        method: 'GET',
        statusCode: 500,
        responseTime: 200,
      })

      expect(request500.success).toBe(false)
    })

    it('should include error message for failed requests', () => {
      const request = createAPIRequest({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/stocks/AAPL',
        method: 'GET',
        statusCode: 500,
        responseTime: 100,
        errorMessage: 'Internal server error',
      })

      expect(request.errorMessage).toBe('Internal server error')
    })
  })

  describe('saveAPIRequest and loadAPIRequests', () => {
    it('should save and load API requests from localStorage', () => {
      const request1 = createAPIRequest({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/stocks/AAPL',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
      })

      const request2 = createAPIRequest({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/stocks/MSFT',
        method: 'GET',
        statusCode: 200,
        responseTime: 120,
      })

      saveAPIRequest(request1)
      saveAPIRequest(request2)

      const loaded = loadAPIRequests()
      expect(loaded).toHaveLength(2)
      expect(loaded[0].id).toBe(request2.id) // Most recent first
      expect(loaded[1].id).toBe(request1.id)
    })

    it('should handle empty localStorage gracefully', () => {
      const requests = loadAPIRequests()
      expect(requests).toEqual([])
    })

    it('should limit stored requests to MAX_STORED_REQUESTS', () => {
      // Create more than max requests
      for (let i = 0; i < 1050; i++) {
        const request = createAPIRequest({
          apiKeyId: 'key-123',
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 200,
          responseTime: 100,
        })
        saveAPIRequest(request)
      }

      const loaded = loadAPIRequests()
      expect(loaded.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('getUsageStats', () => {
    it('should calculate usage statistics correctly', () => {
      const requests: APIRequest[] = [
        createAPIRequest({
          apiKeyId: 'key-123',
          endpoint: '/api/v1/stocks/AAPL',
          method: 'GET',
          statusCode: 200,
          responseTime: 100,
        }),
        createAPIRequest({
          apiKeyId: 'key-123',
          endpoint: '/api/v1/stocks/AAPL',
          method: 'GET',
          statusCode: 200,
          responseTime: 150,
        }),
        createAPIRequest({
          apiKeyId: 'key-123',
          endpoint: '/api/v1/stocks/MSFT',
          method: 'GET',
          statusCode: 404,
          responseTime: 50,
        }),
      ]

      const stats = getUsageStats(requests)

      expect(stats.totalRequests).toBe(3)
      expect(stats.successfulRequests).toBe(2)
      expect(stats.failedRequests).toBe(1)
      expect(stats.averageResponseTime).toBe(100) // (100 + 150 + 50) / 3
      expect(stats.requestsByEndpoint['/api/v1/stocks/AAPL']).toBe(2)
      expect(stats.requestsByEndpoint['/api/v1/stocks/MSFT']).toBe(1)
    })

    it('should handle empty request array', () => {
      const stats = getUsageStats([])

      expect(stats.totalRequests).toBe(0)
      expect(stats.successfulRequests).toBe(0)
      expect(stats.failedRequests).toBe(0)
      expect(stats.averageResponseTime).toBe(0)
      expect(stats.requestsByEndpoint).toEqual({})
    })

    it('should group requests by day', () => {
      const today = new Date().toISOString().split('T')[0]
      const requests: APIRequest[] = [
        { ...createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }), timestamp: `${today}T10:00:00.000Z` },
        { ...createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }), timestamp: `${today}T15:00:00.000Z` },
      ]

      const stats = getUsageStats(requests)
      expect(stats.requestsByDay).toHaveLength(1)
      expect(stats.requestsByDay[0].date).toBe(today)
      expect(stats.requestsByDay[0].count).toBe(2)
    })
  })

  describe('calculateSuccessRate', () => {
    it('should calculate success rate as percentage', () => {
      const requests: APIRequest[] = [
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 404, responseTime: 50 }),
      ]

      const successRate = calculateSuccessRate(requests)
      expect(successRate).toBe(75) // 3/4 = 75%
    })

    it('should return 100 for all successful requests', () => {
      const requests: APIRequest[] = [
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 201, responseTime: 100 }),
      ]

      expect(calculateSuccessRate(requests)).toBe(100)
    })

    it('should return 0 for empty array', () => {
      expect(calculateSuccessRate([])).toBe(0)
    })
  })

  describe('calculateAverageResponseTime', () => {
    it('should calculate average response time', () => {
      const requests: APIRequest[] = [
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 200 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 150 }),
      ]

      expect(calculateAverageResponseTime(requests)).toBe(150)
    })

    it('should return 0 for empty array', () => {
      expect(calculateAverageResponseTime([])).toBe(0)
    })
  })

  describe('getTopEndpoints', () => {
    it('should return top endpoints sorted by usage', () => {
      const requests: APIRequest[] = [
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/AAPL', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/AAPL', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/AAPL', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/MSFT', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/sentiment', method: 'GET', statusCode: 200, responseTime: 100 }),
      ]

      const topEndpoints = getTopEndpoints(requests, 2)
      expect(topEndpoints).toHaveLength(2)
      expect(topEndpoints[0]).toMatchObject({
        endpoint: '/api/stocks/AAPL',
        count: 3,
        percentage: 60, // 3/5 = 60%
      })
      expect(topEndpoints[1].endpoint).toBe('/api/stocks/MSFT')
    })

    it('should limit results to specified count', () => {
      const requests: APIRequest[] = [
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/a', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/b', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/c', method: 'GET', statusCode: 200, responseTime: 100 }),
      ]

      const top2 = getTopEndpoints(requests, 2)
      expect(top2).toHaveLength(2)
    })
  })

  describe('getRecentErrors', () => {
    it('should return only failed requests', () => {
      const requests: APIRequest[] = [
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 404, responseTime: 50 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 500, responseTime: 200 }),
      ]

      const errors = getRecentErrors(requests)
      expect(errors).toHaveLength(2)
      expect(errors.every(r => !r.success)).toBe(true)
    })

    it('should return most recent errors first', () => {
      const older = createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 404, responseTime: 50 })
      older.timestamp = new Date(Date.now() - 10000).toISOString()

      const newer = createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 500, responseTime: 50 })

      const requests: APIRequest[] = [older, newer]

      const errors = getRecentErrors(requests)
      expect(errors[0].id).toBe(newer.id)
    })

    it('should limit to specified count', () => {
      const requests: APIRequest[] = Array.from({ length: 20 }, () =>
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 404, responseTime: 50 })
      )

      const errors = getRecentErrors(requests, 10)
      expect(errors).toHaveLength(10)
    })
  })

  describe('getRequestsByDateRange', () => {
    it('should filter requests by date range', () => {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)

      const requests: APIRequest[] = [
        { ...createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }), timestamp: twoDaysAgo.toISOString() },
        { ...createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }), timestamp: yesterday.toISOString() },
        { ...createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }), timestamp: today.toISOString() },
      ]

      const filtered = getRequestsByDateRange(requests, yesterday.toISOString(), today.toISOString())
      expect(filtered).toHaveLength(2)
    })
  })

  describe('getRequestsByEndpoint', () => {
    it('should filter requests by endpoint', () => {
      const requests: APIRequest[] = [
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/AAPL', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/MSFT', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/AAPL', method: 'GET', statusCode: 200, responseTime: 100 }),
      ]

      const aaplRequests = getRequestsByEndpoint(requests, '/api/stocks/AAPL')
      expect(aaplRequests).toHaveLength(2)
    })
  })

  describe('cleanupOldRequests', () => {
    it('should remove requests older than specified days', () => {
      const today = new Date()
      const oldDate = new Date(today.getTime() - 35 * 24 * 60 * 60 * 1000) // 35 days ago

      const requests: APIRequest[] = [
        { ...createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }), timestamp: oldDate.toISOString() },
        { ...createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/test', method: 'GET', statusCode: 200, responseTime: 100 }), timestamp: today.toISOString() },
      ]

      // Save requests
      requests.forEach(saveAPIRequest)

      // Cleanup old requests (older than 30 days)
      cleanupOldRequests(30)

      const remaining = loadAPIRequests()
      expect(remaining).toHaveLength(1)
      expect(new Date(remaining[0].timestamp).getTime()).toBeGreaterThan(oldDate.getTime())
    })
  })

  describe('getAnalyticsSummary', () => {
    it('should generate comprehensive analytics summary', () => {
      const requests: APIRequest[] = [
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/AAPL', method: 'GET', statusCode: 200, responseTime: 100 }),
        createAPIRequest({ apiKeyId: 'key-1', endpoint: '/api/stocks/AAPL', method: 'GET', statusCode: 200, responseTime: 150 }),
        createAPIRequest({ apiKeyId: 'key-2', endpoint: '/api/sentiment', method: 'GET', statusCode: 404, responseTime: 50 }),
      ]

      const summary = getAnalyticsSummary(requests, 2)

      expect(summary.totalKeys).toBe(2)
      expect(summary.totalRequests).toBe(3)
      expect(summary.activeKeys).toBe(2)
      expect(summary.avgResponseTime).toBe(100)
      expect(summary.successRate).toBe(Math.round((2/3) * 100))
      expect(summary.topEndpoints).toHaveLength(2)
      expect(summary.recentErrors).toHaveLength(1)
    })
  })
})
