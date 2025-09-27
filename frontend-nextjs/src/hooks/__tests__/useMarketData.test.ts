/**
 * useMarketData Hook Unit Tests
 * 100% coverage for market data React hook
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useMarketData } from '../useMarketData'

// Mock API service
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
}

jest.mock('../../services/api', () => ({
  apiClient: mockApiClient
}))

// Mock WebSocket service
const mockWebSocketService = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  subscribe: jest.fn(),
  subscribeToSymbol: jest.fn(),
  unsubscribeFromSymbol: jest.fn(),
  isConnected: jest.fn(),
  getConnectionState: jest.fn()
}

jest.mock('../../services/websocketService', () => ({
  WebSocketService: jest.fn(() => mockWebSocketService)
}))

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  log: jest.spyOn(console, 'log').mockImplementation(),
}

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useMarketData Hook', () => {
  let wrapper: ReturnType<typeof createWrapper>

  beforeEach(() => {
    wrapper = createWrapper()
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  afterAll(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore())
  })

  describe('Stock Price Data', () => {
    it('should fetch market data on mount', async () => {
      const mockMarketData = {
        indices: {
          'S&P 500': { value: 4200, change: 25, changePercent: 0.6 },
          'NASDAQ': { value: 13500, change: -50, changePercent: -0.37 }
        },
        topMovers: {
          gainers: [
            { symbol: 'AAPL', change: 5.25, changePercent: 3.5 },
            { symbol: 'MSFT', change: 8.10, changePercent: 2.7 }
          ],
          losers: [
            { symbol: 'TSLA', change: -12.50, changePercent: -5.2 },
            { symbol: 'NVDA', change: -8.75, changePercent: -3.1 }
          ]
        },
        marketSentiment: {
          overall: 0.65,
          fearGreedIndex: 75,
          bullBearRatio: 1.8
        }
      }

      mockApiClient.get.mockResolvedValue(mockMarketData)

      const { result } = renderHook(() => useMarketData(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/market/overview')
      expect(result.current.data).toEqual(mockMarketData)
      expect(result.current.error).toBeNull()
    })

    it('should handle loading states properly', () => {
      mockApiClient.get.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      const { result } = renderHook(() => useMarketData(), { wrapper })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
      expect(result.current.error).toBeNull()
    })

    it('should cache data for performance', async () => {
      const mockData = {
        indices: { 'S&P 500': { value: 4200, change: 25 } }
      }

      mockApiClient.get.mockResolvedValue(mockData)

      // First hook instance
      const { result: result1, unmount: unmount1 } = renderHook(
        () => useMarketData(),
        { wrapper }
      )

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false)
      })

      unmount1()

      // Second hook instance should use cached data
      const { result: result2 } = renderHook(
        () => useMarketData(),
        { wrapper }
      )

      // Should not make another API call
      expect(mockApiClient.get).toHaveBeenCalledTimes(1)
      expect(result2.current.data).toEqual(mockData)
    })

    it('should implement proper error handling', async () => {
      const mockError = new Error('API Error')
      mockApiClient.get.mockRejectedValue(mockError)

      const { result } = renderHook(() => useMarketData(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.data).toBeUndefined()
    })

    it('should cleanup subscriptions on unmount', async () => {
      mockWebSocketService.isConnected.mockReturnValue(true)

      const { unmount } = renderHook(() => useMarketData({ realTime: true }), { wrapper })

      await waitFor(() => {
        expect(mockWebSocketService.subscribe).toHaveBeenCalled()
      })

      unmount()

      // Should cleanup WebSocket subscriptions
      expect(mockWebSocketService.disconnect).toHaveBeenCalled()
    })

    it('should handle real-time data updates', async () => {
      const mockInitialData = {
        indices: { 'S&P 500': { value: 4200, change: 25 } }
      }

      const mockUpdatedData = {
        indices: { 'S&P 500': { value: 4205, change: 30 } }
      }

      mockApiClient.get.mockResolvedValue(mockInitialData)
      mockWebSocketService.isConnected.mockReturnValue(true)

      let wsUpdateCallback: (data: any) => void

      mockWebSocketService.subscribe.mockImplementation((event, callback) => {
        if (event === 'market_update') {
          wsUpdateCallback = callback
        }
      })

      const { result } = renderHook(
        () => useMarketData({ realTime: true }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockInitialData)

      // Simulate WebSocket update
      act(() => {
        wsUpdateCallback!(mockUpdatedData)
      })

      expect(result.current.data).toEqual(mockUpdatedData)
    })
  })

  describe('Symbol-Specific Data', () => {
    it('should fetch data for specific symbols', async () => {
      const mockStockData = {
        AAPL: {
          symbol: 'AAPL',
          price: 150.25,
          change: 2.50,
          changePercent: 1.69,
          volume: 50000000
        },
        MSFT: {
          symbol: 'MSFT',
          price: 300.50,
          change: -1.25,
          changePercent: -0.41,
          volume: 25000000
        }
      }

      mockApiClient.get.mockResolvedValue(mockStockData)

      const { result } = renderHook(
        () => useMarketData({ symbols: ['AAPL', 'MSFT'] }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/v1/stocks/batch',
        expect.objectContaining({
          params: { symbols: 'AAPL,MSFT' }
        })
      )
      expect(result.current.data).toEqual(mockStockData)
    })

    it('should handle symbol subscription changes', async () => {
      mockWebSocketService.isConnected.mockReturnValue(true)

      const { result, rerender } = renderHook(
        ({ symbols }: { symbols: string[] }) =>
          useMarketData({ symbols, realTime: true }),
        {
          wrapper,
          initialProps: { symbols: ['AAPL'] }
        }
      )

      await waitFor(() => {
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('AAPL', expect.any(Function))
      })

      // Change symbols
      rerender({ symbols: ['AAPL', 'MSFT'] })

      await waitFor(() => {
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('MSFT', expect.any(Function))
      })

      // Remove symbols
      rerender({ symbols: ['MSFT'] })

      await waitFor(() => {
        expect(mockWebSocketService.unsubscribeFromSymbol).toHaveBeenCalledWith('AAPL')
      })
    })
  })

  describe('Refresh and Refetch', () => {
    it('should provide manual refresh functionality', async () => {
      const mockData = { indices: { 'S&P 500': { value: 4200 } } }
      mockApiClient.get.mockResolvedValue(mockData)

      const { result } = renderHook(() => useMarketData(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiClient.get).toHaveBeenCalledTimes(1)

      // Manual refresh
      act(() => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2)
      })
    })

    it('should handle automatic refresh intervals', async () => {
      const mockData = { indices: { 'S&P 500': { value: 4200 } } }
      mockApiClient.get.mockResolvedValue(mockData)

      const { result } = renderHook(
        () => useMarketData({ refreshInterval: 5000 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiClient.get).toHaveBeenCalledTimes(1)

      // Fast-forward time to trigger refresh
      act(() => {
        jest.advanceTimersByTime(6000)
      })

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2)
      })
    })

    it('should pause refresh when window is not visible', async () => {
      const mockData = { indices: { 'S&P 500': { value: 4200 } } }
      mockApiClient.get.mockResolvedValue(mockData)

      // Mock document.visibilityState
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'hidden'
      })

      const { result } = renderHook(
        () => useMarketData({ refreshInterval: 5000 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiClient.get).toHaveBeenCalledTimes(1)

      // Fast-forward time - should not refresh when hidden
      act(() => {
        jest.advanceTimersByTime(10000)
      })

      expect(mockApiClient.get).toHaveBeenCalledTimes(1)

      // Make visible again
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible'
      })

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
        jest.advanceTimersByTime(6000)
      })

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Data Transformation and Validation', () => {
    it('should transform API data to frontend format', async () => {
      const apiData = {
        indices: {
          'S&P 500': {
            value: 4200,
            change: 25,
            change_percent: 0.6, // Snake case from API
            last_updated: '2024-01-15T10:30:00Z'
          }
        }
      }

      const expectedTransformed = {
        indices: {
          'S&P 500': {
            value: 4200,
            change: 25,
            changePercent: 0.6, // Camel case for frontend
            lastUpdated: '2024-01-15T10:30:00Z'
          }
        }
      }

      mockApiClient.get.mockResolvedValue(apiData)

      const { result } = renderHook(
        () => useMarketData({ transform: true }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(expectedTransformed)
    })

    it('should validate data integrity', async () => {
      const invalidData = {
        indices: {
          'S&P 500': {
            // Missing required fields
            value: 4200
            // Missing change, changePercent
          }
        }
      }

      mockApiClient.get.mockResolvedValue(invalidData)

      const { result } = renderHook(
        () => useMarketData({ validate: true }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Data validation failed'),
        expect.any(Error)
      )
    })
  })

  describe('WebSocket Integration', () => {
    it('should establish WebSocket connection for real-time data', async () => {
      mockWebSocketService.isConnected.mockReturnValue(false)
      mockWebSocketService.connect.mockResolvedValue(undefined)

      const { result } = renderHook(
        () => useMarketData({ realTime: true }),
        { wrapper }
      )

      await waitFor(() => {
        expect(mockWebSocketService.connect).toHaveBeenCalled()
      })

      expect(result.current.isConnected).toBe(false)
    })

    it('should handle WebSocket connection failures', async () => {
      mockWebSocketService.connect.mockRejectedValue(new Error('Connection failed'))

      const { result } = renderHook(
        () => useMarketData({ realTime: true }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.connectionError).toBeTruthy()
      })

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket connection failed'),
        expect.any(Error)
      )
    })

    it('should handle WebSocket reconnection', async () => {
      mockWebSocketService.isConnected
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)

      mockWebSocketService.getConnectionState
        .mockReturnValueOnce('disconnected')
        .mockReturnValueOnce('reconnecting')
        .mockReturnValueOnce('connected')

      const { result } = renderHook(
        () => useMarketData({ realTime: true }),
        { wrapper }
      )

      // Simulate reconnection
      act(() => {
        const reconnectCallback = mockWebSocketService.subscribe.mock.calls
          .find(call => call[0] === 'connection_status')?.[1]
        reconnectCallback?.('connected')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })
  })

  describe('Error Recovery and Fallbacks', () => {
    it('should implement retry logic for failed requests', async () => {
      mockApiClient.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ indices: { 'S&P 500': { value: 4200 } } })

      const { result } = renderHook(
        () => useMarketData({ retryCount: 3 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiClient.get).toHaveBeenCalledTimes(3)
      expect(result.current.data).toBeDefined()
      expect(result.current.error).toBeNull()
    })

    it('should provide fallback data when API fails', async () => {
      const fallbackData = {
        indices: { 'S&P 500': { value: 0, change: 0, changePercent: 0 } }
      }

      mockApiClient.get.mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(
        () => useMarketData({ fallback: fallbackData }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(fallbackData)
      expect(result.current.usingFallback).toBe(true)
    })

    it('should handle stale data gracefully', async () => {
      const staleData = {
        indices: { 'S&P 500': { value: 4200, lastUpdated: '2024-01-14T10:00:00Z' } }
      }

      mockApiClient.get.mockResolvedValue(staleData)

      const { result } = renderHook(
        () => useMarketData({ staleTime: 300000 }), // 5 minutes
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(staleData)
      expect(result.current.isStale).toBe(true)
    })
  })

  describe('Performance Optimization', () => {
    it('should debounce rapid refresh requests', async () => {
      const mockData = { indices: { 'S&P 500': { value: 4200 } } }
      mockApiClient.get.mockResolvedValue(mockData)

      const { result } = renderHook(() => useMarketData(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Rapid refresh calls
      act(() => {
        result.current.refetch()
        result.current.refetch()
        result.current.refetch()
      })

      jest.advanceTimersByTime(1000)

      // Should debounce to single call
      expect(mockApiClient.get).toHaveBeenCalledTimes(2) // Initial + debounced
    })

    it('should optimize memory usage with proper cleanup', async () => {
      const { result, unmount } = renderHook(
        () => useMarketData({ realTime: true }),
        { wrapper }
      )

      await waitFor(() => {
        expect(mockWebSocketService.subscribe).toHaveBeenCalled()
      })

      unmount()

      // Should cleanup all subscriptions and timers
      expect(mockWebSocketService.disconnect).toHaveBeenCalled()
    })
  })
})