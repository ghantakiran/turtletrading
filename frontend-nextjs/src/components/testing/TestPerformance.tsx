/**
 * Test Performance Component
 * Displays test execution performance metrics
 */

'use client'

import { TestPerformanceMetrics } from '@/types/testing'

interface TestPerformanceProps {
  performance?: TestPerformanceMetrics
}

export default function TestPerformance({ performance }: TestPerformanceProps) {
  if (!performance) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Test Performance
        </h2>
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          No performance data available
        </div>
      </div>
    )
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  const truncateTestName = (name: string, maxLength: number = 60): string => {
    if (name.length <= maxLength) return name
    return `${name.substring(0, maxLength)}...`
  }

  const getCategoryBadgeColor = (category: 'unit' | 'e2e' | 'integration'): string => {
    switch (category) {
      case 'unit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'e2e':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'integration':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    }
  }

  const testsPerSecond = (performance.testCount / (performance.totalDuration / 1000)).toFixed(2)
  const isSlow = (duration: number): boolean => duration > 500

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Test Performance
        </h2>

        {/* Performance Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Average</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {performance.avgDuration.toFixed(1)}ms
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDuration(performance.totalDuration)}
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Tests</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {performance.testCount}
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Tests/sec</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {testsPerSecond}
            </div>
          </div>
        </div>
      </div>

      {/* Slowest Tests Table */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Slowest Tests
        </h3>

        {performance.slowestTests.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            No slow tests recorded
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Test Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {performance.slowestTests.map((test, index) => {
                  const isSlowTest = isSlow(test.duration)

                  return (
                    <tr
                      key={index}
                      className={isSlowTest ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                      data-slow={isSlowTest ? 'true' : 'false'}
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <span title={test.name}>{truncateTestName(test.name)}</span>
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-semibold ${
                          isSlowTest
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {test.duration}ms
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {test.file.split('/').pop()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(
                            test.category
                          )}`}
                        >
                          {test.category}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
