/**
 * useOptimisticUpdate Hook
 * Provides optimistic UI updates with automatic rollback on failure
 */

'use client'

import { useState, useCallback, useRef } from 'react'

export interface UseOptimisticUpdateReturn {
  optimisticUpdate<T>(
    updateFn: () => Promise<T>,
    optimisticData: T,
    onOptimistic?: (data: T) => void,
    rollbackFn?: () => void
  ): Promise<T>
  isPending: boolean
  rollback: () => void
}

export function useOptimisticUpdate(): UseOptimisticUpdateReturn {
  const [isPending, setIsPending] = useState<boolean>(false)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const rollbackFnRef = useRef<(() => void) | null>(null)

  const optimisticUpdate = useCallback(
    async <T>(
      updateFn: () => Promise<T>,
      optimisticData: T,
      onOptimistic?: (data: T) => void,
      rollbackFn?: () => void
    ): Promise<T> => {
      // Store rollback function
      rollbackFnRef.current = rollbackFn || null

      // Set pending state first
      setPendingCount((count) => count + 1)
      setIsPending(true)

      try {
        // Apply optimistic update immediately
        if (onOptimistic) {
          onOptimistic(optimisticData)
        }

        // Call the actual update function
        const result = await updateFn()

        // Success - return result
        return result
      } catch (error) {
        // Rollback on error
        if (rollbackFnRef.current) {
          rollbackFnRef.current()
        }

        // Re-throw error
        throw error
      } finally {
        // Update pending state
        setPendingCount((count) => {
          const newCount = count - 1
          if (newCount <= 0) {
            setIsPending(false)
            return 0
          }
          return newCount
        })
      }
    },
    []
  )

  const rollback = useCallback(() => {
    if (rollbackFnRef.current) {
      rollbackFnRef.current()
    }
  }, [])

  return {
    optimisticUpdate,
    isPending,
    rollback,
  }
}
