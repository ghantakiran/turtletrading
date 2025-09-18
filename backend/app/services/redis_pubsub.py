"""
Redis Pub/Sub service for real-time market data streaming
"""

import asyncio
import json
import redis.asyncio as aioredis
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from loguru import logger

from app.core.config import settings


class RedisPublisher:
    """Redis publisher for broadcasting market data updates"""

    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self.connected = False

    async def connect(self):
        """Connect to Redis server"""
        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                socket_keepalive_options={},
                health_check_interval=30
            )

            # Test connection
            await self.redis.ping()
            self.connected = True
            logger.info("✅ Redis publisher connected successfully")

        except Exception as e:
            logger.error(f"❌ Redis publisher connection failed: {e}")
            self.connected = False
            raise

    async def disconnect(self):
        """Disconnect from Redis server"""
        if self.redis:
            await self.redis.close()
            self.connected = False
            logger.info("🔌 Redis publisher disconnected")

    async def publish_market_data(self, symbol: str, data: Dict[str, Any]):
        """Publish market data update for a specific symbol"""
        if not self.connected:
            logger.warning("Redis publisher not connected, skipping market data publish")
            return

        try:
            channel = f"market_data:{symbol.upper()}"
            message = {
                "type": "market_update",
                "symbol": symbol.upper(),
                "data": data,
                "timestamp": datetime.utcnow().isoformat()
            }

            await self.redis.publish(channel, json.dumps(message))
            logger.debug(f"📊 Published market data for {symbol.upper()}")

        except Exception as e:
            logger.error(f"❌ Failed to publish market data for {symbol}: {e}")

    async def publish_sentiment_update(self, symbol: str, sentiment_data: Dict[str, Any]):
        """Publish sentiment analysis update for a specific symbol"""
        if not self.connected:
            logger.warning("Redis publisher not connected, skipping sentiment publish")
            return

        try:
            channel = f"sentiment:{symbol.upper()}"
            message = {
                "type": "sentiment_update",
                "symbol": symbol.upper(),
                "sentiment": sentiment_data,
                "timestamp": datetime.utcnow().isoformat()
            }

            await self.redis.publish(channel, json.dumps(message))
            logger.debug(f"🧠 Published sentiment update for {symbol.upper()}")

        except Exception as e:
            logger.error(f"❌ Failed to publish sentiment for {symbol}: {e}")

    async def publish_lstm_prediction(self, symbol: str, prediction_data: Dict[str, Any]):
        """Publish LSTM prediction update for a specific symbol"""
        if not self.connected:
            logger.warning("Redis publisher not connected, skipping LSTM publish")
            return

        try:
            channel = f"lstm_prediction:{symbol.upper()}"
            message = {
                "type": "lstm_prediction",
                "symbol": symbol.upper(),
                "prediction": prediction_data,
                "timestamp": datetime.utcnow().isoformat()
            }

            await self.redis.publish(channel, json.dumps(message))
            logger.debug(f"🤖 Published LSTM prediction for {symbol.upper()}")

        except Exception as e:
            logger.error(f"❌ Failed to publish LSTM prediction for {symbol}: {e}")

    async def publish_market_overview(self, overview_data: Dict[str, Any]):
        """Publish general market overview update"""
        if not self.connected:
            logger.warning("Redis publisher not connected, skipping market overview publish")
            return

        try:
            channel = "market_overview"
            message = {
                "type": "market_overview",
                "data": overview_data,
                "timestamp": datetime.utcnow().isoformat()
            }

            await self.redis.publish(channel, json.dumps(message))
            logger.debug("📈 Published market overview update")

        except Exception as e:
            logger.error(f"❌ Failed to publish market overview: {e}")


