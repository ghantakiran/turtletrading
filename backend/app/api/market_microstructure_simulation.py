"""
Market Microstructure Simulation API Endpoints

RESTful API endpoints for market microstructure simulation including:
- Simulation configuration and setup
- Real-time simulation control (start, stop, pause)
- Order submission and management
- Results retrieval and analytics
- WebSocket streaming for real-time updates
"""

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
import uuid

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

from ..models.market_microstructure_models import (
    SimulationParameters, MarketOrder, OrderBook, OrderExecution,
    VenueCharacteristics, LatencyModel, SlippageModel, MarketImpactParameters,
    LiquidityDynamics, MicrostructureAnalytics, SimulationState,
    OrderSide, OrderType, ParticipantType, MarketRegime
)
from ..services.order_matching_engine import OrderMatchingEngine, MatchResult
from ..services.order_queue_manager import OrderQueueManager
from ..services.latency_simulation_engine import LatencySimulationEngine
from ..services.csv_market_data_playback import CSVMarketDataPlayback, DataFormat, PlaybackMode

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/simulate", tags=["Market Microstructure Simulation"])

# Global simulation state management
active_simulations: Dict[str, Dict[str, Any]] = {}
websocket_connections: Dict[str, List[WebSocket]] = {}


# Request/Response Models
class SimulationConfigRequest(BaseModel):
    """Request model for simulation configuration"""
    simulation_name: str = Field(..., description="Name for the simulation")
    symbol: str = Field(..., description="Symbol to simulate")

    # Time parameters
    start_time: datetime = Field(..., description="Simulation start time")
    end_time: datetime = Field(..., description="Simulation end time")
    time_step_ms: int = Field(100, description="Simulation time step in milliseconds")

    # Scenario parameters
    scenario: str = Field("normal", description="Simulation scenario (normal, volatile, stress)")
    latency_ms: float = Field(1.0, description="Base latency in milliseconds")
    tick_size: float = Field(0.01, description="Minimum price increment")
    spread_bps: float = Field(5.0, description="Initial spread in basis points")

    # Market data source
    data_source: Optional[str] = Field(None, description="Path to CSV data file")
    data_format: str = Field("custom_trades", description="CSV data format")

    # Order flow parameters
    order_rate_per_minute: float = Field(100.0, description="Base order arrival rate")
    market_order_ratio: float = Field(0.3, description="Ratio of market orders")

    # Participant configuration
    participant_mix: Dict[str, float] = Field(
        default_factory=lambda: {
            "retail": 0.6,
            "institutional": 0.25,
            "high_frequency": 0.1,
            "market_maker": 0.05
        },
        description="Mix of participant types"
    )

    # Random seed for reproducibility
    random_seed: Optional[int] = Field(None, description="Random seed for reproducible results")

    @validator('scenario')
    def validate_scenario(cls, v):
        valid_scenarios = ['normal', 'volatile', 'stress', 'trending', 'ranging']
        if v not in valid_scenarios:
            raise ValueError(f"Scenario must be one of {valid_scenarios}")
        return v


class OrderSubmissionRequest(BaseModel):
    """Request model for order submission"""
    order_type: OrderType
    side: OrderSide
    quantity: int = Field(..., gt=0)
    limit_price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    participant_type: ParticipantType = ParticipantType.RETAIL
    time_in_force: str = Field("DAY", description="Time in force")
    urgency: float = Field(0.5, ge=0.0, le=1.0, description="Execution urgency")


class SimulationResponse(BaseModel):
    """Response model for simulation operations"""
    simulation_id: str
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None


class SimulationStatusResponse(BaseModel):
    """Response model for simulation status"""
    simulation_id: str
    is_running: bool
    is_paused: bool
    current_time: datetime
    events_processed: int
    orders_processed: int
    executions_count: int
    performance_metrics: Dict[str, Any]


class OrderExecutionResponse(BaseModel):
    """Response model for order execution"""
    order_id: str
    executions: List[OrderExecution]
    remaining_quantity: int
    total_executed_quantity: int
    average_execution_price: Decimal
    market_impact_bps: Decimal
    slippage_bps: Decimal
    latency_ms: float


# API Endpoints

