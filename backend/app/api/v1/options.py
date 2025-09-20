"""
Options Analytics API Endpoints

Provides RESTful API endpoints for options pricing, Greeks calculation,
implied volatility analysis, and options chain data.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import date

from ...models.options_models import (
    OptionType, ExerciseStyle, PricingModel, VolatilityMethod,
    OptionPricingInput, OptionPricingOutput,
    ImpliedVolatilityRequest, ImpliedVolatilityOutput,
    OptionsAnalyticsRequest, OptionsAnalyticsResponse,
    OptionsChain, VolatilitySurface
)
from ...services.options_service import OptionsAnalyticsService
from ...core.dependencies import get_options_service

router = APIRouter(prefix="/options", tags=["Options Analytics"])


@router.get("/{symbol}/analytics", response_model=OptionsAnalyticsResponse)
async def get_options_analytics(
    symbol: str,
    expiry: Optional[date] = Query(None, description="Specific expiry date"),
    strike: Optional[float] = Query(None, description="Specific strike price"),
    option_type: Optional[OptionType] = Query(None, description="Call or Put"),
    calculate_greeks: bool = Query(True, description="Calculate Greeks"),
    calculate_iv: bool = Query(True, description="Calculate implied volatility"),
    include_surface: bool = Query(False, description="Include volatility surface"),
    pricing_model: PricingModel = Query(PricingModel.BLACK_SCHOLES, description="Pricing model"),
    use_real_time: bool = Query(True, description="Use real-time data"),
    risk_free_rate: Optional[float] = Query(None, description="Override risk-free rate"),
    dividend_yield: Optional[float] = Query(None, description="Override dividend yield"),
    service: OptionsAnalyticsService = Depends(get_options_service)
) -> OptionsAnalyticsResponse:
    """
    Get comprehensive options analytics for a symbol

    Returns options chains, pricing, Greeks, implied volatility,
    and volatility surface (if requested).
    """

    try:
        request = OptionsAnalyticsRequest(
            symbol=symbol.upper(),
            expiry=expiry,
            strike=strike,
            option_type=option_type,
            calculate_greeks=calculate_greeks,
            calculate_iv=calculate_iv,
            include_surface=include_surface,
            pricing_model=pricing_model,
            use_real_time=use_real_time,
            risk_free_rate=risk_free_rate,
            dividend_yield=dividend_yield
        )

        result = await service.get_options_analytics(request)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching options analytics: {str(e)}")


@router.get("/{symbol}/chain", response_model=List[OptionsChain])
async def get_options_chain(
    symbol: str,
    expiry: Optional[date] = Query(None, description="Specific expiry date"),
    service: OptionsAnalyticsService = Depends(get_options_service)
) -> List[OptionsChain]:
    """
    Get options chain data for a symbol

    Returns calls and puts for available expiration dates.
    """

    try:
        chains = await service.data_provider.fetch_options_chain(symbol.upper(), expiry)

        if not chains:
            raise HTTPException(status_code=404, detail=f"No options data found for {symbol}")

        return chains

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching options chain: {str(e)}")


@router.post("/{symbol}/price", response_model=OptionPricingOutput)
async def price_option(
    symbol: str,
    pricing_input: OptionPricingInput,
    service: OptionsAnalyticsService = Depends(get_options_service)
) -> OptionPricingOutput:
    """
    Price a specific option using Black-Scholes or Binomial models

    Calculate option price and Greeks for given parameters.
    """

    try:
        result = await service.price_option(pricing_input)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error pricing option: {str(e)}")


@router.post("/{symbol}/implied-volatility", response_model=ImpliedVolatilityOutput)
async def calculate_implied_volatility(
    symbol: str,
    iv_request: ImpliedVolatilityRequest,
    service: OptionsAnalyticsService = Depends(get_options_service)
) -> ImpliedVolatilityOutput:
    """
    Calculate implied volatility from market price

    Uses Brent, bisection, or Newton-Raphson methods to solve for IV.
    """

    try:
        result = await service.calculate_implied_volatility(iv_request)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating implied volatility: {str(e)}")


@router.get("/{symbol}/volatility-surface", response_model=VolatilitySurface)
async def get_volatility_surface(
    symbol: str,
    service: OptionsAnalyticsService = Depends(get_options_service)
) -> VolatilitySurface:
    """
    Get implied volatility surface for a symbol

    Returns 3D volatility surface with strikes and expiries.
    """

    try:
        # Get options chains
        chains = await service.data_provider.fetch_options_chain(symbol.upper())

        if not chains:
            raise HTTPException(status_code=404, detail=f"No options data found for {symbol}")

        # Calculate volatility surface
        spot_price = chains[0].spot_price
        risk_free_rate = service.risk_free_rate
        dividend_yield = service.dividend_yield

        surface = await service._calculate_volatility_surface(
            chains, spot_price, risk_free_rate, dividend_yield
        )

        return surface

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating volatility surface: {str(e)}")


@router.get("/{symbol}/greeks", response_model=List[OptionPricingOutput])
async def get_options_greeks(
    symbol: str,
    expiry: Optional[date] = Query(None, description="Specific expiry date"),
    strike: Optional[float] = Query(None, description="Specific strike price"),
    option_type: Optional[OptionType] = Query(None, description="Call or Put"),
    pricing_model: PricingModel = Query(PricingModel.BLACK_SCHOLES, description="Pricing model"),
    service: OptionsAnalyticsService = Depends(get_options_service)
) -> List[OptionPricingOutput]:
    """
    Get Greeks calculations for options

    Returns Delta, Gamma, Theta, Vega, Rho for specified options.
    """

    try:
        request = OptionsAnalyticsRequest(
            symbol=symbol.upper(),
            expiry=expiry,
            strike=strike,
            option_type=option_type,
            calculate_greeks=True,
            calculate_iv=False,
            include_surface=False,
            pricing_model=pricing_model
        )

        result = await service.get_options_analytics(request)

        if not result.pricing_results:
            raise HTTPException(status_code=404, detail=f"No options Greeks found for {symbol}")

        return result.pricing_results

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating Greeks: {str(e)}")


@router.get("/{symbol}/expiries")
async def get_available_expiries(
    symbol: str,
    service: OptionsAnalyticsService = Depends(get_options_service)
) -> List[str]:
    """
    Get available expiration dates for a symbol

    Returns list of expiration dates in YYYY-MM-DD format.
    """

    try:
        chains = await service.data_provider.fetch_options_chain(symbol.upper())

        if not chains:
            raise HTTPException(status_code=404, detail=f"No options data found for {symbol}")

        expiries = [chain.expiry_date.strftime("%Y-%m-%d") for chain in chains]
        return sorted(expiries)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching expiries: {str(e)}")


@router.get("/{symbol}/strikes")
async def get_available_strikes(
    symbol: str,
    expiry: Optional[date] = Query(None, description="Filter by expiry date"),
    service: OptionsAnalyticsService = Depends(get_options_service)
) -> List[float]:
    """
    Get available strike prices for a symbol

    Returns list of strike prices for calls and puts.
    """

    try:
        chains = await service.data_provider.fetch_options_chain(symbol.upper(), expiry)

        if not chains:
            raise HTTPException(status_code=404, detail=f"No options data found for {symbol}")

        strikes = set()
        for chain in chains:
            strikes.update([c.strike for c in chain.calls])
            strikes.update([p.strike for p in chain.puts])

        return sorted(list(strikes))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching strikes: {str(e)}")


@router.get("/models/pricing")
async def get_pricing_models() -> List[str]:
    """
    Get available pricing models

    Returns list of supported option pricing models.
    """

    return [model.value for model in PricingModel]


@router.get("/models/volatility")
async def get_volatility_methods() -> List[str]:
    """
    Get available implied volatility calculation methods

    Returns list of supported IV solver methods.
    """

    return [method.value for method in VolatilityMethod]


@router.get("/health")
async def options_health_check():
    """
    Health check endpoint for options service

    Returns service status and availability.
    """

    return {
        "status": "healthy",
        "service": "options_analytics",
        "models": {
            "pricing": [model.value for model in PricingModel],
            "volatility": [method.value for method in VolatilityMethod]
        },
        "features": [
            "options_chains",
            "greeks_calculation",
            "implied_volatility",
            "volatility_surface",
            "black_scholes_pricing",
            "binomial_pricing"
        ]
    }