class RedisSubscriber:
    """Redis subscriber for receiving real-time market data updates"""

    def __init__(self, websocket_manager):
        self.redis: Optional[aioredis.Redis] = None
        self.pubsub: Optional[aioredis.client.PubSub] = None
        self.websocket_manager = websocket_manager
        self.subscribed_channels: Dict[str, int] = {}
        self.running = False
        self.connection_retry_count = 0
        self.max_retries = 5

    async def connect(self):
        """Connect to Redis server and initialize pub/sub"""
        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                socket_keepalive_options={},
                health_check_interval=30
            )

            # Test connection
            await self.redis.ping()

            # Initialize pub/sub
            self.pubsub = self.redis.pubsub()

            logger.info("✅ Redis subscriber connected successfully")
            self.connection_retry_count = 0

        except Exception as e:
            self.connection_retry_count += 1
            logger.error(f"❌ Redis subscriber connection failed (attempt {self.connection_retry_count}): {e}")

            if self.connection_retry_count < self.max_retries:
                await asyncio.sleep(2 ** self.connection_retry_count)  # Exponential backoff
                await self.connect()
            else:
                raise

    async def disconnect(self):
        """Disconnect from Redis server"""
        self.running = False

        if self.pubsub:
            await self.pubsub.close()

        if self.redis:
            await self.redis.close()

        logger.info("🔌 Redis subscriber disconnected")

    async def subscribe_to_symbol(self, symbol: str):
        """Subscribe to market data updates for a specific symbol"""
        if not self.pubsub:
            logger.warning("Redis subscriber not connected, cannot subscribe to symbol")
            return

        try:
            symbol = symbol.upper()
            channels_to_subscribe = [
                f"market_data:{symbol}",
                f"sentiment:{symbol}",
                f"lstm_prediction:{symbol}"
            ]

            for channel in channels_to_subscribe:
                if channel not in self.subscribed_channels:
                    await self.pubsub.subscribe(channel)
                    self.subscribed_channels[channel] = 1
                    logger.debug(f"📡 Subscribed to Redis channel: {channel}")
                else:
                    self.subscribed_channels[channel] += 1

        except Exception as e:
            logger.error(f"❌ Failed to subscribe to symbol {symbol}: {e}")

    async def unsubscribe_from_symbol(self, symbol: str):
        """Unsubscribe from market data updates for a specific symbol"""
        if not self.pubsub:
            logger.warning("Redis subscriber not connected, cannot unsubscribe from symbol")
            return

        try:
            symbol = symbol.upper()
            channels_to_unsubscribe = [
                f"market_data:{symbol}",
                f"sentiment:{symbol}",
                f"lstm_prediction:{symbol}"
            ]

            for channel in channels_to_unsubscribe:
                if channel in self.subscribed_channels:
                    self.subscribed_channels[channel] -= 1

                    if self.subscribed_channels[channel] <= 0:
                        await self.pubsub.unsubscribe(channel)
                        del self.subscribed_channels[channel]
                        logger.debug(f"📡 Unsubscribed from Redis channel: {channel}")

        except Exception as e:
            logger.error(f"❌ Failed to unsubscribe from symbol {symbol}: {e}")

    async def subscribe_to_market_overview(self):
        """Subscribe to general market overview updates"""
        if not self.pubsub:
            logger.warning("Redis subscriber not connected, cannot subscribe to market overview")
            return

        try:
            channel = "market_overview"
            if channel not in self.subscribed_channels:
                await self.pubsub.subscribe(channel)
                self.subscribed_channels[channel] = 1
                logger.debug(f"📡 Subscribed to Redis channel: {channel}")
            else:
                self.subscribed_channels[channel] += 1

        except Exception as e:
            logger.error(f"❌ Failed to subscribe to market overview: {e}")

    async def start_listening(self):
        """Start listening for Redis pub/sub messages and forward to WebSocket clients"""
        if not self.pubsub:
            logger.error("❌ Cannot start listening: Redis pub/sub not initialized")
            return

        self.running = True
        logger.info("🎧 Started Redis pub/sub listener")

        try:
            async for message in self.pubsub.listen():
                if not self.running:
                    break

                if message["type"] == "message":
                    await self._handle_redis_message(message)

        except Exception as e:
            logger.error(f"❌ Error in Redis listener: {e}")

            # Attempt to reconnect
            if self.running:
                logger.info("🔄 Attempting to reconnect Redis subscriber...")
                try:
                    await self.disconnect()
                    await asyncio.sleep(5)
                    await self.connect()
                    await self.start_listening()
                except Exception as reconnect_error:
                    logger.error(f"❌ Failed to reconnect Redis subscriber: {reconnect_error}")

    async def _handle_redis_message(self, message: Dict[str, Any]):
        """Handle incoming Redis pub/sub message"""
        try:
            channel = message["channel"]
            data = json.loads(message["data"])

            # Extract symbol from channel name
            if ":" in channel:
                channel_type, symbol = channel.split(":", 1)
            else:
                channel_type = channel
                symbol = None

            # Forward to appropriate WebSocket clients based on message type
            if channel_type == "market_data" and symbol:
                await self.websocket_manager.broadcast_to_symbol_subscribers(symbol, data)
            elif channel_type == "sentiment" and symbol:
                await self.websocket_manager.broadcast_to_symbol_subscribers(symbol, data)
            elif channel_type == "lstm_prediction" and symbol:
                await self.websocket_manager.broadcast_to_symbol_subscribers(symbol, data)
            elif channel_type == "market_overview":
                await self.websocket_manager.broadcast_to_all(data)

            logger.debug(f"📤 Forwarded Redis message from {channel} to WebSocket clients")

        except Exception as e:
            logger.error(f"❌ Error handling Redis message: {e}")


