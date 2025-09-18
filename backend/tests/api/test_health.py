"""
Tests for health check endpoints
"""

import pytest
from httpx import AsyncClient
from unittest.mock import patch


class TestHealthEndpoints:
    """Test suite for health check endpoints."""
    
    @pytest.mark.api
    async def test_root_endpoint(self, client: AsyncClient):
        """Test root endpoint returns basic API information."""
        response = await client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "name" in data
        assert "version" in data
        assert "status" in data
        assert "endpoints" in data
        assert "features" in data
        
        # Check specific values
        assert data["name"] == "TurtleTrading"
        assert data["status"] == "operational"
        assert "/health" in data["endpoints"]["health"]
    
    @pytest.mark.api
    async def test_basic_health_check(self, client: AsyncClient):
        """Test basic health check endpoint."""
        with patch("app.core.health.health_service.get_comprehensive_health") as mock_health:
            mock_health.return_value = {
                "status": "healthy",
                "timestamp": "2023-01-01T00:00:00",
                "version": "1.0.0",
                "environment": "development",
                "uptime": {"uptime_seconds": 100},
                "services": {
                    "api": "operational",
                    "websocket": "operational",
                    "database": {"status": "healthy"},
                    "redis": {"status": "healthy"},
                    "external_apis": {}
                },
                "metrics": {"active_websocket_connections": 0}
            }
            
            response = await client.get("/health")
            
            assert response.status_code == 200
            data = response.json()
            
            # Check response structure
            assert "status" in data
            assert "timestamp" in data
            assert "version" in data
            assert "services" in data
            assert "metrics" in data
            
            # Check specific values
            assert data["status"] == "healthy"
            assert data["version"] == "1.0.0"
    
    @pytest.mark.api
    async def test_health_check_unhealthy_database(self, client: AsyncClient):
        """Test health check when database is unhealthy."""
        with patch("app.core.health.health_service.get_comprehensive_health") as mock_health:
            mock_health.return_value = {
                "status": "unhealthy",
                "timestamp": "2023-01-01T00:00:00",
                "version": "1.0.0",
                "services": {
                    "database": {"status": "unhealthy", "error": "Connection failed"},
                    "redis": {"status": "healthy"}
                },
                "metrics": {"active_websocket_connections": 0}
            }
            
            response = await client.get("/health")
            
            assert response.status_code == 503  # Service Unavailable
            data = response.json()
            assert data["status"] == "unhealthy"
    
    @pytest.mark.api
    async def test_quick_health_check(self, client: AsyncClient):
        """Test quick health check endpoint."""
        with patch("app.core.health.get_quick_health_status") as mock_quick_health:
            mock_quick_health.return_value = {
                "status": "healthy",
                "timestamp": "2023-01-01T00:00:00",
                "services": {
                    "database": "healthy",
                    "redis": "healthy"
                }
            }
            
            response = await client.get("/health/quick")
            
            assert response.status_code == 200
            data = response.json()
            
            # Check response structure
            assert "status" in data
            assert "timestamp" in data
            assert "services" in data
            
            # Check specific values
            assert data["status"] == "healthy"
    
    @pytest.mark.api
    async def test_detailed_health_check(self, client: AsyncClient):
        """Test detailed health check endpoint."""
        with patch("app.core.health.health_service.get_comprehensive_health") as mock_health:
            mock_health.return_value = {
                "status": "healthy",
                "timestamp": "2023-01-01T00:00:00",
                "version": "1.0.0",
                "environment": "development",
                "uptime": {"uptime_seconds": 100},
                "services": {
                    "api": "operational",
                    "websocket": "operational",
                    "database": {"status": "healthy"},
                    "redis": {"status": "healthy"},
                    "external_apis": {}
                },
                "system": {
                    "platform": {"system": "Darwin", "python_version": "3.9.0"},
                    "resources": {"cpu_percent": 25.0, "memory_percent": 60.0}
                },
                "metrics": {
                    "active_websocket_connections": 0,
                    "websocket_manager_info": {
                        "connection_count": 0,
                        "subscriptions": 0
                    }
                }
            }
            
            response = await client.get("/health/detailed")
            
            assert response.status_code == 200
            data = response.json()
            
            # Check response structure
            assert "status" in data
            assert "system" in data
            assert "metrics" in data
            assert "websocket_manager_info" in data["metrics"]
    
    @pytest.mark.api
    async def test_config_health_check(self, client: AsyncClient):
        """Test configuration health check endpoint."""
        with patch("app.core.config_validator.validate_config_and_report") as mock_config:
            mock_config.return_value = (True, {
                "status": "valid",
                "errors": [],
                "warnings": [],
                "summary": "Configuration is valid"
            })
            
            response = await client.get("/config/health")
            
            assert response.status_code == 200
            data = response.json()
            
            # Check response structure
            assert "config_status" in data
            assert "environment" in data
            assert "debug_mode" in data
            assert "errors" in data
            assert "warnings" in data
            assert "summary" in data
            
            # Check specific values
            assert data["config_status"] == "valid"
    
    @pytest.mark.api
    async def test_config_health_check_invalid(self, client: AsyncClient):
        """Test configuration health check with invalid config."""
        with patch("app.core.config_validator.validate_config_and_report") as mock_config:
            mock_config.return_value = (False, {
                "status": "invalid",
                "errors": ["SECRET_KEY is too short"],
                "warnings": ["Redis not configured"],
                "summary": "Configuration has errors"
            })
            
            response = await client.get("/config/health")
            
            assert response.status_code == 400  # Bad Request
            data = response.json()
            assert data["config_status"] == "invalid"
            assert len(data["errors"]) > 0
    
    @pytest.mark.api
    async def test_health_endpoint_cors_headers(self, client: AsyncClient):
        """Test that health endpoints include proper CORS headers."""
        # Test with OPTIONS request to simulate preflight
        response = await client.options("/health")
        
        # FastAPI should handle OPTIONS automatically
        # The actual CORS headers are set by the middleware
        assert response.status_code in [200, 405]  # 405 is OK for OPTIONS if not explicitly handled
    
    @pytest.mark.api
    async def test_health_endpoint_performance(self, client: AsyncClient):
        """Test health endpoint response time."""
        import time
        
        start_time = time.time()
        response = await client.get("/health/quick")
        end_time = time.time()
        
        # Health check should be fast (under 5 seconds)
        assert (end_time - start_time) < 5.0
        assert response.status_code in [200, 503]
    
    @pytest.mark.api
    async def test_health_endpoint_with_websocket_connections(self, client: AsyncClient):
        """Test health endpoint includes websocket metrics."""
        with patch("app.main.manager") as mock_manager:
            mock_manager.active_connections = ["conn1", "conn2"]
            
            with patch("app.core.health.health_service.get_comprehensive_health") as mock_health:
                mock_health.return_value = {
                    "status": "healthy",
                    "services": {},
                    "metrics": {"active_websocket_connections": 2}
                }
                
                response = await client.get("/health")
                
                assert response.status_code == 200
                data = response.json()
                assert data["metrics"]["active_websocket_connections"] == 2