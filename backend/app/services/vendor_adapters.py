"""
Vendor-Specific Adapters

Concrete implementations of vendor adapters for Yahoo Finance, Alpha Vantage,
IEX Cloud, and Polygon with standardized interfaces and error handling.
"""

import asyncio
import json
import hashlib
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
import uuid

import aiohttp
import yfinance as yf
from redis.asyncio import Redis

from app.services.vendor_abstraction import VendorAdapter, DataRequest, DataResponse
from app.models.vendor_models import (
    VendorRegistry, RequestType, VendorStatus
)
from app.core.logging import get_logger

logger = get_logger(__name__)


class YahooFinanceAdapter(VendorAdapter):
    """Yahoo Finance data vendor adapter."""

    def __init__(self, vendor_registry: VendorRegistry, redis_client: Redis):
        super().__init__(vendor_registry, redis_client)
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session

    async def fetch_data(self, request: DataRequest) -> DataResponse:
        """Fetch data from Yahoo Finance."""
        start_time = datetime.utcnow()
        request_id = str(uuid.uuid4())

        try:
            if request.request_type == RequestType.QUOTE:
                data = await self._fetch_quote(request)
            elif request.request_type == RequestType.HISTORICAL:
                data = await self._fetch_historical(request)
            elif request.request_type == RequestType.INTRADAY:
                data = await self._fetch_intraday(request)
            else:
                raise ValueError(f"Unsupported request type: {request.request_type}")

            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return DataResponse(
                success=True,
                vendor_id=self.vendor_id,
                request_id=request_id,
                data=data,
                response_time_ms=response_time_ms,
                data_timestamp=datetime.utcnow(),
                request_cost=self.calculate_request_cost(request),
                data_quality_score=0.85,  # Yahoo Finance generally high quality
                data_freshness_seconds=0  # Real-time data
            )

        except Exception as e:
            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            self.logger.error(f"Yahoo Finance request failed: {e}")

            return DataResponse(
                success=False,
                vendor_id=self.vendor_id,
                request_id=request_id,
                error=str(e),
                response_time_ms=response_time_ms,
                request_cost=0.0
            )

    async def _fetch_quote(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch real-time quote data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for quote request")

        # Use asyncio to run yfinance in thread pool
        def get_ticker_info():
            ticker = yf.Ticker(symbol)
            info = ticker.info
            history = ticker.history(period="1d", interval="1m")

            if history.empty:
                raise ValueError(f"No data available for symbol: {symbol}")

            latest = history.iloc[-1]

            return {
                'symbol': symbol,
                'price': float(latest['Close']),
                'open': float(latest['Open']),
                'high': float(latest['High']),
                'low': float(latest['Low']),
                'volume': int(latest['Volume']),
                'previous_close': info.get('previousClose', float(latest['Close'])),
                'change': float(latest['Close']) - info.get('previousClose', float(latest['Close'])),
                'change_percent': ((float(latest['Close']) - info.get('previousClose', float(latest['Close']))) / info.get('previousClose', float(latest['Close']))) * 100,
                'market_cap': info.get('marketCap'),
                'avg_volume': info.get('averageVolume'),
                'pe_ratio': info.get('trailingPE'),
                'timestamp': datetime.utcnow().isoformat()
            }

        data = await asyncio.get_event_loop().run_in_executor(None, get_ticker_info)
        return data

    async def _fetch_historical(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch historical price data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for historical request")

        def get_historical_data():
            ticker = yf.Ticker(symbol)

            # Determine period
            if request.start_date and request.end_date:
                history = ticker.history(start=request.start_date, end=request.end_date)
            else:
                # Default to 1 year
                history = ticker.history(period="1y")

            if history.empty:
                raise ValueError(f"No historical data available for symbol: {symbol}")

            # Convert to list of dicts
            data_points = []
            for date, row in history.iterrows():
                data_points.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume'])
                })

            return {
                'symbol': symbol,
                'data': data_points,
                'count': len(data_points),
                'period': f"{request.start_date} to {request.end_date}" if request.start_date else "1y"
            }

        data = await asyncio.get_event_loop().run_in_executor(None, get_historical_data)
        return data

    async def _fetch_intraday(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch intraday price data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for intraday request")

        interval = request.interval or "5m"

        def get_intraday_data():
            ticker = yf.Ticker(symbol)
            history = ticker.history(period="1d", interval=interval)

            if history.empty:
                raise ValueError(f"No intraday data available for symbol: {symbol}")

            # Convert to list of dicts
            data_points = []
            for timestamp, row in history.iterrows():
                data_points.append({
                    'timestamp': timestamp.isoformat(),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume'])
                })

            return {
                'symbol': symbol,
                'interval': interval,
                'data': data_points,
                'count': len(data_points)
            }

        data = await asyncio.get_event_loop().run_in_executor(None, get_intraday_data)
        return data

    async def health_check(self) -> bool:
        """Check Yahoo Finance API health."""
        try:
            # Try to fetch info for a well-known stock
            def health_test():
                ticker = yf.Ticker("AAPL")
                info = ticker.info
                return info.get('symbol') == 'AAPL'

            result = await asyncio.get_event_loop().run_in_executor(None, health_test)
            return result
        except Exception as e:
            self.logger.error(f"Yahoo Finance health check failed: {e}")
            return False

    def get_supported_request_types(self) -> List[RequestType]:
        """Get supported request types."""
        return [RequestType.QUOTE, RequestType.HISTORICAL, RequestType.INTRADAY]

    def calculate_request_cost(self, request: DataRequest) -> float:
        """Calculate request cost (Yahoo Finance is free)."""
        return 0.0

    async def close(self):
        """Clean up resources."""
        if self.session and not self.session.closed:
            await self.session.close()


class AlphaVantageAdapter(VendorAdapter):
    """Alpha Vantage data vendor adapter."""

    def __init__(self, vendor_registry: VendorRegistry, redis_client: Redis):
        super().__init__(vendor_registry, redis_client)
        self.api_key = vendor_registry.credentials.api_key
        self.base_url = vendor_registry.base_url or "https://www.alphavantage.co/query"
        self.session: Optional[aiohttp.ClientSession] = None

        if not self.api_key:
            raise ValueError("Alpha Vantage API key is required")

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session

    async def fetch_data(self, request: DataRequest) -> DataResponse:
        """Fetch data from Alpha Vantage."""
        start_time = datetime.utcnow()
        request_id = str(uuid.uuid4())

        try:
            if request.request_type == RequestType.QUOTE:
                data = await self._fetch_quote(request)
            elif request.request_type == RequestType.HISTORICAL:
                data = await self._fetch_daily(request)
            elif request.request_type == RequestType.INTRADAY:
                data = await self._fetch_intraday(request)
            elif request.request_type == RequestType.FUNDAMENTALS:
                data = await self._fetch_overview(request)
            else:
                raise ValueError(f"Unsupported request type: {request.request_type}")

            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return DataResponse(
                success=True,
                vendor_id=self.vendor_id,
                request_id=request_id,
                data=data,
                response_time_ms=response_time_ms,
                data_timestamp=datetime.utcnow(),
                request_cost=self.calculate_request_cost(request),
                data_quality_score=0.90,  # Alpha Vantage high quality
                data_freshness_seconds=300  # 5 minute delay
            )

        except Exception as e:
            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            self.logger.error(f"Alpha Vantage request failed: {e}")

            return DataResponse(
                success=False,
                vendor_id=self.vendor_id,
                request_id=request_id,
                error=str(e),
                response_time_ms=response_time_ms,
                request_cost=self.calculate_request_cost(request)
            )

    async def _fetch_quote(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch real-time quote data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for quote request")

        session = await self._get_session()
        params = {
            'function': 'GLOBAL_QUOTE',
            'symbol': symbol,
            'apikey': self.api_key
        }

        async with session.get(self.base_url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"Alpha Vantage API error: {response.status}")

            data = await response.json()

            if 'Error Message' in data:
                raise ValueError(f"Alpha Vantage error: {data['Error Message']}")

            if 'Note' in data:
                raise ValueError(f"Alpha Vantage rate limit: {data['Note']}")

            quote_data = data.get('Global Quote', {})
            if not quote_data:
                raise ValueError("No quote data returned")

            return {
                'symbol': quote_data.get('01. symbol'),
                'price': float(quote_data.get('05. price', 0)),
                'open': float(quote_data.get('02. open', 0)),
                'high': float(quote_data.get('03. high', 0)),
                'low': float(quote_data.get('04. low', 0)),
                'volume': int(quote_data.get('06. volume', 0)),
                'previous_close': float(quote_data.get('08. previous close', 0)),
                'change': float(quote_data.get('09. change', 0)),
                'change_percent': quote_data.get('10. change percent', '0%').rstrip('%'),
                'latest_trading_day': quote_data.get('07. latest trading day'),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _fetch_daily(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch daily historical data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for daily request")

        session = await self._get_session()
        params = {
            'function': 'TIME_SERIES_DAILY',
            'symbol': symbol,
            'apikey': self.api_key,
            'outputsize': 'full'  # Get full historical data
        }

        async with session.get(self.base_url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"Alpha Vantage API error: {response.status}")

            data = await response.json()

            if 'Error Message' in data:
                raise ValueError(f"Alpha Vantage error: {data['Error Message']}")

            if 'Note' in data:
                raise ValueError(f"Alpha Vantage rate limit: {data['Note']}")

            time_series = data.get('Time Series (Daily)', {})
            if not time_series:
                raise ValueError("No daily data returned")

            # Convert to standardized format
            data_points = []
            for date, values in time_series.items():
                data_points.append({
                    'date': date,
                    'open': float(values['1. open']),
                    'high': float(values['2. high']),
                    'low': float(values['3. low']),
                    'close': float(values['4. close']),
                    'volume': int(values['5. volume'])
                })

            # Sort by date
            data_points.sort(key=lambda x: x['date'])

            return {
                'symbol': symbol,
                'data': data_points,
                'count': len(data_points),
                'source': 'alpha_vantage_daily'
            }

    async def _fetch_intraday(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch intraday data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for intraday request")

        interval = request.interval or "5min"

        session = await self._get_session()
        params = {
            'function': 'TIME_SERIES_INTRADAY',
            'symbol': symbol,
            'interval': interval,
            'apikey': self.api_key,
            'outputsize': 'full'
        }

        async with session.get(self.base_url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"Alpha Vantage API error: {response.status}")

            data = await response.json()

            if 'Error Message' in data:
                raise ValueError(f"Alpha Vantage error: {data['Error Message']}")

            if 'Note' in data:
                raise ValueError(f"Alpha Vantage rate limit: {data['Note']}")

            time_series_key = f'Time Series ({interval})'
            time_series = data.get(time_series_key, {})
            if not time_series:
                raise ValueError("No intraday data returned")

            # Convert to standardized format
            data_points = []
            for timestamp, values in time_series.items():
                data_points.append({
                    'timestamp': timestamp,
                    'open': float(values['1. open']),
                    'high': float(values['2. high']),
                    'low': float(values['3. low']),
                    'close': float(values['4. close']),
                    'volume': int(values['5. volume'])
                })

            # Sort by timestamp
            data_points.sort(key=lambda x: x['timestamp'])

            return {
                'symbol': symbol,
                'interval': interval,
                'data': data_points,
                'count': len(data_points),
                'source': 'alpha_vantage_intraday'
            }

    async def _fetch_overview(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch company overview/fundamentals."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for overview request")

        session = await self._get_session()
        params = {
            'function': 'OVERVIEW',
            'symbol': symbol,
            'apikey': self.api_key
        }

        async with session.get(self.base_url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"Alpha Vantage API error: {response.status}")

            data = await response.json()

            if 'Error Message' in data:
                raise ValueError(f"Alpha Vantage error: {data['Error Message']}")

            if 'Note' in data:
                raise ValueError(f"Alpha Vantage rate limit: {data['Note']}")

            if not data or not data.get('Symbol'):
                raise ValueError("No overview data returned")

            return {
                'symbol': data.get('Symbol'),
                'name': data.get('Name'),
                'description': data.get('Description'),
                'sector': data.get('Sector'),
                'industry': data.get('Industry'),
                'market_cap': data.get('MarketCapitalization'),
                'pe_ratio': data.get('PERatio'),
                'peg_ratio': data.get('PEGRatio'),
                'book_value': data.get('BookValue'),
                'dividend_yield': data.get('DividendYield'),
                'eps': data.get('EPS'),
                'revenue_ttm': data.get('RevenueTTM'),
                'profit_margin': data.get('ProfitMargin'),
                'beta': data.get('Beta'),
                '52_week_high': data.get('52WeekHigh'),
                '52_week_low': data.get('52WeekLow'),
                'analyst_target_price': data.get('AnalystTargetPrice'),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def health_check(self) -> bool:
        """Check Alpha Vantage API health."""
        try:
            session = await self._get_session()
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': 'AAPL',
                'apikey': self.api_key
            }

            async with session.get(self.base_url, params=params) as response:
                if response.status != 200:
                    return False

                data = await response.json()

                # Check if we get valid data (not just error messages)
                return 'Global Quote' in data and not ('Error Message' in data or 'Note' in data)

        except Exception as e:
            self.logger.error(f"Alpha Vantage health check failed: {e}")
            return False

    def get_supported_request_types(self) -> List[RequestType]:
        """Get supported request types."""
        return [RequestType.QUOTE, RequestType.HISTORICAL, RequestType.INTRADAY, RequestType.FUNDAMENTALS]

    def calculate_request_cost(self, request: DataRequest) -> float:
        """Calculate request cost based on Alpha Vantage pricing."""
        # Simplified cost model - adjust based on actual pricing
        base_costs = {
            RequestType.QUOTE: 0.01,
            RequestType.HISTORICAL: 0.05,
            RequestType.INTRADAY: 0.03,
            RequestType.FUNDAMENTALS: 0.02
        }
        return base_costs.get(request.request_type, 0.01)

    async def close(self):
        """Clean up resources."""
        if self.session and not self.session.closed:
            await self.session.close()


class IEXCloudAdapter(VendorAdapter):
    """IEX Cloud data vendor adapter."""

    def __init__(self, vendor_registry: VendorRegistry, redis_client: Redis):
        super().__init__(vendor_registry, redis_client)
        self.api_key = vendor_registry.credentials.api_key
        self.base_url = vendor_registry.base_url or "https://cloud.iexapis.com/stable"
        self.session: Optional[aiohttp.ClientSession] = None

        if not self.api_key:
            raise ValueError("IEX Cloud API key is required")

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session

    async def fetch_data(self, request: DataRequest) -> DataResponse:
        """Fetch data from IEX Cloud."""
        start_time = datetime.utcnow()
        request_id = str(uuid.uuid4())

        try:
            if request.request_type == RequestType.QUOTE:
                data = await self._fetch_quote(request)
            elif request.request_type == RequestType.HISTORICAL:
                data = await self._fetch_historical(request)
            elif request.request_type == RequestType.FUNDAMENTALS:
                data = await self._fetch_stats(request)
            else:
                raise ValueError(f"Unsupported request type: {request.request_type}")

            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return DataResponse(
                success=True,
                vendor_id=self.vendor_id,
                request_id=request_id,
                data=data,
                response_time_ms=response_time_ms,
                data_timestamp=datetime.utcnow(),
                request_cost=self.calculate_request_cost(request),
                data_quality_score=0.95,  # IEX Cloud very high quality
                data_freshness_seconds=0  # Real-time data
            )

        except Exception as e:
            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            self.logger.error(f"IEX Cloud request failed: {e}")

            return DataResponse(
                success=False,
                vendor_id=self.vendor_id,
                request_id=request_id,
                error=str(e),
                response_time_ms=response_time_ms,
                request_cost=self.calculate_request_cost(request)
            )

    async def _fetch_quote(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch real-time quote data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for quote request")

        session = await self._get_session()
        url = f"{self.base_url}/stock/{symbol}/quote"
        params = {'token': self.api_key}

        async with session.get(url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"IEX Cloud API error: {response.status}")

            data = await response.json()

            return {
                'symbol': data.get('symbol'),
                'price': data.get('latestPrice'),
                'open': data.get('open'),
                'high': data.get('high'),
                'low': data.get('low'),
                'volume': data.get('volume'),
                'previous_close': data.get('previousClose'),
                'change': data.get('change'),
                'change_percent': data.get('changePercent', 0) * 100,
                'market_cap': data.get('marketCap'),
                'pe_ratio': data.get('peRatio'),
                'latest_time': data.get('latestTime'),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _fetch_historical(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch historical data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for historical request")

        session = await self._get_session()
        url = f"{self.base_url}/stock/{symbol}/chart/1y"  # 1 year of data
        params = {'token': self.api_key}

        async with session.get(url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"IEX Cloud API error: {response.status}")

            data = await response.json()

            # Convert to standardized format
            data_points = []
            for item in data:
                data_points.append({
                    'date': item['date'],
                    'open': item['open'],
                    'high': item['high'],
                    'low': item['low'],
                    'close': item['close'],
                    'volume': item['volume']
                })

            return {
                'symbol': symbol,
                'data': data_points,
                'count': len(data_points),
                'source': 'iex_cloud_historical'
            }

    async def _fetch_stats(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch key stats/fundamentals."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for stats request")

        session = await self._get_session()
        url = f"{self.base_url}/stock/{symbol}/stats"
        params = {'token': self.api_key}

        async with session.get(url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"IEX Cloud API error: {response.status}")

            data = await response.json()

            return {
                'symbol': symbol,
                'market_cap': data.get('marketcap'),
                'pe_ratio': data.get('peRatio'),
                'peg_ratio': data.get('pegRatio'),
                'price_to_book': data.get('priceToBook'),
                'price_to_sales': data.get('priceToSales'),
                'enterprise_value': data.get('enterpriseValue'),
                'profit_margin': data.get('profitMargin'),
                'operating_margin': data.get('operatingMargin'),
                'return_on_assets': data.get('returnOnAssets'),
                'return_on_equity': data.get('returnOnEquity'),
                'revenue': data.get('revenue'),
                'revenue_per_share': data.get('revenuePerShare'),
                'quarterly_earnings_growth': data.get('quarterlyEarningsGrowthYOY'),
                'gross_profit': data.get('grossProfit'),
                'ebitda': data.get('EBITDA'),
                'quarterly_revenue_growth': data.get('quarterlyRevenueGrowthYOY'),
                '52_week_high': data.get('week52high'),
                '52_week_low': data.get('week52low'),
                'moving_avg_50': data.get('day50MovingAvg'),
                'moving_avg_200': data.get('day200MovingAvg'),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def health_check(self) -> bool:
        """Check IEX Cloud API health."""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/stock/AAPL/quote"
            params = {'token': self.api_key}

            async with session.get(url, params=params) as response:
                return response.status == 200

        except Exception as e:
            self.logger.error(f"IEX Cloud health check failed: {e}")
            return False

    def get_supported_request_types(self) -> List[RequestType]:
        """Get supported request types."""
        return [RequestType.QUOTE, RequestType.HISTORICAL, RequestType.FUNDAMENTALS]

    def calculate_request_cost(self, request: DataRequest) -> float:
        """Calculate request cost based on IEX Cloud pricing."""
        # IEX Cloud pricing is per data point
        base_costs = {
            RequestType.QUOTE: 0.005,
            RequestType.HISTORICAL: 0.10,  # Assumes ~100 data points
            RequestType.FUNDAMENTALS: 0.01
        }
        return base_costs.get(request.request_type, 0.005)

    async def close(self):
        """Clean up resources."""
        if self.session and not self.session.closed:
            await self.session.close()


class PolygonAdapter(VendorAdapter):
    """Polygon.io data vendor adapter."""

    def __init__(self, vendor_registry: VendorRegistry, redis_client: Redis):
        super().__init__(vendor_registry, redis_client)
        self.api_key = vendor_registry.credentials.api_key
        self.base_url = vendor_registry.base_url or "https://api.polygon.io"
        self.session: Optional[aiohttp.ClientSession] = None

        if not self.api_key:
            raise ValueError("Polygon API key is required")

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session

    async def fetch_data(self, request: DataRequest) -> DataResponse:
        """Fetch data from Polygon."""
        start_time = datetime.utcnow()
        request_id = str(uuid.uuid4())

        try:
            if request.request_type == RequestType.QUOTE:
                data = await self._fetch_quote(request)
            elif request.request_type == RequestType.HISTORICAL:
                data = await self._fetch_aggregates(request)
            elif request.request_type == RequestType.FUNDAMENTALS:
                data = await self._fetch_ticker_details(request)
            else:
                raise ValueError(f"Unsupported request type: {request.request_type}")

            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return DataResponse(
                success=True,
                vendor_id=self.vendor_id,
                request_id=request_id,
                data=data,
                response_time_ms=response_time_ms,
                data_timestamp=datetime.utcnow(),
                request_cost=self.calculate_request_cost(request),
                data_quality_score=0.92,  # Polygon high quality
                data_freshness_seconds=0  # Real-time data
            )

        except Exception as e:
            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            self.logger.error(f"Polygon request failed: {e}")

            return DataResponse(
                success=False,
                vendor_id=self.vendor_id,
                request_id=request_id,
                error=str(e),
                response_time_ms=response_time_ms,
                request_cost=self.calculate_request_cost(request)
            )

    async def _fetch_quote(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch real-time quote data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for quote request")

        session = await self._get_session()
        url = f"{self.base_url}/v2/last/trade/{symbol}"
        params = {'apikey': self.api_key}

        async with session.get(url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"Polygon API error: {response.status}")

            data = await response.json()

            if data.get('status') != 'OK':
                raise ValueError(f"Polygon error: {data.get('error', 'Unknown error')}")

            results = data.get('results', {})

            # Also get previous close for calculations
            prev_url = f"{self.base_url}/v2/aggs/ticker/{symbol}/prev"
            async with session.get(prev_url, params=params) as prev_response:
                prev_data = await prev_response.json() if prev_response.status == 200 else {}
                prev_close = prev_data.get('results', [{}])[0].get('c', 0) if prev_data.get('results') else 0

            current_price = results.get('p', 0)
            change = current_price - prev_close if prev_close else 0
            change_percent = (change / prev_close * 100) if prev_close else 0

            return {
                'symbol': symbol,
                'price': current_price,
                'volume': results.get('s', 0),
                'timestamp': results.get('t'),
                'previous_close': prev_close,
                'change': change,
                'change_percent': change_percent,
                'exchange': results.get('x'),
                'conditions': results.get('c', []),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _fetch_aggregates(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch historical aggregate data."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for aggregates request")

        # Default to 1 year of daily data
        end_date = request.end_date or datetime.utcnow().date()
        start_date = request.start_date or (end_date - timedelta(days=365))

        session = await self._get_session()
        url = f"{self.base_url}/v2/aggs/ticker/{symbol}/range/1/day/{start_date}/{end_date}"
        params = {
            'apikey': self.api_key,
            'adjusted': 'true',
            'sort': 'asc'
        }

        async with session.get(url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"Polygon API error: {response.status}")

            data = await response.json()

            if data.get('status') != 'OK':
                raise ValueError(f"Polygon error: {data.get('error', 'Unknown error')}")

            results = data.get('results', [])

            # Convert to standardized format
            data_points = []
            for item in results:
                # Convert timestamp from milliseconds
                date = datetime.fromtimestamp(item['t'] / 1000).strftime('%Y-%m-%d')
                data_points.append({
                    'date': date,
                    'open': item.get('o'),
                    'high': item.get('h'),
                    'low': item.get('l'),
                    'close': item.get('c'),
                    'volume': item.get('v'),
                    'vwap': item.get('vw'),  # Volume weighted average price
                    'transactions': item.get('n')  # Number of transactions
                })

            return {
                'symbol': symbol,
                'data': data_points,
                'count': len(data_points),
                'adjusted': True,
                'source': 'polygon_aggregates'
            }

    async def _fetch_ticker_details(self, request: DataRequest) -> Dict[str, Any]:
        """Fetch ticker details/fundamentals."""
        symbol = request.symbol or (request.symbols[0] if request.symbols else None)
        if not symbol:
            raise ValueError("Symbol required for ticker details request")

        session = await self._get_session()
        url = f"{self.base_url}/v3/reference/tickers/{symbol}"
        params = {'apikey': self.api_key}

        async with session.get(url, params=params) as response:
            if response.status != 200:
                raise ValueError(f"Polygon API error: {response.status}")

            data = await response.json()

            if data.get('status') != 'OK':
                raise ValueError(f"Polygon error: {data.get('error', 'Unknown error')}")

            results = data.get('results', {})

            return {
                'symbol': results.get('ticker'),
                'name': results.get('name'),
                'description': results.get('description'),
                'market': results.get('market'),
                'locale': results.get('locale'),
                'primary_exchange': results.get('primary_exchange'),
                'type': results.get('type'),
                'active': results.get('active'),
                'currency_name': results.get('currency_name'),
                'cik': results.get('cik'),
                'composite_figi': results.get('composite_figi'),
                'share_class_figi': results.get('share_class_figi'),
                'market_cap': results.get('market_cap'),
                'phone_number': results.get('phone_number'),
                'address': results.get('address', {}),
                'sic_code': results.get('sic_code'),
                'sic_description': results.get('sic_description'),
                'ticker_root': results.get('ticker_root'),
                'homepage_url': results.get('homepage_url'),
                'total_employees': results.get('total_employees'),
                'list_date': results.get('list_date'),
                'branding': results.get('branding', {}),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def health_check(self) -> bool:
        """Check Polygon API health."""
        try:
            session = await self._get_session()
            url = f"{self.base_url}/v3/reference/tickers/AAPL"
            params = {'apikey': self.api_key}

            async with session.get(url, params=params) as response:
                if response.status != 200:
                    return False

                data = await response.json()
                return data.get('status') == 'OK'

        except Exception as e:
            self.logger.error(f"Polygon health check failed: {e}")
            return False

    def get_supported_request_types(self) -> List[RequestType]:
        """Get supported request types."""
        return [RequestType.QUOTE, RequestType.HISTORICAL, RequestType.FUNDAMENTALS]

    def calculate_request_cost(self, request: DataRequest) -> float:
        """Calculate request cost based on Polygon pricing."""
        # Simplified cost model - adjust based on actual pricing
        base_costs = {
            RequestType.QUOTE: 0.002,
            RequestType.HISTORICAL: 0.02,
            RequestType.FUNDAMENTALS: 0.01
        }
        return base_costs.get(request.request_type, 0.002)

    async def close(self):
        """Clean up resources."""
        if self.session and not self.session.closed:
            await self.session.close()


# Adapter registry for easy lookup
ADAPTER_CLASSES = {
    'yahoo_finance': YahooFinanceAdapter,
    'alpha_vantage': AlphaVantageAdapter,
    'iex_cloud': IEXCloudAdapter,
    'polygon': PolygonAdapter
}


def get_adapter_class(vendor_name: str) -> Type[VendorAdapter]:
    """Get adapter class by vendor name."""
    if vendor_name not in ADAPTER_CLASSES:
        raise ValueError(f"No adapter available for vendor: {vendor_name}")
    return ADAPTER_CLASSES[vendor_name]