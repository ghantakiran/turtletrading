"""
Brokerage Models and Data Contracts

Defines comprehensive data models for brokerage integration including
orders, positions, accounts, and execution tracking.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from decimal import Decimal
from enum import Enum
import uuid


class OrderSide(str, Enum):
    """Order side enumeration"""
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    """Order type enumeration"""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"


class OrderTimeInForce(str, Enum):
    """Order time in force enumeration"""
    DAY = "day"
    GTC = "gtc"  # Good Till Canceled
    IOC = "ioc"  # Immediate or Cancel
    FOK = "fok"  # Fill or Kill


class OrderStatus(str, Enum):
    """Order status enumeration"""
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELED = "canceled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PositionSide(str, Enum):
    """Position side enumeration"""
    LONG = "long"
    SHORT = "short"


class BrokerType(str, Enum):
    """Supported broker types"""
    PAPER = "paper"
    ALPACA = "alpaca"
    INTERACTIVE_BROKERS = "interactive_brokers"
    TD_AMERITRADE = "td_ameritrade"


class AccountType(str, Enum):
    """Account type enumeration"""
    CASH = "cash"
    MARGIN = "margin"
    PDT = "pdt"  # Pattern Day Trader


# Base Models

class OrderBase(BaseModel):
    """Base order model with common fields"""
    symbol: str = Field(..., description="Stock symbol")
    side: OrderSide = Field(..., description="Order side (buy/sell)")
    quantity: Decimal = Field(..., gt=0, description="Order quantity")
    order_type: OrderType = Field(..., description="Order type")
    time_in_force: OrderTimeInForce = Field(default=OrderTimeInForce.DAY, description="Time in force")
    limit_price: Optional[Decimal] = Field(None, description="Limit price for limit orders")
    stop_price: Optional[Decimal] = Field(None, description="Stop price for stop orders")
    trail_amount: Optional[Decimal] = Field(None, description="Trail amount for trailing stops")
    trail_percent: Optional[Decimal] = Field(None, description="Trail percent for trailing stops")
    extended_hours: bool = Field(default=False, description="Allow extended hours trading")
    client_order_id: Optional[str] = Field(None, description="Client-generated order ID")

    @validator('limit_price')
    def validate_limit_price(cls, v, values):
        order_type = values.get('order_type')
        if order_type in [OrderType.LIMIT, OrderType.STOP_LIMIT] and v is None:
            raise ValueError(f"Limit price required for {order_type} orders")
        return v

    @validator('stop_price')
    def validate_stop_price(cls, v, values):
        order_type = values.get('order_type')
        if order_type in [OrderType.STOP, OrderType.STOP_LIMIT, OrderType.TRAILING_STOP] and v is None:
            raise ValueError(f"Stop price required for {order_type} orders")
        return v


class OrderRequest(OrderBase):
    """Order creation request"""
    pass


class Order(OrderBase):
    """Complete order model with execution details"""
    order_id: str = Field(..., description="Broker order ID")
    status: OrderStatus = Field(..., description="Order status")
    filled_quantity: Decimal = Field(default=Decimal('0'), description="Filled quantity")
    remaining_quantity: Decimal = Field(..., description="Remaining quantity")
    average_fill_price: Optional[Decimal] = Field(None, description="Average fill price")
    commission: Decimal = Field(default=Decimal('0'), description="Commission paid")
    created_at: datetime = Field(..., description="Order creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    submitted_at: Optional[datetime] = Field(None, description="Submission timestamp")
    filled_at: Optional[datetime] = Field(None, description="Fill timestamp")
    canceled_at: Optional[datetime] = Field(None, description="Cancellation timestamp")
    broker_metadata: Dict[str, Any] = Field(default_factory=dict, description="Broker-specific metadata")
    idempotency_key: Optional[str] = Field(None, description="Idempotency key for duplicate prevention")

    @validator('remaining_quantity', always=True)
    def calculate_remaining_quantity(cls, v, values):
        quantity = values.get('quantity', Decimal('0'))
        filled_quantity = values.get('filled_quantity', Decimal('0'))
        return quantity - filled_quantity


class OrderUpdate(BaseModel):
    """Order update model for modifications"""
    order_id: str = Field(..., description="Order ID to update")
    limit_price: Optional[Decimal] = Field(None, description="New limit price")
    stop_price: Optional[Decimal] = Field(None, description="New stop price")
    quantity: Optional[Decimal] = Field(None, description="New quantity")
    time_in_force: Optional[OrderTimeInForce] = Field(None, description="New time in force")


class Position(BaseModel):
    """Position model"""
    symbol: str = Field(..., description="Stock symbol")
    side: PositionSide = Field(..., description="Position side")
    quantity: Decimal = Field(..., description="Position quantity")
    market_value: Decimal = Field(..., description="Current market value")
    cost_basis: Decimal = Field(..., description="Total cost basis")
    average_cost: Decimal = Field(..., description="Average cost per share")
    unrealized_pnl: Decimal = Field(..., description="Unrealized P&L")
    unrealized_pnl_percent: Decimal = Field(..., description="Unrealized P&L percentage")
    current_price: Decimal = Field(..., description="Current market price")
    last_updated: datetime = Field(..., description="Last update timestamp")
    broker_metadata: Dict[str, Any] = Field(default_factory=dict, description="Broker-specific metadata")


class Account(BaseModel):
    """Account model"""
    account_id: str = Field(..., description="Account identifier")
    account_type: AccountType = Field(..., description="Account type")
    broker_type: BrokerType = Field(..., description="Broker type")
    cash: Decimal = Field(..., description="Available cash")
    buying_power: Decimal = Field(..., description="Buying power")
    portfolio_value: Decimal = Field(..., description="Total portfolio value")
    equity: Decimal = Field(..., description="Account equity")
    long_market_value: Decimal = Field(default=Decimal('0'), description="Long market value")
    short_market_value: Decimal = Field(default=Decimal('0'), description="Short market value")
    day_trade_count: int = Field(default=0, description="Pattern day trade count")
    is_day_trade_restricted: bool = Field(default=False, description="Day trade restriction status")
    maintenance_margin: Decimal = Field(default=Decimal('0'), description="Maintenance margin")
    initial_margin: Decimal = Field(default=Decimal('0'), description="Initial margin")
    last_updated: datetime = Field(..., description="Last update timestamp")
    broker_metadata: Dict[str, Any] = Field(default_factory=dict, description="Broker-specific metadata")


class Fill(BaseModel):
    """Order fill/execution model"""
    fill_id: str = Field(..., description="Fill identifier")
    order_id: str = Field(..., description="Associated order ID")
    symbol: str = Field(..., description="Stock symbol")
    side: OrderSide = Field(..., description="Fill side")
    quantity: Decimal = Field(..., gt=0, description="Fill quantity")
    price: Decimal = Field(..., gt=0, description="Fill price")
    commission: Decimal = Field(default=Decimal('0'), description="Commission for this fill")
    timestamp: datetime = Field(..., description="Fill timestamp")
    venue: Optional[str] = Field(None, description="Execution venue")
    broker_metadata: Dict[str, Any] = Field(default_factory=dict, description="Broker-specific metadata")


class TradeConfirmation(BaseModel):
    """Trade confirmation model"""
    trade_id: str = Field(..., description="Trade identifier")
    order_id: str = Field(..., description="Original order ID")
    symbol: str = Field(..., description="Stock symbol")
    side: OrderSide = Field(..., description="Trade side")
    quantity: Decimal = Field(..., description="Total trade quantity")
    average_price: Decimal = Field(..., description="Average execution price")
    total_amount: Decimal = Field(..., description="Total trade amount")
    commission: Decimal = Field(..., description="Total commission")
    fees: Decimal = Field(default=Decimal('0'), description="Additional fees")
    settlement_date: datetime = Field(..., description="Settlement date")
    trade_date: datetime = Field(..., description="Trade date")
    fills: List[Fill] = Field(default_factory=list, description="Individual fills")


class OrderEvent(BaseModel):
    """Order event for state machine tracking"""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Event ID")
    order_id: str = Field(..., description="Order ID")
    event_type: str = Field(..., description="Event type")
    old_status: Optional[OrderStatus] = Field(None, description="Previous status")
    new_status: OrderStatus = Field(..., description="New status")
    quantity: Optional[Decimal] = Field(None, description="Related quantity")
    price: Optional[Decimal] = Field(None, description="Related price")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Event metadata")


class BrokerConfig(BaseModel):
    """Broker configuration model"""
    broker_type: BrokerType = Field(..., description="Broker type")
    is_paper_trading: bool = Field(default=True, description="Paper trading mode")
    api_key: Optional[str] = Field(None, description="API key")
    api_secret: Optional[str] = Field(None, description="API secret")
    base_url: Optional[str] = Field(None, description="API base URL")
    websocket_url: Optional[str] = Field(None, description="WebSocket URL")
    environment: str = Field(default="sandbox", description="Environment (sandbox/live)")
    connection_timeout: int = Field(default=30, description="Connection timeout seconds")
    rate_limit_per_minute: int = Field(default=200, description="Rate limit per minute")
    max_position_size: Optional[Decimal] = Field(None, description="Maximum position size")
    max_order_amount: Optional[Decimal] = Field(None, description="Maximum order amount")
    allowed_symbols: Optional[List[str]] = Field(None, description="Allowed trading symbols")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional configuration")


class PaperTradingConfig(BaseModel):
    """Paper trading specific configuration"""
    initial_cash: Decimal = Field(default=Decimal('100000'), description="Initial cash amount")
    fill_delay_ms: int = Field(default=100, description="Simulated fill delay in milliseconds")
    slippage_bps: int = Field(default=5, description="Simulated slippage in basis points")
    partial_fill_probability: float = Field(default=0.1, description="Probability of partial fills")
    rejection_probability: float = Field(default=0.01, description="Probability of order rejection")
    market_hours_only: bool = Field(default=True, description="Enforce market hours")
    simulate_commissions: bool = Field(default=True, description="Simulate commission charges")
    commission_per_share: Decimal = Field(default=Decimal('0.005'), description="Commission per share")
    minimum_commission: Decimal = Field(default=Decimal('1.00'), description="Minimum commission")


class WebhookPayload(BaseModel):
    """Webhook payload for broker notifications"""
    webhook_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Webhook ID")
    broker_type: BrokerType = Field(..., description="Source broker")
    event_type: str = Field(..., description="Event type")
    account_id: str = Field(..., description="Account ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    data: Dict[str, Any] = Field(..., description="Event data")
    signature: Optional[str] = Field(None, description="Webhook signature for verification")


class BrokerResponse(BaseModel):
    """Generic broker response wrapper"""
    success: bool = Field(..., description="Operation success status")
    data: Optional[Any] = Field(None, description="Response data")
    error: Optional[str] = Field(None, description="Error message")
    error_code: Optional[str] = Field(None, description="Error code")
    broker_request_id: Optional[str] = Field(None, description="Broker request ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")


# Request/Response Models

class PlaceOrderRequest(BaseModel):
    """Place order request"""
    order: OrderRequest = Field(..., description="Order details")
    account_id: str = Field(..., description="Trading account ID")
    dry_run: bool = Field(default=False, description="Dry run mode")


class PlaceOrderResponse(BrokerResponse):
    """Place order response"""
    order: Optional[Order] = Field(None, description="Created order")


class CancelOrderRequest(BaseModel):
    """Cancel order request"""
    order_id: str = Field(..., description="Order ID to cancel")
    account_id: str = Field(..., description="Trading account ID")


class CancelOrderResponse(BrokerResponse):
    """Cancel order response"""
    order: Optional[Order] = Field(None, description="Canceled order")


class ModifyOrderRequest(BaseModel):
    """Modify order request"""
    order_update: OrderUpdate = Field(..., description="Order update details")
    account_id: str = Field(..., description="Trading account ID")


class ModifyOrderResponse(BrokerResponse):
    """Modify order response"""
    order: Optional[Order] = Field(None, description="Modified order")


class GetPositionsRequest(BaseModel):
    """Get positions request"""
    account_id: str = Field(..., description="Trading account ID")
    symbol: Optional[str] = Field(None, description="Filter by symbol")


class GetPositionsResponse(BrokerResponse):
    """Get positions response"""
    positions: List[Position] = Field(default_factory=list, description="Account positions")


class GetAccountRequest(BaseModel):
    """Get account request"""
    account_id: str = Field(..., description="Trading account ID")


class GetAccountResponse(BrokerResponse):
    """Get account response"""
    account: Optional[Account] = Field(None, description="Account details")


class GetOrdersRequest(BaseModel):
    """Get orders request"""
    account_id: str = Field(..., description="Trading account ID")
    status: Optional[OrderStatus] = Field(None, description="Filter by status")
    symbol: Optional[str] = Field(None, description="Filter by symbol")
    limit: int = Field(default=100, le=1000, description="Maximum number of orders")


class GetOrdersResponse(BrokerResponse):
    """Get orders response"""
    orders: List[Order] = Field(default_factory=list, description="Orders list")


class GetOrderRequest(BaseModel):
    """Get order request"""
    order_id: str = Field(..., description="Order ID")
    account_id: str = Field(..., description="Trading account ID")


class GetOrderResponse(BrokerResponse):
    """Get order response"""
    order: Optional[Order] = Field(None, description="Order details")


# Streaming Models

class StreamingQuote(BaseModel):
    """Real-time quote data"""
    symbol: str = Field(..., description="Stock symbol")
    bid_price: Decimal = Field(..., description="Bid price")
    ask_price: Decimal = Field(..., description="Ask price")
    bid_size: int = Field(..., description="Bid size")
    ask_size: int = Field(..., description="Ask size")
    last_price: Decimal = Field(..., description="Last trade price")
    last_size: int = Field(..., description="Last trade size")
    timestamp: datetime = Field(..., description="Quote timestamp")


class StreamingEvent(BaseModel):
    """Streaming event wrapper"""
    event_type: str = Field(..., description="Event type")
    symbol: Optional[str] = Field(None, description="Related symbol")
    data: Any = Field(..., description="Event data")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")