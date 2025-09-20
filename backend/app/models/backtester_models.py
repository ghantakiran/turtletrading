"""
Portfolio Backtester models and data contracts.
Comprehensive data structures for strategy backtesting, walk-forward optimization, and performance analysis.
"""

from datetime import date, datetime
from typing import Dict, List, Optional, Literal, Union, Any
from pydantic import BaseModel, Field, validator
from enum import Enum
from decimal import Decimal


class PositionSizingMethod(str, Enum):
    """Position sizing methodologies."""
    EQUAL_WEIGHT = "equal_weight"
    VOLATILITY_NORMALIZED = "volatility_normalized"
    KELLY_CRITERION = "kelly_criterion"
    FIXED_DOLLAR = "fixed_dollar"
    RISK_PARITY = "risk_parity"


class RebalanceFrequency(str, Enum):
    """Portfolio rebalancing frequency."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"


class BenchmarkType(str, Enum):
    """Benchmark comparison types."""
    SPY = "SPY"
    QQQ = "QQQ"
    IWM = "IWM"
    CUSTOM = "custom"


class RiskFreeRateSource(str, Enum):
    """Risk-free rate data sources."""
    FRED_3M_TREASURY = "fred_3m_treasury"
    FRED_10Y_TREASURY = "fred_10y_treasury"
    FIXED_RATE = "fixed_rate"


class SignalRule(BaseModel):
    """Individual trading signal rule definition."""
    name: str = Field(..., description="Human-readable rule name")
    indicator: str = Field(..., description="Technical indicator (RSI, MACD, SMA, etc.)")
    operator: Literal["gt", "lt", "gte", "lte", "crossover", "crossunder"] = Field(
        ..., description="Comparison operator"
    )
    threshold: float = Field(..., description="Signal threshold value")
    weight: float = Field(1.0, ge=0, le=1, description="Rule weight in composite signal")
    lookback_days: int = Field(20, ge=1, le=252, description="Historical lookback period")

    @validator('indicator')
    def validate_indicator(cls, v):
        valid_indicators = [
            'RSI', 'MACD', 'SMA', 'EMA', 'BB_UPPER', 'BB_LOWER', 'ADX', 'OBV',
            'STOCH_K', 'STOCH_D', 'ATR', 'CCI', 'MFI', 'WILLIAMS_R', 'MOMENTUM'
        ]
        if v not in valid_indicators:
            raise ValueError(f'Indicator must be one of: {valid_indicators}')
        return v


class TradingStrategy(BaseModel):
    """Complete trading strategy definition."""
    name: str = Field(..., description="Strategy name")
    description: Optional[str] = Field(None, description="Strategy description")

    # Entry and exit rules
    entry_rules: List[SignalRule] = Field(..., min_items=1, description="Entry signal rules")
    exit_rules: List[SignalRule] = Field(..., min_items=1, description="Exit signal rules")

    # Strategy parameters
    position_sizing: PositionSizingMethod = Field(
        PositionSizingMethod.EQUAL_WEIGHT, description="Position sizing method"
    )
    max_position_size: float = Field(0.1, ge=0.01, le=1.0, description="Maximum position size (% of portfolio)")
    rebalance_frequency: RebalanceFrequency = Field(
        RebalanceFrequency.MONTHLY, description="Portfolio rebalancing frequency"
    )

    # Risk management
    stop_loss_pct: Optional[float] = Field(None, ge=0, le=0.5, description="Stop-loss percentage")
    take_profit_pct: Optional[float] = Field(None, ge=0, le=2.0, description="Take-profit percentage")
    max_positions: int = Field(10, ge=1, le=100, description="Maximum number of concurrent positions")

    # Trading constraints
    min_holding_days: int = Field(1, ge=1, le=30, description="Minimum holding period in days")
    sector_max_weight: Optional[float] = Field(None, ge=0, le=1, description="Maximum weight per sector")

    # Signal combination
    entry_signal_threshold: float = Field(0.5, ge=0, le=1, description="Composite entry signal threshold")
    exit_signal_threshold: float = Field(0.5, ge=0, le=1, description="Composite exit signal threshold")


class TransactionCosts(BaseModel):
    """Transaction cost model parameters."""
    commission_per_trade: float = Field(0.0, ge=0, description="Fixed commission per trade")
    commission_pct: float = Field(0.001, ge=0, le=0.1, description="Commission as percentage of trade value")
    slippage_bps: float = Field(5.0, ge=0, le=100, description="Slippage in basis points")
    bid_ask_spread_bps: float = Field(10.0, ge=0, le=200, description="Bid-ask spread in basis points")
    market_impact_coeff: float = Field(0.1, ge=0, le=1, description="Market impact coefficient")


class BacktestConfiguration(BaseModel):
    """Complete backtesting configuration."""
    strategy: TradingStrategy = Field(..., description="Trading strategy definition")
    universe: List[str] = Field(..., min_items=1, max_items=1000, description="Stock universe")
    start_date: date = Field(..., description="Backtest start date")
    end_date: date = Field(..., description="Backtest end date")
    initial_capital: float = Field(100000.0, gt=0, description="Initial portfolio capital")

    # Walk-forward optimization
    enable_walk_forward: bool = Field(False, description="Enable walk-forward optimization")
    training_window_days: int = Field(252, ge=60, le=1260, description="Training window in days")
    test_window_days: int = Field(63, ge=20, le=252, description="Test window in days")
    step_size_days: int = Field(21, ge=1, le=126, description="Walk-forward step size in days")

    # Cost and risk models
    transaction_costs: TransactionCosts = Field(default_factory=TransactionCosts)
    benchmark: BenchmarkType = Field(BenchmarkType.SPY, description="Benchmark for comparison")
    risk_free_rate_source: RiskFreeRateSource = Field(
        RiskFreeRateSource.FRED_3M_TREASURY, description="Risk-free rate source"
    )
    fixed_risk_free_rate: Optional[float] = Field(None, ge=0, le=0.2, description="Fixed risk-free rate")

    @validator('end_date')
    def end_date_after_start_date(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('End date must be after start date')
        return v

    @validator('universe')
    def validate_symbols(cls, v):
        for symbol in v:
            if not symbol.isalpha() or len(symbol) > 5:
                raise ValueError(f'Invalid symbol format: {symbol}')
        return v


class Trade(BaseModel):
    """Individual trade record."""
    trade_id: str = Field(..., description="Unique trade identifier")
    symbol: str = Field(..., description="Stock symbol")
    action: Literal["BUY", "SELL"] = Field(..., description="Trade action")
    quantity: int = Field(..., gt=0, description="Number of shares")
    price: float = Field(..., gt=0, description="Execution price per share")
    timestamp: datetime = Field(..., description="Execution timestamp")

    # Trade costs
    commission: float = Field(0.0, ge=0, description="Commission paid")
    slippage: float = Field(0.0, ge=0, description="Slippage cost")
    market_impact: float = Field(0.0, ge=0, description="Market impact cost")

    # Trade context
    signal_strength: float = Field(..., ge=0, le=1, description="Signal strength at execution")
    portfolio_weight: float = Field(..., ge=0, le=1, description="Position weight in portfolio")
    sector: Optional[str] = Field(None, description="Stock sector")

    # P&L (set on trade close)
    pnl: Optional[float] = Field(None, description="Realized P&L")
    holding_days: Optional[int] = Field(None, ge=0, description="Days held")
    return_pct: Optional[float] = Field(None, description="Return percentage")


class Position(BaseModel):
    """Portfolio position at a point in time."""
    symbol: str = Field(..., description="Stock symbol")
    quantity: int = Field(..., description="Number of shares (negative for short)")
    entry_price: float = Field(..., gt=0, description="Average entry price")
    current_price: float = Field(..., gt=0, description="Current market price")
    entry_date: date = Field(..., description="Position entry date")

    # Position metrics
    market_value: float = Field(..., description="Current market value")
    unrealized_pnl: float = Field(..., description="Unrealized P&L")
    unrealized_pnl_pct: float = Field(..., description="Unrealized P&L percentage")
    portfolio_weight: float = Field(..., ge=0, le=1, description="Weight in portfolio")

    # Risk metrics
    volatility: Optional[float] = Field(None, ge=0, description="Position volatility")
    beta: Optional[float] = Field(None, description="Beta to benchmark")
    sector: Optional[str] = Field(None, description="Stock sector")


class PortfolioSnapshot(BaseModel):
    """Portfolio state at a specific date."""
    date: date = Field(..., description="Snapshot date")
    total_value: float = Field(..., gt=0, description="Total portfolio value")
    cash: float = Field(..., ge=0, description="Cash position")
    positions: List[Position] = Field(default_factory=list, description="Current positions")

    # Daily metrics
    daily_return: float = Field(0.0, description="Daily return")
    daily_return_pct: float = Field(0.0, description="Daily return percentage")
    benchmark_return_pct: float = Field(0.0, description="Benchmark daily return")

    # Portfolio composition
    num_positions: int = Field(0, ge=0, description="Number of positions")
    gross_exposure: float = Field(0.0, ge=0, description="Gross exposure")
    net_exposure: float = Field(0.0, description="Net exposure")
    leverage: float = Field(0.0, ge=0, description="Portfolio leverage")


class PerformanceMetrics(BaseModel):
    """Comprehensive performance metrics."""
    # Return metrics
    total_return: float = Field(..., description="Total return")
    total_return_pct: float = Field(..., description="Total return percentage")
    annualized_return: float = Field(..., description="Annualized return")
    cagr: float = Field(..., description="Compound Annual Growth Rate")

    # Risk metrics
    volatility: float = Field(..., ge=0, description="Annualized volatility")
    sharpe_ratio: float = Field(..., description="Sharpe ratio")
    sortino_ratio: float = Field(..., description="Sortino ratio")
    calmar_ratio: float = Field(..., description="Calmar ratio")

    # Drawdown metrics
    max_drawdown: float = Field(..., le=0, description="Maximum drawdown")
    max_drawdown_duration: int = Field(..., ge=0, description="Max drawdown duration in days")
    current_drawdown: float = Field(..., le=0, description="Current drawdown")

    # Distribution metrics
    skewness: float = Field(..., description="Return skewness")
    kurtosis: float = Field(..., description="Return kurtosis")
    var_95: float = Field(..., description="Value at Risk (95%)")
    cvar_95: float = Field(..., description="Conditional Value at Risk (95%)")

    # Benchmark comparison
    benchmark_return: float = Field(..., description="Benchmark total return")
    alpha: float = Field(..., description="Alpha vs benchmark")
    beta: float = Field(..., description="Beta vs benchmark")
    information_ratio: float = Field(..., description="Information ratio")
    tracking_error: float = Field(..., ge=0, description="Tracking error")

    # Trade statistics
    total_trades: int = Field(..., ge=0, description="Total number of trades")
    winning_trades: int = Field(..., ge=0, description="Number of winning trades")
    losing_trades: int = Field(..., ge=0, description="Number of losing trades")
    win_rate: float = Field(..., ge=0, le=1, description="Win rate")
    avg_win: float = Field(..., description="Average winning trade")
    avg_loss: float = Field(..., description="Average losing trade")
    profit_factor: float = Field(..., description="Profit factor")

    # Risk metrics
    max_leverage: float = Field(..., ge=0, description="Maximum leverage used")
    avg_leverage: float = Field(..., ge=0, description="Average leverage")

    # Time-based metrics
    start_date: date = Field(..., description="Backtest start date")
    end_date: date = Field(..., description="Backtest end date")
    trading_days: int = Field(..., gt=0, description="Number of trading days")


class WalkForwardResult(BaseModel):
    """Walk-forward optimization result for a single window."""
    train_start: date = Field(..., description="Training period start date")
    train_end: date = Field(..., description="Training period end date")
    test_start: date = Field(..., description="Test period start date")
    test_end: date = Field(..., description="Test period end date")

    # Training metrics
    train_metrics: PerformanceMetrics = Field(..., description="Training period performance")

    # Test (out-of-sample) metrics
    test_metrics: PerformanceMetrics = Field(..., description="Test period performance")

    # Strategy parameters (if optimized)
    optimized_parameters: Optional[Dict[str, Any]] = Field(
        None, description="Optimized strategy parameters"
    )

    # Validation metrics
    overfitting_score: float = Field(..., description="Overfitting detection score")
    stability_score: float = Field(..., ge=0, le=1, description="Strategy stability score")


class BacktestResult(BaseModel):
    """Complete backtesting result."""
    backtest_id: str = Field(..., description="Unique backtest identifier")
    configuration: BacktestConfiguration = Field(..., description="Backtest configuration")

    # Core results
    performance_metrics: PerformanceMetrics = Field(..., description="Overall performance metrics")
    equity_curve: List[PortfolioSnapshot] = Field(..., description="Daily portfolio snapshots")
    trade_log: List[Trade] = Field(..., description="Complete trade log")

    # Walk-forward results (if enabled)
    walk_forward_results: Optional[List[WalkForwardResult]] = Field(
        None, description="Walk-forward optimization results"
    )

    # Risk analysis
    monthly_returns: List[float] = Field(..., description="Monthly return series")
    rolling_sharpe: List[float] = Field(..., description="Rolling Sharpe ratio")
    rolling_volatility: List[float] = Field(..., description="Rolling volatility")

    # Attribution analysis
    sector_performance: Dict[str, float] = Field(
        default_factory=dict, description="Performance by sector"
    )
    top_winners: List[Trade] = Field(..., description="Top winning trades")
    top_losers: List[Trade] = Field(..., description="Top losing trades")

    # Execution details
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Result creation timestamp")
    execution_time_seconds: float = Field(..., gt=0, description="Backtest execution time")
    data_quality_score: float = Field(..., ge=0, le=1, description="Data quality assessment")

    # Metadata
    total_data_points: int = Field(..., gt=0, description="Total data points processed")
    cache_hit_rate: float = Field(..., ge=0, le=1, description="Data cache hit rate")


class BacktestRequest(BaseModel):
    """API request for running a backtest."""
    configuration: BacktestConfiguration = Field(..., description="Backtest configuration")
    save_result: bool = Field(True, description="Save result to database")
    send_email_report: bool = Field(False, description="Send email report on completion")

    # Advanced options
    enable_parallel_processing: bool = Field(True, description="Enable parallel data processing")
    data_validation_level: Literal["basic", "standard", "strict"] = Field(
        "standard", description="Data validation strictness"
    )
    include_debug_info: bool = Field(False, description="Include debug information in result")


class BacktestStatus(BaseModel):
    """Backtest execution status."""
    backtest_id: str = Field(..., description="Backtest identifier")
    status: Literal["queued", "running", "completed", "failed", "cancelled"] = Field(
        ..., description="Execution status"
    )
    progress_pct: float = Field(0.0, ge=0, le=100, description="Completion percentage")
    current_step: str = Field("", description="Current processing step")
    estimated_remaining_seconds: Optional[int] = Field(None, description="Estimated time remaining")

    # Status details
    started_at: Optional[datetime] = Field(None, description="Execution start time")
    completed_at: Optional[datetime] = Field(None, description="Execution completion time")
    error_message: Optional[str] = Field(None, description="Error message if failed")

    # Progress details
    processed_symbols: int = Field(0, ge=0, description="Number of symbols processed")
    total_symbols: int = Field(0, gt=0, description="Total symbols to process")
    processed_days: int = Field(0, ge=0, description="Number of days processed")
    total_days: int = Field(0, gt=0, description="Total days to process")


class BacktestSummary(BaseModel):
    """Lightweight backtest summary for list views."""
    backtest_id: str = Field(..., description="Backtest identifier")
    strategy_name: str = Field(..., description="Strategy name")
    universe_size: int = Field(..., gt=0, description="Number of symbols in universe")
    date_range: str = Field(..., description="Date range (e.g., '2020-01-01 to 2023-12-31')")

    # Key metrics
    total_return_pct: float = Field(..., description="Total return percentage")
    sharpe_ratio: float = Field(..., description="Sharpe ratio")
    max_drawdown: float = Field(..., le=0, description="Maximum drawdown")

    # Execution details
    created_at: datetime = Field(..., description="Creation timestamp")
    execution_time_seconds: float = Field(..., gt=0, description="Execution time")
    status: Literal["completed", "failed"] = Field(..., description="Final status")


class StrategyOptimizationRequest(BaseModel):
    """Request for strategy parameter optimization."""
    base_strategy: TradingStrategy = Field(..., description="Base strategy to optimize")
    optimization_parameters: Dict[str, Dict[str, Any]] = Field(
        ..., description="Parameters to optimize with ranges"
    )

    # Optimization settings
    optimization_metric: Literal["sharpe_ratio", "total_return", "calmar_ratio"] = Field(
        "sharpe_ratio", description="Metric to optimize"
    )
    max_iterations: int = Field(100, ge=10, le=1000, description="Maximum optimization iterations")
    population_size: int = Field(50, ge=10, le=200, description="Genetic algorithm population size")

    # Validation
    walk_forward_validation: bool = Field(True, description="Use walk-forward validation")
    min_trade_count: int = Field(50, ge=10, description="Minimum trades required for valid result")


class BacktestError(BaseModel):
    """Error response for backtesting operations."""
    error_code: str = Field(..., description="Error code")
    error_message: str = Field(..., description="Human-readable error message")
    backtest_id: Optional[str] = Field(None, description="Associated backtest ID")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")
    retry_after_seconds: Optional[int] = Field(None, description="Suggested retry delay")


# Export all models for easy importing
__all__ = [
    'PositionSizingMethod', 'RebalanceFrequency', 'BenchmarkType', 'RiskFreeRateSource',
    'SignalRule', 'TradingStrategy', 'TransactionCosts', 'BacktestConfiguration',
    'Trade', 'Position', 'PortfolioSnapshot', 'PerformanceMetrics',
    'WalkForwardResult', 'BacktestResult', 'BacktestRequest', 'BacktestStatus',
    'BacktestSummary', 'StrategyOptimizationRequest', 'BacktestError'
]