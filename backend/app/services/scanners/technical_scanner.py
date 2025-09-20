"""
Technical Indicator Scanner

Specialized scanner for technical analysis indicators including
RSI, MACD, Bollinger Bands, moving averages, and custom patterns.
"""

from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from ...models.scanner_models import (
    ScannerConfig, TechnicalFilter, ScanResult, TimeFrame, ComparisonOperator
)
from ...core.scanner_engine import ScannerEngine

logger = logging.getLogger(__name__)


class TechnicalIndicatorCalculator:
    """Calculate technical indicators for scanning"""

    @staticmethod
    def calculate_rsi(prices: List[float], period: int = 14) -> float:
        """Calculate RSI (Relative Strength Index)"""
        if len(prices) < period + 1:
            return 50.0

        prices_array = np.array(prices)
        deltas = np.diff(prices_array)

        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))

        return float(rsi)

    @staticmethod
    def calculate_macd(prices: List[float], fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, float]:
        """Calculate MACD (Moving Average Convergence Divergence)"""
        if len(prices) < slow + signal:
            return {'macd': 0.0, 'signal': 0.0, 'histogram': 0.0}

        prices_array = np.array(prices)

        # Calculate EMAs
        ema_fast = TechnicalIndicatorCalculator._calculate_ema(prices_array, fast)
        ema_slow = TechnicalIndicatorCalculator._calculate_ema(prices_array, slow)

        # MACD line
        macd_line = ema_fast - ema_slow

        # Signal line (EMA of MACD)
        signal_line = TechnicalIndicatorCalculator._calculate_ema(macd_line, signal)

        # Histogram
        histogram = macd_line - signal_line

        return {
            'macd': float(macd_line[-1]) if len(macd_line) > 0 else 0.0,
            'signal': float(signal_line[-1]) if len(signal_line) > 0 else 0.0,
            'histogram': float(histogram[-1]) if len(histogram) > 0 else 0.0
        }

    @staticmethod
    def calculate_bollinger_bands(prices: List[float], period: int = 20, std_dev: float = 2.0) -> Dict[str, float]:
        """Calculate Bollinger Bands"""
        if len(prices) < period:
            current_price = prices[-1] if prices else 0
            return {
                'upper': current_price,
                'middle': current_price,
                'lower': current_price,
                'position': 'middle',
                'width': 0.0
            }

        prices_array = np.array(prices[-period:])

        middle = np.mean(prices_array)
        std = np.std(prices_array)

        upper = middle + (std_dev * std)
        lower = middle - (std_dev * std)

        current_price = prices[-1]

        # Determine position
        if current_price > upper:
            position = 'above'
        elif current_price < lower:
            position = 'below'
        else:
            position = 'middle'

        # Calculate band width as percentage
        width = ((upper - lower) / middle) * 100 if middle != 0 else 0

        return {
            'upper': float(upper),
            'middle': float(middle),
            'lower': float(lower),
            'position': position,
            'width': float(width)
        }

    @staticmethod
    def calculate_moving_averages(prices: List[float]) -> Dict[str, float]:
        """Calculate various moving averages"""
        results = {}

        periods = [5, 10, 20, 50, 100, 200]
        for period in periods:
            if len(prices) >= period:
                sma = np.mean(prices[-period:])
                ema = TechnicalIndicatorCalculator._calculate_ema(np.array(prices), period)

                results[f'sma_{period}'] = float(sma)
                if len(ema) > 0:
                    results[f'ema_{period}'] = float(ema[-1])

        return results

    @staticmethod
    def calculate_adx(high: List[float], low: List[float], close: List[float], period: int = 14) -> float:
        """Calculate ADX (Average Directional Index)"""
        if len(high) < period + 1:
            return 0.0

        high_array = np.array(high)
        low_array = np.array(low)
        close_array = np.array(close)

        # Calculate True Range
        tr1 = high_array[1:] - low_array[1:]
        tr2 = np.abs(high_array[1:] - close_array[:-1])
        tr3 = np.abs(low_array[1:] - close_array[:-1])

        tr = np.maximum(tr1, np.maximum(tr2, tr3))

        # Calculate Directional Movement
        plus_dm = np.where((high_array[1:] - high_array[:-1]) > (low_array[:-1] - low_array[1:]),
                          np.maximum(high_array[1:] - high_array[:-1], 0), 0)
        minus_dm = np.where((low_array[:-1] - low_array[1:]) > (high_array[1:] - high_array[:-1]),
                           np.maximum(low_array[:-1] - low_array[1:], 0), 0)

        # Smooth the values
        atr = TechnicalIndicatorCalculator._smooth_data(tr, period)
        plus_di = 100 * TechnicalIndicatorCalculator._smooth_data(plus_dm, period) / atr
        minus_di = 100 * TechnicalIndicatorCalculator._smooth_data(minus_dm, period) / atr

        # Calculate DX and ADX
        dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di + 1e-10)
        adx = TechnicalIndicatorCalculator._smooth_data(dx, period)

        return float(adx[-1]) if len(adx) > 0 else 0.0

    @staticmethod
    def calculate_stochastic(high: List[float], low: List[float], close: List[float],
                           k_period: int = 14, d_period: int = 3) -> Dict[str, float]:
        """Calculate Stochastic Oscillator"""
        if len(high) < k_period:
            return {'k': 50.0, 'd': 50.0, 'signal': 'neutral'}

        high_array = np.array(high)
        low_array = np.array(low)
        close_array = np.array(close)

        # Calculate %K
        lowest_low = np.array([np.min(low_array[i-k_period+1:i+1]) for i in range(k_period-1, len(low_array))])
        highest_high = np.array([np.max(high_array[i-k_period+1:i+1]) for i in range(k_period-1, len(high_array))])

        k_values = 100 * (close_array[k_period-1:] - lowest_low) / (highest_high - lowest_low + 1e-10)

        # Calculate %D (SMA of %K)
        d_values = []
        for i in range(d_period-1, len(k_values)):
            d_values.append(np.mean(k_values[i-d_period+1:i+1]))

        current_k = float(k_values[-1]) if len(k_values) > 0 else 50.0
        current_d = float(d_values[-1]) if len(d_values) > 0 else 50.0

        # Determine signal
        if current_k < 20 and current_d < 20:
            signal = 'oversold'
        elif current_k > 80 and current_d > 80:
            signal = 'overbought'
        else:
            signal = 'neutral'

        return {
            'k': current_k,
            'd': current_d,
            'signal': signal
        }

    @staticmethod
    def calculate_atr(high: List[float], low: List[float], close: List[float], period: int = 14) -> float:
        """Calculate ATR (Average True Range)"""
        if len(high) < period + 1:
            return 0.0

        high_array = np.array(high)
        low_array = np.array(low)
        close_array = np.array(close)

        tr1 = high_array[1:] - low_array[1:]
        tr2 = np.abs(high_array[1:] - close_array[:-1])
        tr3 = np.abs(low_array[1:] - close_array[:-1])

        tr = np.maximum(tr1, np.maximum(tr2, tr3))
        atr = np.mean(tr[-period:])

        return float(atr)

    @staticmethod
    def calculate_obv(close: List[float], volume: List[int]) -> float:
        """Calculate OBV (On-Balance Volume)"""
        if len(close) < 2 or len(volume) != len(close):
            return 0.0

        obv = 0
        for i in range(1, len(close)):
            if close[i] > close[i-1]:
                obv += volume[i]
            elif close[i] < close[i-1]:
                obv -= volume[i]

        return float(obv)

    @staticmethod
    def calculate_williams_r(high: List[float], low: List[float], close: List[float], period: int = 14) -> float:
        """Calculate Williams %R"""
        if len(high) < period:
            return 0.0

        highest_high = max(high[-period:])
        lowest_low = min(low[-period:])
        current_close = close[-1]

        if highest_high == lowest_low:
            return 0.0

        williams_r = -100 * (highest_high - current_close) / (highest_high - lowest_low)
        return float(williams_r)

    @staticmethod
    def _calculate_ema(data: np.ndarray, period: int) -> np.ndarray:
        """Calculate Exponential Moving Average"""
        if len(data) < period:
            return np.array([])

        alpha = 2 / (period + 1)
        ema = np.zeros(len(data))
        ema[0] = data[0]

        for i in range(1, len(data)):
            ema[i] = alpha * data[i] + (1 - alpha) * ema[i-1]

        return ema

    @staticmethod
    def _smooth_data(data: np.ndarray, period: int) -> np.ndarray:
        """Smooth data using Wilder's smoothing method"""
        if len(data) < period:
            return data

        smoothed = np.zeros(len(data))
        smoothed[period-1] = np.mean(data[:period])

        for i in range(period, len(data)):
            smoothed[i] = (smoothed[i-1] * (period - 1) + data[i]) / period

        return smoothed[period-1:]


