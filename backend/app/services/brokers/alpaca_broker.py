"""
Alpaca Broker Adapter

Real broker integration with Alpaca Markets API.
Provides live and paper trading capabilities with proper
API key authentication and rate limiting.
"""

import asyncio
import aiohttp
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
import logging

from ...core.broker_adapter import BaseBrokerAdapter, BrokerError, BrokerConnectionError, BrokerAuthenticationError, BrokerValidationError, OrderNotFoundError, InsufficientFundsError
from ...models.brokerage_models import (
    Order, OrderRequest, OrderUpdate, Position, Account, Fill,
    OrderStatus, OrderSide, OrderType, PositionSide, AccountType, BrokerType,
    PlaceOrderRequest, PlaceOrderResponse, CancelOrderRequest, CancelOrderResponse,
    ModifyOrderRequest, ModifyOrderResponse, GetPositionsRequest, GetPositionsResponse,
    GetAccountRequest, GetAccountResponse, GetOrdersRequest, GetOrdersResponse,
    GetOrderRequest, GetOrderResponse
)

logger = logging.getLogger(__name__)


class AlpacaBrokerAdapter(BaseBrokerAdapter):
    """
    Alpaca broker adapter for real and paper trading

    Provides integration with Alpaca Markets API including:
    - Order management (place, cancel, modify)
    - Position tracking
    - Account information
    - Real-time market data (optional)
    - Paper trading support
    """

    def __init__(self, config):
        super().__init__(config)

        # Alpaca API configuration
        self.api_key = config.api_key
        self.api_secret = config.api_secret
        self.base_url = config.base_url or (
            "https://paper-api.alpaca.markets" if config.is_paper_trading
            else "https://api.alpaca.markets"
        )
        self.data_url = "https://data.alpaca.markets"

        # HTTP session for connection pooling
        self._session: Optional[aiohttp.ClientSession] = None

        # Order status mapping
        self._status_mapping = {
            'new': OrderStatus.SUBMITTED,
            'accepted': OrderStatus.ACCEPTED,
            'partial_fill': OrderStatus.PARTIALLY_FILLED,
            'filled': OrderStatus.FILLED,
            'done_for_day': OrderStatus.EXPIRED,
            'canceled': OrderStatus.CANCELED,
            'replaced': OrderStatus.ACCEPTED,
            'pending_cancel': OrderStatus.PENDING,
            'pending_replace': OrderStatus.PENDING,
            'rejected': OrderStatus.REJECTED,
            'suspended': OrderStatus.REJECTED,
            'pending_new': OrderStatus.PENDING,
            'calculated': OrderStatus.ACCEPTED,
        }

    async def connect(self) -> bool:
        """Connect to Alpaca API"""
        try:
            # Create HTTP session
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.config.connection_timeout),
                headers=self._get_auth_headers()
            )

            # Test connection with account info
            response = await self._make_request('GET', '/v2/account')
            if not response:
                raise BrokerConnectionError("Failed to connect to Alpaca API")

            self.is_connected = True
            self.last_heartbeat = datetime.utcnow()
            logger.info(f"Connected to Alpaca {'paper' if self.config.is_paper_trading else 'live'} trading")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Alpaca: {e}")
            raise BrokerConnectionError(f"Alpaca connection failed: {e}")

    async def disconnect(self) -> bool:
        """Disconnect from Alpaca API"""
        if self._session:
            await self._session.close()
            self._session = None

        self.is_connected = False
        logger.info("Disconnected from Alpaca")
        return True

    async def is_market_open(self) -> bool:
        """Check if market is open via Alpaca API"""
        try:
            response = await self._make_request('GET', '/v2/clock')
            if response:
                return response.get('is_open', False)
            return False
        except Exception as e:
            logger.error(f"Failed to check market status: {e}")
            return False

    async def place_order(self, request: PlaceOrderRequest) -> PlaceOrderResponse:
        """Place order via Alpaca API"""
        try:
            await self._check_rate_limit()
            self._validate_order_request(request.order)

            # Convert to Alpaca order format
            alpaca_order = self._convert_to_alpaca_order(request.order)

            # Submit order
            response = await self._make_request('POST', '/v2/orders', data=alpaca_order)
            if not response:
                return PlaceOrderResponse(
                    success=False,
                    error="Failed to submit order to Alpaca",
                    error_code="API_ERROR"
                )

            # Convert response to our Order model
            order = self._convert_from_alpaca_order(response)
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
        """Cancel order via Alpaca API"""
        try:
            await self._check_rate_limit()

            # Cancel order
            response = await self._make_request('DELETE', f'/v2/orders/{request.order_id}')
            if response is None:
                raise OrderNotFoundError(f"Order {request.order_id} not found")

            # Convert response to our Order model
            order = self._convert_from_alpaca_order(response)

            # Emit order event
            await self._emit_order_event(order, "ORDER_CANCELED")

            return CancelOrderResponse(
                success=True,
                order=order
            )

        except Exception as e:
            logger.error(f"Failed to cancel order: {e}")
            return CancelOrderResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def modify_order(self, request: ModifyOrderRequest) -> ModifyOrderResponse:
        """Modify order via Alpaca API"""
        try:
            await self._check_rate_limit()

            # Convert update to Alpaca format
            alpaca_update = self._convert_order_update_to_alpaca(request.order_update)

            # Submit modification
            response = await self._make_request('PATCH', f'/v2/orders/{request.order_update.order_id}', data=alpaca_update)
            if not response:
                raise OrderNotFoundError(f"Order {request.order_update.order_id} not found")

            # Convert response to our Order model
            order = self._convert_from_alpaca_order(response)

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
        """Get order details from Alpaca"""
        try:
            # Check cache first
            cached_order = self._get_cached_order(request.order_id)
            if cached_order:
                return GetOrderResponse(success=True, order=cached_order)

            # Fetch from Alpaca
            response = await self._make_request('GET', f'/v2/orders/{request.order_id}')
            if not response:
                raise OrderNotFoundError(f"Order {request.order_id} not found")

            order = self._convert_from_alpaca_order(response)
            self._cache_order(order)

            return GetOrderResponse(
                success=True,
                order=order
            )

        except Exception as e:
            return GetOrderResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    async def get_orders(self, request: GetOrdersRequest) -> GetOrdersResponse:
        """Get orders from Alpaca"""
        try:
            # Build query parameters
            params = {
                'limit': min(request.limit, 500),  # Alpaca max limit
                'direction': 'desc'
            }

            if request.status:
                params['status'] = self._convert_status_to_alpaca(request.status)
            if request.symbol:
                params['symbols'] = request.symbol

            # Fetch orders
            response = await self._make_request('GET', '/v2/orders', params=params)
            if not response:
                return GetOrdersResponse(success=False, error="Failed to fetch orders")

            # Convert orders
            orders = [self._convert_from_alpaca_order(order_data) for order_data in response]

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
        """Get positions from Alpaca"""
        try:
            # Fetch positions
            response = await self._make_request('GET', '/v2/positions')
            if response is None:
                return GetPositionsResponse(success=False, error="Failed to fetch positions")

            # Convert positions
            positions = []
            for position_data in response:
                if request.symbol and position_data.get('symbol') != request.symbol:
                    continue

                position = self._convert_from_alpaca_position(position_data)
                positions.append(position)
                self._cache_position(position)

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
        """Get specific position from Alpaca"""
        try:
            # Check cache first
            cached_position = self._get_cached_position(symbol)
            if cached_position:
                return cached_position

            # Fetch from Alpaca
            response = await self._make_request('GET', f'/v2/positions/{symbol}')
            if not response:
                return None

            position = self._convert_from_alpaca_position(response)
            self._cache_position(position)
            return position

        except Exception as e:
            logger.error(f"Failed to get position for {symbol}: {e}")
            return None

    async def get_account(self, request: GetAccountRequest) -> GetAccountResponse:
        """Get account information from Alpaca"""
        try:
            # Check cache first
            cached_account = self._get_cached_account()
            if cached_account:
                return GetAccountResponse(success=True, account=cached_account)

            # Fetch from Alpaca
            response = await self._make_request('GET', '/v2/account')
            if not response:
                return GetAccountResponse(success=False, error="Failed to fetch account")

            account = self._convert_from_alpaca_account(response)
            self._cache_account(account)

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

    # Helper Methods

    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for Alpaca API"""
        return {
            'APCA-API-KEY-ID': self.api_key,
            'APCA-API-SECRET-KEY': self.api_secret,
            'Content-Type': 'application/json'
        }

    async def _make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> Optional[Dict]:
        """Make authenticated request to Alpaca API"""
        if not self._session:
            raise BrokerConnectionError("Not connected to Alpaca")

        url = f"{self.base_url}{endpoint}"

        try:
            async with self._session.request(
                method,
                url,
                json=data,
                params=params
            ) as response:

                if response.status == 401:
                    raise BrokerAuthenticationError("Invalid Alpaca API credentials")
                elif response.status == 422:
                    error_data = await response.json()
                    raise BrokerValidationError(f"Alpaca validation error: {error_data}")
                elif response.status == 429:
                    raise BrokerError("Alpaca rate limit exceeded", "RATE_LIMIT")
                elif response.status >= 400:
                    error_text = await response.text()
                    raise BrokerError(f"Alpaca API error: {error_text}", str(response.status))

                if method == 'DELETE' and response.status == 204:
                    return {}  # Successful deletion

                return await response.json()

        except aiohttp.ClientError as e:
            raise BrokerConnectionError(f"Network error: {e}")

    def _convert_to_alpaca_order(self, order: OrderRequest) -> Dict[str, Any]:
        """Convert our order format to Alpaca API format"""
        alpaca_order = {
            'symbol': order.symbol,
            'qty': str(order.quantity),
            'side': order.side.value,
            'type': self._convert_order_type_to_alpaca(order.order_type),
            'time_in_force': self._convert_tif_to_alpaca(order.time_in_force),
        }

        if order.limit_price:
            alpaca_order['limit_price'] = str(order.limit_price)
        if order.stop_price:
            alpaca_order['stop_price'] = str(order.stop_price)
        if order.trail_amount:
            alpaca_order['trail_amount'] = str(order.trail_amount)
        if order.trail_percent:
            alpaca_order['trail_percent'] = str(order.trail_percent)
        if order.extended_hours:
            alpaca_order['extended_hours'] = order.extended_hours
        if order.client_order_id:
            alpaca_order['client_order_id'] = order.client_order_id

        return alpaca_order

    def _convert_from_alpaca_order(self, alpaca_order: Dict[str, Any]) -> Order:
        """Convert Alpaca order format to our Order model"""
        return Order(
            order_id=alpaca_order['id'],
            symbol=alpaca_order['symbol'],
            side=OrderSide(alpaca_order['side']),
            quantity=Decimal(alpaca_order['qty']),
            order_type=self._convert_order_type_from_alpaca(alpaca_order['order_type']),
            time_in_force=self._convert_tif_from_alpaca(alpaca_order['time_in_force']),
            limit_price=Decimal(alpaca_order['limit_price']) if alpaca_order.get('limit_price') else None,
            stop_price=Decimal(alpaca_order['stop_price']) if alpaca_order.get('stop_price') else None,
            trail_amount=Decimal(alpaca_order['trail_amount']) if alpaca_order.get('trail_amount') else None,
            trail_percent=Decimal(alpaca_order['trail_percent']) if alpaca_order.get('trail_percent') else None,
            extended_hours=alpaca_order.get('extended_hours', False),
            client_order_id=alpaca_order.get('client_order_id'),
            status=self._status_mapping.get(alpaca_order['status'], OrderStatus.PENDING),
            filled_quantity=Decimal(alpaca_order.get('filled_qty', '0')),
            remaining_quantity=Decimal(alpaca_order['qty']) - Decimal(alpaca_order.get('filled_qty', '0')),
            average_fill_price=Decimal(alpaca_order['filled_avg_price']) if alpaca_order.get('filled_avg_price') else None,
            commission=Decimal('0'),  # Alpaca doesn't charge commissions
            created_at=datetime.fromisoformat(alpaca_order['created_at'].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(alpaca_order['updated_at'].replace('Z', '+00:00')),
            submitted_at=datetime.fromisoformat(alpaca_order['submitted_at'].replace('Z', '+00:00')) if alpaca_order.get('submitted_at') else None,
            filled_at=datetime.fromisoformat(alpaca_order['filled_at'].replace('Z', '+00:00')) if alpaca_order.get('filled_at') else None,
            canceled_at=datetime.fromisoformat(alpaca_order['canceled_at'].replace('Z', '+00:00')) if alpaca_order.get('canceled_at') else None,
            broker_metadata={
                'alpaca_id': alpaca_order['id'],
                'asset_id': alpaca_order.get('asset_id'),
                'asset_class': alpaca_order.get('asset_class'),
                'legs': alpaca_order.get('legs', [])
            }
        )

    def _convert_from_alpaca_position(self, alpaca_position: Dict[str, Any]) -> Position:
        """Convert Alpaca position format to our Position model"""
        quantity = Decimal(alpaca_position['qty'])
        market_value = Decimal(alpaca_position['market_value'])

        return Position(
            symbol=alpaca_position['symbol'],
            side=PositionSide.LONG if quantity >= 0 else PositionSide.SHORT,
            quantity=abs(quantity),
            market_value=abs(market_value),
            cost_basis=Decimal(alpaca_position['cost_basis']),
            average_cost=Decimal(alpaca_position['avg_entry_price']),
            unrealized_pnl=Decimal(alpaca_position['unrealized_pl']),
            unrealized_pnl_percent=Decimal(alpaca_position['unrealized_plpc']) * Decimal('100'),
            current_price=Decimal(alpaca_position['current_price']),
            last_updated=datetime.utcnow(),
            broker_metadata={
                'asset_id': alpaca_position.get('asset_id'),
                'exchange': alpaca_position.get('exchange'),
                'asset_class': alpaca_position.get('asset_class'),
                'side': alpaca_position.get('side')
            }
        )

    def _convert_from_alpaca_account(self, alpaca_account: Dict[str, Any]) -> Account:
        """Convert Alpaca account format to our Account model"""
        return Account(
            account_id=alpaca_account['id'],
            account_type=AccountType.MARGIN if alpaca_account.get('account_blocked') == False else AccountType.CASH,
            broker_type=BrokerType.ALPACA,
            cash=Decimal(alpaca_account['cash']),
            buying_power=Decimal(alpaca_account['buying_power']),
            portfolio_value=Decimal(alpaca_account['portfolio_value']),
            equity=Decimal(alpaca_account['equity']),
            long_market_value=Decimal(alpaca_account['long_market_value']),
            short_market_value=Decimal(alpaca_account['short_market_value']),
            day_trade_count=int(alpaca_account.get('daytrade_count', 0)),
            is_day_trade_restricted=alpaca_account.get('pattern_day_trader', False),
            maintenance_margin=Decimal(alpaca_account.get('maintenance_margin', '0')),
            initial_margin=Decimal(alpaca_account.get('initial_margin', '0')),
            last_updated=datetime.utcnow(),
            broker_metadata={
                'account_number': alpaca_account.get('account_number'),
                'status': alpaca_account.get('status'),
                'currency': alpaca_account.get('currency'),
                'trading_blocked': alpaca_account.get('trading_blocked'),
                'transfers_blocked': alpaca_account.get('transfers_blocked'),
                'account_blocked': alpaca_account.get('account_blocked'),
                'created_at': alpaca_account.get('created_at')
            }
        )

    def _convert_order_type_to_alpaca(self, order_type: OrderType) -> str:
        """Convert our OrderType to Alpaca format"""
        mapping = {
            OrderType.MARKET: 'market',
            OrderType.LIMIT: 'limit',
            OrderType.STOP: 'stop',
            OrderType.STOP_LIMIT: 'stop_limit',
            OrderType.TRAILING_STOP: 'trailing_stop'
        }
        return mapping.get(order_type, 'market')

    def _convert_order_type_from_alpaca(self, alpaca_type: str) -> OrderType:
        """Convert Alpaca order type to our OrderType"""
        mapping = {
            'market': OrderType.MARKET,
            'limit': OrderType.LIMIT,
            'stop': OrderType.STOP,
            'stop_limit': OrderType.STOP_LIMIT,
            'trailing_stop': OrderType.TRAILING_STOP
        }
        return mapping.get(alpaca_type, OrderType.MARKET)

    def _convert_tif_to_alpaca(self, tif) -> str:
        """Convert time in force to Alpaca format"""
        mapping = {
            'day': 'day',
            'gtc': 'gtc',
            'ioc': 'ioc',
            'fok': 'fok'
        }
        return mapping.get(tif.value if hasattr(tif, 'value') else tif, 'day')

    def _convert_tif_from_alpaca(self, alpaca_tif: str):
        """Convert Alpaca time in force to our format"""
        from ...models.brokerage_models import OrderTimeInForce
        mapping = {
            'day': OrderTimeInForce.DAY,
            'gtc': OrderTimeInForce.GTC,
            'ioc': OrderTimeInForce.IOC,
            'fok': OrderTimeInForce.FOK
        }
        return mapping.get(alpaca_tif, OrderTimeInForce.DAY)

    def _convert_status_to_alpaca(self, status: OrderStatus) -> str:
        """Convert our OrderStatus to Alpaca status"""
        mapping = {
            OrderStatus.PENDING: 'pending_new',
            OrderStatus.SUBMITTED: 'new',
            OrderStatus.ACCEPTED: 'accepted',
            OrderStatus.PARTIALLY_FILLED: 'partial_fill',
            OrderStatus.FILLED: 'filled',
            OrderStatus.CANCELED: 'canceled',
            OrderStatus.REJECTED: 'rejected',
            OrderStatus.EXPIRED: 'done_for_day'
        }
        return mapping.get(status, 'new')

    def _convert_order_update_to_alpaca(self, update: OrderUpdate) -> Dict[str, Any]:
        """Convert order update to Alpaca format"""
        alpaca_update = {}

        if update.limit_price is not None:
            alpaca_update['limit_price'] = str(update.limit_price)
        if update.stop_price is not None:
            alpaca_update['stop_price'] = str(update.stop_price)
        if update.quantity is not None:
            alpaca_update['qty'] = str(update.quantity)
        if update.time_in_force is not None:
            alpaca_update['time_in_force'] = self._convert_tif_to_alpaca(update.time_in_force)

        return alpaca_update