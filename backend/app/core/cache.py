"""
Cache management module for Redis-based caching.

Provides caching functionality for stock data, technical indicators, and API responses.
Falls back to in-memory caching if Redis is unavailable.
"""
import logging
import json
from typing import Any, Optional, Callable
from functools import wraps
from datetime import timedelta
import asyncio

logger = logging.getLogger(__name__)

class CacheManager:
    """
    Cache manager with Redis backend and in-memory fallback.

    Provides decorator-based caching for functions with configurable TTL.
    """

    def __init__(self):
        """Initialize cache manager with in-memory fallback."""
        self.redis_client = None
        self.in_memory_cache = {}
        self.cache_hits = 0
        self.cache_misses = 0

    async def connect_redis(self, redis_url: str = "redis://localhost:6379"):
        """
        Connect to Redis server.

        Args:
            redis_url: Redis connection URL

        Returns:
            bool: True if connected, False otherwise
        """
        try:
            import redis.asyncio as redis
            self.redis_client = redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Connected to Redis successfully")
            return True
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Using in-memory cache.")
            self.redis_client = None
            return False

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        try:
            if self.redis_client:
                value = await self.redis_client.get(key)
                if value:
                    self.cache_hits += 1
                    return json.loads(value)
            else:
                # Use in-memory cache
                if key in self.in_memory_cache:
                    self.cache_hits += 1
                    return self.in_memory_cache[key]

            self.cache_misses += 1
            return None
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            self.cache_misses += 1
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Set value in cache with TTL.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (default 5 minutes)

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if self.redis_client:
                await self.redis_client.setex(
                    key,
                    ttl,
                    json.dumps(value)
                )
            else:
                # Use in-memory cache (no TTL enforcement for simplicity)
                self.in_memory_cache[key] = value
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete value from cache.

        Args:
            key: Cache key

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if self.redis_client:
                await self.redis_client.delete(key)
            else:
                if key in self.in_memory_cache:
                    del self.in_memory_cache[key]
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False

    async def clear(self) -> bool:
        """
        Clear all cache entries.

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if self.redis_client:
                await self.redis_client.flushdb()
            else:
                self.in_memory_cache.clear()
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False

    def cached(self, ttl: int = 300, key_prefix: str = ""):
        """
        Decorator for caching function results.

        Args:
            ttl: Time to live in seconds (default 5 minutes)
            key_prefix: Prefix for cache keys

        Returns:
            Decorated function with caching
        """
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Generate cache key from function name and arguments
                cache_key = f"{key_prefix}:{func.__name__}:"

                # Add arguments to key (simple serialization)
                arg_parts = [str(arg) for arg in args]
                kwarg_parts = [f"{k}={v}" for k, v in sorted(kwargs.items())]
                cache_key += ":".join(arg_parts + kwarg_parts)

                # Try to get from cache
                cached_value = await self.get(cache_key)
                if cached_value is not None:
                    logger.debug(f"Cache hit: {cache_key}")
                    return cached_value

                # Call function and cache result
                result = await func(*args, **kwargs)
                await self.set(cache_key, result, ttl)
                logger.debug(f"Cache miss: {cache_key}")
                return result

            return wrapper
        return decorator

    async def close(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis connection closed")


# Global cache manager instance
cache_manager = CacheManager()
