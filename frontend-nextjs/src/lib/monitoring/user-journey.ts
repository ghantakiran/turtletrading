/**
 * User Journey Tracker
 * Tracks user navigation patterns, engagement, and session behavior
 */

import * as Sentry from '@sentry/nextjs'
import { BusinessMetricsTracker } from './business-metrics'

interface PageVisit {
  path: string
  title: string
  timestamp: number
  duration: number
}

interface UserAction {
  type: string
  target: string
  metadata?: Record<string, any>
  timestamp: number
}

interface UserJourney {
  sessionId: string
  entryPage: string
  currentPage: string
  pages: PageVisit[]
  actions: UserAction[]
  pageViews: number
  backNavigations: number
  sessionStart: number
  sessionDuration: number
}

interface EngagementMetrics {
  avgTimePerPage: number
  totalInteractions: number
  isBounce: boolean
  engagementLevel: 'low' | 'medium' | 'high'
  pagesPerSession: number
}

class UserJourneyTracking {
  private journey: UserJourney
  private previousPage: string | null = null

  constructor() {
    this.journey = this.initializeJourney()
  }

  /**
   * Initialize new user journey
   */
  private initializeJourney(): UserJourney {
    return {
      sessionId: this.generateSessionId(),
      entryPage: '',
      currentPage: '',
      pages: [],
      actions: [],
      pageViews: 0,
      backNavigations: 0,
      sessionStart: Date.now(),
      sessionDuration: 0,
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Track page visit
   */
  trackPageVisit(path: string, title: string) {
    const timestamp = Date.now()

    // Update duration of previous page
    if (this.journey.pages.length > 0) {
      const lastPage = this.journey.pages[this.journey.pages.length - 1]
      lastPage.duration = timestamp - lastPage.timestamp
    }

    // Detect back navigation
    if (this.previousPage && this.journey.pages.some(p => p.path === path)) {
      const previousIndex = this.journey.pages.findIndex(p => p.path === this.previousPage)
      const currentIndex = this.journey.pages.findIndex(p => p.path === path)
      if (currentIndex < previousIndex) {
        this.journey.backNavigations++
      }
    }

    // Add new page visit
    this.journey.pages.push({
      path,
      title,
      timestamp,
      duration: 0,
    })

    // Update journey metadata
    if (!this.journey.entryPage) {
      this.journey.entryPage = path
    }
    this.journey.currentPage = path
    this.journey.pageViews++
    this.previousPage = path

    // Update session duration
    this.journey.sessionDuration = timestamp - this.journey.sessionStart

    // Track in business metrics
    BusinessMetricsTracker.trackPageView(path, 0)

    // Send breadcrumb to Sentry
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `User navigated to ${title}`,
      level: 'info',
      data: {
        path,
        title,
        pageNumber: this.journey.pageViews,
      },
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[User Journey] Page visit: ${path}`, {
        pageViews: this.journey.pageViews,
        sessionDuration: this.journey.sessionDuration,
      })
    }
  }

  /**
   * Track user action/interaction
   */
  trackUserAction(type: string, target: string, metadata?: Record<string, any>) {
    const action: UserAction = {
      type,
      target,
      metadata,
      timestamp: Date.now(),
    }

    this.journey.actions.push(action)

    // Track in business metrics
    BusinessMetricsTracker.trackUserAction(target, 0, metadata)

    Sentry.addBreadcrumb({
      category: 'user.interaction',
      message: `${type}: ${target}`,
      level: 'info',
      data: metadata,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[User Journey] Action: ${type} - ${target}`, metadata)
    }
  }

  /**
   * Get current user journey
   */
  getCurrentJourney(): UserJourney {
    this.journey.sessionDuration = Date.now() - this.journey.sessionStart
    return { ...this.journey }
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.journey.sessionId
  }

  /**
   * Get navigation path (array of page paths)
   */
  getNavigationPath(): string[] {
    return this.journey.pages.map(p => p.path)
  }

  /**
   * Get unique pages visited
   */
  getUniquePages(): string[] {
    const uniquePaths = new Set(this.journey.pages.map(p => p.path))
    return Array.from(uniquePaths)
  }

  /**
   * Calculate engagement metrics
   */
  getEngagementMetrics(): EngagementMetrics {
    // Update session duration to current time
    this.journey.sessionDuration = Date.now() - this.journey.sessionStart

    const totalTimeOnPages = this.journey.pages.reduce((sum, page) => sum + page.duration, 0)
    const pagesWithDuration = this.journey.pages.filter(p => p.duration > 0).length
    const avgTimePerPage = pagesWithDuration > 0 ? totalTimeOnPages / pagesWithDuration : 0

    const totalInteractions = this.journey.actions.length
    const pagesPerSession = this.journey.pageViews
    const isBounce = pagesPerSession <= 1

    // Determine engagement level
    let engagementLevel: 'low' | 'medium' | 'high' = 'low'
    if (pagesPerSession >= 3 && this.journey.sessionDuration >= 60000) {
      engagementLevel = 'high'
    } else if (pagesPerSession >= 2 || this.journey.sessionDuration >= 30000) {
      engagementLevel = 'medium'
    }

    return {
      avgTimePerPage,
      totalInteractions,
      isBounce,
      engagementLevel,
      pagesPerSession,
    }
  }

  /**
   * Export journey data
   */
  exportJourney() {
    return {
      ...this.getCurrentJourney(),
      metrics: this.getEngagementMetrics(),
      navigationPath: this.getNavigationPath(),
      uniquePages: this.getUniquePages(),
    }
  }

  /**
   * Send journey data to Sentry
   */
  sendToSentry() {
    const journey = this.exportJourney()

    Sentry.setContext('user_journey', {
      sessionId: journey.sessionId,
      entryPage: journey.entryPage,
      currentPage: journey.currentPage,
      pageViews: journey.pageViews,
      sessionDuration: journey.sessionDuration,
      engagementLevel: journey.metrics.engagementLevel,
      isBounce: journey.metrics.isBounce,
      pages: journey.pages.map(p => ({
        path: p.path,
        title: p.title,
        duration: p.duration,
      })),
    })

    Sentry.setTag('engagement_level', journey.metrics.engagementLevel)
    Sentry.setTag('is_bounce', journey.metrics.isBounce.toString())

    if (process.env.NODE_ENV === 'development') {
      console.log('[User Journey] Sent to Sentry:', journey)
    }
  }

  /**
   * Reset journey (for testing or new session)
   */
  reset() {
    this.journey = this.initializeJourney()
    this.previousPage = null
  }
}

// Export singleton instance
export const UserJourneyTracker = new UserJourneyTracking()
