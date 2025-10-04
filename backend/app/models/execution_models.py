"""
Pydantic models for execution API endpoints.

This module defines request/response models for algorithmic trading,
smart order routing, and execution monitoring APIs.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any, Union
from datetime import datetime
from decimal import Decimal
from enum import Enum

class AlgorithmType(str, Enum):
    """Supported execution algorithm types."""
    TWAP = "TWAP"
    VWAP = "VWAP"
    POV = "POV"

class OrderSide(str, Enum):
    """Order side enumeration."""
    BUY = "BUY"
    SELL = "SELL"

class ExecutionStatus(str, Enum):
    """Execution status enumeration."""
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"

class VenueTypeEnum(str, Enum):
    """Venue type enumeration."""
    EXCHANGE = "EXCHANGE"
    ECN = "ECN"
    DARK_POOL = "DARK_POOL"
    MARKET_MAKER = "MARKET_MAKER"

# Request Models

class AlgorithmRequest(BaseModel):
    """Request model for creating algorithm execution."""
    algo_type: AlgorithmType = Field(..., description="Type of execution algorithm")
    symbol: str = Field(..., min_length=1, max_length=10, description="Stock symbol")
    side: OrderSide = Field(..., description="Order side (BUY/SELL)")
    quantity: int = Field(..., gt=0, le=10000000, description="Total quantity to execute")

    start_time: Optional[datetime] = Field(None, description="Algorithm start time")
    end_time: Optional[datetime] = Field(None, description="Algorithm end time")

    algo_params: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Algorithm-specific parameters"
    )

    max_participation_rate: Optional[float] = Field(
        default=0.20,
        ge=0.01,
        le=0.50,
        description="Maximum participation rate (1-50%)"
    )

    price_aggressiveness: Optional[float] = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Price aggressiveness (0=passive, 1=aggressive)"
    )

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and 'start_time' in values and values['start_time']:
            if v <= values['start_time']:
                raise ValueError('end_time must be after start_time')
        return v

    @validator('algo_params')
    def validate_algo_params(cls, v, values):
        if not v:
            return {}

        algo_type = values.get('algo_type')

        # Validate TWAP parameters
        if algo_type == AlgorithmType.TWAP:
            if 'slice_count' in v and (v['slice_count'] < 1 or v['slice_count'] > 1000):
                raise ValueError('TWAP slice_count must be between 1 and 1000')
            if 'randomization_factor' in v and (v['randomization_factor'] < 0 or v['randomization_factor'] > 0.5):
                raise ValueError('TWAP randomization_factor must be between 0 and 0.5')

        # Validate VWAP parameters
        elif algo_type == AlgorithmType.VWAP:
            if 'target_participation_rate' in v and (v['target_participation_rate'] < 0.01 or v['target_participation_rate'] > 0.50):
                raise ValueError('VWAP target_participation_rate must be between 1% and 50%')

        # Validate POV parameters
        elif algo_type == AlgorithmType.POV:
            if 'target_participation_rate' in v and (v['target_participation_rate'] < 0.01 or v['target_participation_rate'] > 0.30):
                raise ValueError('POV target_participation_rate must be between 1% and 30%')
            if 'volume_surge_threshold' in v and v['volume_surge_threshold'] < 1.0:
                raise ValueError('POV volume_surge_threshold must be >= 1.0')

        return v

class RoutingRequest(BaseModel):
    """Request model for smart order routing."""
    symbol: str = Field(..., min_length=1, max_length=10, description="Stock symbol")
    side: OrderSide = Field(..., description="Order side (BUY/SELL)")
    quantity: int = Field(..., gt=0, le=10000000, description="Quantity to route")

    order_type: Optional[str] = Field(default="MARKET", description="Order type")
    limit_price: Optional[Decimal] = Field(None, description="Limit price for LIMIT orders")

    constraints: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Routing constraints and preferences"
    )

    @validator('limit_price')
    def validate_limit_price(cls, v, values):
        if v is not None and v <= 0:
            raise ValueError('limit_price must be positive')
        return v

class SafetyValidationRequest(BaseModel):
    """Request model for order safety validation."""
    symbol: str = Field(..., min_length=1, max_length=10)
    side: OrderSide
    quantity: int = Field(..., gt=0, le=10000000)
    order_type: str = Field(default="MARKET")
    limit_price: Optional[Decimal] = None
    existing_position: Optional[int] = Field(default=0, description="Current position size")

# Response Models

class ExecutionSliceResponse(BaseModel):
    """Response model for execution slice information."""
    slice_id: int
    quantity: int
    execute_at: datetime
    order_type: str
    price_limit: Optional[Decimal]
    participation_rate: Optional[float]
    venue_id: Optional[str]

class AlgorithmResponse(BaseModel):
    """Response model for algorithm execution status."""
    algo_id: str
    status: ExecutionStatus
    symbol: str
    total_quantity: int
    executed_quantity: int
    remaining_quantity: int

    avg_fill_price: Optional[Decimal] = None
    total_fees: Optional[Decimal] = None

    schedule_count: int
    estimated_completion: Optional[datetime] = None

    execution_slices: Optional[List[ExecutionSliceResponse]] = None
    safety_warnings: List[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class RoutingDecisionResponse(BaseModel):
    """Response model for individual routing decision."""
    venue_id: str
    quantity: int
    order_type: str
    price_limit: Optional[Decimal]
    expected_fill_rate: float
    expected_cost_bps: float
    routing_reason: str

class RoutingResponse(BaseModel):
    """Response model for order routing result."""
    order_id: str
    routing_decisions: List[RoutingDecisionResponse]
    execution_summary: Dict[str, Any]

    total_expected_cost_bps: Optional[float] = None
    estimated_completion_time: Optional[datetime] = None

    timestamp: datetime = Field(default_factory=datetime.now)

class VenueStatsResponse(BaseModel):
    """Response model for venue statistics."""
    venue_id: str
    venue_name: str
    venue_type: str

    # Execution quality metrics
    fill_rate: float = Field(..., ge=0.0, le=1.0)
    avg_fill_time_ms: float = Field(..., ge=0.0)
    price_improvement_bps: float

    # Market data quality
    spread_bps: float = Field(..., ge=0.0)
    depth_shares: int = Field(..., ge=0)

    # Fees and costs
    maker_fee_bps: float
    taker_fee_bps: float = Field(..., ge=0.0)

    # Connectivity and reliability
    connectivity_score: float = Field(..., ge=0.0, le=1.0)
    latency_ms: float = Field(..., ge=0.0)
    uptime_pct: float = Field(..., ge=0.0, le=100.0)

    last_update: datetime

class ExecutionReportResponse(BaseModel):
    """Response model for detailed execution report."""
    order_id: str
    symbol: str
    side: str

    original_quantity: int
    filled_quantity: int
    remaining_quantity: int

    avg_fill_price: Decimal
    total_fees: Decimal

    venues_used: List[str]
    execution_time_ms: float
    price_improvement_bps: float

    status: str

    fill_details: Optional[List[Dict[str, Any]]] = None
    performance_metrics: Optional[Dict[str, float]] = None

    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None

class SafetyValidationResponse(BaseModel):
    """Response model for safety validation results."""
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

    recommended_adjustments: Dict[str, Any] = Field(default_factory=dict)
    risk_score: float = Field(..., ge=0.0, le=10.0)

    validation_timestamp: datetime

class MarketImpactEstimate(BaseModel):
    """Response model for market impact estimation."""
    symbol: str
    quantity: int
    side: OrderSide

    estimated_impact_bps: float
    confidence_interval: Dict[str, float]  # 'lower' and 'upper' bounds

    timing_risk_bps: float
    liquidity_risk_bps: float
    total_cost_estimate_bps: float

    recommendations: List[str] = Field(default_factory=list)

class PerformanceAnalytics(BaseModel):
    """Response model for execution performance analytics."""
    time_period: str  # e.g., "1D", "1W", "1M"

    total_orders: int
    total_volume: int
    total_notional: Decimal

    avg_fill_rate: float
    avg_execution_time_ms: float
    avg_price_improvement_bps: float
    avg_total_cost_bps: float

    venue_performance: Dict[str, Dict[str, float]]
    algorithm_performance: Dict[str, Dict[str, float]]

    best_execution_compliance: float  # Percentage of orders meeting best execution

    period_start: datetime
    period_end: datetime

# Simulation and Backtesting Models

class SimulationRequest(BaseModel):
    """Request model for algorithm simulation."""
    algorithm_config: AlgorithmRequest
    market_scenario: str  # "NORMAL", "VOLATILE", "TRENDING", "RANGE_BOUND"

    start_date: datetime
    end_date: datetime

    initial_price: Decimal
    volatility: float = Field(..., gt=0.0, le=2.0)
    trend: float = Field(default=0.0, ge=-0.5, le=0.5)  # Daily drift

    volume_pattern: str = Field(default="NORMAL")  # "LOW", "NORMAL", "HIGH"

    simulation_params: Optional[Dict[str, Any]] = Field(default_factory=dict)

class SimulationResponse(BaseModel):
    """Response model for simulation results."""
    simulation_id: str

    algorithm_performance: Dict[str, float]
    benchmark_performance: Dict[str, float]

    total_cost_bps: float
    market_impact_bps: float
    timing_cost_bps: float

    execution_timeline: List[Dict[str, Any]]
    price_path: List[Dict[str, Any]]  # Time series of prices

    risk_metrics: Dict[str, float]
    completion_rate: float

    simulation_timestamp: datetime

# Webhook and Event Models

class ExecutionEvent(BaseModel):
    """Model for execution events."""
    event_type: str  # "SLICE_EXECUTED", "ALGO_COMPLETED", "ORDER_FILLED", etc.
    algo_id: str
    order_id: Optional[str] = None

    symbol: str
    event_data: Dict[str, Any]

    timestamp: datetime = Field(default_factory=datetime.now)

class WebhookConfig(BaseModel):
    """Configuration for execution webhooks."""
    webhook_url: str = Field(..., pattern=r'^https?://.+')
    event_types: List[str]

    authentication: Optional[Dict[str, str]] = None
    retry_config: Optional[Dict[str, int]] = None

    active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)