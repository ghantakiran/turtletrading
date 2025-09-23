"""
Sentiment Aggregation Service

This service handles:
- Real-time sentiment aggregation by ticker and time windows
- Confidence-weighted sentiment scoring
- Trend analysis and momentum calculation
- Multi-timeframe sentiment views
- Quality metrics and data validation
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple
from collections import defaultdict
import statistics
import redis.asyncio as aioredis
from loguru import logger

from app.models.sentiment_ner_models import (
    SentimentAggregation, ProcessedContent, SentimentScore, SentimentPolarity,
    EntityType, SentimentQueryRequest, SentimentQueryResponse
)


class SentimentAggregator:
    """Advanced sentiment aggregator with confidence weighting"""

    @staticmethod
    def aggregate_sentiment_scores(
        scores: List[SentimentScore],
        weighting_strategy: str = "confidence"
    ) -> Dict[str, float]:
        """
        Aggregate multiple sentiment scores using different weighting strategies.

        Args:
            scores: List of sentiment scores to aggregate
            weighting_strategy: 'equal', 'confidence', 'recency', or 'confidence_recency'

        Returns:
            Dict with aggregated metrics
        """
        if not scores:
            return {
                "average_sentiment": 0.0,
                "weighted_sentiment": 0.0,
                "confidence_average": 0.0,
                "total_count": 0
            }

        # Equal weighting
        average_sentiment = statistics.mean(score.score for score in scores)
        confidence_average = statistics.mean(score.confidence for score in scores)

        # Confidence weighting
        if weighting_strategy in ["confidence", "confidence_recency"]:
            total_weight = sum(score.confidence for score in scores)
            if total_weight > 0:
                weighted_sentiment = sum(
                    score.score * score.confidence for score in scores
                ) / total_weight
            else:
                weighted_sentiment = average_sentiment
        else:
            weighted_sentiment = average_sentiment

        return {
            "average_sentiment": average_sentiment,
            "weighted_sentiment": weighted_sentiment,
            "confidence_average": confidence_average,
            "total_count": len(scores),
            "sentiment_std": statistics.stdev(score.score for score in scores) if len(scores) > 1 else 0.0,
            "confidence_std": statistics.stdev(score.confidence for score in scores) if len(scores) > 1 else 0.0
        }

    @staticmethod
    def calculate_sentiment_trend(
        historical_aggregations: List[SentimentAggregation],
        window_count: int = 5
    ) -> float:
        """
        Calculate sentiment trend over time windows.

        Returns:
            Trend value: positive = improving sentiment, negative = declining
        """
        if len(historical_aggregations) < 2:
            return 0.0

        # Sort by time
        sorted_aggs = sorted(historical_aggregations, key=lambda x: x.start_time)

        # Take last N windows
        recent_aggs = sorted_aggs[-window_count:] if len(sorted_aggs) >= window_count else sorted_aggs

        if len(recent_aggs) < 2:
            return 0.0

        # Calculate simple linear trend
        sentiments = [agg.weighted_sentiment for agg in recent_aggs]
        n = len(sentiments)

        # Simple slope calculation
        x_values = list(range(n))
        x_mean = statistics.mean(x_values)
        y_mean = statistics.mean(sentiments)

        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, sentiments))
        denominator = sum((x - x_mean) ** 2 for x in x_values)

        if denominator == 0:
            return 0.0

        slope = numerator / denominator
        return slope

    @staticmethod
    def calculate_data_quality_score(
        processed_contents: List[ProcessedContent],
        min_confidence: float = 0.5,
        min_entity_coverage: float = 0.1
    ) -> float:
        """
        Calculate overall data quality score for aggregation.

        Returns:
            Quality score from 0.0 to 1.0
        """
        if not processed_contents:
            return 0.0

        quality_factors = []

        # Factor 1: Average confidence
        avg_confidence = statistics.mean(content.overall_confidence for content in processed_contents)
        confidence_score = min(avg_confidence / min_confidence, 1.0)
        quality_factors.append(confidence_score)

        # Factor 2: Entity coverage
        avg_coverage = statistics.mean(content.entity_coverage for content in processed_contents)
        coverage_score = min(avg_coverage / min_entity_coverage, 1.0)
        quality_factors.append(coverage_score)

        # Factor 3: Source diversity
        diversity_score = 0.7
        quality_factors.append(diversity_score)

        # Factor 4: Processing success rate
        success_score = 1.0
        quality_factors.append(success_score)

        return statistics.mean(quality_factors)


class TimeWindowManager:
    """Manages different time windows for sentiment aggregation"""

    WINDOW_DEFINITIONS = {
        "1m": timedelta(minutes=1),
        "5m": timedelta(minutes=5),
        "15m": timedelta(minutes=15),
        "1h": timedelta(hours=1),
        "4h": timedelta(hours=4),
        "1d": timedelta(days=1),
        "1w": timedelta(weeks=1)
    }

    @classmethod
    def get_window_bounds(
        cls,
        window_size: str,
        reference_time: Optional[datetime] = None
    ) -> Tuple[datetime, datetime]:
        """
        Get aligned window bounds for a given window size.
        """
        if reference_time is None:
            reference_time = datetime.utcnow()

        if window_size not in cls.WINDOW_DEFINITIONS:
            raise ValueError(f"Unknown window size: {window_size}")

        window_delta = cls.WINDOW_DEFINITIONS[window_size]

        # Align to window boundaries
        if window_size == "1m":
            aligned_time = reference_time.replace(second=0, microsecond=0)
        elif window_size == "5m":
            minutes = (reference_time.minute // 5) * 5
            aligned_time = reference_time.replace(minute=minutes, second=0, microsecond=0)
        elif window_size == "15m":
            minutes = (reference_time.minute // 15) * 15
            aligned_time = reference_time.replace(minute=minutes, second=0, microsecond=0)
        elif window_size == "1h":
            aligned_time = reference_time.replace(minute=0, second=0, microsecond=0)
        elif window_size == "4h":
            hours = (reference_time.hour // 4) * 4
            aligned_time = reference_time.replace(hour=hours, minute=0, second=0, microsecond=0)
        elif window_size == "1d":
            aligned_time = reference_time.replace(hour=0, minute=0, second=0, microsecond=0)
        elif window_size == "1w":
            days_since_monday = reference_time.weekday()
            aligned_time = reference_time.replace(hour=0, minute=0, second=0, microsecond=0)
            aligned_time -= timedelta(days=days_since_monday)
        else:
            aligned_time = reference_time

        end_time = aligned_time
        start_time = end_time - window_delta

        return start_time, end_time

    @classmethod
    def get_historical_windows(
        cls,
        window_size: str,
        count: int,
        reference_time: Optional[datetime] = None
    ) -> List[Tuple[datetime, datetime]]:
        """Get multiple historical window bounds"""
        windows = []
        current_time = reference_time or datetime.utcnow()

        for i in range(count):
            window_start, window_end = cls.get_window_bounds(window_size, current_time)
            windows.append((window_start, window_end))
            current_time = window_start

        return list(reversed(windows))


class SentimentAggregationService:
    """Main sentiment aggregation service"""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.aggregator = SentimentAggregator()
        self.window_manager = TimeWindowManager()

    async def aggregate_sentiment(
        self,
        ticker: str,
        window_size: str = "1h",
        reference_time: Optional[datetime] = None
    ) -> SentimentAggregation:
        """Aggregate sentiment for a specific ticker and time window."""
        start_time, end_time = self.window_manager.get_window_bounds(window_size, reference_time)

        # Fetch processed content for the time window
        processed_contents = await self._fetch_processed_content_by_ticker(
            ticker, start_time, end_time
        )

        if not processed_contents:
            return SentimentAggregation(
                ticker=ticker,
                start_time=start_time,
                end_time=end_time,
                window_size=self.window_manager.WINDOW_DEFINITIONS[window_size],
                average_sentiment=0.0,
                weighted_sentiment=0.0,
                sentiment_trend=0.0,
                total_mentions=0,
                unique_sources=0,
                confidence_average=0.0,
                polarity_distribution={},
                data_quality_score=0.0,
                coverage_score=0.0,
                next_update=end_time + self.window_manager.WINDOW_DEFINITIONS[window_size]
            )

        # Extract sentiment scores for this ticker
        sentiment_scores = []
        for content in processed_contents:
            if ticker in content.ticker_sentiments:
                sentiment_scores.append(content.ticker_sentiments[ticker])

        # Aggregate sentiment scores
        aggregated_metrics = self.aggregator.aggregate_sentiment_scores(
            sentiment_scores,
            weighting_strategy="confidence"
        )

        # Calculate polarity distribution
        polarity_distribution = self._calculate_polarity_distribution(sentiment_scores)

        # Calculate trend
        historical_aggregations = await self._fetch_historical_aggregations(ticker, window_size, 5)
        sentiment_trend = self.aggregator.calculate_sentiment_trend(historical_aggregations)

        # Calculate quality scores
        data_quality_score = self.aggregator.calculate_data_quality_score(processed_contents)
        coverage_score = self._calculate_coverage_score(processed_contents, ticker)

        # Count unique sources
        unique_sources = len(set(content.content_id for content in processed_contents))

        aggregation = SentimentAggregation(
            ticker=ticker,
            start_time=start_time,
            end_time=end_time,
            window_size=self.window_manager.WINDOW_DEFINITIONS[window_size],
            average_sentiment=aggregated_metrics["average_sentiment"],
            weighted_sentiment=aggregated_metrics["weighted_sentiment"],
            sentiment_trend=sentiment_trend,
            total_mentions=aggregated_metrics["total_count"],
            unique_sources=unique_sources,
            confidence_average=aggregated_metrics["confidence_average"],
            polarity_distribution=polarity_distribution,
            data_quality_score=data_quality_score,
            coverage_score=coverage_score,
            next_update=end_time + self.window_manager.WINDOW_DEFINITIONS[window_size]
        )

        # Cache the aggregation
        await self._cache_aggregation(aggregation)

        return aggregation

    async def query_sentiment_data(
        self,
        request: SentimentQueryRequest
    ) -> SentimentQueryResponse:
        """Query sentiment data based on request parameters."""
        start_time = time.time()

        aggregations = []
        raw_content = []

        # Determine time range
        end_time = request.end_time or datetime.utcnow()
        start_time_query = request.start_time or (end_time - timedelta(hours=24))

        # Query by tickers
        if request.tickers:
            for ticker in request.tickers:
                windows = self.window_manager.get_historical_windows(
                    request.aggregation_window,
                    count=10,
                    reference_time=end_time
                )

                for window_start, window_end in windows:
                    if window_start >= start_time_query:
                        agg = await self.aggregate_sentiment(
                            ticker,
                            request.aggregation_window,
                            window_end
                        )
                        aggregations.append(agg)

        # Include raw content if requested
        if request.include_raw and request.tickers:
            for ticker in request.tickers:
                content_list = await self._fetch_processed_content_by_ticker(
                    ticker, start_time_query, end_time
                )
                filtered_content = [
                    content for content in content_list
                    if content.overall_confidence >= request.min_confidence
                ]
                raw_content.extend(filtered_content)

        # Apply pagination
        total_results = len(aggregations)
        paginated_aggregations = aggregations[request.offset:request.offset + request.limit]

        query_time = time.time() - start_time

        return SentimentQueryResponse(
            total_results=total_results,
            aggregations=paginated_aggregations,
            raw_content=raw_content if request.include_raw else None,
            query_time=query_time,
            cache_hit=False,
            next_update=datetime.utcnow() + timedelta(minutes=5)
        )

    async def _fetch_processed_content_by_ticker(
        self,
        ticker: str,
        start_time: datetime,
        end_time: datetime
    ) -> List[ProcessedContent]:
        """Fetch processed content that mentions a specific ticker"""
        content_keys = await self.redis.keys("processed_content:*")
        processed_contents = []

        for key in content_keys:
            try:
                content_data = await self.redis.get(key)
                if content_data:
                    content = ProcessedContent.parse_raw(content_data)

                    if (ticker in content.primary_tickers and
                        start_time <= content.processed_at <= end_time):
                        processed_contents.append(content)

            except Exception as e:
                logger.warning(f"Error parsing processed content {key}: {e}")

        return processed_contents

    async def _fetch_historical_aggregations(
        self,
        ticker: str,
        window_size: str,
        count: int
    ) -> List[SentimentAggregation]:
        """Fetch historical aggregations for trend calculation"""
        aggregations = []
        windows = self.window_manager.get_historical_windows(window_size, count)

        for start_time, end_time in windows:
            cache_key = f"sentiment_agg:{ticker}:{window_size}:{start_time.isoformat()}"
            cached_data = await self.redis.get(cache_key)

            if cached_data:
                try:
                    agg = SentimentAggregation.parse_raw(cached_data)
                    aggregations.append(agg)
                except Exception as e:
                    logger.warning(f"Error parsing cached aggregation {cache_key}: {e}")

        return aggregations

    def _calculate_polarity_distribution(
        self,
        sentiment_scores: List[SentimentScore]
    ) -> Dict[SentimentPolarity, int]:
        """Calculate distribution of sentiment polarities"""
        distribution = defaultdict(int)

        for score in sentiment_scores:
            distribution[score.polarity] += 1

        return dict(distribution)

    def _calculate_coverage_score(
        self,
        processed_contents: List[ProcessedContent],
        ticker: str
    ) -> float:
        """Calculate coverage score for a specific ticker"""
        if not processed_contents:
            return 0.0

        high_confidence_mentions = sum(
            1 for content in processed_contents
            if ticker in content.ticker_sentiments and
            content.ticker_sentiments[ticker].confidence > 0.7
        )

        return min(high_confidence_mentions / len(processed_contents), 1.0)

    async def _cache_aggregation(self, aggregation: SentimentAggregation):
        """Cache sentiment aggregation"""
        cache_key = (f"sentiment_agg:{aggregation.ticker}:"
                    f"{aggregation.window_size.total_seconds()}:"
                    f"{aggregation.start_time.isoformat()}")

        ttl = int(aggregation.window_size.total_seconds() * 2)
        await self.redis.setex(cache_key, ttl, aggregation.json())

    async def get_aggregation_stats(self) -> Dict[str, Any]:
        """Get aggregation service statistics"""
        agg_keys = await self.redis.keys("sentiment_agg:*")
        content_keys = await self.redis.keys("processed_content:*")

        return {
            "cached_aggregations": len(agg_keys),
            "processed_content_count": len(content_keys),
            "supported_windows": list(self.window_manager.WINDOW_DEFINITIONS.keys()),
            "timestamp": datetime.utcnow().isoformat()
        }


async def create_sentiment_aggregation_service(
    redis_url: str = "redis://localhost:6379"
) -> SentimentAggregationService:
    """Create sentiment aggregation service"""
    redis_client = aioredis.from_url(redis_url)
    return SentimentAggregationService(redis_client)