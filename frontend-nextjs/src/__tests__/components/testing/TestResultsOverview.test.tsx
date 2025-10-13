/**
 * Unit tests for TestResultsOverview Component
 * TDD approach - tests written first
 */

import { render, screen } from '@testing-library/react'
import TestResultsOverview from '@/components/testing/TestResultsOverview'
import { TestResults } from '@/types/testing'

describe('TestResultsOverview Component', () => {
  const mockTestResults: TestResults = {
    unit: { total: 150, passing: 148, failing: 2, skipped: 0 },
    e2e: { total: 31, passing: 31, failing: 0, skipped: 0 },
    integration: { total: 25, passing: 25, failing: 0, skipped: 0 },
    coverage: {
      statements: 85.2,
      branches: 78.5,
      functions: 82.1,
      lines: 84.9,
    },
    lastRun: '2025-10-13T10:30:00.000Z',
  }

  test('should render component', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)
    expect(screen.getByText(/Test Results/i)).toBeInTheDocument()
  })

  test('should display total tests count', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    const totalTests = mockTestResults.unit.total + mockTestResults.e2e.total + mockTestResults.integration.total
    expect(screen.getByText(totalTests.toString())).toBeInTheDocument()
  })

  test('should display passing tests count', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    const passingTests = mockTestResults.unit.passing + mockTestResults.e2e.passing + mockTestResults.integration.passing
    expect(screen.getByText(passingTests.toString())).toBeInTheDocument()
  })

  test('should display failing tests count', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    const failingTests = mockTestResults.unit.failing + mockTestResults.e2e.failing + mockTestResults.integration.failing
    const failingElements = screen.getAllByText(failingTests.toString())
    expect(failingElements.length).toBeGreaterThan(0)
  })

  test('should display coverage percentage', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    const avgCoverage = (
      mockTestResults.coverage.statements +
      mockTestResults.coverage.branches +
      mockTestResults.coverage.functions +
      mockTestResults.coverage.lines
    ) / 4

    expect(screen.getByText(new RegExp(`${Math.round(avgCoverage)}%`))).toBeInTheDocument()
  })

  test('should show success status when no failures', () => {
    const allPassingResults: TestResults = {
      ...mockTestResults,
      unit: { total: 150, passing: 150, failing: 0, skipped: 0 },
      e2e: { total: 31, passing: 31, failing: 0, skipped: 0 },
      integration: { total: 25, passing: 25, failing: 0, skipped: 0 },
    }

    render(<TestResultsOverview testResults={allPassingResults} />)

    const successElements = screen.getAllByText(/206/)
    expect(successElements.length).toBeGreaterThan(0)
  })

  test('should show error status when there are failures', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    // Should show failing count
    const failingElements = screen.getAllByText('2')
    expect(failingElements.length).toBeGreaterThan(0)
  })

  test('should display unit test results', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    expect(screen.getByText(/Unit/i)).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  test('should display E2E test results', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    expect(screen.getByText(/E2E/i)).toBeInTheDocument()
    const e2eElements = screen.getAllByText('31')
    expect(e2eElements.length).toBeGreaterThan(0)
  })

  test('should display integration test results', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    expect(screen.getByText(/Integration/i)).toBeInTheDocument()
    const integrationElements = screen.getAllByText('25')
    expect(integrationElements.length).toBeGreaterThan(0)
  })

  test('should have proper card layout', () => {
    const { container } = render(<TestResultsOverview testResults={mockTestResults} />)

    const cards = container.querySelectorAll('.bg-white, .bg-gray-800')
    expect(cards.length).toBeGreaterThan(0)
  })

  test('should have proper grid layout', () => {
    const { container } = render(<TestResultsOverview testResults={mockTestResults} />)

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
  })

  test('should display last run timestamp', () => {
    render(<TestResultsOverview testResults={mockTestResults} />)

    // Should display date information
    expect(screen.getByText(/Last Run/i)).toBeInTheDocument()
  })
})
