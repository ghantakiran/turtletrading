'use client'

import React, { useState, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Alert, AlertCondition } from '@/lib/api/alerts-data'
import { AlertBuilderState } from '../AlertsClient'

interface AlertBuilderProps {
  alerts: Alert[]
  builderState: AlertBuilderState
  onStateChange: (state: AlertBuilderState) => void
  onCreateAlert: (alert: Partial<Alert>) => Promise<void>
  onUpdateAlert: (id: string, updates: Partial<Alert>) => Promise<void>
  onTestAlert: (alert: Alert) => Promise<void>
  isLoading: boolean
  showWizard: boolean
  onCloseWizard: () => void
}

interface DraggableConditionProps {
  condition: AlertCondition
  index: number
  onUpdate: (index: number, condition: AlertCondition) => void
  onRemove: (index: number) => void
  isEditable: boolean
}

function DraggableCondition({ condition, index, onUpdate, onRemove, isEditable }: DraggableConditionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: condition.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const conditionTypes = [
    { value: 'price_above', label: 'Price Above', fields: ['value'] },
    { value: 'price_below', label: 'Price Below', fields: ['value'] },
    { value: 'volume_spike', label: 'Volume Spike', fields: ['threshold'] },
    { value: 'rsi_overbought', label: 'RSI Overbought', fields: ['value'] },
    { value: 'rsi_oversold', label: 'RSI Oversold', fields: ['value'] },
    { value: 'macd_bullish_crossover', label: 'MACD Bullish Cross', fields: [] },
    { value: 'macd_bearish_crossover', label: 'MACD Bearish Cross', fields: [] },
    { value: 'bollinger_upper_breach', label: 'Bollinger Upper Breach', fields: [] },
    { value: 'bollinger_lower_breach', label: 'Bollinger Lower Breach', fields: [] },
    { value: 'regime_change', label: 'Regime Change', fields: ['sensitivity'] },
    { value: 'anomaly_detected', label: 'Anomaly Detected', fields: ['sensitivity'] },
    { value: 'volatility_spike', label: 'Volatility Spike', fields: ['threshold'] }
  ]

  const currentType = conditionTypes.find(t => t.value === condition.type)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${
        isDragging ? 'shadow-lg' : 'shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {isEditable && (
          <button
            {...attributes}
            {...listeners}
            className="mt-1 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>
        )}

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Condition Type
              </label>
              <select
                value={condition.type}
                onChange={(e) => onUpdate(index, { ...condition, type: e.target.value as any })}
                disabled={!isEditable}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50"
              >
                {conditionTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Operator
              </label>
              <select
                value={condition.operator}
                onChange={(e) => onUpdate(index, { ...condition, operator: e.target.value as any })}
                disabled={!isEditable}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50"
              >
                <option value=">">Greater Than</option>
                <option value="<">Less Than</option>
                <option value=">=">Greater Than or Equal</option>
                <option value="<=">Less Than or Equal</option>
                <option value="=">Equal To</option>
                <option value="!=">Not Equal To</option>
                <option value="contains">Contains</option>
                <option value="between">Between</option>
              </select>
            </div>
          </div>

          {/* Dynamic value fields based on condition type */}
          <div className="flex flex-wrap gap-3">
            {currentType?.fields.includes('value') && (
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Value
                </label>
                <input
                  type="number"
                  value={typeof condition.value === 'number' ? condition.value : ''}
                  onChange={(e) => onUpdate(index, { ...condition, value: parseFloat(e.target.value) || 0 })}
                  disabled={!isEditable}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50"
                  placeholder="Enter value"
                />
              </div>
            )}

            {currentType?.fields.includes('threshold') && (
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Threshold
                </label>
                <input
                  type="number"
                  value={condition.threshold || ''}
                  onChange={(e) => onUpdate(index, { ...condition, threshold: parseFloat(e.target.value) || undefined })}
                  disabled={!isEditable}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50"
                  placeholder="Enter threshold"
                />
              </div>
            )}

            {currentType?.fields.includes('sensitivity') && (
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sensitivity
                </label>
                <select
                  value={condition.sensitivity || 'medium'}
                  onChange={(e) => onUpdate(index, { ...condition, sensitivity: e.target.value as any })}
                  disabled={!isEditable}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {isEditable && (
          <button
            onClick={() => onRemove(index)}
            className="mt-1 p-1 text-red-400 hover:text-red-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export function AlertBuilder({
  alerts,
  builderState,
  onStateChange,
  onCreateAlert,
  onUpdateAlert,
  onTestAlert,
  isLoading,
  showWizard,
  onCloseWizard
}: AlertBuilderProps) {
  const [formData, setFormData] = useState<Partial<Alert>>({
    name: '',
    description: '',
    symbol: '',
    conditions: [],
    logic: 'AND',
    isActive: true,
    priority: 'medium',
    notificationMethods: ['push'],
    tags: [],
    cooldownPeriod: 60,
    maxTriggers: undefined
  })

  const updateCondition = useCallback((index: number, condition: AlertCondition) => {
    const newConditions = [...(formData.conditions || [])]
    newConditions[index] = condition
    setFormData(prev => ({ ...prev, conditions: newConditions }))
  }, [formData.conditions])

  const removeCondition = useCallback((index: number) => {
    const newConditions = (formData.conditions || []).filter((_, i) => i !== index)
    setFormData(prev => ({ ...prev, conditions: newConditions }))
  }, [formData.conditions])

  const addCondition = useCallback(() => {
    const newCondition: AlertCondition = {
      id: `condition-${Date.now()}`,
      type: 'price_above',
      field: 'price',
      operator: '>',
      value: 0
    }
    setFormData(prev => ({
      ...prev,
      conditions: [...(prev.conditions || []), newCondition]
    }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formData.name || !formData.symbol || !formData.conditions?.length) {
      alert('Please fill in all required fields and add at least one condition.')
      return
    }

    try {
      if (builderState.isEditing && builderState.currentAlert?.id) {
        await onUpdateAlert(builderState.currentAlert.id, formData)
      } else {
        await onCreateAlert(formData)
      }
      setFormData({
        name: '',
        description: '',
        symbol: '',
        conditions: [],
        logic: 'AND',
        isActive: true,
        priority: 'medium',
        notificationMethods: ['push'],
        tags: [],
        cooldownPeriod: 60,
        maxTriggers: undefined
      })
    } catch (error) {
      console.error('Error saving alert:', error)
    }
  }, [formData, builderState.isEditing, builderState.currentAlert, onCreateAlert, onUpdateAlert])

  // Initialize form when editing
  React.useEffect(() => {
    if (builderState.currentAlert && builderState.isEditing) {
      setFormData(builderState.currentAlert)
    }
  }, [builderState.currentAlert, builderState.isEditing])

  if (!showWizard) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-5 5V2H5a2 2 0 00-2 2v16a2 2 0 002 2h8.5" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l2 2-2 2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Alert Builder
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Create advanced alerts with multi-condition logic and drag-and-drop thresholds.
        </p>
        <button
          onClick={() => onStateChange({ ...builderState, currentAlert: null, isEditing: false })}
          className="btn-primary mr-3"
        >
          Start Building
        </button>
        <span className="text-sm text-gray-500">
          or press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">⌘N</kbd> for new alert
        </span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {/* Wizard Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {builderState.isEditing ? 'Edit Alert' : 'Create New Alert'}
            </h2>
            <button
              onClick={onCloseWizard}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Alert Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Enter alert name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Symbol *
              </label>
              <input
                type="text"
                value={formData.symbol || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., AAPL"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Optional description for this alert"
            />
          </div>

          {/* Alert Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <select
                value={formData.priority || 'medium'}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Logic
              </label>
              <select
                value={formData.logic || 'AND'}
                onChange={(e) => setFormData(prev => ({ ...prev, logic: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="AND">All conditions must match (AND)</option>
                <option value="OR">Any condition can match (OR)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cooldown (seconds)
              </label>
              <input
                type="number"
                value={formData.cooldownPeriod || 60}
                onChange={(e) => setFormData(prev => ({ ...prev, cooldownPeriod: parseInt(e.target.value) || 60 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                min="0"
              />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Conditions *
              </h3>
              <button
                onClick={addCondition}
                className="btn-secondary"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Condition
              </button>
            </div>

            {formData.conditions?.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">
                  No conditions added yet. Click "Add Condition" to get started.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {formData.conditions?.map((condition, index) => (
                <DraggableCondition
                  key={condition.id}
                  condition={condition}
                  index={index}
                  onUpdate={updateCondition}
                  onRemove={removeCondition}
                  isEditable={true}
                />
              ))}
            </div>
          </div>

          {/* Test Results */}
          {builderState.testResults.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Test Results</h4>
              <div className="space-y-2">
                {builderState.testResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{result.condition}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      result.result === 'PASS'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {result.result} ({result.value} vs {result.threshold})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive ?? true}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
              Alert is active
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCloseWizard}
              className="btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            {formData.conditions?.length > 0 && (
              <button
                onClick={() => onTestAlert(formData as Alert)}
                className="btn-secondary"
                disabled={isLoading || builderState.isTestingAlert}
              >
                {builderState.isTestingAlert ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Testing...
                  </>
                ) : (
                  'Test Alert'
                )}
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="btn-primary"
              disabled={isLoading || !formData.name || !formData.symbol || !formData.conditions?.length}
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                builderState.isEditing ? 'Update Alert' : 'Create Alert'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}