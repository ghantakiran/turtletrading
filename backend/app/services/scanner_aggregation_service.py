"""
Scanner Result Aggregation Service

Combines and aggregates results from multiple scanners to provide
unified insights, rankings, and portfolio-level analysis.
"""

import asyncio
from typing import Dict, List, Set, Optional, Tuple, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict, Counter
import statistics
import logging

from ..models.scanner_models import (
    ScanResult, ScannerResponse, SavedScanner, ScanFilter,
    AggregatedScanResult, PortfolioAnalysis, ScannerInsight
)

logger = logging.getLogger(__name__)


@dataclass
class ScannerWeight:
    """Weight configuration for scanner aggregation"""
    scanner_id: str
    weight: float = 1.0
    priority: int = 1  # 1-5 scale, 5 being highest priority
    confidence_multiplier: float = 1.0


@dataclass
class AggregationConfig:
    """Configuration for result aggregation"""
    min_scanners_required: int = 2
    max_results: int = 100
    min_aggregate_score: float = 60.0
    enable_diversity_scoring: bool = True
    weight_by_scanner_performance: bool = True
    include_sector_analysis: bool = True
    lookback_days: int = 30


@dataclass
class ScannerPerformance:
    """Track scanner performance metrics"""
    scanner_id: str
    total_scans: int = 0
    successful_matches: int = 0
    false_positives: int = 0
    average_score: float = 0.0
    reliability_score: float = 0.0
    last_updated: datetime = field(default_factory=datetime.utcnow)


