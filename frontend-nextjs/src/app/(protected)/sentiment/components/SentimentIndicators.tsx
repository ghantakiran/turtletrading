'use client'

import { SentimentIndicators, SentimentScore } from '../page'

interface SentimentIndicatorsProps {
  indicators: SentimentIndicators
  overallSentiment: SentimentScore
  timeRange: '1H' | '4H' | '1D' | '1W' | '1M'
}

export function SentimentIndicators({ indicators, overallSentiment, timeRange }: SentimentIndicatorsProps) {
  const formatCurrency = (amount: number) => {
    if (Math.abs(amount) >= 1e9) {
      return `$${(amount / 1e9).toFixed(1)}B`
    }
    if (Math.abs(amount) >= 1e6) {
      return `$${(amount / 1e6).toFixed(1)}M`
    }
    return `$${amount.toLocaleString()}`
  }

  const getIndicatorColor = (value: number, type: 'fearGreed' | 'putCall' | 'vix' | 'general') => {
    switch (type) {
      case 'fearGreed':
        if (value >= 75) return 'text-red-600'
        if (value >= 55) return 'text-yellow-600'
        if (value >= 45) return 'text-gray-600'
        if (value >= 25) return 'text-orange-600'
        return 'text-green-600'
      case 'putCall':
        if (value >= 1.2) return 'text-red-600'
        if (value >= 0.8) return 'text-gray-600'
        return 'text-green-600'
      case 'vix':
        if (value >= 30) return 'text-red-600'
        if (value >= 20) return 'text-orange-600'
        if (value >= 15) return 'text-yellow-600'
        return 'text-green-600'
      case 'general':
        if (value >= 60) return 'text-green-600'
        if (value >= 20) return 'text-yellow-600'
        if (value >= -20) return 'text-gray-600'
        if (value >= -60) return 'text-orange-600'
        return 'text-red-600'
    }
  }

  const getIndicatorBg = (value: number, type: 'fearGreed' | 'putCall' | 'vix' | 'general') => {
    switch (type) {
      case 'fearGreed':
        if (value >= 75) return 'bg-red-50 border-red-200'
        if (value >= 55) return 'bg-yellow-50 border-yellow-200'
        if (value >= 45) return 'bg-gray-50 border-gray-200'
        if (value >= 25) return 'bg-orange-50 border-orange-200'
        return 'bg-green-50 border-green-200'
      case 'putCall':
        if (value >= 1.2) return 'bg-red-50 border-red-200'
        if (value >= 0.8) return 'bg-gray-50 border-gray-200'
        return 'bg-green-50 border-green-200'
      case 'vix':
        if (value >= 30) return 'bg-red-50 border-red-200'
        if (value >= 20) return 'bg-orange-50 border-orange-200'
        if (value >= 15) return 'bg-yellow-50 border-yellow-200'
        return 'bg-green-50 border-green-200'
      case 'general':
        if (value >= 60) return 'bg-green-50 border-green-200'
        if (value >= 20) return 'bg-yellow-50 border-yellow-200'
        if (value >= -20) return 'bg-gray-50 border-gray-200'
        if (value >= -60) return 'bg-orange-50 border-orange-200'
        return 'bg-red-50 border-red-200'
    }
  }

  const getProgressWidth = (value: number, min: number, max: number) => {
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  }

  return (
    <div className="space-y-6">
      {/* Fear & Greed Index */}
      <div className={`rounded-lg border p-6 ${getIndicatorBg(indicators.fearGreedIndex, 'fearGreed')}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Fear & Greed Index</h3>
            <p className="text-sm text-gray-600">Market sentiment based on multiple indicators</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getIndicatorColor(indicators.fearGreedIndex, 'fearGreed')}`}>
              {indicators.fearGreedIndex}
            </div>
            <div className="text-sm text-gray-600">
              {indicators.fearGreedIndex >= 75 ? 'Extreme Greed' :
               indicators.fearGreedIndex >= 55 ? 'Greed' :
               indicators.fearGreedIndex >= 45 ? 'Neutral' :
               indicators.fearGreedIndex >= 25 ? 'Fear' : 'Extreme Fear'}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                indicators.fearGreedIndex >= 75 ? 'bg-red-500' :
                indicators.fearGreedIndex >= 55 ? 'bg-yellow-500' :
                indicators.fearGreedIndex >= 45 ? 'bg-gray-500' :
                indicators.fearGreedIndex >= 25 ? 'bg-orange-500' : 'bg-green-500'
              }`}
              style={{ width: `${indicators.fearGreedIndex}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Extreme Fear (0)</span>
            <span>Neutral (50)</span>
            <span>Extreme Greed (100)</span>
          </div>
        </div>
      </div>

      {/* Put/Call Ratio & VIX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-lg border p-6 ${getIndicatorBg(indicators.putCallRatio, 'putCall')}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Put/Call Ratio</h3>
              <p className="text-sm text-gray-600">Options market sentiment</p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getIndicatorColor(indicators.putCallRatio, 'putCall')}`}>
                {indicators.putCallRatio.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  indicators.putCallRatio >= 1.2 ? 'bg-red-500' :
                  indicators.putCallRatio >= 0.8 ? 'bg-gray-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, (indicators.putCallRatio / 2) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Bullish (0.5)</span>
              <span>Neutral (1.0)</span>
              <span>Bearish (1.5+)</span>
            </div>
          </div>
        </div>

        <div className={`rounded-lg border p-6 ${getIndicatorBg(indicators.vixSentiment, 'vix')}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">VIX Level</h3>
              <p className="text-sm text-gray-600">Market volatility index</p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getIndicatorColor(indicators.vixSentiment, 'vix')}`}>
                {indicators.vixSentiment.toFixed(1)}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  indicators.vixSentiment >= 30 ? 'bg-red-500' :
                  indicators.vixSentiment >= 20 ? 'bg-orange-500' :
                  indicators.vixSentiment >= 15 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, (indicators.vixSentiment / 50) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Low (10)</span>
              <span>Normal (20)</span>
              <span>High (30+)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional & Retail Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-lg border p-6 ${getIndicatorBg(indicators.insiderActivity, 'general')}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Insider Activity</h3>
              <p className="text-sm text-gray-600">Corporate insider trading sentiment</p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getIndicatorColor(indicators.insiderActivity, 'general')}`}>
                {indicators.insiderActivity}
              </div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Insider Buying</span>
              <span className={`font-medium ${indicators.insiderActivity > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                {indicators.insiderActivity > 0 ? 'Increased' : 'Normal'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Signal Strength</span>
              <span className="font-medium text-gray-900">
                {Math.abs(indicators.insiderActivity) < 20 ? 'Weak' :
                 Math.abs(indicators.insiderActivity) < 50 ? 'Moderate' : 'Strong'}
              </span>
            </div>
          </div>
        </div>

        <div className={`rounded-lg border p-6 ${getIndicatorBg(indicators.retailSentiment, 'general')}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Retail Sentiment</h3>
              <p className="text-sm text-gray-600">Individual investor sentiment</p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getIndicatorColor(indicators.retailSentiment, 'general')}`}>
                {indicators.retailSentiment}%
              </div>
              <div className="text-sm text-gray-600">Bullish</div>
            </div>
          </div>

          <div className="relative">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getIndicatorColor(indicators.retailSentiment, 'general').replace('text-', 'bg-').replace('600', '500')}`}
                style={{ width: `${indicators.retailSentiment}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Bearish (0%)</span>
              <span>Neutral (50%)</span>
              <span>Bullish (100%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Flow */}
      <div className={`rounded-lg border p-6 ${
        indicators.institutionalFlow >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Institutional Money Flow</h3>
            <p className="text-sm text-gray-600">Net institutional buying/selling activity • {timeRange}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              indicators.institutionalFlow >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(indicators.institutionalFlow)}
            </div>
            <div className="text-sm text-gray-600">Net Flow</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {indicators.institutionalFlow > 0 ? '+' : ''}{formatCurrency(indicators.institutionalFlow)}
            </div>
            <div className="text-xs text-gray-600">Total Flow</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-semibold ${
              indicators.institutionalFlow >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {indicators.institutionalFlow >= 0 ? 'Inflow' : 'Outflow'}
            </div>
            <div className="text-xs text-gray-600">Direction</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {Math.abs(indicators.institutionalFlow) > 1e9 ? 'High' :
               Math.abs(indicators.institutionalFlow) > 5e8 ? 'Medium' : 'Low'}
            </div>
            <div className="text-xs text-gray-600">Volume</div>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getIndicatorColor(overallSentiment.overall, 'general')}`}>
              {overallSentiment.overall > 0 ? '+' : ''}{overallSentiment.overall.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Overall Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {(overallSentiment.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Confidence</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getIndicatorColor(overallSentiment.overall, 'general')}`}>
              {overallSentiment.overall >= 60 ? 'Very Bullish' :
               overallSentiment.overall >= 20 ? 'Bullish' :
               overallSentiment.overall >= -20 ? 'Neutral' :
               overallSentiment.overall >= -60 ? 'Bearish' : 'Very Bearish'}
            </div>
            <div className="text-sm text-gray-600">Signal</div>
          </div>
        </div>
      </div>
    </div>
  )
}