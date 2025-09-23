"""
Unit tests for execution algorithms (TWAP, VWAP, POV).

This test suite validates the core execution algorithms with deterministic behavior,
proper scheduling, and compliance with execution constraints.
"""

import pytest
import numpy as np
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch
from typing import List, Dict, Optional

# Test fixtures and data
@pytest.fixture
def market_data():
    """Sample market data for algorithm testing."""
    return {
        'symbol': 'AAPL',
        'current_price': Decimal('150.00'),
        'bid': Decimal('149.95'),
        'ask': Decimal('150.05'),
        'volume': 1000000,
        'avg_volume': 50000000,
        'volatility': 0.25,
        'spread': Decimal('0.10')
    }

@pytest.fixture
def order_request():
    """Sample order request for testing."""
    return {
        'symbol': 'AAPL',
        'side': 'BUY',
        'quantity': 10000,
        'order_type': 'MARKET',
        'time_in_force': 'DAY',
        'start_time': datetime.now(),
        'end_time': datetime.now() + timedelta(hours=2),
        'algo_params': {}
    }

@pytest.fixture
def historical_volume_profile():
    """Historical volume profile for VWAP calculation."""
    # 30-minute intervals over trading day (9:30 AM - 4:00 PM)
    intervals = 13
    np.random.seed(42)  # Deterministic for testing
    base_volume = np.array([
        0.08, 0.06, 0.05, 0.04, 0.05, 0.06, 0.08,  # Morning
        0.10, 0.12, 0.15, 0.12, 0.08, 0.06         # Afternoon
    ])
    return {
        'intervals': intervals,
        'volume_profile': base_volume,
        'total_volume': 45000000
    }

class TestTWAPAlgorithm:
    """Test suite for Time-Weighted Average Price (TWAP) algorithm."""

    def test_twap_schedule_generation(self, order_request, market_data):
        """Test TWAP schedule generation with equal time intervals."""
        from app.services.execution.algorithms import TWAPAlgorithm

        algo = TWAPAlgorithm(seed=42)
        order_request['algo_params'] = {
            'duration_minutes': 120,
            'slice_count': 8,
            'randomization_factor': 0.1
        }

        schedule = algo.generate_schedule(order_request, market_data)

        # Validate schedule structure
        assert len(schedule) == 8
        assert sum(s['quantity'] for s in schedule) == order_request['quantity']

        # Validate time intervals
        for i in range(len(schedule) - 1):
            time_diff = schedule[i+1]['execute_at'] - schedule[i]['execute_at']
            expected_interval = timedelta(minutes=15)  # 120 / 8
            # Allow 10% variation due to randomization
            assert abs(time_diff.total_seconds() - expected_interval.total_seconds()) <= 90

        # Validate quantity distribution (should be roughly equal with randomization)
        expected_qty = order_request['quantity'] / 8
        for slice_order in schedule:
            assert abs(slice_order['quantity'] - expected_qty) <= expected_qty * 0.2

    def test_twap_with_market_constraints(self, order_request, market_data):
        """Test TWAP respects market constraints and participation limits."""
        from app.services.execution.algorithms import TWAPAlgorithm

        algo = TWAPAlgorithm(seed=42)
        order_request['algo_params'] = {
            'duration_minutes': 60,
            'slice_count': 4,
            'max_participation_rate': 0.05,  # 5% of volume
            'min_slice_size': 100
        }

        # Mock volume data
        market_data['interval_volume'] = 500000  # 15-min interval volume

        schedule = algo.generate_schedule(order_request, market_data)

        # Check participation rate constraint
        max_allowed_qty = market_data['interval_volume'] * 0.05
        for slice_order in schedule:
            assert slice_order['quantity'] <= max_allowed_qty
            assert slice_order['quantity'] >= 100  # Min slice size

    def test_twap_schedule_deterministic_behavior(self, order_request, market_data):
        """Test TWAP produces deterministic results with same seed."""
        from app.services.execution.algorithms import TWAPAlgorithm

        algo1 = TWAPAlgorithm(seed=42)
        algo2 = TWAPAlgorithm(seed=42)

        order_request['algo_params'] = {
            'duration_minutes': 90,
            'slice_count': 6,
            'randomization_factor': 0.15
        }

        schedule1 = algo1.generate_schedule(order_request, market_data)
        schedule2 = algo2.generate_schedule(order_request, market_data)

        # Should produce identical schedules
        assert len(schedule1) == len(schedule2)
        for s1, s2 in zip(schedule1, schedule2):
            assert s1['quantity'] == s2['quantity']
            assert s1['execute_at'] == s2['execute_at']
            assert s1['price_limit'] == s2['price_limit']

    def test_twap_edge_cases(self, order_request, market_data):
        """Test TWAP handles edge cases properly."""
        from app.services.execution.algorithms import TWAPAlgorithm

        algo = TWAPAlgorithm(seed=42)

        # Test minimum duration
        order_request['algo_params'] = {
            'duration_minutes': 1,
            'slice_count': 1
        }
        schedule = algo.generate_schedule(order_request, market_data)
        assert len(schedule) == 1
        assert schedule[0]['quantity'] == order_request['quantity']

        # Test large slice count
        order_request['algo_params'] = {
            'duration_minutes': 120,
            'slice_count': 100,
            'min_slice_size': 50
        }
        schedule = algo.generate_schedule(order_request, market_data)
        # Should limit slices to respect min_slice_size
        expected_max_slices = order_request['quantity'] // 50
        assert len(schedule) <= expected_max_slices

