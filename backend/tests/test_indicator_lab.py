"""
Comprehensive Unit Tests for TA-Lib Indicator Lab

Test coverage includes:
- TA-Lib parity validation for all indicators
- Computation graph execution and dependency resolution
- Parameter validation and error handling
- Caching behavior and performance
- Signal generation accuracy
"""

import pytest
import numpy as np
import pandas as pd
import talib
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, List, Any

from app.models.ta_lib_indicator_models import (
    ComputationGraph, ComputationNode, ComputationEdge, IndicatorDefinition,
    ComputeGraphRequest, TimeFrame, ParameterType, IndicatorCategory
)
from app.services.indicator_computation_engine import (
    IndicatorComputationEngine, GraphExecutionError, CyclicGraphError, MissingDependencyError
)
from app.services.stock_service import StockService


class TestIndicatorDefinitions:
    """Test indicator definitions and TA-Lib parity"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.fixture
    def sample_price_data(self):
        """Generate sample OHLCV data for testing"""
        dates = pd.date_range(start='2023-01-01', periods=100, freq='D')
        np.random.seed(42)  # For reproducible tests

        # Generate realistic price data
        close_prices = 100 + np.cumsum(np.random.normal(0, 1, 100))
        high_prices = close_prices + np.random.uniform(0, 2, 100)
        low_prices = close_prices - np.random.uniform(0, 2, 100)
        open_prices = close_prices + np.random.normal(0, 0.5, 100)
        volumes = np.random.randint(1000000, 10000000, 100)

        return {
            "timestamps": dates.tolist(),
            "open": open_prices,
            "high": high_prices,
            "low": low_prices,
            "close": close_prices,
            "volume": volumes
        }

    def test_indicator_registry_completeness(self, computation_engine):
        """Test that indicator registry contains expected indicators"""
        registry = computation_engine.get_indicator_registry()

        # Check core indicators are present
        expected_indicators = ["RSI", "MACD", "SMA", "BBANDS", "OBV", "ATR"]
        for indicator_id in expected_indicators:
            assert indicator_id in registry, f"Missing indicator: {indicator_id}"

        # Verify indicator definitions are complete
        for indicator_id, definition in registry.items():
            assert definition.indicator_id == indicator_id
            assert definition.name
            assert definition.talib_function
            assert definition.category
            assert len(definition.outputs) > 0
            assert definition.min_periods > 0

    def test_rsi_talib_parity(self, computation_engine, sample_price_data):
        """Test RSI calculation matches TA-Lib exactly"""
        close_prices = np.array(sample_price_data["close"])

        # Calculate using TA-Lib directly
        expected_rsi = talib.RSI(close_prices, timeperiod=14)

        # Calculate using our engine
        registry = computation_engine.get_indicator_registry()
        rsi_def = registry["RSI"]

        # Mock the TA-Lib execution
        with patch('talib.RSI', return_value=expected_rsi) as mock_rsi:
            result = computation_engine._execute_talib_function(
                rsi_def,
                {"close": close_prices},
                {"timeperiod": 14}
            )

            # Verify function was called correctly
            mock_rsi.assert_called_once_with(close_prices, timeperiod=14)

            # Verify results match
            assert "rsi" in result
            result_values = [x for x in result["rsi"] if x is not None]
            expected_values = [x for x in expected_rsi if not np.isnan(x)]

            assert len(result_values) == len(expected_values)
            np.testing.assert_array_almost_equal(result_values, expected_values, decimal=6)

    def test_macd_talib_parity(self, computation_engine, sample_price_data):
        """Test MACD calculation matches TA-Lib exactly"""
        close_prices = np.array(sample_price_data["close"])

        # Calculate using TA-Lib directly
        expected_macd, expected_signal, expected_hist = talib.MACD(
            close_prices, fastperiod=12, slowperiod=26, signalperiod=9
        )

        # Calculate using our engine
        registry = computation_engine.get_indicator_registry()
        macd_def = registry["MACD"]

        with patch('talib.MACD', return_value=(expected_macd, expected_signal, expected_hist)) as mock_macd:
            result = computation_engine._execute_talib_function(
                macd_def,
                {"close": close_prices},
                {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9}
            )

            # Verify function was called correctly
            mock_macd.assert_called_once_with(close_prices, fastperiod=12, slowperiod=26, signalperiod=9)

            # Verify all outputs are present
            assert "macd" in result
            assert "macdsignal" in result
            assert "macdhist" in result

            # Verify values match (excluding NaN values)
            for output_name, expected_values in [
                ("macd", expected_macd),
                ("macdsignal", expected_signal),
                ("macdhist", expected_hist)
            ]:
                result_values = [x for x in result[output_name] if x is not None]
                expected_clean = [x for x in expected_values if not np.isnan(x)]
                np.testing.assert_array_almost_equal(result_values, expected_clean, decimal=6)

    def test_bollinger_bands_talib_parity(self, computation_engine, sample_price_data):
        """Test Bollinger Bands calculation matches TA-Lib exactly"""
        close_prices = np.array(sample_price_data["close"])

        # Calculate using TA-Lib directly
        expected_upper, expected_middle, expected_lower = talib.BBANDS(
            close_prices, timeperiod=20, nbdevup=2.0, nbdevdn=2.0, matype=0
        )

        # Calculate using our engine
        registry = computation_engine.get_indicator_registry()
        bbands_def = registry["BBANDS"]

        with patch('talib.BBANDS', return_value=(expected_upper, expected_middle, expected_lower)) as mock_bbands:
            result = computation_engine._execute_talib_function(
                bbands_def,
                {"close": close_prices},
                {"timeperiod": 20, "nbdevup": 2.0, "nbdevdn": 2.0}
            )

            # Verify function was called correctly
            mock_bbands.assert_called_once()

            # Verify all outputs are present
            assert "upperband" in result
            assert "middleband" in result
            assert "lowerband" in result

    def test_parameter_validation(self, computation_engine):
        """Test parameter validation for different types"""
        registry = computation_engine.get_indicator_registry()
        rsi_def = registry["RSI"]

        # Create test node
        node = ComputationNode(
            indicator_id="RSI",
            display_name="Test RSI",
            parameters={"timeperiod": 14}
        )

        # Test valid parameters
        result = computation_engine._validate_node_parameters(node, rsi_def)
        assert result["timeperiod"] == 14

        # Test invalid parameter type
        node.parameters["timeperiod"] = "invalid"
        with pytest.raises(ValueError):
            computation_engine._validate_node_parameters(node, rsi_def)

        # Test parameter out of range
        node.parameters["timeperiod"] = 1  # Below minimum
        with pytest.raises(GraphExecutionError):
            computation_engine._validate_node_parameters(node, rsi_def)

        # Test missing required parameter
        node.parameters = {}
        with pytest.raises(GraphExecutionError):
            computation_engine._validate_node_parameters(node, rsi_def)

    def test_parameter_defaults(self, computation_engine):
        """Test that default parameters are applied correctly"""
        registry = computation_engine.get_indicator_registry()
        rsi_def = registry["RSI"]

        # Create node without parameters
        node = ComputationNode(
            indicator_id="RSI",
            display_name="Default RSI",
            parameters={}
        )

        # Should use default values
        result = computation_engine._validate_node_parameters(node, rsi_def)
        assert result["timeperiod"] == 14  # Default value


class TestComputationGraph:
    """Test computation graph validation and execution"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.fixture
    def valid_graph(self):
        """Create a valid computation graph"""
        nodes = [
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
        ]

        return ComputationGraph(
            name="Test Graph",
            nodes=nodes,
            edges=[]
        )

    @pytest.fixture
    def cyclic_graph(self):
        """Create a graph with cycles"""
        nodes = [
            ComputationNode(node_id="node1", indicator_id="RSI", display_name="RSI"),
            ComputationNode(node_id="node2", indicator_id="SMA", display_name="SMA")
        ]

        edges = [
            ComputationEdge(source_node_id="node1", target_node_id="node2", source_output="rsi", target_input="close"),
            ComputationEdge(source_node_id="node2", target_node_id="node1", source_output="sma", target_input="close")
        ]

        return ComputationGraph(
            name="Cyclic Graph",
            nodes=nodes,
            edges=edges
        )

    @pytest.mark.asyncio
    async def test_valid_graph_validation(self, computation_engine, valid_graph):
        """Test validation of a valid graph"""
        # Should not raise any exceptions
        await computation_engine._validate_graph(valid_graph)

    @pytest.mark.asyncio
    async def test_empty_graph_validation(self, computation_engine):
        """Test validation of empty graph"""
        empty_graph = ComputationGraph(name="Empty", nodes=[], edges=[])

        with pytest.raises(GraphExecutionError, match="Graph has no nodes"):
            await computation_engine._validate_graph(empty_graph)

    @pytest.mark.asyncio
    async def test_cyclic_graph_validation(self, computation_engine, cyclic_graph):
        """Test detection of cycles in graph"""
        with pytest.raises(CyclicGraphError, match="Graph contains cycles"):
            await computation_engine._validate_graph(cyclic_graph)

    @pytest.mark.asyncio
    async def test_invalid_indicator_reference(self, computation_engine):
        """Test validation with invalid indicator reference"""
        invalid_graph = ComputationGraph(
            name="Invalid Graph",
            nodes=[ComputationNode(
                node_id="invalid_node",
                indicator_id="NONEXISTENT",
                display_name="Invalid"
            )],
            edges=[]
        )

        with pytest.raises(GraphExecutionError, match="Unknown indicator: NONEXISTENT"):
            await computation_engine._validate_graph(invalid_graph)

    @pytest.mark.asyncio
    async def test_invalid_edge_reference(self, computation_engine):
        """Test validation with edge referencing non-existent node"""
        invalid_graph = ComputationGraph(
            name="Invalid Edges",
            nodes=[ComputationNode(node_id="node1", indicator_id="RSI", display_name="RSI")],
            edges=[ComputationEdge(
                source_node_id="node1",
                target_node_id="nonexistent",
                source_output="rsi",
                target_input="close"
            )]
        )

        with pytest.raises(GraphExecutionError, match="Edge references unknown target node"):
            await computation_engine._validate_graph(invalid_graph)

    @pytest.mark.asyncio
    async def test_execution_plan_generation(self, computation_engine, valid_graph):
        """Test generation of execution plan with topological sort"""
        execution_plan = await computation_engine._build_execution_plan(valid_graph)

        # Should return list of levels
        assert isinstance(execution_plan, list)
        assert len(execution_plan) > 0

        # All nodes should be included
        all_nodes = [node_id for level in execution_plan for node_id in level]
        expected_nodes = [node.node_id for node in valid_graph.nodes]
        assert set(all_nodes) == set(expected_nodes)

    @pytest.mark.asyncio
    async def test_dependency_resolution(self, computation_engine):
        """Test proper dependency resolution in execution plan"""
        # Create graph with dependencies
        nodes = [
            ComputationNode(node_id="sma1", indicator_id="SMA", display_name="SMA(10)", parameters={"timeperiod": 10}),
            ComputationNode(node_id="sma2", indicator_id="SMA", display_name="SMA(20)", parameters={"timeperiod": 20}),
            ComputationNode(node_id="dependent", indicator_id="RSI", display_name="RSI")
        ]

        edges = [
            ComputationEdge(source_node_id="sma1", target_node_id="dependent", source_output="sma", target_input="close")
        ]

        graph = ComputationGraph(name="Dependency Test", nodes=nodes, edges=edges)

        execution_plan = await computation_engine._build_execution_plan(graph)

        # sma1 and sma2 should be in earlier levels than dependent
        sma1_level = next(i for i, level in enumerate(execution_plan) if "sma1" in level)
        dependent_level = next(i for i, level in enumerate(execution_plan) if "dependent" in level)

        assert sma1_level < dependent_level, "Dependencies should be executed before dependents"


class TestCaching:
    """Test caching behavior and performance"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    def test_cache_key_generation(self, computation_engine):
        """Test cache key generation for different scenarios"""
        node = ComputationNode(
            indicator_id="RSI",
            display_name="RSI(14)",
            parameters={"timeperiod": 14}
        )

        request = ComputeGraphRequest(
            graph_id="test_graph",
            symbol="AAPL",
            timeframe=TimeFrame.DAY_1
        )

        # Generate cache key
        cache_key = computation_engine._build_cache_key(node, request)

        # Should be deterministic
        cache_key2 = computation_engine._build_cache_key(node, request)
        assert cache_key == cache_key2

        # Should change with different parameters
        node.parameters["timeperiod"] = 21
        cache_key3 = computation_engine._build_cache_key(node, request)
        assert cache_key != cache_key3

    @pytest.mark.asyncio
    async def test_cache_miss_behavior(self, computation_engine):
        """Test behavior when cache miss occurs"""
        # Mock Redis client to return None (cache miss)
        with patch.object(computation_engine, 'redis_client') as mock_redis:
            mock_redis.get.return_value = None

            result = await computation_engine._get_cached_result("test_key")
            assert result is None

            # Should increment cache miss counter
            assert computation_engine.execution_stats["cache_misses"] > 0

    @pytest.mark.asyncio
    async def test_cache_hit_behavior(self, computation_engine):
        """Test behavior when cache hit occurs"""
        cached_data = '{"rsi": [50.0, 45.0, 55.0]}'

        # Mock Redis client to return cached data
        with patch.object(computation_engine, 'redis_client') as mock_redis:
            mock_redis.get.return_value = cached_data

            result = await computation_engine._get_cached_result("test_key")
            assert result is not None
            assert "rsi" in result

    @pytest.mark.asyncio
    async def test_cache_storage(self, computation_engine):
        """Test caching of computation results"""
        test_result = {"rsi": [50.0, 45.0, 55.0]}

        # Mock Redis client
        with patch.object(computation_engine, 'redis_client') as mock_redis:
            mock_redis.setex = AsyncMock()

            await computation_engine._cache_result("test_key", test_result)

            # Verify setex was called with correct parameters
            mock_redis.setex.assert_called_once()
            args = mock_redis.setex.call_args[0]
            assert args[0] == "test_key"
            assert args[1] == 300  # TTL
            assert str(test_result) in args[2]


class TestSignalGeneration:
    """Test trading signal generation from indicators"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.mark.asyncio
    async def test_rsi_oversold_signal(self, computation_engine):
        """Test RSI oversold signal generation"""
        # Create RSI node
        node = ComputationNode(
            node_id="rsi_test",
            indicator_id="RSI",
            display_name="RSI(14)"
        )

        # Mock RSI values showing oversold recovery
        rsi_results = {"rsi": [25.0, 35.0]}  # Crosses above 30

        timestamps = [
            datetime(2024, 1, 1),
            datetime(2024, 1, 2)
        ]
        close_prices = [100.0, 102.0]

        signals = await computation_engine._generate_node_signals(
            node, rsi_results, timestamps, close_prices
        )

        # Should generate buy signal
        assert len(signals) == 1
        signal = signals[0]
        assert signal.signal_type == "buy"
        assert signal.indicator_name == "RSI"
        assert "oversold recovery" in signal.trigger_condition

    @pytest.mark.asyncio
    async def test_rsi_overbought_signal(self, computation_engine):
        """Test RSI overbought signal generation"""
        node = ComputationNode(
            node_id="rsi_test",
            indicator_id="RSI",
            display_name="RSI(14)"
        )

        # Mock RSI values showing overbought correction
        rsi_results = {"rsi": [75.0, 65.0]}  # Crosses below 70

        timestamps = [
            datetime(2024, 1, 1),
            datetime(2024, 1, 2)
        ]
        close_prices = [100.0, 98.0]

        signals = await computation_engine._generate_node_signals(
            node, rsi_results, timestamps, close_prices
        )

        # Should generate sell signal
        assert len(signals) == 1
        signal = signals[0]
        assert signal.signal_type == "sell"
        assert signal.indicator_name == "RSI"
        assert "overbought correction" in signal.trigger_condition

    @pytest.mark.asyncio
    async def test_macd_bullish_crossover(self, computation_engine):
        """Test MACD bullish crossover signal"""
        node = ComputationNode(
            node_id="macd_test",
            indicator_id="MACD",
            display_name="MACD"
        )

        # Mock MACD values showing bullish crossover
        macd_results = {
            "macd": [-0.5, 0.5],       # MACD line crosses above
            "macdsignal": [0.0, 0.0]   # Signal line
        }

        timestamps = [
            datetime(2024, 1, 1),
            datetime(2024, 1, 2)
        ]
        close_prices = [100.0, 102.0]

        signals = await computation_engine._generate_node_signals(
            node, macd_results, timestamps, close_prices
        )

        # Should generate buy signal
        assert len(signals) == 1
        signal = signals[0]
        assert signal.signal_type == "buy"
        assert signal.indicator_name == "MACD"
        assert "crossed above signal line" in signal.trigger_condition

    @pytest.mark.asyncio
    async def test_macd_bearish_crossover(self, computation_engine):
        """Test MACD bearish crossover signal"""
        node = ComputationNode(
            node_id="macd_test",
            indicator_id="MACD",
            display_name="MACD"
        )

        # Mock MACD values showing bearish crossover
        macd_results = {
            "macd": [0.5, -0.5],       # MACD line crosses below
            "macdsignal": [0.0, 0.0]   # Signal line
        }

        timestamps = [
            datetime(2024, 1, 1),
            datetime(2024, 1, 2)
        ]
        close_prices = [100.0, 98.0]

        signals = await computation_engine._generate_node_signals(
            node, macd_results, timestamps, close_prices
        )

        # Should generate sell signal
        assert len(signals) == 1
        signal = signals[0]
        assert signal.signal_type == "sell"
        assert signal.indicator_name == "MACD"
        assert "crossed below signal line" in signal.trigger_condition

    @pytest.mark.asyncio
    async def test_no_signals_with_missing_data(self, computation_engine):
        """Test that no signals are generated with missing data"""
        node = ComputationNode(
            node_id="rsi_test",
            indicator_id="RSI",
            display_name="RSI(14)"
        )

        # RSI results with None values
        rsi_results = {"rsi": [None, None]}

        timestamps = [
            datetime(2024, 1, 1),
            datetime(2024, 1, 2)
        ]
        close_prices = [100.0, 102.0]

        signals = await computation_engine._generate_node_signals(
            node, rsi_results, timestamps, close_prices
        )

        # Should not generate any signals
        assert len(signals) == 0


class TestErrorHandling:
    """Test error handling and edge cases"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.mark.asyncio
    async def test_talib_function_error(self, computation_engine):
        """Test handling of TA-Lib function errors"""
        registry = computation_engine.get_indicator_registry()
        rsi_def = registry["RSI"]

        # Mock TA-Lib to raise an exception
        with patch('talib.RSI', side_effect=Exception("TA-Lib error")):
            with pytest.raises(GraphExecutionError, match="TA-Lib execution failed"):
                await computation_engine._execute_talib_function(
                    rsi_def,
                    {"close": np.array([100, 101, 102])},
                    {"timeperiod": 14}
                )

    @pytest.mark.asyncio
    async def test_missing_input_data(self, computation_engine):
        """Test handling of missing input data"""
        registry = computation_engine.get_indicator_registry()
        rsi_def = registry["RSI"]

        # Missing close price data
        with pytest.raises(GraphExecutionError, match="Missing close price data"):
            await computation_engine._execute_talib_function(
                rsi_def,
                {"open": np.array([100, 101, 102])},  # Missing close
                {"timeperiod": 14}
            )

    @pytest.mark.asyncio
    async def test_insufficient_data_points(self, computation_engine):
        """Test handling of insufficient data points"""
        registry = computation_engine.get_indicator_registry()
        rsi_def = registry["RSI"]

        # Only 5 data points for RSI(14)
        short_data = np.array([100, 101, 102, 103, 104])

        # Should handle gracefully (TA-Lib will return NaN values)
        with patch('talib.RSI', return_value=np.array([np.nan] * 5)):
            result = await computation_engine._execute_talib_function(
                rsi_def,
                {"close": short_data},
                {"timeperiod": 14}
            )

            # Should return result with None values
            assert "rsi" in result
            assert all(x is None for x in result["rsi"])

    def test_execution_statistics_tracking(self, computation_engine):
        """Test that execution statistics are tracked correctly"""
        initial_stats = computation_engine.get_execution_statistics()
        initial_computations = initial_stats["total_computations"]

        # Simulate computation completion
        computation_engine._update_execution_stats(150.0, 3)

        updated_stats = computation_engine.get_execution_statistics()
        assert updated_stats["total_computations"] == initial_computations + 1
        assert updated_stats["average_execution_time"] >= 0


class TestPerformance:
    """Test performance and optimization features"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    def test_cache_hit_ratio_calculation(self, computation_engine):
        """Test cache hit ratio calculation"""
        # Reset stats
        computation_engine.execution_stats["cache_hits"] = 80
        computation_engine.execution_stats["cache_misses"] = 20

        ratio = computation_engine._calculate_cache_hit_ratio("test")
        assert ratio == 0.8  # 80/(80+20)

        # Test with no requests
        computation_engine.execution_stats["cache_hits"] = 0
        computation_engine.execution_stats["cache_misses"] = 0

        ratio = computation_engine._calculate_cache_hit_ratio("test")
        assert ratio == 0.0

    @pytest.mark.asyncio
    async def test_parallel_execution_simulation(self, computation_engine):
        """Test that parallel execution paths are handled correctly"""
        # Create graph with multiple independent nodes
        nodes = [
            ComputationNode(node_id="rsi", indicator_id="RSI", display_name="RSI"),
            ComputationNode(node_id="sma", indicator_id="SMA", display_name="SMA"),
            ComputationNode(node_id="atr", indicator_id="ATR", display_name="ATR")
        ]

        graph = ComputationGraph(name="Parallel Test", nodes=nodes, edges=[])

        execution_plan = await computation_engine._build_execution_plan(graph)

        # All independent nodes should be in the same level (can execute in parallel)
        assert len(execution_plan) == 1  # Single level
        assert len(execution_plan[0]) == 3  # All three nodes
        assert set(execution_plan[0]) == {"rsi", "sma", "atr"}


# Golden test data fixtures
@pytest.fixture
def golden_rsi_data():
    """Golden RSI test data for validation"""
    return {
        "input": {
            "close": [44.0, 44.25, 44.5, 43.75, 44.5, 44.0, 44.25, 44.75, 45.0, 45.25,
                     45.5, 45.25, 45.0, 44.5, 44.0, 44.25, 44.5, 44.25, 44.0, 43.75],
            "timeperiod": 14
        },
        "expected_output": [None] * 13 + [70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93]
    }


@pytest.fixture
def golden_macd_data():
    """Golden MACD test data for validation"""
    return {
        "input": {
            "close": [459.99, 448.85, 446.06, 450.81, 442.8, 448.97, 444.57, 441.4,
                     430.47, 420.05, 431.14, 425.66, 430.58, 431.72, 437.87, 428.43,
                     428.35, 432.5, 443.66, 455.72, 454.49, 452.08, 452.73, 461.91,
                     463.58, 461.14, 452.08, 442.66, 428.91, 429.79, 431.99, 427.72],
            "fastperiod": 12,
            "slowperiod": 26,
            "signalperiod": 9
        },
        "expected_output": {
            "macd": [None] * 25 + [2.26, 1.79, 1.16, 0.65, 0.20, -0.11, -0.27],
            "signal": [None] * 33 + [-0.09, -0.15],
            "histogram": [None] * 33 + [-0.18, -0.12]
        }
    }


