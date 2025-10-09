/**
 * Background Sync Manager
 * Manages background synchronization using the Background Sync API with fallback
 */

export interface SyncOptions {
  minInterval?: number // Minimum time between syncs (ms)
  maxRetries?: number // Maximum retry attempts
}

export type SyncCallback = () => Promise<void>

export class BackgroundSyncManager {
  private syncHandlers: Map<string, Set<SyncCallback>>
  private registeredTags: Set<string>
  private fallbackIntervals: Map<string, NodeJS.Timeout>

  constructor() {
    this.syncHandlers = new Map()
    this.registeredTags = new Set()
    this.fallbackIntervals = new Map()
  }

  /**
   * Check if Background Sync API is supported
   */
  async isSupported(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      return (
        'serviceWorker' in navigator &&
        typeof ServiceWorkerRegistration !== 'undefined' &&
        'sync' in ServiceWorkerRegistration.prototype
      )
    } catch {
      return false
    }
  }

  /**
   * Register a background sync tag
   */
  async register(tag: string, options?: SyncOptions): Promise<void> {
    const supported = await this.isSupported()

    if (supported) {
      try {
        const registration = await navigator.serviceWorker.ready
        await registration.sync.register(tag)
        this.registeredTags.add(tag)
      } catch (error) {
        console.error(`Failed to register background sync: ${tag}`, error)
        throw error
      }
    } else {
      // Fallback: Use periodic polling
      this.setupFallbackSync(tag, options)
      this.registeredTags.add(tag)
    }
  }

  /**
   * Unregister a background sync tag
   */
  async unregister(tag: string): Promise<void> {
    this.registeredTags.delete(tag)
    this.syncHandlers.delete(tag)

    // Clear fallback interval if exists
    const interval = this.fallbackIntervals.get(tag)
    if (interval) {
      clearInterval(interval)
      this.fallbackIntervals.delete(tag)
    }
  }

  /**
   * Get all registered sync tags
   */
  async getTags(): Promise<string[]> {
    const supported = await this.isSupported()

    if (supported) {
      try {
        const registration = await navigator.serviceWorker.ready
        return await registration.sync.getTags()
      } catch (error) {
        console.error('Failed to get sync tags', error)
        return Array.from(this.registeredTags)
      }
    }

    return Array.from(this.registeredTags)
  }

  /**
   * Check if a tag is registered
   */
  async hasTag(tag: string): Promise<boolean> {
    const tags = await this.getTags()
    return tags.includes(tag) || this.registeredTags.has(tag)
  }

  /**
   * Manually trigger a sync
   */
  async sync(tag: string): Promise<void> {
    const hasTag = await this.hasTag(tag)
    if (!hasTag) {
      throw new Error(`Sync tag "${tag}" not registered`)
    }

    const handlers = this.syncHandlers.get(tag)
    if (!handlers || handlers.size === 0) {
      throw new Error(`No sync handlers registered for tag "${tag}"`)
    }

    // Execute all handlers for this tag
    const promises = Array.from(handlers).map((handler) => handler())
    await Promise.all(promises)
  }

  /**
   * Register a sync event handler
   */
  onSync(tag: string, callback: SyncCallback): void {
    if (!this.syncHandlers.has(tag)) {
      this.syncHandlers.set(tag, new Set())
    }

    this.syncHandlers.get(tag)!.add(callback)
  }

  /**
   * Remove a sync event handler
   */
  offSync(tag: string, callback: SyncCallback): void {
    const handlers = this.syncHandlers.get(tag)
    if (handlers) {
      handlers.delete(callback)
    }
  }

  /**
   * Setup fallback periodic sync for unsupported browsers
   */
  private setupFallbackSync(tag: string, options?: SyncOptions): void {
    const minInterval = options?.minInterval || 60000 // Default 1 minute

    // Clear existing interval if any
    const existingInterval = this.fallbackIntervals.get(tag)
    if (existingInterval) {
      clearInterval(existingInterval)
    }

    // Don't set up interval in test environment
    if (process.env.NODE_ENV === 'test') {
      return
    }

    // Setup periodic sync
    const interval = setInterval(async () => {
      if (navigator.onLine) {
        try {
          await this.sync(tag)
        } catch (error) {
          console.error(`Fallback sync failed for tag "${tag}"`, error)
        }
      }
    }, minInterval)

    this.fallbackIntervals.set(tag, interval)
  }

  /**
   * Clean up all sync handlers and intervals
   */
  destroy(): void {
    // Clear all fallback intervals
    this.fallbackIntervals.forEach((interval) => clearInterval(interval))
    this.fallbackIntervals.clear()

    // Clear all handlers
    this.syncHandlers.clear()
    this.registeredTags.clear()
  }
}

// Singleton instance
export const backgroundSyncManager = new BackgroundSyncManager()
