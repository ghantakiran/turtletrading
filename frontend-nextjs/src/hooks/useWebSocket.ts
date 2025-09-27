'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useMarketStore } from '@/stores'

// Enhanced WebSocket message types
interface WebSocketMessage {
  type: 'price_update' | 'sentiment_update' | 'technical_update' | 'connection_status' | 'ping' | 'pong' | 'subscribe' | 'unsubscribe' | 'subscription_confirmed' | 'error'
  symbol?: string
  data?: any
  timestamp?: string
  id?: string
  topics?: string[]
}

// Connection states for better UX
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
}

// Enhanced configuration options
interface UseWebSocketOptions {
  symbols?: string[]
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: Event) => void
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onReconnect?: (attempt: number) => void
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
  reconnectMultiplier?: number
  maxReconnectInterval?: number
  heartbeatInterval?: number
  heartbeatTimeout?: number
  messageQueueSize?: number
  enableHeartbeat?: boolean
  enableMessageQueue?: boolean
}

// Connection metrics for monitoring
interface ConnectionMetrics {
  connectTime?: number
  disconnectTime?: number
  reconnectCount: number
  messagesReceived: number
  messagesSent: number
  lastHeartbeat?: number
  averageLatency: number
  uptime: number
}

export function useWebSocket({
  symbols = [],
  onMessage,
  onError,
  onOpen,
  onClose,
  onReconnect,
  autoConnect = true,
  reconnectAttempts = 10,
  reconnectInterval = 1000,
  reconnectMultiplier = 1.5,
  maxReconnectInterval = 30000,
  heartbeatInterval = 30000,
  heartbeatTimeout = 10000,
  messageQueueSize = 100,
  enableHeartbeat = true,
  enableMessageQueue = true,
}: UseWebSocketOptions = {}) {
  // Enhanced state management
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [messageHistory, setMessageHistory] = useState<WebSocketMessage[]>([])
  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics>({
    reconnectCount: 0,
    messagesReceived: 0,
    messagesSent: 0,
    averageLatency: 0,
    uptime: 0,
  })

  // Refs for managing WebSocket and timers
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Interval | null>(null)
  const reconnectCountRef = useRef(0)
  const isConnectingRef = useRef(false)
  const messageQueueRef = useRef<WebSocketMessage[]>([])
  const subscriptionsRef = useRef<Set<string>>(new Set())
  const connectTimeRef = useRef<number>(0)
  const latencyMeasurements = useRef<number[]>([])

  // Zustand store actions
  const {
    updateStockPrice,
    updateConnectionStatus,
    setConnectionStatus,
    addNotification,
    isConnected: storeIsConnected
  } = useMarketStore()

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/api/v1/websocket'

  const connect = useCallback(() => {
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    isConnectingRef.current = true
    setConnectionState(ConnectionState.CONNECTING)
    connectTimeRef.current = Date.now()

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = (event) => {
        console.log('WebSocket connected')
        isConnectingRef.current = false
        reconnectCountRef.current = 0
        setConnectionState(ConnectionState.CONNECTED)
        setConnectionStatus('connected')

        // Update connection metrics
        const connectTime = Date.now()
        setConnectionMetrics(prev => ({
          ...prev,
          connectTime,
          reconnectCount: reconnectCountRef.current,
          uptime: connectTime - connectTimeRef.current
        }))

        // Start heartbeat if enabled
        if (enableHeartbeat) {
          startHeartbeat()
        }

        // Process queued messages if any
        if (enableMessageQueue && messageQueueRef.current.length > 0) {
          console.log(`Processing ${messageQueueRef.current.length} queued messages`)
          messageQueueRef.current.forEach(queuedMessage => {
            ws.send(JSON.stringify(queuedMessage))
          })
          messageQueueRef.current = []
        }

        // Subscribe to symbols
        if (symbols.length > 0) {
          symbols.forEach(symbol => subscriptionsRef.current.add(symbol))
          ws.send(JSON.stringify({
            type: 'subscribe',
            symbols: symbols,
            timestamp: new Date().toISOString()
          }))
        }

        onOpen?.(event)
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          const messageTime = Date.now()

          // Update message metrics
          setConnectionMetrics(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            lastHeartbeat: message.type === 'pong' ? messageTime : prev.lastHeartbeat
          }))

          // Handle heartbeat responses
          if (message.type === 'pong') {
            const latency = messageTime - (connectTimeRef.current || messageTime)
            latencyMeasurements.current.push(latency)

            // Keep only last 10 measurements for rolling average
            if (latencyMeasurements.current.length > 10) {
              latencyMeasurements.current.shift()
            }

            const averageLatency = latencyMeasurements.current.reduce((a, b) => a + b, 0) / latencyMeasurements.current.length
            setConnectionMetrics(prev => ({ ...prev, averageLatency }))
            return
          }

          // Update message history
          setLastMessage(message)
          if (enableMessageQueue) {
            setMessageHistory(prev => {
              const updated = [...prev, message]
              return updated.slice(-messageQueueSize) // Keep only recent messages
            })
          }

          // Handle different message types
          switch (message.type) {
            case 'price_update':
              if (message.symbol && message.data) {
                updateStockPrice(message.symbol, {
                  price: message.data.price,
                  change: message.data.change,
                  changePercent: message.data.changePercent,
                  volume: message.data.volume,
                  marketCap: message.data.marketCap || 0,
                  symbol: message.symbol,
                  timestamp: message.timestamp || new Date().toISOString(),
                  high52Week: message.data.high52Week || 0,
                  low52Week: message.data.low52Week || 0,
                  avgVolume: message.data.avgVolume || 0
                })
              }
              break

            case 'sentiment_update':
              console.log('Sentiment update:', message)
              break

            case 'technical_update':
              console.log('Technical update:', message)
              break

            case 'connection_status':
              updateConnectionStatus(message.data?.status || 'connected')
              break

            case 'subscription_confirmed':
              if (message.topics) {
                message.topics.forEach(topic => subscriptionsRef.current.add(topic))
                console.log('Subscription confirmed for:', message.topics)
              }
              break

            case 'error':
              console.error('WebSocket server error:', message.data)
              addNotification({
                id: Date.now().toString(),
                type: 'error',
                title: 'WebSocket Error',
                message: message.data?.message || 'Unknown server error',
                timestamp: new Date().toISOString()
              })
              break
          }

          // Call custom message handler
          onMessage?.(message)

        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
          addNotification({
            id: Date.now().toString(),
            type: 'error',
            title: 'Message Parse Error',
            message: 'Failed to parse incoming message',
            timestamp: new Date().toISOString()
          })
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
        isConnectingRef.current = false
        setConnectionState(ConnectionState.ERROR)
        setConnectionStatus('error')
        onError?.(event)
      }

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        isConnectingRef.current = false
        wsRef.current = null

        // Stop heartbeat
        stopHeartbeat()

        // Update disconnect metrics
        setConnectionMetrics(prev => ({
          ...prev,
          disconnectTime: Date.now()
        }))

        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          setConnectionState(ConnectionState.RECONNECTING)
          setConnectionStatus('reconnecting')
          reconnectCountRef.current++

          const delay = Math.min(
            reconnectInterval * Math.pow(reconnectMultiplier, reconnectCountRef.current - 1),
            maxReconnectInterval
          )

          onReconnect?.(reconnectCountRef.current)

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})...`)
            connect()
          }, delay)
        } else {
          setConnectionState(ConnectionState.DISCONNECTED)
          setConnectionStatus('disconnected')
        }

        onClose?.(event)
      }

    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      isConnectingRef.current = false
      setConnectionState(ConnectionState.ERROR)
      setConnectionStatus('error')
    }
  }, [wsUrl, symbols, onMessage, onError, onOpen, onClose, onReconnect, reconnectAttempts, reconnectInterval, reconnectMultiplier, maxReconnectInterval, enableHeartbeat, enableMessageQueue, messageQueueSize, setConnectionStatus, updateStockPrice, updateConnectionStatus, addNotification])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    isConnectingRef.current = false
    setConnectionStatus('disconnected')
  }, [setConnectionStatus])

  // Heartbeat management
  const startHeartbeat = useCallback(() => {
    if (!enableHeartbeat) return

    // Clear any existing heartbeat
    stopHeartbeat()

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }))

        // Set timeout for pong response
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('Heartbeat timeout - connection may be stale')
          // Consider reconnecting if heartbeat fails
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.close(1000, 'Heartbeat timeout')
          }
        }, heartbeatTimeout)
      }
    }, heartbeatInterval)
  }, [enableHeartbeat, heartbeatInterval, heartbeatTimeout])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  const send = useCallback((message: any) => {
    const messageWithId = {
      ...message,
      id: message.id || Date.now().toString(),
      timestamp: message.timestamp || new Date().toISOString()
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(messageWithId))
      setConnectionMetrics(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }))
      return true
    } else if (enableMessageQueue && messageQueueRef.current.length < messageQueueSize) {
      // Queue message for later sending
      messageQueueRef.current.push(messageWithId)
      console.log('Message queued - WebSocket not connected')
      return false
    } else {
      console.warn('Cannot send message - WebSocket not connected and queue full/disabled')
      return false
    }
  }, [enableMessageQueue, messageQueueSize])

  const subscribe = useCallback((newSymbols: string[]) => {
    return send({
      type: 'subscribe',
      symbols: newSymbols
    })
  }, [send])

  const unsubscribe = useCallback((symbolsToRemove: string[]) => {
    return send({
      type: 'unsubscribe',
      symbols: symbolsToRemove
    })
  }, [send])

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  // Derived state
  const isConnected = connectionState === ConnectionState.CONNECTED

  // Clear message queue management
  const clearMessageQueue = useCallback(() => {
    messageQueueRef.current = []
  }, [])

  // Get current subscriptions
  const getSubscriptions = useCallback(() => {
    return Array.from(subscriptionsRef.current)
  }, [])

  // Handle symbols change
  useEffect(() => {
    if (symbols.length > 0 && isConnected) {
      subscribe(symbols)
    }
  }, [symbols, isConnected, subscribe])

  // Handle page visibility change to reconnect on focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && wsRef.current?.readyState !== WebSocket.OPEN) {
        connect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [connect])

  return {
    // Connection methods
    connect,
    disconnect,

    // Message methods
    send,
    subscribe,
    unsubscribe,
    clearMessageQueue,

    // State
    isConnected,
    connectionState,
    connectionStatus: useMarketStore.getState().connectionStatus,
    connectionMetrics,
    lastMessage,
    messageHistory,

    // Subscription management
    getSubscriptions,
    subscriptions: getSubscriptions(),

    // Advanced features
    queuedMessages: messageQueueRef.current.length
  }
}

// Hook for stock-specific WebSocket subscription
export function useStockWebSocket(symbol: string, options: Omit<UseWebSocketOptions, 'symbols'> = {}) {
  return useWebSocket({
    ...options,
    symbols: [symbol.toUpperCase()]
  })
}