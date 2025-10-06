/**
 * useUserJourney Hook
 * Automatically track user navigation and interactions
 */

'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { UserJourneyTracker } from '@/lib/monitoring/user-journey'

export function useUserJourney(pageTitle?: string) {
  const pathname = usePathname()

  useEffect(() => {
    // Track page visit
    const title = pageTitle || document.title || pathname
    UserJourneyTracker.trackPageVisit(pathname, title)

    // Send journey data to Sentry periodically
    const interval = setInterval(() => {
      UserJourneyTracker.sendToSentry()
    }, 30000) // Every 30 seconds

    return () => {
      clearInterval(interval)
      // Send final update on unmount
      UserJourneyTracker.sendToSentry()
    }
  }, [pathname, pageTitle])

  return {
    /**
     * Track a user action
     */
    trackAction: (type: string, target: string, metadata?: Record<string, any>) => {
      UserJourneyTracker.trackUserAction(type, target, metadata)
    },

    /**
     * Get current journey
     */
    getJourney: () => UserJourneyTracker.getCurrentJourney(),

    /**
     * Get engagement metrics
     */
    getMetrics: () => UserJourneyTracker.getEngagementMetrics(),
  }
}
