"""
Options Analytics Models and Data Contracts

This module defines comprehensive data models for options pricing,
Greeks calculation, and implied volatility analysis.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
import numpy as np


class OptionType(str, Enum):
    """Option type enumeration"""
    CALL = "CALL"
    PUT = "PUT"


class ExerciseStyle(str, Enum):
    """Option exercise style"""
    AMERICAN = "AMERICAN"
    EUROPEAN = "EUROPEAN"


class PricingModel(str, Enum):
    """Available pricing models"""
    BLACK_SCHOLES = "BLACK_SCHOLES"
    BINOMIAL_CRR = "BINOMIAL_CRR"
    MONTE_CARLO = "MONTE_CARLO"


class VolatilityMethod(str, Enum):
    """Implied volatility calculation methods"""
    BRENT = "BRENT"
    BISECTION = "BISECTION"
    NEWTON_RAPHSON = "NEWTON_RAPHSON"


class Greeks(BaseModel):
    """Greeks for options pricing"""
    delta: float = Field(..., description="Rate of change of option price with respect to underlying price")
    gamma: float = Field(..., description="Rate of change of delta with respect to underlying price")
    theta: float = Field(..., description="Rate of change of option price with respect to time")
    vega: float = Field(..., description="Rate of change of option price with respect to volatility")
    rho: float = Field(..., description="Rate of change of option price with respect to risk-free rate")

    # Second-order Greeks
    vanna: Optional[float] = Field(None, description="Rate of change of delta with respect to volatility")
    charm: Optional[float] = Field(None, description="Rate of change of delta with respect to time")
    vomma: Optional[float] = Field(None, description="Rate of change of vega with respect to volatility")
    speed: Optional[float] = Field(None, description="Rate of change of gamma with respect to underlying price")
    zomma: Optional[float] = Field(None, description="Rate of change of gamma with respect to volatility")
    color: Optional[float] = Field(None, description="Rate of change of gamma with respect to time")


class OptionContract(BaseModel):
    """Single option contract specification"""
    symbol: str = Field(..., description="Underlying symbol")
    strike: float = Field(..., gt=0, description="Strike price")
    expiry: date = Field(..., description="Expiration date")
    option_type: OptionType = Field(..., description="Call or Put")
    exercise_style: ExerciseStyle = Field(ExerciseStyle.AMERICAN, description="American or European style")

    # Market data
    bid: Optional[float] = Field(None, ge=0, description="Bid price")
    ask: Optional[float] = Field(None, ge=0, description="Ask price")
    last: Optional[float] = Field(None, ge=0, description="Last traded price")
    volume: Optional[int] = Field(None, ge=0, description="Trading volume")
    open_interest: Optional[int] = Field(None, ge=0, description="Open interest")

    @validator('expiry')
    def expiry_must_be_future(cls, v):
        if v <= date.today():
            raise ValueError('Expiry date must be in the future')
        return v


class OptionPricingInput(BaseModel):
    """Input parameters for option pricing"""
    spot_price: float = Field(..., gt=0, description="Current price of underlying")
    strike_price: float = Field(..., gt=0, description="Strike price of option")
    time_to_expiry: float = Field(..., gt=0, le=10, description="Time to expiry in years")
    risk_free_rate: float = Field(..., ge=0, le=1, description="Risk-free interest rate")
    volatility: float = Field(..., gt=0, le=5, description="Annualized volatility")
    dividend_yield: float = Field(0, ge=0, le=1, description="Continuous dividend yield")
    option_type: OptionType = Field(..., description="Call or Put option")
    exercise_style: ExerciseStyle = Field(ExerciseStyle.EUROPEAN, description="Exercise style")

    # Binomial model specific
    steps: Optional[int] = Field(100, ge=10, le=1000, description="Number of steps for binomial model")

    # Monte Carlo specific
    simulations: Optional[int] = Field(10000, ge=1000, le=100000, description="Number of simulations")


class OptionPricingOutput(BaseModel):
    """Output from option pricing calculation"""
    price: float = Field(..., description="Option price")
    greeks: Greeks = Field(..., description="Option Greeks")
    model_used: PricingModel = Field(..., description="Pricing model used")

    # Additional metrics
    intrinsic_value: float = Field(..., description="Intrinsic value of option")
    time_value: float = Field(..., description="Time value of option")
    implied_volatility: Optional[float] = Field(None, description="Implied volatility if calculated")

    # Model diagnostics
    calculation_time_ms: float = Field(..., description="Calculation time in milliseconds")
    convergence_achieved: bool = Field(True, description="Whether model converged")
    error_estimate: Optional[float] = Field(None, description="Estimated pricing error")


class ImpliedVolatilityRequest(BaseModel):
    """Request for implied volatility calculation"""
    market_price: float = Field(..., gt=0, description="Market price of option")
    spot_price: float = Field(..., gt=0, description="Current price of underlying")
    strike_price: float = Field(..., gt=0, description="Strike price of option")
    time_to_expiry: float = Field(..., gt=0, le=10, description="Time to expiry in years")
    risk_free_rate: float = Field(..., ge=0, le=1, description="Risk-free interest rate")
    dividend_yield: float = Field(0, ge=0, le=1, description="Continuous dividend yield")
    option_type: OptionType = Field(..., description="Call or Put option")

    # Solver parameters
    method: VolatilityMethod = Field(VolatilityMethod.BRENT, description="Solver method")
    tolerance: float = Field(1e-6, gt=0, le=0.01, description="Convergence tolerance")
    max_iterations: int = Field(100, ge=10, le=1000, description="Maximum iterations")
    initial_guess: Optional[float] = Field(None, gt=0, le=5, description="Initial volatility guess")


class ImpliedVolatilityOutput(BaseModel):
    """Output from implied volatility calculation"""
    implied_volatility: float = Field(..., gt=0, le=5, description="Calculated implied volatility")
    iterations_used: int = Field(..., ge=0, description="Number of iterations used")
    convergence_achieved: bool = Field(..., description="Whether convergence was achieved")
    final_price: float = Field(..., description="Option price at calculated IV")
    price_error: float = Field(..., description="Difference between market and model price")
    calculation_time_ms: float = Field(..., description="Calculation time in milliseconds")


class OptionsChain(BaseModel):
    """Options chain for a specific expiry"""
    symbol: str = Field(..., description="Underlying symbol")
    expiry_date: date = Field(..., description="Expiration date")
    spot_price: float = Field(..., gt=0, description="Current underlying price")

    # Chain data
    calls: List[OptionContract] = Field(..., description="Call options")
    puts: List[OptionContract] = Field(..., description="Put options")

    # Market metrics
    total_call_volume: int = Field(..., ge=0, description="Total call volume")
    total_put_volume: int = Field(..., ge=0, description="Total put volume")
    put_call_ratio: float = Field(..., ge=0, description="Put/Call volume ratio")

    # Implied volatility metrics
    atm_iv: Optional[float] = Field(None, description="At-the-money implied volatility")
    iv_skew: Optional[float] = Field(None, description="Implied volatility skew")
    iv_term_structure: Optional[Dict[str, float]] = Field(None, description="IV by expiry")

    @validator('calls', 'puts')
    def sort_by_strike(cls, v):
        return sorted(v, key=lambda x: x.strike)


class VolatilitySurface(BaseModel):
    """Implied volatility surface data"""
    symbol: str = Field(..., description="Underlying symbol")
    calculation_time: datetime = Field(..., description="Calculation timestamp")
    spot_price: float = Field(..., gt=0, description="Current underlying price")

    # Surface dimensions
    strikes: List[float] = Field(..., description="Strike prices")
    expiries: List[date] = Field(..., description="Expiration dates")

    # Surface data (2D array: expiries x strikes)
    implied_volatilities: List[List[float]] = Field(..., description="IV surface matrix")

    # Surface metrics
    atm_term_structure: Dict[str, float] = Field(..., description="ATM IV by expiry")
    skew_by_expiry: Dict[str, float] = Field(..., description="Skew by expiry")

    # Risk metrics
    volatility_of_volatility: float = Field(..., description="Vol of vol")
    correlation_matrix: Optional[List[List[float]]] = Field(None, description="Strike-expiry correlation")


class OptionStrategy(BaseModel):
    """Options trading strategy definition"""
    name: str = Field(..., description="Strategy name")
    legs: List[Dict[str, Any]] = Field(..., min_items=1, max_items=4, description="Strategy legs")

    # Strategy metrics
    max_profit: Optional[float] = Field(None, description="Maximum profit potential")
    max_loss: Optional[float] = Field(None, description="Maximum loss potential")
    breakeven_points: List[float] = Field(..., description="Breakeven price points")

    # Greeks aggregation
    net_delta: float = Field(..., description="Net delta of strategy")
    net_gamma: float = Field(..., description="Net gamma of strategy")
    net_theta: float = Field(..., description="Net theta of strategy")
    net_vega: float = Field(..., description="Net vega of strategy")


class OptionsAnalyticsRequest(BaseModel):
    """Request for comprehensive options analytics"""
    symbol: str = Field(..., description="Underlying symbol")
    expiry: Optional[date] = Field(None, description="Specific expiry or None for all")
    strike: Optional[float] = Field(None, gt=0, description="Specific strike or None for all")
    option_type: Optional[OptionType] = Field(None, description="Specific type or None for both")

    # Analytics options
    calculate_greeks: bool = Field(True, description="Calculate Greeks")
    calculate_iv: bool = Field(True, description="Calculate implied volatility")
    include_surface: bool = Field(False, description="Include volatility surface")
    pricing_model: PricingModel = Field(PricingModel.BLACK_SCHOLES, description="Pricing model to use")

    # Market data
    use_real_time: bool = Field(True, description="Use real-time market data")
    risk_free_rate: Optional[float] = Field(None, description="Override risk-free rate")
    dividend_yield: Optional[float] = Field(None, description="Override dividend yield")


class OptionsAnalyticsResponse(BaseModel):
    """Response from options analytics calculation"""
    symbol: str = Field(..., description="Underlying symbol")
    spot_price: float = Field(..., description="Current underlying price")
    calculation_time: datetime = Field(..., description="Calculation timestamp")

    # Chain data
    chains: List[OptionsChain] = Field(..., description="Options chains by expiry")

    # Pricing results
    pricing_results: Optional[List[OptionPricingOutput]] = Field(None, description="Pricing calculations")

    # Volatility analysis
    volatility_surface: Optional[VolatilitySurface] = Field(None, description="IV surface")

    # Market metrics
    total_volume: int = Field(..., description="Total options volume")
    total_open_interest: int = Field(..., description="Total open interest")
    put_call_ratio: float = Field(..., description="Overall put/call ratio")

    # Risk metrics
    aggregate_greeks: Optional[Greeks] = Field(None, description="Portfolio-level Greeks")
    var_95: Optional[float] = Field(None, description="95% Value at Risk")
    expected_move: Optional[float] = Field(None, description="Expected price move based on IV")