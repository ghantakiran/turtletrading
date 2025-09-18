"""
Market overview and trends endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from app.services.market_service import MarketService
from app.models.market_schemas import (
    MarketOverview,
    MarketIndices,
    TopMovers,
    MarketTrends
)
from loguru import logger

router = APIRouter()

# Initialize market service
market_service = MarketService()


@router.get("/overview", response_model=MarketOverview)
async def get_market_overview():
    """Get comprehensive market overview with major indices and statistics"""
    try:
        overview = await market_service.get_market_overview()
        return overview
        
    except Exception as e:
        logger.error(f"Error getting market overview: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching market overview: {str(e)}")


@router.get("/indices", response_model=MarketIndices)
async def get_market_indices():
    """Get major market indices (S&P 500, NASDAQ, DOW, etc.)"""
    try:
        indices = await market_service.get_market_indices()
        return indices
        
    except Exception as e:
        logger.error(f"Error getting market indices: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching market indices: {str(e)}")


@router.get("/movers", response_model=TopMovers)
async def get_top_movers(
    market: str = Query("US", description="Market (US, NASDAQ, NYSE)"),
    limit: int = Query(20, description="Number of results", ge=5, le=50)
):
    """Get top gaining and losing stocks"""
    try:
        movers = await market_service.get_top_movers(market, limit)
        return movers
        
    except Exception as e:
        logger.error(f"Error getting top movers: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching top movers: {str(e)}")


@router.get("/trends", response_model=MarketTrends)
async def get_market_trends(
    timeframe: str = Query("1M", description="Timeframe (1W, 1M, 3M, 6M, 1Y)"),
    sector: Optional[str] = Query(None, description="Specific sector to analyze")
):
    """Get market trends and analysis"""
    try:
        trends = await market_service.get_market_trends(timeframe, sector)
        return trends
        
    except Exception as e:
        logger.error(f"Error getting market trends: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching market trends: {str(e)}")


@router.get("/sectors")
async def get_sector_performance():
    """Get performance data for different market sectors"""
    try:
        sectors = await market_service.get_sector_performance()
        return {
            "timestamp": datetime.utcnow(),
            "sectors": sectors
        }
        
    except Exception as e:
        logger.error(f"Error getting sector performance: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching sector performance: {str(e)}")


@router.get("/volatility")
async def get_market_volatility(
    period: str = Query("30d", description="Period for volatility calculation")
):
    """Get market volatility indicators"""
    try:
        volatility = await market_service.get_market_volatility(period)
        return {
            "timestamp": datetime.utcnow(),
            "period": period,
            "volatility_data": volatility
        }
        
    except Exception as e:
        logger.error(f"Error getting market volatility: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching market volatility: {str(e)}")


@router.get("/fear-greed")
async def get_fear_greed_index():
    """Get Fear & Greed index for market sentiment"""
    try:
        fear_greed = await market_service.get_fear_greed_index()
        return {
            "timestamp": datetime.utcnow(),
            "fear_greed_index": fear_greed
        }
        
    except Exception as e:
        logger.error(f"Error getting Fear & Greed index: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching Fear & Greed index: {str(e)}")


@router.get("/economic-calendar")
async def get_economic_calendar(
    days_ahead: int = Query(7, description="Number of days ahead to fetch events", ge=1, le=30)
):
    """Get upcoming economic events and calendar"""
    try:
        calendar = await market_service.get_economic_calendar(days_ahead)
        return {
            "timestamp": datetime.utcnow(),
            "days_ahead": days_ahead,
            "events": calendar
        }
        
    except Exception as e:
        logger.error(f"Error getting economic calendar: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching economic calendar: {str(e)}")


@router.get("/correlation-matrix")
async def get_correlation_matrix(
    symbols: List[str] = Query(None, description="Stock symbols for correlation analysis"),
    period: str = Query("3M", description="Period for correlation calculation")
):
    """Get correlation matrix for stocks or indices"""
    try:
        if not symbols:
            symbols = ["SPY", "QQQ", "IWM", "DIA", "VTI"]  # Default to major ETFs
        
        correlation = await market_service.get_correlation_matrix(symbols, period)
        return {
            "timestamp": datetime.utcnow(),
            "symbols": symbols,
            "period": period,
            "correlation_matrix": correlation
        }
        
    except Exception as e:
        logger.error(f"Error getting correlation matrix: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching correlation matrix: {str(e)}")


@router.get("/trading-session")
async def get_trading_session_info():
    """Get current trading session information and market hours"""
    try:
        session_info = await market_service.get_trading_session_info()
        return session_info
        
    except Exception as e:
        logger.error(f"Error getting trading session info: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching trading session info: {str(e)}")