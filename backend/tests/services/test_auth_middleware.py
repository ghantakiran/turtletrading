"""
Unit tests for authentication middleware
"""

import pytest
import pytest_asyncio
from unittest.mock import Mock, AsyncMock, patch
from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials

from app.core.auth_middleware import (
    get_token_from_request,
    get_current_user_required,
    get_current_user_optional,
    get_admin_user,
    get_premium_user,
    get_active_user,
    AuthenticationError,
    PermissionError,
    validate_api_limits,
    log_user_activity,
    require_roles,
    require_subscription,
    health_check
)
from app.models.auth_schemas import User, UserRole
from datetime import datetime


@pytest.fixture
def mock_user():
    """Create a mock user for testing."""
    return User(
        id=1,
        email="test@example.com",
        full_name="Test User",
        is_active=True,
        role=UserRole.USER,
        created_at=datetime.utcnow(),
        subscription_tier="free"
    )


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user for testing."""
    return User(
        id=2,
        email="admin@example.com",
        full_name="Admin User",
        is_active=True,
        role=UserRole.ADMIN,
        created_at=datetime.utcnow(),
        subscription_tier="premium"
    )


@pytest.fixture
def mock_premium_user():
    """Create a mock premium user for testing."""
    return User(
        id=3,
        email="premium@example.com",
        full_name="Premium User",
        is_active=True,
        role=UserRole.PREMIUM,
        created_at=datetime.utcnow(),
        subscription_tier="premium"
    )


@pytest.fixture
def mock_inactive_user():
    """Create a mock inactive user for testing."""
    return User(
        id=4,
        email="inactive@example.com",
        full_name="Inactive User",
        is_active=False,
        role=UserRole.USER,
        created_at=datetime.utcnow(),
        subscription_tier="free"
    )


@pytest.fixture
def mock_request():
    """Create a mock Request object."""
    request = Mock(spec=Request)
    request.client = Mock()
    request.client.host = "127.0.0.1"
    request.headers = {}
    return request


class TestTokenExtraction:
    """Test token extraction functionality."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_token_from_request_success(self):
        """Test successful token extraction."""
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="valid_jwt_token"
        )

        token = await get_token_from_request(credentials)
        assert token == "valid_jwt_token"

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_token_from_request_no_credentials(self):
        """Test token extraction with no credentials."""
        token = await get_token_from_request(None)
        assert token is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_token_from_request_invalid_scheme(self):
        """Test token extraction with invalid scheme."""
        credentials = HTTPAuthorizationCredentials(
            scheme="Basic",  # Not Bearer
            credentials="some_token"
        )

        token = await get_token_from_request(credentials)
        assert token is None


class TestCurrentUserRequired:
    """Test required authentication dependency."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_required_success(self, mock_user):
        """Test successful required authentication."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = mock_user

            user = await get_current_user_required("valid_token")
            assert user == mock_user
            mock_auth_service.get_current_user.assert_called_once_with("valid_token")

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_required_no_token(self):
        """Test required authentication with no token."""
        with pytest.raises(AuthenticationError) as exc_info:
            await get_current_user_required(None)

        assert exc_info.value.status_code == 401
        assert "Authentication token required" in str(exc_info.value.detail)

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_required_invalid_token(self):
        """Test required authentication with invalid token."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = None

            with pytest.raises(AuthenticationError) as exc_info:
                await get_current_user_required("invalid_token")

            assert exc_info.value.status_code == 401
            assert "Invalid authentication token" in str(exc_info.value.detail)

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_required_inactive_user(self, mock_inactive_user):
        """Test required authentication with inactive user."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = mock_inactive_user

            with pytest.raises(AuthenticationError) as exc_info:
                await get_current_user_required("valid_token")

            assert exc_info.value.status_code == 401
            assert "Account is inactive" in str(exc_info.value.detail)


class TestCurrentUserOptional:
    """Test optional authentication dependency."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_optional_success(self, mock_user):
        """Test successful optional authentication."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = mock_user

            user = await get_current_user_optional("valid_token")
            assert user == mock_user

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_optional_no_token(self):
        """Test optional authentication with no token."""
        user = await get_current_user_optional(None)
        assert user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_optional_invalid_token(self):
        """Test optional authentication with invalid token."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = None

            user = await get_current_user_optional("invalid_token")
            assert user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_optional_inactive_user(self, mock_inactive_user):
        """Test optional authentication with inactive user."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = mock_inactive_user

            user = await get_current_user_optional("valid_token")
            assert user is None


