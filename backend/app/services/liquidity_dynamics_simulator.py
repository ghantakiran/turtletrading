"""
Liquidity Dynamics Simulator for Market Microstructure

This module simulates realistic liquidity provision and consumption patterns,
including market maker behavior, retail flow, institutional flow, and
dynamic liquidity adjustments based on market conditions.
"""

import asyncio
import random
import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict, deque
import numpy as np
from enum import Enum

from ..models.market_microstructure_models import (
    LiquidityProvider, MarketMakerConfig, VenueCharacteristics,
    OrderBook, OrderBookLevel, MarketOrder, OrderSide, OrderType,
    LiquidityProvision, LiquidityWithdrawal, LiquidityEvent,
    SimulationParameters, OrderFlowMetrics
)

logger = logging.getLogger(__name__)


class LiquidityRegime(Enum):
    """Market liquidity regimes"""
    ABUNDANT = "abundant"
    NORMAL = "normal"
    STRESSED = "stressed"
    CRISIS = "crisis"


@dataclass
class LiquidityState:
    """Current state of market liquidity"""
    regime: LiquidityRegime
    total_bid_liquidity: Decimal
    total_ask_liquidity: Decimal
    effective_spread_bps: Decimal
    market_depth_score: float
    liquidity_imbalance: float  # Positive = more bid liquidity
    volatility_impact: float
    last_update: datetime


