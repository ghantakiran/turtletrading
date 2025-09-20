"""
Price and Volume Scanner

Specialized scanner for price action and volume analysis including
gaps, breakouts, volume spikes, and price momentum patterns.
"""

from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal
import logging
import numpy as np
from datetime import datetime, timedelta

from ...models.scanner_models import (
    ScannerConfig, PriceFilter, VolumeFilter, ScanResult, TimeFrame,
    FilterGroup, FilterCondition, ComparisonOperator, AssetType
)
from ...core.scanner_engine import ScannerEngine

logger = logging.getLogger(__name__)


class PriceVolumeAnalyzer:
    """Analyze price and volume patterns for scanning"""

    @staticmethod
    def calculate_price_gaps(current_price: float, previous_close: float) -> Dict[str, Any]:
        """Calculate price gaps and gap types"""
        if previous_close == 0:
            return {'gap_percent': 0.0, 'gap_type': 'none', 'gap_size': 0.0}

        gap_percent = ((current_price - previous_close) / previous_close) * 100
        gap_size = abs(current_price - previous_close)

        # Classify gap type
        if abs(gap_percent) < 0.5:
            gap_type = 'none'
        elif gap_percent > 2.0:
            gap_type = 'gap_up_strong'
        elif gap_percent > 0.5:
            gap_type = 'gap_up'
        elif gap_percent < -2.0:
            gap_type = 'gap_down_strong'
        elif gap_percent < -0.5:
            gap_type = 'gap_down'
        else:
            gap_type = 'minor'

        return {
            'gap_percent': gap_percent,
            'gap_type': gap_type,
            'gap_size': gap_size
        }

    @staticmethod
    def calculate_volume_profile(volume: List[int], lookback_period: int = 20) -> Dict[str, Any]:
        """Calculate volume profile and characteristics"""
        if not volume or len(volume) < 2:
            return {
                'avg_volume': 0,
                'volume_ratio': 1.0,
                'volume_trend': 'neutral',
                'volume_spike': False,
                'volume_dry_up': False
            }

        current_volume = volume[-1]
        recent_volumes = volume[-lookback_period:] if len(volume) >= lookback_period else volume

        avg_volume = np.mean(recent_volumes[:-1]) if len(recent_volumes) > 1 else current_volume
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0

        # Volume trend
        if len(volume) >= 3:
            recent_trend = np.mean(volume[-3:-1]) if len(volume) > 3 else volume[-2]
            if current_volume > recent_trend * 1.2:
                volume_trend = 'increasing'
            elif current_volume < recent_trend * 0.8:
                volume_trend = 'decreasing'
            else:
                volume_trend = 'neutral'
        else:
            volume_trend = 'neutral'

        # Volume anomalies
        volume_spike = volume_ratio > 2.0
        volume_dry_up = volume_ratio < 0.5

        return {
            'avg_volume': int(avg_volume),
            'volume_ratio': volume_ratio,
            'volume_trend': volume_trend,
            'volume_spike': volume_spike,
            'volume_dry_up': volume_dry_up
        }

    @staticmethod
    def calculate_price_momentum(prices: List[float], periods: List[int] = [1, 5, 10, 20]) -> Dict[str, float]:
        """Calculate price momentum over different periods"""
        momentum = {}

        for period in periods:
            if len(prices) > period:
                current_price = prices[-1]
                past_price = prices[-period-1]

                if past_price != 0:
                    momentum_pct = ((current_price - past_price) / past_price) * 100
                    momentum[f'momentum_{period}d'] = momentum_pct
                else:
                    momentum[f'momentum_{period}d'] = 0.0

        return momentum

    @staticmethod
    def calculate_volatility_metrics(prices: List[float], period: int = 20) -> Dict[str, float]:
        """Calculate volatility and price range metrics"""
        if len(prices) < 2:
            return {
                'volatility': 0.0,
                'price_range_pct': 0.0,
                'price_efficiency': 1.0
            }

        # Price returns
        returns = []
        for i in range(1, len(prices)):
            if prices[i-1] != 0:
                returns.append((prices[i] - prices[i-1]) / prices[i-1])

        if not returns:
            return {
                'volatility': 0.0,
                'price_range_pct': 0.0,
                'price_efficiency': 1.0
            }

        # Volatility (standard deviation of returns)
        volatility = np.std(returns[-period:]) * 100 if len(returns) >= period else np.std(returns) * 100

        # Price range
        recent_prices = prices[-period:] if len(prices) >= period else prices
        if recent_prices:
            price_range = (max(recent_prices) - min(recent_prices))
            price_range_pct = (price_range / min(recent_prices)) * 100 if min(recent_prices) > 0 else 0
        else:
            price_range_pct = 0

        # Price efficiency (how directly price moved from start to end)
        if len(prices) >= 2:
            net_change = abs(prices[-1] - prices[0])
            total_movement = sum(abs(prices[i] - prices[i-1]) for i in range(1, len(prices)))
            price_efficiency = net_change / total_movement if total_movement > 0 else 1.0
        else:
            price_efficiency = 1.0

        return {
            'volatility': volatility,
            'price_range_pct': price_range_pct,
            'price_efficiency': price_efficiency
        }

    @staticmethod
    def detect_price_patterns(high: List[float], low: List[float], close: List[float]) -> List[Dict[str, Any]]:
        """Detect basic price patterns"""
        patterns = []

        if len(close) < 3:
            return patterns

        current_close = close[-1]
        current_high = high[-1] if high else current_close
        current_low = low[-1] if low else current_close

        # Inside bar pattern
        if len(high) >= 2 and len(low) >= 2:
            prev_high = high[-2]
            prev_low = low[-2]

            if current_high < prev_high and current_low > prev_low:
                patterns.append({
                    'type': 'inside_bar',
                    'confidence': 0.8,
                    'description': 'Inside bar pattern detected'
                })

        # Outside bar pattern
        if len(high) >= 2 and len(low) >= 2:
            prev_high = high[-2]
            prev_low = low[-2]

            if current_high > prev_high and current_low < prev_low:
                patterns.append({
                    'type': 'outside_bar',
                    'confidence': 0.8,
                    'description': 'Outside bar pattern detected'
                })

        # Higher highs/lower lows pattern
        if len(close) >= 5:
            recent_closes = close[-5:]
            if all(recent_closes[i] > recent_closes[i-1] for i in range(1, len(recent_closes))):
                patterns.append({
                    'type': 'higher_highs',
                    'confidence': 0.9,
                    'description': 'Consecutive higher highs'
                })
            elif all(recent_closes[i] < recent_closes[i-1] for i in range(1, len(recent_closes))):
                patterns.append({
                    'type': 'lower_lows',
                    'confidence': 0.9,
                    'description': 'Consecutive lower lows'
                })

        return patterns


