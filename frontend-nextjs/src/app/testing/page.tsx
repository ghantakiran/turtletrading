/**
 * Testing Dashboard Page
 * Real-time monitoring of test results, coverage, and system health
 */

'use client'

import { useState, useEffect } from 'react'
import { TestResults, HealthStatus } from '@/types/testing'
import TestResultsOverview from '@/components/testing/TestResultsOverview'
import CoverageChart from '@/components/testing/CoverageChart'
import HealthStatusPanel from '@/components/testing/HealthStatusPanel'
import SystemMetrics from '@/components/testing/SystemMetrics'

export default function TestingPage() {
  const [testResults, setTestResults] = useState<TestResults | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      setError(null)

      const [testResponse, healthResponse] = await Promise.all([
        fetch('/api/testing/results'),
        fetch('/api/health/status'),
      ])

      if (!testResponse.ok || !healthResponse.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const testData = await testResponse.json()
      const healthData = await healthResponse.json()

      setTestResults(testData)
      setHealthStatus(healthData)
    } catch (err) {
      setError('Error loading dashboard data')
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

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
            <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
            <button
              onClick={fetchDashboardData}
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Testing Dashboard
          </h1>
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
