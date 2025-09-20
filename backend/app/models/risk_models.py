"""
Risk Management Models

Comprehensive data structures for portfolio risk management, position sizing,
risk metrics, and compliance monitoring.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from decimal import Decimal
from enum import Enum


class RiskProfile(str, Enum):
    """Risk profile types for investors"""
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"
    VERY_AGGRESSIVE = "very_aggressive"
    CUSTOM = "custom"


class PositionType(str, Enum):
    """Position types"""
    LONG = "long"
    SHORT = "short"
    OPTION = "option"


class OrderType(str, Enum):
    """Order types for risk management"""
    MARKET = "market"
    LIMIT = "limit"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    TRAILING_STOP = "trailing_stop"
    STOP_LIMIT = "stop_limit"


class RiskMetricType(str, Enum):
    """Types of risk metrics"""
    VAR = "value_at_risk"
    CVAR = "conditional_value_at_risk"
    SHARPE = "sharpe_ratio"
    SORTINO = "sortino_ratio"
    MAX_DRAWDOWN = "max_drawdown"
    BETA = "beta"
    ALPHA = "alpha"
    VOLATILITY = "volatility"
    CORRELATION = "correlation"


class AlertSeverity(str, Enum):
    """Risk alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


# Position and Portfolio Models

class Position(BaseModel):
    """Individual position in portfolio"""
    position_id: str = Field(..., description="Unique position identifier")
    symbol: str = Field(..., description="Asset symbol")
    position_type: PositionType = Field(..., description="Position type")

    # Quantities
    quantity: Decimal = Field(..., description="Position quantity")
    entry_price: Decimal = Field(..., description="Average entry price")
    current_price: Decimal = Field(..., description="Current market price")

    # Values
    market_value: Decimal = Field(..., description="Current market value")
    unrealized_pnl: Decimal = Field(..., description="Unrealized profit/loss")
    unrealized_pnl_percent: Decimal = Field(..., description="Unrealized P&L percentage")
    realized_pnl: Decimal = Field(Decimal(0), description="Realized profit/loss")

    # Risk parameters
    stop_loss: Optional[Decimal] = Field(None, description="Stop loss price")
    take_profit: Optional[Decimal] = Field(None, description="Take profit price")
    trailing_stop_percent: Optional[Decimal] = Field(None, description="Trailing stop percentage")
    max_position_size: Optional[Decimal] = Field(None, description="Maximum position size")

    # Dates
    entry_date: datetime = Field(..., description="Position entry date")
    last_updated: datetime = Field(..., description="Last update timestamp")

    # Risk metrics
    position_risk: Optional[Decimal] = Field(None, description="Position risk amount")
    risk_reward_ratio: Optional[Decimal] = Field(None, description="Risk/reward ratio")
    volatility: Optional[Decimal] = Field(None, description="Asset volatility")
    beta: Optional[Decimal] = Field(None, description="Asset beta")


class Portfolio(BaseModel):
    """Portfolio containing multiple positions"""
    portfolio_id: str = Field(..., description="Portfolio identifier")
    user_id: str = Field(..., description="User identifier")
    name: str = Field(..., description="Portfolio name")

    # Capital
    total_capital: Decimal = Field(..., description="Total portfolio capital")
    cash_balance: Decimal = Field(..., description="Available cash balance")
    invested_capital: Decimal = Field(..., description="Currently invested capital")

    # Positions
    positions: List[Position] = Field(default_factory=list, description="Portfolio positions")
    position_count: int = Field(0, description="Number of positions")

    # Performance
    total_value: Decimal = Field(..., description="Total portfolio value")
    total_pnl: Decimal = Field(..., description="Total P&L")
    total_pnl_percent: Decimal = Field(..., description="Total P&L percentage")
    daily_pnl: Decimal = Field(Decimal(0), description="Daily P&L")

    # Risk metrics
    portfolio_var: Optional[Decimal] = Field(None, description="Portfolio VaR")
    portfolio_volatility: Optional[Decimal] = Field(None, description="Portfolio volatility")
    sharpe_ratio: Optional[Decimal] = Field(None, description="Sharpe ratio")
    max_drawdown: Optional[Decimal] = Field(None, description="Maximum drawdown")

    # Timestamps
    created_at: datetime = Field(..., description="Portfolio creation date")
    updated_at: datetime = Field(..., description="Last update timestamp")


