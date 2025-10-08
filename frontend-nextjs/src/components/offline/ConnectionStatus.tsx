/**
 * ConnectionStatus Component
 * Displays a banner when the user is offline and shows pending changes count
 */

'use client'

import React, { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

interface ConnectionStatusProps {
  queueSize?: number
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ queueSize = 0 }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [showReconnected, setShowReconnected] = useState<boolean>(false)
  const [wasOffline, setWasOffline] = useState<boolean>(false)

  useEffect(() => {
    // Initialize online status
    const initialStatus = navigator.onLine
    setIsOnline(initialStatus)
    if (!initialStatus) {
      setWasOffline(true)
    }

    // Handle online event
    const handleOnline = () => {
      const wasActuallyOffline = !isOnline || wasOffline
      setIsOnline(true)
      if (wasActuallyOffline) {
        setShowReconnected(true)
        // Auto-hide reconnected message after 3 seconds
        setTimeout(() => {
          setShowReconnected(false)
          setWasOffline(false)
        }, 3000)
      }
    }

    // Handle offline event
    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
      setShowReconnected(false)
    }

    // Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isOnline, wasOffline])

  // Don't show anything if online and not showing reconnected message
  if (isOnline && !showReconnected) {
    return null
  }

  // Show reconnected message
  if (showReconnected) {
    return (
      <div
        role="status"
        className="fixed top-0 left-0 right-0 z-50 bg-green-50 border-b border-green-200 px-4 py-3"
      >
        <div className="flex items-center justify-center gap-2 max-w-7xl mx-auto">
          <Wifi className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">
            You&apos;re back online! Syncing your changes...
          </p>
        </div>
      </div>
    )
  }

  // Show offline banner
  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b border-yellow-200 px-4 py-3"
    >
      <div className="flex items-center justify-center gap-2 max-w-7xl mx-auto">
        <WifiOff className="h-5 w-5 text-yellow-600" />
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-yellow-800">
            You are currently offline.
            {queueSize > 0 && (
              <span className="ml-2">
                {queueSize} pending {queueSize === 1 ? 'change' : 'changes'} will sync when you reconnect.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
