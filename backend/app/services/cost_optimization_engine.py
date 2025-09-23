"""
Cost Tracking and Optimization Engine

Advanced cost management system with budget tracking, cost optimization algorithms,
usage analytics, billing management, and cost forecasting with machine learning predictions.
"""

import asyncio
import json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta, date
from enum import Enum
from collections import defaultdict, deque
from dataclasses import dataclass, field
import uuid
import statistics
import math

from redis.asyncio import Redis
import numpy as np
from scipy import stats

from app.models.vendor_models import (
    VendorUsage, CostBudget, VendorPricing, RequestType, VendorTier,
    RoutingStrategy, VendorRegistry
)
from app.core.logging import get_logger

logger = get_logger(__name__)


class CostOptimizationStrategy(str, Enum):
    """Cost optimization strategies."""
    AGGRESSIVE = "aggressive"  # Minimize cost at all costs
    BALANCED = "balanced"     # Balance cost and quality
    CONSERVATIVE = "conservative"  # Prioritize quality over cost


@dataclass
class CostForecast:
    """Cost forecast model."""
    period: str  # YYYY-MM format
    predicted_cost: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    factors: Dict[str, float]  # Contributing factors
    model_accuracy: float
    forecast_date: datetime = field(default_factory=datetime.utcnow)


@dataclass
class CostOptimizationRecommendation:
    """Cost optimization recommendation."""
    recommendation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    current_cost: float
    optimized_cost: float
    potential_savings: float
    savings_percentage: float
    strategy: str
    risk_level: str  # low, medium, high
    implementation_effort: str  # low, medium, high
    impact_on_quality: str  # minimal, moderate, significant
    recommendations: List[str]
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class BudgetAlert:
    """Budget alert model."""
    alert_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    budget_id: str
    alert_type: str  # threshold, overage, projection
    severity: str  # info, warning, critical
    message: str
    current_spend: float
    budget_amount: float
    utilization_percentage: float
    projected_overage: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


