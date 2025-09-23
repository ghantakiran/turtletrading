"""
Unit tests for sentiment aggregation functionality.

Tests cover sentiment scoring, confidence weighting, trend analysis,
and time window management for sentiment data.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta
from typing import List

from app.services.sentiment_aggregation_service import (
    SentimentAggregator, TimeWindowManager, SentimentAggregationService
)
from app.models.sentiment_ner_models import (
    SentimentAggregation, SentimentScore, SentimentPolarity,
    ProcessedContent, NamedEntity, EntityType, ContentType,
    SentimentQueryRequest, SentimentQueryResponse
)


class TestSentimentAggregator:
    """Test suite for sentiment aggregation functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.aggregator = SentimentAggregator()

    def test_aggregate_sentiment_scores_equal_weighting(self):
        """Test sentiment aggregation with equal weighting."""
        scores = [
            SentimentScore(score=0.8, confidence=0.9, polarity=SentimentPolarity.POSITIVE),
            SentimentScore(score=0.6, confidence=0.8, polarity=SentimentPolarity.POSITIVE),
            SentimentScore(score=-0.4, confidence=0.7, polarity=SentimentPolarity.NEGATIVE),
            SentimentScore(score=0.2, confidence=0.6, polarity=SentimentPolarity.POSITIVE)
        ]

        result = self.aggregator.aggregate_sentiment_scores(scores, "equal")

        # Check basic aggregation
        expected_avg = (0.8 + 0.6 - 0.4 + 0.2) / 4  # 0.3
        assert abs(result["average_sentiment"] - expected_avg) < 0.001

        # Check confidence average
        expected_conf_avg = (0.9 + 0.8 + 0.7 + 0.6) / 4  # 0.75
        assert abs(result["confidence_average"] - expected_conf_avg) < 0.001

        # Check count
        assert result["total_count"] == 4

        # For equal weighting, weighted should equal average
        assert abs(result["weighted_sentiment"] - result["average_sentiment"]) < 0.001

    def test_aggregate_sentiment_scores_confidence_weighting(self):
        """Test sentiment aggregation with confidence weighting."""
        scores = [
            SentimentScore(score=0.8, confidence=0.9, polarity=SentimentPolarity.POSITIVE),  # High conf, positive
            SentimentScore(score=-0.6, confidence=0.2, polarity=SentimentPolarity.NEGATIVE), # Low conf, negative
            SentimentScore(score=0.4, confidence=0.8, polarity=SentimentPolarity.POSITIVE),  # High conf, positive
        ]

        result = self.aggregator.aggregate_sentiment_scores(scores, "confidence")

        # High confidence positive scores should dominate
        assert result["weighted_sentiment"] > result["average_sentiment"]
        assert result["weighted_sentiment"] > 0.4  # Should be more positive due to weighting

        # Check that weighting actually occurred
        total_weight = 0.9 + 0.2 + 0.8  # 1.9
        expected_weighted = (0.8 * 0.9 + (-0.6) * 0.2 + 0.4 * 0.8) / total_weight
        assert abs(result["weighted_sentiment"] - expected_weighted) < 0.001

    def test_aggregate_sentiment_scores_empty_list(self):
        """Test sentiment aggregation with empty score list."""
        result = self.aggregator.aggregate_sentiment_scores([])

        assert result["average_sentiment"] == 0.0
        assert result["weighted_sentiment"] == 0.0
        assert result["confidence_average"] == 0.0
        assert result["total_count"] == 0

    def test_aggregate_sentiment_scores_single_score(self):
        """Test sentiment aggregation with single score."""
        scores = [SentimentScore(score=0.7, confidence=0.8, polarity=SentimentPolarity.POSITIVE)]

        result = self.aggregator.aggregate_sentiment_scores(scores)

        assert result["average_sentiment"] == 0.7
        assert result["weighted_sentiment"] == 0.7
        assert result["confidence_average"] == 0.8
        assert result["total_count"] == 1
        assert result["sentiment_std"] == 0.0  # Single score has no variance

    def test_aggregate_sentiment_scores_zero_confidence(self):
        """Test sentiment aggregation with zero confidence scores."""
        scores = [
            SentimentScore(score=0.8, confidence=0.0, polarity=SentimentPolarity.POSITIVE),
            SentimentScore(score=0.6, confidence=0.0, polarity=SentimentPolarity.POSITIVE)
        ]

        result = self.aggregator.aggregate_sentiment_scores(scores, "confidence")

        # With zero total weight, should fall back to average
        expected_avg = (0.8 + 0.6) / 2
        assert abs(result["weighted_sentiment"] - expected_avg) < 0.001

    def test_calculate_sentiment_trend_upward(self):
        """Test trend calculation for upward sentiment trend."""
        # Create aggregations with increasing sentiment
        aggregations = []
        base_time = datetime.utcnow()

        for i in range(5):
            agg = SentimentAggregation(
                ticker="AAPL",
                start_time=base_time + timedelta(hours=i),
                end_time=base_time + timedelta(hours=i+1),
                window_size=timedelta(hours=1),
                weighted_sentiment=0.1 + (i * 0.2),  # Increasing: 0.1, 0.3, 0.5, 0.7, 0.9
                average_sentiment=0.1 + (i * 0.2),
                sentiment_trend=0.0,
                total_mentions=10,
                unique_sources=5,
                confidence_average=0.8,
                polarity_distribution={},
                data_quality_score=0.9,
                coverage_score=0.8,
                next_update=base_time + timedelta(hours=i+2)
            )
            aggregations.append(agg)

        trend = self.aggregator.calculate_sentiment_trend(aggregations)

        # Should detect positive trend
        assert trend > 0.1  # Strong positive trend

    def test_calculate_sentiment_trend_downward(self):
        """Test trend calculation for downward sentiment trend."""
        aggregations = []
        base_time = datetime.utcnow()

        for i in range(5):
            agg = SentimentAggregation(
                ticker="AAPL",
                start_time=base_time + timedelta(hours=i),
                end_time=base_time + timedelta(hours=i+1),
                window_size=timedelta(hours=1),
                weighted_sentiment=0.9 - (i * 0.2),  # Decreasing: 0.9, 0.7, 0.5, 0.3, 0.1
                average_sentiment=0.9 - (i * 0.2),
                sentiment_trend=0.0,
                total_mentions=10,
                unique_sources=5,
                confidence_average=0.8,
                polarity_distribution={},
                data_quality_score=0.9,
                coverage_score=0.8,
                next_update=base_time + timedelta(hours=i+2)
            )
            aggregations.append(agg)

        trend = self.aggregator.calculate_sentiment_trend(aggregations)

        # Should detect negative trend
        assert trend < -0.1  # Strong negative trend

    def test_calculate_sentiment_trend_flat(self):
        """Test trend calculation for flat sentiment."""
        aggregations = []
        base_time = datetime.utcnow()

        for i in range(5):
            agg = SentimentAggregation(
                ticker="AAPL",
                start_time=base_time + timedelta(hours=i),
                end_time=base_time + timedelta(hours=i+1),
                window_size=timedelta(hours=1),
                weighted_sentiment=0.5,  # Constant
                average_sentiment=0.5,
                sentiment_trend=0.0,
                total_mentions=10,
                unique_sources=5,
                confidence_average=0.8,
                polarity_distribution={},
                data_quality_score=0.9,
                coverage_score=0.8,
                next_update=base_time + timedelta(hours=i+2)
            )
            aggregations.append(agg)

        trend = self.aggregator.calculate_sentiment_trend(aggregations)

        # Should detect no trend (close to zero)
        assert abs(trend) < 0.1

    def test_calculate_sentiment_trend_insufficient_data(self):
        """Test trend calculation with insufficient data points."""
        # Test with single aggregation
        single_agg = [SentimentAggregation(
            ticker="AAPL",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
            window_size=timedelta(hours=1),
            weighted_sentiment=0.5,
            average_sentiment=0.5,
            sentiment_trend=0.0,
            total_mentions=10,
            unique_sources=5,
            confidence_average=0.8,
            polarity_distribution={},
            data_quality_score=0.9,
            coverage_score=0.8,
            next_update=datetime.utcnow() + timedelta(hours=2)
        )]

        trend = self.aggregator.calculate_sentiment_trend(single_agg)
        assert trend == 0.0

        # Test with empty list
        trend = self.aggregator.calculate_sentiment_trend([])
        assert trend == 0.0

    def test_calculate_data_quality_score(self):
        """Test data quality score calculation."""
        # Create mock processed content with varying quality
        high_quality_content = [
            Mock(overall_confidence=0.9, entity_coverage=0.8),
            Mock(overall_confidence=0.85, entity_coverage=0.7),
            Mock(overall_confidence=0.8, entity_coverage=0.75)
        ]

        low_quality_content = [
            Mock(overall_confidence=0.3, entity_coverage=0.2),
            Mock(overall_confidence=0.4, entity_coverage=0.1),
            Mock(overall_confidence=0.2, entity_coverage=0.15)
        ]

        high_quality_score = self.aggregator.calculate_data_quality_score(high_quality_content)
        low_quality_score = self.aggregator.calculate_data_quality_score(low_quality_content)

        # High quality content should score higher
        assert high_quality_score > low_quality_score
        assert high_quality_score > 0.7
        assert low_quality_score < 0.5

        # Score should be between 0 and 1
        assert 0.0 <= high_quality_score <= 1.0
        assert 0.0 <= low_quality_score <= 1.0

    def test_calculate_data_quality_score_empty(self):
        """Test data quality score with empty content list."""
        score = self.aggregator.calculate_data_quality_score([])
        assert score == 0.0


