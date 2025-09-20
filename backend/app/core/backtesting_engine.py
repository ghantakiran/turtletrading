"""
Portfolio Backtesting Engine with Walk-Forward Optimization.
Comprehensive backtesting framework with strategy execution, performance analysis, and risk management.
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set, Any
from uuid import uuid4
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
import warnings

from ..models.backtester_models import (
    BacktestConfiguration, TradingStrategy, SignalRule, Trade, Position,
    PortfolioSnapshot, PerformanceMetrics, WalkForwardResult, BacktestResult,
    PositionSizingMethod, RebalanceFrequency, TransactionCosts
)

# Suppress pandas warnings for cleaner output
warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)

logger = logging.getLogger(__name__)


@dataclass
class MarketData:
    """Market data container for backtesting."""
    prices: pd.DataFrame  # OHLCV data with MultiIndex (date, symbol)
    indicators: pd.DataFrame  # Technical indicators
    risk_free_rate: pd.Series  # Risk-free rate time series
    benchmark: pd.Series  # Benchmark returns


class SignalGenerator:
    """Generates trading signals based on strategy rules."""

    def __init__(self, strategy: TradingStrategy):
        self.strategy = strategy
        self.entry_rules = strategy.entry_rules
        self.exit_rules = strategy.exit_rules

    def calculate_technical_indicators(self, prices: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical indicators for all symbols."""
        indicators = {}

        for symbol in prices.columns.get_level_values(1).unique():
            symbol_data = prices.xs(symbol, level=1, axis=1)
            symbol_indicators = {}

            # Moving averages
            symbol_indicators['SMA_20'] = symbol_data['Close'].rolling(20).mean()
            symbol_indicators['SMA_50'] = symbol_data['Close'].rolling(50).mean()
            symbol_indicators['EMA_12'] = symbol_data['Close'].ewm(span=12).mean()
            symbol_indicators['EMA_26'] = symbol_data['Close'].ewm(span=26).mean()

            # RSI
            delta = symbol_data['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / loss
            symbol_indicators['RSI'] = 100 - (100 / (1 + rs))

            # MACD
            symbol_indicators['MACD'] = symbol_indicators['EMA_12'] - symbol_indicators['EMA_26']
            symbol_indicators['MACD_Signal'] = symbol_indicators['MACD'].ewm(span=9).mean()
            symbol_indicators['MACD_Histogram'] = symbol_indicators['MACD'] - symbol_indicators['MACD_Signal']

            # Bollinger Bands
            bb_period = 20
            bb_std = 2
            bb_middle = symbol_data['Close'].rolling(bb_period).mean()
            bb_std_dev = symbol_data['Close'].rolling(bb_period).std()
            symbol_indicators['BB_UPPER'] = bb_middle + (bb_std_dev * bb_std)
            symbol_indicators['BB_LOWER'] = bb_middle - (bb_std_dev * bb_std)
            symbol_indicators['BB_MIDDLE'] = bb_middle

            # ADX
            high_low = symbol_data['High'] - symbol_data['Low']
            high_close = np.abs(symbol_data['High'] - symbol_data['Close'].shift())
            low_close = np.abs(symbol_data['Low'] - symbol_data['Close'].shift())
            tr = np.maximum(high_low, np.maximum(high_close, low_close))
            symbol_indicators['ATR'] = tr.rolling(14).mean()

            # Stochastic
            stoch_period = 14
            low_min = symbol_data['Low'].rolling(stoch_period).min()
            high_max = symbol_data['High'].rolling(stoch_period).max()
            symbol_indicators['STOCH_K'] = 100 * (symbol_data['Close'] - low_min) / (high_max - low_min)
            symbol_indicators['STOCH_D'] = symbol_indicators['STOCH_K'].rolling(3).mean()

            # OBV
            obv = [0]
            for i in range(1, len(symbol_data)):
                if symbol_data['Close'].iloc[i] > symbol_data['Close'].iloc[i - 1]:
                    obv.append(obv[-1] + symbol_data['Volume'].iloc[i])
                elif symbol_data['Close'].iloc[i] < symbol_data['Close'].iloc[i - 1]:
                    obv.append(obv[-1] - symbol_data['Volume'].iloc[i])
                else:
                    obv.append(obv[-1])
            symbol_indicators['OBV'] = pd.Series(obv, index=symbol_data.index)

            # Store indicators for this symbol
            for indicator_name, values in symbol_indicators.items():
                if symbol not in indicators:
                    indicators[symbol] = {}
                indicators[symbol][indicator_name] = values

        # Convert to MultiIndex DataFrame
        indicator_df = pd.DataFrame()
        for symbol, symbol_indicators in indicators.items():
            for indicator, values in symbol_indicators.items():
                indicator_df[(indicator, symbol)] = values

        indicator_df.columns = pd.MultiIndex.from_tuples(
            indicator_df.columns, names=['Indicator', 'Symbol']
        )

        return indicator_df

    def evaluate_rule(self, rule: SignalRule, indicators: pd.DataFrame, symbol: str,
                     current_date: date) -> float:
        """Evaluate a single signal rule for a symbol on a specific date."""
        try:
            if (rule.indicator, symbol) not in indicators.columns:
                return 0.0

            indicator_values = indicators[(rule.indicator, symbol)]
            current_value = indicator_values.loc[current_date]

            if pd.isna(current_value):
                return 0.0

            # Handle crossover/crossunder operators
            if rule.operator in ['crossover', 'crossunder']:
                if len(indicator_values.loc[:current_date]) < 2:
                    return 0.0

                prev_value = indicator_values.loc[:current_date].iloc[-2]
                if pd.isna(prev_value):
                    return 0.0

                if rule.operator == 'crossover':
                    return 1.0 if (prev_value <= rule.threshold and current_value > rule.threshold) else 0.0
                else:  # crossunder
                    return 1.0 if (prev_value >= rule.threshold and current_value < rule.threshold) else 0.0

            # Handle comparison operators
            elif rule.operator == 'gt':
                return 1.0 if current_value > rule.threshold else 0.0
            elif rule.operator == 'lt':
                return 1.0 if current_value < rule.threshold else 0.0
            elif rule.operator == 'gte':
                return 1.0 if current_value >= rule.threshold else 0.0
            elif rule.operator == 'lte':
                return 1.0 if current_value <= rule.threshold else 0.0

            return 0.0

        except (KeyError, IndexError, ValueError):
            return 0.0

    def generate_signals(self, indicators: pd.DataFrame, symbol: str, dates: List[date]) -> Dict[date, Dict[str, float]]:
        """Generate entry and exit signals for a symbol across dates."""
        signals = {}

        for current_date in dates:
            # Calculate entry signal
            entry_signal = 0.0
            total_entry_weight = sum(rule.weight for rule in self.entry_rules)

            if total_entry_weight > 0:
                for rule in self.entry_rules:
                    rule_signal = self.evaluate_rule(rule, indicators, symbol, current_date)
                    entry_signal += rule_signal * rule.weight / total_entry_weight

            # Calculate exit signal
            exit_signal = 0.0
            total_exit_weight = sum(rule.weight for rule in self.exit_rules)

            if total_exit_weight > 0:
                for rule in self.exit_rules:
                    rule_signal = self.evaluate_rule(rule, indicators, symbol, current_date)
                    exit_signal += rule_signal * rule.weight / total_exit_weight

            signals[current_date] = {
                'entry_signal': entry_signal,
                'exit_signal': exit_signal
            }

        return signals


class PositionSizer:
    """Calculates position sizes based on different methodologies."""

    @staticmethod
    def calculate_volatility_normalized_size(symbol: str, prices: pd.DataFrame,
                                           target_volatility: float = 0.15,
                                           lookback_days: int = 60) -> float:
        """Calculate position size based on volatility normalization."""
        try:
            symbol_prices = prices.xs(symbol, level=1, axis=1)['Close']
            returns = symbol_prices.pct_change().dropna()

            if len(returns) < lookback_days:
                return 0.1  # Default size if insufficient data

            recent_returns = returns.tail(lookback_days)
            volatility = recent_returns.std() * np.sqrt(252)  # Annualized volatility

            if volatility == 0:
                return 0.1

            # Position size = target_volatility / actual_volatility
            position_size = min(target_volatility / volatility, 0.25)  # Cap at 25%
            return max(position_size, 0.01)  # Minimum 1%

        except (KeyError, ValueError, ZeroDivisionError):
            return 0.1

    @staticmethod
    def calculate_kelly_criterion_size(symbol: str, prices: pd.DataFrame, signals: Dict,
                                     lookback_days: int = 252) -> float:
        """Calculate position size using Kelly Criterion."""
        try:
            symbol_prices = prices.xs(symbol, level=1, axis=1)['Close']
            returns = symbol_prices.pct_change().dropna()

            if len(returns) < lookback_days:
                return 0.1

            # Calculate win rate and average win/loss for signals
            wins = []
            losses = []

            for i in range(lookback_days, len(returns)):
                date = returns.index[i]
                if date in signals:
                    signal_strength = signals[date].get('entry_signal', 0)
                    if signal_strength > 0.5:  # Signal threshold
                        next_return = returns.iloc[i]
                        if next_return > 0:
                            wins.append(next_return)
                        else:
                            losses.append(abs(next_return))

            if not wins or not losses:
                return 0.1

            win_rate = len(wins) / (len(wins) + len(losses))
            avg_win = np.mean(wins)
            avg_loss = np.mean(losses)

            if avg_loss == 0:
                return 0.1

            # Kelly formula: f* = (bp - q) / b
            # where b = avg_win/avg_loss, p = win_rate, q = 1-win_rate
            b = avg_win / avg_loss
            kelly_fraction = (b * win_rate - (1 - win_rate)) / b

            # Apply Kelly constraint (max 25% of Kelly due to estimation error)
            kelly_size = max(0.01, min(kelly_fraction * 0.25, 0.15))
            return kelly_size

        except (KeyError, ValueError, ZeroDivisionError):
            return 0.1


class TransactionCostCalculator:
    """Calculates realistic transaction costs and slippage."""

    def __init__(self, cost_model: TransactionCosts):
        self.cost_model = cost_model

    def calculate_trade_costs(self, symbol: str, quantity: int, price: float,
                            market_volume: float, portfolio_value: float) -> Dict[str, float]:
        """Calculate comprehensive trade costs."""
        trade_value = abs(quantity * price)

        # Commission
        commission = (
            self.cost_model.commission_per_trade +
            trade_value * self.cost_model.commission_pct
        )

        # Slippage (based on trade size relative to average volume)
        slippage_rate = self.cost_model.slippage_bps / 10000.0
        slippage = trade_value * slippage_rate

        # Bid-ask spread
        spread_rate = self.cost_model.bid_ask_spread_bps / 10000.0
        spread_cost = trade_value * spread_rate

        # Market impact (non-linear with trade size)
        volume_participation = trade_value / (market_volume * price) if market_volume > 0 else 0
        market_impact_rate = self.cost_model.market_impact_coeff * np.sqrt(volume_participation)
        market_impact = trade_value * market_impact_rate

        return {
            'commission': commission,
            'slippage': slippage,
            'spread_cost': spread_cost,
            'market_impact': market_impact,
            'total_cost': commission + slippage + spread_cost + market_impact
        }


class PortfolioManager:
    """Manages portfolio state and executes trades."""

    def __init__(self, initial_capital: float, transaction_costs: TransactionCosts):
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.positions: Dict[str, Position] = {}
        self.trade_log: List[Trade] = []
        self.cost_calculator = TransactionCostCalculator(transaction_costs)

    def execute_trade(self, symbol: str, action: str, quantity: int, price: float,
                     timestamp: datetime, signal_strength: float,
                     market_volume: float = 1000000) -> Optional[Trade]:
        """Execute a trade and update portfolio state."""
        if quantity == 0:
            return None

        trade_value = quantity * price
        portfolio_value = self.get_portfolio_value(prices={symbol: price})

        # Calculate transaction costs
        costs = self.cost_calculator.calculate_trade_costs(
            symbol, quantity, price, market_volume, portfolio_value
        )

        # Adjust price for slippage
        adjusted_price = price
        if action == "BUY":
            adjusted_price += costs['slippage'] / quantity
        else:  # SELL
            adjusted_price -= costs['slippage'] / quantity

        adjusted_trade_value = quantity * adjusted_price
        total_cost = costs['total_cost']

        # Check if we have enough cash for buy orders
        if action == "BUY":
            required_cash = adjusted_trade_value + total_cost
            if required_cash > self.cash:
                # Adjust quantity to available cash
                available_cash = self.cash * 0.99  # Leave 1% buffer
                quantity = int(available_cash / (adjusted_price + total_cost / quantity))
                if quantity <= 0:
                    return None
                adjusted_trade_value = quantity * adjusted_price
                costs = self.cost_calculator.calculate_trade_costs(
                    symbol, quantity, adjusted_price, market_volume, portfolio_value
                )
                total_cost = costs['total_cost']

        # Create trade record
        trade = Trade(
            trade_id=str(uuid4()),
            symbol=symbol,
            action=action,
            quantity=quantity,
            price=adjusted_price,
            timestamp=timestamp,
            commission=costs['commission'],
            slippage=costs['slippage'],
            market_impact=costs['market_impact'],
            signal_strength=signal_strength,
            portfolio_weight=0.0  # Will be calculated later
        )

        # Update portfolio
        if action == "BUY":
            self.cash -= (adjusted_trade_value + total_cost)

            if symbol in self.positions:
                # Add to existing position
                existing_pos = self.positions[symbol]
                total_quantity = existing_pos.quantity + quantity
                total_cost_basis = (existing_pos.quantity * existing_pos.entry_price +
                                  adjusted_trade_value)
                new_entry_price = total_cost_basis / total_quantity

                self.positions[symbol] = Position(
                    symbol=symbol,
                    quantity=total_quantity,
                    entry_price=new_entry_price,
                    current_price=adjusted_price,
                    entry_date=existing_pos.entry_date,
                    market_value=total_quantity * adjusted_price,
                    unrealized_pnl=(adjusted_price - new_entry_price) * total_quantity,
                    unrealized_pnl_pct=(adjusted_price - new_entry_price) / new_entry_price,
                    portfolio_weight=0.0  # Will be updated
                )
            else:
                # New position
                self.positions[symbol] = Position(
                    symbol=symbol,
                    quantity=quantity,
                    entry_price=adjusted_price,
                    current_price=adjusted_price,
                    entry_date=timestamp.date(),
                    market_value=adjusted_trade_value,
                    unrealized_pnl=0.0,
                    unrealized_pnl_pct=0.0,
                    portfolio_weight=0.0  # Will be updated
                )

        else:  # SELL
            if symbol not in self.positions:
                return None

            existing_pos = self.positions[symbol]

            # Limit sell quantity to available shares
            quantity = min(quantity, existing_pos.quantity)
            if quantity <= 0:
                return None

            self.cash += (adjusted_trade_value - total_cost)

            # Calculate realized P&L
            realized_pnl = (adjusted_price - existing_pos.entry_price) * quantity
            trade.pnl = realized_pnl
            trade.return_pct = (adjusted_price - existing_pos.entry_price) / existing_pos.entry_price

            # Update or remove position
            if quantity == existing_pos.quantity:
                # Close entire position
                del self.positions[symbol]
            else:
                # Partial sale
                remaining_quantity = existing_pos.quantity - quantity
                self.positions[symbol] = Position(
                    symbol=symbol,
                    quantity=remaining_quantity,
                    entry_price=existing_pos.entry_price,
                    current_price=adjusted_price,
                    entry_date=existing_pos.entry_date,
                    market_value=remaining_quantity * adjusted_price,
                    unrealized_pnl=(adjusted_price - existing_pos.entry_price) * remaining_quantity,
                    unrealized_pnl_pct=(adjusted_price - existing_pos.entry_price) / existing_pos.entry_price,
                    portfolio_weight=0.0  # Will be updated
                )

        self.trade_log.append(trade)
        return trade

    def update_portfolio_values(self, current_prices: Dict[str, float]) -> None:
        """Update portfolio values with current market prices."""
        portfolio_value = self.get_portfolio_value(current_prices)

        for symbol, position in self.positions.items():
            if symbol in current_prices:
                current_price = current_prices[symbol]
                position.current_price = current_price
                position.market_value = position.quantity * current_price
                position.unrealized_pnl = (current_price - position.entry_price) * position.quantity
                position.unrealized_pnl_pct = ((current_price - position.entry_price) /
                                             position.entry_price)
                position.portfolio_weight = position.market_value / portfolio_value

    def get_portfolio_value(self, prices: Dict[str, float]) -> float:
        """Calculate total portfolio value."""
        total_value = self.cash

        for symbol, position in self.positions.items():
            if symbol in prices:
                total_value += position.quantity * prices[symbol]

        return total_value

    def get_portfolio_snapshot(self, date: date, prices: Dict[str, float],
                             prev_value: float = None) -> PortfolioSnapshot:
        """Create a portfolio snapshot for a specific date."""
        self.update_portfolio_values(prices)

        total_value = self.get_portfolio_value(prices)
        daily_return = (total_value - prev_value) if prev_value else 0.0
        daily_return_pct = (daily_return / prev_value) if prev_value and prev_value > 0 else 0.0

        return PortfolioSnapshot(
            date=date,
            total_value=total_value,
            cash=self.cash,
            positions=list(self.positions.values()),
            daily_return=daily_return,
            daily_return_pct=daily_return_pct,
            benchmark_return_pct=0.0,  # Will be set by caller
            num_positions=len(self.positions),
            gross_exposure=sum(abs(pos.market_value) for pos in self.positions.values()),
            net_exposure=sum(pos.market_value for pos in self.positions.values()),
            leverage=sum(abs(pos.market_value) for pos in self.positions.values()) / total_value
        )


class BacktestingEngine:
    """Main backtesting engine with walk-forward optimization."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def run_backtest(self, config: BacktestConfiguration,
                          market_data: MarketData) -> BacktestResult:
        """Run a complete backtest with optional walk-forward optimization."""
        start_time = datetime.utcnow()
        backtest_id = str(uuid4())

        self.logger.info(f"Starting backtest {backtest_id}")

        try:
            if config.enable_walk_forward:
                result = await self._run_walk_forward_backtest(config, market_data, backtest_id)
            else:
                result = await self._run_single_backtest(config, market_data, backtest_id)

            # Calculate execution time
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            result.execution_time_seconds = execution_time

            self.logger.info(f"Backtest {backtest_id} completed in {execution_time:.2f} seconds")
            return result

        except Exception as e:
            self.logger.error(f"Backtest {backtest_id} failed: {str(e)}")
            raise

    async def _run_single_backtest(self, config: BacktestConfiguration,
                                  market_data: MarketData, backtest_id: str) -> BacktestResult:
        """Run a single-period backtest."""
        # Initialize components
        signal_generator = SignalGenerator(config.strategy)
        portfolio = PortfolioManager(config.initial_capital, config.transaction_costs)

        # Calculate technical indicators
        indicators = signal_generator.calculate_technical_indicators(market_data.prices)

        # Get trading dates
        trading_dates = pd.date_range(config.start_date, config.end_date, freq='B')
        available_dates = market_data.prices.index.intersection(trading_dates)

        if len(available_dates) == 0:
            raise ValueError("No trading data available for the specified date range")

        equity_curve = []
        prev_portfolio_value = config.initial_capital

        # Execute strategy day by day
        for current_date in available_dates:
            current_prices = {}

            # Get current prices for all symbols
            for symbol in config.universe:
                try:
                    price = market_data.prices.loc[current_date, ('Close', symbol)]
                    if not pd.isna(price):
                        current_prices[symbol] = price
                except (KeyError, IndexError):
                    continue

            if not current_prices:
                continue

            # Generate signals for all symbols
            for symbol in current_prices.keys():
                signals = signal_generator.generate_signals(
                    indicators, symbol, [current_date.date()]
                )

                if current_date.date() not in signals:
                    continue

                signal_data = signals[current_date.date()]
                entry_signal = signal_data['entry_signal']
                exit_signal = signal_data['exit_signal']

                # Position sizing
                position_size = self._calculate_position_size(
                    config.strategy.position_sizing, symbol, market_data.prices,
                    signals, portfolio.get_portfolio_value(current_prices)
                )

                # Entry logic
                if (entry_signal >= config.strategy.entry_signal_threshold and
                    symbol not in portfolio.positions and
                    len(portfolio.positions) < config.strategy.max_positions):

                    target_value = portfolio.get_portfolio_value(current_prices) * position_size
                    quantity = int(target_value / current_prices[symbol])

                    if quantity > 0:
                        portfolio.execute_trade(
                            symbol=symbol,
                            action="BUY",
                            quantity=quantity,
                            price=current_prices[symbol],
                            timestamp=datetime.combine(current_date.date(), datetime.min.time()),
                            signal_strength=entry_signal
                        )

                # Exit logic
                elif (exit_signal >= config.strategy.exit_signal_threshold and
                      symbol in portfolio.positions):

                    position = portfolio.positions[symbol]
                    portfolio.execute_trade(
                        symbol=symbol,
                        action="SELL",
                        quantity=position.quantity,
                        price=current_prices[symbol],
                        timestamp=datetime.combine(current_date.date(), datetime.min.time()),
                        signal_strength=exit_signal
                    )

            # Create daily snapshot
            snapshot = portfolio.get_portfolio_snapshot(
                current_date.date(), current_prices, prev_portfolio_value
            )

            # Add benchmark return
            if current_date in market_data.benchmark.index:
                snapshot.benchmark_return_pct = market_data.benchmark.loc[current_date]

            equity_curve.append(snapshot)
            prev_portfolio_value = snapshot.total_value

        # Calculate performance metrics
        performance_metrics = self._calculate_performance_metrics(
            equity_curve, market_data.benchmark, market_data.risk_free_rate, config
        )

        # Create result
        return BacktestResult(
            backtest_id=backtest_id,
            configuration=config,
            performance_metrics=performance_metrics,
            equity_curve=equity_curve,
            trade_log=portfolio.trade_log,
            walk_forward_results=None,
            monthly_returns=self._calculate_monthly_returns(equity_curve),
            rolling_sharpe=self._calculate_rolling_sharpe(equity_curve),
            rolling_volatility=self._calculate_rolling_volatility(equity_curve),
            sector_performance={},  # TODO: Implement sector analysis
            top_winners=sorted(
                [t for t in portfolio.trade_log if t.pnl and t.pnl > 0],
                key=lambda x: x.pnl, reverse=True
            )[:10],
            top_losers=sorted(
                [t for t in portfolio.trade_log if t.pnl and t.pnl < 0],
                key=lambda x: x.pnl
            )[:10],
            total_data_points=len(equity_curve),
            cache_hit_rate=1.0,  # TODO: Implement cache tracking
            data_quality_score=1.0  # TODO: Implement data quality assessment
        )

    async def _run_walk_forward_backtest(self, config: BacktestConfiguration,
                                       market_data: MarketData, backtest_id: str) -> BacktestResult:
        """Run walk-forward optimization backtest."""
        # TODO: Implement walk-forward optimization
        # For now, run single backtest
        return await self._run_single_backtest(config, market_data, backtest_id)

    def _calculate_position_size(self, method: PositionSizingMethod, symbol: str,
                               prices: pd.DataFrame, signals: Dict,
                               portfolio_value: float) -> float:
        """Calculate position size based on specified method."""
        if method == PositionSizingMethod.EQUAL_WEIGHT:
            return 0.1  # 10% per position

        elif method == PositionSizingMethod.VOLATILITY_NORMALIZED:
            return PositionSizer.calculate_volatility_normalized_size(symbol, prices)

        elif method == PositionSizingMethod.KELLY_CRITERION:
            return PositionSizer.calculate_kelly_criterion_size(symbol, prices, signals)

        elif method == PositionSizingMethod.FIXED_DOLLAR:
            fixed_amount = 10000  # $10k per position
            return min(fixed_amount / portfolio_value, 0.2)

        elif method == PositionSizingMethod.RISK_PARITY:
            return 0.05  # 5% per position (conservative)

        return 0.1  # Default

    def _calculate_performance_metrics(self, equity_curve: List[PortfolioSnapshot],
                                     benchmark: pd.Series, risk_free_rate: pd.Series,
                                     config: BacktestConfiguration) -> PerformanceMetrics:
        """Calculate comprehensive performance metrics."""
        if not equity_curve:
            raise ValueError("Empty equity curve")

        # Extract returns
        portfolio_values = [snapshot.total_value for snapshot in equity_curve]
        dates = [snapshot.date for snapshot in equity_curve]

        if len(portfolio_values) < 2:
            raise ValueError("Insufficient data for performance calculation")

        # Calculate returns
        returns = np.array([
            (portfolio_values[i] - portfolio_values[i-1]) / portfolio_values[i-1]
            for i in range(1, len(portfolio_values))
        ])

        # Basic return metrics
        total_return = (portfolio_values[-1] - portfolio_values[0]) / portfolio_values[0]
        trading_days = len(returns)
        annualized_return = (1 + total_return) ** (252 / trading_days) - 1
        cagr = annualized_return

        # Risk metrics
        volatility = np.std(returns) * np.sqrt(252)
        downside_returns = returns[returns < 0]
        downside_volatility = np.std(downside_returns) * np.sqrt(252) if len(downside_returns) > 0 else 0

        # Risk-adjusted returns
        avg_risk_free_rate = 0.02  # Default 2% if not available
        if len(risk_free_rate) > 0:
            avg_risk_free_rate = risk_free_rate.mean()

        sharpe_ratio = (annualized_return - avg_risk_free_rate) / volatility if volatility > 0 else 0
        sortino_ratio = (annualized_return - avg_risk_free_rate) / downside_volatility if downside_volatility > 0 else 0

        # Drawdown analysis
        peak = np.maximum.accumulate(portfolio_values)
        drawdown = (np.array(portfolio_values) - peak) / peak
        max_drawdown = np.min(drawdown)
        current_drawdown = drawdown[-1]

        # Max drawdown duration
        max_dd_duration = 0
        current_dd_duration = 0
        for dd in drawdown:
            if dd < 0:
                current_dd_duration += 1
                max_dd_duration = max(max_dd_duration, current_dd_duration)
            else:
                current_dd_duration = 0

        # Calmar ratio
        calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0

        # Distribution metrics
        skewness = self._calculate_skewness(returns)
        kurtosis = self._calculate_kurtosis(returns)
        var_95 = np.percentile(returns, 5)
        cvar_95 = np.mean(returns[returns <= var_95]) if len(returns[returns <= var_95]) > 0 else var_95

        # Benchmark comparison
        benchmark_return = 0.1  # Default 10% if not available
        alpha = annualized_return - benchmark_return
        beta = 1.0  # Default beta
        information_ratio = alpha / volatility if volatility > 0 else 0
        tracking_error = volatility

        # Trade statistics (placeholder - would be calculated from actual trades)
        total_trades = len([t for t in equity_curve if hasattr(t, 'trades')])
        winning_trades = 0
        losing_trades = 0
        win_rate = 0.5
        avg_win = 0.02
        avg_loss = -0.015
        profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else 1.0

        return PerformanceMetrics(
            total_return=total_return,
            total_return_pct=total_return * 100,
            annualized_return=annualized_return,
            cagr=cagr,
            volatility=volatility,
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sortino_ratio,
            calmar_ratio=calmar_ratio,
            max_drawdown=max_drawdown,
            max_drawdown_duration=max_dd_duration,
            current_drawdown=current_drawdown,
            skewness=skewness,
            kurtosis=kurtosis,
            var_95=var_95,
            cvar_95=cvar_95,
            benchmark_return=benchmark_return,
            alpha=alpha,
            beta=beta,
            information_ratio=information_ratio,
            tracking_error=tracking_error,
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            avg_win=avg_win,
            avg_loss=avg_loss,
            profit_factor=profit_factor,
            max_leverage=max(snapshot.leverage for snapshot in equity_curve),
            avg_leverage=np.mean([snapshot.leverage for snapshot in equity_curve]),
            start_date=dates[0],
            end_date=dates[-1],
            trading_days=trading_days
        )

    def _calculate_monthly_returns(self, equity_curve: List[PortfolioSnapshot]) -> List[float]:
        """Calculate monthly returns from equity curve."""
        monthly_returns = []

        # Group by month and calculate returns
        df = pd.DataFrame([
            {'date': snapshot.date, 'value': snapshot.total_value}
            for snapshot in equity_curve
        ])
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)

        monthly_values = df.resample('M').last()
        for i in range(1, len(monthly_values)):
            monthly_return = (monthly_values.iloc[i]['value'] - monthly_values.iloc[i-1]['value']) / monthly_values.iloc[i-1]['value']
            monthly_returns.append(monthly_return)

        return monthly_returns

    def _calculate_rolling_sharpe(self, equity_curve: List[PortfolioSnapshot],
                                window: int = 252) -> List[float]:
        """Calculate rolling Sharpe ratio."""
        values = [snapshot.total_value for snapshot in equity_curve]
        returns = np.array([
            (values[i] - values[i-1]) / values[i-1]
            for i in range(1, len(values))
        ])

        rolling_sharpe = []
        for i in range(window, len(returns)):
            window_returns = returns[i-window:i]
            window_mean = np.mean(window_returns)
            window_std = np.std(window_returns)

            if window_std > 0:
                sharpe = (window_mean * 252 - 0.02) / (window_std * np.sqrt(252))  # Assume 2% risk-free rate
            else:
                sharpe = 0.0

            rolling_sharpe.append(sharpe)

        return rolling_sharpe

    def _calculate_rolling_volatility(self, equity_curve: List[PortfolioSnapshot],
                                    window: int = 252) -> List[float]:
        """Calculate rolling volatility."""
        values = [snapshot.total_value for snapshot in equity_curve]
        returns = np.array([
            (values[i] - values[i-1]) / values[i-1]
            for i in range(1, len(values))
        ])

        rolling_vol = []
        for i in range(window, len(returns)):
            window_returns = returns[i-window:i]
            vol = np.std(window_returns) * np.sqrt(252)
            rolling_vol.append(vol)

        return rolling_vol

    @staticmethod
    def _calculate_skewness(returns: np.ndarray) -> float:
        """Calculate return skewness."""
        if len(returns) < 3:
            return 0.0

        mean_return = np.mean(returns)
        std_return = np.std(returns)

        if std_return == 0:
            return 0.0

        skewness = np.mean(((returns - mean_return) / std_return) ** 3)
        return skewness

    @staticmethod
    def _calculate_kurtosis(returns: np.ndarray) -> float:
        """Calculate return kurtosis."""
        if len(returns) < 4:
            return 0.0

        mean_return = np.mean(returns)
        std_return = np.std(returns)

        if std_return == 0:
            return 0.0

        kurtosis = np.mean(((returns - mean_return) / std_return) ** 4) - 3  # Excess kurtosis
        return kurtosis