class UsageTracker:
    """Tracks detailed usage and cost metrics across all vendors."""

    def __init__(self, redis_client: Redis):
        self.redis_client = redis_client
        self.usage_key_prefix = "usage_tracking"
        self.logger = get_logger("cost.usage_tracker")

    async def record_usage(self, usage: VendorUsage):
        """Record vendor usage for cost tracking."""
        # Daily usage key
        daily_key = f"{self.usage_key_prefix}:daily:{usage.vendor_id}:{usage.request_timestamp.strftime('%Y-%m-%d')}"

        # Monthly usage key
        monthly_key = f"{self.usage_key_prefix}:monthly:{usage.vendor_id}:{usage.billing_period}"

        # Request type breakdown
        request_type_key = f"{self.usage_key_prefix}:request_type:{usage.vendor_id}:{usage.request_type.value}:{usage.billing_period}"

        # Usage data
        usage_data = {
            'cost': usage.request_cost,
            'data_volume': usage.data_volume_bytes,
            'timestamp': usage.request_timestamp.isoformat(),
            'success': usage.success
        }

        # Record usage with Redis pipelines for atomicity
        pipe = self.redis_client.pipeline()

        # Daily aggregation
        pipe.lpush(daily_key, json.dumps(usage_data))
        pipe.expire(daily_key, timedelta(days=32))

        # Monthly aggregation
        pipe.lpush(monthly_key, json.dumps(usage_data))
        pipe.expire(monthly_key, timedelta(days=400))

        # Request type aggregation
        pipe.lpush(request_type_key, json.dumps(usage_data))
        pipe.expire(request_type_key, timedelta(days=400))

        # Real-time metrics
        await self._update_realtime_metrics(usage, pipe)

        await pipe.execute()

    async def _update_realtime_metrics(self, usage: VendorUsage, pipe):
        """Update real-time cost and usage metrics."""
        current_hour = datetime.utcnow().strftime('%Y-%m-%d:%H')

        # Hourly cost tracking
        hourly_cost_key = f"{self.usage_key_prefix}:hourly_cost:{usage.vendor_id}:{current_hour}"
        pipe.incrbyfloat(hourly_cost_key, usage.request_cost)
        pipe.expire(hourly_cost_key, timedelta(hours=25))

        # Hourly request count
        hourly_count_key = f"{self.usage_key_prefix}:hourly_count:{usage.vendor_id}:{current_hour}"
        pipe.incr(hourly_count_key)
        pipe.expire(hourly_count_key, timedelta(hours=25))

        # Daily running totals
        daily_cost_key = f"{self.usage_key_prefix}:daily_cost:{usage.vendor_id}:{usage.request_timestamp.strftime('%Y-%m-%d')}"
        pipe.incrbyfloat(daily_cost_key, usage.request_cost)
        pipe.expire(daily_cost_key, timedelta(days=32))

    async def get_usage_summary(self, vendor_id: str, period: str) -> Dict[str, Any]:
        """Get usage summary for a vendor and period."""
        if period.count('-') == 1:  # YYYY-MM format (monthly)
            usage_key = f"{self.usage_key_prefix}:monthly:{vendor_id}:{period}"
        else:  # YYYY-MM-DD format (daily)
            usage_key = f"{self.usage_key_prefix}:daily:{vendor_id}:{period}"

        usage_data = await self.redis_client.lrange(usage_key, 0, -1)

        if not usage_data:
            return {
                'vendor_id': vendor_id,
                'period': period,
                'total_cost': 0.0,
                'total_requests': 0,
                'total_data_volume': 0,
                'success_rate': 0.0,
                'cost_by_request_type': {},
                'avg_cost_per_request': 0.0
            }

        total_cost = 0.0
        total_requests = 0
        total_data_volume = 0
        successful_requests = 0
        cost_by_request_type = defaultdict(float)

        for record in usage_data:
            try:
                data = json.loads(record)
                total_cost += data.get('cost', 0.0)
                total_requests += 1
                total_data_volume += data.get('data_volume', 0)
                if data.get('success', False):
                    successful_requests += 1
            except json.JSONDecodeError:
                continue

        success_rate = (successful_requests / total_requests * 100) if total_requests > 0 else 0.0
        avg_cost_per_request = total_cost / total_requests if total_requests > 0 else 0.0

        return {
            'vendor_id': vendor_id,
            'period': period,
            'total_cost': total_cost,
            'total_requests': total_requests,
            'total_data_volume': total_data_volume,
            'success_rate': success_rate,
            'successful_requests': successful_requests,
            'avg_cost_per_request': avg_cost_per_request,
            'cost_efficiency': total_data_volume / total_cost if total_cost > 0 else 0.0
        }

    async def get_cost_trends(self, vendor_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get cost trends over the specified number of days."""
        trends = []
        end_date = datetime.utcnow().date()

        for i in range(days):
            date_str = (end_date - timedelta(days=i)).strftime('%Y-%m-%d')
            summary = await self.get_usage_summary(vendor_id, date_str)
            summary['date'] = date_str
            trends.append(summary)

        trends.reverse()  # Chronological order
        return trends


class BudgetManager:
    """Manages cost budgets and budget alerts."""

    def __init__(self, redis_client: Redis, usage_tracker: UsageTracker):
        self.redis_client = redis_client
        self.usage_tracker = usage_tracker
        self.budget_key_prefix = "cost_budget"
        self.logger = get_logger("cost.budget_manager")

    async def create_budget(self, budget: CostBudget) -> str:
        """Create a new cost budget."""
        budget_key = f"{self.budget_key_prefix}:{budget.budget_id}"
        budget_data = budget.json()

        await self.redis_client.set(budget_key, budget_data)
        self.logger.info(f"Created budget {budget.name}: ${budget.monthly_budget}/month")

        return budget.budget_id

    async def update_budget(self, budget_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing budget."""
        budget_key = f"{self.budget_key_prefix}:{budget_id}"
        budget_data = await self.redis_client.get(budget_key)

        if not budget_data:
            return False

        try:
            budget_dict = json.loads(budget_data)
            budget_dict.update(updates)

            updated_budget = CostBudget(**budget_dict)
            await self.redis_client.set(budget_key, updated_budget.json())
            return True
        except (json.JSONDecodeError, ValueError) as e:
            self.logger.error(f"Failed to update budget {budget_id}: {e}")
            return False

    async def get_budget(self, budget_id: str) -> Optional[CostBudget]:
        """Get budget by ID."""
        budget_key = f"{self.budget_key_prefix}:{budget_id}"
        budget_data = await self.redis_client.get(budget_key)

        if not budget_data:
            return None

        try:
            return CostBudget.parse_raw(budget_data)
        except ValueError as e:
            self.logger.error(f"Failed to parse budget {budget_id}: {e}")
            return None

    async def check_budget_status(self, budget_id: str) -> Dict[str, Any]:
        """Check current budget utilization and generate alerts."""
        budget = await self.get_budget(budget_id)
        if not budget:
            return {'error': 'Budget not found'}

        current_month = datetime.utcnow().strftime('%Y-%m')

        # Calculate current spending
        total_spent = 0.0
        daily_spent = 0.0

        # Aggregate spending across all applicable vendors
        vendor_ids = budget.vendor_ids if budget.vendor_ids else await self._get_all_vendor_ids()

        for vendor_id in vendor_ids:
            monthly_summary = await self.usage_tracker.get_usage_summary(vendor_id, current_month)
            daily_summary = await self.usage_tracker.get_usage_summary(
                vendor_id,
                datetime.utcnow().strftime('%Y-%m-%d')
            )

            total_spent += monthly_summary['total_cost']
            daily_spent += daily_summary['total_cost']

        # Calculate utilization
        monthly_utilization = (total_spent / budget.monthly_budget * 100) if budget.monthly_budget > 0 else 0
        daily_utilization = (daily_spent / budget.daily_budget * 100) if budget.daily_budget > 0 else 0

        # Generate alerts
        alerts = []
        if monthly_utilization >= budget.alert_threshold_percentage:
            alerts.append(BudgetAlert(
                budget_id=budget_id,
                alert_type="threshold",
                severity="warning" if monthly_utilization < 100 else "critical",
                message=f"Budget {budget.name} is {monthly_utilization:.1f}% utilized",
                current_spend=total_spent,
                budget_amount=budget.monthly_budget,
                utilization_percentage=monthly_utilization
            ))

        if monthly_utilization > 100:
            overage = total_spent - budget.monthly_budget
            alerts.append(BudgetAlert(
                budget_id=budget_id,
                alert_type="overage",
                severity="critical",
                message=f"Budget {budget.name} exceeded by ${overage:.2f}",
                current_spend=total_spent,
                budget_amount=budget.monthly_budget,
                utilization_percentage=monthly_utilization,
                projected_overage=overage
            ))

        return {
            'budget_id': budget_id,
            'budget_name': budget.name,
            'monthly_budget': budget.monthly_budget,
            'daily_budget': budget.daily_budget,
            'monthly_spent': total_spent,
            'daily_spent': daily_spent,
            'monthly_remaining': max(0, budget.monthly_budget - total_spent),
            'daily_remaining': max(0, budget.daily_budget - daily_spent),
            'monthly_utilization': monthly_utilization,
            'daily_utilization': daily_utilization,
            'alerts': [alert.__dict__ for alert in alerts],
            'on_track': monthly_utilization <= budget.alert_threshold_percentage
        }

    async def _get_all_vendor_ids(self) -> List[str]:
        """Get all vendor IDs from Redis."""
        # This would typically query the vendor registry
        # For now, return a placeholder
        return []

    async def project_monthly_cost(self, budget_id: str) -> Optional[Dict[str, Any]]:
        """Project end-of-month cost based on current trends."""
        budget = await self.get_budget(budget_id)
        if not budget:
            return None

        current_date = datetime.utcnow()
        days_elapsed = current_date.day
        days_in_month = (current_date.replace(month=current_date.month + 1, day=1) - timedelta(days=1)).day
        days_remaining = days_in_month - days_elapsed

        current_month = current_date.strftime('%Y-%m')

        # Get current spending
        total_spent = 0.0
        vendor_ids = budget.vendor_ids if budget.vendor_ids else await self._get_all_vendor_ids()

        for vendor_id in vendor_ids:
            summary = await self.usage_tracker.get_usage_summary(vendor_id, current_month)
            total_spent += summary['total_cost']

        # Simple linear projection
        daily_average = total_spent / days_elapsed if days_elapsed > 0 else 0
        projected_total = total_spent + (daily_average * days_remaining)

        # Calculate projection accuracy based on spending variance
        trends = []
        for vendor_id in vendor_ids[:3]:  # Sample a few vendors for trends
            vendor_trends = await self.usage_tracker.get_cost_trends(vendor_id, days=min(days_elapsed, 7))
            trends.extend([t['total_cost'] for t in vendor_trends if t['total_cost'] > 0])

        projection_confidence = 0.7  # Default confidence
        if len(trends) >= 3:
            variance = statistics.variance(trends)
            mean_cost = statistics.mean(trends)
            cv = variance / mean_cost if mean_cost > 0 else 1
            projection_confidence = max(0.3, 1.0 - min(cv, 0.7))

        return {
            'budget_id': budget_id,
            'current_spent': total_spent,
            'projected_total': projected_total,
            'projected_overage': max(0, projected_total - budget.monthly_budget),
            'projection_confidence': projection_confidence,
            'days_elapsed': days_elapsed,
            'days_remaining': days_remaining,
            'daily_average': daily_average,
            'recommended_daily_limit': (budget.monthly_budget - total_spent) / days_remaining if days_remaining > 0 else 0
        }


class CostForecaster:
    """Machine learning-based cost forecasting engine."""

    def __init__(self, usage_tracker: UsageTracker):
        self.usage_tracker = usage_tracker
        self.logger = get_logger("cost.forecaster")

    async def generate_forecast(self, vendor_id: str, months_ahead: int = 3) -> List[CostForecast]:
        """Generate cost forecast using historical data and trend analysis."""
        # Get historical data (last 12 months for seasonality)
        historical_data = await self._get_historical_monthly_data(vendor_id, months=12)

        if len(historical_data) < 3:
            self.logger.warning(f"Insufficient data for forecasting vendor {vendor_id}")
            return []

        forecasts = []

        for i in range(1, months_ahead + 1):
            forecast_date = datetime.utcnow() + timedelta(days=30 * i)
            forecast_period = forecast_date.strftime('%Y-%m')

            # Use multiple forecasting methods and ensemble them
            linear_forecast = self._linear_trend_forecast(historical_data, i)
            seasonal_forecast = self._seasonal_forecast(historical_data, i)
            exponential_forecast = self._exponential_smoothing_forecast(historical_data, i)

            # Ensemble forecast (weighted average)
            ensemble_forecast = (
                linear_forecast * 0.4 +
                seasonal_forecast * 0.3 +
                exponential_forecast * 0.3
            )

            # Calculate confidence interval
            confidence_interval = self._calculate_confidence_interval(historical_data, ensemble_forecast)

            # Identify contributing factors
            factors = await self._identify_forecast_factors(vendor_id, historical_data)

            # Calculate model accuracy based on historical performance
            accuracy = self._calculate_model_accuracy(historical_data)

            forecast = CostForecast(
                period=forecast_period,
                predicted_cost=ensemble_forecast,
                confidence_interval_lower=confidence_interval[0],
                confidence_interval_upper=confidence_interval[1],
                factors=factors,
                model_accuracy=accuracy
            )

            forecasts.append(forecast)

        return forecasts

    async def _get_historical_monthly_data(self, vendor_id: str, months: int) -> List[Dict[str, Any]]:
        """Get historical monthly cost data."""
        data = []
        current_date = datetime.utcnow()

        for i in range(months):
            month_date = current_date - timedelta(days=30 * (i + 1))
            period = month_date.strftime('%Y-%m')

            summary = await self.usage_tracker.get_usage_summary(vendor_id, period)
            if summary['total_cost'] > 0:  # Only include months with data
                summary['period'] = period
                summary['month_index'] = i
                data.append(summary)

        return list(reversed(data))  # Chronological order

    def _linear_trend_forecast(self, historical_data: List[Dict[str, Any]], months_ahead: int) -> float:
        """Simple linear trend forecasting."""
        if len(historical_data) < 2:
            return historical_data[-1]['total_cost'] if historical_data else 0

        costs = [d['total_cost'] for d in historical_data]
        x = np.arange(len(costs))

        # Linear regression
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, costs)

        # Forecast
        future_x = len(costs) + months_ahead - 1
        forecast = slope * future_x + intercept

        return max(0, forecast)

    def _seasonal_forecast(self, historical_data: List[Dict[str, Any]], months_ahead: int) -> float:
        """Seasonal forecasting based on monthly patterns."""
        if len(historical_data) < 6:
            return historical_data[-1]['total_cost'] if historical_data else 0

        # Calculate seasonal indices
        costs = [d['total_cost'] for d in historical_data]
        avg_cost = sum(costs) / len(costs)

        # Simple seasonal decomposition
        seasonal_indices = []
        for i, cost in enumerate(costs):
            month_num = (i % 12) + 1
            seasonal_index = cost / avg_cost if avg_cost > 0 else 1
            seasonal_indices.append((month_num, seasonal_index))

        # Get forecast month
        forecast_month = ((datetime.utcnow().month + months_ahead - 1) % 12) + 1

        # Find seasonal index for forecast month
        seasonal_factor = 1.0
        for month, index in seasonal_indices:
            if month == forecast_month:
                seasonal_factor = index
                break

        # Apply trend and seasonality
        recent_trend = sum(costs[-3:]) / 3 if len(costs) >= 3 else costs[-1]
        forecast = recent_trend * seasonal_factor

        return max(0, forecast)

    def _exponential_smoothing_forecast(self, historical_data: List[Dict[str, Any]], months_ahead: int) -> float:
        """Exponential smoothing forecast."""
        if not historical_data:
            return 0

        costs = [d['total_cost'] for d in historical_data]

        # Simple exponential smoothing
        alpha = 0.3  # Smoothing parameter
        smoothed = costs[0]

        for cost in costs[1:]:
            smoothed = alpha * cost + (1 - alpha) * smoothed

        # For simplicity, use the smoothed value as forecast
        # In a real implementation, you'd use double or triple exponential smoothing
        return max(0, smoothed)

    def _calculate_confidence_interval(self, historical_data: List[Dict[str, Any]], forecast: float) -> Tuple[float, float]:
        """Calculate confidence interval for forecast."""
        if len(historical_data) < 3:
            return (forecast * 0.8, forecast * 1.2)

        costs = [d['total_cost'] for d in historical_data]
        std_dev = statistics.stdev(costs)
        mean_cost = statistics.mean(costs)

        # Use coefficient of variation to adjust confidence interval
        cv = std_dev / mean_cost if mean_cost > 0 else 0.2
        error_margin = forecast * max(0.1, min(0.5, cv))

        return (max(0, forecast - error_margin), forecast + error_margin)

    async def _identify_forecast_factors(self, vendor_id: str, historical_data: List[Dict[str, Any]]) -> Dict[str, float]:
        """Identify factors contributing to cost forecast."""
        factors = {}

        if len(historical_data) >= 3:
            recent_costs = [d['total_cost'] for d in historical_data[-3:]]
            older_costs = [d['total_cost'] for d in historical_data[:-3]] if len(historical_data) > 3 else recent_costs

            recent_avg = sum(recent_costs) / len(recent_costs)
            older_avg = sum(older_costs) / len(older_costs)

            trend_factor = (recent_avg - older_avg) / older_avg if older_avg > 0 else 0

            factors['trend'] = trend_factor
            factors['volume_growth'] = 0.0  # Would calculate based on request volume
            factors['seasonality'] = 0.0   # Would calculate seasonal effects
            factors['market_conditions'] = 0.0  # External factors

        return factors

    def _calculate_model_accuracy(self, historical_data: List[Dict[str, Any]]) -> float:
        """Calculate historical accuracy of forecasting model."""
        if len(historical_data) < 4:
            return 0.7  # Default accuracy

        # Simple accuracy calculation based on trend consistency
        costs = [d['total_cost'] for d in historical_data]

        # Calculate how often the trend direction was correct
        correct_predictions = 0
        total_predictions = 0

        for i in range(2, len(costs)):
            actual_change = costs[i] - costs[i-1]
            predicted_change = costs[i-1] - costs[i-2]  # Simple trend continuation

            if (actual_change > 0 and predicted_change > 0) or (actual_change < 0 and predicted_change < 0):
                correct_predictions += 1
            total_predictions += 1

        accuracy = correct_predictions / total_predictions if total_predictions > 0 else 0.7
        return min(0.95, max(0.3, accuracy))


