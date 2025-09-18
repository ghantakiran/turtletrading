"""
Authentication middleware and dependencies for TurtleTrading API
"""

from fastapi import HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from functools import wraps
import asyncio

from app.services.auth_service import AuthService
from app.models.auth_schemas import User, UserRole
from loguru import logger


# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)

# Global auth service instance
auth_service = AuthService()


class AuthenticationError(HTTPException):
    """Custom authentication error"""
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class PermissionError(HTTPException):
    """Custom permission error"""
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


async def get_token_from_request(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """
    Extract JWT token from Authorization header
    Returns None if no token is provided (for optional auth endpoints)
    """
    if credentials is None:
        return None

    if credentials.scheme.lower() != "bearer":
        return None

    return credentials.credentials


async def get_current_user_required(
    token: Optional[str] = Depends(get_token_from_request)
) -> User:
    """
    Dependency to get current authenticated user (required)
    Raises 401 if no valid token is provided
    """
    if not token:
        logger.warning("No authentication token provided")
        raise AuthenticationError("Authentication token required")

    try:
        user = await auth_service.get_current_user(token)
        if not user:
            logger.warning(f"Invalid token provided")
            raise AuthenticationError("Invalid authentication token")

        if not user.is_active:
            logger.warning(f"Inactive user attempted access: {user.email}")
            raise AuthenticationError("Account is inactive")

        return user

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating authentication token: {e}")
        raise AuthenticationError("Authentication validation failed")


async def get_current_user_optional(
    token: Optional[str] = Depends(get_token_from_request)
) -> Optional[User]:
    """
    Dependency to get current authenticated user (optional)
    Returns None if no valid token is provided
    Used for endpoints that work with or without authentication
    """
    if not token:
        return None

    try:
        user = await auth_service.get_current_user(token)
        if user and not user.is_active:
            logger.warning(f"Inactive user attempted access: {user.email}")
            return None

        return user

    except Exception as e:
        logger.error(f"Error validating optional authentication token: {e}")
        return None


async def get_admin_user(
    current_user: User = Depends(get_current_user_required)
) -> User:
    """
    Dependency to ensure current user is an admin
    """
    if current_user.role != UserRole.ADMIN:
        logger.warning(f"Non-admin user attempted admin access: {current_user.email}")
        raise PermissionError("Admin access required")

    return current_user


async def get_premium_user(
    current_user: User = Depends(get_current_user_required)
) -> User:
    """
    Dependency to ensure current user has premium access
    """
    if not await auth_service.is_premium(current_user):
        logger.warning(f"Non-premium user attempted premium access: {current_user.email}")
        raise PermissionError("Premium subscription required")

    return current_user


async def get_active_user(
    current_user: User = Depends(get_current_user_required)
) -> User:
    """
    Dependency to ensure current user is active
    """
    if not current_user.is_active:
        logger.warning(f"Inactive user attempted access: {current_user.email}")
        raise AuthenticationError("Account is inactive")

    return current_user


def require_roles(allowed_roles: List[UserRole]):
    """
    Decorator factory for role-based access control

    Usage:
    @require_roles([UserRole.ADMIN, UserRole.PREMIUM])
    async def admin_or_premium_endpoint():
        pass
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get('current_user')

            if not current_user:
                # If no current_user in kwargs, try to extract from args
                for arg in args:
                    if isinstance(arg, User):
                        current_user = arg
                        break

            if not current_user:
                raise AuthenticationError("User authentication required")

            if current_user.role not in allowed_roles:
                logger.warning(
                    f"User {current_user.email} with role {current_user.role} "
                    f"attempted access to endpoint requiring roles {allowed_roles}"
                )
                raise PermissionError(f"Access requires one of: {[role.value for role in allowed_roles]}")

            return await func(*args, **kwargs)

        return wrapper
    return decorator


def require_subscription(required_tiers: List[str]):
    """
    Decorator factory for subscription-based access control

    Usage:
    @require_subscription(["premium", "pro"])
    async def premium_endpoint():
        pass
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get('current_user')

            if not current_user:
                # If no current_user in kwargs, try to extract from args
                for arg in args:
                    if isinstance(arg, User):
                        current_user = arg
                        break

            if not current_user:
                raise AuthenticationError("User authentication required")

            if current_user.subscription_tier not in required_tiers and current_user.role != UserRole.ADMIN:
                logger.warning(
                    f"User {current_user.email} with subscription {current_user.subscription_tier} "
                    f"attempted access to endpoint requiring tiers {required_tiers}"
                )
                raise PermissionError(f"Access requires subscription tier: {required_tiers}")

            return await func(*args, **kwargs)

        return wrapper
    return decorator


async def validate_api_limits(
    user: User,
    endpoint: str,
    request: Request
) -> bool:
    """
    Validate user API limits for the given endpoint
    """
    try:
        # Check if user has exceeded API limits
        within_limits = await auth_service.check_api_limits(user, endpoint)

        if not within_limits:
            logger.warning(f"User {user.email} exceeded API limits for endpoint {endpoint}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="API rate limit exceeded"
            )

        return True

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating API limits: {e}")
        # Allow access on error to prevent blocking users
        return True


async def log_user_activity(
    user: User,
    endpoint: str,
    request: Request,
    response_time: float = 0.0,
    status_code: int = 200
) -> None:
    """
    Log user activity for analytics and monitoring
    """
    try:
        await auth_service.log_api_usage(
            user_id=user.id,
            endpoint=endpoint,
            response_time=response_time,
            status_code=status_code
        )
    except Exception as e:
        logger.error(f"Error logging user activity: {e}")


class AuthDependencies:
    """
    Collection of authentication dependencies for easy import
    """

    @staticmethod
    def current_user() -> User:
        """Get current authenticated user (required)"""
        return Depends(get_current_user_required)

    @staticmethod
    def current_user_optional() -> Optional[User]:
        """Get current authenticated user (optional)"""
        return Depends(get_current_user_optional)

    @staticmethod
    def admin_user() -> User:
        """Get current admin user"""
        return Depends(get_admin_user)

    @staticmethod
    def premium_user() -> User:
        """Get current premium user"""
        return Depends(get_premium_user)

    @staticmethod
    def active_user() -> User:
        """Get current active user"""
        return Depends(get_active_user)


# Convenience aliases for common dependency patterns
CurrentUser = Depends(get_current_user_required)
CurrentUserOptional = Depends(get_current_user_optional)
AdminUser = Depends(get_admin_user)
PremiumUser = Depends(get_premium_user)
ActiveUser = Depends(get_active_user)


# Role-based dependency factories
def require_admin():
    """Dependency that requires admin role"""
    return Depends(get_admin_user)


def require_premium():
    """Dependency that requires premium subscription"""
    return Depends(get_premium_user)


def require_any_role(*roles: UserRole):
    """
    Create a dependency that requires any of the specified roles

    Usage:
    require_admin_or_premium = require_any_role(UserRole.ADMIN, UserRole.PREMIUM)
    """
    async def check_roles(current_user: User = Depends(get_current_user_required)) -> User:
        if current_user.role not in roles:
            raise PermissionError(f"Access requires one of: {[role.value for role in roles]}")
        return current_user

    return Depends(check_roles)


def require_subscription_tier(*tiers: str):
    """
    Create a dependency that requires any of the specified subscription tiers

    Usage:
    require_premium_subscription = require_subscription_tier("premium", "pro")
    """
    async def check_subscription(current_user: User = Depends(get_current_user_required)) -> User:
        if current_user.subscription_tier not in tiers and current_user.role != UserRole.ADMIN:
            raise PermissionError(f"Access requires subscription tier: {list(tiers)}")
        return current_user

    return Depends(check_subscription)


async def health_check() -> dict:
    """
    Authentication middleware health check
    """
    try:
        auth_health = await auth_service.health_check()

        return {
            "middleware": "healthy",
            "auth_service": auth_health.get("status", "unknown"),
            "jwt_validation": "operational",
            "dependencies": "loaded"
        }

    except Exception as e:
        logger.error(f"Auth middleware health check failed: {e}")
        return {
            "middleware": "unhealthy",
            "error": str(e)
        }