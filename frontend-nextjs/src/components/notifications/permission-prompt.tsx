'use client'

/**
 * Notification Permission Prompt Component
 * Displays a dialog to request notification permissions from users
 * Shows benefits and handles permission grant/denial
 */

import { useState } from 'react'
import { Bell, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { notificationManager } from '@/lib/notifications/permission-manager'
import { cn } from '@/lib/utils'

interface NotificationPermissionPromptProps {
  open: boolean
  onPermissionGranted: () => void
  onPermissionDenied: () => void
  onClose?: () => void
}

export function NotificationPermissionPrompt({
  open,
  onPermissionGranted,
  onPermissionDenied,
  onClose,
}: NotificationPermissionPromptProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const isSupported = notificationManager.isSupported()

  const handleEnable = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const permission = await notificationManager.requestPermission()

      if (permission === 'granted') {
        // Subscribe to push notifications
        await notificationManager.subscribe()
        onPermissionGranted()
      } else {
        onPermissionDenied()
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to enable notifications')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMaybeLater = () => {
    if (onClose) {
      onClose()
    }
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
    }
  }

  if (!isSupported) {
    return (
      <div
        role="dialog"
        aria-labelledby="notification-prompt-title"
        aria-describedby="notification-prompt-description"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-orange-500" />
              <h2 id="notification-prompt-title" className="text-xl font-semibold">
                Notifications Not Supported
              </h2>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p id="notification-prompt-description" className="text-gray-600 dark:text-gray-300">
            Your browser does not support notifications. Please use a modern browser like Chrome, Firefox, or Safari.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-labelledby="notification-prompt-title"
      aria-describedby="notification-prompt-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Bell data-testid="notification-icon" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 id="notification-prompt-title" className="text-xl font-semibold">
              Enable Notifications
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            tabIndex={0}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p id="notification-prompt-description" className="text-gray-600 dark:text-gray-300 mb-4">
          Stay updated with real-time alerts for your trading activity.
        </p>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Price Alerts</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Get notified when stocks reach your target prices
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Market Updates</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Breaking news and market-moving events
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">AI Signals</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                LSTM predictions and trend reversal alerts
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              Error: {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            tabIndex={0}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg font-medium',
              'bg-blue-600 hover:bg-blue-700 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-200',
              'flex items-center justify-center gap-2'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 data-testid="loading-spinner" className="w-4 h-4 animate-spin" />
                Enabling...
              </>
            ) : (
              'Enable Notifications'
            )}
          </button>
          <button
            onClick={handleMaybeLater}
            disabled={isLoading}
            tabIndex={0}
            className={cn(
              'px-4 py-2.5 rounded-lg font-medium',
              'border border-gray-300 dark:border-gray-600',
              'hover:bg-gray-50 dark:hover:bg-slate-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-200'
            )}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}
