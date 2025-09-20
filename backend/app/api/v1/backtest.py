"""
Portfolio Backtester API Endpoints

Provides RESTful API endpoints for portfolio backtesting with walk-forward optimization,
position sizing algorithms, transaction cost modeling, and comprehensive risk reports.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from typing import Optional, List, Dict, Any
from datetime import date, datetime
import uuid
import asyncio

from ...models.backtester_models import (
    BacktestRequest, BacktestResult, BacktestConfiguration,
    TradingStrategy, PositionSizingMethod, PerformanceMetrics,
    TransactionCosts, BacktestStatus, WalkForwardConfig
)
from ...services.backtesting_service import BacktestingService
from ...core.dependencies import get_backtesting_service

router = APIRouter(prefix="/backtest", tags=["Portfolio Backtesting"])

# In-memory storage for backtest status (in production, use Redis or database)
_backtest_jobs: Dict[str, BacktestStatus] = {}


@router.post("/run", response_model=Dict[str, str])
async def run_backtest(
    request: BacktestRequest,
    background_tasks: BackgroundTasks,
    service: BacktestingService = Depends(get_backtesting_service)
) -> Dict[str, str]:
    """
    Run a comprehensive portfolio backtest with walk-forward optimization

    Creates a background job for backtesting with progress tracking.
    Returns a job ID that can be used to check status and retrieve results.
    """

    # Generate unique job ID
    job_id = str(uuid.uuid4())

    # Initialize job status
    _backtest_jobs[job_id] = BacktestStatus(
        job_id=job_id,
        status="PENDING",
        progress=0.0,
        message="Backtest job queued",
        created_at=datetime.now(),
        configuration=request.configuration
    )

    # Add background task
    background_tasks.add_task(
        _run_backtest_background,
        job_id,
        request,
        service
    )

    return {
        "job_id": job_id,
        "status": "PENDING",
        "message": "Backtest job started. Use /backtest/status/{job_id} to check progress."
    }


@router.get("/status/{job_id}", response_model=BacktestStatus)
async def get_backtest_status(job_id: str) -> BacktestStatus:
    """
    Get the status of a running or completed backtest job

    Returns current progress, status, and any error messages.
    """

    if job_id not in _backtest_jobs:
        raise HTTPException(status_code=404, detail=f"Backtest job {job_id} not found")

    return _backtest_jobs[job_id]


@router.get("/result/{job_id}", response_model=BacktestResult)
async def get_backtest_result(job_id: str) -> BacktestResult:
    """
    Get the results of a completed backtest job

    Returns comprehensive backtest results including performance metrics,
    trade logs, equity curve, and risk analysis.
    """

    if job_id not in _backtest_jobs:
        raise HTTPException(status_code=404, detail=f"Backtest job {job_id} not found")

    job_status = _backtest_jobs[job_id]

    if job_status.status != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail=f"Backtest job {job_id} is not completed. Status: {job_status.status}"
        )

    if not job_status.result:
        raise HTTPException(
            status_code=500,
            detail=f"Backtest job {job_id} completed but no result available"
        )

    return job_status.result


@router.post("/validate", response_model=Dict[str, Any])
async def validate_strategy(
    strategy: TradingStrategy,
    service: BacktestingService = Depends(get_backtesting_service)
) -> Dict[str, Any]:
    """
    Validate a trading strategy configuration

    Checks strategy rules, position sizing parameters, and universe validity.
    Returns validation results and any warnings or errors.
    """

    try:
        validation_result = await service.validate_strategy(strategy)
        return {
            "valid": validation_result["valid"],
            "errors": validation_result.get("errors", []),
            "warnings": validation_result.get("warnings", []),
            "estimated_trades_per_year": validation_result.get("estimated_trades", 0),
            "risk_level": validation_result.get("risk_level", "UNKNOWN")
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Strategy validation failed: {str(e)}")


@router.get("/templates", response_model=List[TradingStrategy])
async def get_strategy_templates(
    service: BacktestingService = Depends(get_backtesting_service)
) -> List[TradingStrategy]:
    """
    Get predefined trading strategy templates

    Returns a list of common trading strategies that can be used as starting points.
    """

    try:
        templates = await service.get_strategy_templates()
        return templates

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load strategy templates: {str(e)}")


@router.post("/quick", response_model=BacktestResult)
async def run_quick_backtest(
    configuration: BacktestConfiguration,
    service: BacktestingService = Depends(get_backtesting_service)
) -> BacktestResult:
    """
    Run a quick backtest for simple strategies

    Synchronous endpoint for simple backtests that complete quickly.
    Use the main /run endpoint for complex strategies with walk-forward optimization.
    """

    try:
        # For quick backtests, disable walk-forward and limit complexity
        quick_config = configuration.copy()
        quick_config.walk_forward = None
        quick_config.benchmark_symbols = quick_config.benchmark_symbols[:1]  # Single benchmark

        # Create minimal request
        request = BacktestRequest(configuration=quick_config)

        # Run backtest synchronously
        result = await service.run_backtest(request)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quick backtest failed: {str(e)}")


@router.get("/universe/validate")
async def validate_universe(
    symbols: List[str] = Query(..., description="List of stock symbols to validate"),
    start_date: Optional[date] = Query(None, description="Start date for data availability check"),
    end_date: Optional[date] = Query(None, description="End date for data availability check"),
    service: BacktestingService = Depends(get_backtesting_service)
) -> Dict[str, Any]:
    """
    Validate a trading universe

    Checks symbol availability, data completeness, and survivorship bias.
    """

    try:
        validation_result = await service.validate_universe(symbols, start_date, end_date)
        return {
            "valid_symbols": validation_result["valid"],
            "invalid_symbols": validation_result["invalid"],
            "data_coverage": validation_result["coverage"],
            "warnings": validation_result.get("warnings", []),
            "survivorship_bias_risk": validation_result.get("survivorship_bias", "LOW")
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Universe validation failed: {str(e)}")


@router.get("/metrics/benchmark")
async def get_benchmark_metrics(
    symbol: str = Query(..., description="Benchmark symbol (e.g., SPY, QQQ)"),
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    service: BacktestingService = Depends(get_backtesting_service)
) -> PerformanceMetrics:
    """
    Get benchmark performance metrics

    Calculates comprehensive performance metrics for a benchmark over the specified period.
    """

    try:
        metrics = await service.calculate_benchmark_metrics(symbol, start_date, end_date)
        return metrics

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmark metrics calculation failed: {str(e)}")


@router.post("/compare")
async def compare_strategies(
    strategy_configs: List[BacktestConfiguration],
    background_tasks: BackgroundTasks,
    service: BacktestingService = Depends(get_backtesting_service)
) -> Dict[str, str]:
    """
    Compare multiple trading strategies

    Runs multiple backtests and provides comparative analysis.
    Returns a job ID for the comparison results.
    """

    if len(strategy_configs) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 strategies can be compared at once")

    # Generate unique comparison job ID
    job_id = f"compare_{str(uuid.uuid4())}"

    # Initialize comparison job status
    _backtest_jobs[job_id] = BacktestStatus(
        job_id=job_id,
        status="PENDING",
        progress=0.0,
        message="Strategy comparison job queued",
        created_at=datetime.now()
    )

    # Add background task
    background_tasks.add_task(
        _run_strategy_comparison,
        job_id,
        strategy_configs,
        service
    )

    return {
        "job_id": job_id,
        "status": "PENDING",
        "message": f"Comparing {len(strategy_configs)} strategies. Use /backtest/status/{job_id} to check progress."
    }


@router.get("/jobs", response_model=List[BacktestStatus])
async def list_backtest_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of jobs to return")
) -> List[BacktestStatus]:
    """
    List backtest jobs

    Returns a list of recent backtest jobs with their status.
    """

    jobs = list(_backtest_jobs.values())

    # Filter by status if specified
    if status:
        jobs = [job for job in jobs if job.status == status.upper()]

    # Sort by creation time (newest first)
    jobs.sort(key=lambda x: x.created_at, reverse=True)

    # Apply limit
    return jobs[:limit]


@router.delete("/job/{job_id}")
async def cancel_backtest_job(job_id: str) -> Dict[str, str]:
    """
    Cancel a running backtest job

    Attempts to cancel a running job and removes it from the queue.
    """

    if job_id not in _backtest_jobs:
        raise HTTPException(status_code=404, detail=f"Backtest job {job_id} not found")

    job_status = _backtest_jobs[job_id]

    if job_status.status in ["COMPLETED", "FAILED", "CANCELLED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job {job_id} with status {job_status.status}"
        )

    # Mark job as cancelled
    _backtest_jobs[job_id].status = "CANCELLED"
    _backtest_jobs[job_id].message = "Job cancelled by user request"
    _backtest_jobs[job_id].updated_at = datetime.now()

    return {
        "job_id": job_id,
        "status": "CANCELLED",
        "message": "Backtest job cancelled successfully"
    }


@router.get("/health")
async def backtest_health_check():
    """
    Health check endpoint for backtesting service

    Returns service status and capability information.
    """

    return {
        "status": "healthy",
        "service": "portfolio_backtester",
        "features": [
            "walk_forward_optimization",
            "position_sizing_algorithms",
            "transaction_cost_modeling",
            "risk_metrics_calculation",
            "strategy_comparison",
            "tearsheet_generation"
        ],
        "position_sizing_methods": [method.value for method in PositionSizingMethod],
        "active_jobs": len([job for job in _backtest_jobs.values() if job.status == "RUNNING"]),
        "total_jobs": len(_backtest_jobs)
    }


# Background task functions

async def _run_backtest_background(
    job_id: str,
    request: BacktestRequest,
    service: BacktestingService
):
    """Background task to run a backtest"""

    try:
        # Update status to running
        _backtest_jobs[job_id].status = "RUNNING"
        _backtest_jobs[job_id].message = "Starting backtest execution"
        _backtest_jobs[job_id].started_at = datetime.now()

        # Progress callback
        def progress_callback(progress: float, message: str):
            if job_id in _backtest_jobs:
                _backtest_jobs[job_id].progress = progress
                _backtest_jobs[job_id].message = message
                _backtest_jobs[job_id].updated_at = datetime.now()

        # Run the backtest
        result = await service.run_backtest(request, progress_callback=progress_callback)

        # Update status to completed
        _backtest_jobs[job_id].status = "COMPLETED"
        _backtest_jobs[job_id].progress = 100.0
        _backtest_jobs[job_id].message = "Backtest completed successfully"
        _backtest_jobs[job_id].result = result
        _backtest_jobs[job_id].completed_at = datetime.now()

    except Exception as e:
        # Update status to failed
        _backtest_jobs[job_id].status = "FAILED"
        _backtest_jobs[job_id].message = f"Backtest failed: {str(e)}"
        _backtest_jobs[job_id].error = str(e)
        _backtest_jobs[job_id].updated_at = datetime.now()


async def _run_strategy_comparison(
    job_id: str,
    strategy_configs: List[BacktestConfiguration],
    service: BacktestingService
):
    """Background task to run strategy comparison"""

    try:
        # Update status to running
        _backtest_jobs[job_id].status = "RUNNING"
        _backtest_jobs[job_id].message = "Running strategy comparison"
        _backtest_jobs[job_id].started_at = datetime.now()

        # Progress callback
        def progress_callback(progress: float, message: str):
            if job_id in _backtest_jobs:
                _backtest_jobs[job_id].progress = progress
                _backtest_jobs[job_id].message = message
                _backtest_jobs[job_id].updated_at = datetime.now()

        # Run strategy comparison
        comparison_result = await service.compare_strategies(
            strategy_configs,
            progress_callback=progress_callback
        )

        # Update status to completed
        _backtest_jobs[job_id].status = "COMPLETED"
        _backtest_jobs[job_id].progress = 100.0
        _backtest_jobs[job_id].message = "Strategy comparison completed"
        _backtest_jobs[job_id].result = comparison_result
        _backtest_jobs[job_id].completed_at = datetime.now()

    except Exception as e:
        # Update status to failed
        _backtest_jobs[job_id].status = "FAILED"
        _backtest_jobs[job_id].message = f"Strategy comparison failed: {str(e)}"
        _backtest_jobs[job_id].error = str(e)
        _backtest_jobs[job_id].updated_at = datetime.now()