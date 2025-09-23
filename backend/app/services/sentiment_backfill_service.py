"""
Sentiment Data Backfill Service

This module provides comprehensive backfill capabilities for historical sentiment data
including job scheduling, progress tracking, data validation, and error recovery.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import json
from collections import defaultdict

from app.core.config import settings
from app.core.logging import logger
from app.models.sentiment_ingestion_models import (
    DataSourceConfig,
    IngestionJob,
    IngestionStatus,
    SentimentSource,
    RawContentItem
)
from app.services.redis_service import RedisService
from app.services.news_data_providers import NewsIngestionService
from app.services.social_media_providers import SocialMediaIngestionService
from app.services.nlp_pipeline import NLPPipeline


class BackfillStrategy(str, Enum):
    """Backfill execution strategies"""
    SEQUENTIAL = "sequential"      # Process sources one by one
    PARALLEL = "parallel"          # Process sources in parallel
    PRIORITY = "priority"          # Process high-priority sources first
    ADAPTIVE = "adaptive"          # Adapt based on API limits and performance


class BackfillPriority(str, Enum):
    """Backfill priority levels"""
    HIGH = "high"                  # Critical data sources
    MEDIUM = "medium"              # Important data sources
    LOW = "low"                    # Nice-to-have data sources


@dataclass
class BackfillJobConfig:
    """Configuration for a backfill job"""
    job_id: str
    ticker_symbols: List[str]
    sources: List[DataSourceConfig]
    start_date: datetime
    end_date: datetime
    strategy: BackfillStrategy
    priority: BackfillPriority
    batch_size: int = 100
    max_parallel_sources: int = 3
    retry_failed: bool = True
    max_retries: int = 3
    validate_data: bool = True
    process_nlp: bool = True


@dataclass
class BackfillProgress:
    """Progress tracking for backfill jobs"""
    job_id: str
    status: IngestionStatus
    sources_completed: int
    sources_total: int
    items_processed: int
    items_succeeded: int
    items_failed: int
    current_source: Optional[str] = None
    current_date_range: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    error_summary: Dict[str, int] = None
    start_time: datetime = None
    last_updated: datetime = None


class BackfillValidator:
    """Validates backfilled data quality and completeness"""

    def __init__(self):
        self.quality_thresholds = {
            'min_content_length': 20,
            'min_confidence_score': 0.3,
            'max_duplicate_ratio': 0.1,
            'min_success_rate': 0.8
        }

    def validate_batch(self, content_items: List[RawContentItem]) -> Tuple[bool, Dict[str, Any]]:
        """Validate a batch of content items"""
        if not content_items:
            return False, {'error': 'empty_batch'}

        validation_metrics = {
            'total_items': len(content_items),
            'quality_issues': [],
            'duplicate_count': 0,
            'short_content_count': 0,
            'low_confidence_count': 0
        }

        # Content length validation
        short_content = [
            item for item in content_items
            if len(item.content) < self.quality_thresholds['min_content_length']
        ]
        validation_metrics['short_content_count'] = len(short_content)

        # Duplicate detection (simplified)
        content_hashes = set()
        duplicate_count = 0
        for item in content_items:
            content_hash = hash(item.content)
            if content_hash in content_hashes:
                duplicate_count += 1
            content_hashes.add(content_hash)
        validation_metrics['duplicate_count'] = duplicate_count

        # Calculate quality scores
        short_content_ratio = len(short_content) / len(content_items)
        duplicate_ratio = duplicate_count / len(content_items)

        # Determine if batch passes validation
        passes_validation = (
            short_content_ratio < (1 - self.quality_thresholds['min_success_rate']) and
            duplicate_ratio <= self.quality_thresholds['max_duplicate_ratio']
        )

        if not passes_validation:
            validation_metrics['quality_issues'].extend([
                f"High short content ratio: {short_content_ratio:.2%}",
                f"High duplicate ratio: {duplicate_ratio:.2%}"
            ])

        return passes_validation, validation_metrics

    def validate_job_completion(self, job_progress: BackfillProgress) -> Tuple[bool, Dict[str, Any]]:
        """Validate overall job completion quality"""
        completion_metrics = {
            'success_rate': 0.0,
            'coverage_score': 0.0,
            'quality_score': 0.0,
            'issues': []
        }

        if job_progress.items_processed == 0:
            completion_metrics['issues'].append('No items processed')
            return False, completion_metrics

        # Calculate success rate
        success_rate = job_progress.items_succeeded / job_progress.items_processed
        completion_metrics['success_rate'] = success_rate

        # Calculate coverage score (sources completed vs total)
        coverage_score = job_progress.sources_completed / job_progress.sources_total
        completion_metrics['coverage_score'] = coverage_score

        # Quality score combines success rate and coverage
        quality_score = (success_rate + coverage_score) / 2
        completion_metrics['quality_score'] = quality_score

        # Check if meets minimum standards
        meets_standards = (
            success_rate >= self.quality_thresholds['min_success_rate'] and
            coverage_score >= 0.7  # At least 70% of sources completed
        )

        if not meets_standards:
            completion_metrics['issues'].extend([
                f"Low success rate: {success_rate:.2%}",
                f"Low coverage: {coverage_score:.2%}"
            ])

        return meets_standards, completion_metrics


class BackfillScheduler:
    """Schedules and manages backfill job execution"""

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.active_jobs: Dict[str, BackfillJobConfig] = {}
        self.job_progress: Dict[str, BackfillProgress] = {}

    async def schedule_backfill(self, config: BackfillJobConfig) -> str:
        """Schedule a new backfill job"""
        job_id = config.job_id

        # Initialize progress tracking
        progress = BackfillProgress(
            job_id=job_id,
            status=IngestionStatus.PENDING,
            sources_completed=0,
            sources_total=len(config.sources),
            items_processed=0,
            items_succeeded=0,
            items_failed=0,
            error_summary=defaultdict(int),
            start_time=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )

        self.active_jobs[job_id] = config
        self.job_progress[job_id] = progress

        # Store in Redis for persistence
        await self._persist_job_state(job_id)

        logger.info(f"Scheduled backfill job {job_id} with {len(config.sources)} sources")
        return job_id

    async def execute_backfill(self, job_id: str) -> BackfillProgress:
        """Execute a backfill job"""
        if job_id not in self.active_jobs:
            raise ValueError(f"Backfill job {job_id} not found")

        config = self.active_jobs[job_id]
        progress = self.job_progress[job_id]

        progress.status = IngestionStatus.PROCESSING
        await self._update_progress(progress)

        try:
            if config.strategy == BackfillStrategy.PARALLEL:
                await self._execute_parallel_backfill(config, progress)
            elif config.strategy == BackfillStrategy.PRIORITY:
                await self._execute_priority_backfill(config, progress)
            else:  # SEQUENTIAL or ADAPTIVE
                await self._execute_sequential_backfill(config, progress)

            progress.status = IngestionStatus.COMPLETED
            logger.info(f"Backfill job {job_id} completed successfully")

        except Exception as e:
            progress.status = IngestionStatus.FAILED
            logger.error(f"Backfill job {job_id} failed: {str(e)}")
            raise

        finally:
            await self._update_progress(progress)
            await self._cleanup_job(job_id)

        return progress

    async def _execute_sequential_backfill(self, config: BackfillJobConfig, progress: BackfillProgress):
        """Execute backfill sources sequentially"""
        for i, source_config in enumerate(config.sources):
            progress.current_source = source_config.source.value
            await self._update_progress(progress)

            try:
                await self._backfill_source(config, source_config, progress)
                progress.sources_completed += 1

            except Exception as e:
                logger.error(f"Error backfilling source {source_config.source}: {str(e)}")
                progress.error_summary[f"{source_config.source.value}_error"] += 1

                if not config.retry_failed:
                    raise

            await self._update_progress(progress)

    async def _execute_parallel_backfill(self, config: BackfillJobConfig, progress: BackfillProgress):
        """Execute backfill sources in parallel"""
        semaphore = asyncio.Semaphore(config.max_parallel_sources)

        async def backfill_source_with_semaphore(source_config):
            async with semaphore:
                try:
                    await self._backfill_source(config, source_config, progress)
                    progress.sources_completed += 1
                except Exception as e:
                    logger.error(f"Error backfilling source {source_config.source}: {str(e)}")
                    progress.error_summary[f"{source_config.source.value}_error"] += 1

        tasks = [
            backfill_source_with_semaphore(source_config)
            for source_config in config.sources
        ]

        await asyncio.gather(*tasks, return_exceptions=True)

    async def _execute_priority_backfill(self, config: BackfillJobConfig, progress: BackfillProgress):
        """Execute backfill based on source priority"""
        # Sort sources by priority (assuming we add priority to DataSourceConfig)
        priority_order = {
            SentimentSource.BLOOMBERG: 1,
            SentimentSource.REUTERS: 1,
            SentimentSource.FINANCIAL_TIMES: 2,
            SentimentSource.CNBC: 2,
            SentimentSource.NEWS_API: 3,
            SentimentSource.YAHOO_FINANCE: 3,
            SentimentSource.TWITTER: 4,
            SentimentSource.REDDIT: 4
        }

        sorted_sources = sorted(
            config.sources,
            key=lambda x: priority_order.get(x.source, 5)
        )

        # Execute high priority sources first
        for source_config in sorted_sources:
            progress.current_source = source_config.source.value
            await self._update_progress(progress)

            try:
                await self._backfill_source(config, source_config, progress)
                progress.sources_completed += 1
            except Exception as e:
                logger.error(f"Error backfilling source {source_config.source}: {str(e)}")
                progress.error_summary[f"{source_config.source.value}_error"] += 1

            await self._update_progress(progress)

    async def _backfill_source(
        self,
        config: BackfillJobConfig,
        source_config: DataSourceConfig,
        progress: BackfillProgress
    ):
        """Backfill data from a specific source"""
        current_date = config.start_date
        validator = BackfillValidator()

        while current_date < config.end_date:
            # Calculate batch date range
            batch_end_date = min(current_date + timedelta(days=1), config.end_date)
            progress.current_date_range = f"{current_date.date()} to {batch_end_date.date()}"
            await self._update_progress(progress)

            try:
                # Fetch content for this date range
                content_items = await self._fetch_source_content(
                    source_config=source_config,
                    ticker_symbols=config.ticker_symbols,
                    start_date=current_date,
                    end_date=batch_end_date,
                    batch_size=config.batch_size
                )

                # Validate batch if enabled
                if config.validate_data:
                    is_valid, validation_metrics = validator.validate_batch(content_items)
                    if not is_valid:
                        logger.warning(
                            f"Batch validation failed for {source_config.source} "
                            f"on {current_date.date()}: {validation_metrics}"
                        )

                # Process with NLP pipeline if enabled
                if config.process_nlp and content_items:
                    nlp_pipeline = NLPPipeline(self.redis_service)
                    nlp_results = await nlp_pipeline.batch_process_content(content_items)
                    logger.info(f"Processed {len(nlp_results)} items through NLP pipeline")

                # Update progress
                progress.items_processed += len(content_items)
                progress.items_succeeded += len(content_items)

            except Exception as e:
                logger.error(
                    f"Error backfilling {source_config.source} "
                    f"for date range {current_date.date()}: {str(e)}"
                )
                progress.items_failed += 1
                progress.error_summary[f"{source_config.source.value}_date_error"] += 1

                if not config.retry_failed:
                    raise

            # Move to next day
            current_date = batch_end_date
            await self._update_progress(progress)

            # Add small delay to respect rate limits
            await asyncio.sleep(0.1)

    async def _fetch_source_content(
        self,
        source_config: DataSourceConfig,
        ticker_symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        batch_size: int
    ) -> List[RawContentItem]:
        """Fetch content from a specific source for backfill"""

        # Create appropriate service based on source type
        if source_config.source in [SentimentSource.NEWS_API, SentimentSource.CNBC, SentimentSource.YAHOO_FINANCE]:
            service = NewsIngestionService(self.redis_service)
        elif source_config.source in [SentimentSource.TWITTER, SentimentSource.REDDIT]:
            service = SocialMediaIngestionService(self.redis_service)
        else:
            logger.warning(f"Unsupported source type for backfill: {source_config.source}")
            return []

        # Execute ingestion job
        job = await service.start_ingestion_job(
            sources=[source_config],
            keywords=ticker_symbols,  # Use ticker symbols as keywords
            start_date=start_date,
            end_date=end_date,
            job_type="backfill"
        )

        # For now, return empty list (in production, this would return actual content)
        # The ingestion service would store the content and we'd retrieve it
        return []

    async def get_job_progress(self, job_id: str) -> Optional[BackfillProgress]:
        """Get progress for a backfill job"""
        return self.job_progress.get(job_id)

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running backfill job"""
        if job_id in self.active_jobs:
            progress = self.job_progress.get(job_id)
            if progress:
                progress.status = IngestionStatus.FAILED
                progress.error_summary["user_cancelled"] = 1
                await self._update_progress(progress)

            await self._cleanup_job(job_id)
            return True

        return False

    async def _update_progress(self, progress: BackfillProgress):
        """Update job progress and persist to Redis"""
        progress.last_updated = datetime.utcnow()

        # Calculate estimated completion
        if progress.sources_completed > 0:
            elapsed_time = progress.last_updated - progress.start_time
            avg_time_per_source = elapsed_time / progress.sources_completed
            remaining_sources = progress.sources_total - progress.sources_completed
            estimated_remaining = avg_time_per_source * remaining_sources
            progress.estimated_completion = progress.last_updated + estimated_remaining

        # Persist to Redis
        cache_key = f"backfill_progress:{progress.job_id}"
        async with self.redis_service.get_redis() as redis:
            await redis.setex(
                cache_key,
                86400,  # 24 hour expiry
                json.dumps(progress.__dict__, default=str)
            )

    async def _persist_job_state(self, job_id: str):
        """Persist job configuration and progress to Redis"""
        config = self.active_jobs[job_id]
        progress = self.job_progress[job_id]

        async with self.redis_service.get_redis() as redis:
            # Store job config
            config_key = f"backfill_config:{job_id}"
            await redis.setex(
                config_key,
                86400,
                json.dumps(config.__dict__, default=str)
            )

            # Store progress
            await self._update_progress(progress)

    async def _cleanup_job(self, job_id: str):
        """Clean up job resources"""
        if job_id in self.active_jobs:
            del self.active_jobs[job_id]

        # Keep progress for historical tracking
        # Don't delete from job_progress or Redis


