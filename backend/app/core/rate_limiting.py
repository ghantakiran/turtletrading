"""
Rate limiting configuration and utilities for TurtleTrading API
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Request
from redis import Redis
import os
from loguru import logger

# Redis connection for rate limiting storage
def get_redis_connection():
    """Get Redis connection for rate limiting storage"""
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        return Redis.from_url(redis_url, decode_responses=True)
    except Exception as e:
        logger.warning(f"Could not connect to Redis for rate limiting: {e}")
        # Fallback to in-memory storage (not recommended for production)
        return None

# Initialize rate limiter
redis_client = get_redis_connection()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv("REDIS_URL", "redis://localhost:6379") if redis_client else "memory://",
    default_limits=["1000 per day", "100 per hour"]
)

# Rate limit configurations for different endpoint types
RATE_LIMITS = {
    # Authentication endpoints (more restrictive)
    "auth_login": "5 per minute",          # Login attempts
    "auth_register": "3 per minute",       # Registration attempts
    "auth_password_change": "3 per hour",  # Password changes
    "auth_delete_account": "1 per hour",   # Account deletion
    "auth_refresh": "10 per minute",       # Token refresh

    # General authentication operations
    "auth_profile": "30 per minute",       # Profile operations
    "auth_logout": "10 per minute",        # Logout operations

    # API endpoints (less restrictive)
    "api_general": "60 per minute",        # General API calls
    "api_data_heavy": "30 per minute",     # Data-heavy operations
    "websocket": "100 per minute",         # WebSocket connections
}

def setup_rate_limiting(app: FastAPI):
    """Setup rate limiting for the FastAPI application"""

    # Add rate limiter to app state
    app.state.limiter = limiter

    # Add exception handler for rate limit exceeded
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    logger.info("Rate limiting configured successfully")

    # Log rate limiting storage type
    if redis_client:
        logger.info("Using Redis for rate limiting storage")
    else:
        logger.warning("Using in-memory storage for rate limiting (not recommended for production)")

def get_client_identifier(request: Request) -> str:
    """
    Get a unique identifier for the client making the request.
    Uses IP address but can be extended to use user ID for authenticated requests.
    """
    # Try to get real IP from headers (for production behind proxy)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fallback to direct client IP
    return request.client.host if request.client else "unknown"

def get_user_identifier(request: Request) -> str:
    """
    Get user-specific identifier for authenticated requests.
    This provides more granular rate limiting per user.
    """
    # Try to get user from request state (set by authentication middleware)
    user = getattr(request.state, "user", None)
    if user:
        return f"user:{user.id}"

    # Fallback to IP-based identification
    return get_client_identifier(request)

# Custom rate limiting decorators for different scenarios
def auth_rate_limit(endpoint_type: str):
    """
    Custom rate limiting decorator for authentication endpoints
    """
    def decorator(func):
        # Get the rate limit for this endpoint type
        rate_limit = RATE_LIMITS.get(endpoint_type, "10 per minute")
        return limiter.limit(rate_limit, key_func=get_client_identifier)(func)
    return decorator

def user_rate_limit(endpoint_type: str):
    """
    Custom rate limiting decorator for user-specific endpoints
    """
    def decorator(func):
        # Get the rate limit for this endpoint type
        rate_limit = RATE_LIMITS.get(endpoint_type, "30 per minute")
        return limiter.limit(rate_limit, key_func=get_user_identifier)(func)
    return decorator

def api_rate_limit(endpoint_type: str = "api_general"):
    """
    Custom rate limiting decorator for general API endpoints
    """
    def decorator(func):
        # Get the rate limit for this endpoint type
        rate_limit = RATE_LIMITS.get(endpoint_type, "60 per minute")
        return limiter.limit(rate_limit, key_func=get_client_identifier)(func)
    return decorator

# Rate limiting middleware
class RateLimitMiddleware:
    """
    Middleware to add rate limiting context to requests
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Add rate limiting context to the request
            # This can be used for custom rate limiting logic
            pass

        await self.app(scope, receive, send)

# Utility functions for manual rate limit checking
def check_rate_limit(key: str, limit: str) -> bool:
    """
    Manually check if a rate limit would be exceeded
    Returns True if the request would be allowed, False if it would be rate limited
    """
    try:
        # This is a simplified check - in practice you'd need to implement
        # the same logic as slowapi uses
        return True
    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        return True  # Allow request if check fails

def get_rate_limit_status(key: str, limit: str) -> dict:
    """
    Get current rate limit status for a key
    Returns information about current usage and reset time
    """
    try:
        # This would return current rate limit status
        # Implementation depends on storage backend
        return {
            "limit": limit,
            "remaining": "unknown",
            "reset_time": "unknown"
        }
    except Exception as e:
        logger.error(f"Error getting rate limit status: {e}")
        return {"error": str(e)}

# Rate limit response headers
def add_rate_limit_headers(response, limit_info: dict):
    """
    Add rate limiting headers to response
    """
    if limit_info:
        response.headers["X-RateLimit-Limit"] = str(limit_info.get("limit", ""))
        response.headers["X-RateLimit-Remaining"] = str(limit_info.get("remaining", ""))
        response.headers["X-RateLimit-Reset"] = str(limit_info.get("reset_time", ""))

    return response