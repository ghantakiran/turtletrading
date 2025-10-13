/**
 * Unit tests for CoverageChart Component
 * TDD approach - tests written first
 */

import { render, screen } from '@testing-library/react'
import CoverageChart from '@/components/testing/CoverageChart'
import { CoverageMetrics } from '@/types/testing'

describe('CoverageChart Component', () => {
  const mockCoverage: CoverageMetrics = {
    statements: 85.2,
    branches: 78.5,
    functions: 82.1,
    lines: 84.9,
  }

  test('should render component', () => {
    render(<CoverageChart coverage={mockCoverage} />)
    expect(screen.getByText(/Code Coverage/i)).toBeInTheDocument()
  })

  test('should display statements coverage', () => {
    render(<CoverageChart coverage={mockCoverage} />)

    expect(screen.getByText(/Statements/i)).toBeInTheDocument()
    expect(screen.getByText(/85\.2%/)).toBeInTheDocument()
  })

  test('should display branches coverage', () => {
    render(<CoverageChart coverage={mockCoverage} />)

    expect(screen.getByText(/Branches/i)).toBeInTheDocument()
    expect(screen.getByText(/78\.5%/)).toBeInTheDocument()
  })

  test('should display functions coverage', () => {
    render(<CoverageChart coverage={mockCoverage} />)

    expect(screen.getByText(/Functions/i)).toBeInTheDocument()
    expect(screen.getByText(/82\.1%/)).toBeInTheDocument()
  })

  test('should display lines coverage', () => {
    render(<CoverageChart coverage={mockCoverage} />)

    expect(screen.getByText(/Lines/i)).toBeInTheDocument()
    expect(screen.getByText(/84\.9%/)).toBeInTheDocument()
  })

  test('should have progress bars', () => {
    const { container } = render(<CoverageChart coverage={mockCoverage} />)

    // Should have at least 4 progress bars (one for each metric)
    const progressBars = container.querySelectorAll('[role="progressbar"]')
    expect(progressBars.length).toBeGreaterThanOrEqual(4)
  })

  test('should show correct progress bar widths', () => {
    const { container } = render(<CoverageChart coverage={mockCoverage} />)

    const progressBars = container.querySelectorAll('[role="progressbar"]')

    // First progress bar should be approximately 85% wide (statements)
    const statementsBar = progressBars[0]
    expect(statementsBar).toHaveStyle({ width: '85.2%' })
  })

  test('should use color coding for coverage levels', () => {
    const { container } = render(<CoverageChart coverage={mockCoverage} />)

    // High coverage (>80%) should be green/blue
    // Medium coverage (60-80%) should be yellow
    // Low coverage (<60%) should be red

    const coloredElements = container.querySelectorAll('.bg-blue-600, .bg-green-600, .bg-yellow-500, .bg-red-500')
    expect(coloredElements.length).toBeGreaterThan(0)
  })

  test('should have proper card layout', () => {
    const { container } = render(<CoverageChart coverage={mockCoverage} />)

    const card = container.querySelector('.bg-white, .bg-gray-800')
    expect(card).toBeInTheDocument()
  })

  test('should handle perfect coverage (100%)', () => {
    const perfectCoverage: CoverageMetrics = {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    }

    render(<CoverageChart coverage={perfectCoverage} />)

    const percentages = screen.getAllByText(/100\.0%/)
    expect(percentages.length).toBe(4)
  })

  test('should handle zero coverage', () => {
    const zeroCoverage: CoverageMetrics = {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    }

    render(<CoverageChart coverage={zeroCoverage} />)

    const percentages = screen.getAllByText(/0\.0%/)
    expect(percentages.length).toBeGreaterThanOrEqual(4)
  })
})
