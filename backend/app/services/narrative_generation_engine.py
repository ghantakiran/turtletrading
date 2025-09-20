"""
Narrative Generation Engine for TurtleTrading LLM Insights System

Core engine for generating AI-powered market narratives using multiple LLM providers
with advanced prompt engineering, streaming, and quality control.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, AsyncGenerator, Tuple
import aiohttp
import redis.asyncio as redis
from jinja2 import Environment, BaseLoader, DictLoader
import tiktoken
from abc import ABC, abstractmethod

from ..models.llm_narrative_models import (
    NarrativeRequest, GeneratedNarrative, NarrativeType, NarrativeTone,
    NarrativeLength, LLMProvider, LLMConfiguration, TradingInsight,
    TradingRecommendation, NarrativeTemplate, NarrativeStreamEvent,
    NarrativeQualityMetrics, InsightPriority
)

logger = logging.getLogger(__name__)


class LLMProviderInterface(ABC):
    """Abstract interface for LLM providers"""

    @abstractmethod
    async def generate_completion(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        stream: bool = False
    ) -> Union[str, AsyncGenerator[str, None]]:
        """Generate text completion"""
        pass

    @abstractmethod
    async def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        pass

    @abstractmethod
    async def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Estimate generation cost"""
        pass


class OpenAIProvider(LLMProviderInterface):
    """OpenAI GPT provider implementation"""

    def __init__(self, config: LLMConfiguration):
        self.config = config
        self.api_key = config.api_key
        self.model = config.model_name
        self.base_url = config.api_endpoint or "https://api.openai.com/v1"

        # Initialize tokenizer
        try:
            self.encoding = tiktoken.encoding_for_model(self.model)
        except KeyError:
            self.encoding = tiktoken.get_encoding("cl100k_base")

    async def generate_completion(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        stream: bool = False
    ) -> Union[str, AsyncGenerator[str, None]]:
        """Generate completion using OpenAI API"""

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": self.config.top_p,
            "frequency_penalty": self.config.frequency_penalty,
            "presence_penalty": self.config.presence_penalty,
            "stream": stream
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=self.config.timeout_seconds)
                ) as response:

                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"OpenAI API error {response.status}: {error_text}")

                    if stream:
                        return self._stream_response(response)
                    else:
                        result = await response.json()
                        return result["choices"][0]["message"]["content"]

        except Exception as e:
            logger.error(f"OpenAI generation error: {e}")
            raise

    async def _stream_response(self, response) -> AsyncGenerator[str, None]:
        """Stream response from OpenAI"""
        async for line in response.content:
            line = line.decode('utf-8').strip()
            if line.startswith('data: '):
                data = line[6:]
                if data == '[DONE]':
                    break
                try:
                    chunk = json.loads(data)
                    if 'choices' in chunk and len(chunk['choices']) > 0:
                        delta = chunk['choices'][0].get('delta', {})
                        if 'content' in delta:
                            yield delta['content']
                except json.JSONDecodeError:
                    continue

    async def count_tokens(self, text: str) -> int:
        """Count tokens using tiktoken"""
        return len(self.encoding.encode(text))

    async def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost based on token usage"""
        total_tokens = input_tokens + output_tokens
        return (total_tokens / 1000) * self.config.cost_per_1k_tokens


class AnthropicProvider(LLMProviderInterface):
    """Anthropic Claude provider implementation"""

    def __init__(self, config: LLMConfiguration):
        self.config = config
        self.api_key = config.api_key
        self.model = config.model_name
        self.base_url = config.api_endpoint or "https://api.anthropic.com/v1"

    async def generate_completion(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        stream: bool = False
    ) -> Union[str, AsyncGenerator[str, None]]:
        """Generate completion using Anthropic API"""

        # Combine system prompt and user prompt for Claude
        full_prompt = ""
        if system_prompt:
            full_prompt = f"System: {system_prompt}\n\nHuman: {prompt}\n\nAssistant:"
        else:
            full_prompt = f"Human: {prompt}\n\nAssistant:"

        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "max_tokens_to_sample": max_tokens,
            "temperature": temperature,
            "stream": stream
        }

        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/complete",
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=self.config.timeout_seconds)
                ) as response:

                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"Anthropic API error {response.status}: {error_text}")

                    if stream:
                        return self._stream_response(response)
                    else:
                        result = await response.json()
                        return result["completion"]

        except Exception as e:
            logger.error(f"Anthropic generation error: {e}")
            raise

    async def _stream_response(self, response) -> AsyncGenerator[str, None]:
        """Stream response from Anthropic"""
        async for line in response.content:
            line = line.decode('utf-8').strip()
            if line.startswith('data: '):
                data = line[6:]
                try:
                    chunk = json.loads(data)
                    if 'completion' in chunk:
                        yield chunk['completion']
                except json.JSONDecodeError:
                    continue

    async def count_tokens(self, text: str) -> int:
        """Estimate tokens for Anthropic (approximate)"""
        # Rough approximation: 1 token ≈ 4 characters
        return len(text) // 4

    async def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost for Anthropic"""
        total_tokens = input_tokens + output_tokens
        return (total_tokens / 1000) * self.config.cost_per_1k_tokens


