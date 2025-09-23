"""
Anomaly Detection & Volatility Regimes System
Implements z-score spikes, EWMA, GARCH, isolation forest with regime classification
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import logging
from abc import ABC, abstractmethod

# External dependencies
from sklearn.ensemble import IsolationForest
from sklearn.mixture import GaussianMixture
from arch import arch_model
import warnings
warnings.filterwarnings('ignore')  # Suppress GARCH convergence warnings

# Internal dependencies
from app.core.cache import cache_manager
from app.services.stock_service import StockService
from app.models.schemas import StockData

logger = logging.getLogger(__name__)


class AnomalySeverity(Enum):
    """Anomaly severity levels"""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class VolatilityRegime(Enum):
    """Volatility regime classifications"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"


@dataclass
class AnomalyResult:
    """Result from anomaly detection"""
    index: int
    timestamp: datetime
    value: float
    score: float
    severity: AnomalySeverity
    detector_type: str
    description: str
    confidence: float


@dataclass
class RegimeTransition:
    """Volatility regime transition"""
    day: int
    timestamp: datetime
    from_regime: VolatilityRegime
    to_regime: VolatilityRegime
    confidence: float
    trigger_score: float


class BaseAnomalyDetector(ABC):
    """Abstract base class for anomaly detectors"""

    def __init__(self, threshold: float, random_seed: int = 42):
        self.threshold = threshold
        self.random_seed = random_seed
        np.random.seed(random_seed)

        if threshold <= 0:
            raise ValueError("Threshold must be positive")

    @abstractmethod
    def detect_anomalies(self, data: np.ndarray) -> List[AnomalyResult]:
        """Detect anomalies in the given data"""
        pass

    def _classify_severity(self, score: float) -> AnomalySeverity:
        """Classify anomaly severity based on score"""
        abs_score = abs(score)

        if abs_score >= 4.0:
            return AnomalySeverity.CRITICAL
        elif abs_score >= 3.0:
            return AnomalySeverity.HIGH
        elif abs_score >= 2.0:
            return AnomalySeverity.MODERATE
        else:
            return AnomalySeverity.LOW


class ZScoreDetector(BaseAnomalyDetector):
    """Z-score based anomaly detection for price spikes"""

    def __init__(self, window_size: int = 20, threshold: float = 2.0, random_seed: int = 42):
        super().__init__(threshold, random_seed)
        self.window_size = window_size

        if window_size <= 0:
            raise ValueError("Window size must be positive")

    def calculate_z_scores(self, data: np.ndarray) -> np.ndarray:
        """Calculate rolling z-scores"""
        if len(data) == 0:
            raise ValueError("Empty data")

        if len(data) < self.window_size:
            raise ValueError("Insufficient data for z-score calculation")

        z_scores = np.full(len(data), np.nan)

        # Calculate rolling z-scores
        for i in range(self.window_size - 1, len(data)):
            window_data = data[i - self.window_size + 1:i + 1]
            mean = np.mean(window_data[:-1])  # Exclude current point from mean
            std = np.std(window_data[:-1])

            if std > 0:
                z_scores[i] = (data[i] - mean) / std
            else:
                z_scores[i] = 0.0

        return z_scores

    def detect_anomalies(self, data: np.ndarray) -> List[AnomalyResult]:
        """Detect anomalies using z-score method"""
        if len(data) == 0:
            raise ValueError("Empty data")

        if len(data) < self.window_size:
            raise ValueError("Insufficient data")

        z_scores = self.calculate_z_scores(data)
        anomalies = []

        for i, (value, z_score) in enumerate(zip(data, z_scores)):
            if not np.isnan(z_score) and abs(z_score) > self.threshold:
                anomaly = AnomalyResult(
                    index=i,
                    timestamp=datetime.now() - timedelta(days=len(data) - i - 1),
                    value=value,
                    score=z_score,
                    severity=self._classify_severity(z_score),
                    detector_type="z_score",
                    description=f"Z-score spike: {z_score:.2f} (threshold: {self.threshold})",
                    confidence=min(abs(z_score) / self.threshold, 1.0)
                )
                anomalies.append(anomaly)

        return sorted(anomalies, key=lambda x: abs(x.score), reverse=True)


