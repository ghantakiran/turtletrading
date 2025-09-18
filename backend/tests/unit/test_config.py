"""
Unit tests for configuration management
"""

import pytest
from unittest.mock import patch
import os

from app.core.config import Settings
from app.core.config_validator import ConfigValidator


class TestSettings:
    """Test suite for application settings."""
    
    @pytest.mark.unit
    def test_settings_defaults(self):
        """Test that settings have appropriate defaults."""
        settings = Settings()
        
        # Check basic settings
        assert settings.APP_NAME == "TurtleTrading"
        assert settings.VERSION == "1.0.0"
        assert settings.DEBUG == True
        assert settings.ENVIRONMENT == "development"
        
        # Check CORS settings
        assert settings.CORS_ALLOW_CREDENTIALS == True
        assert settings.CORS_MAX_AGE == 86400
        assert settings.CORS_ALLOW_ALL_ORIGINS == False
        
        # Check allowed origins
        origins = settings.allowed_origins
        assert isinstance(origins, list)
        assert len(origins) > 0
        assert "http://localhost:3000" in origins
    
    @pytest.mark.unit
    def test_cors_allow_all_origins_in_development(self):
        """Test CORS_ALLOW_ALL_ORIGINS behavior in development."""
        with patch.dict(os.environ, {
            "ENVIRONMENT": "development",
            "CORS_ALLOW_ALL_ORIGINS": "true"
        }):
            settings = Settings()
            assert settings.allowed_origins == ["*"]
    
    @pytest.mark.unit
    def test_cors_headers_parsing(self):
        """Test CORS headers parsing from string to list."""
        settings = Settings()
        
        headers = settings.cors_allow_headers_list
        assert isinstance(headers, list)
        assert "accept" in headers
        assert "authorization" in headers
        assert "content-type" in headers
        
        expose_headers = settings.cors_expose_headers_list
        assert isinstance(expose_headers, list)
        assert "x-request-id" in expose_headers
        assert "x-process-time" in expose_headers
    
    @pytest.mark.unit
    def test_secret_key_validation(self):
        """Test secret key validation logic."""
        # Test with short key in production
        with patch.dict(os.environ, {
            "ENVIRONMENT": "production",
            "SECRET_KEY": "short"
        }):
            with pytest.raises(ValueError, match="SECRET_KEY must be at least 32 characters"):
                Settings()
        
        # Test with valid key
        with patch.dict(os.environ, {
            "SECRET_KEY": "a" * 32
        }):
            settings = Settings()
            assert len(settings.SECRET_KEY) >= 32
    
    @pytest.mark.unit
    def test_database_urls(self):
        """Test database URL configuration."""
        settings = Settings()
        
        assert settings.DATABASE_URL.startswith("postgresql://")
        assert settings.ASYNC_DATABASE_URL.startswith("postgresql+asyncpg://")
    
    @pytest.mark.unit
    def test_allowed_hosts_parsing(self):
        """Test allowed hosts parsing."""
        settings = Settings()
        
        hosts = settings.allowed_hosts_list
        assert isinstance(hosts, list)
        assert "localhost" in hosts
        assert "127.0.0.1" in hosts


class TestConfigValidator:
    """Test suite for configuration validator."""
    
    @pytest.mark.unit
    def test_validate_basic_config(self):
        """Test basic configuration validation."""
        validator = ConfigValidator()
        
        # Mock valid settings
        with patch("app.core.config_validator.settings") as mock_settings:
            mock_settings.SECRET_KEY = "a" * 32
            mock_settings.ENVIRONMENT = "development"
            mock_settings.DEBUG = True
            mock_settings.ALLOWED_ORIGINS = "http://localhost:3000"
            mock_settings.DATABASE_URL = "postgresql://user:pass@localhost/db"
            mock_settings.REDIS_URL = "redis://localhost:6379"
            
            validator.validate_basic_config()
            
            assert validator.is_valid
            assert len(validator.errors) == 0
    
    @pytest.mark.unit
    def test_validate_security_config(self):
        """Test security configuration validation."""
        validator = ConfigValidator()
        
        # Test with weak secret key
        with patch("app.core.config_validator.settings") as mock_settings:
            mock_settings.SECRET_KEY = "weak"
            mock_settings.ENVIRONMENT = "production"
            mock_settings.DEBUG = False
            mock_settings.BCRYPT_ROUNDS = 4  # Too low
            
            validator.validate_security_config()
            
            assert not validator.is_valid
            assert len(validator.errors) > 0
            assert any("SECRET_KEY" in error for error in validator.errors)
    
    @pytest.mark.unit
    def test_validate_database_config(self):
        """Test database configuration validation."""
        validator = ConfigValidator()
        
        # Test with invalid database URL
        with patch("app.core.config_validator.settings") as mock_settings:
            mock_settings.DATABASE_URL = "invalid-url"
            mock_settings.ASYNC_DATABASE_URL = "invalid-async-url"
            
            validator.validate_database_config()
            
            assert not validator.is_valid
            assert len(validator.errors) > 0
    
    @pytest.mark.unit
    def test_validate_api_keys(self):
        """Test API keys validation."""
        validator = ConfigValidator()
        
        # Test with missing API keys
        with patch("app.core.config_validator.settings") as mock_settings:
            mock_settings.ALPHA_VANTAGE_API_KEY = None
            mock_settings.FINNHUB_API_KEY = None
            mock_settings.NEWS_API_KEY = None
            
            validator.validate_api_keys()
            
            # Should have warnings but not errors
            assert len(validator.warnings) > 0
    
    @pytest.mark.unit
    def test_validate_development_config(self):
        """Test development-specific configuration validation."""
        validator = ConfigValidator()
        
        with patch("app.core.config_validator.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"
            mock_settings.DEBUG = True
            mock_settings.SECRET_KEY = "dev-secret-key-for-testing"
            
            validator.validate_development_config()
            
            # Development should be more lenient
            assert len(validator.errors) == 0
    
    @pytest.mark.unit
    def test_validate_production_config(self):
        """Test production-specific configuration validation."""
        validator = ConfigValidator()
        
        with patch("app.core.config_validator.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "production"
            mock_settings.DEBUG = True  # Should be False in production
            mock_settings.SECRET_KEY = "dev-secret"  # Too weak
            
            validator.validate_production_config()
            
            assert not validator.is_valid
            assert len(validator.errors) > 0
    
    @pytest.mark.unit
    def test_get_validation_report(self):
        """Test validation report generation."""
        validator = ConfigValidator()
        
        # Add some test errors and warnings
        validator.errors = ["Test error"]
        validator.warnings = ["Test warning"]
        validator.is_valid = False
        
        report = validator.get_validation_report()
        
        assert "status" in report
        assert "errors" in report
        assert "warnings" in report
        assert "summary" in report
        
        assert report["status"] == "invalid"
        assert len(report["errors"]) == 1
        assert len(report["warnings"]) == 1
    
    @pytest.mark.unit
    def test_validate_config_and_report_function(self):
        """Test the main validation function."""
        from app.core.config_validator import validate_config_and_report
        
        # Mock a successful validation
        with patch("app.core.config_validator.ConfigValidator") as MockValidator:
            mock_instance = MockValidator.return_value
            mock_instance.validate.return_value = None
            mock_instance.is_valid = True
            mock_instance.get_validation_report.return_value = {
                "status": "valid",
                "errors": [],
                "warnings": [],
                "summary": "All validations passed"
            }
            
            is_valid, report = validate_config_and_report()
            
            assert is_valid == True
            assert report["status"] == "valid"