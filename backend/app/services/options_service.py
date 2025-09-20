"""
Options Analytics Service

Provides comprehensive options analytics including pricing, Greeks calculation,
implied volatility analysis, and options chain management.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
import yfinance as yf
import numpy as np
import pandas as pd

from ..models.options_models import (
    OptionType, ExerciseStyle, PricingModel,
    OptionContract, OptionsChain, OptionPricingInput, OptionPricingOutput,
    ImpliedVolatilityRequest, ImpliedVolatilityOutput,
    VolatilitySurface, OptionsAnalyticsRequest, OptionsAnalyticsResponse,
    Greeks
)
from ..core.options_pricing import OptionsPricingEngine
from ..services.stock_service import StockService

logger = logging.getLogger(__name__)


class OptionsDataProvider:
    """Fetches options market data from various sources"""

    def __init__(self):
        self.stock_service = StockService()

    async def fetch_options_chain(self, symbol: str, expiry: Optional[date] = None) -> List[OptionsChain]:
        """Fetch options chain data for a symbol"""

        try:
            ticker = yf.Ticker(symbol)

            # Get available expiration dates
            expirations = ticker.options

            if not expirations:
                logger.warning(f"No options data available for {symbol}")
                return []

            # Filter by specific expiry if provided
            if expiry:
                expiry_str = expiry.strftime("%Y-%m-%d")
                if expiry_str not in expirations:
                    logger.warning(f"Expiry {expiry_str} not available for {symbol}")
                    return []
                expirations = [expiry_str]

            chains = []
            spot_price = await self._get_spot_price(symbol)

            for exp_str in expirations[:5]:  # Limit to 5 nearest expiries
                try:
                    # Fetch options data
                    opt_chain = ticker.option_chain(exp_str)

                    # Parse calls
                    calls = self._parse_options_data(
                        opt_chain.calls, symbol, exp_str, OptionType.CALL
                    )

                    # Parse puts
                    puts = self._parse_options_data(
                        opt_chain.puts, symbol, exp_str, OptionType.PUT
                    )

                    # Calculate metrics
                    total_call_volume = sum(c.volume or 0 for c in calls)
                    total_put_volume = sum(p.volume or 0 for p in puts)
                    put_call_ratio = total_put_volume / max(total_call_volume, 1)

                    # Find ATM IV
                    atm_iv = self._calculate_atm_iv(calls, puts, spot_price)

                    chain = OptionsChain(
                        symbol=symbol,
                        expiry_date=datetime.strptime(exp_str, "%Y-%m-%d").date(),
                        spot_price=spot_price,
                        calls=calls,
                        puts=puts,
                        total_call_volume=total_call_volume,
                        total_put_volume=total_put_volume,
                        put_call_ratio=put_call_ratio,
                        atm_iv=atm_iv
                    )

                    chains.append(chain)

                except Exception as e:
                    logger.error(f"Error fetching chain for {symbol} expiry {exp_str}: {e}")
                    continue

            return chains

        except Exception as e:
            logger.error(f"Error fetching options data for {symbol}: {e}")
            return []

    def _parse_options_data(self, df: pd.DataFrame, symbol: str, expiry_str: str,
                           option_type: OptionType) -> List[OptionContract]:
        """Parse options data from DataFrame"""

        options = []
        expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").date()

        for _, row in df.iterrows():
            try:
                contract = OptionContract(
                    symbol=symbol,
                    strike=float(row.get('strike', 0)),
                    expiry=expiry_date,
                    option_type=option_type,
                    bid=float(row.get('bid', 0)) if pd.notna(row.get('bid')) else None,
                    ask=float(row.get('ask', 0)) if pd.notna(row.get('ask')) else None,
                    last=float(row.get('lastPrice', 0)) if pd.notna(row.get('lastPrice')) else None,
                    volume=int(row.get('volume', 0)) if pd.notna(row.get('volume')) else None,
                    open_interest=int(row.get('openInterest', 0)) if pd.notna(row.get('openInterest')) else None
                )

                # Skip if expiry is in the past
                if contract.expiry > date.today():
                    options.append(contract)

            except Exception as e:
                logger.debug(f"Error parsing option contract: {e}")
                continue

        return options

    async def _get_spot_price(self, symbol: str) -> float:
        """Get current spot price for underlying"""

        stock_price = await self.stock_service.get_current_price(symbol)
        if stock_price:
            return stock_price.current

        # Fallback to yfinance
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            return float(info.get('regularMarketPrice', info.get('previousClose', 100)))
        except:
            return 100.0  # Default fallback

    def _calculate_atm_iv(self, calls: List[OptionContract], puts: List[OptionContract],
                         spot_price: float) -> Optional[float]:
        """Calculate at-the-money implied volatility"""

        # Find closest strike to spot
        all_options = calls + puts
        if not all_options:
            return None

        closest_option = min(all_options, key=lambda x: abs(x.strike - spot_price))

        # For now, return a mock IV (would calculate from market price)
        # In production, would use ImpliedVolatilitySolver
        return 0.25  # 25% implied volatility


class OptionsAnalyticsService:
    """Main service for options analytics"""

    def __init__(self):
        self.data_provider = OptionsDataProvider()
        self.pricing_engine = OptionsPricingEngine()
        self.stock_service = StockService()

        # Market parameters (would fetch from external source)
        self.risk_free_rate = 0.05  # 5% risk-free rate
        self.dividend_yield = 0.02  # 2% dividend yield

    async def get_options_analytics(self, request: OptionsAnalyticsRequest) -> OptionsAnalyticsResponse:
        """Get comprehensive options analytics for a symbol"""

        start_time = datetime.now()

        # Fetch options chains
        chains = await self.data_provider.fetch_options_chain(request.symbol, request.expiry)

        if not chains:
            logger.warning(f"No options data available for {request.symbol}")
            return self._create_empty_response(request.symbol)

        # Get spot price
        spot_price = chains[0].spot_price if chains else 100.0

        # Override market parameters if provided
        risk_free_rate = request.risk_free_rate or self.risk_free_rate
        dividend_yield = request.dividend_yield or self.dividend_yield

        # Calculate pricing if requested
        pricing_results = []
        if request.calculate_greeks:
            pricing_results = await self._calculate_pricing_for_chains(
                chains, spot_price, risk_free_rate, dividend_yield,
                request.pricing_model, request.strike, request.option_type
            )

        # Calculate volatility surface if requested
        volatility_surface = None
        if request.include_surface and request.calculate_iv:
            volatility_surface = await self._calculate_volatility_surface(
                chains, spot_price, risk_free_rate, dividend_yield
            )

        # Calculate aggregate metrics
        total_volume = sum(c.total_call_volume + c.total_put_volume for c in chains)
        total_oi = sum(
            sum(opt.open_interest or 0 for opt in c.calls + c.puts)
            for c in chains
        )

        overall_pcr = sum(c.total_put_volume for c in chains) / \
                     max(sum(c.total_call_volume for c in chains), 1)

        # Calculate aggregate Greeks
        aggregate_greeks = self._aggregate_greeks(pricing_results) if pricing_results else None

        # Calculate expected move based on ATM IV
        expected_move = None
        if chains and chains[0].atm_iv:
            days_to_expiry = (chains[0].expiry_date - date.today()).days
            expected_move = spot_price * chains[0].atm_iv * np.sqrt(days_to_expiry / 365)

        return OptionsAnalyticsResponse(
            symbol=request.symbol,
            spot_price=spot_price,
            calculation_time=start_time,
            chains=chains,
            pricing_results=pricing_results if pricing_results else None,
            volatility_surface=volatility_surface,
            total_volume=total_volume,
            total_open_interest=total_oi,
            put_call_ratio=overall_pcr,
            aggregate_greeks=aggregate_greeks,
            expected_move=expected_move
        )

    async def _calculate_pricing_for_chains(
        self, chains: List[OptionsChain], spot_price: float,
        risk_free_rate: float, dividend_yield: float,
        pricing_model: PricingModel,
        strike_filter: Optional[float] = None,
        type_filter: Optional[OptionType] = None
    ) -> List[OptionPricingOutput]:
        """Calculate pricing for options in chains"""

        pricing_results = []

        for chain in chains[:2]:  # Limit to first 2 expiries for performance
            days_to_expiry = (chain.expiry_date - date.today()).days
            time_to_expiry = days_to_expiry / 365.0

            if time_to_expiry <= 0:
                continue

            # Process calls
            if type_filter != OptionType.PUT:
                for call in chain.calls:
                    if strike_filter and abs(call.strike - strike_filter) > 0.01:
                        continue

                    input_params = OptionPricingInput(
                        spot_price=spot_price,
                        strike_price=call.strike,
                        time_to_expiry=time_to_expiry,
                        risk_free_rate=risk_free_rate,
                        volatility=chain.atm_iv or 0.25,
                        dividend_yield=dividend_yield,
                        option_type=OptionType.CALL,
                        exercise_style=call.exercise_style
                    )

                    result = self.pricing_engine.price_option(input_params)
                    pricing_results.append(result)

            # Process puts
            if type_filter != OptionType.CALL:
                for put in chain.puts:
                    if strike_filter and abs(put.strike - strike_filter) > 0.01:
                        continue

                    input_params = OptionPricingInput(
                        spot_price=spot_price,
                        strike_price=put.strike,
                        time_to_expiry=time_to_expiry,
                        risk_free_rate=risk_free_rate,
                        volatility=chain.atm_iv or 0.25,
                        dividend_yield=dividend_yield,
                        option_type=OptionType.PUT,
                        exercise_style=put.exercise_style
                    )

                    result = self.pricing_engine.price_option(input_params)
                    pricing_results.append(result)

        return pricing_results

    async def _calculate_volatility_surface(
        self, chains: List[OptionsChain], spot_price: float,
        risk_free_rate: float, dividend_yield: float
    ) -> VolatilitySurface:
        """Calculate implied volatility surface"""

        strikes = []
        expiries = []
        iv_matrix = []

        # Collect unique strikes across all chains
        all_strikes = set()
        for chain in chains:
            all_strikes.update([c.strike for c in chain.calls])
            all_strikes.update([p.strike for p in chain.puts])

        strikes = sorted(list(all_strikes))

        # Limit strikes around ATM
        atm_strike = min(strikes, key=lambda x: abs(x - spot_price))
        strike_range = [s for s in strikes if 0.8 * spot_price <= s <= 1.2 * spot_price]
        strikes = sorted(strike_range)[:10]  # Limit to 10 strikes

        # Build IV matrix
        for chain in chains[:5]:  # Limit to 5 expiries
            expiries.append(chain.expiry_date)
            iv_row = []

            for strike in strikes:
                # Find option at this strike
                call = next((c for c in chain.calls if abs(c.strike - strike) < 0.01), None)
                put = next((p for p in chain.puts if abs(p.strike - strike) < 0.01), None)

                # Calculate IV (mock for now)
                if call and call.last:
                    # Would calculate actual IV from market price
                    iv = chain.atm_iv or 0.25
                elif put and put.last:
                    iv = chain.atm_iv or 0.25
                else:
                    iv = 0.25

                iv_row.append(iv)

            iv_matrix.append(iv_row)

        # Calculate surface metrics
        atm_term_structure = {
            exp.strftime("%Y-%m-%d"): chain.atm_iv or 0.25
            for exp, chain in zip(expiries, chains[:5])
        }

        skew_by_expiry = {
            exp.strftime("%Y-%m-%d"): 0.02  # Mock skew
            for exp in expiries
        }

        return VolatilitySurface(
            symbol=chains[0].symbol,
            calculation_time=datetime.now(),
            spot_price=spot_price,
            strikes=strikes,
            expiries=expiries,
            implied_volatilities=iv_matrix,
            atm_term_structure=atm_term_structure,
            skew_by_expiry=skew_by_expiry,
            volatility_of_volatility=0.15  # Mock vol of vol
        )

    def _aggregate_greeks(self, pricing_results: List[OptionPricingOutput]) -> Greeks:
        """Aggregate Greeks across all options"""

        if not pricing_results:
            return Greeks(delta=0, gamma=0, theta=0, vega=0, rho=0)

        total_delta = sum(r.greeks.delta for r in pricing_results)
        total_gamma = sum(r.greeks.gamma for r in pricing_results)
        total_theta = sum(r.greeks.theta for r in pricing_results)
        total_vega = sum(r.greeks.vega for r in pricing_results)
        total_rho = sum(r.greeks.rho for r in pricing_results)

        return Greeks(
            delta=total_delta,
            gamma=total_gamma,
            theta=total_theta,
            vega=total_vega,
            rho=total_rho
        )

    def _create_empty_response(self, symbol: str) -> OptionsAnalyticsResponse:
        """Create empty response when no data available"""

        return OptionsAnalyticsResponse(
            symbol=symbol,
            spot_price=0,
            calculation_time=datetime.now(),
            chains=[],
            total_volume=0,
            total_open_interest=0,
            put_call_ratio=0
        )

    async def calculate_implied_volatility(
        self, request: ImpliedVolatilityRequest
    ) -> ImpliedVolatilityOutput:
        """Calculate implied volatility for a specific option"""

        return self.pricing_engine.calculate_implied_volatility(request)

    async def price_option(self, input_params: OptionPricingInput) -> OptionPricingOutput:
        """Price a single option"""

        return self.pricing_engine.price_option(input_params)