"""
Main API router that includes all endpoint modules
"""

from fastapi import APIRouter
from app.api.endpoints import stocks, market, sentiment, auth, websocket_info
from app.api.v1 import options, backtest, scanners

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

api_router.include_router(
    options.router,
    prefix="/v1",
    tags=["options"]
)

api_router.include_router(
    backtest.router,
    prefix="/v1",
    tags=["backtesting"]
)

api_router.include_router(
    scanners.router,
    tags=["scanners"]
)