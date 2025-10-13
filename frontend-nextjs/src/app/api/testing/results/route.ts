/**
 * GET /api/testing/results
 * Returns test execution results and coverage metrics
 */

import { NextResponse } from 'next/server'
import { TestResults } from '@/types/testing'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Read test results from various sources
    const testResults = await getTestResults()

    return NextResponse.json(testResults)
  } catch (error) {
    console.error('Error fetching test results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test results' },
      { status: 500 }
    )
  }
}

/**
 * Get test results from Jest and Playwright reports
 */
async function getTestResults(): Promise<TestResults> {
  // In a real implementation, this would read from:
  // - Jest coverage reports (coverage/coverage-summary.json)
  // - Playwright test results
  // - Integration test results

  // For now, return mock data that matches real test counts from Issue #29
  const results: TestResults = {
    unit: {
      total: 23,  // From NotificationsAPI (7) + Types (16)
      passing: 23,
      failing: 0,
      skipped: 0,
    },
    e2e: {
      total: 16,  // From notifications E2E tests
      passing: 2,  // Currently passing (error handling tests)
      failing: 14, // Awaiting deployment
      skipped: 0,
    },
    integration: {
      total: 0,
      passing: 0,
      failing: 0,
      skipped: 0,
    },
    coverage: {
      statements: 0.97,  // From actual Jest output
      branches: 0.0,
      functions: 0.0,
      lines: 0.97,
    },
    lastRun: new Date().toISOString(),
  }

  // Try to read actual coverage data if available
  try {
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json')
    if (fs.existsSync(coveragePath)) {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'))
      const total = coverageData.total

      if (total) {
        results.coverage = {
          statements: total.statements.pct,
          branches: total.branches.pct,
          functions: total.functions.pct,
          lines: total.lines.pct,
        }
      }
    }
  } catch (error) {
    console.warn('Could not read coverage data:', error)
  }

  return results
}

/**
 * Helper to calculate pass rate
 */
export function calculatePassRate(passing: number, total: number): number {
  if (total === 0) return 0
  return (passing / total) * 100
}

/**
 * Helper to get overall test summary
 */
export function getOverallSummary(results: TestResults) {
  const totalTests = results.unit.total + results.e2e.total + results.integration.total
  const totalPassing =
    results.unit.passing + results.e2e.passing + results.integration.passing
  const totalFailing =
    results.unit.failing + results.e2e.failing + results.integration.failing
  const totalSkipped =
    results.unit.skipped + results.e2e.skipped + results.integration.skipped

  return {
    total: totalTests,
    passing: totalPassing,
    failing: totalFailing,
    skipped: totalSkipped,
    passRate: calculatePassRate(totalPassing, totalTests),
  }
}
