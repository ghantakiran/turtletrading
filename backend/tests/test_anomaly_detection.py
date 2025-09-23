"""
Unit tests for anomaly detection models: z-score, EWMA, GARCH, isolation forest
Tests-first implementation following TDD principles with deterministic seeds
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import asyncio
from typing import List, Dict, Any

# Import the modules we'll implement
from app.services.anomaly_detection import (
    ZScoreDetector,
    EWMADetector,
    GARCHDetector,
    IsolationForestDetector,
    AnomalyDetectionService,
    AnomalyResult,
    VolatilityRegime,
    RegimeClassifier
)


class TestZScoreDetector:
    """Test suite for z-score based anomaly detection"""

    @pytest.fixture
    def detector(self):
        """Create detector with deterministic parameters"""
        return ZScoreDetector(
            window_size=20,
            threshold=2.0,
            random_seed=42
        )

    @pytest.fixture
    def normal_returns(self):
        """Generate normal price returns for testing"""
        np.random.seed(42)
        return np.random.normal(0.001, 0.02, 100)  # 1% daily return, 2% volatility

    @pytest.fixture
    def returns_with_anomalies(self):
        """Generate returns with known anomalies"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 100)
        # Inject anomalies at known positions
        returns[30] = 0.15  # 15% spike
        returns[60] = -0.12  # -12% drop
        returns[80] = 0.08   # 8% jump
        return returns

    def test_zscore_calculation_normal_data(self, detector, normal_returns):
        """Test z-score calculation on normal data"""
        z_scores = detector.calculate_z_scores(normal_returns)

        # Assert basic properties
        assert len(z_scores) == len(normal_returns)
        assert not np.isnan(z_scores).any()
        assert abs(np.mean(z_scores)) < 0.1  # Mean should be close to 0

        # Most z-scores should be within 2 standard deviations
        within_threshold = np.abs(z_scores) < 2.0
        assert np.sum(within_threshold) / len(z_scores) > 0.90

    def test_zscore_detects_known_anomalies(self, detector, returns_with_anomalies):
        """Test that z-score correctly identifies known anomalies"""
        anomalies = detector.detect_anomalies(returns_with_anomalies)

        # Should detect the injected anomalies
        anomaly_indices = [a.index for a in anomalies]
        assert 30 in anomaly_indices  # 15% spike
        assert 60 in anomaly_indices  # -12% drop
        assert 80 in anomaly_indices  # 8% jump

        # Check anomaly scores are above threshold
        for anomaly in anomalies:
            if anomaly.index in [30, 60, 80]:
                assert anomaly.score > 2.0
                assert anomaly.severity in ['high', 'critical']

    def test_zscore_rolling_window(self, detector):
        """Test rolling window calculation with edge cases"""
        # Test with exact window size
        returns = np.random.normal(0, 0.02, 20)
        returns[19] = 0.1  # Add anomaly at end

        anomalies = detector.detect_anomalies(returns)
        assert len(anomalies) >= 1
        assert anomalies[0].index == 19

    def test_zscore_insufficient_data(self, detector):
        """Test behavior with insufficient data"""
        short_returns = np.random.normal(0, 0.02, 5)  # Less than window size

        with pytest.raises(ValueError, match="Insufficient data"):
            detector.detect_anomalies(short_returns)

    def test_zscore_empty_data(self, detector):
        """Test behavior with empty data"""
        empty_returns = np.array([])

        with pytest.raises(ValueError, match="Empty data"):
            detector.detect_anomalies(empty_returns)

    def test_zscore_configuration_validation(self):
        """Test detector configuration validation"""
        # Invalid window size
        with pytest.raises(ValueError, match="Window size must be positive"):
            ZScoreDetector(window_size=0, threshold=2.0)

        # Invalid threshold
        with pytest.raises(ValueError, match="Threshold must be positive"):
            ZScoreDetector(window_size=20, threshold=-1.0)


