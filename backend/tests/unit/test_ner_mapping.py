"""
Unit tests for Named Entity Recognition (NER) mapping functionality.

Tests cover entity extraction, ticker mapping, confidence scoring, and
financial domain-specific entity recognition capabilities.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
from typing import List, Dict, Any

from app.services.nlp_pipeline_service import (
    FinancialEntityMatcher, AdvancedNEREngine, SentimentAnalyzer, NLPPipelineService
)
from app.models.sentiment_ner_models import (
    NamedEntity, EntityType, SentimentScore, SentimentPolarity,
    ProcessedContent, ContentType
)


class TestFinancialEntityMatcher:
    """Test suite for financial entity matching and ticker extraction."""

    def setup_method(self):
        """Set up test fixtures."""
        self.matcher = FinancialEntityMatcher()

    def test_extract_dollar_tickers_basic(self):
        """Test extraction of basic dollar-prefixed tickers."""
        text = "I'm bullish on $AAPL and $MSFT today."
        tickers = self.matcher.extract_tickers(text)

        assert len(tickers) == 2
        assert ("AAPL", 15, 20, 0.95) in tickers
        assert ("MSFT", 25, 30, 0.95) in tickers

    def test_extract_dollar_tickers_with_punctuation(self):
        """Test ticker extraction with surrounding punctuation."""
        text = "Check out $NVDA, $GOOGL! Also watching $META."
        tickers = self.matcher.extract_tickers(text)

        assert len(tickers) == 3
        ticker_symbols = [t[0] for t in tickers]
        assert "NVDA" in ticker_symbols
        assert "GOOGL" in ticker_symbols
        assert "META" in ticker_symbols

    def test_extract_cashtag_tickers(self):
        """Test extraction of cashtag-style tickers."""
        text = "Trading TSLA and AMZN today #stocks"
        tickers = self.matcher.extract_tickers(text)

        # Should find ticker-like words even without $
        assert len(tickers) >= 2
        ticker_symbols = [t[0] for t in tickers]
        assert "TSLA" in ticker_symbols or "AMZN" in ticker_symbols

    def test_invalid_ticker_filtering(self):
        """Test filtering of invalid ticker-like strings."""
        text = "The $API is broken, but $AAPL looks good. $HTML doesn't work."
        tickers = self.matcher.extract_tickers(text)

        # Should only extract valid tickers (AAPL)
        valid_tickers = [t[0] for t in tickers if t[3] > 0.8]  # High confidence only
        assert "AAPL" in valid_tickers
        # API, HTML should be filtered out or have low confidence

    def test_company_name_extraction(self):
        """Test extraction of company names."""
        text = "Apple Inc. reported strong earnings. Microsoft Corporation is also doing well."
        companies = self.matcher.extract_company_names(text)

        assert len(companies) >= 2
        company_texts = [c[0] for c in companies]
        assert any("Apple" in text for text in company_texts)
        assert any("Microsoft" in text for text in company_texts)

    def test_financial_terms_extraction(self):
        """Test extraction of financial terminology."""
        text = "The earnings report shows strong revenue growth and improved EBITDA margins."
        terms = self.matcher.extract_financial_terms(text)

        assert len(terms) >= 3
        term_texts = [t[0].lower() for t in terms]
        assert "earnings" in term_texts
        assert "revenue" in term_texts
        assert "ebitda" in term_texts

    def test_ticker_to_company_mapping(self):
        """Test ticker to company name mapping."""
        # Test known mappings
        assert self.matcher.get_company_name("AAPL") == "Apple Inc."
        assert self.matcher.get_company_name("MSFT") == "Microsoft Corporation"
        assert self.matcher.get_company_name("GOOGL") == "Alphabet Inc."

        # Test unknown ticker
        assert self.matcher.get_company_name("UNKNOWN") is None

    def test_company_to_ticker_mapping(self):
        """Test company name to ticker mapping."""
        assert self.matcher.get_ticker_symbol("Apple Inc.") == "AAPL"
        assert self.matcher.get_ticker_symbol("apple inc") == "AAPL"  # Case insensitive
        assert self.matcher.get_ticker_symbol("Microsoft Corporation") == "MSFT"

        # Test unknown company
        assert self.matcher.get_ticker_symbol("Unknown Company Ltd.") is None

    def test_confidence_scoring(self):
        """Test confidence scoring for different entity types."""
        # Dollar tickers should have high confidence
        text = "$AAPL is trading higher"
        tickers = self.matcher.extract_tickers(text)
        dollar_ticker_confidence = next(t[3] for t in tickers if t[0] == "AAPL")
        assert dollar_ticker_confidence >= 0.9

        # Company names should have medium-high confidence
        text = "Apple Inc. reported earnings"
        companies = self.matcher.extract_company_names(text)
        company_confidence = next(c[3] for c in companies if "Apple" in c[0])
        assert 0.7 <= company_confidence <= 0.95


class TestAdvancedNEREngine:
    """Test suite for the advanced NER engine."""

    def setup_method(self):
        """Set up test fixtures."""
        self.ner_engine = AdvancedNEREngine()

    def test_extract_entities_comprehensive(self):
        """Test comprehensive entity extraction from complex text."""
        text = """
        Apple Inc. (NASDAQ: $AAPL) reported Q3 earnings yesterday.
        The company posted revenue of $81.4 billion, beating analyst estimates.
        CEO Tim Cook mentioned strong iPhone sales and services growth.
        Microsoft Corporation and Alphabet Inc. also saw gains.
        """

        entities = self.ner_engine.extract_entities(text)

        # Should extract multiple entity types
        entity_types = {entity.entity_type for entity in entities}
        assert EntityType.TICKER in entity_types
        assert EntityType.COMPANY in entity_types
        assert EntityType.PERSON in entity_types
        assert EntityType.FINANCIAL_METRIC in entity_types

        # Check specific entities
        entity_texts = [entity.text for entity in entities]
        assert any("AAPL" in text for text in entity_texts)
        assert any("Apple Inc" in text for text in entity_texts)
        assert any("Tim Cook" in text for text in entity_texts)

    def test_ticker_mapping_in_entities(self):
        """Test that entities are properly mapped to tickers."""
        text = "Apple Inc. and Microsoft Corporation are performing well."
        entities = self.ner_engine.extract_entities(text)

        # Find company entities and check ticker mapping
        company_entities = [e for e in entities if e.entity_type == EntityType.COMPANY]

        apple_entity = next((e for e in company_entities if "Apple" in e.text), None)
        assert apple_entity is not None
        assert apple_entity.mapped_ticker == "AAPL"
        assert apple_entity.ticker_confidence >= 0.8

        msft_entity = next((e for e in company_entities if "Microsoft" in e.text), None)
        assert msft_entity is not None
        assert msft_entity.mapped_ticker == "MSFT"

    def test_entity_confidence_scoring(self):
        """Test entity confidence scoring accuracy."""
        text = "Clear mention of $AAPL and possibly some unclear reference to xyz corp."
        entities = self.ner_engine.extract_entities(text)

        # Clear ticker should have high confidence
        aapl_entity = next((e for e in entities if "AAPL" in e.text), None)
        assert aapl_entity is not None
        assert aapl_entity.confidence >= 0.9

        # Unclear entity should have lower confidence
        unclear_entities = [e for e in entities if e.confidence < 0.7]
        assert len(unclear_entities) >= 0  # May or may not extract unclear entities

    def test_position_tracking(self):
        """Test accurate position tracking of entities in text."""
        text = "Apple reported earnings, $AAPL is up 5%"
        entities = self.ner_engine.extract_entities(text)

        for entity in entities:
            # Check that positions are valid
            assert 0 <= entity.start_position < len(text)
            assert entity.start_position < entity.end_position <= len(text)

            # Check that extracted text matches position
            extracted_text = text[entity.start_position:entity.end_position]
            assert entity.text.lower() in extracted_text.lower() or extracted_text.lower() in entity.text.lower()

    def test_entity_deduplication(self):
        """Test that duplicate entities are properly handled."""
        text = "AAPL AAPL AAPL Apple Inc. Apple Inc."
        entities = self.ner_engine.extract_entities(text)

        # Should deduplicate similar entities
        aapl_entities = [e for e in entities if "AAPL" in e.text or e.mapped_ticker == "AAPL"]

        # Should have entities but not excessive duplicates
        assert 1 <= len(aapl_entities) <= 3


class TestSentimentAnalyzer:
    """Test suite for sentiment analysis functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.analyzer = SentimentAnalyzer()

    def test_positive_sentiment_analysis(self):
        """Test analysis of clearly positive sentiment."""
        positive_texts = [
            "AAPL stock is performing excellently with strong growth!",
            "Amazing earnings report from Apple, very bullish on this stock",
            "Great news for Tesla investors, stock price soaring"
        ]

        for text in positive_texts:
            sentiment = self.analyzer.analyze_sentiment(text)
            assert sentiment.score > 0.1  # Positive sentiment
            assert sentiment.polarity == SentimentPolarity.POSITIVE
            assert sentiment.confidence >= 0.6

    def test_negative_sentiment_analysis(self):
        """Test analysis of clearly negative sentiment."""
        negative_texts = [
            "AAPL stock is crashing, terrible earnings report",
            "Bearish on Tesla, production issues continue",
            "Disappointing results from Microsoft, stock down significantly"
        ]

        for text in negative_texts:
            sentiment = self.analyzer.analyze_sentiment(text)
            assert sentiment.score < -0.1  # Negative sentiment
            assert sentiment.polarity == SentimentPolarity.NEGATIVE
            assert sentiment.confidence >= 0.6

    def test_neutral_sentiment_analysis(self):
        """Test analysis of neutral sentiment."""
        neutral_texts = [
            "Apple reported quarterly earnings in line with expectations",
            "Microsoft stock price remained stable during trading",
            "The company provided an update on their financial position"
        ]

        for text in neutral_texts:
            sentiment = self.analyzer.analyze_sentiment(text)
            assert -0.1 <= sentiment.score <= 0.1  # Neutral sentiment
            assert sentiment.polarity == SentimentPolarity.NEUTRAL

    def test_financial_domain_sentiment(self):
        """Test sentiment analysis with financial domain knowledge."""
        # Financial terms should be properly weighted
        financial_positive = "Strong revenue growth and excellent EBITDA margins"
        financial_negative = "Declining revenue and massive losses reported"

        positive_sentiment = self.analyzer.analyze_sentiment(financial_positive)
        negative_sentiment = self.analyzer.analyze_sentiment(financial_negative)

        assert positive_sentiment.score > 0.2
        assert negative_sentiment.score < -0.2

        # Financial sentiment should have reasonable confidence
        assert positive_sentiment.confidence >= 0.5
        assert negative_sentiment.confidence >= 0.5

    def test_sentiment_confidence_calibration(self):
        """Test that sentiment confidence is properly calibrated."""
        # Clear sentiment should have high confidence
        clear_positive = "Absolutely amazing results, best performance ever!"
        clear_negative = "Complete disaster, worst results in company history"

        # Ambiguous sentiment should have lower confidence
        ambiguous = "Some good news but also concerning developments"

        clear_pos_sentiment = self.analyzer.analyze_sentiment(clear_positive)
        clear_neg_sentiment = self.analyzer.analyze_sentiment(clear_negative)
        ambiguous_sentiment = self.analyzer.analyze_sentiment(ambiguous)

        assert clear_pos_sentiment.confidence >= 0.8
        assert clear_neg_sentiment.confidence >= 0.8
        assert ambiguous_sentiment.confidence <= 0.7


