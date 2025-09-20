"""
Comprehensive unit tests for options pricing with golden file accuracy testing

Tests Black-Scholes and Binomial pricing models against known reference values
to ensure mathematical accuracy and consistency.
"""

import pytest
import json
import numpy as np
from pathlib import Path
from typing import Dict, List, Any

from app.core.options_pricing import (
    BlackScholesPricer, BinomialPricer, OptionsPricingEngine,
    ImpliedVolatilitySolver
)
from app.models.options_models import (
    OptionType, ExerciseStyle, PricingModel, VolatilityMethod,
    OptionPricingInput, ImpliedVolatilityRequest
)


class TestBlackScholesPricer:
    """Test Black-Scholes pricing model accuracy"""

    @pytest.fixture
    def golden_data(self) -> Dict[str, Any]:
        """Load golden reference data for Black-Scholes tests"""
        return {
            "scenarios": [
                {
                    "name": "ATM_call_standard",
                    "S": 100, "K": 100, "T": 0.25, "r": 0.05, "sigma": 0.2, "q": 0,
                    "option_type": "CALL",
                    "expected": {
                        "price": 4.7840,
                        "delta": 0.5596,
                        "gamma": 0.0396,
                        "theta": -0.0279,
                        "vega": 0.1979,
                        "rho": 0.1112
                    }
                },
                {
                    "name": "ITM_call_high_vol",
                    "S": 110, "K": 100, "T": 0.5, "r": 0.03, "sigma": 0.4, "q": 0,
                    "option_type": "CALL",
                    "expected": {
                        "price": 19.7851,
                        "delta": 0.7088,
                        "gamma": 0.0178,
                        "theta": -0.0367,
                        "vega": 0.3554,
                        "rho": 0.2531
                    }
                },
                {
                    "name": "OTM_put_dividend",
                    "S": 95, "K": 105, "T": 0.1667, "r": 0.04, "sigma": 0.25, "q": 0.02,
                    "option_type": "PUT",
                    "expected": {
                        "price": 10.2184,
                        "delta": -0.8159,
                        "gamma": 0.0204,
                        "theta": -0.0154,
                        "vega": 0.0851,
                        "rho": -0.1275
                    }
                },
                {
                    "name": "short_expiry_call",
                    "S": 102, "K": 105, "T": 0.0274, "r": 0.06, "sigma": 0.15, "q": 0,
                    "option_type": "CALL",
                    "expected": {
                        "price": 0.1058,
                        "delta": 0.1089,
                        "gamma": 0.0516,
                        "theta": -0.2845,
                        "vega": 0.0423,
                        "rho": 0.0077
                    }
                }
            ]
        }

    def test_call_pricing_accuracy(self, golden_data):
        """Test call option pricing against golden reference values"""
        for scenario in golden_data["scenarios"]:
            if scenario["option_type"] == "CALL":
                price = BlackScholesPricer.call_price(
                    scenario["S"], scenario["K"], scenario["T"],
                    scenario["r"], scenario["sigma"], scenario["q"]
                )

                expected = scenario["expected"]["price"]
                tolerance = max(0.01, expected * 0.01)  # 1% or 0.01, whichever is larger

                assert abs(price - expected) < tolerance, \
                    f"Scenario {scenario['name']}: Expected {expected:.4f}, got {price:.4f}"

    def test_put_pricing_accuracy(self, golden_data):
        """Test put option pricing against golden reference values"""
        for scenario in golden_data["scenarios"]:
            if scenario["option_type"] == "PUT":
                price = BlackScholesPricer.put_price(
                    scenario["S"], scenario["K"], scenario["T"],
                    scenario["r"], scenario["sigma"], scenario["q"]
                )

                expected = scenario["expected"]["price"]
                tolerance = max(0.01, expected * 0.01)

                assert abs(price - expected) < tolerance, \
                    f"Scenario {scenario['name']}: Expected {expected:.4f}, got {price:.4f}"

    def test_greeks_accuracy(self, golden_data):
        """Test Greeks calculations against golden reference values"""
        for scenario in golden_data["scenarios"]:
            option_type = OptionType.CALL if scenario["option_type"] == "CALL" else OptionType.PUT

            greeks = BlackScholesPricer.calculate_greeks(
                scenario["S"], scenario["K"], scenario["T"],
                scenario["r"], scenario["sigma"], option_type, scenario["q"]
            )

            expected = scenario["expected"]

            # Test each Greek with appropriate tolerance
            assert abs(greeks.delta - expected["delta"]) < 0.01, \
                f"Delta mismatch in {scenario['name']}: {greeks.delta:.4f} vs {expected['delta']:.4f}"

            assert abs(greeks.gamma - expected["gamma"]) < 0.005, \
                f"Gamma mismatch in {scenario['name']}: {greeks.gamma:.4f} vs {expected['gamma']:.4f}"

            assert abs(greeks.theta - expected["theta"]) < 0.005, \
                f"Theta mismatch in {scenario['name']}: {greeks.theta:.4f} vs {expected['theta']:.4f}"

            assert abs(greeks.vega - expected["vega"]) < 0.01, \
                f"Vega mismatch in {scenario['name']}: {greeks.vega:.4f} vs {expected['vega']:.4f}"

            assert abs(greeks.rho - expected["rho"]) < 0.01, \
                f"Rho mismatch in {scenario['name']}: {greeks.rho:.4f} vs {expected['rho']:.4f}"

    def test_put_call_parity(self):
        """Test put-call parity relationship"""
        S, K, T, r, sigma, q = 100, 105, 0.25, 0.05, 0.2, 0.02

        call_price = BlackScholesPricer.call_price(S, K, T, r, sigma, q)
        put_price = BlackScholesPricer.put_price(S, K, T, r, sigma, q)

        # Put-call parity: C - P = S*e^(-q*T) - K*e^(-r*T)
        left_side = call_price - put_price
        right_side = S * np.exp(-q * T) - K * np.exp(-r * T)

        assert abs(left_side - right_side) < 0.0001, \
            f"Put-call parity violated: {left_side:.6f} != {right_side:.6f}"

    def test_boundary_conditions(self):
        """Test option pricing boundary conditions"""
        S, K, r, sigma, q = 100, 105, 0.05, 0.2, 0

        # Test T -> 0 (expiry)
        call_price_expiry = BlackScholesPricer.call_price(S, K, 0.0001, r, sigma, q)
        put_price_expiry = BlackScholesPricer.put_price(S, K, 0.0001, r, sigma, q)

        # At expiry, option value should equal intrinsic value
        call_intrinsic = max(S - K, 0)
        put_intrinsic = max(K - S, 0)

        assert abs(call_price_expiry - call_intrinsic) < 0.01, \
            f"Call boundary condition failed: {call_price_expiry:.4f} vs {call_intrinsic:.4f}"

        assert abs(put_price_expiry - put_intrinsic) < 0.01, \
            f"Put boundary condition failed: {put_price_expiry:.4f} vs {put_intrinsic:.4f}"


