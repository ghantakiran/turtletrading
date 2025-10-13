/**
 * Health Status Panel Component
 * Display service health status
 */

import { HealthStatus, ServiceHealth } from '@/types/testing'

interface ServiceStatusProps {
  name: string
  service: ServiceHealth
}

function ServiceStatus({ name, service }: ServiceStatusProps) {
  const statusIcon = service.status === 'up' ? '✅' : service.status === 'down' ? '❌' : '⚠️'
  const statusColor =
    service.status === 'up'
      ? 'text-green-600'
      : service.status === 'down'
      ? 'text-red-600'
      : 'text-yellow-600'

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{statusIcon}</span>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{name}</div>
          <div className={`text-sm font-medium ${statusColor}`}>{service.status}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-gray-600 dark:text-gray-400">Latency</div>
        <div className="font-semibold text-gray-900 dark:text-white">{service.latency}ms</div>
      </div>
    </div>
  )
}

export default function HealthStatusPanel({ healthStatus }: { healthStatus: HealthStatus }) {
  const statusIcon =
    healthStatus.status === 'healthy' ? '✅' : healthStatus.status === 'degraded' ? '⚠️' : '❌'
  const statusColor =
    healthStatus.status === 'healthy'
      ? 'text-green-600'
      : healthStatus.status === 'degraded'
      ? 'text-yellow-600'
      : 'text-red-600'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Health</h2>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{statusIcon}</span>
          <span className={`text-lg font-semibold capitalize ${statusColor}`}>
            {healthStatus.status}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(healthStatus.services).map(([name, service]) => (
          <ServiceStatus
            key={name}
            name={name.charAt(0).toUpperCase() + name.slice(1)}
            service={service}
          />
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Last checked: {new Date(healthStatus.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
