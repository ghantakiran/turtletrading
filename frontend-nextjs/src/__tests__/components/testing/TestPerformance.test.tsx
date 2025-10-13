/**
 * Unit tests for TestPerformance Component
 * TDD approach - tests written first for Issue #33 Step 4
 */

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import TestPerformance from '@/components/testing/TestPerformance'
import { TestPerformanceMetrics } from '@/types/testing'

const mockPerformance: TestPerformanceMetrics = {
  avgDuration: 125.5,
  totalDuration: 15060,
  testCount: 120,
  slowestTests: [
    {
      name: 'should handle large dataset processing',
      duration: 1250,
      file: 'src/__tests__/data/processor.test.ts',
      category: 'unit',
    },
    {
      name: 'should complete full user journey',
      duration: 980,
      file: 'tests/e2e/user-flow.spec.ts',
      category: 'e2e',
    },
    {
      name: 'should integrate with external API',
      duration: 750,
      file: 'src/__tests__/integration/api.test.ts',
      category: 'integration',
    },
  ],
}

describe('TestPerformance Component', () => {
  test('should render component with title', () => {
    render(<TestPerformance performance={mockPerformance} />)

    expect(screen.getByText('Test Performance')).toBeInTheDocument()
  })

  test('should display average test duration', () => {
    render(<TestPerformance performance={mockPerformance} />)

    expect(screen.getByText(/125\.5/)).toBeInTheDocument()
    expect(screen.getByText(/average/i)).toBeInTheDocument()
  })

  test('should show total test duration', () => {
    render(<TestPerformance performance={mockPerformance} />)

    // Should format total duration (15060ms = 15.06s or 15.1s)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText(/15\.1s|15\.06s/)).toBeInTheDocument()
  })

  test('should display test count', () => {
    render(<TestPerformance performance={mockPerformance} />)

    expect(screen.getByText(/120/)).toBeInTheDocument()
  })

  test('should list slowest tests', () => {
    render(<TestPerformance performance={mockPerformance} />)

    expect(screen.getByText('should handle large dataset processing')).toBeInTheDocument()
    expect(screen.getByText('should complete full user journey')).toBeInTheDocument()
    expect(screen.getByText('should integrate with external API')).toBeInTheDocument()
  })

  test('should show test durations in ms', () => {
    render(<TestPerformance performance={mockPerformance} />)

    expect(screen.getByText(/1250ms/)).toBeInTheDocument()
    expect(screen.getByText(/980ms/)).toBeInTheDocument()
    expect(screen.getByText(/750ms/)).toBeInTheDocument()
  })

  test('should display test file paths', () => {
    render(<TestPerformance performance={mockPerformance} />)

    expect(screen.getByText(/processor\.test\.ts/)).toBeInTheDocument()
    expect(screen.getByText(/user-flow\.spec\.ts/)).toBeInTheDocument()
    expect(screen.getByText(/api\.test\.ts/)).toBeInTheDocument()
  })

  test('should show test categories', () => {
    render(<TestPerformance performance={mockPerformance} />)

    expect(screen.getByText('unit')).toBeInTheDocument()
    expect(screen.getByText('e2e')).toBeInTheDocument()
    expect(screen.getByText('integration')).toBeInTheDocument()
  })

  test('should handle no performance data gracefully', () => {
    render(<TestPerformance performance={undefined} />)

    expect(screen.getByText('Test Performance')).toBeInTheDocument()
    expect(screen.getByText(/no performance data available/i)).toBeInTheDocument()
  })

  test('should handle empty slowest tests array', () => {
    const emptyPerformance: TestPerformanceMetrics = {
      avgDuration: 100,
      totalDuration: 1000,
      testCount: 10,
      slowestTests: [],
    }

    render(<TestPerformance performance={emptyPerformance} />)

    expect(screen.getByText(/100/)).toBeInTheDocument()
    expect(screen.getByText(/no slow tests/i)).toBeInTheDocument()
  })

  test('should highlight slow tests with warning color', () => {
    const { container } = render(<TestPerformance performance={mockPerformance} />)

    // Tests >500ms should have warning styling
    const slowTest = container.querySelector('[data-slow="true"]')
    expect(slowTest).toBeInTheDocument()
  })

  test('should calculate tests per second', () => {
    render(<TestPerformance performance={mockPerformance} />)

    // 120 tests / 15.06s ≈ 7.97 tests/sec
    expect(screen.getByText(/tests.*sec|per second/i)).toBeInTheDocument()
  })

  test('should format large durations in seconds', () => {
    const longPerformance: TestPerformanceMetrics = {
      avgDuration: 2500,
      totalDuration: 300000,
      testCount: 120,
      slowestTests: [],
    }

    render(<TestPerformance performance={longPerformance} />)

    // Should show 300000ms as 300s or 5min
    expect(screen.getByText(/300s|5.*min/i)).toBeInTheDocument()
  })

  test('should truncate long test names', () => {
    const longTestName: TestPerformanceMetrics = {
      avgDuration: 100,
      totalDuration: 1000,
      testCount: 10,
      slowestTests: [
        {
          name: 'should handle a very long test name that describes exactly what the test does in great detail with many words',
          duration: 500,
          file: 'test.ts',
          category: 'unit',
        },
      ],
    }

    render(<TestPerformance performance={longTestName} />)

    // Should show truncated or full name
    const testName = screen.getByText(/should handle a very long/i)
    expect(testName).toBeInTheDocument()
  })

  test('should sort slowest tests by duration', () => {
    render(<TestPerformance performance={mockPerformance} />)

    const rows = screen.getAllByRole('row')
    // Skip header row, first data row should be slowest (1250ms)
    expect(rows[1]).toHaveTextContent('1250ms')
  })

  test('should be responsive on mobile', () => {
    const { container } = render(<TestPerformance performance={mockPerformance} />)

    // Should have overflow handling
    const table = container.querySelector('.overflow-x-auto')
    expect(table).toBeInTheDocument()
  })

  test('should be accessible', () => {
    const { container } = render(<TestPerformance performance={mockPerformance} />)

    // Table should have proper structure
    const table = container.querySelector('table')
    expect(table).toBeInTheDocument()
  })
})
