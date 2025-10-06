/**
 * Unit Tests for LiveWatchlist Component
 * Tests real-time stock price updates for watchlist stocks
 */

import { render, screen } from '@testing-library/react'
import { LiveWatchlist } from '../LiveWatchlist'
import useMarketStore from '@/stores/marketStore'

// Mock the market store
jest.mock('@/stores/marketStore')

describe('LiveWatchlist Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render watchlist title', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      stockPrices: {},
      watchlists: [{
        id: 'default',
        name: 'My Watchlist',
        symbols: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      selectedWatchlist: 'default',
      connectionStatus: 'connected'
    })

    render(<LiveWatchlist />)
    expect(screen.getByText(/watchlist/i)).toBeInTheDocument()
  })

  it('should display stocks from watchlist', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      stockPrices: {
        'AAPL': {
          symbol: 'AAPL',
          price: 175.43,
          change: 2.10,
          changePercent: 1.21,
          volume: 52000000,
          marketCap: 2700000000000,
          timestamp: new Date().toISOString(),
          high52Week: 198.23,
          low52Week: 143.90,
          avgVolume: 50000000
        }
      },
      watchlists: [{
        id: 'default',
        name: 'My Watchlist',
        symbols: ['AAPL', 'MSFT', 'GOOGL'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      selectedWatchlist: 'default',
      connectionStatus: 'connected'
    })

    render(<LiveWatchlist />)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('$175.43')).toBeInTheDocument()
    expect(screen.getByText('+1.21%')).toBeInTheDocument()
  })

  it('should show empty state when no stocks in watchlist', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      stockPrices: {},
      watchlists: [{
        id: 'default',
        name: 'My Watchlist',
        symbols: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      selectedWatchlist: 'default',
      connectionStatus: 'connected'
    })

    render(<LiveWatchlist />)

    expect(screen.getByText(/no stocks|empty/i)).toBeInTheDocument()
  })

  it('should display placeholder for stocks without price data', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      stockPrices: {},
      watchlists: [{
        id: 'default',
        name: 'My Watchlist',
        symbols: ['AAPL'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      selectedWatchlist: 'default',
      connectionStatus: 'connected'
    })

    render(<LiveWatchlist />)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    // Should show loading or placeholder for price
  })

  it('should show green for positive price changes', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      stockPrices: {
        'AAPL': {
          symbol: 'AAPL',
          price: 175.43,
          change: 2.10,
          changePercent: 1.21,
          volume: 52000000,
          marketCap: 2700000000000,
          timestamp: new Date().toISOString(),
          high52Week: 198.23,
          low52Week: 143.90,
          avgVolume: 50000000
        }
      },
      watchlists: [{
        id: 'default',
        name: 'My Watchlist',
        symbols: ['AAPL'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      selectedWatchlist: 'default',
      connectionStatus: 'connected'
    })

    render(<LiveWatchlist />)

    const positiveChange = screen.getByText('+1.21%')
    expect(positiveChange.className).toMatch(/green|emerald|success/)
  })

  it('should show red for negative price changes', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      stockPrices: {
        'MSFT': {
          symbol: 'MSFT',
          price: 378.85,
          change: -3.05,
          changePercent: -0.80,
          volume: 25000000,
          marketCap: 2800000000000,
          timestamp: new Date().toISOString(),
          high52Week: 398.00,
          low52Week: 320.50,
          avgVolume: 23000000
        }
      },
      watchlists: [{
        id: 'default',
        name: 'My Watchlist',
        symbols: ['MSFT'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      selectedWatchlist: 'default',
      connectionStatus: 'connected'
    })

    render(<LiveWatchlist />)

    const negativeChange = screen.getByText('-0.80%')
    expect(negativeChange.className).toMatch(/red|rose|destructive/)
  })

  it('should display connection status', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      stockPrices: {},
      watchlists: [{
        id: 'default',
        name: 'My Watchlist',
        symbols: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      selectedWatchlist: 'default',
      connectionStatus: 'connected'
    })

    render(<LiveWatchlist />)

    expect(screen.getByText(/live|connected/i)).toBeInTheDocument()
  })

  it('should display trending icons', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      stockPrices: {
        'AAPL': {
          symbol: 'AAPL',
          price: 175.43,
          change: 2.10,
          changePercent: 1.21,
          volume: 52000000,
          marketCap: 2700000000000,
          timestamp: new Date().toISOString(),
          high52Week: 198.23,
          low52Week: 143.90,
          avgVolume: 50000000
        }
      },
      watchlists: [{
        id: 'default',
        name: 'My Watchlist',
        symbols: ['AAPL'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      selectedWatchlist: 'default',
      connectionStatus: 'connected'
    })

    const { container } = render(<LiveWatchlist />)

    const svgElements = container.querySelectorAll('svg')
    expect(svgElements.length).toBeGreaterThan(0)
  })
})
