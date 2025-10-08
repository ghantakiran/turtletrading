'use client'

/**
 * Notification Preferences Component
 * Allows users to configure which types of notifications they want to receive
 */

import { Bell, Newspaper, Brain, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NotificationPreferencesType {
  priceAlerts: boolean
  newsAlerts: boolean
  aiSignals: boolean
  portfolioUpdates: boolean
}

interface NotificationPreferencesProps {
  preferences: NotificationPreferencesType
  onChange: (preferences: NotificationPreferencesType) => void
  disabled?: boolean
}

interface PreferenceItem {
  key: keyof NotificationPreferencesType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconTestId: string
}

export function NotificationPreferences({
  preferences,
  onChange,
  disabled = false,
}: NotificationPreferencesProps) {
  const preferenceItems: PreferenceItem[] = [
    {
      key: 'priceAlerts',
      label: 'Price Alerts',
      description: 'Get notified when stocks reach target prices',
      icon: Bell,
      iconTestId: 'price-icon',
    },
    {
      key: 'newsAlerts',
      label: 'News Alerts',
      description: 'Breaking news affecting your watchlist',
      icon: Newspaper,
      iconTestId: 'news-icon',
    },
    {
      key: 'aiSignals',
      label: 'AI Signals',
      description: 'LSTM predictions and trend reversals',
      icon: Brain,
      iconTestId: 'ai-icon',
    },
    {
      key: 'portfolioUpdates',
      label: 'Portfolio Updates',
      description: 'Daily performance summaries and insights',
      icon: PieChart,
      iconTestId: 'portfolio-icon',
    },
  ]

  const handleToggle = (key: keyof NotificationPreferencesType) => {
    if (disabled) return

    onChange({
      ...preferences,
      [key]: !preferences[key],
    })
  }

  const handleMasterToggle = () => {
    if (disabled) return

    // Check if all are enabled
    const allEnabled = Object.values(preferences).every(value => value === true)

    // Toggle all to opposite state
    const newState = !allEnabled

    onChange({
      priceAlerts: newState,
      newsAlerts: newState,
      aiSignals: newState,
      portfolioUpdates: newState,
    })
  }

  const allEnabled = Object.values(preferences).every(value => value === true)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Notification Preferences</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose which notifications you want to receive
        </p>
      </div>

      {/* Master Toggle */}
      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <label htmlFor="master-toggle" className="font-medium text-sm cursor-pointer">
              Enable All Notifications
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Turn all notification types on or off
            </p>
          </div>
        </div>
        <input
          type="checkbox"
          id="master-toggle"
          checked={allEnabled}
          onChange={handleMasterToggle}
          disabled={disabled}
          className={cn(
            'w-11 h-6 rounded-full appearance-none cursor-pointer',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            allEnabled
              ? 'bg-blue-600'
              : 'bg-gray-300 dark:bg-gray-600',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      </div>

      {/* Individual Preferences */}
      <div className="space-y-3">
        {preferenceItems.map(({ key, label, description, icon: Icon, iconTestId }) => (
          <div
            key={key}
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border',
              'bg-white dark:bg-slate-800',
              'border-gray-200 dark:border-gray-700',
              disabled && 'opacity-60'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Icon data-testid={iconTestId} className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </div>
              <div>
                <label htmlFor={key} className="font-medium text-sm cursor-pointer">
                  {label}
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {description}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              id={key}
              checked={preferences[key]}
              onChange={() => handleToggle(key)}
              disabled={disabled}
              className={cn(
                'w-11 h-6 rounded-full appearance-none cursor-pointer',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                preferences[key]
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600',
                disabled && 'cursor-not-allowed'
              )}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
