"""
Risk Metrics Calculator

Specialized calculator for various risk metrics including Greek letters,
implied volatility, options risk metrics, and advanced portfolio statistics.
"""

import asyncio
import numpy as np
import pandas as pd
from typing import Optional, List, Dict, Any, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
import logging
from scipy import stats, optimize
from scipy.stats import norm
import math

from ..models.risk_models import (
    Position, Portfolio, RiskMetrics, RiskMetricType
)
from ..services.stock_service import StockService

logger = logging.getLogger(__name__)


class RiskMetricsCalculator:
    """
    Advanced risk metrics calculation service for various financial instruments
    """

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service

        # Configuration
        self.risk_free_rate = Decimal(0.02)  # 2% annual
        self.trading_days_per_year = 252
        self.market_hours_per_day = 6.5
        self.default_time_to_expiry = 30  # 30 days for options

    async def calculate_position_risk_metrics(
        self,
        position: Position,
        market_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Decimal]:
        """
        Calculate comprehensive risk metrics for a single position
        """
        try:
            metrics = {}

            # Basic position metrics
            metrics.update(self._calculate_basic_position_metrics(position))

            # Get historical data for advanced metrics
            if market_data is None:
                market_data = await self._get_position_market_data(position)

            # Volatility metrics
            if market_data and 'price_history' in market_data:
                volatility_metrics = self._calculate_volatility_metrics(
                    market_data['price_history'], position
                )
                metrics.update(volatility_metrics)

            # Beta and market risk metrics
            if market_data and 'market_data' in market_data:
                market_metrics = self._calculate_market_risk_metrics(
                    position, market_data['price_history'], market_data['market_data']
                )
                metrics.update(market_metrics)

            # Options Greeks (if applicable)
            if position.position_type == "option":
                options_metrics = await self._calculate_options_risk_metrics(
                    position, market_data
                )
                metrics.update(options_metrics)

            # Risk-adjusted returns
            performance_metrics = self._calculate_performance_metrics(position, market_data)
            metrics.update(performance_metrics)

            return metrics

        except Exception as e:
            logger.error(f"Error calculating position risk metrics for {position.symbol}: {e}")
            return {}

    async def calculate_portfolio_risk_metrics(
        self,
        portfolio: Portfolio,
        benchmark_symbol: str = "SPY"
    ) -> Dict[str, Decimal]:
        """
        Calculate comprehensive risk metrics for entire portfolio
        """
        try:
            metrics = {}

            # Portfolio composition metrics
            metrics.update(self._calculate_portfolio_composition_metrics(portfolio))

            # Get portfolio and benchmark data
            portfolio_data = await self._get_portfolio_market_data(portfolio)
            benchmark_data = await self._get_benchmark_data(benchmark_symbol)

            # Portfolio performance metrics
            if portfolio_data and 'returns' in portfolio_data:
                performance_metrics = self._calculate_portfolio_performance_metrics(
                    portfolio_data['returns'], benchmark_data
                )
                metrics.update(performance_metrics)

            # Risk decomposition
            risk_decomposition = self._calculate_risk_decomposition(portfolio, portfolio_data)
            metrics.update(risk_decomposition)

            # Liquidity metrics
            liquidity_metrics = await self._calculate_liquidity_metrics(portfolio)
            metrics.update(liquidity_metrics)

            # Tail risk metrics
            if portfolio_data and 'returns' in portfolio_data:
                tail_risk = self._calculate_tail_risk_metrics(portfolio_data['returns'])
                metrics.update(tail_risk)

            return metrics

        except Exception as e:
            logger.error(f"Error calculating portfolio risk metrics: {e}")
            return {}

    async def calculate_var_and_cvar(
        self,
        returns: List[float],
        confidence_levels: List[float] = [0.95, 0.99],
        method: str = "historical"
    ) -> Dict[str, Decimal]:
        """
        Calculate Value at Risk and Conditional Value at Risk
        """
        try:
            if not returns or len(returns) < 30:
                return {}

            returns_array = np.array(returns)
            results = {}

            for confidence_level in confidence_levels:
                alpha = 1 - confidence_level

                if method == "historical":
                    var = np.percentile(returns_array, alpha * 100)
                    cvar = np.mean(returns_array[returns_array <= var])

                elif method == "parametric":
                    mean_return = np.mean(returns_array)
                    std_return = np.std(returns_array)
                    z_score = norm.ppf(alpha)
                    var = mean_return + z_score * std_return

                    # CVaR calculation for normal distribution
                    cvar = mean_return - std_return * norm.pdf(z_score) / alpha

                elif method == "modified_cornish_fisher":
                    var, cvar = self._calculate_modified_var_cvar(returns_array, confidence_level)

                else:
                    continue

                level_str = str(int(confidence_level * 100))
                results[f"var_{level_str}"] = Decimal(str(abs(var)))
                results[f"cvar_{level_str}"] = Decimal(str(abs(cvar)))

            return results

        except Exception as e:
            logger.error(f"Error calculating VaR and CVaR: {e}")
            return {}

    async def calculate_options_greeks(
        self,
        symbol: str,
        strike_price: Decimal,
        time_to_expiry_days: int,
        option_type: str = "call",
        current_price: Optional[Decimal] = None,
        implied_volatility: Optional[Decimal] = None
    ) -> Dict[str, Decimal]:
        """
        Calculate options Greeks using Black-Scholes model
        """
        try:
            # Get current price if not provided
            if current_price is None:
                current_price_data = await self.stock_service.get_current_price(symbol)
                current_price = current_price_data.get('price', Decimal(100))

            # Estimate implied volatility if not provided
            if implied_volatility is None:
                implied_volatility = await self._estimate_implied_volatility(symbol)

            # Convert to float for calculations
            S = float(current_price)  # Current price
            K = float(strike_price)   # Strike price
            T = time_to_expiry_days / 365.0  # Time to expiry in years
            r = float(self.risk_free_rate)   # Risk-free rate
            sigma = float(implied_volatility)  # Volatility

            # Calculate Greeks
            greeks = self._black_scholes_greeks(S, K, T, r, sigma, option_type)

            return {key: Decimal(str(value)) for key, value in greeks.items()}

        except Exception as e:
            logger.error(f"Error calculating options Greeks for {symbol}: {e}")
            return {}

    def calculate_sharpe_ratio(
        self,
        returns: List[float],
        risk_free_rate: Optional[float] = None
    ) -> Decimal:
        """Calculate Sharpe ratio"""
        try:
            if not returns or len(returns) < 2:
                return Decimal(0)

            rf_rate = risk_free_rate or float(self.risk_free_rate) / self.trading_days_per_year
            excess_returns = np.array(returns) - rf_rate

            if np.std(excess_returns) == 0:
                return Decimal(0)

            sharpe = np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(self.trading_days_per_year)
            return Decimal(str(sharpe))

        except Exception as e:
            logger.error(f"Error calculating Sharpe ratio: {e}")
            return Decimal(0)

    def calculate_sortino_ratio(
        self,
        returns: List[float],
        target_return: float = 0.0
    ) -> Decimal:
        """Calculate Sortino ratio"""
        try:
            if not returns or len(returns) < 2:
                return Decimal(0)

            returns_array = np.array(returns)
            excess_returns = returns_array - target_return
            downside_returns = excess_returns[excess_returns < 0]

            if len(downside_returns) == 0:
                return Decimal(float('inf'))

            downside_deviation = np.sqrt(np.mean(downside_returns ** 2))

            if downside_deviation == 0:
                return Decimal(0)

            sortino = np.mean(excess_returns) / downside_deviation * np.sqrt(self.trading_days_per_year)
            return Decimal(str(sortino))

        except Exception as e:
            logger.error(f"Error calculating Sortino ratio: {e}")
            return Decimal(0)

    def calculate_maximum_drawdown(self, returns: List[float]) -> Dict[str, Any]:
        """Calculate maximum drawdown and related metrics"""
        try:
            if not returns or len(returns) < 2:
                return {"max_drawdown": Decimal(0), "drawdown_duration": 0}

            cumulative_returns = np.cumprod(1 + np.array(returns))
            running_max = np.maximum.accumulate(cumulative_returns)
            drawdowns = (cumulative_returns - running_max) / running_max

            max_drawdown = np.min(drawdowns)
            max_dd_index = np.argmin(drawdowns)

            # Find drawdown duration
            drawdown_start = 0
            for i in range(max_dd_index, -1, -1):
                if drawdowns[i] == 0:
                    drawdown_start = i
                    break

            drawdown_duration = max_dd_index - drawdown_start

            # Current drawdown
            current_drawdown = drawdowns[-1]

            return {
                "max_drawdown": Decimal(str(abs(max_drawdown))),
                "current_drawdown": Decimal(str(abs(current_drawdown))),
                "drawdown_duration": drawdown_duration,
                "avg_drawdown": Decimal(str(abs(np.mean(drawdowns[drawdowns < 0]))))
                    if np.any(drawdowns < 0) else Decimal(0)
            }

        except Exception as e:
            logger.error(f"Error calculating maximum drawdown: {e}")
            return {"max_drawdown": Decimal(0), "drawdown_duration": 0}

    async def calculate_beta_and_alpha(
        self,
        asset_returns: List[float],
        market_returns: List[float],
        risk_free_rate: Optional[float] = None
    ) -> Dict[str, Decimal]:
        """Calculate beta and alpha relative to market"""
        try:
            if not asset_returns or not market_returns or len(asset_returns) != len(market_returns):
                return {"beta": Decimal(1), "alpha": Decimal(0)}

            asset_array = np.array(asset_returns)
            market_array = np.array(market_returns)

            # Calculate beta
            covariance = np.cov(asset_array, market_array)[0, 1]
            market_variance = np.var(market_array)

            if market_variance == 0:
                beta = 1.0
            else:
                beta = covariance / market_variance

            # Calculate alpha
            rf_rate = risk_free_rate or float(self.risk_free_rate) / self.trading_days_per_year
            asset_excess_return = np.mean(asset_array) - rf_rate
            market_excess_return = np.mean(market_array) - rf_rate

            alpha = asset_excess_return - beta * market_excess_return

            # Annualize alpha
            alpha_annual = alpha * self.trading_days_per_year

            return {
                "beta": Decimal(str(beta)),
                "alpha": Decimal(str(alpha_annual)),
                "correlation": Decimal(str(np.corrcoef(asset_array, market_array)[0, 1]))
            }

        except Exception as e:
            logger.error(f"Error calculating beta and alpha: {e}")
            return {"beta": Decimal(1), "alpha": Decimal(0), "correlation": Decimal(0)}

    # Private helper methods

    def _calculate_basic_position_metrics(self, position: Position) -> Dict[str, Decimal]:
        """Calculate basic position risk metrics"""
        try:
            metrics = {}

            # Position size relative to account (placeholder - would need account value)
            metrics["position_value"] = position.market_value
            metrics["unrealized_pnl"] = position.unrealized_pnl
            metrics["unrealized_pnl_percent"] = position.unrealized_pnl_percent

            # Risk metrics if stop loss is set
            if position.stop_loss:
                distance_to_stop = abs(position.current_price - position.stop_loss)
                risk_per_share = distance_to_stop
                total_risk = risk_per_share * position.quantity

                metrics["risk_per_share"] = risk_per_share
                metrics["total_position_risk"] = total_risk
                metrics["risk_percentage"] = (total_risk / position.market_value) * 100

            # Time-based metrics
            days_held = (datetime.utcnow() - position.entry_date).days
            metrics["days_held"] = Decimal(days_held)

            return metrics

        except Exception as e:
            logger.error(f"Error calculating basic position metrics: {e}")
            return {}

    async def _get_position_market_data(self, position: Position) -> Dict[str, Any]:
        """Get market data for position risk calculations"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.trading_days_per_year)

            # Get price history
            price_history = await self.stock_service.get_price_history(
                position.symbol, start_date, end_date, "1d"
            )

            # Get current market data
            current_data = await self.stock_service.get_current_price(position.symbol)

            return {
                "price_history": price_history,
                "current_data": current_data
            }

        except Exception as e:
            logger.error(f"Error getting market data for {position.symbol}: {e}")
            return {}

    def _calculate_volatility_metrics(
        self,
        price_history: List[Dict],
        position: Position
    ) -> Dict[str, Decimal]:
        """Calculate volatility-based risk metrics"""
        try:
            if not price_history or len(price_history) < 30:
                return {}

            # Calculate returns
            prices = [float(p['close']) for p in price_history]
            returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]

            if not returns:
                return {}

            # Volatility metrics
            daily_vol = np.std(returns)
            annual_vol = daily_vol * np.sqrt(self.trading_days_per_year)

            # Realized volatility over different periods
            vol_30d = np.std(returns[-30:]) * np.sqrt(self.trading_days_per_year) if len(returns) >= 30 else annual_vol
            vol_90d = np.std(returns[-90:]) * np.sqrt(self.trading_days_per_year) if len(returns) >= 90 else annual_vol

            # Volatility of volatility
            vol_windows = []
            window_size = 20
            for i in range(window_size, len(returns)):
                window_vol = np.std(returns[i-window_size:i])
                vol_windows.append(window_vol)

            vol_of_vol = np.std(vol_windows) if vol_windows else 0

            return {
                "daily_volatility": Decimal(str(daily_vol)),
                "annual_volatility": Decimal(str(annual_vol)),
                "volatility_30d": Decimal(str(vol_30d)),
                "volatility_90d": Decimal(str(vol_90d)),
                "volatility_of_volatility": Decimal(str(vol_of_vol))
            }

        except Exception as e:
            logger.error(f"Error calculating volatility metrics: {e}")
            return {}

    def _calculate_market_risk_metrics(
        self,
        position: Position,
        price_history: List[Dict],
        market_data: Dict[str, Any]
    ) -> Dict[str, Decimal]:
        """Calculate market risk metrics (beta, correlation, etc.)"""
        try:
            # This is a simplified implementation
            # Real implementation would require market index data

            return {
                "beta": Decimal(1.0),  # Placeholder
                "market_correlation": Decimal(0.7),  # Placeholder
                "systematic_risk": Decimal(0.6),  # Placeholder
                "idiosyncratic_risk": Decimal(0.4)  # Placeholder
            }

        except Exception as e:
            logger.error(f"Error calculating market risk metrics: {e}")
            return {}

    async def _calculate_options_risk_metrics(
        self,
        position: Position,
        market_data: Dict[str, Any]
    ) -> Dict[str, Decimal]:
        """Calculate options-specific risk metrics"""
        try:
            # This would require options-specific data
            # Placeholder implementation
            return {
                "delta": Decimal(0.5),
                "gamma": Decimal(0.02),
                "theta": Decimal(-0.05),
                "vega": Decimal(0.15),
                "rho": Decimal(0.03),
                "implied_volatility": Decimal(0.25)
            }

        except Exception as e:
            logger.error(f"Error calculating options risk metrics: {e}")
            return {}

    def _calculate_performance_metrics(
        self,
        position: Position,
        market_data: Dict[str, Any]
    ) -> Dict[str, Decimal]:
        """Calculate risk-adjusted performance metrics"""
        try:
            metrics = {}

            # Basic return metrics
            if position.entry_price > 0:
                total_return = (position.current_price - position.entry_price) / position.entry_price
                metrics["total_return"] = total_return * 100

                # Annualized return
                days_held = (datetime.utcnow() - position.entry_date).days
                if days_held > 0:
                    annualized_return = (1 + total_return) ** (365 / days_held) - 1
                    metrics["annualized_return"] = Decimal(str(annualized_return * 100))

            return metrics

        except Exception as e:
            logger.error(f"Error calculating performance metrics: {e}")
            return {}

    def _calculate_portfolio_composition_metrics(self, portfolio: Portfolio) -> Dict[str, Decimal]:
        """Calculate portfolio composition metrics"""
        try:
            if not portfolio.positions:
                return {}

            # Position concentration
            total_value = portfolio.total_value
            position_weights = [pos.market_value / total_value for pos in portfolio.positions]

            # Herfindahl index
            herfindahl = sum(w**2 for w in position_weights)

            # Effective number of assets
            effective_assets = 1 / herfindahl if herfindahl > 0 else 0

            return {
                "number_of_positions": Decimal(len(portfolio.positions)),
                "largest_position_weight": Decimal(str(max(position_weights) * 100)),
                "herfindahl_index": Decimal(str(herfindahl)),
                "effective_number_of_assets": Decimal(str(effective_assets)),
                "cash_percentage": (portfolio.cash_balance / portfolio.total_value) * 100
            }

        except Exception as e:
            logger.error(f"Error calculating portfolio composition metrics: {e}")
            return {}

    async def _get_portfolio_market_data(self, portfolio: Portfolio) -> Dict[str, Any]:
        """Get market data for portfolio risk calculations"""
        try:
            # This would collect data for all positions
            # Simplified implementation
            return {"returns": []}

        except Exception as e:
            logger.error(f"Error getting portfolio market data: {e}")
            return {}

    async def _get_benchmark_data(self, benchmark_symbol: str) -> Dict[str, Any]:
        """Get benchmark data for portfolio comparison"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.trading_days_per_year)

            benchmark_history = await self.stock_service.get_price_history(
                benchmark_symbol, start_date, end_date, "1d"
            )

            return {"history": benchmark_history}

        except Exception as e:
            logger.error(f"Error getting benchmark data for {benchmark_symbol}: {e}")
            return {}

    def _calculate_portfolio_performance_metrics(
        self,
        portfolio_returns: List[float],
        benchmark_data: Dict[str, Any]
    ) -> Dict[str, Decimal]:
        """Calculate portfolio performance metrics"""
        try:
            if not portfolio_returns:
                return {}

            # Basic performance metrics
            sharpe = self.calculate_sharpe_ratio(portfolio_returns)
            sortino = self.calculate_sortino_ratio(portfolio_returns)
            drawdown_metrics = self.calculate_maximum_drawdown(portfolio_returns)

            metrics = {
                "sharpe_ratio": sharpe,
                "sortino_ratio": sortino
            }
            metrics.update(drawdown_metrics)

            return metrics

        except Exception as e:
            logger.error(f"Error calculating portfolio performance metrics: {e}")
            return {}

    def _calculate_risk_decomposition(
        self,
        portfolio: Portfolio,
        portfolio_data: Dict[str, Any]
    ) -> Dict[str, Decimal]:
        """Calculate risk decomposition by position"""
        try:
            # Simplified risk decomposition
            return {
                "systematic_risk_contribution": Decimal(60),
                "idiosyncratic_risk_contribution": Decimal(40),
                "concentration_risk": Decimal(15)
            }

        except Exception as e:
            logger.error(f"Error calculating risk decomposition: {e}")
            return {}

    async def _calculate_liquidity_metrics(self, portfolio: Portfolio) -> Dict[str, Decimal]:
        """Calculate portfolio liquidity metrics"""
        try:
            # Simplified liquidity metrics
            return {
                "liquidity_score": Decimal(75),
                "days_to_liquidate": Decimal(3),
                "bid_ask_spread_impact": Decimal(0.5)
            }

        except Exception as e:
            logger.error(f"Error calculating liquidity metrics: {e}")
            return {}

    def _calculate_tail_risk_metrics(self, returns: List[float]) -> Dict[str, Decimal]:
        """Calculate tail risk metrics"""
        try:
            if not returns or len(returns) < 50:
                return {}

            returns_array = np.array(returns)

            # Skewness and kurtosis
            skewness = stats.skew(returns_array)
            kurtosis = stats.kurtosis(returns_array)

            # Tail ratio
            left_tail = np.percentile(returns_array, 5)
            right_tail = np.percentile(returns_array, 95)
            tail_ratio = abs(right_tail / left_tail) if left_tail != 0 else 0

            return {
                "skewness": Decimal(str(skewness)),
                "kurtosis": Decimal(str(kurtosis)),
                "tail_ratio": Decimal(str(tail_ratio))
            }

        except Exception as e:
            logger.error(f"Error calculating tail risk metrics: {e}")
            return {}

    def _black_scholes_greeks(
        self,
        S: float, K: float, T: float, r: float, sigma: float, option_type: str
    ) -> Dict[str, float]:
        """Calculate Black-Scholes Greeks"""
        try:
            if T <= 0 or sigma <= 0:
                return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0}

            d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)

            if option_type.lower() == "call":
                delta = norm.cdf(d1)
                rho = K * T * np.exp(-r * T) * norm.cdf(d2) / 100
            else:  # put
                delta = norm.cdf(d1) - 1
                rho = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100

            gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
            theta = ((-S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) -
                    r * K * np.exp(-r * T) * norm.cdf(d2 if option_type.lower() == "call" else -d2)) / 365
            vega = S * norm.pdf(d1) * np.sqrt(T) / 100

            return {
                "delta": delta,
                "gamma": gamma,
                "theta": theta,
                "vega": vega,
                "rho": rho
            }

        except Exception as e:
            logger.error(f"Error calculating Black-Scholes Greeks: {e}")
            return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0}

    async def _estimate_implied_volatility(self, symbol: str) -> Decimal:
        """Estimate implied volatility from historical data"""
        try:
            # Get recent price history
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

            price_history = await self.stock_service.get_price_history(
                symbol, start_date, end_date, "1d"
            )

            if not price_history or len(price_history) < 10:
                return Decimal(0.25)  # Default 25% volatility

            # Calculate historical volatility
            prices = [float(p['close']) for p in price_history]
            returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]

            if not returns:
                return Decimal(0.25)

            daily_vol = np.std(returns)
            annual_vol = daily_vol * np.sqrt(self.trading_days_per_year)

            return Decimal(str(annual_vol))

        except Exception as e:
            logger.error(f"Error estimating implied volatility for {symbol}: {e}")
            return Decimal(0.25)

    def _calculate_modified_var_cvar(self, returns: np.ndarray, confidence_level: float) -> Tuple[float, float]:
        """Calculate modified VaR and CVaR using Cornish-Fisher expansion"""
        try:
            alpha = 1 - confidence_level
            mean_return = np.mean(returns)
            std_return = np.std(returns)
            skewness = stats.skew(returns)
            kurtosis = stats.kurtosis(returns)

            # Cornish-Fisher quantile
            z = norm.ppf(alpha)
            cf_quantile = (z +
                          (z**2 - 1) * skewness / 6 +
                          (z**3 - 3*z) * kurtosis / 24 -
                          (2*z**3 - 5*z) * skewness**2 / 36)

            var = mean_return + cf_quantile * std_return

            # Approximate CVaR
            cvar = mean_return - std_return * norm.pdf(norm.ppf(alpha)) / alpha

            return abs(var), abs(cvar)

        except Exception as e:
            logger.error(f"Error calculating modified VaR/CVaR: {e}")
            return 0.0, 0.0


# Global risk metrics calculator instance
_risk_metrics_calculator: Optional[RiskMetricsCalculator] = None


def get_risk_metrics_calculator() -> RiskMetricsCalculator:
    """Get the global risk metrics calculator"""
    global _risk_metrics_calculator
    if _risk_metrics_calculator is None:
        from ..services.stock_service import get_stock_service
        _risk_metrics_calculator = RiskMetricsCalculator(get_stock_service())
    return _risk_metrics_calculator