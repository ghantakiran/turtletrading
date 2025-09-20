"""
Portfolio Risk Analyzer

Comprehensive portfolio risk analysis including Value at Risk (VaR),
stress testing, scenario analysis, and risk decomposition.
"""

import asyncio
import numpy as np
import pandas as pd
from typing import Optional, List, Dict, Any, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
import logging
from scipy import stats
from scipy.optimize import minimize
import warnings

from ..models.risk_models import (
    Portfolio, Position, RiskMetrics, CorrelationMatrix,
    MonteCarloSimulation, RiskAlert, AlertSeverity
)
from ..services.stock_service import StockService

logger = logging.getLogger(__name__)

# Suppress scipy warnings for cleaner logs
warnings.filterwarnings('ignore', category=RuntimeWarning)


class PortfolioRiskAnalyzer:
    """
    Advanced portfolio risk analysis using quantitative risk models
    """

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service

        # Configuration
        self.default_confidence_levels = [0.95, 0.99]
        self.var_lookback_days = 252  # 1 year for VaR calculation
        self.correlation_lookback_days = 60  # 60 days for correlation
        self.risk_free_rate = Decimal(0.02)  # 2% annual risk-free rate
        self.trading_days_per_year = 252

    async def analyze_portfolio_risk(
        self,
        portfolio: Portfolio,
        lookback_days: int = 252
    ) -> RiskMetrics:
        """
        Comprehensive portfolio risk analysis
        """
        try:
            # Get historical data for all positions
            price_data = await self._get_portfolio_price_data(portfolio, lookback_days)

            if not price_data:
                logger.warning(f"No price data available for portfolio {portfolio.portfolio_id}")
                return self._create_default_risk_metrics()

            # Calculate portfolio returns
            portfolio_returns = self._calculate_portfolio_returns(portfolio, price_data)

            if len(portfolio_returns) < 30:
                logger.warning("Insufficient data for reliable risk analysis")
                return self._create_default_risk_metrics()

            # Calculate all risk metrics
            risk_metrics = await self._calculate_comprehensive_risk_metrics(
                portfolio, portfolio_returns, price_data
            )

            return risk_metrics

        except Exception as e:
            logger.error(f"Error analyzing portfolio risk: {e}")
            return self._create_default_risk_metrics()

    async def calculate_value_at_risk(
        self,
        portfolio: Portfolio,
        confidence_levels: Optional[List[float]] = None,
        method: str = "historical"
    ) -> Dict[str, Decimal]:
        """
        Calculate Value at Risk using multiple methods
        """
        try:
            confidence_levels = confidence_levels or [0.95, 0.99]

            # Get portfolio returns
            price_data = await self._get_portfolio_price_data(portfolio, self.var_lookback_days)
            if not price_data:
                return {f"var_{int(cl*100)}": Decimal(0) for cl in confidence_levels}

            portfolio_returns = self._calculate_portfolio_returns(portfolio, price_data)

            var_results = {}

            for confidence_level in confidence_levels:
                if method == "historical":
                    var_value = self._calculate_historical_var(portfolio_returns, confidence_level)
                elif method == "parametric":
                    var_value = self._calculate_parametric_var(portfolio_returns, confidence_level)
                elif method == "monte_carlo":
                    var_value = await self._calculate_monte_carlo_var(
                        portfolio, portfolio_returns, confidence_level
                    )
                else:
                    var_value = self._calculate_historical_var(portfolio_returns, confidence_level)

                var_results[f"var_{int(confidence_level*100)}"] = Decimal(str(var_value))

            return var_results

        except Exception as e:
            logger.error(f"Error calculating VaR: {e}")
            return {f"var_{int(cl*100)}": Decimal(0) for cl in confidence_levels or [0.95, 0.99]}

    async def calculate_correlation_matrix(
        self,
        portfolio: Portfolio,
        lookback_days: Optional[int] = None
    ) -> CorrelationMatrix:
        """
        Calculate correlation matrix for portfolio assets
        """
        try:
            lookback_days = lookback_days or self.correlation_lookback_days
            symbols = [pos.symbol for pos in portfolio.positions]

            if len(symbols) < 2:
                # Single asset portfolio
                return CorrelationMatrix(
                    symbols=symbols,
                    matrix=[[Decimal(1.0)]] if symbols else [],
                    period_days=lookback_days,
                    calculated_at=datetime.utcnow(),
                    avg_correlation=Decimal(0),
                    max_correlation=Decimal(1.0 if symbols else 0),
                    min_correlation=Decimal(1.0 if symbols else 0),
                    diversification_ratio=Decimal(1.0),
                    effective_number_of_assets=Decimal(len(symbols))
                )

            # Get price data for all symbols
            price_data = {}
            for symbol in symbols:
                try:
                    end_date = datetime.now()
                    start_date = end_date - timedelta(days=lookback_days + 30)
                    history = await self.stock_service.get_price_history(
                        symbol, start_date, end_date, "1d"
                    )
                    if history and len(history) > 20:
                        price_data[symbol] = history
                except Exception as e:
                    logger.warning(f"Could not get price data for {symbol}: {e}")

            if len(price_data) < 2:
                logger.warning("Insufficient price data for correlation calculation")
                return self._create_single_asset_correlation_matrix(symbols)

            # Calculate correlations
            correlation_matrix, stats = self._calculate_correlation_statistics(price_data)

            return CorrelationMatrix(
                symbols=symbols,
                matrix=correlation_matrix,
                period_days=lookback_days,
                calculated_at=datetime.utcnow(),
                avg_correlation=Decimal(str(stats['avg_correlation'])),
                max_correlation=Decimal(str(stats['max_correlation'])),
                min_correlation=Decimal(str(stats['min_correlation'])),
                diversification_ratio=Decimal(str(stats['diversification_ratio'])),
                effective_number_of_assets=Decimal(str(stats['effective_assets']))
            )

        except Exception as e:
            logger.error(f"Error calculating correlation matrix: {e}")
            return self._create_single_asset_correlation_matrix([pos.symbol for pos in portfolio.positions])

    async def run_monte_carlo_simulation(
        self,
        portfolio: Portfolio,
        time_horizon_days: int = 252,
        num_simulations: int = 10000
    ) -> MonteCarloSimulation:
        """
        Run Monte Carlo simulation for portfolio outcomes
        """
        try:
            # Get historical data
            price_data = await self._get_portfolio_price_data(portfolio, self.var_lookback_days)
            if not price_data:
                return self._create_default_monte_carlo()

            # Calculate portfolio statistics
            portfolio_returns = self._calculate_portfolio_returns(portfolio, price_data)
            mean_return = np.mean(portfolio_returns)
            volatility = np.std(portfolio_returns)

            # Run Monte Carlo simulation
            simulation_results = self._run_monte_carlo_paths(
                portfolio.total_value,
                mean_return,
                volatility,
                time_horizon_days,
                num_simulations
            )

            # Calculate statistics
            final_values = simulation_results[:, -1]
            returns = (final_values - float(portfolio.total_value)) / float(portfolio.total_value)

            percentiles = np.percentile(returns, [5, 25, 50, 75, 95])

            # Calculate probabilities
            probability_of_loss = np.sum(returns < 0) / len(returns)
            target_return = 0.10  # 10% target return
            probability_of_target = np.sum(returns >= target_return) / len(returns)

            # Select sample paths for visualization
            sample_indices = np.random.choice(num_simulations, min(100, num_simulations), replace=False)
            sample_paths = [simulation_results[i].tolist() for i in sample_indices]

            return MonteCarloSimulation(
                simulation_id=f"mc_{portfolio.portfolio_id}_{int(datetime.utcnow().timestamp())}",
                portfolio_id=portfolio.portfolio_id,
                num_simulations=num_simulations,
                time_horizon_days=time_horizon_days,
                confidence_levels=[Decimal(0.05), Decimal(0.25), Decimal(0.50), Decimal(0.75), Decimal(0.95)],
                expected_return=Decimal(str(mean_return * time_horizon_days)),
                expected_volatility=Decimal(str(volatility * np.sqrt(time_horizon_days))),
                percentile_5=Decimal(str(percentiles[0])),
                percentile_25=Decimal(str(percentiles[1])),
                percentile_50=Decimal(str(percentiles[2])),
                percentile_75=Decimal(str(percentiles[3])),
                percentile_95=Decimal(str(percentiles[4])),
                probability_of_loss=Decimal(str(probability_of_loss)),
                probability_of_target=Decimal(str(probability_of_target)),
                max_simulated_loss=Decimal(str(np.min(returns))),
                max_simulated_gain=Decimal(str(np.max(returns))),
                simulation_paths=sample_paths,
                simulated_at=datetime.utcnow()
            )

        except Exception as e:
            logger.error(f"Error running Monte Carlo simulation: {e}")
            return self._create_default_monte_carlo()

    async def analyze_concentration_risk(self, portfolio: Portfolio) -> Dict[str, Any]:
        """
        Analyze portfolio concentration risk
        """
        try:
            if not portfolio.positions:
                return {"concentration_risk": 0, "recommendations": []}

            # Calculate position weights
            total_value = portfolio.total_value
            position_weights = []

            for position in portfolio.positions:
                weight = position.market_value / total_value
                position_weights.append({
                    "symbol": position.symbol,
                    "weight": float(weight),
                    "value": float(position.market_value)
                })

            # Sort by weight
            position_weights.sort(key=lambda x: x["weight"], reverse=True)

            # Calculate concentration metrics
            largest_position = position_weights[0]["weight"] if position_weights else 0
            top_5_concentration = sum(pos["weight"] for pos in position_weights[:5])
            herfindahl_index = sum(pos["weight"]**2 for pos in position_weights)

            # Calculate effective number of assets
            effective_assets = 1 / herfindahl_index if herfindahl_index > 0 else 0

            # Generate recommendations
            recommendations = []
            if largest_position > 0.20:
                recommendations.append(f"Largest position ({position_weights[0]['symbol']}) represents {largest_position*100:.1f}% of portfolio - consider reducing")

            if top_5_concentration > 0.70:
                recommendations.append(f"Top 5 positions represent {top_5_concentration*100:.1f}% of portfolio - consider diversifying")

            if effective_assets < 5:
                recommendations.append("Portfolio has low diversification - consider adding more positions")

            return {
                "concentration_risk": herfindahl_index * 100,  # Scale for interpretation
                "largest_position_percent": largest_position * 100,
                "top_5_concentration": top_5_concentration * 100,
                "effective_number_of_assets": effective_assets,
                "herfindahl_index": herfindahl_index,
                "position_weights": position_weights,
                "recommendations": recommendations
            }

        except Exception as e:
            logger.error(f"Error analyzing concentration risk: {e}")
            return {"concentration_risk": 0, "recommendations": ["Error calculating concentration risk"]}

    async def stress_test_portfolio(
        self,
        portfolio: Portfolio,
        stress_scenarios: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Perform stress testing on portfolio
        """
        try:
            # Default stress scenarios
            default_scenarios = [
                {"name": "Market Crash", "market_shock": -0.20, "volatility_shock": 2.0},
                {"name": "Interest Rate Spike", "rate_shock": 0.02, "duration_shock": -0.15},
                {"name": "High Volatility", "volatility_shock": 3.0, "correlation_shock": 0.8},
                {"name": "Sector Rotation", "sector_rotation": 0.30},
                {"name": "Liquidity Crisis", "liquidity_shock": -0.10, "correlation_shock": 0.9}
            ]

            scenarios = stress_scenarios or default_scenarios
            results = {}

            for scenario in scenarios:
                scenario_result = await self._run_stress_scenario(portfolio, scenario)
                results[scenario["name"]] = scenario_result

            # Summary statistics
            worst_case_loss = min(result["portfolio_impact"] for result in results.values())
            avg_loss = np.mean([result["portfolio_impact"] for result in results.values()])

            results["summary"] = {
                "worst_case_loss": worst_case_loss,
                "average_loss": avg_loss,
                "scenarios_tested": len(scenarios),
                "positions_at_risk": sum(1 for pos in portfolio.positions
                                       if any(result["position_impacts"].get(pos.symbol, 0) < -0.10
                                            for result in results.values()))
            }

            return results

        except Exception as e:
            logger.error(f"Error performing stress test: {e}")
            return {"error": "Failed to perform stress test"}

    # Private helper methods

    async def _get_portfolio_price_data(
        self,
        portfolio: Portfolio,
        lookback_days: int
    ) -> Dict[str, List[Dict]]:
        """Get price data for all portfolio positions"""
        try:
            price_data = {}
            end_date = datetime.now()
            start_date = end_date - timedelta(days=lookback_days + 30)  # Extra buffer

            for position in portfolio.positions:
                try:
                    history = await self.stock_service.get_price_history(
                        position.symbol, start_date, end_date, "1d"
                    )
                    if history and len(history) > 20:
                        price_data[position.symbol] = history
                except Exception as e:
                    logger.warning(f"Could not get price data for {position.symbol}: {e}")

            return price_data

        except Exception as e:
            logger.error(f"Error getting portfolio price data: {e}")
            return {}

    def _calculate_portfolio_returns(
        self,
        portfolio: Portfolio,
        price_data: Dict[str, List[Dict]]
    ) -> np.ndarray:
        """Calculate portfolio returns from price data"""
        try:
            if not price_data:
                return np.array([])

            # Get common dates
            all_dates = set()
            for symbol_data in price_data.values():
                dates = [data['date'] for data in symbol_data]
                all_dates.update(dates)

            common_dates = sorted(all_dates)
            if len(common_dates) < 2:
                return np.array([])

            # Calculate position weights
            total_value = portfolio.total_value
            weights = {}
            for position in portfolio.positions:
                if position.symbol in price_data:
                    weights[position.symbol] = position.market_value / total_value

            # Calculate portfolio returns
            portfolio_returns = []
            prev_portfolio_value = None

            for i, date in enumerate(common_dates[1:], 1):
                portfolio_value = 0
                prev_date = common_dates[i-1]

                for symbol, weight in weights.items():
                    if symbol in price_data:
                        # Find prices for current and previous dates
                        current_price = None
                        prev_price = None

                        for data_point in price_data[symbol]:
                            if data_point['date'] == date:
                                current_price = data_point['close']
                            elif data_point['date'] == prev_date:
                                prev_price = data_point['close']

                        if current_price and prev_price:
                            asset_return = (current_price - prev_price) / prev_price
                            portfolio_value += weight * (1 + asset_return)

                if portfolio_value > 0 and prev_portfolio_value:
                    portfolio_return = (portfolio_value - prev_portfolio_value) / prev_portfolio_value
                    portfolio_returns.append(portfolio_return)

                prev_portfolio_value = portfolio_value or 1.0

            return np.array(portfolio_returns)

        except Exception as e:
            logger.error(f"Error calculating portfolio returns: {e}")
            return np.array([])

    async def _calculate_comprehensive_risk_metrics(
        self,
        portfolio: Portfolio,
        portfolio_returns: np.ndarray,
        price_data: Dict[str, List[Dict]]
    ) -> RiskMetrics:
        """Calculate comprehensive risk metrics"""
        try:
            if len(portfolio_returns) == 0:
                return self._create_default_risk_metrics()

            # Basic statistics
            daily_volatility = np.std(portfolio_returns)
            annual_volatility = daily_volatility * np.sqrt(self.trading_days_per_year)
            mean_return = np.mean(portfolio_returns)

            # VaR calculations
            var_95 = np.percentile(portfolio_returns, 5) * float(portfolio.total_value)
            var_99 = np.percentile(portfolio_returns, 1) * float(portfolio.total_value)

            # Conditional VaR (Expected Shortfall)
            cvar_95 = np.mean(portfolio_returns[portfolio_returns <= np.percentile(portfolio_returns, 5)]) * float(portfolio.total_value)
            cvar_99 = np.mean(portfolio_returns[portfolio_returns <= np.percentile(portfolio_returns, 1)]) * float(portfolio.total_value)

            # Drawdown calculations
            cumulative_returns = np.cumprod(1 + portfolio_returns)
            running_max = np.maximum.accumulate(cumulative_returns)
            drawdowns = (cumulative_returns - running_max) / running_max

            current_drawdown = drawdowns[-1] if len(drawdowns) > 0 else 0
            max_drawdown = np.min(drawdowns) if len(drawdowns) > 0 else 0
            avg_drawdown = np.mean(drawdowns[drawdowns < 0]) if np.any(drawdowns < 0) else 0

            # Performance ratios
            risk_free_daily = float(self.risk_free_rate) / self.trading_days_per_year
            excess_returns = portfolio_returns - risk_free_daily

            sharpe_ratio = np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(self.trading_days_per_year) if np.std(excess_returns) > 0 else 0

            # Sortino ratio (downside deviation)
            downside_returns = portfolio_returns[portfolio_returns < risk_free_daily]
            downside_volatility = np.std(downside_returns) if len(downside_returns) > 0 else daily_volatility

            sortino_ratio = np.mean(excess_returns) / downside_volatility * np.sqrt(self.trading_days_per_year) if downside_volatility > 0 else 0

            # Market risk metrics (simplified)
            beta = 1.0  # Placeholder - would calculate against market index
            alpha = mean_return * self.trading_days_per_year - float(self.risk_free_rate)
            correlation_market = 0.8  # Placeholder

            # Concentration risk
            concentration_analysis = await self.analyze_concentration_risk(portfolio)

            return RiskMetrics(
                var_95=Decimal(str(abs(var_95))),
                var_99=Decimal(str(abs(var_99))),
                cvar_95=Decimal(str(abs(cvar_95))),
                cvar_99=Decimal(str(abs(cvar_99))),
                daily_volatility=Decimal(str(daily_volatility)),
                annual_volatility=Decimal(str(annual_volatility)),
                downside_volatility=Decimal(str(downside_volatility)),
                sharpe_ratio=Decimal(str(sharpe_ratio)),
                sortino_ratio=Decimal(str(sortino_ratio)),
                calmar_ratio=Decimal(str(abs(mean_return * self.trading_days_per_year / max_drawdown))) if max_drawdown < 0 else None,
                information_ratio=None,
                current_drawdown=Decimal(str(abs(current_drawdown))),
                max_drawdown=Decimal(str(abs(max_drawdown))),
                avg_drawdown=Decimal(str(abs(avg_drawdown))),
                drawdown_duration=None,
                beta=Decimal(str(beta)),
                alpha=Decimal(str(alpha)),
                correlation_market=Decimal(str(correlation_market)),
                concentration_risk=Decimal(str(concentration_analysis.get("concentration_risk", 0))),
                largest_position_percent=Decimal(str(concentration_analysis.get("largest_position_percent", 0))),
                top_5_concentration=Decimal(str(concentration_analysis.get("top_5_concentration", 0))),
                liquidity_score=Decimal(75),  # Placeholder
                days_to_liquidate=Decimal(3),  # Placeholder
                calculated_at=datetime.utcnow(),
                period_days=len(portfolio_returns)
            )

        except Exception as e:
            logger.error(f"Error calculating comprehensive risk metrics: {e}")
            return self._create_default_risk_metrics()

    def _calculate_historical_var(self, returns: np.ndarray, confidence_level: float) -> float:
        """Calculate historical VaR"""
        if len(returns) == 0:
            return 0.0
        return abs(np.percentile(returns, (1 - confidence_level) * 100))

    def _calculate_parametric_var(self, returns: np.ndarray, confidence_level: float) -> float:
        """Calculate parametric VaR assuming normal distribution"""
        if len(returns) == 0:
            return 0.0

        mean_return = np.mean(returns)
        volatility = np.std(returns)
        z_score = stats.norm.ppf(1 - confidence_level)

        var = abs(mean_return + z_score * volatility)
        return var

    async def _calculate_monte_carlo_var(
        self,
        portfolio: Portfolio,
        returns: np.ndarray,
        confidence_level: float,
        num_simulations: int = 10000
    ) -> float:
        """Calculate Monte Carlo VaR"""
        try:
            if len(returns) == 0:
                return 0.0

            mean_return = np.mean(returns)
            volatility = np.std(returns)

            # Generate random returns
            random_returns = np.random.normal(mean_return, volatility, num_simulations)

            # Calculate VaR
            var = abs(np.percentile(random_returns, (1 - confidence_level) * 100))
            return var

        except Exception as e:
            logger.error(f"Error calculating Monte Carlo VaR: {e}")
            return 0.0

    def _calculate_correlation_statistics(self, price_data: Dict[str, List[Dict]]) -> Tuple[List[List[Decimal]], Dict]:
        """Calculate correlation matrix and statistics"""
        try:
            symbols = list(price_data.keys())
            n = len(symbols)

            if n < 2:
                return [[Decimal(1.0)]], {"avg_correlation": 0, "max_correlation": 1, "min_correlation": 1, "diversification_ratio": 1, "effective_assets": 1}

            # Build return matrix
            returns_data = {}
            for symbol, history in price_data.items():
                returns = []
                for i in range(1, len(history)):
                    ret = (history[i]['close'] - history[i-1]['close']) / history[i-1]['close']
                    returns.append(ret)
                returns_data[symbol] = returns

            # Find common length
            min_length = min(len(returns) for returns in returns_data.values())
            if min_length < 20:
                # Insufficient data
                return self._create_identity_correlation_matrix(symbols)

            # Create correlation matrix
            correlation_matrix = []
            correlations = []

            for i, symbol1 in enumerate(symbols):
                row = []
                for j, symbol2 in enumerate(symbols):
                    if i == j:
                        corr = 1.0
                    else:
                        try:
                            returns1 = np.array(returns_data[symbol1][-min_length:])
                            returns2 = np.array(returns_data[symbol2][-min_length:])
                            corr = np.corrcoef(returns1, returns2)[0, 1]
                            if np.isnan(corr):
                                corr = 0.0
                            correlations.append(abs(corr))
                        except:
                            corr = 0.0

                    row.append(Decimal(str(corr)))
                correlation_matrix.append(row)

            # Calculate statistics
            if correlations:
                avg_correlation = np.mean(correlations)
                max_correlation = np.max(correlations)
                min_correlation = np.min(correlations)
            else:
                avg_correlation = max_correlation = min_correlation = 0.0

            # Calculate diversification metrics
            diversification_ratio = 1.0 - avg_correlation
            effective_assets = n * (1 - avg_correlation) / (1 + (n - 1) * avg_correlation) if avg_correlation < 1 else 1

            stats_dict = {
                "avg_correlation": avg_correlation,
                "max_correlation": max_correlation,
                "min_correlation": min_correlation,
                "diversification_ratio": diversification_ratio,
                "effective_assets": effective_assets
            }

            return correlation_matrix, stats_dict

        except Exception as e:
            logger.error(f"Error calculating correlation statistics: {e}")
            return self._create_identity_correlation_matrix(symbols)

    def _run_monte_carlo_paths(
        self,
        initial_value: Decimal,
        mean_return: float,
        volatility: float,
        time_horizon: int,
        num_simulations: int
    ) -> np.ndarray:
        """Run Monte Carlo simulation paths"""
        try:
            dt = 1.0  # Daily time step
            paths = np.zeros((num_simulations, time_horizon + 1))
            paths[:, 0] = float(initial_value)

            for t in range(1, time_horizon + 1):
                random_shocks = np.random.normal(0, 1, num_simulations)
                paths[:, t] = paths[:, t-1] * np.exp(
                    (mean_return - 0.5 * volatility**2) * dt +
                    volatility * np.sqrt(dt) * random_shocks
                )

            return paths

        except Exception as e:
            logger.error(f"Error running Monte Carlo paths: {e}")
            return np.zeros((num_simulations, time_horizon + 1))

    async def _run_stress_scenario(self, portfolio: Portfolio, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single stress test scenario"""
        try:
            scenario_name = scenario["name"]
            total_impact = 0
            position_impacts = {}

            for position in portfolio.positions:
                # Calculate position impact based on scenario
                impact = 0

                if "market_shock" in scenario:
                    impact += scenario["market_shock"]

                if "volatility_shock" in scenario:
                    # Higher volatility generally means negative impact
                    impact -= scenario["volatility_shock"] * 0.05

                if "sector_rotation" in scenario:
                    # Simplified sector impact
                    impact += np.random.uniform(-scenario["sector_rotation"], scenario["sector_rotation"])

                # Apply to position value
                position_value_impact = position.market_value * Decimal(str(impact))
                total_impact += position_value_impact
                position_impacts[position.symbol] = float(impact)

            portfolio_impact_percent = (total_impact / portfolio.total_value) * 100

            return {
                "scenario_name": scenario_name,
                "portfolio_impact": float(portfolio_impact_percent),
                "portfolio_impact_value": float(total_impact),
                "position_impacts": position_impacts,
                "worst_position": min(position_impacts, key=position_impacts.get) if position_impacts else None,
                "best_position": max(position_impacts, key=position_impacts.get) if position_impacts else None
            }

        except Exception as e:
            logger.error(f"Error running stress scenario {scenario.get('name', 'Unknown')}: {e}")
            return {"scenario_name": scenario.get("name", "Unknown"), "portfolio_impact": 0, "position_impacts": {}}

    def _create_default_risk_metrics(self) -> RiskMetrics:
        """Create default risk metrics when calculation fails"""
        return RiskMetrics(
            var_95=Decimal(0),
            var_99=Decimal(0),
            cvar_95=Decimal(0),
            cvar_99=Decimal(0),
            daily_volatility=Decimal(0),
            annual_volatility=Decimal(0),
            downside_volatility=Decimal(0),
            sharpe_ratio=Decimal(0),
            sortino_ratio=Decimal(0),
            current_drawdown=Decimal(0),
            max_drawdown=Decimal(0),
            avg_drawdown=Decimal(0),
            beta=Decimal(1),
            alpha=Decimal(0),
            correlation_market=Decimal(0),
            concentration_risk=Decimal(0),
            largest_position_percent=Decimal(0),
            top_5_concentration=Decimal(0),
            liquidity_score=Decimal(100),
            days_to_liquidate=Decimal(1),
            calculated_at=datetime.utcnow(),
            period_days=0
        )

    def _create_single_asset_correlation_matrix(self, symbols: List[str]) -> CorrelationMatrix:
        """Create correlation matrix for single asset or when calculation fails"""
        n = len(symbols)
        matrix = []
        for i in range(n):
            row = []
            for j in range(n):
                row.append(Decimal(1.0) if i == j else Decimal(0.0))
            matrix.append(row)

        return CorrelationMatrix(
            symbols=symbols,
            matrix=matrix,
            period_days=60,
            calculated_at=datetime.utcnow(),
            avg_correlation=Decimal(0),
            max_correlation=Decimal(1.0 if symbols else 0),
            min_correlation=Decimal(0),
            diversification_ratio=Decimal(1.0),
            effective_number_of_assets=Decimal(len(symbols))
        )

    def _create_identity_correlation_matrix(self, symbols: List[str]) -> Tuple[List[List[Decimal]], Dict]:
        """Create identity correlation matrix when calculation fails"""
        n = len(symbols)
        matrix = []
        for i in range(n):
            row = []
            for j in range(n):
                row.append(Decimal(1.0) if i == j else Decimal(0.0))
            matrix.append(row)

        stats_dict = {
            "avg_correlation": 0.0,
            "max_correlation": 1.0,
            "min_correlation": 0.0,
            "diversification_ratio": 1.0,
            "effective_assets": n
        }

        return matrix, stats_dict

    def _create_default_monte_carlo(self) -> MonteCarloSimulation:
        """Create default Monte Carlo simulation when calculation fails"""
        return MonteCarloSimulation(
            simulation_id="default",
            portfolio_id="unknown",
            num_simulations=0,
            time_horizon_days=252,
            confidence_levels=[],
            expected_return=Decimal(0),
            expected_volatility=Decimal(0),
            percentile_5=Decimal(0),
            percentile_25=Decimal(0),
            percentile_50=Decimal(0),
            percentile_75=Decimal(0),
            percentile_95=Decimal(0),
            probability_of_loss=Decimal(0),
            probability_of_target=Decimal(0),
            max_simulated_loss=Decimal(0),
            max_simulated_gain=Decimal(0),
            simulated_at=datetime.utcnow()
        )


# Global portfolio risk analyzer instance
_portfolio_risk_analyzer: Optional[PortfolioRiskAnalyzer] = None


def get_portfolio_risk_analyzer() -> PortfolioRiskAnalyzer:
    """Get the global portfolio risk analyzer"""
    global _portfolio_risk_analyzer
    if _portfolio_risk_analyzer is None:
        from ..services.stock_service import get_stock_service
        _portfolio_risk_analyzer = PortfolioRiskAnalyzer(get_stock_service())
    return _portfolio_risk_analyzer