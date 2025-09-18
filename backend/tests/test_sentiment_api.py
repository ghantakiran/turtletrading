"""
Comprehensive tests for sentiment analysis API endpoints
Tests REQ-SENTIMENT-01, REQ-SENTIMENT-02, REQ-SENTIMENT-03 from IMPLEMENT_FROM_DOCS.md
Ensures 100% coverage for sentiment analysis functionality
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock
import json
from datetime import datetime, timedelta


@pytest_asyncio.fixture
async def mock_sentiment_service():
    """Mock sentiment analysis service for comprehensive testing."""
    with patch('app.services.sentiment_service.SentimentService') as mock_service:
        mock_instance = AsyncMock()

        # Mock stock-specific sentiment
        mock_instance.get_stock_sentiment.return_value = {
            "symbol": "AAPL",
            "overall_sentiment": 0.72,
            "sentiment_classification": "positive",
            "confidence": 0.85,
            "news_sentiment": {
                "score": 0.75,
                "classification": "positive",
                "article_count": 24,
                "sources": ["Reuters", "Bloomberg", "MarketWatch"]
            },
            "social_sentiment": {
                "score": 0.68,
                "classification": "positive",
                "mention_count": 1567,
                "platforms": ["Twitter", "Reddit", "StockTwits"]
            },
            "analyst_sentiment": {
                "score": 0.80,
                "upgrades": 3,
                "downgrades": 1,
                "target_price_avg": 165.50
            },
            "sentiment_history": [
                {"date": "2024-01-15", "score": 0.72},
                {"date": "2024-01-14", "score": 0.68},
                {"date": "2024-01-13", "score": 0.70}
            ],
            "timestamp": datetime.utcnow().isoformat()
        }

        # Mock market sentiment
        mock_instance.get_market_sentiment.return_value = {
            "overall_market_sentiment": 0.65,
            "sentiment_classification": "positive",
            "confidence": 0.78,
            "sector_sentiment": {
                "Technology": 0.72,
                "Healthcare": 0.58,
                "Finance": 0.45,
                "Energy": 0.80,
                "Consumer": 0.62
            },
            "fear_greed_indicators": {
                "vix_sentiment": 0.55,
                "put_call_ratio": 0.48,
                "high_low_sentiment": 0.72,
                "momentum_sentiment": 0.68
            },
            "news_themes": [
                {"theme": "AI Innovation", "sentiment": 0.85, "relevance": 0.92},
                {"theme": "Fed Policy", "sentiment": 0.45, "relevance": 0.78},
                {"theme": "Earnings Season", "sentiment": 0.68, "relevance": 0.85}
            ],
            "timestamp": datetime.utcnow().isoformat()
        }

        # Mock news sentiment
        mock_instance.get_stock_news_sentiment.return_value = {
            "symbol": "TSLA",
            "news_articles": [
                {
                    "title": "Tesla Reports Strong Q4 Results",
                    "source": "Reuters",
                    "sentiment_score": 0.82,
                    "sentiment_label": "positive",
                    "confidence": 0.91,
                    "published_at": "2024-01-15T10:30:00Z",
                    "url": "https://reuters.com/tesla-q4-results",
                    "summary": "Tesla exceeded expectations with record deliveries"
                },
                {
                    "title": "EV Market Competition Intensifies",
                    "source": "Bloomberg",
                    "sentiment_score": 0.35,
                    "sentiment_label": "negative",
                    "confidence": 0.76,
                    "published_at": "2024-01-15T08:45:00Z",
                    "url": "https://bloomberg.com/ev-competition",
                    "summary": "Traditional automakers challenge Tesla's dominance"
                }
            ],
            "aggregate_sentiment": {
                "average_score": 0.59,
                "positive_count": 1,
                "negative_count": 1,
                "neutral_count": 0,
                "total_articles": 2
            },
            "trending_keywords": [
                {"keyword": "deliveries", "frequency": 15, "sentiment": 0.78},
                {"keyword": "competition", "frequency": 12, "sentiment": 0.42},
                {"keyword": "innovation", "frequency": 8, "sentiment": 0.85}
            ]
        }

        # Mock social media sentiment
        mock_instance.get_stock_social_sentiment.return_value = {
            "symbol": "NVDA",
            "platforms": {
                "twitter": {
                    "sentiment_score": 0.74,
                    "mention_count": 2567,
                    "engagement_rate": 0.12,
                    "trending_hashtags": ["#NVDA", "#AI", "#GPU"]
                },
                "reddit": {
                    "sentiment_score": 0.68,
                    "mention_count": 456,
                    "upvote_ratio": 0.78,
                    "popular_subreddits": ["wallstreetbets", "investing", "stocks"]
                },
                "stocktwits": {
                    "sentiment_score": 0.72,
                    "mention_count": 890,
                    "bullish_ratio": 0.72,
                    "bearish_ratio": 0.28
                }
            },
            "aggregate_sentiment": {
                "weighted_score": 0.71,
                "total_mentions": 3913,
                "sentiment_distribution": {
                    "positive": 0.68,
                    "neutral": 0.22,
                    "negative": 0.10
                }
            },
            "sentiment_trends": [
                {"hour": "2024-01-15T14:00:00Z", "score": 0.71},
                {"hour": "2024-01-15T13:00:00Z", "score": 0.69},
                {"hour": "2024-01-15T12:00:00Z", "score": 0.73}
            ]
        }

        # Mock sector sentiment
        mock_instance.get_sector_sentiment.return_value = {
            "sector": "Technology",
            "overall_sentiment": 0.72,
            "sentiment_classification": "positive",
            "confidence": 0.83,
            "top_stocks_sentiment": [
                {"symbol": "AAPL", "sentiment": 0.75, "weight": 0.25},
                {"symbol": "MSFT", "sentiment": 0.68, "weight": 0.22},
                {"symbol": "NVDA", "sentiment": 0.80, "weight": 0.18},
                {"symbol": "GOOGL", "sentiment": 0.65, "weight": 0.15}
            ],
            "sentiment_drivers": [
                {"factor": "AI Innovation", "impact": 0.85, "weight": 0.35},
                {"factor": "Regulatory Concerns", "impact": 0.45, "weight": 0.20},
                {"factor": "Earnings Growth", "impact": 0.78, "weight": 0.30}
            ],
            "historical_sentiment": [
                {"date": "2024-01-15", "score": 0.72},
                {"date": "2024-01-14", "score": 0.69},
                {"date": "2024-01-13", "score": 0.71}
            ]
        }

        # Mock trending keywords
        mock_instance.get_trending_keywords.return_value = {
            "trending_keywords": [
                {
                    "keyword": "artificial intelligence",
                    "frequency": 2456,
                    "sentiment_score": 0.82,
                    "growth_rate": 0.25,
                    "related_stocks": ["NVDA", "MSFT", "GOOGL"]
                },
                {
                    "keyword": "federal reserve",
                    "frequency": 1890,
                    "sentiment_score": 0.42,
                    "growth_rate": 0.15,
                    "related_stocks": ["SPY", "QQQ", "DIA"]
                },
                {
                    "keyword": "earnings beat",
                    "frequency": 1234,
                    "sentiment_score": 0.78,
                    "growth_rate": 0.35,
                    "related_stocks": ["AAPL", "MSFT", "TSLA"]
                }
            ],
            "time_period": "24_hours",
            "total_analyzed": 45678,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Mock trending news
        mock_instance.get_trending_news.return_value = {
            "trending_articles": [
                {
                    "title": "AI Revolution Drives Tech Stocks Higher",
                    "source": "Financial Times",
                    "sentiment_score": 0.84,
                    "impact_score": 0.92,
                    "published_at": "2024-01-15T09:30:00Z",
                    "affected_stocks": ["NVDA", "MSFT", "GOOGL"],
                    "category": "Technology"
                },
                {
                    "title": "Fed Signals Potential Rate Cuts",
                    "source": "Wall Street Journal",
                    "sentiment_score": 0.72,
                    "impact_score": 0.95,
                    "published_at": "2024-01-15T11:15:00Z",
                    "affected_stocks": ["SPY", "QQQ", "TLT"],
                    "category": "Monetary Policy"
                }
            ],
            "categories": [
                {"category": "Technology", "article_count": 45, "avg_sentiment": 0.73},
                {"category": "Monetary Policy", "article_count": 23, "avg_sentiment": 0.58},
                {"category": "Earnings", "article_count": 67, "avg_sentiment": 0.65}
            ],
            "time_period": "24_hours"
        }

        # Mock batch sentiment analysis
        mock_instance.get_batch_sentiment.return_value = {
            "results": [
                {
                    "symbol": "AAPL",
                    "sentiment_score": 0.72,
                    "classification": "positive",
                    "confidence": 0.85
                },
                {
                    "symbol": "MSFT",
                    "sentiment_score": 0.68,
                    "classification": "positive",
                    "confidence": 0.78
                },
                {
                    "symbol": "TSLA",
                    "sentiment_score": 0.59,
                    "classification": "neutral",
                    "confidence": 0.72
                }
            ],
            "processing_time_ms": 234,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Mock sentiment analysis summary
        mock_instance.get_sentiment_summary.return_value = {
            "market_overview": {
                "overall_sentiment": 0.65,
                "dominant_themes": ["AI Innovation", "Fed Policy", "Earnings"],
                "sentiment_distribution": {
                    "very_positive": 0.15,
                    "positive": 0.35,
                    "neutral": 0.30,
                    "negative": 0.15,
                    "very_negative": 0.05
                }
            },
            "sector_breakdown": {
                "technology": {"sentiment": 0.72, "trend": "increasing"},
                "healthcare": {"sentiment": 0.58, "trend": "stable"},
                "finance": {"sentiment": 0.45, "trend": "decreasing"}
            },
            "top_mentions": [
                {"entity": "AAPL", "mentions": 2456, "sentiment": 0.75},
                {"entity": "Fed", "mentions": 1890, "sentiment": 0.42},
                {"entity": "AI", "mentions": 3456, "sentiment": 0.82}
            ],
            "analysis_period": "24_hours",
            "data_sources": ["news", "social_media", "analyst_reports"],
            "confidence_level": 0.81
        }

        mock_service.return_value = mock_instance
        yield mock_instance


class TestSentimentAPI:
    """Comprehensive test class for sentiment analysis API endpoints."""

    @pytest.mark.asyncio
    async def test_get_stock_sentiment_success(self, client: AsyncClient, mock_sentiment_service):
        """Test successful stock sentiment retrieval."""
        response = await client.get("/api/v1/sentiment/AAPL")

        assert response.status_code == 200
        data = response.json()

        # Verify main sentiment data
        assert data["symbol"] == "AAPL"
        assert data["overall_sentiment"] == 0.72
        assert data["sentiment_classification"] == "positive"
        assert data["confidence"] == 0.85

        # Verify news sentiment
        assert "news_sentiment" in data
        news = data["news_sentiment"]
        assert news["score"] == 0.75
        assert news["article_count"] == 24

        # Verify social sentiment
        assert "social_sentiment" in data
        social = data["social_sentiment"]
        assert social["score"] == 0.68
        assert social["mention_count"] == 1567

    @pytest.mark.asyncio
    async def test_get_market_sentiment_success(self, client: AsyncClient, mock_sentiment_service):
        """Test market-wide sentiment analysis."""
        response = await client.get("/api/v1/sentiment/market")

        assert response.status_code == 200
        data = response.json()

        # Verify overall market sentiment
        assert data["overall_market_sentiment"] == 0.65
        assert data["sentiment_classification"] == "positive"

        # Verify sector sentiment breakdown
        assert "sector_sentiment" in data
        sectors = data["sector_sentiment"]
        assert sectors["Technology"] == 0.72
        assert sectors["Healthcare"] == 0.58

        # Verify fear & greed indicators
        assert "fear_greed_indicators" in data
        fg = data["fear_greed_indicators"]
        assert fg["vix_sentiment"] == 0.55

    @pytest.mark.asyncio
    async def test_get_stock_news_sentiment_success(self, client: AsyncClient, mock_sentiment_service):
        """Test stock-specific news sentiment analysis."""
        response = await client.get("/api/v1/sentiment/TSLA/news")

        assert response.status_code == 200
        data = response.json()

        # Verify news articles
        assert "news_articles" in data
        articles = data["news_articles"]
        assert len(articles) == 2

        # Verify first article structure
        article = articles[0]
        assert article["title"] == "Tesla Reports Strong Q4 Results"
        assert article["sentiment_score"] == 0.82
        assert article["sentiment_label"] == "positive"

        # Verify aggregate sentiment
        assert "aggregate_sentiment" in data
        agg = data["aggregate_sentiment"]
        assert agg["total_articles"] == 2
        assert agg["positive_count"] == 1

    @pytest.mark.asyncio
    async def test_get_stock_social_sentiment_success(self, client: AsyncClient, mock_sentiment_service):
        """Test stock-specific social media sentiment."""
        response = await client.get("/api/v1/sentiment/NVDA/social")

        assert response.status_code == 200
        data = response.json()

        # Verify platform breakdown
        assert "platforms" in data
        platforms = data["platforms"]

        # Verify Twitter data
        assert "twitter" in platforms
        twitter = platforms["twitter"]
        assert twitter["sentiment_score"] == 0.74
        assert twitter["mention_count"] == 2567

        # Verify aggregate sentiment
        assert "aggregate_sentiment" in data
        agg = data["aggregate_sentiment"]
        assert agg["weighted_score"] == 0.71
        assert agg["total_mentions"] == 3913

    @pytest.mark.asyncio
    async def test_get_sector_sentiment_success(self, client: AsyncClient, mock_sentiment_service):
        """Test sector-specific sentiment analysis."""
        response = await client.get("/api/v1/sentiment/sector/Technology")

        assert response.status_code == 200
        data = response.json()

        # Verify sector sentiment
        assert data["sector"] == "Technology"
        assert data["overall_sentiment"] == 0.72
        assert data["sentiment_classification"] == "positive"

        # Verify top stocks sentiment
        assert "top_stocks_sentiment" in data
        stocks = data["top_stocks_sentiment"]
        assert len(stocks) >= 1
        assert stocks[0]["symbol"] == "AAPL"
        assert stocks[0]["sentiment"] == 0.75

    @pytest.mark.asyncio
    async def test_get_trending_keywords_success(self, client: AsyncClient, mock_sentiment_service):
        """Test trending keywords analysis."""
        response = await client.get("/api/v1/sentiment/keywords/trending")

        assert response.status_code == 200
        data = response.json()

        # Verify trending keywords
        assert "trending_keywords" in data
        keywords = data["trending_keywords"]
        assert len(keywords) >= 1

        # Verify first keyword structure
        keyword = keywords[0]
        assert keyword["keyword"] == "artificial intelligence"
        assert keyword["frequency"] == 2456
        assert keyword["sentiment_score"] == 0.82
        assert "related_stocks" in keyword

    @pytest.mark.asyncio
    async def test_get_trending_news_success(self, client: AsyncClient, mock_sentiment_service):
        """Test trending news analysis."""
        response = await client.get("/api/v1/sentiment/news/trending")

        assert response.status_code == 200
        data = response.json()

        # Verify trending articles
        assert "trending_articles" in data
        articles = data["trending_articles"]
        assert len(articles) >= 1

        # Verify article structure
        article = articles[0]
        assert article["title"] == "AI Revolution Drives Tech Stocks Higher"
        assert article["sentiment_score"] == 0.84
        assert "affected_stocks" in article

        # Verify categories
        assert "categories" in data
        categories = data["categories"]
        assert len(categories) >= 1

    @pytest.mark.asyncio
    async def test_batch_sentiment_analysis_success(self, client: AsyncClient, mock_sentiment_service):
        """Test batch sentiment analysis."""
        symbols = ["AAPL", "MSFT", "TSLA"]

        response = await client.post(
            "/api/v1/sentiment/batch",
            json={"symbols": symbols}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify results structure
        assert "results" in data
        results = data["results"]
        assert len(results) == 3

        # Verify first result
        result = results[0]
        assert result["symbol"] == "AAPL"
        assert result["sentiment_score"] == 0.72
        assert result["classification"] == "positive"

        # Verify processing metrics
        assert "processing_time_ms" in data
        assert data["processing_time_ms"] == 234

    @pytest.mark.asyncio
    async def test_sentiment_analysis_summary_success(self, client: AsyncClient, mock_sentiment_service):
        """Test sentiment analysis summary endpoint."""
        response = await client.get("/api/v1/sentiment/analysis/summary")

        assert response.status_code == 200
        data = response.json()

        # Verify market overview
        assert "market_overview" in data
        overview = data["market_overview"]
        assert overview["overall_sentiment"] == 0.65
        assert "dominant_themes" in overview

        # Verify sector breakdown
        assert "sector_breakdown" in data
        sectors = data["sector_breakdown"]
        assert "technology" in sectors

        # Verify top mentions
        assert "top_mentions" in data
        mentions = data["top_mentions"]
        assert len(mentions) >= 1

    @pytest.mark.asyncio
    async def test_sentiment_api_error_handling(self, client: AsyncClient, mock_sentiment_service):
        """Test sentiment API error handling."""
        # Simulate service error
        mock_sentiment_service.get_stock_sentiment.side_effect = Exception("Sentiment data unavailable")

        response = await client.get("/api/v1/sentiment/INVALID")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data

    @pytest.mark.asyncio
    async def test_sentiment_api_performance(self, client: AsyncClient, mock_sentiment_service, performance_timer):
        """Test sentiment API performance requirements."""
        performance_timer.start()

        response = await client.get("/api/v1/sentiment/AAPL")

        performance_timer.stop()
        elapsed_time = performance_timer.elapsed()

        # Should respond within 500ms
        assert elapsed_time < 0.5
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_concurrent_sentiment_requests(self, client: AsyncClient, mock_sentiment_service):
        """Test handling of concurrent sentiment requests."""
        import asyncio

        # Make multiple concurrent requests
        tasks = [
            client.get("/api/v1/sentiment/AAPL"),
            client.get("/api/v1/sentiment/MSFT"),
            client.get("/api/v1/sentiment/market"),
            client.get("/api/v1/sentiment/keywords/trending")
        ]

        responses = await asyncio.gather(*tasks)

        # All requests should succeed
        for response in responses:
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_sentiment_input_validation(self, client: AsyncClient, mock_sentiment_service):
        """Test input validation for sentiment endpoints."""
        # Test invalid symbol format
        response = await client.get("/api/v1/sentiment/INVALID123")
        assert response.status_code in [400, 422, 404]

        # Test invalid sector
        response = await client.get("/api/v1/sentiment/sector/InvalidSector")
        assert response.status_code in [400, 422, 404]

        # Test empty batch request
        response = await client.post("/api/v1/sentiment/batch", json={"symbols": []})
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_sentiment_data_consistency(self, client: AsyncClient, mock_sentiment_service):
        """Test sentiment data consistency across endpoints."""
        # Get individual stock sentiment
        stock_response = await client.get("/api/v1/sentiment/AAPL")
        stock_data = stock_response.json()

        # Get market sentiment (which should include AAPL)
        market_response = await client.get("/api/v1/sentiment/market")
        market_data = market_response.json()

        # Both should succeed
        assert stock_response.status_code == 200
        assert market_response.status_code == 200

        # Sentiment scores should be reasonable
        assert 0 <= stock_data["overall_sentiment"] <= 1
        assert 0 <= market_data["overall_market_sentiment"] <= 1

    @pytest.mark.asyncio
    async def test_sentiment_cache_headers(self, client: AsyncClient, mock_sentiment_service):
        """Test sentiment API caching headers."""
        response = await client.get("/api/v1/sentiment/AAPL")

        assert response.status_code == 200
        # Sentiment data should have appropriate cache headers
        headers = response.headers
        assert "cache-control" in headers or "x-cache" in headers