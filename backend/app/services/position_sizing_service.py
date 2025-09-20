"""
Position Sizing Service

Advanced position sizing calculations using multiple methodologies including
fixed risk, Kelly Criterion, volatility-adjusted sizing, and modern portfolio theory.
"""

import asyncio
import math
from typing import Optional, List, Dict, Any, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
import logging
import numpy as np
from scipy import stats

from ..models.risk_models import (
    PositionSizingRequest, PositionSizingResult, Portfolio, Position,
    RiskProfile, RiskProfileConfig
)
from ..services.stock_service import StockService

logger = logging.getLogger(__name__)


class PositionSizingService:
    """
    Comprehensive position sizing service with multiple calculation methods
    """

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service

        # Configuration
        self.min_position_value = Decimal(100)  # Minimum position value
        self.max_position_percent = Decimal(25)  # Maximum position as % of account
        self.default_win_rate = Decimal(0.6)  # Default win rate for Kelly
        self.volatility_lookback_days = 30  # Days for volatility calculation

    async def calculate_position_size(self, request: PositionSizingRequest) -> PositionSizingResult:
        """
        Calculate optimal position size using specified methodology
        """
        try:
            # Validate request
            self._validate_request(request)

            # Get asset volatility if needed
            asset_volatility = None
            if request.adjust_for_volatility or request.current_volatility is None:
                try:
                    asset_volatility = await self._get_asset_volatility(request.symbol)
                    if request.current_volatility is None:
                        request.current_volatility = asset_volatility
                except Exception as e:
                    logger.warning(f"Could not get volatility for {request.symbol}: {e}")
                    asset_volatility = Decimal(0.20)  # Default 20% annual volatility

            # Calculate basic position size using fixed risk method
            basic_size = self._calculate_fixed_risk_size(request)

            # Apply Kelly Criterion if requested and parameters available
            kelly_size = None
            kelly_fraction = None
            if request.use_kelly_criterion and self._has_kelly_parameters(request):
                kelly_fraction = self._calculate_kelly_fraction(request)
                kelly_size = self._apply_kelly_criterion(request, kelly_fraction)

            # Apply volatility adjustment
            volatility_adjusted_size = basic_size
            if request.adjust_for_volatility and asset_volatility:
                volatility_adjusted_size = self._apply_volatility_adjustment(
                    basic_size, asset_volatility, request
                )

            # Choose final size
            final_size = kelly_size if kelly_size else volatility_adjusted_size

            # Apply position and risk limits
            final_size, warnings, adjustments = self._apply_limits_and_validations(
                final_size, request
            )

            # Calculate risk metrics
            position_value = final_size * request.entry_price
            risk_per_share = abs(request.entry_price - request.stop_loss_price)
            risk_amount = final_size * risk_per_share
            risk_percent = (risk_amount / request.account_balance) * 100

            # Calculate potential profit and risk/reward ratio
            potential_profit = None
            risk_reward_ratio = None
            if request.take_profit_price:
                profit_per_share = abs(request.take_profit_price - request.entry_price)
                potential_profit = final_size * profit_per_share
                if risk_amount > 0:
                    risk_reward_ratio = potential_profit / risk_amount

            # Create result
            result = PositionSizingResult(
                symbol=request.symbol,
                recommended_shares=int(final_size),
                position_value=position_value,
                position_percent=(position_value / request.account_balance) * 100,
                risk_amount=risk_amount,
                risk_percent=risk_percent,
                risk_per_share=risk_per_share,
                potential_profit=potential_profit,
                risk_reward_ratio=risk_reward_ratio,
                kelly_fraction=kelly_fraction,
                kelly_adjusted_size=int(kelly_size) if kelly_size else None,
                warnings=warnings,
                adjustments_made=adjustments
            )

            return result

        except Exception as e:
            logger.error(f"Error calculating position size for {request.symbol}: {e}")
            raise

    async def calculate_portfolio_position_size(
        self,
        request: PositionSizingRequest,
        portfolio: Portfolio,
        target_correlation: Optional[Decimal] = None
    ) -> PositionSizingResult:
        """
        Calculate position size considering existing portfolio composition
        """
        try:
            # Get basic position size
            basic_result = await self.calculate_position_size(request)

            # Adjust for portfolio correlation if existing positions
            if portfolio.positions and target_correlation is not None:
                correlation_adjustment = await self._calculate_correlation_adjustment(
                    request.symbol, portfolio, target_correlation
                )
                adjusted_shares = int(basic_result.recommended_shares * correlation_adjustment)

                # Update result
                basic_result.recommended_shares = adjusted_shares
                basic_result.position_value = adjusted_shares * request.entry_price
                basic_result.position_percent = (basic_result.position_value / request.account_balance) * 100
                basic_result.adjustments_made.append(f"Correlation adjustment: {correlation_adjustment:.2f}")

            # Check portfolio concentration limits
            concentration_adjustment = self._check_portfolio_concentration(
                basic_result, portfolio
            )

            if concentration_adjustment < 1:
                basic_result.recommended_shares = int(basic_result.recommended_shares * concentration_adjustment)
                basic_result.position_value = basic_result.recommended_shares * request.entry_price
                basic_result.position_percent = (basic_result.position_value / request.account_balance) * 100
                basic_result.adjustments_made.append(f"Concentration limit adjustment: {concentration_adjustment:.2f}")

            return basic_result

        except Exception as e:
            logger.error(f"Error calculating portfolio position size: {e}")
            raise

    def _validate_request(self, request: PositionSizingRequest):
        """Validate position sizing request"""
        if request.account_balance <= 0:
            raise ValueError("Account balance must be positive")

        if request.risk_per_trade <= 0 or request.risk_per_trade > 50:
            raise ValueError("Risk per trade must be between 0 and 50%")

        if request.entry_price <= 0:
            raise ValueError("Entry price must be positive")

        if request.stop_loss_price <= 0:
            raise ValueError("Stop loss price must be positive")

        if request.entry_price == request.stop_loss_price:
            raise ValueError("Entry price and stop loss cannot be equal")

        if request.max_position_percent <= 0 or request.max_position_percent > 100:
            raise ValueError("Max position percent must be between 0 and 100%")

    def _calculate_fixed_risk_size(self, request: PositionSizingRequest) -> Decimal:
        """Calculate position size using fixed risk method"""
        # Calculate risk amount
        risk_amount = request.account_balance * (request.risk_per_trade / 100)

        # Calculate risk per share
        risk_per_share = abs(request.entry_price - request.stop_loss_price)

        # Calculate number of shares
        shares = risk_amount / risk_per_share

        return shares

    def _has_kelly_parameters(self, request: PositionSizingRequest) -> bool:
        """Check if Kelly Criterion parameters are available"""
        return all([
            request.win_probability is not None,
            request.average_win is not None,
            request.average_loss is not None,
            request.win_probability > 0,
            request.average_win > 0,
            request.average_loss > 0
        ])

    def _calculate_kelly_fraction(self, request: PositionSizingRequest) -> Decimal:
        """Calculate Kelly fraction"""
        try:
            p = request.win_probability  # Probability of winning
            b = request.average_win / request.average_loss  # Win/loss ratio
            q = 1 - p  # Probability of losing

            # Kelly formula: f = (bp - q) / b
            kelly_fraction = (b * p - q) / b

            # Cap Kelly fraction to prevent excessive risk
            max_kelly = Decimal(0.25)  # Maximum 25% Kelly
            kelly_fraction = min(kelly_fraction, max_kelly)

            # Ensure non-negative
            kelly_fraction = max(kelly_fraction, Decimal(0))

            return kelly_fraction

        except Exception as e:
            logger.error(f"Error calculating Kelly fraction: {e}")
            return Decimal(0)

    def _apply_kelly_criterion(self, request: PositionSizingRequest, kelly_fraction: Decimal) -> Decimal:
        """Apply Kelly Criterion to position sizing"""
        # Calculate position value using Kelly fraction
        kelly_position_value = request.account_balance * kelly_fraction

        # Convert to number of shares
        kelly_shares = kelly_position_value / request.entry_price

        return kelly_shares

    async def _get_asset_volatility(self, symbol: str) -> Decimal:
        """Get asset volatility from price history"""
        try:
            # Get price history
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.volatility_lookback_days)

            price_history = await self.stock_service.get_price_history(
                symbol, start_date, end_date, "1d"
            )

            if not price_history or len(price_history) < 10:
                return Decimal(0.20)  # Default 20% annual volatility

            # Calculate daily returns
            prices = [float(p['close']) for p in price_history]
            returns = []
            for i in range(1, len(prices)):
                daily_return = (prices[i] - prices[i-1]) / prices[i-1]
                returns.append(daily_return)

            if not returns:
                return Decimal(0.20)

            # Calculate volatility
            returns_array = np.array(returns)
            daily_vol = np.std(returns_array)
            annual_vol = daily_vol * np.sqrt(252)  # Annualize

            return Decimal(str(annual_vol))

        except Exception as e:
            logger.error(f"Error calculating volatility for {symbol}: {e}")
            return Decimal(0.20)

    def _apply_volatility_adjustment(
        self,
        base_size: Decimal,
        asset_volatility: Decimal,
        request: PositionSizingRequest
    ) -> Decimal:
        """Adjust position size based on asset volatility"""
        try:
            # Default target volatility if not specified
            target_vol = request.target_volatility or Decimal(0.15)  # 15% annual

            # Calculate volatility adjustment factor
            if asset_volatility > 0:
                vol_adjustment = target_vol / asset_volatility
                # Cap adjustment to prevent extreme sizing
                vol_adjustment = max(Decimal(0.1), min(vol_adjustment, Decimal(3.0)))
            else:
                vol_adjustment = Decimal(1.0)

            adjusted_size = base_size * vol_adjustment

            return adjusted_size

        except Exception as e:
            logger.error(f"Error applying volatility adjustment: {e}")
            return base_size

    def _apply_limits_and_validations(
        self,
        size: Decimal,
        request: PositionSizingRequest
    ) -> Tuple[Decimal, List[str], List[str]]:
        """Apply position limits and generate warnings"""
        warnings = []
        adjustments = []
        original_size = size

        # Minimum position size (at least 1 share)
        if size < 1:
            size = Decimal(1)
            adjustments.append("Increased to minimum 1 share")

        # Position value checks
        position_value = size * request.entry_price

        # Minimum position value
        if position_value < self.min_position_value:
            size = self.min_position_value / request.entry_price
            adjustments.append(f"Increased to minimum position value ${self.min_position_value}")

        # Maximum position percentage
        max_position_value = request.account_balance * (request.max_position_percent / 100)
        if position_value > max_position_value:
            size = max_position_value / request.entry_price
            adjustments.append(f"Reduced to max position limit {request.max_position_percent}%")

        # Risk validation
        risk_per_share = abs(request.entry_price - request.stop_loss_price)
        total_risk = size * risk_per_share
        risk_percent = (total_risk / request.account_balance) * 100

        if risk_percent > request.risk_per_trade * 1.5:  # 50% buffer
            warnings.append(f"Calculated risk ({risk_percent:.1f}%) exceeds target ({request.risk_per_trade:.1f}%)")

        # Round to whole shares
        size = size.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

        # Additional warnings
        if request.take_profit_price:
            profit_per_share = abs(request.take_profit_price - request.entry_price)
            risk_reward = profit_per_share / risk_per_share if risk_per_share > 0 else 0

            if risk_reward < 1:
                warnings.append(f"Risk/reward ratio ({risk_reward:.2f}) is less than 1:1")
            elif risk_reward < 1.5:
                warnings.append(f"Risk/reward ratio ({risk_reward:.2f}) is below recommended 1.5:1")

        # Volatility warnings
        if request.current_volatility and request.current_volatility > Decimal(0.50):
            warnings.append(f"High volatility asset ({request.current_volatility*100:.1f}% annual)")

        return size, warnings, adjustments

    async def _calculate_correlation_adjustment(
        self,
        symbol: str,
        portfolio: Portfolio,
        target_correlation: Decimal
    ) -> Decimal:
        """Calculate position size adjustment based on portfolio correlation"""
        try:
            if not portfolio.positions:
                return Decimal(1.0)

            # Get symbols from existing positions
            existing_symbols = [pos.symbol for pos in portfolio.positions]

            # Calculate correlations (simplified - in practice would use price history)
            # This is a placeholder - real implementation would calculate actual correlations
            avg_correlation = Decimal(0.3)  # Placeholder

            # Adjust size based on correlation
            if avg_correlation > target_correlation:
                # Reduce size if correlation is too high
                adjustment_factor = target_correlation / avg_correlation
                return max(adjustment_factor, Decimal(0.1))  # Minimum 10% size
            else:
                return Decimal(1.0)

        except Exception as e:
            logger.error(f"Error calculating correlation adjustment: {e}")
            return Decimal(1.0)

    def _check_portfolio_concentration(
        self,
        result: PositionSizingResult,
        portfolio: Portfolio
    ) -> Decimal:
        """Check and adjust for portfolio concentration limits"""
        try:
            if not portfolio.positions:
                return Decimal(1.0)

            # Calculate current portfolio concentration
            largest_position_value = max(pos.market_value for pos in portfolio.positions)
            largest_position_percent = (largest_position_value / portfolio.total_value) * 100

            # Check if new position would create excessive concentration
            new_position_value = result.position_value
            total_value_after = portfolio.total_value + new_position_value

            # Check against largest existing position
            new_position_percent = (new_position_value / total_value_after) * 100
            max_concentration_limit = Decimal(20)  # 20% max concentration

            if new_position_percent > max_concentration_limit:
                # Reduce position to meet concentration limit
                adjustment_factor = max_concentration_limit / new_position_percent
                return adjustment_factor

            return Decimal(1.0)

        except Exception as e:
            logger.error(f"Error checking portfolio concentration: {e}")
            return Decimal(1.0)

    async def calculate_multi_position_sizing(
        self,
        requests: List[PositionSizingRequest],
        portfolio: Portfolio,
        correlation_target: Decimal = Decimal(0.3)
    ) -> List[PositionSizingResult]:
        """Calculate position sizes for multiple positions simultaneously"""
        try:
            results = []

            # Calculate total risk budget
            total_risk_budget = sum(req.account_balance * (req.risk_per_trade / 100) for req in requests)

            # Individual calculations
            for i, request in enumerate(requests):
                # Adjust risk per trade to ensure total doesn't exceed limits
                adjusted_risk = min(
                    request.risk_per_trade,
                    (total_risk_budget * Decimal(0.8)) / len(requests) / request.account_balance * 100
                )

                adjusted_request = request.copy()
                adjusted_request.risk_per_trade = adjusted_risk

                result = await self.calculate_portfolio_position_size(
                    adjusted_request, portfolio, correlation_target
                )

                results.append(result)

            return results

        except Exception as e:
            logger.error(f"Error calculating multi-position sizing: {e}")
            raise

    def create_risk_profile_limits(self, risk_profile: RiskProfile) -> Dict[str, Decimal]:
        """Create position sizing limits based on risk profile"""
        limits = {
            RiskProfile.CONSERVATIVE: {
                "max_position_percent": Decimal(5),
                "max_risk_per_trade": Decimal(1),
                "max_portfolio_risk": Decimal(10),
                "require_stop_loss": True,
                "max_leverage": Decimal(1)
            },
            RiskProfile.MODERATE: {
                "max_position_percent": Decimal(10),
                "max_risk_per_trade": Decimal(2),
                "max_portfolio_risk": Decimal(15),
                "require_stop_loss": True,
                "max_leverage": Decimal(1.5)
            },
            RiskProfile.AGGRESSIVE: {
                "max_position_percent": Decimal(15),
                "max_risk_per_trade": Decimal(3),
                "max_portfolio_risk": Decimal(25),
                "require_stop_loss": False,
                "max_leverage": Decimal(2)
            },
            RiskProfile.VERY_AGGRESSIVE: {
                "max_position_percent": Decimal(25),
                "max_risk_per_trade": Decimal(5),
                "max_portfolio_risk": Decimal(35),
                "require_stop_loss": False,
                "max_leverage": Decimal(3)
            }
        }

        return limits.get(risk_profile, limits[RiskProfile.MODERATE])

    async def optimize_portfolio_sizing(
        self,
        portfolio: Portfolio,
        target_symbols: List[str],
        optimization_method: str = "sharpe"
    ) -> Dict[str, Decimal]:
        """Optimize position sizes across portfolio using modern portfolio theory"""
        try:
            # This is a simplified implementation
            # Real implementation would use optimization algorithms

            equal_weight = Decimal(1) / len(target_symbols)
            allocations = {symbol: equal_weight for symbol in target_symbols}

            return allocations

        except Exception as e:
            logger.error(f"Error optimizing portfolio sizing: {e}")
            raise


# Global position sizing service instance
_position_sizing_service: Optional[PositionSizingService] = None


def get_position_sizing_service() -> PositionSizingService:
    """Get the global position sizing service"""
    global _position_sizing_service
    if _position_sizing_service is None:
        from ..services.stock_service import get_stock_service
        _position_sizing_service = PositionSizingService(get_stock_service())
    return _position_sizing_service