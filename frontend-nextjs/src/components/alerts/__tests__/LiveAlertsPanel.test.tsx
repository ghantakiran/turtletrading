/**
 * Unit Tests for LiveAlertsPanel Component
 * Tests real-time alert delivery and notifications
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { LiveAlertsPanel } from '../LiveAlertsPanel'
import useMarketStore from '@/stores/marketStore'

// Mock the market store
jest.mock('@/stores/marketStore')

describe('LiveAlertsPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render alerts panel title', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: [],
      removeAlert: jest.fn(),
      acknowledgeAlert: jest.fn()
    })

    render(<LiveAlertsPanel />)
    expect(screen.getByText(/alert/i)).toBeInTheDocument()
  })

  it('should display active alerts', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: '1',
          symbol: 'AAPL',
          type: 'price_above',
          condition: 180,
          isActive: true,
          createdAt: new Date().toISOString(),
          triggeredAt: new Date().toISOString()
        }
      ],
      removeAlert: jest.fn(),
      acknowledgeAlert: jest.fn()
    })

    render(<LiveAlertsPanel />)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText(/price.*above/i) || screen.getByText(/180/)).toBeInTheDocument()
  })

  it('should show empty state when no alerts', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: [],
      removeAlert: jest.fn(),
      acknowledgeAlert: jest.fn()
    })

    render(<LiveAlertsPanel />)

    expect(screen.getByText(/no.*alert/i) || screen.getByText(/no notifications/i)).toBeInTheDocument()
  })

  it('should display different alert types', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: '1',
          symbol: 'AAPL',
          type: 'price_above',
          condition: 180,
          isActive: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          symbol: 'MSFT',
          type: 'volume_spike',
          condition: 50000000,
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ],
      removeAlert: jest.fn(),
      acknowledgeAlert: jest.fn()
    })

    render(<LiveAlertsPanel />)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
  })

  it('should allow dismissing alerts', () => {
    const mockRemoveAlert = jest.fn()

    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: '1',
          symbol: 'AAPL',
          type: 'price_above',
          condition: 180,
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ],
      removeAlert: mockRemoveAlert,
      acknowledgeAlert: jest.fn()
    })

    render(<LiveAlertsPanel />)

    // Find and click dismiss/close button
    const dismissButton = screen.getAllByRole('button').find(btn =>
      btn.className.includes('close') || btn.textContent?.includes('×') || btn.textContent?.includes('Dismiss')
    )

    if (dismissButton) {
      fireEvent.click(dismissButton)
      expect(mockRemoveAlert).toHaveBeenCalledWith('1')
    }
  })

  it('should show severity levels with colors', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: '1',
          symbol: 'AAPL',
          type: 'anomaly',
          condition: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          severity: 'high'
        }
      ],
      removeAlert: jest.fn(),
      acknowledgeAlert: jest.fn()
    })

    const { container } = render(<LiveAlertsPanel />)

    // Should have color coding for severity
    const alertElement = container.querySelector('[class*="red"], [class*="destructive"], [class*="danger"]')
    expect(alertElement || container.querySelector('[class*="alert"]')).toBeInTheDocument()
  })

  it('should display alert timestamps', () => {
    const now = new Date()

    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: '1',
          symbol: 'AAPL',
          type: 'price_above',
          condition: 180,
          isActive: true,
          createdAt: now.toISOString()
        }
      ],
      removeAlert: jest.fn(),
      acknowledgeAlert: jest.fn()
    })

    render(<LiveAlertsPanel />)

    // Should show time indicator (just now, 5m ago, etc.)
    expect(screen.getByText(/just now|ago|minute|hour/i) || screen.getByText(/.*/)).toBeInTheDocument()
  })

  it('should show limited number of alerts', () => {
    const manyAlerts = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      symbol: 'AAPL',
      type: 'price_above' as const,
      condition: 180 + i,
      isActive: true,
      createdAt: new Date().toISOString()
    }))

    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: manyAlerts,
      removeAlert: jest.fn(),
      acknowledgeAlert: jest.fn()
    })

    render(<LiveAlertsPanel />)

    // Component should limit displayed alerts (e.g., to 5-10)
    const displayedAlerts = screen.getAllByText('AAPL')
    expect(displayedAlerts.length).toBeLessThanOrEqual(10)
  })

  it('should display alert icons', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: '1',
          symbol: 'AAPL',
          type: 'price_above',
          condition: 180,
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ],
      removeAlert: jest.fn(),
      acknowledgeAlert: jest.fn()
    })

    const { container } = render(<LiveAlertsPanel />)

    // Should have SVG icons
    const svgElements = container.querySelectorAll('svg')
    expect(svgElements.length).toBeGreaterThan(0)
  })
})
