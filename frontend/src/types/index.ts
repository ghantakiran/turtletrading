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

// Portfolio Backtesting Types
export interface TradingStrategy {
  name: string;
  description: string;
  strategy_type: 'momentum' | 'mean_reversion' | 'trend_following' | 'custom';
  rules: TradingRule[];
  entry_conditions: TradingCondition[];
  exit_conditions: TradingCondition[];
  risk_management: RiskManagement;
  position_sizing: PositionSizing;
}

export interface TradingRule {
  id: string;
  name: string;
  indicator: string;
  condition: 'above' | 'below' | 'cross_above' | 'cross_below' | 'equals';
  value: number;
  weight: number;
}

export interface TradingCondition {
  indicator: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  timeframe?: string;
}

export interface RiskManagement {
  stop_loss_pct?: number;
  take_profit_pct?: number;
  max_position_size: number;
  max_portfolio_risk: number;
  max_daily_trades: number;
  drawdown_limit: number;
}

export interface PositionSizing {
  method: 'fixed' | 'percent_equity' | 'volatility_normalized' | 'kelly_criterion';
  size: number;
  lookback_period?: number;
  risk_free_rate?: number;
  confidence_level?: number;
}

export interface BacktestConfiguration {
  strategy: TradingStrategy;
  universe: string[];
  start_date: string;
  end_date: string;
  initial_capital: number;
  transaction_costs: TransactionCosts;
  slippage_model: SlippageModel;
  benchmark_symbols: string[];
  walk_forward?: WalkForwardConfig;
  rebalancing_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  max_positions: number;
  cash_buffer: number;
}

export interface TransactionCosts {
  per_trade_cost: number;
  percentage_cost: number;
  min_commission: number;
  market_impact_model: 'linear' | 'square_root' | 'none';
  spread_cost_bps: number;
}

export interface SlippageModel {
  model_type: 'linear' | 'square_root' | 'constant';
  slippage_bps: number;
  market_impact_coeff: number;
  temporary_impact_decay: number;
}

export interface WalkForwardConfig {
  training_period_months: number;
  validation_period_months: number;
  step_size_months: number;
  min_training_samples: number;
}

export interface BacktestRequest {
  configuration: BacktestConfiguration;
  save_results: boolean;
  email_report: boolean;
}

export interface BacktestStatus {
  job_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  message: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
  configuration?: BacktestConfiguration;
  result?: BacktestResult;
  error?: string;
}

export interface BacktestResult {
  backtest_id: string;
  configuration: BacktestConfiguration;
  performance_metrics: PerformanceMetrics;
  equity_curve: EquityCurvePoint[];
  trade_log: Trade[];
  risk_metrics: RiskMetrics;
  benchmark_comparison: BenchmarkComparison;
  tearsheet_data: TearsheetData;
  walk_forward_results?: WalkForwardResult[];
  total_runtime_seconds: number;
  warnings: string[];
}

export interface PerformanceMetrics {
  total_return: number;
  annualized_return: number;
  cagr: number;
  volatility: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  max_drawdown_duration: number;
  win_rate: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  largest_win: number;
  largest_loss: number;
  avg_holding_period_days: number;
  turnover_rate: number;
  beta: number;
  alpha: number;
  tracking_error: number;
  information_ratio: number;
  skewness: number;
  kurtosis: number;
  value_at_risk_95: number;
  expected_shortfall_95: number;
}

export interface EquityCurvePoint {
  date: string;
  portfolio_value: number;
  cash: number;
  positions_value: number;
  daily_return: number;
  cumulative_return: number;
  drawdown: number;
  benchmark_value?: number;
  num_positions: number;
}

export interface Trade {
  trade_id: string;
  symbol: string;
  entry_date: string;
  exit_date?: string;
  side: 'long' | 'short';
  quantity: number;
  entry_price: number;
  exit_price?: number;
  entry_signal: string;
  exit_signal?: string;
  pnl: number;
  pnl_percent: number;
  holding_period_days: number;
  transaction_costs: number;
  slippage_costs: number;
  position_size_pct: number;
  is_open: boolean;
}

export interface RiskMetrics {
  var_99: number;
  var_95: number;
  cvar_99: number;
  cvar_95: number;
  maximum_leverage: number;
  avg_leverage: number;
  correlation_to_market: number;
  sector_exposure: Record<string, number>;
  concentration_risk: number;
  tail_ratio: number;
  common_sense_ratio: number;
  stability_of_timeseries: number;
  downside_risk: number;
}

export interface BenchmarkComparison {
  benchmark_symbol: string;
  benchmark_total_return: number;
  benchmark_annualized_return: number;
  benchmark_volatility: number;
  benchmark_sharpe: number;
  benchmark_max_drawdown: number;
  excess_return: number;
  tracking_error: number;
  information_ratio: number;
  up_capture: number;
  down_capture: number;
  correlation: number;
  beta: number;
  alpha: number;
}

export interface TearsheetData {
  monthly_returns: Record<string, Record<string, number>>;
  rolling_performance: RollingPerformancePoint[];
  drawdown_periods: DrawdownPeriod[];
  return_distribution: DistributionStats;
  factor_exposures: Record<string, number>;
  sector_allocation: Record<string, number>;
  top_holdings: Holding[];
  position_concentration: ConcentrationMetrics;
}

export interface RollingPerformancePoint {
  date: string;
  rolling_return_1y: number;
  rolling_volatility_1y: number;
  rolling_sharpe_1y: number;
  rolling_max_dd_1y: number;
}

export interface DrawdownPeriod {
  start_date: string;
  end_date: string;
  recovery_date?: string;
  peak_value: number;
  trough_value: number;
  drawdown_pct: number;
  duration_days: number;
  recovery_days?: number;
}

export interface DistributionStats {
  mean: number;
  std: number;
  skewness: number;
  kurtosis: number;
  percentiles: Record<string, number>;
  var_95: number;
  var_99: number;
}

export interface Holding {
  symbol: string;
  weight: number;
  value: number;
  shares: number;
  avg_price: number;
  unrealized_pnl: number;
  sector?: string;
}

export interface ConcentrationMetrics {
  herfindahl_index: number;
  top_5_concentration: number;
  top_10_concentration: number;
  effective_positions: number;
}

export interface WalkForwardResult {
  period_id: string;
  training_start: string;
  training_end: string;
  validation_start: string;
  validation_end: string;
  in_sample_metrics: PerformanceMetrics;
  out_of_sample_metrics: PerformanceMetrics;
  strategy_parameters: Record<string, any>;
  optimization_score: number;
}

// Backtesting Form Types
export interface BacktestFormData {
  strategy: TradingStrategy;
  universe: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  transactionCosts: TransactionCosts;
  slippageModel: SlippageModel;
  benchmarkSymbols: string[];
  walkForward?: WalkForwardConfig;
  rebalancingFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  maxPositions: number;
  cashBuffer: number;
}