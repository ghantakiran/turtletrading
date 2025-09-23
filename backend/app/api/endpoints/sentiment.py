"""
Sentiment Analysis & NER API Endpoints

Advanced sentiment analysis endpoints using the comprehensive sentiment ingestion and NER system.
Provides real-time sentiment aggregation, entity analysis, and content ingestion management.
"""

from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import asyncio
import redis.asyncio as aioredis

from app.models.sentiment_ner_models import (
    SentimentQueryRequest, SentimentQueryResponse, SentimentAggregation,
    ProcessedContent, RawContent, NamedEntity, SentimentScore, SentimentPolarity,
    EntityType, ProviderType, ContentType, IngestionRequest, IngestionResponse,
    BackfillRequest, BackfillResponse, NERAnalysisRequest, NERAnalysisResponse
)
from app.services.sentiment_aggregation_service import SentimentAggregationService, create_sentiment_aggregation_service
from app.services.nlp_pipeline_service import NLPPipelineService, create_nlp_pipeline_service
from app.services.content_ingestion_service import ContentIngestionService, create_content_ingestion_service
from app.core.config import settings
from loguru import logger

router = APIRouter()

# Initialize services
_sentiment_service: Optional[SentimentAggregationService] = None
_nlp_service: Optional[NLPPipelineService] = None
_ingestion_service: Optional[ContentIngestionService] = None


async def get_sentiment_service() -> SentimentAggregationService:
    """Get or initialize sentiment aggregation service"""
    global _sentiment_service
    if _sentiment_service is None:
        _sentiment_service = await create_sentiment_aggregation_service(settings.REDIS_URL)
    return _sentiment_service


async def get_nlp_service() -> NLPPipelineService:
    """Get or initialize NLP pipeline service"""
    global _nlp_service
    if _nlp_service is None:
        _nlp_service = await create_nlp_pipeline_service(settings.REDIS_URL)
    return _nlp_service


async def get_ingestion_service() -> ContentIngestionService:
    """Get or initialize content ingestion service"""
    global _ingestion_service
    if _ingestion_service is None:
        _ingestion_service = await create_content_ingestion_service(settings.REDIS_URL)
    return _ingestion_service


# Sentiment Aggregation Endpoints
@router.get("/query", response_model=SentimentQueryResponse)
async def query_sentiment_data(
    tickers: Optional[List[str]] = Query(None, description="Stock symbols to query"),
    start_time: Optional[datetime] = Query(None, description="Start time for query"),
    end_time: Optional[datetime] = Query(None, description="End time for query"),
    aggregation_window: str = Query("1h", description="Aggregation window (1m, 5m, 15m, 1h, 4h, 1d, 1w)"),
    min_confidence: float = Query(0.5, description="Minimum confidence threshold", ge=0.0, le=1.0),
    include_raw: bool = Query(False, description="Include raw content in response"),
    limit: int = Query(50, description="Maximum results to return", ge=1, le=1000),
    offset: int = Query(0, description="Results offset", ge=0),
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service)
):
    """
    Query sentiment data with advanced filtering and aggregation options.

    This endpoint provides comprehensive sentiment analysis across multiple tickers,
    time ranges, and aggregation windows with confidence-based filtering.
    """
    try:
        request = SentimentQueryRequest(
            tickers=tickers,
            start_time=start_time,
            end_time=end_time,
            aggregation_window=aggregation_window,
            min_confidence=min_confidence,
            include_raw=include_raw,
            limit=limit,
            offset=offset
        )

        response = await sentiment_service.query_sentiment_data(request)
        return response

    except Exception as e:
        logger.error(f"Error querying sentiment data: {e}")
        raise HTTPException(status_code=500, detail=f"Error querying sentiment data: {str(e)}")


@router.get("/aggregation/{ticker}", response_model=SentimentAggregation)
async def get_sentiment_aggregation(
    ticker: str,
    window_size: str = Query("1h", description="Time window size (1m, 5m, 15m, 1h, 4h, 1d, 1w)"),
    reference_time: Optional[datetime] = Query(None, description="Reference time for window"),
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service)
):
    """
    Get sentiment aggregation for a specific ticker and time window.

    Returns confidence-weighted sentiment scoring, trend analysis, and
    quality metrics for the specified ticker and time window.
    """
    try:
        ticker = ticker.upper()
        aggregation = await sentiment_service.aggregate_sentiment(
            ticker=ticker,
            window_size=window_size,
            reference_time=reference_time
        )

        if not aggregation:
            raise HTTPException(
                status_code=404,
                detail=f"Sentiment aggregation for {ticker} not found"
            )

        return aggregation

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sentiment aggregation for {ticker}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting sentiment aggregation: {str(e)}"
        )


