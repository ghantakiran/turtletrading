"""
Integration Tests for Sentiment Ingestion Pipeline

This module provides comprehensive integration tests for the complete sentiment
ingestion pipeline including data ingestion, NLP processing, and aggregation.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json

from app.models.sentiment_ingestion_models import (
    RawContentItem,
    SentimentSource,
    ContentType,
    DataSourceConfig,
    IngestionStatus,
    EntityType,
    SentimentPolarity
)
from app.services.news_data_providers import (
    NewsIngestionService,
    NewsAPIProvider,
    YahooFinanceNewsProvider
)
from app.services.social_media_providers import (
    SocialMediaIngestionService,
    TwitterProvider,
    RedditProvider
)
from app.services.nlp_pipeline import NLPPipeline
from app.services.sentiment_aggregation_service import SentimentAggregationService
from app.services.sentiment_backfill_service import (
    SentimentBackfillService,
    BackfillStrategy,
    BackfillPriority
)


class TestNewsIngestionIntegration:
    """Integration tests for news data ingestion"""

    @pytest.fixture
    def redis_service_mock(self):
        """Mock Redis service"""
        mock_redis = AsyncMock()
        mock_redis_connection = AsyncMock()
        mock_redis.get_redis.return_value.__aenter__.return_value = mock_redis_connection

        # Mock rate limiting responses
        mock_redis_connection.zremrangebyscore.return_value = None
        mock_redis_connection.zcard.return_value = 0
        mock_redis_connection.zadd.return_value = None
        mock_redis_connection.expire.return_value = None
        mock_redis_connection.exists.return_value = False
        mock_redis_connection.setex.return_value = None

        return mock_redis

    @pytest.fixture
    def news_configs(self):
        """Sample news source configurations"""
        return [
            DataSourceConfig(
                source=SentimentSource.NEWS_API,
                enabled=True,
                api_key="test_api_key",
                rate_limit_requests=100,
                rate_limit_period=3600
            ),
            DataSourceConfig(
                source=SentimentSource.YAHOO_FINANCE,
                enabled=True,
                rate_limit_requests=50,
                rate_limit_period=3600
            )
        ]

    @pytest.mark.asyncio
    async def test_complete_news_ingestion_flow(self, redis_service_mock, news_configs):
        """Test complete news ingestion workflow"""
        service = NewsIngestionService(redis_service_mock)

        # Mock the provider responses
        with patch.object(service.factory, 'create_provider') as mock_factory:
            mock_provider = AsyncMock()
            mock_provider.fetch_articles.return_value = [
                RawContentItem(
                    source=SentimentSource.NEWS_API,
                    content_type=ContentType.ARTICLE,
                    title="Apple Reports Strong Earnings",
                    content="Apple Inc. (AAPL) reported strong quarterly earnings today...",
                    published_at=datetime.utcnow(),
                    source_url="https://example.com/apple-earnings",
                    source_id="test-article-1"
                ),
                RawContentItem(
                    source=SentimentSource.NEWS_API,
                    content_type=ContentType.ARTICLE,
                    title="Tesla Stock Surges",
                    content="Tesla (TSLA) stock surged 5% after positive analyst reports...",
                    published_at=datetime.utcnow(),
                    source_url="https://example.com/tesla-surge",
                    source_id="test-article-2"
                )
            ]
            mock_provider.close = AsyncMock()
            mock_factory.return_value = mock_provider

            # Execute ingestion job
            job = await service.start_ingestion_job(
                sources=news_configs,
                keywords=["AAPL", "TSLA"],
                job_type="test"
            )

            # Verify job completed successfully
            assert job.status == IngestionStatus.COMPLETED
            assert job.items_processed == 2
            assert job.items_succeeded == 2
            assert job.items_failed == 0

            # Verify provider was called correctly
            mock_factory.assert_called()
            mock_provider.fetch_articles.assert_called()
            mock_provider.close.assert_called()

    @pytest.mark.asyncio
    async def test_news_provider_error_handling(self, redis_service_mock, news_configs):
        """Test error handling in news ingestion"""
        service = NewsIngestionService(redis_service_mock)

        with patch.object(service.factory, 'create_provider') as mock_factory:
            mock_provider = AsyncMock()
            mock_provider.fetch_articles.side_effect = Exception("API Error")
            mock_provider.close = AsyncMock()
            mock_factory.return_value = mock_provider

            job = await service.start_ingestion_job(
                sources=[news_configs[0]],  # Single source
                keywords=["AAPL"],
                job_type="error_test"
            )

            # Should handle errors gracefully
            assert job.status == IngestionStatus.COMPLETED  # Job completes even with provider errors
            assert job.items_failed == 1

    @pytest.mark.asyncio
    async def test_rate_limiting_integration(self, redis_service_mock):
        """Test rate limiting in news providers"""
        # Configure Redis mock to simulate rate limiting
        mock_redis_connection = AsyncMock()
        redis_service_mock.get_redis.return_value.__aenter__.return_value = mock_redis_connection

        # First call: rate limit not exceeded
        mock_redis_connection.zcard.return_value = 50  # Under limit

        config = DataSourceConfig(
            source=SentimentSource.NEWS_API,
            enabled=True,
            api_key="test_key",
            rate_limit_requests=100,
            rate_limit_period=3600
        )

        provider = NewsAPIProvider(config, None, None)  # Will create its own rate limiter
        provider.rate_limiter = Mock()
        provider.rate_limiter.is_allowed = AsyncMock(return_value=(True, 50, 1234567890))

        # Should allow request
        with patch.object(provider, '_get_session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {"articles": []}
            mock_session.return_value.get.return_value.__aenter__.return_value = mock_response

            articles = await provider.fetch_articles(["AAPL"])

            # Should have attempted the request
            provider.rate_limiter.is_allowed.assert_called_once()

    @pytest.mark.asyncio
    async def test_content_deduplication(self, redis_service_mock):
        """Test content deduplication across providers"""
        service = NewsIngestionService(redis_service_mock)

        # Mock deduplication to simulate finding duplicates
        with patch.object(service.factory, 'create_provider') as mock_factory:
            mock_provider = AsyncMock()

            # Return duplicate content
            duplicate_content = RawContentItem(
                source=SentimentSource.NEWS_API,
                content_type=ContentType.ARTICLE,
                title="Same Article",
                content="This is the same content...",
                published_at=datetime.utcnow(),
                source_url="https://example.com/same",
                source_id="test-dup-1"
            )

            mock_provider.fetch_articles.return_value = [duplicate_content, duplicate_content]
            mock_provider.close = AsyncMock()
            mock_factory.return_value = mock_provider

            # Mock deduplication to detect duplicates
            with patch.object(service.factory.deduplicator, 'is_duplicate') as mock_is_dup:
                mock_is_dup.side_effect = [False, True]  # First is new, second is duplicate

                job = await service.start_ingestion_job(
                    sources=[DataSourceConfig(
                        source=SentimentSource.NEWS_API,
                        enabled=True,
                        api_key="test"
                    )],
                    keywords=["test"],
                    job_type="dedup_test"
                )

                # Should process both but only succeed with unique content
                assert job.items_processed >= 1  # At least one item processed


class TestSocialMediaIngestionIntegration:
    """Integration tests for social media data ingestion"""

    @pytest.fixture
    def redis_service_mock(self):
        """Mock Redis service"""
        mock_redis = AsyncMock()
        mock_redis_connection = AsyncMock()
        mock_redis.get_redis.return_value.__aenter__.return_value = mock_redis_connection

        # Mock rate limiting responses
        mock_redis_connection.zremrangebyscore.return_value = None
        mock_redis_connection.zcard.return_value = 0
        mock_redis_connection.zadd.return_value = None
        mock_redis_connection.expire.return_value = None
        mock_redis_connection.exists.return_value = False
        mock_redis_connection.setex.return_value = None

        return mock_redis

    @pytest.fixture
    def social_configs(self):
        """Sample social media source configurations"""
        return [
            DataSourceConfig(
                source=SentimentSource.TWITTER,
                enabled=True,
                api_key="twitter_bearer_token",
                rate_limit_requests=50,
                rate_limit_period=900  # 15 minutes
            ),
            DataSourceConfig(
                source=SentimentSource.REDDIT,
                enabled=True,
                api_key="reddit_client_id",
                api_secret="reddit_client_secret",
                rate_limit_requests=60,
                rate_limit_period=60  # 1 minute
            )
        ]

    @pytest.mark.asyncio
    async def test_social_media_content_filtering(self, redis_service_mock, social_configs):
        """Test content filtering in social media ingestion"""
        service = SocialMediaIngestionService(redis_service_mock)

        with patch.object(service.factory, 'create_provider') as mock_factory:
            mock_provider = AsyncMock()
            mock_provider.fetch_posts.return_value = [
                RawContentItem(
                    source=SentimentSource.TWITTER,
                    content_type=ContentType.TWEET,
                    content="$AAPL stock is looking great! Strong buy recommendation. #investing #stocks",
                    published_at=datetime.utcnow(),
                    source_url="https://twitter.com/user/status/123",
                    source_id="tweet-123"
                ),
                RawContentItem(
                    source=SentimentSource.TWITTER,
                    content_type=ContentType.TWEET,
                    content="Just had coffee",  # Non-financial content
                    published_at=datetime.utcnow(),
                    source_url="https://twitter.com/user/status/124",
                    source_id="tweet-124"
                )
            ]
            mock_provider.close = AsyncMock()
            mock_factory.return_value = mock_provider

            job = await service.start_ingestion_job(
                sources=[social_configs[0]],  # Twitter only
                keywords=["AAPL", "stocks"],
                job_type="filter_test"
            )

            # Should complete successfully with filtered content
            assert job.status == IngestionStatus.COMPLETED
            assert job.items_processed >= 1  # At least financial content should be processed

    @pytest.mark.asyncio
    async def test_reddit_subreddit_integration(self, redis_service_mock):
        """Test Reddit subreddit data ingestion"""
        config = DataSourceConfig(
            source=SentimentSource.REDDIT,
            enabled=True,
            api_key="test_client_id",
            api_secret="test_secret"
        )

        # Mock PRAW Reddit client
        with patch('app.services.social_media_providers.praw.Reddit') as mock_reddit_class:
            mock_reddit = Mock()
            mock_subreddit = Mock()
            mock_submission = Mock()

            # Configure mock submission
            mock_submission.title = "AAPL Discussion"
            mock_submission.selftext = "What do you think about Apple's recent earnings?"
            mock_submission.author = "test_user"
            mock_submission.created_utc = datetime.utcnow().timestamp()
            mock_submission.permalink = "/r/stocks/comments/123/aapl_discussion"
            mock_submission.id = "123"
            mock_submission.score = 50
            mock_submission.upvote_ratio = 0.85
            mock_submission.num_comments = 25
            mock_submission.is_self = True
            mock_submission.link_flair_text = "Discussion"

            # Mock comments
            mock_comment = Mock()
            mock_comment.body = "I think AAPL is a great long-term investment"
            mock_comment.author = "comment_user"
            mock_comment.created_utc = datetime.utcnow().timestamp()
            mock_comment.score = 10
            mock_comment.id = "comment_123"

            mock_submission.comments = [mock_comment]
            mock_submission.comments.replace_more.return_value = None

            mock_subreddit.hot.return_value = [mock_submission]
            mock_reddit.subreddit.return_value = mock_subreddit
            mock_reddit_class.return_value = mock_reddit

            provider = RedditProvider(config, None, None)
            provider.rate_limiter = Mock()
            provider.rate_limiter.is_allowed = AsyncMock(return_value=(True, 50, 1234567890))
            provider.deduplicator = Mock()
            provider.deduplicator.is_duplicate = AsyncMock(return_value=False)
            provider.deduplicator.mark_processed = AsyncMock()

            posts = await provider.fetch_posts(
                keywords=["AAPL"],
                limit=10
            )

            # Should extract both post and comment
            assert len(posts) >= 1

            # Check that posts have expected structure
            for post in posts:
                assert hasattr(post, 'content')
                assert hasattr(post, 'source')
                assert post.source == SentimentSource.REDDIT


class TestNLPPipelineIntegration:
    """Integration tests for NLP pipeline with ingested content"""

    @pytest.fixture
    def redis_service_mock(self):
        """Mock Redis service"""
        mock_redis = AsyncMock()
        mock_redis.get_redis.return_value.__aenter__.return_value = AsyncMock()
        return mock_redis

    @pytest.fixture
    def sample_ingested_content(self):
        """Sample content items as they would come from ingestion"""
        return [
            RawContentItem(
                source=SentimentSource.NEWS_API,
                content_type=ContentType.ARTICLE,
                title="Apple Inc. Reports Record Quarterly Revenue",
                content="Apple Inc. (AAPL) today announced financial results for its fiscal 2024 first quarter ended December 30, 2023. The Company posted quarterly revenue of $119.6 billion, up 2 percent year over year. CEO Tim Cook commented on the strong performance across all product categories.",
                published_at=datetime.utcnow(),
                source_url="https://apple.com/newsroom/2024/02/apple-reports-first-quarter-results/",
                source_id="apple-q1-2024"
            ),
            RawContentItem(
                source=SentimentSource.TWITTER,
                content_type=ContentType.TWEET,
                content="$TSLA deliveries beat expectations! Elon Musk continues to drive innovation in the EV space. Bullish on Tesla's future prospects. #TSLA #ElectricVehicles",
                published_at=datetime.utcnow() - timedelta(hours=2),
                source_url="https://twitter.com/investor/status/123456789",
                source_id="tweet-123456789"
            ),
            RawContentItem(
                source=SentimentSource.REDDIT,
                content_type=ContentType.REDDIT_POST,
                content="Microsoft Corporation (MSFT) just announced a new partnership with OpenAI. This could be huge for their cloud business. What do you think about MSFT's AI strategy?",
                published_at=datetime.utcnow() - timedelta(hours=4),
                source_url="https://reddit.com/r/investing/comments/abc123/microsoft_openai_partnership",
                source_id="reddit-abc123"
            )
        ]

    @pytest.mark.asyncio
    async def test_end_to_end_nlp_processing(self, redis_service_mock, sample_ingested_content):
        """Test end-to-end NLP processing of ingested content"""
        pipeline = NLPPipeline(redis_service_mock)

        # Mock ticker validation and company name lookup
        with patch.object(pipeline.ticker_mapper, '_validate_ticker', return_value=True):
            with patch.object(pipeline.ticker_mapper, '_get_company_name') as mock_company_name:
                mock_company_name.side_effect = lambda ticker: {
                    'AAPL': 'Apple Inc.',
                    'TSLA': 'Tesla, Inc.',
                    'MSFT': 'Microsoft Corporation'
                }.get(ticker, 'Unknown Company')

                results = await pipeline.batch_process_content(sample_ingested_content)

                assert len(results) == len(sample_ingested_content)

                for i, result in enumerate(results):
                    content_item = sample_ingested_content[i]

                    # Should have processed successfully
                    assert 'error' not in result
                    assert result['content_id'] == content_item.content_id

                    # Should have extracted entities
                    assert len(result['entities']) > 0

                    # Should have sentiment analysis
                    assert result['sentiment_score'] is not None
                    assert hasattr(result['sentiment_score'], 'compound_score')
                    assert hasattr(result['sentiment_score'], 'polarity')

                    # Should have processing metadata
                    assert 'processing_time_ms' in result['processing_metadata']

    @pytest.mark.asyncio
    async def test_ticker_mapping_accuracy(self, redis_service_mock, sample_ingested_content):
        """Test accuracy of ticker mapping in real content"""
        pipeline = NLPPipeline(redis_service_mock)

        with patch.object(pipeline.ticker_mapper, '_validate_ticker', return_value=True):
            with patch.object(pipeline.ticker_mapper, '_get_company_name', return_value="Test Company"):
                results = await pipeline.batch_process_content(sample_ingested_content)

                expected_tickers = {'AAPL', 'TSLA', 'MSFT'}
                found_tickers = set()

                for result in results:
                    for mapping in result['ticker_mappings']:
                        found_tickers.add(mapping.ticker_symbol)

                # Should find at least some of the expected tickers
                assert len(found_tickers.intersection(expected_tickers)) > 0

    @pytest.mark.asyncio
    async def test_entity_sentiment_correlation(self, redis_service_mock, sample_ingested_content):
        """Test that entity-specific sentiment correlates with overall sentiment"""
        pipeline = NLPPipeline(redis_service_mock)

        with patch.object(pipeline.ticker_mapper, '_validate_ticker', return_value=True):
            with patch.object(pipeline.ticker_mapper, '_get_company_name', return_value="Test Company"):
                results = await pipeline.batch_process_content(sample_ingested_content)

                for result in results:
                    overall_sentiment = result['sentiment_score'].compound_score
                    entity_sentiments = result['entity_sentiments']

                    if entity_sentiments:
                        # Entity sentiments should generally correlate with overall sentiment
                        avg_entity_sentiment = sum(es.sentiment_score for es in entity_sentiments) / len(entity_sentiments)

                        # Both should have the same general direction (positive/negative)
                        if abs(overall_sentiment) > 0.1 and abs(avg_entity_sentiment) > 0.1:
                            assert (overall_sentiment > 0) == (avg_entity_sentiment > 0)


class TestSentimentAggregationIntegration:
    """Integration tests for sentiment aggregation with real pipeline data"""

    @pytest.fixture
    def redis_service_mock(self):
        """Mock Redis service"""
        mock_redis = AsyncMock()
        mock_redis_connection = AsyncMock()
        mock_redis.get_redis.return_value.__aenter__.return_value = mock_redis_connection

        # Mock cache operations
        mock_redis_connection.get.return_value = None  # No cached data
        mock_redis_connection.setex.return_value = None

        return mock_redis

    @pytest.fixture
    def mock_sentiment_data(self):
        """Mock sentiment data as it would come from NLP pipeline"""
        return [
            {
                'sentiment_score': 0.6,
                'confidence_score': 0.8,
                'source': SentimentSource.NEWS_API.value,
                'polarity': SentimentPolarity.POSITIVE.value,
                'published_at': datetime.utcnow() - timedelta(minutes=30),
                'content': 'Positive news about AAPL stock performance',
                'entity_relevance_score': 0.9
            },
            {
                'sentiment_score': 0.3,
                'confidence_score': 0.7,
                'source': SentimentSource.TWITTER.value,
                'polarity': SentimentPolarity.POSITIVE.value,
                'published_at': datetime.utcnow() - timedelta(minutes=15),
                'content': 'AAPL looking good for long term investment',
                'entity_relevance_score': 0.6
            },
            {
                'sentiment_score': -0.2,
                'confidence_score': 0.6,
                'source': SentimentSource.REDDIT.value,
                'polarity': SentimentPolarity.NEGATIVE.value,
                'published_at': datetime.utcnow() - timedelta(minutes=10),
                'content': 'Some concerns about AAPL outlook',
                'entity_relevance_score': 0.7
            }
        ]

    @pytest.mark.asyncio
    async def test_sentiment_aggregation_pipeline(self, redis_service_mock, mock_sentiment_data):
        """Test complete sentiment aggregation pipeline"""
        service = SentimentAggregationService(redis_service_mock)

        # Mock the data fetching method
        with patch.object(service, '_fetch_sentiment_data', return_value=mock_sentiment_data):
            aggregation = await service.aggregate_sentiment_for_ticker(
                ticker_symbol="AAPL",
                time_period="1h"
            )

            # Should have aggregated the data correctly
            assert aggregation.ticker_symbol == "AAPL"
            assert aggregation.mention_count == len(mock_sentiment_data)
            assert aggregation.unique_sources == 3  # NEWS_API, TWITTER, REDDIT

            # Should have calculated weighted sentiment
            assert aggregation.weighted_sentiment != 0  # Should be non-zero with mixed sentiment

            # Should have confidence metrics
            assert 0 <= aggregation.overall_confidence <= 1
            assert 0 <= aggregation.data_quality_score <= 1

    @pytest.mark.asyncio
    async def test_multi_ticker_aggregation(self, redis_service_mock, mock_sentiment_data):
        """Test aggregation across multiple tickers"""
        service = SentimentAggregationService(redis_service_mock)

        tickers = ["AAPL", "TSLA", "MSFT"]

        with patch.object(service, '_fetch_sentiment_data') as mock_fetch:
            # Return different data for each ticker
            mock_fetch.side_effect = [
                mock_sentiment_data,  # AAPL data
                [],  # TSLA - no data
                mock_sentiment_data[:1]  # MSFT - limited data
            ]

            aggregations = await service.get_multi_ticker_sentiment(tickers)

            assert len(aggregations) == len(tickers)

            # AAPL should have data
            assert aggregations["AAPL"].mention_count > 0

            # TSLA should have empty aggregation
            assert aggregations["TSLA"].mention_count == 0

            # MSFT should have limited data
            assert aggregations["MSFT"].mention_count == 1

    @pytest.mark.asyncio
    async def test_sentiment_trend_analysis(self, redis_service_mock):
        """Test sentiment trend analysis over time"""
        service = SentimentAggregationService(redis_service_mock)

        # Mock different sentiment data for different time periods
        def mock_fetch_by_time(ticker_symbol, start_time, end_time):
            # Simulate improving sentiment over time
            base_time = datetime.utcnow()
            if start_time < base_time - timedelta(hours=2):
                return [{'sentiment_score': -0.3, 'source': 'news_api', 'polarity': 'negative', 'published_at': start_time, 'confidence_score': 0.7}]
            elif start_time < base_time - timedelta(hours=1):
                return [{'sentiment_score': 0.1, 'source': 'twitter', 'polarity': 'neutral', 'published_at': start_time, 'confidence_score': 0.6}]
            else:
                return [{'sentiment_score': 0.5, 'source': 'reddit', 'polarity': 'positive', 'published_at': start_time, 'confidence_score': 0.8}]

        with patch.object(service, '_fetch_sentiment_data', side_effect=mock_fetch_by_time):
            trend_data = await service.get_sentiment_trend(
                ticker_symbol="AAPL",
                time_period="1h",
                periods_back=3
            )

            assert len(trend_data) == 3

            # Should show improving sentiment over time (chronological order)
            sentiments = [agg.average_sentiment for agg in trend_data]
            assert sentiments[0] < sentiments[-1]  # Should be improving


class TestBackfillIntegration:
    """Integration tests for sentiment data backfill system"""

    @pytest.fixture
    def redis_service_mock(self):
        """Mock Redis service"""
        mock_redis = AsyncMock()
        mock_redis.get_redis.return_value.__aenter__.return_value = AsyncMock()
        return mock_redis

    @pytest.mark.asyncio
    async def test_complete_backfill_workflow(self, redis_service_mock):
        """Test complete backfill workflow integration"""
        service = SentimentBackfillService(redis_service_mock)

        # Create backfill job
        job_id = await service.create_backfill_job(
            ticker_symbols=["AAPL", "TSLA"],
            sources=[SentimentSource.NEWS_API, SentimentSource.TWITTER],
            start_date=datetime.utcnow() - timedelta(days=2),
            end_date=datetime.utcnow(),
            strategy=BackfillStrategy.SEQUENTIAL,
            priority=BackfillPriority.HIGH
        )

        assert job_id is not None

        # Mock the ingestion services to return empty results
        with patch('app.services.sentiment_backfill_service.NewsIngestionService') as mock_news_service:
            with patch('app.services.sentiment_backfill_service.SocialMediaIngestionService') as mock_social_service:
                mock_news_service.return_value.start_ingestion_job = AsyncMock(return_value=Mock(
                    status=IngestionStatus.COMPLETED,
                    items_processed=10,
                    items_succeeded=10,
                    items_failed=0
                ))
                mock_social_service.return_value.start_ingestion_job = AsyncMock(return_value=Mock(
                    status=IngestionStatus.COMPLETED,
                    items_processed=5,
                    items_succeeded=5,
                    items_failed=0
                ))

                # Execute backfill
                progress = await service.execute_backfill_job(job_id)

                # Should complete successfully
                assert progress.status == IngestionStatus.COMPLETED
                assert progress.sources_completed == 2
                assert progress.items_processed >= 0

    @pytest.mark.asyncio
    async def test_backfill_error_recovery(self, redis_service_mock):
        """Test backfill error recovery and retry logic"""
        service = SentimentBackfillService(redis_service_mock)

        job_id = await service.create_backfill_job(
            ticker_symbols=["AAPL"],
            sources=[SentimentSource.NEWS_API],
            start_date=datetime.utcnow() - timedelta(days=1),
            end_date=datetime.utcnow(),
            strategy=BackfillStrategy.SEQUENTIAL
        )

        # Mock service to fail initially
        with patch('app.services.sentiment_backfill_service.NewsIngestionService') as mock_service:
            mock_service.return_value.start_ingestion_job.side_effect = Exception("API Error")

            # Should handle error gracefully
            progress = await service.execute_backfill_job(job_id)

            # Job should fail but not crash
            assert progress.status == IngestionStatus.FAILED
            assert "API Error" in str(progress.error_summary)

    @pytest.mark.asyncio
    async def test_backfill_job_monitoring(self, redis_service_mock):
        """Test backfill job progress monitoring"""
        service = SentimentBackfillService(redis_service_mock)

        job_id = await service.create_backfill_job(
            ticker_symbols=["AAPL"],
            sources=[SentimentSource.NEWS_API],
            start_date=datetime.utcnow() - timedelta(days=1),
            end_date=datetime.utcnow()
        )

        # Check initial status
        status = await service.get_job_status(job_id)
        assert status is not None
        assert status.status == IngestionStatus.PENDING

        # Cancel job
        cancelled = await service.cancel_backfill_job(job_id)
        assert cancelled is True

        # Check final status
        final_status = await service.get_job_status(job_id)
        if final_status:  # May be cleaned up
            assert final_status.status == IngestionStatus.FAILED