class TestBinomialPricer:
    """Test Binomial pricing model accuracy"""

    def test_binomial_convergence_to_bs(self):
        """Test that binomial pricing converges to Black-Scholes for European options"""
        S, K, T, r, sigma, q = 100, 105, 0.25, 0.05, 0.2, 0

        # Get Black-Scholes reference prices
        bs_call = BlackScholesPricer.call_price(S, K, T, r, sigma, q)
        bs_put = BlackScholesPricer.put_price(S, K, T, r, sigma, q)

        # Test binomial with increasing steps
        for steps in [50, 100, 200]:
            bin_call, _ = BinomialPricer.price_option(
                S, K, T, r, sigma, OptionType.CALL, ExerciseStyle.EUROPEAN, steps, q
            )
            bin_put, _ = BinomialPricer.price_option(
                S, K, T, r, sigma, OptionType.PUT, ExerciseStyle.EUROPEAN, steps, q
            )

            # Tolerance should decrease with more steps
            tolerance = 0.5 / np.sqrt(steps)  # Convergence rate

            assert abs(bin_call - bs_call) < tolerance, \
                f"Call convergence failed at {steps} steps: {bin_call:.4f} vs {bs_call:.4f}"

            assert abs(bin_put - bs_put) < tolerance, \
                f"Put convergence failed at {steps} steps: {bin_put:.4f} vs {bs_put:.4f}"

    def test_american_vs_european_pricing(self):
        """Test that American options are worth at least as much as European"""
        S, K, T, r, sigma, q = 90, 100, 0.5, 0.03, 0.3, 0  # Deep ITM put

        # Price European and American puts
        european_put, _ = BinomialPricer.price_option(
            S, K, T, r, sigma, OptionType.PUT, ExerciseStyle.EUROPEAN, 100, q
        )
        american_put, _ = BinomialPricer.price_option(
            S, K, T, r, sigma, OptionType.PUT, ExerciseStyle.AMERICAN, 100, q
        )

        # American should be worth at least as much as European
        assert american_put >= european_put - 0.001, \
            f"American put cheaper than European: {american_put:.4f} < {european_put:.4f}"

        # For deep ITM puts, American should have early exercise premium
        assert american_put > european_put + 0.01, \
            f"No early exercise premium: {american_put:.4f} vs {european_put:.4f}"


