/**
 * useOfflineSync Hook
 * Manages offline sync queue and connection status
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { OfflineQueue, QueueAction } from '@/lib/sync/offline-queue'

interface UseOfflineSyncReturn {
  queue: OfflineQueue
  isOnline: boolean
  queueSize: number
  enqueue: (action: Omit<QueueAction, 'id' | 'timestamp' | 'retries'>) => Promise<void>
  processQueue: () => Promise<void>
  getQueueSize: () => Promise<number>
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [queueSize, setQueueSize] = useState<number>(0)
  const queueRef = useRef<OfflineQueue | null>(null)

  // Initialize queue
  useEffect(() => {
    const queue = new OfflineQueue()
    queueRef.current = queue

    // Initialize the queue
    queue.init()

    // Register queue change listener
    const handleQueueChange = (size: number) => {
      setQueueSize(size)
    }

    queue.on('change', handleQueueChange)

    // Cleanup
    return () => {
      queue.off('change', handleQueueChange)
    }
  }, [])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)

      // Process queue when coming back online
      if (queueRef.current) {
        try {
          await queueRef.current.processQueue()
        } catch (error) {
          console.error('Failed to process offline queue:', error)
        }
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    // Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Enqueue action
  const enqueue = useCallback(
    async (action: Omit<QueueAction, 'id' | 'timestamp' | 'retries'>) => {
      if (queueRef.current) {
        await queueRef.current.enqueue(action)
      }
    },
    []
  )

  // Process queue
  const processQueue = useCallback(async () => {
    if (queueRef.current) {
      await queueRef.current.processQueue()
    }
  }, [])

  // Get queue size
  const getQueueSize = useCallback(async () => {
    if (queueRef.current) {
      return await queueRef.current.size()
    }
    return 0
  }, [])

  return {
    queue: queueRef.current as OfflineQueue,
    isOnline,
    queueSize,
    enqueue,
    processQueue,
    getQueueSize,
  }
}
