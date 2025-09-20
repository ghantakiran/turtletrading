"""
Dependency Injection for FastAPI

Provides dependency functions for service injection across API endpoints.
"""

from typing import Annotated
from fastapi import Depends

from ..services.stock_service import StockService
from ..services.market_service import MarketService
from ..services.sentiment_service import SentimentService
from ..services.backtesting_service import BacktestingService
from ..services.options_service import OptionsAnalyticsService


# Service instances (singleton pattern)
_stock_service = None
_market_service = None
_sentiment_service = None
_backtesting_service = None
_options_service = None


def get_stock_service() -> StockService:
    """Get StockService instance"""
    global _stock_service
    if _stock_service is None:
        _stock_service = StockService()
    return _stock_service


def get_market_service() -> MarketService:
    """Get MarketService instance"""
    global _market_service
    if _market_service is None:
        _market_service = MarketService()
    return _market_service


def get_sentiment_service() -> SentimentService:
    """Get SentimentService instance"""
    global _sentiment_service
    if _sentiment_service is None:
        _sentiment_service = SentimentService()
    return _sentiment_service


def get_backtesting_service() -> BacktestingService:
    """Get BacktestingService instance"""
    global _backtesting_service
    if _backtesting_service is None:
        _backtesting_service = BacktestingService()
    return _backtesting_service


def get_options_service() -> OptionsAnalyticsService:
    """Get OptionsAnalyticsService instance"""
    global _options_service
    if _options_service is None:
        _options_service = OptionsAnalyticsService()
    return _options_service


# Type annotations for dependency injection
StockServiceDep = Annotated[StockService, Depends(get_stock_service)]
MarketServiceDep = Annotated[MarketService, Depends(get_market_service)]
SentimentServiceDep = Annotated[SentimentService, Depends(get_sentiment_service)]
BacktestingServiceDep = Annotated[BacktestingService, Depends(get_backtesting_service)]
OptionsServiceDep = Annotated[OptionsAnalyticsService, Depends(get_options_service)]