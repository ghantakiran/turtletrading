"""
Intelligent Request Routing and Failover System

Advanced routing engine with circuit breakers, hedged requests, canary testing,
A/B testing, and intelligent failover with comprehensive monitoring and SLA tracking.
"""

import asyncio
import json
import random
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime, timedelta
from enum import Enum
import uuid
import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field

from redis.asyncio import Redis
import numpy as np

from app.services.vendor_abstraction import VendorOrchestrator, VendorAdapter, DataRequest, DataResponse
from app.models.vendor_models import (
    RoutingStrategy, RoutingDecision, RequestType, VendorStatus,
    CircuitBreakerState, VendorHealthMetrics, RoutingRule
)
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class RoutingMetrics:
    """Metrics for routing decisions and performance tracking."""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    avg_response_time_ms: float = 0.0
    p95_response_time_ms: float = 0.0
    cost_per_request: float = 0.0
    last_updated: datetime = field(default_factory=datetime.utcnow)

    def update_success(self, response_time_ms: float, cost: float):
        """Update metrics for successful request."""
        self.total_requests += 1
        self.successful_requests += 1
        self._update_response_time(response_time_ms)
        self._update_cost(cost)
        self.last_updated = datetime.utcnow()

    def update_failure(self, response_time_ms: float):
        """Update metrics for failed request."""
        self.total_requests += 1
        self.failed_requests += 1
        self._update_response_time(response_time_ms)
        self.last_updated = datetime.utcnow()

    def _update_response_time(self, response_time_ms: float):
        """Update response time metrics with exponential moving average."""
        if self.total_requests == 1:
            self.avg_response_time_ms = response_time_ms
            self.p95_response_time_ms = response_time_ms
        else:
            # Exponential moving average
            alpha = 0.1
            self.avg_response_time_ms = alpha * response_time_ms + (1 - alpha) * self.avg_response_time_ms
            # Simple approximation for p95
            self.p95_response_time_ms = max(self.p95_response_time_ms * 0.95, response_time_ms)

    def _update_cost(self, cost: float):
        """Update cost metrics."""
        if self.successful_requests == 1:
            self.cost_per_request = cost
        else:
            # Exponential moving average
            alpha = 0.1
            self.cost_per_request = alpha * cost + (1 - alpha) * self.cost_per_request

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        return (self.successful_requests / self.total_requests * 100) if self.total_requests > 0 else 0.0

    @property
    def error_rate(self) -> float:
        """Calculate error rate percentage."""
        return (self.failed_requests / self.total_requests * 100) if self.total_requests > 0 else 0.0


class CanaryTestManager:
    """Manages canary testing for new vendors or configurations."""

    def __init__(self, redis_client: Redis):
        self.redis_client = redis_client
        self.canary_key_prefix = "canary_test"
        self.logger = get_logger("vendor.canary")

    async def is_canary_enabled(self, vendor_id: str) -> bool:
        """Check if vendor is in canary testing mode."""
        canary_key = f"{self.canary_key_prefix}:{vendor_id}"
        result = await self.redis_client.get(canary_key)
        return result == "enabled"

    async def enable_canary(self, vendor_id: str, percentage: float = 5.0, duration_hours: int = 24):
        """Enable canary testing for a vendor."""
        canary_config = {
            "vendor_id": vendor_id,
            "percentage": percentage,
            "enabled_at": datetime.utcnow().isoformat(),
            "duration_hours": duration_hours
        }

        canary_key = f"{self.canary_key_prefix}:{vendor_id}"
        config_key = f"{self.canary_key_prefix}:config:{vendor_id}"

        await self.redis_client.setex(canary_key, timedelta(hours=duration_hours), "enabled")
        await self.redis_client.setex(config_key, timedelta(hours=duration_hours), json.dumps(canary_config))

        self.logger.info(f"Enabled canary testing for {vendor_id}: {percentage}% traffic for {duration_hours}h")

    async def disable_canary(self, vendor_id: str):
        """Disable canary testing for a vendor."""
        canary_key = f"{self.canary_key_prefix}:{vendor_id}"
        config_key = f"{self.canary_key_prefix}:config:{vendor_id}"

        await self.redis_client.delete(canary_key, config_key)
        self.logger.info(f"Disabled canary testing for {vendor_id}")

    async def should_use_canary(self, vendor_id: str) -> bool:
        """Determine if request should use canary vendor."""
        if not await self.is_canary_enabled(vendor_id):
            return False

        config_key = f"{self.canary_key_prefix}:config:{vendor_id}"
        config_data = await self.redis_client.get(config_key)

        if not config_data:
            return False

        try:
            config = json.loads(config_data)
            percentage = config.get("percentage", 5.0)
            return random.random() * 100 < percentage
        except (json.JSONDecodeError, KeyError):
            return False

    async def record_canary_result(self, vendor_id: str, success: bool, response_time_ms: float):
        """Record canary test result."""
        result_key = f"{self.canary_key_prefix}:results:{vendor_id}"
        result_data = {
            "success": success,
            "response_time_ms": response_time_ms,
            "timestamp": datetime.utcnow().isoformat()
        }

        await self.redis_client.lpush(result_key, json.dumps(result_data))
        await self.redis_client.ltrim(result_key, 0, 999)  # Keep last 1000 results
        await self.redis_client.expire(result_key, timedelta(days=7))


