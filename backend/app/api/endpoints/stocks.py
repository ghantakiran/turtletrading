"""
Stock analysis endpoints with LSTM predictions and technical analysis
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime, timedelta
import asyncio

from app.core.config import settings
from app.services.stock_service import StockService
from app.models.stock_schemas import (
    StockAnalysisResponse,
    StockPrice,
    TechnicalIndicators,
    LSTMPrediction
)
from app.core.external_rate_limiting import get_rate_limit_stats
from loguru import logger

router = APIRouter()

# Initialize stock service
stock_service = StockService()


@router.get("/", response_model=List[str])
async def get_available_stocks():
    """Get list of available stocks for analysis"""
    return settings.DEFAULT_TICKERS


@router.get("/{symbol}/price", response_model=StockPrice)
async def get_stock_price(symbol: str):
    """Get current stock price and basic information"""
    try:
        symbol = symbol.upper()
        price_data = await stock_service.get_current_price(symbol)
        
        if not price_data:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
        
        return price_data
        
    except Exception as e:
        logger.error(f"Error getting price for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching stock price: {str(e)}")


@router.get("/{symbol}/technical", response_model=TechnicalIndicators)
async def get_technical_indicators(
    symbol: str,
    period: str = Query("1y", description="Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y)")
):
    """Get technical indicators for a stock"""
    try:
        symbol = symbol.upper()
        indicators = await stock_service.get_technical_indicators(symbol, period)
        
        if not indicators:
            raise HTTPException(status_code=404, detail=f"Technical data for {symbol} not found")
        
        return indicators
        
    except Exception as e:
        logger.error(f"Error getting technical indicators for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching technical indicators: {str(e)}")


@router.get("/{symbol}/lstm", response_model=LSTMPrediction)
async def get_lstm_prediction(
    symbol: str,
    days: int = Query(5, description="Number of days to predict", ge=1, le=30)
):
    """Get LSTM price predictions for a stock"""
    try:
        symbol = symbol.upper()
        prediction = await stock_service.get_lstm_prediction(symbol, days)
        
        if not prediction:
            raise HTTPException(status_code=404, detail=f"LSTM prediction for {symbol} not available")
        
        return prediction
        
    except Exception as e:
        logger.error(f"Error getting LSTM prediction for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating LSTM prediction: {str(e)}")


@router.get("/{symbol}/analysis", response_model=StockAnalysisResponse)
async def get_comprehensive_analysis(
    symbol: str,
    period: str = Query("2y", description="Data period for analysis"),
    include_sentiment: bool = Query(True, description="Include sentiment analysis"),
    prediction_days: int = Query(5, description="LSTM prediction days", ge=1, le=30)
):
    """Get comprehensive stock analysis including LSTM, technical indicators, and sentiment"""
    try:
        symbol = symbol.upper()
        logger.info(f"Starting comprehensive analysis for {symbol}")
        
        # Run analysis components concurrently
        tasks = [
            stock_service.get_current_price(symbol),
            stock_service.get_technical_indicators(symbol, period),
            stock_service.get_lstm_prediction(symbol, prediction_days)
        ]
        
        if include_sentiment:
            tasks.append(stock_service.get_sentiment_analysis(symbol))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        price_data = results[0] if not isinstance(results[0], Exception) else None
        technical_data = results[1] if not isinstance(results[1], Exception) else None
        lstm_data = results[2] if not isinstance(results[2], Exception) else None
        sentiment_data = results[3] if len(results) > 3 and not isinstance(results[3], Exception) else None
        
        if not price_data:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
        
        # Calculate comprehensive score
        analysis_score = stock_service.calculate_analysis_score(
            technical_data, lstm_data, sentiment_data
        )
        
        response = StockAnalysisResponse(
            symbol=symbol,
            timestamp=datetime.utcnow(),
            price=price_data,
            technical_indicators=technical_data,
            lstm_prediction=lstm_data,
            sentiment_analysis=sentiment_data,
            analysis_score=analysis_score,
            recommendation=stock_service.get_recommendation(analysis_score),
            confidence_level=0.85,  # Mock confidence level
            key_factors=stock_service._extract_key_factors(technical_data, lstm_data),
            warnings=stock_service._extract_warnings(technical_data, lstm_data)
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in comprehensive analysis for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error performing analysis: {str(e)}")


@router.post("/batch-analysis")
async def get_batch_analysis(
    symbols: List[str],
    period: str = Query("1y", description="Data period for analysis"),
    include_sentiment: bool = Query(False, description="Include sentiment analysis"),
    prediction_days: int = Query(5, description="LSTM prediction days", ge=1, le=30)
):
    """Get analysis for multiple stocks"""
    try:
        if len(symbols) > 20:
            raise HTTPException(status_code=400, detail="Maximum 20 symbols allowed per batch")
        
        symbols = [s.upper() for s in symbols]
        logger.info(f"Starting batch analysis for {len(symbols)} symbols")
        
        # Create analysis tasks for all symbols
        tasks = []
        for symbol in symbols:
            task = stock_service.get_comprehensive_analysis_data(
                symbol, period, include_sentiment, prediction_days
            )
            tasks.append(task)
        
        # Execute all analyses concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        successful_results = []
        errors = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                errors.append({
                    "symbol": symbols[i],
                    "error": str(result)
                })
            else:
                successful_results.append(result)
        
        return {
            "successful_analyses": successful_results,
            "errors": errors,
            "total_requested": len(symbols),
            "successful_count": len(successful_results),
            "error_count": len(errors)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Error performing batch analysis: {str(e)}")


@router.get("/{symbol}/history")
async def get_price_history(
    symbol: str,
    period: str = Query("1y", description="Data period"),
    interval: str = Query("1d", description="Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)")
):
    """Get historical price data for a stock"""
    try:
        symbol = symbol.upper()
        history = await stock_service.get_price_history(symbol, period, interval)
        
        if not history:
            raise HTTPException(status_code=404, detail=f"Historical data for {symbol} not found")
        
        return {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "data": history
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting price history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching price history: {str(e)}")


@router.get("/{symbol}/enhanced-technical")
async def get_enhanced_technical_indicators(
    symbol: str,
    period: str = Query(default="1y", description="Time period for analysis (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y)")
):
    """Get enhanced technical indicators using both TA-Lib and ta library"""
    try:
        symbol = symbol.upper()
        enhanced_data = await stock_service.get_enhanced_technical_indicators(symbol, period)

        if not enhanced_data:
            raise HTTPException(status_code=404, detail=f"Enhanced technical data for {symbol} not found")

        return enhanced_data

    except Exception as e:
        logger.error(f"Error getting enhanced technical indicators for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching enhanced technical indicators: {str(e)}")


@router.get("/rate-limit-stats")
async def get_external_api_rate_limit_stats():
    """Get external API rate limiting statistics"""
    try:
        yfinance_stats = get_rate_limit_stats("yfinance")
        alpha_vantage_stats = get_rate_limit_stats("alpha_vantage")

        return {
            "yfinance": yfinance_stats,
            "alpha_vantage": alpha_vantage_stats,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting rate limit stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching rate limit stats: {str(e)}")