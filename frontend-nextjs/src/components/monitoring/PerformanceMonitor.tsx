'use client'

/**
 * PerformanceMonitor Component
 * Initializes Web Vitals tracking, performance monitoring, and user journey tracking
 */

import { useEffect } from 'react'
import { initPerformanceMonitoring } from '@/lib/monitoring/performance'
import { installAPIInterceptor, uninstallAPIInterceptor } from '@/lib/monitoring/api-interceptor'
import { FunnelAnalytics } from '@/lib/monitoring/funnel-analytics'
import { useUserJourney } from '@/hooks/useUserJourney'

export function PerformanceMonitor() {
  // Initialize user journey tracking
  useUserJourney()

  useEffect(() => {
    // Initialize performance monitoring on client side
    initPerformanceMonitoring()

    // Install API performance interceptor
    installAPIInterceptor()

    // Define key conversion funnels
    defineFunnels()

    // Cleanup on unmount
    return () => {
      uninstallAPIInterceptor()
    }
  }, [])

  return null // This component doesn't render anything
}

/**
 * Define conversion funnels for the trading platform
 */
function defineFunnels() {
  // Registration funnel
  FunnelAnalytics.defineFunnel('registration', [
    { step: 'landing', name: 'Landing Page', path: '/' },
    { step: 'signup', name: 'Sign Up', path: '/register' },
    { step: 'dashboard', name: 'Dashboard', path: '/dashboard' },
  ])

  // Portfolio creation funnel
  FunnelAnalytics.defineFunnel('portfolio_creation', [
    { step: 'dashboard', name: 'Dashboard', path: '/dashboard' },
    { step: 'portfolio', name: 'Portfolio Page', path: '/portfolio' },
    { step: 'creation', name: 'Create Portfolio', path: '/portfolio/new' },
  ])

  // Alert setup funnel
  FunnelAnalytics.defineFunnel('alert_setup', [
    { step: 'alerts', name: 'Alerts Page', path: '/alerts' },
    { step: 'builder', name: 'Alert Builder', path: '/alerts/new' },
    { step: 'complete', name: 'Alert Created', path: '/alerts' },
  ])

  // Stock analysis funnel
  FunnelAnalytics.defineFunnel('stock_analysis', [
    { step: 'search', name: 'Search', path: '/market' },
    { step: 'stock', name: 'Stock Page', path: '/stock' },
    { step: 'analysis', name: 'Analysis', path: '/analysis' },
  ])

  if (process.env.NODE_ENV === 'development') {
    console.log('[Performance Monitor] Conversion funnels defined')
  }
}
