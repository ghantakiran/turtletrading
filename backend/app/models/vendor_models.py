"""
Data Vendor Models and Schemas

Comprehensive models for vendor orchestration including vendor registry,
health monitoring, cost tracking, and request routing.
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from datetime import datetime, timedelta
import uuid


class VendorType(str, Enum):
    """Types of data vendors."""
    MARKET_DATA = "market_data"
    NEWS = "news"
    FUNDAMENTAL = "fundamental"
    ALTERNATIVE = "alternative"
    CRYPTO = "crypto"


class VendorTier(str, Enum):
    """Vendor pricing tiers."""
    FREE = "free"
    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class VendorStatus(str, Enum):
    """Vendor operational status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    MAINTENANCE = "maintenance"
    DISABLED = "disabled"


class RequestType(str, Enum):
    """Types of data requests."""
    QUOTE = "quote"
    HISTORICAL = "historical"
    INTRADAY = "intraday"
    NEWS = "news"
    FUNDAMENTALS = "fundamentals"
    OPTIONS = "options"
    CRYPTO = "crypto"


class RoutingStrategy(str, Enum):
    """Request routing strategies."""
    COST_OPTIMIZED = "cost_optimized"
    LATENCY_OPTIMIZED = "latency_optimized"
    QUALITY_OPTIMIZED = "quality_optimized"
    ROUND_ROBIN = "round_robin"
    WEIGHTED = "weighted"
    CANARY = "canary"


class CircuitBreakerState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


# Core Vendor Models
class VendorCredentials(BaseModel):
    """Vendor API credentials (encrypted storage)."""
    vendor_id: str
    api_key: Optional[str] = None
    secret_key: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    additional_params: Dict[str, str] = Field(default_factory=dict)
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class VendorQuota(BaseModel):
    """Vendor usage quotas and limits."""
    vendor_id: str
    request_type: RequestType
    daily_limit: int = Field(ge=0)
    monthly_limit: int = Field(ge=0)
    requests_per_minute: int = Field(ge=1)
    requests_per_second: int = Field(ge=1)
    concurrent_requests: int = Field(ge=1, le=100)

    # Current usage
    daily_used: int = Field(default=0, ge=0)
    monthly_used: int = Field(default=0, ge=0)
    last_reset_daily: datetime = Field(default_factory=datetime.utcnow)
    last_reset_monthly: datetime = Field(default_factory=datetime.utcnow)

    @validator('daily_used')
    def daily_used_not_exceed_limit(cls, v, values):
        if 'daily_limit' in values and v > values['daily_limit']:
            raise ValueError('Daily usage cannot exceed daily limit')
        return v


class VendorPricing(BaseModel):
    """Vendor cost structure."""
    vendor_id: str
    tier: VendorTier
    base_cost_per_month: float = Field(ge=0)
    cost_per_request: Dict[RequestType, float] = Field(default_factory=dict)
    overage_cost_per_request: Dict[RequestType, float] = Field(default_factory=dict)
    free_tier_limits: Dict[RequestType, int] = Field(default_factory=dict)
    billing_cycle_start: datetime = Field(default_factory=datetime.utcnow)


class VendorSLA(BaseModel):
    """Vendor Service Level Agreement metrics."""
    vendor_id: str
    uptime_guarantee: float = Field(ge=0.0, le=100.0)  # Percentage
    max_latency_ms: int = Field(ge=0)
    error_rate_threshold: float = Field(ge=0.0, le=100.0)  # Percentage
    data_freshness_seconds: int = Field(ge=0)
    support_response_hours: int = Field(ge=0)


class VendorCapabilities(BaseModel):
    """Vendor data capabilities and features."""
    vendor_id: str
    supported_request_types: List[RequestType]
    supported_symbols: List[str] = Field(default_factory=list)  # Empty = all
    supported_exchanges: List[str] = Field(default_factory=list)
    real_time_data: bool = False
    historical_data_years: int = Field(ge=0, default=1)
    intraday_intervals: List[str] = Field(default_factory=list)  # 1m, 5m, 1h, etc.
    options_data: bool = False
    crypto_support: bool = False
    news_categories: List[str] = Field(default_factory=list)
    fundamental_metrics: List[str] = Field(default_factory=list)


class VendorRegistry(BaseModel):
    """Complete vendor registration and metadata."""
    vendor_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    display_name: str
    vendor_type: VendorType
    base_url: str
    documentation_url: Optional[str] = None
    status: VendorStatus = VendorStatus.HEALTHY

    # Configuration
    credentials: VendorCredentials
    quotas: List[VendorQuota]
    pricing: VendorPricing
    sla: VendorSLA
    capabilities: VendorCapabilities

    # Operational metadata
    priority: int = Field(default=100, ge=1, le=1000)  # Lower = higher priority
    weight: float = Field(default=1.0, ge=0.0, le=1.0)  # For weighted routing
    enabled: bool = True
    maintenance_window: Optional[str] = None  # Cron expression

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_health_check: Optional[datetime] = None


