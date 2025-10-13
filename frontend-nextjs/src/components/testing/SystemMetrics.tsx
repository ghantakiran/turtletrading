/**
 * System Metrics Component
 * Display system resource usage
 */

import { SystemMetrics as SystemMetricsType } from '@/types/testing'

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

export default function SystemMetrics({ system }: { system: SystemMetricsType }) {
  const uptimeFormatted = formatUptime(system.uptime)
  const memoryPercentageColor =
    system.memory.percentage >= 80
      ? 'text-red-600'
      : system.memory.percentage >= 60
      ? 'text-yellow-600'
      : 'text-green-600'

  const cpuColor = system.cpu >= 80 ? 'text-red-600' : system.cpu >= 60 ? 'text-yellow-600' : 'text-green-600'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">System Metrics</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Uptime */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⏱️</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Uptime</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{uptimeFormatted}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {system.uptime} seconds
          </div>
        </div>

        {/* Memory */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">💾</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Memory</span>
          </div>
          <div className={`text-3xl font-bold ${memoryPercentageColor}`}>{system.memory.percentage}%</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {system.memory.used}MB / {system.memory.total}MB
          </div>
        </div>

        {/* CPU */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⚡</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">CPU</span>
          </div>
          <div className={`text-3xl font-bold ${cpuColor}`}>{system.cpu}%</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Usage</div>
        </div>
      </div>
    </div>
  )
}
