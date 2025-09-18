# Integration: Stock Analysis End-to-End Flow

- **Modules involved**: StockAnalysis, DataSources, Authentication, MarketData, UserInterface
- **Contracts validated**:
  - StockAnalysis ↔ DataSources: Stock price data retrieval and caching
  - Authentication ↔ StockAnalysis: User permissions for advanced features
  - MarketData ↔ StockAnalysis: Real-time price updates integration
  - UserInterface ↔ StockAnalysis: Frontend display of analysis results

- **Scenarios (happy, failure, timeout, retry, idempotent)**:

## Happy Path: Complete Stock Analysis Flow
**Given**: Authenticated user requests analysis for AAPL
**When**: Full analysis pipeline executes (data fetch → technical analysis → LSTM prediction → sentiment analysis)
**Then**: Return comprehensive analysis with 95% confidence scores

```python
async def test_complete_stock_analysis_happy_path():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    symbol = 'AAPL'

    # Act - Execute full analysis pipeline
    response = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    # Assert
    assert response.status_code == 200
    analysis = response.json()

    # Validate contract compliance
    assert analysis['symbol'] == symbol
    assert 'technical_score' in analysis
    assert 'lstm_prediction' in analysis
    assert 'sentiment_score' in analysis
    assert analysis['confidence'] >= 0.95

    # Validate cross-module integration
    assert analysis['technical_score']['rsi'] is not None  # StockAnalysis module
    assert analysis['data_sources']['primary'] == 'yfinance'  # DataSources module
    assert analysis['user_tier'] == 'pro'  # Authentication module
    assert analysis['real_time_price'] is not None  # MarketData module
```

## Failure Path: External API Unavailable
**Given**: Primary data source (yfinance) is unavailable
**When**: Stock analysis request attempts data retrieval
**Then**: Automatically fallback to Alpha Vantage and complete analysis

```python
async def test_data_source_failover():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'basic')
    symbol = 'TSLA'

    # Simulate yfinance failure
    mock_external_apis.yfinance.set_unavailable()

    # Act
    response = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    # Assert
    assert response.status_code == 200
    analysis = response.json()

    # Validate fallback behavior
    assert analysis['data_sources']['primary'] == 'alpha_vantage'
    assert analysis['data_sources']['fallback_used'] == True
    assert analysis['symbol'] == symbol
    assert 'technical_score' in analysis  # Analysis still completes
```

## Timeout Scenario: LSTM Model Prediction Timeout
**Given**: LSTM model prediction takes longer than 30 seconds
**When**: Analysis request waits for prediction
**Then**: Return partial analysis without LSTM prediction, log timeout

```python
async def test_lstm_prediction_timeout():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    symbol = 'NVDA'

    # Simulate slow LSTM prediction
    mock_lstm_service.set_prediction_delay(35)  # 35 second delay

    # Act
    start_time = time.time()
    response = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=32  # 32 second timeout
    )
    duration = time.time() - start_time

    # Assert
    assert response.status_code == 200
    assert duration < 32  # Request completed within timeout

    analysis = response.json()
    assert analysis['lstm_prediction']['status'] == 'timeout'
    assert analysis['lstm_prediction']['error'] == 'prediction_timeout_30s'
    assert 'technical_score' in analysis  # Other analysis components completed
    assert 'sentiment_score' in analysis
```

## Retry Scenario: Temporary Network Failure
**Given**: Intermittent network failures during data retrieval
**When**: Stock analysis attempts external API calls
**Then**: Retry 3 times with exponential backoff, succeed on 3rd attempt

```python
async def test_network_retry_logic():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'basic')
    symbol = 'META'

    # Simulate network failures (fail first 2 attempts, succeed on 3rd)
    mock_external_apis.set_failure_pattern([True, True, False])

    # Act
    start_time = time.time()
    response = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    duration = time.time() - start_time

    # Assert
    assert response.status_code == 200
    analysis = response.json()

    # Validate retry behavior
    assert analysis['data_sources']['retry_attempts'] == 3
    assert analysis['data_sources']['final_attempt_success'] == True
    assert duration > 3  # Should take time due to retries (1s + 2s + success)
    assert duration < 10  # But not excessive
```

