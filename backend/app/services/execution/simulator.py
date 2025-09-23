"""
Execution Algorithm Simulator with Limit Order Book (LOB) for backtesting.

This module provides comprehensive simulation capabilities for testing execution
algorithms against realistic market conditions with order book dynamics.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional, Any, Tuple, NamedTuple
from dataclasses import dataclass, field
from collections import defaultdict, deque
import heapq
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class OrderBookSide(NamedTuple):
    """Order book side representation."""
    price: Decimal
    size: int
    order_count: int
    timestamp: datetime

@dataclass
class MarketOrder:
    """Market order representation."""
    order_id: str
    symbol: str
    side: str  # 'BUY' or 'SELL'
    quantity: int
    order_type: str  # 'MARKET', 'LIMIT', 'STOP'
    price: Optional[Decimal] = None
    timestamp: datetime = field(default_factory=datetime.now)
    algo_id: Optional[str] = None
    venue_id: Optional[str] = None

@dataclass
class Fill:
    """Order fill representation."""
    fill_id: str
    order_id: str
    symbol: str
    side: str
    quantity: int
    price: Decimal
    timestamp: datetime
    venue_id: str
    fees: Decimal = Decimal('0.00')
    liquidity_flag: str = 'T'  # 'M' for maker, 'T' for taker

@dataclass
class MarketState:
    """Market state for simulation."""
    timestamp: datetime
    mid_price: Decimal
    spread_bps: float
    volatility: float
    volume: int
    trend: float
    impact_decay: float = 0.95  # Price impact decay factor

class LimitOrderBook:
    """Realistic limit order book simulation."""

    def __init__(self, symbol: str, initial_price: Decimal, tick_size: Decimal = Decimal('0.01')):
        self.symbol = symbol
        self.tick_size = tick_size
        self.mid_price = initial_price

        # Order book levels: price -> (size, order_count, timestamp)
        self.bids: Dict[Decimal, Tuple[int, int, datetime]] = {}
        self.asks: Dict[Decimal, Tuple[int, int, datetime]] = {}

        # Order tracking
        self.orders: Dict[str, MarketOrder] = {}
        self.fills: List[Fill] = []

        # Market impact tracking
        self.recent_trades: deque = deque(maxlen=100)
        self.price_impact = Decimal('0.00')

        # Initialize realistic order book
        self._initialize_book()

    def _initialize_book(self):
        """Initialize order book with realistic depth."""
        base_size = 1000
        levels = 10

        for i in range(levels):
            # Bid side
            bid_price = self.mid_price - Decimal(str((i + 1) * self.tick_size))
            bid_size = int(base_size * (1.5 ** i))  # Increasing size away from mid
            self.bids[bid_price] = (bid_size, max(1, bid_size // 500), datetime.now())

            # Ask side
            ask_price = self.mid_price + Decimal(str((i + 1) * self.tick_size))
            ask_size = int(base_size * (1.5 ** i))
            self.asks[ask_price] = (ask_size, max(1, ask_size // 500), datetime.now())

    def get_best_bid_ask(self) -> Tuple[Optional[Decimal], Optional[Decimal]]:
        """Get best bid and ask prices."""
        best_bid = max(self.bids.keys()) if self.bids else None
        best_ask = min(self.asks.keys()) if self.asks else None
        return best_bid, best_ask

    def get_spread_bps(self) -> float:
        """Calculate current spread in basis points."""
        best_bid, best_ask = self.get_best_bid_ask()
        if best_bid and best_ask:
            spread = best_ask - best_bid
            mid = (best_bid + best_ask) / 2
            return float(spread / mid * 10000)
        return 0.0

    def get_depth(self, levels: int = 5) -> Dict[str, List[OrderBookSide]]:
        """Get order book depth."""
        sorted_bids = sorted(self.bids.keys(), reverse=True)[:levels]
        sorted_asks = sorted(self.asks.keys())[:levels]

        bid_levels = [
            OrderBookSide(
                price=price,
                size=self.bids[price][0],
                order_count=self.bids[price][1],
                timestamp=self.bids[price][2]
            )
            for price in sorted_bids
        ]

        ask_levels = [
            OrderBookSide(
                price=price,
                size=self.asks[price][0],
                order_count=self.asks[price][1],
                timestamp=self.asks[price][2]
            )
            for price in sorted_asks
        ]

        return {'bids': bid_levels, 'asks': ask_levels}

    def add_order(self, order: MarketOrder) -> List[Fill]:
        """Add order to book and process fills."""
        self.orders[order.order_id] = order
        fills = []

        if order.order_type == 'MARKET':
            fills = self._process_market_order(order)
        elif order.order_type == 'LIMIT':
            fills = self._process_limit_order(order)

        # Update price impact
        if fills:
            total_quantity = sum(fill.quantity for fill in fills)
            impact_factor = self._calculate_market_impact(total_quantity, order.side)
            self._apply_price_impact(impact_factor)

        return fills

    def _process_market_order(self, order: MarketOrder) -> List[Fill]:
        """Process market order against the book."""
        fills = []
        remaining_quantity = order.quantity

        # Determine which side of book to hit
        target_side = self.asks if order.side == 'BUY' else self.bids
        sort_reverse = order.side == 'SELL'

        # Sort prices by execution priority
        sorted_prices = sorted(target_side.keys(), reverse=sort_reverse)

        for price in sorted_prices:
            if remaining_quantity <= 0:
                break

            available_size, order_count, timestamp = target_side[price]
            fill_quantity = min(remaining_quantity, available_size)

            if fill_quantity > 0:
                # Create fill
                fill = Fill(
                    fill_id=f"FILL_{order.order_id}_{len(fills)}",
                    order_id=order.order_id,
                    symbol=order.symbol,
                    side=order.side,
                    quantity=fill_quantity,
                    price=price,
                    timestamp=datetime.now(),
                    venue_id=order.venue_id or 'SIM',
                    liquidity_flag='T'  # Market orders are takers
                )
                fills.append(fill)

                # Update book
                new_size = available_size - fill_quantity
                if new_size > 0:
                    target_side[price] = (new_size, max(1, order_count - 1), timestamp)
                else:
                    del target_side[price]

                remaining_quantity -= fill_quantity

                # Track trade
                self.recent_trades.append({
                    'price': price,
                    'size': fill_quantity,
                    'side': order.side,
                    'timestamp': datetime.now()
                })

        self.fills.extend(fills)
        return fills

    def _process_limit_order(self, order: MarketOrder) -> List[Fill]:
        """Process limit order - either fill immediately or add to book."""
        if not order.price:
            return []

        fills = []
        remaining_quantity = order.quantity

        # Check for immediate execution
        best_bid, best_ask = self.get_best_bid_ask()

        can_execute = False
        if order.side == 'BUY' and best_ask and order.price >= best_ask:
            can_execute = True
        elif order.side == 'SELL' and best_bid and order.price <= best_bid:
            can_execute = True

        if can_execute:
            # Convert to market-like execution at the limit price
            fills = self._execute_limit_order_immediately(order)
            remaining_quantity = order.quantity - sum(f.quantity for f in fills)

        # Add remaining quantity to book
        if remaining_quantity > 0:
            self._add_to_book(order, remaining_quantity)

        return fills

    def _execute_limit_order_immediately(self, order: MarketOrder) -> List[Fill]:
        """Execute limit order immediately against available liquidity."""
        fills = []
        remaining_quantity = order.quantity

        # Similar to market order processing but respect limit price
        target_side = self.asks if order.side == 'BUY' else self.bids
        sort_reverse = order.side == 'SELL'
        sorted_prices = sorted(target_side.keys(), reverse=sort_reverse)

        for price in sorted_prices:
            if remaining_quantity <= 0:
                break

            # Check price constraint
            if order.side == 'BUY' and price > order.price:
                continue
            if order.side == 'SELL' and price < order.price:
                continue

            available_size, order_count, timestamp = target_side[price]
            fill_quantity = min(remaining_quantity, available_size)

            if fill_quantity > 0:
                fill = Fill(
                    fill_id=f"FILL_{order.order_id}_{len(fills)}",
                    order_id=order.order_id,
                    symbol=order.symbol,
                    side=order.side,
                    quantity=fill_quantity,
                    price=price,
                    timestamp=datetime.now(),
                    venue_id=order.venue_id or 'SIM',
                    liquidity_flag='T'
                )
                fills.append(fill)

                # Update book
                new_size = available_size - fill_quantity
                if new_size > 0:
                    target_side[price] = (new_size, max(1, order_count - 1), timestamp)
                else:
                    del target_side[price]

                remaining_quantity -= fill_quantity

        self.fills.extend(fills)
        return fills

    def _add_to_book(self, order: MarketOrder, quantity: int):
        """Add remaining order quantity to the book."""
        target_side = self.bids if order.side == 'BUY' else self.asks
        price = order.price

        if price in target_side:
            existing_size, order_count, _ = target_side[price]
            target_side[price] = (existing_size + quantity, order_count + 1, datetime.now())
        else:
            target_side[price] = (quantity, 1, datetime.now())

    def _calculate_market_impact(self, quantity: int, side: str) -> Decimal:
        """Calculate temporary market impact."""
        # Simple square root impact model
        best_bid, best_ask = self.get_best_bid_ask()
        if not best_bid or not best_ask:
            return Decimal('0.00')

        mid_price = (best_bid + best_ask) / 2

        # Estimate average daily volume (simplified)
        avg_daily_volume = 1000000  # 1M shares

        # Impact in basis points: k * sqrt(quantity / daily_volume)
        impact_coefficient = 100  # 100 bps at 100% of daily volume
        impact_bps = impact_coefficient * np.sqrt(quantity / avg_daily_volume)

        # Convert to price impact
        direction = 1 if side == 'BUY' else -1
        impact = mid_price * Decimal(str(impact_bps / 10000)) * direction

        return impact

    def _apply_price_impact(self, impact: Decimal):
        """Apply temporary price impact to the order book."""
        if abs(impact) < self.tick_size:
            return

        # Shift all price levels
        new_bids = {}
        for price, (size, count, timestamp) in self.bids.items():
            new_price = price + impact
            new_bids[new_price] = (size, count, timestamp)

        new_asks = {}
        for price, (size, count, timestamp) in self.asks.items():
            new_price = price + impact
            new_asks[new_price] = (size, count, timestamp)

        self.bids = new_bids
        self.asks = new_asks
        self.mid_price += impact
        self.price_impact += impact

    def update_market_state(self, state: MarketState):
        """Update order book based on market state changes."""
        # Price drift
        price_change = self.mid_price * Decimal(str(state.trend))

        # Volatility-based random walk
        random_change = self.mid_price * Decimal(str(np.random.normal(0, state.volatility / np.sqrt(252 * 24 * 60))))

        total_change = price_change + random_change

        # Apply changes to all levels
        self._shift_book_prices(total_change)

        # Update sizes based on volume
        self._update_book_sizes(state.volume)

        # Decay price impact
        self.price_impact *= Decimal(str(state.impact_decay))
        if abs(self.price_impact) < self.tick_size:
            self.price_impact = Decimal('0.00')

    def _shift_book_prices(self, price_change: Decimal):
        """Shift all book prices by the given amount."""
        # Update bids
        new_bids = {}
        for price, data in self.bids.items():
            new_price = (price + price_change).quantize(self.tick_size, rounding=ROUND_HALF_UP)
            new_bids[new_price] = data
        self.bids = new_bids

        # Update asks
        new_asks = {}
        for price, data in self.asks.items():
            new_price = (price + price_change).quantize(self.tick_size, rounding=ROUND_HALF_UP)
            new_asks[new_price] = data
        self.asks = new_asks

        self.mid_price += price_change

    def _update_book_sizes(self, volume_factor: int):
        """Update book sizes based on volume activity."""
        # Simulate book replenishment and depletion
        replenishment_factor = max(0.8, min(1.2, volume_factor / 100000))  # Normalize around 100k volume

        for price in list(self.bids.keys()):
            size, count, timestamp = self.bids[price]
            new_size = max(100, int(size * replenishment_factor * np.random.uniform(0.9, 1.1)))
            self.bids[price] = (new_size, count, timestamp)

        for price in list(self.asks.keys()):
            size, count, timestamp = self.asks[price]
            new_size = max(100, int(size * replenishment_factor * np.random.uniform(0.9, 1.1)))
            self.asks[price] = (new_size, count, timestamp)

class ExecutionSimulator:
    """Main execution algorithm simulator."""

    def __init__(self, symbol: str, initial_price: Decimal = Decimal('150.00'), seed: Optional[int] = None):
        self.symbol = symbol
        self.initial_price = initial_price
        self.seed = seed

        if seed is not None:
            np.random.seed(seed)

        # Simulation components
        self.order_book = LimitOrderBook(symbol, initial_price)
        self.market_state = MarketState(
            timestamp=datetime.now(),
            mid_price=initial_price,
            spread_bps=5.0,
            volatility=0.25,
            volume=50000,
            trend=0.0
        )

        # Simulation tracking
        self.simulation_results = {
            'orders': [],
            'fills': [],
            'market_states': [],
            'performance_metrics': {}
        }

        # Time tracking
        self.current_time = datetime.now()
        self.time_step = timedelta(seconds=30)  # 30-second intervals

    def simulate_algorithm(self, algo_instance, order_request: Dict,
                          market_scenario: str = "NORMAL",
                          duration_hours: float = 2.0) -> Dict[str, Any]:
        """Simulate algorithm execution against realistic market conditions."""
        logger.info(f"Starting simulation for {algo_instance.__class__.__name__} on {self.symbol}")

        # Configure market scenario
        self._configure_market_scenario(market_scenario)

        # Generate algorithm schedule
        if hasattr(algo_instance, 'generate_schedule'):
            schedule = algo_instance.generate_schedule(order_request, self._get_market_data())
        else:
            # Handle POV algorithm
            volume_intervals = self._generate_volume_profile(duration_hours)
            schedule = algo_instance.generate_adaptive_schedule(order_request, self._get_market_data(), volume_intervals)

        # Execute simulation
        total_steps = int(duration_hours * 3600 / self.time_step.total_seconds())

        for step in range(total_steps):
            self._advance_time_step()

            # Check for scheduled executions
            scheduled_orders = [s for s in schedule if s.execute_at <= self.current_time]

            for slice_order in scheduled_orders:
                if slice_order not in [o['slice_order'] for o in self.simulation_results['orders']]:
                    fills = self._execute_slice(slice_order)

                    self.simulation_results['orders'].append({
                        'slice_order': slice_order,
                        'fills': fills,
                        'timestamp': self.current_time
                    })

            # Update market state
            self._update_market_state()

            # Record state
            self.simulation_results['market_states'].append({
                'timestamp': self.current_time,
                'mid_price': float(self.market_state.mid_price),
                'spread_bps': self.market_state.spread_bps,
                'volume': self.market_state.volume
            })

        # Calculate performance metrics
        self._calculate_performance_metrics()

        return self.simulation_results

    def _configure_market_scenario(self, scenario: str):
        """Configure market parameters based on scenario."""
        scenarios = {
            "NORMAL": {
                'volatility': 0.25,
                'trend': 0.0,
                'volume_multiplier': 1.0,
                'spread_multiplier': 1.0
            },
            "VOLATILE": {
                'volatility': 0.60,
                'trend': 0.0,
                'volume_multiplier': 1.5,
                'spread_multiplier': 2.0
            },
            "TRENDING": {
                'volatility': 0.30,
                'trend': 0.1,  # 10% annual trend
                'volume_multiplier': 1.2,
                'spread_multiplier': 1.0
            },
            "RANGE_BOUND": {
                'volatility': 0.15,
                'trend': 0.0,
                'volume_multiplier': 0.8,
                'spread_multiplier': 0.8
            }
        }

        config = scenarios.get(scenario, scenarios["NORMAL"])

        self.market_state.volatility = config['volatility']
        self.market_state.trend = config['trend']
        self.base_volume = int(50000 * config['volume_multiplier'])
        self.base_spread = 5.0 * config['spread_multiplier']

    def _get_market_data(self):
        """Get current market data for algorithm."""
        from app.services.execution.algorithms import MarketData

        best_bid, best_ask = self.order_book.get_best_bid_ask()

        return MarketData(
            symbol=self.symbol,
            current_price=self.market_state.mid_price,
            bid=best_bid or self.market_state.mid_price - Decimal('0.05'),
            ask=best_ask or self.market_state.mid_price + Decimal('0.05'),
            volume=self.market_state.volume,
            avg_volume=self.base_volume * 20,  # Daily average
            volatility=self.market_state.volatility,
            spread=Decimal(str(self.market_state.spread_bps / 10000 * float(self.market_state.mid_price)))
        )

    def _generate_volume_profile(self, duration_hours: float) -> List[int]:
        """Generate realistic volume profile for POV algorithm."""
        intervals = int(duration_hours * 120)  # 30-second intervals

        # U-shaped intraday pattern
        time_factors = []
        for i in range(intervals):
            progress = i / intervals
            # Higher volume at open and close
            u_factor = 2.0 * (progress**2 - progress + 0.5)
            time_factors.append(max(0.3, u_factor))

        # Add random variation
        volume_profile = []
        for factor in time_factors:
            base_volume = self.base_volume // 120  # Per 30-second
            random_factor = np.random.uniform(0.7, 1.3)
            interval_volume = int(base_volume * factor * random_factor)
            volume_profile.append(interval_volume)

        return volume_profile

    def _advance_time_step(self):
        """Advance simulation time by one step."""
        self.current_time += self.time_step

    def _execute_slice(self, slice_order) -> List[Fill]:
        """Execute an algorithm slice order."""
        # Convert slice to market order
        market_order = MarketOrder(
            order_id=slice_order.order_id,
            symbol=slice_order.symbol,
            side=slice_order.side.value,
            quantity=slice_order.quantity,
            order_type=slice_order.order_type.value,
            price=slice_order.price_limit,
            timestamp=self.current_time,
            algo_id=slice_order.parent_algo_id,
            venue_id='SIM'
        )

        # Execute against order book
        fills = self.order_book.add_order(market_order)

        # Add to simulation results
        self.simulation_results['fills'].extend(fills)

        return fills

    def _update_market_state(self):
        """Update market state for next time step."""
        # Time-based variations
        self.market_state.timestamp = self.current_time

        # Volume variation (higher during market hours)
        hour = self.current_time.hour
        if 9 <= hour <= 16:  # Market hours
            volume_factor = 1.0
        else:
            volume_factor = 0.3

        # Add random volume spikes
        if np.random.random() < 0.05:  # 5% chance of volume spike
            volume_factor *= np.random.uniform(2.0, 5.0)

        self.market_state.volume = int(self.base_volume * volume_factor * np.random.uniform(0.8, 1.2))

        # Update spread based on volatility and volume
        volatility_factor = 1.0 + (self.market_state.volatility - 0.25) * 2.0
        volume_factor = max(0.5, 1.0 - (self.market_state.volume / self.base_volume - 1.0) * 0.5)
        self.market_state.spread_bps = self.base_spread * volatility_factor * volume_factor

        # Update order book
        self.order_book.update_market_state(self.market_state)

    def _calculate_performance_metrics(self):
        """Calculate comprehensive performance metrics."""
        all_fills = self.simulation_results['fills']

        if not all_fills:
            self.simulation_results['performance_metrics'] = {
                'total_filled': 0,
                'avg_fill_price': 0.0,
                'total_cost_bps': 0.0,
                'market_impact_bps': 0.0,
                'timing_cost_bps': 0.0,
                'implementation_shortfall_bps': 0.0
            }
            return

        # Basic fill statistics
        total_quantity = sum(fill.quantity for fill in all_fills)
        total_notional = sum(fill.quantity * fill.price for fill in all_fills)
        avg_fill_price = total_notional / total_quantity if total_quantity > 0 else Decimal('0.00')

        # Calculate costs relative to initial price
        initial_price = self.initial_price

        # Implementation shortfall (difference from arrival price)
        price_diff = avg_fill_price - initial_price
        implementation_shortfall_bps = float(abs(price_diff) / initial_price * 10000)

        # Market impact estimation (simplified)
        market_impact_bps = implementation_shortfall_bps * 0.6  # Assume 60% is market impact

        # Timing cost (remaining component)
        timing_cost_bps = implementation_shortfall_bps - market_impact_bps

        # Total cost including fees
        total_fees = sum(fill.fees for fill in all_fills)
        fee_bps = float(total_fees / total_notional * 10000) if total_notional > 0 else 0.0
        total_cost_bps = implementation_shortfall_bps + fee_bps

        # Execution quality metrics
        first_fill_time = min(fill.timestamp for fill in all_fills)
        last_fill_time = max(fill.timestamp for fill in all_fills)
        execution_duration = (last_fill_time - first_fill_time).total_seconds()

        # Venue analysis
        venue_stats = defaultdict(lambda: {'quantity': 0, 'notional': 0})
        for fill in all_fills:
            venue_stats[fill.venue_id]['quantity'] += fill.quantity
            venue_stats[fill.venue_id]['notional'] += fill.quantity * fill.price

        self.simulation_results['performance_metrics'] = {
            'total_filled': total_quantity,
            'avg_fill_price': float(avg_fill_price),
            'total_cost_bps': total_cost_bps,
            'market_impact_bps': market_impact_bps,
            'timing_cost_bps': timing_cost_bps,
            'implementation_shortfall_bps': implementation_shortfall_bps,
            'fee_cost_bps': fee_bps,
            'execution_duration_seconds': execution_duration,
            'fill_count': len(all_fills),
            'venue_distribution': dict(venue_stats),
            'completion_rate': total_quantity / sum(o['slice_order'].quantity for o in self.simulation_results['orders']) if self.simulation_results['orders'] else 0.0
        }

    def generate_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        metrics = self.simulation_results['performance_metrics']

        return {
            'summary': {
                'algorithm_performance': 'GOOD' if metrics.get('total_cost_bps', 0) < 20 else 'POOR',
                'total_cost_bps': metrics.get('total_cost_bps', 0),
                'market_impact_bps': metrics.get('market_impact_bps', 0),
                'completion_rate': metrics.get('completion_rate', 0)
            },
            'execution_statistics': {
                'total_fills': len(self.simulation_results['fills']),
                'avg_fill_size': metrics.get('total_filled', 0) / len(self.simulation_results['fills']) if self.simulation_results['fills'] else 0,
                'execution_duration': metrics.get('execution_duration_seconds', 0),
                'avg_fill_price': metrics.get('avg_fill_price', 0)
            },
            'cost_breakdown': {
                'market_impact': metrics.get('market_impact_bps', 0),
                'timing_cost': metrics.get('timing_cost_bps', 0),
                'fees': metrics.get('fee_cost_bps', 0),
                'total': metrics.get('total_cost_bps', 0)
            },
            'market_conditions': {
                'avg_spread_bps': np.mean([state['spread_bps'] for state in self.simulation_results['market_states']]),
                'price_volatility': np.std([state['mid_price'] for state in self.simulation_results['market_states']]),
                'avg_volume': np.mean([state['volume'] for state in self.simulation_results['market_states']])
            }
        }