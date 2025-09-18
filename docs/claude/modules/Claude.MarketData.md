# Claude.MarketData

- **Purpose**: Provide real-time market data streaming, sentiment analysis, WebSocket management, and comprehensive market breadth analysis for live trading insights and market condition assessment
- **Scope (in/out)**:
  - **In**: WebSocket data streaming, sentiment analysis, market indices tracking, market breadth calculations, real-time price broadcasting, connection management, data validation
  - **Out**: Raw data fetching (handled by DataSources), stock-specific analysis (handled by StockAnalysis), user interface rendering (handled by UserInterface), data storage (handled by Infrastructure)
- **Public API (signatures, inputs/outputs, errors)**:
  - `MarketDataService.get_market_overview() → MarketOverview | None`
  - `MarketDataService.get_market_indices() → Dict[str, IndexData] | None`
  - `MarketDataService.get_market_breadth() → MarketBreadth | None`
  - `MarketDataService.get_sentiment_overview() → SentimentOverview | None`
  - `WebSocketManager.connect_client(client_id, auth_token) → WebSocketConnection | ConnectionError`
  - `WebSocketManager.subscribe_to_symbols(client_id, symbols) → SubscriptionResult | None`
  - `WebSocketManager.broadcast_update(market_update) → BroadcastResult | None`
- **Data contracts (schemas, invariants)**:
  - MarketOverview: indices(Dict[str, IndexData]), market_status('OPEN'|'CLOSED'|'PRE_MARKET'|'AFTER_HOURS'), sentiment_score(-100≤float≤100), breadth(MarketBreadth), timestamp(datetime)
  - IndexData: symbol(str), current_value(float>0), change_percent(float), volume(int≥0), timestamp(datetime)
  - MarketBreadth: advancing(int≥0), declining(int≥0), unchanged(int≥0), ratio(0≤float≤∞), new_highs(int≥0), new_lows(int≥0)
  - SentimentOverview: overall_score(-100≤float≤100), news_sentiment(float), social_sentiment(float), confidence(0≤float≤1), trending_keywords(List[str])
  - WebSocketConnection: client_id(str), subscriptions(Set[str]), connected_at(datetime), last_ping(datetime)
- **Dependencies (internal/external)**:
  - **Internal**: DataSources (real-time feeds), Authentication (user validation), Infrastructure (Redis pub/sub), StockAnalysis (symbol validation)
  - **External**: WebSocket, asyncio, redis, aiohttp, websockets, sentiment analysis APIs, market data providers
- **State & concurrency model**: Stateful WebSocket connection pool with Redis pub/sub for message broadcasting, asyncio event loop for concurrent connection management, sentiment analysis caching
- **Failure modes & retries**: WebSocket reconnection with exponential backoff, sentiment API fallback to cached data, market data source failover, connection cleanup on errors
- **Performance/SLOs**: <100ms WebSocket message delivery, <500ms market overview aggregation, 99.9% WebSocket uptime, support 1000+ concurrent connections
- **Security/permissions**: WebSocket authentication via JWT, rate limiting per connection, subscription validation, no sensitive data in WebSocket messages
- **Observability (logs/metrics/traces)**: WebSocket connection metrics, message throughput, sentiment API response times, market data latency, connection failure rates
- **Change risks & migration notes**: WebSocket protocol changes require client updates, sentiment model updates need confidence recalibration, market data schema changes need message format versioning

## TDD: Requirements → Tests

### REQ-MARKET-01: Real-time WebSocket data streaming with connection management and subscription handling
- **Unit tests**:
  - UT-MARKET-01.1: Given valid auth token When connect_websocket() Then establish connection and return client_id
  - UT-MARKET-01.2: Given client connection When subscribe_to_symbols(['AAPL', 'TSLA']) Then confirm subscription and start data streaming
  - UT-MARKET-01.3: Given market data update When broadcast_update() Then deliver to all subscribed clients within 100ms
- **Edge/negative/property tests**:
  - ET-MARKET-01.1: Given invalid auth token When connect_websocket() Then reject connection with proper error message
  - ET-MARKET-01.2: Given connection drop When reconnect_attempt() Then restore subscriptions with exponential backoff
  - PT-MARKET-01.1: Property: message delivery order preserved, no duplicate messages, all subscribed clients receive updates
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock WebSocket connections with controllable network conditions
  - Stub Redis pub/sub for deterministic message broadcasting
  - Fake market data updates for subscription testing
