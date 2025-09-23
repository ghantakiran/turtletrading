"""
Order Book Simulation Engine for Market Microstructure Simulator

This module provides a comprehensive order book simulation engine that models
realistic market microstructure behavior including:
- Order book dynamics and price formation
- Liquidity provision and consumption patterns
- Market maker behavior and spread dynamics
- Order flow imbalance and price impact
- Latency effects and execution delays
"""

import asyncio
import random
import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional, Tuple, Callable, Any
from dataclasses import dataclass, field
from collections import defaultdict, deque
import numpy as np
from enum import Enum

from ..models.market_microstructure_models import (
    OrderBook, OrderBookLevel, MarketOrder, OrderType, OrderSide,
    OrderExecution, ExecutionType, VenueCharacteristics, LiquidityProvider,
    MarketMakerConfig, OrderFlowMetrics, SimulationParameters,
    MarketImpactModel, LatencyModel, SlippageComponent,
    MicrostructureAnalytics, OrderBookSnapshot
)

logger = logging.getLogger(__name__)


class OrderBookSimulationEngine:
    """
    Advanced order book simulation engine that models realistic market microstructure
    behavior with configurable parameters for different market conditions.
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

        # Order book state
        self.order_book = OrderBook(
            symbol=symbol,
            venue=venue_characteristics.venue_name,
            timestamp=datetime.utcnow(),
            bids=[],
            asks=[],
            last_price=Decimal("100.00"),
            bid_price=Decimal("99.95"),
            ask_price=Decimal("100.05"),
            spread_bps=10,
            mid_price=Decimal("100.00"),
            order_flow_imbalance=0.0,
            effective_spread_bps=Decimal("0.10"),
            realized_spread_bps=Decimal("0.08"),
            price_improvement_bps=Decimal("0.02"),
            market_depth_bps=Decimal("50.0"),
            liquidity_score=0.85,
            volatility_regime="normal"
        )

        # Simulation state
        self.current_time = datetime.utcnow()
        self.order_id_counter = 1
        self.execution_history: List[OrderExecution] = []
        self.analytics_history: List[MicrostructureAnalytics] = []
        self.pending_orders: Dict[str, MarketOrder] = {}
        self.liquidity_providers: Dict[str, LiquidityProvider] = {}

        # Market maker state
        self.mm_inventories: Dict[str, Decimal] = {}
        self.mm_last_update: Dict[str, datetime] = {}

        # Performance tracking
        self.order_flow_metrics = OrderFlowMetrics(
            symbol=symbol,
            venue=venue_characteristics.venue_name,
            timestamp=self.current_time,
            total_orders=0,
            buy_orders=0,
            sell_orders=0,
            aggressive_orders=0,
            passive_orders=0,
            average_order_size=Decimal("0"),
            order_arrival_rate=0.0,
            cancellation_rate=0.0,
            fill_rate=0.0,
            average_time_to_fill=0.0,
            flow_toxicity_score=0.0
        )

        logger.info(f"Initialized order book simulation for {symbol} on {venue_characteristics.venue_name}")

    async def initialize_order_book(self, reference_price: Decimal = None) -> None:
        """Initialize the order book with realistic spread and depth."""
        if reference_price:
            self.order_book.last_price = reference_price
            self.order_book.mid_price = reference_price

        # Calculate initial spread based on venue characteristics
        base_spread_bps = self.venue.typical_spread_bps
        volatility_multiplier = 1.0 + (0.5 * random.random())  # Add some randomness
        spread_bps = base_spread_bps * volatility_multiplier

        half_spread = self.order_book.mid_price * Decimal(str(spread_bps / 20000))  # Half spread

        self.order_book.bid_price = self.order_book.mid_price - half_spread
        self.order_book.ask_price = self.order_book.mid_price + half_spread
        self.order_book.spread_bps = spread_bps

        # Initialize market makers
        await self._initialize_market_makers()

        # Generate initial liquidity
        await self._generate_initial_liquidity()

        logger.info(f"Order book initialized: bid={self.order_book.bid_price}, "
                   f"ask={self.order_book.ask_price}, spread={spread_bps:.2f}bps")

    async def _initialize_market_makers(self) -> None:
        """Initialize market maker positions and state."""
        for mm_config in self.market_makers:
            mm_id = mm_config.market_maker_id
            self.mm_inventories[mm_id] = Decimal("0")
            self.mm_last_update[mm_id] = self.current_time

            # Create liquidity provider entry
            self.liquidity_providers[mm_id] = LiquidityProvider(
                provider_id=mm_id,
                provider_type="market_maker",
                symbol=self.symbol,
                venue=self.venue.venue_name,
                total_volume_provided=Decimal("0"),
                fill_rate=0.0,
                average_spread_provided=mm_config.target_spread_bps,
                inventory_limit=mm_config.max_inventory,
                risk_limit=mm_config.risk_limit,
                is_active=True,
                last_activity=self.current_time
            )

    async def _generate_initial_liquidity(self) -> None:
        """Generate initial order book liquidity using market maker models."""
        # Generate bid levels
        for i in range(10):  # 10 levels deep
            level_offset = (i + 1) * (self.order_book.spread_bps / 2000) * self.order_book.mid_price
            price = self.order_book.bid_price - (level_offset * Decimal(str(i * 0.5)))

            # Size decreases with distance from best bid
            base_size = random.uniform(100, 1000)
            size_decay = 0.8 ** i
            size = Decimal(str(base_size * size_decay)).quantize(Decimal("0.01"))

            level = OrderBookLevel(
                price=price.quantize(Decimal("0.01")),
                size=size,
                order_count=random.randint(1, 5),
                provider_type="market_maker",
                timestamp=self.current_time
            )
            self.order_book.bids.append(level)

        # Generate ask levels
        for i in range(10):
            level_offset = (i + 1) * (self.order_book.spread_bps / 2000) * self.order_book.mid_price
            price = self.order_book.ask_price + (level_offset * Decimal(str(i * 0.5)))

            base_size = random.uniform(100, 1000)
            size_decay = 0.8 ** i
            size = Decimal(str(base_size * size_decay)).quantize(Decimal("0.01"))

            level = OrderBookLevel(
                price=price.quantize(Decimal("0.01")),
                size=size,
                order_count=random.randint(1, 5),
                provider_type="market_maker",
                timestamp=self.current_time
            )
            self.order_book.asks.append(level)

        # Sort levels
        self.order_book.bids.sort(key=lambda x: x.price, reverse=True)
        self.order_book.asks.sort(key=lambda x: x.price)

        await self._update_order_book_metrics()

    async def process_market_order(self, order: MarketOrder) -> List[OrderExecution]:
        """Process a market order against the current order book."""
        executions = []
        remaining_size = order.size

        # Determine which side of the book to hit
        levels_to_hit = self.order_book.asks if order.side == OrderSide.BUY else self.order_book.bids

        # Apply latency simulation
        latency_delay = await self._simulate_latency(order)
        if latency_delay > 0:
            await asyncio.sleep(latency_delay / 1000)  # Convert ms to seconds

        execution_price_total = Decimal("0")
        execution_size_total = Decimal("0")

        # Walk through the book levels
        for level in levels_to_hit[:]:  # Create copy to modify safely
            if remaining_size <= 0:
                break

            # Calculate execution size for this level
            execution_size = min(remaining_size, level.size)
            execution_price = level.price

            # Apply market impact
            impact_adjustment = await self._calculate_market_impact(order, execution_size)
            if order.side == OrderSide.BUY:
                execution_price += impact_adjustment
            else:
                execution_price -= impact_adjustment

            # Create execution
            execution = OrderExecution(
                execution_id=f"exec_{self.order_id_counter}",
                order_id=order.order_id,
                symbol=order.symbol,
                venue=self.venue.venue_name,
                execution_type=ExecutionType.FULL if execution_size == order.size else ExecutionType.PARTIAL,
                side=order.side,
                executed_size=execution_size,
                executed_price=execution_price,
                commission=self._calculate_commission(execution_size, execution_price),
                timestamp=self.current_time,
                latency_ms=latency_delay,
                is_aggressive=True,
                counterparty_type=level.provider_type,
                market_impact_bps=self._price_to_bps(impact_adjustment, execution_price)
            )

            executions.append(execution)
            self.execution_history.append(execution)

            # Update tracking
            execution_price_total += execution_price * execution_size
            execution_size_total += execution_size
            remaining_size -= execution_size

            # Update order book level
            level.size -= execution_size
            if level.size <= 0:
                levels_to_hit.remove(level)

            self.order_id_counter += 1

        # Update order book state
        if execution_size_total > 0:
            vwap = execution_price_total / execution_size_total
            self.order_book.last_price = vwap
            await self._update_best_bid_ask()
            await self._update_order_book_metrics()

        # Update order flow metrics
        await self._update_order_flow_metrics(order, executions)

        # Trigger market maker response
        await self._trigger_market_maker_updates(order, executions)

        logger.info(f"Processed {order.side.value} order: {len(executions)} executions, "
                   f"total size: {execution_size_total}, VWAP: {vwap if execution_size_total > 0 else 'N/A'}")

        return executions

    async def process_limit_order(self, order: MarketOrder) -> List[OrderExecution]:
        """Process a limit order, either executing immediately or adding to book."""
        executions = []

        # Check if order can execute immediately
        if order.order_type == OrderType.LIMIT and order.limit_price:
            can_execute = (
                (order.side == OrderSide.BUY and order.limit_price >= self.order_book.ask_price) or
                (order.side == OrderSide.SELL and order.limit_price <= self.order_book.bid_price)
            )

            if can_execute:
                # Execute as market order up to limit price
                executions = await self._execute_limit_order_aggressive(order)
            else:
                # Add to order book
                await self._add_order_to_book(order)

        return executions

    async def _execute_limit_order_aggressive(self, order: MarketOrder) -> List[OrderExecution]:
        """Execute a limit order aggressively against existing liquidity."""
        executions = []
        remaining_size = order.size

        levels_to_hit = self.order_book.asks if order.side == OrderSide.BUY else self.order_book.bids

        for level in levels_to_hit[:]:
            if remaining_size <= 0:
                break

            # Check price limit
            if order.side == OrderSide.BUY and level.price > order.limit_price:
                break
            if order.side == OrderSide.SELL and level.price < order.limit_price:
                break

            execution_size = min(remaining_size, level.size)

            execution = OrderExecution(
                execution_id=f"exec_{self.order_id_counter}",
                order_id=order.order_id,
                symbol=order.symbol,
                venue=self.venue.venue_name,
                execution_type=ExecutionType.PARTIAL,
                side=order.side,
                executed_size=execution_size,
                executed_price=level.price,
                commission=self._calculate_commission(execution_size, level.price),
                timestamp=self.current_time,
                latency_ms=0,  # Limit orders typically have lower latency
                is_aggressive=True,
                counterparty_type=level.provider_type,
                market_impact_bps=Decimal("0")  # No additional impact for limit orders
            )

            executions.append(execution)
            remaining_size -= execution_size
            level.size -= execution_size

            if level.size <= 0:
                levels_to_hit.remove(level)

            self.order_id_counter += 1

        # Add remaining size to book if any
        if remaining_size > 0:
            remaining_order = MarketOrder(
                order_id=order.order_id,
                symbol=order.symbol,
                side=order.side,
                size=remaining_size,
                order_type=order.order_type,
                limit_price=order.limit_price,
                timestamp=order.timestamp,
                venue=order.venue,
                client_order_id=order.client_order_id
            )
            await self._add_order_to_book(remaining_order)

        return executions

    async def _add_order_to_book(self, order: MarketOrder) -> None:
        """Add a limit order to the order book."""
        if not order.limit_price:
            return

        new_level = OrderBookLevel(
            price=order.limit_price,
            size=order.size,
            order_count=1,
            provider_type="retail",  # Assume retail for non-market maker orders
            timestamp=self.current_time
        )

        # Add to appropriate side
        if order.side == OrderSide.BUY:
            self.order_book.bids.append(new_level)
            self.order_book.bids.sort(key=lambda x: x.price, reverse=True)
        else:
            self.order_book.asks.append(new_level)
            self.order_book.asks.sort(key=lambda x: x.price)

        # Store pending order
        self.pending_orders[order.order_id] = order

        await self._update_best_bid_ask()
        await self._update_order_book_metrics()

    async def _simulate_latency(self, order: MarketOrder) -> float:
        """Simulate order processing latency based on venue characteristics."""
        base_latency = self.venue.average_latency_ms

        # Add randomness and order type effects
        randomness = random.uniform(0.5, 1.5)
        type_multiplier = 1.2 if order.order_type == OrderType.MARKET else 1.0

        latency = base_latency * randomness * type_multiplier

        # Add network jitter
        jitter = random.uniform(-5, 5)

        return max(0, latency + jitter)

    async def _calculate_market_impact(self, order: MarketOrder, execution_size: Decimal) -> Decimal:
        """Calculate market impact for an order execution."""
        # Simple square-root impact model
        impact_coefficient = self.params.market_impact_model.permanent_impact_coefficient

        # Size impact (square root of participation rate)
        participation_rate = float(execution_size) / float(self._estimate_average_volume())
        size_impact = impact_coefficient * (participation_rate ** 0.5)

        # Convert to price impact
        price_impact = self.order_book.mid_price * Decimal(str(size_impact / 10000))

        return price_impact.quantize(Decimal("0.0001"))

    def _estimate_average_volume(self) -> Decimal:
        """Estimate average trading volume for impact calculations."""
        # Use venue characteristics or historical data
        return Decimal("10000")  # Placeholder - should be based on historical data

    def _calculate_commission(self, size: Decimal, price: Decimal) -> Decimal:
        """Calculate commission for an execution."""
        notional = size * price
        commission_rate = self.venue.maker_fee if random.random() < 0.5 else self.venue.taker_fee
        return (notional * commission_rate).quantize(Decimal("0.01"))

    def _price_to_bps(self, price_diff: Decimal, reference_price: Decimal) -> Decimal:
        """Convert price difference to basis points."""
        if reference_price == 0:
            return Decimal("0")
        return ((price_diff / reference_price) * 10000).quantize(Decimal("0.01"))

    async def _update_best_bid_ask(self) -> None:
        """Update best bid and ask prices."""
        if self.order_book.bids:
            self.order_book.bid_price = self.order_book.bids[0].price

        if self.order_book.asks:
            self.order_book.ask_price = self.order_book.asks[0].price

        if self.order_book.bids and self.order_book.asks:
            self.order_book.mid_price = (self.order_book.bid_price + self.order_book.ask_price) / 2
            spread = self.order_book.ask_price - self.order_book.bid_price
            self.order_book.spread_bps = self._price_to_bps(spread, self.order_book.mid_price)

    async def _update_order_book_metrics(self) -> None:
        """Update order book microstructure metrics."""
        if not self.order_book.bids or not self.order_book.asks:
            return

        # Calculate order flow imbalance
        bid_volume = sum(level.size for level in self.order_book.bids[:5])
        ask_volume = sum(level.size for level in self.order_book.asks[:5])
        total_volume = bid_volume + ask_volume

        if total_volume > 0:
            self.order_book.order_flow_imbalance = float((bid_volume - ask_volume) / total_volume)

        # Calculate market depth
        depth_levels = 5
        bid_depth = sum(level.size * level.price for level in self.order_book.bids[:depth_levels])
        ask_depth = sum(level.size * level.price for level in self.order_book.asks[:depth_levels])
        total_depth = bid_depth + ask_depth

        if self.order_book.mid_price > 0:
            self.order_book.market_depth_bps = self._price_to_bps(
                total_depth / (depth_levels * 2),
                self.order_book.mid_price
            )

        # Update liquidity score (0-1 scale)
        spread_penalty = min(1.0, float(self.order_book.spread_bps) / 50.0)  # Penalty for wide spreads
        depth_bonus = min(1.0, float(total_depth) / 100000.0)  # Bonus for deep book
        self.order_book.liquidity_score = (1.0 - spread_penalty) * depth_bonus

        self.order_book.timestamp = self.current_time

    async def _update_order_flow_metrics(self, order: MarketOrder, executions: List[OrderExecution]) -> None:
        """Update order flow metrics based on recent activity."""
        self.order_flow_metrics.total_orders += 1

        if order.side == OrderSide.BUY:
            self.order_flow_metrics.buy_orders += 1
        else:
            self.order_flow_metrics.sell_orders += 1

        if order.order_type == OrderType.MARKET:
            self.order_flow_metrics.aggressive_orders += 1
        else:
            self.order_flow_metrics.passive_orders += 1

        # Update average order size
        total_size = self.order_flow_metrics.average_order_size * (self.order_flow_metrics.total_orders - 1)
        self.order_flow_metrics.average_order_size = (total_size + order.size) / self.order_flow_metrics.total_orders

        # Update fill rate
        if executions:
            executed_size = sum(exec.executed_size for exec in executions)
            fill_percentage = float(executed_size / order.size)
            current_fill_rate = self.order_flow_metrics.fill_rate * (self.order_flow_metrics.total_orders - 1)
            self.order_flow_metrics.fill_rate = (current_fill_rate + fill_percentage) / self.order_flow_metrics.total_orders

        self.order_flow_metrics.timestamp = self.current_time

    async def _trigger_market_maker_updates(self, order: MarketOrder, executions: List[OrderExecution]) -> None:
        """Trigger market maker updates in response to order flow."""
        for mm_config in self.market_makers:
            # Simple market maker response - replenish liquidity
            if random.random() < mm_config.quote_refresh_rate:
                await self._update_market_maker_quotes(mm_config)

    async def _update_market_maker_quotes(self, mm_config: MarketMakerConfig) -> None:
        """Update market maker quotes based on current market conditions."""
        # This is a simplified market maker behavior model
        # In practice, this would be much more sophisticated

        current_inventory = self.mm_inventories.get(mm_config.market_maker_id, Decimal("0"))

        # Adjust spread based on inventory
        inventory_penalty = abs(float(current_inventory)) / float(mm_config.max_inventory)
        adjusted_spread = mm_config.target_spread_bps * (1 + inventory_penalty)

        # Update quotes (this would modify the order book in practice)
        logger.debug(f"Market maker {mm_config.market_maker_id} updating quotes: "
                    f"spread={adjusted_spread:.2f}bps, inventory={current_inventory}")

    async def generate_order_book_snapshot(self) -> OrderBookSnapshot:
        """Generate a snapshot of current order book state."""
        return OrderBookSnapshot(
            symbol=self.symbol,
            venue=self.venue.venue_name,
            timestamp=self.current_time,
            bids=self.order_book.bids.copy(),
            asks=self.order_book.asks.copy(),
            last_trade_price=self.order_book.last_price,
            last_trade_size=Decimal("0"),  # Would track this in practice
            total_volume=Decimal("0"),  # Would track this in practice
            trade_count=len(self.execution_history),
            vwap=self._calculate_vwap(),
            order_flow_imbalance=self.order_book.order_flow_imbalance,
            effective_spread=self.order_book.effective_spread_bps,
            market_depth=self.order_book.market_depth_bps
        )

    def _calculate_vwap(self) -> Decimal:
        """Calculate volume-weighted average price from recent executions."""
        if not self.execution_history:
            return self.order_book.mid_price

        # Use last 100 executions or last hour, whichever is smaller
        recent_executions = self.execution_history[-100:]

        total_value = sum(exec.executed_price * exec.executed_size for exec in recent_executions)
        total_volume = sum(exec.executed_size for exec in recent_executions)

        if total_volume > 0:
            return total_value / total_volume

        return self.order_book.mid_price

    async def advance_time(self, time_delta: timedelta) -> None:
        """Advance simulation time and trigger time-based events."""
        self.current_time += time_delta

        # Trigger periodic market maker updates
        for mm_config in self.market_makers:
            last_update = self.mm_last_update.get(mm_config.market_maker_id, self.current_time)
            if (self.current_time - last_update).total_seconds() >= 1.0 / mm_config.quote_refresh_rate:
                await self._update_market_maker_quotes(mm_config)
                self.mm_last_update[mm_config.market_maker_id] = self.current_time

        # Update order book timestamp
        self.order_book.timestamp = self.current_time

    def get_current_state(self) -> Dict[str, Any]:
        """Get current simulation state for monitoring and analysis."""
        return {
            "timestamp": self.current_time,
            "order_book": self.order_book,
            "order_flow_metrics": self.order_flow_metrics,
            "execution_count": len(self.execution_history),
            "pending_orders": len(self.pending_orders),
            "market_maker_inventories": dict(self.mm_inventories),
            "liquidity_providers": len(self.liquidity_providers)
        }