class TechnicalScanner:
    """
    Scanner specialized for technical analysis

    Provides pre-built scanning strategies for common technical
    analysis patterns and indicator combinations.
    """

    def __init__(self, scanner_engine: ScannerEngine):
        self.scanner_engine = scanner_engine
        self.calculator = TechnicalIndicatorCalculator()

    async def scan_oversold_rsi(self, universe: List[str], threshold: float = 30.0) -> List[ScanResult]:
        """Scan for oversold RSI conditions"""
        config = ScannerConfig(
            name="Oversold RSI Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            technical_filter=TechnicalFilter(
                rsi_max=Decimal(str(threshold))
            ),
            sort_by="rsi",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_overbought_rsi(self, universe: List[str], threshold: float = 70.0) -> List[ScanResult]:
        """Scan for overbought RSI conditions"""
        config = ScannerConfig(
            name="Overbought RSI Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            technical_filter=TechnicalFilter(
                rsi_min=Decimal(str(threshold))
            ),
            sort_by="rsi",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_bullish_macd(self, universe: List[str]) -> List[ScanResult]:
        """Scan for bullish MACD signals"""
        config = ScannerConfig(
            name="Bullish MACD Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            technical_filter=TechnicalFilter(
                macd_signal="bullish"
            ),
            sort_by="macd_histogram",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_bearish_macd(self, universe: List[str]) -> List[ScanResult]:
        """Scan for bearish MACD signals"""
        config = ScannerConfig(
            name="Bearish MACD Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            technical_filter=TechnicalFilter(
                macd_signal="bearish"
            ),
            sort_by="macd_histogram",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_bollinger_squeeze(self, universe: List[str], width_threshold: float = 10.0) -> List[ScanResult]:
        """Scan for Bollinger Band squeeze (low volatility)"""
        # This would be implemented with custom conditions
        from ...models.scanner_models import FilterGroup, FilterCondition

        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="indicators.bollinger_width",
                    operator=ComparisonOperator.LESS_THAN,
                    value=width_threshold
                )
            ]
        )

        config = ScannerConfig(
            name="Bollinger Squeeze Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="indicators.bollinger_width",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_trending_stocks(self, universe: List[str], adx_threshold: float = 25.0) -> List[ScanResult]:
        """Scan for strongly trending stocks using ADX"""
        config = ScannerConfig(
            name="Trending Stocks Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            technical_filter=TechnicalFilter(
                adx_min=Decimal(str(adx_threshold))
            ),
            sort_by="adx",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_golden_cross(self, universe: List[str]) -> List[ScanResult]:
        """Scan for golden cross pattern (50 SMA crossing above 200 SMA)"""
        from ...models.scanner_models import FilterGroup, FilterCondition

        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="indicators.sma_50",
                    operator=ComparisonOperator.CROSSES_ABOVE,
                    value="indicators.sma_200"
                )
            ]
        )

        config = ScannerConfig(
            name="Golden Cross Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="change_percent",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_death_cross(self, universe: List[str]) -> List[ScanResult]:
        """Scan for death cross pattern (50 SMA crossing below 200 SMA)"""
        from ...models.scanner_models import FilterGroup, FilterCondition

        custom_conditions = FilterGroup(
            operator="AND",
            conditions=[
                FilterCondition(
                    field="indicators.sma_50",
                    operator=ComparisonOperator.CROSSES_BELOW,
                    value="indicators.sma_200"
                )
            ]
        )

        config = ScannerConfig(
            name="Death Cross Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            custom_conditions=custom_conditions,
            sort_by="change_percent",
            sort_order="asc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def scan_breakout_candidates(self, universe: List[str], volume_ratio: float = 2.0) -> List[ScanResult]:
        """Scan for breakout candidates with high volume"""
        from ...models.scanner_models import FilterGroup, FilterCondition, VolumeFilter, PriceFilter

        config = ScannerConfig(
            name="Breakout Candidates Scanner",
            scanner_type="technical",
            asset_types=["stock"],
            universe=universe,
            volume_filter=VolumeFilter(
                volume_ratio=Decimal(str(volume_ratio))
            ),
            price_filter=PriceFilter(
                near_high=Decimal('5.0')  # Within 5% of recent high
            ),
            sort_by="volume_ratio",
            sort_order="desc"
        )

        response = await self.scanner_engine.run_scanner(config)
        return response.results

    async def calculate_comprehensive_indicators(self, symbol: str, ohlcv_data: Dict[str, List[float]]) -> Dict[str, Any]:
        """Calculate comprehensive technical indicators for a symbol"""
        try:
            high = ohlcv_data.get('high', [])
            low = ohlcv_data.get('low', [])
            close = ohlcv_data.get('close', [])
            volume = ohlcv_data.get('volume', [])

            if not close:
                return {}

            indicators = {}

            # Basic indicators
            indicators['rsi'] = self.calculator.calculate_rsi(close)
            indicators.update(self.calculator.calculate_macd(close))
            indicators.update(self.calculator.calculate_bollinger_bands(close))
            indicators.update(self.calculator.calculate_moving_averages(close))

            # Advanced indicators (if we have OHLC data)
            if high and low and len(high) == len(low) == len(close):
                indicators['adx'] = self.calculator.calculate_adx(high, low, close)
                indicators.update(self.calculator.calculate_stochastic(high, low, close))
                indicators['atr'] = self.calculator.calculate_atr(high, low, close)
                indicators['williams_r'] = self.calculator.calculate_williams_r(high, low, close)

            # Volume indicators
            if volume and len(volume) == len(close):
                indicators['obv'] = self.calculator.calculate_obv(close, volume)

            # Add derived indicators
            indicators['price_vs_sma20'] = self._calculate_price_vs_ma(close, indicators.get('sma_20', 0))
            indicators['price_vs_sma50'] = self._calculate_price_vs_ma(close, indicators.get('sma_50', 0))
            indicators['price_vs_sma200'] = self._calculate_price_vs_ma(close, indicators.get('sma_200', 0))

            return indicators

        except Exception as e:
            logger.error(f"Error calculating indicators for {symbol}: {e}")
            return {}

    def _calculate_price_vs_ma(self, prices: List[float], ma_value: float) -> float:
        """Calculate price position relative to moving average"""
        if not prices or ma_value == 0:
            return 0.0

        current_price = prices[-1]
        return ((current_price - ma_value) / ma_value) * 100

    async def create_custom_technical_scanner(
        self,
        name: str,
        rsi_range: Optional[Tuple[float, float]] = None,
        macd_signal: Optional[str] = None,
        price_vs_ma: Optional[Dict[str, str]] = None,  # {'sma20': 'above', 'sma50': 'below'}
        volume_threshold: Optional[float] = None,
        adx_min: Optional[float] = None
    ) -> ScannerConfig:
        """Create custom technical scanner configuration"""

        technical_filter = TechnicalFilter()

        if rsi_range:
            technical_filter.rsi_min = Decimal(str(rsi_range[0]))
            technical_filter.rsi_max = Decimal(str(rsi_range[1]))

        if macd_signal:
            technical_filter.macd_signal = macd_signal

        if adx_min:
            technical_filter.adx_min = Decimal(str(adx_min))

        volume_filter = None
        if volume_threshold:
            from ...models.scanner_models import VolumeFilter
            volume_filter = VolumeFilter(volume_ratio=Decimal(str(volume_threshold)))

        # Custom conditions for price vs MA
        custom_conditions = None
        if price_vs_ma:
            from ...models.scanner_models import FilterGroup, FilterCondition
            conditions = []

            for ma_type, direction in price_vs_ma.items():
                if direction == 'above':
                    operator = ComparisonOperator.GREATER_THAN
                    value = 0
                elif direction == 'below':
                    operator = ComparisonOperator.LESS_THAN
                    value = 0
                else:
                    continue

                conditions.append(FilterCondition(
                    field=f"indicators.price_vs_{ma_type}",
                    operator=operator,
                    value=value
                ))

            if conditions:
                custom_conditions = FilterGroup(
                    operator="AND",
                    conditions=conditions
                )

        return ScannerConfig(
            name=name,
            scanner_type="technical",
            asset_types=["stock"],
            technical_filter=technical_filter,
            volume_filter=volume_filter,
            custom_conditions=custom_conditions,
            sort_by="match_score",
            sort_order="desc"
        )