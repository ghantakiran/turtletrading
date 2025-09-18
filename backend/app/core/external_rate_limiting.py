"""
External API rate limiting for third-party services
"""

import asyncio
import time
from typing import Dict, Any, Callable, Optional
from functools import wraps
from collections import defaultdict, deque
import redis.asyncio as redis
from loguru import logger

from app.core.config import settings


class ExternalAPIRateLimiter:
    """Rate limiter for external API calls (yfinance, etc.)"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.local_limiters: Dict[str, deque] = defaultdict(deque)
        self.fallback_to_local = False

        # Rate limiting configs per service
        self.rate_limits = {
            "yfinance": {
                "requests_per_minute": 2000,  # Yahoo Finance allows ~2000 requests/minute
                "requests_per_hour": 48000,   # ~48000 requests/hour
                "burst_limit": 10,            # Allow burst of 10 requests
                "cooldown_seconds": 1         # Minimum delay between requests
            },
            "alpha_vantage": {
                "requests_per_minute": 5,     # Alpha Vantage free tier
                "requests_per_hour": 500,
                "burst_limit": 5,
                "cooldown_seconds": 12
            }
        }

    async def setup_redis(self):
        """Initialize Redis connection for distributed rate limiting"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            await self.redis_client.ping()
            logger.info("External API rate limiter Redis connection established")
        except Exception as e:
            logger.warning(f"Redis connection failed for external rate limiter, using local storage: {e}")
            self.fallback_to_local = True

    async def is_rate_limited(self, service: str, identifier: str = "default") -> bool:
        """Check if request should be rate limited"""
        if service not in self.rate_limits:
            return False

        config = self.rate_limits[service]
        current_time = int(time.time())

        # Create unique keys for different time windows
        minute_key = f"external_rate_limit:{service}:{identifier}:minute:{current_time // 60}"
        hour_key = f"external_rate_limit:{service}:{identifier}:hour:{current_time // 3600}"
        burst_key = f"external_rate_limit:{service}:{identifier}:burst"

        try:
            if self.redis_client and not self.fallback_to_local:
                return await self._redis_rate_check(minute_key, hour_key, burst_key, config)
            else:
                return await self._local_rate_check(service, identifier, config)
        except Exception as e:
            logger.error(f"Rate limiting check failed for {service}: {e}")
            return False  # Allow request if rate limiting fails

    async def _redis_rate_check(self, minute_key: str, hour_key: str, burst_key: str, config: Dict[str, Any]) -> bool:
        """Redis-based distributed rate limiting"""
        pipe = self.redis_client.pipeline()

        # Check minute limit
        pipe.incr(minute_key)
        pipe.expire(minute_key, 60)

        # Check hour limit
        pipe.incr(hour_key)
        pipe.expire(hour_key, 3600)

        # Check burst limit
        pipe.incr(burst_key)
        pipe.expire(burst_key, 10)  # 10-second burst window

        results = await pipe.execute()

        minute_count = results[0]
        hour_count = results[2]
        burst_count = results[4]

        # Check if any limit is exceeded
        if minute_count > config["requests_per_minute"]:
            logger.warning(f"Minute rate limit exceeded: {minute_count}/{config['requests_per_minute']}")
            return True

        if hour_count > config["requests_per_hour"]:
            logger.warning(f"Hour rate limit exceeded: {hour_count}/{config['requests_per_hour']}")
            return True

        if burst_count > config["burst_limit"]:
            logger.warning(f"Burst rate limit exceeded: {burst_count}/{config['burst_limit']}")
            return True

        return False

    async def _local_rate_check(self, service: str, identifier: str, config: Dict[str, Any]) -> bool:
        """Local in-memory rate limiting fallback"""
        key = f"{service}:{identifier}"
        current_time = time.time()

        # Clean old entries (older than 1 hour)
        while self.local_limiters[key] and current_time - self.local_limiters[key][0] > 3600:
            self.local_limiters[key].popleft()

        # Count requests in last minute and hour
        minute_ago = current_time - 60
        hour_ago = current_time - 3600

        minute_count = sum(1 for t in self.local_limiters[key] if t > minute_ago)
        hour_count = len(self.local_limiters[key])

        # Check burst (last 10 seconds)
        burst_ago = current_time - 10
        burst_count = sum(1 for t in self.local_limiters[key] if t > burst_ago)

        # Check limits
        if minute_count >= config["requests_per_minute"]:
            return True

        if hour_count >= config["requests_per_hour"]:
            return True

        if burst_count >= config["burst_limit"]:
            return True

        # Record this request
        self.local_limiters[key].append(current_time)

        return False

    async def wait_if_needed(self, service: str, identifier: str = "default") -> None:
        """Wait if rate limited, with exponential backoff"""
        if service not in self.rate_limits:
            return

        config = self.rate_limits[service]
        max_retries = 5
        retry_count = 0

        while retry_count < max_retries:
            if not await self.is_rate_limited(service, identifier):
                # Add minimum cooldown between requests
                await asyncio.sleep(config["cooldown_seconds"])
                return

            # Exponential backoff: 2^retry_count seconds
            wait_time = min(2 ** retry_count, 60)  # Max 60 seconds
            logger.info(f"Rate limited for {service}, waiting {wait_time}s (attempt {retry_count + 1})")
            await asyncio.sleep(wait_time)
            retry_count += 1

        # If still rate limited after max retries, log warning but continue
        logger.warning(f"Max retries exceeded for {service}, proceeding anyway")


# Global rate limiter instance
external_rate_limiter = ExternalAPIRateLimiter()


def rate_limit_external_api(service: str, identifier_func: Optional[Callable] = None):
    """
    Decorator for rate limiting external API calls

    Args:
        service: Service name (e.g., 'yfinance', 'alpha_vantage')
        identifier_func: Function to extract identifier from function args
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract identifier for rate limiting
            if identifier_func:
                identifier = identifier_func(*args, **kwargs)
            else:
                identifier = "default"

            # Wait if rate limited
            await external_rate_limiter.wait_if_needed(service, identifier)

            # Execute the function
            return await func(*args, **kwargs)

        return wrapper
    return decorator


def sync_rate_limit_external_api(service: str, identifier_func: Optional[Callable] = None):
    """
    Decorator for rate limiting synchronous external API calls
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract identifier for rate limiting
            if identifier_func:
                identifier = identifier_func(*args, **kwargs)
            else:
                identifier = "default"

            # Simple sync rate limiting using sleep
            config = external_rate_limiter.rate_limits.get(service, {})
            cooldown = config.get("cooldown_seconds", 1)
            time.sleep(cooldown)

            # Execute the function
            return func(*args, **kwargs)

        return wrapper
    return decorator


async def initialize_external_rate_limiter():
    """Initialize the external API rate limiter"""
    await external_rate_limiter.setup_redis()
    logger.info("External API rate limiter initialized")


def get_rate_limit_stats(service: str) -> Dict[str, Any]:
    """Get current rate limiting statistics for a service"""
    if service not in external_rate_limiter.rate_limits:
        return {"error": f"Unknown service: {service}"}

    config = external_rate_limiter.rate_limits[service]
    current_time = int(time.time())

    return {
        "service": service,
        "config": config,
        "current_time": current_time,
        "redis_available": external_rate_limiter.redis_client is not None and not external_rate_limiter.fallback_to_local
    }