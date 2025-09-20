"""
Trading Insights Generator for TurtleTrading LLM System

Specialized service for generating actionable trading insights, signals,
and opportunity identification using AI analysis of technical and fundamental data.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import redis.asyncio as redis
from dataclasses import dataclass
import numpy as np
import pandas as pd
import yfinance as yf

from ..models.llm_narrative_models import (
    NarrativeRequest, GeneratedNarrative, NarrativeType, TradingInsight,
    TradingRecommendation, InsightPriority, NarrativeContext,
    MarketData, NarrativeTone, NarrativeLength
)
from .narrative_generation_engine import NarrativeGenerationEngine

logger = logging.getLogger(__name__)


@dataclass
class TechnicalSignal:
    """Technical analysis signal"""
    signal_type: str
    strength: float  # 0.0 to 1.0
    direction: str  # bullish, bearish, neutral
    timeframe: str  # short, medium, long
    confidence: float
    supporting_indicators: List[str]
    price_target: Optional[float] = None
    stop_loss: Optional[float] = None


@dataclass
class TradingOpportunity:
    """Trading opportunity identification"""
    symbol: str
    opportunity_type: str  # breakout, reversal, continuation, etc.
    entry_price: float
    target_price: float
    stop_loss: float
    risk_reward_ratio: float
    probability: float
    catalyst: str
    timeframe: str
    position_size_recommendation: float


class TechnicalAnalyzer:
    """Advanced technical analysis for trading insights"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def analyze_symbol(self, symbol: str, timeframe: str = "daily") -> Dict[str, Any]:
        """Comprehensive technical analysis of a symbol"""
        try:
            # Get historical data
            ticker = yf.Ticker(symbol)

            # Get different timeframes
            if timeframe == "daily":
                hist = ticker.history(period="6mo")
            elif timeframe == "weekly":
                hist = ticker.history(period="2y", interval="1wk")
            else:
                hist = ticker.history(period="1mo", interval="1h")

            if hist.empty:
                return {}

            # Calculate technical indicators
            analysis = {
                "symbol": symbol,
                "current_price": float(hist['Close'].iloc[-1]),
                "volume": float(hist['Volume'].iloc[-1]),
                "technical_indicators": await self._calculate_indicators(hist),
                "signals": await self._generate_signals(hist),
                "support_resistance": await self._find_support_resistance(hist),
                "patterns": await self._identify_patterns(hist),
                "momentum": await self._analyze_momentum(hist),
                "volatility": await self._analyze_volatility(hist)
            }

            return analysis

        except Exception as e:
            logger.error(f"Error analyzing {symbol}: {e}")
            return {}

    async def _calculate_indicators(self, hist: pd.DataFrame) -> Dict[str, Any]:
        """Calculate comprehensive technical indicators"""
        indicators = {}

        try:
            close = hist['Close']
            high = hist['High']
            low = hist['Low']
            volume = hist['Volume']

            # Moving averages
            indicators['sma_20'] = float(close.rolling(20).mean().iloc[-1])
            indicators['sma_50'] = float(close.rolling(50).mean().iloc[-1])
            indicators['sma_200'] = float(close.rolling(200).mean().iloc[-1])
            indicators['ema_12'] = float(close.ewm(span=12).mean().iloc[-1])
            indicators['ema_26'] = float(close.ewm(span=26).mean().iloc[-1])

            # RSI
            delta = close.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            indicators['rsi'] = float(100 - (100 / (1 + rs.iloc[-1])))

            # MACD
            ema_12 = close.ewm(span=12).mean()
            ema_26 = close.ewm(span=26).mean()
            macd_line = ema_12 - ema_26
            signal_line = macd_line.ewm(span=9).mean()
            indicators['macd'] = float(macd_line.iloc[-1])
            indicators['macd_signal'] = float(signal_line.iloc[-1])
            indicators['macd_histogram'] = float((macd_line - signal_line).iloc[-1])

            # Bollinger Bands
            bb_middle = close.rolling(20).mean()
            bb_std = close.rolling(20).std()
            indicators['bb_upper'] = float((bb_middle + 2 * bb_std).iloc[-1])
            indicators['bb_lower'] = float((bb_middle - 2 * bb_std).iloc[-1])
            indicators['bb_position'] = float((close.iloc[-1] - indicators['bb_lower']) /
                                            (indicators['bb_upper'] - indicators['bb_lower']))

            # Stochastic
            lowest_low = low.rolling(14).min()
            highest_high = high.rolling(14).max()
            k_percent = 100 * ((close - lowest_low) / (highest_high - lowest_low))
            indicators['stoch_k'] = float(k_percent.iloc[-1])
            indicators['stoch_d'] = float(k_percent.rolling(3).mean().iloc[-1])

            # ATR
            tr1 = high - low
            tr2 = abs(high - close.shift())
            tr3 = abs(low - close.shift())
            true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
            indicators['atr'] = float(true_range.rolling(14).mean().iloc[-1])

            # Volume indicators
            indicators['volume_sma'] = float(volume.rolling(20).mean().iloc[-1])
            indicators['volume_ratio'] = float(volume.iloc[-1] / indicators['volume_sma'])

        except Exception as e:
            logger.error(f"Error calculating indicators: {e}")

        return indicators

    async def _generate_signals(self, hist: pd.DataFrame) -> List[TechnicalSignal]:
        """Generate trading signals from technical analysis"""
        signals = []

        try:
            close = hist['Close']
            indicators = await self._calculate_indicators(hist)

            # RSI signals
            rsi = indicators.get('rsi', 50)
            if rsi > 70:
                signals.append(TechnicalSignal(
                    signal_type="RSI_Overbought",
                    strength=min(1.0, (rsi - 70) / 20),
                    direction="bearish",
                    timeframe="short",
                    confidence=0.7,
                    supporting_indicators=["RSI"]
                ))
            elif rsi < 30:
                signals.append(TechnicalSignal(
                    signal_type="RSI_Oversold",
                    strength=min(1.0, (30 - rsi) / 20),
                    direction="bullish",
                    timeframe="short",
                    confidence=0.7,
                    supporting_indicators=["RSI"]
                ))

            # MACD signals
            macd = indicators.get('macd', 0)
            macd_signal = indicators.get('macd_signal', 0)
            if macd > macd_signal and macd > 0:
                signals.append(TechnicalSignal(
                    signal_type="MACD_Bullish",
                    strength=0.8,
                    direction="bullish",
                    timeframe="medium",
                    confidence=0.75,
                    supporting_indicators=["MACD"]
                ))

            # Moving average signals
            current_price = float(close.iloc[-1])
            sma_20 = indicators.get('sma_20', current_price)
            sma_50 = indicators.get('sma_50', current_price)

            if current_price > sma_20 > sma_50:
                signals.append(TechnicalSignal(
                    signal_type="MA_Uptrend",
                    strength=0.8,
                    direction="bullish",
                    timeframe="medium",
                    confidence=0.8,
                    supporting_indicators=["SMA_20", "SMA_50"]
                ))

            # Bollinger Band signals
            bb_position = indicators.get('bb_position', 0.5)
            if bb_position > 0.95:
                signals.append(TechnicalSignal(
                    signal_type="BB_Upper_Touch",
                    strength=0.7,
                    direction="bearish",
                    timeframe="short",
                    confidence=0.6,
                    supporting_indicators=["Bollinger_Bands"]
                ))
            elif bb_position < 0.05:
                signals.append(TechnicalSignal(
                    signal_type="BB_Lower_Touch",
                    strength=0.7,
                    direction="bullish",
                    timeframe="short",
                    confidence=0.6,
                    supporting_indicators=["Bollinger_Bands"]
                ))

        except Exception as e:
            logger.error(f"Error generating signals: {e}")

        return signals

    async def _find_support_resistance(self, hist: pd.DataFrame) -> Dict[str, List[float]]:
        """Identify support and resistance levels"""
        try:
            close = hist['Close']
            high = hist['High']
            low = hist['Low']

            # Simple pivot point calculation
            pivots_high = []
            pivots_low = []

            for i in range(2, len(high) - 2):
                if (high.iloc[i] > high.iloc[i-1] and high.iloc[i] > high.iloc[i-2] and
                    high.iloc[i] > high.iloc[i+1] and high.iloc[i] > high.iloc[i+2]):
                    pivots_high.append(float(high.iloc[i]))

                if (low.iloc[i] < low.iloc[i-1] and low.iloc[i] < low.iloc[i-2] and
                    low.iloc[i] < low.iloc[i+1] and low.iloc[i] < low.iloc[i+2]):
                    pivots_low.append(float(low.iloc[i]))

            # Get recent levels
            resistance_levels = sorted(pivots_high, reverse=True)[:3]
            support_levels = sorted(pivots_low, reverse=True)[:3]

            return {
                "resistance": resistance_levels,
                "support": support_levels
            }

        except Exception as e:
            logger.error(f"Error finding support/resistance: {e}")
            return {"resistance": [], "support": []}

    async def _identify_patterns(self, hist: pd.DataFrame) -> List[str]:
        """Identify chart patterns"""
        patterns = []

        try:
            close = hist['Close']
            high = hist['High']
            low = hist['Low']

            # Simple pattern recognition
            recent_close = close.tail(20)

            # Ascending triangle
            if (recent_close.max() - recent_close.min()) / recent_close.mean() > 0.05:
                if len(recent_close) > 10:
                    first_half = recent_close.head(10)
                    second_half = recent_close.tail(10)

                    if second_half.min() > first_half.min():
                        patterns.append("Ascending_Triangle")

            # Breakout pattern
            if len(close) > 50:
                recent_volatility = close.tail(10).std()
                historical_volatility = close.tail(50).std()

                if recent_volatility > historical_volatility * 1.5:
                    patterns.append("Volatility_Breakout")

        except Exception as e:
            logger.error(f"Error identifying patterns: {e}")

        return patterns

    async def _analyze_momentum(self, hist: pd.DataFrame) -> Dict[str, float]:
        """Analyze price momentum"""
        try:
            close = hist['Close']

            # Rate of change
            roc_5 = ((close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]) * 100
            roc_10 = ((close.iloc[-1] - close.iloc[-11]) / close.iloc[-11]) * 100
            roc_20 = ((close.iloc[-1] - close.iloc[-21]) / close.iloc[-21]) * 100

            return {
                "roc_5_day": float(roc_5),
                "roc_10_day": float(roc_10),
                "roc_20_day": float(roc_20),
                "momentum_score": float((roc_5 + roc_10 + roc_20) / 3)
            }

        except Exception as e:
            logger.error(f"Error analyzing momentum: {e}")
            return {}

    async def _analyze_volatility(self, hist: pd.DataFrame) -> Dict[str, float]:
        """Analyze price volatility"""
        try:
            close = hist['Close']
            returns = close.pct_change().dropna()

            volatility_10 = returns.tail(10).std() * np.sqrt(252) * 100
            volatility_30 = returns.tail(30).std() * np.sqrt(252) * 100

            return {
                "volatility_10_day": float(volatility_10),
                "volatility_30_day": float(volatility_30),
                "volatility_ratio": float(volatility_10 / volatility_30) if volatility_30 != 0 else 1.0
            }

        except Exception as e:
            logger.error(f"Error analyzing volatility: {e}")
            return {}


