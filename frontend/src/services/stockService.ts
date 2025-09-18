import { api } from './api';

// Stock-related types
export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  lastUpdated: string;
}

export interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  symbol: string;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic: {
    k: number;
    d: number;
  };
  adx: number;
  atr: number;
  obv: number;
  score: number; // Weighted technical analysis score
  lastUpdated: string;
}

export interface StockAnalysis {
  symbol: string;
  price: StockPrice;
  technical: TechnicalIndicators;
  lstm?: {
    prediction: number;
    confidence: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  sentiment?: {
    score: number;
    summary: string;
    newsCount: number;
  };
  lastUpdated: string;
}

// Stock API service functions
export const stockService = {
  // Get current stock price
  getStockPrice: (symbol: string): Promise<StockPrice> =>
    api.get<StockPrice>(`/stocks/${symbol}/price`),

  // Get historical stock data
  getHistoricalData: (
    symbol: string,
    period: '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '2y' | '5y' = '1m'
  ): Promise<HistoricalData[]> =>
    api.get<HistoricalData[]>(`/stocks/${symbol}/history`, { period }),

  // Get technical indicators
  getTechnicalIndicators: (symbol: string): Promise<TechnicalIndicators> =>
    api.get<TechnicalIndicators>(`/stocks/${symbol}/technical`),

  // Get comprehensive stock analysis
  getStockAnalysis: (symbol: string): Promise<StockAnalysis> =>
    api.get<StockAnalysis>(`/stocks/${symbol}/analysis`),

  // Search stocks by symbol or company name
  searchStocks: (query: string): Promise<{symbol: string, name: string}[]> =>
    api.get<{symbol: string, name: string}[]>(`/stocks/search`, { q: query }),

  // Get multiple stock prices
  getMultipleStockPrices: (symbols: string[]): Promise<StockPrice[]> =>
    api.get<StockPrice[]>(`/stocks/prices`, { symbols: symbols.join(',') }),
};