# Health Monitoring Models
class HealthCheckResult(BaseModel):
    """Single health check result."""
    check_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Metrics
    response_time_ms: int = Field(ge=0)
    success: bool
    error_message: Optional[str] = None
    status_code: Optional[int] = None

    # Quality metrics
    data_freshness_seconds: Optional[int] = None
    data_accuracy_score: Optional[float] = Field(None, ge=0.0, le=1.0)


class VendorHealthMetrics(BaseModel):
    """Aggregated vendor health metrics."""
    vendor_id: str
    window_start: datetime
    window_end: datetime

    # Availability metrics
    total_requests: int = Field(ge=0)
    successful_requests: int = Field(ge=0)
    failed_requests: int = Field(ge=0)
    uptime_percentage: float = Field(ge=0.0, le=100.0)

    # Performance metrics
    avg_response_time_ms: float = Field(ge=0)
    p50_response_time_ms: float = Field(ge=0)
    p95_response_time_ms: float = Field(ge=0)
    p99_response_time_ms: float = Field(ge=0)

    # Quality metrics
    error_rate_percentage: float = Field(ge=0.0, le=100.0)
    avg_data_freshness_seconds: Optional[float] = None
    avg_data_accuracy_score: Optional[float] = Field(None, ge=0.0, le=1.0)

    # SLA compliance
    sla_uptime_met: bool
    sla_latency_met: bool
    sla_error_rate_met: bool

    calculated_at: datetime = Field(default_factory=datetime.utcnow)


# Circuit Breaker Models
class CircuitBreakerConfig(BaseModel):
    """Circuit breaker configuration."""
    vendor_id: str
    failure_threshold: int = Field(default=5, ge=1)
    recovery_timeout_seconds: int = Field(default=60, ge=1)
    success_threshold: int = Field(default=3, ge=1)  # For half-open -> closed
    timeout_seconds: int = Field(default=30, ge=1)


class CircuitBreakerState(BaseModel):
    """Current circuit breaker state."""
    vendor_id: str
    state: CircuitBreakerState = CircuitBreakerState.CLOSED
    failure_count: int = Field(default=0, ge=0)
    success_count: int = Field(default=0, ge=0)
    last_failure_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    next_attempt_time: Optional[datetime] = None
    total_failures: int = Field(default=0, ge=0)

    def should_attempt_request(self) -> bool:
        """Check if request should be attempted based on circuit breaker state."""
        now = datetime.utcnow()

        if self.state == CircuitBreakerState.CLOSED:
            return True
        elif self.state == CircuitBreakerState.OPEN:
            return self.next_attempt_time is not None and now >= self.next_attempt_time
        elif self.state == CircuitBreakerState.HALF_OPEN:
            return True

        return False


# Request Routing Models
class RoutingRule(BaseModel):
    """Request routing rule configuration."""
    rule_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    enabled: bool = True
    priority: int = Field(ge=1)

    # Conditions
    request_types: List[RequestType] = Field(default_factory=list)
    symbols: List[str] = Field(default_factory=list)  # Empty = all symbols
    exchanges: List[str] = Field(default_factory=list)
    time_ranges: List[str] = Field(default_factory=list)  # Cron expressions

    # Routing strategy
    strategy: RoutingStrategy
    preferred_vendors: List[str] = Field(default_factory=list)  # Vendor IDs
    excluded_vendors: List[str] = Field(default_factory=list)

    # Weights for weighted routing
    vendor_weights: Dict[str, float] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)


class RequestContext(BaseModel):
    """Context for a data request."""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_type: RequestType
    symbol: Optional[str] = None
    symbols: List[str] = Field(default_factory=list)
    parameters: Dict[str, Any] = Field(default_factory=dict)

    # Request metadata
    user_id: Optional[str] = None
    priority: int = Field(default=100, ge=1)
    timeout_seconds: int = Field(default=30, ge=1)
    retry_count: int = Field(default=0, ge=0)
    max_retries: int = Field(default=3, ge=0)

    # Quality requirements
    max_staleness_seconds: int = Field(default=300, ge=0)
    min_data_quality_score: float = Field(default=0.8, ge=0.0, le=1.0)

    # Routing preferences
    preferred_strategy: Optional[RoutingStrategy] = None
    cost_budget: Optional[float] = None  # Maximum cost per request

    created_at: datetime = Field(default_factory=datetime.utcnow)


