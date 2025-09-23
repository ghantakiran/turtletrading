"""
Order Queue Management System for Market Microstructure Simulator

Advanced order queue management with:
- Priority-based order processing
- Queue position tracking and analytics
- Realistic queue dynamics and latency modeling
- Order flow statistics and performance metrics
- Queue depth analysis and capacity management
"""

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any, Deque, Set
from collections import deque, defaultdict
from dataclasses import dataclass, field
from enum import Enum
import heapq
import uuid
import statistics
import numpy as np

from ..models.market_microstructure_models import (
    MarketOrder, OrderSide, OrderType, OrderStatus, ParticipantType,
    VenueCharacteristics, LatencyModel, SimulationParameters
)

logger = logging.getLogger(__name__)


class QueuePriority(Enum):
    """Queue priority levels"""
    CRITICAL = 1    # Emergency orders, market maker quotes
    HIGH = 2        # Market orders, IOC orders
    NORMAL = 3      # Regular limit orders
    LOW = 4         # Iceberg orders, large block orders
    BATCH = 5       # Batch processing orders


@dataclass
class QueueEntry:
    """Enhanced queue entry with detailed tracking"""
    order_id: str
    order: MarketOrder
    priority: QueuePriority
    queue_time: datetime
    estimated_processing_time: Optional[datetime] = None
    actual_processing_time: Optional[datetime] = None
    queue_position: int = 0
    processing_latency_ms: float = 0.0
    participant_type: ParticipantType = ParticipantType.RETAIL
    venue_id: str = ""

    # Queue analytics
    time_in_queue_ms: float = 0.0
    queue_depth_at_entry: int = 0
    priority_jumps: int = 0  # Number of times jumped by higher priority orders

    def __lt__(self, other):
        """For priority queue ordering - lower number = higher priority"""
        if self.priority.value != other.priority.value:
            return self.priority.value < other.priority.value
        # Within same priority, use FIFO (first in, first out)
        return self.queue_time < other.queue_time


@dataclass
class QueueStatistics:
    """Queue performance and analytics statistics"""
    total_orders_processed: int = 0
    total_orders_in_queue: int = 0
    average_queue_time_ms: float = 0.0
    median_queue_time_ms: float = 0.0
    max_queue_time_ms: float = 0.0
    min_queue_time_ms: float = float('inf')

    # Queue depth statistics
    current_queue_depth: int = 0
    max_queue_depth: int = 0
    average_queue_depth: float = 0.0

    # Priority level statistics
    priority_distribution: Dict[QueuePriority, int] = field(default_factory=dict)
    priority_processing_times: Dict[QueuePriority, List[float]] = field(default_factory=dict)

    # Participant type statistics
    participant_queue_times: Dict[ParticipantType, List[float]] = field(default_factory=dict)
    participant_priority_jumps: Dict[ParticipantType, int] = field(default_factory=dict)

    # Performance metrics
    processing_rate_per_second: float = 0.0
    queue_utilization_percentage: float = 0.0
    fairness_index: float = 0.0  # Jain's fairness index

    # Time-based statistics
    peak_hours_queue_depth: Dict[int, float] = field(default_factory=dict)
    queue_time_percentiles: Dict[str, float] = field(default_factory=dict)


