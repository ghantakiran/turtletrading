"""
Centralized health check service for TurtleTrading platform
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import redis
from loguru import logger

from app.core.config import settings
from app.core.database import check_database_health


class HealthService:
    """Centralized health monitoring service"""
    
    def __init__(self):
        self.start_time = time.time()
        self.redis_client = None
        self._setup_redis()
        
    def _setup_redis(self):
        """Setup Redis connection for health checks"""
        try:
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Health service Redis connection established")
        except Exception as e:
            logger.warning(f"Health service Redis connection failed: {e}")
            self.redis_client = None
    
    async def check_redis_health(self) -> Dict[str, Any]:
        """Check Redis health status"""
        if not self.redis_client:
            return {
                "status": "unavailable",
                "message": "Redis client not initialized",
                "latency_ms": None
            }
        
        try:
            start_time = time.time()
            result = self.redis_client.ping()
            latency = (time.time() - start_time) * 1000
            
            if result:
                # Additional Redis info
                info = self.redis_client.info()
                memory_usage = info.get('used_memory_human', 'unknown')
                connected_clients = info.get('connected_clients', 0)
                
                return {
                    "status": "healthy",
                    "latency_ms": round(latency, 2),
                    "memory_usage": memory_usage,
                    "connected_clients": connected_clients,
                    "version": info.get('redis_version', 'unknown')
                }
            else:
                return {
                    "status": "unhealthy",
                    "message": "Redis ping failed",
                    "latency_ms": round(latency, 2)
                }
                
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"Redis health check failed: {str(e)}",
                "latency_ms": None
            }
    
    async def check_external_api_health(self) -> Dict[str, Any]:
        """Check health of external APIs"""
        # This is a placeholder for future external API health checks
        # Will check Yahoo Finance, Alpha Vantage, NewsAPI, etc.
        health_status = {
            "yahoo_finance": {"status": "unknown", "message": "Health check not implemented"},
            "alpha_vantage": {"status": "unknown", "message": "Health check not implemented"},
            "newsapi": {"status": "unknown", "message": "Health check not implemented"}
        }
        
        # Simple overall status logic
        if settings.ALPHA_VANTAGE_API_KEY:
            health_status["alpha_vantage"]["status"] = "configured"
        else:
            health_status["alpha_vantage"]["status"] = "not_configured"
            
        if settings.FINNHUB_API_KEY:
            health_status["finnhub"] = {"status": "configured"}
        else:
            health_status["finnhub"] = {"status": "not_configured"}
            
        if settings.NEWS_API_KEY:
            health_status["newsapi"]["status"] = "configured"
        else:
            health_status["newsapi"]["status"] = "not_configured"
        
        return health_status
    
    def get_uptime_info(self) -> Dict[str, Any]:
        """Get application uptime information"""
        uptime_seconds = time.time() - self.start_time
        uptime_delta = timedelta(seconds=uptime_seconds)
        
        return {
            "uptime_seconds": round(uptime_seconds, 2),
            "uptime_human": str(uptime_delta),
            "start_time": datetime.fromtimestamp(self.start_time).isoformat(),
            "current_time": datetime.utcnow().isoformat()
        }
    
    def get_system_info(self) -> Dict[str, Any]:
        """Get system information"""
        import psutil
        import platform
        
        try:
            # CPU and memory info
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                "platform": {
                    "system": platform.system(),
                    "release": platform.release(),
                    "python_version": platform.python_version()
                },
                "resources": {
                    "cpu_percent": cpu_percent,
                    "memory_percent": memory.percent,
                    "memory_available_mb": round(memory.available / 1024 / 1024, 2),
                    "disk_percent": disk.percent,
                    "disk_free_gb": round(disk.free / 1024 / 1024 / 1024, 2)
                }
            }
        except ImportError:
            return {
                "platform": {
                    "system": platform.system(),
                    "release": platform.release(),
                    "python_version": platform.python_version()
                },
                "resources": {
                    "message": "psutil not available - install for detailed resource info"
                }
            }
        except Exception as e:
            return {
                "error": f"Failed to get system info: {str(e)}"
            }
    
    async def get_comprehensive_health(self, include_system: bool = False) -> Dict[str, Any]:
        """Get comprehensive health status"""
        try:
            # Run health checks concurrently
            db_health, redis_health, api_health = await asyncio.gather(
                check_database_health(),
                self.check_redis_health(),
                self.check_external_api_health()
            )
            
            # Determine overall status
            critical_services = [db_health["status"], redis_health["status"]]
            if "unhealthy" in critical_services or "unavailable" in critical_services:
                overall_status = "unhealthy"
            elif "degraded" in critical_services:
                overall_status = "degraded"
            else:
                overall_status = "healthy"
            
            health_response = {
                "status": overall_status,
                "timestamp": datetime.utcnow().isoformat(),
                "version": settings.VERSION,
                "environment": settings.ENVIRONMENT,
                "uptime": self.get_uptime_info(),
                "services": {
                    "api": "operational",
                    "websocket": "operational",
                    "database": db_health,
                    "redis": redis_health,
                    "external_apis": api_health
                }
            }
            
            # Add system info if requested
            if include_system:
                health_response["system"] = self.get_system_info()
                
            return health_response
            
        except Exception as e:
            logger.error(f"Comprehensive health check failed: {e}")
            return {
                "status": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "message": "Health check system failure"
            }


# Global health service instance
health_service = HealthService()


async def get_health_status(detailed: bool = False) -> Dict[str, Any]:
    """Get health status with optional detailed information"""
    return await health_service.get_comprehensive_health(include_system=detailed)


async def get_quick_health_status() -> Dict[str, Any]:
    """Get quick health status for load balancers"""
    try:
        # Quick database check
        db_health = await check_database_health()
        redis_health = await health_service.check_redis_health()
        
        if db_health["status"] == "healthy" and redis_health["status"] in ["healthy", "unavailable"]:
            status = "healthy"
        else:
            status = "unhealthy"
            
        return {
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "database": db_health["status"],
                "redis": redis_health["status"]
            }
        }
        
    except Exception as e:
        logger.error(f"Quick health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": "Health check failed"
        }