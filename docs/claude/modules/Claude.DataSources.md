# Claude.DataSources

- **Purpose**: Provide reliable multi-source data integration with fallback mechanisms for market data, news, and external API management
- **Scope (in/out)**:
  - **In**: yfinance integration, Alpha Vantage fallback, NewsAPI, external API rate limiting, data source health monitoring, API response caching
  - **Out**: Data processing/analysis (handled by StockAnalysis/MarketData), user management (handled by Authentication), UI presentation (handled by UserInterface)
- **Public API (signatures, inputs/outputs, errors)**:
  - `DataSourceManager.get_price_data(symbol) → StockPrice | None`
  - `DataSourceManager.get_historical_data(symbol, period) → DataFrame | None`
  - `AlphaVantageService.get_quote(symbol) → StockPrice | APIError`
  - `RateLimiter.check_limit(api_name, key) → boolean`
  - `HealthMonitor.check_source_health(source) → HealthStatus`
- **Data contracts (schemas, invariants)**:
  - StockPrice: symbol(str), current_price(float>0), volume(int≥0), market_cap(int≥0), timestamp(datetime)
  - APIResponse: status_code(int), data(dict), headers(dict), response_time_ms(int>0), source(str)
  - HealthStatus: source(str), is_healthy(boolean), last_check(datetime), error_count(int≥0), uptime_percentage(0≤float≤100)
  - RateLimit: api_name(str), requests_made(int≥0), limit(int>0), reset_time(datetime)
- **Dependencies (internal/external)**:
  - **Internal**: Infrastructure (Redis for rate limiting and caching), StockAnalysis (price data consumer), MarketData (real-time updates)
  - **External**: yfinance, alpha-vantage, newsapi-python, requests, aiohttp, pandas
- **State & concurrency model**: Stateless data fetching with Redis-based rate limiting, concurrent API calls with asyncio, connection pooling for HTTP clients
- **Failure modes & retries**: Primary API failure → secondary API → cached data → error response; 3 retries with exponential backoff for network errors
- **Performance/SLOs**: <500ms for price data, <1s for historical data, <2s for news data, 99% API success rate, <10ms rate limit checks
- **Security/permissions**: API key management via environment variables, request signing where required, no sensitive data logged, IP-based rate limiting
- **Observability (logs/metrics/traces)**: API response times, success/failure rates, rate limit usage, cache hit ratios, data source health metrics
- **Change risks & migration notes**: API provider changes require adapter updates; rate limit changes need configuration updates; new data sources need health monitoring integration

## TDD: Requirements → Tests

### REQ-DATA-01: Multi-source data fetching with automatic fallback chains
- **Unit tests**:
  - UT-DATA-01.1: Given yfinance available When get_price_data("AAPL") Then return StockPrice from primary source
  - UT-DATA-01.2: Given yfinance timeout When get_price_data("AAPL") Then fallback to Alpha Vantage successfully
  - UT-DATA-01.3: Given all sources fail When get_price_data("AAPL") Then return cached data or None
- **Edge/negative/property tests**:
  - ET-DATA-01.1: Given malformed API response When parse_response() Then handle gracefully and try next source
  - ET-DATA-01.2: Given network partition When fetch_data() Then timeout appropriately and fallback
  - PT-DATA-01.1: Property: fallback chain always preserves data contract, response time increases with fallback depth
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock yfinance with controllable timeout/success scenarios
  - Stub Alpha Vantage API with rate limiting simulation
  - Fake network conditions for fallback testing
- **Coverage mapping**:
  - Lines/branches/functions covered: DataSourceManager, get_price_data(), fallback_chain(), parse_response()

### REQ-DATA-02: Rate limiting with distributed Redis-based tracking
- **Unit tests**:
  - UT-DATA-02.1: Given API rate limit When check_limit() Then return False and prevent API call
  - UT-DATA-02.2: Given limit reset time passed When check_limit() Then reset counter and allow requests
  - UT-DATA-02.3: Given concurrent requests When rate_limit() Then prevent race conditions with atomic operations
- **Edge/negative/property tests**:
  - ET-DATA-02.1: Given Redis connection failure When check_limit() Then fail-open and allow requests with warning
  - ET-DATA-02.2: Given clock skew When rate_limit_reset() Then handle gracefully with tolerance
  - PT-DATA-02.1: Property: rate limit never exceeded, requests distributed evenly over time window
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Redis with controllable connection failures
  - Stub time provider for deterministic rate limit testing
  - Fake concurrent request scenarios
