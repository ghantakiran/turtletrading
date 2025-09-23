"""
Sentiment Ingestion & NER Models and Schemas

This module defines comprehensive models for sentiment analysis and named entity recognition including:
- News and social media ingestion with deduplication
- NER entity detection and ticker mapping
- Sentiment scoring with confidence intervals
- Rate limiting and backfill management
- Real-time sentiment aggregation
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Any, Union, Literal
from enum import Enum
from pydantic import BaseModel, Field, validator, model_validator
import uuid


class ContentType(str, Enum):
    """Types of content being ingested"""
    NEWS_ARTICLE = "news_article"
    SOCIAL_POST = "social_post"
    EARNINGS_CALL = "earnings_call"
    RESEARCH_REPORT = "research_report"
    REGULATORY_FILING = "regulatory_filing"
    PRESS_RELEASE = "press_release"


class ProviderType(str, Enum):
    """Content provider types"""
    NEWS_API = "news_api"
    TWITTER = "twitter"
    REDDIT = "reddit"
    YAHOO_FINANCE = "yahoo_finance"
    ALPHA_VANTAGE = "alpha_vantage"
    FINNHUB = "finnhub"
    BENZINGA = "benzinga"
    SEEKING_ALPHA = "seeking_alpha"


class EntityType(str, Enum):
    """Named entity types for financial content"""
    TICKER = "ticker"               # Stock symbols (AAPL, MSFT)
    COMPANY = "company"             # Company names (Apple Inc.)
    PERSON = "person"               # CEO, analysts, etc.
    FINANCIAL_METRIC = "financial_metric"  # Revenue, EPS, etc.
    CURRENCY = "currency"           # USD, EUR, etc.
    DATE = "date"                   # Earnings dates, events
    LOCATION = "location"           # Geographic references
    PRODUCT = "product"             # iPhone, Azure, etc.
    SECTOR = "sector"               # Technology, Healthcare
    EVENT = "event"                 # Earnings, IPO, merger


class SentimentPolarity(str, Enum):
    """Sentiment polarity classification"""
    VERY_POSITIVE = "very_positive"    # 0.7 to 1.0
    POSITIVE = "positive"              # 0.3 to 0.7
    NEUTRAL = "neutral"                # -0.3 to 0.3
    NEGATIVE = "negative"              # -0.7 to -0.3
    VERY_NEGATIVE = "very_negative"    # -1.0 to -0.7


class IngestionStatus(str, Enum):
    """Status of content ingestion"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DUPLICATE = "duplicate"
    RATE_LIMITED = "rate_limited"


class ContentSource(BaseModel):
    """Source of the content"""
    provider: ProviderType = Field(..., description="Content provider")
    provider_id: str = Field(..., description="Provider-specific content ID")
    url: Optional[str] = Field(None, description="Original content URL")
    api_endpoint: Optional[str] = Field(None, description="API endpoint used")

    # Rate limiting information
    rate_limit_remaining: Optional[int] = Field(None, description="Remaining API calls")
    rate_limit_reset: Optional[datetime] = Field(None, description="Rate limit reset time")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class RawContent(BaseModel):
    """Raw ingested content before processing"""
    content_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique content identifier")
    content_type: ContentType = Field(..., description="Type of content")
    source: ContentSource = Field(..., description="Content source information")

    # Content data
    title: Optional[str] = Field(None, description="Content title")
    body: Optional[str] = Field(None, description="Main content body")
    summary: Optional[str] = Field(None, description="Content summary")
    author: Optional[str] = Field(None, description="Content author")

    # Metadata
    published_at: datetime = Field(..., description="When content was published")
    language: str = Field(default="en", description="Content language")
    tags: List[str] = Field(default_factory=list, description="Content tags")

    # Deduplication
    content_hash: str = Field(..., description="Hash for deduplication")
    similarity_hash: Optional[str] = Field(None, description="Semantic similarity hash")

    # Processing status
    ingestion_status: IngestionStatus = Field(default=IngestionStatus.PENDING)
    processing_attempts: int = Field(default=0, description="Number of processing attempts")
    error_message: Optional[str] = Field(None, description="Error message if processing failed")

    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = Field(None, description="When content was processed")

    @validator('content_hash')
    def validate_content_hash(cls, v):
        if len(v) < 32:
            raise ValueError("Content hash must be at least 32 characters")
        return v