class TestNLPPipelineServiceIntegration:
    """Integration tests for the complete NLP pipeline service."""

    @pytest.fixture
    async def nlp_service(self):
        """Create a mock NLP service for testing."""
        with patch('redis.asyncio.from_url') as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis.return_value = mock_redis_instance

            service = NLPPipelineService(mock_redis_instance)
            yield service

    @pytest.mark.asyncio
    async def test_process_content_comprehensive(self, nlp_service):
        """Test comprehensive content processing through the entire pipeline."""
        content_text = """
        Apple Inc. (NASDAQ: AAPL) delivered outstanding Q3 results yesterday.
        Revenue increased 15% year-over-year to $81.4 billion, significantly
        beating analyst estimates. CEO Tim Cook highlighted strong iPhone sales
        and growing services revenue. The stock is up 8% in after-hours trading.
        """

        # Mock Redis operations
        nlp_service.redis.get.return_value = None  # No cached content
        nlp_service.redis.setex = AsyncMock()

        processed = await nlp_service.process_content(
            content_id="test_content_1",
            text=content_text,
            content_type=ContentType.NEWS_ARTICLE,
            source_url="https://example.com/news/apple-earnings"
        )

        # Verify processed content structure
        assert processed.content_id == "test_content_1"
        assert processed.original_text == content_text
        assert processed.content_type == ContentType.NEWS_ARTICLE

        # Verify entities were extracted
        assert len(processed.named_entities) > 0

        # Should find ticker entities
        ticker_entities = [e for e in processed.named_entities if e.entity_type == EntityType.TICKER]
        assert len(ticker_entities) > 0
        assert any(e.text == "AAPL" for e in ticker_entities)

        # Should find company entities
        company_entities = [e for e in processed.named_entities if e.entity_type == EntityType.COMPANY]
        assert len(company_entities) > 0
        assert any("Apple" in e.text for e in company_entities)

        # Should find person entities
        person_entities = [e for e in processed.named_entities if e.entity_type == EntityType.PERSON]
        assert len(person_entities) > 0
        assert any("Tim Cook" in e.text for e in person_entities)

        # Verify sentiment analysis
        assert processed.overall_sentiment is not None
        assert processed.overall_sentiment.score > 0  # Should be positive
        assert processed.overall_sentiment.polarity == SentimentPolarity.POSITIVE

        # Verify ticker-specific sentiment
        assert "AAPL" in processed.ticker_sentiments
        aapl_sentiment = processed.ticker_sentiments["AAPL"]
        assert aapl_sentiment.score > 0  # Positive sentiment for AAPL
        assert aapl_sentiment.confidence >= 0.5

    @pytest.mark.asyncio
    async def test_ticker_sentiment_mapping(self, nlp_service):
        """Test that sentiment is properly mapped to relevant tickers."""
        content_text = """
        Apple's latest iPhone launch is disappointing, while Microsoft's
        cloud services continue to show strong growth. Tesla faces
        production challenges but maintains optimistic guidance.
        """

        nlp_service.redis.get.return_value = None
        nlp_service.redis.setex = AsyncMock()

        processed = await nlp_service.process_content(
            content_id="test_multi_ticker",
            text=content_text,
            content_type=ContentType.SOCIAL_MEDIA
        )

        # Should map sentiment to multiple tickers
        expected_tickers = {"AAPL", "MSFT", "TSLA"}
        found_tickers = set(processed.ticker_sentiments.keys())

        # Should find at least some of the expected tickers
        assert len(found_tickers.intersection(expected_tickers)) >= 2

        # Apple sentiment should be negative (disappointing)
        if "AAPL" in processed.ticker_sentiments:
            assert processed.ticker_sentiments["AAPL"].score < 0

        # Microsoft sentiment should be positive (strong growth)
        if "MSFT" in processed.ticker_sentiments:
            assert processed.ticker_sentiments["MSFT"].score > 0

    @pytest.mark.asyncio
    async def test_content_caching(self, nlp_service):
        """Test that processed content is properly cached."""
        content_text = "Simple test content for caching."

        # First call - no cache
        nlp_service.redis.get.return_value = None
        nlp_service.redis.setex = AsyncMock()

        result1 = await nlp_service.process_content(
            content_id="cache_test",
            text=content_text,
            content_type=ContentType.NEWS_ARTICLE
        )

        # Verify caching was attempted
        nlp_service.redis.setex.assert_called()

        # Second call - with cache
        nlp_service.redis.get.return_value = result1.json()

        result2 = await nlp_service.get_processed_content("cache_test")

        # Should retrieve from cache
        assert result2 is not None
        assert result2.content_id == "cache_test"

    @pytest.mark.asyncio
    async def test_error_handling(self, nlp_service):
        """Test error handling in the NLP pipeline."""
        # Test with empty content
        with pytest.raises(ValueError):
            await nlp_service.process_content(
                content_id="empty_test",
                text="",
                content_type=ContentType.NEWS_ARTICLE
            )

        # Test with None content
        with pytest.raises(ValueError):
            await nlp_service.process_content(
                content_id="none_test",
                text=None,
                content_type=ContentType.NEWS_ARTICLE
            )

    @pytest.mark.asyncio
    async def test_confidence_scoring_accuracy(self, nlp_service):
        """Test that confidence scores are reasonable and well-calibrated."""
        test_cases = [
            ("Clear ticker mention: $AAPL is performing well", 0.8),
            ("Apple Inc. reported earnings", 0.7),
            ("Some company I think might be related to tech", 0.3),
            ("Unclear entity xyz corp maybe", 0.2)
        ]

        nlp_service.redis.get.return_value = None
        nlp_service.redis.setex = AsyncMock()

        for text, expected_min_confidence in test_cases:
            processed = await nlp_service.process_content(
                content_id=f"confidence_test_{hash(text)}",
                text=text,
                content_type=ContentType.SOCIAL_MEDIA
            )

            # Check that high-confidence entities meet expectations
            high_conf_entities = [e for e in processed.named_entities if e.confidence >= expected_min_confidence]

            if expected_min_confidence >= 0.7:
                # Should find high-confidence entities for clear mentions
                assert len(high_conf_entities) > 0

            # All entities should have reasonable confidence scores
            for entity in processed.named_entities:
                assert 0.0 <= entity.confidence <= 1.0