class RedisStreamer:
    """Combined Redis publisher and subscriber for real-time data streaming"""

    def __init__(self, websocket_manager):
        self.publisher = RedisPublisher()
        self.subscriber = RedisSubscriber(websocket_manager)
        self.websocket_manager = websocket_manager
        self.is_running = False
        self.listener_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start Redis streaming service"""
        try:
            # Connect publisher and subscriber
            await self.publisher.connect()
            await self.subscriber.connect()

            # Subscribe to market overview updates
            await self.subscriber.subscribe_to_market_overview()

            # Start background listener task
            self.listener_task = asyncio.create_task(self.subscriber.start_listening())
            self.is_running = True

            logger.info("🚀 Redis streaming service started successfully")

        except Exception as e:
            logger.error(f"❌ Failed to start Redis streaming service: {e}")
            await self.stop()
            raise

    async def stop(self):
        """Stop Redis streaming service"""
        self.is_running = False

        # Cancel listener task
        if self.listener_task and not self.listener_task.done():
            self.listener_task.cancel()
            try:
                await self.listener_task
            except asyncio.CancelledError:
                pass

        # Disconnect services
        await self.subscriber.disconnect()
        await self.publisher.disconnect()

        logger.info("🛑 Redis streaming service stopped")

    async def handle_client_subscription(self, client_id: str, symbols: List[str]):
        """Handle WebSocket client subscription to symbols"""
        for symbol in symbols:
            await self.subscriber.subscribe_to_symbol(symbol)

    async def handle_client_unsubscription(self, client_id: str, symbols: List[str]):
        """Handle WebSocket client unsubscription from symbols"""
        for symbol in symbols:
            await self.subscriber.unsubscribe_from_symbol(symbol)

    # Publisher methods for external use
    async def publish_market_data(self, symbol: str, data: Dict[str, Any]):
        """Publish market data update"""
        await self.publisher.publish_market_data(symbol, data)

    async def publish_sentiment_update(self, symbol: str, sentiment_data: Dict[str, Any]):
        """Publish sentiment analysis update"""
        await self.publisher.publish_sentiment_update(symbol, sentiment_data)

    async def publish_lstm_prediction(self, symbol: str, prediction_data: Dict[str, Any]):
        """Publish LSTM prediction update"""
        await self.publisher.publish_lstm_prediction(symbol, prediction_data)

    async def publish_market_overview(self, overview_data: Dict[str, Any]):
        """Publish market overview update"""
        await self.publisher.publish_market_overview(overview_data)

    def get_status(self) -> Dict[str, Any]:
        """Get Redis streaming service status"""
        return {
            "is_running": self.is_running,
            "publisher_connected": self.publisher.connected,
            "subscriber_channels": len(self.subscriber.subscribed_channels),
            "subscribed_channels": list(self.subscriber.subscribed_channels.keys())
        }