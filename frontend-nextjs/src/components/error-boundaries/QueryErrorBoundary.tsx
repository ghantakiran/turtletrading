'use client'

import React from 'react'
import { QueryErrorResetBoundary, useQueryClient } from '@tanstack/react-query'
import { BaseErrorBoundary } from './BaseErrorBoundary'
import { AsyncErrorBoundary } from './AsyncErrorBoundary'

interface Props {
  children: React.ReactNode
  level?: 'route' | 'segment' | 'component'
  fallback?: React.ReactNode
  resetKeys?: Array<string | number>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function QueryErrorBoundary({
  children,
  level = 'segment',
  fallback,
  resetKeys,
  onError
}: Props) {
  const queryClient = useQueryClient()

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log the error
    console.error('[QUERY ERROR BOUNDARY]', error, errorInfo)

    // Reset any failed queries in the cache
    queryClient.resetQueries({
      predicate: (query) => query.state.status === 'error'
    })

    // Clear any stale data that might be causing issues
    queryClient.invalidateQueries()

    // Call custom error handler
    onError?.(error, errorInfo)
  }

  const handleRetry = () => {
    // Retry any failed queries
    queryClient.resetQueries({
      predicate: (query) => query.state.status === 'error'
    })

    // Refetch active queries
    queryClient.refetchQueries({
      predicate: (query) => query.state.status === 'success'
    })
  }

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <BaseErrorBoundary
          level={level}
          fallback={fallback}
          resetKeys={resetKeys}
          onError={(error, errorInfo) => {
            handleError(error, errorInfo)
            reset()
          }}
        >
          <AsyncErrorBoundary
            onRetry={handleRetry}
            maxRetries={2}
            retryDelay={1000}
          >
            {children}
          </AsyncErrorBoundary>
        </BaseErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

export default QueryErrorBoundary