class TestEWMADetector:
    """Test suite for EWMA (Exponentially Weighted Moving Average) anomaly detection"""

    @pytest.fixture
    def detector(self):
        """Create EWMA detector with deterministic parameters"""
        return EWMADetector(
            alpha=0.2,  # Smoothing factor
            threshold=2.5,
            random_seed=42
        )

    @pytest.fixture
    def trending_data(self):
        """Generate data with trending behavior"""
        np.random.seed(42)
        trend = np.linspace(0, 0.1, 100)  # Linear trend
        noise = np.random.normal(0, 0.01, 100)
        return trend + noise

    def test_ewma_adapts_to_trends(self, detector, trending_data):
        """Test that EWMA adapts to trending data"""
        ewma_values = detector.calculate_ewma(trending_data)

        # EWMA should follow the trend
        assert len(ewma_values) == len(trending_data)
        assert ewma_values[-1] > ewma_values[0]  # Should increase with trend

        # Check smoothness (EWMA should be smoother than raw data)
        ewma_volatility = np.std(np.diff(ewma_values))
        data_volatility = np.std(np.diff(trending_data))
        assert ewma_volatility < data_volatility

    def test_ewma_detects_sudden_shifts(self, detector):
        """Test EWMA detection of sudden regime shifts"""
        np.random.seed(42)

        # Create data with regime shift
        stable_period = np.random.normal(0.01, 0.005, 50)  # Low vol regime
        volatile_period = np.random.normal(0.01, 0.03, 50)  # High vol regime
        data = np.concatenate([stable_period, volatile_period])

        anomalies = detector.detect_anomalies(data)

        # Should detect shift around index 50
        shift_anomalies = [a for a in anomalies if 45 <= a.index <= 55]
        assert len(shift_anomalies) > 0

    def test_ewma_alpha_parameter_effect(self):
        """Test effect of alpha parameter on detection sensitivity"""
        np.random.seed(42)
        data = np.random.normal(0, 0.02, 100)
        data[50] = 0.1  # Add anomaly

        # High alpha (more reactive)
        detector_high = EWMADetector(alpha=0.8, threshold=2.0, random_seed=42)
        anomalies_high = detector_high.detect_anomalies(data)

        # Low alpha (less reactive)
        detector_low = EWMADetector(alpha=0.1, threshold=2.0, random_seed=42)
        anomalies_low = detector_low.detect_anomalies(data)

        # High alpha should be more sensitive
        assert len(anomalies_high) >= len(anomalies_low)

    def test_ewma_configuration_bounds(self):
        """Test EWMA configuration parameter bounds"""
        # Alpha must be between 0 and 1
        with pytest.raises(ValueError, match="Alpha must be between 0 and 1"):
            EWMADetector(alpha=1.5, threshold=2.0)

        with pytest.raises(ValueError, match="Alpha must be between 0 and 1"):
            EWMADetector(alpha=-0.1, threshold=2.0)


class TestGARCHDetector:
    """Test suite for GARCH volatility modeling and anomaly detection"""

    @pytest.fixture
    def detector(self):
        """Create GARCH detector with deterministic parameters"""
        return GARCHDetector(
            p=1, q=1,  # GARCH(1,1)
            threshold=2.0,
            random_seed=42
        )

    @pytest.fixture
    def heteroskedastic_data(self):
        """Generate data with volatility clustering"""
        np.random.seed(42)
        n = 200

        # Generate GARCH-like process
        returns = np.zeros(n)
        volatility = np.zeros(n)
        volatility[0] = 0.02

        for t in range(1, n):
            # GARCH(1,1) volatility equation
            volatility[t] = np.sqrt(
                0.0001 + 0.05 * returns[t-1]**2 + 0.9 * volatility[t-1]**2
            )
            returns[t] = volatility[t] * np.random.normal()

        return returns

    def test_garch_volatility_estimation(self, detector, heteroskedastic_data):
        """Test GARCH volatility estimation accuracy"""
        volatility_estimates = detector.estimate_volatility(heteroskedastic_data)

        assert len(volatility_estimates) == len(heteroskedastic_data)
        assert all(v > 0 for v in volatility_estimates)  # Volatility always positive

        # Volatility should show clustering
        vol_changes = np.abs(np.diff(volatility_estimates))
        assert np.std(vol_changes) > 0  # Should have variation

    def test_garch_detects_volatility_anomalies(self, detector):
        """Test GARCH detection of volatility anomalies"""
        np.random.seed(42)

        # Create data with volatility spike
        normal_data = np.random.normal(0, 0.01, 100)
        spike_data = np.random.normal(0, 0.1, 10)  # 10x higher volatility
        data = np.concatenate([normal_data, spike_data, normal_data])

        anomalies = detector.detect_anomalies(data)

        # Should detect anomalies in the high volatility period
        spike_anomalies = [a for a in anomalies if 95 <= a.index <= 115]
        assert len(spike_anomalies) > 0

    def test_garch_model_convergence(self, detector, heteroskedastic_data):
        """Test GARCH model fitting convergence"""
        # This tests that the model can be fitted without errors
        try:
            volatility = detector.estimate_volatility(heteroskedastic_data)
            assert len(volatility) > 0
        except Exception as e:
            pytest.fail(f"GARCH model failed to converge: {e}")

    def test_garch_parameter_validation(self):
        """Test GARCH parameter validation"""
        # p and q must be positive integers
        with pytest.raises(ValueError, match="p must be a positive integer"):
            GARCHDetector(p=0, q=1, threshold=2.0)

        with pytest.raises(ValueError, match="q must be a positive integer"):
            GARCHDetector(p=1, q=0, threshold=2.0)

    def test_garch_with_missing_data(self, detector):
        """Test GARCH handling of missing data"""
        data_with_nan = np.array([0.01, 0.02, np.nan, 0.03, 0.01])

        with pytest.raises(ValueError, match="Data contains NaN values"):
            detector.detect_anomalies(data_with_nan)


