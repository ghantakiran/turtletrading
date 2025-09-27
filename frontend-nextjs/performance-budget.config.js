/**
 * Performance Budget Configuration for TurtleTrading
 * Enforces strict bundle size and resource limits for trading platform
 */

const path = require('path')

module.exports = {
  // Bundle size budgets (in bytes)
  budgets: [
    {
      type: 'bundle',
      name: 'main',
      maximumWarning: 250 * 1024, // 250KB warning
      maximumError: 300 * 1024,   // 300KB error
      baseline: './baseline/main.json'
    },
    {
      type: 'bundle',
      name: 'vendor',
      maximumWarning: 400 * 1024, // 400KB warning
      maximumError: 500 * 1024,   // 500KB error
      baseline: './baseline/vendor.json'
    },
    {
      type: 'bundle',
      name: 'runtime',
      maximumWarning: 5 * 1024,   // 5KB warning
      maximumError: 10 * 1024,    // 10KB error
      baseline: './baseline/runtime.json'
    },
    {
      type: 'initial',
      maximumWarning: 600 * 1024, // 600KB warning
      maximumError: 800 * 1024,   // 800KB error
      baseline: './baseline/initial.json'
    },
    {
      type: 'anyComponentStyle',
      maximumWarning: 5 * 1024,   // 5KB warning per component CSS
      maximumError: 10 * 1024,    // 10KB error per component CSS
    },
    {
      type: 'any',
      maximumWarning: 100 * 1024, // 100KB warning for any single asset
      maximumError: 150 * 1024,   // 150KB error for any single asset
    }
  ],

  // Resource type budgets
  resourceBudgets: {
    javascript: {
      maximumWarning: 400 * 1024, // 400KB total JS
      maximumError: 500 * 1024,   // 500KB total JS
    },
    css: {
      maximumWarning: 50 * 1024,  // 50KB total CSS
      maximumError: 75 * 1024,    // 75KB total CSS
    },
    images: {
      maximumWarning: 200 * 1024, // 200KB total images
      maximumError: 300 * 1024,   // 300KB total images
    },
    fonts: {
      maximumWarning: 100 * 1024, // 100KB total fonts
      maximumError: 150 * 1024,   // 150KB total fonts
    }
  },

  // Performance thresholds for different pages
  pagesBudgets: {
    '/': {
      fcp: 1500,      // First Contentful Paint
      lcp: 2000,      // Largest Contentful Paint
      fid: 100,       // First Input Delay
      cls: 0.1,       // Cumulative Layout Shift
      tti: 2500,      // Time to Interactive
      tbt: 200,       // Total Blocking Time
      si: 2000        // Speed Index
    },
    '/dashboard': {
      fcp: 1200,      // Faster for main trading dashboard
      lcp: 1800,
      fid: 75,
      cls: 0.05,      // Stricter CLS for trading interface
      tti: 2000,
      tbt: 150,
      si: 1800
    },
    '/stock/[symbol]': {
      fcp: 1300,
      lcp: 1900,
      fid: 100,
      cls: 0.1,
      tti: 2200,
      tbt: 200,
      si: 1900
    },
    '/market': {
      fcp: 1400,
      lcp: 2000,
      fid: 100,
      cls: 0.1,
      tti: 2300,
      tbt: 200,
      si: 2000
    }
  },

  // Network conditions for testing
  networkConditions: {
    '3G': {
      rttMs: 150,
      throughputKbps: 1600,
      cpuSlowdownMultiplier: 4
    },
    '4G': {
      rttMs: 40,
      throughputKbps: 10000,
      cpuSlowdownMultiplier: 1
    },
    'cable': {
      rttMs: 5,
      throughputKbps: 20000,
      cpuSlowdownMultiplier: 1
    }
  },

  // Trading-specific performance requirements
  tradingMetrics: {
    websocketLatency: {
      target: 50,      // 50ms target latency
      warning: 100,    // 100ms warning
      error: 200       // 200ms error threshold
    },
    priceUpdateFrequency: {
      target: 16.67,   // 60 FPS (16.67ms per frame)
      warning: 33.33,  // 30 FPS
      error: 100       // 10 FPS minimum
    },
    chartRenderTime: {
      target: 100,     // 100ms target
      warning: 200,    // 200ms warning
      error: 500       // 500ms error
    },
    apiResponseTime: {
      target: 200,     // 200ms target
      warning: 500,    // 500ms warning
      error: 1000      // 1s error
    },
    memoryUsage: {
      target: 50 * 1024 * 1024,  // 50MB target
      warning: 100 * 1024 * 1024, // 100MB warning
      error: 200 * 1024 * 1024    // 200MB error
    }
  },

  // Accessibility requirements
  accessibilityBudgets: {
    colorContrast: {
      level: 'AA',
      largeText: 3.0,
      normalText: 4.5
    },
    keyboardNavigation: {
      required: true,
      tabOrder: true,
      focusVisible: true
    },
    screenReader: {
      ariaLabels: true,
      altText: true,
      headingStructure: true,
      landmarks: true
    },
    animations: {
      respectsReducedMotion: true,
      maxDuration: 300, // ms
      easing: 'ease-out'
    }
  },

  // CI/CD enforcement settings
  enforcement: {
    failOnError: true,
    failOnWarning: false,
    reportPath: './performance-report.json',
    baselinePath: './baseline',
    compareWithBaseline: true,
    generateReport: true,
    uploadArtifacts: true
  },

  // Monitoring and alerting
  monitoring: {
    enabled: true,
    endpoint: '/api/v1/analytics/performance',
    sampleRate: 0.1, // 10% sampling
    alertThresholds: {
      errorRate: 0.05,     // 5% error threshold
      p95ResponseTime: 500, // 500ms p95
      crashRate: 0.01       // 1% crash rate
    }
  }
}