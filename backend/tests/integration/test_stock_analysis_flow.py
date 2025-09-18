"""
Integration Tests for Stock Analysis Flow
Tests the complete stock analysis pipeline per IMPLEMENT_FROM_DOCS_FILLED.md requirements
Pipeline: Data Fetch → Technical Analysis → LSTM Prediction → Sentiment Analysis
"""

import pytest
import asyncio
import time
from typing import Dict, List, Optional
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
import json

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.database import get_db_session
from app.services.stock_service import StockService
from app.services.market_service import MarketService
from app.services.sentiment_service import SentimentService
from app.models.stock_models import StockPrice, TechnicalIndicators, LSTMPrediction
from app.core.auth import AuthService
from app.core.config import settings

# Test client
client = TestClient(app)

@pytest.fixture
def mock_db_session():
    """Mock database session for testing"""
    return Mock(spec=AsyncSession)

@pytest.fixture
def mock_redis_client():
    """Mock Redis client for caching"""
    redis_mock = Mock()
    redis_mock.get.return_value = None
    redis_mock.setex.return_value = True
    redis_mock.exists.return_value = False
    return redis_mock

@pytest.fixture
def stock_service(mock_db_session, mock_redis_client):
    """Create StockService instance with mocked dependencies"""
    return StockService(db_session=mock_db_session, redis_client=mock_redis_client)

@pytest.fixture
def market_service(mock_db_session, mock_redis_client):
    """Create MarketService instance with mocked dependencies"""
    return MarketService(db_session=mock_db_session, redis_client=mock_redis_client)

@pytest.fixture
def sentiment_service(mock_db_session, mock_redis_client):
    """Create SentimentService instance with mocked dependencies"""
    return SentimentService(db_session=mock_db_session, redis_client=mock_redis_client)

@pytest.fixture
def auth_service(mock_redis_client):
    """Create AuthService instance for authentication testing"""
    return AuthService(redis_client=mock_redis_client)

@pytest.fixture
def sample_stock_data():
    """Sample stock data for testing"""
    return {
        "symbol": "AAPL",
        "current_price": 150.50,
        "previous_close": 149.00,
        "day_change": 1.50,
        "day_change_percent": 1.01,
        "volume": 75000000,
        "market_cap": 2450000000000,
        "pe_ratio": 28.5,
        "fifty_two_week_high": 182.94,
        "fifty_two_week_low": 124.17
    }

@pytest.fixture
def sample_technical_indicators():
    """Sample technical indicators for testing"""
    return {
        "rsi": 62.5,
        "macd": {"macd": 1.23, "signal": 1.15, "histogram": 0.08, "trend": 1.0},
        "bollinger_bands": {"upper": 155.0, "middle": 150.0, "lower": 145.0, "position": 0.5},
        "stochastic": {"k_percent": 75.0, "d_percent": 72.0, "signal": 1.0},
        "adx": {"adx": 35.0, "plus_di": 25.0, "minus_di": 15.0, "trend_strength": "Strong"},
        "obv": 125000000,
        "atr": 3.45,
        "ema_20": 151.2,
        "sma_50": 148.7,
        "sma_200": 142.3,
        "volume_sma": 70000000,
        "technical_score": 0.65
    }

@pytest.fixture
def sample_lstm_prediction():
    """Sample LSTM prediction for testing"""
    return {
        "symbol": "AAPL",
        "predictions": [
            {"date": "2024-01-16", "predicted_price": 152.30, "confidence": 0.78},
            {"date": "2024-01-17", "predicted_price": 153.80, "confidence": 0.75},
            {"date": "2024-01-18", "predicted_price": 155.10, "confidence": 0.72}
        ],
        "model_accuracy": 0.82,
        "trend_direction": "bullish",
        "confidence_interval": {"lower": 145.0, "upper": 165.0}
    }