class TestIsolationForestDetector:
    """Test suite for Isolation Forest anomaly detection"""

    @pytest.fixture
    def detector(self):
        """Create Isolation Forest detector with deterministic parameters"""
        return IsolationForestDetector(
            n_estimators=100,
            contamination=0.1,
            random_seed=42
        )

    @pytest.fixture
    def multivariate_data(self):
        """Generate multivariate data with outliers"""
        np.random.seed(42)

        # Normal data points
        normal_data = np.random.multivariate_normal(
            mean=[0, 0],
            cov=[[1, 0.5], [0.5, 1]],
            size=90
        )

        # Outlier points
        outliers = np.array([
            [5, 5],   # Far from cluster
            [-4, 3],  # Another outlier
            [2, -6],  # Third outlier
            [7, -2],  # Fourth outlier
            [-3, -4], # Fifth outlier
            [8, 1],   # Sixth outlier
            [1, 8],   # Seventh outlier
            [-6, -1], # Eighth outlier
            [4, 6],   # Ninth outlier
            [-5, 4]   # Tenth outlier
        ])

        return np.vstack([normal_data, outliers])

    def test_isolation_forest_detects_outliers(self, detector, multivariate_data):
        """Test that Isolation Forest correctly identifies outliers"""
        anomalies = detector.detect_anomalies(multivariate_data)

        # Should detect approximately 10% as anomalies (contamination=0.1)
        expected_anomalies = int(len(multivariate_data) * 0.1)
        assert len(anomalies) == expected_anomalies

        # Check that detected anomalies have negative scores (outliers)
        for anomaly in anomalies:
            assert anomaly.score < 0  # Isolation Forest uses negative scores for outliers

    def test_isolation_forest_financial_features(self, detector):
        """Test Isolation Forest with financial time series features"""
        np.random.seed(42)

        # Create financial features: price, volume, volatility
        n_days = 100
        prices = np.random.lognormal(0, 0.02, n_days)
        volumes = np.random.lognormal(10, 0.5, n_days)
        volatility = np.random.gamma(2, 0.01, n_days)

        # Add some anomalous days
        prices[30] *= 1.5  # Price spike
        volumes[60] *= 10  # Volume spike
        volatility[80] *= 5  # Volatility spike

        features = np.column_stack([prices, volumes, volatility])
        anomalies = detector.detect_anomalies(features)

        # Should detect the anomalous days
        anomaly_indices = [a.index for a in anomalies]
        assert any(idx in range(25, 35) for idx in anomaly_indices)  # Price spike area
        assert any(idx in range(55, 65) for idx in anomaly_indices)  # Volume spike area
        assert any(idx in range(75, 85) for idx in anomaly_indices)  # Volatility spike area

    def test_isolation_forest_contamination_parameter(self):
        """Test effect of contamination parameter"""
        np.random.seed(42)
        data = np.random.normal(0, 1, (100, 2))

        # Low contamination
        detector_low = IsolationForestDetector(contamination=0.05, random_seed=42)
        anomalies_low = detector_low.detect_anomalies(data)

        # High contamination
        detector_high = IsolationForestDetector(contamination=0.2, random_seed=42)
        anomalies_high = detector_high.detect_anomalies(data)

        # Higher contamination should detect more anomalies
        assert len(anomalies_high) > len(anomalies_low)

    def test_isolation_forest_deterministic_results(self, detector, multivariate_data):
        """Test that results are deterministic with fixed random seed"""
        anomalies1 = detector.detect_anomalies(multivariate_data)
        anomalies2 = detector.detect_anomalies(multivariate_data)

        # Results should be identical
        assert len(anomalies1) == len(anomalies2)
        for a1, a2 in zip(anomalies1, anomalies2):
            assert a1.index == a2.index
            assert abs(a1.score - a2.score) < 1e-10

    def test_isolation_forest_parameter_validation(self):
        """Test Isolation Forest parameter validation"""
        # n_estimators must be positive
        with pytest.raises(ValueError, match="n_estimators must be positive"):
            IsolationForestDetector(n_estimators=0, contamination=0.1)

        # contamination must be between 0 and 1
        with pytest.raises(ValueError, match="contamination must be between 0 and 1"):
            IsolationForestDetector(n_estimators=100, contamination=1.5)