class PriceVolumeScanner:
    """
    Scanner specialized for price and volume analysis

    Provides pre-built scanning strategies for price action
    and volume-based trading opportunities.
    """

    def __init__(self, scanner_engine: ScannerEngine):
        self.scanner_engine = scanner_engine
        self.analyzer = PriceVolumeAnalyzer()

    async def scan_gap_ups(self, universe: List[str], min_gap_percent: float = 2.0) -> List[ScanResult]:
        """Scan for gap up patterns"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="gap_percent",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=min_gap_percent
                )
            ]
        )

        config = ScannerConfig(
            name="Gap Up Scanner",
            scanner_type="price",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="gap_percent",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_gap_downs(self, universe: List[str], min_gap_percent: float = -2.0) -> List[ScanResult]:
        """Scan for gap down patterns"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="gap_percent",
                    operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                    value=min_gap_percent
                )
            ]
        )

        config = ScannerConfig(
            name="Gap Down Scanner",
            scanner_type="price",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="gap_percent",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_volume_spikes(self, universe: List[str], volume_ratio_threshold: float = 2.0) -> List[ScanResult]:
        """Scan for unusual volume spikes"""
        config = ScannerConfig(
            name="Volume Spike Scanner",
            scanner_type="volume",
            asset_types=[AssetType.STOCK],
            universe=universe,
            volume_filter=VolumeFilter(
                volume_ratio=Decimal(str(volume_ratio_threshold))
            ),
            sort_by="volume_ratio",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_volume_breakouts(self, universe: List[str], volume_threshold: float = 2.0,
                                   price_change_threshold: float = 5.0) -> List[ScanResult]:
        """Scan for volume breakouts with significant price movement"""
        config = ScannerConfig(
            name="Volume Breakout Scanner",
            scanner_type="volume",
            asset_types=[AssetType.STOCK],
            universe=universe,
            volume_filter=VolumeFilter(
                volume_ratio=Decimal(str(volume_threshold))
            ),
            price_filter=PriceFilter(
                price_change_percent=Decimal(str(price_change_threshold))
            ),
            sort_by="volume_ratio",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_high_momentum(self, universe: List[str], momentum_threshold: float = 10.0,
                                period: str = "1d") -> List[ScanResult]:
        """Scan for high momentum stocks"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field=f"momentum_{period}",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=momentum_threshold
                )
            ]
        )

        config = ScannerConfig(
            name=f"High Momentum Scanner ({period})",
            scanner_type="momentum",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by=f"momentum_{period}",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_low_momentum(self, universe: List[str], momentum_threshold: float = -10.0,
                               period: str = "1d") -> List[ScanResult]:
        """Scan for low momentum (potential reversal) stocks"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field=f"momentum_{period}",
                    operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                    value=momentum_threshold
                )
            ]
        )

        config = ScannerConfig(
            name=f"Low Momentum Scanner ({period})",
            scanner_type="momentum",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by=f"momentum_{period}",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_near_highs(self, universe: List[str], percentage_threshold: float = 5.0) -> List[ScanResult]:
        """Scan for stocks near their recent highs"""
        config = ScannerConfig(
            name="Near Highs Scanner",
            scanner_type="price",
            asset_types=[AssetType.STOCK],
            universe=universe,
            price_filter=PriceFilter(
                near_high=Decimal(str(percentage_threshold))
            ),
            sort_by="near_high_percent",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_near_lows(self, universe: List[str], percentage_threshold: float = 5.0) -> List[ScanResult]:
        """Scan for stocks near their recent lows"""
        config = ScannerConfig(
            name="Near Lows Scanner",
            scanner_type="price",
            asset_types=[AssetType.STOCK],
            universe=universe,
            price_filter=PriceFilter(
                near_low=Decimal(str(percentage_threshold))
            ),
            sort_by="near_low_percent",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_price_range_contraction(self, universe: List[str],
                                         volatility_threshold: float = 2.0) -> List[ScanResult]:
        """Scan for stocks with contracting price ranges (potential breakout candidates)"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="volatility",
                    operator=ComparisonOperator.LESS_THAN,
                    value=volatility_threshold
                )
            ]
        )

        config = ScannerConfig(
            name="Price Range Contraction Scanner",
            scanner_type="volatility",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="volatility",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_unusual_options_activity(self, universe: List[str],
                                          option_volume_threshold: float = 1000) -> List[ScanResult]:
        """Scan for unusual options activity (placeholder for future implementation)"""
        # This would require options data integration
        logger.info("Unusual options activity scanner - feature under development")
        return []

    async def scan_accumulation_distribution(self, universe: List[str],
                                           ad_threshold: float = 0.5) -> List[ScanResult]:
        """Scan for accumulation/distribution patterns"""
        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="indicators.ad_line",
                    operator=ComparisonOperator.GREATER_THAN,
                    value=ad_threshold
                )
            ]
        )

        config = ScannerConfig(
            name="Accumulation Distribution Scanner",
            scanner_type="volume",
            asset_types=[AssetType.STOCK],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="indicators.ad_line",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def calculate_price_volume_metrics(self, symbol: str, ohlcv_data: Dict[str, List[float]]) -> Dict[str, Any]:
        """Calculate comprehensive price and volume metrics"""
        try:
            high = ohlcv_data.get('high', [])
            low = ohlcv_data.get('low', [])
            close = ohlcv_data.get('close', [])
            volume = ohlcv_data.get('volume', [])

            if not close:
                return {}

            metrics = {}

            # Price gaps (need previous close)
            if len(close) >= 2:
                gap_info = self.analyzer.calculate_price_gaps(close[-1], close[-2])
                metrics.update(gap_info)

            # Volume profile
            volume_profile = self.analyzer.calculate_volume_profile(volume)
            metrics.update(volume_profile)

            # Price momentum
            momentum = self.analyzer.calculate_price_momentum(close)
            metrics.update(momentum)

            # Volatility metrics
            volatility_metrics = self.analyzer.calculate_volatility_metrics(close)
            metrics.update(volatility_metrics)

            # Price patterns
            patterns = self.analyzer.detect_price_patterns(high, low, close)
            metrics['patterns'] = patterns

            # Dollar volume
            if volume and close:
                current_volume = volume[-1] if volume else 0
                current_price = close[-1]
                metrics['dollar_volume'] = current_volume * current_price

            # Price efficiency and directional movement
            if len(close) >= 10:
                ten_day_efficiency = self.analyzer.calculate_volatility_metrics(close[-10:])
                metrics['short_term_efficiency'] = ten_day_efficiency.get('price_efficiency', 1.0)

            return metrics

        except Exception as e:
            logger.error(f"Error calculating price/volume metrics for {symbol}: {e}")
            return {}

    def create_custom_price_volume_scanner(
        self,
        name: str,
        price_range: Optional[Tuple[float, float]] = None,
        volume_ratio_min: Optional[float] = None,
        momentum_threshold: Optional[float] = None,
        gap_filter: Optional[Dict[str, float]] = None,  # {'min': 2.0, 'max': 10.0}
        volatility_range: Optional[Tuple[float, float]] = None
    ) -> ScannerConfig:
        """Create custom price/volume scanner configuration"""

        price_filter = None
        if price_range:
            price_filter = PriceFilter(
                min_price=Decimal(str(price_range[0])),
                max_price=Decimal(str(price_range[1]))
            )

        volume_filter = None
        if volume_ratio_min:
            volume_filter = VolumeFilter(
                volume_ratio=Decimal(str(volume_ratio_min))
            )

        # Custom conditions
        conditions = []

        if momentum_threshold:
            conditions.append(FilterCondition(
                field="momentum_1d",
                operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                value=momentum_threshold
            ))

        if gap_filter:
            if 'min' in gap_filter:
                conditions.append(FilterCondition(
                    field="gap_percent",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=gap_filter['min']
                ))
            if 'max' in gap_filter:
                conditions.append(FilterCondition(
                    field="gap_percent",
                    operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                    value=gap_filter['max']
                ))

        if volatility_range:
            conditions.append(FilterCondition(
                field="volatility",
                operator=ComparisonOperator.BETWEEN,
                value=[volatility_range[0], volatility_range[1]]
            ))

        custom_conditions = None
        if conditions:
            custom_conditions = FilterGroup(
                operator="AND",
                conditions=conditions
            )

        return ScannerConfig(
            name=name,
            scanner_type="price",
            asset_types=[AssetType.STOCK],
            price_filter=price_filter,
            volume_filter=volume_filter,
            custom_conditions=custom_conditions,
            sort_by="match_score",
            sort_order="desc"
        )