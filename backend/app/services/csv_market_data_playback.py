"""
CSV Market Data Playback System for Market Microstructure Simulator

High-performance CSV market data playback engine with:
- Multiple CSV format support (ITCH, TAQ, custom formats)
- Real-time and accelerated playback modes
- Order book reconstruction from trade and quote data
- Market data validation and error handling
- Event-driven architecture with WebSocket streaming
- Performance optimization for large datasets
"""

import asyncio
import csv
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, time
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any, AsyncGenerator, Iterator, TextIO
from dataclasses import dataclass, field
from enum import Enum
import os
import gzip
import bz2
from pathlib import Path
import aiofiles
import heapq
from collections import defaultdict, deque

from ..models.market_microstructure_models import (
    OrderBook, OrderBookLevel, MarketOrder, OrderSide, OrderType,
    OrderExecution, VenueCharacteristics, SimulationParameters,
    PriceLevel, OrderBookSnapshot
)

logger = logging.getLogger(__name__)


class DataFormat(Enum):
    """Supported CSV data formats"""
    NASDAQ_ITCH = "nasdaq_itch"
    NYSE_TAQ = "nyse_taq"
    CUSTOM_TRADES = "custom_trades"
    CUSTOM_QUOTES = "custom_quotes"
    CUSTOM_ORDERBOOK = "custom_orderbook"
    BINANCE_TRADES = "binance_trades"
    COINBASE_ORDERBOOK = "coinbase_orderbook"


class PlaybackMode(Enum):
    """Playback modes"""
    REALTIME = "realtime"          # Play at original speed
    ACCELERATED = "accelerated"    # Play faster than realtime
    STEP_BY_STEP = "step"         # Manual stepping
    BURST = "burst"               # Play all at once


@dataclass
class MarketDataEvent:
    """Market data event for playback"""
    timestamp: datetime
    event_type: str  # trade, quote, orderbook_update
    symbol: str
    venue: str

    # Trade data
    trade_price: Optional[Decimal] = None
    trade_size: Optional[int] = None
    trade_side: Optional[OrderSide] = None

    # Quote data
    bid_price: Optional[Decimal] = None
    bid_size: Optional[int] = None
    ask_price: Optional[Decimal] = None
    ask_size: Optional[int] = None

    # Order book data
    order_book_levels: Optional[List[OrderBookLevel]] = None

    # Sequence and metadata
    sequence_number: int = 0
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def __lt__(self, other):
        """For priority queue ordering by timestamp"""
        return self.timestamp < other.timestamp


@dataclass
class PlaybackStatistics:
    """Playback performance and progress statistics"""
    total_events: int = 0
    events_processed: int = 0
    events_per_second: float = 0.0

    # Time tracking
    playback_start_time: Optional[datetime] = None
    data_start_time: Optional[datetime] = None
    data_end_time: Optional[datetime] = None
    current_data_time: Optional[datetime] = None

    # Performance metrics
    memory_usage_mb: float = 0.0
    cpu_usage_percent: float = 0.0
    io_throughput_mbps: float = 0.0

    # Error tracking
    parse_errors: int = 0
    validation_errors: int = 0
    skipped_events: int = 0

    @property
    def progress_percentage(self) -> float:
        """Calculate playback progress as percentage"""
        if self.total_events == 0:
            return 0.0
        return (self.events_processed / self.total_events) * 100

    @property
    def estimated_time_remaining(self) -> Optional[timedelta]:
        """Estimate remaining playback time"""
        if self.events_per_second <= 0 or self.total_events == 0:
            return None

        remaining_events = self.total_events - self.events_processed
        remaining_seconds = remaining_events / self.events_per_second
        return timedelta(seconds=remaining_seconds)