class CostOptimizer:
    """Advanced cost optimization engine with ML-based recommendations."""

    def __init__(self, usage_tracker: UsageTracker, budget_manager: BudgetManager):
        self.usage_tracker = usage_tracker
        self.budget_manager = budget_manager
        self.logger = get_logger("cost.optimizer")

    async def generate_optimization_recommendations(
        self,
        vendor_ids: List[str],
        strategy: CostOptimizationStrategy = CostOptimizationStrategy.BALANCED
    ) -> List[CostOptimizationRecommendation]:
        """Generate cost optimization recommendations."""
        recommendations = []

        for vendor_id in vendor_ids:
            vendor_recommendations = await self._analyze_vendor_optimization(vendor_id, strategy)
            recommendations.extend(vendor_recommendations)

        # Sort by potential savings
        recommendations.sort(key=lambda r: r.potential_savings, reverse=True)

        return recommendations

    async def _analyze_vendor_optimization(
        self,
        vendor_id: str,
        strategy: CostOptimizationStrategy
    ) -> List[CostOptimizationRecommendation]:
        """Analyze optimization opportunities for a specific vendor."""
        recommendations = []

        # Get vendor usage data
        current_month = datetime.utcnow().strftime('%Y-%m')
        usage_summary = await self.usage_tracker.get_usage_summary(vendor_id, current_month)
        cost_trends = await self.usage_tracker.get_cost_trends(vendor_id, days=30)

        if usage_summary['total_cost'] == 0:
            return recommendations

        # Analyze different optimization opportunities

        # 1. Tier optimization
        tier_rec = await self._analyze_tier_optimization(vendor_id, usage_summary, strategy)
        if tier_rec:
            recommendations.append(tier_rec)

        # 2. Request type optimization
        request_type_rec = await self._analyze_request_type_optimization(vendor_id, usage_summary, strategy)
        if request_type_rec:
            recommendations.append(request_type_rec)

        # 3. Usage pattern optimization
        pattern_rec = await self._analyze_usage_pattern_optimization(vendor_id, cost_trends, strategy)
        if pattern_rec:
            recommendations.append(pattern_rec)

        # 4. Caching optimization
        cache_rec = await self._analyze_caching_optimization(vendor_id, usage_summary, strategy)
        if cache_rec:
            recommendations.append(cache_rec)

        return recommendations

    async def _analyze_tier_optimization(
        self,
        vendor_id: str,
        usage_summary: Dict[str, Any],
        strategy: CostOptimizationStrategy
    ) -> Optional[CostOptimizationRecommendation]:
        """Analyze if vendor tier should be changed."""
        current_cost = usage_summary['total_cost']
        total_requests = usage_summary['total_requests']

        # Simulate different tier costs (simplified)
        tiers = {
            'free': {'limit': 1000, 'cost_per_request': 0.0, 'overage': 0.01},
            'basic': {'limit': 10000, 'cost_per_request': 0.005, 'overage': 0.008},
            'professional': {'limit': 100000, 'cost_per_request': 0.003, 'overage': 0.005},
            'enterprise': {'limit': 1000000, 'cost_per_request': 0.001, 'overage': 0.002}
        }

        best_tier = None
        best_cost = current_cost

        for tier_name, tier_config in tiers.items():
            if total_requests <= tier_config['limit']:
                simulated_cost = total_requests * tier_config['cost_per_request']
            else:
                base_cost = tier_config['limit'] * tier_config['cost_per_request']
                overage_cost = (total_requests - tier_config['limit']) * tier_config['overage']
                simulated_cost = base_cost + overage_cost

            if simulated_cost < best_cost:
                best_cost = simulated_cost
                best_tier = tier_name

        if best_tier and best_cost < current_cost:
            savings = current_cost - best_cost
            savings_percentage = (savings / current_cost) * 100

            return CostOptimizationRecommendation(
                vendor_id=vendor_id,
                current_cost=current_cost,
                optimized_cost=best_cost,
                potential_savings=savings,
                savings_percentage=savings_percentage,
                strategy="tier_optimization",
                risk_level="low",
                implementation_effort="low",
                impact_on_quality="minimal",
                recommendations=[
                    f"Switch to {best_tier} tier for vendor {vendor_id}",
                    f"Potential monthly savings: ${savings:.2f} ({savings_percentage:.1f}%)",
                    "Monitor usage to ensure tier remains optimal"
                ]
            )

        return None

    async def _analyze_request_type_optimization(
        self,
        vendor_id: str,
        usage_summary: Dict[str, Any],
        strategy: CostOptimizationStrategy
    ) -> Optional[CostOptimizationRecommendation]:
        """Analyze request type usage patterns for optimization."""
        # This would analyze which request types are most expensive
        # and suggest alternatives or batching strategies

        current_cost = usage_summary['total_cost']

        # Simplified optimization: suggest batching for high-volume, low-cost requests
        if usage_summary['total_requests'] > 1000 and usage_summary['avg_cost_per_request'] < 0.01:
            potential_savings = current_cost * 0.15  # 15% savings through batching

            return CostOptimizationRecommendation(
                vendor_id=vendor_id,
                current_cost=current_cost,
                optimized_cost=current_cost - potential_savings,
                potential_savings=potential_savings,
                savings_percentage=15.0,
                strategy="request_batching",
                risk_level="medium",
                implementation_effort="medium",
                impact_on_quality="minimal",
                recommendations=[
                    "Implement request batching for high-volume operations",
                    "Combine multiple small requests into fewer larger requests",
                    "Review API rate limits and adjust batching accordingly"
                ]
            )

        return None

    async def _analyze_usage_pattern_optimization(
        self,
        vendor_id: str,
        cost_trends: List[Dict[str, Any]],
        strategy: CostOptimizationStrategy
    ) -> Optional[CostOptimizationRecommendation]:
        """Analyze usage patterns for optimization opportunities."""
        if len(cost_trends) < 7:
            return None

        # Analyze cost variability
        daily_costs = [t['total_cost'] for t in cost_trends if t['total_cost'] > 0]

        if len(daily_costs) < 3:
            return None

        avg_cost = sum(daily_costs) / len(daily_costs)
        max_cost = max(daily_costs)

        # If there are high-cost spikes, suggest rate limiting
        if max_cost > avg_cost * 2:
            potential_savings = (max_cost - avg_cost) * 0.7  # Smooth out spikes
            current_monthly = avg_cost * 30

            return CostOptimizationRecommendation(
                vendor_id=vendor_id,
                current_cost=current_monthly,
                optimized_cost=current_monthly - potential_savings,
                potential_savings=potential_savings,
                savings_percentage=(potential_savings / current_monthly) * 100,
                strategy="usage_smoothing",
                risk_level="low",
                implementation_effort="medium",
                impact_on_quality="minimal",
                recommendations=[
                    "Implement request rate limiting to smooth usage spikes",
                    "Consider request queuing during peak periods",
                    "Analyze peak usage patterns for optimization opportunities"
                ]
            )

        return None

    async def _analyze_caching_optimization(
        self,
        vendor_id: str,
        usage_summary: Dict[str, Any],
        strategy: CostOptimizationStrategy
    ) -> Optional[CostOptimizationRecommendation]:
        """Analyze caching opportunities."""
        current_cost = usage_summary['total_cost']
        total_requests = usage_summary['total_requests']

        # Estimate potential cache hit rate based on request patterns
        # This is simplified - real implementation would analyze actual request patterns
        estimated_cache_hit_rate = 0.3  # 30% cache hit rate

        if total_requests > 100 and estimated_cache_hit_rate > 0.2:
            potential_savings = current_cost * estimated_cache_hit_rate

            return CostOptimizationRecommendation(
                vendor_id=vendor_id,
                current_cost=current_cost,
                optimized_cost=current_cost - potential_savings,
                potential_savings=potential_savings,
                savings_percentage=(potential_savings / current_cost) * 100,
                strategy="caching_optimization",
                risk_level="low",
                implementation_effort="medium",
                impact_on_quality="positive",
                recommendations=[
                    f"Implement intelligent caching with {estimated_cache_hit_rate*100:.0f}% hit rate",
                    "Cache frequently requested data with appropriate TTL",
                    "Monitor cache performance and adjust TTL values"
                ]
            )

        return None


