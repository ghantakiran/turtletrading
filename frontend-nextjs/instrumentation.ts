/**
 * Next.js Instrumentation for Performance Monitoring
 * Trading platform performance tracking and monitoring
 */

export async function register() {
  // Only run in production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.PERFORMANCE_MONITORING === 'true') {
    console.log('🚀 Performance monitoring initialized')

    // Initialize server-side performance monitoring
    const { PerformanceObserver, performance } = await import('perf_hooks')

    // Monitor server-side performance
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        // Log slow operations that could affect trading performance
        if (entry.duration > 100) { // 100ms threshold for trading platform
          console.warn(`⚠️ Slow operation detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`)
        }

        // Critical alerts for very slow operations
        if (entry.duration > 500) {
          console.error(`🚨 Critical slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms - This may affect real-time trading`)
        }
      })
    })

    // Observe different types of performance entries
    obs.observe({ entryTypes: ['measure', 'navigation', 'resource'] })

    // Mark application startup
    performance.mark('app-startup')

    // Trading-specific performance markers
    global.tradingPerformance = {
      markDataFetch: (symbol: string) => {
        performance.mark(`data-fetch-${symbol}-start`)
      },
      markDataFetchEnd: (symbol: string) => {
        performance.mark(`data-fetch-${symbol}-end`)
        performance.measure(
          `data-fetch-${symbol}`,
          `data-fetch-${symbol}-start`,
          `data-fetch-${symbol}-end`
        )
      },
      markCalculation: (type: string) => {
        performance.mark(`calculation-${type}-start`)
      },
      markCalculationEnd: (type: string) => {
        performance.mark(`calculation-${type}-end`)
        performance.measure(
          `calculation-${type}`,
          `calculation-${type}-start`,
          `calculation-${type}-end`
        )
      },
      markWebSocketEvent: (event: string) => {
        performance.mark(`websocket-${event}`)
      }
    }

    // Monitor memory usage for trading platform
    if (process.memoryUsage) {
      setInterval(() => {
        const memUsage = process.memoryUsage()
        const memoryInMB = memUsage.heapUsed / 1024 / 1024

        // Alert on high memory usage that could affect performance
        if (memoryInMB > 512) { // 512MB threshold
          console.warn(`⚠️ High memory usage: ${memoryInMB.toFixed(2)}MB`)
        }

        // Critical memory alert
        if (memoryInMB > 1024) { // 1GB threshold
          console.error(`🚨 Critical memory usage: ${memoryInMB.toFixed(2)}MB - Trading performance may be degraded`)
        }
      }, 30000) // Check every 30 seconds
    }

    // Initialize error tracking for performance impact
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught exception affecting trading platform:', error)
    })

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled rejection affecting trading platform:', reason)
    })

    console.log('✅ Trading platform performance monitoring active')
  }
}

// TypeScript declarations for global trading performance
declare global {
  var tradingPerformance: {
    markDataFetch: (symbol: string) => void
    markDataFetchEnd: (symbol: string) => void
    markCalculation: (type: string) => void
    markCalculationEnd: (type: string) => void
    markWebSocketEvent: (event: string) => void
  }
}