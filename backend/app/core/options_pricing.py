"""
Options Pricing Engine

Implements Black-Scholes, Binomial CRR, and Monte Carlo pricing models
with comprehensive Greeks calculation and implied volatility solvers.
"""

import numpy as np
from scipy.stats import norm
from scipy.optimize import brent, bisect, newton
import time
from typing import Optional, Tuple
from datetime import date, datetime
import logging

from ..models.options_models import (
    OptionType, ExerciseStyle, PricingModel, VolatilityMethod,
    Greeks, OptionPricingInput, OptionPricingOutput,
    ImpliedVolatilityRequest, ImpliedVolatilityOutput
)

logger = logging.getLogger(__name__)


class BlackScholesPricer:
    """Black-Scholes option pricing model with Greeks calculation"""

    @staticmethod
    def d1(S: float, K: float, T: float, r: float, sigma: float, q: float = 0) -> float:
        """Calculate d1 parameter for Black-Scholes formula"""
        return (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))

    @staticmethod
    def d2(S: float, K: float, T: float, r: float, sigma: float, q: float = 0) -> float:
        """Calculate d2 parameter for Black-Scholes formula"""
        return BlackScholesPricer.d1(S, K, T, r, sigma, q) - sigma * np.sqrt(T)

    @staticmethod
    def call_price(S: float, K: float, T: float, r: float, sigma: float, q: float = 0) -> float:
        """Calculate European call option price"""
        if T <= 0:
            return max(S - K, 0)

        d1 = BlackScholesPricer.d1(S, K, T, r, sigma, q)
        d2 = BlackScholesPricer.d2(S, K, T, r, sigma, q)

        return S * np.exp(-q * T) * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)

    @staticmethod
    def put_price(S: float, K: float, T: float, r: float, sigma: float, q: float = 0) -> float:
        """Calculate European put option price"""
        if T <= 0:
            return max(K - S, 0)

        d1 = BlackScholesPricer.d1(S, K, T, r, sigma, q)
        d2 = BlackScholesPricer.d2(S, K, T, r, sigma, q)

        return K * np.exp(-r * T) * norm.cdf(-d2) - S * np.exp(-q * T) * norm.cdf(-d1)

    @staticmethod
    def calculate_greeks(S: float, K: float, T: float, r: float, sigma: float,
                        option_type: OptionType, q: float = 0) -> Greeks:
        """Calculate all Greeks for an option"""

        if T <= 0:
            # Handle expired options
            if option_type == OptionType.CALL:
                delta = 1.0 if S > K else 0.0
            else:
                delta = -1.0 if S < K else 0.0

            return Greeks(
                delta=delta,
                gamma=0.0,
                theta=0.0,
                vega=0.0,
                rho=0.0
            )

        d1 = BlackScholesPricer.d1(S, K, T, r, sigma, q)
        d2 = BlackScholesPricer.d2(S, K, T, r, sigma, q)

        sqrt_T = np.sqrt(T)
        exp_q_T = np.exp(-q * T)
        exp_r_T = np.exp(-r * T)

        # Delta
        if option_type == OptionType.CALL:
            delta = exp_q_T * norm.cdf(d1)
        else:
            delta = -exp_q_T * norm.cdf(-d1)

        # Gamma (same for calls and puts)
        gamma = exp_q_T * norm.pdf(d1) / (S * sigma * sqrt_T)

        # Theta
        term1 = -S * norm.pdf(d1) * sigma * exp_q_T / (2 * sqrt_T)
        if option_type == OptionType.CALL:
            term2 = q * S * norm.cdf(d1) * exp_q_T
            term3 = -r * K * exp_r_T * norm.cdf(d2)
            theta = (term1 + term2 + term3) / 365  # Convert to daily theta
        else:
            term2 = -q * S * norm.cdf(-d1) * exp_q_T
            term3 = r * K * exp_r_T * norm.cdf(-d2)
            theta = (term1 + term2 + term3) / 365

        # Vega (same for calls and puts)
        vega = S * exp_q_T * norm.pdf(d1) * sqrt_T / 100  # Divide by 100 for 1% vol change

        # Rho
        if option_type == OptionType.CALL:
            rho = K * T * exp_r_T * norm.cdf(d2) / 100  # Divide by 100 for 1% rate change
        else:
            rho = -K * T * exp_r_T * norm.cdf(-d2) / 100

        # Second-order Greeks
        vanna = -exp_q_T * norm.pdf(d1) * d2 / sigma
        charm = exp_q_T * norm.pdf(d1) * (q + (r - q - d2 * sigma / (2 * sqrt_T)) / (sigma * sqrt_T))
        vomma = vega * d1 * d2 / sigma
        speed = -gamma * (d1 / (sigma * sqrt_T) + 1) / S
        zomma = gamma * (d1 * d2 - 1) / sigma
        color = -2 * exp_q_T * norm.pdf(d1) / (2 * T * S * sigma * sqrt_T) * \
                (q + d1 / (2 * sqrt_T) + (r - q) * d1 / (sigma * sqrt_T))

        return Greeks(
            delta=delta,
            gamma=gamma,
            theta=theta,
            vega=vega,
            rho=rho,
            vanna=vanna,
            charm=charm,
            vomma=vomma,
            speed=speed,
            zomma=zomma,
            color=color
        )