@router.post("/configure", response_model=SimulationResponse)
async def configure_simulation(
    config: SimulationConfigRequest,
    background_tasks: BackgroundTasks
) -> SimulationResponse:
    """
    Configure a new market microstructure simulation.

    Sets up all components including order matching engine, queue manager,
    latency simulation, and market data playback.
    """
    try:
        simulation_id = str(uuid.uuid4())

        logger.info(f"Configuring simulation {simulation_id} for symbol {config.symbol}")

        # Create venue characteristics
        venue_characteristics = VenueCharacteristics(
            venue_id=f"SIM_VENUE_{simulation_id[:8]}",
            venue_name="Simulation Venue",
            venue_type="exchange",
            tick_size=Decimal(str(config.tick_size)),
            lot_size=1,
            base_latency_ms=config.latency_ms,
            latency_variance_ms=config.latency_ms * 0.1,
            maker_fee_bps=Decimal("0.1"),
            taker_fee_bps=Decimal("0.3"),
            average_spread_bps=Decimal(str(config.spread_bps))
        )

        # Create latency model
        latency_model = LatencyModel(
            venue=venue_characteristics.venue_id,
            base_network_latency_ms=config.latency_ms,
            network_jitter_ms=config.latency_ms * 0.1,
            order_processing_latency_ms=0.1,
            processing_rate_per_second=1000.0
        )

        # Create market impact parameters
        market_impact_params = MarketImpactParameters(
            symbol=config.symbol,
            average_daily_volume=1000000,
            average_trade_size=100,
            bid_ask_spread_bps=Decimal(str(config.spread_bps))
        )

        # Create slippage model
        slippage_model = SlippageModel(
            symbol=config.symbol,
            linear_impact_coefficient=0.1,
            square_root_impact_coefficient=0.05
        )

        # Create simulation parameters
        simulation_params = SimulationParameters(
            simulation_id=simulation_id,
            start_time=config.start_time,
            end_time=config.end_time,
            time_step_ms=config.time_step_ms,
            symbols=[config.symbol],
            venues=[venue_characteristics.venue_id],
            initial_prices={config.symbol: Decimal("100.00")},
            participant_counts={
                ParticipantType.RETAIL: int(100 * config.participant_mix.get("retail", 0.6)),
                ParticipantType.INSTITUTIONAL: int(100 * config.participant_mix.get("institutional", 0.25)),
                ParticipantType.HIGH_FREQUENCY: int(100 * config.participant_mix.get("high_frequency", 0.1)),
                ParticipantType.MARKET_MAKER: int(100 * config.participant_mix.get("market_maker", 0.05))
            },
            participant_capital={
                ParticipantType.RETAIL: Decimal("10000"),
                ParticipantType.INSTITUTIONAL: Decimal("1000000"),
                ParticipantType.HIGH_FREQUENCY: Decimal("100000"),
                ParticipantType.MARKET_MAKER: Decimal("500000")
            },
            base_order_rate=config.order_rate_per_minute,
            market_order_ratio=config.market_order_ratio,
            tick_sizes={config.symbol: Decimal(str(config.tick_size))},
            lot_sizes={config.symbol: 1},
            random_seed=config.random_seed
        )

        # Initialize components
        order_matching_engine = OrderMatchingEngine(
            symbol=config.symbol,
            venue_characteristics=venue_characteristics,
            latency_model=latency_model,
            slippage_model=slippage_model,
            market_impact_params=market_impact_params,
            simulation_params=simulation_params
        )

        queue_manager = OrderQueueManager(
            venue_characteristics=venue_characteristics,
            latency_model=latency_model,
            simulation_params=simulation_params
        )

        latency_engine = LatencySimulationEngine(
            venue_characteristics=venue_characteristics,
            simulation_params=simulation_params
        )

        # Initialize market data playback if data source provided
        data_playback = None
        if config.data_source:
            data_format = DataFormat(config.data_format)
            data_playback = CSVMarketDataPlayback(
                venue_characteristics=venue_characteristics,
                simulation_params=simulation_params,
                playback_mode=PlaybackMode.REALTIME
            )

            # Load data in background
            background_tasks.add_task(
                data_playback.load_csv_file,
                config.data_source,
                data_format,
                [config.symbol]
            )

        # Store simulation components
        active_simulations[simulation_id] = {
            'config': config,
            'simulation_params': simulation_params,
            'venue_characteristics': venue_characteristics,
            'order_matching_engine': order_matching_engine,
            'queue_manager': queue_manager,
            'latency_engine': latency_engine,
            'data_playback': data_playback,
            'simulation_state': SimulationState(
                simulation_id=simulation_id,
                current_time=config.start_time
            ),
            'created_at': datetime.utcnow(),
            'is_running': False,
            'is_paused': False
        }

        return SimulationResponse(
            simulation_id=simulation_id,
            status="configured",
            message=f"Simulation configured successfully for {config.symbol}",
            data={
                'symbol': config.symbol,
                'scenario': config.scenario,
                'time_range': f"{config.start_time} to {config.end_time}",
                'components': {
                    'order_matching_engine': True,
                    'queue_manager': True,
                    'latency_engine': True,
                    'data_playback': data_playback is not None
                }
            }
        )

    except Exception as e:
        logger.error(f"Error configuring simulation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to configure simulation: {str(e)}")


