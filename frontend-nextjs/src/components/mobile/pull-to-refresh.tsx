'use client'

/**
 * Pull-to-Refresh Component
 * Provides mobile pull-to-refresh gesture functionality
 * Implements iOS-style pull-to-refresh pattern
 */

import { useState, useRef, useCallback, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void> | void
  threshold?: number
  disabled?: boolean
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  disabled = false,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)

  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing) return

      const scrollTop = containerRef.current?.scrollTop || 0

      // Only allow pull-to-refresh when scrolled to top
      if (scrollTop === 0) {
        startY.current = e.touches[0].clientY
        setIsPulling(true)
      }
    },
    [disabled, isRefreshing]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling || disabled || isRefreshing) return

      const currentY = e.touches[0].clientY
      const distance = currentY - startY.current

      // Only track downward pulls
      if (distance > 0) {
        // Apply resistance (diminishing returns as you pull further)
        const resistanceFactor = 0.5
        const adjustedDistance = Math.min(
          distance * resistanceFactor,
          threshold * 1.5
        )
        setPullDistance(adjustedDistance)
      }
    },
    [isPulling, disabled, isRefreshing, threshold]
  )

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled || isRefreshing) return

    setIsPulling(false)

    // Trigger refresh if threshold exceeded
    if (pullDistance >= threshold) {
      setIsRefreshing(true)
      setPullDistance(0)

      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh failed:', error)
      } finally {
        setIsRefreshing(false)
      }
    } else {
      // Reset if threshold not met
      setPullDistance(0)
    }
  }, [isPulling, disabled, isRefreshing, pullDistance, threshold, onRefresh])

  const isReady = pullDistance >= threshold

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Pull to refresh content"
      className="relative overflow-auto h-full"
      data-testid="pull-container"
      data-pulling={isPulling.toString()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Indicator */}
      {(isPulling || isRefreshing) && (
        <div
          data-testid="pull-indicator"
          data-pull-distance={Math.round(pullDistance)}
          data-ready={isReady.toString()}
          className={cn(
            'absolute top-0 left-0 right-0 z-10',
            'flex items-center justify-center',
            'transition-all duration-200',
            'pointer-events-none'
          )}
          style={{
            height: `${Math.min(pullDistance, threshold * 1.5)}px`,
            opacity: Math.min(pullDistance / threshold, 1),
          }}
        >
          <div
            className={cn(
              'flex items-center gap-2',
              'text-blue-600 dark:text-blue-400',
              'font-medium text-sm',
              'transition-transform duration-200',
              isReady && 'scale-110'
            )}
          >
            <Loader2
              className={cn(
                'w-5 h-5',
                (isRefreshing || isReady) && 'animate-spin'
              )}
            />
            <span>
              {isRefreshing
                ? 'Refreshing...'
                : isReady
                ? 'Release to refresh'
                : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Refreshing Status (for screen readers) */}
      {isRefreshing && (
        <div
          role="status"
          aria-label="Refreshing content"
          aria-live="polite"
          className="sr-only"
        >
          Refreshing content...
        </div>
      )}

      {/* Content with padding to prevent overlap */}
      <div
        className={cn(
          'transition-transform duration-200',
          isPulling && 'transform',
          isRefreshing && 'pt-16'
        )}
        style={{
          transform: isPulling ? `translateY(${pullDistance}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
