"""
Content Ingestion Service

This service handles ingestion of news and social media content with:
- Rate limiting and quota management
- Content deduplication using hashing
- Provider abstraction and fallbacks
- Background job processing
- Backfill and historical data ingestion
"""

import asyncio
import hashlib
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, AsyncGenerator
from concurrent.futures import ThreadPoolExecutor
import aiohttp
import redis.asyncio as aioredis
from loguru import logger

from app.models.sentiment_ner_models import (
    RawContent, ContentSource, IngestionJob, ProviderConfig, ContentType,
    ProviderType, IngestionStatus, IngestionRequest, IngestionResponse
)


class RateLimiter:
    """Advanced rate limiter with sliding window and burst support"""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    async def is_allowed(
        self,
        key: str,
        limit: int,
        window: int,
        burst_limit: Optional[int] = None
    ) -> tuple[bool, Dict[str, Any]]:
        """
        Check if request is allowed under rate limits.

        Args:
            key: Rate limit key (e.g., provider:endpoint)
            limit: Number of requests allowed in window
            window: Time window in seconds
            burst_limit: Maximum burst requests allowed

        Returns:
            (is_allowed, metadata) where metadata contains current usage
        """
        now = time.time()
        pipe = self.redis.pipeline()

        # Sliding window rate limiting
        window_start = now - window

        # Remove old entries
        pipe.zremrangebyscore(f"rate_limit:{key}", 0, window_start)

        # Count current requests
        pipe.zcard(f"rate_limit:{key}")

        # Add current request timestamp
        pipe.zadd(f"rate_limit:{key}", {str(now): now})

        # Set expiration
        pipe.expire(f"rate_limit:{key}", window + 60)

        results = await pipe.execute()
        current_count = results[1]

        # Check burst limit if specified
        if burst_limit:
            burst_key = f"burst:{key}"
            burst_count = await self.redis.get(burst_key)
            if burst_count and int(burst_count) >= burst_limit:
                return False, {
                    "allowed": False,
                    "current_count": current_count,
                    "limit": limit,
                    "burst_count": int(burst_count),
                    "burst_limit": burst_limit,
                    "retry_after": 60
                }

        is_allowed = current_count <= limit

        if not is_allowed:
            # Remove the request we just added since it's not allowed
            await self.redis.zrem(f"rate_limit:{key}", str(now))
        else:
            # Update burst counter
            if burst_limit:
                burst_key = f"burst:{key}"
                await self.redis.incr(burst_key)
                await self.redis.expire(burst_key, 60)

        metadata = {
            "allowed": is_allowed,
            "current_count": current_count,
            "limit": limit,
            "remaining": max(0, limit - current_count),
            "reset_time": now + window,
            "retry_after": window if not is_allowed else 0
        }

        return is_allowed, metadata


class ContentDeduplicator:
    """Content deduplication using multiple hashing strategies"""

    @staticmethod
    def generate_content_hash(title: str, body: str, source_url: str = "") -> str:
        """Generate exact content hash for deduplication"""
        content = f"{title.strip()}{body.strip()}{source_url.strip()}"
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    @staticmethod
    def generate_similarity_hash(title: str, body: str) -> str:
        """Generate similarity hash for near-duplicate detection"""
        # Simple similarity hash based on normalized content
        import re

        # Normalize text: lowercase, remove special chars, multiple spaces
        normalized = re.sub(r'[^\w\s]', '', f"{title} {body}".lower())
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        # Create hash from normalized content
        return hashlib.md5(normalized.encode('utf-8')).hexdigest()

    async def is_duplicate(
        self,
        redis_client: aioredis.Redis,
        content_hash: str,
        similarity_hash: str,
        ttl: int = 86400 * 7  # 7 days
    ) -> tuple[bool, str]:
        """
        Check if content is duplicate or near-duplicate.

        Returns:
            (is_duplicate, duplicate_type) where duplicate_type is 'exact' or 'similar'
        """
        # Check exact duplicate
        exact_key = f"content_hash:{content_hash}"
        if await redis_client.exists(exact_key):
            return True, "exact"

        # Check similarity duplicate
        similar_key = f"similarity_hash:{similarity_hash}"
        if await redis_client.exists(similar_key):
            return True, "similar"

        # Store hashes for future deduplication
        await redis_client.setex(exact_key, ttl, "1")
        await redis_client.setex(similar_key, ttl, "1")

        return False, "none"