class TestVWAPAlgorithm:
    """Test suite for Volume-Weighted Average Price (VWAP) algorithm."""

    def test_vwap_schedule_with_volume_profile(self, order_request, market_data, historical_volume_profile):
        """Test VWAP schedule follows historical volume profile."""
        from app.services.execution.algorithms import VWAPAlgorithm

        algo = VWAPAlgorithm(seed=42)
        order_request['algo_params'] = {
            'duration_minutes': 390,  # Full trading day
            'target_participation_rate': 0.10,
            'volume_profile': historical_volume_profile['volume_profile']
        }

        schedule = algo.generate_schedule(order_request, market_data, historical_volume_profile)

        # Validate schedule follows volume profile
        assert len(schedule) == len(historical_volume_profile['volume_profile'])
        assert sum(s['quantity'] for s in schedule) == order_request['quantity']

        # Check that quantities are proportional to volume profile
        total_profile_volume = sum(historical_volume_profile['volume_profile'])
        for i, slice_order in enumerate(schedule):
            expected_proportion = historical_volume_profile['volume_profile'][i] / total_profile_volume
            actual_proportion = slice_order['quantity'] / order_request['quantity']
            # Allow 15% deviation due to minimum slice constraints
            assert abs(actual_proportion - expected_proportion) <= 0.15

    def test_vwap_participation_rate_limits(self, order_request, market_data, historical_volume_profile):
        """Test VWAP respects participation rate limits."""
        from app.services.execution.algorithms import VWAPAlgorithm

        algo = VWAPAlgorithm(seed=42)
        order_request['algo_params'] = {
            'duration_minutes': 390,
            'target_participation_rate': 0.20,
            'max_participation_rate': 0.15,  # Hard limit
            'volume_profile': historical_volume_profile['volume_profile']
        }

        schedule = algo.generate_schedule(order_request, market_data, historical_volume_profile)

        # Check each slice respects max participation rate
        total_volume = historical_volume_profile['total_volume']
        interval_minutes = 390 / len(historical_volume_profile['volume_profile'])

        for i, slice_order in enumerate(schedule):
            interval_volume = total_volume * historical_volume_profile['volume_profile'][i]
            max_quantity = interval_volume * 0.15
            assert slice_order['quantity'] <= max_quantity

    def test_vwap_curve_adjustment(self, order_request, market_data, historical_volume_profile):
        """Test VWAP adjusts for real-time volume vs. historical curve."""
        from app.services.execution.algorithms import VWAPAlgorithm

        algo = VWAPAlgorithm(seed=42)
        order_request['algo_params'] = {
            'duration_minutes': 120,
            'target_participation_rate': 0.10,
            'volume_profile': historical_volume_profile['volume_profile'][:4],  # First 2 hours
            'adaptive_mode': True
        }

        # Mock real-time volume tracking
        real_time_volumes = [600000, 450000, 750000, 500000]  # Actual volumes
        expected_volumes = [400000, 400000, 600000, 600000]   # Historical expected

        schedule = algo.generate_schedule(order_request, market_data, historical_volume_profile)
        adjusted_schedule = algo.adjust_schedule(schedule, real_time_volumes, expected_volumes)

        # Should adjust remaining quantities based on volume performance
        assert len(adjusted_schedule) <= len(schedule)
        assert sum(s['quantity'] for s in adjusted_schedule) <= order_request['quantity']

    def test_vwap_minimum_viable_schedule(self, order_request, market_data):
        """Test VWAP handles cases with insufficient volume data."""
        from app.services.execution.algorithms import VWAPAlgorithm

        algo = VWAPAlgorithm(seed=42)
        order_request['quantity'] = 100  # Small order
        order_request['algo_params'] = {
            'duration_minutes': 30,
            'target_participation_rate': 0.05
        }

        # No historical volume profile
        schedule = algo.generate_schedule(order_request, market_data, None)

        # Should fall back to time-based distribution
        assert len(schedule) >= 1
        assert sum(s['quantity'] for s in schedule) == order_request['quantity']