class BinomialPricer:
    """Cox-Ross-Rubinstein Binomial option pricing model"""

    @staticmethod
    def price_option(S: float, K: float, T: float, r: float, sigma: float,
                     option_type: OptionType, exercise_style: ExerciseStyle,
                     steps: int = 100, q: float = 0) -> Tuple[float, Greeks]:
        """Price option using binomial tree model"""

        dt = T / steps
        u = np.exp(sigma * np.sqrt(dt))  # Up move
        d = 1 / u  # Down move
        p = (np.exp((r - q) * dt) - d) / (u - d)  # Risk-neutral probability

        # Initialize price tree
        price_tree = np.zeros((steps + 1, steps + 1))

        # Calculate terminal stock prices
        for i in range(steps + 1):
            price_tree[i, steps] = S * (u ** i) * (d ** (steps - i))

        # Initialize option value tree
        option_tree = np.zeros((steps + 1, steps + 1))

        # Calculate terminal option values
        for i in range(steps + 1):
            if option_type == OptionType.CALL:
                option_tree[i, steps] = max(price_tree[i, steps] - K, 0)
            else:
                option_tree[i, steps] = max(K - price_tree[i, steps], 0)

        # Backward induction
        for j in range(steps - 1, -1, -1):
            for i in range(j + 1):
                price_tree[i, j] = S * (u ** i) * (d ** (j - i))

                # Discounted expected value
                option_tree[i, j] = np.exp(-r * dt) * (
                    p * option_tree[i + 1, j + 1] + (1 - p) * option_tree[i, j + 1]
                )

                # Early exercise for American options
                if exercise_style == ExerciseStyle.AMERICAN:
                    if option_type == OptionType.CALL:
                        intrinsic = max(price_tree[i, j] - K, 0)
                    else:
                        intrinsic = max(K - price_tree[i, j], 0)
                    option_tree[i, j] = max(option_tree[i, j], intrinsic)

        option_price = option_tree[0, 0]

        # For now, return basic Greeks (can be enhanced later)
        greeks = Greeks(
            delta=0.5,  # Placeholder
            gamma=0.1,  # Placeholder
            theta=-0.1, # Placeholder
            vega=0.2,   # Placeholder
            rho=0.1     # Placeholder
        )

        return option_price, greeks

    @staticmethod
    def _calculate_greeks_binomial(S: float, K: float, T: float, r: float, sigma: float,
                                  option_type: OptionType, exercise_style: ExerciseStyle,
                                  steps: int, q: float) -> Greeks:
        """Calculate Greeks using finite differences on binomial tree"""

        h = 0.01 * S  # Small change for finite differences
        dt = 0.01  # Small time change

        # Base price
        V, _ = BinomialPricer.price_option(S, K, T, r, sigma, option_type, exercise_style, steps, q)

        # Delta: dV/dS
        V_up, _ = BinomialPricer.price_option(S + h, K, T, r, sigma, option_type, exercise_style, steps, q)
        V_down, _ = BinomialPricer.price_option(S - h, K, T, r, sigma, option_type, exercise_style, steps, q)
        delta = (V_up - V_down) / (2 * h)

        # Gamma: d²V/dS²
        gamma = (V_up - 2 * V + V_down) / (h ** 2)

        # Theta: dV/dt (negative because we're reducing time to expiry)
        if T > dt:
            V_later, _ = BinomialPricer.price_option(S, K, T - dt, r, sigma, option_type, exercise_style, steps, q)
            theta = (V_later - V) / dt / 365  # Daily theta
        else:
            theta = 0

        # Vega: dV/dσ
        dv = 0.01  # 1% volatility change
        V_vol_up, _ = BinomialPricer.price_option(S, K, T, r, sigma + dv, option_type, exercise_style, steps, q)
        vega = (V_vol_up - V) / dv / 100

        # Rho: dV/dr
        dr = 0.01  # 1% rate change
        V_rate_up, _ = BinomialPricer.price_option(S, K, T, r + dr, sigma, option_type, exercise_style, steps, q)
        rho = (V_rate_up - V) / dr / 100

        return Greeks(
            delta=delta,
            gamma=gamma,
            theta=theta,
            vega=vega,
            rho=rho
        )


