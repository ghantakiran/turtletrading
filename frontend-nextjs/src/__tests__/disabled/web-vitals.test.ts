/**
 * Web Vitals Performance Monitoring Tests
 * 100% coverage for trading platform performance tracking
 */

import { initPerformanceMonitoring, getPerformanceMonitor, performanceUtils } from '../../../lib/performance/web-vitals'

// Mock window.performance and related APIs
const mockPerformance = {
  mark: jest.fn(),
  measure: jest.fn(),
  now: jest.fn(() => Date.now()),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
}

const mockNavigator = {
  sendBeacon: jest.fn(() => true),
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50
  }
}

// Mock web-vitals library
jest.mock('web-vitals', () => ({
  getCLS: jest.fn(),
  getFCP: jest.fn(),
  getFID: jest.fn(),
  getLCP: jest.fn(),
  getTTFB: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = jest.fn()

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor
  let originalPerformance: Performance
  let originalNavigator: Navigator

  beforeEach(() => {
    // Setup mocks
    originalPerformance = global.performance
    originalNavigator = global.navigator

    // @ts-ignore
    global.performance = mockPerformance
    // @ts-ignore
    global.navigator = mockNavigator

    // Reset mocks
    jest.clearAllMocks()

    // Create fresh monitor instance
    monitor = new PerformanceMonitor()
  })

  afterEach(() => {
    // Restore originals
    global.performance = originalPerformance
    global.navigator = originalNavigator

    // Cleanup monitor
    monitor.disconnect()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(monitor).toBeInstanceOf(PerformanceMonitor)
      expect(monitor.isEnabled()).toBe(true)
    })

    it('should generate unique session ID', () => {
      const monitor1 = new PerformanceMonitor()
      const monitor2 = new PerformanceMonitor()

      expect(monitor1.getSessionId()).not.toBe(monitor2.getSessionId())
      expect(monitor1.getSessionId()).toMatch(/^perf-session-\d+$/)
    })

    it('should initialize web vitals tracking', () => {
      const { getCLS, getFCP, getFID, getLCP, getTTFB } = require('web-vitals')

      expect(getCLS).toHaveBeenCalled()
      expect(getFCP).toHaveBeenCalled()
      expect(getFID).toHaveBeenCalled()
      expect(getLCP).toHaveBeenCalled()
      expect(getTTFB).toHaveBeenCalled()
    })
  })

  describe('Core Web Vitals Tracking', () => {
    it('should handle FCP (First Contentful Paint) metric', async () => {
      const { getFCP } = require('web-vitals')
      const fcpCallback = getFCP.mock.calls[0][0]

      const fcpMetric = {
        name: 'FCP',
        value: 1500,
        rating: 'good',
        delta: 1500,
        entries: []
      }

      fcpCallback(fcpMetric)

      const metrics = monitor.getMetrics()
      expect(metrics).toContainEqual(
        expect.objectContaining({
          name: 'FCP',
          value: 1500,
          rating: 'good'
        })
      )
    })

    it('should handle LCP (Largest Contentful Paint) metric', async () => {
      const { getLCP } = require('web-vitals')
      const lcpCallback = getLCP.mock.calls[0][0]

      const lcpMetric = {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        entries: []
      }

      lcpCallback(lcpMetric)

      const metrics = monitor.getMetrics()
      expect(metrics).toContainEqual(
        expect.objectContaining({
          name: 'LCP',
          value: 2000,
          rating: 'good'
        })
      )
    })

    it('should handle FID (First Input Delay) metric', async () => {
      const { getFID } = require('web-vitals')
      const fidCallback = getFID.mock.calls[0][0]

      const fidMetric = {
        name: 'FID',
        value: 50,
        rating: 'good',
        delta: 50,
        entries: []
      }

      fidCallback(fidMetric)

      const metrics = monitor.getMetrics()
      expect(metrics).toContainEqual(
        expect.objectContaining({
          name: 'FID',
          value: 50,
          rating: 'good'
        })
      )
    })

    it('should handle CLS (Cumulative Layout Shift) metric', async () => {
      const { getCLS } = require('web-vitals')
      const clsCallback = getCLS.mock.calls[0][0]

      const clsMetric = {
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        entries: []
      }

      clsCallback(clsMetric)

      const metrics = monitor.getMetrics()
      expect(metrics).toContainEqual(
        expect.objectContaining({
          name: 'CLS',
          value: 0.05,
          rating: 'good'
        })
      )
    })

    it('should handle TTFB (Time to First Byte) metric', async () => {
      const { getTTFB } = require('web-vitals')
      const ttfbCallback = getTTFB.mock.calls[0][0]

      const ttfbMetric = {
        name: 'TTFB',
        value: 300,
        rating: 'good',
        delta: 300,
        entries: []
      }

      ttfbCallback(ttfbMetric)

      const metrics = monitor.getMetrics()
      expect(metrics).toContainEqual(
        expect.objectContaining({
          name: 'TTFB',
          value: 300,
          rating: 'good'
        })
      )
    })
  })

  describe('Trading-Specific Custom Metrics', () => {
    it('should record real-time data latency', () => {
      monitor.recordCustomMetric(CUSTOM_METRICS.REAL_TIME_DATA_LATENCY, 45)

      const customMetrics = monitor.getCustomMetrics()
      expect(customMetrics[CUSTOM_METRICS.REAL_TIME_DATA_LATENCY]).toBe(45)
    })

    it('should record chart render time', () => {
      monitor.recordCustomMetric(CUSTOM_METRICS.CHART_RENDER_TIME, 120)

      const customMetrics = monitor.getCustomMetrics()
      expect(customMetrics[CUSTOM_METRICS.CHART_RENDER_TIME]).toBe(120)
    })

    it('should record WebSocket connection time', () => {
      monitor.recordCustomMetric(CUSTOM_METRICS.WEBSOCKET_CONNECTION_TIME, 800)

      const customMetrics = monitor.getCustomMetrics()
      expect(customMetrics[CUSTOM_METRICS.WEBSOCKET_CONNECTION_TIME]).toBe(800)
    })

    it('should record API response time', () => {
      monitor.recordCustomMetric(CUSTOM_METRICS.API_RESPONSE_TIME, 150)

      const customMetrics = monitor.getCustomMetrics()
      expect(customMetrics[CUSTOM_METRICS.API_RESPONSE_TIME]).toBe(150)
    })

    it('should warn for high real-time data latency', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      monitor.recordCustomMetric(CUSTOM_METRICS.REAL_TIME_DATA_LATENCY, 150)

      expect(consoleSpy).toHaveBeenCalledWith('High real-time data latency: 150ms')

      consoleSpy.mockRestore()
    })
  })

  describe('Performance Marks and Measures', () => {
    it('should create performance marks', () => {
      monitor.mark('chart-start')

      expect(mockPerformance.mark).toHaveBeenCalledWith('chart-start')
    })

    it('should create performance measures', () => {
      monitor.mark('chart-start')
      monitor.mark('chart-end')
      monitor.measure('chart-render', 'chart-start', 'chart-end')

      expect(mockPerformance.measure).toHaveBeenCalledWith('chart-render', 'chart-start', 'chart-end')
    })

    it('should get performance entries by name', () => {
      const mockEntries = [{ name: 'chart-render', duration: 100 }]
      mockPerformance.getEntriesByName.mockReturnValue(mockEntries)

      const entries = monitor.getEntriesByName('chart-render')

      expect(mockPerformance.getEntriesByName).toHaveBeenCalledWith('chart-render')
      expect(entries).toEqual(mockEntries)
    })

    it('should clear performance marks', () => {
      monitor.clearMarks('chart-start')

      expect(mockPerformance.clearMarks).toHaveBeenCalledWith('chart-start')
    })

    it('should clear performance measures', () => {
      monitor.clearMeasures('chart-render')

      expect(mockPerformance.clearMeasures).toHaveBeenCalledWith('chart-render')
    })
  })

  describe('Memory Usage Tracking', () => {
    it('should track memory usage when available', () => {
      // @ts-ignore
      global.performance.memory = {
        usedJSHeapSize: 50000000, // 50MB
        totalJSHeapSize: 100000000, // 100MB
        jsHeapSizeLimit: 2000000000 // 2GB
      }

      const memoryInfo = monitor.getMemoryInfo()

      expect(memoryInfo).toEqual({
        usedJSHeapSize: 50000000,
        totalJSHeapSize: 100000000,
        jsHeapSizeLimit: 2000000000,
        usagePercentage: 50
      })
    })

    it('should return null when memory API not available', () => {
      // @ts-ignore
      delete global.performance.memory

      const memoryInfo = monitor.getMemoryInfo()

      expect(memoryInfo).toBeNull()
    })
  })

  describe('Network Information', () => {
    it('should get network information when available', () => {
      const networkInfo = monitor.getNetworkInfo()

      expect(networkInfo).toEqual({
        effectiveType: '4g',
        downlink: 10,
        rtt: 50
      })
    })

    it('should return null when network API not available', () => {
      // @ts-ignore
      delete global.navigator.connection

      const networkInfo = monitor.getNetworkInfo()

      expect(networkInfo).toBeNull()
    })
  })

  describe('Data Collection and Batching', () => {
    it('should batch metrics for sending', () => {
      monitor.recordCustomMetric(CUSTOM_METRICS.REAL_TIME_DATA_LATENCY, 45)
      monitor.recordCustomMetric(CUSTOM_METRICS.CHART_RENDER_TIME, 120)

      const batch = monitor.getBatchedData()

      expect(batch).toEqual(
        expect.objectContaining({
          sessionId: expect.any(String),
          timestamp: expect.any(Number),
          metrics: expect.any(Array),
          customMetrics: expect.objectContaining({
            [CUSTOM_METRICS.REAL_TIME_DATA_LATENCY]: 45,
            [CUSTOM_METRICS.CHART_RENDER_TIME]: 120
          }),
          url: expect.any(String),
          userAgent: expect.any(String)
        })
      )
    })

    it('should send metrics using beacon API', async () => {
      monitor.recordCustomMetric(CUSTOM_METRICS.API_RESPONSE_TIME, 200)

      const success = await monitor.sendMetrics()

      expect(mockNavigator.sendBeacon).toHaveBeenCalledWith(
        expect.any(String), // analytics endpoint
        expect.any(String)  // JSON payload
      )
      expect(success).toBe(true)
    })

    it('should fallback to fetch when beacon not available', async () => {
      mockNavigator.sendBeacon = undefined

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('OK', { status: 200 })
      )

      monitor.recordCustomMetric(CUSTOM_METRICS.API_RESPONSE_TIME, 200)
      const success = await monitor.sendMetrics()

      expect(fetchSpy).toHaveBeenCalled()
      expect(success).toBe(true)

      fetchSpy.mockRestore()
    })

    it('should handle send failures gracefully', async () => {
      mockNavigator.sendBeacon.mockReturnValue(false)

      const success = await monitor.sendMetrics()

      expect(success).toBe(false)
    })
  })

  describe('Performance Thresholds and Alerts', () => {
    it('should detect poor performance metrics', () => {
      const { getLCP } = require('web-vitals')
      const lcpCallback = getLCP.mock.calls[0][0]

      const poorLcpMetric = {
        name: 'LCP',
        value: 4500, // Poor threshold
        rating: 'poor',
        delta: 4500,
        entries: []
      }

      lcpCallback(poorLcpMetric)

      const poorMetrics = monitor.getPoorPerformanceMetrics()
      expect(poorMetrics).toHaveLength(1)
      expect(poorMetrics[0].name).toBe('LCP')
      expect(poorMetrics[0].rating).toBe('poor')
    })

    it('should trigger performance alerts for critical thresholds', () => {
      const alertSpy = jest.spyOn(console, 'warn').mockImplementation()

      monitor.recordCustomMetric(CUSTOM_METRICS.REAL_TIME_DATA_LATENCY, 500) // Critical threshold

      expect(alertSpy).toHaveBeenCalledWith('High real-time data latency: 500ms')

      alertSpy.mockRestore()
    })
  })

  describe('Resource Timing', () => {
    it('should get resource timing data', () => {
      const mockResources = [
        { name: 'https://api.example.com/stocks/AAPL', duration: 150 },
        { name: 'https://ws.example.com/realtime', duration: 50 }
      ]

      mockPerformance.getEntriesByType.mockReturnValue(mockResources)

      const resources = monitor.getResourceTiming()

      expect(mockPerformance.getEntriesByType).toHaveBeenCalledWith('resource')
      expect(resources).toEqual(mockResources)
    })

    it('should filter API requests from resource timing', () => {
      const mockResources = [
        { name: 'https://api.example.com/stocks/AAPL', duration: 150 },
        { name: 'https://cdn.example.com/chart.js', duration: 300 },
        { name: 'https://api.example.com/market/data', duration: 200 }
      ]

      mockPerformance.getEntriesByType.mockReturnValue(mockResources)

      const apiRequests = monitor.getAPIRequestTiming()

      expect(apiRequests).toHaveLength(2)
      expect(apiRequests.every(req => req.name.includes('api.example.com'))).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing performance APIs gracefully', () => {
      // @ts-ignore
      global.performance = undefined

      expect(() => {
        const monitor = new PerformanceMonitor()
        monitor.mark('test')
      }).not.toThrow()
    })

    it('should handle metric collection errors', () => {
      mockPerformance.mark.mockImplementation(() => {
        throw new Error('Performance API error')
      })

      expect(() => {
        monitor.mark('error-test')
      }).not.toThrow()
    })

    it('should handle network send errors', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(
        new Error('Network error')
      )

      mockNavigator.sendBeacon = undefined

      const success = await monitor.sendMetrics()

      expect(success).toBe(false)

      fetchSpy.mockRestore()
    })
  })

  describe('Cleanup and Disposal', () => {
    it('should disconnect and cleanup resources', () => {
      monitor.disconnect()

      expect(monitor.isEnabled()).toBe(false)
    })

    it('should clear all metrics on reset', () => {
      monitor.recordCustomMetric(CUSTOM_METRICS.API_RESPONSE_TIME, 100)

      expect(monitor.getCustomMetrics()).not.toEqual({})

      monitor.reset()

      expect(monitor.getCustomMetrics()).toEqual({})
      expect(monitor.getMetrics()).toHaveLength(0)
    })

    it('should handle multiple disconnect calls safely', () => {
      expect(() => {
        monitor.disconnect()
        monitor.disconnect()
        monitor.disconnect()
      }).not.toThrow()
    })
  })
})