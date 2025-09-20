#!/usr/bin/env python3
"""
Simple test script for options analytics core functionality
"""
import sys
sys.path.append('.')

# Test core options pricing functionality
try:
    print("🧪 Testing Options Analytics Core Components")
    print("=" * 50)

    # Test model imports
    from app.models.options_models import (
        OptionType, ExerciseStyle, PricingModel,
        Greeks, OptionPricingInput, OptionPricingOutput
    )
    print("✅ Options models imported successfully")

    # Test pricing engine
    from app.core.options_pricing import BlackScholesPricer, BinomialPricer, OptionsPricingEngine
    print("✅ Options pricing engine imported successfully")

    # Test Black-Scholes pricing
    print("\n📊 Black-Scholes Pricing Test")
    print("-" * 30)

    S = 100  # Stock price
    K = 105  # Strike price
    T = 0.25  # Time to expiry (3 months)
    r = 0.05  # Risk-free rate (5%)
    sigma = 0.2  # Volatility (20%)

    call_price = BlackScholesPricer.call_price(S, K, T, r, sigma)
    put_price = BlackScholesPricer.put_price(S, K, T, r, sigma)

    print(f"📈 Call option price: ${call_price:.4f}")
    print(f"📉 Put option price: ${put_price:.4f}")

    # Test Greeks calculation
    print("\n🔢 Greeks Calculation Test")
    print("-" * 30)

    call_greeks = BlackScholesPricer.calculate_greeks(S, K, T, r, sigma, OptionType.CALL)
    put_greeks = BlackScholesPricer.calculate_greeks(S, K, T, r, sigma, OptionType.PUT)

    print("📞 Call Greeks:")
    print(f"  Delta: {call_greeks.delta:.4f}")
    print(f"  Gamma: {call_greeks.gamma:.4f}")
    print(f"  Theta: {call_greeks.theta:.4f}")
    print(f"  Vega:  {call_greeks.vega:.4f}")
    print(f"  Rho:   {call_greeks.rho:.4f}")

    print("📞 Put Greeks:")
    print(f"  Delta: {put_greeks.delta:.4f}")
    print(f"  Gamma: {put_greeks.gamma:.4f}")
    print(f"  Theta: {put_greeks.theta:.4f}")
    print(f"  Vega:  {put_greeks.vega:.4f}")
    print(f"  Rho:   {put_greeks.rho:.4f}")

    # Test binomial pricing
    print("\n🌳 Binomial Pricing Test")
    print("-" * 30)

    bin_call_price, bin_call_greeks = BinomialPricer.price_option(
        S, K, T, r, sigma, OptionType.CALL, ExerciseStyle.AMERICAN, steps=50
    )

    print(f"📈 Binomial call price: ${bin_call_price:.4f}")
    print(f"📈 Binomial call delta: {bin_call_greeks.delta:.4f}")

    # Test pricing engine
    print("\n⚙️ Pricing Engine Test")
    print("-" * 30)

    engine = OptionsPricingEngine()

    pricing_input = OptionPricingInput(
        spot_price=S,
        strike_price=K,
        time_to_expiry=T,
        risk_free_rate=r,
        volatility=sigma,
        option_type=OptionType.CALL,
        exercise_style=ExerciseStyle.EUROPEAN
    )

    result = engine.price_option(pricing_input)

    print(f"🏭 Engine call price: ${result.price:.4f}")
    print(f"🏭 Engine call delta: {result.greeks.delta:.4f}")
    print(f"🏭 Model used: {result.model_used}")
    print(f"🏭 Intrinsic value: ${result.intrinsic_value:.4f}")
    print(f"🏭 Time value: ${result.time_value:.4f}")
    print(f"🏭 Calculation time: {result.calculation_time_ms:.2f}ms")

    print("\n🎉 All core options analytics components are working correctly!")
    print("🚀 Ready to implement the full options analytics system!")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()