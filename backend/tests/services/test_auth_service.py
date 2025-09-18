"""
Unit tests for authentication service
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from passlib.context import CryptContext

from app.services.auth_service import AuthService
from app.models.auth_schemas import UserCreate, UserInDB, User, UserRole, TokenData


@pytest.fixture
def auth_service():
    """Create an AuthService instance for testing."""
    return AuthService()


@pytest.fixture
def sample_user_create():
    """Sample user creation data."""
    return UserCreate(
        email="test@example.com",
        password="TestPassword123!",
        full_name="Test User"
    )


@pytest.fixture
def sample_user_in_db():
    """Sample user in database format."""
    return UserInDB(
        id=1,
        email="test@example.com",
        hashed_password="$2b$12$hashed_password_here",
        full_name="Test User",
        is_active=True,
        role=UserRole.USER,
        created_at=datetime.utcnow(),
        subscription_tier="free"
    )


class TestAuthService:
    """Test cases for AuthService."""

    @pytest.mark.unit
    @pytest.mark.auth
    def test_password_hashing(self, auth_service):
        """Test password hashing functionality."""
        password = "TestPassword123!"

        # Test hashing
        hashed = auth_service.get_password_hash(password)

        assert hashed is not None
        assert hashed != password
        assert hashed.startswith("$2b$")

        # Test verification
        assert auth_service.verify_password(password, hashed) is True
        assert auth_service.verify_password("wrong_password", hashed) is False

    @pytest.mark.unit
    @pytest.mark.auth
    def test_password_hashing_error_handling(self, auth_service):
        """Test password hashing error handling."""
        # Test with invalid input
        with pytest.raises(ValueError):
            auth_service.get_password_hash("")

        # Test verification with invalid hash
        assert auth_service.verify_password("password", "invalid_hash") is False

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_user_by_email_success(self, auth_service):
        """Test successful user retrieval by email."""
        # Test with existing user (admin)
        user = await auth_service.get_user_by_email("admin@turtletrading.com")

        assert user is not None
        assert isinstance(user, UserInDB)
        assert user.email == "admin@turtletrading.com"
        assert user.role == UserRole.ADMIN
        assert user.subscription_tier == "premium"

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self, auth_service):
        """Test user retrieval with non-existent email."""
        user = await auth_service.get_user_by_email("nonexistent@example.com")
        assert user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_user_by_id_success(self, auth_service):
        """Test successful user retrieval by ID."""
        # Test with existing user ID (admin user has ID 1)
        user = await auth_service.get_user_by_id(1)

        assert user is not None
        assert isinstance(user, UserInDB)
        assert user.id == 1
        assert user.email == "admin@turtletrading.com"

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, auth_service):
        """Test user retrieval with non-existent ID."""
        user = await auth_service.get_user_by_id(999)
        assert user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_authenticate_user_success(self, auth_service):
        """Test successful user authentication."""
        # Test with valid credentials (admin user)
        user = await auth_service.authenticate_user("admin@turtletrading.com", "admin123")

        assert user is not None
        assert isinstance(user, UserInDB)
        assert user.email == "admin@turtletrading.com"
        assert user.last_login is not None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_authenticate_user_invalid_email(self, auth_service):
        """Test authentication with invalid email."""
        user = await auth_service.authenticate_user("invalid@example.com", "password")
        assert user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_authenticate_user_invalid_password(self, auth_service):
        """Test authentication with invalid password."""
        user = await auth_service.authenticate_user("admin@turtletrading.com", "wrong_password")
        assert user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_create_user_success(self, auth_service, sample_user_create):
        """Test successful user creation."""
        user = await auth_service.create_user(sample_user_create)

        assert user is not None
        assert isinstance(user, UserInDB)
        assert user.email == sample_user_create.email
        assert user.full_name == sample_user_create.full_name
        assert user.role == UserRole.USER
        assert user.subscription_tier == "free"
        assert user.is_active is True
        assert user.id is not None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self, auth_service):
        """Test user creation with duplicate email."""
        user_create = UserCreate(
            email="admin@turtletrading.com",  # Already exists
            password="TestPassword123!",
            full_name="Duplicate User"
        )

        with pytest.raises(ValueError, match="User already exists"):
            await auth_service.create_user(user_create)

    @pytest.mark.unit
    @pytest.mark.auth
    def test_create_access_token(self, auth_service):
        """Test JWT access token creation."""
        data = {"sub": "test@example.com"}
        token = auth_service.create_access_token(data)

        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 50  # JWT tokens are typically long

        # Test with custom expiration
        custom_expire = timedelta(minutes=30)
        token_custom = auth_service.create_access_token(data, custom_expire)
        assert token_custom is not None
        assert token_custom != token  # Should be different due to different expiry

    @pytest.mark.unit
    @pytest.mark.auth
    def test_create_access_token_error_handling(self, auth_service):
        """Test access token creation error handling."""
        # Test with invalid data
        with pytest.raises(ValueError):
            auth_service.create_access_token(None)

    @pytest.mark.unit
    @pytest.mark.auth
    def test_decode_access_token_success(self, auth_service):
        """Test successful JWT token decoding."""
        data = {"sub": "test@example.com"}
        token = auth_service.create_access_token(data)

        decoded = auth_service.decode_access_token(token)

        assert decoded is not None
        assert isinstance(decoded, TokenData)
        assert decoded.email == "test@example.com"

    @pytest.mark.unit
    @pytest.mark.auth
    def test_decode_access_token_invalid(self, auth_service):
        """Test JWT token decoding with invalid token."""
        invalid_token = "invalid.jwt.token"
        decoded = auth_service.decode_access_token(invalid_token)
        assert decoded is None

    @pytest.mark.unit
    @pytest.mark.auth
    def test_decode_access_token_missing_subject(self, auth_service):
        """Test JWT token decoding with missing subject."""
        # Create token without 'sub' field
        import jwt
        data = {"user_id": 123}  # No 'sub' field
        token = jwt.encode(data, auth_service.secret_key, algorithm=auth_service.algorithm)

        decoded = auth_service.decode_access_token(token)
        assert decoded is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_success(self, auth_service):
        """Test successful current user retrieval."""
        # Create token for existing user
        data = {"sub": "admin@turtletrading.com"}
        token = auth_service.create_access_token(data)

        user = await auth_service.get_current_user(token)

        assert user is not None
        assert isinstance(user, User)
        assert user.email == "admin@turtletrading.com"
        assert user.role == UserRole.ADMIN

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self, auth_service):
        """Test current user retrieval with invalid token."""
        user = await auth_service.get_current_user("invalid_token")
        assert user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_nonexistent_user(self, auth_service):
        """Test current user retrieval for non-existent user."""
        # Create token for non-existent user
        data = {"sub": "nonexistent@example.com"}
        token = auth_service.create_access_token(data)

        user = await auth_service.get_current_user(token)
        assert user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_current_user_optional(self, auth_service):
        """Test optional current user retrieval."""
        # Test with valid token
        data = {"sub": "admin@turtletrading.com"}
        token = auth_service.create_access_token(data)
        user = await auth_service.get_current_user_optional(token)
        assert user is not None
        assert user.email == "admin@turtletrading.com"

        # Test with no token
        user_none = await auth_service.get_current_user_optional(None)
        assert user_none is None

        # Test with invalid token
        user_invalid = await auth_service.get_current_user_optional("invalid")
        assert user_invalid is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_update_user_success(self, auth_service):
        """Test successful user update."""
        # First create a user
        user_create = UserCreate(
            email="update_test@example.com",
            password="TestPassword123!",
            full_name="Update Test"
        )
        created_user = await auth_service.create_user(user_create)

        # Update the user
        update_data = {"full_name": "Updated Name"}
        updated_user = await auth_service.update_user(created_user.id, update_data)

        assert updated_user.full_name == "Updated Name"
        assert updated_user.email == created_user.email  # Should remain unchanged

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_update_user_not_found(self, auth_service):
        """Test user update with non-existent user."""
        update_data = {"full_name": "New Name"}

        with pytest.raises(ValueError, match="User not found"):
            await auth_service.update_user(999, update_data)

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_update_password_success(self, auth_service):
        """Test successful password update."""
        # Create a user first
        user_create = UserCreate(
            email="password_test@example.com",
            password="OldPassword123!",
            full_name="Password Test"
        )
        created_user = await auth_service.create_user(user_create)

        # Update password
        new_password = "NewPassword456!"
        result = await auth_service.update_password(created_user.id, new_password)

        assert result is True

        # Verify authentication with new password
        auth_user = await auth_service.authenticate_user(created_user.email, new_password)
        assert auth_user is not None

        # Verify old password no longer works
        old_auth = await auth_service.authenticate_user(created_user.email, "OldPassword123!")
        assert old_auth is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_update_password_user_not_found(self, auth_service):
        """Test password update with non-existent user."""
        result = await auth_service.update_password(999, "NewPassword123!")
        assert result is False

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_delete_user_success(self, auth_service):
        """Test successful user deletion."""
        # Create a user first
        user_create = UserCreate(
            email="delete_test@example.com",
            password="TestPassword123!",
            full_name="Delete Test"
        )
        created_user = await auth_service.create_user(user_create)

        # Delete the user
        result = await auth_service.delete_user(created_user.id)
        assert result is True

        # Verify user is deleted
        deleted_user = await auth_service.get_user_by_id(created_user.id)
        assert deleted_user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_delete_user_not_found(self, auth_service):
        """Test user deletion with non-existent user."""
        result = await auth_service.delete_user(999)
        assert result is False

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_is_admin(self, auth_service):
        """Test admin role checking."""
        # Get admin user
        admin_user = await auth_service.get_user_by_email("admin@turtletrading.com")
        user_obj = User(
            id=admin_user.id,
            email=admin_user.email,
            full_name=admin_user.full_name,
            is_active=admin_user.is_active,
            role=admin_user.role,
            created_at=admin_user.created_at,
            subscription_tier=admin_user.subscription_tier
        )

        is_admin = await auth_service.is_admin(user_obj)
        assert is_admin is True

        # Test with regular user
        regular_user = await auth_service.get_user_by_email("user@turtletrading.com")
        user_obj_regular = User(
            id=regular_user.id,
            email=regular_user.email,
            full_name=regular_user.full_name,
            is_active=regular_user.is_active,
            role=regular_user.role,
            created_at=regular_user.created_at,
            subscription_tier=regular_user.subscription_tier
        )

        is_admin_regular = await auth_service.is_admin(user_obj_regular)
        assert is_admin_regular is False

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_is_premium(self, auth_service):
        """Test premium subscription checking."""
        # Admin user should have premium access
        admin_user = await auth_service.get_user_by_email("admin@turtletrading.com")
        user_obj_admin = User(
            id=admin_user.id,
            email=admin_user.email,
            full_name=admin_user.full_name,
            is_active=admin_user.is_active,
            role=admin_user.role,
            created_at=admin_user.created_at,
            subscription_tier=admin_user.subscription_tier
        )

        is_premium_admin = await auth_service.is_premium(user_obj_admin)
        assert is_premium_admin is True

        # Regular user with free tier should not
        regular_user = await auth_service.get_user_by_email("user@turtletrading.com")
        user_obj_regular = User(
            id=regular_user.id,
            email=regular_user.email,
            full_name=regular_user.full_name,
            is_active=regular_user.is_active,
            role=regular_user.role,
            created_at=regular_user.created_at,
            subscription_tier=regular_user.subscription_tier
        )

        is_premium_regular = await auth_service.is_premium(user_obj_regular)
        assert is_premium_regular is False

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_check_api_limits(self, auth_service):
        """Test API rate limiting checks."""
        # Create test user
        user_obj = User(
            id=1,
            email="test@example.com",
            full_name="Test User",
            is_active=True,
            role=UserRole.USER,
            created_at=datetime.utcnow(),
            subscription_tier="free"
        )

        # Test should pass (mock implementation allows all)
        result = await auth_service.check_api_limits(user_obj, "/test/endpoint")
        assert result is True

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_rate_limit_check(self, auth_service):
        """Test rate limit checking functionality."""
        # Test rate limit check (mock implementation)
        result = await auth_service.rate_limit_check(1, "/test/endpoint")
        assert result is True

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_log_api_usage(self, auth_service):
        """Test API usage logging."""
        result = await auth_service.log_api_usage(
            user_id=1,
            endpoint="/test/endpoint",
            response_time=100.5,
            status_code=200
        )
        assert result is True

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_user_stats(self, auth_service):
        """Test user statistics retrieval."""
        stats = await auth_service.get_user_stats(1)  # Admin user

        assert isinstance(stats, dict)
        assert "user_id" in stats
        assert "total_api_calls" in stats
        assert "account_age_days" in stats
        assert stats["user_id"] == 1

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_get_user_stats_not_found(self, auth_service):
        """Test user statistics retrieval for non-existent user."""
        stats = await auth_service.get_user_stats(999)
        assert stats == {}

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_validate_subscription(self, auth_service):
        """Test subscription validation."""
        # Test with free tier user
        user_obj = User(
            id=1,
            email="test@example.com",
            full_name="Test User",
            is_active=True,
            role=UserRole.USER,
            created_at=datetime.utcnow(),
            subscription_tier="free"
        )

        is_valid = await auth_service.validate_subscription(user_obj)
        assert is_valid is True  # Free tier is always valid

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_health_check(self, auth_service):
        """Test auth service health check."""
        health = await auth_service.health_check()

        assert isinstance(health, dict)
        assert "status" in health
        assert "users_count" in health
        assert "jwt_configured" in health
        assert "password_hashing" in health
        assert health["password_hashing"] == "bcrypt"
        assert health["jwt_configured"] is True


class TestAuthServiceEdgeCases:
    """Test edge cases and error conditions."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_concurrent_user_creation(self, auth_service):
        """Test concurrent user creation scenarios."""
        import asyncio

        # Create multiple users concurrently
        user_creates = [
            UserCreate(
                email=f"concurrent{i}@example.com",
                password="TestPassword123!",
                full_name=f"Concurrent User {i}"
            )
            for i in range(3)
        ]

        # Run concurrently
        tasks = [auth_service.create_user(user_create) for user_create in user_creates]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All should succeed since emails are unique
        for result in results:
            assert isinstance(result, UserInDB)

    @pytest.mark.unit
    @pytest.mark.auth
    def test_password_strength_requirements(self, auth_service):
        """Test password strength validation (in schemas)."""
        # This tests the password validation in UserCreate schema

        # Valid password
        try:
            UserCreate(
                email="test@example.com",
                password="ValidPassword123!",
                full_name="Test User"
            )
        except Exception:
            pytest.fail("Valid password should not raise exception")

        # Invalid passwords should raise validation errors
        with pytest.raises(Exception):
            UserCreate(
                email="test@example.com",
                password="weak",  # Too short, no uppercase, no digit
                full_name="Test User"
            )

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_memory_cleanup(self, auth_service):
        """Test that service properly manages memory."""
        initial_count = len(auth_service.mock_users_db)

        # Create and delete users
        for i in range(5):
            user_create = UserCreate(
                email=f"cleanup{i}@example.com",
                password="TestPassword123!",
                full_name=f"Cleanup User {i}"
            )
            user = await auth_service.create_user(user_create)
            await auth_service.delete_user(user.id)

        # Should be back to original count
        final_count = len(auth_service.mock_users_db)
        assert final_count == initial_count


class TestAuthServiceIntegration:
    """Integration-style tests for auth service."""

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_full_user_lifecycle(self, auth_service):
        """Test complete user lifecycle: create, authenticate, update, delete."""

        # 1. Create user
        user_create = UserCreate(
            email="lifecycle@example.com",
            password="InitialPassword123!",
            full_name="Lifecycle User"
        )
        user = await auth_service.create_user(user_create)
        assert user.email == "lifecycle@example.com"

        # 2. Authenticate with initial password
        auth_user = await auth_service.authenticate_user("lifecycle@example.com", "InitialPassword123!")
        assert auth_user is not None

        # 3. Update user details
        await auth_service.update_user(user.id, {"full_name": "Updated Lifecycle User"})
        updated_user = await auth_service.get_user_by_id(user.id)
        assert updated_user.full_name == "Updated Lifecycle User"

        # 4. Change password
        await auth_service.update_password(user.id, "NewPassword456!")

        # 5. Authenticate with new password
        new_auth = await auth_service.authenticate_user("lifecycle@example.com", "NewPassword456!")
        assert new_auth is not None

        # 6. Generate and validate JWT token
        token = auth_service.create_access_token({"sub": user.email})
        current_user = await auth_service.get_current_user(token)
        assert current_user.email == user.email

        # 7. Delete user
        delete_result = await auth_service.delete_user(user.id)
        assert delete_result is True

        # 8. Verify user is gone
        deleted_user = await auth_service.get_user_by_id(user.id)
        assert deleted_user is None

    @pytest.mark.unit
    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_admin_user_capabilities(self, auth_service):
        """Test admin user special capabilities."""
        # Get admin user
        admin_user_db = await auth_service.get_user_by_email("admin@turtletrading.com")
        admin_user = User(
            id=admin_user_db.id,
            email=admin_user_db.email,
            full_name=admin_user_db.full_name,
            is_active=admin_user_db.is_active,
            role=admin_user_db.role,
            created_at=admin_user_db.created_at,
            subscription_tier=admin_user_db.subscription_tier
        )

        # Verify admin capabilities
        assert await auth_service.is_admin(admin_user) is True
        assert await auth_service.is_premium(admin_user) is True  # Admins get premium access
        assert await auth_service.validate_subscription(admin_user) is True

        # Test JWT token flow for admin
        token = auth_service.create_access_token({"sub": admin_user.email})
        current_admin = await auth_service.get_current_user(token)
        assert current_admin.role == UserRole.ADMIN