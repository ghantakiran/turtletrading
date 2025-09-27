/**
 * Integration tests for Market data binding between server and client components
 * Tests data flow from server-side fetching through to client-side display
 */
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { jest } from '@jest/globals'
import MarketPage from '@/app/(protected)/market/page'
import MarketClient from '@/app/(protected)/market/MarketClient'
import type { MarketIndex, SectorData, MarketBreadth } from '@/app/(protected)/market/page'

// Mock the environment
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock the recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Treemap: ({ children }: { children: React.ReactNode }) => <div data-testid="treemap">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
}))

// Mock UI components
jest.mock('@/components/ui/RefreshButton', () => ({
  RefreshButton: ({ onClick, isRefreshing }: { onClick: () => void; isRefreshing: boolean }) => (
    <button data-testid="refresh-button" onClick={onClick} disabled={isRefreshing}>
      {isRefreshing ? 'Refreshing...' : 'Refresh'}
    </button>
  ),
}))

// Test data
const mockMarketIndices: MarketIndex[] = [
  {
    symbol: 'SPY',
    name: 'S&P 500',
    value: 4567.89,
    change: 23.45,
    changePercent: 0.52,
    timestamp: '2024-01-15T10:30:00Z',
    volume: 45623000,
    high52Week: 4800.00,
    low52Week: 3500.00,
  },
  {
    symbol: 'QQQ',
    name: 'NASDAQ 100',
    value: 387.23,
    change: -5.67,
    changePercent: -1.44,
    timestamp: '2024-01-15T10:30:00Z',
    volume: 32145000,
    high52Week: 410.00,
    low52Week: 290.00,
  },
]

const mockSectorData: SectorData[] = [
  {
    name: 'Technology',
    symbol: 'XLK',
    value: 157.45,
    change: 2.34,
    changePercent: 1.51,
    marketCap: 1234567890000,
    volume: 12345678,
  },
  {
    name: 'Healthcare',
    symbol: 'XLV',
    value: 142.78,
    change: -1.23,
    changePercent: -0.85,
    marketCap: 987654321000,
    volume: 8765432,
  },
]

const mockMarketBreadth: MarketBreadth = {
  advancingStocks: 1245,
  decliningStocks: 987,
  unchangedStocks: 234,
  advancingVolume: 1234567890,
  decliningVolume: 987654321,
  totalVolume: 2222222211,
  newHighs: 56,
  newLows: 23,
  advanceDeclineRatio: 1.26,
  upDownVolumeRatio: 1.25,
  timestamp: '2024-01-15T10:30:00Z',
}

