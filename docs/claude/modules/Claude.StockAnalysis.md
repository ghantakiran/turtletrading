# Claude.StockAnalysis

- **Purpose**: Provide comprehensive stock data analysis through LSTM neural network predictions, 15+ technical indicators, risk assessment, and multi-factor scoring algorithms for intelligent trading recommendations
- **Scope (in/out)**:
  - **In**: LSTM model training and inference, technical indicator calculations (RSI, MACD, Bollinger Bands, etc.), risk analysis, weighted scoring, seasonality analysis, batch processing
  - **Out**: Raw market data fetching (handled by DataSources), user interface rendering (handled by UserInterface), real-time data streaming (handled by MarketData)
- **Public API (signatures, inputs/outputs, errors)**:
  - `StockService.get_current_price(symbol) → StockPrice | None`
  - `StockService.get_technical_indicators(symbol, period) → TechnicalIndicators | None`
  - `StockService.get_lstm_prediction(symbol, horizon_days) → LSTMPrediction | None`
  - `StockService.get_comprehensive_analysis(symbol, period) → AnalysisResult | None`
  - `StockService.batch_analyze(symbols) → Dict[str, AnalysisResult]`
- **Data contracts (schemas, invariants)**:
  - StockPrice: symbol(str), current_price(float>0), volume(int≥0), market_cap(int≥0), change_percent(float), timestamp(datetime)
  - TechnicalIndicators: rsi(0≤float≤100), macd(dict), bollinger_bands(dict), technical_score(0≤float≤1), recommendation('BUY'|'SELL'|'HOLD')
  - LSTMPrediction: predictions(Array[float]), confidence_intervals(dict), horizon_days(int>0), model_accuracy(0≤float≤1)
  - AnalysisResult: technical_score(float), lstm_score(float), sentiment_score(float), final_score(float), recommendation(str)
- **Dependencies (internal/external)**:
  - **Internal**: DataSources (market data), Infrastructure (caching), Authentication (user context)
  - **External**: yfinance, ta, TA-Lib, pandas, numpy, tensorflow, scikit-learn, redis
- **State & concurrency model**: Stateless analysis service with Redis caching, ThreadPoolExecutor for concurrent I/O operations, async LSTM model inference
- **Failure modes & retries**: Data source failures handled by DataSources fallback, model failures return confidence=0, cache failures degrade gracefully to direct computation
- **Performance/SLOs**: <500ms technical analysis, <2s LSTM prediction, <100ms cached results, 95% success rate for valid symbols
- **Security/permissions**: No sensitive data stored, user-tier based features (Pro gets advanced indicators), input validation for all symbols
- **Observability (logs/metrics/traces)**: Analysis duration, cache hit ratios, model performance metrics, error rates by symbol, prediction accuracy tracking
- **Change risks & migration notes**: LSTM model updates require retraining pipeline, new indicators need weight calibration, cache schema changes need migration

## TDD: Requirements → Tests

### REQ-STOCK-01: Technical indicator calculations with 15+ indicators and weighted scoring
- **Unit tests**:
  - UT-STOCK-01.1: Given AAPL historical data When calculate_rsi() Then return RSI between 0-100 with proper overbought/oversold signals
  - UT-STOCK-01.2: Given NVDA price data When calculate_macd() Then return MACD line, signal line, and histogram with buy/sell crossovers
  - UT-STOCK-01.3: Given TSLA data When calculate_bollinger_bands() Then return upper, middle, lower bands with price position indicators
- **Edge/negative/property tests**:
  - ET-STOCK-01.1: Given insufficient data (< 20 periods) When calculate_indicators() Then handle gracefully and return partial results
  - ET-STOCK-01.2: Given extreme price movements (circuit breakers) When technical_analysis() Then maintain mathematical stability
  - PT-STOCK-01.1: Property: RSI values always between 0-100, MACD crossovers generate consistent signals, indicator weights sum to 1.0
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock yfinance with controllable price data scenarios
  - Stub TA-Lib with known indicator outputs for validation
  - Fake market conditions (bull/bear/sideways) for scoring tests
- **Coverage mapping**:
  - Lines/branches/functions covered: calculate_all_indicators(), weighted_technical_score(), get_recommendation(), validate_symbol()

### REQ-STOCK-02: LSTM neural network predictions with confidence intervals and model performance tracking
- **Unit tests**:
  - UT-STOCK-02.1: Given trained LSTM model When predict_price(symbol, 5_days) Then return predictions with 80% and 95% confidence intervals
  - UT-STOCK-02.2: Given 90-day lookback window When prepare_lstm_features() Then create feature matrix with price + 15 technical indicators
  - UT-STOCK-02.3: Given model predictions When calculate_directional_accuracy() Then track prediction vs actual direction success rate
- **Edge/negative/property tests**:
  - ET-STOCK-02.1: Given model loading failure When lstm_predict() Then fallback to trend analysis and return confidence=0
  - ET-STOCK-02.2: Given market volatility spike When model_inference() Then adjust confidence intervals dynamically
  - PT-STOCK-02.1: Property: prediction confidence inversely correlates with market volatility, longer horizons have lower confidence
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock TensorFlow model with deterministic prediction outputs
  - Stub feature engineering with known technical indicator values
  - Fake GPU availability for CPU-only testing environments
- **Coverage mapping**:
  - Lines/branches/functions covered: lstm_predict(), prepare_features(), calculate_confidence(), track_performance()

