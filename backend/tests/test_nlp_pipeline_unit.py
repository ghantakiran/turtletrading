"""
Unit Tests for NLP Pipeline, NER, and Ticker Mapping

This module provides comprehensive unit tests for the sentiment analysis NLP pipeline
including entity extraction, ticker mapping, and sentiment analysis components.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
from typing import List, Dict, Any

from app.models.sentiment_ingestion_models import (
    RawContentItem,
    SentimentSource,
    ContentType,
    EntityType,
    SentimentPolarity
)
from app.services.nlp_pipeline import (
    FinancialEntityExtractor,
    TickerMapper,
    SentimentAnalyzer,
    NLPPipeline,
    EntityMatch,
    TickerCandidate
)


class TestFinancialEntityExtractor:
    """Test suite for the FinancialEntityExtractor class"""

    @pytest.fixture
    def extractor(self):
        """Create a FinancialEntityExtractor instance for testing"""
        return FinancialEntityExtractor()

    @pytest.fixture
    def sample_content_items(self):
        """Sample content items for testing"""
        return [
            {
                'content_id': 'test-1',
                'content': 'Apple Inc. (AAPL) reported strong Q3 earnings with CEO Tim Cook praising the team.',
                'expected_entities': [
                    {'text': 'AAPL', 'type': EntityType.TICKER},
                    {'text': 'Apple Inc.', 'type': EntityType.COMPANY},
                    {'text': 'Tim Cook', 'type': EntityType.PERSON}
                ]
            },
            {
                'content_id': 'test-2',
                'content': '$TSLA is up 5% after Elon Musk announced new factory in Texas.',
                'expected_entities': [
                    {'text': 'TSLA', 'type': EntityType.TICKER},
                    {'text': 'Elon Musk', 'type': EntityType.PERSON},
                    {'text': 'Texas', 'type': EntityType.LOCATION}
                ]
            },
            {
                'content_id': 'test-3',
                'content': 'Microsoft Corporation revenue reached $52.7 billion in Q2.',
                'expected_entities': [
                    {'text': 'Microsoft Corporation', 'type': EntityType.COMPANY},
                    {'text': '$52.7 billion', 'type': EntityType.CURRENCY}
                ]
            }
        ]

    def test_extract_ticker_symbols_cashtags(self, extractor):
        """Test extraction of ticker symbols from cashtags ($AAPL)"""
        content = "Trading $AAPL and $TSLA today. Also watching $GOOGL."
        content_id = "test-cashtags"

        entities = extractor.extract_entities(content, content_id)

        # Filter for ticker entities
        ticker_entities = [e for e in entities if e.entity_type == EntityType.TICKER]

        assert len(ticker_entities) >= 3

        # Check for expected tickers
        ticker_texts = [e.entity_text for e in ticker_entities]
        assert 'AAPL' in ticker_texts
        assert 'TSLA' in ticker_texts
        assert 'GOOGL' in ticker_texts

        # Check confidence scores for cashtags (should be high)
        for entity in ticker_entities:
            if entity.metadata.get('extraction_method') == 'cashtag_pattern':
                assert entity.confidence_score >= 0.9

    def test_extract_ticker_symbols_patterns(self, extractor):
        """Test extraction of ticker symbols from text patterns"""
        content = "AAPL stock is performing well. MSFT announced new products."
        content_id = "test-patterns"

        entities = extractor.extract_entities(content, content_id)
        ticker_entities = [e for e in entities if e.entity_type == EntityType.TICKER]

        ticker_texts = [e.entity_text for e in ticker_entities]
        assert 'AAPL' in ticker_texts
        assert 'MSFT' in ticker_texts

    def test_extract_company_names(self, extractor):
        """Test extraction of company names"""
        content = "Apple Inc. and Microsoft Corporation are leading tech companies."
        content_id = "test-companies"

        entities = extractor.extract_entities(content, content_id)
        company_entities = [e for e in entities if e.entity_type == EntityType.COMPANY]

        # Should find company names with Inc/Corporation suffixes
        company_texts = [e.entity_text for e in company_entities]
        assert any('Apple' in text for text in company_texts)
        assert any('Microsoft' in text for text in company_texts)

    def test_extract_person_names(self, extractor):
        """Test extraction of person names with titles"""
        content = "CEO Tim Cook and CFO Luca Maestri discussed quarterly results."
        content_id = "test-persons"

        entities = extractor.extract_entities(content, content_id)
        person_entities = [e for e in entities if e.entity_type == EntityType.PERSON]

        person_texts = [e.entity_text for e in person_entities]
        assert 'Tim Cook' in person_texts
        assert 'Luca Maestri' in person_texts

        # Check metadata includes titles
        for entity in person_entities:
            if entity.entity_text == 'Tim Cook':
                assert entity.metadata.get('title') == 'ceo'

    def test_extract_financial_terms(self, extractor):
        """Test extraction of financial terms and currencies"""
        content = "Revenue was $50.5 billion, up from $45 million last quarter."
        content_id = "test-financial"

        entities = extractor.extract_entities(content, content_id)
        currency_entities = [e for e in entities if e.entity_type == EntityType.CURRENCY]

        currency_texts = [e.entity_text for e in currency_entities]
        assert '$50.5 billion' in currency_texts
        assert '$45 million' in currency_texts

    def test_entity_deduplication(self, extractor):
        """Test that overlapping entities are properly deduplicated"""
        content = "Apple Inc. (AAPL) is a great company. AAPL stock is up."
        content_id = "test-dedup"

        entities = extractor.extract_entities(content, content_id)

        # Check that entities don't overlap inappropriately
        entities.sort(key=lambda x: x.start_position)

        for i in range(len(entities) - 1):
            current = entities[i]
            next_entity = entities[i + 1]

            # Entities should not overlap (unless one contains the other appropriately)
            if current.end_position > next_entity.start_position:
                # If they overlap, the higher confidence one should be kept
                assert current.confidence_score != next_entity.confidence_score

    def test_confidence_scoring(self, extractor):
        """Test that confidence scores are reasonable"""
        content = "$AAPL CEO Tim Cook discussed stock market trends."
        content_id = "test-confidence"

        entities = extractor.extract_entities(content, content_id)

        for entity in entities:
            # All confidence scores should be between 0 and 1
            assert 0 <= entity.confidence_score <= 1

            # Cashtags should have higher confidence than pattern matches
            if entity.entity_text == 'AAPL' and entity.metadata.get('extraction_method') == 'cashtag_pattern':
                assert entity.confidence_score >= 0.9

    @pytest.mark.parametrize("content_item", [0, 1, 2])
    def test_comprehensive_extraction(self, extractor, sample_content_items, content_item):
        """Test comprehensive entity extraction on sample content"""
        item = sample_content_items[content_item]

        entities = extractor.extract_entities(item['content'], item['content_id'])

        # Check that we extract at least some entities
        assert len(entities) > 0

        # Check that expected entity types are found
        entity_types = set(e.entity_type for e in entities)
        expected_types = set(e['type'] for e in item['expected_entities'])

        # Should find at least some of the expected types
        assert len(entity_types.intersection(expected_types)) > 0


class TestTickerMapper:
    """Test suite for the TickerMapper class"""

    @pytest.fixture
    def redis_service_mock(self):
        """Mock Redis service for testing"""
        mock_redis = AsyncMock()
        mock_redis.get_redis.return_value.__aenter__.return_value = AsyncMock()
        return mock_redis

    @pytest.fixture
    def ticker_mapper(self, redis_service_mock):
        """Create a TickerMapper instance for testing"""
        return TickerMapper(redis_service_mock)

    @pytest.fixture
    def sample_entities(self):
        """Sample entities for ticker mapping tests"""
        from app.models.sentiment_ingestion_models import EntityExtraction

        return [
            EntityExtraction(
                content_id="test-1",
                entity_text="Apple",
                entity_type=EntityType.COMPANY,
                confidence_score=0.9,
                start_position=0,
                end_position=5
            ),
            EntityExtraction(
                content_id="test-1",
                entity_text="AAPL",
                entity_type=EntityType.TICKER,
                confidence_score=0.95,
                start_position=10,
                end_position=14
            ),
            EntityExtraction(
                content_id="test-1",
                entity_text="Microsoft",
                entity_type=EntityType.COMPANY,
                confidence_score=0.85,
                start_position=20,
                end_position=29
            )
        ]

    @pytest.mark.asyncio
    async def test_direct_ticker_validation(self, ticker_mapper):
        """Test validation of direct ticker symbols"""
        # Test valid ticker
        with patch.object(ticker_mapper, '_validate_ticker', return_value=True):
            with patch.object(ticker_mapper, '_get_company_name', return_value="Apple Inc."):
                candidates = await ticker_mapper._find_ticker_candidates("AAPL")

                assert len(candidates) > 0
                assert any(c.ticker == "AAPL" for c in candidates)
                assert any(c.match_type == 'exact' for c in candidates)

    @pytest.mark.asyncio
    async def test_known_company_mapping(self, ticker_mapper):
        """Test mapping of known company names to tickers"""
        with patch.object(ticker_mapper, '_get_company_name', return_value="Apple Inc."):
            candidates = await ticker_mapper._find_ticker_candidates("apple")

            assert len(candidates) > 0
            apple_candidate = next((c for c in candidates if c.ticker == "AAPL"), None)
            assert apple_candidate is not None
            assert apple_candidate.match_type == 'exact'
            assert apple_candidate.confidence >= 0.8

    @pytest.mark.asyncio
    async def test_company_aliases(self, ticker_mapper):
        """Test mapping of company aliases"""
        with patch.object(ticker_mapper, '_get_company_name', return_value="Alphabet Inc."):
            candidates = await ticker_mapper._find_ticker_candidates("goog")

            assert len(candidates) > 0
            alias_candidate = next((c for c in candidates if c.match_type == 'alias'), None)
            assert alias_candidate is not None

    @pytest.mark.asyncio
    async def test_fuzzy_matching(self, ticker_mapper):
        """Test fuzzy matching of company names"""
        with patch.object(ticker_mapper, '_fuzzy_match_company_name') as mock_fuzzy:
            mock_fuzzy.return_value = [
                TickerCandidate(
                    ticker="AAPL",
                    company_name="Apple",
                    confidence=0.85,
                    match_type="fuzzy"
                )
            ]

            candidates = await ticker_mapper._find_ticker_candidates("Aple")  # Typo

            mock_fuzzy.assert_called_once_with("Aple")
            assert len(candidates) > 0

    @pytest.mark.asyncio
    async def test_entity_to_ticker_mapping(self, ticker_mapper, sample_entities):
        """Test complete entity to ticker mapping process"""
        with patch.object(ticker_mapper, '_find_ticker_candidates') as mock_find:
            mock_find.return_value = [
                TickerCandidate(
                    ticker="AAPL",
                    company_name="Apple Inc.",
                    confidence=0.9,
                    match_type="exact"
                )
            ]

            mappings = await ticker_mapper.map_entities_to_tickers(sample_entities)

            assert len(mappings) > 0

            # Check that mappings have correct structure
            for mapping in mappings:
                assert hasattr(mapping, 'ticker_symbol')
                assert hasattr(mapping, 'confidence_score')
                assert hasattr(mapping, 'mapping_source')
                assert 0 <= mapping.confidence_score <= 1

    @pytest.mark.asyncio
    async def test_confidence_adjustment(self, ticker_mapper, sample_entities):
        """Test that final confidence is adjusted based on entity confidence"""
        with patch.object(ticker_mapper, '_find_ticker_candidates') as mock_find:
            mock_find.return_value = [
                TickerCandidate(
                    ticker="AAPL",
                    company_name="Apple Inc.",
                    confidence=0.8,
                    match_type="exact"
                )
            ]

            # Use entity with lower confidence
            low_confidence_entity = sample_entities[0]
            low_confidence_entity.confidence_score = 0.5

            mappings = await ticker_mapper.map_entities_to_tickers([low_confidence_entity])

            # Final confidence should be adjusted down
            if mappings:
                assert mappings[0].confidence_score <= 0.5 * 0.8


class TestSentimentAnalyzer:
    """Test suite for the SentimentAnalyzer class"""

    @pytest.fixture
    def analyzer(self):
        """Create a SentimentAnalyzer instance for testing"""
        return SentimentAnalyzer()

    @pytest.fixture
    def sample_content(self):
        """Sample content for sentiment analysis testing"""
        return [
            {
                'content': 'AAPL stock is performing excellently! Great earnings beat expectations.',
                'expected_polarity': SentimentPolarity.POSITIVE,
                'expected_range': (0.2, 1.0)
            },
            {
                'content': 'TSLA stock crashed today. Terrible performance and disappointing results.',
                'expected_polarity': SentimentPolarity.NEGATIVE,
                'expected_range': (-1.0, -0.2)
            },
            {
                'content': 'MSFT announced quarterly results. Revenue was in line with expectations.',
                'expected_polarity': SentimentPolarity.NEUTRAL,
                'expected_range': (-0.2, 0.2)
            },
            {
                'content': 'GOOGL stock is soaring! Incredible growth and massive profits!',
                'expected_polarity': SentimentPolarity.VERY_POSITIVE,
                'expected_range': (0.5, 1.0)
            },
            {
                'content': 'META stock is tanking badly. Huge losses and terrible outlook.',
                'expected_polarity': SentimentPolarity.VERY_NEGATIVE,
                'expected_range': (-1.0, -0.5)
            }
        ]

    def test_basic_sentiment_analysis(self, analyzer, sample_content):
        """Test basic sentiment analysis functionality"""
        for i, item in enumerate(sample_content):
            content_id = f"test-{i}"

            sentiment_score = analyzer.analyze_sentiment(item['content'], content_id)

            # Check basic structure
            assert hasattr(sentiment_score, 'compound_score')
            assert hasattr(sentiment_score, 'polarity')
            assert hasattr(sentiment_score, 'confidence_score')

            # Check score ranges
            assert -1.0 <= sentiment_score.compound_score <= 1.0
            assert 0.0 <= sentiment_score.confidence_score <= 1.0

            # Check polarity assignment
            assert sentiment_score.polarity == item['expected_polarity']

            # Check score is in expected range
            min_score, max_score = item['expected_range']
            assert min_score <= sentiment_score.compound_score <= max_score

    def test_financial_sentiment_adjustment(self, analyzer):
        """Test that financial terms influence sentiment scoring"""
        bullish_content = "AAPL is a strong buy with bullish outlook and growth potential."
        bearish_content = "TSLA is a sell with bearish sentiment and declining performance."

        bullish_score = analyzer.analyze_sentiment(bullish_content, "bullish-test")
        bearish_score = analyzer.analyze_sentiment(bearish_content, "bearish-test")

        # Bullish content should have positive adjustment
        assert bullish_score.compound_score > 0

        # Bearish content should have negative adjustment
        assert bearish_score.compound_score < 0

        # Check that financial adjustment was applied
        assert 'financial_adjustment' in bullish_score.processing_metadata
        assert 'financial_adjustment' in bearish_score.processing_metadata

    def test_entity_sentiment_analysis(self, analyzer):
        """Test entity-specific sentiment analysis"""
        from app.models.sentiment_ingestion_models import EntityExtraction

        content = "Apple Inc. reported strong earnings but Tesla disappointed investors."
        content_id = "entity-sentiment-test"

        # Create mock entities
        apple_entity = EntityExtraction(
            content_id=content_id,
            entity_text="Apple Inc.",
            entity_type=EntityType.COMPANY,
            confidence_score=0.9,
            start_position=0,
            end_position=10
        )

        tesla_entity = EntityExtraction(
            content_id=content_id,
            entity_text="Tesla",
            entity_type=EntityType.COMPANY,
            confidence_score=0.85,
            start_position=50,
            end_position=55
        )

        apple_sentiment = analyzer.analyze_entity_sentiment(content, apple_entity, content_id)
        tesla_sentiment = analyzer.analyze_entity_sentiment(content, tesla_entity, content_id)

        # Apple should have positive sentiment (strong earnings)
        assert apple_sentiment.sentiment_score > 0

        # Tesla should have negative sentiment (disappointed investors)
        assert tesla_sentiment.sentiment_score < 0

        # Check relevance scores
        assert 0 <= apple_sentiment.relevance_score <= 1
        assert 0 <= tesla_sentiment.relevance_score <= 1

    def test_confidence_scoring(self, analyzer):
        """Test sentiment confidence scoring"""
        # Strong sentiment should have higher confidence
        strong_positive = "AAPL is absolutely amazing! Best stock ever!"
        weak_positive = "AAPL is okay, I guess."

        strong_score = analyzer.analyze_sentiment(strong_positive, "strong-test")
        weak_score = analyzer.analyze_sentiment(weak_positive, "weak-test")

        # Strong sentiment should have higher confidence
        assert strong_score.confidence_score > weak_score.confidence_score

    def test_score_normalization(self, analyzer):
        """Test that sentiment scores are properly normalized"""
        content = "This is extremely, incredibly, massively positive news! " * 10
        content_id = "normalization-test"

        sentiment_score = analyzer.analyze_sentiment(content, content_id)

        # Even with extreme language, scores should be bounded
        assert -1.0 <= sentiment_score.compound_score <= 1.0
        assert 0.0 <= sentiment_score.positive_score <= 1.0
        assert 0.0 <= sentiment_score.negative_score <= 1.0
        assert 0.0 <= sentiment_score.neutral_score <= 1.0

        # Positive, negative, and neutral should sum to approximately 1
        total = sentiment_score.positive_score + sentiment_score.negative_score + sentiment_score.neutral_score
        assert 0.99 <= total <= 1.01


class TestNLPPipeline:
    """Test suite for the complete NLP Pipeline"""

    @pytest.fixture
    def redis_service_mock(self):
        """Mock Redis service for testing"""
        mock_redis = AsyncMock()
        mock_redis.get_redis.return_value.__aenter__.return_value = AsyncMock()
        return mock_redis

    @pytest.fixture
    def nlp_pipeline(self, redis_service_mock):
        """Create an NLPPipeline instance for testing"""
        return NLPPipeline(redis_service_mock)

    @pytest.fixture
    def sample_content_item(self):
        """Sample content item for pipeline testing"""
        return RawContentItem(
            source=SentimentSource.NEWS_API,
            content_type=ContentType.ARTICLE,
            title="Apple Reports Strong Q3 Earnings",
            content="Apple Inc. (AAPL) reported strong Q3 earnings today. CEO Tim Cook praised the team's performance.",
            published_at=datetime.utcnow(),
            source_url="https://example.com/apple-earnings",
            source_id="test-123"
        )

    @pytest.mark.asyncio
    async def test_complete_pipeline_processing(self, nlp_pipeline, sample_content_item):
        """Test complete NLP pipeline processing"""
        with patch.object(nlp_pipeline.ticker_mapper, 'map_entities_to_tickers') as mock_ticker_mapping:
            mock_ticker_mapping.return_value = [
                # Mock ticker mapping result
                type('MockMapping', (), {
                    'entity_text': 'Apple Inc.',
                    'ticker_symbol': 'AAPL',
                    'confidence_score': 0.9
                })()
            ]

            result = await nlp_pipeline.process_content(sample_content_item)

            # Check result structure
            assert 'content_id' in result
            assert 'entities' in result
            assert 'ticker_mappings' in result
            assert 'sentiment_score' in result
            assert 'entity_sentiments' in result
            assert 'processing_metadata' in result

            # Check that entities were extracted
            assert len(result['entities']) > 0

            # Check that sentiment was analyzed
            assert result['sentiment_score'] is not None

            # Check processing metadata
            assert 'processing_time_ms' in result['processing_metadata']
            assert 'entity_count' in result['processing_metadata']

    @pytest.mark.asyncio
    async def test_batch_processing(self, nlp_pipeline):
        """Test batch processing of multiple content items"""
        content_items = [
            RawContentItem(
                source=SentimentSource.NEWS_API,
                content_type=ContentType.ARTICLE,
                title=f"Test Article {i}",
                content=f"This is test content for article {i} about AAPL stock.",
                published_at=datetime.utcnow(),
                source_url=f"https://example.com/article-{i}",
                source_id=f"test-{i}"
            )
            for i in range(3)
        ]

        with patch.object(nlp_pipeline.ticker_mapper, 'map_entities_to_tickers', return_value=[]):
            results = await nlp_pipeline.batch_process_content(content_items)

            # Should get results for all items
            assert len(results) == len(content_items)

            # Each result should have the expected structure
            for result in results:
                if 'error' not in result:  # Skip error results
                    assert 'content_id' in result
                    assert 'entities' in result
                    assert 'sentiment_score' in result

    @pytest.mark.asyncio
    async def test_error_handling(self, nlp_pipeline):
        """Test error handling in pipeline processing"""
        # Create content item that might cause errors
        problematic_item = RawContentItem(
            source=SentimentSource.NEWS_API,
            content_type=ContentType.ARTICLE,
            title="",  # Empty title
            content="",  # Empty content
            published_at=datetime.utcnow(),
            source_url="invalid-url",
            source_id="error-test"
        )

        result = await nlp_pipeline.process_content(problematic_item)

        # Should handle gracefully without crashing
        assert 'content_id' in result

        # May have error in metadata or reduced results
        if 'error' in result['processing_metadata']:
            assert isinstance(result['processing_metadata']['error'], str)

    @pytest.mark.asyncio
    async def test_ticker_mapping_integration(self, nlp_pipeline, sample_content_item):
        """Test integration between entity extraction and ticker mapping"""
        # Mock the ticker mapping to return specific results
        with patch.object(nlp_pipeline.ticker_mapper, 'map_entities_to_tickers') as mock_mapping:
            mock_mapping.return_value = [
                type('MockMapping', (), {
                    'entity_text': 'AAPL',
                    'ticker_symbol': 'AAPL',
                    'confidence_score': 0.95,
                    'mapping_source': 'exact'
                })()
            ]

            result = await nlp_pipeline.process_content(sample_content_item)

            # Check that ticker mappings were created
            assert len(result['ticker_mappings']) > 0

            # Check that entity sentiments include ticker symbols
            for entity_sentiment in result['entity_sentiments']:
                # Some entity sentiments should have ticker symbols
                if hasattr(entity_sentiment, 'ticker_symbol'):
                    assert entity_sentiment.ticker_symbol is not None

    def test_pipeline_performance_metadata(self, nlp_pipeline, sample_content_item):
        """Test that performance metadata is correctly tracked"""
        async def run_test():
            result = await nlp_pipeline.process_content(sample_content_item)

            metadata = result['processing_metadata']

            # Check timing information
            assert 'processing_time_ms' in metadata
            assert isinstance(metadata['processing_time_ms'], (int, float))
            assert metadata['processing_time_ms'] >= 0

            # Check counts
            assert 'entity_count' in metadata
            assert 'ticker_mapping_count' in metadata
            assert isinstance(metadata['entity_count'], int)
            assert isinstance(metadata['ticker_mapping_count'], int)

        asyncio.run(run_test())


# Integration tests with golden data
class TestNLPPipelineGoldenSamples:
    """Test NLP pipeline against golden labeled samples"""

    @pytest.fixture
    def golden_samples(self):
        """Golden labeled samples for testing accuracy"""
        return [
            {
                'content': 'Apple Inc. (AAPL) stock surged 5% after beating earnings expectations.',
                'expected_entities': [
                    {'text': 'Apple Inc.', 'type': 'COMPANY'},
                    {'text': 'AAPL', 'type': 'TICKER'},
                ],
                'expected_tickers': ['AAPL'],
                'expected_sentiment_polarity': 'POSITIVE',
                'expected_sentiment_range': (0.2, 0.8)
            },
            {
                'content': 'Tesla CEO Elon Musk announced disappointing Q3 results, sending $TSLA down 8%.',
                'expected_entities': [
                    {'text': 'Tesla', 'type': 'COMPANY'},
                    {'text': 'Elon Musk', 'type': 'PERSON'},
                    {'text': 'TSLA', 'type': 'TICKER'},
                ],
                'expected_tickers': ['TSLA'],
                'expected_sentiment_polarity': 'NEGATIVE',
                'expected_sentiment_range': (-0.8, -0.2)
            }
        ]

    @pytest.mark.asyncio
    async def test_golden_sample_accuracy(self, nlp_pipeline, golden_samples):
        """Test pipeline accuracy against golden samples"""
        redis_service_mock = AsyncMock()
        redis_service_mock.get_redis.return_value.__aenter__.return_value = AsyncMock()

        pipeline = NLPPipeline(redis_service_mock)

        for i, sample in enumerate(golden_samples):
            content_item = RawContentItem(
                source=SentimentSource.NEWS_API,
                content_type=ContentType.ARTICLE,
                title="Test Article",
                content=sample['content'],
                published_at=datetime.utcnow(),
                source_url="https://example.com/test",
                source_id=f"golden-{i}"
            )

            with patch.object(pipeline.ticker_mapper, '_validate_ticker', return_value=True):
                with patch.object(pipeline.ticker_mapper, '_get_company_name', return_value="Test Company"):
                    result = await pipeline.process_content(content_item)

                    # Test entity extraction accuracy
                    extracted_types = set(e.entity_type.value for e in result['entities'])
                    expected_types = set(e['type'] for e in sample['expected_entities'])

                    # Should extract at least some expected entity types
                    overlap = extracted_types.intersection(expected_types)
                    assert len(overlap) > 0, f"No expected entity types found in sample {i}"

                    # Test sentiment analysis accuracy
                    sentiment = result['sentiment_score']
                    expected_polarity = SentimentPolarity(sample['expected_sentiment_polarity'].lower())

                    assert sentiment.polarity == expected_polarity, f"Sentiment polarity mismatch in sample {i}"

                    # Test sentiment score range
                    min_score, max_score = sample['expected_sentiment_range']
                    assert min_score <= sentiment.compound_score <= max_score, f"Sentiment score out of range in sample {i}"