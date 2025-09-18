"""
TurtleTrading FastAPI Application
Main entry point for the market analysis web platform
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn
from contextlib import asynccontextmanager
import json
from typing import List
import asyncio
import time
import uuid
from datetime import datetime

from app.core.config import settings
from app.core.logging import (
    setup_logging,
    get_logger,
    set_request_context,
    clear_request_context,
    log_api_request,
    log_websocket_event
)
from app.core.database import init_database, check_database_health, close_database
from app.core.config_validator import validate_config_and_report
from app.core.health import get_health_status, get_quick_health_status
from app.core.rate_limiting import setup_rate_limiting
from app.core.external_rate_limiting import initialize_external_rate_limiter
from app.api.routes import api_router
from app.services.websocket_manager import ConnectionManager
from app.services.redis_pubsub import RedisStreamer
from app.services.market_data_streamer import MarketDataStreamer

# Set up structured logging
logger = setup_logging()
app_logger = get_logger("turtletrading.main")

# WebSocket connection manager
manager = ConnectionManager()

# Redis streaming service
redis_streamer = None

# Market data streaming service
market_streamer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager with structured logging"""
    app_logger.info(
        "🚀 Starting TurtleTrading application...", 
        extra={"log_type": "application_lifecycle", "event": "startup_begin"}
    )
    
    # Startup tasks
    try:
        # Initialize database
        start_time = time.time()
        await init_database()
        db_init_time = time.time() - start_time
        
        app_logger.info(
            f"✅ Database initialized successfully ({db_init_time:.3f}s)",
            extra={
                "log_type": "database",
                "event": "initialization",
                "duration_ms": round(db_init_time * 1000, 2)
            }
        )

        # Initialize external API rate limiter
        await initialize_external_rate_limiter()

        # Initialize Redis streaming service
        global redis_streamer, market_streamer
        try:
            redis_streamer = RedisStreamer(manager)
            await redis_streamer.start()

            # Connect Redis streamer to WebSocket manager
            manager.set_redis_streamer(redis_streamer)

            app_logger.info(
                "✅ Redis streaming service initialized successfully",
                extra={
                    "log_type": "redis_streaming",
                    "event": "initialization"
                }
            )

            # Initialize market data streaming service
            market_streamer = MarketDataStreamer(redis_streamer)
            await market_streamer.start()

            app_logger.info(
                "✅ Market data streaming service initialized successfully",
                extra={
                    "log_type": "market_streaming",
                    "event": "initialization"
                }
            )

        except Exception as redis_error:
            app_logger.warning(
                f"⚠️ Redis/Market streaming services failed to start: {redis_error}",
                extra={
                    "log_type": "streaming_services",
                    "event": "initialization_failed"
                }
            )
            # Continue without streaming services
            redis_streamer = None
            market_streamer = None

        # Start background tasks
        # Additional background tasks can be added here
        
        app_logger.info(
            "✅ Application startup complete",
            extra={"log_type": "application_lifecycle", "event": "startup_complete"}
        )
        yield
        
    except Exception as e:
        app_logger.error(
            f"❌ Startup error: {e}",
            extra={"log_type": "application_lifecycle", "event": "startup_error"},
            exc_info=True
        )
        raise
    
    finally:
        # Cleanup tasks
        app_logger.info(
            "🛑 Shutting down TurtleTrading application...",
            extra={"log_type": "application_lifecycle", "event": "shutdown_begin"}
        )

        # Stop streaming services
        if market_streamer:
            try:
                await market_streamer.stop()
                app_logger.info(
                    "✅ Market data streaming service stopped",
                    extra={"log_type": "market_streaming", "event": "shutdown"}
                )
            except Exception as e:
                app_logger.error(
                    f"❌ Error stopping market streaming service: {e}",
                    extra={"log_type": "market_streaming", "event": "shutdown_error"}
                )

        if redis_streamer:
            try:
                await redis_streamer.stop()
                app_logger.info(
                    "✅ Redis streaming service stopped",
                    extra={"log_type": "redis_streaming", "event": "shutdown"}
                )
            except Exception as e:
                app_logger.error(
                    f"❌ Error stopping Redis streaming service: {e}",
                    extra={"log_type": "redis_streaming", "event": "shutdown_error"}
                )

        await close_database()
        app_logger.info(
            "✅ Application shutdown complete",
            extra={"log_type": "application_lifecycle", "event": "shutdown_complete"}
        )


