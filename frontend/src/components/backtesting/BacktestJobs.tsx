/**
 * Backtest Jobs Component
 *
 * Display and manage backtest job history with status tracking,
 * job selection, and cancellation capabilities.
 */

import React, { useState } from 'react';
import type { BacktestStatus } from '../../types';

interface BacktestJobsProps {
  jobs: BacktestStatus[];
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onRefresh: () => void;
}

const BacktestJobs: React.FC<BacktestJobsProps> = ({
  jobs,
  onSelectJob,
  onCancelJob,
  onRefresh
}) => {
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'status' | 'progress'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-200';
      case 'RUNNING':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-200';
      case 'COMPLETED':
        return 'bg-bull-100 text-bull-800 dark:bg-bull-900/20 dark:text-bull-200';
      case 'FAILED':
        return 'bg-bear-100 text-bear-800 dark:bg-bear-900/20 dark:text-bear-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
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

  const formatDuration = (startTime: string, endTime?: string): string => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const durationMs = end - start;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    const durationSeconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    if (durationMinutes > 0) {
      return `${durationMinutes}m ${durationSeconds}s`;
    }
    return `${durationSeconds}s`;
  };

  const formatProgress = (progress: number): string => {
    return `${Math.round(progress)}%`;
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortBy) {
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'progress':
        aValue = a.progress;
        bValue = b.progress;
        break;
      default:
        aValue = a.created_at;
        bValue = b.created_at;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Backtest Jobs ({jobs.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Monitor and manage your backtest execution history
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <button
          onClick={() => setFilter('all')}
          className={`p-3 rounded-lg border text-center ${
            filter === 'all'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {jobs.length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">All</div>
        </button>

        {(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`p-3 rounded-lg border text-center ${
              filter === status
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {statusCounts[status] || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 capitalize">
              {status.toLowerCase()}
            </div>
          </button>
        ))}
      </div>

      {/* Jobs List */}
      {sortedJobs.length > 0 ? (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Job ID
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Strategy
                  </th>
                  <th
                    className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200"
                    onClick={() => handleSort('status')}
                  >
                    Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200"
                    onClick={() => handleSort('progress')}
                  >
                    Progress {sortBy === 'progress' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200"
                    onClick={() => handleSort('created_at')}
                  >
                    Created {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Duration
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job, index) => (
                  <tr
                    key={job.job_id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {job.job_id.slice(0, 8)}...
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {job.job_id.slice(-8)}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {job.configuration?.strategy.name || 'Unknown Strategy'}
                      </div>
                      {job.configuration && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {job.configuration.universe.length} symbols •
                          {job.configuration.start_date} to {job.configuration.end_date}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        <span className="mr-1">{getStatusIcon(job.status)}</span>
                        {job.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              job.status === 'COMPLETED'
                                ? 'bg-bull-500'
                                : job.status === 'FAILED'
                                ? 'bg-bear-500'
                                : 'bg-primary-500'
                            }`}
                            style={{ width: `${Math.max(job.progress, 0)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem]">
                          {formatProgress(job.progress)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(job.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {new Date(job.created_at).toLocaleTimeString()}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {job.started_at ? (
                          formatDuration(job.started_at, job.completed_at || job.updated_at)
                        ) : (
                          '-'
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onSelectJob(job.job_id)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 text-sm font-medium"
                        >
                          {job.status === 'COMPLETED' ? 'View Results' : 'View Details'}
                        </button>

                        {(job.status === 'PENDING' || job.status === 'RUNNING') && (
                          <button
                            onClick={() => onCancelJob(job.job_id)}
                            className="text-bear-600 dark:text-bear-400 hover:text-bear-800 dark:hover:text-bear-200 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {filter === 'all' ? 'No Backtest Jobs' : `No ${filter.toLowerCase()} jobs`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {filter === 'all'
                ? 'You haven\'t run any backtests yet. Start by configuring a strategy.'
                : `No jobs with status "${filter.toLowerCase()}" found.`
              }
            </p>
            {filter === 'all' && (
              <button
                onClick={() => window.location.hash = '#/backtesting?tab=configure'}
                className="btn btn-primary"
              >
                Configure Strategy
              </button>
            )}
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="btn btn-secondary"
              >
                View All Jobs
              </button>
            )}
          </div>
        </div>
      )}

      {/* Job Statistics */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
              <div className="text-2xl font-bold text-bull-600 dark:text-bull-400">
                {Math.round((statusCounts.COMPLETED || 0) / jobs.length * 100)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {statusCounts.COMPLETED || 0} of {jobs.length} completed
              </div>
            </div>
          </div>

          <div className="card">
            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Jobs</div>
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {(statusCounts.PENDING || 0) + (statusCounts.RUNNING || 0)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {statusCounts.RUNNING || 0} running, {statusCounts.PENDING || 0} pending
              </div>
            </div>
          </div>

          <div className="card">
            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed Jobs</div>
              <div className="text-2xl font-bold text-bear-600 dark:text-bear-400">
                {(statusCounts.FAILED || 0) + (statusCounts.CANCELLED || 0)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {statusCounts.FAILED || 0} failed, {statusCounts.CANCELLED || 0} cancelled
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestJobs;