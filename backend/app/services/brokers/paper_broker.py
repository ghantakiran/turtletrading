"""
Paper Trading Broker Adapter

Simulates real broker behavior for testing and development.
Includes realistic fill simulation, partial fills, slippage,
and market hours enforcement.
"""

import asyncio
import random
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, time, timedelta
import uuid
import logging

from ...core.broker_adapter import BaseBrokerAdapter, BrokerError, BrokerValidationError, InsufficientFundsError, OrderNotFoundError
from ...models.brokerage_models import (
    Order, OrderRequest, OrderUpdate, Position, Account, Fill,
    OrderStatus, OrderSide, OrderType, PositionSide, AccountType, BrokerType,
    PlaceOrderRequest, PlaceOrderResponse, CancelOrderRequest, CancelOrderResponse,
    ModifyOrderRequest, ModifyOrderResponse, GetPositionsRequest, GetPositionsResponse,
    GetAccountRequest, GetAccountResponse, GetOrdersRequest, GetOrdersResponse,
    GetOrderRequest, GetOrderResponse, PaperTradingConfig
)

logger = logging.getLogger(__name__)


class PaperBrokerAdapter(BaseBrokerAdapter):
    """
    Paper trading broker adapter with realistic simulation

    Simulates real broker behavior including:
    - Market hours enforcement
    - Realistic fill simulation with delays
    - Partial fills and order rejections
    - Slippage simulation
    - Commission calculation
    - Account balance tracking
    """

    def __init__(self, config, paper_config: PaperTradingConfig = None):
        super().__init__(config)
        self.paper_config = paper_config or PaperTradingConfig()

        # Simulation state
        self._orders: Dict[str, Order] = {}
        self._positions: Dict[str, Position] = {}
        self._account: Optional[Account] = None
        self._fills: Dict[str, List[Fill]] = {}
        self._order_counter = 0

        # Market data simulation (in production would come from real data source)
        self._market_prices: Dict[str, Decimal] = {
            'AAPL': Decimal('150.00'),
            'MSFT': Decimal('300.00'),
            'GOOGL': Decimal('120.00'),
            'AMZN': Decimal('140.00'),
            'TSLA': Decimal('200.00'),
            'META': Decimal('350.00'),
            'NVDA': Decimal('450.00'),
            'SPY': Decimal('430.00'),
            'QQQ': Decimal('360.00'),
        }

        # Initialize account
        self._initialize_account()

    def _initialize_account(self):
        """Initialize paper trading account"""
        account_id = "PAPER_ACCOUNT_001"

        self._account = Account(
            account_id=account_id,
            account_type=AccountType.MARGIN,
            broker_type=BrokerType.PAPER,
            cash=self.paper_config.initial_cash,
            buying_power=self.paper_config.initial_cash * Decimal('2'),  # 2:1 margin
            portfolio_value=self.paper_config.initial_cash,
            equity=self.paper_config.initial_cash,
            long_market_value=Decimal('0'),
            short_market_value=Decimal('0'),
            day_trade_count=0,
            is_day_trade_restricted=False,
            maintenance_margin=Decimal('0'),
            initial_margin=Decimal('0'),
            last_updated=datetime.utcnow(),
            broker_metadata={
                'paper_trading': True,
                'initial_cash': str(self.paper_config.initial_cash)
            }
        )

    async def connect(self) -> bool:
        """Connect to paper trading system"""
        try:
            # Simulate connection delay
            await asyncio.sleep(0.1)
            self.is_connected = True
            self.last_heartbeat = datetime.utcnow()
            logger.info("Connected to paper trading system")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to paper trading: {e}")
            raise BrokerError(f"Connection failed: {e}")

    async def disconnect(self) -> bool:
        """Disconnect from paper trading system"""
        self.is_connected = False
        logger.info("Disconnected from paper trading system")
        return True

    async def is_market_open(self) -> bool:
        """Check if market is open (simulated market hours)"""
        if not self.paper_config.market_hours_only:
            return True

        now = datetime.now()
        # Simple market hours: 9:30 AM - 4:00 PM ET, weekdays
        if now.weekday() >= 5:  # Weekend
            return False

        current_time = now.time()
        market_open = time(9, 30)  # 9:30 AM
        market_close = time(16, 0)  # 4:00 PM

        return market_open <= current_time <= market_close

    async def place_order(self, request: PlaceOrderRequest) -> PlaceOrderResponse:
        """Place order in paper trading system"""
        try:
            await self._check_rate_limit()
            self._validate_order_request(request.order)

            # Check market hours if required
            if not request.order.extended_hours:
                await self._validate_market_hours()

            # Simulate order rejection
            if random.random() < self.paper_config.rejection_probability:
                return PlaceOrderResponse(
                    success=False,
                    error="Order rejected by simulated broker",
                    error_code="SIMULATED_REJECTION"
                )

            # Create order
            order = await self._create_order(request.order, request.account_id)

            # Check account balance
            await self._validate_buying_power(order)

            # Store order
            self._orders[order.order_id] = order
            self._cache_order(order)

            # Emit order event
            await self._emit_order_event(order, "ORDER_SUBMITTED")

            # Start async fill simulation
            asyncio.create_task(self._simulate_fill(order))

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
        """Cancel order in paper trading system"""
        try:
            await self._check_rate_limit()

            order = self._orders.get(request.order_id)
            if not order:
                raise OrderNotFoundError(f"Order {request.order_id} not found")

            # Only allow cancellation of pending/submitted orders
            if order.status not in [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.ACCEPTED]:
                return CancelOrderResponse(
                    success=False,
                    error=f"Cannot cancel order in status {order.status}",
                    error_code="INVALID_ORDER_STATUS"
                )

            # Update order status
            order.status = OrderStatus.CANCELED
            order.canceled_at = datetime.utcnow()
            order.updated_at = datetime.utcnow()

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
        """Modify order in paper trading system"""
        try:
            await self._check_rate_limit()

            order = self._orders.get(request.order_update.order_id)
            if not order:
                raise OrderNotFoundError(f"Order {request.order_update.order_id} not found")

            # Only allow modification of pending/submitted orders
            if order.status not in [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.ACCEPTED]:
                return ModifyOrderResponse(
                    success=False,
                    error=f"Cannot modify order in status {order.status}",
                    error_code="INVALID_ORDER_STATUS"
                )

            # Apply modifications
            update = request.order_update
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
            order = self._orders.get(request.order_id)
            if not order:
                raise OrderNotFoundError(f"Order {request.order_id} not found")

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
        """Get orders for account"""
        try:
            orders = list(self._orders.values())

            # Apply filters
            if request.status:
                orders = [o for o in orders if o.status == request.status]
            if request.symbol:
                orders = [o for o in orders if o.symbol == request.symbol]

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
        """Get positions for account"""
        try:
            positions = list(self._positions.values())

            # Apply symbol filter
            if request.symbol:
                positions = [p for p in positions if p.symbol == request.symbol]

            # Update positions with current prices
            for position in positions:
                await self._update_position_value(position)

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
        position = self._positions.get(symbol)
        if position:
            await self._update_position_value(position)
        return position

    async def get_account(self, request: GetAccountRequest) -> GetAccountResponse:
        """Get account information"""
        try:
            if not self._account:
                self._initialize_account()

            # Update account values
            await self._update_account_values()

            return GetAccountResponse(
                success=True,
                account=self._account
            )

        except Exception as e:
            return GetAccountResponse(
                success=False,
                error=str(e),
                error_code=type(e).__name__
            )

    # Helper Methods

    async def _create_order(self, order_request: OrderRequest, account_id: str) -> Order:
        """Create order from request"""
        self._order_counter += 1
        order_id = f"PAPER_{self._order_counter:08d}"

        client_order_id = order_request.client_order_id or self._generate_client_order_id()

        return Order(
            order_id=order_id,
            symbol=self._format_symbol(order_request.symbol),
            side=order_request.side,
            quantity=order_request.quantity,
            order_type=order_request.order_type,
            time_in_force=order_request.time_in_force,
            limit_price=order_request.limit_price,
            stop_price=order_request.stop_price,
            trail_amount=order_request.trail_amount,
            trail_percent=order_request.trail_percent,
            extended_hours=order_request.extended_hours,
            client_order_id=client_order_id,
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
                'paper_trading': True
            }
        )

    async def _validate_buying_power(self, order: Order) -> None:
        """Validate sufficient buying power for order"""
        if order.side == OrderSide.BUY:
            # Estimate order value
            estimated_price = order.limit_price or self._get_market_price(order.symbol)
            estimated_value = order.quantity * estimated_price

            if estimated_value > self._account.buying_power:
                raise InsufficientFundsError(f"Insufficient buying power: need {estimated_value}, have {self._account.buying_power}")

        elif order.side == OrderSide.SELL:
            # Check if we have the position to sell
            position = self._positions.get(order.symbol)
            if not position or position.quantity < order.quantity:
                available = position.quantity if position else Decimal('0')
                raise BrokerValidationError(f"Insufficient shares to sell: need {order.quantity}, have {available}")

    async def _simulate_fill(self, order: Order) -> None:
        """Simulate order fill with realistic behavior"""
        try:
            # Simulate processing delay
            delay_ms = self.paper_config.fill_delay_ms
            await asyncio.sleep(delay_ms / 1000.0)

            # Update order status to accepted
            order.status = OrderStatus.ACCEPTED
            order.updated_at = datetime.utcnow()
            await self._emit_order_event(order, "ORDER_ACCEPTED")

            # Simulate market order immediate fill or limit order conditions
            if order.order_type == OrderType.MARKET:
                await self._execute_market_order(order)
            elif order.order_type == OrderType.LIMIT:
                await self._execute_limit_order(order)
            elif order.order_type in [OrderType.STOP, OrderType.STOP_LIMIT]:
                await self._execute_stop_order(order)

        except Exception as e:
            logger.error(f"Fill simulation failed for order {order.order_id}: {e}")
            order.status = OrderStatus.REJECTED
            order.updated_at = datetime.utcnow()
            await self._emit_order_event(order, "ORDER_REJECTED")

    async def _execute_market_order(self, order: Order) -> None:
        """Execute market order with simulated slippage"""
        market_price = self._get_market_price(order.symbol)

        # Apply slippage
        slippage_factor = Decimal(str(self.paper_config.slippage_bps / 10000.0))
        if order.side == OrderSide.BUY:
            fill_price = market_price * (Decimal('1') + slippage_factor)
        else:
            fill_price = market_price * (Decimal('1') - slippage_factor)

        # Check for partial fill
        fill_quantity = order.remaining_quantity
        if random.random() < self.paper_config.partial_fill_probability:
            fill_quantity = order.remaining_quantity * Decimal(str(random.uniform(0.5, 0.95)))
            fill_quantity = fill_quantity.quantize(Decimal('1'))

        await self._execute_fill(order, fill_quantity, fill_price)

    async def _execute_limit_order(self, order: Order) -> None:
        """Execute limit order if price conditions met"""
        market_price = self._get_market_price(order.symbol)

        # Check if limit order can execute
        can_execute = False
        if order.side == OrderSide.BUY and market_price <= order.limit_price:
            can_execute = True
        elif order.side == OrderSide.SELL and market_price >= order.limit_price:
            can_execute = True

        if can_execute:
            # Use limit price for execution
            fill_price = order.limit_price

            # Check for partial fill
            fill_quantity = order.remaining_quantity
            if random.random() < self.paper_config.partial_fill_probability:
                fill_quantity = order.remaining_quantity * Decimal(str(random.uniform(0.3, 0.8)))
                fill_quantity = fill_quantity.quantize(Decimal('1'))

            await self._execute_fill(order, fill_quantity, fill_price)

    async def _execute_stop_order(self, order: Order) -> None:
        """Execute stop order (simplified simulation)"""
        market_price = self._get_market_price(order.symbol)

        # Check if stop is triggered
        triggered = False
        if order.side == OrderSide.BUY and market_price >= order.stop_price:
            triggered = True
        elif order.side == OrderSide.SELL and market_price <= order.stop_price:
            triggered = True

        if triggered:
            # Convert to market order and execute
            fill_price = market_price
            await self._execute_fill(order, order.remaining_quantity, fill_price)

    async def _execute_fill(self, order: Order, quantity: Decimal, price: Decimal) -> None:
        """Execute fill for order"""
        # Calculate commission
        commission = Decimal('0')
        if self.paper_config.simulate_commissions:
            commission = self._calculate_commission(quantity, price)

        # Create fill
        fill = Fill(
            fill_id=f"FILL_{uuid.uuid4().hex[:8]}",
            order_id=order.order_id,
            symbol=order.symbol,
            side=order.side,
            quantity=quantity,
            price=price,
            commission=commission,
            timestamp=datetime.utcnow(),
            venue="PAPER_EXCHANGE"
        )

        # Update order
        order.filled_quantity += quantity
        order.remaining_quantity -= quantity
        order.commission += commission

        # Update average fill price
        if order.average_fill_price is None:
            order.average_fill_price = price
        else:
            total_filled_value = (order.average_fill_price * (order.filled_quantity - quantity)) + (price * quantity)
            order.average_fill_price = total_filled_value / order.filled_quantity

        # Update order status
        if order.remaining_quantity <= 0:
            order.status = OrderStatus.FILLED
            order.filled_at = datetime.utcnow()
        else:
            order.status = OrderStatus.PARTIALLY_FILLED

        order.updated_at = datetime.utcnow()

        # Store fill
        if order.order_id not in self._fills:
            self._fills[order.order_id] = []
        self._fills[order.order_id].append(fill)

        # Update position
        await self._update_position(order, fill)

        # Update account
        await self._update_account_after_fill(order, fill)

        # Emit events
        await self._emit_order_event(order, "ORDER_FILLED" if order.status == OrderStatus.FILLED else "ORDER_PARTIALLY_FILLED")

    async def _update_position(self, order: Order, fill: Fill) -> None:
        """Update position after fill"""
        symbol = order.symbol
        existing_position = self._positions.get(symbol)

        if not existing_position:
            # Create new position
            side = PositionSide.LONG if order.side == OrderSide.BUY else PositionSide.SHORT
            position = Position(
                symbol=symbol,
                side=side,
                quantity=fill.quantity if order.side == OrderSide.BUY else -fill.quantity,
                market_value=fill.quantity * fill.price,
                cost_basis=fill.quantity * fill.price + fill.commission,
                average_cost=fill.price,
                unrealized_pnl=Decimal('0'),
                unrealized_pnl_percent=Decimal('0'),
                current_price=fill.price,
                last_updated=datetime.utcnow()
            )
            self._positions[symbol] = position
        else:
            # Update existing position
            if order.side == OrderSide.BUY:
                new_quantity = existing_position.quantity + fill.quantity
                new_cost_basis = existing_position.cost_basis + (fill.quantity * fill.price) + fill.commission
            else:
                new_quantity = existing_position.quantity - fill.quantity
                new_cost_basis = existing_position.cost_basis - (fill.quantity * fill.price) - fill.commission

            existing_position.quantity = new_quantity
            existing_position.cost_basis = new_cost_basis
            if new_quantity != 0:
                existing_position.average_cost = abs(new_cost_basis / new_quantity)
            existing_position.last_updated = datetime.utcnow()

            # Remove position if quantity is zero
            if new_quantity == 0:
                del self._positions[symbol]

    async def _update_account_after_fill(self, order: Order, fill: Fill) -> None:
        """Update account after fill"""
        fill_value = fill.quantity * fill.price
        total_cost = fill_value + fill.commission

        if order.side == OrderSide.BUY:
            self._account.cash -= total_cost
        else:
            self._account.cash += fill_value - fill.commission

        # Update other account values
        await self._update_account_values()

    async def _update_account_values(self) -> None:
        """Update calculated account values"""
        if not self._account:
            return

        # Calculate market values
        long_value = Decimal('0')
        short_value = Decimal('0')

        for position in self._positions.values():
            await self._update_position_value(position)
            if position.quantity > 0:
                long_value += position.market_value
            else:
                short_value += abs(position.market_value)

        self._account.long_market_value = long_value
        self._account.short_market_value = short_value
        self._account.portfolio_value = self._account.cash + long_value - short_value
        self._account.equity = self._account.portfolio_value
        self._account.buying_power = self._account.cash * Decimal('2')  # 2:1 margin
        self._account.last_updated = datetime.utcnow()

    async def _update_position_value(self, position: Position) -> None:
        """Update position market value with current price"""
        current_price = self._get_market_price(position.symbol)
        position.current_price = current_price
        position.market_value = abs(position.quantity) * current_price

        # Calculate unrealized P&L
        if position.quantity != 0:
            total_cost = position.cost_basis
            current_value = position.quantity * current_price
            position.unrealized_pnl = current_value - total_cost
            if total_cost != 0:
                position.unrealized_pnl_percent = (position.unrealized_pnl / abs(total_cost)) * Decimal('100')

    def _get_market_price(self, symbol: str) -> Decimal:
        """Get simulated market price"""
        base_price = self._market_prices.get(symbol, Decimal('100.00'))

        # Add some random price movement (±2%)
        variation = random.uniform(-0.02, 0.02)
        price = base_price * (Decimal('1') + Decimal(str(variation)))

        # Update the base price for next time
        self._market_prices[symbol] = price

        return price.quantize(Decimal('0.01'))

    def _calculate_commission(self, quantity: Decimal, price: Decimal) -> Decimal:
        """Calculate commission for paper trading"""
        if not self.paper_config.simulate_commissions:
            return Decimal('0')

        commission = quantity * self.paper_config.commission_per_share
        return max(commission, self.paper_config.minimum_commission)