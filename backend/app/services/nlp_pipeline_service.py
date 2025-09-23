"""
NLP Pipeline Service

This service handles:
- Named Entity Recognition (NER) for financial content
- Ticker symbol mapping and normalization
- Sentiment analysis with confidence scoring
- Entity resolution and disambiguation
- Text preprocessing and cleaning
"""

import re
import asyncio
import time
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple, Set
from concurrent.futures import ThreadPoolExecutor
import hashlib

# NLP libraries
import spacy
from spacy.tokens import Doc, Span
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
from textblob import TextBlob
import redis.asyncio as aioredis
from loguru import logger

from app.models.sentiment_ner_models import (
    NamedEntity, EntityType, SentimentScore, SentimentPolarity,
    ProcessedContent, TickerMapping, NERModel, NLPPipelineConfig
)


class FinancialEntityMatcher:
    """Advanced entity matcher for financial content"""

    def __init__(self):
        # Common ticker patterns
        self.ticker_pattern = re.compile(r'\b[A-Z]{1,5}\b')
        self.dollar_ticker_pattern = re.compile(r'\$([A-Z]{1,5})\b')

        # Financial entities dictionary
        self.financial_entities = self._load_financial_entities()
        self.company_tickers = self._load_company_ticker_mapping()

    def _load_financial_entities(self) -> Dict[str, EntityType]:
        """Load financial entity keywords"""
        return {
            # Financial metrics
            'revenue': EntityType.FINANCIAL_METRIC,
            'earnings': EntityType.FINANCIAL_METRIC,
            'eps': EntityType.FINANCIAL_METRIC,
            'ebitda': EntityType.FINANCIAL_METRIC,
            'profit': EntityType.FINANCIAL_METRIC,
            'loss': EntityType.FINANCIAL_METRIC,
            'guidance': EntityType.FINANCIAL_METRIC,
            'margin': EntityType.FINANCIAL_METRIC,
            'dividend': EntityType.FINANCIAL_METRIC,

            # Market events
            'earnings call': EntityType.EVENT,
            'ipo': EntityType.EVENT,
            'merger': EntityType.EVENT,
            'acquisition': EntityType.EVENT,
            'split': EntityType.EVENT,
            'buyback': EntityType.EVENT,

            # Currencies
            'usd': EntityType.CURRENCY,
            'eur': EntityType.CURRENCY,
            'gbp': EntityType.CURRENCY,
            'jpy': EntityType.CURRENCY,

            # Sectors
            'technology': EntityType.SECTOR,
            'healthcare': EntityType.SECTOR,
            'finance': EntityType.SECTOR,
            'energy': EntityType.SECTOR,
            'consumer': EntityType.SECTOR,
        }

    def _load_company_ticker_mapping(self) -> Dict[str, str]:
        """Load company name to ticker mapping"""
        return {
            'apple': 'AAPL',
            'apple inc': 'AAPL',
            'microsoft': 'MSFT',
            'microsoft corporation': 'MSFT',
            'google': 'GOOGL',
            'alphabet': 'GOOGL',
            'amazon': 'AMZN',
            'tesla': 'TSLA',
            'meta': 'META',
            'facebook': 'META',
            'nvidia': 'NVDA',
            'netflix': 'NFLX',
            'twitter': 'TWTR',
            'salesforce': 'CRM',
            'oracle': 'ORCL',
            'intel': 'INTC',
        }

    def extract_tickers(self, text: str) -> List[Tuple[str, int, int, float]]:
        """
        Extract ticker symbols from text.

        Returns:
            List of (ticker, start_pos, end_pos, confidence) tuples
        """
        tickers = []

        # Pattern 1: $TICKER format
        for match in self.dollar_ticker_pattern.finditer(text):
            ticker = match.group(1)
            if self._is_valid_ticker(ticker):
                tickers.append((ticker, match.start(), match.end(), 0.95))

        # Pattern 2: Standalone tickers (more conservative)
        for match in self.ticker_pattern.finditer(text):
            ticker = match.group()
            if self._is_valid_ticker(ticker) and self._is_ticker_context(text, match):
                tickers.append((ticker, match.start(), match.end(), 0.7))

        return tickers

    def _is_valid_ticker(self, ticker: str) -> bool:
        """Check if string could be a valid ticker"""
        if len(ticker) < 1 or len(ticker) > 5:
            return False

        # Exclude common words that match ticker pattern
        excluded_words = {
            'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL',
            'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET',
            'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'NEW', 'NOW', 'OLD',
            'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'ITS', 'LET',
            'PUT', 'SAY', 'SHE', 'TOO', 'USE'
        }

        return ticker not in excluded_words

    def _is_ticker_context(self, text: str, match) -> bool:
        """Check if ticker appears in financial context"""
        start = max(0, match.start() - 50)
        end = min(len(text), match.end() + 50)
        context = text[start:end].lower()

        financial_keywords = [
            'stock', 'share', 'price', 'trading', 'market', 'nasdaq',
            'nyse', 'earnings', 'revenue', 'profit', 'loss', 'rally',
            'decline', 'bull', 'bear', 'investment', 'portfolio'
        ]

        return any(keyword in context for keyword in financial_keywords)

    def map_company_to_ticker(self, company_name: str) -> Optional[str]:
        """Map company name to ticker symbol"""
        normalized_name = company_name.lower().strip()

        # Direct mapping
        if normalized_name in self.company_tickers:
            return self.company_tickers[normalized_name]

        # Fuzzy matching
        for company, ticker in self.company_tickers.items():
            if company in normalized_name or normalized_name in company:
                return ticker

        return None


