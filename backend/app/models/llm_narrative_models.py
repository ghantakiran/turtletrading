"""
LLM Narrative Models for TurtleTrading AI Insights System

Comprehensive data models for AI-generated market narratives, trading insights,
and personalized recommendations using large language models.
"""

from enum import Enum
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, validator


class NarrativeType(str, Enum):
    """Types of narratives that can be generated"""
    MARKET_OVERVIEW = "market_overview"
    STOCK_ANALYSIS = "stock_analysis"
    TECHNICAL_INSIGHT = "technical_insight"
    TRADING_OPPORTUNITY = "trading_opportunity"
    RISK_ASSESSMENT = "risk_assessment"
    PORTFOLIO_REVIEW = "portfolio_review"
    EARNINGS_PREVIEW = "earnings_preview"
    SECTOR_ANALYSIS = "sector_analysis"
    ECONOMIC_IMPACT = "economic_impact"
    SENTIMENT_SUMMARY = "sentiment_summary"
    DAILY_BRIEFING = "daily_briefing"
    WEEKLY_RECAP = "weekly_recap"


class NarrativeTone(str, Enum):
    """Tone/style of narrative generation"""
    PROFESSIONAL = "professional"
    CASUAL = "casual"
    TECHNICAL = "technical"
    EDUCATIONAL = "educational"
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    CAUTIOUS = "cautious"
    OPTIMISTIC = "optimistic"


class NarrativeLength(str, Enum):
    """Length preferences for narratives"""
    BRIEF = "brief"  # 1-2 sentences
    SHORT = "short"  # 1 paragraph
    MEDIUM = "medium"  # 2-3 paragraphs
    LONG = "long"  # 4-5 paragraphs
    DETAILED = "detailed"  # Full analysis


class LLMProvider(str, Enum):
    """LLM providers for narrative generation"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    COHERE = "cohere"
    LOCAL = "local"
    HUGGINGFACE = "huggingface"


class InsightPriority(str, Enum):
    """Priority level for insights"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFORMATIONAL = "informational"


class NarrativeContext(BaseModel):
    """Context data for narrative generation"""
    user_id: str
    portfolio_symbols: List[str] = Field(default_factory=list)
    risk_tolerance: str = "moderate"
    investment_horizon: str = "medium_term"
    preferred_sectors: List[str] = Field(default_factory=list)
    trading_style: str = "balanced"
    experience_level: str = "intermediate"
    interests: List[str] = Field(default_factory=list)
    language: str = "en"
    timezone: str = "UTC"

    # User preferences
    include_technicals: bool = True
    include_fundamentals: bool = True
    include_news: bool = True
    include_predictions: bool = True

    # Personalization
    past_performance: Optional[Dict[str, Any]] = None
    recent_trades: Optional[List[Dict[str, Any]]] = None
    watchlist: List[str] = Field(default_factory=list)


class MarketData(BaseModel):
    """Market data for narrative generation"""
    symbol: Optional[str] = None
    current_price: Optional[float] = None
    price_change: Optional[float] = None
    price_change_percent: Optional[float] = None
    volume: Optional[int] = None
    market_cap: Optional[float] = None

    # Technical indicators
    rsi: Optional[float] = None
    macd: Optional[Dict[str, float]] = None
    moving_averages: Optional[Dict[str, float]] = None
    bollinger_bands: Optional[Dict[str, float]] = None
    support_levels: List[float] = Field(default_factory=list)
    resistance_levels: List[float] = Field(default_factory=list)

    # Market indices
    sp500: Optional[Dict[str, float]] = None
    nasdaq: Optional[Dict[str, float]] = None
    dow: Optional[Dict[str, float]] = None
    vix: Optional[float] = None

    # Sector performance
    sector_performance: Optional[Dict[str, float]] = None
    peer_comparison: Optional[List[Dict[str, Any]]] = None

    # Additional data
    news_sentiment: Optional[float] = None
    social_sentiment: Optional[float] = None
    analyst_ratings: Optional[Dict[str, Any]] = None
    earnings_data: Optional[Dict[str, Any]] = None


class NarrativeRequest(BaseModel):
    """Request for narrative generation"""
    request_id: str = Field(default_factory=lambda: f"narr_{datetime.utcnow().timestamp()}")
    user_id: str
    narrative_type: NarrativeType
    symbols: List[str] = Field(default_factory=list)

    # Generation parameters
    tone: NarrativeTone = NarrativeTone.PROFESSIONAL
    length: NarrativeLength = NarrativeLength.MEDIUM
    include_charts: bool = False
    include_recommendations: bool = True

    # Context and data
    context: NarrativeContext
    market_data: Optional[MarketData] = None

    # Timing
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    priority: InsightPriority = InsightPriority.MEDIUM

    # Additional parameters
    custom_prompts: Optional[List[str]] = None
    exclude_topics: List[str] = Field(default_factory=list)
    focus_areas: List[str] = Field(default_factory=list)