class TestImpliedVolatilitySolver:
    """Test implied volatility calculation accuracy"""

    def test_implied_volatility_roundtrip(self):
        """Test that IV calculation is consistent (roundtrip test)"""
        S, K, T, r, q = 100, 105, 0.25, 0.05, 0
        true_sigma = 0.25

        # Calculate option price with known volatility
        market_price = BlackScholesPricer.call_price(S, K, T, r, true_sigma, q)

        # Solve for implied volatility
        iv_request = ImpliedVolatilityRequest(
            market_price=market_price,
            spot_price=S,
            strike_price=K,
            time_to_expiry=T,
            risk_free_rate=r,
            dividend_yield=q,
            option_type=OptionType.CALL,
            method=VolatilityMethod.BRENT,
            tolerance=1e-6
        )

        solver = ImpliedVolatilitySolver()
        result = solver.solve(iv_request)

        # Should recover the original volatility
        assert result.convergence_achieved, "IV solver did not converge"
        assert abs(result.implied_volatility - true_sigma) < 0.0001, \
            f"IV roundtrip failed: {result.implied_volatility:.6f} vs {true_sigma:.6f}"
        assert abs(result.price_error) < 1e-6, \
            f"Price error too large: {result.price_error:.8f}"

    def test_iv_solver_methods(self):
        """Test different IV solver methods give consistent results"""
        S, K, T, r, q = 100, 95, 0.1667, 0.04, 0
        market_price = 7.5  # Arbitrary market price

        methods = [VolatilityMethod.BRENT, VolatilityMethod.BISECTION]
        results = []

        for method in methods:
            iv_request = ImpliedVolatilityRequest(
                market_price=market_price,
                spot_price=S,
                strike_price=K,
                time_to_expiry=T,
                risk_free_rate=r,
                dividend_yield=q,
                option_type=OptionType.CALL,
                method=method,
                tolerance=1e-5
            )

            solver = ImpliedVolatilitySolver()
            result = solver.solve(iv_request)

            assert result.convergence_achieved, f"Method {method} did not converge"
            results.append(result.implied_volatility)

        # All methods should give similar results
        for i in range(1, len(results)):
            assert abs(results[i] - results[0]) < 0.001, \
                f"Method consistency failed: {results[i]:.6f} vs {results[0]:.6f}"