class PromptTemplateEngine:
    """Template engine for generating LLM prompts"""

    def __init__(self):
        self.jinja_env = Environment(loader=DictLoader({}))
        self.templates = self._load_default_templates()

    def _load_default_templates(self) -> Dict[str, NarrativeTemplate]:
        """Load default prompt templates"""
        templates = {}

        # Market Overview Template
        templates["market_overview"] = NarrativeTemplate(
            template_id="market_overview",
            name="Market Overview",
            description="Comprehensive market overview with indices and sentiment",
            narrative_type=NarrativeType.MARKET_OVERVIEW,
            system_prompt="""You are a professional financial analyst providing market insights to retail investors.
Your analysis should be accurate, actionable, and appropriately cautious about risks.""",
            user_prompt_template="""Generate a {{ length }} market overview for {{ current_date }}.

Market Data:
- S&P 500: {{ sp500_price }} ({{ sp500_change }}%)
- NASDAQ: {{ nasdaq_price }} ({{ nasdaq_change }}%)
- VIX: {{ vix }}
- Top Gainers: {{ top_gainers }}
- Top Losers: {{ top_losers }}

Key Market Events:
{{ market_events }}

Sentiment Analysis:
- News Sentiment: {{ news_sentiment }}
- Social Sentiment: {{ social_sentiment }}

User Context:
- Risk Tolerance: {{ risk_tolerance }}
- Portfolio: {{ portfolio_symbols }}
- Investment Horizon: {{ investment_horizon }}

Provide insights on:
1. Overall market direction and sentiment
2. Key drivers of today's performance
3. Sector rotation opportunities
4. Risk factors to watch
5. Implications for the user's portfolio

Tone: {{ tone }}
Length: {{ length }}""",
            variables=["length", "current_date", "sp500_price", "sp500_change", "nasdaq_price",
                     "nasdaq_change", "vix", "top_gainers", "top_losers", "market_events",
                     "news_sentiment", "social_sentiment", "risk_tolerance", "portfolio_symbols",
                     "investment_horizon", "tone"],
            default_tone=NarrativeTone.PROFESSIONAL,
            default_length=NarrativeLength.MEDIUM
        )

        # Stock Analysis Template
        templates["stock_analysis"] = NarrativeTemplate(
            template_id="stock_analysis",
            name="Stock Analysis",
            description="Detailed analysis of individual stock",
            narrative_type=NarrativeType.STOCK_ANALYSIS,
            system_prompt="""You are an expert equity analyst providing detailed stock analysis.
Focus on both technical and fundamental factors, and provide balanced perspectives on opportunities and risks.""",
            user_prompt_template="""Analyze {{ symbol }} ({{ company_name }}) for {{ analysis_date }}.

Current Price Data:
- Price: ${{ current_price }}
- Change: {{ price_change }} ({{ price_change_percent }}%)
- Volume: {{ volume }}
- Market Cap: ${{ market_cap }}

Technical Indicators:
- RSI: {{ rsi }}
- MACD: {{ macd }}
- Moving Averages: {{ moving_averages }}
- Support Levels: {{ support_levels }}
- Resistance Levels: {{ resistance_levels }}

Fundamental Data:
- P/E Ratio: {{ pe_ratio }}
- Revenue Growth: {{ revenue_growth }}
- Earnings Data: {{ earnings_data }}

News & Sentiment:
- Recent News: {{ recent_news }}
- Analyst Ratings: {{ analyst_ratings }}
- Social Sentiment: {{ social_sentiment }}

User Context:
- Current Position: {{ current_position }}
- Risk Tolerance: {{ risk_tolerance }}
- Time Horizon: {{ time_horizon }}

Provide analysis covering:
1. Technical outlook and key levels
2. Fundamental strength and valuation
3. Catalysts and risk factors
4. Trading opportunities and recommendations
5. Portfolio fit for this investor

Format: {{ length }} analysis in {{ tone }} tone.""",
            variables=["symbol", "company_name", "analysis_date", "current_price", "price_change",
                     "price_change_percent", "volume", "market_cap", "rsi", "macd", "moving_averages",
                     "support_levels", "resistance_levels", "pe_ratio", "revenue_growth",
                     "earnings_data", "recent_news", "analyst_ratings", "social_sentiment",
                     "current_position", "risk_tolerance", "time_horizon", "length", "tone"],
            default_tone=NarrativeTone.PROFESSIONAL,
            default_length=NarrativeLength.LONG
        )

        return templates

    async def render_prompt(
        self,
        template_id: str,
        variables: Dict[str, Any],
        custom_template: Optional[NarrativeTemplate] = None
    ) -> Tuple[str, str]:
        """Render prompt template with variables"""

        template = custom_template or self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")

        try:
            # Render user prompt
            user_template = self.jinja_env.from_string(template.user_prompt_template)
            user_prompt = user_template.render(**variables)

            # Return system and user prompts
            return template.system_prompt, user_prompt

        except Exception as e:
            logger.error(f"Error rendering template {template_id}: {e}")
            raise


