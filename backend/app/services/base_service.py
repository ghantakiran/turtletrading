"""
Base service class with common functionality
"""

import asyncio
from typing import Optional, Any, Dict
from datetime import datetime, timedelta
import redis
import json
from loguru import logger

from app.core.config import settings


class BaseService:
    """Base service class with common functionality"""
    
    def __init__(self):
        self.redis_client = None
        self._setup_redis()
    
    def _setup_redis(self):
        """Setup Redis connection for caching"""
        try:
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None
    
    async def get_cached(self, key: str) -> Optional[Any]:
        """Get data from cache"""
        if not self.redis_client:
            return None
        
        try:
            data = self.redis_client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
        
        return None
    
    async def set_cached(self, key: str, data: Any, ttl: int = None) -> bool:
        """Set data in cache with TTL"""
        if not self.redis_client:
            return False
        
        if ttl is None:
            ttl = settings.CACHE_TTL
        
        try:
            serialized = json.dumps(data, default=str)  # default=str handles datetime objects
            self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete_cached(self, key: str) -> bool:
        """Delete data from cache"""
        if not self.redis_client:
            return False
        
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def get_or_set_cache(self, key: str, fetch_func, ttl: int = None) -> Any:
        """Get data from cache or fetch and cache it"""
        # Try to get from cache first
        cached_data = await self.get_cached(key)
        if cached_data is not None:
            logger.debug(f"Cache hit for key: {key}")
            return cached_data
        
        # Fetch data
        logger.debug(f"Cache miss for key: {key}, fetching data")
        try:
            if asyncio.iscoroutinefunction(fetch_func):
                data = await fetch_func()
            else:
                data = fetch_func()
            
            # Cache the result
            await self.set_cached(key, data, ttl)
            return data
            
        except Exception as e:
            logger.error(f"Error fetching data for key {key}: {e}")
            raise
    
    def create_cache_key(self, *parts: str) -> str:
        """Create a cache key from multiple parts"""
        return ":".join(str(part) for part in parts)
    
    async def batch_get_cached(self, keys: list) -> Dict[str, Any]:
        """Get multiple keys from cache at once"""
        if not self.redis_client or not keys:
            return {}
        
        result = {}
        try:
            pipeline = self.redis_client.pipeline()
            for key in keys:
                pipeline.get(key)
            
            values = pipeline.execute()
            
            for key, value in zip(keys, values):
                if value:
                    try:
                        result[key] = json.loads(value)
                    except json.JSONDecodeError:
                        logger.error(f"JSON decode error for cached key: {key}")
                        
        except Exception as e:
            logger.error(f"Batch cache get error: {e}")
        
        return result
    
    async def batch_set_cached(self, data_dict: Dict[str, Any], ttl: int = None) -> bool:
        """Set multiple key-value pairs in cache"""
        if not self.redis_client or not data_dict:
            return False
        
        if ttl is None:
            ttl = settings.CACHE_TTL
        
        try:
            pipeline = self.redis_client.pipeline()
            
            for key, value in data_dict.items():
                serialized = json.dumps(value, default=str)
                pipeline.setex(key, ttl, serialized)
            
            pipeline.execute()
            return True
            
        except Exception as e:
            logger.error(f"Batch cache set error: {e}")
            return False
    
    async def clear_cache_pattern(self, pattern: str) -> int:
        """Clear all cache keys matching a pattern"""
        if not self.redis_client:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
            
        except Exception as e:
            logger.error(f"Cache pattern clear error for pattern {pattern}: {e}")
            return 0
    
    def safe_float_extract(self, value) -> float:
        """Safely extract float value from pandas Series or scalar"""
        try:
            if hasattr(value, 'iloc') and len(value) > 0:
                return float(value.iloc[0])
            elif hasattr(value, 'item'):
                return float(value.item())
            else:
                return float(value)
        except (TypeError, ValueError, AttributeError):
            return 0.0
    
    def format_percentage(self, value: float) -> float:
        """Format percentage value safely"""
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return 0.0
    
    def validate_symbol(self, symbol: str) -> str:
        """Validate and format stock symbol"""
        if not symbol or not isinstance(symbol, str):
            raise ValueError("Invalid symbol")
        
        symbol = symbol.upper().strip()
        
        # Basic validation
        if not symbol.isalpha() or len(symbol) > 10:
            raise ValueError("Invalid symbol format")
        
        return symbol
    
    def validate_timeframe(self, timeframe: str, allowed_timeframes: list) -> str:
        """Validate timeframe parameter"""
        if timeframe not in allowed_timeframes:
            raise ValueError(f"Invalid timeframe. Allowed values: {allowed_timeframes}")
        return timeframe
    
    async def rate_limit_check(self, user_id: Optional[int], endpoint: str) -> bool:
        """Check if user has exceeded rate limits"""
        if not self.redis_client or not user_id:
            return True  # Allow if no rate limiting setup
        
        try:
            key = f"rate_limit:{user_id}:{endpoint}"
            current_requests = self.redis_client.get(key)
            
            if not current_requests:
                # First request in window
                self.redis_client.setex(key, settings.RATE_LIMIT_WINDOW, 1)
                return True
            
            current_requests = int(current_requests)
            
            if current_requests >= settings.RATE_LIMIT_REQUESTS:
                return False  # Rate limit exceeded
            
            # Increment counter
            self.redis_client.incr(key)
            return True
            
        except Exception as e:
            logger.error(f"Rate limit check error: {e}")
            return True  # Allow on error
    
    def get_market_hours(self) -> Dict[str, Any]:
        """Get market hours information"""
        now = datetime.now()
        
        # Simple market hours (9:30 AM - 4:00 PM ET on weekdays)
        market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
        
        is_weekday = now.weekday() < 5  # Monday = 0, Sunday = 6
        is_market_hours = market_open <= now <= market_close and is_weekday
        
        return {
            "is_open": is_market_hours,
            "is_weekday": is_weekday,
            "current_time": now,
            "market_open": market_open,
            "market_close": market_close,
            "next_open": market_open + timedelta(days=1) if not is_weekday or now > market_close else market_open,
            "next_close": market_close if is_weekday and now < market_close else market_close + timedelta(days=1)
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Service health check"""
        health_status = {
            "service": self.__class__.__name__,
            "status": "healthy",
            "timestamp": datetime.utcnow(),
            "redis_connected": self.redis_client is not None
        }
        
        # Test Redis connection
        if self.redis_client:
            try:
                self.redis_client.ping()
                health_status["redis_status"] = "connected"
            except Exception as e:
                health_status["redis_status"] = f"error: {e}"
                health_status["status"] = "degraded"
        
        return health_status