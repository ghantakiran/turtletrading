'use client'

import { SentimentScore, SentimentIndicators } from '../page'

interface SentimentOverviewProps {
  sentiment: SentimentScore
  indicators: SentimentIndicators
  timeRange: '1H' | '4H' | '1D' | '1W' | '1M'
}

export function SentimentOverview({ sentiment, indicators, timeRange }: SentimentOverviewProps) {
  const getSentimentColor = (score: number) => {
    if (score >= 60) return 'text-green-600'
    if (score >= 20) return 'text-yellow-600'
    if (score >= -20) return 'text-gray-600'
    if (score >= -60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getSentimentBgColor = (score: number) => {
    if (score >= 60) return 'bg-green-100'
    if (score >= 20) return 'bg-yellow-100'
    if (score >= -20) return 'bg-gray-100'
    if (score >= -60) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const getSentimentLabel = (score: number) => {
    if (score >= 60) return 'Very Bullish'
    if (score >= 20) return 'Bullish'
    if (score >= -20) return 'Neutral'
    if (score >= -60) return 'Bearish'
    return 'Very Bearish'
  }

  const formatCurrency = (amount: number) => {
    if (Math.abs(amount) >= 1e9) {
      return `$${(amount / 1e9).toFixed(1)}B`
    }
    if (Math.abs(amount) >= 1e6) {
      return `$${(amount / 1e6).toFixed(1)}M`
    }
    return `$${amount.toLocaleString()}`
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Market Sentiment Overview</h2>
        <p className="text-sm text-gray-500 mt-1">
          AI-powered sentiment analysis for {timeRange} period • Confidence: {(sentiment.confidence * 100).toFixed(0)}%
        </p>
      </div>

      <div className="p-6">
        {/* Overall Sentiment Score */}
        <div className={`rounded-lg p-6 mb-6 ${getSentimentBgColor(sentiment.overall)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Overall Market Sentiment</p>
              <p className={`text-3xl font-bold ${getSentimentColor(sentiment.overall)}`}>
                {getSentimentLabel(sentiment.overall)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Score: {sentiment.overall > 0 ? '+' : ''}{sentiment.overall.toFixed(1)}
              </p>
            </div>
            <div className="text-right">
              <div className="relative w-20 h-20">
                {/* Circular progress indicator */}
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-300"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={getSentimentColor(sentiment.overall)}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${((sentiment.overall + 100) / 200) * 100}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${getSentimentColor(sentiment.overall)}`}>
                    {sentiment.overall.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sentiment Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">News Sentiment</p>
                <p className={`text-xl font-bold ${getSentimentColor(sentiment.news)}`}>
                  {sentiment.news > 0 ? '+' : ''}{sentiment.news.toFixed(1)}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-800">Social Media</p>
                <p className={`text-xl font-bold ${getSentimentColor(sentiment.social)}`}>
                  {sentiment.social > 0 ? '+' : ''}{sentiment.social.toFixed(1)}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Institutional</p>
                <p className={`text-xl font-bold ${getSentimentColor(sentiment.institutional)}`}>
                  {sentiment.institutional > 0 ? '+' : ''}{sentiment.institutional.toFixed(1)}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Key Indicators */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Key Market Indicators</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Fear & Greed Index */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Fear & Greed Index</p>
                  <p className={`text-xl font-bold ${
                    indicators.fearGreedIndex >= 75 ? 'text-red-600' :
                    indicators.fearGreedIndex >= 55 ? 'text-yellow-600' :
                    indicators.fearGreedIndex >= 45 ? 'text-gray-600' :
                    indicators.fearGreedIndex >= 25 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {indicators.fearGreedIndex}
                  </p>
                  <p className="text-xs text-gray-500">
                    {indicators.fearGreedIndex >= 75 ? 'Extreme Greed' :
                     indicators.fearGreedIndex >= 55 ? 'Greed' :
                     indicators.fearGreedIndex >= 45 ? 'Neutral' :
                     indicators.fearGreedIndex >= 25 ? 'Fear' : 'Extreme Fear'}
                  </p>
                </div>
              </div>
            </div>

            {/* Put/Call Ratio */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Put/Call Ratio</p>
                  <p className={`text-xl font-bold ${
                    indicators.putCallRatio >= 1.2 ? 'text-red-600' :
                    indicators.putCallRatio >= 0.8 ? 'text-gray-600' : 'text-green-600'
                  }`}>
                    {indicators.putCallRatio.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {indicators.putCallRatio >= 1.2 ? 'Bearish' :
                     indicators.putCallRatio >= 0.8 ? 'Neutral' : 'Bullish'}
                  </p>
                </div>
              </div>
            </div>

            {/* VIX Sentiment */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">VIX Level</p>
                  <p className={`text-xl font-bold ${
                    indicators.vixSentiment >= 30 ? 'text-red-600' :
                    indicators.vixSentiment >= 20 ? 'text-orange-600' :
                    indicators.vixSentiment >= 15 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {indicators.vixSentiment.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {indicators.vixSentiment >= 30 ? 'High Volatility' :
                     indicators.vixSentiment >= 20 ? 'Elevated' :
                     indicators.vixSentiment >= 15 ? 'Normal' : 'Low Volatility'}
                  </p>
                </div>
              </div>
            </div>

            {/* Insider Activity */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Insider Activity</p>
                  <p className={`text-xl font-bold ${getSentimentColor(indicators.insiderActivity)}`}>
                    {indicators.insiderActivity}
                  </p>
                  <p className="text-xs text-gray-500">Buy/Sell Score</p>
                </div>
              </div>
            </div>

            {/* Institutional Flow */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Institutional Flow</p>
                  <p className={`text-xl font-bold ${
                    indicators.institutionalFlow >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(indicators.institutionalFlow)}
                  </p>
                  <p className="text-xs text-gray-500">Net Flow (24h)</p>
                </div>
              </div>
            </div>

            {/* Retail Sentiment */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Retail Sentiment</p>
                  <p className={`text-xl font-bold ${getSentimentColor(indicators.retailSentiment)}`}>
                    {indicators.retailSentiment}
                  </p>
                  <p className="text-xs text-gray-500">Bullish %</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Last updated: {new Date(sentiment.timestamp).toLocaleString()} •
            <span className="ml-1">Confidence: {(sentiment.confidence * 100).toFixed(0)}%</span>
          </p>
        </div>
      </div>
    </div>
  )
}