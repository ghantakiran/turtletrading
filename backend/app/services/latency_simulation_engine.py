"""
Latency Simulation Engine for Market Microstructure Simulator

Realistic latency modeling and simulation including:
- Network latency with geographic and infrastructure effects
- Processing latency with queue dynamics and congestion
- Market data latency and staleness effects
- Participant-specific latency characteristics
- Time-of-day and market condition effects
- Latency measurement and analytics
"""

import asyncio
import logging
import random
import numpy as np
from datetime import datetime, timedelta, time
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any, NamedTuple
from dataclasses import dataclass, field
from enum import Enum
import statistics
from collections import defaultdict, deque

from ..models.market_microstructure_models import (
    LatencyModel, MarketOrder, OrderSide, OrderType, ParticipantType,
    VenueCharacteristics, OrderExecution, SimulationParameters, MarketRegime
)

logger = logging.getLogger(__name__)


class LatencyComponent(Enum):
    """Types of latency components"""
    NETWORK = "network"
    PROCESSING = "processing"
    MARKET_DATA = "market_data"
    QUEUE = "queue"
    INFRASTRUCTURE = "infrastructure"
    PROPAGATION = "propagation"


@dataclass
class LatencyMeasurement:
    """Individual latency measurement with breakdown"""
    order_id: str
    participant_type: ParticipantType
    venue_id: str
    timestamp: datetime

    # Component latencies (in milliseconds)
    network_latency_ms: float = 0.0
    processing_latency_ms: float = 0.0
    queue_latency_ms: float = 0.0
    market_data_latency_ms: float = 0.0
    infrastructure_latency_ms: float = 0.0
    propagation_latency_ms: float = 0.0

    # Total latency
    total_latency_ms: float = 0.0

    # Context information
    order_type: Optional[OrderType] = None
    order_size: int = 0
    market_regime: MarketRegime = MarketRegime.NORMAL
    queue_depth: int = 0
    time_of_day: Optional[time] = None

    def __post_init__(self):
        """Calculate total latency"""
        self.total_latency_ms = (
            self.network_latency_ms + self.processing_latency_ms +
            self.queue_latency_ms + self.market_data_latency_ms +
            self.infrastructure_latency_ms + self.propagation_latency_ms
        )


@dataclass
class LatencyProfile:
    """Latency profile for different participant types and scenarios"""
    participant_type: ParticipantType
    venue_id: str

    # Base latency characteristics
    base_network_latency_ms: float = 1.0
    network_jitter_std_ms: float = 0.1
    processing_latency_ms: float = 0.1

    # Infrastructure advantages/penalties
    infrastructure_advantage_ms: float = 0.0  # Negative for advantage
    colocation_advantage_ms: float = 0.0

    # Market data latency
    market_data_feed_latency_ms: float = 0.5
    market_data_processing_ms: float = 0.1

    # Geographic factors
    geographic_distance_km: float = 100.0
    fiber_propagation_delay_ms: float = 0.0  # Calculated from distance

    # Technology factors
    hardware_advantage_ms: float = 0.0
    software_optimization_ms: float = 0.0

    def __post_init__(self):
        """Calculate derived latency components"""
        # Fiber optic propagation: ~5 microseconds per km (0.005 ms/km)
        self.fiber_propagation_delay_ms = self.geographic_distance_km * 0.005


