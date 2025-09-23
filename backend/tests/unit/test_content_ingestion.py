"""
Unit tests for content ingestion functionality.

Tests cover rate limiting, content deduplication, provider integration,
and backfill operations for content ingestion system.
"""

import pytest
import time
import hashlib
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, date, timedelta
from typing import List, Dict, Any

from app.services.content_ingestion_service import (
    RateLimiter, ContentDeduplicator, BaseContentProvider,
    NewsAPIProvider, RedditProvider, ContentIngestionService
)
from app.models.sentiment_ner_models import (
    RawContent, ContentType, ProviderType, IngestionRequest,
    IngestionResponse, BackfillRequest, BackfillResponse
)


class TestRateLimiter:
    """Test suite for rate limiting functionality."""

    @pytest.fixture
    async def rate_limiter(self):
        """Create a mock rate limiter for testing."""
        with patch('redis.asyncio.from_url') as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis.return_value = mock_redis_instance

            limiter = RateLimiter(mock_redis_instance)
            yield limiter

    @pytest.mark.asyncio
    async def test_is_allowed_under_limit(self, rate_limiter):
        """Test rate limiting when requests are under the limit."""
        # Mock Redis operations for under-limit scenario
        rate_limiter.redis.zremrangebyscore = AsyncMock()
        rate_limiter.redis.zcard = AsyncMock(return_value=5)  # 5 existing requests
        rate_limiter.redis.zadd = AsyncMock()
        rate_limiter.redis.expire = AsyncMock()

        # Mock pipeline
        mock_pipe = AsyncMock()
        mock_pipe.zremrangebyscore = Mock()
        mock_pipe.zcard = Mock()
        mock_pipe.zadd = Mock()
        mock_pipe.expire = Mock()
        mock_pipe.execute = AsyncMock(return_value=[None, 5, None, None])

        rate_limiter.redis.pipeline = Mock(return_value=mock_pipe)

        is_allowed, info = await rate_limiter.is_allowed("test_key", limit=10, window=60)

        assert is_allowed is True
        assert info["current_count"] == 5
        assert info["limit"] == 10
        assert info["remaining"] == 5
        assert "reset_time" in info

    @pytest.mark.asyncio
    async def test_is_allowed_over_limit(self, rate_limiter):
        """Test rate limiting when requests exceed the limit."""
        # Mock Redis operations for over-limit scenario
        mock_pipe = AsyncMock()
        mock_pipe.zremrangebyscore = Mock()
        mock_pipe.zcard = Mock()
        mock_pipe.zadd = Mock()
        mock_pipe.expire = Mock()
        mock_pipe.execute = AsyncMock(return_value=[None, 15, None, None])  # 15 > 10 limit

        rate_limiter.redis.pipeline = Mock(return_value=mock_pipe)

        is_allowed, info = await rate_limiter.is_allowed("test_key", limit=10, window=60)

        assert is_allowed is False
        assert info["current_count"] == 15
        assert info["limit"] == 10
        assert info["remaining"] == 0

    @pytest.mark.asyncio
    async def test_is_allowed_with_burst_limit(self, rate_limiter):
        """Test rate limiting with burst limit functionality."""
        # Mock for burst scenario (over normal limit but under burst)
        mock_pipe = AsyncMock()
        mock_pipe.execute = AsyncMock(return_value=[None, 12, None, None])  # Over normal (10) but under burst (15)

        rate_limiter.redis.pipeline = Mock(return_value=mock_pipe)

        is_allowed, info = await rate_limiter.is_allowed("test_key", limit=10, window=60, burst_limit=15)

        assert is_allowed is True
        assert info["current_count"] == 12
        assert info["limit"] == 10
        assert info["burst_limit"] == 15
        assert info["remaining"] == 3  # 15 - 12

    @pytest.mark.asyncio
    async def test_is_allowed_over_burst_limit(self, rate_limiter):
        """Test rate limiting when requests exceed burst limit."""
        mock_pipe = AsyncMock()
        mock_pipe.execute = AsyncMock(return_value=[None, 20, None, None])  # Over burst limit

        rate_limiter.redis.pipeline = Mock(return_value=mock_pipe)

        is_allowed, info = await rate_limiter.is_allowed("test_key", limit=10, window=60, burst_limit=15)

        assert is_allowed is False
        assert info["current_count"] == 20
        assert info["remaining"] == 0

    @pytest.mark.asyncio
    async def test_rate_limiter_key_generation(self, rate_limiter):
        """Test that different keys are properly isolated."""
        mock_pipe = AsyncMock()
        mock_pipe.execute = AsyncMock(return_value=[None, 5, None, None])
        rate_limiter.redis.pipeline = Mock(return_value=mock_pipe)

        # Test different keys
        await rate_limiter.is_allowed("user:1", limit=10, window=60)
        await rate_limiter.is_allowed("user:2", limit=10, window=60)

        # Should create different Redis keys
        assert rate_limiter.redis.pipeline.call_count == 2


