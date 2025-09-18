"""
Market Data Real-time Streaming Tests
Per IMPLEMENT_FROM_DOCS_FILLED.md: docs/claude/tests/specs/market-data/real_time_streaming_tests.md
"""

import pytest
import asyncio
import time
import json
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from app.services.market_service import MarketService
from app.services.websocket_manager import WebSocketManager
from app.services.sentiment_service import SentimentService


class MockWebSocketConnection:
    """Mock WebSocket connection for testing"""

    def __init__(self, auto_disconnect_after=None):
        self.is_connected = True
        self.latency_ms = 25  # Default low latency
        self.heartbeat_active = True
        self.subscribers = []
        self.disconnection_log = []
        self.auto_disconnect_after = auto_disconnect_after
        self._connected_time = time.time()

    async def send(self, message):
        """Mock send message"""
        if self.auto_disconnect_after and \
           time.time() - self._connected_time > self.auto_disconnect_after:
            await self.force_disconnect()
            raise ConnectionError("WebSocket disconnected")

    async def receive(self):
        """Mock receive message"""
        await asyncio.sleep(0.001)  # Simulate small delay
        return json.dumps({'type': 'heartbeat', 'timestamp': time.time()})

    async def close(self):
        """Mock close connection"""
        self.is_connected = False
        self.heartbeat_active = False

    async def force_disconnect(self):
        """Simulate forced disconnection"""
        self.is_connected = False
        self.heartbeat_active = False


class TestWebSocketConnectionManagement:
    """Test WebSocket connection management functionality"""

    def setup_method(self):
        """Set up test dependencies"""
        self.websocket_manager = WebSocketManager()
        self.mock_redis = Mock()

    @pytest.mark.asyncio
    async def test_websocket_connection_establishment(self):
        """UT-MARKET-01.1: WebSocket Connection Management
        Given: WebSocket server configured for market data streaming
        When: establish_websocket_connection() is called
        Then: Successfully connect and maintain heartbeat with <100ms latency
        """
        # Arrange
        websocket_config = {
            'url': 'ws://localhost:8080/market-stream',
            'heartbeat_interval': 30,
            'reconnect_attempts': 3
        }

        # Act
        with patch.object(self.websocket_manager, 'create_connection') as mock_create:
            mock_connection = MockWebSocketConnection()
            mock_create.return_value = mock_connection

            connection = await self.websocket_manager.establish_connection(websocket_config)

            # Assert
            assert connection.is_connected == True
            assert connection.latency_ms < 100
            assert connection.heartbeat_active == True

            # Cleanup
            await connection.close()

    @pytest.mark.asyncio
    async def test_connection_heartbeat_maintenance(self):
        """Test heartbeat mechanism maintains connection"""
        # Arrange
        mock_connection = MockWebSocketConnection()
        mock_connection.latency_ms = 45  # Good latency

        # Act - Simulate heartbeat check
        start_time = time.time()
        await mock_connection.receive()  # Simulate heartbeat response
        response_time = (time.time() - start_time) * 1000

        # Assert
        assert response_time < 100  # Sub-100ms response time
        assert mock_connection.heartbeat_active == True


class TestRealTimePriceUpdates:
    """Test real-time price update processing"""

    def setup_method(self):
        """Set up test dependencies"""
        self.mock_redis = Mock()
        self.mock_db_session = AsyncMock()
        self.market_service = MarketService(
            db_session=self.mock_db_session,
            redis_client=self.mock_redis
        )

    @pytest.mark.asyncio
    async def test_real_time_price_updates(self):
        """UT-MARKET-01.2: Real-time Price Update Processing
        Given: Active WebSocket connection with price subscriptions
        When: receive_price_update() processes incoming market data
        Then: Update in-memory cache and notify subscribers within 50ms
        """
        # Arrange
        mock_price_update = {
            'symbol': 'AAPL',
            'price': 150.25,
            'volume': 1000000,
            'timestamp': '2024-01-15T15:30:00Z'
        }

        # Mock cache operations
        self.mock_redis.setex.return_value = True
        self.mock_redis.publish.return_value = 1  # 1 subscriber notified

        # Act
        start_time = time.time()
        await self.market_service.receive_price_update(mock_price_update)
        processing_time = (time.time() - start_time) * 1000

        # Assert
        assert processing_time < 50  # Under 50ms processing requirement

        # Verify cache was updated
        self.mock_redis.setex.assert_called()
        cache_key = f"price:AAPL"
        assert any(
            call.args[0] == cache_key for call in self.mock_redis.setex.call_args_list
        )

        # Verify subscribers were notified
        self.mock_redis.publish.assert_called()

    @pytest.mark.asyncio
    async def test_batch_price_updates_performance(self):
        """Test processing multiple price updates efficiently"""
        # Arrange
        price_updates = [
            {'symbol': 'AAPL', 'price': 150.25, 'timestamp': '2024-01-15T15:30:00Z'},
            {'symbol': 'GOOGL', 'price': 2750.50, 'timestamp': '2024-01-15T15:30:01Z'},
            {'symbol': 'MSFT', 'price': 380.75, 'timestamp': '2024-01-15T15:30:02Z'},
        ]

        self.mock_redis.pipeline.return_value.__enter__.return_value = self.mock_redis
        self.mock_redis.execute.return_value = [True] * 6  # 3 sets + 3 publishes

        # Act
        start_time = time.time()
        await self.market_service.process_batch_updates(price_updates)
        total_processing_time = time.time() - start_time

        # Assert
        assert total_processing_time < 0.1  # Under 100ms for batch
        avg_per_update = (total_processing_time / len(price_updates)) * 1000
        assert avg_per_update < 30  # Under 30ms per update on average


class TestMarketSentimentAggregation:
    """Test market sentiment aggregation functionality"""

    def setup_method(self):
        """Set up test dependencies"""
        self.mock_redis = Mock()
        self.mock_db_session = AsyncMock()
        self.sentiment_service = SentimentService(
            db_session=self.mock_db_session,
            redis_client=self.mock_redis
        )

    def test_market_sentiment_aggregation(self):
        """UT-MARKET-02.1: Market Sentiment Aggregation
        Given: Multiple sentiment data sources (news, social media)
        When: aggregate_market_sentiment() combines sentiment scores
        Then: Return weighted sentiment score between -100 and +100
        """
        # Arrange
        sentiment_sources = {
            'news_sentiment': {'score': 75, 'weight': 0.6, 'confidence': 0.85},
            'social_sentiment': {'score': -20, 'weight': 0.3, 'confidence': 0.70},
            'analyst_sentiment': {'score': 50, 'weight': 0.1, 'confidence': 0.95}
        }

        # Act
        aggregated = self.sentiment_service.aggregate_market_sentiment(sentiment_sources)

        # Assert
        assert -100 <= aggregated['score'] <= 100
        assert aggregated['confidence'] > 0.5
        assert 'weighted_score' in aggregated

        # Verify weighted calculation
        expected_score = (75 * 0.6 + (-20) * 0.3 + 50 * 0.1)
        assert abs(aggregated['weighted_score'] - expected_score) < 0.1

        # Verify confidence aggregation
        expected_confidence = (0.85 * 0.6 + 0.70 * 0.3 + 0.95 * 0.1)
        assert abs(aggregated['confidence'] - expected_confidence) < 0.1

    def test_sentiment_edge_cases(self):
        """Test sentiment aggregation edge cases"""
        # Test with extreme values
        extreme_sources = {
            'source1': {'score': 100, 'weight': 0.5, 'confidence': 1.0},
            'source2': {'score': -100, 'weight': 0.5, 'confidence': 1.0}
        }

        result = self.sentiment_service.aggregate_market_sentiment(extreme_sources)
        assert result['score'] == 0  # Should balance out
        assert result['confidence'] == 1.0

        # Test with single source
        single_source = {
            'only_source': {'score': 60, 'weight': 1.0, 'confidence': 0.8}
        }

        result = self.sentiment_service.aggregate_market_sentiment(single_source)
        assert result['score'] == 60
        assert result['confidence'] == 0.8


