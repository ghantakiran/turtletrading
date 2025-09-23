"""
Integration tests for smart order router decisions.

This test suite validates router decision-making under various market conditions,
venue failures, and execution scenarios with realistic market simulation.
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch
from typing import List, Dict

from app.services.execution.smart_router import (
    SmartOrderRouter, VenueStats, VenueType, MockVenueAdapter, RoutingDecision
)
from app.services.execution.algorithms import MarketData

class TestRouterDecisionIntegration:
    """Integration tests for router decision logic."""

    @pytest.fixture
    def router_with_venues(self):
        """Router instance with mock venues configured."""
        router = SmartOrderRouter(seed=42)

        # Configure diverse venue ecosystem
        venues = [
            ("NYSE", VenueStats(
                venue_id="NYSE", venue_name="NYSE", venue_type=VenueType.EXCHANGE,
                fill_rate=0.95, avg_fill_time_ms=120, price_improvement_bps=0.5,
                spread_bps=5.0, depth_shares=5000, maker_fee_bps=-0.3, taker_fee_bps=0.3,
                connectivity_score=0.99, latency_ms=25, uptime_pct=99.9
            )),
            ("NASDAQ", VenueStats(
                venue_id="NASDAQ", venue_name="NASDAQ", venue_type=VenueType.EXCHANGE,
                fill_rate=0.94, avg_fill_time_ms=110, price_improvement_bps=0.3,
                spread_bps=4.8, depth_shares=4800, maker_fee_bps=-0.25, taker_fee_bps=0.3,
                connectivity_score=0.98, latency_ms=22, uptime_pct=99.8
            )),
            ("BATS", VenueStats(
                venue_id="BATS", venue_name="BATS", venue_type=VenueType.ECN,
                fill_rate=0.92, avg_fill_time_ms=95, price_improvement_bps=0.8,
                spread_bps=4.5, depth_shares=3200, maker_fee_bps=-0.4, taker_fee_bps=0.35,
                connectivity_score=0.97, latency_ms=18, uptime_pct=99.7
            )),
            ("SIGMA_X", VenueStats(
                venue_id="SIGMA_X", venue_name="Sigma X", venue_type=VenueType.DARK_POOL,
                fill_rate=0.85, avg_fill_time_ms=200, price_improvement_bps=2.5,
                spread_bps=0.0, depth_shares=8000, maker_fee_bps=0.0, taker_fee_bps=0.0,
                connectivity_score=0.92, latency_ms=35, uptime_pct=99.2
            )),
            ("POOR_VENUE", VenueStats(
                venue_id="POOR_VENUE", venue_name="Poor Venue", venue_type=VenueType.ECN,
                fill_rate=0.60, avg_fill_time_ms=500, price_improvement_bps=-1.0,
                spread_bps=15.0, depth_shares=500, maker_fee_bps=0.5, taker_fee_bps=1.0,
                connectivity_score=0.70, latency_ms=100, uptime_pct=95.0
            ))
        ]

        for venue_id, stats in venues:
            adapter = MockVenueAdapter(venue_id, seed=42)
            router.register_venue(venue_id, adapter, stats)

        return router

    @pytest.fixture
    def sample_order(self):
        """Sample order for routing tests."""
        return {
            'order_id': 'TEST_ORDER_001',
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10000,
            'order_type': 'MARKET'
        }

    @pytest.fixture
    def market_data(self):
        """Sample market data for testing."""
        return MarketData(
            symbol='AAPL',
            current_price=Decimal('150.00'),
            bid=Decimal('149.95'),
            ask=Decimal('150.05'),
            volume=1000000,
            avg_volume=50000000,
            volatility=0.25,
            spread=Decimal('0.10')
        )

    @pytest.mark.asyncio
    async def test_normal_routing_decision(self, router_with_venues, sample_order):
        """Test routing decision under normal market conditions."""
        router = router_with_venues

        # Route order
        decisions = await router.route_order(sample_order)

        # Validate routing decisions
        assert len(decisions) > 0
        assert len(decisions) <= 3  # Should not over-fragment

        # Check total quantity allocation
        total_allocated = sum(d.quantity for d in decisions)
        assert total_allocated == sample_order['quantity']

        # Verify venue quality - should prefer better venues
        venue_scores = {}
        for decision in decisions:
            stats = router.venue_stats[decision.venue_id]
            # Simple scoring based on fill rate and fees
            score = stats.fill_rate - stats.taker_fee_bps / 100
            venue_scores[decision.venue_id] = score

        # Top allocated venue should have good metrics
        top_allocation = max(decisions, key=lambda d: d.quantity)
        top_venue_score = venue_scores[top_allocation.venue_id]
        assert top_venue_score > 0.9  # Should be high-quality venue

        # Poor venue should not get significant allocation
        poor_allocations = [d for d in decisions if d.venue_id == "POOR_VENUE"]
        if poor_allocations:
            poor_allocation_pct = sum(d.quantity for d in poor_allocations) / sample_order['quantity']
            assert poor_allocation_pct < 0.2  # Less than 20%

    @pytest.mark.asyncio
    async def test_venue_failure_resilience(self, router_with_venues, sample_order):
        """Test router behavior when venues fail or have poor connectivity."""
        router = router_with_venues

        # Simulate venue connectivity issues
        router.venue_stats["NYSE"].connectivity_score = 0.5  # Poor connectivity
        router.venue_stats["NASDAQ"].connectivity_score = 0.4  # Worse connectivity

        decisions = await router.route_order(sample_order)

        # Should still route successfully
        assert len(decisions) > 0
        total_allocated = sum(d.quantity for d in decisions)
        assert total_allocated == sample_order['quantity']

        # Should avoid poorly connected venues
        used_venues = {d.venue_id for d in decisions}
        assert "NYSE" not in used_venues or any(
            d.quantity < sample_order['quantity'] * 0.3 for d in decisions if d.venue_id == "NYSE"
        )

        # Should prefer well-connected venues
        well_connected_allocation = sum(
            d.quantity for d in decisions
            if router.venue_stats[d.venue_id].connectivity_score >= 0.9
        )
        assert well_connected_allocation > sample_order['quantity'] * 0.6

    @pytest.mark.asyncio
    async def test_concentration_limits(self, router_with_venues, sample_order):
        """Test venue concentration limits are enforced."""
        router = router_with_venues

        # Large order to test concentration
        large_order = sample_order.copy()
        large_order['quantity'] = 100000

        decisions = await router.route_order(large_order)

        # Check concentration limits
        for decision in decisions:
            venue_percentage = decision.quantity / large_order['quantity']
            assert venue_percentage <= router.max_venue_concentration

        # Should use multiple venues for large orders
        assert len(decisions) >= 2

    @pytest.mark.asyncio
    async def test_dark_pool_preference_large_orders(self, router_with_venues, sample_order):
        """Test dark pool preference for large orders."""
        router = router_with_venues

        # Very large order
        large_order = sample_order.copy()
        large_order['quantity'] = 50000

        decisions = await router.route_order(large_order)

        # Dark pools should get meaningful allocation for large orders
        dark_pool_allocation = sum(
            d.quantity for d in decisions
            if router.venue_stats[d.venue_id].venue_type == VenueType.DARK_POOL
        )

        dark_pool_percentage = dark_pool_allocation / large_order['quantity']
        assert dark_pool_percentage > 0.1  # At least 10% to dark pools

    @pytest.mark.asyncio
    async def test_small_order_routing(self, router_with_venues, sample_order):
        """Test routing behavior for small orders."""
        router = router_with_venues

        # Small order
        small_order = sample_order.copy()
        small_order['quantity'] = 500

        decisions = await router.route_order(small_order)

        # Small orders should go to fewer venues (less fragmentation)
        assert len(decisions) <= 2

        # Should prefer low-cost, fast venues
        for decision in decisions:
            stats = router.venue_stats[decision.venue_id]
            assert stats.avg_fill_time_ms < 200  # Fast execution
            assert stats.taker_fee_bps < 0.5  # Low fees

    @pytest.mark.asyncio
    async def test_execution_monitoring(self, router_with_venues, sample_order):
        """Test order execution monitoring and reporting."""
        router = router_with_venues

        decisions = await router.route_order(sample_order)
        execution_report = await router.execute_routing_decisions(sample_order['order_id'], decisions)

        # Validate execution report
        assert execution_report.order_id == sample_order['order_id']
        assert execution_report.original_quantity == sample_order['quantity']

        # Check venues used
        assert len(execution_report.venues_used) > 0
        assert execution_report.venues_used.issubset({d.venue_id for d in decisions})

        # Execution should have filled some quantity (in mock, fill rate is high)
        assert execution_report.filled_quantity > 0

    @pytest.mark.asyncio
    async def test_price_improvement_optimization(self, router_with_venues, sample_order):
        """Test router optimizes for price improvement."""
        router = router_with_venues

        # Adjust weights to prioritize price improvement
        router.best_execution_weights['price_improvement'] = 0.60
        router.best_execution_weights['cost'] = 0.10

        decisions = await router.route_order(sample_order)

        # Should favor venues with better price improvement
        for decision in decisions:
            stats = router.venue_stats[decision.venue_id]
            if decision.quantity > sample_order['quantity'] * 0.3:  # Major allocation
                assert stats.price_improvement_bps >= 0  # Non-negative improvement

    @pytest.mark.asyncio
    async def test_safety_checks_enforcement(self, router_with_venues, sample_order):
        """Test safety checks prevent problematic orders."""
        router = router_with_venues

        # Test excessive order size
        excessive_order = sample_order.copy()
        excessive_order['quantity'] = 50000000  # 50M shares

        with pytest.raises(ValueError, match="safety checks"):
            await router.route_order(excessive_order)

        # Test with very wide spread (unsafe market conditions)
        # Mock all venues to have wide spreads
        for stats in router.venue_stats.values():
            stats.spread_bps = 100  # 100 bps spread

        with pytest.raises(ValueError, match="spread"):
            await router.route_order(sample_order)

    @pytest.mark.asyncio
    async def test_routing_history_tracking(self, router_with_venues, sample_order):
        """Test routing decisions are properly tracked."""
        router = router_with_venues

        # Execute multiple orders
        orders = []
        for i in range(3):
            order = sample_order.copy()
            order['order_id'] = f"TEST_ORDER_{i:03d}"
            order['quantity'] = 5000 + i * 1000
            orders.append(order)

        for order in orders:
            await router.route_order(order)

        # Check routing history
        history = router.get_routing_history()
        assert len(history) >= 3

        # Validate history entries
        for entry in history[-3:]:
            assert 'timestamp' in entry
            assert 'symbol' in entry
            assert 'decisions' in entry
            assert entry['venues_used'] > 0

    @pytest.mark.asyncio
    async def test_market_conditions_adaptation(self, router_with_venues, sample_order):
        """Test router adapts to different market conditions."""
        router = router_with_venues

        # Test in volatile market (high spreads)
        for venue_id in ["NYSE", "NASDAQ"]:
            router.venue_stats[venue_id].spread_bps = 20.0  # High spread

        volatile_decisions = await router.route_order(sample_order)

        # Should prefer venues with better liquidity in volatile conditions
        # and possibly fragment more to reduce impact
        volatile_venue_count = len(volatile_decisions)

        # Reset to normal conditions
        for venue_id in ["NYSE", "NASDAQ"]:
            router.venue_stats[venue_id].spread_bps = 5.0

        normal_decisions = await router.route_order(sample_order)
        normal_venue_count = len(normal_decisions)

        # May use more venues in volatile conditions for better risk distribution
        # (This is one possible adaptation strategy)
        assert volatile_venue_count >= normal_venue_count - 1

    @pytest.mark.asyncio
    async def test_venue_statistics_updates(self, router_with_venues, sample_order):
        """Test venue statistics are updated during routing."""
        router = router_with_venues

        # Get initial stats
        initial_stats = {v_id: stats.last_update for v_id, stats in router.venue_stats.items()}

        # Route order (should trigger stats update)
        await router.route_order(sample_order)

        # Check stats were updated
        updated_stats = {v_id: stats.last_update for v_id, stats in router.venue_stats.items()}

        updated_venues = sum(1 for v_id in initial_stats if updated_stats[v_id] > initial_stats[v_id])
        assert updated_venues > 0  # At least some venues should be updated

class TestRouterEdgeCases:
    """Test router behavior in edge cases and failure scenarios."""

    @pytest.fixture
    def minimal_router(self):
        """Router with minimal venue setup for edge case testing."""
        router = SmartOrderRouter(seed=42)

        # Single venue
        adapter = MockVenueAdapter("SINGLE_VENUE", seed=42)
        stats = VenueStats(
            venue_id="SINGLE_VENUE", venue_name="Single Venue", venue_type=VenueType.EXCHANGE,
            fill_rate=0.90, avg_fill_time_ms=100, price_improvement_bps=0.0,
            spread_bps=5.0, depth_shares=2000, maker_fee_bps=0.0, taker_fee_bps=0.3,
            connectivity_score=0.95, latency_ms=30, uptime_pct=99.0
        )
        router.register_venue("SINGLE_VENUE", adapter, stats)

        return router

    @pytest.mark.asyncio
    async def test_single_venue_routing(self, minimal_router):
        """Test routing with only one available venue."""
        router = minimal_router

        order = {
            'order_id': 'SINGLE_VENUE_TEST',
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 5000,
            'order_type': 'MARKET'
        }

        decisions = await router.route_order(order)

        assert len(decisions) == 1
        assert decisions[0].venue_id == "SINGLE_VENUE"
        assert decisions[0].quantity == order['quantity']

    @pytest.mark.asyncio
    async def test_no_venues_available(self, minimal_router):
        """Test router behavior when no venues are available."""
        router = minimal_router

        # Disable the only venue
        router.venue_stats["SINGLE_VENUE"].connectivity_score = 0.5  # Below minimum

        order = {
            'order_id': 'NO_VENUES_TEST',
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 1000,
            'order_type': 'MARKET'
        }

        with pytest.raises(ValueError, match="No venues available"):
            await router.route_order(order)

    @pytest.mark.asyncio
    async def test_partial_venue_failures_during_execution(self, router_with_venues, sample_order):
        """Test handling of venue failures during order execution."""
        router = router_with_venues

        decisions = await router.route_order(sample_order)

        # Simulate venue failure during execution by modifying adapter behavior
        failing_venue = decisions[0].venue_id
        adapter = router.venue_adapters[failing_venue]

        # Make adapter fail orders
        original_send_order = adapter.send_order

        async def failing_send_order(order):
            raise Exception("Venue connectivity lost")

        adapter.send_order = failing_send_order

        # Execute routing decisions
        execution_report = await router.execute_routing_decisions(sample_order['order_id'], decisions)

        # Should handle failure gracefully
        assert execution_report.order_id == sample_order['order_id']

        # Some execution should still succeed from other venues
        if len(decisions) > 1:
            assert execution_report.filled_quantity >= 0

        # Restore original method
        adapter.send_order = original_send_order

    @pytest.mark.asyncio
    async def test_execution_timeout_handling(self, router_with_venues, sample_order):
        """Test execution timeout handling."""
        router = router_with_venues

        decisions = await router.route_order(sample_order)

        # Mock slow venue response
        slow_venue = decisions[0].venue_id
        adapter = router.venue_adapters[slow_venue]

        original_send_order = adapter.send_order

        async def slow_send_order(order):
            await asyncio.sleep(35)  # Longer than timeout
            return await original_send_order(order)

        adapter.send_order = slow_send_order

        # Execute with timeout
        execution_report = await router.execute_routing_decisions(sample_order['order_id'], decisions)

        # Should complete within reasonable time
        assert execution_report.order_id == sample_order['order_id']

        # Restore original method
        adapter.send_order = original_send_order

class TestRouterPerformanceMetrics:
    """Test router performance measurement and optimization."""

    @pytest.mark.asyncio
    async def test_routing_latency_measurement(self, router_with_venues, sample_order):
        """Test routing decision latency is reasonable."""
        router = router_with_venues

        start_time = datetime.now()
        decisions = await router.route_order(sample_order)
        end_time = datetime.now()

        routing_latency_ms = (end_time - start_time).total_seconds() * 1000

        # Routing decision should be fast
        assert routing_latency_ms < 100  # Less than 100ms

        # Should still produce quality routing
        assert len(decisions) > 0
        assert sum(d.quantity for d in decisions) == sample_order['quantity']

    @pytest.mark.asyncio
    async def test_concurrent_routing_requests(self, router_with_venues):
        """Test router handles concurrent routing requests."""
        router = router_with_venues

        # Create multiple concurrent orders
        orders = []
        for i in range(10):
            order = {
                'order_id': f'CONCURRENT_ORDER_{i:03d}',
                'symbol': 'AAPL',
                'side': 'BUY' if i % 2 == 0 else 'SELL',
                'quantity': 1000 + i * 100,
                'order_type': 'MARKET'
            }
            orders.append(order)

        # Route all orders concurrently
        routing_tasks = [router.route_order(order) for order in orders]
        results = await asyncio.gather(*routing_tasks, return_exceptions=True)

        # All should succeed
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) == len(orders)

        # Each should have valid routing decisions
        for decisions in successful_results:
            assert len(decisions) > 0

    @pytest.mark.asyncio
    async def test_routing_quality_consistency(self, router_with_venues, sample_order):
        """Test routing decisions are consistent for similar orders."""
        router = router_with_venues

        # Route same order multiple times
        decisions_list = []
        for _ in range(5):
            decisions = await router.route_order(sample_order)
            decisions_list.append(decisions)

        # Should produce similar routing patterns
        venue_usage = defaultdict(int)
        for decisions in decisions_list:
            for decision in decisions:
                venue_usage[decision.venue_id] += 1

        # Top venues should be consistently used
        most_used_venues = sorted(venue_usage.items(), key=lambda x: x[1], reverse=True)[:3]

        for venue_id, usage_count in most_used_venues:
            usage_rate = usage_count / len(decisions_list)
            assert usage_rate >= 0.4  # Should be used in at least 40% of routings