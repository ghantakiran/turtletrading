"""
Indicator Computation Graph Engine

This service provides a powerful computation graph engine for technical indicators including:
- Directed acyclic graph (DAG) execution with dependency resolution
- Parallel computation with caching and memoization
- TA-Lib integration with parameter validation
- Dynamic parameter optimization and sweeps
- Multi-timeframe analysis coordination
"""

import asyncio
import logging
import time
import traceback
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Set, Tuple, Union
from collections import defaultdict, deque
import numpy as np
import pandas as pd
import talib
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

from ..models.ta_lib_indicator_models import (
    ComputationGraph, ComputationNode, ComputationEdge, IndicatorDefinition,
    ComputeGraphRequest, ComputeGraphResponse, IndicatorSignal, TimeFrame,
    ParameterSweepConfig, ParameterSweepResult, DataType, ParameterType
)
from ..core.redis_client import get_redis_client
from ..services.stock_service import StockService

logger = logging.getLogger(__name__)


class GraphExecutionError(Exception):
    """Exception raised during graph execution"""
    def __init__(self, message: str, node_id: str = None, details: Dict[str, Any] = None):
        super().__init__(message)
        self.node_id = node_id
        self.details = details or {}


class CyclicGraphError(GraphExecutionError):
    """Exception raised when graph contains cycles"""
    pass


class MissingDependencyError(GraphExecutionError):
    """Exception raised when node dependencies are missing"""
    pass


