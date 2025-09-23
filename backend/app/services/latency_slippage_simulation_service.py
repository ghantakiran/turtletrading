"""
Latency and Slippage Simulation Service for Market Microstructure

This service provides realistic simulation of trading latencies and slippage including:
- Network latency modeling (one-way and round-trip)
- Order processing delays at venues
- Market data latency and staleness effects
- Price slippage due to market movement during execution
- Queue position effects on execution timing
- Technology infrastructure impact on latency
"""

import asyncio
import random
import logging
import math
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
from collections import defaultdict, deque
import numpy as np
from enum import Enum

from ..models.market_microstructure_models import (
    VenueCharacteristics, MarketOrder, OrderSide, OrderType,
    LatencyModel, SlippageComponent, SimulationParameters,
    LatencyBreakdown, SlippageAnalysis, NetworkPath, TechnologyStack
)

logger = logging.getLogger(__name__)


class LatencySource(Enum):
    """Sources of trading latency"""
    NETWORK_ONE_WAY = "network_one_way"
    NETWORK_ROUND_TRIP = "network_round_trip"
    ORDER_PROCESSING = "order_processing"
    MARKET_DATA_DELAY = "market_data_delay"
    VENUE_QUEUE_TIME = "venue_queue_time"
    RISK_CHECK_DELAY = "risk_check_delay"
    SERIALIZATION = "serialization"
    TECHNOLOGY_STACK = "technology_stack"


class SlippageType(Enum):
    """Types of slippage"""
    MARKET_MOVEMENT = "market_movement"  # Price moved while order was in flight
    QUEUE_POSITION = "queue_position"    # Worse execution due to queue position
    LIQUIDITY_DEPLETION = "liquidity_depletion"  # Available liquidity consumed
    ADVERSE_SELECTION = "adverse_selection"  # Picked off by faster traders
    VENUE_SPECIFIC = "venue_specific"    # Venue-specific execution delays


@dataclass
class LatencyConfiguration:
    """Configuration for latency simulation"""
    # Network latency parameters (milliseconds)
    base_network_latency: float = 1.0
    network_jitter_std: float = 0.5
    network_congestion_factor: float = 1.0

    # Processing latency parameters
    order_validation_time: float = 0.5
    risk_check_time: float = 1.0
    serialization_time: float = 0.2

    # Queue parameters
    base_queue_time: float = 2.0
    queue_congestion_multiplier: float = 2.0

    # Market data latency
    market_data_refresh_rate: float = 10.0  # milliseconds
    market_data_staleness_factor: float = 1.5


@dataclass
class SlippageConfiguration:
    """Configuration for slippage simulation"""
    # Market movement parameters
    volatility_factor: float = 1.0
    momentum_factor: float = 0.5
    mean_reversion_factor: float = 0.3

    # Queue position parameters
    average_queue_depth: int = 5
    queue_improvement_probability: float = 0.3

    # Liquidity parameters
    liquidity_depletion_threshold: float = 0.1  # 10% of available size
    adverse_selection_probability: float = 0.05

    # Venue-specific parameters
    venue_efficiency_scores: Dict[str, float] = field(default_factory=dict)