class TestPOVAlgorithm:
    """Test suite for Percentage of Volume (POV) algorithm."""

    def test_pov_target_participation_rate(self, order_request, market_data):
        """Test POV maintains target participation rate."""
        from app.services.execution.algorithms import POVAlgorithm

        algo = POVAlgorithm(seed=42)
        order_request['algo_params'] = {
            'target_participation_rate': 0.15,
            'max_participation_rate': 0.25,
            'min_participation_rate': 0.05,
            'volume_lookback_minutes': 20,
            'execution_interval_seconds': 30
        }

        # Mock volume tracking
        volume_intervals = [50000, 75000, 60000, 80000, 65000]  # 30-second intervals

        schedule = algo.generate_adaptive_schedule(order_request, market_data, volume_intervals)

        # Validate participation rates
        for i, slice_order in enumerate(schedule):
            if i < len(volume_intervals):
                expected_qty = volume_intervals[i] * 0.15
                # Allow some variance for minimum order sizes
                assert abs(slice_order['quantity'] - expected_qty) <= max(expected_qty * 0.2, 50)

    def test_pov_volume_surge_handling(self, order_request, market_data):
        """Test POV handles volume surges appropriately."""
        from app.services.execution.algorithms import POVAlgorithm

        algo = POVAlgorithm(seed=42)
        order_request['algo_params'] = {
            'target_participation_rate': 0.10,
            'max_participation_rate': 0.20,
            'volume_surge_threshold': 3.0,  # 3x normal volume
            'surge_participation_cap': 0.05  # Reduce to 5% during surges
        }

        # Normal volume then surge
        volume_intervals = [40000, 45000, 200000, 180000, 50000]  # Surge in middle

        schedule = algo.generate_adaptive_schedule(order_request, market_data, volume_intervals)

        # During surge (intervals 2-3), should use capped participation
        surge_slices = schedule[2:4]
        for slice_order in surge_slices:
            # Should be limited by surge cap
            assert slice_order['participation_rate'] <= 0.05

    def test_pov_order_completion_logic(self, order_request, market_data):
        """Test POV completes order appropriately."""
        from app.services.execution.algorithms import POVAlgorithm

        algo = POVAlgorithm(seed=42)
        order_request['quantity'] = 5000
        order_request['algo_params'] = {
            'target_participation_rate': 0.20,
            'completion_aggressiveness': 0.8,  # Become more aggressive near end
            'time_limit_minutes': 60
        }

        # Simulate partial fills
        executed_quantity = 3000
        remaining_time_minutes = 10

        completion_schedule = algo.generate_completion_schedule(
            order_request, market_data, executed_quantity, remaining_time_minutes
        )

        # Should increase participation rate for completion
        assert len(completion_schedule) > 0
        final_participation = completion_schedule[-1]['participation_rate']
        assert final_participation > 0.20  # More aggressive than original

        # Should complete remaining quantity
        remaining_qty = order_request['quantity'] - executed_quantity
        total_completion_qty = sum(s['quantity'] for s in completion_schedule)
        assert total_completion_qty == remaining_qty

    def test_pov_market_impact_adjustment(self, order_request, market_data):
        """Test POV adjusts for market impact."""
        from app.services.execution.algorithms import POVAlgorithm

        algo = POVAlgorithm(seed=42)
        order_request['algo_params'] = {
            'target_participation_rate': 0.25,
            'market_impact_threshold': 0.05,  # 5 bps adverse movement
            'impact_reduction_factor': 0.7
        }

        # Mock price movement tracking
        price_moves = [0.0, 0.02, 0.08, 0.12, 0.04]  # High impact in middle

        schedule = algo.adjust_for_market_impact(order_request, market_data, price_moves)

        # Should reduce participation during high impact periods
        high_impact_slice = schedule[3]  # 0.12% move
        assert high_impact_slice['participation_rate'] < 0.25

