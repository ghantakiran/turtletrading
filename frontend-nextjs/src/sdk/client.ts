/**
 * TurtleTrading SDK Client
 * TypeScript/JavaScript client library for TurtleTrading API
 */

import type {
  SDKConfig,
  StockPrice,
  TechnicalIndicators,
  AIPrediction,
  SentimentAnalysis,
  MarketIndices,
  RequestOptions,
  APIError,
} from './types'

export class TurtleTradingClient {
  private config: Required<Omit<SDKConfig, 'retries'>> & { retries?: number }

  constructor(config: SDKConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required')
    }

    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'http://localhost:8000',
      timeout: config.timeout || 30000,
      retries: config.retries,
    }
  }

  /**
   * Stock data methods
   */
  stocks = {
    /**
     * Get current stock price and basic information
     */
    getPrice: async (symbol: string, options?: RequestOptions): Promise<StockPrice> => {
      return this.request<StockPrice>(`/api/v1/stocks/${symbol}/price`, options)
    },

    /**
     * Get technical analysis with indicators
     */
    getTechnical: async (
      symbol: string,
      options?: RequestOptions
    ): Promise<TechnicalIndicators> => {
      return this.request<TechnicalIndicators>(`/api/v1/stocks/${symbol}/technical`, options)
    },
  }

  /**
   * AI prediction methods
   */
  ai = {
    /**
     * Get AI-powered price predictions
     */
    getPredictions: async (
      symbol: string,
      days: number = 30,
      options?: RequestOptions
    ): Promise<AIPrediction> => {
      return this.request<AIPrediction>(`/api/v1/stocks/${symbol}/lstm?days=${days}`, options)
    },
  }

  /**
   * Sentiment analysis methods
   */
  sentiment = {
    /**
     * Get sentiment analysis from news and social media
     */
    getAnalysis: async (
      symbol: string,
      options?: RequestOptions
    ): Promise<SentimentAnalysis> => {
      return this.request<SentimentAnalysis>(`/api/v1/sentiment/${symbol}`, options)
    },
  }

  /**
   * Market data methods
   */
  market = {
    /**
     * Get major market indices
     */
    getIndices: async (options?: RequestOptions): Promise<MarketIndices> => {
      return this.request<MarketIndices>('/api/v1/market/indices', options)
    },
  }

  /**
   * Make HTTP request to API
   */
  private async request<T>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
      ...options?.headers,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: options?.signal || controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
        }))
        throw new Error(error.message || `Request failed with status ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.config.timeout}ms`)
        }
        throw error
      }

      throw new Error('Unknown error occurred')
    }
  }
}

/**
 * Create a new TurtleTrading client instance
 */
export function createClient(config: SDKConfig): TurtleTradingClient {
  return new TurtleTradingClient(config)
}

/**
 * Export types for consumers
 */
export type * from './types'
