"""
AI News Enhancement Service

Provides intelligent news categorization, impact scoring, and analysis
using pattern matching, NLP, and rule-based AI systems.
"""

import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from loguru import logger

from app.models.sentiment_schemas import NewsArticle, SentimentPolarity


class AINewsEnhancementService:
    """
    AI-powered news enhancement service for intelligent categorization,
    impact scoring, and analysis without external API dependencies.
    """

    def __init__(self):
        # Category detection patterns
        self.category_patterns = {
            'earnings': [
                r'\bearnings?\b', r'\bq[1-4]\s+(?:earnings|results)\b',
                r'\brevenue\b', r'\bprofit\b', r'\beats?\s+(?:estimates?|expectations?)\b',
                r'\bmisses?\s+(?:estimates?|expectations?)\b', r'\bguidance\b',
                r'\bquarter(?:ly)?\s+results?\b', r'\beps\b', r'\bbeats?\s+street\b'
            ],
            'economic': [
                r'\bfed(?:eral\s+reserve)?\b', r'\binterest\s+rates?\b',
                r'\binflation\b', r'\bunemployment\b', r'\bgdp\b',
                r'\bmonetary\s+policy\b', r'\btaper(?:ing)?\b',
                r'\beconomic\s+(?:data|indicators?|growth)\b',
                r'\bfomc\b', r'\bcentral\s+bank\b', r'\brecession\b'
            ],
            'regulatory': [
                r'\bsec\b', r'\bregulat(?:ion|ory|or)\b', r'\banti(?:-)?trust\b',
                r'\blawsuit\b', r'\blegal\b', r'\bcourt\b', r'\bjudge\b',
                r'\bfda\b', r'\bapproval\b', r'\bcompliance\b',
                r'\binvestigation\b', r'\bfine\b', r'\bpenalty\b'
            ],
            'geopolitical': [
                r'\btrade\s+(?:war|deal|agreement)\b', r'\btariff\b',
                r'\bsanctions?\b', r'\bgeopolitic(?:al|s)\b',
                r'\bchina\s+(?:us|trade)\b', r'\bbrexit\b',
                r'\bconflict\b', r'\bwar\b', r'\binternational\s+relations\b'
            ],
            'corporate': [
                r'\bacquisition\b', r'\bmerger\b', r'\bceo\b', r'\bleadership\b',
                r'\bproduct\s+launch\b', r'\binnovation\b', r'\bpartnership\b',
                r'\brestructuring\b', r'\blayoffs?\b', r'\bhiring\b',
                r'\bstrategy\b', r'\bexpansion\b'
            ]
        }

        # Impact indicators
        self.high_impact_indicators = [
            r'\brecord\b', r'\bunprecedented\b', r'\bhistoric\b',
            r'\bemergency\b', r'\bcrisis\b', r'\bcrash\b',
            r'\bsurge\b', r'\bplunge\b', r'\bhalt(?:ed|s)?\b',
            r'\bsuspend(?:ed|s)?\b', r'\bshut(?:down|s)?\b',
            r'\bbreaking\b', r'\balert\b', r'\burgent\b'
        ]

        self.medium_impact_indicators = [
            r'\bsignificant\b', r'\bsubstantial\b', r'\bmajor\b',
            r'\bnotable\b', r'\bimpact\b', r'\bchange\b',
            r'\bshift\b', r'\bmove\b', r'\bupdate\b'
        ]

        # Sentiment intensifiers
        self.bullish_intensifiers = [
            r'\bstrong(?:ly)?\b', r'\brobust\b', r'\bsoar(?:ed|ing|s)?\b',
            r'\bsurge(?:d|s)?\b', r'\bexceed(?:ed|s)?\b', r'\boutperform(?:ed|s|ing)?\b',
            r'\brecord-high\b', r'\ball-time\s+high\b', r'\bbreakthrough\b'
        ]

        self.bearish_intensifiers = [
            r'\bweak(?:ness)?\b', r'\bplunge(?:d|s)?\b', r'\bcrash(?:ed|es)?\b',
            r'\bmiss(?:ed|es)?\b', r'\bunderperform(?:ed|s|ing)?\b',
            r'\brecord-low\b', r'\ball-time\s+low\b', r'\bcollapse(?:d|s)?\b'
        ]

        # Source reliability scores
        self.source_reliability = {
            'reuters': 0.95,
            'bloomberg': 0.95,
            'wall street journal': 0.95,
            'wsj': 0.95,
            'financial times': 0.90,
            'cnbc': 0.85,
            'marketwatch': 0.85,
            'yahoo finance': 0.80,
            'seeking alpha': 0.75,
            'benzinga': 0.70,
            'fool': 0.65,
            'unknown': 0.50
        }

    def categorize_news(self, title: str, content: str = "") -> str:
        """
        Intelligently categorize news article using pattern matching.

        Args:
            title: Article title
            content: Article content (optional)

        Returns:
            Category: earnings, economic, regulatory, geopolitical, or corporate
        """
        text = f"{title} {content}".lower()

        # Calculate match scores for each category
        category_scores = {}
        for category, patterns in self.category_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches
            category_scores[category] = score

        # Return category with highest score, default to corporate
        if max(category_scores.values()) > 0:
            return max(category_scores, key=category_scores.get)

        return 'corporate'

    def calculate_impact_score(
        self,
        title: str,
        content: str,
        sentiment_score: float,
        source: str,
        symbols: List[str]
    ) -> Tuple[str, float]:
        """
        Calculate news impact score and level.

        Args:
            title: Article title
            content: Article content
            sentiment_score: Sentiment score (-1 to 1)
            source: News source
            symbols: Related stock symbols

        Returns:
            Tuple of (impact_level, impact_score)
            impact_level: 'high', 'medium', or 'low'
            impact_score: 0.0 to 1.0
        """
        text = f"{title} {content}".lower()

        # Base impact from sentiment magnitude
        sentiment_magnitude = abs(sentiment_score)
        base_impact = sentiment_magnitude

        # Source reliability multiplier
        source_lower = source.lower()
        source_score = self.source_reliability.get(source_lower, 0.5)
        for key in self.source_reliability:
            if key in source_lower:
                source_score = self.source_reliability[key]
                break

        # High impact indicators
        high_impact_count = sum(
            len(re.findall(pattern, text, re.IGNORECASE))
            for pattern in self.high_impact_indicators
        )

        # Medium impact indicators
        medium_impact_count = sum(
            len(re.findall(pattern, text, re.IGNORECASE))
            for pattern in self.medium_impact_indicators
        )

        # Calculate composite impact score
        impact_score = (
            base_impact * 0.4 +  # Sentiment magnitude weight
            source_score * 0.3 +  # Source reliability weight
            min(high_impact_count * 0.15, 0.15) +  # High impact indicators
            min(medium_impact_count * 0.10, 0.10) +  # Medium impact indicators
            min(len(symbols) * 0.05, 0.05)  # Multi-stock relevance
        )

        # Cap at 1.0
        impact_score = min(impact_score, 1.0)

        # Determine impact level
        if impact_score >= 0.7:
            impact_level = 'high'
        elif impact_score >= 0.4:
            impact_level = 'medium'
        else:
            impact_level = 'low'

        return impact_level, impact_score

    def enhance_sentiment_score(
        self,
        base_sentiment: float,
        title: str,
        content: str = ""
    ) -> float:
        """
        Enhance sentiment score with intensifier detection.

        Args:
            base_sentiment: Base sentiment score (-1 to 1)
            title: Article title
            content: Article content

        Returns:
            Enhanced sentiment score (-1 to 1)
        """
        text = f"{title} {content}".lower()

        # Count bullish intensifiers
        bullish_count = sum(
            len(re.findall(pattern, text, re.IGNORECASE))
            for pattern in self.bullish_intensifiers
        )

        # Count bearish intensifiers
        bearish_count = sum(
            len(re.findall(pattern, text, re.IGNORECASE))
            for pattern in self.bearish_intensifiers
        )

        # Adjust sentiment based on intensifiers
        intensifier_adjustment = (bullish_count - bearish_count) * 0.05
        enhanced_sentiment = base_sentiment + intensifier_adjustment

        # Clamp to [-1, 1]
        return max(-1.0, min(1.0, enhanced_sentiment))

    def generate_summary(
        self,
        title: str,
        content: str,
        max_length: int = 150
    ) -> str:
        """
        Generate intelligent summary from title and content.

        For now, uses title with smart truncation. Can be enhanced
        with extractive summarization or external APIs later.

        Args:
            title: Article title
            content: Article content
            max_length: Maximum summary length

        Returns:
            Summary text
        """
        # If title is short enough, use it as summary
        if len(title) <= max_length:
            return title

        # Smart truncation at sentence boundary
        sentences = re.split(r'[.!?]+', title)
        if sentences:
            summary = sentences[0].strip()
            if len(summary) <= max_length:
                return summary + '.'

        # Fallback to truncation with ellipsis
        return title[:max_length-3].strip() + '...'

    def is_flash_news(
        self,
        published_at: datetime,
        impact_score: float,
        category: str
    ) -> bool:
        """
        Determine if news should be marked as flash/breaking news.

        Args:
            published_at: Publication timestamp
            impact_score: Calculated impact score
            category: News category

        Returns:
            True if flash news, False otherwise
        """
        # Time threshold (1 hour for most, 4 hours for earnings)
        if category == 'earnings':
            time_threshold = timedelta(hours=4)
        else:
            time_threshold = timedelta(hours=1)

        time_since_publish = datetime.utcnow() - published_at
        is_recent = time_since_publish <= time_threshold

        # High impact + recent = flash news
        is_high_impact = impact_score >= 0.7

        return is_recent and is_high_impact

    def analyze_news_article(
        self,
        title: str,
        content: str,
        source: str,
        sentiment_score: float,
        published_at: datetime,
        symbols: List[str]
    ) -> Dict:
        """
        Comprehensive news article analysis with all AI enhancements.

        Args:
            title: Article title
            content: Article content
            source: News source
            sentiment_score: Base sentiment score
            published_at: Publication timestamp
            symbols: Related stock symbols

        Returns:
            Dict with enhanced analysis results
        """
        # Category detection
        category = self.categorize_news(title, content)

        # Enhanced sentiment
        enhanced_sentiment = self.enhance_sentiment_score(
            sentiment_score, title, content
        )

        # Impact scoring
        impact_level, impact_score = self.calculate_impact_score(
            title, content, enhanced_sentiment, source, symbols
        )

        # Flash news detection
        is_flash = self.is_flash_news(published_at, impact_score, category)

        # Summary generation
        summary = self.generate_summary(title, content)

        return {
            'category': category,
            'enhanced_sentiment': enhanced_sentiment,
            'original_sentiment': sentiment_score,
            'impact_level': impact_level,
            'impact_score': impact_score,
            'is_flash_news': is_flash,
            'summary': summary,
            'analysis_timestamp': datetime.utcnow().isoformat()
        }


# Global service instance
_ai_news_service: Optional[AINewsEnhancementService] = None


def get_ai_news_service() -> AINewsEnhancementService:
    """Get or create AI news enhancement service singleton."""
    global _ai_news_service
    if _ai_news_service is None:
        _ai_news_service = AINewsEnhancementService()
    return _ai_news_service
