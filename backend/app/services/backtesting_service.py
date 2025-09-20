"""
Portfolio Backtesting Service.
Comprehensive service for running backtests, walk-forward optimization, and performance analysis.
"""

import asyncio
import logging
import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Any, AsyncGenerator
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import yfinance as yf
from functools import lru_cache

from ..models.backtester_models import (
    BacktestConfiguration, BacktestResult, BacktestRequest, BacktestStatus,
    BacktestSummary, StrategyOptimizationRequest, BacktestError,
    TradingStrategy, PerformanceMetrics
)
from ..core.backtesting_engine import BacktestingEngine, MarketData
from ..core.portfolio_metrics import AdvancedMetricsCalculator
from ..services.stock_service import StockService

logger = logging.getLogger(__name__)


class DataProvider:
    """Provides market data for backtesting."""

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service
        self.executor = ThreadPoolExecutor(max_workers=4)

    async def fetch_market_data(self, symbols: List[str], start_date: date,
                              end_date: date) -> MarketData:
        """Fetch comprehensive market data for backtesting."""
        logger.info(f"Fetching market data for {len(symbols)} symbols from {start_date} to {end_date}")

        try:
            # Fetch price data for all symbols
            prices_data = await self._fetch_price_data(symbols, start_date, end_date)

            # Fetch benchmark data (SPY as default)
            benchmark_data = await self._fetch_benchmark_data("SPY", start_date, end_date)

            # Fetch risk-free rate (3-month Treasury)
            risk_free_data = await self._fetch_risk_free_rate(start_date, end_date)

            # Calculate technical indicators will be done in the engine
            indicators = pd.DataFrame()

            return MarketData(
                prices=prices_data,
                indicators=indicators,
                risk_free_rate=risk_free_data,
                benchmark=benchmark_data
            )

        except Exception as e:
            logger.error(f"Error fetching market data: {str(e)}")
            raise

    async def _fetch_price_data(self, symbols: List[str], start_date: date,
                              end_date: date) -> pd.DataFrame:
        """Fetch OHLCV price data for multiple symbols."""
        loop = asyncio.get_event_loop()

        def fetch_symbol_data(symbol: str) -> Optional[pd.DataFrame]:
            try:
                ticker = yf.Ticker(symbol)
                data = ticker.history(start=start_date, end=end_date, auto_adjust=True)

                if data.empty:
                    logger.warning(f"No data available for symbol {symbol}")
                    return None

                # Ensure we have required columns
                required_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
                if not all(col in data.columns for col in required_columns):
                    logger.warning(f"Missing required columns for symbol {symbol}")
                    return None

                return data[required_columns]

            except Exception as e:
                logger.error(f"Error fetching data for {symbol}: {str(e)}")
                return None

        # Fetch data for all symbols concurrently
        tasks = [
            loop.run_in_executor(self.executor, fetch_symbol_data, symbol)
            for symbol in symbols
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine data into MultiIndex DataFrame
        combined_data = {}
        valid_symbols = []

        for symbol, result in zip(symbols, results):
            if isinstance(result, Exception):
                logger.error(f"Exception for {symbol}: {str(result)}")
                continue

            if result is not None and not result.empty:
                for column in result.columns:
                    combined_data[(column, symbol)] = result[column]
                valid_symbols.append(symbol)

        if not combined_data:
            raise ValueError("No valid price data fetched for any symbol")

        # Create MultiIndex DataFrame
        df = pd.DataFrame(combined_data)
        df.columns = pd.MultiIndex.from_tuples(df.columns, names=['Price', 'Symbol'])

        logger.info(f"Successfully fetched data for {len(valid_symbols)} symbols")
        return df

    async def _fetch_benchmark_data(self, benchmark_symbol: str, start_date: date,
                                  end_date: date) -> pd.Series:
        """Fetch benchmark return data."""
        loop = asyncio.get_event_loop()

        def fetch_benchmark():
            try:
                ticker = yf.Ticker(benchmark_symbol)
                data = ticker.history(start=start_date, end=end_date, auto_adjust=True)

                if data.empty:
                    logger.warning(f"No benchmark data for {benchmark_symbol}")
                    return pd.Series(dtype=float)

                # Calculate daily returns
                returns = data['Close'].pct_change().dropna()
                return returns

            except Exception as e:
                logger.error(f"Error fetching benchmark data: {str(e)}")
                return pd.Series(dtype=float)

        return await loop.run_in_executor(self.executor, fetch_benchmark)

    async def _fetch_risk_free_rate(self, start_date: date, end_date: date) -> pd.Series:
        """Fetch risk-free rate data."""
        # For now, return a constant risk-free rate
        # In production, this would fetch actual Treasury rates from FRED API
        date_range = pd.date_range(start=start_date, end=end_date, freq='B')
        risk_free_rate = pd.Series(0.02 / 252, index=date_range)  # 2% annual rate, daily
        return risk_free_rate

    @lru_cache(maxsize=100)
    def get_sector_data(self, symbol: str) -> Optional[str]:
        """Get sector information for a symbol (cached)."""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            return info.get('sector', 'Unknown')
        except Exception:
            return 'Unknown'


class BacktestingService:
    """Main service for portfolio backtesting operations."""

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service
        self.data_provider = DataProvider(stock_service)
        self.backtesting_engine = BacktestingEngine()
        self.metrics_calculator = AdvancedMetricsCalculator()
        self.active_backtests: Dict[str, BacktestStatus] = {}

    async def run_backtest(self, request: BacktestRequest) -> BacktestResult:
        """Run a complete backtest."""
        backtest_id = str(uuid4())

        try:
            # Initialize status tracking
            status = BacktestStatus(
                backtest_id=backtest_id,
                status="running",
                progress_pct=0.0,
                current_step="Initializing",
                started_at=datetime.utcnow(),
                total_symbols=len(request.configuration.universe),
                total_days=(request.configuration.end_date - request.configuration.start_date).days
            )
            self.active_backtests[backtest_id] = status

            # Update progress: Data fetching
            await self._update_status(backtest_id, 10.0, "Fetching market data")

            # Fetch market data
            market_data = await self.data_provider.fetch_market_data(
                request.configuration.universe,
                request.configuration.start_date,
                request.configuration.end_date
            )

            # Update progress: Running backtest
            await self._update_status(backtest_id, 30.0, "Running backtest simulation")

            # Run the backtest
            result = await self.backtesting_engine.run_backtest(
                request.configuration, market_data
            )

            # Update progress: Calculating metrics
            await self._update_status(backtest_id, 80.0, "Calculating performance metrics")

            # Enhance with additional metrics
            enhanced_result = await self._enhance_result(result, market_data)

            # Update progress: Finalizing
            await self._update_status(backtest_id, 95.0, "Finalizing results")

            # Save result if requested
            if request.save_result:
                await self._save_backtest_result(enhanced_result)

            # Send email report if requested
            if request.send_email_report:
                await self._send_email_report(enhanced_result)

            # Mark as completed
            await self._update_status(backtest_id, 100.0, "Completed", "completed")

            logger.info(f"Backtest {backtest_id} completed successfully")
            return enhanced_result

        except Exception as e:
            logger.error(f"Backtest {backtest_id} failed: {str(e)}")
            await self._update_status(backtest_id, 0.0, f"Failed: {str(e)}", "failed")
            raise

        finally:
            # Clean up status after completion
            if backtest_id in self.active_backtests:
                self.active_backtests[backtest_id].completed_at = datetime.utcnow()

    async def get_backtest_status(self, backtest_id: str) -> Optional[BacktestStatus]:
        """Get the current status of a running backtest."""
        return self.active_backtests.get(backtest_id)

    async def cancel_backtest(self, backtest_id: str) -> bool:
        """Cancel a running backtest."""
        if backtest_id in self.active_backtests:
            status = self.active_backtests[backtest_id]
            if status.status == "running":
                status.status = "cancelled"
                status.completed_at = datetime.utcnow()
                logger.info(f"Backtest {backtest_id} cancelled")
                return True
        return False

    async def list_backtests(self, user_id: str, limit: int = 50) -> List[BacktestSummary]:
        """List recent backtests for a user."""
        # This would query the database in a real implementation
        # For now, return active backtests
        summaries = []

        for backtest_id, status in self.active_backtests.items():
            if status.status in ["completed", "failed"]:
                summary = BacktestSummary(
                    backtest_id=backtest_id,
                    strategy_name="Sample Strategy",
                    universe_size=status.total_symbols,
                    date_range=f"Sample date range",
                    total_return_pct=10.5,  # Would come from actual result
                    sharpe_ratio=1.2,
                    max_drawdown=-0.15,
                    created_at=status.started_at or datetime.utcnow(),
                    execution_time_seconds=(
                        (status.completed_at - status.started_at).total_seconds()
                        if status.completed_at and status.started_at else 0
                    ),
                    status=status.status
                )
                summaries.append(summary)

        return summaries[:limit]

    async def optimize_strategy(self, request: StrategyOptimizationRequest) -> BacktestResult:
        """Run strategy parameter optimization."""
        # This would implement genetic algorithm or grid search optimization
        # For now, return a simple backtest with the base strategy
        backtest_request = BacktestRequest(
            configuration=BacktestConfiguration(
                strategy=request.base_strategy,
                universe=["AAPL", "MSFT", "GOOGL"],  # Sample universe
                start_date=date(2020, 1, 1),
                end_date=date(2023, 12, 31),
                initial_capital=100000.0
            )
        )

        return await self.run_backtest(backtest_request)

    async def validate_strategy(self, strategy: TradingStrategy) -> Dict[str, Any]:
        """Validate a trading strategy configuration."""
        validation_results = {
            "is_valid": True,
            "warnings": [],
            "errors": []
        }

        # Validate entry rules
        if not strategy.entry_rules:
            validation_results["errors"].append("Strategy must have at least one entry rule")
            validation_results["is_valid"] = False

        # Validate exit rules
        if not strategy.exit_rules:
            validation_results["errors"].append("Strategy must have at least one exit rule")
            validation_results["is_valid"] = False

        # Validate position sizing
        if strategy.max_position_size <= 0 or strategy.max_position_size > 1:
            validation_results["errors"].append("Max position size must be between 0 and 1")
            validation_results["is_valid"] = False

        # Validate signal thresholds
        if not 0 <= strategy.entry_signal_threshold <= 1:
            validation_results["errors"].append("Entry signal threshold must be between 0 and 1")
            validation_results["is_valid"] = False

        if not 0 <= strategy.exit_signal_threshold <= 1:
            validation_results["errors"].append("Exit signal threshold must be between 0 and 1")
            validation_results["is_valid"] = False

        # Check for potential issues
        if strategy.max_positions > 50:
            validation_results["warnings"].append("High number of max positions may impact performance")

        if strategy.min_holding_days > 30:
            validation_results["warnings"].append("Long minimum holding period may reduce strategy flexibility")

        return validation_results

    async def get_strategy_templates(self) -> List[TradingStrategy]:
        """Get predefined strategy templates."""
        templates = []

        # Momentum strategy
        momentum_strategy = TradingStrategy(
            name="Momentum Strategy",
            description="Buy stocks with strong momentum, sell on weakness",
            entry_rules=[
                {
                    "name": "RSI Oversold",
                    "indicator": "RSI",
                    "operator": "gt",
                    "threshold": 70.0,
                    "weight": 0.4,
                    "lookback_days": 14
                },
                {
                    "name": "Price Above SMA",
                    "indicator": "SMA",
                    "operator": "gt",
                    "threshold": 0.0,  # Price above SMA
                    "weight": 0.6,
                    "lookback_days": 20
                }
            ],
            exit_rules=[
                {
                    "name": "RSI Overbought",
                    "indicator": "RSI",
                    "operator": "lt",
                    "threshold": 30.0,
                    "weight": 1.0,
                    "lookback_days": 14
                }
            ]
        )

        # Mean reversion strategy
        mean_reversion_strategy = TradingStrategy(
            name="Mean Reversion Strategy",
            description="Buy oversold stocks, sell overbought stocks",
            entry_rules=[
                {
                    "name": "RSI Oversold",
                    "indicator": "RSI",
                    "operator": "lt",
                    "threshold": 30.0,
                    "weight": 0.7,
                    "lookback_days": 14
                },
                {
                    "name": "Price Below Lower Bollinger Band",
                    "indicator": "BB_LOWER",
                    "operator": "lt",
                    "threshold": 0.0,
                    "weight": 0.3,
                    "lookback_days": 20
                }
            ],
            exit_rules=[
                {
                    "name": "RSI Normalized",
                    "indicator": "RSI",
                    "operator": "gt",
                    "threshold": 50.0,
                    "weight": 1.0,
                    "lookback_days": 14
                }
            ]
        )

        templates.extend([momentum_strategy, mean_reversion_strategy])
        return templates

    async def health_check(self) -> Dict[str, Any]:
        """Health check for backtesting service."""
        return {
            "service": "backtesting",
            "status": "healthy",
            "active_backtests": len(self.active_backtests),
            "data_provider": "yfinance",
            "features": [
                "walk_forward_optimization",
                "position_sizing_algorithms",
                "transaction_cost_modeling",
                "comprehensive_metrics"
            ]
        }

    # Private helper methods

    async def _update_status(self, backtest_id: str, progress_pct: float,
                           current_step: str, status: str = "running") -> None:
        """Update backtest status."""
        if backtest_id in self.active_backtests:
            self.active_backtests[backtest_id].progress_pct = progress_pct
            self.active_backtests[backtest_id].current_step = current_step
            self.active_backtests[backtest_id].status = status

    async def _enhance_result(self, result: BacktestResult,
                            market_data: MarketData) -> BacktestResult:
        """Enhance backtest result with additional analysis."""
        # Add sector performance analysis
        sector_performance = await self._calculate_sector_performance(result)
        result.sector_performance = sector_performance

        # Calculate additional rolling metrics
        result.rolling_sharpe = self._calculate_rolling_metrics(result.equity_curve, "sharpe")
        result.rolling_volatility = self._calculate_rolling_metrics(result.equity_curve, "volatility")

        # Add data quality assessment
        result.data_quality_score = self._assess_data_quality(market_data)

        return result

    async def _calculate_sector_performance(self, result: BacktestResult) -> Dict[str, float]:
        """Calculate performance attribution by sector."""
        sector_performance = {}

        # Group trades by sector
        for trade in result.trade_log:
            if trade.pnl is not None:
                sector = self.data_provider.get_sector_data(trade.symbol)
                if sector not in sector_performance:
                    sector_performance[sector] = 0.0
                sector_performance[sector] += trade.pnl

        return sector_performance

    def _calculate_rolling_metrics(self, equity_curve: List,
                                 metric_type: str, window: int = 252) -> List[float]:
        """Calculate rolling metrics from equity curve."""
        values = [snapshot.total_value for snapshot in equity_curve]

        if len(values) < window:
            return []

        rolling_metrics = []

        for i in range(window, len(values)):
            window_values = values[i-window:i]
            returns = np.array([
                (window_values[j] - window_values[j-1]) / window_values[j-1]
                for j in range(1, len(window_values))
            ])

            if metric_type == "sharpe":
                if len(returns) > 0 and np.std(returns) > 0:
                    sharpe = (np.mean(returns) * 252 - 0.02) / (np.std(returns) * np.sqrt(252))
                    rolling_metrics.append(sharpe)
                else:
                    rolling_metrics.append(0.0)
            elif metric_type == "volatility":
                if len(returns) > 0:
                    vol = np.std(returns) * np.sqrt(252)
                    rolling_metrics.append(vol)
                else:
                    rolling_metrics.append(0.0)

        return rolling_metrics

    def _assess_data_quality(self, market_data: MarketData) -> float:
        """Assess the quality of market data used in backtest."""
        if market_data.prices.empty:
            return 0.0

        # Calculate missing data percentage
        total_cells = market_data.prices.size
        missing_cells = market_data.prices.isnull().sum().sum()
        missing_pct = missing_cells / total_cells if total_cells > 0 else 1.0

        # Data quality score (1.0 = perfect, 0.0 = unusable)
        quality_score = max(0.0, 1.0 - missing_pct)

        return quality_score

    async def _save_backtest_result(self, result: BacktestResult) -> None:
        """Save backtest result to database."""
        # This would save to the database in a real implementation
        logger.info(f"Saving backtest result {result.backtest_id}")

    async def _send_email_report(self, result: BacktestResult) -> None:
        """Send email report for completed backtest."""
        # This would send an email report in a real implementation
        logger.info(f"Sending email report for backtest {result.backtest_id}")


# Utility functions for strategy building

def create_simple_momentum_strategy(rsi_threshold: float = 70.0,
                                  sma_period: int = 20) -> TradingStrategy:
    """Create a simple momentum strategy."""
    return TradingStrategy(
        name="Simple Momentum",
        description=f"Buy when RSI > {rsi_threshold} and price > {sma_period}-day SMA",
        entry_rules=[
            {
                "name": "RSI Momentum",
                "indicator": "RSI",
                "operator": "gt",
                "threshold": rsi_threshold,
                "weight": 0.6,
                "lookback_days": 14
            },
            {
                "name": "Price Above SMA",
                "indicator": "SMA",
                "operator": "gt",
                "threshold": 0.0,
                "weight": 0.4,
                "lookback_days": sma_period
            }
        ],
        exit_rules=[
            {
                "name": "RSI Weakness",
                "indicator": "RSI",
                "operator": "lt",
                "threshold": 50.0,
                "weight": 1.0,
                "lookback_days": 14
            }
        ]
    )


def create_mean_reversion_strategy(rsi_buy_threshold: float = 30.0,
                                 rsi_sell_threshold: float = 70.0) -> TradingStrategy:
    """Create a mean reversion strategy."""
    return TradingStrategy(
        name="Mean Reversion",
        description=f"Buy when RSI < {rsi_buy_threshold}, sell when RSI > {rsi_sell_threshold}",
        entry_rules=[
            {
                "name": "RSI Oversold",
                "indicator": "RSI",
                "operator": "lt",
                "threshold": rsi_buy_threshold,
                "weight": 1.0,
                "lookback_days": 14
            }
        ],
        exit_rules=[
            {
                "name": "RSI Overbought",
                "indicator": "RSI",
                "operator": "gt",
                "threshold": rsi_sell_threshold,
                "weight": 1.0,
                "lookback_days": 14
            }
        ]
    )