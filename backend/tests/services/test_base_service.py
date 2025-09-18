"""
Tests for base service functionality
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import json
import redis

from app.services.base_service import BaseService


class TestBaseService:
    """Test suite for BaseService class."""
    
    @pytest.mark.services
    def test_init_with_redis_connection(self, mock_redis):
        """Test BaseService initialization with working Redis."""
        with patch("app.services.base_service.redis.Redis.from_url") as mock_redis_constructor:
            mock_redis_instance = MagicMock()
            mock_redis_instance.ping.return_value = True
            mock_redis_constructor.return_value = mock_redis_instance
            
            service = BaseService()
            
            assert service.redis_client is not None
            mock_redis_instance.ping.assert_called_once()
    
    @pytest.mark.services
    def test_init_with_redis_connection_failure(self):
        """Test BaseService initialization when Redis connection fails."""
        with patch("app.services.base_service.redis.Redis.from_url") as mock_redis_constructor:
            mock_redis_constructor.side_effect = redis.ConnectionError("Connection failed")
            
            service = BaseService()
            
            assert service.redis_client is None
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_get_cached_success(self):
        """Test successful cache retrieval."""
        service = BaseService()
        service.redis_client = MagicMock()
        
        test_data = {"key": "value", "number": 123}
        service.redis_client.get.return_value = json.dumps(test_data)
        
        result = await service.get_cached("test_key")
        
        assert result == test_data
        service.redis_client.get.assert_called_once_with("test_key")
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_get_cached_no_redis(self):
        """Test cache retrieval when Redis is not available."""
        service = BaseService()
        service.redis_client = None
        
        result = await service.get_cached("test_key")
        
        assert result is None
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_get_cached_json_error(self):
        """Test cache retrieval with invalid JSON."""
        service = BaseService()
        service.redis_client = MagicMock()
        service.redis_client.get.return_value = "invalid json"
        
        result = await service.get_cached("test_key")
        
        assert result is None
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_set_cached_success(self):
        """Test successful cache storage."""
        service = BaseService()
        service.redis_client = MagicMock()
        
        test_data = {"key": "value"}
        
        result = await service.set_cached("test_key", test_data, 300)
        
        assert result is True
        service.redis_client.setex.assert_called_once()
        
        # Check the call arguments
        call_args = service.redis_client.setex.call_args
        assert call_args[0][0] == "test_key"  # key
        assert call_args[0][1] == 300  # ttl
        assert json.loads(call_args[0][2]) == test_data  # serialized data
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_set_cached_no_redis(self):
        """Test cache storage when Redis is not available."""
        service = BaseService()
        service.redis_client = None
        
        result = await service.set_cached("test_key", {"data": "value"})
        
        assert result is False
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_delete_cached(self):
        """Test cache deletion."""
        service = BaseService()
        service.redis_client = MagicMock()
        
        result = await service.delete_cached("test_key")
        
        assert result is True
        service.redis_client.delete.assert_called_once_with("test_key")
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_get_or_set_cache_hit(self):
        """Test get_or_set_cache with cache hit."""
        service = BaseService()
        service.redis_client = MagicMock()
        
        cached_data = {"cached": True}
        service.redis_client.get.return_value = json.dumps(cached_data)
        
        fetch_func = Mock(return_value={"fresh": True})
        
        result = await service.get_or_set_cache("test_key", fetch_func)
        
        assert result == cached_data
        fetch_func.assert_not_called()  # Should not fetch if cache hit
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_get_or_set_cache_miss_sync_func(self):
        """Test get_or_set_cache with cache miss and sync fetch function."""
        service = BaseService()
        service.redis_client = MagicMock()
        service.redis_client.get.return_value = None  # Cache miss
        
        fresh_data = {"fresh": True}
        fetch_func = Mock(return_value=fresh_data)
        
        result = await service.get_or_set_cache("test_key", fetch_func)
        
        assert result == fresh_data
        fetch_func.assert_called_once()
        service.redis_client.setex.assert_called_once()  # Should cache the result
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_get_or_set_cache_miss_async_func(self):
        """Test get_or_set_cache with cache miss and async fetch function."""
        service = BaseService()
        service.redis_client = MagicMock()
        service.redis_client.get.return_value = None  # Cache miss
        
        fresh_data = {"fresh": True}
        
        async def async_fetch_func():
            return fresh_data
        
        result = await service.get_or_set_cache("test_key", async_fetch_func)
        
        assert result == fresh_data
        service.redis_client.setex.assert_called_once()
    
    @pytest.mark.services
    def test_create_cache_key(self):
        """Test cache key creation."""
        service = BaseService()
        
        key = service.create_cache_key("prefix", "symbol", "AAPL", 123)
        
        assert key == "prefix:symbol:AAPL:123"
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_batch_get_cached(self):
        """Test batch cache retrieval."""
        service = BaseService()
        service.redis_client = MagicMock()
        
        # Mock pipeline
        mock_pipeline = MagicMock()
        service.redis_client.pipeline.return_value = mock_pipeline
        mock_pipeline.execute.return_value = [
            json.dumps({"key1": "value1"}),
            None,
            json.dumps({"key3": "value3"})
        ]
        
        keys = ["key1", "key2", "key3"]
        result = await service.batch_get_cached(keys)
        
        expected = {
            "key1": {"key1": "value1"},
            "key3": {"key3": "value3"}
        }
        
        assert result == expected
        assert len(mock_pipeline.get.call_args_list) == 3
    
    @pytest.mark.services
    def test_safe_float_extract_pandas_series(self):
        """Test safe float extraction from pandas-like series."""
        service = BaseService()
        
        # Mock pandas Series
        mock_series = MagicMock()
        mock_series.iloc = [42.5]
        
        result = service.safe_float_extract(mock_series)
        
        assert result == 42.5
    
    @pytest.mark.services
    def test_safe_float_extract_scalar(self):
        """Test safe float extraction from scalar value."""
        service = BaseService()
        
        result = service.safe_float_extract("123.45")
        
        assert result == 123.45
    
    @pytest.mark.services
    def test_safe_float_extract_invalid(self):
        """Test safe float extraction with invalid input."""
        service = BaseService()
        
        result = service.safe_float_extract("invalid")
        
        assert result == 0.0
    
    @pytest.mark.services
    def test_format_percentage(self):
        """Test percentage formatting."""
        service = BaseService()
        
        assert service.format_percentage(12.3456) == 12.35
        assert service.format_percentage("invalid") == 0.0
    
    @pytest.mark.services
    def test_validate_symbol_valid(self):
        """Test stock symbol validation with valid input."""
        service = BaseService()
        
        assert service.validate_symbol("AAPL") == "AAPL"
        assert service.validate_symbol("aapl") == "AAPL"
        assert service.validate_symbol(" MSFT ") == "MSFT"
    
    @pytest.mark.services
    def test_validate_symbol_invalid(self):
        """Test stock symbol validation with invalid input."""
        service = BaseService()
        
        with pytest.raises(ValueError, match="Invalid symbol"):
            service.validate_symbol("")
        
        with pytest.raises(ValueError, match="Invalid symbol format"):
            service.validate_symbol("123INVALID")
        
        with pytest.raises(ValueError, match="Invalid symbol format"):
            service.validate_symbol("TOOLONGSTOCKSYMBOL")
    
    @pytest.mark.services
    def test_validate_timeframe(self):
        """Test timeframe validation."""
        service = BaseService()
        
        allowed = ["1d", "1w", "1m", "1y"]
        
        assert service.validate_timeframe("1d", allowed) == "1d"
        
        with pytest.raises(ValueError, match="Invalid timeframe"):
            service.validate_timeframe("invalid", allowed)
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_rate_limit_check_first_request(self):
        """Test rate limiting on first request."""
        service = BaseService()
        service.redis_client = MagicMock()
        service.redis_client.get.return_value = None  # First request
        
        result = await service.rate_limit_check(123, "test_endpoint")
        
        assert result is True
        service.redis_client.setex.assert_called_once()
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_rate_limit_check_under_limit(self):
        """Test rate limiting under the limit."""
        service = BaseService()
        service.redis_client = MagicMock()
        service.redis_client.get.return_value = "5"  # Under limit
        
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.RATE_LIMIT_REQUESTS = 100
            
            result = await service.rate_limit_check(123, "test_endpoint")
            
            assert result is True
            service.redis_client.incr.assert_called_once()
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_rate_limit_check_over_limit(self):
        """Test rate limiting over the limit."""
        service = BaseService()
        service.redis_client = MagicMock()
        service.redis_client.get.return_value = "100"  # At limit
        
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.RATE_LIMIT_REQUESTS = 100
            
            result = await service.rate_limit_check(123, "test_endpoint")
            
            assert result is False
    
    @pytest.mark.services
    def test_get_market_hours_weekday_open(self):
        """Test market hours during open hours on weekday."""
        service = BaseService()
        
        # Mock datetime to return Monday 10 AM
        with patch("app.services.base_service.datetime") as mock_dt:
            mock_now = Mock()
            mock_now.weekday.return_value = 0  # Monday
            mock_now.replace.return_value = mock_now
            mock_now.hour = 10
            mock_now.minute = 0
            mock_dt.now.return_value = mock_now
            
            # Setup comparison behavior
            mock_now.__le__ = Mock(return_value=True)
            mock_now.__ge__ = Mock(return_value=True)
            
            result = service.get_market_hours()
            
            assert "is_open" in result
            assert "is_weekday" in result
            assert result["is_weekday"] is True
    
    @pytest.mark.services
    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test service health check."""
        service = BaseService()
        service.redis_client = MagicMock()
        service.redis_client.ping.return_value = True
        
        result = await service.health_check()
        
        assert result["service"] == "BaseService"
        assert result["status"] == "healthy"
        assert result["redis_connected"] is True
        assert result["redis_status"] == "connected"