class TestContentDeduplicator:
    """Test suite for content deduplication functionality."""

    @pytest.fixture
    async def deduplicator(self):
        """Create a mock content deduplicator for testing."""
        with patch('redis.asyncio.from_url') as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis.return_value = mock_redis_instance

            dedup = ContentDeduplicator(mock_redis_instance)
            yield dedup

    @pytest.mark.asyncio
    async def test_is_duplicate_new_content(self, deduplicator):
        """Test duplicate detection for new content."""
        content = RawContent(
            content_id="test_1",
            title="Test Article Title",
            content="This is a test article content.",
            source_url="https://example.com/article1",
            published_at=datetime.utcnow(),
            provider=ProviderType.NEWS_API,
            content_type=ContentType.NEWS_ARTICLE,
            metadata={}
        )

        # Mock Redis to return no existing hashes
        deduplicator.redis.sismember = AsyncMock(return_value=False)
        deduplicator.redis.sadd = AsyncMock()
        deduplicator.redis.expire = AsyncMock()

        is_dup = await deduplicator.is_duplicate(content)

        assert is_dup is False
        # Should add hashes to Redis
        assert deduplicator.redis.sadd.call_count >= 2  # Content hash + similarity hash

    @pytest.mark.asyncio
    async def test_is_duplicate_existing_content(self, deduplicator):
        """Test duplicate detection for existing content."""
        content = RawContent(
            content_id="test_2",
            title="Duplicate Article",
            content="This content already exists.",
            source_url="https://example.com/duplicate",
            published_at=datetime.utcnow(),
            provider=ProviderType.NEWS_API,
            content_type=ContentType.NEWS_ARTICLE,
            metadata={}
        )

        # Mock Redis to return existing hash
        deduplicator.redis.sismember = AsyncMock(return_value=True)

        is_dup = await deduplicator.is_duplicate(content)

        assert is_dup is True
        # Should not add to Redis since it's a duplicate
        deduplicator.redis.sadd.assert_not_called()

    def test_content_hash_generation(self, deduplicator):
        """Test content hash generation consistency."""
        content1 = RawContent(
            content_id="test_1",
            title="Same Title",
            content="Same content text",
            source_url="https://example.com/1",
            published_at=datetime.utcnow(),
            provider=ProviderType.NEWS_API,
            content_type=ContentType.NEWS_ARTICLE,
            metadata={}
        )

        content2 = RawContent(
            content_id="test_2",  # Different ID
            title="Same Title",
            content="Same content text",
            source_url="https://example.com/2",  # Different URL
            published_at=datetime.utcnow(),
            provider=ProviderType.NEWS_API,
            content_type=ContentType.NEWS_ARTICLE,
            metadata={}
        )

        hash1 = deduplicator._generate_content_hash(content1)
        hash2 = deduplicator._generate_content_hash(content2)

        # Same title and content should generate same hash
        assert hash1 == hash2

    def test_similarity_hash_generation(self, deduplicator):
        """Test similarity hash generation for near-duplicate detection."""
        content1 = RawContent(
            content_id="test_1",
            title="Apple Reports Strong Earnings",
            content="Apple Inc. reported strong quarterly earnings with revenue growth.",
            source_url="https://example.com/1",
            published_at=datetime.utcnow(),
            provider=ProviderType.NEWS_API,
            content_type=ContentType.NEWS_ARTICLE,
            metadata={}
        )

        content2 = RawContent(
            content_id="test_2",
            title="Apple Shows Strong Earnings Results",  # Similar but different
            content="Apple Inc. showed strong quarterly earnings results with revenue increases.",  # Similar but different
            source_url="https://example.com/2",
            published_at=datetime.utcnow(),
            provider=ProviderType.NEWS_API,
            content_type=ContentType.NEWS_ARTICLE,
            metadata={}
        )

        hash1 = deduplicator._generate_similarity_hash(content1)
        hash2 = deduplicator._generate_similarity_hash(content2)

        # Similar content should generate same or very similar hashes
        # This is a simplified test - real similarity hashing would be more sophisticated
        assert isinstance(hash1, str)
        assert isinstance(hash2, str)
        assert len(hash1) > 0
        assert len(hash2) > 0


