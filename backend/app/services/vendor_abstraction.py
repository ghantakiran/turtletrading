"""
Vendor Abstraction Layer

Provides unified interface for all data vendor integrations with comprehensive
error handling, circuit breaker patterns, rate limiting, and cost tracking.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union, Type, Callable
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import json
import hashlib
import logging
from contextlib import asynccontextmanager

from pydantic import BaseModel, Field, validator
from redis.asyncio import Redis

from app.models.vendor_models import (
    VendorRegistry, VendorResponse, RequestContext, RoutingDecision,
    CircuitBreakerState, CircuitBreakerConfig, VendorHealthMetrics,
    VendorUsage, RequestType, VendorStatus, RoutingStrategy
)
from app.core.logging import get_logger

logger = get_logger(__name__)


class DataRequest(BaseModel):
    """Standardized data request across all vendors."""
    request_type: RequestType
    symbol: Optional[str] = None
    symbols: List[str] = Field(default_factory=list)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    interval: Optional[str] = None  # 1m, 5m, 15m, 1h, 1d, etc.
    parameters: Dict[str, Any] = Field(default_factory=dict)

    # Quality requirements
    max_staleness_seconds: int = Field(default=300, ge=0)
    min_data_quality_score: float = Field(default=0.8, ge=0.0, le=1.0)

    # Request metadata
    priority: int = Field(default=100, ge=1)
    timeout_seconds: int = Field(default=30, ge=1)

    @validator('symbols', pre=True)
    def ensure_symbols_list(cls, v, values):
        """Ensure symbols is always a list."""
        if 'symbol' in values and values['symbol']:
            if not v:
                return [values['symbol']]
            elif values['symbol'] not in v:
                return v + [values['symbol']]
        return v or []


class DataResponse(BaseModel):
    """Standardized data response across all vendors."""
    success: bool
    vendor_id: str
    request_id: str

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


class VendorAdapter(ABC):
    """Abstract base class for all vendor adapters."""

    def __init__(self, vendor_registry: VendorRegistry, redis_client: Redis):
        self.vendor_registry = vendor_registry
        self.redis_client = redis_client
        self.logger = get_logger(f"vendor.{vendor_registry.name}")

        # Circuit breaker state
        self._circuit_breaker_key = f"circuit_breaker:{vendor_registry.vendor_id}"

        # Rate limiting
        self._rate_limit_key_prefix = f"rate_limit:{vendor_registry.vendor_id}"

        # Cost tracking
        self._cost_key_prefix = f"cost:{vendor_registry.vendor_id}"

    @property
    def vendor_id(self) -> str:
        return self.vendor_registry.vendor_id

    @property
    def vendor_name(self) -> str:
        return self.vendor_registry.name

    @abstractmethod
    async def fetch_data(self, request: DataRequest) -> DataResponse:
        """Fetch data from the vendor API."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the vendor API is healthy."""
        pass

    @abstractmethod
    def get_supported_request_types(self) -> List[RequestType]:
        """Get list of supported request types."""
        pass

    @abstractmethod
    def calculate_request_cost(self, request: DataRequest) -> float:
        """Calculate the cost of a request."""
        pass

    async def is_request_supported(self, request: DataRequest) -> bool:
        """Check if the request is supported by this vendor."""
        supported_types = self.get_supported_request_types()
        return request.request_type in supported_types

    async def get_circuit_breaker_state(self) -> CircuitBreakerState:
        """Get current circuit breaker state."""
        state_data = await self.redis_client.get(self._circuit_breaker_key)
        if not state_data:
            return CircuitBreakerState(vendor_id=self.vendor_id)

        try:
            state_dict = json.loads(state_data)
            return CircuitBreakerState(**state_dict)
        except (json.JSONDecodeError, ValueError) as e:
            self.logger.error(f"Failed to parse circuit breaker state: {e}")
            return CircuitBreakerState(vendor_id=self.vendor_id)

    async def update_circuit_breaker_state(self, state: CircuitBreakerState):
        """Update circuit breaker state."""
        state_data = state.json()
        await self.redis_client.setex(
            self._circuit_breaker_key,
            timedelta(hours=24),
            state_data
        )

    async def should_attempt_request(self) -> bool:
        """Check if request should be attempted based on circuit breaker."""
        state = await self.get_circuit_breaker_state()
        return state.should_attempt_request()

    async def record_success(self):
        """Record successful request for circuit breaker."""
        state = await self.get_circuit_breaker_state()
        state.success_count += 1
        state.failure_count = 0
        state.last_success_time = datetime.utcnow()

        # Reset to closed if in half-open state with enough successes
        if (state.state == CircuitBreakerState.HALF_OPEN and
            state.success_count >= 3):  # Success threshold
            state.state = CircuitBreakerState.CLOSED
            state.next_attempt_time = None

        await self.update_circuit_breaker_state(state)

    async def record_failure(self, error: str):
        """Record failed request for circuit breaker."""
        state = await self.get_circuit_breaker_state()
        state.failure_count += 1
        state.success_count = 0
        state.last_failure_time = datetime.utcnow()
        state.total_failures += 1

        # Open circuit if failure threshold exceeded
        if state.failure_count >= 5:  # Failure threshold
            state.state = CircuitBreakerState.OPEN
            state.next_attempt_time = datetime.utcnow() + timedelta(seconds=60)  # Recovery timeout

        await self.update_circuit_breaker_state(state)
        self.logger.warning(f"Recorded failure for {self.vendor_name}: {error}")

    async def check_rate_limit(self, request: DataRequest) -> bool:
        """Check if request is within rate limits."""
        rate_limit_key = f"{self._rate_limit_key_prefix}:{request.request_type.value}"

        # Get current count
        current_count = await self.redis_client.get(rate_limit_key)
        current_count = int(current_count) if current_count else 0

        # Check against quotas
        for quota in self.vendor_registry.quotas:
            if quota.request_type == request.request_type:
                if current_count >= quota.requests_per_minute:
                    return False

        return True

    async def record_request(self, request: DataRequest, response: DataResponse):
        """Record request for rate limiting and cost tracking."""
        # Rate limiting
        rate_limit_key = f"{self._rate_limit_key_prefix}:{request.request_type.value}"
        await self.redis_client.incr(rate_limit_key)
        await self.redis_client.expire(rate_limit_key, 60)  # 1 minute window

        # Cost tracking
        usage = VendorUsage(
            vendor_id=self.vendor_id,
            request_id=response.request_id,
            request_type=request.request_type,
            symbol=request.symbol,
            success=response.success,
            request_cost=response.request_cost,
            data_volume_bytes=len(json.dumps(response.data)) if response.data else 0,
            billing_period=datetime.utcnow().strftime("%Y-%m")
        )

        cost_key = f"{self._cost_key_prefix}:{usage.billing_period}"
        await self.redis_client.lpush(cost_key, usage.json())
        await self.redis_client.expire(cost_key, timedelta(days=32))


