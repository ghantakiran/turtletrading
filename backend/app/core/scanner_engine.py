"""
Multi-Asset Scanner Engine

Core scanning engine that applies filters to asset universes
and identifies matching assets based on configurable criteria.
"""

import asyncio
from typing import List, Dict, Any, Optional, Set, Callable
from datetime import datetime, timedelta
from decimal import Decimal
import logging
import hashlib
import json
import time

from ..models.scanner_models import (
    ScannerConfig, ScanResult, ScannerResponse, AssetType, FilterCondition,
    FilterGroup, ComparisonOperator, TimeFrame, ScannerType
)

logger = logging.getLogger(__name__)


class FilterProcessor:
    """Processes individual filter conditions"""

    @staticmethod
    def evaluate_condition(data: Dict[str, Any], condition: FilterCondition) -> bool:
        """
        Evaluate a single filter condition against asset data

        Args:
            data: Asset data dictionary
            condition: Filter condition to evaluate

        Returns:
            bool: True if condition is met
        """
        try:
            field_value = FilterProcessor._get_field_value(data, condition.field)
            target_value = condition.value

            if field_value is None:
                return False

            operator = condition.operator

            if operator == ComparisonOperator.EQUALS:
                return FilterProcessor._compare_equal(field_value, target_value)
            elif operator == ComparisonOperator.NOT_EQUALS:
                return not FilterProcessor._compare_equal(field_value, target_value)
            elif operator == ComparisonOperator.GREATER_THAN:
                return FilterProcessor._compare_numeric(field_value, '>', target_value)
            elif operator == ComparisonOperator.GREATER_THAN_OR_EQUAL:
                return FilterProcessor._compare_numeric(field_value, '>=', target_value)
            elif operator == ComparisonOperator.LESS_THAN:
                return FilterProcessor._compare_numeric(field_value, '<', target_value)
            elif operator == ComparisonOperator.LESS_THAN_OR_EQUAL:
                return FilterProcessor._compare_numeric(field_value, '<=', target_value)
            elif operator == ComparisonOperator.BETWEEN:
                return FilterProcessor._compare_between(field_value, target_value)
            elif operator == ComparisonOperator.NOT_BETWEEN:
                return not FilterProcessor._compare_between(field_value, target_value)
            elif operator == ComparisonOperator.IN:
                return field_value in target_value
            elif operator == ComparisonOperator.NOT_IN:
                return field_value not in target_value
            elif operator == ComparisonOperator.CONTAINS:
                return str(target_value).lower() in str(field_value).lower()
            elif operator == ComparisonOperator.CROSSES_ABOVE:
                return FilterProcessor._check_cross_above(data, condition)
            elif operator == ComparisonOperator.CROSSES_BELOW:
                return FilterProcessor._check_cross_below(data, condition)
            else:
                logger.warning(f"Unsupported operator: {operator}")
                return False

        except Exception as e:
            logger.error(f"Error evaluating condition {condition.field} {condition.operator} {condition.value}: {e}")
            return False

    @staticmethod
    def _get_field_value(data: Dict[str, Any], field_path: str) -> Any:
        """Get nested field value using dot notation"""
        try:
            value = data
            for key in field_path.split('.'):
                if isinstance(value, dict):
                    value = value.get(key)
                else:
                    return None
            return value
        except Exception:
            return None

    @staticmethod
    def _compare_equal(value1: Any, value2: Any) -> bool:
        """Compare two values for equality"""
        try:
            if isinstance(value1, (int, float)) and isinstance(value2, (int, float)):
                return abs(float(value1) - float(value2)) < 1e-10
            return str(value1).lower() == str(value2).lower()
        except Exception:
            return False

    @staticmethod
    def _compare_numeric(value1: Any, operator: str, value2: Any) -> bool:
        """Compare numeric values"""
        try:
            v1 = float(value1)
            v2 = float(value2)

            if operator == '>':
                return v1 > v2
            elif operator == '>=':
                return v1 >= v2
            elif operator == '<':
                return v1 < v2
            elif operator == '<=':
                return v1 <= v2
            return False
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _compare_between(value: Any, range_values: List[Any]) -> bool:
        """Check if value is between two values"""
        try:
            if len(range_values) != 2:
                return False
            v = float(value)
            min_val = float(range_values[0])
            max_val = float(range_values[1])
            return min_val <= v <= max_val
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _check_cross_above(data: Dict[str, Any], condition: FilterCondition) -> bool:
        """Check if field value crossed above target value"""
        # This would require historical data - simplified implementation
        current_value = FilterProcessor._get_field_value(data, condition.field)
        return FilterProcessor._compare_numeric(current_value, '>', condition.value)

    @staticmethod
    def _check_cross_below(data: Dict[str, Any], condition: FilterCondition) -> bool:
        """Check if field value crossed below target value"""
        # This would require historical data - simplified implementation
        current_value = FilterProcessor._get_field_value(data, condition.field)
        return FilterProcessor._compare_numeric(current_value, '<', condition.value)


class ScannerEngine:
    """
    Core scanner engine for multi-asset scanning

    Provides filtering, ranking, and result aggregation capabilities
    for real-time market scanning.
    """

    def __init__(self):
        self.data_providers: Dict[AssetType, Callable] = {}
        self.filter_processors: Dict[str, Callable] = {}
        self.result_cache: Dict[str, ScannerResponse] = {}
        self.cache_ttl = 60  # seconds

    def register_data_provider(self, asset_type: AssetType, provider: Callable):
        """Register data provider for asset type"""
        self.data_providers[asset_type] = provider

    def register_filter_processor(self, filter_name: str, processor: Callable):
        """Register custom filter processor"""
        self.filter_processors[filter_name] = processor

    async def run_scanner(self, config: ScannerConfig) -> ScannerResponse:
        """
        Run scanner with given configuration

        Args:
            config: Scanner configuration

        Returns:
            ScannerResponse: Scan results
        """
        start_time = time.time()

        try:
            # Generate cache key
            cache_key = self._generate_cache_key(config)

            # Check cache
            if cache_key in self.result_cache:
                cached_result = self.result_cache[cache_key]
                if self._is_cache_valid(cached_result.scan_timestamp):
                    logger.debug(f"Returning cached results for scanner {config.name}")
                    cached_result.cache_hit = True
                    return cached_result

            # Get asset universe
            universe = await self._get_asset_universe(config)
            logger.info(f"Scanning {len(universe)} assets with {config.name}")

            # Get data for all assets
            asset_data = await self._fetch_asset_data(universe, config)

            # Apply filters
            results = []
            filters_applied = 0

            for symbol, data in asset_data.items():
                if await self._passes_filters(data, config):
                    result = await self._create_scan_result(symbol, data, config)
                    results.append(result)
                    filters_applied += 1

            # Sort and limit results
            results = self._sort_results(results, config)
            if config.limit:
                results = results[:config.limit]

            # Add ranking
            for i, result in enumerate(results):
                result.rank = i + 1

            # Create response
            response = ScannerResponse(
                scanner_id=cache_key,
                scanner_name=config.name,
                scan_timestamp=datetime.utcnow(),
                results=results,
                total_matches=len(results),
                total_scanned=len(universe),
                scan_duration_ms=int((time.time() - start_time) * 1000),
                filters_applied=filters_applied,
                config_hash=cache_key,
                cache_hit=False
            )

            # Cache results
            self.result_cache[cache_key] = response

            return response

        except Exception as e:
            logger.error(f"Error running scanner {config.name}: {e}")
            raise

    async def _get_asset_universe(self, config: ScannerConfig) -> List[str]:
        """Get list of symbols to scan"""
        universe = set()

        if config.universe:
            # Use specified universe
            universe.update(config.universe)
        else:
            # Get universe from asset types
            for asset_type in config.asset_types:
                provider = self.data_providers.get(asset_type)
                if provider:
                    symbols = await provider.get_symbols()
                    universe.update(symbols)

        # Remove excluded symbols
        if config.exclude_symbols:
            universe -= set(config.exclude_symbols)

        return list(universe)

    async def _fetch_asset_data(self, symbols: List[str], config: ScannerConfig) -> Dict[str, Dict[str, Any]]:
        """Fetch data for all assets"""
        tasks = []
        semaphore = asyncio.Semaphore(50)  # Limit concurrent requests

        async def fetch_symbol_data(symbol: str) -> tuple[str, Dict[str, Any]]:
            async with semaphore:
                try:
                    # Determine asset type
                    asset_type = await self._determine_asset_type(symbol)
                    provider = self.data_providers.get(asset_type)

                    if not provider:
                        return symbol, {}

                    # Fetch comprehensive data
                    data = await provider.get_asset_data(symbol, config.time_frame)
                    data['symbol'] = symbol
                    data['asset_type'] = asset_type

                    return symbol, data
                except Exception as e:
                    logger.warning(f"Failed to fetch data for {symbol}: {e}")
                    return symbol, {}

        # Execute all requests concurrently
        tasks = [fetch_symbol_data(symbol) for symbol in symbols]
        results = await asyncio.gather(*tasks)

        return {symbol: data for symbol, data in results if data}

    async def _determine_asset_type(self, symbol: str) -> AssetType:
        """Determine asset type from symbol"""
        # Simple heuristics - would be enhanced with proper symbol lookup
        if symbol.endswith('-USD') or symbol.endswith('USDT'):
            return AssetType.CRYPTO
        elif '=' in symbol:
            return AssetType.FOREX
        elif symbol.startswith('^'):
            return AssetType.INDEX
        else:
            return AssetType.STOCK

    async def _passes_filters(self, data: Dict[str, Any], config: ScannerConfig) -> bool:
        """Check if asset passes all filters"""
        try:
            # Built-in filters
            if config.price_filter and not await self._check_price_filter(data, config.price_filter):
                return False

            if config.volume_filter and not await self._check_volume_filter(data, config.volume_filter):
                return False

            if config.technical_filter and not await self._check_technical_filter(data, config.technical_filter):
                return False

            if config.fundamental_filter and not await self._check_fundamental_filter(data, config.fundamental_filter):
                return False

            if config.momentum_filter and not await self._check_momentum_filter(data, config.momentum_filter):
                return False

            if config.pattern_filter and not await self._check_pattern_filter(data, config.pattern_filter):
                return False

            # Custom conditions
            if config.custom_conditions and not await self._evaluate_filter_group(data, config.custom_conditions):
                return False

            return True

        except Exception as e:
            logger.error(f"Error checking filters for {data.get('symbol', 'unknown')}: {e}")
            return False

    async def _check_price_filter(self, data: Dict[str, Any], filter_config) -> bool:
        """Check price filter conditions"""
        price = data.get('price', 0)

        if filter_config.min_price and price < filter_config.min_price:
            return False
        if filter_config.max_price and price > filter_config.max_price:
            return False

        # Price change check
        if filter_config.price_change_percent:
            change_pct = data.get('change_percent', 0)
            if abs(change_pct) < filter_config.price_change_percent:
                return False

        # VWAP check
        if filter_config.above_vwap is not None:
            vwap = data.get('indicators', {}).get('vwap', price)
            if filter_config.above_vwap and price <= vwap:
                return False
            elif not filter_config.above_vwap and price >= vwap:
                return False

        # Near high/low checks
        if filter_config.near_high:
            high = data.get('high', price)
            if (high - price) / high * 100 > filter_config.near_high:
                return False

        if filter_config.near_low:
            low = data.get('low', price)
            if (price - low) / low * 100 > filter_config.near_low:
                return False

        return True

    async def _check_volume_filter(self, data: Dict[str, Any], filter_config) -> bool:
        """Check volume filter conditions"""
        volume = data.get('volume', 0)

        if filter_config.min_volume and volume < filter_config.min_volume:
            return False
        if filter_config.max_volume and volume > filter_config.max_volume:
            return False

        # Volume ratio check
        if filter_config.volume_ratio:
            avg_volume = data.get('avg_volume', volume)
            if avg_volume > 0:
                ratio = volume / avg_volume
                if ratio < filter_config.volume_ratio:
                    return False

        # Dollar volume check
        if filter_config.dollar_volume:
            price = data.get('price', 0)
            dollar_vol = volume * price
            if dollar_vol < filter_config.dollar_volume:
                return False

        return True

    async def _check_technical_filter(self, data: Dict[str, Any], filter_config) -> bool:
        """Check technical indicator filter conditions"""
        indicators = data.get('indicators', {})

        # RSI checks
        rsi = indicators.get('rsi')
        if rsi:
            if filter_config.rsi_min and rsi < filter_config.rsi_min:
                return False
            if filter_config.rsi_max and rsi > filter_config.rsi_max:
                return False

        # MACD signal check
        if filter_config.macd_signal:
            macd_histogram = indicators.get('macd_histogram', 0)
            if filter_config.macd_signal == 'bullish' and macd_histogram <= 0:
                return False
            elif filter_config.macd_signal == 'bearish' and macd_histogram >= 0:
                return False

        # ADX check
        if filter_config.adx_min:
            adx = indicators.get('adx', 0)
            if adx < filter_config.adx_min:
                return False

        # Bollinger position check
        if filter_config.bollinger_position:
            bb_position = indicators.get('bollinger_position', 'middle')
            if bb_position != filter_config.bollinger_position:
                return False

        return True

    async def _check_fundamental_filter(self, data: Dict[str, Any], filter_config) -> bool:
        """Check fundamental data filter conditions"""
        fundamentals = data.get('fundamentals', {})

        # Market cap checks
        market_cap = fundamentals.get('market_cap')
        if market_cap:
            if filter_config.market_cap_min and market_cap < filter_config.market_cap_min:
                return False
            if filter_config.market_cap_max and market_cap > filter_config.market_cap_max:
                return False

        # P/E ratio checks
        pe_ratio = fundamentals.get('pe_ratio')
        if pe_ratio:
            if filter_config.pe_ratio_min and pe_ratio < filter_config.pe_ratio_min:
                return False
            if filter_config.pe_ratio_max and pe_ratio > filter_config.pe_ratio_max:
                return False

        # Sector check
        if filter_config.sector:
            sector = fundamentals.get('sector')
            if sector not in filter_config.sector:
                return False

        return True

    async def _check_momentum_filter(self, data: Dict[str, Any], filter_config) -> bool:
        """Check momentum filter conditions"""
        indicators = data.get('indicators', {})

        # Rate of change check
        if filter_config.rate_of_change:
            roc = indicators.get('rate_of_change', 0)
            if abs(roc) < filter_config.rate_of_change:
                return False

        # Relative strength check
        if filter_config.relative_strength:
            rs = indicators.get('relative_strength', 50)
            if rs < filter_config.relative_strength:
                return False

        return True

    async def _check_pattern_filter(self, data: Dict[str, Any], filter_config) -> bool:
        """Check pattern filter conditions"""
        patterns = data.get('patterns', [])

        if filter_config.pattern_types:
            detected_patterns = [p.get('type') for p in patterns]
            if not any(pt in detected_patterns for pt in filter_config.pattern_types):
                return False

        # Pattern confidence check
        if filter_config.confidence_min:
            max_confidence = max([p.get('confidence', 0) for p in patterns], default=0)
            if max_confidence < filter_config.confidence_min:
                return False

        return True

    async def _evaluate_filter_group(self, data: Dict[str, Any], group: FilterGroup) -> bool:
        """Evaluate a filter group recursively"""
        results = []

        # Evaluate conditions
        for condition in group.conditions:
            result = FilterProcessor.evaluate_condition(data, condition)
            results.append(result)

        # Evaluate nested groups
        if group.groups:
            for nested_group in group.groups:
                result = await self._evaluate_filter_group(data, nested_group)
                results.append(result)

        # Apply logical operator
        if group.operator.upper() == 'AND':
            return all(results)
        elif group.operator.upper() == 'OR':
            return any(results)
        else:
            logger.warning(f"Unknown logical operator: {group.operator}")
            return False

    async def _create_scan_result(self, symbol: str, data: Dict[str, Any], config: ScannerConfig) -> ScanResult:
        """Create scan result from asset data"""
        # Calculate match score
        match_score = await self._calculate_match_score(data, config)

        # Determine matched filters
        matched_filters = await self._get_matched_filters(data, config)

        # Extract relevant values
        filter_values = {
            'price': data.get('price', 0),
            'volume': data.get('volume', 0),
            'change_percent': data.get('change_percent', 0),
        }

        # Add indicator values if available
        indicators = data.get('indicators', {})
        if indicators:
            filter_values.update({f"indicators.{k}": v for k, v in indicators.items()})

        return ScanResult(
            symbol=symbol,
            name=data.get('name'),
            asset_type=data.get('asset_type', AssetType.STOCK),
            price=Decimal(str(data.get('price', 0))),
            change=Decimal(str(data.get('change', 0))),
            change_percent=Decimal(str(data.get('change_percent', 0))),
            volume=data.get('volume', 0),
            match_score=Decimal(str(match_score)),
            matched_filters=matched_filters,
            filter_values=filter_values,
            technical_indicators=indicators,
            fundamental_data=data.get('fundamentals'),
            patterns_detected=[p.get('type') for p in data.get('patterns', [])],
            scan_timestamp=datetime.utcnow(),
            time_frame=config.time_frame
        )

    async def _calculate_match_score(self, data: Dict[str, Any], config: ScannerConfig) -> float:
        """Calculate how well asset matches scanner criteria (0-100)"""
        # Simple scoring based on number of filters passed
        total_filters = 0
        passed_filters = 0

        # Check each filter type
        filter_checks = [
            (config.price_filter, self._check_price_filter),
            (config.volume_filter, self._check_volume_filter),
            (config.technical_filter, self._check_technical_filter),
            (config.fundamental_filter, self._check_fundamental_filter),
            (config.momentum_filter, self._check_momentum_filter),
            (config.pattern_filter, self._check_pattern_filter),
        ]

        for filter_config, check_func in filter_checks:
            if filter_config:
                total_filters += 1
                if await check_func(data, filter_config):
                    passed_filters += 1

        if total_filters == 0:
            return 100.0

        return (passed_filters / total_filters) * 100

    async def _get_matched_filters(self, data: Dict[str, Any], config: ScannerConfig) -> List[str]:
        """Get list of filter names that were matched"""
        matched = []

        if config.price_filter and await self._check_price_filter(data, config.price_filter):
            matched.append('price')
        if config.volume_filter and await self._check_volume_filter(data, config.volume_filter):
            matched.append('volume')
        if config.technical_filter and await self._check_technical_filter(data, config.technical_filter):
            matched.append('technical')
        if config.fundamental_filter and await self._check_fundamental_filter(data, config.fundamental_filter):
            matched.append('fundamental')
        if config.momentum_filter and await self._check_momentum_filter(data, config.momentum_filter):
            matched.append('momentum')
        if config.pattern_filter and await self._check_pattern_filter(data, config.pattern_filter):
            matched.append('pattern')

        return matched

    def _sort_results(self, results: List[ScanResult], config: ScannerConfig) -> List[ScanResult]:
        """Sort results based on configuration"""
        if not config.sort_by:
            # Default sort by match score
            results.sort(key=lambda x: x.match_score, reverse=True)
            return results

        reverse = config.sort_order.lower() == 'desc'

        try:
            if hasattr(ScanResult, config.sort_by):
                results.sort(key=lambda x: getattr(x, config.sort_by), reverse=reverse)
            else:
                # Try to sort by filter value
                results.sort(key=lambda x: x.filter_values.get(config.sort_by, 0), reverse=reverse)
        except Exception as e:
            logger.warning(f"Failed to sort by {config.sort_by}: {e}")
            # Fallback to match score
            results.sort(key=lambda x: x.match_score, reverse=True)

        return results

    def _generate_cache_key(self, config: ScannerConfig) -> str:
        """Generate cache key for scanner configuration"""
        config_dict = config.dict()
        config_str = json.dumps(config_dict, sort_keys=True, default=str)
        return hashlib.md5(config_str.encode()).hexdigest()

    def _is_cache_valid(self, cache_timestamp: datetime) -> bool:
        """Check if cached result is still valid"""
        return (datetime.utcnow() - cache_timestamp).total_seconds() < self.cache_ttl

    def clear_cache(self):
        """Clear result cache"""
        self.result_cache.clear()


# Global scanner engine instance
default_scanner_engine = ScannerEngine()


def get_scanner_engine() -> ScannerEngine:
    """Get the default scanner engine"""
    return default_scanner_engine