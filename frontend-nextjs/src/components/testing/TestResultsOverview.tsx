/**
 * Test Results Overview Component
 * Displays test counts in card format
 */

import { TestResults } from '@/types/testing'

export default function TestResultsOverview({ testResults }: { testResults: TestResults }) {
  // Calculate totals
  const totalTests = testResults.unit.total + testResults.e2e.total + testResults.integration.total
  const totalPassing = testResults.unit.passing + testResults.e2e.passing + testResults.integration.passing
  const totalFailing = testResults.unit.failing + testResults.e2e.failing + testResults.integration.failing
  const totalSkipped = testResults.unit.skipped + testResults.e2e.skipped + testResults.integration.skipped

  // Calculate average coverage
  const avgCoverage = Math.round(
    (testResults.coverage.statements +
      testResults.coverage.branches +
      testResults.coverage.functions +
      testResults.coverage.lines) / 4
  )

  // Format last run time
  const lastRunDate = new Date(testResults.lastRun)
  const lastRunFormatted = lastRunDate.toLocaleString()

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Test Results</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Tests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tests</div>
          <div className="mt-2 flex items-baseline">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalTests}</div>
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">📊</div>
        </div>

        {/* Passing Tests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Passing</div>
          <div className="mt-2 flex items-baseline">
            <div className="text-3xl font-bold text-green-600">{totalPassing}</div>
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">✅</div>
        </div>

        {/* Failing Tests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Failing</div>
          <div className="mt-2 flex items-baseline">
            <div className="text-3xl font-bold text-red-600">{totalFailing}</div>
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">❌</div>
        </div>

        {/* Coverage */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Coverage</div>
          <div className="mt-2 flex items-baseline">
            <div className="text-3xl font-bold text-blue-600">{avgCoverage}%</div>
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">📈</div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Unit Tests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Unit Tests</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold">{testResults.unit.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Passing:</span>
              <span className="font-semibold text-green-600">{testResults.unit.passing}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Failing:</span>
              <span className="font-semibold text-red-600">{testResults.unit.failing}</span>
            </div>
          </div>
        </div>

        {/* E2E Tests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">E2E Tests</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold">{testResults.e2e.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Passing:</span>
              <span className="font-semibold text-green-600">{testResults.e2e.passing}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Failing:</span>
              <span className="font-semibold text-red-600">{testResults.e2e.failing}</span>
            </div>
          </div>
        </div>

        {/* Integration Tests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Integration Tests</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold">{testResults.integration.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Passing:</span>
              <span className="font-semibold text-green-600">{testResults.integration.passing}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Failing:</span>
              <span className="font-semibold text-red-600">{testResults.integration.failing}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Run */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Last Run:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{lastRunFormatted}</span>
        </div>
      </div>
    </div>
  )
}
