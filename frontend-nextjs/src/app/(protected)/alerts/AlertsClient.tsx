'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { AlertsResponse, Alert, AlertCondition, AlertTrigger, AlertStatistics } from '@/lib/api/alerts-data'
import { useUIStore } from '@/stores/uiStore'
import { AlertBuilder } from './components/AlertBuilder'
import { NotificationCenter } from './components/NotificationCenter'
import { AlertStatsDashboard } from './components/AlertStatsDashboard'
import { AlertManagement } from './components/AlertManagement'

interface AlertsClientProps {
  initialData: AlertsResponse
}

export interface AlertBuilderState {
  currentAlert: Partial<Alert> | null
  isEditing: boolean
  isTestingAlert: boolean
  testResults: any[]
  dragThresholds: Record<string, number>
}

export function AlertsClient({ initialData }: AlertsClientProps) {
  const { showNotification } = useUIStore()

  // Main state
  const [alerts, setAlerts] = useState<Alert[]>(initialData.alerts)
  const [triggers, setTriggers] = useState<AlertTrigger[]>(initialData.triggers)
  const [statistics, setStatistics] = useState<AlertStatistics>(initialData.statistics)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [activeTab, setActiveTab] = useState<'builder' | 'notifications' | 'management' | 'stats'>('builder')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  // Alert builder state
  const [builderState, setBuilderState] = useState<AlertBuilderState>({
    currentAlert: null,
    isEditing: false,
    isTestingAlert: false,
    testResults: [],
    dragThresholds: {}
  })

  // Filters and sorting
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'active' | 'inactive' | 'triggered',
    priority: 'all' as 'all' | 'low' | 'medium' | 'high' | 'critical',
    symbol: '',
    search: ''
  })
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'priority' | 'lastTriggered'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Filtered and sorted alerts
  const filteredAlerts = useMemo(() => {
    let filtered = alerts.filter(alert => {
      if (filters.status !== 'all') {
        if (filters.status === 'active' && !alert.isActive) return false
        if (filters.status === 'inactive' && alert.isActive) return false
        if (filters.status === 'triggered' && !alert.lastTriggered) return false
      }
      if (filters.priority !== 'all' && alert.priority !== filters.priority) return false
      if (filters.symbol && !alert.symbol.toLowerCase().includes(filters.symbol.toLowerCase())) return false
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        if (!alert.name.toLowerCase().includes(searchLower) &&
            !alert.description?.toLowerCase().includes(searchLower)) return false
      }
      return true
    })

    // Sort alerts
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      switch (sortBy) {
        case 'name':
          aValue = a.name
          bValue = b.name
          break
        case 'created':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
          aValue = priorityOrder[a.priority]
          bValue = priorityOrder[b.priority]
          break
        case 'lastTriggered':
          aValue = a.lastTriggered ? new Date(a.lastTriggered).getTime() : 0
          bValue = b.lastTriggered ? new Date(b.lastTriggered).getTime() : 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [alerts, filters, sortBy, sortOrder])

  // Recent triggers (last 24 hours)
  const recentTriggers = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return triggers
      .filter(trigger => new Date(trigger.triggeredAt) > yesterday)
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
      .slice(0, 20)
  }, [triggers])

  // Alert operations
  const handleCreateAlert = useCallback(async (alertData: Partial<Alert>) => {
    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      const newAlert: Alert = {
        id: `alert-${Date.now()}`,
        name: alertData.name || 'New Alert',
        description: alertData.description,
        symbol: alertData.symbol || '',
        conditions: alertData.conditions || [],
        logic: alertData.logic || 'AND',
        isActive: alertData.isActive ?? true,
        priority: alertData.priority || 'medium',
        notificationMethods: alertData.notificationMethods || ['push'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user',
        triggerCount: 0,
        lastTriggered: null,
        tags: alertData.tags || [],
        cooldownPeriod: alertData.cooldownPeriod || 60,
        maxTriggers: alertData.maxTriggers,
        snoozeUntil: null,
        isMuted: false
      }

      setAlerts(prev => [newAlert, ...prev])
      setStatistics(prev => ({
        ...prev,
        totalAlerts: prev.totalAlerts + 1,
        activeAlerts: prev.activeAlerts + (newAlert.isActive ? 1 : 0)
      }))

      showNotification('Alert created successfully', 'success')
      setShowWizard(false)
      setBuilderState(prev => ({ ...prev, currentAlert: null, isEditing: false }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create alert'
      setError(message)
      showNotification(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showNotification])

  const handleUpdateAlert = useCallback(async (alertId: string, updates: Partial<Alert>) => {
    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))

      setAlerts(prev => prev.map(alert =>
        alert.id === alertId
          ? { ...alert, ...updates, updatedAt: new Date().toISOString() }
          : alert
      ))

      // Update statistics if active status changed
      if ('isActive' in updates) {
        setStatistics(prev => ({
          ...prev,
          activeAlerts: alerts.filter(a => a.id === alertId ? updates.isActive : a.isActive).length
        }))
      }

      showNotification('Alert updated successfully', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update alert'
      setError(message)
      showNotification(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [alerts, showNotification])

  const handleDeleteAlert = useCallback(async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return

    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300))

      const alertToDelete = alerts.find(a => a.id === alertId)
      setAlerts(prev => prev.filter(alert => alert.id !== alertId))

      setStatistics(prev => ({
        ...prev,
        totalAlerts: prev.totalAlerts - 1,
        activeAlerts: prev.activeAlerts - (alertToDelete?.isActive ? 1 : 0)
      }))

      showNotification('Alert deleted successfully', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete alert'
      setError(message)
      showNotification(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [alerts, showNotification])

  const handleTestAlert = useCallback(async (alert: Alert) => {
    setBuilderState(prev => ({ ...prev, isTestingAlert: true, testResults: [] }))

    try {
      // Simulate API call for testing alert
      await new Promise(resolve => setTimeout(resolve, 2000))

      const testResults = [
        { condition: 'Price Above $150', result: 'PASS', value: 156.78, threshold: 150 },
        { condition: 'RSI Overbought', result: 'FAIL', value: 67.4, threshold: 70 },
        { condition: 'Volume Spike', result: 'PASS', value: 1250000, threshold: 1000000 }
      ]

      setBuilderState(prev => ({ ...prev, testResults, isTestingAlert: false }))
      showNotification(`Alert test completed - ${testResults.filter(r => r.result === 'PASS').length}/${testResults.length} conditions passed`, 'info')
    } catch (error) {
      setBuilderState(prev => ({ ...prev, isTestingAlert: false }))
      showNotification('Alert test failed', 'error')
    }
  }, [showNotification])

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setAlerts(items => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'n':
            event.preventDefault()
            setShowWizard(true)
            break
          case '1':
            event.preventDefault()
            setActiveTab('builder')
            break
          case '2':
            event.preventDefault()
            setActiveTab('notifications')
            break
          case '3':
            event.preventDefault()
            setActiveTab('management')
            break
          case '4':
            event.preventDefault()
            setActiveTab('stats')
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Alerts & Notifications
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create advanced alerts with multi-condition builders and track all notifications
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWizard(true)}
            className="btn-primary"
            disabled={isLoading}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Alert
          </button>
          <button
            onClick={() => {
              setFilters({ status: 'all', priority: 'all', symbol: '', search: '' })
              setSortBy('created')
              setSortOrder('desc')
            }}
            className="btn-secondary"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto pl-3"
            >
              <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: 'builder', name: 'Alert Builder', shortcut: '⌘1' },
            { id: 'notifications', name: 'Notification Center', shortcut: '⌘2' },
            { id: 'management', name: 'Alert Management', shortcut: '⌘3' },
            { id: 'stats', name: 'Statistics', shortcut: '⌘4' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.name}
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {tab.shortcut}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        {activeTab === 'builder' && (
          <AlertBuilder
            alerts={filteredAlerts}
            builderState={builderState}
            onStateChange={setBuilderState}
            onCreateAlert={handleCreateAlert}
            onUpdateAlert={handleUpdateAlert}
            onTestAlert={handleTestAlert}
            isLoading={isLoading}
            showWizard={showWizard}
            onCloseWizard={() => setShowWizard(false)}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationCenter
            triggers={recentTriggers}
            alerts={alerts}
            onUpdateAlert={handleUpdateAlert}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'management' && (
          <SortableContext items={filteredAlerts} strategy={verticalListSortingStrategy}>
            <AlertManagement
              alerts={filteredAlerts}
              filters={filters}
              onFiltersChange={setFilters}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onUpdateAlert={handleUpdateAlert}
              onDeleteAlert={handleDeleteAlert}
              onEditAlert={(alert) => {
                setBuilderState(prev => ({ ...prev, currentAlert: alert, isEditing: true }))
                setActiveTab('builder')
                setShowWizard(true)
              }}
              isLoading={isLoading}
            />
          </SortableContext>
        )}

        {activeTab === 'stats' && (
          <AlertStatsDashboard
            statistics={statistics}
            triggers={triggers}
            alerts={alerts}
          />
        )}
      </DndContext>
    </div>
  )
}