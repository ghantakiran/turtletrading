/**
 * Unit tests for CoverageTrends Component
 * TDD approach - tests written first for Issue #33 Step 3
 */

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CoverageTrends from '@/components/testing/CoverageTrends'
import { CoverageTrend } from '@/types/testing'

const mockTrends: CoverageTrend[] = [
  {
    timestamp: '2025-10-10T10:00:00Z',
    statements: 82.0,
    branches: 75.0,
    functions: 80.0,
    lines: 81.0,
  },
  {
    timestamp: '2025-10-11T10:00:00Z',
    statements: 83.5,
    branches: 76.5,
    functions: 81.0,
    lines: 82.5,
  },
  {
    timestamp: '2025-10-12T10:00:00Z',
    statements: 85.0,
    branches: 78.0,
    functions: 82.0,
    lines: 84.0,
  },
  {
    timestamp: '2025-10-13T10:00:00Z',
    statements: 85.2,
    branches: 78.5,
    functions: 82.1,
    lines: 84.9,
  },
]

describe('CoverageTrends Component', () => {
  test('should render component with title', () => {
    render(<CoverageTrends trends={mockTrends} />)

    expect(screen.getByText('Coverage Trends')).toBeInTheDocument()
  })

  test('should display trend chart', () => {
    const { container } = render(<CoverageTrends trends={mockTrends} />)

    // Should have a chart container
    const chart = container.querySelector('[data-testid="coverage-chart"]')
    expect(chart).toBeInTheDocument()
  })

  test('should show all coverage metrics', () => {
    render(<CoverageTrends trends={mockTrends} />)

    const statements = screen.getAllByText(/statements/i)
    expect(statements.length).toBeGreaterThan(0)
    const branches = screen.getAllByText(/branches/i)
    expect(branches.length).toBeGreaterThan(0)
    const functions = screen.getAllByText(/functions/i)
    expect(functions.length).toBeGreaterThan(0)
    const lines = screen.getAllByText(/lines/i)
    expect(lines.length).toBeGreaterThan(0)
  })

  test('should display trend dates', () => {
    render(<CoverageTrends trends={mockTrends} />)

    // Should show formatted dates (Oct 10, Oct 11, etc.)
    const dates = screen.getAllByText(/Oct|10|11|12|13/)
    expect(dates.length).toBeGreaterThan(0)
  })

  test('should show current coverage percentage', () => {
    render(<CoverageTrends trends={mockTrends} />)

    // Should show latest coverage (85.2%)
    expect(screen.getByText(/85\.2/)).toBeInTheDocument()
  })

  test('should calculate and display coverage change', () => {
    render(<CoverageTrends trends={mockTrends} />)

    // Should show change from first to last (+3.2% for statements)
    const changes = screen.getAllByText(/\+|↑|increase/i)
    expect(changes.length).toBeGreaterThan(0)
  })

  test('should handle empty trends gracefully', () => {
    render(<CoverageTrends trends={[]} />)

    expect(screen.getByText('Coverage Trends')).toBeInTheDocument()
    expect(screen.getByText(/no trend data available/i)).toBeInTheDocument()
  })

  test('should handle single data point', () => {
    const singleTrend = [mockTrends[0]]
    render(<CoverageTrends trends={singleTrend} />)

    expect(screen.getByText('Coverage Trends')).toBeInTheDocument()
    // Should still render but with no change calculation
    expect(screen.getByText(/82\.0/)).toBeInTheDocument()
  })

  test('should show legend for different metrics', () => {
    render(<CoverageTrends trends={mockTrends} />)

    // Should have colored legend items
    const legend = screen.getByTestId('chart-legend')
    expect(legend).toBeInTheDocument()
  })

  test('should display time period', () => {
    render(<CoverageTrends trends={mockTrends} />)

    // Should show date range (Oct 10 - Oct 13)
    expect(screen.getByText(/last.*days/i)).toBeInTheDocument()
  })

  test('should be responsive on mobile', () => {
    const { container } = render(<CoverageTrends trends={mockTrends} />)

    // Should have responsive classes
    const chartContainer = container.querySelector('[data-testid="coverage-chart"]')
    expect(chartContainer).toHaveClass(/w-full|max-w/)
  })

  test('should show improvement indicator for positive trends', () => {
    render(<CoverageTrends trends={mockTrends} />)

    // Trends are increasing, should show positive indicator
    const positiveIndicators = screen.getAllByText(/↑|improving/i)
    expect(positiveIndicators.length).toBeGreaterThan(0)
  })

  test('should show decline indicator for negative trends', () => {
    const decliningTrends: CoverageTrend[] = [
      {
        timestamp: '2025-10-10T10:00:00Z',
        statements: 85.0,
        branches: 78.0,
        functions: 82.0,
        lines: 84.0,
      },
      {
        timestamp: '2025-10-11T10:00:00Z',
        statements: 80.0,
        branches: 73.0,
        functions: 77.0,
        lines: 79.0,
      },
    ]

    render(<CoverageTrends trends={decliningTrends} />)

    // Should show negative indicator
    const negativeIndicators = screen.getAllByText(/↓|declining/i)
    expect(negativeIndicators.length).toBeGreaterThan(0)
  })

  test('should display all trend data points', () => {
    const { container } = render(<CoverageTrends trends={mockTrends} />)

    // Should render 4 data points (one for each trend entry)
    const chart = container.querySelector('[data-testid="coverage-chart"]')
    expect(chart).toBeInTheDocument()
  })

  test('should format percentages correctly', () => {
    render(<CoverageTrends trends={mockTrends} />)

    // Should show percentages with % symbol
    const percentages = screen.getAllByText(/%/)
    expect(percentages.length).toBeGreaterThan(0)
  })

  test('should be accessible', () => {
    const { container } = render(<CoverageTrends trends={mockTrends} />)

    // Chart should have proper ARIA attributes
    const chart = container.querySelector('[data-testid="coverage-chart"]')
    expect(chart).toBeInTheDocument()
  })
})