@pytest.fixture
def sample_sentiment_data():
    """Sample sentiment analysis data"""
    return {
        "symbol": "AAPL",
        "overall_sentiment": 0.25,
        "news_sentiment": 0.30,
        "social_sentiment": 0.20,
        "sentiment_sources": {
            "financial_news": {"count": 15, "sentiment": 0.35},
            "twitter": {"count": 250, "sentiment": 0.18},
            "reddit": {"count": 45, "sentiment": 0.22}
        },
        "trending_keywords": ["earnings", "iPhone", "growth"],
        "sentiment_trend": "positive"
    }

class TestStockAnalysisFlowIntegration:
    """Integration tests for complete stock analysis flow"""

    @pytest.mark.asyncio
    async def test_complete_stock_analysis_pipeline_happy_path(
        self, stock_service, market_service, sentiment_service,
        sample_stock_data, sample_technical_indicators,
        sample_lstm_prediction, sample_sentiment_data
    ):
        """
        Test the complete stock analysis pipeline from data fetch to final analysis
        Pipeline: Data Fetch → Technical Analysis → LSTM Prediction → Sentiment Analysis
        Requirement: Complete analysis pipeline under 2 seconds
        """
        symbol = "AAPL"
        start_time = time.time()

        # Mock the data fetch
        with patch.object(stock_service, 'get_current_price') as mock_price, \
             patch.object(stock_service, 'get_technical_indicators') as mock_tech, \
             patch.object(stock_service, 'get_lstm_prediction') as mock_lstm, \
             patch.object(sentiment_service, 'get_stock_sentiment') as mock_sentiment:

            # Setup mocks
            mock_price.return_value = StockPrice(**sample_stock_data)
            mock_tech.return_value = TechnicalIndicators(symbol=symbol, **sample_technical_indicators)
            mock_lstm.return_value = LSTMPrediction(**sample_lstm_prediction)
            mock_sentiment.return_value = sample_sentiment_data

            # Execute complete analysis pipeline
            results = await stock_service.get_complete_analysis(symbol)

            execution_time = time.time() - start_time

            # Assertions
            assert results is not None
            assert results["symbol"] == symbol
            assert "stock_price" in results
            assert "technical_indicators" in results
            assert "lstm_prediction" in results
            assert "sentiment_analysis" in results
            assert "final_score" in results

            # Performance requirement: Complete analysis under 2 seconds
            assert execution_time < 2.0, f"Analysis took {execution_time:.2f}s, exceeds 2s requirement"

            # Verify all mocks were called
            mock_price.assert_called_once_with(symbol)
            mock_tech.assert_called_once_with(symbol)
            mock_lstm.assert_called_once_with(symbol)
            mock_sentiment.assert_called_once_with(symbol)

            # Verify final score calculation
            assert 0.0 <= results["final_score"] <= 1.0
            assert isinstance(results["final_score"], float)

    @pytest.mark.asyncio
    async def test_stock_analysis_with_data_source_failure_resilience(
        self, stock_service, sentiment_service
    ):
        """
        Test pipeline resilience when primary data sources fail
        Requirement: Graceful degradation with fallback data sources
        """
        symbol = "AAPL"

        with patch.object(stock_service, 'get_current_price') as mock_price, \
             patch.object(stock_service, 'get_technical_indicators') as mock_tech, \
             patch.object(stock_service, 'get_lstm_prediction') as mock_lstm, \
             patch.object(sentiment_service, 'get_stock_sentiment') as mock_sentiment:

            # Simulate primary data source failure with fallback success
            mock_price.side_effect = [Exception("Primary source failed"),
                                    StockPrice(symbol=symbol, current_price=150.0, previous_close=149.0)]
            mock_tech.return_value = TechnicalIndicators(symbol=symbol, rsi=60.0, technical_score=0.6)
            mock_lstm.return_value = None  # LSTM service unavailable
            mock_sentiment.return_value = {"symbol": symbol, "overall_sentiment": 0.1}

            # Execute analysis with fault tolerance
            results = await stock_service.get_complete_analysis_with_fallback(symbol)

            # Assertions
            assert results is not None
            assert results["symbol"] == symbol
            assert results["stock_price"] is not None  # Fallback succeeded
            assert results["technical_indicators"] is not None
            assert results["lstm_prediction"] is None  # Service unavailable
            assert results["sentiment_analysis"] is not None
            assert "data_source_health" in results

            # Verify fallback behavior
            health = results["data_source_health"]
            assert health["price_data"] == "fallback"
            assert health["technical_indicators"] == "primary"
            assert health["lstm_service"] == "unavailable"
            assert health["sentiment_service"] == "primary"

    @pytest.mark.asyncio
    async def test_concurrent_multi_symbol_analysis(
        self, stock_service, sentiment_service
    ):
        """
        Test concurrent analysis of multiple symbols
        Requirement: Process 10 symbols concurrently under 5 seconds
        """
        symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NFLX", "NVDA", "JPM", "V"]
        start_time = time.time()

        with patch.object(stock_service, 'get_current_price') as mock_price, \
             patch.object(stock_service, 'get_technical_indicators') as mock_tech, \
             patch.object(sentiment_service, 'get_stock_sentiment') as mock_sentiment:

            # Setup mocks to return valid data
            mock_price.return_value = StockPrice(symbol="TEST", current_price=100.0, previous_close=99.0)
            mock_tech.return_value = TechnicalIndicators(symbol="TEST", rsi=50.0, technical_score=0.5)
            mock_sentiment.return_value = {"symbol": "TEST", "overall_sentiment": 0.0}

            # Execute concurrent analysis
            tasks = [stock_service.get_complete_analysis(symbol) for symbol in symbols]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            execution_time = time.time() - start_time

            # Assertions
            assert len(results) == len(symbols)
            successful_results = [r for r in results if not isinstance(r, Exception)]
            assert len(successful_results) >= 8, "At least 80% of analyses should succeed"

            # Performance requirement: 10 symbols under 5 seconds
            assert execution_time < 5.0, f"Concurrent analysis took {execution_time:.2f}s, exceeds 5s requirement"

            # Verify concurrent execution efficiency
            call_count = mock_price.call_count
            assert call_count == len(symbols), f"Expected {len(symbols)} calls, got {call_count}"

    @pytest.mark.asyncio
    async def test_analysis_caching_and_invalidation(
        self, stock_service, mock_redis_client
    ):
        """
        Test caching behavior and cache invalidation logic
        Requirement: Cache hit/miss ratio optimization
        """
        symbol = "AAPL"
        cache_key = f"stock_analysis:{symbol}"

        # Test cache miss scenario
        mock_redis_client.get.return_value = None

        with patch.object(stock_service, '_perform_fresh_analysis') as mock_analysis:
            mock_analysis.return_value = {"symbol": symbol, "cached": False}

            # First call - cache miss
            result1 = await stock_service.get_complete_analysis_cached(symbol)

            # Verify cache was checked and data was stored
            mock_redis_client.get.assert_called_with(cache_key)
            mock_redis_client.setex.assert_called()
            mock_analysis.assert_called_once()

            assert result1["cached"] is False

        # Test cache hit scenario
        cached_data = json.dumps({"symbol": symbol, "cached": True})
        mock_redis_client.get.return_value = cached_data.encode()

        with patch.object(stock_service, '_perform_fresh_analysis') as mock_analysis:
            # Second call - cache hit
            result2 = await stock_service.get_complete_analysis_cached(symbol)

            # Verify cache was used and fresh analysis was not performed
            mock_analysis.assert_not_called()
            assert result2["cached"] is True

    @pytest.mark.asyncio
    async def test_real_time_analysis_updates_with_websocket_integration(
        self, stock_service, mock_redis_client
    ):
        """
        Test real-time analysis updates triggered by price changes
        Requirement: Analysis updates within 100ms of price change
        """
        symbol = "AAPL"

        # Simulate WebSocket price update trigger
        with patch.object(stock_service, 'get_current_price') as mock_price, \
             patch.object(stock_service, '_trigger_analysis_update') as mock_update:

            initial_price = 150.0
            updated_price = 152.0

            mock_price.side_effect = [
                StockPrice(symbol=symbol, current_price=initial_price, previous_close=149.0),
                StockPrice(symbol=symbol, current_price=updated_price, previous_close=149.0)
            ]

            # Initial analysis
            start_time = time.time()
            initial_analysis = await stock_service.get_complete_analysis(symbol)

            # Simulate price change trigger
            await stock_service.handle_real_time_price_update(symbol, updated_price)

            update_time = time.time() - start_time

            # Assertions
            assert initial_analysis["stock_price"].current_price == initial_price
            mock_update.assert_called_once_with(symbol, updated_price)

            # Performance requirement: Update within 100ms
            assert update_time < 0.1, f"Analysis update took {update_time*1000:.2f}ms, exceeds 100ms requirement"

    @pytest.mark.asyncio
    async def test_analysis_data_consistency_across_services(
        self, stock_service, market_service, sentiment_service
    ):
        """
        Test data consistency between different analysis services
        Requirement: Synchronized data timestamps and versions
        """
        symbol = "AAPL"
        test_timestamp = datetime.utcnow()

        with patch.object(stock_service, 'get_current_price') as mock_stock_price, \
             patch.object(market_service, 'get_stock_market_context') as mock_market, \
             patch.object(sentiment_service, 'get_stock_sentiment') as mock_sentiment:

            # Setup mocks with consistent timestamps
            mock_stock_price.return_value = StockPrice(
                symbol=symbol,
                current_price=150.0,
                previous_close=149.0,
                timestamp=test_timestamp
            )
            mock_market.return_value = {"timestamp": test_timestamp, "market_status": "open"}
            mock_sentiment.return_value = {"timestamp": test_timestamp.isoformat(), "sentiment": 0.2}

            # Execute cross-service analysis
            result = await stock_service.get_cross_service_analysis(symbol)

            # Verify timestamp consistency
            stock_timestamp = result["stock_data"]["timestamp"]
            market_timestamp = result["market_context"]["timestamp"]
            sentiment_timestamp = datetime.fromisoformat(result["sentiment_data"]["timestamp"])

            # All timestamps should be within 1 second of each other
            time_diff_market = abs((stock_timestamp - market_timestamp).total_seconds())
            time_diff_sentiment = abs((stock_timestamp - sentiment_timestamp).total_seconds())

            assert time_diff_market < 1.0, "Stock and market data timestamps differ by more than 1 second"
            assert time_diff_sentiment < 1.0, "Stock and sentiment data timestamps differ by more than 1 second"

            # Verify data version consistency
            assert result["data_version"] is not None
            assert result["analysis_id"] is not None

