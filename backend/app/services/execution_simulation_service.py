"""
Execution Simulation Service for Market Microstructure

This service simulates realistic order execution patterns including:
- Trade execution algorithms (TWAP, VWAP, POV, etc.)
- Parent-child order relationships
- Execution quality metrics
- Cross-venue execution routing
- Smart order routing decisions
"""

import asyncio
import random
import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
from collections import defaultdict, deque
import numpy as np
from enum import Enum
import uuid

from ..models.market_microstructure_models import (
    MarketOrder, OrderExecution, ExecutionType, OrderSide, OrderType,
    VenueCharacteristics, ExecutionAlgorithm, AlgorithmParameters,
    ExecutionQuality, TradeReporting, ExecutionVenue, SimulationParameters,
    CrossVenueExecution, OrderBookSnapshot, ParentChildOrder
)

logger = logging.getLogger(__name__)


class ExecutionStrategy(Enum):
    """Order execution strategies"""
    MARKET = "market"
    TWAP = "twap"
    VWAP = "vwap"
    POV = "pov"  # Percentage of Volume
    IMPLEMENTATION_SHORTFALL = "implementation_shortfall"
    ICEBERG = "iceberg"
    HIDDEN = "hidden"
    SMART_ORDER_ROUTING = "smart_routing"


@dataclass
class ExecutionState:
    """Current state of order execution"""
    parent_order_id: str
    strategy: ExecutionStrategy
    target_size: Decimal
    executed_size: Decimal
    remaining_size: Decimal
    average_price: Decimal
    start_time: datetime
    target_completion_time: Optional[datetime]
    algorithm_params: Dict[str, Any]
    child_orders: List[str] = field(default_factory=list)
    execution_quality: Optional[ExecutionQuality] = None


