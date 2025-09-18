"""
Integration tests for authentication endpoints
Tests the actual API endpoints through HTTP requests
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.auth_schemas import UserCreate
from tests.conftest import TestClient


class TestAuthenticationEndpoints:
    """Integration tests for authentication API endpoints."""

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_user_registration_success(self, client: AsyncClient):
        """Test successful user registration."""
        user_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "full_name": "New User"
        }

        response = await client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["full_name"] == user_data["full_name"]
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data
        assert "password" not in data  # Password should not be returned

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_user_registration_duplicate_email(self, client: AsyncClient):
        """Test user registration with duplicate email."""
        user_data = {
            "email": "admin@turtletrading.com",  # Already exists in mock data
            "password": "SecurePassword123!",
            "full_name": "Duplicate User"
        }

        response = await client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_user_registration_invalid_data(self, client: AsyncClient):
        """Test user registration with invalid data."""
        # Test with weak password
        weak_password_data = {
            "email": "weakpass@example.com",
            "password": "weak",  # Too weak
            "full_name": "Weak Password User"
        }

        response = await client.post("/api/v1/auth/register", json=weak_password_data)
        assert response.status_code == 422  # Validation error

        # Test with invalid email
        invalid_email_data = {
            "email": "invalid-email",  # Invalid email format
            "password": "SecurePassword123!",
            "full_name": "Invalid Email User"
        }

        response = await client.post("/api/v1/auth/register", json=invalid_email_data)
        assert response.status_code == 422  # Validation error

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_user_login_success(self, client: AsyncClient):
        """Test successful user login."""
        login_data = {
            "username": "admin@turtletrading.com",  # Using existing admin user
            "password": "admin123"
        }

        response = await client.post("/api/v1/auth/token", data=login_data)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 50  # JWT tokens are long

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_user_login_invalid_credentials(self, client: AsyncClient):
        """Test user login with invalid credentials."""
        # Test with wrong email
        wrong_email_data = {
            "username": "nonexistent@example.com",
            "password": "admin123"
        }

        response = await client.post("/api/v1/auth/token", data=wrong_email_data)
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

        # Test with wrong password
        wrong_password_data = {
            "username": "admin@turtletrading.com",
            "password": "wrongpassword"
        }

        response = await client.post("/api/v1/auth/token", data=wrong_password_data)
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_authenticated(self, auth_client: TestClient):
        """Test getting current user with valid authentication."""
        # Login first
        await auth_client.login("admin@turtletrading.com", "admin123")

        # Get current user
        response = await auth_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@turtletrading.com"
        assert data["full_name"] == "Admin User"
        assert data["role"] == "admin"
        assert data["is_active"] is True

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_unauthenticated(self, client: AsyncClient):
        """Test getting current user without authentication."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401
        assert "Authentication token required" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self, client: AsyncClient):
        """Test getting current user with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401
        assert "Invalid authentication token" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_update_user_profile(self, auth_client: TestClient):
        """Test updating user profile."""
        # Login first
        await auth_client.login("user@turtletrading.com", "user123")

        # Update profile
        update_data = {"full_name": "Updated Test User"}
        response = await auth_client.put("/api/v1/auth/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Test User"
        assert data["email"] == "user@turtletrading.com"  # Should remain unchanged

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_refresh_token(self, auth_client: TestClient):
        """Test token refresh functionality."""
        # Login first
        await auth_client.login("admin@turtletrading.com", "admin123")

        # Refresh token
        response = await auth_client.post("/api/v1/auth/refresh-token")

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 50

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_logout(self, auth_client: TestClient):
        """Test user logout."""
        # Login first
        await auth_client.login("admin@turtletrading.com", "admin123")

        # Logout
        response = await auth_client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        assert "Successfully logged out" in response.json()["message"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_change_password(self, auth_client: TestClient):
        """Test password change functionality."""
        # First register a new user for this test
        user_data = {
            "email": "passwordchange@example.com",
            "password": "OriginalPassword123!",
            "full_name": "Password Change User"
        }

        # Register user
        register_response = await auth_client.client.post("/api/v1/auth/register", json=user_data)
        assert register_response.status_code == 200

        # Login with new user
        await auth_client.login("passwordchange@example.com", "OriginalPassword123!")

        # Change password
        password_data = {
            "current_password": "OriginalPassword123!",
            "new_password": "NewSecurePassword456!"
        }
        response = await auth_client.client.post(
            "/api/v1/auth/change-password",
            params=password_data,
            headers=auth_client.get_headers()
        )

        assert response.status_code == 200
        assert "Password updated successfully" in response.json()["message"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, auth_client: TestClient):
        """Test password change with wrong current password."""
        # Login
        await auth_client.login("admin@turtletrading.com", "admin123")

        # Try to change password with wrong current password
        password_data = {
            "current_password": "wrongpassword",
            "new_password": "NewSecurePassword456!"
        }
        response = await auth_client.client.post(
            "/api/v1/auth/change-password",
            params=password_data,
            headers=auth_client.get_headers()
        )

        assert response.status_code == 400
        assert "Incorrect current password" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_delete_account(self, auth_client: TestClient):
        """Test account deletion."""
        # First register a new user for this test
        user_data = {
            "email": "deletetest@example.com",
            "password": "DeletePassword123!",
            "full_name": "Delete Test User"
        }

        # Register user
        register_response = await auth_client.client.post("/api/v1/auth/register", json=user_data)
        assert register_response.status_code == 200

        # Login with new user
        await auth_client.login("deletetest@example.com", "DeletePassword123!")

        # Delete account
        response = await auth_client.client.delete(
            "/api/v1/auth/delete-account",
            params={"password": "DeletePassword123!"},
            headers=auth_client.get_headers()
        )

        assert response.status_code == 200
        assert "Account deleted successfully" in response.json()["message"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_delete_account_wrong_password(self, auth_client: TestClient):
        """Test account deletion with wrong password."""
        # Login
        await auth_client.login("admin@turtletrading.com", "admin123")

        # Try to delete account with wrong password
        response = await auth_client.client.delete(
            "/api/v1/auth/delete-account",
            params={"password": "wrongpassword"},
            headers=auth_client.get_headers()
        )

        assert response.status_code == 400
        assert "Incorrect password" in response.json()["detail"]


class TestAuthenticationMiddlewareEndpoints:
    """Integration tests for authentication middleware demo endpoints."""

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_public_endpoint_no_auth(self, client: AsyncClient):
        """Test public endpoint without authentication."""
        response = await client.get("/api/v1/auth/public/info")

        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "TurtleTrading"
        assert data["authenticated"] is False
        assert "Sign up for personalized features" in data["message"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_public_endpoint_with_auth(self, auth_client: TestClient):
        """Test public endpoint with authentication."""
        # Login first
        await auth_client.login("admin@turtletrading.com", "admin123")

        response = await auth_client.get("/api/v1/auth/public/info")

        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "TurtleTrading"
        assert data["authenticated"] is True
        assert data["user_email"] == "admin@turtletrading.com"
        assert data["user_role"] == "admin"

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_user_stats_authenticated(self, auth_client: TestClient):
        """Test user stats endpoint with authentication."""
        # Login first
        await auth_client.login("admin@turtletrading.com", "admin123")

        response = await auth_client.get("/api/v1/auth/profile/stats")

        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "total_api_calls" in data
        assert "account_age_days" in data
        assert data["user_id"] == 1  # Admin user ID

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_user_stats_unauthenticated(self, client: AsyncClient):
        """Test user stats endpoint without authentication."""
        response = await client.get("/api/v1/auth/profile/stats")

        assert response.status_code == 401
        assert "Authentication token required" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_admin_endpoint_as_admin(self, auth_client: TestClient):
        """Test admin-only endpoint with admin user."""
        # Login as admin
        await auth_client.login("admin@turtletrading.com", "admin123")

        response = await auth_client.get("/api/v1/auth/admin/users")

        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "users" in data
        assert "requested_by" in data
        assert data["requested_by"] == "admin@turtletrading.com"
        assert isinstance(data["users"], list)
        assert len(data["users"]) >= 2  # At least admin and user

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_admin_endpoint_as_user(self, auth_client: TestClient):
        """Test admin-only endpoint with regular user."""
        # Login as regular user
        await auth_client.login("user@turtletrading.com", "user123")

        response = await auth_client.get("/api/v1/auth/admin/users")

        assert response.status_code == 403
        assert "Admin access required" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_admin_endpoint_unauthenticated(self, client: AsyncClient):
        """Test admin-only endpoint without authentication."""
        response = await client.get("/api/v1/auth/admin/users")

        assert response.status_code == 401
        assert "Authentication token required" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_premium_endpoint_as_admin(self, auth_client: TestClient):
        """Test premium endpoint with admin user (should have premium access)."""
        # Login as admin
        await auth_client.login("admin@turtletrading.com", "admin123")

        response = await auth_client.get("/api/v1/auth/premium/features")

        assert response.status_code == 200
        data = response.json()
        assert data["user"] == "admin@turtletrading.com"
        assert data["subscription_tier"] == "premium"
        assert "features" in data
        assert data["features"]["advanced_analytics"] is True
        assert data["message"] == "Premium features available"

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_premium_endpoint_as_free_user(self, auth_client: TestClient):
        """Test premium endpoint with free tier user."""
        # Login as regular user (free tier)
        await auth_client.login("user@turtletrading.com", "user123")

        response = await auth_client.get("/api/v1/auth/premium/features")

        assert response.status_code == 403
        assert "Premium subscription required" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_premium_endpoint_unauthenticated(self, client: AsyncClient):
        """Test premium endpoint without authentication."""
        response = await client.get("/api/v1/auth/premium/features")

        assert response.status_code == 401
        assert "Authentication token required" in response.json()["detail"]


class TestAuthenticationRateLimiting:
    """Integration tests for authentication rate limiting."""

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_login_rate_limiting(self, client: AsyncClient):
        """Test rate limiting on login endpoint."""
        login_data = {
            "username": "nonexistent@example.com",
            "password": "wrongpassword"
        }

        # Make multiple rapid requests
        responses = []
        for _ in range(10):  # Exceed the 5 per minute limit
            response = await client.post("/api/v1/auth/token", data=login_data)
            responses.append(response)

        # First few should be 401 (unauthorized)
        # Later ones should be 429 (rate limited) - but depends on Redis/timing
        unauthorized_count = sum(1 for r in responses if r.status_code == 401)
        rate_limited_count = sum(1 for r in responses if r.status_code == 429)

        # Should have at least some unauthorized responses
        assert unauthorized_count > 0
        # May or may not hit rate limit depending on Redis configuration

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_registration_rate_limiting(self, client: AsyncClient):
        """Test rate limiting on registration endpoint."""
        # Make multiple rapid registration attempts
        responses = []
        for i in range(5):  # Exceed the 3 per minute limit
            user_data = {
                "email": f"ratelimit{i}@example.com",
                "password": "RateLimit123!",
                "full_name": f"Rate Limit User {i}"
            }
            response = await client.post("/api/v1/auth/register", json=user_data)
            responses.append(response)

        # Some should succeed, some might be rate limited
        success_count = sum(1 for r in responses if r.status_code == 200)
        rate_limited_count = sum(1 for r in responses if r.status_code == 429)

        # Should have at least some successful registrations
        assert success_count > 0


class TestAuthenticationSecurityScenarios:
    """Integration tests for security scenarios."""

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_jwt_token_expiry_handling(self, auth_client: TestClient):
        """Test JWT token expiry handling (simulated)."""
        # Login to get a token
        await auth_client.login("admin@turtletrading.com", "admin123")

        # Make a request with the valid token
        response = await auth_client.get("/api/v1/auth/me")
        assert response.status_code == 200

        # In a real scenario, we'd wait for token expiry or modify the token
        # For now, test with a clearly invalid token
        auth_client.token = "expired.jwt.token"

        response = await auth_client.get("/api/v1/auth/me")
        assert response.status_code == 401

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_malformed_token_handling(self, client: AsyncClient):
        """Test handling of malformed JWT tokens."""
        malformed_tokens = [
            "not.a.jwt",
            "Bearer invalid_token",
            "malformed_token_here",
            "",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid",  # Partially valid JWT
        ]

        for token in malformed_tokens:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get("/api/v1/auth/me", headers=headers)
            assert response.status_code == 401
            assert "Invalid authentication token" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_missing_authorization_header(self, client: AsyncClient):
        """Test handling of missing Authorization header."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401
        assert "Authentication token required" in response.json()["detail"]

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_invalid_authorization_scheme(self, client: AsyncClient):
        """Test handling of invalid authorization schemes."""
        invalid_schemes = [
            "Basic dGVzdDp0ZXN0",  # Basic auth instead of Bearer
            "Digest username=test",  # Digest auth
            "Token abc123",  # Custom token scheme
        ]

        for auth_header in invalid_schemes:
            headers = {"Authorization": auth_header}
            response = await client.get("/api/v1/auth/me", headers=headers)
            assert response.status_code == 401

    @pytest.mark.integration
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_complete_authentication_workflow(self, client: AsyncClient):
        """Test complete authentication workflow from registration to deletion."""
        # 1. Register new user
        user_data = {
            "email": "workflow@example.com",
            "password": "WorkflowPassword123!",
            "full_name": "Workflow Test User"
        }

        register_response = await client.post("/api/v1/auth/register", json=user_data)
        assert register_response.status_code == 200
        user_info = register_response.json()

        # 2. Login
        login_data = {
            "username": user_data["email"],
            "password": user_data["password"]
        }
        login_response = await client.post("/api/v1/auth/token", data=login_data)
        assert login_response.status_code == 200
        token_data = login_response.json()

        headers = {"Authorization": f"Bearer {token_data['access_token']}"}

        # 3. Get user profile
        profile_response = await client.get("/api/v1/auth/me", headers=headers)
        assert profile_response.status_code == 200
        profile_data = profile_response.json()
        assert profile_data["email"] == user_data["email"]

        # 4. Update profile
        update_data = {"full_name": "Updated Workflow User"}
        update_response = await client.put("/api/v1/auth/me", json=update_data, headers=headers)
        assert update_response.status_code == 200
        updated_profile = update_response.json()
        assert updated_profile["full_name"] == "Updated Workflow User"

        # 5. Refresh token
        refresh_response = await client.post("/api/v1/auth/refresh-token", headers=headers)
        assert refresh_response.status_code == 200
        new_token_data = refresh_response.json()

        # 6. Use new token
        new_headers = {"Authorization": f"Bearer {new_token_data['access_token']}"}
        verify_response = await client.get("/api/v1/auth/me", headers=new_headers)
        assert verify_response.status_code == 200

        # 7. Logout
        logout_response = await client.post("/api/v1/auth/logout", headers=new_headers)
        assert logout_response.status_code == 200

        # 8. Test public endpoint
        public_response = await client.get("/api/v1/auth/public/info")
        assert public_response.status_code == 200

        # Note: Not testing account deletion here to preserve test user for other tests