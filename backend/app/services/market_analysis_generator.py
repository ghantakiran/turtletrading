"""
Market Analysis Narrative Generator for TurtleTrading LLM System

Specialized service for generating comprehensive market analysis narratives
with real-time data integration, technical analysis, and market insights.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import redis.asyncio as redis
from dataclasses import dataclass
import yfinance as yf

from ..models.llm_narrative_models import (
    NarrativeRequest, GeneratedNarrative, NarrativeType, MarketData,
    NarrativeContext, TradingInsight, TradingRecommendation,
    InsightPriority, NarrativeTone, NarrativeLength
)
from .narrative_generation_engine import NarrativeGenerationEngine

logger = logging.getLogger(__name__)


@dataclass
class MarketSnapshot:
    """Real-time market snapshot data"""
    timestamp: datetime
    major_indices: Dict[str, Dict[str, float]]
    sector_performance: Dict[str, float]
    market_breadth: Dict[str, float]
    volatility_metrics: Dict[str, float]
    top_movers: Dict[str, List[Dict[str, Any]]]
    economic_indicators: Dict[str, float]
    news_sentiment: float
    social_sentiment: float


class MarketDataCollector:
    """Collects real-time market data for analysis"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.major_indices = ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX"]
        self.sector_etfs = {
            "Technology": "XLK",
            "Healthcare": "XLV",
            "Financials": "XLF",
            "Energy": "XLE",
            "Consumer Discretionary": "XLY",
            "Industrials": "XLI",
            "Utilities": "XLU",
            "Real Estate": "XLRE",
            "Materials": "XLB",
            "Consumer Staples": "XLP",
            "Communication": "XLC"
        }

    async def get_market_snapshot(self) -> MarketSnapshot:
        """Get comprehensive market snapshot"""
        try:
            # Collect data concurrently
            tasks = [
                self._get_indices_data(),
                self._get_sector_performance(),
                self._get_market_breadth(),
                self._get_volatility_metrics(),
                self._get_top_movers(),
                self._get_economic_indicators(),
                self._get_sentiment_data()
            ]

            results = await asyncio.gather(*tasks)

            return MarketSnapshot(
                timestamp=datetime.utcnow(),
                major_indices=results[0],
                sector_performance=results[1],
                market_breadth=results[2],
                volatility_metrics=results[3],
                top_movers=results[4],
                economic_indicators=results[5],
                news_sentiment=results[6].get("news", 0.0),
                social_sentiment=results[6].get("social", 0.0)
            )

        except Exception as e:
            logger.error(f"Error collecting market snapshot: {e}")
            return self._get_fallback_snapshot()

    async def _get_indices_data(self) -> Dict[str, Dict[str, float]]:
        """Get major indices data"""
        indices_data = {}

        try:
            # Use yfinance to get current data
            tickers = yf.Tickers(" ".join(self.major_indices))

            for symbol in self.major_indices:
                try:
                    ticker = tickers.tickers[symbol]
                    info = ticker.info
                    hist = ticker.history(period="2d")

                    if not hist.empty:
                        current_price = hist['Close'].iloc[-1]
                        prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else current_price
                        change = current_price - prev_close
                        change_percent = (change / prev_close) * 100 if prev_close != 0 else 0

                        indices_data[symbol] = {
                            "price": float(current_price),
                            "change": float(change),
                            "change_percent": float(change_percent),
                            "volume": float(hist['Volume'].iloc[-1]) if 'Volume' in hist else 0
                        }

                except Exception as e:
                    logger.warning(f"Error getting data for {symbol}: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error fetching indices data: {e}")

        return indices_data

    async def _get_sector_performance(self) -> Dict[str, float]:
        """Get sector performance data"""
        sector_performance = {}

        try:
            sector_symbols = list(self.sector_etfs.values())
            tickers = yf.Tickers(" ".join(sector_symbols))

            for sector_name, symbol in self.sector_etfs.items():
                try:
                    ticker = tickers.tickers[symbol]
                    hist = ticker.history(period="2d")

                    if not hist.empty and len(hist) > 1:
                        current_price = hist['Close'].iloc[-1]
                        prev_close = hist['Close'].iloc[-2]
                        change_percent = ((current_price - prev_close) / prev_close) * 100

                        sector_performance[sector_name] = float(change_percent)

                except Exception as e:
                    logger.warning(f"Error getting sector data for {sector_name}: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error fetching sector performance: {e}")

        return sector_performance

    async def _get_market_breadth(self) -> Dict[str, float]:
        """Calculate market breadth indicators"""
        try:
            # Get data from cache or calculate
            cache_key = "market_breadth"
            cached_data = await self.redis.get(cache_key)

            if cached_data:
                return json.loads(cached_data)

            # Calculate basic breadth metrics (simplified)
            breadth = {
                "advance_decline_ratio": 1.2,  # Would be calculated from real data
                "new_highs_lows_ratio": 0.8,
                "up_volume_ratio": 0.55,
                "bullish_percent": 65.0
            }

            # Cache for 15 minutes
            await self.redis.setex(cache_key, 900, json.dumps(breadth))
            return breadth

        except Exception as e:
            logger.error(f"Error calculating market breadth: {e}")
            return {}

    async def _get_volatility_metrics(self) -> Dict[str, float]:
        """Get volatility metrics"""
        try:
            # Get VIX data
            vix = yf.Ticker("^VIX")
            vix_hist = vix.history(period="5d")

            metrics = {}
            if not vix_hist.empty:
                current_vix = vix_hist['Close'].iloc[-1]
                vix_change = ((current_vix - vix_hist['Close'].iloc[-2]) / vix_hist['Close'].iloc[-2]) * 100

                metrics = {
                    "vix": float(current_vix),
                    "vix_change": float(vix_change),
                    "volatility_regime": "low" if current_vix < 20 else "high" if current_vix > 30 else "medium",
                    "fear_greed_index": max(0, min(100, 100 - current_vix * 2))  # Simplified calculation
                }

            return metrics

        except Exception as e:
            logger.error(f"Error getting volatility metrics: {e}")
            return {"vix": 20.0, "volatility_regime": "medium"}

    async def _get_top_movers(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get top gainers and losers"""
        try:
            # This would typically use a market data API
            # For demo, using cached/mock data
            cache_key = "top_movers"
            cached_data = await self.redis.get(cache_key)

            if cached_data:
                return json.loads(cached_data)

            # Mock data (would be replaced with real API call)
            movers = {
                "gainers": [
                    {"symbol": "NVDA", "price": 450.20, "change_percent": 5.2},
                    {"symbol": "TSLA", "price": 245.80, "change_percent": 4.1},
                    {"symbol": "AMD", "price": 155.30, "change_percent": 3.8}
                ],
                "losers": [
                    {"symbol": "META", "price": 315.40, "change_percent": -2.8},
                    {"symbol": "NFLX", "price": 425.60, "change_percent": -2.1},
                    {"symbol": "GOOGL", "price": 140.20, "change_percent": -1.9}
                ]
            }

            # Cache for 5 minutes
            await self.redis.setex(cache_key, 300, json.dumps(movers))
            return movers

        except Exception as e:
            logger.error(f"Error getting top movers: {e}")
            return {"gainers": [], "losers": []}

    async def _get_economic_indicators(self) -> Dict[str, float]:
        """Get economic indicators"""
        try:
            # Get bond yields and currency data
            indicators = {}

            # 10-year Treasury yield
            tnx = yf.Ticker("^TNX")
            tnx_hist = tnx.history(period="2d")
            if not tnx_hist.empty:
                indicators["10y_yield"] = float(tnx_hist['Close'].iloc[-1])

            # Dollar index
            dxy = yf.Ticker("DX-Y.NYB")
            dxy_hist = dxy.history(period="2d")
            if not dxy_hist.empty:
                indicators["dollar_index"] = float(dxy_hist['Close'].iloc[-1])

            # Gold
            gold = yf.Ticker("GC=F")
            gold_hist = gold.history(period="2d")
            if not gold_hist.empty:
                indicators["gold_price"] = float(gold_hist['Close'].iloc[-1])

            return indicators

        except Exception as e:
            logger.error(f"Error getting economic indicators: {e}")
            return {}

    async def _get_sentiment_data(self) -> Dict[str, float]:
        """Get sentiment data"""
        try:
            # Check cache first
            cache_key = "market_sentiment"
            cached_data = await self.redis.get(cache_key)

            if cached_data:
                return json.loads(cached_data)

            # Mock sentiment data (would be from news/social APIs)
            sentiment = {
                "news": 0.15,  # Slightly positive
                "social": -0.05,  # Slightly negative
                "overall": 0.05   # Neutral to slightly positive
            }

            # Cache for 30 minutes
            await self.redis.setex(cache_key, 1800, json.dumps(sentiment))
            return sentiment

        except Exception as e:
            logger.error(f"Error getting sentiment data: {e}")
            return {"news": 0.0, "social": 0.0, "overall": 0.0}

    def _get_fallback_snapshot(self) -> MarketSnapshot:
        """Get fallback snapshot when data collection fails"""
        return MarketSnapshot(
            timestamp=datetime.utcnow(),
            major_indices={
                "^GSPC": {"price": 4500.0, "change": 10.0, "change_percent": 0.22},
                "^IXIC": {"price": 14000.0, "change": -20.0, "change_percent": -0.14},
                "^VIX": {"price": 18.5, "change": -0.5, "change_percent": -2.6}
            },
            sector_performance={
                "Technology": 0.5,
                "Healthcare": -0.2,
                "Financials": 0.8
            },
            market_breadth={"advance_decline_ratio": 1.1},
            volatility_metrics={"vix": 18.5, "volatility_regime": "low"},
            top_movers={"gainers": [], "losers": []},
            economic_indicators={"10y_yield": 4.2},
            news_sentiment=0.1,
            social_sentiment=-0.05
        )


class MarketAnalysisGenerator:
    """Specialized generator for market analysis narratives"""

    def __init__(
        self,
        narrative_engine: NarrativeGenerationEngine,
        redis_client: redis.Redis
    ):
        self.narrative_engine = narrative_engine
        self.redis = redis_client
        self.data_collector = MarketDataCollector(redis_client)

    async def generate_market_overview(
        self,
        user_context: NarrativeContext,
        tone: NarrativeTone = NarrativeTone.PROFESSIONAL,
        length: NarrativeLength = NarrativeLength.MEDIUM,
        focus_areas: Optional[List[str]] = None
    ) -> GeneratedNarrative:
        """Generate comprehensive market overview"""

        try:
            # Collect market data
            market_snapshot = await self.data_collector.get_market_snapshot()

            # Prepare market data for narrative
            market_data = self._prepare_market_data(market_snapshot)

            # Create narrative request
            request = NarrativeRequest(
                user_id=user_context.user_id,
                narrative_type=NarrativeType.MARKET_OVERVIEW,
                tone=tone,
                length=length,
                context=user_context,
                market_data=market_data,
                focus_areas=focus_areas or []
            )

            # Generate narrative
            narrative = await self.narrative_engine.generate_narrative(request)

            # Enhance with market-specific insights
            enhanced_narrative = await self._enhance_with_market_insights(
                narrative, market_snapshot
            )

            return enhanced_narrative

        except Exception as e:
            logger.error(f"Error generating market overview: {e}")
            raise

    async def generate_sector_analysis(
        self,
        sector: str,
        user_context: NarrativeContext,
        tone: NarrativeTone = NarrativeTone.PROFESSIONAL,
        length: NarrativeLength = NarrativeLength.LONG
    ) -> GeneratedNarrative:
        """Generate sector-specific analysis"""

        try:
            # Get sector-specific data
            market_snapshot = await self.data_collector.get_market_snapshot()
            sector_data = await self._get_sector_deep_dive(sector)

            # Prepare narrative data
            market_data = self._prepare_market_data(market_snapshot)
            market_data.sector_performance = sector_data

            # Create request
            request = NarrativeRequest(
                user_id=user_context.user_id,
                narrative_type=NarrativeType.SECTOR_ANALYSIS,
                tone=tone,
                length=length,
                context=user_context,
                market_data=market_data,
                focus_areas=[sector]
            )

            # Generate narrative
            narrative = await self.narrative_engine.generate_narrative(request)

            # Add sector-specific insights
            narrative.insights.extend(
                await self._generate_sector_insights(sector, sector_data)
            )

            return narrative

        except Exception as e:
            logger.error(f"Error generating sector analysis for {sector}: {e}")
            raise

    async def generate_daily_briefing(
        self,
        user_context: NarrativeContext,
        include_portfolio_impact: bool = True
    ) -> GeneratedNarrative:
        """Generate daily market briefing"""

        try:
            # Get comprehensive market data
            market_snapshot = await self.data_collector.get_market_snapshot()

            # Get portfolio impact if requested
            portfolio_impact = {}
            if include_portfolio_impact and user_context.portfolio_symbols:
                portfolio_impact = await self._analyze_portfolio_impact(
                    user_context.portfolio_symbols, market_snapshot
                )

            # Prepare data
            market_data = self._prepare_market_data(market_snapshot)
            if portfolio_impact:
                market_data.peer_comparison = portfolio_impact

            # Create request
            request = NarrativeRequest(
                user_id=user_context.user_id,
                narrative_type=NarrativeType.DAILY_BRIEFING,
                tone=NarrativeTone.PROFESSIONAL,
                length=NarrativeLength.MEDIUM,
                context=user_context,
                market_data=market_data
            )

            # Generate narrative
            narrative = await self.narrative_engine.generate_narrative(request)

            # Add daily briefing specific insights
            narrative.insights.extend(
                await self._generate_daily_insights(market_snapshot, portfolio_impact)
            )

            return narrative

        except Exception as e:
            logger.error(f"Error generating daily briefing: {e}")
            raise

    async def generate_earnings_preview(
        self,
        symbols: List[str],
        user_context: NarrativeContext
    ) -> GeneratedNarrative:
        """Generate earnings preview analysis"""

        try:
            # Get earnings data
            earnings_data = await self._get_earnings_data(symbols)
            market_snapshot = await self.data_collector.get_market_snapshot()

            # Prepare data
            market_data = self._prepare_market_data(market_snapshot)
            market_data.earnings_data = earnings_data

            # Create request
            request = NarrativeRequest(
                user_id=user_context.user_id,
                narrative_type=NarrativeType.EARNINGS_PREVIEW,
                symbols=symbols,
                tone=NarrativeTone.PROFESSIONAL,
                length=NarrativeLength.LONG,
                context=user_context,
                market_data=market_data
            )

            # Generate narrative
            narrative = await self.narrative_engine.generate_narrative(request)

            # Add earnings-specific insights
            narrative.insights.extend(
                await self._generate_earnings_insights(symbols, earnings_data)
            )

            return narrative

        except Exception as e:
            logger.error(f"Error generating earnings preview: {e}")
            raise

    def _prepare_market_data(self, snapshot: MarketSnapshot) -> MarketData:
        """Prepare market snapshot for narrative generation"""

        # Extract S&P 500 data
        sp500_data = snapshot.major_indices.get("^GSPC", {})
        nasdaq_data = snapshot.major_indices.get("^IXIC", {})
        vix_data = snapshot.major_indices.get("^VIX", {})

        return MarketData(
            # Market indices
            sp500={
                "price": sp500_data.get("price"),
                "change": sp500_data.get("change"),
                "change_percent": sp500_data.get("change_percent")
            },
            nasdaq={
                "price": nasdaq_data.get("price"),
                "change": nasdaq_data.get("change"),
                "change_percent": nasdaq_data.get("change_percent")
            },
            vix=vix_data.get("price"),

            # Sector performance
            sector_performance=snapshot.sector_performance,

            # Sentiment
            news_sentiment=snapshot.news_sentiment,
            social_sentiment=snapshot.social_sentiment
        )

    async def _enhance_with_market_insights(
        self,
        narrative: GeneratedNarrative,
        snapshot: MarketSnapshot
    ) -> GeneratedNarrative:
        """Enhance narrative with market-specific insights"""

        # Add market regime insight
        vix = snapshot.volatility_metrics.get("vix", 20)
        if vix > 30:
            regime_insight = TradingInsight(
                type="volatility",
                title="High Volatility Environment",
                description=f"VIX at {vix:.1f} indicates heightened market uncertainty. Consider defensive positioning.",
                significance=InsightPriority.HIGH,
                confidence=0.85,
                time_horizon="short_term",
                suggested_actions=["Consider volatility hedging", "Reduce position sizes", "Focus on quality names"]
            )
            narrative.insights.append(regime_insight)

        # Add sector rotation insight
        sector_perf = snapshot.sector_performance
        if sector_perf:
            best_sector = max(sector_perf.items(), key=lambda x: x[1])
            worst_sector = min(sector_perf.items(), key=lambda x: x[1])

            rotation_insight = TradingInsight(
                type="sector_rotation",
                title="Sector Rotation Pattern",
                description=f"{best_sector[0]} leading with {best_sector[1]:.1f}% while {worst_sector[0]} lagging at {worst_sector[1]:.1f}%",
                significance=InsightPriority.MEDIUM,
                confidence=0.75,
                time_horizon="medium_term",
                suggested_actions=[f"Consider exposure to {best_sector[0]}", f"Review {worst_sector[0]} positions"]
            )
            narrative.insights.append(rotation_insight)

        return narrative

    async def _get_sector_deep_dive(self, sector: str) -> Dict[str, Any]:
        """Get detailed sector analysis data"""
        # This would include more detailed sector metrics
        return {
            "performance_vs_market": 1.2,
            "relative_strength": 0.8,
            "key_drivers": ["earnings growth", "policy changes"],
            "top_stocks": ["AAPL", "MSFT", "GOOGL"]
        }

    async def _generate_sector_insights(
        self,
        sector: str,
        sector_data: Dict[str, Any]
    ) -> List[TradingInsight]:
        """Generate sector-specific insights"""
        insights = []

        performance = sector_data.get("performance_vs_market", 0)
        if abs(performance) > 0.5:
            significance = InsightPriority.HIGH if abs(performance) > 1.0 else InsightPriority.MEDIUM

            insight = TradingInsight(
                type="sector_performance",
                title=f"{sector} Relative Performance",
                description=f"{sector} showing {performance:.1f}% relative performance vs market",
                significance=significance,
                confidence=0.8,
                time_horizon="medium_term"
            )
            insights.append(insight)

        return insights

    async def _analyze_portfolio_impact(
        self,
        portfolio_symbols: List[str],
        snapshot: MarketSnapshot
    ) -> Dict[str, Any]:
        """Analyze market impact on user's portfolio"""
        try:
            # Get portfolio performance
            portfolio_impact = {}

            for symbol in portfolio_symbols[:10]:  # Limit to first 10
                try:
                    ticker = yf.Ticker(symbol)
                    hist = ticker.history(period="2d")

                    if not hist.empty and len(hist) > 1:
                        current = hist['Close'].iloc[-1]
                        previous = hist['Close'].iloc[-2]
                        change_pct = ((current - previous) / previous) * 100

                        portfolio_impact[symbol] = {
                            "price": float(current),
                            "change_percent": float(change_pct),
                            "impact": "positive" if change_pct > 0 else "negative"
                        }

                except Exception as e:
                    logger.warning(f"Error analyzing {symbol}: {e}")
                    continue

            return portfolio_impact

        except Exception as e:
            logger.error(f"Error analyzing portfolio impact: {e}")
            return {}

    async def _generate_daily_insights(
        self,
        snapshot: MarketSnapshot,
        portfolio_impact: Dict[str, Any]
    ) -> List[TradingInsight]:
        """Generate daily briefing insights"""
        insights = []

        # Market breadth insight
        advance_decline = snapshot.market_breadth.get("advance_decline_ratio", 1.0)
        if advance_decline > 1.5:
            insights.append(TradingInsight(
                type="market_breadth",
                title="Strong Market Breadth",
                description=f"Advance/decline ratio of {advance_decline:.1f} shows broad market participation",
                significance=InsightPriority.MEDIUM,
                confidence=0.8,
                time_horizon="short_term"
            ))

        # Portfolio insight
        if portfolio_impact:
            positive_count = sum(1 for v in portfolio_impact.values() if v.get("impact") == "positive")
            total_count = len(portfolio_impact)

            if positive_count / total_count > 0.7:
                insights.append(TradingInsight(
                    type="portfolio",
                    title="Portfolio Outperformance",
                    description=f"{positive_count}/{total_count} portfolio holdings are positive today",
                    significance=InsightPriority.MEDIUM,
                    confidence=0.75,
                    time_horizon="short_term"
                ))

        return insights

    async def _get_earnings_data(self, symbols: List[str]) -> Dict[str, Any]:
        """Get earnings data for symbols"""
        earnings_data = {}

        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                calendar = ticker.calendar

                if calendar is not None and not calendar.empty:
                    earnings_data[symbol] = {
                        "earnings_date": calendar.index[0].strftime("%Y-%m-%d"),
                        "eps_estimate": float(calendar.iloc[0, 0]) if not calendar.empty else None
                    }

            except Exception as e:
                logger.warning(f"Error getting earnings data for {symbol}: {e}")
                continue

        return earnings_data

    async def _generate_earnings_insights(
        self,
        symbols: List[str],
        earnings_data: Dict[str, Any]
    ) -> List[TradingInsight]:
        """Generate earnings-specific insights"""
        insights = []

        upcoming_earnings = [s for s in symbols if s in earnings_data]
        if upcoming_earnings:
            insight = TradingInsight(
                type="earnings",
                title="Upcoming Earnings Events",
                description=f"{len(upcoming_earnings)} companies reporting earnings this week",
                significance=InsightPriority.HIGH,
                confidence=0.9,
                time_horizon="short_term",
                suggested_actions=["Review positions ahead of earnings", "Consider volatility impact"]
            )
            insights.append(insight)

        return insights