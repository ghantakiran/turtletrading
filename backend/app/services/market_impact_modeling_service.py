"""
Market Impact Modeling Service for Market Microstructure Simulation

This service implements sophisticated market impact models including:
- Linear, square-root, and logarithmic impact functions
- Temporary vs permanent impact decomposition
- Participation rate-based impact calculations
- Regime-dependent impact adjustments
- Cross-asset impact correlations
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
    MarketImpactModel, MarketOrder, OrderSide, VenueCharacteristics,
    SimulationParameters, MarketImpactEstimate, ImpactComponent,
    MarketRegime, LiquidityMetrics
)

logger = logging.getLogger(__name__)


class ImpactModelType(Enum):
    """Types of market impact models"""
    LINEAR = "linear"
    SQUARE_ROOT = "square_root"
    LOGARITHMIC = "logarithmic"
    ALMGREN_CHRISS = "almgren_chriss"
    ALMGREN_THUM_HAUPTMANN_LI = "athul"
    KYLE = "kyle"
    BARRA = "barra"


class ImpactDecayType(Enum):
    """Types of impact decay patterns"""
    EXPONENTIAL = "exponential"
    POWER_LAW = "power_law"
    LINEAR_DECAY = "linear_decay"
    INSTANT = "instant"


@dataclass
class ImpactParameters:
    """Parameters for market impact calculations"""
    # Linear model parameters
    linear_coefficient: float = 0.1

    # Square-root model parameters
    sqrt_coefficient: float = 0.5
    sqrt_exponent: float = 0.5

    # Logarithmic model parameters
    log_coefficient: float = 0.2
    log_base: float = math.e

    # Almgren-Chriss parameters
    gamma: float = 2.5e-7  # Permanent impact coefficient
    eta: float = 2.5e-6    # Temporary impact coefficient

    # Kyle model parameters
    kyle_lambda: float = 1e-6  # Price impact of order flow

    # Volume participation thresholds
    low_participation_threshold: float = 0.05    # 5%
    high_participation_threshold: float = 0.25   # 25%

    # Regime adjustments
    stressed_multiplier: float = 2.0
    crisis_multiplier: float = 3.5

    # Decay parameters
    temporary_decay_half_life: float = 300.0  # seconds
    permanent_decay_rate: float = 0.1


@dataclass
class MarketConditions:
    """Current market conditions affecting impact"""
    volatility: float = 1.0
    liquidity_score: float = 0.5
    market_regime: MarketRegime = MarketRegime.NORMAL
    time_of_day_factor: float = 1.0
    cross_sectional_volatility: float = 1.0
    bid_ask_spread_bps: float = 10.0
    order_book_depth: float = 1.0


class MarketImpactModelingService:
    """
    Advanced market impact modeling service that provides sophisticated
    impact calculations using multiple academic and industry models.
    """

    def __init__(
        self,
        venues: List[VenueCharacteristics],
        simulation_params: SimulationParameters,
        impact_params: ImpactParameters = None
    ):
        self.venues = {venue.venue_name: venue for venue in venues}
        self.params = simulation_params
        self.impact_params = impact_params or ImpactParameters()

        # Model state
        self.impact_history: List[MarketImpactEstimate] = []
        self.liquidity_cache: Dict[str, LiquidityMetrics] = {}
        self.regime_adjustments: Dict[MarketRegime, float] = {
            MarketRegime.NORMAL: 1.0,
            MarketRegime.STRESSED: self.impact_params.stressed_multiplier,
            MarketRegime.CRISIS: self.impact_params.crisis_multiplier
        }

        # Time-of-day impact patterns
        self.intraday_patterns = {
            "opening": {"start": 9.5, "end": 10.0, "multiplier": 1.5},
            "morning": {"start": 10.0, "end": 12.0, "multiplier": 1.0},
            "lunch": {"start": 12.0, "end": 14.0, "multiplier": 0.8},
            "afternoon": {"start": 14.0, "end": 15.5, "multiplier": 1.1},
            "closing": {"start": 15.5, "end": 16.0, "multiplier": 1.8}
        }

        # Cross-asset correlation matrix (simplified)
        self.correlation_matrix = {}

        logger.info("Initialized market impact modeling service")

    async def calculate_market_impact(
        self,
        order: MarketOrder,
        venue: VenueCharacteristics,
        market_conditions: MarketConditions,
        model_type: ImpactModelType = ImpactModelType.SQUARE_ROOT
    ) -> MarketImpactEstimate:
        """Calculate comprehensive market impact estimate for an order."""

        # Get current liquidity metrics
        liquidity_metrics = await self._get_liquidity_metrics(order.symbol, venue.venue_name)

        # Calculate participation rate
        participation_rate = await self._calculate_participation_rate(order, venue, liquidity_metrics)

        # Calculate base impact using specified model
        base_impact = await self._calculate_base_impact(
            order, participation_rate, model_type, market_conditions
        )

        # Decompose into temporary and permanent components
        temporary_impact, permanent_impact = await self._decompose_impact_components(
            base_impact, order, market_conditions
        )

        # Apply regime and time-of-day adjustments
        adjusted_temporary = await self._apply_regime_adjustments(
            temporary_impact, market_conditions
        )
        adjusted_permanent = await self._apply_regime_adjustments(
            permanent_impact, market_conditions
        )

        # Calculate confidence intervals
        confidence_intervals = await self._calculate_confidence_intervals(
            adjusted_temporary + adjusted_permanent, market_conditions
        )

        # Create impact estimate
        impact_estimate = MarketImpactEstimate(
            order_id=order.order_id,
            symbol=order.symbol,
            venue=venue.venue_name,
            timestamp=datetime.utcnow(),
            model_type=model_type.value,
            order_size=order.size,
            participation_rate=participation_rate,
            total_impact_bps=adjusted_temporary + adjusted_permanent,
            temporary_impact_bps=adjusted_temporary,
            permanent_impact_bps=adjusted_permanent,
            confidence_interval_95=confidence_intervals["95"],
            confidence_interval_99=confidence_intervals["99"],
            liquidity_score=market_conditions.liquidity_score,
            volatility_adjustment=market_conditions.volatility,
            regime_adjustment=self.regime_adjustments[market_conditions.market_regime],
            estimated_completion_time=await self._estimate_completion_time(order, market_conditions)
        )

        # Store in history
        self.impact_history.append(impact_estimate)

        logger.debug(f"Calculated impact for {order.symbol}: "
                    f"{impact_estimate.total_impact_bps:.2f}bps "
                    f"(temp: {adjusted_temporary:.2f}, perm: {adjusted_permanent:.2f})")

        return impact_estimate

    async def _calculate_participation_rate(
        self,
        order: MarketOrder,
        venue: VenueCharacteristics,
        liquidity_metrics: LiquidityMetrics
    ) -> float:
        """Calculate order participation rate relative to expected volume."""

        # Use venue average daily volume as baseline
        expected_volume = venue.average_daily_volume

        # Adjust for time of day (simple intraday pattern)
        time_adjustment = await self._get_time_of_day_volume_factor()
        expected_interval_volume = expected_volume * time_adjustment / (6.5 * 60)  # Per minute

        # Calculate participation rate
        participation_rate = float(order.size) / float(expected_interval_volume)

        return min(participation_rate, 1.0)  # Cap at 100%

    async def _calculate_base_impact(
        self,
        order: MarketOrder,
        participation_rate: float,
        model_type: ImpactModelType,
        market_conditions: MarketConditions
    ) -> float:
        """Calculate base market impact using specified model."""

        if model_type == ImpactModelType.LINEAR:
            return await self._linear_impact_model(participation_rate, market_conditions)

        elif model_type == ImpactModelType.SQUARE_ROOT:
            return await self._square_root_impact_model(participation_rate, market_conditions)

        elif model_type == ImpactModelType.LOGARITHMIC:
            return await self._logarithmic_impact_model(participation_rate, market_conditions)

        elif model_type == ImpactModelType.ALMGREN_CHRISS:
            return await self._almgren_chriss_impact_model(order, participation_rate, market_conditions)

        elif model_type == ImpactModelType.KYLE:
            return await self._kyle_impact_model(order, participation_rate, market_conditions)

        elif model_type == ImpactModelType.BARRA:
            return await self._barra_impact_model(order, participation_rate, market_conditions)

        else:
            # Default to square-root model
            return await self._square_root_impact_model(participation_rate, market_conditions)

    async def _linear_impact_model(
        self,
        participation_rate: float,
        market_conditions: MarketConditions
    ) -> float:
        """Linear impact model: Impact = alpha * participation_rate"""
        base_impact = self.impact_params.linear_coefficient * participation_rate * 10000  # Convert to bps

        # Adjust for market conditions
        volatility_adjustment = market_conditions.volatility
        liquidity_adjustment = 1.0 / max(0.1, market_conditions.liquidity_score)

        return base_impact * volatility_adjustment * liquidity_adjustment

    async def _square_root_impact_model(
        self,
        participation_rate: float,
        market_conditions: MarketConditions
    ) -> float:
        """Square-root impact model: Impact = alpha * participation_rate^0.5"""
        base_impact = (
            self.impact_params.sqrt_coefficient *
            (participation_rate ** self.impact_params.sqrt_exponent) *
            10000
        )

        # Adjust for market conditions
        volatility_adjustment = market_conditions.volatility ** 0.8  # Sublinear volatility effect
        liquidity_adjustment = (1.0 / max(0.1, market_conditions.liquidity_score)) ** 0.6
        spread_adjustment = (market_conditions.bid_ask_spread_bps / 10.0) ** 0.3

        return base_impact * volatility_adjustment * liquidity_adjustment * spread_adjustment

    async def _logarithmic_impact_model(
        self,
        participation_rate: float,
        market_conditions: MarketConditions
    ) -> float:
        """Logarithmic impact model: Impact = alpha * log(1 + participation_rate)"""
        if participation_rate <= 0:
            return 0.0

        base_impact = (
            self.impact_params.log_coefficient *
            math.log(1 + participation_rate) *
            10000
        )

        # Adjust for market conditions
        volatility_adjustment = market_conditions.volatility
        liquidity_adjustment = 1.0 / max(0.1, market_conditions.liquidity_score)

        return base_impact * volatility_adjustment * liquidity_adjustment

    async def _almgren_chriss_impact_model(
        self,
        order: MarketOrder,
        participation_rate: float,
        market_conditions: MarketConditions
    ) -> float:
        """Almgren-Chriss optimal execution impact model."""

        # Model parameters
        gamma = self.impact_params.gamma  # Permanent impact coefficient
        eta = self.impact_params.eta      # Temporary impact coefficient

        # Order characteristics
        X = float(order.size)  # Order size
        sigma = market_conditions.volatility * 0.02  # Daily volatility (2% base)

        # Risk aversion parameter (higher = more risk averse)
        lambda_risk = 1e-6

        # Permanent impact component
        permanent_component = gamma * X * 10000  # Convert to bps

        # Temporary impact component (depends on execution rate)
        # Assume optimal execution rate
        T = 1.0  # Execution time in hours
        optimal_rate = X / T
        temporary_component = eta * optimal_rate * 10000

        total_impact = permanent_component + temporary_component

        # Adjust for market conditions
        volatility_adjustment = market_conditions.volatility
        liquidity_adjustment = 1.0 / max(0.1, market_conditions.liquidity_score)

        return total_impact * volatility_adjustment * liquidity_adjustment

    async def _kyle_impact_model(
        self,
        order: MarketOrder,
        participation_rate: float,
        market_conditions: MarketConditions
    ) -> float:
        """Kyle model of market microstructure."""

        # Kyle's lambda (price impact of order flow)
        kyle_lambda = self.impact_params.kyle_lambda

        # Order flow imbalance
        # Positive for buy orders, negative for sell orders
        order_flow = float(order.size) if order.side == OrderSide.BUY else -float(order.size)

        # Base impact
        base_impact = kyle_lambda * abs(order_flow) * 10000  # Convert to bps

        # Adjust for market conditions
        volatility_adjustment = market_conditions.volatility
        liquidity_adjustment = 1.0 / max(0.1, market_conditions.liquidity_score)

        # Kyle model includes information asymmetry effects
        asymmetry_factor = 1.0 + (0.2 * participation_rate)  # Higher for larger orders

        return base_impact * volatility_adjustment * liquidity_adjustment * asymmetry_factor

    async def _barra_impact_model(
        self,
        order: MarketOrder,
        participation_rate: float,
        market_conditions: MarketConditions
    ) -> float:
        """Barra risk model impact estimation."""

        # Barra-style impact model with multiple factors

        # Base impact (participation rate effect)
        participation_impact = 50.0 * (participation_rate ** 0.6)  # 50bps at 100% participation

        # Size effect (absolute order size)
        size_factor = math.log(1 + float(order.size) / 1000) * 5.0  # Log size effect

        # Volatility effect
        volatility_impact = market_conditions.volatility * 10.0

        # Liquidity effect
        liquidity_impact = (1.0 / max(0.1, market_conditions.liquidity_score) - 1.0) * 20.0

        # Spread effect
        spread_impact = (market_conditions.bid_ask_spread_bps - 10.0) * 0.2

        # Combine factors
        total_impact = (
            participation_impact +
            size_factor +
            volatility_impact +
            liquidity_impact +
            spread_impact
        )

        return max(0.0, total_impact)

    async def _decompose_impact_components(
        self,
        total_impact: float,
        order: MarketOrder,
        market_conditions: MarketConditions
    ) -> Tuple[float, float]:
        """Decompose total impact into temporary and permanent components."""

        # Use theoretical decomposition ratios
        if market_conditions.market_regime == MarketRegime.NORMAL:
            temporary_ratio = 0.7  # 70% temporary, 30% permanent
        elif market_conditions.market_regime == MarketRegime.STRESSED:
            temporary_ratio = 0.6  # More permanent impact during stress
        else:  # Crisis
            temporary_ratio = 0.5  # Even more permanent impact

        # Adjust based on order characteristics
        if order.order_type.value == "market":
            temporary_ratio += 0.1  # Market orders have more temporary impact

        # Large orders tend to have more permanent impact
        size_adjustment = min(0.2, float(order.size) / 10000 * 0.1)
        temporary_ratio -= size_adjustment

        temporary_ratio = max(0.3, min(0.9, temporary_ratio))  # Bound between 30-90%

        temporary_impact = total_impact * temporary_ratio
        permanent_impact = total_impact * (1 - temporary_ratio)

        return temporary_impact, permanent_impact

    async def _apply_regime_adjustments(
        self,
        base_impact: float,
        market_conditions: MarketConditions
    ) -> float:
        """Apply market regime and time-of-day adjustments."""

        # Regime adjustment
        regime_multiplier = self.regime_adjustments[market_conditions.market_regime]

        # Time of day adjustment
        time_multiplier = market_conditions.time_of_day_factor

        # Cross-sectional volatility adjustment
        cross_vol_multiplier = 1.0 + (market_conditions.cross_sectional_volatility - 1.0) * 0.5

        adjusted_impact = base_impact * regime_multiplier * time_multiplier * cross_vol_multiplier

        return adjusted_impact

    async def _calculate_confidence_intervals(
        self,
        point_estimate: float,
        market_conditions: MarketConditions
    ) -> Dict[str, Tuple[float, float]]:
        """Calculate confidence intervals for impact estimates."""

        # Estimate standard error based on market conditions
        base_std_error = point_estimate * 0.2  # 20% standard error

        # Adjust for uncertainty factors
        volatility_factor = market_conditions.volatility
        liquidity_factor = 1.0 / max(0.1, market_conditions.liquidity_score)
        regime_factor = 1.0 if market_conditions.market_regime == MarketRegime.NORMAL else 1.5

        std_error = base_std_error * volatility_factor * liquidity_factor * regime_factor

        # Calculate confidence intervals
        confidence_intervals = {
            "95": (
                point_estimate - 1.96 * std_error,
                point_estimate + 1.96 * std_error
            ),
            "99": (
                point_estimate - 2.58 * std_error,
                point_estimate + 2.58 * std_error
            )
        }

        return confidence_intervals

    async def _estimate_completion_time(
        self,
        order: MarketOrder,
        market_conditions: MarketConditions
    ) -> float:
        """Estimate time to complete order execution."""

        # Base completion time based on order size and market conditions
        base_time = 60.0  # 1 minute base

        # Size effect
        size_multiplier = 1.0 + math.log(1 + float(order.size) / 1000) * 0.1

        # Liquidity effect
        liquidity_multiplier = 1.0 / max(0.1, market_conditions.liquidity_score)

        # Regime effect
        regime_multipliers = {
            MarketRegime.NORMAL: 1.0,
            MarketRegime.STRESSED: 1.5,
            MarketRegime.CRISIS: 2.5
        }
        regime_multiplier = regime_multipliers[market_conditions.market_regime]

        # Order type effect
        type_multiplier = 1.0 if order.order_type.value == "market" else 1.3

        estimated_time = (
            base_time *
            size_multiplier *
            liquidity_multiplier *
            regime_multiplier *
            type_multiplier
        )

        return estimated_time

    async def _get_liquidity_metrics(self, symbol: str, venue: str) -> LiquidityMetrics:
        """Get current liquidity metrics for symbol/venue."""

        cache_key = f"{symbol}_{venue}"

        if cache_key in self.liquidity_cache:
            metrics = self.liquidity_cache[cache_key]
            # Check if metrics are recent (within 5 minutes)
            if (datetime.utcnow() - metrics.timestamp).total_seconds() < 300:
                return metrics

        # Simulate liquidity metrics (in practice, would query real data)
        venue_obj = self.venues.get(venue)
        if not venue_obj:
            # Default metrics
            liquidity_metrics = LiquidityMetrics(
                symbol=symbol,
                venue=venue,
                timestamp=datetime.utcnow(),
                bid_ask_spread_bps=Decimal("10.0"),
                market_depth=Decimal("1000.0"),
                order_book_imbalance=0.0,
                price_impact_coefficient=0.1,
                average_trade_size=Decimal("100.0"),
                liquidity_score=0.5
            )
        else:
            liquidity_metrics = LiquidityMetrics(
                symbol=symbol,
                venue=venue,
                timestamp=datetime.utcnow(),
                bid_ask_spread_bps=venue_obj.typical_spread_bps,
                market_depth=venue_obj.average_daily_volume / 100,  # Rough estimate
                order_book_imbalance=random.uniform(-0.2, 0.2),
                price_impact_coefficient=0.1,
                average_trade_size=Decimal("150.0"),
                liquidity_score=random.uniform(0.3, 0.9)
            )

        # Cache the metrics
        self.liquidity_cache[cache_key] = liquidity_metrics

        return liquidity_metrics

    async def _get_time_of_day_volume_factor(self) -> float:
        """Get time of day volume adjustment factor."""
        current_time = datetime.utcnow()
        hour = current_time.hour + current_time.minute / 60.0

        # Convert to market hours (assuming EST)
        market_hour = (hour - 5) % 24  # Convert UTC to EST

        for pattern_name, pattern in self.intraday_patterns.items():
            if pattern["start"] <= market_hour <= pattern["end"]:
                return pattern["multiplier"]

        return 0.5  # After hours

    async def simulate_impact_decay(
        self,
        initial_impact: float,
        decay_type: ImpactDecayType = ImpactDecayType.EXPONENTIAL,
        time_elapsed: float = 60.0  # seconds
    ) -> float:
        """Simulate impact decay over time."""

        if decay_type == ImpactDecayType.EXPONENTIAL:
            # Exponential decay: impact * exp(-t / half_life)
            half_life = self.impact_params.temporary_decay_half_life
            decay_factor = math.exp(-time_elapsed / half_life)

        elif decay_type == ImpactDecayType.POWER_LAW:
            # Power law decay: impact * (1 + t)^(-alpha)
            alpha = 0.5
            decay_factor = (1 + time_elapsed / 60.0) ** (-alpha)  # Normalize to minutes

        elif decay_type == ImpactDecayType.LINEAR_DECAY:
            # Linear decay to zero over specified time
            decay_time = 600.0  # 10 minutes
            decay_factor = max(0.0, 1.0 - time_elapsed / decay_time)

        else:  # INSTANT
            decay_factor = 0.0

        return initial_impact * decay_factor

    async def calculate_cross_asset_impact(
        self,
        primary_order: MarketOrder,
        related_symbols: List[str],
        correlation_matrix: Dict[Tuple[str, str], float] = None
    ) -> Dict[str, float]:
        """Calculate cross-asset impact spillovers."""

        if not correlation_matrix:
            correlation_matrix = self.correlation_matrix

        cross_impacts = {}

        # Calculate primary impact
        primary_venue = self.venues[list(self.venues.keys())[0]]  # Use first venue
        market_conditions = MarketConditions()  # Default conditions

        primary_impact_estimate = await self.calculate_market_impact(
            primary_order, primary_venue, market_conditions
        )

        primary_impact_bps = primary_impact_estimate.total_impact_bps

        # Calculate spillover impacts
        for related_symbol in related_symbols:
            correlation_key = (primary_order.symbol, related_symbol)
            correlation = correlation_matrix.get(correlation_key, 0.0)

            # Spillover impact is proportional to correlation
            spillover_factor = 0.3  # Maximum 30% spillover
            spillover_impact = primary_impact_bps * abs(correlation) * spillover_factor

            cross_impacts[related_symbol] = spillover_impact

        return cross_impacts

    def get_impact_analytics(self) -> Dict[str, Any]:
        """Get impact modeling analytics and performance metrics."""

        if not self.impact_history:
            return {"message": "No impact estimates available"}

        # Calculate summary statistics
        total_estimates = len(self.impact_history)

        impacts = [est.total_impact_bps for est in self.impact_history]
        avg_impact = sum(impacts) / len(impacts)
        max_impact = max(impacts)
        min_impact = min(impacts)

        # Model type distribution
        model_distribution = {}
        for estimate in self.impact_history:
            model_type = estimate.model_type
            model_distribution[model_type] = model_distribution.get(model_type, 0) + 1

        # Participation rate analysis
        participation_rates = [est.participation_rate for est in self.impact_history]
        avg_participation = sum(participation_rates) / len(participation_rates)

        return {
            "total_estimates": total_estimates,
            "average_impact_bps": avg_impact,
            "max_impact_bps": max_impact,
            "min_impact_bps": min_impact,
            "model_distribution": model_distribution,
            "average_participation_rate": avg_participation,
            "cache_size": len(self.liquidity_cache),
            "supported_models": [model.value for model in ImpactModelType],
            "impact_range_distribution": {
                "low_impact_0_5bps": len([i for i in impacts if i <= 5]),
                "medium_impact_5_20bps": len([i for i in impacts if 5 < i <= 20]),
                "high_impact_20plus_bps": len([i for i in impacts if i > 20])
            }
        }