# Risk Calculation Models

class PositionSizingRequest(BaseModel):
    """Request for position sizing calculation"""
    symbol: str = Field(..., description="Asset symbol")
    account_balance: Decimal = Field(..., description="Total account balance")
    risk_per_trade: Decimal = Field(..., description="Risk per trade (percentage)")

    # Entry and exit
    entry_price: Decimal = Field(..., description="Planned entry price")
    stop_loss_price: Decimal = Field(..., description="Stop loss price")
    take_profit_price: Optional[Decimal] = Field(None, description="Take profit price")

    # Risk parameters
    max_position_percent: Decimal = Field(Decimal(10), description="Max position size as % of account")
    use_kelly_criterion: bool = Field(False, description="Use Kelly Criterion")
    win_probability: Optional[Decimal] = Field(None, description="Win probability for Kelly")
    average_win: Optional[Decimal] = Field(None, description="Average win amount")
    average_loss: Optional[Decimal] = Field(None, description="Average loss amount")

    # Volatility adjustment
    adjust_for_volatility: bool = Field(True, description="Adjust size for volatility")
    target_volatility: Optional[Decimal] = Field(None, description="Target portfolio volatility")
    current_volatility: Optional[Decimal] = Field(None, description="Current asset volatility")


class PositionSizingResult(BaseModel):
    """Position sizing calculation result"""
    symbol: str = Field(..., description="Asset symbol")
    recommended_shares: int = Field(..., description="Recommended number of shares")
    position_value: Decimal = Field(..., description="Total position value")
    position_percent: Decimal = Field(..., description="Position as % of account")

    # Risk metrics
    risk_amount: Decimal = Field(..., description="Dollar risk amount")
    risk_percent: Decimal = Field(..., description="Risk as % of account")
    risk_per_share: Decimal = Field(..., description="Risk per share")

    # Risk/Reward
    potential_profit: Optional[Decimal] = Field(None, description="Potential profit")
    risk_reward_ratio: Optional[Decimal] = Field(None, description="Risk/reward ratio")

    # Kelly Criterion (if used)
    kelly_fraction: Optional[Decimal] = Field(None, description="Kelly fraction")
    kelly_adjusted_size: Optional[int] = Field(None, description="Kelly-adjusted position size")

    # Warnings
    warnings: List[str] = Field(default_factory=list, description="Risk warnings")
    adjustments_made: List[str] = Field(default_factory=list, description="Size adjustments applied")


