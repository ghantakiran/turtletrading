"""
Pydantic schemas for stock-related API models
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class StockPrice(BaseModel):
    """Current stock price information"""
    symbol: str = Field(..., description="Stock symbol")
    current_price: float = Field(..., description="Current stock price")
    previous_close: float = Field(..., description="Previous day closing price")
    change: float = Field(..., description="Price change from previous close")
    change_percent: float = Field(..., description="Percentage change from previous close")
    day_high: float = Field(..., description="Day's high price")
    day_low: float = Field(..., description="Day's low price")
    volume: int = Field(..., description="Trading volume")
    market_cap: Optional[float] = Field(None, description="Market capitalization")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class TechnicalIndicator(BaseModel):
    """Individual technical indicator"""
    name: str = Field(..., description="Indicator name")
    value: float = Field(..., description="Current indicator value")
    signal: str = Field(..., description="Buy/Sell/Hold signal")
    description: Optional[str] = Field(None, description="Indicator description")


class TechnicalIndicators(BaseModel):
    """Technical analysis indicators for a stock"""
    symbol: str = Field(..., description="Stock symbol")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Price-based indicators
    rsi: TechnicalIndicator = Field(..., description="Relative Strength Index")
    macd: Dict[str, float] = Field(..., description="MACD values")
    stochastic: Dict[str, float] = Field(..., description="Stochastic oscillator")
    
    # Moving averages
    ema_20: float = Field(..., description="20-day Exponential Moving Average")
    sma_50: float = Field(..., description="50-day Simple Moving Average")
    sma_200: float = Field(..., description="200-day Simple Moving Average")
    
    # Volatility indicators
    bollinger_bands: Dict[str, float] = Field(..., description="Bollinger Bands")
    atr: float = Field(..., description="Average True Range")
    
    # Volume indicators
    obv: float = Field(..., description="On-Balance Volume")
    volume_sma: float = Field(..., description="Volume Simple Moving Average")
    
    # Trend indicators
    adx: float = Field(..., description="Average Directional Index")
    adx_di_plus: float = Field(..., description="Positive Directional Indicator")
    adx_di_minus: float = Field(..., description="Negative Directional Indicator")
    
    # Overall technical score
    technical_score: float = Field(..., ge=0, le=1, description="Weighted technical score (0-1)")
    recommendation: str = Field(..., description="Overall technical recommendation")


class LSTMPrediction(BaseModel):
    """LSTM model predictions"""
    symbol: str = Field(..., description="Stock symbol")
    current_price: float = Field(..., description="Current stock price")
    predictions: List[float] = Field(..., description="Predicted prices for future days")
    prediction_dates: List[str] = Field(..., description="Dates for predictions")
    confidence_intervals: List[Dict[str, float]] = Field(..., description="Confidence intervals for predictions")
    
    # Model performance metrics
    model_accuracy: float = Field(..., ge=0, le=100, description="Model accuracy percentage")
    mae: float = Field(..., description="Mean Absolute Error")
    mse: float = Field(..., description="Mean Squared Error")
    
    # Prediction analysis
    predicted_return_5d: float = Field(..., description="5-day predicted return percentage")
    lstm_signal: float = Field(..., ge=0, le=1, description="LSTM signal strength (0-1)")
    trend_direction: str = Field(..., description="Predicted trend direction")
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SeasonalityData(BaseModel):
    """Seasonality analysis data"""
    symbol: str = Field(..., description="Stock symbol")
    seasonal_score: float = Field(..., ge=0, le=1, description="Seasonality score (0-1)")
    historical_performance: Dict[str, float] = Field(..., description="Historical performance by period")
    current_period_avg: float = Field(..., description="Average return for current period")


class RiskRewardAnalysis(BaseModel):
    """Risk/Reward analysis"""
    current_price: float = Field(..., description="Current stock price")
    target_price: float = Field(..., description="Target price based on analysis")
    stop_loss: float = Field(..., description="Recommended stop loss price")
    risk_amount: float = Field(..., description="Risk amount per share")
    reward_amount: float = Field(..., description="Potential reward per share")
    risk_reward_ratio: float = Field(..., description="Risk to reward ratio")


class RecommendationType(str, Enum):
    """Investment recommendation types"""
    STRONG_BUY = "Strong Buy"
    BUY = "Buy"
    HOLD = "Hold"
    SELL = "Sell"
    STRONG_SELL = "Strong Sell"


class StockAnalysisResponse(BaseModel):
    """Comprehensive stock analysis response"""
    symbol: str = Field(..., description="Stock symbol")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Core data
    price: StockPrice = Field(..., description="Current price information")
    technical_indicators: Optional[TechnicalIndicators] = Field(None, description="Technical analysis")
    lstm_prediction: Optional[LSTMPrediction] = Field(None, description="LSTM predictions")
    
    # Additional analysis
    sentiment_analysis: Optional[Any] = Field(None, description="Sentiment analysis data")
    seasonality: Optional[SeasonalityData] = Field(None, description="Seasonality analysis")
    risk_reward: Optional[RiskRewardAnalysis] = Field(None, description="Risk/reward analysis")
    
    # Overall analysis
    analysis_score: float = Field(..., ge=0, le=1, description="Combined analysis score (0-1)")
    recommendation: RecommendationType = Field(..., description="Investment recommendation")
    confidence_level: float = Field(..., ge=0, le=1, description="Confidence in recommendation")
    
    # Supporting data
    key_factors: List[str] = Field(default_factory=list, description="Key factors affecting the analysis")
    warnings: List[str] = Field(default_factory=list, description="Warnings or risk factors")


class PriceHistory(BaseModel):
    """Historical price data point"""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    close: float = Field(..., description="Closing price")
    volume: int = Field(..., description="Trading volume")
    adjusted_close: Optional[float] = Field(None, description="Adjusted closing price")


class StockHistoryResponse(BaseModel):
    """Stock price history response"""
    symbol: str = Field(..., description="Stock symbol")
    period: str = Field(..., description="Data period")
    interval: str = Field(..., description="Data interval")
    data: List[PriceHistory] = Field(..., description="Historical price data")
    total_records: int = Field(..., description="Total number of records")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class BatchAnalysisRequest(BaseModel):
    """Request model for batch stock analysis"""
    symbols: List[str] = Field(..., min_items=1, max_items=20, description="Stock symbols to analyze")
    period: str = Field("1y", description="Data period for analysis")
    include_sentiment: bool = Field(False, description="Include sentiment analysis")
    include_lstm: bool = Field(True, description="Include LSTM predictions")
    prediction_days: int = Field(5, ge=1, le=30, description="Number of prediction days")


class BatchAnalysisResponse(BaseModel):
    """Response model for batch stock analysis"""
    successful_analyses: List[StockAnalysisResponse] = Field(..., description="Successful analyses")
    errors: List[Dict[str, str]] = Field(..., description="Errors encountered")
    total_requested: int = Field(..., description="Total symbols requested")
    successful_count: int = Field(..., description="Number of successful analyses")
    error_count: int = Field(..., description="Number of errors")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Validators
@validator('change_percent', 'predicted_return_5d', always=True)
def validate_percentage(cls, v):
    """Ensure percentage values are reasonable"""
    if v < -100 or v > 1000:
        raise ValueError('Percentage value out of reasonable range')
    return v