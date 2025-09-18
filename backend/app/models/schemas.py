"""
Pydantic models for API contracts per module specifications.
Based on Claude.StockAnalysis.md, Claude.MarketData.md, Claude.Authentication.md
"""
from datetime import datetime
from typing import Dict, List, Optional, Set, Union, Any
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr, validator
from enum import Enum


# ============================================================================
# Claude.StockAnalysis.md Data Contracts
# ============================================================================

class StockPrice(BaseModel):
    """Stock price data contract per Claude.StockAnalysis.md"""
    symbol: str = Field(..., description="Stock symbol")
    current_price: float = Field(..., gt=0, description="Current stock price")
    volume: int = Field(..., ge=0, description="Trading volume")
    market_cap: int = Field(..., ge=0, description="Market capitalization")
    change_percent: float = Field(..., description="Daily percentage change")
    timestamp: datetime = Field(..., description="Data timestamp")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TechnicalIndicators(BaseModel):
    """Technical indicators contract per Claude.StockAnalysis.md"""
    rsi: float = Field(..., ge=0, le=100, description="RSI value 0-100")
    macd: Dict[str, float] = Field(..., description="MACD line, signal, histogram")
    bollinger_bands: Dict[str, float] = Field(..., description="Upper, middle, lower bands")
    technical_score: float = Field(..., ge=0, le=1, description="Technical score 0-1")
    recommendation: str = Field(..., regex="^(BUY|SELL|HOLD)$", description="Trading recommendation")

    # Additional indicators per module spec
    adx: float = Field(..., ge=0, le=100, description="ADX trend strength")
    obv: float = Field(..., description="On-Balance Volume")
    stochastic: Dict[str, float] = Field(..., description="Stochastic oscillator")
    atr: float = Field(..., gt=0, description="Average True Range")
    ema20: float = Field(..., gt=0, description="20-period EMA")
    sma50: float = Field(..., gt=0, description="50-period SMA")
    sma200: float = Field(..., gt=0, description="200-period SMA")


class LSTMPrediction(BaseModel):
    """LSTM prediction contract per Claude.StockAnalysis.md"""
    predictions: List[float] = Field(..., description="Array of price predictions")
    confidence_intervals: Dict[str, List[float]] = Field(..., description="80% and 95% intervals")
    horizon_days: int = Field(..., gt=0, description="Prediction horizon in days")
    model_accuracy: float = Field(..., ge=0, le=1, description="Model accuracy 0-1")
    directional_accuracy: float = Field(..., ge=0, le=1, description="Direction prediction accuracy")


class AnalysisResult(BaseModel):
    """Multi-factor analysis result per Claude.StockAnalysis.md"""
    symbol: str = Field(..., description="Stock symbol")
    technical_score: float = Field(..., ge=0, le=1, description="Technical analysis score")
    lstm_score: float = Field(..., ge=0, le=1, description="LSTM prediction score")
    sentiment_score: float = Field(..., ge=-1, le=1, description="Sentiment score -1 to 1")
    seasonality_score: float = Field(..., ge=0, le=1, description="Seasonality boost")
    final_score: float = Field(..., ge=0, le=1, description="Final weighted score")
    recommendation: str = Field(..., regex="^(BUY|SELL|HOLD)$", description="Final recommendation")
    confidence: float = Field(..., ge=0, le=1, description="Overall confidence level")
    timestamp: datetime = Field(..., description="Analysis timestamp")


# ============================================================================
# Claude.MarketData.md Data Contracts
# ============================================================================

class MarketStatus(str, Enum):
    """Market status enumeration"""
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    PRE_MARKET = "PRE_MARKET"
    AFTER_HOURS = "AFTER_HOURS"


class IndexData(BaseModel):
    """Market index data per Claude.MarketData.md"""
    symbol: str = Field(..., description="Index symbol")
    current_value: float = Field(..., gt=0, description="Current index value")
    change_percent: float = Field(..., description="Daily percentage change")
    volume: int = Field(..., ge=0, description="Trading volume")
    timestamp: datetime = Field(..., description="Data timestamp")


class MarketBreadth(BaseModel):
    """Market breadth analysis per Claude.MarketData.md"""
    advancing: int = Field(..., ge=0, description="Number of advancing stocks")
    declining: int = Field(..., ge=0, description="Number of declining stocks")
    unchanged: int = Field(..., ge=0, description="Number of unchanged stocks")
    ratio: float = Field(..., ge=0, description="Advance/decline ratio")
    new_highs: int = Field(..., ge=0, description="New 52-week highs")
    new_lows: int = Field(..., ge=0, description="New 52-week lows")


class SentimentOverview(BaseModel):
    """Sentiment analysis overview per Claude.MarketData.md"""
    overall_score: float = Field(..., ge=-100, le=100, description="Overall sentiment -100 to 100")
    news_sentiment: float = Field(..., ge=-100, le=100, description="News sentiment score")
    social_sentiment: float = Field(..., ge=-100, le=100, description="Social media sentiment")
    confidence: float = Field(..., ge=0, le=1, description="Sentiment confidence 0-1")
    trending_keywords: List[str] = Field(..., description="Trending financial keywords")


class MarketOverview(BaseModel):
    """Market overview aggregation per Claude.MarketData.md"""
    indices: Dict[str, IndexData] = Field(..., description="Major market indices")
    market_status: MarketStatus = Field(..., description="Current market status")
    sentiment_score: float = Field(..., ge=-100, le=100, description="Overall market sentiment")
    breadth: MarketBreadth = Field(..., description="Market breadth analysis")
    timestamp: datetime = Field(..., description="Data timestamp")


class WebSocketConnection(BaseModel):
    """WebSocket connection info per Claude.MarketData.md"""
    client_id: str = Field(..., description="Unique client identifier")
    subscriptions: Set[str] = Field(..., description="Subscribed symbols")
    connected_at: datetime = Field(..., description="Connection timestamp")
    last_ping: datetime = Field(..., description="Last ping timestamp")


class SubscriptionResult(BaseModel):
    """WebSocket subscription result"""
    success: bool = Field(..., description="Subscription success status")
    client_id: str = Field(..., description="Client identifier")
    subscribed_symbols: List[str] = Field(..., description="Successfully subscribed symbols")
    failed_symbols: List[str] = Field(default=[], description="Failed subscription symbols")


class BroadcastResult(BaseModel):
    """WebSocket broadcast result"""
    delivered: int = Field(..., ge=0, description="Number of successful deliveries")
    total_subscribers: int = Field(..., ge=0, description="Total number of subscribers")
    symbol: str = Field(..., description="Symbol that was broadcast")
    latency_ms: float = Field(..., ge=0, description="Broadcast latency in milliseconds")


# ============================================================================
# Claude.Authentication.md Data Contracts
# ============================================================================

class SubscriptionTier(str, Enum):
    """User subscription tiers"""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class UserAccount(BaseModel):
    """User account data per Claude.Authentication.md"""
    user_id: UUID = Field(..., description="Unique user identifier")
    email: EmailStr = Field(..., description="User email address")
    password_hash: str = Field(..., description="Hashed password")
    subscription_tier: SubscriptionTier = Field(..., description="User subscription tier")
    created_at: datetime = Field(..., description="Account creation timestamp")
    is_active: bool = Field(default=True, description="Account active status")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")


class UserContext(BaseModel):
    """User context for authenticated requests per Claude.Authentication.md"""
    user_id: UUID = Field(..., description="User identifier")
    email: EmailStr = Field(..., description="User email")
    subscription_tier: SubscriptionTier = Field(..., description="Subscription tier")
    permissions: List[str] = Field(..., description="User permissions list")
    session_expires_at: datetime = Field(..., description="Session expiration time")
    rate_limit_remaining: int = Field(..., ge=0, description="Remaining rate limit")


