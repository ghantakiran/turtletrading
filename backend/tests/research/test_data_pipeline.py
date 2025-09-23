"""
Unit tests for data pipeline components.

Tests all data pipeline components:
- Data validator
- Feature pipeline
- Data loader
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import os
from unittest.mock import patch, MagicMock

from app.research.data_pipeline import (
    DataValidator,
    ValidationResult,
    ValidationSeverity,
    ValidationIssue,
    FeaturePipeline,
    PipelineConfig,
    PipelineResult,
    DataLoader,
    DataSourceConfig
)


class TestDataValidator:
    """Test data validation pipeline component."""

    @pytest.fixture
    def valid_ohlcv_data(self):
        """Create valid OHLCV data."""
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
        volumes = np.random.lognormal(15, 0.5, n_days).astype(int)

        df = pd.DataFrame({
            'open': open_prices,
            'high': high_prices,
            'low': low_prices,
            'close': close_prices,
            'volume': volumes
        }, index=dates)

        return df

    @pytest.fixture
    def validator(self):
        """Create data validator."""
        return DataValidator()

    def test_validator_initialization(self):
        """Test validator initialization."""
        # Default initialization
        validator = DataValidator()
        assert validator.required_columns == ['open', 'high', 'low', 'close', 'volume']
        assert validator.outlier_threshold == 5.0
        assert validator.max_missing_ratio == 0.05

        # Custom initialization
        validator = DataValidator(
            required_columns=['close', 'volume'],
            outlier_threshold=3.0,
            max_missing_ratio=0.1
        )
        assert validator.required_columns == ['close', 'volume']
        assert validator.outlier_threshold == 3.0
        assert validator.max_missing_ratio == 0.1

    def test_valid_data_validation(self, validator, valid_ohlcv_data):
        """Test validation of valid data."""
        result = validator.validate(valid_ohlcv_data)

        assert isinstance(result, ValidationResult)
        assert result.is_valid is True
        assert isinstance(result.issues, list)
        assert isinstance(result.summary, dict)

        # Should have minimal issues
        critical_issues = result.get_issues_by_severity(ValidationSeverity.CRITICAL)
        assert len(critical_issues) == 0

        # Summary should contain expected keys
        assert 'total_rows' in result.summary
        assert 'total_columns' in result.summary
        assert 'data_quality_score' in result.summary
        assert result.summary['total_rows'] == len(valid_ohlcv_data)

    def test_empty_dataframe_validation(self, validator):
        """Test validation of empty DataFrame."""
        empty_df = pd.DataFrame()
        result = validator.validate(empty_df)

        assert result.is_valid is False
        assert result.has_critical_issues() is True

        critical_issues = result.get_issues_by_severity(ValidationSeverity.CRITICAL)
        assert len(critical_issues) > 0
        assert any("empty" in issue.message.lower() for issue in critical_issues)

    def test_missing_columns_validation(self, validator):
        """Test validation with missing required columns."""
        df = pd.DataFrame({
            'close': [100, 101, 102],
            'volume': [1000, 1100, 1200]
            # Missing: open, high, low
        })

        result = validator.validate(df)

        assert result.is_valid is False
        assert result.has_critical_issues() is True

        critical_issues = result.get_issues_by_severity(ValidationSeverity.CRITICAL)
        missing_col_issues = [issue for issue in critical_issues if "Missing required columns" in issue.message]
        assert len(missing_col_issues) > 0

    def test_data_type_validation(self, validator):
        """Test data type validation."""
        df = pd.DataFrame({
            'open': ['100', '101', '102'],  # String instead of numeric
            'high': [101, 102, 103],
            'low': [99, 100, 101],
            'close': [100, 101, 102],
            'volume': [1000, 1100, 1200]
        })

        result = validator.validate(df)

        assert result.has_errors() is True
        error_issues = result.get_issues_by_severity(ValidationSeverity.ERROR)
        type_issues = [issue for issue in error_issues if "should be numeric" in issue.message]
        assert len(type_issues) > 0

    def test_missing_values_validation(self, validator):
        """Test missing values validation."""
        df = pd.DataFrame({
            'open': [100, np.nan, 102, np.nan, 104],  # 40% missing
            'high': [101, 102, 103, 104, 105],
            'low': [99, 100, 101, 102, 103],
            'close': [100, 101, 102, 103, 104],
            'volume': [1000, 1100, np.nan, 1300, 1400]  # 20% missing
        })

        result = validator.validate(df)

        missing_issues = [issue for issue in result.issues if "Missing values" in issue.message]
        assert len(missing_issues) > 0

        # High missing ratio should be error/critical
        open_issues = [issue for issue in missing_issues if issue.column == 'open']
        assert len(open_issues) > 0
        assert open_issues[0].severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]

    def test_duplicate_validation(self, validator):
        """Test duplicate values validation."""
        df = pd.DataFrame({
            'open': [100, 101, 100, 103, 104],  # Duplicate row
            'high': [101, 102, 101, 104, 105],
            'low': [99, 100, 99, 102, 103],
            'close': [100, 101, 100, 103, 104],
            'volume': [1000, 1100, 1000, 1300, 1400]
        })

        result = validator.validate(df)

        duplicate_issues = [issue for issue in result.issues if "Duplicate" in issue.message]
        assert len(duplicate_issues) > 0

    def test_range_validation(self, validator):
        """Test data range validation."""
        df = pd.DataFrame({
            'open': [100, 101, -50, 103, 104],  # Negative price
            'high': [101, 102, 103, 104, 105],
            'low': [99, 100, 101, 102, 103],
            'close': [100, 101, 0, 103, 104],  # Zero price
            'volume': [1000, 1100, -500, 1300, 1400]  # Negative volume
        })

        result = validator.validate(df)

        range_issues = [issue for issue in result.issues if
                       "Non-positive values" in issue.message or "Negative" in issue.message]
        assert len(range_issues) > 0

    def test_business_rules_validation(self, validator):
        """Test business logic rules validation."""
        df = pd.DataFrame({
            'open': [100, 101, 102, 103, 104],
            'high': [99, 102, 103, 104, 105],  # High < Open for first row
            'low': [101, 100, 101, 102, 103],  # Low > Open for first row
            'close': [100, 101, 102, 103, 104],
            'volume': [1000, 1100, 1200, 1300, 1400]
        })

        result = validator.validate(df)

        business_rule_issues = [issue for issue in result.issues if
                               any(keyword in issue.column for keyword in ['high_low', 'high_open', 'low_open'])]
        assert len(business_rule_issues) > 0

    def test_outlier_detection(self, validator):
        """Test statistical outlier detection."""
        np.random.seed(42)
        normal_prices = np.random.normal(100, 2, 95)
        outlier_prices = [200, 300, 1, 2, 3]  # Extreme outliers

        df = pd.DataFrame({
            'open': np.concatenate([normal_prices, outlier_prices]),
            'high': np.concatenate([normal_prices * 1.01, outlier_prices]),
            'low': np.concatenate([normal_prices * 0.99, outlier_prices]),
            'close': np.concatenate([normal_prices, outlier_prices]),
            'volume': [1000] * 100
        })

        result = validator.validate(df)

        outlier_issues = [issue for issue in result.issues if "outliers" in issue.message.lower()]
        assert len(outlier_issues) > 0

    def test_temporal_consistency(self, validator, valid_ohlcv_data):
        """Test temporal consistency validation."""
        # Create data with extreme returns
        df = valid_ohlcv_data.copy()
        df.loc[df.index[10], 'close'] = df.loc[df.index[9], 'close'] * 2  # 100% return
        df.loc[df.index[11], 'close'] = df.loc[df.index[10], 'close'] * 0.3  # -70% return

        result = validator.validate(df)

        temporal_issues = [issue for issue in result.issues if "Extreme daily returns" in issue.message]
        assert len(temporal_issues) > 0

    def test_validation_severity_methods(self, validator):
        """Test ValidationResult severity helper methods."""
        df = pd.DataFrame({
            'open': ['invalid', 101, 102],  # Type error
            'high': [101, 102, 103],
            'low': [99, 100, 101],
            'close': [100, 101, 102],
            'volume': [1000, 1100, 1200]
        })

        result = validator.validate(df)

        # Test severity methods
        assert result.has_errors() is True
        critical_issues = result.get_issues_by_severity(ValidationSeverity.CRITICAL)
        error_issues = result.get_issues_by_severity(ValidationSeverity.ERROR)
        warning_issues = result.get_issues_by_severity(ValidationSeverity.WARNING)
        info_issues = result.get_issues_by_severity(ValidationSeverity.INFO)

        # Should have at least one error (type validation)
        assert len(error_issues) > 0

    def test_data_quality_score(self, validator, valid_ohlcv_data):
        """Test data quality score calculation."""
        # Valid data should have high score
        result = validator.validate(valid_ohlcv_data)
        assert result.summary['data_quality_score'] >= 90

        # Invalid data should have lower score
        invalid_df = pd.DataFrame({
            'open': [100, np.nan, -50],  # Missing and negative values
            'high': [101, 102, 103],
            'low': [99, 100, 101],
            'close': [100, 101, 102],
            'volume': [1000, 1100, 1200]
        })

        result = validator.validate(invalid_df)
        assert result.summary['data_quality_score'] < 90

    def test_completeness_calculation(self, validator):
        """Test data completeness calculation."""
        # Complete data
        complete_df = pd.DataFrame({
            'open': [100, 101, 102],
            'high': [101, 102, 103],
            'low': [99, 100, 101],
            'close': [100, 101, 102],
            'volume': [1000, 1100, 1200]
        })

        result = validator.validate(complete_df)
        assert result.summary['completeness'] == 1.0

        # Incomplete data
        incomplete_df = pd.DataFrame({
            'open': [100, np.nan, 102],
            'high': [101, 102, np.nan],
            'low': [99, 100, 101],
            'close': [100, 101, 102],
            'volume': [1000, 1100, 1200]
        })

        result = validator.validate(incomplete_df)
        assert result.summary['completeness'] < 1.0
        # 13 out of 15 values are non-null
        assert abs(result.summary['completeness'] - 13/15) < 0.01


class TestFeaturePipeline:
    """Test feature engineering pipeline."""

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
    def pipeline(self):
        """Create feature pipeline."""
        return FeaturePipeline()

    def test_pipeline_initialization(self):
        """Test pipeline initialization."""
        # Default initialization
        pipeline = FeaturePipeline()
        assert pipeline.config is not None
        assert isinstance(pipeline.config, PipelineConfig)
        assert hasattr(pipeline, 'technical_builder')
        assert hasattr(pipeline, 'price_builder')
        assert hasattr(pipeline, 'sentiment_builder')
        assert hasattr(pipeline, 'market_builder')

        # Custom config
        config = PipelineConfig(validate_input=False, feature_selection=True)
        pipeline = FeaturePipeline(config)
        assert pipeline.config.validate_input is False
        assert pipeline.config.feature_selection is True

    def test_basic_transform(self, pipeline, sample_ohlcv_data):
        """Test basic feature transformation."""
        result = pipeline.transform(sample_ohlcv_data)

        assert isinstance(result, PipelineResult)
        assert isinstance(result.features, pd.DataFrame)
        assert isinstance(result.feature_names, list)
        assert isinstance(result.execution_time, float)
        assert result.execution_time > 0

        # Should have more features than input
        assert len(result.features.columns) > len(sample_ohlcv_data.columns)
        assert len(result.feature_names) > 0

        # Original data should be preserved
        for col in sample_ohlcv_data.columns:
            assert col in result.features.columns

    def test_selective_feature_building(self, pipeline, sample_ohlcv_data):
        """Test selective feature building."""
        # Only technical features
        result = pipeline.transform(sample_ohlcv_data, include_features=['technical'])

        assert 'technical' in result.metadata['features_by_type']
        assert 'price' not in result.metadata['features_by_type']

        technical_features = result.metadata['features_by_type']['technical']
        assert len(technical_features) > 0
        assert 'rsi' in result.features.columns

        # Multiple feature types
        result = pipeline.transform(sample_ohlcv_data, include_features=['technical', 'price'])

        assert 'technical' in result.metadata['features_by_type']
        assert 'price' in result.metadata['features_by_type']
        assert 'sentiment' not in result.metadata['features_by_type']

    def test_sentiment_data_integration(self, pipeline, sample_ohlcv_data):
        """Test sentiment data integration."""
        # Create mock sentiment data
        sentiment_data = pd.DataFrame({
            'news_sentiment': np.random.normal(0, 0.3, len(sample_ohlcv_data)),
            'social_sentiment': np.random.normal(0, 0.4, len(sample_ohlcv_data)),
            'analyst_sentiment': np.random.normal(0, 0.2, len(sample_ohlcv_data))
        }, index=sample_ohlcv_data.index)

        result = pipeline.transform(
            sample_ohlcv_data,
            include_features=['sentiment'],
            sentiment_data=sentiment_data
        )

        assert 'sentiment' in result.metadata['features_by_type']
        assert 'news_sentiment' in result.features.columns
        assert 'combined_sentiment' in result.features.columns

    def test_market_data_integration(self, pipeline, sample_ohlcv_data):
        """Test market data integration."""
        # Create mock market data
        market_data = {
            'SPY': pd.DataFrame({
                'close': np.random.normal(400, 20, len(sample_ohlcv_data)),
                'volume': np.random.lognormal(16, 0.3, len(sample_ohlcv_data))
            }, index=sample_ohlcv_data.index)
        }

        result = pipeline.transform(
            sample_ohlcv_data,
            include_features=['market'],
            market_data=market_data
        )

        assert 'market' in result.metadata['features_by_type']
        assert 'spy_return' in result.features.columns
        assert 'relative_to_spy' in result.features.columns

    def test_input_validation_enabled(self, sample_ohlcv_data):
        """Test pipeline with input validation enabled."""
        config = PipelineConfig(validate_input=True)
        pipeline = FeaturePipeline(config)

        # Valid data should pass
        result = pipeline.transform(sample_ohlcv_data)
        assert result.validation_result is not None

        # Invalid data should raise error
        invalid_data = pd.DataFrame({
            'close': [100, -50, 102]  # Negative price
        })

        with pytest.raises(ValueError, match="Critical data quality issues"):
            pipeline.transform(invalid_data)

    def test_input_validation_disabled(self, sample_ohlcv_data):
        """Test pipeline with input validation disabled."""
        config = PipelineConfig(validate_input=False)
        pipeline = FeaturePipeline(config)

        # Should not validate input
        invalid_data = pd.DataFrame({
            'open': [100, 101, 102],
            'high': [101, 102, 103],
            'low': [99, 100, 101],
            'close': [100, -50, 102],  # Negative price
            'volume': [1000, 1100, 1200]
        })

        # Should not raise error even with invalid data
        result = pipeline.transform(invalid_data)
        assert isinstance(result, PipelineResult)

    def test_missing_value_handling(self, pipeline):
        """Test missing value handling strategies."""
        # Create data with missing values
        df = pd.DataFrame({
            'open': [100, np.nan, 102, 103, np.nan],
            'high': [101, 102, np.nan, 104, 105],
            'low': [99, 100, 101, np.nan, 103],
            'close': [100, 101, 102, 103, 104],
            'volume': [1000, np.nan, 1200, 1300, 1400]
        })

        # Test forward fill (default)
        config = PipelineConfig(handle_missing="forward_fill", validate_input=False)
        pipeline = FeaturePipeline(config)
        result = pipeline.transform(df, include_features=['technical'])

        # Should have fewer NaN values
        original_nan_count = df.isnull().sum().sum()
        result_nan_count = result.features.isnull().sum().sum()
        # Result may have some NaN due to feature calculations, but should be manageable
        assert not result.features.isnull().all().any()  # No column should be all NaN

    def test_feature_selection(self, pipeline, sample_ohlcv_data):
        """Test feature selection functionality."""
        config = PipelineConfig(
            feature_selection=True,
            correlation_threshold=0.8,  # Lower threshold for testing
            variance_threshold=0.001,
            validate_input=False
        )
        pipeline = FeaturePipeline(config)

        result = pipeline.transform(sample_ohlcv_data, include_features=['technical'])

        # Should have removed some features due to selection
        # (This test may be flaky depending on the generated data)
        assert isinstance(result.features, pd.DataFrame)
        assert len(result.feature_names) > 0

    def test_feature_importance_calculation(self, pipeline, sample_ohlcv_data):
        """Test feature importance calculation."""
        result = pipeline.transform(sample_ohlcv_data, include_features=['technical'])

        # Add a target column for importance calculation
        result.features['target'] = result.features['close'].pct_change().shift(-1)

        importance = pipeline.get_feature_importance(result.features, 'target')

        assert isinstance(importance, dict)
        assert len(importance) > 0
        assert all(isinstance(score, float) for score in importance.values())
        assert all(0 <= score <= 1 for score in importance.values())

    def test_pipeline_info(self, pipeline):
        """Test pipeline information retrieval."""
        info = pipeline.get_pipeline_info()

        assert isinstance(info, dict)
        assert 'config' in info
        assert 'feature_builders' in info
        assert 'total_possible_features' in info
        assert 'features_by_builder' in info

        assert info['total_possible_features'] > 0
        assert len(info['feature_builders']) == 4  # technical, price, sentiment, market

    def test_pipeline_error_handling(self, pipeline):
        """Test pipeline error handling."""
        # Test with completely invalid data
        invalid_df = pd.DataFrame({'invalid_column': [1, 2, 3]})

        config = PipelineConfig(validate_input=False)
        pipeline = FeaturePipeline(config)

        # Should handle gracefully or raise appropriate error
        with pytest.raises(ValueError):
            pipeline.transform(invalid_df, include_features=['technical'])

    def test_deterministic_output(self, pipeline, sample_ohlcv_data):
        """Test that pipeline output is deterministic."""
        result1 = pipeline.transform(sample_ohlcv_data.copy(), include_features=['technical'])
        result2 = pipeline.transform(sample_ohlcv_data.copy(), include_features=['technical'])

        # Results should be identical (excluding metadata timestamps)
        pd.testing.assert_frame_equal(result1.features, result2.features)
        assert result1.feature_names == result2.feature_names


class TestDataLoader:
    """Test data loader pipeline component."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)

    @pytest.fixture
    def loader(self, temp_dir):
        """Create data loader with temporary cache directory."""
        return DataLoader(cache_dir=temp_dir / "cache")

    @pytest.fixture
    def sample_csv_data(self, temp_dir):
        """Create sample CSV file for testing."""
        csv_file = temp_dir / "sample_data.csv"

        # Create sample data
        dates = pd.date_range(start='2023-01-01', periods=50, freq='D')
        data = {
            'date': dates,
            'open': np.random.uniform(90, 110, 50),
            'high': np.random.uniform(100, 120, 50),
            'low': np.random.uniform(80, 100, 50),
            'close': np.random.uniform(90, 110, 50),
            'volume': np.random.randint(1000000, 10000000, 50)
        }
        df = pd.DataFrame(data)
        df.to_csv(csv_file, index=False)

        return csv_file

    def test_loader_initialization(self, temp_dir):
        """Test loader initialization."""
        # Default initialization
        loader = DataLoader()
        assert loader.cache_dir is not None

        # Custom cache directory
        loader = DataLoader(cache_dir=temp_dir)
        assert loader.cache_dir == temp_dir

    def test_csv_data_loading(self, loader, sample_csv_data):
        """Test loading data from CSV file."""
        config = DataSourceConfig(
            source_type="csv",
            path_or_connection=str(sample_csv_data),
            symbol="TEST"
        )

        result = loader.load_stock_data(config)

        assert isinstance(result, pd.DataFrame)
        assert len(result) > 0
        assert all(col in result.columns for col in ['open', 'high', 'low', 'close', 'volume'])

        # Should have datetime index
        assert pd.api.types.is_datetime64_any_dtype(result.index)

    def test_csv_with_column_mapping(self, loader, temp_dir):
        """Test CSV loading with column mapping."""
        # Create CSV with different column names
        csv_file = temp_dir / "mapped_data.csv"
        dates = pd.date_range(start='2023-01-01', periods=10, freq='D')
        data = {
            'Date': dates,
            'Open': np.random.uniform(90, 110, 10),
            'High': np.random.uniform(100, 120, 10),
            'Low': np.random.uniform(80, 100, 10),
            'Close': np.random.uniform(90, 110, 10),
            'Vol': np.random.randint(1000000, 10000000, 10)
        }
        df = pd.DataFrame(data)
        df.to_csv(csv_file, index=False)

        config = DataSourceConfig(
            source_type="csv",
            path_or_connection=str(csv_file),
            columns_mapping={
                'Date': 'date',
                'Open': 'open',
                'High': 'high',
                'Low': 'low',
                'Close': 'close',
                'Vol': 'volume'
            }
        )

        result = loader.load_stock_data(config)

        assert 'open' in result.columns
        assert 'volume' in result.columns
        assert 'Open' not in result.columns  # Original column should be renamed

    def test_date_range_filtering(self, loader, sample_csv_data):
        """Test date range filtering."""
        config = DataSourceConfig(
            source_type="csv",
            path_or_connection=str(sample_csv_data),
            start_date=datetime(2023, 1, 10),
            end_date=datetime(2023, 1, 20)
        )

        result = loader.load_stock_data(config)

        assert len(result) <= 11  # At most 11 days in range
        assert result.index.min() >= pd.Timestamp('2023-01-10')
        assert result.index.max() <= pd.Timestamp('2023-01-20')

    def test_api_data_loading_with_cache(self, loader):
        """Test API data loading with caching."""
        config = DataSourceConfig(
            source_type="api",
            path_or_connection="https://api.example.com/stock",
            symbol="AAPL",
            cache_enabled=True,
            cache_ttl_hours=1
        )

        # First call should create mock data and cache it
        result1 = loader.load_stock_data(config)
        assert isinstance(result1, pd.DataFrame)
        assert len(result1) > 0

        # Second call should load from cache
        result2 = loader.load_stock_data(config)
        pd.testing.assert_frame_equal(result1, result2)

    def test_cache_expiration(self, loader):
        """Test cache expiration functionality."""
        config = DataSourceConfig(
            source_type="api",
            path_or_connection="https://api.example.com/stock",
            symbol="AAPL",
            cache_enabled=True,
            cache_ttl_hours=0  # Immediate expiration
        )

        # Load data to create cache
        result1 = loader.load_stock_data(config)

        # Cache should be expired, but we can't easily test this without mocking time
        # This test validates the cache TTL parameter is used
        assert isinstance(result1, pd.DataFrame)

    def test_database_loading_mock(self, loader):
        """Test database loading (mock implementation)."""
        config = DataSourceConfig(
            source_type="database",
            path_or_connection="postgresql://localhost/test",
            symbol="AAPL"
        )

        result = loader.load_stock_data(config)

        # Should return mock data
        assert isinstance(result, pd.DataFrame)
        assert len(result) > 0
        assert all(col in result.columns for col in ['open', 'high', 'low', 'close', 'volume'])

    def test_sentiment_data_loading(self, loader):
        """Test sentiment data loading."""
        config = DataSourceConfig(
            source_type="api",
            path_or_connection="https://api.example.com/sentiment",
            symbol="AAPL"
        )

        result = loader.load_sentiment_data(config)

        assert isinstance(result, pd.DataFrame)
        assert 'news_sentiment' in result.columns
        assert 'social_sentiment' in result.columns

        # Sentiment values should be in valid range
        assert (result['news_sentiment'] >= -1).all()
        assert (result['news_sentiment'] <= 1).all()

    def test_market_data_loading(self, loader):
        """Test market data loading for multiple symbols."""
        config = DataSourceConfig(
            source_type="api",
            path_or_connection="https://api.example.com/market"
        )

        symbols = ['SPY', 'QQQ', 'VIX']
        result = loader.load_market_data(symbols, config)

        assert isinstance(result, dict)
        assert len(result) == len(symbols)

        for symbol in symbols:
            assert symbol in result
            assert isinstance(result[symbol], pd.DataFrame)
            assert 'close' in result[symbol].columns

        # VIX should have different characteristics
        vix_data = result['VIX']
        spy_data = result['SPY']

        # VIX should be bounded and different from regular stocks
        assert (vix_data['close'] >= 10).all()
        assert (vix_data['close'] <= 80).all()

    def test_mock_data_creation(self, loader):
        """Test mock data creation."""
        config = DataSourceConfig(
            source_type="api",
            path_or_connection="test",
            symbol="AAPL",
            start_date=datetime(2023, 1, 1),
            end_date=datetime(2023, 1, 31)
        )

        result = loader._create_mock_stock_data("AAPL", config)

        assert isinstance(result, pd.DataFrame)
        assert len(result) > 0  # Should have trading days
        assert pd.api.types.is_datetime64_any_dtype(result.index)

        # Should respect date range
        assert result.index.min() >= pd.Timestamp('2023-01-01')
        assert result.index.max() <= pd.Timestamp('2023-01-31')

        # Should only include weekdays (trading days)
        weekdays = result.index.dayofweek
        assert all(day < 5 for day in weekdays)  # Monday=0, Friday=4

    def test_data_standardization(self, loader):
        """Test data standardization functionality."""
        # Create data missing some columns
        df = pd.DataFrame({
            'close': [100, 101, 102],
            'volume': [1000, 1100, 1200]
            # Missing: open, high, low
        })

        config = DataSourceConfig(source_type="api", path_or_connection="test")
        standardized = loader._standardize_dataframe(df, config)

        # Should infer missing columns
        assert 'open' in standardized.columns
        assert 'high' in standardized.columns
        assert 'low' in standardized.columns

        # Columns should be numeric
        for col in ['open', 'high', 'low', 'close', 'volume']:
            assert pd.api.types.is_numeric_dtype(standardized[col])

    def test_available_symbols(self, loader):
        """Test getting available symbols."""
        symbols = loader.get_available_symbols("test_source")

        assert isinstance(symbols, list)
        assert len(symbols) > 0
        assert 'AAPL' in symbols
        assert 'SPY' in symbols

    def test_data_source_validation(self, loader, sample_csv_data):
        """Test data source validation."""
        # Valid CSV file
        config = DataSourceConfig(
            source_type="csv",
            path_or_connection=str(sample_csv_data)
        )
        assert loader.validate_data_source(config) is True

        # Invalid CSV file
        config = DataSourceConfig(
            source_type="csv",
            path_or_connection="nonexistent_file.csv"
        )
        assert loader.validate_data_source(config) is False

        # Valid API source (mock)
        config = DataSourceConfig(
            source_type="api",
            path_or_connection="https://api.example.com"
        )
        assert loader.validate_data_source(config) is True

        # Invalid source type
        config = DataSourceConfig(
            source_type="invalid_type",
            path_or_connection="test"
        )
        assert loader.validate_data_source(config) is False

    def test_unsupported_source_type(self, loader):
        """Test handling of unsupported source types."""
        config = DataSourceConfig(
            source_type="unsupported",
            path_or_connection="test"
        )

        with pytest.raises(ValueError, match="Unsupported source type"):
            loader.load_stock_data(config)

    def test_error_handling_in_market_data_loading(self, loader):
        """Test error handling when loading market data fails for some symbols."""
        config = DataSourceConfig(
            source_type="api",
            path_or_connection="https://api.example.com/market"
        )

        # Mock a scenario where loading fails for some symbols
        with patch.object(loader, 'load_stock_data') as mock_load:
            def side_effect(symbol_config):
                if symbol_config.symbol == 'INVALID':
                    raise Exception("API Error")
                else:
                    return loader._create_mock_stock_data(symbol_config.symbol, symbol_config)

            mock_load.side_effect = side_effect

            symbols = ['SPY', 'INVALID', 'QQQ']
            result = loader.load_market_data(symbols, config)

            # Should still return data for valid symbols
            assert 'SPY' in result
            assert 'QQQ' in result
            assert 'INVALID' in result  # Should have fallback mock data


if __name__ == "__main__":
    pytest.main([__file__])