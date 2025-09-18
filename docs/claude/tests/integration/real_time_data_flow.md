# Integration: Real-time Market Data Flow

- **Modules involved**: MarketData, DataSources, UserInterface, Infrastructure, Authentication
- **Contracts validated**:
  - MarketData ↔ DataSources: Live price feed integration and failover
  - MarketData ↔ UserInterface: WebSocket real-time updates to frontend
  - MarketData ↔ Infrastructure: Redis caching and WebSocket connection management
  - Authentication ↔ MarketData: User subscription-based data access control

- **Scenarios (happy, failure, timeout, retry, idempotent)**:

## Happy Path: Real-time Price Streaming
**Given**: Authenticated user subscribes to real-time price updates
**When**: Market data flows through WebSocket connection
**Then**: Frontend receives price updates within 100ms of market changes

```python
async def test_real_time_price_streaming_happy_path():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    websocket_client = await connect_websocket(auth_token)

    # Subscribe to real-time updates
    await websocket_client.send_json({
        'action': 'subscribe',
        'symbols': ['AAPL', 'TSLA', 'NVDA'],
        'data_types': ['price', 'volume']
    })

    # Act - Simulate market data update
    market_update = {
        'symbol': 'AAPL',
        'price': 150.25,
        'volume': 1000000,
        'timestamp': datetime.utcnow().isoformat()
    }
    await market_data_service.broadcast_update(market_update)

    # Assert
    start_time = time.time()
    received_update = await websocket_client.receive_json()
    latency_ms = (time.time() - start_time) * 1000

    assert latency_ms < 100  # Sub-100ms latency requirement
    assert received_update['symbol'] == 'AAPL'
    assert received_update['price'] == 150.25
    assert received_update['type'] == 'price_update'

    # Cleanup
    await websocket_client.close()
```

## Failure Path: WebSocket Connection Drop
**Given**: Active WebSocket connection with subscriptions
**When**: Network interruption causes connection drop
**Then**: Automatic reconnection with subscription restoration

```python
async def test_websocket_reconnection_flow():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'basic')
    websocket_client = await connect_websocket(auth_token)

    # Establish subscriptions
    await websocket_client.send_json({
        'action': 'subscribe',
        'symbols': ['SPY', 'QQQ']
    })

    # Confirm subscription
    subscription_ack = await websocket_client.receive_json()
    assert subscription_ack['status'] == 'subscribed'

    # Act - Simulate connection drop
    await websocket_client.force_disconnect()

    # Automatic reconnection should occur
    await asyncio.sleep(2)  # Allow time for reconnection

    # Assert - Reconnection and subscription restoration
    reconnected_client = await get_reconnected_websocket(auth_token)

    # Send test update to verify subscriptions restored
    test_update = {'symbol': 'SPY', 'price': 450.00}
    await market_data_service.broadcast_update(test_update)

    received_update = await reconnected_client.receive_json()
    assert received_update['symbol'] == 'SPY'
    assert received_update['price'] == 450.00

    # Verify subscription persistence
    connection_state = await market_data_service.get_connection_state(auth_token)
    assert 'SPY' in connection_state['subscriptions']
    assert 'QQQ' in connection_state['subscriptions']
```

## Timeout Scenario: Data Source Response Timeout
**Given**: External market data API experiences high latency
**When**: Real-time data request times out (>5 seconds)
**Then**: Fallback to cached data and log timeout event

```python
async def test_data_source_timeout_handling():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    websocket_client = await connect_websocket(auth_token)

    # Simulate slow external API
    mock_external_apis.set_response_delay('alpha_vantage', 7)  # 7 second delay

    # Act - Request real-time data that will timeout
    await websocket_client.send_json({
        'action': 'get_quote',
        'symbol': 'MSFT'
    })

    # Assert
    start_time = time.time()
    response = await websocket_client.receive_json()
    duration = time.time() - start_time

    assert duration < 6  # Should timeout before 6 seconds
    assert response['status'] == 'partial_data'
    assert response['data_source'] == 'cache'
    assert response['warning'] == 'external_api_timeout'
    assert 'last_updated' in response

    # Verify fallback data is still useful
    assert response['symbol'] == 'MSFT'
    assert 'price' in response
    assert response['age_seconds'] < 300  # Cache data less than 5 minutes old
```

## Retry Scenario: Intermittent API Failures
**Given**: External data source has intermittent failures (50% success rate)
**When**: Real-time data service attempts multiple API calls
**Then**: Retry with exponential backoff, succeed within 3 attempts

