// Core API types matching backend schemas

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  role: 'user' | 'premium' | 'admin';
  created_at: string;
  last_login?: string;
  subscription_tier: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Stock data types
export interface StockPrice {
  symbol: string;
  current_price: number;
  previous_close: number;
  change: number;
  change_percent: number;
  day_high: number;
  day_low: number;
  volume: number;
  market_cap?: number;
  timestamp: string;
}

export interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'Buy' | 'Sell' | 'Hold';
  description?: string;
}

export interface TechnicalIndicators {
  symbol: string;
  timestamp: string;
  rsi: TechnicalIndicator;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'Bullish' | 'Bearish';
  };
  stochastic: {
    k: number;
    d: number;
    signal: string;
  };
  ema_20: number;
  sma_50: number;
  sma_200: number;
  bollinger_bands: {
    upper: number;
    middle: number;
    lower: number;
    width: number;
    position: 'Above' | 'Below';
  };
  atr: number;
  obv: number;
  volume_sma: number;
  adx: number;
  adx_di_plus: number;
  adx_di_minus: number;
  technical_score: number;
  recommendation: string;
}

export interface LSTMPrediction {
  symbol: string;
  current_price: number;
  predictions: number[];
  prediction_dates: string[];
  confidence_intervals: Array<{
    lower: number;
    upper: number;
    confidence: number;
  }>;
  model_accuracy: number;
  mae: number;
  mse: number;
  predicted_return_5d: number;
  lstm_signal: number;
  trend_direction: 'Bullish' | 'Bearish';
  timestamp: string;
}

export interface SentimentAnalysis {
  symbol: string;
  timeframe: string;
  timestamp: string;
  overall_sentiment: number;
  sentiment_polarity: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  confidence: number;
  sentiment_trend: Array<{
    date: string;
    sentiment_score: number;
    article_count: number;
    volume_weighted_sentiment: number;
  }>;
  total_articles: number;
  positive_articles: number;
  negative_articles: number;
  neutral_articles: number;
  sentiment_momentum: number;
  volatility: number;
  recent_articles: NewsArticle[];
  positive_themes: string[];
  negative_themes: string[];
}

export interface NewsArticle {
  title: string;
  summary?: string;
  content?: string;
  url: string;
  source: {
    name: string;
    url?: string;
    reliability_score: number;
  };
  published_at: string;
  sentiment_score: number;
  sentiment_polarity: string;
  confidence: number;
  relevance_score: number;
  mentions: string[];
}

export interface StockAnalysis {
  symbol: string;
  timestamp: string;
  price: StockPrice;
  technical_indicators?: TechnicalIndicators;
  lstm_prediction?: LSTMPrediction;
  sentiment_analysis?: SentimentAnalysis;
  analysis_score: number;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  confidence_level: number;
  key_factors: string[];
  warnings: string[];
}

// Market data types
export interface IndexData {
  symbol: string;
  name: string;
  current_value: number;
  change: number;
  change_percent: number;
  volume?: number;
  timestamp: string;
}

export interface MarketIndices {
  sp500: IndexData;
  nasdaq: IndexData;
  dow_jones: IndexData;
  russell2000: IndexData;
  vix: IndexData;
  timestamp: string;
}

export interface TopMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  market_cap?: number;
}

export interface TopMovers {
  gainers: TopMover[];
  losers: TopMover[];
  most_active: TopMover[];
  timestamp: string;
}

export interface MarketOverview {
  timestamp: string;
  trading_session: {
    market_status: 'open' | 'closed' | 'pre_market' | 'after_hours' | 'holiday';
    next_open?: string;
    next_close?: string;
    is_trading_day: boolean;
  };
  indices: MarketIndices;
  top_movers: TopMovers;
  market_sentiment: number;
  fear_greed_index?: number;
  volatility_level: string;
  advancing_stocks: number;
  declining_stocks: number;
  unchanged_stocks: number;
  new_highs: number;
  new_lows: number;
}

// Chart data types
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  volume?: number;
}

export interface PriceChartData {
  symbol: string;
  data: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

// WebSocket types
export interface WebSocketMessage {
  type: string;
  symbol?: string;
  data?: any;
  timestamp: string;
}

export interface MarketUpdate extends WebSocketMessage {
  type: 'market_update';
  symbol: string;
  data: {
    price: number;
    change: number;
    change_percent: number;
    volume: number;
  };
}

export interface SentimentUpdate extends WebSocketMessage {
  type: 'sentiment_update';
  symbol: string;
  sentiment: {
    score: number;
    polarity: string;
    change: number;
  };
}

// UI state types
export interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  systemTheme: 'light' | 'dark';
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: string | number;
  children?: NavigationItem[];
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  terms: boolean;
}

export interface SearchSymbolForm {
  symbol: string;
}

// API response types
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  status: number;
}

export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Error types
export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, any>;
}

// Watchlist types
export interface WatchlistItem {
  id: number;
  symbol: string;
  added_at: string;
  notes?: string;
  current_price?: number;
  change_percent?: number;
}

export interface Watchlist {
  id: number;
  name: string;
  description?: string;
  is_default: boolean;
  items: WatchlistItem[];
  created_at: string;
  updated_at: string;
}

// Settings types
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  default_watchlist: string[];
  notifications: {
    email: boolean;
    push: boolean;
    price_alerts: boolean;
    sentiment_alerts: boolean;
    news_alerts: boolean;
  };
  dashboard_layout: Record<string, any>;
  timezone: string;
  language: string;
}

export interface AlertRule {
  id: number;
  symbol: string;
  alert_type: 'price' | 'sentiment' | 'technical';
  condition_type: 'above' | 'below' | 'crosses';
  threshold_value: number;
  is_active: boolean;
  created_at: string;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg';
  centered?: boolean;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Chart configuration types
export interface ChartConfig {
  type: 'line' | 'candlestick' | 'bar' | 'area';
  height: number;
  theme: 'light' | 'dark';
  indicators: string[];
  timeframe: string;
}

// Performance monitoring types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

// Feature flags
export interface FeatureFlags {
  lstm_predictions: boolean;
  sentiment_analysis: boolean;
  portfolio_tracking: boolean;
  advanced_charts: boolean;
  real_time_data: boolean;
  mobile_app: boolean;
}