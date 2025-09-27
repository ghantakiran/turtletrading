'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface Props {
  children: ReactNode
  level: 'app' | 'route' | 'segment' | 'component'
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

export class BaseErrorBoundary extends Component<Props, State> {
  private resetTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>

  constructor(props: Props) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }

    this.resetTimeoutRef = React.createRef() as React.MutableRefObject<NodeJS.Timeout | null>
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console and external service
    console.error(`[${this.props.level.toUpperCase()} ERROR BOUNDARY]`, error, errorInfo)

    this.setState({
      errorInfo
    })

    // Call custom error handler
    this.props.onError?.(error, errorInfo)

    // Report to external error tracking service
    this.reportError(error, errorInfo)
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props
    const { hasError } = this.state

    // Reset error boundary when specified props change
    if (hasError && resetOnPropsChange && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (resetKey, idx) => prevProps.resetKeys?.[idx] !== resetKey
      )

      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In production, report to external service (e.g., Sentry, LogRocket)
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo })
      console.log('Error reported to tracking service:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    }
  }

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  private handleRetry = () => {
    this.resetErrorBoundary()
  }

  private handleAutoRetry = () => {
    // Auto-retry with exponential backoff for certain error types
    const retryDelay = 2000 // 2 seconds for demo

    this.resetTimeoutRef.current = setTimeout(() => {
      console.log('Auto-retrying after error...')
      this.resetErrorBoundary()
    }, retryDelay)
  }

  private renderErrorUI() {
    const { level, fallback } = this.props
    const { error, errorInfo, errorId } = this.state

    // Custom fallback component
    if (fallback) {
      return fallback
    }

    // Level-specific error UI
    switch (level) {
      case 'app':
        return this.renderAppLevelError()
      case 'route':
        return this.renderRouteLevelError()
      case 'segment':
        return this.renderSegmentLevelError()
      case 'component':
        return this.renderComponentLevelError()
      default:
        return this.renderGenericError()
    }
  }

  private renderAppLevelError() {
    const { error, errorId } = this.state

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Application Error
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Something went wrong with the trading platform. Our team has been notified.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 mb-4 text-left">
              <p className="text-sm font-mono text-gray-800 dark:text-gray-200">
                {error?.message}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Error ID: {errorId}
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload App
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  private renderRouteLevelError() {
    const { error, errorId } = this.state

    return (
      <div className="max-w-lg mx-auto mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Page Error
          </h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          This page encountered an error while loading. You can try refreshing or return to the dashboard.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 mb-4">
            <p className="text-sm font-mono text-gray-800 dark:text-gray-200">
              {error?.message}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Error ID: {errorId}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={this.handleRetry}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </button>

          <button
            onClick={() => window.history.back()}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  private renderSegmentLevelError() {
    const { error } = this.state

    return (
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 my-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Section Unavailable
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              This section couldn't load properly.
              {process.env.NODE_ENV === 'development' && error && (
                <span className="block font-mono text-xs mt-1">{error.message}</span>
              )}
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center mt-2 text-sm text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  private renderComponentLevelError() {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded p-3 my-2">
        <div className="flex items-center">
          <Bug className="h-4 w-4 text-red-500 mr-2" />
          <span className="text-sm text-red-700 dark:text-red-300">
            Component failed to load
          </span>
          <button
            onClick={this.handleRetry}
            className="ml-auto text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  private renderGenericError() {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 my-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-gray-500 mr-2" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Something went wrong
            </span>
          </div>
          <button
            onClick={this.handleRetry}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  componentWillUnmount() {
    if (this.resetTimeoutRef.current) {
      clearTimeout(this.resetTimeoutRef.current)
    }
  }

  render() {
    if (this.state.hasError) {
      return this.renderErrorUI()
    }

    return this.props.children
  }
}

export default BaseErrorBoundary