@router.get("/aggregation/stats", response_model=Dict[str, Any])
async def get_aggregation_stats(
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service)
):
    """Get sentiment aggregation service statistics and health metrics."""
    try:
        stats = await sentiment_service.get_aggregation_stats()
        return stats

    except Exception as e:
        logger.error(f"Error getting aggregation stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")


# Content Analysis and NER Endpoints
@router.post("/analyze", response_model=NERAnalysisResponse)
async def analyze_content(
    request: NERAnalysisRequest,
    nlp_service: NLPPipelineService = Depends(get_nlp_service)
):
    """
    Analyze content using the advanced NLP pipeline with NER and sentiment analysis.

    Processes raw text content to extract named entities, sentiment scores,
    and ticker mappings with confidence scoring.
    """
    try:
        processed_content = await nlp_service.process_content(
            content_id=request.content_id,
            text=request.text,
            content_type=request.content_type,
            source_url=request.source_url,
            metadata=request.metadata or {}
        )

        return NERAnalysisResponse(
            content_id=request.content_id,
            processed_content=processed_content,
            processing_time=0.0,  # Will be calculated by the service
            success=True
        )

    except Exception as e:
        logger.error(f"Error analyzing content {request.content_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing content: {str(e)}"
        )


@router.get("/entities", response_model=List[NamedEntity])
async def get_entities(
    entity_type: Optional[EntityType] = Query(None, description="Filter by entity type"),
    ticker: Optional[str] = Query(None, description="Filter by ticker symbol"),
    min_confidence: float = Query(0.7, description="Minimum confidence threshold", ge=0.0, le=1.0),
    limit: int = Query(100, description="Maximum entities to return", ge=1, le=1000),
    offset: int = Query(0, description="Results offset", ge=0),
    nlp_service: NLPPipelineService = Depends(get_nlp_service)
):
    """
    Get named entities with optional filtering by type, ticker, and confidence.

    Returns a list of named entities extracted from processed content
    with their confidence scores and ticker mappings.
    """
    try:
        entities = await nlp_service.get_entities(
            entity_type=entity_type,
            ticker=ticker,
            min_confidence=min_confidence,
            limit=limit,
            offset=offset
        )

        return entities

    except Exception as e:
        logger.error(f"Error getting entities: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting entities: {str(e)}")


@router.get("/content/{content_id}", response_model=ProcessedContent)
async def get_processed_content(
    content_id: str,
    nlp_service: NLPPipelineService = Depends(get_nlp_service)
):
    """Get processed content by content ID with full NER and sentiment analysis."""
    try:
        content = await nlp_service.get_processed_content(content_id)

        if not content:
            raise HTTPException(
                status_code=404,
                detail=f"Processed content {content_id} not found"
            )

        return content

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting processed content {content_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting processed content: {str(e)}"
        )


# Content Ingestion Endpoints
@router.post("/ingest", response_model=IngestionResponse)
async def ingest_content(
    request: IngestionRequest,
    background_tasks: BackgroundTasks,
    ingestion_service: ContentIngestionService = Depends(get_ingestion_service)
):
    """
    Ingest content from various providers with rate limiting and deduplication.

    Supports multiple content providers (NewsAPI, Reddit) with automatic
    rate limiting, content deduplication, and background processing.
    """
    try:
        response = await ingestion_service.ingest_from_providers(
            providers=request.providers,
            query_params=request.query_params,
            content_types=request.content_types,
            max_items=request.max_items,
            process_immediately=request.process_immediately
        )

        return response

    except Exception as e:
        logger.error(f"Error ingesting content: {e}")
        raise HTTPException(status_code=500, detail=f"Error ingesting content: {str(e)}")


