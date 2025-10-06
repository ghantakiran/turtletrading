/**
 * Funnel Analytics - Unit Tests
 * TDD approach for conversion funnel tracking
 */

import { FunnelAnalytics } from '../funnel-analytics'
import * as Sentry from '@sentry/nextjs'

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  setMeasurement: jest.fn(),
}))

describe('FunnelAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    FunnelAnalytics.reset()
  })

  describe('Funnel Definition', () => {
    it('should define a conversion funnel', () => {
      const funnel = FunnelAnalytics.defineFunnel('registration', [
        { step: 'landing', name: 'Landing Page', path: '/' },
        { step: 'signup', name: 'Sign Up Form', path: '/register' },
        { step: 'verify', name: 'Email Verification', path: '/verify' },
        { step: 'complete', name: 'Registration Complete', path: '/dashboard' },
      ])

      expect(funnel.id).toBe('registration')
      expect(funnel.steps).toHaveLength(4)
      expect(funnel.steps[0].step).toBe('landing')
    })

    it('should track multiple funnels', () => {
      FunnelAnalytics.defineFunnel('registration', [
        { step: 'start', name: 'Start', path: '/register' },
        { step: 'complete', name: 'Complete', path: '/dashboard' },
      ])

      FunnelAnalytics.defineFunnel('portfolio_creation', [
        { step: 'start', name: 'Start', path: '/portfolio/new' },
        { step: 'complete', name: 'Complete', path: '/portfolio' },
      ])

      const funnels = FunnelAnalytics.getAllFunnels()
      expect(funnels).toHaveLength(2)
    })
  })

  describe('Step Tracking', () => {
    beforeEach(() => {
      FunnelAnalytics.defineFunnel('onboarding', [
        { step: 'start', name: 'Start', path: '/welcome' },
        { step: 'profile', name: 'Profile', path: '/profile' },
        { step: 'preferences', name: 'Preferences', path: '/preferences' },
        { step: 'complete', name: 'Complete', path: '/dashboard' },
      ])
    })

    it('should track funnel step entry', () => {
      FunnelAnalytics.trackStep('onboarding', 'start')

      const funnel = FunnelAnalytics.getFunnel('onboarding')
      expect(funnel?.currentStep).toBe('start')
      expect(funnel?.stepsCompleted).toContain('start')
    })

    it('should track step progression', () => {
      FunnelAnalytics.trackStep('onboarding', 'start')
      FunnelAnalytics.trackStep('onboarding', 'profile')
      FunnelAnalytics.trackStep('onboarding', 'preferences')

      const funnel = FunnelAnalytics.getFunnel('onboarding')
      expect(funnel?.currentStep).toBe('preferences')
      expect(funnel?.stepsCompleted).toEqual(['start', 'profile', 'preferences'])
    })

    it('should detect funnel completion', () => {
      FunnelAnalytics.trackStep('onboarding', 'start')
      FunnelAnalytics.trackStep('onboarding', 'profile')
      FunnelAnalytics.trackStep('onboarding', 'preferences')
      FunnelAnalytics.trackStep('onboarding', 'complete')

      const funnel = FunnelAnalytics.getFunnel('onboarding')
      expect(funnel?.isCompleted).toBe(true)
    })

    it('should detect funnel abandonment', () => {
      FunnelAnalytics.trackStep('onboarding', 'start')
      FunnelAnalytics.trackStep('onboarding', 'profile')

      const funnel = FunnelAnalytics.getFunnel('onboarding')
      expect(funnel?.isCompleted).toBe(false)
      expect(funnel?.currentStep).toBe('profile')
    })
  })

  describe('Conversion Metrics', () => {
    beforeEach(() => {
      FunnelAnalytics.defineFunnel('checkout', [
        { step: 'cart', name: 'Cart', path: '/cart' },
        { step: 'shipping', name: 'Shipping', path: '/checkout/shipping' },
        { step: 'payment', name: 'Payment', path: '/checkout/payment' },
        { step: 'confirm', name: 'Confirmation', path: '/order/confirmation' },
      ])
    })

    it('should calculate conversion rate', () => {
      FunnelAnalytics.trackStep('checkout', 'cart')
      FunnelAnalytics.trackStep('checkout', 'shipping')
      FunnelAnalytics.trackStep('checkout', 'payment')
      FunnelAnalytics.trackStep('checkout', 'confirm')

      const metrics = FunnelAnalytics.getConversionMetrics('checkout')
      expect(metrics.conversionRate).toBe(100) // Completed all steps
    })

    it('should calculate drop-off rate', () => {
      FunnelAnalytics.trackStep('checkout', 'cart')
      FunnelAnalytics.trackStep('checkout', 'shipping')
      // User drops off at shipping

      const metrics = FunnelAnalytics.getConversionMetrics('checkout')
      expect(metrics.dropOffRate).toBeGreaterThan(0)
      expect(metrics.dropOffStep).toBe('shipping')
    })

    it('should calculate progress percentage', () => {
      FunnelAnalytics.trackStep('checkout', 'cart')
      FunnelAnalytics.trackStep('checkout', 'shipping')

      const metrics = FunnelAnalytics.getConversionMetrics('checkout')
      expect(metrics.progressPercentage).toBe(50) // 2 of 4 steps
    })
  })

  describe('Time Tracking', () => {
    beforeEach(() => {
      FunnelAnalytics.defineFunnel('signup', [
        { step: 'form', name: 'Form', path: '/signup' },
        { step: 'verify', name: 'Verify', path: '/verify' },
        { step: 'done', name: 'Done', path: '/welcome' },
      ])
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should track time spent in funnel', () => {
      FunnelAnalytics.trackStep('signup', 'form')
      jest.advanceTimersByTime(30000) // 30 seconds

      FunnelAnalytics.trackStep('signup', 'verify')
      jest.advanceTimersByTime(20000) // 20 seconds

      FunnelAnalytics.trackStep('signup', 'done')

      const metrics = FunnelAnalytics.getConversionMetrics('signup')
      expect(metrics.totalTime).toBeGreaterThanOrEqual(50000)
    })

    it('should track time per step', () => {
      FunnelAnalytics.trackStep('signup', 'form')
      jest.advanceTimersByTime(30000)

      FunnelAnalytics.trackStep('signup', 'verify')
      jest.advanceTimersByTime(20000)

      FunnelAnalytics.trackStep('signup', 'done')

      const metrics = FunnelAnalytics.getConversionMetrics('signup')
      expect(metrics.avgTimePerStep).toBeGreaterThan(0)
    })
  })

  describe('Reporting', () => {
    it('should export funnel data', () => {
      FunnelAnalytics.defineFunnel('test_funnel', [
        { step: 'start', name: 'Start', path: '/start' },
        { step: 'end', name: 'End', path: '/end' },
      ])

      FunnelAnalytics.trackStep('test_funnel', 'start')
      FunnelAnalytics.trackStep('test_funnel', 'end')

      const data = FunnelAnalytics.exportFunnelData('test_funnel')

      expect(data).toHaveProperty('funnelId')
      expect(data).toHaveProperty('steps')
      expect(data).toHaveProperty('metrics')
      expect(data.metrics.isCompleted).toBe(true)
    })

    it('should send funnel data to Sentry', () => {
      FunnelAnalytics.defineFunnel('test_funnel', [
        { step: 'start', name: 'Start', path: '/start' },
        { step: 'end', name: 'End', path: '/end' },
      ])

      FunnelAnalytics.trackStep('test_funnel', 'start')
      FunnelAnalytics.sendToSentry('test_funnel')

      expect(Sentry.setContext).toHaveBeenCalledWith(
        'funnel_analytics',
        expect.objectContaining({
          funnelId: 'test_funnel',
          currentStep: 'start',
        })
      )
    })
  })
})