```python
async def test_api_retry_logic():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'basic')

    # Simulate intermittent failures (fail, fail, succeed pattern)
    mock_external_apis.set_failure_rate('yfinance', 0.67)  # 67% failure rate
    mock_external_apis.set_retry_pattern([False, False, True])  # Succeed on 3rd try

    # Act
    start_time = time.time()
    quote_result = await market_data_service.get_real_time_quote('AMZN')
    duration = time.time() - start_time

    # Assert
    assert quote_result['success'] == True
    assert quote_result['symbol'] == 'AMZN'
    assert quote_result['retry_attempts'] == 3

    # Verify exponential backoff timing (1s + 2s + success = ~3+ seconds)
    assert duration >= 3.0
    assert duration < 8.0  # But not excessive

    # Verify data quality despite retries
    assert quote_result['price'] > 0
    assert quote_result['timestamp'] is not None
    assert quote_result['data_source'] in ['yfinance', 'alpha_vantage']
```

## Idempotency: Duplicate Subscription Requests
**Given**: User sends multiple identical subscription requests
**When**: WebSocket handler processes duplicate subscriptions
**Then**: Maintain single subscription per symbol, no duplicate updates

```python
async def test_subscription_idempotency():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    websocket_client = await connect_websocket(auth_token)

    # Act - Send multiple identical subscription requests
    for i in range(5):
        await websocket_client.send_json({
            'action': 'subscribe',
            'symbols': ['GOOGL'],
            'request_id': f'req_{i}'
        })

    # Receive acknowledgments
    ack_responses = []
    for i in range(5):
        ack = await websocket_client.receive_json()
        ack_responses.append(ack)

    # Assert - All requests acknowledged but single subscription maintained
    for ack in ack_responses:
        assert ack['status'] == 'subscribed'
        assert ack['symbol'] == 'GOOGL'

    # Verify only one subscription exists
    connection_state = await market_data_service.get_connection_state(auth_token)
    googl_subscriptions = [sub for sub in connection_state['subscriptions'] if sub['symbol'] == 'GOOGL']
    assert len(googl_subscriptions) == 1

    # Test that only one update is sent per market change
    await market_data_service.broadcast_update({'symbol': 'GOOGL', 'price': 2750.00})

    # Should receive exactly one update, not five
    update_count = 0
    try:
        while True:
            await asyncio.wait_for(websocket_client.receive_json(), timeout=1.0)
            update_count += 1
    except asyncio.TimeoutError:
        pass  # Expected after receiving all updates

    assert update_count == 1  # Exactly one update received
```

## Performance: High-Frequency Update Handling
**Given**: High-frequency market data (100 updates/second)
**When**: WebSocket service processes rapid price changes
**Then**: Maintain sub-50ms processing time per update

```python
async def test_high_frequency_update_performance():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    websocket_client = await connect_websocket(auth_token)

    await websocket_client.send_json({
        'action': 'subscribe',
        'symbols': ['SPY'],
        'high_frequency': True
    })

    # Act - Generate 100 rapid updates
    update_times = []
    for i in range(100):
        start_time = time.time()

        market_update = {
            'symbol': 'SPY',
            'price': 450.00 + (i * 0.01),  # Incrementing price
            'timestamp': datetime.utcnow().isoformat()
        }

        await market_data_service.broadcast_update(market_update)
        received_update = await websocket_client.receive_json()

        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        update_times.append(processing_time)

    # Assert performance requirements
    avg_processing_time = sum(update_times) / len(update_times)
    max_processing_time = max(update_times)
    p95_processing_time = sorted(update_times)[94]  # 95th percentile

    assert avg_processing_time < 25  # Average under 25ms
    assert p95_processing_time < 50  # 95th percentile under 50ms
    assert max_processing_time < 100  # No update over 100ms

    # Verify data integrity under high frequency
    final_update = received_update
    assert final_update['symbol'] == 'SPY'
    assert final_update['price'] == 450.99  # Last price in sequence
```

- **Data fixtures & golden files**:
  - `fixtures/market_hours_schedule.json`: Trading hours and market status
  - `fixtures/high_frequency_price_data.json`: Sample rapid price movements
  - `golden/websocket_message_format.json`: Standard WebSocket message structure
  - `fixtures/connection_failure_scenarios.json`: Network failure simulation data

- **Observability assertions**:
  - WebSocket connection metrics (active connections, messages/second)
  - Data source health checks and failover events
  - Redis cache hit/miss ratios for real-time data
  - Alert triggers for connection drops or high latency

```python
def assert_real_time_observability(websocket_session):
    # Connection metrics
    assert_metric_recorded("websocket_active_connections", min_value=1)
    assert_metric_recorded("messages_per_second", min_value=0)

    # Performance metrics
    assert_metric_recorded("websocket_message_latency_ms", max_value=100)
    assert_metric_recorded("data_source_response_time_ms", max_value=5000)

    # Health check assertions
    assert_log_entry_exists("websocket_connection_established")
    assert_log_entry_exists("subscription_processed", {"symbols_count": ">0"})

    # Cache performance
    assert_metric_recorded("redis_cache_hit_ratio", min_value=0.8)
```