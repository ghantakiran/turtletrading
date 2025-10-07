'use client'

import { MarketIndex } from '../page'

interface MarketIndicesProps {
  indices: MarketIndex[]
  timeRange: '1D' | '1W' | '1M' | '3M' | '1Y'
  onRefresh: () => void
}

export function MarketIndices({ indices, timeRange, onRefresh }: MarketIndicesProps) {
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const formatChange = (change: number) => {
    return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)
  }

  const formatChangePercent = (changePercent: number) => {
    const sign = changePercent >= 0 ? '+' : ''
    return `(${sign}${changePercent.toFixed(2)}%)`
  }

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const getChangeBgColor = (change: number) => {
    return change >= 0 ? 'bg-green-50' : 'bg-red-50'
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Market Indices</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
            <button
              onClick={onRefresh}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {indices.map((index) => (
            <div
              key={index.symbol}
              className={`rounded-lg p-4 border ${getChangeBgColor(index.change)} border-gray-200 hover:border-gray-300 transition-colors`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{index.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{index.symbol}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getChangeColor(index.change)} ${getChangeBgColor(index.change)}`}>
                  {formatChangePercent(index.changePercent)}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(index.value)}
                </p>
                <div className="flex items-center mt-1 space-x-2">
                  <span className={`text-sm font-medium ${getChangeColor(index.change)}`}>
                    {formatChange(index.change)}
                  </span>
                  <span className={`text-sm ${getChangeColor(index.change)}`}>
                    {formatChangePercent(index.changePercent)}
                  </span>
                </div>
              </div>

              {index.volume && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Volume</span>
                    <span>{(index.volume / 1e6).toFixed(1)}M</span>
                  </div>
                </div>
              )}

              {(index.high52Week && index.low52Week) && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>52W High</span>
                    <span className="text-green-600">${formatPrice(index.high52Week)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>52W Low</span>
                    <span className="text-red-600">${formatPrice(index.low52Week)}</span>
                  </div>

                  {/* 52-week range progress bar */}
                  <div className="mt-2">
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-blue-500 rounded-full"
                        style={{
                          width: `${((index.value - index.low52Week) / (index.high52Week - index.low52Week)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Showing data for {timeRange} period</span>
            <span>Real-time data • Delayed 15 minutes</span>
          </div>
        </div>
      </div>
    </div>
  )
}