class RiskMetrics(BaseModel):
    """Comprehensive risk metrics for portfolio or position"""
    # Value at Risk
    var_95: Decimal = Field(..., description="95% Value at Risk")
    var_99: Decimal = Field(..., description="99% Value at Risk")
    cvar_95: Decimal = Field(..., description="95% Conditional VaR")
    cvar_99: Decimal = Field(..., description="99% Conditional VaR")

    # Volatility metrics
    daily_volatility: Decimal = Field(..., description="Daily volatility")
    annual_volatility: Decimal = Field(..., description="Annualized volatility")
    downside_volatility: Decimal = Field(..., description="Downside volatility")

    # Performance ratios
    sharpe_ratio: Decimal = Field(..., description="Sharpe ratio")
    sortino_ratio: Decimal = Field(..., description="Sortino ratio")
    calmar_ratio: Optional[Decimal] = Field(None, description="Calmar ratio")
    information_ratio: Optional[Decimal] = Field(None, description="Information ratio")

    # Drawdown metrics
    current_drawdown: Decimal = Field(..., description="Current drawdown")
    max_drawdown: Decimal = Field(..., description="Maximum drawdown")
    avg_drawdown: Decimal = Field(..., description="Average drawdown")
    drawdown_duration: Optional[int] = Field(None, description="Current drawdown duration (days)")

    # Market risk
    beta: Decimal = Field(..., description="Portfolio beta")
    alpha: Optional[Decimal] = Field(None, description="Portfolio alpha")
    correlation_market: Decimal = Field(..., description="Correlation with market")

    # Concentration risk
    concentration_risk: Decimal = Field(..., description="Portfolio concentration risk")
    largest_position_percent: Decimal = Field(..., description="Largest position as % of portfolio")
    top_5_concentration: Decimal = Field(..., description="Top 5 positions concentration")

    # Liquidity risk
    liquidity_score: Decimal = Field(..., description="Liquidity score (0-100)")
    days_to_liquidate: Decimal = Field(..., description="Estimated days to liquidate")

    # Timestamps
    calculated_at: datetime = Field(..., description="Calculation timestamp")
    period_days: int = Field(..., description="Calculation period in days")


class CorrelationMatrix(BaseModel):
    """Correlation matrix for portfolio assets"""
    symbols: List[str] = Field(..., description="Asset symbols")
    matrix: List[List[Decimal]] = Field(..., description="Correlation matrix")
    period_days: int = Field(..., description="Calculation period")
    calculated_at: datetime = Field(..., description="Calculation timestamp")

    # Statistics
    avg_correlation: Decimal = Field(..., description="Average correlation")
    max_correlation: Decimal = Field(..., description="Maximum correlation")
    min_correlation: Decimal = Field(..., description="Minimum correlation")

    # Diversification metrics
    diversification_ratio: Decimal = Field(..., description="Diversification ratio")
    effective_number_of_assets: Decimal = Field(..., description="Effective number of assets")


class RiskLimits(BaseModel):
    """Risk limits and thresholds"""
    # Position limits
    max_position_size: Decimal = Field(..., description="Max position size (% of portfolio)")
    max_sector_exposure: Decimal = Field(..., description="Max sector exposure (%)")
    max_single_loss: Decimal = Field(..., description="Max single position loss (%)")

    # Portfolio limits
    max_portfolio_var: Decimal = Field(..., description="Max portfolio VaR")
    max_leverage: Decimal = Field(Decimal(1), description="Maximum leverage")
    max_drawdown: Decimal = Field(..., description="Maximum allowable drawdown")

    # Daily limits
    max_daily_loss: Decimal = Field(..., description="Max daily loss (%)")
    max_daily_trades: int = Field(..., description="Max number of daily trades")

    # Concentration limits
    max_concentration: Decimal = Field(..., description="Max concentration in single asset")
    min_positions: int = Field(1, description="Minimum number of positions")
    max_positions: int = Field(..., description="Maximum number of positions")

    # Correlation limits
    max_correlation: Decimal = Field(..., description="Max correlation between positions")
    min_diversification_ratio: Decimal = Field(..., description="Minimum diversification ratio")


class RiskAlert(BaseModel):
    """Risk alert notification"""
    alert_id: str = Field(..., description="Alert identifier")
    severity: AlertSeverity = Field(..., description="Alert severity")
    alert_type: str = Field(..., description="Type of risk alert")

    # Alert details
    title: str = Field(..., description="Alert title")
    message: str = Field(..., description="Detailed alert message")
    symbol: Optional[str] = Field(None, description="Related symbol")

    # Risk metrics
    metric_name: str = Field(..., description="Risk metric that triggered alert")
    current_value: Decimal = Field(..., description="Current metric value")
    threshold_value: Decimal = Field(..., description="Threshold that was breached")

    # Actions
    recommended_action: Optional[str] = Field(None, description="Recommended action")
    auto_action_taken: bool = Field(False, description="Whether automatic action was taken")
    auto_action_details: Optional[str] = Field(None, description="Details of automatic action")

    # Timestamps
    triggered_at: datetime = Field(..., description="Alert trigger timestamp")
    acknowledged: bool = Field(False, description="Whether alert was acknowledged")
    acknowledged_at: Optional[datetime] = Field(None, description="Acknowledgment timestamp")