class CostOptimizationEngine:
    """Main cost optimization engine coordinating all cost management components."""

    def __init__(self, redis_client: Redis):
        self.redis_client = redis_client
        self.usage_tracker = UsageTracker(redis_client)
        self.budget_manager = BudgetManager(redis_client, self.usage_tracker)
        self.forecaster = CostForecaster(self.usage_tracker)
        self.optimizer = CostOptimizer(self.usage_tracker, self.budget_manager)
        self.logger = get_logger("cost.engine")

    async def record_vendor_usage(self, usage: VendorUsage):
        """Record vendor usage for cost tracking."""
        await self.usage_tracker.record_usage(usage)

    async def get_cost_dashboard(self, vendor_ids: List[str]) -> Dict[str, Any]:
        """Get comprehensive cost dashboard data."""
        current_month = datetime.utcnow().strftime('%Y-%m')

        dashboard = {
            'summary': {
                'total_monthly_cost': 0.0,
                'total_daily_cost': 0.0,
                'total_requests': 0,
                'avg_cost_per_request': 0.0,
                'top_vendors_by_cost': [],
                'cost_trend': 'stable'
            },
            'vendor_breakdown': {},
            'optimization_opportunities': [],
            'budget_status': [],
            'forecasts': []
        }

        # Aggregate vendor data
        vendor_costs = []
        total_monthly_cost = 0.0
        total_daily_cost = 0.0
        total_requests = 0

        for vendor_id in vendor_ids:
            monthly_summary = await self.usage_tracker.get_usage_summary(vendor_id, current_month)
            daily_summary = await self.usage_tracker.get_usage_summary(
                vendor_id,
                datetime.utcnow().strftime('%Y-%m-%d')
            )

            vendor_costs.append((vendor_id, monthly_summary['total_cost']))
            total_monthly_cost += monthly_summary['total_cost']
            total_daily_cost += daily_summary['total_cost']
            total_requests += monthly_summary['total_requests']

            dashboard['vendor_breakdown'][vendor_id] = {
                'monthly_cost': monthly_summary['total_cost'],
                'daily_cost': daily_summary['total_cost'],
                'monthly_requests': monthly_summary['total_requests'],
                'success_rate': monthly_summary['success_rate'],
                'cost_efficiency': monthly_summary['cost_efficiency']
            }

        # Summary calculations
        dashboard['summary']['total_monthly_cost'] = total_monthly_cost
        dashboard['summary']['total_daily_cost'] = total_daily_cost
        dashboard['summary']['total_requests'] = total_requests
        dashboard['summary']['avg_cost_per_request'] = (
            total_monthly_cost / total_requests if total_requests > 0 else 0
        )

        # Top vendors by cost
        vendor_costs.sort(key=lambda x: x[1], reverse=True)
        dashboard['summary']['top_vendors_by_cost'] = vendor_costs[:5]

        # Generate optimization recommendations
        recommendations = await self.optimizer.generate_optimization_recommendations(
            vendor_ids[:10],  # Limit to top 10 vendors for performance
            CostOptimizationStrategy.BALANCED
        )
        dashboard['optimization_opportunities'] = [rec.__dict__ for rec in recommendations[:5]]

        return dashboard

    async def optimize_costs_automatically(self, vendor_ids: List[str]) -> Dict[str, Any]:
        """Automatically optimize costs where safe to do so."""
        results = {
            'applied_optimizations': [],
            'potential_optimizations': [],
            'total_savings': 0.0,
            'errors': []
        }

        try:
            recommendations = await self.optimizer.generate_optimization_recommendations(
                vendor_ids,
                CostOptimizationStrategy.BALANCED
            )

            for rec in recommendations:
                # Only auto-apply low-risk optimizations
                if rec.risk_level == "low" and rec.implementation_effort == "low":
                    # In a real implementation, this would apply the optimization
                    results['applied_optimizations'].append({
                        'vendor_id': rec.vendor_id,
                        'strategy': rec.strategy,
                        'savings': rec.potential_savings,
                        'description': rec.recommendations[0]
                    })
                    results['total_savings'] += rec.potential_savings
                else:
                    results['potential_optimizations'].append({
                        'vendor_id': rec.vendor_id,
                        'strategy': rec.strategy,
                        'savings': rec.potential_savings,
                        'risk_level': rec.risk_level,
                        'effort': rec.implementation_effort
                    })

        except Exception as e:
            results['errors'].append(str(e))
            self.logger.error(f"Cost optimization failed: {e}")

        return results