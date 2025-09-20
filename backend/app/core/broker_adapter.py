"""
Broker Adapter Interface and Base Classes

Defines the abstract interface for broker integrations with common
functionality and standardized contract for all broker implementations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, AsyncIterator
from decimal import Decimal
import asyncio
import logging
from datetime import datetime, timedelta

from ..models.brokerage_models import (
    Order, OrderRequest, OrderUpdate, Position, Account, Fill,
    OrderStatus, BrokerConfig, BrokerResponse, StreamingQuote,
    PlaceOrderRequest, PlaceOrderResponse, CancelOrderRequest, CancelOrderResponse,
    ModifyOrderRequest, ModifyOrderResponse, GetPositionsRequest, GetPositionsResponse,
    GetAccountRequest, GetAccountResponse, GetOrdersRequest, GetOrdersResponse,
    GetOrderRequest, GetOrderResponse, WebhookPayload, OrderEvent
)

logger = logging.getLogger(__name__)


class BrokerError(Exception):
    """Base broker exception"""
    def __init__(self, message: str, error_code: str = None, broker_data: Dict[str, Any] = None):
        super().__init__(message)
        self.error_code = error_code
        self.broker_data = broker_data or {}


class BrokerConnectionError(BrokerError):
    """Broker connection error"""
    pass


class BrokerAuthenticationError(BrokerError):
    """Broker authentication error"""
    pass


class BrokerValidationError(BrokerError):
    """Broker validation error"""
    pass


class BrokerRateLimitError(BrokerError):
    """Broker rate limit error"""
    pass


class OrderNotFoundError(BrokerError):
    """Order not found error"""
    pass


class InsufficientFundsError(BrokerError):
    """Insufficient funds error"""
    pass


class BrokerAdapter(ABC):
    """
    Abstract broker adapter interface

    Defines the contract that all broker implementations must follow.
    Provides standardized methods for order management, position tracking,
    account information, and real-time data streaming.
    """

    def __init__(self, config: BrokerConfig):
        self.config = config
        self.is_connected = False
        self.last_heartbeat = None
        self._order_cache: Dict[str, Order] = {}
        self._position_cache: Dict[str, Position] = {}
        self._account_cache: Optional[Account] = None
        self._cache_ttl = timedelta(seconds=30)

    # Connection Management

    @abstractmethod
    async def connect(self) -> bool:
        """
        Establish connection to broker

        Returns:
            bool: True if connection successful

        Raises:
            BrokerConnectionError: If connection fails
        """
        pass

    @abstractmethod
    async def disconnect(self) -> bool:
        """
        Disconnect from broker

        Returns:
            bool: True if disconnection successful
        """
        pass

    @abstractmethod
    async def is_market_open(self) -> bool:
        """
        Check if market is currently open

        Returns:
            bool: True if market is open
        """
        pass

    async def heartbeat(self) -> bool:
        """
        Send heartbeat to maintain connection

        Returns:
            bool: True if heartbeat successful
        """
        try:
            # Default implementation - subclasses can override
            self.last_heartbeat = datetime.utcnow()
            return self.is_connected
        except Exception as e:
            logger.error(f"Heartbeat failed: {e}")
            return False

    # Order Management

    @abstractmethod
    async def place_order(self, request: PlaceOrderRequest) -> PlaceOrderResponse:
        """
        Place a new order

        Args:
            request: Order placement request

        Returns:
            PlaceOrderResponse: Order placement result

        Raises:
            BrokerValidationError: If order validation fails
            InsufficientFundsError: If insufficient funds
            BrokerError: For other broker-specific errors
        """
        pass

    @abstractmethod
    async def cancel_order(self, request: CancelOrderRequest) -> CancelOrderResponse:
        """
        Cancel an existing order

        Args:
            request: Order cancellation request

        Returns:
            CancelOrderResponse: Cancellation result

        Raises:
            OrderNotFoundError: If order not found
            BrokerError: For other broker-specific errors
        """
        pass

    @abstractmethod
    async def modify_order(self, request: ModifyOrderRequest) -> ModifyOrderResponse:
        """
        Modify an existing order

        Args:
            request: Order modification request

        Returns:
            ModifyOrderResponse: Modification result

        Raises:
            OrderNotFoundError: If order not found
            BrokerValidationError: If modification invalid
            BrokerError: For other broker-specific errors
        """
        pass

    @abstractmethod
    async def get_order(self, request: GetOrderRequest) -> GetOrderResponse:
        """
        Get order details by ID

        Args:
            request: Get order request

        Returns:
            GetOrderResponse: Order details

        Raises:
            OrderNotFoundError: If order not found
            BrokerError: For other broker-specific errors
        """
        pass

    @abstractmethod
    async def get_orders(self, request: GetOrdersRequest) -> GetOrdersResponse:
        """
        Get orders for account

        Args:
            request: Get orders request

        Returns:
            GetOrdersResponse: List of orders

        Raises:
            BrokerError: For broker-specific errors
        """
        pass

    # Position Management

    @abstractmethod
    async def get_positions(self, request: GetPositionsRequest) -> GetPositionsResponse:
        """
        Get positions for account

        Args:
            request: Get positions request

        Returns:
            GetPositionsResponse: List of positions

        Raises:
            BrokerError: For broker-specific errors
        """
        pass

    @abstractmethod
    async def get_position(self, account_id: str, symbol: str) -> Optional[Position]:
        """
        Get specific position

        Args:
            account_id: Trading account ID
            symbol: Stock symbol

        Returns:
            Position or None if not found

        Raises:
            BrokerError: For broker-specific errors
        """
        pass

    # Account Management

    @abstractmethod
    async def get_account(self, request: GetAccountRequest) -> GetAccountResponse:
        """
        Get account information

        Args:
            request: Get account request

        Returns:
            GetAccountResponse: Account details

        Raises:
            BrokerError: For broker-specific errors
        """
        pass

    # Real-time Data (Optional)

    async def subscribe_quotes(self, symbols: List[str]) -> AsyncIterator[StreamingQuote]:
        """
        Subscribe to real-time quotes

        Args:
            symbols: List of symbols to subscribe to

        Yields:
            StreamingQuote: Real-time quote data

        Note:
            Default implementation raises NotImplementedError.
            Brokers with streaming support should override this.
        """
        raise NotImplementedError("Real-time quotes not supported by this broker")

    async def unsubscribe_quotes(self, symbols: List[str]) -> bool:
        """
        Unsubscribe from real-time quotes

        Args:
            symbols: List of symbols to unsubscribe from

        Returns:
            bool: True if successful
        """
        # Default implementation - brokers can override
        return True

    # Webhook Support

    async def process_webhook(self, payload: WebhookPayload) -> bool:
        """
        Process webhook payload from broker

        Args:
            payload: Webhook payload

        Returns:
            bool: True if processed successfully
        """
        try:
            # Default implementation - subclasses should override
            logger.info(f"Received webhook: {payload.event_type} for account {payload.account_id}")
            return True
        except Exception as e:
            logger.error(f"Webhook processing failed: {e}")
            return False

    # Cache Management

    def _cache_order(self, order: Order) -> None:
        """Cache order with TTL"""
        self._order_cache[order.order_id] = order

    def _get_cached_order(self, order_id: str) -> Optional[Order]:
        """Get cached order if still valid"""
        return self._order_cache.get(order_id)

    def _cache_position(self, position: Position) -> None:
        """Cache position with TTL"""
        cache_key = f"{position.symbol}"
        self._position_cache[cache_key] = position

    def _get_cached_position(self, symbol: str) -> Optional[Position]:
        """Get cached position if still valid"""
        return self._position_cache.get(symbol)

    def _cache_account(self, account: Account) -> None:
        """Cache account with TTL"""
        self._account_cache = account

    def _get_cached_account(self) -> Optional[Account]:
        """Get cached account if still valid"""
        return self._account_cache

    def _clear_cache(self) -> None:
        """Clear all caches"""
        self._order_cache.clear()
        self._position_cache.clear()
        self._account_cache = None

    # Validation Helpers

    def _validate_order_request(self, order: OrderRequest) -> None:
        """
        Validate order request

        Args:
            order: Order to validate

        Raises:
            BrokerValidationError: If validation fails
        """
        if order.quantity <= 0:
            raise BrokerValidationError("Order quantity must be positive")

        if order.limit_price is not None and order.limit_price <= 0:
            raise BrokerValidationError("Limit price must be positive")

        if order.stop_price is not None and order.stop_price <= 0:
            raise BrokerValidationError("Stop price must be positive")

        if self.config.max_order_amount:
            estimated_amount = order.quantity * (order.limit_price or Decimal('1000'))
            if estimated_amount > self.config.max_order_amount:
                raise BrokerValidationError(f"Order amount exceeds maximum: {self.config.max_order_amount}")

        if self.config.allowed_symbols and order.symbol not in self.config.allowed_symbols:
            raise BrokerValidationError(f"Symbol {order.symbol} not allowed for trading")

    async def _check_rate_limit(self) -> None:
        """
        Check rate limiting

        Raises:
            BrokerRateLimitError: If rate limit exceeded
        """
        # Default implementation - subclasses can override with actual rate limiting
        pass

    # Order State Machine Support

    async def _emit_order_event(self, order: Order, event_type: str, metadata: Dict[str, Any] = None) -> None:
        """
        Emit order state change event

        Args:
            order: Order that changed
            event_type: Type of event
            metadata: Additional event metadata
        """
        try:
            event = OrderEvent(
                order_id=order.order_id,
                event_type=event_type,
                new_status=order.status,
                timestamp=datetime.utcnow(),
                metadata=metadata or {}
            )

            # Emit event to order state machine or event bus
            # This would typically publish to a message queue or event system
            logger.info(f"Order event: {event_type} for order {order.order_id}")

        except Exception as e:
            logger.error(f"Failed to emit order event: {e}")

    # Utility Methods

    def get_broker_type(self) -> str:
        """Get broker type string"""
        return self.config.broker_type.value

    def is_paper_trading(self) -> bool:
        """Check if in paper trading mode"""
        return self.config.is_paper_trading

    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check

        Returns:
            Dict with health status information
        """
        return {
            "broker_type": self.get_broker_type(),
            "is_connected": self.is_connected,
            "is_paper_trading": self.is_paper_trading(),
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "cached_orders": len(self._order_cache),
            "cached_positions": len(self._position_cache),
            "config_valid": bool(self.config.api_key) if not self.is_paper_trading() else True
        }


class BaseBrokerAdapter(BrokerAdapter):
    """
    Base broker adapter with common functionality

    Provides default implementations for common broker operations
    and utility methods that can be shared across implementations.
    """

    def __init__(self, config: BrokerConfig):
        super().__init__(config)
        self._rate_limit_tokens = config.rate_limit_per_minute
        self._rate_limit_window = datetime.utcnow()

    async def _check_rate_limit(self) -> None:
        """Simple token bucket rate limiting"""
        now = datetime.utcnow()

        # Reset tokens every minute
        if (now - self._rate_limit_window).total_seconds() >= 60:
            self._rate_limit_tokens = self.config.rate_limit_per_minute
            self._rate_limit_window = now

        if self._rate_limit_tokens <= 0:
            raise BrokerRateLimitError("Rate limit exceeded")

        self._rate_limit_tokens -= 1

    async def _retry_with_backoff(self, operation, max_retries: int = 3, base_delay: float = 1.0):
        """Retry operation with exponential backoff"""
        for attempt in range(max_retries + 1):
            try:
                return await operation()
            except (BrokerConnectionError, BrokerRateLimitError) as e:
                if attempt == max_retries:
                    raise e

                delay = base_delay * (2 ** attempt)
                logger.warning(f"Attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                await asyncio.sleep(delay)

    def _generate_client_order_id(self) -> str:
        """Generate unique client order ID"""
        import uuid
        return f"turtle_{int(datetime.utcnow().timestamp())}_{str(uuid.uuid4())[:8]}"

    def _calculate_commission(self, quantity: Decimal, price: Decimal) -> Decimal:
        """Calculate commission for order"""
        # Default commission calculation - can be overridden
        if hasattr(self.config, 'commission_per_share'):
            commission = quantity * Decimal(str(self.config.commission_per_share))
            minimum = Decimal(str(getattr(self.config, 'minimum_commission', '1.00')))
            return max(commission, minimum)
        return Decimal('0')

    def _format_symbol(self, symbol: str) -> str:
        """Format symbol for broker (can be overridden)"""
        return symbol.upper().strip()

    async def _validate_market_hours(self, extended_hours: bool = False) -> None:
        """Validate market hours for order placement"""
        if not extended_hours:
            market_open = await self.is_market_open()
            if not market_open:
                raise BrokerValidationError("Market is closed and extended hours not enabled")


# Factory for creating broker adapters

class BrokerAdapterFactory:
    """Factory for creating broker adapter instances"""

    _adapters = {}

    @classmethod
    def register_adapter(cls, broker_type: str, adapter_class):
        """Register a broker adapter class"""
        cls._adapters[broker_type] = adapter_class

    @classmethod
    def create_adapter(cls, config: BrokerConfig) -> BrokerAdapter:
        """
        Create broker adapter instance

        Args:
            config: Broker configuration

        Returns:
            BrokerAdapter instance

        Raises:
            ValueError: If broker type not supported
        """
        broker_type = config.broker_type.value

        if broker_type not in cls._adapters:
            raise ValueError(f"Unsupported broker type: {broker_type}")

        adapter_class = cls._adapters[broker_type]
        return adapter_class(config)

    @classmethod
    def get_supported_brokers(cls) -> List[str]:
        """Get list of supported broker types"""
        return list(cls._adapters.keys())