class TestTimeWindowManager:
    """Test suite for time window management functionality."""

    def test_get_window_bounds_1hour(self):
        """Test 1-hour window bounds calculation."""
        reference_time = datetime(2024, 1, 15, 14, 30, 45, 123456)  # 2:30:45 PM

        start_time, end_time = TimeWindowManager.get_window_bounds("1h", reference_time)

        # Should align to hour boundary
        expected_end = datetime(2024, 1, 15, 14, 0, 0, 0)  # 2:00 PM
        expected_start = datetime(2024, 1, 15, 13, 0, 0, 0)  # 1:00 PM

        assert end_time == expected_end
        assert start_time == expected_start

    def test_get_window_bounds_1day(self):
        """Test 1-day window bounds calculation."""
        reference_time = datetime(2024, 1, 15, 14, 30, 45)  # Monday 2:30 PM

        start_time, end_time = TimeWindowManager.get_window_bounds("1d", reference_time)

        # Should align to day boundary
        expected_end = datetime(2024, 1, 15, 0, 0, 0, 0)  # Monday midnight
        expected_start = datetime(2024, 1, 14, 0, 0, 0, 0)  # Sunday midnight

        assert end_time == expected_end
        assert start_time == expected_start

    def test_get_window_bounds_5minute(self):
        """Test 5-minute window bounds calculation."""
        reference_time = datetime(2024, 1, 15, 14, 17, 45)  # 2:17:45 PM

        start_time, end_time = TimeWindowManager.get_window_bounds("5m", reference_time)

        # Should align to 5-minute boundary (15-minute mark)
        expected_end = datetime(2024, 1, 15, 14, 15, 0, 0)  # 2:15 PM
        expected_start = datetime(2024, 1, 15, 14, 10, 0, 0)  # 2:10 PM

        assert end_time == expected_end
        assert start_time == expected_start

    def test_get_window_bounds_1week(self):
        """Test 1-week window bounds calculation."""
        reference_time = datetime(2024, 1, 17, 14, 30, 0)  # Wednesday

        start_time, end_time = TimeWindowManager.get_window_bounds("1w", reference_time)

        # Should align to Monday (start of week)
        expected_end = datetime(2024, 1, 15, 0, 0, 0, 0)  # Monday midnight
        expected_start = datetime(2024, 1, 8, 0, 0, 0, 0)  # Previous Monday

        assert end_time == expected_end
        assert start_time == expected_start

    def test_get_window_bounds_invalid_window(self):
        """Test error handling for invalid window size."""
        with pytest.raises(ValueError):
            TimeWindowManager.get_window_bounds("invalid", datetime.utcnow())

    def test_get_historical_windows(self):
        """Test generation of multiple historical windows."""
        reference_time = datetime(2024, 1, 15, 12, 0, 0)

        windows = TimeWindowManager.get_historical_windows("1h", 3, reference_time)

        assert len(windows) == 3

        # Windows should be in chronological order
        for i in range(len(windows) - 1):
            assert windows[i][1] <= windows[i + 1][0]  # End of window i <= start of window i+1

        # Each window should be 1 hour long
        for start, end in windows:
            assert end - start == timedelta(hours=1)

    def test_window_definitions_coverage(self):
        """Test that all defined windows are supported."""
        reference_time = datetime(2024, 1, 15, 12, 0, 0)

        for window_size in TimeWindowManager.WINDOW_DEFINITIONS.keys():
            # Should not raise exception
            start_time, end_time = TimeWindowManager.get_window_bounds(window_size, reference_time)

            # Basic sanity checks
            assert start_time < end_time
            expected_duration = TimeWindowManager.WINDOW_DEFINITIONS[window_size]
            actual_duration = end_time - start_time
            assert actual_duration == expected_duration