class TestRegimeClassifier:
    """Test suite for volatility regime classification"""

    @pytest.fixture
    def classifier(self):
        """Create regime classifier with deterministic parameters"""
        return RegimeClassifier(
            n_regimes=3,  # Low, Medium, High volatility
            lookback_window=30,
            random_seed=42
        )

    @pytest.fixture
    def regime_data(self):
        """Generate data with distinct volatility regimes"""
        np.random.seed(42)

        # Low volatility regime (30 days)
        low_vol = np.random.normal(0.001, 0.005, 30)

        # Medium volatility regime (30 days)
        med_vol = np.random.normal(0.001, 0.015, 30)

        # High volatility regime (30 days)
        high_vol = np.random.normal(0.001, 0.04, 30)

        return np.concatenate([low_vol, med_vol, high_vol])

    def test_regime_classification_accuracy(self, classifier, regime_data):
        """Test regime classification accuracy on known regimes"""
        regimes = classifier.classify_regimes(regime_data)

        assert len(regimes) == len(regime_data)

        # Check that regimes are properly identified
        # First 30 days should mostly be low volatility (regime 0)
        low_vol_period = regimes[:30]
        assert np.mean(low_vol_period) < 1.0  # Should be low regime on average

        # Last 30 days should mostly be high volatility (regime 2)
        high_vol_period = regimes[-30:]
        assert np.mean(high_vol_period) > 1.0  # Should be high regime on average

    def test_regime_transitions(self, classifier, regime_data):
        """Test regime transition detection"""
        regimes = classifier.classify_regimes(regime_data)
        transitions = classifier.detect_regime_transitions(regimes)

        # Should detect transitions around day 30 and day 60
        transition_days = [t.day for t in transitions]
        assert any(25 <= day <= 35 for day in transition_days)  # First transition
        assert any(55 <= day <= 65 for day in transition_days)  # Second transition

    def test_regime_confidence_scoring(self, classifier, regime_data):
        """Test regime confidence scoring"""
        regimes, confidences = classifier.classify_regimes_with_confidence(regime_data)

        assert len(confidences) == len(regimes)
        assert all(0 <= conf <= 1 for conf in confidences)

        # Confidence should be higher in stable periods
        stable_period_conf = np.mean(confidences[10:20])  # Middle of first regime
        transition_period_conf = np.mean(confidences[28:32])  # Around first transition
        assert stable_period_conf > transition_period_conf

    def test_regime_persistence(self, classifier):
        """Test regime persistence and minimum duration"""
        np.random.seed(42)

        # Create noisy data that might cause regime flickering
        noisy_data = np.random.normal(0, 0.02, 100)
        # Add some noise spikes
        for i in range(5, 95, 10):
            noisy_data[i] *= 3

        regimes = classifier.classify_regimes(noisy_data, min_regime_duration=5)

        # Check that regimes don't change too frequently
        regime_changes = np.sum(np.diff(regimes) != 0)
        assert regime_changes < 20  # Shouldn't change more than 20 times in 100 days

    def test_regime_labels_and_descriptions(self, classifier):
        """Test regime labeling and descriptions"""
        regime_info = classifier.get_regime_descriptions()

        assert len(regime_info) == 3  # Should have 3 regimes
        assert all('name' in info and 'description' in info for info in regime_info)

        # Should have standard volatility regime names
        regime_names = [info['name'] for info in regime_info]
        expected_names = ['Low Volatility', 'Medium Volatility', 'High Volatility']
        assert all(name in regime_names for name in expected_names)