class HedgedRequestManager:
    """Manages hedged requests for critical data with latency requirements."""

    def __init__(self, orchestrator: VendorOrchestrator):
        self.orchestrator = orchestrator
        self.logger = get_logger("vendor.hedging")

    async def execute_hedged_request(
        self,
        request: DataRequest,
        primary_vendor_id: str,
        hedge_vendors: List[str],
        hedge_timeout_ms: int = 100
    ) -> Tuple[DataResponse, Optional[str]]:
        """
        Execute hedged request - start primary request, then hedge requests after timeout.
        Return first successful response and the vendor that provided it.
        """
        hedge_timeout_seconds = hedge_timeout_ms / 1000.0

        # Start primary request
        primary_adapter = self.orchestrator.get_adapter(primary_vendor_id)
        if not primary_adapter:
            raise ValueError(f"Primary vendor not found: {primary_vendor_id}")

        primary_task = asyncio.create_task(
            self._execute_single_request(primary_adapter, request, "primary")
        )

        try:
            # Wait for hedge timeout
            try:
                response, source = await asyncio.wait_for(primary_task, timeout=hedge_timeout_seconds)
                self.logger.debug(f"Primary vendor {primary_vendor_id} responded within hedge timeout")
                return response, source
            except asyncio.TimeoutError:
                self.logger.info(f"Primary vendor {primary_vendor_id} exceeded hedge timeout, starting hedge requests")

            # Start hedge requests
            hedge_tasks = []
            for vendor_id in hedge_vendors:
                adapter = self.orchestrator.get_adapter(vendor_id)
                if adapter and await adapter.should_attempt_request():
                    task = asyncio.create_task(
                        self._execute_single_request(adapter, request, f"hedge_{vendor_id}")
                    )
                    hedge_tasks.append(task)

            # Wait for any response (primary or hedge)
            all_tasks = [primary_task] + hedge_tasks

            if not all_tasks:
                raise RuntimeError("No vendors available for hedged request")

            done, pending = await asyncio.wait(all_tasks, return_when=asyncio.FIRST_COMPLETED)

            # Cancel pending tasks
            for task in pending:
                task.cancel()

            # Get the first successful response
            for task in done:
                try:
                    response, source = await task
                    if response.success:
                        self.logger.info(f"Hedged request succeeded with {source}")
                        return response, source
                except Exception as e:
                    self.logger.error(f"Hedged request task failed: {e}")

            # If we get here, all requests failed
            raise RuntimeError("All hedged requests failed")

        except Exception as e:
            # Make sure to cancel the primary task if it's still running
            if not primary_task.done():
                primary_task.cancel()
            raise e

    async def _execute_single_request(self, adapter: VendorAdapter, request: DataRequest, source: str) -> Tuple[DataResponse, str]:
        """Execute a single request with an adapter."""
        try:
            response = await self.orchestrator._execute_with_adapter(adapter, request)
            return response, f"{source}_{adapter.vendor_id}"
        except Exception as e:
            # Return a failed response
            response = DataResponse(
                success=False,
                vendor_id=adapter.vendor_id,
                request_id=str(uuid.uuid4()),
                error=str(e),
                response_time_ms=0
            )
            return response, f"{source}_{adapter.vendor_id}"


