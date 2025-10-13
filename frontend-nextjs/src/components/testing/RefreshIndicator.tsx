/**
 * Refresh Indicator Component
 * Shows last update time and provides manual refresh control
 */

'use client'

import { useEffect, useState } from 'react'
import { formatRelativeTime } from '@/lib/utils/time'

interface RefreshIndicatorProps {
  lastUpdate: Date | null
  onRefresh: () => void
  loading?: boolean
  isPaused?: boolean
  onPause?: () => void
  onResume?: () => void
}

export default function RefreshIndicator({
  lastUpdate,
  onRefresh,
  loading = false,
  isPaused = false,
  onPause,
  onResume,
}: RefreshIndicatorProps) {
  const [relativeTime, setRelativeTime] = useState('')

  // Update relative time every second
  useEffect(() => {
    const updateTime = () => {
      setRelativeTime(formatRelativeTime(lastUpdate))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [lastUpdate])

  return (
    <div className="flex items-center gap-4 text-sm">
      {/* Manual Refresh Button */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Refresh now"
      >
        <span className={loading ? 'animate-spin' : ''}>🔄</span>
        <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
      </button>

      {/* Pause/Resume Button */}
      {onPause && onResume && (
        <button
          onClick={isPaused ? onResume : onPause}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          aria-label={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
        >
          <span>{isPaused ? '▶️' : '⏸️'}</span>
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>
      )}

      {/* Last Update Time */}
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <span className="text-xs">⏱️</span>
        <span>Updated {relativeTime}</span>
      </div>
    </div>
  )
}
