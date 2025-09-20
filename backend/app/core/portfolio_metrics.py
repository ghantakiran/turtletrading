"""
Advanced Portfolio Metrics Calculator.
Comprehensive risk and performance analytics for portfolio backtesting.
"""

import numpy as np
import pandas as pd
import scipy.stats as stats
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Tuple, Union
from dataclasses import dataclass
import logging

from ..models.backtester_models import (
    PortfolioSnapshot, PerformanceMetrics, Trade, Position
)

logger = logging.getLogger(__name__)


@dataclass
class RiskMetrics:
    """Container for risk-specific metrics."""
    var_95: float
    var_99: float
    cvar_95: float
    cvar_99: float
    max_drawdown: float
    max_drawdown_duration: int
    current_drawdown: float
    underwater_periods: List[Tuple[date, date, float]]
    tail_ratio: float
    gain_to_pain_ratio: float


@dataclass
class ReturnMetrics:
    """Container for return-specific metrics."""
    total_return: float
    annualized_return: float
    cagr: float
    volatility: float
    downside_volatility: float
    upside_volatility: float
    best_month: float
    worst_month: float
    best_year: float
    worst_year: float
    positive_months: int
    negative_months: int


@dataclass
class RatioMetrics:
    """Container for risk-adjusted return ratios."""
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    information_ratio: float
    treynor_ratio: float
    omega_ratio: float
    kappa_3: float
    burke_ratio: float
    pain_ratio: float


class PositionSizingCalculator:
    """Advanced position sizing algorithms."""

    @staticmethod
    def equal_weight(universe_size: int, max_position_size: float = 1.0) -> float:
        """Equal weight position sizing."""
        return min(1.0 / universe_size, max_position_size)

    @staticmethod
    def volatility_normalized(returns: pd.Series, target_volatility: float = 0.15,
                            lookback_days: int = 60, max_position_size: float = 0.25) -> float:
        """
        Volatility-normalized position sizing.
        Position size inversely proportional to realized volatility.
        """
        if len(returns) < lookback_days:
            return max_position_size * 0.5  # Conservative default

        recent_returns = returns.tail(lookback_days)
        realized_vol = recent_returns.std() * np.sqrt(252)

        if realized_vol == 0:
            return max_position_size * 0.5

        # Position size = target_volatility / realized_volatility
        position_size = target_volatility / realized_vol

        # Apply constraints
        return np.clip(position_size, 0.01, max_position_size)

    @staticmethod
    def kelly_criterion(returns: pd.Series, lookback_days: int = 252,
                       kelly_fraction: float = 0.25, max_position_size: float = 0.15) -> float:
        """
        Kelly Criterion position sizing.
        Optimal position size based on historical win rate and average win/loss.
        """
        if len(returns) < max(lookback_days, 30):
            return 0.05  # Conservative default

        recent_returns = returns.tail(lookback_days)

        # Separate wins and losses
        wins = recent_returns[recent_returns > 0]
        losses = recent_returns[recent_returns < 0]

        if len(wins) == 0 or len(losses) == 0:
            return 0.05

        # Calculate Kelly parameters
        win_rate = len(wins) / len(recent_returns)
        avg_win = wins.mean()
        avg_loss = abs(losses.mean())

        if avg_loss == 0:
            return 0.05

        # Kelly formula: f* = (bp - q) / b
        # where b = avg_win/avg_loss, p = win_rate, q = 1-win_rate
        b = avg_win / avg_loss
        full_kelly = (b * win_rate - (1 - win_rate)) / b

        # Apply Kelly fraction to reduce risk from estimation error
        kelly_size = full_kelly * kelly_fraction

        # Apply constraints
        return np.clip(kelly_size, 0.01, max_position_size)

    @staticmethod
    def risk_parity(correlations: np.ndarray, volatilities: np.ndarray,
                   target_volatility: float = 0.12) -> np.ndarray:
        """
        Risk parity position sizing.
        Equal risk contribution from each position.
        """
        n_assets = len(volatilities)

        if n_assets == 0:
            return np.array([])

        # Start with equal weights
        weights = np.ones(n_assets) / n_assets

        # Iterative algorithm to achieve risk parity
        for _ in range(100):  # Max iterations
            portfolio_vol = np.sqrt(weights.T @ correlations @ weights)

            if portfolio_vol == 0:
                break

            # Risk contributions
            marginal_risk = correlations @ weights / portfolio_vol
            risk_contributions = weights * marginal_risk

            # Target risk contribution
            target_risk = target_volatility / n_assets

            # Update weights
            weight_adjustment = target_risk / risk_contributions
            weight_adjustment = weight_adjustment / weight_adjustment.sum()

            weights = weights * weight_adjustment * 0.5 + weights * 0.5  # Damping

            # Normalize weights
            weights = weights / weights.sum()

            # Check convergence
            if np.max(np.abs(risk_contributions - target_risk)) < 1e-6:
                break

        return weights

    @staticmethod
    def fixed_dollar(portfolio_value: float, fixed_amount: float = 10000,
                    max_position_size: float = 0.2) -> float:
        """Fixed dollar amount position sizing."""
        if portfolio_value <= 0:
            return 0.0

        position_size = fixed_amount / portfolio_value
        return min(position_size, max_position_size)

    @staticmethod
    def momentum_based(returns: pd.Series, momentum_lookback: int = 126,
                      base_size: float = 0.1, momentum_multiplier: float = 0.5) -> float:
        """
        Momentum-based position sizing.
        Increase position size for assets with positive momentum.
        """
        if len(returns) < momentum_lookback:
            return base_size

        # Calculate momentum (cumulative return over lookback period)
        momentum = (1 + returns.tail(momentum_lookback)).prod() - 1

        # Momentum adjustment
        momentum_adj = 1 + momentum * momentum_multiplier

        # Apply momentum adjustment to base size
        adjusted_size = base_size * momentum_adj

        return np.clip(adjusted_size, 0.01, 0.25)