class OpportunityScanner:
    """Scans for trading opportunities across multiple symbols"""

    def __init__(self, technical_analyzer: TechnicalAnalyzer):
        self.analyzer = technical_analyzer

    async def scan_opportunities(
        self,
        symbols: List[str],
        opportunity_types: Optional[List[str]] = None
    ) -> List[TradingOpportunity]:
        """Scan for trading opportunities across symbols"""

        opportunities = []

        # Default opportunity types
        if not opportunity_types:
            opportunity_types = ["breakout", "reversal", "trend_continuation"]

        try:
            # Analyze symbols concurrently
            analysis_tasks = [
                self.analyzer.analyze_symbol(symbol) for symbol in symbols
            ]

            analyses = await asyncio.gather(*analysis_tasks, return_exceptions=True)

            for symbol, analysis in zip(symbols, analyses):
                if isinstance(analysis, Exception) or not analysis:
                    continue

                # Identify opportunities for this symbol
                symbol_opportunities = await self._identify_opportunities(
                    symbol, analysis, opportunity_types
                )
                opportunities.extend(symbol_opportunities)

        except Exception as e:
            logger.error(f"Error scanning opportunities: {e}")

        # Sort by probability and risk/reward
        opportunities.sort(
            key=lambda x: (x.probability * x.risk_reward_ratio),
            reverse=True
        )

        return opportunities[:10]  # Return top 10 opportunities

    async def _identify_opportunities(
        self,
        symbol: str,
        analysis: Dict[str, Any],
        opportunity_types: List[str]
    ) -> List[TradingOpportunity]:
        """Identify specific opportunities for a symbol"""

        opportunities = []
        current_price = analysis.get("current_price", 0)

        if current_price == 0:
            return opportunities

        try:
            indicators = analysis.get("technical_indicators", {})
            signals = analysis.get("signals", [])
            support_resistance = analysis.get("support_resistance", {})

            # Breakout opportunity
            if "breakout" in opportunity_types:
                breakout_opp = await self._check_breakout_opportunity(
                    symbol, current_price, indicators, support_resistance
                )
                if breakout_opp:
                    opportunities.append(breakout_opp)

            # Reversal opportunity
            if "reversal" in opportunity_types:
                reversal_opp = await self._check_reversal_opportunity(
                    symbol, current_price, indicators, signals
                )
                if reversal_opp:
                    opportunities.append(reversal_opp)

            # Trend continuation
            if "trend_continuation" in opportunity_types:
                trend_opp = await self._check_trend_continuation(
                    symbol, current_price, indicators, signals
                )
                if trend_opp:
                    opportunities.append(trend_opp)

        except Exception as e:
            logger.error(f"Error identifying opportunities for {symbol}: {e}")

        return opportunities

    async def _check_breakout_opportunity(
        self,
        symbol: str,
        current_price: float,
        indicators: Dict[str, Any],
        support_resistance: Dict[str, List[float]]
    ) -> Optional[TradingOpportunity]:
        """Check for breakout opportunities"""

        try:
            resistance_levels = support_resistance.get("resistance", [])

            if not resistance_levels:
                return None

            nearest_resistance = min(resistance_levels, key=lambda x: abs(x - current_price))

            # Check if price is near resistance
            distance_to_resistance = (nearest_resistance - current_price) / current_price

            if 0 < distance_to_resistance < 0.02:  # Within 2% of resistance
                # Calculate targets and stops
                target_price = nearest_resistance * 1.05  # 5% above resistance
                stop_loss = current_price * 0.98  # 2% below current

                risk_reward = (target_price - current_price) / (current_price - stop_loss)

                if risk_reward > 1.5:  # Minimum 1.5:1 risk/reward
                    return TradingOpportunity(
                        symbol=symbol,
                        opportunity_type="breakout",
                        entry_price=current_price,
                        target_price=target_price,
                        stop_loss=stop_loss,
                        risk_reward_ratio=risk_reward,
                        probability=0.6,
                        catalyst="Resistance breakout",
                        timeframe="short_term",
                        position_size_recommendation=0.02  # 2% of portfolio
                    )

        except Exception as e:
            logger.error(f"Error checking breakout opportunity: {e}")

        return None

    async def _check_reversal_opportunity(
        self,
        symbol: str,
        current_price: float,
        indicators: Dict[str, Any],
        signals: List[TechnicalSignal]
    ) -> Optional[TradingOpportunity]:
        """Check for reversal opportunities"""

        try:
            rsi = indicators.get("rsi", 50)
            bb_position = indicators.get("bb_position", 0.5)

            # Oversold reversal
            if rsi < 30 and bb_position < 0.2:
                target_price = current_price * 1.08  # 8% upside
                stop_loss = current_price * 0.95  # 5% stop

                risk_reward = (target_price - current_price) / (current_price - stop_loss)

                return TradingOpportunity(
                    symbol=symbol,
                    opportunity_type="oversold_reversal",
                    entry_price=current_price,
                    target_price=target_price,
                    stop_loss=stop_loss,
                    risk_reward_ratio=risk_reward,
                    probability=0.65,
                    catalyst="Oversold bounce",
                    timeframe="short_term",
                    position_size_recommendation=0.025
                )

        except Exception as e:
            logger.error(f"Error checking reversal opportunity: {e}")

        return None

    async def _check_trend_continuation(
        self,
        symbol: str,
        current_price: float,
        indicators: Dict[str, Any],
        signals: List[TechnicalSignal]
    ) -> Optional[TradingOpportunity]:
        """Check for trend continuation opportunities"""

        try:
            sma_20 = indicators.get("sma_20", current_price)
            sma_50 = indicators.get("sma_50", current_price)
            momentum = indicators.get("momentum_score", 0)

            # Uptrend continuation
            if (current_price > sma_20 > sma_50 and
                momentum > 2 and
                abs(current_price - sma_20) / current_price < 0.03):  # Within 3% of 20 SMA

                target_price = current_price * 1.06  # 6% target
                stop_loss = sma_20 * 0.98  # Below 20 SMA

                risk_reward = (target_price - current_price) / (current_price - stop_loss)

                if risk_reward > 1.0:
                    return TradingOpportunity(
                        symbol=symbol,
                        opportunity_type="trend_continuation",
                        entry_price=current_price,
                        target_price=target_price,
                        stop_loss=stop_loss,
                        risk_reward_ratio=risk_reward,
                        probability=0.7,
                        catalyst="Uptrend continuation",
                        timeframe="medium_term",
                        position_size_recommendation=0.03
                    )

        except Exception as e:
            logger.error(f"Error checking trend continuation: {e}")

        return None


