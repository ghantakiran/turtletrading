"""
Market data streaming service for real-time data simulation and publishing
"""

import asyncio
import yfinance as yf
from typing import List, Dict, Any
from datetime import datetime, timezone
import random
from loguru import logger

from app.core.config import settings
from app.services.redis_pubsub import RedisStreamer


class MarketDataStreamer:
    """Service for streaming real-time market data updates"""

    def __init__(self, redis_streamer: RedisStreamer):
        self.redis_streamer = redis_streamer
        self.running = False
        self.stream_task = None
        self.symbols = settings.DEFAULT_TICKERS
        self.update_interval = 30  # seconds

    async def start(self):
        """Start the market data streaming service"""
        if self.running:
            logger.warning("Market data streamer is already running")
            return

        self.running = True
        self.stream_task = asyncio.create_task(self._stream_market_data())
        logger.info("🚀 Market data streaming service started")

    async def stop(self):
        """Stop the market data streaming service"""
        self.running = False
        if self.stream_task and not self.stream_task.done():
            self.stream_task.cancel()
            try:
                await self.stream_task
            except asyncio.CancelledError:
                pass

        logger.info("🛑 Market data streaming service stopped")

    async def _stream_market_data(self):
        """Main streaming loop for market data updates"""
        logger.info(f"📡 Starting market data streaming for {len(self.symbols)} symbols")

        while self.running:
            try:
                # Get current market data for all symbols
                market_data = await self._fetch_current_market_data()

                # Publish market updates
                for symbol, data in market_data.items():
                    await self.redis_streamer.publish_market_data(symbol, data)

                # Publish market overview
                overview_data = await self._generate_market_overview(market_data)
                await self.redis_streamer.publish_market_overview(overview_data)

                # Generate and publish sentiment updates (simulated)
                for symbol in self.symbols[:5]:  # Limit to first 5 symbols for sentiment
                    sentiment_data = await self._generate_sentiment_data(symbol)
                    await self.redis_streamer.publish_sentiment_update(symbol, sentiment_data)

                logger.debug(f"📊 Published market data updates for {len(market_data)} symbols")

                # Wait for next update cycle
                await asyncio.sleep(self.update_interval)

            except Exception as e:
                logger.error(f"❌ Error in market data streaming: {e}")
                await asyncio.sleep(5)  # Wait before retry

    async def _fetch_current_market_data(self) -> Dict[str, Dict[str, Any]]:
        """Fetch current market data for all symbols"""
        market_data = {}

        try:
            # Fetch data in smaller batches to avoid rate limits
            batch_size = 5
            for i in range(0, len(self.symbols), batch_size):
                batch_symbols = self.symbols[i:i + batch_size]

                # Use threading to avoid blocking the event loop
                batch_data = await asyncio.get_event_loop().run_in_executor(
                    None, self._fetch_symbol_batch, batch_symbols
                )

                market_data.update(batch_data)

                # Small delay between batches
                await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"❌ Error fetching market data: {e}")

        return market_data

    def _fetch_symbol_batch(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """Fetch market data for a batch of symbols"""
        batch_data = {}

        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)

                # Get current price info
                info = ticker.info
                history = ticker.history(period="1d", interval="1m")

                if not history.empty:
                    current_price = float(history['Close'].iloc[-1])
                    previous_close = info.get('previousClose', current_price)

                    change = current_price - previous_close
                    change_percent = (change / previous_close) * 100 if previous_close != 0 else 0

                    batch_data[symbol] = {
                        "price": round(current_price, 2),
                        "change": round(change, 2),
                        "change_percent": round(change_percent, 2),
                        "volume": int(history['Volume'].iloc[-1]) if len(history) > 0 else 0,
                        "high": round(float(history['High'].max()), 2),
                        "low": round(float(history['Low'].min()), 2),
                        "previous_close": previous_close,
                        "market_cap": info.get('marketCap'),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }

            except Exception as e:
                logger.error(f"❌ Error fetching data for {symbol}: {e}")
                # Generate simulated data as fallback
                batch_data[symbol] = self._generate_simulated_data(symbol)

        return batch_data

    def _generate_simulated_data(self, symbol: str) -> Dict[str, Any]:
        """Generate simulated market data for testing"""
        base_price = random.uniform(50, 500)
        change_percent = random.uniform(-5, 5)
        change = base_price * (change_percent / 100)

        return {
            "price": round(base_price, 2),
            "change": round(change, 2),
            "change_percent": round(change_percent, 2),
            "volume": random.randint(100000, 10000000),
            "high": round(base_price * random.uniform(1.0, 1.05), 2),
            "low": round(base_price * random.uniform(0.95, 1.0), 2),
            "previous_close": round(base_price - change, 2),
            "market_cap": random.randint(1000000000, 2000000000000),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "simulated": True
        }

    async def _generate_market_overview(self, market_data: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Generate market overview from individual symbol data"""
        if not market_data:
            return {}

        total_symbols = len(market_data)
        gainers = sum(1 for data in market_data.values() if data.get('change', 0) > 0)
        losers = sum(1 for data in market_data.values() if data.get('change', 0) < 0)
        unchanged = total_symbols - gainers - losers

        avg_change = sum(data.get('change_percent', 0) for data in market_data.values()) / total_symbols if total_symbols > 0 else 0

        return {
            "total_symbols": total_symbols,
            "gainers": gainers,
            "losers": losers,
            "unchanged": unchanged,
            "average_change_percent": round(avg_change, 2),
            "market_sentiment": "bullish" if avg_change > 0 else "bearish" if avg_change < -1 else "neutral",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def _generate_sentiment_data(self, symbol: str) -> Dict[str, Any]:
        """Generate simulated sentiment data for a symbol"""
        # Simulate sentiment analysis results
        news_sentiment = random.uniform(-100, 100)
        social_sentiment = random.uniform(-100, 100)
        overall_sentiment = (news_sentiment + social_sentiment) / 2

        sentiment_label = "positive" if overall_sentiment > 20 else "negative" if overall_sentiment < -20 else "neutral"

        return {
            "overall_score": round(overall_sentiment, 1),
            "sentiment_label": sentiment_label,
            "news_sentiment": round(news_sentiment, 1),
            "social_sentiment": round(social_sentiment, 1),
            "confidence": round(random.uniform(0.6, 0.95), 2),
            "news_count": random.randint(5, 50),
            "social_mentions": random.randint(100, 5000),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sources": ["NewsAPI", "Twitter", "Reddit", "Financial Forums"]
        }

    def get_status(self) -> Dict[str, Any]:
        """Get streaming service status"""
        return {
            "running": self.running,
            "symbols_count": len(self.symbols),
            "update_interval": self.update_interval,
            "symbols": self.symbols[:10]  # Show first 10 symbols
        }

    async def publish_lstm_prediction(self, symbol: str, prediction_data: Dict[str, Any]):
        """Publish LSTM prediction update (called from ML service)"""
        await self.redis_streamer.publish_lstm_prediction(symbol, prediction_data)

    async def trigger_manual_update(self, symbols: List[str] = None):
        """Trigger manual market data update for specific symbols"""
        if not self.running:
            logger.warning("Market data streamer is not running")
            return

        target_symbols = symbols or self.symbols[:5]  # Limit to 5 symbols for manual updates

        try:
            # Fetch data for requested symbols
            market_data = {}
            for symbol in target_symbols:
                batch_data = await asyncio.get_event_loop().run_in_executor(
                    None, self._fetch_symbol_batch, [symbol]
                )
                market_data.update(batch_data)

            # Publish updates
            for symbol, data in market_data.items():
                await self.redis_streamer.publish_market_data(symbol, data)

            logger.info(f"📊 Manual market data update published for {len(market_data)} symbols")

        except Exception as e:
            logger.error(f"❌ Error in manual market data update: {e}")