"""
Options pricing engines: Black-Scholes and Binomial (CRR) models.
Mathematical implementations for theoretical options pricing.
"""

import math
import numpy as np
from typing import Optional, Tuple
from scipy.stats import norm
from scipy.optimize import brentq
from dataclasses import dataclass
from ..models.options_models import OptionType, Greeks


@dataclass
class PricingInputs:
    """Standardized inputs for all pricing models."""
    underlying_price: float
    strike: float
    time_to_expiry: float  # In years
    risk_free_rate: float
    dividend_yield: float = 0.0
    volatility: float = 0.2  # Default 20% volatility


class BlackScholesEngine:
    """Black-Scholes closed-form pricing engine."""

    @staticmethod
    def calculate_d1_d2(inputs: PricingInputs) -> Tuple[float, float]:
        """Calculate d1 and d2 parameters for Black-Scholes formula."""
        S, K, T, r, q, sigma = (
            inputs.underlying_price,
            inputs.strike,
            inputs.time_to_expiry,
            inputs.risk_free_rate,
            inputs.dividend_yield,
            inputs.volatility,
        )

        d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)

        return d1, d2

    @classmethod
    def price_option(cls, inputs: PricingInputs, option_type: OptionType) -> float:
        """Calculate option price using Black-Scholes formula."""
        if inputs.time_to_expiry <= 0:
            return cls._intrinsic_value(inputs, option_type)

        S, K, T, r, q = (
            inputs.underlying_price,
            inputs.strike,
            inputs.time_to_expiry,
            inputs.risk_free_rate,
            inputs.dividend_yield,
        )

        d1, d2 = cls.calculate_d1_d2(inputs)

        if option_type == OptionType.CALL:
            price = (
                S * np.exp(-q * T) * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
            )
        else:  # PUT
            price = (
                K * np.exp(-r * T) * norm.cdf(-d2) - S * np.exp(-q * T) * norm.cdf(-d1)
            )

        return max(0.0, price)

    @classmethod
    def calculate_greeks(cls, inputs: PricingInputs, option_type: OptionType) -> Greeks:
        """Calculate all Greeks using Black-Scholes formulas."""
        if inputs.time_to_expiry <= 0:
            return cls._zero_greeks()

        S, K, T, r, q, sigma = (
            inputs.underlying_price,
            inputs.strike,
            inputs.time_to_expiry,
            inputs.risk_free_rate,
            inputs.dividend_yield,
            inputs.volatility,
        )

        d1, d2 = cls.calculate_d1_d2(inputs)

        # Common calculations
        nd1 = norm.cdf(d1)
        nd2 = norm.cdf(d2)
        n_prime_d1 = norm.pdf(d1)

        if option_type == OptionType.CALL:
            delta = np.exp(-q * T) * nd1
            rho = K * T * np.exp(-r * T) * nd2 / 100  # Per 1% change in interest rate
        else:  # PUT
            delta = -np.exp(-q * T) * norm.cdf(-d1)
            rho = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100

        # Greeks that are the same for calls and puts
        gamma = np.exp(-q * T) * n_prime_d1 / (S * sigma * np.sqrt(T))
        theta = (
            -(S * n_prime_d1 * sigma * np.exp(-q * T)) / (2 * np.sqrt(T))
            - r * K * np.exp(-r * T) * (nd2 if option_type == OptionType.CALL else norm.cdf(-d2))
            + q * S * np.exp(-q * T) * (nd1 if option_type == OptionType.CALL else norm.cdf(-d1))
        ) / 365  # Per day

        vega = S * np.exp(-q * T) * n_prime_d1 * np.sqrt(T) / 100  # Per 1% change in volatility

        return Greeks(
            delta=round(delta, 4),
            gamma=round(gamma, 4),
            theta=round(theta, 4),
            vega=round(vega, 4),
            rho=round(rho, 4),
        )

    @staticmethod
    def _intrinsic_value(inputs: PricingInputs, option_type: OptionType) -> float:
        """Calculate intrinsic value for expired options."""
        if option_type == OptionType.CALL:
            return max(0, inputs.underlying_price - inputs.strike)
        else:
            return max(0, inputs.strike - inputs.underlying_price)

    @staticmethod
    def _zero_greeks() -> Greeks:
        """Return zero Greeks for expired options."""
        return Greeks(delta=0.0, gamma=0.0, theta=0.0, vega=0.0, rho=0.0)


