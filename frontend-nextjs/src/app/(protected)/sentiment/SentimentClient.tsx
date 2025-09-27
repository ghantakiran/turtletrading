'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useMarketStore } from '@/stores/marketStore'
import { SentimentData } from './page'
import { SentimentOverview } from './components/SentimentOverview'
import { NewsFeed } from './components/NewsFeed'
import { SocialMediaFeed } from './components/SocialMediaFeed'
import { SectorSentiment } from './components/SectorSentiment'
import { SentimentIndicators } from './components/SentimentIndicators'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AsyncErrorBoundary } from '@/components/AsyncErrorBoundary'

interface SentimentClientProps {
  initialData: SentimentData
}

export function SentimentClient({ initialData }: SentimentClientProps) {
  const [sentimentData, setSentimentData] = useState<SentimentData>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'news' | 'social' | 'sectors'>('overview')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'1H' | '4H' | '1D' | '1W' | '1M'>('1D')

  const { showNotification } = useUIStore()
  const { isConnected, connectionStatus } = useMarketStore()

  // Auto-refresh sentiment data
  const refreshSentimentData = useCallback(async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

      const [sentimentResponse, newsResponse, socialResponse, sectorsResponse] = await Promise.allSettled([
        fetch(`${baseUrl}/api/v1/sentiment/overall`),
        fetch(`${baseUrl}/api/v1/sentiment/news`),
        fetch(`${baseUrl}/api/v1/sentiment/social`),
        fetch(`${baseUrl}/api/v1/sentiment/sectors`),
      ])

      const updatedData: Partial<SentimentData> = {}

      if (sentimentResponse.status === 'fulfilled' && sentimentResponse.value.ok) {
        updatedData.overallSentiment = await sentimentResponse.value.json()
      }

      if (newsResponse.status === 'fulfilled' && newsResponse.value.ok) {
        updatedData.news = await newsResponse.value.json()
      }

      if (socialResponse.status === 'fulfilled' && socialResponse.value.ok) {
        updatedData.socialMedia = await socialResponse.value.json()
      }

      if (sectorsResponse.status === 'fulfilled' && sectorsResponse.value.ok) {
        updatedData.sectorSentiment = await sectorsResponse.value.json()
      }

      setSentimentData(prev => ({
        ...prev,
        ...updatedData,
        lastUpdated: new Date().toISOString(),
      }))

      showNotification({
        title: 'Sentiment Data Updated',
        message: 'Latest sentiment analysis has been loaded',
        type: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to refresh sentiment data:', error)
      showNotification({
        title: 'Refresh Failed',
        message: 'Unable to update sentiment data. Using cached information.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, showNotification])

  // Auto-refresh every 5 minutes when connected
  useEffect(() => {
    if (!isConnected) return

    const interval = setInterval(() => {
      refreshSentimentData()
    }, 300000) // 5 minutes

    return () => clearInterval(interval)
  }, [isConnected, refreshSentimentData])

  // Handle symbol selection for filtering
  const handleSymbolSelect = useCallback((symbol: string | null) => {
    setSelectedSymbol(symbol)
    if (symbol) {
      showNotification({
        title: 'Symbol Filter Applied',
        message: `Now showing sentiment data for ${symbol}`,
        type: 'info',
        duration: 2000,
      })
    } else {
      showNotification({
        title: 'Filter Cleared',
        message: 'Showing all sentiment data',
        type: 'info',
        duration: 2000,
      })
    }
  }, [showNotification])

  // Handle time range change
  const handleTimeRangeChange = useCallback((range: '1H' | '4H' | '1D' | '1W' | '1M') => {
    setTimeRange(range)
    showNotification({
      title: 'Time Range Updated',
      message: `Now showing ${range} sentiment data`,
      type: 'info',
      duration: 2000,
    })
  }, [showNotification])

  // Filter data based on selected symbol
  const filteredData = selectedSymbol ? {
    ...sentimentData,
    news: sentimentData.news.filter(item => item.symbols.includes(selectedSymbol)),
    socialMedia: sentimentData.socialMedia.filter(item => item.symbols.includes(selectedSymbol)),
  } : sentimentData

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Sentiment</h1>
          <p className="text-muted-foreground">
            AI-powered sentiment analysis from news, social media, and institutional data
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            {(['1H', '4H', '1D', '1W', '1M'] as const).map((range) => (
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
            onClick={refreshSentimentData}
            isRefreshing={isRefreshing}
            lastUpdated={sentimentData.lastUpdated}
          />
        </div>
      </div>

      {/* Sentiment Overview */}
      <ErrorBoundary level="component">
        <AsyncErrorBoundary>
          <SentimentOverview
            sentiment={sentimentData.overallSentiment}
            indicators={sentimentData.indicators}
            timeRange={timeRange}
          />
        </AsyncErrorBoundary>
      </ErrorBoundary>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between">
        <nav className="flex space-x-1 bg-muted p-1 rounded-lg">
          {[
            { id: 'overview', label: 'Overview', shortcut: '⌘1' },
            { id: 'news', label: 'News Feed', shortcut: '⌘2' },
            { id: 'social', label: 'Social Media', shortcut: '⌘3' },
            { id: 'sectors', label: 'Sector Analysis', shortcut: '⌘4' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              {tab.label}
              <span className="text-xs opacity-60">{tab.shortcut}</span>
            </button>
          ))}
        </nav>

        {/* Symbol Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedSymbol || ''}
            onChange={(e) => handleSymbolSelect(e.target.value || null)}
            className="px-3 py-1 text-sm border rounded-md bg-background"
          >
            <option value="">All Symbols</option>
            {Array.from(new Set([
              ...sentimentData.news.flatMap(item => item.symbols),
              ...sentimentData.socialMedia.flatMap(item => item.symbols),
            ])).sort().map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'overview' && (
          <ErrorBoundary level="component">
            <AsyncErrorBoundary>
              <SentimentIndicators
                indicators={sentimentData.indicators}
                overallSentiment={sentimentData.overallSentiment}
                timeRange={timeRange}
              />
            </AsyncErrorBoundary>
          </ErrorBoundary>
        )}

        {activeTab === 'news' && (
          <ErrorBoundary level="component">
            <AsyncErrorBoundary>
              <NewsFeed
                news={filteredData.news}
                selectedSymbol={selectedSymbol}
                onSymbolSelect={handleSymbolSelect}
                timeRange={timeRange}
              />
            </AsyncErrorBoundary>
          </ErrorBoundary>
        )}

        {activeTab === 'social' && (
          <ErrorBoundary level="component">
            <AsyncErrorBoundary>
              <SocialMediaFeed
                socialMedia={filteredData.socialMedia}
                selectedSymbol={selectedSymbol}
                onSymbolSelect={handleSymbolSelect}
                timeRange={timeRange}
              />
            </AsyncErrorBoundary>
          </ErrorBoundary>
        )}

        {activeTab === 'sectors' && (
          <ErrorBoundary level="component">
            <AsyncErrorBoundary>
              <SectorSentiment
                sectorSentiment={sentimentData.sectorSentiment}
                timeRange={timeRange}
                onSymbolSelect={handleSymbolSelect}
              />
            </AsyncErrorBoundary>
          </ErrorBoundary>
        )}
      </div>

      {/* Last Updated Info */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {new Date(sentimentData.lastUpdated).toLocaleString()}
      </div>
    </div>
  )
}