"""
Technical indicator feature builder for stock analysis.

Provides feature engineering for technical analysis indicators
with deterministic computation and validation.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class IndicatorConfig:
    """Configuration for technical indicators."""
    rsi_period: int = 14
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    bb_period: int = 20
    bb_std: float = 2.0
    ema_periods: List[int] = None
    sma_periods: List[int] = None

    def __post_init__(self):
        if self.ema_periods is None:
            self.ema_periods = [12, 26, 50]
        if self.sma_periods is None:
            self.sma_periods = [20, 50, 200]


class TechnicalIndicatorBuilder:
    """
    Builds technical indicator features from OHLCV data.

    Features computed:
    - RSI (Relative Strength Index)
    - MACD (Moving Average Convergence Divergence)
    - Bollinger Bands
    - Moving Averages (SMA, EMA)
    - Stochastic Oscillator
    - ATR (Average True Range)
    - OBV (On-Balance Volume)
    - ADX (Average Directional Index)
    """

    def __init__(self, config: Optional[IndicatorConfig] = None):
        self.config = config or IndicatorConfig()
        self._validate_config()

    def _validate_config(self) -> None:
        """Validate configuration parameters."""
        if self.config.rsi_period <= 0:
            raise ValueError("RSI period must be positive")
        if self.config.macd_fast >= self.config.macd_slow:
            raise ValueError("MACD fast period must be less than slow period")
        if self.config.bb_std <= 0:
            raise ValueError("Bollinger Bands standard deviation must be positive")

    def build_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Build all technical indicator features.

        Args:
            df: DataFrame with OHLCV columns (open, high, low, close, volume)

        Returns:
            DataFrame with technical indicator features
        """
        if not self._validate_input(df):
            raise ValueError("Invalid input DataFrame")

        result = df.copy()

        # Price-based indicators
        result = self._add_rsi(result)
        result = self._add_macd(result)
        result = self._add_bollinger_bands(result)
        result = self._add_moving_averages(result)
        result = self._add_stochastic(result)
        result = self._add_atr(result)

        # Volume-based indicators
        result = self._add_obv(result)

        # Trend indicators
        result = self._add_adx(result)

        # Price action features
        result = self._add_price_action_features(result)

        return result

    def _validate_input(self, df: pd.DataFrame) -> bool:
        """Validate input DataFrame has required columns."""
        required_cols = ['open', 'high', 'low', 'close', 'volume']
        return all(col in df.columns for col in required_cols)

    def _add_rsi(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add RSI indicator."""
        close = df['close']
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=self.config.rsi_period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=self.config.rsi_period).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))

        # RSI-based features
        df['rsi_overbought'] = (df['rsi'] > 70).astype(int)
        df['rsi_oversold'] = (df['rsi'] < 30).astype(int)
        df['rsi_divergence'] = df['rsi'].diff()

        return df

    def _add_macd(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add MACD indicator."""
        close = df['close']
        ema_fast = close.ewm(span=self.config.macd_fast).mean()
        ema_slow = close.ewm(span=self.config.macd_slow).mean()

        df['macd_line'] = ema_fast - ema_slow
        df['macd_signal'] = df['macd_line'].ewm(span=self.config.macd_signal).mean()
        df['macd_histogram'] = df['macd_line'] - df['macd_signal']

        # MACD-based features
        df['macd_bullish_crossover'] = (
            (df['macd_line'] > df['macd_signal']) &
            (df['macd_line'].shift(1) <= df['macd_signal'].shift(1))
        ).astype(int)
        df['macd_bearish_crossover'] = (
            (df['macd_line'] < df['macd_signal']) &
            (df['macd_line'].shift(1) >= df['macd_signal'].shift(1))
        ).astype(int)

        return df

    def _add_bollinger_bands(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add Bollinger Bands."""
        close = df['close']
        sma = close.rolling(window=self.config.bb_period).mean()
        std = close.rolling(window=self.config.bb_period).std()

        df['bb_upper'] = sma + (std * self.config.bb_std)
        df['bb_middle'] = sma
        df['bb_lower'] = sma - (std * self.config.bb_std)

        # Bollinger Band features
        df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']
        df['bb_position'] = (close - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])
        df['bb_squeeze'] = (df['bb_width'] < df['bb_width'].rolling(20).mean() * 0.8).astype(int)

        return df

    def _add_moving_averages(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add moving averages."""
        close = df['close']

        # Simple Moving Averages
        for period in self.config.sma_periods:
            df[f'sma_{period}'] = close.rolling(window=period).mean()
            df[f'sma_{period}_signal'] = (close > df[f'sma_{period}']).astype(int)

        # Exponential Moving Averages
        for period in self.config.ema_periods:
            df[f'ema_{period}'] = close.ewm(span=period).mean()
            df[f'ema_{period}_signal'] = (close > df[f'ema_{period}']).astype(int)

        # Moving average crossovers
        if 20 in self.config.sma_periods and 50 in self.config.sma_periods:
            df['golden_cross'] = (
                (df['sma_20'] > df['sma_50']) &
                (df['sma_20'].shift(1) <= df['sma_50'].shift(1))
            ).astype(int)
            df['death_cross'] = (
                (df['sma_20'] < df['sma_50']) &
                (df['sma_20'].shift(1) >= df['sma_50'].shift(1))
            ).astype(int)

        return df

    def _add_stochastic(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add Stochastic Oscillator."""
        high = df['high']
        low = df['low']
        close = df['close']

        lowest_low = low.rolling(window=14).min()
        highest_high = high.rolling(window=14).max()

        df['stoch_k'] = 100 * (close - lowest_low) / (highest_high - lowest_low)
        df['stoch_d'] = df['stoch_k'].rolling(window=3).mean()

        # Stochastic features
        df['stoch_overbought'] = (df['stoch_k'] > 80).astype(int)
        df['stoch_oversold'] = (df['stoch_k'] < 20).astype(int)

        return df

    def _add_atr(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add Average True Range."""
        high = df['high']
        low = df['low']
        close = df['close']
        prev_close = close.shift(1)

        tr1 = high - low
        tr2 = abs(high - prev_close)
        tr3 = abs(low - prev_close)

        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        df['atr'] = true_range.rolling(window=14).mean()
        df['atr_percent'] = df['atr'] / close * 100

        return df

    def _add_obv(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add On-Balance Volume."""
        close = df['close']
        volume = df['volume']

        obv = []
        obv_value = 0

        for i in range(len(df)):
            if i == 0:
                obv_value = volume.iloc[i]
            else:
                if close.iloc[i] > close.iloc[i-1]:
                    obv_value += volume.iloc[i]
                elif close.iloc[i] < close.iloc[i-1]:
                    obv_value -= volume.iloc[i]
                # If close is same, OBV doesn't change
            obv.append(obv_value)

        df['obv'] = obv
        df['obv_ma'] = df['obv'].rolling(window=20).mean()
        df['obv_signal'] = (df['obv'] > df['obv_ma']).astype(int)

        return df

    def _add_adx(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add Average Directional Index."""
        high = df['high']
        low = df['low']
        close = df['close']

        # Calculate directional movement
        plus_dm = high.diff()
        minus_dm = low.diff()

        plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
        minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0).abs()

        # True Range
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        # Directional Indicators
        plus_di = 100 * (plus_dm.rolling(14).mean() / true_range.rolling(14).mean())
        minus_di = 100 * (minus_dm.rolling(14).mean() / true_range.rolling(14).mean())

        # ADX
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        df['adx'] = dx.rolling(14).mean()
        df['plus_di'] = plus_di
        df['minus_di'] = minus_di

        # ADX features
        df['adx_trending'] = (df['adx'] > 25).astype(int)
        df['adx_strong_trend'] = (df['adx'] > 40).astype(int)

        return df

    def _add_price_action_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add price action based features."""
        high = df['high']
        low = df['low']
        close = df['close']
        open_ = df['open']

        # Basic price features
        df['price_change'] = close.pct_change()
        df['price_range'] = (high - low) / close
        df['gap'] = (open_ - close.shift(1)) / close.shift(1)

        # Candle patterns (simplified)
        df['doji'] = (abs(close - open_) / (high - low) < 0.1).astype(int)
        df['hammer'] = (
            ((close - low) > 2 * (open_ - close)) &
            ((high - close) < (close - low))
        ).astype(int)
        df['shooting_star'] = (
            ((high - open_) > 2 * (close - open_)) &
            ((close - low) < (high - close))
        ).astype(int)

        # Volume features
        df['volume_ma'] = df['volume'].rolling(window=20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_ma']
        df['volume_spike'] = (df['volume_ratio'] > 2).astype(int)

        return df

    def get_feature_names(self) -> List[str]:
        """Get list of all feature names that will be generated."""
        features = [
            'rsi', 'rsi_overbought', 'rsi_oversold', 'rsi_divergence',
            'macd_line', 'macd_signal', 'macd_histogram', 'macd_bullish_crossover', 'macd_bearish_crossover',
            'bb_upper', 'bb_middle', 'bb_lower', 'bb_width', 'bb_position', 'bb_squeeze',
            'stoch_k', 'stoch_d', 'stoch_overbought', 'stoch_oversold',
            'atr', 'atr_percent',
            'obv', 'obv_ma', 'obv_signal',
            'adx', 'plus_di', 'minus_di', 'adx_trending', 'adx_strong_trend',
            'price_change', 'price_range', 'gap',
            'doji', 'hammer', 'shooting_star',
            'volume_ma', 'volume_ratio', 'volume_spike'
        ]

        # Add SMA features
        for period in self.config.sma_periods:
            features.extend([f'sma_{period}', f'sma_{period}_signal'])

        # Add EMA features
        for period in self.config.ema_periods:
            features.extend([f'ema_{period}', f'ema_{period}_signal'])

        # Add crossover features if applicable
        if 20 in self.config.sma_periods and 50 in self.config.sma_periods:
            features.extend(['golden_cross', 'death_cross'])

        return features