class ScannerAggregationService:
    """
    Aggregates results from multiple scanners to provide unified insights
    and portfolio-level analysis.
    """

    def __init__(self):
        self.scanner_weights: Dict[str, ScannerWeight] = {}
        self.scanner_performance: Dict[str, ScannerPerformance] = {}
        self.config = AggregationConfig()

        # Result caching
        self.aggregated_results_cache: Dict[str, AggregatedScanResult] = {}
        self.cache_expiry: Dict[str, datetime] = {}

        # Portfolio tracking
        self.portfolio_symbols: Set[str] = set()
        self.watchlist_symbols: Set[str] = set()

    def configure_aggregation(self, config: AggregationConfig):
        """Configure aggregation parameters"""
        self.config = config

    def set_scanner_weight(self, scanner_id: str, weight: float,
                          priority: int = 1, confidence_multiplier: float = 1.0):
        """Set weight for a specific scanner"""
        self.scanner_weights[scanner_id] = ScannerWeight(
            scanner_id=scanner_id,
            weight=weight,
            priority=priority,
            confidence_multiplier=confidence_multiplier
        )

    def set_portfolio_symbols(self, symbols: List[str]):
        """Set current portfolio symbols for tracking"""
        self.portfolio_symbols = set(symbols)

    def set_watchlist_symbols(self, symbols: List[str]):
        """Set watchlist symbols for tracking"""
        self.watchlist_symbols = set(symbols)

    async def aggregate_scanner_results(self,
                                      scanner_results: List[Tuple[SavedScanner, ScannerResponse]],
                                      force_refresh: bool = False) -> List[AggregatedScanResult]:
        """
        Aggregate results from multiple scanners

        Args:
            scanner_results: List of (scanner, response) pairs
            force_refresh: Force recalculation ignoring cache

        Returns:
            List of aggregated results ranked by composite score
        """
        try:
            # Check cache
            cache_key = self._generate_cache_key(scanner_results)
            if not force_refresh and self._is_cache_valid(cache_key):
                cached_result = self.aggregated_results_cache.get(cache_key)
                if cached_result:
                    return [cached_result]

            # Collect all symbols and their results
            symbol_results: Dict[str, List[Tuple[SavedScanner, ScanResult]]] = defaultdict(list)
            scanner_metadata = {}

            for scanner, response in scanner_results:
                scanner_metadata[scanner.scanner_id] = scanner
                for result in response.results:
                    symbol_results[result.symbol].append((scanner, result))

            # Generate aggregated results
            aggregated_results = []

            for symbol, results in symbol_results.items():
                if len(results) >= self.config.min_scanners_required:
                    aggregated_result = await self._create_aggregated_result(
                        symbol, results, scanner_metadata
                    )

                    if aggregated_result.aggregate_score >= self.config.min_aggregate_score:
                        aggregated_results.append(aggregated_result)

            # Sort by aggregate score
            aggregated_results.sort(key=lambda x: x.aggregate_score, reverse=True)

            # Apply result limit
            aggregated_results = aggregated_results[:self.config.max_results]

            # Cache results
            if aggregated_results:
                main_result = aggregated_results[0]  # Cache top result
                self.aggregated_results_cache[cache_key] = main_result
                self.cache_expiry[cache_key] = datetime.utcnow() + timedelta(minutes=5)

            return aggregated_results

        except Exception as e:
            logger.error(f"Error aggregating scanner results: {e}")
            return []

    async def _create_aggregated_result(self,
                                      symbol: str,
                                      results: List[Tuple[SavedScanner, ScanResult]],
                                      scanner_metadata: Dict[str, SavedScanner]) -> AggregatedScanResult:
        """Create aggregated result for a symbol"""

        # Calculate weighted scores
        total_weight = 0
        weighted_score_sum = 0
        scanner_contributions = []
        matched_filters = set()
        all_tags = set()

        for scanner, result in results:
            scanner_weight = self._get_scanner_weight(scanner.scanner_id)
            effective_weight = scanner_weight.weight * scanner_weight.confidence_multiplier

            weighted_score = result.match_score * effective_weight
            weighted_score_sum += weighted_score
            total_weight += effective_weight

            scanner_contributions.append({
                'scanner_id': scanner.scanner_id,
                'scanner_name': scanner.name,
                'score': result.match_score,
                'weight': effective_weight,
                'matched_filters': result.matched_filters,
                'tags': result.tags or []
            })

            matched_filters.update(result.matched_filters)
            if result.tags:
                all_tags.update(result.tags)

        # Calculate aggregate score
        base_score = weighted_score_sum / total_weight if total_weight > 0 else 0

        # Apply diversity bonus
        diversity_bonus = 0
        if self.config.enable_diversity_scoring:
            diversity_bonus = self._calculate_diversity_bonus(results)

        # Apply consensus bonus (more scanners agreeing)
        consensus_bonus = min(len(results) * 2, 10)  # Max 10 point bonus

        aggregate_score = min(base_score + diversity_bonus + consensus_bonus, 100)

        # Calculate confidence based on agreement
        scores = [result.match_score for _, result in results]
        score_std = statistics.stdev(scores) if len(scores) > 1 else 0
        confidence = max(0, 100 - score_std * 2)  # Lower std dev = higher confidence

        # Determine priority
        priority = self._calculate_priority(symbol, aggregate_score, len(results))

        # Generate insights
        insights = self._generate_insights(symbol, results, scanner_metadata)

        return AggregatedScanResult(
            symbol=symbol,
            aggregate_score=round(aggregate_score, 2),
            confidence=round(confidence, 2),
            scanner_count=len(results),
            scanner_contributions=scanner_contributions,
            matched_filters=list(matched_filters),
            consensus_tags=list(all_tags),
            priority=priority,
            timestamp=datetime.utcnow(),
            insights=insights,
            diversity_score=round(diversity_bonus, 2),
            consensus_score=round(consensus_bonus, 2)
        )

    def _get_scanner_weight(self, scanner_id: str) -> ScannerWeight:
        """Get weight configuration for scanner"""
        if scanner_id in self.scanner_weights:
            return self.scanner_weights[scanner_id]

        # Auto-weight based on performance if available
        if self.config.weight_by_scanner_performance:
            performance = self.scanner_performance.get(scanner_id)
            if performance:
                weight = performance.reliability_score / 100
                return ScannerWeight(
                    scanner_id=scanner_id,
                    weight=weight,
                    confidence_multiplier=performance.reliability_score / 100
                )

        return ScannerWeight(scanner_id=scanner_id)

    def _calculate_diversity_bonus(self, results: List[Tuple[SavedScanner, ScanResult]]) -> float:
        """Calculate diversity bonus based on scanner types"""
        scanner_types = set()

        for scanner, result in results:
            # Classify scanner type based on filters
            if any('technical' in f.lower() or 'rsi' in f.lower() or 'macd' in f.lower()
                   for f in result.matched_filters):
                scanner_types.add('technical')
            if any('fundamental' in f.lower() or 'pe' in f.lower() or 'revenue' in f.lower()
                   for f in result.matched_filters):
                scanner_types.add('fundamental')
            if any('volume' in f.lower() or 'price' in f.lower()
                   for f in result.matched_filters):
                scanner_types.add('price_volume')
            if any('momentum' in f.lower() or 'trend' in f.lower()
                   for f in result.matched_filters):
                scanner_types.add('momentum')

        # Bonus for diverse scanner types
        diversity_multiplier = len(scanner_types) * 1.5
        return min(diversity_multiplier, 8)  # Max 8 point bonus

    def _calculate_priority(self, symbol: str, score: float, scanner_count: int) -> str:
        """Calculate priority level for the aggregated result"""
        if symbol in self.portfolio_symbols:
            if score >= 80:
                return "critical"
            elif score >= 60:
                return "high"
        elif symbol in self.watchlist_symbols:
            if score >= 85:
                return "high"
            elif score >= 70:
                return "medium"
        else:
            if score >= 90 and scanner_count >= 4:
                return "high"
            elif score >= 75 and scanner_count >= 3:
                return "medium"

        return "low"

    def _generate_insights(self,
                          symbol: str,
                          results: List[Tuple[SavedScanner, ScanResult]],
                          scanner_metadata: Dict[str, SavedScanner]) -> List[ScannerInsight]:
        """Generate insights based on aggregated results"""
        insights = []

        # Strong consensus insight
        if len(results) >= 4:
            avg_score = statistics.mean([result.match_score for _, result in results])
            if avg_score >= 80:
                insights.append(ScannerInsight(
                    type="consensus",
                    message=f"Strong consensus across {len(results)} scanners with average score {avg_score:.1f}%",
                    confidence="high",
                    importance="high"
                ))

        # Filter frequency insight
        filter_counts = Counter()
        for _, result in results:
            filter_counts.update(result.matched_filters)

        most_common = filter_counts.most_common(3)
        if most_common:
            top_filter, count = most_common[0]
            if count >= len(results) * 0.6:  # 60% of scanners agree
                insights.append(ScannerInsight(
                    type="pattern",
                    message=f"Strong pattern: '{top_filter}' identified by {count}/{len(results)} scanners",
                    confidence="medium",
                    importance="medium"
                ))

        # Portfolio relevance insight
        if symbol in self.portfolio_symbols:
            insights.append(ScannerInsight(
                type="portfolio",
                message="This symbol is in your current portfolio",
                confidence="high",
                importance="high"
            ))
        elif symbol in self.watchlist_symbols:
            insights.append(ScannerInsight(
                type="watchlist",
                message="This symbol is on your watchlist",
                confidence="high",
                importance="medium"
            ))

        return insights

    async def analyze_portfolio_exposure(self,
                                       aggregated_results: List[AggregatedScanResult]) -> PortfolioAnalysis:
        """Analyze portfolio exposure based on scanner results"""

        portfolio_matches = [r for r in aggregated_results if r.symbol in self.portfolio_symbols]
        watchlist_matches = [r for r in aggregated_results if r.symbol in self.watchlist_symbols]
        new_opportunities = [r for r in aggregated_results
                           if r.symbol not in self.portfolio_symbols
                           and r.symbol not in self.watchlist_symbols]

        # Calculate sector exposure
        sector_analysis = self._analyze_sector_distribution(aggregated_results)

        # Risk analysis
        high_risk_positions = [r for r in portfolio_matches if r.aggregate_score < 40]
        high_opportunity = [r for r in new_opportunities if r.aggregate_score >= 80]

        # Generate recommendations
        recommendations = []

        if high_risk_positions:
            recommendations.append({
                'type': 'risk_warning',
                'message': f"{len(high_risk_positions)} portfolio positions showing weak scanner signals",
                'symbols': [r.symbol for r in high_risk_positions],
                'priority': 'high'
            })

        if high_opportunity:
            recommendations.append({
                'type': 'opportunity',
                'message': f"{len(high_opportunity)} new high-scoring opportunities identified",
                'symbols': [r.symbol for r in high_opportunity[:5]],  # Top 5
                'priority': 'medium'
            })

        return PortfolioAnalysis(
            total_analyzed=len(aggregated_results),
            portfolio_matches=len(portfolio_matches),
            watchlist_matches=len(watchlist_matches),
            new_opportunities=len(new_opportunities),
            high_priority_count=len([r for r in aggregated_results if r.priority in ['high', 'critical']]),
            avg_aggregate_score=statistics.mean([r.aggregate_score for r in aggregated_results]) if aggregated_results else 0,
            sector_analysis=sector_analysis,
            recommendations=recommendations,
            timestamp=datetime.utcnow()
        )

    def _analyze_sector_distribution(self, results: List[AggregatedScanResult]) -> Dict[str, Any]:
        """Analyze sector distribution of results"""
        # This would integrate with stock metadata to get sector information
        # For now, return a placeholder structure
        return {
            'top_sectors': [],
            'sector_scores': {},
            'diversification_score': 0.0
        }

    def update_scanner_performance(self, scanner_id: str, match_success: bool, score: float):
        """Update scanner performance metrics"""
        if scanner_id not in self.scanner_performance:
            self.scanner_performance[scanner_id] = ScannerPerformance(scanner_id=scanner_id)

        perf = self.scanner_performance[scanner_id]
        perf.total_scans += 1

        if match_success:
            perf.successful_matches += 1
        else:
            perf.false_positives += 1

        # Update running average score
        perf.average_score = (perf.average_score * (perf.total_scans - 1) + score) / perf.total_scans

        # Calculate reliability score
        success_rate = perf.successful_matches / perf.total_scans
        score_factor = perf.average_score / 100
        perf.reliability_score = (success_rate * 0.7 + score_factor * 0.3) * 100

        perf.last_updated = datetime.utcnow()

    def get_scanner_rankings(self) -> List[Dict[str, Any]]:
        """Get scanner performance rankings"""
        rankings = []

        for perf in self.scanner_performance.values():
            rankings.append({
                'scanner_id': perf.scanner_id,
                'reliability_score': perf.reliability_score,
                'success_rate': perf.successful_matches / perf.total_scans if perf.total_scans > 0 else 0,
                'average_score': perf.average_score,
                'total_scans': perf.total_scans,
                'last_updated': perf.last_updated
            })

        rankings.sort(key=lambda x: x['reliability_score'], reverse=True)
        return rankings

    def _generate_cache_key(self, scanner_results: List[Tuple[SavedScanner, ScannerResponse]]) -> str:
        """Generate cache key for scanner results"""
        scanner_ids = sorted([scanner.scanner_id for scanner, _ in scanner_results])
        timestamp_str = datetime.utcnow().strftime("%Y%m%d%H%M")  # 1-minute resolution
        return f"aggregated_{'_'.join(scanner_ids)}_{timestamp_str}"

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached result is still valid"""
        if cache_key not in self.cache_expiry:
            return False
        return datetime.utcnow() < self.cache_expiry[cache_key]

    def clear_cache(self):
        """Clear aggregation cache"""
        self.aggregated_results_cache.clear()
        self.cache_expiry.clear()

    async def get_real_time_insights(self, symbol: str) -> Dict[str, Any]:
        """Get real-time insights for a specific symbol"""
        # This would integrate with real-time data feeds
        return {
            'symbol': symbol,
            'current_scanners_tracking': 0,
            'alert_status': 'normal',
            'trend_direction': 'neutral',
            'volume_analysis': 'normal',
            'technical_momentum': 'neutral'
        }


# Global aggregation service instance
default_aggregation_service = ScannerAggregationService()


def get_aggregation_service() -> ScannerAggregationService:
    """Get the default aggregation service"""
    return default_aggregation_service