class AdvancedNEREngine:
    """Advanced NER engine with financial domain expertise"""

    def __init__(self, model_name: str = "en_core_web_sm"):
        self.model_name = model_name
        self.nlp = None
        self.financial_matcher = FinancialEntityMatcher()
        self.executor = ThreadPoolExecutor(max_workers=2)

    async def initialize(self):
        """Initialize NLP models"""
        try:
            # Load spaCy model in thread to avoid blocking
            self.nlp = await asyncio.get_event_loop().run_in_executor(
                self.executor, spacy.load, self.model_name
            )
            logger.info(f"Loaded spaCy model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to load spaCy model: {e}")
            # Fallback to basic model
            self.nlp = spacy.blank("en")

    async def extract_entities(
        self,
        text: str,
        confidence_threshold: float = 0.5
    ) -> List[NamedEntity]:
        """Extract named entities from text"""
        if not self.nlp:
            await self.initialize()

        entities = []

        # Run spaCy NER in thread
        doc = await asyncio.get_event_loop().run_in_executor(
            self.executor, self.nlp, text
        )

        # Extract standard entities
        for ent in doc.ents:
            entity_type = self._map_spacy_entity_type(ent.label_)
            if entity_type:
                confidence = self._calculate_entity_confidence(ent, text)
                if confidence >= confidence_threshold:
                    # Map to ticker if applicable
                    mapped_ticker, ticker_confidence = self._map_entity_to_ticker(
                        ent.text, entity_type
                    )

                    entity = NamedEntity(
                        entity_type=entity_type,
                        text=ent.text,
                        normalized_text=self._normalize_entity_text(ent.text, entity_type),
                        start_position=ent.start_char,
                        end_position=ent.end_char,
                        confidence=confidence,
                        model_name=self.model_name,
                        model_version="1.0.0",
                        mapped_ticker=mapped_ticker,
                        ticker_confidence=ticker_confidence,
                        context=self._get_entity_context(text, ent.start_char, ent.end_char)
                    )
                    entities.append(entity)

        # Extract ticker symbols specifically
        ticker_entities = await self._extract_ticker_entities(text)
        entities.extend(ticker_entities)

        # Extract financial entities
        financial_entities = await self._extract_financial_entities(text)
        entities.extend(financial_entities)

        return self._deduplicate_entities(entities)

    def _map_spacy_entity_type(self, spacy_label: str) -> Optional[EntityType]:
        """Map spaCy entity labels to our EntityType enum"""
        mapping = {
            'PERSON': EntityType.PERSON,
            'ORG': EntityType.COMPANY,
            'GPE': EntityType.LOCATION,
            'DATE': EntityType.DATE,
            'MONEY': EntityType.CURRENCY,
            'PRODUCT': EntityType.PRODUCT,
        }
        return mapping.get(spacy_label)

    def _calculate_entity_confidence(self, ent: Span, text: str) -> float:
        """Calculate confidence score for entity"""
        base_confidence = 0.8  # Base confidence for spaCy entities

        # Adjust based on entity characteristics
        if ent.label_ in ['PERSON', 'ORG']:
            if ent.text.istitle():
                base_confidence += 0.1

        # Adjust based on context
        context = self._get_entity_context(text, ent.start_char, ent.end_char)
        if any(word in context.lower() for word in ['ceo', 'company', 'corporation']):
            base_confidence += 0.1

        return min(base_confidence, 1.0)

    def _map_entity_to_ticker(
        self,
        entity_text: str,
        entity_type: EntityType
    ) -> Tuple[Optional[str], Optional[float]]:
        """Map entity to ticker symbol if applicable"""
        if entity_type in [EntityType.COMPANY, EntityType.TICKER]:
            # Check if it's already a ticker
            if re.match(r'^[A-Z]{1,5}$', entity_text):
                return entity_text, 0.95

            # Try company name mapping
            ticker = self.financial_matcher.map_company_to_ticker(entity_text)
            if ticker:
                return ticker, 0.8

        return None, None

    def _normalize_entity_text(self, text: str, entity_type: EntityType) -> str:
        """Normalize entity text"""
        if entity_type == EntityType.TICKER:
            return text.upper().strip()
        elif entity_type == EntityType.COMPANY:
            # Remove common suffixes
            normalized = re.sub(r'\s+(Inc|Corp|Corporation|Ltd|LLC)\.?$', '', text, flags=re.IGNORECASE)
            return normalized.strip()
        else:
            return text.strip()

    def _get_entity_context(self, text: str, start: int, end: int, window: int = 50) -> str:
        """Get surrounding context for an entity"""
        context_start = max(0, start - window)
        context_end = min(len(text), end + window)
        return text[context_start:context_end]

    async def _extract_ticker_entities(self, text: str) -> List[NamedEntity]:
        """Extract ticker symbols using financial matcher"""
        entities = []
        tickers = self.financial_matcher.extract_tickers(text)

        for ticker, start, end, confidence in tickers:
            entity = NamedEntity(
                entity_type=EntityType.TICKER,
                text=ticker,
                normalized_text=ticker.upper(),
                start_position=start,
                end_position=end,
                confidence=confidence,
                model_name="financial_matcher",
                model_version="1.0.0",
                mapped_ticker=ticker.upper(),
                ticker_confidence=0.95,
                context=self._get_entity_context(text, start, end)
            )
            entities.append(entity)

        return entities

    async def _extract_financial_entities(self, text: str) -> List[NamedEntity]:
        """Extract financial-specific entities"""
        entities = []
        text_lower = text.lower()

        for term, entity_type in self.financial_matcher.financial_entities.items():
            pattern = re.compile(r'\b' + re.escape(term) + r'\b', re.IGNORECASE)
            for match in pattern.finditer(text):
                entity = NamedEntity(
                    entity_type=entity_type,
                    text=match.group(),
                    normalized_text=term,
                    start_position=match.start(),
                    end_position=match.end(),
                    confidence=0.9,
                    model_name="financial_dictionary",
                    model_version="1.0.0",
                    context=self._get_entity_context(text, match.start(), match.end())
                )
                entities.append(entity)

        return entities

    def _deduplicate_entities(self, entities: List[NamedEntity]) -> List[NamedEntity]:
        """Remove duplicate entities with overlapping spans"""
        if not entities:
            return entities

        # Sort by start position
        entities.sort(key=lambda e: e.start_position)

        deduplicated = []
        for entity in entities:
            # Check for overlap with existing entities
            overlapping = False
            for existing in deduplicated:
                if (entity.start_position < existing.end_position and
                    entity.end_position > existing.start_position):
                    # Choose entity with higher confidence
                    if entity.confidence > existing.confidence:
                        deduplicated.remove(existing)
                        deduplicated.append(entity)
                    overlapping = True
                    break

            if not overlapping:
                deduplicated.append(entity)

        return deduplicated


