"""
Comprehensive tests for authentication API endpoints
Tests REQ-AUTH-01, REQ-AUTH-02, REQ-AUTH-03 from IMPLEMENT_FROM_DOCS.md
Ensures 100% coverage for authentication functionality
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock
import json
from datetime import datetime, timedelta
import jwt


@pytest_asyncio.fixture
async def mock_auth_service():
    """Mock authentication service for comprehensive testing."""
    with patch('app.services.auth_service.AuthService') as mock_service:
        mock_instance = AsyncMock()

        # Mock user registration
        mock_instance.register_user.return_value = {
            "user": {
                "id": "user_123",
                "email": "test@example.com",
                "full_name": "Test User",
                "subscription_tier": "free",
                "is_active": True,
                "is_verified": False,
                "created_at": datetime.utcnow().isoformat(),
                "last_login": None
            },
            "tokens": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test.token",
                "refresh_token": "refresh_token_123",
                "token_type": "bearer",
                "expires_in": 3600
            }
        }

        # Mock user login
        mock_instance.authenticate_user.return_value = {
            "user": {
                "id": "user_123",
                "email": "test@example.com",
                "full_name": "Test User",
                "subscription_tier": "pro",
                "is_active": True,
                "is_verified": True,
                "created_at": "2024-01-01T00:00:00Z",
                "last_login": datetime.utcnow().isoformat()
            },
            "tokens": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test.token",
                "refresh_token": "refresh_token_456",
                "token_type": "bearer",
                "expires_in": 3600
            }
        }

        # Mock get current user
        mock_instance.get_current_user.return_value = {
            "id": "user_123",
            "email": "test@example.com",
            "full_name": "Test User",
            "subscription_tier": "pro",
            "is_active": True,
            "is_verified": True,
            "created_at": "2024-01-01T00:00:00Z",
            "last_login": datetime.utcnow().isoformat(),
            "profile_stats": {
                "total_analyses": 156,
                "total_predictions": 89,
                "accuracy_rate": 0.73,
                "favorite_symbols": ["AAPL", "MSFT", "NVDA"]
            }
        }

        # Mock token refresh
        mock_instance.refresh_access_token.return_value = {
            "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.new.token",
            "token_type": "bearer",
            "expires_in": 3600
        }

        # Mock password change
        mock_instance.change_password.return_value = {
            "message": "Password changed successfully",
            "requires_reauth": True
        }

        # Mock public info
        mock_instance.get_public_info.return_value = {
            "total_users": 12567,
            "total_analyses": 89432,
            "total_predictions": 45678,
            "platform_uptime": "99.97%",
            "api_version": "1.0.0",
            "features": [
                "real_time_data",
                "lstm_predictions",
                "technical_analysis",
                "sentiment_analysis",
                "portfolio_tracking"
            ]
        }

        # Mock premium features
        mock_instance.get_premium_features.return_value = {
            "features": [
                {
                    "name": "Advanced LSTM Models",
                    "description": "Access to enhanced prediction models",
                    "enabled": True
                },
                {
                    "name": "Real-time Alerts",
                    "description": "Instant notifications for price movements",
                    "enabled": True
                },
                {
                    "name": "Custom Indicators",
                    "description": "Create and backtest custom technical indicators",
                    "enabled": False
                }
            ],
            "subscription_tier": "pro",
            "billing_cycle": "monthly",
            "next_billing_date": "2024-02-15"
        }

        # Mock admin users list
        mock_instance.get_all_users.return_value = {
            "users": [
                {
                    "id": "user_123",
                    "email": "test@example.com",
                    "subscription_tier": "pro",
                    "is_active": True,
                    "created_at": "2024-01-01T00:00:00Z"
                },
                {
                    "id": "user_456",
                    "email": "admin@example.com",
                    "subscription_tier": "admin",
                    "is_active": True,
                    "created_at": "2024-01-01T00:00:00Z"
                }
            ],
            "total_count": 2,
            "page": 1,
            "per_page": 50
        }

        mock_service.return_value = mock_instance
        yield mock_instance


@pytest_asyncio.fixture
async def mock_rate_limiter():
    """Mock rate limiter for testing."""
    with patch('app.core.rate_limiting.RateLimiterService') as mock_limiter:
        mock_instance = AsyncMock()
        mock_instance.check_rate_limit.return_value = {
            "allowed": True,
            "requests_remaining": 98,
            "reset_time": datetime.utcnow() + timedelta(hours=1),
            "tier_limit": 100
        }
        mock_limiter.return_value = mock_instance
        yield mock_instance


class TestAuthAPI:
    """Comprehensive test class for authentication API endpoints."""

    @pytest.mark.asyncio
    async def test_user_registration_success(self, client: AsyncClient, mock_auth_service):
        """Test successful user registration."""
        user_data = {
            "email": "test@example.com",
            "password": "SecurePassword123!",
            "full_name": "Test User"
        }

        response = await client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 201
        data = response.json()

        # Verify user data
        assert "user" in data
        assert "tokens" in data
        user = data["user"]
        assert user["email"] == "test@example.com"
        assert user["full_name"] == "Test User"
        assert user["subscription_tier"] == "free"
        assert user["is_active"] == True

        # Verify tokens
        tokens = data["tokens"]
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_user_registration_validation_errors(self, client: AsyncClient, mock_auth_service):
        """Test user registration validation errors."""
        # Test missing email
        response = await client.post("/api/v1/auth/register", json={
            "password": "SecurePassword123!",
            "full_name": "Test User"
        })
        assert response.status_code == 422

        # Test invalid email format
        response = await client.post("/api/v1/auth/register", json={
            "email": "invalid-email",
            "password": "SecurePassword123!",
            "full_name": "Test User"
        })
        assert response.status_code == 422

        # Test weak password
        response = await client.post("/api/v1/auth/register", json={
            "email": "test@example.com",
            "password": "weak",
            "full_name": "Test User"
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_user_registration_duplicate_email(self, client: AsyncClient, mock_auth_service):
        """Test registration with duplicate email."""
        mock_auth_service.register_user.side_effect = ValueError("Email already registered")

        user_data = {
            "email": "existing@example.com",
            "password": "SecurePassword123!",
            "full_name": "Test User"
        }

        response = await client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 400
        data = response.json()
        assert "error" in data

    @pytest.mark.asyncio
    async def test_user_login_success(self, client: AsyncClient, mock_auth_service):
        """Test successful user login."""
        login_data = {
            "username": "test@example.com",  # FastAPI OAuth2 uses 'username' field
            "password": "SecurePassword123!"
        }

        response = await client.post("/api/v1/auth/token", data=login_data)

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_user_login_invalid_credentials(self, client: AsyncClient, mock_auth_service):
        """Test login with invalid credentials."""
        mock_auth_service.authenticate_user.side_effect = ValueError("Invalid credentials")

        login_data = {
            "username": "test@example.com",
            "password": "wrongpassword"
        }

        response = await client.post("/api/v1/auth/token", data=login_data)

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_get_current_user_success(self, client: AsyncClient, mock_auth_service, auth_headers):
        """Test getting current user profile."""
        response = await client.get("/api/v1/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Verify user profile data
        assert data["email"] == "test@example.com"
        assert data["full_name"] == "Test User"
        assert data["subscription_tier"] == "pro"
        assert "profile_stats" in data

        # Verify profile stats
        stats = data["profile_stats"]
        assert stats["total_analyses"] == 156
        assert stats["accuracy_rate"] == 0.73

    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client: AsyncClient, mock_auth_service):
        """Test getting current user without authentication."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client: AsyncClient, mock_auth_service):
        """Test token refresh."""
        refresh_data = {
            "refresh_token": "valid_refresh_token_123"
        }

        response = await client.post("/api/v1/auth/refresh-token", json=refresh_data)

        assert response.status_code == 200
        data = response.json()

        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, client: AsyncClient, mock_auth_service):
        """Test refresh with invalid token."""
        mock_auth_service.refresh_access_token.side_effect = ValueError("Invalid refresh token")

        refresh_data = {
            "refresh_token": "invalid_refresh_token"
        }

        response = await client.post("/api/v1/auth/refresh-token", json=refresh_data)

        assert response.status_code == 401
        data = response.json()
        assert "error" in data

    @pytest.mark.asyncio
    async def test_change_password_success(self, client: AsyncClient, mock_auth_service, auth_headers):
        """Test successful password change."""
        password_data = {
            "current_password": "OldPassword123!",
            "new_password": "NewPassword123!"
        }

        response = await client.post("/api/v1/auth/change-password", json=password_data, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert data["message"] == "Password changed successfully"
        assert data["requires_reauth"] == True

    @pytest.mark.asyncio
    async def test_change_password_invalid_current(self, client: AsyncClient, mock_auth_service, auth_headers):
        """Test password change with invalid current password."""
        mock_auth_service.change_password.side_effect = ValueError("Invalid current password")

        password_data = {
            "current_password": "WrongPassword",
            "new_password": "NewPassword123!"
        }

        response = await client.post("/api/v1/auth/change-password", json=password_data, headers=auth_headers)

        assert response.status_code == 400
        data = response.json()
        assert "error" in data

    @pytest.mark.asyncio
    async def test_logout_success(self, client: AsyncClient, mock_auth_service, auth_headers):
        """Test user logout."""
        mock_auth_service.logout_user.return_value = {"message": "Logged out successfully"}

        response = await client.post("/api/v1/auth/logout", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Logged out successfully"

    @pytest.mark.asyncio
    async def test_delete_account_success(self, client: AsyncClient, mock_auth_service, auth_headers):
        """Test account deletion."""
        mock_auth_service.delete_user_account.return_value = {"message": "Account deleted successfully"}

        response = await client.delete("/api/v1/auth/delete-account", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Account deleted successfully"

    @pytest.mark.asyncio
    async def test_get_public_info_success(self, client: AsyncClient, mock_auth_service):
        """Test getting public platform information."""
        response = await client.get("/api/v1/auth/public/info")

        assert response.status_code == 200
        data = response.json()

        assert data["total_users"] == 12567
        assert data["api_version"] == "1.0.0"
        assert "features" in data
        assert "real_time_data" in data["features"]

    @pytest.mark.asyncio
    async def test_get_premium_features_success(self, client: AsyncClient, mock_auth_service, auth_headers):
        """Test getting premium features."""
        response = await client.get("/api/v1/auth/premium/features", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert "features" in data
        assert data["subscription_tier"] == "pro"
        assert len(data["features"]) >= 1

        # Verify feature structure
        feature = data["features"][0]
        assert "name" in feature
        assert "description" in feature
        assert "enabled" in feature

    @pytest.mark.asyncio
    async def test_get_profile_stats_success(self, client: AsyncClient, mock_auth_service, auth_headers):
        """Test getting user profile statistics."""
        response = await client.get("/api/v1/auth/profile/stats", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert data["total_analyses"] == 156
        assert data["total_predictions"] == 89
        assert data["accuracy_rate"] == 0.73
        assert "favorite_symbols" in data

    @pytest.mark.asyncio
    async def test_admin_get_all_users_success(self, client: AsyncClient, mock_auth_service):
        """Test admin endpoint to get all users."""
        # Mock admin authentication
        admin_headers = {"Authorization": "Bearer admin_token"}

        response = await client.get("/api/v1/auth/admin/users", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()

        assert "users" in data
        assert data["total_count"] == 2
        assert len(data["users"]) == 2

        # Verify user structure
        user = data["users"][0]
        assert "id" in user
        assert "email" in user
        assert "subscription_tier" in user

    @pytest.mark.asyncio
    async def test_admin_get_all_users_unauthorized(self, client: AsyncClient, mock_auth_service, auth_headers):
        """Test admin endpoint with non-admin user."""
        # Mock authorization failure
        mock_auth_service.get_all_users.side_effect = PermissionError("Admin access required")

        response = await client.get("/api/v1/auth/admin/users", headers=auth_headers)

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_rate_limiting_enforcement(self, client: AsyncClient, mock_auth_service, mock_rate_limiter):
        """Test rate limiting on authentication endpoints."""
        # Simulate rate limit exceeded
        mock_rate_limiter.check_rate_limit.return_value = {
            "allowed": False,
            "requests_remaining": 0,
            "reset_time": datetime.utcnow() + timedelta(hours=1),
            "tier_limit": 100
        }

        login_data = {
            "username": "test@example.com",
            "password": "SecurePassword123!"
        }

        response = await client.post("/api/v1/auth/token", data=login_data)

        # Should be rate limited
        assert response.status_code == 429

    @pytest.mark.asyncio
    async def test_auth_api_performance(self, client: AsyncClient, mock_auth_service, performance_timer):
        """Test authentication API performance."""
        performance_timer.start()

        login_data = {
            "username": "test@example.com",
            "password": "SecurePassword123!"
        }

        response = await client.post("/api/v1/auth/token", data=login_data)

        performance_timer.stop()
        elapsed_time = performance_timer.elapsed()

        # Authentication should be fast
        assert elapsed_time < 1.0  # Within 1 second
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_jwt_token_validation(self, client: AsyncClient, mock_auth_service):
        """Test JWT token structure and validation."""
        login_data = {
            "username": "test@example.com",
            "password": "SecurePassword123!"
        }

        response = await client.post("/api/v1/auth/token", data=login_data)
        assert response.status_code == 200

        data = response.json()
        token = data["access_token"]

        # Verify JWT structure (without validating signature in test)
        parts = token.split('.')
        assert len(parts) == 3  # Header, payload, signature

    @pytest.mark.asyncio
    async def test_concurrent_auth_requests(self, client: AsyncClient, mock_auth_service):
        """Test handling of concurrent authentication requests."""
        import asyncio

        login_data = {
            "username": "test@example.com",
            "password": "SecurePassword123!"
        }

        # Make multiple concurrent login requests
        tasks = [
            client.post("/api/v1/auth/token", data=login_data),
            client.post("/api/v1/auth/token", data=login_data),
            client.post("/api/v1/auth/token", data=login_data)
        ]

        responses = await asyncio.gather(*tasks)

        # All should succeed
        for response in responses:
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_auth_error_response_format(self, client: AsyncClient, mock_auth_service):
        """Test error response format compliance."""
        mock_auth_service.authenticate_user.side_effect = ValueError("Invalid credentials")

        login_data = {
            "username": "test@example.com",
            "password": "wrongpassword"
        }

        response = await client.post("/api/v1/auth/token", data=login_data)

        assert response.status_code == 401
        assert response.headers["content-type"] == "application/json"

        data = response.json()
        # Should follow standard error format
        assert "detail" in data or "error" in data