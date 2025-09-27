'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Alert, AlertTrigger } from '@/lib/api/alerts-data'
import { useUIStore } from '@/stores/uiStore'

interface NotificationCenterProps {
  triggers: AlertTrigger[]
  alerts: Alert[]
  onUpdateAlert: (id: string, updates: Partial<Alert>) => Promise<void>
  isLoading: boolean
}

interface TriggerWithAlert extends AlertTrigger {
  alert?: Alert
}

export function NotificationCenter({
  triggers,
  alerts,
  onUpdateAlert,
  isLoading
}: NotificationCenterProps) {
  const { showNotification } = useUIStore()
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerWithAlert | null>(null)
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'unread' | 'acknowledged' | 'snoozed',
    priority: 'all' as 'all' | 'low' | 'medium' | 'high' | 'critical',
    timeRange: '24h' as '1h' | '6h' | '24h' | '7d' | '30d' | 'all'
  })

  // Enhance triggers with alert information
  const triggersWithAlerts = useMemo((): TriggerWithAlert[] => {
    return triggers.map(trigger => ({
      ...trigger,
      alert: alerts.find(a => a.id === trigger.alertId)
    }))
  }, [triggers, alerts])

  // Filter triggers
  const filteredTriggers = useMemo(() => {
    let filtered = triggersWithAlerts

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(trigger => {
        switch (filters.status) {
          case 'unread':
            return !trigger.isRead
          case 'acknowledged':
            return trigger.isAcknowledged
          case 'snoozed':
            return trigger.alert?.snoozeUntil && new Date(trigger.alert.snoozeUntil) > new Date()
          default:
            return true
        }
      })
    }

    // Priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(trigger => trigger.alert?.priority === filters.priority)
    }

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date()
      const timeMap = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      }
      const cutoff = new Date(now.getTime() - timeMap[filters.timeRange])
      filtered = filtered.filter(trigger => new Date(trigger.triggeredAt) > cutoff)
    }

    return filtered.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
  }, [triggersWithAlerts, filters])

  // Stats
  const stats = useMemo(() => {
    const total = triggersWithAlerts.length
    const unread = triggersWithAlerts.filter(t => !t.isRead).length
    const acknowledged = triggersWithAlerts.filter(t => t.isAcknowledged).length
    const critical = triggersWithAlerts.filter(t => t.alert?.priority === 'critical').length

    return { total, unread, acknowledged, critical }
  }, [triggersWithAlerts])

  // Actions
  const handleMarkAsRead = useCallback(async (triggerId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300))
      showNotification('Notification marked as read', 'success')
    } catch (error) {
      showNotification('Failed to mark notification as read', 'error')
    }
  }, [showNotification])

  const handleAcknowledge = useCallback(async (triggerId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300))
      showNotification('Notification acknowledged', 'success')
    } catch (error) {
      showNotification('Failed to acknowledge notification', 'error')
    }
  }, [showNotification])

  const handleSnoozeAlert = useCallback(async (alertId: string, hours: number) => {
    try {
      const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
      await onUpdateAlert(alertId, { snoozeUntil })
      showNotification(`Alert snoozed for ${hours} hours`, 'success')
    } catch (error) {
      showNotification('Failed to snooze alert', 'error')
    }
  }, [onUpdateAlert, showNotification])

  const handleMuteAlert = useCallback(async (alertId: string) => {
    try {
      await onUpdateAlert(alertId, { isMuted: true })
      showNotification('Alert muted', 'success')
    } catch (error) {
      showNotification('Failed to mute alert', 'error')
    }
  }, [onUpdateAlert, showNotification])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Notifications</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.unread}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Unread</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.acknowledged}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Acknowledged</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.critical}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Critical</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="snoozed">Snoozed</option>
            </select>
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Range
            </label>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: 'all', priority: 'all', timeRange: '24h' })}
              className="px-4 py-2 text-sm btn-secondary"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredTriggers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-5 5V3a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h5.5" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Notifications
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              No notifications match the current filters.
            </p>
          </div>
        ) : (
          filteredTriggers.map((trigger) => (
            <div
              key={trigger.id}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-4 transition-colors ${
                trigger.isRead
                  ? 'border-gray-200 dark:border-gray-700'
                  : 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {trigger.alert?.name || 'Unknown Alert'}
                    </h4>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {trigger.alert?.symbol}
                    </span>
                    {trigger.alert?.priority && (
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(trigger.alert.priority)}`}>
                        {trigger.alert.priority.toUpperCase()}
                      </span>
                    )}
                    {!trigger.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                    {trigger.message}
                  </p>

                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-4">
                    <span>Triggered {formatTimeAgo(trigger.triggeredAt)}</span>
                    <span>Value: {trigger.value}</span>
                    <span>Threshold: {trigger.threshold}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {!trigger.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(trigger.id)}
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Mark as read"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}

                  {!trigger.isAcknowledged && (
                    <button
                      onClick={() => handleAcknowledge(trigger.id)}
                      className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                      title="Acknowledge"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}

                  <div className="relative group">
                    <button
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="More actions"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>

                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <div className="p-1">
                        <button
                          onClick={() => trigger.alert && handleSnoozeAlert(trigger.alert.id, 1)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          Snooze 1 hour
                        </button>
                        <button
                          onClick={() => trigger.alert && handleSnoozeAlert(trigger.alert.id, 24)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          Snooze 24 hours
                        </button>
                        <button
                          onClick={() => trigger.alert && handleMuteAlert(trigger.alert.id)}
                          className="w-full text-left px-3 py-2 text-sm text-red-700 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          Mute alert
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {filteredTriggers.length > 0 && (
        <div className="text-center">
          <button
            onClick={() => {}}
            className="btn-secondary"
            disabled={isLoading}
          >
            Load More Notifications
          </button>
        </div>
      )}
    </div>
  )
}