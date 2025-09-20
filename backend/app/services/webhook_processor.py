"""
Webhook Processing Service

Handles incoming webhooks from brokers for real-time order updates,
fills, and account changes with proper validation and processing.
"""

import json
import hmac
import hashlib
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime
import logging
import asyncio
from fastapi import HTTPException

from ..models.brokerage_models import (
    WebhookPayload, OrderEvent, BrokerType, OrderStatus, OrderSide,
    Order, Fill, Position, Account
)
from ..core.order_state_machine import get_default_lifecycle_manager
from ..core.broker_adapter import BrokerAdapterFactory

logger = logging.getLogger(__name__)


class WebhookProcessor:
    """
    Webhook processor for broker notifications

    Handles incoming webhook payloads from various brokers
    with signature verification, payload validation, and
    automated order state management.
    """

    def __init__(self):
        self.webhook_secrets: Dict[BrokerType, str] = {}
        self.event_handlers: Dict[str, List[Callable]] = {}
        self.order_manager = get_default_lifecycle_manager()
        self.processed_webhooks: set = set()  # For duplicate detection

    def set_webhook_secret(self, broker_type: BrokerType, secret: str):
        """Set webhook secret for broker"""
        self.webhook_secrets[broker_type] = secret

    def add_event_handler(self, event_type: str, handler: Callable):
        """Add event handler for specific webhook events"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)

    async def process_webhook(
        self,
        broker_type: BrokerType,
        payload: Dict[str, Any],
        signature: Optional[str] = None,
        raw_body: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """
        Process incoming webhook payload

        Args:
            broker_type: Broker that sent the webhook
            payload: Webhook payload data
            signature: Webhook signature for verification
            raw_body: Raw request body for signature verification

        Returns:
            Dict with processing result
        """
        try:
            # Create webhook payload object
            webhook = WebhookPayload(
                broker_type=broker_type,
                event_type=payload.get('event_type', 'unknown'),
                account_id=payload.get('account_id', ''),
                data=payload.get('data', {}),
                signature=signature
            )

            # Verify webhook signature
            if not await self._verify_signature(webhook, raw_body):
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

            # Check for duplicate webhook
            if await self._is_duplicate_webhook(webhook):
                logger.warning(f"Duplicate webhook received: {webhook.webhook_id}")
                return {"status": "duplicate", "webhook_id": webhook.webhook_id}

            # Process webhook based on event type
            result = await self._process_webhook_event(webhook)

            # Mark webhook as processed
            self.processed_webhooks.add(webhook.webhook_id)

            # Emit events to handlers
            await self._emit_webhook_event(webhook, result)

            logger.info(f"Successfully processed webhook {webhook.webhook_id} for {broker_type}")
            return {"status": "success", "webhook_id": webhook.webhook_id, "result": result}

        except Exception as e:
            logger.error(f"Error processing webhook: {e}")
            raise HTTPException(status_code=500, detail=f"Webhook processing failed: {e}")

    async def _verify_signature(self, webhook: WebhookPayload, raw_body: Optional[bytes]) -> bool:
        """Verify webhook signature"""
        try:
            if not webhook.signature or not raw_body:
                # Allow unsigned webhooks for development/testing
                if webhook.broker_type == BrokerType.PAPER:
                    return True
                return False

            secret = self.webhook_secrets.get(webhook.broker_type)
            if not secret:
                logger.warning(f"No webhook secret configured for {webhook.broker_type}")
                return False

            # Verify signature based on broker type
            return await self._verify_broker_signature(webhook.broker_type, webhook.signature, raw_body, secret)

        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False

    async def _verify_broker_signature(
        self,
        broker_type: BrokerType,
        signature: str,
        raw_body: bytes,
        secret: str
    ) -> bool:
        """Verify signature for specific broker"""
        try:
            if broker_type == BrokerType.ALPACA:
                # Alpaca uses HMAC-SHA256
                expected_signature = hmac.new(
                    secret.encode('utf-8'),
                    raw_body,
                    hashlib.sha256
                ).hexdigest()
                return hmac.compare_digest(signature, expected_signature)

            elif broker_type == BrokerType.INTERACTIVE_BROKERS:
                # IB custom signature scheme (implementation depends on IB documentation)
                # This is a placeholder - implement according to IB specs
                return True

            elif broker_type == BrokerType.PAPER:
                # Paper trading - allow all signatures for testing
                return True

            else:
                logger.warning(f"Unknown broker type for signature verification: {broker_type}")
                return False

        except Exception as e:
            logger.error(f"Error verifying {broker_type} signature: {e}")
            return False

    async def _is_duplicate_webhook(self, webhook: WebhookPayload) -> bool:
        """Check if webhook is duplicate"""
        return webhook.webhook_id in self.processed_webhooks

    async def _process_webhook_event(self, webhook: WebhookPayload) -> Dict[str, Any]:
        """Process webhook event based on type"""
        event_type = webhook.event_type.lower()

        if event_type in ['order_filled', 'order_partially_filled']:
            return await self._process_fill_event(webhook)
        elif event_type in ['order_cancelled', 'order_canceled']:
            return await self._process_cancel_event(webhook)
        elif event_type in ['order_rejected']:
            return await self._process_rejection_event(webhook)
        elif event_type in ['order_accepted', 'order_submitted']:
            return await self._process_order_update_event(webhook)
        elif event_type in ['account_update']:
            return await self._process_account_update_event(webhook)
        elif event_type in ['position_update']:
            return await self._process_position_update_event(webhook)
        else:
            logger.warning(f"Unknown webhook event type: {event_type}")
            return {"status": "unknown_event", "event_type": event_type}

    async def _process_fill_event(self, webhook: WebhookPayload) -> Dict[str, Any]:
        """Process order fill webhook"""
        try:
            data = webhook.data
            order_id = data.get('order_id')
            fill_data = data.get('fill', {})

            if not order_id:
                raise ValueError("Missing order_id in fill webhook")

            # Extract fill information
            fill_quantity = float(fill_data.get('quantity', 0))
            fill_price = float(fill_data.get('price', 0))
            total_filled = float(data.get('cumulative_filled_quantity', fill_quantity))
            total_quantity = float(data.get('total_quantity', 0))

            # Determine if order is fully filled
            is_fully_filled = total_filled >= total_quantity

            # Update order state
            context = {
                'fill_quantity': fill_quantity,
                'fill_price': fill_price,
                'total_filled': total_filled,
                'webhook_data': data
            }

            if is_fully_filled:
                success = await self.order_manager.complete_partial_fill(order_id, context)
                if not success:
                    success = await self.order_manager.fill_order(order_id, partial=False, context=context)
            else:
                success = await self.order_manager.fill_order(order_id, partial=True, context=context)

            return {
                "status": "processed",
                "order_id": order_id,
                "state_updated": success,
                "fill_type": "full" if is_fully_filled else "partial"
            }

        except Exception as e:
            logger.error(f"Error processing fill event: {e}")
            return {"status": "error", "error": str(e)}

    async def _process_cancel_event(self, webhook: WebhookPayload) -> Dict[str, Any]:
        """Process order cancellation webhook"""
        try:
            data = webhook.data
            order_id = data.get('order_id')

            if not order_id:
                raise ValueError("Missing order_id in cancel webhook")

            # Update order state
            context = {
                'cancellation_reason': data.get('reason', 'User cancelled'),
                'webhook_data': data
            }

            success = await self.order_manager.cancel_order(order_id, context)

            return {
                "status": "processed",
                "order_id": order_id,
                "state_updated": success
            }

        except Exception as e:
            logger.error(f"Error processing cancel event: {e}")
            return {"status": "error", "error": str(e)}

    async def _process_rejection_event(self, webhook: WebhookPayload) -> Dict[str, Any]:
        """Process order rejection webhook"""
        try:
            data = webhook.data
            order_id = data.get('order_id')
            rejection_reason = data.get('reason', 'Order rejected by broker')

            if not order_id:
                raise ValueError("Missing order_id in rejection webhook")

            # Update order state
            success = await self.order_manager.reject_order(order_id, rejection_reason)

            return {
                "status": "processed",
                "order_id": order_id,
                "state_updated": success,
                "rejection_reason": rejection_reason
            }

        except Exception as e:
            logger.error(f"Error processing rejection event: {e}")
            return {"status": "error", "error": str(e)}

    async def _process_order_update_event(self, webhook: WebhookPayload) -> Dict[str, Any]:
        """Process general order update webhook"""
        try:
            data = webhook.data
            order_id = data.get('order_id')
            new_status = data.get('status')

            if not order_id or not new_status:
                raise ValueError("Missing order_id or status in update webhook")

            # Map broker status to our status
            mapped_status = self._map_broker_status(webhook.broker_type, new_status)
            if not mapped_status:
                logger.warning(f"Unknown status {new_status} from {webhook.broker_type}")
                return {"status": "unknown_status", "broker_status": new_status}

            # Update order state based on new status
            context = {"webhook_data": data}
            success = False

            if mapped_status == OrderStatus.SUBMITTED:
                success = await self.order_manager.submit_order(order_id, context)
            elif mapped_status == OrderStatus.ACCEPTED:
                success = await self.order_manager.accept_order(order_id, context)

            return {
                "status": "processed",
                "order_id": order_id,
                "new_status": mapped_status.value,
                "state_updated": success
            }

        except Exception as e:
            logger.error(f"Error processing order update event: {e}")
            return {"status": "error", "error": str(e)}

    async def _process_account_update_event(self, webhook: WebhookPayload) -> Dict[str, Any]:
        """Process account update webhook"""
        try:
            data = webhook.data
            account_id = data.get('account_id', webhook.account_id)

            # Process account updates (balance changes, margin updates, etc.)
            # This would typically update cached account information

            logger.info(f"Account update received for {account_id}")

            return {
                "status": "processed",
                "account_id": account_id,
                "update_type": "account"
            }

        except Exception as e:
            logger.error(f"Error processing account update event: {e}")
            return {"status": "error", "error": str(e)}

    async def _process_position_update_event(self, webhook: WebhookPayload) -> Dict[str, Any]:
        """Process position update webhook"""
        try:
            data = webhook.data
            symbol = data.get('symbol')
            account_id = data.get('account_id', webhook.account_id)

            # Process position updates (quantity changes, P&L updates, etc.)
            # This would typically update cached position information

            logger.info(f"Position update received for {symbol} in account {account_id}")

            return {
                "status": "processed",
                "symbol": symbol,
                "account_id": account_id,
                "update_type": "position"
            }

        except Exception as e:
            logger.error(f"Error processing position update event: {e}")
            return {"status": "error", "error": str(e)}

    def _map_broker_status(self, broker_type: BrokerType, broker_status: str) -> Optional[OrderStatus]:
        """Map broker-specific status to our OrderStatus"""
        if broker_type == BrokerType.ALPACA:
            mapping = {
                'new': OrderStatus.SUBMITTED,
                'accepted': OrderStatus.ACCEPTED,
                'partial_fill': OrderStatus.PARTIALLY_FILLED,
                'filled': OrderStatus.FILLED,
                'canceled': OrderStatus.CANCELED,
                'rejected': OrderStatus.REJECTED,
                'done_for_day': OrderStatus.EXPIRED
            }
            return mapping.get(broker_status.lower())

        elif broker_type == BrokerType.INTERACTIVE_BROKERS:
            mapping = {
                'submitted': OrderStatus.SUBMITTED,
                'presubmitted': OrderStatus.SUBMITTED,
                'pendingsubmit': OrderStatus.PENDING,
                'filled': OrderStatus.FILLED,
                'cancelled': OrderStatus.CANCELED,
                'inactive': OrderStatus.REJECTED
            }
            return mapping.get(broker_status.lower())

        elif broker_type == BrokerType.PAPER:
            # Paper trading uses our native statuses
            try:
                return OrderStatus(broker_status.lower())
            except ValueError:
                return None

        return None

    async def _emit_webhook_event(self, webhook: WebhookPayload, result: Dict[str, Any]):
        """Emit webhook event to registered handlers"""
        handlers = self.event_handlers.get(webhook.event_type, [])
        handlers.extend(self.event_handlers.get('*', []))  # Global handlers

        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(webhook, result)
                else:
                    handler(webhook, result)
            except Exception as e:
                logger.error(f"Error in webhook event handler: {e}")

    async def get_webhook_stats(self) -> Dict[str, Any]:
        """Get webhook processing statistics"""
        return {
            "total_processed": len(self.processed_webhooks),
            "configured_secrets": len(self.webhook_secrets),
            "event_handlers": {event: len(handlers) for event, handlers in self.event_handlers.items()},
            "last_processed": max(self.processed_webhooks) if self.processed_webhooks else None
        }

    def clear_processed_webhooks(self, before_timestamp: Optional[datetime] = None):
        """Clear processed webhook IDs (for cleanup)"""
        # In production, this would clean up based on timestamp
        # For now, just clear all
        if before_timestamp is None:
            self.processed_webhooks.clear()
        else:
            # Would need to store timestamps with webhook IDs for this
            pass


# Global webhook processor instance
default_webhook_processor = WebhookProcessor()


def get_webhook_processor() -> WebhookProcessor:
    """Get the default webhook processor"""
    return default_webhook_processor


# Convenience functions for webhook processing
async def process_alpaca_webhook(payload: Dict[str, Any], signature: str, raw_body: bytes) -> Dict[str, Any]:
    """Process Alpaca webhook"""
    return await default_webhook_processor.process_webhook(
        BrokerType.ALPACA, payload, signature, raw_body
    )


async def process_ib_webhook(payload: Dict[str, Any], signature: str = None, raw_body: bytes = None) -> Dict[str, Any]:
    """Process Interactive Brokers webhook"""
    return await default_webhook_processor.process_webhook(
        BrokerType.INTERACTIVE_BROKERS, payload, signature, raw_body
    )


async def process_paper_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Process paper trading webhook"""
    return await default_webhook_processor.process_webhook(
        BrokerType.PAPER, payload
    )