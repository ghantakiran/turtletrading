"""
WebSocket Service for Real-time Market Data Streaming
Implements REQ-MARKET-01: Real-time WebSocket streaming per Claude.MarketData.md
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Dict, List, Set, Optional, Any, Callable
from fastapi import WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager
import redis.asyncio as redis
from dataclasses import dataclass, asdict
import uuid

from app.core.config import settings
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


@dataclass
class WebSocketConnection:
    """WebSocket connection metadata"""
    websocket: WebSocket
    client_id: str
    user_id: Optional[str]
    connected_at: datetime
    last_ping: datetime
    subscriptions: Set[str]
    subscription_types: Set[str]
    ip_address: str


@dataclass
class MarketDataMessage:
    """Market data message structure"""
    type: str
    symbol: str
    data: Dict[str, Any]
    timestamp: datetime
    source: str = "turtletrading"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "symbol": self.symbol,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source
        }


class WebSocketManager(BaseService):
    """
    Advanced WebSocket Manager for real-time market data streaming
    Implements comprehensive connection management, subscription handling, and broadcasting
    """

    def __init__(self):
        super().__init__()
        self.connections: Dict[str, WebSocketConnection] = {}
        self.symbol_subscribers: Dict[str, Set[str]] = {}
        self.user_connections: Dict[str, Set[str]] = {}
        self.broadcast_queue: asyncio.Queue = asyncio.Queue()
        self.redis_client: Optional[redis.Redis] = None
        self.heartbeat_interval = 30  # seconds
        self.message_rate_limit = 100  # messages per minute per connection
        self.connection_rate_tracker: Dict[str, List[float]] = {}
        self.is_running = False

    async def initialize(self):
        """Initialize WebSocket manager with Redis connection"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("WebSocket manager initialized with Redis connection")

            # Start background tasks
            self.is_running = True
            asyncio.create_task(self._heartbeat_monitor())
            asyncio.create_task(self._broadcast_worker())
            asyncio.create_task(self._redis_listener())

        except Exception as e:
            logger.error(f"Failed to initialize WebSocket manager: {e}")
            raise

    async def shutdown(self):
        """Gracefully shutdown WebSocket manager"""
        self.is_running = False

        # Close all connections
        for connection in list(self.connections.values()):
            try:
                await connection.websocket.close(code=1001, reason="Server shutdown")
            except Exception:
                pass

        # Close Redis connection
        if self.redis_client:
            await self.redis_client.close()

        logger.info("WebSocket manager shutdown complete")

    async def connect_client(
        self,
        websocket: WebSocket,
        client_id: str,
        user_id: Optional[str] = None,
        ip_address: str = "unknown"
    ) -> str:
        """
        Connect a new WebSocket client

        Args:
            websocket: WebSocket connection
            client_id: Unique client identifier
            user_id: Optional authenticated user ID
            ip_address: Client IP address

        Returns:
            Connection ID
        """
        try:
            await websocket.accept()

            connection_id = str(uuid.uuid4())
            now = datetime.utcnow()

            connection = WebSocketConnection(
                websocket=websocket,
                client_id=client_id,
                user_id=user_id,
                connected_at=now,
                last_ping=now,
                subscriptions=set(),
                subscription_types=set(),
                ip_address=ip_address
            )

            self.connections[connection_id] = connection

            # Track user connections
            if user_id:
                if user_id not in self.user_connections:
                    self.user_connections[user_id] = set()
                self.user_connections[user_id].add(connection_id)

            # Send welcome message
            await self._send_message(connection_id, {
                "type": "connection_established",
                "connection_id": connection_id,
                "client_id": client_id,
                "server_time": now.isoformat(),
                "features": {
                    "real_time_quotes": True,
                    "technical_indicators": True,
                    "market_sentiment": True,
                    "alerts": True
                }
            })

            # Store connection info in Redis
            if self.redis_client:
                await self.redis_client.hset(
                    f"ws_connection:{connection_id}",
                    mapping={
                        "client_id": client_id,
                        "user_id": user_id or "",
                        "connected_at": now.isoformat(),
                        "ip_address": ip_address
                    }
                )

            logger.info(f"WebSocket client connected: {client_id} (connection: {connection_id})")
            return connection_id

        except Exception as e:
            logger.error(f"Error connecting WebSocket client {client_id}: {e}")
            raise

    async def disconnect_client(self, connection_id: str, reason: str = "client_disconnect"):
        """Disconnect a WebSocket client"""
        try:
            if connection_id not in self.connections:
                return

            connection = self.connections[connection_id]

            # Remove from all subscriptions
            for symbol in list(connection.subscriptions):
                await self._unsubscribe_symbol(connection_id, symbol)

            # Remove from user connections
            if connection.user_id and connection.user_id in self.user_connections:
                self.user_connections[connection.user_id].discard(connection_id)
                if not self.user_connections[connection.user_id]:
                    del self.user_connections[connection.user_id]

            # Remove connection
            del self.connections[connection_id]

            # Clean up Redis
            if self.redis_client:
                await self.redis_client.delete(f"ws_connection:{connection_id}")

            logger.info(f"WebSocket client disconnected: {connection.client_id} ({reason})")

        except Exception as e:
            logger.error(f"Error disconnecting WebSocket client {connection_id}: {e}")

    async def subscribe_symbol(
        self,
        connection_id: str,
        symbol: str,
        data_types: List[str] = None
    ) -> bool:
        """
        Subscribe connection to symbol updates

        Args:
            connection_id: Connection identifier
            symbol: Stock symbol to subscribe to
            data_types: Types of data to receive (price, volume, technical, sentiment)

        Returns:
            Success status
        """
        try:
            if connection_id not in self.connections:
                logger.warning(f"Connection {connection_id} not found for symbol subscription")
                return False

            connection = self.connections[connection_id]
            data_types = data_types or ["price", "volume"]

            # Add to symbol subscribers
            if symbol not in self.symbol_subscribers:
                self.symbol_subscribers[symbol] = set()
            self.symbol_subscribers[symbol].add(connection_id)

            # Update connection subscriptions
            connection.subscriptions.add(symbol)
            connection.subscription_types.update(data_types)

            # Store subscription in Redis
            if self.redis_client:
                await self.redis_client.sadd(f"ws_subscriptions:{connection_id}", symbol)
                await self.redis_client.hset(
                    f"ws_subscription_types:{connection_id}:{symbol}",
                    mapping={dt: "1" for dt in data_types}
                )

            # Send confirmation
            await self._send_message(connection_id, {
                "type": "subscription_confirmed",
                "symbol": symbol,
                "data_types": data_types,
                "timestamp": datetime.utcnow().isoformat()
            })

            logger.info(f"Connection {connection_id} subscribed to {symbol} ({data_types})")
            return True

        except Exception as e:
            logger.error(f"Error subscribing to symbol {symbol}: {e}")
            return False

    async def unsubscribe_symbol(self, connection_id: str, symbol: str) -> bool:
        """Unsubscribe connection from symbol updates"""
        try:
            success = await self._unsubscribe_symbol(connection_id, symbol)

            if success:
                await self._send_message(connection_id, {
                    "type": "subscription_cancelled",
                    "symbol": symbol,
                    "timestamp": datetime.utcnow().isoformat()
                })

            return success

        except Exception as e:
            logger.error(f"Error unsubscribing from symbol {symbol}: {e}")
            return False

    async def _unsubscribe_symbol(self, connection_id: str, symbol: str) -> bool:
        """Internal unsubscribe method"""
        try:
            if connection_id not in self.connections:
                return False

            connection = self.connections[connection_id]

            # Remove from symbol subscribers
            if symbol in self.symbol_subscribers:
                self.symbol_subscribers[symbol].discard(connection_id)
                if not self.symbol_subscribers[symbol]:
                    del self.symbol_subscribers[symbol]

            # Update connection subscriptions
            connection.subscriptions.discard(symbol)

            # Clean up Redis
            if self.redis_client:
                await self.redis_client.srem(f"ws_subscriptions:{connection_id}", symbol)
                await self.redis_client.delete(f"ws_subscription_types:{connection_id}:{symbol}")

            logger.info(f"Connection {connection_id} unsubscribed from {symbol}")
            return True

        except Exception as e:
            logger.error(f"Error unsubscribing connection {connection_id} from {symbol}: {e}")
            return False

    async def broadcast_to_symbol(
        self,
        symbol: str,
        message_type: str,
        data: Dict[str, Any],
        data_type: str = "price"
    ):
        """
        Broadcast message to all subscribers of a symbol

        Args:
            symbol: Stock symbol
            message_type: Type of message (price_update, technical_update, etc.)
            data: Message data
            data_type: Type of data being broadcast
        """
        try:
            if symbol not in self.symbol_subscribers:
                return

            message = MarketDataMessage(
                type=message_type,
                symbol=symbol,
                data=data,
                timestamp=datetime.utcnow()
            )

            # Queue message for broadcasting
            await self.broadcast_queue.put((symbol, message.to_dict(), data_type))

            # Also publish to Redis for horizontal scaling
            if self.redis_client:
                await self.redis_client.publish(
                    f"market_data:{symbol}",
                    json.dumps(message.to_dict())
                )

        except Exception as e:
            logger.error(f"Error broadcasting to symbol {symbol}: {e}")

    async def broadcast_to_user(
        self,
        user_id: str,
        message_type: str,
        data: Dict[str, Any]
    ):
        """Broadcast message to all connections of a specific user"""
        try:
            if user_id not in self.user_connections:
                return

            message = {
                "type": message_type,
                "data": data,
                "timestamp": datetime.utcnow().isoformat(),
                "target": "user"
            }

            for connection_id in self.user_connections[user_id]:
                await self._send_message(connection_id, message)

        except Exception as e:
            logger.error(f"Error broadcasting to user {user_id}: {e}")

    async def broadcast_market_status(self, status: Dict[str, Any]):
        """Broadcast market status to all connected clients"""
        try:
            message = {
                "type": "market_status",
                "data": status,
                "timestamp": datetime.utcnow().isoformat()
            }

            # Send to all connections
            for connection_id in list(self.connections.keys()):
                await self._send_message(connection_id, message)

        except Exception as e:
            logger.error(f"Error broadcasting market status: {e}")

    async def handle_client_message(
        self,
        connection_id: str,
        message: Dict[str, Any]
    ):
        """Handle incoming message from WebSocket client"""
        try:
            if connection_id not in self.connections:
                return

            connection = self.connections[connection_id]

            # Rate limiting check
            if not await self._check_rate_limit(connection_id):
                await self._send_message(connection_id, {
                    "type": "error",
                    "message": "Rate limit exceeded",
                    "code": "RATE_LIMIT_EXCEEDED"
                })
                return

            message_type = message.get("type")

            if message_type == "ping":
                await self._handle_ping(connection_id)
            elif message_type == "subscribe":
                await self._handle_subscribe(connection_id, message)
            elif message_type == "unsubscribe":
                await self._handle_unsubscribe(connection_id, message)
            elif message_type == "get_subscriptions":
                await self._handle_get_subscriptions(connection_id)
            else:
                await self._send_message(connection_id, {
                    "type": "error",
                    "message": f"Unknown message type: {message_type}",
                    "code": "UNKNOWN_MESSAGE_TYPE"
                })

        except Exception as e:
            logger.error(f"Error handling client message from {connection_id}: {e}")

    async def _handle_ping(self, connection_id: str):
        """Handle ping message"""
        try:
            connection = self.connections[connection_id]
            connection.last_ping = datetime.utcnow()

            await self._send_message(connection_id, {
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            })

        except Exception as e:
            logger.error(f"Error handling ping from {connection_id}: {e}")

    async def _handle_subscribe(self, connection_id: str, message: Dict[str, Any]):
        """Handle subscription request"""
        try:
            symbol = message.get("symbol", "").upper()
            data_types = message.get("data_types", ["price"])

            if not symbol:
                await self._send_message(connection_id, {
                    "type": "error",
                    "message": "Symbol is required for subscription",
                    "code": "MISSING_SYMBOL"
                })
                return

            success = await self.subscribe_symbol(connection_id, symbol, data_types)

            if not success:
                await self._send_message(connection_id, {
                    "type": "error",
                    "message": f"Failed to subscribe to {symbol}",
                    "code": "SUBSCRIPTION_FAILED"
                })

        except Exception as e:
            logger.error(f"Error handling subscribe from {connection_id}: {e}")

    async def _handle_unsubscribe(self, connection_id: str, message: Dict[str, Any]):
        """Handle unsubscription request"""
        try:
            symbol = message.get("symbol", "").upper()

            if not symbol:
                await self._send_message(connection_id, {
                    "type": "error",
                    "message": "Symbol is required for unsubscription",
                    "code": "MISSING_SYMBOL"
                })
                return

            success = await self.unsubscribe_symbol(connection_id, symbol)

            if not success:
                await self._send_message(connection_id, {
                    "type": "error",
                    "message": f"Failed to unsubscribe from {symbol}",
                    "code": "UNSUBSCRIPTION_FAILED"
                })

        except Exception as e:
            logger.error(f"Error handling unsubscribe from {connection_id}: {e}")

    async def _handle_get_subscriptions(self, connection_id: str):
        """Handle request for current subscriptions"""
        try:
            if connection_id not in self.connections:
                return

            connection = self.connections[connection_id]

            await self._send_message(connection_id, {
                "type": "subscriptions_list",
                "subscriptions": list(connection.subscriptions),
                "subscription_types": list(connection.subscription_types),
                "timestamp": datetime.utcnow().isoformat()
            })

        except Exception as e:
            logger.error(f"Error getting subscriptions for {connection_id}: {e}")

    async def _send_message(self, connection_id: str, message: Dict[str, Any]):
        """Send message to specific connection"""
        try:
            if connection_id not in self.connections:
                return

            connection = self.connections[connection_id]
            await connection.websocket.send_text(json.dumps(message))

        except WebSocketDisconnect:
            await self.disconnect_client(connection_id, "websocket_disconnect")
        except Exception as e:
            logger.error(f"Error sending message to {connection_id}: {e}")
            await self.disconnect_client(connection_id, "send_error")

    async def _check_rate_limit(self, connection_id: str) -> bool:
        """Check if connection is within rate limits"""
        try:
            now = time.time()
            minute_ago = now - 60

            if connection_id not in self.connection_rate_tracker:
                self.connection_rate_tracker[connection_id] = []

            # Clean old timestamps
            timestamps = self.connection_rate_tracker[connection_id]
            self.connection_rate_tracker[connection_id] = [
                ts for ts in timestamps if ts > minute_ago
            ]

            # Check limit
            if len(self.connection_rate_tracker[connection_id]) >= self.message_rate_limit:
                return False

            # Add current timestamp
            self.connection_rate_tracker[connection_id].append(now)
            return True

        except Exception as e:
            logger.error(f"Error checking rate limit for {connection_id}: {e}")
            return True  # Allow on error

    async def _heartbeat_monitor(self):
        """Monitor connection health and send heartbeats"""
        while self.is_running:
            try:
                now = datetime.utcnow()
                stale_connections = []

                for connection_id, connection in self.connections.items():
                    # Check for stale connections
                    time_since_ping = (now - connection.last_ping).total_seconds()

                    if time_since_ping > self.heartbeat_interval * 3:  # 90 seconds timeout
                        stale_connections.append(connection_id)
                    elif time_since_ping > self.heartbeat_interval:  # Send heartbeat
                        await self._send_message(connection_id, {
                            "type": "heartbeat",
                            "timestamp": now.isoformat()
                        })

                # Disconnect stale connections
                for connection_id in stale_connections:
                    await self.disconnect_client(connection_id, "heartbeat_timeout")

                await asyncio.sleep(self.heartbeat_interval)

            except Exception as e:
                logger.error(f"Error in heartbeat monitor: {e}")
                await asyncio.sleep(5)

    async def _broadcast_worker(self):
        """Background worker for broadcasting messages"""
        while self.is_running:
            try:
                # Get message from queue with timeout
                try:
                    symbol, message, data_type = await asyncio.wait_for(
                        self.broadcast_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Get subscribers for this symbol
                if symbol not in self.symbol_subscribers:
                    continue

                # Send to all subscribers
                for connection_id in list(self.symbol_subscribers[symbol]):
                    if connection_id in self.connections:
                        connection = self.connections[connection_id]

                        # Check if connection wants this data type
                        if data_type in connection.subscription_types or not connection.subscription_types:
                            await self._send_message(connection_id, message)

            except Exception as e:
                logger.error(f"Error in broadcast worker: {e}")
                await asyncio.sleep(1)

    async def _redis_listener(self):
        """Listen for Redis pub/sub messages for horizontal scaling"""
        if not self.redis_client:
            return

        try:
            pubsub = self.redis_client.pubsub()
            await pubsub.psubscribe("market_data:*")

            while self.is_running:
                try:
                    message = await asyncio.wait_for(pubsub.get_message(), timeout=1.0)

                    if message and message["type"] == "pmessage":
                        channel = message["channel"]
                        symbol = channel.split(":")[-1]
                        data = json.loads(message["data"])

                        # Re-broadcast to local connections
                        if symbol in self.symbol_subscribers:
                            await self.broadcast_queue.put((symbol, data, "price"))

                except asyncio.TimeoutError:
                    continue

        except Exception as e:
            logger.error(f"Error in Redis listener: {e}")

    def get_connection_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        try:
            total_connections = len(self.connections)
            authenticated_connections = sum(
                1 for conn in self.connections.values() if conn.user_id
            )
            total_subscriptions = sum(
                len(conn.subscriptions) for conn in self.connections.values()
            )

            return {
                "total_connections": total_connections,
                "authenticated_connections": authenticated_connections,
                "anonymous_connections": total_connections - authenticated_connections,
                "total_subscriptions": total_subscriptions,
                "unique_symbols": len(self.symbol_subscribers),
                "active_symbols": len([s for s, subs in self.symbol_subscribers.items() if subs]),
                "avg_subscriptions_per_connection": (
                    total_subscriptions / total_connections if total_connections > 0 else 0
                )
            }

        except Exception as e:
            logger.error(f"Error getting connection stats: {e}")
            return {}


# Global instance
websocket_manager = WebSocketManager()