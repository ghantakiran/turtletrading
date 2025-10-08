/**
 * OfflineProvider Component
 * Wraps the app with offline sync functionality and connection status
 */

'use client'

import React from 'react'
import { useOfflineSync } from '@/lib/hooks/useOfflineSync'
import { ConnectionStatus } from '@/components/offline/ConnectionStatus'

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { queueSize } = useOfflineSync()

  return (
    <>
      <ConnectionStatus queueSize={queueSize} />
      {children}
    </>
  )
}
