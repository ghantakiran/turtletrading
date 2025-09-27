'use client'

import { SectorSentiment } from '../page'

interface SectorSentimentProps {
  sectorSentiment: SectorSentiment[]
  timeRange: '1H' | '4H' | '1D' | '1W' | '1M'
  onSymbolSelect: (symbol: string | null) => void
}

export function SectorSentiment({ sectorSentiment, timeRange, onSymbolSelect }: SectorSentimentProps) {
  const getSentimentColor = (score: number) => {
    if (score >= 50) return 'text-green-600'
    if (score >= 10) return 'text-yellow-600'
    if (score >= -10) return 'text-gray-600'
    if (score >= -50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getSentimentBg = (score: number) => {
    if (score >= 50) return 'bg-green-100'
    if (score >= 10) return 'bg-yellow-100'
    if (score >= -10) return 'bg-gray-100'
    if (score >= -50) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const getSentimentLabel = (score: number) => {
    if (score >= 50) return 'Very Bullish'
    if (score >= 10) return 'Bullish'
    if (score >= -10) return 'Neutral'
    if (score >= -50) return 'Bearish'
    return 'Very Bearish'
  }

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const formatChange = (change: number) => {
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}`
  }

  // Sort sectors by sentiment score for better visualization
  const sortedSectors = [...sectorSentiment].sort((a, b) => b.score - a.score)

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Sector Sentiment Analysis</h2>
        <p className="text-sm text-gray-500 mt-1">
          AI-powered sentiment analysis by sector • {timeRange} period
        </p>
      </div>

      <div className="p-6">
        {/* Sector Heatmap */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {sortedSectors.map((sector) => (
            <div
              key={sector.sector}
              className={`rounded-lg p-4 border hover:shadow-md transition-all cursor-pointer ${getSentimentBg(sector.score)} border-gray-200`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{sector.sector}</h3>
                  <p className={`text-sm ${getSentimentColor(sector.score)}`}>
                    {getSentimentLabel(sector.score)}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${getSentimentColor(sector.score)}`}>
                    {sector.score > 0 ? '+' : ''}{sector.score.toFixed(0)}
                  </div>
                  <div className={`text-xs ${getChangeColor(sector.change24h)}`}>
                    {formatChange(sector.change24h)} (24h)
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>News Articles</span>
                  <span className="font-medium">{sector.newsCount}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Social Mentions</span>
                  <span className="font-medium">{sector.socialMentions.toLocaleString()}</span>
                </div>
              </div>

              {/* Key themes */}
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-1">Key Themes:</p>
                <div className="flex flex-wrap gap-1">
                  {sector.keyThemes.slice(0, 3).map((theme) => (
                    <span
                      key={theme}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                    >
                      {theme}
                    </span>
                  ))}
                  {sector.keyThemes.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{sector.keyThemes.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Top stocks */}
              <div>
                <p className="text-xs text-gray-600 mb-1">Top Stocks:</p>
                <div className="flex flex-wrap gap-1">
                  {sector.topStocks.slice(0, 3).map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => onSymbolSelect(stock.symbol)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        stock.score >= 0
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {stock.symbol}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sector
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  24h Change
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  News
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Social
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key Themes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Stocks
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedSectors.map((sector) => (
                <tr key={sector.sector} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-3 ${getSentimentBg(sector.score).replace('bg-', 'bg-').replace('100', '500')}`}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{sector.sector}</div>
                        <div className={`text-xs ${getSentimentColor(sector.score)}`}>
                          {getSentimentLabel(sector.score)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <div className={`text-sm font-bold ${getSentimentColor(sector.score)}`}>
                      {sector.score > 0 ? '+' : ''}{sector.score.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <div className={`text-sm font-medium ${getChangeColor(sector.change24h)}`}>
                      {formatChange(sector.change24h)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-900">{sector.newsCount}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-900">{sector.socialMentions.toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {sector.keyThemes.map((theme) => (
                        <span
                          key={theme}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid grid-cols-1 gap-1">
                      {sector.topStocks.map((stock) => (
                        <div key={stock.symbol} className="flex items-center justify-between">
                          <button
                            onClick={() => onSymbolSelect(stock.symbol)}
                            className={`text-xs font-medium hover:underline ${
                              stock.score >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {stock.symbol}
                          </button>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span className={stock.score >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {stock.score > 0 ? '+' : ''}{stock.score}
                            </span>
                            <span>({stock.mentions})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sentiment Distribution Chart */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sentiment Distribution</h3>

          <div className="space-y-3">
            {['Very Bullish', 'Bullish', 'Neutral', 'Bearish', 'Very Bearish'].map((label) => {
              const count = sortedSectors.filter(sector => getSentimentLabel(sector.score) === label).length
              const percentage = (count / sortedSectors.length) * 100
              const color = label.includes('Bullish') ? 'bg-green-500' :
                           label === 'Neutral' ? 'bg-gray-500' : 'bg-red-500'

              return (
                <div key={label} className="flex items-center space-x-3">
                  <div className="w-20 text-sm text-gray-600">{label}</div>
                  <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-12 text-sm text-gray-900 text-right">
                    {count}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 text-center text-sm text-gray-500">
            Sentiment distribution across {sortedSectors.length} sectors
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {sortedSectors.filter(s => s.score >= 10).length}
              </div>
              <div className="text-sm text-green-800">Bullish Sectors</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {sortedSectors.filter(s => s.score >= -10 && s.score < 10).length}
              </div>
              <div className="text-sm text-gray-800">Neutral Sectors</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {sortedSectors.filter(s => s.score < -10).length}
              </div>
              <div className="text-sm text-red-800">Bearish Sectors</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {sortedSectors.reduce((sum, s) => sum + s.newsCount, 0)}
              </div>
              <div className="text-sm text-blue-800">Total News Articles</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}