class TestAlgorithmUtils:
    """Test suite for common algorithm utilities."""

    def test_price_limit_calculation(self, market_data):
        """Test price limit calculation for different order types."""
        from app.services.execution.algorithms import AlgorithmUtils

        utils = AlgorithmUtils()

        # Aggressive limit (closer to market)
        buy_limit = utils.calculate_price_limit(
            market_data, 'BUY', aggressiveness=0.8
        )
        assert buy_limit <= market_data['ask']
        assert buy_limit >= market_data['bid']

        # Conservative limit (further from market)
        sell_limit = utils.calculate_price_limit(
            market_data, 'SELL', aggressiveness=0.2
        )
        assert sell_limit >= market_data['bid']
        assert sell_limit <= market_data['ask']

    def test_quantity_randomization(self):
        """Test quantity randomization maintains total quantity."""
        from app.services.execution.algorithms import AlgorithmUtils

        utils = AlgorithmUtils(seed=42)

        quantities = [1000, 1500, 2000, 1200, 800]
        total_original = sum(quantities)

        randomized = utils.randomize_quantities(quantities, factor=0.2, min_size=100)

        # Total should be preserved
        assert sum(randomized) == total_original

        # Each quantity should be within randomization bounds
        for orig, rand in zip(quantities, randomized):
            max_deviation = orig * 0.2
            assert abs(rand - orig) <= max_deviation
            assert rand >= 100  # Min size respected

    def test_market_hours_validation(self):
        """Test market hours validation."""
        from app.services.execution.algorithms import AlgorithmUtils

        utils = AlgorithmUtils()

        # Trading hours (9:30 AM - 4:00 PM ET)
        trading_time = datetime(2024, 1, 15, 14, 30)  # 2:30 PM on weekday
        assert utils.is_market_hours(trading_time, 'US')

        # After hours
        after_hours = datetime(2024, 1, 15, 18, 30)  # 6:30 PM
        assert not utils.is_market_hours(after_hours, 'US')

        # Weekend
        weekend = datetime(2024, 1, 13, 14, 30)  # Saturday
        assert not utils.is_market_hours(weekend, 'US')

    def test_execution_cost_estimation(self, market_data):
        """Test execution cost estimation."""
        from app.services.execution.algorithms import AlgorithmUtils

        utils = AlgorithmUtils()

        order_size = 10000
        participation_rate = 0.15

        cost_estimate = utils.estimate_execution_cost(
            market_data, order_size, participation_rate
        )

        # Should return cost breakdown
        assert 'market_impact' in cost_estimate
        assert 'timing_risk' in cost_estimate
        assert 'opportunity_cost' in cost_estimate
        assert 'total_cost_bps' in cost_estimate

        # Costs should be reasonable
        assert 0 <= cost_estimate['total_cost_bps'] <= 100  # Max 1% cost
        assert cost_estimate['market_impact'] >= 0
        assert cost_estimate['timing_risk'] >= 0

class TestAlgorithmSafetyLimits:
    """Test suite for algorithm safety limits and guardrails."""

    def test_fat_finger_protection(self, order_request, market_data):
        """Test fat-finger protection prevents erroneous orders."""
        from app.services.execution.algorithms import AlgorithmSafety

        safety = AlgorithmSafety()

        # Excessive order size
        fat_finger_order = order_request.copy()
        fat_finger_order['quantity'] = 10000000  # 10M shares

        validation_result = safety.validate_order(fat_finger_order, market_data)
        assert not validation_result['valid']
        assert 'excessive_quantity' in validation_result['errors']

        # Excessive value
        fat_finger_order['quantity'] = 1000000  # $150M at $150/share
        validation_result = safety.validate_order(fat_finger_order, market_data)
        assert not validation_result['valid']
        assert 'excessive_notional' in validation_result['errors']

    def test_price_collar_validation(self, order_request, market_data):
        """Test price collar validation."""
        from app.services.execution.algorithms import AlgorithmSafety

        safety = AlgorithmSafety()

        # Price too far from market
        collar_order = order_request.copy()
        collar_order['order_type'] = 'LIMIT'
        collar_order['limit_price'] = Decimal('200.00')  # 33% above market

        validation_result = safety.validate_order(collar_order, market_data)
        assert not validation_result['valid']
        assert 'price_collar_violation' in validation_result['errors']

    def test_concentration_limits(self, order_request, market_data):
        """Test position concentration limits."""
        from app.services.execution.algorithms import AlgorithmSafety

        safety = AlgorithmSafety()

        # Mock existing position
        existing_position = 500000  # Already hold 500k shares

        concentration_order = order_request.copy()
        concentration_order['quantity'] = 1000000  # Would total 1.5M shares

        validation_result = safety.validate_order(
            concentration_order, market_data, existing_position=existing_position
        )

        # Should flag concentration risk
        assert 'concentration_warning' in validation_result['warnings']

    def test_market_condition_restrictions(self, order_request, market_data):
        """Test market condition-based restrictions."""
        from app.services.execution.algorithms import AlgorithmSafety

        safety = AlgorithmSafety()

        # High volatility market
        volatile_market = market_data.copy()
        volatile_market['volatility'] = 0.8  # 80% annualized vol

        validation_result = safety.validate_order(order_request, volatile_market)

        # Should require additional confirmations or modify params
        assert 'high_volatility_warning' in validation_result['warnings']
        recommended_params = validation_result.get('recommended_adjustments', {})
        if recommended_params:
            assert recommended_params.get('max_participation_rate', 1.0) < 0.15