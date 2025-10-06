'use client'

/**
 * PerformanceMonitor Component
 * Initializes Web Vitals tracking and performance monitoring
 */

import { useEffect } from 'react'
import { initPerformanceMonitoring } from '@/lib/monitoring/performance'

export function PerformanceMonitor() {
  useEffect(() => {
    // Initialize performance monitoring on client side
    initPerformanceMonitoring()
  }, [])

  return null // This component doesn't render anything
}