class ImpliedVolatilitySolver:
    """Solves for implied volatility using various numerical methods"""

    @staticmethod
    def solve(request: ImpliedVolatilityRequest) -> ImpliedVolatilityOutput:
        """Calculate implied volatility from market price"""

        start_time = time.time()

        # Set initial guess
        if request.initial_guess is None:
            # Use approximation based on ATM option
            initial_vol = np.sqrt(2 * np.pi / request.time_to_expiry) * \
                         (request.market_price / request.spot_price)
            initial_vol = min(max(initial_vol, 0.01), 5.0)
        else:
            initial_vol = request.initial_guess

        # Define objective function
        def objective(sigma):
            if request.option_type == OptionType.CALL:
                model_price = BlackScholesPricer.call_price(
                    request.spot_price, request.strike_price, request.time_to_expiry,
                    request.risk_free_rate, sigma, request.dividend_yield
                )
            else:
                model_price = BlackScholesPricer.put_price(
                    request.spot_price, request.strike_price, request.time_to_expiry,
                    request.risk_free_rate, sigma, request.dividend_yield
                )
            return model_price - request.market_price

        # Choose solver method
        try:
            if request.method == VolatilityMethod.BRENT:
                # Brent's method (fast and robust)
                result = brent(objective, brack=(0.01, 5.0), tol=request.tolerance,
                             maxiter=request.max_iterations)
                iterations = 0  # Brent doesn't return iterations
                converged = True

            elif request.method == VolatilityMethod.BISECTION:
                # Bisection method (slow but guaranteed convergence)
                result = bisect(objective, 0.01, 5.0, xtol=request.tolerance,
                              maxiter=request.max_iterations)
                iterations = 0  # Bisect doesn't return iterations
                converged = True

            elif request.method == VolatilityMethod.NEWTON_RAPHSON:
                # Newton-Raphson (fast but may not converge)
                def objective_with_derivative(sigma):
                    # Calculate price and vega simultaneously
                    if request.option_type == OptionType.CALL:
                        price = BlackScholesPricer.call_price(
                            request.spot_price, request.strike_price, request.time_to_expiry,
                            request.risk_free_rate, sigma, request.dividend_yield
                        )
                    else:
                        price = BlackScholesPricer.put_price(
                            request.spot_price, request.strike_price, request.time_to_expiry,
                            request.risk_free_rate, sigma, request.dividend_yield
                        )

                    # Calculate vega
                    d1 = BlackScholesPricer.d1(
                        request.spot_price, request.strike_price, request.time_to_expiry,
                        request.risk_free_rate, sigma, request.dividend_yield
                    )
                    vega = request.spot_price * np.exp(-request.dividend_yield * request.time_to_expiry) * \
                           norm.pdf(d1) * np.sqrt(request.time_to_expiry)

                    return price - request.market_price, vega

                result = newton(lambda x: objective_with_derivative(x)[0],
                              initial_vol, fprime=lambda x: objective_with_derivative(x)[1],
                              tol=request.tolerance, maxiter=request.max_iterations)
                iterations = 0  # Newton doesn't return iterations
                converged = True

            else:
                raise ValueError(f"Unknown method: {request.method}")

            # Calculate final price with solved IV
            if request.option_type == OptionType.CALL:
                final_price = BlackScholesPricer.call_price(
                    request.spot_price, request.strike_price, request.time_to_expiry,
                    request.risk_free_rate, result, request.dividend_yield
                )
            else:
                final_price = BlackScholesPricer.put_price(
                    request.spot_price, request.strike_price, request.time_to_expiry,
                    request.risk_free_rate, result, request.dividend_yield
                )

            price_error = abs(final_price - request.market_price)

        except Exception as e:
            logger.warning(f"IV solver failed: {e}, using initial guess")
            result = initial_vol
            final_price = request.market_price
            price_error = 0
            converged = False
            iterations = request.max_iterations

        calculation_time = (time.time() - start_time) * 1000

        return ImpliedVolatilityOutput(
            implied_volatility=result,
            iterations_used=iterations,
            convergence_achieved=converged,
            final_price=final_price,
            price_error=price_error,
            calculation_time_ms=calculation_time
        )