class ABTestManager:
    """Manages A/B testing for routing strategies and configurations."""

    def __init__(self, redis_client: Redis):
        self.redis_client = redis_client
        self.ab_test_key_prefix = "ab_test"
        self.logger = get_logger("vendor.ab_test")

    async def create_ab_test(
        self,
        test_name: str,
        control_config: Dict[str, Any],
        treatment_config: Dict[str, Any],
        traffic_split: float = 0.5,
        duration_hours: int = 168  # 1 week
    ):
        """Create a new A/B test."""
        test_config = {
            "test_name": test_name,
            "control_config": control_config,
            "treatment_config": treatment_config,
            "traffic_split": traffic_split,
            "created_at": datetime.utcnow().isoformat(),
            "duration_hours": duration_hours,
            "active": True
        }

        test_key = f"{self.ab_test_key_prefix}:{test_name}"
        await self.redis_client.setex(
            test_key,
            timedelta(hours=duration_hours),
            json.dumps(test_config)
        )

        self.logger.info(f"Created A/B test '{test_name}' with {traffic_split*100}% treatment traffic")

    async def get_test_variant(self, test_name: str, user_id: str) -> Optional[str]:
        """Get test variant (control/treatment) for a user."""
        test_key = f"{self.ab_test_key_prefix}:{test_name}"
        test_data = await self.redis_client.get(test_key)

        if not test_data:
            return None

        try:
            config = json.loads(test_data)
            if not config.get("active", False):
                return None

            # Consistent hash-based assignment
            user_hash = hash(f"{test_name}:{user_id}") % 100
            traffic_split = config.get("traffic_split", 0.5)

            return "treatment" if user_hash < (traffic_split * 100) else "control"

        except (json.JSONDecodeError, KeyError):
            return None

    async def record_test_result(self, test_name: str, variant: str, success: bool, metrics: Dict[str, Any]):
        """Record A/B test result."""
        result_key = f"{self.ab_test_key_prefix}:results:{test_name}:{variant}"
        result_data = {
            "variant": variant,
            "success": success,
            "metrics": metrics,
            "timestamp": datetime.utcnow().isoformat()
        }

        await self.redis_client.lpush(result_key, json.dumps(result_data))
        await self.redis_client.ltrim(result_key, 0, 9999)  # Keep last 10,000 results
        await self.redis_client.expire(result_key, timedelta(days=30))


