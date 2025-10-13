/**
 * Testing Dashboard Page
 * Real-time monitoring of test results, coverage, and system health
 */

'use client'

import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh'
import { TestResults, HealthStatus } from '@/types/testing'
import TestResultsOverview from '@/components/testing/TestResultsOverview'
import CoverageChart from '@/components/testing/CoverageChart'
import HealthStatusPanel from '@/components/testing/HealthStatusPanel'
import SystemMetrics from '@/components/testing/SystemMetrics'
import RefreshIndicator from '@/components/testing/RefreshIndicator'

export default function TestingPage() {
  // Auto-refresh test results every 30 seconds
  const {
    data: testResults,
    loading: testLoading,
    error: testError,
    lastUpdate: testLastUpdate,
    refresh: refreshTests,
    pause: pauseTests,
    resume: resumeTests,
    isPaused: testsPaused,
  } = useAutoRefresh<TestResults>(
    async () => {
      const response = await fetch('/api/testing/results')
      if (!response.ok) throw new Error('Failed to fetch test results')
      return response.json()
    },
    30000
  )

  // Auto-refresh health status every 30 seconds
  const {
    data: healthStatus,
    loading: healthLoading,
    error: healthError,
    lastUpdate: healthLastUpdate,
    refresh: refreshHealth,
  } = useAutoRefresh<HealthStatus>(
    async () => {
      const response = await fetch('/api/health/status')
      if (!response.ok) throw new Error('Failed to fetch health status')
      return response.json()
    },
    30000
  )

  const loading = testLoading || healthLoading
  const error = testError || healthError
  const lastUpdate = testLastUpdate || healthLastUpdate

  const handleRefresh = () => {
    refreshTests()
    refreshHealth()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Testing Dashboard
          </h1>
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">Loading dashboard data...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Testing Dashboard
          </h1>
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400 mb-4">{error.message || 'Error loading dashboard data'}</div>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Testing Dashboard
          </h1>
          <RefreshIndicator
            lastUpdate={lastUpdate}
            onRefresh={handleRefresh}
            loading={loading}
            isPaused={testsPaused}
            onPause={pauseTests}
            onResume={resumeTests}
          />
        </div>

        <div className="space-y-8">
          {/* Test Results Overview */}
          {testResults && <TestResultsOverview testResults={testResults} />}

          {/* Coverage Chart */}
          {testResults && (
            <CoverageChart coverage={testResults.coverage} />
          )}

          {/* Health Status */}
          {healthStatus && <HealthStatusPanel healthStatus={healthStatus} />}

          {/* System Metrics */}
          {healthStatus && <SystemMetrics system={healthStatus.system} />}
        </div>
      </div>
    </div>
  )
}