class TestOptionsPricingEngine:
    """Test the main pricing engine integration"""

    def test_pricing_engine_model_selection(self):
        """Test that pricing engine selects appropriate models"""
        engine = OptionsPricingEngine()

        # European option should use Black-Scholes by default
        european_input = OptionPricingInput(
            spot_price=100,
            strike_price=105,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            volatility=0.2,
            option_type=OptionType.CALL,
            exercise_style=ExerciseStyle.EUROPEAN
        )

        result = engine.price_option(european_input)
        assert result.model_used == PricingModel.BLACK_SCHOLES
        assert result.convergence_achieved
        assert result.calculation_time_ms > 0

        # American option should use Binomial
        american_input = OptionPricingInput(
            spot_price=100,
            strike_price=105,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            volatility=0.2,
            option_type=OptionType.PUT,
            exercise_style=ExerciseStyle.AMERICAN
        )

        result = engine.price_option(american_input, PricingModel.BINOMIAL_CRR)
        assert result.model_used == PricingModel.BINOMIAL_CRR
        assert result.convergence_achieved

    def test_pricing_engine_value_components(self):
        """Test that pricing engine correctly calculates value components"""
        engine = OptionsPricingEngine()

        # ITM call
        itm_input = OptionPricingInput(
            spot_price=110,
            strike_price=100,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            volatility=0.2,
            option_type=OptionType.CALL,
            exercise_style=ExerciseStyle.EUROPEAN
        )

        result = engine.price_option(itm_input)

        # Intrinsic value should be S - K for ITM call
        expected_intrinsic = max(110 - 100, 0)
        assert abs(result.intrinsic_value - expected_intrinsic) < 0.001

        # Time value should be positive
        assert result.time_value > 0

        # Total price should equal intrinsic + time value
        assert abs(result.price - (result.intrinsic_value + result.time_value)) < 0.001


class TestPricingRobustness:
    """Test pricing model robustness and edge cases"""

    def test_extreme_parameters(self):
        """Test pricing with extreme but valid parameters"""
        engine = OptionsPricingEngine()

        # Very high volatility
        high_vol_input = OptionPricingInput(
            spot_price=100,
            strike_price=100,
            time_to_expiry=1.0,
            risk_free_rate=0.05,
            volatility=2.0,  # 200% volatility
            option_type=OptionType.CALL,
            exercise_style=ExerciseStyle.EUROPEAN
        )

        result = engine.price_option(high_vol_input)
        assert result.price > 0
        assert result.convergence_achieved

        # Very short expiry
        short_expiry_input = OptionPricingInput(
            spot_price=100,
            strike_price=100,
            time_to_expiry=0.001,  # ~9 hours
            risk_free_rate=0.05,
            volatility=0.2,
            option_type=OptionType.CALL,
            exercise_style=ExerciseStyle.EUROPEAN
        )

        result = engine.price_option(short_expiry_input)
        assert result.price >= 0
        assert result.convergence_achieved

    def test_pricing_monotonicity(self):
        """Test that option prices behave monotonically with parameters"""
        base_params = {
            "spot_price": 100,
            "strike_price": 100,
            "time_to_expiry": 0.25,
            "risk_free_rate": 0.05,
            "volatility": 0.2,
            "option_type": OptionType.CALL,
            "exercise_style": ExerciseStyle.EUROPEAN
        }

        engine = OptionsPricingEngine()

        # Test volatility monotonicity
        vol_prices = []
        for vol in [0.1, 0.2, 0.3, 0.4]:
            params = base_params.copy()
            params["volatility"] = vol
            result = engine.price_option(OptionPricingInput(**params))
            vol_prices.append(result.price)

        # Call prices should increase with volatility
        for i in range(1, len(vol_prices)):
            assert vol_prices[i] > vol_prices[i-1], \
                f"Volatility monotonicity violated: {vol_prices[i]} <= {vol_prices[i-1]}"

        # Test time monotonicity
        time_prices = []
        for T in [0.1, 0.25, 0.5, 1.0]:
            params = base_params.copy()
            params["time_to_expiry"] = T
            result = engine.price_option(OptionPricingInput(**params))
            time_prices.append(result.price)

        # Call prices should generally increase with time to expiry
        for i in range(1, len(time_prices)):
            assert time_prices[i] >= time_prices[i-1] - 0.001, \
                f"Time monotonicity violated: {time_prices[i]} < {time_prices[i-1]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])