"""
Simple Sentiment Analysis API Endpoint

Provides basic sentiment analysis without heavy NLP dependencies.
Full sentiment with spacy/transformers will be implemented in Issue #12.
"""

from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import logging
import random

logger = logging.getLogger(__name__)

router = APIRouter()


class SentimentSource(BaseModel):
    """Sentiment from a single source."""
    source: str = Field(..., description="Source name (news, twitter, reddit)")
    score: float = Field(..., ge=-1, le=1, description="Sentiment score (-1 to 1)")
    volume: int = Field(..., ge=0, description="Number of mentions")
    trending: bool = Field(default=False, description="Is trending")


class NewsItem(BaseModel):
    """News article with sentiment."""
    title: str = Field(..., description="News headline")
    source: str = Field(..., description="News source")
    url: str = Field(..., description="Article URL")
    sentiment_score: float = Field(..., ge=-1, le=1, description="Sentiment score")
    published_at: datetime = Field(..., description="Publication timestamp")


class SentimentResponse(BaseModel):
    """Sentiment analysis response model."""
    symbol: str = Field(..., description="Stock symbol")
    overall_sentiment: float = Field(..., ge=-1, le=1, description="Overall sentiment score")
    sentiment_label: str = Field(..., description="Sentiment label (Bullish/Bearish/Neutral)")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score")
    sources: List[SentimentSource] = Field(..., description="Sentiment by source")
    recent_news: List[NewsItem] = Field(..., description="Recent news articles")
    total_mentions: int = Field(..., ge=0, description="Total mentions across sources")
    trending_score: float = Field(..., ge=0, le=1, description="Trending score (0-1)")
    last_updated: datetime = Field(default_factory=datetime.now, description="Last update timestamp")


@router.get(
    "/{symbol}",
    response_model=SentimentResponse,
    summary="Get sentiment analysis",
    description="Returns sentiment analysis from news and social media"
)
async def get_sentiment_analysis(symbol: str) -> SentimentResponse:
    """
    Get sentiment analysis for a stock symbol.

    NOTE: This is a basic implementation with simulated data.
    Full sentiment analysis from real news/social sources with
    spacy/transformers will be implemented in Issue #12.

    Args:
        symbol: Stock ticker symbol

    Returns:
        Sentiment analysis with scores from multiple sources
    """
    try:
        sentiment_data = _generate_mock_sentiment(symbol)
        return sentiment_data

    except Exception as e:
        logger.error(f"Error generating sentiment for {symbol}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch sentiment data: {str(e)}"
        )


def _generate_mock_sentiment(symbol: str) -> SentimentResponse:
    """Generate mock sentiment data using symbol as seed for consistency."""
    random.seed(hash(symbol) % 10000)

    # Generate sentiment scores
    news_score = random.uniform(-0.3, 0.7)
    twitter_score = random.uniform(-0.5, 0.8)
    reddit_score = random.uniform(-0.4, 0.6)

    overall_sentiment = (
        news_score * 0.5 +
        twitter_score * 0.3 +
        reddit_score * 0.2
    )

    if overall_sentiment > 0.2:
        sentiment_label = "Bullish"
    elif overall_sentiment < -0.2:
        sentiment_label = "Bearish"
    else:
        sentiment_label = "Neutral"

    sources = [
        SentimentSource(
            source="news",
            score=round(news_score, 2),
            volume=random.randint(50, 200),
            trending=news_score > 0.5
        ),
        SentimentSource(
            source="twitter",
            score=round(twitter_score, 2),
            volume=random.randint(500, 2000),
            trending=twitter_score > 0.6
        ),
        SentimentSource(
            source="reddit",
            score=round(reddit_score, 2),
            volume=random.randint(100, 500),
            trending=reddit_score > 0.5
        )
    ]

    news_headlines = [
        f"{symbol} Reports Strong Quarterly Earnings",
        f"Analysts Upgrade {symbol} Stock Rating",
        f"{symbol} Announces New Product Launch",
        f"Market Volatility Affects {symbol} Trading",
        f"{symbol} CEO Discusses Future Growth Plans"
    ]

    recent_news = []
    for i, headline in enumerate(news_headlines[:3]):
        recent_news.append(NewsItem(
            title=headline,
            source=random.choice(["Bloomberg", "Reuters", "CNBC", "WSJ"]),
            url=f"https://example.com/news/{symbol.lower()}/{i}",
            sentiment_score=round(random.uniform(-0.5, 0.8), 2),
            published_at=datetime.now() - timedelta(hours=random.randint(1, 48))
        ))

    total_mentions = sum(s.volume for s in sources)

    return SentimentResponse(
        symbol=symbol.upper(),
        overall_sentiment=round(overall_sentiment, 2),
        sentiment_label=sentiment_label,
        confidence=round(random.uniform(0.6, 0.9), 2),
        sources=sources,
        recent_news=recent_news,
        total_mentions=total_mentions,
        trending_score=round(min(1.0, total_mentions / 2000), 2),
        last_updated=datetime.now()
    )
