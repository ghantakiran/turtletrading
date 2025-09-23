"""
Sentiment Ingestion and NER Models

This module defines Pydantic models for the sentiment ingestion and named entity recognition (NER) system.
It includes models for news sources, social media ingestion, entity extraction, sentiment scoring,
and aggregation with confidence intervals.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Union, Any
from decimal import Decimal

from pydantic import BaseModel, Field, validator, root_validator
from pydantic.types import EmailStr


class SentimentSource(str, Enum):
    """Enumeration of supported sentiment data sources"""
    NEWS_API = "news_api"
    TWITTER = "twitter"
    REDDIT = "reddit"
    BLOOMBERG = "bloomberg"
    REUTERS = "reuters"
    YAHOO_FINANCE = "yahoo_finance"
    FINANCIAL_TIMES = "financial_times"
    CNBC = "cnbc"
    MARKETWATCH = "marketwatch"
    SEEKING_ALPHA = "seeking_alpha"


class EntityType(str, Enum):
    """Types of entities that can be extracted"""
    COMPANY = "company"
    TICKER = "ticker"
    PERSON = "person"
    ORGANIZATION = "organization"
    LOCATION = "location"
    EVENT = "event"
    PRODUCT = "product"
    CURRENCY = "currency"
    COMMODITY = "commodity"


class SentimentPolarity(str, Enum):
    """Sentiment polarity classifications"""
    VERY_NEGATIVE = "very_negative"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    POSITIVE = "positive"
    VERY_POSITIVE = "very_positive"


class IngestionStatus(str, Enum):
    """Status of data ingestion process"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RATE_LIMITED = "rate_limited"
    DUPLICATE = "duplicate"


class ContentType(str, Enum):
    """Type of content being processed"""
    ARTICLE = "article"
    TWEET = "tweet"
    REDDIT_POST = "reddit_post"
    REDDIT_COMMENT = "reddit_comment"
    BLOG_POST = "blog_post"
    PRESS_RELEASE = "press_release"
    ANALYST_REPORT = "analyst_report"


# Core Data Models

