'use client'

import { SectorData } from '../page'

interface SectorHeatmapProps {
  sectors: SectorData[]
  selectedSector: string | null
  onSectorSelect: (sector: string | null) => void
  timeRange: '1D' | '1W' | '1M' | '3M' | '1Y'
}

export function SectorHeatmap({ sectors, selectedSector, onSectorSelect, timeRange }: SectorHeatmapProps) {
  const getPerformanceColor = (changePercent: number) => {
    if (changePercent >= 3) return 'bg-green-600'
    if (changePercent >= 1.5) return 'bg-green-500'
    if (changePercent >= 0.5) return 'bg-green-400'
    if (changePercent >= 0) return 'bg-green-300'
    if (changePercent >= -0.5) return 'bg-red-300'
    if (changePercent >= -1.5) return 'bg-red-400'
    if (changePercent >= -3) return 'bg-red-500'
    return 'bg-red-600'
  }

  const getTextColor = (changePercent: number) => {
    return Math.abs(changePercent) >= 1.5 ? 'text-white' : 'text-gray-900'
  }

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(1)}T`
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`
    return `$${marketCap.toLocaleString()}`
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`
    return volume.toString()
  }

  // Sort sectors by performance for better visualization
  const sortedSectors = [...sectors].sort((a, b) => b.changePercent - a.changePercent)

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Sector Performance</h2>
        <p className="text-sm text-gray-500 mt-1">
          Click on a sector to view detailed analysis • {timeRange} performance
        </p>
      </div>

      <div className="p-6">
        {/* Heatmap Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
          {sortedSectors.map((sector) => {
            const isSelected = selectedSector === sector.sector
            return (
              <div
                key={sector.sector}
                className={`
                  relative cursor-pointer rounded-lg p-4 transition-all duration-200 hover:scale-105
                  ${getPerformanceColor(sector.changePercent)}
                  ${isSelected ? 'ring-4 ring-blue-500 ring-opacity-50' : ''}
                `}
                onClick={() => onSectorSelect(isSelected ? null : sector.sector)}
              >
                <div className={`${getTextColor(sector.changePercent)}`}>
                  <p className="text-sm font-medium truncate" title={sector.sector}>
                    {sector.sector}
                  </p>
                  <p className="text-lg font-bold mt-1">
                    {sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                  </p>
                  <p className="text-xs opacity-80 mt-1">
                    {formatMarketCap(sector.marketCap)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Performance Legend */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Performance Scale</p>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500">-3%+</span>
            <div className="w-6 h-4 bg-red-600 rounded-sm"></div>
            <div className="w-6 h-4 bg-red-500 rounded-sm"></div>
            <div className="w-6 h-4 bg-red-400 rounded-sm"></div>
            <div className="w-6 h-4 bg-red-300 rounded-sm"></div>
            <div className="w-6 h-4 bg-green-300 rounded-sm"></div>
            <div className="w-6 h-4 bg-green-400 rounded-sm"></div>
            <div className="w-6 h-4 bg-green-500 rounded-sm"></div>
            <div className="w-6 h-4 bg-green-600 rounded-sm"></div>
            <span className="text-xs text-gray-500">+3%+</span>
          </div>
        </div>

        {/* Sector Details Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sector
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Change
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Market Cap
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Volume
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Stocks
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedSectors.map((sector) => (
                <tr
                  key={sector.sector}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedSector === sector.sector ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => onSectorSelect(selectedSector === sector.sector ? null : sector.sector)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-3 ${getPerformanceColor(sector.changePercent)}`}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{sector.sector}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className={`text-sm font-medium ${
                      sector.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                    </div>
                    <div className={`text-xs ${
                      sector.change >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {sector.change >= 0 ? '+' : ''}{(sector.change / 1e6).toFixed(1)}M
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">
                      {formatMarketCap(sector.marketCap)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">
                      {formatVolume(sector.volume)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {sector.topStocks.slice(0, 3).map((stock, index) => (
                        <span
                          key={stock.symbol}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            stock.changePercent >= 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {stock.symbol}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedSector && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedSector} - Top Performers
              </h3>
              <button
                onClick={() => onSectorSelect(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {sectors
                .find(s => s.sector === selectedSector)
                ?.topStocks.map((stock) => (
                  <div key={stock.symbol} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-900">{stock.symbol}</span>
                      <span className={`text-sm font-medium ${
                        stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}