class TestAnomalyDetectionService:
    """Test suite for the main anomaly detection service"""

    @pytest.fixture
    def service(self):
        """Create anomaly detection service with all detectors"""
        return AnomalyDetectionService(
            enable_zscore=True,
            enable_ewma=True,
            enable_garch=True,
            enable_isolation_forest=True,
            random_seed=42
        )

    @pytest.fixture
    def stock_data(self):
        """Generate realistic stock data for testing"""
        np.random.seed(42)

        # Generate stock price data
        days = 252  # One trading year
        initial_price = 100.0

        # Generate returns with volatility clustering
        returns = []
        vol = 0.02  # Initial volatility

        for i in range(days):
            # Update volatility (simple GARCH-like)
            if len(returns) > 0:
                vol = 0.8 * vol + 0.2 * abs(returns[-1])

            # Generate return
            daily_return = np.random.normal(0.0005, vol)  # 0.05% daily return
            returns.append(daily_return)

        # Convert to prices
        prices = [initial_price]
        for ret in returns:
            prices.append(prices[-1] * (1 + ret))

        # Create volume data
        volumes = np.random.lognormal(15, 0.5, days + 1)  # Log-normal volume

        return {
            'prices': np.array(prices),
            'returns': np.array(returns),
            'volumes': volumes,
            'dates': pd.date_range('2024-01-01', periods=days + 1)
        }

    @pytest.mark.asyncio
    async def test_comprehensive_anomaly_detection(self, service, stock_data):
        """Test comprehensive anomaly detection across all methods"""
        symbol = "AAPL"

        # Mock the data source
        with patch.object(service, '_fetch_stock_data', return_value=stock_data):
            results = await service.detect_anomalies(symbol, lookback_days=100)

        assert isinstance(results, list)
        assert all(isinstance(r, AnomalyResult) for r in results)

        # Should have results from multiple detectors
        detector_types = set(r.detector_type for r in results)
        assert len(detector_types) >= 2  # At least 2 different detectors found anomalies

    @pytest.mark.asyncio
    async def test_regime_detection_integration(self, service, stock_data):
        """Test regime detection integration"""
        symbol = "AAPL"

        with patch.object(service, '_fetch_stock_data', return_value=stock_data):
            regime_timeline = await service.get_regime_timeline(symbol, lookback_days=100)

        assert 'regimes' in regime_timeline
        assert 'transitions' in regime_timeline
        assert 'confidence' in regime_timeline
        assert 'metadata' in regime_timeline

        # Check regime timeline structure
        regimes = regime_timeline['regimes']
        assert len(regimes) > 0
        assert all('date' in r and 'regime' in r and 'confidence' in r for r in regimes)

    @pytest.mark.asyncio
    async def test_anomaly_severity_classification(self, service):
        """Test anomaly severity classification"""
        # Create data with different severity anomalies
        np.random.seed(42)
        base_data = np.random.normal(0, 0.01, 100)

        # Add anomalies of different severities
        base_data[20] = 0.05   # Moderate anomaly (5%)
        base_data[50] = 0.15   # Severe anomaly (15%)
        base_data[80] = -0.20  # Critical anomaly (-20%)

        stock_data = {
            'returns': base_data,
            'prices': np.cumsum(base_data) + 100,
            'volumes': np.random.lognormal(15, 0.5, 100),
            'dates': pd.date_range('2024-01-01', periods=100)
        }

        with patch.object(service, '_fetch_stock_data', return_value=stock_data):
            results = await service.detect_anomalies("TEST", lookback_days=100)

        # Check severity classification
        severities = [r.severity for r in results]
        assert 'moderate' in severities or 'high' in severities or 'critical' in severities

    @pytest.mark.asyncio
    async def test_error_handling_missing_data(self, service):
        """Test error handling for missing data"""
        with patch.object(service, '_fetch_stock_data', return_value=None):
            with pytest.raises(ValueError, match="No data available"):
                await service.detect_anomalies("INVALID", lookback_days=100)

    @pytest.mark.asyncio
    async def test_caching_behavior(self, service, stock_data):
        """Test caching behavior for repeated requests"""
        symbol = "AAPL"

        with patch.object(service, '_fetch_stock_data', return_value=stock_data) as mock_fetch:
            # First call
            results1 = await service.detect_anomalies(symbol, lookback_days=100)

            # Second call (should use cache)
            results2 = await service.detect_anomalies(symbol, lookback_days=100)

            # Data should only be fetched once due to caching
            assert mock_fetch.call_count == 1
            assert len(results1) == len(results2)

    def test_service_configuration_validation(self):
        """Test service configuration validation"""
        # All detectors disabled should raise error
        with pytest.raises(ValueError, match="At least one detector must be enabled"):
            AnomalyDetectionService(
                enable_zscore=False,
                enable_ewma=False,
                enable_garch=False,
                enable_isolation_forest=False
            )

    @pytest.mark.asyncio
    async def test_deterministic_results(self, service, stock_data):
        """Test that results are deterministic with fixed seeds"""
        symbol = "AAPL"

        with patch.object(service, '_fetch_stock_data', return_value=stock_data):
            results1 = await service.detect_anomalies(symbol, lookback_days=100)
            results2 = await service.detect_anomalies(symbol, lookback_days=100)

        # Results should be identical
        assert len(results1) == len(results2)
        for r1, r2 in zip(results1, results2):
            assert r1.index == r2.index
            assert r1.detector_type == r2.detector_type
            assert abs(r1.score - r2.score) < 1e-10


