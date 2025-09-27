/**
 * Unit tests for the enhanced WebSocket hook
 * Tests connection management, message handling, heartbeat, and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket, ConnectionState } from '../useWebSocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
    setTimeout(() => this.simulateOpen(), 0)
  }

  send = vi.fn()
  close = vi.fn()

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: any) {
    const event = new MessageEvent('message', { data: JSON.stringify(data) })
    this.onmessage?.(event)
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED
    const event = new CloseEvent('close', { code, reason })
    this.onclose?.(event)
  }
}

// Mock Zustand store
const mockMarketStore = {
  updateStockPrice: vi.fn(),
  updateConnectionStatus: vi.fn(),
  setConnectionStatus: vi.fn(),
  addNotification: vi.fn(),
  isConnected: false
}

// Mock useMarketStore hook
vi.mock('@/stores', () => ({
  useMarketStore: () => mockMarketStore
}))

// Mock environment variables
const mockEnv = {
  NEXT_PUBLIC_WS_URL: 'ws://localhost:8000/api/v1/websocket'
}

describe('useWebSocket', () => {
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    vi.resetAllMocks()

    // Mock WebSocket globally
    global.WebSocket = MockWebSocket as any

    // Mock timers
    vi.useFakeTimers()

    // Mock process.env
    process.env = { ...process.env, ...mockEnv }

    // Mock document
    global.document = {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Basic connection', () => {
    it('should establish WebSocket connection on mount', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      expect(mockMarketStore.setConnectionStatus).toHaveBeenCalledWith('connecting')
      expect(result.current.connectionState).toBe(ConnectionState.CONNECTED)
    })

    it('should not auto-connect when autoConnect is false', () => {
      renderHook(() => useWebSocket({ autoConnect: false }))

      expect(mockMarketStore.setConnectionStatus).not.toHaveBeenCalled()
    })

    it('should manually connect when connect() is called', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      act(() => {
        result.current.connect()
      })

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      expect(result.current.connectionState).toBe(ConnectionState.CONNECTED)
    })

    it('should disconnect when disconnect() is called', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED)
    })
  })

  describe('Message handling', () => {
    it('should handle price update messages', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      const priceUpdate = {
        type: 'price_update',
        symbol: 'AAPL',
        data: {
          price: 150.0,
          change: 2.5,
          changePercent: 1.67,
          volume: 1000000,
          marketCap: 2500000000
        },
        timestamp: new Date().toISOString()
      }

      // Simulate receiving price update
      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateMessage(priceUpdate)

      expect(mockMarketStore.updateStockPrice).toHaveBeenCalledWith('AAPL', {
        price: 150.0,
        change: 2.5,
        changePercent: 1.67,
        volume: 1000000,
        marketCap: 2500000000,
        symbol: 'AAPL',
        timestamp: priceUpdate.timestamp,
        high52Week: 0,
        low52Week: 0,
        avgVolume: 0
      })
    })

    it('should handle custom message callbacks', async () => {
      const onMessage = vi.fn()
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        onMessage
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      const testMessage = { type: 'test', data: 'test data' }
      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateMessage(testMessage)

      expect(onMessage).toHaveBeenCalledWith(testMessage)
    })

    it('should track message history when enabled', async () => {
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        enableMessageQueue: true,
        messageQueueSize: 10
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      const message1 = { type: 'test1', data: 'data1' }
      const message2 = { type: 'test2', data: 'data2' }

      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateMessage(message1)
      instance.simulateMessage(message2)

      expect(result.current.messageHistory).toHaveLength(2)
      expect(result.current.lastMessage).toEqual(message2)
    })
  })

  describe('Heartbeat mechanism', () => {
    it('should send ping messages when heartbeat is enabled', async () => {
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        enableHeartbeat: true,
        heartbeatInterval: 1000
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      // Fast-forward past heartbeat interval
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      expect(instance.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'ping',
          timestamp: expect.any(Number)
        })
      )
    })

    it('should handle pong responses and calculate latency', async () => {
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        enableHeartbeat: true
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      const pongMessage = { type: 'pong', timestamp: Date.now() }
      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateMessage(pongMessage)

      expect(result.current.connectionMetrics.averageLatency).toBeGreaterThanOrEqual(0)
    })

    it('should close connection on heartbeat timeout', async () => {
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        enableHeartbeat: true,
        heartbeatTimeout: 500
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      // Advance time past heartbeat timeout without pong response
      act(() => {
        vi.advanceTimersByTime(1500)
      })

      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      expect(instance.close).toHaveBeenCalledWith(1000, 'Heartbeat timeout')
    })
  })

  describe('Message sending and queuing', () => {
    it('should send messages when connected', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      const testMessage = { type: 'test', data: 'test data' }

      act(() => {
        const sent = result.current.send(testMessage)
        expect(sent).toBe(true)
      })

      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      expect(instance.send).toHaveBeenCalledWith(
        JSON.stringify({
          ...testMessage,
          id: expect.any(String),
          timestamp: expect.any(String)
        })
      )
    })

    it('should queue messages when disconnected and queue is enabled', async () => {
      const { result } = renderHook(() => useWebSocket({
        autoConnect: false,
        enableMessageQueue: true,
        messageQueueSize: 5
      }))

      const testMessage = { type: 'test', data: 'test data' }

      act(() => {
        const sent = result.current.send(testMessage)
        expect(sent).toBe(false)
      })

      expect(result.current.queuedMessages).toBe(1)
    })

    it('should process queued messages on reconnection', async () => {
      const { result } = renderHook(() => useWebSocket({
        autoConnect: false,
        enableMessageQueue: true
      }))

      // Queue a message while disconnected
      const testMessage = { type: 'test', data: 'test data' }
      act(() => {
        result.current.send(testMessage)
      })

      // Connect and process queue
      act(() => {
        result.current.connect()
      })

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      expect(result.current.queuedMessages).toBe(0)
    })
  })

  describe('Subscription management', () => {
    it('should subscribe to symbols on connection', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL']
      const { result } = renderHook(() => useWebSocket({
        symbols,
        autoConnect: true
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      expect(instance.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscribe',
          symbols,
          timestamp: expect.any(String)
        })
      )
    })

    it('should track active subscriptions', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      act(() => {
        result.current.subscribe(['AAPL', 'MSFT'])
      })

      expect(result.current.subscriptions).toContain('AAPL')
      expect(result.current.subscriptions).toContain('MSFT')
    })

    it('should unsubscribe from symbols', async () => {
      const { result } = renderHook(() => useWebSocket({
        symbols: ['AAPL', 'MSFT'],
        autoConnect: true
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      act(() => {
        result.current.unsubscribe(['AAPL'])
      })

      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      expect(instance.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'unsubscribe',
          symbols: ['AAPL'],
          id: expect.any(String),
          timestamp: expect.any(String)
        })
      )
    })
  })

  describe('Reconnection logic', () => {
    it('should attempt to reconnect on unexpected disconnection', async () => {
      const onReconnect = vi.fn()
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        reconnectAttempts: 3,
        reconnectInterval: 1000,
        onReconnect
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      // Simulate unexpected disconnection
      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateClose(1006, 'Connection lost')

      expect(result.current.connectionState).toBe(ConnectionState.RECONNECTING)

      // Fast-forward to trigger reconnection
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onReconnect).toHaveBeenCalledWith(1)
    })

    it('should use exponential backoff for reconnection delays', async () => {
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        reconnectAttempts: 3,
        reconnectInterval: 1000,
        reconnectMultiplier: 2,
        maxReconnectInterval: 5000
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      // Track setTimeout calls to verify exponential backoff
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

      // Simulate multiple disconnections
      const mockWs = global.WebSocket as any
      const instance = new mockWs()

      instance.simulateClose(1006, 'Connection lost')
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000)

      instance.simulateClose(1006, 'Connection lost')
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000)

      instance.simulateClose(1006, 'Connection lost')
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 4000)
    })

    it('should stop reconnecting after max attempts', async () => {
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        reconnectAttempts: 2,
        reconnectInterval: 100
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      // Simulate multiple failed reconnections
      const mockWs = global.WebSocket as any
      const instance = new mockWs()

      // First failure
      instance.simulateClose(1006, 'Connection lost')
      act(() => { vi.advanceTimersByTime(100) })

      // Second failure
      instance.simulateClose(1006, 'Connection lost')
      act(() => { vi.advanceTimersByTime(200) })

      // Third failure - should stop reconnecting
      instance.simulateClose(1006, 'Connection lost')

      expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED)
    })
  })

  describe('Error handling', () => {
    it('should handle WebSocket errors', async () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useWebSocket({
        autoConnect: true,
        onError
      }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateError()

      expect(result.current.connectionState).toBe(ConnectionState.ERROR)
      expect(onError).toHaveBeenCalled()
    })

    it('should handle malformed messages gracefully', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      // Simulate malformed message
      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      const event = new MessageEvent('message', { data: 'invalid json' })
      instance.onmessage?.(event)

      expect(mockMarketStore.addNotification).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'error',
        title: 'Message Parse Error',
        message: 'Failed to parse incoming message',
        timestamp: expect.any(String)
      })
    })

    it('should handle server error messages', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      const errorMessage = {
        type: 'error',
        data: { message: 'Server error occurred' }
      }

      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateMessage(errorMessage)

      expect(mockMarketStore.addNotification).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'error',
        title: 'WebSocket Error',
        message: 'Server error occurred',
        timestamp: expect.any(String)
      })
    })
  })

  describe('Connection metrics', () => {
    it('should track connection metrics', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      expect(result.current.connectionMetrics).toMatchObject({
        reconnectCount: 0,
        messagesReceived: 0,
        messagesSent: 0,
        averageLatency: 0,
        uptime: expect.any(Number)
      })
    })

    it('should update message counters', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      // Send a message
      act(() => {
        result.current.send({ type: 'test' })
      })

      // Receive a message
      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateMessage({ type: 'test' })

      expect(result.current.connectionMetrics.messagesSent).toBe(1)
      expect(result.current.connectionMetrics.messagesReceived).toBe(1)
    })
  })

  describe('Page visibility handling', () => {
    it('should reconnect when page becomes visible', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: true }))

      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      // Simulate disconnection
      const mockWs = global.WebSocket as any
      const instance = new mockWs()
      instance.simulateClose(1000, 'Manual close')

      // Simulate page becoming visible
      const visibilityHandler = (document.addEventListener as Mock).mock.calls.find(
        call => call[0] === 'visibilitychange'
      )?.[1]

      if (visibilityHandler) {
        global.document.hidden = false
        visibilityHandler()
      }

      // Should attempt to reconnect
      expect(result.current.connectionState).toBe(ConnectionState.CONNECTING)
    })
  })
})