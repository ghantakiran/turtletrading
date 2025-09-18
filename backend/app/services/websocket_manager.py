"""
WebSocket connection manager for real-time market data streaming with Redis pub/sub integration
"""

from typing import Dict, List, Set, Optional
from fastapi import WebSocket
import json
from datetime import datetime
import asyncio
from loguru import logger


class ConnectionManager:
    """Manages WebSocket connections and real-time data streaming with Redis integration"""

    def __init__(self):
        # Active connections: client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

        # Subscriptions: client_id -> Set of symbols
        self.subscriptions: Dict[str, Set[str]] = {}

        # Symbol subscribers: symbol -> Set of client_ids
        self.symbol_subscribers: Dict[str, Set[str]] = {}

        # Redis streamer (will be set externally)
        self.redis_streamer: Optional[object] = None
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = set()
        
        logger.info(f"WebSocket client {client_id} connected")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Connected to TurtleTrading real-time data stream"
        }, client_id)
    
    def disconnect(self, client_id: str):
        """Remove WebSocket connection and cleanup subscriptions"""
        if client_id in self.active_connections:
            # Clean up subscriptions
            if client_id in self.subscriptions:
                symbols = self.subscriptions[client_id].copy()
                for symbol in symbols:
                    self._remove_subscription(client_id, symbol)
                del self.subscriptions[client_id]
            
            # Remove connection
            del self.active_connections[client_id]
            logger.info(f"WebSocket client {client_id} disconnected and cleaned up")
    
    async def send_personal_message(self, message: dict, client_id: str):
        """Send message to specific client"""
        if client_id in self.active_connections:
            try:
                websocket = self.active_connections[client_id]
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {e}")
                self.disconnect(client_id)
    
    async def broadcast_to_symbol_subscribers(self, symbol: str, message: dict):
        """Broadcast message to all clients subscribed to a symbol"""
        if symbol in self.symbol_subscribers:
            subscribers = self.symbol_subscribers[symbol].copy()
            
            # Add symbol to message
            message["symbol"] = symbol
            message["timestamp"] = datetime.utcnow().isoformat()
            
            for client_id in subscribers:
                await self.send_personal_message(message, client_id)
    
    async def broadcast_to_all(self, message: dict):
        """Broadcast message to all connected clients"""
        message["timestamp"] = datetime.utcnow().isoformat()
        
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)
    
    async def subscribe_to_symbols(self, client_id: str, symbols: List[str]):
        """Subscribe client to symbol updates and notify Redis streamer"""
        if client_id not in self.subscriptions:
            self.subscriptions[client_id] = set()

        for symbol in symbols:
            symbol = symbol.upper().strip()
            if symbol:
                self._add_subscription(client_id, symbol)

        # Notify Redis streamer about new subscriptions
        if self.redis_streamer:
            await self.redis_streamer.handle_client_subscription(client_id, symbols)

        logger.info(f"Client {client_id} subscribed to symbols: {symbols}")
    
    async def unsubscribe_from_symbols(self, client_id: str, symbols: List[str]):
        """Unsubscribe client from symbol updates and notify Redis streamer"""
        for symbol in symbols:
            symbol = symbol.upper().strip()
            if symbol:
                self._remove_subscription(client_id, symbol)

        # Notify Redis streamer about unsubscriptions
        if self.redis_streamer:
            await self.redis_streamer.handle_client_unsubscription(client_id, symbols)

        logger.info(f"Client {client_id} unsubscribed from symbols: {symbols}")
    
    def _add_subscription(self, client_id: str, symbol: str):
        """Add subscription tracking"""
        # Add to client's subscriptions
        self.subscriptions[client_id].add(symbol)
        
        # Add to symbol's subscribers
        if symbol not in self.symbol_subscribers:
            self.symbol_subscribers[symbol] = set()
        self.symbol_subscribers[symbol].add(client_id)
    
    def _remove_subscription(self, client_id: str, symbol: str):
        """Remove subscription tracking"""
        # Remove from client's subscriptions
        if client_id in self.subscriptions:
            self.subscriptions[client_id].discard(symbol)
        
        # Remove from symbol's subscribers
        if symbol in self.symbol_subscribers:
            self.symbol_subscribers[symbol].discard(client_id)
            
            # Clean up empty symbol entries
            if not self.symbol_subscribers[symbol]:
                del self.symbol_subscribers[symbol]
    
    def set_redis_streamer(self, redis_streamer):
        """Set the Redis streamer instance for pub/sub integration"""
        self.redis_streamer = redis_streamer
        logger.info("🔗 Redis streamer connected to WebSocket manager")

    def get_connection_stats(self) -> dict:
        """Get current connection statistics"""
        redis_status = {}
        if self.redis_streamer:
            redis_status = self.redis_streamer.get_status()

        return {
            "active_connections": len(self.active_connections),
            "total_subscriptions": sum(len(subs) for subs in self.subscriptions.values()),
            "unique_symbols": len(self.symbol_subscribers),
            "clients": list(self.active_connections.keys()),
            "symbols": list(self.symbol_subscribers.keys()),
            "redis_streaming": redis_status
        }
    
    async def send_market_update(self, symbol: str, data: dict):
        """Send market data update to subscribed clients"""
        market_message = {
            "type": "market_update",
            "symbol": symbol,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_symbol_subscribers(symbol, market_message)
    
    async def send_sentiment_update(self, symbol: str, sentiment_data: dict):
        """Send sentiment analysis update to subscribed clients"""
        sentiment_message = {
            "type": "sentiment_update", 
            "symbol": symbol,
            "sentiment": sentiment_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_symbol_subscribers(symbol, sentiment_message)
    
    async def send_lstm_prediction(self, symbol: str, prediction_data: dict):
        """Send LSTM prediction update to subscribed clients"""
        prediction_message = {
            "type": "lstm_prediction",
            "symbol": symbol,
            "prediction": prediction_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_symbol_subscribers(symbol, prediction_message)