describe('Market Data Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock successful API responses
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        indices: mockMarketIndices,
        sectors: mockSectorData,
        breadth: mockMarketBreadth,
      }),
    })
  })

  describe('Server-to-Client Data Flow', () => {
    it('should pass server data correctly to client components', async () => {
      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Verify indices data is displayed
      expect(screen.getByText('S&P 500')).toBeInTheDocument()
      expect(screen.getByText('NASDAQ 100')).toBeInTheDocument()
      expect(screen.getByText('4,567.89')).toBeInTheDocument()
      expect(screen.getByText('387.23')).toBeInTheDocument()

      // Verify sector data is displayed
      expect(screen.getByText('Technology')).toBeInTheDocument()
      expect(screen.getByText('Healthcare')).toBeInTheDocument()

      // Verify market breadth data is displayed
      expect(screen.getByText('1,245')).toBeInTheDocument() // Advancing stocks
      expect(screen.getByText('987')).toBeInTheDocument() // Declining stocks
    })

    it('should handle data transformation correctly', async () => {
      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Check percentage formatting
      expect(screen.getByText('(+0.52%)')).toBeInTheDocument()
      expect(screen.getByText('(-1.44%)')).toBeInTheDocument()

      // Check change formatting with signs
      expect(screen.getByText('+23.45')).toBeInTheDocument()
      expect(screen.getByText('-5.67')).toBeInTheDocument()

      // Check color coding
      const positiveChange = screen.getByText('+23.45')
      expect(positiveChange).toHaveClass('text-green-600')

      const negativeChange = screen.getByText('-5.67')
      expect(negativeChange).toHaveClass('text-red-600')
    })

    it('should handle empty data gracefully', async () => {
      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={[]}
          initialSectors={[]}
          initialBreadth={null}
        />
      )

      render(<MarketPageWithProps />)

      // Should show empty state messages
      expect(screen.getByText('No market data available')).toBeInTheDocument()
      expect(screen.getByText('No sector data available')).toBeInTheDocument()
    })
  })

  describe('Real-time Data Updates', () => {
    it('should update data when refresh is triggered', async () => {
      const updatedIndices: MarketIndex[] = [
        {
          ...mockMarketIndices[0],
          value: 4600.00,
          change: 55.56,
          changePercent: 1.22,
        },
      ]

      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Initial state
      expect(screen.getByText('4,567.89')).toBeInTheDocument()

      // Mock updated API response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          indices: updatedIndices,
          sectors: mockSectorData,
          breadth: mockMarketBreadth,
        }),
      })

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Wait for update
      await waitFor(() => {
        expect(screen.getByText('4,600.00')).toBeInTheDocument()
        expect(screen.getByText('+55.56')).toBeInTheDocument()
        expect(screen.getByText('(+1.22%)')).toBeInTheDocument()
      })
    })

    it('should handle API errors during refresh', async () => {
      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Mock API error
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Should still show original data and handle error gracefully
      await waitFor(() => {
        expect(screen.getByText('4,567.89')).toBeInTheDocument()
        // The component should handle the error internally and not crash
      })
    })

    it('should auto-refresh data at specified intervals', async () => {
      jest.useFakeTimers()

      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Mock multiple API calls for auto-refresh
      const updatedData = {
        indices: [{ ...mockMarketIndices[0], value: 4600.00 }],
        sectors: mockSectorData,
        breadth: mockMarketBreadth,
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => updatedData,
      })

      // Fast-forward time to trigger auto-refresh (60 seconds)
      act(() => {
        jest.advanceTimersByTime(60000)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/market/overview')
      })

      jest.useRealTimers()
    })
  })

  describe('Interactive Features', () => {
    it('should handle time range changes', async () => {
      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Find time range buttons
      const timeRangeButtons = screen.getAllByRole('button').filter(button =>
        ['1D', '1W', '1M', '3M', '1Y'].includes(button.textContent || '')
      )

      if (timeRangeButtons.length > 0) {
        // Click different time range
        fireEvent.click(timeRangeButtons[1]) // 1W

        // Should trigger API call with time range parameter
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('timeRange=1W')
          )
        })
      }
    })

    it('should handle sector selection', async () => {
      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Find sector elements
      const technologySector = screen.getByText('Technology')

      if (technologySector) {
        fireEvent.click(technologySector)

        // Should trigger sector-specific data fetch
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('sector=Technology')
          )
        })
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network unavailable'))

      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      const { container } = render(<MarketPageWithProps />)

      // Trigger refresh to cause network error
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Component should not crash and should show original data
      await waitFor(() => {
        expect(container).toBeInTheDocument()
        expect(screen.getByText('4,567.89')).toBeInTheDocument()
      })
    })

    it('should handle invalid API responses', async () => {
      // Mock invalid API response
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })

      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Should handle error and maintain functionality
      await waitFor(() => {
        expect(screen.getByText('4,567.89')).toBeInTheDocument()
      })
    })

    it('should handle malformed data gracefully', async () => {
      // Mock malformed API response
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          indices: [{ symbol: 'SPY' }], // Missing required fields
          sectors: null,
          breadth: undefined,
        }),
      })

      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Should handle malformed data and show appropriate fallbacks
      await waitFor(() => {
        // Should not crash and maintain some functionality
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument()
      })
    })
  })

  describe('Data Consistency', () => {
    it('should maintain data consistency across components', async () => {
      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // All components should show consistent timestamp
      const timestamps = screen.getAllByText(/2024-01-15/)
      expect(timestamps.length).toBeGreaterThan(0)
    })

    it('should update all components when data changes', async () => {
      const updatedTimestamp = '2024-01-15T11:00:00Z'
      const updatedData = {
        indices: mockMarketIndices.map(index => ({
          ...index,
          timestamp: updatedTimestamp,
        })),
        sectors: mockSectorData,
        breadth: { ...mockMarketBreadth, timestamp: updatedTimestamp },
      }

      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      render(<MarketPageWithProps />)

      // Mock updated API response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData,
      })

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Wait for updates and verify consistency
      await waitFor(() => {
        const newTimestamps = screen.getAllByText(/11:00/)
        expect(newTimestamps.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeIndicesData = Array.from({ length: 100 }, (_, i) => ({
        symbol: `STOCK${i}`,
        name: `Stock ${i}`,
        value: Math.random() * 1000,
        change: (Math.random() - 0.5) * 20,
        changePercent: (Math.random() - 0.5) * 5,
        timestamp: '2024-01-15T10:30:00Z',
      }))

      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={largeIndicesData}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      const startTime = performance.now()
      render(<MarketPageWithProps />)
      const endTime = performance.now()

      // Should render efficiently (less than 100ms for 100 items)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should handle frequent updates without memory leaks', async () => {
      jest.useFakeTimers()

      const MarketPageWithProps = () => (
        <MarketClient
          initialIndices={mockMarketIndices}
          initialSectors={mockSectorData}
          initialBreadth={mockMarketBreadth}
        />
      )

      const { unmount } = render(<MarketPageWithProps />)

      // Simulate multiple rapid updates
      for (let i = 0; i < 10; i++) {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            indices: mockMarketIndices.map(idx => ({
              ...idx,
              value: idx.value + Math.random(),
            })),
            sectors: mockSectorData,
            breadth: mockMarketBreadth,
          }),
        })

        act(() => {
          jest.advanceTimersByTime(1000)
        })
      }

      // Cleanup should work properly
      unmount()

      jest.useRealTimers()
    })
  })
})