class SentimentBackfillService:
    """Main service for managing sentiment data backfill operations"""

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.scheduler = BackfillScheduler(redis_service)

    async def create_backfill_job(
        self,
        ticker_symbols: List[str],
        sources: List[SentimentSource],
        start_date: datetime,
        end_date: datetime,
        strategy: BackfillStrategy = BackfillStrategy.SEQUENTIAL,
        priority: BackfillPriority = BackfillPriority.MEDIUM
    ) -> str:
        """Create and schedule a new backfill job"""

        # Create source configurations
        source_configs = []
        for source in sources:
            config = DataSourceConfig(
                source=source,
                enabled=True,
                rate_limit_requests=100,
                rate_limit_period=3600,
                backfill_enabled=True,
                backfill_days=(end_date - start_date).days
            )
            source_configs.append(config)

        # Create job configuration
        job_config = BackfillJobConfig(
            job_id=f"backfill_{int(datetime.utcnow().timestamp())}",
            ticker_symbols=ticker_symbols,
            sources=source_configs,
            start_date=start_date,
            end_date=end_date,
            strategy=strategy,
            priority=priority
        )

        # Schedule the job
        job_id = await self.scheduler.schedule_backfill(job_config)

        logger.info(
            f"Created backfill job {job_id} for tickers {ticker_symbols} "
            f"from {start_date.date()} to {end_date.date()}"
        )

        return job_id

    async def execute_backfill_job(self, job_id: str) -> BackfillProgress:
        """Execute a scheduled backfill job"""
        return await self.scheduler.execute_backfill(job_id)

    async def get_job_status(self, job_id: str) -> Optional[BackfillProgress]:
        """Get status of a backfill job"""
        return await self.scheduler.get_job_progress(job_id)

    async def cancel_backfill_job(self, job_id: str) -> bool:
        """Cancel a running backfill job"""
        return await self.scheduler.cancel_job(job_id)

    async def get_active_jobs(self) -> List[BackfillProgress]:
        """Get all active backfill jobs"""
        active_jobs = []
        for job_id in self.scheduler.active_jobs.keys():
            progress = await self.scheduler.get_job_progress(job_id)
            if progress and progress.status == IngestionStatus.PROCESSING:
                active_jobs.append(progress)
        return active_jobs