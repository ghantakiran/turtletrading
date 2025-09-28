import { Suspense } from 'react'

// Force dynamic rendering for authentication-protected routes
export const dynamic = 'force-dynamic'
import { Metadata } from 'next'
import { getWatchlistsData, getMockWatchlistsData } from '@/lib/api/watchlist-data'
import { WatchlistClient } from './WatchlistClient'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Watchlist - TurtleTrading Pro',
  description: 'Real-time stock watchlist with virtualized table, streaming updates, and advanced filtering capabilities',
  keywords: ['watchlist', 'stocks', 'real-time', 'streaming', 'portfolio tracking'],
  openGraph: {
    title: 'Watchlist - TurtleTrading Pro',
    description: 'Professional stock watchlist with real-time streaming data and advanced analytics',
    type: 'website',
  },
}

// Watchlist data loader component
async function WatchlistDataLoader() {
  console.log('🔄 Loading watchlist data on server...')
  
  try {
    // Try to load real data, fallback to mock data for development
    let watchlistData
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🛠️ Development mode - using mock watchlist data')
      watchlistData = getMockWatchlistsData()
    } else {
      watchlistData = await getWatchlistsData()
    }

    console.log('✅ Watchlist data loaded successfully')
    
    return (
      <ErrorBoundary level="component" fallback={<WatchlistErrorFallback />}>
        <WatchlistClient initialData={watchlistData} />
      </ErrorBoundary>
    )
  } catch (error) {
    console.error('❌ Failed to load watchlist data:', error)
    
    // Fallback to mock data on error
    const mockData = getMockWatchlistsData()
    
    return (
      <ErrorBoundary level="component" fallback={<WatchlistErrorFallback />}>
        <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Using Demo Data
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Watchlist data is currently using demo values. Connect to live data feeds for real-time updates.
              </p>
            </div>
          </div>
        </div>
        <WatchlistClient initialData={mockData} />
      </ErrorBoundary>
    )
  }
}

// Error fallback component
function WatchlistErrorFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-6">
            <svg className="h-12 w-12 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Watchlist Unavailable
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            We're having trouble loading your watchlist data. Please try refreshing the page or contact support if the issue persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reload Watchlist
          </button>
        </div>
      </div>
    </div>
  )
}

// Loading skeleton component
function WatchlistLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-96"></div>
          </div>
          
          {/* Watchlist selector skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
            <div className="flex space-x-2">
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
            </div>
          </div>
          
          {/* Table skeleton */}
          <div className="space-y-3">
            {/* Header row */}
            <div className="grid grid-cols-7 gap-4 p-4 bg-slate-200 dark:bg-slate-700 rounded-lg">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-4 bg-slate-300 dark:bg-slate-600 rounded"></div>
              ))}
            </div>
            
            {/* Data rows */}
            {[...Array(10)].map((_, i) => (
              <div key={i} className="grid grid-cols-7 gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg border">
                {[...Array(7)].map((_, j) => (
                  <div key={j} className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main watchlist page component
export default function WatchlistPage() {
  console.log('📋 Rendering Watchlist page...')
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Watchlist
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time stock monitoring with advanced filtering and analysis tools
          </p>
        </div>

        {/* Watchlist data with suspense boundary */}
        <Suspense fallback={<WatchlistLoadingSkeleton />}>
          <WatchlistDataLoader />
        </Suspense>
      </div>
    </div>
  )
}

// Static paths generation for potential static optimization
export async function generateStaticParams() {
  // Watchlist page doesn't have dynamic params, but this enables ISR
  return [{}]
}
