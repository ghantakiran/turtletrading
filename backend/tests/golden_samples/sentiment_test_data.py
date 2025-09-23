"""
Golden Labeled Samples for Sentiment Analysis Testing

This module contains carefully curated and manually labeled samples for testing
the accuracy of sentiment analysis, NER, and ticker mapping systems.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

from app.models.sentiment_ingestion_models import (
    SentimentSource,
    ContentType,
    EntityType,
    SentimentPolarity
)


class TestDataCategory(str, Enum):
    """Categories of test data for different testing scenarios"""
    BASIC_SENTIMENT = "basic_sentiment"
    FINANCIAL_CONTEXT = "financial_context"
    ENTITY_EXTRACTION = "entity_extraction"
    TICKER_MAPPING = "ticker_mapping"
    EDGE_CASES = "edge_cases"
    MULTILINGUAL = "multilingual"
    SARCASM_IRONY = "sarcasm_irony"
    MIXED_SENTIMENT = "mixed_sentiment"


@dataclass
class ExpectedEntity:
    """Expected entity extraction result"""
    text: str
    entity_type: EntityType
    confidence_min: float
    confidence_max: float
    start_position: Optional[int] = None
    end_position: Optional[int] = None


@dataclass
class ExpectedTickerMapping:
    """Expected ticker mapping result"""
    entity_text: str
    ticker_symbol: str
    confidence_min: float
    mapping_source: str


@dataclass
class ExpectedSentiment:
    """Expected sentiment analysis result"""
    polarity: SentimentPolarity
    compound_score_min: float
    compound_score_max: float
    confidence_min: float


@dataclass
class GoldenSample:
    """A golden labeled sample for testing"""
    id: str
    category: TestDataCategory
    source: SentimentSource
    content_type: ContentType
    title: str
    content: str
    expected_sentiment: ExpectedSentiment
    expected_entities: List[ExpectedEntity]
    expected_ticker_mappings: List[ExpectedTickerMapping]
    description: str
    difficulty_level: str  # "easy", "medium", "hard", "expert"
    created_by: str
    created_at: datetime
    tags: List[str]


# Golden sample datasets
BASIC_SENTIMENT_SAMPLES = [
    GoldenSample(
        id="basic_pos_001",
        category=TestDataCategory.BASIC_SENTIMENT,
        source=SentimentSource.NEWS_API,
        content_type=ContentType.ARTICLE,
        title="Apple Reports Strong Quarterly Earnings",
        content="Apple Inc. reported outstanding quarterly earnings that exceeded all analyst expectations. The company showed remarkable growth across all product categories with revenue up 15% year-over-year.",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.POSITIVE,
            compound_score_min=0.3,
            compound_score_max=0.8,
            confidence_min=0.7
        ),
        expected_entities=[
            ExpectedEntity(
                text="Apple Inc.",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="Apple Inc.",
                ticker_symbol="AAPL",
                confidence_min=0.8,
                mapping_source="exact"
            )
        ],
        description="Clear positive sentiment with company mention",
        difficulty_level="easy",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["positive", "earnings", "company"]
    ),

    GoldenSample(
        id="basic_neg_001",
        category=TestDataCategory.BASIC_SENTIMENT,
        source=SentimentSource.NEWS_API,
        content_type=ContentType.ARTICLE,
        title="Tesla Faces Production Challenges",
        content="Tesla is struggling with significant production delays and quality control issues. The company missed delivery targets by 20% and faces mounting pressure from investors about manufacturing capabilities.",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.NEGATIVE,
            compound_score_min=-0.8,
            compound_score_max=-0.3,
            confidence_min=0.7
        ),
        expected_entities=[
            ExpectedEntity(
                text="Tesla",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="Tesla",
                ticker_symbol="TSLA",
                confidence_min=0.8,
                mapping_source="exact"
            )
        ],
        description="Clear negative sentiment with company challenges",
        difficulty_level="easy",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["negative", "production", "challenges"]
    ),

    GoldenSample(
        id="basic_neu_001",
        category=TestDataCategory.BASIC_SENTIMENT,
        source=SentimentSource.NEWS_API,
        content_type=ContentType.ARTICLE,
        title="Microsoft Announces Quarterly Results",
        content="Microsoft Corporation announced its quarterly financial results today. The company reported revenue of $56.2 billion, which was in line with analyst expectations. No major surprises were noted in the earnings call.",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.NEUTRAL,
            compound_score_min=-0.2,
            compound_score_max=0.2,
            confidence_min=0.6
        ),
        expected_entities=[
            ExpectedEntity(
                text="Microsoft Corporation",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="Microsoft Corporation",
                ticker_symbol="MSFT",
                confidence_min=0.8,
                mapping_source="exact"
            )
        ],
        description="Neutral sentiment with factual reporting",
        difficulty_level="easy",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["neutral", "earnings", "factual"]
    )
]

FINANCIAL_CONTEXT_SAMPLES = [
    GoldenSample(
        id="fin_bull_001",
        category=TestDataCategory.FINANCIAL_CONTEXT,
        source=SentimentSource.TWITTER,
        content_type=ContentType.TWEET,
        title="",
        content="$AAPL breaking out! Strong bullish momentum with volume spike. Target $200. This is not financial advice but the technicals look amazing! 🚀📈 #AAPL #StockTrading",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.VERY_POSITIVE,
            compound_score_min=0.5,
            compound_score_max=1.0,
            confidence_min=0.8
        ),
        expected_entities=[
            ExpectedEntity(
                text="AAPL",
                entity_type=EntityType.TICKER,
                confidence_min=0.9,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="AAPL",
                ticker_symbol="AAPL",
                confidence_min=0.95,
                mapping_source="exact"
            )
        ],
        description="Very positive sentiment with financial jargon and cashtag",
        difficulty_level="medium",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["very_positive", "bullish", "trading", "cashtag"]
    ),

    GoldenSample(
        id="fin_bear_001",
        category=TestDataCategory.FINANCIAL_CONTEXT,
        source=SentimentSource.REDDIT,
        content_type=ContentType.REDDIT_POST,
        title="TSLA Put Options Discussion",
        content="TSLA is looking really bearish here. The stock is breaking key support levels and I'm seeing massive put volume. Short interest is climbing and the fundamentals don't support current valuations. Expecting further downside to $150.",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.VERY_NEGATIVE,
            compound_score_min=-1.0,
            compound_score_max=-0.5,
            confidence_min=0.8
        ),
        expected_entities=[
            ExpectedEntity(
                text="TSLA",
                entity_type=EntityType.TICKER,
                confidence_min=0.9,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="TSLA",
                ticker_symbol="TSLA",
                confidence_min=0.95,
                mapping_source="exact"
            )
        ],
        description="Very negative sentiment with technical analysis terms",
        difficulty_level="medium",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["very_negative", "bearish", "technical_analysis", "options"]
    )
]

ENTITY_EXTRACTION_SAMPLES = [
    GoldenSample(
        id="ent_complex_001",
        category=TestDataCategory.ENTITY_EXTRACTION,
        source=SentimentSource.NEWS_API,
        content_type=ContentType.ARTICLE,
        title="Tech Merger Announcement",
        content="In a surprise announcement, CEO Satya Nadella of Microsoft Corporation (MSFT) revealed plans for a $50 billion acquisition of ServiceNow Inc. (NOW). The deal, which is expected to close in Q4 2024, will strengthen Microsoft's position in the cloud services market. Wall Street analysts from JPMorgan Chase & Co. and Goldman Sachs Group Inc. have given positive ratings to the merger.",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.POSITIVE,
            compound_score_min=0.2,
            compound_score_max=0.6,
            confidence_min=0.7
        ),
        expected_entities=[
            ExpectedEntity(
                text="Satya Nadella",
                entity_type=EntityType.PERSON,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="Microsoft Corporation",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="MSFT",
                entity_type=EntityType.TICKER,
                confidence_min=0.9,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="ServiceNow Inc.",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="NOW",
                entity_type=EntityType.TICKER,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="$50 billion",
                entity_type=EntityType.CURRENCY,
                confidence_min=0.9,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="JPMorgan Chase & Co.",
                entity_type=EntityType.COMPANY,
                confidence_min=0.7,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="Goldman Sachs Group Inc.",
                entity_type=EntityType.COMPANY,
                confidence_min=0.7,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="Microsoft Corporation",
                ticker_symbol="MSFT",
                confidence_min=0.9,
                mapping_source="exact"
            ),
            ExpectedTickerMapping(
                entity_text="MSFT",
                ticker_symbol="MSFT",
                confidence_min=0.95,
                mapping_source="exact"
            ),
            ExpectedTickerMapping(
                entity_text="ServiceNow Inc.",
                ticker_symbol="NOW",
                confidence_min=0.8,
                mapping_source="exact"
            )
        ],
        description="Complex entity extraction with multiple companies, people, and financial amounts",
        difficulty_level="hard",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["complex", "merger", "multiple_entities", "finance"]
    )
]

TICKER_MAPPING_SAMPLES = [
    GoldenSample(
        id="tick_alias_001",
        category=TestDataCategory.TICKER_MAPPING,
        source=SentimentSource.TWITTER,
        content_type=ContentType.TWEET,
        title="",
        content="Google parent Alphabet just crushed earnings! Search revenue through the roof. GOOGL calls printing money 💰",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.VERY_POSITIVE,
            compound_score_min=0.5,
            compound_score_max=1.0,
            confidence_min=0.8
        ),
        expected_entities=[
            ExpectedEntity(
                text="Google",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="Alphabet",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="GOOGL",
                entity_type=EntityType.TICKER,
                confidence_min=0.9,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="Google",
                ticker_symbol="GOOGL",
                confidence_min=0.8,
                mapping_source="alias"
            ),
            ExpectedTickerMapping(
                entity_text="Alphabet",
                ticker_symbol="GOOGL",
                confidence_min=0.8,
                mapping_source="exact"
            ),
            ExpectedTickerMapping(
                entity_text="GOOGL",
                ticker_symbol="GOOGL",
                confidence_min=0.95,
                mapping_source="exact"
            )
        ],
        description="Company alias mapping (Google -> Alphabet -> GOOGL)",
        difficulty_level="medium",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["alias_mapping", "parent_company", "multiple_names"]
    ),

    GoldenSample(
        id="tick_fuzzy_001",
        category=TestDataCategory.TICKER_MAPPING,
        source=SentimentSource.REDDIT,
        content_type=ContentType.REDDIT_POST,
        title="Elon Musk Tesla Discussion",
        content="Teslas autonomous driving tech is getting so much better. Elon keeps delivering on promises. The company has come so far since the early days. Long TSLA!",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.POSITIVE,
            compound_score_min=0.3,
            compound_score_max=0.7,
            confidence_min=0.7
        ),
        expected_entities=[
            ExpectedEntity(
                text="Teslas",  # Note: possessive form
                entity_type=EntityType.COMPANY,
                confidence_min=0.6,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="Elon",
                entity_type=EntityType.PERSON,
                confidence_min=0.7,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="TSLA",
                entity_type=EntityType.TICKER,
                confidence_min=0.9,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="Teslas",
                ticker_symbol="TSLA",
                confidence_min=0.7,
                mapping_source="fuzzy"
            ),
            ExpectedTickerMapping(
                entity_text="TSLA",
                ticker_symbol="TSLA",
                confidence_min=0.95,
                mapping_source="exact"
            )
        ],
        description="Fuzzy matching for possessive forms and informal references",
        difficulty_level="medium",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["fuzzy_matching", "possessive", "informal"]
    )
]

EDGE_CASES_SAMPLES = [
    GoldenSample(
        id="edge_sarcasm_001",
        category=TestDataCategory.SARCASM_IRONY,
        source=SentimentSource.TWITTER,
        content_type=ContentType.TWEET,
        title="",
        content="Oh great, another TSLA 'funding secured' moment. Because that worked out so well last time 🙄 #ElonMusk #Tesla",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.NEGATIVE,
            compound_score_min=-0.6,
            compound_score_max=-0.2,
            confidence_min=0.6
        ),
        expected_entities=[
            ExpectedEntity(
                text="TSLA",
                entity_type=EntityType.TICKER,
                confidence_min=0.9,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="ElonMusk",
                entity_type=EntityType.PERSON,
                confidence_min=0.7,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="Tesla",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="TSLA",
                ticker_symbol="TSLA",
                confidence_min=0.95,
                mapping_source="exact"
            ),
            ExpectedTickerMapping(
                entity_text="Tesla",
                ticker_symbol="TSLA",
                confidence_min=0.9,
                mapping_source="exact"
            )
        ],
        description="Sarcastic sentiment with historical reference",
        difficulty_level="expert",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["sarcasm", "historical_reference", "irony", "difficult"]
    ),

    GoldenSample(
        id="edge_mixed_001",
        category=TestDataCategory.MIXED_SENTIMENT,
        source=SentimentSource.NEWS_API,
        content_type=ContentType.ARTICLE,
        title="Mixed Quarterly Results",
        content="Apple Inc. (AAPL) delivered strong iPhone sales that exceeded expectations, but iPad and Mac sales disappointed investors. While services revenue grew 12%, hardware margins compressed due to supply chain costs. The company raised guidance for next quarter but lowered full-year projections.",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.NEUTRAL,  # Mixed signals cancel out
            compound_score_min=-0.2,
            compound_score_max=0.2,
            confidence_min=0.5  # Lower confidence due to mixed signals
        ),
        expected_entities=[
            ExpectedEntity(
                text="Apple Inc.",
                entity_type=EntityType.COMPANY,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="AAPL",
                entity_type=EntityType.TICKER,
                confidence_min=0.9,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="iPhone",
                entity_type=EntityType.PRODUCT,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="iPad",
                entity_type=EntityType.PRODUCT,
                confidence_min=0.8,
                confidence_max=1.0
            ),
            ExpectedEntity(
                text="Mac",
                entity_type=EntityType.PRODUCT,
                confidence_min=0.8,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="Apple Inc.",
                ticker_symbol="AAPL",
                confidence_min=0.9,
                mapping_source="exact"
            ),
            ExpectedTickerMapping(
                entity_text="AAPL",
                ticker_symbol="AAPL",
                confidence_min=0.95,
                mapping_source="exact"
            )
        ],
        description="Mixed sentiment with both positive and negative elements",
        difficulty_level="hard",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["mixed_sentiment", "complex", "earnings", "guidance"]
    ),

    GoldenSample(
        id="edge_short_001",
        category=TestDataCategory.EDGE_CASES,
        source=SentimentSource.TWITTER,
        content_type=ContentType.TWEET,
        title="",
        content="$AAPL 📈",
        expected_sentiment=ExpectedSentiment(
            polarity=SentimentPolarity.POSITIVE,
            compound_score_min=0.1,
            compound_score_max=0.5,
            confidence_min=0.4  # Low confidence due to minimal text
        ),
        expected_entities=[
            ExpectedEntity(
                text="AAPL",
                entity_type=EntityType.TICKER,
                confidence_min=0.9,
                confidence_max=1.0
            )
        ],
        expected_ticker_mappings=[
            ExpectedTickerMapping(
                entity_text="AAPL",
                ticker_symbol="AAPL",
                confidence_min=0.95,
                mapping_source="exact"
            )
        ],
        description="Very short content with emoji sentiment",
        difficulty_level="hard",
        created_by="test_team",
        created_at=datetime.now(),
        tags=["short_content", "emoji", "minimal_text"]
    )
]

# Comprehensive test dataset
ALL_GOLDEN_SAMPLES = (
    BASIC_SENTIMENT_SAMPLES +
    FINANCIAL_CONTEXT_SAMPLES +
    ENTITY_EXTRACTION_SAMPLES +
    TICKER_MAPPING_SAMPLES +
    EDGE_CASES_SAMPLES
)


def get_samples_by_category(category: TestDataCategory) -> List[GoldenSample]:
    """Get all samples for a specific category"""
    return [sample for sample in ALL_GOLDEN_SAMPLES if sample.category == category]


def get_samples_by_difficulty(difficulty: str) -> List[GoldenSample]:
    """Get all samples for a specific difficulty level"""
    return [sample for sample in ALL_GOLDEN_SAMPLES if sample.difficulty_level == difficulty]


def get_samples_by_tag(tag: str) -> List[GoldenSample]:
    """Get all samples containing a specific tag"""
    return [sample for sample in ALL_GOLDEN_SAMPLES if tag in sample.tags]


def get_sample_by_id(sample_id: str) -> Optional[GoldenSample]:
    """Get a specific sample by ID"""
    for sample in ALL_GOLDEN_SAMPLES:
        if sample.id == sample_id:
            return sample
    return None


def get_test_statistics() -> Dict[str, Any]:
    """Get statistics about the test dataset"""
    stats = {
        "total_samples": len(ALL_GOLDEN_SAMPLES),
        "by_category": {},
        "by_difficulty": {},
        "by_source": {},
        "by_polarity": {},
        "entity_types": set(),
        "ticker_symbols": set()
    }

    for sample in ALL_GOLDEN_SAMPLES:
        # Category stats
        category = sample.category.value
        stats["by_category"][category] = stats["by_category"].get(category, 0) + 1

        # Difficulty stats
        difficulty = sample.difficulty_level
        stats["by_difficulty"][difficulty] = stats["by_difficulty"].get(difficulty, 0) + 1

        # Source stats
        source = sample.source.value
        stats["by_source"][source] = stats["by_source"].get(source, 0) + 1

        # Polarity stats
        polarity = sample.expected_sentiment.polarity.value
        stats["by_polarity"][polarity] = stats["by_polarity"].get(polarity, 0) + 1

        # Entity types
        for entity in sample.expected_entities:
            stats["entity_types"].add(entity.entity_type.value)

        # Ticker symbols
        for mapping in sample.expected_ticker_mappings:
            stats["ticker_symbols"].add(mapping.ticker_symbol)

    # Convert sets to lists for JSON serialization
    stats["entity_types"] = list(stats["entity_types"])
    stats["ticker_symbols"] = list(stats["ticker_symbols"])

    return stats


# Export for easy importing
__all__ = [
    'GoldenSample',
    'ExpectedEntity',
    'ExpectedTickerMapping',
    'ExpectedSentiment',
    'TestDataCategory',
    'ALL_GOLDEN_SAMPLES',
    'BASIC_SENTIMENT_SAMPLES',
    'FINANCIAL_CONTEXT_SAMPLES',
    'ENTITY_EXTRACTION_SAMPLES',
    'TICKER_MAPPING_SAMPLES',
    'EDGE_CASES_SAMPLES',
    'get_samples_by_category',
    'get_samples_by_difficulty',
    'get_samples_by_tag',
    'get_sample_by_id',
    'get_test_statistics'
]


if __name__ == "__main__":
    # Print test dataset statistics
    stats = get_test_statistics()
    print("Golden Sample Dataset Statistics:")
    print(f"Total samples: {stats['total_samples']}")
    print(f"Categories: {stats['by_category']}")
    print(f"Difficulty levels: {stats['by_difficulty']}")
    print(f"Sources: {stats['by_source']}")
    print(f"Sentiment polarities: {stats['by_polarity']}")
    print(f"Entity types: {stats['entity_types']}")
    print(f"Ticker symbols: {stats['ticker_symbols']}")