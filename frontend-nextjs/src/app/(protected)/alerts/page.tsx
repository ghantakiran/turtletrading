import { Metadata } from 'next'
import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AlertsClient } from './AlertsClient'
import { getAlertsData, getMockAlertsData } from '@/lib/api/alerts-data'
import { AlertCreationForm } from '@/components/alerts/AlertCreationForm'
import { AlertHistory } from '@/components/alerts/AlertHistory'
import { LiveAlertsPanel } from '@/components/alerts/LiveAlertsPanel'

// Force dynamic rendering for authentication-protected routes
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Alerts - TurtleTrading Pro',
  description: 'Advanced alert builder and notification center with multi-condition alerts, drag thresholds, and comprehensive tracking',
}

function AlertsLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-64"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-28"></div>
        </div>
      </div>

      {/* Alert Builder Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-40"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Center Skeleton */}
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-48"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full mb-1"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Statistics Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertsErrorFallback() {
  return (
    <div className="p-6">
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Error Loading Alerts
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
          There was an error loading the alerts data. Please try refreshing the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Refresh Page
        </button>
      </div>
    </div>
  )
}

async function AlertsDataLoader() {
  console.log('🔄 Loading alerts data on server...')

  try {
    let alertsData
    if (process.env.NODE_ENV === 'development') {
      // Use mock data in development
      alertsData = getMockAlertsData()
      console.log('📊 Using mock alerts data for development')
    } else {
      // Use real API data in production
      alertsData = await getAlertsData()
      console.log('📊 Loaded real alerts data from API')
    }

    return (
      <ErrorBoundary level="component" fallback={<AlertsErrorFallback />}>
        <AlertsClient initialData={alertsData} />
      </ErrorBoundary>
    )
  } catch (error) {
    console.error('❌ Error loading alerts data, falling back to mock data:', error)

    // Fallback to mock data with user notification
    const mockData = getMockAlertsData()

    return (
      <ErrorBoundary level="component" fallback={<AlertsErrorFallback />}>
        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Using Demo Data
              </h3>
              <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                <p>Unable to connect to alerts API. Showing demo data for development.</p>
              </div>
            </div>
          </div>
        </div>
        <AlertsClient initialData={mockData} />
      </ErrorBoundary>
    )
  }
}

export default function AlertsPage() {
  console.log('🚀 Rendering Alerts page (Server Component)')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="space-y-8 p-6">
        {/* Page Header */}
        <div className="border-b pb-6">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
            Trading Alerts
          </h1>
          <p className="text-muted-foreground text-lg">
            Create custom alerts and manage real-time notifications for your watchlist
          </p>
        </div>

        {/* Live Alerts Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-1 bg-gradient-to-b from-red-600 to-rose-600 rounded-full" />
            <h2 className="text-2xl font-bold">Active Alerts</h2>
          </div>
          <LiveAlertsPanel />
        </section>

        {/* Alert Creation Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-1 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
            <h2 className="text-2xl font-bold">Create New Alert</h2>
          </div>
          <AlertCreationForm />
        </section>

        {/* Alert History Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-1 bg-gradient-to-b from-purple-600 to-violet-600 rounded-full" />
            <h2 className="text-2xl font-bold">Alert History</h2>
          </div>
          <AlertHistory />
        </section>

        {/* Original Advanced Alert Builder (for backward compatibility) */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-1 bg-gradient-to-b from-green-600 to-emerald-600 rounded-full" />
            <h2 className="text-2xl font-bold">Advanced Alert Builder</h2>
          </div>
          <Suspense fallback={<AlertsLoadingSkeleton />}>
            <AlertsDataLoader />
          </Suspense>
        </section>
      </div>
    </div>
  )
}