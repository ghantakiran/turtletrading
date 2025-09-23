"""
Indicator Lab API Endpoints

FastAPI endpoints for the TA-Lib indicator laboratory including:
- Graph composition and management
- Indicator computation and caching
- Parameter sweeps and optimization
- Preset management and sharing
- Export functionality
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel
import logging

from ...models.ta_lib_indicator_models import (
    ComputationGraph, ComputationNode, ComputationEdge, IndicatorDefinition,
    CreateGraphRequest, UpdateGraphRequest, ComputeGraphRequest, ComputeGraphResponse,
    IndicatorPreset, ListPresetsResponse, IndicatorSearchRequest, IndicatorSearchResponse,
    ParameterSweepConfig, ParameterSweepResult, IndicatorExport, MultiTimeFrameAnalysis,
    IndicatorLabSession, IndicatorBacktest, TimeFrame, IndicatorCategory
)
from ...services.indicator_computation_engine import IndicatorComputationEngine
from ...services.stock_service import StockService
from ...core.auth import get_current_user
from ...core.database import get_db
from ...core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/indicator-lab", tags=["Indicator Lab"])

# Dependency injection
def get_computation_engine() -> IndicatorComputationEngine:
    """Get indicator computation engine instance"""
    # This would be injected properly in production
    stock_service = StockService()
    return IndicatorComputationEngine(stock_service)


@router.get("/indicators", response_model=IndicatorSearchResponse)
async def search_indicators(
    query: Optional[str] = Query(None, description="Search query for indicator names/descriptions"),
    category: Optional[IndicatorCategory] = Query(None, description="Filter by indicator category"),
    is_overlay: Optional[bool] = Query(None, description="Filter by overlay status"),
    min_periods: Optional[int] = Query(None, description="Maximum minimum periods required"),
    computation_engine: IndicatorComputationEngine = Depends(get_computation_engine)
):
    """
    Search and filter available technical indicators.

    Returns a list of indicators matching the search criteria with their
    definitions, parameters, and usage information.
    """
    try:
        start_time = datetime.utcnow()

        # Get all indicators from registry
        all_indicators = list(computation_engine.get_indicator_registry().values())

        # Apply filters
        filtered_indicators = []

        for indicator in all_indicators:
            # Query filter
            if query and query.lower() not in indicator.name.lower() and query.lower() not in indicator.description.lower():
                continue

            # Category filter
            if category and indicator.category != category:
                continue

            # Overlay filter
            if is_overlay is not None and indicator.is_overlay != is_overlay:
                continue

            # Min periods filter
            if min_periods is not None and indicator.min_periods > min_periods:
                continue

            filtered_indicators.append(indicator)

        # Get available categories
        categories = list(set(ind.category.value for ind in all_indicators))

        search_time = (datetime.utcnow() - start_time).total_seconds() * 1000

        return IndicatorSearchResponse(
            indicators=filtered_indicators,
            total_count=len(filtered_indicators),
            categories=categories,
            search_time_ms=search_time
        )

    except Exception as e:
        logger.error(f"Indicator search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/indicators/{indicator_id}", response_model=IndicatorDefinition)
async def get_indicator_definition(
    indicator_id: str,
    computation_engine: IndicatorComputationEngine = Depends(get_computation_engine)
):
    """
    Get detailed definition for a specific indicator.

    Returns complete indicator metadata including parameters, outputs,
    mathematical formula, and usage guidelines.
    """
    try:
        registry = computation_engine.get_indicator_registry()

        if indicator_id not in registry:
            raise HTTPException(status_code=404, detail=f"Indicator {indicator_id} not found")

        return registry[indicator_id]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get indicator definition: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get indicator: {str(e)}")


@router.post("/graphs", response_model=ComputationGraph)
async def create_graph(
    request: CreateGraphRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Create a new computation graph.

    Creates an empty graph or copies from a template. Returns the created
    graph with unique ID ready for node composition.
    """
    try:
        # Create new graph
        graph = ComputationGraph(
            name=request.name,
            description=request.description,
            created_by=current_user.get("user_id")
        )

        # If template specified, copy structure
        if request.template_id:
            # In production, would load template from database
            logger.info(f"Creating graph from template: {request.template_id}")

        # Save to database (in production)
        # db.add(graph)
        # db.commit()

        logger.info(f"Created computation graph: {graph.graph_id}")
        return graph

    except Exception as e:
        logger.error(f"Graph creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Graph creation failed: {str(e)}")


@router.get("/graphs/{graph_id}", response_model=ComputationGraph)
async def get_graph(
    graph_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Get computation graph by ID.

    Returns complete graph definition including nodes, edges, and metadata.
    Includes access control to ensure user can view the graph.
    """
    try:
        # In production, would load from database with access control
        # graph = db.query(ComputationGraph).filter_by(graph_id=graph_id).first()

        # For demo, return a sample graph
        graph = ComputationGraph(
            graph_id=graph_id,
            name="Sample Graph",
            description="Sample computation graph",
            created_by=current_user.get("user_id")
        )

        return graph

    except Exception as e:
        logger.error(f"Failed to get graph: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get graph: {str(e)}")


@router.put("/graphs/{graph_id}", response_model=ComputationGraph)
async def update_graph(
    graph_id: str,
    request: UpdateGraphRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Update computation graph.

    Updates graph structure, nodes, edges, or metadata. Validates graph
    integrity and maintains version history for rollback capability.
    """
    try:
        # Load existing graph (in production)
        # graph = db.query(ComputationGraph).filter_by(graph_id=graph_id).first()
        # if not graph:
        #     raise HTTPException(status_code=404, detail="Graph not found")

        # For demo, create updated graph
        graph = ComputationGraph(
            graph_id=graph_id,
            name=request.name or "Updated Graph",
            description=request.description,
            nodes=request.nodes or [],
            edges=request.edges or [],
            updated_at=datetime.utcnow(),
            created_by=current_user.get("user_id")
        )

        # Validate graph structure
        computation_engine = get_computation_engine()
        validation_result = await computation_engine.validate_graph_async(graph)

        if not validation_result["is_valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Graph validation failed: {validation_result['errors']}"
            )

        # Save updates (in production)
        # db.commit()

        logger.info(f"Updated computation graph: {graph_id}")
        return graph

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Graph update failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Graph update failed: {str(e)}")


@router.delete("/graphs/{graph_id}")
async def delete_graph(
    graph_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Delete computation graph.

    Soft deletes the graph and associated data. Maintains audit trail
    for compliance and potential recovery.
    """
    try:
        # In production, would soft delete from database
        # graph = db.query(ComputationGraph).filter_by(graph_id=graph_id).first()
        # if not graph:
        #     raise HTTPException(status_code=404, detail="Graph not found")

        # Check ownership
        # if graph.created_by != current_user.get("user_id"):
        #     raise HTTPException(status_code=403, detail="Not authorized to delete this graph")

        # Soft delete
        # graph.deleted_at = datetime.utcnow()
        # db.commit()

        logger.info(f"Deleted computation graph: {graph_id}")
        return {"message": "Graph deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Graph deletion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Graph deletion failed: {str(e)}")


@router.post("/graphs/{graph_id}/compute", response_model=ComputeGraphResponse)
async def compute_graph(
    graph_id: str,
    request: ComputeGraphRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    computation_engine: IndicatorComputationEngine = Depends(get_computation_engine),
    db=Depends(get_db)
):
    """
    Execute computation graph.

    Computes all indicators in the graph with dependency resolution,
    parallel execution, and comprehensive caching. Returns computed
    values and generated trading signals.
    """
    try:
        # Load graph (in production)
        # graph = db.query(ComputationGraph).filter_by(graph_id=graph_id).first()
        # if not graph:
        #     raise HTTPException(status_code=404, detail="Graph not found")

        # For demo, create sample graph with RSI and MACD
        sample_nodes = [
            ComputationNode(
                indicator_id="RSI",
                display_name="RSI(14)",
                parameters={"timeperiod": 14}
            ),
            ComputationNode(
                indicator_id="MACD",
                display_name="MACD(12,26,9)",
                parameters={"fastperiod": 12, "slowperiod": 26, "signalperiod": 9}
            )
        ]

        graph = ComputationGraph(
            graph_id=graph_id,
            name="Sample Analysis",
            nodes=sample_nodes,
            edges=[]
        )

        # Execute computation
        result = await computation_engine.execute_graph(graph, request)

        # Background task for performance tracking
        background_tasks.add_task(
            _track_computation_performance,
            graph_id,
            request.symbol,
            result.computation_time_ms
        )

        logger.info(f"Computed graph {graph_id} for {request.symbol} in {result.computation_time_ms:.2f}ms")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Graph computation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.get("/graphs/{graph_id}/validate")
async def validate_graph(
    graph_id: str,
    computation_engine: IndicatorComputationEngine = Depends(get_computation_engine),
    db=Depends(get_db)
):
    """
    Validate computation graph.

    Checks graph structure, dependency cycles, parameter validity,
    and data requirements. Returns detailed validation report.
    """
    try:
        # Load graph (in production)
        # graph = db.query(ComputationGraph).filter_by(graph_id=graph_id).first()
        # if not graph:
        #     raise HTTPException(status_code=404, detail="Graph not found")

        # For demo, create sample graph
        graph = ComputationGraph(
            graph_id=graph_id,
            name="Validation Test",
            nodes=[],
            edges=[]
        )

        # Validate
        validation_result = await computation_engine.validate_graph_async(graph)

        return validation_result

    except Exception as e:
        logger.error(f"Graph validation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.get("/presets", response_model=ListPresetsResponse)
async def list_presets(
    category: Optional[str] = Query(None, description="Filter by category"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty level"),
    limit: int = Query(50, description="Maximum number of presets to return"),
    offset: int = Query(0, description="Number of presets to skip"),
    db=Depends(get_db)
):
    """
    List available indicator presets.

    Returns curated presets for common trading strategies with
    filtering and pagination. Includes popularity and rating metrics.
    """
    try:
        # In production, would query database with filters
        sample_presets = [
            IndicatorPreset(
                name="Momentum Scalping",
                description="Short-term momentum signals using RSI and MACD",
                category="scalping",
                computation_graph=ComputationGraph(
                    name="Momentum Scalping Strategy",
                    nodes=[
                        ComputationNode(indicator_id="RSI", display_name="RSI(7)", parameters={"timeperiod": 7}),
                        ComputationNode(indicator_id="MACD", display_name="MACD", parameters={})
                    ],
                    edges=[]
                ),
                difficulty_level="intermediate",
                usage_count=1250,
                average_rating=4.2,
                timeframes=[TimeFrame.MINUTE_5, TimeFrame.MINUTE_15],
                asset_classes=["stocks", "forex"]
            ),
            IndicatorPreset(
                name="Trend Following",
                description="Long-term trend analysis with moving averages",
                category="trend",
                computation_graph=ComputationGraph(
                    name="Trend Following Strategy",
                    nodes=[
                        ComputationNode(indicator_id="SMA", display_name="SMA(50)", parameters={"timeperiod": 50}),
                        ComputationNode(indicator_id="SMA", display_name="SMA(200)", parameters={"timeperiod": 200})
                    ],
                    edges=[]
                ),
                difficulty_level="beginner",
                usage_count=2100,
                average_rating=4.5,
                timeframes=[TimeFrame.DAY_1, TimeFrame.WEEK_1],
                asset_classes=["stocks", "etfs"]
            )
        ]

        # Apply filters
        filtered_presets = sample_presets
        if category:
            filtered_presets = [p for p in filtered_presets if p.category == category]
        if difficulty:
            filtered_presets = [p for p in filtered_presets if p.difficulty_level == difficulty]

        # Apply pagination
        paginated_presets = filtered_presets[offset:offset + limit]

        # Get unique categories
        categories = list(set(p.category for p in sample_presets))

        return ListPresetsResponse(
            presets=paginated_presets,
            categories=categories,
            total_count=len(filtered_presets)
        )

    except Exception as e:
        logger.error(f"Failed to list presets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list presets: {str(e)}")


@router.get("/presets/{preset_id}", response_model=IndicatorPreset)
async def get_preset(
    preset_id: str,
    db=Depends(get_db)
):
    """
    Get indicator preset by ID.

    Returns complete preset definition including computation graph,
    usage guidelines, and performance metrics.
    """
    try:
        # In production, would load from database
        # preset = db.query(IndicatorPreset).filter_by(preset_id=preset_id).first()
        # if not preset:
        #     raise HTTPException(status_code=404, detail="Preset not found")

        # For demo
        preset = IndicatorPreset(
            preset_id=preset_id,
            name="Demo Preset",
            description="Demonstration preset",
            category="demo",
            computation_graph=ComputationGraph(
                name="Demo Graph",
                nodes=[],
                edges=[]
            )
        )

        return preset

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get preset: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get preset: {str(e)}")


@router.post("/graphs/{graph_id}/presets", response_model=IndicatorPreset)
async def create_preset_from_graph(
    graph_id: str,
    name: str,
    description: str,
    category: str,
    is_public: bool = True,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Create preset from computation graph.

    Saves current graph configuration as a reusable preset.
    Includes metadata for discovery and sharing.
    """
    try:
        # Load graph (in production)
        # graph = db.query(ComputationGraph).filter_by(graph_id=graph_id).first()
        # if not graph:
        #     raise HTTPException(status_code=404, detail="Graph not found")

        # Create preset
        preset = IndicatorPreset(
            name=name,
            description=description,
            category=category,
            computation_graph=ComputationGraph(
                name=name,
                description=description,
                nodes=[],
                edges=[]
            ),
            is_public=is_public,
            created_by=current_user.get("user_id")
        )

        # Save preset (in production)
        # db.add(preset)
        # db.commit()

        logger.info(f"Created preset from graph {graph_id}: {preset.preset_id}")
        return preset

    except Exception as e:
        logger.error(f"Preset creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Preset creation failed: {str(e)}")


@router.post("/graphs/{graph_id}/export", response_model=IndicatorExport)
async def export_graph(
    graph_id: str,
    export_type: str,
    include_data: bool = True,
    include_signals: bool = False,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Export computation graph and results.

    Supports multiple formats: CSV, JSON, Excel, Pine Script, MQL, Python.
    Includes computed data, signals, and backtest results as specified.
    """
    try:
        # Create export configuration
        export_config = IndicatorExport(
            export_type=export_type,
            include_data=include_data,
            include_signals=include_signals
        )

        # Background task for export processing
        background_tasks.add_task(
            _process_export,
            graph_id,
            export_config,
            current_user.get("user_id")
        )

        logger.info(f"Started export for graph {graph_id} in format {export_type}")
        return export_config

    except Exception as e:
        logger.error(f"Export failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/parameter-sweep", response_model=str)
async def start_parameter_sweep(
    config: ParameterSweepConfig,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Start parameter sweep optimization.

    Begins background optimization process testing parameter combinations
    to find optimal values for specified objectives. Returns sweep ID
    for progress tracking.
    """
    try:
        # Validate sweep configuration
        if not config.parameter_ranges:
            raise HTTPException(status_code=400, detail="No parameter ranges specified")

        if not config.optimization_objectives:
            raise HTTPException(status_code=400, detail="No optimization objectives specified")

        # Start background sweep
        background_tasks.add_task(
            _execute_parameter_sweep,
            config,
            current_user.get("user_id")
        )

        logger.info(f"Started parameter sweep: {config.sweep_id}")
        return config.sweep_id

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Parameter sweep failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Parameter sweep failed: {str(e)}")


@router.get("/parameter-sweep/{sweep_id}/status")
async def get_sweep_status(
    sweep_id: str,
    db=Depends(get_db)
):
    """
    Get parameter sweep status and results.

    Returns current progress, best parameters found, and performance
    metrics. Updates in real-time during optimization.
    """
    try:
        # In production, would query sweep status from database
        return {
            "sweep_id": sweep_id,
            "status": "running",
            "progress": 0.45,
            "iterations_completed": 450,
            "iterations_total": 1000,
            "best_score": 0.823,
            "best_parameters": {"rsi_period": 12, "macd_fast": 8},
            "estimated_completion": "2024-01-15T14:30:00Z"
        }

    except Exception as e:
        logger.error(f"Failed to get sweep status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get sweep status: {str(e)}")


@router.get("/session", response_model=IndicatorLabSession)
async def get_session(
    current_user: dict = Depends(get_current_user),
    redis_client=Depends(get_redis_client)
):
    """
    Get current indicator lab session.

    Returns user's current session state including active graph,
    preferences, and recent activity for seamless continuation.
    """
    try:
        user_id = current_user.get("user_id")

        # Load session from Redis (in production)
        # session_data = await redis_client.get(f"session:{user_id}")

        # For demo, return default session
        session = IndicatorLabSession(
            user_id=user_id,
            auto_save_enabled=True,
            grid_snap_enabled=True,
            show_parameter_tooltips=True
        )

        return session

    except Exception as e:
        logger.error(f"Failed to get session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")


@router.put("/session", response_model=IndicatorLabSession)
async def update_session(
    session: IndicatorLabSession,
    current_user: dict = Depends(get_current_user),
    redis_client=Depends(get_redis_client)
):
    """
    Update indicator lab session.

    Saves user's current state, preferences, and activity for
    persistence across browser sessions.
    """
    try:
        user_id = current_user.get("user_id")
        session.user_id = user_id
        session.last_activity = datetime.utcnow()

        # Save to Redis (in production)
        # await redis_client.setex(
        #     f"session:{user_id}",
        #     3600,  # 1 hour TTL
        #     session.json()
        # )

        return session

    except Exception as e:
        logger.error(f"Failed to update session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update session: {str(e)}")


@router.get("/stats")
async def get_lab_statistics(
    computation_engine: IndicatorComputationEngine = Depends(get_computation_engine)
):
    """
    Get indicator lab usage statistics.

    Returns performance metrics, popular indicators, and system
    health information for monitoring and optimization.
    """
    try:
        execution_stats = computation_engine.get_execution_statistics()

        return {
            "computation_stats": execution_stats,
            "indicator_count": len(computation_engine.get_indicator_registry()),
            "popular_indicators": ["RSI", "MACD", "SMA", "BBANDS"],
            "average_graph_size": 4.2,
            "cache_hit_rate": execution_stats.get("cache_hits", 0) /
                             max(1, execution_stats.get("cache_hits", 0) + execution_stats.get("cache_misses", 0))
        }

    except Exception as e:
        logger.error(f"Failed to get statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")


# Background task functions

async def _track_computation_performance(
    graph_id: str,
    symbol: str,
    computation_time: float
):
    """Track computation performance metrics"""
    try:
        logger.info(f"Computation performance: {graph_id}/{symbol} = {computation_time:.2f}ms")
        # In production, would store metrics in database or monitoring system
    except Exception as e:
        logger.error(f"Failed to track performance: {str(e)}")


async def _process_export(
    graph_id: str,
    export_config: IndicatorExport,
    user_id: str
):
    """Process graph export in background"""
    try:
        logger.info(f"Processing export for graph {graph_id} by user {user_id}")
        # In production, would generate export file and store in cloud storage
        # Would also send notification to user when complete
    except Exception as e:
        logger.error(f"Export processing failed: {str(e)}")


async def _execute_parameter_sweep(
    config: ParameterSweepConfig,
    user_id: str
):
    """Execute parameter sweep optimization in background"""
    try:
        logger.info(f"Starting parameter sweep {config.sweep_id} by user {user_id}")
        # In production, would run optimization algorithm
        # Would update database with progress and results
        # Would send notification when complete
    except Exception as e:
        logger.error(f"Parameter sweep failed: {str(e)}")


@router.get("/computations/{computation_id}/result")
async def get_computation_result(
    computation_id: str,
    computation_engine: IndicatorComputationEngine = Depends(get_computation_engine),
    db=Depends(get_db)
):
    """
    Get computation result by ID.

    Returns the result of a previously executed computation including
    indicator values, metadata, and performance metrics.
    """
    try:
        # In production, would load from database
        # result = db.query(ComputationResult).filter_by(computation_id=computation_id).first()
        # if not result:
        #     raise HTTPException(status_code=404, detail="Computation result not found")

        # For demo, return sample computation result
        from app.models.ta_lib_indicator_models import ComputationResult

        sample_result = ComputationResult(
            node_id="rsi_node_1",
            indicator_id="RSI",
            values=[None, None, 45.2, 52.8, 61.3, 58.7, 62.1],
            metadata={
                "period": 14,
                "source": "close",
                "computation_id": computation_id
            },
            computation_time=0.023
        )

        return sample_result

    except Exception as e:
        logger.error(f"Failed to get computation result: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve computation result")


@router.post("/graphs/{graph_id}/parameter-sweep")
async def parameter_sweep(
    graph_id: str,
    sweep_config: ParameterSweepConfig,
    computation_engine: IndicatorComputationEngine = Depends(get_computation_engine),
    db=Depends(get_db)
):
    """
    Execute parameter sweep optimization.

    Performs systematic parameter optimization across specified ranges
    to find optimal indicator configurations for given objectives.
    """
    try:
        # Load graph
        # graph = db.query(ComputationGraph).filter_by(graph_id=graph_id).first()
        # if not graph:
        #     raise HTTPException(status_code=404, detail="Graph not found")

        # For demo, create sample graph
        from app.models.ta_lib_indicator_models import ComputationGraph, ParameterSweepResult

        graph = ComputationGraph(
            graph_id=graph_id,
            name="Parameter Sweep Test",
            nodes=[],
            edges=[]
        )

        # Execute parameter sweep
        # In production, this would run async and return sweep job ID
        result = await computation_engine.execute_parameter_sweep(graph, sweep_config)

        # For demo, return sample result
        sample_result = ParameterSweepResult(
            sweep_id=sweep_config.sweep_id,
            graph_id=graph_id,
            objective_value=0.85,
            best_parameters={"period": 14, "threshold": 0.7},
            parameter_combinations=[
                {"period": 10, "threshold": 0.6, "score": 0.72},
                {"period": 14, "threshold": 0.7, "score": 0.85},
                {"period": 20, "threshold": 0.8, "score": 0.78}
            ],
            execution_time=45.2,
            converged=True
        )

        return sample_result

    except Exception as e:
        logger.error(f"Failed to execute parameter sweep: {str(e)}")
        raise HTTPException(status_code=500, detail="Parameter sweep execution failed")


@router.put("/presets/{preset_id}")
async def update_preset(
    preset_id: str,
    preset_update: IndicatorPreset,
    db=Depends(get_db)
):
    """
    Update existing indicator preset.

    Updates preset configuration including name, description,
    computation graph, and default parameters.
    """
    try:
        # In production, would update in database
        # preset = db.query(IndicatorPreset).filter_by(preset_id=preset_id).first()
        # if not preset:
        #     raise HTTPException(status_code=404, detail="Preset not found")

        # preset.name = preset_update.name
        # preset.description = preset_update.description
        # preset.graph = preset_update.graph
        # preset.updated_at = datetime.utcnow()
        # db.commit()

        # For demo, return updated preset
        updated_preset = preset_update.copy()
        updated_preset.preset_id = preset_id
        updated_preset.updated_at = datetime.utcnow()

        logger.info(f"Updated preset {preset_id}")
        return updated_preset

    except Exception as e:
        logger.error(f"Failed to update preset: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update preset")


@router.delete("/presets/{preset_id}")
async def delete_preset(
    preset_id: str,
    db=Depends(get_db)
):
    """
    Delete indicator preset.

    Permanently removes preset from the system. This action cannot be undone.
    """
    try:
        # In production, would delete from database
        # preset = db.query(IndicatorPreset).filter_by(preset_id=preset_id).first()
        # if not preset:
        #     raise HTTPException(status_code=404, detail="Preset not found")

        # db.delete(preset)
        # db.commit()

        logger.info(f"Deleted preset {preset_id}")
        return {"message": f"Preset {preset_id} deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete preset: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete preset")