/**
 * Backtesting Page
 *
 * Main interface for portfolio backtesting with strategy configuration,
 * execution monitoring, and results visualization.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUIStore } from '../stores';
import BacktestConfigurationForm from '../components/backtesting/BacktestConfigurationForm';
import BacktestResults from '../components/backtesting/BacktestResults';
import BacktestJobs from '../components/backtesting/BacktestJobs';
import BacktestProgress from '../components/backtesting/BacktestProgress';
import { backtestService } from '../services/backtestService';
import type { BacktestResult, BacktestStatus, BacktestConfiguration } from '../types';

const Backtesting: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showNotification } = useUIStore();

  // State management
  const [activeTab, setActiveTab] = useState<'configure' | 'monitor' | 'results' | 'jobs'>('configure');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [backtestStatus, setBacktestStatus] = useState<BacktestStatus | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [jobs, setJobs] = useState<BacktestStatus[]>([]);
  const [serviceHealth, setServiceHealth] = useState<any>(null);

  // Initialize from URL params
  useEffect(() => {
    const tab = searchParams.get('tab') as any;
    if (tab && ['configure', 'monitor', 'results', 'jobs'].includes(tab)) {
      setActiveTab(tab);
    }

    const jobId = searchParams.get('job_id');
    if (jobId) {
      setCurrentJobId(jobId);
      setActiveTab('monitor');
      handleJobSelect(jobId);
    }
  }, [searchParams]);

  // Load initial data
  useEffect(() => {
    loadJobs();
    checkServiceHealth();
  }, []);

  const loadJobs = async () => {
    try {
      const jobsList = await backtestService.listBacktestJobs(undefined, 20);
      setJobs(jobsList);
    } catch (error) {
      console.error('Failed to load backtest jobs:', error);
    }
  };

  const checkServiceHealth = async () => {
    try {
      const health = await backtestService.healthCheck();
      setServiceHealth(health);
    } catch (error) {
      console.error('Failed to check service health:', error);
      showNotification({
        type: 'error',
        title: 'Service Unavailable',
        message: 'Backtesting service is currently unavailable',
        duration: 5000
      });
    }
  };

  const handleRunBacktest = async (configuration: BacktestConfiguration) => {
    try {
      setIsRunning(true);

      const request = {
        configuration,
        save_results: true,
        email_report: false
      };

      const response = await backtestService.runBacktest(request);
      const jobId = response.job_id;

      setCurrentJobId(jobId);
      setActiveTab('monitor');
      setSearchParams({ tab: 'monitor', job_id: jobId });

      showNotification({
        type: 'success',
        title: 'Backtest Started',
        message: `Backtest job ${jobId.slice(0, 8)}... has been queued`,
        duration: 3000
      });

      // Start monitoring the job
      monitorBacktest(jobId);

      // Reload jobs list
      loadJobs();
    } catch (error) {
      setIsRunning(false);
      showNotification({
        type: 'error',
        title: 'Backtest Failed',
        message: error instanceof Error ? error.message : 'Failed to start backtest',
        duration: 5000
      });
    }
  };

  const monitorBacktest = async (jobId: string) => {
    try {
      const result = await backtestService.pollBacktestCompletion(
        jobId,
        2000, // Poll every 2 seconds
        300,  // Max 10 minutes
        (status: BacktestStatus) => {
          setBacktestStatus(status);
        }
      );

      setBacktestResult(result);
      setIsRunning(false);
      setActiveTab('results');

      showNotification({
        type: 'success',
        title: 'Backtest Complete',
        message: `Backtest finished with ${result.performance_metrics.total_return.toFixed(2)}% total return`,
        duration: 5000
      });

      loadJobs();
    } catch (error) {
      setIsRunning(false);
      showNotification({
        type: 'error',
        title: 'Backtest Error',
        message: error instanceof Error ? error.message : 'Backtest failed',
        duration: 5000
      });
    }
  };

  const handleJobSelect = async (jobId: string) => {
    try {
      setCurrentJobId(jobId);
      const status = await backtestService.getBacktestStatus(jobId);
      setBacktestStatus(status);

      if (status.status === 'COMPLETED' && status.result) {
        setBacktestResult(status.result);
        setActiveTab('results');
      } else if (status.status === 'RUNNING') {
        setActiveTab('monitor');
        monitorBacktest(jobId);
      } else {
        setActiveTab('monitor');
      }

      setSearchParams({ tab: activeTab, job_id: jobId });
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Job Load Error',
        message: 'Failed to load backtest job details',
        duration: 5000
      });
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await backtestService.cancelBacktestJob(jobId);
      showNotification({
        type: 'info',
        title: 'Job Cancelled',
        message: 'Backtest job has been cancelled',
        duration: 3000
      });
      loadJobs();
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Cancel Failed',
        message: 'Failed to cancel backtest job',
        duration: 5000
      });
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Portfolio Backtesting
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Test your trading strategies with walk-forward optimization and comprehensive risk reports
          </p>
        </div>
        <div className="text-right">
          {serviceHealth && (
            <div className="text-sm">
              <p className="text-gray-500 dark:text-gray-400">Service Status</p>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  serviceHealth.status === 'healthy' ? 'bg-bull-500' : 'bg-bear-500'
                }`} />
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {serviceHealth.status}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  ({serviceHealth.active_jobs} active jobs)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'configure', label: 'Configure Strategy', icon: '⚙️' },
            { key: 'monitor', label: 'Monitor Progress', icon: '📊', disabled: !currentJobId },
            { key: 'results', label: 'View Results', icon: '📈', disabled: !backtestResult },
            { key: 'jobs', label: 'Job History', icon: '📋' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key as any)}
              disabled={tab.disabled}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : tab.disabled
                  ? 'border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'configure' && (
          <BacktestConfigurationForm
            onRunBacktest={handleRunBacktest}
            isRunning={isRunning}
          />
        )}

        {activeTab === 'monitor' && currentJobId && (
          <BacktestProgress
            jobId={currentJobId}
            status={backtestStatus}
            onCancel={() => handleCancelJob(currentJobId)}
            onComplete={(result) => {
              setBacktestResult(result);
              setActiveTab('results');
            }}
          />
        )}

        {activeTab === 'results' && backtestResult && (
          <BacktestResults
            result={backtestResult}
            onNewBacktest={() => setActiveTab('configure')}
          />
        )}

        {activeTab === 'jobs' && (
          <BacktestJobs
            jobs={jobs}
            onSelectJob={handleJobSelect}
            onCancelJob={handleCancelJob}
            onRefresh={loadJobs}
          />
        )}
      </div>

      {/* No content state */}
      {activeTab === 'monitor' && !currentJobId && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Active Backtest
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Start a new backtest to monitor its progress here.
          </p>
          <button
            onClick={() => setActiveTab('configure')}
            className="btn btn-primary"
          >
            Configure Strategy
          </button>
        </div>
      )}

      {activeTab === 'results' && !backtestResult && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📈</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Results Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Complete a backtest to view detailed results and performance metrics.
          </p>
          <button
            onClick={() => setActiveTab('configure')}
            className="btn btn-primary"
          >
            Start New Backtest
          </button>
        </div>
      )}
    </div>
  );
};

export default Backtesting;