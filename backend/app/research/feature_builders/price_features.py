"""
Price feature builder for stock analysis.

Provides feature engineering for price-based features
including volatility, returns, and statistical measures.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class PriceFeatureConfig:
    """Configuration for price features."""
    return_periods: List[int] = None
    volatility_periods: List[int] = None
    rolling_periods: List[int] = None
    quantile_periods: int = 252
    outlier_threshold: float = 3.0

    def __post_init__(self):
        if self.return_periods is None:
            self.return_periods = [1, 5, 10, 20]
        if self.volatility_periods is None:
            self.volatility_periods = [5, 10, 20, 60]
        if self.rolling_periods is None:
            self.rolling_periods = [20, 60, 252]


class PriceFeatureBuilder:
    """
    Builds price-based features from OHLCV data.

    Features computed:
    - Returns (simple and log returns)
    - Volatility measures
    - Price levels and percentiles
    - Statistical measures
    - Regime indicators
    - Momentum features
    """

    def __init__(self, config: Optional[PriceFeatureConfig] = None):
        self.config = config or PriceFeatureConfig()

    def build_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Build all price-based features.

        Args:
            df: DataFrame with OHLCV columns

        Returns:
            DataFrame with price features
        """
        if not self._validate_input(df):
            raise ValueError("Invalid input DataFrame")

        result = df.copy()

        # Returns and momentum
        result = self._add_returns(result)
        result = self._add_momentum_features(result)

        # Volatility measures
        result = self._add_volatility_features(result)

        # Price levels and statistical measures
        result = self._add_price_levels(result)
        result = self._add_statistical_features(result)

        # Regime indicators
        result = self._add_regime_features(result)

        # Seasonal features
        result = self._add_seasonal_features(result)

        return result

    def _validate_input(self, df: pd.DataFrame) -> bool:
        """Validate input DataFrame."""
        required_cols = ['open', 'high', 'low', 'close', 'volume']
        if not all(col in df.columns for col in required_cols):
            return False
        if df.empty:
            return False
        return True

    def _add_returns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add return-based features."""
        close = df['close']

        # Simple returns for different periods
        for period in self.config.return_periods:
            df[f'return_{period}d'] = close.pct_change(periods=period)
            df[f'log_return_{period}d'] = np.log(close / close.shift(period))

        # Cumulative returns
        df['cumulative_return'] = (close / close.iloc[0]) - 1

        # Forward returns (for prediction targets)
        df['forward_return_1d'] = close.shift(-1) / close - 1
        df['forward_return_5d'] = close.shift(-5) / close - 1

        return df

    def _add_momentum_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add momentum-based features."""
        close = df['close']

        # Rate of Change (ROC)
        for period in [5, 10, 20]:
            df[f'roc_{period}'] = ((close - close.shift(period)) / close.shift(period)) * 100

        # Momentum oscillator
        df['momentum_10'] = close / close.shift(10)
        df['momentum_20'] = close / close.shift(20)

        # Price position within recent range
        for period in [20, 60]:
            high_period = df['high'].rolling(window=period).max()
            low_period = df['low'].rolling(window=period).min()
            df[f'price_position_{period}'] = (close - low_period) / (high_period - low_period)

        return df

    def _add_volatility_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add volatility-based features."""
        close = df['close']
        high = df['high']
        low = df['low']

        # Historical volatility (annualized)
        for period in self.config.volatility_periods:
            returns = close.pct_change()
            df[f'volatility_{period}d'] = returns.rolling(window=period).std() * np.sqrt(252)

        # Parkinson volatility (using high-low)
        df['parkinson_volatility'] = np.sqrt(
            0.5 * np.log(high / low) ** 2 - (2 * np.log(2) - 1) * np.log(close / close.shift(1)) ** 2
        ).rolling(window=20).mean() * np.sqrt(252)

        # Garman-Klass volatility
        df['gk_volatility'] = np.sqrt(
            0.5 * (np.log(high / low)) ** 2 - (2 * np.log(2) - 1) * (np.log(close / close.shift(1))) ** 2
        ).rolling(window=20).mean() * np.sqrt(252)

        # Volatility ratios
        df['volatility_ratio_5_20'] = df['volatility_5d'] / df['volatility_20d']
        df['volatility_ratio_10_60'] = df['volatility_10d'] / df['volatility_60d']

        # High-low spread
        df['hl_spread'] = (high - low) / close
        df['hl_spread_ma'] = df['hl_spread'].rolling(window=20).mean()

        return df

    def _add_price_levels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add price level features."""
        close = df['close']

        # Rolling statistics
        for period in self.config.rolling_periods:
            rolling_close = close.rolling(window=period)
            df[f'price_mean_{period}'] = rolling_close.mean()
            df[f'price_std_{period}'] = rolling_close.std()
            df[f'price_min_{period}'] = rolling_close.min()
            df[f'price_max_{period}'] = rolling_close.max()
            df[f'price_median_{period}'] = rolling_close.median()

            # Distance from statistics
            df[f'dist_from_mean_{period}'] = (close - df[f'price_mean_{period}']) / df[f'price_std_{period}']
            df[f'dist_from_min_{period}'] = (close - df[f'price_min_{period}']) / close
            df[f'dist_from_max_{period}'] = (df[f'price_max_{period}'] - close) / close

        # Percentile ranks
        df['price_percentile_252'] = close.rolling(window=self.config.quantile_periods).rank(pct=True)

        return df

    def _add_statistical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add statistical features."""
        close = df['close']
        returns = close.pct_change()

        # Skewness and kurtosis of returns
        for period in [20, 60]:
            df[f'returns_skew_{period}'] = returns.rolling(window=period).skew()
            df[f'returns_kurtosis_{period}'] = returns.rolling(window=period).kurt()

        # Z-score
        for period in [20, 60]:
            mean = close.rolling(window=period).mean()
            std = close.rolling(window=period).std()
            df[f'zscore_{period}'] = (close - mean) / std

        # Outlier detection
        df['is_outlier'] = (np.abs(df['zscore_20']) > self.config.outlier_threshold).astype(int)

        # Autocorrelation
        for lag in [1, 5, 10]:
            df[f'return_autocorr_lag{lag}'] = returns.rolling(window=50).apply(
                lambda x: x.autocorr(lag=lag) if len(x) > lag else np.nan, raw=False
            )

        return df

    def _add_regime_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add regime detection features."""
        close = df['close']
        returns = close.pct_change()

        # Trend detection using moving averages
        sma_20 = close.rolling(window=20).mean()
        sma_50 = close.rolling(window=50).mean()
        sma_200 = close.rolling(window=200).mean()

        df['trend_short'] = (close > sma_20).astype(int)
        df['trend_medium'] = (sma_20 > sma_50).astype(int)
        df['trend_long'] = (sma_50 > sma_200).astype(int)

        # Bull/Bear market indicators
        df['bull_market'] = (close > sma_200).astype(int)
        df['bear_market'] = (close < sma_200 * 0.8).astype(int)  # 20% below long-term average

        # Volatility regime
        vol_20 = returns.rolling(window=20).std() * np.sqrt(252)
        vol_60 = returns.rolling(window=60).std() * np.sqrt(252)
        df['high_vol_regime'] = (vol_20 > vol_60 * 1.5).astype(int)
        df['low_vol_regime'] = (vol_20 < vol_60 * 0.7).astype(int)

        # Market state (combining trend and volatility)
        df['market_state'] = (
            df['trend_short'] * 4 +
            df['trend_medium'] * 2 +
            df['high_vol_regime'] * 1
        )

        return df

    def _add_seasonal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add seasonal and calendar features."""
        if df.index.dtype != 'datetime64[ns]':
            # Try to parse index as datetime if it's not already
            try:
                df.index = pd.to_datetime(df.index)
            except:
                logger.warning("Cannot parse index as datetime, skipping seasonal features")
                return df

        # Day of week effect
        df['day_of_week'] = df.index.dayofweek
        df['is_monday'] = (df['day_of_week'] == 0).astype(int)
        df['is_friday'] = (df['day_of_week'] == 4).astype(int)

        # Month effect
        df['month'] = df.index.month
        df['is_january'] = (df['month'] == 1).astype(int)
        df['is_december'] = (df['month'] == 12).astype(int)

        # Quarter effect
        df['quarter'] = df.index.quarter
        df['is_q1'] = (df['quarter'] == 1).astype(int)
        df['is_q4'] = (df['quarter'] == 4).astype(int)

        # End of month/quarter effects
        df['is_month_end'] = df.index.is_month_end.astype(int)
        df['is_quarter_end'] = df.index.is_quarter_end.astype(int)

        return df

    def get_feature_names(self) -> List[str]:
        """Get list of all feature names that will be generated."""
        features = []

        # Return features
        for period in self.config.return_periods:
            features.extend([f'return_{period}d', f'log_return_{period}d'])
        features.extend(['cumulative_return', 'forward_return_1d', 'forward_return_5d'])

        # Momentum features
        features.extend(['roc_5', 'roc_10', 'roc_20', 'momentum_10', 'momentum_20'])
        features.extend(['price_position_20', 'price_position_60'])

        # Volatility features
        for period in self.config.volatility_periods:
            features.append(f'volatility_{period}d')
        features.extend([
            'parkinson_volatility', 'gk_volatility', 'volatility_ratio_5_20', 'volatility_ratio_10_60',
            'hl_spread', 'hl_spread_ma'
        ])

        # Price level features
        for period in self.config.rolling_periods:
            features.extend([
                f'price_mean_{period}', f'price_std_{period}', f'price_min_{period}',
                f'price_max_{period}', f'price_median_{period}', f'dist_from_mean_{period}',
                f'dist_from_min_{period}', f'dist_from_max_{period}'
            ])
        features.append('price_percentile_252')

        # Statistical features
        features.extend([
            'returns_skew_20', 'returns_skew_60', 'returns_kurtosis_20', 'returns_kurtosis_60',
            'zscore_20', 'zscore_60', 'is_outlier',
            'return_autocorr_lag1', 'return_autocorr_lag5', 'return_autocorr_lag10'
        ])

        # Regime features
        features.extend([
            'trend_short', 'trend_medium', 'trend_long', 'bull_market', 'bear_market',
            'high_vol_regime', 'low_vol_regime', 'market_state'
        ])

        # Seasonal features
        features.extend([
            'day_of_week', 'is_monday', 'is_friday', 'month', 'is_january', 'is_december',
            'quarter', 'is_q1', 'is_q4', 'is_month_end', 'is_quarter_end'
        ])

        return features