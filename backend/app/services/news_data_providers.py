"""
News Data Source Providers

This module provides data ingestion services for various news sources with
rate limiting, deduplication, and error handling capabilities.
"""

import asyncio
import hashlib
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any, Tuple
import aiohttp
import feedparser
from urllib.parse import urlparse, parse_qs

from app.core.config import settings
from app.core.logging import logger
from app.models.sentiment_ingestion_models import (
    RawContentItem,
    SentimentSource,
    ContentType,
    IngestionStatus,
    DataSourceConfig,
    IngestionJob
)
from app.services.redis_service import RedisService


class RateLimiter:
    """Redis-based distributed rate limiter for API calls"""

    def __init__(self, redis_service: RedisService):
        self.redis = redis_service

    async def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, int, int]:
        """
        Check if request is allowed under rate limit
        Returns: (allowed, remaining_requests, reset_time)
        """
        now = int(time.time())
        window_start = now - window_seconds

        async with self.redis.get_redis() as redis:
            # Remove expired entries
            await redis.zremrangebyscore(key, 0, window_start)

            # Count current requests in window
            current_count = await redis.zcard(key)

            if current_count >= max_requests:
                # Get earliest request to calculate reset time
                earliest = await redis.zrange(key, 0, 0, withscores=True)
                reset_time = int(earliest[0][1]) + window_seconds if earliest else now + window_seconds
                return False, 0, reset_time

            # Add current request
            await redis.zadd(key, {str(now): now})
            await redis.expire(key, window_seconds)

            remaining = max_requests - current_count - 1
            reset_time = now + window_seconds

            return True, remaining, reset_time


class ContentDeduplicator:
    """Handles content deduplication using content hashing"""

    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self.hash_expiry = 86400 * 7  # 7 days

    def generate_content_hash(self, content: str, title: str = "") -> str:
        """Generate hash for content deduplication"""
        # Normalize content for hashing
        normalized = (title + " " + content).lower().strip()
        # Remove common variations
        normalized = " ".join(normalized.split())
        return hashlib.sha256(normalized.encode()).hexdigest()

    async def is_duplicate(self, content_hash: str) -> bool:
        """Check if content already exists"""
        async with self.redis.get_redis() as redis:
            exists = await redis.exists(f"content_hash:{content_hash}")
            return bool(exists)

    async def mark_processed(self, content_hash: str) -> None:
        """Mark content as processed to prevent future duplicates"""
        async with self.redis.get_redis() as redis:
            await redis.setex(
                f"content_hash:{content_hash}",
                self.hash_expiry,
                int(time.time())
            )


