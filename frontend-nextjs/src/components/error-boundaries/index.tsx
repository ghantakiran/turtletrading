export { BaseErrorBoundary } from './BaseErrorBoundary'
export { AsyncErrorBoundary } from './AsyncErrorBoundary'
export { QueryErrorBoundary } from './QueryErrorBoundary'

// Higher-order component for easy error boundary wrapping
import React from 'react'
import { BaseErrorBoundary } from './BaseErrorBoundary'
import { AsyncErrorBoundary } from './AsyncErrorBoundary'

interface WithErrorBoundaryOptions {
  level?: 'app' | 'route' | 'segment' | 'component'
  enableAsync?: boolean
  resetKeys?: Array<string | number>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  fallback?: React.ReactNode
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const {
    level = 'component',
    enableAsync = true,
    resetKeys,
    onError,
    fallback
  } = options

  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    const errorBoundaryContent = <Component {...props} ref={ref} />

    if (enableAsync) {
      return (
        <BaseErrorBoundary
          level={level}
          resetKeys={resetKeys}
          onError={onError}
          fallback={fallback}
        >
          <AsyncErrorBoundary>
            {errorBoundaryContent}
          </AsyncErrorBoundary>
        </BaseErrorBoundary>
      )
    }

    return (
      <BaseErrorBoundary
        level={level}
        resetKeys={resetKeys}
        onError={onError}
        fallback={fallback}
      >
        {errorBoundaryContent}
      </BaseErrorBoundary>
    )
  })

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Convenience components for different levels
export const AppErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BaseErrorBoundary level="app">
    {children}
  </BaseErrorBoundary>
)

export const RouteErrorBoundary: React.FC<{
  children: React.ReactNode
  resetKeys?: Array<string | number>
}> = ({ children, resetKeys }) => (
  <BaseErrorBoundary level="route" resetKeys={resetKeys} resetOnPropsChange={!!resetKeys}>
    <AsyncErrorBoundary>
      {children}
    </AsyncErrorBoundary>
  </BaseErrorBoundary>
)

export const SegmentErrorBoundary: React.FC<{
  children: React.ReactNode
  resetKeys?: Array<string | number>
}> = ({ children, resetKeys }) => (
  <BaseErrorBoundary level="segment" resetKeys={resetKeys} resetOnPropsChange={!!resetKeys}>
    <AsyncErrorBoundary isolate>
      {children}
    </AsyncErrorBoundary>
  </BaseErrorBoundary>
)

export const ComponentErrorBoundary: React.FC<{
  children: React.ReactNode
  isolate?: boolean
}> = ({ children, isolate = true }) => (
  <BaseErrorBoundary level="component">
    <AsyncErrorBoundary isolate={isolate}>
      {children}
    </AsyncErrorBoundary>
  </BaseErrorBoundary>
)