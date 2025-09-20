"""
Idempotency Key Handling

Prevents duplicate order submissions and ensures consistent
behavior for retried requests with proper state management.
"""

import hashlib
import json
import uuid
from typing import Dict, Any, Optional, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging
import asyncio

from ..models.brokerage_models import PlaceOrderRequest, PlaceOrderResponse

logger = logging.getLogger(__name__)


@dataclass
class IdempotencyRecord:
    """Record of an idempotent operation"""
    key: str
    request_hash: str
    response: Any
    created_at: datetime
    expires_at: datetime
    user_id: Optional[str] = None
    account_id: Optional[str] = None


class IdempotencyManager:
    """
    Manages idempotency keys for order operations

    Ensures that duplicate order submissions with the same
    idempotency key return the same response without
    creating duplicate orders.
    """

    def __init__(self, ttl_minutes: int = 1440):  # 24 hours default
        self.ttl_minutes = ttl_minutes
        self.records: Dict[str, IdempotencyRecord] = {}
        self._cleanup_interval = 60  # Cleanup every minute
        self._last_cleanup = datetime.utcnow()

    async def check_idempotency(
        self,
        key: str,
        request_data: Dict[str, Any],
        user_id: Optional[str] = None,
        account_id: Optional[str] = None
    ) -> Optional[Any]:
        """
        Check if request with idempotency key was already processed

        Args:
            key: Idempotency key
            request_data: Request data for hash comparison
            user_id: User ID for scoping
            account_id: Account ID for scoping

        Returns:
            Previous response if key exists and request matches, None otherwise
        """
        await self._cleanup_expired_records()

        # Create scoped key
        scoped_key = self._create_scoped_key(key, user_id, account_id)

        record = self.records.get(scoped_key)
        if not record:
            return None

        # Check if record is expired
        if datetime.utcnow() > record.expires_at:
            del self.records[scoped_key]
            return None

        # Verify request hash matches
        request_hash = self._create_request_hash(request_data)
        if record.request_hash != request_hash:
            logger.warning(f"Idempotency key {key} used with different request data")
            raise ValueError(f"Idempotency key {key} was used with different request data")

        logger.info(f"Returning cached response for idempotency key {key}")
        return record.response

    async def store_response(
        self,
        key: str,
        request_data: Dict[str, Any],
        response: Any,
        user_id: Optional[str] = None,
        account_id: Optional[str] = None
    ):
        """
        Store response for idempotency key

        Args:
            key: Idempotency key
            request_data: Request data for hash generation
            response: Response to store
            user_id: User ID for scoping
            account_id: Account ID for scoping
        """
        # Create scoped key
        scoped_key = self._create_scoped_key(key, user_id, account_id)

        # Create record
        record = IdempotencyRecord(
            key=scoped_key,
            request_hash=self._create_request_hash(request_data),
            response=response,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=self.ttl_minutes),
            user_id=user_id,
            account_id=account_id
        )

        self.records[scoped_key] = record
        logger.debug(f"Stored idempotency record for key {key}")

    def _create_scoped_key(
        self,
        key: str,
        user_id: Optional[str] = None,
        account_id: Optional[str] = None
    ) -> str:
        """Create scoped idempotency key"""
        components = [key]
        if user_id:
            components.append(f"user:{user_id}")
        if account_id:
            components.append(f"account:{account_id}")
        return ":".join(components)

    def _create_request_hash(self, request_data: Dict[str, Any]) -> str:
        """Create deterministic hash of request data"""
        # Sort keys for consistent hashing
        sorted_data = json.dumps(request_data, sort_keys=True, default=str)
        return hashlib.sha256(sorted_data.encode('utf-8')).hexdigest()

    async def _cleanup_expired_records(self):
        """Clean up expired idempotency records"""
        now = datetime.utcnow()

        # Only cleanup if enough time has passed
        if (now - self._last_cleanup).seconds < self._cleanup_interval:
            return

        expired_keys = [
            key for key, record in self.records.items()
            if now > record.expires_at
        ]

        for key in expired_keys:
            del self.records[key]

        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired idempotency records")

        self._last_cleanup = now

    def generate_key(self) -> str:
        """Generate a new idempotency key"""
        return str(uuid.uuid4())

    def get_stats(self) -> Dict[str, Any]:
        """Get idempotency statistics"""
        now = datetime.utcnow()
        active_records = sum(1 for record in self.records.values() if now <= record.expires_at)
        expired_records = len(self.records) - active_records

        return {
            "total_records": len(self.records),
            "active_records": active_records,
            "expired_records": expired_records,
            "ttl_minutes": self.ttl_minutes,
            "last_cleanup": self._last_cleanup.isoformat()
        }

    def clear_all_records(self):
        """Clear all idempotency records (for testing)"""
        self.records.clear()
        logger.debug("Cleared all idempotency records")