class CRRBinomialEngine:
    """Cox-Ross-Rubinstein binomial tree pricing engine."""

    @classmethod
    def price_option(
        cls, inputs: PricingInputs, option_type: OptionType, steps: int = 100
    ) -> float:
        """Price option using binomial tree with specified number of steps."""
        if inputs.time_to_expiry <= 0:
            return BlackScholesEngine._intrinsic_value(inputs, option_type)

        S, K, T, r, q, sigma = (
            inputs.underlying_price,
            inputs.strike,
            inputs.time_to_expiry,
            inputs.risk_free_rate,
            inputs.dividend_yield,
            inputs.volatility,
        )

        # Calculate tree parameters
        dt = T / steps
        u = np.exp(sigma * np.sqrt(dt))  # Up factor
        d = 1 / u  # Down factor
        p = (np.exp((r - q) * dt) - d) / (u - d)  # Risk-neutral probability

        # Initialize option values at expiration
        prices = np.zeros(steps + 1)
        for i in range(steps + 1):
            spot_at_expiry = S * (u ** i) * (d ** (steps - i))
            if option_type == OptionType.CALL:
                prices[i] = max(0, spot_at_expiry - K)
            else:
                prices[i] = max(0, K - spot_at_expiry)

        # Work backwards through the tree
        for step in range(steps - 1, -1, -1):
            for i in range(step + 1):
                # Calculate option value at this node
                prices[i] = np.exp(-r * dt) * (p * prices[i + 1] + (1 - p) * prices[i])

                # For American options, check early exercise (not implemented here)
                # European options don't have early exercise

        return max(0.0, prices[0])

    @classmethod
    def calculate_greeks(
        cls, inputs: PricingInputs, option_type: OptionType, steps: int = 100
    ) -> Greeks:
        """Calculate Greeks using finite difference method on binomial tree."""
        if inputs.time_to_expiry <= 0:
            return BlackScholesEngine._zero_greeks()

        # Base price
        base_price = cls.price_option(inputs, option_type, steps)

        # Delta: derivative with respect to underlying price
        ds = inputs.underlying_price * 0.01  # 1% bump
        inputs_up = PricingInputs(
            inputs.underlying_price + ds,
            inputs.strike,
            inputs.time_to_expiry,
            inputs.risk_free_rate,
            inputs.dividend_yield,
            inputs.volatility,
        )
        inputs_down = PricingInputs(
            inputs.underlying_price - ds,
            inputs.strike,
            inputs.time_to_expiry,
            inputs.risk_free_rate,
            inputs.dividend_yield,
            inputs.volatility,
        )

        price_up = cls.price_option(inputs_up, option_type, steps)
        price_down = cls.price_option(inputs_down, option_type, steps)
        delta = (price_up - price_down) / (2 * ds)

        # Gamma: second derivative with respect to underlying price
        gamma = (price_up - 2 * base_price + price_down) / (ds**2)

        # Vega: derivative with respect to volatility
        dvol = 0.01  # 1% volatility bump
        inputs_vol_up = PricingInputs(
            inputs.underlying_price,
            inputs.strike,
            inputs.time_to_expiry,
            inputs.risk_free_rate,
            inputs.dividend_yield,
            inputs.volatility + dvol,
        )
        price_vol_up = cls.price_option(inputs_vol_up, option_type, steps)
        vega = (price_vol_up - base_price) / dvol / 100  # Per 1% change

        # Theta: derivative with respect to time
        dt = 1 / 365  # 1 day
        if inputs.time_to_expiry > dt:
            inputs_time_down = PricingInputs(
                inputs.underlying_price,
                inputs.strike,
                inputs.time_to_expiry - dt,
                inputs.risk_free_rate,
                inputs.dividend_yield,
                inputs.volatility,
            )
            price_time_down = cls.price_option(inputs_time_down, option_type, steps)
            theta = price_time_down - base_price  # Already per day
        else:
            theta = 0.0

        # Rho: derivative with respect to interest rate
        dr = 0.0001  # 1 basis point
        inputs_rate_up = PricingInputs(
            inputs.underlying_price,
            inputs.strike,
            inputs.time_to_expiry,
            inputs.risk_free_rate + dr,
            inputs.dividend_yield,
            inputs.volatility,
        )
        price_rate_up = cls.price_option(inputs_rate_up, option_type, steps)
        rho = (price_rate_up - base_price) / dr / 100  # Per 1% change

        return Greeks(
            delta=round(delta, 4),
            gamma=round(gamma, 4),
            theta=round(theta, 4),
            vega=round(vega, 4),
            rho=round(rho, 4),
        )


class ImpliedVolatilityCalculator:
    """Calculate implied volatility using numerical methods."""

    @staticmethod
    def calculate_iv(
        market_price: float,
        inputs: PricingInputs,
        option_type: OptionType,
        method: str = "brent",
        max_iterations: int = 100,
        tolerance: float = 1e-6,
    ) -> Optional[float]:
        """
        Calculate implied volatility given market price.

        Args:
            market_price: Observed market price of the option
            inputs: Pricing inputs (volatility will be ignored)
            option_type: Call or put option
            method: Numerical method ('brent' or 'bisection')
            max_iterations: Maximum iterations for convergence
            tolerance: Convergence tolerance

        Returns:
            Implied volatility or None if not found
        """
        if market_price <= 0:
            return None

        # Define objective function
        def objective(vol: float) -> float:
            pricing_inputs = PricingInputs(
                inputs.underlying_price,
                inputs.strike,
                inputs.time_to_expiry,
                inputs.risk_free_rate,
                inputs.dividend_yield,
                vol,
            )
            theoretical_price = BlackScholesEngine.price_option(pricing_inputs, option_type)
            return theoretical_price - market_price

        # Check intrinsic value
        intrinsic = BlackScholesEngine._intrinsic_value(inputs, option_type)
        if market_price <= intrinsic + tolerance:
            return 0.01  # Minimum volatility of 1%

        try:
            if method == "brent":
                # Use Brent's method for root finding
                iv = brentq(objective, 0.001, 5.0, maxiter=max_iterations, xtol=tolerance)
            else:
                # Use bisection method
                iv = cls._bisection_method(objective, 0.001, 5.0, tolerance, max_iterations)

            # Validate result
            if 0.001 <= iv <= 5.0:
                return round(iv, 4)
            else:
                return None

        except (ValueError, RuntimeError):
            return None

    @staticmethod
    def _bisection_method(
        func, a: float, b: float, tolerance: float, max_iterations: int
    ) -> float:
        """Bisection method for root finding."""
        for _ in range(max_iterations):
            c = (a + b) / 2
            if abs(func(c)) < tolerance:
                return c

            if func(a) * func(c) < 0:
                b = c
            else:
                a = c

        raise RuntimeError("Bisection method did not converge")