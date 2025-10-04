"""
Main API router that includes all endpoint modules
"""

from fastapi import APIRouter
from app.api.endpoints import stocks, market, auth, websocket_info, search, lstm, sentiment_simple, news_ai
# from app.api.endpoints import sentiment  # Full sentiment requires spacy - will enable in Issue #12
from app.api.v1 import options, backtest, scanners, regimes

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
    sentiment_simple.router,
    prefix="/sentiment",
    tags=["sentiment"]
)

api_router.include_router(
    lstm.router,
    prefix="/lstm",
    tags=["lstm"]
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
    search.router,
    tags=["search"]
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

api_router.include_router(
    regimes.router,
    tags=["regimes"]
)

# AI-Enhanced News Endpoints (Issue #12 Phase 2)
api_router.include_router(
    news_ai.router,
    prefix="/news",
    tags=["news", "ai"]
)