## Idempotency: Repeated Analysis Requests
**Given**: Multiple identical analysis requests within cache TTL
**When**: Same user requests same symbol analysis repeatedly
**Then**: Return cached results with consistent data

```python
async def test_analysis_idempotency():
    # Arrange
    auth_token = await create_test_user_token('test@example.com', 'pro')
    symbol = 'GOOGL'

    # Act - Make multiple identical requests
    responses = []
    for i in range(5):
        response = await client.get(
            f"/api/v1/stocks/{symbol}/analysis",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        responses.append(response.json())

    # Assert
    # All responses should be identical (cached)
    first_response = responses[0]
    for response in responses[1:]:
        assert response['symbol'] == first_response['symbol']
        assert response['technical_score'] == first_response['technical_score']
        assert response['lstm_prediction'] == first_response['lstm_prediction']
        assert response['cache_hit'] == True  # Except first request

    # Validate cache metadata
    assert first_response['cache_hit'] == False  # First request was cache miss
    assert all(resp['cache_hit'] == True for resp in responses[1:])
```

- **Data fixtures & golden files**:
  - `fixtures/aapl_historical_data.json`: 1 year of AAPL OHLCV data
  - `fixtures/market_crash_scenario.json`: 2008-style market crash data
  - `golden/aapl_technical_analysis.json`: Expected technical indicator values
  - `golden/lstm_prediction_output.json`: Reference LSTM prediction format

- **Observability assertions**:
  - Log entries for each module interaction
  - Metrics collection for response times and error rates
  - Tracing headers propagated through all service calls
  - Alert triggers for analysis failures or timeout scenarios

```python
def assert_observability_compliance(analysis_response):
    # Log assertions
    assert_log_entry_exists("stock_analysis_started", {"symbol": "AAPL"})
    assert_log_entry_exists("data_source_selected", {"source": "yfinance"})
    assert_log_entry_exists("technical_analysis_completed", {"indicators_count": 15})

    # Metrics assertions
    assert_metric_recorded("stock_analysis_duration_ms", min_value=0, max_value=30000)
    assert_metric_recorded("data_source_success_rate", min_value=0.95)
    assert_metric_recorded("cache_hit_ratio", min_value=0.8)
    assert_metric_recorded("lstm_prediction_accuracy", min_value=0.7)

    # Tracing assertions
    assert_trace_header_present("X-Request-ID")
    assert_trace_spans_connected(["auth", "data_fetch", "analysis", "response"])

    # Performance assertions
    assert_metric_recorded("api_response_time_p95", max_value=2000)  # 2 seconds
    assert_metric_recorded("database_query_duration_ms", max_value=100)

    # Error rate assertions
    assert_metric_recorded("stock_analysis_error_rate", max_value=0.01)  # 1% error rate
    assert_metric_recorded("external_api_timeout_rate", max_value=0.05)  # 5% timeout rate

    # Business metrics assertions
    assert_metric_recorded("analysis_requests_per_minute", min_value=1)
    assert_metric_recorded("user_subscription_tier_distribution", min_value=1)
```

## Cross-Module Contract Validation

### Authentication → StockAnalysis Contract
```python
async def test_auth_stock_analysis_contract():
    # Test user tier permissions
    basic_token = await create_test_user_token('basic@example.com', 'basic')
    pro_token = await create_test_user_token('pro@example.com', 'pro')

    # Basic user - limited features
    basic_response = await client.get(
        "/api/v1/stocks/AAPL/analysis",
        headers={"Authorization": f"Bearer {basic_token}"}
    )
    basic_analysis = basic_response.json()
    assert basic_analysis['features_available'] == ['basic_technical', 'price_data']
    assert 'lstm_prediction' not in basic_analysis

    # Pro user - full features
    pro_response = await client.get(
        "/api/v1/stocks/AAPL/analysis",
        headers={"Authorization": f"Bearer {pro_token}"}
    )
    pro_analysis = pro_response.json()
    assert pro_analysis['features_available'] == ['basic_technical', 'advanced_technical', 'lstm_prediction', 'sentiment_analysis']
    assert 'lstm_prediction' in pro_analysis
```

