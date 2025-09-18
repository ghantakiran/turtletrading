"""
Enhanced Technical Analysis Service with TA-Lib integration
Combines TA-Lib and ta library for comprehensive indicator analysis
"""

import talib
import ta
import pandas as pd
import numpy as np
from typing import Optional, Dict, List, Any, Tuple
from datetime import datetime, timedelta
from loguru import logger

from app.services.base_service import BaseService
from app.models.stock_schemas import TechnicalIndicators, RecommendationType
from app.core.config import settings


class TechnicalAnalysisService(BaseService):
    """Enhanced technical analysis service using both TA-Lib and ta library"""

    def __init__(self):
        super().__init__()
        self.talib_indicators = {
            'momentum': ['RSI', 'CCI', 'MFI', 'WILLR', 'ROC', 'MOM'],
            'trend': ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'T3'],
            'volatility': ['ATR', 'NATR', 'TRANGE'],
            'volume': ['AD', 'ADOSC'],
            'pattern': ['CDL2CROWS', 'CDL3BLACKCROWS', 'CDL3INSIDE', 'CDL3LINESTRIKE', 'CDL3OUTSIDE', 'CDL3STARSINSOUTH', 'CDL3WHITESOLDIERS']
        }

    def calculate_talib_indicators(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate TA-Lib indicators"""
        try:
            high = df['High'].values
            low = df['Low'].values
            close = df['Close'].values
            volume = df['Volume'].values

            indicators = {}

            # Momentum indicators
            indicators['rsi_talib'] = talib.RSI(close, timeperiod=14)
            indicators['cci'] = talib.CCI(high, low, close, timeperiod=14)
            indicators['mfi'] = talib.MFI(high, low, close, volume, timeperiod=14)
            indicators['willr'] = talib.WILLR(high, low, close, timeperiod=14)
            indicators['roc'] = talib.ROC(close, timeperiod=10)
            indicators['momentum'] = talib.MOM(close, timeperiod=10)

            # Trend indicators
            indicators['sma_10'] = talib.SMA(close, timeperiod=10)
            indicators['sma_20'] = talib.SMA(close, timeperiod=20)
            indicators['sma_50'] = talib.SMA(close, timeperiod=50)
            indicators['sma_200'] = talib.SMA(close, timeperiod=200)
            indicators['ema_12'] = talib.EMA(close, timeperiod=12)
            indicators['ema_26'] = talib.EMA(close, timeperiod=26)
            indicators['wma_14'] = talib.WMA(close, timeperiod=14)
            indicators['dema'] = talib.DEMA(close, timeperiod=30)
            indicators['tema'] = talib.TEMA(close, timeperiod=30)
            indicators['kama'] = talib.KAMA(close, timeperiod=30)

            # MACD
            indicators['macd'], indicators['macd_signal'], indicators['macd_hist'] = talib.MACD(close, fastperiod=12, slowperiod=26, signalperiod=9)

            # Bollinger Bands
            indicators['bb_upper'], indicators['bb_middle'], indicators['bb_lower'] = talib.BBANDS(close, timeperiod=20, nbdevup=2, nbdevdn=2, matype=0)

            # Stochastic
            indicators['stoch_k'], indicators['stoch_d'] = talib.STOCH(high, low, close, fastk_period=14, slowk_period=3, slowk_matype=0, slowd_period=3, slowd_matype=0)

            # ADX
            indicators['adx'] = talib.ADX(high, low, close, timeperiod=14)
            indicators['adx_plus_di'] = talib.PLUS_DI(high, low, close, timeperiod=14)
            indicators['adx_minus_di'] = talib.MINUS_DI(high, low, close, timeperiod=14)

            # Volatility indicators
            indicators['atr'] = talib.ATR(high, low, close, timeperiod=14)
            indicators['natr'] = talib.NATR(high, low, close, timeperiod=14)

            # Volume indicators
            indicators['ad'] = talib.AD(high, low, close, volume)
            indicators['adosc'] = talib.ADOSC(high, low, close, volume, fastperiod=3, slowperiod=10)

            # Parabolic SAR
            indicators['sar'] = talib.SAR(high, low, acceleration=0.02, maximum=0.2)

            # Commodity Channel Index
            indicators['cci'] = talib.CCI(high, low, close, timeperiod=14)

            # Ultimate Oscillator
            indicators['ultosc'] = talib.ULTOSC(high, low, close, timeperiod1=7, timeperiod2=14, timeperiod3=28)

            # Aroon
            indicators['aroon_down'], indicators['aroon_up'] = talib.AROON(high, low, timeperiod=14)
            indicators['aroonosc'] = talib.AROONOSC(high, low, timeperiod=14)

            # Balance of Power
            indicators['bop'] = talib.BOP(df['Open'].values, high, low, close)

            # Price patterns (candlestick patterns)
            indicators['doji'] = talib.CDLDOJI(df['Open'].values, high, low, close)
            indicators['hammer'] = talib.CDLHAMMER(df['Open'].values, high, low, close)
            indicators['hanging_man'] = talib.CDLHANGINGMAN(df['Open'].values, high, low, close)
            indicators['shooting_star'] = talib.CDLSHOOTINGSTAR(df['Open'].values, high, low, close)
            indicators['engulfing'] = talib.CDLENGULFING(df['Open'].values, high, low, close)
            indicators['morning_star'] = talib.CDLMORNINGSTAR(df['Open'].values, high, low, close)
            indicators['evening_star'] = talib.CDLEVENINGSTAR(df['Open'].values, high, low, close)

            return indicators

        except Exception as e:
            logger.error(f"Error calculating TA-Lib indicators: {e}")
            return {}

    def calculate_ta_indicators(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate ta library indicators for comparison"""
        try:
            indicators = {}

            close = df['Close']
            high = df['High']
            low = df['Low']
            volume = df['Volume']

            # Momentum indicators
            indicators['rsi_ta'] = ta.momentum.RSIIndicator(close=close).rsi()
            indicators['stoch_ta'] = ta.momentum.StochasticOscillator(high=high, low=low, close=close)
            indicators['williams_r'] = ta.momentum.WilliamsRIndicator(high=high, low=low, close=close).williams_r()
            indicators['roc_ta'] = ta.momentum.ROCIndicator(close=close).roc()

            # Trend indicators
            indicators['sma_ta'] = ta.trend.SMAIndicator(close=close, window=20).sma_indicator()
            indicators['ema_ta'] = ta.trend.EMAIndicator(close=close, window=20).ema_indicator()
            indicators['macd_ta'] = ta.trend.MACD(close=close)
            indicators['adx_ta'] = ta.trend.ADXIndicator(high=high, low=low, close=close)

            # Volatility indicators
            indicators['bb_ta'] = ta.volatility.BollingerBands(close=close)
            indicators['atr_ta'] = ta.volatility.AverageTrueRange(high=high, low=low, close=close)
            indicators['keltner'] = ta.volatility.KeltnerChannel(high=high, low=low, close=close)

            # Volume indicators
            indicators['obv_ta'] = ta.volume.OnBalanceVolumeIndicator(close=close, volume=volume).on_balance_volume()
            indicators['cmf'] = ta.volume.ChaikinMoneyFlowIndicator(high=high, low=low, close=close, volume=volume).chaikin_money_flow()
            indicators['vpt'] = ta.volume.VolumePriceTrendIndicator(close=close, volume=volume).volume_price_trend()

            return indicators

        except Exception as e:
            logger.error(f"Error calculating ta library indicators: {e}")
            return {}

    def calculate_comprehensive_indicators(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate comprehensive indicators using both libraries"""
        try:
            if df.empty or len(df) < 50:
                logger.warning("Insufficient data for comprehensive technical analysis")
                return {}

            # Calculate indicators from both libraries
            talib_indicators = self.calculate_talib_indicators(df)
            ta_indicators = self.calculate_ta_indicators(df)

            # Combine and get latest values
            latest_indicators = {}

            # TA-Lib indicators (latest values)
            for key, values in talib_indicators.items():
                if isinstance(values, np.ndarray) and len(values) > 0:
                    latest_indicators[key] = self.safe_float_extract(values[-1])

            # ta library indicators (latest values)
            for key, values in ta_indicators.items():
                if hasattr(values, 'iloc'):
                    latest_indicators[key] = self.safe_float_extract(values.iloc[-1])
                elif hasattr(values, 'adx'):
                    # Handle ADX object
                    latest_indicators[f'{key}_value'] = self.safe_float_extract(values.adx().iloc[-1])
                    latest_indicators[f'{key}_pos'] = self.safe_float_extract(values.adx_pos().iloc[-1])
                    latest_indicators[f'{key}_neg'] = self.safe_float_extract(values.adx_neg().iloc[-1])
                elif hasattr(values, 'macd'):
                    # Handle MACD object
                    latest_indicators[f'{key}_macd'] = self.safe_float_extract(values.macd().iloc[-1])
                    latest_indicators[f'{key}_signal'] = self.safe_float_extract(values.macd_signal().iloc[-1])
                    latest_indicators[f'{key}_diff'] = self.safe_float_extract(values.macd_diff().iloc[-1])
                elif hasattr(values, 'bollinger_hband'):
                    # Handle Bollinger Bands object
                    latest_indicators[f'{key}_upper'] = self.safe_float_extract(values.bollinger_hband().iloc[-1])
                    latest_indicators[f'{key}_middle'] = self.safe_float_extract(values.bollinger_mavg().iloc[-1])
                    latest_indicators[f'{key}_lower'] = self.safe_float_extract(values.bollinger_lband().iloc[-1])
                elif hasattr(values, 'stoch'):
                    # Handle Stochastic object
                    latest_indicators[f'{key}_k'] = self.safe_float_extract(values.stoch().iloc[-1])
                    latest_indicators[f'{key}_d'] = self.safe_float_extract(values.stoch_signal().iloc[-1])
                elif hasattr(values, 'average_true_range'):
                    # Handle ATR object
                    latest_indicators[f'{key}_value'] = self.safe_float_extract(values.average_true_range().iloc[-1])

            return latest_indicators

        except Exception as e:
            logger.error(f"Error calculating comprehensive indicators: {e}")
            return {}

    def generate_enhanced_technical_score(self, df: pd.DataFrame, current_price: float) -> Tuple[float, Dict[str, Any]]:
        """Generate enhanced technical score using both libraries"""
        try:
            indicators = self.calculate_comprehensive_indicators(df)

            if not indicators:
                return 0.0, {}

            # Enhanced scoring criteria
            criteria = {}
            signals = {}

            # RSI analysis (comparing both libraries)
            rsi_talib = indicators.get('rsi_talib', 50)
            rsi_ta = indicators.get('rsi_ta', 50)
            rsi_avg = (rsi_talib + rsi_ta) / 2

            criteria['RSI Bullish'] = rsi_avg > 50 and rsi_avg < 70
            criteria['RSI Oversold Recovery'] = rsi_avg > 30 and rsi_avg < 50
            signals['rsi'] = {
                'talib': rsi_talib,
                'ta': rsi_ta,
                'average': rsi_avg,
                'signal': 'Buy' if rsi_avg < 30 else 'Sell' if rsi_avg > 70 else 'Hold'
            }

            # MACD analysis
            macd_talib = indicators.get('macd', 0)
            macd_signal_talib = indicators.get('macd_signal', 0)
            macd_ta = indicators.get('macd_ta_macd', 0)
            macd_signal_ta = indicators.get('macd_ta_signal', 0)

            criteria['MACD Bullish (TA-Lib)'] = macd_talib > macd_signal_talib
            criteria['MACD Bullish (ta)'] = macd_ta > macd_signal_ta
            signals['macd'] = {
                'talib_bullish': macd_talib > macd_signal_talib,
                'ta_bullish': macd_ta > macd_signal_ta,
                'consensus': (macd_talib > macd_signal_talib) and (macd_ta > macd_signal_ta)
            }

            # Moving averages analysis
            sma_20_talib = indicators.get('sma_20', current_price)
            sma_50_talib = indicators.get('sma_50', current_price)
            sma_200_talib = indicators.get('sma_200', current_price)
            ema_ta = indicators.get('ema_ta', current_price)

            criteria['Price Above SMA20'] = current_price > sma_20_talib
            criteria['Price Above SMA50'] = current_price > sma_50_talib
            criteria['Golden Cross'] = sma_50_talib > sma_200_talib
            criteria['Price Above EMA'] = current_price > ema_ta

            # Bollinger Bands analysis
            bb_upper = indicators.get('bb_upper', current_price)
            bb_middle = indicators.get('bb_middle', current_price)
            bb_lower = indicators.get('bb_lower', current_price)

            criteria['Above BB Middle'] = current_price > bb_middle
            criteria['Not Overbought (BB)'] = current_price < bb_upper
            signals['bollinger'] = {
                'position': 'Upper' if current_price > bb_upper else 'Lower' if current_price < bb_lower else 'Middle',
                'width': bb_upper - bb_lower if bb_upper and bb_lower else 0
            }

            # ADX trend strength
            adx_talib = indicators.get('adx', 0)
            adx_plus = indicators.get('adx_plus_di', 0)
            adx_minus = indicators.get('adx_minus_di', 0)

            criteria['Strong Trend'] = adx_talib > 25
            criteria['Bullish Momentum'] = adx_plus > adx_minus
            signals['adx'] = {
                'strength': adx_talib,
                'trend': 'Bullish' if adx_plus > adx_minus else 'Bearish',
                'strong': adx_talib > 25
            }

            # Volume analysis
            obv = indicators.get('obv_ta', 0)
            cmf = indicators.get('cmf', 0)
            criteria['Positive Volume Flow'] = cmf > 0

            # Stochastic analysis
            stoch_k_talib = indicators.get('stoch_k', 50)
            stoch_d_talib = indicators.get('stoch_d', 50)
            criteria['Stoch Bullish'] = stoch_k_talib > stoch_d_talib and stoch_k_talib < 80

            # Candlestick patterns
            patterns = {}
            pattern_indicators = ['doji', 'hammer', 'shooting_star', 'engulfing', 'morning_star', 'evening_star']
            for pattern in pattern_indicators:
                if pattern in indicators:
                    patterns[pattern] = indicators[pattern] != 0

            # Calculate weighted score
            score = self._calculate_enhanced_weighted_score(criteria)

            analysis_details = {
                'criteria': criteria,
                'signals': signals,
                'patterns': patterns,
                'indicators': indicators
            }

            return score, analysis_details

        except Exception as e:
            logger.error(f"Error generating enhanced technical score: {e}")
            return 0.0, {}

    def _calculate_enhanced_weighted_score(self, criteria: Dict[str, bool]) -> float:
        """Calculate enhanced weighted score with improved criteria"""
        enhanced_weights = {
            'RSI Bullish': 0.10,
            'RSI Oversold Recovery': 0.08,
            'MACD Bullish (TA-Lib)': 0.12,
            'MACD Bullish (ta)': 0.08,
            'Price Above SMA20': 0.10,
            'Price Above SMA50': 0.08,
            'Golden Cross': 0.08,
            'Price Above EMA': 0.06,
            'Above BB Middle': 0.08,
            'Not Overbought (BB)': 0.06,
            'Strong Trend': 0.08,
            'Bullish Momentum': 0.08,
            'Positive Volume Flow': 0.06,
            'Stoch Bullish': 0.06
        }

        weighted_score = 0.0
        total_weight = 0.0

        for criterion, is_true in criteria.items():
            weight = enhanced_weights.get(criterion, 0.0)
            if weight > 0:
                weighted_score += weight if is_true else 0
                total_weight += weight

        return (weighted_score / total_weight * 100) if total_weight > 0 else 0.0

    def get_enhanced_recommendation(self, score: float, signals: Dict[str, Any]) -> RecommendationType:
        """Get enhanced recommendation based on score and signals"""
        try:
            # Check for strong consensus signals
            rsi_signal = signals.get('rsi', {}).get('signal', 'Hold')
            macd_consensus = signals.get('macd', {}).get('consensus', False)
            bb_position = signals.get('bollinger', {}).get('position', 'Middle')
            adx_strong = signals.get('adx', {}).get('strong', False)
            adx_trend = signals.get('adx', {}).get('trend', 'Neutral')

            # Strong buy conditions
            if (score >= 80 and macd_consensus and
                rsi_signal in ['Buy', 'Hold'] and
                adx_strong and adx_trend == 'Bullish'):
                return RecommendationType.STRONG_BUY

            # Buy conditions
            elif score >= 65 and (macd_consensus or rsi_signal == 'Buy'):
                return RecommendationType.BUY

            # Strong sell conditions
            elif (score <= 20 and rsi_signal == 'Sell' and
                  bb_position == 'Upper' and adx_trend == 'Bearish'):
                return RecommendationType.STRONG_SELL

            # Sell conditions
            elif score <= 35 and rsi_signal == 'Sell':
                return RecommendationType.SELL

            # Default hold
            else:
                return RecommendationType.HOLD

        except Exception as e:
            logger.error(f"Error generating enhanced recommendation: {e}")
            return RecommendationType.HOLD


# Global instance
technical_analysis_service = TechnicalAnalysisService()