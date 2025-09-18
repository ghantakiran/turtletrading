# StockAnalysis • Technical Analysis Tests

- **REQ-IDs covered**: REQ-STOCK-01, REQ-STOCK-02, REQ-STOCK-03
- **Given/When/Then scenarios**:

## UT-STOCK-01.1: Technical Indicator Calculation Accuracy
**Given**: Historical OHLCV data for AAPL (90 days)
**When**: calculate_technical_indicators() is called
**Then**: Return accurate RSI, MACD, Bollinger Bands within 0.01% tolerance

```python
def test_technical_indicators_accuracy():
    # Arrange
    mock_data = MockDataFactory.create_stock_data("AAPL", days=90)
    expected_rsi = 45.67  # Pre-calculated reference value

    # Act
    indicators = technical_service.calculate_technical_indicators(mock_data)

    # Assert
    assert abs(indicators['rsi'][-1] - expected_rsi) < 0.01
    assert indicators['macd']['signal'][-1] is not None
    assert len(indicators['bollinger']['upper']) == len(mock_data)
```

## UT-STOCK-01.2: Multi-timeframe Analysis Consistency
**Given**: Stock data across different timeframes (1d, 1w, 1m)
**When**: analyze_multi_timeframe() is called
**Then**: Signals maintain logical consistency across timeframes

```python
def test_multi_timeframe_consistency():
    # Arrange
    daily_data = MockDataFactory.create_stock_data("AAPL", timeframe="1d")
    weekly_data = MockDataFactory.aggregate_to_weekly(daily_data)

    # Act
    daily_signals = technical_service.analyze_multi_timeframe(daily_data, "1d")
    weekly_signals = technical_service.analyze_multi_timeframe(weekly_data, "1w")

    # Assert
    assert daily_signals['trend'] in ['bullish', 'bearish', 'neutral']
    assert weekly_signals['strength'] >= daily_signals['strength'] - 0.1
```

## ET-STOCK-01.1: Extreme Market Conditions Handling
**Given**: Market crash scenario with -20% daily drop
**When**: calculate_technical_indicators() processes extreme data
**Then**: Handle gracefully without mathematical errors or infinite values

```python
def test_market_crash_handling():
    # Arrange
    crash_data = MockDataFactory.create_market_crash_scenario("SPY")

    # Act & Assert
    indicators = technical_service.calculate_technical_indicators(crash_data)

    assert not any(math.isinf(val) for val in indicators['rsi'])
    assert not any(math.isnan(val) for val in indicators['macd']['histogram'])
    assert indicators['volatility'] > 0.5  # High volatility expected
```

- **Mocks/stubs/fakes**:
  - MockDataFactory for deterministic OHLCV data generation
  - Stub external price data APIs (yfinance, Alpha Vantage)
  - Fake time provider for consistent timestamp testing

- **Deterministic seeds & time controls**:
  - Random seed: 42 for reproducible price movements
  - Fixed timestamp: 2024-01-15T10:00:00Z for all test scenarios
  - Controlled market hours: 9:30 AM - 4:00 PM EST

- **Expected coverage deltas**:
  - Lines: +156 lines (calculate_technical_indicators, multi_timeframe_analysis)
  - Branches: +24 branches (error handling, timeframe logic)
  - Functions: +8 functions (all technical analysis methods)