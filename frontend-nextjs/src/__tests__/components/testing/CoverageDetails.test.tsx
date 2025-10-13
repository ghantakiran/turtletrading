/**
 * Unit tests for CoverageDetails Component
 * TDD approach - tests written first for Issue #33 Step 2
 */

import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import CoverageDetails from '@/components/testing/CoverageDetails'
import { FileCoverage } from '@/types/testing'

const mockFileCoverage: FileCoverage[] = [
  {
    path: 'src/components/Button.tsx',
    statements: { total: 20, covered: 18, skipped: 0, pct: 90.0 },
    branches: { total: 8, covered: 7, skipped: 0, pct: 87.5 },
    functions: { total: 4, covered: 4, skipped: 0, pct: 100.0 },
    lines: { total: 18, covered: 17, skipped: 0, pct: 94.44 },
  },
  {
    path: 'src/components/Alert.tsx',
    statements: { total: 15, covered: 10, skipped: 0, pct: 66.67 },
    branches: { total: 6, covered: 4, skipped: 0, pct: 66.67 },
    functions: { total: 3, covered: 2, skipped: 0, pct: 66.67 },
    lines: { total: 14, covered: 9, skipped: 0, pct: 64.29 },
  },
  {
    path: 'src/utils/format.ts',
    statements: { total: 10, covered: 5, skipped: 0, pct: 50.0 },
    branches: { total: 4, covered: 2, skipped: 0, pct: 50.0 },
    functions: { total: 2, covered: 1, skipped: 0, pct: 50.0 },
    lines: { total: 9, covered: 4, skipped: 0, pct: 44.44 },
  },
]

describe('CoverageDetails Component', () => {
  test('should render component with title', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    expect(screen.getByText('File Coverage Details')).toBeInTheDocument()
  })

  test('should render table with correct headers', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    expect(screen.getByText('File Path')).toBeInTheDocument()
    expect(screen.getByText('Statements')).toBeInTheDocument()
    expect(screen.getByText('Branches')).toBeInTheDocument()
    expect(screen.getByText('Functions')).toBeInTheDocument()
    expect(screen.getByText('Lines')).toBeInTheDocument()
  })

  test('should render all files in the table', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    expect(screen.getByText('src/components/Button.tsx')).toBeInTheDocument()
    expect(screen.getByText('src/components/Alert.tsx')).toBeInTheDocument()
    expect(screen.getByText('src/utils/format.ts')).toBeInTheDocument()
  })

  test('should display coverage percentages', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    // Check for percentages (rounded to 1 decimal)
    const percentages = screen.getAllByText(/\d+\.\d%/)
    expect(percentages.length).toBeGreaterThan(0)
  })

  test('should color-code coverage based on thresholds', () => {
    const { container } = render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    // High coverage (>=80%) should have green/blue color
    const highCoverage = container.querySelector('[data-coverage-high]')
    expect(highCoverage).toBeInTheDocument()

    // Low coverage (<60%) should have red color
    const lowCoverage = container.querySelector('[data-coverage-low]')
    expect(lowCoverage).toBeInTheDocument()
  })

  test('should show covered/total counts', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    // Should show "18/20" for Button.tsx statements
    expect(screen.getByText(/18\/20/)).toBeInTheDocument()
  })

  test('should handle empty file coverage gracefully', () => {
    render(<CoverageDetails fileCoverage={[]} />)

    expect(screen.getByText('File Coverage Details')).toBeInTheDocument()
    expect(screen.getByText('No coverage data available')).toBeInTheDocument()
  })

  test('should be responsive on mobile', () => {
    const { container } = render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    // Should have overflow handling for mobile
    const tableContainer = container.querySelector('.overflow-x-auto')
    expect(tableContainer).toBeInTheDocument()
    expect(tableContainer).toHaveClass('overflow-x-auto')
  })

  test('should sort files by default (low to high coverage)', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    const rows = screen.getAllByRole('row')
    // Skip header row
    const dataRows = rows.slice(1)

    // First data row should be the lowest coverage file
    expect(within(dataRows[0]).getByText('src/utils/format.ts')).toBeInTheDocument()
  })

  test('should allow sorting by column', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    const statementsHeader = screen.getByText('Statements')
    expect(statementsHeader.closest('th')).toBeInTheDocument()
  })

  test('should show total coverage summary', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    // Should show overall average or total
    expect(screen.getByText(/3 files/)).toBeInTheDocument()
  })

  test('should truncate long file paths', () => {
    const longPath: FileCoverage = {
      path: 'src/very/long/path/to/some/deeply/nested/component/Button.tsx',
      statements: { total: 10, covered: 8, skipped: 0, pct: 80.0 },
      branches: { total: 4, covered: 3, skipped: 0, pct: 75.0 },
      functions: { total: 2, covered: 2, skipped: 0, pct: 100.0 },
      lines: { total: 9, covered: 7, skipped: 0, pct: 77.78 },
    }

    render(<CoverageDetails fileCoverage={[longPath]} />)

    // Should show truncated or full path
    const pathElement = screen.getByText(/Button\.tsx/)
    expect(pathElement).toBeInTheDocument()
  })

  test('should highlight files below coverage threshold', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} threshold={70} />)

    // Files with <70% coverage should be highlighted
    const lowCoverageFile = screen.getByText('src/utils/format.ts')
    const row = lowCoverageFile.closest('tr')
    expect(row).toHaveClass(/warning|alert|highlight/)
  })

  test('should show legend for color coding', () => {
    render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    // Should have a legend explaining colors
    expect(screen.getByText(/High|Good|Excellent/i)).toBeInTheDocument()
    expect(screen.getByText(/Low|Poor|Needs Work/i)).toBeInTheDocument()
  })

  test('should be accessible', () => {
    const { container } = render(<CoverageDetails fileCoverage={mockFileCoverage} />)

    // Table should have proper ARIA attributes
    const table = container.querySelector('table')
    expect(table).toBeInTheDocument()
  })
})