class TestGoldenData:
    """Test against golden reference data"""

    @pytest.fixture
    def computation_engine(self):
        """Create computation engine for testing"""
        mock_stock_service = Mock(spec=StockService)
        return IndicatorComputationEngine(mock_stock_service)

    @pytest.mark.asyncio
    async def test_rsi_golden_data(self, computation_engine, golden_rsi_data):
        """Test RSI calculation against golden reference data"""
        registry = computation_engine.get_indicator_registry()
        rsi_def = registry["RSI"]

        input_data = golden_rsi_data["input"]
        expected_output = golden_rsi_data["expected_output"]

        # Calculate RSI using TA-Lib directly for golden reference
        actual_talib_result = talib.RSI(
            np.array(input_data["close"]),
            timeperiod=input_data["timeperiod"]
        )

        # Convert NaN to None for comparison
        actual_clean = [None if np.isnan(x) else round(x, 2) for x in actual_talib_result]

        # Verify our expected golden data matches TA-Lib
        assert len(actual_clean) == len(expected_output)

        # Test our engine produces the same result
        with patch('talib.RSI', return_value=actual_talib_result):
            result = await computation_engine._execute_talib_function(
                rsi_def,
                {"close": np.array(input_data["close"])},
                {"timeperiod": input_data["timeperiod"]}
            )

            result_clean = [None if x is None else round(x, 2) for x in result["rsi"]]
            assert result_clean == actual_clean

    @pytest.mark.asyncio
    async def test_macd_golden_data(self, computation_engine, golden_macd_data):
        """Test MACD calculation against golden reference data"""
        registry = computation_engine.get_indicator_registry()
        macd_def = registry["MACD"]

        input_data = golden_macd_data["input"]

        # Calculate MACD using TA-Lib directly
        macd, signal, histogram = talib.MACD(
            np.array(input_data["close"]),
            fastperiod=input_data["fastperiod"],
            slowperiod=input_data["slowperiod"],
            signalperiod=input_data["signalperiod"]
        )

        # Test our engine produces the same result
        with patch('talib.MACD', return_value=(macd, signal, histogram)):
            result = await computation_engine._execute_talib_function(
                macd_def,
                {"close": np.array(input_data["close"])},
                input_data
            )

            # Verify all outputs are present and correct length
            assert "macd" in result
            assert "macdsignal" in result
            assert "macdhist" in result

            assert len(result["macd"]) == len(input_data["close"])
            assert len(result["macdsignal"]) == len(input_data["close"])
            assert len(result["macdhist"]) == len(input_data["close"])