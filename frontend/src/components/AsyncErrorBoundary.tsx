import React, { useState, useEffect, useCallback } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundaryWithStore } from './ErrorBoundary';
import { useUIStore } from '../stores';

interface AsyncErrorInfo {
  type: 'network' | 'api' | 'timeout' | 'validation' | 'unknown';
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  timestamp: Date;
  retryCount: number;
}

interface AsyncErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<AsyncErrorFallbackProps>;
  onError?: (error: Error, errorInfo: AsyncErrorInfo) => void;
  maxRetries?: number;
  retryDelay?: number;
  resetKeys?: Array<string | number>;
  isolate?: boolean; // Whether to isolate errors to this boundary
}

interface AsyncErrorFallbackProps {
  error: Error;
  errorInfo: AsyncErrorInfo;
  onRetry: () => void;
  onReset: () => void;
  canRetry: boolean;
  isRetrying: boolean;
}

export const AsyncErrorBoundary: React.FC<AsyncErrorBoundaryProps> = ({
  children,
  fallback: CustomFallback,
  onError,
  maxRetries = 3,
  retryDelay = 1000,
  resetKeys = [],
  isolate = false,
}) => {
  const [error, setError] = useState<Error | null>(null);
  const [errorInfo, setErrorInfo] = useState<AsyncErrorInfo | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const { showNotification } = useUIStore();

  const parseError = useCallback((error: Error): AsyncErrorInfo => {
    let type: AsyncErrorInfo['type'] = 'unknown';
    let status: number | undefined;
    let statusText: string | undefined;
    let url: string | undefined;
    let method: string | undefined;

    // Parse network/fetch errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      type = 'network';
    }

    // Parse API response errors
    if ('status' in error && typeof error.status === 'number') {
      type = 'api';
      status = error.status;
      statusText = 'statusText' in error ? String(error.statusText) : undefined;
      url = 'url' in error ? String(error.url) : undefined;
      method = 'method' in error ? String(error.method) : undefined;
    }

    // Parse timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      type = 'timeout';
    }

    // Parse validation errors
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      type = 'validation';
    }

    return {
      type,
      status,
      statusText,
      url,
      method,
      timestamp: new Date(),
      retryCount,
    };
  }, [retryCount]);

  const handleError = useCallback((error: Error) => {
    const info = parseError(error);
    setError(error);
    setErrorInfo(info);

    console.error('[AsyncErrorBoundary] Async error caught:', error);
    console.error('[AsyncErrorBoundary] Error info:', info);

    // Call custom error handler
    if (onError) {
      onError(error, info);
    }

    // Show notification for certain error types
    if (!isolate) {
      const shouldNotify =
        info.type === 'network' ||
        (info.type === 'api' && info.status && info.status >= 500);

      if (shouldNotify) {
        showNotification({
          id: `async-error-${Date.now()}`,
          type: 'error',
          title: 'Connection Error',
          message: getErrorMessage(error, info),
          duration: 5000,
          actions: [{
            label: 'Retry',
            action: () => handleRetry(),
          }],
        });
      }
    }
  }, [onError, parseError, isolate, showNotification]);

  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries || isRetrying) {
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    // Wait for retry delay
    await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));

    // Reset error state to trigger re-render
    setError(null);
    setErrorInfo(null);
    setIsRetrying(false);
  }, [retryCount, maxRetries, isRetrying, retryDelay]);

  const handleReset = useCallback(() => {
    setError(null);
    setErrorInfo(null);
    setIsRetrying(false);
    setRetryCount(0);
  }, []);

  // Reset when resetKeys change
  useEffect(() => {
    handleReset();
  }, resetKeys);

  // Set up global unhandled promise rejection handler
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error) {
        handleError(event.reason);
        event.preventDefault(); // Prevent default browser error handling
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleError]);

  const canRetry = retryCount < maxRetries && !isRetrying;

  if (error && errorInfo) {
    const FallbackComponent = CustomFallback || AsyncErrorFallback;

    return (
      <FallbackComponent
        error={error}
        errorInfo={errorInfo}
        onRetry={handleRetry}
        onReset={handleReset}
        canRetry={canRetry}
        isRetrying={isRetrying}
      />
    );
  }

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundaryWithStore
          level="component"
          resetKeys={[...resetKeys, retryCount]}
          onError={(error) => {
            handleError(error);
            reset(); // Reset React Query cache
          }}
        >
          {children}
        </ErrorBoundaryWithStore>
      )}
    </QueryErrorResetBoundary>
  );
};