class TestSentimentAggregationService:
    """Integration tests for the sentiment aggregation service."""

    @pytest.fixture
    async def aggregation_service(self):
        """Create a mock sentiment aggregation service."""
        with patch('redis.asyncio.from_url') as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis.return_value = mock_redis_instance

            service = SentimentAggregationService(mock_redis_instance)
            yield service

    @pytest.mark.asyncio
    async def test_aggregate_sentiment_with_data(self, aggregation_service):
        """Test sentiment aggregation when data is available."""
        # Mock processed content retrieval
        mock_content = [
            ProcessedContent(
                content_id="content_1",
                original_text="AAPL is performing great!",
                processed_at=datetime.utcnow(),
                content_type=ContentType.NEWS_ARTICLE,
                source_url="https://example.com",
                overall_sentiment=SentimentScore(
                    score=0.8, confidence=0.9, polarity=SentimentPolarity.POSITIVE
                ),
                named_entities=[],
                primary_tickers=["AAPL"],
                ticker_sentiments={
                    "AAPL": SentimentScore(
                        score=0.8, confidence=0.9, polarity=SentimentPolarity.POSITIVE
                    )
                },
                overall_confidence=0.9,
                entity_coverage=0.8,
                processing_metadata={}
            )
        ]

        # Mock the fetch method
        aggregation_service._fetch_processed_content_by_ticker = AsyncMock(return_value=mock_content)
        aggregation_service._fetch_historical_aggregations = AsyncMock(return_value=[])
        aggregation_service._cache_aggregation = AsyncMock()

        result = await aggregation_service.aggregate_sentiment("AAPL", "1h")

        # Verify aggregation results
        assert result.ticker == "AAPL"
        assert result.weighted_sentiment > 0  # Should be positive
        assert result.total_mentions == 1
        assert result.unique_sources == 1
        assert result.confidence_average > 0.8

    @pytest.mark.asyncio
    async def test_aggregate_sentiment_no_data(self, aggregation_service):
        """Test sentiment aggregation when no data is available."""
        # Mock empty content retrieval
        aggregation_service._fetch_processed_content_by_ticker = AsyncMock(return_value=[])
        aggregation_service._fetch_historical_aggregations = AsyncMock(return_value=[])
        aggregation_service._cache_aggregation = AsyncMock()

        result = await aggregation_service.aggregate_sentiment("UNKNOWN", "1h")

        # Should return zero aggregation
        assert result.ticker == "UNKNOWN"
        assert result.weighted_sentiment == 0.0
        assert result.total_mentions == 0
        assert result.unique_sources == 0
        assert result.confidence_average == 0.0

    @pytest.mark.asyncio
    async def test_query_sentiment_data_basic(self, aggregation_service):
        """Test basic sentiment data querying."""
        # Mock aggregation method
        mock_aggregation = SentimentAggregation(
            ticker="AAPL",
            start_time=datetime.utcnow() - timedelta(hours=1),
            end_time=datetime.utcnow(),
            window_size=timedelta(hours=1),
            average_sentiment=0.6,
            weighted_sentiment=0.7,
            sentiment_trend=0.1,
            total_mentions=50,
            unique_sources=10,
            confidence_average=0.8,
            polarity_distribution={SentimentPolarity.POSITIVE: 30, SentimentPolarity.NEGATIVE: 20},
            data_quality_score=0.85,
            coverage_score=0.9,
            next_update=datetime.utcnow() + timedelta(hours=1)
        )

        aggregation_service.aggregate_sentiment = AsyncMock(return_value=mock_aggregation)
        aggregation_service._fetch_processed_content_by_ticker = AsyncMock(return_value=[])

        request = SentimentQueryRequest(
            tickers=["AAPL"],
            aggregation_window="1h",
            min_confidence=0.5,
            limit=10
        )

        response = await aggregation_service.query_sentiment_data(request)

        # Verify response structure
        assert isinstance(response, SentimentQueryResponse)
        assert response.total_results >= 0
        assert len(response.aggregations) >= 0
        assert response.query_time >= 0

    @pytest.mark.asyncio
    async def test_get_aggregation_stats(self, aggregation_service):
        """Test aggregation statistics retrieval."""
        # Mock Redis key operations
        aggregation_service.redis.keys = AsyncMock(side_effect=[
            ["sentiment_agg:AAPL:3600:2024-01-15", "sentiment_agg:MSFT:3600:2024-01-15"],
            ["processed_content:1", "processed_content:2", "processed_content:3"]
        ])

        stats = await aggregation_service.get_aggregation_stats()

        # Verify stats structure
        assert "cached_aggregations" in stats
        assert "processed_content_count" in stats
        assert "supported_windows" in stats
        assert "timestamp" in stats

        assert stats["cached_aggregations"] == 2
        assert stats["processed_content_count"] == 3
        assert isinstance(stats["supported_windows"], list)
        assert len(stats["supported_windows"]) > 0

    @pytest.mark.asyncio
    async def test_polarity_distribution_calculation(self, aggregation_service):
        """Test polarity distribution calculation."""
        # Create sentiment scores with different polarities
        scores = [
            SentimentScore(score=0.8, confidence=0.9, polarity=SentimentPolarity.POSITIVE),
            SentimentScore(score=0.6, confidence=0.8, polarity=SentimentPolarity.POSITIVE),
            SentimentScore(score=-0.7, confidence=0.9, polarity=SentimentPolarity.NEGATIVE),
            SentimentScore(score=0.1, confidence=0.5, polarity=SentimentPolarity.NEUTRAL),
            SentimentScore(score=-0.3, confidence=0.6, polarity=SentimentPolarity.NEGATIVE)
        ]

        distribution = aggregation_service._calculate_polarity_distribution(scores)

        # Verify distribution counts
        assert distribution[SentimentPolarity.POSITIVE] == 2
        assert distribution[SentimentPolarity.NEGATIVE] == 2
        assert distribution[SentimentPolarity.NEUTRAL] == 1

    @pytest.mark.asyncio
    async def test_coverage_score_calculation(self, aggregation_service):
        """Test coverage score calculation for specific ticker."""
        mock_content = [
            Mock(ticker_sentiments={"AAPL": Mock(confidence=0.9)}),  # High confidence
            Mock(ticker_sentiments={"AAPL": Mock(confidence=0.8)}),  # High confidence
            Mock(ticker_sentiments={"AAPL": Mock(confidence=0.5)}),  # Low confidence
            Mock(ticker_sentiments={"AAPL": Mock(confidence=0.9)}),  # High confidence
        ]

        coverage_score = aggregation_service._calculate_coverage_score(mock_content, "AAPL")

        # 3 out of 4 have confidence > 0.7
        expected_score = 3 / 4  # 0.75
        assert abs(coverage_score - expected_score) < 0.001

    @pytest.mark.asyncio
    async def test_cache_aggregation(self, aggregation_service):
        """Test aggregation caching functionality."""
        aggregation = SentimentAggregation(
            ticker="AAPL",
            start_time=datetime(2024, 1, 15, 12, 0, 0),
            end_time=datetime(2024, 1, 15, 13, 0, 0),
            window_size=timedelta(hours=1),
            average_sentiment=0.5,
            weighted_sentiment=0.6,
            sentiment_trend=0.1,
            total_mentions=25,
            unique_sources=8,
            confidence_average=0.8,
            polarity_distribution={},
            data_quality_score=0.9,
            coverage_score=0.85,
            next_update=datetime(2024, 1, 15, 14, 0, 0)
        )

        aggregation_service.redis.setex = AsyncMock()

        await aggregation_service._cache_aggregation(aggregation)

        # Verify caching was called with correct parameters
        aggregation_service.redis.setex.assert_called_once()
        call_args = aggregation_service.redis.setex.call_args

        # Verify cache key format
        cache_key = call_args[0][0]
        assert "sentiment_agg:AAPL:" in cache_key
        assert "3600.0:" in cache_key  # 1 hour in seconds

        # Verify TTL (should be 2x window size)
        ttl = call_args[0][1]
        assert ttl == 7200  # 2 hours in seconds


if __name__ == "__main__":
    pytest.main([__file__])