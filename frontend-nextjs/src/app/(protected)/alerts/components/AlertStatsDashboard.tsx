'use client'

import React, { useMemo } from 'react'
import { Alert, AlertTrigger, AlertStatistics } from '@/lib/api/alerts-data'

interface AlertStatsDashboardProps {
  statistics: AlertStatistics
  triggers: AlertTrigger[]
  alerts: Alert[]
}

interface ChartData {
  name: string
  value: number
  color: string
}

interface TimeSeriesData {
  date: string
  triggers: number
  alerts: number
}

export function AlertStatsDashboard({
  statistics,
  triggers,
  alerts
}: AlertStatsDashboardProps) {

  // Priority distribution
  const priorityData = useMemo((): ChartData[] => {
    const priorityCounts = alerts.reduce((acc, alert) => {
      acc[alert.priority] = (acc[alert.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return [
      { name: 'Critical', value: priorityCounts.critical || 0, color: '#ef4444' },
      { name: 'High', value: priorityCounts.high || 0, color: '#f97316' },
      { name: 'Medium', value: priorityCounts.medium || 0, color: '#eab308' },
      { name: 'Low', value: priorityCounts.low || 0, color: '#3b82f6' }
    ]
  }, [alerts])

  // Symbol distribution (top 10)
  const symbolData = useMemo((): ChartData[] => {
    const symbolCounts = alerts.reduce((acc, alert) => {
      acc[alert.symbol] = (acc[alert.symbol] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(symbolCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([symbol, count], index) => ({
        name: symbol,
        value: count,
        color: `hsl(${(index * 36) % 360}, 70%, 50%)`
      }))
  }, [alerts])

  // Trigger trend data (last 30 days)
  const triggerTrendData = useMemo((): TimeSeriesData[] => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return date.toISOString().split('T')[0]
    })

    return last30Days.map(date => {
      const dayTriggers = triggers.filter(trigger =>
        trigger.triggeredAt.startsWith(date)
      ).length

      const dayAlerts = alerts.filter(alert =>
        alert.createdAt.startsWith(date)
      ).length

      return {
        date,
        triggers: dayTriggers,
        alerts: dayAlerts
      }
    })
  }, [triggers, alerts])

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    const totalConditions = alerts.reduce((sum, alert) => sum + alert.conditions.length, 0)
    const avgConditionsPerAlert = alerts.length > 0 ? totalConditions / alerts.length : 0

    const activeAlerts = alerts.filter(alert => alert.isActive)
    const activeTriggers = triggers.filter(trigger => {
      const alert = alerts.find(a => a.id === trigger.alertId)
      return alert?.isActive
    })

    const avgTriggersPerActiveAlert = activeAlerts.length > 0 ? activeTriggers.length / activeAlerts.length : 0

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentTriggers = triggers.filter(trigger => new Date(trigger.triggeredAt) > last24Hours)

    return {
      avgConditionsPerAlert: avgConditionsPerAlert.toFixed(1),
      avgTriggersPerActiveAlert: avgTriggersPerActiveAlert.toFixed(1),
      triggersLast24h: recentTriggers.length,
      falsePositiveRate: statistics.falsePositiveRate
    }
  }, [alerts, triggers, statistics])

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {statistics.totalAlerts}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Alerts</div>
            </div>
            <div className="w-8 h-8 text-blue-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5V3a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h5.5" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-1">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {statistics.activeAlerts}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Alerts</div>
            </div>
            <div className="w-8 h-8 text-green-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-1">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {statistics.triggeredToday}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Triggered Today</div>
            </div>
            <div className="w-8 h-8 text-orange-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-1">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatPercent(statistics.successRate)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
            </div>
            <div className="w-8 h-8 text-purple-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {performanceMetrics.avgConditionsPerAlert}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Avg Conditions/Alert</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {performanceMetrics.avgTriggersPerActiveAlert}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Avg Triggers/Alert</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {performanceMetrics.triggersLast24h}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Triggers (24h)</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatPercent(performanceMetrics.falsePositiveRate)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">False Positive Rate</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Alert Priority Distribution
          </h3>
          <div className="space-y-3">
            {priorityData.map((item) => {
              const total = priorityData.reduce((sum, d) => sum + d.value, 0)
              const percentage = total > 0 ? (item.value / total) * 100 : 0

              return (
                <div key={item.name} className="flex items-center">
                  <div className="flex-1 flex items-center">
                    <div
                      className="w-4 h-4 rounded mr-3"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-16">
                      {item.name}
                    </span>
                    <div className="flex-1 mx-3">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: item.color,
                            width: `${percentage}%`
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                      {item.value}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Symbols */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Symbols by Alert Count
          </h3>
          <div className="space-y-3">
            {symbolData.slice(0, 8).map((item, index) => {
              const maxValue = Math.max(...symbolData.map(d => d.value))
              const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0

              return (
                <div key={item.name} className="flex items-center">
                  <div className="flex-1 flex items-center">
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300 w-12">
                      {item.name}
                    </span>
                    <div className="flex-1 mx-3">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: item.color,
                            width: `${percentage}%`
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right">
                      {item.value}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Trigger Timeline */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Trigger Activity (Last 30 Days)
        </h3>
        <div className="h-64 flex items-end justify-between gap-1">
          {triggerTrendData.map((data, index) => {
            const maxTriggers = Math.max(...triggerTrendData.map(d => d.triggers))
            const height = maxTriggers > 0 ? (data.triggers / maxTriggers) * 240 : 0
            const date = new Date(data.date)

            return (
              <div key={data.date} className="flex flex-col items-center">
                <div
                  className="w-2 bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                  style={{ height: Math.max(height, 2) }}
                  title={`${date.toLocaleDateString()}: ${data.triggers} triggers`}
                />
                {index % 5 === 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 transform -rotate-45 origin-left">
                    {date.getMonth() + 1}/{date.getDate()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div className="space-y-3">
          {triggers.slice(0, 5).map((trigger) => {
            const alert = alerts.find(a => a.id === trigger.alertId)
            const timeAgo = new Date(Date.now() - new Date(trigger.triggeredAt).getTime())
            const hoursAgo = Math.floor(timeAgo.getTime() / (1000 * 60 * 60))

            return (
              <div key={trigger.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    alert?.priority === 'critical' ? 'bg-red-500' :
                    alert?.priority === 'high' ? 'bg-orange-500' :
                    alert?.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {alert?.name || 'Unknown Alert'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {alert?.symbol} • {trigger.message}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {hoursAgo < 1 ? 'Just now' : `${hoursAgo}h ago`}
                </div>
              </div>
            )
          })}

          {triggers.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No recent trigger activity
            </div>
          )}
        </div>
      </div>
    </div>
  )
}