"""
Stop-Loss and Take-Profit Manager

Advanced order management system for risk control including trailing stops,
dynamic stop-loss adjustment, and intelligent take-profit strategies.
"""

import asyncio
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
import logging
import uuid

from ..models.risk_models import (
    Position, Portfolio, StopLossOrder, TakeProfitOrder,
    OrderType, PositionType, RiskAlert, AlertSeverity
)
from ..services.stock_service import StockService

logger = logging.getLogger(__name__)


class StopLossManager:
    """
    Comprehensive stop-loss and take-profit management system
    """

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service

        # Configuration
        self.min_stop_distance_percent = Decimal(0.5)  # Minimum 0.5% stop distance
        self.max_stop_distance_percent = Decimal(20)   # Maximum 20% stop distance
        self.trailing_stop_buffer = Decimal(0.1)       # 0.1% buffer for trailing stops
        self.atr_multiplier = Decimal(2.0)             # ATR multiplier for dynamic stops

        # Active orders tracking
        self.active_stop_orders: Dict[str, StopLossOrder] = {}
        self.active_take_profit_orders: Dict[str, TakeProfitOrder] = {}

        # Background monitoring
        self._monitoring_active = False
        self._monitoring_task: Optional[asyncio.Task] = None

    async def create_stop_loss_order(
        self,
        position: Position,
        stop_type: str = "fixed",
        stop_price: Optional[Decimal] = None,
        stop_percent: Optional[Decimal] = None,
        trailing_percent: Optional[Decimal] = None,
        atr_based: bool = False
    ) -> StopLossOrder:
        """
        Create a stop-loss order with various strategies
        """
        try:
            # Validate position
            if position.quantity <= 0:
                raise ValueError("Position quantity must be positive")

            # Calculate stop price based on strategy
            if stop_price is None:
                stop_price = await self._calculate_stop_price(
                    position, stop_type, stop_percent, trailing_percent, atr_based
                )

            # Validate stop price
            self._validate_stop_price(position, stop_price)

            # Create stop-loss order
            order = StopLossOrder(
                symbol=position.symbol,
                position_id=position.position_id,
                stop_price=stop_price,
                trailing_percent=trailing_percent,
                quantity=position.quantity,
                order_type=OrderType.STOP_LOSS if not trailing_percent else OrderType.TRAILING_STOP,
                loss_amount=self._calculate_loss_amount(position, stop_price),
                loss_percent=self._calculate_loss_percent(position, stop_price),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )

            # Store active order
            self.active_stop_orders[position.position_id] = order

            logger.info(f"Created stop-loss order for {position.symbol} at {stop_price}")
            return order

        except Exception as e:
            logger.error(f"Error creating stop-loss order for {position.symbol}: {e}")
            raise

    async def create_take_profit_order(
        self,
        position: Position,
        target_price: Optional[Decimal] = None,
        profit_percent: Optional[Decimal] = None,
        risk_reward_ratio: Optional[Decimal] = None,
        scaling_levels: Optional[List[Dict[str, Decimal]]] = None
    ) -> TakeProfitOrder:
        """
        Create a take-profit order with various strategies
        """
        try:
            # Calculate target price if not provided
            if target_price is None:
                target_price = await self._calculate_target_price(
                    position, profit_percent, risk_reward_ratio
                )

            # Validate target price
            self._validate_target_price(position, target_price)

            # Determine quantity (full position unless scaling)
            quantity = position.quantity
            partial_exit = False

            if scaling_levels:
                # Use first level for initial order
                first_level = scaling_levels[0]
                quantity = first_level.get("quantity", position.quantity)
                partial_exit = True

            # Create take-profit order
            order = TakeProfitOrder(
                symbol=position.symbol,
                position_id=position.position_id,
                target_price=target_price,
                quantity=quantity,
                partial_exit=partial_exit,
                scale_out_levels=scaling_levels,
                profit_amount=self._calculate_profit_amount(position, target_price, quantity),
                profit_percent=self._calculate_profit_percent(position, target_price),
                risk_reward_ratio=self._calculate_risk_reward_ratio(position, target_price),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )

            # Store active order
            self.active_take_profit_orders[position.position_id] = order

            logger.info(f"Created take-profit order for {position.symbol} at {target_price}")
            return order

        except Exception as e:
            logger.error(f"Error creating take-profit order for {position.symbol}: {e}")
            raise

    async def update_trailing_stop(
        self,
        position_id: str,
        current_price: Decimal
    ) -> Optional[StopLossOrder]:
        """
        Update trailing stop-loss based on current price
        """
        try:
            if position_id not in self.active_stop_orders:
                return None

            order = self.active_stop_orders[position_id]

            if order.order_type != OrderType.TRAILING_STOP or not order.trailing_percent:
                return order

            # Calculate new trailing stop price
            trailing_distance = current_price * (order.trailing_percent / 100)
            new_stop_price = current_price - trailing_distance

            # Only update if new stop is higher (for long positions)
            if new_stop_price > order.stop_price:
                order.stop_price = new_stop_price
                order.updated_at = datetime.utcnow()

                logger.info(f"Updated trailing stop for {order.symbol} to {new_stop_price}")

            return order

        except Exception as e:
            logger.error(f"Error updating trailing stop for position {position_id}: {e}")
            return None

    async def check_stop_triggers(
        self,
        positions: List[Position]
    ) -> List[Tuple[Position, StopLossOrder]]:
        """
        Check if any stop-loss orders should be triggered
        """
        try:
            triggered_orders = []

            for position in positions:
                if position.position_id not in self.active_stop_orders:
                    continue

                order = self.active_stop_orders[position.position_id]

                if order.triggered:
                    continue

                # Check if stop should be triggered
                should_trigger = False

                if position.position_type == PositionType.LONG:
                    should_trigger = position.current_price <= order.stop_price
                elif position.position_type == PositionType.SHORT:
                    should_trigger = position.current_price >= order.stop_price

                if should_trigger:
                    order.triggered = True
                    order.triggered_at = datetime.utcnow()
                    triggered_orders.append((position, order))

                    logger.warning(f"Stop-loss triggered for {position.symbol} at {position.current_price}")

            return triggered_orders

        except Exception as e:
            logger.error(f"Error checking stop triggers: {e}")
            return []

    async def check_take_profit_triggers(
        self,
        positions: List[Position]
    ) -> List[Tuple[Position, TakeProfitOrder]]:
        """
        Check if any take-profit orders should be triggered
        """
        try:
            triggered_orders = []

            for position in positions:
                if position.position_id not in self.active_take_profit_orders:
                    continue

                order = self.active_take_profit_orders[position.position_id]

                if order.triggered:
                    continue

                # Check if take-profit should be triggered
                should_trigger = False

                if position.position_type == PositionType.LONG:
                    should_trigger = position.current_price >= order.target_price
                elif position.position_type == PositionType.SHORT:
                    should_trigger = position.current_price <= order.target_price

                if should_trigger:
                    order.triggered = True
                    order.triggered_at = datetime.utcnow()
                    triggered_orders.append((position, order))

                    logger.info(f"Take-profit triggered for {position.symbol} at {position.current_price}")

            return triggered_orders

        except Exception as e:
            logger.error(f"Error checking take-profit triggers: {e}")
            return []

    async def calculate_optimal_stop_loss(
        self,
        position: Position,
        method: str = "atr",
        risk_tolerance: Decimal = Decimal(2)
    ) -> Decimal:
        """
        Calculate optimal stop-loss price using various methods
        """
        try:
            if method == "atr":
                return await self._calculate_atr_stop(position, risk_tolerance)
            elif method == "support_resistance":
                return await self._calculate_support_resistance_stop(position)
            elif method == "volatility":
                return await self._calculate_volatility_stop(position, risk_tolerance)
            elif method == "percentage":
                return await self._calculate_percentage_stop(position, risk_tolerance)
            else:
                # Default to ATR method
                return await self._calculate_atr_stop(position, risk_tolerance)

        except Exception as e:
            logger.error(f"Error calculating optimal stop-loss for {position.symbol}: {e}")
            # Fallback to simple percentage
            return position.current_price * (1 - risk_tolerance / 100)

    async def calculate_optimal_take_profit(
        self,
        position: Position,
        method: str = "risk_reward",
        target_ratio: Decimal = Decimal(2)
    ) -> Decimal:
        """
        Calculate optimal take-profit price using various methods
        """
        try:
            if method == "risk_reward":
                return await self._calculate_risk_reward_target(position, target_ratio)
            elif method == "resistance":
                return await self._calculate_resistance_target(position)
            elif method == "volatility":
                return await self._calculate_volatility_target(position, target_ratio)
            elif method == "fibonacci":
                return await self._calculate_fibonacci_target(position)
            else:
                # Default to risk/reward method
                return await self._calculate_risk_reward_target(position, target_ratio)

        except Exception as e:
            logger.error(f"Error calculating optimal take-profit for {position.symbol}: {e}")
            # Fallback to simple target
            return position.current_price * (1 + target_ratio / 100)

    async def create_bracket_order(
        self,
        position: Position,
        stop_loss_percent: Decimal,
        take_profit_percent: Decimal,
        trailing_stop: bool = False
    ) -> Tuple[StopLossOrder, TakeProfitOrder]:
        """
        Create both stop-loss and take-profit orders as a bracket
        """
        try:
            # Create stop-loss order
            stop_order = await self.create_stop_loss_order(
                position=position,
                stop_type="trailing" if trailing_stop else "fixed",
                stop_percent=stop_loss_percent,
                trailing_percent=stop_loss_percent if trailing_stop else None
            )

            # Create take-profit order
            take_profit_order = await self.create_take_profit_order(
                position=position,
                profit_percent=take_profit_percent
            )

            logger.info(f"Created bracket order for {position.symbol}")
            return stop_order, take_profit_order

        except Exception as e:
            logger.error(f"Error creating bracket order for {position.symbol}: {e}")
            raise

    async def start_monitoring(self, check_interval: int = 30):
        """
        Start background monitoring of stop-loss and take-profit orders
        """
        try:
            if self._monitoring_active:
                logger.warning("Monitoring already active")
                return

            self._monitoring_active = True
            self._monitoring_task = asyncio.create_task(
                self._monitoring_loop(check_interval)
            )

            logger.info("Started stop-loss monitoring")

        except Exception as e:
            logger.error(f"Error starting monitoring: {e}")

    async def stop_monitoring(self):
        """
        Stop background monitoring
        """
        try:
            self._monitoring_active = False

            if self._monitoring_task:
                self._monitoring_task.cancel()
                try:
                    await self._monitoring_task
                except asyncio.CancelledError:
                    pass

            logger.info("Stopped stop-loss monitoring")

        except Exception as e:
            logger.error(f"Error stopping monitoring: {e}")

    # Private helper methods

    async def _calculate_stop_price(
        self,
        position: Position,
        stop_type: str,
        stop_percent: Optional[Decimal],
        trailing_percent: Optional[Decimal],
        atr_based: bool
    ) -> Decimal:
        """Calculate stop price based on strategy"""
        try:
            current_price = position.current_price

            if atr_based:
                return await self._calculate_atr_stop(position, self.atr_multiplier)

            elif stop_percent:
                if position.position_type == PositionType.LONG:
                    return current_price * (1 - stop_percent / 100)
                else:  # SHORT
                    return current_price * (1 + stop_percent / 100)

            elif trailing_percent:
                if position.position_type == PositionType.LONG:
                    return current_price * (1 - trailing_percent / 100)
                else:  # SHORT
                    return current_price * (1 + trailing_percent / 100)

            else:
                # Default to 5% stop
                default_percent = Decimal(5)
                if position.position_type == PositionType.LONG:
                    return current_price * (1 - default_percent / 100)
                else:  # SHORT
                    return current_price * (1 + default_percent / 100)

        except Exception as e:
            logger.error(f"Error calculating stop price: {e}")
            raise

    async def _calculate_target_price(
        self,
        position: Position,
        profit_percent: Optional[Decimal],
        risk_reward_ratio: Optional[Decimal]
    ) -> Decimal:
        """Calculate target price based on strategy"""
        try:
            current_price = position.current_price

            if profit_percent:
                if position.position_type == PositionType.LONG:
                    return current_price * (1 + profit_percent / 100)
                else:  # SHORT
                    return current_price * (1 - profit_percent / 100)

            elif risk_reward_ratio and position.stop_loss:
                # Calculate based on risk/reward ratio
                risk_amount = abs(current_price - position.stop_loss)
                reward_amount = risk_amount * risk_reward_ratio

                if position.position_type == PositionType.LONG:
                    return current_price + reward_amount
                else:  # SHORT
                    return current_price - reward_amount

            else:
                # Default to 10% profit target
                default_percent = Decimal(10)
                if position.position_type == PositionType.LONG:
                    return current_price * (1 + default_percent / 100)
                else:  # SHORT
                    return current_price * (1 - default_percent / 100)

        except Exception as e:
            logger.error(f"Error calculating target price: {e}")
            raise

    async def _calculate_atr_stop(self, position: Position, multiplier: Decimal) -> Decimal:
        """Calculate ATR-based stop-loss"""
        try:
            # Get technical indicators including ATR
            technical_data = await self.stock_service.get_technical_indicators(position.symbol)

            if technical_data and 'atr' in technical_data:
                atr = Decimal(str(technical_data['atr']))

                if position.position_type == PositionType.LONG:
                    return position.current_price - (atr * multiplier)
                else:  # SHORT
                    return position.current_price + (atr * multiplier)
            else:
                # Fallback to percentage-based stop
                fallback_percent = Decimal(3)
                if position.position_type == PositionType.LONG:
                    return position.current_price * (1 - fallback_percent / 100)
                else:
                    return position.current_price * (1 + fallback_percent / 100)

        except Exception as e:
            logger.error(f"Error calculating ATR stop: {e}")
            # Fallback
            return position.current_price * Decimal(0.95)

    async def _calculate_support_resistance_stop(self, position: Position) -> Decimal:
        """Calculate stop based on support/resistance levels"""
        try:
            # This would require technical analysis for support/resistance
            # Simplified implementation using recent lows/highs

            end_date = datetime.now()
            start_date = end_date - timedelta(days=20)

            price_history = await self.stock_service.get_price_history(
                position.symbol, start_date, end_date, "1d"
            )

            if not price_history or len(price_history) < 10:
                # Fallback to percentage
                return position.current_price * Decimal(0.95)

            # Find recent support (lowest low in period)
            lows = [Decimal(str(day['low'])) for day in price_history]
            recent_support = min(lows)

            # Set stop slightly below support
            buffer = recent_support * Decimal(0.02)  # 2% buffer
            return recent_support - buffer

        except Exception as e:
            logger.error(f"Error calculating support/resistance stop: {e}")
            return position.current_price * Decimal(0.95)

    async def _calculate_volatility_stop(self, position: Position, multiplier: Decimal) -> Decimal:
        """Calculate volatility-based stop-loss"""
        try:
            # Get recent volatility
            end_date = datetime.now()
            start_date = end_date - timedelta(days=20)

            price_history = await self.stock_service.get_price_history(
                position.symbol, start_date, end_date, "1d"
            )

            if not price_history or len(price_history) < 10:
                return position.current_price * Decimal(0.95)

            # Calculate daily returns and volatility
            prices = [float(day['close']) for day in price_history]
            returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
            volatility = Decimal(str(np.std(returns)))

            # Set stop based on volatility
            stop_distance = position.current_price * volatility * multiplier

            if position.position_type == PositionType.LONG:
                return position.current_price - stop_distance
            else:
                return position.current_price + stop_distance

        except Exception as e:
            logger.error(f"Error calculating volatility stop: {e}")
            return position.current_price * Decimal(0.95)

    async def _calculate_percentage_stop(self, position: Position, percentage: Decimal) -> Decimal:
        """Calculate simple percentage-based stop"""
        if position.position_type == PositionType.LONG:
            return position.current_price * (1 - percentage / 100)
        else:
            return position.current_price * (1 + percentage / 100)

    async def _calculate_risk_reward_target(self, position: Position, ratio: Decimal) -> Decimal:
        """Calculate target based on risk/reward ratio"""
        if not position.stop_loss:
            # Use default risk amount
            risk_amount = position.current_price * Decimal(0.05)  # 5% risk
        else:
            risk_amount = abs(position.current_price - position.stop_loss)

        reward_amount = risk_amount * ratio

        if position.position_type == PositionType.LONG:
            return position.current_price + reward_amount
        else:
            return position.current_price - reward_amount

    async def _calculate_resistance_target(self, position: Position) -> Decimal:
        """Calculate target based on resistance levels"""
        try:
            # Get recent price history
            end_date = datetime.now()
            start_date = end_date - timedelta(days=20)

            price_history = await self.stock_service.get_price_history(
                position.symbol, start_date, end_date, "1d"
            )

            if not price_history or len(price_history) < 10:
                return position.current_price * Decimal(1.10)

            # Find recent resistance (highest high)
            highs = [Decimal(str(day['high'])) for day in price_history]
            recent_resistance = max(highs)

            return recent_resistance

        except Exception as e:
            logger.error(f"Error calculating resistance target: {e}")
            return position.current_price * Decimal(1.10)

    async def _calculate_volatility_target(self, position: Position, multiplier: Decimal) -> Decimal:
        """Calculate target based on volatility"""
        try:
            # Similar to volatility stop but in opposite direction
            end_date = datetime.now()
            start_date = end_date - timedelta(days=20)

            price_history = await self.stock_service.get_price_history(
                position.symbol, start_date, end_date, "1d"
            )

            if not price_history or len(price_history) < 10:
                return position.current_price * Decimal(1.10)

            prices = [float(day['close']) for day in price_history]
            returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
            volatility = Decimal(str(np.std(returns)))

            target_distance = position.current_price * volatility * multiplier

            if position.position_type == PositionType.LONG:
                return position.current_price + target_distance
            else:
                return position.current_price - target_distance

        except Exception as e:
            logger.error(f"Error calculating volatility target: {e}")
            return position.current_price * Decimal(1.10)

    async def _calculate_fibonacci_target(self, position: Position) -> Decimal:
        """Calculate target using Fibonacci retracement levels"""
        try:
            # Simplified Fibonacci target calculation
            # In practice, this would use swing highs/lows

            # Use 61.8% extension as target (common Fibonacci level)
            if not position.stop_loss:
                risk_amount = position.current_price * Decimal(0.05)
            else:
                risk_amount = abs(position.current_price - position.stop_loss)

            # 61.8% Fibonacci extension
            fibonacci_extension = risk_amount * Decimal(1.618)

            if position.position_type == PositionType.LONG:
                return position.current_price + fibonacci_extension
            else:
                return position.current_price - fibonacci_extension

        except Exception as e:
            logger.error(f"Error calculating Fibonacci target: {e}")
            return position.current_price * Decimal(1.10)

    def _validate_stop_price(self, position: Position, stop_price: Decimal):
        """Validate stop price is reasonable"""
        current_price = position.current_price
        distance_percent = abs(current_price - stop_price) / current_price * 100

        if distance_percent < self.min_stop_distance_percent:
            raise ValueError(f"Stop price too close to current price ({distance_percent:.2f}%)")

        if distance_percent > self.max_stop_distance_percent:
            raise ValueError(f"Stop price too far from current price ({distance_percent:.2f}%)")

    def _validate_target_price(self, position: Position, target_price: Decimal):
        """Validate target price is reasonable"""
        current_price = position.current_price

        if position.position_type == PositionType.LONG and target_price <= current_price:
            raise ValueError("Target price must be above current price for long positions")

        if position.position_type == PositionType.SHORT and target_price >= current_price:
            raise ValueError("Target price must be below current price for short positions")

    def _calculate_loss_amount(self, position: Position, stop_price: Decimal) -> Decimal:
        """Calculate expected loss amount"""
        price_diff = abs(position.current_price - stop_price)
        return price_diff * position.quantity

    def _calculate_loss_percent(self, position: Position, stop_price: Decimal) -> Decimal:
        """Calculate expected loss percentage"""
        return abs(position.current_price - stop_price) / position.current_price * 100

    def _calculate_profit_amount(self, position: Position, target_price: Decimal, quantity: Decimal) -> Decimal:
        """Calculate expected profit amount"""
        price_diff = abs(target_price - position.current_price)
        return price_diff * quantity

    def _calculate_profit_percent(self, position: Position, target_price: Decimal) -> Decimal:
        """Calculate expected profit percentage"""
        return abs(target_price - position.current_price) / position.current_price * 100

    def _calculate_risk_reward_ratio(self, position: Position, target_price: Decimal) -> Decimal:
        """Calculate risk/reward ratio"""
        if not position.stop_loss:
            return Decimal(0)

        risk = abs(position.current_price - position.stop_loss)
        reward = abs(target_price - position.current_price)

        if risk == 0:
            return Decimal(0)

        return reward / risk

    async def _monitoring_loop(self, check_interval: int):
        """Background monitoring loop"""
        try:
            while self._monitoring_active:
                # This would integrate with a position management system
                # For now, it's a placeholder
                await asyncio.sleep(check_interval)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}")


# Global stop-loss manager instance
_stop_loss_manager: Optional[StopLossManager] = None


def get_stop_loss_manager() -> StopLossManager:
    """Get the global stop-loss manager"""
    global _stop_loss_manager
    if _stop_loss_manager is None:
        from ..services.stock_service import get_stock_service
        _stop_loss_manager = StopLossManager(get_stock_service())
    return _stop_loss_manager