class LatencySimulationEngine:
    """
    Advanced latency simulation engine that models realistic
    latency characteristics for different market participants.
    """

    def __init__(
        self,
        venue_characteristics: VenueCharacteristics,
        simulation_params: SimulationParameters,
        enable_congestion_modeling: bool = True,
        enable_time_of_day_effects: bool = True
    ):
        self.venue = venue_characteristics
        self.simulation_params = simulation_params
        self.enable_congestion = enable_congestion_modeling
        self.enable_time_effects = enable_time_of_day_effects

        # Latency profiles for different participant types
        self.latency_profiles: Dict[ParticipantType, LatencyProfile] = {}
        self._initialize_default_profiles()

        # Current simulation state
        self.current_time = datetime.utcnow()
        self.current_queue_depth = 0
        self.current_market_regime = MarketRegime.NORMAL

        # Latency measurements and analytics
        self.measurements: List[LatencyMeasurement] = []
        self.measurement_history: deque = deque(maxlen=10000)

        # Congestion modeling
        self.processing_load: float = 0.0  # 0.0 to 1.0
        self.network_congestion: float = 0.0  # 0.0 to 1.0

        # Performance tracking
        self.latency_percentiles: Dict[str, float] = {}
        self.participant_latency_stats: Dict[ParticipantType, Dict[str, float]] = defaultdict(dict)

        logger.info(f"Initialized latency simulation engine for {venue_characteristics.venue_id}")

    def _initialize_default_profiles(self):
        """Initialize default latency profiles for different participant types"""

        # High-frequency trading firms
        self.latency_profiles[ParticipantType.HIGH_FREQUENCY] = LatencyProfile(
            participant_type=ParticipantType.HIGH_FREQUENCY,
            venue_id=self.venue.venue_id,
            base_network_latency_ms=0.1,
            network_jitter_std_ms=0.01,
            processing_latency_ms=0.05,
            infrastructure_advantage_ms=-0.5,
            colocation_advantage_ms=-2.0,
            market_data_feed_latency_ms=0.1,
            market_data_processing_ms=0.05,
            geographic_distance_km=1.0,  # Co-located
            hardware_advantage_ms=-0.3,
            software_optimization_ms=-0.2
        )

        # Institutional traders
        self.latency_profiles[ParticipantType.INSTITUTIONAL] = LatencyProfile(
            participant_type=ParticipantType.INSTITUTIONAL,
            venue_id=self.venue.venue_id,
            base_network_latency_ms=0.5,
            network_jitter_std_ms=0.05,
            processing_latency_ms=0.2,
            infrastructure_advantage_ms=-0.2,
            colocation_advantage_ms=0.0,
            market_data_feed_latency_ms=0.3,
            market_data_processing_ms=0.1,
            geographic_distance_km=50.0,
            hardware_advantage_ms=-0.1,
            software_optimization_ms=-0.1
        )

        # Market makers
        self.latency_profiles[ParticipantType.MARKET_MAKER] = LatencyProfile(
            participant_type=ParticipantType.MARKET_MAKER,
            venue_id=self.venue.venue_id,
            base_network_latency_ms=0.2,
            network_jitter_std_ms=0.02,
            processing_latency_ms=0.1,
            infrastructure_advantage_ms=-0.3,
            colocation_advantage_ms=-1.0,
            market_data_feed_latency_ms=0.15,
            market_data_processing_ms=0.05,
            geographic_distance_km=5.0,
            hardware_advantage_ms=-0.2,
            software_optimization_ms=-0.15
        )

        # Retail traders
        self.latency_profiles[ParticipantType.RETAIL] = LatencyProfile(
            participant_type=ParticipantType.RETAIL,
            venue_id=self.venue.venue_id,
            base_network_latency_ms=5.0,
            network_jitter_std_ms=1.0,
            processing_latency_ms=2.0,
            infrastructure_advantage_ms=5.0,  # Penalty
            colocation_advantage_ms=0.0,
            market_data_feed_latency_ms=10.0,
            market_data_processing_ms=1.0,
            geographic_distance_km=500.0,
            hardware_advantage_ms=1.0,  # Penalty
            software_optimization_ms=2.0  # Penalty
        )

        # Arbitrageurs
        self.latency_profiles[ParticipantType.ARBITRAGEUR] = LatencyProfile(
            participant_type=ParticipantType.ARBITRAGEUR,
            venue_id=self.venue.venue_id,
            base_network_latency_ms=0.3,
            network_jitter_std_ms=0.03,
            processing_latency_ms=0.15,
            infrastructure_advantage_ms=-0.1,
            colocation_advantage_ms=-0.5,
            market_data_feed_latency_ms=0.2,
            market_data_processing_ms=0.1,
            geographic_distance_km=20.0,
            hardware_advantage_ms=-0.05,
            software_optimization_ms=-0.1
        )

    async def simulate_order_latency(
        self,
        order: MarketOrder,
        queue_depth: int = 0,
        market_regime: MarketRegime = MarketRegime.NORMAL
    ) -> LatencyMeasurement:
        """
        Simulate complete order latency with all components.

        Args:
            order: Market order being processed
            queue_depth: Current queue depth
            market_regime: Current market regime

        Returns:
            Complete latency measurement
        """
        profile = self.latency_profiles.get(order.participant_type)
        if not profile:
            # Use retail as default
            profile = self.latency_profiles[ParticipantType.RETAIL]

        measurement = LatencyMeasurement(
            order_id=order.order_id,
            participant_type=order.participant_type,
            venue_id=self.venue.venue_id,
            timestamp=self.current_time,
            order_type=order.order_type,
            order_size=order.quantity,
            market_regime=market_regime,
            queue_depth=queue_depth,
            time_of_day=self.current_time.time()
        )

        # Simulate each latency component
        measurement.network_latency_ms = await self._simulate_network_latency(profile, order)
        measurement.processing_latency_ms = await self._simulate_processing_latency(profile, order)
        measurement.queue_latency_ms = await self._simulate_queue_latency(profile, queue_depth)
        measurement.market_data_latency_ms = await self._simulate_market_data_latency(profile, order)
        measurement.infrastructure_latency_ms = await self._simulate_infrastructure_latency(profile)
        measurement.propagation_latency_ms = profile.fiber_propagation_delay_ms

        # Apply time-of-day effects
        if self.enable_time_effects:
            time_multiplier = self._get_time_of_day_multiplier()
            measurement.network_latency_ms *= time_multiplier
            measurement.processing_latency_ms *= time_multiplier

        # Apply market regime effects
        regime_multiplier = self._get_market_regime_multiplier(market_regime)
        measurement.processing_latency_ms *= regime_multiplier
        measurement.queue_latency_ms *= regime_multiplier

        # Calculate total latency
        measurement.__post_init__()

        # Store measurement
        self.measurements.append(measurement)
        self.measurement_history.append(measurement)

        # Update analytics
        await self._update_latency_analytics(measurement)

        return measurement

    async def _simulate_network_latency(self, profile: LatencyProfile, order: MarketOrder) -> float:
        """Simulate network latency with jitter and congestion effects"""
        base_latency = profile.base_network_latency_ms

        # Add random jitter (normally distributed)
        jitter = np.random.normal(0, profile.network_jitter_std_ms)

        # Add congestion effects
        congestion_penalty = 0.0
        if self.enable_congestion and self.network_congestion > 0.7:
            congestion_penalty = base_latency * (self.network_congestion - 0.7) * 2.0

        # Order type effects
        type_multiplier = {
            OrderType.MARKET: 1.0,
            OrderType.LIMIT: 0.9,
            OrderType.STOP: 1.1,
            OrderType.STOP_LIMIT: 1.2,
            OrderType.ICEBERG: 1.3
        }.get(order.order_type, 1.0)

        total_latency = (base_latency + jitter + congestion_penalty) * type_multiplier
        return max(0.01, total_latency)  # Minimum 0.01ms

    async def _simulate_processing_latency(self, profile: LatencyProfile, order: MarketOrder) -> float:
        """Simulate order processing latency"""
        base_processing = profile.processing_latency_ms

        # Size-dependent processing
        size_factor = 1.0 + (order.quantity / 10000) * 0.1  # Larger orders take longer

        # Add hardware and software advantages
        technology_advantage = profile.hardware_advantage_ms + profile.software_optimization_ms

        # Processing load effects
        load_penalty = 0.0
        if self.enable_congestion and self.processing_load > 0.8:
            load_penalty = base_processing * (self.processing_load - 0.8) * 3.0

        total_latency = (base_processing * size_factor) + technology_advantage + load_penalty
        return max(0.01, total_latency)

    async def _simulate_queue_latency(self, profile: LatencyProfile, queue_depth: int) -> float:
        """Simulate queue waiting latency"""
        if queue_depth == 0:
            return 0.0

        # Base queue processing rate (orders per second)
        base_processing_rate = 1000.0  # Orders per second

        # Participant type affects queue priority
        priority_advantage = {
            ParticipantType.HIGH_FREQUENCY: -0.5,
            ParticipantType.MARKET_MAKER: -0.3,
            ParticipantType.INSTITUTIONAL: -0.1,
            ParticipantType.ARBITRAGEUR: 0.0,
            ParticipantType.RETAIL: 0.2
        }.get(profile.participant_type, 0.0)

        # Calculate effective queue position
        effective_position = max(1, queue_depth + (queue_depth * priority_advantage))

        # Calculate queue latency
        queue_latency_ms = (effective_position / base_processing_rate) * 1000

        # Add randomness for queue jitter
        jitter = random.uniform(-queue_latency_ms * 0.1, queue_latency_ms * 0.1)

        return max(0.0, queue_latency_ms + jitter)

    async def _simulate_market_data_latency(self, profile: LatencyProfile, order: MarketOrder) -> float:
        """Simulate market data latency and staleness effects"""
        feed_latency = profile.market_data_feed_latency_ms
        processing_latency = profile.market_data_processing_ms

        # Market orders are more sensitive to market data staleness
        if order.order_type == OrderType.MARKET:
            staleness_penalty = random.uniform(0.0, 0.5)
        else:
            staleness_penalty = 0.0

        return feed_latency + processing_latency + staleness_penalty

    async def _simulate_infrastructure_latency(self, profile: LatencyProfile) -> float:
        """Simulate infrastructure-related latency"""
        infrastructure_latency = profile.infrastructure_advantage_ms + profile.colocation_advantage_ms

        # Add small random component
        jitter = random.uniform(-0.05, 0.05)

        return infrastructure_latency + jitter

    def _get_time_of_day_multiplier(self) -> float:
        """Get latency multiplier based on time of day"""
        current_hour = self.current_time.hour

        # Peak trading hours (9:30-16:00 EST) have higher latency
        if 9 <= current_hour <= 16:
            return 1.2  # 20% higher latency during market hours
        elif 16 < current_hour <= 20:
            return 1.1  # 10% higher during extended hours
        else:
            return 0.8  # 20% lower during off-hours

    def _get_market_regime_multiplier(self, regime: MarketRegime) -> float:
        """Get latency multiplier based on market regime"""
        multipliers = {
            MarketRegime.NORMAL: 1.0,
            MarketRegime.VOLATILE: 1.5,
            MarketRegime.STRESS: 2.0,
            MarketRegime.TRENDING: 1.2,
            MarketRegime.RANGING: 0.9,
            MarketRegime.OPENING: 1.8,
            MarketRegime.CLOSING: 1.6,
            MarketRegime.PRE_MARKET: 0.7,
            MarketRegime.POST_MARKET: 0.8
        }
        return multipliers.get(regime, 1.0)

    async def _update_latency_analytics(self, measurement: LatencyMeasurement) -> None:
        """Update latency analytics and statistics"""
        # Update participant-specific statistics
        participant_stats = self.participant_latency_stats[measurement.participant_type]

        if 'total_measurements' not in participant_stats:
            participant_stats['total_measurements'] = 0
            participant_stats['avg_latency_ms'] = 0.0
            participant_stats['min_latency_ms'] = float('inf')
            participant_stats['max_latency_ms'] = 0.0

        # Update running statistics
        count = participant_stats['total_measurements']
        new_count = count + 1

        participant_stats['avg_latency_ms'] = (
            (participant_stats['avg_latency_ms'] * count + measurement.total_latency_ms) / new_count
        )
        participant_stats['min_latency_ms'] = min(
            participant_stats['min_latency_ms'], measurement.total_latency_ms
        )
        participant_stats['max_latency_ms'] = max(
            participant_stats['max_latency_ms'], measurement.total_latency_ms
        )
        participant_stats['total_measurements'] = new_count

        # Update global percentiles periodically
        if len(self.measurements) % 100 == 0:  # Every 100 measurements
            await self._update_latency_percentiles()

    async def _update_latency_percentiles(self) -> None:
        """Update latency percentiles from recent measurements"""
        if len(self.measurement_history) < 10:
            return

        recent_latencies = [m.total_latency_ms for m in list(self.measurement_history)[-1000:]]

        self.latency_percentiles = {
            'p50': np.percentile(recent_latencies, 50),
            'p90': np.percentile(recent_latencies, 90),
            'p95': np.percentile(recent_latencies, 95),
            'p99': np.percentile(recent_latencies, 99),
            'p99.9': np.percentile(recent_latencies, 99.9)
        }

    def update_congestion_levels(self, processing_load: float, network_congestion: float) -> None:
        """Update current congestion levels"""
        self.processing_load = max(0.0, min(1.0, processing_load))
        self.network_congestion = max(0.0, min(1.0, network_congestion))

    def get_latency_statistics(self) -> Dict[str, Any]:
        """Get comprehensive latency statistics"""
        return {
            'total_measurements': len(self.measurements),
            'global_percentiles': self.latency_percentiles.copy(),
            'participant_statistics': {
                ptype.value: stats.copy()
                for ptype, stats in self.participant_latency_stats.items()
            },
            'congestion_levels': {
                'processing_load': self.processing_load,
                'network_congestion': self.network_congestion
            },
            'time_of_day_factor': self._get_time_of_day_multiplier(),
            'market_regime_factor': self._get_market_regime_multiplier(self.current_market_regime)
        }

    def get_latency_breakdown(self, participant_type: ParticipantType) -> Dict[str, float]:
        """Get latency component breakdown for a participant type"""
        profile = self.latency_profiles.get(participant_type)
        if not profile:
            return {}

        # Get recent measurements for this participant type
        recent_measurements = [
            m for m in list(self.measurement_history)[-500:]
            if m.participant_type == participant_type
        ]

        if not recent_measurements:
            return {}

        return {
            'avg_network_latency_ms': statistics.mean([m.network_latency_ms for m in recent_measurements]),
            'avg_processing_latency_ms': statistics.mean([m.processing_latency_ms for m in recent_measurements]),
            'avg_queue_latency_ms': statistics.mean([m.queue_latency_ms for m in recent_measurements]),
            'avg_market_data_latency_ms': statistics.mean([m.market_data_latency_ms for m in recent_measurements]),
            'avg_infrastructure_latency_ms': statistics.mean([m.infrastructure_latency_ms for m in recent_measurements]),
            'avg_propagation_latency_ms': statistics.mean([m.propagation_latency_ms for m in recent_measurements]),
            'avg_total_latency_ms': statistics.mean([m.total_latency_ms for m in recent_measurements])
        }

    def set_custom_latency_profile(self, participant_type: ParticipantType, profile: LatencyProfile) -> None:
        """Set custom latency profile for a participant type"""
        self.latency_profiles[participant_type] = profile
        logger.info(f"Updated latency profile for {participant_type.value}")

    def simulate_network_outage(self, duration_seconds: float, affected_participants: List[ParticipantType] = None) -> None:
        """Simulate network outage affecting latency"""
        # This would be implemented to temporarily increase latency for affected participants
        logger.warning(f"Simulating network outage for {duration_seconds} seconds")
        # Implementation would modify latency profiles temporarily

    async def advance_time(self, time_delta: timedelta) -> None:
        """Advance simulation time"""
        self.current_time += time_delta

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for the latency simulation"""
        return {
            'measurements_per_second': len(self.measurements) / max(1, (datetime.utcnow() - self.current_time).total_seconds()),
            'memory_usage_mb': len(self.measurement_history) * 0.001,  # Rough estimate
            'active_profiles': len(self.latency_profiles),
            'congestion_modeling_enabled': self.enable_congestion,
            'time_effects_enabled': self.enable_time_effects
        }