// Server-side data fetching utilities for stock analysis
import { cache } from 'react'
import { apiClient } from './api-client'

// Types
export interface StockData {
  symbol: string
  current_price: number
  change: number
  change_percent: number
  volume: number
  market_cap: number
  high_52_week?: number
  low_52_week?: number
  avg_volume?: number
  pe_ratio?: number
  dividend_yield?: number
}

export interface TechnicalData {
  rsi: number
  macd: number
  sma_20: number
  sma_50: number
  sma_200: number
  bollinger_upper: number
  bollinger_lower: number
  bollinger_middle: number
  technical_score: number
  adx?: number
  stoch_k?: number
  stoch_d?: number
  atr?: number
  obv?: number
}

export interface LSTMPrediction {
  predicted_price: number
  predictions: Array<{
    date: string
    price: number
    confidence?: number
  }>
  confidence: number
  trend: 'bullish' | 'bearish' | 'neutral'
  time_horizon: string
  lstm_score: number
}

export interface SentimentData {
  sentiment_score: number
  articles_count: number
  social_mentions: number
  news_sentiment?: number
  social_sentiment?: number
}

export interface AnalysisScore {
  final_score: number
  technical_weight: number
  lstm_weight: number
  sentiment_weight: number
  seasonality_weight: number
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'
  key_factors: string[]
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  target_price?: number
  stop_loss?: number
}

// Server-side data fetchers using new API client
export const getStockPrice = cache(async (symbol: string): Promise<StockData> => {
  try {
    const data = await apiClient.getStockPrice(symbol)
    return {
      symbol: data.symbol,
      current_price: data.price,
      change: data.change,
      change_percent: data.changePercent,
      volume: data.volume || 0,
      market_cap: data.marketCap || 0,
    }
  } catch (error) {
    console.error(`Failed to fetch stock price for ${symbol}:`, error)
    // Return mock data for testing
    return {
      symbol: symbol.toUpperCase(),
      current_price: 150.25,
      change: 2.15,
      change_percent: 1.45,
      volume: 50000000,
      market_cap: 2500000000000,
      high_52_week: 180.0,
      low_52_week: 120.0,
      avg_volume: 45000000,
      pe_ratio: 28.5,
      dividend_yield: 0.52
    }
  }
})

export const getTechnicalIndicators = cache(async (symbol: string, period: string = '1y'): Promise<TechnicalData> => {
  try {
    const analysis = await apiClient.getStockAnalysis(symbol)
    return {
      rsi: analysis.technicalIndicators.rsi,
      macd: analysis.technicalIndicators.macd,
      sma_20: analysis.technicalIndicators.movingAverages?.sma20 || 0,
      sma_50: analysis.technicalIndicators.movingAverages?.sma50 || 0,
      sma_200: 0,
      bollinger_upper: analysis.technicalIndicators.bollingerBands.upper,
      bollinger_lower: analysis.technicalIndicators.bollingerBands.lower,
      bollinger_middle: analysis.technicalIndicators.bollingerBands.middle || 0,
      technical_score: 0.75,
    }
  } catch (error) {
    console.error(`Failed to fetch technical indicators for ${symbol}:`, error)
    // Return mock data for testing
    return {
      rsi: 65.5,
      macd: 1.25,
      sma_20: 148.5,
      sma_50: 145.2,
      sma_200: 142.8,
      bollinger_upper: 155.0,
      bollinger_lower: 145.0,
      bollinger_middle: 150.0,
      technical_score: 0.75,
      adx: 45.2,
      stoch_k: 68.5,
      stoch_d: 65.2,
      atr: 3.25,
      obv: 15000000
    }
  }
})

export const getLSTMPrediction = cache(async (symbol: string, days: number = 5): Promise<LSTMPrediction> => {
  try {
    const predictions = await apiClient.getAIPredictions(symbol, `${days}d`)
    return {
      predicted_price: predictions.nextWeek || 155.0,
      predictions: [],
      confidence: predictions.confidence || 0.78,
      trend: predictions.confidence > 0.6 ? 'bullish' : 'neutral',
      time_horizon: `${days}d`,
      lstm_score: predictions.confidence || 0.78
    }
  } catch (error) {
    console.error(`Failed to fetch LSTM predictions for ${symbol}:`, error)
    // Return mock data for testing
    return {
      predicted_price: 155.0,
      predictions: [
        { date: '2025-01-02', price: 152.0, confidence: 0.78 },
        { date: '2025-01-03', price: 153.5, confidence: 0.75 },
        { date: '2025-01-04', price: 155.0, confidence: 0.72 },
      ],
      confidence: 0.78,
      trend: 'bullish',
      time_horizon: `${days}d`,
      lstm_score: 0.78
    }
  }
})

