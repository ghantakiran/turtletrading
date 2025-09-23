"""
TA-Lib Indicator Lab Models and Schemas

This module defines comprehensive models for the TA-Lib indicator laboratory including:
- Indicator definitions with parameters and metadata
- Computation graph nodes and edges
- Parameter sweep configurations
- Preset management and export schemas
- Multi-timeframe analysis structures
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Any, Union, Literal
from enum import Enum
from pydantic import BaseModel, Field, validator, root_validator
import uuid


class IndicatorCategory(str, Enum):
    """Categories of technical indicators"""
    OVERLAP = "overlap"              # Moving averages, bands
    MOMENTUM = "momentum"            # RSI, MACD, Stochastic
    VOLUME = "volume"               # OBV, A/D Line, Volume SMA
    VOLATILITY = "volatility"       # ATR, Bollinger Bands width
    PRICE_TRANSFORM = "price_transform"  # Typical price, weighted close
    CYCLE = "cycle"                 # Dominant cycle, cycle period
    PATTERN = "pattern"             # Candlestick patterns
    STATISTIC = "statistic"         # Linear regression, correlation


class DataType(str, Enum):
    """Data types for indicator inputs and outputs"""
    PRICE = "price"           # OHLC price data
    VOLUME = "volume"         # Volume data
    INDICATOR = "indicator"   # Output from another indicator
    CONSTANT = "constant"     # Fixed numeric value
    SERIES = "series"        # Time series data


class ParameterType(str, Enum):
    """Types of indicator parameters"""
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    STRING = "string"
    ENUM = "enum"
    PRICE_FIELD = "price_field"  # open, high, low, close, volume


class TimeFrame(str, Enum):
    """Supported timeframes for analysis"""
    MINUTE_1 = "1m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"


class IndicatorParameter(BaseModel):
    """Definition of an indicator parameter"""
    name: str = Field(..., description="Parameter name")
    display_name: str = Field(..., description="Human-readable parameter name")
    parameter_type: ParameterType = Field(..., description="Type of parameter")
    default_value: Any = Field(..., description="Default parameter value")
    min_value: Optional[Union[int, float]] = Field(None, description="Minimum allowed value")
    max_value: Optional[Union[int, float]] = Field(None, description="Maximum allowed value")
    allowed_values: Optional[List[Any]] = Field(None, description="Allowed values for enum types")
    description: str = Field(..., description="Parameter description")
    is_required: bool = Field(True, description="Whether parameter is required")
    step: Optional[Union[int, float]] = Field(None, description="Step size for numeric parameters")

    @validator('default_value')
    def validate_default_value(cls, v, values):
        """Validate default value matches parameter type"""
        param_type = values.get('parameter_type')
        if param_type == ParameterType.INTEGER and not isinstance(v, int):
            raise ValueError("Default value must be integer for INTEGER parameter type")
        elif param_type == ParameterType.FLOAT and not isinstance(v, (int, float)):
            raise ValueError("Default value must be numeric for FLOAT parameter type")
        elif param_type == ParameterType.BOOLEAN and not isinstance(v, bool):
            raise ValueError("Default value must be boolean for BOOLEAN parameter type")
        return v


class IndicatorOutput(BaseModel):
    """Definition of an indicator output"""
    name: str = Field(..., description="Output name")
    display_name: str = Field(..., description="Human-readable output name")
    data_type: DataType = Field(..., description="Type of output data")
    description: str = Field(..., description="Output description")
    is_primary: bool = Field(False, description="Whether this is the primary output")


class IndicatorDefinition(BaseModel):
    """Complete definition of a technical indicator"""
    indicator_id: str = Field(..., description="Unique identifier for the indicator")
    name: str = Field(..., description="Indicator name")
    display_name: str = Field(..., description="Human-readable indicator name")
    category: IndicatorCategory = Field(..., description="Indicator category")
    description: str = Field(..., description="Detailed indicator description")

    # TA-Lib function information
    talib_function: str = Field(..., description="TA-Lib function name")
    talib_group: str = Field(..., description="TA-Lib function group")

    # Parameters and outputs
    parameters: List[IndicatorParameter] = Field(default_factory=list, description="Indicator parameters")
    outputs: List[IndicatorOutput] = Field(..., description="Indicator outputs")

    # Requirements
    min_periods: int = Field(..., description="Minimum periods required for calculation")
    lookback_period: int = Field(..., description="Lookback period for calculation")

    # Metadata
    is_overlay: bool = Field(False, description="Whether indicator overlays on price chart")
    has_boundaries: bool = Field(False, description="Whether indicator has fixed boundaries")
    boundary_lower: Optional[float] = Field(None, description="Lower boundary value")
    boundary_upper: Optional[float] = Field(None, description="Upper boundary value")

    # Documentation
    formula: Optional[str] = Field(None, description="Mathematical formula")
    interpretation: str = Field(..., description="How to interpret the indicator")
    typical_usage: str = Field(..., description="Typical usage scenarios")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DataConnection(BaseModel):
    """Defines a data connection between nodes or from market data"""
    source: str = Field(..., description="Source of the data (market_data or node_id)")
    field: str = Field(..., description="Field name (close, high, low, etc.)")
    transformation: Optional[str] = Field(None, description="Optional data transformation")

    class Config:
        schema_extra = {
            "example": {
                "source": "market_data",
                "field": "close",
                "transformation": None
            }
        }


class ComputationResult(BaseModel):
    """Result of an indicator computation"""
    node_id: str = Field(..., description="Node that produced this result")
    indicator_id: str = Field(..., description="Indicator that was computed")
    values: List[Optional[float]] = Field(..., description="Computed indicator values")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional result metadata")
    computation_time: float = Field(..., description="Time taken for computation in seconds")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When computation was performed")

    class Config:
        schema_extra = {
            "example": {
                "node_id": "rsi_node_1",
                "indicator_id": "RSI",
                "values": [None, None, 45.2, 52.8, 61.3],
                "metadata": {"period": 14, "source": "close"},
                "computation_time": 0.023,
                "timestamp": "2024-01-01T12:00:00Z"
            }
        }


class ComputationNode(BaseModel):
    """A node in the indicator computation graph"""
    node_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique node identifier")
    indicator_id: str = Field(..., description="Indicator definition ID")
    display_name: str = Field(..., description="Display name for this node")

    # Parameters with current values
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parameter values")

    # Data sources
    input_mappings: Dict[str, str] = Field(default_factory=dict, description="Input to source node mapping")

    # Positioning for visual editor
    position_x: float = Field(0.0, description="X position in visual editor")
    position_y: float = Field(0.0, description="Y position in visual editor")

    # Computation results cache
    cached_results: Optional[Dict[str, List[float]]] = Field(None, description="Cached computation results")
    cache_timestamp: Optional[datetime] = Field(None, description="When results were cached")

    # Metadata
    is_enabled: bool = Field(True, description="Whether node is enabled for computation")
    notes: Optional[str] = Field(None, description="User notes for this node")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class ComputationEdge(BaseModel):
    """An edge connecting computation nodes"""
    edge_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique edge identifier")
    source_node_id: str = Field(..., description="Source node ID")
    target_node_id: str = Field(..., description="Target node ID")
    source_output: str = Field(..., description="Source output name")
    target_input: str = Field(..., description="Target input name")

    # Visual properties
    is_highlighted: bool = Field(False, description="Whether edge is highlighted")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class ComputationGraph(BaseModel):
    """Complete indicator computation graph"""
    graph_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique graph identifier")
    name: str = Field(..., description="Graph name")
    description: Optional[str] = Field(None, description="Graph description")

    # Graph structure
    nodes: List[ComputationNode] = Field(default_factory=list, description="Computation nodes")
    edges: List[ComputationEdge] = Field(default_factory=list, description="Computation edges")

    # Input requirements
    required_data_fields: List[str] = Field(default_factory=list, description="Required input data fields")
    min_data_points: int = Field(50, description="Minimum data points required")

    # Computation settings
    parallel_execution: bool = Field(True, description="Enable parallel execution")
    cache_enabled: bool = Field(True, description="Enable result caching")
    cache_ttl_seconds: int = Field(300, description="Cache TTL in seconds")

    # Metadata
    is_template: bool = Field(False, description="Whether this is a template graph")
    template_category: Optional[str] = Field(None, description="Template category")
    tags: List[str] = Field(default_factory=list, description="Graph tags")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(None, description="User who created the graph")

    @validator('edges')
    def validate_edges(cls, v, values):
        """Validate that all edges reference existing nodes"""
        if 'nodes' not in values:
            return v

        node_ids = {node.node_id for node in values['nodes']}
        for edge in v:
            if edge.source_node_id not in node_ids:
                raise ValueError(f"Edge references non-existent source node: {edge.source_node_id}")
            if edge.target_node_id not in node_ids:
                raise ValueError(f"Edge references non-existent target node: {edge.target_node_id}")

        return v


class ParameterSweepRange(BaseModel):
    """Definition of parameter sweep range"""
    parameter_name: str = Field(..., description="Parameter to sweep")
    start_value: Union[int, float] = Field(..., description="Start value")
    end_value: Union[int, float] = Field(..., description="End value")
    step_size: Union[int, float] = Field(..., description="Step size")
    step_type: Literal["linear", "logarithmic"] = Field("linear", description="Step type")


class OptimizationObjective(BaseModel):
    """Optimization objective definition"""
    metric: str = Field(..., description="Metric to optimize")
    direction: Literal["maximize", "minimize"] = Field(..., description="Optimization direction")
    weight: float = Field(1.0, description="Weight for multi-objective optimization")
    target_value: Optional[float] = Field(None, description="Target value for metric")


class ParameterSweepConfig(BaseModel):
    """Configuration for parameter sweep analysis"""
    sweep_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique sweep identifier")
    name: str = Field(..., description="Sweep name")
    graph_id: str = Field(..., description="Graph to optimize")

    # Parameter ranges
    parameter_ranges: List[ParameterSweepRange] = Field(..., description="Parameters to sweep")

    # Optimization settings
    optimization_objectives: List[OptimizationObjective] = Field(..., description="Optimization objectives")
    max_iterations: int = Field(1000, description="Maximum iterations")
    convergence_threshold: float = Field(0.001, description="Convergence threshold")

    # Data settings
    training_start_date: datetime = Field(..., description="Training data start date")
    training_end_date: datetime = Field(..., description="Training data end date")
    validation_start_date: Optional[datetime] = Field(None, description="Validation data start date")
    validation_end_date: Optional[datetime] = Field(None, description="Validation data end date")

    # Execution settings
    parallel_jobs: int = Field(4, description="Number of parallel jobs")
    timeout_seconds: int = Field(3600, description="Timeout in seconds")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: Literal["pending", "running", "completed", "failed"] = Field("pending", description="Sweep status")


class ParameterSweepResult(BaseModel):
    """Result of parameter sweep optimization"""
    sweep_id: str = Field(..., description="Sweep identifier")
    iteration: int = Field(..., description="Iteration number")

    # Parameter values
    parameter_values: Dict[str, Union[int, float]] = Field(..., description="Parameter values tested")

    # Metrics
    objective_values: Dict[str, float] = Field(..., description="Objective metric values")
    combined_score: float = Field(..., description="Combined optimization score")

    # Performance metrics
    computation_time_ms: float = Field(..., description="Computation time in milliseconds")
    memory_usage_mb: float = Field(..., description="Memory usage in MB")

    # Validation results
    training_score: float = Field(..., description="Training data score")
    validation_score: Optional[float] = Field(None, description="Validation data score")
    overfitting_score: Optional[float] = Field(None, description="Overfitting metric")

    timestamp: datetime = Field(default_factory=datetime.utcnow)


class IndicatorPreset(BaseModel):
    """Predefined indicator configuration preset"""
    preset_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique preset identifier")
    name: str = Field(..., description="Preset name")
    description: str = Field(..., description="Preset description")
    category: str = Field(..., description="Preset category")

    # Graph definition
    computation_graph: ComputationGraph = Field(..., description="Computation graph")

    # Default parameters
    default_parameters: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Default parameters by node")

    # Usage metadata
    usage_count: int = Field(0, description="Number of times used")
    average_rating: float = Field(0.0, description="Average user rating")
    difficulty_level: Literal["beginner", "intermediate", "advanced"] = Field("beginner", description="Difficulty level")

    # Documentation
    use_cases: List[str] = Field(default_factory=list, description="Common use cases")
    market_conditions: List[str] = Field(default_factory=list, description="Suitable market conditions")
    risk_level: Literal["low", "medium", "high"] = Field("medium", description="Risk level")

    # Technical details
    timeframes: List[TimeFrame] = Field(default_factory=list, description="Recommended timeframes")
    asset_classes: List[str] = Field(default_factory=list, description="Suitable asset classes")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(None, description="Creator user ID")
    is_public: bool = Field(True, description="Whether preset is publicly available")


class MultiTimeFrameAnalysis(BaseModel):
    """Multi-timeframe analysis configuration"""
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique analysis identifier")
    symbol: str = Field(..., description="Stock symbol")

    # Timeframe configurations
    timeframes: List[TimeFrame] = Field(..., description="Timeframes to analyze")
    primary_timeframe: TimeFrame = Field(..., description="Primary timeframe for signals")

    # Graph configurations per timeframe
    timeframe_graphs: Dict[str, str] = Field(..., description="Graph ID for each timeframe")

    # Alignment settings
    align_signals: bool = Field(True, description="Whether to align signals across timeframes")
    confluence_required: int = Field(2, description="Number of timeframes required for confluence")

    # Weighting
    timeframe_weights: Dict[str, float] = Field(default_factory=dict, description="Weights for each timeframe")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class IndicatorSignal(BaseModel):
    """Signal generated by an indicator"""
    signal_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique signal identifier")
    node_id: str = Field(..., description="Node that generated the signal")
    indicator_name: str = Field(..., description="Indicator name")

    # Signal properties
    signal_type: Literal["buy", "sell", "hold", "warning"] = Field(..., description="Signal type")
    strength: float = Field(..., description="Signal strength (0-1)")
    confidence: float = Field(..., description="Signal confidence (0-1)")

    # Timing
    timestamp: datetime = Field(..., description="Signal timestamp")
    timeframe: TimeFrame = Field(..., description="Signal timeframe")

    # Values
    current_value: float = Field(..., description="Current indicator value")
    previous_value: Optional[float] = Field(None, description="Previous indicator value")
    trigger_condition: str = Field(..., description="Condition that triggered the signal")

    # Context
    price_at_signal: float = Field(..., description="Price when signal was generated")
    volume_at_signal: Optional[float] = Field(None, description="Volume when signal was generated")

    # Metadata
    notes: Optional[str] = Field(None, description="Signal notes")
    is_confirmed: bool = Field(False, description="Whether signal is confirmed")


class IndicatorBacktest(BaseModel):
    """Backtest results for indicator strategy"""
    backtest_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique backtest identifier")
    graph_id: str = Field(..., description="Graph used for backtest")
    symbol: str = Field(..., description="Symbol backtested")

    # Test period
    start_date: datetime = Field(..., description="Backtest start date")
    end_date: datetime = Field(..., description="Backtest end date")
    timeframe: TimeFrame = Field(..., description="Backtest timeframe")

    # Performance metrics
    total_return: float = Field(..., description="Total return percentage")
    annualized_return: float = Field(..., description="Annualized return percentage")
    volatility: float = Field(..., description="Strategy volatility")
    sharpe_ratio: float = Field(..., description="Sharpe ratio")
    max_drawdown: float = Field(..., description="Maximum drawdown percentage")

    # Trade statistics
    total_trades: int = Field(..., description="Total number of trades")
    winning_trades: int = Field(..., description="Number of winning trades")
    losing_trades: int = Field(..., description="Number of losing trades")
    win_rate: float = Field(..., description="Win rate percentage")
    average_win: float = Field(..., description="Average winning trade return")
    average_loss: float = Field(..., description="Average losing trade return")
    profit_factor: float = Field(..., description="Profit factor")

    # Risk metrics
    var_95: float = Field(..., description="95% Value at Risk")
    expected_shortfall: float = Field(..., description="Expected shortfall")
    calmar_ratio: float = Field(..., description="Calmar ratio")
    sortino_ratio: float = Field(..., description="Sortino ratio")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class IndicatorExport(BaseModel):
    """Export configuration for indicators"""
    export_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique export identifier")
    export_type: Literal["csv", "json", "excel", "pine_script", "mql", "python"] = Field(..., description="Export format")

    # Content selection
    include_graph: bool = Field(True, description="Include graph definition")
    include_data: bool = Field(True, description="Include computed data")
    include_signals: bool = Field(False, description="Include generated signals")
    include_backtest: bool = Field(False, description="Include backtest results")

    # Format options
    decimal_places: int = Field(4, description="Number of decimal places")
    date_format: str = Field("%Y-%m-%d %H:%M:%S", description="Date format string")
    timezone: str = Field("UTC", description="Timezone for timestamps")

    # Data range
    start_date: Optional[datetime] = Field(None, description="Export start date")
    end_date: Optional[datetime] = Field(None, description="Export end date")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    file_path: Optional[str] = Field(None, description="Path to exported file")
    file_size_bytes: Optional[int] = Field(None, description="Export file size")


class IndicatorLabSession(BaseModel):
    """User session in the indicator lab"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique session identifier")
    user_id: Optional[str] = Field(None, description="User identifier")

    # Current state
    active_graph_id: Optional[str] = Field(None, description="Currently active graph")
    selected_nodes: List[str] = Field(default_factory=list, description="Selected node IDs")
    clipboard_nodes: List[ComputationNode] = Field(default_factory=list, description="Clipboard nodes")

    # View state
    zoom_level: float = Field(1.0, description="Zoom level")
    pan_x: float = Field(0.0, description="Pan X offset")
    pan_y: float = Field(0.0, description="Pan Y offset")

    # Preferences
    auto_save_enabled: bool = Field(True, description="Auto-save enabled")
    auto_save_interval_seconds: int = Field(30, description="Auto-save interval")
    grid_snap_enabled: bool = Field(True, description="Grid snap enabled")
    show_parameter_tooltips: bool = Field(True, description="Show parameter tooltips")

    # Recent activity
    recent_graphs: List[str] = Field(default_factory=list, description="Recently opened graph IDs")
    recent_presets: List[str] = Field(default_factory=list, description="Recently used preset IDs")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)