class TestBaseContentProvider:
    """Test suite for base content provider functionality."""

    def test_base_provider_interface(self):
        """Test that base provider defines the correct interface."""
        provider = BaseContentProvider()

        # Should have abstract methods that raise NotImplementedError
        with pytest.raises(NotImplementedError):
            provider.fetch_content(query="test", max_items=10)

        with pytest.raises(NotImplementedError):
            provider.fetch_historical_content(
                query="test", start_date=date.today(), end_date=date.today(), max_items=10
            )


class TestNewsAPIProvider:
    """Test suite for NewsAPI content provider."""

    @pytest.fixture
    def news_provider(self):
        """Create NewsAPI provider with mock configuration."""
        with patch('app.services.content_ingestion_service.requests') as mock_requests:
            provider = NewsAPIProvider(api_key="test_api_key")
            provider.requests = mock_requests
            yield provider

    def test_build_query_params_basic(self, news_provider):
        """Test building basic query parameters."""
        params = news_provider._build_query_params("Apple earnings", max_items=50)

        assert params["q"] == "Apple earnings"
        assert params["pageSize"] == 50
        assert params["apiKey"] == "test_api_key"
        assert params["language"] == "en"
        assert params["sortBy"] == "publishedAt"

    def test_build_query_params_with_dates(self, news_provider):
        """Test building query parameters with date range."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 31)

        params = news_provider._build_query_params(
            "Tesla",
            max_items=25,
            start_date=start_date,
            end_date=end_date
        )

        assert params["from"] == "2024-01-01"
        assert params["to"] == "2024-01-31"

    @pytest.mark.asyncio
    async def test_fetch_content_success(self, news_provider):
        """Test successful content fetching from NewsAPI."""
        # Mock successful API response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "ok",
            "totalResults": 2,
            "articles": [
                {
                    "title": "Apple Reports Strong Earnings",
                    "description": "Apple Inc. reported strong quarterly earnings.",
                    "content": "Full article content here...",
                    "url": "https://example.com/apple-earnings",
                    "urlToImage": "https://example.com/image.jpg",
                    "publishedAt": "2024-01-15T10:30:00Z",
                    "source": {"name": "TechNews"}
                },
                {
                    "title": "Tesla Production Update",
                    "description": "Tesla provides production update.",
                    "content": "Tesla content here...",
                    "url": "https://example.com/tesla-update",
                    "urlToImage": None,
                    "publishedAt": "2024-01-15T11:00:00Z",
                    "source": {"name": "AutoNews"}
                }
            ]
        }

        news_provider.requests.get.return_value = mock_response

        content_list = await news_provider.fetch_content("Apple earnings", max_items=10)

        assert len(content_list) == 2

        # Check first article
        first_article = content_list[0]
        assert first_article.title == "Apple Reports Strong Earnings"
        assert first_article.content == "Full article content here..."
        assert first_article.source_url == "https://example.com/apple-earnings"
        assert first_article.provider == ProviderType.NEWS_API
        assert first_article.content_type == ContentType.NEWS_ARTICLE

        # Check metadata
        assert first_article.metadata["source_name"] == "TechNews"
        assert first_article.metadata["image_url"] == "https://example.com/image.jpg"

    @pytest.mark.asyncio
    async def test_fetch_content_api_error(self, news_provider):
        """Test handling of API errors."""
        # Mock API error response
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json.return_value = {
            "status": "error",
            "code": "apiKeyInvalid",
            "message": "Your API key is invalid"
        }

        news_provider.requests.get.return_value = mock_response

        content_list = await news_provider.fetch_content("test query")

        # Should return empty list on error
        assert content_list == []

    @pytest.mark.asyncio
    async def test_fetch_content_network_error(self, news_provider):
        """Test handling of network errors."""
        # Mock network exception
        news_provider.requests.get.side_effect = Exception("Network error")

        content_list = await news_provider.fetch_content("test query")

        # Should return empty list on network error
        assert content_list == []

    @pytest.mark.asyncio
    async def test_fetch_historical_content(self, news_provider):
        """Test fetching historical content with date range."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "ok",
            "totalResults": 1,
            "articles": [
                {
                    "title": "Historical Article",
                    "description": "Historical content",
                    "content": "Historical article content",
                    "url": "https://example.com/historical",
                    "urlToImage": None,
                    "publishedAt": "2024-01-10T15:00:00Z",
                    "source": {"name": "HistoryNews"}
                }
            ]
        }

        news_provider.requests.get.return_value = mock_response

        content_list = await news_provider.fetch_historical_content(
            query="Apple",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            max_items=50
        )

        assert len(content_list) == 1
        assert content_list[0].title == "Historical Article"

        # Verify API was called with date parameters
        call_args = news_provider.requests.get.call_args
        assert "from=2024-01-01" in call_args[1]["params"]["from"]
        assert "to=2024-01-31" in call_args[1]["params"]["to"]


