import React, { useState } from 'react';
import AsyncErrorBoundary from '../components/AsyncErrorBoundary';
import { ErrorBoundaryWithStore } from '../components/ErrorBoundary';

const ErrorTestPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Error Boundary Test Page
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          This page is used to test different types of error boundaries in development.
        </p>
      </div>

      <div className="space-y-8">
        {/* Component Error Test */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Component Error Test
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tests component-level error boundaries with runtime errors.
          </p>
          <ErrorBoundaryWithStore level="component">
            <ComponentErrorTest />
          </ErrorBoundaryWithStore>
        </div>

        {/* Async Error Test */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Async Error Test
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tests async error boundaries with API failures and network errors.
          </p>
          <AsyncErrorBoundary maxRetries={2} retryDelay={1000}>
            <AsyncErrorTest />
          </AsyncErrorBoundary>
        </div>

        {/* Network Error Test */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Network Error Test
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tests network error handling with fake API calls.
          </p>
          <AsyncErrorBoundary isolate maxRetries={1}>
            <NetworkErrorTest />
          </AsyncErrorBoundary>
        </div>

        {/* Validation Error Test */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Validation Error Test
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tests validation error handling.
          </p>
          <AsyncErrorBoundary isolate>
            <ValidationErrorTest />
          </AsyncErrorBoundary>
        </div>
      </div>
    </div>
  );
};

const ComponentErrorTest: React.FC = () => {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error('This is a test component error!');
  }

  return (
    <div>
      <button
        onClick={() => setShouldError(true)}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        data-testid="trigger-component-error"
      >
        Trigger Component Error
      </button>
      <p className="mt-2 text-sm text-gray-500">
        Component is working normally. Click the button to trigger an error.
      </p>
    </div>
  );
};

const AsyncErrorTest: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const triggerAsyncError = async () => {
    setIsLoading(true);

    // Simulate an async operation that fails
    await new Promise(resolve => setTimeout(resolve, 1000));

    const error = new Error('Async operation failed');
    (error as any).status = 500;
    (error as any).statusText = 'Internal Server Error';
    (error as any).url = '/api/test/async-error';
    (error as any).method = 'POST';

    throw error;
  };

  return (
    <div>
      <button
        onClick={triggerAsyncError}
        disabled={isLoading}
        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:bg-gray-400"
        data-testid="trigger-async-error"
      >
        {isLoading ? 'Processing...' : 'Trigger Async Error'}
      </button>
      <p className="mt-2 text-sm text-gray-500">
        Async operations are working. Click to trigger an async error.
      </p>
    </div>
  );
};

const NetworkErrorTest: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const triggerNetworkError = async () => {
    setIsLoading(true);

    try {
      // Try to fetch from a non-existent endpoint
      const response = await fetch('/api/nonexistent-endpoint');

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).statusText = response.statusText;
        (error as any).url = '/api/nonexistent-endpoint';
        (error as any).method = 'GET';
        throw error;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={triggerNetworkError}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        data-testid="trigger-network-error"
      >
        {isLoading ? 'Requesting...' : 'Trigger Network Error'}
      </button>
      <p className="mt-2 text-sm text-gray-500">
        Network is connected. Click to trigger a network error.
      </p>
    </div>
  );
};

const ValidationErrorTest: React.FC = () => {
  const triggerValidationError = () => {
    const error = new Error('Invalid input: email field is required');
    error.name = 'ValidationError';
    throw error;
  };

  return (
    <div>
      <button
        onClick={triggerValidationError}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        data-testid="trigger-validation-error"
      >
        Trigger Validation Error
      </button>
      <p className="mt-2 text-sm text-gray-500">
        Validation is passing. Click to trigger a validation error.
      </p>
    </div>
  );
};

export default ErrorTestPage;