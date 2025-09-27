/**
 * WebSocket Service Unit Tests
 * 100% coverage for WebSocket service functionality
 */

import { WebSocketService, WebSocketMessage } from '../websocketService'

// Mock WebSocket
class MockWebSocket {
  url: string
  readyState: number
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url: string) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING

    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    // Mock sending message
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }))
    }
  }

  // Helper methods for testing
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(data)
      }))
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  simulateClose(code: number = 1000, reason: string = 'Normal closure') {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }))
    }
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  log: jest.spyOn(console, 'log').mockImplementation(),
}

// Mock timers
jest.useFakeTimers()

describe('WebSocket Service', () => {
  let wsService: WebSocketService
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    // Create new service instance
    wsService = new WebSocketService('ws://localhost:8000/ws')

    // Get reference to the mock WebSocket instance
    mockWebSocket = (wsService as any).ws as MockWebSocket
  })

  afterEach(() => {
    // Clean up
    wsService.disconnect()
    jest.runOnlyPendingTimers()
  })

  afterAll(() => {
    // Restore console methods and timers
    Object.values(consoleSpy).forEach(spy => spy.mockRestore())
    jest.useRealTimers()
  })

  describe('Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      const connectPromise = wsService.connect()

      // Fast-forward time to trigger connection
      jest.advanceTimersByTime(20)

      await connectPromise

      expect(wsService.isConnected()).toBe(true)
      expect(wsService.getConnectionState()).toBe('connected')
    })

    it('should handle connection authentication', async () => {
      const token = 'test-auth-token'

      const connectPromise = wsService.connect(token)
      jest.advanceTimersByTime(20)
      await connectPromise

      // Simulate authentication message
      mockWebSocket.simulateMessage({
        type: 'auth',
        status: 'success'
      })

      expect(wsService.isAuthenticated()).toBe(true)
    })

    it('should implement reconnection logic', async () => {
      // Initial connection
      await wsService.connect()
      jest.advanceTimersByTime(20)

      expect(wsService.isConnected()).toBe(true)

      // Simulate unexpected disconnection
      mockWebSocket.simulateClose(1006, 'Connection lost')

      expect(wsService.isConnected()).toBe(false)
      expect(wsService.getConnectionState()).toBe('reconnecting')

      // Fast-forward to trigger reconnection
      jest.advanceTimersByTime(2000)

      // Should attempt to reconnect
      expect(wsService.getReconnectAttempts()).toBeGreaterThan(0)
    })

    it('should handle reconnection with exponential backoff', async () => {
      await wsService.connect()
      jest.advanceTimersByTime(20)

      // Simulate multiple failed reconnections
      for (let i = 0; i < 3; i++) {
        mockWebSocket.simulateClose(1006, 'Connection lost')
        jest.advanceTimersByTime(1000 * Math.pow(2, i)) // Exponential backoff

        // Simulate connection failure
        mockWebSocket.simulateError()
        jest.advanceTimersByTime(100)
      }

      expect(wsService.getReconnectAttempts()).toBe(3)
    })

    it('should stop reconnection after max attempts', async () => {
      await wsService.connect()
      jest.advanceTimersByTime(20)

      // Simulate max reconnection attempts (default 5)
      for (let i = 0; i < 6; i++) {
        mockWebSocket.simulateClose(1006, 'Connection lost')
        jest.advanceTimersByTime(5000)
        mockWebSocket.simulateError()
        jest.advanceTimersByTime(100)
      }

      expect(wsService.getConnectionState()).toBe('failed')
      expect(wsService.getReconnectAttempts()).toBe(5)
    })

    it('should handle manual disconnection', () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      wsService.disconnect()

      expect(wsService.isConnected()).toBe(false)
      expect(wsService.getConnectionState()).toBe('disconnected')
    })
  })

  describe('Message Handling', () => {
    beforeEach(async () => {
      await wsService.connect()
      jest.advanceTimersByTime(20)
    })

    it('should handle real-time price updates', () => {
      const priceUpdateHandler = jest.fn()
      wsService.subscribe('price_update', priceUpdateHandler)

      const priceData = {
        type: 'price_update',
        data: {
          symbol: 'AAPL',
          price: 150.25,
          change: 2.50,
          changePercent: 1.69,
          timestamp: Date.now()
        }
      }

      mockWebSocket.simulateMessage(priceData)

      expect(priceUpdateHandler).toHaveBeenCalledWith(priceData.data)
    })

    it('should handle real-time sentiment updates', () => {
      const sentimentHandler = jest.fn()
      wsService.subscribe('sentiment_update', sentimentHandler)

      const sentimentData = {
        type: 'sentiment_update',
        data: {
          symbol: 'AAPL',
          sentiment: 0.75,
          volume: 1500,
          timestamp: Date.now()
        }
      }

      mockWebSocket.simulateMessage(sentimentData)

      expect(sentimentHandler).toHaveBeenCalledWith(sentimentData.data)
    })

    it('should handle market status updates', () => {
      const statusHandler = jest.fn()
      wsService.subscribe('market_status', statusHandler)

      const statusData = {
        type: 'market_status',
        data: {
          isOpen: true,
          nextOpen: '2024-01-16T09:30:00Z',
          nextClose: '2024-01-15T16:00:00Z'
        }
      }

      mockWebSocket.simulateMessage(statusData)

      expect(statusHandler).toHaveBeenCalledWith(statusData.data)
    })

    it('should handle subscription management', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      // Subscribe to price updates
      const unsubscribe1 = wsService.subscribe('price_update', handler1)
      const unsubscribe2 = wsService.subscribe('price_update', handler2)

      const priceData = {
        type: 'price_update',
        data: { symbol: 'AAPL', price: 150 }
      }

      mockWebSocket.simulateMessage(priceData)

      expect(handler1).toHaveBeenCalledWith(priceData.data)
      expect(handler2).toHaveBeenCalledWith(priceData.data)

      // Unsubscribe first handler
      unsubscribe1()

      mockWebSocket.simulateMessage(priceData)

      expect(handler1).toHaveBeenCalledTimes(1) // Not called again
      expect(handler2).toHaveBeenCalledTimes(2) // Called again
    })

    it('should buffer messages during disconnection', () => {
      const handler = jest.fn()
      wsService.subscribe('price_update', handler)

      // Disconnect
      wsService.disconnect()

      // Try to send message while disconnected
      wsService.send({
        type: 'subscribe',
        channel: 'AAPL'
      })

      expect(wsService.getBufferedMessages()).toHaveLength(1)

      // Reconnect
      wsService.connect()
      jest.advanceTimersByTime(20)

      // Buffered messages should be sent
      expect(wsService.getBufferedMessages()).toHaveLength(0)
    })

    it('should handle malformed messages gracefully', () => {
      const handler = jest.fn()
      wsService.subscribe('price_update', handler)

      // Simulate malformed JSON
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: 'invalid-json{'
        }))
      }

      expect(handler).not.toHaveBeenCalled()
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse WebSocket message'),
        expect.any(Error)
      )
    })

    it('should handle unknown message types', () => {
      const unknownMessage = {
        type: 'unknown_type',
        data: { some: 'data' }
      }

      mockWebSocket.simulateMessage(unknownMessage)

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'Unknown WebSocket message type:',
        'unknown_type'
      )
    })
  })

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await wsService.connect()
      jest.advanceTimersByTime(20)
    })

    it('should manage subscription channels', () => {
      const handler = jest.fn()

      // Subscribe to symbol
      wsService.subscribeToSymbol('AAPL', handler)

      expect(wsService.getSubscriptions()).toContain('AAPL')

      // Unsubscribe
      wsService.unsubscribeFromSymbol('AAPL')

      expect(wsService.getSubscriptions()).not.toContain('AAPL')
    })

    it('should handle multiple symbol subscriptions', () => {
      const appleHandler = jest.fn()
      const microsoftHandler = jest.fn()

      wsService.subscribeToSymbol('AAPL', appleHandler)
      wsService.subscribeToSymbol('MSFT', microsoftHandler)

      expect(wsService.getSubscriptions()).toContain('AAPL')
      expect(wsService.getSubscriptions()).toContain('MSFT')

      // Simulate price updates for different symbols
      mockWebSocket.simulateMessage({
        type: 'price_update',
        data: { symbol: 'AAPL', price: 150 }
      })

      mockWebSocket.simulateMessage({
        type: 'price_update',
        data: { symbol: 'MSFT', price: 300 }
      })

      expect(appleHandler).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'AAPL' })
      )
      expect(microsoftHandler).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'MSFT' })
      )
    })

    it('should handle subscription to market indices', () => {
      const handler = jest.fn()

      wsService.subscribeToMarketData(handler)

      mockWebSocket.simulateMessage({
        type: 'market_update',
        data: {
          indices: {
            'S&P 500': { value: 4200, change: 25 },
            'NASDAQ': { value: 13500, change: -50 }
          }
        }
      })

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          indices: expect.any(Object)
        })
      )
    })

    it('should handle high-frequency data updates', () => {
      const handler = jest.fn()
      wsService.subscribeToSymbol('AAPL', handler)

      // Simulate rapid price updates
      for (let i = 0; i < 100; i++) {
        mockWebSocket.simulateMessage({
          type: 'price_update',
          data: {
            symbol: 'AAPL',
            price: 150 + Math.random(),
            timestamp: Date.now() + i
          }
        })
      }

      expect(handler).toHaveBeenCalledTimes(100)
    })
  })

  describe('Connection Health and Monitoring', () => {
    beforeEach(async () => {
      await wsService.connect()
      jest.advanceTimersByTime(20)
    })

    it('should implement heartbeat/ping-pong', () => {
      const pingHandler = jest.fn()
      wsService.subscribe('ping', pingHandler)

      // Simulate server ping
      mockWebSocket.simulateMessage({
        type: 'ping',
        timestamp: Date.now()
      })

      // Should automatically respond with pong
      expect(wsService.getLastPingTime()).toBeDefined()
    })

    it('should detect connection health issues', () => {
      const healthHandler = jest.fn()
      wsService.subscribe('connection_health', healthHandler)

      // Simulate missed heartbeats
      jest.advanceTimersByTime(30000) // 30 seconds

      expect(wsService.getConnectionHealth()).toMatch(/unhealthy|poor/)
    })

    it('should track connection statistics', () => {
      wsService.subscribeToSymbol('AAPL', jest.fn())

      // Simulate some messages
      for (let i = 0; i < 10; i++) {
        mockWebSocket.simulateMessage({
          type: 'price_update',
          data: { symbol: 'AAPL', price: 150 }
        })
      }

      const stats = wsService.getConnectionStats()
      expect(stats.messagesReceived).toBe(10)
      expect(stats.uptime).toBeGreaterThan(0)
    })

    it('should handle connection timeout', async () => {
      wsService.disconnect()

      // Try to connect with timeout
      const connectionPromise = wsService.connect(undefined, { timeout: 1000 })

      // Don't simulate successful connection
      jest.advanceTimersByTime(2000)

      await expect(connectionPromise).rejects.toThrow('Connection timeout')
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle WebSocket errors gracefully', async () => {
      await wsService.connect()
      jest.advanceTimersByTime(20)

      const errorHandler = jest.fn()
      wsService.onError(errorHandler)

      mockWebSocket.simulateError()

      expect(errorHandler).toHaveBeenCalled()
      expect(wsService.getConnectionState()).toBe('error')
    })

    it('should handle network connectivity issues', async () => {
      await wsService.connect()
      jest.advanceTimersByTime(20)

      // Simulate network disconnection
      mockWebSocket.simulateClose(1006, 'Network error')

      expect(wsService.getConnectionState()).toBe('reconnecting')

      // Should attempt to reconnect
      jest.advanceTimersByTime(2000)

      expect(wsService.getReconnectAttempts()).toBeGreaterThan(0)
    })

    it('should handle server-side errors', () => {
      const handler = jest.fn()
      wsService.subscribe('error', handler)

      mockWebSocket.simulateMessage({
        type: 'error',
        data: {
          code: 'SUBSCRIPTION_FAILED',
          message: 'Failed to subscribe to AAPL',
          details: 'Invalid symbol'
        }
      })

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUBSCRIPTION_FAILED'
        })
      )
    })

    it('should handle rate limiting from server', () => {
      const rateLimitHandler = jest.fn()
      wsService.subscribe('rate_limit', rateLimitHandler)

      mockWebSocket.simulateMessage({
        type: 'rate_limit',
        data: {
          message: 'Rate limit exceeded',
          retryAfter: 60
        }
      })

      expect(rateLimitHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: 60
        })
      )
    })
  })

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      await wsService.connect()
      jest.advanceTimersByTime(20)
    })

    it('should handle message queuing and throttling', () => {
      const handler = jest.fn()
      wsService.subscribeToSymbol('AAPL', handler)

      // Send many messages rapidly
      for (let i = 0; i < 1000; i++) {
        wsService.send({
          type: 'subscribe',
          channel: `TEST_${i}`
        })
      }

      // Should implement some form of throttling
      expect(wsService.getQueueSize()).toBeLessThan(1000)
    })

    it('should optimize subscription management', () => {
      // Subscribe to many symbols
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN']
      symbols.forEach(symbol => {
        wsService.subscribeToSymbol(symbol, jest.fn())
      })

      expect(wsService.getSubscriptions()).toHaveLength(5)

      // Bulk unsubscribe
      wsService.unsubscribeAll()

      expect(wsService.getSubscriptions()).toHaveLength(0)
    })

    it('should handle memory cleanup', () => {
      const handlers: (() => void)[] = []

      // Create many subscriptions
      for (let i = 0; i < 100; i++) {
        const unsubscribe = wsService.subscribe('price_update', jest.fn())
        handlers.push(unsubscribe)
      }

      // Unsubscribe all
      handlers.forEach(unsubscribe => unsubscribe())

      // Memory should be cleaned up
      expect(wsService.getSubscriptionCount()).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await wsService.connect()
        jest.advanceTimersByTime(10)
        wsService.disconnect()
        jest.advanceTimersByTime(10)
      }

      expect(wsService.isConnected()).toBe(false)
    })

    it('should handle messages before connection is established', () => {
      const handler = jest.fn()
      wsService.subscribe('price_update', handler)

      // Try to send message before connecting
      wsService.send({
        type: 'subscribe',
        channel: 'AAPL'
      })

      expect(wsService.getBufferedMessages()).toHaveLength(1)
    })

    it('should handle WebSocket constructor failure', () => {
      // Mock WebSocket constructor to throw
      global.WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('WebSocket not supported')
      })

      expect(() => {
        new WebSocketService('ws://localhost:8000/ws')
      }).toThrow('WebSocket not supported')

      // Restore mock
      global.WebSocket = MockWebSocket as any
    })

    it('should handle invalid WebSocket URLs', () => {
      expect(() => {
        new WebSocketService('invalid-url')
      }).toThrow()
    })
  })
})