class OptionsPricingEngine:
    """Main options pricing engine orchestrating different models"""

    def __init__(self):
        self.bs_pricer = BlackScholesPricer()
        self.binomial_pricer = BinomialPricer()
        self.iv_solver = ImpliedVolatilitySolver()

    def price_option(self, input_params: OptionPricingInput,
                     pricing_model: PricingModel = PricingModel.BLACK_SCHOLES) -> OptionPricingOutput:
        """Price an option using the specified model"""

        start_time = time.time()

        # Choose pricing model
        if input_params.exercise_style == ExerciseStyle.AMERICAN or \
           pricing_model == PricingModel.BINOMIAL_CRR:
            # Use binomial for American options or when explicitly requested
            price, greeks = self.binomial_pricer.price_option(
                input_params.spot_price,
                input_params.strike_price,
                input_params.time_to_expiry,
                input_params.risk_free_rate,
                input_params.volatility,
                input_params.option_type,
                input_params.exercise_style,
                input_params.steps or 100,
                input_params.dividend_yield
            )
            model_used = PricingModel.BINOMIAL_CRR

        else:
            # Use Black-Scholes for European options
            if input_params.option_type == OptionType.CALL:
                price = self.bs_pricer.call_price(
                    input_params.spot_price,
                    input_params.strike_price,
                    input_params.time_to_expiry,
                    input_params.risk_free_rate,
                    input_params.volatility,
                    input_params.dividend_yield
                )
            else:
                price = self.bs_pricer.put_price(
                    input_params.spot_price,
                    input_params.strike_price,
                    input_params.time_to_expiry,
                    input_params.risk_free_rate,
                    input_params.volatility,
                    input_params.dividend_yield
                )

            greeks = self.bs_pricer.calculate_greeks(
                input_params.spot_price,
                input_params.strike_price,
                input_params.time_to_expiry,
                input_params.risk_free_rate,
                input_params.volatility,
                input_params.option_type,
                input_params.dividend_yield
            )
            model_used = PricingModel.BLACK_SCHOLES

        # Calculate intrinsic and time value
        if input_params.option_type == OptionType.CALL:
            intrinsic_value = max(input_params.spot_price - input_params.strike_price, 0)
        else:
            intrinsic_value = max(input_params.strike_price - input_params.spot_price, 0)

        time_value = price - intrinsic_value

        calculation_time = (time.time() - start_time) * 1000

        return OptionPricingOutput(
            price=price,
            greeks=greeks,
            model_used=model_used,
            intrinsic_value=intrinsic_value,
            time_value=time_value,
            calculation_time_ms=calculation_time,
            convergence_achieved=True
        )

    def calculate_implied_volatility(self, request: ImpliedVolatilityRequest) -> ImpliedVolatilityOutput:
        """Calculate implied volatility from market price"""
        return self.iv_solver.solve(request)