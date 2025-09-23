"""
Sentiment feature builder for stock analysis.

Provides feature engineering for sentiment analysis
including news sentiment, social media sentiment, and market sentiment.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class SentimentFeatureConfig:
    """Configuration for sentiment features."""
    rolling_periods: List[int] = None
    sentiment_threshold: float = 0.1
    volume_threshold: float = 1.5
    decay_factor: float = 0.95

    def __post_init__(self):
        if self.rolling_periods is None:
            self.rolling_periods = [5, 10, 20]


class SentimentFeatureBuilder:
    """
    Builds sentiment-based features from sentiment data.

    Features computed:
    - Sentiment momentum and trends
    - Sentiment volatility
    - Sentiment-volume interactions
    - News flow metrics
    - Social media metrics
    - Cross-sentiment correlations
    """

    def __init__(self, config: Optional[SentimentFeatureConfig] = None):
        self.config = config or SentimentFeatureConfig()

    def build_features(self, df: pd.DataFrame, sentiment_data: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        """
        Build all sentiment-based features.

        Args:
            df: DataFrame with OHLCV columns
            sentiment_data: DataFrame with sentiment columns (news_sentiment, social_sentiment, etc.)

        Returns:
            DataFrame with sentiment features
        """
        result = df.copy()

        if sentiment_data is not None:
            # Merge sentiment data
            result = self._merge_sentiment_data(result, sentiment_data)

        # Create base sentiment features if not provided
        if 'news_sentiment' not in result.columns:
            result = self._create_mock_sentiment_features(result)

        # Build sentiment features
        result = self._add_sentiment_momentum(result)
        result = self._add_sentiment_volatility(result)
        result = self._add_sentiment_volume_features(result)
        result = self._add_news_flow_features(result)
        result = self._add_social_sentiment_features(result)
        result = self._add_sentiment_regime_features(result)

        return result

    def _merge_sentiment_data(self, df: pd.DataFrame, sentiment_data: pd.DataFrame) -> pd.DataFrame:
        """Merge sentiment data with price data."""
        return df.merge(sentiment_data, left_index=True, right_index=True, how='left')

    def _create_mock_sentiment_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create mock sentiment features for testing purposes."""
        np.random.seed(42)  # For reproducibility
        n = len(df)

        # Base sentiment scores (-1 to 1)
        df['news_sentiment'] = np.random.normal(0, 0.3, n)
        df['social_sentiment'] = np.random.normal(0, 0.4, n)
        df['analyst_sentiment'] = np.random.normal(0, 0.2, n)

        # News and social metrics
        df['news_count'] = np.random.poisson(5, n)
        df['social_mentions'] = np.random.poisson(50, n)
        df['news_volume'] = np.random.exponential(1, n)

        # Sentiment confidence scores
        df['news_confidence'] = np.random.uniform(0.5, 1.0, n)
        df['social_confidence'] = np.random.uniform(0.3, 0.9, n)

        # Add some correlation with price movements
        returns = df['close'].pct_change()
        df['news_sentiment'] += 0.3 * returns.shift(1).fillna(0)
        df['social_sentiment'] += 0.2 * returns.fillna(0)

        # Clip to valid ranges
        df['news_sentiment'] = np.clip(df['news_sentiment'], -1, 1)
        df['social_sentiment'] = np.clip(df['social_sentiment'], -1, 1)
        df['analyst_sentiment'] = np.clip(df['analyst_sentiment'], -1, 1)

        return df

    def _add_sentiment_momentum(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add sentiment momentum features."""
        # Sentiment changes
        df['news_sentiment_change'] = df['news_sentiment'].diff()
        df['social_sentiment_change'] = df['social_sentiment'].diff()

        # Sentiment momentum
        for period in [3, 5, 10]:
            df[f'news_momentum_{period}'] = df['news_sentiment'].rolling(window=period).mean()
            df[f'social_momentum_{period}'] = df['social_sentiment'].rolling(window=period).mean()

        # Sentiment acceleration
        df['news_sentiment_acceleration'] = df['news_sentiment_change'].diff()
        df['social_sentiment_acceleration'] = df['social_sentiment_change'].diff()

        # Sentiment trend strength
        for period in [5, 10]:
            news_trend = df['news_sentiment'].rolling(window=period)
            social_trend = df['social_sentiment'].rolling(window=period)

            df[f'news_trend_strength_{period}'] = np.abs(news_trend.apply(
                lambda x: np.corrcoef(x, range(len(x)))[0, 1] if len(x.dropna()) > 1 else 0
            ))
            df[f'social_trend_strength_{period}'] = np.abs(social_trend.apply(
                lambda x: np.corrcoef(x, range(len(x)))[0, 1] if len(x.dropna()) > 1 else 0
            ))

        return df

    def _add_sentiment_volatility(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add sentiment volatility features."""
        # Sentiment volatility
        for period in self.config.rolling_periods:
            df[f'news_volatility_{period}'] = df['news_sentiment'].rolling(window=period).std()
            df[f'social_volatility_{period}'] = df['social_sentiment'].rolling(window=period).std()

        # Sentiment dispersion (difference between sources)
        df['sentiment_dispersion'] = np.abs(df['news_sentiment'] - df['social_sentiment'])
        df['sentiment_dispersion_ma'] = df['sentiment_dispersion'].rolling(window=10).mean()

        # Sentiment regime changes
        df['news_regime_change'] = (
            np.abs(df['news_sentiment'] - df['news_momentum_10']) > self.config.sentiment_threshold
        ).astype(int)
        df['social_regime_change'] = (
            np.abs(df['social_sentiment'] - df['social_momentum_10']) > self.config.sentiment_threshold
        ).astype(int)

        return df

    def _add_sentiment_volume_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add sentiment-volume interaction features."""
        volume = df['volume']
        volume_ma = volume.rolling(window=20).mean()

        # High volume + sentiment combinations
        high_volume = (volume > volume_ma * self.config.volume_threshold).astype(int)

        df['high_vol_positive_news'] = (
            high_volume & (df['news_sentiment'] > self.config.sentiment_threshold)
        ).astype(int)
        df['high_vol_negative_news'] = (
            high_volume & (df['news_sentiment'] < -self.config.sentiment_threshold)
        ).astype(int)
        df['high_vol_positive_social'] = (
            high_volume & (df['social_sentiment'] > self.config.sentiment_threshold)
        ).astype(int)
        df['high_vol_negative_social'] = (
            high_volume & (df['social_sentiment'] < -self.config.sentiment_threshold)
        ).astype(int)

        # Sentiment-weighted volume
        df['sentiment_weighted_volume'] = volume * (df['news_sentiment'] + df['social_sentiment']) / 2

        # Volume surprise with sentiment
        volume_surprise = (volume - volume_ma) / volume_ma
        df['volume_surprise_positive_sentiment'] = (
            (volume_surprise > 0.5) & (df['news_sentiment'] > 0)
        ).astype(int)
        df['volume_surprise_negative_sentiment'] = (
            (volume_surprise > 0.5) & (df['news_sentiment'] < 0)
        ).astype(int)

        return df

    def _add_news_flow_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add news flow and coverage features."""
        # News flow metrics
        df['news_density'] = df['news_count'].rolling(window=5).sum()
        df['news_intensity'] = df['news_count'] * np.abs(df['news_sentiment'])

        # News coverage changes
        df['news_coverage_change'] = df['news_count'].pct_change()
        df['news_coverage_spike'] = (df['news_coverage_change'] > 1.0).astype(int)

        # News sentiment weighted by volume and confidence
        df['weighted_news_sentiment'] = (
            df['news_sentiment'] * df['news_volume'] * df['news_confidence']
        )

        # Rolling aggregations of news features
        for period in [3, 7, 14]:
            df[f'avg_news_sentiment_{period}'] = df['news_sentiment'].rolling(window=period).mean()
            df[f'max_news_sentiment_{period}'] = df['news_sentiment'].rolling(window=period).max()
            df[f'min_news_sentiment_{period}'] = df['news_sentiment'].rolling(window=period).min()
            df[f'news_sentiment_range_{period}'] = (
                df[f'max_news_sentiment_{period}'] - df[f'min_news_sentiment_{period}']
            )

        # News sentiment persistence
        df['news_persistence'] = df['news_sentiment'].rolling(window=5).apply(
            lambda x: (x > 0).sum() if len(x) > 0 else 0
        ) / 5

        return df

    def _add_social_sentiment_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add social media sentiment features."""
        # Social media metrics
        df['social_buzz'] = df['social_mentions'] * np.abs(df['social_sentiment'])
        df['social_reach'] = df['social_mentions'].rolling(window=3).sum()

        # Social sentiment momentum
        df['social_bullish_momentum'] = (
            df['social_sentiment'].rolling(window=5).apply(lambda x: (x > 0.1).sum())
        )
        df['social_bearish_momentum'] = (
            df['social_sentiment'].rolling(window=5).apply(lambda x: (x < -0.1).sum())
        )

        # Social sentiment extremes
        df['social_extreme_positive'] = (df['social_sentiment'] > 0.7).astype(int)
        df['social_extreme_negative'] = (df['social_sentiment'] < -0.7).astype(int)

        # Social sentiment consistency
        df['social_consistency'] = 1 - df['social_sentiment'].rolling(window=7).std()

        # Viral content indicators
        df['viral_positive'] = (
            (df['social_mentions'] > df['social_mentions'].rolling(50).quantile(0.9)) &
            (df['social_sentiment'] > 0.3)
        ).astype(int)
        df['viral_negative'] = (
            (df['social_mentions'] > df['social_mentions'].rolling(50).quantile(0.9)) &
            (df['social_sentiment'] < -0.3)
        ).astype(int)

        return df

    def _add_sentiment_regime_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add sentiment regime and cross-correlation features."""
        # Combined sentiment score
        df['combined_sentiment'] = (
            0.4 * df['news_sentiment'] +
            0.3 * df['social_sentiment'] +
            0.3 * df['analyst_sentiment']
        )

        # Sentiment consensus
        sentiments = ['news_sentiment', 'social_sentiment', 'analyst_sentiment']
        df['sentiment_consensus'] = df[sentiments].apply(
            lambda row: 1 if all(x > 0.1 for x in row) else (-1 if all(x < -0.1 for x in row) else 0),
            axis=1
        )

        # Sentiment divergence
        df['sentiment_divergence'] = df[sentiments].std(axis=1)

        # Sentiment regimes
        combined_ma = df['combined_sentiment'].rolling(window=20).mean()
        df['bullish_sentiment_regime'] = (df['combined_sentiment'] > 0.2).astype(int)
        df['bearish_sentiment_regime'] = (df['combined_sentiment'] < -0.2).astype(int)
        df['neutral_sentiment_regime'] = (
            (df['combined_sentiment'] >= -0.2) & (df['combined_sentiment'] <= 0.2)
        ).astype(int)

        # Sentiment-price correlation
        returns = df['close'].pct_change()
        for period in [10, 20]:
            df[f'sentiment_price_corr_{period}'] = df['combined_sentiment'].rolling(window=period).corr(returns)

        # Sentiment leading/lagging indicators
        df['sentiment_leads_price'] = (
            df['combined_sentiment'].shift(1).rolling(window=5).corr(returns) >
            df['combined_sentiment'].rolling(window=5).corr(returns)
        ).astype(int)

        return df

    def get_feature_names(self) -> List[str]:
        """Get list of all feature names that will be generated."""
        features = [
            # Base sentiment features
            'news_sentiment', 'social_sentiment', 'analyst_sentiment',
            'news_count', 'social_mentions', 'news_volume',
            'news_confidence', 'social_confidence',

            # Sentiment momentum
            'news_sentiment_change', 'social_sentiment_change',
            'news_sentiment_acceleration', 'social_sentiment_acceleration',

            # Sentiment volatility
            'sentiment_dispersion', 'sentiment_dispersion_ma',
            'news_regime_change', 'social_regime_change',

            # Sentiment-volume interactions
            'high_vol_positive_news', 'high_vol_negative_news',
            'high_vol_positive_social', 'high_vol_negative_social',
            'sentiment_weighted_volume', 'volume_surprise_positive_sentiment',
            'volume_surprise_negative_sentiment',

            # News flow features
            'news_density', 'news_intensity', 'news_coverage_change',
            'news_coverage_spike', 'weighted_news_sentiment', 'news_persistence',

            # Social sentiment features
            'social_buzz', 'social_reach', 'social_bullish_momentum', 'social_bearish_momentum',
            'social_extreme_positive', 'social_extreme_negative', 'social_consistency',
            'viral_positive', 'viral_negative',

            # Sentiment regime features
            'combined_sentiment', 'sentiment_consensus', 'sentiment_divergence',
            'bullish_sentiment_regime', 'bearish_sentiment_regime', 'neutral_sentiment_regime',
            'sentiment_leads_price'
        ]

        # Add rolling period features
        for period in [3, 5, 10]:
            features.extend([f'news_momentum_{period}', f'social_momentum_{period}'])

        for period in [5, 10]:
            features.extend([
                f'news_trend_strength_{period}', f'social_trend_strength_{period}'
            ])

        for period in self.config.rolling_periods:
            features.extend([
                f'news_volatility_{period}', f'social_volatility_{period}'
            ])

        for period in [3, 7, 14]:
            features.extend([
                f'avg_news_sentiment_{period}', f'max_news_sentiment_{period}',
                f'min_news_sentiment_{period}', f'news_sentiment_range_{period}'
            ])

        for period in [10, 20]:
            features.append(f'sentiment_price_corr_{period}')

        return features