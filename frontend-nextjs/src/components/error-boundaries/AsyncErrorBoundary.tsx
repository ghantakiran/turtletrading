'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, Wifi, WifiOff, Clock, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  isolate?: boolean // Prevent error propagation to parent boundaries
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onRetry?: () => void
  maxRetries?: number
  retryDelay?: number
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
  isRetrying: boolean
  errorType: 'network' | 'timeout' | 'api' | 'generic'
}

export class AsyncErrorBoundary extends Component<Props, State> {
  private retryTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>

  constructor(props: Props) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
      errorType: 'generic'
    }

    this.retryTimeoutRef = React.createRef() as React.MutableRefObject<NodeJS.Timeout | null>

    // Listen for unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorType = AsyncErrorBoundary.categorizeError(error)

    return {
      hasError: true,
      error,
      errorType
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ASYNC ERROR BOUNDARY]', error, errorInfo)

    this.setState({ errorInfo })

    // Call custom error handler
    this.props.onError?.(error, errorInfo)

    // Auto-retry for certain error types
    this.handleAutoRetry(error)
  }

  componentWillUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
    }

    if (this.retryTimeoutRef.current) {
      clearTimeout(this.retryTimeoutRef.current)
    }
  }

  private static categorizeError(error: Error): State['errorType'] {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    if (message.includes('network') || message.includes('fetch') || stack.includes('network')) {
      return 'network'
    }

    if (message.includes('timeout') || message.includes('abort')) {
      return 'timeout'
    }

    if (message.includes('api') || message.includes('http') || message.includes('status')) {
      return 'api'
    }

    return 'generic'
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    // Only handle if this component should isolate errors
    if (this.props.isolate) {
      event.preventDefault()

      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason))

      this.setState({
        hasError: true,
        error,
        errorType: AsyncErrorBoundary.categorizeError(error)
      })
    }
  }

  private handleAutoRetry = (error: Error) => {
    const { maxRetries = 3, retryDelay = 2000 } = this.props
    const { retryCount, errorType } = this.state

    // Auto-retry for network and timeout errors
    if ((errorType === 'network' || errorType === 'timeout') && retryCount < maxRetries) {
      this.setState({ isRetrying: true })

      const delay = retryDelay * Math.pow(2, retryCount) // Exponential backoff

      this.retryTimeoutRef.current = setTimeout(() => {
        this.handleRetry()
      }, delay)
    }
  }

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      this.setState({ isRetrying: false })
      return
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      isRetrying: false
    }))

    // Call custom retry handler
    this.props.onRetry?.()
  }

  private renderErrorUI() {
    const { fallback } = this.props
    const { error, errorType, retryCount, isRetrying } = this.state
    const { maxRetries = 3 } = this.props

    if (fallback) {
      return fallback
    }

    const canRetry = retryCount < maxRetries
    const ErrorIcon = this.getErrorIcon(errorType)

    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 my-4">
        <div className="flex items-start">
          <ErrorIcon className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${this.getErrorIconColor(errorType)}`} />

          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              {this.getErrorTitle(errorType)}
            </h3>

            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {this.getErrorMessage(errorType, error)}
            </p>

            {retryCount > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Retry attempt {retryCount} of {maxRetries}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center text-sm text-red-800 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : 'Try Again'}
                </button>
              )}

              {!canRetry && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Maximum retries exceeded. Please refresh the page.
                </span>
              )}
            </div>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-3">
                <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
                  Error Details
                </summary>
                <pre className="text-xs bg-red-100 dark:bg-red-900/20 p-2 rounded mt-1 overflow-auto">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    )
  }

  private getErrorIcon(errorType: State['errorType']) {
    switch (errorType) {
      case 'network':
        return WifiOff
      case 'timeout':
        return Clock
      case 'api':
        return AlertTriangle
      default:
        return AlertTriangle
    }
  }

  private getErrorIconColor(errorType: State['errorType']) {
    switch (errorType) {
      case 'network':
        return 'text-orange-500'
      case 'timeout':
        return 'text-yellow-500'
      case 'api':
        return 'text-red-500'
      default:
        return 'text-red-500'
    }
  }

  private getErrorTitle(errorType: State['errorType']) {
    switch (errorType) {
      case 'network':
        return 'Network Connection Error'
      case 'timeout':
        return 'Request Timeout'
      case 'api':
        return 'API Error'
      default:
        return 'Something went wrong'
    }
  }

  private getErrorMessage(errorType: State['errorType'], error: Error | null) {
    switch (errorType) {
      case 'network':
        return 'Unable to connect to our servers. Please check your internet connection and try again.'
      case 'timeout':
        return 'The request took too long to complete. Please try again.'
      case 'api':
        return 'There was an issue processing your request. Our team has been notified.'
      default:
        return process.env.NODE_ENV === 'development' && error
          ? error.message
          : 'An unexpected error occurred. Please try again.'
    }
  }

  render() {
    if (this.state.hasError) {
      return this.renderErrorUI()
    }

    return this.props.children
  }
}

export default AsyncErrorBoundary