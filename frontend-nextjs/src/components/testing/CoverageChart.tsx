/**
 * Coverage Chart Component
 * Visualize code coverage with progress bars
 */

import { CoverageMetrics } from '@/types/testing'

interface ProgressBarProps {
  label: string
  value: number
  color: string
}

function ProgressBar({ label, value, color }: ProgressBarProps) {
  // Determine color based on value
  let bgColor = 'bg-red-500'
  if (value >= 80) {
    bgColor = 'bg-blue-600'
  } else if (value >= 60) {
    bgColor = 'bg-yellow-500'
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-white">{value.toFixed(1)}%</span>
      </div>
      <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${bgColor} transition-all duration-300`}
          style={{ width: `${value}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}

export default function CoverageChart({ coverage }: { coverage: CoverageMetrics }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Code Coverage</h2>

      <div className="space-y-6">
        <ProgressBar label="Statements" value={coverage.statements} color="blue" />
        <ProgressBar label="Branches" value={coverage.branches} color="green" />
        <ProgressBar label="Functions" value={coverage.functions} color="purple" />
        <ProgressBar label="Lines" value={coverage.lines} color="orange" />
      </div>

      {/* Coverage Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Excellent (≥80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Good (60-79%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Needs Improvement (\u003c60%)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
