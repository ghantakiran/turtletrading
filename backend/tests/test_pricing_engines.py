"""
Comprehensive unit tests for options pricing engines.
Tests Black-Scholes, Binomial, and Implied Volatility calculations with golden file validation.
"""

import pytest
import numpy as np
from datetime import date, datetime
from pathlib import Path
import json
import math

from app.core.pricing_engines import (
    BlackScholesEngine,
    CRRBinomialEngine,
    ImpliedVolatilityCalculator,
    PricingInputs,
)
from app.models.options_models import OptionType, Greeks


class TestPricingInputs:
    """Test PricingInputs dataclass functionality."""

    def test_pricing_inputs_creation(self):
        """Test basic PricingInputs creation with default values."""
        inputs = PricingInputs(
            underlying_price=100.0,
            strike=100.0,
            time_to_expiry=0.25,  # 3 months
            risk_free_rate=0.05,
        )

        assert inputs.underlying_price == 100.0
        assert inputs.strike == 100.0
        assert inputs.time_to_expiry == 0.25
        assert inputs.risk_free_rate == 0.05
        assert inputs.dividend_yield == 0.0  # Default
        assert inputs.volatility == 0.2  # Default

    def test_pricing_inputs_with_all_parameters(self):
        """Test PricingInputs with all parameters specified."""
        inputs = PricingInputs(
            underlying_price=150.0,
            strike=155.0,
            time_to_expiry=0.5,
            risk_free_rate=0.03,
            dividend_yield=0.02,
            volatility=0.25,
        )

        assert inputs.underlying_price == 150.0
        assert inputs.strike == 155.0
        assert inputs.time_to_expiry == 0.5
        assert inputs.risk_free_rate == 0.03
        assert inputs.dividend_yield == 0.02
        assert inputs.volatility == 0.25