class OrderQueueManager:
    """
    Advanced order queue management system with sophisticated
    priority handling, analytics, and performance optimization.
    """

    def __init__(
        self,
        venue_characteristics: VenueCharacteristics,
        latency_model: LatencyModel,
        simulation_params: SimulationParameters,
        max_queue_size: int = 10000,
        processing_capacity_per_second: int = 1000
    ):
        self.venue = venue_characteristics
        self.latency_model = latency_model
        self.simulation_params = simulation_params
        self.max_queue_size = max_queue_size
        self.processing_capacity = processing_capacity_per_second

        # Queue structures
        self.priority_queue: List[QueueEntry] = []  # Heap-based priority queue
        self.order_lookup: Dict[str, QueueEntry] = {}  # Fast order lookup
        self.processing_queue: Deque[QueueEntry] = deque()  # Currently processing

        # Queue statistics and analytics
        self.statistics = QueueStatistics()
        self.queue_history: List[Tuple[datetime, int]] = []  # (timestamp, queue_depth)
        self.processed_orders: List[QueueEntry] = []

        # Performance tracking
        self.current_time = datetime.utcnow()
        self.last_processing_time = self.current_time
        self.processing_rate_tracker: Deque[Tuple[datetime, int]] = deque(maxlen=60)  # Last 60 seconds

        # Queue capacity and throttling
        self.is_processing = False
        self.processing_task: Optional[asyncio.Task] = None
        self.throttling_active = False

        logger.info(f"Initialized order queue manager for {venue_characteristics.venue_id} "
                   f"with capacity {processing_capacity_per_second}/sec")

    async def enqueue_order(self, order: MarketOrder) -> Tuple[bool, QueueEntry]:
        """
        Add order to queue with priority assignment and capacity checking.

        Args:
            order: Market order to enqueue

        Returns:
            Tuple of (success, queue_entry)
        """
        # Check queue capacity
        if len(self.priority_queue) >= self.max_queue_size:
            logger.warning(f"Queue at capacity ({self.max_queue_size}), rejecting order {order.order_id}")
            return False, None

        # Calculate priority
        priority = self._calculate_order_priority(order)

        # Create queue entry
        queue_entry = QueueEntry(
            order_id=order.order_id,
            order=order,
            priority=priority,
            queue_time=self.current_time,
            queue_position=len(self.priority_queue) + 1,
            queue_depth_at_entry=len(self.priority_queue),
            participant_type=order.participant_type,
            venue_id=self.venue.venue_id
        )

        # Estimate processing time based on queue depth and capacity
        estimated_delay_ms = await self._estimate_processing_delay(queue_entry)
        queue_entry.estimated_processing_time = self.current_time + timedelta(milliseconds=estimated_delay_ms)

        # Add to priority queue and lookup
        heapq.heappush(self.priority_queue, queue_entry)
        self.order_lookup[order.order_id] = queue_entry

        # Update statistics
        await self._update_queue_statistics_on_enqueue(queue_entry)

        # Start processing if not already running
        if not self.is_processing:
            self.processing_task = asyncio.create_task(self._process_queue())

        logger.debug(f"Enqueued order {order.order_id} with priority {priority.name} "
                    f"at position {queue_entry.queue_position}")

        return True, queue_entry

    async def dequeue_order(self, order_id: str) -> Optional[QueueEntry]:
        """
        Remove order from queue (cancellation).

        Args:
            order_id: ID of order to remove

        Returns:
            Removed queue entry or None if not found
        """
        queue_entry = self.order_lookup.get(order_id)
        if not queue_entry:
            return None

        # Remove from lookup
        del self.order_lookup[order_id]

        # Mark as removed (can't efficiently remove from heapq)
        queue_entry.order_id = f"CANCELLED_{order_id}"

        # Update statistics
        await self._update_queue_statistics_on_dequeue(queue_entry)

        logger.debug(f"Dequeued order {order_id}")
        return queue_entry

    async def _process_queue(self) -> None:
        """Main queue processing loop with rate limiting and latency simulation"""
        self.is_processing = True

        try:
            while self.priority_queue or self.processing_queue:
                processing_start = datetime.utcnow()

                # Check processing capacity
                current_rate = await self._get_current_processing_rate()
                if current_rate >= self.processing_capacity:
                    # Throttle processing
                    await self._apply_throttling()
                    continue

                # Move orders from priority queue to processing queue
                while (self.priority_queue and
                       len(self.processing_queue) < self.processing_capacity // 10):  # Process in batches

                    queue_entry = heapq.heappop(self.priority_queue)

                    # Skip cancelled orders
                    if queue_entry.order_id.startswith("CANCELLED_"):
                        continue

                    # Update processing time
                    queue_entry.actual_processing_time = self.current_time
                    queue_entry.time_in_queue_ms = (
                        self.current_time - queue_entry.queue_time
                    ).total_seconds() * 1000

                    # Apply latency simulation
                    latency_ms = await self._simulate_processing_latency(queue_entry)
                    queue_entry.processing_latency_ms = latency_ms

                    self.processing_queue.append(queue_entry)

                # Process orders with simulated latency
                await self._process_batch()

                # Update processing rate tracking
                processing_time = (datetime.utcnow() - processing_start).total_seconds()
                self.processing_rate_tracker.append((datetime.utcnow(), len(self.processing_queue)))

                # Small delay to prevent busy waiting
                await asyncio.sleep(0.001)  # 1ms

        except Exception as e:
            logger.error(f"Error in queue processing: {e}")
        finally:
            self.is_processing = False

    async def _process_batch(self) -> None:
        """Process a batch of orders from the processing queue"""
        batch_size = min(10, len(self.processing_queue))  # Process up to 10 orders at once

        for _ in range(batch_size):
            if not self.processing_queue:
                break

            queue_entry = self.processing_queue.popleft()

            # Simulate processing latency
            if queue_entry.processing_latency_ms > 0:
                await asyncio.sleep(queue_entry.processing_latency_ms / 1000)

            # Mark as processed
            await self._mark_order_processed(queue_entry)

    async def _mark_order_processed(self, queue_entry: QueueEntry) -> None:
        """Mark order as processed and update statistics"""
        # Remove from active tracking
        self.order_lookup.pop(queue_entry.order_id, None)

        # Add to processed orders history
        self.processed_orders.append(queue_entry)

        # Trim history to prevent memory growth
        if len(self.processed_orders) > 10000:
            self.processed_orders = self.processed_orders[-5000:]  # Keep last 5000

        # Update statistics
        await self._update_processing_statistics(queue_entry)

        logger.debug(f"Processed order {queue_entry.order_id} "
                    f"(queue time: {queue_entry.time_in_queue_ms:.2f}ms)")

    def _calculate_order_priority(self, order: MarketOrder) -> QueuePriority:
        """Calculate order priority based on type and characteristics"""
        # Market orders get high priority
        if order.order_type == OrderType.MARKET:
            return QueuePriority.HIGH

        # IOC orders get high priority
        if order.time_in_force == "IOC":
            return QueuePriority.HIGH

        # FOK orders get high priority
        if order.time_in_force == "FOK":
            return QueuePriority.HIGH

        # Stop orders get normal priority
        if order.order_type in [OrderType.STOP, OrderType.STOP_LIMIT]:
            return QueuePriority.NORMAL

        # Large orders get lower priority
        if order.quantity > 10000:
            return QueuePriority.LOW

        # Iceberg orders get lower priority
        if order.order_type == OrderType.ICEBERG:
            return QueuePriority.LOW

        # Default to normal priority
        return QueuePriority.NORMAL

    async def _estimate_processing_delay(self, queue_entry: QueueEntry) -> float:
        """Estimate processing delay based on queue state and order characteristics"""
        # Base delay from queue position
        queue_position = len(self.priority_queue)
        base_delay_ms = (queue_position / self.processing_capacity) * 1000

        # Add latency model components
        network_latency = self.latency_model.base_network_latency_ms
        processing_latency = self.latency_model.order_processing_latency_ms

        # Add participant-specific delays
        participant_penalty = 0
        if queue_entry.participant_type == ParticipantType.RETAIL:
            participant_penalty = self.latency_model.retail_latency_penalty_ms
        elif queue_entry.participant_type == ParticipantType.INSTITUTIONAL:
            participant_penalty = self.latency_model.institutional_latency_advantage_ms
        elif queue_entry.participant_type == ParticipantType.HIGH_FREQUENCY:
            participant_penalty = self.latency_model.hft_latency_advantage_ms

        # Add congestion effects
        queue_utilization = len(self.priority_queue) / self.max_queue_size
        if queue_utilization > self.latency_model.congestion_threshold:
            congestion_penalty = (
                base_delay_ms * self.latency_model.congestion_multiplier *
                (queue_utilization - self.latency_model.congestion_threshold)
            )
        else:
            congestion_penalty = 0

        total_delay = (
            base_delay_ms + network_latency + processing_latency +
            participant_penalty + congestion_penalty
        )

        return max(0, total_delay)

    async def _simulate_processing_latency(self, queue_entry: QueueEntry) -> float:
        """Simulate realistic processing latency with randomness"""
        import random

        base_latency = self.latency_model.order_processing_latency_ms

        # Add random jitter
        jitter = random.uniform(-self.latency_model.network_jitter_ms,
                               self.latency_model.network_jitter_ms)

        # Priority-based latency adjustment
        priority_multiplier = {
            QueuePriority.CRITICAL: 0.5,
            QueuePriority.HIGH: 0.8,
            QueuePriority.NORMAL: 1.0,
            QueuePriority.LOW: 1.5,
            QueuePriority.BATCH: 2.0
        }.get(queue_entry.priority, 1.0)

        total_latency = base_latency * priority_multiplier + jitter
        return max(0, total_latency)

    async def _get_current_processing_rate(self) -> float:
        """Calculate current processing rate (orders per second)"""
        now = datetime.utcnow()

        # Clean old entries (older than 1 second)
        while (self.processing_rate_tracker and
               (now - self.processing_rate_tracker[0][0]).total_seconds() > 1.0):
            self.processing_rate_tracker.popleft()

        # Calculate rate
        if not self.processing_rate_tracker:
            return 0.0

        total_processed = sum(count for _, count in self.processing_rate_tracker)
        time_window = (now - self.processing_rate_tracker[0][0]).total_seconds()

        return total_processed / max(time_window, 0.001)  # Avoid division by zero

    async def _apply_throttling(self) -> None:
        """Apply throttling when processing capacity is exceeded"""
        if not self.throttling_active:
            self.throttling_active = True
            logger.warning("Queue processing throttling activated")

        # Exponential backoff for throttling
        throttle_delay = min(0.1, 0.001 * len(self.priority_queue) / self.max_queue_size)
        await asyncio.sleep(throttle_delay)

    async def _update_queue_statistics_on_enqueue(self, queue_entry: QueueEntry) -> None:
        """Update statistics when order is enqueued"""
        self.statistics.total_orders_in_queue += 1
        self.statistics.current_queue_depth = len(self.priority_queue)
        self.statistics.max_queue_depth = max(
            self.statistics.max_queue_depth,
            self.statistics.current_queue_depth
        )

        # Update priority distribution
        if queue_entry.priority not in self.statistics.priority_distribution:
            self.statistics.priority_distribution[queue_entry.priority] = 0
        self.statistics.priority_distribution[queue_entry.priority] += 1

        # Track queue depth over time
        self.queue_history.append((self.current_time, self.statistics.current_queue_depth))

        # Trim history
        if len(self.queue_history) > 10000:
            self.queue_history = self.queue_history[-5000:]

    async def _update_queue_statistics_on_dequeue(self, queue_entry: QueueEntry) -> None:
        """Update statistics when order is dequeued (cancelled)"""
        self.statistics.total_orders_in_queue -= 1
        self.statistics.current_queue_depth = len(self.priority_queue)

    async def _update_processing_statistics(self, queue_entry: QueueEntry) -> None:
        """Update statistics when order processing is completed"""
        self.statistics.total_orders_processed += 1

        # Update queue time statistics
        queue_time_ms = queue_entry.time_in_queue_ms

        if self.statistics.total_orders_processed == 1:
            self.statistics.average_queue_time_ms = queue_time_ms
            self.statistics.min_queue_time_ms = queue_time_ms
        else:
            # Running average
            self.statistics.average_queue_time_ms = (
                (self.statistics.average_queue_time_ms * (self.statistics.total_orders_processed - 1) +
                 queue_time_ms) / self.statistics.total_orders_processed
            )

        self.statistics.max_queue_time_ms = max(self.statistics.max_queue_time_ms, queue_time_ms)
        self.statistics.min_queue_time_ms = min(self.statistics.min_queue_time_ms, queue_time_ms)

        # Update participant statistics
        participant_type = queue_entry.participant_type
        if participant_type not in self.statistics.participant_queue_times:
            self.statistics.participant_queue_times[participant_type] = []
        self.statistics.participant_queue_times[participant_type].append(queue_time_ms)

        # Update priority processing times
        priority = queue_entry.priority
        if priority not in self.statistics.priority_processing_times:
            self.statistics.priority_processing_times[priority] = []
        self.statistics.priority_processing_times[priority].append(queue_time_ms)

        # Calculate processing rate
        self.statistics.processing_rate_per_second = await self._get_current_processing_rate()

        # Calculate queue utilization
        self.statistics.queue_utilization_percentage = (
            self.statistics.current_queue_depth / self.max_queue_size * 100
        )

    def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status and metrics"""
        return {
            'current_queue_depth': len(self.priority_queue),
            'processing_queue_depth': len(self.processing_queue),
            'active_orders': len(self.order_lookup),
            'max_capacity': self.max_queue_size,
            'utilization_percentage': len(self.priority_queue) / self.max_queue_size * 100,
            'is_processing': self.is_processing,
            'throttling_active': self.throttling_active
        }

    def get_detailed_statistics(self) -> QueueStatistics:
        """Get comprehensive queue statistics"""
        # Calculate median queue time
        if self.processed_orders:
            queue_times = [entry.time_in_queue_ms for entry in self.processed_orders]
            self.statistics.median_queue_time_ms = statistics.median(queue_times)

            # Calculate percentiles
            if len(queue_times) >= 10:
                self.statistics.queue_time_percentiles = {
                    'p50': np.percentile(queue_times, 50),
                    'p90': np.percentile(queue_times, 90),
                    'p95': np.percentile(queue_times, 95),
                    'p99': np.percentile(queue_times, 99)
                }

        # Calculate average queue depth
        if self.queue_history:
            depths = [depth for _, depth in self.queue_history]
            self.statistics.average_queue_depth = statistics.mean(depths)

        # Calculate fairness index (Jain's fairness index)
        if len(self.statistics.participant_queue_times) > 1:
            all_times = []
            for times_list in self.statistics.participant_queue_times.values():
                all_times.extend(times_list)

            if all_times:
                n = len(all_times)
                sum_times = sum(all_times)
                sum_squares = sum(t * t for t in all_times)

                if sum_squares > 0:
                    self.statistics.fairness_index = (sum_times ** 2) / (n * sum_squares)

        return self.statistics

    def get_queue_analytics(self) -> Dict[str, Any]:
        """Get advanced queue analytics for monitoring and optimization"""
        stats = self.get_detailed_statistics()

        return {
            'performance_metrics': {
                'total_processed': stats.total_orders_processed,
                'processing_rate_per_second': stats.processing_rate_per_second,
                'average_queue_time_ms': stats.average_queue_time_ms,
                'median_queue_time_ms': stats.median_queue_time_ms,
                'queue_time_percentiles': stats.queue_time_percentiles
            },
            'capacity_metrics': {
                'current_utilization_pct': stats.queue_utilization_percentage,
                'max_queue_depth': stats.max_queue_depth,
                'average_queue_depth': stats.average_queue_depth
            },
            'fairness_metrics': {
                'fairness_index': stats.fairness_index,
                'participant_queue_times': {
                    ptype.value: {
                        'avg_ms': statistics.mean(times) if times else 0,
                        'count': len(times)
                    }
                    for ptype, times in stats.participant_queue_times.items()
                }
            },
            'priority_analysis': {
                priority.name: {
                    'count': stats.priority_distribution.get(priority, 0),
                    'avg_processing_time_ms': (
                        statistics.mean(stats.priority_processing_times.get(priority, [0]))
                    )
                }
                for priority in QueuePriority
            }
        }

    async def advance_time(self, time_delta: timedelta) -> None:
        """Advance simulation time"""
        self.current_time += time_delta

        # Update any time-based queue entries
        for queue_entry in self.order_lookup.values():
            if queue_entry.estimated_processing_time:
                # Check if order should be processed now
                if self.current_time >= queue_entry.estimated_processing_time:
                    # This would trigger immediate processing
                    pass

    async def shutdown(self) -> None:
        """Gracefully shutdown the queue manager"""
        logger.info("Shutting down order queue manager...")

        if self.processing_task and not self.processing_task.done():
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass

        # Process remaining orders
        remaining_orders = len(self.priority_queue) + len(self.processing_queue)
        if remaining_orders > 0:
            logger.info(f"Processing {remaining_orders} remaining orders before shutdown")
            # Could implement graceful processing here

        logger.info("Order queue manager shutdown complete")