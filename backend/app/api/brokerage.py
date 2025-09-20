"""
Brokerage API Endpoints

FastAPI endpoints for brokerage operations including order management,
position tracking, account information, and webhook processing.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Header, Request, BackgroundTasks
from fastapi.security import HTTPBearer
import logging

from ..models.brokerage_models import (
    PlaceOrderRequest, PlaceOrderResponse, CancelOrderRequest, CancelOrderResponse,
    ModifyOrderRequest, ModifyOrderResponse, GetOrderRequest, GetOrderResponse,
    GetOrdersRequest, GetOrdersResponse, GetPositionsRequest, GetPositionsResponse,
    GetAccountRequest, GetAccountResponse, BrokerConfig, BrokerType, WebhookPayload
)
from ..core.broker_adapter import BrokerAdapterFactory
from ..core.idempotency import get_idempotent_processor
from ..services.webhook_processor import get_webhook_processor, process_alpaca_webhook, process_ib_webhook, process_paper_webhook
from ..core.order_state_machine import get_default_lifecycle_manager

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/brokerage", tags=["brokerage"])

# Security
security = HTTPBearer()

# In-memory broker adapter registry (in production, this would be database-backed)
_broker_adapters: Dict[str, Any] = {}


async def get_current_user(token: str = Depends(security)):
    """Get current user from token (placeholder)"""
    # In production, this would validate JWT token and return user
    return {"user_id": "test_user", "account_id": "test_account"}


async def get_broker_adapter(
    broker_type: str,
    account_id: str,
    user: dict = Depends(get_current_user)
) -> Any:
    """Get broker adapter for account"""
    adapter_key = f"{broker_type}:{account_id}"

    if adapter_key not in _broker_adapters:
        # Create broker configuration (in production, load from database)
        config = BrokerConfig(
            broker_type=BrokerType(broker_type),
            is_paper_trading=True,  # Default to paper trading
            api_key="test_key",
            api_secret="test_secret",
            environment="sandbox"
        )

        # Create adapter
        try:
            adapter = BrokerAdapterFactory.create_adapter(config)
            await adapter.connect()
            _broker_adapters[adapter_key] = adapter
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create broker adapter: {e}")

    return _broker_adapters[adapter_key]


# Order Management Endpoints

@router.post("/orders", response_model=PlaceOrderResponse)
async def place_order(
    request: PlaceOrderRequest,
    broker_type: str = "paper",
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(get_current_user),
    adapter = Depends(get_broker_adapter)
):
    """
    Place a new order

    Supports idempotency keys to prevent duplicate order submissions.
    """
    try:
        # Get idempotent processor
        processor = get_idempotent_processor()

        # Process order with idempotency protection
        async def order_processor(req: PlaceOrderRequest):
            return await adapter.place_order(req)

        response = await processor.process_order_with_idempotency(
            request=request,
            order_processor=order_processor,
            user_id=user["user_id"],
            idempotency_key=idempotency_key
        )

        return response

    except Exception as e:
        logger.error(f"Error placing order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/orders/{order_id}", response_model=CancelOrderResponse)
async def cancel_order(
    order_id: str,
    account_id: str,
    broker_type: str = "paper",
    user: dict = Depends(get_current_user),
    adapter = Depends(get_broker_adapter)
):
    """Cancel an existing order"""
    try:
        request = CancelOrderRequest(order_id=order_id, account_id=account_id)
        response = await adapter.cancel_order(request)
        return response

    except Exception as e:
        logger.error(f"Error canceling order {order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/orders/{order_id}", response_model=ModifyOrderResponse)
async def modify_order(
    order_id: str,
    request: ModifyOrderRequest,
    broker_type: str = "paper",
    user: dict = Depends(get_current_user),
    adapter = Depends(get_broker_adapter)
):
    """Modify an existing order"""
    try:
        # Update order ID in request
        request.order_update.order_id = order_id
        response = await adapter.modify_order(request)
        return response

    except Exception as e:
        logger.error(f"Error modifying order {order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders/{order_id}", response_model=GetOrderResponse)
async def get_order(
    order_id: str,
    account_id: str,
    broker_type: str = "paper",
    user: dict = Depends(get_current_user),
    adapter = Depends(get_broker_adapter)
):
    """Get order details by ID"""
    try:
        request = GetOrderRequest(order_id=order_id, account_id=account_id)
        response = await adapter.get_order(request)
        return response

    except Exception as e:
        logger.error(f"Error getting order {order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders", response_model=GetOrdersResponse)
async def get_orders(
    account_id: str,
    status: Optional[str] = None,
    symbol: Optional[str] = None,
    limit: int = 50,
    broker_type: str = "paper",
    user: dict = Depends(get_current_user),
    adapter = Depends(get_broker_adapter)
):
    """Get orders for account with optional filtering"""
    try:
        # Convert status string to enum if provided
        status_enum = None
        if status:
            from ..models.brokerage_models import OrderStatus
            try:
                status_enum = OrderStatus(status.lower())
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

        request = GetOrdersRequest(
            account_id=account_id,
            status=status_enum,
            symbol=symbol,
            limit=limit
        )
        response = await adapter.get_orders(request)
        return response

    except Exception as e:
        logger.error(f"Error getting orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Position Management Endpoints

@router.get("/positions", response_model=GetPositionsResponse)
async def get_positions(
    account_id: str,
    symbol: Optional[str] = None,
    broker_type: str = "paper",
    user: dict = Depends(get_current_user),
    adapter = Depends(get_broker_adapter)
):
    """Get positions for account"""
    try:
        request = GetPositionsRequest(account_id=account_id, symbol=symbol)
        response = await adapter.get_positions(request)
        return response

    except Exception as e:
        logger.error(f"Error getting positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions/{symbol}")
async def get_position(
    symbol: str,
    account_id: str,
    broker_type: str = "paper",
    user: dict = Depends(get_current_user),
    adapter = Depends(get_broker_adapter)
):
    """Get specific position by symbol"""
    try:
        position = await adapter.get_position(account_id, symbol)
        if not position:
            raise HTTPException(status_code=404, detail=f"Position not found for {symbol}")
        return position

    except Exception as e:
        logger.error(f"Error getting position for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Account Management Endpoints

@router.get("/account", response_model=GetAccountResponse)
async def get_account(
    account_id: str,
    broker_type: str = "paper",
    user: dict = Depends(get_current_user),
    adapter = Depends(get_broker_adapter)
):
    """Get account information"""
    try:
        request = GetAccountRequest(account_id=account_id)
        response = await adapter.get_account(request)
        return response

    except Exception as e:
        logger.error(f"Error getting account {account_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Webhook Endpoints

@router.post("/webhooks/alpaca")
async def alpaca_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    signature: Optional[str] = Header(None, alias="X-Alpaca-Signature")
):
    """Process Alpaca webhook"""
    try:
        raw_body = await request.body()
        payload = await request.json()

        # Process webhook in background
        background_tasks.add_task(
            process_alpaca_webhook,
            payload,
            signature or "",
            raw_body
        )

        return {"status": "accepted"}

    except Exception as e:
        logger.error(f"Error processing Alpaca webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhooks/ib")
async def ib_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    signature: Optional[str] = Header(None, alias="X-IB-Signature")
):
    """Process Interactive Brokers webhook"""
    try:
        raw_body = await request.body()
        payload = await request.json()

        # Process webhook in background
        background_tasks.add_task(
            process_ib_webhook,
            payload,
            signature,
            raw_body
        )

        return {"status": "accepted"}

    except Exception as e:
        logger.error(f"Error processing IB webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhooks/paper")
async def paper_webhook(
    payload: Dict[str, Any],
    background_tasks: BackgroundTasks
):
    """Process paper trading webhook (for testing)"""
    try:
        # Process webhook in background
        background_tasks.add_task(process_paper_webhook, payload)
        return {"status": "accepted"}

    except Exception as e:
        logger.error(f"Error processing paper webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Administrative Endpoints

@router.get("/adapters")
async def list_adapters(user: dict = Depends(get_current_user)):
    """List active broker adapters"""
    adapters = []
    for key, adapter in _broker_adapters.items():
        broker_type, account_id = key.split(":", 1)
        adapters.append({
            "broker_type": broker_type,
            "account_id": account_id,
            "is_connected": adapter.is_connected,
            "last_heartbeat": adapter.last_heartbeat.isoformat() if adapter.last_heartbeat else None,
            "is_paper_trading": adapter.is_paper_trading()
        })

    return {"adapters": adapters}


@router.post("/adapters/{broker_type}/connect")
async def connect_adapter(
    broker_type: str,
    account_id: str,
    user: dict = Depends(get_current_user)
):
    """Connect to broker adapter"""
    try:
        adapter = await get_broker_adapter(broker_type, account_id, user)
        if not adapter.is_connected:
            await adapter.connect()

        return {
            "status": "connected",
            "broker_type": broker_type,
            "account_id": account_id,
            "is_connected": adapter.is_connected
        }

    except Exception as e:
        logger.error(f"Error connecting to {broker_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/adapters/{broker_type}/disconnect")
async def disconnect_adapter(
    broker_type: str,
    account_id: str,
    user: dict = Depends(get_current_user)
):
    """Disconnect from broker adapter"""
    try:
        adapter_key = f"{broker_type}:{account_id}"
        adapter = _broker_adapters.get(adapter_key)

        if adapter:
            await adapter.disconnect()
            del _broker_adapters[adapter_key]

        return {
            "status": "disconnected",
            "broker_type": broker_type,
            "account_id": account_id
        }

    except Exception as e:
        logger.error(f"Error disconnecting from {broker_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check for brokerage service"""
    try:
        # Check order state machine
        lifecycle_manager = get_default_lifecycle_manager()
        active_orders = lifecycle_manager.get_active_orders()

        # Check webhook processor
        webhook_processor = get_webhook_processor()
        webhook_stats = await webhook_processor.get_webhook_stats()

        # Check idempotency manager
        idempotent_processor = get_idempotent_processor()
        idempotency_stats = idempotent_processor.idempotency_manager.get_stats()

        return {
            "status": "healthy",
            "service": "brokerage",
            "active_adapters": len(_broker_adapters),
            "active_orders": len(active_orders),
            "webhook_stats": webhook_stats,
            "idempotency_stats": idempotency_stats,
            "supported_brokers": ["paper", "alpaca", "interactive_brokers"]
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@router.get("/market-status")
async def market_status(
    broker_type: str = "paper",
    user: dict = Depends(get_current_user)
):
    """Get market status from broker"""
    try:
        # Use a default account for market status
        adapter = await get_broker_adapter(broker_type, "default", user)
        is_open = await adapter.is_market_open()

        return {
            "market_open": is_open,
            "broker_type": broker_type,
            "timestamp": adapter.last_heartbeat.isoformat() if adapter.last_heartbeat else None
        }

    except Exception as e:
        logger.error(f"Error getting market status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Register broker adapters with factory
def register_broker_adapters():
    """Register all broker adapter classes with the factory"""
    from ..services.brokers.paper_broker import PaperBrokerAdapter
    from ..services.brokers.alpaca_broker import AlpacaBrokerAdapter
    from ..services.brokers.ib_broker import IBBrokerAdapter

    BrokerAdapterFactory.register_adapter("paper", PaperBrokerAdapter)
    BrokerAdapterFactory.register_adapter("alpaca", AlpacaBrokerAdapter)
    BrokerAdapterFactory.register_adapter("interactive_brokers", IBBrokerAdapter)


# Register adapters when module is imported
register_broker_adapters()