- **Coverage mapping**:
  - Lines/branches/functions covered: connect_websocket(), subscribe_symbols(), broadcast_update(), handle_disconnect(), validate_subscription()

### REQ-MARKET-02: Market indices and breadth analysis with real-time aggregation and performance tracking
- **Unit tests**:
  - UT-MARKET-02.1: Given market open When get_market_indices() Then return SPY, QQQ, DIA, IWM with current values and changes
  - UT-MARKET-02.2: Given stock universe When calculate_market_breadth() Then return advancing/declining ratio and new highs/lows
  - UT-MARKET-02.3: Given market close When get_market_overview() Then return comprehensive market status with indices and breadth
- **Edge/negative/property tests**:
  - ET-MARKET-02.1: Given market closed When get_live_data() Then return cached data with proper staleness indicators
  - ET-MARKET-02.2: Given data source failure When aggregate_indices() Then fallback to alternative sources and log errors
  - PT-MARKET-02.1: Property: breadth ratios mathematically consistent, index changes sum correctly, timestamps within acceptable variance
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock market data providers with various market conditions
  - Stub time functions for market hours testing
  - Fake index calculations with known market scenarios
- **Coverage mapping**:
  - Lines/branches/functions covered: get_market_indices(), calculate_breadth(), aggregate_market_data(), validate_market_hours()

### REQ-MARKET-03: Sentiment analysis aggregation with multi-source integration and confidence scoring
- **Unit tests**:
  - UT-MARKET-03.1: Given news articles When analyze_sentiment() Then return aggregated sentiment score with confidence levels
  - UT-MARKET-03.2: Given social media data When process_social_sentiment() Then extract trending keywords and sentiment scores
  - UT-MARKET-03.3: Given multiple sentiment sources When calculate_overall_sentiment() Then weight by reliability and recency
- **Edge/negative/property tests**:
  - ET-MARKET-03.1: Given sentiment API timeout When get_sentiment() Then return cached sentiment with reduced confidence
  - ET-MARKET-03.2: Given conflicting sentiment signals When resolve_conflicts() Then apply confidence-weighted averaging
  - PT-MARKET-03.1: Property: sentiment scores bounded -100 to +100, confidence decreases with data age, keyword relevance scores consistent
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock sentiment APIs with various response patterns
  - Stub natural language processing with controlled sentiment outputs
  - Fake social media feeds with known sentiment patterns
- **Coverage mapping**:
  - Lines/branches/functions covered: analyze_sentiment(), process_social_data(), calculate_confidence(), aggregate_sentiment_sources()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-MARKET-01 | UT-MARKET-01.1-3 | ET-MARKET-01.1-2 | PT-MARKET-01.1 | IT-MARKET-01 |
| REQ-MARKET-02 | UT-MARKET-02.1-3 | ET-MARKET-02.1-2 | PT-MARKET-02.1 | IT-MARKET-02 |
| REQ-MARKET-03 | UT-MARKET-03.1-3 | ET-MARKET-03.1-2 | PT-MARKET-03.1 | IT-MARKET-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **WebSocket Management**: authenticate_connection() → establish_websocket() → manage_subscriptions() → handle_messages() → cleanup_on_disconnect()
2. **Market Data Streaming**: fetch_real_time_data() → validate_data() → broadcast_to_subscribers() → update_cache() → log_metrics()
3. **Sentiment Analysis**: gather_news_data() → analyze_sentiment() → aggregate_social_data() → calculate_confidence() → cache_results()