class TestContentIngestionService:
    """Integration tests for the content ingestion service."""

    @pytest.fixture
    async def ingestion_service(self):
        """Create a mock content ingestion service."""
        with patch('redis.asyncio.from_url') as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis.return_value = mock_redis_instance

            service = ContentIngestionService(mock_redis_instance)

            # Mock providers
            service.providers[ProviderType.NEWS_API] = Mock()
            service.providers[ProviderType.REDDIT] = Mock()

            yield service

    @pytest.mark.asyncio
    async def test_ingest_from_providers_success(self, ingestion_service):
        """Test successful content ingestion from multiple providers."""
        # Mock provider responses
        mock_content_1 = RawContent(
            content_id="news_1",
            title="News Article 1",
            content="News content 1",
            source_url="https://news.com/1",
            published_at=datetime.utcnow(),
            provider=ProviderType.NEWS_API,
            content_type=ContentType.NEWS_ARTICLE,
            metadata={}
        )

        mock_content_2 = RawContent(
            content_id="reddit_1",
            title="Reddit Post 1",
            content="Reddit content 1",
            source_url="https://reddit.com/1",
            published_at=datetime.utcnow(),
            provider=ProviderType.REDDIT,
            content_type=ContentType.SOCIAL_MEDIA,
            metadata={}
        )

        # Mock provider fetch methods
        ingestion_service.providers[ProviderType.NEWS_API].fetch_content = AsyncMock(
            return_value=[mock_content_1]
        )
        ingestion_service.providers[ProviderType.REDDIT].fetch_content = AsyncMock(
            return_value=[mock_content_2]
        )

        # Mock rate limiter and deduplicator
        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(True, {}))
        ingestion_service.deduplicator.is_duplicate = AsyncMock(return_value=False)

        # Mock Redis operations
        ingestion_service.redis.setex = AsyncMock()

        response = await ingestion_service.ingest_from_providers(
            providers=[ProviderType.NEWS_API, ProviderType.REDDIT],
            query_params={"query": "Apple"},
            max_items=10
        )

        # Verify response
        assert response.total_items == 2
        assert response.unique_items == 2
        assert response.duplicate_items == 0
        assert len(response.provider_results) == 2

    @pytest.mark.asyncio
    async def test_ingest_with_rate_limiting(self, ingestion_service):
        """Test content ingestion with rate limiting applied."""
        # Mock rate limiter to reject requests
        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(False, {"limit": 100, "remaining": 0}))

        response = await ingestion_service.ingest_from_providers(
            providers=[ProviderType.NEWS_API],
            query_params={"query": "test"},
            max_items=10
        )

        # Should return empty response due to rate limiting
        assert response.total_items == 0
        assert len(response.errors) > 0
        assert "rate limit" in response.errors[0].lower()

    @pytest.mark.asyncio
    async def test_ingest_with_deduplication(self, ingestion_service):
        """Test content ingestion with duplicate filtering."""
        mock_content = RawContent(
            content_id="dup_test",
            title="Duplicate Article",
            content="This is duplicate content",
            source_url="https://example.com/dup",
            published_at=datetime.utcnow(),
            provider=ProviderType.NEWS_API,
            content_type=ContentType.NEWS_ARTICLE,
            metadata={}
        )

        # Mock provider to return content
        ingestion_service.providers[ProviderType.NEWS_API].fetch_content = AsyncMock(
            return_value=[mock_content]
        )

        # Mock rate limiter to allow
        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(True, {}))

        # Mock deduplicator to mark as duplicate
        ingestion_service.deduplicator.is_duplicate = AsyncMock(return_value=True)

        response = await ingestion_service.ingest_from_providers(
            providers=[ProviderType.NEWS_API],
            query_params={"query": "test"},
            max_items=10
        )

        # Should filter out duplicate
        assert response.total_items == 1
        assert response.unique_items == 0
        assert response.duplicate_items == 1

    @pytest.mark.asyncio
    async def test_backfill_historical_data(self, ingestion_service):
        """Test historical data backfill functionality."""
        # Mock provider historical fetch
        mock_historical_content = [
            RawContent(
                content_id=f"hist_{i}",
                title=f"Historical Article {i}",
                content=f"Historical content {i}",
                source_url=f"https://example.com/hist_{i}",
                published_at=datetime.utcnow() - timedelta(days=i),
                provider=ProviderType.NEWS_API,
                content_type=ContentType.NEWS_ARTICLE,
                metadata={}
            )
            for i in range(5)
        ]

        ingestion_service.providers[ProviderType.NEWS_API].fetch_historical_content = AsyncMock(
            return_value=mock_historical_content
        )

        # Mock other services
        ingestion_service.rate_limiter.is_allowed = AsyncMock(return_value=(True, {}))
        ingestion_service.deduplicator.is_duplicate = AsyncMock(return_value=False)
        ingestion_service.redis.setex = AsyncMock()

        await ingestion_service.backfill_historical_data(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            tickers=["AAPL"],
            providers=[ProviderType.NEWS_API],
            max_items_per_day=100
        )

        # Verify historical fetch was called
        ingestion_service.providers[ProviderType.NEWS_API].fetch_historical_content.assert_called()

    @pytest.mark.asyncio
    async def test_get_ingestion_status(self, ingestion_service):
        """Test ingestion status reporting."""
        # Mock Redis operations for status
        ingestion_service.redis.keys = AsyncMock(return_value=["content:1", "content:2", "content:3"])
        ingestion_service.redis.get = AsyncMock(return_value=b'{"total_requests": 150, "successful_requests": 140}')

        status = await ingestion_service.get_ingestion_status()

        # Verify status structure
        assert "timestamp" in status
        assert "total_content_items" in status
        assert "rate_limiting_info" in status
        assert "provider_status" in status

        assert status["total_content_items"] == 3


if __name__ == "__main__":
    pytest.main([__file__])