"""
AI-Enhanced News API Endpoints

Provides AI-powered news analysis with intelligent categorization,
impact scoring, and sentiment enhancement using Claude/OpenAI.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime
from loguru import logger

from app.services.ai_news_analysis_service import get_ai_news_analysis_service, AINewsAnalysisService
from app.services.sentiment_aggregation_service import SentimentAggregationService, create_sentiment_aggregation_service
from app.core.config import settings

router = APIRouter()


async def get_sentiment_service() -> SentimentAggregationService:
    """Get sentiment aggregation service."""
    return await create_sentiment_aggregation_service(settings.REDIS_URL)


@router.get("/enhanced/{symbol}")
async def get_enhanced_news_for_symbol(
    symbol: str,
    limit: int = Query(10, ge=1, le=50, description="Number of news articles to return"),
    use_ai: bool = Query(True, description="Use AI analysis (Claude API)"),
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service)
):
    """
    Get AI-enhanced news analysis for a specific stock symbol.

    This endpoint fetches news from the sentiment service and enhances it
    with AI-powered categorization, impact scoring, and advanced sentiment analysis.

    Args:
        symbol: Stock symbol (e.g., AAPL, MSFT)
        limit: Maximum number of articles to return (1-50)
        use_ai: Whether to use AI analysis (falls back to pattern matching if false)

    Returns:
        Enhanced news articles with AI insights
    """
    try:
        symbol = symbol.upper()

        # Get base sentiment data with news
        aggregation = await sentiment_service.aggregate_sentiment(
            ticker=symbol,
            window_size="1d"
        )

        if not aggregation:
            return {
                "symbol": symbol,
                "news_count": 0,
                "articles": [],
                "message": "No news data available for this symbol"
            }

        # Get AI analysis service
        ai_service = get_ai_news_analysis_service()

        # Extract recent news from aggregation
        # Note: This is a simplified version. In production, you'd fetch from a dedicated news table
        recent_news = getattr(aggregation, 'recent_news', [])

        if not recent_news:
            return {
                "symbol": symbol,
                "news_count": 0,
                "articles": [],
                "overall_sentiment": aggregation.weighted_sentiment,
                "message": "No recent news articles found"
            }

        # Prepare articles for AI analysis
        articles_to_analyze = []
        for news_item in recent_news[:limit]:
            articles_to_analyze.append({
                'title': news_item.get('title', ''),
                'content': news_item.get('summary', '') or news_item.get('title', ''),
                'source': news_item.get('source', 'Unknown'),
                'sentiment': news_item.get('sentiment_score', 0.0),
                'symbols': [symbol],
                'url': news_item.get('url', ''),
                'published_at': news_item.get('published_at', datetime.utcnow().isoformat())
            })

        # Batch analyze with AI
        if use_ai and articles_to_analyze:
            ai_analyses = await ai_service.batch_analyze_news(articles_to_analyze, max_concurrent=3)
        else:
            # Use fallback analysis
            ai_analyses = [
                ai_service._fallback_analysis(
                    article['title'],
                    article['content'],
                    article['source'],
                    article['sentiment'],
                    article['symbols']
                )
                for article in articles_to_analyze
            ]

        # Combine original news with AI analysis
        enhanced_articles = []
        for article, analysis in zip(articles_to_analyze, ai_analyses):
            enhanced_articles.append({
                'title': article['title'],
                'source': article['source'],
                'url': article['url'],
                'published_at': article['published_at'],
                'symbols': article['symbols'],

                # AI-enhanced fields
                'category': analysis['category'],
                'impact_level': analysis['impact_level'],
                'impact_score': analysis['impact_score'],
                'sentiment_score': analysis['enhanced_sentiment'],
                'original_sentiment': analysis['original_sentiment'],
                'summary': analysis['summary'],
                'key_insights': analysis.get('key_insights', []),
                'is_flash_news': analysis['is_flash_news'],

                # Metadata
                'ai_confidence': analysis.get('ai_confidence', 0.0),
                'analysis_method': analysis.get('analysis_method', 'unknown'),
                'analyzed_at': analysis.get('analysis_timestamp')
            })

        # Calculate overall statistics
        total_articles = len(enhanced_articles)
        flash_news_count = sum(1 for a in enhanced_articles if a['is_flash_news'])
        avg_impact_score = sum(a['impact_score'] for a in enhanced_articles) / total_articles if total_articles > 0 else 0.0
        avg_sentiment = sum(a['sentiment_score'] for a in enhanced_articles) / total_articles if total_articles > 0 else 0.0

        # Category distribution
        category_counts = {}
        for article in enhanced_articles:
            cat = article['category']
            category_counts[cat] = category_counts.get(cat, 0) + 1

        return {
            'symbol': symbol,
            'timestamp': datetime.utcnow().isoformat(),
            'news_count': total_articles,
            'flash_news_count': flash_news_count,
            'average_impact_score': round(avg_impact_score, 3),
            'average_sentiment': round(avg_sentiment, 3),
            'category_distribution': category_counts,
            'articles': enhanced_articles,
            'ai_enabled': use_ai,
            'data_source': 'sentiment_aggregation_service'
        }

    except Exception as e:
        logger.error(f"Error getting enhanced news for {symbol}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching enhanced news: {str(e)}"
        )


@router.get("/market/enhanced")
async def get_enhanced_market_news(
    symbols: List[str] = Query(['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'], description="Stock symbols to fetch news for"),
    limit_per_symbol: int = Query(3, ge=1, le=10, description="Articles per symbol"),
    use_ai: bool = Query(True, description="Use AI analysis"),
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service)
):
    """
    Get AI-enhanced news across multiple market symbols.

    Aggregates news from multiple stocks with AI analysis,
    sorted by impact score and recency.

    Args:
        symbols: List of stock symbols to fetch news for
        limit_per_symbol: Maximum articles per symbol
        use_ai: Whether to use AI analysis

    Returns:
        Aggregated and sorted enhanced news articles
    """
    try:
        all_articles = []

        # Fetch news for each symbol
        for symbol in symbols[:10]:  # Limit to 10 symbols max
            try:
                symbol_response = await get_enhanced_news_for_symbol(
                    symbol=symbol,
                    limit=limit_per_symbol,
                    use_ai=use_ai,
                    sentiment_service=sentiment_service
                )

                all_articles.extend(symbol_response.get('articles', []))

            except Exception as e:
                logger.warning(f"Failed to fetch news for {symbol}: {e}")
                continue

        # Sort by impact score (descending) then by publish date
        all_articles.sort(
            key=lambda x: (
                -x.get('impact_score', 0),
                -datetime.fromisoformat(x.get('published_at', '2000-01-01')).timestamp()
            )
        )

        # Separate flash news
        flash_news = [a for a in all_articles if a.get('is_flash_news')]
        regular_news = [a for a in all_articles if not a.get('is_flash_news')]

        # Calculate market-wide statistics
        total_articles = len(all_articles)
        avg_market_sentiment = sum(a['sentiment_score'] for a in all_articles) / total_articles if total_articles > 0 else 0.0
        avg_market_impact = sum(a['impact_score'] for a in all_articles) / total_articles if total_articles > 0 else 0.0

        # Category distribution
        category_counts = {}
        for article in all_articles:
            cat = article['category']
            category_counts[cat] = category_counts.get(cat, 0) + 1

        return {
            'timestamp': datetime.utcnow().isoformat(),
            'symbols_analyzed': symbols,
            'total_articles': total_articles,
            'flash_news_count': len(flash_news),
            'average_market_sentiment': round(avg_market_sentiment, 3),
            'average_market_impact': round(avg_market_impact, 3),
            'category_distribution': category_counts,
            'flash_news': flash_news[:10],  # Top 10 flash news
            'regular_news': regular_news[:40],  # Top 40 regular news
            'ai_enabled': use_ai
        }

    except Exception as e:
        logger.error(f"Error getting enhanced market news: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching enhanced market news: {str(e)}"
        )


@router.post("/analyze")
async def analyze_custom_news(
    title: str,
    content: Optional[str] = None,
    source: str = "Custom",
    symbols: List[str] = Query(default=[], description="Related stock symbols")
):
    """
    Analyze a custom news article with AI.

    Useful for analyzing user-provided news or testing AI capabilities.

    Args:
        title: Article title
        content: Article content (optional)
        source: News source name
        symbols: Related stock symbols

    Returns:
        AI analysis results
    """
    try:
        ai_service = get_ai_news_analysis_service()

        analysis = await ai_service.analyze_news_with_ai(
            title=title,
            content=content or title,
            source=source,
            base_sentiment=0.0,  # Will be determined by AI
            symbols=symbols or ['MARKET']
        )

        return {
            'title': title,
            'source': source,
            'symbols': symbols,
            'analysis': analysis,
            'timestamp': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error analyzing custom news: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing news: {str(e)}"
        )


@router.get("/health")
async def news_ai_health_check():
    """Health check for AI news service."""
    try:
        ai_service = get_ai_news_analysis_service()

        has_api_key = bool(ai_service.api_key)

        return {
            'status': 'healthy',
            'ai_enabled': has_api_key,
            'api_configured': has_api_key,
            'fallback_available': True,
            'model': ai_service.model if has_api_key else 'pattern_matching',
            'timestamp': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"News AI health check failed: {e}")
        return {
            'status': 'degraded',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }
