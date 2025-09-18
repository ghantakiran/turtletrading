"""
Pydantic schemas for market-related API models
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum


class MarketStatus(str, Enum):
    """Market status enumeration"""
    OPEN = "open"
    CLOSED = "closed"
    PRE_MARKET = "pre_market"
    AFTER_HOURS = "after_hours"
    HOLIDAY = "holiday"


class IndexData(BaseModel):
    """Market index data"""
    symbol: str = Field(..., description="Index symbol")
    name: str = Field(..., description="Index name")
    current_value: float = Field(..., description="Current index value")
    change: float = Field(..., description="Change from previous close")
    change_percent: float = Field(..., description="Percentage change")
    volume: Optional[int] = Field(None, description="Trading volume")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class MarketIndices(BaseModel):
    """Major market indices data"""
    sp500: IndexData = Field(..., description="S&P 500 data")
    nasdaq: IndexData = Field(..., description="NASDAQ Composite data")
    dow_jones: IndexData = Field(..., description="Dow Jones Industrial Average data")
    russell2000: IndexData = Field(..., description="Russell 2000 data")
    vix: IndexData = Field(..., description="VIX (Volatility Index) data")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class TopMover(BaseModel):
    """Top moving stock data"""
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Company name")
    price: float = Field(..., description="Current price")
    change: float = Field(..., description="Price change")
    change_percent: float = Field(..., description="Percentage change")
    volume: int = Field(..., description="Trading volume")
    market_cap: Optional[float] = Field(None, description="Market capitalization")


class TopMovers(BaseModel):
    """Top gaining and losing stocks"""
    gainers: List[TopMover] = Field(..., description="Top gaining stocks")
    losers: List[TopMover] = Field(..., description="Top losing stocks")
    most_active: List[TopMover] = Field(..., description="Most actively traded stocks")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SectorPerformance(BaseModel):
    """Sector performance data"""
    name: str = Field(..., description="Sector name")
    change_percent: float = Field(..., description="Sector performance percentage")
    top_stocks: List[str] = Field(..., description="Top performing stocks in sector")
    market_cap: float = Field(..., description="Total sector market cap")


class MarketTrends(BaseModel):
    """Market trends and analysis"""
    timeframe: str = Field(..., description="Analysis timeframe")
    overall_trend: str = Field(..., description="Overall market trend direction")
    sentiment_score: float = Field(..., ge=-1, le=1, description="Market sentiment score (-1 to 1)")
    
    # Sector analysis
    sector_performance: List[SectorPerformance] = Field(..., description="Sector performance data")
    
    # Key metrics
    average_volume: float = Field(..., description="Average market volume")
    volatility_index: float = Field(..., description="Market volatility measure")
    breadth_ratio: float = Field(..., description="Market breadth (advancing vs declining)")
    
    # Trends
    bull_bear_ratio: float = Field(..., description="Bull vs bear sentiment ratio")
    momentum_score: float = Field(..., description="Market momentum score")
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class TradingSession(BaseModel):
    """Trading session information"""
    market_status: MarketStatus = Field(..., description="Current market status")
    next_open: Optional[datetime] = Field(None, description="Next market open time")
    next_close: Optional[datetime] = Field(None, description="Next market close time")
    pre_market_open: Optional[datetime] = Field(None, description="Pre-market open time")
    after_hours_close: Optional[datetime] = Field(None, description="After-hours close time")
    timezone: str = Field("EST", description="Market timezone")
    is_trading_day: bool = Field(..., description="Whether today is a trading day")


class MarketOverview(BaseModel):
    """Comprehensive market overview"""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Market status
    trading_session: TradingSession = Field(..., description="Trading session info")
    
    # Indices
    indices: MarketIndices = Field(..., description="Major market indices")
    
    # Market movement
    top_movers: TopMovers = Field(..., description="Top moving stocks")
    
    # Overall metrics
    market_sentiment: float = Field(..., ge=-1, le=1, description="Overall market sentiment")
    fear_greed_index: Optional[float] = Field(None, ge=0, le=100, description="Fear & Greed index")
    volatility_level: str = Field(..., description="Current volatility level")
    
    # Key statistics
    advancing_stocks: int = Field(..., description="Number of advancing stocks")
    declining_stocks: int = Field(..., description="Number of declining stocks")
    unchanged_stocks: int = Field(..., description="Number of unchanged stocks")
    new_highs: int = Field(..., description="New 52-week highs")
    new_lows: int = Field(..., description="New 52-week lows")


class VolatilityData(BaseModel):
    """Market volatility data"""
    vix_current: float = Field(..., description="Current VIX value")
    vix_change: float = Field(..., description="VIX change")
    volatility_level: str = Field(..., description="Volatility level description")
    historical_percentile: float = Field(..., description="Historical volatility percentile")
    term_structure: Dict[str, float] = Field(..., description="Volatility term structure")


class EconomicEvent(BaseModel):
    """Economic calendar event"""
    date: datetime = Field(..., description="Event date and time")
    title: str = Field(..., description="Event title")
    country: str = Field(..., description="Country code")
    importance: str = Field(..., description="Event importance level")
    actual: Optional[str] = Field(None, description="Actual value")
    forecast: Optional[str] = Field(None, description="Forecasted value")
    previous: Optional[str] = Field(None, description="Previous value")
    impact: str = Field(..., description="Expected market impact")


class EconomicCalendar(BaseModel):
    """Economic calendar data"""
    events: List[EconomicEvent] = Field(..., description="Upcoming economic events")
    high_impact_count: int = Field(..., description="Number of high impact events")
    timeframe_days: int = Field(..., description="Timeframe in days")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CorrelationMatrix(BaseModel):
    """Correlation matrix data"""
    symbols: List[str] = Field(..., description="Analyzed symbols")
    correlation_data: Dict[str, Dict[str, float]] = Field(..., description="Correlation matrix")
    period: str = Field(..., description="Analysis period")
    strongest_correlations: List[Dict[str, Any]] = Field(..., description="Strongest correlations")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class MarketBreadth(BaseModel):
    """Market breadth indicators"""
    advance_decline_line: float = Field(..., description="Advance-Decline Line")
    advance_decline_ratio: float = Field(..., description="Advance-Decline Ratio")
    mcclellan_oscillator: float = Field(..., description="McClellan Oscillator")
    new_high_low_ratio: float = Field(..., description="New High-Low Ratio")
    percentage_above_ma50: float = Field(..., description="Percentage of stocks above 50-day MA")
    percentage_above_ma200: float = Field(..., description="Percentage of stocks above 200-day MA")
    timestamp: datetime = Field(default_factory=datetime.utcnow)