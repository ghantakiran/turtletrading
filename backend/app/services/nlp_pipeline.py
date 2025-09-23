"""
NLP Pipeline with Named Entity Recognition and Ticker Mapping

This module provides advanced NLP processing for financial content including
entity extraction, ticker symbol mapping, and context-aware analysis.
"""

import re
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass
from collections import defaultdict, Counter
import spacy
from spacy import displacy
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
from nltk.sentiment import SentimentIntensityAnalyzer
import yfinance as yf
from fuzzywuzzy import fuzz, process

from app.core.config import settings
from app.core.logging import logger
from app.models.sentiment_ingestion_models import (
    RawContentItem,
    EntityExtraction,
    EntityType,
    TickerMapping,
    SentimentScore,
    EntitySentiment,
    SentimentPolarity
)
from app.services.redis_service import RedisService


@dataclass
class EntityMatch:
    """Represents a matched entity with context"""
    text: str
    entity_type: EntityType
    start: int
    end: int
    confidence: float
    context: str
    normalized_form: Optional[str] = None


@dataclass
class TickerCandidate:
    """Represents a potential ticker symbol match"""
    ticker: str
    company_name: str
    confidence: float
    match_type: str  # 'exact', 'fuzzy', 'alias'


class FinancialEntityExtractor:
    """Extracts financial entities using rule-based and ML approaches"""

    def __init__(self):
        # Download required NLTK data
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt', quiet=True)

        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            nltk.download('stopwords', quiet=True)

        try:
            nltk.data.find('vader_lexicon')
        except LookupError:
            nltk.download('vader_lexicon', quiet=True)

        # Load spaCy model (download with: python -m spacy download en_core_web_sm)
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy English model not found. Install with: python -m spacy download en_core_web_sm")
            self.nlp = None

        # Initialize NLTK sentiment analyzer
        self.sentiment_analyzer = SentimentIntensityAnalyzer()

        # Ticker symbol patterns
        self.ticker_pattern = re.compile(r'\b[A-Z]{1,5}\b')
        self.cashtag_pattern = re.compile(r'\$([A-Z]{1,5})\b')

        # Financial terms dictionary
        self.financial_terms = {
            'company_indicators': ['inc', 'corp', 'ltd', 'llc', 'company', 'corporation'],
            'financial_metrics': ['revenue', 'earnings', 'profit', 'loss', 'eps', 'pe', 'roe', 'debt'],
            'market_terms': ['bull', 'bear', 'market', 'stock', 'share', 'equity', 'bond'],
            'action_terms': ['buy', 'sell', 'hold', 'long', 'short', 'call', 'put']
        }

        # Person name patterns (simplified)
        self.person_titles = ['ceo', 'cfo', 'cto', 'president', 'chairman', 'director', 'analyst']

    def extract_entities(self, content: str, content_id: str) -> List[EntityExtraction]:
        """Extract all entities from content"""
        entities = []

        # Extract ticker symbols
        entities.extend(self._extract_ticker_symbols(content, content_id))

        # Extract company names
        entities.extend(self._extract_company_names(content, content_id))

        # Extract person names
        entities.extend(self._extract_person_names(content, content_id))

        # Extract financial terms
        entities.extend(self._extract_financial_terms(content, content_id))

        # Use spaCy NER if available
        if self.nlp:
            entities.extend(self._extract_with_spacy(content, content_id))

        # Deduplicate entities by position
        unique_entities = self._deduplicate_entities(entities)

        return unique_entities

    def _extract_ticker_symbols(self, content: str, content_id: str) -> List[EntityExtraction]:
        """Extract ticker symbols from content"""
        entities = []

        # Find cashtags ($AAPL)
        for match in self.cashtag_pattern.finditer(content):
            ticker = match.group(1)
            start, end = match.span()

            entity = EntityExtraction(
                content_id=content_id,
                entity_text=ticker,
                entity_type=EntityType.TICKER,
                confidence_score=0.95,  # High confidence for cashtags
                start_position=start,
                end_position=end,
                normalized_form=ticker.upper(),
                metadata={'extraction_method': 'cashtag_pattern'}
            )
            entities.append(entity)

        # Find potential ticker symbols (all caps, 1-5 letters)
        for match in self.ticker_pattern.finditer(content):
            ticker = match.group()
            start, end = match.span()

            # Skip common English words that are all caps
            if ticker.lower() in ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'day', 'get', 'his', 'old', 'see', 'now', 'way', 'may', 'say', 'new', 'use', 'man', 'try']:
                continue

            # Higher confidence if surrounded by financial context
            context_window = content[max(0, start-50):min(len(content), end+50)]
            confidence = 0.6  # Base confidence

            if any(term in context_window.lower() for term in ['stock', 'share', 'market', 'trading']):
                confidence += 0.2

            entity = EntityExtraction(
                content_id=content_id,
                entity_text=ticker,
                entity_type=EntityType.TICKER,
                confidence_score=confidence,
                start_position=start,
                end_position=end,
                normalized_form=ticker.upper(),
                metadata={'extraction_method': 'pattern_matching'}
            )
            entities.append(entity)

        return entities

    def _extract_company_names(self, content: str, content_id: str) -> List[EntityExtraction]:
        """Extract company names using patterns and indicators"""
        entities = []

        # Pattern for "Company Inc", "Corporation", etc.
        company_pattern = re.compile(
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(' + '|'.join(self.financial_terms['company_indicators']) + r')\b',
            re.IGNORECASE
        )

        for match in company_pattern.finditer(content):
            company_name = match.group(1)
            start, end = match.span()

            entity = EntityExtraction(
                content_id=content_id,
                entity_text=match.group(),
                entity_type=EntityType.COMPANY,
                confidence_score=0.8,
                start_position=start,
                end_position=end,
                normalized_form=company_name.title(),
                metadata={'extraction_method': 'company_pattern'}
            )
            entities.append(entity)

        return entities

    def _extract_person_names(self, content: str, content_id: str) -> List[EntityExtraction]:
        """Extract person names, especially executives"""
        entities = []

        # Pattern for "CEO John Smith", "President Jane Doe", etc.
        person_pattern = re.compile(
            r'\b(' + '|'.join(self.person_titles) + r')\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b',
            re.IGNORECASE
        )

        for match in person_pattern.finditer(content):
            person_name = match.group(2)
            start, end = match.span()

            entity = EntityExtraction(
                content_id=content_id,
                entity_text=person_name,
                entity_type=EntityType.PERSON,
                confidence_score=0.85,
                start_position=start,
                end_position=end,
                normalized_form=person_name.title(),
                metadata={
                    'extraction_method': 'title_pattern',
                    'title': match.group(1).lower()
                }
            )
            entities.append(entity)

        return entities

    def _extract_financial_terms(self, content: str, content_id: str) -> List[EntityExtraction]:
        """Extract financial and business terms"""
        entities = []

        # Currency patterns
        currency_pattern = re.compile(r'\$[\d,]+\.?\d*[MBK]?|\d+\.?\d*\s*(million|billion|trillion)')

        for match in currency_pattern.finditer(content):
            start, end = match.span()

            entity = EntityExtraction(
                content_id=content_id,
                entity_text=match.group(),
                entity_type=EntityType.CURRENCY,
                confidence_score=0.9,
                start_position=start,
                end_position=end,
                metadata={'extraction_method': 'currency_pattern'}
            )
            entities.append(entity)

        return entities

    def _extract_with_spacy(self, content: str, content_id: str) -> List[EntityExtraction]:
        """Extract entities using spaCy NER"""
        entities = []

        if not self.nlp:
            return entities

        doc = self.nlp(content)

        for ent in doc.ents:
            # Map spaCy entity types to our types
            entity_type_mapping = {
                'ORG': EntityType.ORGANIZATION,
                'PERSON': EntityType.PERSON,
                'GPE': EntityType.LOCATION,
                'MONEY': EntityType.CURRENCY,
                'EVENT': EntityType.EVENT,
                'PRODUCT': EntityType.PRODUCT
            }

            entity_type = entity_type_mapping.get(ent.label_, EntityType.ORGANIZATION)

            entity = EntityExtraction(
                content_id=content_id,
                entity_text=ent.text,
                entity_type=entity_type,
                confidence_score=0.7,  # spaCy confidence is not easily accessible
                start_position=ent.start_char,
                end_position=ent.end_char,
                normalized_form=ent.text.strip(),
                metadata={
                    'extraction_method': 'spacy_ner',
                    'spacy_label': ent.label_
                }
            )
            entities.append(entity)

        return entities

    def _deduplicate_entities(self, entities: List[EntityExtraction]) -> List[EntityExtraction]:
        """Remove duplicate entities based on position overlap"""
        entities.sort(key=lambda x: x.start_position)
        unique_entities = []

        for entity in entities:
            # Check for overlap with existing entities
            overlaps = False
            for existing in unique_entities:
                if (entity.start_position < existing.end_position and
                    entity.end_position > existing.start_position):
                    # Choose the entity with higher confidence
                    if entity.confidence_score > existing.confidence_score:
                        unique_entities.remove(existing)
                        unique_entities.append(entity)
                    overlaps = True
                    break

            if not overlaps:
                unique_entities.append(entity)

        return unique_entities