@router.post("/{simulation_id}/start", response_model=SimulationResponse)
async def start_simulation(
    simulation_id: str,
    background_tasks: BackgroundTasks
) -> SimulationResponse:
    """Start a configured simulation"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]

    if simulation['is_running']:
        raise HTTPException(status_code=400, detail="Simulation already running")

    try:
        simulation['is_running'] = True
        simulation['is_paused'] = False
        simulation['started_at'] = datetime.utcnow()

        # Start data playback if available
        if simulation['data_playback']:
            await simulation['data_playback'].start_playback()

        # Start simulation background task
        background_tasks.add_task(_run_simulation, simulation_id)

        logger.info(f"Started simulation {simulation_id}")

        return SimulationResponse(
            simulation_id=simulation_id,
            status="started",
            message="Simulation started successfully"
        )

    except Exception as e:
        simulation['is_running'] = False
        logger.error(f"Error starting simulation {simulation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start simulation: {str(e)}")


@router.post("/{simulation_id}/stop", response_model=SimulationResponse)
async def stop_simulation(simulation_id: str) -> SimulationResponse:
    """Stop a running simulation"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]

    try:
        simulation['is_running'] = False
        simulation['is_paused'] = False
        simulation['stopped_at'] = datetime.utcnow()

        # Stop data playback if available
        if simulation['data_playback']:
            await simulation['data_playback'].stop_playback()

        # Shutdown queue manager
        if simulation['queue_manager']:
            await simulation['queue_manager'].shutdown()

        logger.info(f"Stopped simulation {simulation_id}")

        return SimulationResponse(
            simulation_id=simulation_id,
            status="stopped",
            message="Simulation stopped successfully"
        )

    except Exception as e:
        logger.error(f"Error stopping simulation {simulation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to stop simulation: {str(e)}")


@router.post("/{simulation_id}/pause", response_model=SimulationResponse)
async def pause_simulation(simulation_id: str) -> SimulationResponse:
    """Pause a running simulation"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]

    if not simulation['is_running']:
        raise HTTPException(status_code=400, detail="Simulation not running")

    try:
        simulation['is_paused'] = True

        # Pause data playback if available
        if simulation['data_playback']:
            simulation['data_playback'].pause_playback()

        logger.info(f"Paused simulation {simulation_id}")

        return SimulationResponse(
            simulation_id=simulation_id,
            status="paused",
            message="Simulation paused successfully"
        )

    except Exception as e:
        logger.error(f"Error pausing simulation {simulation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to pause simulation: {str(e)}")


@router.post("/{simulation_id}/resume", response_model=SimulationResponse)
async def resume_simulation(simulation_id: str) -> SimulationResponse:
    """Resume a paused simulation"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]

    if not simulation['is_running'] or not simulation['is_paused']:
        raise HTTPException(status_code=400, detail="Simulation not paused")

    try:
        simulation['is_paused'] = False

        # Resume data playback if available
        if simulation['data_playback']:
            simulation['data_playback'].resume_playback()

        logger.info(f"Resumed simulation {simulation_id}")

        return SimulationResponse(
            simulation_id=simulation_id,
            status="resumed",
            message="Simulation resumed successfully"
        )

    except Exception as e:
        logger.error(f"Error resuming simulation {simulation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to resume simulation: {str(e)}")