class EWMADetector(BaseAnomalyDetector):
    """Exponentially Weighted Moving Average anomaly detection"""

    def __init__(self, alpha: float = 0.2, threshold: float = 2.5, random_seed: int = 42):
        super().__init__(threshold, random_seed)
        self.alpha = alpha

        if not 0 < alpha <= 1:
            raise ValueError("Alpha must be between 0 and 1")

    def calculate_ewma(self, data: np.ndarray) -> np.ndarray:
        """Calculate Exponentially Weighted Moving Average"""
        if len(data) == 0:
            return np.array([])

        ewma = np.zeros(len(data))
        ewma[0] = data[0]

        for i in range(1, len(data)):
            ewma[i] = self.alpha * data[i] + (1 - self.alpha) * ewma[i - 1]

        return ewma

    def detect_anomalies(self, data: np.ndarray) -> List[AnomalyResult]:
        """Detect anomalies using EWMA deviation"""
        if len(data) < 2:
            return []

        ewma = self.calculate_ewma(data)
        deviations = data - ewma

        # Calculate EWMA of squared deviations for adaptive threshold
        squared_deviations = deviations ** 2
        ewma_var = self.calculate_ewma(squared_deviations)
        adaptive_std = np.sqrt(ewma_var)

        anomalies = []

        for i, (value, deviation, std) in enumerate(zip(data, deviations, adaptive_std)):
            if i > 0 and std > 0:  # Skip first point and avoid division by zero
                score = deviation / std

                if abs(score) > self.threshold:
                    anomaly = AnomalyResult(
                        index=i,
                        timestamp=datetime.now() - timedelta(days=len(data) - i - 1),
                        value=value,
                        score=score,
                        severity=self._classify_severity(score),
                        detector_type="ewma",
                        description=f"EWMA deviation: {score:.2f} (threshold: {self.threshold})",
                        confidence=min(abs(score) / self.threshold, 1.0)
                    )
                    anomalies.append(anomaly)

        return sorted(anomalies, key=lambda x: abs(x.score), reverse=True)


