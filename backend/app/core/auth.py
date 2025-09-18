"""
JWT Authentication Service with Rate Limiting and Security
Implements comprehensive authentication with bcrypt password hashing,
JWT token management, and Redis-based rate limiting.
"""

import asyncio
import hashlib
import secrets
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple, Any

import bcrypt
import jwt
import redis.asyncio as redis
from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

class UserCredentials(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class RateLimitInfo(BaseModel):
    allowed: bool
    retry_after: Optional[int] = None
    attempts_remaining: int

class AuthService:
    """Comprehensive authentication service with security features"""

    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client
        self.jwt_secret = settings.JWT_SECRET_KEY
        self.jwt_algorithm = settings.JWT_ALGORITHM
        self.access_token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        self.refresh_token_expire_days = settings.REFRESH_TOKEN_EXPIRE_DAYS

        # Rate limiting configuration
        self.max_attempts = 5
        self.rate_limit_window = 900  # 15 minutes in seconds

    async def get_redis_client(self) -> redis.Redis:
        """Get Redis client for rate limiting"""
        if not self.redis_client:
            self.redis_client = redis.from_url(settings.REDIS_URL)
        return self.redis_client

    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt with salt"""
        try:
            # Generate salt and hash password
            salt = bcrypt.gensalt(rounds=12)
            hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
            return hashed.decode('utf-8')
        except Exception as e:
            logger.error(f"Password hashing failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Password processing failed"
            )

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against bcrypt hash"""
        try:
            return bcrypt.checkpw(
                plain_password.encode('utf-8'),
                hashed_password.encode('utf-8')
            )
        except Exception as e:
            logger.error(f"Password verification failed: {e}")
            return False

    def generate_jwt_token(self, user_data: Dict[str, Any]) -> TokenResponse:
        """Generate JWT access and refresh tokens"""
        try:
            # Current time
            now = datetime.utcnow()

            # Access token payload
            access_payload = {
                'user_id': user_data['user_id'],
                'email': user_data['email'],
                'subscription_tier': user_data.get('subscription_tier', 'free'),
                'iat': now,
                'exp': now + timedelta(minutes=self.access_token_expire_minutes),
                'type': 'access'
            }

            # Refresh token payload
            refresh_payload = {
                'user_id': user_data['user_id'],
                'iat': now,
                'exp': now + timedelta(days=self.refresh_token_expire_days),
                'type': 'refresh',
                'jti': secrets.token_urlsafe(32)  # Unique token ID
            }

            # Generate tokens
            access_token = jwt.encode(access_payload, self.jwt_secret, algorithm=self.jwt_algorithm)
            refresh_token = jwt.encode(refresh_payload, self.jwt_secret, algorithm=self.jwt_algorithm)

            return TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=self.access_token_expire_minutes * 60
            )

        except Exception as e:
            logger.error(f"Token generation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token generation failed"
            )

    def validate_jwt_token(self, token: str) -> Dict[str, Any]:
        """Validate JWT token and return payload or error"""
        try:
            # Clean token (remove Bearer prefix if present)
            if token.startswith('Bearer '):
                token = token[7:]

            # Decode and validate token
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm],
                options={"verify_exp": True}
            )

            return {
                'valid': True,
                'user_id': payload['user_id'],
                'email': payload.get('email'),
                'subscription_tier': payload.get('subscription_tier', 'free'),
                'token_type': payload.get('type', 'access'),
                'expires_at': payload['exp']
            }

        except jwt.ExpiredSignatureError:
            return {
                'valid': False,
                'error': 'TOKEN_EXPIRED',
                'suggestion': 'refresh_token_required'
            }
        except jwt.InvalidTokenError:
            return {
                'valid': False,
                'error': 'INVALID_TOKEN'
            }
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return {
                'valid': False,
                'error': 'MALFORMED_TOKEN'
            }

    async def check_rate_limit(self, identifier: str, ip_address: str) -> RateLimitInfo:
        """Check rate limiting for authentication attempts"""
        try:
            redis_client = await self.get_redis_client()

            # Create rate limit key (email + IP for security)
            rate_key = f"auth_attempts:{identifier}:{ip_address}"
            current_time = int(time.time())

            # Get current attempt count
            attempts = await redis_client.get(rate_key)
            current_attempts = int(attempts) if attempts else 0

            if current_attempts >= self.max_attempts:
                # Check if rate limit window has expired
                ttl = await redis_client.ttl(rate_key)
                if ttl > 0:
                    return RateLimitInfo(
                        allowed=False,
                        retry_after=ttl,
                        attempts_remaining=0
                    )
                else:
                    # Window expired, reset counter
                    await redis_client.delete(rate_key)
                    current_attempts = 0

            return RateLimitInfo(
                allowed=True,
                attempts_remaining=self.max_attempts - current_attempts - 1
            )

        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Fail open - allow request if rate limiting is broken
            return RateLimitInfo(allowed=True, attempts_remaining=4)

    async def record_failed_attempt(self, identifier: str, ip_address: str) -> None:
        """Record failed authentication attempt"""
        try:
            redis_client = await self.get_redis_client()
            rate_key = f"auth_attempts:{identifier}:{ip_address}"

            # Increment attempt counter
            await redis_client.incr(rate_key)
            # Set expiry if this is the first attempt
            await redis_client.expire(rate_key, self.rate_limit_window)

        except Exception as e:
            logger.error(f"Failed to record auth attempt: {e}")

    async def clear_rate_limit(self, identifier: str, ip_address: str) -> None:
        """Clear rate limit on successful authentication"""
        try:
            redis_client = await self.get_redis_client()
            rate_key = f"auth_attempts:{identifier}:{ip_address}"
            await redis_client.delete(rate_key)
        except Exception as e:
            logger.error(f"Failed to clear rate limit: {e}")

    async def attempt_login(self, credentials: UserCredentials, ip_address: str,
                          user_lookup_func) -> Dict[str, Any]:
        """Complete login flow with rate limiting and security checks"""
        try:
            # Check rate limiting
            rate_limit = await self.check_rate_limit(credentials.email, ip_address)
            if not rate_limit.allowed:
                logger.warning(f"Rate limited login attempt: {credentials.email} from {ip_address}")
                return {
                    'success': False,
                    'error': 'RATE_LIMITED',
                    'retry_after': rate_limit.retry_after
                }

            # Look up user (function provided by caller)
            user = await user_lookup_func(credentials.email)
            if not user:
                await self.record_failed_attempt(credentials.email, ip_address)
                return {
                    'success': False,
                    'error': 'INVALID_CREDENTIALS'
                }

            # Verify password
            if not self.verify_password(credentials.password, user['password_hash']):
                await self.record_failed_attempt(credentials.email, ip_address)
                return {
                    'success': False,
                    'error': 'INVALID_CREDENTIALS'
                }

            # Clear rate limit on successful auth
            await self.clear_rate_limit(credentials.email, ip_address)

            # Generate tokens
            tokens = self.generate_jwt_token({
                'user_id': user['id'],
                'email': user['email'],
                'subscription_tier': user.get('subscription_tier', 'free')
            })

            logger.info(f"Successful login: {credentials.email}")
            return {
                'success': True,
                'user_id': user['id'],
                'access_token': tokens.access_token,
                'refresh_token': tokens.refresh_token,
                'token_type': tokens.token_type,
                'expires_in': tokens.expires_in
            }

        except Exception as e:
            logger.error(f"Login attempt failed: {e}")
            return {
                'success': False,
                'error': 'AUTHENTICATION_ERROR'
            }

    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Generate new access token from valid refresh token"""
        try:
            # Validate refresh token
            validation = self.validate_jwt_token(refresh_token)
            if not validation['valid']:
                return validation

            if validation.get('token_type') != 'refresh':
                return {
                    'valid': False,
                    'error': 'INVALID_TOKEN_TYPE'
                }

            # Generate new access token
            new_tokens = self.generate_jwt_token({
                'user_id': validation['user_id'],
                'email': validation['email'],
                'subscription_tier': validation['subscription_tier']
            })

            return {
                'success': True,
                'access_token': new_tokens.access_token,
                'expires_in': new_tokens.expires_in
            }

        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            return {
                'success': False,
                'error': 'TOKEN_REFRESH_FAILED'
            }

# Global auth service instance
auth_service = AuthService()

def generate_expired_token(user_id: str) -> str:
    """Test helper to generate expired token"""
    expired_payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() - timedelta(seconds=1),
        'iat': datetime.utcnow() - timedelta(seconds=2)
    }
    return jwt.encode(expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)