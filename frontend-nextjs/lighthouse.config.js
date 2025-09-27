/**
 * Lighthouse CI Configuration for TurtleTrading Platform
 * Enforces strict performance budgets for trading applications
 */

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run build && npm run start',
      startServerReadyPattern: 'ready',
      startServerReadyTimeout: 30000,
      url: [
        'http://localhost:3000',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/stock/AAPL',
        'http://localhost:3000/market',
        'http://localhost:3000/portfolio'
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        formFactor: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        },
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        },
        emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    },
    assert: {
      assertions: {
        // Performance budgets for trading platform
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:seo': ['error', { minScore: 0.85 }],

        // Core Web Vitals - Strict trading requirements
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'first-input-delay': ['error', { maxNumericValue: 100 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'time-to-interactive': ['error', { maxNumericValue: 2500 }],

        // Trading-specific performance metrics
        'speed-index': ['error', { maxNumericValue: 2000 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'max-potential-fid': ['error', { maxNumericValue: 130 }],

        // Resource budgets
        'resource-summary:document:size': ['error', { maxNumericValue: 50000 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 512000 }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 51200 }],
        'resource-summary:image:size': ['error', { maxNumericValue: 256000 }],
        'resource-summary:font:size': ['error', { maxNumericValue: 102400 }],
        'resource-summary:other:size': ['error', { maxNumericValue: 51200 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 1024000 }],

        // Network requests
        'resource-summary:document:count': ['error', { maxNumericValue: 1 }],
        'resource-summary:script:count': ['error', { maxNumericValue: 10 }],
        'resource-summary:stylesheet:count': ['error', { maxNumericValue: 3 }],
        'resource-summary:image:count': ['error', { maxNumericValue: 15 }],
        'resource-summary:font:count': ['error', { maxNumericValue: 4 }],
        'resource-summary:third-party:count': ['error', { maxNumericValue: 5 }],
        'resource-summary:total:count': ['error', { maxNumericValue: 40 }],

        // Accessibility requirements
        'color-contrast': 'error',
        'heading-order': 'error',
        'link-name': 'error',
        'button-name': 'error',
        'image-alt': 'error',
        'label': 'error',
        'aria-allowed-attr': 'error',
        'aria-required-attr': 'error',
        'aria-roles': 'error',
        'aria-valid-attr': 'error',
        'aria-valid-attr-value': 'error',

        // Security headers
        'csp-xss': 'warn',
        'external-anchors-use-rel-noopener': 'error',
        'geolocation-on-start': 'error',
        'notification-on-start': 'error'
      }
    },
    upload: {
      target: 'temporary-public-storage',
      githubAppToken: process.env.LIGHTHOUSE_GITHUB_APP_TOKEN,
      githubApiHost: 'https://api.github.com',
      githubStatusContextSuffix: '/lighthouse'
    },
    server: {
      port: 9001,
      storage: {
        storageMethod: 'filesystem',
        sqlDatabasePath: './lighthouse-ci.db'
      }
    }
  }
}