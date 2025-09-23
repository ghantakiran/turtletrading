"""
Order Matching Engine for Market Microstructure Simulator

High-performance order matching engine that implements realistic
order matching algorithms with support for:
- Price-time priority matching
- Partial fills and order queue management
- Multiple order types (Market, Limit, Stop, IOC, FOK)
- Latency simulation and realistic execution delays
- Market impact modeling and slippage calculation
- Comprehensive execution reporting and analytics
"""

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional, Tuple, Any, Deque
from collections import deque, defaultdict
from dataclasses import dataclass, field
import uuid
import heapq
from enum import Enum

from ..models.market_microstructure_models import (
    MarketOrder, OrderBook, OrderBookLevel, OrderExecution, OrderSide,
    OrderType, OrderStatus, ParticipantType, ExecutionAlgorithm, VenueType,
    LatencyModel, SlippageModel, MarketImpactParameters, LiquidityDynamics,
    SimulationParameters, VenueCharacteristics
)
from ..core.order_state_machine import OrderLifecycleManager, get_default_lifecycle_manager

logger = logging.getLogger(__name__)


@dataclass
class OrderQueueEntry:
    """Entry in the order queue with priority and timing information"""
    order: MarketOrder
    priority: int  # Lower number = higher priority
    queue_time: datetime
    processing_time: Optional[datetime] = None

    def __lt__(self, other):
        """For priority queue ordering"""
        if self.priority != other.priority:
            return self.priority < other.priority
        return self.queue_time < other.queue_time


@dataclass
class MatchResult:
    """Result of order matching operation"""
    executions: List[OrderExecution]
    remaining_order: Optional[MarketOrder]
    market_impact_bps: Decimal
    slippage_bps: Decimal
    queue_position: int
    latency_ms: float

    @property
    def total_executed_quantity(self) -> int:
        return sum(exec.executed_quantity for exec in self.executions)

    @property
    def average_execution_price(self) -> Decimal:
        if not self.executions:
            return Decimal('0')
        total_value = sum(exec.execution_price * exec.executed_quantity for exec in self.executions)
        total_quantity = self.total_executed_quantity
        return total_value / total_quantity if total_quantity > 0 else Decimal('0')


