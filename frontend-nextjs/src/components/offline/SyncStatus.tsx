/**
 * SyncStatus Component
 * Shows sync progress, offline status, and manual sync trigger
 */

'use client'

import React, { useState } from 'react'
import { useOfflineSync } from '@/lib/hooks/useOfflineSync'
import { Loader2, WifiOff, X, RefreshCw } from 'lucide-react'

interface SyncStatusProps {
  dismissible?: boolean
}

export function SyncStatus({ dismissible = false }: SyncStatusProps) {
  const { isOnline, queueSize, processQueue } = useOfflineSync()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await processQueue()
    } catch (error) {
      console.error('Manual sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
  }

  // Don't show if dismissed
  if (isDismissed) {
    return null
  }

  // Don't show if online and no pending items
  if (isOnline && queueSize === 0) {
    return null
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">
              Offline
              {queueSize > 0 && (
                <span className="ml-2 opacity-90">
                  ({queueSize} pending {queueSize === 1 ? 'action' : 'actions'})
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              Syncing {queueSize} {queueSize === 1 ? 'item' : 'items'}...
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isOnline && queueSize > 0 && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="text-sm px-3 py-1 bg-white text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1"
            aria-label="Sync now"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        )}

        {dismissible && (
          <button
            onClick={handleDismiss}
            className="text-white hover:text-blue-100 p-1"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
