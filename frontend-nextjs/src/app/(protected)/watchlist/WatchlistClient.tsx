'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import { WatchlistsResponse, WatchlistData, WatchlistStock, exportWatchlistToCSV } from '@/lib/api/watchlist-data'
import { useMarketStore } from '@/stores/marketStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import websocketService from '@/services/websocketService'

interface WatchlistClientProps {
  initialData: WatchlistsResponse
}

interface ColumnConfig {
  id: string
  label: string
  key: keyof WatchlistStock | 'actions'
  sortable: boolean
  width: number
  format?: (value: any, stock: WatchlistStock) => string
  className?: string
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  {
    id: 'symbol',
    label: 'Symbol',
    key: 'symbol',
    sortable: true,
    width: 80,
    className: 'font-mono font-semibold text-primary-600 dark:text-primary-400'
  },
  {
    id: 'name',
    label: 'Company',
    key: 'name',
    sortable: true,
    width: 200,
    className: 'font-medium'
  },
  {
    id: 'price',
    label: 'Price',
    key: 'price',
    sortable: true,
    width: 100,
    format: (value: number) => `$${value.toFixed(2)}`,
    className: 'font-mono'
  },
  {
    id: 'change',
    label: 'Change',
    key: 'change',
    sortable: true,
    width: 80,
    format: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`,
    className: 'font-mono'
  },
  {
    id: 'changePercent',
    label: 'Change %',
    key: 'changePercent',
    sortable: true,
    width: 100,
    format: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
    className: 'font-mono'
  },
  {
    id: 'volume',
    label: 'Volume',
    key: 'volume',
    sortable: true,
    width: 120,
    format: (value: number) => value.toLocaleString(),
    className: 'font-mono text-sm'
  },
  {
    id: 'marketCap',
    label: 'Market Cap',
    key: 'marketCap',
    sortable: true,
    width: 120,
    format: (value: number) => {
      if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
      return `$${value.toLocaleString()}`
    },
    className: 'font-mono text-sm'
  },
  {
    id: 'actions',
    label: 'Actions',
    key: 'actions',
    sortable: false,
    width: 100,
    className: 'text-center'
  }
]

type SortDirection = 'asc' | 'desc' | null
type SortKey = keyof WatchlistStock | null

interface SortState {
  key: SortKey
  direction: SortDirection
}

export function WatchlistClient({ initialData }: WatchlistClientProps) {
  const { stockPrices, isConnected, watchlists, addToWatchlist, removeFromWatchlist } = useMarketStore()
  const { showNotification, theme } = useUIStore()

  // State management
  const [selectedWatchlistId, setSelectedWatchlistId] = useState(initialData.defaultWatchlistId)
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(DEFAULT_COLUMNS.map(col => col.id))
  )
  const [sortState, setSortState] = useState<SortState>({ key: null, direction: null })
  const [searchQuery, setSearchQuery] = useState('')
  const [showColumnConfig, setShowColumnConfig] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)

  // Refs for virtualization
  const parentRef = useRef<HTMLDivElement>(null)

  // Get current watchlist
  const currentWatchlist = useMemo(() => {
    const serverWatchlist = initialData.watchlists.find(w => w.id === selectedWatchlistId)
    const storeWatchlist = watchlists.find(w => w.id === selectedWatchlistId)
    return storeWatchlist || serverWatchlist || initialData.watchlists[0]
  }, [selectedWatchlistId, initialData.watchlists, watchlists])

  // Merge live prices with watchlist data
  const enrichedStocks = useMemo(() => {
    if (!currentWatchlist?.stocks) return []

    return currentWatchlist.stocks.map(stock => {
      const livePrice = stockPrices[stock.symbol]
      if (livePrice) {
        return {
          ...stock,
          price: livePrice.price,
          change: livePrice.change || stock.change,
          changePercent: livePrice.changePercent || stock.changePercent,
          lastUpdated: new Date().toISOString()
        }
      }
      return stock
    })
  }, [currentWatchlist?.stocks, stockPrices])

  // Filter and sort stocks
  const processedStocks = useMemo(() => {
    let filtered = enrichedStocks

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(stock =>
        stock.symbol.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query) ||
        stock.sector?.toLowerCase().includes(query) ||
        stock.industry?.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    if (sortState.key && sortState.direction) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortState.key!]
        const bVal = b[sortState.key!]

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortState.direction === 'asc' ? aVal - bVal : bVal - aVal
        }

        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()

        if (sortState.direction === 'asc') {
          return aStr.localeCompare(bStr)
        } else {
          return bStr.localeCompare(aStr)
        }
      })
    }

    return filtered
  }, [enrichedStocks, searchQuery, sortState])

  // Get visible columns configuration
  const activeColumns = useMemo(() =>
    DEFAULT_COLUMNS.filter(col => visibleColumns.has(col.id)),
    [visibleColumns]
  )

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: processedStocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Row height
    overscan: 5
  })

  // Event handlers
  const handleSort = useCallback((key: keyof WatchlistStock) => {
    setSortState(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' }
        if (prev.direction === 'desc') return { key: null, direction: null }
      }
      return { key, direction: 'asc' }
    })
  }, [])

  const handleStockSelection = useCallback((symbol: string, selected: boolean) => {
    setSelectedStocks(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(symbol)
      } else {
        newSet.delete(symbol)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedStocks.size === processedStocks.length) {
      setSelectedStocks(new Set())
    } else {
      setSelectedStocks(new Set(processedStocks.map(stock => stock.symbol)))
    }
  }, [processedStocks, selectedStocks.size])

  const handleBulkRemove = useCallback(() => {
    if (selectedStocks.size === 0) return

    const symbols = Array.from(selectedStocks)
    symbols.forEach(symbol => removeFromWatchlist(currentWatchlist.id, symbol))

    setSelectedStocks(new Set())
    setShowBulkActions(false)

    showNotification({
      type: 'success',
      title: 'Stocks Removed',
      message: `Removed ${symbols.length} stock${symbols.length > 1 ? 's' : ''} from watchlist`
    })
  }, [selectedStocks, currentWatchlist.id, removeFromWatchlist, showNotification])

  const handleExportCSV = useCallback(() => {
    if (!currentWatchlist) return

    const exportData = {
      ...currentWatchlist,
      stocks: processedStocks.filter(stock => selectedStocks.size === 0 || selectedStocks.has(stock.symbol))
    }

    exportWatchlistToCSV(exportData)

    showNotification({
      type: 'success',
      title: 'Export Complete',
      message: `Exported ${exportData.stocks.length} stocks to CSV`
    })
  }, [currentWatchlist, processedStocks, selectedStocks, showNotification])

  const handleColumnToggle = useCallback((columnId: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(columnId)) {
        newSet.delete(columnId)
      } else {
        newSet.add(columnId)
      }
      return newSet
    })
  }, [])

  // Update bulk actions visibility
  useEffect(() => {
    setShowBulkActions(selectedStocks.size > 0)
  }, [selectedStocks.size])

  // WebSocket subscription for watchlist stocks
  useEffect(() => {
    if (!currentWatchlist?.stocks) return

    const symbols = currentWatchlist.stocks.map(stock => stock.symbol)

    // Subscribe to all stocks in current watchlist
    symbols.forEach(symbol => {
      websocketService.subscribeToSymbol(symbol)
    })

    // Cleanup function to unsubscribe when watchlist changes
    return () => {
      symbols.forEach(symbol => {
        websocketService.unsubscribeFromSymbol(symbol)
      })
    }
  }, [currentWatchlist?.id, currentWatchlist?.stocks])

  // Auto-refresh stock prices periodically as fallback
  useEffect(() => {
    if (!currentWatchlist?.stocks) return

    const refreshInterval = setInterval(() => {
      const symbols = currentWatchlist.stocks.map(stock => stock.symbol)

      // Only refresh if not connected to WebSocket
      if (!isConnected) {
        symbols.forEach(symbol => {
          useMarketStore.getState().fetchStockData(symbol).catch(console.error)
        })
      }
    }, 30000) // Refresh every 30 seconds as fallback

    return () => clearInterval(refreshInterval)
  }, [currentWatchlist?.stocks, isConnected])

  return (
    <div className="space-y-6">
      {/* Watchlist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentWatchlist?.name || 'Watchlist'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {processedStocks.length} stocks • {isConnected ? 'Live Data' : 'Offline'}
              {isConnected && (
                <span className="ml-2 inline-flex items-center">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            isConnected
              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          )}>
            {isConnected ? 'Live Data' : 'Offline'}
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>

          {/* Column Configuration */}
          <button
            onClick={() => setShowColumnConfig(!showColumnConfig)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            Columns
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
              placeholder="Search stocks by symbol, company, or sector..."
            />
          </div>
        </div>

        {/* Watchlist Selector */}
        <div className="min-w-[200px]">
          <select
            value={selectedWatchlistId}
            onChange={(e) => setSelectedWatchlistId(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
          >
            {initialData.watchlists.map(watchlist => (
              <option key={watchlist.id} value={watchlist.id}>
                {watchlist.name} ({watchlist.stockCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Column Configuration Panel */}
      <AnimatePresence>
        {showColumnConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Column Configuration</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {DEFAULT_COLUMNS.map(column => (
                <label key={column.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(column.id)}
                    onChange={() => handleColumnToggle(column.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{column.label}</span>
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {showBulkActions && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
                  {selectedStocks.size} stock{selectedStocks.size > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedStocks(new Set())}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkRemove}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Remove Selected
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Export Selected
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Virtualized Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center px-4 py-3">
            <div className="w-10 flex items-center justify-center">
              <input
                type="checkbox"
                checked={selectedStocks.size > 0 && selectedStocks.size === processedStocks.length}
                ref={(input) => {
                  if (input) input.indeterminate = selectedStocks.size > 0 && selectedStocks.size < processedStocks.length
                }}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>
            {activeColumns.map(column => (
              <div
                key={column.id}
                className={cn(
                  "flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-white",
                  column.sortable && "cursor-pointer hover:text-primary-600 dark:hover:text-primary-400",
                  `flex-shrink-0`
                )}
                style={{ width: column.width }}
                onClick={column.sortable ? () => handleSort(column.key as keyof WatchlistStock) : undefined}
              >
                <span>{column.label}</span>
                {column.sortable && sortState.key === column.key && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {sortState.direction === 'asc' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17l-4 4m0 0l-4-4m4 4V3" />
                    )}
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Virtualized Table Body */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: '600px' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const stock = processedStocks[virtualItem.index]
              const isSelected = selectedStocks.has(stock.symbol)

              return (
                <motion.div
                  key={virtualItem.key}
                  className={cn(
                    "absolute top-0 left-0 w-full flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors",
                    isSelected && "bg-primary-50 dark:bg-primary-900/20"
                  )}
                  style={{
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  layout
                >
                  <div className="w-10 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleStockSelection(stock.symbol, e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </div>
                  {activeColumns.map(column => (
                    <div
                      key={column.id}
                      className={cn(
                        "text-sm",
                        column.className,
                        column.key === 'change' && (stock.change >= 0 ? 'text-bull-600' : 'text-bear-600'),
                        column.key === 'changePercent' && (stock.changePercent >= 0 ? 'text-bull-600' : 'text-bear-600'),
                        `flex-shrink-0`
                      )}
                      style={{ width: column.width }}
                    >
                      {column.id === 'actions' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => removeFromWatchlist(currentWatchlist.id, stock.symbol)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove from watchlist"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ) : column.format ? (
                        column.format(stock[column.key as keyof WatchlistStock], stock)
                      ) : (
                        String(stock[column.key as keyof WatchlistStock] || '')
                      )}
                    </div>
                  ))}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {processedStocks.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
            <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery ? 'No matching stocks' : 'No stocks in watchlist'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {searchQuery
              ? `No stocks match your search "${searchQuery}". Try a different search term.`
              : 'Add stocks to your watchlist to start tracking their performance.'
            }
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  )
}