class NarrativeGenerationEngine:
    """Main engine for generating AI narratives"""

    def __init__(
        self,
        redis_client: redis.Redis,
        llm_configs: Dict[LLMProvider, LLMConfiguration]
    ):
        self.redis = redis_client
        self.llm_providers = self._initialize_providers(llm_configs)
        self.prompt_engine = PromptTemplateEngine()

        # Generation metrics
        self.generation_stats = {
            "total_generated": 0,
            "total_tokens_used": 0,
            "total_cost": 0.0,
            "avg_generation_time": 0.0
        }

    def _initialize_providers(
        self,
        configs: Dict[LLMProvider, LLMConfiguration]
    ) -> Dict[LLMProvider, LLMProviderInterface]:
        """Initialize LLM providers"""
        providers = {}

        for provider_type, config in configs.items():
            if provider_type == LLMProvider.OPENAI:
                providers[provider_type] = OpenAIProvider(config)
            elif provider_type == LLMProvider.ANTHROPIC:
                providers[provider_type] = AnthropicProvider(config)
            # Add other providers as needed

        return providers

    async def generate_narrative(
        self,
        request: NarrativeRequest,
        preferred_provider: Optional[LLMProvider] = None,
        stream: bool = False
    ) -> Union[GeneratedNarrative, AsyncGenerator[NarrativeStreamEvent, None]]:
        """Generate narrative from request"""

        start_time = datetime.utcnow()

        try:
            # Select provider
            provider_type = preferred_provider or self._select_best_provider(request)
            provider = self.llm_providers.get(provider_type)

            if not provider:
                raise ValueError(f"Provider {provider_type} not available")

            # Prepare prompt variables
            variables = await self._prepare_prompt_variables(request)

            # Render prompt
            system_prompt, user_prompt = await self.prompt_engine.render_prompt(
                request.narrative_type.value,
                variables
            )

            # Count input tokens
            input_tokens = await provider.count_tokens(system_prompt + user_prompt)

            # Generate content
            if stream:
                return self._generate_streaming(
                    request, provider, system_prompt, user_prompt, start_time
                )
            else:
                return await self._generate_complete(
                    request, provider, system_prompt, user_prompt,
                    input_tokens, start_time
                )

        except Exception as e:
            logger.error(f"Narrative generation failed for {request.request_id}: {e}")
            raise

    async def _generate_complete(
        self,
        request: NarrativeRequest,
        provider: LLMProviderInterface,
        system_prompt: str,
        user_prompt: str,
        input_tokens: int,
        start_time: datetime
    ) -> GeneratedNarrative:
        """Generate complete narrative"""

        # Get generation parameters
        config = self._get_provider_config(provider)
        max_tokens = self._calculate_max_tokens(request.length)
        temperature = self._calculate_temperature(request.tone)

        # Generate content
        content = await provider.generate_completion(
            user_prompt,
            system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=False
        )

        # Calculate metrics
        output_tokens = await provider.count_tokens(content)
        generation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        cost = await provider.estimate_cost(input_tokens, output_tokens)

        # Parse content into structured narrative
        narrative = await self._parse_narrative_content(
            content, request, generation_time, provider.__class__.__name__.replace('Provider', '').lower(),
            input_tokens + output_tokens, cost
        )

        # Update stats
        await self._update_generation_stats(generation_time, input_tokens + output_tokens, cost)

        return narrative

    async def _generate_streaming(
        self,
        request: NarrativeRequest,
        provider: LLMProviderInterface,
        system_prompt: str,
        user_prompt: str,
        start_time: datetime
    ) -> AsyncGenerator[NarrativeStreamEvent, None]:
        """Generate streaming narrative"""

        config = self._get_provider_config(provider)
        max_tokens = self._calculate_max_tokens(request.length)
        temperature = self._calculate_temperature(request.tone)

        # Start generation
        narrative_id = f"narr_{datetime.utcnow().timestamp()}"
        sequence = 0

        yield NarrativeStreamEvent(
            narrative_id=narrative_id,
            event_type="started",
            content="Generation started",
            sequence_number=sequence
        )

        try:
            content_buffer = ""
            chunk_count = 0

            async for chunk in provider.generate_completion(
                user_prompt,
                system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True
            ):
                sequence += 1
                chunk_count += 1
                content_buffer += chunk

                # Send chunk event
                yield NarrativeStreamEvent(
                    narrative_id=narrative_id,
                    event_type="chunk",
                    content=chunk,
                    partial_narrative=content_buffer,
                    progress_percent=min(95, (chunk_count / max_tokens) * 100),
                    sequence_number=sequence
                )

                # Parse insights if enough content
                if len(content_buffer) > 500 and chunk_count % 10 == 0:
                    insights = await self._extract_partial_insights(content_buffer)
                    for insight in insights:
                        sequence += 1
                        yield NarrativeStreamEvent(
                            narrative_id=narrative_id,
                            event_type="insight",
                            insight=insight,
                            sequence_number=sequence
                        )

            # Complete generation
            generation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            narrative = await self._parse_narrative_content(
                content_buffer, request, generation_time,
                provider.__class__.__name__.replace('Provider', '').lower(),
                len(content_buffer) // 4, 0.0  # Approximate tokens and cost
            )

            sequence += 1
            yield NarrativeStreamEvent(
                narrative_id=narrative_id,
                event_type="completed",
                content=json.dumps(narrative.dict()),
                progress_percent=100,
                sequence_number=sequence
            )

        except Exception as e:
            sequence += 1
            yield NarrativeStreamEvent(
                narrative_id=narrative_id,
                event_type="error",
                content=str(e),
                sequence_number=sequence
            )

    async def _prepare_prompt_variables(self, request: NarrativeRequest) -> Dict[str, Any]:
        """Prepare variables for prompt template"""
        variables = {
            "current_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "tone": request.tone.value,
            "length": request.length.value,
            "user_id": request.user_id,
            "symbols": request.symbols,
            "risk_tolerance": request.context.risk_tolerance,
            "investment_horizon": request.context.investment_horizon,
            "portfolio_symbols": request.context.portfolio_symbols,
        }

        # Add market data if available
        if request.market_data:
            market_data = request.market_data.dict()
            for key, value in market_data.items():
                if value is not None:
                    variables[key] = value

        # Add default values for missing variables
        variables.update({
            "sp500_price": variables.get("sp500", {}).get("price", "N/A"),
            "sp500_change": variables.get("sp500", {}).get("change_percent", "N/A"),
            "nasdaq_price": variables.get("nasdaq", {}).get("price", "N/A"),
            "nasdaq_change": variables.get("nasdaq", {}).get("change_percent", "N/A"),
            "vix": variables.get("vix", "N/A"),
            "top_gainers": "Loading...",
            "top_losers": "Loading...",
            "market_events": "Analyzing current market events...",
            "news_sentiment": variables.get("news_sentiment", "Neutral"),
            "social_sentiment": variables.get("social_sentiment", "Neutral"),
        })

        return variables

    async def _parse_narrative_content(
        self,
        content: str,
        request: NarrativeRequest,
        generation_time: float,
        provider: str,
        tokens_used: int,
        cost: float
    ) -> GeneratedNarrative:
        """Parse generated content into structured narrative"""

        # Extract title (first line or generate from content)
        lines = content.strip().split('\n')
        title = lines[0].strip() if lines else "Market Analysis"
        if title.startswith('#'):
            title = title.lstrip('#').strip()

        # Extract summary (first paragraph)
        paragraphs = content.split('\n\n')
        summary = paragraphs[0] if paragraphs else content[:200] + "..."

        # Extract key points
        key_points = await self._extract_key_points(content)

        # Extract insights and recommendations
        insights = await self._extract_insights(content)
        recommendations = await self._extract_recommendations(content)

        # Calculate quality scores
        confidence_score = min(1.0, len(content) / 1000)  # Simple heuristic
        relevance_score = 0.8  # Would be calculated by quality model
        coherence_score = 0.9  # Would be calculated by quality model

        return GeneratedNarrative(
            request_id=request.request_id,
            user_id=request.user_id,
            narrative_type=request.narrative_type,
            title=title,
            summary=summary,
            full_narrative=content,
            key_points=key_points,
            insights=insights,
            recommendations=recommendations,
            generation_time_ms=generation_time,
            llm_provider=LLMProvider(provider),
            model_version="gpt-4",  # Would be dynamic
            tokens_used=tokens_used,
            confidence_score=confidence_score,
            relevance_score=relevance_score,
            coherence_score=coherence_score,
            data_sources=["market_data", "technical_indicators", "news_sentiment"],
            related_symbols=request.symbols
        )

    async def _extract_key_points(self, content: str) -> List[str]:
        """Extract key points from narrative content"""
        points = []

        # Look for numbered lists
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('•') or line.startswith('-')):
                # Clean up the point
                point = line.lstrip('0123456789.•- ').strip()
                if len(point) > 10:  # Minimum length for a valid point
                    points.append(point)

        return points[:5]  # Return top 5 points

    async def _extract_insights(self, content: str) -> List[TradingInsight]:
        """Extract trading insights from content"""
        insights = []

        # Simple keyword-based extraction (would be enhanced with NLP)
        insight_keywords = ["opportunity", "trend", "signal", "indicator", "pattern"]

        sentences = content.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(keyword in sentence.lower() for keyword in insight_keywords):
                if len(sentence) > 30:  # Minimum insight length
                    insight = TradingInsight(
                        type="technical",
                        title="Market Insight",
                        description=sentence,
                        significance=InsightPriority.MEDIUM,
                        confidence=0.7,
                        time_horizon="short_term"
                    )
                    insights.append(insight)

                    if len(insights) >= 3:  # Limit insights
                        break

        return insights

    async def _extract_recommendations(self, content: str) -> List[TradingRecommendation]:
        """Extract trading recommendations from content"""
        recommendations = []

        # Simple pattern matching for recommendations
        rec_patterns = ["buy", "sell", "hold", "consider", "recommend"]

        sentences = content.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(pattern in sentence.lower() for pattern in rec_patterns):
                if len(sentence) > 40:  # Minimum recommendation length
                    # Try to determine action
                    action = "hold"
                    if "buy" in sentence.lower():
                        action = "buy"
                    elif "sell" in sentence.lower():
                        action = "sell"

                    rec = TradingRecommendation(
                        symbol="SYMBOL",  # Would be extracted
                        action=action,
                        reasoning=sentence,
                        confidence=0.6,
                        time_horizon="medium_term",
                        priority=InsightPriority.MEDIUM
                    )
                    recommendations.append(rec)

                    if len(recommendations) >= 2:  # Limit recommendations
                        break

        return recommendations

    async def _extract_partial_insights(self, partial_content: str) -> List[TradingInsight]:
        """Extract insights from partial content during streaming"""
        return await self._extract_insights(partial_content)

    def _select_best_provider(self, request: NarrativeRequest) -> LLMProvider:
        """Select best LLM provider for request"""
        # Simple selection logic (would be enhanced with load balancing, cost optimization, etc.)
        if LLMProvider.OPENAI in self.llm_providers:
            return LLMProvider.OPENAI
        elif LLMProvider.ANTHROPIC in self.llm_providers:
            return LLMProvider.ANTHROPIC
        else:
            raise ValueError("No LLM providers available")

    def _get_provider_config(self, provider: LLMProviderInterface) -> LLMConfiguration:
        """Get configuration for provider"""
        # Return default config (would be enhanced)
        return LLMConfiguration(
            provider=LLMProvider.OPENAI,
            model_name="gpt-4",
            temperature=0.7,
            max_tokens=1000
        )

    def _calculate_max_tokens(self, length: NarrativeLength) -> int:
        """Calculate max tokens based on length preference"""
        length_mapping = {
            NarrativeLength.BRIEF: 150,
            NarrativeLength.SHORT: 300,
            NarrativeLength.MEDIUM: 600,
            NarrativeLength.LONG: 1000,
            NarrativeLength.DETAILED: 1500
        }
        return length_mapping.get(length, 600)

    def _calculate_temperature(self, tone: NarrativeTone) -> float:
        """Calculate temperature based on tone"""
        tone_mapping = {
            NarrativeTone.PROFESSIONAL: 0.3,
            NarrativeTone.CASUAL: 0.7,
            NarrativeTone.TECHNICAL: 0.2,
            NarrativeTone.EDUCATIONAL: 0.5,
            NarrativeTone.BULLISH: 0.6,
            NarrativeTone.BEARISH: 0.4,
            NarrativeTone.NEUTRAL: 0.4,
            NarrativeTone.CAUTIOUS: 0.3,
            NarrativeTone.OPTIMISTIC: 0.6
        }
        return tone_mapping.get(tone, 0.5)

    async def _update_generation_stats(
        self,
        generation_time: float,
        tokens_used: int,
        cost: float
    ):
        """Update generation statistics"""
        self.generation_stats["total_generated"] += 1
        self.generation_stats["total_tokens_used"] += tokens_used
        self.generation_stats["total_cost"] += cost

        # Update average generation time
        total = self.generation_stats["total_generated"]
        current_avg = self.generation_stats["avg_generation_time"]
        self.generation_stats["avg_generation_time"] = (
            (current_avg * (total - 1) + generation_time) / total
        )

    async def get_generation_stats(self) -> Dict[str, Any]:
        """Get generation statistics"""
        return self.generation_stats.copy()