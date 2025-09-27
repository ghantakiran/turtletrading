'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Alert } from '@/lib/api/alerts-data'

interface AlertManagementProps {
  alerts: Alert[]
  filters: {
    status: 'all' | 'active' | 'inactive' | 'triggered'
    priority: 'all' | 'low' | 'medium' | 'high' | 'critical'
    symbol: string
    search: string
  }
  onFiltersChange: (filters: any) => void
  sortBy: 'name' | 'created' | 'priority' | 'lastTriggered'
  onSortByChange: (sortBy: any) => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (order: any) => void
  onUpdateAlert: (id: string, updates: Partial<Alert>) => Promise<void>
  onDeleteAlert: (id: string) => Promise<void>
  onEditAlert: (alert: Alert) => void
  isLoading: boolean
}

interface SortableAlertRowProps {
  alert: Alert
  onUpdateAlert: (id: string, updates: Partial<Alert>) => Promise<void>
  onDeleteAlert: (id: string) => Promise<void>
  onEditAlert: (alert: Alert) => void
  isLoading: boolean
}

function SortableAlertRow({ alert, onUpdateAlert, onDeleteAlert, onEditAlert, isLoading }: SortableAlertRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: alert.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${
        isDragging ? 'shadow-lg' : 'shadow-sm'
      } transition-shadow`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>

          {/* Status Toggle */}
          <button
            onClick={() => onUpdateAlert(alert.id, { isActive: !alert.isActive })}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              alert.isActive
                ? 'bg-blue-600'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
            title={alert.isActive ? 'Active' : 'Inactive'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                alert.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>

          {/* Alert Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {alert.name}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {alert.symbol}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(alert.priority)}`}>
                {alert.priority.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>{alert.conditions.length} condition{alert.conditions.length !== 1 ? 's' : ''}</span>
              <span>{alert.logic} logic</span>
              <span>Created {formatDate(alert.createdAt)}</span>
              {alert.lastTriggered && (
                <span className="text-orange-600 dark:text-orange-400">
                  Last triggered {formatDate(alert.lastTriggered)}
                </span>
              )}
              {alert.triggerCount > 0 && (
                <span className="text-blue-600 dark:text-blue-400">
                  {alert.triggerCount} trigger{alert.triggerCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {alert.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                {alert.description}
              </p>
            )}

            {/* Tags */}
            {alert.tags && alert.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {alert.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {alert.isMuted && (
            <span className="p-2 text-gray-400" title="Muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipPath="url(#clip0)" />
                <defs>
                  <clipPath id="clip0">
                    <path d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </clipPath>
                </defs>
              </svg>
            </span>
          )}

          {alert.snoozeUntil && new Date(alert.snoozeUntil) > new Date() && (
            <span className="p-2 text-yellow-500" title={`Snoozed until ${formatDate(alert.snoozeUntil)}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          )}

          <button
            onClick={() => onEditAlert(alert)}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="Edit alert"
            disabled={isLoading}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          <button
            onClick={() => onDeleteAlert(alert.id)}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete alert"
            disabled={isLoading}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export function AlertManagement({
  alerts,
  filters,
  onFiltersChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onUpdateAlert,
  onDeleteAlert,
  onEditAlert,
  isLoading
}: AlertManagementProps) {
  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              placeholder="Search alerts..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="triggered">Recently Triggered</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={filters.priority}
              onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Symbol
            </label>
            <input
              type="text"
              value={filters.symbol}
              onChange={(e) => onFiltersChange({ ...filters, symbol: e.target.value.toUpperCase() })}
              placeholder="e.g., AAPL"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sort By
            </label>
            <div className="flex gap-1">
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="created">Created</option>
                <option value="name">Name</option>
                <option value="priority">Priority</option>
                <option value="lastTriggered">Last Triggered</option>
              </select>
              <button
                onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {alerts.length === 0 ? 'No alerts' : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`}
        </div>

        {alerts.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Drag to reorder alerts
          </div>
        )}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-5 5V2H5a2 2 0 00-2 2v16a2 2 0 002 2h8.5" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Alerts Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {Object.values(filters).some(v => v !== 'all' && v !== '')
                ? 'No alerts match the current filters.'
                : 'Get started by creating your first alert.'}
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <SortableAlertRow
              key={alert.id}
              alert={alert}
              onUpdateAlert={onUpdateAlert}
              onDeleteAlert={onDeleteAlert}
              onEditAlert={onEditAlert}
              isLoading={isLoading}
            />
          ))
        )}
      </div>

      {/* Bulk Actions */}
      {alerts.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {}}
              className="btn-secondary text-sm"
              disabled={isLoading}
            >
              Export Alerts
            </button>
            <button
              onClick={() => {}}
              className="btn-secondary text-sm"
              disabled={isLoading}
            >
              Bulk Edit
            </button>
            <button
              onClick={() => {}}
              className="btn-secondary text-sm text-red-700 dark:text-red-300"
              disabled={isLoading}
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}
    </div>
  )
}