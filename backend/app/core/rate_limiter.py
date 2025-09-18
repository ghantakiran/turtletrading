"""
Advanced Rate Limiting System
Implements REQ-AUTH-03: Rate limiting and permissions per Claude.Authentication.md
"""

import asyncio
import time
import logging
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
import redis.asyncio as redis
import json
from datetime import datetime, timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)


class RateLimitType(Enum):
    """Rate limit types"""
    API_CALLS = "api_calls"
    WEBSOCKET_MESSAGES = "websocket_messages"
    LOGIN_ATTEMPTS = "login_attempts"
    DATA_REQUESTS = "data_requests"


@dataclass
class RateLimit:
    """Rate limit configuration"""
    limit: int
    window: int  # seconds
    burst_limit: Optional[int] = None
    burst_window: Optional[int] = None


@dataclass
class RateLimitResult:
    """Rate limit check result"""
    allowed: bool
    remaining: int
    reset_time: float
    retry_after: Optional[int] = None
    headers: Dict[str, str] = None

    def __post_init__(self):
        if self.headers is None:
            self.headers = {}


class RateLimiterService:
    """
    Advanced rate limiting service with Redis backend
    Supports multiple rate limiting algorithms and subscription tiers
    """

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.local_cache: Dict[str, Dict] = {}
        self.cache_ttl = 60  # seconds

        # Rate limits by subscription tier
        self.tier_limits = {
            "free": {
                RateLimitType.API_CALLS: RateLimit(100, 3600),  # 100/hour
                RateLimitType.WEBSOCKET_MESSAGES: RateLimit(1000, 3600),  # 1000/hour
                RateLimitType.LOGIN_ATTEMPTS: RateLimit(5, 900),  # 5/15min
                RateLimitType.DATA_REQUESTS: RateLimit(50, 3600),  # 50/hour
            },
            "pro": {
                RateLimitType.API_CALLS: RateLimit(1000, 3600),  # 1000/hour
                RateLimitType.WEBSOCKET_MESSAGES: RateLimit(10000, 3600),  # 10k/hour
                RateLimitType.LOGIN_ATTEMPTS: RateLimit(10, 900),  # 10/15min
                RateLimitType.DATA_REQUESTS: RateLimit(500, 3600),  # 500/hour
            },
            "enterprise": {
                RateLimitType.API_CALLS: RateLimit(10000, 3600),  # 10k/hour
                RateLimitType.WEBSOCKET_MESSAGES: RateLimit(100000, 3600),  # 100k/hour
                RateLimitType.LOGIN_ATTEMPTS: RateLimit(50, 900),  # 50/15min
                RateLimitType.DATA_REQUESTS: RateLimit(5000, 3600),  # 5k/hour
            }
        }

        # Endpoint-specific limits
        self.endpoint_limits = {
            "/api/v1/stocks/*/analysis": RateLimit(10, 300),  # 10/5min
            "/api/v1/market/overview": RateLimit(60, 3600),  # 60/hour
            "/api/v1/auth/login": RateLimit(5, 900),  # 5/15min
            "/api/v1/auth/register": RateLimit(3, 3600),  # 3/hour
        }

    async def initialize(self):
        """Initialize rate limiter with Redis connection"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Rate limiter initialized with Redis connection")

        except Exception as e:
            logger.error(f"Failed to initialize rate limiter: {e}")
            self.redis_client = None

    async def check_rate_limit(
        self,
        identifier: str,
        limit_type: RateLimitType,
        subscription_tier: str = "free",
        endpoint: str = None
    ) -> RateLimitResult:
        """
        Check if request is within rate limits

        Args:
            identifier: User ID, IP address, or other identifier
            limit_type: Type of rate limit to check
            subscription_tier: User subscription tier
            endpoint: Specific endpoint being accessed

        Returns:
            RateLimitResult with limit status and headers
        """
        try:
            # Get rate limit configuration
            rate_limit = self._get_rate_limit(limit_type, subscription_tier, endpoint)
            if not rate_limit:
                return RateLimitResult(allowed=True, remaining=-1, reset_time=0)

            # Use Redis if available, otherwise local cache
            if self.redis_client:
                result = await self._check_redis_rate_limit(identifier, rate_limit, limit_type)
            else:
                result = await self._check_local_rate_limit(identifier, rate_limit, limit_type)

            # Add rate limit headers
            result.headers = self._get_rate_limit_headers(result, rate_limit)

            return result

        except Exception as e:
            logger.error(f"Error checking rate limit for {identifier}: {e}")
            # Fail open - allow request on error
            return RateLimitResult(allowed=True, remaining=-1, reset_time=0)

    async def _check_redis_rate_limit(
        self,
        identifier: str,
        rate_limit: RateLimit,
        limit_type: RateLimitType
    ) -> RateLimitResult:
        """Check rate limit using Redis sliding window"""
        try:
            key = f"rate_limit:{limit_type.value}:{identifier}"
            now = time.time()
            window_start = now - rate_limit.window

            pipe = self.redis_client.pipeline()

            # Remove expired entries
            pipe.zremrangebyscore(key, 0, window_start)

            # Count current requests
            pipe.zcard(key)

            # Add current request
            pipe.zadd(key, {str(now): now})

            # Set expiry
            pipe.expire(key, rate_limit.window)

            results = await pipe.execute()
            current_count = results[1]

            if current_count >= rate_limit.limit:
                # Get oldest entry to calculate reset time
                oldest_entry = await self.redis_client.zrange(key, 0, 0, withscores=True)
                if oldest_entry:
                    reset_time = oldest_entry[0][1] + rate_limit.window
                else:
                    reset_time = now + rate_limit.window

                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=reset_time,
                    retry_after=int(reset_time - now)
                )

            remaining = rate_limit.limit - current_count - 1
            reset_time = now + rate_limit.window

            return RateLimitResult(
                allowed=True,
                remaining=remaining,
                reset_time=reset_time
            )

        except Exception as e:
            logger.error(f"Error in Redis rate limit check: {e}")
            # Fallback to local cache
            return await self._check_local_rate_limit(identifier, rate_limit, limit_type)

    async def _check_local_rate_limit(
        self,
        identifier: str,
        rate_limit: RateLimit,
        limit_type: RateLimitType
    ) -> RateLimitResult:
        """Check rate limit using local memory cache"""
        try:
            key = f"{limit_type.value}:{identifier}"
            now = time.time()
            window_start = now - rate_limit.window

            if key not in self.local_cache:
                self.local_cache[key] = {"requests": [], "last_cleanup": now}

            cache_entry = self.local_cache[key]

            # Clean up old entries
            if now - cache_entry["last_cleanup"] > 60:  # Cleanup every minute
                cache_entry["requests"] = [
                    req_time for req_time in cache_entry["requests"]
                    if req_time > window_start
                ]
                cache_entry["last_cleanup"] = now

            # Filter recent requests
            recent_requests = [
                req_time for req_time in cache_entry["requests"]
                if req_time > window_start
            ]

            if len(recent_requests) >= rate_limit.limit:
                reset_time = min(recent_requests) + rate_limit.window
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=reset_time,
                    retry_after=int(reset_time - now)
                )

            # Add current request
            cache_entry["requests"].append(now)
            remaining = rate_limit.limit - len(recent_requests) - 1
            reset_time = now + rate_limit.window

            return RateLimitResult(
                allowed=True,
                remaining=remaining,
                reset_time=reset_time
            )

        except Exception as e:
            logger.error(f"Error in local rate limit check: {e}")
            return RateLimitResult(allowed=True, remaining=-1, reset_time=0)

    def _get_rate_limit(
        self,
        limit_type: RateLimitType,
        subscription_tier: str,
        endpoint: str = None
    ) -> Optional[RateLimit]:
        """Get rate limit configuration for request"""
        try:
            # Check endpoint-specific limits first
            if endpoint:
                for pattern, limit in self.endpoint_limits.items():
                    if self._match_endpoint_pattern(endpoint, pattern):
                        return limit

            # Use subscription tier limits
            if subscription_tier in self.tier_limits:
                return self.tier_limits[subscription_tier].get(limit_type)

            # Fallback to free tier
            return self.tier_limits["free"].get(limit_type)

        except Exception as e:
            logger.error(f"Error getting rate limit: {e}")
            return None

    def _match_endpoint_pattern(self, endpoint: str, pattern: str) -> bool:
        """Match endpoint against pattern with wildcards"""
        try:
            endpoint_parts = endpoint.strip("/").split("/")
            pattern_parts = pattern.strip("/").split("/")

            if len(endpoint_parts) != len(pattern_parts):
                return False

            for ep, pp in zip(endpoint_parts, pattern_parts):
                if pp != "*" and pp != ep:
                    return False

            return True

        except Exception:
            return False

    def _get_rate_limit_headers(
        self,
        result: RateLimitResult,
        rate_limit: RateLimit
    ) -> Dict[str, str]:
        """Generate rate limit headers for response"""
        headers = {
            "X-RateLimit-Limit": str(rate_limit.limit),
            "X-RateLimit-Remaining": str(max(0, result.remaining)),
            "X-RateLimit-Reset": str(int(result.reset_time)),
            "X-RateLimit-Window": str(rate_limit.window)
        }

        if not result.allowed and result.retry_after:
            headers["Retry-After"] = str(result.retry_after)

        return headers

    async def get_rate_limit_status(
        self,
        identifier: str,
        subscription_tier: str = "free"
    ) -> Dict[str, Dict]:
        """Get current rate limit status for all limit types"""
        try:
            status = {}

            for limit_type in RateLimitType:
                rate_limit = self._get_rate_limit(limit_type, subscription_tier)
                if not rate_limit:
                    continue

                # Check current usage without incrementing
                if self.redis_client:
                    key = f"rate_limit:{limit_type.value}:{identifier}"
                    now = time.time()
                    window_start = now - rate_limit.window

                    # Count current requests
                    current_count = await self.redis_client.zcount(key, window_start, now)
                    remaining = max(0, rate_limit.limit - current_count)
                    reset_time = now + rate_limit.window

                else:
                    # Use local cache
                    key = f"{limit_type.value}:{identifier}"
                    if key in self.local_cache:
                        now = time.time()
                        window_start = now - rate_limit.window
                        recent_requests = [
                            req_time for req_time in self.local_cache[key]["requests"]
                            if req_time > window_start
                        ]
                        remaining = max(0, rate_limit.limit - len(recent_requests))
                        reset_time = now + rate_limit.window
                    else:
                        remaining = rate_limit.limit
                        reset_time = time.time() + rate_limit.window

                status[limit_type.value] = {
                    "limit": rate_limit.limit,
                    "remaining": remaining,
                    "reset_time": reset_time,
                    "window": rate_limit.window
                }

            return status

        except Exception as e:
            logger.error(f"Error getting rate limit status: {e}")
            return {}

    async def reset_rate_limit(
        self,
        identifier: str,
        limit_type: RateLimitType
    ) -> bool:
        """Reset rate limit for identifier (admin function)"""
        try:
            if self.redis_client:
                key = f"rate_limit:{limit_type.value}:{identifier}"
                await self.redis_client.delete(key)
            else:
                key = f"{limit_type.value}:{identifier}"
                if key in self.local_cache:
                    del self.local_cache[key]

            logger.info(f"Reset rate limit {limit_type.value} for {identifier}")
            return True

        except Exception as e:
            logger.error(f"Error resetting rate limit: {e}")
            return False

    async def add_rate_limit_exemption(
        self,
        identifier: str,
        limit_type: RateLimitType,
        duration: int = 3600
    ) -> bool:
        """Add temporary rate limit exemption"""
        try:
            if self.redis_client:
                key = f"rate_limit_exempt:{limit_type.value}:{identifier}"
                await self.redis_client.setex(key, duration, "1")
            else:
                # Store in local cache with expiry
                key = f"exempt:{limit_type.value}:{identifier}"
                self.local_cache[key] = {
                    "exempt": True,
                    "expires": time.time() + duration
                }

            logger.info(f"Added rate limit exemption for {identifier} ({duration}s)")
            return True

        except Exception as e:
            logger.error(f"Error adding rate limit exemption: {e}")
            return False

    async def is_exempt(
        self,
        identifier: str,
        limit_type: RateLimitType
    ) -> bool:
        """Check if identifier is exempt from rate limiting"""
        try:
            if self.redis_client:
                key = f"rate_limit_exempt:{limit_type.value}:{identifier}"
                result = await self.redis_client.get(key)
                return result is not None
            else:
                key = f"exempt:{limit_type.value}:{identifier}"
                if key in self.local_cache:
                    entry = self.local_cache[key]
                    if entry.get("exempt") and entry.get("expires", 0) > time.time():
                        return True
                    else:
                        # Remove expired exemption
                        del self.local_cache[key]

            return False

        except Exception as e:
            logger.error(f"Error checking exemption: {e}")
            return False

    async def cleanup_expired_entries(self):
        """Clean up expired rate limit entries"""
        try:
            if not self.redis_client:
                # Clean local cache
                now = time.time()
                expired_keys = []

                for key, entry in self.local_cache.items():
                    if "expires" in entry and entry["expires"] < now:
                        expired_keys.append(key)

                for key in expired_keys:
                    del self.local_cache[key]

                logger.info(f"Cleaned up {len(expired_keys)} expired local cache entries")

        except Exception as e:
            logger.error(f"Error cleaning up expired entries: {e}")

    def get_stats(self) -> Dict[str, any]:
        """Get rate limiter statistics"""
        try:
            if self.redis_client:
                # Would need to implement Redis-based stats collection
                return {"backend": "redis", "local_cache_size": len(self.local_cache)}
            else:
                total_entries = len(self.local_cache)
                active_entries = sum(
                    1 for entry in self.local_cache.values()
                    if "requests" in entry and entry["requests"]
                )

                return {
                    "backend": "local",
                    "total_entries": total_entries,
                    "active_entries": active_entries,
                    "cache_size": total_entries
                }

        except Exception as e:
            logger.error(f"Error getting rate limiter stats: {e}")
            return {}


# Global instance
rate_limiter = RateLimiterService()