@router.post("/backfill", response_model=BackfillResponse)
async def backfill_historical_data(
    request: BackfillRequest,
    background_tasks: BackgroundTasks,
    ingestion_service: ContentIngestionService = Depends(get_ingestion_service)
):
    """
    Backfill historical content data for specified date ranges and tickers.

    Performs historical data ingestion with automatic chunking and
    background processing to avoid overwhelming data providers.
    """
    try:
        background_tasks.add_task(
            ingestion_service.backfill_historical_data,
            start_date=request.start_date,
            end_date=request.end_date,
            tickers=request.tickers,
            providers=request.providers,
            max_items_per_day=request.max_items_per_day
        )

        return BackfillResponse(
            backfill_id=f"backfill_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            status="started",
            start_date=request.start_date,
            end_date=request.end_date,
            tickers=request.tickers,
            providers=request.providers,
            estimated_completion=datetime.utcnow() + timedelta(hours=1)
        )

    except Exception as e:
        logger.error(f"Error starting backfill: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting backfill: {str(e)}")


@router.get("/ingestion/status", response_model=Dict[str, Any])
async def get_ingestion_status(
    ingestion_service: ContentIngestionService = Depends(get_ingestion_service)
):
    """Get content ingestion service status and rate limiting information."""
    try:
        status = await ingestion_service.get_ingestion_status()
        return status

    except Exception as e:
        logger.error(f"Error getting ingestion status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting ingestion status: {str(e)}")


# Real-time and Streaming Endpoints
@router.get("/stream/sentiment/{ticker}")
async def stream_sentiment_updates(
    ticker: str,
    window_size: str = Query("1m", description="Update window size"),
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service)
):
    """
    Stream real-time sentiment updates for a ticker (WebSocket upgrade recommended).

    This endpoint provides the data structure for real-time sentiment streaming.
    For actual streaming, use the WebSocket endpoint with sentiment subscriptions.
    """
    try:
        ticker = ticker.upper()
        aggregation = await sentiment_service.aggregate_sentiment(
            ticker=ticker,
            window_size=window_size
        )

        return {
            "ticker": ticker,
            "window_size": window_size,
            "current_sentiment": aggregation,
            "stream_info": {
                "websocket_endpoint": f"/ws/{{client_id}}",
                "subscription_message": {
                    "type": "subscribe_sentiment",
                    "ticker": ticker,
                    "window_size": window_size
                }
            },
            "timestamp": datetime.utcnow()
        }

    except Exception as e:
        logger.error(f"Error getting sentiment stream info for {ticker}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting sentiment stream info: {str(e)}"
        )


# Batch and Utility Endpoints
@router.post("/batch/analyze", response_model=List[NERAnalysisResponse])
async def batch_analyze_content(
    requests: List[NERAnalysisRequest],
    nlp_service: NLPPipelineService = Depends(get_nlp_service)
):
    """
    Batch analyze multiple content items using the NLP pipeline.

    Processes multiple content items concurrently with proper error handling
    and rate limiting to prevent service overload.
    """
    try:
        if len(requests) > 50:
            raise HTTPException(
                status_code=400,
                detail="Maximum 50 content items allowed per batch"
            )

        # Process content items concurrently
        tasks = [
            nlp_service.process_content(
                content_id=req.content_id,
                text=req.text,
                content_type=req.content_type,
                source_url=req.source_url,
                metadata=req.metadata or {}
            )
            for req in requests
        ]

        processed_contents = await asyncio.gather(*tasks, return_exceptions=True)

        responses = []
        for i, (req, result) in enumerate(zip(requests, processed_contents)):
            if isinstance(result, Exception):
                responses.append(NERAnalysisResponse(
                    content_id=req.content_id,
                    processed_content=None,
                    processing_time=0.0,
                    success=False,
                    error=str(result)
                ))
            else:
                responses.append(NERAnalysisResponse(
                    content_id=req.content_id,
                    processed_content=result,
                    processing_time=0.0,
                    success=True
                ))

        return responses

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch content analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error in batch analysis: {str(e)}"
        )


