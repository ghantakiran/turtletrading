"""
Integration tests for the complete sentiment ingestion pipeline.

Tests the full workflow: Content Ingestion → NLP Processing → Sentiment Aggregation
Validates end-to-end functionality with real-like data scenarios.
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta, date
from typing import List, Dict, Any

from app.services.content_ingestion_service import ContentIngestionService, create_content_ingestion_service
from app.services.nlp_pipeline_service import NLPPipelineService, create_nlp_pipeline_service
from app.services.sentiment_aggregation_service import SentimentAggregationService, create_sentiment_aggregation_service
from app.models.sentiment_ner_models import (
    RawContent, ProcessedContent, SentimentAggregation,
    ContentType, ProviderType, SentimentPolarity, EntityType,
    IngestionRequest, SentimentQueryRequest, BackfillRequest
)


class TestSentimentIngestionPipelineIntegration:
    """Integration tests for the complete sentiment ingestion pipeline."""

    @pytest.fixture
    async def mock_redis(self):
        """Create a mock Redis client for testing."""
        redis_mock = AsyncMock()

        # Mock common Redis operations
        redis_mock.ping = AsyncMock(return_value=True)
        redis_mock.get = AsyncMock(return_value=None)
        redis_mock.setex = AsyncMock()
        redis_mock.set = AsyncMock()
        redis_mock.keys = AsyncMock(return_value=[])
        redis_mock.sismember = AsyncMock(return_value=False)
        redis_mock.sadd = AsyncMock()
        redis_mock.expire = AsyncMock()
        redis_mock.close = AsyncMock()

        # Mock pipeline operations
        mock_pipe = AsyncMock()
        mock_pipe.zremrangebyscore = Mock()
        mock_pipe.zcard = Mock()
        mock_pipe.zadd = Mock()
        mock_pipe.expire = Mock()
        mock_pipe.execute = AsyncMock(return_value=[None, 0, None, None])  # No rate limiting
        redis_mock.pipeline = Mock(return_value=mock_pipe)

        return redis_mock

    @pytest.fixture
    async def ingestion_service(self, mock_redis):
        """Create ingestion service with mocked dependencies."""
        with patch('app.services.content_ingestion_service.aioredis.from_url', return_value=mock_redis):
            service = ContentIngestionService(mock_redis)

            # Mock external API providers to avoid real API calls
            service.providers = {}
            yield service

    @pytest.fixture
    async def nlp_service(self, mock_redis):
        """Create NLP service with mocked dependencies."""
        with patch('app.services.nlp_pipeline_service.aioredis.from_url', return_value=mock_redis):
            service = NLPPipelineService(mock_redis)
            yield service

    @pytest.fixture
    async def aggregation_service(self, mock_redis):
        """Create aggregation service with mocked dependencies."""
        with patch('app.services.sentiment_aggregation_service.aioredis.from_url', return_value=mock_redis):
            service = SentimentAggregationService(mock_redis)
            yield service

    @pytest.fixture
    def sample_news_content(self):
        """Create sample news content for testing."""
        return [
            RawContent(
                content_id="news_1",
                title="Apple Reports Record Q4 Earnings, Stock Surges",
                content="""
                Apple Inc. (NASDAQ: AAPL) reported record fourth-quarter earnings yesterday,
                beating analyst expectations on both revenue and earnings per share.
                The company posted revenue of $94.9 billion, up 8% year-over-year,
                driven by strong iPhone 15 sales and growing services revenue.
                CEO Tim Cook highlighted the company's strong performance across all
                product categories and geographical regions. The stock surged 12%
                in after-hours trading following the announcement.
                """,
                source_url="https://financialnews.com/apple-q4-earnings-2024",
                published_at=datetime.utcnow() - timedelta(hours=2),
                provider=ProviderType.NEWS_API,
                content_type=ContentType.NEWS_ARTICLE,
                metadata={"source_name": "Financial News", "author": "Jane Smith"}
            ),
            RawContent(
                content_id="news_2",
                title="Tesla Production Challenges Continue Despite Strong Demand",
                content="""
                Tesla (NASDAQ: TSLA) faces ongoing production challenges at its
                German Gigafactory, with output falling short of targets by 15%.
                Despite strong global demand for electric vehicles, supply chain
                issues and regulatory hurdles have impacted manufacturing efficiency.
                However, the company remains optimistic about meeting annual
                delivery goals, with CEO Elon Musk stating that Q4 will be
                a record quarter for vehicle deliveries.
                """,
                source_url="https://autonews.com/tesla-production-challenges",
                published_at=datetime.utcnow() - timedelta(hours=1),
                provider=ProviderType.NEWS_API,
                content_type=ContentType.NEWS_ARTICLE,
                metadata={"source_name": "Auto News", "author": "Mike Johnson"}
            ),
            RawContent(
                content_id="social_1",
                title="$AAPL Discussion Thread",
                content="""
                Amazing earnings from Apple! $AAPL to the moon 🚀
                iPhone sales are crushing it, Tim Cook is a legend.
                This is why I've been bullish on Apple stock all year.
                Revenue growth of 8% in this economy is incredible.
                #AAPL #Apple #Earnings #Bullish
                """,
                source_url="https://reddit.com/r/investing/posts/aapl_discussion",
                published_at=datetime.utcnow() - timedelta(minutes=30),
                provider=ProviderType.REDDIT,
                content_type=ContentType.SOCIAL_MEDIA,
                metadata={"platform": "reddit", "upvotes": 245, "comments": 67}
            )
        ]

    @pytest.mark.asyncio
    async def test_complete_ingestion_to_aggregation_pipeline(
        self, ingestion_service, nlp_service, aggregation_service, sample_news_content
    ):
        """Test the complete pipeline from ingestion through aggregation."""

        # Step 1: Mock content ingestion
        mock_provider = AsyncMock()
        mock_provider.fetch_content = AsyncMock(return_value=sample_news_content)
        ingestion_service.providers[ProviderType.NEWS_API] = mock_provider

        # Mock successful ingestion (no duplicates, rate limiting allows)
        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(True, {}))
        ingestion_service.deduplicator.is_duplicate = AsyncMock(return_value=False)

        # Ingest content
        ingestion_response = await ingestion_service.ingest_from_providers(
            providers=[ProviderType.NEWS_API],
            query_params={"query": "Apple Tesla earnings"},
            max_items=10
        )

        # Verify ingestion succeeded
        assert ingestion_response.total_items == 3
        assert ingestion_response.unique_items == 3
        assert ingestion_response.duplicate_items == 0

        # Step 2: Process content through NLP pipeline
        processed_contents = []
        for raw_content in sample_news_content:
            processed = await nlp_service.process_content(
                content_id=raw_content.content_id,
                text=raw_content.content,
                content_type=raw_content.content_type,
                source_url=raw_content.source_url,
                metadata=raw_content.metadata
            )
            processed_contents.append(processed)

        # Verify NLP processing results
        assert len(processed_contents) == 3

        # Check Apple content processing
        apple_content = next(pc for pc in processed_contents if pc.content_id == "news_1")
        assert apple_content is not None
        assert "AAPL" in apple_content.primary_tickers
        assert "AAPL" in apple_content.ticker_sentiments
        assert apple_content.ticker_sentiments["AAPL"].polarity == SentimentPolarity.POSITIVE
        assert apple_content.overall_sentiment.score > 0.2  # Should be positive

        # Check Tesla content processing
        tesla_content = next(pc for pc in processed_contents if pc.content_id == "news_2")
        assert tesla_content is not None
        assert "TSLA" in tesla_content.primary_tickers
        assert "TSLA" in tesla_content.ticker_sentiments
        # Tesla content is mixed (challenges but optimistic), sentiment could vary

        # Check social media content
        social_content = next(pc for pc in processed_contents if pc.content_id == "social_1")
        assert social_content is not None
        assert "AAPL" in social_content.primary_tickers
        assert social_content.ticker_sentiments["AAPL"].score > 0.5  # Very positive social sentiment

        # Step 3: Mock processed content storage and retrieval for aggregation
        def mock_fetch_processed_content(ticker, start_time, end_time):
            # Return relevant processed content for the ticker
            relevant_content = [
                pc for pc in processed_contents
                if ticker in pc.primary_tickers and
                start_time <= pc.processed_at <= end_time
            ]
            return relevant_content

        aggregation_service._fetch_processed_content_by_ticker = AsyncMock(
            side_effect=mock_fetch_processed_content
        )
        aggregation_service._fetch_historical_aggregations = AsyncMock(return_value=[])
        aggregation_service._cache_aggregation = AsyncMock()

        # Step 4: Generate sentiment aggregations
        aapl_aggregation = await aggregation_service.aggregate_sentiment("AAPL", "1h")
        tsla_aggregation = await aggregation_service.aggregate_sentiment("TSLA", "1h")

        # Verify aggregation results
        assert aapl_aggregation.ticker == "AAPL"
        assert aapl_aggregation.total_mentions == 2  # News + social media
        assert aapl_aggregation.weighted_sentiment > 0.3  # Should be positive
        assert aapl_aggregation.confidence_average > 0.6  # Good confidence

        assert tsla_aggregation.ticker == "TSLA"
        assert tsla_aggregation.total_mentions == 1  # Just news
        # Tesla sentiment varies based on mixed content

        # Step 5: Query aggregated sentiment data
        query_request = SentimentQueryRequest(
            tickers=["AAPL", "TSLA"],
            aggregation_window="1h",
            min_confidence=0.5,
            limit=10
        )

        # Mock query response
        aggregation_service.query_sentiment_data = AsyncMock(return_value=Mock(
            aggregations=[aapl_aggregation, tsla_aggregation],
            total_results=2,
            query_time=0.15
        ))

        query_response = await aggregation_service.query_sentiment_data(query_request)

        # Verify query results
        assert query_response.total_results == 2
        assert len(query_response.aggregations) == 2

    @pytest.mark.asyncio
    async def test_pipeline_with_duplicate_content(
        self, ingestion_service, nlp_service, sample_news_content
    ):
        """Test pipeline behavior with duplicate content filtering."""

        # Create duplicate content
        duplicate_content = sample_news_content[0]
        duplicate_content.content_id = "news_1_duplicate"
        all_content = sample_news_content + [duplicate_content]

        # Mock provider
        mock_provider = AsyncMock()
        mock_provider.fetch_content = AsyncMock(return_value=all_content)
        ingestion_service.providers[ProviderType.NEWS_API] = mock_provider

        # Mock rate limiter to allow
        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(True, {}))

        # Mock deduplicator to detect duplicate
        def mock_is_duplicate(content):
            return content.content_id == "news_1_duplicate"

        ingestion_service.deduplicator.is_duplicate = AsyncMock(side_effect=mock_is_duplicate)

        # Ingest with deduplication
        response = await ingestion_service.ingest_from_providers(
            providers=[ProviderType.NEWS_API],
            query_params={"query": "test"},
            max_items=10
        )

        # Should filter out duplicate
        assert response.total_items == 4  # All content submitted
        assert response.unique_items == 3  # One duplicate filtered
        assert response.duplicate_items == 1

    @pytest.mark.asyncio
    async def test_pipeline_with_rate_limiting(
        self, ingestion_service, sample_news_content
    ):
        """Test pipeline behavior under rate limiting."""

        # Mock provider
        mock_provider = AsyncMock()
        mock_provider.fetch_content = AsyncMock(return_value=sample_news_content)
        ingestion_service.providers[ProviderType.NEWS_API] = mock_provider

        # Mock rate limiter to reject requests
        ingestion_service.rate_limiter.is_allowed = AsyncMock(
            return_value=(False, {"limit": 100, "remaining": 0, "reset_time": 3600})
        )

        response = await ingestion_service.ingest_from_providers(
            providers=[ProviderType.NEWS_API],
            query_params={"query": "test"},
            max_items=10
        )

        # Should be blocked by rate limiting
        assert response.total_items == 0
        assert len(response.errors) > 0
        assert "rate limit" in response.errors[0].lower()

    @pytest.mark.asyncio
    async def test_pipeline_error_handling(
        self, ingestion_service, nlp_service, mock_redis
    ):
        """Test pipeline error handling and resilience."""

        # Test provider error handling
        mock_provider = AsyncMock()
        mock_provider.fetch_content = AsyncMock(side_effect=Exception("Provider API error"))
        ingestion_service.providers[ProviderType.NEWS_API] = mock_provider

        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(True, {}))

        response = await ingestion_service.ingest_from_providers(
            providers=[ProviderType.NEWS_API],
            query_params={"query": "test"},
            max_items=10
        )

        # Should handle provider errors gracefully
        assert response.total_items == 0
        assert len(response.errors) > 0

        # Test NLP processing error handling
        with pytest.raises(ValueError):
            await nlp_service.process_content(
                content_id="error_test",
                text="",  # Empty text should raise error
                content_type=ContentType.NEWS_ARTICLE
            )

    @pytest.mark.asyncio
    async def test_pipeline_performance_with_batch_content(
        self, ingestion_service, nlp_service, aggregation_service
    ):
        """Test pipeline performance with larger content batches."""

        # Create larger batch of content
        batch_content = []
        tickers = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN"]

        for i in range(50):  # 50 articles
            ticker = tickers[i % len(tickers)]
            content = RawContent(
                content_id=f"batch_{i}",
                title=f"{ticker} News Article {i}",
                content=f"""
                {ticker} is showing strong performance today. The stock is up significantly
                after positive earnings results. Analysts are bullish on the company's
                future prospects and growth potential in the current market environment.
                Revenue growth continues to exceed expectations.
                """,
                source_url=f"https://example.com/news/{i}",
                published_at=datetime.utcnow() - timedelta(minutes=i),
                provider=ProviderType.NEWS_API,
                content_type=ContentType.NEWS_ARTICLE,
                metadata={"batch_id": "performance_test"}
            )
            batch_content.append(content)

        # Mock ingestion
        mock_provider = AsyncMock()
        mock_provider.fetch_content = AsyncMock(return_value=batch_content)
        ingestion_service.providers[ProviderType.NEWS_API] = mock_provider

        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(True, {}))
        ingestion_service.deduplicator.is_duplicate = AsyncMock(return_value=False)

        # Measure ingestion performance
        start_time = datetime.utcnow()

        ingestion_response = await ingestion_service.ingest_from_providers(
            providers=[ProviderType.NEWS_API],
            query_params={"query": "batch test"},
            max_items=50
        )

        ingestion_time = (datetime.utcnow() - start_time).total_seconds()

        # Verify batch ingestion
        assert ingestion_response.total_items == 50
        assert ingestion_response.unique_items == 50
        assert ingestion_time < 10.0  # Should complete within 10 seconds

        # Test batch NLP processing
        start_time = datetime.utcnow()

        processed_batch = []
        # Process in smaller chunks to simulate real-world usage
        chunk_size = 10
        for i in range(0, len(batch_content), chunk_size):
            chunk = batch_content[i:i+chunk_size]
            chunk_tasks = [
                nlp_service.process_content(
                    content_id=content.content_id,
                    text=content.content,
                    content_type=content.content_type,
                    source_url=content.source_url,
                    metadata=content.metadata
                )
                for content in chunk
            ]

            chunk_results = await asyncio.gather(*chunk_tasks, return_exceptions=True)
            processed_batch.extend([r for r in chunk_results if not isinstance(r, Exception)])

        nlp_time = (datetime.utcnow() - start_time).total_seconds()

        # Verify NLP processing
        assert len(processed_batch) == 50
        assert nlp_time < 30.0  # Should complete within 30 seconds

        # Verify all tickers were identified
        all_tickers = set()
        for processed in processed_batch:
            all_tickers.update(processed.primary_tickers)

        assert len(all_tickers.intersection(set(tickers))) >= 4  # Most tickers should be found

    @pytest.mark.asyncio
    async def test_historical_backfill_integration(
        self, ingestion_service, nlp_service, aggregation_service
    ):
        """Test historical data backfill integration."""

        # Create historical content spanning multiple days
        historical_content = []
        base_date = date.today() - timedelta(days=30)

        for day_offset in range(7):  # 7 days of historical data
            for hour in range(0, 24, 4):  # Every 4 hours
                content_date = datetime.combine(
                    base_date + timedelta(days=day_offset),
                    datetime.min.time().replace(hour=hour)
                )

                content = RawContent(
                    content_id=f"hist_{day_offset}_{hour}",
                    title=f"AAPL Historical News Day {day_offset} Hour {hour}",
                    content=f"""
                    Apple Inc. continues to show strong performance on day {day_offset}.
                    The stock is maintaining its upward trajectory with solid fundamentals.
                    Market analysts remain optimistic about the company's prospects.
                    """,
                    source_url=f"https://example.com/historical/{day_offset}/{hour}",
                    published_at=content_date,
                    provider=ProviderType.NEWS_API,
                    content_type=ContentType.NEWS_ARTICLE,
                    metadata={"historical": True, "day": day_offset}
                )
                historical_content.append(content)

        # Mock historical provider
        mock_provider = AsyncMock()
        mock_provider.fetch_historical_content = AsyncMock(return_value=historical_content)
        ingestion_service.providers[ProviderType.NEWS_API] = mock_provider

        # Mock other services
        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(True, {}))
        ingestion_service.deduplicator.is_duplicate = AsyncMock(return_value=False)

        # Perform backfill
        await ingestion_service.backfill_historical_data(
            start_date=base_date,
            end_date=base_date + timedelta(days=7),
            tickers=["AAPL"],
            providers=[ProviderType.NEWS_API],
            max_items_per_day=100
        )

        # Verify historical fetch was called
        mock_provider.fetch_historical_content.assert_called()

        # Mock aggregation with historical data
        def mock_historical_fetch(ticker, start_time, end_time):
            # Return historical content within time range
            return [
                content for content in historical_content
                if start_time <= content.published_at <= end_time
            ]

        aggregation_service._fetch_processed_content_by_ticker = AsyncMock(
            side_effect=mock_historical_fetch
        )
        aggregation_service._fetch_historical_aggregations = AsyncMock(return_value=[])
        aggregation_service._cache_aggregation = AsyncMock()

        # Test aggregation over historical period
        historical_aggregation = await aggregation_service.aggregate_sentiment(
            "AAPL",
            "1d",
            reference_time=datetime.combine(base_date + timedelta(days=3), datetime.min.time())
        )

        # Should aggregate historical data
        assert historical_aggregation.ticker == "AAPL"
        assert historical_aggregation.total_mentions > 0

    @pytest.mark.asyncio
    async def test_real_time_sentiment_updates(
        self, aggregation_service, sample_news_content, nlp_service
    ):
        """Test real-time sentiment update simulation."""

        # Process initial content
        initial_processed = []
        for content in sample_news_content[:2]:  # First 2 articles
            processed = await nlp_service.process_content(
                content_id=content.content_id,
                text=content.content,
                content_type=content.content_type,
                source_url=content.source_url,
                metadata=content.metadata
            )
            initial_processed.append(processed)

        # Mock initial aggregation
        aggregation_service._fetch_processed_content_by_ticker = AsyncMock(
            return_value=initial_processed
        )
        aggregation_service._fetch_historical_aggregations = AsyncMock(return_value=[])
        aggregation_service._cache_aggregation = AsyncMock()

        # Get initial sentiment
        initial_sentiment = await aggregation_service.aggregate_sentiment("AAPL", "1h")
        initial_score = initial_sentiment.weighted_sentiment

        # Add new positive content
        new_positive_content = await nlp_service.process_content(
            content_id="new_positive",
            text="""
            $AAPL just announced breakthrough AI technology integration!
            This is absolutely amazing news for Apple investors. Stock should
            soar on this announcement. Incredible innovation from Tim Cook's team.
            """,
            content_type=ContentType.SOCIAL_MEDIA,
            source_url="https://twitter.com/breaking_news"
        )

        # Mock updated content including new positive sentiment
        updated_content = initial_processed + [new_positive_content]
        aggregation_service._fetch_processed_content_by_ticker = AsyncMock(
            return_value=updated_content
        )

        # Get updated sentiment
        updated_sentiment = await aggregation_service.aggregate_sentiment("AAPL", "1h")
        updated_score = updated_sentiment.weighted_sentiment

        # Sentiment should improve with positive news
        assert updated_sentiment.total_mentions > initial_sentiment.total_mentions
        assert updated_score >= initial_score  # Should be same or more positive


if __name__ == "__main__":
    pytest.main([__file__])