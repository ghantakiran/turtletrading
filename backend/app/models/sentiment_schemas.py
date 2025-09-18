"""
Pydantic schemas for sentiment analysis API models
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum


class SentimentPolarity(str, Enum):
    """Sentiment polarity levels"""
    VERY_POSITIVE = "very_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    VERY_NEGATIVE = "very_negative"


class NewsSource(BaseModel):
    """News source information"""
    name: str = Field(..., description="Source name")
    url: Optional[HttpUrl] = Field(None, description="Source URL")
    reliability_score: float = Field(..., ge=0, le=1, description="Source reliability score")


class NewsArticle(BaseModel):
    """News article with sentiment analysis"""
    title: str = Field(..., description="Article title")
    summary: Optional[str] = Field(None, description="Article summary")
    content: Optional[str] = Field(None, description="Full article content")
    url: HttpUrl = Field(..., description="Article URL")
    source: NewsSource = Field(..., description="News source")
    published_at: datetime = Field(..., description="Publication timestamp")
    
    # Sentiment analysis
    sentiment_score: float = Field(..., ge=-1, le=1, description="Sentiment score (-1 to 1)")
    sentiment_polarity: SentimentPolarity = Field(..., description="Sentiment polarity")
    confidence: float = Field(..., ge=0, le=1, description="Sentiment confidence")
    
    # Relevance
    relevance_score: float = Field(..., ge=0, le=1, description="Relevance to symbol/topic")
    mentions: List[str] = Field(default_factory=list, description="Mentioned entities")


class SentimentTrend(BaseModel):
    """Sentiment trend data over time"""
    date: datetime = Field(..., description="Date point")
    sentiment_score: float = Field(..., ge=-1, le=1, description="Sentiment score")
    article_count: int = Field(..., description="Number of articles")
    volume_weighted_sentiment: float = Field(..., description="Volume-weighted sentiment")


class SentimentAnalysis(BaseModel):
    """Comprehensive sentiment analysis for a symbol"""
    symbol: str = Field(..., description="Stock symbol")
    timeframe: str = Field(..., description="Analysis timeframe")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Overall sentiment
    overall_sentiment: float = Field(..., ge=-1, le=1, description="Overall sentiment score")
    sentiment_polarity: SentimentPolarity = Field(..., description="Overall sentiment polarity")
    confidence: float = Field(..., ge=0, le=1, description="Analysis confidence")
    
    # Trending data
    sentiment_trend: List[SentimentTrend] = Field(..., description="Sentiment over time")
    
    # Article analysis
    total_articles: int = Field(..., description="Total articles analyzed")
    positive_articles: int = Field(..., description="Number of positive articles")
    negative_articles: int = Field(..., description="Number of negative articles")
    neutral_articles: int = Field(..., description="Number of neutral articles")
    
    # Key metrics
    sentiment_momentum: float = Field(..., description="Sentiment momentum (change rate)")
    volatility: float = Field(..., description="Sentiment volatility")
    
    # Recent articles
    recent_articles: List[NewsArticle] = Field(..., description="Recent relevant articles")
    
    # Key themes
    positive_themes: List[str] = Field(default_factory=list, description="Positive themes")
    negative_themes: List[str] = Field(default_factory=list, description="Negative themes")


class SocialMention(BaseModel):
    """Social media mention"""
    platform: str = Field(..., description="Social media platform")
    content: str = Field(..., description="Mention content")
    author: str = Field(..., description="Author username")
    timestamp: datetime = Field(..., description="Mention timestamp")
    engagement: Dict[str, int] = Field(..., description="Engagement metrics (likes, shares, etc.)")
    sentiment_score: float = Field(..., ge=-1, le=1, description="Sentiment score")
    influence_score: float = Field(..., ge=0, le=1, description="Author influence score")


class SocialSentiment(BaseModel):
    """Social media sentiment analysis"""
    symbol: str = Field(..., description="Stock symbol")
    platform: str = Field(..., description="Social platform or 'all'")
    timeframe: str = Field(..., description="Analysis timeframe")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Overall metrics
    overall_sentiment: float = Field(..., ge=-1, le=1, description="Overall social sentiment")
    sentiment_polarity: SentimentPolarity = Field(..., description="Sentiment polarity")
    
    # Volume metrics
    total_mentions: int = Field(..., description="Total mentions")
    mention_velocity: float = Field(..., description="Mentions per hour")
    reach: int = Field(..., description="Total reach/impressions")
    engagement_rate: float = Field(..., description="Average engagement rate")
    
    # Trending
    is_trending: bool = Field(..., description="Whether symbol is trending")
    trend_score: float = Field(..., ge=0, le=1, description="Trending intensity score")
    
    # Platform breakdown
    platform_breakdown: Dict[str, Dict[str, Any]] = Field(..., description="Per-platform metrics")
    
    # Top mentions
    top_mentions: List[SocialMention] = Field(..., description="Top influential mentions")
    
    # Sentiment over time
    sentiment_history: List[SentimentTrend] = Field(..., description="Sentiment timeline")


class MarketSentiment(BaseModel):
    """Overall market sentiment analysis"""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Overall market sentiment
    overall_sentiment: float = Field(..., ge=-1, le=1, description="Overall market sentiment")
    sentiment_polarity: SentimentPolarity = Field(..., description="Market sentiment polarity")
    
    # Component sentiments
    news_sentiment: float = Field(..., ge=-1, le=1, description="News-based sentiment")
    social_sentiment: float = Field(..., ge=-1, le=1, description="Social media sentiment")
    economic_sentiment: float = Field(..., ge=-1, le=1, description="Economic data sentiment")
    
    # Fear & Greed components
    fear_greed_index: float = Field(..., ge=0, le=100, description="Fear & Greed Index")
    fear_greed_components: Dict[str, float] = Field(..., description="F&G Index components")
    
    # Market indicators
    vix_sentiment: float = Field(..., description="VIX-based sentiment")
    put_call_ratio: float = Field(..., description="Put/Call ratio")
    high_low_sentiment: float = Field(..., description="52-week high/low sentiment")
    
    # Sector sentiment
    sector_sentiments: Dict[str, float] = Field(..., description="Sentiment by sector")
    
    # Trending topics
    trending_topics: List[str] = Field(..., description="Trending market topics")
    bullish_keywords: List[str] = Field(..., description="Trending bullish keywords")
    bearish_keywords: List[str] = Field(..., description="Trending bearish keywords")


class TrendingKeyword(BaseModel):
    """Trending keyword data"""
    keyword: str = Field(..., description="Trending keyword")
    mentions: int = Field(..., description="Number of mentions")
    sentiment: float = Field(..., ge=-1, le=1, description="Keyword sentiment")
    growth_rate: float = Field(..., description="Mention growth rate")
    related_symbols: List[str] = Field(..., description="Related stock symbols")


class SentimentSummary(BaseModel):
    """High-level sentiment summary"""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Overall market
    market_sentiment_score: float = Field(..., ge=-1, le=1, description="Market sentiment")
    market_sentiment_label: str = Field(..., description="Market sentiment label")
    
    # Top sentiment movers
    most_bullish_stocks: List[Dict[str, Any]] = Field(..., description="Most bullish stocks")
    most_bearish_stocks: List[Dict[str, Any]] = Field(..., description="Most bearish stocks")
    
    # Sentiment extremes
    sentiment_extremes: Dict[str, List[str]] = Field(..., description="Stocks at sentiment extremes")
    
    # Key insights
    key_insights: List[str] = Field(..., description="Key market sentiment insights")
    risk_factors: List[str] = Field(..., description="Current sentiment-based risks")
    opportunities: List[str] = Field(..., description="Sentiment-based opportunities")


class BatchSentimentRequest(BaseModel):
    """Request for batch sentiment analysis"""
    symbols: List[str] = Field(..., min_items=1, max_items=20, description="Symbols to analyze")
    timeframe: str = Field("7d", description="Analysis timeframe")
    include_news: bool = Field(True, description="Include news sentiment")
    include_social: bool = Field(False, description="Include social sentiment")


class BatchSentimentResponse(BaseModel):
    """Response for batch sentiment analysis"""
    results: List[SentimentAnalysis] = Field(..., description="Sentiment analyses")
    summary: SentimentSummary = Field(..., description="Batch analysis summary")
    errors: List[Dict[str, str]] = Field(..., description="Errors encountered")
    timestamp: datetime = Field(default_factory=datetime.utcnow)