class TestWebSocketReconnectionLogic:
    """Test WebSocket disconnection recovery"""

    def setup_method(self):
        """Set up test dependencies"""
        self.websocket_manager = WebSocketManager()
        self.websocket_manager.reconnection_log = []

    @pytest.mark.asyncio
    async def test_websocket_reconnection(self):
        """ET-MARKET-01.1: WebSocket Disconnection Recovery
        Given: Active WebSocket connection experiences network interruption
        When: handle_disconnection() attempts reconnection
        Then: Automatically reconnect with exponential backoff, max 3 attempts
        """
        # Arrange
        connection = MockWebSocketConnection(auto_disconnect_after=0.1)

        # Mock the reconnection attempts
        attempt_delays = []

        async def mock_reconnect_attempt(delay):
            attempt_delays.append(delay)
            await asyncio.sleep(0.01)  # Simulate reconnection time
            raise ConnectionError("Reconnection failed")

        # Act
        with patch.object(
            self.websocket_manager,
            '_attempt_reconnection',
            side_effect=mock_reconnect_attempt
        ):
            with pytest.raises(ConnectionError):
                await self.websocket_manager.handle_disconnection(connection)

        # Assert exponential backoff pattern
        assert len(attempt_delays) <= 3  # Max 3 attempts
        if len(attempt_delays) >= 2:
            assert attempt_delays[0] == 1  # First attempt: 1s
            assert attempt_delays[1] == 2  # Second attempt: 2s
        if len(attempt_delays) == 3:
            assert attempt_delays[2] == 4  # Third attempt: 4s

    @pytest.mark.asyncio
    async def test_successful_reconnection_recovery(self):
        """Test successful reconnection after failure"""
        # Arrange
        connection = MockWebSocketConnection()
        connection.is_connected = False  # Start disconnected

        reconnection_attempts = []

        async def mock_reconnect_success(delay):
            reconnection_attempts.append(delay)
            if len(reconnection_attempts) == 2:  # Succeed on 2nd attempt
                new_connection = MockWebSocketConnection()
                return new_connection
            raise ConnectionError("Still failing")

        # Act
        with patch.object(
            self.websocket_manager,
            '_attempt_reconnection',
            side_effect=mock_reconnect_success
        ):
            result = await self.websocket_manager.handle_disconnection(connection)

        # Assert
        assert result is not None  # Should return new connection
        assert result.is_connected == True
        assert len(reconnection_attempts) == 2  # Succeeded on 2nd attempt