### REQ-STOCK-03: Multi-factor analysis combining LSTM, technical, sentiment, and seasonality scores
- **Unit tests**:
  - UT-STOCK-03.1: Given all analysis components When generate_final_score() Then combine 50% LSTM + 30% technical + 10% sentiment + 10% seasonality
  - UT-STOCK-03.2: Given conflicting signals (bullish technical, bearish LSTM) When resolve_conflicts() Then weight by confidence levels
  - UT-STOCK-03.3: Given seasonal patterns When apply_seasonality_boost() Then enhance scores during historically strong periods
- **Edge/negative/property tests**:
  - ET-STOCK-03.1: Given missing sentiment data When calculate_final_score() Then adjust weights proportionally (technical + LSTM = 100%)
  - ET-STOCK-03.2: Given extreme market conditions When multi_factor_analysis() Then prevent score amplification beyond reasonable bounds
  - PT-STOCK-03.1: Property: final score bounded 0-1, recommendation consistency with score ranges, all factors contribute meaningfully
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock sentiment service with controllable sentiment scores
  - Stub seasonality data with known historical patterns
  - Fake market conditions for comprehensive scoring scenarios
- **Coverage mapping**:
  - Lines/branches/functions covered: generate_final_score(), resolve_signal_conflicts(), apply_seasonality(), get_recommendation()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-STOCK-01 | UT-STOCK-01.1-3 | ET-STOCK-01.1-2 | PT-STOCK-01.1 | IT-STOCK-01 |
| REQ-STOCK-02 | UT-STOCK-02.1-3 | ET-STOCK-02.1-2 | PT-STOCK-02.1 | IT-STOCK-02 |
| REQ-STOCK-03 | UT-STOCK-03.1-3 | ET-STOCK-03.1-2 | PT-STOCK-03.1 | IT-STOCK-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Technical Analysis**: fetch_data() → calculate_indicators() → apply_weights() → generate_score() → cache_results()
2. **LSTM Prediction**: prepare_features() → load_model() → predict() → calculate_confidence() → format_output()
3. **Multi-factor Analysis**: gather_all_scores() → resolve_conflicts() → apply_seasonality() → final_recommendation()

### Pseudocode (reference)
```python
async def get_comprehensive_analysis(symbol: str, period: str = "1y") -> Optional[AnalysisResult]:
    # Validate input
    if not validate_symbol(symbol):
        return None

    # Check cache first
    cache_key = f"analysis:{symbol}:{period}"
    cached = await redis.get(cache_key)
    if cached:
        return AnalysisResult.parse_raw(cached)

    # Fetch base data
    price_data = await data_sources.get_price_history(symbol, period)
    if not price_data:
        return None

    # Run analysis components concurrently
    technical_task = asyncio.create_task(calculate_technical_score(price_data))
    lstm_task = asyncio.create_task(get_lstm_prediction(symbol, horizon=5))
    sentiment_task = asyncio.create_task(get_sentiment_score(symbol))

    # Wait for all components
    technical_score = await technical_task
    lstm_score = await lstm_task
    sentiment_score = await sentiment_task

    # Apply seasonality
    seasonality_boost = calculate_seasonality_factor(symbol, datetime.now())

    # Generate final score (50% LSTM + 30% technical + 10% sentiment + 10% seasonality)
    final_score = (
        0.5 * lstm_score.confidence * lstm_score.direction +
        0.3 * technical_score +
        0.1 * sentiment_score +
        0.1 * seasonality_boost
    )

    # Generate recommendation
    recommendation = get_recommendation(final_score, confidence=min(lstm_score.confidence, 0.8))

    result = AnalysisResult(
        symbol=symbol,
        technical_score=technical_score,
        lstm_score=lstm_score.confidence,
        sentiment_score=sentiment_score,
        final_score=final_score,
        recommendation=recommendation,
        timestamp=datetime.utcnow()
    )

    # Cache result
    await redis.setex(cache_key, 300, result.json())  # 5-minute cache

    return result
```

### Error Handling & Retries
- **Data fetch failures**: Automatic fallback through DataSources module, degrade gracefully with partial analysis
- **Model inference errors**: Return confidence=0, fallback to pure technical analysis, log for model retraining
- **Calculation errors**: Skip problematic indicators, adjust weights, continue with available data
- **Cache failures**: Continue with direct computation, log cache issues for infrastructure team

### Config/flags
```python
STOCK_ANALYSIS_CONFIG = {
    "TECHNICAL_WEIGHTS": {
        "RSI": 0.12, "MACD": 0.16, "EMA20": 0.12, "SMA50": 0.10, "SMA200": 0.10,
        "Stochastic": 0.10, "Bollinger": 0.10, "ADX": 0.12, "OBV": 0.08
    },
    "LSTM_CONFIG": {
        "LOOKBACK_WINDOW": 90,
        "PREDICTION_HORIZON": [1, 5, 10, 30],
        "MODEL_PATH": "/models/lstm_v2.h5",
        "FEATURE_COUNT": 20,  # Price + volume + 18 technical indicators
        "CONFIDENCE_THRESHOLD": 0.6
    },
    "SCORING_WEIGHTS": {
        "LSTM_WEIGHT": 0.5,
        "TECHNICAL_WEIGHT": 0.3,
        "SENTIMENT_WEIGHT": 0.1,
        "SEASONALITY_WEIGHT": 0.1
    },
    "CACHE_TTL": {
        "TECHNICAL_ANALYSIS": 300,  # 5 minutes
        "LSTM_PREDICTION": 1800,    # 30 minutes
        "COMPREHENSIVE_ANALYSIS": 300  # 5 minutes
    },
    "PERFORMANCE_TARGETS": {
        "TECHNICAL_ANALYSIS_MS": 500,
        "LSTM_PREDICTION_MS": 2000,
        "CACHE_HIT_RATIO": 0.8,
        "SUCCESS_RATE": 0.95
    }
}
```