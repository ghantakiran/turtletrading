/**
 * User Journey Tracker - Unit Tests
 * TDD approach for user experience monitoring
 */

import { UserJourneyTracker } from '../user-journey'
import * as Sentry from '@sentry/nextjs'

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setMeasurement: jest.fn(),
}))

// Mock timers for duration testing
jest.useFakeTimers()

describe('UserJourneyTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    UserJourneyTracker.reset()
  })

  describe('Page Navigation Tracking', () => {
    it('should track page visit with timestamp', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')

      const journey = UserJourneyTracker.getCurrentJourney()
      expect(journey.pages).toHaveLength(1)
      expect(journey.pages[0]).toEqual({
        path: '/dashboard',
        title: 'Dashboard',
        timestamp: expect.any(Number),
        duration: 0,
      })
    })

    it('should calculate time spent on previous page', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')

      // Simulate 2 seconds on dashboard
      jest.advanceTimersByTime(2000)

      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')

      const journey = UserJourneyTracker.getCurrentJourney()
      expect(journey.pages[0].duration).toBeGreaterThanOrEqual(2000)
    })

    it('should track entry page', () => {
      UserJourneyTracker.trackPageVisit('/login', 'Login')

      const journey = UserJourneyTracker.getCurrentJourney()
      expect(journey.entryPage).toBe('/login')
    })

    it('should track current page', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')

      const journey = UserJourneyTracker.getCurrentJourney()
      expect(journey.currentPage).toBe('/portfolio')
    })
  })

  describe('User Session Tracking', () => {
    it('should generate unique session ID', () => {
      const session1 = UserJourneyTracker.getSessionId()
      UserJourneyTracker.reset()
      const session2 = UserJourneyTracker.getSessionId()

      expect(session1).toBeTruthy()
      expect(session2).toBeTruthy()
      expect(session1).not.toBe(session2)
    })

    it('should track session duration', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')

      jest.advanceTimersByTime(5000)

      const journey = UserJourneyTracker.getCurrentJourney()
      expect(journey.sessionDuration).toBeGreaterThanOrEqual(5000)
    })

    it('should count total page views', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')
      UserJourneyTracker.trackPageVisit('/watchlist', 'Watchlist')

      const journey = UserJourneyTracker.getCurrentJourney()
      expect(journey.pageViews).toBe(3)
    })
  })

  describe('User Flow Patterns', () => {
    it('should identify navigation path', () => {
      UserJourneyTracker.trackPageVisit('/login', 'Login')
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')

      const path = UserJourneyTracker.getNavigationPath()
      expect(path).toEqual(['/login', '/dashboard', '/portfolio'])
    })

    it('should detect back navigation', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')

      const journey = UserJourneyTracker.getCurrentJourney()
      expect(journey.backNavigations).toBe(1)
    })

    it('should track unique pages visited', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackPageVisit('/watchlist', 'Watchlist')

      const uniquePages = UserJourneyTracker.getUniquePages()
      expect(uniquePages).toHaveLength(3)
      expect(uniquePages).toContain('/dashboard')
      expect(uniquePages).toContain('/portfolio')
      expect(uniquePages).toContain('/watchlist')
    })
  })

  describe('User Engagement Metrics', () => {
    it('should calculate average time per page', () => {
      UserJourneyTracker.trackPageVisit('/page1', 'Page 1')
      jest.advanceTimersByTime(2000)

      UserJourneyTracker.trackPageVisit('/page2', 'Page 2')
      jest.advanceTimersByTime(4000)

      UserJourneyTracker.trackPageVisit('/page3', 'Page 3')

      const metrics = UserJourneyTracker.getEngagementMetrics()
      expect(metrics.avgTimePerPage).toBeGreaterThan(2000)
    })

    it('should identify bounce (single page visit)', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      jest.advanceTimersByTime(5000)

      const metrics = UserJourneyTracker.getEngagementMetrics()
      expect(metrics.isBounce).toBe(true)
    })

    it('should identify non-bounce (multiple pages)', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')

      const metrics = UserJourneyTracker.getEngagementMetrics()
      expect(metrics.isBounce).toBe(false)
    })

    it('should track engagement level based on actions', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')
      UserJourneyTracker.trackPageVisit('/watchlist', 'Watchlist')
      jest.advanceTimersByTime(60000) // 1 minute

      const metrics = UserJourneyTracker.getEngagementMetrics()
      expect(metrics.engagementLevel).toBe('high')
    })
  })

  describe('User Actions Tracking', () => {
    it('should track user interactions', () => {
      UserJourneyTracker.trackUserAction('click', 'Add to Watchlist', {
        symbol: 'AAPL',
      })

      const journey = UserJourneyTracker.getCurrentJourney()
      expect(journey.actions).toHaveLength(1)
      expect(journey.actions[0]).toEqual({
        type: 'click',
        target: 'Add to Watchlist',
        metadata: { symbol: 'AAPL' },
        timestamp: expect.any(Number),
      })
    })

    it('should count total interactions', () => {
      UserJourneyTracker.trackUserAction('click', 'Button 1')
      UserJourneyTracker.trackUserAction('input', 'Search')
      UserJourneyTracker.trackUserAction('click', 'Button 2')

      const metrics = UserJourneyTracker.getEngagementMetrics()
      expect(metrics.totalInteractions).toBe(3)
    })
  })

  describe('Session Export and Reporting', () => {
    it('should export journey as JSON', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.trackUserAction('click', 'Portfolio')
      UserJourneyTracker.trackPageVisit('/portfolio', 'Portfolio')

      const exported = UserJourneyTracker.exportJourney()

      expect(exported).toHaveProperty('sessionId')
      expect(exported).toHaveProperty('pages')
      expect(exported).toHaveProperty('actions')
      expect(exported).toHaveProperty('metrics')
    })

    it('should send journey to Sentry', () => {
      UserJourneyTracker.trackPageVisit('/dashboard', 'Dashboard')
      UserJourneyTracker.sendToSentry()

      expect(Sentry.setContext).toHaveBeenCalledWith(
        'user_journey',
        expect.objectContaining({
          sessionId: expect.any(String),
          pages: expect.any(Array),
        })
      )
    })
  })
})
