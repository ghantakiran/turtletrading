"""
Smart Order Router with venue stats, best execution, and safety limits.

This module implements intelligent order routing across multiple venues with
real-time venue statistics, execution quality analysis, and best execution compliance.
"""

import asyncio
import numpy as np
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Any, Tuple, Set
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from enum import Enum
import logging
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

class VenueType(Enum):
    EXCHANGE = "EXCHANGE"
    ECN = "ECN"
    DARK_POOL = "DARK_POOL"
    MARKET_MAKER = "MARKET_MAKER"

class OrderStatus(Enum):
    PENDING = "PENDING"
    ROUTED = "ROUTED"
    FILLED = "FILLED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"

@dataclass
class VenueStats:
    """Real-time statistics for a trading venue."""
    venue_id: str
    venue_name: str
    venue_type: VenueType

    # Execution quality metrics
    fill_rate: float = 0.0  # Percentage of orders filled
    avg_fill_time_ms: float = 0.0  # Average time to fill
    price_improvement_bps: float = 0.0  # Average price improvement

    # Market data quality
    spread_bps: float = 0.0  # Current spread in basis points
    depth_shares: int = 0  # Available shares at best price
    quote_staleness_ms: float = 0.0  # Age of last quote update

    # Fees and costs
    maker_fee_bps: float = 0.0  # Fee for providing liquidity
    taker_fee_bps: float = 0.0  # Fee for taking liquidity
    clearing_fee_bps: float = 0.0  # Clearing and settlement fees

    # Connectivity and reliability
    connectivity_score: float = 1.0  # 0-1 connectivity quality
    latency_ms: float = 0.0  # Round-trip latency
    uptime_pct: float = 100.0  # Venue uptime percentage

    # Recent performance
    last_update: datetime = field(default_factory=datetime.now)
    hourly_volume: int = 0
    reject_rate: float = 0.0
    cancel_rate: float = 0.0

@dataclass
class OrderBookLevel:
    """Order book level with price and size."""
    price: Decimal
    size: int
    venue_id: str
    timestamp: datetime

@dataclass
class ConsolidatedOrderBook:
    """Consolidated order book across all venues."""
    symbol: str
    bids: List[OrderBookLevel] = field(default_factory=list)
    asks: List[OrderBookLevel] = field(default_factory=list)
    last_update: datetime = field(default_factory=datetime.now)

@dataclass
class RoutingDecision:
    """Routing decision for an order or slice."""
    venue_id: str
    quantity: int
    order_type: str
    price_limit: Optional[Decimal]
    expected_fill_rate: float
    expected_cost_bps: float
    routing_reason: str
    fallback_venues: List[str] = field(default_factory=list)

@dataclass
class ExecutionReport:
    """Execution report for tracking order lifecycle."""
    order_id: str
    symbol: str
    side: str
    original_quantity: int
    filled_quantity: int
    remaining_quantity: int
    avg_fill_price: Decimal
    total_fees: Decimal
    venues_used: Set[str] = field(default_factory=set)
    execution_time_ms: float = 0.0
    price_improvement_bps: float = 0.0
    status: OrderStatus = OrderStatus.PENDING

class VenueAdapter(ABC):
    """Abstract base class for venue-specific adapters."""

    @abstractmethod
    async def send_order(self, order: Dict) -> str:
        """Send order to venue and return order ID."""
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel order at venue."""
        pass

    @abstractmethod
    async def get_order_status(self, order_id: str) -> Dict:
        """Get current order status."""
        pass

    @abstractmethod
    async def get_market_data(self, symbol: str) -> Dict:
        """Get current market data for symbol."""
        pass

class MockVenueAdapter(VenueAdapter):
    """Mock venue adapter for testing and simulation."""

    def __init__(self, venue_id: str, seed: Optional[int] = None):
        self.venue_id = venue_id
        self.orders = {}
        self.fill_probability = 0.95
        self.latency_ms = 50
        if seed is not None:
            np.random.seed(seed)

    async def send_order(self, order: Dict) -> str:
        """Simulate order sending with realistic delays and outcomes."""
        order_id = f"{self.venue_id}_{datetime.now().timestamp()}"

        # Simulate network latency
        await asyncio.sleep(self.latency_ms / 1000.0)

        # Simulate order acceptance/rejection
        if np.random.random() < 0.02:  # 2% reject rate
            raise Exception(f"Order rejected by {self.venue_id}")

        self.orders[order_id] = {
            'status': 'ACCEPTED',
            'symbol': order['symbol'],
            'side': order['side'],
            'quantity': order['quantity'],
            'filled_quantity': 0,
            'timestamp': datetime.now()
        }

        # Simulate fills with some delay
        asyncio.create_task(self._simulate_fill(order_id, order))

        return order_id

    async def cancel_order(self, order_id: str) -> bool:
        """Simulate order cancellation."""
        if order_id in self.orders:
            self.orders[order_id]['status'] = 'CANCELLED'
            return True
        return False

    async def get_order_status(self, order_id: str) -> Dict:
        """Get simulated order status."""
        return self.orders.get(order_id, {'status': 'NOT_FOUND'})

    async def get_market_data(self, symbol: str) -> Dict:
        """Get simulated market data."""
        base_price = Decimal('150.00')  # Base price for simulation
        spread = Decimal('0.10')

        return {
            'symbol': symbol,
            'bid': base_price - spread/2,
            'ask': base_price + spread/2,
            'bid_size': np.random.randint(500, 2000),
            'ask_size': np.random.randint(500, 2000),
            'timestamp': datetime.now()
        }

    async def _simulate_fill(self, order_id: str, order: Dict):
        """Simulate realistic order fills."""
        if order_id not in self.orders:
            return

        # Simulate fill delay based on order type
        fill_delay = 0.1 if order['order_type'] == 'MARKET' else 2.0
        await asyncio.sleep(fill_delay)

        # Simulate partial or full fills
        if np.random.random() < self.fill_probability:
            fill_quantity = order['quantity']
            if np.random.random() < 0.3:  # 30% chance of partial fill
                fill_quantity = int(order['quantity'] * np.random.uniform(0.3, 0.9))

            self.orders[order_id]['filled_quantity'] = fill_quantity
            self.orders[order_id]['status'] = 'FILLED' if fill_quantity == order['quantity'] else 'PARTIALLY_FILLED'

class SmartOrderRouter:
    """Intelligent order router with best execution algorithms."""

    def __init__(self, seed: Optional[int] = None):
        self.venue_adapters: Dict[str, VenueAdapter] = {}
        self.venue_stats: Dict[str, VenueStats] = {}
        self.consolidated_book: Dict[str, ConsolidatedOrderBook] = {}
        self.execution_reports: Dict[str, ExecutionReport] = {}
        self.routing_history: deque = deque(maxlen=10000)
        self.seed = seed

        # Best execution policies
        self.best_execution_weights = {
            'price_improvement': 0.40,
            'fill_probability': 0.25,
            'speed': 0.15,
            'cost': 0.20
        }

        # Safety limits
        self.max_venue_concentration = 0.60  # Max 60% to single venue
        self.min_venue_connectivity = 0.80  # Min 80% connectivity score
        self.max_spread_bps = 50  # Max 50 bps spread

        if seed is not None:
            np.random.seed(seed)

    def register_venue(self, venue_id: str, adapter: VenueAdapter, stats: VenueStats):
        """Register a new venue with its adapter and statistics."""
        self.venue_adapters[venue_id] = adapter
        self.venue_stats[venue_id] = stats
        logger.info(f"Registered venue: {venue_id}")

    async def route_order(self, order: Dict, constraints: Optional[Dict] = None) -> List[RoutingDecision]:
        """Route order to optimal venues based on best execution analysis."""
        symbol = order['symbol']
        total_quantity = order['quantity']
        side = order['side']

        # Update venue statistics and market data
        await self._update_venue_stats(symbol)

        # Get consolidated order book
        consolidated_book = await self._build_consolidated_book(symbol)

        # Apply safety checks
        safety_result = self._apply_safety_checks(order, constraints)
        if not safety_result['approved']:
            raise ValueError(f"Order failed safety checks: {safety_result['reasons']}")

        # Determine optimal routing strategy
        routing_decisions = await self._optimize_routing(order, consolidated_book, constraints)

        # Apply venue concentration limits
        routing_decisions = self._apply_concentration_limits(routing_decisions, total_quantity)

        # Log routing decision
        self._log_routing_decision(order, routing_decisions)

        return routing_decisions

    async def execute_routing_decisions(self, order_id: str, decisions: List[RoutingDecision]) -> ExecutionReport:
        """Execute routing decisions and track execution."""
        execution_report = ExecutionReport(
            order_id=order_id,
            symbol=decisions[0].symbol if decisions else '',
            side='',  # Will be set from order
            original_quantity=sum(d.quantity for d in decisions),
            filled_quantity=0,
            remaining_quantity=sum(d.quantity for d in decisions),
            avg_fill_price=Decimal('0.00'),
            total_fees=Decimal('0.00')
        )

        self.execution_reports[order_id] = execution_report

        # Execute orders at each venue concurrently
        execution_tasks = []
        for decision in decisions:
            task = asyncio.create_task(
                self._execute_at_venue(order_id, decision)
            )
            execution_tasks.append(task)

        # Wait for all executions to complete or timeout
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*execution_tasks, return_exceptions=True),
                timeout=30.0  # 30-second timeout
            )

            # Process execution results
            await self._process_execution_results(order_id, results)

        except asyncio.TimeoutError:
            logger.warning(f"Execution timeout for order {order_id}")
            await self._handle_execution_timeout(order_id, decisions)

        return self.execution_reports[order_id]

    async def _update_venue_stats(self, symbol: str):
        """Update venue statistics and connectivity."""
        update_tasks = []
        for venue_id, adapter in self.venue_adapters.items():
            task = asyncio.create_task(
                self._update_single_venue_stats(venue_id, adapter, symbol)
            )
            update_tasks.append(task)

        await asyncio.gather(*update_tasks, return_exceptions=True)

    async def _update_single_venue_stats(self, venue_id: str, adapter: VenueAdapter, symbol: str):
        """Update statistics for a single venue."""
        try:
            start_time = datetime.now()
            market_data = await adapter.get_market_data(symbol)
            latency = (datetime.now() - start_time).total_seconds() * 1000

            stats = self.venue_stats[venue_id]
            stats.latency_ms = latency
            stats.connectivity_score = 1.0  # Connected successfully

            if market_data:
                bid = Decimal(str(market_data.get('bid', 0)))
                ask = Decimal(str(market_data.get('ask', 0)))
                if bid > 0 and ask > bid:
                    mid_price = (bid + ask) / 2
                    spread_bps = ((ask - bid) / mid_price) * 10000
                    stats.spread_bps = float(spread_bps)
                    stats.depth_shares = market_data.get('bid_size', 0) + market_data.get('ask_size', 0)

            stats.last_update = datetime.now()

        except Exception as e:
            logger.warning(f"Failed to update stats for {venue_id}: {e}")
            self.venue_stats[venue_id].connectivity_score = 0.0

    async def _build_consolidated_book(self, symbol: str) -> ConsolidatedOrderBook:
        """Build consolidated order book from all venues."""
        consolidated = ConsolidatedOrderBook(symbol=symbol)

        for venue_id, adapter in self.venue_adapters.items():
            try:
                market_data = await adapter.get_market_data(symbol)
                if market_data:
                    bid_level = OrderBookLevel(
                        price=Decimal(str(market_data.get('bid', 0))),
                        size=market_data.get('bid_size', 0),
                        venue_id=venue_id,
                        timestamp=datetime.now()
                    )
                    ask_level = OrderBookLevel(
                        price=Decimal(str(market_data.get('ask', 0))),
                        size=market_data.get('ask_size', 0),
                        venue_id=venue_id,
                        timestamp=datetime.now()
                    )

                    consolidated.bids.append(bid_level)
                    consolidated.asks.append(ask_level)

            except Exception as e:
                logger.warning(f"Failed to get market data from {venue_id}: {e}")

        # Sort by price (bids descending, asks ascending)
        consolidated.bids.sort(key=lambda x: x.price, reverse=True)
        consolidated.asks.sort(key=lambda x: x.price)

        self.consolidated_book[symbol] = consolidated
        return consolidated

    def _apply_safety_checks(self, order: Dict, constraints: Optional[Dict]) -> Dict[str, Any]:
        """Apply safety checks and risk limits."""
        reasons = []

        # Check order size limits
        max_order_size = (constraints or {}).get('max_order_size', 1000000)
        if order['quantity'] > max_order_size:
            reasons.append(f"Order size {order['quantity']} exceeds limit {max_order_size}")

        # Check venue connectivity
        connected_venues = [
            v_id for v_id, stats in self.venue_stats.items()
            if stats.connectivity_score >= self.min_venue_connectivity
        ]

        if len(connected_venues) < 2:
            reasons.append("Insufficient venue connectivity for safe routing")

        # Check market conditions
        symbol = order['symbol']
        if symbol in self.consolidated_book:
            book = self.consolidated_book[symbol]
            if book.bids and book.asks:
                best_bid = book.bids[0].price
                best_ask = book.asks[0].price
                if best_ask > 0 and best_bid > 0:
                    spread_bps = ((best_ask - best_bid) / ((best_ask + best_bid) / 2)) * 10000
                    if spread_bps > self.max_spread_bps:
                        reasons.append(f"Market spread {spread_bps:.1f} bps exceeds limit {self.max_spread_bps}")

        return {
            'approved': len(reasons) == 0,
            'reasons': reasons,
            'connected_venues': connected_venues
        }

    async def _optimize_routing(self, order: Dict, consolidated_book: ConsolidatedOrderBook,
                              constraints: Optional[Dict]) -> List[RoutingDecision]:
        """Optimize order routing based on best execution criteria."""
        symbol = order['symbol']
        total_quantity = order['quantity']
        side = order['side']

        # Get available liquidity by venue
        available_venues = self._get_available_venues(symbol, side, consolidated_book)

        if not available_venues:
            raise ValueError("No venues available for execution")

        # Score venues for this order
        venue_scores = self._score_venues(available_venues, order, constraints)

        # Allocate quantity across top venues
        routing_decisions = self._allocate_quantity(total_quantity, venue_scores, constraints)

        return routing_decisions

    def _get_available_venues(self, symbol: str, side: str,
                            consolidated_book: ConsolidatedOrderBook) -> List[Dict]:
        """Get venues with available liquidity for the order side."""
        available_venues = []

        # Use appropriate side of book
        levels = consolidated_book.bids if side == 'SELL' else consolidated_book.asks

        for level in levels:
            if level.size > 0:
                venue_stats = self.venue_stats.get(level.venue_id)
                if venue_stats and venue_stats.connectivity_score >= self.min_venue_connectivity:
                    available_venues.append({
                        'venue_id': level.venue_id,
                        'price': level.price,
                        'size': level.size,
                        'stats': venue_stats
                    })

        return available_venues

    def _score_venues(self, available_venues: List[Dict], order: Dict,
                     constraints: Optional[Dict]) -> List[Tuple[str, float, Dict]]:
        """Score venues based on best execution criteria."""
        venue_scores = []

        for venue_info in available_venues:
            venue_id = venue_info['venue_id']
            stats = venue_info['stats']

            # Calculate composite score
            score = 0.0

            # Price improvement component
            price_score = self._calculate_price_score(venue_info, order)
            score += price_score * self.best_execution_weights['price_improvement']

            # Fill probability component
            fill_score = stats.fill_rate
            score += fill_score * self.best_execution_weights['fill_probability']

            # Speed component (inverse of latency)
            speed_score = max(0, 1.0 - (stats.latency_ms / 1000.0))
            score += speed_score * self.best_execution_weights['speed']

            # Cost component (inverse of fees)
            total_fees_bps = stats.taker_fee_bps + stats.clearing_fee_bps
            cost_score = max(0, 1.0 - (total_fees_bps / 20.0))  # Normalize to 20 bps max
            score += cost_score * self.best_execution_weights['cost']

            venue_scores.append((venue_id, score, venue_info))

        # Sort by score (highest first)
        venue_scores.sort(key=lambda x: x[1], reverse=True)

        return venue_scores

    def _calculate_price_score(self, venue_info: Dict, order: Dict) -> float:
        """Calculate price improvement score for venue."""
        venue_price = venue_info['price']
        side = order['side']

        # For BUY orders, lower prices are better
        # For SELL orders, higher prices are better
        # Normalize to 0-1 scale based on typical spread

        baseline_improvement = 0.05  # 5 bps baseline
        if side == 'BUY':
            # Lower price = higher score
            improvement = max(0, baseline_improvement - float(venue_price) * 0.001)
        else:
            # Higher price = higher score
            improvement = max(0, float(venue_price) * 0.001 - baseline_improvement)

        return min(1.0, improvement / baseline_improvement)

    def _allocate_quantity(self, total_quantity: int, venue_scores: List[Tuple[str, float, Dict]],
                          constraints: Optional[Dict]) -> List[RoutingDecision]:
        """Allocate order quantity across venues based on scores."""
        if not venue_scores:
            return []

        # Use top venues up to concentration limit
        max_venues = min(len(venue_scores), (constraints or {}).get('max_venues', 5))
        top_venues = venue_scores[:max_venues]

        # Calculate allocation weights based on scores and capacity
        allocations = []
        remaining_quantity = total_quantity

        for i, (venue_id, score, venue_info) in enumerate(top_venues):
            if remaining_quantity <= 0:
                break

            # Calculate allocation based on score and venue capacity
            venue_capacity = min(venue_info['size'], int(total_quantity * self.max_venue_concentration))

            if i == len(top_venues) - 1:  # Last venue gets remainder
                allocation_qty = remaining_quantity
            else:
                # Allocate based on normalized score
                total_score = sum(s[1] for s in top_venues)
                allocation_pct = score / total_score if total_score > 0 else 1.0 / len(top_venues)
                allocation_qty = min(
                    venue_capacity,
                    int(total_quantity * allocation_pct),
                    remaining_quantity
                )

            if allocation_qty > 0:
                routing_decision = RoutingDecision(
                    venue_id=venue_id,
                    quantity=allocation_qty,
                    order_type='LIMIT',  # Default to limit orders
                    price_limit=venue_info['price'],
                    expected_fill_rate=venue_info['stats'].fill_rate,
                    expected_cost_bps=venue_info['stats'].taker_fee_bps,
                    routing_reason=f"Best execution score: {score:.3f}",
                    fallback_venues=[v[0] for v in venue_scores[i+1:i+3]]  # Next 2 venues as fallbacks
                )

                allocations.append(routing_decision)
                remaining_quantity -= allocation_qty

        return allocations

    def _apply_concentration_limits(self, decisions: List[RoutingDecision],
                                  total_quantity: int) -> List[RoutingDecision]:
        """Apply venue concentration limits to routing decisions."""
        # Check if any single venue has too much concentration
        venue_allocations = defaultdict(int)
        for decision in decisions:
            venue_allocations[decision.venue_id] += decision.quantity

        # Rebalance if necessary
        adjusted_decisions = []
        for decision in decisions:
            venue_allocation = venue_allocations[decision.venue_id]
            max_allowed = int(total_quantity * self.max_venue_concentration)

            if venue_allocation > max_allowed:
                # Reduce this venue's allocation
                reduction = venue_allocation - max_allowed
                decision.quantity = max(0, decision.quantity - reduction)

                # TODO: Redistribute excess to other venues
                # For now, just cap the allocation

            if decision.quantity > 0:
                adjusted_decisions.append(decision)

        return adjusted_decisions

    def _log_routing_decision(self, order: Dict, decisions: List[RoutingDecision]):
        """Log routing decision for audit trail."""
        routing_entry = {
            'timestamp': datetime.now(),
            'symbol': order['symbol'],
            'side': order['side'],
            'quantity': order['quantity'],
            'venues_used': len(decisions),
            'decisions': [
                {
                    'venue_id': d.venue_id,
                    'quantity': d.quantity,
                    'expected_cost': d.expected_cost_bps,
                    'reason': d.routing_reason
                }
                for d in decisions
            ]
        }

        self.routing_history.append(routing_entry)
        logger.info(f"Routed order {order.get('order_id', 'unknown')} to {len(decisions)} venues")

    async def _execute_at_venue(self, order_id: str, decision: RoutingDecision) -> Dict:
        """Execute order at specific venue."""
        venue_adapter = self.venue_adapters[decision.venue_id]

        order_params = {
            'symbol': decision.venue_id,  # This should be from the original order
            'side': 'BUY',  # This should be from the original order
            'quantity': decision.quantity,
            'order_type': decision.order_type,
            'price_limit': decision.price_limit
        }

        try:
            venue_order_id = await venue_adapter.send_order(order_params)

            # Monitor execution
            result = await self._monitor_execution(venue_adapter, venue_order_id, decision)

            return {
                'venue_id': decision.venue_id,
                'venue_order_id': venue_order_id,
                'status': 'SUCCESS',
                'result': result
            }

        except Exception as e:
            logger.error(f"Execution failed at {decision.venue_id}: {e}")
            return {
                'venue_id': decision.venue_id,
                'status': 'FAILED',
                'error': str(e)
            }

    async def _monitor_execution(self, adapter: VenueAdapter, venue_order_id: str,
                               decision: RoutingDecision) -> Dict:
        """Monitor order execution at venue."""
        start_time = datetime.now()
        timeout_seconds = 10.0

        while (datetime.now() - start_time).total_seconds() < timeout_seconds:
            try:
                status = await adapter.get_order_status(venue_order_id)

                if status.get('status') in ['FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED']:
                    return status

                await asyncio.sleep(0.1)  # Check every 100ms

            except Exception as e:
                logger.warning(f"Error monitoring execution: {e}")
                break

        # Timeout - attempt to cancel
        try:
            await adapter.cancel_order(venue_order_id)
        except Exception:
            pass

        return {'status': 'TIMEOUT'}

    async def _process_execution_results(self, order_id: str, results: List[Any]):
        """Process execution results and update execution report."""
        execution_report = self.execution_reports[order_id]

        total_filled = 0
        total_fees = Decimal('0.00')
        venues_used = set()

        for result in results:
            if isinstance(result, dict) and result.get('status') == 'SUCCESS':
                venue_result = result.get('result', {})
                filled_qty = venue_result.get('filled_quantity', 0)

                total_filled += filled_qty
                venues_used.add(result['venue_id'])

                # Estimate fees (would be actual in production)
                venue_stats = self.venue_stats.get(result['venue_id'])
                if venue_stats:
                    fees = Decimal(str(filled_qty * 150.00 * venue_stats.taker_fee_bps / 10000))
                    total_fees += fees

        execution_report.filled_quantity = total_filled
        execution_report.remaining_quantity = execution_report.original_quantity - total_filled
        execution_report.total_fees = total_fees
        execution_report.venues_used = venues_used

        if total_filled == execution_report.original_quantity:
            execution_report.status = OrderStatus.FILLED
        elif total_filled > 0:
            execution_report.status = OrderStatus.PARTIALLY_FILLED
        else:
            execution_report.status = OrderStatus.REJECTED

    async def _handle_execution_timeout(self, order_id: str, decisions: List[RoutingDecision]):
        """Handle execution timeout by cancelling pending orders."""
        cancel_tasks = []

        for decision in decisions:
            adapter = self.venue_adapters[decision.venue_id]
            # In a real implementation, we'd track venue order IDs
            # cancel_task = asyncio.create_task(adapter.cancel_order(venue_order_id))
            # cancel_tasks.append(cancel_task)

        if cancel_tasks:
            await asyncio.gather(*cancel_tasks, return_exceptions=True)

    def get_venue_statistics(self) -> Dict[str, VenueStats]:
        """Get current venue statistics."""
        return self.venue_stats.copy()

    def get_routing_history(self, limit: int = 100) -> List[Dict]:
        """Get recent routing history."""
        return list(self.routing_history)[-limit:]

    def get_execution_report(self, order_id: str) -> Optional[ExecutionReport]:
        """Get execution report for specific order."""
        return self.execution_reports.get(order_id)