class IdempotentOrderProcessor:
    """
    Order processor with idempotency support

    Wraps order operations to provide idempotency guarantees
    and prevent duplicate order submissions.
    """

    def __init__(self, idempotency_manager: IdempotencyManager = None):
        self.idempotency_manager = idempotency_manager or IdempotencyManager()

    async def process_order_with_idempotency(
        self,
        request: PlaceOrderRequest,
        order_processor: callable,
        user_id: Optional[str] = None,
        idempotency_key: Optional[str] = None
    ) -> PlaceOrderResponse:
        """
        Process order with idempotency protection

        Args:
            request: Order placement request
            order_processor: Function to process the order
            user_id: User ID for scoping
            idempotency_key: Optional idempotency key

        Returns:
            PlaceOrderResponse
        """
        # Use provided key or generate from request
        if not idempotency_key:
            idempotency_key = request.order.client_order_id or self._generate_key_from_request(request)

        # Create request data for hashing
        request_data = self._serialize_request(request)

        try:
            # Check for existing response
            cached_response = await self.idempotency_manager.check_idempotency(
                key=idempotency_key,
                request_data=request_data,
                user_id=user_id,
                account_id=request.account_id
            )

            if cached_response:
                # Return cached response
                return self._deserialize_response(cached_response)

            # Process new request
            response = await order_processor(request)

            # Store response for future idempotency checks
            await self.idempotency_manager.store_response(
                key=idempotency_key,
                request_data=request_data,
                response=self._serialize_response(response),
                user_id=user_id,
                account_id=request.account_id
            )

            return response

        except Exception as e:
            logger.error(f"Error in idempotent order processing: {e}")
            raise

    def _generate_key_from_request(self, request: PlaceOrderRequest) -> str:
        """Generate idempotency key from request content"""
        key_data = {
            'symbol': request.order.symbol,
            'side': request.order.side.value,
            'quantity': str(request.order.quantity),
            'order_type': request.order.order_type.value,
            'account_id': request.account_id,
            'timestamp': datetime.utcnow().strftime('%Y%m%d%H%M%S')
        }

        # Include price information if available
        if request.order.limit_price:
            key_data['limit_price'] = str(request.order.limit_price)
        if request.order.stop_price:
            key_data['stop_price'] = str(request.order.stop_price)

        # Create hash of key data
        key_string = json.dumps(key_data, sort_keys=True)
        key_hash = hashlib.sha256(key_string.encode('utf-8')).hexdigest()

        return f"auto_{key_hash[:16]}"

    def _serialize_request(self, request: PlaceOrderRequest) -> Dict[str, Any]:
        """Serialize request for hashing"""
        return {
            'order': {
                'symbol': request.order.symbol,
                'side': request.order.side.value,
                'quantity': str(request.order.quantity),
                'order_type': request.order.order_type.value,
                'time_in_force': request.order.time_in_force.value,
                'limit_price': str(request.order.limit_price) if request.order.limit_price else None,
                'stop_price': str(request.order.stop_price) if request.order.stop_price else None,
                'trail_amount': str(request.order.trail_amount) if request.order.trail_amount else None,
                'trail_percent': str(request.order.trail_percent) if request.order.trail_percent else None,
                'extended_hours': request.order.extended_hours,
                'client_order_id': request.order.client_order_id
            },
            'account_id': request.account_id,
            'dry_run': request.dry_run
        }

    def _serialize_response(self, response: PlaceOrderResponse) -> Dict[str, Any]:
        """Serialize response for storage"""
        result = {
            'success': response.success,
            'error': response.error,
            'error_code': response.error_code,
            'broker_request_id': response.broker_request_id,
            'timestamp': response.timestamp.isoformat()
        }

        if response.order:
            result['order'] = {
                'order_id': response.order.order_id,
                'symbol': response.order.symbol,
                'side': response.order.side.value,
                'quantity': str(response.order.quantity),
                'order_type': response.order.order_type.value,
                'status': response.order.status.value,
                'client_order_id': response.order.client_order_id,
                'created_at': response.order.created_at.isoformat(),
                'broker_metadata': response.order.broker_metadata
            }

        return result

    def _deserialize_response(self, data: Dict[str, Any]) -> PlaceOrderResponse:
        """Deserialize stored response"""
        order = None
        if data.get('order'):
            order_data = data['order']
            # Create minimal order object for response
            # In production, you'd reconstruct the full Order object
            order = type('Order', (), {
                'order_id': order_data['order_id'],
                'symbol': order_data['symbol'],
                'status': order_data['status'],
                'client_order_id': order_data.get('client_order_id')
            })()

        return PlaceOrderResponse(
            success=data['success'],
            order=order,
            error=data.get('error'),
            error_code=data.get('error_code'),
            broker_request_id=data.get('broker_request_id'),
            timestamp=datetime.fromisoformat(data['timestamp'])
        )


# Global instances
default_idempotency_manager = IdempotencyManager()
default_idempotent_processor = IdempotentOrderProcessor(default_idempotency_manager)


def get_idempotency_manager() -> IdempotencyManager:
    """Get the default idempotency manager"""
    return default_idempotency_manager


def get_idempotent_processor() -> IdempotentOrderProcessor:
    """Get the default idempotent order processor"""
    return default_idempotent_processor


# Decorator for idempotent operations
def idempotent_operation(key_generator: Optional[callable] = None):
    """
    Decorator for making operations idempotent

    Args:
        key_generator: Function to generate idempotency key from arguments
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Extract idempotency key
            idempotency_key = kwargs.pop('idempotency_key', None)

            if key_generator and not idempotency_key:
                idempotency_key = key_generator(*args, **kwargs)

            if not idempotency_key:
                # No idempotency key provided, execute normally
                return await func(*args, **kwargs)

            # Create request hash from arguments
            request_data = {
                'function': func.__name__,
                'args': [str(arg) for arg in args],
                'kwargs': {k: str(v) for k, v in kwargs.items()}
            }

            # Check for cached result
            manager = get_idempotency_manager()
            cached_result = await manager.check_idempotency(
                key=idempotency_key,
                request_data=request_data
            )

            if cached_result:
                return cached_result

            # Execute function
            result = await func(*args, **kwargs)

            # Store result
            await manager.store_response(
                key=idempotency_key,
                request_data=request_data,
                response=result
            )

            return result

        return wrapper
    return decorator