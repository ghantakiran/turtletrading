/**
 * Unit tests for useOfflineSync hook
 * TDD approach - write tests first, then implement
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useOfflineSync } from '@/lib/hooks/useOfflineSync'
import { OfflineQueue } from '@/lib/sync/offline-queue'

// Mock OfflineQueue
jest.mock('@/lib/sync/offline-queue')

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  configurable: true,
  value: true,
})

describe('useOfflineSync', () => {
  let mockQueue: jest.Mocked<OfflineQueue>

  beforeEach(() => {
    // Reset navigator.onLine
    ;(navigator.onLine as any) = true

    // Create mock queue instance
    mockQueue = {
      init: jest.fn().mockResolvedValue(undefined),
      enqueue: jest.fn().mockResolvedValue(undefined),
      processQueue: jest.fn().mockResolvedValue(undefined),
      getAll: jest.fn().mockResolvedValue([]),
      size: jest.fn().mockResolvedValue(0),
      clear: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
    } as any

    ;(OfflineQueue as jest.Mock).mockImplementation(() => mockQueue)

    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    test('should initialize offline queue on mount', () => {
      renderHook(() => useOfflineSync())

      expect(OfflineQueue).toHaveBeenCalledTimes(1)
      expect(mockQueue.init).toHaveBeenCalledTimes(1)
    })

    test('should return queue instance', () => {
      const { result } = renderHook(() => useOfflineSync())

      expect(result.current.queue).toBeDefined()
    })

    test('should return isOnline status', () => {
      const { result } = renderHook(() => useOfflineSync())

      expect(result.current.isOnline).toBe(true)
    })

    test('should return queueSize', () => {
      const { result } = renderHook(() => useOfflineSync())

      expect(result.current.queueSize).toBe(0)
    })
  })

  describe('Online/Offline Detection', () => {
    test('should detect when going offline', async () => {
      const { result } = renderHook(() => useOfflineSync())

      expect(result.current.isOnline).toBe(true)

      // Simulate going offline
      act(() => {
        ;(navigator.onLine as any) = false
        window.dispatchEvent(new Event('offline'))
      })

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false)
      })
    })

    test('should detect when coming back online', async () => {
      ;(navigator.onLine as any) = false

      const { result } = renderHook(() => useOfflineSync())

      expect(result.current.isOnline).toBe(false)

      // Simulate coming online
      act(() => {
        ;(navigator.onLine as any) = true
        window.dispatchEvent(new Event('online'))
      })

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true)
      })
    })
  })

  describe('Queue Processing', () => {
    test('should process queue when coming back online', async () => {
      ;(navigator.onLine as any) = false

      renderHook(() => useOfflineSync())

      // Simulate coming online
      act(() => {
        ;(navigator.onLine as any) = true
        window.dispatchEvent(new Event('online'))
      })

      await waitFor(() => {
        expect(mockQueue.processQueue).toHaveBeenCalled()
      })
    })

    test('should not process queue when going offline', async () => {
      renderHook(() => useOfflineSync())

      // Simulate going offline
      act(() => {
        ;(navigator.onLine as any) = false
        window.dispatchEvent(new Event('offline'))
      })

      await waitFor(() => {
        expect(mockQueue.processQueue).not.toHaveBeenCalled()
      })
    })
  })

  describe('Queue Size Tracking', () => {
    test('should update queue size when queue changes', async () => {
      const { result } = renderHook(() => useOfflineSync())

      // Simulate queue change event
      act(() => {
        const changeHandler = mockQueue.on.mock.calls.find(
          (call) => call[0] === 'change'
        )?.[1]
        changeHandler?.(5)
      })

      await waitFor(() => {
        expect(result.current.queueSize).toBe(5)
      })
    })

    test('should register change listener on mount', () => {
      renderHook(() => useOfflineSync())

      expect(mockQueue.on).toHaveBeenCalledWith('change', expect.any(Function))
    })

    test('should unregister change listener on unmount', () => {
      const { unmount } = renderHook(() => useOfflineSync())

      unmount()

      expect(mockQueue.off).toHaveBeenCalledWith('change', expect.any(Function))
    })
  })

  describe('Event Cleanup', () => {
    test('should add online event listener on mount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

      renderHook(() => useOfflineSync())

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))

      addEventListenerSpy.mockRestore()
    })

    test('should add offline event listener on mount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

      renderHook(() => useOfflineSync())

      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

      addEventListenerSpy.mockRestore()
    })

    test('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useOfflineSync())

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Helper Methods', () => {
    test('should provide enqueue method', async () => {
      const { result } = renderHook(() => useOfflineSync())

      await act(async () => {
        await result.current.enqueue({
          type: 'ADD_TO_WATCHLIST',
          payload: { symbol: 'AAPL' },
        })
      })

      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        type: 'ADD_TO_WATCHLIST',
        payload: { symbol: 'AAPL' },
      })
    })

    test('should provide processQueue method', async () => {
      const { result } = renderHook(() => useOfflineSync())

      await act(async () => {
        await result.current.processQueue()
      })

      expect(mockQueue.processQueue).toHaveBeenCalled()
    })

    test('should provide getQueueSize method', async () => {
      mockQueue.size.mockResolvedValue(3)

      const { result } = renderHook(() => useOfflineSync())

      const size = await result.current.getQueueSize()

      expect(size).toBe(3)
      expect(mockQueue.size).toHaveBeenCalled()
    })
  })
})