class SentimentAnalyzer:
    """Multi-model sentiment analyzer"""

    def __init__(self):
        self.vader_analyzer = None
        self.textblob_analyzer = TextBlob

    async def initialize(self):
        """Initialize sentiment models"""
        try:
            # Download VADER lexicon if needed
            nltk.download('vader_lexicon', quiet=True)
            self.vader_analyzer = SentimentIntensityAnalyzer()
            logger.info("Initialized VADER sentiment analyzer")
        except Exception as e:
            logger.error(f"Failed to initialize VADER: {e}")

    async def analyze_sentiment(
        self,
        text: str,
        model: str = "ensemble"
    ) -> SentimentScore:
        """Analyze sentiment using specified model or ensemble"""
        if not self.vader_analyzer:
            await self.initialize()

        if model == "vader":
            return await self._vader_sentiment(text)
        elif model == "textblob":
            return await self._textblob_sentiment(text)
        else:
            return await self._ensemble_sentiment(text)

    async def _vader_sentiment(self, text: str) -> SentimentScore:
        """Analyze sentiment using VADER"""
        scores = self.vader_analyzer.polarity_scores(text)

        # Map to our sentiment scale
        compound = scores['compound']
        polarity = self._score_to_polarity(compound)

        return SentimentScore(
            polarity=polarity,
            score=compound,
            confidence=abs(compound),  # Higher absolute score = higher confidence
            magnitude=max(scores['pos'], scores['neg']),
            model_name="vader",
            model_version="3.3.2",
            positive_score=scores['pos'],
            negative_score=scores['neg'],
            neutral_score=scores['neu'],
            analyzed_text=text[:200],  # Store first 200 chars
            text_length=len(text)
        )

    async def _textblob_sentiment(self, text: str) -> SentimentScore:
        """Analyze sentiment using TextBlob"""
        blob = TextBlob(text)
        polarity_score = blob.sentiment.polarity  # -1 to 1
        subjectivity = blob.sentiment.subjectivity  # 0 to 1

        polarity = self._score_to_polarity(polarity_score)

        # Convert polarity score to positive/negative/neutral probabilities
        if polarity_score > 0:
            positive_score = abs(polarity_score)
            negative_score = 0.0
            neutral_score = 1.0 - positive_score
        elif polarity_score < 0:
            positive_score = 0.0
            negative_score = abs(polarity_score)
            neutral_score = 1.0 - negative_score
        else:
            positive_score = 0.0
            negative_score = 0.0
            neutral_score = 1.0

        return SentimentScore(
            polarity=polarity,
            score=polarity_score,
            confidence=subjectivity,  # Use subjectivity as confidence
            magnitude=abs(polarity_score),
            model_name="textblob",
            model_version="0.17.1",
            positive_score=positive_score,
            negative_score=negative_score,
            neutral_score=neutral_score,
            analyzed_text=text[:200],
            text_length=len(text)
        )

    async def _ensemble_sentiment(self, text: str) -> SentimentScore:
        """Analyze sentiment using ensemble of models"""
        vader_result = await self._vader_sentiment(text)
        textblob_result = await self._textblob_sentiment(text)

        # Weight VADER more heavily for social media, TextBlob for news
        vader_weight = 0.7
        textblob_weight = 0.3

        # Weighted average of scores
        ensemble_score = (vader_result.score * vader_weight +
                         textblob_result.score * textblob_weight)

        ensemble_confidence = (vader_result.confidence * vader_weight +
                              textblob_result.confidence * textblob_weight)

        polarity = self._score_to_polarity(ensemble_score)

        # Weighted probabilities
        positive_score = (vader_result.positive_score * vader_weight +
                         textblob_result.positive_score * textblob_weight)
        negative_score = (vader_result.negative_score * vader_weight +
                         textblob_result.negative_score * textblob_weight)
        neutral_score = (vader_result.neutral_score * vader_weight +
                        textblob_result.neutral_score * textblob_weight)

        return SentimentScore(
            polarity=polarity,
            score=ensemble_score,
            confidence=ensemble_confidence,
            magnitude=abs(ensemble_score),
            model_name="ensemble_vader_textblob",
            model_version="1.0.0",
            positive_score=positive_score,
            negative_score=negative_score,
            neutral_score=neutral_score,
            analyzed_text=text[:200],
            text_length=len(text)
        )

    def _score_to_polarity(self, score: float) -> SentimentPolarity:
        """Convert numeric score to polarity enum"""
        if score >= 0.7:
            return SentimentPolarity.VERY_POSITIVE
        elif score >= 0.3:
            return SentimentPolarity.POSITIVE
        elif score > -0.3:
            return SentimentPolarity.NEUTRAL
        elif score > -0.7:
            return SentimentPolarity.NEGATIVE
        else:
            return SentimentPolarity.VERY_NEGATIVE


