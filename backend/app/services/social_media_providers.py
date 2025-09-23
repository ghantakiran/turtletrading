"""
Social Media Data Source Providers

This module provides social media data ingestion services for Twitter and Reddit
with advanced deduplication, rate limiting, and content filtering capabilities.
"""

import asyncio
import hashlib
import re
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any, Tuple, Union
import aiohttp
import praw
from prawcore import ResponseException, RequestException

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
from app.services.news_data_providers import RateLimiter, ContentDeduplicator


class SocialMediaFilter:
    """Content filtering for social media posts"""

    def __init__(self):
        # Financial keywords that indicate relevance
        self.financial_keywords = {
            'general': ['stock', 'stocks', 'market', 'trading', 'investment', 'investor',
                       'portfolio', 'earnings', 'revenue', 'profit', 'loss', 'bull', 'bear',
                       'nasdaq', 'sp500', 's&p500', 'dow', 'djia', 'options', 'futures'],
            'actions': ['buy', 'sell', 'hold', 'long', 'short', 'calls', 'puts', 'squeeze'],
            'sentiment': ['bullish', 'bearish', 'moon', 'crash', 'dip', 'pump', 'dump'],
            'metrics': ['pe', 'eps', 'roe', 'debt', 'revenue', 'growth', 'valuation']
        }

        # Common spam patterns to filter out
        self.spam_patterns = [
            r'follow\s+me',
            r'dm\s+me',
            r'check\s+my\s+bio',
            r'click\s+link',
            r'free\s+money',
            r'guaranteed\s+profit',
            r'risk\s+free',
            r'\b\d+%\s+return',
            r'pump\s+and\s+dump',
            r'hot\s+stock\s+pick'
        ]

        # Minimum quality thresholds
        self.min_length = 20
        self.min_words = 3

    def is_financial_content(self, text: str) -> Tuple[bool, float]:
        """
        Check if content is financially relevant
        Returns: (is_relevant, relevance_score)
        """
        text_lower = text.lower()

        # Count keyword matches by category
        matches = 0
        total_keywords = 0

        for category, keywords in self.financial_keywords.items():
            category_matches = sum(1 for keyword in keywords if keyword in text_lower)
            matches += category_matches
            total_keywords += len(keywords)

        # Calculate relevance score
        relevance_score = min(matches / 3.0, 1.0)  # Normalize to 0-1, cap at 1

        # Must have at least 1 financial keyword
        is_relevant = matches > 0

        return is_relevant, relevance_score

    def is_spam_content(self, text: str) -> bool:
        """Check if content appears to be spam"""
        text_lower = text.lower()

        # Check against spam patterns
        for pattern in self.spam_patterns:
            if re.search(pattern, text_lower):
                return True

        return False

    def meets_quality_threshold(self, text: str) -> bool:
        """Check if content meets minimum quality requirements"""
        # Remove URLs and mentions for length calculation
        clean_text = re.sub(r'http\S+|@\w+|#\w+', '', text).strip()

        if len(clean_text) < self.min_length:
            return False

        words = clean_text.split()
        if len(words) < self.min_words:
            return False

        return True

    def filter_content(self, text: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Apply all filters to content
        Returns: (passes_filter, metadata)
        """
        metadata = {}

        # Quality check
        if not self.meets_quality_threshold(text):
            metadata['rejection_reason'] = 'quality_threshold'
            return False, metadata

        # Spam check
        if self.is_spam_content(text):
            metadata['rejection_reason'] = 'spam_detected'
            return False, metadata

        # Financial relevance check
        is_relevant, relevance_score = self.is_financial_content(text)
        metadata['relevance_score'] = relevance_score

        if not is_relevant:
            metadata['rejection_reason'] = 'not_financial'
            return False, metadata

        metadata['passes_all_filters'] = True
        return True, metadata


class TwitterProvider:
    """Twitter API v2 provider for social media data"""

    def __init__(
        self,
        config: DataSourceConfig,
        rate_limiter: RateLimiter,
        deduplicator: ContentDeduplicator
    ):
        self.config = config
        self.rate_limiter = rate_limiter
        self.deduplicator = deduplicator
        self.filter = SocialMediaFilter()
        self.session: Optional[aiohttp.ClientSession] = None
        self.base_url = "https://api.twitter.com/2"

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session with Twitter API headers"""
        if not self.session:
            headers = {
                "Authorization": f"Bearer {self.config.api_key}",
                "User-Agent": "TurtleTrading/1.0"
            }
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(headers=headers, timeout=timeout)
        return self.session

    async def _check_rate_limit(self) -> bool:
        """Check Twitter API rate limits"""
        key = f"rate_limit:twitter"
        allowed, remaining, reset_time = await self.rate_limiter.is_allowed(
            key,
            self.config.rate_limit_requests,
            self.config.rate_limit_period
        )
        return allowed

    async def search_tweets(
        self,
        query: str,
        max_results: int = 100,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[RawContentItem]:
        """Search for tweets using Twitter API v2"""
        if not await self._check_rate_limit():
            return []

        tweets = []
        session = await self._get_session()

        # Build search parameters
        params = {
            "query": query,
            "max_results": min(max_results, 100),  # API limit
            "tweet.fields": "created_at,author_id,public_metrics,context_annotations,lang",
            "user.fields": "username,name,verified",
            "expansions": "author_id"
        }

        if start_time:
            params["start_time"] = start_time.isoformat()
        if end_time:
            params["end_time"] = end_time.isoformat()

        try:
            async with session.get(f"{self.base_url}/tweets/search/recent", params=params) as response:
                if response.status == 200:
                    data = await response.json()

                    # Create user lookup for author info
                    users = {user['id']: user for user in data.get('includes', {}).get('users', [])}

                    for tweet_data in data.get('data', []):
                        text = tweet_data.get('text', '')

                        # Apply content filters
                        passes_filter, filter_metadata = self.filter.filter_content(text)
                        if not passes_filter:
                            continue

                        # Check for duplicates
                        if await self.deduplicator.is_duplicate(
                            self.deduplicator.generate_content_hash(text)
                        ):
                            continue

                        # Get author info
                        author_id = tweet_data.get('author_id')
                        author_info = users.get(author_id, {})

                        # Parse created time
                        created_at = datetime.fromisoformat(
                            tweet_data.get('created_at', '').replace('Z', '+00:00')
                        )

                        tweet = RawContentItem(
                            source=SentimentSource.TWITTER,
                            content_type=ContentType.TWEET,
                            content=text,
                            author=author_info.get('username'),
                            published_at=created_at,
                            source_url=f"https://twitter.com/{author_info.get('username', 'unknown')}/status/{tweet_data.get('id')}",
                            source_id=tweet_data.get('id'),
                            language=tweet_data.get('lang', 'en'),
                            metadata={
                                'author_name': author_info.get('name'),
                                'author_verified': author_info.get('verified', False),
                                'public_metrics': tweet_data.get('public_metrics', {}),
                                'context_annotations': tweet_data.get('context_annotations', []),
                                **filter_metadata
                            }
                        )

                        tweets.append(tweet)
                        await self.deduplicator.mark_processed(
                            self.deduplicator.generate_content_hash(text)
                        )

                elif response.status == 429:
                    logger.warning("Twitter API rate limit exceeded")
                else:
                    logger.error(f"Twitter API error: {response.status} - {await response.text()}")

        except Exception as e:
            logger.error(f"Error fetching from Twitter API: {str(e)}")

        return tweets

    async def fetch_posts(
        self,
        keywords: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[RawContentItem]:
        """Fetch tweets based on keywords"""
        # Build Twitter search query
        query_parts = []

        # Add keywords with OR logic
        if keywords:
            keyword_query = " OR ".join(f'"{keyword}"' for keyword in keywords)
            query_parts.append(f"({keyword_query})")

        # Add financial context
        query_parts.append("(stock OR stocks OR trading OR market)")

        # Exclude retweets and replies for quality
        query_parts.append("-is:retweet -is:reply")

        # Language filter
        query_parts.append("lang:en")

        query = " ".join(query_parts)

        return await self.search_tweets(
            query=query,
            max_results=limit,
            start_time=start_date,
            end_time=end_date
        )

    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()


class RedditProvider:
    """Reddit API provider for social media data"""

    def __init__(
        self,
        config: DataSourceConfig,
        rate_limiter: RateLimiter,
        deduplicator: ContentDeduplicator
    ):
        self.config = config
        self.rate_limiter = rate_limiter
        self.deduplicator = deduplicator
        self.filter = SocialMediaFilter()
        self.reddit: Optional[praw.Reddit] = None

        # Financial subreddits to monitor
        self.financial_subreddits = [
            'stocks', 'investing', 'SecurityAnalysis', 'ValueInvesting',
            'StockMarket', 'financialindependence', 'investing_discussion',
            'wallstreetbets', 'options', 'pennystocks', 'dividends'
        ]

    def _get_reddit_client(self) -> praw.Reddit:
        """Get or create Reddit client"""
        if not self.reddit:
            self.reddit = praw.Reddit(
                client_id=self.config.api_key,
                client_secret=self.config.api_secret,
                user_agent="TurtleTrading/1.0"
            )
        return self.reddit

    async def _check_rate_limit(self) -> bool:
        """Check Reddit API rate limits"""
        key = f"rate_limit:reddit"
        allowed, remaining, reset_time = await self.rate_limiter.is_allowed(
            key,
            self.config.rate_limit_requests,
            self.config.rate_limit_period
        )
        return allowed

    async def search_subreddit_posts(
        self,
        subreddit_name: str,
        keywords: List[str],
        time_filter: str = "day",
        limit: int = 100
    ) -> List[RawContentItem]:
        """Search posts in a specific subreddit"""
        if not await self._check_rate_limit():
            return []

        posts = []
        reddit = self._get_reddit_client()

        try:
            subreddit = reddit.subreddit(subreddit_name)

            # Get hot posts from subreddit
            submission_list = list(subreddit.hot(limit=limit))

            for submission in submission_list:
                # Combine title and selftext for content
                title = submission.title or ""
                selftext = submission.selftext or ""
                content = f"{title}\n\n{selftext}".strip()

                if not content:
                    continue

                # Filter by keywords if specified
                if keywords:
                    content_lower = content.lower()
                    if not any(keyword.lower() in content_lower for keyword in keywords):
                        continue

                # Apply content filters
                passes_filter, filter_metadata = self.filter.filter_content(content)
                if not passes_filter:
                    continue

                # Check for duplicates
                if await self.deduplicator.is_duplicate(
                    self.deduplicator.generate_content_hash(content)
                ):
                    continue

                # Convert timestamp
                created_at = datetime.fromtimestamp(submission.created_utc)

                post = RawContentItem(
                    source=SentimentSource.REDDIT,
                    content_type=ContentType.REDDIT_POST,
                    title=title,
                    content=content,
                    author=str(submission.author) if submission.author else None,
                    published_at=created_at,
                    source_url=f"https://reddit.com{submission.permalink}",
                    source_id=submission.id,
                    metadata={
                        'subreddit': subreddit_name,
                        'score': submission.score,
                        'upvote_ratio': submission.upvote_ratio,
                        'num_comments': submission.num_comments,
                        'is_self': submission.is_self,
                        'flair': submission.link_flair_text,
                        **filter_metadata
                    }
                )

                posts.append(post)
                await self.deduplicator.mark_processed(
                    self.deduplicator.generate_content_hash(content)
                )

                # Also process top comments for additional content
                submission.comments.replace_more(limit=0)  # Flatten comment tree
                for comment in submission.comments[:5]:  # Top 5 comments only
                    if hasattr(comment, 'body') and comment.body:
                        comment_content = comment.body

                        # Apply filters to comment
                        passes_filter, comment_metadata = self.filter.filter_content(comment_content)
                        if not passes_filter:
                            continue

                        # Check for duplicates
                        if await self.deduplicator.is_duplicate(
                            self.deduplicator.generate_content_hash(comment_content)
                        ):
                            continue

                        comment_created_at = datetime.fromtimestamp(comment.created_utc)

                        comment_item = RawContentItem(
                            source=SentimentSource.REDDIT,
                            content_type=ContentType.REDDIT_COMMENT,
                            content=comment_content,
                            author=str(comment.author) if comment.author else None,
                            published_at=comment_created_at,
                            source_url=f"https://reddit.com{submission.permalink}{comment.id}/",
                            source_id=comment.id,
                            metadata={
                                'subreddit': subreddit_name,
                                'parent_post_id': submission.id,
                                'score': comment.score,
                                'is_comment': True,
                                **comment_metadata
                            }
                        )

                        posts.append(comment_item)
                        await self.deduplicator.mark_processed(
                            self.deduplicator.generate_content_hash(comment_content)
                        )

        except (ResponseException, RequestException) as e:
            logger.error(f"Reddit API error for subreddit {subreddit_name}: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error fetching from Reddit {subreddit_name}: {str(e)}")

        return posts

    async def fetch_posts(
        self,
        keywords: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[RawContentItem]:
        """Fetch posts from multiple financial subreddits"""
        all_posts = []

        # Distribute limit across subreddits
        posts_per_subreddit = max(1, limit // len(self.financial_subreddits))

        for subreddit_name in self.financial_subreddits:
            try:
                posts = await self.search_subreddit_posts(
                    subreddit_name=subreddit_name,
                    keywords=keywords,
                    limit=posts_per_subreddit
                )

                # Filter by date range if specified
                if start_date or end_date:
                    filtered_posts = []
                    for post in posts:
                        if start_date and post.published_at < start_date:
                            continue
                        if end_date and post.published_at > end_date:
                            continue
                        filtered_posts.append(post)
                    posts = filtered_posts

                all_posts.extend(posts)

                # Add small delay between subreddit requests
                await asyncio.sleep(0.1)

            except Exception as e:
                logger.error(f"Error fetching from subreddit {subreddit_name}: {str(e)}")

        # Sort by published date (newest first) and limit
        all_posts.sort(key=lambda x: x.published_at, reverse=True)
        return all_posts[:limit]


class SocialMediaProviderFactory:
    """Factory for creating social media providers"""

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.rate_limiter = RateLimiter(redis_service)
        self.deduplicator = ContentDeduplicator(redis_service)

    def create_provider(self, config: DataSourceConfig):
        """Create appropriate social media provider based on source"""
        providers = {
            SentimentSource.TWITTER: TwitterProvider,
            SentimentSource.REDDIT: RedditProvider,
        }

        provider_class = providers.get(config.source)
        if not provider_class:
            raise ValueError(f"Unsupported social media source: {config.source}")

        return provider_class(config, self.rate_limiter, self.deduplicator)


class SocialMediaIngestionService:
    """Main service for coordinating social media data ingestion"""

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.factory = SocialMediaProviderFactory(redis_service)
        self.active_jobs: Dict[str, IngestionJob] = {}

    async def start_ingestion_job(
        self,
        sources: List[DataSourceConfig],
        keywords: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        job_type: str = "realtime"
    ) -> IngestionJob:
        """Start a new social media ingestion job"""
        job = IngestionJob(
            source=sources[0].source,
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
            all_posts = []

            for config in sources:
                if not config.enabled:
                    continue

                provider = self.factory.create_provider(config)

                try:
                    posts = await provider.fetch_posts(
                        keywords=keywords,
                        start_date=start_date,
                        end_date=end_date,
                        limit=100  # Per source limit
                    )

                    all_posts.extend(posts)
                    job.items_succeeded += len(posts)

                    # Close provider session if needed
                    if hasattr(provider, 'close'):
                        await provider.close()

                except Exception as e:
                    logger.error(f"Error in social media provider {config.source}: {str(e)}")
                    job.items_failed += 1

            job.items_processed = len(all_posts)
            job.status = IngestionStatus.COMPLETED
            job.end_time = datetime.utcnow()

            logger.info(
                f"Social media ingestion job {job.job_id} completed: "
                f"{job.items_processed} items processed, "
                f"{job.items_succeeded} succeeded, "
                f"{job.items_failed} failed"
            )

        except Exception as e:
            job.status = IngestionStatus.FAILED
            job.error_details = str(e)
            job.end_time = datetime.utcnow()
            logger.error(f"Social media ingestion job {job.job_id} failed: {str(e)}")

        finally:
            if job.job_id in self.active_jobs:
                del self.active_jobs[job.job_id]

        return job

    async def get_job_status(self, job_id: str) -> Optional[IngestionJob]:
        """Get status of a social media ingestion job"""
        return self.active_jobs.get(job_id)

    async def stop_job(self, job_id: str) -> bool:
        """Stop a running social media ingestion job"""
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            job.status = IngestionStatus.FAILED
            job.error_details = "Job stopped by user"
            job.end_time = datetime.utcnow()
            del self.active_jobs[job_id]
            return True
        return False