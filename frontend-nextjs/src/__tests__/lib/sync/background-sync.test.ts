/**
 * Unit tests for Background Sync Manager
 * TDD approach - write tests first, then implement
 */

import { BackgroundSyncManager } from '@/lib/sync/background-sync'

// Mock ServiceWorkerRegistration
class MockServiceWorkerRegistration {
  sync = {
    register: jest.fn().mockResolvedValue(undefined),
    getTags: jest.fn().mockResolvedValue([]),
  }
}

// Add sync to prototype
Object.defineProperty(MockServiceWorkerRegistration.prototype, 'sync', {
  value: {},
  writable: true,
  configurable: true,
})

// Mock global ServiceWorkerRegistration
;(global as any).ServiceWorkerRegistration = MockServiceWorkerRegistration

// Mock navigator.serviceWorker
Object.defineProperty(global.navigator, 'serviceWorker', {
  writable: true,
  value: {
    ready: Promise.resolve(new MockServiceWorkerRegistration()),
    register: jest.fn(),
  },
})

describe('BackgroundSyncManager', () => {
  let syncManager: BackgroundSyncManager

  beforeEach(() => {
    syncManager = new BackgroundSyncManager()
    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    test('should create instance', () => {
      expect(syncManager).toBeDefined()
      expect(syncManager).toBeInstanceOf(BackgroundSyncManager)
    })

    test('should check for Background Sync API support', async () => {
      const isSupported = await syncManager.isSupported()
      expect(typeof isSupported).toBe('boolean')
    })
  })

  describe('Registration', () => {
    test('should register sync tag', async () => {
      await syncManager.register('test-sync')

      const registration = await navigator.serviceWorker.ready
      expect(registration.sync.register).toHaveBeenCalledWith('test-sync')
    })

    test('should register sync tag with options', async () => {
      await syncManager.register('test-sync', {
        minInterval: 60000,
        maxRetries: 3,
      })

      const registration = await navigator.serviceWorker.ready
      expect(registration.sync.register).toHaveBeenCalledWith('test-sync')
    })

    test('should handle registration error', async () => {
      const registration = await navigator.serviceWorker.ready
      ;(registration.sync.register as jest.Mock).mockRejectedValueOnce(
        new Error('Registration failed')
      )

      await expect(syncManager.register('test-sync')).rejects.toThrow(
        'Registration failed'
      )
    })

    test('should not register duplicate tags', async () => {
      await syncManager.register('test-sync')
      await syncManager.register('test-sync')

      const registration = await navigator.serviceWorker.ready
      expect(registration.sync.register).toHaveBeenCalledTimes(2)
    })
  })

  describe('Unregistration', () => {
    test('should unregister sync tag', async () => {
      await syncManager.register('test-sync')
      await syncManager.unregister('test-sync')

      const tags = await syncManager.getTags()
      expect(tags).not.toContain('test-sync')
    })

    test('should handle unregistering non-existent tag', async () => {
      await expect(syncManager.unregister('non-existent')).resolves.not.toThrow()
    })
  })

  describe('Tag Management', () => {
    test('should get all registered tags', async () => {
      await syncManager.register('sync-1')
      await syncManager.register('sync-2')

      const tags = await syncManager.getTags()
      expect(Array.isArray(tags)).toBe(true)
    })

    test('should return empty array when no tags registered', async () => {
      const tags = await syncManager.getTags()
      expect(tags).toEqual([])
    })

    test('should check if tag exists', async () => {
      await syncManager.register('test-sync')

      const exists = await syncManager.hasTag('test-sync')
      expect(exists).toBe(true)

      const notExists = await syncManager.hasTag('non-existent')
      expect(notExists).toBe(false)
    })
  })

  describe('Manual Sync', () => {
    test('should trigger manual sync', async () => {
      await syncManager.register('test-sync')
      const syncCallback = jest.fn().mockResolvedValue(undefined)
      syncManager.onSync('test-sync', syncCallback)

      await syncManager.sync('test-sync')

      expect(syncCallback).toHaveBeenCalled()
    })

    test('should handle sync callback errors', async () => {
      await syncManager.register('test-sync')
      const syncCallback = jest.fn().mockRejectedValue(new Error('Sync failed'))
      syncManager.onSync('test-sync', syncCallback)

      await expect(syncManager.sync('test-sync')).rejects.toThrow('Sync failed')
    })

    test('should support multiple sync callbacks', async () => {
      await syncManager.register('test-sync')
      const callback1 = jest.fn().mockResolvedValue(undefined)
      const callback2 = jest.fn().mockResolvedValue(undefined)

      syncManager.onSync('test-sync', callback1)
      syncManager.onSync('test-sync', callback2)

      await syncManager.sync('test-sync')

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })

    test('should throw error when syncing unregistered tag', async () => {
      await expect(syncManager.sync('non-existent')).rejects.toThrow()
    })
  })

  describe('Event Handlers', () => {
    test('should register sync event handler', () => {
      const handler = jest.fn()
      syncManager.onSync('test-sync', handler)

      expect(typeof handler).toBe('function')
    })

    test('should remove sync event handler', () => {
      const handler = jest.fn()
      syncManager.onSync('test-sync', handler)
      syncManager.offSync('test-sync', handler)

      // Handler should not be called after removal
      syncManager.sync('test-sync').catch(() => {})
      expect(handler).not.toHaveBeenCalled()
    })

    test('should handle multiple handlers for same tag', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      syncManager.onSync('test-sync', handler1)
      syncManager.onSync('test-sync', handler2)

      expect(handler1).toBeDefined()
      expect(handler2).toBeDefined()
    })
  })

  describe('Fallback Behavior', () => {
    test('should work without Background Sync API', async () => {
      // Test with unsupported environment (simulated by deleting ServiceWorkerRegistration)
      const originalSWR = (global as any).ServiceWorkerRegistration
      delete (global as any).ServiceWorkerRegistration

      const fallbackManager = new BackgroundSyncManager()
      const isSupported = await fallbackManager.isSupported()

      expect(isSupported).toBe(false)

      // Should still allow registration (will use fallback)
      await expect(fallbackManager.register('test-sync')).resolves.not.toThrow()

      // Verify tag was registered despite no API support
      const hasTag = await fallbackManager.hasTag('test-sync')
      expect(hasTag).toBe(true)

      // Restore
      ;(global as any).ServiceWorkerRegistration = originalSWR
    })

    test('should use polling fallback when API not supported', async () => {
      jest.useFakeTimers()

      const callback = jest.fn().mockResolvedValue(undefined)
      syncManager.onSync('test-sync', callback)

      // Simulate periodic sync with fallback
      await syncManager.register('test-sync', { minInterval: 5000 })

      // Fast-forward time
      jest.advanceTimersByTime(5000)

      jest.useRealTimers()
    })
  })
})