- **Coverage mapping**:
  - Lines/branches/functions covered: RateLimiter, check_limit(), reset_limit(), atomic_increment()

### REQ-DATA-03: Health monitoring with automatic source degradation
- **Unit tests**:
  - UT-DATA-03.1: Given healthy data source When monitor_health() Then update status and maintain availability
  - UT-DATA-03.2: Given failing data source When monitor_health() Then mark unhealthy and trigger alerts
  - UT-DATA-03.3: Given recovered data source When health_check() Then restore to healthy status
- **Edge/negative/property tests**:
  - ET-DATA-03.1: Given intermittent failures When calculate_uptime() Then use sliding window average
  - ET-DATA-03.2: Given false positive health check When validate_health() Then require sustained recovery
  - PT-DATA-03.1: Property: 0 ≤ uptime_percentage ≤ 100, health status reflects recent performance
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock health check endpoints with controllable responses
  - Stub metrics collection with deterministic failure patterns
  - Fake time series data for uptime calculation
- **Coverage mapping**:
  - Lines/branches/functions covered: HealthMonitor, check_health(), calculate_uptime(), trigger_alerts()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-DATA-01 | UT-DATA-01.1-3 | ET-DATA-01.1-2 | PT-DATA-01.1 | IT-DATA-01 |
| REQ-DATA-02 | UT-DATA-02.1-3 | ET-DATA-02.1-2 | PT-DATA-02.1 | IT-DATA-02 |
| REQ-DATA-03 | UT-DATA-03.1-3 | ET-DATA-03.1-2 | PT-DATA-03.1 | IT-DATA-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Data Fetching**: validate_symbol() → check_cache() → try_primary_source() → try_fallback() → cache_result() → return_data()
2. **Rate Limiting**: get_current_usage() → check_against_limit() → allow_or_deny() → increment_counter() → schedule_reset()
3. **Health Monitoring**: periodic_health_check() → collect_metrics() → calculate_status() → update_availability() → alert_if_needed()

### Pseudocode (reference)
```python
async def get_price_data(symbol: str) -> Optional[StockPrice]:
    # Check cache first
    cache_key = f"price:{symbol}"
    cached = await redis.get(cache_key)
    if cached and not is_stale(cached):
        return StockPrice.parse_raw(cached)

    # Try primary source (yfinance)
    if await rate_limiter.check_limit("yfinance", symbol):
        try:
            data = await yfinance_client.get_quote(symbol)
            if data:
                await cache_result(cache_key, data, ttl=60)
                return data
        except Exception as e:
            logger.warning(f"yfinance failed for {symbol}: {e}")

    # Fallback to Alpha Vantage
    if await rate_limiter.check_limit("alpha_vantage", symbol):
        try:
            data = await alpha_vantage_client.get_quote(symbol)
            if data:
                await cache_result(cache_key, data, ttl=300)
                return data
        except Exception as e:
            logger.error(f"Alpha Vantage failed for {symbol}: {e}")

    # Return stale cache or None
    if cached:
        logger.info(f"Returning stale data for {symbol}")
        return StockPrice.parse_raw(cached)

    return None
```

### Error Handling & Retries
- **Network timeouts**: 30s timeout with 3 retries, exponential backoff (1s, 2s, 4s)
- **API rate limits**: Respect limits, queue requests, circuit breaker after sustained failures
- **Invalid responses**: Skip malformed data, log for debugging, continue with fallback
- **Cache failures**: Graceful degradation to direct API calls, alert operations team

### Config/flags
```python
DATA_SOURCES_CONFIG = {
    "YFINANCE_TIMEOUT": 30,
    "ALPHA_VANTAGE_TIMEOUT": 30,
    "NEWSAPI_TIMEOUT": 15,
    "MAX_RETRIES": 3,
    "RETRY_BACKOFF_FACTOR": 2,
    "HEALTH_CHECK_INTERVAL": 300,  # 5 minutes
    "RATE_LIMITS": {
        "yfinance": {"requests": 1000, "window": 3600},
        "alpha_vantage": {"requests": 500, "window": 3600},
        "newsapi": {"requests": 1000, "window": 3600}
    },
    "CACHE_TTLS": {
        "price_data": 60,
        "historical_data": 300,
        "news_data": 900
    }
}
```