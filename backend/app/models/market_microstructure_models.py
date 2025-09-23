"""
Market Microstructure Models for TurtleTrading Simulation Engine

Comprehensive data models for market microstructure simulation including
order books, execution dynamics, liquidity modeling, and venue characteristics.
"""

from enum import Enum
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
from pydantic import BaseModel, Field, validator
from decimal import Decimal
import uuid


class OrderSide(str, Enum):
    """Order side"""
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    """Order types"""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    ICEBERG = "iceberg"
    HIDDEN = "hidden"
    PEGGED = "pegged"
    TWAP = "twap"
    VWAP = "vwap"


class OrderStatus(str, Enum):
    """Order status"""
    PENDING = "pending"
    OPEN = "open"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELED = "canceled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class VenueType(str, Enum):
    """Trading venue types"""
    EXCHANGE = "exchange"
    DARK_POOL = "dark_pool"
    ECN = "ecn"
    MARKET_MAKER = "market_maker"
    CROSSING_NETWORK = "crossing_network"
    RETAIL_BROKER = "retail_broker"


class ParticipantType(str, Enum):
    """Market participant types"""
    RETAIL = "retail"
    INSTITUTIONAL = "institutional"
    HIGH_FREQUENCY = "high_frequency"
    MARKET_MAKER = "market_maker"
    ARBITRAGEUR = "arbitrageur"
    MOMENTUM_TRADER = "momentum_trader"
    MEAN_REVERSION = "mean_reversion"


class LiquidityProvider(str, Enum):
    """Liquidity provider types"""
    DESIGNATED_MARKET_MAKER = "dmm"
    SUPPLEMENTAL_LIQUIDITY_PROVIDER = "slp"
    ELECTRONIC_MARKET_MAKER = "emm"
    RETAIL_MARKET_MAKER = "rmm"
    INSTITUTIONAL_LIQUIDITY = "institutional"


class MarketRegime(str, Enum):
    """Market regime types"""
    NORMAL = "normal"
    VOLATILE = "volatile"
    TRENDING = "trending"
    RANGING = "ranging"
    STRESS = "stress"
    PRE_MARKET = "pre_market"
    POST_MARKET = "post_market"
    OPENING = "opening"
    CLOSING = "closing"


class ExecutionAlgorithm(str, Enum):
    """Execution algorithm types"""
    AGGRESSIVE = "aggressive"
    PASSIVE = "passive"
    TWAP = "twap"
    VWAP = "vwap"
    IMPLEMENTATION_SHORTFALL = "implementation_shortfall"
    PARTICIPATION_RATE = "participation_rate"
    ICEBERG = "iceberg"
    SNIPER = "sniper"


class PriceLevel(BaseModel):
    """Order book price level"""
    price: Decimal = Field(decimal_places=4)
    quantity: int
    order_count: int = 1

    # Market microstructure details
    average_order_size: Decimal = Field(decimal_places=2)
    last_update_time: datetime = Field(default_factory=datetime.utcnow)

    # Provider information
    liquidity_providers: List[LiquidityProvider] = Field(default_factory=list)
    hidden_quantity: int = 0
    iceberg_quantity: int = 0

    # Dynamics
    refresh_rate: float = 0.0  # Orders per second
    cancel_rate: float = 0.0   # Cancellations per second

    @property
    def total_visible_quantity(self) -> int:
        """Total visible quantity at this level"""
        return self.quantity - self.hidden_quantity

    @property
    def total_liquidity(self) -> int:
        """Total liquidity including hidden"""
        return self.quantity + self.iceberg_quantity


class OrderBookLevel(BaseModel):
    """Enhanced order book level with microstructure details"""
    level: int  # Distance from mid (0 = best bid/offer)
    price: Decimal = Field(decimal_places=4)
    quantity: int
    order_count: int

    # Microstructure metrics
    average_order_size: Decimal = Field(decimal_places=2)
    liquidity_score: float = Field(ge=0.0, le=1.0)
    stability_score: float = Field(ge=0.0, le=1.0)

    # Provider mix
    retail_percentage: float = Field(ge=0.0, le=1.0)
    institutional_percentage: float = Field(ge=0.0, le=1.0)
    hft_percentage: float = Field(ge=0.0, le=1.0)

    # Timing metrics
    last_refresh: datetime = Field(default_factory=datetime.utcnow)
    average_lifetime_ms: float = 0.0

    # Hidden liquidity
    estimated_hidden_quantity: int = 0
    iceberg_indicator: bool = False