class NamedEntity(BaseModel):
    """Named entity extracted from content"""
    entity_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique entity identifier")
    entity_type: EntityType = Field(..., description="Type of entity")
    text: str = Field(..., description="Original text that was recognized")
    normalized_text: str = Field(..., description="Normalized/canonical form")

    # Position in content
    start_position: int = Field(..., description="Start character position in text")
    end_position: int = Field(..., description="End character position in text")
    context: Optional[str] = Field(None, description="Surrounding context")

    # Confidence and metadata
    confidence: float = Field(..., ge=0.0, le=1.0, description="NER confidence score")
    model_name: str = Field(..., description="NER model used for extraction")
    model_version: str = Field(..., description="Version of NER model")

    # Ticker mapping (for relevant entities)
    mapped_ticker: Optional[str] = Field(None, description="Mapped stock ticker")
    ticker_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Ticker mapping confidence")

    # Additional attributes
    attributes: Dict[str, Any] = Field(default_factory=dict, description="Additional entity attributes")

    extracted_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('confidence')
    def validate_confidence(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("Confidence must be between 0.0 and 1.0")
        return v


class SentimentScore(BaseModel):
    """Sentiment analysis result"""
    sentiment_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique sentiment identifier")

    # Sentiment metrics
    polarity: SentimentPolarity = Field(..., description="Sentiment polarity classification")
    score: float = Field(..., ge=-1.0, le=1.0, description="Sentiment score (-1 to 1)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Sentiment confidence")
    magnitude: float = Field(..., ge=0.0, description="Sentiment magnitude/intensity")

    # Model information
    model_name: str = Field(..., description="Sentiment model used")
    model_version: str = Field(..., description="Version of sentiment model")

    # Detailed scores
    positive_score: float = Field(..., ge=0.0, le=1.0, description="Positive sentiment probability")
    negative_score: float = Field(..., ge=0.0, le=1.0, description="Negative sentiment probability")
    neutral_score: float = Field(..., ge=0.0, le=1.0, description="Neutral sentiment probability")

    # Context
    analyzed_text: str = Field(..., description="Text that was analyzed")
    text_length: int = Field(..., description="Length of analyzed text")

    computed_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('score')
    def validate_score(cls, v):
        if not -1.0 <= v <= 1.0:
            raise ValueError("Sentiment score must be between -1.0 and 1.0")
        return v

    @model_validator(mode='after')
    def validate_sentiment_scores(self):
        positive = self.positive_score
        negative = self.negative_score
        neutral = self.neutral_score

        total = positive + negative + neutral
        if not 0.95 <= total <= 1.05:  # Allow small floating point errors
            raise ValueError("Sentiment scores must sum to approximately 1.0")

        return self


class ProcessedContent(BaseModel):
    """Fully processed content with NER and sentiment"""
    processed_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique processed content ID")
    content_id: str = Field(..., description="Reference to raw content")

    # Extracted information
    entities: List[NamedEntity] = Field(default_factory=list, description="Extracted named entities")
    sentiment: SentimentScore = Field(..., description="Overall sentiment analysis")

    # Ticker-specific sentiments
    ticker_sentiments: Dict[str, SentimentScore] = Field(
        default_factory=dict,
        description="Sentiment scores per ticker"
    )

    # Key metrics
    primary_tickers: List[str] = Field(default_factory=list, description="Main tickers mentioned")
    entity_count: int = Field(default=0, description="Total number of entities extracted")
    processing_time: float = Field(..., description="Processing time in seconds")

    # Quality metrics
    overall_confidence: float = Field(..., ge=0.0, le=1.0, description="Overall processing confidence")
    entity_coverage: float = Field(..., ge=0.0, le=1.0, description="Percentage of text with entities")

    processed_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(None, description="When processed data expires")


class SentimentAggregation(BaseModel):
    """Aggregated sentiment for a specific ticker or entity"""
    aggregation_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique aggregation ID")
    ticker: Optional[str] = Field(None, description="Stock ticker (if applicable)")
    entity_text: Optional[str] = Field(None, description="Entity text (if not ticker)")
    entity_type: Optional[EntityType] = Field(None, description="Type of entity")

    # Time window
    start_time: datetime = Field(..., description="Start of aggregation window")
    end_time: datetime = Field(..., description="End of aggregation window")
    window_size: timedelta = Field(..., description="Size of aggregation window")

    # Aggregated metrics
    average_sentiment: float = Field(..., ge=-1.0, le=1.0, description="Average sentiment score")
    weighted_sentiment: float = Field(..., ge=-1.0, le=1.0, description="Weighted average sentiment")
    sentiment_trend: float = Field(..., description="Sentiment trend over window")

    # Statistics
    total_mentions: int = Field(..., description="Total number of mentions")
    unique_sources: int = Field(..., description="Number of unique sources")
    confidence_average: float = Field(..., ge=0.0, le=1.0, description="Average confidence")

    # Distribution
    polarity_distribution: Dict[SentimentPolarity, int] = Field(
        default_factory=dict,
        description="Count by sentiment polarity"
    )

    # Quality metrics
    data_quality_score: float = Field(..., ge=0.0, le=1.0, description="Overall data quality")
    coverage_score: float = Field(..., ge=0.0, le=1.0, description="Coverage across sources")

    computed_at: datetime = Field(default_factory=datetime.utcnow)
    next_update: datetime = Field(..., description="When next update is scheduled")


class IngestionJob(BaseModel):
    """Background ingestion job tracking"""
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique job identifier")
    job_type: str = Field(..., description="Type of ingestion job")
    provider: ProviderType = Field(..., description="Content provider")

    # Job parameters
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Job parameters")
    start_time: datetime = Field(..., description="Job start time")
    end_time: Optional[datetime] = Field(None, description="Job end time")

    # Progress tracking
    status: IngestionStatus = Field(default=IngestionStatus.PENDING)
    items_processed: int = Field(default=0, description="Number of items processed")
    items_total: Optional[int] = Field(None, description="Total items to process")
    items_failed: int = Field(default=0, description="Number of failed items")

    # Rate limiting
    rate_limit_hits: int = Field(default=0, description="Number of rate limit hits")
    backoff_until: Optional[datetime] = Field(None, description="Backoff until this time")

    # Results
    results: Dict[str, Any] = Field(default_factory=dict, description="Job results")
    error_summary: Optional[str] = Field(None, description="Error summary if job failed")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NERModel(BaseModel):
    """NER model configuration and metadata"""
    model_id: str = Field(..., description="Unique model identifier")
    name: str = Field(..., description="Model name")
    version: str = Field(..., description="Model version")

    # Model details
    model_type: str = Field(..., description="Type of model (spacy, transformers, etc.)")
    model_path: Optional[str] = Field(None, description="Path to model files")
    config: Dict[str, Any] = Field(default_factory=dict, description="Model configuration")

    # Supported entities
    supported_entities: List[EntityType] = Field(..., description="Entity types this model can detect")

    # Performance metrics
    accuracy: Optional[float] = Field(None, ge=0.0, le=1.0, description="Model accuracy")
    precision: Optional[float] = Field(None, ge=0.0, le=1.0, description="Model precision")
    recall: Optional[float] = Field(None, ge=0.0, le=1.0, description="Model recall")
    f1_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Model F1 score")

    # Usage statistics
    total_predictions: int = Field(default=0, description="Total predictions made")
    average_confidence: float = Field(default=0.0, description="Average confidence score")

    is_active: bool = Field(default=True, description="Whether model is currently active")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TickerMapping(BaseModel):
    """Mapping between entity text and stock tickers"""
    mapping_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique mapping ID")
    entity_text: str = Field(..., description="Original entity text")
    normalized_text: str = Field(..., description="Normalized entity text")
    ticker: str = Field(..., description="Mapped stock ticker")

    # Mapping metadata
    mapping_type: str = Field(..., description="Type of mapping (exact, fuzzy, learned)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Mapping confidence")
    source: str = Field(..., description="Source of mapping (manual, automated, etc.)")

    # Validation
    is_validated: bool = Field(default=False, description="Whether mapping is validated")
    validation_count: int = Field(default=0, description="Number of times validated")
    last_seen: datetime = Field(default_factory=datetime.utcnow, description="Last time entity was seen")

    # Additional information
    company_name: Optional[str] = Field(None, description="Full company name")
    sector: Optional[str] = Field(None, description="Company sector")
    market_cap: Optional[float] = Field(None, description="Market capitalization")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Request/Response models for API endpoints

class IngestionRequest(BaseModel):
    """Request for content ingestion"""
    provider: ProviderType = Field(..., description="Content provider")
    query: Optional[str] = Field(None, description="Search query")
    tickers: Optional[List[str]] = Field(None, description="Specific tickers to search for")
    start_time: Optional[datetime] = Field(None, description="Start time for content")
    end_time: Optional[datetime] = Field(None, description="End time for content")
    max_items: Optional[int] = Field(100, description="Maximum items to ingest")

    # Processing options
    process_immediately: bool = Field(True, description="Process content immediately")
    priority: int = Field(0, description="Job priority (higher = more priority)")


class IngestionResponse(BaseModel):
    """Response for ingestion request"""
    job_id: str = Field(..., description="Created job ID")
    estimated_items: Optional[int] = Field(None, description="Estimated items to process")
    estimated_duration: Optional[int] = Field(None, description="Estimated duration in seconds")
    status: IngestionStatus = Field(..., description="Initial job status")


class SentimentQueryRequest(BaseModel):
    """Request for sentiment data query"""
    tickers: Optional[List[str]] = Field(None, description="Tickers to query")
    entity_types: Optional[List[EntityType]] = Field(None, description="Entity types to include")
    start_time: Optional[datetime] = Field(None, description="Start time")
    end_time: Optional[datetime] = Field(None, description="End time")

    # Aggregation options
    aggregation_window: Optional[str] = Field("1h", description="Aggregation window (1m, 5m, 1h, 1d)")
    include_raw: bool = Field(False, description="Include raw content data")
    min_confidence: float = Field(0.0, description="Minimum confidence threshold")

    # Pagination
    limit: int = Field(100, description="Maximum results to return")
    offset: int = Field(0, description="Results offset")


class SentimentQueryResponse(BaseModel):
    """Response for sentiment query"""
    total_results: int = Field(..., description="Total number of results")
    aggregations: List[SentimentAggregation] = Field(..., description="Sentiment aggregations")
    raw_content: Optional[List[ProcessedContent]] = Field(None, description="Raw content if requested")

    # Metadata
    query_time: float = Field(..., description="Query execution time in seconds")
    cache_hit: bool = Field(..., description="Whether result was cached")
    next_update: Optional[datetime] = Field(None, description="When data will be updated")


class NERTestRequest(BaseModel):
    """Request for testing NER on text"""
    text: str = Field(..., description="Text to analyze")
    model_id: Optional[str] = Field(None, description="Specific model to use")
    include_ticker_mapping: bool = Field(True, description="Include ticker mapping")
    confidence_threshold: float = Field(0.5, description="Minimum confidence threshold")


class NERTestResponse(BaseModel):
    """Response for NER testing"""
    entities: List[NamedEntity] = Field(..., description="Extracted entities")
    processing_time: float = Field(..., description="Processing time in seconds")
    model_used: str = Field(..., description="Model used for extraction")
    total_entities: int = Field(..., description="Total entities found")
    ticker_entities: int = Field(..., description="Ticker entities found")


# Configuration and settings models

class ProviderConfig(BaseModel):
    """Configuration for content providers"""
    provider: ProviderType = Field(..., description="Provider type")
    api_key: Optional[str] = Field(None, description="API key")
    api_secret: Optional[str] = Field(None, description="API secret")
    base_url: str = Field(..., description="Base API URL")

    # Rate limiting
    requests_per_minute: int = Field(60, description="Requests per minute limit")
    requests_per_hour: int = Field(1000, description="Requests per hour limit")
    burst_limit: int = Field(10, description="Burst request limit")

    # Retry configuration
    max_retries: int = Field(3, description="Maximum retry attempts")
    retry_delay: float = Field(1.0, description="Base retry delay in seconds")
    backoff_multiplier: float = Field(2.0, description="Backoff multiplier")

    # Content filtering
    languages: List[str] = Field(default=["en"], description="Supported languages")
    content_types: List[ContentType] = Field(..., description="Supported content types")

    is_enabled: bool = Field(default=True, description="Whether provider is enabled")


class NLPPipelineConfig(BaseModel):
    """Configuration for NLP processing pipeline"""
    # NER configuration
    ner_model_id: str = Field(..., description="Primary NER model to use")
    fallback_model_ids: List[str] = Field(default_factory=list, description="Fallback NER models")
    ner_confidence_threshold: float = Field(0.5, description="Minimum NER confidence")

    # Sentiment configuration
    sentiment_model: str = Field("vader", description="Sentiment analysis model")
    sentiment_confidence_threshold: float = Field(0.3, description="Minimum sentiment confidence")

    # Processing options
    max_text_length: int = Field(10000, description="Maximum text length to process")
    batch_size: int = Field(10, description="Batch size for processing")
    enable_caching: bool = Field(True, description="Enable result caching")
    cache_ttl: int = Field(3600, description="Cache TTL in seconds")

    # Quality thresholds
    min_entity_coverage: float = Field(0.1, description="Minimum entity coverage ratio")
    max_processing_time: float = Field(30.0, description="Maximum processing time per item")


if __name__ == "__main__":
    # Example usage and validation
    print("Sentiment Ingestion & NER Models loaded successfully")

    # Test model creation
    test_content = RawContent(
        content_type=ContentType.NEWS_ARTICLE,
        source=ContentSource(
            provider=ProviderType.NEWS_API,
            provider_id="test123"
        ),
        title="Apple Reports Strong Q4 Earnings",
        body="Apple Inc. reported strong quarterly earnings with revenue growth...",
        published_at=datetime.utcnow(),
        content_hash="a" * 64
    )

    print(f"Created test content: {test_content.content_id}")

    # Test entity creation
    test_entity = NamedEntity(
        entity_type=EntityType.TICKER,
        text="AAPL",
        normalized_text="AAPL",
        start_position=0,
        end_position=4,
        confidence=0.95,
        model_name="spacy_financial",
        model_version="1.0.0",
        mapped_ticker="AAPL",
        ticker_confidence=0.98
    )

    print(f"Created test entity: {test_entity.entity_id}")

    # Test sentiment creation
    test_sentiment = SentimentScore(
        polarity=SentimentPolarity.POSITIVE,
        score=0.65,
        confidence=0.85,
        magnitude=0.8,
        model_name="vader",
        model_version="3.3.2",
        positive_score=0.7,
        negative_score=0.1,
        neutral_score=0.2,
        analyzed_text="Strong quarterly earnings",
        text_length=25
    )

    print(f"Created test sentiment: {test_sentiment.sentiment_id}")