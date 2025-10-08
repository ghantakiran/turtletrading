/**
 * Unit tests for NotificationPreferences Component
 * TDD approach - write tests first, then implement component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationPreferences } from '@/components/notifications/preferences'

describe('NotificationPreferences', () => {
  const mockPreferences = {
    priceAlerts: true,
    newsAlerts: false,
    aiSignals: true,
    portfolioUpdates: false,
  }

  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('should render preferences component', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText(/notification preferences/i)).toBeInTheDocument()
    })

    test('should show all preference options', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByLabelText(/price alerts/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/news alerts/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/ai signals/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/portfolio updates/i)).toBeInTheDocument()
    })

    test('should show descriptions for each preference', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText(/when stocks reach target prices/i)).toBeInTheDocument()
      expect(screen.getByText(/breaking news/i)).toBeInTheDocument()
      expect(screen.getByText(/lstm predictions/i)).toBeInTheDocument()
      expect(screen.getByText(/daily performance/i)).toBeInTheDocument()
    })
  })

  describe('Switch State', () => {
    test('should reflect current preference values', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      const priceAlertsSwitch = screen.getByLabelText(/price alerts/i)
      const newsAlertsSwitch = screen.getByLabelText(/news alerts/i)

      expect(priceAlertsSwitch).toBeChecked()
      expect(newsAlertsSwitch).not.toBeChecked()
    })

    test('should update switch states when preferences change', () => {
      const { rerender } = render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      const updatedPreferences = { ...mockPreferences, newsAlerts: true }

      rerender(
        <NotificationPreferences
          preferences={updatedPreferences}
          onChange={mockOnChange}
        />
      )

      const newsAlertsSwitch = screen.getByLabelText(/news alerts/i)
      expect(newsAlertsSwitch).toBeChecked()
    })
  })

  describe('Toggle Behavior', () => {
    test('should call onChange when preference toggled', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      const newsAlertsSwitch = screen.getByLabelText(/news alerts/i)
      fireEvent.click(newsAlertsSwitch)

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockPreferences,
        newsAlerts: true,
      })
    })

    test('should toggle multiple preferences independently', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      const newsAlertsSwitch = screen.getByLabelText(/news alerts/i)
      const portfolioSwitch = screen.getByLabelText(/portfolio updates/i)

      fireEvent.click(newsAlertsSwitch)
      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockPreferences,
        newsAlerts: true,
      })

      fireEvent.click(portfolioSwitch)
      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockPreferences,
        portfolioUpdates: true,
      })
    })

    test('should handle rapid toggling', async () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      const priceAlertsSwitch = screen.getByLabelText(/price alerts/i)

      fireEvent.click(priceAlertsSwitch)
      fireEvent.click(priceAlertsSwitch)
      fireEvent.click(priceAlertsSwitch)

      expect(mockOnChange).toHaveBeenCalledTimes(3)
    })
  })

  describe('Master Toggle', () => {
    test('should show master toggle for all notifications', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByLabelText(/enable all notifications/i)).toBeInTheDocument()
    })

    test('should enable all when master toggle turned on', () => {
      const allOffPreferences = {
        priceAlerts: false,
        newsAlerts: false,
        aiSignals: false,
        portfolioUpdates: false,
      }

      render(
        <NotificationPreferences
          preferences={allOffPreferences}
          onChange={mockOnChange}
        />
      )

      const masterToggle = screen.getByLabelText(/enable all notifications/i)
      fireEvent.click(masterToggle)

      expect(mockOnChange).toHaveBeenCalledWith({
        priceAlerts: true,
        newsAlerts: true,
        aiSignals: true,
        portfolioUpdates: true,
      })
    })

    test('should disable all when master toggle turned off', () => {
      const allOnPreferences = {
        priceAlerts: true,
        newsAlerts: true,
        aiSignals: true,
        portfolioUpdates: true,
      }

      render(
        <NotificationPreferences
          preferences={allOnPreferences}
          onChange={mockOnChange}
        />
      )

      const masterToggle = screen.getByLabelText(/enable all notifications/i)
      fireEvent.click(masterToggle)

      expect(mockOnChange).toHaveBeenCalledWith({
        priceAlerts: false,
        newsAlerts: false,
        aiSignals: false,
        portfolioUpdates: false,
      })
    })
  })

  describe('Disabled State', () => {
    test('should disable all switches when disabled prop is true', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
          disabled={true}
        />
      )

      const switches = screen.getAllByRole('checkbox')
      switches.forEach(switchElement => {
        expect(switchElement).toBeDisabled()
      })
    })

    test('should not call onChange when disabled', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
          disabled={true}
        />
      )

      const priceAlertsSwitch = screen.getByLabelText(/price alerts/i)
      fireEvent.click(priceAlertsSwitch)

      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    test('should have proper labels for screen readers', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      const switches = screen.getAllByRole('checkbox')
      switches.forEach(switchElement => {
        expect(switchElement).toHaveAccessibleName()
      })
    })

    test('should be keyboard navigable', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      const priceAlertsSwitch = screen.getByLabelText(/price alerts/i)
      priceAlertsSwitch.focus()

      expect(priceAlertsSwitch).toHaveFocus()
    })
  })

  describe('Visual Indicators', () => {
    test('should show icons for each preference type', () => {
      render(
        <NotificationPreferences
          preferences={mockPreferences}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByTestId('price-icon')).toBeInTheDocument()
      expect(screen.getByTestId('news-icon')).toBeInTheDocument()
      expect(screen.getByTestId('ai-icon')).toBeInTheDocument()
      expect(screen.getByTestId('portfolio-icon')).toBeInTheDocument()
    })
  })
})