@router.get("/{simulation_id}/status", response_model=SimulationStatusResponse)
async def get_simulation_status(simulation_id: str) -> SimulationStatusResponse:
    """Get current simulation status and metrics"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]
    simulation_state = simulation['simulation_state']

    # Get performance metrics from components
    performance_metrics = {}

    if simulation['order_matching_engine']:
        performance_metrics['order_matching'] = simulation['order_matching_engine'].get_performance_statistics()

    if simulation['queue_manager']:
        performance_metrics['queue_management'] = simulation['queue_manager'].get_queue_analytics()

    if simulation['latency_engine']:
        performance_metrics['latency_simulation'] = simulation['latency_engine'].get_latency_statistics()

    if simulation['data_playback']:
        performance_metrics['data_playback'] = simulation['data_playback'].get_performance_metrics()

    return SimulationStatusResponse(
        simulation_id=simulation_id,
        is_running=simulation['is_running'],
        is_paused=simulation['is_paused'],
        current_time=simulation_state.current_time,
        events_processed=simulation_state.events_processed,
        orders_processed=len(simulation_state.active_orders),
        executions_count=len(simulation_state.executions),
        performance_metrics=performance_metrics
    )


@router.post("/{simulation_id}/orders", response_model=OrderExecutionResponse)
async def submit_order(
    simulation_id: str,
    order_request: OrderSubmissionRequest
) -> OrderExecutionResponse:
    """Submit an order to the simulation"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]

    if not simulation['is_running'] or simulation['is_paused']:
        raise HTTPException(status_code=400, detail="Simulation not running")

    try:
        # Create market order
        order = MarketOrder(
            order_id=str(uuid.uuid4()),
            symbol=simulation['config'].symbol,
            side=order_request.side,
            order_type=order_request.order_type,
            quantity=order_request.quantity,
            limit_price=order_request.limit_price,
            stop_price=order_request.stop_price,
            participant_type=order_request.participant_type,
            venue=simulation['venue_characteristics'].venue_id,
            time_in_force=order_request.time_in_force,
            urgency_score=order_request.urgency
        )

        # Submit to order matching engine
        order_matching_engine = simulation['order_matching_engine']
        match_result = await order_matching_engine.submit_order(order)

        # Update simulation state
        simulation_state = simulation['simulation_state']
        simulation_state.executions.extend(match_result.executions)
        if match_result.remaining_order:
            simulation_state.active_orders[order.order_id] = match_result.remaining_order

        return OrderExecutionResponse(
            order_id=order.order_id,
            executions=match_result.executions,
            remaining_quantity=match_result.remaining_order.remaining_quantity if match_result.remaining_order else 0,
            total_executed_quantity=match_result.total_executed_quantity,
            average_execution_price=match_result.average_execution_price,
            market_impact_bps=match_result.market_impact_bps,
            slippage_bps=match_result.slippage_bps,
            latency_ms=match_result.latency_ms
        )

    except Exception as e:
        logger.error(f"Error submitting order to simulation {simulation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit order: {str(e)}")


