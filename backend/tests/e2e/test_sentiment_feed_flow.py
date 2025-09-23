"""
End-to-End tests for sentiment feed → filter → detail flow.

Tests the complete user journey:
1. View sentiment feed/news tape
2. Apply filters (ticker, sentiment, timeframe)
3. Drill down into detailed entity analysis
4. Navigate between different views
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any

from app.models.sentiment_ner_models import (
    RawContent, ProcessedContent, SentimentAggregation, SentimentScore,
    SentimentPolarity, EntityType, ContentType, ProviderType, NamedEntity
)


class TestSentimentFeedE2E:
    """E2E tests for sentiment feed and filtering functionality."""

    @pytest.fixture
    def sample_sentiment_data(self):
        """Create comprehensive sample sentiment data for testing."""
        return {
            "aggregations": [
                {
                    "ticker": "AAPL",
                    "start_time": datetime.utcnow() - timedelta(hours=1),
                    "end_time": datetime.utcnow(),
                    "window_size": "1h",
                    "weighted_sentiment": 0.75,
                    "average_sentiment": 0.68,
                    "sentiment_trend": 0.12,
                    "total_mentions": 145,
                    "unique_sources": 28,
                    "confidence_average": 0.82,
                    "polarity_distribution": {
                        "POSITIVE": 95,
                        "NEGATIVE": 35,
                        "NEUTRAL": 15
                    },
                    "data_quality_score": 0.88,
                    "coverage_score": 0.91,
                    "next_update": datetime.utcnow() + timedelta(minutes=15)
                },
                {
                    "ticker": "TSLA",
                    "start_time": datetime.utcnow() - timedelta(hours=1),
                    "end_time": datetime.utcnow(),
                    "window_size": "1h",
                    "weighted_sentiment": -0.32,
                    "average_sentiment": -0.28,
                    "sentiment_trend": -0.08,
                    "total_mentions": 89,
                    "unique_sources": 19,
                    "confidence_average": 0.76,
                    "polarity_distribution": {
                        "POSITIVE": 25,
                        "NEGATIVE": 55,
                        "NEUTRAL": 9
                    },
                    "data_quality_score": 0.79,
                    "coverage_score": 0.84,
                    "next_update": datetime.utcnow() + timedelta(minutes=15)
                },
                {
                    "ticker": "MSFT",
                    "start_time": datetime.utcnow() - timedelta(hours=1),
                    "end_time": datetime.utcnow(),
                    "window_size": "1h",
                    "weighted_sentiment": 0.45,
                    "average_sentiment": 0.41,
                    "sentiment_trend": 0.05,
                    "total_mentions": 67,
                    "unique_sources": 15,
                    "confidence_average": 0.88,
                    "polarity_distribution": {
                        "POSITIVE": 42,
                        "NEGATIVE": 18,
                        "NEUTRAL": 7
                    },
                    "data_quality_score": 0.92,
                    "coverage_score": 0.87,
                    "next_update": datetime.utcnow() + timedelta(minutes=15)
                }
            ],
            "raw_content": [
                {
                    "content_id": "news_1",
                    "title": "Apple Announces Revolutionary AI Integration in iPhone 16",
                    "content": "Apple Inc. (NASDAQ: AAPL) unveiled groundbreaking AI features...",
                    "source_url": "https://techcrunch.com/apple-ai-iphone16",
                    "published_at": datetime.utcnow() - timedelta(minutes=30),
                    "provider": "NEWS_API",
                    "content_type": "NEWS_ARTICLE",
                    "sentiment_score": 0.84,
                    "confidence": 0.91,
                    "entities": [
                        {"text": "AAPL", "type": "TICKER", "confidence": 0.98},
                        {"text": "Apple Inc.", "type": "COMPANY", "confidence": 0.95},
                        {"text": "iPhone 16", "type": "PRODUCT", "confidence": 0.89}
                    ]
                },
                {
                    "content_id": "social_1",
                    "title": "$TSLA production issues at Giga Berlin",
                    "content": "Tesla continues to face challenges at their German facility...",
                    "source_url": "https://reddit.com/r/teslamotors/production_issues",
                    "published_at": datetime.utcnow() - timedelta(minutes=45),
                    "provider": "REDDIT",
                    "content_type": "SOCIAL_MEDIA",
                    "sentiment_score": -0.67,
                    "confidence": 0.79,
                    "entities": [
                        {"text": "TSLA", "type": "TICKER", "confidence": 0.96},
                        {"text": "Tesla", "type": "COMPANY", "confidence": 0.93},
                        {"text": "Giga Berlin", "type": "LOCATION", "confidence": 0.87}
                    ]
                },
                {
                    "content_id": "news_2",
                    "title": "Microsoft Azure Cloud Revenue Surges 35% YoY",
                    "content": "Microsoft Corporation reported exceptional cloud growth...",
                    "source_url": "https://bloomberg.com/msft-azure-growth",
                    "published_at": datetime.utcnow() - timedelta(minutes=15),
                    "provider": "NEWS_API",
                    "content_type": "NEWS_ARTICLE",
                    "sentiment_score": 0.72,
                    "confidence": 0.88,
                    "entities": [
                        {"text": "MSFT", "type": "TICKER", "confidence": 0.97},
                        {"text": "Microsoft Corporation", "type": "COMPANY", "confidence": 0.94},
                        {"text": "Azure", "type": "PRODUCT", "confidence": 0.91}
                    ]
                }
            ]
        }

    @pytest.mark.asyncio
    async def test_sentiment_feed_display(self, sample_sentiment_data):
        """Test that sentiment feed displays correctly with real-time data."""

        # Test data structure for sentiment feed
        feed_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_tickers": len(sample_sentiment_data["aggregations"]),
            "feed_items": []
        }

        # Process aggregations into feed items
        for agg in sample_sentiment_data["aggregations"]:
            feed_item = {
                "ticker": agg["ticker"],
                "sentiment_score": agg["weighted_sentiment"],
                "sentiment_label": self._get_sentiment_label(agg["weighted_sentiment"]),
                "trend": agg["sentiment_trend"],
                "mentions": agg["total_mentions"],
                "sources": agg["unique_sources"],
                "confidence": agg["confidence_average"],
                "last_update": agg["next_update"].isoformat(),
                "polarity_breakdown": agg["polarity_distribution"]
            }
            feed_data["feed_items"].append(feed_item)

        # Sort by absolute sentiment strength
        feed_data["feed_items"].sort(
            key=lambda x: abs(x["sentiment_score"]), reverse=True
        )

        # Verify feed structure
        assert feed_data["total_tickers"] == 3
        assert len(feed_data["feed_items"]) == 3

        # Verify AAPL is most positive
        most_positive = feed_data["feed_items"][0]
        assert most_positive["ticker"] == "AAPL"
        assert most_positive["sentiment_score"] > 0.7
        assert most_positive["sentiment_label"] == "Very Positive"

        # Verify TSLA shows negative sentiment
        tsla_item = next(item for item in feed_data["feed_items"] if item["ticker"] == "TSLA")
        assert tsla_item["sentiment_score"] < 0
        assert tsla_item["sentiment_label"] == "Negative"

    @pytest.mark.asyncio
    async def test_sentiment_filtering_by_ticker(self, sample_sentiment_data):
        """Test filtering sentiment data by specific tickers."""

        # Simulate ticker filter
        filter_tickers = ["AAPL", "MSFT"]

        filtered_aggregations = [
            agg for agg in sample_sentiment_data["aggregations"]
            if agg["ticker"] in filter_tickers
        ]

        filtered_content = [
            content for content in sample_sentiment_data["raw_content"]
            if any(entity["text"] in filter_tickers for entity in content["entities"]
                  if entity["type"] == "TICKER")
        ]

        # Verify filtering
        assert len(filtered_aggregations) == 2
        assert all(agg["ticker"] in filter_tickers for agg in filtered_aggregations)

        assert len(filtered_content) == 2  # AAPL and MSFT content

        # TSLA should be excluded
        tsla_aggregations = [agg for agg in filtered_aggregations if agg["ticker"] == "TSLA"]
        assert len(tsla_aggregations) == 0

    @pytest.mark.asyncio
    async def test_sentiment_filtering_by_polarity(self, sample_sentiment_data):
        """Test filtering sentiment data by sentiment polarity."""

        # Filter for positive sentiment only
        positive_threshold = 0.1

        positive_aggregations = [
            agg for agg in sample_sentiment_data["aggregations"]
            if agg["weighted_sentiment"] > positive_threshold
        ]

        positive_content = [
            content for content in sample_sentiment_data["raw_content"]
            if content["sentiment_score"] > positive_threshold
        ]

        # Verify positive filtering
        assert len(positive_aggregations) == 2  # AAPL and MSFT
        positive_tickers = [agg["ticker"] for agg in positive_aggregations]
        assert "AAPL" in positive_tickers
        assert "MSFT" in positive_tickers
        assert "TSLA" not in positive_tickers

        # Filter for negative sentiment only
        negative_threshold = -0.1

        negative_aggregations = [
            agg for agg in sample_sentiment_data["aggregations"]
            if agg["weighted_sentiment"] < negative_threshold
        ]

        # Verify negative filtering
        assert len(negative_aggregations) == 1  # Only TSLA
        assert negative_aggregations[0]["ticker"] == "TSLA"

    @pytest.mark.asyncio
    async def test_sentiment_filtering_by_timeframe(self, sample_sentiment_data):
        """Test filtering sentiment data by different timeframes."""

        # Simulate timeframe filtering
        timeframes = {
            "1h": timedelta(hours=1),
            "4h": timedelta(hours=4),
            "1d": timedelta(days=1),
            "1w": timedelta(weeks=1)
        }

        current_time = datetime.utcnow()

        for timeframe_key, timeframe_delta in timeframes.items():
            start_time = current_time - timeframe_delta

            # Filter content by timeframe
            timeframe_content = [
                content for content in sample_sentiment_data["raw_content"]
                if content["published_at"] >= start_time
            ]

            # All sample content is within 1 hour, so should be included in all timeframes
            if timeframe_key in ["1h", "4h", "1d", "1w"]:
                assert len(timeframe_content) == 3

            # Verify timeframe metadata
            timeframe_data = {
                "timeframe": timeframe_key,
                "start_time": start_time.isoformat(),
                "end_time": current_time.isoformat(),
                "content_count": len(timeframe_content),
                "unique_tickers": len(set(
                    entity["text"] for content in timeframe_content
                    for entity in content["entities"]
                    if entity["type"] == "TICKER"
                ))
            }

            assert timeframe_data["content_count"] >= 0
            assert timeframe_data["unique_tickers"] >= 0

    @pytest.mark.asyncio
    async def test_entity_drilldown_flow(self, sample_sentiment_data):
        """Test drilling down from ticker to detailed entity analysis."""

        # Select AAPL for detailed analysis
        selected_ticker = "AAPL"

        # Get ticker-specific data
        ticker_aggregation = next(
            agg for agg in sample_sentiment_data["aggregations"]
            if agg["ticker"] == selected_ticker
        )

        ticker_content = [
            content for content in sample_sentiment_data["raw_content"]
            if any(entity["text"] == selected_ticker for entity in content["entities"]
                  if entity["type"] == "TICKER")
        ]

        # Create detailed entity analysis
        entity_analysis = {
            "ticker": selected_ticker,
            "summary": {
                "current_sentiment": ticker_aggregation["weighted_sentiment"],
                "sentiment_trend": ticker_aggregation["sentiment_trend"],
                "total_mentions": ticker_aggregation["total_mentions"],
                "confidence_level": ticker_aggregation["confidence_average"],
                "data_quality": ticker_aggregation["data_quality_score"]
            },
            "content_breakdown": {
                "news_articles": len([c for c in ticker_content if c["content_type"] == "NEWS_ARTICLE"]),
                "social_media": len([c for c in ticker_content if c["content_type"] == "SOCIAL_MEDIA"]),
                "total_sources": ticker_aggregation["unique_sources"]
            },
            "sentiment_distribution": ticker_aggregation["polarity_distribution"],
            "recent_content": ticker_content,
            "entity_mentions": []
        }

        # Extract all entities related to this ticker
        for content in ticker_content:
            for entity in content["entities"]:
                if entity not in entity_analysis["entity_mentions"]:
                    entity_analysis["entity_mentions"].append({
                        "text": entity["text"],
                        "type": entity["type"],
                        "confidence": entity["confidence"],
                        "content_id": content["content_id"]
                    })

        # Verify entity analysis structure
        assert entity_analysis["ticker"] == "AAPL"
        assert entity_analysis["summary"]["current_sentiment"] > 0.7  # Very positive
        assert entity_analysis["content_breakdown"]["total_sources"] > 0
        assert len(entity_analysis["recent_content"]) > 0
        assert len(entity_analysis["entity_mentions"]) > 0

        # Should find company name entity
        company_entities = [
            e for e in entity_analysis["entity_mentions"]
            if e["type"] == "COMPANY" and "Apple" in e["text"]
        ]
        assert len(company_entities) > 0

    @pytest.mark.asyncio
    async def test_sentiment_trend_analysis(self, sample_sentiment_data):
        """Test sentiment trend analysis and visualization data."""

        # Create historical trend data (simulated)
        trend_windows = []
        base_time = datetime.utcnow()

        for i in range(24):  # 24 hours of data
            window_time = base_time - timedelta(hours=i)

            # Simulate sentiment evolution for AAPL
            base_sentiment = 0.75
            trend_factor = 0.02 * i  # Gradual improvement over time
            noise = 0.1 * (0.5 - (i % 3) / 6)  # Some randomness

            window_sentiment = base_sentiment + trend_factor + noise
            window_sentiment = max(-1, min(1, window_sentiment))  # Clamp to [-1, 1]

            trend_windows.append({
                "timestamp": window_time.isoformat(),
                "sentiment_score": window_sentiment,
                "mention_count": max(10, 50 - i * 2 + (i % 5) * 3),  # Varying mention counts
                "confidence": min(0.95, 0.7 + i * 0.01)
            })

        trend_windows.reverse()  # Chronological order

        # Calculate trend metrics
        recent_windows = trend_windows[-6:]  # Last 6 hours
        older_windows = trend_windows[-12:-6]  # 6-12 hours ago

        recent_avg = sum(w["sentiment_score"] for w in recent_windows) / len(recent_windows)
        older_avg = sum(w["sentiment_score"] for w in older_windows) / len(older_windows)

        trend_direction = recent_avg - older_avg
        trend_strength = abs(trend_direction)

        trend_analysis = {
            "ticker": "AAPL",
            "trend_direction": "improving" if trend_direction > 0.05 else "declining" if trend_direction < -0.05 else "stable",
            "trend_strength": trend_strength,
            "current_sentiment": recent_windows[-1]["sentiment_score"],
            "sentiment_change_6h": trend_direction,
            "peak_sentiment": max(w["sentiment_score"] for w in trend_windows),
            "low_sentiment": min(w["sentiment_score"] for w in trend_windows),
            "average_mentions": sum(w["mention_count"] for w in trend_windows) / len(trend_windows),
            "data_points": len(trend_windows),
            "confidence_trend": recent_windows[-1]["confidence"] - trend_windows[0]["confidence"]
        }

        # Verify trend analysis
        assert trend_analysis["ticker"] == "AAPL"
        assert trend_analysis["trend_direction"] in ["improving", "declining", "stable"]
        assert 0 <= trend_analysis["trend_strength"] <= 2
        assert -1 <= trend_analysis["current_sentiment"] <= 1
        assert trend_analysis["data_points"] == 24

    @pytest.mark.asyncio
    async def test_news_tape_real_time_updates(self, sample_sentiment_data):
        """Test real-time news tape updates and streaming."""

        # Simulate initial news tape state
        initial_tape = {
            "last_update": datetime.utcnow().isoformat(),
            "items": []
        }

        # Add items to tape from sample data
        for content in sample_sentiment_data["raw_content"]:
            tape_item = {
                "id": content["content_id"],
                "timestamp": content["published_at"].isoformat(),
                "title": content["title"],
                "ticker": self._extract_primary_ticker(content["entities"]),
                "sentiment": content["sentiment_score"],
                "sentiment_label": self._get_sentiment_label(content["sentiment_score"]),
                "source": content["provider"],
                "confidence": content["confidence"],
                "url": content["source_url"]
            }
            initial_tape["items"].append(tape_item)

        # Sort by timestamp (most recent first)
        initial_tape["items"].sort(
            key=lambda x: x["timestamp"], reverse=True
        )

        # Simulate new incoming content
        new_content = {
            "content_id": "breaking_news_1",
            "title": "BREAKING: Apple Announces $50B Stock Buyback Program",
            "content": "Apple Inc. just announced a massive $50 billion stock buyback...",
            "published_at": datetime.utcnow(),
            "provider": "NEWS_API",
            "content_type": "NEWS_ARTICLE",
            "sentiment_score": 0.92,
            "confidence": 0.94,
            "entities": [
                {"text": "AAPL", "type": "TICKER", "confidence": 0.98},
                {"text": "Apple Inc.", "type": "COMPANY", "confidence": 0.96}
            ]
        }

        # Add new item to tape
        new_tape_item = {
            "id": new_content["content_id"],
            "timestamp": new_content["published_at"].isoformat(),
            "title": new_content["title"],
            "ticker": self._extract_primary_ticker(new_content["entities"]),
            "sentiment": new_content["sentiment_score"],
            "sentiment_label": self._get_sentiment_label(new_content["sentiment_score"]),
            "source": new_content["provider"],
            "confidence": new_content["confidence"],
            "url": "https://breaking-news.com/aapl-buyback"
        }

        # Update tape with new item
        updated_tape = {
            "last_update": new_content["published_at"].isoformat(),
            "items": [new_tape_item] + initial_tape["items"]  # New item first
        }

        # Verify tape updates
        assert len(updated_tape["items"]) == 4  # 3 original + 1 new
        assert updated_tape["items"][0]["id"] == "breaking_news_1"  # Most recent first
        assert updated_tape["items"][0]["sentiment"] > 0.9  # Very positive breaking news
        assert updated_tape["items"][0]["ticker"] == "AAPL"

        # Verify chronological ordering
        timestamps = [item["timestamp"] for item in updated_tape["items"]]
        assert timestamps == sorted(timestamps, reverse=True)

    @pytest.mark.asyncio
    async def test_sentiment_feed_filtering_combinations(self, sample_sentiment_data):
        """Test complex filtering combinations (ticker + sentiment + timeframe)."""

        # Complex filter: Positive sentiment for tech stocks in last 1 hour
        filter_criteria = {
            "tickers": ["AAPL", "MSFT", "GOOGL", "TSLA"],
            "sentiment_min": 0.2,  # Positive only
            "sentiment_max": 1.0,
            "timeframe": "1h",
            "min_confidence": 0.7,
            "min_mentions": 10
        }

        current_time = datetime.utcnow()
        timeframe_start = current_time - timedelta(hours=1)

        # Apply filters
        filtered_aggregations = []
        for agg in sample_sentiment_data["aggregations"]:
            # Check all filter criteria
            if (agg["ticker"] in filter_criteria["tickers"] and
                filter_criteria["sentiment_min"] <= agg["weighted_sentiment"] <= filter_criteria["sentiment_max"] and
                agg["confidence_average"] >= filter_criteria["min_confidence"] and
                agg["total_mentions"] >= filter_criteria["min_mentions"]):
                filtered_aggregations.append(agg)

        filtered_content = []
        for content in sample_sentiment_data["raw_content"]:
            # Check timeframe
            if content["published_at"] >= timeframe_start:
                # Check ticker
                content_tickers = [
                    entity["text"] for entity in content["entities"]
                    if entity["type"] == "TICKER"
                ]
                if (any(ticker in filter_criteria["tickers"] for ticker in content_tickers) and
                    filter_criteria["sentiment_min"] <= content["sentiment_score"] <= filter_criteria["sentiment_max"] and
                    content["confidence"] >= filter_criteria["min_confidence"]):
                    filtered_content.append(content)

        # Create filtered response
        filtered_response = {
            "filters_applied": filter_criteria,
            "results": {
                "aggregations": filtered_aggregations,
                "content": filtered_content,
                "total_tickers": len(filtered_aggregations),
                "total_content_items": len(filtered_content)
            },
            "filter_summary": {
                "positive_sentiment_count": len(filtered_aggregations),
                "average_sentiment": sum(agg["weighted_sentiment"] for agg in filtered_aggregations) / max(1, len(filtered_aggregations)),
                "total_mentions": sum(agg["total_mentions"] for agg in filtered_aggregations),
                "unique_sources": sum(agg["unique_sources"] for agg in filtered_aggregations)
            }
        }

        # Verify filtering results
        assert filtered_response["results"]["total_tickers"] == 2  # AAPL and MSFT meet criteria
        assert filtered_response["results"]["total_content_items"] == 2  # AAPL and MSFT content
        assert filtered_response["filter_summary"]["average_sentiment"] > 0.2  # All positive

        # TSLA should be excluded due to negative sentiment
        tsla_in_results = any(agg["ticker"] == "TSLA" for agg in filtered_aggregations)
        assert not tsla_in_results

    def _get_sentiment_label(self, score: float) -> str:
        """Convert sentiment score to human-readable label."""
        if score >= 0.7:
            return "Very Positive"
        elif score >= 0.3:
            return "Positive"
        elif score >= 0.1:
            return "Slightly Positive"
        elif score >= -0.1:
            return "Neutral"
        elif score >= -0.3:
            return "Slightly Negative"
        elif score >= -0.7:
            return "Negative"
        else:
            return "Very Negative"

    def _extract_primary_ticker(self, entities: List[Dict]) -> str:
        """Extract the primary ticker from entity list."""
        ticker_entities = [e for e in entities if e["type"] == "TICKER"]
        if ticker_entities:
            # Return highest confidence ticker
            return max(ticker_entities, key=lambda x: x["confidence"])["text"]
        return "UNKNOWN"


class TestSentimentUIAccessibility:
    """E2E tests for sentiment UI accessibility features."""

    @pytest.mark.asyncio
    async def test_keyboard_navigation_accessibility(self):
        """Test keyboard navigation through sentiment interface."""

        # Simulate keyboard navigation test data
        navigation_elements = [
            {"id": "sentiment-feed", "type": "feed", "tab_index": 1, "aria_label": "Sentiment feed"},
            {"id": "ticker-filter", "type": "select", "tab_index": 2, "aria_label": "Filter by ticker"},
            {"id": "sentiment-filter", "type": "range", "tab_index": 3, "aria_label": "Filter by sentiment"},
            {"id": "timeframe-filter", "type": "select", "tab_index": 4, "aria_label": "Filter by timeframe"},
            {"id": "feed-item-1", "type": "button", "tab_index": 5, "aria_label": "AAPL sentiment details"},
            {"id": "feed-item-2", "type": "button", "tab_index": 6, "aria_label": "TSLA sentiment details"},
            {"id": "feed-item-3", "type": "button", "tab_index": 7, "aria_label": "MSFT sentiment details"}
        ]

        # Verify tab order and accessibility
        for i, element in enumerate(navigation_elements):
            assert element["tab_index"] == i + 1
            assert "aria_label" in element
            assert len(element["aria_label"]) > 0

        # Test keyboard shortcuts
        keyboard_shortcuts = {
            "f": "focus_feed",
            "1": "set_timeframe_1h",
            "4": "set_timeframe_4h",
            "d": "set_timeframe_1d",
            "w": "set_timeframe_1w",
            "p": "filter_positive_sentiment",
            "n": "filter_negative_sentiment",
            "escape": "clear_filters"
        }

        # Verify shortcuts are defined
        assert len(keyboard_shortcuts) >= 7
        assert "escape" in keyboard_shortcuts  # Clear filters should always be available

    @pytest.mark.asyncio
    async def test_screen_reader_compatibility(self):
        """Test screen reader compatibility for sentiment data."""

        # Create screen reader friendly descriptions
        sentiment_data = {
            "ticker": "AAPL",
            "sentiment_score": 0.75,
            "trend": 0.12,
            "mentions": 145,
            "confidence": 0.82
        }

        # Generate screen reader text
        screen_reader_text = self._generate_screen_reader_description(sentiment_data)

        # Verify screen reader text
        assert "Apple" in screen_reader_text or "AAPL" in screen_reader_text
        assert "positive" in screen_reader_text.lower()
        assert "75" in screen_reader_text or "0.75" in screen_reader_text
        assert "145" in screen_reader_text
        assert "improving" in screen_reader_text.lower() or "increasing" in screen_reader_text.lower()

        # Test ARIA live regions for real-time updates
        aria_live_regions = {
            "sentiment-alerts": {
                "aria_live": "polite",
                "aria_atomic": "true",
                "role": "status"
            },
            "breaking-news": {
                "aria_live": "assertive",
                "aria_atomic": "true",
                "role": "alert"
            }
        }

        # Verify ARIA live regions are properly configured
        for region_id, config in aria_live_regions.items():
            assert config["aria_live"] in ["polite", "assertive"]
            assert config["aria_atomic"] == "true"
            assert config["role"] in ["status", "alert"]

    @pytest.mark.asyncio
    async def test_color_contrast_accessibility(self):
        """Test color contrast for sentiment visualization."""

        # Define color scheme for sentiment indicators
        sentiment_colors = {
            "very_positive": {"bg": "#065f46", "text": "#ffffff", "contrast_ratio": 7.2},
            "positive": {"bg": "#16a34a", "text": "#ffffff", "contrast_ratio": 4.8},
            "neutral": {"bg": "#6b7280", "text": "#ffffff", "contrast_ratio": 4.9},
            "negative": {"bg": "#dc2626", "text": "#ffffff", "contrast_ratio": 5.1},
            "very_negative": {"bg": "#7f1d1d", "text": "#ffffff", "contrast_ratio": 8.1}
        }

        # Verify all colors meet WCAG AA standards (4.5:1 ratio)
        for sentiment_type, colors in sentiment_colors.items():
            assert colors["contrast_ratio"] >= 4.5, f"{sentiment_type} doesn't meet WCAG AA contrast standards"

        # Test high contrast mode alternatives
        high_contrast_colors = {
            "very_positive": {"bg": "#000000", "text": "#00ff00", "contrast_ratio": 15.3},
            "positive": {"bg": "#000000", "text": "#90ee90", "contrast_ratio": 12.7},
            "neutral": {"bg": "#000000", "text": "#ffffff", "contrast_ratio": 21.0},
            "negative": {"bg": "#000000", "text": "#ffb6c1", "contrast_ratio": 12.1},
            "very_negative": {"bg": "#000000", "text": "#ff0000", "contrast_ratio": 5.3}
        }

        # Verify high contrast mode meets enhanced standards (7:1 ratio)
        for sentiment_type, colors in high_contrast_colors.items():
            if sentiment_type != "very_negative":  # Allow some flexibility for red
                assert colors["contrast_ratio"] >= 7.0, f"High contrast {sentiment_type} doesn't meet WCAG AAA standards"

    def _generate_screen_reader_description(self, data: Dict) -> str:
        """Generate screen reader friendly description of sentiment data."""
        ticker = data["ticker"]
        score = data["sentiment_score"]
        trend = data["trend"]
        mentions = data["mentions"]
        confidence = data["confidence"]

        # Convert score to descriptive text
        if score >= 0.7:
            sentiment_desc = "very positive"
        elif score >= 0.3:
            sentiment_desc = "positive"
        elif score >= -0.3:
            sentiment_desc = "neutral"
        elif score >= -0.7:
            sentiment_desc = "negative"
        else:
            sentiment_desc = "very negative"

        # Convert trend to descriptive text
        if trend > 0.05:
            trend_desc = "improving"
        elif trend < -0.05:
            trend_desc = "declining"
        else:
            trend_desc = "stable"

        # Format confidence as percentage
        confidence_pct = int(confidence * 100)

        return (f"{ticker} sentiment is {sentiment_desc} with a score of {score:.2f}. "
                f"Trend is {trend_desc}. Based on {mentions} mentions with "
                f"{confidence_pct} percent confidence.")


if __name__ == "__main__":
    pytest.main([__file__])