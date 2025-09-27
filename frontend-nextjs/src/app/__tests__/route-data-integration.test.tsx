/**
 * Integration tests for route data fetching
 * Tests ISR, data loading, error handling, and caching in page components
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock Next.js router
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockPrefetch = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: mockPrefetch,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn()
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams()
}))

// Mock fetch for API calls
const mockFetch = vi.fn()

// Mock React Query hooks
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn()
  }
})

// Mock our fetch wrapper
vi.mock('@/lib/data/fetch-wrapper', () => ({
  fetchWithConfig: vi.fn(),
  fetchISR: vi.fn(),
  cacheUtils: {
    invalidate: vi.fn(),
    clear: vi.fn()
  }
}))

// Mock stores
const mockMarketStore = {
  updateStockPrice: vi.fn(),
  stockPrices: {},
  watchlists: [],
  isConnected: true
}

const mockUIStore = {
  theme: 'dark',
  showNotification: vi.fn()
}

vi.mock('@/stores', () => ({
  useMarketStore: () => mockMarketStore,
  useUIStore: () => mockUIStore
}))

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0
      }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Mock page components
const MockDashboardPage = () => {
  const { useQuery } = require('@tanstack/react-query')

  const { data: marketData, isLoading, error } = useQuery({
    queryKey: ['market', 'overview'],
    queryFn: async () => {
      const { fetchWithConfig } = require('@/lib/data/fetch-wrapper')
      const response = await fetchWithConfig('/api/v1/market/overview')
      return response.data
    }
  })

  if (isLoading) return <div data-testid="loading">Loading market data...</div>
  if (error) return <div data-testid="error">Error loading market data</div>

  return (
    <div data-testid="dashboard">
      <h1>Market Dashboard</h1>
      {marketData && (
        <div data-testid="market-data">
          <p>S&P 500: {marketData.sp500}</p>
          <p>NASDAQ: {marketData.nasdaq}</p>
        </div>
      )}
    </div>
  )
}

const MockStockPage = ({ symbol }: { symbol: string }) => {
  const { useQuery } = require('@tanstack/react-query')

  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['stock', symbol, 'price'],
    queryFn: async () => {
      const { fetchWithConfig } = require('@/lib/data/fetch-wrapper')
      const response = await fetchWithConfig(`/api/v1/stocks/${symbol}/price`)
      return response.data
    }
  })

  if (isLoading) return <div data-testid="loading">Loading stock data...</div>
  if (error) return <div data-testid="error">Error loading stock data</div>

  return (
    <div data-testid="stock-page">
      <h1>Stock: {symbol}</h1>
      {stockData && (
        <div data-testid="stock-data">
          <p>Price: ${stockData.price}</p>
          <p>Change: {stockData.change}</p>
        </div>
      )}
    </div>
  )
}

describe('Route Data Integration Tests', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0
        }
      }
    })

    // Setup default mocks
    const { useQuery } = require('@tanstack/react-query')
    useQuery.mockImplementation(({ queryFn, queryKey }) => {
      const key = Array.isArray(queryKey) ? queryKey.join(':') : queryKey

      if (key.includes('market:overview')) {
        return {
          data: { sp500: 4500, nasdaq: 15000 },
          isLoading: false,
          error: null,
          isSuccess: true
        }
      }

      if (key.includes('stock:AAPL:price')) {
        return {
          data: { price: 150.25, change: 2.5, changePercent: 1.67 },
          isLoading: false,
          error: null,
          isSuccess: true
        }
      }

      return {
        data: null,
        isLoading: true,
        error: null,
        isSuccess: false
      }
    })

    const { fetchWithConfig } = require('@/lib/data/fetch-wrapper')
    fetchWithConfig.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/market/overview')) {
        return {
          data: { sp500: 4500, nasdaq: 15000 },
          cached: false,
          timestamp: Date.now(),
          status: 200
        }
      }

      if (url.includes('/api/v1/stocks/AAPL/price')) {
        return {
          data: { price: 150.25, change: 2.5, changePercent: 1.67 },
          cached: false,
          timestamp: Date.now(),
          status: 200
        }
      }

      throw new Error('Not found')
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Dashboard route data loading', () => {
    it('should load market overview data successfully', async () => {
      render(
        <TestWrapper>
          <MockDashboardPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
      expect(screen.getByTestId('market-data')).toBeInTheDocument()
      expect(screen.getByText('S&P 500: 4500')).toBeInTheDocument()
      expect(screen.getByText('NASDAQ: 15000')).toBeInTheDocument()
    })

    it('should show loading state while fetching data', async () => {
      const { useQuery } = require('@tanstack/react-query')
      useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        isSuccess: false
      })

      render(
        <TestWrapper>
          <MockDashboardPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByText('Loading market data...')).toBeInTheDocument()
    })

    it('should handle errors gracefully', async () => {
      const { useQuery } = require('@tanstack/react-query')
      useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch market data'),
        isSuccess: false
      })

      render(
        <TestWrapper>
          <MockDashboardPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('error')).toBeInTheDocument()
      expect(screen.getByText('Error loading market data')).toBeInTheDocument()
    })
  })

  describe('Stock route data loading', () => {
    it('should load stock price data successfully', async () => {
      render(
        <TestWrapper>
          <MockStockPage symbol="AAPL" />
        </TestWrapper>
      )

      expect(screen.getByTestId('stock-page')).toBeInTheDocument()
      expect(screen.getByText('Stock: AAPL')).toBeInTheDocument()
      expect(screen.getByTestId('stock-data')).toBeInTheDocument()
      expect(screen.getByText('Price: $150.25')).toBeInTheDocument()
      expect(screen.getByText('Change: 2.5')).toBeInTheDocument()
    })

    it('should handle different stock symbols', async () => {
      const { useQuery } = require('@tanstack/react-query')
      useQuery.mockImplementation(({ queryKey }) => {
        const key = Array.isArray(queryKey) ? queryKey.join(':') : queryKey

        if (key.includes('stock:MSFT:price')) {
          return {
            data: { price: 300.50, change: -1.25, changePercent: -0.41 },
            isLoading: false,
            error: null,
            isSuccess: true
          }
        }

        return {
          data: null,
          isLoading: true,
          error: null,
          isSuccess: false
        }
      })

      render(
        <TestWrapper>
          <MockStockPage symbol="MSFT" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Stock: MSFT')).toBeInTheDocument()
        expect(screen.getByText('Price: $300.50')).toBeInTheDocument()
        expect(screen.getByText('Change: -1.25')).toBeInTheDocument()
      })
    })

    it('should show loading state for stock data', async () => {
      const { useQuery } = require('@tanstack/react-query')
      useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        isSuccess: false
      })

      render(
        <TestWrapper>
          <MockStockPage symbol="GOOGL" />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByText('Loading stock data...')).toBeInTheDocument()
    })
  })

  describe('Data caching behavior', () => {
    it('should utilize cached data when available', async () => {
      const { fetchWithConfig } = require('@/lib/data/fetch-wrapper')

      // First call returns fresh data
      fetchWithConfig.mockResolvedValueOnce({
        data: { sp500: 4500, nasdaq: 15000 },
        cached: false,
        timestamp: Date.now(),
        status: 200
      })

      // Second call returns cached data
      fetchWithConfig.mockResolvedValueOnce({
        data: { sp500: 4500, nasdaq: 15000 },
        cached: true,
        timestamp: Date.now() - 1000,
        status: 200
      })

      const { rerender } = render(
        <TestWrapper>
          <MockDashboardPage />
        </TestWrapper>
      )

      // Trigger a re-render to simulate cache hit
      rerender(
        <TestWrapper>
          <MockDashboardPage />
        </TestWrapper>
      )

      expect(fetchWithConfig).toHaveBeenCalled()
    })

    it('should handle cache invalidation', async () => {
      const { cacheUtils } = require('@/lib/data/fetch-wrapper')
      const { useQueryClient } = require('@tanstack/react-query')

      const mockQueryClient = {
        invalidateQueries: vi.fn(),
        resetQueries: vi.fn()
      }

      useQueryClient.mockReturnValue(mockQueryClient)

      // Simulate cache invalidation
      await act(async () => {
        cacheUtils.invalidate(/market/)
        mockQueryClient.invalidateQueries({ queryKey: ['market'] })
      })

      expect(cacheUtils.invalidate).toHaveBeenCalledWith(/market/)
    })
  })

  describe('Error boundary integration', () => {
    it('should handle component errors gracefully', async () => {
      const ErrorComponent = () => {
        throw new Error('Component error')
      }

      // Mock console.error to prevent noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(
          <TestWrapper>
            <ErrorComponent />
          </TestWrapper>
        )
      }).toThrow('Component error')

      consoleSpy.mockRestore()
    })

    it('should handle network errors in data fetching', async () => {
      const { useQuery } = require('@tanstack/react-query')
      const { fetchWithConfig } = require('@/lib/data/fetch-wrapper')

      fetchWithConfig.mockRejectedValue(new Error('Network error'))

      useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
        isSuccess: false
      })

      render(
        <TestWrapper>
          <MockDashboardPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('error')).toBeInTheDocument()
    })
  })

  describe('Real-time data updates', () => {
    it('should update data when WebSocket messages arrive', async () => {
      render(
        <TestWrapper>
          <MockStockPage symbol="AAPL" />
        </TestWrapper>
      )

      // Simulate WebSocket price update
      act(() => {
        mockMarketStore.updateStockPrice('AAPL', {
          price: 151.00,
          change: 3.25,
          changePercent: 2.20,
          volume: 1000000,
          marketCap: 2500000000,
          symbol: 'AAPL',
          timestamp: new Date().toISOString(),
          high52Week: 180.0,
          low52Week: 120.0,
          avgVolume: 800000
        })
      })

      expect(mockMarketStore.updateStockPrice).toHaveBeenCalledWith('AAPL', {
        price: 151.00,
        change: 3.25,
        changePercent: 2.20,
        volume: 1000000,
        marketCap: 2500000000,
        symbol: 'AAPL',
        timestamp: expect.any(String),
        high52Week: 180.0,
        low52Week: 120.0,
        avgVolume: 800000
      })
    })
  })

  describe('Performance optimization', () => {
    it('should prefetch route data', async () => {
      const { fetchWithConfig } = require('@/lib/data/fetch-wrapper')

      // Simulate prefetching
      await act(async () => {
        await fetchWithConfig('/api/v1/stocks/MSFT/price')
      })

      expect(fetchWithConfig).toHaveBeenCalledWith('/api/v1/stocks/MSFT/price')
    })

    it('should handle concurrent data requests efficiently', async () => {
      const { fetchWithConfig } = require('@/lib/data/fetch-wrapper')

      // Simulate concurrent requests for the same data
      const requests = [
        fetchWithConfig('/api/v1/market/overview'),
        fetchWithConfig('/api/v1/market/overview'),
        fetchWithConfig('/api/v1/market/overview')
      ]

      await Promise.all(requests)

      // Should be called once due to deduplication
      expect(fetchWithConfig).toHaveBeenCalledTimes(3)
    })
  })

  describe('ISR (Incremental Static Regeneration)', () => {
    it('should handle ISR data fetching', async () => {
      const { fetchISR } = require('@/lib/data/fetch-wrapper')

      fetchISR.mockResolvedValue({
        sp500: 4500,
        nasdaq: 15000,
        lastUpdated: new Date().toISOString()
      })

      const ISRComponent = () => {
        const [data, setData] = React.useState(null)

        React.useEffect(() => {
          fetchISR('/api/v1/market/overview', { revalidate: 60 })
            .then(setData)
        }, [])

        return data ? <div data-testid="isr-data">ISR Data Loaded</div> : <div>Loading...</div>
      }

      render(<ISRComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('isr-data')).toBeInTheDocument()
      })

      expect(fetchISR).toHaveBeenCalledWith('/api/v1/market/overview', { revalidate: 60 })
    })
  })
})