class BaseNewsProvider(ABC):
    """Abstract base class for news data providers"""

    def __init__(
        self,
        config: DataSourceConfig,
        rate_limiter: RateLimiter,
        deduplicator: ContentDeduplicator
    ):
        self.config = config
        self.rate_limiter = rate_limiter
        self.deduplicator = deduplicator
        self.source = config.source

    @abstractmethod
    async def fetch_articles(
        self,
        keywords: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[RawContentItem]:
        """Fetch articles from the news source"""
        pass

    async def _check_rate_limit(self) -> bool:
        """Check if API call is allowed under rate limits"""
        key = f"rate_limit:{self.source.value}"
        allowed, remaining, reset_time = await self.rate_limiter.is_allowed(
            key,
            self.config.rate_limit_requests,
            self.config.rate_limit_period
        )

        if not allowed:
            logger.warning(
                f"Rate limit exceeded for {self.source.value}. "
                f"Reset at {datetime.fromtimestamp(reset_time)}"
            )

        return allowed

    async def _is_duplicate_content(self, title: str, content: str) -> bool:
        """Check if content is duplicate"""
        content_hash = self.deduplicator.generate_content_hash(content, title)
        return await self.deduplicator.is_duplicate(content_hash)

    async def _mark_content_processed(self, title: str, content: str) -> None:
        """Mark content as processed"""
        content_hash = self.deduplicator.generate_content_hash(content, title)
        await self.deduplicator.mark_processed(content_hash)


class NewsAPIProvider(BaseNewsProvider):
    """News API (newsapi.org) provider"""

    def __init__(self, config: DataSourceConfig, rate_limiter: RateLimiter, deduplicator: ContentDeduplicator):
        super().__init__(config, rate_limiter, deduplicator)
        self.base_url = "https://newsapi.org/v2"
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if not self.session:
            headers = {
                "X-API-Key": self.config.api_key,
                "User-Agent": "TurtleTrading/1.0"
            }
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(headers=headers, timeout=timeout)
        return self.session

    async def fetch_articles(
        self,
        keywords: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[RawContentItem]:
        """Fetch articles from News API"""
        if not await self._check_rate_limit():
            return []

        articles = []
        session = await self._get_session()

        # Build query
        query = " OR ".join(f'"{keyword}"' for keyword in keywords)
        params = {
            "q": query,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": min(limit, 100),  # API limit
            "domains": "bloomberg.com,reuters.com,cnbc.com,marketwatch.com,yahoo.com"
        }

        if start_date:
            params["from"] = start_date.isoformat()
        if end_date:
            params["to"] = end_date.isoformat()

        try:
            async with session.get(f"{self.base_url}/everything", params=params) as response:
                if response.status == 200:
                    data = await response.json()

                    for article_data in data.get("articles", []):
                        # Skip articles without content
                        if not article_data.get("content") or article_data.get("content") == "[Removed]":
                            continue

                        title = article_data.get("title", "")
                        content = article_data.get("content", "")

                        # Check for duplicates
                        if await self._is_duplicate_content(title, content):
                            continue

                        # Parse published date
                        published_str = article_data.get("publishedAt")
                        published_at = datetime.fromisoformat(published_str.replace('Z', '+00:00'))

                        article = RawContentItem(
                            source=SentimentSource.NEWS_API,
                            content_type=ContentType.ARTICLE,
                            title=title,
                            content=content,
                            author=article_data.get("author"),
                            published_at=published_at,
                            source_url=article_data.get("url"),
                            source_id=hashlib.md5(article_data.get("url", "").encode()).hexdigest(),
                            metadata={
                                "description": article_data.get("description"),
                                "source_name": article_data.get("source", {}).get("name"),
                                "url_to_image": article_data.get("urlToImage")
                            }
                        )

                        articles.append(article)
                        await self._mark_content_processed(title, content)

                elif response.status == 429:
                    logger.warning(f"Rate limited by News API: {response.status}")
                else:
                    logger.error(f"News API error: {response.status} - {await response.text()}")

        except Exception as e:
            logger.error(f"Error fetching from News API: {str(e)}")

        return articles

    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()


class YahooFinanceNewsProvider(BaseNewsProvider):
    """Yahoo Finance RSS news provider"""

    async def fetch_articles(
        self,
        keywords: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[RawContentItem]:
        """Fetch articles from Yahoo Finance RSS feeds"""
        if not await self._check_rate_limit():
            return []

        articles = []

        # Yahoo Finance RSS feeds for different topics
        feeds = [
            "https://feeds.finance.yahoo.com/rss/2.0/headline",
            "https://feeds.finance.yahoo.com/rss/2.0/topstories"
        ]

        for feed_url in feeds:
            try:
                # Parse RSS feed (feedparser handles HTTP fetching)
                feed = feedparser.parse(feed_url)

                for entry in feed.entries[:limit]:
                    title = entry.get("title", "")
                    summary = entry.get("summary", "")

                    # Filter by keywords if specified
                    if keywords:
                        content_text = (title + " " + summary).lower()
                        if not any(keyword.lower() in content_text for keyword in keywords):
                            continue

                    # Check for duplicates
                    if await self._is_duplicate_content(title, summary):
                        continue

                    # Parse published date
                    published_at = datetime.now()
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        published_at = datetime(*entry.published_parsed[:6])

                    # Filter by date range
                    if start_date and published_at < start_date:
                        continue
                    if end_date and published_at > end_date:
                        continue

                    article = RawContentItem(
                        source=SentimentSource.YAHOO_FINANCE,
                        content_type=ContentType.ARTICLE,
                        title=title,
                        content=summary,
                        published_at=published_at,
                        source_url=entry.get("link"),
                        source_id=entry.get("id", entry.get("link", "")),
                        metadata={
                            "feed_url": feed_url,
                            "tags": [tag.term for tag in getattr(entry, 'tags', [])]
                        }
                    )

                    articles.append(article)
                    await self._mark_content_processed(title, summary)

                    if len(articles) >= limit:
                        break

            except Exception as e:
                logger.error(f"Error fetching from Yahoo Finance RSS {feed_url}: {str(e)}")

        return articles


class CNBCNewsProvider(BaseNewsProvider):
    """CNBC RSS news provider"""

    async def fetch_articles(
        self,
        keywords: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[RawContentItem]:
        """Fetch articles from CNBC RSS feeds"""
        if not await self._check_rate_limit():
            return []

        articles = []

        # CNBC RSS feeds
        feeds = {
            "top_news": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
            "markets": "https://www.cnbc.com/id/20910258/device/rss/rss.html",
            "earnings": "https://www.cnbc.com/id/15839135/device/rss/rss.html",
            "economy": "https://www.cnbc.com/id/20910129/device/rss/rss.html"
        }

        for feed_name, feed_url in feeds.items():
            try:
                feed = feedparser.parse(feed_url)

                for entry in feed.entries[:limit]:
                    title = entry.get("title", "")
                    summary = entry.get("summary", "")

                    # Filter by keywords if specified
                    if keywords:
                        content_text = (title + " " + summary).lower()
                        if not any(keyword.lower() in content_text for keyword in keywords):
                            continue

                    # Check for duplicates
                    if await self._is_duplicate_content(title, summary):
                        continue

                    # Parse published date
                    published_at = datetime.now()
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        published_at = datetime(*entry.published_parsed[:6])

                    # Filter by date range
                    if start_date and published_at < start_date:
                        continue
                    if end_date and published_at > end_date:
                        continue

                    article = RawContentItem(
                        source=SentimentSource.CNBC,
                        content_type=ContentType.ARTICLE,
                        title=title,
                        content=summary,
                        published_at=published_at,
                        source_url=entry.get("link"),
                        source_id=entry.get("id", entry.get("link", "")),
                        metadata={
                            "feed_name": feed_name,
                            "feed_url": feed_url
                        }
                    )

                    articles.append(article)
                    await self._mark_content_processed(title, summary)

                    if len(articles) >= limit:
                        break

            except Exception as e:
                logger.error(f"Error fetching from CNBC RSS {feed_url}: {str(e)}")

        return articles


class NewsProviderFactory:
    """Factory for creating news providers"""

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.rate_limiter = RateLimiter(redis_service)
        self.deduplicator = ContentDeduplicator(redis_service)

    def create_provider(self, config: DataSourceConfig) -> BaseNewsProvider:
        """Create appropriate news provider based on source"""
        providers = {
            SentimentSource.NEWS_API: NewsAPIProvider,
            SentimentSource.YAHOO_FINANCE: YahooFinanceNewsProvider,
            SentimentSource.CNBC: CNBCNewsProvider,
        }

        provider_class = providers.get(config.source)
        if not provider_class:
            raise ValueError(f"Unsupported news source: {config.source}")

        return provider_class(config, self.rate_limiter, self.deduplicator)


class NewsIngestionService:
    """Main service for coordinating news data ingestion"""

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.factory = NewsProviderFactory(redis_service)
        self.active_jobs: Dict[str, IngestionJob] = {}

    async def start_ingestion_job(
        self,
        sources: List[DataSourceConfig],
        keywords: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        job_type: str = "realtime"
    ) -> IngestionJob:
        """Start a new ingestion job"""
        job = IngestionJob(
            source=sources[0].source,  # Primary source for job tracking
            job_type=job_type,
            status=IngestionStatus.PROCESSING,
            configuration={
                "sources": [s.source.value for s in sources],
                "keywords": keywords,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            }
        )

        self.active_jobs[job.job_id] = job

        try:
            all_articles = []

            for config in sources:
                if not config.enabled:
                    continue

                provider = self.factory.create_provider(config)

                try:
                    articles = await provider.fetch_articles(
                        keywords=keywords,
                        start_date=start_date,
                        end_date=end_date,
                        limit=100  # Per source limit
                    )

                    all_articles.extend(articles)
                    job.items_succeeded += len(articles)

                    # Close provider session if needed
                    if hasattr(provider, 'close'):
                        await provider.close()

                except Exception as e:
                    logger.error(f"Error in provider {config.source}: {str(e)}")
                    job.items_failed += 1

            job.items_processed = len(all_articles)
            job.status = IngestionStatus.COMPLETED
            job.end_time = datetime.utcnow()

            logger.info(
                f"Ingestion job {job.job_id} completed: "
                f"{job.items_processed} items processed, "
                f"{job.items_succeeded} succeeded, "
                f"{job.items_failed} failed"
            )

        except Exception as e:
            job.status = IngestionStatus.FAILED
            job.error_details = str(e)
            job.end_time = datetime.utcnow()
            logger.error(f"Ingestion job {job.job_id} failed: {str(e)}")

        finally:
            if job.job_id in self.active_jobs:
                del self.active_jobs[job.job_id]

        return job

    async def get_job_status(self, job_id: str) -> Optional[IngestionJob]:
        """Get status of an ingestion job"""
        return self.active_jobs.get(job_id)

    async def stop_job(self, job_id: str) -> bool:
        """Stop a running ingestion job"""
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            job.status = IngestionStatus.FAILED
            job.error_details = "Job stopped by user"
            job.end_time = datetime.utcnow()
            del self.active_jobs[job_id]
            return True
        return False