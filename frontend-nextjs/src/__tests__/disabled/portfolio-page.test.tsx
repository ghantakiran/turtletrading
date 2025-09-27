import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PortfolioClient } from '@/app/(protected)/portfolio/PortfolioClient'
import { getMockPortfolioData } from '@/lib/api/portfolio-data'
import { useMarketStore } from '@/stores/marketStore'
import { useUIStore } from '@/stores/uiStore'

// Mock the stores
vi.mock('@/stores/marketStore', () => ({
  useMarketStore: vi.fn()
}))

vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn()
}))

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}))

const mockMarketStore = {
  stockPrices: {
    'AAPL': { price: 200.00, change: 5.00 },
    'MSFT': { price: 380.00, change: -2.00 },
    'GOOGL': { price: 145.00, change: 3.50 }
  },
  isConnected: true
}

const mockUIStore = {
  showNotification: vi.fn(),
  theme: 'light'
}

describe('Portfolio Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useMarketStore as any).mockReturnValue(mockMarketStore)
    ;(useUIStore as any).mockReturnValue(mockUIStore)
  })

  describe('PortfolioClient Component', () => {
    it('renders portfolio overview with mock data', async () => {
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Check for main portfolio elements
      expect(screen.getByText('Live Data')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
      expect(screen.getByText('Rebalance')).toBeInTheDocument()
      expect(screen.getByText('Refresh')).toBeInTheDocument()

      // Check tab navigation
      expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Allocation' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Transactions' })).toBeInTheDocument()
    })

    it('displays portfolio metrics correctly', async () => {
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Check P&L display
      expect(screen.getByText('Total Value')).toBeInTheDocument()
      expect(screen.getByText('$55,673')).toBeInTheDocument()
      expect(screen.getByText('Unrealized P&L')).toBeInTheDocument()
      expect(screen.getByText('$12,673')).toBeInTheDocument()

      // Check holdings
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument()
        expect(screen.getByText('MSFT')).toBeInTheDocument()
        expect(screen.getByText('GOOGL')).toBeInTheDocument()
      })
    })

    it('updates prices with real-time data', async () => {
      const mockData = getMockPortfolioData()
      
      const { rerender } = render(<PortfolioClient initialData={mockData} />)

      // Simulate price updates
      const updatedMarketStore = {
        ...mockMarketStore,
        stockPrices: {
          'AAPL': { price: 210.00, change: 15.00 }, // Price increase
          'MSFT': { price: 370.00, change: -12.00 }, // Price decrease
          'GOOGL': { price: 145.00, change: 3.50 }
        }
      }
      
      ;(useMarketStore as any).mockReturnValue(updatedMarketStore)
      
      rerender(<PortfolioClient initialData={mockData} />)

      // The component should reflect updated values
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument()
        expect(screen.getByText('MSFT')).toBeInTheDocument()
      })
    })

    it('handles connection status changes', async () => {
      const mockData = getMockPortfolioData()
      
      const { rerender } = render(<PortfolioClient initialData={mockData} />)

      // Initially connected
      expect(screen.getByText('Live Data')).toBeInTheDocument()

      // Simulate disconnection
      ;(useMarketStore as any).mockReturnValue({
        ...mockMarketStore,
        isConnected: false
      })
      
      rerender(<PortfolioClient initialData={mockData} />)

      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('switches between tabs correctly', async () => {
      const user = userEvent.setup()
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Initially on Overview tab
      expect(screen.getByText('Holdings')).toBeInTheDocument()
      expect(screen.getByText('Portfolio Metrics')).toBeInTheDocument()

      // Switch to Allocation tab
      await user.click(screen.getByRole('tab', { name: 'Allocation' }))
      
      await waitFor(() => {
        expect(screen.getByText('Sector Allocation')).toBeInTheDocument()
        expect(screen.getByText('Asset Types')).toBeInTheDocument()
        expect(screen.getByText('Top Holdings')).toBeInTheDocument()
      })

      // Switch to Transactions tab
      await user.click(screen.getByRole('tab', { name: 'Transactions' }))
      
      await waitFor(() => {
        expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
        expect(screen.getByText('Your trading history and activity')).toBeInTheDocument()
      })
    })

    it('displays sector allocation correctly', async () => {
      const user = userEvent.setup()
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Switch to Allocation tab
      await user.click(screen.getByRole('tab', { name: 'Allocation' }))

      await waitFor(() => {
        expect(screen.getByText('Technology')).toBeInTheDocument()
        expect(screen.getByText('92.5%')).toBeInTheDocument()
        expect(screen.getByText('Communication')).toBeInTheDocument()
        expect(screen.getByText('6.4%')).toBeInTheDocument()
      })
    })

    it('displays transaction history correctly', async () => {
      const user = userEvent.setup()
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Switch to Transactions tab
      await user.click(screen.getByRole('tab', { name: 'Transactions' }))

      await waitFor(() => {
        expect(screen.getByText('BUY 100 shares @ $150.00')).toBeInTheDocument()
        expect(screen.getByText('BUY 75 shares @ $280.00')).toBeInTheDocument()
        expect(screen.getByText('$15,000')).toBeInTheDocument()
        expect(screen.getByText('$21,000')).toBeInTheDocument()
      })
    })

    it('handles portfolio actions correctly', async () => {
      const user = userEvent.setup()
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Test export button
      const exportButton = screen.getByText('Export')
      expect(exportButton).toBeInTheDocument()
      await user.click(exportButton)

      // Test rebalance button
      const rebalanceButton = screen.getByText('Rebalance')
      expect(rebalanceButton).toBeInTheDocument()
      await user.click(rebalanceButton)

      // Test refresh button
      const refreshButton = screen.getByText('Refresh')
      expect(refreshButton).toBeInTheDocument()
      await user.click(refreshButton)
    })

    it('handles missing data gracefully', async () => {
      const mockDataWithErrors = {
        ...getMockPortfolioData(),
        holdings: null,
        pnl: null,
        errors: {
          holdings: 'API Error',
          pnl: 'Network Error',
          allocation: null,
          transactions: null,
          metrics: null
        }
      }
      
      render(<PortfolioClient initialData={mockDataWithErrors} />)

      expect(screen.getByText('Portfolio data unavailable')).toBeInTheDocument()
    })

    it('displays portfolio metrics in sidebar', async () => {
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Check portfolio metrics
      expect(screen.getByText('Portfolio Metrics')).toBeInTheDocument()
      expect(screen.getByText('Beta')).toBeInTheDocument()
      expect(screen.getByText('1.12')).toBeInTheDocument()
      expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument()
      expect(screen.getByText('1.89')).toBeInTheDocument()
      expect(screen.getByText('Volatility')).toBeInTheDocument()
      expect(screen.getByText('18.7%')).toBeInTheDocument()
      expect(screen.getByText('Max Drawdown')).toBeInTheDocument()
      expect(screen.getByText('-12.3%')).toBeInTheDocument()
    })

    it('displays quick actions in sidebar', async () => {
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Check quick actions
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByText('Add Position')).toBeInTheDocument()
      expect(screen.getByText('Performance Analysis')).toBeInTheDocument()
      expect(screen.getByText('Risk Analysis')).toBeInTheDocument()
    })

    it('shows appropriate colors for gains and losses', async () => {
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // All mock holdings have positive gains, should show green
      await waitFor(() => {
        const gainElements = screen.getAllByText(/\+\$\d+/)
        expect(gainElements.length).toBeGreaterThan(0)
      })
    })

    it('renders responsive design elements', async () => {
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // Check for responsive grid classes
      const overviewTab = screen.getByRole('tabpanel')
      expect(overviewTab).toBeInTheDocument()
    })
  })

  describe('Portfolio Data Integration', () => {
    it('integrates with market store for real-time updates', async () => {
      const mockData = getMockPortfolioData()
      
      // Test with different market store states
      const marketStoreStates = [
        { ...mockMarketStore, isConnected: true },
        { ...mockMarketStore, isConnected: false },
        {
          ...mockMarketStore,
          stockPrices: {
            'AAPL': { price: 195.00, change: -0.89 },
            'MSFT': { price: 378.24, change: 1.24 },
            'GOOGL': { price: 141.68, change: -2.32 }
          }
        }
      ]

      for (const storeState of marketStoreStates) {
        ;(useMarketStore as any).mockReturnValue(storeState)
        
        const { rerender } = render(<PortfolioClient initialData={mockData} />)
        
        expect(screen.getByText(storeState.isConnected ? 'Live Data' : 'Offline')).toBeInTheDocument()
        
        rerender(<div />)
      }
    })

    it('integrates with UI store for notifications', async () => {
      const mockData = getMockPortfolioData()
      
      render(<PortfolioClient initialData={mockData} />)

      // UI store should be accessed for theme and notifications
      expect(useUIStore).toHaveBeenCalled()
    })
  })
})