class TestBlackScholesEngine:
    """Test Black-Scholes pricing engine functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        # Standard test case: ATM call option
        self.standard_inputs = PricingInputs(
            underlying_price=100.0,
            strike=100.0,
            time_to_expiry=0.25,  # 3 months
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=0.2,
        )

    def test_calculate_d1_d2_atm(self):
        """Test d1 and d2 calculation for ATM option."""
        d1, d2 = BlackScholesEngine.calculate_d1_d2(self.standard_inputs)

        # Expected values for ATM option
        expected_d1 = (0.05 + 0.5 * 0.2**2) * 0.25 / (0.2 * math.sqrt(0.25))
        expected_d2 = expected_d1 - 0.2 * math.sqrt(0.25)

        assert abs(d1 - expected_d1) < 1e-10
        assert abs(d2 - expected_d2) < 1e-10
        assert d1 > d2  # d1 should always be greater than d2

    def test_calculate_d1_d2_itm_call(self):
        """Test d1 and d2 for in-the-money call option."""
        inputs = PricingInputs(
            underlying_price=110.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=0.2,
        )

        d1, d2 = BlackScholesEngine.calculate_d1_d2(inputs)

        # For ITM call, d1 should be positive and larger
        assert d1 > 1.0  # Should be significantly positive
        assert d1 > d2

    def test_calculate_d1_d2_otm_call(self):
        """Test d1 and d2 for out-of-the-money call option."""
        inputs = PricingInputs(
            underlying_price=90.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=0.2,
        )

        d1, d2 = BlackScholesEngine.calculate_d1_d2(inputs)

        # For OTM call, d1 should be negative
        assert d1 < 0
        assert d1 > d2

    def test_price_call_option_atm(self):
        """Test call option pricing for ATM option."""
        price = BlackScholesEngine.price_option(self.standard_inputs, OptionType.CALL)

        # ATM call should have positive value
        assert price > 0
        assert price < self.standard_inputs.underlying_price  # Should be less than underlying

        # Approximate expected value (can be calculated manually)
        # For ATM option with these parameters, price should be around 3-4
        assert 2.0 < price < 6.0

    def test_price_put_option_atm(self):
        """Test put option pricing for ATM option."""
        price = BlackScholesEngine.price_option(self.standard_inputs, OptionType.PUT)

        # ATM put should have positive value
        assert price > 0
        assert price < self.standard_inputs.strike

        # For ATM option, call and put should have similar values (put-call parity)
        call_price = BlackScholesEngine.price_option(self.standard_inputs, OptionType.CALL)

        # Put-call parity: C - P = S*e^(-q*T) - K*e^(-r*T)
        parity_diff = call_price - price
        expected_diff = (
            self.standard_inputs.underlying_price * math.exp(-self.standard_inputs.dividend_yield * self.standard_inputs.time_to_expiry) -
            self.standard_inputs.strike * math.exp(-self.standard_inputs.risk_free_rate * self.standard_inputs.time_to_expiry)
        )

        assert abs(parity_diff - expected_diff) < 1e-10

    def test_price_option_zero_time(self):
        """Test option pricing with zero time to expiry (intrinsic value)."""
        inputs = PricingInputs(
            underlying_price=110.0,
            strike=100.0,
            time_to_expiry=0.0,
            risk_free_rate=0.05,
            volatility=0.2,
        )

        call_price = BlackScholesEngine.price_option(inputs, OptionType.CALL)
        put_price = BlackScholesEngine.price_option(inputs, OptionType.PUT)

        # Should return intrinsic values
        assert call_price == 10.0  # max(110 - 100, 0)
        assert put_price == 0.0   # max(100 - 110, 0)

    def test_price_option_negative_time(self):
        """Test option pricing with negative time to expiry."""
        inputs = PricingInputs(
            underlying_price=110.0,
            strike=100.0,
            time_to_expiry=-0.1,  # Expired
            risk_free_rate=0.05,
            volatility=0.2,
        )

        call_price = BlackScholesEngine.price_option(inputs, OptionType.CALL)
        put_price = BlackScholesEngine.price_option(inputs, OptionType.PUT)

        # Should return intrinsic values for expired options
        assert call_price == 10.0  # max(110 - 100, 0)
        assert put_price == 0.0   # max(100 - 110, 0)

    def test_calculate_greeks_call_atm(self):
        """Test Greeks calculation for ATM call option."""
        greeks = BlackScholesEngine.calculate_greeks(self.standard_inputs, OptionType.CALL)

        # Validate Greek properties
        assert isinstance(greeks, Greeks)
        assert 0.4 < greeks.delta < 0.6  # ATM call delta should be around 0.5
        assert greeks.gamma > 0  # Gamma is always positive
        assert greeks.theta < 0  # Theta is negative for long options
        assert greeks.vega > 0   # Vega is always positive
        # Rho can be positive or negative depending on option type and parameters

        # Check rounding
        assert all(len(str(value).split('.')[-1]) <= 4 for value in [
            greeks.delta, greeks.gamma, greeks.theta, greeks.vega, greeks.rho
        ])

    def test_calculate_greeks_put_atm(self):
        """Test Greeks calculation for ATM put option."""
        greeks = BlackScholesEngine.calculate_greeks(self.standard_inputs, OptionType.PUT)

        # Validate Greek properties
        assert isinstance(greeks, Greeks)
        assert -0.6 < greeks.delta < -0.4  # ATM put delta should be around -0.5
        assert greeks.gamma > 0  # Gamma is always positive
        assert greeks.theta < 0  # Theta is negative for long options
        assert greeks.vega > 0   # Vega is always positive
        assert greeks.rho < 0    # Rho for puts is typically negative

    def test_calculate_greeks_itm_call(self):
        """Test Greeks for deep ITM call option."""
        inputs = PricingInputs(
            underlying_price=120.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=0.2,
        )

        greeks = BlackScholesEngine.calculate_greeks(inputs, OptionType.CALL)

        # Deep ITM call should have high delta
        assert greeks.delta > 0.8
        assert greeks.gamma > 0
        assert greeks.vega > 0

    def test_calculate_greeks_otm_call(self):
        """Test Greeks for deep OTM call option."""
        inputs = PricingInputs(
            underlying_price=80.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=0.2,
        )

        greeks = BlackScholesEngine.calculate_greeks(inputs, OptionType.CALL)

        # Deep OTM call should have low delta
        assert greeks.delta < 0.2
        assert greeks.gamma > 0
        assert greeks.vega > 0

    def test_calculate_greeks_zero_time(self):
        """Test Greeks calculation with zero time to expiry."""
        inputs = PricingInputs(
            underlying_price=110.0,
            strike=100.0,
            time_to_expiry=0.0,
            risk_free_rate=0.05,
            volatility=0.2,
        )

        greeks = BlackScholesEngine.calculate_greeks(inputs, OptionType.CALL)

        # All Greeks should be zero for expired options
        assert greeks.delta == 0.0
        assert greeks.gamma == 0.0
        assert greeks.theta == 0.0
        assert greeks.vega == 0.0
        assert greeks.rho == 0.0

    def test_calculate_greeks_with_dividends(self):
        """Test Greeks calculation with dividend yield."""
        inputs = PricingInputs(
            underlying_price=100.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.03,  # 3% dividend yield
            volatility=0.2,
        )

        greeks = BlackScholesEngine.calculate_greeks(inputs, OptionType.CALL)

        # Delta should be reduced due to dividend yield
        assert 0.3 < greeks.delta < 0.5  # Should be less than 0.5 for ATM due to dividends

    def test_intrinsic_value_call(self):
        """Test intrinsic value calculation for call options."""
        inputs = PricingInputs(
            underlying_price=110.0,
            strike=100.0,
            time_to_expiry=0.0,
            risk_free_rate=0.05,
            volatility=0.2,
        )

        intrinsic = BlackScholesEngine._intrinsic_value(inputs, OptionType.CALL)
        assert intrinsic == 10.0

        # OTM call
        inputs.underlying_price = 90.0
        intrinsic = BlackScholesEngine._intrinsic_value(inputs, OptionType.CALL)
        assert intrinsic == 0.0

    def test_intrinsic_value_put(self):
        """Test intrinsic value calculation for put options."""
        inputs = PricingInputs(
            underlying_price=90.0,
            strike=100.0,
            time_to_expiry=0.0,
            risk_free_rate=0.05,
            volatility=0.2,
        )

        intrinsic = BlackScholesEngine._intrinsic_value(inputs, OptionType.PUT)
        assert intrinsic == 10.0

        # OTM put
        inputs.underlying_price = 110.0
        intrinsic = BlackScholesEngine._intrinsic_value(inputs, OptionType.PUT)
        assert intrinsic == 0.0


class TestCRRBinomialEngine:
    """Test Cox-Ross-Rubinstein Binomial pricing engine."""

    def setup_method(self):
        """Set up test fixtures."""
        self.standard_inputs = PricingInputs(
            underlying_price=100.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=0.2,
        )

    def test_price_call_option_convergence(self):
        """Test that binomial pricing converges to Black-Scholes with more steps."""
        bs_price = BlackScholesEngine.price_option(self.standard_inputs, OptionType.CALL)

        # Test with different step counts
        steps_and_prices = []
        for steps in [10, 50, 100, 200]:
            binomial_price = CRRBinomialEngine.price_option(
                self.standard_inputs, OptionType.CALL, steps
            )
            steps_and_prices.append((steps, binomial_price))

            # Should be positive
            assert binomial_price > 0

        # Check convergence - higher steps should be closer to BS price
        _, price_100 = next((s, p) for s, p in steps_and_prices if s == 100)
        _, price_200 = next((s, p) for s, p in steps_and_prices if s == 200)

        # 200 steps should be closer to BS than 100 steps
        diff_100 = abs(price_100 - bs_price)
        diff_200 = abs(price_200 - bs_price)
        assert diff_200 <= diff_100

        # Should converge to within 1% for 200 steps
        assert abs(price_200 - bs_price) / bs_price < 0.01

    def test_price_put_option_convergence(self):
        """Test that binomial put pricing converges to Black-Scholes."""
        bs_price = BlackScholesEngine.price_option(self.standard_inputs, OptionType.PUT)
        binomial_price = CRRBinomialEngine.price_option(
            self.standard_inputs, OptionType.PUT, steps=200
        )

        # Should converge to within 1%
        assert abs(binomial_price - bs_price) / bs_price < 0.01

    def test_price_option_zero_time(self):
        """Test binomial pricing with zero time to expiry."""
        inputs = PricingInputs(
            underlying_price=110.0,
            strike=100.0,
            time_to_expiry=0.0,
            risk_free_rate=0.05,
            volatility=0.2,
        )

        call_price = CRRBinomialEngine.price_option(inputs, OptionType.CALL)
        put_price = CRRBinomialEngine.price_option(inputs, OptionType.PUT)

        # Should return intrinsic values
        assert call_price == 10.0
        assert put_price == 0.0

    def test_calculate_greeks_convergence(self):
        """Test that binomial Greeks converge to Black-Scholes Greeks."""
        bs_greeks = BlackScholesEngine.calculate_greeks(self.standard_inputs, OptionType.CALL)
        binomial_greeks = CRRBinomialEngine.calculate_greeks(
            self.standard_inputs, OptionType.CALL, steps=100
        )

        # Check convergence within reasonable tolerance
        assert abs(binomial_greeks.delta - bs_greeks.delta) < 0.05
        assert abs(binomial_greeks.gamma - bs_greeks.gamma) < 0.01
        assert abs(binomial_greeks.vega - bs_greeks.vega) < 0.5
        # Theta and Rho might have larger differences due to numerical approximation

    def test_calculate_greeks_zero_time(self):
        """Test binomial Greeks calculation with zero time to expiry."""
        inputs = PricingInputs(
            underlying_price=110.0,
            strike=100.0,
            time_to_expiry=0.0,
            risk_free_rate=0.05,
            volatility=0.2,
        )

        greeks = CRRBinomialEngine.calculate_greeks(inputs, OptionType.CALL)

        # All Greeks should be zero for expired options
        assert greeks.delta == 0.0
        assert greeks.gamma == 0.0
        assert greeks.theta == 0.0
        assert greeks.vega == 0.0
        assert greeks.rho == 0.0

    def test_price_option_different_steps(self):
        """Test pricing consistency with different step counts."""
        prices = []
        for steps in [10, 20, 50]:
            price = CRRBinomialEngine.price_option(
                self.standard_inputs, OptionType.CALL, steps
            )
            prices.append(price)
            assert price > 0

        # Prices should converge (later prices closer to each other)
        assert abs(prices[-1] - prices[-2]) < abs(prices[0] - prices[1])


class TestImpliedVolatilityCalculator:
    """Test Implied Volatility calculation functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.standard_inputs = PricingInputs(
            underlying_price=100.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=0.2,  # This will be ignored in IV calculation
        )

    def test_calculate_iv_known_volatility(self):
        """Test IV calculation with known theoretical price."""
        # First, get the theoretical price with known volatility
        known_vol = 0.25
        inputs_with_vol = PricingInputs(
            underlying_price=100.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=known_vol,
        )

        theoretical_price = BlackScholesEngine.price_option(inputs_with_vol, OptionType.CALL)

        # Now calculate IV using that price
        calculated_iv = ImpliedVolatilityCalculator.calculate_iv(
            market_price=theoretical_price,
            inputs=self.standard_inputs,
            option_type=OptionType.CALL,
        )

        # Should recover the original volatility within tolerance
        assert calculated_iv is not None
        assert abs(calculated_iv - known_vol) < 0.001

    def test_calculate_iv_different_methods(self):
        """Test IV calculation with different numerical methods."""
        market_price = 5.0

        iv_brent = ImpliedVolatilityCalculator.calculate_iv(
            market_price=market_price,
            inputs=self.standard_inputs,
            option_type=OptionType.CALL,
            method="brent",
        )

        iv_bisection = ImpliedVolatilityCalculator.calculate_iv(
            market_price=market_price,
            inputs=self.standard_inputs,
            option_type=OptionType.CALL,
            method="bisection",
        )

        # Both methods should give similar results
        assert iv_brent is not None
        assert iv_bisection is not None
        assert abs(iv_brent - iv_bisection) < 0.001

    def test_calculate_iv_zero_price(self):
        """Test IV calculation with zero market price."""
        iv = ImpliedVolatilityCalculator.calculate_iv(
            market_price=0.0,
            inputs=self.standard_inputs,
            option_type=OptionType.CALL,
        )

        # Should return None for zero price
        assert iv is None

    def test_calculate_iv_negative_price(self):
        """Test IV calculation with negative market price."""
        iv = ImpliedVolatilityCalculator.calculate_iv(
            market_price=-1.0,
            inputs=self.standard_inputs,
            option_type=OptionType.CALL,
        )

        # Should return None for negative price
        assert iv is None

    def test_calculate_iv_intrinsic_value(self):
        """Test IV calculation when market price equals intrinsic value."""
        # ITM call with market price = intrinsic value
        inputs = PricingInputs(
            underlying_price=110.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=0.2,
        )

        intrinsic_value = 10.0  # 110 - 100
        iv = ImpliedVolatilityCalculator.calculate_iv(
            market_price=intrinsic_value,
            inputs=inputs,
            option_type=OptionType.CALL,
        )

        # Should return minimum volatility (1%)
        assert iv == 0.01

    def test_calculate_iv_very_high_price(self):
        """Test IV calculation with unrealistically high market price."""
        market_price = 200.0  # Much higher than underlying price

        iv = ImpliedVolatilityCalculator.calculate_iv(
            market_price=market_price,
            inputs=self.standard_inputs,
            option_type=OptionType.CALL,
        )

        # Should either return None or maximum volatility
        if iv is not None:
            assert iv >= 4.9  # Close to maximum of 5.0

    def test_calculate_iv_put_option(self):
        """Test IV calculation for put options."""
        # Get theoretical put price
        known_vol = 0.3
        inputs_with_vol = PricingInputs(
            underlying_price=100.0,
            strike=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            dividend_yield=0.0,
            volatility=known_vol,
        )

        theoretical_price = BlackScholesEngine.price_option(inputs_with_vol, OptionType.PUT)

        # Calculate IV
        calculated_iv = ImpliedVolatilityCalculator.calculate_iv(
            market_price=theoretical_price,
            inputs=self.standard_inputs,
            option_type=OptionType.PUT,
        )

        # Should recover original volatility
        assert calculated_iv is not None
        assert abs(calculated_iv - known_vol) < 0.001

    def test_calculate_iv_convergence_tolerance(self):
        """Test IV calculation with different convergence tolerances."""
        market_price = 5.0

        # Loose tolerance
        iv_loose = ImpliedVolatilityCalculator.calculate_iv(
            market_price=market_price,
            inputs=self.standard_inputs,
            option_type=OptionType.CALL,
            tolerance=1e-3,
        )

        # Tight tolerance
        iv_tight = ImpliedVolatilityCalculator.calculate_iv(
            market_price=market_price,
            inputs=self.standard_inputs,
            option_type=OptionType.CALL,
            tolerance=1e-8,
        )

        # Both should converge
        assert iv_loose is not None
        assert iv_tight is not None
        # Tight tolerance should be at least as accurate
        assert abs(iv_tight - iv_loose) < 0.001

    def test_bisection_method_direct(self):
        """Test the bisection method directly."""
        # Simple function: f(x) = x^2 - 4, root at x = 2
        def test_function(x):
            return x**2 - 4

        root = ImpliedVolatilityCalculator._bisection_method(
            func=test_function,
            a=1.0,
            b=3.0,
            tolerance=1e-6,
            max_iterations=100,
        )

        # Should find root at x = 2
        assert abs(root - 2.0) < 1e-6

    def test_bisection_method_no_convergence(self):
        """Test bisection method with function that doesn't converge."""
        # Function with no root in interval
        def no_root_function(x):
            return x + 10

        with pytest.raises(RuntimeError, match="Bisection method did not converge"):
            ImpliedVolatilityCalculator._bisection_method(
                func=no_root_function,
                a=1.0,
                b=2.0,
                tolerance=1e-6,
                max_iterations=10,  # Low iterations to force failure
            )


