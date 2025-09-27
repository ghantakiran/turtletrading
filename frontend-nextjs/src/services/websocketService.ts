import useMarketStore, { StockPrice, MarketIndex, TechnicalIndicators, AIAnalysis, MarketSentiment } from '@/stores/marketStore'
import { useUIStore } from '@/stores/uiStore'

interface WebSocketMessage {
  type: 'stock_price' | 'market_index' | 'technical_indicators' | 'ai_analysis' | 'market_sentiment' | 'heartbeat' | 'error'
  data: any
  symbol?: string
  timestamp: string
}

interface WebSocketConfig {
  url: string
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatInterval: number
}

class WebSocketService {
  private ws: WebSocket | null = null
  private config: WebSocketConfig
  private subscriptions: Set<string> = new Set()
  private reconnectAttempts: number = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isManuallyDisconnected: boolean = false

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: config.url || `ws://localhost:8000/ws/market`,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      heartbeatInterval: config.heartbeatInterval || 30000,
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      try {
        // Update connection status
        useMarketStore.getState().setConnectionStatus('connecting')

        this.ws = new WebSocket(this.config.url)
        this.isManuallyDisconnected = false

        this.ws.onopen = () => {
          console.log('📡 WebSocket connected')
          useMarketStore.getState().setConnectionStatus('connected')
          this.reconnectAttempts = 0
          this.startHeartbeat()

          // Re-subscribe to all previously subscribed symbols
          this.subscriptions.forEach(symbol => {
            this.subscribeToSymbol(symbol)
          })

          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason)
          useMarketStore.getState().setConnectionStatus('disconnected')
          this.stopHeartbeat()

          if (!this.isManuallyDisconnected && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect()
          } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            useMarketStore.getState().setConnectionStatus('error')
            useUIStore.getState().showNotification({
              type: 'error',
              title: 'Connection Lost',
              message: 'Unable to reconnect to live data feed. Please refresh the page.',
            })
          }
        }

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          useMarketStore.getState().setConnectionStatus('error')
          reject(error)
        }

      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error)
        useMarketStore.getState().setConnectionStatus('error')
        reject(error)
      }
    })
  }

  disconnect(): void {
    this.isManuallyDisconnected = true
    this.stopHeartbeat()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }

    useMarketStore.getState().setConnectionStatus('disconnected')
  }

  subscribeToSymbol(symbol: string): void {
    this.subscriptions.add(symbol)

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        action: 'subscribe',
        symbol: symbol.toUpperCase(),
        timestamp: new Date().toISOString()
      })
      console.log(`📈 Subscribed to ${symbol}`)
    }
  }

  unsubscribeFromSymbol(symbol: string): void {
    this.subscriptions.delete(symbol)

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        action: 'unsubscribe',
        symbol: symbol.toUpperCase(),
        timestamp: new Date().toISOString()
      })
      console.log(`📉 Unsubscribed from ${symbol}`)
    }
  }

  subscribeToWatchlist(symbols: string[]): void {
    symbols.forEach(symbol => this.subscribeToSymbol(symbol))
  }

  unsubscribeFromWatchlist(symbols: string[]): void {
    symbols.forEach(symbol => this.unsubscribeFromSymbol(symbol))
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message:', data)
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const marketStore = useMarketStore.getState()

    switch (message.type) {
      case 'stock_price':
        if (this.isValidStockPrice(message.data)) {
          marketStore.updateStockPrice(message.data as StockPrice)
        }
        break

      case 'market_index':
        if (this.isValidMarketIndex(message.data)) {
          marketStore.updateMarketIndex(message.data as MarketIndex)
        }
        break

      case 'technical_indicators':
        if (this.isValidTechnicalIndicators(message.data)) {
          marketStore.updateTechnicalIndicators(message.data as TechnicalIndicators)
        }
        break

      case 'ai_analysis':
        if (this.isValidAIAnalysis(message.data)) {
          marketStore.updateAIAnalysis(message.data as AIAnalysis)
        }
        break

      case 'market_sentiment':
        if (this.isValidMarketSentiment(message.data)) {
          marketStore.updateMarketSentiment(message.data as MarketSentiment)
        }
        break

      case 'heartbeat':
        // Acknowledge heartbeat
        this.send({ action: 'heartbeat_ack', timestamp: new Date().toISOString() })
        break

      case 'error':
        console.error('❌ WebSocket server error:', message.data)
        useUIStore.getState().showNotification({
          type: 'error',
          title: 'Data Stream Error',
          message: message.data.message || 'An error occurred with the data stream',
        })
        break

      default:
        console.warn('⚠️ Unknown message type:', message.type)
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++
    const delay = Math.min(this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000)

    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts}) in ${delay}ms`)

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error)
      })
    }, delay)
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ action: 'heartbeat', timestamp: new Date().toISOString() })
      }
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // Data validation methods
  private isValidStockPrice(data: any): boolean {
    return data &&
           typeof data.symbol === 'string' &&
           typeof data.price === 'number' &&
           typeof data.change === 'number' &&
           typeof data.changePercent === 'number' &&
           typeof data.timestamp === 'string'
  }

  private isValidMarketIndex(data: any): boolean {
    return data &&
           typeof data.symbol === 'string' &&
           typeof data.name === 'string' &&
           typeof data.value === 'number' &&
           typeof data.change === 'number' &&
           typeof data.timestamp === 'string'
  }

  private isValidTechnicalIndicators(data: any): boolean {
    return data &&
           typeof data.symbol === 'string' &&
           typeof data.rsi === 'number' &&
           typeof data.timestamp === 'string'
  }

  private isValidAIAnalysis(data: any): boolean {
    return data &&
           typeof data.symbol === 'string' &&
           typeof data.prediction === 'number' &&
           typeof data.confidence === 'number' &&
           ['1d', '7d', '30d'].includes(data.timeframe) &&
           ['bullish', 'bearish', 'neutral'].includes(data.direction) &&
           typeof data.timestamp === 'string'
  }

  private isValidMarketSentiment(data: any): boolean {
    return data &&
           ['bullish', 'bearish', 'neutral'].includes(data.overall) &&
           typeof data.score === 'number' &&
           typeof data.timestamp === 'string'
  }

  // Public getters for connection state
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected'

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      case WebSocket.CLOSING:
        return 'disconnecting'
      case WebSocket.CLOSED:
        return 'disconnected'
      default:
        return 'unknown'
    }
  }

  get subscriptionsCount(): number {
    return this.subscriptions.size
  }

  get subscribedSymbols(): string[] {
    return Array.from(this.subscriptions)
  }
}

// Create singleton instance
const websocketService = new WebSocketService()

// Mock data generator for development when WebSocket server is not available
class MockWebSocketService {
  private intervals: NodeJS.Timeout[] = []
  private isActive: boolean = false

  start(): void {
    if (this.isActive) return

    console.log('🔄 Starting mock WebSocket service for development')
    this.isActive = true

    // Update connection status
    useMarketStore.getState().setConnectionStatus('connected')

    // Start mock data generation
    this.generateMockData()
  }

  stop(): void {
    console.log('🛑 Stopping mock WebSocket service')
    this.isActive = false
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals = []
    useMarketStore.getState().setConnectionStatus('disconnected')
  }

  private generateMockData(): void {
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA']
    const marketStore = useMarketStore.getState()

    // Generate mock stock prices every 2 seconds
    const priceInterval = setInterval(() => {
      if (!this.isActive) return

      symbols.forEach(symbol => {
        const currentPrice = marketStore.stockPrices[symbol]?.price || Math.random() * 300 + 50
        const change = (Math.random() - 0.5) * 10
        const changePercent = (change / currentPrice) * 100

        const mockPrice: StockPrice = {
          symbol,
          price: Math.max(0.01, currentPrice + change),
          change,
          changePercent,
          volume: Math.floor(Math.random() * 1000000) + 100000,
          marketCap: Math.floor(Math.random() * 2000000000000) + 500000000000,
          timestamp: new Date().toISOString(),
          high52Week: currentPrice * (1 + Math.random() * 0.5),
          low52Week: currentPrice * (1 - Math.random() * 0.3),
          avgVolume: Math.floor(Math.random() * 50000000) + 10000000
        }

        marketStore.updateStockPrice(mockPrice)
      })
    }, 2000)

    this.intervals.push(priceInterval)

    // Generate mock market sentiment every 30 seconds
    const sentimentInterval = setInterval(() => {
      if (!this.isActive) return

      const sentiments: Array<'bullish' | 'bearish' | 'neutral'> = ['bullish', 'bearish', 'neutral']
      const mockSentiment: MarketSentiment = {
        overall: sentiments[Math.floor(Math.random() * sentiments.length)],
        score: Math.floor(Math.random() * 200) - 100,
        newsCount: Math.floor(Math.random() * 50) + 10,
        socialCount: Math.floor(Math.random() * 500) + 100,
        timestamp: new Date().toISOString()
      }

      marketStore.updateMarketSentiment(mockSentiment)
    }, 30000)

    this.intervals.push(sentimentInterval)
  }
}

const mockWebSocketService = new MockWebSocketService()

// Auto-start appropriate service based on environment
if (typeof window !== 'undefined') {
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_MOCK_WEBSOCKET === 'true') {
    // Use mock service for development
    mockWebSocketService.start()
  } else {
    // Try to connect to real WebSocket service
    websocketService.connect().catch(() => {
      console.warn('⚠️ Failed to connect to WebSocket server, falling back to mock service')
      mockWebSocketService.start()
    })
  }
}

export { websocketService, mockWebSocketService }
export default websocketService