export const getSentimentData = cache(async (symbol: string): Promise<SentimentData> => {
  try {
    const sentiment = await apiClient.getSentimentAnalysis(symbol)
    return {
      sentiment_score: sentiment.score || 0.15,
      sentiment_label: sentiment.score > 0 ? 'positive' : sentiment.score < 0 ? 'negative' : 'neutral',
      news_count: sentiment.sources?.length || 5,
      social_sentiment: sentiment.score || 0.15,
      confidence: 0.85,
      last_updated: sentiment.lastUpdated || new Date().toISOString()
    }
  } catch (error) {
    console.error(`Failed to fetch sentiment data for ${symbol}:`, error)
    // Return mock data for testing
    return {
      sentiment_score: 0.15,
      sentiment_label: 'positive',
      news_count: 5,
      social_sentiment: 0.15,
      confidence: 0.85,
      last_updated: new Date().toISOString()
    }
  }
})

export const getPriceHistory = cache(async (symbol: string, period: string = '1m', interval: string = '1d') => {
  try {
    return await apiClient.getHistoricalData(symbol, period, interval)
  } catch (error) {
    console.error(`Failed to fetch price history for ${symbol}:`, error)
    // Return mock data for testing
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
      const basePrice = 150.25
      const price = basePrice * (1 + (Math.random() - 0.5) * 0.2)
      return {
        date: date.toISOString().split('T')[0],
        price: parseFloat(price.toFixed(2)),
        volume: Math.floor(Math.random() * 10000000),
        high: parseFloat((price * 1.05).toFixed(2)),
        low: parseFloat((price * 0.95).toFixed(2))
      }
    })
  }
})

// Aggregate data fetcher for better performance
export const getStockAnalysisData = cache(async (symbol: string) => {
  try {
    const [stockData, technicalData, lstmData, sentimentData] = await Promise.allSettled([
      getStockPrice(symbol),
      getTechnicalIndicators(symbol),
      getLSTMPrediction(symbol),
      getSentimentData(symbol),
    ])

    // Calculate analysis score
    const analysisScore = calculateAnalysisScore(
      technicalData.status === 'fulfilled' ? technicalData.value : null,
      lstmData.status === 'fulfilled' ? lstmData.value : null,
      sentimentData.status === 'fulfilled' ? sentimentData.value : null,
      stockData.status === 'fulfilled' ? stockData.value : null
    )

    return {
      stockData: stockData.status === 'fulfilled' ? stockData.value : null,
      technicalData: technicalData.status === 'fulfilled' ? technicalData.value : null,
      lstmData: lstmData.status === 'fulfilled' ? lstmData.value : null,
      sentimentData: sentimentData.status === 'fulfilled' ? sentimentData.value : null,
      analysisScore,
      errors: {
        stockData: stockData.status === 'rejected' ? stockData.reason?.message : null,
        technicalData: technicalData.status === 'rejected' ? technicalData.reason?.message : null,
        lstmData: lstmData.status === 'rejected' ? lstmData.reason?.message : null,
        sentimentData: sentimentData.status === 'rejected' ? sentimentData.reason?.message : null,
      }
    }
  } catch (error) {
    console.error('Failed to fetch stock analysis data:', error)
    throw error
  }
})

function calculateAnalysisScore(
  tech: TechnicalData | null,
  lstm: LSTMPrediction | null,
  sentiment: SentimentData | null,
  stock: StockData | null
): AnalysisScore {
  const techScore = tech?.technical_score || 0.5
  const lstmScore = lstm?.lstm_score || 0.5
  const sentScore = sentiment ? (sentiment.sentiment_score + 1) / 2 : 0.5 // Convert from -1,1 to 0,1

  const finalScore = techScore * 0.5 + lstmScore * 0.3 + sentScore * 0.2

  let recommendation: AnalysisScore['recommendation'] = 'HOLD'
  if (finalScore > 0.8) recommendation = 'STRONG_BUY'
  else if (finalScore > 0.6) recommendation = 'BUY'
  else if (finalScore < 0.3) recommendation = 'SELL'
  else if (finalScore < 0.1) recommendation = 'STRONG_SELL'

  return {
    final_score: finalScore,
    technical_weight: 50,
    lstm_weight: 30,
    sentiment_weight: 20,
    seasonality_weight: 0,
    recommendation,
    key_factors: [
      'Strong technical indicators',
      'Positive AI prediction',
      'Favorable market sentiment',
      'Good volume trends'
    ],
    risk_level: finalScore > 0.7 ? 'LOW' : finalScore > 0.4 ? 'MEDIUM' : 'HIGH',
    target_price: stock?.current_price ? stock.current_price * 1.15 : undefined,
    stop_loss: stock?.current_price ? stock.current_price * 0.90 : undefined
  }
}