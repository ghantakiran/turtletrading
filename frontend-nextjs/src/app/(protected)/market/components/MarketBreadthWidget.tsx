'use client'

import { MarketBreadth } from '../page'

interface MarketBreadthWidgetProps {
  breadthData: MarketBreadth
  timeRange: '1D' | '1W' | '1M' | '3M' | '1Y'
}

export function MarketBreadthWidget({ breadthData, timeRange }: MarketBreadthWidgetProps) {
  const totalStocks = breadthData.advancingStocks + breadthData.decliningStocks + breadthData.unchangedStocks
  const advancingPercentage = (breadthData.advancingStocks / totalStocks) * 100
  const decliningPercentage = (breadthData.decliningStocks / totalStocks) * 100

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`
    return volume.toLocaleString()
  }

  const getBreadthSentiment = () => {
    const ratio = breadthData.advanceDeclineRatio
    if (ratio >= 2) return { text: 'Very Bullish', color: 'text-green-700', bgColor: 'bg-green-100' }
    if (ratio >= 1.5) return { text: 'Bullish', color: 'text-green-600', bgColor: 'bg-green-50' }
    if (ratio >= 1.2) return { text: 'Slightly Bullish', color: 'text-green-500', bgColor: 'bg-green-50' }
    if (ratio >= 0.8) return { text: 'Neutral', color: 'text-gray-600', bgColor: 'bg-gray-50' }
    if (ratio >= 0.5) return { text: 'Slightly Bearish', color: 'text-red-500', bgColor: 'bg-red-50' }
    if (ratio >= 0.3) return { text: 'Bearish', color: 'text-red-600', bgColor: 'bg-red-50' }
    return { text: 'Very Bearish', color: 'text-red-700', bgColor: 'bg-red-100' }
  }

  const sentiment = getBreadthSentiment()

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Market Breadth</h2>
        <p className="text-sm text-gray-500 mt-1">
          Advance/Decline analysis for {timeRange} period
        </p>
      </div>

      <div className="p-6">
        {/* Market Sentiment Indicator */}
        <div className={`rounded-lg p-4 mb-6 ${sentiment.bgColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Market Sentiment</p>
              <p className={`text-xl font-bold ${sentiment.color}`}>{sentiment.text}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">A/D Ratio</p>
              <p className={`text-2xl font-bold ${sentiment.color}`}>
                {breadthData.advanceDeclineRatio.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Advance/Decline Bar Chart */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Stock Performance</span>
            <span className="text-sm text-gray-500">{totalStocks.toLocaleString()} total issues</span>
          </div>

          <div className="relative">
            {/* Progress bar background */}
            <div className="h-8 bg-gray-200 rounded-lg overflow-hidden flex">
              {/* Advancing stocks */}
              <div
                className="bg-green-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${advancingPercentage}%` }}
              >
                {advancingPercentage > 20 && `${advancingPercentage.toFixed(1)}%`}
              </div>
              {/* Declining stocks */}
              <div
                className="bg-red-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${decliningPercentage}%` }}
              >
                {decliningPercentage > 20 && `${decliningPercentage.toFixed(1)}%`}
              </div>
              {/* Unchanged stocks */}
              <div
                className="bg-gray-400 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${((breadthData.unchangedStocks / totalStocks) * 100)}%` }}
              >
              </div>
            </div>

            {/* Labels below the bar */}
            <div className="flex justify-between mt-2 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span className="text-gray-700">
                  Advancing: {breadthData.advancingStocks.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span className="text-gray-700">
                  Declining: {breadthData.decliningStocks.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">New Highs</p>
                <p className="text-2xl font-bold text-green-600">{breadthData.newHighs}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14l3-3 3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-800">New Lows</p>
                <p className="text-2xl font-bold text-red-600">{breadthData.newLows}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 10l-3 3-3-3-5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Volume Analysis */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Volume Analysis</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Up Volume</span>
              <span className="font-semibold text-green-600">
                {formatVolume(breadthData.upVolume)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Down Volume</span>
              <span className="font-semibold text-red-600">
                {formatVolume(breadthData.downVolume)}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-sm font-medium text-gray-700">Volume Ratio (Up/Down)</span>
              <span className={`font-bold ${breadthData.volumeRatio > 1 ? 'text-green-600' : 'text-red-600'}`}>
                {breadthData.volumeRatio.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Volume ratio bar */}
          <div className="mt-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  breadthData.volumeRatio > 1 ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min(breadthData.volumeRatio * 50, 100)}%`
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>Bearish</span>
              <span>1.0</span>
              <span>Bullish</span>
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Issues</p>
              <p className="text-lg font-semibold text-gray-900">{totalStocks.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Unchanged</p>
              <p className="text-lg font-semibold text-gray-900">{breadthData.unchangedStocks.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">High/Low Ratio</p>
              <p className={`text-lg font-semibold ${
                breadthData.newHighs > breadthData.newLows ? 'text-green-600' : 'text-red-600'
              }`}>
                {breadthData.newLows > 0 ? (breadthData.newHighs / breadthData.newLows).toFixed(2) : '∞'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}