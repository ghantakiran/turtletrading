"""
Alpha Vantage service for fallback stock data
"""

import asyncio
import aiohttp
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import pandas as pd
from loguru import logger

from app.services.base_service import BaseService
from app.models.stock_schemas import StockPrice
from app.core.config import settings
from app.core.external_rate_limiting import rate_limit_external_api


class AlphaVantageService(BaseService):
    """Alpha Vantage API service for stock data fallback"""

    def __init__(self):
        super().__init__()
        self.api_key = settings.ALPHA_VANTAGE_API_KEY
        self.base_url = "https://www.alphavantage.co/query"
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session

    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()

    @rate_limit_external_api("alpha_vantage", lambda self, symbol, *args, **kwargs: symbol)
    async def _make_api_request(self, params: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Make rate-limited API request to Alpha Vantage"""
        if not self.api_key:
            logger.warning("Alpha Vantage API key not configured")
            return None

        try:
            session = await self._get_session()
            params['apikey'] = self.api_key

            async with session.get(self.base_url, params=params) as response:
                if response.status == 200:
                    data = await response.json()

                    # Check for API errors
                    if "Error Message" in data:
                        logger.error(f"Alpha Vantage API error: {data['Error Message']}")
                        return None

                    if "Note" in data and "API call frequency" in data["Note"]:
                        logger.warning(f"Alpha Vantage rate limit hit: {data['Note']}")
                        return None

                    return data
                else:
                    logger.error(f"Alpha Vantage API request failed: {response.status}")
                    return None

        except Exception as e:
            logger.error(f"Alpha Vantage API request exception: {e}")
            return None

    async def get_quote(self, symbol: str) -> Optional[StockPrice]:
        """Get current stock quote from Alpha Vantage"""
        symbol = self.validate_symbol(symbol)
        cache_key = self.create_cache_key("av_quote", symbol)

        async def fetch_quote():
            try:
                params = {
                    'function': 'GLOBAL_QUOTE',
                    'symbol': symbol
                }

                data = await self._make_api_request(params)
                if not data or 'Global Quote' not in data:
                    return None

                quote = data['Global Quote']

                # Extract values with safe conversion
                current_price = self.safe_float_extract(quote.get('05. price', 0))
                previous_close = self.safe_float_extract(quote.get('08. previous close', 0))
                change = self.safe_float_extract(quote.get('09. change', 0))
                change_percent_str = quote.get('10. change percent', '0%').replace('%', '')
                change_percent = self.safe_float_extract(change_percent_str)

                # Get additional data
                high = self.safe_float_extract(quote.get('03. high', 0))
                low = self.safe_float_extract(quote.get('04. low', 0))
                volume = int(self.safe_float_extract(quote.get('06. volume', 0)))

                return StockPrice(
                    symbol=symbol,
                    current_price=current_price,
                    previous_close=previous_close,
                    change=self.format_percentage(change),
                    change_percent=self.format_percentage(change_percent),
                    day_high=high,
                    day_low=low,
                    volume=volume,
                    market_cap=None,  # Not available in basic quote
                    timestamp=datetime.utcnow()
                )

            except Exception as e:
                logger.error(f"Error fetching Alpha Vantage quote for {symbol}: {e}")
                return None

        # Cache for 1 minute
        return await self.get_or_set_cache(cache_key, fetch_quote, ttl=60)

    async def get_daily_data(self, symbol: str, outputsize: str = "compact") -> Optional[pd.DataFrame]:
        """Get daily historical data from Alpha Vantage"""
        symbol = self.validate_symbol(symbol)
        cache_key = self.create_cache_key("av_daily", symbol, outputsize)

        async def fetch_daily():
            try:
                params = {
                    'function': 'TIME_SERIES_DAILY',
                    'symbol': symbol,
                    'outputsize': outputsize  # compact (last 100 days) or full
                }

                data = await self._make_api_request(params)
                if not data or 'Time Series (Daily)' not in data:
                    return None

                time_series = data['Time Series (Daily)']

                # Convert to DataFrame
                df_data = []
                for date_str, values in time_series.items():
                    df_data.append({
                        'Date': pd.to_datetime(date_str),
                        'Open': float(values['1. open']),
                        'High': float(values['2. high']),
                        'Low': float(values['3. low']),
                        'Close': float(values['4. close']),
                        'Volume': int(values['5. volume'])
                    })

                df = pd.DataFrame(df_data)
                df.set_index('Date', inplace=True)
                df.sort_index(inplace=True)

                return df

            except Exception as e:
                logger.error(f"Error fetching Alpha Vantage daily data for {symbol}: {e}")
                return None

        # Cache for 5 minutes
        return await self.get_or_set_cache(cache_key, fetch_daily, ttl=300)

    async def get_intraday_data(self, symbol: str, interval: str = "5min") -> Optional[pd.DataFrame]:
        """Get intraday data from Alpha Vantage"""
        symbol = self.validate_symbol(symbol)
        cache_key = self.create_cache_key("av_intraday", symbol, interval)

        async def fetch_intraday():
            try:
                params = {
                    'function': 'TIME_SERIES_INTRADAY',
                    'symbol': symbol,
                    'interval': interval,
                    'outputsize': 'compact'
                }

                data = await self._make_api_request(params)
                series_key = f'Time Series ({interval})'

                if not data or series_key not in data:
                    return None

                time_series = data[series_key]

                # Convert to DataFrame
                df_data = []
                for datetime_str, values in time_series.items():
                    df_data.append({
                        'Date': pd.to_datetime(datetime_str),
                        'Open': float(values['1. open']),
                        'High': float(values['2. high']),
                        'Low': float(values['3. low']),
                        'Close': float(values['4. close']),
                        'Volume': int(values['5. volume'])
                    })

                df = pd.DataFrame(df_data)
                df.set_index('Date', inplace=True)
                df.sort_index(inplace=True)

                return df

            except Exception as e:
                logger.error(f"Error fetching Alpha Vantage intraday data for {symbol}: {e}")
                return None

        # Cache for 1 minute for intraday data
        return await self.get_or_set_cache(cache_key, fetch_intraday, ttl=60)

    async def get_company_overview(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get company overview from Alpha Vantage"""
        symbol = self.validate_symbol(symbol)
        cache_key = self.create_cache_key("av_overview", symbol)

        async def fetch_overview():
            try:
                params = {
                    'function': 'OVERVIEW',
                    'symbol': symbol
                }

                data = await self._make_api_request(params)
                if not data or not data.get('Symbol'):
                    return None

                return data

            except Exception as e:
                logger.error(f"Error fetching Alpha Vantage overview for {symbol}: {e}")
                return None

        # Cache for 1 hour
        return await self.get_or_set_cache(cache_key, fetch_overview, ttl=3600)

    async def health_check(self) -> bool:
        """Check if Alpha Vantage API is available"""
        if not self.api_key:
            return False

        try:
            # Simple API test with a lightweight request
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': 'AAPL'
            }

            data = await self._make_api_request(params)
            return data is not None and 'Global Quote' in data

        except Exception as e:
            logger.error(f"Alpha Vantage health check failed: {e}")
            return False

    def is_configured(self) -> bool:
        """Check if Alpha Vantage is properly configured"""
        return self.api_key is not None and len(self.api_key) > 0


# Global instance
alpha_vantage_service = AlphaVantageService()