'use client'

import { MarketData } from '../page'

interface MarketStatsProps {
  data: MarketData
}

export function MarketStats({ data }: MarketStatsProps) {
  const advanceDeclineRatio = data.marketBreadth.advanceDeclineRatio
  const volumeRatio = data.marketBreadth.volumeRatio
  const totalStocks = data.marketBreadth.advancingStocks + data.marketBreadth.decliningStocks + data.marketBreadth.unchangedStocks

  const stats = [
    {
      label: 'Advancing',
      value: data.marketBreadth.advancingStocks,
      total: totalStocks,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Declining',
      value: data.marketBreadth.decliningStocks,
      total: totalStocks,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      label: 'New Highs',
      value: data.marketBreadth.newHighs,
      change: `vs ${data.marketBreadth.newLows} lows`,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'A/D Ratio',
      value: advanceDeclineRatio.toFixed(2),
      change: advanceDeclineRatio > 1 ? 'Bullish' : 'Bearish',
      color: advanceDeclineRatio > 1 ? 'text-green-600' : 'text-red-600',
      bgColor: advanceDeclineRatio > 1 ? 'bg-green-100' : 'bg-red-100'
    }
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Market Breadth</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.bgColor} rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {typeof stat.value === 'number' && stat.total ?
                    `${stat.value}` :
                    stat.value
                  }
                </p>
                {stat.total && typeof stat.value === 'number' && (
                  <p className="text-xs text-gray-500">
                    {((stat.value / stat.total) * 100).toFixed(1)}%
                  </p>
                )}
                {stat.change && (
                  <p className="text-xs text-gray-500">{stat.change}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Volume Analysis</h3>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Up Volume</span>
            <span className="font-semibold text-green-600">
              {(data.marketBreadth.upVolume / 1e9).toFixed(1)}B
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-gray-600">Down Volume</span>
            <span className="font-semibold text-red-600">
              {(data.marketBreadth.downVolume / 1e9).toFixed(1)}B
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Volume Ratio</span>
              <span className={`font-bold ${volumeRatio > 1 ? 'text-green-600' : 'text-red-600'}`}>
                {volumeRatio.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Market Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Issues</span>
              <span className="font-semibold">{totalStocks.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Unchanged</span>
              <span className="font-semibold text-gray-600">{data.marketBreadth.unchangedStocks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Market Bias</span>
              <span className={`font-bold ${advanceDeclineRatio > 1.2 ? 'text-green-600' : advanceDeclineRatio < 0.8 ? 'text-red-600' : 'text-gray-600'}`}>
                {advanceDeclineRatio > 1.2 ? 'Bullish' : advanceDeclineRatio < 0.8 ? 'Bearish' : 'Neutral'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}