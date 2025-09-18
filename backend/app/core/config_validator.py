"""
Configuration validation and environment variable management utilities
"""

import os
import secrets
from typing import Dict, List, Any, Tuple
from pathlib import Path
import json

from app.core.config import settings


class ConfigValidator:
    """Validates and manages application configuration"""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        
    def validate_all(self) -> Dict[str, Any]:
        """Validate all configuration settings"""
        self.errors.clear()
        self.warnings.clear()
        
        # Validate environment
        self._validate_environment()
        
        # Validate security settings
        self._validate_security()
        
        # Validate database configuration
        self._validate_database()
        
        # Validate external API keys
        self._validate_external_apis()
        
        # Validate logging configuration
        self._validate_logging()
        
        # Validate performance settings
        self._validate_performance()
        
        return {
            "status": "valid" if not self.errors else "invalid",
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": self._generate_summary()
        }
    
    def _validate_environment(self):
        """Validate environment-specific settings"""
        if settings.ENVIRONMENT not in ['development', 'staging', 'production']:
            self.errors.append(f"Invalid ENVIRONMENT value: {settings.ENVIRONMENT}")
        
        if settings.ENVIRONMENT == 'production':
            if settings.DEBUG:
                self.warnings.append("DEBUG mode enabled in production")
            
            if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
                self.errors.append("Production requires a strong SECRET_KEY (32+ characters)")
    
    def _validate_security(self):
        """Validate security-related configuration"""
        # Secret key validation
        if not settings.SECRET_KEY:
            self.errors.append("SECRET_KEY is required")
        elif settings.SECRET_KEY == "your-secret-key-here-change-in-production":
            self.errors.append("SECRET_KEY must be changed from default value")
        elif len(settings.SECRET_KEY) < 32:
            self.warnings.append("SECRET_KEY should be at least 32 characters long")
        
        # CORS validation
        if not settings.ALLOWED_ORIGINS:
            self.warnings.append("No ALLOWED_ORIGINS configured - CORS may not work properly")
        
        # Bcrypt rounds validation
        if settings.BCRYPT_ROUNDS < 10:
            self.warnings.append("BCRYPT_ROUNDS should be at least 10 for security")
        elif settings.BCRYPT_ROUNDS > 15:
            self.warnings.append("BCRYPT_ROUNDS > 15 may cause performance issues")
    
    def _validate_database(self):
        """Validate database configuration"""
        if not settings.DATABASE_URL:
            self.errors.append("DATABASE_URL is required")
        
        if not settings.ASYNC_DATABASE_URL:
            self.errors.append("ASYNC_DATABASE_URL is required")
        
        # Pool settings validation
        if settings.DB_POOL_SIZE <= 0:
            self.errors.append("DB_POOL_SIZE must be greater than 0")
        
        if settings.DB_MAX_OVERFLOW < 0:
            self.errors.append("DB_MAX_OVERFLOW must be non-negative")
        
        if settings.DB_POOL_TIMEOUT <= 0:
            self.errors.append("DB_POOL_TIMEOUT must be greater than 0")
    
    def _validate_external_apis(self):
        """Validate external API configuration"""
        api_keys = {
            'ALPHA_VANTAGE_API_KEY': settings.ALPHA_VANTAGE_API_KEY,
            'FINNHUB_API_KEY': settings.FINNHUB_API_KEY,
            'NEWS_API_KEY': settings.NEWS_API_KEY
        }
        
        missing_keys = [key for key, value in api_keys.items() if not value]
        if missing_keys:
            self.warnings.append(f"Missing API keys: {', '.join(missing_keys)} - some features may not work")
        
        # Email configuration
        if settings.EMAIL_ENABLED:
            if not settings.SENDER_EMAIL:
                self.errors.append("SENDER_EMAIL required when EMAIL_ENABLED=true")
            if not settings.SENDER_PASSWORD:
                self.errors.append("SENDER_PASSWORD required when EMAIL_ENABLED=true")
    
    def _validate_logging(self):
        """Validate logging configuration"""
        valid_log_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if settings.LOG_LEVEL not in valid_log_levels:
            self.errors.append(f"Invalid LOG_LEVEL: {settings.LOG_LEVEL}. Must be one of {valid_log_levels}")
        
        # Check log file path
        log_path = Path(settings.LOG_FILE)
        try:
            log_path.parent.mkdir(exist_ok=True)
        except Exception as e:
            self.warnings.append(f"Cannot create log directory: {e}")
    
    def _validate_performance(self):
        """Validate performance-related settings"""
        if settings.MAX_WS_CONNECTIONS <= 0:
            self.errors.append("MAX_WS_CONNECTIONS must be greater than 0")
        
        if settings.RATE_LIMIT_REQUESTS <= 0:
            self.errors.append("RATE_LIMIT_REQUESTS must be greater than 0")
        
        if settings.RATE_LIMIT_WINDOW <= 0:
            self.errors.append("RATE_LIMIT_WINDOW must be greater than 0")
        
        if settings.REQUEST_TIMEOUT <= 0:
            self.errors.append("REQUEST_TIMEOUT must be greater than 0")
    
    def _generate_summary(self) -> Dict[str, Any]:
        """Generate configuration summary"""
        return {
            "environment": settings.ENVIRONMENT,
            "debug_mode": settings.DEBUG,
            "testing_mode": settings.TESTING,
            "database_configured": bool(settings.DATABASE_URL),
            "redis_configured": bool(settings.REDIS_URL),
            "api_keys_configured": {
                "alpha_vantage": bool(settings.ALPHA_VANTAGE_API_KEY),
                "finnhub": bool(settings.FINNHUB_API_KEY),
                "news_api": bool(settings.NEWS_API_KEY)
            },
            "email_enabled": settings.EMAIL_ENABLED,
            "monitoring": {
                "metrics_enabled": settings.METRICS_ENABLED,
                "sentry_configured": bool(settings.SENTRY_DSN),
                "apm_enabled": settings.APM_ENABLED
            }
        }


