"""
WebSocket information and management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict

from app.services.websocket_manager import ConnectionManager
from app.services.auth_service import AuthService
from app.models.auth_schemas import User
from loguru import logger

router = APIRouter()

# Get the global connection manager instance
# This will be injected from main.py
connection_manager: ConnectionManager = None

# Initialize auth service
auth_service = AuthService()


def get_connection_manager():
    """Dependency to get connection manager"""
    if connection_manager is None:
        raise HTTPException(status_code=503, detail="WebSocket service not available")
    return connection_manager


@router.get("/connections")
async def get_active_connections(manager: ConnectionManager = Depends(get_connection_manager)):
    """Get information about active WebSocket connections"""
    try:
        stats = manager.get_connection_stats()
        return {
            "status": "active",
            "connections": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting connection info: {e}")
        raise HTTPException(status_code=500, detail="Error fetching connection information")


@router.get("/subscriptions/{client_id}")
async def get_client_subscriptions(
    client_id: str,
    manager: ConnectionManager = Depends(get_connection_manager)
):
    """Get subscriptions for a specific client"""
    try:
        if client_id not in manager.subscriptions:
            raise HTTPException(status_code=404, detail="Client not found")
        
        subscriptions = list(manager.subscriptions[client_id])
        
        return {
            "client_id": client_id,
            "subscriptions": subscriptions,
            "subscription_count": len(subscriptions)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting client subscriptions: {e}")
        raise HTTPException(status_code=500, detail="Error fetching client subscriptions")


@router.get("/symbols/{symbol}/subscribers")
async def get_symbol_subscribers(
    symbol: str,
    manager: ConnectionManager = Depends(get_connection_manager)
):
    """Get list of clients subscribed to a specific symbol"""
    try:
        symbol = symbol.upper()
        subscribers = list(manager.symbol_subscribers.get(symbol, set()))
        
        return {
            "symbol": symbol,
            "subscribers": subscribers,
            "subscriber_count": len(subscribers)
        }
        
    except Exception as e:
        logger.error(f"Error getting symbol subscribers: {e}")
        raise HTTPException(status_code=500, detail="Error fetching symbol subscribers")


@router.post("/broadcast/test")
async def broadcast_test_message(
    message: dict,
    manager: ConnectionManager = Depends(get_connection_manager),
    current_user: User = Depends(auth_service.get_current_user_optional)
):
    """Broadcast a test message to all connected clients (admin only)"""
    try:
        # Add broadcast metadata
        test_message = {
            "type": "test_broadcast",
            "sender": "admin",
            "data": message
        }
        
        await manager.broadcast_to_all(test_message)
        
        stats = manager.get_connection_stats()
        
        return {
            "message": "Test message broadcasted successfully",
            "recipients": stats["active_connections"],
            "broadcast_data": test_message
        }
        
    except Exception as e:
        logger.error(f"Error broadcasting test message: {e}")
        raise HTTPException(status_code=500, detail="Error broadcasting test message")


@router.post("/broadcast/symbol/{symbol}")
async def broadcast_to_symbol(
    symbol: str,
    message: dict,
    manager: ConnectionManager = Depends(get_connection_manager),
    current_user: User = Depends(auth_service.get_current_user_optional)
):
    """Broadcast a message to all clients subscribed to a specific symbol"""
    try:
        symbol = symbol.upper()
        
        symbol_message = {
            "type": "symbol_broadcast",
            "symbol": symbol,
            "data": message
        }
        
        await manager.broadcast_to_symbol_subscribers(symbol, symbol_message)
        
        subscribers = list(manager.symbol_subscribers.get(symbol, set()))
        
        return {
            "message": f"Message broadcasted to {symbol} subscribers",
            "symbol": symbol,
            "recipients": len(subscribers),
            "subscriber_list": subscribers,
            "broadcast_data": symbol_message
        }
        
    except Exception as e:
        logger.error(f"Error broadcasting to symbol {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error broadcasting to symbol {symbol}")


@router.delete("/connections/{client_id}")
async def disconnect_client(
    client_id: str,
    manager: ConnectionManager = Depends(get_connection_manager),
    current_user: User = Depends(auth_service.get_current_user_optional)
):
    """Manually disconnect a specific client (admin only)"""
    try:
        if client_id not in manager.active_connections:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Get client info before disconnecting
        subscriptions = list(manager.subscriptions.get(client_id, set()))
        
        # Disconnect client
        manager.disconnect(client_id)
        
        return {
            "message": f"Client {client_id} disconnected successfully",
            "client_id": client_id,
            "previous_subscriptions": subscriptions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting client {client_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error disconnecting client {client_id}")


@router.get("/health")
async def websocket_health_check(manager: ConnectionManager = Depends(get_connection_manager)):
    """Health check for WebSocket service"""
    try:
        stats = manager.get_connection_stats()
        
        return {
            "status": "healthy",
            "websocket_service": "operational",
            "active_connections": stats["active_connections"],
            "total_subscriptions": stats["total_subscriptions"],
            "unique_symbols": stats["unique_symbols"]
        }
        
    except Exception as e:
        logger.error(f"WebSocket health check failed: {e}")
        raise HTTPException(status_code=503, detail="WebSocket service unhealthy")


# Inject connection manager (called from main.py)
def set_connection_manager(manager: ConnectionManager):
    """Set the global connection manager instance"""
    global connection_manager
    connection_manager = manager