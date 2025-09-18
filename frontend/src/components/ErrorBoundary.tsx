import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useUIStore } from '../stores';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'global' | 'page' | 'component';
  resetKeys?: Array<string | number>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;

    this.setState({ errorInfo });

    // Log error details
    console.error(`[ErrorBoundary:${level}] Caught error:`, error);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);

    // Report to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportErrorToService(error, errorInfo);
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Update UI store error state based on level
    this.updateErrorState(error.message, level);

    // Auto-reset after 10 seconds for component-level errors
    if (level === 'component') {
      this.resetTimeoutId = window.setTimeout(() => {
        this.resetErrorBoundary();
      }, 10000);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys = [] } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys.some((resetKey, idx) =>
        prevProps.resetKeys?.[idx] !== resetKey
      )) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private updateErrorState = (errorMessage: string, level: string) => {
    // Note: This is a class component, so we can't use hooks directly
    // We'll need to handle this via a callback or context
    const errorText = `[${level.toUpperCase()}] ${errorMessage}`;

    // Store error in session storage for debugging
    sessionStorage.setItem('lastError', JSON.stringify({
      level,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      errorId: this.state.errorId,
    }));
  };

  private reportErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Integration with error reporting services like Sentry, Rollbar, etc.
    // This would be configured in a real application
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          errorId: this.state.errorId,
        }),
      }).catch(() => {
        // Silently fail if error reporting fails
      });
    } catch {
      // Silently fail if error reporting fails
    }
  };

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, level = 'component' } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI based on error level
      return (
        <ErrorFallbackUI
          error={error}
          errorInfo={errorInfo}
          level={level}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          errorId={this.state.errorId}
        />
      );
    }

    return children;
  }
}

interface ErrorFallbackUIProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  level: string;
  onRetry: () => void;
  onReload: () => void;
  errorId: string;
}

const ErrorFallbackUI: React.FC<ErrorFallbackUIProps> = ({
  error,
  errorInfo,
  level,
  onRetry,
  onReload,
  errorId,
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const getErrorMessage = () => {
    switch (level) {
      case 'global':
        return 'A critical error occurred. Please reload the page.';
      case 'page':
        return 'This page encountered an error. Please try refreshing.';
      case 'component':
        return 'A component failed to load. Retrying automatically...';
      default:
        return 'An unexpected error occurred.';
    }
  };

  const getErrorIcon = () => {
    switch (level) {
      case 'global':
        return '🚨';
      case 'page':
        return '⚠️';
      case 'component':
        return '🔧';
      default:
        return '❌';
    }
  };

  return (
    <div className={`
      flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed
      ${level === 'global' ? 'min-h-screen bg-red-50 border-red-300 dark:bg-red-900/10 dark:border-red-600' : ''}
      ${level === 'page' ? 'min-h-96 bg-orange-50 border-orange-300 dark:bg-orange-900/10 dark:border-orange-600' : ''}
      ${level === 'component' ? 'min-h-32 bg-yellow-50 border-yellow-300 dark:bg-yellow-900/10 dark:border-yellow-600' : ''}
    `}>
      {/* Error Icon */}
      <div className="text-6xl mb-4">{getErrorIcon()}</div>

      {/* Error Title */}
      <h2 className={`
        text-xl font-bold text-center mb-2
        ${level === 'global' ? 'text-red-800 dark:text-red-200' : ''}
        ${level === 'page' ? 'text-orange-800 dark:text-orange-200' : ''}
        ${level === 'component' ? 'text-yellow-800 dark:text-yellow-200' : ''}
      `}>
        {level === 'global' && 'Critical Error'}
        {level === 'page' && 'Page Error'}
        {level === 'component' && 'Component Error'}
      </h2>

      {/* Error Message */}
      <p className="text-gray-700 dark:text-gray-300 text-center mb-6 max-w-md">
        {getErrorMessage()}
      </p>

      {/* Error Details (Development Only) */}
      {isDevelopment && error && (
        <details className="mb-6 w-full max-w-2xl">
          <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Show Error Details
          </summary>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-xs font-mono overflow-auto">
            <div className="mb-2">
              <strong>Error ID:</strong> {errorId}
            </div>
            <div className="mb-2">
              <strong>Message:</strong> {error.message}
            </div>
            {error.stack && (
              <div className="mb-2">
                <strong>Stack:</strong>
                <pre className="whitespace-pre-wrap mt-1">{error.stack}</pre>
              </div>
            )}
            {errorInfo?.componentStack && (
              <div>
                <strong>Component Stack:</strong>
                <pre className="whitespace-pre-wrap mt-1">{errorInfo.componentStack}</pre>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {level === 'component' && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}

        {(level === 'global' || level === 'page') && (
          <button
            onClick={onReload}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Reload Page
          </button>
        )}

        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Go Back
        </button>
      </div>

      {/* Support Information */}
      <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>If this problem persists, please contact support.</p>
        <p className="mt-1">Error ID: <code className="font-mono">{errorId}</code></p>
      </div>
    </div>
  );
};

// Hook-based wrapper for functional components that need to update error state
export const ErrorBoundaryWithStore: React.FC<Omit<ErrorBoundaryProps, 'onError'>> = (props) => {
  const { setGlobalError, setPageError } = useUIStore();

  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    const { level = 'component' } = props;
    const errorMessage = error.message;

    switch (level) {
      case 'global':
        setGlobalError(errorMessage);
        break;
      case 'page':
        setPageError(errorMessage);
        break;
      default:
        // Component-level errors don't update global state
        break;
    }
  };

  return (
    <ErrorBoundary {...props} onError={handleError} />
  );
};

export default ErrorBoundary;