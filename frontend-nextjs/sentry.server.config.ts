import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions for development

  // Set sampling rate for profiling
  profilesSampleRate: 1.0,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Ignore certain errors
  ignoreErrors: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
  ],

  // Before sending to Sentry
  beforeSend(event, hint) {
    // Don't send errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Sentry Server Error:', event, hint)
      return null
    }
    return event
  },
})
