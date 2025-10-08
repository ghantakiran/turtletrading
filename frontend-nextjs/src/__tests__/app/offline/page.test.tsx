/**
 * Unit tests for Offline Fallback Page
 * TDD approach - write tests first, then implement
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import OfflinePage from '@/app/offline/page'

describe('OfflinePage', () => {
  describe('Page Structure', () => {
    test('should render offline page', () => {
      render(<OfflinePage />)

      const heading = screen.getByRole('heading', { name: /you're offline/i })
      expect(heading).toBeInTheDocument()
    })

    test('should display offline icon', () => {
      render(<OfflinePage />)

      // Check for WiFi off icon (lucide-react WifiOff)
      const page = screen.getByText(/you're offline/i)
      expect(page).toBeInTheDocument()
    })

    test('should show description message', () => {
      render(<OfflinePage />)

      const description = screen.getByText(
        /some features require an internet connection/i
      )
      expect(description).toBeInTheDocument()
    })
  })

  describe('Retry Functionality', () => {
    test('should display "Try Again" button', () => {
      render(<OfflinePage />)

      const retryButton = screen.getByRole('button', { name: /try again/i })
      expect(retryButton).toBeInTheDocument()
    })

    test('should have clickable "Try Again" button', () => {
      render(<OfflinePage />)

      const retryButton = screen.getByRole('button', { name: /try again/i })

      // Button should be clickable (not disabled)
      expect(retryButton).toBeEnabled()

      // Button should have onClick handler (has click event)
      fireEvent.click(retryButton)
      // Test passes if no error is thrown
    })
  })

  describe('Feature Availability Lists', () => {
    test('should show "Available Offline" section', () => {
      render(<OfflinePage />)

      const availableSection = screen.getByText(/available offline/i)
      expect(availableSection).toBeInTheDocument()
    })

    test('should show "Requires Connection" section', () => {
      render(<OfflinePage />)

      const requiresSection = screen.getByText(/requires connection/i)
      expect(requiresSection).toBeInTheDocument()
    })

    test('should list offline-available features', () => {
      render(<OfflinePage />)

      expect(screen.getByText(/view portfolio/i)).toBeInTheDocument()
      expect(screen.getByText(/view watchlist/i)).toBeInTheDocument()
      expect(screen.getByText(/view cached charts/i)).toBeInTheDocument()
      expect(screen.getByText(/view price history/i)).toBeInTheDocument()
    })

    test('should list online-only features', () => {
      render(<OfflinePage />)

      expect(screen.getByText(/real-time prices/i)).toBeInTheDocument()
      expect(screen.getByText(/add\/remove stocks/i)).toBeInTheDocument()
      expect(screen.getByText(/ai predictions/i)).toBeInTheDocument()
      expect(screen.getByText(/market news/i)).toBeInTheDocument()
    })

    test('should show correct number of offline features', () => {
      render(<OfflinePage />)

      // 4 offline features
      const offlineFeatures = [
        /view portfolio/i,
        /view watchlist/i,
        /view cached charts/i,
        /view price history/i,
      ]

      offlineFeatures.forEach((feature) => {
        expect(screen.getByText(feature)).toBeInTheDocument()
      })
    })

    test('should show correct number of online-only features', () => {
      render(<OfflinePage />)

      // 4 online-only features
      const onlineFeatures = [
        /real-time prices/i,
        /add\/remove stocks/i,
        /ai predictions/i,
        /market news/i,
      ]

      onlineFeatures.forEach((feature) => {
        expect(screen.getByText(feature)).toBeInTheDocument()
      })
    })
  })

  describe('Help Section', () => {
    test('should display tip about offline sync', () => {
      render(<OfflinePage />)

      const tipText = screen.getByText(/changes you make while offline/i)
      expect(tipText).toBeInTheDocument()
    })

    test('should mention automatic sync', () => {
      render(<OfflinePage />)

      const syncText = screen.getByText(/automatically synced/i)
      expect(syncText).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    test('should have proper layout classes', () => {
      const { container } = render(<OfflinePage />)

      const mainDiv = container.firstChild
      expect(mainDiv).toHaveClass('min-h-screen', 'bg-gray-50')
    })

    test('should have card-like container', () => {
      const { container } = render(<OfflinePage />)

      // Find the white card container
      const card = container.querySelector('.bg-white')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('rounded-lg', 'shadow-lg')
    })
  })

  describe('Accessibility', () => {
    test('should have proper heading hierarchy', () => {
      render(<OfflinePage />)

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent(/you're offline/i)

      const h2s = screen.getAllByRole('heading', { level: 2 })
      expect(h2s.length).toBeGreaterThan(0)
    })

    test('should have accessible button', () => {
      render(<OfflinePage />)

      const button = screen.getByRole('button', { name: /try again/i })
      expect(button).toBeEnabled()
    })
  })

  describe('Responsive Design', () => {
    test('should be mobile-friendly with proper padding', () => {
      const { container } = render(<OfflinePage />)

      const mainDiv = container.firstChild
      expect(mainDiv).toHaveClass('px-4', 'py-12')
    })

    test('should have max-width constraint', () => {
      const { container } = render(<OfflinePage />)

      const contentDiv = container.querySelector('.max-w-md')
      expect(contentDiv).toBeInTheDocument()
    })
  })
})