class TradingInsightsGenerator:
    """Main service for generating trading insights and opportunities"""

    def __init__(
        self,
        narrative_engine: NarrativeGenerationEngine,
        redis_client: redis.Redis
    ):
        self.narrative_engine = narrative_engine
        self.redis = redis_client
        self.technical_analyzer = TechnicalAnalyzer(redis_client)
        self.opportunity_scanner = OpportunityScanner(self.technical_analyzer)

    async def generate_trading_insights(
        self,
        symbols: List[str],
        user_context: NarrativeContext,
        focus_on: Optional[str] = None
    ) -> GeneratedNarrative:
        """Generate comprehensive trading insights for symbols"""

        try:
            # Analyze symbols
            analyses = await self._analyze_symbols(symbols)

            # Scan for opportunities
            opportunities = await self.opportunity_scanner.scan_opportunities(symbols)

            # Prepare market data
            market_data = await self._prepare_trading_data(analyses, opportunities)

            # Create narrative request
            request = NarrativeRequest(
                user_id=user_context.user_id,
                narrative_type=NarrativeType.TRADING_OPPORTUNITY,
                symbols=symbols,
                tone=NarrativeTone.PROFESSIONAL,
                length=NarrativeLength.LONG,
                context=user_context,
                market_data=market_data,
                focus_areas=[focus_on] if focus_on else []
            )

            # Generate narrative
            narrative = await self.narrative_engine.generate_narrative(request)

            # Enhance with trading-specific insights
            narrative = await self._enhance_with_trading_insights(
                narrative, analyses, opportunities
            )

            return narrative

        except Exception as e:
            logger.error(f"Error generating trading insights: {e}")
            raise

    async def generate_technical_analysis(
        self,
        symbol: str,
        user_context: NarrativeContext,
        timeframe: str = "daily"
    ) -> GeneratedNarrative:
        """Generate detailed technical analysis for a symbol"""

        try:
            # Perform technical analysis
            analysis = await self.technical_analyzer.analyze_symbol(symbol, timeframe)

            if not analysis:
                raise ValueError(f"Unable to analyze {symbol}")

            # Prepare data
            market_data = MarketData(
                symbol=symbol,
                current_price=analysis.get("current_price"),
                volume=analysis.get("volume"),
                technical_indicators=analysis.get("technical_indicators", {}),
                support_levels=analysis.get("support_resistance", {}).get("support", []),
                resistance_levels=analysis.get("support_resistance", {}).get("resistance", [])
            )

            # Create request
            request = NarrativeRequest(
                user_id=user_context.user_id,
                narrative_type=NarrativeType.TECHNICAL_INSIGHT,
                symbols=[symbol],
                tone=NarrativeTone.TECHNICAL,
                length=NarrativeLength.DETAILED,
                context=user_context,
                market_data=market_data
            )

            # Generate narrative
            narrative = await self.narrative_engine.generate_narrative(request)

            # Add technical insights
            narrative.insights.extend(
                await self._convert_signals_to_insights(analysis.get("signals", []))
            )

            # Add recommendations
            narrative.recommendations.extend(
                await self._generate_technical_recommendations(symbol, analysis)
            )

            return narrative

        except Exception as e:
            logger.error(f"Error generating technical analysis for {symbol}: {e}")
            raise

    async def generate_opportunity_alert(
        self,
        opportunity: TradingOpportunity,
        user_context: NarrativeContext
    ) -> GeneratedNarrative:
        """Generate alert narrative for trading opportunity"""

        try:
            # Prepare market data
            market_data = MarketData(
                symbol=opportunity.symbol,
                current_price=opportunity.entry_price
            )

            # Create request
            request = NarrativeRequest(
                user_id=user_context.user_id,
                narrative_type=NarrativeType.TRADING_OPPORTUNITY,
                symbols=[opportunity.symbol],
                tone=NarrativeTone.PROFESSIONAL,
                length=NarrativeLength.SHORT,
                context=user_context,
                market_data=market_data
            )

            # Generate narrative
            narrative = await self.narrative_engine.generate_narrative(request)

            # Add opportunity-specific content
            narrative.title = f"Trading Opportunity: {opportunity.symbol}"
            narrative.summary = (
                f"{opportunity.opportunity_type.title()} opportunity in {opportunity.symbol} "
                f"with {opportunity.risk_reward_ratio:.1f}:1 risk/reward ratio"
            )

            # Add opportunity insight
            opportunity_insight = TradingInsight(
                type="opportunity",
                symbol=opportunity.symbol,
                title=f"{opportunity.opportunity_type.title()} Setup",
                description=f"Entry: ${opportunity.entry_price:.2f}, Target: ${opportunity.target_price:.2f}, Stop: ${opportunity.stop_loss:.2f}",
                significance=InsightPriority.HIGH,
                confidence=opportunity.probability,
                time_horizon=opportunity.timeframe,
                actionable=True,
                suggested_actions=[
                    f"Consider {opportunity.position_size_recommendation*100:.1f}% position size",
                    f"Set stop loss at ${opportunity.stop_loss:.2f}",
                    f"Take profits near ${opportunity.target_price:.2f}"
                ]
            )
            narrative.insights.append(opportunity_insight)

            # Add recommendation
            recommendation = TradingRecommendation(
                symbol=opportunity.symbol,
                action="buy",
                reasoning=opportunity.catalyst,
                entry_price=opportunity.entry_price,
                target_price=opportunity.target_price,
                stop_loss=opportunity.stop_loss,
                position_size_percent=opportunity.position_size_recommendation * 100,
                confidence=opportunity.probability,
                time_horizon=opportunity.timeframe,
                priority=InsightPriority.HIGH
            )
            narrative.recommendations.append(recommendation)

            return narrative

        except Exception as e:
            logger.error(f"Error generating opportunity alert: {e}")
            raise

    async def _analyze_symbols(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """Analyze multiple symbols concurrently"""

        analysis_tasks = [
            self.technical_analyzer.analyze_symbol(symbol)
            for symbol in symbols
        ]

        results = await asyncio.gather(*analysis_tasks, return_exceptions=True)

        analyses = {}
        for symbol, result in zip(symbols, results):
            if not isinstance(result, Exception) and result:
                analyses[symbol] = result

        return analyses

    async def _prepare_trading_data(
        self,
        analyses: Dict[str, Dict[str, Any]],
        opportunities: List[TradingOpportunity]
    ) -> MarketData:
        """Prepare trading data for narrative generation"""

        # Aggregate data from analyses
        total_symbols = len(analyses)
        bullish_signals = 0
        bearish_signals = 0

        avg_rsi = 0
        price_data = {}

        for symbol, analysis in analyses.items():
            indicators = analysis.get("technical_indicators", {})
            signals = analysis.get("signals", [])

            # Count signal directions
            for signal in signals:
                if signal.direction == "bullish":
                    bullish_signals += 1
                elif signal.direction == "bearish":
                    bearish_signals += 1

            # Aggregate indicators
            if "rsi" in indicators:
                avg_rsi += indicators["rsi"]

            price_data[symbol] = {
                "price": analysis.get("current_price", 0),
                "rsi": indicators.get("rsi", 50)
            }

        # Calculate averages
        if total_symbols > 0:
            avg_rsi /= total_symbols

        return MarketData(
            # Custom aggregated data
            peer_comparison=[
                {
                    "symbol": symbol,
                    "price": data["price"],
                    "rsi": data["rsi"]
                }
                for symbol, data in price_data.items()
            ]
        )

    async def _enhance_with_trading_insights(
        self,
        narrative: GeneratedNarrative,
        analyses: Dict[str, Dict[str, Any]],
        opportunities: List[TradingOpportunity]
    ) -> GeneratedNarrative:
        """Enhance narrative with trading-specific insights"""

        # Add opportunity insights
        for opp in opportunities[:3]:  # Top 3 opportunities
            insight = TradingInsight(
                type="opportunity",
                symbol=opp.symbol,
                title=f"{opp.opportunity_type.title()} Opportunity",
                description=f"{opp.symbol}: {opp.catalyst} with {opp.risk_reward_ratio:.1f}:1 R/R",
                significance=InsightPriority.HIGH if opp.probability > 0.7 else InsightPriority.MEDIUM,
                confidence=opp.probability,
                time_horizon=opp.timeframe,
                actionable=True
            )
            narrative.insights.append(insight)

        # Add market sentiment insight
        total_opportunities = len(opportunities)
        if total_opportunities > 0:
            sentiment_insight = TradingInsight(
                type="market_sentiment",
                title="Trading Environment",
                description=f"Found {total_opportunities} trading opportunities across analyzed symbols",
                significance=InsightPriority.MEDIUM,
                confidence=0.8,
                time_horizon="short_term"
            )
            narrative.insights.append(sentiment_insight)

        return narrative

    async def _convert_signals_to_insights(
        self,
        signals: List[TechnicalSignal]
    ) -> List[TradingInsight]:
        """Convert technical signals to trading insights"""

        insights = []

        for signal in signals:
            priority = InsightPriority.HIGH if signal.strength > 0.8 else InsightPriority.MEDIUM

            insight = TradingInsight(
                type="technical_signal",
                title=signal.signal_type.replace("_", " "),
                description=f"{signal.direction.title()} signal with {signal.strength:.1f} strength",
                significance=priority,
                confidence=signal.confidence,
                time_horizon=signal.timeframe,
                actionable=True,
                suggested_actions=[f"Consider {signal.direction} bias"]
            )
            insights.append(insight)

        return insights

    async def _generate_technical_recommendations(
        self,
        symbol: str,
        analysis: Dict[str, Any]
    ) -> List[TradingRecommendation]:
        """Generate recommendations from technical analysis"""

        recommendations = []

        signals = analysis.get("signals", [])
        current_price = analysis.get("current_price", 0)

        if not signals or current_price == 0:
            return recommendations

        # Get strongest signal
        strongest_signal = max(signals, key=lambda x: x.strength * x.confidence)

        if strongest_signal.confidence > 0.7:
            action = "buy" if strongest_signal.direction == "bullish" else "sell"

            # Calculate targets based on signal
            if action == "buy":
                target_price = current_price * 1.05
                stop_loss = current_price * 0.97
            else:
                target_price = current_price * 0.95
                stop_loss = current_price * 1.03

            recommendation = TradingRecommendation(
                symbol=symbol,
                action=action,
                reasoning=f"Strong {strongest_signal.signal_type} signal",
                entry_price=current_price,
                target_price=target_price,
                stop_loss=stop_loss,
                confidence=strongest_signal.confidence,
                time_horizon=strongest_signal.timeframe,
                priority=InsightPriority.HIGH if strongest_signal.strength > 0.8 else InsightPriority.MEDIUM
            )
            recommendations.append(recommendation)

        return recommendations