"""
Execution API endpoints for algorithm trading and smart order routing.

This module provides RESTful endpoints for execution algorithms, order routing,
and execution monitoring with comprehensive safety guardrails.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.security import HTTPBearer
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from decimal import Decimal
import uuid
import asyncio
import logging

from app.models.execution_models import (
    AlgorithmRequest, AlgorithmResponse, RoutingRequest, RoutingResponse,
    ExecutionStatus, VenueStatsResponse, ExecutionReportResponse,
    SafetyValidationResponse, AlgorithmType, OrderSide
)
from app.services.execution.algorithms import (
    TWAPAlgorithm, VWAPAlgorithm, POVAlgorithm, AlgorithmSafety, MarketData
)
from app.services.execution.smart_router import (
    SmartOrderRouter, VenueStats, VenueType, MockVenueAdapter
)
from app.core.auth import get_current_user
from app.core.rate_limiter import RateLimiter
from app.services.stock_service import StockService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/exec", tags=["execution"])
security = HTTPBearer()

# Global instances (would be dependency injected in production)
router_instance = SmartOrderRouter(seed=42)
algorithm_safety = AlgorithmSafety()
rate_limiter = RateLimiter()

# Initialize mock venues for demonstration
async def initialize_venues():
    """Initialize mock venues for testing."""
    # Exchange venues
    nyse_adapter = MockVenueAdapter("NYSE", seed=42)
    nasdaq_adapter = MockVenueAdapter("NASDAQ", seed=43)
    arca_adapter = MockVenueAdapter("ARCA", seed=44)

    # ECN venues
    bats_adapter = MockVenueAdapter("BATS", seed=45)
    edgx_adapter = MockVenueAdapter("EDGX", seed=46)

    # Dark pools
    sigma_adapter = MockVenueAdapter("SIGMA_X", seed=47)
    crossfinder_adapter = MockVenueAdapter("CROSSFINDER", seed=48)

    # Register venues with realistic stats
    venue_configs = [
        ("NYSE", nyse_adapter, VenueStats(
            venue_id="NYSE", venue_name="New York Stock Exchange", venue_type=VenueType.EXCHANGE,
            fill_rate=0.95, avg_fill_time_ms=120, price_improvement_bps=0.5,
            spread_bps=5.0, depth_shares=5000, maker_fee_bps=-0.3, taker_fee_bps=0.3,
            connectivity_score=0.99, latency_ms=25, uptime_pct=99.9
        )),
        ("NASDAQ", nasdaq_adapter, VenueStats(
            venue_id="NASDAQ", venue_name="NASDAQ", venue_type=VenueType.EXCHANGE,
            fill_rate=0.94, avg_fill_time_ms=110, price_improvement_bps=0.3,
            spread_bps=4.8, depth_shares=4800, maker_fee_bps=-0.25, taker_fee_bps=0.3,
            connectivity_score=0.98, latency_ms=22, uptime_pct=99.8
        )),
        ("ARCA", arca_adapter, VenueStats(
            venue_id="ARCA", venue_name="NYSE Arca", venue_type=VenueType.ECN,
            fill_rate=0.92, avg_fill_time_ms=95, price_improvement_bps=0.8,
            spread_bps=4.5, depth_shares=3200, maker_fee_bps=-0.4, taker_fee_bps=0.35,
            connectivity_score=0.97, latency_ms=18, uptime_pct=99.7
        )),
        ("BATS", bats_adapter, VenueStats(
            venue_id="BATS", venue_name="BATS Global Markets", venue_type=VenueType.ECN,
            fill_rate=0.91, avg_fill_time_ms=88, price_improvement_bps=1.2,
            spread_bps=4.2, depth_shares=2800, maker_fee_bps=-0.35, taker_fee_bps=0.32,
            connectivity_score=0.96, latency_ms=20, uptime_pct=99.6
        )),
        ("EDGX", edgx_adapter, VenueStats(
            venue_id="EDGX", venue_name="EDGX Exchange", venue_type=VenueType.ECN,
            fill_rate=0.89, avg_fill_time_ms=105, price_improvement_bps=0.9,
            spread_bps=4.8, depth_shares=2400, maker_fee_bps=-0.3, taker_fee_bps=0.35,
            connectivity_score=0.95, latency_ms=24, uptime_pct=99.5
        )),
        ("SIGMA_X", sigma_adapter, VenueStats(
            venue_id="SIGMA_X", venue_name="Sigma X", venue_type=VenueType.DARK_POOL,
            fill_rate=0.85, avg_fill_time_ms=200, price_improvement_bps=2.5,
            spread_bps=0.0, depth_shares=8000, maker_fee_bps=0.0, taker_fee_bps=0.0,
            connectivity_score=0.92, latency_ms=35, uptime_pct=99.2
        )),
        ("CROSSFINDER", crossfinder_adapter, VenueStats(
            venue_id="CROSSFINDER", venue_name="CrossFinder", venue_type=VenueType.DARK_POOL,
            fill_rate=0.82, avg_fill_time_ms=250, price_improvement_bps=3.1,
            spread_bps=0.0, depth_shares=12000, maker_fee_bps=0.0, taker_fee_bps=0.0,
            connectivity_score=0.90, latency_ms=42, uptime_pct=99.0
        ))
    ]

    for venue_id, adapter, stats in venue_configs:
        router_instance.register_venue(venue_id, adapter, stats)

# Initialize venues on startup
asyncio.create_task(initialize_venues())

@router.post("/algorithm", response_model=AlgorithmResponse)
async def create_algorithm_execution(
    request: AlgorithmRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Create and execute an algorithmic trading strategy.

    Supports TWAP, VWAP, and POV algorithms with comprehensive safety checks.
    """
    # Rate limiting
    client_id = current_user.get('user_id', 'anonymous')
    if not rate_limiter.allow_request(client_id, 'execution_api', 100, 3600):  # 100 requests per hour
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    try:
        # Generate unique algorithm ID
        algo_id = str(uuid.uuid4())

        # Get market data for safety validation
        stock_service = StockService()
        market_data_dict = await stock_service.get_current_price(request.symbol)

        if not market_data_dict:
            raise HTTPException(status_code=400, detail=f"Unable to fetch market data for {request.symbol}")

        market_data = MarketData(
            symbol=request.symbol,
            current_price=Decimal(str(market_data_dict['price'])),
            bid=Decimal(str(market_data_dict.get('bid', market_data_dict['price']) - 0.05)),
            ask=Decimal(str(market_data_dict.get('ask', market_data_dict['price']) + 0.05)),
            volume=market_data_dict.get('volume', 0),
            avg_volume=market_data_dict.get('avg_volume', 1000000),
            volatility=market_data_dict.get('volatility', 0.25),
            spread=Decimal('0.10')
        )

        # Safety validation
        order_request = {
            'order_id': algo_id,
            'symbol': request.symbol,
            'side': request.side.value,
            'quantity': request.quantity,
            'order_type': 'MARKET',
            'start_time': request.start_time or datetime.now(),
            'end_time': request.end_time or (datetime.now() + timedelta(hours=2)),
            'algo_params': request.algo_params or {}
        }

        # Apply safety checks
        safety_result = algorithm_safety.validate_order(order_request, market_data)
        if not safety_result['valid']:
            raise HTTPException(
                status_code=400,
                detail=f"Order failed safety validation: {', '.join(safety_result['errors'])}"
            )

        # Create appropriate algorithm instance
        if request.algo_type == AlgorithmType.TWAP:
            algorithm = TWAPAlgorithm(seed=42)
        elif request.algo_type == AlgorithmType.VWAP:
            algorithm = VWAPAlgorithm(seed=42)
        elif request.algo_type == AlgorithmType.POV:
            algorithm = POVAlgorithm(seed=42)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported algorithm type: {request.algo_type}")

        # Generate execution schedule
        if request.algo_type == AlgorithmType.POV:
            # POV requires different method
            volume_intervals = [50000] * 10  # Mock volume data
            execution_schedule = algorithm.generate_adaptive_schedule(order_request, market_data, volume_intervals)
        else:
            # TWAP and VWAP use standard method
            additional_data = None
            if request.algo_type == AlgorithmType.VWAP and 'volume_profile' in order_request['algo_params']:
                additional_data = {'volume_profile': order_request['algo_params']['volume_profile']}

            execution_schedule = algorithm.generate_schedule(order_request, market_data, additional_data)

        # Schedule background execution
        background_tasks.add_task(execute_algorithm_schedule, algo_id, execution_schedule)

        return AlgorithmResponse(
            algo_id=algo_id,
            status=ExecutionStatus.SCHEDULED,
            symbol=request.symbol,
            total_quantity=request.quantity,
            executed_quantity=0,
            remaining_quantity=request.quantity,
            schedule_count=len(execution_schedule),
            estimated_completion=request.end_time or (datetime.now() + timedelta(hours=2)),
            safety_warnings=safety_result.get('warnings', [])
        )

    except Exception as e:
        logger.error(f"Algorithm creation failed: {e}")
        raise HTTPException(status_code=500, detail="Internal execution system error")