class BaseContentProvider:
    """Base class for content providers"""

    def __init__(self, config: ProviderConfig, rate_limiter: RateLimiter):
        self.config = config
        self.rate_limiter = rate_limiter
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def fetch_content(
        self,
        query: Optional[str] = None,
        tickers: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        max_items: int = 100
    ) -> AsyncGenerator[RawContent, None]:
        """Fetch content from provider - to be implemented by subclasses"""
        raise NotImplementedError("Subclasses must implement fetch_content")

    async def _check_rate_limit(self, endpoint: str) -> bool:
        """Check rate limit for specific endpoint"""
        key = f"{self.config.provider}:{endpoint}"
        is_allowed, metadata = await self.rate_limiter.is_allowed(
            key=key,
            limit=self.config.requests_per_minute,
            window=60,
            burst_limit=self.config.burst_limit
        )

        if not is_allowed:
            logger.warning(f"Rate limit hit for {key}: {metadata}")

        return is_allowed

    async def _make_request(
        self,
        url: str,
        params: Dict[str, Any] = None,
        headers: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """Make HTTP request with error handling and retries"""
        if not self.session:
            raise RuntimeError("Session not initialized")

        default_headers = {
            'User-Agent': 'TurtleTrading/1.0',
            'Accept': 'application/json'
        }

        if headers:
            default_headers.update(headers)

        if self.config.api_key:
            default_headers['Authorization'] = f'Bearer {self.config.api_key}'

        for attempt in range(self.config.max_retries + 1):
            try:
                async with self.session.get(
                    url,
                    params=params,
                    headers=default_headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 429:  # Rate limited
                        retry_after = int(response.headers.get('Retry-After', 60))
                        logger.warning(f"Rate limited by {self.config.provider}, waiting {retry_after}s")
                        await asyncio.sleep(retry_after)
                        continue

                    response.raise_for_status()
                    return await response.json()

            except Exception as e:
                if attempt == self.config.max_retries:
                    logger.error(f"Request failed after {attempt + 1} attempts: {e}")
                    raise

                delay = self.config.retry_delay * (self.config.backoff_multiplier ** attempt)
                logger.warning(f"Request attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                await asyncio.sleep(delay)


class NewsAPIProvider(BaseContentProvider):
    """NewsAPI content provider"""

    async def fetch_content(
        self,
        query: Optional[str] = None,
        tickers: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        max_items: int = 100
    ) -> AsyncGenerator[RawContent, None]:
        """Fetch news articles from NewsAPI"""

        if not await self._check_rate_limit("everything"):
            logger.warning("Rate limit hit for NewsAPI, skipping request")
            return

        # Build query
        search_query = query or ""
        if tickers:
            ticker_query = " OR ".join(tickers)
            search_query = f"({search_query}) AND ({ticker_query})" if search_query else ticker_query

        params = {
            'q': search_query,
            'language': 'en',
            'sortBy': 'publishedAt',
            'pageSize': min(max_items, 100),
            'page': 1
        }

        if start_time:
            params['from'] = start_time.isoformat()
        if end_time:
            params['to'] = end_time.isoformat()

        try:
            url = f"{self.config.base_url}/everything"
            data = await self._make_request(url, params)

            for article in data.get('articles', []):
                # Skip articles with missing content
                if not article.get('title') or not article.get('description'):
                    continue

                content_hash = ContentDeduplicator.generate_content_hash(
                    title=article.get('title', ''),
                    body=article.get('description', ''),
                    source_url=article.get('url', '')
                )

                similarity_hash = ContentDeduplicator.generate_similarity_hash(
                    title=article.get('title', ''),
                    body=article.get('description', '')
                )

                source = ContentSource(
                    provider=ProviderType.NEWS_API,
                    provider_id=article.get('url', ''),
                    url=article.get('url'),
                    api_endpoint=url
                )

                published_at = datetime.fromisoformat(
                    article['publishedAt'].replace('Z', '+00:00')
                )

                content = RawContent(
                    content_type=ContentType.NEWS_ARTICLE,
                    source=source,
                    title=article.get('title'),
                    body=article.get('description'),
                    author=article.get('author'),
                    published_at=published_at,
                    content_hash=content_hash,
                    similarity_hash=similarity_hash
                )

                yield content

        except Exception as e:
            logger.error(f"Error fetching from NewsAPI: {e}")


class RedditProvider(BaseContentProvider):
    """Reddit content provider"""

    async def fetch_content(
        self,
        query: Optional[str] = None,
        tickers: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        max_items: int = 100
    ) -> AsyncGenerator[RawContent, None]:
        """Fetch posts from Reddit financial subreddits"""

        if not await self._check_rate_limit("search"):
            return

        # Focus on financial subreddits
        subreddits = ['stocks', 'investing', 'SecurityAnalysis', 'ValueInvesting', 'wallstreetbets']

        for subreddit in subreddits:
            try:
                search_query = query or ""
                if tickers:
                    ticker_query = " OR ".join([f"${ticker}" for ticker in tickers])
                    search_query = f"{search_query} {ticker_query}".strip()

                params = {
                    'q': search_query,
                    'sort': 'new',
                    'limit': min(max_items // len(subreddits), 25),
                    't': 'day'  # Last day
                }

                url = f"{self.config.base_url}/r/{subreddit}/search"
                data = await self._make_request(url, params)

                for post in data.get('data', {}).get('children', []):
                    post_data = post.get('data', {})

                    if not post_data.get('title') or post_data.get('is_self') is False:
                        continue

                    content_hash = ContentDeduplicator.generate_content_hash(
                        title=post_data.get('title', ''),
                        body=post_data.get('selftext', ''),
                        source_url=f"https://reddit.com{post_data.get('permalink', '')}"
                    )

                    similarity_hash = ContentDeduplicator.generate_similarity_hash(
                        title=post_data.get('title', ''),
                        body=post_data.get('selftext', '')
                    )

                    source = ContentSource(
                        provider=ProviderType.REDDIT,
                        provider_id=post_data.get('id', ''),
                        url=f"https://reddit.com{post_data.get('permalink', '')}",
                        api_endpoint=url
                    )

                    published_at = datetime.fromtimestamp(post_data.get('created_utc', 0))

                    content = RawContent(
                        content_type=ContentType.SOCIAL_POST,
                        source=source,
                        title=post_data.get('title'),
                        body=post_data.get('selftext'),
                        author=post_data.get('author'),
                        published_at=published_at,
                        content_hash=content_hash,
                        similarity_hash=similarity_hash,
                        tags=[subreddit]
                    )

                    yield content

                # Rate limiting between subreddits
                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error fetching from Reddit r/{subreddit}: {e}")


class ContentIngestionService:
    """Main content ingestion service"""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.rate_limiter = RateLimiter(redis_client)
        self.deduplicator = ContentDeduplicator()
        self.providers: Dict[ProviderType, BaseContentProvider] = {}
        self.executor = ThreadPoolExecutor(max_workers=4)

    async def register_provider(self, config: ProviderConfig):
        """Register a content provider"""
        if config.provider == ProviderType.NEWS_API:
            self.providers[config.provider] = NewsAPIProvider(config, self.rate_limiter)
        elif config.provider == ProviderType.REDDIT:
            self.providers[config.provider] = RedditProvider(config, self.rate_limiter)
        else:
            logger.warning(f"Provider {config.provider} not implemented yet")

    async def start_ingestion_job(self, request: IngestionRequest) -> IngestionResponse:
        """Start a new ingestion job"""
        job = IngestionJob(
            job_type="content_ingestion",
            provider=request.provider,
            parameters={
                "query": request.query,
                "tickers": request.tickers,
                "start_time": request.start_time.isoformat() if request.start_time else None,
                "end_time": request.end_time.isoformat() if request.end_time else None,
                "max_items": request.max_items
            },
            start_time=datetime.utcnow()
        )

        # Store job in Redis
        await self.redis.setex(
            f"ingestion_job:{job.job_id}",
            3600,  # 1 hour TTL
            job.json()
        )

        # Start background processing if requested
        if request.process_immediately:
            asyncio.create_task(self._process_ingestion_job(job))

        return IngestionResponse(
            job_id=job.job_id,
            estimated_items=request.max_items,
            estimated_duration=300,  # 5 minutes estimate
            status=IngestionStatus.PENDING
        )

    async def _process_ingestion_job(self, job: IngestionJob):
        """Process ingestion job in background"""
        try:
            job.status = IngestionStatus.PROCESSING
            await self._update_job(job)

            provider = self.providers.get(job.provider)
            if not provider:
                raise ValueError(f"Provider {job.provider} not registered")

            params = job.parameters
            start_time = datetime.fromisoformat(params["start_time"]) if params.get("start_time") else None
            end_time = datetime.fromisoformat(params["end_time"]) if params.get("end_time") else None

            processed_count = 0
            duplicate_count = 0

            async with provider:
                async for content in provider.fetch_content(
                    query=params.get("query"),
                    tickers=params.get("tickers"),
                    start_time=start_time,
                    end_time=end_time,
                    max_items=params.get("max_items", 100)
                ):
                    try:
                        # Check for duplicates
                        is_duplicate, duplicate_type = await self.deduplicator.is_duplicate(
                            self.redis,
                            content.content_hash,
                            content.similarity_hash
                        )

                        if is_duplicate:
                            duplicate_count += 1
                            logger.debug(f"Skipping {duplicate_type} duplicate: {content.title[:50]}...")
                            continue

                        # Store content
                        await self._store_content(content)
                        processed_count += 1

                        # Update job progress
                        job.items_processed = processed_count

                        if processed_count % 10 == 0:
                            await self._update_job(job)

                    except Exception as e:
                        logger.error(f"Error processing content: {e}")
                        job.items_failed += 1

            job.status = IngestionStatus.COMPLETED
            job.end_time = datetime.utcnow()
            job.results = {
                "processed": processed_count,
                "duplicates": duplicate_count,
                "failed": job.items_failed
            }

        except Exception as e:
            logger.error(f"Ingestion job {job.job_id} failed: {e}")
            job.status = IngestionStatus.FAILED
            job.error_summary = str(e)
            job.end_time = datetime.utcnow()

        finally:
            await self._update_job(job)

    async def _store_content(self, content: RawContent):
        """Store content in Redis for further processing"""
        key = f"raw_content:{content.content_id}"
        await self.redis.setex(key, 86400 * 3, content.json())  # 3 days TTL

        # Add to processing queue
        await self.redis.lpush("content_processing_queue", content.content_id)

        logger.debug(f"Stored content: {content.title[:50]}...")

    async def _update_job(self, job: IngestionJob):
        """Update job status in Redis"""
        job.updated_at = datetime.utcnow()
        await self.redis.setex(
            f"ingestion_job:{job.job_id}",
            3600,
            job.json()
        )

    async def get_job_status(self, job_id: str) -> Optional[IngestionJob]:
        """Get ingestion job status"""
        job_data = await self.redis.get(f"ingestion_job:{job_id}")
        if job_data:
            return IngestionJob.parse_raw(job_data)
        return None

    async def backfill_content(
        self,
        provider: ProviderType,
        start_date: datetime,
        end_date: datetime,
        tickers: Optional[List[str]] = None
    ) -> str:
        """Start backfill job for historical content"""
        request = IngestionRequest(
            provider=provider,
            tickers=tickers,
            start_time=start_date,
            end_time=end_date,
            max_items=1000,  # Larger batch for backfill
            process_immediately=True
        )

        response = await self.start_ingestion_job(request)
        logger.info(f"Started backfill job {response.job_id} for {provider} from {start_date} to {end_date}")

        return response.job_id

    async def get_content_stats(self) -> Dict[str, Any]:
        """Get ingestion statistics"""
        # Count items in processing queue
        queue_length = await self.redis.llen("content_processing_queue")

        # Count total stored content (approximate)
        content_keys = await self.redis.keys("raw_content:*")

        # Get rate limit stats for providers
        rate_limit_stats = {}
        for provider in ProviderType:
            key = f"rate_limit:{provider}:*"
            provider_keys = await self.redis.keys(key)
            rate_limit_stats[provider.value] = len(provider_keys)

        return {
            "queue_length": queue_length,
            "total_content": len(content_keys),
            "rate_limit_usage": rate_limit_stats,
            "timestamp": datetime.utcnow().isoformat()
        }


# Factory function for easy setup
async def create_ingestion_service(redis_url: str = "redis://localhost:6379") -> ContentIngestionService:
    """Create and configure content ingestion service"""
    redis_client = aioredis.from_url(redis_url)
    service = ContentIngestionService(redis_client)

    # Register default providers
    news_config = ProviderConfig(
        provider=ProviderType.NEWS_API,
        base_url="https://newsapi.org/v2",
        requests_per_minute=50,
        requests_per_hour=1000,
        content_types=[ContentType.NEWS_ARTICLE]
    )
    await service.register_provider(news_config)

    reddit_config = ProviderConfig(
        provider=ProviderType.REDDIT,
        base_url="https://www.reddit.com",
        requests_per_minute=30,
        requests_per_hour=500,
        content_types=[ContentType.SOCIAL_POST]
    )
    await service.register_provider(reddit_config)

    return service


if __name__ == "__main__":
    async def test_ingestion():
        """Test the ingestion service"""
        service = await create_ingestion_service()

        # Test ingestion request
        request = IngestionRequest(
            provider=ProviderType.NEWS_API,
            query="Apple earnings",
            tickers=["AAPL"],
            max_items=10
        )

        response = await service.start_ingestion_job(request)
        print(f"Started job: {response.job_id}")

        # Wait a bit and check status
        await asyncio.sleep(5)
        job_status = await service.get_job_status(response.job_id)
        if job_status:
            print(f"Job status: {job_status.status}, processed: {job_status.items_processed}")

    # Run test
    asyncio.run(test_ingestion())