# OpenAPI metadata
openapi_tags = [
    {
        "name": "stocks",
        "description": "Stock analysis endpoints including price data, technical indicators, and LSTM predictions",
    },
    {
        "name": "market",
        "description": "Market overview and indices data including S&P 500, NASDAQ, and market breadth",
    },
    {
        "name": "sentiment",
        "description": "Sentiment analysis from news, social media, and market psychology indicators",
    },
    {
        "name": "authentication",
        "description": "User authentication, registration, and JWT token management",
    },
    {
        "name": "websocket",
        "description": "Real-time WebSocket connections for live market data streaming",
    },
    {
        "name": "health",
        "description": "System health checks and service monitoring endpoints",
    },
]

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    **TurtleTrading** is an advanced AI-powered stock market analysis platform that democratizes institutional-grade trading tools for retail investors.

    ## Features

    * **🤖 AI Predictions**: LSTM neural network models for price forecasting
    * **📊 Technical Analysis**: 15+ technical indicators with weighted scoring
    * **📰 Sentiment Analysis**: Real-time news and social media sentiment
    * **⚡ Real-time Data**: WebSocket streaming for live market updates
    * **🔐 Secure Authentication**: JWT-based user authentication and authorization
    * **📈 Market Overview**: Comprehensive market indices and breadth analysis

    ## Quick Start

    1. **Authentication**: Register and login to get your JWT token
    2. **Explore**: Use the interactive documentation below to test endpoints
    3. **WebSocket**: Connect to real-time data streams
    4. **Integrate**: Use our comprehensive API in your applications

    ## Support

    * **Documentation**: Comprehensive guides and examples
    * **GitHub**: Open source components and issue tracking
    * **Community**: Join our Discord for developer support
    """,
    version=settings.VERSION,
    terms_of_service="https://turtletrading.com/terms",
    contact={
        "name": "TurtleTrading API Support",
        "url": "https://turtletrading.com/contact",
        "email": "api-support@turtletrading.com",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    openapi_tags=openapi_tags,
    lifespan=lifespan,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
)

# Security middleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)

# Performance middleware
app.add_middleware(GZipMiddleware, minimum_size=settings.GZIP_MINIMUM_SIZE)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allow_headers=settings.cors_allow_headers_list,
    expose_headers=settings.cors_expose_headers_list,
    max_age=settings.CORS_MAX_AGE,
)

# Rate limiting setup
setup_rate_limiting(app)

# Enhanced middleware for request timing and structured logging
@app.middleware("http")
async def structured_logging_middleware(request: Request, call_next):
    """Enhanced middleware with structured logging and request context"""
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    # Set request context for structured logging
    client_ip = request.client.host if request.client else "unknown"
    set_request_context(
        request_id=request_id,
        client_ip=client_ip
    )
    
    # Add request ID to headers for tracing
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(process_time)
    response.headers["X-API-Version"] = settings.VERSION
    
    # Log API request with structured format
    log_api_request(
        method=request.method,
        path=str(request.url.path),
        status_code=response.status_code,
        duration=process_time,
        query_params=dict(request.query_params),
        user_agent=request.headers.get("user-agent", "unknown"),
        content_length=response.headers.get("content-length"),
        client_ip=client_ip
    )
    
    # Clear request context
    clear_request_context()
    
    return response

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled exceptions"""
    logger.error(f"Global exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred" if not settings.DEBUG else str(exc),
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": id(request)
        }
    )

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": settings.APP_NAME,
        "description": "Advanced AI-Powered Stock Market Analysis Platform",
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "documentation": {
            "swagger": "/api/docs" if settings.DEBUG else None,
            "redoc": "/api/redoc" if settings.DEBUG else None,
            "openapi": "/api/openapi.json" if settings.DEBUG else None
        },
        "endpoints": {
            "health": "/health",
            "websocket": "/ws/{client_id}",
            "api": "/api/v1"
        },
        "features": [
            "Real-time stock market data",
            "LSTM price predictions",
            "Technical analysis indicators",
            "Sentiment analysis",
            "WebSocket streaming",
            "Portfolio management"
        ],
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint"""
    try:
        health_status = await get_health_status(detailed=False)
        
        # Add WebSocket and streaming metrics
        streaming_status = {}
        if redis_streamer:
            streaming_status["redis_streaming"] = redis_streamer.get_status()
        if market_streamer:
            streaming_status["market_streaming"] = market_streamer.get_status()

        health_status["metrics"] = {
            "active_websocket_connections": len(manager.active_connections),
            "streaming_services": streaming_status
        }
        
        # Determine status code
        status_code = 200 if health_status["status"] == "healthy" else 503
        
        return JSONResponse(
            status_code=status_code,
            content=health_status
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e) if settings.DEBUG else "Service temporarily unavailable"
            }
        )


@app.get("/health/quick")
async def quick_health_check():
    """Quick health check endpoint for load balancers"""
    try:
        health_status = await get_quick_health_status()
        status_code = 200 if health_status["status"] == "healthy" else 503
        
        return JSONResponse(
            status_code=status_code,
            content=health_status
        )
        
    except Exception as e:
        logger.error(f"Quick health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check endpoint with system information"""
    try:
        health_status = await get_health_status(detailed=True)
        
        # Add WebSocket and application metrics
        websocket_stats = manager.get_connection_stats()
        streaming_status = {}
        if redis_streamer:
            streaming_status["redis_streaming"] = redis_streamer.get_status()
        if market_streamer:
            streaming_status["market_streaming"] = market_streamer.get_status()

        health_status["metrics"].update({
            "active_websocket_connections": len(manager.active_connections),
            "websocket_manager_info": websocket_stats,
            "streaming_services": streaming_status
        })
        
        status_code = 200 if health_status["status"] == "healthy" else 503
        
        return JSONResponse(
            status_code=status_code,
            content=health_status
        )
        
    except Exception as e:
        logger.error(f"Detailed health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e) if settings.DEBUG else "Service temporarily unavailable"
            }
        )


