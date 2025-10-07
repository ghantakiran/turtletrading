/**
 * TurtleTrading SDK Types
 * TypeScript/JavaScript client library for TurtleTrading API
 */

export interface SDKConfig {
  apiKey: string
  baseURL?: string
  timeout?: number
  retries?: number
}

export interface StockPrice {
  symbol: string
  current_price: number
  previous_close?: number
  change?: number
  change_percent?: number
  timestamp: string
}

export interface TechnicalIndicators {
  symbol: string
  rsi: { value: number; signal: 'overbought' | 'oversold' | 'neutral' }
  macd: { value: number; signal: number; histogram: number }
  bollinger_bands: { upper: number; middle: number; lower: number }
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  score: number
  timestamp: string
}

export interface AIPrediction {
  symbol: string
  current_price: number
  predictions: Array<{ date: string; price: number }>
  confidence_intervals: Array<{ date: string; lower: number; upper: number }>
  model_confidence: number
  horizon_days: number
  timestamp: string
}

export interface SentimentAnalysis {
  symbol: string
  overall_sentiment: 'bullish' | 'bearish' | 'neutral'
  sentiment_score: number
  news_sentiment: number
  social_sentiment: number
  sources: Array<{ source: string; sentiment: number; title: string }>
  timestamp: string
}

export interface MarketIndices {
  sp500: { value: number; change: number; change_percent: number }
  nasdaq: { value: number; change: number; change_percent: number }
  dow: { value: number; change: number; change_percent: number }
  vix: { value: number; change: number; change_percent: number }
  timestamp: string
}

export interface APIError {
  status: number
  message: string
  code?: string
  details?: unknown
}

export interface RequestOptions {
  signal?: AbortSignal
  headers?: Record<string, string>
}
