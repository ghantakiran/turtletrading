/**
 * Unit tests for NotificationPermissionPrompt Component
 * TDD approach - write tests first, then implement component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationPermissionPrompt } from '@/components/notifications/permission-prompt'

// Mock the notification manager
jest.mock('@/lib/notifications/permission-manager', () => ({
  notificationManager: {
    isSupported: jest.fn(() => true),
    requestPermission: jest.fn(),
    subscribe: jest.fn(),
  },
}))

describe('NotificationPermissionPrompt', () => {
  const mockOnGranted = jest.fn()
  const mockOnDenied = jest.fn()
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('should render permission prompt dialog', () => {
      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getAllByText(/enable notifications/i).length).toBeGreaterThan(0)
    })

    test('should not render when open is false', () => {
      render(
        <NotificationPermissionPrompt
          open={false}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('should show notification icon', () => {
      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      expect(screen.getByTestId('notification-icon')).toBeInTheDocument()
    })

    test('should show benefits list', () => {
      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      expect(screen.getByText(/price alerts/i)).toBeInTheDocument()
      expect(screen.getByText(/market updates/i)).toBeInTheDocument()
      expect(screen.getByText(/ai signals/i)).toBeInTheDocument()
    })

    test('should show enable and maybe later buttons', () => {
      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /maybe later/i })).toBeInTheDocument()
    })
  })

  describe('Permission Request', () => {
    test('should request permission when enable button clicked', async () => {
      const { notificationManager } = require('@/lib/notifications/permission-manager')
      notificationManager.requestPermission.mockResolvedValue('granted')
      notificationManager.subscribe.mockResolvedValue({ endpoint: 'test' })

      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      const enableButton = screen.getByRole('button', { name: /enable/i })
      fireEvent.click(enableButton)

      await waitFor(() => {
        expect(notificationManager.requestPermission).toHaveBeenCalled()
      })
    })

    test('should call onPermissionGranted when permission granted', async () => {
      const { notificationManager } = require('@/lib/notifications/permission-manager')
      notificationManager.requestPermission.mockResolvedValue('granted')
      notificationManager.subscribe.mockResolvedValue({ endpoint: 'test' })

      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      const enableButton = screen.getByRole('button', { name: /enable/i })
      fireEvent.click(enableButton)

      await waitFor(() => {
        expect(mockOnGranted).toHaveBeenCalled()
      })
    })

    test('should call onPermissionDenied when permission denied', async () => {
      const { notificationManager } = require('@/lib/notifications/permission-manager')
      notificationManager.requestPermission.mockResolvedValue('denied')

      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      const enableButton = screen.getByRole('button', { name: /enable/i })
      fireEvent.click(enableButton)

      await waitFor(() => {
        expect(mockOnDenied).toHaveBeenCalled()
      })
    })

    test('should handle permission request errors', async () => {
      const { notificationManager } = require('@/lib/notifications/permission-manager')
      notificationManager.requestPermission.mockRejectedValue(new Error('Permission error'))

      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      const enableButton = screen.getByRole('button', { name: /enable/i })
      fireEvent.click(enableButton)

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Close Behavior', () => {
    test('should close when maybe later clicked', () => {
      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
          onClose={mockOnClose}
        />
      )

      const maybeLaterButton = screen.getByRole('button', { name: /maybe later/i })
      fireEvent.click(maybeLaterButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    test('should close when X button clicked', () => {
      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
          onClose={mockOnClose}
        />
      )

      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    test('should show loading state during permission request', async () => {
      const { notificationManager } = require('@/lib/notifications/permission-manager')
      notificationManager.requestPermission.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('granted'), 100))
      )

      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      const enableButton = screen.getByRole('button', { name: /enable/i })
      fireEvent.click(enableButton)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(enableButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby')
      expect(dialog).toHaveAttribute('aria-describedby')
    })

    test('should be keyboard navigable', () => {
      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      const enableButton = screen.getByRole('button', { name: /enable/i })
      const maybeLaterButton = screen.getByRole('button', { name: /maybe later/i })

      expect(enableButton).toHaveAttribute('tabIndex')
      expect(maybeLaterButton).toHaveAttribute('tabIndex')
    })
  })

  describe('Unsupported Browser', () => {
    test('should show unsupported message when notifications not supported', () => {
      const { notificationManager } = require('@/lib/notifications/permission-manager')
      notificationManager.isSupported.mockReturnValue(false)

      render(
        <NotificationPermissionPrompt
          open={true}
          onPermissionGranted={mockOnGranted}
          onPermissionDenied={mockOnDenied}
        />
      )

      expect(screen.getByText(/not supported/i)).toBeInTheDocument()
    })
  })
})
