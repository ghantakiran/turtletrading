"""
Sentiment analysis service for market and stock sentiment
"""

import asyncio
import aiohttp
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import re
from loguru import logger

from app.services.base_service import BaseService
from app.models.sentiment_schemas import (
    SentimentAnalysis, MarketSentiment, NewsArticle, SocialSentiment,
    SentimentPolarity, NewsSource, SentimentTrend
)
from app.core.config import settings


class SentimentService(BaseService):
    """Sentiment analysis service using external APIs and NLP"""
    
    def __init__(self):
        super().__init__()
        
        # Sentiment keywords for basic analysis
        self.bullish_keywords = [
            "bullish", "buy", "strong", "growth", "positive", "rally", "surge", 
            "breakout", "momentum", "outperform", "upgrade", "beat", "exceed"
        ]
        
        self.bearish_keywords = [
            "bearish", "sell", "weak", "decline", "negative", "crash", "drop",
            "breakdown", "resistance", "underperform", "downgrade", "miss", "below"
        ]
        
        # News sources for reliability scoring
        self.news_sources = {
            "reuters.com": 0.9,
            "bloomberg.com": 0.9,
            "wsj.com": 0.9,
            "cnbc.com": 0.8,
            "marketwatch.com": 0.8,
            "yahoo.com": 0.7,
            "fool.com": 0.6,
            "seekingalpha.com": 0.7,
            "benzinga.com": 0.6
        }
    
    async def get_market_sentiment(self) -> MarketSentiment:
        """Get overall market sentiment analysis"""
        cache_key = self.create_cache_key("market_sentiment")
        
        async def fetch_market_sentiment():
            try:
                # Get sentiment components concurrently
                tasks = [
                    self._get_news_sentiment_score("market"),
                    self._get_social_sentiment_score("market"),
                    self._get_economic_sentiment_score(),
                    self._get_fear_greed_components(),
                    self._get_sector_sentiments(),
                    self._get_trending_topics()
                ]
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                news_sentiment = results[0] if not isinstance(results[0], Exception) else 0.0
                social_sentiment = results[1] if not isinstance(results[1], Exception) else 0.0
                economic_sentiment = results[2] if not isinstance(results[2], Exception) else 0.0
                fear_greed_components = results[3] if not isinstance(results[3], Exception) else {}
                sector_sentiments = results[4] if not isinstance(results[4], Exception) else {}
                trending_topics = results[5] if not isinstance(results[5], Exception) else []
                
                # Calculate overall sentiment
                overall_sentiment = (news_sentiment + social_sentiment + economic_sentiment) / 3
                
                return MarketSentiment(
                    timestamp=datetime.utcnow(),
                    overall_sentiment=overall_sentiment,
                    sentiment_polarity=self._get_sentiment_polarity(overall_sentiment),
                    news_sentiment=news_sentiment,
                    social_sentiment=social_sentiment,
                    economic_sentiment=economic_sentiment,
                    fear_greed_index=fear_greed_components.get("value", 50),
                    fear_greed_components=fear_greed_components,
                    vix_sentiment=await self._get_vix_sentiment(),
                    put_call_ratio=await self._get_put_call_ratio(),
                    high_low_sentiment=await self._get_high_low_sentiment(),
                    sector_sentiments=sector_sentiments,
                    trending_topics=trending_topics,
                    bullish_keywords=self._get_trending_bullish_keywords(),
                    bearish_keywords=self._get_trending_bearish_keywords()
                )
                
            except Exception as e:
                logger.error(f"Error getting market sentiment: {e}")
                raise
        
        return await self.get_or_set_cache(cache_key, fetch_market_sentiment, ttl=300)
    
    async def get_stock_sentiment(self, symbol: str, timeframe: str = "7d") -> Optional[SentimentAnalysis]:
        """Get sentiment analysis for a specific stock"""
        symbol = self.validate_symbol(symbol)
        cache_key = self.create_cache_key("stock_sentiment", symbol, timeframe)
        
        async def fetch_stock_sentiment():
            try:
                # Get stock news and analyze sentiment
                news_articles = await self.get_stock_news(symbol, limit=50, days_back=7)
                
                if not news_articles:
                    return None
                
                # Calculate sentiment metrics
                sentiment_scores = [article.sentiment_score for article in news_articles]
                overall_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0.0
                
                # Count articles by sentiment
                positive_count = sum(1 for score in sentiment_scores if score > 0.1)
                negative_count = sum(1 for score in sentiment_scores if score < -0.1)
                neutral_count = len(sentiment_scores) - positive_count - negative_count
                
                # Calculate sentiment momentum (trend)
                recent_scores = sentiment_scores[:10]  # Last 10 articles
                older_scores = sentiment_scores[10:20] if len(sentiment_scores) > 10 else []
                
                momentum = 0.0
                if recent_scores and older_scores:
                    recent_avg = sum(recent_scores) / len(recent_scores)
                    older_avg = sum(older_scores) / len(older_scores)
                    momentum = recent_avg - older_avg
                
                # Calculate volatility
                if len(sentiment_scores) > 1:
                    sentiment_variance = sum((s - overall_sentiment) ** 2 for s in sentiment_scores) / len(sentiment_scores)
                    volatility = sentiment_variance ** 0.5
                else:
                    volatility = 0.0
                
                # Generate sentiment trend
                sentiment_trend = self._generate_sentiment_trend(news_articles, timeframe)
                
                # Extract themes
                positive_themes, negative_themes = self._extract_themes(news_articles)
                
                return SentimentAnalysis(
                    symbol=symbol,
                    timeframe=timeframe,
                    timestamp=datetime.utcnow(),
                    overall_sentiment=overall_sentiment,
                    sentiment_polarity=self._get_sentiment_polarity(overall_sentiment),
                    confidence=min(0.9, len(news_articles) / 50),  # Confidence based on data volume
                    sentiment_trend=sentiment_trend,
                    total_articles=len(news_articles),
                    positive_articles=positive_count,
                    negative_articles=negative_count,
                    neutral_articles=neutral_count,
                    sentiment_momentum=momentum,
                    volatility=volatility,
                    recent_articles=news_articles[:10],
                    positive_themes=positive_themes,
                    negative_themes=negative_themes
                )
                
            except Exception as e:
                logger.error(f"Error getting sentiment for {symbol}: {e}")
                return None
        
        return await self.get_or_set_cache(cache_key, fetch_stock_sentiment, ttl=600)
    
    async def get_stock_news(self, symbol: str, limit: int = 20, days_back: int = 7) -> List[NewsArticle]:
        """Get latest news articles for a stock with sentiment analysis"""
        cache_key = self.create_cache_key("stock_news", symbol, limit, days_back)
        
        async def fetch_news():
            try:
                # In production, this would use Alpha Vantage News API or similar
                # For now, using mock data with realistic structure
                
                news_articles = []
                
                # Mock news articles with sentiment analysis
                mock_articles = await self._generate_mock_news_articles(symbol, limit)
                
                for article_data in mock_articles:
                    # Analyze sentiment
                    sentiment_score = self._analyze_text_sentiment(
                        article_data["title"] + " " + article_data.get("summary", "")
                    )
                    
                    source = NewsSource(
                        name=article_data["source"],
                        url=article_data.get("source_url"),
                        reliability_score=self.news_sources.get(article_data["source_domain"], 0.5)
                    )
                    
                    article = NewsArticle(
                        title=article_data["title"],
                        summary=article_data.get("summary"),
                        content=article_data.get("content"),
                        url=article_data["url"],
                        source=source,
                        published_at=article_data["published_at"],
                        sentiment_score=sentiment_score,
                        sentiment_polarity=self._get_sentiment_polarity(sentiment_score),
                        confidence=0.8,  # Mock confidence
                        relevance_score=article_data.get("relevance", 0.8),
                        mentions=[symbol]
                    )
                    
                    news_articles.append(article)
                
                return news_articles
                
            except Exception as e:
                logger.error(f"Error fetching news for {symbol}: {e}")
                return []
        
        return await self.get_or_set_cache(cache_key, fetch_news, ttl=1800)  # Cache for 30 minutes
    
    async def get_social_sentiment(self, symbol: str, platform: str = "all", 
                                 timeframe: str = "24h") -> Optional[SocialSentiment]:
        """Get social media sentiment for a stock"""
        symbol = self.validate_symbol(symbol)
        cache_key = self.create_cache_key("social_sentiment", symbol, platform, timeframe)
        
        async def fetch_social_sentiment():
            try:
                # Mock social sentiment data (would integrate with Twitter API, Reddit API, etc.)
                mock_mentions = await self._generate_mock_social_mentions(symbol, platform)
                
                if not mock_mentions:
                    return None
                
                # Calculate metrics
                sentiment_scores = [mention.sentiment_score for mention in mock_mentions]
                overall_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0.0
                
                total_mentions = len(mock_mentions)
                total_reach = sum(mention.engagement.get("followers", 100) for mention in mock_mentions)
                total_engagement = sum(sum(mention.engagement.values()) for mention in mock_mentions)
                engagement_rate = total_engagement / total_reach if total_reach > 0 else 0.0
                
                # Check if trending
                is_trending = total_mentions > 100 or engagement_rate > 0.05
                trend_score = min(1.0, (total_mentions / 500) + engagement_rate)
                
                # Platform breakdown
                platform_breakdown = {}
                if platform == "all":
                    platforms = set(mention.platform for mention in mock_mentions)
                    for p in platforms:
                        platform_mentions = [m for m in mock_mentions if m.platform == p]
                        platform_breakdown[p] = {
                            "mentions": len(platform_mentions),
                            "sentiment": sum(m.sentiment_score for m in platform_mentions) / len(platform_mentions),
                            "engagement": sum(sum(m.engagement.values()) for m in platform_mentions)
                        }
                
                # Generate sentiment history
                sentiment_history = self._generate_social_sentiment_trend(mock_mentions, timeframe)
                
                return SocialSentiment(
                    symbol=symbol,
                    platform=platform,
                    timeframe=timeframe,
                    timestamp=datetime.utcnow(),
                    overall_sentiment=overall_sentiment,
                    sentiment_polarity=self._get_sentiment_polarity(overall_sentiment),
                    total_mentions=total_mentions,
                    mention_velocity=total_mentions / 24,  # Mentions per hour (assuming 24h timeframe)
                    reach=total_reach,
                    engagement_rate=engagement_rate,
                    is_trending=is_trending,
                    trend_score=trend_score,
                    platform_breakdown=platform_breakdown,
                    top_mentions=sorted(mock_mentions, key=lambda x: x.influence_score, reverse=True)[:5],
                    sentiment_history=sentiment_history
                )
                
            except Exception as e:
                logger.error(f"Error getting social sentiment for {symbol}: {e}")
                return None
        
        return await self.get_or_set_cache(cache_key, fetch_social_sentiment, ttl=900)  # Cache for 15 minutes
    
    async def get_trending_news(self, category: str = "market", limit: int = 50) -> List[NewsArticle]:
        """Get trending financial news with sentiment analysis"""
        cache_key = self.create_cache_key("trending_news", category, limit)
        
        async def fetch_trending():
            try:
                # Mock trending news (would use news aggregation APIs)
                trending_articles = []
                
                mock_articles = await self._generate_mock_trending_news(category, limit)
                
                for article_data in mock_articles:
                    sentiment_score = self._analyze_text_sentiment(article_data["title"])
                    
                    source = NewsSource(
                        name=article_data["source"],
                        url=article_data.get("source_url"),
                        reliability_score=self.news_sources.get(article_data["source_domain"], 0.5)
                    )
                    
                    article = NewsArticle(
                        title=article_data["title"],
                        summary=article_data.get("summary"),
                        url=article_data["url"],
                        source=source,
                        published_at=article_data["published_at"],
                        sentiment_score=sentiment_score,
                        sentiment_polarity=self._get_sentiment_polarity(sentiment_score),
                        confidence=0.7,
                        relevance_score=article_data.get("relevance", 0.9),
                        mentions=article_data.get("mentions", [])
                    )
                    
                    trending_articles.append(article)
                
                return trending_articles
                
            except Exception as e:
                logger.error(f"Error fetching trending news: {e}")
                return []
        
        return await self.get_or_set_cache(cache_key, fetch_trending, ttl=1800)
    
    async def get_sector_sentiment(self, sector: str, timeframe: str = "7d") -> Dict[str, Any]:
        """Get sentiment analysis for a specific sector"""
        cache_key = self.create_cache_key("sector_sentiment", sector, timeframe)
        
        async def fetch_sector_sentiment():
            # Mock sector sentiment data
            return {
                "sector": sector,
                "overall_sentiment": 0.3,
                "sentiment_polarity": "positive",
                "news_sentiment": 0.25,
                "social_sentiment": 0.35,
                "top_stocks": ["AAPL", "MSFT", "NVDA"],
                "trending_topics": ["AI", "earnings", "growth"]
            }
        
        return await self.get_or_set_cache(cache_key, fetch_sector_sentiment, ttl=3600)
    
    async def get_batch_sentiment(self, symbols: List[str], timeframe: str = "7d",
                                include_news: bool = True, include_social: bool = False) -> List[Dict[str, Any]]:
        """Get sentiment analysis for multiple stocks"""
        try:
            tasks = []
            for symbol in symbols:
                task = self.get_stock_sentiment(symbol, timeframe)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            batch_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Error getting sentiment for {symbols[i]}: {result}")
                    continue
                
                if result:
                    batch_results.append({
                        "symbol": symbols[i],
                        "sentiment_analysis": result
                    })
            
            return batch_results
            
        except Exception as e:
            logger.error(f"Error in batch sentiment analysis: {e}")
            return []
    
    async def get_trending_keywords(self, timeframe: str = "24h", category: str = "stocks") -> List[Dict[str, Any]]:
        """Get trending keywords and topics in financial discussions"""
        cache_key = self.create_cache_key("trending_keywords", timeframe, category)
        
        async def fetch_keywords():
            # Mock trending keywords
            return [
                {"keyword": "AI", "mentions": 1500, "sentiment": 0.4, "growth_rate": 0.25},
                {"keyword": "earnings", "mentions": 1200, "sentiment": 0.2, "growth_rate": 0.15},
                {"keyword": "Fed", "mentions": 800, "sentiment": -0.1, "growth_rate": -0.05},
                {"keyword": "inflation", "mentions": 600, "sentiment": -0.3, "growth_rate": 0.10},
                {"keyword": "growth", "mentions": 500, "sentiment": 0.5, "growth_rate": 0.30}
            ]
        
        return await self.get_or_set_cache(cache_key, fetch_keywords, ttl=3600)
    
    async def get_sentiment_summary(self) -> Dict[str, Any]:
        """Get overall sentiment summary across markets and top stocks"""
        cache_key = self.create_cache_key("sentiment_summary")
        
        async def fetch_summary():
            try:
                market_sentiment = await self.get_market_sentiment()
                
                # Mock data for summary
                return {
                    "market_sentiment_score": market_sentiment.overall_sentiment,
                    "market_sentiment_label": market_sentiment.sentiment_polarity.value,
                    "most_bullish_stocks": [
                        {"symbol": "NVDA", "sentiment": 0.8},
                        {"symbol": "AAPL", "sentiment": 0.6}, 
                        {"symbol": "MSFT", "sentiment": 0.5}
                    ],
                    "most_bearish_stocks": [
                        {"symbol": "NFLX", "sentiment": -0.4},
                        {"symbol": "META", "sentiment": -0.3},
                        {"symbol": "TSLA", "sentiment": -0.2}
                    ],
                    "sentiment_extremes": {
                        "very_bullish": ["NVDA"],
                        "very_bearish": []
                    },
                    "key_insights": [
                        "AI stocks showing strong positive sentiment",
                        "Tech sector sentiment improving",
                        "Market sentiment cautiously optimistic"
                    ],
                    "risk_factors": [
                        "Fed policy uncertainty",
                        "Inflation concerns"
                    ],
                    "opportunities": [
                        "AI and tech stocks momentum",
                        "Oversold value opportunities"
                    ]
                }
                
            except Exception as e:
                logger.error(f"Error getting sentiment summary: {e}")
                return {}
        
        return await self.get_or_set_cache(cache_key, fetch_summary, ttl=1800)
    
    # Helper methods
    
    def _analyze_text_sentiment(self, text: str) -> float:
        """Simple rule-based sentiment analysis"""
        if not text:
            return 0.0
        
        text_lower = text.lower()
        
        # Count bullish and bearish keywords
        bullish_count = sum(1 for keyword in self.bullish_keywords if keyword in text_lower)
        bearish_count = sum(1 for keyword in self.bearish_keywords if keyword in text_lower)
        
        # Simple scoring
        total_words = len(text.split())
        if total_words == 0:
            return 0.0
        
        bullish_score = bullish_count / total_words
        bearish_score = bearish_count / total_words
        
        sentiment = (bullish_score - bearish_score) * 5  # Scale factor
        
        # Clamp to -1 to 1 range
        return max(-1.0, min(1.0, sentiment))
    
    def _get_sentiment_polarity(self, score: float) -> SentimentPolarity:
        """Convert sentiment score to polarity enum"""
        if score >= 0.5:
            return SentimentPolarity.VERY_POSITIVE
        elif score >= 0.1:
            return SentimentPolarity.POSITIVE
        elif score >= -0.1:
            return SentimentPolarity.NEUTRAL
        elif score >= -0.5:
            return SentimentPolarity.NEGATIVE
        else:
            return SentimentPolarity.VERY_NEGATIVE
    
    def _generate_sentiment_trend(self, articles: List[NewsArticle], timeframe: str) -> List[SentimentTrend]:
        """Generate sentiment trend from articles"""
        trend_data = []
        
        # Group articles by day and calculate daily sentiment
        daily_sentiments = {}
        for article in articles:
            date_key = article.published_at.date()
            if date_key not in daily_sentiments:
                daily_sentiments[date_key] = []
            daily_sentiments[date_key].append(article.sentiment_score)
        
        # Create trend points
        for date, scores in daily_sentiments.items():
            avg_sentiment = sum(scores) / len(scores) if scores else 0.0
            trend_data.append(SentimentTrend(
                date=datetime.combine(date, datetime.min.time()),
                sentiment_score=avg_sentiment,
                article_count=len(scores),
                volume_weighted_sentiment=avg_sentiment  # Simplified
            ))
        
        return sorted(trend_data, key=lambda x: x.date)
    
    def _extract_themes(self, articles: List[NewsArticle]) -> tuple:
        """Extract positive and negative themes from articles"""
        positive_themes = []
        negative_themes = []
        
        for article in articles:
            if article.sentiment_score > 0.2:
                # Extract themes from positive articles
                if "earnings" in article.title.lower():
                    positive_themes.append("Strong earnings")
                if "growth" in article.title.lower():
                    positive_themes.append("Growth prospects")
            elif article.sentiment_score < -0.2:
                # Extract themes from negative articles
                if "decline" in article.title.lower():
                    negative_themes.append("Market decline")
                if "concern" in article.title.lower():
                    negative_themes.append("Market concerns")
        
        return list(set(positive_themes)), list(set(negative_themes))
    
    # Mock data generators (would be replaced with real API calls)
    
    async def _generate_mock_news_articles(self, symbol: str, limit: int) -> List[Dict[str, Any]]:
        """Generate mock news articles for testing"""
        articles = []
        base_time = datetime.now()
        
        for i in range(min(limit, 20)):  # Limit to 20 for demo
            articles.append({
                "title": f"{symbol} Shows Strong Performance in Q3 Earnings",
                "summary": f"Analysis of {symbol}'s recent financial performance and market outlook",
                "url": f"https://example.com/news/{symbol.lower()}-earnings-{i}",
                "source": "MarketWatch",
                "source_domain": "marketwatch.com",
                "source_url": "https://marketwatch.com",
                "published_at": base_time - timedelta(hours=i*2),
                "relevance": 0.8 + (i % 3) * 0.05
            })
        
        return articles
    
    async def _generate_mock_trending_news(self, category: str, limit: int) -> List[Dict[str, Any]]:
        """Generate mock trending news"""
        articles = []
        base_time = datetime.now()
        
        titles = [
            "Market Rally Continues Amid Fed Policy Optimism",
            "Tech Stocks Lead Market Higher on AI Enthusiasm", 
            "Economic Data Shows Resilient Growth",
            "Corporate Earnings Beat Expectations",
            "Inflation Concerns Ease as Data Shows Moderation"
        ]
        
        for i, title in enumerate(titles[:limit]):
            articles.append({
                "title": title,
                "summary": f"Analysis of current market conditions and trends - {title}",
                "url": f"https://example.com/trending/{i}",
                "source": "Reuters",
                "source_domain": "reuters.com",
                "published_at": base_time - timedelta(hours=i),
                "relevance": 0.9,
                "mentions": ["SPY", "QQQ"]
            })
        
        return articles
    
    async def _generate_mock_social_mentions(self, symbol: str, platform: str):
        """Generate mock social media mentions"""
        from app.models.sentiment_schemas import SocialMention
        
        mentions = []
        platforms = ["twitter", "reddit"] if platform == "all" else [platform]
        
        for i in range(10):  # Generate 10 mock mentions
            mentions.append(SocialMention(
                platform=platforms[i % len(platforms)],
                content=f"Interesting movement in ${symbol} today. Watching for breakout.",
                author=f"user_{i}",
                timestamp=datetime.now() - timedelta(hours=i),
                engagement={"likes": 10 + i*5, "shares": 2 + i, "followers": 100 + i*50},
                sentiment_score=0.2 + (i % 5 - 2) * 0.1,
                influence_score=0.5 + (i % 3) * 0.2
            ))
        
        return mentions
    
    def _generate_social_sentiment_trend(self, mentions, timeframe: str) -> List[SentimentTrend]:
        """Generate social sentiment trend from mentions"""
        # Group by hour and calculate sentiment
        hourly_sentiments = {}
        for mention in mentions:
            hour_key = mention.timestamp.replace(minute=0, second=0, microsecond=0)
            if hour_key not in hourly_sentiments:
                hourly_sentiments[hour_key] = []
            hourly_sentiments[hour_key].append(mention.sentiment_score)
        
        trend_data = []
        for hour, scores in hourly_sentiments.items():
            avg_sentiment = sum(scores) / len(scores) if scores else 0.0
            trend_data.append(SentimentTrend(
                date=hour,
                sentiment_score=avg_sentiment,
                article_count=len(scores),
                volume_weighted_sentiment=avg_sentiment
            ))
        
        return sorted(trend_data, key=lambda x: x.date)
    
    async def _get_news_sentiment_score(self, topic: str) -> float:
        """Get news sentiment score for a topic"""
        return 0.2  # Mock positive news sentiment
    
    async def _get_social_sentiment_score(self, topic: str) -> float:
        """Get social media sentiment score"""
        return 0.1  # Mock neutral social sentiment
    
    async def _get_economic_sentiment_score(self) -> float:
        """Get economic data sentiment"""
        return 0.0  # Mock neutral economic sentiment
    
    async def _get_fear_greed_components(self) -> Dict[str, Any]:
        """Get Fear & Greed index components"""
        return {
            "value": 55,
            "stock_price_momentum": 60,
            "stock_price_strength": 50,
            "stock_price_breadth": 55,
            "put_call_ratio": 45,
            "market_volatility": 40,
            "safe_haven_demand": 50,
            "junk_bond_demand": 60
        }
    
    async def _get_sector_sentiments(self) -> Dict[str, float]:
        """Get sentiment by sector"""
        return {
            "Technology": 0.4,
            "Healthcare": 0.2,
            "Financial": 0.1,
            "Energy": -0.1,
            "Consumer": 0.3
        }
    
    async def _get_trending_topics(self) -> List[str]:
        """Get trending market topics"""
        return ["AI", "earnings", "Fed policy", "inflation", "growth"]
    
    def _get_trending_bullish_keywords(self) -> List[str]:
        """Get trending bullish keywords"""
        return ["rally", "breakout", "growth", "bullish", "strong"]
    
    def _get_trending_bearish_keywords(self) -> List[str]:
        """Get trending bearish keywords"""
        return ["decline", "sell", "weak", "bearish", "concern"]
    
    async def _get_vix_sentiment(self) -> float:
        """Get VIX-based sentiment"""
        return 0.1  # Mock VIX sentiment
    
    async def _get_put_call_ratio(self) -> float:
        """Get put/call ratio"""
        return 0.9  # Mock put/call ratio
    
    async def _get_high_low_sentiment(self) -> float:
        """Get 52-week high/low sentiment"""
        return 0.2  # Mock high/low sentiment