class LatencySlippageSimulationService:
    """
    Advanced latency and slippage simulation service that models realistic
    trading infrastructure delays and market impact effects.
    """

    def __init__(
        self,
        venues: List[VenueCharacteristics],
        simulation_params: SimulationParameters,
        latency_config: LatencyConfiguration = None,
        slippage_config: SlippageConfiguration = None
    ):
        self.venues = {venue.venue_name: venue for venue in venues}
        self.params = simulation_params
        self.latency_config = latency_config or LatencyConfiguration()
        self.slippage_config = slippage_config or SlippageConfiguration()

        # Simulation state
        self.latency_history: List[LatencyBreakdown] = []
        self.slippage_history: List[SlippageAnalysis] = []

        # Network topology simulation
        self.network_paths: Dict[str, NetworkPath] = {}
        self.technology_stacks: Dict[str, TechnologyStack] = {}

        # Dynamic market conditions
        self.current_volatility = 1.0
        self.market_momentum = 0.0
        self.liquidity_conditions: Dict[str, float] = {}

        # Initialize network paths and technology stacks
        self._initialize_network_topology()
        self._initialize_technology_stacks()

        logger.info("Initialized latency and slippage simulation service")

    def _initialize_network_topology(self) -> None:
        """Initialize network path characteristics between client and venues."""

        # Common network paths in trading
        network_configs = {
            "colocated": {
                "base_latency": 0.1,  # Microseconds for colocation
                "jitter_std": 0.05,
                "congestion_sensitivity": 0.1
            },
            "low_latency_fiber": {
                "base_latency": 0.8,
                "jitter_std": 0.2,
                "congestion_sensitivity": 0.3
            },
            "standard_internet": {
                "base_latency": 15.0,
                "jitter_std": 5.0,
                "congestion_sensitivity": 1.0
            },
            "wireless_backup": {
                "base_latency": 50.0,
                "jitter_std": 20.0,
                "congestion_sensitivity": 2.0
            }
        }

        for venue_name in self.venues.keys():
            # Assign network path based on venue (simplified)
            if "colocated" in venue_name.lower():
                path_type = "colocated"
            elif venue_name in ["NYSE", "NASDAQ"]:
                path_type = "low_latency_fiber"
            else:
                path_type = "standard_internet"

            config = network_configs[path_type]

            self.network_paths[venue_name] = NetworkPath(
                venue=venue_name,
                path_type=path_type,
                base_latency_ms=config["base_latency"],
                jitter_std_ms=config["jitter_std"],
                congestion_factor=1.0,
                packet_loss_rate=0.001,  # 0.1% packet loss
                bandwidth_mbps=1000.0,   # 1 Gbps
                is_active=True
            )

    def _initialize_technology_stacks(self) -> None:
        """Initialize technology stack characteristics affecting latency."""

        stack_configs = {
            "ultra_low_latency": {
                "hardware_latency": 0.05,
                "software_latency": 0.1,
                "serialization_latency": 0.02
            },
            "low_latency": {
                "hardware_latency": 0.2,
                "software_latency": 0.5,
                "serialization_latency": 0.1
            },
            "standard": {
                "hardware_latency": 1.0,
                "software_latency": 2.0,
                "serialization_latency": 0.5
            }
        }

        for venue_name in self.venues.keys():
            # Assign technology stack based on venue characteristics
            if self.venues[venue_name].average_latency_ms < 1.0:
                stack_type = "ultra_low_latency"
            elif self.venues[venue_name].average_latency_ms < 5.0:
                stack_type = "low_latency"
            else:
                stack_type = "standard"

            config = stack_configs[stack_type]

            self.technology_stacks[venue_name] = TechnologyStack(
                venue=venue_name,
                stack_type=stack_type,
                hardware_latency_ms=config["hardware_latency"],
                software_latency_ms=config["software_latency"],
                serialization_latency_ms=config["serialization_latency"],
                is_optimized=stack_type in ["ultra_low_latency", "low_latency"]
            )

    async def simulate_order_latency(
        self,
        order: MarketOrder,
        venue_name: str,
        current_time: datetime = None
    ) -> LatencyBreakdown:
        """Simulate comprehensive order latency breakdown."""

        if not current_time:
            current_time = datetime.utcnow()

        venue = self.venues.get(venue_name)
        if not venue:
            raise ValueError(f"Unknown venue: {venue_name}")

        # Initialize latency components
        latency_components = {}

        # 1. Network latency (one-way)
        network_latency = await self._simulate_network_latency(venue_name)
        latency_components[LatencySource.NETWORK_ONE_WAY] = network_latency

        # 2. Order processing latency
        processing_latency = await self._simulate_order_processing_latency(order, venue)
        latency_components[LatencySource.ORDER_PROCESSING] = processing_latency

        # 3. Venue queue time
        queue_latency = await self._simulate_venue_queue_latency(order, venue, current_time)
        latency_components[LatencySource.VENUE_QUEUE_TIME] = queue_latency

        # 4. Risk check latency
        risk_latency = await self._simulate_risk_check_latency(order)
        latency_components[LatencySource.RISK_CHECK_DELAY] = risk_latency

        # 5. Technology stack latency
        tech_latency = await self._simulate_technology_stack_latency(venue_name)
        latency_components[LatencySource.TECHNOLOGY_STACK] = tech_latency

        # 6. Market data staleness effect
        data_latency = await self._simulate_market_data_latency()
        latency_components[LatencySource.MARKET_DATA_DELAY] = data_latency

        # Calculate total latency
        total_latency = sum(latency_components.values())

        # Create latency breakdown
        breakdown = LatencyBreakdown(
            order_id=order.order_id,
            venue=venue_name,
            timestamp=current_time,
            total_latency_ms=total_latency,
            network_latency_ms=network_latency,
            processing_latency_ms=processing_latency,
            queue_latency_ms=queue_latency,
            risk_check_latency_ms=risk_latency,
            technology_latency_ms=tech_latency,
            market_data_latency_ms=data_latency,
            latency_percentile=await self._calculate_latency_percentile(total_latency, venue)
        )

        # Store in history
        self.latency_history.append(breakdown)

        logger.debug(f"Order {order.order_id} total latency: {total_latency:.2f}ms "
                    f"(network: {network_latency:.2f}, processing: {processing_latency:.2f}, "
                    f"queue: {queue_latency:.2f})")

        return breakdown

    async def simulate_execution_slippage(
        self,
        order: MarketOrder,
        venue_name: str,
        intended_price: Decimal,
        execution_price: Decimal,
        latency_ms: float,
        current_time: datetime = None
    ) -> SlippageAnalysis:
        """Simulate and analyze execution slippage."""

        if not current_time:
            current_time = datetime.utcnow()

        # Calculate raw slippage
        raw_slippage_bps = self._calculate_raw_slippage_bps(
            intended_price, execution_price, order.side
        )

        # Decompose slippage into components
        slippage_components = await self._decompose_slippage_components(
            order, venue_name, intended_price, execution_price, latency_ms
        )

        # Calculate confidence in slippage attribution
        attribution_confidence = await self._calculate_slippage_attribution_confidence(
            slippage_components, latency_ms
        )

        # Create slippage analysis
        analysis = SlippageAnalysis(
            order_id=order.order_id,
            venue=venue_name,
            timestamp=current_time,
            intended_price=intended_price,
            executed_price=execution_price,
            total_slippage_bps=raw_slippage_bps,
            market_movement_bps=slippage_components.get(SlippageType.MARKET_MOVEMENT, 0.0),
            queue_position_bps=slippage_components.get(SlippageType.QUEUE_POSITION, 0.0),
            liquidity_impact_bps=slippage_components.get(SlippageType.LIQUIDITY_DEPLETION, 0.0),
            adverse_selection_bps=slippage_components.get(SlippageType.ADVERSE_SELECTION, 0.0),
            venue_efficiency_score=self._get_venue_efficiency_score(venue_name),
            attribution_confidence=attribution_confidence,
            latency_contribution_ms=latency_ms
        )

        # Store in history
        self.slippage_history.append(analysis)

        logger.debug(f"Order {order.order_id} slippage analysis: {raw_slippage_bps:.2f}bps total "
                    f"(market: {slippage_components.get(SlippageType.MARKET_MOVEMENT, 0):.2f}, "
                    f"queue: {slippage_components.get(SlippageType.QUEUE_POSITION, 0):.2f})")

        return analysis

    async def _simulate_network_latency(self, venue_name: str) -> float:
        """Simulate network latency to venue."""

        network_path = self.network_paths.get(venue_name)
        if not network_path:
            return self.latency_config.base_network_latency

        # Base latency with jitter
        base_latency = network_path.base_latency_ms
        jitter = random.gauss(0, network_path.jitter_std_ms)

        # Add congestion effects
        congestion_multiplier = (
            network_path.congestion_factor *
            self.latency_config.network_congestion_factor
        )

        # Time-of-day effects (higher latency during market hours)
        time_factor = await self._get_time_of_day_latency_factor()

        total_latency = (base_latency + jitter) * congestion_multiplier * time_factor

        return max(0.01, total_latency)  # Minimum 0.01ms

    async def _simulate_order_processing_latency(
        self,
        order: MarketOrder,
        venue: VenueCharacteristics
    ) -> float:
        """Simulate order processing latency at venue."""

        # Base processing time
        base_time = self.latency_config.order_validation_time

        # Order type effects
        type_multiplier = {
            OrderType.MARKET: 1.0,
            OrderType.LIMIT: 1.2,
            OrderType.STOP: 1.5,
            OrderType.STOP_LIMIT: 1.8
        }.get(order.order_type, 1.0)

        # Order size effects (larger orders take slightly longer)
        size_factor = 1.0 + math.log(1 + float(order.size) / 1000) * 0.1

        # Venue efficiency
        venue_factor = venue.average_latency_ms / 10.0  # Normalize

        processing_time = base_time * type_multiplier * size_factor * venue_factor

        # Add random variation
        variation = random.uniform(0.8, 1.2)

        return processing_time * variation

    async def _simulate_venue_queue_latency(
        self,
        order: MarketOrder,
        venue: VenueCharacteristics,
        current_time: datetime
    ) -> float:
        """Simulate queue waiting time at venue."""

        # Base queue time
        base_queue_time = self.latency_config.base_queue_time

        # Market hours congestion (higher during active trading)
        congestion_factor = await self._get_market_congestion_factor(current_time)

        # Order priority (market orders get higher priority)
        priority_factor = {
            OrderType.MARKET: 0.5,
            OrderType.LIMIT: 1.0,
            OrderType.STOP: 1.3,
            OrderType.STOP_LIMIT: 1.5
        }.get(order.order_type, 1.0)

        # Venue capacity (venues with higher volume handle orders faster)
        capacity_factor = 10000000 / max(1000000, venue.average_daily_volume)  # Inverse relationship

        queue_time = (
            base_queue_time *
            congestion_factor *
            priority_factor *
            capacity_factor
        )

        # Add exponential tail for queue spikes
        if random.random() < 0.05:  # 5% chance of queue spike
            queue_time *= random.uniform(2.0, 5.0)

        return queue_time

    async def _simulate_risk_check_latency(self, order: MarketOrder) -> float:
        """Simulate risk check processing time."""

        base_risk_time = self.latency_config.risk_check_time

        # Order size risk factor (larger orders require more checks)
        size_factor = 1.0 + math.log(1 + float(order.size) / 1000) * 0.2

        # Order type risk factor
        type_factor = {
            OrderType.MARKET: 1.0,
            OrderType.LIMIT: 0.8,
            OrderType.STOP: 1.5,
            OrderType.STOP_LIMIT: 1.8
        }.get(order.order_type, 1.0)

        risk_time = base_risk_time * size_factor * type_factor

        # Occasional additional compliance checks
        if random.random() < 0.02:  # 2% chance
            risk_time += random.uniform(5.0, 15.0)  # Additional 5-15ms

        return risk_time

    async def _simulate_technology_stack_latency(self, venue_name: str) -> float:
        """Simulate technology stack processing latency."""

        tech_stack = self.technology_stacks.get(venue_name)
        if not tech_stack:
            return 1.0  # Default 1ms

        # Sum of technology components
        hardware_latency = tech_stack.hardware_latency_ms
        software_latency = tech_stack.software_latency_ms
        serialization_latency = tech_stack.serialization_latency_ms

        total_tech_latency = hardware_latency + software_latency + serialization_latency

        # Add optimization benefits
        if tech_stack.is_optimized:
            total_tech_latency *= 0.7  # 30% improvement for optimized stacks

        return total_tech_latency

    async def _simulate_market_data_latency(self) -> float:
        """Simulate market data staleness effects."""

        # Market data refresh rate effects
        refresh_rate = self.latency_config.market_data_refresh_rate
        staleness_factor = self.latency_config.market_data_staleness_factor

        # Simulate data age
        data_age = random.uniform(0, refresh_rate)

        # Convert to effective latency
        effective_latency = data_age * staleness_factor

        return effective_latency

    async def _get_time_of_day_latency_factor(self) -> float:
        """Get time-of-day latency adjustment factor."""

        current_hour = datetime.utcnow().hour

        # Market hours have higher latency due to congestion
        if 9 <= current_hour <= 16:  # Market hours (approximate)
            if 9 <= current_hour <= 10 or 15 <= current_hour <= 16:
                return 1.5  # Opening and closing have highest latency
            else:
                return 1.2  # Regular market hours
        else:
            return 0.8  # After hours, lower latency

    async def _get_market_congestion_factor(self, current_time: datetime) -> float:
        """Get market congestion factor based on time and conditions."""

        hour = current_time.hour
        minute = current_time.minute

        # Higher congestion during market open/close
        if hour == 9 and minute < 30:  # Market open
            return 2.0
        elif hour == 15 and minute >= 30:  # Market close
            return 2.5
        elif 10 <= hour <= 15:  # Regular trading hours
            return 1.3
        else:
            return 0.7  # After hours

    async def _calculate_latency_percentile(
        self,
        latency: float,
        venue: VenueCharacteristics
    ) -> float:
        """Calculate what percentile this latency represents for the venue."""

        # Use venue's average latency to estimate distribution
        venue_avg = venue.average_latency_ms

        # Assume log-normal distribution of latencies
        # This is a simplified model - in practice would use historical data
        if latency <= venue_avg * 0.5:
            return 10.0  # Very fast
        elif latency <= venue_avg:
            return 50.0  # Median
        elif latency <= venue_avg * 2:
            return 80.0  # Slower than average
        elif latency <= venue_avg * 5:
            return 95.0  # Very slow
        else:
            return 99.0  # Extremely slow

    def _calculate_raw_slippage_bps(
        self,
        intended_price: Decimal,
        execution_price: Decimal,
        side: OrderSide
    ) -> Decimal:
        """Calculate raw slippage in basis points."""

        if intended_price == 0:
            return Decimal("0")

        price_diff = execution_price - intended_price

        # For buy orders, positive slippage is bad (paid more)
        # For sell orders, negative slippage is bad (received less)
        if side == OrderSide.SELL:
            price_diff = -price_diff

        slippage_bps = (price_diff / intended_price) * 10000

        return slippage_bps.quantize(Decimal("0.01"))

    async def _decompose_slippage_components(
        self,
        order: MarketOrder,
        venue_name: str,
        intended_price: Decimal,
        execution_price: Decimal,
        latency_ms: float
    ) -> Dict[SlippageType, float]:
        """Decompose total slippage into contributing factors."""

        total_slippage_bps = float(self._calculate_raw_slippage_bps(
            intended_price, execution_price, order.side
        ))

        components = {}

        # 1. Market movement component (due to latency)
        market_movement = await self._estimate_market_movement_slippage(
            latency_ms, float(intended_price)
        )
        components[SlippageType.MARKET_MOVEMENT] = market_movement

        # 2. Queue position component
        queue_position = await self._estimate_queue_position_slippage(
            order, venue_name, latency_ms
        )
        components[SlippageType.QUEUE_POSITION] = queue_position

        # 3. Liquidity depletion component
        liquidity_depletion = await self._estimate_liquidity_depletion_slippage(
            order, venue_name
        )
        components[SlippageType.LIQUIDITY_DEPLETION] = liquidity_depletion

        # 4. Adverse selection component
        adverse_selection = await self._estimate_adverse_selection_slippage(
            order, latency_ms
        )
        components[SlippageType.ADVERSE_SELECTION] = adverse_selection

        # 5. Venue-specific component (residual)
        explained_slippage = sum(components.values())
        venue_specific = max(0, total_slippage_bps - explained_slippage)
        components[SlippageType.VENUE_SPECIFIC] = venue_specific

        return components

    async def _estimate_market_movement_slippage(
        self,
        latency_ms: float,
        price_level: float
    ) -> float:
        """Estimate slippage due to market movement during order latency."""

        # Use volatility to estimate price movement
        latency_seconds = latency_ms / 1000.0

        # Estimate instantaneous volatility (simplified)
        annual_vol = 0.25  # 25% annual volatility assumption
        instantaneous_vol = annual_vol / math.sqrt(252 * 24 * 3600)  # Per second

        # Expected price movement during latency period
        expected_movement = instantaneous_vol * math.sqrt(latency_seconds) * price_level

        # Convert to basis points
        movement_bps = (expected_movement / price_level) * 10000

        # Add momentum effects
        momentum_adjustment = self.market_momentum * 0.1  # 10% of momentum

        return movement_bps + momentum_adjustment

    async def _estimate_queue_position_slippage(
        self,
        order: MarketOrder,
        venue_name: str,
        latency_ms: float
    ) -> float:
        """Estimate slippage due to queue position effects."""

        # Higher latency generally means worse queue position
        base_queue_slippage = latency_ms * 0.01  # 0.01 bps per ms

        # Order type effects
        type_multiplier = {
            OrderType.MARKET: 0.5,    # Market orders get priority
            OrderType.LIMIT: 1.0,
            OrderType.STOP: 1.5,
            OrderType.STOP_LIMIT: 2.0
        }.get(order.order_type, 1.0)

        # Order size effects (larger orders more likely to be partially filled)
        size_factor = math.log(1 + float(order.size) / 1000) * 0.1

        queue_slippage = base_queue_slippage * type_multiplier * (1 + size_factor)

        return queue_slippage

    async def _estimate_liquidity_depletion_slippage(
        self,
        order: MarketOrder,
        venue_name: str
    ) -> float:
        """Estimate slippage due to liquidity depletion."""

        venue = self.venues.get(venue_name)
        if not venue:
            return 0.0

        # Estimate participation rate
        daily_volume = venue.average_daily_volume
        minute_volume = daily_volume / (6.5 * 60)  # Trading minutes per day
        participation_rate = float(order.size) / float(minute_volume)

        # Liquidity depletion slippage increases with participation rate
        if participation_rate > self.slippage_config.liquidity_depletion_threshold:
            excess_participation = participation_rate - self.slippage_config.liquidity_depletion_threshold
            liquidity_slippage = excess_participation * 50.0  # 50 bps per 1% excess participation
        else:
            liquidity_slippage = 0.0

        return liquidity_slippage

    async def _estimate_adverse_selection_slippage(
        self,
        order: MarketOrder,
        latency_ms: float
    ) -> float:
        """Estimate slippage due to adverse selection by faster traders."""

        # Adverse selection increases with latency
        latency_factor = latency_ms / 10.0  # Normalize to 10ms baseline

        # Market orders are more susceptible to adverse selection
        order_type_factor = {
            OrderType.MARKET: 2.0,
            OrderType.LIMIT: 1.0,
            OrderType.STOP: 1.5,
            OrderType.STOP_LIMIT: 1.3
        }.get(order.order_type, 1.0)

        # Base adverse selection probability
        base_probability = self.slippage_config.adverse_selection_probability

        # Estimate adverse selection slippage
        if random.random() < base_probability * latency_factor:
            # If adverse selection occurs, estimate impact
            adverse_slippage = random.uniform(1.0, 5.0)  # 1-5 bps
            return adverse_slippage * order_type_factor
        else:
            return 0.0

    def _get_venue_efficiency_score(self, venue_name: str) -> float:
        """Get venue efficiency score from configuration."""

        return self.slippage_config.venue_efficiency_scores.get(venue_name, 0.5)

    async def _calculate_slippage_attribution_confidence(
        self,
        components: Dict[SlippageType, float],
        latency_ms: float
    ) -> float:
        """Calculate confidence in slippage component attribution."""

        # Higher latency generally means lower confidence in attribution
        latency_confidence = max(0.3, 1.0 - latency_ms / 100.0)  # Lower confidence for > 100ms

        # More balanced components mean higher confidence
        total_slippage = sum(components.values())
        if total_slippage > 0:
            component_weights = [v / total_slippage for v in components.values()]
            entropy = -sum(w * math.log(w + 1e-10) for w in component_weights if w > 0)
            max_entropy = math.log(len(components))
            balance_confidence = entropy / max_entropy
        else:
            balance_confidence = 1.0

        # Combined confidence
        overall_confidence = (latency_confidence + balance_confidence) / 2.0

        return overall_confidence

    def update_market_conditions(
        self,
        volatility: float = None,
        momentum: float = None,
        liquidity_scores: Dict[str, float] = None
    ) -> None:
        """Update current market conditions affecting latency and slippage."""

        if volatility is not None:
            self.current_volatility = volatility

        if momentum is not None:
            self.market_momentum = momentum

        if liquidity_scores is not None:
            self.liquidity_conditions.update(liquidity_scores)

        logger.debug(f"Updated market conditions: vol={self.current_volatility:.2f}, "
                    f"momentum={self.market_momentum:.2f}")

    def get_latency_analytics(self) -> Dict[str, Any]:
        """Get latency analytics and performance metrics."""

        if not self.latency_history:
            return {"message": "No latency data available"}

        latencies = [l.total_latency_ms for l in self.latency_history]

        return {
            "total_measurements": len(self.latency_history),
            "average_latency_ms": sum(latencies) / len(latencies),
            "median_latency_ms": sorted(latencies)[len(latencies) // 2],
            "p95_latency_ms": sorted(latencies)[int(len(latencies) * 0.95)],
            "p99_latency_ms": sorted(latencies)[int(len(latencies) * 0.99)],
            "max_latency_ms": max(latencies),
            "min_latency_ms": min(latencies),
            "venue_count": len(set(l.venue for l in self.latency_history)),
            "network_paths": len(self.network_paths),
            "technology_stacks": len(self.technology_stacks)
        }

    def get_slippage_analytics(self) -> Dict[str, Any]:
        """Get slippage analytics and performance metrics."""

        if not self.slippage_history:
            return {"message": "No slippage data available"}

        slippages = [float(s.total_slippage_bps) for s in self.slippage_history]

        # Component analysis
        market_movement = [float(s.market_movement_bps) for s in self.slippage_history]
        queue_position = [float(s.queue_position_bps) for s in self.slippage_history]
        liquidity_impact = [float(s.liquidity_impact_bps) for s in self.slippage_history]

        return {
            "total_measurements": len(self.slippage_history),
            "average_slippage_bps": sum(slippages) / len(slippages),
            "median_slippage_bps": sorted(slippages)[len(slippages) // 2],
            "positive_slippage_rate": len([s for s in slippages if s > 0]) / len(slippages),
            "component_averages": {
                "market_movement_bps": sum(market_movement) / len(market_movement),
                "queue_position_bps": sum(queue_position) / len(queue_position),
                "liquidity_impact_bps": sum(liquidity_impact) / len(liquidity_impact)
            },
            "venue_count": len(set(s.venue for s in self.slippage_history)),
            "average_attribution_confidence": sum(s.attribution_confidence for s in self.slippage_history) / len(self.slippage_history)
        }