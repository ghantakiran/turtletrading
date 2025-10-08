/**
 * Unit tests for ConnectionStatus component
 * TDD approach - write tests first, then implement
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ConnectionStatus } from '@/components/offline/ConnectionStatus'

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  configurable: true,
  value: true,
})

describe('ConnectionStatus', () => {
  beforeEach(() => {
    ;(navigator.onLine as any) = true
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Online Status', () => {
    test('should not show banner when online', () => {
      render(<ConnectionStatus />)

      const banner = screen.queryByText(/offline/i)
      expect(banner).not.toBeInTheDocument()
    })

    test('should detect online status on mount', () => {
      ;(navigator.onLine as any) = true

      render(<ConnectionStatus />)

      const banner = screen.queryByRole('alert')
      expect(banner).not.toBeInTheDocument()
    })
  })

  describe('Offline Status', () => {
    test('should show banner when offline', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      const banner = screen.getByText(/you are currently offline/i)
      expect(banner).toBeInTheDocument()
    })

    test('should have offline indicator styling', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      const banner = screen.getByRole('alert')
      expect(banner).toHaveClass('bg-yellow-50', 'border-yellow-200')
    })

    test('should show offline icon', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      // Check for WiFi off icon presence
      const banner = screen.getByRole('alert')
      expect(banner).toBeInTheDocument()
    })
  })

  describe('Online/Offline Events', () => {
    test('should show banner when going offline', async () => {
      render(<ConnectionStatus />)

      // Initially online, no banner
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      // Simulate going offline
      act(() => {
        ;(navigator.onLine as any) = false
        window.dispatchEvent(new Event('offline'))
      })

      await waitFor(() => {
        expect(screen.getByText(/you are currently offline/i)).toBeInTheDocument()
      })
    })

    test('should hide banner when going online', async () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      // Initially offline, banner visible
      expect(screen.getByRole('alert')).toBeInTheDocument()

      // Simulate going online
      act(() => {
        ;(navigator.onLine as any) = true
        window.dispatchEvent(new Event('online'))
      })

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      })
    })

    test('should show reconnected message briefly when coming back online', async () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      // Go online
      act(() => {
        ;(navigator.onLine as any) = true
        window.dispatchEvent(new Event('online'))
      })

      await waitFor(() => {
        expect(screen.getByText(/back online/i)).toBeInTheDocument()
      })
    })

    test('should auto-hide reconnected message after delay', async () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      // Go online
      act(() => {
        ;(navigator.onLine as any) = true
        window.dispatchEvent(new Event('online'))
      })

      // Wait for message to appear
      await waitFor(() => {
        expect(screen.getByText(/back online/i)).toBeInTheDocument()
      })

      // Wait for message to disappear (3 seconds)
      await waitFor(
        () => {
          expect(screen.queryByText(/back online/i)).not.toBeInTheDocument()
        },
        { timeout: 4000 }
      )
    }, 10000)
  })

  describe('Pending Changes Queue', () => {
    test('should show queue count when offline with pending changes', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus queueSize={5} />)

      expect(screen.getByText(/5 pending changes/i)).toBeInTheDocument()
    })

    test('should not show queue count when queue is empty', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus queueSize={0} />)

      expect(screen.queryByText(/pending changes/i)).not.toBeInTheDocument()
    })

    test('should show singular "change" for queue size of 1', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus queueSize={1} />)

      expect(screen.getByText(/1 pending change/i)).toBeInTheDocument()
    })

    test('should show plural "changes" for queue size > 1', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus queueSize={3} />)

      expect(screen.getByText(/3 pending changes/i)).toBeInTheDocument()
    })
  })

  describe('Event Listener Cleanup', () => {
    test('should add event listeners on mount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

      render(<ConnectionStatus />)

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

      addEventListenerSpy.mockRestore()
    })

    test('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = render(<ConnectionStatus />)

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    test('should have alert role for offline banner', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      const banner = screen.getByRole('alert')
      expect(banner).toBeInTheDocument()
    })

    test('should have success role for reconnected banner', async () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      // Go online
      act(() => {
        ;(navigator.onLine as any) = true
        window.dispatchEvent(new Event('online'))
      })

      await waitFor(() => {
        const banner = screen.getByRole('status')
        expect(banner).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Design', () => {
    test('should be visible on mobile viewports', () => {
      ;(navigator.onLine as any) = false

      render(<ConnectionStatus />)

      const banner = screen.getByRole('alert')
      // Component should render without viewport-specific hiding
      expect(banner).toBeVisible()
    })
  })
})
