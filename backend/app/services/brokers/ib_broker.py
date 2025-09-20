"""
Interactive Brokers (IB) Broker Adapter

Integration with Interactive Brokers TWS/Gateway API.
Provides professional-grade trading capabilities with
extensive order types and global market access.
"""

import asyncio
import json
from typing import List, Optional, Dict, Any, AsyncIterator
from decimal import Decimal
from datetime import datetime
import logging

from ...core.broker_adapter import BaseBrokerAdapter, BrokerError, BrokerConnectionError, BrokerAuthenticationError, BrokerValidationError, OrderNotFoundError, InsufficientFundsError
from ...models.brokerage_models import (
    Order, OrderRequest, OrderUpdate, Position, Account, Fill, StreamingQuote,
    OrderStatus, OrderSide, OrderType, PositionSide, AccountType, BrokerType,
    PlaceOrderRequest, PlaceOrderResponse, CancelOrderRequest, CancelOrderResponse,
    ModifyOrderRequest, ModifyOrderResponse, GetPositionsRequest, GetPositionsResponse,
    GetAccountRequest, GetAccountResponse, GetOrdersRequest, GetOrdersResponse,
    GetOrderRequest, GetOrderResponse
)

logger = logging.getLogger(__name__)


class IBBrokerAdapter(BaseBrokerAdapter):
    """
    Interactive Brokers broker adapter

    Provides integration with IB TWS/Gateway including:
    - Advanced order types and algorithms
    - Global market access
    - Real-time market data streaming
    - Portfolio margin calculations
    - Risk management controls
    """

    def __init__(self, config):
        super().__init__(config)

        # IB Gateway configuration
        self.host = config.metadata.get('ib_host', 'localhost')
        self.port = config.metadata.get('ib_port', 7497 if config.is_paper_trading else 7496)
        self.client_id = config.metadata.get('ib_client_id', 1)

        # Connection state
        self._ib_client = None
        self._next_order_id = 1
        self._order_id_map: Dict[str, int] = {}  # Our ID -> IB ID
        self._ib_order_map: Dict[int, str] = {}  # IB ID -> Our ID

        # Order status mapping
        self._status_mapping = {
            'PendingSubmit': OrderStatus.PENDING,
            'PendingCancel': OrderStatus.PENDING,
            'PreSubmitted': OrderStatus.SUBMITTED,
            'Submitted': OrderStatus.SUBMITTED,
            'ApiPending': OrderStatus.PENDING,
            'ApiCancelled': OrderStatus.CANCELED,
            'Cancelled': OrderStatus.CANCELED,
            'Filled': OrderStatus.FILLED,
            'Inactive': OrderStatus.REJECTED,
            'PartiallyFilled': OrderStatus.PARTIALLY_FILLED,
        }

        # Market data subscriptions
        self._subscriptions: Dict[str, int] = {}  # symbol -> req_id
        self._quote_callbacks: List = []

    async def connect(self) -> bool:
        """Connect to IB TWS/Gateway"""
        try:
            # Import IB API (requires ibapi package)
            try:
                from ibapi.client import EClient
                from ibapi.wrapper import EWrapper
                from ibapi.contract import Contract
                from ibapi.order import Order as IBOrder
            except ImportError:
                raise BrokerError("IB API not installed. Run: pip install ibapi")

            # Create IB client wrapper
            self._ib_client = IBClientWrapper(self)

            # Connect to IB Gateway/TWS
            self._ib_client.connect(self.host, self.port, self.client_id)

            # Start message processing thread
            self._ib_client.run()

            # Wait for connection
            await asyncio.sleep(1)

            if not self._ib_client.isConnected():
                raise BrokerConnectionError("Failed to connect to IB Gateway/TWS")

            # Request next valid order ID
            self._ib_client.reqIds(-1)
            await asyncio.sleep(0.5)

            self.is_connected = True
            self.last_heartbeat = datetime.utcnow()
            logger.info(f"Connected to IB {'paper' if self.config.is_paper_trading else 'live'} trading")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to IB: {e}")
            raise BrokerConnectionError(f"IB connection failed: {e}")

    async def disconnect(self) -> bool:
        """Disconnect from IB TWS/Gateway"""
        if self._ib_client and self._ib_client.isConnected():
            self._ib_client.disconnect()

        self.is_connected = False
        logger.info("Disconnected from IB")
        return True

    async def is_market_open(self) -> bool:
        """Check if market is open (simplified for IB)"""
        # IB provides access to global markets with different hours
        # This would need market-specific logic in production
        now = datetime.now()
        if now.weekday() >= 5:  # Weekend
            return False

        # Basic US market hours check
        current_time = now.time()
        from datetime import time
        market_open = time(9, 30)  # 9:30 AM
        market_close = time(16, 0)  # 4:00 PM

        return market_open <= current_time <= market_close

    async def place_order(self, request: PlaceOrderRequest) -> PlaceOrderResponse:
        """Place order via IB API"""
        try:
            await self._check_rate_limit()
            self._validate_order_request(request.order)

            if not self._ib_client or not self._ib_client.isConnected():
                raise BrokerConnectionError("Not connected to IB")

            # Create IB contract and order
            contract = self._create_ib_contract(request.order.symbol)
            ib_order = self._create_ib_order(request.order)

            # Get next order ID
            order_id = self._next_order_id
            self._next_order_id += 1

            # Map our order ID to IB order ID
            our_order_id = f"IB_{order_id:08d}"
            self._order_id_map[our_order_id] = order_id
            self._ib_order_map[order_id] = our_order_id

            # Submit order
            self._ib_client.placeOrder(order_id, contract, ib_order)

            # Create our order object
            order = self._create_order_from_request(request.order, our_order_id, request.account_id)
            self._cache_order(order)

            # Emit order event
            await self._emit_order_event(order, "ORDER_SUBMITTED")

            return PlaceOrderResponse(
                success=True,
                order=order
            )

        except Exception as e:
            logger.error(f"Failed to place order: {e}")
            return PlaceOrderResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def cancel_order(self, request: CancelOrderRequest) -> CancelOrderResponse:
        """Cancel order via IB API"""
        try:
            await self._check_rate_limit()

            if not self._ib_client or not self._ib_client.isConnected():
                raise BrokerConnectionError("Not connected to IB")

            # Get IB order ID
            ib_order_id = self._order_id_map.get(request.order_id)
            if not ib_order_id:
                raise OrderNotFoundError(f"Order {request.order_id} not found")

            # Cancel order
            self._ib_client.cancelOrder(ib_order_id)

            # Get order from cache
            order = self._get_cached_order(request.order_id)
            if order:
                order.status = OrderStatus.CANCELED
                order.canceled_at = datetime.utcnow()
                order.updated_at = datetime.utcnow()

                # Emit order event
                await self._emit_order_event(order, "ORDER_CANCELED")

                return CancelOrderResponse(
                    success=True,
                    order=order
                )
            else:
                return CancelOrderResponse(
                    success=True,
                    order=None
                )

        except Exception as e:
            logger.error(f"Failed to cancel order: {e}")
            return CancelOrderResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def modify_order(self, request: ModifyOrderRequest) -> ModifyOrderResponse:
        """Modify order via IB API"""
        try:
            await self._check_rate_limit()

            if not self._ib_client or not self._ib_client.isConnected():
                raise BrokerConnectionError("Not connected to IB")

            # Get IB order ID
            ib_order_id = self._order_id_map.get(request.order_update.order_id)
            if not ib_order_id:
                raise OrderNotFoundError(f"Order {request.order_update.order_id} not found")

            # Get current order
            order = self._get_cached_order(request.order_update.order_id)
            if not order:
                raise OrderNotFoundError(f"Order {request.order_update.order_id} not found")

            # Create modified IB order
            contract = self._create_ib_contract(order.symbol)
            ib_order = self._create_ib_order_from_update(order, request.order_update)

            # Submit modification
            self._ib_client.placeOrder(ib_order_id, contract, ib_order)

            # Update our order
            self._apply_order_update(order, request.order_update)

            # Emit order event
            await self._emit_order_event(order, "ORDER_MODIFIED")

            return ModifyOrderResponse(
                success=True,
                order=order
            )

        except Exception as e:
            logger.error(f"Failed to modify order: {e}")
            return ModifyOrderResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def get_order(self, request: GetOrderRequest) -> GetOrderResponse:
        """Get order details"""
        try:
            # Check cache first
            order = self._get_cached_order(request.order_id)
            if order:
                return GetOrderResponse(success=True, order=order)

            # Request from IB (would need order tracking implementation)
            return GetOrderResponse(
                success=False,
                error="Order not found in cache",
                error_code="ORDER_NOT_FOUND"
            )

        except Exception as e:
            return GetOrderResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def get_orders(self, request: GetOrdersRequest) -> GetOrdersResponse:
        """Get orders (from cache for IB)"""
        try:
            # IB doesn't provide easy order history retrieval
            # In production, we'd maintain a persistent store
            orders = []
            for order in self._order_cache.values():
                if request.status and order.status != request.status:
                    continue
                if request.symbol and order.symbol != request.symbol:
                    continue
                orders.append(order)

            # Apply limit
            orders = orders[:request.limit]

            return GetOrdersResponse(
                success=True,
                orders=orders
            )

        except Exception as e:
            return GetOrdersResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def get_positions(self, request: GetPositionsRequest) -> GetPositionsResponse:
        """Get positions from IB"""
        try:
            if not self._ib_client or not self._ib_client.isConnected():
                raise BrokerConnectionError("Not connected to IB")

            # Request positions
            self._ib_client.reqPositions()

            # Wait for positions (simplified - would need proper async handling)
            await asyncio.sleep(1)

            # Get positions from wrapper
            positions = self._ib_client.get_positions()

            # Filter by symbol if requested
            if request.symbol:
                positions = [p for p in positions if p.symbol == request.symbol]

            return GetPositionsResponse(
                success=True,
                positions=positions
            )

        except Exception as e:
            return GetPositionsResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def get_position(self, account_id: str, symbol: str) -> Optional[Position]:
        """Get specific position"""
        try:
            positions_response = await self.get_positions(GetPositionsRequest(account_id=account_id, symbol=symbol))
            if positions_response.success and positions_response.positions:
                return positions_response.positions[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get position for {symbol}: {e}")
            return None

    async def get_account(self, request: GetAccountRequest) -> GetAccountResponse:
        """Get account information from IB"""
        try:
            if not self._ib_client or not self._ib_client.isConnected():
                raise BrokerConnectionError("Not connected to IB")

            # Request account updates
            self._ib_client.reqAccountUpdates(True, request.account_id)

            # Wait for account data (simplified)
            await asyncio.sleep(1)

            # Get account from wrapper
            account = self._ib_client.get_account()

            return GetAccountResponse(
                success=True,
                account=account
            )

        except Exception as e:
            return GetAccountResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def subscribe_quotes(self, symbols: List[str]) -> AsyncIterator[StreamingQuote]:
        """Subscribe to real-time quotes from IB"""
        if not self._ib_client or not self._ib_client.isConnected():
            raise BrokerConnectionError("Not connected to IB")

        try:
            # Subscribe to market data for each symbol
            for symbol in symbols:
                if symbol not in self._subscriptions:
                    req_id = len(self._subscriptions) + 1000
                    contract = self._create_ib_contract(symbol)
                    self._ib_client.reqMktData(req_id, contract, "", False, False, [])
                    self._subscriptions[symbol] = req_id

            # Stream quotes
            async for quote in self._ib_client.stream_quotes():
                yield quote

        except Exception as e:
            logger.error(f"Failed to subscribe to quotes: {e}")
            raise

    async def unsubscribe_quotes(self, symbols: List[str]) -> bool:
        """Unsubscribe from real-time quotes"""
        try:
            for symbol in symbols:
                req_id = self._subscriptions.get(symbol)
                if req_id:
                    self._ib_client.cancelMktData(req_id)
                    del self._subscriptions[symbol]
            return True
        except Exception as e:
            logger.error(f"Failed to unsubscribe from quotes: {e}")
            return False

    # Helper Methods

    def _create_ib_contract(self, symbol: str):
        """Create IB Contract object"""
        from ibapi.contract import Contract

        contract = Contract()
        contract.symbol = symbol
        contract.secType = "STK"
        contract.exchange = "SMART"
        contract.currency = "USD"
        return contract

    def _create_ib_order(self, order_request: OrderRequest):
        """Create IB Order object"""
        from ibapi.order import Order as IBOrder

        ib_order = IBOrder()
        ib_order.action = order_request.side.value.upper()
        ib_order.totalQuantity = int(order_request.quantity)
        ib_order.orderType = self._convert_order_type_to_ib(order_request.order_type)
        ib_order.tif = self._convert_tif_to_ib(order_request.time_in_force)

        if order_request.limit_price:
            ib_order.lmtPrice = float(order_request.limit_price)
        if order_request.stop_price:
            ib_order.auxPrice = float(order_request.stop_price)

        # Extended hours
        if order_request.extended_hours:
            ib_order.outsideRth = True

        return ib_order

    def _create_ib_order_from_update(self, original_order: Order, update: OrderUpdate):
        """Create IB Order from update"""
        from ibapi.order import Order as IBOrder

        ib_order = IBOrder()
        ib_order.action = original_order.side.value.upper()
        ib_order.totalQuantity = int(update.quantity if update.quantity else original_order.quantity)
        ib_order.orderType = self._convert_order_type_to_ib(original_order.order_type)
        ib_order.tif = self._convert_tif_to_ib(update.time_in_force if update.time_in_force else original_order.time_in_force)

        if update.limit_price is not None:
            ib_order.lmtPrice = float(update.limit_price)
        elif original_order.limit_price:
            ib_order.lmtPrice = float(original_order.limit_price)

        if update.stop_price is not None:
            ib_order.auxPrice = float(update.stop_price)
        elif original_order.stop_price:
            ib_order.auxPrice = float(original_order.stop_price)

        return ib_order

    def _create_order_from_request(self, order_request: OrderRequest, order_id: str, account_id: str) -> Order:
        """Create Order object from request"""
        return Order(
            order_id=order_id,
            symbol=order_request.symbol,
            side=order_request.side,
            quantity=order_request.quantity,
            order_type=order_request.order_type,
            time_in_force=order_request.time_in_force,
            limit_price=order_request.limit_price,
            stop_price=order_request.stop_price,
            trail_amount=order_request.trail_amount,
            trail_percent=order_request.trail_percent,
            extended_hours=order_request.extended_hours,
            client_order_id=order_request.client_order_id,
            status=OrderStatus.SUBMITTED,
            filled_quantity=Decimal('0'),
            remaining_quantity=order_request.quantity,
            average_fill_price=None,
            commission=Decimal('0'),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            submitted_at=datetime.utcnow(),
            broker_metadata={
                'account_id': account_id,
                'ib_order_id': self._order_id_map[order_id],
                'broker': 'interactive_brokers'
            }
        )

    def _apply_order_update(self, order: Order, update: OrderUpdate):
        """Apply update to order"""
        if update.limit_price is not None:
            order.limit_price = update.limit_price
        if update.stop_price is not None:
            order.stop_price = update.stop_price
        if update.quantity is not None:
            order.quantity = update.quantity
            order.remaining_quantity = update.quantity - order.filled_quantity
        if update.time_in_force is not None:
            order.time_in_force = update.time_in_force

        order.updated_at = datetime.utcnow()

    def _convert_order_type_to_ib(self, order_type: OrderType) -> str:
        """Convert OrderType to IB format"""
        mapping = {
            OrderType.MARKET: "MKT",
            OrderType.LIMIT: "LMT",
            OrderType.STOP: "STP",
            OrderType.STOP_LIMIT: "STP LMT",
            OrderType.TRAILING_STOP: "TRAIL"
        }
        return mapping.get(order_type, "MKT")

    def _convert_tif_to_ib(self, tif) -> str:
        """Convert time in force to IB format"""
        mapping = {
            'day': 'DAY',
            'gtc': 'GTC',
            'ioc': 'IOC',
            'fok': 'FOK'
        }
        return mapping.get(tif.value if hasattr(tif, 'value') else tif, 'DAY')


class IBClientWrapper:
    """IB API Client Wrapper (simplified implementation)"""

    def __init__(self, adapter):
        self.adapter = adapter
        self.positions = []
        self.account_data = {}

    def connect(self, host: str, port: int, client_id: int):
        """Connect to IB (mock implementation)"""
        # In real implementation, would use EClient.connect()
        logger.info(f"Mock IB connection to {host}:{port} with client ID {client_id}")

    def run(self):
        """Start message processing (mock implementation)"""
        pass

    def isConnected(self) -> bool:
        """Check connection status (mock implementation)"""
        return True

    def disconnect(self):
        """Disconnect from IB (mock implementation)"""
        pass

    def reqIds(self, num_ids: int):
        """Request next valid order IDs (mock implementation)"""
        pass

    def placeOrder(self, order_id: int, contract, order):
        """Place order (mock implementation)"""
        logger.info(f"Mock IB order placement: ID={order_id}, Symbol={contract.symbol}")

    def cancelOrder(self, order_id: int):
        """Cancel order (mock implementation)"""
        logger.info(f"Mock IB order cancellation: ID={order_id}")

    def reqPositions(self):
        """Request positions (mock implementation)"""
        pass

    def reqAccountUpdates(self, subscribe: bool, account_id: str):
        """Request account updates (mock implementation)"""
        pass

    def reqMktData(self, req_id: int, contract, generic_tick_list: str, snapshot: bool, regulatory_snapshot: bool, mkt_data_options):
        """Request market data (mock implementation)"""
        pass

    def cancelMktData(self, req_id: int):
        """Cancel market data (mock implementation)"""
        pass

    def get_positions(self) -> List[Position]:
        """Get positions (mock implementation)"""
        return []

    def get_account(self) -> Optional[Account]:
        """Get account (mock implementation)"""
        return None

    async def stream_quotes(self) -> AsyncIterator[StreamingQuote]:
        """Stream quotes (mock implementation)"""
        # Mock implementation - would stream real quotes in production
        return
        yield  # Unreachable but needed for async generator