class IntelligentRouter:
    """
    Advanced routing system with machine learning-like capabilities,
    circuit breakers, hedging, canary testing, and A/B testing.
    """

    def __init__(self, orchestrator: VendorOrchestrator, redis_client: Redis):
        self.orchestrator = orchestrator
        self.redis_client = redis_client
        self.logger = get_logger("vendor.router")

        # Managers
        self.canary_manager = CanaryTestManager(redis_client)
        self.hedge_manager = HedgedRequestManager(orchestrator)
        self.ab_test_manager = ABTestManager(redis_client)

        # Metrics tracking
        self.vendor_metrics: Dict[str, RoutingMetrics] = defaultdict(RoutingMetrics)
        self.recent_decisions: deque = deque(maxlen=1000)

        # Routing rules cache
        self.routing_rules_cache: Dict[str, List[RoutingRule]] = {}
        self.cache_expires_at: Optional[datetime] = None

    async def route_request_intelligent(
        self,
        request: DataRequest,
        user_id: Optional[str] = None,
        enable_hedging: bool = True,
        enable_canary: bool = True
    ) -> Tuple[DataResponse, RoutingDecision]:
        """
        Execute intelligent routing with all advanced features:
        - A/B testing for routing strategies
        - Canary testing for new vendors
        - Hedged requests for critical data
        - Circuit breaker pattern
        - Machine learning-based vendor scoring
        """
        start_time = datetime.utcnow()
        request_id = getattr(request, 'request_id', str(uuid.uuid4()))

        # A/B test for routing strategy
        routing_strategy = await self._get_routing_strategy(request, user_id)

        # Apply routing rules
        applicable_rules = await self._get_applicable_rules(request)

        # Get candidate vendors
        candidates = await self._get_candidate_vendors(request, applicable_rules)

        if not candidates:
            raise ValueError(f"No vendors available for request type: {request.request_type}")

        # Filter by circuit breaker states
        available_candidates = await self._filter_by_circuit_breakers(candidates)

        if not available_candidates:
            raise RuntimeError("All vendors are unavailable (circuit breakers open)")

        # Score vendors using ML-like approach
        vendor_scores = await self._score_vendors_intelligent(available_candidates, request, routing_strategy)

        # Select primary vendor
        primary_vendor_id = self._select_primary_vendor(vendor_scores, routing_strategy)

        # Check for canary testing
        if enable_canary:
            canary_vendor = await self._check_canary_override(request, available_candidates)
            if canary_vendor:
                primary_vendor_id = canary_vendor

        # Prepare fallback vendors
        fallback_vendors = [vid for vid in vendor_scores.keys() if vid != primary_vendor_id]
        fallback_vendors.sort(key=lambda vid: vendor_scores[vid], reverse=True)

        # Build routing decision
        routing_decision = RoutingDecision(
            request_id=request_id,
            chosen_vendor_id=primary_vendor_id,
            strategy_used=routing_strategy,
            fallback_vendors=fallback_vendors,
            vendor_scores=vendor_scores,
            estimated_cost=await self._estimate_cost(primary_vendor_id, request),
            estimated_latency_ms=await self._estimate_latency(primary_vendor_id),
            decision_time_ms=(datetime.utcnow() - start_time).total_seconds() * 1000
        )

        # Execute request with hedging if enabled
        try:
            if enable_hedging and self._should_hedge_request(request):
                hedge_vendors = fallback_vendors[:2]  # Use top 2 fallbacks for hedging
                response, actual_vendor = await self.hedge_manager.execute_hedged_request(
                    request, primary_vendor_id, hedge_vendors
                )
                routing_decision.chosen_vendor_id = actual_vendor.split('_')[-1]  # Extract vendor ID
            else:
                response = await self.orchestrator.execute_request(request, routing_strategy)

            # Record success metrics
            await self._record_routing_metrics(routing_decision, response, True)

            # Record canary results if applicable
            if enable_canary and await self.canary_manager.is_canary_enabled(routing_decision.chosen_vendor_id):
                await self.canary_manager.record_canary_result(
                    routing_decision.chosen_vendor_id,
                    response.success,
                    response.response_time_ms
                )

            return response, routing_decision

        except Exception as e:
            # Record failure metrics
            failed_response = DataResponse(
                success=False,
                vendor_id=primary_vendor_id,
                request_id=request_id,
                error=str(e),
                response_time_ms=(datetime.utcnow() - start_time).total_seconds() * 1000
            )
            await self._record_routing_metrics(routing_decision, failed_response, False)
            raise e

    async def _get_routing_strategy(self, request: DataRequest, user_id: Optional[str]) -> RoutingStrategy:
        """Get routing strategy using A/B testing."""
        if user_id:
            variant = await self.ab_test_manager.get_test_variant("routing_strategy", user_id)
            if variant == "treatment":
                return RoutingStrategy.QUALITY_OPTIMIZED
            elif variant == "control":
                return RoutingStrategy.COST_OPTIMIZED

        # Default strategy based on request priority
        if hasattr(request, 'priority') and request.priority <= 50:
            return RoutingStrategy.LATENCY_OPTIMIZED
        else:
            return RoutingStrategy.COST_OPTIMIZED

    async def _get_applicable_rules(self, request: DataRequest) -> List[RoutingRule]:
        """Get routing rules applicable to the request."""
        # Cache routing rules for 5 minutes
        if (not self.cache_expires_at or
            datetime.utcnow() > self.cache_expires_at):
            await self._refresh_routing_rules_cache()

        applicable_rules = []
        for rule in self.routing_rules_cache.get(request.request_type.value, []):
            if self._rule_matches_request(rule, request):
                applicable_rules.append(rule)

        # Sort by priority
        applicable_rules.sort(key=lambda r: r.priority)
        return applicable_rules

    async def _refresh_routing_rules_cache(self):
        """Refresh routing rules cache from database/Redis."""
        # This would typically load from database
        # For now, create some default rules
        default_rules = {
            RequestType.QUOTE.value: [],
            RequestType.HISTORICAL.value: [],
            RequestType.INTRADAY.value: [],
            RequestType.FUNDAMENTALS.value: []
        }

        self.routing_rules_cache = default_rules
        self.cache_expires_at = datetime.utcnow() + timedelta(minutes=5)

    def _rule_matches_request(self, rule: RoutingRule, request: DataRequest) -> bool:
        """Check if routing rule matches the request."""
        # Check request types
        if rule.request_types and request.request_type not in rule.request_types:
            return False

        # Check symbols
        if rule.symbols and request.symbol and request.symbol not in rule.symbols:
            return False

        # Check time ranges (simplified - would need proper cron parsing)
        # For now, assume all time ranges match

        return True

    async def _get_candidate_vendors(self, request: DataRequest, rules: List[RoutingRule]) -> List[VendorAdapter]:
        """Get candidate vendors based on request and rules."""
        candidates = self.orchestrator.get_adapters_for_request_type(request.request_type)

        # Apply rule filters
        for rule in rules:
            if rule.preferred_vendors:
                candidates = [c for c in candidates if c.vendor_id in rule.preferred_vendors]
            if rule.excluded_vendors:
                candidates = [c for c in candidates if c.vendor_id not in rule.excluded_vendors]

        return candidates

    async def _filter_by_circuit_breakers(self, candidates: List[VendorAdapter]) -> List[VendorAdapter]:
        """Filter candidates by circuit breaker states."""
        available = []
        for adapter in candidates:
            if await adapter.should_attempt_request():
                available.append(adapter)
        return available

    async def _score_vendors_intelligent(
        self,
        candidates: List[VendorAdapter],
        request: DataRequest,
        strategy: RoutingStrategy
    ) -> Dict[str, float]:
        """Score vendors using intelligent algorithms (ML-like approach)."""
        scores = {}

        for adapter in candidates:
            vendor_id = adapter.vendor_id

            # Get historical metrics
            metrics = self.vendor_metrics.get(vendor_id, RoutingMetrics())

            # Base scores
            health_score = await self._calculate_health_score(adapter, metrics)
            latency_score = await self._calculate_latency_score(adapter, metrics)
            cost_score = await self._calculate_cost_score(adapter, request)
            quality_score = await self._calculate_quality_score(adapter, metrics)
            reliability_score = await self._calculate_reliability_score(adapter, metrics)

            # Strategy-based weighting
            if strategy == RoutingStrategy.COST_OPTIMIZED:
                final_score = (cost_score * 0.4 + reliability_score * 0.3 +
                              quality_score * 0.2 + health_score * 0.1)
            elif strategy == RoutingStrategy.LATENCY_OPTIMIZED:
                final_score = (latency_score * 0.4 + reliability_score * 0.3 +
                              health_score * 0.2 + quality_score * 0.1)
            elif strategy == RoutingStrategy.QUALITY_OPTIMIZED:
                final_score = (quality_score * 0.4 + reliability_score * 0.3 +
                              health_score * 0.2 + latency_score * 0.1)
            else:  # ROUND_ROBIN, WEIGHTED
                final_score = (health_score * 0.3 + reliability_score * 0.3 +
                              quality_score * 0.2 + latency_score * 0.2)

            # Apply time decay for recent failures
            final_score = await self._apply_time_decay(adapter, final_score)

            scores[vendor_id] = max(0.0, min(1.0, final_score))

        return scores

    async def _calculate_health_score(self, adapter: VendorAdapter, metrics: RoutingMetrics) -> float:
        """Calculate health score based on recent performance."""
        if metrics.total_requests == 0:
            return 0.8  # Default score for new vendors

        success_rate = metrics.success_rate / 100.0
        return success_rate

    async def _calculate_latency_score(self, adapter: VendorAdapter, metrics: RoutingMetrics) -> float:
        """Calculate latency score (lower latency = higher score)."""
        if metrics.total_requests == 0:
            return 0.8  # Default score

        # Normalize latency (assume max acceptable latency is 5 seconds)
        max_latency = 5000.0
        normalized_latency = min(metrics.avg_response_time_ms / max_latency, 1.0)
        return 1.0 - normalized_latency

    async def _calculate_cost_score(self, adapter: VendorAdapter, request: DataRequest) -> float:
        """Calculate cost score (lower cost = higher score)."""
        cost = adapter.calculate_request_cost(request)

        # Normalize cost (assume max acceptable cost is $1.00)
        max_cost = 1.0
        normalized_cost = min(cost / max_cost, 1.0)
        return 1.0 - normalized_cost

    async def _calculate_quality_score(self, adapter: VendorAdapter, metrics: RoutingMetrics) -> float:
        """Calculate data quality score."""
        # This would typically be based on data validation results
        # For now, use vendor tier-based scoring
        if hasattr(adapter.vendor_registry.pricing, 'tier'):
            tier_scores = {
                'enterprise': 0.95,
                'professional': 0.85,
                'basic': 0.75,
                'free': 0.65
            }
            return tier_scores.get(adapter.vendor_registry.pricing.tier, 0.8)
        return 0.8

    async def _calculate_reliability_score(self, adapter: VendorAdapter, metrics: RoutingMetrics) -> float:
        """Calculate reliability score based on circuit breaker state and recent performance."""
        circuit_state = await adapter.get_circuit_breaker_state()

        if circuit_state.state == CircuitBreakerState.OPEN:
            return 0.0
        elif circuit_state.state == CircuitBreakerState.HALF_OPEN:
            return 0.5
        else:  # CLOSED
            # Factor in recent failure count
            if circuit_state.failure_count > 0:
                return max(0.5, 1.0 - (circuit_state.failure_count / 10.0))
            return 1.0

    async def _apply_time_decay(self, adapter: VendorAdapter, score: float) -> float:
        """Apply time-based decay for recent failures."""
        circuit_state = await adapter.get_circuit_breaker_state()

        if circuit_state.last_failure_time:
            time_since_failure = datetime.utcnow() - circuit_state.last_failure_time
            hours_since_failure = time_since_failure.total_seconds() / 3600

            # Apply exponential decay (recover 50% score every 2 hours)
            decay_factor = 1.0 - (0.5 ** (hours_since_failure / 2.0))
            return score * decay_factor

        return score

    def _select_primary_vendor(self, vendor_scores: Dict[str, float], strategy: RoutingStrategy) -> str:
        """Select primary vendor based on scores and strategy."""
        if strategy == RoutingStrategy.ROUND_ROBIN:
            # Simple round-robin based on recent decisions
            vendor_ids = list(vendor_scores.keys())
            return vendor_ids[len(self.recent_decisions) % len(vendor_ids)]
        elif strategy == RoutingStrategy.WEIGHTED:
            # Weighted random selection
            return self._weighted_random_selection(vendor_scores)
        else:
            # Score-based selection (highest score wins)
            return max(vendor_scores.keys(), key=lambda vid: vendor_scores[vid])

    def _weighted_random_selection(self, vendor_scores: Dict[str, float]) -> str:
        """Select vendor using weighted random selection."""
        vendors = list(vendor_scores.keys())
        weights = list(vendor_scores.values())

        # Ensure weights are positive
        min_weight = min(weights)
        if min_weight <= 0:
            weights = [w - min_weight + 0.1 for w in weights]

        total_weight = sum(weights)
        if total_weight == 0:
            return random.choice(vendors)

        # Weighted random selection
        r = random.random() * total_weight
        cumulative = 0
        for i, weight in enumerate(weights):
            cumulative += weight
            if r <= cumulative:
                return vendors[i]

        return vendors[-1]  # Fallback

    async def _check_canary_override(self, request: DataRequest, candidates: List[VendorAdapter]) -> Optional[str]:
        """Check if any canary vendor should override normal selection."""
        for adapter in candidates:
            if await self.canary_manager.should_use_canary(adapter.vendor_id):
                self.logger.info(f"Using canary vendor override: {adapter.vendor_id}")
                return adapter.vendor_id
        return None

    def _should_hedge_request(self, request: DataRequest) -> bool:
        """Determine if request should use hedging."""
        # Hedge high-priority requests or real-time data
        if hasattr(request, 'priority') and request.priority <= 50:
            return True

        if request.request_type in [RequestType.QUOTE, RequestType.INTRADAY]:
            return True

        return False

    async def _estimate_cost(self, vendor_id: str, request: DataRequest) -> float:
        """Estimate cost for vendor."""
        adapter = self.orchestrator.get_adapter(vendor_id)
        return adapter.calculate_request_cost(request) if adapter else 0.0

    async def _estimate_latency(self, vendor_id: str) -> int:
        """Estimate latency for vendor."""
        metrics = self.vendor_metrics.get(vendor_id, RoutingMetrics())
        return int(metrics.avg_response_time_ms) if metrics.total_requests > 0 else 1000

    async def _record_routing_metrics(self, decision: RoutingDecision, response: DataResponse, success: bool):
        """Record routing metrics for analytics."""
        vendor_id = decision.chosen_vendor_id

        if success:
            self.vendor_metrics[vendor_id].update_success(response.response_time_ms, response.request_cost)
        else:
            self.vendor_metrics[vendor_id].update_failure(response.response_time_ms)

        # Record decision for analysis
        self.recent_decisions.append({
            'timestamp': datetime.utcnow().isoformat(),
            'vendor_id': vendor_id,
            'strategy': decision.strategy_used.value,
            'success': success,
            'response_time_ms': response.response_time_ms,
            'cost': response.request_cost
        })

    async def get_routing_analytics(self) -> Dict[str, Any]:
        """Get comprehensive routing analytics."""
        total_requests = sum(m.total_requests for m in self.vendor_metrics.values())
        successful_requests = sum(m.successful_requests for m in self.vendor_metrics.values())

        analytics = {
            'total_requests': total_requests,
            'successful_requests': successful_requests,
            'success_rate': (successful_requests / total_requests * 100) if total_requests > 0 else 0,
            'vendor_performance': {},
            'recent_decisions': list(self.recent_decisions)[-100:],  # Last 100 decisions
            'strategy_distribution': self._calculate_strategy_distribution()
        }

        for vendor_id, metrics in self.vendor_metrics.items():
            analytics['vendor_performance'][vendor_id] = {
                'total_requests': metrics.total_requests,
                'success_rate': metrics.success_rate,
                'avg_response_time_ms': metrics.avg_response_time_ms,
                'cost_per_request': metrics.cost_per_request,
                'last_updated': metrics.last_updated.isoformat()
            }

        return analytics

    def _calculate_strategy_distribution(self) -> Dict[str, int]:
        """Calculate distribution of routing strategies used."""
        distribution = defaultdict(int)
        for decision in self.recent_decisions:
            distribution[decision['strategy']] += 1
        return dict(distribution)