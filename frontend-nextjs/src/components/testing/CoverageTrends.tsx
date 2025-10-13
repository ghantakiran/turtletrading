/**
 * Coverage Trends Component
 * Displays coverage metrics over time with visual chart
 */

'use client'

import { CoverageTrend } from '@/types/testing'
import { useMemo } from 'react'

interface CoverageTrendsProps {
  trends: CoverageTrend[]
}

export default function CoverageTrends({ trends }: CoverageTrendsProps) {
  const chartData = useMemo(() => {
    if (trends.length === 0) return null

    const first = trends[0]
    const last = trends[trends.length - 1]

    const changes = {
      statements: last.statements - first.statements,
      branches: last.branches - first.branches,
      functions: last.functions - first.functions,
      lines: last.lines - first.lines,
    }

    const maxValue = Math.max(
      ...trends.flatMap(t => [t.statements, t.branches, t.functions, t.lines])
    )
    const minValue = Math.min(
      ...trends.flatMap(t => [t.statements, t.branches, t.functions, t.lines])
    )

    return {
      first,
      last,
      changes,
      maxValue,
      minValue,
      isImproving: changes.statements > 0,
    }
  }, [trends])

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatChange = (change: number): string => {
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  const getChangeIndicator = (change: number): string => {
    if (change > 0) return '↑'
    if (change < 0) return '↓'
    return '→'
  }

  const getChangeText = (change: number): string => {
    if (change > 0) return 'Improving'
    if (change < 0) return 'Declining'
    return 'Stable'
  }

  const calculateHeight = (value: number, max: number, min: number): number => {
    const range = max - min
    if (range === 0) return 50
    return ((value - min) / range) * 100
  }

  if (trends.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Coverage Trends
        </h2>
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          No trend data available
        </div>
      </div>
    )
  }

  const daysDiff = Math.ceil(
    (new Date(trends[trends.length - 1].timestamp).getTime() -
      new Date(trends[0].timestamp).getTime()) /
      (1000 * 60 * 60 * 24)
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Coverage Trends
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Last {daysDiff} days
            </p>
          </div>

          {chartData && (
            <div className="flex items-center gap-2">
              <span
                className={`text-2xl ${
                  chartData.isImproving
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {chartData.isImproving ? '↑' : '↓'}
              </span>
              <span
                className={`font-semibold ${
                  chartData.isImproving
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {chartData.isImproving ? 'Improving' : 'Declining'}
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap gap-4 mt-4 text-sm"
          data-testid="chart-legend"
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            <span className="text-gray-600 dark:text-gray-400">Statements</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-gray-600 dark:text-gray-400">Branches</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
            <span className="text-gray-600 dark:text-gray-400">Functions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
            <span className="text-gray-600 dark:text-gray-400">Lines</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div
          className="w-full max-w-full relative h-64 bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
          data-testid="coverage-chart"
        >
          <div className="flex items-end justify-between h-full gap-2">
            {trends.map((trend, index) => {
              const maxValue = chartData ? chartData.maxValue : 100
              const minValue = chartData ? chartData.minValue : 0

              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  {/* Bars */}
                  <div className="w-full flex items-end justify-center gap-1 h-48">
                    <div
                      className="w-2 bg-blue-500 rounded-t transition-all"
                      style={{
                        height: `${calculateHeight(trend.statements, maxValue, minValue)}%`,
                      }}
                      title={`Statements: ${trend.statements}%`}
                    />
                    <div
                      className="w-2 bg-green-500 rounded-t transition-all"
                      style={{
                        height: `${calculateHeight(trend.branches, maxValue, minValue)}%`,
                      }}
                      title={`Branches: ${trend.branches}%`}
                    />
                    <div
                      className="w-2 bg-purple-500 rounded-t transition-all"
                      style={{
                        height: `${calculateHeight(trend.functions, maxValue, minValue)}%`,
                      }}
                      title={`Functions: ${trend.functions}%`}
                    />
                    <div
                      className="w-2 bg-orange-500 rounded-t transition-all"
                      style={{
                        height: `${calculateHeight(trend.lines, maxValue, minValue)}%`,
                      }}
                      title={`Lines: ${trend.lines}%`}
                    />
                  </div>

                  {/* Date label */}
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {formatDate(trend.timestamp)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Current values */}
        {chartData && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">Statements</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {chartData.last.statements.toFixed(1)}%
              </div>
              <div
                className={`text-sm ${
                  chartData.changes.statements >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {getChangeIndicator(chartData.changes.statements)}{' '}
                {formatChange(chartData.changes.statements)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">Branches</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {chartData.last.branches.toFixed(1)}%
              </div>
              <div
                className={`text-sm ${
                  chartData.changes.branches >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {getChangeIndicator(chartData.changes.branches)}{' '}
                {formatChange(chartData.changes.branches)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">Functions</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {chartData.last.functions.toFixed(1)}%
              </div>
              <div
                className={`text-sm ${
                  chartData.changes.functions >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {getChangeIndicator(chartData.changes.functions)}{' '}
                {formatChange(chartData.changes.functions)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">Lines</div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {chartData.last.lines.toFixed(1)}%
              </div>
              <div
                className={`text-sm ${
                  chartData.changes.lines >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {getChangeIndicator(chartData.changes.lines)}{' '}
                {formatChange(chartData.changes.lines)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