class TickerMapper:
    """Maps extracted entities to stock ticker symbols"""

    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self.cache_expiry = 86400  # 24 hours

        # Known ticker mappings (could be loaded from database)
        self.known_mappings = {
            'apple': 'AAPL',
            'microsoft': 'MSFT',
            'google': 'GOOGL',
            'alphabet': 'GOOGL',
            'amazon': 'AMZN',
            'tesla': 'TSLA',
            'meta': 'META',
            'facebook': 'META',
            'nvidia': 'NVDA',
            'jpmorgan': 'JPM',
            'jp morgan': 'JPM',
            'johnson & johnson': 'JNJ',
            'walmart': 'WMT',
            'exxon mobil': 'XOM',
            'procter & gamble': 'PG'
        }

        # Company aliases and common variations
        self.company_aliases = {
            'goog': 'GOOGL',
            'fb': 'META',
            'jpm': 'JPM',
            'jnj': 'JNJ',
            'pg': 'PG',
            'wmt': 'WMT',
            'xom': 'XOM'
        }

    async def map_entities_to_tickers(self, entities: List[EntityExtraction]) -> List[TickerMapping]:
        """Map extracted entities to ticker symbols"""
        mappings = []

        for entity in entities:
            if entity.entity_type in [EntityType.COMPANY, EntityType.TICKER, EntityType.ORGANIZATION]:
                ticker_candidates = await self._find_ticker_candidates(entity.entity_text)

                for candidate in ticker_candidates:
                    # Adjust confidence based on entity confidence
                    final_confidence = entity.confidence_score * candidate.confidence

                    mapping = TickerMapping(
                        entity_text=entity.entity_text,
                        entity_type=entity.entity_type,
                        ticker_symbol=candidate.ticker,
                        company_name=candidate.company_name,
                        confidence_score=final_confidence,
                        mapping_source=candidate.match_type,
                        verified=final_confidence > 0.8
                    )
                    mappings.append(mapping)

        return mappings

    async def _find_ticker_candidates(self, entity_text: str) -> List[TickerCandidate]:
        """Find potential ticker symbols for an entity"""
        candidates = []
        entity_lower = entity_text.lower().strip()

        # Check cache first
        cache_key = f"ticker_mapping:{entity_lower}"
        async with self.redis.get_redis() as redis:
            cached_result = await redis.get(cache_key)
            if cached_result:
                # Return cached result (would need to deserialize)
                pass

        # 1. Direct ticker symbol (if already a valid ticker)
        if entity_text.isupper() and 1 <= len(entity_text) <= 5:
            if await self._validate_ticker(entity_text):
                company_name = await self._get_company_name(entity_text)
                candidates.append(TickerCandidate(
                    ticker=entity_text,
                    company_name=company_name or entity_text,
                    confidence=0.95,
                    match_type='exact'
                ))

        # 2. Known mappings
        if entity_lower in self.known_mappings:
            ticker = self.known_mappings[entity_lower]
            company_name = await self._get_company_name(ticker)
            candidates.append(TickerCandidate(
                ticker=ticker,
                company_name=company_name or entity_text,
                confidence=0.9,
                match_type='exact'
            ))

        # 3. Company aliases
        if entity_lower in self.company_aliases:
            ticker = self.company_aliases[entity_lower]
            company_name = await self._get_company_name(ticker)
            candidates.append(TickerCandidate(
                ticker=ticker,
                company_name=company_name or entity_text,
                confidence=0.85,
                match_type='alias'
            ))

        # 4. Fuzzy matching against known company names
        fuzzy_matches = await self._fuzzy_match_company_name(entity_text)
        candidates.extend(fuzzy_matches)

        # Cache results
        async with self.redis.get_redis() as redis:
            await redis.setex(cache_key, self.cache_expiry, "cached")  # Simplified caching

        return candidates

    async def _validate_ticker(self, ticker: str) -> bool:
        """Validate if a ticker symbol exists"""
        try:
            # Use yfinance to validate ticker
            stock = yf.Ticker(ticker)
            info = stock.info
            return 'symbol' in info or 'shortName' in info
        except Exception:
            return False

    async def _get_company_name(self, ticker: str) -> Optional[str]:
        """Get company name for a ticker symbol"""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            return info.get('longName') or info.get('shortName')
        except Exception:
            return None

    async def _fuzzy_match_company_name(self, entity_text: str) -> List[TickerCandidate]:
        """Perform fuzzy matching against known company names"""
        candidates = []

        # Get list of known company names from our mappings
        company_names = list(self.known_mappings.keys())

        # Use fuzzy matching to find similar names
        matches = process.extract(entity_text.lower(), company_names, limit=3, scorer=fuzz.ratio)

        for match_name, score in matches:
            if score >= 80:  # Minimum similarity threshold
                ticker = self.known_mappings[match_name]
                confidence = (score / 100.0) * 0.8  # Scale down confidence for fuzzy matches

                candidates.append(TickerCandidate(
                    ticker=ticker,
                    company_name=match_name.title(),
                    confidence=confidence,
                    match_type='fuzzy'
                ))

        return candidates