### DataSources → StockAnalysis Contract
```python
async def test_data_sources_stock_analysis_contract():
    auth_token = await create_test_user_token('test@example.com', 'pro')

    # Test primary data source success
    response = await client.get(
        "/api/v1/stocks/AAPL/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    analysis = response.json()

    # Validate data source contract
    assert analysis['data_sources']['primary'] in ['yfinance', 'alpha_vantage']
    assert analysis['data_sources']['response_time_ms'] < 5000
    assert analysis['data_sources']['data_freshness_minutes'] < 5
    assert 'price' in analysis['stock_data']
    assert 'volume' in analysis['stock_data']
    assert analysis['stock_data']['timestamp'] is not None
```

### MarketData → StockAnalysis Contract
```python
async def test_market_data_stock_analysis_integration():
    auth_token = await create_test_user_token('test@example.com', 'pro')

    # Subscribe to real-time updates
    websocket_client = await connect_websocket(auth_token)
    await websocket_client.send_json({
        'action': 'subscribe',
        'symbols': ['AAPL'],
        'analysis_updates': True
    })

    # Request analysis
    analysis_response = await client.get(
        "/api/v1/stocks/AAPL/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    # Verify real-time price integration
    analysis = analysis_response.json()
    assert analysis['real_time_integration'] == True
    assert analysis['price_staleness_seconds'] < 60

    # Simulate market update and verify analysis update
    await market_data_service.broadcast_update({
        'symbol': 'AAPL',
        'price': 175.50,
        'volume': 2000000
    })

    # Should receive updated analysis
    updated_analysis = await websocket_client.receive_json()
    assert updated_analysis['type'] == 'analysis_update'
    assert updated_analysis['symbol'] == 'AAPL'
    assert updated_analysis['updated_fields'] == ['price', 'technical_indicators']
```

## Performance Integration Tests

### High-Load Analysis Requests
```python
async def test_concurrent_analysis_requests():
    # Create multiple user tokens
    tokens = []
    for i in range(20):
        token = await create_test_user_token(f'user{i}@example.com', 'basic')
        tokens.append(token)

    # Concurrent analysis requests
    tasks = []
    symbols = ['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'NVDA']

    for i, token in enumerate(tokens):
        symbol = symbols[i % len(symbols)]
        task = asyncio.create_task(
            client.get(
                f"/api/v1/stocks/{symbol}/analysis",
                headers={"Authorization": f"Bearer {token}"}
            )
        )
        tasks.append(task)

    # Execute all requests concurrently
    start_time = time.time()
    responses = await asyncio.gather(*tasks, return_exceptions=True)
    duration = time.time() - start_time

    # Performance assertions
    assert duration < 10  # All requests complete within 10 seconds

    successful_responses = [r for r in responses if not isinstance(r, Exception)]
    assert len(successful_responses) >= 18  # At least 90% success rate

    # Verify response quality under load
    for response in successful_responses[:5]:  # Sample check
        analysis = response.json()
        assert analysis['symbol'] in symbols
        assert 'technical_score' in analysis
        assert analysis['processing_time_ms'] < 3000
```

## Data Integrity Validation

### Cross-Module Data Consistency
```python
async def test_cross_module_data_consistency():
    auth_token = await create_test_user_token('test@example.com', 'pro')
    symbol = 'AAPL'

    # Get data from multiple modules
    stock_analysis = await client.get(
        f"/api/v1/stocks/{symbol}/analysis",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    market_data = await client.get(
        f"/api/v1/market/stock/{symbol}",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    price_data = await client.get(
        f"/api/v1/stocks/{symbol}/price",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    # Validate data consistency across modules
    analysis_price = stock_analysis.json()['current_price']
    market_price = market_data.json()['current_price']
    direct_price = price_data.json()['price']

    # Prices should be consistent (within 1% tolerance for timing differences)
    price_variance = max(analysis_price, market_price, direct_price) / min(analysis_price, market_price, direct_price)
    assert price_variance <= 1.01  # Max 1% variance

    # Timestamps should be recent and consistent
    timestamps = [
        stock_analysis.json()['timestamp'],
        market_data.json()['timestamp'],
        price_data.json()['timestamp']
    ]

    for timestamp in timestamps:
        ts_age = (datetime.utcnow() - datetime.fromisoformat(timestamp.replace('Z', '+00:00'))).total_seconds()
        assert ts_age < 300  # All timestamps within 5 minutes
```