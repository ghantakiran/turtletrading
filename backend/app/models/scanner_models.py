"""
Scanner Models and Data Structures

Defines models for multi-asset scanning including filters,
conditions, results, and alert configurations.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from decimal import Decimal
from enum import Enum


class ScannerType(str, Enum):
    """Types of scanners available"""
    PRICE = "price"
    VOLUME = "volume"
    TECHNICAL = "technical"
    FUNDAMENTAL = "fundamental"
    MOMENTUM = "momentum"
    VOLATILITY = "volatility"
    PATTERN = "pattern"
    CUSTOM = "custom"


class ComparisonOperator(str, Enum):
    """Comparison operators for filters"""
    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    GREATER_THAN_OR_EQUAL = ">="
    LESS_THAN = "<"
    LESS_THAN_OR_EQUAL = "<="
    BETWEEN = "between"
    NOT_BETWEEN = "not_between"
    IN = "in"
    NOT_IN = "not_in"
    CONTAINS = "contains"
    CROSSES_ABOVE = "crosses_above"
    CROSSES_BELOW = "crosses_below"


class TimeFrame(str, Enum):
    """Time frames for scanning"""
    MINUTE_1 = "1m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"


class AssetType(str, Enum):
    """Asset types for scanning"""
    STOCK = "stock"
    ETF = "etf"
    CRYPTO = "crypto"
    FOREX = "forex"
    OPTION = "option"
    FUTURE = "future"
    INDEX = "index"


class MarketCap(str, Enum):
    """Market cap categories"""
    NANO = "nano"  # < $50M
    MICRO = "micro"  # $50M - $300M
    SMALL = "small"  # $300M - $2B
    MID = "mid"  # $2B - $10B
    LARGE = "large"  # $10B - $200B
    MEGA = "mega"  # > $200B


class Sector(str, Enum):
    """Market sectors"""
    TECHNOLOGY = "technology"
    HEALTHCARE = "healthcare"
    FINANCIAL = "financial"
    CONSUMER_DISCRETIONARY = "consumer_discretionary"
    CONSUMER_STAPLES = "consumer_staples"
    ENERGY = "energy"
    MATERIALS = "materials"
    INDUSTRIALS = "industrials"
    UTILITIES = "utilities"
    REAL_ESTATE = "real_estate"
    COMMUNICATION_SERVICES = "communication_services"


# Filter Models

class FilterCondition(BaseModel):
    """Single filter condition"""
    field: str = Field(..., description="Field to filter on")
    operator: ComparisonOperator = Field(..., description="Comparison operator")
    value: Union[float, str, List[Union[float, str]]] = Field(..., description="Value(s) to compare")
    time_frame: Optional[TimeFrame] = Field(None, description="Time frame for the condition")
    lookback_periods: Optional[int] = Field(None, description="Number of periods to look back")

    @validator('value')
    def validate_value_for_operator(cls, v, values):
        operator = values.get('operator')
        if operator in [ComparisonOperator.BETWEEN, ComparisonOperator.NOT_BETWEEN]:
            if not isinstance(v, list) or len(v) != 2:
                raise ValueError(f"Operator {operator} requires exactly 2 values")
        elif operator in [ComparisonOperator.IN, ComparisonOperator.NOT_IN]:
            if not isinstance(v, list):
                raise ValueError(f"Operator {operator} requires a list of values")
        return v


class FilterGroup(BaseModel):
    """Group of filter conditions with logical operator"""
    operator: str = Field("AND", description="Logical operator (AND/OR)")
    conditions: List[FilterCondition] = Field(..., description="Filter conditions")
    groups: Optional[List['FilterGroup']] = Field(None, description="Nested filter groups")


# Scanner Configuration Models

class PriceFilter(BaseModel):
    """Price-based filter configuration"""
    min_price: Optional[Decimal] = Field(None, description="Minimum price")
    max_price: Optional[Decimal] = Field(None, description="Maximum price")
    price_change_percent: Optional[Decimal] = Field(None, description="Price change percentage")
    price_change_period: Optional[TimeFrame] = Field(TimeFrame.DAY_1, description="Period for price change")
    above_vwap: Optional[bool] = Field(None, description="Price above VWAP")
    near_high: Optional[Decimal] = Field(None, description="Within X% of period high")
    near_low: Optional[Decimal] = Field(None, description="Within X% of period low")
    gap_percent: Optional[Decimal] = Field(None, description="Gap percentage")


class VolumeFilter(BaseModel):
    """Volume-based filter configuration"""
    min_volume: Optional[int] = Field(None, description="Minimum volume")
    max_volume: Optional[int] = Field(None, description="Maximum volume")
    volume_ratio: Optional[Decimal] = Field(None, description="Volume relative to average")
    volume_spike: Optional[Decimal] = Field(None, description="Volume spike threshold")
    dollar_volume: Optional[Decimal] = Field(None, description="Dollar volume threshold")
    avg_volume_period: int = Field(20, description="Period for average volume")


class TechnicalFilter(BaseModel):
    """Technical indicator filter configuration"""
    rsi_min: Optional[Decimal] = Field(None, description="Minimum RSI")
    rsi_max: Optional[Decimal] = Field(None, description="Maximum RSI")
    macd_signal: Optional[str] = Field(None, description="MACD signal (bullish/bearish)")
    sma_cross: Optional[str] = Field(None, description="SMA crossover type")
    bollinger_position: Optional[str] = Field(None, description="Position relative to Bollinger Bands")
    adx_min: Optional[Decimal] = Field(None, description="Minimum ADX for trend strength")
    atr_min: Optional[Decimal] = Field(None, description="Minimum ATR for volatility")
    stochastic_zone: Optional[str] = Field(None, description="Stochastic zone (oversold/overbought)")


class FundamentalFilter(BaseModel):
    """Fundamental data filter configuration"""
    market_cap_min: Optional[Decimal] = Field(None, description="Minimum market cap")
    market_cap_max: Optional[Decimal] = Field(None, description="Maximum market cap")
    market_cap_category: Optional[MarketCap] = Field(None, description="Market cap category")
    pe_ratio_min: Optional[Decimal] = Field(None, description="Minimum P/E ratio")
    pe_ratio_max: Optional[Decimal] = Field(None, description="Maximum P/E ratio")
    dividend_yield_min: Optional[Decimal] = Field(None, description="Minimum dividend yield")
    eps_growth_min: Optional[Decimal] = Field(None, description="Minimum EPS growth")
    revenue_growth_min: Optional[Decimal] = Field(None, description="Minimum revenue growth")
    sector: Optional[List[Sector]] = Field(None, description="Sectors to include")


class MomentumFilter(BaseModel):
    """Momentum-based filter configuration"""
    rate_of_change: Optional[Decimal] = Field(None, description="Rate of change threshold")
    relative_strength: Optional[Decimal] = Field(None, description="Relative strength threshold")
    momentum_period: int = Field(14, description="Period for momentum calculation")
    acceleration: Optional[bool] = Field(None, description="Momentum acceleration")
    consecutive_up_days: Optional[int] = Field(None, description="Consecutive up days")
    consecutive_down_days: Optional[int] = Field(None, description="Consecutive down days")


class PatternFilter(BaseModel):
    """Chart pattern filter configuration"""
    pattern_types: Optional[List[str]] = Field(None, description="Pattern types to detect")
    breakout: Optional[bool] = Field(None, description="Breakout detection")
    breakdown: Optional[bool] = Field(None, description="Breakdown detection")
    support_bounce: Optional[bool] = Field(None, description="Support bounce detection")
    resistance_test: Optional[bool] = Field(None, description="Resistance test detection")
    trend_line_break: Optional[bool] = Field(None, description="Trend line break detection")
    confidence_min: Optional[Decimal] = Field(None, description="Minimum pattern confidence")


# Scanner Request/Response Models

class ScannerConfig(BaseModel):
    """Complete scanner configuration"""
    name: str = Field(..., description="Scanner name")
    description: Optional[str] = Field(None, description="Scanner description")
    scanner_type: ScannerType = Field(..., description="Type of scanner")
    asset_types: List[AssetType] = Field(..., description="Asset types to scan")
    universe: Optional[List[str]] = Field(None, description="Specific symbols to scan")
    exclude_symbols: Optional[List[str]] = Field(None, description="Symbols to exclude")
    time_frame: TimeFrame = Field(TimeFrame.DAY_1, description="Primary time frame")

    # Filters
    price_filter: Optional[PriceFilter] = Field(None, description="Price filters")
    volume_filter: Optional[VolumeFilter] = Field(None, description="Volume filters")
    technical_filter: Optional[TechnicalFilter] = Field(None, description="Technical filters")
    fundamental_filter: Optional[FundamentalFilter] = Field(None, description="Fundamental filters")
    momentum_filter: Optional[MomentumFilter] = Field(None, description="Momentum filters")
    pattern_filter: Optional[PatternFilter] = Field(None, description="Pattern filters")

    # Advanced
    custom_conditions: Optional[FilterGroup] = Field(None, description="Custom filter conditions")
    sort_by: Optional[str] = Field(None, description="Sort results by field")
    sort_order: str = Field("desc", description="Sort order (asc/desc)")
    limit: int = Field(100, le=1000, description="Maximum results")

    # Execution
    run_interval: Optional[int] = Field(None, description="Auto-run interval in seconds")
    alert_enabled: bool = Field(False, description="Enable alerts for results")
    webhook_url: Optional[str] = Field(None, description="Webhook URL for alerts")




class ScannerResponse(BaseModel):
    """Complete scanner response"""
    scanner_id: str = Field(..., description="Scanner configuration ID")
    scanner_name: str = Field(..., description="Scanner name")
    scan_timestamp: datetime = Field(..., description="When scan was performed")

    # Results
    results: List[ScanResult] = Field(..., description="Scan results")
    total_matches: int = Field(..., description="Total number of matches")
    total_scanned: int = Field(..., description="Total assets scanned")

    # Performance
    scan_duration_ms: int = Field(..., description="Scan duration in milliseconds")
    filters_applied: int = Field(..., description="Number of filters applied")

    # Metadata
    config_hash: str = Field(..., description="Hash of scanner configuration")
    cache_hit: bool = Field(False, description="Whether results were from cache")


# Alert Models

class AlertType(str, Enum):
    """Types of alerts"""
    NEW_MATCH = "new_match"
    REMOVED_MATCH = "removed_match"
    CONDITION_MET = "condition_met"
    THRESHOLD_CROSSED = "threshold_crossed"
    PATTERN_DETECTED = "pattern_detected"


class ScannerAlert(BaseModel):
    """Scanner alert notification"""
    alert_id: str = Field(..., description="Alert ID")
    scanner_id: str = Field(..., description="Scanner that triggered alert")
    scanner_name: str = Field(..., description="Scanner name")
    alert_type: AlertType = Field(..., description="Type of alert")

    # Alert data
    symbol: str = Field(..., description="Symbol that triggered alert")
    message: str = Field(..., description="Alert message")
    condition: str = Field(..., description="Condition that triggered alert")
    current_value: Any = Field(..., description="Current value of monitored field")
    threshold_value: Optional[Any] = Field(None, description="Threshold that was crossed")

    # Metadata
    timestamp: datetime = Field(..., description="Alert timestamp")
    priority: str = Field("medium", description="Alert priority (low/medium/high)")
    delivered: bool = Field(False, description="Whether alert was delivered")
    delivery_channels: List[str] = Field(..., description="Delivery channels used")


class AlertConfig(BaseModel):
    """Alert configuration for scanner"""
    enabled: bool = Field(True, description="Whether alerts are enabled")
    alert_on_new_match: bool = Field(True, description="Alert when new match appears")
    alert_on_removed_match: bool = Field(False, description="Alert when match disappears")
    alert_on_threshold: bool = Field(True, description="Alert on threshold crossing")

    # Delivery
    email_enabled: bool = Field(False, description="Send email alerts")
    email_addresses: Optional[List[str]] = Field(None, description="Email addresses")
    sms_enabled: bool = Field(False, description="Send SMS alerts")
    phone_numbers: Optional[List[str]] = Field(None, description="Phone numbers")
    webhook_enabled: bool = Field(False, description="Send webhook alerts")
    webhook_urls: Optional[List[str]] = Field(None, description="Webhook URLs")

    # Rate limiting
    max_alerts_per_hour: int = Field(100, description="Maximum alerts per hour")
    cooldown_minutes: int = Field(5, description="Cooldown between alerts for same symbol")

    # Filtering
    min_match_score: Optional[Decimal] = Field(None, description="Minimum match score for alerts")
    priority_symbols: Optional[List[str]] = Field(None, description="Priority symbols for alerts")
    excluded_symbols: Optional[List[str]] = Field(None, description="Symbols to exclude from alerts")


# Saved Scanner Models

class SavedScanner(BaseModel):
    """Saved scanner configuration"""
    scanner_id: str = Field(..., description="Unique scanner ID")
    user_id: str = Field(..., description="User who created scanner")
    name: str = Field(..., description="Scanner name")
    description: Optional[str] = Field(None, description="Scanner description")
    config: ScannerConfig = Field(..., description="Scanner configuration")
    alert_config: Optional[AlertConfig] = Field(None, description="Alert configuration")

    # Metadata
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    last_run: Optional[datetime] = Field(None, description="Last execution timestamp")
    run_count: int = Field(0, description="Number of times run")

    # Sharing
    is_public: bool = Field(False, description="Whether scanner is public")
    shared_with: Optional[List[str]] = Field(None, description="User IDs shared with")
    tags: Optional[List[str]] = Field(None, description="Tags for categorization")

    # Performance
    avg_scan_time_ms: Optional[int] = Field(None, description="Average scan time")
    avg_matches: Optional[int] = Field(None, description="Average number of matches")
    success_rate: Optional[Decimal] = Field(None, description="Success rate of predictions")


class ScannerRunRequest(BaseModel):
    """Request to run a scanner"""
    scanner_id: Optional[str] = Field(None, description="ID of saved scanner to run")
    config: Optional[ScannerConfig] = Field(None, description="Ad-hoc scanner configuration")
    real_time: bool = Field(False, description="Whether to return real-time data")
    include_historical: bool = Field(False, description="Include historical matches")
    test_mode: bool = Field(False, description="Run in test mode (no alerts)")

    @validator('config')
    def validate_scanner_source(cls, v, values):
        scanner_id = values.get('scanner_id')
        if not scanner_id and not v:
            raise ValueError("Either scanner_id or config must be provided")
        return v


class ScannerSchedule(BaseModel):
    """Scanner execution schedule"""
    scanner_id: str = Field(..., description="Scanner to schedule")
    enabled: bool = Field(True, description="Whether schedule is enabled")

    # Schedule types
    cron_expression: Optional[str] = Field(None, description="Cron expression for scheduling")
    interval_seconds: Optional[int] = Field(None, description="Run interval in seconds")
    market_hours_only: bool = Field(True, description="Only run during market hours")

    # Execution window
    start_time: Optional[str] = Field(None, description="Daily start time (HH:MM)")
    end_time: Optional[str] = Field(None, description="Daily end time (HH:MM)")
    days_of_week: Optional[List[int]] = Field(None, description="Days to run (0=Monday)")

    # Options
    skip_on_error: bool = Field(True, description="Skip next run on error")
    retry_on_failure: bool = Field(True, description="Retry failed scans")
    max_retries: int = Field(3, description="Maximum retry attempts")

    # Metadata
    next_run: Optional[datetime] = Field(None, description="Next scheduled run")
    last_run: Optional[datetime] = Field(None, description="Last run timestamp")
    last_status: Optional[str] = Field(None, description="Last run status")


# Aggregation Models

class AggregatedScanResult(BaseModel):
    """Aggregated result from multiple scanners"""
    symbol: str = Field(..., description="Asset symbol")
    aggregate_score: Decimal = Field(..., description="Aggregated match score (0-100)")
    confidence: Decimal = Field(..., description="Confidence in aggregation (0-100)")
    scanner_count: int = Field(..., description="Number of scanners that matched")

    # Scanner contributions
    scanner_contributions: List[Dict[str, Any]] = Field(..., description="Individual scanner contributions")
    matched_filters: List[str] = Field(..., description="All matched filters across scanners")
    consensus_tags: List[str] = Field(..., description="Tags agreed upon by multiple scanners")

    # Scoring details
    diversity_score: Decimal = Field(..., description="Diversity bonus score")
    consensus_score: Decimal = Field(..., description="Consensus bonus score")

    # Metadata
    priority: str = Field(..., description="Priority level (low/medium/high/critical)")
    timestamp: datetime = Field(..., description="Aggregation timestamp")
    insights: List['ScannerInsight'] = Field(default_factory=list, description="Generated insights")


class ScannerInsight(BaseModel):
    """Insight generated from scanner analysis"""
    type: str = Field(..., description="Type of insight (consensus/pattern/portfolio/watchlist)")
    message: str = Field(..., description="Insight message")
    confidence: str = Field(..., description="Confidence level (low/medium/high)")
    importance: str = Field(..., description="Importance level (low/medium/high)")
    data: Optional[Dict[str, Any]] = Field(None, description="Additional insight data")


class PortfolioAnalysis(BaseModel):
    """Portfolio analysis based on scanner results"""
    total_analyzed: int = Field(..., description="Total symbols analyzed")
    portfolio_matches: int = Field(..., description="Current portfolio matches")
    watchlist_matches: int = Field(..., description="Watchlist matches")
    new_opportunities: int = Field(..., description="New opportunities found")
    high_priority_count: int = Field(..., description="High priority matches")

    # Statistics
    avg_aggregate_score: Decimal = Field(..., description="Average aggregate score")
    sector_analysis: Dict[str, Any] = Field(..., description="Sector distribution analysis")
    recommendations: List[Dict[str, Any]] = Field(..., description="Generated recommendations")

    # Metadata
    timestamp: datetime = Field(..., description="Analysis timestamp")


# Update ScanResult model to include tags
class ScanResult(BaseModel):
    """Individual scan result for an asset"""
    symbol: str = Field(..., description="Asset symbol")
    name: Optional[str] = Field(None, description="Asset name")
    asset_type: AssetType = Field(..., description="Type of asset")

    # Price data
    price: Decimal = Field(..., description="Current price")
    change: Decimal = Field(..., description="Price change")
    change_percent: Decimal = Field(..., description="Price change percentage")
    volume: int = Field(..., description="Current volume")

    # Scores and rankings
    match_score: Decimal = Field(..., description="How well asset matches filters (0-100)")
    rank: Optional[int] = Field(None, description="Rank among results")

    # Matched conditions
    matched_filters: List[str] = Field(..., description="Which filters were matched")
    filter_values: Dict[str, Any] = Field(..., description="Actual values for filtered fields")

    # Additional data
    technical_indicators: Optional[Dict[str, Decimal]] = Field(None, description="Technical indicator values")
    fundamental_data: Optional[Dict[str, Any]] = Field(None, description="Fundamental data")
    patterns_detected: Optional[List[str]] = Field(None, description="Detected patterns")
    tags: Optional[List[str]] = Field(None, description="Result tags")

    # Metadata
    scan_timestamp: datetime = Field(..., description="When scan was performed")
    time_frame: TimeFrame = Field(..., description="Time frame used")


# Update FilterGroup model reference
FilterGroup.model_rebuild()
AggregatedScanResult.model_rebuild()