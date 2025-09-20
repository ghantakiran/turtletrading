"""
Feature Gating Service for TurtleTrading Platform

Comprehensive feature access control system based on subscription plans,
usage limits, and custom permissions with real-time enforcement.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Any, Tuple, Set
import redis.asyncio as redis
from dataclasses import dataclass
from enum import Enum

from ..models.payment_models import (
    FeatureFlag, FeatureAccess, UsageLimit, UsageRecord, UsageMetricType,
    PlanFeatures, UserSubscription, PlanTier
)

logger = logging.getLogger(__name__)


class AccessLevel(str, Enum):
    """Access levels for features"""
    FULL = "full"
    LIMITED = "limited"
    TRIAL = "trial"
    BLOCKED = "blocked"
    USAGE_EXCEEDED = "usage_exceeded"


@dataclass
class FeatureCheckResult:
    """Result of feature access check"""
    has_access: bool
    access_level: AccessLevel
    reason: str
    remaining_usage: Optional[int] = None
    limit: Optional[int] = None
    reset_date: Optional[date] = None
    upgrade_required: bool = False
    suggested_plans: List[str] = None


class FeatureDefinitionRegistry:
    """Registry of feature definitions and requirements"""

    def __init__(self):
        self.features = self._initialize_feature_definitions()

    def _initialize_feature_definitions(self) -> Dict[FeatureFlag, Dict[str, Any]]:
        """Initialize feature definitions with requirements"""
        return {
            FeatureFlag.REAL_TIME_DATA: {
                "name": "Real-time Market Data",
                "description": "Live market data with minimal delay",
                "required_tier": PlanTier.BASIC,
                "usage_metric": None,
                "trial_available": True,
                "trial_duration_days": 7
            },
            FeatureFlag.ADVANCED_CHARTS: {
                "name": "Advanced Charting",
                "description": "Professional charting tools and indicators",
                "required_tier": PlanTier.BASIC,
                "usage_metric": None,
                "trial_available": True,
                "trial_duration_days": 14
            },
            FeatureFlag.PORTFOLIO_ANALYTICS: {
                "name": "Portfolio Analytics",
                "description": "Detailed portfolio performance analysis",
                "required_tier": PlanTier.BASIC,
                "usage_metric": None,
                "trial_available": True,
                "trial_duration_days": 14
            },
            FeatureFlag.CUSTOM_ALERTS: {
                "name": "Custom Alerts",
                "description": "Personalized price and indicator alerts",
                "required_tier": PlanTier.BASIC,
                "usage_metric": UsageMetricType.ALERTS_SENT,
                "trial_available": True,
                "trial_duration_days": 14
            },
            FeatureFlag.API_ACCESS: {
                "name": "API Access",
                "description": "RESTful API for data access and automation",
                "required_tier": PlanTier.PRO,
                "usage_metric": UsageMetricType.API_CALLS,
                "trial_available": False
            },
            FeatureFlag.WEBHOOK_INTEGRATIONS: {
                "name": "Webhook Integrations",
                "description": "Real-time webhooks for external integrations",
                "required_tier": PlanTier.PRO,
                "usage_metric": UsageMetricType.WEBHOOKS_SENT,
                "trial_available": False
            },
            FeatureFlag.PRIORITY_SUPPORT: {
                "name": "Priority Support",
                "description": "Priority customer support with faster response times",
                "required_tier": PlanTier.PRO,
                "usage_metric": None,
                "trial_available": False
            },
            FeatureFlag.UNLIMITED_BACKTESTS: {
                "name": "Unlimited Backtests",
                "description": "Unlimited strategy backtesting",
                "required_tier": PlanTier.ENTERPRISE,
                "usage_metric": None,
                "trial_available": False
            },
            FeatureFlag.ADVANCED_SCREENER: {
                "name": "Advanced Stock Screener",
                "description": "Professional stock screening tools",
                "required_tier": PlanTier.PRO,
                "usage_metric": None,
                "trial_available": True,
                "trial_duration_days": 7
            },
            FeatureFlag.INSTITUTION_DATA: {
                "name": "Institutional Data",
                "description": "Access to institutional-grade market data",
                "required_tier": PlanTier.ENTERPRISE,
                "usage_metric": None,
                "trial_available": False
            },
            FeatureFlag.WHITE_LABEL: {
                "name": "White Label Solution",
                "description": "Custom branding and white-label platform",
                "required_tier": PlanTier.ENTERPRISE,
                "usage_metric": None,
                "trial_available": False
            },
            FeatureFlag.DEDICATED_ACCOUNT_MANAGER: {
                "name": "Dedicated Account Manager",
                "description": "Personal account manager for enterprise clients",
                "required_tier": PlanTier.ENTERPRISE,
                "usage_metric": None,
                "trial_available": False
            }
        }

    def get_feature_definition(self, feature: FeatureFlag) -> Optional[Dict[str, Any]]:
        """Get feature definition"""
        return self.features.get(feature)

    def get_features_by_tier(self, tier: PlanTier) -> List[FeatureFlag]:
        """Get all features available for a tier"""
        tier_order = {
            PlanTier.FREE: 0,
            PlanTier.BASIC: 1,
            PlanTier.PRO: 2,
            PlanTier.ENTERPRISE: 3
        }

        available_features = []
        user_tier_level = tier_order.get(tier, 0)

        for feature, definition in self.features.items():
            required_tier_level = tier_order.get(definition["required_tier"], 0)
            if user_tier_level >= required_tier_level:
                available_features.append(feature)

        return available_features


class UsageTracker:
    """Tracks feature usage against limits"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def track_usage(
        self,
        user_id: str,
        metric_type: UsageMetricType,
        quantity: int = 1,
        resource_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track usage and check against limits"""
        try:
            usage_date = date.today()

            # Create usage record
            usage_record = UsageRecord(
                user_id=user_id,
                metric_type=metric_type,
                quantity=quantity,
                usage_date=usage_date,
                billing_period_start=usage_date.replace(day=1),
                billing_period_end=self._get_month_end(usage_date),
                resource_id=resource_id,
                metadata=metadata or {}
            )

            # Store usage record
            await self._store_usage_record(usage_record)

            # Update current usage counters
            await self._update_usage_counters(user_id, metric_type, quantity)

            return True

        except Exception as e:
            logger.error(f"Error tracking usage: {e}")
            return False

    async def check_usage_limit(
        self,
        user_id: str,
        metric_type: UsageMetricType,
        requested_quantity: int = 1
    ) -> Tuple[bool, Optional[UsageLimit]]:
        """Check if usage would exceed limits"""
        try:
            # Get user's usage limit
            usage_limit = await self._get_usage_limit(user_id, metric_type)
            if not usage_limit:
                return True, None  # No limit set

            # Check if adding requested quantity would exceed limit
            would_exceed = (usage_limit.current_usage + requested_quantity) > usage_limit.limit_value

            return not would_exceed, usage_limit

        except Exception as e:
            logger.error(f"Error checking usage limit: {e}")
            return False, None

    async def get_usage_summary(
        self,
        user_id: str,
        metric_type: Optional[UsageMetricType] = None
    ) -> Dict[str, Any]:
        """Get usage summary for user"""
        try:
            if metric_type:
                metric_types = [metric_type]
            else:
                metric_types = list(UsageMetricType)

            usage_summary = {}

            for metric in metric_types:
                usage_limit = await self._get_usage_limit(user_id, metric)
                if usage_limit:
                    usage_summary[metric.value] = {
                        "current_usage": usage_limit.current_usage,
                        "limit": usage_limit.limit_value,
                        "percentage_used": usage_limit.usage_percentage,
                        "near_limit": usage_limit.is_near_limit,
                        "over_limit": usage_limit.is_over_limit,
                        "reset_date": usage_limit.reset_date.isoformat()
                    }

            return usage_summary

        except Exception as e:
            logger.error(f"Error getting usage summary: {e}")
            return {}

    async def reset_usage_limits(self, user_id: str):
        """Reset usage limits for new billing period"""
        try:
            # Get all usage limits for user
            pattern = f"usage_limit:{user_id}:*"
            keys = await self.redis.keys(pattern)

            for key in keys:
                usage_data = await self.redis.get(key)
                if usage_data:
                    usage_limit = UsageLimit(**json.loads(usage_data))

                    # Reset usage and update reset date
                    usage_limit.current_usage = 0
                    usage_limit.reset_date = date.today().replace(day=1) + timedelta(days=32)
                    usage_limit.reset_date = usage_limit.reset_date.replace(day=1)

                    # Store updated limit
                    await self._store_usage_limit(usage_limit)

            logger.info(f"Reset usage limits for user {user_id}")

        except Exception as e:
            logger.error(f"Error resetting usage limits: {e}")

    async def _store_usage_record(self, usage_record: UsageRecord):
        """Store usage record"""
        key = f"usage_record:{usage_record.record_id}"
        data = usage_record.dict()

        # Convert date objects to ISO strings
        for field in ['usage_date', 'billing_period_start', 'billing_period_end']:
            if hasattr(usage_record, field) and getattr(usage_record, field):
                data[field] = getattr(usage_record, field).isoformat()

        await self.redis.setex(
            key,
            86400 * 90,  # 90 days retention
            json.dumps(data, default=str)
        )

    async def _update_usage_counters(
        self,
        user_id: str,
        metric_type: UsageMetricType,
        quantity: int
    ):
        """Update usage counters"""
        # Daily counter
        daily_key = f"usage_counter:daily:{user_id}:{metric_type.value}:{date.today().isoformat()}"
        await self.redis.incrby(daily_key, quantity)
        await self.redis.expire(daily_key, 86400 * 7)  # 7 days retention

        # Monthly counter
        month_key = f"usage_counter:monthly:{user_id}:{metric_type.value}:{date.today().strftime('%Y-%m')}"
        await self.redis.incrby(month_key, quantity)
        await self.redis.expire(month_key, 86400 * 90)  # 90 days retention

        # Update usage limit current usage
        usage_limit = await self._get_usage_limit(user_id, metric_type)
        if usage_limit:
            usage_limit.current_usage += quantity
            await self._store_usage_limit(usage_limit)

    async def _get_usage_limit(self, user_id: str, metric_type: UsageMetricType) -> Optional[UsageLimit]:
        """Get usage limit for user and metric"""
        try:
            key = f"usage_limit:{user_id}:{metric_type.value}"
            data = await self.redis.get(key)

            if data:
                usage_data = json.loads(data)
                # Convert string dates back to date objects
                for field in ['reset_date']:
                    if field in usage_data:
                        usage_data[field] = datetime.fromisoformat(usage_data[field]).date()

                return UsageLimit(**usage_data)

            return None

        except Exception as e:
            logger.error(f"Error getting usage limit: {e}")
            return None

    async def _store_usage_limit(self, usage_limit: UsageLimit):
        """Store usage limit"""
        key = f"usage_limit:{usage_limit.user_id}:{usage_limit.metric_type.value}"
        data = usage_limit.dict()

        # Convert date objects to ISO strings
        for field in ['reset_date']:
            if hasattr(usage_limit, field) and getattr(usage_limit, field):
                data[field] = getattr(usage_limit, field).isoformat()

        await self.redis.setex(
            key,
            86400 * 32,  # 32 days retention
            json.dumps(data, default=str)
        )

    def _get_month_end(self, date_obj: date) -> date:
        """Get last day of month"""
        next_month = date_obj.replace(day=28) + timedelta(days=4)
        return next_month - timedelta(days=next_month.day)


class FeatureGatingService:
    """Main feature gating service"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.feature_registry = FeatureDefinitionRegistry()
        self.usage_tracker = UsageTracker(redis_client)

    async def check_feature_access(
        self,
        user_id: str,
        feature: FeatureFlag,
        requested_usage: int = 1
    ) -> FeatureCheckResult:
        """Check if user has access to a feature"""
        try:
            # Get user subscription
            subscription = await self._get_user_subscription(user_id)
            if not subscription:
                return FeatureCheckResult(
                    has_access=False,
                    access_level=AccessLevel.BLOCKED,
                    reason="No active subscription",
                    upgrade_required=True,
                    suggested_plans=["basic", "pro", "enterprise"]
                )

            # Get feature definition
            feature_def = self.feature_registry.get_feature_definition(feature)
            if not feature_def:
                return FeatureCheckResult(
                    has_access=False,
                    access_level=AccessLevel.BLOCKED,
                    reason="Feature not found"
                )

            # Check tier requirements
            tier_check = await self._check_tier_requirement(subscription, feature_def)
            if not tier_check["has_access"]:
                return FeatureCheckResult(
                    has_access=False,
                    access_level=AccessLevel.BLOCKED,
                    reason=tier_check["reason"],
                    upgrade_required=True,
                    suggested_plans=tier_check["suggested_plans"]
                )

            # Check usage limits if applicable
            usage_metric = feature_def.get("usage_metric")
            if usage_metric:
                usage_check = await self._check_usage_limits(user_id, usage_metric, requested_usage)
                if not usage_check["has_access"]:
                    return FeatureCheckResult(
                        has_access=False,
                        access_level=AccessLevel.USAGE_EXCEEDED,
                        reason=usage_check["reason"],
                        remaining_usage=usage_check.get("remaining_usage"),
                        limit=usage_check.get("limit"),
                        reset_date=usage_check.get("reset_date"),
                        upgrade_required=usage_check.get("upgrade_required", False),
                        suggested_plans=usage_check.get("suggested_plans")
                    )

            # Check trial access
            trial_check = await self._check_trial_access(user_id, feature, subscription)
            if trial_check["is_trial"]:
                return FeatureCheckResult(
                    has_access=True,
                    access_level=AccessLevel.TRIAL,
                    reason=trial_check["reason"]
                )

            # Check feature-specific flags
            feature_flags_check = await self._check_feature_flags(user_id, feature)
            if not feature_flags_check["has_access"]:
                return FeatureCheckResult(
                    has_access=False,
                    access_level=AccessLevel.BLOCKED,
                    reason=feature_flags_check["reason"]
                )

            # Full access granted
            return FeatureCheckResult(
                has_access=True,
                access_level=AccessLevel.FULL,
                reason="Feature included in plan"
            )

        except Exception as e:
            logger.error(f"Error checking feature access: {e}")
            return FeatureCheckResult(
                has_access=False,
                access_level=AccessLevel.BLOCKED,
                reason=f"Error checking access: {str(e)}"
            )

    async def grant_feature_access(
        self,
        user_id: str,
        feature: FeatureFlag,
        access_level: AccessLevel = AccessLevel.FULL,
        expires_at: Optional[datetime] = None,
        reason: str = "manually_granted"
    ) -> bool:
        """Grant feature access to user"""
        try:
            feature_access = FeatureAccess(
                user_id=user_id,
                feature=feature,
                has_access=True,
                reason=reason,
                expires_at=expires_at
            )

            await self._store_feature_access(feature_access)

            logger.info(f"Granted {feature.value} access to user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error granting feature access: {e}")
            return False

    async def revoke_feature_access(
        self,
        user_id: str,
        feature: FeatureFlag,
        reason: str = "access_revoked"
    ) -> bool:
        """Revoke feature access from user"""
        try:
            feature_access = FeatureAccess(
                user_id=user_id,
                feature=feature,
                has_access=False,
                reason=reason
            )

            await self._store_feature_access(feature_access)

            logger.info(f"Revoked {feature.value} access from user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error revoking feature access: {e}")
            return False

    async def initialize_user_limits(
        self,
        user_id: str,
        subscription: UserSubscription
    ) -> bool:
        """Initialize usage limits for user based on subscription"""
        try:
            if not subscription.features:
                return False

            features = subscription.features

            # Initialize usage limits for metered features
            limits_to_create = [
                (UsageMetricType.API_CALLS, features.max_api_calls_per_month),
                (UsageMetricType.NARRATIVES_GENERATED, features.max_narratives_per_month),
                (UsageMetricType.ALERTS_SENT, features.max_alerts_per_month),
                (UsageMetricType.BACKTESTS_RUN, features.max_backtests_per_month),
                (UsageMetricType.SYMBOLS_TRACKED, features.max_symbols_tracked)
            ]

            for metric_type, limit_value in limits_to_create:
                if limit_value is not None:
                    usage_limit = UsageLimit(
                        user_id=user_id,
                        subscription_id=subscription.subscription_id,
                        metric_type=metric_type,
                        limit_value=limit_value,
                        reset_date=self._get_next_reset_date()
                    )

                    await self.usage_tracker._store_usage_limit(usage_limit)

            logger.info(f"Initialized usage limits for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error initializing user limits: {e}")
            return False

    async def get_user_feature_summary(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive feature access summary for user"""
        try:
            subscription = await self._get_user_subscription(user_id)
            if not subscription:
                return {"error": "No active subscription"}

            # Get available features for user's tier
            available_features = self.feature_registry.get_features_by_tier(
                subscription.features.tier if subscription.features else PlanTier.FREE
            )

            feature_summary = {}

            for feature in FeatureFlag:
                check_result = await self.check_feature_access(user_id, feature)

                feature_summary[feature.value] = {
                    "has_access": check_result.has_access,
                    "access_level": check_result.access_level.value,
                    "reason": check_result.reason,
                    "included_in_plan": feature in available_features
                }

                if check_result.remaining_usage is not None:
                    feature_summary[feature.value]["remaining_usage"] = check_result.remaining_usage
                if check_result.limit is not None:
                    feature_summary[feature.value]["limit"] = check_result.limit

            # Get usage summary
            usage_summary = await self.usage_tracker.get_usage_summary(user_id)

            return {
                "subscription": {
                    "plan_id": subscription.plan_id,
                    "tier": subscription.features.tier.value if subscription.features else "free",
                    "status": subscription.status.value
                },
                "features": feature_summary,
                "usage": usage_summary
            }

        except Exception as e:
            logger.error(f"Error getting user feature summary: {e}")
            return {"error": str(e)}

    async def _get_user_subscription(self, user_id: str) -> Optional[UserSubscription]:
        """Get user subscription from cache"""
        try:
            cache_key = f"user_subscription:{user_id}"
            cached_data = await self.redis.get(cache_key)

            if cached_data:
                subscription_data = json.loads(cached_data)
                # Convert string dates back to datetime objects
                for field in ['start_date', 'current_period_start', 'current_period_end',
                             'trial_start', 'trial_end', 'canceled_at', 'ended_at']:
                    if field in subscription_data and subscription_data[field]:
                        subscription_data[field] = datetime.fromisoformat(subscription_data[field])

                return UserSubscription(**subscription_data)

            return None

        except Exception as e:
            logger.error(f"Error getting user subscription: {e}")
            return None

    async def _check_tier_requirement(
        self,
        subscription: UserSubscription,
        feature_def: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Check if user's tier meets feature requirements"""
        try:
            required_tier = feature_def["required_tier"]

            if not subscription.features:
                return {
                    "has_access": False,
                    "reason": "No subscription features available",
                    "suggested_plans": ["basic", "pro", "enterprise"]
                }

            user_tier = subscription.features.tier if hasattr(subscription.features, 'tier') else PlanTier.FREE

            tier_order = {
                PlanTier.FREE: 0,
                PlanTier.BASIC: 1,
                PlanTier.PRO: 2,
                PlanTier.ENTERPRISE: 3
            }

            user_tier_level = tier_order.get(user_tier, 0)
            required_tier_level = tier_order.get(required_tier, 0)

            if user_tier_level >= required_tier_level:
                return {"has_access": True}

            # Suggest appropriate plans
            suggested_plans = []
            for tier, level in tier_order.items():
                if level >= required_tier_level:
                    suggested_plans.append(tier.value)

            return {
                "has_access": False,
                "reason": f"Requires {required_tier.value} tier or higher",
                "suggested_plans": suggested_plans
            }

        except Exception as e:
            logger.error(f"Error checking tier requirement: {e}")
            return {"has_access": False, "reason": "Error checking tier"}

    async def _check_usage_limits(
        self,
        user_id: str,
        usage_metric: UsageMetricType,
        requested_usage: int
    ) -> Dict[str, Any]:
        """Check usage limits for feature"""
        try:
            can_use, usage_limit = await self.usage_tracker.check_usage_limit(
                user_id, usage_metric, requested_usage
            )

            if can_use:
                return {"has_access": True}

            if not usage_limit:
                return {"has_access": False, "reason": "Usage limit not configured"}

            return {
                "has_access": False,
                "reason": f"Usage limit exceeded for {usage_metric.value}",
                "remaining_usage": max(0, usage_limit.limit_value - usage_limit.current_usage),
                "limit": usage_limit.limit_value,
                "reset_date": usage_limit.reset_date,
                "upgrade_required": True,
                "suggested_plans": ["pro", "enterprise"]
            }

        except Exception as e:
            logger.error(f"Error checking usage limits: {e}")
            return {"has_access": False, "reason": "Error checking usage"}

    async def _check_trial_access(
        self,
        user_id: str,
        feature: FeatureFlag,
        subscription: UserSubscription
    ) -> Dict[str, bool]:
        """Check if user has trial access to feature"""
        try:
            feature_def = self.feature_registry.get_feature_definition(feature)

            if not feature_def or not feature_def.get("trial_available"):
                return {"is_trial": False}

            # Check if user is in trial period for this feature
            trial_key = f"feature_trial:{user_id}:{feature.value}"
            trial_data = await self.redis.get(trial_key)

            if trial_data:
                trial_info = json.loads(trial_data)
                trial_end = datetime.fromisoformat(trial_info["trial_end"])

                if datetime.utcnow() < trial_end:
                    return {
                        "is_trial": True,
                        "reason": f"Trial access (expires {trial_end.strftime('%Y-%m-%d')})"
                    }

            return {"is_trial": False}

        except Exception as e:
            logger.error(f"Error checking trial access: {e}")
            return {"is_trial": False}

    async def _check_feature_flags(
        self,
        user_id: str,
        feature: FeatureFlag
    ) -> Dict[str, Any]:
        """Check feature-specific flags"""
        try:
            # Check for any specific feature flags or overrides
            flag_key = f"feature_flag:{user_id}:{feature.value}"
            flag_data = await self.redis.get(flag_key)

            if flag_data:
                flag_info = json.loads(flag_data)
                return {
                    "has_access": flag_info.get("enabled", True),
                    "reason": flag_info.get("reason", "Feature flag override")
                }

            return {"has_access": True}

        except Exception as e:
            logger.error(f"Error checking feature flags: {e}")
            return {"has_access": True}

    async def _store_feature_access(self, feature_access: FeatureAccess):
        """Store feature access record"""
        try:
            key = f"feature_access:{feature_access.user_id}:{feature_access.feature.value}"
            data = feature_access.dict()

            # Convert datetime objects
            if feature_access.expires_at:
                data["expires_at"] = feature_access.expires_at.isoformat()

            ttl = 86400 * 30  # 30 days default
            if feature_access.expires_at:
                ttl = int((feature_access.expires_at - datetime.utcnow()).total_seconds())

            await self.redis.setex(key, ttl, json.dumps(data, default=str))

        except Exception as e:
            logger.error(f"Error storing feature access: {e}")

    def _get_next_reset_date(self) -> date:
        """Get next monthly reset date"""
        today = date.today()
        next_month = today.replace(day=28) + timedelta(days=4)
        return next_month.replace(day=1)