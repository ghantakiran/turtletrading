'use client'

import { NewsItem } from '../page'

interface NewsFeedProps {
  news: NewsItem[]
  selectedSymbol: string | null
  onSymbolSelect: (symbol: string | null) => void
  timeRange: '1H' | '4H' | '1D' | '1W' | '1M'
}

export function NewsFeed({ news, selectedSymbol, onSymbolSelect, timeRange }: NewsFeedProps) {
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

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
    }
  }

  const getCategoryColor = (category: NewsItem['category']) => {
    switch (category) {
      case 'earnings': return 'bg-blue-100 text-blue-800'
      case 'economic': return 'bg-purple-100 text-purple-800'
      case 'geopolitical': return 'bg-red-100 text-red-800'
      case 'regulatory': return 'bg-yellow-100 text-yellow-800'
      case 'corporate': return 'bg-green-100 text-green-800'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  const filteredNews = selectedSymbol
    ? news.filter(item => item.symbols.includes(selectedSymbol))
    : news

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">News Feed</h2>
            <p className="text-sm text-gray-500 mt-1">
              {selectedSymbol ? `News for ${selectedSymbol}` : 'All news'} • {timeRange} •
              {filteredNews.length} articles
            </p>
          </div>
          {selectedSymbol && (
            <button
              onClick={() => onSymbolSelect(null)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Show all news
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {filteredNews.map((article) => (
          <article key={article.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start space-x-4">
              {/* Sentiment indicator */}
              <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${getSentimentBg(article.sentimentScore)} flex items-center justify-center`}>
                <div className="text-center">
                  <div className={`text-lg font-bold ${getSentimentColor(article.sentimentScore)}`}>
                    {article.sentimentScore > 0 ? '+' : ''}{article.sentimentScore}
                  </div>
                  <div className="text-xs text-gray-600">Score</div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">{article.source}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-500">{formatTimeAgo(article.publishedAt)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getImpactColor(article.impact)}`}>
                      {article.impact.toUpperCase()} IMPACT
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(article.category)}`}>
                      {article.category.toUpperCase()}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 transition-colors"
                  >
                    {article.title}
                  </a>
                </h3>

                <p className="text-gray-700 text-sm mb-3 leading-relaxed">
                  {article.summary}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Related:</span>
                    <div className="flex flex-wrap gap-1">
                      {article.symbols.map((symbol) => (
                        <button
                          key={symbol}
                          onClick={() => onSymbolSelect(symbol)}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            selectedSymbol === symbol
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getSentimentColor(article.sentimentScore)}`}>
                        {getSentimentLabel(article.sentimentScore)}
                      </div>
                      <div className="text-xs text-gray-500">Sentiment</div>
                    </div>

                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredNews.length === 0 && (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No news articles found</h3>
          <p className="text-gray-500 mb-4">
            {selectedSymbol
              ? `No news articles found for ${selectedSymbol} in the selected time range.`
              : 'No news articles available for the selected time range.'
            }
          </p>
          {selectedSymbol && (
            <button
              onClick={() => onSymbolSelect(null)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Show all news
            </button>
          )}
        </div>
      )}

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>
            Showing {filteredNews.length} of {news.length} articles
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Bullish</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span>Neutral</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Bearish</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}