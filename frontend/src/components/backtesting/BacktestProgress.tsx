/**
 * Backtest Progress Component
 *
 * Real-time monitoring of backtest execution with progress tracking,
 * status updates, and cancellation capability.
 */

import React, { useState, useEffect } from 'react';
import { backtestService } from '../../services/backtestService';
import type { BacktestStatus, BacktestResult } from '../../types';

interface BacktestProgressProps {
  jobId: string;
  status: BacktestStatus | null;
  onCancel: () => void;
  onComplete: (result: BacktestResult) => void;
}

const BacktestProgress: React.FC<BacktestProgressProps> = ({
  jobId,
  status: initialStatus,
  onCancel,
  onComplete
}) => {
  const [status, setStatus] = useState<BacktestStatus | null>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Poll for status updates
  useEffect(() => {
    if (!jobId) return;

    let interval: NodeJS.Timeout;
    let timeInterval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const currentStatus = await backtestService.getBacktestStatus(jobId);
        setStatus(currentStatus);

        if (currentStatus.status === 'COMPLETED' && currentStatus.result) {
          onComplete(currentStatus.result);
          clearInterval(interval);
          clearInterval(timeInterval);
        } else if (currentStatus.status === 'FAILED') {
          setError(currentStatus.error || 'Backtest failed');
          clearInterval(interval);
          clearInterval(timeInterval);
        } else if (currentStatus.status === 'CANCELLED') {
          clearInterval(interval);
          clearInterval(timeInterval);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get status');
        clearInterval(interval);
        clearInterval(timeInterval);
      }
    };

    const updateElapsedTime = () => {
      if (status?.started_at) {
        const startTime = new Date(status.started_at).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }
    };

    // Poll every 2 seconds
    interval = setInterval(pollStatus, 2000);
    timeInterval = setInterval(updateElapsedTime, 1000);

    // Initial poll
    pollStatus();
    updateElapsedTime();

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [jobId, status?.started_at, onComplete]);

  const formatElapsedTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatProgress = (progress: number): string => {
    return `${Math.round(progress)}%`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return 'text-warning-600 bg-warning-100 dark:bg-warning-900/20';
      case 'RUNNING':
        return 'text-primary-600 bg-primary-100 dark:bg-primary-900/20';
      case 'COMPLETED':
        return 'text-bull-600 bg-bull-100 dark:bg-bull-900/20';
      case 'FAILED':
        return 'text-bear-600 bg-bear-100 dark:bg-bear-900/20';
      case 'CANCELLED':
        return 'text-gray-600 bg-gray-100 dark:bg-gray-800';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-800';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return '⏳';
      case 'RUNNING':
        return '🔄';
      case 'COMPLETED':
        return '✅';
      case 'FAILED':
        return '❌';
      case 'CANCELLED':
        return '🚫';
      default:
        return '❓';
    }
  };

  if (!status) {
    return (
      <div className="card">
        <div className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading backtest status...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Job Status Card */}
      <div className="card">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Backtest Progress
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Job ID: {jobId.slice(0, 8)}...{jobId.slice(-8)}
              </p>
            </div>

            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
              <span className="mr-1">{getStatusIcon(status.status)}</span>
              {status.status}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progress
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatProgress(status.progress)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  status.status === 'COMPLETED'
                    ? 'bg-bull-500'
                    : status.status === 'FAILED'
                    ? 'bg-bear-500'
                    : 'bg-primary-500'
                }`}
                style={{ width: `${Math.max(status.progress, 0)}%` }}
              />
            </div>
          </div>

          {/* Status Message */}
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {status.message}
            </p>
          </div>

          {/* Timing Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Created
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {new Date(status.created_at).toLocaleString()}
              </div>
            </div>

            {status.started_at && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Started
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {new Date(status.started_at).toLocaleString()}
                </div>
              </div>
            )}

            {status.status === 'RUNNING' && status.started_at && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Elapsed Time
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatElapsedTime(elapsedTime)}
                </div>
              </div>
            )}

            {status.completed_at && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Completed
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {new Date(status.completed_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-bear-50 border border-bear-200 rounded-lg dark:bg-bear-900/20 dark:border-bear-800">
              <div className="flex">
                <div className="text-bear-400 mr-3">❌</div>
                <div>
                  <h4 className="text-sm font-medium text-bear-800 dark:text-bear-200">
                    Backtest Error
                  </h4>
                  <p className="text-sm text-bear-600 dark:text-bear-400 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {status.status === 'RUNNING' && (
                <span>⚡ Backtest is currently running...</span>
              )}
              {status.status === 'PENDING' && (
                <span>⏳ Backtest is queued for execution...</span>
              )}
              {status.status === 'COMPLETED' && (
                <span>🎉 Backtest completed successfully!</span>
              )}
              {status.status === 'FAILED' && (
                <span>💥 Backtest failed. Check the error details above.</span>
              )}
              {status.status === 'CANCELLED' && (
                <span>🚫 Backtest was cancelled.</span>
              )}
            </div>

            <div className="space-x-3">
              {(status.status === 'PENDING' || status.status === 'RUNNING') && (
                <button
                  onClick={onCancel}
                  className="btn btn-bear btn-sm"
                >
                  Cancel Backtest
                </button>
              )}

              <button
                onClick={() => window.location.reload()}
                className="btn btn-secondary btn-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Summary */}
      {status.configuration && (
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Configuration Summary
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Strategy
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {status.configuration.strategy.name}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                  {status.configuration.strategy.strategy_type.replace('_', ' ')}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Date Range
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {status.configuration.start_date} to {status.configuration.end_date}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Initial Capital
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  ${status.configuration.initial_capital.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Universe Size
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {status.configuration.universe.length} symbols
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Max Positions
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {status.configuration.max_positions}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Rebalancing
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {status.configuration.rebalancing_frequency}
                </div>
              </div>

              {status.configuration.walk_forward && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Walk-Forward
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {status.configuration.walk_forward.training_period_months}m train /
                    {status.configuration.walk_forward.validation_period_months}m test
                  </div>
                </div>
              )}
            </div>

            {/* Universe Preview */}
            <div className="mt-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Universe ({status.configuration.universe.length} symbols)
              </div>
              <div className="flex flex-wrap gap-1">
                {status.configuration.universe.slice(0, 20).map(symbol => (
                  <span
                    key={symbol}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono"
                  >
                    {symbol}
                  </span>
                ))}
                {status.configuration.universe.length > 20 && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                    +{status.configuration.universe.length - 20} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Updates */}
      {status.status === 'RUNNING' && (
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Live Updates
            </h3>

            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse mr-3" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Backtest engine is processing your strategy...
                </span>
              </div>

              {status.progress > 0 && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-bull-500 rounded-full mr-3" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {formatProgress(status.progress)} complete
                  </span>
                </div>
              )}

              {status.progress > 25 && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-bull-500 rounded-full mr-3" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Loading historical data and calculating indicators...
                  </span>
                </div>
              )}

              {status.progress > 50 && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-bull-500 rounded-full mr-3" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Executing trading signals and position sizing...
                  </span>
                </div>
              )}

              {status.progress > 75 && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-bull-500 rounded-full mr-3" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Calculating performance metrics and generating reports...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestProgress;