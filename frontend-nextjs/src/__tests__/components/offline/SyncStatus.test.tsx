/**
 * Unit tests for SyncStatus component
 * TDD approach - write tests first, then implement
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SyncStatus } from '@/components/offline/SyncStatus'
import { useOfflineSync } from '@/lib/hooks/useOfflineSync'

// Mock useOfflineSync hook
jest.mock('@/lib/hooks/useOfflineSync')

const mockUseOfflineSync = useOfflineSync as jest.MockedFunction<typeof useOfflineSync>

describe('SyncStatus', () => {
  beforeEach(() => {
    mockUseOfflineSync.mockReturnValue({
      queue: {} as any,
      isOnline: true,
      queueSize: 0,
      enqueue: jest.fn(),
      processQueue: jest.fn(),
      getQueueSize: jest.fn().mockResolvedValue(0),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('should render when online with empty queue', () => {
      render(<SyncStatus />)

      // Should show online status
      expect(screen.queryByText(/syncing/i)).not.toBeInTheDocument()
    })

    test('should show sync status when queue has items', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: true,
        queueSize: 3,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(3),
      })

      render(<SyncStatus />)

      expect(screen.getByText(/syncing/i)).toBeInTheDocument()
      expect(screen.getByText(/3/)).toBeInTheDocument()
    })

    test('should show offline status when offline', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 0,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(0),
      })

      render(<SyncStatus />)

      expect(screen.getByText(/offline/i)).toBeInTheDocument()
    })

    test('should show pending actions count when offline', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 5,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(5),
      })

      render(<SyncStatus />)

      expect(screen.getByText(/5.*pending/i)).toBeInTheDocument()
    })
  })

  describe('Manual Sync', () => {
    test('should show manual sync button when offline with pending actions', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 3,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(3),
      })

      render(<SyncStatus />)

      expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument()
    })

    test('should call processQueue when sync button clicked', async () => {
      const mockProcessQueue = jest.fn().mockResolvedValue(undefined)

      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 3,
        enqueue: jest.fn(),
        processQueue: mockProcessQueue,
        getQueueSize: jest.fn().mockResolvedValue(3),
      })

      render(<SyncStatus />)

      const syncButton = screen.getByRole('button', { name: /sync now/i })
      fireEvent.click(syncButton)

      await waitFor(() => {
        expect(mockProcessQueue).toHaveBeenCalled()
      })
    })

    test('should not show sync button when online', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: true,
        queueSize: 3,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(3),
      })

      render(<SyncStatus />)

      expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument()
    })
  })

  describe('Visual States', () => {
    test('should show success icon when syncing complete', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: true,
        queueSize: 0,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(0),
      })

      render(<SyncStatus />)

      // Component should be minimal or hidden when everything is synced
      expect(screen.queryByText(/syncing/i)).not.toBeInTheDocument()
    })

    test('should show spinner when syncing', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: true,
        queueSize: 5,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(5),
      })

      render(<SyncStatus />)

      expect(screen.getByText(/syncing/i)).toBeInTheDocument()
    })

    test('should show warning icon when offline', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 0,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(0),
      })

      render(<SyncStatus />)

      expect(screen.getByText(/offline/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should have aria-live for status updates when visible', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 3,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(3),
      })

      const { container } = render(<SyncStatus />)

      const liveRegion = container.querySelector('[aria-live]')
      expect(liveRegion).toBeInTheDocument()
    })

    test('should have descriptive button labels', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 3,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(3),
      })

      render(<SyncStatus />)

      const button = screen.getByRole('button')
      expect(button).toHaveAccessibleName()
    })
  })

  describe('Dismissible', () => {
    test('should be dismissible when provided', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 3,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(3),
      })

      render(<SyncStatus dismissible />)

      const closeButton = screen.queryByRole('button', { name: /close|dismiss/i })
      expect(closeButton).toBeInTheDocument()
    })

    test('should hide when dismissed', () => {
      mockUseOfflineSync.mockReturnValue({
        queue: {} as any,
        isOnline: false,
        queueSize: 3,
        enqueue: jest.fn(),
        processQueue: jest.fn(),
        getQueueSize: jest.fn().mockResolvedValue(3),
      })

      render(<SyncStatus dismissible />)

      const closeButton = screen.getByRole('button', { name: /close|dismiss/i })
      fireEvent.click(closeButton)

      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
    })
  })
})
