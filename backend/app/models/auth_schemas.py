"""
Pydantic schemas for authentication and user management
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    """User role enumeration"""
    USER = "user"
    PREMIUM = "premium"
    ADMIN = "admin"


class UserCreate(BaseModel):
    """Schema for user creation"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")
    full_name: str = Field(..., min_length=2, max_length=100, description="User full name")
    
    @validator('password')
    def validate_password(cls, v):
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserUpdate(BaseModel):
    """Schema for user updates"""
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class UserInDB(BaseModel):
    """User model as stored in database"""
    id: int = Field(..., description="User ID")
    email: EmailStr = Field(..., description="User email")
    hashed_password: str = Field(..., description="Hashed password")
    full_name: str = Field(..., description="User full name")
    is_active: bool = Field(True, description="Whether user is active")
    role: UserRole = Field(UserRole.USER, description="User role")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Account creation time")
    last_login: Optional[datetime] = Field(None, description="Last login time")
    
    # User preferences
    preferences: Optional[dict] = Field(default_factory=dict, description="User preferences")
    
    # Subscription info
    subscription_tier: str = Field("free", description="Subscription tier")
    subscription_expires: Optional[datetime] = Field(None, description="Subscription expiry")
    
    class Config:
        from_attributes = True


class User(BaseModel):
    """Public user model (without sensitive data)"""
    id: int = Field(..., description="User ID")
    email: EmailStr = Field(..., description="User email")
    full_name: str = Field(..., description="User full name")
    is_active: bool = Field(..., description="Whether user is active")
    role: UserRole = Field(..., description="User role")
    created_at: datetime = Field(..., description="Account creation time")
    last_login: Optional[datetime] = Field(None, description="Last login time")
    subscription_tier: str = Field(..., description="Subscription tier")
    
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """User response model"""
    id: int = Field(..., description="User ID")
    email: EmailStr = Field(..., description="User email")
    full_name: str = Field(..., description="User full name")
    is_active: bool = Field(..., description="Whether user is active")
    role: UserRole = Field(..., description="User role")
    created_at: datetime = Field(..., description="Account creation time")
    subscription_tier: str = Field(..., description="Subscription tier")


class Token(BaseModel):
    """JWT token response"""
    access_token: str = Field(..., description="Access token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(3600, description="Token expiry in seconds")


class TokenData(BaseModel):
    """Token data for JWT parsing"""
    email: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[UserRole] = None


class LoginRequest(BaseModel):
    """Login request model"""
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., description="User password")


class PasswordChange(BaseModel):
    """Password change request"""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    
    @validator('new_password')
    def validate_new_password(cls, v):
        """Validate new password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class PasswordReset(BaseModel):
    """Password reset request"""
    email: EmailStr = Field(..., description="User email")


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation"""
    token: str = Field(..., description="Reset token")
    new_password: str = Field(..., min_length=8, description="New password")


class UserPreferences(BaseModel):
    """User preferences model"""
    theme: str = Field("dark", description="UI theme preference")
    default_watchlist: List[str] = Field(default_factory=list, description="Default watchlist symbols")
    notifications: dict = Field(default_factory=dict, description="Notification preferences")
    dashboard_layout: dict = Field(default_factory=dict, description="Dashboard layout preferences")
    timezone: str = Field("UTC", description="User timezone")
    language: str = Field("en", description="Language preference")


class UserSession(BaseModel):
    """User session information"""
    user_id: int = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    role: UserRole = Field(..., description="User role")
    session_start: datetime = Field(default_factory=datetime.utcnow, description="Session start time")
    last_activity: datetime = Field(default_factory=datetime.utcnow, description="Last activity time")
    ip_address: Optional[str] = Field(None, description="User IP address")
    user_agent: Optional[str] = Field(None, description="User agent string")


class ApiUsage(BaseModel):
    """API usage tracking"""
    user_id: int = Field(..., description="User ID")
    endpoint: str = Field(..., description="API endpoint")
    method: str = Field(..., description="HTTP method")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Request timestamp")
    response_time: float = Field(..., description="Response time in milliseconds")
    status_code: int = Field(..., description="HTTP status code")
    
    
class UserStats(BaseModel):
    """User statistics and usage"""
    user_id: int = Field(..., description="User ID")
    total_api_calls: int = Field(0, description="Total API calls made")
    daily_api_calls: int = Field(0, description="API calls today")
    favorite_stocks: List[str] = Field(default_factory=list, description="Most viewed stocks")
    last_analysis: Optional[datetime] = Field(None, description="Last analysis timestamp")
    account_age_days: int = Field(0, description="Account age in days")
    
    
class Subscription(BaseModel):
    """Subscription model"""
    user_id: int = Field(..., description="User ID")
    tier: str = Field(..., description="Subscription tier")
    status: str = Field(..., description="Subscription status")
    start_date: datetime = Field(..., description="Subscription start date")
    end_date: Optional[datetime] = Field(None, description="Subscription end date")
    auto_renew: bool = Field(True, description="Auto-renewal status")
    
    # Usage limits
    api_calls_limit: int = Field(1000, description="Monthly API calls limit")
    api_calls_used: int = Field(0, description="API calls used this month")
    
    # Features
    features: List[str] = Field(default_factory=list, description="Available features")