class OrderBook(BaseModel):
    """Complete order book with microstructure details"""
    symbol: str
    venue: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Price levels
    bids: List[OrderBookLevel] = Field(default_factory=list)
    asks: List[OrderBookLevel] = Field(default_factory=list)

    # Market data
    last_trade_price: Decimal = Field(decimal_places=4)
    last_trade_quantity: int
    last_trade_time: datetime = Field(default_factory=datetime.utcnow)

    # Spread metrics
    bid_price: Decimal = Field(decimal_places=4)
    ask_price: Decimal = Field(decimal_places=4)
    spread_bps: Decimal = Field(decimal_places=2)
    mid_price: Decimal = Field(decimal_places=4)

    # Depth metrics
    bid_depth_5: int = 0  # Quantity in top 5 levels
    ask_depth_5: int = 0
    bid_depth_10: int = 0
    ask_depth_10: int = 0

    # Microstructure indicators
    order_flow_imbalance: float = Field(ge=-1.0, le=1.0)
    effective_spread_bps: Decimal = Field(decimal_places=2)
    realized_spread_bps: Decimal = Field(decimal_places=2)
    price_impact_bps: Decimal = Field(decimal_places=2)

    # Liquidity metrics
    total_bid_liquidity: int = 0
    total_ask_liquidity: int = 0
    estimated_hidden_liquidity_ratio: float = Field(ge=0.0, le=1.0)

    # Market structure
    tick_size: Decimal = Field(decimal_places=6)
    lot_size: int = 1

    @property
    def spread_dollars(self) -> Decimal:
        """Spread in dollars"""
        return self.ask_price - self.bid_price

    @property
    def mid_price_calculated(self) -> Decimal:
        """Calculated mid price"""
        return (self.bid_price + self.ask_price) / 2

    @property
    def total_depth(self) -> int:
        """Total depth on both sides"""
        return self.total_bid_liquidity + self.total_ask_liquidity


class MarketOrder(BaseModel):
    """Market order with microstructure simulation details"""
    order_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: int

    # Limit order fields
    limit_price: Optional[Decimal] = Field(None, decimal_places=4)
    stop_price: Optional[Decimal] = Field(None, decimal_places=4)

    # Order management
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: int = 0
    remaining_quantity: int
    average_fill_price: Decimal = Field(default=Decimal('0'), decimal_places=4)

    # Timing
    created_time: datetime = Field(default_factory=datetime.utcnow)
    submission_time: Optional[datetime] = None
    first_fill_time: Optional[datetime] = None
    last_fill_time: Optional[datetime] = None

    # Participant details
    participant_type: ParticipantType
    venue: str

    # Algorithm details
    execution_algorithm: Optional[ExecutionAlgorithm] = None
    parent_order_id: Optional[str] = None  # For child orders

    # Advanced order features
    time_in_force: str = "DAY"  # DAY, GTC, IOC, FOK
    minimum_quantity: Optional[int] = None
    display_quantity: Optional[int] = None  # For iceberg orders
    hidden_quantity: Optional[int] = None

    # Execution parameters
    urgency_score: float = Field(default=0.5, ge=0.0, le=1.0)
    max_participation_rate: Optional[float] = None  # For TWAP/VWAP
    target_strategy: Optional[str] = None

    # Latency simulation
    network_latency_ms: float = 0.0
    processing_latency_ms: float = 0.0
    queue_position: Optional[int] = None

    # Market impact
    expected_market_impact_bps: float = 0.0
    realized_market_impact_bps: float = 0.0

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def __init__(self, **data):
        super().__init__(**data)
        if self.remaining_quantity is None:
            self.remaining_quantity = self.quantity

    @property
    def is_filled(self) -> bool:
        """Check if order is completely filled"""
        return self.filled_quantity >= self.quantity

    @property
    def fill_percentage(self) -> float:
        """Fill percentage"""
        return (self.filled_quantity / self.quantity) * 100 if self.quantity > 0 else 0