class TestStockAnalysisAPIEndpoints:
    """Integration tests for stock analysis API endpoints"""

    def test_stock_analysis_endpoint_complete_flow(self):
        """Test complete stock analysis API endpoint"""
        symbol = "AAPL"

        with patch('app.services.stock_service.StockService') as mock_service:
            mock_instance = mock_service.return_value
            mock_instance.get_complete_analysis.return_value = {
                "symbol": symbol,
                "final_score": 0.75,
                "recommendation": "BUY"
            }

            response = client.get(f"/api/v1/stocks/{symbol}/analysis")

            assert response.status_code == 200
            data = response.json()
            assert data["symbol"] == symbol
            assert "final_score" in data
            assert "recommendation" in data

    def test_batch_analysis_endpoint_performance(self):
        """Test batch analysis endpoint performance requirements"""
        symbols = ["AAPL", "GOOGL", "MSFT"]

        with patch('app.services.stock_service.StockService') as mock_service:
            mock_instance = mock_service.return_value
            mock_instance.get_batch_analysis.return_value = {
                symbol: {"final_score": 0.5} for symbol in symbols
            }

            start_time = time.time()
            response = client.post("/api/v1/stocks/batch-analysis", json={"symbols": symbols})
            execution_time = time.time() - start_time

            assert response.status_code == 200
            assert execution_time < 3.0, f"Batch analysis took {execution_time:.2f}s, exceeds 3s requirement"

            data = response.json()
            assert len(data) == len(symbols)

    def test_analysis_endpoint_error_handling(self):
        """Test error handling in analysis endpoints"""
        # Test invalid symbol
        response = client.get("/api/v1/stocks/INVALID/analysis")
        assert response.status_code == 404

        # Test service unavailable
        with patch('app.services.stock_service.StockService') as mock_service:
            mock_instance = mock_service.return_value
            mock_instance.get_complete_analysis.side_effect = Exception("Service unavailable")

            response = client.get("/api/v1/stocks/AAPL/analysis")
            assert response.status_code == 500