class TestAdminUser:
    """Test admin user dependency."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_admin_user_success(self, mock_admin_user):
        """Test successful admin user validation."""
        with patch("app.core.auth_middleware.get_current_user_required") as mock_get_user:
            mock_get_user.return_value = mock_admin_user

            user = await get_admin_user(mock_admin_user)
            assert user == mock_admin_user

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_admin_user_not_admin(self, mock_user):
        """Test admin user validation with non-admin user."""
        with pytest.raises(PermissionError) as exc_info:
            await get_admin_user(mock_user)

        assert exc_info.value.status_code == 403
        assert "Admin access required" in str(exc_info.value.detail)


class TestPremiumUser:
    """Test premium user dependency."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_premium_user_success(self, mock_premium_user):
        """Test successful premium user validation."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.is_premium.return_value = True

            user = await get_premium_user(mock_premium_user)
            assert user == mock_premium_user

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_premium_user_not_premium(self, mock_user):
        """Test premium user validation with non-premium user."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.is_premium.return_value = False

            with pytest.raises(PermissionError) as exc_info:
                await get_premium_user(mock_user)

            assert exc_info.value.status_code == 403
            assert "Premium subscription required" in str(exc_info.value.detail)


class TestActiveUser:
    """Test active user dependency."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_active_user_success(self, mock_user):
        """Test successful active user validation."""
        user = await get_active_user(mock_user)
        assert user == mock_user

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_active_user_inactive(self, mock_inactive_user):
        """Test active user validation with inactive user."""
        with pytest.raises(AuthenticationError) as exc_info:
            await get_active_user(mock_inactive_user)

        assert exc_info.value.status_code == 401
        assert "Account is inactive" in str(exc_info.value.detail)


class TestRoleDecorators:
    """Test role-based decorators."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_require_roles_decorator_success(self, mock_admin_user):
        """Test successful role requirement."""
        @require_roles([UserRole.ADMIN, UserRole.PREMIUM])
        async def test_endpoint(current_user: User):
            return f"Access granted to {current_user.email}"

        result = await test_endpoint(current_user=mock_admin_user)
        assert "Access granted to admin@example.com" in result

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_require_roles_decorator_forbidden(self, mock_user):
        """Test role requirement with insufficient role."""
        @require_roles([UserRole.ADMIN])
        async def test_endpoint(current_user: User):
            return "Access granted"

        with pytest.raises(PermissionError) as exc_info:
            await test_endpoint(current_user=mock_user)

        assert exc_info.value.status_code == 403
        assert "Access requires one of: ['admin']" in str(exc_info.value.detail)

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_require_roles_decorator_no_user(self):
        """Test role requirement with no user."""
        @require_roles([UserRole.ADMIN])
        async def test_endpoint():
            return "Access granted"

        with pytest.raises(AuthenticationError):
            await test_endpoint()