@app.get("/config/health")
async def config_health_check():
    """Configuration validation health check endpoint"""
    try:
        is_valid, report = validate_config_and_report()
        status_code = 200 if is_valid else 400
        
        return JSONResponse(
            status_code=status_code,
            content={
                "config_status": report["status"],
                "environment": settings.ENVIRONMENT,
                "debug_mode": settings.DEBUG,
                "errors": report["errors"],
                "warnings": report["warnings"],
                "summary": report["summary"],
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Config health check failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "config_status": "error",
                "error": str(e) if settings.DEBUG else "Configuration validation failed",
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time market data with structured logging"""
    await manager.connect(websocket, client_id)
    log_websocket_event("connected", client_id)
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "subscribe":
                # Handle subscription to specific data streams
                symbols = message.get("symbols", [])
                await manager.subscribe_to_symbols(client_id, symbols)
                
                log_websocket_event(
                    "subscription", 
                    client_id, 
                    symbols=symbols,
                    symbol_count=len(symbols)
                )
                
                # Send confirmation
                await manager.send_personal_message({
                    "type": "subscription_confirmed",
                    "symbols": symbols,
                    "timestamp": datetime.utcnow().isoformat()
                }, client_id)
                
            elif message.get("type") == "unsubscribe":
                symbols = message.get("symbols", [])
                await manager.unsubscribe_from_symbols(client_id, symbols)
                
                log_websocket_event(
                    "unsubscription", 
                    client_id, 
                    symbols=symbols,
                    symbol_count=len(symbols)
                )
                
                await manager.send_personal_message({
                    "type": "unsubscription_confirmed", 
                    "symbols": symbols,
                    "timestamp": datetime.utcnow().isoformat()
                }, client_id)
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        log_websocket_event("disconnected", client_id)
    
    except Exception as e:
        app_logger.error(
            f"WebSocket error for client {client_id}: {e}",
            extra={
                "log_type": "websocket",
                "event": "error",
                "client_id": client_id,
                "error_type": type(e).__name__
            },
            exc_info=True
        )
        manager.disconnect(client_id)


@app.get("/ws/test")
async def websocket_test():
    """Test page for WebSocket functionality"""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>WebSocket Test - TurtleTrading</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .messages { border: 1px solid #ccc; height: 300px; padding: 10px; overflow-y: auto; margin: 10px 0; }
            .controls { margin: 10px 0; }
            input, button { margin: 5px; padding: 8px; }
            .connected { color: green; }
            .disconnected { color: red; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>TurtleTrading WebSocket Test</h1>
            <div>Status: <span id="status" class="disconnected">Disconnected</span></div>
            
            <div class="controls">
                <button id="connect">Connect</button>
                <button id="disconnect">Disconnect</button>
                <input type="text" id="clientId" placeholder="Client ID" value="test-client">
            </div>
            
            <div class="controls">
                <input type="text" id="symbols" placeholder="Symbols (comma-separated)" value="AAPL,MSFT,NVDA">
                <button id="subscribe">Subscribe</button>
                <button id="unsubscribe">Unsubscribe</button>
            </div>
            
            <div id="messages" class="messages"></div>
        </div>
        
        <script>
            let ws = null;
            const status = document.getElementById('status');
            const messages = document.getElementById('messages');
            const clientId = document.getElementById('clientId');
            const symbolsInput = document.getElementById('symbols');
            
            function addMessage(message) {
                const div = document.createElement('div');
                div.textContent = new Date().toLocaleTimeString() + ': ' + message;
                messages.appendChild(div);
                messages.scrollTop = messages.scrollHeight;
            }
            
            document.getElementById('connect').onclick = function() {
                if (ws) {
                    ws.close();
                }
                
                const clientIdValue = clientId.value || 'test-client';
                ws = new WebSocket(`ws://localhost:8000/ws/${clientIdValue}`);
                
                ws.onopen = function() {
                    status.textContent = 'Connected';
                    status.className = 'connected';
                    addMessage('Connected to WebSocket');
                };
                
                ws.onclose = function() {
                    status.textContent = 'Disconnected';
                    status.className = 'disconnected';
                    addMessage('WebSocket connection closed');
                };
                
                ws.onmessage = function(event) {
                    addMessage('Received: ' + event.data);
                };
                
                ws.onerror = function(error) {
                    addMessage('Error: ' + error);
                };
            };
            
            document.getElementById('disconnect').onclick = function() {
                if (ws) {
                    ws.close();
                }
            };
            
            document.getElementById('subscribe').onclick = function() {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    const symbols = symbolsInput.value.split(',').map(s => s.trim()).filter(s => s);
                    const message = {
                        type: 'subscribe',
                        symbols: symbols
                    };
                    ws.send(JSON.stringify(message));
                    addMessage('Sent subscribe request for: ' + symbols.join(', '));
                }
            };
            
            document.getElementById('unsubscribe').onclick = function() {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    const symbols = symbolsInput.value.split(',').map(s => s.trim()).filter(s => s);
                    const message = {
                        type: 'unsubscribe',
                        symbols: symbols
                    };
                    ws.send(JSON.stringify(message));
                    addMessage('Sent unsubscribe request for: ' + symbols.join(', '));
                }
            };
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )