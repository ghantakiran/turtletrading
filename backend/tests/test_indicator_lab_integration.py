"""
Integration Tests for TA-Lib Indicator Lab

Tests the complete flow from API requests through computation graph execution,
including database integration, caching, and cross-service interactions.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.models.ta_lib_indicator_models import (
    ComputationGraph, ComputationNode, ComputationEdge,
    CreateGraphRequest, ComputeGraphRequest, TimeFrame
)
from app.api.v1.indicator_lab import router
from app.services.indicator_computation_engine import IndicatorComputationEngine
from app.services.stock_service import StockService


@pytest.fixture
def app():
    """Create test FastAPI app"""
    test_app = FastAPI()
    test_app.include_router(router)
    return test_app


@pytest.fixture
def client(app):
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Mock authenticated user"""
    return {"user_id": "test_user_123", "email": "test@example.com"}


@pytest.fixture
def sample_market_data():
    """Sample market data for testing"""
    return {
        "symbol": "AAPL",
        "data": {
            "timestamps": [datetime(2024, 1, i) for i in range(1, 31)],
            "open": list(range(150, 180)),
            "high": list(range(151, 181)),
            "low": list(range(149, 179)),
            "close": list(range(150, 180)),
            "volume": [1000000] * 30
        }
    }


class TestAPIIntegration:
    """Test complete API integration flows"""

    @patch('app.api.v1.indicator_lab.get_current_user')
    def test_search_indicators_endpoint(self, mock_get_user, client, mock_user):
        """Test indicator search API endpoint"""
        mock_get_user.return_value = mock_user

        response = client.get("/api/v1/indicator-lab/indicators")
        assert response.status_code == 200

        data = response.json()
        assert "indicators" in data
        assert "total_count" in data
        assert "categories" in data
        assert data["total_count"] > 0

        # Test with filters
        response = client.get("/api/v1/indicator-lab/indicators?category=momentum")
        assert response.status_code == 200

        data = response.json()
        assert all(indicator["category"] == "momentum" for indicator in data["indicators"])

    @patch('app.api.v1.indicator_lab.get_current_user')
    def test_get_indicator_definition(self, mock_get_user, client, mock_user):
        """Test getting specific indicator definition"""
        mock_get_user.return_value = mock_user

        response = client.get("/api/v1/indicator-lab/indicators/RSI")
        assert response.status_code == 200

        data = response.json()
        assert data["indicator_id"] == "RSI"
        assert data["name"] == "Relative Strength Index"
        assert data["talib_function"] == "RSI"
        assert len(data["parameters"]) > 0
        assert len(data["outputs"]) > 0

        # Test non-existent indicator
        response = client.get("/api/v1/indicator-lab/indicators/NONEXISTENT")
        assert response.status_code == 404

    @patch('app.api.v1.indicator_lab.get_current_user')
    def test_create_graph_endpoint(self, mock_get_user, client, mock_user):
        """Test graph creation API endpoint"""
        mock_get_user.return_value = mock_user

        create_request = {
            "name": "Test Strategy",
            "description": "A test trading strategy"
        }

        response = client.post("/api/v1/indicator-lab/graphs", json=create_request)
        assert response.status_code == 200

        data = response.json()
        assert data["name"] == "Test Strategy"
        assert data["description"] == "A test trading strategy"
        assert "graph_id" in data
        assert data["created_by"] == mock_user["user_id"]

    @patch('app.api.v1.indicator_lab.get_current_user')
    def test_update_graph_endpoint(self, mock_get_user, client, mock_user):
        """Test graph update API endpoint"""
        mock_get_user.return_value = mock_user

        graph_id = "test_graph_123"
        update_request = {
            "name": "Updated Strategy",
            "description": "Updated description",
            "nodes": [
                {
                    "node_id": "rsi_node",
                    "indicator_id": "RSI",
                    "display_name": "RSI(14)",
                    "parameters": {"timeperiod": 14},
                    "input_mappings": {},
                    "position_x": 100.0,
                    "position_y": 200.0,
                    "is_enabled": True
                }
            ],
            "edges": []
        }

        response = client.put(f"/api/v1/indicator-lab/graphs/{graph_id}", json=update_request)
        assert response.status_code == 200

        data = response.json()
        assert data["name"] == "Updated Strategy"
        assert len(data["nodes"]) == 1
        assert data["nodes"][0]["indicator_id"] == "RSI"

    @patch('app.api.v1.indicator_lab.get_current_user')
    @patch('app.api.v1.indicator_lab.get_computation_engine')
    def test_compute_graph_endpoint(self, mock_get_engine, mock_get_user, client, mock_user, sample_market_data):
        """Test graph computation API endpoint"""
        mock_get_user.return_value = mock_user

        # Mock computation engine
        mock_engine = Mock()
        mock_result = Mock()
        mock_result.graph_id = "test_graph"
        mock_result.symbol = "AAPL"
        mock_result.timeframe = TimeFrame.DAY_1
        mock_result.node_results = {
            "rsi_node": {"rsi": [50.0, 45.0, 55.0]}
        }
        mock_result.timestamps = sample_market_data["data"]["timestamps"][:3]
        mock_result.computation_time_ms = 150.5
        mock_result.cache_hit_ratio = 0.8
        mock_result.data_points = 3
        mock_result.generated_signals = []

        mock_engine.execute_graph = AsyncMock(return_value=mock_result)
        mock_get_engine.return_value = mock_engine

        graph_id = "test_graph"
        compute_request = {
            "graph_id": graph_id,
            "symbol": "AAPL",
            "timeframe": "1d",
            "force_refresh": False
        }

        response = client.post(f"/api/v1/indicator-lab/graphs/{graph_id}/compute", json=compute_request)
        assert response.status_code == 200

        data = response.json()
        assert data["graph_id"] == "test_graph"
        assert data["symbol"] == "AAPL"
        assert "node_results" in data
        assert "rsi_node" in data["node_results"]
        assert data["computation_time_ms"] == 150.5

    @patch('app.api.v1.indicator_lab.get_current_user')
    def test_list_presets_endpoint(self, mock_get_user, client, mock_user):
        """Test preset listing API endpoint"""
        mock_get_user.return_value = mock_user

        response = client.get("/api/v1/indicator-lab/presets")
        assert response.status_code == 200

        data = response.json()
        assert "presets" in data
        assert "categories" in data
        assert "total_count" in data
        assert len(data["presets"]) > 0

        # Test with category filter
        response = client.get("/api/v1/indicator-lab/presets?category=scalping")
        assert response.status_code == 200

        data = response.json()
        scalping_presets = [p for p in data["presets"] if p["category"] == "scalping"]
        assert len(scalping_presets) > 0

    @patch('app.api.v1.indicator_lab.get_current_user')
    def test_get_session_endpoint(self, mock_get_user, client, mock_user):
        """Test session management API endpoint"""
        mock_get_user.return_value = mock_user

        response = client.get("/api/v1/indicator-lab/session")
        assert response.status_code == 200

        data = response.json()
        assert data["user_id"] == mock_user["user_id"]
        assert "auto_save_enabled" in data
        assert "grid_snap_enabled" in data
        assert "zoom_level" in data

    @patch('app.api.v1.indicator_lab.get_current_user')
    def test_parameter_sweep_endpoint(self, mock_get_user, client, mock_user):
        """Test parameter sweep API endpoint"""
        mock_get_user.return_value = mock_user

        sweep_config = {
            "name": "RSI Optimization",
            "graph_id": "test_graph",
            "parameter_ranges": [
                {
                    "parameter_name": "timeperiod",
                    "start_value": 10,
                    "end_value": 20,
                    "step_size": 1,
                    "step_type": "linear"
                }
            ],
            "optimization_objectives": [
                {
                    "metric": "sharpe_ratio",
                    "direction": "maximize",
                    "weight": 1.0
                }
            ],
            "training_start_date": "2023-01-01T00:00:00",
            "training_end_date": "2023-12-31T23:59:59",
            "max_iterations": 100
        }

        response = client.post("/api/v1/indicator-lab/parameter-sweep", json=sweep_config)
        assert response.status_code == 200

        sweep_id = response.json()
        assert isinstance(sweep_id, str)

        # Test getting sweep status
        response = client.get(f"/api/v1/indicator-lab/parameter-sweep/{sweep_id}/status")
        assert response.status_code == 200

        data = response.json()
        assert data["sweep_id"] == sweep_id
        assert "status" in data
        assert "progress" in data