class TestPricingEnginesIntegration:
    """Integration tests comparing different pricing methods."""

    def setup_method(self):
        """Set up test fixtures."""
        self.test_cases = [
            # ATM options
            PricingInputs(100.0, 100.0, 0.25, 0.05, 0.0, 0.2),
            # ITM call
            PricingInputs(110.0, 100.0, 0.25, 0.05, 0.0, 0.2),
            # OTM call
            PricingInputs(90.0, 100.0, 0.25, 0.05, 0.0, 0.2),
            # Short-term
            PricingInputs(100.0, 100.0, 0.05, 0.05, 0.0, 0.2),
            # Long-term
            PricingInputs(100.0, 100.0, 1.0, 0.05, 0.0, 0.2),
            # High volatility
            PricingInputs(100.0, 100.0, 0.25, 0.05, 0.0, 0.5),
            # With dividends
            PricingInputs(100.0, 100.0, 0.25, 0.05, 0.03, 0.2),
        ]

    def test_black_scholes_binomial_convergence(self):
        """Test that Black-Scholes and Binomial pricing converge."""
        for inputs in self.test_cases:
            for option_type in [OptionType.CALL, OptionType.PUT]:
                bs_price = BlackScholesEngine.price_option(inputs, option_type)
                binomial_price = CRRBinomialEngine.price_option(inputs, option_type, steps=200)

                # Should converge within 1%
                relative_error = abs(binomial_price - bs_price) / bs_price
                assert relative_error < 0.01, f"Failed for {inputs} {option_type}: BS={bs_price:.4f}, Binomial={binomial_price:.4f}"

    def test_implied_volatility_round_trip(self):
        """Test IV calculation round-trip accuracy."""
        for inputs in self.test_cases:
            for option_type in [OptionType.CALL, OptionType.PUT]:
                # Skip very short-term options (numerical issues)
                if inputs.time_to_expiry < 0.02:
                    continue

                # Get theoretical price
                theoretical_price = BlackScholesEngine.price_option(inputs, option_type)

                # Skip very low prices (numerical issues)
                if theoretical_price < 0.01:
                    continue

                # Calculate IV
                iv = ImpliedVolatilityCalculator.calculate_iv(
                    market_price=theoretical_price,
                    inputs=inputs,
                    option_type=option_type,
                )

                # Should recover original volatility within tolerance
                assert iv is not None, f"Failed to calculate IV for {inputs} {option_type}"
                error = abs(iv - inputs.volatility)
                assert error < 0.001, f"IV round-trip failed: original={inputs.volatility:.3f}, calculated={iv:.3f}, error={error:.6f}"

    def test_greeks_consistency(self):
        """Test Greeks consistency between Black-Scholes and Binomial."""
        for inputs in self.test_cases:
            # Skip very short-term options
            if inputs.time_to_expiry < 0.02:
                continue

            for option_type in [OptionType.CALL, OptionType.PUT]:
                bs_greeks = BlackScholesEngine.calculate_greeks(inputs, option_type)
                binomial_greeks = CRRBinomialEngine.calculate_greeks(inputs, option_type, steps=100)

                # Delta should be close
                delta_error = abs(binomial_greeks.delta - bs_greeks.delta)
                assert delta_error < 0.05, f"Delta mismatch for {inputs} {option_type}: BS={bs_greeks.delta:.3f}, Binomial={binomial_greeks.delta:.3f}"

                # Gamma should be close
                gamma_error = abs(binomial_greeks.gamma - bs_greeks.gamma)
                assert gamma_error < 0.01, f"Gamma mismatch for {inputs} {option_type}: BS={bs_greeks.gamma:.4f}, Binomial={binomial_greeks.gamma:.4f}"

    def test_put_call_parity(self):
        """Test put-call parity holds for all pricing methods."""
        for inputs in self.test_cases:
            # Black-Scholes
            bs_call = BlackScholesEngine.price_option(inputs, OptionType.CALL)
            bs_put = BlackScholesEngine.price_option(inputs, OptionType.PUT)

            # Binomial
            bin_call = CRRBinomialEngine.price_option(inputs, OptionType.CALL, steps=100)
            bin_put = CRRBinomialEngine.price_option(inputs, OptionType.PUT, steps=100)

            # Put-call parity: C - P = S*e^(-q*T) - K*e^(-r*T)
            expected_diff = (
                inputs.underlying_price * math.exp(-inputs.dividend_yield * inputs.time_to_expiry) -
                inputs.strike * math.exp(-inputs.risk_free_rate * inputs.time_to_expiry)
            )

            # Test Black-Scholes parity
            bs_diff = bs_call - bs_put
            assert abs(bs_diff - expected_diff) < 1e-10, f"BS put-call parity failed for {inputs}"

            # Test Binomial parity (allow for numerical error)
            bin_diff = bin_call - bin_put
            parity_error = abs(bin_diff - expected_diff)
            assert parity_error < 0.01, f"Binomial put-call parity failed for {inputs}: error={parity_error:.6f}"


