"""
Stock analysis service with LSTM predictions and technical analysis
"""

import yfinance as yf
import pandas as pd
import ta
import talib
import numpy as np
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import asyncio
from concurrent.futures import ThreadPoolExecutor
from loguru import logger

from app.services.base_service import BaseService
from app.models.stock_schemas import (
    StockPrice, TechnicalIndicators, LSTMPrediction,
    StockAnalysisResponse, RecommendationType
)
from app.core.config import settings
from app.core.external_rate_limiting import rate_limit_external_api
from app.services.alpha_vantage_service import alpha_vantage_service
from app.services.technical_analysis_service import technical_analysis_service


class StockService(BaseService):
    """Stock analysis service with comprehensive market data"""
    
    def __init__(self):
        super().__init__()
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.allowed_periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y"]
        self.allowed_intervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"]

    @rate_limit_external_api("yfinance", lambda self, symbol, *args, **kwargs: symbol)
    async def _fetch_yfinance_history(self, symbol: str, period: str, interval: str = "1d"):
        """Rate-limited wrapper for yfinance history calls"""
        loop = asyncio.get_event_loop()
        ticker = yf.Ticker(symbol)
        return await loop.run_in_executor(
            self.executor,
            lambda: ticker.history(period=period, interval=interval)
        )

    @rate_limit_external_api("yfinance", lambda self, symbol, *args, **kwargs: symbol)
    async def _fetch_yfinance_info(self, symbol: str):
        """Rate-limited wrapper for yfinance info calls"""
        loop = asyncio.get_event_loop()
        ticker = yf.Ticker(symbol)
        return await loop.run_in_executor(
            self.executor,
            lambda: ticker.info
        )

    async def _fetch_price_fallback(self, symbol: str) -> Optional[StockPrice]:
        """Fallback method using Alpha Vantage for price data"""
        try:
            if not alpha_vantage_service.is_configured():
                logger.warning("Alpha Vantage not configured, cannot use as fallback")
                return None

            logger.info(f"Using Alpha Vantage fallback for {symbol}")
            return await alpha_vantage_service.get_quote(symbol)

        except Exception as e:
            logger.error(f"Alpha Vantage fallback failed for {symbol}: {e}")
            return None

    async def _fetch_history_fallback(self, symbol: str, period: str, interval: str = "1d"):
        """Fallback method using Alpha Vantage for historical data"""
        try:
            if not alpha_vantage_service.is_configured():
                logger.warning("Alpha Vantage not configured, cannot use as fallback for historical data")
                return None

            logger.info(f"Using Alpha Vantage fallback for {symbol} historical data")

            # Map intervals and periods to Alpha Vantage format
            if interval in ["1d", "daily"]:
                # For daily data, use different output size based on period
                if period in ["1d", "5d", "1mo"]:
                    outputsize = "compact"  # Last 100 days
                else:
                    outputsize = "full"     # Full history

                return await alpha_vantage_service.get_daily_data(symbol, outputsize)

            elif interval in ["5min", "15min", "30min", "60min"]:
                # For intraday data
                return await alpha_vantage_service.get_intraday_data(symbol, interval)

            else:
                logger.warning(f"Unsupported interval for Alpha Vantage fallback: {interval}")
                return None

        except Exception as e:
            logger.error(f"Alpha Vantage historical data fallback failed for {symbol}: {e}")
            return None

    async def _fetch_technical_indicators_fallback(self, symbol: str, period: str) -> Optional[TechnicalIndicators]:
        """Fallback method using Alpha Vantage for technical indicators"""
        try:
            if not alpha_vantage_service.is_configured():
                logger.warning("Alpha Vantage not configured, cannot calculate technical indicators")
                return None

            logger.info(f"Using Alpha Vantage fallback for technical indicators of {symbol}")

            # Get historical data from Alpha Vantage
            outputsize = "full" if period in ["5y", "10y", "max"] else "compact"
            df = await alpha_vantage_service.get_daily_data(symbol, outputsize)

            if df is None or df.empty or len(df) < 50:
                logger.warning(f"Alpha Vantage returned insufficient data for technical indicators")
                return None

            # Calculate technical indicators using the same logic as the main method
            close = df['Close']
            high = df['High']
            low = df['Low']
            volume = df['Volume']

            # Calculate indicators
            rsi = ta.momentum.RSIIndicator(close=close).rsi()
            macd_indicator = ta.trend.MACD(close)
            stoch_indicator = ta.momentum.StochasticOscillator(high=high, low=low, close=close)
            bb_indicator = ta.volatility.BollingerBands(close=close)
            adx_indicator = ta.trend.ADXIndicator(high=high, low=low, close=close, window=14)
            obv_indicator = ta.volume.OnBalanceVolumeIndicator(close=close, volume=volume)
            atr_indicator = ta.volatility.AverageTrueRange(high=high, low=low, close=close)

            # Get latest values
            latest_rsi = self.safe_float_extract(rsi.iloc[-1])
            latest_macd = self.safe_float_extract(macd_indicator.macd().iloc[-1])
            latest_macd_signal = self.safe_float_extract(macd_indicator.macd_signal().iloc[-1])
            latest_stoch_k = self.safe_float_extract(stoch_indicator.stoch().iloc[-1])
            latest_stoch_d = self.safe_float_extract(stoch_indicator.stoch_signal().iloc[-1])

            # Moving averages
            ema_20 = self.safe_float_extract(ta.trend.EMAIndicator(close=close, window=20).ema_indicator().iloc[-1])
            sma_50 = self.safe_float_extract(ta.trend.SMAIndicator(close=close, window=50).sma_indicator().iloc[-1])
            sma_200 = self.safe_float_extract(ta.trend.SMAIndicator(close=close, window=200).sma_indicator().iloc[-1])

            # Bollinger Bands
            bb_upper = self.safe_float_extract(bb_indicator.bollinger_hband().iloc[-1])
            bb_lower = self.safe_float_extract(bb_indicator.bollinger_lband().iloc[-1])
            bb_middle = self.safe_float_extract(bb_indicator.bollinger_mavg().iloc[-1])

            # ADX
            latest_adx = self.safe_float_extract(adx_indicator.adx().iloc[-1])
            latest_adx_pos = self.safe_float_extract(adx_indicator.adx_pos().iloc[-1])
            latest_adx_neg = self.safe_float_extract(adx_indicator.adx_neg().iloc[-1])

            # OBV and Volume
            latest_obv = self.safe_float_extract(obv_indicator.on_balance_volume().iloc[-1])
            volume_sma = self.safe_float_extract(volume.rolling(window=20).mean().iloc[-1])

            # ATR
            latest_atr = self.safe_float_extract(atr_indicator.average_true_range().iloc[-1])

            # Calculate technical score
            current_price = self.safe_float_extract(close.iloc[-1])
            technical_score = self._calculate_technical_score(
                current_price, latest_rsi, latest_macd, latest_macd_signal,
                ema_20, sma_50, sma_200, latest_stoch_k, latest_stoch_d,
                bb_upper, bb_lower, bb_middle, latest_adx, latest_adx_pos, latest_adx_neg
            )

            # Generate recommendation
            recommendation = self._get_technical_recommendation(technical_score)

            return TechnicalIndicators(
                symbol=symbol,
                rsi={
                    "name": "RSI",
                    "value": latest_rsi,
                    "signal": "Buy" if latest_rsi < 30 else "Sell" if latest_rsi > 70 else "Hold",
                    "description": "Relative Strength Index"
                },
                macd={
                    "macd": latest_macd,
                    "signal": latest_macd_signal,
                    "histogram": latest_macd - latest_macd_signal,
                    "trend": 1.0 if latest_macd > latest_macd_signal else 0.0
                },
                stochastic={
                    "k": latest_stoch_k,
                    "d": latest_stoch_d,
                    "signal": 1.0 if latest_stoch_k > latest_stoch_d and latest_stoch_k < 20 else -1.0 if latest_stoch_k < latest_stoch_d and latest_stoch_k > 80 else 0.0
                },
                ema_20=ema_20,
                sma_50=sma_50,
                sma_200=sma_200,
                bollinger_bands={
                    "upper": bb_upper,
                    "middle": bb_middle,
                    "lower": bb_lower,
                    "width": bb_upper - bb_lower,
                    "position": 1.0 if current_price > bb_middle else 0.0
                },
                atr=latest_atr,
                obv=latest_obv,
                volume_sma=volume_sma,
                adx=latest_adx,
                adx_di_plus=latest_adx_pos,
                adx_di_minus=latest_adx_neg,
                technical_score=technical_score,
                recommendation=recommendation,
                timestamp=datetime.utcnow()
            )

        except Exception as e:
            logger.error(f"Alpha Vantage technical indicators fallback failed for {symbol}: {e}")
            return None

    async def get_current_price(self, symbol: str) -> Optional[StockPrice]:
        """Get current stock price and basic information"""
        symbol = self.validate_symbol(symbol)
        cache_key = self.create_cache_key("stock_price", symbol)
        
        async def fetch_price():
            # Try yfinance first
            try:
                # Get current data with rate limiting
                hist = await self._fetch_yfinance_history(symbol, "2d", "1d")

                if hist.empty:
                    logger.warning(f"yfinance returned empty data for {symbol}, trying Alpha Vantage fallback")
                    return await self._fetch_price_fallback(symbol)

                info = await self._fetch_yfinance_info(symbol)
                
                current = hist.iloc[-1]
                previous = hist.iloc[-2] if len(hist) > 1 else current
                
                current_price = self.safe_float_extract(current['Close'])
                previous_close = self.safe_float_extract(previous['Close'])
                
                change = current_price - previous_close
                change_percent = (change / previous_close * 100) if previous_close != 0 else 0
                
                return StockPrice(
                    symbol=symbol,
                    current_price=current_price,
                    previous_close=previous_close,
                    change=self.format_percentage(change),
                    change_percent=self.format_percentage(change_percent),
                    day_high=self.safe_float_extract(current['High']),
                    day_low=self.safe_float_extract(current['Low']),
                    volume=int(current['Volume']),
                    market_cap=info.get('marketCap'),
                    timestamp=datetime.utcnow()
                )
                
            except Exception as e:
                logger.error(f"yfinance error for {symbol}: {e}, trying Alpha Vantage fallback")
                return await self._fetch_price_fallback(symbol)
        
        return await self.get_or_set_cache(cache_key, fetch_price, ttl=60)  # Cache for 1 minute
    
    async def get_technical_indicators(self, symbol: str, period: str = "1y") -> Optional[TechnicalIndicators]:
        """Get technical indicators for a stock"""
        symbol = self.validate_symbol(symbol)
        period = self.validate_timeframe(period, self.allowed_periods)
        
        cache_key = self.create_cache_key("technical", symbol, period)
        
        async def fetch_indicators():
            try:
                # Get historical data with rate limiting
                df = await self._fetch_yfinance_history(symbol, period, "1d")
                
                if df.empty or len(df) < 50:
                    logger.warning(f"yfinance returned insufficient data for {symbol}, trying Alpha Vantage fallback")
                    return await self._fetch_technical_indicators_fallback(symbol, period)
                
                close = df['Close']
                high = df['High']
                low = df['Low']
                volume = df['Volume']
                
                # Calculate indicators
                rsi = ta.momentum.RSIIndicator(close=close).rsi()
                macd_indicator = ta.trend.MACD(close)
                stoch_indicator = ta.momentum.StochasticOscillator(high=high, low=low, close=close)
                bb_indicator = ta.volatility.BollingerBands(close=close)
                adx_indicator = ta.trend.ADXIndicator(high=high, low=low, close=close, window=14)
                obv_indicator = ta.volume.OnBalanceVolumeIndicator(close=close, volume=volume)
                atr_indicator = ta.volatility.AverageTrueRange(high=high, low=low, close=close)
                
                # Get latest values
                latest_rsi = self.safe_float_extract(rsi.iloc[-1])
                latest_macd = self.safe_float_extract(macd_indicator.macd().iloc[-1])
                latest_macd_signal = self.safe_float_extract(macd_indicator.macd_signal().iloc[-1])
                latest_stoch_k = self.safe_float_extract(stoch_indicator.stoch().iloc[-1])
                latest_stoch_d = self.safe_float_extract(stoch_indicator.stoch_signal().iloc[-1])
                
                # Moving averages
                ema_20 = self.safe_float_extract(ta.trend.EMAIndicator(close=close, window=20).ema_indicator().iloc[-1])
                sma_50 = self.safe_float_extract(ta.trend.SMAIndicator(close=close, window=50).sma_indicator().iloc[-1])
                sma_200 = self.safe_float_extract(ta.trend.SMAIndicator(close=close, window=200).sma_indicator().iloc[-1])
                
                # Bollinger Bands
                bb_upper = self.safe_float_extract(bb_indicator.bollinger_hband().iloc[-1])
                bb_lower = self.safe_float_extract(bb_indicator.bollinger_lband().iloc[-1])
                bb_middle = self.safe_float_extract(bb_indicator.bollinger_mavg().iloc[-1])
                
                # ADX
                latest_adx = self.safe_float_extract(adx_indicator.adx().iloc[-1])
                latest_adx_pos = self.safe_float_extract(adx_indicator.adx_pos().iloc[-1])
                latest_adx_neg = self.safe_float_extract(adx_indicator.adx_neg().iloc[-1])
                
                # OBV and Volume
                latest_obv = self.safe_float_extract(obv_indicator.on_balance_volume().iloc[-1])
                volume_sma = self.safe_float_extract(volume.rolling(window=20).mean().iloc[-1])
                
                # ATR
                latest_atr = self.safe_float_extract(atr_indicator.average_true_range().iloc[-1])
                
                # Calculate technical score
                current_price = self.safe_float_extract(close.iloc[-1])
                technical_score = self._calculate_technical_score(
                    current_price, latest_rsi, latest_macd, latest_macd_signal,
                    ema_20, sma_50, sma_200, latest_stoch_k, latest_stoch_d,
                    bb_upper, bb_lower, bb_middle, latest_adx, latest_adx_pos, latest_adx_neg
                )
                
                # Generate recommendation
                recommendation = self._get_technical_recommendation(technical_score)
                
                return TechnicalIndicators(
                    symbol=symbol,
                    rsi={
                        "name": "RSI",
                        "value": latest_rsi,
                        "signal": "Buy" if latest_rsi < 30 else "Sell" if latest_rsi > 70 else "Hold",
                        "description": "Relative Strength Index"
                    },
                    macd={
                        "macd": latest_macd,
                        "signal": latest_macd_signal,
                        "histogram": latest_macd - latest_macd_signal,
                        "trend": 1.0 if latest_macd > latest_macd_signal else 0.0
                    },
                    stochastic={
                        "k": latest_stoch_k,
                        "d": latest_stoch_d,
                        "signal": 1.0 if latest_stoch_k > latest_stoch_d and latest_stoch_k < 20 else -1.0 if latest_stoch_k < latest_stoch_d and latest_stoch_k > 80 else 0.0
                    },
                    ema_20=ema_20,
                    sma_50=sma_50,
                    sma_200=sma_200,
                    bollinger_bands={
                        "upper": bb_upper,
                        "middle": bb_middle,
                        "lower": bb_lower,
                        "width": bb_upper - bb_lower,
                        "position": 1.0 if current_price > bb_middle else 0.0
                    },
                    atr=latest_atr,
                    obv=latest_obv,
                    volume_sma=volume_sma,
                    adx=latest_adx,
                    adx_di_plus=latest_adx_pos,
                    adx_di_minus=latest_adx_neg,
                    technical_score=technical_score,
                    recommendation=recommendation,
                    timestamp=datetime.utcnow()
                )
                
            except Exception as e:
                logger.error(f"yfinance error calculating technical indicators for {symbol}: {e}, trying Alpha Vantage fallback")
                return await self._fetch_technical_indicators_fallback(symbol, period)
        
        return await self.get_or_set_cache(cache_key, fetch_indicators, ttl=300)  # Cache for 5 minutes
    
    def _calculate_technical_score(self, price, rsi, macd, macd_signal, ema_20, sma_50, sma_200, 
                                 stoch_k, stoch_d, bb_upper, bb_lower, bb_middle, adx, adx_pos, adx_neg):
        """Calculate weighted technical analysis score"""
        criteria = {}
        
        # RSI signals
        criteria['RSI > 50'] = rsi > 50
        
        # MACD signals  
        criteria['MACD > Signal'] = macd > macd_signal
        
        # Moving average signals
        criteria['Price > EMA20 > SMA50'] = price > ema_20 > sma_50
        criteria['Golden Cross (SMA50 > SMA200)'] = sma_50 > sma_200 if sma_200 > 0 else False
        
        # Stochastic signals
        criteria['Stoch K > D'] = stoch_k > stoch_d
        
        # Bollinger Band signals
        criteria['Price > BB Lower'] = price > bb_lower
        criteria['Price Above BB Middle'] = price > bb_middle
        
        # ADX signals
        criteria['Strong Trend (ADX > 25)'] = adx > 25
        criteria['Bullish ADX (+DI > -DI)'] = adx_pos > adx_neg
        
        return self._calculate_weighted_score(criteria)
    
    def _calculate_weighted_score(self, criteria: Dict[str, bool]) -> float:
        """Calculate weighted technical score using default weights"""
        weights = settings.DEFAULT_WEIGHTS
        
        weight_mapping = {
            'RSI > 50': 'RSI',
            'MACD > Signal': 'MACD',
            'Price > EMA20 > SMA50': 'EMA20',
            'Golden Cross (SMA50 > SMA200)': 'SMA200',
            'Stoch K > D': 'Stoch',
            'Price > BB Lower': 'Bollinger',
            'Price Above BB Middle': 'Bollinger',
            'Strong Trend (ADX > 25)': 'ADX',
            'Bullish ADX (+DI > -DI)': 'ADX'
        }
        
        weighted_score = 0.0
        category_totals = {}
        category_achieved = {}
        
        # Initialize category tracking
        for category in weights.keys():
            category_totals[category] = 0
            category_achieved[category] = 0
        
        # Calculate weighted contributions
        for criterion, result in criteria.items():
            if criterion in weight_mapping:
                category = weight_mapping[criterion]
                category_totals[category] += 1
                if result:
                    category_achieved[category] += 1
        
        # Calculate final weighted score
        for category, weight in weights.items():
            if category_totals[category] > 0:
                category_score = category_achieved[category] / category_totals[category]
                weighted_score += weight * category_score
        
        return min(1.0, max(0.0, weighted_score))  # Ensure 0-1 range
    
    def _get_technical_recommendation(self, score: float) -> str:
        """Get recommendation based on technical score"""
        if score >= 0.8:
            return "Strong Buy"
        elif score >= 0.6:
            return "Buy"
        elif score >= 0.4:
            return "Hold"
        elif score >= 0.2:
            return "Sell"
        else:
            return "Strong Sell"
    
    async def get_lstm_prediction(self, symbol: str, days: int = 5) -> Optional[LSTMPrediction]:
        """Get LSTM price predictions for a stock"""
        # This is a placeholder - the actual LSTM implementation will be migrated
        # from the original script in the next phase
        symbol = self.validate_symbol(symbol)
        cache_key = self.create_cache_key("lstm", symbol, days)
        
        async def fetch_prediction():
            # Placeholder implementation
            logger.info(f"LSTM prediction requested for {symbol} ({days} days) - using mock data")
            
            try:
                # Get current price for baseline
                current_price_data = await self.get_current_price(symbol)
                if not current_price_data:
                    return None
                
                current_price = current_price_data.current_price
                
                # Mock predictions (will be replaced with actual LSTM model)
                predictions = []
                prediction_dates = []
                confidence_intervals = []
                
                for i in range(1, days + 1):
                    # Simple random walk simulation for demo
                    change = np.random.normal(0.001, 0.02)  # Small random change
                    predicted_price = current_price * (1 + change) ** i
                    predictions.append(predicted_price)
                    
                    future_date = (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d")
                    prediction_dates.append(future_date)
                    
                    # Mock confidence intervals
                    confidence_intervals.append({
                        "lower": predicted_price * 0.95,
                        "upper": predicted_price * 1.05,
                        "confidence": 0.95
                    })
                
                # Calculate metrics
                predicted_return_5d = ((predictions[-1] - current_price) / current_price) * 100
                
                # Mock LSTM signal based on prediction
                lstm_signal = 0.0
                if predicted_return_5d > 5:
                    lstm_signal = 1.0
                elif predicted_return_5d > 2:
                    lstm_signal = 0.75
                elif predicted_return_5d > 0:
                    lstm_signal = 0.5
                elif predicted_return_5d > -2:
                    lstm_signal = 0.25
                else:
                    lstm_signal = 0.0
                
                trend_direction = "Bullish" if predicted_return_5d > 0 else "Bearish"
                
                return LSTMPrediction(
                    symbol=symbol,
                    current_price=current_price,
                    predictions=predictions,
                    prediction_dates=prediction_dates,
                    confidence_intervals=confidence_intervals,
                    model_accuracy=85.0,  # Mock accuracy
                    mae=2.5,  # Mock MAE
                    mse=8.3,  # Mock MSE
                    predicted_return_5d=predicted_return_5d,
                    lstm_signal=lstm_signal,
                    trend_direction=trend_direction,
                    timestamp=datetime.utcnow()
                )
                
            except Exception as e:
                logger.error(f"Error generating LSTM prediction for {symbol}: {e}")
                return None
        
        return await self.get_or_set_cache(cache_key, fetch_prediction, ttl=3600)  # Cache for 1 hour
    
    async def get_sentiment_analysis(self, symbol: str):
        """Get sentiment analysis for a stock (placeholder)"""
        # This will be implemented by the sentiment service
        return None
    
    def calculate_analysis_score(self, technical_data, lstm_data, sentiment_data) -> float:
        """Calculate comprehensive analysis score"""
        scores = []
        weights = []

        if technical_data and hasattr(technical_data, 'technical_score'):
            scores.append(technical_data.technical_score)
            weights.append(0.5)

        if lstm_data and hasattr(lstm_data, 'lstm_signal'):
            scores.append(lstm_data.lstm_signal)
            weights.append(0.4)

        if sentiment_data:
            # This will be implemented when sentiment service is ready
            pass

        if not scores:
            return 0.0

        # Weighted average
        total_weight = sum(weights)
        weighted_sum = sum(score * weight for score, weight in zip(scores, weights))

        return weighted_sum / total_weight if total_weight > 0 else 0.0
    
    def get_recommendation(self, score: float) -> RecommendationType:
        """Get investment recommendation based on analysis score"""
        if score >= 0.8:
            return RecommendationType.STRONG_BUY
        elif score >= 0.6:
            return RecommendationType.BUY
        elif score >= 0.4:
            return RecommendationType.HOLD
        elif score >= 0.2:
            return RecommendationType.SELL
        else:
            return RecommendationType.STRONG_SELL
    
    async def get_price_history(self, symbol: str, period: str, interval: str) -> Optional[List[Dict]]:
        """Get historical price data"""
        symbol = self.validate_symbol(symbol)
        period = self.validate_timeframe(period, self.allowed_periods)
        interval = self.validate_timeframe(interval, self.allowed_intervals)
        
        cache_key = self.create_cache_key("history", symbol, period, interval)
        
        async def fetch_history():
            try:
                # Get historical data with rate limiting
                df = await self._fetch_yfinance_history(symbol, period, interval)
                
                if df.empty:
                    logger.warning(f"yfinance returned empty data for {symbol}, trying Alpha Vantage fallback")
                    df = await self._fetch_history_fallback(symbol, period, interval)
                    if df is None or df.empty:
                        return None
                
                history = []
                for index, row in df.iterrows():
                    history.append({
                        "date": index.strftime("%Y-%m-%d %H:%M:%S"),
                        "open": self.safe_float_extract(row['Open']),
                        "high": self.safe_float_extract(row['High']),
                        "low": self.safe_float_extract(row['Low']),
                        "close": self.safe_float_extract(row['Close']),
                        "volume": int(row['Volume']),
                        "adjusted_close": self.safe_float_extract(row.get('Adj Close', row['Close']))
                    })
                
                return history
                
            except Exception as e:
                logger.error(f"yfinance error fetching price history for {symbol}: {e}, trying Alpha Vantage fallback")
                try:
                    df = await self._fetch_history_fallback(symbol, period, interval)
                    if df is None or df.empty:
                        return None

                    history = []
                    for index, row in df.iterrows():
                        history.append({
                            "date": index.strftime("%Y-%m-%d %H:%M:%S"),
                            "open": self.safe_float_extract(row['Open']),
                            "high": self.safe_float_extract(row['High']),
                            "low": self.safe_float_extract(row['Low']),
                            "close": self.safe_float_extract(row['Close']),
                            "volume": int(row['Volume']),
                            "adjusted_close": self.safe_float_extract(row.get('Adj Close', row['Close']))
                        })

                    return history
                except Exception as fallback_e:
                    logger.error(f"Alpha Vantage fallback also failed for {symbol}: {fallback_e}")
                    return None
        
        return await self.get_or_set_cache(cache_key, fetch_history, ttl=600)  # Cache for 10 minutes
    
    async def get_comprehensive_analysis_data(self, symbol: str, period: str, 
                                            include_sentiment: bool, prediction_days: int):
        """Get comprehensive analysis data for batch processing"""
        try:
            # Run all analyses concurrently
            tasks = [
                self.get_current_price(symbol),
                self.get_technical_indicators(symbol, period),
                self.get_lstm_prediction(symbol, prediction_days)
            ]
            
            if include_sentiment:
                tasks.append(self.get_sentiment_analysis(symbol))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            price_data = results[0] if not isinstance(results[0], Exception) else None
            technical_data = results[1] if not isinstance(results[1], Exception) else None
            lstm_data = results[2] if not isinstance(results[2], Exception) else None
            sentiment_data = results[3] if len(results) > 3 and not isinstance(results[3], Exception) else None
            
            if not price_data:
                raise ValueError(f"Unable to fetch price data for {symbol}")
            
            # Calculate comprehensive score
            analysis_score = self.calculate_analysis_score(technical_data, lstm_data, sentiment_data)
            
            return StockAnalysisResponse(
                symbol=symbol,
                timestamp=datetime.utcnow(),
                price=price_data,
                technical_indicators=technical_data,
                lstm_prediction=lstm_data,
                sentiment_analysis=sentiment_data,
                analysis_score=analysis_score,
                recommendation=self.get_recommendation(analysis_score),
                confidence_level=0.8,  # Mock confidence level
                key_factors=self._extract_key_factors(technical_data, lstm_data),
                warnings=self._extract_warnings(technical_data, lstm_data)
            )
            
        except Exception as e:
            logger.error(f"Error in comprehensive analysis for {symbol}: {e}")
            raise
    
    def _extract_key_factors(self, technical_data, lstm_data) -> List[str]:
        """Extract key factors affecting the analysis"""
        factors = []

        if technical_data and hasattr(technical_data, 'technical_score'):
            if technical_data.technical_score > 0.7:
                factors.append("Strong technical indicators")
            if hasattr(technical_data, 'rsi') and hasattr(technical_data.rsi, 'value'):
                if technical_data.rsi.value > 70:
                    factors.append("Overbought RSI levels")
                elif technical_data.rsi.value < 30:
                    factors.append("Oversold RSI levels")

        if lstm_data and hasattr(lstm_data, 'predicted_return_5d'):
            if lstm_data.predicted_return_5d > 5:
                factors.append("Strong LSTM price prediction")
            elif lstm_data.predicted_return_5d < -5:
                factors.append("Negative LSTM outlook")

        return factors
    
    def _extract_warnings(self, technical_data, lstm_data) -> List[str]:
        """Extract warnings or risk factors"""
        warnings = []

        if technical_data and hasattr(technical_data, 'technical_score'):
            if technical_data.technical_score < 0.3:
                warnings.append("Weak technical indicators")
            if hasattr(technical_data, 'adx') and technical_data.adx < 20:
                warnings.append("Low trend strength")

        if lstm_data and hasattr(lstm_data, 'model_accuracy'):
            if lstm_data.model_accuracy < 70:
                warnings.append("Low model confidence")

        return warnings

    async def get_enhanced_technical_indicators(self, symbol: str, period: str = "1y") -> Optional[Dict[str, Any]]:
        """Get enhanced technical indicators using both TA-Lib and ta library"""
        symbol = self.validate_symbol(symbol)
        period = self.validate_timeframe(period, self.allowed_periods)

        cache_key = self.create_cache_key("enhanced_technical", symbol, period)

        async def fetch_enhanced_indicators():
            try:
                # Get historical data with rate limiting
                df = await self._fetch_yfinance_history(symbol, period, "1d")

                if df.empty or len(df) < 50:
                    logger.warning(f"yfinance returned insufficient data for {symbol}, trying Alpha Vantage fallback")
                    df = await self._fetch_history_fallback(symbol, period, "1d")
                    if df is None or df.empty:
                        return None

                current_price = self.safe_float_extract(df['Close'].iloc[-1])

                # Use enhanced technical analysis service
                score, analysis_details = technical_analysis_service.generate_enhanced_technical_score(df, current_price)
                recommendation = technical_analysis_service.get_enhanced_recommendation(score, analysis_details.get('signals', {}))

                # Combine with existing indicators for backward compatibility
                traditional_indicators = await self.get_technical_indicators(symbol, period)

                enhanced_result = {
                    'symbol': symbol,
                    'current_price': current_price,
                    'enhanced_score': score,
                    'enhanced_recommendation': recommendation.value,
                    'analysis_details': analysis_details,
                    'traditional_indicators': traditional_indicators,
                    'timestamp': datetime.utcnow().isoformat()
                }

                return enhanced_result

            except Exception as e:
                logger.error(f"Error calculating enhanced technical indicators for {symbol}: {e}")
                return None

        return await self.get_or_set_cache(cache_key, fetch_enhanced_indicators, ttl=300)  # Cache for 5 minutes


# Global instance
stock_service = StockService()