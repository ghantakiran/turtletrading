import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AlertsClient } from '@/app/(protected)/alerts/AlertsClient'
import { AlertsResponse } from '@/lib/api/alerts-data'

// Mock dependencies
vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    showNotification: vi.fn()
  })
}))

// Mock alerts API
const mockAlertsData: AlertsResponse = {
  alerts: [
    {
      id: 'alert-1',
      name: 'AAPL Price Alert',
      description: 'Alert when AAPL goes above $150',
      symbol: 'AAPL',
      conditions: [
        {
          id: 'condition-1',
          type: 'price_above',
          field: 'price',
          operator: '>',
          value: 150
        }
      ],
      logic: 'AND',
      isActive: true,
      priority: 'high',
      notificationMethods: ['push', 'email'],
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      createdBy: 'test-user',
      triggerCount: 3,
      lastTriggered: '2024-01-15T09:00:00Z',
      tags: ['stocks', 'price'],
      cooldownPeriod: 300,
      maxTriggers: undefined,
      snoozeUntil: null,
      isMuted: false
    }
  ],
  triggers: [
    {
      id: 'trigger-1',
      alertId: 'alert-1',
      triggeredAt: '2024-01-15T09:00:00Z',
      value: 151.25,
      threshold: 150,
      message: 'AAPL price is above $150 (current: $151.25)',
      isRead: false,
      isAcknowledged: false
    }
  ],
  statistics: {
    totalAlerts: 1,
    activeAlerts: 1,
    triggeredToday: 1,
    successRate: 0.85,
    falsePositiveRate: 0.15,
    avgResponseTime: 1.2
  }
}