class NLPPipelineService:
    """Main NLP pipeline service"""

    def __init__(self, redis_client: aioredis.Redis, config: NLPPipelineConfig):
        self.redis = redis_client
        self.config = config
        self.ner_engine = AdvancedNEREngine()
        self.sentiment_analyzer = SentimentAnalyzer()

    async def initialize(self):
        """Initialize all NLP components"""
        await self.ner_engine.initialize()
        await self.sentiment_analyzer.initialize()
        logger.info("NLP Pipeline initialized")

    async def process_content(self, content_text: str, content_id: str) -> ProcessedContent:
        """Process content through full NLP pipeline"""
        start_time = time.time()

        try:
            # Extract entities
            entities = await self.ner_engine.extract_entities(
                content_text,
                confidence_threshold=self.config.ner_confidence_threshold
            )

            # Analyze overall sentiment
            overall_sentiment = await self.sentiment_analyzer.analyze_sentiment(
                content_text,
                model="ensemble"
            )

            # Analyze ticker-specific sentiment
            ticker_sentiments = {}
            primary_tickers = []

            for entity in entities:
                if entity.entity_type == EntityType.TICKER and entity.mapped_ticker:
                    ticker = entity.mapped_ticker
                    if ticker not in ticker_sentiments:
                        # Extract context around ticker for sentiment analysis
                        ticker_context = self._extract_ticker_context(
                            content_text, entity, window=100
                        )

                        ticker_sentiment = await self.sentiment_analyzer.analyze_sentiment(
                            ticker_context
                        )
                        ticker_sentiments[ticker] = ticker_sentiment

                        if entity.confidence > 0.8:
                            primary_tickers.append(ticker)

            # Calculate quality metrics
            overall_confidence = self._calculate_overall_confidence(entities, overall_sentiment)
            entity_coverage = self._calculate_entity_coverage(content_text, entities)

            processing_time = time.time() - start_time

            processed_content = ProcessedContent(
                content_id=content_id,
                entities=entities,
                sentiment=overall_sentiment,
                ticker_sentiments=ticker_sentiments,
                primary_tickers=list(set(primary_tickers)),
                entity_count=len(entities),
                processing_time=processing_time,
                overall_confidence=overall_confidence,
                entity_coverage=entity_coverage
            )

            # Cache processed content
            if self.config.enable_caching:
                await self._cache_processed_content(processed_content)

            logger.debug(f"Processed content {content_id}: {len(entities)} entities, "
                        f"{len(ticker_sentiments)} tickers, confidence={overall_confidence:.2f}")

            return processed_content

        except Exception as e:
            logger.error(f"Error processing content {content_id}: {e}")
            raise

    def _extract_ticker_context(
        self,
        text: str,
        ticker_entity: NamedEntity,
        window: int = 100
    ) -> str:
        """Extract context around ticker mention for sentiment analysis"""
        start = max(0, ticker_entity.start_position - window)
        end = min(len(text), ticker_entity.end_position + window)
        return text[start:end]

    def _calculate_overall_confidence(
        self,
        entities: List[NamedEntity],
        sentiment: SentimentScore
    ) -> float:
        """Calculate overall processing confidence"""
        if not entities:
            entity_confidence = 0.5
        else:
            entity_confidence = sum(e.confidence for e in entities) / len(entities)

        # Weight entity and sentiment confidence
        overall = (entity_confidence * 0.6 + sentiment.confidence * 0.4)
        return min(overall, 1.0)

    def _calculate_entity_coverage(self, text: str, entities: List[NamedEntity]) -> float:
        """Calculate what percentage of text is covered by entities"""
        if not entities or not text:
            return 0.0

        covered_chars = 0
        for entity in entities:
            covered_chars += (entity.end_position - entity.start_position)

        return min(covered_chars / len(text), 1.0)

    async def _cache_processed_content(self, processed_content: ProcessedContent):
        """Cache processed content in Redis"""
        cache_key = f"processed_content:{processed_content.processed_id}"
        await self.redis.setex(
            cache_key,
            self.config.cache_ttl,
            processed_content.json()
        )

    async def get_processing_stats(self) -> Dict[str, Any]:
        """Get NLP processing statistics"""
        # Count cached processed content
        processed_keys = await self.redis.keys("processed_content:*")

        return {
            "total_processed": len(processed_keys),
            "ner_model": self.ner_engine.model_name,
            "config": self.config.dict(),
            "timestamp": datetime.utcnow().isoformat()
        }


