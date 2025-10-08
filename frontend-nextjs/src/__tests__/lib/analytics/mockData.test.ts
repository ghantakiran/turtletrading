/**
 * Unit tests for analytics mock data generator
 * TDD approach - tests written before implementation
 */

import {
  generateMockRequest,
  generateMockAnalytics,
  generateMockAnalyticsForTimeRange,
  TimeRange,
} from '@/lib/analytics/mockData'
import type { APIRequest } from '@/types/analytics'

describe('generateMockRequest', () => {
  it('should generate a valid API request', () => {
    const request = generateMockRequest()

    expect(request).toHaveProperty('id')
    expect(request).toHaveProperty('apiKeyId')
    expect(request).toHaveProperty('endpoint')
    expect(request).toHaveProperty('method')
    expect(request).toHaveProperty('timestamp')
    expect(request).toHaveProperty('responseTime')
    expect(request).toHaveProperty('statusCode')
    expect(request).toHaveProperty('success')
  })

  it('should generate valid HTTP methods', () => {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    const request = generateMockRequest()

    expect(validMethods).toContain(request.method)
  })

  it('should generate realistic response times', () => {
    const request = generateMockRequest()

    expect(request.responseTime).toBeGreaterThan(0)
    expect(request.responseTime).toBeLessThan(5000) // Under 5 seconds
  })

  it('should generate valid status codes', () => {
    const request = generateMockRequest()

    expect(request.statusCode).toBeGreaterThanOrEqual(200)
    expect(request.statusCode).toBeLessThan(600)
  })

  it('should mark successful requests correctly', () => {
    const requests = Array.from({ length: 100 }, () => generateMockRequest())

    requests.forEach(req => {
      if (req.statusCode >= 200 && req.statusCode < 300) {
        expect(req.success).toBe(true)
      } else {
        expect(req.success).toBe(false)
      }
    })
  })

  it('should include error message for failed requests', () => {
    const requests = Array.from({ length: 100 }, () => generateMockRequest())

    requests.forEach(req => {
      if (!req.success) {
        expect(req.errorMessage).toBeDefined()
        expect(req.errorMessage!.length).toBeGreaterThan(0)
      }
    })
  })
})

describe('generateMockAnalytics', () => {
  it('should generate specified number of requests', () => {
    const analytics = generateMockAnalytics(50)

    expect(analytics.length).toBe(50)
  })

  it('should generate requests with recent timestamps', () => {
    const analytics = generateMockAnalytics(10)
    const now = new Date()

    analytics.forEach(req => {
      const reqDate = new Date(req.timestamp)
      expect(reqDate.getTime()).toBeLessThanOrEqual(now.getTime())
    })
  })

  it('should handle zero requests', () => {
    const analytics = generateMockAnalytics(0)

    expect(analytics).toEqual([])
  })

  it('should generate diverse endpoints', () => {
    const analytics = generateMockAnalytics(100)
    const endpoints = new Set(analytics.map(r => r.endpoint))

    // Should have multiple unique endpoints
    expect(endpoints.size).toBeGreaterThan(1)
  })
})

describe('generateMockAnalyticsForTimeRange', () => {
  it('should generate requests within 7 days for "7d" range', () => {
    const requests = generateMockAnalyticsForTimeRange(TimeRange.SEVEN_DAYS, 50)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    requests.forEach(req => {
      const reqDate = new Date(req.timestamp)
      expect(reqDate.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime())
      expect(reqDate.getTime()).toBeLessThanOrEqual(now.getTime())
    })
  })

  it('should generate requests within 30 days for "30d" range', () => {
    const requests = generateMockAnalyticsForTimeRange(TimeRange.THIRTY_DAYS, 50)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    requests.forEach(req => {
      const reqDate = new Date(req.timestamp)
      expect(reqDate.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime())
      expect(reqDate.getTime()).toBeLessThanOrEqual(now.getTime())
    })
  })

  it('should generate requests within 90 days for "90d" range', () => {
    const requests = generateMockAnalyticsForTimeRange(TimeRange.NINETY_DAYS, 50)
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    requests.forEach(req => {
      const reqDate = new Date(req.timestamp)
      expect(reqDate.getTime()).toBeGreaterThanOrEqual(ninetyDaysAgo.getTime())
      expect(reqDate.getTime()).toBeLessThanOrEqual(now.getTime())
    })
  })

  it('should generate correct number of requests', () => {
    const count = 75
    const requests = generateMockAnalyticsForTimeRange(TimeRange.SEVEN_DAYS, count)

    expect(requests.length).toBe(count)
  })

  it('should distribute requests across the time range', () => {
    const requests = generateMockAnalyticsForTimeRange(TimeRange.THIRTY_DAYS, 100)
    const timestamps = requests.map(r => new Date(r.timestamp).getTime())

    // Check that requests are spread out (not all at the same time)
    const uniqueDays = new Set(timestamps.map(t => Math.floor(t / (24 * 60 * 60 * 1000))))
    expect(uniqueDays.size).toBeGreaterThan(1)
  })
})
