"""
Stock search endpoints for autocomplete and symbol lookup
Fixes GitHub Issue #6
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict
from loguru import logger

from app.core.config import settings

router = APIRouter()


@router.get("/stocks/search")
async def search_stocks(
    q: str = Query(..., min_length=1, description="Search query (symbol or company name)")
):
    """
    Search for stocks by symbol or company name

    Returns matching stocks with basic information
    """
    try:
        query = q.upper().strip()

        # Get default tickers from settings
        all_tickers = settings.DEFAULT_TICKERS if hasattr(settings, 'DEFAULT_TICKERS') else [
            "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "JPM", "V", "WMT"
        ]

        # Simple search - filter by symbol prefix
        matching_symbols = [
            ticker for ticker in all_tickers
            if ticker.startswith(query) or query in ticker
        ]

        # Build results with stock info
        results = []
        for symbol in matching_symbols[:10]:  # Limit to 10 results
            results.append({
                "symbol": symbol,
                "name": f"{symbol} Inc.",  # Placeholder - would fetch from yfinance
                "type": "Stock",
                "exchange": "NASDAQ"
            })

        return {
            "query": q,
            "results": results,
            "count": len(results)
        }

    except Exception as e:
        logger.error(f"Search error for query '{q}': {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/stocks/suggestions")
async def get_stock_suggestions(
    q: str = Query("", description="Search query for suggestions")
):
    """
    Get stock symbol suggestions for autocomplete

    Returns list of matching symbols
    """
    try:
        if not q:
            # Return popular stocks if no query
            return {
                "suggestions": ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"],
                "query": ""
            }

        query = q.upper().strip()

        # Get available tickers
        all_tickers = settings.DEFAULT_TICKERS if hasattr(settings, 'DEFAULT_TICKERS') else [
            "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "TSLA", "META", "NVDA",
            "JPM", "V", "WMT", "DIS", "NFLX", "PYPL", "ADBE", "CRM"
        ]

        # Filter matching tickers
        suggestions = [
            ticker for ticker in all_tickers
            if ticker.startswith(query) or query in ticker
        ][:10]

        return {
            "query": q,
            "suggestions": suggestions
        }

    except Exception as e:
        logger.error(f"Suggestions error for query '{q}': {e}")
        raise HTTPException(status_code=500, detail=f"Suggestions failed: {str(e)}")
