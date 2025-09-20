"""
Order State Machine

Manages order lifecycle and state transitions with validation
and event emission for comprehensive order tracking.
"""

from enum import Enum
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime
import logging
import asyncio

from ..models.brokerage_models import OrderStatus, OrderEvent

logger = logging.getLogger(__name__)


class OrderTransition:
    """Represents a state transition with conditions and actions"""

    def __init__(
        self,
        from_state: OrderStatus,
        to_state: OrderStatus,
        condition: Optional[Callable] = None,
        pre_action: Optional[Callable] = None,
        post_action: Optional[Callable] = None,
        event_type: Optional[str] = None
    ):
        self.from_state = from_state
        self.to_state = to_state
        self.condition = condition
        self.pre_action = pre_action
        self.post_action = post_action
        self.event_type = event_type or f"{from_state.value}_to_{to_state.value}"


class OrderStateMachine:
    """
    Order state machine for managing order lifecycle

    Handles state transitions, validation, and event emission
    with support for conditional transitions and custom actions.
    """

    def __init__(self):
        self.transitions: Dict[OrderStatus, List[OrderTransition]] = {}
        self.event_handlers: List[Callable] = []
        self._setup_default_transitions()

    def _setup_default_transitions(self):
        """Set up default order state transitions"""

        # From PENDING
        self.add_transition(OrderStatus.PENDING, OrderStatus.SUBMITTED, event_type="ORDER_SUBMITTED")
        self.add_transition(OrderStatus.PENDING, OrderStatus.REJECTED, event_type="ORDER_REJECTED")
        self.add_transition(OrderStatus.PENDING, OrderStatus.CANCELED, event_type="ORDER_CANCELED")

        # From SUBMITTED
        self.add_transition(OrderStatus.SUBMITTED, OrderStatus.ACCEPTED, event_type="ORDER_ACCEPTED")
        self.add_transition(OrderStatus.SUBMITTED, OrderStatus.REJECTED, event_type="ORDER_REJECTED")
        self.add_transition(OrderStatus.SUBMITTED, OrderStatus.CANCELED, event_type="ORDER_CANCELED")

        # From ACCEPTED
        self.add_transition(OrderStatus.ACCEPTED, OrderStatus.PARTIALLY_FILLED, event_type="ORDER_PARTIALLY_FILLED")
        self.add_transition(OrderStatus.ACCEPTED, OrderStatus.FILLED, event_type="ORDER_FILLED")
        self.add_transition(OrderStatus.ACCEPTED, OrderStatus.CANCELED, event_type="ORDER_CANCELED")
        self.add_transition(OrderStatus.ACCEPTED, OrderStatus.REJECTED, event_type="ORDER_REJECTED")
        self.add_transition(OrderStatus.ACCEPTED, OrderStatus.EXPIRED, event_type="ORDER_EXPIRED")

        # From PARTIALLY_FILLED
        self.add_transition(OrderStatus.PARTIALLY_FILLED, OrderStatus.FILLED, event_type="ORDER_FILLED")
        self.add_transition(OrderStatus.PARTIALLY_FILLED, OrderStatus.CANCELED, event_type="ORDER_CANCELED")
        self.add_transition(OrderStatus.PARTIALLY_FILLED, OrderStatus.EXPIRED, event_type="ORDER_EXPIRED")

        # Terminal states (no transitions out)
        # FILLED, CANCELED, REJECTED, EXPIRED

    def add_transition(
        self,
        from_state: OrderStatus,
        to_state: OrderStatus,
        condition: Optional[Callable] = None,
        pre_action: Optional[Callable] = None,
        post_action: Optional[Callable] = None,
        event_type: Optional[str] = None
    ):
        """Add a state transition"""
        transition = OrderTransition(
            from_state=from_state,
            to_state=to_state,
            condition=condition,
            pre_action=pre_action,
            post_action=post_action,
            event_type=event_type
        )

        if from_state not in self.transitions:
            self.transitions[from_state] = []

        self.transitions[from_state].append(transition)

    def add_event_handler(self, handler: Callable):
        """Add event handler for state changes"""
        self.event_handlers.append(handler)

    async def transition(
        self,
        order_id: str,
        current_state: OrderStatus,
        new_state: OrderStatus,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Attempt to transition order state

        Args:
            order_id: Order identifier
            current_state: Current order state
            new_state: Desired new state
            context: Additional context for transition

        Returns:
            bool: True if transition successful, False otherwise
        """
        try:
            # Find valid transition
            transition = self._find_transition(current_state, new_state)
            if not transition:
                logger.warning(f"Invalid transition from {current_state} to {new_state} for order {order_id}")
                return False

            # Check condition if present
            if transition.condition and not await self._execute_condition(transition.condition, order_id, context):
                logger.warning(f"Transition condition failed for order {order_id}: {current_state} -> {new_state}")
                return False

            # Execute pre-action if present
            if transition.pre_action:
                await self._execute_action(transition.pre_action, order_id, context)

            # Log transition
            logger.info(f"Order {order_id} transitioning: {current_state} -> {new_state}")

            # Create and emit event
            event = OrderEvent(
                order_id=order_id,
                event_type=transition.event_type,
                old_status=current_state,
                new_status=new_state,
                timestamp=datetime.utcnow(),
                metadata=context or {}
            )

            await self._emit_event(event)

            # Execute post-action if present
            if transition.post_action:
                await self._execute_action(transition.post_action, order_id, context)

            return True

        except Exception as e:
            logger.error(f"Error transitioning order {order_id}: {e}")
            return False

    def _find_transition(self, from_state: OrderStatus, to_state: OrderStatus) -> Optional[OrderTransition]:
        """Find valid transition between states"""
        transitions = self.transitions.get(from_state, [])
        for transition in transitions:
            if transition.to_state == to_state:
                return transition
        return None

    async def _execute_condition(self, condition: Callable, order_id: str, context: Optional[Dict]) -> bool:
        """Execute transition condition"""
        try:
            if asyncio.iscoroutinefunction(condition):
                return await condition(order_id, context)
            else:
                return condition(order_id, context)
        except Exception as e:
            logger.error(f"Error executing condition for order {order_id}: {e}")
            return False

    async def _execute_action(self, action: Callable, order_id: str, context: Optional[Dict]):
        """Execute transition action"""
        try:
            if asyncio.iscoroutinefunction(action):
                await action(order_id, context)
            else:
                action(order_id, context)
        except Exception as e:
            logger.error(f"Error executing action for order {order_id}: {e}")

    async def _emit_event(self, event: OrderEvent):
        """Emit state change event to all handlers"""
        for handler in self.event_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                logger.error(f"Error in event handler: {e}")

    def get_valid_transitions(self, current_state: OrderStatus) -> List[OrderStatus]:
        """Get list of valid states that can be transitioned to"""
        transitions = self.transitions.get(current_state, [])
        return [t.to_state for t in transitions]

    def is_terminal_state(self, state: OrderStatus) -> bool:
        """Check if state is terminal (no transitions out)"""
        return state not in self.transitions or len(self.transitions[state]) == 0

    def validate_state_sequence(self, states: List[OrderStatus]) -> bool:
        """Validate a sequence of state transitions"""
        if not states:
            return True

        for i in range(len(states) - 1):
            current_state = states[i]
            next_state = states[i + 1]

            if not self._find_transition(current_state, next_state):
                return False

        return True


class OrderLifecycleManager:
    """
    High-level order lifecycle management

    Provides convenience methods for common order operations
    with state machine integration.
    """

    def __init__(self, state_machine: OrderStateMachine):
        self.state_machine = state_machine
        self.order_states: Dict[str, OrderStatus] = {}

    async def submit_order(self, order_id: str, context: Optional[Dict] = None) -> bool:
        """Submit order (PENDING -> SUBMITTED)"""
        current_state = self.order_states.get(order_id, OrderStatus.PENDING)
        success = await self.state_machine.transition(
            order_id, current_state, OrderStatus.SUBMITTED, context
        )
        if success:
            self.order_states[order_id] = OrderStatus.SUBMITTED
        return success

    async def accept_order(self, order_id: str, context: Optional[Dict] = None) -> bool:
        """Accept order (SUBMITTED -> ACCEPTED)"""
        current_state = self.order_states.get(order_id, OrderStatus.PENDING)
        success = await self.state_machine.transition(
            order_id, current_state, OrderStatus.ACCEPTED, context
        )
        if success:
            self.order_states[order_id] = OrderStatus.ACCEPTED
        return success

    async def fill_order(self, order_id: str, partial: bool = False, context: Optional[Dict] = None) -> bool:
        """Fill order (ACCEPTED -> PARTIALLY_FILLED or FILLED)"""
        current_state = self.order_states.get(order_id, OrderStatus.PENDING)
        new_state = OrderStatus.PARTIALLY_FILLED if partial else OrderStatus.FILLED

        success = await self.state_machine.transition(
            order_id, current_state, new_state, context
        )
        if success:
            self.order_states[order_id] = new_state
        return success

    async def complete_partial_fill(self, order_id: str, context: Optional[Dict] = None) -> bool:
        """Complete partial fill (PARTIALLY_FILLED -> FILLED)"""
        current_state = self.order_states.get(order_id, OrderStatus.PENDING)
        success = await self.state_machine.transition(
            order_id, current_state, OrderStatus.FILLED, context
        )
        if success:
            self.order_states[order_id] = OrderStatus.FILLED
        return success

    async def cancel_order(self, order_id: str, context: Optional[Dict] = None) -> bool:
        """Cancel order (any cancellable state -> CANCELED)"""
        current_state = self.order_states.get(order_id, OrderStatus.PENDING)

        # Check if cancellation is possible from current state
        valid_transitions = self.state_machine.get_valid_transitions(current_state)
        if OrderStatus.CANCELED not in valid_transitions:
            logger.warning(f"Cannot cancel order {order_id} in state {current_state}")
            return False

        success = await self.state_machine.transition(
            order_id, current_state, OrderStatus.CANCELED, context
        )
        if success:
            self.order_states[order_id] = OrderStatus.CANCELED
        return success

    async def reject_order(self, order_id: str, reason: str = None, context: Optional[Dict] = None) -> bool:
        """Reject order (any rejectable state -> REJECTED)"""
        current_state = self.order_states.get(order_id, OrderStatus.PENDING)

        # Add rejection reason to context
        if context is None:
            context = {}
        if reason:
            context['rejection_reason'] = reason

        # Check if rejection is possible from current state
        valid_transitions = self.state_machine.get_valid_transitions(current_state)
        if OrderStatus.REJECTED not in valid_transitions:
            logger.warning(f"Cannot reject order {order_id} in state {current_state}")
            return False

        success = await self.state_machine.transition(
            order_id, current_state, OrderStatus.REJECTED, context
        )
        if success:
            self.order_states[order_id] = OrderStatus.REJECTED
        return success

    async def expire_order(self, order_id: str, context: Optional[Dict] = None) -> bool:
        """Expire order (ACCEPTED or PARTIALLY_FILLED -> EXPIRED)"""
        current_state = self.order_states.get(order_id, OrderStatus.PENDING)

        # Check if expiration is possible from current state
        valid_transitions = self.state_machine.get_valid_transitions(current_state)
        if OrderStatus.EXPIRED not in valid_transitions:
            logger.warning(f"Cannot expire order {order_id} in state {current_state}")
            return False

        success = await self.state_machine.transition(
            order_id, current_state, OrderStatus.EXPIRED, context
        )
        if success:
            self.order_states[order_id] = OrderStatus.EXPIRED
        return success

    def get_order_state(self, order_id: str) -> Optional[OrderStatus]:
        """Get current order state"""
        return self.order_states.get(order_id)

    def set_order_state(self, order_id: str, state: OrderStatus):
        """Set order state (for initialization)"""
        self.order_states[order_id] = state

    def remove_order(self, order_id: str):
        """Remove order from tracking"""
        self.order_states.pop(order_id, None)

    def get_orders_by_state(self, state: OrderStatus) -> List[str]:
        """Get all order IDs in a specific state"""
        return [order_id for order_id, order_state in self.order_states.items() if order_state == state]

    def get_active_orders(self) -> List[str]:
        """Get all active (non-terminal) order IDs"""
        active_states = [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.ACCEPTED, OrderStatus.PARTIALLY_FILLED]
        return [order_id for order_id, state in self.order_states.items() if state in active_states]

    def get_terminal_orders(self) -> List[str]:
        """Get all terminal order IDs"""
        terminal_states = [OrderStatus.FILLED, OrderStatus.CANCELED, OrderStatus.REJECTED, OrderStatus.EXPIRED]
        return [order_id for order_id, state in self.order_states.items() if state in terminal_states]


# Global state machine instance
default_state_machine = OrderStateMachine()
default_lifecycle_manager = OrderLifecycleManager(default_state_machine)


def get_default_state_machine() -> OrderStateMachine:
    """Get the default order state machine"""
    return default_state_machine


def get_default_lifecycle_manager() -> OrderLifecycleManager:
    """Get the default lifecycle manager"""
    return default_lifecycle_manager