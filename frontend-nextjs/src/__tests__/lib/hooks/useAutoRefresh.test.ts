/**
 * Unit tests for useAutoRefresh Hook
 * TDD approach - tests written first
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh'

// Mock timers
jest.useFakeTimers()

describe('useAutoRefresh Hook', () => {
  afterEach(() => {
    jest.clearAllTimers()
  })

  test('should initialize with loading state', () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  test('should fetch data on mount', async () => {
    const mockData = { data: 'test' }
    const fetchFn = jest.fn().mockResolvedValue(mockData)
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(mockData)
  })

  test('should set error on fetch failure', async () => {
    const error = new Error('Fetch failed')
    const fetchFn = jest.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toBeNull()
  })

  test('should auto-refresh after interval', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Fast-forward 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  test('should update lastUpdate timestamp', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.lastUpdate).toBeInstanceOf(Date)
  })

  test('should provide manual refresh function', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Manual refresh
    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  test('should pause auto-refresh', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPaused).toBe(false)

    // Pause
    act(() => {
      result.current.pause()
    })

    expect(result.current.isPaused).toBe(true)

    // Advance time - should not fetch
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    expect(fetchFn).toHaveBeenCalledTimes(1) // Still only initial fetch
  })

  test('should resume auto-refresh', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Pause
    act(() => {
      result.current.pause()
    })

    expect(result.current.isPaused).toBe(true)

    // Resume
    act(() => {
      result.current.resume()
    })

    expect(result.current.isPaused).toBe(false)

    // Advance time - should fetch again
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  test('should call onSuccess callback', async () => {
    const mockData = { data: 'test' }
    const fetchFn = jest.fn().mockResolvedValue(mockData)
    const onSuccess = jest.fn()

    renderHook(() => useAutoRefresh(fetchFn, 30000, { onSuccess }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockData)
    })
  })

  test('should call onError callback', async () => {
    const error = new Error('Fetch failed')
    const fetchFn = jest.fn().mockRejectedValue(error)
    const onError = jest.fn()

    renderHook(() => useAutoRefresh(fetchFn, 30000, { onError }))

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })

  test('should respect enabled option', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 30000, { enabled: false }))

    // Should not fetch when disabled
    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  test('should cleanup interval on unmount', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { unmount } = renderHook(() => useAutoRefresh(fetchFn, 30000))

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    unmount()

    // Advance time after unmount
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    // Should not fetch after unmount
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