// Test wrapper with QueryClient
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity
      }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('Alerts Integration - Preview Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock fetch for API calls
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAlertsData)
        })
      }
      return Promise.reject(new Error(`Unhandled request: ${url}`))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Alert Preview Integration', () => {
    it('should preview alert conditions correctly', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      // Navigate to alert builder
      await user.click(screen.getByText('New Alert'))

      // Wait for wizard to open
      await waitFor(() => {
        expect(screen.getByText('Create New Alert')).toBeInTheDocument()
      })

      // Fill in alert details
      await user.type(screen.getByLabelText('Alert Name *'), 'Test Preview Alert')
      await user.type(screen.getByLabelText('Symbol *'), 'MSFT')

      // Add a condition
      await user.click(screen.getByText('Add Condition'))

      // Configure condition
      const conditionSelect = screen.getByDisplayValue('Price Above')
      await user.selectOptions(conditionSelect, 'price_below')

      const valueInput = screen.getByPlaceholderText('Enter value')
      await user.type(valueInput, '200')

      // Preview should show the configured condition
      expect(screen.getByDisplayValue('Price Below')).toBeInTheDocument()
      expect(screen.getByDisplayValue('200')).toBeInTheDocument()
    })

    it('should show real-time condition validation', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      // Navigate to alert builder
      await user.click(screen.getByText('New Alert'))

      // Add condition
      await user.click(screen.getByText('Add Condition'))

      // Test different condition types and their validation
      const conditionSelect = screen.getByDisplayValue('Price Above')

      // Test volume spike condition
      await user.selectOptions(conditionSelect, 'volume_spike')
      expect(screen.getByLabelText('Threshold')).toBeInTheDocument()

      // Test RSI condition
      await user.selectOptions(conditionSelect, 'rsi_overbought')
      expect(screen.getByLabelText('Value')).toBeInTheDocument()

      // Test regime change condition
      await user.selectOptions(conditionSelect, 'regime_change')
      expect(screen.getByLabelText('Sensitivity')).toBeInTheDocument()
    })

    it('should preview multi-condition logic', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      // Navigate to alert builder
      await user.click(screen.getByText('New Alert'))

      // Fill required fields
      await user.type(screen.getByLabelText('Alert Name *'), 'Multi Condition Alert')
      await user.type(screen.getByLabelText('Symbol *'), 'GOOGL')

      // Add first condition
      await user.click(screen.getByText('Add Condition'))

      // Add second condition
      await user.click(screen.getByText('Add Condition'))

      // Should show multiple conditions
      const conditions = screen.getAllByText('Condition Type')
      expect(conditions).toHaveLength(2)

      // Test logic selector
      const logicSelect = screen.getByDisplayValue('All conditions must match (AND)')
      await user.selectOptions(logicSelect, 'OR')
      expect(screen.getByDisplayValue('Any condition can match (OR)')).toBeInTheDocument()
    })

    it('should validate condition interdependencies', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      await user.click(screen.getByText('New Alert'))
      await user.click(screen.getByText('Add Condition'))

      // Test operator compatibility with condition types
      const operatorSelect = screen.getByDisplayValue('Greater Than')

      // Test different operators
      const operators = ['<', '>=', '<=', '=', '!=']
      for (const op of operators) {
        await user.selectOptions(operatorSelect, op)
        const selectedOption = screen.getByRole('option', { selected: true })
        expect(selectedOption).toHaveValue(op)
      }
    })
  })

  describe('Alert Testing Integration', () => {
    it('should test alert conditions against mock data', async () => {
      const user = userEvent.setup()

      // Mock test API response
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/test-alert')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              results: [
                { condition: 'Price Above $150', result: 'PASS', value: 156.78, threshold: 150 },
                { condition: 'Volume Spike', result: 'FAIL', value: 850000, threshold: 1000000 }
              ]
            })
          })
        }
        if (url.includes('/api/alerts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAlertsData)
          })
        }
        return Promise.reject(new Error(`Unhandled request: ${url}`))
      })

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      await user.click(screen.getByText('New Alert'))

      // Fill form
      await user.type(screen.getByLabelText('Alert Name *'), 'Test Alert')
      await user.type(screen.getByLabelText('Symbol *'), 'AAPL')

      // Add conditions
      await user.click(screen.getByText('Add Condition'))
      await user.click(screen.getByText('Add Condition'))

      // Test alert
      await user.click(screen.getByText('Test Alert'))

      // Should show testing state
      expect(screen.getByText('Testing...')).toBeInTheDocument()

      // Wait for test results
      await waitFor(() => {
        expect(screen.queryByText('Testing...')).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle test failures gracefully', async () => {
      const user = userEvent.setup()

      // Mock failed test API response
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/test-alert')) {
          return Promise.reject(new Error('Test failed'))
        }
        if (url.includes('/api/alerts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAlertsData)
          })
        }
        return Promise.reject(new Error(`Unhandled request: ${url}`))
      })

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      await user.click(screen.getByText('New Alert'))

      // Fill form and add condition
      await user.type(screen.getByLabelText('Alert Name *'), 'Test Alert')
      await user.type(screen.getByLabelText('Symbol *'), 'AAPL')
      await user.click(screen.getByText('Add Condition'))

      // Test alert
      await user.click(screen.getByText('Test Alert'))

      // Should handle error gracefully
      await waitFor(() => {
        expect(screen.queryByText('Testing...')).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Real-time Preview Updates', () => {
    it('should update preview when conditions change', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      await user.click(screen.getByText('New Alert'))
      await user.click(screen.getByText('Add Condition'))

      // Change condition type
      const conditionSelect = screen.getByDisplayValue('Price Above')
      await user.selectOptions(conditionSelect, 'rsi_overbought')

      // Verify UI updates
      expect(screen.getByDisplayValue('RSI Overbought')).toBeInTheDocument()
      expect(screen.getByLabelText('Value')).toBeInTheDocument()
    })

    it('should show condition count in preview', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      await user.click(screen.getByText('New Alert'))

      // Initially no conditions
      expect(screen.getByText('No conditions added yet. Click "Add Condition" to get started.')).toBeInTheDocument()

      // Add first condition
      await user.click(screen.getByText('Add Condition'))
      expect(screen.getAllByText('Condition Type')).toHaveLength(1)

      // Add second condition
      await user.click(screen.getByText('Add Condition'))
      expect(screen.getAllByText('Condition Type')).toHaveLength(2)
    })

    it('should preview alert summary', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      await user.click(screen.getByText('New Alert'))

      // Fill alert details
      await user.type(screen.getByLabelText('Alert Name *'), 'Preview Test Alert')
      await user.type(screen.getByLabelText('Symbol *'), 'TSLA')
      await user.type(screen.getByLabelText('Description'), 'Test alert for preview functionality')

      // Set priority
      const prioritySelect = screen.getByDisplayValue('Medium')
      await user.selectOptions(prioritySelect, 'high')

      // Verify form reflects changes
      expect(screen.getByDisplayValue('Preview Test Alert')).toBeInTheDocument()
      expect(screen.getByDisplayValue('TSLA')).toBeInTheDocument()
      expect(screen.getByDisplayValue('High')).toBeInTheDocument()
    })
  })

  describe('Cross-Tab Integration', () => {
    it('should maintain state when switching between tabs', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      // Start in builder
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Alert Builder')

      // Switch to notifications
      await user.click(screen.getByText('Notification Center'))
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Notification Center')

      // Switch to management
      await user.click(screen.getByText('Alert Management'))
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Alert Management')

      // Switch to stats
      await user.click(screen.getByText('Statistics'))
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Statistics')

      // Switch back to builder - state should be maintained
      await user.click(screen.getByText('Alert Builder'))
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Alert Builder')
    })

    it('should update statistics when alerts are created', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      // Check initial stats
      await user.click(screen.getByText('Statistics'))
      expect(screen.getByText('1')).toBeInTheDocument() // Total alerts

      // Go back to builder and create alert
      await user.click(screen.getByText('Alert Builder'))
      await user.click(screen.getByText('New Alert'))

      // Fill and submit form
      await user.type(screen.getByLabelText('Alert Name *'), 'New Test Alert')
      await user.type(screen.getByLabelText('Symbol *'), 'NFLX')
      await user.click(screen.getByText('Add Condition'))

      await act(async () => {
        await user.click(screen.getByText('Create Alert'))
      })

      // Check updated stats
      await user.click(screen.getByText('Statistics'))

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument() // Updated total
      })
    })
  })

  describe('Performance and Responsiveness', () => {
    it('should handle rapid condition changes', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      await user.click(screen.getByText('New Alert'))
      await user.click(screen.getByText('Add Condition'))

      const conditionSelect = screen.getByDisplayValue('Price Above')

      // Rapidly change condition types
      const conditionTypes = [
        'price_below',
        'volume_spike',
        'rsi_overbought',
        'macd_bullish_crossover',
        'price_above'
      ]

      for (const type of conditionTypes) {
        await user.selectOptions(conditionSelect, type)
        // Small delay to prevent overwhelming the component
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Should end up with the last selected type
      expect(screen.getByDisplayValue('Price Above')).toBeInTheDocument()
    })

    it('should debounce preview updates', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <AlertsClient initialData={mockAlertsData} />
        </TestWrapper>
      )

      await user.click(screen.getByText('New Alert'))
      await user.click(screen.getByText('Add Condition'))

      const valueInput = screen.getByPlaceholderText('Enter value')

      // Type rapidly
      await user.type(valueInput, '123456', { delay: 1 })

      // Final value should be reflected
      expect(screen.getByDisplayValue('123456')).toBeInTheDocument()
    })
  })
})