def generate_secret_key() -> str:
    """Generate a secure random secret key"""
    return secrets.token_urlsafe(32)


def create_production_env_template() -> str:
    """Create a production environment template with secure defaults"""
    template = """# =============================================================================
# TurtleTrading Platform - Production Environment Configuration
# =============================================================================

# =============================================================================
# APPLICATION SETTINGS
# =============================================================================
APP_NAME=TurtleTrading
VERSION=1.0.0
DEBUG=false
TESTING=false
ENVIRONMENT=production

# =============================================================================
# API CONFIGURATION  
# =============================================================================
API_V1_PREFIX=/api/v1

# SECURITY: Generate a secure random key for production
# Use: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY={secret_key}
ACCESS_TOKEN_EXPIRE_MINUTES=30

# =============================================================================
# CORS SETTINGS
# =============================================================================
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ALLOW_CREDENTIALS=true

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
# Production database
DATABASE_URL=postgresql://username:password@hostname:5432/database
ASYNC_DATABASE_URL=postgresql+asyncpg://username:password@hostname:5432/database

# Database pool settings
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================
REDIS_URL=redis://redis-hostname:6379
REDIS_DB=0
CACHE_TTL=600

# =============================================================================
# EXTERNAL API KEYS
# =============================================================================
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
FINNHUB_API_KEY=your_finnhub_api_key_here
YAHOO_FINANCE_TIMEOUT=30
NEWS_API_KEY=your_news_api_key_here

# =============================================================================
# EMAIL CONFIGURATION
# =============================================================================
EMAIL_ENABLED=true
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your_email@gmail.com
SENDER_PASSWORD=your_app_password_here

# =============================================================================
# LSTM MODEL CONFIGURATION
# =============================================================================
LSTM_LOOKBACK_DAYS=90
LSTM_PREDICTION_DAYS=5
LSTM_UNITS=50
LSTM_EPOCHS=75
LSTM_BATCH_SIZE=32
LSTM_VALIDATION_SPLIT=0.2

# =============================================================================
# WEBSOCKET CONFIGURATION
# =============================================================================
WS_HEARTBEAT_INTERVAL=30
MAX_WS_CONNECTIONS=1000

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL=INFO
LOG_FILE=/var/log/turtletrading/turtletrading.log
LOG_ROTATION=50 MB
LOG_RETENTION=30 days

# =============================================================================
# FILE STORAGE
# =============================================================================
UPLOAD_DIR=/var/uploads
MAX_FILE_SIZE=10485760

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=60

# =============================================================================
# SECURITY SETTINGS
# =============================================================================
BCRYPT_ROUNDS=12
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# =============================================================================
# PERFORMANCE SETTINGS
# =============================================================================
GZIP_MINIMUM_SIZE=1000
REQUEST_TIMEOUT=60

# =============================================================================
# MONITORING & OBSERVABILITY
# =============================================================================
METRICS_ENABLED=true
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
APM_ENABLED=true
""".format(secret_key=generate_secret_key())
    
    return template


def validate_config_and_report() -> Tuple[bool, Dict[str, Any]]:
    """Validate configuration and return status with report"""
    validator = ConfigValidator()
    report = validator.validate_all()
    is_valid = report["status"] == "valid"
    return is_valid, report


if __name__ == "__main__":
    # Run configuration validation
    is_valid, report = validate_config_and_report()
    
    print("=" * 60)
    print("TurtleTrading Configuration Validation Report")
    print("=" * 60)
    
    print(f"Status: {report['status'].upper()}")
    print(f"Environment: {report['summary']['environment']}")
    print(f"Debug Mode: {report['summary']['debug_mode']}")
    
    if report['errors']:
        print(f"\n❌ ERRORS ({len(report['errors'])}):")
        for error in report['errors']:
            print(f"  • {error}")
    
    if report['warnings']:
        print(f"\n⚠️  WARNINGS ({len(report['warnings'])}):")
        for warning in report['warnings']:
            print(f"  • {warning}")
    
    print(f"\n📊 CONFIGURATION SUMMARY:")
    summary = report['summary']
    print(f"  • Database: {'✓' if summary['database_configured'] else '✗'}")
    print(f"  • Redis: {'✓' if summary['redis_configured'] else '✗'}")
    print(f"  • Email: {'✓' if summary['email_enabled'] else '✗'}")
    
    api_keys = summary['api_keys_configured']
    print(f"  • API Keys:")
    print(f"    - Alpha Vantage: {'✓' if api_keys['alpha_vantage'] else '✗'}")
    print(f"    - Finnhub: {'✓' if api_keys['finnhub'] else '✗'}")
    print(f"    - NewsAPI: {'✓' if api_keys['news_api'] else '✗'}")
    
    monitoring = summary['monitoring']
    print(f"  • Monitoring:")
    print(f"    - Metrics: {'✓' if monitoring['metrics_enabled'] else '✗'}")
    print(f"    - Sentry: {'✓' if monitoring['sentry_configured'] else '✗'}")
    print(f"    - APM: {'✓' if monitoring['apm_enabled'] else '✗'}")
    
    print("\n" + "=" * 60)