class TokenPair(BaseModel):
    """JWT token pair per Claude.Authentication.md"""
    access_token: str = Field(..., description="JWT access token (15min expiry)")
    refresh_token: str = Field(..., description="JWT refresh token (7day expiry)")
    token_type: str = Field(default="Bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiry in seconds")


class AuthResult(BaseModel):
    """Authentication result per Claude.Authentication.md"""
    success: bool = Field(..., description="Authentication success status")
    user_context: Optional[UserContext] = Field(None, description="User context if successful")
    access_token: Optional[str] = Field(None, description="Access token if successful")
    refresh_token: Optional[str] = Field(None, description="Refresh token if successful")
    expires_in: Optional[int] = Field(None, description="Token expiry if successful")
    error_message: Optional[str] = Field(None, description="Error message if failed")


class RateLimitResult(BaseModel):
    """Rate limiting result per Claude.Authentication.md"""
    allowed: bool = Field(..., description="Whether request is allowed")
    remaining: int = Field(..., ge=0, description="Remaining requests")
    reset_time: datetime = Field(..., description="Rate limit reset time")
    tier_limit: int = Field(..., gt=0, description="Total limit for user tier")


class PermissionResult(BaseModel):
    """Permission check result"""
    allowed: bool = Field(..., description="Whether action is permitted")
    permission: str = Field(..., description="Required permission")
    user_permissions: List[str] = Field(..., description="User's current permissions")
    subscription_tier: SubscriptionTier = Field(..., description="User's subscription tier")


# ============================================================================
# Request/Response Models
# ============================================================================

class UserRegistrationRequest(BaseModel):
    """User registration request"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="User password")
    full_name: str = Field(..., min_length=2, max_length=100, description="User full name")

    @validator('password')
    def validate_password(cls, v):
        """Validate password strength per Claude.Authentication.md"""
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in v):
            raise ValueError('Password must contain at least one special character')
        return v


class UserLoginRequest(BaseModel):
    """User login request"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class TokenRefreshRequest(BaseModel):
    """Token refresh request"""
    refresh_token: str = Field(..., description="Valid refresh token")


class StockAnalysisRequest(BaseModel):
    """Stock analysis request"""
    symbol: str = Field(..., description="Stock symbol to analyze")
    period: str = Field(default="1y", description="Analysis period")
    include_lstm: bool = Field(default=True, description="Include LSTM predictions")
    include_sentiment: bool = Field(default=True, description="Include sentiment analysis")


class BatchAnalysisRequest(BaseModel):
    """Batch stock analysis request"""
    symbols: List[str] = Field(..., min_items=1, max_items=50, description="Stock symbols")
    period: str = Field(default="1y", description="Analysis period")
    include_lstm: bool = Field(default=False, description="Include LSTM predictions")


class WebSocketSubscribeRequest(BaseModel):
    """WebSocket subscription request"""
    symbols: List[str] = Field(..., min_items=1, max_items=100, description="Symbols to subscribe")
    data_types: List[str] = Field(default=["price", "volume"], description="Data types to stream")


# ============================================================================
# Error Models
# ============================================================================

class ValidationError(BaseModel):
    """Validation error response"""
    error: str = Field(default="VALIDATION_ERROR", description="Error type")
    message: str = Field(..., description="Error message")
    details: Dict[str, Any] = Field(default={}, description="Validation details")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")


class AuthenticationError(BaseModel):
    """Authentication error response"""
    error: str = Field(default="AUTHENTICATION_ERROR", description="Error type")
    message: str = Field(..., description="Error message")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")


class TokenValidationError(BaseModel):
    """Token validation error response"""
    error: str = Field(default="TOKEN_VALIDATION_ERROR", description="Error type")
    message: str = Field(..., description="Error message")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")


class RateLimitError(BaseModel):
    """Rate limit error response"""
    error: str = Field(default="RATE_LIMIT_EXCEEDED", description="Error type")
    message: str = Field(..., description="Error message")
    reset_time: datetime = Field(..., description="When rate limit resets")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")


class ServiceError(BaseModel):
    """Generic service error response"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    service: str = Field(..., description="Service that generated error")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")