class SentimentAnalyzer:
    """Analyzes sentiment of financial content"""

    def __init__(self):
        self.sentiment_analyzer = SentimentIntensityAnalyzer()

        # Financial sentiment lexicon (simplified)
        self.bullish_terms = [
            'buy', 'bull', 'bullish', 'rise', 'up', 'gain', 'profit', 'growth',
            'strong', 'positive', 'outperform', 'beat', 'exceed', 'moon', 'rocket'
        ]

        self.bearish_terms = [
            'sell', 'bear', 'bearish', 'fall', 'down', 'loss', 'decline', 'weak',
            'negative', 'underperform', 'miss', 'crash', 'dump', 'tank'
        ]

    def analyze_sentiment(self, content: str, content_id: str) -> SentimentScore:
        """Analyze sentiment of content"""
        # Use NLTK VADER sentiment analyzer
        scores = self.sentiment_analyzer.polarity_scores(content)

        # Adjust scores based on financial terms
        financial_adjustment = self._calculate_financial_sentiment_adjustment(content)

        # Apply financial adjustment
        compound_score = scores['compound'] + financial_adjustment
        compound_score = max(-1.0, min(1.0, compound_score))  # Clamp to [-1, 1]

        # Determine polarity
        if compound_score >= 0.5:
            polarity = SentimentPolarity.VERY_POSITIVE
        elif compound_score >= 0.1:
            polarity = SentimentPolarity.POSITIVE
        elif compound_score <= -0.5:
            polarity = SentimentPolarity.VERY_NEGATIVE
        elif compound_score <= -0.1:
            polarity = SentimentPolarity.NEGATIVE
        else:
            polarity = SentimentPolarity.NEUTRAL

        # Calculate confidence based on score magnitude
        confidence_score = min(abs(compound_score) + 0.2, 1.0)

        return SentimentScore(
            content_id=content_id,
            polarity=polarity,
            compound_score=compound_score,
            positive_score=scores['pos'],
            negative_score=scores['neg'],
            neutral_score=scores['neu'],
            confidence_score=confidence_score,
            processing_metadata={
                'financial_adjustment': financial_adjustment,
                'original_compound': scores['compound']
            }
        )

    def _calculate_financial_sentiment_adjustment(self, content: str) -> float:
        """Calculate sentiment adjustment based on financial terms"""
        content_lower = content.lower()

        bullish_count = sum(1 for term in self.bullish_terms if term in content_lower)
        bearish_count = sum(1 for term in self.bearish_terms if term in content_lower)

        # Calculate adjustment (-0.2 to +0.2 range)
        net_sentiment = bullish_count - bearish_count
        total_terms = bullish_count + bearish_count

        if total_terms == 0:
            return 0.0

        # Normalize and scale
        adjustment = (net_sentiment / total_terms) * 0.2
        return adjustment

    def analyze_entity_sentiment(
        self,
        content: str,
        entity: EntityExtraction,
        content_id: str
    ) -> EntitySentiment:
        """Analyze sentiment specifically around an entity mention"""
        # Extract context window around entity
        start = max(0, entity.start_position - 100)
        end = min(len(content), entity.end_position + 100)
        context_window = content[start:end]

        # Analyze sentiment of context
        context_scores = self.sentiment_analyzer.polarity_scores(context_window)

        # Calculate relevance based on proximity to financial terms
        relevance_score = self._calculate_entity_relevance(context_window, entity.entity_text)

        return EntitySentiment(
            content_id=content_id,
            entity_id=entity.entity_id,
            sentiment_score=context_scores['compound'],
            confidence_score=min(abs(context_scores['compound']) + 0.3, 1.0),
            context_window=context_window,
            relevance_score=relevance_score
        )

    def _calculate_entity_relevance(self, context: str, entity_text: str) -> float:
        """Calculate how relevant the entity mention is to financial discussion"""
        context_lower = context.lower()
        entity_lower = entity_text.lower()

        # Check for financial keywords near the entity
        financial_keywords = [
            'stock', 'share', 'price', 'market', 'trading', 'investment',
            'earnings', 'revenue', 'profit', 'loss', 'buy', 'sell'
        ]

        keyword_count = sum(1 for keyword in financial_keywords if keyword in context_lower)

        # Base relevance
        relevance = min(keyword_count / 3.0, 1.0)

        # Boost if entity appears multiple times
        entity_mentions = context_lower.count(entity_lower)
        if entity_mentions > 1:
            relevance += 0.1

        return min(relevance, 1.0)


