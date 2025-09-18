"""
Market overview and analysis service
"""

import yfinance as yf
import pandas as pd
import numpy as np
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import asyncio
from concurrent.futures import ThreadPoolExecutor
from loguru import logger

from app.services.base_service import BaseService
from app.models.market_schemas import (
    MarketOverview, MarketIndices, TopMovers, MarketTrends,
    IndexData, TopMover, SectorPerformance, TradingSession, MarketStatus
)


class MarketService(BaseService):
    """Market overview and analysis service"""
    
    def __init__(self):
        super().__init__()
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Major market indices
        self.major_indices = {
            "sp500": "^GSPC",
            "nasdaq": "^IXIC", 
            "dow_jones": "^DJI",
            "russell2000": "^RUT",
            "vix": "^VIX"
        }
        
        # Sector ETFs for sector analysis
        self.sector_etfs = {
            "Technology": "XLK",
            "Healthcare": "XLV",
            "Financial": "XLF",
            "Consumer Discretionary": "XLY",
            "Communication": "XLC",
            "Industrial": "XLI",
            "Consumer Staples": "XLP",
            "Energy": "XLE",
            "Utilities": "XLU",
            "Real Estate": "XLRE",
            "Materials": "XLB"
        }
        
        # Popular stocks for movers analysis
        self.popular_stocks = [
            "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "META",
            "JPM", "JNJ", "V", "UNH", "PG", "HD", "MA", "BAC",
            "ABBV", "PFE", "KO", "PEP", "WMT", "DIS", "CRM", "NFLX"
        ]
    
    async def get_market_overview(self) -> MarketOverview:
        """Get comprehensive market overview"""
        cache_key = self.create_cache_key("market_overview")
        
        async def fetch_overview():
            try:
                # Get all components concurrently
                tasks = [
                    self.get_trading_session_info(),
                    self.get_market_indices(), 
                    self.get_top_movers("US", 10)
                ]
                
                session_info, indices, movers = await asyncio.gather(*tasks)
                
                # Calculate market sentiment (simplified)
                market_sentiment = self._calculate_market_sentiment(indices, movers)
                
                # Get market breadth data
                breadth_data = await self._get_market_breadth()
                
                return MarketOverview(
                    timestamp=datetime.utcnow(),
                    trading_session=session_info,
                    indices=indices,
                    top_movers=movers,
                    market_sentiment=market_sentiment,
                    fear_greed_index=await self._get_fear_greed_mock(),
                    volatility_level=self._get_volatility_level(indices.vix.current_value),
                    advancing_stocks=breadth_data.get("advancing", 0),
                    declining_stocks=breadth_data.get("declining", 0),
                    unchanged_stocks=breadth_data.get("unchanged", 0),
                    new_highs=breadth_data.get("new_highs", 0),
                    new_lows=breadth_data.get("new_lows", 0)
                )
                
            except Exception as e:
                logger.error(f"Error getting market overview: {e}")
                raise
        
        return await self.get_or_set_cache(cache_key, fetch_overview, ttl=60)  # Cache for 1 minute
    
    async def get_market_indices(self) -> MarketIndices:
        """Get major market indices data"""
        cache_key = self.create_cache_key("market_indices")
        
        async def fetch_indices():
            try:
                loop = asyncio.get_event_loop()
                
                # Fetch all indices data concurrently
                tasks = []
                for key, symbol in self.major_indices.items():
                    task = loop.run_in_executor(
                        self.executor,
                        lambda s=symbol: self._fetch_index_data(s)
                    )
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks)
                
                # Map results to named indices
                indices_data = {}
                for i, key in enumerate(self.major_indices.keys()):
                    indices_data[key] = results[i]
                
                return MarketIndices(
                    sp500=indices_data["sp500"],
                    nasdaq=indices_data["nasdaq"],
                    dow_jones=indices_data["dow_jones"],
                    russell2000=indices_data["russell2000"],
                    vix=indices_data["vix"],
                    timestamp=datetime.utcnow()
                )
                
            except Exception as e:
                logger.error(f"Error fetching market indices: {e}")
                raise
        
        return await self.get_or_set_cache(cache_key, fetch_indices, ttl=60)  # Cache for 1 minute
    
    def _fetch_index_data(self, symbol: str) -> IndexData:
        """Fetch data for a single index"""
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d", interval="1d")
            
            if hist.empty:
                raise ValueError(f"No data for {symbol}")
            
            current = hist.iloc[-1]
            previous = hist.iloc[-2] if len(hist) > 1 else current
            
            current_value = self.safe_float_extract(current['Close'])
            previous_close = self.safe_float_extract(previous['Close'])
            
            change = current_value - previous_close
            change_percent = (change / previous_close * 100) if previous_close != 0 else 0
            
            # Get index name
            info = ticker.info
            name = info.get('longName', symbol)
            
            return IndexData(
                symbol=symbol,
                name=name,
                current_value=current_value,
                change=self.format_percentage(change),
                change_percent=self.format_percentage(change_percent),
                volume=int(current.get('Volume', 0)),
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error fetching index data for {symbol}: {e}")
            # Return mock data on error
            return IndexData(
                symbol=symbol,
                name=symbol,
                current_value=0.0,
                change=0.0,
                change_percent=0.0,
                volume=0,
                timestamp=datetime.utcnow()
            )
    
    async def get_top_movers(self, market: str = "US", limit: int = 20) -> TopMovers:
        """Get top gaining and losing stocks"""
        cache_key = self.create_cache_key("top_movers", market, limit)
        
        async def fetch_movers():
            try:
                loop = asyncio.get_event_loop()
                
                # Use popular stocks for demo - in production would use market screeners
                tasks = []
                for symbol in self.popular_stocks[:30]:  # Get more than limit to sort
                    task = loop.run_in_executor(
                        self.executor,
                        lambda s=symbol: self._fetch_mover_data(s)
                    )
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Filter successful results
                valid_movers = [r for r in results if isinstance(r, TopMover)]
                
                if not valid_movers:
                    return TopMovers(gainers=[], losers=[], most_active=[])
                
                # Sort by percentage change
                sorted_by_change = sorted(valid_movers, key=lambda x: x.change_percent, reverse=True)
                sorted_by_volume = sorted(valid_movers, key=lambda x: x.volume, reverse=True)
                
                return TopMovers(
                    gainers=sorted_by_change[:limit],
                    losers=sorted_by_change[-limit:][::-1],  # Reverse to show worst first
                    most_active=sorted_by_volume[:limit],
                    timestamp=datetime.utcnow()
                )
                
            except Exception as e:
                logger.error(f"Error fetching top movers: {e}")
                return TopMovers(gainers=[], losers=[], most_active=[])
        
        return await self.get_or_set_cache(cache_key, fetch_movers, ttl=300)  # Cache for 5 minutes
    
    def _fetch_mover_data(self, symbol: str) -> Optional[TopMover]:
        """Fetch data for a potential mover stock"""
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d", interval="1d")
            
            if hist.empty:
                return None
            
            current = hist.iloc[-1]
            previous = hist.iloc[-2] if len(hist) > 1 else current
            
            current_price = self.safe_float_extract(current['Close'])
            previous_close = self.safe_float_extract(previous['Close'])
            
            change = current_price - previous_close
            change_percent = (change / previous_close * 100) if previous_close != 0 else 0
            
            # Get company info
            info = ticker.info
            company_name = info.get('longName', symbol)
            market_cap = info.get('marketCap')
            
            return TopMover(
                symbol=symbol,
                name=company_name,
                price=current_price,
                change=self.format_percentage(change),
                change_percent=self.format_percentage(change_percent),
                volume=int(current['Volume']),
                market_cap=market_cap
            )
            
        except Exception as e:
            logger.error(f"Error fetching mover data for {symbol}: {e}")
            return None
    
    async def get_market_trends(self, timeframe: str = "1M", sector: Optional[str] = None) -> MarketTrends:
        """Get market trends and analysis"""
        cache_key = self.create_cache_key("market_trends", timeframe, sector or "all")
        
        async def fetch_trends():
            try:
                # Get sector performance
                sector_performance = await self.get_sector_performance()
                
                # Calculate overall trend
                overall_trend = self._calculate_overall_trend(sector_performance)
                
                # Get market metrics
                indices = await self.get_market_indices()
                sentiment_score = self._calculate_market_sentiment(indices, None)
                
                # Calculate additional metrics
                volatility_index = indices.vix.current_value / 100  # Normalize VIX
                
                return MarketTrends(
                    timeframe=timeframe,
                    overall_trend=overall_trend,
                    sentiment_score=sentiment_score,
                    sector_performance=[
                        SectorPerformance(
                            name=name,
                            change_percent=data["performance"],
                            top_stocks=data.get("top_stocks", []),
                            market_cap=data.get("market_cap", 0)
                        )
                        for name, data in sector_performance.items()
                    ],
                    average_volume=await self._get_average_volume(),
                    volatility_index=volatility_index,
                    breadth_ratio=await self._get_breadth_ratio(),
                    bull_bear_ratio=0.6,  # Mock data
                    momentum_score=0.5,  # Mock data
                    timestamp=datetime.utcnow()
                )
                
            except Exception as e:
                logger.error(f"Error fetching market trends: {e}")
                raise
        
        return await self.get_or_set_cache(cache_key, fetch_trends, ttl=600)  # Cache for 10 minutes
    
    async def get_sector_performance(self) -> Dict[str, Dict[str, Any]]:
        """Get performance data for different market sectors"""
        cache_key = self.create_cache_key("sector_performance")
        
        async def fetch_sectors():
            try:
                loop = asyncio.get_event_loop()
                
                # Fetch sector ETF data
                tasks = []
                for sector_name, etf_symbol in self.sector_etfs.items():
                    task = loop.run_in_executor(
                        self.executor,
                        lambda s=etf_symbol, n=sector_name: self._fetch_sector_data(s, n)
                    )
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                sector_data = {}
                for i, sector_name in enumerate(self.sector_etfs.keys()):
                    if not isinstance(results[i], Exception):
                        sector_data[sector_name] = results[i]
                
                return sector_data
                
            except Exception as e:
                logger.error(f"Error fetching sector performance: {e}")
                return {}
        
        return await self.get_or_set_cache(cache_key, fetch_sectors, ttl=300)  # Cache for 5 minutes
    
    def _fetch_sector_data(self, etf_symbol: str, sector_name: str) -> Dict[str, Any]:
        """Fetch data for a sector ETF"""
        try:
            ticker = yf.Ticker(etf_symbol)
            hist = ticker.history(period="5d", interval="1d")
            
            if hist.empty or len(hist) < 2:
                return {"performance": 0.0, "top_stocks": [], "market_cap": 0}
            
            current_price = self.safe_float_extract(hist['Close'].iloc[-1])
            previous_price = self.safe_float_extract(hist['Close'].iloc[0])
            
            performance = ((current_price - previous_price) / previous_price * 100) if previous_price != 0 else 0
            
            # Get basic info
            info = ticker.info
            market_cap = info.get('totalAssets', 0)
            
            return {
                "performance": self.format_percentage(performance),
                "top_stocks": [],  # Would need additional API calls to get holdings
                "market_cap": market_cap
            }
            
        except Exception as e:
            logger.error(f"Error fetching sector data for {etf_symbol}: {e}")
            return {"performance": 0.0, "top_stocks": [], "market_cap": 0}
    
    async def get_market_volatility(self, period: str = "30d") -> Dict[str, Any]:
        """Get market volatility indicators"""
        cache_key = self.create_cache_key("market_volatility", period)
        
        async def fetch_volatility():
            try:
                # Get VIX data
                vix_ticker = yf.Ticker("^VIX")
                vix_hist = vix_ticker.history(period=period, interval="1d")
                
                if vix_hist.empty:
                    return {"vix_current": 0, "volatility_level": "Unknown"}
                
                current_vix = self.safe_float_extract(vix_hist['Close'].iloc[-1])
                vix_change = current_vix - self.safe_float_extract(vix_hist['Close'].iloc[-2])
                
                # Calculate historical percentile
                vix_values = vix_hist['Close'].values
                percentile = (np.sum(vix_values <= current_vix) / len(vix_values)) * 100
                
                return {
                    "vix_current": current_vix,
                    "vix_change": self.format_percentage(vix_change),
                    "volatility_level": self._get_volatility_level(current_vix),
                    "historical_percentile": self.format_percentage(percentile),
                    "term_structure": {
                        "1_month": current_vix,
                        "3_month": current_vix * 1.1,  # Mock data
                        "6_month": current_vix * 1.2   # Mock data
                    }
                }
                
            except Exception as e:
                logger.error(f"Error fetching market volatility: {e}")
                return {"vix_current": 20, "volatility_level": "Normal"}
        
        return await self.get_or_set_cache(cache_key, fetch_volatility, ttl=300)
    
    async def get_fear_greed_index(self) -> Dict[str, Any]:
        """Get Fear & Greed index (mock implementation)"""
        cache_key = self.create_cache_key("fear_greed_index")
        
        async def fetch_fear_greed():
            # This would integrate with CNN Fear & Greed Index API in production
            try:
                indices = await self.get_market_indices()
                
                # Simple calculation based on VIX and market performance
                vix_score = max(0, min(100, (50 - indices.vix.current_value) * 2))
                market_score = max(0, min(100, 50 + indices.sp500.change_percent * 5))
                
                fear_greed_value = (vix_score + market_score) / 2
                
                if fear_greed_value >= 75:
                    label = "Extreme Greed"
                elif fear_greed_value >= 55:
                    label = "Greed" 
                elif fear_greed_value >= 45:
                    label = "Neutral"
                elif fear_greed_value >= 25:
                    label = "Fear"
                else:
                    label = "Extreme Fear"
                
                return {
                    "value": fear_greed_value,
                    "label": label,
                    "components": {
                        "vix": vix_score,
                        "market_momentum": market_score,
                        "stock_price_strength": 50,  # Mock
                        "stock_price_breadth": 50,   # Mock
                        "put_call_ratio": 50,        # Mock
                        "junk_bond_demand": 50,      # Mock
                        "market_volatility": vix_score
                    }
                }
                
            except Exception as e:
                logger.error(f"Error calculating Fear & Greed index: {e}")
                return {"value": 50, "label": "Neutral", "components": {}}
        
        return await self.get_or_set_cache(cache_key, fetch_fear_greed, ttl=3600)  # Cache for 1 hour
    
    async def get_economic_calendar(self, days_ahead: int = 7) -> List[Dict[str, Any]]:
        """Get upcoming economic events (mock implementation)"""
        cache_key = self.create_cache_key("economic_calendar", days_ahead)
        
        async def fetch_calendar():
            # This would integrate with economic calendar API in production
            events = []
            
            # Mock economic events
            base_date = datetime.now()
            mock_events = [
                {"title": "FOMC Meeting", "importance": "High", "impact": "High"},
                {"title": "Non-Farm Payrolls", "importance": "High", "impact": "High"},
                {"title": "CPI Data Release", "importance": "High", "impact": "Medium"},
                {"title": "GDP Growth Rate", "importance": "Medium", "impact": "Medium"},
                {"title": "Unemployment Rate", "importance": "Medium", "impact": "Medium"}
            ]
            
            for i, event in enumerate(mock_events):
                if i < days_ahead:
                    events.append({
                        "date": (base_date + timedelta(days=i)).isoformat(),
                        "title": event["title"],
                        "country": "US",
                        "importance": event["importance"],
                        "impact": event["impact"],
                        "actual": None,
                        "forecast": "TBD",
                        "previous": "N/A"
                    })
            
            return events
        
        return await self.get_or_set_cache(cache_key, fetch_calendar, ttl=3600)  # Cache for 1 hour
    
    async def get_correlation_matrix(self, symbols: List[str], period: str = "3M") -> Dict[str, Any]:
        """Get correlation matrix for stocks or indices"""
        cache_key = self.create_cache_key("correlation", "_".join(symbols), period)
        
        async def fetch_correlation():
            try:
                loop = asyncio.get_event_loop()
                
                # Fetch price data for all symbols
                tasks = []
                for symbol in symbols:
                    task = loop.run_in_executor(
                        self.executor,
                        lambda s=symbol: yf.Ticker(s).history(period=period, interval="1d")
                    )
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Build price dataframe
                price_data = {}
                for i, symbol in enumerate(symbols):
                    if not isinstance(results[i], Exception) and not results[i].empty:
                        price_data[symbol] = results[i]['Close']
                
                if len(price_data) < 2:
                    return {"correlation_matrix": {}, "strongest_correlations": []}
                
                # Calculate correlation matrix
                df = pd.DataFrame(price_data)
                correlation_matrix = df.corr()
                
                # Convert to dictionary format
                corr_dict = {}
                for symbol1 in symbols:
                    if symbol1 in correlation_matrix.columns:
                        corr_dict[symbol1] = {}
                        for symbol2 in symbols:
                            if symbol2 in correlation_matrix.columns:
                                corr_dict[symbol1][symbol2] = float(correlation_matrix.loc[symbol1, symbol2])
                
                # Find strongest correlations
                strongest_correlations = []
                for i, symbol1 in enumerate(symbols):
                    for j, symbol2 in enumerate(symbols[i+1:], i+1):
                        if symbol1 in corr_dict and symbol2 in corr_dict[symbol1]:
                            corr_value = corr_dict[symbol1][symbol2]
                            if abs(corr_value) > 0.7:  # Only strong correlations
                                strongest_correlations.append({
                                    "symbol1": symbol1,
                                    "symbol2": symbol2,
                                    "correlation": corr_value,
                                    "strength": "Strong" if abs(corr_value) > 0.8 else "Moderate"
                                })
                
                return {
                    "correlation_matrix": corr_dict,
                    "strongest_correlations": strongest_correlations
                }
                
            except Exception as e:
                logger.error(f"Error calculating correlation matrix: {e}")
                return {"correlation_matrix": {}, "strongest_correlations": []}
        
        return await self.get_or_set_cache(cache_key, fetch_correlation, ttl=3600)  # Cache for 1 hour
    
    async def get_trading_session_info(self) -> TradingSession:
        """Get current trading session information"""
        market_hours = self.get_market_hours()
        
        # Determine market status
        if market_hours["is_open"]:
            status = MarketStatus.OPEN
        elif market_hours["is_weekday"]:
            current_time = market_hours["current_time"]
            if current_time.hour < 9 or (current_time.hour == 9 and current_time.minute < 30):
                status = MarketStatus.PRE_MARKET
            else:
                status = MarketStatus.AFTER_HOURS
        else:
            status = MarketStatus.CLOSED
        
        return TradingSession(
            market_status=status,
            next_open=market_hours["next_open"],
            next_close=market_hours["next_close"],
            pre_market_open=market_hours["market_open"] - timedelta(hours=4),
            after_hours_close=market_hours["market_close"] + timedelta(hours=4),
            timezone="EST",
            is_trading_day=market_hours["is_weekday"]
        )
    
    # Helper methods
    
    def _calculate_market_sentiment(self, indices, movers) -> float:
        """Calculate overall market sentiment score"""
        try:
            scores = []
            
            # Index performance
            if indices:
                sp500_change = indices.sp500.change_percent
                nasdaq_change = indices.nasdaq.change_percent
                scores.extend([sp500_change / 100, nasdaq_change / 100])
            
            # VIX (inverted - lower VIX = higher sentiment)
            if indices and indices.vix.current_value > 0:
                vix_score = (50 - indices.vix.current_value) / 50
                scores.append(vix_score)
            
            # Top movers sentiment
            if movers and movers.gainers:
                avg_gainer_change = np.mean([m.change_percent for m in movers.gainers[:5]])
                scores.append(avg_gainer_change / 100)
            
            if not scores:
                return 0.0
            
            sentiment = np.mean(scores)
            return max(-1.0, min(1.0, sentiment))  # Clamp to -1 to 1 range
            
        except Exception as e:
            logger.error(f"Error calculating market sentiment: {e}")
            return 0.0
    
    def _get_volatility_level(self, vix_value: float) -> str:
        """Get volatility level description based on VIX"""
        if vix_value > 30:
            return "High"
        elif vix_value > 20:
            return "Elevated"
        elif vix_value > 15:
            return "Normal"
        else:
            return "Low"
    
    def _calculate_overall_trend(self, sector_performance: Dict[str, Dict[str, Any]]) -> str:
        """Calculate overall market trend from sector performance"""
        try:
            if not sector_performance:
                return "Neutral"
            
            performances = [data["performance"] for data in sector_performance.values()]
            avg_performance = np.mean(performances)
            
            if avg_performance > 1:
                return "Bullish"
            elif avg_performance < -1:
                return "Bearish"
            else:
                return "Neutral"
                
        except Exception:
            return "Neutral"
    
    async def _get_market_breadth(self) -> Dict[str, int]:
        """Get market breadth data (mock implementation)"""
        # This would integrate with market data providers for real breadth data
        return {
            "advancing": 1200,
            "declining": 800,
            "unchanged": 100,
            "new_highs": 150,
            "new_lows": 75
        }
    
    async def _get_fear_greed_mock(self) -> float:
        """Mock Fear & Greed index value"""
        fear_greed_data = await self.get_fear_greed_index()
        return fear_greed_data.get("value", 50)
    
    async def _get_average_volume(self) -> float:
        """Get average market volume (mock)"""
        return 3.2e9  # Mock average volume
    
    async def _get_breadth_ratio(self) -> float:
        """Get market breadth ratio (advancing vs declining)"""
        breadth = await self._get_market_breadth()
        total = breadth["advancing"] + breadth["declining"]
        if total == 0:
            return 0.5
        return breadth["advancing"] / total