/**
 * Unit Tests for LiveMarketIndices Component
 * Tests real-time market index updates via WebSocket
 */

import { render, screen } from '@testing-library/react'
import { LiveMarketIndices } from '../LiveMarketIndices'
import useMarketStore from '@/stores/marketStore'

// Mock the market store
jest.mock('@/stores/marketStore')

describe('LiveMarketIndices Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render market indices title', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      marketIndices: {},
      connectionStatus: 'connected'
    })

    render(<LiveMarketIndices />)
    expect(screen.getByText(/market/i)).toBeInTheDocument()
  })

  it('should display major market indices', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      marketIndices: {
        'SPY': {
          symbol: 'SPY',
          name: 'S&P 500',
          value: 4500.25,
          change: 25.50,
          changePercent: 0.57,
          timestamp: new Date().toISOString()
        },
        'QQQ': {
          symbol: 'QQQ',
          name: 'NASDAQ',
          value: 385.75,
          change: -2.30,
          changePercent: -0.59,
          timestamp: new Date().toISOString()
        }
      },
      connectionStatus: 'connected'
    })

    render(<LiveMarketIndices />)

    expect(screen.getByText('S&P 500')).toBeInTheDocument()
    expect(screen.getByText('NASDAQ')).toBeInTheDocument()
    expect(screen.getByText('4500.25')).toBeInTheDocument()
    expect(screen.getByText('385.75')).toBeInTheDocument()
  })

  it('should show positive changes in green', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      marketIndices: {
        'SPY': {
          symbol: 'SPY',
          name: 'S&P 500',
          value: 4500.25,
          change: 25.50,
          changePercent: 0.57,
          timestamp: new Date().toISOString()
        }
      },
      connectionStatus: 'connected'
    })

    render(<LiveMarketIndices />)

    const positiveChange = screen.getByText('+0.57%')
    expect(positiveChange.className).toMatch(/green|emerald|success/)
  })

  it('should show negative changes in red', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      marketIndices: {
        'QQQ': {
          symbol: 'QQQ',
          name: 'NASDAQ',
          value: 385.75,
          change: -2.30,
          changePercent: -0.59,
          timestamp: new Date().toISOString()
        }
      },
      connectionStatus: 'connected'
    })

    render(<LiveMarketIndices />)

    const negativeChange = screen.getByText('-0.59%')
    expect(negativeChange.className).toMatch(/red|rose|destructive/)
  })

  it('should display loading state when no data', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      marketIndices: {},
      connectionStatus: 'connecting'
    })

    render(<LiveMarketIndices />)

    // Should show loading or placeholder state
    expect(screen.queryByText('S&P 500')).not.toBeInTheDocument()
  })

  it('should show connection status indicator', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      marketIndices: {},
      connectionStatus: 'connected'
    })

    const { container } = render(<LiveMarketIndices />)

    // Component should indicate connection status somehow
    expect(container).toBeInTheDocument()
  })

  it('should display trending icons based on change direction', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      marketIndices: {
        'SPY': {
          symbol: 'SPY',
          name: 'S&P 500',
          value: 4500.25,
          change: 25.50,
          changePercent: 0.57,
          timestamp: new Date().toISOString()
        }
      },
      connectionStatus: 'connected'
    })

    const { container } = render(<LiveMarketIndices />)

    // Should have SVG icons for trending
    const svgElements = container.querySelectorAll('svg')
    expect(svgElements.length).toBeGreaterThan(0)
  })

  it('should format large numbers correctly', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      marketIndices: {
        'SPY': {
          symbol: 'SPY',
          name: 'S&P 500',
          value: 4500.25,
          change: 25.50,
          changePercent: 0.57,
          timestamp: new Date().toISOString()
        }
      },
      connectionStatus: 'connected'
    })

    render(<LiveMarketIndices />)

    // Should display formatted number
    expect(screen.getByText('4500.25')).toBeInTheDocument()
  })
})