class NLPPipeline:
    """Main NLP pipeline that coordinates entity extraction, mapping, and sentiment analysis"""

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.entity_extractor = FinancialEntityExtractor()
        self.ticker_mapper = TickerMapper(redis_service)
        self.sentiment_analyzer = SentimentAnalyzer()

    async def process_content(self, content_item: RawContentItem) -> Dict[str, Any]:
        """Process a content item through the full NLP pipeline"""
        results = {
            'content_id': content_item.content_id,
            'entities': [],
            'ticker_mappings': [],
            'sentiment_score': None,
            'entity_sentiments': [],
            'processing_metadata': {}
        }

        start_time = datetime.utcnow()

        try:
            # Extract entities
            entities = self.entity_extractor.extract_entities(
                content_item.content,
                content_item.content_id
            )
            results['entities'] = entities

            # Map entities to tickers
            ticker_mappings = await self.ticker_mapper.map_entities_to_tickers(entities)
            results['ticker_mappings'] = ticker_mappings

            # Analyze overall sentiment
            sentiment_score = self.sentiment_analyzer.analyze_sentiment(
                content_item.content,
                content_item.content_id
            )
            results['sentiment_score'] = sentiment_score

            # Analyze entity-specific sentiment
            entity_sentiments = []
            for entity in entities:
                if entity.entity_type in [EntityType.COMPANY, EntityType.TICKER, EntityType.ORGANIZATION]:
                    entity_sentiment = self.sentiment_analyzer.analyze_entity_sentiment(
                        content_item.content,
                        entity,
                        content_item.content_id
                    )
                    entity_sentiments.append(entity_sentiment)
            results['entity_sentiments'] = entity_sentiments

            # Add ticker symbols to entity sentiments
            for entity_sentiment in entity_sentiments:
                # Find corresponding ticker mappings
                for mapping in ticker_mappings:
                    if mapping.entity_text == entity_sentiment.entity_id:
                        entity_sentiment.ticker_symbol = mapping.ticker_symbol
                        break

        except Exception as e:
            logger.error(f"Error processing content {content_item.content_id}: {str(e)}")
            results['processing_metadata']['error'] = str(e)

        finally:
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds() * 1000
            results['processing_metadata']['processing_time_ms'] = processing_time
            results['processing_metadata']['entity_count'] = len(results['entities'])
            results['processing_metadata']['ticker_mapping_count'] = len(results['ticker_mappings'])

        return results

    async def batch_process_content(self, content_items: List[RawContentItem]) -> List[Dict[str, Any]]:
        """Process multiple content items in parallel"""
        tasks = [self.process_content(item) for item in content_items]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions in results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error processing content item {i}: {str(result)}")
                processed_results.append({
                    'content_id': content_items[i].content_id,
                    'error': str(result)
                })
            else:
                processed_results.append(result)

        return processed_results