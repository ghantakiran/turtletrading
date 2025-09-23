"""
Data validation pipeline component.

Provides comprehensive data quality validation for stock market data.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """Validation issue severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationIssue:
    """Represents a data validation issue."""
    column: str
    message: str
    severity: ValidationSeverity
    count: int = 1
    examples: List[Any] = None

    def __post_init__(self):
        if self.examples is None:
            self.examples = []


@dataclass
class ValidationResult:
    """Result of data validation."""
    is_valid: bool
    issues: List[ValidationIssue]
    summary: Dict[str, Any]

    def get_issues_by_severity(self, severity: ValidationSeverity) -> List[ValidationIssue]:
        """Get all issues of a specific severity."""
        return [issue for issue in self.issues if issue.severity == severity]

    def has_critical_issues(self) -> bool:
        """Check if there are any critical issues."""
        return any(issue.severity == ValidationSeverity.CRITICAL for issue in self.issues)

    def has_errors(self) -> bool:
        """Check if there are any errors or critical issues."""
        return any(issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
                  for issue in self.issues)


class DataValidator:
    """
    Validates stock market data quality.

    Performs checks for:
    - Required columns presence
    - Data types and ranges
    - Missing values
    - Outliers and anomalies
    - Business logic violations
    - Temporal consistency
    """

    def __init__(self,
                 required_columns: List[str] = None,
                 outlier_threshold: float = 5.0,
                 max_missing_ratio: float = 0.05):
        """
        Initialize data validator.

        Args:
            required_columns: List of required column names
            outlier_threshold: Z-score threshold for outlier detection
            max_missing_ratio: Maximum allowed ratio of missing values
        """
        self.required_columns = required_columns or ['open', 'high', 'low', 'close', 'volume']
        self.outlier_threshold = outlier_threshold
        self.max_missing_ratio = max_missing_ratio

    def validate(self, df: pd.DataFrame) -> ValidationResult:
        """
        Perform comprehensive data validation.

        Args:
            df: DataFrame to validate

        Returns:
            ValidationResult with issues and summary
        """
        issues = []
        summary = {}

        # Basic structure validation
        issues.extend(self._validate_structure(df))
        issues.extend(self._validate_data_types(df))

        # Data quality validation
        issues.extend(self._validate_missing_values(df))
        issues.extend(self._validate_duplicates(df))
        issues.extend(self._validate_ranges(df))
        issues.extend(self._validate_outliers(df))

        # Business logic validation
        issues.extend(self._validate_business_rules(df))
        issues.extend(self._validate_temporal_consistency(df))

        # Create summary
        summary = self._create_summary(df, issues)

        # Determine overall validity
        is_valid = not any(issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
                          for issue in issues)

        return ValidationResult(is_valid=is_valid, issues=issues, summary=summary)

    def _validate_structure(self, df: pd.DataFrame) -> List[ValidationIssue]:
        """Validate DataFrame structure."""
        issues = []

        # Check if DataFrame is empty
        if df.empty:
            issues.append(ValidationIssue(
                column="dataframe",
                message="DataFrame is empty",
                severity=ValidationSeverity.CRITICAL
            ))
            return issues

        # Check required columns
        missing_columns = [col for col in self.required_columns if col not in df.columns]
        if missing_columns:
            issues.append(ValidationIssue(
                column="columns",
                message=f"Missing required columns: {missing_columns}",
                severity=ValidationSeverity.CRITICAL,
                examples=missing_columns
            ))

        # Check for extra unexpected columns
        expected_columns = set(self.required_columns + ['date', 'timestamp', 'symbol'])
        extra_columns = [col for col in df.columns if col not in expected_columns]
        if extra_columns:
            issues.append(ValidationIssue(
                column="columns",
                message=f"Unexpected columns found: {extra_columns}",
                severity=ValidationSeverity.INFO,
                examples=extra_columns[:5]
            ))

        return issues

    def _validate_data_types(self, df: pd.DataFrame) -> List[ValidationIssue]:
        """Validate data types."""
        issues = []

        numeric_columns = ['open', 'high', 'low', 'close', 'volume']
        for col in numeric_columns:
            if col in df.columns:
                if not pd.api.types.is_numeric_dtype(df[col]):
                    issues.append(ValidationIssue(
                        column=col,
                        message=f"Column {col} should be numeric but is {df[col].dtype}",
                        severity=ValidationSeverity.ERROR
                    ))

        return issues

    def _validate_missing_values(self, df: pd.DataFrame) -> List[ValidationIssue]:
        """Validate missing values."""
        issues = []

        for col in df.columns:
            missing_count = df[col].isnull().sum()
            missing_ratio = missing_count / len(df)

            if missing_count > 0:
                severity = ValidationSeverity.WARNING
                if missing_ratio > self.max_missing_ratio:
                    severity = ValidationSeverity.ERROR
                if missing_ratio > 0.5:
                    severity = ValidationSeverity.CRITICAL

                issues.append(ValidationIssue(
                    column=col,
                    message=f"Missing values: {missing_count} ({missing_ratio:.2%})",
                    severity=severity,
                    count=missing_count
                ))

        return issues

    def _validate_duplicates(self, df: pd.DataFrame) -> List[ValidationIssue]:
        """Validate duplicate values."""
        issues = []

        # Check for duplicate rows
        duplicate_rows = df.duplicated().sum()
        if duplicate_rows > 0:
            issues.append(ValidationIssue(
                column="dataframe",
                message=f"Duplicate rows found: {duplicate_rows}",
                severity=ValidationSeverity.WARNING,
                count=duplicate_rows
            ))

        # Check for duplicate index values
        if hasattr(df.index, 'duplicated'):
            duplicate_index = df.index.duplicated().sum()
            if duplicate_index > 0:
                issues.append(ValidationIssue(
                    column="index",
                    message=f"Duplicate index values: {duplicate_index}",
                    severity=ValidationSeverity.ERROR,
                    count=duplicate_index
                ))

        return issues

    def _validate_ranges(self, df: pd.DataFrame) -> List[ValidationIssue]:
        """Validate data ranges."""
        issues = []

        # Price columns should be positive
        price_columns = ['open', 'high', 'low', 'close']
        for col in price_columns:
            if col in df.columns:
                negative_values = (df[col] <= 0).sum()
                if negative_values > 0:
                    issues.append(ValidationIssue(
                        column=col,
                        message=f"Non-positive values in price column: {negative_values}",
                        severity=ValidationSeverity.ERROR,
                        count=negative_values,
                        examples=df[df[col] <= 0][col].head(3).tolist()
                    ))

        # Volume should be non-negative
        if 'volume' in df.columns:
            negative_volume = (df['volume'] < 0).sum()
            if negative_volume > 0:
                issues.append(ValidationIssue(
                    column='volume',
                    message=f"Negative volume values: {negative_volume}",
                    severity=ValidationSeverity.ERROR,
                    count=negative_volume
                ))

        return issues

    def _validate_outliers(self, df: pd.DataFrame) -> List[ValidationIssue]:
        """Validate outliers using statistical methods."""
        issues = []

        numeric_columns = ['open', 'high', 'low', 'close', 'volume']
        for col in numeric_columns:
            if col in df.columns and df[col].dtype in ['float64', 'int64']:
                # Z-score method
                z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())
                outliers = (z_scores > self.outlier_threshold).sum()

                if outliers > 0:
                    outlier_ratio = outliers / len(df)
                    severity = ValidationSeverity.INFO
                    if outlier_ratio > 0.05:  # More than 5% outliers
                        severity = ValidationSeverity.WARNING

                    issues.append(ValidationIssue(
                        column=col,
                        message=f"Statistical outliers (Z-score > {self.outlier_threshold}): {outliers}",
                        severity=severity,
                        count=outliers,
                        examples=df[z_scores > self.outlier_threshold][col].head(3).tolist()
                    ))

        return issues

    def _validate_business_rules(self, df: pd.DataFrame) -> List[ValidationIssue]:
        """Validate business logic rules."""
        issues = []

        required_price_cols = ['open', 'high', 'low', 'close']
        if all(col in df.columns for col in required_price_cols):
            # High should be >= Low
            high_low_violations = (df['high'] < df['low']).sum()
            if high_low_violations > 0:
                issues.append(ValidationIssue(
                    column="high_low",
                    message=f"High < Low violations: {high_low_violations}",
                    severity=ValidationSeverity.ERROR,
                    count=high_low_violations
                ))

            # High should be >= Open and Close
            high_open_violations = (df['high'] < df['open']).sum()
            if high_open_violations > 0:
                issues.append(ValidationIssue(
                    column="high_open",
                    message=f"High < Open violations: {high_open_violations}",
                    severity=ValidationSeverity.ERROR,
                    count=high_open_violations
                ))

            high_close_violations = (df['high'] < df['close']).sum()
            if high_close_violations > 0:
                issues.append(ValidationIssue(
                    column="high_close",
                    message=f"High < Close violations: {high_close_violations}",
                    severity=ValidationSeverity.ERROR,
                    count=high_close_violations
                ))

            # Low should be <= Open and Close
            low_open_violations = (df['low'] > df['open']).sum()
            if low_open_violations > 0:
                issues.append(ValidationIssue(
                    column="low_open",
                    message=f"Low > Open violations: {low_open_violations}",
                    severity=ValidationSeverity.ERROR,
                    count=low_open_violations
                ))

            low_close_violations = (df['low'] > df['close']).sum()
            if low_close_violations > 0:
                issues.append(ValidationIssue(
                    column="low_close",
                    message=f"Low > Close violations: {low_close_violations}",
                    severity=ValidationSeverity.ERROR,
                    count=low_close_violations
                ))

        return issues

    def _validate_temporal_consistency(self, df: pd.DataFrame) -> List[ValidationIssue]:
        """Validate temporal consistency."""
        issues = []

        if len(df) < 2:
            return issues

        # Check for reasonable price changes
        if 'close' in df.columns:
            returns = df['close'].pct_change().dropna()
            extreme_returns = (np.abs(returns) > 0.5).sum()  # 50% daily change

            if extreme_returns > 0:
                issues.append(ValidationIssue(
                    column="close",
                    message=f"Extreme daily returns (>50%): {extreme_returns}",
                    severity=ValidationSeverity.WARNING,
                    count=extreme_returns,
                    examples=returns[np.abs(returns) > 0.5].head(3).tolist()
                ))

        # Check for gaps in time series (if index is datetime)
        if hasattr(df.index, 'freq') or pd.api.types.is_datetime64_any_dtype(df.index):
            try:
                # Check for irregular gaps
                if len(df) > 2:
                    time_diffs = df.index.to_series().diff()
                    median_diff = time_diffs.median()
                    large_gaps = (time_diffs > median_diff * 5).sum()

                    if large_gaps > 0:
                        issues.append(ValidationIssue(
                            column="index",
                            message=f"Large time gaps detected: {large_gaps}",
                            severity=ValidationSeverity.INFO,
                            count=large_gaps
                        ))
            except Exception as e:
                logger.warning(f"Could not validate temporal consistency: {e}")

        return issues

    def _create_summary(self, df: pd.DataFrame, issues: List[ValidationIssue]) -> Dict[str, Any]:
        """Create validation summary."""
        summary = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'total_issues': len(issues),
            'issues_by_severity': {
                'critical': len([i for i in issues if i.severity == ValidationSeverity.CRITICAL]),
                'error': len([i for i in issues if i.severity == ValidationSeverity.ERROR]),
                'warning': len([i for i in issues if i.severity == ValidationSeverity.WARNING]),
                'info': len([i for i in issues if i.severity == ValidationSeverity.INFO])
            },
            'data_quality_score': self._calculate_quality_score(df, issues),
            'completeness': self._calculate_completeness(df),
            'columns_analyzed': list(df.columns)
        }

        return summary

    def _calculate_quality_score(self, df: pd.DataFrame, issues: List[ValidationIssue]) -> float:
        """Calculate overall data quality score (0-100)."""
        if df.empty:
            return 0.0

        # Start with perfect score
        score = 100.0

        # Deduct points for different severity levels
        severity_weights = {
            ValidationSeverity.CRITICAL: 50,
            ValidationSeverity.ERROR: 20,
            ValidationSeverity.WARNING: 5,
            ValidationSeverity.INFO: 1
        }

        for issue in issues:
            weight = severity_weights.get(issue.severity, 1)
            deduction = weight * (issue.count / len(df)) * 100
            score -= min(deduction, weight)  # Cap deduction at weight value

        return max(score, 0.0)

    def _calculate_completeness(self, df: pd.DataFrame) -> float:
        """Calculate data completeness ratio."""
        if df.empty:
            return 0.0

        total_cells = df.size
        non_null_cells = df.count().sum()
        return non_null_cells / total_cells if total_cells > 0 else 0.0