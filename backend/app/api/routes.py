"""
Main API router that includes all endpoint modules
"""

from fastapi import APIRouter
from app.api.endpoints import stocks, market, sentiment, auth, websocket_info

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(
    stocks.router, 
    prefix="/stocks", 
    tags=["stocks"]
)

api_router.include_router(
    market.router, 
    prefix="/market", 
    tags=["market"]
)

api_router.include_router(
    sentiment.router, 
    prefix="/sentiment", 
    tags=["sentiment"]
)

api_router.include_router(
    auth.router, 
    prefix="/auth", 
    tags=["authentication"]
)

api_router.include_router(
    websocket_info.router,
    prefix="/ws-info",
    tags=["websocket"]
)