class OrderExecution(BaseModel):
    """Order execution details"""
    execution_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    symbol: str
    side: OrderSide

    # Execution details
    executed_quantity: int
    execution_price: Decimal = Field(decimal_places=4)
    execution_time: datetime = Field(default_factory=datetime.utcnow)
    venue: str

    # Market context
    bid_price_at_execution: Decimal = Field(decimal_places=4)
    ask_price_at_execution: Decimal = Field(decimal_places=4)
    mid_price_at_execution: Decimal = Field(decimal_places=4)
    spread_at_execution: Decimal = Field(decimal_places=4)

    # Execution quality metrics
    price_improvement_bps: Decimal = Field(default=Decimal('0'), decimal_places=2)
    effective_spread_bps: Decimal = Field(decimal_places=2)
    realized_spread_bps: Decimal = Field(decimal_places=2)
    market_impact_bps: Decimal = Field(decimal_places=2)

    # Counterparty information
    counterparty_type: Optional[ParticipantType] = None
    liquidity_flag: str = "added"  # added, removed, routed

    # Venue characteristics
    venue_type: VenueType
    maker_taker_fee_bps: Decimal = Field(decimal_places=3)

    # Latency metrics
    order_to_execution_latency_ms: float = 0.0
    market_data_latency_ms: float = 0.0

    # Quality indicators
    execution_quality_score: float = Field(ge=0.0, le=1.0)
    information_leakage_score: float = Field(ge=0.0, le=1.0)


class VenueCharacteristics(BaseModel):
    """Trading venue characteristics for simulation"""
    venue_id: str
    venue_name: str
    venue_type: VenueType

    # Basic parameters
    tick_size: Decimal = Field(decimal_places=6)
    lot_size: int = 1

    # Latency characteristics
    base_latency_ms: float = 1.0
    latency_variance_ms: float = 0.5
    queue_processing_rate: float = 1000.0  # orders per second

    # Fees
    maker_fee_bps: Decimal = Field(decimal_places=3)
    taker_fee_bps: Decimal = Field(decimal_places=3)

    # Liquidity characteristics
    average_spread_bps: Decimal = Field(decimal_places=2)
    depth_multiplier: float = 1.0
    hidden_liquidity_ratio: float = Field(ge=0.0, le=1.0, default=0.1)

    # Participant mix
    retail_flow_percentage: float = Field(ge=0.0, le=1.0)
    institutional_flow_percentage: float = Field(ge=0.0, le=1.0)
    hft_flow_percentage: float = Field(ge=0.0, le=1.0)

    # Market making
    designated_market_makers: List[str] = Field(default_factory=list)
    market_maker_rebate_bps: Decimal = Field(decimal_places=3)

    # Operating hours
    market_open_time: str = "09:30"
    market_close_time: str = "16:00"
    pre_market_start: str = "04:00"
    post_market_end: str = "20:00"

    # Special features
    supports_hidden_orders: bool = True
    supports_iceberg_orders: bool = True
    supports_stop_orders: bool = True
    minimum_order_size: int = 1
    maximum_order_size: Optional[int] = None

    # Dark pool specific
    minimum_block_size: Optional[int] = None
    crossing_frequency_ms: Optional[int] = None
    price_improvement_algorithm: Optional[str] = None


class MarketImpactParameters(BaseModel):
    """Market impact model parameters"""
    symbol: str

    # Linear impact parameters
    temporary_impact_coefficient: float = 0.1
    permanent_impact_coefficient: float = 0.05

    # Square-root law parameters
    participation_rate_exponent: float = 0.5
    volume_exponent: float = 0.5
    volatility_scaling: float = 1.0

    # Liquidity metrics
    average_daily_volume: int
    average_trade_size: int
    bid_ask_spread_bps: Decimal = Field(decimal_places=2)

    # Time decay
    impact_decay_half_life_minutes: float = 5.0

    # Regime-dependent parameters
    stress_impact_multiplier: float = 2.0
    low_liquidity_threshold: float = 0.1  # Fraction of ADV

    # Cross-impact
    beta_correlation: float = 0.0  # Market beta for cross-impact


class LiquidityDynamics(BaseModel):
    """Liquidity dynamics model"""
    symbol: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Current liquidity state
    bid_liquidity_depth: List[int] = Field(default_factory=list)  # By level
    ask_liquidity_depth: List[int] = Field(default_factory=list)

    # Liquidity arrival rates (Poisson processes)
    bid_arrival_rate: float = 10.0  # orders per minute
    ask_arrival_rate: float = 10.0
    cancellation_rate: float = 5.0  # cancellations per minute

    # Size distributions
    order_size_mean: float = 100.0
    order_size_std: float = 50.0
    large_order_threshold: int = 1000
    large_order_probability: float = 0.05

    # Clustering effects
    liquidity_clustering_parameter: float = 0.3
    informed_trading_probability: float = 0.1

    # Market maker behavior
    market_maker_spread_target_bps: Decimal = Field(decimal_places=2)
    market_maker_inventory_limit: int = 10000
    market_maker_refresh_rate: float = 50.0  # refreshes per minute

    # Regime effects
    current_regime: MarketRegime = MarketRegime.NORMAL
    volatility_multiplier: float = 1.0

    # Intraday patterns
    time_of_day_multiplier: float = 1.0
    day_of_week_multiplier: float = 1.0


class SimulationParameters(BaseModel):
    """Market microstructure simulation parameters"""
    simulation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Time parameters
    start_time: datetime
    end_time: datetime
    time_step_ms: int = 100  # Simulation time step

    # Market parameters
    symbols: List[str]
    venues: List[str]
    initial_prices: Dict[str, Decimal]

    # Participant configuration
    participant_counts: Dict[ParticipantType, int]
    participant_capital: Dict[ParticipantType, Decimal]

    # Order flow parameters
    base_order_rate: float = 100.0  # orders per minute
    market_order_ratio: float = 0.3
    large_order_probability: float = 0.05

    # Market structure
    tick_sizes: Dict[str, Decimal]
    lot_sizes: Dict[str, int]

    # Scenario parameters
    market_regime: MarketRegime = MarketRegime.NORMAL
    volatility_scaling: float = 1.0
    liquidity_scaling: float = 1.0

    # News/event simulation
    news_event_probability: float = 0.01  # per minute
    news_impact_magnitude: float = 0.02  # price impact

    # Random seed for reproducibility
    random_seed: Optional[int] = None

    # Output configuration
    record_order_book_snapshots: bool = True
    snapshot_frequency_ms: int = 1000
    record_all_executions: bool = True
    calculate_analytics: bool = True


class SimulationState(BaseModel):
    """Current state of market simulation"""
    simulation_id: str
    current_time: datetime

    # Order books by venue and symbol
    order_books: Dict[str, Dict[str, OrderBook]] = Field(default_factory=dict)

    # Active orders
    active_orders: Dict[str, MarketOrder] = Field(default_factory=dict)

    # Execution history
    executions: List[OrderExecution] = Field(default_factory=list)

    # Market participant states
    participant_inventories: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    participant_cash: Dict[str, Decimal] = Field(default_factory=dict)

    # Liquidity dynamics
    liquidity_states: Dict[str, LiquidityDynamics] = Field(default_factory=dict)

    # Market statistics
    total_volume: Dict[str, int] = Field(default_factory=dict)
    total_trades: Dict[str, int] = Field(default_factory=dict)
    vwap: Dict[str, Decimal] = Field(default_factory=dict)

    # Performance metrics
    simulation_speed_ratio: float = 1.0  # Real-time speed multiplier
    events_processed: int = 0

    # State flags
    is_running: bool = False
    is_paused: bool = False
    has_errors: bool = False


class MicrostructureAnalytics(BaseModel):
    """Analytics from microstructure simulation"""
    simulation_id: str
    symbol: str
    analysis_period_start: datetime
    analysis_period_end: datetime

    # Execution quality metrics
    average_effective_spread_bps: Decimal = Field(decimal_places=2)
    average_realized_spread_bps: Decimal = Field(decimal_places=2)
    average_price_impact_bps: Decimal = Field(decimal_places=2)

    # Liquidity metrics
    average_bid_ask_spread_bps: Decimal = Field(decimal_places=2)
    average_depth_dollars: Decimal = Field(decimal_places=2)
    liquidity_resilience_score: float = Field(ge=0.0, le=1.0)

    # Order flow analysis
    order_flow_imbalance_mean: float
    order_flow_imbalance_std: float
    informed_trading_probability: float

    # Market impact analysis
    temporary_impact_coefficient: float
    permanent_impact_coefficient: float
    impact_decay_half_life_minutes: float

    # Venue analysis
    venue_market_share: Dict[str, float] = Field(default_factory=dict)
    venue_execution_quality: Dict[str, float] = Field(default_factory=dict)

    # Participant analysis
    participant_pnl: Dict[ParticipantType, Decimal] = Field(default_factory=dict)
    participant_execution_quality: Dict[ParticipantType, float] = Field(default_factory=dict)

    # Timing analysis
    average_execution_latency_ms: float
    latency_percentiles: Dict[str, float] = Field(default_factory=dict)  # P50, P95, P99

    # Market structure efficiency
    price_discovery_efficiency: float = Field(ge=0.0, le=1.0)
    arbitrage_opportunity_frequency: float
    market_fragmentation_index: float


class SimulationEvent(BaseModel):
    """Simulation event for event-driven processing"""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str  # order_arrival, order_cancel, trade, market_data_update
    timestamp: datetime
    priority: int = 0  # Higher number = higher priority

    # Event data
    symbol: Optional[str] = None
    venue: Optional[str] = None
    participant_id: Optional[str] = None
    order_id: Optional[str] = None

    # Event-specific data
    data: Dict[str, Any] = Field(default_factory=dict)

    # Processing status
    processed: bool = False
    processing_time_ns: Optional[int] = None


class LatencyModel(BaseModel):
    """Latency modeling for realistic execution simulation"""
    venue: str

    # Network latency components
    base_network_latency_ms: float = 0.5
    network_jitter_ms: float = 0.1

    # Processing latency
    order_processing_latency_ms: float = 0.1
    market_data_processing_latency_ms: float = 0.05

    # Queue delays
    average_queue_depth: float = 10.0
    processing_rate_per_second: float = 10000.0

    # Congestion model
    congestion_threshold: float = 0.8  # Queue utilization
    congestion_multiplier: float = 3.0

    # Time-of-day effects
    peak_hour_multiplier: float = 1.5
    off_hours_multiplier: float = 0.7

    # Participant-specific latency
    retail_latency_penalty_ms: float = 5.0
    institutional_latency_advantage_ms: float = -2.0
    hft_latency_advantage_ms: float = -0.5


class SlippageModel(BaseModel):
    """Slippage modeling for order execution"""
    symbol: str

    # Market impact parameters
    linear_impact_coefficient: float = 0.1
    square_root_impact_coefficient: float = 0.05

    # Temporary vs permanent impact
    temporary_impact_ratio: float = 0.6
    impact_decay_rate: float = 0.1  # per minute

    # Size-dependent slippage
    small_order_threshold: int = 100
    large_order_threshold: int = 10000
    large_order_impact_multiplier: float = 2.0

    # Urgency-dependent slippage
    aggressive_execution_multiplier: float = 1.5
    passive_execution_multiplier: float = 0.8

    # Market condition effects
    volatility_scaling: float = 1.0
    liquidity_scaling: float = 1.0

    # Cross-venue effects
    venue_liquidity_ranking: Dict[str, float] = Field(default_factory=dict)
    smart_routing_benefit: float = 0.1  # Slippage reduction from smart routing