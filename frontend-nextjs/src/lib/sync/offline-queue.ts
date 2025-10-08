/**
 * Offline Sync Queue for TurtleTrading
 * Queues user actions when offline and syncs when connection is restored
 */

export type QueueAction = {
  id: string
  type: 'ADD_TO_WATCHLIST' | 'REMOVE_FROM_WATCHLIST' | 'SET_ALERT' | 'UPDATE_PORTFOLIO'
  payload: Record<string, any>
  timestamp: number
  retries: number
}

type QueueEventType = 'change' | 'processing' | 'processed'
type QueueEventListener = (data: any) => void

export class OfflineQueue {
  private queue: QueueAction[] = []
  private readonly storageKey = 'offline-queue'
  private readonly maxRetries = 3
  private listeners: Map<QueueEventType, Set<QueueEventListener>> = new Map()
  private isProcessing = false

  constructor() {
    this.listeners.set('change', new Set())
    this.listeners.set('processing', new Set())
    this.listeners.set('processed', new Set())
  }

  /**
   * Initialize queue from localStorage
   */
  async init(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
      this.queue = []
    }
  }

  /**
   * Add action to queue
   */
  async enqueue(action: Omit<QueueAction, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const queueAction: QueueAction = {
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0,
      ...action,
    }

    this.queue.push(queueAction)
    await this.persist()
    this.emit('change', this.queue.length)
  }

  /**
   * Process all queued actions
   */
  async processQueue(): Promise<void> {
    if (!navigator.onLine || this.isProcessing) {
      return
    }

    this.isProcessing = true
    this.emit('processing', true)

    const actionsToProcess = [...this.queue]

    for (const action of actionsToProcess) {
      try {
        await this.processAction(action)
        // Remove successful action from queue
        this.queue = this.queue.filter(a => a.id !== action.id)
      } catch (error) {
        console.error('Failed to process action:', error)

        // Increment retry count
        const actionIndex = this.queue.findIndex(a => a.id === action.id)
        if (actionIndex !== -1) {
          this.queue[actionIndex].retries++

          // Remove if max retries reached
          if (this.queue[actionIndex].retries >= this.maxRetries) {
            this.queue.splice(actionIndex, 1)
          }
        }
      }
    }

    await this.persist()
    this.isProcessing = false
    this.emit('processed', true)
  }

  /**
   * Process a single action
   */
  private async processAction(action: QueueAction): Promise<void> {
    let endpoint = ''
    let method = 'POST'
    let body: any = null

    switch (action.type) {
      case 'ADD_TO_WATCHLIST':
        endpoint = '/api/watchlist'
        method = 'POST'
        body = JSON.stringify(action.payload)
        break

      case 'REMOVE_FROM_WATCHLIST':
        endpoint = `/api/watchlist/${action.payload.symbol}`
        method = 'DELETE'
        break

      case 'SET_ALERT':
        endpoint = '/api/alerts'
        method = 'POST'
        body = JSON.stringify(action.payload)
        break

      case 'UPDATE_PORTFOLIO':
        endpoint = '/api/portfolio'
        method = 'PUT'
        body = JSON.stringify(action.payload)
        break

      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    }

    if (body) {
      options.body = body
    }

    const response = await fetch(endpoint, options)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  }

  /**
   * Get all queued actions
   */
  async getAll(): Promise<QueueAction[]> {
    return [...this.queue]
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    return this.queue.length
  }

  /**
   * Clear all actions
   */
  async clear(): Promise<void> {
    this.queue = []
    await this.persist()
    this.emit('change', 0)
  }

  /**
   * Register event listener
   */
  on(event: QueueEventType, listener: QueueEventListener): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.add(listener)
    }
  }

  /**
   * Remove event listener
   */
  off(event: QueueEventType, listener: QueueEventListener): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: QueueEventType, data: any): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(data))
    }
  }

  /**
   * Persist queue to localStorage
   */
  private async persist(): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue))
    } catch (error) {
      console.error('Failed to persist offline queue:', error)
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