### Pseudocode (reference)
```python
async def broadcast_market_update(market_update: MarketUpdate) -> BroadcastResult:
    # Validate market update
    if not validate_market_update(market_update):
        raise ValueError("Invalid market update format")

    # Get all subscribers for this symbol
    subscribers = await redis.get_subscribers(market_update.symbol)
    if not subscribers:
        return BroadcastResult(delivered=0, symbol=market_update.symbol)

    # Prepare WebSocket message
    ws_message = {
        "type": "market_update",
        "symbol": market_update.symbol,
        "price": market_update.price,
        "change_percent": market_update.change_percent,
        "volume": market_update.volume,
        "timestamp": market_update.timestamp.isoformat()
    }

    # Broadcast to all subscribers concurrently
    delivery_tasks = []
    for client_id in subscribers:
        connection = websocket_pool.get_connection(client_id)
        if connection and connection.is_active:
            task = asyncio.create_task(
                connection.send_json(ws_message)
            )
            delivery_tasks.append(task)

    # Wait for all deliveries with timeout
    delivered_count = 0
    try:
        results = await asyncio.wait_for(
            asyncio.gather(*delivery_tasks, return_exceptions=True),
            timeout=0.1  # 100ms timeout
        )

        delivered_count = sum(1 for result in results if not isinstance(result, Exception))

    except asyncio.TimeoutError:
        logger.warning(f"Broadcast timeout for {market_update.symbol}")

    # Update metrics
    await metrics.record_broadcast_stats(
        symbol=market_update.symbol,
        subscribers=len(subscribers),
        delivered=delivered_count,
        duration_ms=(datetime.utcnow() - start_time).total_seconds() * 1000
    )

    return BroadcastResult(
        delivered=delivered_count,
        total_subscribers=len(subscribers),
        symbol=market_update.symbol
    )

async def get_market_overview() -> Optional[MarketOverview]:
    # Get market status
    market_status = await get_market_status()

    # Fetch major indices concurrently
    indices_task = asyncio.create_task(get_market_indices())
    breadth_task = asyncio.create_task(calculate_market_breadth())
    sentiment_task = asyncio.create_task(get_sentiment_overview())

    # Wait for all components
    try:
        indices = await asyncio.wait_for(indices_task, timeout=2.0)
        breadth = await asyncio.wait_for(breadth_task, timeout=1.0)
        sentiment = await asyncio.wait_for(sentiment_task, timeout=3.0)
    except asyncio.TimeoutError as e:
        logger.error(f"Market overview timeout: {e}")
        return None

    # Aggregate into overview
    overview = MarketOverview(
        indices=indices,
        market_status=market_status,
        sentiment_score=sentiment.overall_score if sentiment else 0,
        breadth=breadth,
        timestamp=datetime.utcnow()
    )

    # Cache result for 30 seconds
    await redis.setex(
        "market_overview",
        30,
        overview.json()
    )

    return overview
```

### Error Handling & Retries
- **WebSocket failures**: Automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- **Sentiment API errors**: Fallback to cached sentiment data, degrade confidence scores
- **Market data source failures**: Circuit breaker pattern, failover to backup providers
- **Redis connection issues**: Local caching fallback, alert for infrastructure issues

### Config/flags
```python
MARKET_DATA_CONFIG = {
    "WEBSOCKET_CONFIG": {
        "MAX_CONNECTIONS": 1000,
        "HEARTBEAT_INTERVAL": 30,  # seconds
        "CONNECTION_TIMEOUT": 60,
        "MESSAGE_QUEUE_SIZE": 100,
        "RECONNECT_BACKOFF": [1, 2, 4, 8, 16, 30]  # seconds
    },
    "MARKET_INDICES": {
        "PRIMARY": ["SPY", "QQQ", "DIA", "IWM", "VIX"],
        "INTERNATIONAL": ["EWJ", "EFA", "EEM", "FXI"],
        "SECTOR_ETFS": ["XLK", "XLF", "XLE", "XLV", "XLP"],
        "REFRESH_INTERVAL": 5  # seconds
    },
    "SENTIMENT_CONFIG": {
        "NEWS_SOURCES": ["reuters", "bloomberg", "cnbc", "marketwatch"],
        "SOCIAL_SOURCES": ["twitter", "reddit", "stocktwits"],
        "SENTIMENT_WEIGHTS": {
            "news": 0.6,
            "social": 0.3,
            "analyst": 0.1
        },
        "CACHE_TTL": 300,  # 5 minutes
        "CONFIDENCE_DECAY": 0.1  # per hour
    },
    "MARKET_BREADTH": {
        "UNIVERSE_SIZE": 3000,  # stocks to analyze
        "UPDATE_FREQUENCY": 60,  # seconds
        "CHANGE_THRESHOLD": 0.01,  # 1% for advancing/declining
        "NEW_HIGH_LOW_PERIOD": 52  # weeks
    },
    "PERFORMANCE_TARGETS": {
        "WEBSOCKET_LATENCY_MS": 100,
        "MARKET_OVERVIEW_MS": 500,
        "SENTIMENT_ANALYSIS_MS": 3000,
        "CONNECTION_SUCCESS_RATE": 0.999,
        "MESSAGE_DELIVERY_RATE": 0.995
    }
}
```