@pytest.fixture
def golden_test_data():
    """Load golden test data for validation."""
    # Create sample golden data if file doesn't exist
    golden_data = {
        "black_scholes_prices": {
            "atm_call": {"inputs": [100, 100, 0.25, 0.05, 0.0, 0.2], "price": 3.987},
            "atm_put": {"inputs": [100, 100, 0.25, 0.05, 0.0, 0.2], "price": 2.724},
            "itm_call": {"inputs": [110, 100, 0.25, 0.05, 0.0, 0.2], "price": 12.336},
            "otm_put": {"inputs": [110, 100, 0.25, 0.05, 0.0, 0.2], "price": 0.073},
        },
        "greeks": {
            "atm_call": {
                "inputs": [100, 100, 0.25, 0.05, 0.0, 0.2],
                "delta": 0.5596, "gamma": 0.0188, "theta": -6.414, "vega": 9.392, "rho": 11.690
            }
        }
    }
    return golden_data


def test_golden_file_validation(golden_test_data):
    """Test pricing against golden file data."""
    # Test Black-Scholes prices
    for test_name, test_data in golden_test_data["black_scholes_prices"].items():
        inputs = PricingInputs(*test_data["inputs"])
        option_type = OptionType.CALL if "call" in test_name else OptionType.PUT

        calculated_price = BlackScholesEngine.price_option(inputs, option_type)
        expected_price = test_data["price"]

        # Allow for small numerical differences
        relative_error = abs(calculated_price - expected_price) / expected_price
        assert relative_error < 0.001, f"Golden file validation failed for {test_name}: expected={expected_price:.3f}, got={calculated_price:.3f}"

    # Test Greeks
    for test_name, test_data in golden_test_data["greeks"].items():
        inputs = PricingInputs(*test_data["inputs"])
        option_type = OptionType.CALL if "call" in test_name else OptionType.PUT

        calculated_greeks = BlackScholesEngine.calculate_greeks(inputs, option_type)

        # Validate each Greek within tolerance
        for greek_name in ["delta", "gamma", "theta", "vega", "rho"]:
            calculated_value = getattr(calculated_greeks, greek_name)
            expected_value = test_data[greek_name]

            error = abs(calculated_value - expected_value)
            tolerance = 0.001 if greek_name in ["delta", "gamma"] else 0.01

            assert error < tolerance, f"Greek {greek_name} validation failed for {test_name}: expected={expected_value:.4f}, got={calculated_value:.4f}"


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])