class VendorOrchestrator:
    """
    Central orchestrator for managing multiple vendor adapters with intelligent
    routing, failover, circuit breakers, and cost optimization.
    """

    def __init__(self, redis_client: Redis):
        self.redis_client = redis_client
        self.logger = get_logger("vendor.orchestrator")

        # Vendor adapters registry
        self._adapters: Dict[str, VendorAdapter] = {}
        self._adapter_classes: Dict[str, Type[VendorAdapter]] = {}

        # Routing cache
        self._routing_cache_prefix = "routing_cache"

        # Performance metrics
        self._metrics_prefix = "vendor_metrics"

    def register_adapter_class(self, vendor_name: str, adapter_class: Type[VendorAdapter]):
        """Register a vendor adapter class."""
        self._adapter_classes[vendor_name] = adapter_class
        self.logger.info(f"Registered adapter class for vendor: {vendor_name}")

    async def register_vendor(self, vendor_registry: VendorRegistry) -> VendorAdapter:
        """Register a vendor adapter instance."""
        if vendor_registry.name not in self._adapter_classes:
            raise ValueError(f"No adapter class registered for vendor: {vendor_registry.name}")

        adapter_class = self._adapter_classes[vendor_registry.name]
        adapter = adapter_class(vendor_registry, self.redis_client)

        self._adapters[vendor_registry.vendor_id] = adapter
        self.logger.info(f"Registered vendor adapter: {vendor_registry.name} ({vendor_registry.vendor_id})")

        return adapter

    async def unregister_vendor(self, vendor_id: str):
        """Unregister a vendor adapter."""
        if vendor_id in self._adapters:
            del self._adapters[vendor_id]
            self.logger.info(f"Unregistered vendor adapter: {vendor_id}")

    def get_adapter(self, vendor_id: str) -> Optional[VendorAdapter]:
        """Get vendor adapter by ID."""
        return self._adapters.get(vendor_id)

    def get_adapters_for_request_type(self, request_type: RequestType) -> List[VendorAdapter]:
        """Get all adapters that support a request type."""
        adapters = []
        for adapter in self._adapters.values():
            if request_type in adapter.get_supported_request_types():
                adapters.append(adapter)
        return adapters

    async def route_request(self, request: DataRequest, strategy: RoutingStrategy = RoutingStrategy.COST_OPTIMIZED) -> RoutingDecision:
        """Route request to best available vendor."""
        start_time = datetime.utcnow()

        # Get candidate adapters
        candidates = self.get_adapters_for_request_type(request.request_type)
        if not candidates:
            raise ValueError(f"No vendors support request type: {request.request_type}")

        # Filter by circuit breaker state
        available_candidates = []
        for adapter in candidates:
            if await adapter.should_attempt_request():
                available_candidates.append(adapter)

        if not available_candidates:
            raise RuntimeError("All vendors are unavailable (circuit breakers open)")

        # Score vendors based on strategy
        vendor_scores = {}
        estimated_costs = {}
        estimated_latencies = {}

        for adapter in available_candidates:
            score = await self._score_vendor(adapter, request, strategy)
            vendor_scores[adapter.vendor_id] = score
            estimated_costs[adapter.vendor_id] = adapter.calculate_request_cost(request)
            estimated_latencies[adapter.vendor_id] = await self._estimate_latency(adapter)

        # Select best vendor
        best_vendor_id = max(vendor_scores.keys(), key=lambda vid: vendor_scores[vid])

        # Build fallback list
        fallback_vendors = [vid for vid in vendor_scores.keys() if vid != best_vendor_id]
        fallback_vendors.sort(key=lambda vid: vendor_scores[vid], reverse=True)

        decision_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

        return RoutingDecision(
            request_id=request.parameters.get('request_id', 'unknown'),
            chosen_vendor_id=best_vendor_id,
            strategy_used=strategy,
            fallback_vendors=fallback_vendors,
            vendor_scores=vendor_scores,
            estimated_cost=estimated_costs[best_vendor_id],
            estimated_latency_ms=estimated_latencies[best_vendor_id],
            decision_time_ms=decision_time_ms
        )

    async def execute_request(self, request: DataRequest, strategy: RoutingStrategy = RoutingStrategy.COST_OPTIMIZED) -> DataResponse:
        """Execute request with intelligent routing and failover."""
        # Route request
        routing_decision = await self.route_request(request, strategy)

        # Try primary vendor
        primary_adapter = self.get_adapter(routing_decision.chosen_vendor_id)
        if primary_adapter:
            try:
                response = await self._execute_with_adapter(primary_adapter, request)
                if response.success:
                    await primary_adapter.record_success()
                    await primary_adapter.record_request(request, response)
                    return response
                else:
                    await primary_adapter.record_failure(response.error or "Unknown error")
            except Exception as e:
                await primary_adapter.record_failure(str(e))
                self.logger.error(f"Primary vendor {primary_adapter.vendor_name} failed: {e}")

        # Try fallback vendors
        for fallback_vendor_id in routing_decision.fallback_vendors:
            fallback_adapter = self.get_adapter(fallback_vendor_id)
            if not fallback_adapter or not await fallback_adapter.should_attempt_request():
                continue

            try:
                response = await self._execute_with_adapter(fallback_adapter, request)
                if response.success:
                    await fallback_adapter.record_success()
                    await fallback_adapter.record_request(request, response)
                    self.logger.info(f"Fallback vendor {fallback_adapter.vendor_name} succeeded")
                    return response
                else:
                    await fallback_adapter.record_failure(response.error or "Unknown error")
            except Exception as e:
                await fallback_adapter.record_failure(str(e))
                self.logger.error(f"Fallback vendor {fallback_adapter.vendor_name} failed: {e}")

        # All vendors failed
        raise RuntimeError("All vendors failed to fulfill request")

    async def _execute_with_adapter(self, adapter: VendorAdapter, request: DataRequest) -> DataResponse:
        """Execute request with a specific adapter."""
        # Check rate limits
        if not await adapter.check_rate_limit(request):
            raise RuntimeError(f"Rate limit exceeded for vendor {adapter.vendor_name}")

        # Execute request with timeout
        try:
            response = await asyncio.wait_for(
                adapter.fetch_data(request),
                timeout=request.timeout_seconds
            )
            return response
        except asyncio.TimeoutError:
            raise RuntimeError(f"Request timeout for vendor {adapter.vendor_name}")

    async def _score_vendor(self, adapter: VendorAdapter, request: DataRequest, strategy: RoutingStrategy) -> float:
        """Score a vendor based on routing strategy."""
        # Get vendor metrics
        health_score = await self._get_health_score(adapter)
        cost_score = await self._get_cost_score(adapter, request)
        latency_score = await self._get_latency_score(adapter)
        quality_score = await self._get_quality_score(adapter)

        # Weight scores based on strategy
        if strategy == RoutingStrategy.COST_OPTIMIZED:
            return cost_score * 0.5 + health_score * 0.3 + quality_score * 0.2
        elif strategy == RoutingStrategy.LATENCY_OPTIMIZED:
            return latency_score * 0.5 + health_score * 0.3 + quality_score * 0.2
        elif strategy == RoutingStrategy.QUALITY_OPTIMIZED:
            return quality_score * 0.5 + health_score * 0.3 + latency_score * 0.2
        else:  # ROUND_ROBIN, WEIGHTED
            return health_score

    async def _get_health_score(self, adapter: VendorAdapter) -> float:
        """Get health score (0.0 - 1.0) for vendor."""
        try:
            is_healthy = await adapter.health_check()
            return 1.0 if is_healthy else 0.0
        except Exception:
            return 0.0

    async def _get_cost_score(self, adapter: VendorAdapter, request: DataRequest) -> float:
        """Get cost score (0.0 - 1.0) for vendor (higher = cheaper)."""
        cost = adapter.calculate_request_cost(request)
        # Normalize cost to 0-1 scale (lower cost = higher score)
        # This is a simplified implementation
        max_cost = 1.0  # Configure based on your cost model
        return max(0.0, 1.0 - (cost / max_cost))

    async def _get_latency_score(self, adapter: VendorAdapter) -> float:
        """Get latency score (0.0 - 1.0) for vendor (higher = faster)."""
        avg_latency = await self._estimate_latency(adapter)
        # Normalize latency to 0-1 scale (lower latency = higher score)
        max_latency = 5000  # 5 seconds
        return max(0.0, 1.0 - (avg_latency / max_latency))

    async def _get_quality_score(self, adapter: VendorAdapter) -> float:
        """Get data quality score (0.0 - 1.0) for vendor."""
        # This would typically come from historical data quality metrics
        # For now, return a default score based on vendor tier
        if hasattr(adapter.vendor_registry.pricing, 'tier'):
            tier = adapter.vendor_registry.pricing.tier
            if tier == 'enterprise':
                return 0.95
            elif tier == 'professional':
                return 0.85
            elif tier == 'basic':
                return 0.75
            else:  # free
                return 0.65
        return 0.8  # Default score

    async def _estimate_latency(self, adapter: VendorAdapter) -> int:
        """Estimate latency in milliseconds for vendor."""
        # Get historical latency from metrics
        metrics_key = f"{self._metrics_prefix}:{adapter.vendor_id}:latency"
        latency_data = await self.redis_client.get(metrics_key)

        if latency_data:
            try:
                return int(latency_data)
            except ValueError:
                pass

        # Default latency estimate based on vendor type
        return 1000  # 1 second default

    async def get_vendor_health_status(self) -> Dict[str, Dict[str, Any]]:
        """Get health status for all vendors."""
        status = {}

        for vendor_id, adapter in self._adapters.items():
            try:
                is_healthy = await adapter.health_check()
                circuit_state = await adapter.get_circuit_breaker_state()

                status[vendor_id] = {
                    'vendor_name': adapter.vendor_name,
                    'healthy': is_healthy,
                    'circuit_breaker_state': circuit_state.state,
                    'failure_count': circuit_state.failure_count,
                    'last_check': datetime.utcnow().isoformat()
                }
            except Exception as e:
                status[vendor_id] = {
                    'vendor_name': adapter.vendor_name,
                    'healthy': False,
                    'error': str(e),
                    'last_check': datetime.utcnow().isoformat()
                }

        return status


# Utility functions for vendor management
async def create_orchestrator(redis_client: Redis) -> VendorOrchestrator:
    """Create and configure a vendor orchestrator."""
    orchestrator = VendorOrchestrator(redis_client)

    # Register adapter classes here when they're implemented
    # orchestrator.register_adapter_class("yahoo_finance", YahooFinanceAdapter)
    # orchestrator.register_adapter_class("alpha_vantage", AlphaVantageAdapter)
    # orchestrator.register_adapter_class("iex_cloud", IEXCloudAdapter)
    # orchestrator.register_adapter_class("polygon", PolygonAdapter)

    return orchestrator


# Context manager for vendor orchestration
@asynccontextmanager
async def vendor_context(redis_client: Redis):
    """Context manager for vendor orchestration lifecycle."""
    orchestrator = await create_orchestrator(redis_client)
    try:
        yield orchestrator
    finally:
        # Cleanup if needed
        pass