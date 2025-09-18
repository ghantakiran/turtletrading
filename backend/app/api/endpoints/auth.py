"""
Authentication endpoints for user management
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional
from datetime import datetime, timedelta

from app.models.auth_schemas import (
    Token,
    TokenData,
    User,
    UserCreate,
    UserResponse
)
from app.services.auth_service import AuthService
from app.core.rate_limiting import auth_rate_limit, user_rate_limit, limiter
from app.core.auth_middleware import (
    CurrentUser,
    CurrentUserOptional,
    AdminUser,
    PremiumUser,
    get_current_user_required,
    require_roles,
    require_subscription
)
from loguru import logger

router = APIRouter()

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Initialize auth service
auth_service = AuthService()


@router.post("/register", response_model=UserResponse)
@limiter.limit("3 per minute")
async def register(request: Request, user: UserCreate):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = await auth_service.get_user_by_email(user.email)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
        
        # Create new user
        new_user = await auth_service.create_user(user)
        return UserResponse(
            id=new_user.id,
            email=new_user.email,
            full_name=new_user.full_name,
            is_active=new_user.is_active,
            role=new_user.role,
            created_at=new_user.created_at,
            subscription_tier=new_user.subscription_tier
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail="Error registering user")


@router.post("/token", response_model=Token)
@limiter.limit("5 per minute")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """Login and get access token"""
    try:
        # Authenticate user
        user = await auth_service.authenticate_user(form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token = auth_service.create_access_token(
            data={"sub": user.email}
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {e}")
        raise HTTPException(status_code=500, detail="Error during authentication")


@router.get("/me", response_model=UserResponse)
@limiter.limit("30 per minute")
async def read_users_me(request: Request, current_user: User = CurrentUser):
    """Get current user information"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        role=current_user.role,
        created_at=current_user.created_at,
        subscription_tier=current_user.subscription_tier
    )


@router.put("/me", response_model=UserResponse)
@limiter.limit("10 per minute")
async def update_user_me(
    request: Request,
    user_update: dict,
    current_user: User = CurrentUser
):
    """Update current user information"""
    try:
        updated_user = await auth_service.update_user(current_user.id, user_update)
        return UserResponse(
            id=updated_user.id,
            email=updated_user.email,
            full_name=updated_user.full_name,
            is_active=updated_user.is_active,
            role=updated_user.role,
            created_at=updated_user.created_at,
            subscription_tier=updated_user.subscription_tier
        )

    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="Error updating user")


@router.post("/refresh-token", response_model=Token)
@limiter.limit("10 per minute")
async def refresh_access_token(request: Request, current_user: User = CurrentUser):
    """Refresh access token"""
    try:
        access_token = auth_service.create_access_token(
            data={"sub": current_user.email}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer"
        }

    except Exception as e:
        logger.error(f"Error refreshing token: {e}")
        raise HTTPException(status_code=500, detail="Error refreshing token")


@router.post("/logout")
@limiter.limit("10 per minute")
async def logout(request: Request, current_user: User = CurrentUser):
    """Logout user (client should discard token)"""
    return {"message": "Successfully logged out"}


@router.post("/change-password")
@limiter.limit("3 per hour")
async def change_password(
    request: Request,
    current_password: str,
    new_password: str,
    current_user: User = CurrentUser
):
    """Change user password"""
    try:
        # Get full user data for password verification
        user_in_db = await auth_service.get_user_by_id(current_user.id)
        if not user_in_db:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify current password
        if not auth_service.verify_password(current_password, user_in_db.hashed_password):
            raise HTTPException(
                status_code=400,
                detail="Incorrect current password"
            )

        # Update password
        await auth_service.update_password(current_user.id, new_password)

        return {"message": "Password updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        raise HTTPException(status_code=500, detail="Error changing password")


@router.delete("/delete-account")
@limiter.limit("1 per hour")
async def delete_account(
    request: Request,
    password: str,
    current_user: User = CurrentUser
):
    """Delete user account"""
    try:
        # Get full user data for password verification
        user_in_db = await auth_service.get_user_by_id(current_user.id)
        if not user_in_db:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify password
        if not auth_service.verify_password(password, user_in_db.hashed_password):
            raise HTTPException(
                status_code=400,
                detail="Incorrect password"
            )

        # Delete account
        await auth_service.delete_user(current_user.id)

        return {"message": "Account deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting account: {e}")
        raise HTTPException(status_code=500, detail="Error deleting account")


# Demo endpoints to showcase authentication middleware capabilities

@router.get("/profile/stats", response_model=dict)
@limiter.limit("10 per minute")
async def get_user_stats(request: Request, current_user: User = CurrentUser):
    """Get user statistics and usage (authenticated users only)"""
    try:
        stats = await auth_service.get_user_stats(current_user.id)
        return stats
    except Exception as e:
        logger.error(f"Error getting user stats: {e}")
        raise HTTPException(status_code=500, detail="Error getting user statistics")


@router.get("/admin/users", response_model=dict)
@limiter.limit("5 per minute")
async def get_all_users(request: Request, admin_user: User = AdminUser):
    """Get all users (admin only)"""
    try:
        # In production, would query database for all users
        user_count = len(auth_service.mock_users_db)
        users_summary = [
            {
                "id": user_data["id"],
                "email": user_data["email"],
                "full_name": user_data["full_name"],
                "role": user_data["role"],
                "subscription_tier": user_data["subscription_tier"],
                "is_active": user_data["is_active"]
            }
            for user_data in auth_service.mock_users_db.values()
        ]

        return {
            "total_users": user_count,
            "users": users_summary,
            "requested_by": admin_user.email
        }
    except Exception as e:
        logger.error(f"Error getting all users: {e}")
        raise HTTPException(status_code=500, detail="Error getting users")


@router.get("/premium/features", response_model=dict)
@limiter.limit("20 per minute")
async def get_premium_features(request: Request, premium_user: User = PremiumUser):
    """Get premium features (premium users only)"""
    try:
        premium_features = {
            "advanced_analytics": True,
            "real_time_alerts": True,
            "api_access": True,
            "custom_indicators": True,
            "portfolio_optimization": True,
            "unlimited_watchlists": True,
            "priority_support": True,
            "export_data": True
        }

        return {
            "user": premium_user.email,
            "subscription_tier": premium_user.subscription_tier,
            "features": premium_features,
            "message": "Premium features available"
        }
    except Exception as e:
        logger.error(f"Error getting premium features: {e}")
        raise HTTPException(status_code=500, detail="Error getting premium features")


@router.get("/public/info", response_model=dict)
@limiter.limit("60 per minute")
async def get_public_info(request: Request, current_user: Optional[User] = CurrentUserOptional):
    """Get public information (works with or without authentication)"""
    try:
        public_info = {
            "platform": "TurtleTrading",
            "version": "1.0.0",
            "features": ["Real-time data", "AI predictions", "Technical analysis"],
            "signup_required": False
        }

        if current_user:
            public_info["authenticated"] = True
            public_info["user_email"] = current_user.email
            public_info["user_role"] = current_user.role
        else:
            public_info["authenticated"] = False
            public_info["message"] = "Sign up for personalized features"

        return public_info
    except Exception as e:
        logger.error(f"Error getting public info: {e}")
        raise HTTPException(status_code=500, detail="Error getting public information")