class GeneratedNarrative(BaseModel):
    """Generated narrative with metadata"""
    narrative_id: str = Field(default_factory=lambda: f"gn_{datetime.utcnow().timestamp()}")
    request_id: str
    user_id: str
    narrative_type: NarrativeType

    # Content
    title: str
    summary: str
    full_narrative: str
    key_points: List[str] = Field(default_factory=list)

    # Insights
    insights: List['TradingInsight'] = Field(default_factory=list)
    recommendations: List['TradingRecommendation'] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    generation_time_ms: float
    llm_provider: LLMProvider
    model_version: str
    tokens_used: int

    # Quality metrics
    confidence_score: float = Field(ge=0.0, le=1.0)
    relevance_score: float = Field(ge=0.0, le=1.0)
    coherence_score: float = Field(ge=0.0, le=1.0)

    # References
    data_sources: List[str] = Field(default_factory=list)
    citations: List[str] = Field(default_factory=list)
    related_symbols: List[str] = Field(default_factory=list)

    # Caching
    cache_ttl: int = 3600  # seconds
    is_cached: bool = False

    @validator('confidence_score', 'relevance_score', 'coherence_score')
    def validate_scores(cls, v):
        if not 0 <= v <= 1:
            raise ValueError('Score must be between 0 and 1')
        return v


class TradingInsight(BaseModel):
    """Individual trading insight"""
    insight_id: str = Field(default_factory=lambda: f"ins_{datetime.utcnow().timestamp()}")
    type: str  # technical, fundamental, sentiment, etc.
    symbol: Optional[str] = None

    # Content
    title: str
    description: str
    significance: InsightPriority

    # Supporting data
    data_points: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0)

    # Timing
    valid_until: Optional[datetime] = None
    time_horizon: str = "short_term"  # short_term, medium_term, long_term

    # Actions
    actionable: bool = True
    suggested_actions: List[str] = Field(default_factory=list)


class TradingRecommendation(BaseModel):
    """Trading recommendation from LLM analysis"""
    recommendation_id: str = Field(default_factory=lambda: f"rec_{datetime.utcnow().timestamp()}")
    symbol: str
    action: str  # buy, sell, hold, watch

    # Rationale
    reasoning: str
    supporting_factors: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)

    # Trade parameters
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    position_size_percent: Optional[float] = None

    # Metadata
    confidence: float = Field(ge=0.0, le=1.0)
    time_horizon: str
    priority: InsightPriority

    # Conditions
    prerequisites: List[str] = Field(default_factory=list)
    invalidation_conditions: List[str] = Field(default_factory=list)


class NarrativeTemplate(BaseModel):
    """Template for narrative generation"""
    template_id: str
    name: str
    description: str
    narrative_type: NarrativeType

    # Template content
    system_prompt: str
    user_prompt_template: str
    variables: List[str] = Field(default_factory=list)

    # Configuration
    default_tone: NarrativeTone
    default_length: NarrativeLength

    # Examples
    example_inputs: Optional[List[Dict[str, Any]]] = None
    example_outputs: Optional[List[str]] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    version: str = "1.0"
    is_active: bool = True


class NarrativeCache(BaseModel):
    """Cached narrative entry"""
    cache_key: str
    narrative_id: str
    narrative_type: NarrativeType

    # Content
    content: GeneratedNarrative

    # Cache metadata
    cached_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    hit_count: int = 0
    last_accessed: datetime = Field(default_factory=datetime.utcnow)

    # Invalidation
    invalidation_triggers: List[str] = Field(default_factory=list)
    is_stale: bool = False


class NarrativeFeedback(BaseModel):
    """User feedback on generated narratives"""
    feedback_id: str = Field(default_factory=lambda: f"fb_{datetime.utcnow().timestamp()}")
    narrative_id: str
    user_id: str

    # Ratings
    overall_rating: int = Field(ge=1, le=5)
    accuracy_rating: Optional[int] = Field(None, ge=1, le=5)
    usefulness_rating: Optional[int] = Field(None, ge=1, le=5)
    clarity_rating: Optional[int] = Field(None, ge=1, le=5)

    # Feedback
    liked_aspects: List[str] = Field(default_factory=list)
    improvements_needed: List[str] = Field(default_factory=list)
    comments: Optional[str] = None

    # Actions taken
    shared: bool = False
    saved: bool = False
    acted_on_recommendations: bool = False

    # Metadata
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    session_id: Optional[str] = None


