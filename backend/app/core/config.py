"""
Application configuration settings
"""

from pydantic_settings import BaseSettings
from pydantic import Field, validator
from typing import List, Optional, Union
import os
from pathlib import Path
import secrets


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application
    APP_NAME: str = Field(default="TurtleTrading", description="Application name")
    VERSION: str = Field(default="1.0.0", description="Application version")
    DEBUG: bool = Field(default=True, description="Debug mode")
    ENVIRONMENT: str = Field(default="development", description="Environment (development, staging, production)")
    
    # API Configuration
    API_V1_PREFIX: str = Field(default="/api/v1", description="API version prefix")
    SECRET_KEY: str = Field(default="", description="Secret key for JWT tokens")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="JWT token expiration in minutes")

    # JWT Configuration
    JWT_SECRET_KEY: str = Field(default="your-super-secret-jwt-key-change-in-production")
    JWT_ALGORITHM: str = Field(default="HS256")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    
    @validator('SECRET_KEY')
    def validate_secret_key(cls, v, values):
        """Validate secret key strength"""
        if not v or v == "your-secret-key-here-change-in-production":
            if values.get('ENVIRONMENT') == 'production':
                raise ValueError("SECRET_KEY must be set for production environment")
            # Generate a secure key for development if not set
            return secrets.token_urlsafe(32)
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v
    
    # CORS
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:3003,http://localhost:8000,http://127.0.0.1:8000",
        description="Comma-separated list of allowed CORS origins"
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True, description="Allow credentials in CORS requests")
    CORS_MAX_AGE: int = Field(default=86400, description="CORS preflight cache duration in seconds (24 hours)")
    CORS_ALLOW_ALL_ORIGINS: bool = Field(default=False, description="Allow all origins (development only)")
    CORS_ALLOW_HEADERS: str = Field(
        default="accept,accept-encoding,authorization,content-type,dnt,origin,user-agent,x-csrftoken,x-requested-with,x-request-id,cache-control,pragma",
        description="Comma-separated list of allowed CORS headers"
    )
    CORS_EXPOSE_HEADERS: str = Field(
        default="x-request-id,x-process-time,x-api-version,content-length,content-type",
        description="Comma-separated list of headers to expose to client"
    )
    
    @property
    def allowed_origins(self) -> List[str]:
        """Parse comma-separated origins string into list"""
        if self.CORS_ALLOW_ALL_ORIGINS and self.ENVIRONMENT == "development":
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
    
    @property
    def cors_allow_headers_list(self) -> List[str]:
        """Parse comma-separated CORS headers string into list"""
        return [header.strip() for header in self.CORS_ALLOW_HEADERS.split(",") if header.strip()]
    
    @property
    def cors_expose_headers_list(self) -> List[str]:
        """Parse comma-separated CORS expose headers string into list"""
        return [header.strip() for header in self.CORS_EXPOSE_HEADERS.split(",") if header.strip()]
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql://turtletrading:password@localhost:5432/turtletrading",
        description="Database connection URL"
    )
    ASYNC_DATABASE_URL: str = Field(
        default="postgresql+asyncpg://turtletrading:password@localhost:5432/turtletrading",
        description="Async database connection URL"
    )
    
    # Database pool settings
    DB_POOL_SIZE: int = Field(default=5, description="Database connection pool size")
    DB_MAX_OVERFLOW: int = Field(default=10, description="Database max overflow connections")
    DB_POOL_TIMEOUT: int = Field(default=30, description="Database pool timeout in seconds")
    DB_POOL_RECYCLE: int = Field(default=3600, description="Database connection recycle time in seconds")
    
    # Redis (for caching and sessions)
    REDIS_URL: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    REDIS_DB: int = Field(default=0, description="Redis database number")
    CACHE_TTL: int = Field(default=300, description="Cache TTL in seconds")
    
    # External APIs
    ALPHA_VANTAGE_API_KEY: Optional[str] = Field(default=None, description="Alpha Vantage API key")
    FINNHUB_API_KEY: Optional[str] = Field(default=None, description="Finnhub API key")
    NEWS_API_KEY: Optional[str] = Field(default=None, description="NewsAPI key for sentiment analysis")
    YAHOO_FINANCE_TIMEOUT: int = Field(default=30, description="Yahoo Finance API timeout in seconds")
    
    # Email Configuration (for notifications)
    EMAIL_ENABLED: bool = Field(default=False, description="Enable email notifications")
    SMTP_SERVER: str = Field(default="smtp.gmail.com", description="SMTP server")
    SMTP_PORT: int = Field(default=587, description="SMTP port")
    SENDER_EMAIL: Optional[str] = Field(default=None, description="Sender email address")
    SENDER_PASSWORD: Optional[str] = Field(default=None, description="Sender email password")
    
    # LSTM Model Configuration
    LSTM_LOOKBACK_DAYS: int = Field(default=90, description="LSTM lookback period in days")
    LSTM_PREDICTION_DAYS: int = Field(default=5, description="LSTM prediction period in days")
    LSTM_UNITS: int = Field(default=50, description="Number of LSTM units")
    LSTM_EPOCHS: int = Field(default=75, description="Number of training epochs")
    LSTM_BATCH_SIZE: int = Field(default=32, description="Training batch size")
    LSTM_VALIDATION_SPLIT: float = Field(default=0.2, description="Validation data split ratio")
    
    # Default Technical Analysis Weights
    DEFAULT_WEIGHTS: dict = {
        "RSI": 0.12,
        "MACD": 0.16,
        "EMA20": 0.12,
        "SMA50": 0.10,
        "SMA200": 0.10,
        "Stoch": 0.10,
        "Bollinger": 0.10,
        "ADX": 0.12,
        "OBV": 0.08,
    }
    
    # Market Data
    DEFAULT_TICKERS: List[str] = [
        "AAPL", "MSFT", "NVDA", "GOOGL", "META", 
        "AMZN", "TSLA", "JPM", "QQQ", "SPY", 
        "SE", "MRVL", "CRM", "UNH", "NFLX"
    ]
    
    # WebSocket Configuration
    WS_HEARTBEAT_INTERVAL: int = Field(default=30, description="WebSocket heartbeat interval in seconds")
    MAX_WS_CONNECTIONS: int = Field(default=100, description="Maximum WebSocket connections")
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_FILE: str = Field(default="turtletrading.log", description="Log file path")
    LOG_ROTATION: str = Field(default="10 MB", description="Log rotation size")
    LOG_RETENTION: str = Field(default="7 days", description="Log retention period")
    
    # File Storage
    UPLOAD_DIR: str = Field(default="uploads", description="File upload directory")
    MAX_FILE_SIZE: int = Field(default=10 * 1024 * 1024, description="Maximum file size in bytes")
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100, description="Rate limit requests per window")
    RATE_LIMIT_WINDOW: int = Field(default=60, description="Rate limit window in seconds")
    
    # Security
    BCRYPT_ROUNDS: int = Field(default=12, description="Bcrypt hashing rounds")
    
    # Development/Testing
    TESTING: bool = Field(default=False, description="Testing mode")
    
    # Application Security
    ALLOWED_HOSTS: str = Field(default="localhost,127.0.0.1,0.0.0.0", description="Comma-separated allowed hosts")
    
    @property
    def allowed_hosts_list(self) -> List[str]:
        """Parse comma-separated hosts string into list"""
        return [host.strip() for host in self.ALLOWED_HOSTS.split(",") if host.strip()]
    
    # Performance Settings
    GZIP_MINIMUM_SIZE: int = Field(default=1000, description="Minimum size for gzip compression")
    REQUEST_TIMEOUT: int = Field(default=30, description="Request timeout in seconds")
    
    # Monitoring & Observability
    METRICS_ENABLED: bool = Field(default=False, description="Enable metrics collection")
    SENTRY_DSN: Optional[str] = Field(default=None, description="Sentry DSN for error tracking")
    APM_ENABLED: bool = Field(default=False, description="Enable APM monitoring")
    
    @validator('ENVIRONMENT')
    def validate_environment(cls, v):
        """Validate environment value"""
        valid_environments = ['development', 'staging', 'production']
        if v not in valid_environments:
            raise ValueError(f"ENVIRONMENT must be one of {valid_environments}")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()


# Ensure upload directory exists
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(exist_ok=True)


def get_database_url() -> str:
    """Get database URL with proper configuration"""
    if settings.TESTING:
        return "sqlite:///./test.db"
    return settings.DATABASE_URL


def get_async_database_url() -> str:
    """Get async database URL with proper configuration"""
    if settings.TESTING:
        return "sqlite+aiosqlite:///./test.db"
    return settings.ASYNC_DATABASE_URL