"""
Feature engineering pipeline component.

Orchestrates feature building from multiple feature builders.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Type, Any
import logging
from dataclasses import dataclass
import time

from ..feature_builders import (
    TechnicalIndicatorBuilder,
    PriceFeatureBuilder,
    SentimentFeatureBuilder,
    MarketFeatureBuilder
)
from .data_validator import DataValidator, ValidationResult

logger = logging.getLogger(__name__)


@dataclass
class PipelineConfig:
    """Configuration for feature pipeline."""
    validate_input: bool = True
    validate_output: bool = True
    handle_missing: str = "forward_fill"  # "forward_fill", "backward_fill", "drop", "interpolate"
    feature_selection: bool = False
    correlation_threshold: float = 0.95
    variance_threshold: float = 0.01


@dataclass
class PipelineResult:
    """Result of feature pipeline execution."""
    features: pd.DataFrame
    feature_names: List[str]
    execution_time: float
    validation_result: Optional[ValidationResult] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class FeaturePipeline:
    """
    Orchestrates feature engineering pipeline.

    Combines multiple feature builders to create comprehensive feature set:
    - Technical indicators
    - Price-based features
    - Sentiment features
    - Market features
    - Data validation and quality checks
    """

    def __init__(self, config: Optional[PipelineConfig] = None):
        """
        Initialize feature pipeline.

        Args:
            config: Pipeline configuration
        """
        self.config = config or PipelineConfig()
        self.validator = DataValidator()

        # Initialize feature builders
        self.technical_builder = TechnicalIndicatorBuilder()
        self.price_builder = PriceFeatureBuilder()
        self.sentiment_builder = SentimentFeatureBuilder()
        self.market_builder = MarketFeatureBuilder()

        self.feature_builders = {
            'technical': self.technical_builder,
            'price': self.price_builder,
            'sentiment': self.sentiment_builder,
            'market': self.market_builder
        }

    def transform(self,
                  df: pd.DataFrame,
                  include_features: List[str] = None,
                  sentiment_data: Optional[pd.DataFrame] = None,
                  market_data: Optional[Dict[str, pd.DataFrame]] = None) -> PipelineResult:
        """
        Transform input data through feature engineering pipeline.

        Args:
            df: Input DataFrame with OHLCV data
            include_features: List of feature types to include ('technical', 'price', 'sentiment', 'market')
            sentiment_data: Optional sentiment data
            market_data: Optional market data

        Returns:
            PipelineResult with features and metadata
        """
        start_time = time.time()

        if include_features is None:
            include_features = ['technical', 'price', 'sentiment', 'market']

        # Input validation
        validation_result = None
        if self.config.validate_input:
            validation_result = self.validator.validate(df)
            if validation_result.has_critical_issues():
                raise ValueError(f"Critical data quality issues found: {validation_result.issues}")

        # Start with copy of input data
        result_df = df.copy()

        # Apply feature builders
        feature_names = []
        metadata = {'features_by_type': {}}

        try:
            # Technical indicators
            if 'technical' in include_features:
                logger.info("Building technical indicator features...")
                result_df = self.technical_builder.build_features(result_df)
                tech_features = self.technical_builder.get_feature_names()
                feature_names.extend(tech_features)
                metadata['features_by_type']['technical'] = tech_features
                logger.info(f"Added {len(tech_features)} technical features")

            # Price features
            if 'price' in include_features:
                logger.info("Building price features...")
                result_df = self.price_builder.build_features(result_df)
                price_features = self.price_builder.get_feature_names()
                feature_names.extend(price_features)
                metadata['features_by_type']['price'] = price_features
                logger.info(f"Added {len(price_features)} price features")

            # Sentiment features
            if 'sentiment' in include_features:
                logger.info("Building sentiment features...")
                result_df = self.sentiment_builder.build_features(result_df, sentiment_data)
                sentiment_features = self.sentiment_builder.get_feature_names()
                feature_names.extend(sentiment_features)
                metadata['features_by_type']['sentiment'] = sentiment_features
                logger.info(f"Added {len(sentiment_features)} sentiment features")

            # Market features
            if 'market' in include_features:
                logger.info("Building market features...")
                result_df = self.market_builder.build_features(result_df, market_data)
                market_features = self.market_builder.get_feature_names()
                feature_names.extend(market_features)
                metadata['features_by_type']['market'] = market_features
                logger.info(f"Added {len(market_features)} market features")

        except Exception as e:
            logger.error(f"Error during feature building: {e}")
            raise

        # Post-processing
        result_df = self._post_process_features(result_df, feature_names)
        feature_names = [name for name in feature_names if name in result_df.columns]

        # Output validation
        output_validation = None
        if self.config.validate_output:
            output_validation = self._validate_features(result_df, feature_names)

        execution_time = time.time() - start_time

        # Update metadata
        metadata.update({
            'total_features': len(feature_names),
            'input_shape': df.shape,
            'output_shape': result_df.shape,
            'execution_time': execution_time,
            'config': self.config.__dict__
        })

        return PipelineResult(
            features=result_df,
            feature_names=feature_names,
            execution_time=execution_time,
            validation_result=output_validation or validation_result,
            metadata=metadata
        )

    def _post_process_features(self, df: pd.DataFrame, feature_names: List[str]) -> pd.DataFrame:
        """Post-process features (handle missing values, feature selection, etc.)."""
        result_df = df.copy()

        # Handle missing values
        if self.config.handle_missing == "forward_fill":
            result_df = result_df.fillna(method='ffill')
        elif self.config.handle_missing == "backward_fill":
            result_df = result_df.fillna(method='bfill')
        elif self.config.handle_missing == "interpolate":
            result_df = result_df.interpolate()
        elif self.config.handle_missing == "drop":
            result_df = result_df.dropna()

        # Replace remaining infinite values
        result_df = result_df.replace([np.inf, -np.inf], np.nan)

        # Final forward fill for any remaining NaN
        result_df = result_df.fillna(method='ffill').fillna(0)

        # Feature selection
        if self.config.feature_selection:
            result_df = self._select_features(result_df, feature_names)

        return result_df

    def _select_features(self, df: pd.DataFrame, feature_names: List[str]) -> pd.DataFrame:
        """Select features based on correlation and variance thresholds."""
        feature_df = df[feature_names]

        # Remove low variance features
        variances = feature_df.var()
        low_variance_features = variances[variances < self.config.variance_threshold].index
        if len(low_variance_features) > 0:
            logger.info(f"Removing {len(low_variance_features)} low variance features")
            feature_df = feature_df.drop(columns=low_variance_features)

        # Remove highly correlated features
        correlation_matrix = feature_df.corr().abs()
        upper_triangle = correlation_matrix.where(
            np.triu(np.ones(correlation_matrix.shape), k=1).astype(bool)
        )

        high_corr_features = [
            column for column in upper_triangle.columns
            if any(upper_triangle[column] > self.config.correlation_threshold)
        ]

        if len(high_corr_features) > 0:
            logger.info(f"Removing {len(high_corr_features)} highly correlated features")
            feature_df = feature_df.drop(columns=high_corr_features)

        # Combine with original non-feature columns
        non_feature_cols = [col for col in df.columns if col not in feature_names]
        result_df = pd.concat([df[non_feature_cols], feature_df], axis=1)

        return result_df

    def _validate_features(self, df: pd.DataFrame, feature_names: List[str]) -> ValidationResult:
        """Validate generated features."""
        # Create a feature-only DataFrame for validation
        feature_df = df[feature_names] if feature_names else df

        # Use a more lenient validator for features
        feature_validator = DataValidator(
            required_columns=[],  # No required columns for features
            outlier_threshold=10.0,  # More lenient for derived features
            max_missing_ratio=0.1  # Allow some missing values in features
        )

        return feature_validator.validate(feature_df)

    def get_feature_importance(self, df: pd.DataFrame, target_column: str) -> Dict[str, float]:
        """
        Calculate simple feature importance using correlation with target.

        Args:
            df: DataFrame with features and target
            target_column: Name of target column

        Returns:
            Dictionary mapping feature names to importance scores
        """
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in DataFrame")

        target = df[target_column]
        feature_columns = [col for col in df.columns if col != target_column]

        importance = {}
        for col in feature_columns:
            try:
                correlation = abs(df[col].corr(target))
                importance[col] = correlation if not np.isnan(correlation) else 0.0
            except Exception:
                importance[col] = 0.0

        # Sort by importance
        importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

        return importance

    def get_pipeline_info(self) -> Dict[str, Any]:
        """Get information about the pipeline configuration and builders."""
        return {
            'config': self.config.__dict__,
            'feature_builders': list(self.feature_builders.keys()),
            'total_possible_features': sum(
                len(builder.get_feature_names()) for builder in self.feature_builders.values()
            ),
            'features_by_builder': {
                name: len(builder.get_feature_names())
                for name, builder in self.feature_builders.items()
            }
        }