class LiquidityDynamicsSimulator:
    """
    Advanced liquidity dynamics simulator that models realistic liquidity
    provision and consumption patterns across different market conditions.
    """

    def __init__(
        self,
        symbol: str,
        venue_characteristics: VenueCharacteristics,
        simulation_params: SimulationParameters,
        market_makers: List[MarketMakerConfig] = None
    ):
        self.symbol = symbol
        self.venue = venue_characteristics
        self.params = simulation_params
        self.market_makers = market_makers or []

        # Liquidity state tracking
        self.liquidity_state = LiquidityState(
            regime=LiquidityRegime.NORMAL,
            total_bid_liquidity=Decimal("0"),
            total_ask_liquidity=Decimal("0"),
            effective_spread_bps=Decimal("10"),
            market_depth_score=0.5,
            liquidity_imbalance=0.0,
            volatility_impact=1.0,
            last_update=datetime.utcnow()
        )

        # Liquidity providers tracking
        self.liquidity_providers: Dict[str, LiquidityProvider] = {}
        self.liquidity_events: List[LiquidityEvent] = []

        # Market maker state
        self.mm_inventories: Dict[str, Decimal] = {}
        self.mm_risk_metrics: Dict[str, Dict[str, float]] = {}
        self.mm_last_provision: Dict[str, datetime] = {}

        # Institutional flow patterns
        self.institutional_sessions = {
            "asian": {"start": 0, "end": 8, "intensity": 0.6},
            "european": {"start": 8, "end": 16, "intensity": 0.8},
            "us": {"start": 14, "end": 22, "intensity": 1.0},
            "overlap_eu_us": {"start": 14, "end": 16, "intensity": 1.2}
        }

        # Retail flow patterns
        self.retail_patterns = {
            "morning_rush": {"start": 9.5, "end": 10.5, "intensity": 1.3},
            "lunch_lull": {"start": 12, "end": 14, "intensity": 0.7},
            "afternoon_rush": {"start": 15.5, "end": 16, "intensity": 1.4},
            "after_hours": {"start": 16, "end": 20, "intensity": 0.4}
        }

        # Dynamic parameters
        self.current_volatility = 1.0
        self.liquidity_shock_probability = 0.001  # Per minute
        self.regime_transition_probabilities = {
            LiquidityRegime.ABUNDANT: {LiquidityRegime.NORMAL: 0.05, LiquidityRegime.STRESSED: 0.001},
            LiquidityRegime.NORMAL: {LiquidityRegime.ABUNDANT: 0.02, LiquidityRegime.STRESSED: 0.01},
            LiquidityRegime.STRESSED: {LiquidityRegime.NORMAL: 0.1, LiquidityRegime.CRISIS: 0.05},
            LiquidityRegime.CRISIS: {LiquidityRegime.STRESSED: 0.2, LiquidityRegime.NORMAL: 0.02}
        }

        logger.info(f"Initialized liquidity dynamics simulator for {symbol}")

    async def initialize_liquidity_providers(self, reference_price: Decimal) -> None:
        """Initialize liquidity providers with realistic configurations."""
        # Initialize market makers
        for mm_config in self.market_makers:
            provider = LiquidityProvider(
                provider_id=mm_config.market_maker_id,
                provider_type="market_maker",
                symbol=self.symbol,
                venue=self.venue.venue_name,
                total_volume_provided=Decimal("0"),
                fill_rate=0.95,  # Market makers typically have high fill rates
                average_spread_provided=mm_config.target_spread_bps,
                inventory_limit=mm_config.max_inventory,
                risk_limit=mm_config.risk_limit,
                is_active=True,
                last_activity=datetime.utcnow()
            )

            self.liquidity_providers[mm_config.market_maker_id] = provider
            self.mm_inventories[mm_config.market_maker_id] = Decimal("0")
            self.mm_risk_metrics[mm_config.market_maker_id] = {
                "inventory_utilization": 0.0,
                "pnl": 0.0,
                "risk_utilization": 0.0,
                "quote_rate": mm_config.quote_refresh_rate
            }

        # Add institutional liquidity providers
        institutional_providers = ["institution_1", "institution_2", "hedge_fund_1"]
        for inst_id in institutional_providers:
            provider = LiquidityProvider(
                provider_id=inst_id,
                provider_type="institutional",
                symbol=self.symbol,
                venue=self.venue.venue_name,
                total_volume_provided=Decimal("0"),
                fill_rate=0.7,  # Lower fill rate for institutions
                average_spread_provided=Decimal("5"),  # Tighter spreads
                inventory_limit=Decimal("50000"),
                risk_limit=Decimal("100000"),
                is_active=True,
                last_activity=datetime.utcnow()
            )
            self.liquidity_providers[inst_id] = provider

        # Add retail aggregators
        retail_providers = ["retail_broker_1", "retail_broker_2"]
        for retail_id in retail_providers:
            provider = LiquidityProvider(
                provider_id=retail_id,
                provider_type="retail",
                symbol=self.symbol,
                venue=self.venue.venue_name,
                total_volume_provided=Decimal("0"),
                fill_rate=0.6,  # Variable fill rate for retail
                average_spread_provided=Decimal("15"),  # Wider spreads
                inventory_limit=Decimal("10000"),
                risk_limit=Decimal("25000"),
                is_active=True,
                last_activity=datetime.utcnow()
            )
            self.liquidity_providers[retail_id] = provider

        await self._update_liquidity_state()
        logger.info(f"Initialized {len(self.liquidity_providers)} liquidity providers")

    async def simulate_liquidity_provision(
        self,
        current_time: datetime,
        reference_price: Decimal,
        recent_volatility: float = None
    ) -> List[LiquidityProvision]:
        """Simulate liquidity provision based on current market conditions."""
        if recent_volatility:
            self.current_volatility = recent_volatility

        provisions = []

        # Update liquidity regime if necessary
        await self._update_liquidity_regime(current_time)

        # Simulate market maker provisions
        for mm_config in self.market_makers:
            mm_provisions = await self._simulate_market_maker_provision(
                mm_config, current_time, reference_price
            )
            provisions.extend(mm_provisions)

        # Simulate institutional provisions
        institutional_provisions = await self._simulate_institutional_provision(
            current_time, reference_price
        )
        provisions.extend(institutional_provisions)

        # Simulate retail provisions
        retail_provisions = await self._simulate_retail_provision(
            current_time, reference_price
        )
        provisions.extend(retail_provisions)

        # Process liquidity shocks
        if random.random() < self.liquidity_shock_probability:
            shock_provisions = await self._simulate_liquidity_shock(current_time, reference_price)
            provisions.extend(shock_provisions)

        # Update liquidity state
        await self._update_liquidity_state()

        return provisions

    async def _simulate_market_maker_provision(
        self,
        mm_config: MarketMakerConfig,
        current_time: datetime,
        reference_price: Decimal
    ) -> List[LiquidityProvision]:
        """Simulate market maker liquidity provision behavior."""
        provisions = []
        mm_id = mm_config.market_maker_id

        # Check if market maker should be active
        if not self._is_market_maker_active(mm_config, current_time):
            return provisions

        current_inventory = self.mm_inventories.get(mm_id, Decimal("0"))
        inventory_ratio = abs(float(current_inventory)) / float(mm_config.max_inventory)

        # Adjust provision based on inventory
        base_size = mm_config.base_order_size
        inventory_adjustment = max(0.3, 1.0 - inventory_ratio)  # Reduce size as inventory grows
        provision_size = base_size * Decimal(str(inventory_adjustment))

        # Adjust spread based on inventory and market conditions
        inventory_spread_penalty = inventory_ratio * 2.0  # 200bps max penalty
        volatility_spread_penalty = (self.current_volatility - 1.0) * 5.0  # 5bps per 1% vol
        regime_spread_penalty = self._get_regime_spread_penalty()

        adjusted_spread = mm_config.target_spread_bps + inventory_spread_penalty + \
                         volatility_spread_penalty + regime_spread_penalty

        # Calculate bid/ask prices
        half_spread = reference_price * Decimal(str(adjusted_spread / 20000))
        bid_price = reference_price - half_spread
        ask_price = reference_price + half_spread

        # Create bid provision (unless heavily long)
        if current_inventory < mm_config.max_inventory * Decimal("0.8"):
            bid_provision = LiquidityProvision(
                provision_id=f"mm_bid_{mm_id}_{int(current_time.timestamp())}",
                provider_id=mm_id,
                symbol=self.symbol,
                venue=self.venue.venue_name,
                side=OrderSide.BUY,
                price=bid_price.quantize(Decimal("0.01")),
                size=provision_size,
                timestamp=current_time,
                provision_type="market_maker",
                spread_bps=adjusted_spread / 2,  # Half spread
                is_aggressive=False,
                time_to_fill_seconds=0.0,
                inventory_impact=float(current_inventory)
            )
            provisions.append(bid_provision)

        # Create ask provision (unless heavily short)
        if current_inventory > -mm_config.max_inventory * Decimal("0.8"):
            ask_provision = LiquidityProvision(
                provision_id=f"mm_ask_{mm_id}_{int(current_time.timestamp())}",
                provider_id=mm_id,
                symbol=self.symbol,
                venue=self.venue.venue_name,
                side=OrderSide.SELL,
                price=ask_price.quantize(Decimal("0.01")),
                size=provision_size,
                timestamp=current_time,
                provision_type="market_maker",
                spread_bps=adjusted_spread / 2,
                is_aggressive=False,
                time_to_fill_seconds=0.0,
                inventory_impact=float(current_inventory)
            )
            provisions.append(ask_provision)

        # Update market maker metrics
        self.mm_risk_metrics[mm_id]["inventory_utilization"] = inventory_ratio
        self.mm_last_provision[mm_id] = current_time

        return provisions

    async def _simulate_institutional_provision(
        self,
        current_time: datetime,
        reference_price: Decimal
    ) -> List[LiquidityProvision]:
        """Simulate institutional liquidity provision patterns."""
        provisions = []

        # Get current session intensity
        session_intensity = self._get_institutional_session_intensity(current_time)

        for provider_id, provider in self.liquidity_providers.items():
            if provider.provider_type != "institutional":
                continue

            # Institutional providers are less frequent but larger
            provision_probability = 0.1 * session_intensity  # 10% base probability adjusted by session

            if random.random() < provision_probability:
                # Institutions typically provide deeper liquidity
                size_multiplier = random.uniform(2.0, 5.0)
                base_size = Decimal("500") * Decimal(str(size_multiplier))

                # Institutions prefer to provide liquidity away from the touch
                levels_away = random.randint(1, 3)
                price_offset = reference_price * Decimal(str(levels_away * 0.0005))  # 5bps per level

                # Random side selection
                side = random.choice([OrderSide.BUY, OrderSide.SELL])
                if side == OrderSide.BUY:
                    price = reference_price - price_offset
                else:
                    price = reference_price + price_offset

                provision = LiquidityProvision(
                    provision_id=f"inst_{provider_id}_{int(current_time.timestamp())}",
                    provider_id=provider_id,
                    symbol=self.symbol,
                    venue=self.venue.venue_name,
                    side=side,
                    price=price.quantize(Decimal("0.01")),
                    size=base_size,
                    timestamp=current_time,
                    provision_type="institutional",
                    spread_bps=self._price_to_bps(price_offset, reference_price),
                    is_aggressive=False,
                    time_to_fill_seconds=random.uniform(30, 300),  # Longer time to fill
                    inventory_impact=0.0
                )
                provisions.append(provision)

        return provisions

    async def _simulate_retail_provision(
        self,
        current_time: datetime,
        reference_price: Decimal
    ) -> List[LiquidityProvision]:
        """Simulate retail liquidity provision patterns."""
        provisions = []

        # Get retail flow intensity
        retail_intensity = self._get_retail_flow_intensity(current_time)

        for provider_id, provider in self.liquidity_providers.items():
            if provider.provider_type != "retail":
                continue

            # Retail flow is more frequent but smaller
            provision_probability = 0.3 * retail_intensity

            if random.random() < provision_probability:
                # Retail orders are typically smaller
                size_multiplier = random.uniform(0.5, 2.0)
                base_size = Decimal("100") * Decimal(str(size_multiplier))

                # Retail tends to provide liquidity at wider spreads
                spread_multiplier = random.uniform(1.2, 2.0)
                spread_bps = self.venue.typical_spread_bps * spread_multiplier
                half_spread = reference_price * Decimal(str(spread_bps / 20000))

                # Random side selection with slight buy bias during bull markets
                buy_bias = 0.55 if self.liquidity_state.regime == LiquidityRegime.ABUNDANT else 0.5
                side = OrderSide.BUY if random.random() < buy_bias else OrderSide.SELL

                if side == OrderSide.BUY:
                    price = reference_price - half_spread
                else:
                    price = reference_price + half_spread

                provision = LiquidityProvision(
                    provision_id=f"retail_{provider_id}_{int(current_time.timestamp())}",
                    provider_id=provider_id,
                    symbol=self.symbol,
                    venue=self.venue.venue_name,
                    side=side,
                    price=price.quantize(Decimal("0.01")),
                    size=base_size,
                    timestamp=current_time,
                    provision_type="retail",
                    spread_bps=spread_bps / 2,
                    is_aggressive=False,
                    time_to_fill_seconds=random.uniform(10, 120),
                    inventory_impact=0.0
                )
                provisions.append(provision)

        return provisions

    async def _simulate_liquidity_shock(
        self,
        current_time: datetime,
        reference_price: Decimal
    ) -> List[LiquidityProvision]:
        """Simulate sudden liquidity withdrawal (liquidity shock)."""
        logger.warning(f"Liquidity shock event at {current_time}")

        # During liquidity shocks, providers withdraw liquidity
        withdrawals = []

        # Market makers reduce provision
        shock_intensity = random.uniform(0.3, 0.8)  # 30-80% reduction

        for provider_id, provider in self.liquidity_providers.items():
            if provider.provider_type == "market_maker":
                # Reduce market maker provision
                reduction_factor = shock_intensity

                withdrawal = LiquidityWithdrawal(
                    withdrawal_id=f"shock_{provider_id}_{int(current_time.timestamp())}",
                    provider_id=provider_id,
                    symbol=self.symbol,
                    venue=self.venue.venue_name,
                    withdrawal_type="shock",
                    withdrawn_bid_size=Decimal(str(1000 * reduction_factor)),
                    withdrawn_ask_size=Decimal(str(1000 * reduction_factor)),
                    timestamp=current_time,
                    reason="liquidity_shock",
                    duration_seconds=random.uniform(30, 300)
                )

        # Update regime to stressed
        self.liquidity_state.regime = LiquidityRegime.STRESSED
        self.liquidity_state.volatility_impact = min(3.0, self.liquidity_state.volatility_impact * 1.5)

        return []  # No provisions during shock, only withdrawals

    def _is_market_maker_active(self, mm_config: MarketMakerConfig, current_time: datetime) -> bool:
        """Determine if market maker should be actively providing liquidity."""
        # Check if within risk limits
        mm_id = mm_config.market_maker_id
        current_inventory = self.mm_inventories.get(mm_id, Decimal("0"))

        if abs(current_inventory) >= mm_config.max_inventory:
            return False

        # Check quote refresh rate
        last_provision = self.mm_last_provision.get(mm_id, current_time - timedelta(hours=1))
        time_since_last = (current_time - last_provision).total_seconds()
        min_interval = 1.0 / mm_config.quote_refresh_rate

        if time_since_last < min_interval:
            return False

        # Market makers reduce activity during stressed conditions
        if self.liquidity_state.regime == LiquidityRegime.STRESSED:
            return random.random() < 0.7  # 70% chance to be active

        if self.liquidity_state.regime == LiquidityRegime.CRISIS:
            return random.random() < 0.3  # 30% chance to be active

        return True

    def _get_institutional_session_intensity(self, current_time: datetime) -> float:
        """Get institutional trading session intensity based on time of day."""
        hour = current_time.hour + current_time.minute / 60.0

        for session_name, session in self.institutional_sessions.items():
            if session["start"] <= hour <= session["end"]:
                return session["intensity"]

        return 0.5  # Default intensity

    def _get_retail_flow_intensity(self, current_time: datetime) -> float:
        """Get retail flow intensity based on time of day patterns."""
        hour = current_time.hour + current_time.minute / 60.0

        for pattern_name, pattern in self.retail_patterns.items():
            if pattern["start"] <= hour <= pattern["end"]:
                return pattern["intensity"]

        return 0.8  # Default intensity

    def _get_regime_spread_penalty(self) -> float:
        """Get spread penalty based on current liquidity regime."""
        regime_penalties = {
            LiquidityRegime.ABUNDANT: -2.0,  # 2bps tighter
            LiquidityRegime.NORMAL: 0.0,
            LiquidityRegime.STRESSED: 5.0,   # 5bps wider
            LiquidityRegime.CRISIS: 15.0     # 15bps wider
        }
        return regime_penalties.get(self.liquidity_state.regime, 0.0)

    def _price_to_bps(self, price_diff: Decimal, reference_price: Decimal) -> Decimal:
        """Convert price difference to basis points."""
        if reference_price == 0:
            return Decimal("0")
        return ((price_diff / reference_price) * 10000).quantize(Decimal("0.01"))

    async def _update_liquidity_regime(self, current_time: datetime) -> None:
        """Update liquidity regime based on market conditions."""
        current_regime = self.liquidity_state.regime

        # Check for regime transitions
        transitions = self.regime_transition_probabilities.get(current_regime, {})

        for target_regime, probability in transitions.items():
            if random.random() < probability:
                logger.info(f"Liquidity regime transition: {current_regime.value} -> {target_regime.value}")
                self.liquidity_state.regime = target_regime
                break

        self.liquidity_state.last_update = current_time

    async def _update_liquidity_state(self) -> None:
        """Update overall liquidity state metrics."""
        # Calculate total liquidity from active providers
        total_bid_liquidity = Decimal("0")
        total_ask_liquidity = Decimal("0")

        for provider in self.liquidity_providers.values():
            if provider.is_active:
                # Estimate liquidity contribution based on provider type
                if provider.provider_type == "market_maker":
                    total_bid_liquidity += Decimal("1000")  # Base MM liquidity
                    total_ask_liquidity += Decimal("1000")
                elif provider.provider_type == "institutional":
                    total_bid_liquidity += Decimal("2000")  # Deeper institutional liquidity
                    total_ask_liquidity += Decimal("2000")
                else:  # retail
                    total_bid_liquidity += Decimal("300")
                    total_ask_liquidity += Decimal("300")

        self.liquidity_state.total_bid_liquidity = total_bid_liquidity
        self.liquidity_state.total_ask_liquidity = total_ask_liquidity

        # Calculate liquidity imbalance
        total_liquidity = total_bid_liquidity + total_ask_liquidity
        if total_liquidity > 0:
            self.liquidity_state.liquidity_imbalance = float(
                (total_bid_liquidity - total_ask_liquidity) / total_liquidity
            )

        # Update market depth score
        base_depth_score = 0.5
        liquidity_factor = min(1.0, float(total_liquidity) / 10000.0)  # Normalize to 10k base
        regime_factor = self._get_regime_depth_factor()

        self.liquidity_state.market_depth_score = base_depth_score * liquidity_factor * regime_factor

    def _get_regime_depth_factor(self) -> float:
        """Get depth factor based on liquidity regime."""
        factors = {
            LiquidityRegime.ABUNDANT: 1.3,
            LiquidityRegime.NORMAL: 1.0,
            LiquidityRegime.STRESSED: 0.7,
            LiquidityRegime.CRISIS: 0.4
        }
        return factors.get(self.liquidity_state.regime, 1.0)

    async def process_liquidity_consumption(
        self,
        consumed_size: Decimal,
        consumed_side: OrderSide,
        consumer_type: str,
        current_time: datetime
    ) -> None:
        """Process liquidity consumption and update provider metrics."""
        # Update liquidity provider metrics
        for provider in self.liquidity_providers.values():
            if provider.provider_type == consumer_type or consumer_type == "market_order":
                # Update volume provided (in case of market maker fills)
                if provider.provider_type == "market_maker":
                    provider.total_volume_provided += consumed_size * Decimal("0.5")  # Partial attribution

                provider.last_activity = current_time

        # Create liquidity event
        event = LiquidityEvent(
            event_id=f"consumption_{int(current_time.timestamp())}",
            symbol=self.symbol,
            venue=self.venue.venue_name,
            event_type="consumption",
            timestamp=current_time,
            affected_side=consumed_side,
            size_impact=consumed_size,
            price_impact_bps=Decimal("0"),  # Would calculate based on order book
            liquidity_regime=self.liquidity_state.regime.value,
            provider_count=len([p for p in self.liquidity_providers.values() if p.is_active])
        )

        self.liquidity_events.append(event)

        # Update liquidity state
        await self._update_liquidity_state()

    def get_current_liquidity_metrics(self) -> Dict[str, Any]:
        """Get current liquidity metrics for monitoring."""
        active_providers = len([p for p in self.liquidity_providers.values() if p.is_active])

        return {
            "regime": self.liquidity_state.regime.value,
            "total_bid_liquidity": float(self.liquidity_state.total_bid_liquidity),
            "total_ask_liquidity": float(self.liquidity_state.total_ask_liquidity),
            "liquidity_imbalance": self.liquidity_state.liquidity_imbalance,
            "market_depth_score": self.liquidity_state.market_depth_score,
            "active_providers": active_providers,
            "mm_count": len([p for p in self.liquidity_providers.values()
                           if p.provider_type == "market_maker" and p.is_active]),
            "effective_spread_bps": float(self.liquidity_state.effective_spread_bps),
            "volatility_impact": self.liquidity_state.volatility_impact,
            "last_update": self.liquidity_state.last_update
        }