class CSVMarketDataPlayback:
    """
    High-performance CSV market data playback system with support for
    multiple formats and real-time streaming capabilities.
    """

    def __init__(
        self,
        venue_characteristics: VenueCharacteristics,
        simulation_params: SimulationParameters,
        playback_mode: PlaybackMode = PlaybackMode.REALTIME,
        speed_multiplier: float = 1.0,
        buffer_size: int = 10000
    ):
        self.venue = venue_characteristics
        self.simulation_params = simulation_params
        self.playback_mode = playback_mode
        self.speed_multiplier = speed_multiplier
        self.buffer_size = buffer_size

        # Playback state
        self.is_playing = False
        self.is_paused = False
        self.current_position = 0
        self.playback_task: Optional[asyncio.Task] = None

        # Data structures
        self.event_queue: List[MarketDataEvent] = []  # Heap-based priority queue
        self.event_buffer: deque = deque(maxlen=buffer_size)
        self.order_books: Dict[str, OrderBook] = {}  # Symbol -> OrderBook

        # Statistics and monitoring
        self.statistics = PlaybackStatistics()
        self.event_handlers: List[callable] = []

        # CSV parsing configuration
        self.csv_configs: Dict[DataFormat, Dict[str, Any]] = {}
        self._initialize_csv_configs()

        # Performance optimization
        self.chunk_size = 10000  # Process CSV in chunks
        self.use_pandas = True   # Use pandas for better performance

        logger.info(f"Initialized CSV market data playback with mode: {playback_mode.value}")

    def _initialize_csv_configs(self):
        """Initialize CSV parsing configurations for different formats"""

        # NASDAQ ITCH format configuration
        self.csv_configs[DataFormat.NASDAQ_ITCH] = {
            'columns': {
                'timestamp': 'Timestamp',
                'message_type': 'MessageType',
                'symbol': 'Stock',
                'side': 'Side',
                'price': 'Price',
                'size': 'Size',
                'order_ref': 'OrderReferenceNumber'
            },
            'dtypes': {
                'Price': 'float64',
                'Size': 'int64',
                'OrderReferenceNumber': 'int64'
            },
            'date_parser': lambda x: pd.to_datetime(x, format='%H:%M:%S.%f')
        }

        # NYSE TAQ format configuration
        self.csv_configs[DataFormat.NYSE_TAQ] = {
            'columns': {
                'timestamp': 'Time',
                'symbol': 'Symbol',
                'bid_price': 'Bid',
                'bid_size': 'BidSize',
                'ask_price': 'Ask',
                'ask_size': 'AskSize',
                'trade_price': 'Price',
                'trade_size': 'Volume'
            },
            'dtypes': {
                'Bid': 'float64',
                'Ask': 'float64',
                'Price': 'float64',
                'Volume': 'int64',
                'BidSize': 'int64',
                'AskSize': 'int64'
            },
            'date_parser': lambda x: pd.to_datetime(x)
        }

        # Custom trades format
        self.csv_configs[DataFormat.CUSTOM_TRADES] = {
            'columns': {
                'timestamp': 'timestamp',
                'symbol': 'symbol',
                'price': 'price',
                'size': 'size',
                'side': 'side'
            },
            'dtypes': {
                'price': 'float64',
                'size': 'int64'
            },
            'date_parser': pd.to_datetime
        }

        # Custom order book format
        self.csv_configs[DataFormat.CUSTOM_ORDERBOOK] = {
            'columns': {
                'timestamp': 'timestamp',
                'symbol': 'symbol',
                'bid_price_1': 'bid_price_1',
                'bid_size_1': 'bid_size_1',
                'ask_price_1': 'ask_price_1',
                'ask_size_1': 'ask_size_1'
            },
            'dtypes': {
                'bid_price_1': 'float64',
                'bid_size_1': 'int64',
                'ask_price_1': 'float64',
                'ask_size_1': 'int64'
            },
            'date_parser': pd.to_datetime
        }

    async def load_csv_file(
        self,
        file_path: str,
        data_format: DataFormat,
        symbol_filter: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> bool:
        """
        Load CSV file and prepare for playback.

        Args:
            file_path: Path to CSV file
            data_format: Format of the CSV data
            symbol_filter: Optional list of symbols to filter
            start_time: Optional start time filter
            end_time: Optional end time filter

        Returns:
            True if loaded successfully
        """
        try:
            logger.info(f"Loading CSV file: {file_path} with format: {data_format.value}")

            # Check if file exists and get info
            file_path_obj = Path(file_path)
            if not file_path_obj.exists():
                logger.error(f"CSV file not found: {file_path}")
                return False

            file_size_mb = file_path_obj.stat().st_size / (1024 * 1024)
            logger.info(f"File size: {file_size_mb:.2f} MB")

            # Determine if file is compressed
            is_compressed = file_path.endswith(('.gz', '.bz2'))

            # Load and parse CSV data
            if self.use_pandas:
                events = await self._load_csv_with_pandas(
                    file_path, data_format, symbol_filter, start_time, end_time
                )
            else:
                events = await self._load_csv_streaming(
                    file_path, data_format, symbol_filter, start_time, end_time
                )

            # Convert to event queue
            self.event_queue = events
            heapq.heapify(self.event_queue)  # Convert to heap for efficient ordering

            # Update statistics
            self.statistics.total_events = len(self.event_queue)
            if self.event_queue:
                self.statistics.data_start_time = min(event.timestamp for event in self.event_queue)
                self.statistics.data_end_time = max(event.timestamp for event in self.event_queue)

            logger.info(f"Loaded {len(self.event_queue)} events from {file_path}")
            return True

        except Exception as e:
            logger.error(f"Error loading CSV file {file_path}: {e}")
            self.statistics.parse_errors += 1
            return False

    async def _load_csv_with_pandas(
        self,
        file_path: str,
        data_format: DataFormat,
        symbol_filter: Optional[List[str]],
        start_time: Optional[datetime],
        end_time: Optional[datetime]
    ) -> List[MarketDataEvent]:
        """Load CSV using pandas for better performance"""
        config = self.csv_configs[data_format]
        events = []

        try:
            # Read CSV with pandas
            if file_path.endswith('.gz'):
                df = pd.read_csv(file_path, compression='gzip', chunksize=self.chunk_size)
            elif file_path.endswith('.bz2'):
                df = pd.read_csv(file_path, compression='bz2', chunksize=self.chunk_size)
            else:
                df = pd.read_csv(file_path, chunksize=self.chunk_size)

            # Process chunks
            for chunk_df in df:
                chunk_events = await self._process_dataframe_chunk(
                    chunk_df, data_format, config, symbol_filter, start_time, end_time
                )
                events.extend(chunk_events)

                # Yield control to event loop
                await asyncio.sleep(0)

        except Exception as e:
            logger.error(f"Error processing CSV with pandas: {e}")
            raise

        return events

    async def _process_dataframe_chunk(
        self,
        df: pd.DataFrame,
        data_format: DataFormat,
        config: Dict[str, Any],
        symbol_filter: Optional[List[str]],
        start_time: Optional[datetime],
        end_time: Optional[datetime]
    ) -> List[MarketDataEvent]:
        """Process a chunk of DataFrame into market data events"""
        events = []
        columns = config['columns']

        try:
            # Parse timestamp column
            timestamp_col = columns['timestamp']
            if timestamp_col in df.columns:
                df[timestamp_col] = pd.to_datetime(df[timestamp_col])

            # Apply filters
            if symbol_filter:
                symbol_col = columns.get('symbol')
                if symbol_col and symbol_col in df.columns:
                    df = df[df[symbol_col].isin(symbol_filter)]

            if start_time:
                df = df[df[timestamp_col] >= start_time]

            if end_time:
                df = df[df[timestamp_col] <= end_time]

            # Convert rows to events
            for _, row in df.iterrows():
                event = await self._row_to_event(row, data_format, config)
                if event:
                    events.append(event)

        except Exception as e:
            logger.error(f"Error processing DataFrame chunk: {e}")
            self.statistics.parse_errors += 1

        return events

    async def _row_to_event(
        self,
        row: pd.Series,
        data_format: DataFormat,
        config: Dict[str, Any]
    ) -> Optional[MarketDataEvent]:
        """Convert DataFrame row to MarketDataEvent"""
        try:
            columns = config['columns']

            # Base event data
            timestamp = row[columns['timestamp']]
            symbol = row[columns['symbol']] if 'symbol' in columns else 'UNKNOWN'

            event = MarketDataEvent(
                timestamp=timestamp,
                symbol=symbol,
                venue=self.venue.venue_id,
                raw_data=row.to_dict()
            )

            # Parse based on data format
            if data_format == DataFormat.CUSTOM_TRADES:
                event.event_type = 'trade'
                event.trade_price = Decimal(str(row[columns['price']]))
                event.trade_size = int(row[columns['size']])

                # Parse side if available
                if 'side' in columns and columns['side'] in row:
                    side_str = str(row[columns['side']]).upper()
                    event.trade_side = OrderSide.BUY if side_str in ['BUY', 'B', '1'] else OrderSide.SELL

            elif data_format == DataFormat.CUSTOM_QUOTES:
                event.event_type = 'quote'
                if 'bid_price' in columns:
                    event.bid_price = Decimal(str(row[columns['bid_price']]))
                if 'bid_size' in columns:
                    event.bid_size = int(row[columns['bid_size']])
                if 'ask_price' in columns:
                    event.ask_price = Decimal(str(row[columns['ask_price']]))
                if 'ask_size' in columns:
                    event.ask_size = int(row[columns['ask_size']])

            elif data_format == DataFormat.NYSE_TAQ:
                # TAQ can contain both trades and quotes
                if pd.notna(row.get(columns.get('trade_price'))):
                    event.event_type = 'trade'
                    event.trade_price = Decimal(str(row[columns['trade_price']]))
                    event.trade_size = int(row[columns['trade_size']])
                else:
                    event.event_type = 'quote'
                    event.bid_price = Decimal(str(row[columns['bid_price']]))
                    event.bid_size = int(row[columns['bid_size']])
                    event.ask_price = Decimal(str(row[columns['ask_price']]))
                    event.ask_size = int(row[columns['ask_size']])

            elif data_format == DataFormat.CUSTOM_ORDERBOOK:
                event.event_type = 'orderbook_update'
                # Convert order book levels
                levels = []
                for i in range(1, 11):  # Up to 10 levels
                    bid_price_col = f'bid_price_{i}'
                    bid_size_col = f'bid_size_{i}'
                    ask_price_col = f'ask_price_{i}'
                    ask_size_col = f'ask_size_{i}'

                    if bid_price_col in row and pd.notna(row[bid_price_col]):
                        # Add bid level
                        bid_level = OrderBookLevel(
                            level=i-1,
                            price=Decimal(str(row[bid_price_col])),
                            quantity=int(row[bid_size_col]) if pd.notna(row[bid_size_col]) else 0,
                            order_count=1,
                            average_order_size=Decimal(str(row[bid_size_col])) if pd.notna(row[bid_size_col]) else Decimal('0'),
                            liquidity_score=0.8,
                            stability_score=0.8,
                            retail_percentage=0.6,
                            institutional_percentage=0.3,
                            hft_percentage=0.1
                        )
                        levels.append(('bid', bid_level))

                    if ask_price_col in row and pd.notna(row[ask_price_col]):
                        # Add ask level
                        ask_level = OrderBookLevel(
                            level=i-1,
                            price=Decimal(str(row[ask_price_col])),
                            quantity=int(row[ask_size_col]) if pd.notna(row[ask_size_col]) else 0,
                            order_count=1,
                            average_order_size=Decimal(str(row[ask_size_col])) if pd.notna(row[ask_size_col]) else Decimal('0'),
                            liquidity_score=0.8,
                            stability_score=0.8,
                            retail_percentage=0.6,
                            institutional_percentage=0.3,
                            hft_percentage=0.1
                        )
                        levels.append(('ask', ask_level))

                event.order_book_levels = levels

            return event

        except Exception as e:
            logger.error(f"Error converting row to event: {e}")
            self.statistics.validation_errors += 1
            return None

    async def start_playback(self) -> bool:
        """Start market data playback"""
        if self.is_playing:
            logger.warning("Playback already in progress")
            return False

        if not self.event_queue:
            logger.error("No data loaded for playback")
            return False

        self.is_playing = True
        self.is_paused = False
        self.statistics.playback_start_time = datetime.utcnow()

        logger.info(f"Starting playback with {len(self.event_queue)} events")

        # Start playback task based on mode
        if self.playback_mode == PlaybackMode.REALTIME:
            self.playback_task = asyncio.create_task(self._realtime_playback())
        elif self.playback_mode == PlaybackMode.ACCELERATED:
            self.playback_task = asyncio.create_task(self._accelerated_playback())
        elif self.playback_mode == PlaybackMode.BURST:
            self.playback_task = asyncio.create_task(self._burst_playback())
        else:  # STEP_BY_STEP
            # Manual stepping mode - no automatic task
            pass

        return True

    async def _realtime_playback(self):
        """Real-time playback maintaining original timing"""
        try:
            if not self.event_queue:
                return

            first_event_time = self.event_queue[0].timestamp
            playback_start = datetime.utcnow()

            while self.event_queue and self.is_playing:
                if self.is_paused:
                    await asyncio.sleep(0.1)
                    continue

                # Get next event
                event = heapq.heappop(self.event_queue)

                # Calculate delay to maintain timing
                elapsed_data_time = (event.timestamp - first_event_time).total_seconds()
                elapsed_real_time = (datetime.utcnow() - playback_start).total_seconds()

                target_delay = (elapsed_data_time / self.speed_multiplier) - elapsed_real_time

                if target_delay > 0:
                    await asyncio.sleep(target_delay)

                # Process event
                await self._process_event(event)

        except Exception as e:
            logger.error(f"Error in realtime playback: {e}")
        finally:
            self.is_playing = False

    async def _accelerated_playback(self):
        """Accelerated playback at specified speed multiplier"""
        try:
            while self.event_queue and self.is_playing:
                if self.is_paused:
                    await asyncio.sleep(0.1)
                    continue

                # Process events in batches for better performance
                batch_size = min(100, len(self.event_queue))

                for _ in range(batch_size):
                    if not self.event_queue or not self.is_playing:
                        break

                    event = heapq.heappop(self.event_queue)
                    await self._process_event(event)

                # Small delay to prevent overwhelming the system
                await asyncio.sleep(0.001 / self.speed_multiplier)

        except Exception as e:
            logger.error(f"Error in accelerated playback: {e}")
        finally:
            self.is_playing = False

    async def _burst_playback(self):
        """Burst playback - process all events as fast as possible"""
        try:
            while self.event_queue and self.is_playing:
                event = heapq.heappop(self.event_queue)
                await self._process_event(event)

                # Yield control occasionally
                if self.statistics.events_processed % 1000 == 0:
                    await asyncio.sleep(0)

        except Exception as e:
            logger.error(f"Error in burst playback: {e}")
        finally:
            self.is_playing = False

    async def _process_event(self, event: MarketDataEvent):
        """Process a single market data event"""
        try:
            # Update statistics
            self.statistics.events_processed += 1
            self.statistics.current_data_time = event.timestamp

            # Update order book if needed
            if event.symbol not in self.order_books:
                self.order_books[event.symbol] = self._create_empty_order_book(event.symbol)

            order_book = self.order_books[event.symbol]

            # Process event based on type
            if event.event_type == 'trade':
                await self._process_trade_event(event, order_book)
            elif event.event_type == 'quote':
                await self._process_quote_event(event, order_book)
            elif event.event_type == 'orderbook_update':
                await self._process_orderbook_event(event, order_book)

            # Add to buffer
            self.event_buffer.append(event)

            # Notify event handlers
            for handler in self.event_handlers:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(event, order_book)
                    else:
                        handler(event, order_book)
                except Exception as e:
                    logger.error(f"Error in event handler: {e}")

            # Update performance statistics
            await self._update_performance_stats()

        except Exception as e:
            logger.error(f"Error processing event: {e}")
            self.statistics.validation_errors += 1

    async def _process_trade_event(self, event: MarketDataEvent, order_book: OrderBook):
        """Process trade event and update order book"""
        if event.trade_price:
            order_book.last_trade_price = event.trade_price
            order_book.last_trade_quantity = event.trade_size or 0
            order_book.last_trade_time = event.timestamp

    async def _process_quote_event(self, event: MarketDataEvent, order_book: OrderBook):
        """Process quote event and update order book"""
        if event.bid_price and event.ask_price:
            order_book.bid_price = event.bid_price
            order_book.ask_price = event.ask_price
            order_book.mid_price = (event.bid_price + event.ask_price) / 2

            spread = event.ask_price - event.bid_price
            order_book.spread_bps = (spread / order_book.mid_price * 10000) if order_book.mid_price > 0 else Decimal('0')

    async def _process_orderbook_event(self, event: MarketDataEvent, order_book: OrderBook):
        """Process order book update event"""
        if event.order_book_levels:
            bids = []
            asks = []

            for side, level in event.order_book_levels:
                if side == 'bid':
                    bids.append(level)
                else:
                    asks.append(level)

            # Sort levels
            bids.sort(key=lambda x: x.price, reverse=True)
            asks.sort(key=lambda x: x.price)

            order_book.bids = bids
            order_book.asks = asks

            # Update best bid/ask
            if bids:
                order_book.bid_price = bids[0].price
            if asks:
                order_book.ask_price = asks[0].price

            if bids and asks:
                order_book.mid_price = (order_book.bid_price + order_book.ask_price) / 2

    def _create_empty_order_book(self, symbol: str) -> OrderBook:
        """Create empty order book for symbol"""
        return OrderBook(
            symbol=symbol,
            venue=self.venue.venue_id,
            timestamp=datetime.utcnow(),
            bids=[],
            asks=[],
            last_trade_price=Decimal('100.00'),
            last_trade_quantity=0,
            bid_price=Decimal('99.99'),
            ask_price=Decimal('100.01'),
            spread_bps=Decimal('1.0'),
            mid_price=Decimal('100.00'),
            tick_size=self.venue.tick_size,
            lot_size=self.venue.lot_size
        )

    async def _update_performance_stats(self):
        """Update performance statistics"""
        if self.statistics.events_processed % 1000 == 0:  # Update every 1000 events
            current_time = datetime.utcnow()

            if self.statistics.playback_start_time:
                elapsed_time = (current_time - self.statistics.playback_start_time).total_seconds()
                if elapsed_time > 0:
                    self.statistics.events_per_second = self.statistics.events_processed / elapsed_time

    def pause_playback(self):
        """Pause playback"""
        self.is_paused = True
        logger.info("Playback paused")

    def resume_playback(self):
        """Resume playback"""
        self.is_paused = False
        logger.info("Playback resumed")

    async def stop_playback(self):
        """Stop playback"""
        self.is_playing = False
        self.is_paused = False

        if self.playback_task and not self.playback_task.done():
            self.playback_task.cancel()
            try:
                await self.playback_task
            except asyncio.CancelledError:
                pass

        logger.info("Playback stopped")

    def step_forward(self, steps: int = 1) -> int:
        """Step forward manually (for step-by-step mode)"""
        if self.playback_mode != PlaybackMode.STEP_BY_STEP:
            logger.warning("Step forward only available in step-by-step mode")
            return 0

        events_processed = 0
        for _ in range(steps):
            if not self.event_queue:
                break

            event = heapq.heappop(self.event_queue)
            asyncio.create_task(self._process_event(event))
            events_processed += 1

        return events_processed

    def add_event_handler(self, handler: callable):
        """Add event handler for real-time processing"""
        self.event_handlers.append(handler)

    def remove_event_handler(self, handler: callable):
        """Remove event handler"""
        if handler in self.event_handlers:
            self.event_handlers.remove(handler)

    def get_current_order_book(self, symbol: str) -> Optional[OrderBook]:
        """Get current order book for symbol"""
        return self.order_books.get(symbol)

    def get_playback_statistics(self) -> PlaybackStatistics:
        """Get current playback statistics"""
        return self.statistics

    def get_recent_events(self, count: int = 100) -> List[MarketDataEvent]:
        """Get recent events from buffer"""
        return list(self.event_buffer)[-count:]

    async def seek_to_time(self, target_time: datetime) -> bool:
        """Seek to specific time in data"""
        if self.is_playing:
            logger.warning("Cannot seek while playback is active")
            return False

        # Rebuild event queue up to target time
        # This is a simplified implementation - could be optimized
        logger.info(f"Seeking to time: {target_time}")

        # Reset and filter events
        filtered_events = [event for event in self.event_queue if event.timestamp <= target_time]
        remaining_events = [event for event in self.event_queue if event.timestamp > target_time]

        # Process filtered events quickly
        for event in filtered_events:
            await self._process_event(event)

        # Reset queue with remaining events
        self.event_queue = remaining_events
        heapq.heapify(self.event_queue)

        return True

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        return {
            'events_per_second': self.statistics.events_per_second,
            'memory_usage_mb': self.statistics.memory_usage_mb,
            'total_events': self.statistics.total_events,
            'events_processed': self.statistics.events_processed,
            'progress_percentage': self.statistics.progress_percentage,
            'parse_errors': self.statistics.parse_errors,
            'validation_errors': self.statistics.validation_errors,
            'playback_mode': self.playback_mode.value,
            'speed_multiplier': self.speed_multiplier,
            'is_playing': self.is_playing,
            'is_paused': self.is_paused
        }