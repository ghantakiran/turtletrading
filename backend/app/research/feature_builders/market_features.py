"""
Market feature builder for stock analysis.

Provides feature engineering for market-wide features
including sector performance, market indices, and macro indicators.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class MarketFeatureConfig:
    """Configuration for market features."""
    index_symbols: List[str] = None
    sector_symbols: Dict[str, List[str]] = None
    correlation_periods: List[int] = None
    beta_periods: List[int] = None

    def __post_init__(self):
        if self.index_symbols is None:
            self.index_symbols = ['SPY', 'QQQ', 'IWM', 'VIX']
        if self.correlation_periods is None:
            self.correlation_periods = [20, 60, 252]
        if self.beta_periods is None:
            self.beta_periods = [60, 252]
        if self.sector_symbols is None:
            self.sector_symbols = {
                'technology': ['XLK', 'TECH'],
                'healthcare': ['XLV', 'HEALTH'],
                'financials': ['XLF', 'FINANCE'],
                'energy': ['XLE', 'ENERGY'],
                'utilities': ['XLU', 'UTILITIES']
            }


class MarketFeatureBuilder:
    """
    Builds market-wide features from market data.

    Features computed:
    - Market index relationships
    - Sector performance
    - Market breadth indicators
    - Volatility indicators
    - Cross-market correlations
    - Market regime indicators
    """

    def __init__(self, config: Optional[MarketFeatureConfig] = None):
        self.config = config or MarketFeatureConfig()

    def build_features(self, df: pd.DataFrame, market_data: Optional[Dict[str, pd.DataFrame]] = None) -> pd.DataFrame:
        """
        Build all market-based features.

        Args:
            df: DataFrame with OHLCV columns for the stock
            market_data: Dictionary of market/sector data indexed by symbol

        Returns:
            DataFrame with market features
        """
        result = df.copy()

        if market_data is None:
            # Create mock market data for testing
            market_data = self._create_mock_market_data(len(df), df.index)

        # Add market index features
        result = self._add_market_index_features(result, market_data)

        # Add sector features
        result = self._add_sector_features(result, market_data)

        # Add market breadth features
        result = self._add_market_breadth_features(result, market_data)

        # Add volatility features
        result = self._add_volatility_features(result, market_data)

        # Add correlation and beta features
        result = self._add_correlation_features(result, market_data)

        # Add market regime features
        result = self._add_market_regime_features(result, market_data)

        return result

    def _create_mock_market_data(self, n: int, index: pd.Index) -> Dict[str, pd.DataFrame]:
        """Create mock market data for testing."""
        np.random.seed(42)
        market_data = {}

        # Create mock data for major indices
        for symbol in self.config.index_symbols:
            returns = np.random.normal(0.0005, 0.02, n)  # Daily returns
            if symbol == 'VIX':
                # VIX should be positive and mean-reverting
                prices = 20 + np.cumsum(np.random.normal(0, 0.5, n))
                prices = np.clip(prices, 10, 80)
            else:
                prices = 100 * np.exp(np.cumsum(returns))

            market_data[symbol] = pd.DataFrame({
                'close': prices,
                'volume': np.random.lognormal(15, 0.5, n),
                'high': prices * (1 + np.random.uniform(0, 0.02, n)),
                'low': prices * (1 - np.random.uniform(0, 0.02, n)),
                'open': prices * (1 + np.random.normal(0, 0.01, n))
            }, index=index)

        # Create sector data
        for sector, symbols in self.config.sector_symbols.items():
            for symbol in symbols:
                returns = np.random.normal(0.0003, 0.015, n)
                prices = 50 * np.exp(np.cumsum(returns))
                market_data[symbol] = pd.DataFrame({
                    'close': prices,
                    'volume': np.random.lognormal(14, 0.3, n)
                }, index=index)

        return market_data

    def _add_market_index_features(self, df: pd.DataFrame, market_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Add market index related features."""
        stock_returns = df['close'].pct_change()

        # Index returns and relationships
        for symbol in self.config.index_symbols:
            if symbol in market_data:
                index_data = market_data[symbol]
                index_returns = index_data['close'].pct_change()

                # Basic index features
                df[f'{symbol.lower()}_return'] = index_returns
                df[f'{symbol.lower()}_price'] = index_data['close']

                # Relative performance
                df[f'relative_to_{symbol.lower()}'] = stock_returns - index_returns
                df[f'outperformance_{symbol.lower()}'] = (stock_returns > index_returns).astype(int)

                # Rolling relative performance
                for period in [5, 20]:
                    stock_cum = (1 + stock_returns).rolling(window=period).apply(np.prod) - 1
                    index_cum = (1 + index_returns).rolling(window=period).apply(np.prod) - 1
                    df[f'relative_performance_{symbol.lower()}_{period}d'] = stock_cum - index_cum

        # Market direction features
        if 'SPY' in market_data:
            spy_returns = market_data['SPY']['close'].pct_change()
            df['market_up'] = (spy_returns > 0).astype(int)
            df['market_strong_up'] = (spy_returns > 0.01).astype(int)
            df['market_down'] = (spy_returns < 0).astype(int)
            df['market_strong_down'] = (spy_returns < -0.01).astype(int)

        return df

    def _add_sector_features(self, df: pd.DataFrame, market_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Add sector performance features."""
        stock_returns = df['close'].pct_change()

        for sector, symbols in self.config.sector_symbols.items():
            sector_returns = []
            for symbol in symbols:
                if symbol in market_data:
                    sector_returns.append(market_data[symbol]['close'].pct_change())

            if sector_returns:
                # Average sector performance
                avg_sector_return = pd.concat(sector_returns, axis=1).mean(axis=1)
                df[f'{sector}_return'] = avg_sector_return
                df[f'relative_to_{sector}'] = stock_returns - avg_sector_return
                df[f'outperform_{sector}'] = (stock_returns > avg_sector_return).astype(int)

                # Sector strength
                positive_stocks = pd.concat(sector_returns, axis=1).apply(
                    lambda row: (row > 0).sum() / len(row), axis=1
                )
                df[f'{sector}_strength'] = positive_stocks
                df[f'{sector}_strong'] = (positive_stocks > 0.6).astype(int)
                df[f'{sector}_weak'] = (positive_stocks < 0.4).astype(int)

        return df

    def _add_market_breadth_features(self, df: pd.DataFrame, market_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Add market breadth indicators."""
        # Create a simplified market breadth using available data
        all_returns = []
        for symbol, data in market_data.items():
            if 'close' in data.columns:
                all_returns.append(data['close'].pct_change())

        if all_returns:
            returns_df = pd.concat(all_returns, axis=1)

            # Advance-decline ratio
            advancing = (returns_df > 0).sum(axis=1)
            declining = (returns_df < 0).sum(axis=1)
            total_stocks = advancing + declining
            total_stocks = total_stocks.replace(0, 1)  # Avoid division by zero

            df['advance_decline_ratio'] = advancing / declining.replace(0, 1)
            df['advance_decline_line'] = (advancing - declining).cumsum()
            df['breadth_momentum'] = (advancing / total_stocks).rolling(window=5).mean()

            # Market participation
            df['market_participation'] = advancing / total_stocks
            df['strong_participation'] = (df['market_participation'] > 0.7).astype(int)
            df['weak_participation'] = (df['market_participation'] < 0.3).astype(int)

            # Up/down volume (simplified)
            df['up_volume_ratio'] = df['market_participation']  # Simplified proxy
            df['accumulation_day'] = (
                (df['market_participation'] > 0.6) &
                (df['close'] > df['close'].shift(1))
            ).astype(int)
            df['distribution_day'] = (
                (df['market_participation'] < 0.4) &
                (df['close'] < df['close'].shift(1))
            ).astype(int)

        return df

    def _add_volatility_features(self, df: pd.DataFrame, market_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Add market volatility features."""
        # VIX-based features
        if 'VIX' in market_data:
            vix_data = market_data['VIX']['close']
            df['vix_level'] = vix_data
            df['vix_change'] = vix_data.pct_change()

            # VIX regimes
            df['low_vol_regime'] = (vix_data < 20).astype(int)
            df['normal_vol_regime'] = ((vix_data >= 20) & (vix_data <= 30)).astype(int)
            df['high_vol_regime'] = (vix_data > 30).astype(int)
            df['extreme_vol_regime'] = (vix_data > 40).astype(int)

            # VIX mean reversion
            vix_ma = vix_data.rolling(window=20).mean()
            df['vix_mean_reversion'] = (vix_data - vix_ma) / vix_ma

        # Market volatility from index data
        if 'SPY' in market_data:
            spy_returns = market_data['SPY']['close'].pct_change()
            for period in [5, 20]:
                market_vol = spy_returns.rolling(window=period).std() * np.sqrt(252)
                df[f'market_volatility_{period}d'] = market_vol

                # Stock vs market volatility
                stock_vol = df['close'].pct_change().rolling(window=period).std() * np.sqrt(252)
                df[f'relative_volatility_{period}d'] = stock_vol / market_vol

        return df

    def _add_correlation_features(self, df: pd.DataFrame, market_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Add correlation and beta features."""
        stock_returns = df['close'].pct_change()

        # Beta calculation with different indices
        for symbol in ['SPY', 'QQQ']:
            if symbol in market_data:
                market_returns = market_data[symbol]['close'].pct_change()

                for period in self.config.beta_periods:
                    # Rolling beta
                    cov = stock_returns.rolling(window=period).cov(market_returns)
                    var = market_returns.rolling(window=period).var()
                    beta = cov / var
                    df[f'beta_{symbol.lower()}_{period}d'] = beta

                    # Beta regimes
                    df[f'high_beta_{symbol.lower()}_{period}d'] = (beta > 1.2).astype(int)
                    df[f'low_beta_{symbol.lower()}_{period}d'] = (beta < 0.8).astype(int)

        # Correlation with market
        if 'SPY' in market_data:
            market_returns = market_data['SPY']['close'].pct_change()
            for period in self.config.correlation_periods:
                correlation = stock_returns.rolling(window=period).corr(market_returns)
                df[f'market_correlation_{period}d'] = correlation

                # Correlation regimes
                df[f'high_correlation_{period}d'] = (correlation > 0.7).astype(int)
                df[f'low_correlation_{period}d'] = (correlation < 0.3).astype(int)
                df[f'negative_correlation_{period}d'] = (correlation < 0).astype(int)

        return df

    def _add_market_regime_features(self, df: pd.DataFrame, market_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Add market regime detection features."""
        # Bull/bear market indicators
        if 'SPY' in market_data:
            spy_close = market_data['SPY']['close']
            spy_ma_200 = spy_close.rolling(window=200).mean()

            df['bull_market'] = (spy_close > spy_ma_200).astype(int)
            df['bear_market'] = (spy_close < spy_ma_200 * 0.8).astype(int)  # 20% below
            df['correction'] = (
                (spy_close < spy_ma_200) & (spy_close >= spy_ma_200 * 0.8)
            ).astype(int)

        # Risk-on vs risk-off
        if 'QQQ' in market_data and 'IWM' in market_data:
            qqq_returns = market_data['QQQ']['close'].pct_change()
            iwm_returns = market_data['IWM']['close'].pct_change()

            # Small cap outperformance (risk-on)
            df['risk_on'] = (iwm_returns > qqq_returns).astype(int)
            df['risk_off'] = (iwm_returns < qqq_returns).astype(int)

            # Risk appetite indicator
            risk_ratio = iwm_returns.rolling(window=20).mean() / qqq_returns.rolling(window=20).mean()
            df['risk_appetite'] = risk_ratio
            df['high_risk_appetite'] = (risk_ratio > 1.05).astype(int)
            df['low_risk_appetite'] = (risk_ratio < 0.95).astype(int)

        # Market stress indicators
        if 'VIX' in market_data and 'SPY' in market_data:
            vix = market_data['VIX']['close']
            spy_returns = market_data['SPY']['close'].pct_change()

            # VIX-returns relationship
            df['vix_spy_divergence'] = vix.pct_change() + spy_returns  # Should be negative normally
            df['market_stress'] = (
                (vix > 25) | (spy_returns < -0.02)
            ).astype(int)

        return df

    def get_feature_names(self) -> List[str]:
        """Get list of all feature names that will be generated."""
        features = []

        # Market index features
        for symbol in self.config.index_symbols:
            symbol_lower = symbol.lower()
            features.extend([
                f'{symbol_lower}_return', f'{symbol_lower}_price',
                f'relative_to_{symbol_lower}', f'outperformance_{symbol_lower}'
            ])
            features.extend([
                f'relative_performance_{symbol_lower}_5d',
                f'relative_performance_{symbol_lower}_20d'
            ])

        # Market direction features
        features.extend([
            'market_up', 'market_strong_up', 'market_down', 'market_strong_down'
        ])

        # Sector features
        for sector in self.config.sector_symbols.keys():
            features.extend([
                f'{sector}_return', f'relative_to_{sector}', f'outperform_{sector}',
                f'{sector}_strength', f'{sector}_strong', f'{sector}_weak'
            ])

        # Market breadth features
        features.extend([
            'advance_decline_ratio', 'advance_decline_line', 'breadth_momentum',
            'market_participation', 'strong_participation', 'weak_participation',
            'up_volume_ratio', 'accumulation_day', 'distribution_day'
        ])

        # Volatility features
        features.extend([
            'vix_level', 'vix_change', 'low_vol_regime', 'normal_vol_regime',
            'high_vol_regime', 'extreme_vol_regime', 'vix_mean_reversion',
            'market_volatility_5d', 'market_volatility_20d',
            'relative_volatility_5d', 'relative_volatility_20d'
        ])

        # Beta features
        for symbol in ['spy', 'qqq']:
            for period in self.config.beta_periods:
                features.extend([
                    f'beta_{symbol}_{period}d', f'high_beta_{symbol}_{period}d',
                    f'low_beta_{symbol}_{period}d'
                ])

        # Correlation features
        for period in self.config.correlation_periods:
            features.extend([
                f'market_correlation_{period}d', f'high_correlation_{period}d',
                f'low_correlation_{period}d', f'negative_correlation_{period}d'
            ])

        # Market regime features
        features.extend([
            'bull_market', 'bear_market', 'correction', 'risk_on', 'risk_off',
            'risk_appetite', 'high_risk_appetite', 'low_risk_appetite',
            'vix_spy_divergence', 'market_stress'
        ])

        return features