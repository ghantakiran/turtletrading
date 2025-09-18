# MarketData • Real-time Streaming Tests

- **REQ-IDs covered**: REQ-MARKET-01, REQ-MARKET-02
- **Given/When/Then scenarios**:

## UT-MARKET-01.1: WebSocket Connection Management
**Given**: WebSocket server configured for market data streaming
**When**: establish_websocket_connection() is called
**Then**: Successfully connect and maintain heartbeat with <100ms latency

```python
async def test_websocket_connection_establishment():
    # Arrange
    websocket_config = {
        'url': 'ws://localhost:8080/market-stream',
        'heartbeat_interval': 30,
        'reconnect_attempts': 3
    }

    # Act
    connection = await websocket_manager.establish_connection(websocket_config)

    # Assert
    assert connection.is_connected == True
    assert connection.latency_ms < 100
    assert connection.heartbeat_active == True

    # Cleanup
    await connection.close()
```

## UT-MARKET-01.2: Real-time Price Update Processing
**Given**: Active WebSocket connection with price subscriptions
**When**: receive_price_update() processes incoming market data
**Then**: Update in-memory cache and notify subscribers within 50ms

```python
async def test_real_time_price_updates():
    # Arrange
    mock_price_update = {
        'symbol': 'AAPL',
        'price': 150.25,
        'volume': 1000000,
        'timestamp': '2024-01-15T15:30:00Z'
    }

    # Act
    start_time = time.time()
    await market_stream.receive_price_update(mock_price_update)
    processing_time = (time.time() - start_time) * 1000

    # Assert
    assert processing_time < 50  # Under 50ms processing
    cached_price = await cache_manager.get_price('AAPL')
    assert cached_price == 150.25
    assert len(market_stream.subscribers) > 0
```

## UT-MARKET-02.1: Market Sentiment Aggregation
**Given**: Multiple sentiment data sources (news, social media)
**When**: aggregate_market_sentiment() combines sentiment scores
**Then**: Return weighted sentiment score between -100 and +100

```python
def test_market_sentiment_aggregation():
    # Arrange
    sentiment_sources = {
        'news_sentiment': {'score': 75, 'weight': 0.6, 'confidence': 0.85},
        'social_sentiment': {'score': -20, 'weight': 0.3, 'confidence': 0.70},
        'analyst_sentiment': {'score': 50, 'weight': 0.1, 'confidence': 0.95}
    }

    # Act
    aggregated = sentiment_service.aggregate_market_sentiment(sentiment_sources)

    # Assert
    assert -100 <= aggregated['score'] <= 100
    assert aggregated['confidence'] > 0.5
    assert 'weighted_score' in aggregated
    expected_score = (75*0.6 + (-20)*0.3 + 50*0.1)
    assert abs(aggregated['weighted_score'] - expected_score) < 0.1
```

## ET-MARKET-01.1: WebSocket Disconnection Recovery
**Given**: Active WebSocket connection experiences network interruption
**When**: handle_disconnection() attempts reconnection
**Then**: Automatically reconnect with exponential backoff, max 3 attempts

```python
async def test_websocket_reconnection():
    # Arrange
    connection = MockWebSocketConnection(auto_disconnect_after=5)
    reconnection_attempts = []

    # Act
    with pytest.raises(ConnectionError):
        await websocket_manager.handle_disconnection(connection)

    # Assert
    assert len(websocket_manager.reconnection_log) <= 3
    assert websocket_manager.reconnection_log[0]['delay'] == 1  # First attempt: 1s
    assert websocket_manager.reconnection_log[1]['delay'] == 2  # Second attempt: 2s
    assert websocket_manager.reconnection_log[2]['delay'] == 4  # Third attempt: 4s
```

## PT-MARKET-01.1: Message Ordering Property
**Given**: Rapid sequence of price updates for same symbol
**When**: process_message_queue() handles concurrent updates
**Then**: Final price reflects the most recent timestamp, no race conditions

```python
async def test_message_ordering_property():
    # Arrange
    price_updates = [
        {'symbol': 'TSLA', 'price': 200.00, 'timestamp': '2024-01-15T15:30:00Z'},
        {'symbol': 'TSLA', 'price': 201.50, 'timestamp': '2024-01-15T15:30:02Z'},
        {'symbol': 'TSLA', 'price': 199.75, 'timestamp': '2024-01-15T15:30:01Z'},  # Out of order
    ]

    # Act
    for update in price_updates:
        await market_stream.process_price_update(update)

    # Assert
    final_price = await cache_manager.get_price('TSLA')
    assert final_price == 201.50  # Most recent timestamp wins

    price_history = await cache_manager.get_price_history('TSLA')
    timestamps = [entry['timestamp'] for entry in price_history]
    assert timestamps == sorted(timestamps)  # Chronological order maintained
```

- **Mocks/stubs/fakes**:
  - MockWebSocketConnection for controllable connection scenarios
  - Stub external market data providers (Alpha Vantage, yfinance)
  - Fake network conditions for disconnection/latency testing

- **Deterministic seeds & time controls**:
  - Fixed timestamps for consistent message ordering tests
  - Controlled network delay simulation: 10ms, 50ms, 100ms scenarios
  - Deterministic market data generation with predictable patterns

- **Expected coverage deltas**:
  - Lines: +127 lines (WebSocket management, sentiment aggregation, message processing)
  - Branches: +22 branches (reconnection logic, sentiment weighting, error handling)
  - Functions: +9 functions (connection handlers, sentiment calculators, stream processors)