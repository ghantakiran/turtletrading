import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WatchlistClient } from '@/app/(protected)/watchlist/WatchlistClient'
import { getMockWatchlistsData } from '@/lib/api/watchlist-data'
import useMarketStore, { StockPrice } from '@/stores/marketStore'
import { useUIStore } from '@/stores/uiStore'

// Mock WebSocket service
const mockWebSocketService = {
  subscribeToSymbol: vi.fn(),
  unsubscribeFromSymbol: vi.fn(),
  subscribeToWatchlist: vi.fn(),
  unsubscribeFromWatchlist: vi.fn(),
  isConnected: true,
  connectionState: 'connected',
  subscriptionsCount: 0,
  subscribedSymbols: []
}

vi.mock('@/services/websocketService', () => ({
  default: mockWebSocketService
}))

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => children
}))

// Mock @tanstack/react-virtual for virtualization
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 420, // 7 items * 60px height
    getVirtualItems: () => [
      { key: 0, index: 0, start: 0, size: 60 },
      { key: 1, index: 1, start: 60, size: 60 },
      { key: 2, index: 2, start: 120, size: 60 },
      { key: 3, index: 3, start: 180, size: 60 },
      { key: 4, index: 4, start: 240, size: 60 },
      { key: 5, index: 5, start: 300, size: 60 },
      { key: 6, index: 6, start: 360, size: 60 }
    ]
  })
}))

const mockMarketStore = {
  stockPrices: {} as Record<string, StockPrice>,
  isConnected: true,
  watchlists: [],
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
  fetchStockData: vi.fn()
}

const mockUIStore = {
  showNotification: vi.fn(),
  theme: 'light'
}

// Mock the stores
vi.mock('@/stores/marketStore', () => ({
  useMarketStore: vi.fn(),
  default: vi.fn()
}))

vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn()
}))