class IndicatorComputationEngine:
    """
    Advanced computation engine for executing indicator graphs with
    dependency resolution, parallel execution, and comprehensive caching.
    """

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service
        self.redis_client = get_redis_client()

        # Execution state
        self.execution_lock = threading.RLock()
        self.active_computations: Dict[str, bool] = {}
        self.computation_cache: Dict[str, Any] = {}

        # Performance tracking
        self.execution_stats = {
            "total_computations": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "average_execution_time": 0.0,
            "error_count": 0
        }

        # Thread pool for parallel execution
        self.thread_pool = ThreadPoolExecutor(max_workers=8)

        # TA-Lib indicator registry
        self.indicator_registry = self._build_indicator_registry()

        logger.info("Initialized indicator computation engine")

    def _build_indicator_registry(self) -> Dict[str, IndicatorDefinition]:
        """Build registry of all available TA-Lib indicators"""
        registry = {}

        # Momentum indicators
        registry["RSI"] = IndicatorDefinition(
            indicator_id="RSI",
            name="Relative Strength Index",
            display_name="RSI",
            category="momentum",
            description="Momentum oscillator measuring speed and magnitude of price changes",
            talib_function="RSI",
            talib_group="Momentum Indicators",
            parameters=[
                {
                    "name": "timeperiod",
                    "display_name": "Time Period",
                    "parameter_type": "integer",
                    "default_value": 14,
                    "min_value": 2,
                    "max_value": 100,
                    "description": "Number of periods for RSI calculation",
                    "is_required": True
                }
            ],
            outputs=[
                {
                    "name": "rsi",
                    "display_name": "RSI",
                    "data_type": "indicator",
                    "description": "RSI values (0-100)",
                    "is_primary": True
                }
            ],
            min_periods=14,
            lookback_period=14,
            has_boundaries=True,
            boundary_lower=0.0,
            boundary_upper=100.0,
            interpretation="Values above 70 indicate overbought, below 30 indicate oversold",
            typical_usage="Identify momentum reversals and divergences"
        )

        registry["MACD"] = IndicatorDefinition(
            indicator_id="MACD",
            name="Moving Average Convergence Divergence",
            display_name="MACD",
            category="momentum",
            description="Trend-following momentum indicator showing relationship between two moving averages",
            talib_function="MACD",
            talib_group="Momentum Indicators",
            parameters=[
                {
                    "name": "fastperiod",
                    "display_name": "Fast Period",
                    "parameter_type": "integer",
                    "default_value": 12,
                    "min_value": 2,
                    "max_value": 100,
                    "description": "Fast EMA period",
                    "is_required": True
                },
                {
                    "name": "slowperiod",
                    "display_name": "Slow Period",
                    "parameter_type": "integer",
                    "default_value": 26,
                    "min_value": 2,
                    "max_value": 200,
                    "description": "Slow EMA period",
                    "is_required": True
                },
                {
                    "name": "signalperiod",
                    "display_name": "Signal Period",
                    "parameter_type": "integer",
                    "default_value": 9,
                    "min_value": 2,
                    "max_value": 50,
                    "description": "Signal line EMA period",
                    "is_required": True
                }
            ],
            outputs=[
                {
                    "name": "macd",
                    "display_name": "MACD Line",
                    "data_type": "indicator",
                    "description": "MACD line values",
                    "is_primary": True
                },
                {
                    "name": "macdsignal",
                    "display_name": "Signal Line",
                    "data_type": "indicator",
                    "description": "Signal line values",
                    "is_primary": False
                },
                {
                    "name": "macdhist",
                    "display_name": "Histogram",
                    "data_type": "indicator",
                    "description": "MACD histogram values",
                    "is_primary": False
                }
            ],
            min_periods=34,
            lookback_period=34,
            is_overlay=False,
            interpretation="Buy when MACD crosses above signal line, sell when crosses below",
            typical_usage="Trend confirmation and momentum analysis"
        )

        # Add more indicators...
        self._add_overlap_indicators(registry)
        self._add_volume_indicators(registry)
        self._add_volatility_indicators(registry)

        return registry

    def _add_overlap_indicators(self, registry: Dict[str, IndicatorDefinition]) -> None:
        """Add overlap indicators to registry"""

        registry["SMA"] = IndicatorDefinition(
            indicator_id="SMA",
            name="Simple Moving Average",
            display_name="SMA",
            category="overlap",
            description="Simple moving average of closing prices",
            talib_function="SMA",
            talib_group="Overlap Studies",
            parameters=[
                {
                    "name": "timeperiod",
                    "display_name": "Time Period",
                    "parameter_type": "integer",
                    "default_value": 30,
                    "min_value": 2,
                    "max_value": 200,
                    "description": "Number of periods for SMA calculation",
                    "is_required": True
                }
            ],
            outputs=[
                {
                    "name": "sma",
                    "display_name": "SMA",
                    "data_type": "indicator",
                    "description": "Simple moving average values",
                    "is_primary": True
                }
            ],
            min_periods=30,
            lookback_period=30,
            is_overlay=True,
            interpretation="Price above SMA indicates uptrend, below indicates downtrend",
            typical_usage="Trend identification and support/resistance levels"
        )

        registry["BBANDS"] = IndicatorDefinition(
            indicator_id="BBANDS",
            name="Bollinger Bands",
            display_name="Bollinger Bands",
            category="volatility",
            description="Volatility bands placed above and below moving average",
            talib_function="BBANDS",
            talib_group="Overlap Studies",
            parameters=[
                {
                    "name": "timeperiod",
                    "display_name": "Time Period",
                    "parameter_type": "integer",
                    "default_value": 20,
                    "min_value": 2,
                    "max_value": 200,
                    "description": "Number of periods for moving average",
                    "is_required": True
                },
                {
                    "name": "nbdevup",
                    "display_name": "Upper Deviations",
                    "parameter_type": "float",
                    "default_value": 2.0,
                    "min_value": 0.1,
                    "max_value": 5.0,
                    "description": "Number of standard deviations for upper band",
                    "is_required": True
                },
                {
                    "name": "nbdevdn",
                    "display_name": "Lower Deviations",
                    "parameter_type": "float",
                    "default_value": 2.0,
                    "min_value": 0.1,
                    "max_value": 5.0,
                    "description": "Number of standard deviations for lower band",
                    "is_required": True
                }
            ],
            outputs=[
                {
                    "name": "upperband",
                    "display_name": "Upper Band",
                    "data_type": "indicator",
                    "description": "Upper Bollinger Band",
                    "is_primary": False
                },
                {
                    "name": "middleband",
                    "display_name": "Middle Band",
                    "data_type": "indicator",
                    "description": "Middle Bollinger Band (SMA)",
                    "is_primary": True
                },
                {
                    "name": "lowerband",
                    "display_name": "Lower Band",
                    "data_type": "indicator",
                    "description": "Lower Bollinger Band",
                    "is_primary": False
                }
            ],
            min_periods=20,
            lookback_period=20,
            is_overlay=True,
            interpretation="Price touching upper band suggests overbought, lower band suggests oversold",
            typical_usage="Volatility analysis and mean reversion strategies"
        )

    def _add_volume_indicators(self, registry: Dict[str, IndicatorDefinition]) -> None:
        """Add volume indicators to registry"""

        registry["OBV"] = IndicatorDefinition(
            indicator_id="OBV",
            name="On Balance Volume",
            display_name="OBV",
            category="volume",
            description="Volume-based momentum indicator",
            talib_function="OBV",
            talib_group="Volume Indicators",
            parameters=[],
            outputs=[
                {
                    "name": "obv",
                    "display_name": "OBV",
                    "data_type": "indicator",
                    "description": "On Balance Volume values",
                    "is_primary": True
                }
            ],
            min_periods=1,
            lookback_period=1,
            is_overlay=False,
            interpretation="Rising OBV confirms uptrend, falling OBV confirms downtrend",
            typical_usage="Volume confirmation of price trends"
        )

    def _add_volatility_indicators(self, registry: Dict[str, IndicatorDefinition]) -> None:
        """Add volatility indicators to registry"""

        registry["ATR"] = IndicatorDefinition(
            indicator_id="ATR",
            name="Average True Range",
            display_name="ATR",
            category="volatility",
            description="Measure of market volatility",
            talib_function="ATR",
            talib_group="Volatility Indicators",
            parameters=[
                {
                    "name": "timeperiod",
                    "display_name": "Time Period",
                    "parameter_type": "integer",
                    "default_value": 14,
                    "min_value": 1,
                    "max_value": 100,
                    "description": "Number of periods for ATR calculation",
                    "is_required": True
                }
            ],
            outputs=[
                {
                    "name": "atr",
                    "display_name": "ATR",
                    "data_type": "indicator",
                    "description": "Average True Range values",
                    "is_primary": True
                }
            ],
            min_periods=14,
            lookback_period=14,
            is_overlay=False,
            interpretation="Higher ATR indicates higher volatility",
            typical_usage="Risk management and position sizing"
        )

    async def execute_graph(
        self,
        graph: ComputationGraph,
        request: ComputeGraphRequest
    ) -> ComputeGraphResponse:
        """Execute a computation graph with dependency resolution and caching"""

        start_time = time.time()
        computation_id = f"{graph.graph_id}_{request.symbol}_{int(start_time)}"

        try:
            # Validate graph
            await self._validate_graph(graph)

            # Get market data
            market_data = await self._fetch_market_data(request)

            # Build execution plan
            execution_plan = await self._build_execution_plan(graph)

            # Execute nodes in dependency order
            node_results = await self._execute_nodes(
                graph, execution_plan, market_data, request
            )

            # Generate signals
            signals = await self._generate_signals(graph, node_results, market_data)

            # Calculate performance metrics
            execution_time = (time.time() - start_time) * 1000
            cache_hit_ratio = self._calculate_cache_hit_ratio(computation_id)

            # Update statistics
            await self._update_execution_stats(execution_time, len(node_results))

            response = ComputeGraphResponse(
                graph_id=graph.graph_id,
                symbol=request.symbol,
                timeframe=request.timeframe,
                node_results=node_results,
                timestamps=market_data["timestamps"],
                computation_time_ms=execution_time,
                cache_hit_ratio=cache_hit_ratio,
                data_points=len(market_data["timestamps"]),
                generated_signals=signals
            )

            logger.info(f"Executed graph {graph.graph_id} for {request.symbol} in {execution_time:.2f}ms")
            return response

        except Exception as e:
            self.execution_stats["error_count"] += 1
            logger.error(f"Graph execution failed: {str(e)}\n{traceback.format_exc()}")
            raise GraphExecutionError(f"Graph execution failed: {str(e)}")

    async def _validate_graph(self, graph: ComputationGraph) -> None:
        """Validate graph structure and detect cycles"""

        if not graph.nodes:
            raise GraphExecutionError("Graph has no nodes")

        # Check for cycles using DFS
        node_ids = {node.node_id for node in graph.nodes}

        # Build adjacency list
        adj_list = defaultdict(list)
        for edge in graph.edges:
            if edge.source_node_id not in node_ids:
                raise GraphExecutionError(f"Edge references unknown source node: {edge.source_node_id}")
            if edge.target_node_id not in node_ids:
                raise GraphExecutionError(f"Edge references unknown target node: {edge.target_node_id}")

            adj_list[edge.source_node_id].append(edge.target_node_id)

        # DFS cycle detection
        visited = set()
        rec_stack = set()

        def has_cycle(node_id: str) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)

            for neighbor in adj_list[node_id]:
                if neighbor not in visited:
                    if has_cycle(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True

            rec_stack.remove(node_id)
            return False

        for node_id in node_ids:
            if node_id not in visited:
                if has_cycle(node_id):
                    raise CyclicGraphError("Graph contains cycles")

        # Validate indicator references
        for node in graph.nodes:
            if node.indicator_id not in self.indicator_registry:
                raise GraphExecutionError(f"Unknown indicator: {node.indicator_id}", node.node_id)

    async def _fetch_market_data(self, request: ComputeGraphRequest) -> Dict[str, Any]:
        """Fetch market data for computation"""

        # Calculate date range
        end_date = request.end_date or datetime.utcnow()
        start_date = request.start_date or (end_date - timedelta(days=365))

        # Fetch from stock service
        price_data = await self.stock_service.get_price_history(
            request.symbol,
            period="1y",  # Adjust based on timeframe
            interval="1d"  # Adjust based on timeframe
        )

        if not price_data:
            raise GraphExecutionError(f"Failed to fetch market data for {request.symbol}")

        # Convert to computation format
        df = pd.DataFrame(price_data)

        return {
            "timestamps": df.index.tolist(),
            "open": df["open"].values,
            "high": df["high"].values,
            "low": df["low"].values,
            "close": df["close"].values,
            "volume": df["volume"].values if "volume" in df.columns else np.zeros(len(df))
        }

    async def _build_execution_plan(self, graph: ComputationGraph) -> List[List[str]]:
        """Build execution plan with topological sorting for parallel execution"""

        # Build dependency graph
        dependencies = defaultdict(set)
        dependents = defaultdict(set)

        for edge in graph.edges:
            dependencies[edge.target_node_id].add(edge.source_node_id)
            dependents[edge.source_node_id].add(edge.target_node_id)

        # Topological sort with levels for parallel execution
        in_degree = defaultdict(int)
        for node in graph.nodes:
            in_degree[node.node_id] = len(dependencies[node.node_id])

        execution_levels = []
        queue = deque([node_id for node_id in in_degree if in_degree[node_id] == 0])

        while queue:
            current_level = []
            level_size = len(queue)

            for _ in range(level_size):
                node_id = queue.popleft()
                current_level.append(node_id)

                # Decrease in-degree of dependent nodes
                for dependent in dependents[node_id]:
                    in_degree[dependent] -= 1
                    if in_degree[dependent] == 0:
                        queue.append(dependent)

            execution_levels.append(current_level)

        # Verify all nodes are included
        total_nodes = sum(len(level) for level in execution_levels)
        if total_nodes != len(graph.nodes):
            raise GraphExecutionError("Failed to create execution plan - possible cycle detected")

        return execution_levels

    async def _execute_nodes(
        self,
        graph: ComputationGraph,
        execution_plan: List[List[str]],
        market_data: Dict[str, Any],
        request: ComputeGraphRequest
    ) -> Dict[str, Dict[str, List[float]]]:
        """Execute nodes in dependency order with parallel execution within levels"""

        node_map = {node.node_id: node for node in graph.nodes}
        edge_map = defaultdict(list)

        # Build edge lookup
        for edge in graph.edges:
            edge_map[edge.target_node_id].append(edge)

        all_results = {}

        # Execute each level
        for level_nodes in execution_plan:
            if len(level_nodes) == 1:
                # Single node - execute directly
                node_id = level_nodes[0]
                node = node_map[node_id]
                result = await self._execute_single_node(
                    node, edge_map[node_id], all_results, market_data, request
                )
                all_results[node_id] = result
            else:
                # Multiple nodes - execute in parallel
                tasks = []
                for node_id in level_nodes:
                    node = node_map[node_id]
                    task = self._execute_single_node(
                        node, edge_map[node_id], all_results, market_data, request
                    )
                    tasks.append((node_id, task))

                # Wait for all tasks in this level
                for node_id, task in tasks:
                    result = await task
                    all_results[node_id] = result

        return all_results

    async def _execute_single_node(
        self,
        node: ComputationNode,
        input_edges: List[ComputationEdge],
        previous_results: Dict[str, Dict[str, List[float]]],
        market_data: Dict[str, Any],
        request: ComputeGraphRequest
    ) -> Dict[str, List[float]]:
        """Execute a single computation node"""

        if not node.is_enabled:
            return {}

        # Check cache first
        cache_key = self._build_cache_key(node, request)
        cached_result = await self._get_cached_result(cache_key)
        if cached_result and not request.force_refresh:
            self.execution_stats["cache_hits"] += 1
            return cached_result

        self.execution_stats["cache_misses"] += 1

        try:
            # Get indicator definition
            indicator_def = self.indicator_registry[node.indicator_id]

            # Prepare input data
            input_data = await self._prepare_node_inputs(
                node, input_edges, previous_results, market_data
            )

            # Validate parameters
            validated_params = await self._validate_node_parameters(node, indicator_def)

            # Execute TA-Lib function
            result = await self._execute_talib_function(
                indicator_def, input_data, validated_params
            )

            # Cache result
            if result:
                await self._cache_result(cache_key, result)

            return result

        except Exception as e:
            logger.error(f"Node execution failed for {node.node_id}: {str(e)}")
            raise GraphExecutionError(f"Node execution failed: {str(e)}", node.node_id)

    async def _prepare_node_inputs(
        self,
        node: ComputationNode,
        input_edges: List[ComputationEdge],
        previous_results: Dict[str, Dict[str, List[float]]],
        market_data: Dict[str, Any]
    ) -> Dict[str, np.ndarray]:
        """Prepare input data for node execution"""

        inputs = {}

        # Start with price data
        inputs["open"] = np.array(market_data["open"])
        inputs["high"] = np.array(market_data["high"])
        inputs["low"] = np.array(market_data["low"])
        inputs["close"] = np.array(market_data["close"])
        inputs["volume"] = np.array(market_data["volume"])

        # Add inputs from other nodes
        for edge in input_edges:
            source_results = previous_results.get(edge.source_node_id, {})
            if edge.source_output in source_results:
                inputs[edge.target_input] = np.array(source_results[edge.source_output])
            else:
                raise MissingDependencyError(
                    f"Missing input {edge.source_output} from node {edge.source_node_id}",
                    node.node_id
                )

        return inputs

    async def _validate_node_parameters(
        self,
        node: ComputationNode,
        indicator_def: IndicatorDefinition
    ) -> Dict[str, Any]:
        """Validate and prepare node parameters"""

        validated_params = {}

        for param_def in indicator_def.parameters:
            param_name = param_def.name

            if param_name in node.parameters:
                value = node.parameters[param_name]
            else:
                if param_def.is_required:
                    raise GraphExecutionError(
                        f"Missing required parameter: {param_name}",
                        node.node_id
                    )
                value = param_def.default_value

            # Type validation
            if param_def.parameter_type == ParameterType.INTEGER:
                value = int(value)
                if param_def.min_value is not None and value < param_def.min_value:
                    raise GraphExecutionError(
                        f"Parameter {param_name} below minimum: {value} < {param_def.min_value}",
                        node.node_id
                    )
                if param_def.max_value is not None and value > param_def.max_value:
                    raise GraphExecutionError(
                        f"Parameter {param_name} above maximum: {value} > {param_def.max_value}",
                        node.node_id
                    )

            elif param_def.parameter_type == ParameterType.FLOAT:
                value = float(value)
                if param_def.min_value is not None and value < param_def.min_value:
                    raise GraphExecutionError(
                        f"Parameter {param_name} below minimum: {value} < {param_def.min_value}",
                        node.node_id
                    )
                if param_def.max_value is not None and value > param_def.max_value:
                    raise GraphExecutionError(
                        f"Parameter {param_name} above maximum: {value} > {param_def.max_value}",
                        node.node_id
                    )

            validated_params[param_name] = value

        return validated_params

    async def _execute_talib_function(
        self,
        indicator_def: IndicatorDefinition,
        input_data: Dict[str, np.ndarray],
        parameters: Dict[str, Any]
    ) -> Dict[str, List[float]]:
        """Execute TA-Lib function with error handling"""

        try:
            # Get TA-Lib function
            talib_func = getattr(talib, indicator_def.talib_function)

            # Prepare function arguments
            args = []
            kwargs = {}

            # Add price inputs based on function signature
            if indicator_def.talib_function in ["RSI", "SMA", "EMA", "ATR"]:
                # Single price input (usually close)
                if "close" in input_data:
                    args.append(input_data["close"])
                else:
                    raise GraphExecutionError(f"Missing close price data for {indicator_def.talib_function}")

            elif indicator_def.talib_function in ["MACD", "STOCH", "BBANDS"]:
                # Multiple price inputs
                if indicator_def.talib_function == "BBANDS":
                    args.append(input_data["close"])
                elif indicator_def.talib_function == "STOCH":
                    args.extend([input_data["high"], input_data["low"], input_data["close"]])
                elif indicator_def.talib_function == "MACD":
                    args.append(input_data["close"])

            elif indicator_def.talib_function == "OBV":
                args.extend([input_data["close"], input_data["volume"]])

            # Add parameters
            kwargs.update(parameters)

            # Execute function
            result = talib_func(*args, **kwargs)

            # Format results
            if isinstance(result, tuple):
                # Multiple outputs
                output_dict = {}
                for i, output_def in enumerate(indicator_def.outputs):
                    if i < len(result):
                        values = result[i]
                        # Replace NaN with None, then filter out None values
                        cleaned_values = [float(x) if not np.isnan(x) else None for x in values]
                        output_dict[output_def.name] = cleaned_values
                return output_dict
            else:
                # Single output
                primary_output = next(
                    (out for out in indicator_def.outputs if out.is_primary),
                    indicator_def.outputs[0]
                )
                cleaned_values = [float(x) if not np.isnan(x) else None for x in result]
                return {primary_output.name: cleaned_values}

        except Exception as e:
            logger.error(f"TA-Lib execution failed for {indicator_def.talib_function}: {str(e)}")
            raise GraphExecutionError(f"TA-Lib execution failed: {str(e)}")

    async def _generate_signals(
        self,
        graph: ComputationGraph,
        node_results: Dict[str, Dict[str, List[float]]],
        market_data: Dict[str, Any]
    ) -> List[IndicatorSignal]:
        """Generate trading signals from indicator results"""

        signals = []
        timestamps = market_data["timestamps"]
        close_prices = market_data["close"]

        for node in graph.nodes:
            if not node.is_enabled or node.node_id not in node_results:
                continue

            try:
                node_signals = await self._generate_node_signals(
                    node, node_results[node.node_id], timestamps, close_prices
                )
                signals.extend(node_signals)
            except Exception as e:
                logger.warning(f"Signal generation failed for node {node.node_id}: {str(e)}")

        return signals

    async def _generate_node_signals(
        self,
        node: ComputationNode,
        results: Dict[str, List[float]],
        timestamps: List[datetime],
        close_prices: List[float]
    ) -> List[IndicatorSignal]:
        """Generate signals for a specific node"""

        signals = []
        indicator_def = self.indicator_registry[node.indicator_id]

        # Simple signal generation based on indicator type
        if indicator_def.indicator_id == "RSI":
            rsi_values = results.get("rsi", [])
            for i in range(1, len(rsi_values)):
                if rsi_values[i] is None or rsi_values[i-1] is None:
                    continue

                current_rsi = rsi_values[i]
                previous_rsi = rsi_values[i-1]

                # Oversold to normal
                if previous_rsi <= 30 and current_rsi > 30:
                    signals.append(IndicatorSignal(
                        node_id=node.node_id,
                        indicator_name="RSI",
                        signal_type="buy",
                        strength=min(1.0, (30 - previous_rsi) / 10),
                        confidence=0.7,
                        timestamp=timestamps[i],
                        timeframe=TimeFrame.DAY_1,
                        current_value=current_rsi,
                        previous_value=previous_rsi,
                        trigger_condition="RSI crossed above 30 (oversold recovery)",
                        price_at_signal=close_prices[i]
                    ))

                # Overbought to normal
                elif previous_rsi >= 70 and current_rsi < 70:
                    signals.append(IndicatorSignal(
                        node_id=node.node_id,
                        indicator_name="RSI",
                        signal_type="sell",
                        strength=min(1.0, (previous_rsi - 70) / 10),
                        confidence=0.7,
                        timestamp=timestamps[i],
                        timeframe=TimeFrame.DAY_1,
                        current_value=current_rsi,
                        previous_value=previous_rsi,
                        trigger_condition="RSI crossed below 70 (overbought correction)",
                        price_at_signal=close_prices[i]
                    ))

        elif indicator_def.indicator_id == "MACD":
            macd_values = results.get("macd", [])
            signal_values = results.get("macdsignal", [])

            for i in range(1, min(len(macd_values), len(signal_values))):
                if (macd_values[i] is None or signal_values[i] is None or
                    macd_values[i-1] is None or signal_values[i-1] is None):
                    continue

                current_macd = macd_values[i]
                current_signal = signal_values[i]
                previous_macd = macd_values[i-1]
                previous_signal = signal_values[i-1]

                # Bullish crossover
                if previous_macd <= previous_signal and current_macd > current_signal:
                    signals.append(IndicatorSignal(
                        node_id=node.node_id,
                        indicator_name="MACD",
                        signal_type="buy",
                        strength=0.8,
                        confidence=0.75,
                        timestamp=timestamps[i],
                        timeframe=TimeFrame.DAY_1,
                        current_value=current_macd - current_signal,
                        previous_value=previous_macd - previous_signal,
                        trigger_condition="MACD crossed above signal line",
                        price_at_signal=close_prices[i]
                    ))

                # Bearish crossover
                elif previous_macd >= previous_signal and current_macd < current_signal:
                    signals.append(IndicatorSignal(
                        node_id=node.node_id,
                        indicator_name="MACD",
                        signal_type="sell",
                        strength=0.8,
                        confidence=0.75,
                        timestamp=timestamps[i],
                        timeframe=TimeFrame.DAY_1,
                        current_value=current_macd - current_signal,
                        previous_value=previous_macd - previous_signal,
                        trigger_condition="MACD crossed below signal line",
                        price_at_signal=close_prices[i]
                    ))

        return signals

    def _build_cache_key(self, node: ComputationNode, request: ComputeGraphRequest) -> str:
        """Build cache key for node results"""
        param_hash = hash(str(sorted(node.parameters.items())))
        return f"indicator:{node.indicator_id}:{request.symbol}:{request.timeframe.value}:{param_hash}"

    async def _get_cached_result(self, cache_key: str) -> Optional[Dict[str, List[float]]]:
        """Get cached computation result"""
        try:
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                return eval(cached_data)  # In production, use proper JSON serialization
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {str(e)}")
        return None

    async def _cache_result(self, cache_key: str, result: Dict[str, List[float]]) -> None:
        """Cache computation result"""
        try:
            await self.redis_client.setex(
                cache_key,
                300,  # 5 minutes TTL
                str(result)  # In production, use proper JSON serialization
            )
        except Exception as e:
            logger.warning(f"Cache storage failed: {str(e)}")

    def _calculate_cache_hit_ratio(self, computation_id: str) -> float:
        """Calculate cache hit ratio for this computation"""
        total_requests = self.execution_stats["cache_hits"] + self.execution_stats["cache_misses"]
        if total_requests == 0:
            return 0.0
        return self.execution_stats["cache_hits"] / total_requests

    async def _update_execution_stats(self, execution_time: float, node_count: int) -> None:
        """Update execution statistics"""
        self.execution_stats["total_computations"] += 1

        # Update average execution time
        current_avg = self.execution_stats["average_execution_time"]
        total_computations = self.execution_stats["total_computations"]

        self.execution_stats["average_execution_time"] = (
            (current_avg * (total_computations - 1) + execution_time) / total_computations
        )

    def get_indicator_registry(self) -> Dict[str, IndicatorDefinition]:
        """Get the complete indicator registry"""
        return self.indicator_registry.copy()

    def get_execution_statistics(self) -> Dict[str, Any]:
        """Get execution performance statistics"""
        return self.execution_stats.copy()

    async def validate_graph_async(self, graph: ComputationGraph) -> Dict[str, Any]:
        """Validate graph and return validation results"""
        try:
            await self._validate_graph(graph)
            return {
                "is_valid": True,
                "errors": [],
                "warnings": []
            }
        except Exception as e:
            return {
                "is_valid": False,
                "errors": [str(e)],
                "warnings": []
            }

    async def cleanup(self) -> None:
        """Cleanup resources"""
        self.thread_pool.shutdown(wait=True)
        logger.info("Indicator computation engine cleaned up")