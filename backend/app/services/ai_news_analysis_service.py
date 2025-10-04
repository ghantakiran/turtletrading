"""
AI-Powered News Analysis Service

Integrates with Claude/OpenAI APIs for intelligent news analysis,
categorization, sentiment enhancement, and impact prediction.
"""

import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from datetime import datetime
from loguru import logger

from app.core.config import settings


class AINewsAnalysisService:
    """
    AI-powered news analysis using Claude API (Anthropic).
    Falls back to pattern matching if API is unavailable.
    """

    def __init__(self):
        self.api_key = getattr(settings, 'ANTHROPIC_API_KEY', None) or getattr(settings, 'OPENAI_API_KEY', None)
        self.api_base_url = "https://api.anthropic.com/v1/messages"
        self.model = "claude-3-5-sonnet-20241022"

        # Backup pattern-based categorization
        self.category_keywords = {
            'earnings': ['earnings', 'revenue', 'profit', 'eps', 'guidance', 'quarterly results'],
            'economic': ['fed', 'interest rate', 'inflation', 'gdp', 'unemployment', 'economic'],
            'regulatory': ['sec', 'regulation', 'lawsuit', 'court', 'legal', 'compliance'],
            'geopolitical': ['trade war', 'tariff', 'sanctions', 'geopolitical', 'international'],
            'corporate': ['acquisition', 'merger', 'ceo', 'partnership', 'product launch']
        }

    async def analyze_news_with_ai(
        self,
        title: str,
        content: str,
        source: str,
        base_sentiment: float,
        symbols: List[str]
    ) -> Dict[str, Any]:
        """
        Analyze news article using Claude AI for comprehensive analysis.

        Args:
            title: Article title
            content: Article content
            source: News source
            base_sentiment: Base sentiment score from NLP
            symbols: Related stock symbols

        Returns:
            Enhanced analysis with category, impact, sentiment, and summary
        """
        if not self.api_key:
            logger.warning("AI API key not configured, using fallback analysis")
            return self._fallback_analysis(title, content, source, base_sentiment, symbols)

        try:
            # Construct AI prompt for news analysis
            prompt = self._create_analysis_prompt(title, content, source, base_sentiment, symbols)

            # Call Claude API
            response = await self._call_claude_api(prompt)

            # Parse AI response
            analysis = self._parse_ai_response(response, base_sentiment)

            return analysis

        except Exception as e:
            logger.error(f"AI analysis failed: {e}, falling back to pattern matching")
            return self._fallback_analysis(title, content, source, base_sentiment, symbols)

    def _create_analysis_prompt(
        self,
        title: str,
        content: str,
        source: str,
        base_sentiment: float,
        symbols: List[str]
    ) -> str:
        """Create structured prompt for Claude API."""

        sentiment_label = "positive" if base_sentiment > 0.1 else "negative" if base_sentiment < -0.1 else "neutral"

        return f"""You are a financial news analyst. Analyze this news article and provide structured insights.

Article Title: {title}
News Source: {source}
Related Stocks: {', '.join(symbols)}
Base Sentiment: {sentiment_label} (score: {base_sentiment:.2f})
Content Preview: {content[:500] if content else title}

Please analyze and provide:
1. **Category**: Classify as one of: earnings, economic, regulatory, geopolitical, corporate
2. **Impact Level**: Rate as high, medium, or low based on market significance
3. **Impact Score**: Number from 0.0 to 1.0 indicating market impact magnitude
4. **Enhanced Sentiment**: Refined sentiment score from -1.0 (very bearish) to 1.0 (very bullish)
5. **Summary**: Concise 1-2 sentence summary focusing on market implications
6. **Key Insights**: 2-3 bullet points of critical takeaways for traders
7. **Flash News**: true/false - is this breaking/urgent news requiring immediate attention?

Respond in this exact JSON format:
{{
  "category": "earnings|economic|regulatory|geopolitical|corporate",
  "impact_level": "high|medium|low",
  "impact_score": 0.0-1.0,
  "enhanced_sentiment": -1.0 to 1.0,
  "summary": "concise summary",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "is_flash_news": true|false,
  "confidence": 0.0-1.0
}}"""

    async def _call_claude_api(self, prompt: str) -> Dict[str, Any]:
        """Call Claude API with retry logic."""

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.api_base_url,
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Claude API error {response.status}: {error_text}")

                result = await response.json()
                return result

    def _parse_ai_response(self, api_response: Dict[str, Any], fallback_sentiment: float) -> Dict[str, Any]:
        """Parse Claude API response into structured analysis."""

        try:
            # Extract text content from Claude response
            content_blocks = api_response.get('content', [])
            if not content_blocks:
                raise ValueError("No content in API response")

            response_text = content_blocks[0].get('text', '')

            # Extract JSON from response (handle markdown code blocks)
            import json
            import re

            # Try to find JSON block
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                analysis = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")

            # Validate and normalize fields
            return {
                'category': analysis.get('category', 'corporate'),
                'impact_level': analysis.get('impact_level', 'medium'),
                'impact_score': float(analysis.get('impact_score', 0.5)),
                'enhanced_sentiment': float(analysis.get('enhanced_sentiment', fallback_sentiment)),
                'original_sentiment': fallback_sentiment,
                'summary': analysis.get('summary', '')[:300],  # Limit summary length
                'key_insights': analysis.get('key_insights', [])[:3],  # Max 3 insights
                'is_flash_news': bool(analysis.get('is_flash_news', False)),
                'ai_confidence': float(analysis.get('confidence', 0.8)),
                'analysis_method': 'ai_claude',
                'analysis_timestamp': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            raise

    def _fallback_analysis(
        self,
        title: str,
        content: str,
        source: str,
        base_sentiment: float,
        symbols: List[str]
    ) -> Dict[str, Any]:
        """Fallback pattern-based analysis when AI is unavailable."""

        text = f"{title} {content}".lower()

        # Simple category detection
        category_scores = {}
        for cat, keywords in self.category_keywords.items():
            score = sum(1 for kw in keywords if kw.lower() in text)
            category_scores[cat] = score

        category = max(category_scores, key=category_scores.get) if max(category_scores.values()) > 0 else 'corporate'

        # Simple impact scoring
        sentiment_magnitude = abs(base_sentiment)
        high_impact_words = ['breaking', 'urgent', 'record', 'unprecedented', 'crisis']
        has_high_impact = any(word in text for word in high_impact_words)

        impact_score = min(sentiment_magnitude * 1.2 if has_high_impact else sentiment_magnitude, 1.0)
        impact_level = 'high' if impact_score >= 0.7 else 'medium' if impact_score >= 0.4 else 'low'

        # Simple summary
        summary = title[:200] + ('...' if len(title) > 200 else '')

        return {
            'category': category,
            'impact_level': impact_level,
            'impact_score': impact_score,
            'enhanced_sentiment': base_sentiment,
            'original_sentiment': base_sentiment,
            'summary': summary,
            'key_insights': [f"Article from {source} about {', '.join(symbols)}"],
            'is_flash_news': has_high_impact and impact_score >= 0.7,
            'ai_confidence': 0.6,
            'analysis_method': 'fallback_pattern_matching',
            'analysis_timestamp': datetime.utcnow().isoformat()
        }

    async def batch_analyze_news(
        self,
        articles: List[Dict[str, Any]],
        max_concurrent: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Analyze multiple news articles concurrently with rate limiting.

        Args:
            articles: List of article dicts with title, content, source, sentiment, symbols
            max_concurrent: Maximum concurrent AI API calls

        Returns:
            List of enhanced analysis results
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def analyze_with_limit(article: Dict[str, Any]):
            async with semaphore:
                return await self.analyze_news_with_ai(
                    title=article.get('title', ''),
                    content=article.get('content', ''),
                    source=article.get('source', ''),
                    base_sentiment=article.get('sentiment', 0.0),
                    symbols=article.get('symbols', [])
                )

        results = await asyncio.gather(
            *[analyze_with_limit(article) for article in articles],
            return_exceptions=True
        )

        # Filter out exceptions and log errors
        analyzed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Failed to analyze article {i}: {result}")
                # Use fallback for failed analyses
                analyzed_results.append(
                    self._fallback_analysis(
                        articles[i].get('title', ''),
                        articles[i].get('content', ''),
                        articles[i].get('source', ''),
                        articles[i].get('sentiment', 0.0),
                        articles[i].get('symbols', [])
                    )
                )
            else:
                analyzed_results.append(result)

        return analyzed_results


# Global service instance
_ai_news_analysis_service: Optional[AINewsAnalysisService] = None


def get_ai_news_analysis_service() -> AINewsAnalysisService:
    """Get or create AI news analysis service singleton."""
    global _ai_news_analysis_service
    if _ai_news_analysis_service is None:
        _ai_news_analysis_service = AINewsAnalysisService()
    return _ai_news_analysis_service