class VendorResponse(BaseModel):
    """Response from a vendor adapter."""
    vendor_id: str
    request_id: str
    success: bool

    # Response data
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    status_code: Optional[int] = None

    # Performance metrics
    response_time_ms: int = Field(ge=0)
    data_timestamp: Optional[datetime] = None
    cache_hit: bool = False

    # Cost tracking
    request_cost: float = Field(default=0.0, ge=0.0)

    # Quality metrics
    data_quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    data_freshness_seconds: Optional[int] = None

    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RoutingDecision(BaseModel):
    """Result of request routing decision."""
    request_id: str
    chosen_vendor_id: str
    strategy_used: RoutingStrategy
    fallback_vendors: List[str] = Field(default_factory=list)

    # Decision factors
    vendor_scores: Dict[str, float] = Field(default_factory=dict)
    estimated_cost: float = Field(ge=0.0)
    estimated_latency_ms: int = Field(ge=0)

    # Hedge requests (parallel requests for critical data)
    hedge_vendor_ids: List[str] = Field(default_factory=list)
    hedge_timeout_ms: int = Field(default=100, ge=0)

    decision_time_ms: float = Field(ge=0.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Cost Tracking Models
class VendorUsage(BaseModel):
    """Vendor usage tracking for billing."""
    usage_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    request_id: str
    request_type: RequestType

    # Usage details
    symbol: Optional[str] = None
    success: bool
    request_cost: float = Field(ge=0.0)
    data_volume_bytes: int = Field(default=0, ge=0)

    # Timestamps
    request_timestamp: datetime = Field(default_factory=datetime.utcnow)
    billing_period: str  # YYYY-MM format

    # Metadata
    user_id: Optional[str] = None
    endpoint: Optional[str] = None


class CostBudget(BaseModel):
    """Cost budget configuration."""
    budget_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str

    # Budget constraints
    daily_budget: float = Field(ge=0.0)
    monthly_budget: float = Field(ge=0.0)
    per_request_limit: float = Field(ge=0.0)

    # Current usage
    daily_spent: float = Field(default=0.0, ge=0.0)
    monthly_spent: float = Field(default=0.0, ge=0.0)

    # Scope
    vendor_ids: List[str] = Field(default_factory=list)  # Empty = all vendors
    request_types: List[RequestType] = Field(default_factory=list)
    user_ids: List[str] = Field(default_factory=list)

    # Alerts
    alert_threshold_percentage: float = Field(default=80.0, ge=0.0, le=100.0)
    alert_contacts: List[str] = Field(default_factory=list)

    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Orchestration Configuration
class VendorOrchestrationConfig(BaseModel):
    """Global vendor orchestration configuration."""
    # Default routing
    default_strategy: RoutingStrategy = RoutingStrategy.COST_OPTIMIZED
    enable_hedging: bool = True
    hedge_percentage: float = Field(default=10.0, ge=0.0, le=100.0)

    # Circuit breaker defaults
    default_failure_threshold: int = Field(default=5, ge=1)
    default_recovery_timeout: int = Field(default=60, ge=1)

    # Health monitoring
    health_check_interval_seconds: int = Field(default=300, ge=30)
    health_window_minutes: int = Field(default=60, ge=5)

    # Caching
    enable_response_caching: bool = True
    cache_ttl_seconds: Dict[RequestType, int] = Field(default_factory=dict)

    # Cost optimization
    enable_cost_optimization: bool = True
    cost_optimization_window_hours: int = Field(default=24, ge=1)

    # Canary testing
    canary_percentage: float = Field(default=5.0, ge=0.0, le=50.0)
    canary_vendors: List[str] = Field(default_factory=list)

    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Request/Response Models for API
class VendorListResponse(BaseModel):
    """Response for listing vendors."""
    vendors: List[VendorRegistry]
    total_count: int
    enabled_count: int
    healthy_count: int


class VendorHealthResponse(BaseModel):
    """Response for vendor health status."""
    vendor_id: str
    status: VendorStatus
    metrics: VendorHealthMetrics
    circuit_breaker: CircuitBreakerState
    last_error: Optional[str] = None


class RoutingAnalyticsResponse(BaseModel):
    """Response for routing analytics."""
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time_ms: float
    cost_breakdown: Dict[str, float]  # vendor_id -> cost
    vendor_usage_stats: Dict[str, Dict[str, int]]  # vendor_id -> request_type -> count
    sla_compliance: Dict[str, bool]  # vendor_id -> compliant


class CostAnalyticsResponse(BaseModel):
    """Response for cost analytics."""
    period_start: datetime
    period_end: datetime
    total_cost: float
    cost_by_vendor: Dict[str, float]
    cost_by_request_type: Dict[RequestType, float]
    budget_utilization: Dict[str, float]  # budget_id -> percentage
    projected_monthly_cost: float
    cost_savings_opportunities: List[str]