class StopLossOrder(BaseModel):
    """Stop loss order configuration"""
    symbol: str = Field(..., description="Asset symbol")
    position_id: str = Field(..., description="Related position ID")

    # Stop loss parameters
    stop_price: Decimal = Field(..., description="Stop trigger price")
    limit_price: Optional[Decimal] = Field(None, description="Limit price (for stop-limit)")
    trailing_amount: Optional[Decimal] = Field(None, description="Trailing stop amount")
    trailing_percent: Optional[Decimal] = Field(None, description="Trailing stop percentage")

    # Order details
    quantity: Decimal = Field(..., description="Quantity to sell")
    order_type: OrderType = Field(..., description="Order type")
    time_in_force: str = Field("GTC", description="Time in force (GTC, DAY, IOC)")

    # Risk metrics
    loss_amount: Decimal = Field(..., description="Expected loss amount")
    loss_percent: Decimal = Field(..., description="Expected loss percentage")

    # Status
    active: bool = Field(True, description="Whether order is active")
    triggered: bool = Field(False, description="Whether stop was triggered")
    triggered_at: Optional[datetime] = Field(None, description="Trigger timestamp")

    # Timestamps
    created_at: datetime = Field(..., description="Order creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class TakeProfitOrder(BaseModel):
    """Take profit order configuration"""
    symbol: str = Field(..., description="Asset symbol")
    position_id: str = Field(..., description="Related position ID")

    # Take profit parameters
    target_price: Decimal = Field(..., description="Target price")
    quantity: Decimal = Field(..., description="Quantity to sell")
    partial_exit: bool = Field(False, description="Whether this is partial exit")

    # Scaling out
    scale_out_levels: Optional[List[Dict[str, Decimal]]] = Field(
        None, description="Multiple take profit levels"
    )

    # Risk metrics
    profit_amount: Decimal = Field(..., description="Expected profit amount")
    profit_percent: Decimal = Field(..., description="Expected profit percentage")
    risk_reward_ratio: Decimal = Field(..., description="Risk/reward ratio")

    # Status
    active: bool = Field(True, description="Whether order is active")
    triggered: bool = Field(False, description="Whether target was reached")
    triggered_at: Optional[datetime] = Field(None, description="Trigger timestamp")

    # Timestamps
    created_at: datetime = Field(..., description="Order creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class RiskReport(BaseModel):
    """Comprehensive risk report"""
    report_id: str = Field(..., description="Report identifier")
    portfolio_id: str = Field(..., description="Portfolio identifier")
    report_date: date = Field(..., description="Report date")

    # Portfolio summary
    total_value: Decimal = Field(..., description="Total portfolio value")
    total_positions: int = Field(..., description="Number of positions")
    cash_balance: Decimal = Field(..., description="Cash balance")
    leverage: Decimal = Field(..., description="Current leverage")

    # Risk metrics
    risk_metrics: RiskMetrics = Field(..., description="Comprehensive risk metrics")
    correlation_matrix: Optional[CorrelationMatrix] = Field(None, description="Asset correlations")

    # Risk scores
    overall_risk_score: Decimal = Field(..., description="Overall risk score (0-100)")
    concentration_score: Decimal = Field(..., description="Concentration risk score")
    volatility_score: Decimal = Field(..., description="Volatility risk score")
    drawdown_score: Decimal = Field(..., description="Drawdown risk score")

    # Limit breaches
    limit_breaches: List[Dict[str, Any]] = Field(default_factory=list, description="Current limit breaches")
    warnings: List[str] = Field(default_factory=list, description="Risk warnings")

    # Recommendations
    recommendations: List[str] = Field(default_factory=list, description="Risk recommendations")
    rebalancing_suggestions: Optional[List[Dict[str, Any]]] = Field(None, description="Rebalancing suggestions")

    # Historical comparison
    risk_trend: str = Field(..., description="Risk trend (increasing/decreasing/stable)")
    risk_change_7d: Decimal = Field(..., description="7-day risk change")
    risk_change_30d: Decimal = Field(..., description="30-day risk change")

    # Timestamps
    generated_at: datetime = Field(..., description="Report generation timestamp")
    next_report_date: date = Field(..., description="Next scheduled report date")


class MonteCarloSimulation(BaseModel):
    """Monte Carlo simulation results"""
    simulation_id: str = Field(..., description="Simulation identifier")
    portfolio_id: str = Field(..., description="Portfolio identifier")

    # Simulation parameters
    num_simulations: int = Field(..., description="Number of simulations run")
    time_horizon_days: int = Field(..., description="Simulation time horizon")
    confidence_levels: List[Decimal] = Field(..., description="Confidence levels calculated")

    # Results
    expected_return: Decimal = Field(..., description="Expected return")
    expected_volatility: Decimal = Field(..., description="Expected volatility")

    # Percentile outcomes
    percentile_5: Decimal = Field(..., description="5th percentile outcome")
    percentile_25: Decimal = Field(..., description="25th percentile outcome")
    percentile_50: Decimal = Field(..., description="50th percentile (median)")
    percentile_75: Decimal = Field(..., description="75th percentile outcome")
    percentile_95: Decimal = Field(..., description="95th percentile outcome")

    # Risk metrics
    probability_of_loss: Decimal = Field(..., description="Probability of loss")
    probability_of_target: Decimal = Field(..., description="Probability of reaching target")
    max_simulated_loss: Decimal = Field(..., description="Maximum simulated loss")
    max_simulated_gain: Decimal = Field(..., description="Maximum simulated gain")

    # Statistics
    simulation_paths: Optional[List[List[Decimal]]] = Field(None, description="Sample simulation paths")

    # Timestamps
    simulated_at: datetime = Field(..., description="Simulation timestamp")


class RiskProfileConfig(BaseModel):
    """User risk profile configuration"""
    user_id: str = Field(..., description="User identifier")
    risk_profile: RiskProfile = Field(..., description="Risk profile type")

    # Risk tolerance
    max_portfolio_risk: Decimal = Field(..., description="Maximum portfolio risk (%)")
    max_position_risk: Decimal = Field(..., description="Maximum position risk (%)")
    max_daily_loss: Decimal = Field(..., description="Maximum daily loss (%)")

    # Risk preferences
    prefer_stop_loss: bool = Field(True, description="Prefer using stop losses")
    prefer_diversification: bool = Field(True, description="Prefer diversified portfolio")
    allow_leverage: bool = Field(False, description="Allow leveraged positions")
    allow_short_selling: bool = Field(False, description="Allow short selling")
    allow_options: bool = Field(False, description="Allow options trading")

    # Risk limits
    risk_limits: RiskLimits = Field(..., description="Configured risk limits")

    # Alert preferences
    alert_on_limit_breach: bool = Field(True, description="Alert on limit breaches")
    alert_on_high_volatility: bool = Field(True, description="Alert on high volatility")
    alert_on_correlation_change: bool = Field(True, description="Alert on correlation changes")

    # Auto risk management
    auto_stop_loss: bool = Field(False, description="Automatic stop loss orders")
    auto_rebalancing: bool = Field(False, description="Automatic portfolio rebalancing")
    auto_position_sizing: bool = Field(False, description="Automatic position sizing")

    # Timestamps
    created_at: datetime = Field(..., description="Profile creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")