class RawContentItem(BaseModel):
    """Raw content item from external data sources"""
    content_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: SentimentSource
    content_type: ContentType
    title: Optional[str] = None
    content: str = Field(..., min_length=1, max_length=50000)
    author: Optional[str] = None
    published_at: datetime
    source_url: Optional[str] = None
    source_id: str  # External ID from the source
    language: str = Field(default="en")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    status: IngestionStatus = Field(default=IngestionStatus.PENDING)

    @validator('content')
    def validate_content_length(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Content must be at least 10 characters long")
        return v.strip()

    @validator('source_url')
    def validate_url(cls, v):
        if v and not (v.startswith('http://') or v.startswith('https://')):
            raise ValueError("Source URL must be a valid HTTP/HTTPS URL")
        return v


class EntityExtraction(BaseModel):
    """Named entity extracted from content"""
    entity_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content_id: str
    entity_text: str = Field(..., min_length=1, max_length=200)
    entity_type: EntityType
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    start_position: int = Field(..., ge=0)
    end_position: int = Field(..., ge=0)
    normalized_form: Optional[str] = None  # Standardized entity representation
    metadata: Dict[str, Any] = Field(default_factory=dict)
    extracted_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('end_position')
    def validate_positions(cls, v, values):
        if 'start_position' in values and v <= values['start_position']:
            raise ValueError("End position must be greater than start position")
        return v


class TickerMapping(BaseModel):
    """Mapping between entities and stock tickers"""
    mapping_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_text: str
    entity_type: EntityType
    ticker_symbol: str = Field(..., regex=r'^[A-Z]{1,5}$')
    company_name: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    mapping_source: str = Field(default="manual")  # manual, fuzzy_match, exact_match
    verified: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SentimentScore(BaseModel):
    """Sentiment analysis result for content"""
    sentiment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content_id: str
    polarity: SentimentPolarity
    compound_score: float = Field(..., ge=-1.0, le=1.0)  # Overall sentiment score
    positive_score: float = Field(..., ge=0.0, le=1.0)
    negative_score: float = Field(..., ge=0.0, le=1.0)
    neutral_score: float = Field(..., ge=0.0, le=1.0)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    model_version: str = Field(default="1.0")
    processing_metadata: Dict[str, Any] = Field(default_factory=dict)
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

    @root_validator
    def validate_score_sum(cls, values):
        """Ensure positive, negative, and neutral scores sum to approximately 1.0"""
        pos = values.get('positive_score', 0)
        neg = values.get('negative_score', 0)
        neu = values.get('neutral_score', 0)
        total = pos + neg + neu
        if not (0.99 <= total <= 1.01):
            raise ValueError("Positive, negative, and neutral scores must sum to 1.0")
        return values


class EntitySentiment(BaseModel):
    """Sentiment associated with a specific entity mention"""
    entity_sentiment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content_id: str
    entity_id: str
    ticker_symbol: Optional[str] = None
    sentiment_score: float = Field(..., ge=-1.0, le=1.0)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    context_window: str = Field(..., max_length=500)  # Text around the entity
    relevance_score: float = Field(..., ge=0.0, le=1.0)  # How relevant is this mention
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Aggregation Models

class SentimentAggregation(BaseModel):
    """Aggregated sentiment data for a ticker over a time period"""
    aggregation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticker_symbol: str = Field(..., regex=r'^[A-Z]{1,5}$')
    time_period: str  # e.g., "1h", "1d", "1w"
    start_time: datetime
    end_time: datetime

    # Aggregated scores
    average_sentiment: float = Field(..., ge=-1.0, le=1.0)
    weighted_sentiment: float = Field(..., ge=-1.0, le=1.0)
    sentiment_volatility: float = Field(..., ge=0.0)
    mention_count: int = Field(..., ge=0)
    unique_sources: int = Field(..., ge=0)

    # Distribution
    very_positive_count: int = Field(default=0, ge=0)
    positive_count: int = Field(default=0, ge=0)
    neutral_count: int = Field(default=0, ge=0)
    negative_count: int = Field(default=0, ge=0)
    very_negative_count: int = Field(default=0, ge=0)

    # Confidence metrics
    overall_confidence: float = Field(..., ge=0.0, le=1.0)
    data_quality_score: float = Field(..., ge=0.0, le=1.0)

    # Metadata
    top_keywords: List[str] = Field(default_factory=list, max_items=20)
    source_breakdown: Dict[SentimentSource, int] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('mention_count')
    def validate_mention_count(cls, v, values):
        """Ensure mention count matches distribution"""
        counts = [
            values.get('very_positive_count', 0),
            values.get('positive_count', 0),
            values.get('neutral_count', 0),
            values.get('negative_count', 0),
            values.get('very_negative_count', 0)
        ]
        if sum(counts) != v:
            raise ValueError("Mention count must equal sum of polarity counts")
        return v


# Data Source Configuration Models

class DataSourceConfig(BaseModel):
    """Configuration for external data sources"""
    source: SentimentSource
    enabled: bool = Field(default=True)
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    base_url: Optional[str] = None
    rate_limit_requests: int = Field(default=100, ge=1)
    rate_limit_period: int = Field(default=3600, ge=1)  # seconds
    backfill_enabled: bool = Field(default=False)
    backfill_days: int = Field(default=7, ge=1, le=365)
    quality_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    language_filter: List[str] = Field(default_factory=lambda: ["en"])
    keywords: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IngestionJob(BaseModel):
    """Represents a data ingestion job"""
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: SentimentSource
    job_type: str  # "realtime", "backfill", "scheduled"
    status: IngestionStatus
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    items_processed: int = Field(default=0, ge=0)
    items_succeeded: int = Field(default=0, ge=0)
    items_failed: int = Field(default=0, ge=0)
    items_duplicated: int = Field(default=0, ge=0)
    error_details: Optional[str] = None
    configuration: Dict[str, Any] = Field(default_factory=dict)


# Request/Response Models

class IngestionRequest(BaseModel):
    """Request to start data ingestion"""
    sources: List[SentimentSource]
    tickers: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    job_type: str = Field(default="realtime")
    priority: int = Field(default=5, ge=1, le=10)


class SentimentAnalysisRequest(BaseModel):
    """Request for sentiment analysis"""
    content_items: List[str] = Field(..., min_items=1, max_items=100)
    include_entities: bool = Field(default=True)
    include_ticker_mapping: bool = Field(default=True)
    model_version: Optional[str] = None


class SentimentQueryRequest(BaseModel):
    """Request for querying sentiment data"""
    tickers: Optional[List[str]] = None
    sources: Optional[List[SentimentSource]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    aggregation_period: str = Field(default="1h")  # 1m, 5m, 15m, 1h, 1d
    min_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


class SentimentResponse(BaseModel):
    """Response containing sentiment analysis results"""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sentiment_scores: List[SentimentScore]
    entity_extractions: List[EntityExtraction]
    ticker_mappings: List[TickerMapping]
    processing_time_ms: float
    model_version: str
    confidence_stats: Dict[str, float] = Field(default_factory=dict)


class SentimentFeedResponse(BaseModel):
    """Real-time sentiment feed response"""
    feed_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticker_symbol: str
    current_sentiment: SentimentAggregation
    recent_items: List[Dict[str, Any]] = Field(default_factory=list, max_items=50)
    sentiment_trend: List[float] = Field(default_factory=list)  # Last 24 hours
    news_count_24h: int = Field(default=0, ge=0)
    social_count_24h: int = Field(default=0, ge=0)
    last_updated: datetime = Field(default_factory=datetime.utcnow)


# Webhook and Alert Models

class SentimentAlert(BaseModel):
    """Sentiment-based alert configuration"""
    alert_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    ticker_symbol: str
    alert_type: str  # "threshold", "sudden_change", "volume_spike"
    threshold_value: float = Field(..., ge=-1.0, le=1.0)
    time_window: int = Field(default=3600, ge=300)  # seconds
    enabled: bool = Field(default=True)
    webhook_url: Optional[str] = None
    email_notification: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WebhookPayload(BaseModel):
    """Payload for sentiment webhook notifications"""
    event_type: str
    ticker_symbol: str
    current_sentiment: float
    previous_sentiment: float
    change_magnitude: float
    confidence_score: float
    mention_count: int
    time_period: str
    triggered_at: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = Field(default_factory=dict)


# Cache and Performance Models

class SentimentCacheKey(BaseModel):
    """Cache key structure for sentiment data"""
    cache_type: str  # "aggregation", "entity", "content"
    ticker_symbol: Optional[str] = None
    time_period: Optional[str] = None
    parameters_hash: str
    version: str = Field(default="1.0")

    def generate_key(self) -> str:
        """Generate Redis cache key"""
        parts = [
            "sentiment",
            self.cache_type,
            self.ticker_symbol or "all",
            self.time_period or "any",
            self.parameters_hash,
            self.version
        ]
        return ":".join(parts)


class PerformanceMetrics(BaseModel):
    """Performance metrics for sentiment processing"""
    processing_start: datetime
    processing_end: datetime
    total_items: int
    successful_items: int
    failed_items: int
    average_processing_time_ms: float
    peak_memory_usage_mb: float
    api_calls_made: int
    cache_hits: int
    cache_misses: int
    error_details: List[str] = Field(default_factory=list)