class TestSubscriptionDecorators:
    """Test subscription-based decorators."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_require_subscription_decorator_success(self, mock_premium_user):
        """Test successful subscription requirement."""
        @require_subscription(["premium", "pro"])
        async def test_endpoint(current_user: User):
            return f"Access granted to {current_user.email}"

        result = await test_endpoint(current_user=mock_premium_user)
        assert "Access granted to premium@example.com" in result

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_require_subscription_decorator_admin_bypass(self, mock_admin_user):
        """Test subscription requirement with admin bypass."""
        @require_subscription(["premium"])
        async def test_endpoint(current_user: User):
            return f"Access granted to {current_user.email}"

        result = await test_endpoint(current_user=mock_admin_user)
        assert "Access granted to admin@example.com" in result

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_require_subscription_decorator_forbidden(self, mock_user):
        """Test subscription requirement with insufficient subscription."""
        @require_subscription(["premium", "pro"])
        async def test_endpoint(current_user: User):
            return "Access granted"

        with pytest.raises(PermissionError) as exc_info:
            await test_endpoint(current_user=mock_user)

        assert exc_info.value.status_code == 403
        assert "Access requires subscription tier" in str(exc_info.value.detail)


class TestAPIValidation:
    """Test API limit validation and logging."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_validate_api_limits_success(self, mock_user, mock_request):
        """Test successful API limit validation."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.check_api_limits.return_value = True

            result = await validate_api_limits(mock_user, "/test/endpoint", mock_request)
            assert result is True

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_validate_api_limits_exceeded(self, mock_user, mock_request):
        """Test API limit exceeded."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.check_api_limits.return_value = False

            with pytest.raises(HTTPException) as exc_info:
                await validate_api_limits(mock_user, "/test/endpoint", mock_request)

            assert exc_info.value.status_code == 429
            assert "API rate limit exceeded" in str(exc_info.value.detail)

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_validate_api_limits_error_handling(self, mock_user, mock_request):
        """Test API limit validation error handling."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.check_api_limits.side_effect = Exception("Service error")

            # Should allow access on error
            result = await validate_api_limits(mock_user, "/test/endpoint", mock_request)
            assert result is True

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_log_user_activity_success(self, mock_user, mock_request):
        """Test successful user activity logging."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.log_api_usage.return_value = True

            # Should not raise exception
            await log_user_activity(
                mock_user, "/test/endpoint", mock_request, 100.5, 200
            )

            mock_auth_service.log_api_usage.assert_called_once_with(
                user_id=mock_user.id,
                endpoint="/test/endpoint",
                response_time=100.5,
                status_code=200
            )

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_log_user_activity_error_handling(self, mock_user, mock_request):
        """Test user activity logging error handling."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.log_api_usage.side_effect = Exception("Logging error")

            # Should not raise exception, just log the error
            await log_user_activity(
                mock_user, "/test/endpoint", mock_request, 100.5, 200
            )


class TestHealthCheck:
    """Test middleware health check."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Test successful health check."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.health_check.return_value = {"status": "healthy"}

            health = await health_check()

            assert isinstance(health, dict)
            assert health["middleware"] == "healthy"
            assert health["auth_service"] == "healthy"
            assert health["jwt_validation"] == "operational"
            assert health["dependencies"] == "loaded"

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_health_check_auth_service_error(self):
        """Test health check with auth service error."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.health_check.side_effect = Exception("Service error")

            health = await health_check()

            assert health["middleware"] == "unhealthy"
            assert "error" in health
            assert "Service error" in health["error"]


class TestErrorClasses:
    """Test custom error classes."""

    @pytest.mark.unit
    @pytest.mark.auth
    def test_authentication_error_default(self):
        """Test AuthenticationError with default message."""
        error = AuthenticationError()

        assert error.status_code == 401
        assert error.detail == "Could not validate credentials"
        assert error.headers == {"WWW-Authenticate": "Bearer"}

    @pytest.mark.unit
    @pytest.mark.auth
    def test_authentication_error_custom(self):
        """Test AuthenticationError with custom message."""
        error = AuthenticationError("Custom auth error")

        assert error.status_code == 401
        assert error.detail == "Custom auth error"
        assert error.headers == {"WWW-Authenticate": "Bearer"}

    @pytest.mark.unit
    @pytest.mark.auth
    def test_permission_error_default(self):
        """Test PermissionError with default message."""
        error = PermissionError()

        assert error.status_code == 403
        assert error.detail == "Insufficient permissions"

    @pytest.mark.unit
    @pytest.mark.auth
    def test_permission_error_custom(self):
        """Test PermissionError with custom message."""
        error = PermissionError("Custom permission error")

        assert error.status_code == 403
        assert error.detail == "Custom permission error"


class TestIntegrationScenarios:
    """Integration-style tests for middleware components."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_complete_authentication_flow(self, mock_user):
        """Test complete authentication flow through middleware."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = mock_user

            # Simulate complete flow: token extraction -> user validation -> access granted
            token = "valid_jwt_token"

            # 1. Extract token (would be called by FastAPI)
            extracted_token = await get_token_from_request(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            )
            assert extracted_token == token

            # 2. Get current user
            current_user = await get_current_user_required(extracted_token)
            assert current_user == mock_user

            # 3. Validate access for active user
            active_user = await get_active_user(current_user)
            assert active_user == mock_user

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_admin_access_flow(self, mock_admin_user):
        """Test admin access flow."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = mock_admin_user

            # Extract token and get user
            token = "admin_jwt_token"
            current_user = await get_current_user_required(token)

            # Validate admin access
            admin_user = await get_admin_user(current_user)
            assert admin_user == mock_admin_user
            assert admin_user.role == UserRole.ADMIN

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_premium_access_flow(self, mock_premium_user):
        """Test premium access flow."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = mock_premium_user
            mock_auth_service.is_premium.return_value = True

            # Extract token and get user
            token = "premium_jwt_token"
            current_user = await get_current_user_required(token)

            # Validate premium access
            premium_user = await get_premium_user(current_user)
            assert premium_user == mock_premium_user
            assert premium_user.subscription_tier == "premium"

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_failed_authentication_flow(self):
        """Test failed authentication flow."""
        with patch("app.core.auth_middleware.auth_service") as mock_auth_service:
            mock_auth_service.get_current_user.return_value = None

            # Try to authenticate with invalid token
            with pytest.raises(AuthenticationError) as exc_info:
                await get_current_user_required("invalid_token")

            assert exc_info.value.status_code == 401
            assert "Invalid authentication token" in str(exc_info.value.detail)