const getErrorMessage = (error: Error, info: AsyncErrorInfo): string => {
  switch (info.type) {
    case 'network':
      return 'Unable to connect to the server. Please check your internet connection.';
    case 'api':
      if (info.status === 401) {
        return 'Authentication expired. Please log in again.';
      }
      if (info.status === 403) {
        return 'You do not have permission to perform this action.';
      }
      if (info.status === 404) {
        return 'The requested resource was not found.';
      }
      if (info.status && info.status >= 500) {
        return 'Server error. Please try again later.';
      }
      return `API error: ${error.message}`;
    case 'timeout':
      return 'Request timed out. Please try again.';
    case 'validation':
      return `Validation error: ${error.message}`;
    default:
      return `Unexpected error: ${error.message}`;
  }
};

const AsyncErrorFallback: React.FC<AsyncErrorFallbackProps> = ({
  error,
  errorInfo,
  onRetry,
  onReset,
  canRetry,
  isRetrying,
}) => {
  const getErrorIcon = () => {
    switch (errorInfo.type) {
      case 'network':
        return '📡';
      case 'api':
        return '🔌';
      case 'timeout':
        return '⏱️';
      case 'validation':
        return '✏️';
      default:
        return '⚠️';
    }
  };

  const getErrorTitle = () => {
    switch (errorInfo.type) {
      case 'network':
        return 'Connection Error';
      case 'api':
        return 'API Error';
      case 'timeout':
        return 'Request Timeout';
      case 'validation':
        return 'Validation Error';
      default:
        return 'Async Error';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-orange-50 dark:bg-orange-900/10 border-2 border-dashed border-orange-300 dark:border-orange-600 rounded-lg min-h-48">
      {/* Error Icon */}
      <div className="text-4xl mb-3">{getErrorIcon()}</div>

      {/* Error Title */}
      <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-2">
        {getErrorTitle()}
      </h3>

      {/* Error Message */}
      <p className="text-orange-700 dark:text-orange-300 text-center mb-4 text-sm">
        {getErrorMessage(error, errorInfo)}
      </p>

      {/* API Details (if available) */}
      {errorInfo.type === 'api' && errorInfo.status && (
        <div className="bg-orange-100 dark:bg-orange-900/20 px-3 py-2 rounded text-xs mb-4">
          <span className="font-mono">
            {errorInfo.method} {errorInfo.url} - {errorInfo.status} {errorInfo.statusText}
          </span>
        </div>
      )}

      {/* Retry Information */}
      {errorInfo.retryCount > 0 && (
        <div className="text-xs text-orange-600 dark:text-orange-400 mb-4">
          Retry attempt {errorInfo.retryCount} of 3
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {canRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              isRetrying
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {isRetrying ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                Retrying...
              </>
            ) : (
              'Try Again'
            )}
          </button>
        )}

        <button
          onClick={onReset}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Dismiss
        </button>
      </div>

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 w-full">
          <summary className="text-xs cursor-pointer text-orange-600 dark:text-orange-400">
            Debug Info
          </summary>
          <pre className="text-xs bg-orange-100 dark:bg-orange-900/20 p-2 rounded mt-2 overflow-auto">
            {JSON.stringify({
              message: error.message,
              type: errorInfo.type,
              status: errorInfo.status,
              timestamp: errorInfo.timestamp.toISOString(),
              retryCount: errorInfo.retryCount,
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

export default AsyncErrorBoundary;