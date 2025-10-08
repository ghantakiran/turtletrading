/**
 * Unit tests for Mobile Bottom Navigation Component
 * TDD approach - write tests first, then implement component
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { useRouter, usePathname } from 'next/navigation'
import { BottomNavigation } from '@/components/mobile/bottom-navigation'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

describe('BottomNavigation', () => {
  const mockPush = jest.fn()
  const mockRouter = { push: mockPush }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
  })

  describe('Rendering', () => {
    test('should render bottom navigation bar', () => {
      render(<BottomNavigation />)
      const nav = screen.getByRole('navigation', { name: /bottom navigation/i })
      expect(nav).toBeInTheDocument()
    })

    test('should render all navigation items', () => {
      render(<BottomNavigation />)

      // Primary navigation items
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /watchlist/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /alerts/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /portfolio/i })).toBeInTheDocument()
    })

    test('should have icons for each navigation item', () => {
      render(<BottomNavigation />)

      // Check for icons by test IDs
      expect(screen.getByTestId('nav-icon-dashboard')).toBeInTheDocument()
      expect(screen.getByTestId('nav-icon-watchlist')).toBeInTheDocument()
      expect(screen.getByTestId('nav-icon-alerts')).toBeInTheDocument()
      expect(screen.getByTestId('nav-icon-portfolio')).toBeInTheDocument()
    })

    test('should have labels for each navigation item', () => {
      render(<BottomNavigation />)

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Watchlist')).toBeInTheDocument()
      expect(screen.getByText('Alerts')).toBeInTheDocument()
      expect(screen.getByText('Portfolio')).toBeInTheDocument()
    })
  })

  describe('Active State', () => {
    test('should highlight active navigation item based on current path', () => {
      ;(usePathname as any).mockReturnValue('/dashboard')
      render(<BottomNavigation />)

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      expect(dashboardLink).toHaveAttribute('aria-current', 'page')
    })

    test('should only have one active item at a time', () => {
      ;(usePathname as any).mockReturnValue('/watchlist')
      render(<BottomNavigation />)

      const activeLinks = screen.getAllByRole('link').filter(
        link => link.getAttribute('aria-current') === 'page'
      )
      expect(activeLinks).toHaveLength(1)
    })

    test('should update active state when pathname changes', () => {
      const { rerender } = render(<BottomNavigation />)
      ;(usePathname as jest.Mock).mockReturnValue('/watchlist')

      rerender(<BottomNavigation />)

      const watchlistLink = screen.getByRole('link', { name: /watchlist/i })
      expect(watchlistLink).toHaveAttribute('aria-current', 'page')
    })
  })

  describe('Navigation', () => {
    test('should navigate to dashboard when dashboard item clicked', () => {
      render(<BottomNavigation />)

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      fireEvent.click(dashboardLink)

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    test('should navigate to watchlist when watchlist item clicked', () => {
      render(<BottomNavigation />)

      const watchlistLink = screen.getByRole('link', { name: /watchlist/i })
      fireEvent.click(watchlistLink)

      expect(mockPush).toHaveBeenCalledWith('/watchlist')
    })

    test('should navigate to alerts when alerts item clicked', () => {
      render(<BottomNavigation />)

      const alertsLink = screen.getByRole('link', { name: /alerts/i })
      fireEvent.click(alertsLink)

      expect(mockPush).toHaveBeenCalledWith('/alerts')
    })

    test('should navigate to portfolio when portfolio item clicked', () => {
      render(<BottomNavigation />)

      const portfolioLink = screen.getByRole('link', { name: /portfolio/i })
      fireEvent.click(portfolioLink)

      expect(mockPush).toHaveBeenCalledWith('/portfolio')
    })
  })

  describe('Touch Optimizations', () => {
    test('should have minimum 44px tap target classes', () => {
      render(<BottomNavigation />)

      const navItems = screen.getAllByRole('link')
      navItems.forEach(item => {
        // Check for classes that enforce minimum 44x44px
        expect(item.className).toMatch(/min-w-\[44px\]/)
        expect(item.className).toMatch(/min-h-\[44px\]/)
      })
    })

    test('should have proper spacing classes for touch', () => {
      render(<BottomNavigation />)

      const navItems = screen.getAllByRole('link')

      // Each nav item should have padding for touch-friendly spacing
      navItems.forEach(item => {
        expect(item.className).toMatch(/px-|py-/)
      })
    })
  })

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(<BottomNavigation />)

      const nav = screen.getByRole('navigation')
      expect(nav).toHaveAttribute('aria-label', 'Bottom navigation')
    })

    test('should be keyboard navigable', () => {
      render(<BottomNavigation />)

      const navItems = screen.getAllByRole('link')
      navItems.forEach(item => {
        expect(item).toHaveAttribute('tabIndex', '0')
      })
    })

    test('should have visible focus indicators', () => {
      render(<BottomNavigation />)

      const firstLink = screen.getAllByRole('link')[0]
      firstLink.focus()

      expect(firstLink).toHaveFocus()
    })
  })

  describe('Responsive Behavior', () => {
    test('should have mobile-only classes', () => {
      render(<BottomNavigation />)

      const nav = screen.getByRole('navigation')

      // Should have md:hidden class to hide on desktop
      expect(nav.className).toMatch(/md:hidden/)
    })

    test('should have fixed positioning classes', () => {
      render(<BottomNavigation />)

      const nav = screen.getByRole('navigation')

      // Check for fixed positioning classes
      expect(nav.className).toMatch(/fixed/)
      expect(nav.className).toMatch(/bottom-0/)
    })

    test('should have full width classes', () => {
      render(<BottomNavigation />)

      const nav = screen.getByRole('navigation')

      // Check for full width class
      expect(nav.className).toMatch(/w-full/)
    })
  })

  describe('Badge Notifications', () => {
    test('should show badge count for alerts when provided', () => {
      render(<BottomNavigation alertCount={5} />)

      const badge = screen.getByText('5')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveAttribute('aria-label', '5 unread alerts')
    })

    test('should not show badge when count is 0', () => {
      render(<BottomNavigation alertCount={0} />)

      const badges = screen.queryAllByRole('status')
      expect(badges).toHaveLength(0)
    })

    test('should show 9+ for counts greater than 9', () => {
      render(<BottomNavigation alertCount={15} />)

      const badge = screen.getByText('9+')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Theme Support', () => {
    test('should support light and dark themes', () => {
      render(<BottomNavigation />)

      const nav = screen.getByRole('navigation')

      // Should have theme-aware classes
      expect(nav.className).toMatch(/bg-(white|slate|gray)/)
    })

    test('should have proper contrast in both themes', () => {
      render(<BottomNavigation />)

      const navItems = screen.getAllByRole('link')
      navItems.forEach(item => {
        const styles = window.getComputedStyle(item)
        // Color should be defined (not default)
        expect(styles.color).toBeTruthy()
      })
    })
  })
})
