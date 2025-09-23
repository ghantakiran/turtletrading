"""
Data loader pipeline component.

Handles loading and preprocessing of various data sources.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union, Any
from pathlib import Path
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)


@dataclass
class DataSourceConfig:
    """Configuration for data source."""
    source_type: str  # "csv", "database", "api", "cache"
    path_or_connection: str
    symbol: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    columns_mapping: Optional[Dict[str, str]] = None
    cache_enabled: bool = True
    cache_ttl_hours: int = 24


class DataLoader:
    """
    Loads data from various sources for research pipelines.

    Supports:
    - CSV files
    - Database connections
    - API endpoints
    - Cached data
    - Data preprocessing and standardization
    """

    def __init__(self, cache_dir: Optional[Path] = None):
        """
        Initialize data loader.

        Args:
            cache_dir: Directory for caching data
        """
        self.cache_dir = cache_dir or Path("/tmp/turtle_trading_cache")
        self.cache_dir.mkdir(exist_ok=True)

    def load_stock_data(self, config: DataSourceConfig) -> pd.DataFrame:
        """
        Load stock data from configured source.

        Args:
            config: Data source configuration

        Returns:
            DataFrame with standardized OHLCV columns
        """
        if config.source_type == "csv":
            return self._load_from_csv(config)
        elif config.source_type == "database":
            return self._load_from_database(config)
        elif config.source_type == "api":
            return self._load_from_api(config)
        elif config.source_type == "cache":
            return self._load_from_cache(config)
        else:
            raise ValueError(f"Unsupported source type: {config.source_type}")

    def load_sentiment_data(self, config: DataSourceConfig) -> pd.DataFrame:
        """
        Load sentiment data from configured source.

        Args:
            config: Data source configuration

        Returns:
            DataFrame with sentiment columns
        """
        # For now, create mock sentiment data
        # In production, this would load from actual sentiment data sources
        return self._create_mock_sentiment_data(config)

    def load_market_data(self, symbols: List[str], config: DataSourceConfig) -> Dict[str, pd.DataFrame]:
        """
        Load market data for multiple symbols.

        Args:
            symbols: List of market symbols (SPY, QQQ, etc.)
            config: Data source configuration

        Returns:
            Dictionary mapping symbols to DataFrames
        """
        market_data = {}
        for symbol in symbols:
            symbol_config = DataSourceConfig(
                source_type=config.source_type,
                path_or_connection=config.path_or_connection,
                symbol=symbol,
                start_date=config.start_date,
                end_date=config.end_date,
                cache_enabled=config.cache_enabled,
                cache_ttl_hours=config.cache_ttl_hours
            )
            try:
                market_data[symbol] = self.load_stock_data(symbol_config)
            except Exception as e:
                logger.warning(f"Failed to load data for {symbol}: {e}")
                # Create mock data as fallback
                market_data[symbol] = self._create_mock_stock_data(symbol, config)

        return market_data

    def _load_from_csv(self, config: DataSourceConfig) -> pd.DataFrame:
        """Load data from CSV file."""
        try:
            df = pd.read_csv(config.path_or_connection)

            # Apply column mapping if provided
            if config.columns_mapping:
                df = df.rename(columns=config.columns_mapping)

            # Standardize columns
            df = self._standardize_dataframe(df, config)

            # Filter by date range if specified
            if config.start_date or config.end_date:
                df = self._filter_by_date_range(df, config.start_date, config.end_date)

            return df

        except Exception as e:
            logger.error(f"Failed to load CSV from {config.path_or_connection}: {e}")
            raise

    def _load_from_database(self, config: DataSourceConfig) -> pd.DataFrame:
        """Load data from database."""
        # Mock implementation - in production would use actual database connection
        logger.info(f"Loading from database: {config.path_or_connection}")

        # Create mock data for testing
        return self._create_mock_stock_data(config.symbol or "AAPL", config)

    def _load_from_api(self, config: DataSourceConfig) -> pd.DataFrame:
        """Load data from API endpoint."""
        # Mock implementation - in production would use actual API calls
        logger.info(f"Loading from API: {config.path_or_connection}")

        # Check cache first
        if config.cache_enabled:
            cached_data = self._load_from_cache_file(config)
            if cached_data is not None:
                return cached_data

        # Create mock data for testing
        data = self._create_mock_stock_data(config.symbol or "AAPL", config)

        # Cache the data
        if config.cache_enabled:
            self._save_to_cache(data, config)

        return data

    def _load_from_cache(self, config: DataSourceConfig) -> pd.DataFrame:
        """Load data from cache."""
        cached_data = self._load_from_cache_file(config)
        if cached_data is None:
            raise ValueError(f"No cached data found for {config.symbol}")
        return cached_data

    def _load_from_cache_file(self, config: DataSourceConfig) -> Optional[pd.DataFrame]:
        """Load data from cache file."""
        cache_file = self._get_cache_filename(config)

        if not cache_file.exists():
            return None

        # Check if cache is still valid
        cache_age = datetime.now() - datetime.fromtimestamp(cache_file.stat().st_mtime)
        if cache_age > timedelta(hours=config.cache_ttl_hours):
            logger.info(f"Cache expired for {config.symbol}")
            return None

        try:
            df = pd.read_parquet(cache_file)
            logger.info(f"Loaded cached data for {config.symbol}")
            return df
        except Exception as e:
            logger.warning(f"Failed to load cache file: {e}")
            return None

    def _save_to_cache(self, df: pd.DataFrame, config: DataSourceConfig) -> None:
        """Save data to cache."""
        try:
            cache_file = self._get_cache_filename(config)
            df.to_parquet(cache_file)
            logger.info(f"Cached data for {config.symbol}")
        except Exception as e:
            logger.warning(f"Failed to cache data: {e}")

    def _get_cache_filename(self, config: DataSourceConfig) -> Path:
        """Get cache filename for configuration."""
        symbol = config.symbol or "unknown"
        start_str = config.start_date.strftime("%Y%m%d") if config.start_date else "all"
        end_str = config.end_date.strftime("%Y%m%d") if config.end_date else "all"

        filename = f"{symbol}_{start_str}_{end_str}.parquet"
        return self.cache_dir / filename

    def _create_mock_stock_data(self, symbol: str, config: DataSourceConfig) -> pd.DataFrame:
        """Create mock stock data for testing."""
        np.random.seed(hash(symbol) % 2**32)  # Deterministic but different per symbol

        # Determine date range
        end_date = config.end_date or datetime.now()
        start_date = config.start_date or (end_date - timedelta(days=365))

        # Generate date range
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        date_range = date_range[date_range.weekday < 5]  # Remove weekends

        n_days = len(date_range)
        if n_days == 0:
            raise ValueError("No trading days in specified date range")

        # Generate price data with random walk
        base_price = np.random.uniform(20, 200)
        returns = np.random.normal(0.0005, 0.02, n_days)  # ~0.05% daily return with 2% volatility

        # Special behavior for certain symbols
        if symbol == 'VIX':
            base_price = 20
            returns = np.random.normal(0, 0.05, n_days)  # Mean-reverting
            prices = base_price + np.cumsum(returns)
            prices = np.clip(prices, 10, 80)
        else:
            prices = base_price * np.exp(np.cumsum(returns))

        # Generate OHLC data
        close_prices = prices

        # Open prices (previous close + gap)
        gaps = np.random.normal(0, 0.005, n_days)
        open_prices = np.concatenate([[close_prices[0]], close_prices[:-1]]) * (1 + gaps)

        # High and low prices
        intraday_ranges = np.random.uniform(0.005, 0.03, n_days)
        high_prices = np.maximum(open_prices, close_prices) * (1 + intraday_ranges / 2)
        low_prices = np.minimum(open_prices, close_prices) * (1 - intraday_ranges / 2)

        # Volume (log-normal distribution)
        base_volume = np.random.uniform(1e6, 1e8)
        volumes = np.random.lognormal(np.log(base_volume), 0.5, n_days)

        df = pd.DataFrame({
            'date': date_range,
            'open': open_prices,
            'high': high_prices,
            'low': low_prices,
            'close': close_prices,
            'volume': volumes.astype(int),
            'symbol': symbol
        })

        df.set_index('date', inplace=True)
        return df

    def _create_mock_sentiment_data(self, config: DataSourceConfig) -> pd.DataFrame:
        """Create mock sentiment data for testing."""
        # Load corresponding stock data to get date range
        stock_data = self._create_mock_stock_data(config.symbol or "AAPL", config)

        np.random.seed(42)  # For reproducibility
        n_days = len(stock_data)

        df = pd.DataFrame({
            'news_sentiment': np.random.normal(0, 0.3, n_days),
            'social_sentiment': np.random.normal(0, 0.4, n_days),
            'analyst_sentiment': np.random.normal(0, 0.2, n_days),
            'news_count': np.random.poisson(5, n_days),
            'social_mentions': np.random.poisson(50, n_days),
            'news_volume': np.random.exponential(1, n_days),
            'news_confidence': np.random.uniform(0.5, 1.0, n_days),
            'social_confidence': np.random.uniform(0.3, 0.9, n_days)
        }, index=stock_data.index)

        # Add some correlation with price movements
        returns = stock_data['close'].pct_change()
        df['news_sentiment'] += 0.3 * returns.shift(1).fillna(0)
        df['social_sentiment'] += 0.2 * returns.fillna(0)

        # Clip to valid ranges
        df['news_sentiment'] = np.clip(df['news_sentiment'], -1, 1)
        df['social_sentiment'] = np.clip(df['social_sentiment'], -1, 1)
        df['analyst_sentiment'] = np.clip(df['analyst_sentiment'], -1, 1)

        return df

    def _standardize_dataframe(self, df: pd.DataFrame, config: DataSourceConfig) -> pd.DataFrame:
        """Standardize DataFrame columns and format."""
        result_df = df.copy()

        # Ensure required columns exist
        required_columns = ['open', 'high', 'low', 'close', 'volume']
        missing_columns = [col for col in required_columns if col not in result_df.columns]

        if missing_columns:
            logger.warning(f"Missing required columns: {missing_columns}")
            # Try to infer missing columns
            if 'close' in result_df.columns and 'open' not in result_df.columns:
                result_df['open'] = result_df['close'].shift(1)
            if 'close' in result_df.columns and 'high' not in result_df.columns:
                result_df['high'] = result_df['close'] * 1.02
            if 'close' in result_df.columns and 'low' not in result_df.columns:
                result_df['low'] = result_df['close'] * 0.98
            if 'volume' not in result_df.columns:
                result_df['volume'] = 1000000  # Default volume

        # Ensure numeric types
        numeric_columns = ['open', 'high', 'low', 'close', 'volume']
        for col in numeric_columns:
            if col in result_df.columns:
                result_df[col] = pd.to_numeric(result_df[col], errors='coerce')

        # Handle date index
        if 'date' in result_df.columns and result_df.index.name != 'date':
            result_df['date'] = pd.to_datetime(result_df['date'])
            result_df.set_index('date', inplace=True)
        elif not pd.api.types.is_datetime64_any_dtype(result_df.index):
            # Try to convert index to datetime
            try:
                result_df.index = pd.to_datetime(result_df.index)
            except:
                logger.warning("Could not convert index to datetime")

        return result_df

    def _filter_by_date_range(self, df: pd.DataFrame, start_date: Optional[datetime], end_date: Optional[datetime]) -> pd.DataFrame:
        """Filter DataFrame by date range."""
        if not pd.api.types.is_datetime64_any_dtype(df.index):
            logger.warning("Cannot filter by date range: index is not datetime")
            return df

        if start_date:
            df = df[df.index >= start_date]
        if end_date:
            df = df[df.index <= end_date]

        return df

    def get_available_symbols(self, source_path: str) -> List[str]:
        """Get list of available symbols from data source."""
        # Mock implementation
        return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'SPY', 'QQQ', 'IWM', 'VIX']

    def validate_data_source(self, config: DataSourceConfig) -> bool:
        """Validate that data source is accessible."""
        try:
            if config.source_type == "csv":
                return Path(config.path_or_connection).exists()
            elif config.source_type == "database":
                # Would test database connection in production
                return True
            elif config.source_type == "api":
                # Would test API endpoint in production
                return True
            elif config.source_type == "cache":
                cache_file = self._get_cache_filename(config)
                return cache_file.exists()
            else:
                return False
        except Exception:
            return False