@router.post("/route", response_model=RoutingResponse)
async def route_order(
    request: RoutingRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Route order to optimal venues using smart order router.

    Analyzes venue statistics, liquidity, and costs to determine best execution.
    """
    try:
        # Create order dictionary for router
        order = {
            'order_id': str(uuid.uuid4()),
            'symbol': request.symbol,
            'side': request.side.value,
            'quantity': request.quantity,
            'order_type': request.order_type or 'MARKET'
        }

        # Route order
        routing_decisions = await router_instance.route_order(order, request.constraints)

        # Execute routing decisions
        execution_report = await router_instance.execute_routing_decisions(order['order_id'], routing_decisions)

        return RoutingResponse(
            order_id=order['order_id'],
            routing_decisions=[
                {
                    'venue_id': d.venue_id,
                    'quantity': d.quantity,
                    'order_type': d.order_type,
                    'price_limit': d.price_limit,
                    'expected_fill_rate': d.expected_fill_rate,
                    'expected_cost_bps': d.expected_cost_bps,
                    'routing_reason': d.routing_reason
                }
                for d in routing_decisions
            ],
            execution_summary={
                'total_venues': len(routing_decisions),
                'filled_quantity': execution_report.filled_quantity,
                'avg_fill_price': execution_report.avg_fill_price,
                'total_fees': execution_report.total_fees,
                'execution_time_ms': execution_report.execution_time_ms
            }
        )

    except Exception as e:
        logger.error(f"Order routing failed: {e}")
        raise HTTPException(status_code=500, detail="Order routing system error")

@router.get("/algorithm/{algo_id}/status", response_model=AlgorithmResponse)
async def get_algorithm_status(
    algo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current status of algorithm execution."""
    # In production, this would query a database/cache
    # For demo, return mock status
    return AlgorithmResponse(
        algo_id=algo_id,
        status=ExecutionStatus.RUNNING,
        symbol="AAPL",
        total_quantity=10000,
        executed_quantity=3500,
        remaining_quantity=6500,
        schedule_count=8,
        estimated_completion=datetime.now() + timedelta(minutes=45)
    )

@router.post("/algorithm/{algo_id}/cancel")
async def cancel_algorithm(
    algo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel running algorithm execution."""
    # Implementation would cancel all pending orders
    return {"message": f"Algorithm {algo_id} cancellation initiated"}

@router.get("/venues/stats", response_model=List[VenueStatsResponse])
async def get_venue_statistics(
    current_user: dict = Depends(get_current_user)
):
    """Get current venue statistics and performance metrics."""
    venue_stats = router_instance.get_venue_statistics()

    return [
        VenueStatsResponse(
            venue_id=stats.venue_id,
            venue_name=stats.venue_name,
            venue_type=stats.venue_type.value,
            fill_rate=stats.fill_rate,
            avg_fill_time_ms=stats.avg_fill_time_ms,
            price_improvement_bps=stats.price_improvement_bps,
            spread_bps=stats.spread_bps,
            depth_shares=stats.depth_shares,
            maker_fee_bps=stats.maker_fee_bps,
            taker_fee_bps=stats.taker_fee_bps,
            connectivity_score=stats.connectivity_score,
            latency_ms=stats.latency_ms,
            uptime_pct=stats.uptime_pct,
            last_update=stats.last_update
        )
        for stats in venue_stats.values()
    ]

@router.get("/execution/{order_id}/report", response_model=ExecutionReportResponse)
async def get_execution_report(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed execution report for an order."""
    execution_report = router_instance.get_execution_report(order_id)

    if not execution_report:
        raise HTTPException(status_code=404, detail="Execution report not found")

    return ExecutionReportResponse(
        order_id=execution_report.order_id,
        symbol=execution_report.symbol,
        side=execution_report.side,
        original_quantity=execution_report.original_quantity,
        filled_quantity=execution_report.filled_quantity,
        remaining_quantity=execution_report.remaining_quantity,
        avg_fill_price=execution_report.avg_fill_price,
        total_fees=execution_report.total_fees,
        venues_used=list(execution_report.venues_used),
        execution_time_ms=execution_report.execution_time_ms,
        price_improvement_bps=execution_report.price_improvement_bps,
        status=execution_report.status.value
    )

@router.post("/validate", response_model=SafetyValidationResponse)
async def validate_order_safety(
    symbol: str,
    side: OrderSide,
    quantity: int,
    order_type: str = "MARKET",
    limit_price: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Validate order against safety rules and risk limits.

    Performs fat-finger protection, price collar validation, and concentration checks.
    """
    try:
        # Get market data
        stock_service = StockService()
        market_data_dict = await stock_service.get_current_price(symbol)

        if not market_data_dict:
            raise HTTPException(status_code=400, detail=f"Unable to fetch market data for {symbol}")

        market_data = MarketData(
            symbol=symbol,
            current_price=Decimal(str(market_data_dict['price'])),
            bid=Decimal(str(market_data_dict.get('bid', market_data_dict['price']) - 0.05)),
            ask=Decimal(str(market_data_dict.get('ask', market_data_dict['price']) + 0.05)),
            volume=market_data_dict.get('volume', 0),
            avg_volume=market_data_dict.get('avg_volume', 1000000),
            volatility=market_data_dict.get('volatility', 0.25),
            spread=Decimal('0.10')
        )

        # Create order request for validation
        order_request = {
            'symbol': symbol,
            'side': side.value,
            'quantity': quantity,
            'order_type': order_type,
            'limit_price': limit_price
        }

        # Validate with safety system
        validation_result = algorithm_safety.validate_order(order_request, market_data)

        return SafetyValidationResponse(
            valid=validation_result['valid'],
            errors=validation_result['errors'],
            warnings=validation_result['warnings'],
            recommended_adjustments=validation_result.get('recommended_adjustments', {}),
            risk_score=len(validation_result['errors']) + len(validation_result['warnings']) * 0.5,
            validation_timestamp=datetime.now()
        )

    except Exception as e:
        logger.error(f"Safety validation failed: {e}")
        raise HTTPException(status_code=500, detail="Safety validation system error")

@router.get("/routing/history")
async def get_routing_history(
    limit: int = Query(default=50, le=500),
    current_user: dict = Depends(get_current_user)
):
    """Get recent order routing history for analysis."""
    history = router_instance.get_routing_history(limit)
    return {"routing_history": history}

async def execute_algorithm_schedule(algo_id: str, execution_schedule: list):
    """Background task to execute algorithm schedule."""
    try:
        logger.info(f"Starting execution for algorithm {algo_id} with {len(execution_schedule)} slices")

        for i, slice_order in enumerate(execution_schedule):
            # Wait until execution time
            current_time = datetime.now()
            if slice_order.execute_at > current_time:
                sleep_seconds = (slice_order.execute_at - current_time).total_seconds()
                await asyncio.sleep(sleep_seconds)

            # Execute slice
            logger.info(f"Executing slice {i+1}/{len(execution_schedule)} for {algo_id}: "
                       f"{slice_order.quantity} shares at {slice_order.execute_at}")

            # In production, this would route through the smart router
            # For demo, simulate execution
            await asyncio.sleep(0.1)  # Simulate execution time

        logger.info(f"Algorithm {algo_id} execution completed")

    except Exception as e:
        logger.error(f"Algorithm {algo_id} execution failed: {e}")

@router.get("/health")
async def execution_health_check():
    """Health check endpoint for execution services."""
    venue_stats = router_instance.get_venue_statistics()
    connected_venues = sum(1 for stats in venue_stats.values() if stats.connectivity_score > 0.8)

    return {
        "status": "healthy" if connected_venues >= 3 else "degraded",
        "connected_venues": connected_venues,
        "total_venues": len(venue_stats),
        "timestamp": datetime.now()
    }