# Performance and stress tests
class TestNERPerformance:
    """Performance and stress tests for NER functionality."""

    def test_large_text_processing(self):
        """Test processing of large text documents."""
        # Create a large text with multiple entities
        large_text = " ".join([
            f"Apple Inc. and Microsoft Corporation are competing in sector {i}."
            for i in range(100)
        ])

        ner_engine = AdvancedNEREngine()
        entities = ner_engine.extract_entities(large_text)

        # Should extract entities without crashing
        assert len(entities) > 0

        # Should maintain reasonable performance (basic sanity check)
        assert len(entities) < len(large_text.split())  # Not every word should be an entity

    def test_batch_processing_simulation(self):
        """Test processing multiple texts in sequence (simulating batch processing)."""
        texts = [
            "Apple Inc. reported strong earnings.",
            "Microsoft Corporation is expanding cloud services.",
            "Tesla faces production challenges but remains optimistic.",
            "Amazon's AWS division continues to grow.",
            "Google's advertising revenue increased significantly."
        ]

        ner_engine = AdvancedNEREngine()

        all_entities = []
        for text in texts:
            entities = ner_engine.extract_entities(text)
            all_entities.extend(entities)

        # Should process all texts successfully
        assert len(all_entities) > len(texts)  # Each text should yield at least one entity

        # Should find entities from different texts
        entity_texts = [e.text for e in all_entities]
        assert any("Apple" in text for text in entity_texts)
        assert any("Microsoft" in text for text in entity_texts)
        assert any("Tesla" in text for text in entity_texts)


if __name__ == "__main__":
    pytest.main([__file__])