class NarrativeAnalytics(BaseModel):
    """Analytics for narrative system performance"""
    period_start: datetime
    period_end: datetime

    # Generation metrics
    total_narratives_generated: int = 0
    narratives_by_type: Dict[str, int] = Field(default_factory=dict)
    avg_generation_time_ms: float = 0.0

    # Quality metrics
    avg_confidence_score: float = 0.0
    avg_relevance_score: float = 0.0
    avg_coherence_score: float = 0.0

    # User engagement
    total_users: int = 0
    narratives_per_user: float = 0.0
    avg_user_rating: float = 0.0

    # Feedback metrics
    total_feedback_received: int = 0
    positive_feedback_rate: float = 0.0
    recommendation_action_rate: float = 0.0

    # Cache metrics
    cache_hit_rate: float = 0.0
    avg_cache_ttl: float = 0.0

    # Cost metrics
    total_tokens_used: int = 0
    total_cost_usd: float = 0.0
    cost_per_narrative: float = 0.0

    # Performance by provider
    provider_metrics: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class LLMConfiguration(BaseModel):
    """Configuration for LLM providers"""
    provider: LLMProvider
    api_key: Optional[str] = None
    api_endpoint: Optional[str] = None
    model_name: str

    # Generation parameters
    temperature: float = 0.7
    max_tokens: int = 1000
    top_p: float = 0.9
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0

    # Rate limiting
    requests_per_minute: int = 60
    tokens_per_minute: int = 90000

    # Retry configuration
    max_retries: int = 3
    retry_delay_ms: int = 1000

    # Cost tracking
    cost_per_1k_tokens: float = 0.002

    # Advanced settings
    stream_response: bool = False
    use_cache: bool = True
    timeout_seconds: int = 30


class NarrativeSchedule(BaseModel):
    """Schedule for automated narrative generation"""
    schedule_id: str = Field(default_factory=lambda: f"sched_{datetime.utcnow().timestamp()}")
    user_id: str
    narrative_type: NarrativeType

    # Schedule configuration
    frequency: str  # daily, weekly, monthly, custom
    time_of_day: Optional[str] = None  # HH:MM format
    days_of_week: List[int] = Field(default_factory=list)  # 0-6 (Mon-Sun)

    # Generation parameters
    symbols: List[str] = Field(default_factory=list)
    tone: NarrativeTone
    length: NarrativeLength

    # Delivery
    delivery_channels: List[str] = Field(default_factory=list)  # email, push, in-app

    # Status
    is_active: bool = True
    last_generated: Optional[datetime] = None
    next_scheduled: Optional[datetime] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NarrativeStreamEvent(BaseModel):
    """Event for streaming narrative generation"""
    event_id: str = Field(default_factory=lambda: f"evt_{datetime.utcnow().timestamp()}")
    narrative_id: str
    event_type: str  # started, chunk, insight, completed, error

    # Content
    content: Optional[str] = None
    partial_narrative: Optional[str] = None
    insight: Optional[TradingInsight] = None

    # Progress
    progress_percent: Optional[float] = None
    tokens_generated: Optional[int] = None

    # Metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sequence_number: int


class PersonalizationProfile(BaseModel):
    """User personalization profile for narratives"""
    user_id: str

    # Content preferences
    preferred_narrative_types: List[NarrativeType] = Field(default_factory=list)
    preferred_tone: NarrativeTone = NarrativeTone.PROFESSIONAL
    preferred_length: NarrativeLength = NarrativeLength.MEDIUM

    # Focus areas
    sectors_of_interest: List[str] = Field(default_factory=list)
    technical_indicators_priority: List[str] = Field(default_factory=list)
    fundamental_metrics_priority: List[str] = Field(default_factory=list)

    # Historical behavior
    avg_reading_time_seconds: Optional[float] = None
    most_engaged_topics: List[str] = Field(default_factory=list)
    action_taken_on_recommendations: float = 0.0  # percentage

    # Feedback summary
    avg_rating: float = 0.0
    total_narratives_consumed: int = 0
    favorite_insights: List[str] = Field(default_factory=list)

    # Learning progress
    expertise_level: str = "beginner"  # beginner, intermediate, advanced, expert
    completed_tutorials: List[str] = Field(default_factory=list)

    # Metadata
    profile_created: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class NarrativeQualityMetrics(BaseModel):
    """Quality metrics for generated narratives"""
    narrative_id: str

    # Automated metrics
    readability_score: float  # Flesch reading ease
    grammar_score: float
    factual_accuracy: float
    data_completeness: float

    # Coherence metrics
    topic_consistency: float
    logical_flow: float
    conclusion_strength: float

    # Relevance metrics
    user_context_relevance: float
    market_timing_relevance: float
    personalization_score: float

    # Engagement predictions
    predicted_engagement: float
    predicted_usefulness: float
    predicted_action_rate: float

    # Comparison metrics
    similarity_to_successful: float  # similarity to high-rated narratives
    uniqueness_score: float

    # Metadata
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)
    evaluation_model: str = "quality_v1"