# Request/Response models for API endpoints

class CreateGraphRequest(BaseModel):
    """Request to create a new computation graph"""
    name: str = Field(..., description="Graph name")
    description: Optional[str] = Field(None, description="Graph description")
    template_id: Optional[str] = Field(None, description="Template to copy from")


class UpdateGraphRequest(BaseModel):
    """Request to update a computation graph"""
    name: Optional[str] = Field(None, description="Updated graph name")
    description: Optional[str] = Field(None, description="Updated graph description")
    nodes: Optional[List[ComputationNode]] = Field(None, description="Updated nodes")
    edges: Optional[List[ComputationEdge]] = Field(None, description="Updated edges")


class ComputeGraphRequest(BaseModel):
    """Request to compute indicator values"""
    graph_id: str = Field(..., description="Graph to compute")
    symbol: str = Field(..., description="Stock symbol")
    timeframe: TimeFrame = Field(TimeFrame.DAY_1, description="Data timeframe")
    start_date: Optional[datetime] = Field(None, description="Start date for computation")
    end_date: Optional[datetime] = Field(None, description="End date for computation")
    force_refresh: bool = Field(False, description="Force refresh cached data")


class ComputeGraphResponse(BaseModel):
    """Response from graph computation"""
    graph_id: str = Field(..., description="Graph identifier")
    symbol: str = Field(..., description="Stock symbol")
    timeframe: TimeFrame = Field(..., description="Data timeframe")

    # Results
    node_results: Dict[str, Dict[str, List[float]]] = Field(..., description="Results by node and output")
    timestamps: List[datetime] = Field(..., description="Timestamps for data points")

    # Metadata
    computation_time_ms: float = Field(..., description="Computation time")
    cache_hit_ratio: float = Field(..., description="Cache hit ratio")
    data_points: int = Field(..., description="Number of data points")

    # Signals
    generated_signals: List[IndicatorSignal] = Field(default_factory=list, description="Generated signals")

    computed_at: datetime = Field(default_factory=datetime.utcnow)


class ListPresetsResponse(BaseModel):
    """Response for listing indicator presets"""
    presets: List[IndicatorPreset] = Field(..., description="Available presets")
    categories: List[str] = Field(..., description="Available categories")
    total_count: int = Field(..., description="Total number of presets")


class IndicatorSearchRequest(BaseModel):
    """Request to search indicators"""
    query: Optional[str] = Field(None, description="Search query")
    category: Optional[IndicatorCategory] = Field(None, description="Filter by category")
    is_overlay: Optional[bool] = Field(None, description="Filter by overlay status")
    min_periods: Optional[int] = Field(None, description="Maximum minimum periods")


class IndicatorSearchResponse(BaseModel):
    """Response for indicator search"""
    indicators: List[IndicatorDefinition] = Field(..., description="Matching indicators")
    total_count: int = Field(..., description="Total number of matches")
    categories: List[str] = Field(..., description="Available categories")
    search_time_ms: float = Field(..., description="Search time in milliseconds")