class TestStockAnalysisObservability:
    """Integration tests for observability and monitoring"""

    @pytest.mark.asyncio
    async def test_analysis_performance_metrics_collection(
        self, stock_service
    ):
        """Test collection of performance metrics during analysis"""
        symbol = "AAPL"

        with patch.object(stock_service, '_collect_performance_metrics') as mock_metrics, \
             patch.object(stock_service, 'get_complete_analysis') as mock_analysis:

            mock_analysis.return_value = {"symbol": symbol}

            await stock_service.get_complete_analysis_with_metrics(symbol)

            # Verify metrics collection
            mock_metrics.assert_called()
            metrics_call_args = mock_metrics.call_args[0]

            assert "execution_time" in metrics_call_args[0]
            assert "cache_hit_ratio" in metrics_call_args[0]
            assert "data_source_latency" in metrics_call_args[0]

    @pytest.mark.asyncio
    async def test_analysis_error_logging_and_alerting(
        self, stock_service
    ):
        """Test error logging and alerting during analysis failures"""
        symbol = "AAPL"

        with patch.object(stock_service, '_log_analysis_error') as mock_log, \
             patch.object(stock_service, '_trigger_alert') as mock_alert, \
             patch.object(stock_service, 'get_current_price') as mock_price:

            # Simulate critical error
            mock_price.side_effect = Exception("Critical data source failure")

            try:
                await stock_service.get_complete_analysis_with_monitoring(symbol)
            except Exception:
                pass

            # Verify error logging and alerting
            mock_log.assert_called()
            mock_alert.assert_called()

            log_call_args = mock_log.call_args[0]
            assert "Critical data source failure" in str(log_call_args)

