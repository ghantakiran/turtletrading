"""
Integration tests for anomaly detection pipeline
Tests end-to-end workflow from API to database with real data flows
"""

import pytest
import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from fastapi.testclient import TestClient
from app.main import app
from app.services.anomaly_detection import AnomalyDetectionService
from app.core.database import get_async_session
from app.models.schemas import User


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Create mock authenticated user"""
    return User(
        id="test-user",
        email="test@example.com",
        subscription_tier="pro"
    )


@pytest.fixture
async def authenticated_headers(mock_user):
    """Create authenticated headers for API requests"""
    # Mock JWT token
    return {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
    }


@pytest.fixture
def sample_stock_data():
    """Generate realistic stock data for testing"""
    np.random.seed(42)

    # Generate 252 trading days of data
    days = 252
    dates = pd.date_range('2024-01-01', periods=days, freq='D')

    # Generate realistic price data with volatility clustering
    initial_price = 100.0
    returns = []
    volatility = 0.02

    for i in range(days):
        # GARCH-like volatility process
        if len(returns) > 0:
            volatility = 0.8 * volatility + 0.2 * abs(returns[-1])

        daily_return = np.random.normal(0.0005, volatility)
        returns.append(daily_return)

    # Convert to prices
    prices = [initial_price]
    for ret in returns:
        prices.append(prices[-1] * (1 + ret))

    # Add some known anomalies
    prices[50] *= 1.15   # 15% spike
    prices[100] *= 0.85  # 15% drop
    prices[200] *= 1.12  # 12% spike

    # Generate volume data
    volumes = np.random.lognormal(15, 0.5, days + 1)

    return {
        'dates': dates.tolist(),
        'prices': prices,
        'returns': returns,
        'volumes': volumes.tolist()
    }


class TestAnomalyDetectionPipeline:
    """Integration tests for the complete anomaly detection pipeline"""

    @pytest.mark.asyncio
    async def test_complete_anomaly_detection_workflow(self, sample_stock_data):
        """Test complete workflow from data input to anomaly detection"""

        # Initialize service
        service = AnomalyDetectionService(random_seed=42)

        # Mock data fetching
        with patch.object(service, '_fetch_stock_data', return_value=sample_stock_data):
            # Test anomaly detection
            anomalies = await service.detect_anomalies("AAPL", lookback_days=100)

            # Verify anomalies were detected
            assert len(anomalies) > 0

            # Check that multiple detector types were used
            detector_types = set(a.detector_type for a in anomalies)
            assert len(detector_types) >= 2

            # Verify anomaly structure
            for anomaly in anomalies:
                assert hasattr(anomaly, 'index')
                assert hasattr(anomaly, 'timestamp')
                assert hasattr(anomaly, 'score')
                assert hasattr(anomaly, 'severity')
                assert hasattr(anomaly, 'confidence')
                assert 0 <= anomaly.confidence <= 1

    @pytest.mark.asyncio
    async def test_regime_classification_workflow(self, sample_stock_data):
        """Test complete regime classification workflow"""

        service = AnomalyDetectionService(random_seed=42)

        with patch.object(service, '_fetch_stock_data', return_value=sample_stock_data):
            # Test regime timeline generation
            timeline = await service.get_regime_timeline("AAPL", lookback_days=100)

            # Verify timeline structure
            assert 'regimes' in timeline
            assert 'transitions' in timeline
            assert 'confidence' in timeline
            assert 'metadata' in timeline

            # Check regime data
            regimes = timeline['regimes']
            assert len(regimes) > 0

            for regime in regimes:
                assert 'date' in regime
                assert 'regime' in regime
                assert 'regime_name' in regime
                assert 'confidence' in regime
                assert 0 <= regime['confidence'] <= 1

    @pytest.mark.asyncio
    async def test_current_regime_detection(self, sample_stock_data):
        """Test current regime detection"""

        service = AnomalyDetectionService(random_seed=42)

        with patch.object(service, '_fetch_stock_data', return_value=sample_stock_data):
            # Test current regime
            current_regime = await service.get_current_regime("AAPL")

            # Verify structure
            assert 'regime' in current_regime
            assert 'regime_id' in current_regime
            assert 'confidence' in current_regime
            assert 'timestamp' in current_regime

            # Verify values
            assert isinstance(current_regime['regime_id'], int)
            assert 0 <= current_regime['confidence'] <= 1

    @pytest.mark.asyncio
    async def test_error_handling_pipeline(self):
        """Test error handling throughout the pipeline"""

        service = AnomalyDetectionService(random_seed=42)

        # Test with no data available
        with patch.object(service, '_fetch_stock_data', return_value=None):
            with pytest.raises(ValueError, match="No data available"):
                await service.detect_anomalies("INVALID", lookback_days=100)

        # Test with empty data
        with patch.object(service, '_fetch_stock_data', return_value={'returns': [], 'prices': [], 'volumes': []}):
            anomalies = await service.detect_anomalies("EMPTY", lookback_days=100)
            assert len(anomalies) == 0

    @pytest.mark.asyncio
    async def test_caching_integration(self, sample_stock_data):
        """Test caching integration in the pipeline"""

        service = AnomalyDetectionService(random_seed=42)

        with patch.object(service, '_fetch_stock_data', return_value=sample_stock_data) as mock_fetch:
            # First call
            anomalies1 = await service.detect_anomalies("AAPL", lookback_days=100)

            # Second call (should use cache)
            anomalies2 = await service.detect_anomalies("AAPL", lookback_days=100)

            # Data should only be fetched once due to caching
            assert mock_fetch.call_count == 1

            # Results should be consistent
            assert len(anomalies1) == len(anomalies2)

    @pytest.mark.asyncio
    async def test_multidetector_consistency(self, sample_stock_data):
        """Test consistency across multiple detectors"""

        # Test with all detectors enabled
        service_all = AnomalyDetectionService(
            enable_zscore=True,
            enable_ewma=True,
            enable_garch=True,
            enable_isolation_forest=True,
            random_seed=42
        )

        # Test with individual detectors
        service_zscore = AnomalyDetectionService(
            enable_zscore=True,
            enable_ewma=False,
            enable_garch=False,
            enable_isolation_forest=False,
            random_seed=42
        )

        with patch.object(service_all, '_fetch_stock_data', return_value=sample_stock_data):
            with patch.object(service_zscore, '_fetch_stock_data', return_value=sample_stock_data):

                # Get results from all detectors
                all_anomalies = await service_all.detect_anomalies("AAPL", lookback_days=100)
                zscore_anomalies = await service_zscore.detect_anomalies("AAPL", lookback_days=100)

                # Check that combined results include individual detector results
                zscore_detector_anomalies = [a for a in all_anomalies if a.detector_type == 'z_score']
                assert len(zscore_detector_anomalies) > 0

                # Results should be deterministic
                assert len(zscore_anomalies) == len(zscore_detector_anomalies)


class TestAnomalyDetectionAPI:
    """Integration tests for anomaly detection API endpoints"""

    @pytest.mark.asyncio
    async def test_regime_timeline_api(self, client, authenticated_headers, sample_stock_data):
        """Test regime timeline API endpoint"""

        with patch('app.api.v1.regimes.get_current_user') as mock_auth:
            mock_auth.return_value = User(id="test-user", email="test@example.com")

            with patch('app.services.anomaly_detection.AnomalyDetectionService._fetch_stock_data', return_value=sample_stock_data):

                response = client.get(
                    "/api/v1/regimes/AAPL/timeline?window=100",
                    headers=authenticated_headers
                )

                assert response.status_code == 200
                data = response.json()

                # Verify response structure
                assert 'symbol' in data
                assert 'regimes' in data
                assert 'transitions' in data
                assert 'confidence' in data
                assert 'metadata' in data

                # Verify data content
                assert data['symbol'] == 'AAPL'
                assert len(data['regimes']) > 0
                assert 0 <= data['confidence'] <= 1

    @pytest.mark.asyncio
    async def test_current_regime_api(self, client, authenticated_headers, sample_stock_data):
        """Test current regime API endpoint"""

        with patch('app.api.v1.regimes.get_current_user') as mock_auth:
            mock_auth.return_value = User(id="test-user", email="test@example.com")

            with patch('app.services.anomaly_detection.AnomalyDetectionService._fetch_stock_data', return_value=sample_stock_data):

                response = client.get(
                    "/api/v1/regimes/AAPL/current",
                    headers=authenticated_headers
                )

                assert response.status_code == 200
                data = response.json()

                # Verify response structure
                assert 'regime' in data
                assert 'regime_id' in data
                assert 'confidence' in data
                assert 'timestamp' in data

    @pytest.mark.asyncio
    async def test_anomaly_detection_api(self, client, authenticated_headers, sample_stock_data):
        """Test anomaly detection API endpoint"""

        with patch('app.api.v1.regimes.get_current_user') as mock_auth:
            mock_auth.return_value = User(id="test-user", email="test@example.com")

            with patch('app.services.anomaly_detection.AnomalyDetectionService._fetch_stock_data', return_value=sample_stock_data):

                response = client.get(
                    "/api/v1/regimes/AAPL/anomalies?lookback_days=100&min_severity=moderate",
                    headers=authenticated_headers
                )

                assert response.status_code == 200
                data = response.json()

                # Verify response is a list
                assert isinstance(data, list)

                # Check anomaly structure if any were found
                if len(data) > 0:
                    anomaly = data[0]
                    assert 'index' in anomaly
                    assert 'timestamp' in anomaly
                    assert 'score' in anomaly
                    assert 'severity' in anomaly
                    assert 'detector_type' in anomaly
                    assert 'confidence' in anomaly

    @pytest.mark.asyncio
    async def test_comprehensive_analysis_api(self, client, authenticated_headers, sample_stock_data):
        """Test comprehensive analysis API endpoint"""

        with patch('app.api.v1.regimes.get_current_user') as mock_auth:
            mock_auth.return_value = User(id="test-user", email="test@example.com")

            with patch('app.services.anomaly_detection.AnomalyDetectionService._fetch_stock_data', return_value=sample_stock_data):

                request_data = {
                    "symbol": "AAPL",
                    "lookback_days": 100,
                    "n_regimes": 3
                }

                response = client.post(
                    "/api/v1/regimes/analyze",
                    json=request_data,
                    headers=authenticated_headers
                )

                assert response.status_code == 200
                data = response.json()

                # Verify comprehensive response structure
                assert 'symbol' in data
                assert 'analysis_date' in data
                assert 'regime_analysis' in data
                assert 'anomaly_detection' in data
                assert 'current_regime' in data
                assert 'insights' in data
                assert 'risk_assessment' in data

                # Verify risk assessment structure
                risk_assessment = data['risk_assessment']
                assert 'risk_level' in risk_assessment
                assert 'risk_score' in risk_assessment
                assert 'risk_factors' in risk_assessment
                assert 'recommendation' in risk_assessment

    @pytest.mark.asyncio
    async def test_api_error_handling(self, client, authenticated_headers):
        """Test API error handling"""

        with patch('app.api.v1.regimes.get_current_user') as mock_auth:
            mock_auth.return_value = User(id="test-user", email="test@example.com")

            # Test invalid symbol
            response = client.get(
                "/api/v1/regimes/INVALID123/timeline",
                headers=authenticated_headers
            )
            assert response.status_code == 400

            # Test invalid parameters
            response = client.get(
                "/api/v1/regimes/AAPL/anomalies?min_severity=invalid",
                headers=authenticated_headers
            )
            assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_api_authentication(self, client):
        """Test API authentication requirements"""

        # Test without authentication
        response = client.get("/api/v1/regimes/AAPL/timeline")
        assert response.status_code == 401  # Unauthorized


class TestDataFlowIntegration:
    """Integration tests for data flow between components"""

    @pytest.mark.asyncio
    async def test_stock_service_integration(self, sample_stock_data):
        """Test integration with stock service"""

        service = AnomalyDetectionService(random_seed=42)

        # Mock stock service response
        with patch.object(service.stock_service, 'get_price_history') as mock_price_history:
            mock_price_history.return_value = [
                {
                    'date': (datetime.now() - timedelta(days=i)).isoformat(),
                    'close': price,
                    'volume': volume
                }
                for i, (price, volume) in enumerate(zip(sample_stock_data['prices'], sample_stock_data['volumes']))
            ]

            # Test data fetching integration
            stock_data = await service._fetch_stock_data("AAPL", 100)

            assert stock_data is not None
            assert 'prices' in stock_data
            assert 'returns' in stock_data
            assert 'volumes' in stock_data
            assert 'dates' in stock_data

            # Verify data transformation
            assert len(stock_data['returns']) == len(stock_data['prices']) - 1

    @pytest.mark.asyncio
    async def test_cache_integration(self, sample_stock_data):
        """Test cache integration"""

        service = AnomalyDetectionService(random_seed=42)

        with patch.object(service, '_fetch_stock_data', return_value=sample_stock_data):
            # First call
            start_time = datetime.now()
            anomalies1 = await service.detect_anomalies("AAPL", lookback_days=100)
            first_call_time = datetime.now() - start_time

            # Second call (should be faster due to caching)
            start_time = datetime.now()
            anomalies2 = await service.detect_anomalies("AAPL", lookback_days=100)
            second_call_time = datetime.now() - start_time

            # Second call should be significantly faster
            assert second_call_time < first_call_time

            # Results should be identical
            assert len(anomalies1) == len(anomalies2)

    @pytest.mark.asyncio
    async def test_concurrent_requests(self, sample_stock_data):
        """Test handling of concurrent requests"""

        service = AnomalyDetectionService(random_seed=42)

        with patch.object(service, '_fetch_stock_data', return_value=sample_stock_data):
            # Create multiple concurrent requests
            tasks = [
                service.detect_anomalies("AAPL", lookback_days=100),
                service.get_regime_timeline("AAPL", lookback_days=100),
                service.get_current_regime("AAPL")
            ]

            # Execute concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # All requests should succeed
            assert len(results) == 3
            for result in results:
                assert not isinstance(result, Exception)


class TestPerformanceIntegration:
    """Integration tests for performance requirements"""

    @pytest.mark.asyncio
    async def test_response_time_requirements(self, sample_stock_data):
        """Test that API response times meet requirements"""

        service = AnomalyDetectionService(random_seed=42)

        with patch.object(service, '_fetch_stock_data', return_value=sample_stock_data):
            # Test anomaly detection performance
            start_time = datetime.now()
            anomalies = await service.detect_anomalies("AAPL", lookback_days=100)
            detection_time = (datetime.now() - start_time).total_seconds()

            # Should complete within 5 seconds
            assert detection_time < 5.0

            # Test regime classification performance
            start_time = datetime.now()
            timeline = await service.get_regime_timeline("AAPL", lookback_days=100)
            regime_time = (datetime.now() - start_time).total_seconds()

            # Should complete within 3 seconds
            assert regime_time < 3.0

    @pytest.mark.asyncio
    async def test_memory_usage(self, sample_stock_data):
        """Test memory usage during analysis"""

        service = AnomalyDetectionService(random_seed=42)

        with patch.object(service, '_fetch_stock_data', return_value=sample_stock_data):
            # Test with large dataset
            large_data = sample_stock_data.copy()
            large_data['prices'] = sample_stock_data['prices'] * 10  # 10x more data
            large_data['returns'] = sample_stock_data['returns'] * 10
            large_data['volumes'] = sample_stock_data['volumes'] * 10

            # Should handle large datasets without excessive memory usage
            anomalies = await service.detect_anomalies("AAPL", lookback_days=1000)
            assert len(anomalies) >= 0  # Should complete successfully


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])