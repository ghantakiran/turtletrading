"""
Sentiment analysis endpoints for market and stock sentiment
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta

from app.services.sentiment_service import SentimentService
from app.models.sentiment_schemas import (
    SentimentAnalysis,
    MarketSentiment,
    NewsArticle,
    SocialSentiment
)
from loguru import logger

router = APIRouter()

# Initialize sentiment service
sentiment_service = SentimentService()


@router.get("/market", response_model=MarketSentiment)
async def get_market_sentiment():
    """Get overall market sentiment analysis"""
    try:
        sentiment = await sentiment_service.get_market_sentiment()
        return sentiment
        
    except Exception as e:
        logger.error(f"Error getting market sentiment: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching market sentiment: {str(e)}")


@router.get("/{symbol}", response_model=SentimentAnalysis)
async def get_stock_sentiment(
    symbol: str,
    timeframe: str = Query("7d", description="Timeframe for sentiment analysis (1d, 7d, 30d)")
):
    """Get sentiment analysis for a specific stock"""
    try:
        symbol = symbol.upper()
        sentiment = await sentiment_service.get_stock_sentiment(symbol, timeframe)
        
        if not sentiment:
            raise HTTPException(status_code=404, detail=f"Sentiment data for {symbol} not found")
        
        return sentiment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sentiment for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching stock sentiment: {str(e)}")


@router.get("/{symbol}/news", response_model=List[NewsArticle])
async def get_stock_news(
    symbol: str,
    limit: int = Query(20, description="Number of news articles", ge=5, le=100),
    days_back: int = Query(7, description="Days back to fetch news", ge=1, le=30)
):
    """Get latest news articles for a stock with sentiment scores"""
    try:
        symbol = symbol.upper()
        news = await sentiment_service.get_stock_news(symbol, limit, days_back)
        
        return news
        
    except Exception as e:
        logger.error(f"Error getting news for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching stock news: {str(e)}")


@router.get("/{symbol}/social", response_model=SocialSentiment)
async def get_social_sentiment(
    symbol: str,
    platform: str = Query("all", description="Social platform (twitter, reddit, all)"),
    timeframe: str = Query("24h", description="Timeframe for social sentiment (1h, 24h, 7d)")
):
    """Get social media sentiment for a stock"""
    try:
        symbol = symbol.upper()
        social_sentiment = await sentiment_service.get_social_sentiment(symbol, platform, timeframe)
        
        if not social_sentiment:
            raise HTTPException(status_code=404, detail=f"Social sentiment for {symbol} not found")
        
        return social_sentiment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting social sentiment for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching social sentiment: {str(e)}")


@router.get("/news/trending")
async def get_trending_news(
    category: str = Query("market", description="News category (market, stocks, economy, crypto)"),
    limit: int = Query(50, description="Number of articles", ge=10, le=100)
):
    """Get trending financial news with sentiment analysis"""
    try:
        news = await sentiment_service.get_trending_news(category, limit)
        
        return {
            "timestamp": datetime.utcnow(),
            "category": category,
            "articles": news
        }
        
    except Exception as e:
        logger.error(f"Error getting trending news: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching trending news: {str(e)}")


@router.get("/sector/{sector}")
async def get_sector_sentiment(
    sector: str,
    timeframe: str = Query("7d", description="Timeframe for analysis")
):
    """Get sentiment analysis for a specific sector"""
    try:
        sector_sentiment = await sentiment_service.get_sector_sentiment(sector, timeframe)
        
        return {
            "timestamp": datetime.utcnow(),
            "sector": sector,
            "timeframe": timeframe,
            "sentiment_data": sector_sentiment
        }
        
    except Exception as e:
        logger.error(f"Error getting sector sentiment for {sector}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching sector sentiment: {str(e)}")


@router.post("/batch")
async def get_batch_sentiment(
    symbols: List[str],
    timeframe: str = Query("7d", description="Timeframe for analysis"),
    include_news: bool = Query(True, description="Include news articles"),
    include_social: bool = Query(False, description="Include social sentiment")
):
    """Get sentiment analysis for multiple stocks"""
    try:
        if len(symbols) > 20:
            raise HTTPException(status_code=400, detail="Maximum 20 symbols allowed per batch")
        
        symbols = [s.upper() for s in symbols]
        batch_sentiment = await sentiment_service.get_batch_sentiment(
            symbols, timeframe, include_news, include_social
        )
        
        return {
            "timestamp": datetime.utcnow(),
            "symbols": symbols,
            "timeframe": timeframe,
            "results": batch_sentiment
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch sentiment: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching batch sentiment: {str(e)}")


@router.get("/keywords/trending")
async def get_trending_keywords(
    timeframe: str = Query("24h", description="Timeframe for keyword analysis"),
    category: str = Query("stocks", description="Category (stocks, crypto, economy)")
):
    """Get trending keywords and topics in financial discussions"""
    try:
        keywords = await sentiment_service.get_trending_keywords(timeframe, category)
        
        return {
            "timestamp": datetime.utcnow(),
            "timeframe": timeframe,
            "category": category,
            "trending_keywords": keywords
        }
        
    except Exception as e:
        logger.error(f"Error getting trending keywords: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching trending keywords: {str(e)}")


@router.get("/analysis/summary")
async def get_sentiment_summary():
    """Get overall sentiment summary across markets and top stocks"""
    try:
        summary = await sentiment_service.get_sentiment_summary()
        
        return {
            "timestamp": datetime.utcnow(),
            "summary": summary
        }
        
    except Exception as e:
        logger.error(f"Error getting sentiment summary: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching sentiment summary: {str(e)}")