"""
Execution Algorithms: TWAP, VWAP, POV implementations.

This module provides sophisticated execution algorithms for optimal order execution
with deterministic behavior, market impact minimization, and safety guardrails.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass
from abc import ABC, abstractmethod
import logging
from enum import Enum

logger = logging.getLogger(__name__)

class OrderSide(Enum):
    BUY = "BUY"
    SELL = "SELL"

class OrderType(Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    STOP_LIMIT = "STOP_LIMIT"

@dataclass
class ExecutionSlice:
    """Represents a single execution slice in an algorithm schedule."""
    order_id: str
    symbol: str
    side: OrderSide
    quantity: int
    order_type: OrderType
    price_limit: Optional[Decimal]
    execute_at: datetime
    participation_rate: Optional[float]
    slice_id: int
    parent_algo_id: str

@dataclass
class MarketData:
    """Market data required for algorithm execution."""
    symbol: str
    current_price: Decimal
    bid: Decimal
    ask: Decimal
    volume: int
    avg_volume: int
    volatility: float
    spread: Decimal
    interval_volume: Optional[int] = None

@dataclass
class AlgorithmParams:
    """Base parameters for execution algorithms."""
    algo_type: str
    duration_minutes: int
    max_participation_rate: float = 0.20
    min_slice_size: int = 100
    randomization_factor: float = 0.1
    price_aggressiveness: float = 0.5  # 0=passive, 1=aggressive

class BaseExecutionAlgorithm(ABC):
    """Abstract base class for execution algorithms."""

    def __init__(self, seed: Optional[int] = None):
        self.seed = seed
        if seed is not None:
            np.random.seed(seed)

    @abstractmethod
    def generate_schedule(self, order_request: Dict, market_data: MarketData,
                         additional_data: Optional[Dict] = None) -> List[ExecutionSlice]:
        """Generate execution schedule for the given order."""
        pass

    def _validate_params(self, order_request: Dict) -> None:
        """Validate algorithm parameters."""
        required_fields = ['symbol', 'side', 'quantity', 'start_time', 'end_time']
        for field in required_fields:
            if field not in order_request:
                raise ValueError(f"Missing required field: {field}")

        if order_request['quantity'] <= 0:
            raise ValueError("Quantity must be positive")

        if order_request['end_time'] <= order_request['start_time']:
            raise ValueError("End time must be after start time")

class TWAPAlgorithm(BaseExecutionAlgorithm):
    """Time-Weighted Average Price algorithm implementation."""

    def generate_schedule(self, order_request: Dict, market_data: MarketData,
                         additional_data: Optional[Dict] = None) -> List[ExecutionSlice]:
        """Generate TWAP execution schedule with equal time intervals."""
        self._validate_params(order_request)

        algo_params = order_request.get('algo_params', {})
        duration_minutes = algo_params.get('duration_minutes', 60)
        slice_count = algo_params.get('slice_count', 8)
        randomization_factor = algo_params.get('randomization_factor', 0.1)
        max_participation_rate = algo_params.get('max_participation_rate', 0.20)
        min_slice_size = algo_params.get('min_slice_size', 100)

        # Calculate time intervals
        total_duration = timedelta(minutes=duration_minutes)
        base_interval = total_duration / slice_count

        # Calculate base quantities
        total_quantity = order_request['quantity']
        base_quantity = total_quantity // slice_count
        remainder = total_quantity % slice_count

        # Apply minimum slice size constraint
        if base_quantity < min_slice_size:
            slice_count = max(1, total_quantity // min_slice_size)
            base_quantity = total_quantity // slice_count
            remainder = total_quantity % slice_count
            base_interval = total_duration / slice_count

        schedule = []
        current_time = order_request['start_time']
        allocated_quantity = 0

        for i in range(slice_count):
            # Calculate slice quantity with randomization
            slice_qty = base_quantity
            if i < remainder:
                slice_qty += 1

            # Apply randomization
            if randomization_factor > 0 and slice_count > 1:
                max_deviation = int(slice_qty * randomization_factor)
                if max_deviation > 0:
                    deviation = np.random.randint(-max_deviation, max_deviation + 1)
                    slice_qty = max(min_slice_size, slice_qty + deviation)

            # Check participation rate constraint
            if market_data.interval_volume and max_participation_rate:
                max_allowed = int(market_data.interval_volume * max_participation_rate)
                slice_qty = min(slice_qty, max_allowed)

            # Time randomization
            time_deviation = timedelta(minutes=0)
            if randomization_factor > 0 and i < slice_count - 1:
                max_time_dev = base_interval.total_seconds() * randomization_factor / 2
                deviation_seconds = np.random.uniform(-max_time_dev, max_time_dev)
                time_deviation = timedelta(seconds=deviation_seconds)

            execute_time = current_time + time_deviation

            # Calculate price limit
            price_limit = self._calculate_price_limit(
                market_data, order_request['side'], algo_params.get('price_aggressiveness', 0.5)
            )

            execution_slice = ExecutionSlice(
                order_id=f"TWAP_{order_request.get('order_id', 'unknown')}_{i}",
                symbol=order_request['symbol'],
                side=OrderSide(order_request['side']),
                quantity=slice_qty,
                order_type=OrderType(order_request.get('order_type', 'MARKET')),
                price_limit=price_limit,
                execute_at=execute_time,
                participation_rate=None,
                slice_id=i,
                parent_algo_id=order_request.get('algo_id', 'twap_unknown')
            )

            schedule.append(execution_slice)
            allocated_quantity += slice_qty
            current_time += base_interval

        # Adjust last slice to ensure total quantity is allocated
        if allocated_quantity != total_quantity:
            adjustment = total_quantity - allocated_quantity
            schedule[-1].quantity += adjustment

        return schedule

    def _calculate_price_limit(self, market_data: MarketData, side: str, aggressiveness: float) -> Optional[Decimal]:
        """Calculate price limit based on market data and aggressiveness."""
        if side == 'BUY':
            # More aggressive = closer to ask
            price_range = market_data.ask - market_data.bid
            limit_price = market_data.bid + (price_range * aggressiveness)
        else:
            # More aggressive = closer to bid
            price_range = market_data.ask - market_data.bid
            limit_price = market_data.ask - (price_range * aggressiveness)

        return limit_price.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

class VWAPAlgorithm(BaseExecutionAlgorithm):
    """Volume-Weighted Average Price algorithm implementation."""

    def generate_schedule(self, order_request: Dict, market_data: MarketData,
                         additional_data: Optional[Dict] = None) -> List[ExecutionSlice]:
        """Generate VWAP execution schedule following historical volume profile."""
        self._validate_params(order_request)

        algo_params = order_request.get('algo_params', {})
        target_participation_rate = algo_params.get('target_participation_rate', 0.10)
        max_participation_rate = algo_params.get('max_participation_rate', 0.20)
        volume_profile = algo_params.get('volume_profile')

        # Use historical volume profile or fall back to uniform distribution
        if volume_profile is None or additional_data is None:
            # Fall back to time-based distribution like TWAP
            return self._generate_uniform_schedule(order_request, market_data)

        # Get volume profile from additional data
        hist_volume_profile = additional_data.get('volume_profile', [])
        total_volume = additional_data.get('total_volume', market_data.avg_volume)

        if not hist_volume_profile:
            return self._generate_uniform_schedule(order_request, market_data)

        # Calculate quantities based on volume profile
        total_quantity = order_request['quantity']
        schedule = []
        current_time = order_request['start_time']

        duration_minutes = algo_params.get('duration_minutes', 390)  # Full trading day
        interval_minutes = duration_minutes / len(hist_volume_profile)

        for i, volume_fraction in enumerate(hist_volume_profile):
            # Calculate target quantity for this interval
            target_qty = int(total_quantity * volume_fraction)

            # Apply participation rate constraints
            interval_volume = int(total_volume * volume_fraction)
            max_qty_by_participation = int(interval_volume * max_participation_rate)
            target_qty_by_participation = int(interval_volume * target_participation_rate)

            # Use the more conservative quantity
            slice_qty = min(target_qty, target_qty_by_participation, max_qty_by_participation)
            slice_qty = max(slice_qty, algo_params.get('min_slice_size', 100))

            if slice_qty > 0:
                execute_time = current_time + timedelta(minutes=i * interval_minutes)

                execution_slice = ExecutionSlice(
                    order_id=f"VWAP_{order_request.get('order_id', 'unknown')}_{i}",
                    symbol=order_request['symbol'],
                    side=OrderSide(order_request['side']),
                    quantity=slice_qty,
                    order_type=OrderType(order_request.get('order_type', 'MARKET')),
                    price_limit=self._calculate_price_limit(market_data, order_request['side'], 0.5),
                    execute_at=execute_time,
                    participation_rate=slice_qty / interval_volume if interval_volume > 0 else None,
                    slice_id=i,
                    parent_algo_id=order_request.get('algo_id', 'vwap_unknown')
                )

                schedule.append(execution_slice)

        # Adjust quantities to match total (may need redistribution)
        allocated_quantity = sum(s.quantity for s in schedule)
        if allocated_quantity != total_quantity:
            self._redistribute_quantities(schedule, total_quantity, algo_params.get('min_slice_size', 100))

        return schedule

    def _generate_uniform_schedule(self, order_request: Dict, market_data: MarketData) -> List[ExecutionSlice]:
        """Generate uniform schedule when volume profile is unavailable."""
        # Convert to TWAP-like behavior
        twap_algo = TWAPAlgorithm(seed=self.seed)
        return twap_algo.generate_schedule(order_request, market_data)

    def _redistribute_quantities(self, schedule: List[ExecutionSlice], target_total: int, min_slice_size: int) -> None:
        """Redistribute quantities to match target total."""
        current_total = sum(s.quantity for s in schedule)
        difference = target_total - current_total

        if difference == 0:
            return

        # Distribute difference proportionally
        for slice_exec in schedule:
            if difference == 0:
                break

            if difference > 0:
                # Need to add quantity
                addition = min(difference, max(1, difference // len(schedule)))
                slice_exec.quantity += addition
                difference -= addition
            else:
                # Need to remove quantity
                max_reduction = slice_exec.quantity - min_slice_size
                reduction = min(abs(difference), max_reduction)
                slice_exec.quantity -= reduction
                difference += reduction

    def adjust_schedule(self, original_schedule: List[ExecutionSlice],
                       real_time_volumes: List[int], expected_volumes: List[int]) -> List[ExecutionSlice]:
        """Adjust schedule based on real-time volume performance."""
        if len(real_time_volumes) != len(expected_volumes):
            logger.warning("Volume arrays length mismatch in schedule adjustment")
            return original_schedule

        # Calculate remaining schedule from current point
        current_time = datetime.now()
        remaining_schedule = [s for s in original_schedule if s.execute_at > current_time]

        if not remaining_schedule:
            return []

        # Adjust based on volume performance
        volume_performance_ratio = sum(real_time_volumes) / sum(expected_volumes) if sum(expected_volumes) > 0 else 1.0

        # If running ahead of volume, slow down; if behind, speed up
        adjustment_factor = 1.0 / volume_performance_ratio if volume_performance_ratio > 0 else 1.0
        adjustment_factor = max(0.5, min(2.0, adjustment_factor))  # Cap adjustments

        for slice_exec in remaining_schedule:
            if slice_exec.participation_rate:
                slice_exec.participation_rate *= adjustment_factor
                slice_exec.participation_rate = min(0.25, slice_exec.participation_rate)  # Max 25%

        return remaining_schedule

    def _calculate_price_limit(self, market_data: MarketData, side: str, aggressiveness: float) -> Optional[Decimal]:
        """Calculate price limit for VWAP orders."""
        # Use same logic as TWAP
        twap_algo = TWAPAlgorithm()
        return twap_algo._calculate_price_limit(market_data, side, aggressiveness)

class POVAlgorithm(BaseExecutionAlgorithm):
    """Percentage of Volume algorithm implementation."""

    def generate_adaptive_schedule(self, order_request: Dict, market_data: MarketData,
                                 volume_intervals: List[int]) -> List[ExecutionSlice]:
        """Generate adaptive POV schedule based on real-time volume."""
        self._validate_params(order_request)

        algo_params = order_request.get('algo_params', {})
        target_participation_rate = algo_params.get('target_participation_rate', 0.15)
        max_participation_rate = algo_params.get('max_participation_rate', 0.25)
        min_participation_rate = algo_params.get('min_participation_rate', 0.05)
        execution_interval_seconds = algo_params.get('execution_interval_seconds', 30)
        volume_surge_threshold = algo_params.get('volume_surge_threshold', 3.0)
        surge_participation_cap = algo_params.get('surge_participation_cap', 0.05)

        schedule = []
        current_time = order_request['start_time']

        # Calculate average volume for surge detection
        avg_volume = np.mean(volume_intervals) if volume_intervals else market_data.avg_volume / 780  # Per 30-second

        for i, interval_volume in enumerate(volume_intervals):
            # Detect volume surge
            is_surge = interval_volume > (avg_volume * volume_surge_threshold)

            # Determine participation rate
            if is_surge:
                participation_rate = surge_participation_cap
            else:
                participation_rate = target_participation_rate

            # Apply bounds
            participation_rate = max(min_participation_rate, min(max_participation_rate, participation_rate))

            # Calculate slice quantity
            slice_qty = int(interval_volume * participation_rate)
            slice_qty = max(slice_qty, algo_params.get('min_slice_size', 50))

            execute_time = current_time + timedelta(seconds=i * execution_interval_seconds)

            execution_slice = ExecutionSlice(
                order_id=f"POV_{order_request.get('order_id', 'unknown')}_{i}",
                symbol=order_request['symbol'],
                side=OrderSide(order_request['side']),
                quantity=slice_qty,
                order_type=OrderType(order_request.get('order_type', 'MARKET')),
                price_limit=self._calculate_price_limit(market_data, order_request['side'], 0.6),
                execute_at=execute_time,
                participation_rate=participation_rate,
                slice_id=i,
                parent_algo_id=order_request.get('algo_id', 'pov_unknown')
            )

            schedule.append(execution_slice)

        return schedule

    def generate_completion_schedule(self, order_request: Dict, market_data: MarketData,
                                   executed_quantity: int, remaining_time_minutes: int) -> List[ExecutionSlice]:
        """Generate completion schedule for remaining quantity."""
        remaining_quantity = order_request['quantity'] - executed_quantity
        if remaining_quantity <= 0:
            return []

        algo_params = order_request.get('algo_params', {})
        completion_aggressiveness = algo_params.get('completion_aggressiveness', 0.8)
        base_participation_rate = algo_params.get('target_participation_rate', 0.15)

        # Increase aggressiveness as time runs out
        time_urgency_factor = 1.0 + (1.0 - min(remaining_time_minutes / 60.0, 1.0)) * completion_aggressiveness
        final_participation_rate = min(0.40, base_participation_rate * time_urgency_factor)

        # Create aggressive completion slices
        slice_count = max(1, remaining_time_minutes // 5)  # 5-minute intervals
        slice_quantity = remaining_quantity // slice_count
        remainder = remaining_quantity % slice_count

        schedule = []
        current_time = datetime.now()

        for i in range(slice_count):
            slice_qty = slice_quantity
            if i < remainder:
                slice_qty += 1

            execute_time = current_time + timedelta(minutes=i * 5)

            execution_slice = ExecutionSlice(
                order_id=f"POV_COMPLETE_{order_request.get('order_id', 'unknown')}_{i}",
                symbol=order_request['symbol'],
                side=OrderSide(order_request['side']),
                quantity=slice_qty,
                order_type=OrderType('MARKET'),  # More aggressive for completion
                price_limit=None,  # Market orders for urgency
                execute_at=execute_time,
                participation_rate=final_participation_rate,
                slice_id=i,
                parent_algo_id=order_request.get('algo_id', 'pov_complete')
            )

            schedule.append(execution_slice)

        return schedule

    def adjust_for_market_impact(self, order_request: Dict, market_data: MarketData,
                               price_moves: List[float]) -> List[ExecutionSlice]:
        """Adjust schedule based on observed market impact."""
        algo_params = order_request.get('algo_params', {})
        impact_threshold = algo_params.get('market_impact_threshold', 0.05)  # 5 bps
        impact_reduction_factor = algo_params.get('impact_reduction_factor', 0.7)
        base_participation_rate = algo_params.get('target_participation_rate', 0.25)

        schedule = []
        current_time = order_request['start_time']

        for i, price_move in enumerate(price_moves):
            # Detect high impact
            is_high_impact = abs(price_move) > impact_threshold

            # Adjust participation rate
            if is_high_impact:
                participation_rate = base_participation_rate * impact_reduction_factor
            else:
                participation_rate = base_participation_rate

            # Estimate volume and calculate quantity
            estimated_volume = market_data.avg_volume // len(price_moves)
            slice_qty = int(estimated_volume * participation_rate)

            execute_time = current_time + timedelta(minutes=i * 5)

            execution_slice = ExecutionSlice(
                order_id=f"POV_IMPACT_{order_request.get('order_id', 'unknown')}_{i}",
                symbol=order_request['symbol'],
                side=OrderSide(order_request['side']),
                quantity=slice_qty,
                order_type=OrderType(order_request.get('order_type', 'LIMIT')),
                price_limit=self._calculate_price_limit(market_data, order_request['side'], 0.3),
                execute_at=execute_time,
                participation_rate=participation_rate,
                slice_id=i,
                parent_algo_id=order_request.get('algo_id', 'pov_impact')
            )

            schedule.append(execution_slice)

        return schedule

    def _calculate_price_limit(self, market_data: MarketData, side: str, aggressiveness: float) -> Optional[Decimal]:
        """Calculate price limit for POV orders."""
        twap_algo = TWAPAlgorithm()
        return twap_algo._calculate_price_limit(market_data, side, aggressiveness)

class AlgorithmUtils:
    """Utility functions for execution algorithms."""

    def __init__(self, seed: Optional[int] = None):
        self.seed = seed
        if seed is not None:
            np.random.seed(seed)

    def calculate_price_limit(self, market_data: MarketData, side: str, aggressiveness: float) -> Decimal:
        """Calculate price limit based on market conditions and aggressiveness."""
        spread = market_data.ask - market_data.bid

        if side == 'BUY':
            # Aggressiveness 0 = bid, 1 = ask
            limit_price = market_data.bid + (spread * aggressiveness)
        else:
            # Aggressiveness 0 = ask, 1 = bid
            limit_price = market_data.ask - (spread * aggressiveness)

        return limit_price.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def randomize_quantities(self, quantities: List[int], factor: float, min_size: int) -> List[int]:
        """Randomize quantities while preserving total."""
        if factor <= 0:
            return quantities.copy()

        total_original = sum(quantities)
        randomized = []

        for qty in quantities:
            max_deviation = int(qty * factor)
            if max_deviation > 0:
                deviation = np.random.randint(-max_deviation, max_deviation + 1)
                new_qty = max(min_size, qty + deviation)
            else:
                new_qty = qty
            randomized.append(new_qty)

        # Adjust to preserve total
        total_randomized = sum(randomized)
        difference = total_original - total_randomized

        # Distribute difference
        if difference != 0:
            for i in range(len(randomized)):
                if difference == 0:
                    break

                if difference > 0:
                    add_qty = min(difference, 1)
                    randomized[i] += add_qty
                    difference -= add_qty
                else:
                    max_reduction = randomized[i] - min_size
                    reduce_qty = min(abs(difference), max_reduction)
                    randomized[i] -= reduce_qty
                    difference += reduce_qty

        return randomized

    def is_market_hours(self, timestamp: datetime, market: str = 'US') -> bool:
        """Check if timestamp is within market hours."""
        if market == 'US':
            # US market: Monday-Friday, 9:30 AM - 4:00 PM ET
            if timestamp.weekday() >= 5:  # Weekend
                return False

            time_only = timestamp.time()
            market_open = datetime.strptime('09:30', '%H:%M').time()
            market_close = datetime.strptime('16:00', '%H:%M').time()

            return market_open <= time_only <= market_close

        return True  # Default to always open for other markets

    def estimate_execution_cost(self, market_data: MarketData, order_size: int,
                              participation_rate: float) -> Dict[str, float]:
        """Estimate execution costs in basis points."""
        # Simple cost model - would be more sophisticated in production

        # Market impact (square root law)
        market_impact_bps = 10 * np.sqrt(order_size / market_data.avg_volume) * 100

        # Timing risk based on volatility and duration
        timing_risk_bps = market_data.volatility * np.sqrt(1/252) * 100  # Daily vol

        # Opportunity cost from participation rate
        opportunity_cost_bps = max(0, (participation_rate - 0.1) * 20)  # Penalty for high participation

        total_cost_bps = market_impact_bps + timing_risk_bps + opportunity_cost_bps

        return {
            'market_impact': market_impact_bps,
            'timing_risk': timing_risk_bps,
            'opportunity_cost': opportunity_cost_bps,
            'total_cost_bps': total_cost_bps
        }

class AlgorithmSafety:
    """Safety checks and guardrails for execution algorithms."""

    def __init__(self):
        self.max_order_size = 1000000  # 1M shares
        self.max_notional_value = 50000000  # $50M
        self.max_price_deviation = 0.20  # 20% from current price
        self.max_concentration_pct = 0.10  # 10% of market cap

    def validate_order(self, order_request: Dict, market_data: MarketData,
                      existing_position: int = 0) -> Dict[str, Any]:
        """Validate order for safety compliance."""
        errors = []
        warnings = []

        quantity = order_request.get('quantity', 0)
        current_price = market_data.current_price

        # Check quantity limits
        if quantity > self.max_order_size:
            errors.append('excessive_quantity')

        # Check notional value
        notional_value = quantity * float(current_price)
        if notional_value > self.max_notional_value:
            errors.append('excessive_notional')

        # Check price collar (for limit orders)
        if order_request.get('order_type') == 'LIMIT':
            limit_price = Decimal(str(order_request.get('limit_price', 0)))
            price_deviation = abs(limit_price - current_price) / current_price
            if price_deviation > self.max_price_deviation:
                errors.append('price_collar_violation')

        # Check concentration limits
        total_position = existing_position + quantity
        estimated_market_cap = float(current_price) * 1000000000  # Rough estimate
        position_value = total_position * float(current_price)
        concentration_pct = position_value / estimated_market_cap

        if concentration_pct > self.max_concentration_pct:
            warnings.append('concentration_warning')

        # Check market conditions
        if market_data.volatility > 0.6:  # 60% annualized volatility
            warnings.append('high_volatility_warning')

        # Recommend adjustments for high volatility
        recommended_adjustments = {}
        if market_data.volatility > 0.6:
            recommended_adjustments['max_participation_rate'] = 0.10
            recommended_adjustments['slice_count'] = max(10, quantity // 1000)

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'recommended_adjustments': recommended_adjustments
        }