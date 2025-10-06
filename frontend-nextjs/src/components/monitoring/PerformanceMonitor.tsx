'use client'

/**
 * PerformanceMonitor Component
 * Initializes Web Vitals tracking and performance monitoring
 */

import { useEffect } from 'react'
import { initPerformanceMonitoring } from '@/lib/monitoring/performance'
import { installAPIInterceptor, uninstallAPIInterceptor } from '@/lib/monitoring/api-interceptor'

export function PerformanceMonitor() {
  useEffect(() => {
    // Initialize performance monitoring on client side
    initPerformanceMonitoring()

    // Install API performance interceptor
    installAPIInterceptor()

    // Cleanup on unmount
    return () => {
      uninstallAPIInterceptor()
    }
  }, [])

  return null // This component doesn't render anything
}
