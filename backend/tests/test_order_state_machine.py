"""
Unit Tests for Order State Machine

Tests order state transitions, validation, and event emission
to ensure proper order lifecycle management.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from app.core.order_state_machine import OrderStateMachine, OrderLifecycleManager
from app.models.brokerage_models import OrderStatus, OrderEvent


class TestOrderStateMachine:
    """Test order state machine functionality"""

    def setup_method(self):
        """Set up test fixtures"""
        self.state_machine = OrderStateMachine()
        self.events_received = []

        # Add event handler to capture events
        async def event_handler(event: OrderEvent):
            self.events_received.append(event)

        self.state_machine.add_event_handler(event_handler)

    @pytest.mark.asyncio
    async def test_valid_state_transition(self):
        """Test valid state transition"""
        order_id = "test_order_1"
        current_state = OrderStatus.PENDING
        new_state = OrderStatus.SUBMITTED

        # Perform transition
        success = await self.state_machine.transition(order_id, current_state, new_state)

        assert success is True
        assert len(self.events_received) == 1

        event = self.events_received[0]
        assert event.order_id == order_id
        assert event.old_status == current_state
        assert event.new_status == new_state
        assert event.event_type == "ORDER_SUBMITTED"

    @pytest.mark.asyncio
    async def test_invalid_state_transition(self):
        """Test invalid state transition"""
        order_id = "test_order_2"
        current_state = OrderStatus.FILLED
        new_state = OrderStatus.PENDING  # Cannot go from FILLED to PENDING

        # Attempt invalid transition
        success = await self.state_machine.transition(order_id, current_state, new_state)

        assert success is False
        assert len(self.events_received) == 0

    @pytest.mark.asyncio
    async def test_transition_with_condition(self):
        """Test transition with condition"""
        # Add conditional transition
        def condition(order_id, context):
            return context and context.get('allow_transition', False)

        self.state_machine.add_transition(
            OrderStatus.ACCEPTED,
            OrderStatus.FILLED,
            condition=condition,
            event_type="CONDITIONAL_FILL"
        )

        order_id = "test_order_3"

        # Test with condition failing
        success = await self.state_machine.transition(
            order_id,
            OrderStatus.ACCEPTED,
            OrderStatus.FILLED,
            context={'allow_transition': False}
        )
        assert success is False

        # Test with condition passing
        success = await self.state_machine.transition(
            order_id,
            OrderStatus.ACCEPTED,
            OrderStatus.FILLED,
            context={'allow_transition': True}
        )
        assert success is True
        assert len(self.events_received) == 1

    @pytest.mark.asyncio
    async def test_transition_with_actions(self):
        """Test transition with pre and post actions"""
        pre_action_called = False
        post_action_called = False

        async def pre_action(order_id, context):
            nonlocal pre_action_called
            pre_action_called = True

        async def post_action(order_id, context):
            nonlocal post_action_called
            post_action_called = True

        # Add transition with actions
        self.state_machine.add_transition(
            OrderStatus.SUBMITTED,
            OrderStatus.ACCEPTED,
            pre_action=pre_action,
            post_action=post_action,
            event_type="ACTION_TEST"
        )

        order_id = "test_order_4"
        success = await self.state_machine.transition(
            order_id,
            OrderStatus.SUBMITTED,
            OrderStatus.ACCEPTED
        )

        assert success is True
        assert pre_action_called is True
        assert post_action_called is True

    def test_get_valid_transitions(self):
        """Test getting valid transitions for a state"""
        valid_transitions = self.state_machine.get_valid_transitions(OrderStatus.PENDING)
        expected_states = [OrderStatus.SUBMITTED, OrderStatus.REJECTED, OrderStatus.CANCELED]

        assert set(valid_transitions) == set(expected_states)

    def test_is_terminal_state(self):
        """Test terminal state identification"""
        # Terminal states
        assert self.state_machine.is_terminal_state(OrderStatus.FILLED) is True
        assert self.state_machine.is_terminal_state(OrderStatus.CANCELED) is True
        assert self.state_machine.is_terminal_state(OrderStatus.REJECTED) is True
        assert self.state_machine.is_terminal_state(OrderStatus.EXPIRED) is True

        # Non-terminal states
        assert self.state_machine.is_terminal_state(OrderStatus.PENDING) is False
        assert self.state_machine.is_terminal_state(OrderStatus.SUBMITTED) is False
        assert self.state_machine.is_terminal_state(OrderStatus.ACCEPTED) is False
        assert self.state_machine.is_terminal_state(OrderStatus.PARTIALLY_FILLED) is False

    def test_validate_state_sequence(self):
        """Test state sequence validation"""
        # Valid sequence
        valid_sequence = [
            OrderStatus.PENDING,
            OrderStatus.SUBMITTED,
            OrderStatus.ACCEPTED,
            OrderStatus.PARTIALLY_FILLED,
            OrderStatus.FILLED
        ]
        assert self.state_machine.validate_state_sequence(valid_sequence) is True

        # Invalid sequence
        invalid_sequence = [
            OrderStatus.PENDING,
            OrderStatus.FILLED,  # Cannot go directly from PENDING to FILLED
            OrderStatus.CANCELED
        ]
        assert self.state_machine.validate_state_sequence(invalid_sequence) is False

        # Empty sequence (should be valid)
        assert self.state_machine.validate_state_sequence([]) is True


class TestOrderLifecycleManager:
    """Test order lifecycle manager functionality"""

    def setup_method(self):
        """Set up test fixtures"""
        self.state_machine = OrderStateMachine()
        self.lifecycle_manager = OrderLifecycleManager(self.state_machine)

    @pytest.mark.asyncio
    async def test_submit_order(self):
        """Test order submission"""
        order_id = "test_order_1"

        success = await self.lifecycle_manager.submit_order(order_id)

        assert success is True
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.SUBMITTED

    @pytest.mark.asyncio
    async def test_order_lifecycle(self):
        """Test complete order lifecycle"""
        order_id = "test_order_2"

        # Submit order
        success = await self.lifecycle_manager.submit_order(order_id)
        assert success is True
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.SUBMITTED

        # Accept order
        success = await self.lifecycle_manager.accept_order(order_id)
        assert success is True
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.ACCEPTED

        # Partially fill order
        success = await self.lifecycle_manager.fill_order(order_id, partial=True)
        assert success is True
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.PARTIALLY_FILLED

        # Complete fill
        success = await self.lifecycle_manager.complete_partial_fill(order_id)
        assert success is True
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.FILLED

    @pytest.mark.asyncio
    async def test_cancel_order(self):
        """Test order cancellation"""
        order_id = "test_order_3"

        # Set initial state
        self.lifecycle_manager.set_order_state(order_id, OrderStatus.ACCEPTED)

        # Cancel order
        success = await self.lifecycle_manager.cancel_order(order_id)
        assert success is True
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.CANCELED

    @pytest.mark.asyncio
    async def test_reject_order(self):
        """Test order rejection"""
        order_id = "test_order_4"
        rejection_reason = "Insufficient funds"

        # Set initial state
        self.lifecycle_manager.set_order_state(order_id, OrderStatus.SUBMITTED)

        # Reject order
        success = await self.lifecycle_manager.reject_order(order_id, rejection_reason)
        assert success is True
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.REJECTED

    @pytest.mark.asyncio
    async def test_invalid_cancellation(self):
        """Test invalid cancellation attempt"""
        order_id = "test_order_5"

        # Set to terminal state
        self.lifecycle_manager.set_order_state(order_id, OrderStatus.FILLED)

        # Attempt to cancel (should fail)
        success = await self.lifecycle_manager.cancel_order(order_id)
        assert success is False
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.FILLED

    def test_get_orders_by_state(self):
        """Test getting orders by state"""
        # Set up multiple orders
        self.lifecycle_manager.set_order_state("order_1", OrderStatus.PENDING)
        self.lifecycle_manager.set_order_state("order_2", OrderStatus.ACCEPTED)
        self.lifecycle_manager.set_order_state("order_3", OrderStatus.PENDING)
        self.lifecycle_manager.set_order_state("order_4", OrderStatus.FILLED)

        # Get pending orders
        pending_orders = self.lifecycle_manager.get_orders_by_state(OrderStatus.PENDING)
        assert set(pending_orders) == {"order_1", "order_3"}

        # Get accepted orders
        accepted_orders = self.lifecycle_manager.get_orders_by_state(OrderStatus.ACCEPTED)
        assert accepted_orders == ["order_2"]

    def test_get_active_and_terminal_orders(self):
        """Test getting active and terminal orders"""
        # Set up orders in various states
        self.lifecycle_manager.set_order_state("active_1", OrderStatus.PENDING)
        self.lifecycle_manager.set_order_state("active_2", OrderStatus.ACCEPTED)
        self.lifecycle_manager.set_order_state("active_3", OrderStatus.PARTIALLY_FILLED)
        self.lifecycle_manager.set_order_state("terminal_1", OrderStatus.FILLED)
        self.lifecycle_manager.set_order_state("terminal_2", OrderStatus.CANCELED)

        # Get active orders
        active_orders = self.lifecycle_manager.get_active_orders()
        assert set(active_orders) == {"active_1", "active_2", "active_3"}

        # Get terminal orders
        terminal_orders = self.lifecycle_manager.get_terminal_orders()
        assert set(terminal_orders) == {"terminal_1", "terminal_2"}

    def test_remove_order(self):
        """Test removing order from tracking"""
        order_id = "test_order_remove"
        self.lifecycle_manager.set_order_state(order_id, OrderStatus.FILLED)

        # Verify order exists
        assert self.lifecycle_manager.get_order_state(order_id) == OrderStatus.FILLED

        # Remove order
        self.lifecycle_manager.remove_order(order_id)

        # Verify order is removed
        assert self.lifecycle_manager.get_order_state(order_id) is None


class TestOrderStateMachineIntegration:
    """Integration tests for order state machine"""

    @pytest.mark.asyncio
    async def test_concurrent_transitions(self):
        """Test concurrent state transitions"""
        state_machine = OrderStateMachine()
        lifecycle_manager = OrderLifecycleManager(state_machine)

        # Create multiple orders
        order_ids = [f"concurrent_order_{i}" for i in range(10)]

        # Submit all orders concurrently
        tasks = [lifecycle_manager.submit_order(order_id) for order_id in order_ids]
        results = await asyncio.gather(*tasks)

        # Verify all submissions succeeded
        assert all(results)

        # Verify all orders are in submitted state
        for order_id in order_ids:
            assert lifecycle_manager.get_order_state(order_id) == OrderStatus.SUBMITTED

    @pytest.mark.asyncio
    async def test_event_handler_error_handling(self):
        """Test that event handler errors don't break transitions"""
        state_machine = OrderStateMachine()

        # Add faulty event handler
        async def faulty_handler(event):
            raise Exception("Handler error")

        state_machine.add_event_handler(faulty_handler)

        # Transition should still succeed despite handler error
        success = await state_machine.transition(
            "test_order",
            OrderStatus.PENDING,
            OrderStatus.SUBMITTED
        )

        assert success is True

    @pytest.mark.asyncio
    async def test_complex_workflow(self):
        """Test complex order workflow with multiple state changes"""
        state_machine = OrderStateMachine()
        lifecycle_manager = OrderLifecycleManager(state_machine)

        order_id = "complex_workflow_order"

        # Complete workflow: submit -> accept -> partial fill -> cancel
        success1 = await lifecycle_manager.submit_order(order_id)
        success2 = await lifecycle_manager.accept_order(order_id)
        success3 = await lifecycle_manager.fill_order(order_id, partial=True)
        success4 = await lifecycle_manager.cancel_order(order_id)

        assert all([success1, success2, success3, success4])
        assert lifecycle_manager.get_order_state(order_id) == OrderStatus.CANCELED


if __name__ == "__main__":
    pytest.main([__file__])