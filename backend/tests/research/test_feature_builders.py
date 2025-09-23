"""
Unit tests for feature builders.

Tests all feature building components for stock analysis:
- Technical indicators
- Price features
- Sentiment features
- Market features
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app.research.feature_builders import (
    TechnicalIndicatorBuilder,
    PriceFeatureBuilder,
    SentimentFeatureBuilder,
    MarketFeatureBuilder
)
from app.research.feature_builders.technical_indicators import IndicatorConfig
from app.research.feature_builders.price_features import PriceFeatureConfig
from app.research.feature_builders.sentiment_features import SentimentFeatureConfig
from app.research.feature_builders.market_features import MarketFeatureConfig


class TestTechnicalIndicatorBuilder:
    """Test technical indicator feature builder."""

    @pytest.fixture
    def sample_ohlcv_data(self):
        """Create sample OHLCV data."""
        np.random.seed(42)
        n_days = 100
        base_price = 100

        # Generate realistic price data
        returns = np.random.normal(0.001, 0.02, n_days)
        prices = base_price * np.exp(np.cumsum(returns))

        close_prices = prices
        open_prices = np.concatenate([[close_prices[0]], close_prices[:-1]])
        high_prices = np.maximum(open_prices, close_prices) * (1 + np.random.uniform(0, 0.02, n_days))
        low_prices = np.minimum(open_prices, close_prices) * (1 - np.random.uniform(0, 0.02, n_days))
        volumes = np.random.lognormal(15, 0.5, n_days)

        df = pd.DataFrame({
            'open': open_prices,
            'high': high_prices,
            'low': low_prices,
            'close': close_prices,
            'volume': volumes
        })

        return df

    @pytest.fixture
    def builder(self):
        """Create technical indicator builder."""
        return TechnicalIndicatorBuilder()

    def test_builder_initialization(self):
        """Test builder initialization."""
        builder = TechnicalIndicatorBuilder()
        assert builder.config is not None
        assert isinstance(builder.config, IndicatorConfig)

        # Test with custom config
        config = IndicatorConfig(rsi_period=21)
        builder = TechnicalIndicatorBuilder(config)
        assert builder.config.rsi_period == 21

    def test_config_validation(self):
        """Test configuration validation."""
        # Valid config
        config = IndicatorConfig()
        builder = TechnicalIndicatorBuilder(config)

        # Invalid RSI period
        with pytest.raises(ValueError, match="RSI period must be positive"):
            TechnicalIndicatorBuilder(IndicatorConfig(rsi_period=0))

        # Invalid MACD periods
        with pytest.raises(ValueError, match="MACD fast period must be less than slow period"):
            TechnicalIndicatorBuilder(IndicatorConfig(macd_fast=26, macd_slow=12))

        # Invalid Bollinger Bands std
        with pytest.raises(ValueError, match="Bollinger Bands standard deviation must be positive"):
            TechnicalIndicatorBuilder(IndicatorConfig(bb_std=0))

    def test_input_validation(self, builder):
        """Test input data validation."""
        # Missing required columns
        invalid_df = pd.DataFrame({'price': [1, 2, 3]})
        with pytest.raises(ValueError, match="Invalid input DataFrame"):
            builder.build_features(invalid_df)

        # Empty DataFrame
        empty_df = pd.DataFrame(columns=['open', 'high', 'low', 'close', 'volume'])
        with pytest.raises(ValueError, match="Invalid input DataFrame"):
            builder.build_features(empty_df)

    def test_rsi_calculation(self, builder, sample_ohlcv_data):
        """Test RSI indicator calculation."""
        result = builder.build_features(sample_ohlcv_data)

        # Check RSI column exists
        assert 'rsi' in result.columns

        # Check RSI range (0-100)
        rsi_values = result['rsi'].dropna()
        assert (rsi_values >= 0).all()
        assert (rsi_values <= 100).all()

        # Check RSI derivative features
        assert 'rsi_overbought' in result.columns
        assert 'rsi_oversold' in result.columns
        assert 'rsi_divergence' in result.columns

        # Check binary nature of overbought/oversold
        assert result['rsi_overbought'].dtype == int
        assert result['rsi_oversold'].dtype == int

    def test_macd_calculation(self, builder, sample_ohlcv_data):
        """Test MACD indicator calculation."""
        result = builder.build_features(sample_ohlcv_data)

        # Check MACD columns exist
        assert 'macd_line' in result.columns
        assert 'macd_signal' in result.columns
        assert 'macd_histogram' in result.columns

        # Check crossover signals
        assert 'macd_bullish_crossover' in result.columns
        assert 'macd_bearish_crossover' in result.columns

        # Verify histogram = line - signal
        histogram_check = np.allclose(
            result['macd_histogram'].dropna(),
            (result['macd_line'] - result['macd_signal']).dropna(),
            rtol=1e-10
        )
        assert histogram_check

    def test_bollinger_bands_calculation(self, builder, sample_ohlcv_data):
        """Test Bollinger Bands calculation."""
        result = builder.build_features(sample_ohlcv_data)

        # Check Bollinger Bands columns
        assert 'bb_upper' in result.columns
        assert 'bb_middle' in result.columns
        assert 'bb_lower' in result.columns
        assert 'bb_width' in result.columns
        assert 'bb_position' in result.columns

        # Check band relationships
        valid_data = result[['bb_upper', 'bb_middle', 'bb_lower']].dropna()
        assert (valid_data['bb_upper'] >= valid_data['bb_middle']).all()
        assert (valid_data['bb_middle'] >= valid_data['bb_lower']).all()

        # Check position is between 0 and 1 (mostly)
        positions = result['bb_position'].dropna()
        # Allow some values outside 0-1 (breakouts)
        assert (positions >= -0.5).all()
        assert (positions <= 1.5).all()

    def test_moving_averages(self, builder, sample_ohlcv_data):
        """Test moving average calculations."""
        result = builder.build_features(sample_ohlcv_data)

        # Check SMA columns
        for period in [20, 50, 200]:
            assert f'sma_{period}' in result.columns
            assert f'sma_{period}_signal' in result.columns

        # Check EMA columns
        for period in [12, 26, 50]:
            assert f'ema_{period}' in result.columns
            assert f'ema_{period}_signal' in result.columns

        # Check crossover signals
        if 'sma_20' in result.columns and 'sma_50' in result.columns:
            assert 'golden_cross' in result.columns
            assert 'death_cross' in result.columns

    def test_volume_indicators(self, builder, sample_ohlcv_data):
        """Test volume-based indicators."""
        result = builder.build_features(sample_ohlcv_data)

        # Check OBV
        assert 'obv' in result.columns
        assert 'obv_ma' in result.columns
        assert 'obv_signal' in result.columns

        # OBV should be cumulative
        obv_values = result['obv'].dropna()
        assert len(obv_values) > 0

    def test_trend_indicators(self, builder, sample_ohlcv_data):
        """Test trend indicators (ADX)."""
        result = builder.build_features(sample_ohlcv_data)

        # Check ADX columns
        assert 'adx' in result.columns
        assert 'plus_di' in result.columns
        assert 'minus_di' in result.columns
        assert 'adx_trending' in result.columns
        assert 'adx_strong_trend' in result.columns

        # ADX should be between 0 and 100
        adx_values = result['adx'].dropna()
        if len(adx_values) > 0:
            assert (adx_values >= 0).all()
            assert (adx_values <= 100).all()

    def test_price_action_features(self, builder, sample_ohlcv_data):
        """Test price action features."""
        result = builder.build_features(sample_ohlcv_data)

        # Check price action columns
        assert 'price_change' in result.columns
        assert 'price_range' in result.columns
        assert 'gap' in result.columns

        # Check candlestick patterns
        assert 'doji' in result.columns
        assert 'hammer' in result.columns
        assert 'shooting_star' in result.columns

        # Check volume features
        assert 'volume_ma' in result.columns
        assert 'volume_ratio' in result.columns
        assert 'volume_spike' in result.columns

    def test_feature_names_consistency(self, builder):
        """Test that get_feature_names returns consistent names."""
        feature_names = builder.get_feature_names()
        assert isinstance(feature_names, list)
        assert len(feature_names) > 0

        # All names should be strings
        assert all(isinstance(name, str) for name in feature_names)

        # No duplicate names
        assert len(feature_names) == len(set(feature_names))

    def test_deterministic_output(self, builder, sample_ohlcv_data):
        """Test that output is deterministic."""
        result1 = builder.build_features(sample_ohlcv_data.copy())
        result2 = builder.build_features(sample_ohlcv_data.copy())

        # Results should be identical
        pd.testing.assert_frame_equal(result1, result2)

    def test_custom_config(self, sample_ohlcv_data):
        """Test builder with custom configuration."""
        config = IndicatorConfig(
            rsi_period=21,
            macd_fast=8,
            macd_slow=21,
            bb_period=25
        )
        builder = TechnicalIndicatorBuilder(config)
        result = builder.build_features(sample_ohlcv_data)

        # Should still produce all expected features
        assert 'rsi' in result.columns
        assert 'macd_line' in result.columns
        assert 'bb_upper' in result.columns


class TestPriceFeatureBuilder:
    """Test price feature builder."""

    @pytest.fixture
    def sample_price_data(self):
        """Create sample price data with datetime index."""
        np.random.seed(42)
        n_days = 100
        dates = pd.date_range(start='2023-01-01', periods=n_days, freq='D')

        # Generate realistic price data
        returns = np.random.normal(0.001, 0.02, n_days)
        base_price = 100
        prices = base_price * np.exp(np.cumsum(returns))

        close_prices = prices
        open_prices = np.concatenate([[close_prices[0]], close_prices[:-1]])
        high_prices = np.maximum(open_prices, close_prices) * (1 + np.random.uniform(0, 0.02, n_days))
        low_prices = np.minimum(open_prices, close_prices) * (1 - np.random.uniform(0, 0.02, n_days))
        volumes = np.random.lognormal(15, 0.5, n_days)

        df = pd.DataFrame({
            'open': open_prices,
            'high': high_prices,
            'low': low_prices,
            'close': close_prices,
            'volume': volumes
        }, index=dates)

        return df

    @pytest.fixture
    def builder(self):
        """Create price feature builder."""
        return PriceFeatureBuilder()

    def test_builder_initialization(self):
        """Test builder initialization."""
        builder = PriceFeatureBuilder()
        assert builder.config is not None
        assert isinstance(builder.config, PriceFeatureConfig)

    def test_returns_calculation(self, builder, sample_price_data):
        """Test returns calculation."""
        result = builder.build_features(sample_price_data)

        # Check return columns for different periods
        for period in [1, 5, 10, 20]:
            assert f'return_{period}d' in result.columns
            assert f'log_return_{period}d' in result.columns

        # Check cumulative returns
        assert 'cumulative_return' in result.columns

        # Check forward returns
        assert 'forward_return_1d' in result.columns
        assert 'forward_return_5d' in result.columns

        # Validate return calculations
        returns_1d = result['return_1d'].dropna()
        expected_returns = sample_price_data['close'].pct_change().dropna()
        pd.testing.assert_series_equal(returns_1d, expected_returns, check_names=False)

    def test_momentum_features(self, builder, sample_price_data):
        """Test momentum features."""
        result = builder.build_features(sample_price_data)

        # Check ROC columns
        for period in [5, 10, 20]:
            assert f'roc_{period}' in result.columns

        # Check momentum
        assert 'momentum_10' in result.columns
        assert 'momentum_20' in result.columns

        # Check price position
        assert 'price_position_20' in result.columns
        assert 'price_position_60' in result.columns

        # Price position should be between 0 and 1 (mostly)
        position = result['price_position_20'].dropna()
        assert (position >= -0.1).all()  # Allow slight overshoot
        assert (position <= 1.1).all()

    def test_volatility_features(self, builder, sample_price_data):
        """Test volatility features."""
        result = builder.build_features(sample_price_data)

        # Check historical volatility
        for period in [5, 10, 20, 60]:
            assert f'volatility_{period}d' in result.columns

        # Check alternative volatility measures
        assert 'parkinson_volatility' in result.columns
        assert 'gk_volatility' in result.columns

        # Check volatility ratios
        assert 'volatility_ratio_5_20' in result.columns
        assert 'volatility_ratio_10_60' in result.columns

        # Volatility should be positive
        vol_5d = result['volatility_5d'].dropna()
        assert (vol_5d >= 0).all()

    def test_statistical_features(self, builder, sample_price_data):
        """Test statistical features."""
        result = builder.build_features(sample_price_data)

        # Check skewness and kurtosis
        assert 'returns_skew_20' in result.columns
        assert 'returns_kurtosis_20' in result.columns

        # Check z-scores
        assert 'zscore_20' in result.columns
        assert 'zscore_60' in result.columns

        # Check outlier detection
        assert 'is_outlier' in result.columns
        assert result['is_outlier'].dtype == int

        # Check autocorrelation
        assert 'return_autocorr_lag1' in result.columns

    def test_regime_features(self, builder, sample_price_data):
        """Test regime detection features."""
        result = builder.build_features(sample_price_data)

        # Check trend features
        assert 'trend_short' in result.columns
        assert 'trend_medium' in result.columns
        assert 'trend_long' in result.columns

        # Check market regime
        assert 'bull_market' in result.columns
        assert 'bear_market' in result.columns

        # Check volatility regime
        assert 'high_vol_regime' in result.columns
        assert 'low_vol_regime' in result.columns

        # Check market state
        assert 'market_state' in result.columns

        # Binary features should be 0 or 1
        assert result['bull_market'].isin([0, 1]).all()

    def test_seasonal_features(self, builder, sample_price_data):
        """Test seasonal features with datetime index."""
        result = builder.build_features(sample_price_data)

        # Check day of week features
        assert 'day_of_week' in result.columns
        assert 'is_monday' in result.columns
        assert 'is_friday' in result.columns

        # Check month features
        assert 'month' in result.columns
        assert 'is_january' in result.columns
        assert 'is_december' in result.columns

        # Check quarter features
        assert 'quarter' in result.columns
        assert 'is_q1' in result.columns
        assert 'is_q4' in result.columns

        # Validate day of week range
        assert result['day_of_week'].isin(range(7)).all()

        # Validate month range
        assert result['month'].isin(range(1, 13)).all()

    def test_seasonal_features_without_datetime_index(self, builder):
        """Test seasonal features with non-datetime index."""
        # Create data without datetime index
        df = pd.DataFrame({
            'open': [100, 101, 102],
            'high': [101, 102, 103],
            'low': [99, 100, 101],
            'close': [100, 101, 102],
            'volume': [1000, 1100, 1200]
        })

        result = builder.build_features(df)

        # Seasonal features should not be present or should handle gracefully
        # Implementation should not crash

    def test_edge_cases(self, builder):
        """Test edge cases."""
        # Single row
        single_row = pd.DataFrame({
            'open': [100],
            'high': [101],
            'low': [99],
            'close': [100],
            'volume': [1000]
        })

        result = builder.build_features(single_row)
        # Should not crash, but many features will be NaN
        assert len(result) == 1

        # Constant prices
        constant_prices = pd.DataFrame({
            'open': [100] * 50,
            'high': [100] * 50,
            'low': [100] * 50,
            'close': [100] * 50,
            'volume': [1000] * 50
        })

        result = builder.build_features(constant_prices)
        # Should handle constant prices without error
        assert 'volatility_5d' in result.columns


class TestSentimentFeatureBuilder:
    """Test sentiment feature builder."""

    @pytest.fixture
    def sample_ohlcv_data(self):
        """Create sample OHLCV data."""
        np.random.seed(42)
        n_days = 100
        dates = pd.date_range(start='2023-01-01', periods=n_days, freq='D')

        # Generate realistic price data
        returns = np.random.normal(0.001, 0.02, n_days)
        base_price = 100
        prices = base_price * np.exp(np.cumsum(returns))

        df = pd.DataFrame({
            'open': prices * 0.995,
            'high': prices * 1.02,
            'low': prices * 0.98,
            'close': prices,
            'volume': np.random.lognormal(15, 0.5, n_days)
        }, index=dates)

        return df

    @pytest.fixture
    def sample_sentiment_data(self):
        """Create sample sentiment data."""
        np.random.seed(42)
        n_days = 100
        dates = pd.date_range(start='2023-01-01', periods=n_days, freq='D')

        df = pd.DataFrame({
            'news_sentiment': np.random.normal(0, 0.3, n_days),
            'social_sentiment': np.random.normal(0, 0.4, n_days),
            'analyst_sentiment': np.random.normal(0, 0.2, n_days),
            'news_count': np.random.poisson(5, n_days),
            'social_mentions': np.random.poisson(50, n_days),
            'news_volume': np.random.exponential(1, n_days),
            'news_confidence': np.random.uniform(0.5, 1.0, n_days),
            'social_confidence': np.random.uniform(0.3, 0.9, n_days)
        }, index=dates)

        # Clip sentiment to valid ranges
        df['news_sentiment'] = np.clip(df['news_sentiment'], -1, 1)
        df['social_sentiment'] = np.clip(df['social_sentiment'], -1, 1)
        df['analyst_sentiment'] = np.clip(df['analyst_sentiment'], -1, 1)

        return df

    @pytest.fixture
    def builder(self):
        """Create sentiment feature builder."""
        return SentimentFeatureBuilder()

    def test_builder_initialization(self):
        """Test builder initialization."""
        builder = SentimentFeatureBuilder()
        assert builder.config is not None
        assert isinstance(builder.config, SentimentFeatureConfig)

    def test_sentiment_features_with_data(self, builder, sample_ohlcv_data, sample_sentiment_data):
        """Test sentiment features with provided sentiment data."""
        result = builder.build_features(sample_ohlcv_data, sample_sentiment_data)

        # Check base sentiment features
        assert 'news_sentiment' in result.columns
        assert 'social_sentiment' in result.columns
        assert 'analyst_sentiment' in result.columns

        # Check momentum features
        assert 'news_sentiment_change' in result.columns
        assert 'social_sentiment_change' in result.columns
        assert 'news_momentum_5' in result.columns

        # Check volatility features
        assert 'news_volatility_5' in result.columns
        assert 'sentiment_dispersion' in result.columns

        # Sentiment values should be in valid range
        assert (result['news_sentiment'] >= -1).all()
        assert (result['news_sentiment'] <= 1).all()

    def test_sentiment_features_without_data(self, builder, sample_ohlcv_data):
        """Test sentiment features without provided sentiment data (mock creation)."""
        result = builder.build_features(sample_ohlcv_data)

        # Should create mock sentiment features
        assert 'news_sentiment' in result.columns
        assert 'social_sentiment' in result.columns
        assert 'analyst_sentiment' in result.columns

        # Check that mock data is in valid ranges
        assert (result['news_sentiment'] >= -1).all()
        assert (result['news_sentiment'] <= 1).all()

    def test_sentiment_momentum_features(self, builder, sample_ohlcv_data, sample_sentiment_data):
        """Test sentiment momentum features."""
        result = builder.build_features(sample_ohlcv_data, sample_sentiment_data)

        # Check momentum features
        for period in [3, 5, 10]:
            assert f'news_momentum_{period}' in result.columns
            assert f'social_momentum_{period}' in result.columns

        # Check acceleration
        assert 'news_sentiment_acceleration' in result.columns
        assert 'social_sentiment_acceleration' in result.columns

        # Check trend strength
        assert 'news_trend_strength_5' in result.columns
        assert 'social_trend_strength_5' in result.columns

    def test_sentiment_volume_interactions(self, builder, sample_ohlcv_data, sample_sentiment_data):
        """Test sentiment-volume interaction features."""
        result = builder.build_features(sample_ohlcv_data, sample_sentiment_data)

        # Check volume interaction features
        assert 'high_vol_positive_news' in result.columns
        assert 'high_vol_negative_news' in result.columns
        assert 'sentiment_weighted_volume' in result.columns
        assert 'volume_surprise_positive_sentiment' in result.columns

        # These should be binary features
        assert result['high_vol_positive_news'].isin([0, 1]).all()
        assert result['high_vol_negative_news'].isin([0, 1]).all()

    def test_news_flow_features(self, builder, sample_ohlcv_data, sample_sentiment_data):
        """Test news flow features."""
        result = builder.build_features(sample_ohlcv_data, sample_sentiment_data)

        # Check news flow features
        assert 'news_density' in result.columns
        assert 'news_intensity' in result.columns
        assert 'news_coverage_change' in result.columns
        assert 'weighted_news_sentiment' in result.columns

        # Check rolling news features
        for period in [3, 7, 14]:
            assert f'avg_news_sentiment_{period}' in result.columns
            assert f'news_sentiment_range_{period}' in result.columns

        assert 'news_persistence' in result.columns

    def test_social_sentiment_features(self, builder, sample_ohlcv_data, sample_sentiment_data):
        """Test social media sentiment features."""
        result = builder.build_features(sample_ohlcv_data, sample_sentiment_data)

        # Check social features
        assert 'social_buzz' in result.columns
        assert 'social_reach' in result.columns
        assert 'social_bullish_momentum' in result.columns
        assert 'social_bearish_momentum' in result.columns

        # Check extremes
        assert 'social_extreme_positive' in result.columns
        assert 'social_extreme_negative' in result.columns

        # Check viral indicators
        assert 'viral_positive' in result.columns
        assert 'viral_negative' in result.columns

    def test_sentiment_regime_features(self, builder, sample_ohlcv_data, sample_sentiment_data):
        """Test sentiment regime features."""
        result = builder.build_features(sample_ohlcv_data, sample_sentiment_data)

        # Check combined sentiment
        assert 'combined_sentiment' in result.columns
        assert 'sentiment_consensus' in result.columns
        assert 'sentiment_divergence' in result.columns

        # Check regime features
        assert 'bullish_sentiment_regime' in result.columns
        assert 'bearish_sentiment_regime' in result.columns
        assert 'neutral_sentiment_regime' in result.columns

        # Check correlation features
        assert 'sentiment_price_corr_10' in result.columns
        assert 'sentiment_leads_price' in result.columns

        # Combined sentiment should be weighted average
        combined = result['combined_sentiment'].dropna()
        assert (combined >= -1).all()
        assert (combined <= 1).all()

    def test_feature_names_consistency(self, builder):
        """Test feature names consistency."""
        feature_names = builder.get_feature_names()
        assert isinstance(feature_names, list)
        assert len(feature_names) > 0

        # No duplicates
        assert len(feature_names) == len(set(feature_names))


class TestMarketFeatureBuilder:
    """Test market feature builder."""

    @pytest.fixture
    def sample_stock_data(self):
        """Create sample stock data."""
        np.random.seed(42)
        n_days = 100
        dates = pd.date_range(start='2023-01-01', periods=n_days, freq='D')

        returns = np.random.normal(0.001, 0.02, n_days)
        base_price = 100
        prices = base_price * np.exp(np.cumsum(returns))

        df = pd.DataFrame({
            'open': prices * 0.995,
            'high': prices * 1.02,
            'low': prices * 0.98,
            'close': prices,
            'volume': np.random.lognormal(15, 0.5, n_days)
        }, index=dates)

        return df

    @pytest.fixture
    def sample_market_data(self):
        """Create sample market data."""
        np.random.seed(42)
        n_days = 100
        dates = pd.date_range(start='2023-01-01', periods=n_days, freq='D')

        market_data = {}

        # SPY data
        spy_returns = np.random.normal(0.0005, 0.015, n_days)
        spy_prices = 400 * np.exp(np.cumsum(spy_returns))
        market_data['SPY'] = pd.DataFrame({
            'close': spy_prices,
            'volume': np.random.lognormal(16, 0.3, n_days)
        }, index=dates)

        # QQQ data
        qqq_returns = np.random.normal(0.0007, 0.018, n_days)
        qqq_prices = 350 * np.exp(np.cumsum(qqq_returns))
        market_data['QQQ'] = pd.DataFrame({
            'close': qqq_prices,
            'volume': np.random.lognormal(15.5, 0.4, n_days)
        }, index=dates)

        # VIX data (mean-reverting)
        vix_values = 20 + np.cumsum(np.random.normal(0, 0.5, n_days))
        vix_values = np.clip(vix_values, 10, 80)
        market_data['VIX'] = pd.DataFrame({
            'close': vix_values
        }, index=dates)

        return market_data

    @pytest.fixture
    def builder(self):
        """Create market feature builder."""
        return MarketFeatureBuilder()

    def test_builder_initialization(self):
        """Test builder initialization."""
        builder = MarketFeatureBuilder()
        assert builder.config is not None
        assert isinstance(builder.config, MarketFeatureConfig)

    def test_market_index_features(self, builder, sample_stock_data, sample_market_data):
        """Test market index features."""
        result = builder.build_features(sample_stock_data, sample_market_data)

        # Check index return features
        for symbol in ['spy', 'qqq', 'vix']:
            assert f'{symbol}_return' in result.columns
            assert f'{symbol}_price' in result.columns
            assert f'relative_to_{symbol}' in result.columns
            assert f'outperformance_{symbol}' in result.columns

        # Check relative performance
        assert 'relative_performance_spy_5d' in result.columns
        assert 'relative_performance_spy_20d' in result.columns

        # Check market direction
        assert 'market_up' in result.columns
        assert 'market_down' in result.columns
        assert 'market_strong_up' in result.columns
        assert 'market_strong_down' in result.columns

    def test_sector_features(self, builder, sample_stock_data, sample_market_data):
        """Test sector performance features."""
        result = builder.build_features(sample_stock_data, sample_market_data)

        # Check sector features (using default config sectors)
        for sector in ['technology', 'healthcare', 'financials']:
            if f'{sector}_return' in result.columns:
                assert f'relative_to_{sector}' in result.columns
                assert f'outperform_{sector}' in result.columns
                assert f'{sector}_strength' in result.columns

    def test_market_breadth_features(self, builder, sample_stock_data, sample_market_data):
        """Test market breadth features."""
        result = builder.build_features(sample_stock_data, sample_market_data)

        # Check breadth features
        assert 'advance_decline_ratio' in result.columns
        assert 'advance_decline_line' in result.columns
        assert 'breadth_momentum' in result.columns
        assert 'market_participation' in result.columns

        # Check participation features
        assert 'strong_participation' in result.columns
        assert 'weak_participation' in result.columns
        assert 'accumulation_day' in result.columns
        assert 'distribution_day' in result.columns

        # Participation should be between 0 and 1
        participation = result['market_participation'].dropna()
        assert (participation >= 0).all()
        assert (participation <= 1).all()

    def test_volatility_features(self, builder, sample_stock_data, sample_market_data):
        """Test volatility features."""
        result = builder.build_features(sample_stock_data, sample_market_data)

        # Check VIX features
        assert 'vix_level' in result.columns
        assert 'vix_change' in result.columns

        # Check VIX regimes
        assert 'low_vol_regime' in result.columns
        assert 'normal_vol_regime' in result.columns
        assert 'high_vol_regime' in result.columns
        assert 'extreme_vol_regime' in result.columns

        # Check market volatility
        assert 'market_volatility_5d' in result.columns
        assert 'market_volatility_20d' in result.columns
        assert 'relative_volatility_5d' in result.columns

    def test_correlation_features(self, builder, sample_stock_data, sample_market_data):
        """Test correlation and beta features."""
        result = builder.build_features(sample_stock_data, sample_market_data)

        # Check beta features
        for symbol in ['spy', 'qqq']:
            for period in [60, 252]:
                beta_col = f'beta_{symbol}_{period}d'
                if beta_col in result.columns:
                    assert f'high_beta_{symbol}_{period}d' in result.columns
                    assert f'low_beta_{symbol}_{period}d' in result.columns

        # Check correlation features
        for period in [20, 60, 252]:
            corr_col = f'market_correlation_{period}d'
            if corr_col in result.columns:
                assert f'high_correlation_{period}d' in result.columns
                assert f'low_correlation_{period}d' in result.columns

    def test_market_regime_features(self, builder, sample_stock_data, sample_market_data):
        """Test market regime features."""
        result = builder.build_features(sample_stock_data, sample_market_data)

        # Check regime features
        assert 'bull_market' in result.columns
        assert 'bear_market' in result.columns
        assert 'correction' in result.columns

        # Check risk features
        assert 'risk_on' in result.columns
        assert 'risk_off' in result.columns
        assert 'risk_appetite' in result.columns

        # Check stress features
        assert 'market_stress' in result.columns

        # Regime features should be binary
        assert result['bull_market'].isin([0, 1]).all()
        assert result['bear_market'].isin([0, 1]).all()

    def test_features_without_market_data(self, builder, sample_stock_data):
        """Test features when no market data is provided."""
        result = builder.build_features(sample_stock_data)

        # Should create mock market data and still produce features
        assert len(result.columns) > len(sample_stock_data.columns)

        # Should have some market features
        assert 'spy_return' in result.columns
        assert 'market_up' in result.columns

    def test_feature_names_consistency(self, builder):
        """Test feature names consistency."""
        feature_names = builder.get_feature_names()
        assert isinstance(feature_names, list)
        assert len(feature_names) > 0

        # No duplicates
        assert len(feature_names) == len(set(feature_names))

    def test_mock_data_creation(self, builder):
        """Test mock market data creation."""
        mock_data = builder._create_mock_market_data(100, pd.date_range('2023-01-01', periods=100))

        # Should create data for all configured symbols
        assert 'SPY' in mock_data
        assert 'VIX' in mock_data

        # VIX should have different characteristics
        vix_data = mock_data['VIX']
        spy_data = mock_data['SPY']

        # VIX should be bounded
        assert (vix_data['close'] >= 10).all()
        assert (vix_data['close'] <= 80).all()

        # SPY should be more like a normal stock
        assert (spy_data['close'] > 0).all()


if __name__ == "__main__":
    pytest.main([__file__])