# Factory function
async def create_nlp_pipeline(
    redis_url: str = "redis://localhost:6379",
    config: Optional[NLPPipelineConfig] = None
) -> NLPPipelineService:
    """Create and initialize NLP pipeline service"""
    redis_client = aioredis.from_url(redis_url)

    if not config:
        config = NLPPipelineConfig(
            ner_model_id="en_core_web_sm",
            ner_confidence_threshold=0.5,
            sentiment_confidence_threshold=0.3,
            max_text_length=10000,
            batch_size=10,
            enable_caching=True,
            cache_ttl=3600
        )

    service = NLPPipelineService(redis_client, config)
    await service.initialize()

    return service


if __name__ == "__main__":
    async def test_nlp_pipeline():
        """Test the NLP pipeline"""
        service = await create_nlp_pipeline()

        test_text = """
        Apple Inc. (AAPL) reported strong Q4 earnings yesterday, beating estimates.
        The company's revenue grew 15% year-over-year to $123.4 billion.
        CEO Tim Cook expressed optimism about the future, citing strong iPhone sales
        and growth in services. The stock rallied 5% in after-hours trading.
        Tesla (TSLA) also had a good day, with Elon Musk announcing new features.
        """

        result = await service.process_content(test_text, "test_content_1")

        print(f"Processed content with {len(result.entities)} entities")
        print(f"Overall sentiment: {result.sentiment.polarity} ({result.sentiment.score:.2f})")
        print(f"Primary tickers: {result.primary_tickers}")

        for ticker, sentiment in result.ticker_sentiments.items():
            print(f"{ticker}: {sentiment.polarity} ({sentiment.score:.2f})")

    # Run test
    asyncio.run(test_nlp_pipeline())