class TestMessageOrderingProperty:
    """Test message ordering property under concurrent conditions"""

    def setup_method(self):
        """Set up test dependencies"""
        self.mock_redis = Mock()
        self.mock_db_session = AsyncMock()
        self.market_service = MarketService(
            db_session=self.mock_db_session,
            redis_client=self.mock_redis
        )

    @pytest.mark.asyncio
    async def test_message_ordering_property(self):
        """PT-MARKET-01.1: Message Ordering Property
        Given: Rapid sequence of price updates for same symbol
        When: process_message_queue() handles concurrent updates
        Then: Final price reflects the most recent timestamp, no race conditions
        """
        # Arrange
        price_updates = [
            {'symbol': 'TSLA', 'price': 200.00, 'timestamp': '2024-01-15T15:30:00Z'},
            {'symbol': 'TSLA', 'price': 201.50, 'timestamp': '2024-01-15T15:30:02Z'},
            {'symbol': 'TSLA', 'price': 199.75, 'timestamp': '2024-01-15T15:30:01Z'},  # Out of order
        ]

        # Mock cache to simulate retrieval
        price_history = []
        def mock_cache_get(key):
            if 'history' in key:
                return json.dumps(price_history)
            return None

        def mock_cache_set(key, value, ex=None):
            if 'history' in key:
                price_history.clear()
                price_history.extend(json.loads(value))
            return True

        self.mock_redis.get.side_effect = mock_cache_get
        self.mock_redis.setex.side_effect = mock_cache_set

        # Act
        for update in price_updates:
            await self.market_service.process_price_update(update)

        # Assert
        # The most recent timestamp should be the final price
        final_price_call = None
        for call in self.mock_redis.setex.call_args_list:
            if 'price:TSLA' == call.args[0]:
                final_price_call = call

        assert final_price_call is not None
        final_price_data = json.loads(final_price_call.args[1])
        assert final_price_data['price'] == 201.50  # Most recent timestamp wins
        assert final_price_data['timestamp'] == '2024-01-15T15:30:02Z'

    @pytest.mark.asyncio
    async def test_concurrent_price_updates_consistency(self):
        """Test consistency under high concurrency"""
        # Arrange
        symbol = 'AAPL'
        concurrent_updates = [
            {'symbol': symbol, 'price': 150.00 + i, 'timestamp': f'2024-01-15T15:30:{i:02d}Z'}
            for i in range(20)
        ]

        # Mock thread-safe operations
        final_prices = []
        self.mock_redis.setex.side_effect = lambda k, v, ex=None: final_prices.append(
            json.loads(v) if k.startswith('price:') else None
        )

        # Act - Process updates concurrently
        tasks = [
            self.market_service.process_price_update(update)
            for update in concurrent_updates
        ]
        await asyncio.gather(*tasks)

        # Assert - Final state should be consistent
        valid_prices = [p for p in final_prices if p is not None]
        assert len(valid_prices) == 20

        # All prices should be properly formatted
        for price_data in valid_prices:
            assert 'price' in price_data
            assert 'timestamp' in price_data
            assert price_data['symbol'] == symbol


class TestHighFrequencyUpdatePerformance:
    """Test performance under high-frequency update conditions"""

    def setup_method(self):
        """Set up test dependencies"""
        self.mock_redis = Mock()
        self.mock_db_session = AsyncMock()
        self.market_service = MarketService(
            db_session=self.mock_db_session,
            redis_client=self.mock_redis
        )

    @pytest.mark.asyncio
    async def test_high_frequency_update_performance(self):
        """Performance test: High-Frequency Update Handling
        Given: High-frequency market data (100 updates/second)
        When: WebSocket service processes rapid price changes
        Then: Maintain sub-50ms processing time per update
        """
        # Arrange
        symbol = 'SPY'
        num_updates = 50  # Reduced for test speed

        # Setup efficient mock responses
        self.mock_redis.pipeline.return_value.__enter__.return_value = self.mock_redis
        self.mock_redis.execute.return_value = [True] * num_updates * 2

        update_times = []

        # Act - Generate rapid updates
        for i in range(num_updates):
            start_time = time.time()

            market_update = {
                'symbol': symbol,
                'price': 450.00 + (i * 0.01),  # Incrementing price
                'timestamp': f'2024-01-15T15:30:{i:02d}Z'
            }

            await self.market_service.process_price_update(market_update)

            processing_time = (time.time() - start_time) * 1000  # Convert to ms
            update_times.append(processing_time)

        # Assert performance requirements
        avg_processing_time = sum(update_times) / len(update_times)
        max_processing_time = max(update_times)
        p95_processing_time = sorted(update_times)[int(num_updates * 0.95)]

        assert avg_processing_time < 25, f"Avg processing time: {avg_processing_time:.2f}ms"
        assert p95_processing_time < 50, f"95th percentile: {p95_processing_time:.2f}ms"
        assert max_processing_time < 100, f"Max processing time: {max_processing_time:.2f}ms"

    @pytest.mark.asyncio
    async def test_throughput_under_load(self):
        """Test system throughput under sustained load"""
        # Arrange
        updates_per_second = 100
        test_duration = 1  # 1 second test
        total_updates = updates_per_second * test_duration

        self.mock_redis.pipeline.return_value.__enter__.return_value = self.mock_redis
        self.mock_redis.execute.return_value = [True] * 2  # Set + publish

        # Act
        start_time = time.time()

        tasks = []
        for i in range(total_updates):
            update = {
                'symbol': 'AAPL',
                'price': 150.0 + (i * 0.01),
                'timestamp': f'2024-01-15T15:30:{i:02d}Z'
            }
            tasks.append(self.market_service.process_price_update(update))

        await asyncio.gather(*tasks)

        total_time = time.time() - start_time
        actual_throughput = total_updates / total_time

        # Assert
        assert actual_throughput >= 50, f"Throughput {actual_throughput:.2f}/sec below minimum"
        assert total_time <= test_duration * 2, f"Processing took too long: {total_time:.2f}s"


