/**
 * GET /api/testing/detailed-results
 * Returns detailed test execution results with file-level coverage
 */

import { NextRequest, NextResponse } from 'next/server'
import { DetailedTestResults, FileCoverage, CoverageTrend, TestPerformanceMetrics } from '@/types/testing'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const threshold = searchParams.get('threshold')
      ? parseInt(searchParams.get('threshold')!)
      : undefined

    // Get base test results
    const baseResults = await getBaseTestResults()

    // Get detailed coverage data
    const fileCoverage = await getFileCoverage(threshold)

    // Get coverage trends (optional)
    const coverageTrends = await getCoverageTrends()

    // Get performance metrics (optional)
    const performance = await getPerformanceMetrics()

    const detailedResults: DetailedTestResults = {
      ...baseResults,
      fileCoverage,
      coverageTrends,
      performance,
    }

    return NextResponse.json(detailedResults)
  } catch (error) {
    console.error('Error fetching detailed test results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch detailed test results' },
      { status: 500 }
    )
  }
}

/**
 * Get base test results
 */
async function getBaseTestResults() {
  return {
    unit: {
      total: 23,
      passing: 23,
      failing: 0,
      skipped: 0,
    },
    e2e: {
      total: 16,
      passing: 2,
      failing: 14,
      skipped: 0,
    },
    integration: {
      total: 0,
      passing: 0,
      failing: 0,
      skipped: 0,
    },
    coverage: {
      statements: 0.97,
      branches: 0.0,
      functions: 0.0,
      lines: 0.97,
    },
    lastRun: new Date().toISOString(),
  }
}

/**
 * Get file-level coverage details
 */
async function getFileCoverage(threshold?: number): Promise<FileCoverage[]> {
  try {
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json')

    if (!fs.existsSync(coveragePath)) {
      console.warn('Coverage file not found, returning empty array')
      return []
    }

    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'))

    const fileCoverageArray: FileCoverage[] = Object.entries(coverageData).map(
      ([filePath, data]: [string, any]) => {
        const relativePath = filePath.replace(process.cwd(), '').replace(/^\//, '')

        return {
          path: relativePath,
          statements: {
            total: data.s ? Object.keys(data.s).length : 0,
            covered: data.s ? Object.values(data.s).filter((v: any) => v > 0).length : 0,
            skipped: 0,
            pct: data.s
              ? (Object.values(data.s).filter((v: any) => v > 0).length / Object.keys(data.s).length) * 100
              : 0,
          },
          branches: {
            total: data.b ? Object.keys(data.b).length : 0,
            covered: data.b
              ? Object.values(data.b).filter((branches: any) =>
                  Array.isArray(branches) && branches.some(b => b > 0)
                ).length
              : 0,
            skipped: 0,
            pct: data.b
              ? (Object.values(data.b).filter((branches: any) =>
                  Array.isArray(branches) && branches.some(b => b > 0)
                ).length / Object.keys(data.b).length) * 100
              : 0,
          },
          functions: {
            total: data.f ? Object.keys(data.f).length : 0,
            covered: data.f ? Object.values(data.f).filter((v: any) => v > 0).length : 0,
            skipped: 0,
            pct: data.f
              ? (Object.values(data.f).filter((v: any) => v > 0).length / Object.keys(data.f).length) * 100
              : 0,
          },
          lines: {
            total: data.s ? Object.keys(data.s).length : 0,
            covered: data.s ? Object.values(data.s).filter((v: any) => v > 0).length : 0,
            skipped: 0,
            pct: data.s
              ? (Object.values(data.s).filter((v: any) => v > 0).length / Object.keys(data.s).length) * 100
              : 0,
          },
        }
      }
    )

    // Filter by threshold if provided
    let filtered = fileCoverageArray
    if (threshold !== undefined) {
      filtered = fileCoverageArray.filter(file => file.statements.pct < threshold)
    }

    // Sort by statement coverage (low to high)
    filtered.sort((a, b) => a.statements.pct - b.statements.pct)

    return filtered
  } catch (error) {
    console.warn('Could not read file coverage data:', error)
    return []
  }
}

/**
 * Get coverage trends over time
 */
async function getCoverageTrends(): Promise<CoverageTrend[] | undefined> {
  try {
    const trendsPath = path.join(process.cwd(), '.coverage-trends', 'trends.json')

    if (!fs.existsSync(trendsPath)) {
      return undefined
    }

    const trendsData = JSON.parse(fs.readFileSync(trendsPath, 'utf-8'))
    return trendsData
  } catch (error) {
    console.warn('Could not read coverage trends:', error)
    return undefined
  }
}

/**
 * Get test performance metrics
 */
async function getPerformanceMetrics(): Promise<TestPerformanceMetrics | undefined> {
  try {
    const performancePath = path.join(process.cwd(), '.test-results', 'performance.json')

    if (!fs.existsSync(performancePath)) {
      return undefined
    }

    const performanceData = JSON.parse(fs.readFileSync(performancePath, 'utf-8'))
    return performanceData
  } catch (error) {
    console.warn('Could not read performance metrics:', error)
    return undefined
  }
}

/**
 * Helper to calculate average coverage percentage
 */
export function calculateAverageCoverage(files: FileCoverage[]): number {
  if (files.length === 0) return 0

  const totalPct = files.reduce((sum, file) => sum + file.statements.pct, 0)
  return totalPct / files.length
}

/**
 * Helper to identify files with low coverage
 */
export function getLowCoverageFiles(files: FileCoverage[], threshold: number = 80): FileCoverage[] {
  return files.filter(file => file.statements.pct < threshold)
}