@router.get("/health", response_model=Dict[str, Any])
async def sentiment_health_check(
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service),
    nlp_service: NLPPipelineService = Depends(get_nlp_service),
    ingestion_service: ContentIngestionService = Depends(get_ingestion_service)
):
    """Comprehensive health check for all sentiment analysis services."""
    try:
        health_status = {
            "timestamp": datetime.utcnow(),
            "services": {
                "sentiment_aggregation": "healthy",
                "nlp_pipeline": "healthy",
                "content_ingestion": "healthy"
            },
            "redis_connection": "checking"
        }

        # Check Redis connection
        try:
            redis_client = aioredis.from_url(settings.REDIS_URL)
            await redis_client.ping()
            await redis_client.close()
            health_status["redis_connection"] = "healthy"
        except Exception as e:
            health_status["redis_connection"] = f"unhealthy: {str(e)}"
            health_status["services"]["sentiment_aggregation"] = "degraded"
            health_status["services"]["nlp_pipeline"] = "degraded"
            health_status["services"]["content_ingestion"] = "degraded"

        # Get service statistics
        try:
            aggregation_stats = await sentiment_service.get_aggregation_stats()
            health_status["aggregation_stats"] = aggregation_stats
        except Exception as e:
            health_status["services"]["sentiment_aggregation"] = f"unhealthy: {str(e)}"

        try:
            ingestion_stats = await ingestion_service.get_ingestion_status()
            health_status["ingestion_stats"] = ingestion_stats
        except Exception as e:
            health_status["services"]["content_ingestion"] = f"unhealthy: {str(e)}"

        # Determine overall health
        unhealthy_services = [
            service for service, status in health_status["services"].items()
            if status != "healthy"
        ]

        health_status["overall_status"] = "healthy" if not unhealthy_services else "degraded"
        health_status["unhealthy_services"] = unhealthy_services

        return health_status

    except Exception as e:
        logger.error(f"Error in sentiment health check: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error checking sentiment service health: {str(e)}"
        )


# Legacy Compatibility Endpoints (maintaining backwards compatibility)
@router.get("/market", response_model=Dict[str, Any])
async def get_market_sentiment_legacy(
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service)
):
    """Legacy endpoint for overall market sentiment (backwards compatibility)."""
    try:
        # Query sentiment for major market tickers
        major_tickers = ["SPY", "QQQ", "DIA", "IWM", "VIX"]

        request = SentimentQueryRequest(
            tickers=major_tickers,
            aggregation_window="1h",
            min_confidence=0.5,
            limit=100
        )

        response = await sentiment_service.query_sentiment_data(request)

        # Calculate overall market sentiment
        if response.aggregations:
            market_sentiment = sum(agg.weighted_sentiment for agg in response.aggregations) / len(response.aggregations)
            market_confidence = sum(agg.confidence_average for agg in response.aggregations) / len(response.aggregations)
        else:
            market_sentiment = 0.0
            market_confidence = 0.0

        return {
            "timestamp": datetime.utcnow(),
            "market_sentiment": market_sentiment,
            "market_confidence": market_confidence,
            "total_mentions": sum(agg.total_mentions for agg in response.aggregations),
            "tickers_analyzed": major_tickers,
            "aggregations": response.aggregations[:5]  # Top 5 for legacy compatibility
        }

    except Exception as e:
        logger.error(f"Error getting legacy market sentiment: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting market sentiment: {str(e)}"
        )


@router.get("/{symbol}", response_model=Dict[str, Any])
async def get_stock_sentiment_legacy(
    symbol: str,
    timeframe: str = Query("1h", description="Timeframe (1h, 4h, 1d, 1w)"),
    sentiment_service: SentimentAggregationService = Depends(get_sentiment_service)
):
    """Legacy endpoint for stock sentiment (backwards compatibility)."""
    try:
        symbol = symbol.upper()

        aggregation = await sentiment_service.aggregate_sentiment(
            ticker=symbol,
            window_size=timeframe
        )

        if not aggregation:
            raise HTTPException(
                status_code=404,
                detail=f"Sentiment data for {symbol} not found"
            )

        return {
            "timestamp": datetime.utcnow(),
            "symbol": symbol,
            "timeframe": timeframe,
            "sentiment_score": aggregation.weighted_sentiment,
            "confidence": aggregation.confidence_average,
            "total_mentions": aggregation.total_mentions,
            "unique_sources": aggregation.unique_sources,
            "sentiment_trend": aggregation.sentiment_trend,
            "polarity_distribution": aggregation.polarity_distribution,
            "data_quality_score": aggregation.data_quality_score,
            "next_update": aggregation.next_update
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting legacy stock sentiment for {symbol}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting stock sentiment: {str(e)}"
        )