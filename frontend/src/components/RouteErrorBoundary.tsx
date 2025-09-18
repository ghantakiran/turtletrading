import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundaryWithStore } from './ErrorBoundary';

interface RouteErrorFallbackProps {
  error?: unknown;
}

export const RouteErrorFallback: React.FC<RouteErrorFallbackProps> = ({ error: propError }) => {
  const routeError = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();

  const error = propError || routeError;

  const getErrorInfo = () => {
    if (isRouteErrorResponse(error)) {
      return {
        status: error.status,
        statusText: error.statusText,
        message: error.data?.message || error.statusText || 'Route Error',
        type: 'route-response-error'
      };
    }

    if (error instanceof Error) {
      return {
        status: null,
        statusText: null,
        message: error.message,
        type: 'route-error'
      };
    }

    return {
      status: null,
      statusText: null,
      message: 'An unexpected routing error occurred',
      type: 'unknown-route-error'
    };
  };

  const { status, statusText, message, type } = getErrorInfo();

  const getErrorIcon = () => {
    switch (status) {
      case 404:
        return '🔍';
      case 403:
        return '🔒';
      case 401:
        return '🚫';
      case 500:
        return '⚠️';
      default:
        return '🗺️';
    }
  };

  const getErrorTitle = () => {
    switch (status) {
      case 404:
        return 'Page Not Found';
      case 403:
        return 'Access Forbidden';
      case 401:
        return 'Authentication Required';
      case 500:
        return 'Server Error';
      default:
        return 'Navigation Error';
    }
  };

  const getErrorDescription = () => {
    switch (status) {
      case 404:
        return `The page you're looking for doesn't exist. It might have been moved, deleted, or the URL might be incorrect.`;
      case 403:
        return `You don't have permission to access this page. Please check your account privileges.`;
      case 401:
        return `You need to be authenticated to access this page. Please log in and try again.`;
      case 500:
        return `The server encountered an error while processing your request. Please try again later.`;
      default:
        return message || 'An error occurred while navigating to this page.';
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  console.error('[RouteErrorBoundary] Route error:', {
    error,
    type,
    status,
    statusText,
    message,
    location: location.pathname,
    timestamp: new Date().toISOString(),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-auto text-center">
        {/* Error Icon */}
        <div className="text-8xl mb-6">{getErrorIcon()}</div>

        {/* Status Code (if available) */}
        {status && (
          <div className="text-6xl font-bold text-gray-400 dark:text-gray-600 mb-2">
            {status}
          </div>
        )}

        {/* Error Title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {getErrorTitle()}
        </h1>

        {/* Error Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {getErrorDescription()}
        </p>

        {/* Current Path (Development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded mb-6 text-sm font-mono text-left">
            <div><strong>Path:</strong> {location.pathname}</div>
            <div><strong>Search:</strong> {location.search || 'None'}</div>
            <div><strong>Hash:</strong> {location.hash || 'None'}</div>
            {error instanceof Error && (
              <div className="mt-2">
                <strong>Error:</strong> {error.message}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleGoHome}
            className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            🏠 Go to Dashboard
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleGoBack}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              ← Go Back
            </button>

            <button
              onClick={handleRetry}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              🔄 Retry
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>If this problem continues, please contact support.</p>
          <div className="mt-2 flex items-center justify-center space-x-4">
            <a
              href="/api/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              📚 API Docs
            </a>
            <a
              href="mailto:support@turtletrading.ai"
              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              ✉️ Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
}

export const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundaryWithStore
      level="page"
      fallback={<RouteErrorFallback />}
      resetKeys={[window.location.pathname]}
    >
      {children}
    </ErrorBoundaryWithStore>
  );
};

export default RouteErrorBoundary;