class OrderMatchingEngine:
    """
    High-performance order matching engine with realistic market microstructure simulation.

    Features:
    - Price-time priority matching algorithm
    - Support for all major order types
    - Partial fill handling with queue management
    - Latency simulation and processing delays
    - Market impact and slippage calculation
    - Comprehensive execution analytics
    """

    def __init__(
        self,
        symbol: str,
        venue_characteristics: VenueCharacteristics,
        latency_model: LatencyModel,
        slippage_model: SlippageModel,
        market_impact_params: MarketImpactParameters,
        simulation_params: SimulationParameters,
        lifecycle_manager: Optional[OrderLifecycleManager] = None
    ):
        self.symbol = symbol
        self.venue = venue_characteristics
        self.latency_model = latency_model
        self.slippage_model = slippage_model
        self.market_impact_params = market_impact_params
        self.simulation_params = simulation_params
        self.lifecycle_manager = lifecycle_manager or get_default_lifecycle_manager()

        # Order book state - using price-time priority
        self.bid_levels: Dict[Decimal, Deque[MarketOrder]] = defaultdict(deque)
        self.ask_levels: Dict[Decimal, Deque[MarketOrder]] = defaultdict(deque)
        self.sorted_bid_prices: List[Decimal] = []  # Descending order
        self.sorted_ask_prices: List[Decimal] = []  # Ascending order

        # Order tracking
        self.active_orders: Dict[str, MarketOrder] = {}
        self.order_queue: List[OrderQueueEntry] = []  # Priority queue for processing
        self.execution_history: List[OrderExecution] = []

        # Market state
        self.last_trade_price: Decimal = Decimal('100.00')
        self.current_time: datetime = datetime.utcnow()
        self.order_id_counter: int = 1

        # Performance metrics
        self.total_orders_processed: int = 0
        self.total_executions: int = 0
        self.average_latency_ms: float = 0.0
        self.queue_depth_stats: Dict[str, float] = {}

        logger.info(f"Initialized order matching engine for {symbol} on {venue_characteristics.venue_id}")

    async def submit_order(self, order: MarketOrder) -> MatchResult:
        """
        Submit order to matching engine with realistic processing pipeline.

        Args:
            order: Market order to process

        Returns:
            MatchResult: Complete execution result with analytics
        """
        start_time = datetime.utcnow()

        # Calculate queue position and latency
        queue_position = len(self.order_queue) + 1
        latency_ms = await self._calculate_order_latency(order, queue_position)

        # Add to order queue with priority
        priority = self._calculate_order_priority(order)
        queue_entry = OrderQueueEntry(
            order=order,
            priority=priority,
            queue_time=self.current_time
        )

        heapq.heappush(self.order_queue, queue_entry)
        self.active_orders[order.order_id] = order

        # Update order state
        await self.lifecycle_manager.submit_order(order.order_id, {
            'queue_position': queue_position,
            'estimated_latency_ms': latency_ms
        })

        # Process queue if this is immediate execution
        if order.order_type == OrderType.MARKET or self._can_execute_immediately(order):
            # Simulate processing delay
            if latency_ms > 0:
                await asyncio.sleep(latency_ms / 1000)

            queue_entry.processing_time = self.current_time
            result = await self._process_order_immediate(queue_entry)
        else:
            # Add to order book for later matching
            await self._add_order_to_book(order)
            result = MatchResult(
                executions=[],
                remaining_order=order,
                market_impact_bps=Decimal('0'),
                slippage_bps=Decimal('0'),
                queue_position=queue_position,
                latency_ms=latency_ms
            )

        # Update performance metrics
        processing_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        await self._update_performance_metrics(processing_time_ms, queue_position)

        return result

    async def _process_order_immediate(self, queue_entry: OrderQueueEntry) -> MatchResult:
        """Process order immediately against existing order book"""
        order = queue_entry.order
        executions = []

        # Accept order
        await self.lifecycle_manager.accept_order(order.order_id)

        if order.order_type == OrderType.MARKET:
            executions = await self._execute_market_order(order)
        elif order.order_type == OrderType.LIMIT:
            executions = await self._execute_limit_order(order)
        elif order.order_type in [OrderType.STOP, OrderType.STOP_LIMIT]:
            executions = await self._execute_stop_order(order)

        # Calculate market impact and slippage
        market_impact_bps = await self._calculate_market_impact(order, executions)
        slippage_bps = await self._calculate_slippage(order, executions)

        # Update order status based on fill
        total_executed = sum(exec.executed_quantity for exec in executions)
        if total_executed == 0:
            await self.lifecycle_manager.reject_order(order.order_id, "No liquidity")
            remaining_order = order
        elif total_executed < order.quantity:
            await self.lifecycle_manager.fill_order(order.order_id, partial=True)
            remaining_order = MarketOrder(
                **order.dict(),
                order_id=f"{order.order_id}_remaining",
                quantity=order.quantity - total_executed,
                filled_quantity=0
            )
        else:
            await self.lifecycle_manager.fill_order(order.order_id, partial=False)
            remaining_order = None

        # Remove from active orders if fully processed
        if remaining_order is None:
            self.active_orders.pop(order.order_id, None)

        return MatchResult(
            executions=executions,
            remaining_order=remaining_order,
            market_impact_bps=market_impact_bps,
            slippage_bps=slippage_bps,
            queue_position=queue_entry.priority,
            latency_ms=(queue_entry.processing_time - queue_entry.queue_time).total_seconds() * 1000
        )

    async def _execute_market_order(self, order: MarketOrder) -> List[OrderExecution]:
        """Execute market order with price-time priority matching"""
        executions = []
        remaining_quantity = order.quantity

        # Get appropriate side of book to hit
        levels_to_hit = self.sorted_ask_prices if order.side == OrderSide.BUY else self.sorted_bid_prices
        level_queues = self.ask_levels if order.side == OrderSide.BUY else self.bid_levels

        for price in levels_to_hit:
            if remaining_quantity <= 0:
                break

            level_queue = level_queues[price]

            # Process orders at this price level in FIFO order
            while level_queue and remaining_quantity > 0:
                resting_order = level_queue[0]

                # Calculate execution quantity
                execution_quantity = min(remaining_quantity, resting_order.remaining_quantity)

                # Create execution with realistic timing
                execution = OrderExecution(
                    execution_id=str(uuid.uuid4()),
                    order_id=order.order_id,
                    symbol=order.symbol,
                    side=order.side,
                    executed_quantity=execution_quantity,
                    execution_price=price,
                    execution_time=self.current_time,
                    venue=self.venue.venue_id,
                    bid_price_at_execution=self._get_best_bid(),
                    ask_price_at_execution=self._get_best_ask(),
                    mid_price_at_execution=self._get_mid_price(),
                    spread_at_execution=self._get_spread(),
                    venue_type=self.venue.venue_type,
                    maker_taker_fee_bps=self.venue.taker_fee_bps
                )

                executions.append(execution)
                self.execution_history.append(execution)

                # Update order quantities
                remaining_quantity -= execution_quantity
                resting_order.filled_quantity += execution_quantity
                resting_order.remaining_quantity -= execution_quantity

                # Update last trade price
                self.last_trade_price = price

                # Remove resting order if fully filled
                if resting_order.remaining_quantity <= 0:
                    level_queue.popleft()
                    await self.lifecycle_manager.fill_order(resting_order.order_id, partial=False)
                    self.active_orders.pop(resting_order.order_id, None)
                else:
                    await self.lifecycle_manager.fill_order(resting_order.order_id, partial=True)

            # Remove price level if empty
            if not level_queue:
                if price in self.sorted_bid_prices:
                    self.sorted_bid_prices.remove(price)
                if price in self.sorted_ask_prices:
                    self.sorted_ask_prices.remove(price)

        return executions

    async def _execute_limit_order(self, order: MarketOrder) -> List[OrderExecution]:
        """Execute limit order - match what's possible, rest goes to book"""
        executions = []

        # Check if limit order can match immediately
        if order.side == OrderSide.BUY:
            can_match = self.sorted_ask_prices and order.limit_price >= self.sorted_ask_prices[0]
        else:
            can_match = self.sorted_bid_prices and order.limit_price <= self.sorted_bid_prices[0]

        if can_match:
            # Create temporary market order for immediate execution
            market_order = MarketOrder(
                **order.dict(),
                order_type=OrderType.MARKET
            )
            executions = await self._execute_market_order(market_order)

            # Add remaining quantity to book if any
            total_executed = sum(exec.executed_quantity for exec in executions)
            if total_executed < order.quantity:
                remaining_order = MarketOrder(
                    **order.dict(),
                    quantity=order.quantity - total_executed
                )
                await self._add_order_to_book(remaining_order)
        else:
            # Add entire order to book
            await self._add_order_to_book(order)

        return executions

    async def _execute_stop_order(self, order: MarketOrder) -> List[OrderExecution]:
        """Execute stop order (triggered when stop price is hit)"""
        # For simulation, we'll immediately trigger if stop condition is met
        current_price = self.last_trade_price

        should_trigger = False
        if order.side == OrderSide.BUY and order.stop_price and current_price >= order.stop_price:
            should_trigger = True
        elif order.side == OrderSide.SELL and order.stop_price and current_price <= order.stop_price:
            should_trigger = True

        if should_trigger:
            if order.order_type == OrderType.STOP:
                # Convert to market order
                market_order = MarketOrder(
                    **order.dict(),
                    order_type=OrderType.MARKET
                )
                return await self._execute_market_order(market_order)
            else:  # STOP_LIMIT
                # Convert to limit order
                limit_order = MarketOrder(
                    **order.dict(),
                    order_type=OrderType.LIMIT
                )
                return await self._execute_limit_order(limit_order)

        # If not triggered, add to book for monitoring
        await self._add_order_to_book(order)
        return []

    async def _add_order_to_book(self, order: MarketOrder) -> None:
        """Add order to the order book with price-time priority"""
        if not order.limit_price:
            logger.warning(f"Cannot add order {order.order_id} to book without limit price")
            return

        price = order.limit_price

        if order.side == OrderSide.BUY:
            self.bid_levels[price].append(order)
            if price not in self.sorted_bid_prices:
                self.sorted_bid_prices.append(price)
                self.sorted_bid_prices.sort(reverse=True)  # Descending order
        else:
            self.ask_levels[price].append(order)
            if price not in self.sorted_ask_prices:
                self.sorted_ask_prices.append(price)
                self.sorted_ask_prices.sort()  # Ascending order

        logger.debug(f"Added {order.side.value} order {order.order_id} to book at {price}")

    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an active order"""
        order = self.active_orders.get(order_id)
        if not order:
            return False

        # Remove from order book
        if order.limit_price:
            price = order.limit_price
            if order.side == OrderSide.BUY and price in self.bid_levels:
                queue = self.bid_levels[price]
                queue = deque([o for o in queue if o.order_id != order_id])
                if not queue:
                    del self.bid_levels[price]
                    if price in self.sorted_bid_prices:
                        self.sorted_bid_prices.remove(price)
                else:
                    self.bid_levels[price] = queue
            elif order.side == OrderSide.SELL and price in self.ask_levels:
                queue = self.ask_levels[price]
                queue = deque([o for o in queue if o.order_id != order_id])
                if not queue:
                    del self.ask_levels[price]
                    if price in self.sorted_ask_prices:
                        self.sorted_ask_prices.remove(price)
                else:
                    self.ask_levels[price] = queue

        # Update order state and remove from tracking
        await self.lifecycle_manager.cancel_order(order_id)
        self.active_orders.pop(order_id, None)

        return True

    def _calculate_order_priority(self, order: MarketOrder) -> int:
        """Calculate order priority for queue processing"""
        # Market orders get highest priority
        if order.order_type == OrderType.MARKET:
            return 1

        # IOC orders get high priority
        if order.time_in_force == "IOC":
            return 2

        # Stop orders get medium priority
        if order.order_type in [OrderType.STOP, OrderType.STOP_LIMIT]:
            return 3

        # Regular limit orders get normal priority
        return 4

    def _can_execute_immediately(self, order: MarketOrder) -> bool:
        """Check if order can execute immediately"""
        if order.order_type == OrderType.MARKET:
            return True

        if order.order_type == OrderType.LIMIT and order.limit_price:
            if order.side == OrderSide.BUY:
                return self.sorted_ask_prices and order.limit_price >= self.sorted_ask_prices[0]
            else:
                return self.sorted_bid_prices and order.limit_price <= self.sorted_bid_prices[0]

        return False

    async def _calculate_order_latency(self, order: MarketOrder, queue_position: int) -> float:
        """Calculate realistic order processing latency"""
        base_latency = self.latency_model.base_network_latency_ms

        # Add network jitter
        import random
        jitter = random.uniform(-self.latency_model.network_jitter_ms, self.latency_model.network_jitter_ms)

        # Add processing latency
        processing_latency = self.latency_model.order_processing_latency_ms

        # Add queue delay
        queue_delay = queue_position / self.latency_model.processing_rate_per_second * 1000

        # Add participant-specific latency
        participant_penalty = 0
        if order.participant_type == ParticipantType.RETAIL:
            participant_penalty = self.latency_model.retail_latency_penalty_ms
        elif order.participant_type == ParticipantType.INSTITUTIONAL:
            participant_penalty = self.latency_model.institutional_latency_advantage_ms
        elif order.participant_type == ParticipantType.HIGH_FREQUENCY:
            participant_penalty = self.latency_model.hft_latency_advantage_ms

        total_latency = base_latency + jitter + processing_latency + queue_delay + participant_penalty
        return max(0, total_latency)

    async def _calculate_market_impact(self, order: MarketOrder, executions: List[OrderExecution]) -> Decimal:
        """Calculate market impact of order execution"""
        if not executions:
            return Decimal('0')

        total_quantity = sum(exec.executed_quantity for exec in executions)

        # Calculate participation rate
        participation_rate = float(total_quantity) / float(self.market_impact_params.average_daily_volume)

        # Apply square-root impact model
        linear_impact = self.market_impact_params.linear_impact_coefficient * participation_rate
        sqrt_impact = self.market_impact_params.square_root_impact_coefficient * (participation_rate ** 0.5)

        total_impact = linear_impact + sqrt_impact

        # Convert to basis points
        return Decimal(str(total_impact * 10000)).quantize(Decimal('0.01'))

    async def _calculate_slippage(self, order: MarketOrder, executions: List[OrderExecution]) -> Decimal:
        """Calculate slippage compared to expected execution price"""
        if not executions:
            return Decimal('0')

        # Use mid price at order submission as reference
        reference_price = self._get_mid_price()

        # Calculate volume-weighted average execution price
        total_value = sum(exec.execution_price * exec.executed_quantity for exec in executions)
        total_quantity = sum(exec.executed_quantity for exec in executions)
        avg_execution_price = total_value / total_quantity

        # Calculate slippage in basis points
        if reference_price > 0:
            slippage = abs(avg_execution_price - reference_price) / reference_price * 10000
            return Decimal(str(slippage)).quantize(Decimal('0.01'))

        return Decimal('0')

    async def _update_performance_metrics(self, processing_time_ms: float, queue_position: int) -> None:
        """Update engine performance metrics"""
        self.total_orders_processed += 1

        # Update average latency
        self.average_latency_ms = (
            (self.average_latency_ms * (self.total_orders_processed - 1) + processing_time_ms)
            / self.total_orders_processed
        )

        # Update queue depth statistics
        if 'max_queue_depth' not in self.queue_depth_stats:
            self.queue_depth_stats['max_queue_depth'] = queue_position
            self.queue_depth_stats['avg_queue_depth'] = queue_position
        else:
            self.queue_depth_stats['max_queue_depth'] = max(
                self.queue_depth_stats['max_queue_depth'], queue_position
            )
            self.queue_depth_stats['avg_queue_depth'] = (
                (self.queue_depth_stats['avg_queue_depth'] * (self.total_orders_processed - 1) + queue_position)
                / self.total_orders_processed
            )

    def _get_best_bid(self) -> Decimal:
        """Get current best bid price"""
        return self.sorted_bid_prices[0] if self.sorted_bid_prices else Decimal('0')

    def _get_best_ask(self) -> Decimal:
        """Get current best ask price"""
        return self.sorted_ask_prices[0] if self.sorted_ask_prices else Decimal('0')

    def _get_mid_price(self) -> Decimal:
        """Get current mid price"""
        best_bid = self._get_best_bid()
        best_ask = self._get_best_ask()
        if best_bid > 0 and best_ask > 0:
            return (best_bid + best_ask) / 2
        return self.last_trade_price

    def _get_spread(self) -> Decimal:
        """Get current bid-ask spread"""
        best_bid = self._get_best_bid()
        best_ask = self._get_best_ask()
        if best_bid > 0 and best_ask > 0:
            return best_ask - best_bid
        return Decimal('0')

    def get_order_book_snapshot(self) -> OrderBook:
        """Get current order book snapshot"""
        # Convert internal structure to OrderBook model
        bids = []
        for price in self.sorted_bid_prices[:10]:  # Top 10 levels
            queue = self.bid_levels[price]
            total_quantity = sum(order.remaining_quantity for order in queue)
            if total_quantity > 0:
                bids.append(OrderBookLevel(
                    level=len(bids),
                    price=price,
                    quantity=total_quantity,
                    order_count=len(queue),
                    average_order_size=Decimal(str(total_quantity / len(queue))),
                    liquidity_score=0.8,  # Placeholder
                    stability_score=0.8,  # Placeholder
                    retail_percentage=0.6,  # Placeholder
                    institutional_percentage=0.3,  # Placeholder
                    hft_percentage=0.1  # Placeholder
                ))

        asks = []
        for price in self.sorted_ask_prices[:10]:  # Top 10 levels
            queue = self.ask_levels[price]
            total_quantity = sum(order.remaining_quantity for order in queue)
            if total_quantity > 0:
                asks.append(OrderBookLevel(
                    level=len(asks),
                    price=price,
                    quantity=total_quantity,
                    order_count=len(queue),
                    average_order_size=Decimal(str(total_quantity / len(queue))),
                    liquidity_score=0.8,  # Placeholder
                    stability_score=0.8,  # Placeholder
                    retail_percentage=0.6,  # Placeholder
                    institutional_percentage=0.3,  # Placeholder
                    hft_percentage=0.1  # Placeholder
                ))

        return OrderBook(
            symbol=self.symbol,
            venue=self.venue.venue_id,
            timestamp=self.current_time,
            bids=bids,
            asks=asks,
            last_trade_price=self.last_trade_price,
            last_trade_quantity=0,  # Would track this
            bid_price=self._get_best_bid(),
            ask_price=self._get_best_ask(),
            spread_bps=self._get_spread() / self._get_mid_price() * 10000 if self._get_mid_price() > 0 else Decimal('0'),
            mid_price=self._get_mid_price(),
            order_flow_imbalance=0.0,  # Would calculate this
            effective_spread_bps=Decimal('5'),  # Placeholder
            realized_spread_bps=Decimal('3'),  # Placeholder
            price_impact_bps=Decimal('2'),  # Placeholder
            tick_size=self.venue.tick_size,
            lot_size=self.venue.lot_size
        )

    def get_performance_statistics(self) -> Dict[str, Any]:
        """Get engine performance statistics"""
        return {
            'total_orders_processed': self.total_orders_processed,
            'total_executions': len(self.execution_history),
            'average_latency_ms': self.average_latency_ms,
            'active_orders_count': len(self.active_orders),
            'queue_depth_stats': self.queue_depth_stats.copy(),
            'order_book_depth': {
                'bid_levels': len(self.sorted_bid_prices),
                'ask_levels': len(self.sorted_ask_prices)
            },
            'last_trade_price': float(self.last_trade_price),
            'current_spread_bps': float(self._get_spread() / self._get_mid_price() * 10000) if self._get_mid_price() > 0 else 0.0
        }

    async def advance_time(self, time_delta: timedelta) -> None:
        """Advance simulation time and process time-based events"""
        self.current_time += time_delta

        # Process any pending queue entries
        while self.order_queue:
            queue_entry = heapq.heappop(self.order_queue)
            if queue_entry.processing_time is None:
                queue_entry.processing_time = self.current_time
                await self._process_order_immediate(queue_entry)
            else:
                # Put back if not ready for processing
                heapq.heappush(self.order_queue, queue_entry)
                break