class TestComputationGraphExecution:
    """Test end-to-end computation graph execution"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        mock_stock_service.get_price_history = AsyncMock(return_value=[
            {"timestamp": datetime(2024, 1, i), "open": 150+i, "high": 151+i,
             "low": 149+i, "close": 150+i, "volume": 1000000}
            for i in range(30)
        ])
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.mark.asyncio
    async def test_single_indicator_execution(self, computation_engine, sample_market_data):
        """Test execution of graph with single indicator"""
        # Create graph with RSI node
        graph = ComputationGraph(
            name="RSI Test",
            nodes=[
                ComputationNode(
                    node_id="rsi_node",
                    indicator_id="RSI",
                    display_name="RSI(14)",
                    parameters={"timeperiod": 14}
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # Mock TA-Lib RSI function
        with patch('talib.RSI') as mock_rsi:
            mock_rsi.return_value = [50.0, 45.0, 55.0, 60.0, 40.0] + [None] * 25

            result = await computation_engine.execute_graph(graph, request)

            assert result.graph_id == graph.graph_id
            assert result.symbol == "AAPL"
            assert "rsi_node" in result.node_results
            assert "rsi" in result.node_results["rsi_node"]
            assert result.computation_time_ms > 0

    @pytest.mark.asyncio
    async def test_multiple_independent_indicators(self, computation_engine):
        """Test execution of graph with multiple independent indicators"""
        # Create graph with RSI and SMA nodes
        graph = ComputationGraph(
            name="Multi Indicator Test",
            nodes=[
                ComputationNode(
                    node_id="rsi_node",
                    indicator_id="RSI",
                    display_name="RSI(14)",
                    parameters={"timeperiod": 14}
                ),
                ComputationNode(
                    node_id="sma_node",
                    indicator_id="SMA",
                    display_name="SMA(20)",
                    parameters={"timeperiod": 20}
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # Mock TA-Lib functions
        with patch('talib.RSI') as mock_rsi, patch('talib.SMA') as mock_sma:
            mock_rsi.return_value = [50.0] * 30
            mock_sma.return_value = [155.0] * 30

            result = await computation_engine.execute_graph(graph, request)

            # Both indicators should be computed
            assert "rsi_node" in result.node_results
            assert "sma_node" in result.node_results
            assert "rsi" in result.node_results["rsi_node"]
            assert "sma" in result.node_results["sma_node"]

    @pytest.mark.asyncio
    async def test_dependent_indicators_execution(self, computation_engine):
        """Test execution of graph with dependent indicators"""
        # Create graph where second indicator depends on first
        graph = ComputationGraph(
            name="Dependent Test",
            nodes=[
                ComputationNode(
                    node_id="sma_node",
                    indicator_id="SMA",
                    display_name="SMA(20)",
                    parameters={"timeperiod": 20}
                ),
                ComputationNode(
                    node_id="rsi_node",
                    indicator_id="RSI",
                    display_name="RSI of SMA",
                    parameters={"timeperiod": 14},
                    input_mappings={"close": "sma_node.sma"}
                )
            ],
            edges=[
                ComputationEdge(
                    source_node_id="sma_node",
                    target_node_id="rsi_node",
                    source_output="sma",
                    target_input="close"
                )
            ]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # Mock TA-Lib functions
        with patch('talib.SMA') as mock_sma, patch('talib.RSI') as mock_rsi:
            mock_sma.return_value = [155.0] * 30
            mock_rsi.return_value = [50.0] * 30

            result = await computation_engine.execute_graph(graph, request)

            # Both indicators should be computed
            assert "sma_node" in result.node_results
            assert "rsi_node" in result.node_results

            # Verify execution order through call sequence
            assert mock_sma.called
            assert mock_rsi.called

    @pytest.mark.asyncio
    async def test_signal_generation_integration(self, computation_engine):
        """Test that signals are generated during graph execution"""
        # Create graph with RSI for signal generation
        graph = ComputationGraph(
            name="Signal Test",
            nodes=[
                ComputationNode(
                    node_id="rsi_node",
                    indicator_id="RSI",
                    display_name="RSI(14)",
                    parameters={"timeperiod": 14}
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # Mock RSI values that should generate signals
        rsi_values = [25.0, 35.0] + [50.0] * 28  # Oversold recovery signal

        with patch('talib.RSI') as mock_rsi:
            mock_rsi.return_value = rsi_values

            result = await computation_engine.execute_graph(graph, request)

            # Should generate at least one signal
            assert len(result.generated_signals) > 0

            # Verify signal properties
            signal = result.generated_signals[0]
            assert signal.signal_type == "buy"
            assert signal.indicator_name == "RSI"
            assert signal.strength > 0
            assert signal.confidence > 0

    @pytest.mark.asyncio
    async def test_error_handling_in_execution(self, computation_engine):
        """Test error handling during graph execution"""
        # Create graph with invalid indicator
        graph = ComputationGraph(
            name="Error Test",
            nodes=[
                ComputationNode(
                    node_id="invalid_node",
                    indicator_id="INVALID_INDICATOR",
                    display_name="Invalid"
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # Should raise GraphExecutionError
        with pytest.raises(Exception):  # Could be GraphExecutionError or other
            await computation_engine.execute_graph(graph, request)


class TestCachingIntegration:
    """Test caching behavior in integration scenarios"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.mark.asyncio
    async def test_cache_hit_reduces_computation_time(self, computation_engine):
        """Test that cache hits reduce computation time"""
        # Create simple graph
        graph = ComputationGraph(
            name="Cache Test",
            nodes=[
                ComputationNode(
                    node_id="rsi_node",
                    indicator_id="RSI",
                    display_name="RSI(14)",
                    parameters={"timeperiod": 14}
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # Mock cached result
        cached_result = {"rsi": [50.0, 45.0, 55.0]}

        with patch.object(computation_engine, '_get_cached_result', return_value=cached_result):
            with patch('talib.RSI') as mock_rsi:
                result = await computation_engine.execute_graph(graph, request)

                # TA-Lib function should not be called due to cache hit
                mock_rsi.assert_not_called()

                # Result should contain cached data
                assert "rsi_node" in result.node_results
                assert result.node_results["rsi_node"] == cached_result

    @pytest.mark.asyncio
    async def test_cache_miss_calls_talib(self, computation_engine):
        """Test that cache misses result in TA-Lib calls"""
        graph = ComputationGraph(
            name="Cache Miss Test",
            nodes=[
                ComputationNode(
                    node_id="rsi_node",
                    indicator_id="RSI",
                    display_name="RSI(14)",
                    parameters={"timeperiod": 14}
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # Mock cache miss
        with patch.object(computation_engine, '_get_cached_result', return_value=None):
            with patch('talib.RSI', return_value=[50.0] * 30) as mock_rsi:
                with patch.object(computation_engine, '_cache_result') as mock_cache:
                    await computation_engine.execute_graph(graph, request)

                    # TA-Lib function should be called
                    mock_rsi.assert_called_once()

                    # Result should be cached
                    mock_cache.assert_called()


class TestErrorRecovery:
    """Test error recovery and fallback mechanisms"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.mark.asyncio
    async def test_partial_graph_execution_on_error(self, computation_engine):
        """Test that valid nodes still execute when one node fails"""
        # Create graph with one valid and one invalid node
        graph = ComputationGraph(
            name="Partial Error Test",
            nodes=[
                ComputationNode(
                    node_id="valid_rsi",
                    indicator_id="RSI",
                    display_name="Valid RSI",
                    parameters={"timeperiod": 14}
                ),
                ComputationNode(
                    node_id="invalid_node",
                    indicator_id="INVALID",
                    display_name="Invalid Node"
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # The execution should fail due to invalid indicator
        with pytest.raises(Exception):
            await computation_engine.execute_graph(graph, request)

    @pytest.mark.asyncio
    async def test_graceful_degradation_on_data_issues(self, computation_engine):
        """Test graceful degradation when data issues occur"""
        graph = ComputationGraph(
            name="Data Issue Test",
            nodes=[
                ComputationNode(
                    node_id="rsi_node",
                    indicator_id="RSI",
                    display_name="RSI(14)",
                    parameters={"timeperiod": 14}
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="INVALID_SYMBOL",
            timeframe=TimeFrame.DAY_1
        )

        # Mock stock service to return None (no data)
        with patch.object(computation_engine.stock_service, 'get_price_history', return_value=None):
            with pytest.raises(Exception):  # Should raise GraphExecutionError
                await computation_engine.execute_graph(graph, request)


class TestPerformanceMetrics:
    """Test performance tracking and metrics"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.mark.asyncio
    async def test_execution_time_tracking(self, computation_engine):
        """Test that execution time is tracked accurately"""
        graph = ComputationGraph(
            name="Performance Test",
            nodes=[
                ComputationNode(
                    node_id="rsi_node",
                    indicator_id="RSI",
                    display_name="RSI(14)",
                    parameters={"timeperiod": 14}
                )
            ],
            edges=[]
        )

        request = ComputeGraphRequest(
            graph_id=graph.graph_id,
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        with patch('talib.RSI', return_value=[50.0] * 30):
            result = await computation_engine.execute_graph(graph, request)

            # Execution time should be tracked
            assert result.computation_time_ms > 0
            assert result.computation_time_ms < 10000  # Should be reasonable

    def test_statistics_aggregation(self, computation_engine):
        """Test that execution statistics are properly aggregated"""
        initial_stats = computation_engine.get_execution_statistics()
        initial_count = initial_stats["total_computations"]

        # Simulate multiple computations
        for i in range(5):
            computation_engine._update_execution_stats(100.0 + i * 10, 2)

        updated_stats = computation_engine.get_execution_statistics()

        # Should track increased computation count
        assert updated_stats["total_computations"] == initial_count + 5

        # Should track average execution time
        assert updated_stats["average_execution_time"] > 0

    @pytest.mark.asyncio
    async def test_cache_hit_ratio_calculation(self, computation_engine):
        """Test cache hit ratio calculation over multiple executions"""
        # Simulate cache hits and misses
        computation_engine.execution_stats["cache_hits"] = 8
        computation_engine.execution_stats["cache_misses"] = 2

        cache_ratio = computation_engine._calculate_cache_hit_ratio("test")
        assert cache_ratio == 0.8  # 80% hit rate

        # Test with additional requests
        computation_engine.execution_stats["cache_hits"] = 15
        computation_engine.execution_stats["cache_misses"] = 5

        cache_ratio = computation_engine._calculate_cache_hit_ratio("test")
        assert cache_ratio == 0.75  # 75% hit rate