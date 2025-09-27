'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useMarketStore } from '@/stores/marketStore'
import { MarketData } from './page'
import { MarketIndices } from './components/MarketIndices'
import { SectorHeatmap } from './components/SectorHeatmap'
import { MarketBreadthWidget } from './components/MarketBreadthWidget'
import { MarketStats } from './components/MarketStats'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AsyncErrorBoundary } from '@/components/AsyncErrorBoundary'

interface MarketClientProps {
  initialData: MarketData
}

export function MarketClient({ initialData }: MarketClientProps) {
  const [marketData, setMarketData] = useState<MarketData>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1D')

  const { showNotification } = useUIStore()
  const { isConnected, connectionStatus } = useMarketStore()

  // Auto-refresh market data
  const refreshMarketData = useCallback(async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

      const [indicesResponse, sectorsResponse, breadthResponse] = await Promise.allSettled([
        fetch(`${baseUrl}/api/v1/market/indices`),
        fetch(`${baseUrl}/api/v1/market/sectors`),
        fetch(`${baseUrl}/api/v1/market/breadth`),
      ])

      const updatedData: Partial<MarketData> = {}

      if (indicesResponse.status === 'fulfilled' && indicesResponse.value.ok) {
        updatedData.indices = await indicesResponse.value.json()
      }

      if (sectorsResponse.status === 'fulfilled' && sectorsResponse.value.ok) {
        updatedData.sectors = await sectorsResponse.value.json()
      }

      if (breadthResponse.status === 'fulfilled' && breadthResponse.value.ok) {
        updatedData.marketBreadth = await breadthResponse.value.json()
      }

      setMarketData(prev => ({
        ...prev,
        ...updatedData,
        lastUpdated: new Date().toISOString(),
      }))

      showNotification({
        title: 'Market Data Updated',
        message: 'Latest market information has been loaded',
        type: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to refresh market data:', error)
      showNotification({
        title: 'Refresh Failed',
        message: 'Unable to update market data. Using cached information.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, showNotification])

  // Auto-refresh every 60 seconds when connected
  useEffect(() => {
    if (!isConnected) return

    const interval = setInterval(() => {
      refreshMarketData()
    }, 60000)

    return () => clearInterval(interval)
  }, [isConnected, refreshMarketData])

  // Handle sector selection for drilldown
  const handleSectorSelect = useCallback((sector: string | null) => {
    setSelectedSector(sector)
    if (sector) {
      showNotification({
        title: 'Sector Selected',
        message: `Now viewing detailed information for ${sector}`,
        type: 'info',
        duration: 2000,
      })
    }
  }, [showNotification])

  // Handle time range change
  const handleTimeRangeChange = useCallback((range: '1D' | '1W' | '1M' | '3M' | '1Y') => {
    setTimeRange(range)
    // In a real implementation, this would trigger a data refetch with the new time range
    showNotification({
      title: 'Time Range Updated',
      message: `Now showing ${range} data`,
      type: 'info',
      duration: 2000,
    })
  }, [showNotification])

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Overview</h1>
          <p className="text-muted-foreground">
            Real-time market analysis and sector performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            {(['1D', '1W', '1M', '3M', '1Y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-background'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            />
            <span className="capitalize">{connectionStatus}</span>
          </div>

          {/* Refresh Button */}
          <RefreshButton
            onClick={refreshMarketData}
            isRefreshing={isRefreshing}
            lastUpdated={marketData.lastUpdated}
          />
        </div>
      </div>

      {/* Market Statistics */}
      <ErrorBoundary level="component">
        <AsyncErrorBoundary>
          <MarketStats data={marketData} />
        </AsyncErrorBoundary>
      </ErrorBoundary>

      {/* Market Indices */}
      <ErrorBoundary level="component">
        <AsyncErrorBoundary>
          <MarketIndices
            indices={marketData.indices}
            timeRange={timeRange}
            onRefresh={refreshMarketData}
          />
        </AsyncErrorBoundary>
      </ErrorBoundary>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Heatmap */}
        <ErrorBoundary level="component">
          <AsyncErrorBoundary>
            <SectorHeatmap
              sectors={marketData.sectors}
              selectedSector={selectedSector}
              onSectorSelect={handleSectorSelect}
              timeRange={timeRange}
            />
          </AsyncErrorBoundary>
        </ErrorBoundary>

        {/* Market Breadth */}
        <ErrorBoundary level="component">
          <AsyncErrorBoundary>
            <MarketBreadthWidget
              breadthData={marketData.marketBreadth}
              timeRange={timeRange}
            />
          </AsyncErrorBoundary>
        </ErrorBoundary>
      </div>

      {/* Sector Drilldown (when sector is selected) */}
      {selectedSector && (
        <ErrorBoundary level="component">
          <AsyncErrorBoundary>
            <div className="mt-6">
              <div className="bg-card rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold">{selectedSector} Sector Analysis</h2>
                  <button
                    onClick={() => handleSectorSelect(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Sector details would go here */}
                <div className="text-center py-8 text-muted-foreground">
                  <p>Detailed sector analysis for {selectedSector}</p>
                  <p className="text-sm mt-2">Individual stock performance, sector trends, and analysis</p>
                </div>
              </div>
            </div>
          </AsyncErrorBoundary>
        </ErrorBoundary>
      )}

      {/* Last Updated Info */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {new Date(marketData.lastUpdated).toLocaleString()}
      </div>
    </div>
  )
}