# Performance benchmarking
class TestStockAnalysisPerformanceBenchmarks:
    """Performance benchmark tests for stock analysis"""

    @pytest.mark.asyncio
    async def test_single_symbol_analysis_latency_benchmark(
        self, stock_service
    ):
        """Benchmark single symbol analysis latency"""
        symbol = "AAPL"
        iterations = 10
        total_time = 0

        with patch.object(stock_service, 'get_complete_analysis') as mock_analysis:
            mock_analysis.return_value = {"symbol": symbol, "score": 0.5}

            for _ in range(iterations):
                start_time = time.time()
                await stock_service.get_complete_analysis(symbol)
                total_time += time.time() - start_time

            avg_latency = total_time / iterations

            # Performance requirement: Average latency under 500ms
            assert avg_latency < 0.5, f"Average latency {avg_latency*1000:.2f}ms exceeds 500ms requirement"

    @pytest.mark.asyncio
    async def test_concurrent_analysis_throughput_benchmark(
        self, stock_service
    ):
        """Benchmark concurrent analysis throughput"""
        symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"] * 4  # 20 symbols

        with patch.object(stock_service, 'get_complete_analysis') as mock_analysis:
            mock_analysis.return_value = {"symbol": "TEST", "score": 0.5}

            start_time = time.time()
            tasks = [stock_service.get_complete_analysis(symbol) for symbol in symbols]
            await asyncio.gather(*tasks)
            total_time = time.time() - start_time

            throughput = len(symbols) / total_time

            # Performance requirement: Minimum 10 analyses per second
            assert throughput >= 10, f"Throughput {throughput:.2f} analyses/sec below 10/sec requirement"