class ExecutionSimulationService:
    """
    Advanced execution simulation service that models realistic order execution
    patterns across different algorithms and market conditions.
    """

    def __init__(
        self,
        venues: List[VenueCharacteristics],
        simulation_params: SimulationParameters
    ):
        self.venues = {venue.venue_name: venue for venue in venues}
        self.params = simulation_params

        # Execution state tracking
        self.active_executions: Dict[str, ExecutionState] = {}
        self.completed_executions: Dict[str, ExecutionState] = {}
        self.execution_history: List[OrderExecution] = []

        # Algorithm configurations
        self.algorithm_configs = {
            ExecutionStrategy.TWAP: {
                "default_duration_minutes": 30,
                "slice_interval_seconds": 60,
                "participation_rate_limit": 0.1
            },
            ExecutionStrategy.VWAP: {
                "historical_lookback_days": 5,
                "participation_rate_limit": 0.15,
                "price_tolerance_bps": 20
            },
            ExecutionStrategy.POV: {
                "default_participation_rate": 0.2,
                "max_participation_rate": 0.4,
                "volume_monitoring_interval": 30
            },
            ExecutionStrategy.IMPLEMENTATION_SHORTFALL: {
                "risk_aversion": 0.5,
                "market_impact_model": "linear",
                "urgency_factor": 1.0
            }
        }

        # Venue routing preferences
        self.routing_preferences = {
            "latency_sensitive": {"primary_venues": ["NYSE", "NASDAQ"], "weight": 0.7},
            "cost_sensitive": {"primary_venues": ["IEX", "BATS"], "weight": 0.8},
            "liquidity_seeking": {"primary_venues": ["Dark Pool 1", "Dark Pool 2"], "weight": 0.6}
        }

        # Market data simulation
        self.market_volumes: Dict[str, Decimal] = {}
        self.venue_market_shares: Dict[str, float] = {}

        logger.info(f"Initialized execution simulation service with {len(venues)} venues")

    async def execute_order(
        self,
        order: MarketOrder,
        strategy: ExecutionStrategy = ExecutionStrategy.SMART_ORDER_ROUTING,
        algorithm_params: Dict[str, Any] = None
    ) -> str:
        """Execute an order using the specified strategy."""
        execution_id = str(uuid.uuid4())

        # Initialize execution state
        execution_state = ExecutionState(
            parent_order_id=execution_id,
            strategy=strategy,
            target_size=order.size,
            executed_size=Decimal("0"),
            remaining_size=order.size,
            average_price=Decimal("0"),
            start_time=datetime.utcnow(),
            target_completion_time=None,
            algorithm_params=algorithm_params or {}
        )

        self.active_executions[execution_id] = execution_state

        # Route to appropriate execution method
        if strategy == ExecutionStrategy.MARKET:
            await self._execute_market_order(execution_id, order)
        elif strategy == ExecutionStrategy.TWAP:
            await self._execute_twap_order(execution_id, order)
        elif strategy == ExecutionStrategy.VWAP:
            await self._execute_vwap_order(execution_id, order)
        elif strategy == ExecutionStrategy.POV:
            await self._execute_pov_order(execution_id, order)
        elif strategy == ExecutionStrategy.IMPLEMENTATION_SHORTFALL:
            await self._execute_is_order(execution_id, order)
        elif strategy == ExecutionStrategy.SMART_ORDER_ROUTING:
            await self._execute_smart_routing_order(execution_id, order)
        else:
            await self._execute_market_order(execution_id, order)  # Default fallback

        logger.info(f"Started execution {execution_id} using {strategy.value} strategy")
        return execution_id

    async def _execute_market_order(self, execution_id: str, order: MarketOrder) -> None:
        """Execute a simple market order."""
        execution_state = self.active_executions[execution_id]

        # Select best venue for immediate execution
        best_venue = await self._select_best_venue_for_market_order(order)

        # Simulate immediate execution
        execution_price = await self._simulate_market_execution_price(order, best_venue)
        latency = await self._simulate_execution_latency(best_venue)

        # Create execution record
        execution = OrderExecution(
            execution_id=f"exec_{execution_id}",
            order_id=order.order_id,
            symbol=order.symbol,
            venue=best_venue.venue_name,
            execution_type=ExecutionType.FULL,
            side=order.side,
            executed_size=order.size,
            executed_price=execution_price,
            commission=self._calculate_commission(order.size, execution_price, best_venue),
            timestamp=datetime.utcnow(),
            latency_ms=latency,
            is_aggressive=True,
            counterparty_type="market_maker",
            market_impact_bps=await self._calculate_market_impact_bps(order, best_venue)
        )

        # Update execution state
        execution_state.executed_size = order.size
        execution_state.remaining_size = Decimal("0")
        execution_state.average_price = execution_price

        self.execution_history.append(execution)
        await self._complete_execution(execution_id)

    async def _execute_twap_order(self, execution_id: str, order: MarketOrder) -> None:
        """Execute TWAP (Time-Weighted Average Price) algorithm."""
        execution_state = self.active_executions[execution_id]
        config = self.algorithm_configs[ExecutionStrategy.TWAP]

        # Calculate TWAP parameters
        duration_minutes = execution_state.algorithm_params.get(
            "duration_minutes", config["default_duration_minutes"]
        )
        slice_interval = execution_state.algorithm_params.get(
            "slice_interval_seconds", config["slice_interval_seconds"]
        )

        execution_state.target_completion_time = (
            execution_state.start_time + timedelta(minutes=duration_minutes)
        )

        # Calculate number of slices
        total_seconds = duration_minutes * 60
        num_slices = max(1, int(total_seconds / slice_interval))
        slice_size = order.size / num_slices

        # Schedule child orders
        for i in range(num_slices):
            slice_time = execution_state.start_time + timedelta(seconds=i * slice_interval)
            child_order_id = f"twap_{execution_id}_{i}"

            # Create child order
            child_order = MarketOrder(
                order_id=child_order_id,
                symbol=order.symbol,
                side=order.side,
                size=slice_size,
                order_type=OrderType.MARKET,
                timestamp=slice_time,
                venue=order.venue,
                client_order_id=f"twap_slice_{i}"
            )

            execution_state.child_orders.append(child_order_id)

            # Schedule execution (in practice, this would be event-driven)
            asyncio.create_task(self._execute_twap_slice(execution_id, child_order, slice_time))

    async def _execute_twap_slice(
        self,
        parent_execution_id: str,
        child_order: MarketOrder,
        execution_time: datetime
    ) -> None:
        """Execute a single TWAP slice."""
        # Wait until execution time
        current_time = datetime.utcnow()
        if execution_time > current_time:
            wait_seconds = (execution_time - current_time).total_seconds()
            await asyncio.sleep(wait_seconds)

        # Select venue for this slice
        venue = await self._select_best_venue_for_slice(child_order)

        # Simulate execution
        execution_price = await self._simulate_slice_execution_price(child_order, venue)
        latency = await self._simulate_execution_latency(venue)

        # Create execution record
        execution = OrderExecution(
            execution_id=f"exec_{child_order.order_id}",
            order_id=child_order.order_id,
            symbol=child_order.symbol,
            venue=venue.venue_name,
            execution_type=ExecutionType.PARTIAL,
            side=child_order.side,
            executed_size=child_order.size,
            executed_price=execution_price,
            commission=self._calculate_commission(child_order.size, execution_price, venue),
            timestamp=datetime.utcnow(),
            latency_ms=latency,
            is_aggressive=True,
            counterparty_type="market_maker",
            market_impact_bps=await self._calculate_market_impact_bps(child_order, venue)
        )

        self.execution_history.append(execution)

        # Update parent execution state
        execution_state = self.active_executions[parent_execution_id]
        execution_state.executed_size += child_order.size
        execution_state.remaining_size -= child_order.size

        # Update average price
        total_value = execution_state.average_price * (execution_state.executed_size - child_order.size)
        total_value += execution_price * child_order.size
        execution_state.average_price = total_value / execution_state.executed_size

        # Check if execution is complete
        if execution_state.remaining_size <= 0:
            await self._complete_execution(parent_execution_id)

    async def _execute_vwap_order(self, execution_id: str, order: MarketOrder) -> None:
        """Execute VWAP (Volume-Weighted Average Price) algorithm."""
        execution_state = self.active_executions[execution_id]
        config = self.algorithm_configs[ExecutionStrategy.VWAP]

        # Get historical volume profile
        volume_profile = await self._get_historical_volume_profile(
            order.symbol, config["historical_lookback_days"]
        )

        # Calculate participation schedule based on volume profile
        participation_schedule = await self._calculate_vwap_schedule(order, volume_profile)

        # Execute slices according to schedule
        for slice_info in participation_schedule:
            child_order_id = f"vwap_{execution_id}_{slice_info['slice_id']}"

            child_order = MarketOrder(
                order_id=child_order_id,
                symbol=order.symbol,
                side=order.side,
                size=slice_info['size'],
                order_type=OrderType.LIMIT,
                limit_price=slice_info.get('limit_price'),
                timestamp=slice_info['execution_time'],
                venue=order.venue,
                client_order_id=f"vwap_slice_{slice_info['slice_id']}"
            )

            execution_state.child_orders.append(child_order_id)
            asyncio.create_task(self._execute_vwap_slice(execution_id, child_order, slice_info))

    async def _execute_pov_order(self, execution_id: str, order: MarketOrder) -> None:
        """Execute POV (Percentage of Volume) algorithm."""
        execution_state = self.active_executions[execution_id]
        config = self.algorithm_configs[ExecutionStrategy.POV]

        target_participation_rate = execution_state.algorithm_params.get(
            "participation_rate", config["default_participation_rate"]
        )

        # Monitor market volume and execute proportionally
        monitoring_interval = config["volume_monitoring_interval"]
        slice_count = 0

        while execution_state.remaining_size > 0:
            # Wait for monitoring interval
            await asyncio.sleep(monitoring_interval)

            # Get current market volume
            current_volume = await self._get_current_market_volume(order.symbol)

            # Calculate slice size based on participation rate
            target_slice_size = current_volume * Decimal(str(target_participation_rate))
            actual_slice_size = min(target_slice_size, execution_state.remaining_size)

            if actual_slice_size > 0:
                child_order_id = f"pov_{execution_id}_{slice_count}"

                child_order = MarketOrder(
                    order_id=child_order_id,
                    symbol=order.symbol,
                    side=order.side,
                    size=actual_slice_size,
                    order_type=OrderType.MARKET,
                    timestamp=datetime.utcnow(),
                    venue=order.venue,
                    client_order_id=f"pov_slice_{slice_count}"
                )

                # Execute slice immediately
                await self._execute_pov_slice(execution_id, child_order)
                slice_count += 1

    async def _execute_smart_routing_order(self, execution_id: str, order: MarketOrder) -> None:
        """Execute using smart order routing across multiple venues."""
        execution_state = self.active_executions[execution_id]

        # Analyze market conditions across venues
        venue_analysis = await self._analyze_venue_conditions(order)

        # Determine optimal routing strategy
        routing_decision = await self._make_routing_decision(order, venue_analysis)

        # Split order across venues
        venue_allocations = await self._calculate_venue_allocations(order, routing_decision)

        # Execute across venues
        for venue_name, allocation in venue_allocations.items():
            if allocation['size'] > 0:
                child_order_id = f"sor_{execution_id}_{venue_name}"

                child_order = MarketOrder(
                    order_id=child_order_id,
                    symbol=order.symbol,
                    side=order.side,
                    size=allocation['size'],
                    order_type=allocation['order_type'],
                    limit_price=allocation.get('limit_price'),
                    timestamp=datetime.utcnow(),
                    venue=venue_name,
                    client_order_id=f"sor_{venue_name}"
                )

                execution_state.child_orders.append(child_order_id)
                asyncio.create_task(self._execute_sor_slice(execution_id, child_order, allocation))

    async def _select_best_venue_for_market_order(self, order: MarketOrder) -> VenueCharacteristics:
        """Select the best venue for immediate market order execution."""
        # Score venues based on liquidity, cost, and latency
        venue_scores = {}

        for venue_name, venue in self.venues.items():
            # Liquidity score (higher is better)
            liquidity_score = venue.average_daily_volume / 1000000  # Normalize

            # Cost score (lower fees are better)
            relevant_fee = venue.taker_fee if order.order_type == OrderType.MARKET else venue.maker_fee
            cost_score = 1.0 / (1.0 + float(relevant_fee) * 1000)  # Invert and normalize

            # Latency score (lower latency is better)
            latency_score = 1.0 / (1.0 + venue.average_latency_ms / 100)

            # Weighted composite score
            composite_score = (
                0.4 * liquidity_score +
                0.4 * cost_score +
                0.2 * latency_score
            )

            venue_scores[venue_name] = composite_score

        # Select venue with highest score
        best_venue_name = max(venue_scores.keys(), key=lambda x: venue_scores[x])
        return self.venues[best_venue_name]

    async def _simulate_market_execution_price(
        self,
        order: MarketOrder,
        venue: VenueCharacteristics
    ) -> Decimal:
        """Simulate market execution price with realistic spread and impact."""
        # Base price (would come from real market data)
        base_price = Decimal("100.00")  # Placeholder

        # Add spread cost
        spread_cost = base_price * venue.typical_spread_bps / 20000  # Half spread

        # Add market impact
        impact_bps = await self._calculate_market_impact_bps(order, venue)
        market_impact = base_price * impact_bps / 10000

        if order.side == OrderSide.BUY:
            execution_price = base_price + spread_cost + market_impact
        else:
            execution_price = base_price - spread_cost - market_impact

        return execution_price.quantize(Decimal("0.01"))

    async def _simulate_execution_latency(self, venue: VenueCharacteristics) -> float:
        """Simulate execution latency with realistic variation."""
        base_latency = venue.average_latency_ms

        # Add randomness (±50% variation)
        variation = random.uniform(0.5, 1.5)

        # Add network jitter
        jitter = random.uniform(-2, 2)

        return max(0.1, base_latency * variation + jitter)

    async def _calculate_market_impact_bps(
        self,
        order: MarketOrder,
        venue: VenueCharacteristics
    ) -> Decimal:
        """Calculate market impact in basis points."""
        # Simple square-root impact model
        participation_rate = float(order.size) / float(venue.average_daily_volume)
        impact_coefficient = 10.0  # Base impact in bps

        # Impact increases with square root of participation rate
        impact_bps = impact_coefficient * (participation_rate ** 0.5) * 10000

        return Decimal(str(min(50.0, impact_bps))).quantize(Decimal("0.01"))  # Cap at 50bps

    def _calculate_commission(
        self,
        size: Decimal,
        price: Decimal,
        venue: VenueCharacteristics
    ) -> Decimal:
        """Calculate commission for execution."""
        notional = size * price

        # Use taker fee for market orders, maker fee for limit orders
        fee_rate = venue.taker_fee  # Assume market orders for simplicity

        commission = notional * fee_rate

        # Add minimum commission if applicable
        min_commission = Decimal("1.00")  # $1 minimum

        return max(commission, min_commission).quantize(Decimal("0.01"))

    async def _get_historical_volume_profile(self, symbol: str, days: int) -> List[Dict[str, Any]]:
        """Get historical volume profile for VWAP calculations."""
        # Simulate intraday volume profile
        # In practice, this would query historical data

        profile = []
        for hour in range(9, 16):  # 9 AM to 4 PM
            for minute in range(0, 60, 30):  # 30-minute intervals
                time_str = f"{hour:02d}:{minute:02d}"

                # U-shaped volume pattern (high at open/close, low at lunch)
                if hour < 11:
                    volume_factor = 1.5 - (hour - 9) * 0.3  # Declining from open
                elif hour < 14:
                    volume_factor = 0.6  # Lunch lull
                else:
                    volume_factor = 0.7 + (hour - 14) * 0.4  # Rising to close

                profile.append({
                    "time": time_str,
                    "volume_factor": volume_factor,
                    "historical_volume": Decimal(str(1000 * volume_factor))
                })

        return profile

    async def _calculate_vwap_schedule(
        self,
        order: MarketOrder,
        volume_profile: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Calculate VWAP execution schedule."""
        total_historical_volume = sum(interval["historical_volume"] for interval in volume_profile)

        schedule = []
        for i, interval in enumerate(volume_profile):
            # Allocate order size proportional to historical volume
            proportion = interval["historical_volume"] / total_historical_volume
            slice_size = order.size * proportion

            schedule.append({
                "slice_id": i,
                "execution_time": datetime.utcnow() + timedelta(minutes=i * 30),
                "size": slice_size,
                "historical_volume": interval["historical_volume"],
                "limit_price": None  # Would calculate based on current market
            })

        return schedule

    async def _get_current_market_volume(self, symbol: str) -> Decimal:
        """Get current market volume for POV calculations."""
        # Simulate current volume
        # In practice, this would use real-time market data

        base_volume = Decimal("1000")
        time_factor = random.uniform(0.5, 2.0)  # Volume variability

        return base_volume * Decimal(str(time_factor))

    async def _analyze_venue_conditions(self, order: MarketOrder) -> Dict[str, Dict[str, Any]]:
        """Analyze current conditions across all venues."""
        analysis = {}

        for venue_name, venue in self.venues.items():
            # Simulate current venue conditions
            analysis[venue_name] = {
                "liquidity_score": random.uniform(0.3, 1.0),
                "spread_bps": venue.typical_spread_bps * random.uniform(0.8, 1.5),
                "latency_ms": venue.average_latency_ms * random.uniform(0.7, 1.3),
                "fee_rate": venue.taker_fee,
                "market_share": self.venue_market_shares.get(venue_name, 0.1),
                "order_fill_rate": random.uniform(0.7, 0.95)
            }

        return analysis

    async def _make_routing_decision(
        self,
        order: MarketOrder,
        venue_analysis: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Make smart routing decision based on order characteristics."""
        # Determine routing strategy based on order size and urgency
        if order.size > Decimal("10000"):
            strategy = "liquidity_seeking"
        elif order.order_type == OrderType.MARKET:
            strategy = "latency_sensitive"
        else:
            strategy = "cost_sensitive"

        return {
            "strategy": strategy,
            "primary_venues": self.routing_preferences[strategy]["primary_venues"],
            "venue_analysis": venue_analysis,
            "max_venues": 3,  # Don't split across too many venues
            "min_slice_size": order.size * Decimal("0.1")  # Minimum 10% allocation
        }

    async def _calculate_venue_allocations(
        self,
        order: MarketOrder,
        routing_decision: Dict[str, Any]
    ) -> Dict[str, Dict[str, Any]]:
        """Calculate how to allocate order across venues."""
        allocations = {}
        remaining_size = order.size

        # Score and rank venues
        venue_scores = {}
        for venue_name in routing_decision["primary_venues"]:
            if venue_name in self.venues:
                analysis = routing_decision["venue_analysis"][venue_name]

                # Composite scoring based on strategy
                if routing_decision["strategy"] == "liquidity_seeking":
                    score = analysis["liquidity_score"] * 0.6 + analysis["order_fill_rate"] * 0.4
                elif routing_decision["strategy"] == "latency_sensitive":
                    score = (1.0 / analysis["latency_ms"]) * 0.7 + analysis["liquidity_score"] * 0.3
                else:  # cost_sensitive
                    score = (1.0 / analysis["fee_rate"]) * 0.5 + analysis["liquidity_score"] * 0.5

                venue_scores[venue_name] = score

        # Allocate proportionally to scores
        total_score = sum(venue_scores.values())

        for venue_name, score in venue_scores.items():
            if remaining_size <= 0:
                break

            proportion = score / total_score
            allocation_size = min(order.size * Decimal(str(proportion)), remaining_size)

            # Ensure minimum allocation size
            if allocation_size >= routing_decision["min_slice_size"]:
                allocations[venue_name] = {
                    "size": allocation_size,
                    "order_type": OrderType.MARKET,  # Simplify for demo
                    "venue": self.venues[venue_name]
                }
                remaining_size -= allocation_size

        # Allocate any remaining size to best venue
        if remaining_size > 0 and allocations:
            best_venue = max(venue_scores.keys(), key=lambda x: venue_scores[x])
            if best_venue in allocations:
                allocations[best_venue]["size"] += remaining_size

        return allocations

    async def _complete_execution(self, execution_id: str) -> None:
        """Mark execution as complete and calculate quality metrics."""
        if execution_id not in self.active_executions:
            return

        execution_state = self.active_executions.pop(execution_id)

        # Calculate execution quality metrics
        quality_metrics = await self._calculate_execution_quality(execution_state)
        execution_state.execution_quality = quality_metrics

        self.completed_executions[execution_id] = execution_state

        logger.info(f"Completed execution {execution_id}: "
                   f"executed {execution_state.executed_size} at avg price {execution_state.average_price}")

    async def _calculate_execution_quality(self, execution_state: ExecutionState) -> ExecutionQuality:
        """Calculate execution quality metrics."""
        # Get relevant executions for this parent order
        relevant_executions = [
            exec for exec in self.execution_history
            if exec.order_id in execution_state.child_orders or
               exec.order_id == execution_state.parent_order_id
        ]

        if not relevant_executions:
            # Return default quality metrics
            return ExecutionQuality(
                symbol="-",
                venue="-",
                timestamp=execution_state.start_time,
                execution_type=ExecutionType.FULL,
                total_executed_size=execution_state.executed_size,
                volume_weighted_price=execution_state.average_price,
                arrival_price=execution_state.average_price,
                benchmark_price=execution_state.average_price,
                implementation_shortfall_bps=Decimal("0"),
                market_impact_bps=Decimal("0"),
                timing_cost_bps=Decimal("0"),
                commission_bps=Decimal("0"),
                total_cost_bps=Decimal("0"),
                fill_rate=1.0,
                average_fill_size=execution_state.executed_size,
                number_of_fills=1,
                execution_duration_seconds=0.0,
                venues_used=1
            )

        # Calculate metrics from actual executions
        total_volume = sum(exec.executed_size for exec in relevant_executions)
        total_value = sum(exec.executed_size * exec.executed_price for exec in relevant_executions)
        vwap = total_value / total_volume if total_volume > 0 else Decimal("0")

        total_commission = sum(exec.commission for exec in relevant_executions)
        commission_bps = (total_commission / total_value * 10000) if total_value > 0 else Decimal("0")

        # Calculate implementation shortfall (simplified)
        arrival_price = execution_state.average_price  # Placeholder
        implementation_shortfall = abs(vwap - arrival_price) / arrival_price * 10000

        execution_duration = (datetime.utcnow() - execution_state.start_time).total_seconds()

        return ExecutionQuality(
            symbol=relevant_executions[0].symbol,
            venue="MULTIPLE" if len(set(exec.venue for exec in relevant_executions)) > 1
                   else relevant_executions[0].venue,
            timestamp=execution_state.start_time,
            execution_type=ExecutionType.FULL,
            total_executed_size=total_volume,
            volume_weighted_price=vwap,
            arrival_price=arrival_price,
            benchmark_price=arrival_price,  # Simplified
            implementation_shortfall_bps=implementation_shortfall,
            market_impact_bps=sum(exec.market_impact_bps for exec in relevant_executions) / len(relevant_executions),
            timing_cost_bps=Decimal("0"),  # Would calculate based on benchmark
            commission_bps=commission_bps,
            total_cost_bps=implementation_shortfall + commission_bps,
            fill_rate=float(total_volume / execution_state.target_size),
            average_fill_size=total_volume / len(relevant_executions),
            number_of_fills=len(relevant_executions),
            execution_duration_seconds=execution_duration,
            venues_used=len(set(exec.venue for exec in relevant_executions))
        )

    def get_execution_status(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of an execution."""
        if execution_id in self.active_executions:
            state = self.active_executions[execution_id]
            return {
                "status": "active",
                "strategy": state.strategy.value,
                "progress": float(state.executed_size / state.target_size),
                "executed_size": float(state.executed_size),
                "remaining_size": float(state.remaining_size),
                "average_price": float(state.average_price),
                "child_orders": len(state.child_orders),
                "start_time": state.start_time,
                "target_completion": state.target_completion_time
            }
        elif execution_id in self.completed_executions:
            state = self.completed_executions[execution_id]
            return {
                "status": "completed",
                "strategy": state.strategy.value,
                "executed_size": float(state.executed_size),
                "average_price": float(state.average_price),
                "execution_quality": state.execution_quality,
                "start_time": state.start_time,
                "completion_time": datetime.utcnow()
            }
        else:
            return None

    def get_execution_analytics(self) -> Dict[str, Any]:
        """Get execution analytics and performance metrics."""
        total_executions = len(self.completed_executions)

        if total_executions == 0:
            return {"message": "No completed executions"}

        # Calculate aggregate metrics
        avg_fill_rate = sum(
            state.execution_quality.fill_rate
            for state in self.completed_executions.values()
            if state.execution_quality
        ) / total_executions

        strategy_distribution = {}
        for state in self.completed_executions.values():
            strategy = state.strategy.value
            strategy_distribution[strategy] = strategy_distribution.get(strategy, 0) + 1

        return {
            "total_executions": total_executions,
            "active_executions": len(self.active_executions),
            "average_fill_rate": avg_fill_rate,
            "strategy_distribution": strategy_distribution,
            "total_executed_volume": sum(
                float(state.executed_size) for state in self.completed_executions.values()
            ),
            "venues_utilized": len(self.venues)
        }