@router.get("/{simulation_id}/orderbook/{symbol}")
async def get_order_book(simulation_id: str, symbol: str) -> OrderBook:
    """Get current order book for symbol"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]
    order_matching_engine = simulation['order_matching_engine']

    try:
        order_book = order_matching_engine.get_order_book_snapshot()
        return order_book

    except Exception as e:
        logger.error(f"Error getting order book for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get order book: {str(e)}")


@router.get("/{simulation_id}/analytics")
async def get_simulation_analytics(simulation_id: str) -> Dict[str, Any]:
    """Get comprehensive simulation analytics"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]

    try:
        analytics = {
            'simulation_overview': {
                'simulation_id': simulation_id,
                'symbol': simulation['config'].symbol,
                'scenario': simulation['config'].scenario,
                'status': 'running' if simulation['is_running'] else 'stopped',
                'created_at': simulation['created_at'],
                'started_at': simulation.get('started_at'),
                'stopped_at': simulation.get('stopped_at')
            },
            'order_matching_analytics': {},
            'queue_analytics': {},
            'latency_analytics': {},
            'market_data_analytics': {}
        }

        # Order matching analytics
        if simulation['order_matching_engine']:
            analytics['order_matching_analytics'] = simulation['order_matching_engine'].get_performance_statistics()

        # Queue analytics
        if simulation['queue_manager']:
            analytics['queue_analytics'] = simulation['queue_manager'].get_detailed_statistics()

        # Latency analytics
        if simulation['latency_engine']:
            analytics['latency_analytics'] = simulation['latency_engine'].get_latency_statistics()

        # Market data analytics
        if simulation['data_playback']:
            analytics['market_data_analytics'] = simulation['data_playback'].get_playback_statistics()

        return analytics

    except Exception as e:
        logger.error(f"Error getting analytics for simulation {simulation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@router.delete("/{simulation_id}")
async def delete_simulation(simulation_id: str) -> SimulationResponse:
    """Delete a simulation and clean up resources"""
    if simulation_id not in active_simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation = active_simulations[simulation_id]

    try:
        # Stop simulation if running
        if simulation['is_running']:
            await stop_simulation(simulation_id)

        # Clean up WebSocket connections
        if simulation_id in websocket_connections:
            for ws in websocket_connections[simulation_id]:
                try:
                    await ws.close()
                except:
                    pass
            del websocket_connections[simulation_id]

        # Remove from active simulations
        del active_simulations[simulation_id]

        logger.info(f"Deleted simulation {simulation_id}")

        return SimulationResponse(
            simulation_id=simulation_id,
            status="deleted",
            message="Simulation deleted successfully"
        )

    except Exception as e:
        logger.error(f"Error deleting simulation {simulation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete simulation: {str(e)}")


@router.get("/")
async def list_simulations() -> Dict[str, Any]:
    """List all active simulations"""
    simulations = []

    for sim_id, simulation in active_simulations.items():
        simulations.append({
            'simulation_id': sim_id,
            'symbol': simulation['config'].symbol,
            'scenario': simulation['config'].scenario,
            'status': 'running' if simulation['is_running'] else 'stopped',
            'created_at': simulation['created_at'],
            'is_paused': simulation['is_paused']
        })

    return {
        'simulations': simulations,
        'total_count': len(simulations)
    }


# WebSocket endpoint for real-time updates
@router.websocket("/{simulation_id}/ws")
async def websocket_endpoint(websocket: WebSocket, simulation_id: str):
    """WebSocket endpoint for real-time simulation updates"""
    await websocket.accept()

    if simulation_id not in active_simulations:
        await websocket.send_json({
            'error': 'Simulation not found',
            'simulation_id': simulation_id
        })
        await websocket.close()
        return

    # Add to connections
    if simulation_id not in websocket_connections:
        websocket_connections[simulation_id] = []
    websocket_connections[simulation_id].append(websocket)

    simulation = active_simulations[simulation_id]

    try:
        # Send initial status
        await websocket.send_json({
            'type': 'status',
            'simulation_id': simulation_id,
            'is_running': simulation['is_running'],
            'is_paused': simulation['is_paused']
        })

        # Keep connection alive and send updates
        while True:
            try:
                # Wait for messages or send periodic updates
                await asyncio.sleep(1.0)  # Send updates every second

                if simulation['is_running'] and not simulation['is_paused']:
                    # Send performance metrics
                    performance_data = {
                        'type': 'performance_update',
                        'simulation_id': simulation_id,
                        'timestamp': datetime.utcnow().isoformat(),
                        'metrics': {}
                    }

                    if simulation['order_matching_engine']:
                        performance_data['metrics']['order_matching'] = simulation['order_matching_engine'].get_performance_statistics()

                    await websocket.send_json(performance_data)

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in WebSocket connection: {e}")
                break

    finally:
        # Remove from connections
        if simulation_id in websocket_connections:
            websocket_connections[simulation_id] = [
                ws for ws in websocket_connections[simulation_id] if ws != websocket
            ]


# Background simulation runner
async def _run_simulation(simulation_id: str):
    """Background task to run simulation"""
    if simulation_id not in active_simulations:
        return

    simulation = active_simulations[simulation_id]

    try:
        logger.info(f"Running simulation {simulation_id}")

        while simulation['is_running']:
            if simulation['is_paused']:
                await asyncio.sleep(0.1)
                continue

            # Advance simulation time
            simulation_state = simulation['simulation_state']
            time_delta = timedelta(milliseconds=simulation['simulation_params'].time_step_ms)
            simulation_state.current_time += time_delta

            # Check if simulation should end
            if simulation_state.current_time >= simulation['simulation_params'].end_time:
                simulation['is_running'] = False
                break

            # Advance component times
            if simulation['order_matching_engine']:
                await simulation['order_matching_engine'].advance_time(time_delta)

            if simulation['latency_engine']:
                await simulation['latency_engine'].advance_time(time_delta)

            if simulation['queue_manager']:
                await simulation['queue_manager'].advance_time(time_delta)

            # Update event count
            simulation_state.events_processed += 1

            # Small delay to prevent busy waiting
            await asyncio.sleep(0.001)

        logger.info(f"Simulation {simulation_id} completed")

    except Exception as e:
        logger.error(f"Error running simulation {simulation_id}: {e}")
        simulation['is_running'] = False
        simulation['error'] = str(e)