class AdvancedMetricsCalculator:
    """Calculate comprehensive portfolio performance and risk metrics."""

    def __init__(self, risk_free_rate: float = 0.02):
        self.risk_free_rate = risk_free_rate

    def calculate_comprehensive_metrics(self, equity_curve: List[PortfolioSnapshot],
                                      benchmark_returns: Optional[pd.Series] = None,
                                      trade_log: Optional[List[Trade]] = None) -> PerformanceMetrics:
        """Calculate all performance metrics from equity curve."""
        if not equity_curve or len(equity_curve) < 2:
            raise ValueError("Insufficient data for metrics calculation")

        # Extract data
        dates = [snapshot.date for snapshot in equity_curve]
        values = [snapshot.total_value for snapshot in equity_curve]

        # Calculate returns
        returns = self._calculate_returns(values)

        # Calculate individual metric groups
        return_metrics = self._calculate_return_metrics(returns, dates)
        risk_metrics = self._calculate_risk_metrics(returns, values, dates)
        ratio_metrics = self._calculate_ratio_metrics(returns, benchmark_returns)

        # Trade-based metrics
        trade_metrics = self._calculate_trade_metrics(trade_log) if trade_log else {}

        # Benchmark comparison
        benchmark_metrics = self._calculate_benchmark_metrics(returns, benchmark_returns)

        # Combine all metrics
        return PerformanceMetrics(
            # Return metrics
            total_return=return_metrics.total_return,
            total_return_pct=return_metrics.total_return * 100,
            annualized_return=return_metrics.annualized_return,
            cagr=return_metrics.cagr,

            # Risk metrics
            volatility=return_metrics.volatility,
            sharpe_ratio=ratio_metrics.sharpe_ratio,
            sortino_ratio=ratio_metrics.sortino_ratio,
            calmar_ratio=ratio_metrics.calmar_ratio,

            # Drawdown metrics
            max_drawdown=risk_metrics.max_drawdown,
            max_drawdown_duration=risk_metrics.max_drawdown_duration,
            current_drawdown=risk_metrics.current_drawdown,

            # Distribution metrics
            skewness=stats.skew(returns),
            kurtosis=stats.kurtosis(returns),
            var_95=risk_metrics.var_95,
            cvar_95=risk_metrics.cvar_95,

            # Benchmark comparison
            **benchmark_metrics,

            # Trade statistics
            **trade_metrics,

            # Additional metrics
            max_leverage=max((s.leverage for s in equity_curve), default=0),
            avg_leverage=np.mean([s.leverage for s in equity_curve]),
            start_date=dates[0],
            end_date=dates[-1],
            trading_days=len(returns)
        )

    def _calculate_returns(self, values: List[float]) -> np.ndarray:
        """Calculate returns from portfolio values."""
        return np.array([
            (values[i] - values[i-1]) / values[i-1]
            for i in range(1, len(values))
        ])

    def _calculate_return_metrics(self, returns: np.ndarray, dates: List[date]) -> ReturnMetrics:
        """Calculate return-based metrics."""
        if len(returns) == 0:
            return ReturnMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)

        # Basic return metrics
        total_return = (1 + returns).prod() - 1
        trading_days = len(returns)
        years = trading_days / 252.0

        annualized_return = (1 + total_return) ** (1 / years) - 1 if years > 0 else 0
        cagr = annualized_return

        # Volatility metrics
        volatility = np.std(returns) * np.sqrt(252)
        downside_returns = returns[returns < 0]
        upside_returns = returns[returns > 0]

        downside_volatility = np.std(downside_returns) * np.sqrt(252) if len(downside_returns) > 0 else 0
        upside_volatility = np.std(upside_returns) * np.sqrt(252) if len(upside_returns) > 0 else 0

        # Monthly analysis
        monthly_returns = self._calculate_monthly_returns(returns, dates)
        best_month = max(monthly_returns) if monthly_returns else 0
        worst_month = min(monthly_returns) if monthly_returns else 0
        positive_months = sum(1 for r in monthly_returns if r > 0)
        negative_months = sum(1 for r in monthly_returns if r < 0)

        # Yearly analysis
        yearly_returns = self._calculate_yearly_returns(returns, dates)
        best_year = max(yearly_returns) if yearly_returns else 0
        worst_year = min(yearly_returns) if yearly_returns else 0

        return ReturnMetrics(
            total_return=total_return,
            annualized_return=annualized_return,
            cagr=cagr,
            volatility=volatility,
            downside_volatility=downside_volatility,
            upside_volatility=upside_volatility,
            best_month=best_month,
            worst_month=worst_month,
            best_year=best_year,
            worst_year=worst_year,
            positive_months=positive_months,
            negative_months=negative_months
        )

    def _calculate_risk_metrics(self, returns: np.ndarray, values: List[float],
                              dates: List[date]) -> RiskMetrics:
        """Calculate risk-based metrics."""
        if len(returns) == 0:
            return RiskMetrics(0, 0, 0, 0, 0, 0, 0, [], 0, 0)

        # Value at Risk (VaR)
        var_95 = np.percentile(returns, 5)
        var_99 = np.percentile(returns, 1)

        # Conditional Value at Risk (CVaR)
        cvar_95 = np.mean(returns[returns <= var_95]) if np.any(returns <= var_95) else var_95
        cvar_99 = np.mean(returns[returns <= var_99]) if np.any(returns <= var_99) else var_99

        # Drawdown analysis
        dd_metrics = self._calculate_drawdown_metrics(values, dates)

        # Tail ratio
        tail_ratio = self._calculate_tail_ratio(returns)

        # Gain to pain ratio
        gain_to_pain = self._calculate_gain_to_pain_ratio(returns)

        return RiskMetrics(
            var_95=var_95,
            var_99=var_99,
            cvar_95=cvar_95,
            cvar_99=cvar_99,
            max_drawdown=dd_metrics['max_drawdown'],
            max_drawdown_duration=dd_metrics['max_drawdown_duration'],
            current_drawdown=dd_metrics['current_drawdown'],
            underwater_periods=dd_metrics['underwater_periods'],
            tail_ratio=tail_ratio,
            gain_to_pain_ratio=gain_to_pain
        )

    def _calculate_ratio_metrics(self, returns: np.ndarray,
                               benchmark_returns: Optional[pd.Series] = None) -> RatioMetrics:
        """Calculate risk-adjusted return ratios."""
        if len(returns) == 0:
            return RatioMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0)

        # Annualized metrics for ratios
        annualized_return = np.mean(returns) * 252
        volatility = np.std(returns) * np.sqrt(252)
        downside_volatility = np.std(returns[returns < 0]) * np.sqrt(252) if np.any(returns < 0) else 0

        # Sharpe ratio
        sharpe_ratio = (annualized_return - self.risk_free_rate) / volatility if volatility > 0 else 0

        # Sortino ratio
        sortino_ratio = (annualized_return - self.risk_free_rate) / downside_volatility if downside_volatility > 0 else 0

        # Calmar ratio
        max_drawdown = self._calculate_max_drawdown(returns)
        calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown < 0 else 0

        # Information ratio (vs benchmark)
        information_ratio = 0
        if benchmark_returns is not None and len(benchmark_returns) > 0:
            # Align returns with benchmark
            aligned_returns, aligned_benchmark = self._align_returns(returns, benchmark_returns)
            if len(aligned_returns) > 0:
                excess_returns = aligned_returns - aligned_benchmark
                tracking_error = np.std(excess_returns) * np.sqrt(252)
                information_ratio = np.mean(excess_returns) * 252 / tracking_error if tracking_error > 0 else 0

        # Treynor ratio (needs beta calculation)
        beta = self._calculate_beta(returns, benchmark_returns) if benchmark_returns is not None else 1.0
        treynor_ratio = (annualized_return - self.risk_free_rate) / beta if beta != 0 else 0

        # Omega ratio
        omega_ratio = self._calculate_omega_ratio(returns)

        # Kappa 3 (third moment risk-adjusted return)
        kappa_3 = self._calculate_kappa_3(returns)

        # Burke ratio
        burke_ratio = self._calculate_burke_ratio(returns)

        # Pain ratio
        pain_ratio = self._calculate_pain_ratio(returns)

        return RatioMetrics(
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sortino_ratio,
            calmar_ratio=calmar_ratio,
            information_ratio=information_ratio,
            treynor_ratio=treynor_ratio,
            omega_ratio=omega_ratio,
            kappa_3=kappa_3,
            burke_ratio=burke_ratio,
            pain_ratio=pain_ratio
        )

    def _calculate_drawdown_metrics(self, values: List[float], dates: List[date]) -> Dict:
        """Calculate comprehensive drawdown metrics."""
        values_array = np.array(values)
        peak = np.maximum.accumulate(values_array)
        drawdown = (values_array - peak) / peak

        max_drawdown = np.min(drawdown)
        current_drawdown = drawdown[-1]

        # Calculate drawdown durations
        max_dd_duration = 0
        current_dd_duration = 0
        underwater_periods = []
        underwater_start = None

        for i, dd in enumerate(drawdown):
            if dd < -1e-6:  # In drawdown (with small tolerance)
                if underwater_start is None:
                    underwater_start = dates[i]
                current_dd_duration += 1
                max_dd_duration = max(max_dd_duration, current_dd_duration)
            else:
                if underwater_start is not None:
                    underwater_periods.append((
                        underwater_start,
                        dates[i-1] if i > 0 else dates[i],
                        np.min(drawdown[max(0, i-current_dd_duration):i])
                    ))
                    underwater_start = None
                current_dd_duration = 0

        # Handle case where we end in drawdown
        if underwater_start is not None:
            underwater_periods.append((
                underwater_start,
                dates[-1],
                current_drawdown
            ))

        return {
            'max_drawdown': max_drawdown,
            'max_drawdown_duration': max_dd_duration,
            'current_drawdown': current_drawdown,
            'underwater_periods': underwater_periods
        }

    def _calculate_max_drawdown(self, returns: np.ndarray) -> float:
        """Calculate maximum drawdown from returns."""
        cumulative = (1 + returns).cumprod()
        peak = np.maximum.accumulate(cumulative)
        drawdown = (cumulative - peak) / peak
        return np.min(drawdown)

    def _calculate_monthly_returns(self, returns: np.ndarray, dates: List[date]) -> List[float]:
        """Calculate monthly returns."""
        if len(returns) != len(dates) - 1:
            return []

        df = pd.DataFrame({
            'date': dates[1:],  # Align with returns
            'return': returns
        })
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)

        monthly = df.resample('M').apply(lambda x: (1 + x).prod() - 1)
        return monthly['return'].tolist()

    def _calculate_yearly_returns(self, returns: np.ndarray, dates: List[date]) -> List[float]:
        """Calculate yearly returns."""
        if len(returns) != len(dates) - 1:
            return []

        df = pd.DataFrame({
            'date': dates[1:],
            'return': returns
        })
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)

        yearly = df.resample('Y').apply(lambda x: (1 + x).prod() - 1)
        return yearly['return'].tolist()

    def _calculate_tail_ratio(self, returns: np.ndarray) -> float:
        """Calculate tail ratio (95th percentile / 5th percentile)."""
        if len(returns) < 20:
            return 1.0

        p95 = np.percentile(returns, 95)
        p5 = np.percentile(returns, 5)

        return abs(p95 / p5) if p5 != 0 else 1.0

    def _calculate_gain_to_pain_ratio(self, returns: np.ndarray) -> float:
        """Calculate gain to pain ratio."""
        positive_returns = returns[returns > 0]
        negative_returns = returns[returns < 0]

        if len(positive_returns) == 0 or len(negative_returns) == 0:
            return 1.0

        gain = np.sum(positive_returns)
        pain = abs(np.sum(negative_returns))

        return gain / pain if pain > 0 else float('inf')

    def _calculate_omega_ratio(self, returns: np.ndarray, threshold: float = 0.0) -> float:
        """Calculate Omega ratio."""
        if len(returns) == 0:
            return 1.0

        excess_returns = returns - threshold
        positive_excess = excess_returns[excess_returns > 0]
        negative_excess = excess_returns[excess_returns <= 0]

        if len(negative_excess) == 0:
            return float('inf') if len(positive_excess) > 0 else 1.0

        positive_sum = np.sum(positive_excess) if len(positive_excess) > 0 else 0
        negative_sum = abs(np.sum(negative_excess))

        return positive_sum / negative_sum if negative_sum > 0 else float('inf')

    def _calculate_kappa_3(self, returns: np.ndarray) -> float:
        """Calculate Kappa 3 ratio (downside risk-adjusted return)."""
        if len(returns) < 3:
            return 0.0

        downside_returns = returns[returns < 0]
        if len(downside_returns) == 0:
            return float('inf')

        # Lower partial moment of order 3
        lpm3 = np.mean(np.power(abs(downside_returns), 3))
        annualized_return = np.mean(returns) * 252

        return annualized_return / (lpm3 ** (1/3)) if lpm3 > 0 else 0.0

    def _calculate_burke_ratio(self, returns: np.ndarray) -> float:
        """Calculate Burke ratio."""
        if len(returns) == 0:
            return 0.0

        # Calculate drawdowns
        cumulative = (1 + returns).cumprod()
        peak = np.maximum.accumulate(cumulative)
        drawdown = (cumulative - peak) / peak

        # Burke ratio uses sum of squared drawdowns
        drawdown_sum_sq = np.sum(drawdown ** 2)
        annualized_return = np.mean(returns) * 252

        return annualized_return / np.sqrt(drawdown_sum_sq) if drawdown_sum_sq > 0 else 0.0

    def _calculate_pain_ratio(self, returns: np.ndarray) -> float:
        """Calculate Pain ratio (return / average drawdown)."""
        if len(returns) == 0:
            return 0.0

        cumulative = (1 + returns).cumprod()
        peak = np.maximum.accumulate(cumulative)
        drawdown = (cumulative - peak) / peak

        avg_drawdown = abs(np.mean(drawdown))
        annualized_return = np.mean(returns) * 252

        return annualized_return / avg_drawdown if avg_drawdown > 0 else 0.0

    def _calculate_beta(self, returns: np.ndarray,
                       benchmark_returns: Optional[pd.Series]) -> float:
        """Calculate beta vs benchmark."""
        if benchmark_returns is None or len(benchmark_returns) == 0:
            return 1.0

        aligned_returns, aligned_benchmark = self._align_returns(returns, benchmark_returns)

        if len(aligned_returns) < 2:
            return 1.0

        covariance = np.cov(aligned_returns, aligned_benchmark)[0, 1]
        benchmark_variance = np.var(aligned_benchmark)

        return covariance / benchmark_variance if benchmark_variance > 0 else 1.0

    def _align_returns(self, returns: np.ndarray,
                      benchmark_returns: pd.Series) -> Tuple[np.ndarray, np.ndarray]:
        """Align portfolio returns with benchmark returns."""
        # This is a simplified alignment - in practice, you'd align by dates
        min_length = min(len(returns), len(benchmark_returns))
        return returns[:min_length], benchmark_returns.values[:min_length]

    def _calculate_benchmark_metrics(self, returns: np.ndarray,
                                   benchmark_returns: Optional[pd.Series] = None) -> Dict:
        """Calculate benchmark comparison metrics."""
        if benchmark_returns is None or len(benchmark_returns) == 0:
            return {
                'benchmark_return': 0.1,  # Default 10%
                'alpha': 0.0,
                'beta': 1.0,
                'information_ratio': 0.0,
                'tracking_error': 0.0
            }

        aligned_returns, aligned_benchmark = self._align_returns(returns, benchmark_returns)

        if len(aligned_returns) == 0:
            return {
                'benchmark_return': 0.1,
                'alpha': 0.0,
                'beta': 1.0,
                'information_ratio': 0.0,
                'tracking_error': 0.0
            }

        # Benchmark return
        benchmark_total_return = (1 + aligned_benchmark).prod() - 1

        # Beta
        beta = self._calculate_beta(returns, benchmark_returns)

        # Alpha
        portfolio_return = (1 + aligned_returns).prod() - 1
        alpha = portfolio_return - (self.risk_free_rate + beta * (benchmark_total_return - self.risk_free_rate))

        # Information ratio and tracking error
        excess_returns = aligned_returns - aligned_benchmark
        tracking_error = np.std(excess_returns) * np.sqrt(252)
        information_ratio = np.mean(excess_returns) * 252 / tracking_error if tracking_error > 0 else 0

        return {
            'benchmark_return': benchmark_total_return,
            'alpha': alpha,
            'beta': beta,
            'information_ratio': information_ratio,
            'tracking_error': tracking_error
        }

    def _calculate_trade_metrics(self, trade_log: List[Trade]) -> Dict:
        """Calculate trade-based performance metrics."""
        if not trade_log:
            return {
                'total_trades': 0,
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0.0,
                'avg_win': 0.0,
                'avg_loss': 0.0,
                'profit_factor': 0.0
            }

        # Filter completed trades (those with P&L)
        completed_trades = [t for t in trade_log if t.pnl is not None]

        if not completed_trades:
            return {
                'total_trades': len(trade_log),
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0.0,
                'avg_win': 0.0,
                'avg_loss': 0.0,
                'profit_factor': 0.0
            }

        winning_trades = [t for t in completed_trades if t.pnl > 0]
        losing_trades = [t for t in completed_trades if t.pnl < 0]

        total_trades = len(completed_trades)
        num_winning = len(winning_trades)
        num_losing = len(losing_trades)
        win_rate = num_winning / total_trades if total_trades > 0 else 0

        avg_win = np.mean([t.pnl for t in winning_trades]) if winning_trades else 0
        avg_loss = np.mean([t.pnl for t in losing_trades]) if losing_trades else 0

        total_wins = sum(t.pnl for t in winning_trades)
        total_losses = abs(sum(t.pnl for t in losing_trades))
        profit_factor = total_wins / total_losses if total_losses > 0 else float('inf')

        return {
            'total_trades': total_trades,
            'winning_trades': num_winning,
            'losing_trades': num_losing,
            'win_rate': win_rate,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': profit_factor
        }