class GARCHDetector(BaseAnomalyDetector):
    """GARCH volatility modeling for anomaly detection"""

    def __init__(self, p: int = 1, q: int = 1, threshold: float = 2.0, random_seed: int = 42):
        super().__init__(threshold, random_seed)
        self.p = p
        self.q = q

        if p <= 0 or not isinstance(p, int):
            raise ValueError("p must be a positive integer")
        if q <= 0 or not isinstance(q, int):
            raise ValueError("q must be a positive integer")

    def estimate_volatility(self, returns: np.ndarray) -> np.ndarray:
        """Estimate volatility using GARCH model"""
        if len(returns) < 50:  # Minimum data for GARCH
            # Fallback to rolling standard deviation
            window = min(20, len(returns) // 2)
            return pd.Series(returns).rolling(window, min_periods=1).std().values

        # Check for NaN values
        if np.isnan(returns).any():
            raise ValueError("Data contains NaN values")

        try:
            # Fit GARCH model
            model = arch_model(
                returns * 100,  # Scale for numerical stability
                vol='Garch',
                p=self.p,
                q=self.q,
                rescale=False
            )

            # Fit with suppressed output
            fitted_model = model.fit(disp='off', show_warning=False)

            # Extract conditional volatility
            volatility = fitted_model.conditional_volatility / 100  # Scale back

            return volatility.values

        except Exception as e:
            logger.warning(f"GARCH model fitting failed: {e}. Using rolling volatility.")
            # Fallback to rolling standard deviation
            window = min(20, len(returns) // 2)
            return pd.Series(returns).rolling(window, min_periods=1).std().values

    def detect_anomalies(self, returns: np.ndarray) -> List[AnomalyResult]:
        """Detect volatility anomalies using GARCH model"""
        if len(returns) < 10:
            return []

        volatility = self.estimate_volatility(returns)

        # Calculate standardized residuals
        standardized_residuals = returns / volatility

        # Detect anomalies in standardized residuals
        anomalies = []

        for i, (ret, vol, std_res) in enumerate(zip(returns, volatility, standardized_residuals)):
            if abs(std_res) > self.threshold:
                anomaly = AnomalyResult(
                    index=i,
                    timestamp=datetime.now() - timedelta(days=len(returns) - i - 1),
                    value=ret,
                    score=std_res,
                    severity=self._classify_severity(std_res),
                    detector_type="garch",
                    description=f"GARCH volatility anomaly: {std_res:.2f} (vol: {vol:.4f})",
                    confidence=min(abs(std_res) / self.threshold, 1.0)
                )
                anomalies.append(anomaly)

        return sorted(anomalies, key=lambda x: abs(x.score), reverse=True)


class IsolationForestDetector(BaseAnomalyDetector):
    """Isolation Forest for multivariate anomaly detection"""

    def __init__(self, n_estimators: int = 100, contamination: float = 0.1,
                 threshold: float = -0.5, random_seed: int = 42):
        super().__init__(threshold, random_seed)
        self.n_estimators = n_estimators
        self.contamination = contamination

        if n_estimators <= 0:
            raise ValueError("n_estimators must be positive")
        if not 0 < contamination < 1:
            raise ValueError("contamination must be between 0 and 1")

    def detect_anomalies(self, data: np.ndarray) -> List[AnomalyResult]:
        """Detect anomalies using Isolation Forest"""
        if len(data) < 10:
            return []

        # Ensure data is 2D
        if data.ndim == 1:
            data = data.reshape(-1, 1)

        # Fit Isolation Forest
        isolation_forest = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_seed
        )

        # Fit and predict
        predictions = isolation_forest.fit_predict(data)
        scores = isolation_forest.score_samples(data)

        anomalies = []

        for i, (prediction, score) in enumerate(zip(predictions, scores)):
            if prediction == -1:  # Anomaly detected
                # For multivariate data, use the first feature as representative value
                value = data[i, 0] if data.ndim > 1 else data[i]

                anomaly = AnomalyResult(
                    index=i,
                    timestamp=datetime.now() - timedelta(days=len(data) - i - 1),
                    value=value,
                    score=score,
                    severity=self._classify_severity(abs(score) * 4),  # Scale for severity
                    detector_type="isolation_forest",
                    description=f"Isolation Forest anomaly: {score:.3f}",
                    confidence=min(abs(score - self.threshold) / abs(self.threshold), 1.0)
                )
                anomalies.append(anomaly)

        return sorted(anomalies, key=lambda x: abs(x.score), reverse=True)


class RegimeClassifier:
    """Volatility regime classification using Gaussian Mixture Models"""

    def __init__(self, n_regimes: int = 3, lookback_window: int = 30, random_seed: int = 42):
        self.n_regimes = n_regimes
        self.lookback_window = lookback_window
        self.random_seed = random_seed
        np.random.seed(random_seed)

        self.regime_names = {
            0: "Low Volatility",
            1: "Medium Volatility",
            2: "High Volatility",
            3: "Extreme Volatility"
        }

        self.regime_descriptions = {
            0: "Stable market conditions with low volatility",
            1: "Normal market conditions with moderate volatility",
            2: "Elevated volatility indicating increased uncertainty",
            3: "Extreme volatility indicating market stress"
        }

    def _calculate_volatility_features(self, returns: np.ndarray) -> np.ndarray:
        """Calculate volatility features for regime classification"""
        if len(returns) < self.lookback_window:
            # Use all available data if insufficient
            window = len(returns)
        else:
            window = self.lookback_window

        features = []

        for i in range(window - 1, len(returns)):
            window_returns = returns[max(0, i - window + 1):i + 1]

            # Calculate multiple volatility measures
            realized_vol = np.std(window_returns)
            absolute_returns = np.mean(np.abs(window_returns))
            range_vol = np.max(window_returns) - np.min(window_returns)
            skewness = self._calculate_skewness(window_returns)
            kurtosis = self._calculate_kurtosis(window_returns)

            features.append([realized_vol, absolute_returns, range_vol, skewness, kurtosis])

        return np.array(features)

    def _calculate_skewness(self, data: np.ndarray) -> float:
        """Calculate skewness"""
        if len(data) < 3:
            return 0.0

        mean = np.mean(data)
        std = np.std(data)

        if std == 0:
            return 0.0

        return np.mean(((data - mean) / std) ** 3)

    def _calculate_kurtosis(self, data: np.ndarray) -> float:
        """Calculate excess kurtosis"""
        if len(data) < 4:
            return 0.0

        mean = np.mean(data)
        std = np.std(data)

        if std == 0:
            return 0.0

        return np.mean(((data - mean) / std) ** 4) - 3  # Excess kurtosis

    def classify_regimes(self, returns: np.ndarray, min_regime_duration: int = 3) -> np.ndarray:
        """Classify volatility regimes"""
        if len(returns) < self.lookback_window:
            # Default to medium volatility for insufficient data
            return np.ones(len(returns), dtype=int)

        # Calculate features
        features = self._calculate_volatility_features(returns)

        # Fit Gaussian Mixture Model
        gmm = GaussianMixture(
            n_components=min(self.n_regimes, len(features)),
            random_state=self.random_seed,
            covariance_type='full',
            max_iter=100
        )

        try:
            gmm.fit(features)
            regimes = gmm.predict(features)

            # Sort regimes by volatility level (regime 0 = lowest vol)
            regime_vols = []
            for regime in range(self.n_regimes):
                regime_mask = regimes == regime
                if np.any(regime_mask):
                    avg_vol = np.mean(features[regime_mask, 0])  # First feature is realized vol
                    regime_vols.append((regime, avg_vol))

            # Sort by volatility and reassign regime labels
            regime_vols.sort(key=lambda x: x[1])
            regime_mapping = {old: new for new, (old, _) in enumerate(regime_vols)}

            # Apply mapping
            mapped_regimes = np.array([regime_mapping[r] for r in regimes])

            # Pad the beginning with the first regime
            full_regimes = np.full(len(returns), mapped_regimes[0])
            start_idx = len(returns) - len(mapped_regimes)
            full_regimes[start_idx:] = mapped_regimes

            # Apply minimum duration filter
            if min_regime_duration > 1:
                full_regimes = self._apply_min_duration_filter(full_regimes, min_regime_duration)

            return full_regimes

        except Exception as e:
            logger.warning(f"Regime classification failed: {e}. Using default regimes.")
            # Fallback: classify based on simple volatility thresholds
            rolling_vol = pd.Series(returns).rolling(self.lookback_window, min_periods=1).std()
            vol_percentiles = np.percentile(rolling_vol, [33, 67])

            regimes = np.zeros(len(returns), dtype=int)
            regimes[rolling_vol > vol_percentiles[1]] = 2  # High vol
            regimes[(rolling_vol > vol_percentiles[0]) & (rolling_vol <= vol_percentiles[1])] = 1  # Med vol
            # Low vol remains 0

            return regimes

    def _apply_min_duration_filter(self, regimes: np.ndarray, min_duration: int) -> np.ndarray:
        """Apply minimum duration filter to reduce regime flickering"""
        filtered_regimes = regimes.copy()

        i = 0
        while i < len(regimes):
            current_regime = regimes[i]
            duration = 1

            # Count consecutive occurrences
            while i + duration < len(regimes) and regimes[i + duration] == current_regime:
                duration += 1

            # If duration is too short, replace with neighboring regime
            if duration < min_duration and i > 0 and i + duration < len(regimes):
                # Use the regime that appears more frequently among neighbors
                prev_regime = regimes[i - 1]
                next_regime = regimes[i + duration] if i + duration < len(regimes) else prev_regime

                replacement_regime = prev_regime  # Default to previous
                if next_regime == prev_regime:
                    replacement_regime = prev_regime

                filtered_regimes[i:i + duration] = replacement_regime

            i += duration

        return filtered_regimes

    def classify_regimes_with_confidence(self, returns: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Classify regimes and return confidence scores"""
        if len(returns) < self.lookback_window:
            regimes = np.ones(len(returns), dtype=int)
            confidences = np.ones(len(returns)) * 0.5
            return regimes, confidences

        features = self._calculate_volatility_features(returns)

        # Fit GMM
        gmm = GaussianMixture(
            n_components=min(self.n_regimes, len(features)),
            random_state=self.random_seed,
            covariance_type='full'
        )

        try:
            gmm.fit(features)
            regimes = gmm.predict(features)

            # Get prediction probabilities
            probabilities = gmm.predict_proba(features)
            confidences = np.max(probabilities, axis=1)

            # Pad the beginning
            full_regimes = np.full(len(returns), regimes[0])
            full_confidences = np.full(len(returns), 0.5)

            start_idx = len(returns) - len(regimes)
            full_regimes[start_idx:] = regimes
            full_confidences[start_idx:] = confidences

            return full_regimes, full_confidences

        except Exception as e:
            logger.warning(f"Regime classification with confidence failed: {e}")
            regimes = np.ones(len(returns), dtype=int)
            confidences = np.ones(len(returns)) * 0.5
            return regimes, confidences

    def detect_regime_transitions(self, regimes: np.ndarray) -> List[RegimeTransition]:
        """Detect regime transitions"""
        transitions = []

        for i in range(1, len(regimes)):
            if regimes[i] != regimes[i - 1]:
                transition = RegimeTransition(
                    day=i,
                    timestamp=datetime.now() - timedelta(days=len(regimes) - i - 1),
                    from_regime=VolatilityRegime(list(VolatilityRegime)[regimes[i - 1]].value),
                    to_regime=VolatilityRegime(list(VolatilityRegime)[regimes[i]].value),
                    confidence=0.8,  # Default confidence
                    trigger_score=abs(regimes[i] - regimes[i - 1])
                )
                transitions.append(transition)

        return transitions

    def get_regime_descriptions(self) -> List[Dict[str, str]]:
        """Get regime descriptions"""
        return [
            {
                'id': i,
                'name': self.regime_names.get(i, f"Regime {i}"),
                'description': self.regime_descriptions.get(i, f"Volatility regime {i}")
            }
            for i in range(self.n_regimes)
        ]


class AnomalyDetectionService:
    """Main service for anomaly detection and regime classification"""

    def __init__(self,
                 enable_zscore: bool = True,
                 enable_ewma: bool = True,
                 enable_garch: bool = True,
                 enable_isolation_forest: bool = True,
                 random_seed: int = 42):

        if not any([enable_zscore, enable_ewma, enable_garch, enable_isolation_forest]):
            raise ValueError("At least one detector must be enabled")

        self.random_seed = random_seed
        self.stock_service = StockService()

        # Initialize detectors
        self.detectors = {}

        if enable_zscore:
            self.detectors['zscore'] = ZScoreDetector(
                window_size=20,
                threshold=2.0,
                random_seed=random_seed
            )

        if enable_ewma:
            self.detectors['ewma'] = EWMADetector(
                alpha=0.2,
                threshold=2.5,
                random_seed=random_seed
            )

        if enable_garch:
            self.detectors['garch'] = GARCHDetector(
                p=1, q=1,
                threshold=2.0,
                random_seed=random_seed
            )

        if enable_isolation_forest:
            self.detectors['isolation_forest'] = IsolationForestDetector(
                n_estimators=100,
                contamination=0.1,
                random_seed=random_seed
            )

        # Initialize regime classifier
        self.regime_classifier = RegimeClassifier(
            n_regimes=3,
            lookback_window=30,
            random_seed=random_seed
        )

        # Cache for recent results
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes

    async def _fetch_stock_data(self, symbol: str, lookback_days: int) -> Optional[Dict[str, Any]]:
        """Fetch stock data for analysis"""
        try:
            # Get price history
            end_date = datetime.now()
            start_date = end_date - timedelta(days=lookback_days)

            price_data = await self.stock_service.get_price_history(
                symbol, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')
            )

            if not price_data:
                return None

            # Convert to numpy arrays
            prices = np.array([p['close'] for p in price_data])
            volumes = np.array([p['volume'] for p in price_data])
            dates = [datetime.fromisoformat(p['date']) for p in price_data]

            # Calculate returns
            returns = np.diff(np.log(prices))  # Log returns

            return {
                'prices': prices,
                'returns': returns,
                'volumes': volumes,
                'dates': dates
            }

        except Exception as e:
            logger.error(f"Failed to fetch stock data for {symbol}: {e}")
            return None

    @cache_manager.cached(ttl=300, key_prefix="anomaly_detection")
    async def detect_anomalies(self, symbol: str, lookback_days: int = 100) -> List[AnomalyResult]:
        """Detect anomalies using all enabled detectors"""
        stock_data = await self._fetch_stock_data(symbol, lookback_days)

        if not stock_data:
            raise ValueError(f"No data available for symbol {symbol}")

        returns = stock_data['returns']
        prices = stock_data['prices']
        volumes = stock_data['volumes']

        all_anomalies = []

        # Run z-score detection on returns
        if 'zscore' in self.detectors:
            try:
                zscore_anomalies = self.detectors['zscore'].detect_anomalies(returns)
                all_anomalies.extend(zscore_anomalies)
            except Exception as e:
                logger.warning(f"Z-score detection failed: {e}")

        # Run EWMA detection on returns
        if 'ewma' in self.detectors:
            try:
                ewma_anomalies = self.detectors['ewma'].detect_anomalies(returns)
                all_anomalies.extend(ewma_anomalies)
            except Exception as e:
                logger.warning(f"EWMA detection failed: {e}")

        # Run GARCH detection on returns
        if 'garch' in self.detectors:
            try:
                garch_anomalies = self.detectors['garch'].detect_anomalies(returns)
                all_anomalies.extend(garch_anomalies)
            except Exception as e:
                logger.warning(f"GARCH detection failed: {e}")

        # Run Isolation Forest on multivariate features
        if 'isolation_forest' in self.detectors:
            try:
                # Create multivariate features: returns, volume changes, price changes
                price_changes = np.diff(prices) / prices[:-1]  # Percentage price changes
                volume_changes = np.diff(np.log(volumes))  # Log volume changes

                # Ensure all arrays have the same length
                min_len = min(len(returns), len(price_changes), len(volume_changes))
                features = np.column_stack([
                    returns[:min_len],
                    price_changes[:min_len],
                    volume_changes[:min_len]
                ])

                isolation_anomalies = self.detectors['isolation_forest'].detect_anomalies(features)
                all_anomalies.extend(isolation_anomalies)
            except Exception as e:
                logger.warning(f"Isolation Forest detection failed: {e}")

        # Sort by severity and score
        all_anomalies.sort(key=lambda x: (x.severity.value, abs(x.score)), reverse=True)

        return all_anomalies

    @cache_manager.cached(ttl=300, key_prefix="regime_timeline")
    async def get_regime_timeline(self, symbol: str, lookback_days: int = 100) -> Dict[str, Any]:
        """Get volatility regime timeline with confidence"""
        stock_data = await self._fetch_stock_data(symbol, lookback_days)

        if not stock_data:
            raise ValueError(f"No data available for symbol {symbol}")

        returns = stock_data['returns']
        dates = stock_data['dates'][1:]  # Skip first date due to returns calculation

        # Classify regimes
        regimes, confidences = self.regime_classifier.classify_regimes_with_confidence(returns)

        # Detect transitions
        transitions = self.regime_classifier.detect_regime_transitions(regimes)

        # Build timeline
        regime_timeline = []
        for i, (regime, confidence, date) in enumerate(zip(regimes, confidences, dates)):
            regime_timeline.append({
                'date': date.isoformat(),
                'regime': int(regime),
                'regime_name': self.regime_classifier.regime_names.get(regime, f"Regime {regime}"),
                'confidence': float(confidence)
            })

        # Format transitions
        transition_list = []
        for transition in transitions:
            transition_list.append({
                'date': transition.timestamp.isoformat(),
                'from_regime': transition.from_regime.value,
                'to_regime': transition.to_regime.value,
                'confidence': transition.confidence
            })

        return {
            'symbol': symbol,
            'regimes': regime_timeline,
            'transitions': transition_list,
            'confidence': float(np.mean(confidences)),
            'metadata': {
                'lookback_days': lookback_days,
                'n_regimes': self.regime_classifier.n_regimes,
                'regime_descriptions': self.regime_classifier.get_regime_descriptions()
            }
        }

    async def get_current_regime(self, symbol: str) -> Dict[str, Any]:
        """Get current volatility regime for a symbol"""
        timeline = await self.get_regime_timeline(symbol, lookback_days=30)

        if not timeline['regimes']:
            return {'regime': 'unknown', 'confidence': 0.0}

        latest = timeline['regimes'][-1]
        return {
            'regime': latest['regime_name'],
            'regime_id': latest['regime'],
            'confidence': latest['confidence'],
            'timestamp': latest['date']
        }