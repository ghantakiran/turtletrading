/**
 * Offline Fallback Page
 * Displayed when the app is accessed without an internet connection
 */

'use client'

import React from 'react'
import { WifiOff, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload()
  }

  const offlineFeatures = [
    { name: 'View portfolio', available: true },
    { name: 'View watchlist', available: true },
    { name: 'View cached charts', available: true },
    { name: 'View price history', available: true },
  ]

  const onlineOnlyFeatures = [
    { name: 'Real-time prices', available: false },
    { name: 'Add/remove stocks', available: false },
    { name: 'AI predictions', available: false },
    { name: 'Market news', available: false },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-yellow-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
          You&apos;re Offline
        </h1>

        {/* Description */}
        <p className="text-center text-gray-600 mb-6">
          Some features require an internet connection. You can still view your cached portfolio and
          watchlist.
        </p>

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 mb-8 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Try Again
        </button>

        {/* Feature Availability */}
        <div className="space-y-6">
          {/* Available Features */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Available Offline
            </h2>
            <ul className="space-y-2">
              {offlineFeatures.map((feature) => (
                <li key={feature.name} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  {feature.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Unavailable Features */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Requires Connection
            </h2>
            <ul className="space-y-2">
              {onlineOnlyFeatures.map((feature) => (
                <li key={feature.name} className="flex items-center gap-2 text-sm text-gray-500">
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  {feature.name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Changes you make while offline will be automatically synced when
            your connection is restored.
          </p>
        </div>
      </div>
    </div>
  )
}