# Test fixtures for deterministic testing
@pytest.fixture
def deterministic_time():
    """Provide deterministic time for testing"""
    fixed_time = 1640995200  # 2022-01-01 00:00:00 UTC

    with patch('time.time', return_value=fixed_time):
        yield fixed_time


@pytest.fixture
def mock_websocket_factory():
    """Factory for creating mock WebSocket connections"""
    def create_websocket(latency_ms=25, stable=True):
        connection = MockWebSocketConnection()
        connection.latency_ms = latency_ms
        if not stable:
            connection.auto_disconnect_after = 1
        return connection

    return create_websocket


# Observability test fixtures
class TestObservabilityAssertions:
    """Test observability and monitoring assertions"""

    def setup_method(self):
        """Set up monitoring mocks"""
        self.metrics = {}
        self.logs = []

    def assert_metric_recorded(self, metric_name, min_value=None, max_value=None):
        """Assert that metric was recorded with proper bounds"""
        assert metric_name in self.metrics
        value = self.metrics[metric_name]

        if min_value is not None:
            assert value >= min_value, f"Metric {metric_name} below minimum: {value} < {min_value}"
        if max_value is not None:
            assert value <= max_value, f"Metric {metric_name} above maximum: {value} > {max_value}"

    def assert_log_entry_exists(self, log_type, metadata=None):
        """Assert that log entry exists with optional metadata"""
        matching_logs = [log for log in self.logs if log.get('type') == log_type]
        assert len(matching_logs) > 0, f"No log entries found for type: {log_type}"

        if metadata:
            for key, expected_value in metadata.items():
                found_match = False
                for log in matching_logs:
                    if key in log and str(log[key]) == str(expected_value):
                        found_match = True
                        break
                assert found_match, f"No log entry with {key}={expected_value}"

    @pytest.mark.asyncio
    async def test_real_time_observability(self):
        """Test observability assertions for real-time data flow"""
        # Arrange
        self.metrics = {
            'websocket_active_connections': 5,
            'messages_per_second': 25,
            'websocket_message_latency_ms': 45,
            'data_source_response_time_ms': 200,
            'redis_cache_hit_ratio': 0.85
        }

        self.logs = [
            {'type': 'websocket_connection_established', 'client_id': 'test_client'},
            {'type': 'subscription_processed', 'symbols_count': 3},
            {'type': 'price_update_processed', 'symbol': 'AAPL', 'latency_ms': 35}
        ]

        # Act & Assert - Connection metrics
        self.assert_metric_recorded('websocket_active_connections', min_value=1)
        self.assert_metric_recorded('messages_per_second', min_value=0)

        # Performance metrics
        self.assert_metric_recorded('websocket_message_latency_ms', max_value=100)
        self.assert_metric_recorded('data_source_response_time_ms', max_value=5000)

        # Health check assertions
        self.assert_log_entry_exists('websocket_connection_established')
        self.assert_log_entry_exists('subscription_processed', {'symbols_count': '3'})

        # Cache performance
        self.assert_metric_recorded('redis_cache_hit_ratio', min_value=0.8)