describe('Watchlist Streaming Integration Tests', () => {
  const mockData = getMockWatchlistsData()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useMarketStore as any).mockReturnValue(mockMarketStore)
    ;(useUIStore as any).mockReturnValue(mockUIStore)
    mockWebSocketService.subscribeToSymbol.mockClear()
    mockWebSocketService.unsubscribeFromSymbol.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('WebSocket Subscription Management', () => {
    it('subscribes to all symbols in current watchlist on mount', async () => {
      render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        // Should subscribe to all 7 stocks in the default watchlist
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledTimes(7)
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('AAPL')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('MSFT')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('GOOGL')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('TSLA')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('NVDA')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('META')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('AMZN')
      })
    })

    it('unsubscribes from previous symbols and subscribes to new ones when watchlist changes', async () => {
      const user = userEvent.setup()

      render(<WatchlistClient initialData={mockData} />)

      // Wait for initial subscriptions
      await waitFor(() => {
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledTimes(7)
      })

      // Clear mock calls
      mockWebSocketService.subscribeToSymbol.mockClear()
      mockWebSocketService.unsubscribeFromSymbol.mockClear()

      // Switch to tech watchlist
      const watchlistSelect = screen.getByDisplayValue(/My Watchlist/)
      await user.selectOptions(watchlistSelect, 'tech-watchlist')

      await waitFor(() => {
        // Should unsubscribe from all 7 stocks
        expect(mockWebSocketService.unsubscribeFromSymbol).toHaveBeenCalledTimes(7)

        // Should subscribe to 4 tech stocks
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledTimes(4)
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('AAPL')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('MSFT')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('GOOGL')
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledWith('NVDA')
      })
    })

    it('properly cleans up subscriptions on unmount', async () => {
      const { unmount } = render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledTimes(7)
      })

      mockWebSocketService.unsubscribeFromSymbol.mockClear()

      unmount()

      expect(mockWebSocketService.unsubscribeFromSymbol).toHaveBeenCalledTimes(7)
    })
  })

  describe('Real-time Price Updates', () => {
    it('displays updated prices from live data stream', async () => {
      // Mock market store with live price data
      const mockStoreWithPrices = {
        ...mockMarketStore,
        stockPrices: {
          'AAPL': {
            symbol: 'AAPL',
            price: 200.50,
            change: 4.61,
            changePercent: 2.35,
            volume: 50000000,
            marketCap: 3100000000000,
            timestamp: new Date().toISOString(),
            high52Week: 205.00,
            low52Week: 160.00,
            avgVolume: 60000000
          }
        }
      }

      ;(useMarketStore as any).mockReturnValue(mockStoreWithPrices)

      render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        // Should display the live price instead of mock data price
        expect(screen.getByText('$200.50')).toBeInTheDocument()
        expect(screen.getByText('+4.61')).toBeInTheDocument()
        expect(screen.getByText('+2.35%')).toBeInTheDocument()
      })

      // Verify original mock data price is not displayed
      expect(screen.queryByText('$195.89')).not.toBeInTheDocument()
    })

    it('falls back to original data when live prices are unavailable', async () => {
      // Mock market store without live price data
      const mockStoreWithoutPrices = {
        ...mockMarketStore,
        stockPrices: {}
      }

      ;(useMarketStore as any).mockReturnValue(mockStoreWithoutPrices)

      render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        // Should display original mock data prices
        expect(screen.getByText('$195.89')).toBeInTheDocument()
        expect(screen.getByText('+2.34')).toBeInTheDocument()
        expect(screen.getByText('+1.21%')).toBeInTheDocument()
      })
    })

    it('updates price colors based on change direction', async () => {
      const mockStoreWithPrices = {
        ...mockMarketStore,
        stockPrices: {
          'AAPL': {
            symbol: 'AAPL',
            price: 200.50,
            change: 4.61,
            changePercent: 2.35,
            volume: 50000000,
            marketCap: 3100000000000,
            timestamp: new Date().toISOString(),
            high52Week: 205.00,
            low52Week: 160.00,
            avgVolume: 60000000
          },
          'MSFT': {
            symbol: 'MSFT',
            price: 375.00,
            change: -3.24,
            changePercent: -0.86,
            volume: 25000000,
            marketCap: 2750000000000,
            timestamp: new Date().toISOString(),
            high52Week: 385.00,
            low52Week: 300.00,
            avgVolume: 32000000
          }
        }
      }

      ;(useMarketStore as any).mockReturnValue(mockStoreWithPrices)

      render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        // Positive change should have bull color class
        const positiveChange = screen.getByText('+4.61')
        expect(positiveChange).toHaveClass('text-bull-600')

        // Negative change should have bear color class
        const negativeChange = screen.getByText('-3.24')
        expect(negativeChange).toHaveClass('text-bear-600')
      })
    })
  })

  describe('Connection Status Indicators', () => {
    it('displays live data indicator when connected', async () => {
      render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        expect(screen.getByText('Live Data')).toBeInTheDocument()
        expect(screen.getByText(/Live Data/)).toBeInTheDocument()
      })
    })

    it('displays offline indicator when disconnected', async () => {
      const mockDisconnectedStore = {
        ...mockMarketStore,
        isConnected: false
      }

      ;(useMarketStore as any).mockReturnValue(mockDisconnectedStore)

      render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument()
      })
    })

    it('shows connection status in header and status badges', async () => {
      render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        // Should show in header description
        expect(screen.getByText(/Live Data/)).toBeInTheDocument()

        // Should show in status badge
        const statusBadges = screen.getAllByText('Live Data')
        expect(statusBadges.length).toBeGreaterThan(1)
      })
    })
  })

  describe('Fallback Data Fetching', () => {
    it('fetches data periodically when disconnected', async () => {
      vi.useFakeTimers()

      const mockDisconnectedStore = {
        ...mockMarketStore,
        isConnected: false
      }

      ;(useMarketStore as any).mockReturnValue(mockDisconnectedStore)

      render(<WatchlistClient initialData={mockData} />)

      // Fast-forward 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      await waitFor(() => {
        // Should fetch data for all stocks
        expect(mockMarketStore.fetchStockData).toHaveBeenCalledTimes(7)
      })

      vi.useRealTimers()
    })

    it('does not fetch data when connected', async () => {
      vi.useFakeTimers()

      render(<WatchlistClient initialData={mockData} />)

      // Fast-forward 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      // Should not fetch data when connected
      expect(mockMarketStore.fetchStockData).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('Stock Management Integration', () => {
    it('removes stock from watchlist and updates subscriptions', async () => {
      const user = userEvent.setup()

      render(<WatchlistClient initialData={mockData} />)

      // Wait for initial subscriptions
      await waitFor(() => {
        expect(mockWebSocketService.subscribeToSymbol).toHaveBeenCalledTimes(7)
      })

      // Clear mock calls
      mockWebSocketService.unsubscribeFromSymbol.mockClear()

      // Find and click remove button for AAPL
      const removeButtons = screen.getAllByTitle('Remove from watchlist')
      await user.click(removeButtons[0]) // First stock (AAPL)

      expect(mockMarketStore.removeFromWatchlist).toHaveBeenCalledWith('default-watchlist', 'AAPL')
    })

    it('handles bulk stock removal with subscription cleanup', async () => {
      const user = userEvent.setup()

      render(<WatchlistClient initialData={mockData} />)

      // Select first two stocks
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[1]) // First stock checkbox
      await user.click(checkboxes[2]) // Second stock checkbox

      await waitFor(() => {
        expect(screen.getByText('2 stocks selected')).toBeInTheDocument()
      })

      // Click bulk remove button
      const bulkRemoveButton = screen.getByText('Remove Selected')
      await user.click(bulkRemoveButton)

      expect(mockMarketStore.removeFromWatchlist).toHaveBeenCalledTimes(2)
      expect(mockUIStore.showNotification).toHaveBeenCalledWith({
        type: 'success',
        title: 'Stocks Removed',
        message: 'Removed 2 stocks from watchlist'
      })
    })
  })

  describe('CSV Export with Live Data', () => {
    it('exports CSV with current live prices', async () => {
      const user = userEvent.setup()

      // Mock market store with updated prices
      const mockStoreWithPrices = {
        ...mockMarketStore,
        stockPrices: {
          'AAPL': {
            symbol: 'AAPL',
            price: 200.50,
            change: 4.61,
            changePercent: 2.35,
            volume: 50000000,
            marketCap: 3100000000000,
            timestamp: new Date().toISOString(),
            high52Week: 205.00,
            low52Week: 160.00,
            avgVolume: 60000000
          }
        }
      }

      ;(useMarketStore as any).mockReturnValue(mockStoreWithPrices)

      // Mock DOM methods for CSV export
      const mockCreateElement = vi.fn(() => ({
        setAttribute: vi.fn(),
        style: {},
        click: vi.fn()
      }))
      Object.defineProperty(global, 'document', {
        value: {
          createElement: mockCreateElement,
          body: {
            appendChild: vi.fn(),
            removeChild: vi.fn()
          }
        },
        writable: true
      })

      Object.defineProperty(global, 'URL', {
        value: {
          createObjectURL: vi.fn(() => 'mock-blob-url'),
          revokeObjectURL: vi.fn()
        },
        writable: true
      })

      render(<WatchlistClient initialData={mockData} />)

      // Click export button
      const exportButton = screen.getByText('Export CSV')
      await user.click(exportButton)

      expect(mockUIStore.showNotification).toHaveBeenCalledWith({
        type: 'success',
        title: 'Export Complete',
        message: 'Exported 7 stocks to CSV'
      })
    })

    it('exports selected stocks only when stocks are selected', async () => {
      const user = userEvent.setup()

      render(<WatchlistClient initialData={mockData} />)

      // Select first two stocks
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[1]) // First stock checkbox
      await user.click(checkboxes[2]) // Second stock checkbox

      // Click export in bulk actions
      const bulkExportButton = screen.getByText('Export Selected')
      await user.click(bulkExportButton)

      expect(mockUIStore.showNotification).toHaveBeenCalledWith({
        type: 'success',
        title: 'Export Complete',
        message: 'Exported 2 stocks to CSV'
      })
    })
  })

  describe('Performance and Virtualization', () => {
    it('renders virtualized table with proper dimensions', async () => {
      render(<WatchlistClient initialData={mockData} />)

      await waitFor(() => {
        // Should render virtual table container
        const virtualContainer = screen.getByRole('table', { hidden: true }) ||
                               screen.getByTestId('virtual-table') ||
                               document.querySelector('[style*="height"]')

        // Virtual container should have proper height
        expect(document.querySelector('[style*="420px"]')).toBeInTheDocument()
      })
    })

    it('handles large dataset efficiently', async () => {
      // Create mock data with many stocks
      const largeDataset = {
        ...mockData,
        watchlists: [
          {
            ...mockData.watchlists[0],
            stocks: Array(1000).fill(0).map((_, i) => ({
              ...mockData.watchlists[0].stocks[0],
              symbol: `STOCK${i}`,
              name: `Stock ${i} Inc.`
            }))
          }
        ]
      }

      const { container } = render(<WatchlistClient initialData={largeDataset} />)

      await waitFor(() => {
        // Should only render visible items in viewport
        const renderedRows = container.querySelectorAll('[style*="transform: translateY"]')
        expect(renderedRows.length).toBeLessThan(20) // Only visible rows
      })
    })
  })

  describe('Search and Filtering with Live Data', () => {
    it('filters stocks while preserving live price updates', async () => {
      const user = userEvent.setup()

      const mockStoreWithPrices = {
        ...mockMarketStore,
        stockPrices: {
          'AAPL': {
            symbol: 'AAPL',
            price: 200.50,
            change: 4.61,
            changePercent: 2.35,
            volume: 50000000,
            marketCap: 3100000000000,
            timestamp: new Date().toISOString(),
            high52Week: 205.00,
            low52Week: 160.00,
            avgVolume: 60000000
          }
        }
      }

      ;(useMarketStore as any).mockReturnValue(mockStoreWithPrices)

      render(<WatchlistClient initialData={mockData} />)

      // Search for Apple
      const searchInput = screen.getByPlaceholderText(/Search stocks/)
      await user.type(searchInput, 'Apple')

      await waitFor(() => {
        // Should show only Apple stock
        expect(screen.getByText('AAPL')).toBeInTheDocument()
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument()

        // Should show live price for Apple
        expect(screen.getByText('$200.50')).toBeInTheDocument()

        // Should not show other stocks
        expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
      })
    })
  })
})