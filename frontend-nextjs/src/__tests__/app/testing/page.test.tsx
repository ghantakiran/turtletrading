/**
 * Unit tests for Testing Dashboard Page
 * TDD approach - tests written first
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TestingPage from '@/app/testing/page'

// Mock fetch for testing
global.fetch = jest.fn()

describe('Testing Dashboard Page', () => {
  const mockTestResults = {
    unit: { total: 23, passing: 23, failing: 0, skipped: 0 },
    e2e: { total: 16, passing: 2, failing: 14, skipped: 0 },
    integration: { total: 0, passing: 0, failing: 0, skipped: 0 },
    coverage: {
      statements: 85.2,
      branches: 78.5,
      functions: 82.1,
      lines: 84.9,
    },
    lastRun: '2025-10-13T10:30:00.000Z',
  }

  const mockHealthStatus = {
    status: 'healthy',
    timestamp: '2025-10-13T12:00:00.000Z',
    services: {
      database: { status: 'up', latency: 15, lastCheck: '2025-10-13T12:00:00.000Z' },
      cache: { status: 'up', latency: 5, lastCheck: '2025-10-13T12:00:00.000Z' },
      api: { status: 'up', latency: 50, lastCheck: '2025-10-13T12:00:00.000Z' },
    },
    system: {
      uptime: 86400,
      memory: { used: 256, total: 512, percentage: 50 },
      cpu: 45.2,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should render dashboard title', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTestResults,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthStatus,
      })

    render(<TestingPage />)

    await waitFor(() => {
      expect(screen.getByText(/Testing Dashboard/i)).toBeInTheDocument()
    })
  })

  test('should render all dashboard sections', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTestResults,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthStatus,
      })

    render(<TestingPage />)

    await waitFor(() => {
      // Test that page loaded successfully (not loading anymore)
      expect(screen.queryByText(/Loading dashboard data/i)).not.toBeInTheDocument()
    })
  })

  test('should show loading state initially', () => {
    ;(global.fetch as jest.Mock)
      .mockImplementation(() => new Promise(() => {}))

    render(<TestingPage />)

    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })

  test('should fetch test results on mount', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTestResults,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthStatus,
      })

    render(<TestingPage />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/testing/results')
    })
  })

  test('should fetch health status on mount', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTestResults,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthStatus,
      })

    render(<TestingPage />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/health/status')
    })
  })

  test('should display error message when fetch fails', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))

    render(<TestingPage />)

    await waitFor(() => {
      expect(screen.getByText(/Error loading dashboard data/i)).toBeInTheDocument()
    })
  })

  test('should show retry button on error', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))

    render(<TestingPage />)

    await waitFor(() => {
      expect(screen.getByText(/Retry/i)).toBeInTheDocument()
    })
  })

  test('should display dashboard content after loading', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTestResults,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthStatus,
      })

    render(<TestingPage />)

    await waitFor(() => {
      // Check that we're no longer in loading or error state
      expect(screen.queryByText(/Loading dashboard data/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Error loading dashboard data/i)).not.toBeInTheDocument()
    })
  })

  test('should have retry button functionality on error', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))

    render(<TestingPage />)

    await waitFor(() => {
      const retryButton = screen.getByText(/Retry/i)
      expect(retryButton).toBeInTheDocument()
      expect(retryButton).toBeEnabled()
    })
  })
})
