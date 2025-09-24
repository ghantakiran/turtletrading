import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface PageLoaderProps {
  message?: string;
  showProgress?: boolean;
  progress?: number;
}

const PageLoader: React.FC<PageLoaderProps> = ({
  message = 'Loading...',
  showProgress = false,
  progress = 0
}) => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center z-50">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200 dark:bg-primary-900 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-200 dark:bg-secondary-900 rounded-full opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-primary-100 to-secondary-100 dark:from-primary-800 dark:to-secondary-800 rounded-full opacity-10 animate-spin-slow"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Logo Animation */}
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center shadow-2xl animate-bounce">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="absolute inset-0 w-20 h-20 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-2xl opacity-75 animate-ping"></div>
        </div>

        {/* Loading Content */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white animate-fade-in">
            TurtleTrading
          </h2>

          <div className="flex items-center space-x-3">
            <LoadingSpinner size="lg" variant="primary" />
            <span className="text-lg text-gray-600 dark:text-gray-300 animate-pulse">
              {message}
            </span>
          </div>

          {/* Progress Bar */}
          {showProgress && (
            <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Feature Dots */}
        <div className="flex space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-primary-400 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PageLoader;