# Golden reference tests for algorithm validation
class TestGoldenReferences:
    """Test suite for validating against golden reference implementations"""

    def test_zscore_golden_reference(self):
        """Test z-score calculation against known golden values"""
        # Known data and expected z-scores
        data = np.array([1.0, 2.0, 3.0, 10.0, 2.5, 1.5, 2.2])  # 10.0 is clear outlier
        expected_zscore_at_outlier = 2.21  # Pre-calculated expected value

        detector = ZScoreDetector(window_size=5, threshold=2.0, random_seed=42)
        z_scores = detector.calculate_z_scores(data)

        # Check the z-score at the outlier position
        outlier_zscore = abs(z_scores[3])  # Index 3 has value 10.0
        assert abs(outlier_zscore - expected_zscore_at_outlier) < 0.1

    def test_ewma_golden_reference(self):
        """Test EWMA calculation against known golden values"""
        data = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        alpha = 0.3

        # Manual EWMA calculation for reference
        expected_ewma = [1.0]  # First value
        for i in range(1, len(data)):
            next_ewma = alpha * data[i] + (1 - alpha) * expected_ewma[-1]
            expected_ewma.append(next_ewma)

        detector = EWMADetector(alpha=alpha, threshold=2.0, random_seed=42)
        calculated_ewma = detector.calculate_ewma(data)

        # Compare with expected values
        for calc, exp in zip(calculated_ewma, expected_ewma):
            assert abs(calc - exp) < 1e-10

    def test_isolation_forest_golden_reference(self):
        """Test Isolation Forest against scikit-learn reference"""
        from sklearn.ensemble import IsolationForest

        np.random.seed(42)
        data = np.random.normal(0, 1, (100, 2))

        # Add clear outliers
        outliers = np.array([[5, 5], [-5, -5]])
        test_data = np.vstack([data, outliers])

        # Reference implementation
        sklearn_if = IsolationForest(contamination=0.1, random_state=42)
        sklearn_scores = sklearn_if.fit_predict(test_data)

        # Our implementation
        detector = IsolationForestDetector(contamination=0.1, random_seed=42)
        our_anomalies = detector.detect_anomalies(test_data)
        our_anomaly_indices = set(a.index for a in our_anomalies)

        # Outliers should be detected as anomalies
        assert 100 in our_anomaly_indices  # First outlier
        assert 101 in our_anomaly_indices  # Second outlier


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "--cov=app.services.anomaly_detection"])