"""
Subscription Management Service for TurtleTrading Platform

Business logic layer for subscription management, plan changes, billing,
and customer lifecycle management with comprehensive feature management.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Any, Tuple
import redis.asyncio as redis
from decimal import Decimal
from dataclasses import dataclass

from ..models.payment_models import (
    UserSubscription, SubscriptionPlan, CustomerProfile, PlanTier,
    BillingInterval, SubscriptionStatus, SubscriptionChange,
    PlanFeatures, CouponCode, CreditBalance, SubscriptionAddon,
    PaymentTransaction, Invoice, PaymentAnalytics
)
from .stripe_payment_service import StripePaymentService

logger = logging.getLogger(__name__)


@dataclass
class PlanChangeResult:
    """Result of a plan change operation"""
    success: bool
    new_subscription: Optional[UserSubscription] = None
    proration_amount: Optional[Decimal] = None
    error_message: Optional[str] = None
    change_record: Optional[SubscriptionChange] = None


class PlanRegistry:
    """Registry for managing subscription plans"""

    def __init__(self):
        self.plans: Dict[str, SubscriptionPlan] = {}
        self._initialize_default_plans()

    def _initialize_default_plans(self):
        """Initialize default subscription plans"""

        # Free Plan
        free_plan = SubscriptionPlan(
            plan_id="free",
            name="Free",
            description="Perfect for getting started with basic trading tools",
            tier=PlanTier.FREE,
            price_monthly=Decimal('0'),
            features=PlanFeatures(
                real_time_data=False,
                advanced_charts=False,
                portfolio_analytics=False,
                custom_alerts=False,
                api_access=False,
                webhook_integrations=False,
                priority_support=False,
                max_api_calls_per_month=100,
                max_narratives_per_month=5,
                max_alerts_per_month=3,
                max_portfolios=1,
                max_symbols_tracked=10,
                max_backtests_per_month=2,
                data_retention_months=1,
                support_response_time_hours=72
            )
        )

        # Basic Plan
        basic_plan = SubscriptionPlan(
            plan_id="basic",
            name="Basic",
            description="Essential tools for active traders",
            tier=PlanTier.BASIC,
            price_monthly=Decimal('19.99'),
            price_quarterly=Decimal('54.99'),
            price_yearly=Decimal('199.99'),
            trial_period_days=14,
            features=PlanFeatures(
                real_time_data=True,
                advanced_charts=True,
                portfolio_analytics=True,
                custom_alerts=True,
                api_access=False,
                webhook_integrations=False,
                priority_support=False,
                max_api_calls_per_month=1000,
                max_narratives_per_month=50,
                max_alerts_per_month=25,
                max_portfolios=3,
                max_symbols_tracked=100,
                max_backtests_per_month=10,
                data_retention_months=6,
                support_response_time_hours=48
            ),
            is_popular=True
        )

        # Pro Plan
        pro_plan = SubscriptionPlan(
            plan_id="pro",
            name="Pro",
            description="Advanced analytics for professional traders",
            tier=PlanTier.PRO,
            price_monthly=Decimal('49.99'),
            price_quarterly=Decimal('134.99'),
            price_yearly=Decimal('499.99'),
            trial_period_days=14,
            features=PlanFeatures(
                real_time_data=True,
                advanced_charts=True,
                portfolio_analytics=True,
                custom_alerts=True,
                api_access=True,
                webhook_integrations=True,
                priority_support=True,
                max_api_calls_per_month=10000,
                max_narratives_per_month=500,
                max_alerts_per_month=100,
                max_portfolios=10,
                max_symbols_tracked=1000,
                max_backtests_per_month=100,
                unlimited_backtests=False,
                advanced_screener=True,
                data_retention_months=24,
                export_capabilities=True,
                support_response_time_hours=24,
                phone_support=True
            )
        )

        # Enterprise Plan
        enterprise_plan = SubscriptionPlan(
            plan_id="enterprise",
            name="Enterprise",
            description="Full-featured platform for institutions and teams",
            tier=PlanTier.ENTERPRISE,
            price_monthly=Decimal('199.99'),
            price_quarterly=Decimal('539.99'),
            price_yearly=Decimal('1999.99'),
            trial_period_days=30,
            features=PlanFeatures(
                real_time_data=True,
                advanced_charts=True,
                portfolio_analytics=True,
                custom_alerts=True,
                api_access=True,
                webhook_integrations=True,
                priority_support=True,
                max_api_calls_per_month=None,  # Unlimited
                max_narratives_per_month=None,  # Unlimited
                max_alerts_per_month=None,  # Unlimited
                max_portfolios=None,  # Unlimited
                max_symbols_tracked=None,  # Unlimited
                unlimited_backtests=True,
                advanced_screener=True,
                institution_data=True,
                white_label=True,
                dedicated_account_manager=True,
                data_retention_months=60,
                export_capabilities=True,
                support_response_time_hours=4,
                phone_support=True,
                custom_branding=True,
                custom_integrations=True
            )
        )

        # Register plans
        self.plans = {
            "free": free_plan,
            "basic": basic_plan,
            "pro": pro_plan,
            "enterprise": enterprise_plan
        }

    def get_plan(self, plan_id: str) -> Optional[SubscriptionPlan]:
        """Get plan by ID"""
        return self.plans.get(plan_id)

    def get_all_plans(self) -> List[SubscriptionPlan]:
        """Get all available plans"""
        return list(self.plans.values())

    def get_plans_by_tier(self, tier: PlanTier) -> List[SubscriptionPlan]:
        """Get plans by tier"""
        return [plan for plan in self.plans.values() if plan.tier == tier]

    def is_upgrade(self, from_plan_id: str, to_plan_id: str) -> bool:
        """Check if plan change is an upgrade"""
        tier_order = {
            PlanTier.FREE: 0,
            PlanTier.BASIC: 1,
            PlanTier.PRO: 2,
            PlanTier.ENTERPRISE: 3
        }

        from_plan = self.get_plan(from_plan_id)
        to_plan = self.get_plan(to_plan_id)

        if not from_plan or not to_plan:
            return False

        return tier_order[to_plan.tier] > tier_order[from_plan.tier]


class SubscriptionLifecycleManager:
    """Manages subscription lifecycle events"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def handle_subscription_created(
        self,
        subscription: UserSubscription,
        plan: SubscriptionPlan
    ):
        """Handle new subscription creation"""
        try:
            # Log subscription creation
            await self._log_subscription_event(
                subscription.user_id,
                "subscription_created",
                {
                    "subscription_id": subscription.subscription_id,
                    "plan_id": subscription.plan_id,
                    "tier": plan.tier.value,
                    "billing_interval": subscription.billing_interval.value,
                    "amount": str(subscription.amount),
                    "is_trial": subscription.is_trial
                }
            )

            # Send welcome email
            await self._send_welcome_email(subscription, plan)

            # Initialize user features
            await self._initialize_user_features(subscription.user_id, plan)

            # Track analytics
            await self._track_subscription_analytics(subscription, "created")

        except Exception as e:
            logger.error(f"Error handling subscription created: {e}")

    async def handle_subscription_updated(
        self,
        old_subscription: UserSubscription,
        new_subscription: UserSubscription,
        change_type: str
    ):
        """Handle subscription updates"""
        try:
            await self._log_subscription_event(
                new_subscription.user_id,
                f"subscription_{change_type}",
                {
                    "subscription_id": new_subscription.subscription_id,
                    "old_plan_id": old_subscription.plan_id,
                    "new_plan_id": new_subscription.plan_id,
                    "change_type": change_type
                }
            )

            # Update user features
            if old_subscription.plan_id != new_subscription.plan_id:
                await self._update_user_features(new_subscription, change_type)

            # Track analytics
            await self._track_subscription_analytics(new_subscription, change_type)

        except Exception as e:
            logger.error(f"Error handling subscription updated: {e}")

    async def handle_subscription_canceled(
        self,
        subscription: UserSubscription,
        cancellation_reason: Optional[str] = None
    ):
        """Handle subscription cancellation"""
        try:
            await self._log_subscription_event(
                subscription.user_id,
                "subscription_canceled",
                {
                    "subscription_id": subscription.subscription_id,
                    "plan_id": subscription.plan_id,
                    "reason": cancellation_reason,
                    "canceled_at": subscription.canceled_at.isoformat() if subscription.canceled_at else None
                }
            )

            # Send cancellation email
            await self._send_cancellation_email(subscription, cancellation_reason)

            # Schedule feature downgrade
            await self._schedule_feature_downgrade(subscription)

            # Track analytics
            await self._track_subscription_analytics(subscription, "canceled")

        except Exception as e:
            logger.error(f"Error handling subscription canceled: {e}")

    async def handle_trial_ending_soon(self, subscription: UserSubscription):
        """Handle trial ending soon notification"""
        try:
            days_remaining = subscription.trial_days_remaining or 0

            if days_remaining <= 3:  # Notify 3 days before trial ends
                await self._send_trial_ending_email(subscription, days_remaining)

                await self._log_subscription_event(
                    subscription.user_id,
                    "trial_ending_soon",
                    {
                        "subscription_id": subscription.subscription_id,
                        "days_remaining": days_remaining
                    }
                )

        except Exception as e:
            logger.error(f"Error handling trial ending soon: {e}")

    async def _log_subscription_event(
        self,
        user_id: str,
        event_type: str,
        event_data: Dict[str, Any]
    ):
        """Log subscription event to Redis"""
        try:
            event = {
                "user_id": user_id,
                "event_type": event_type,
                "event_data": event_data,
                "timestamp": datetime.utcnow().isoformat()
            }

            # Store in Redis with TTL
            key = f"subscription_events:{user_id}:{event_type}:{datetime.utcnow().timestamp()}"
            await self.redis.setex(key, 86400 * 30, json.dumps(event))  # 30 days TTL

        except Exception as e:
            logger.error(f"Error logging subscription event: {e}")

    async def _send_welcome_email(self, subscription: UserSubscription, plan: SubscriptionPlan):
        """Send welcome email to new subscriber"""
        # This would integrate with email service
        logger.info(f"Sending welcome email to user {subscription.user_id} for plan {plan.name}")

    async def _send_cancellation_email(
        self,
        subscription: UserSubscription,
        reason: Optional[str]
    ):
        """Send cancellation confirmation email"""
        logger.info(f"Sending cancellation email to user {subscription.user_id}")

    async def _send_trial_ending_email(self, subscription: UserSubscription, days_remaining: int):
        """Send trial ending notification"""
        logger.info(f"Sending trial ending email to user {subscription.user_id} ({days_remaining} days remaining)")

    async def _initialize_user_features(self, user_id: str, plan: SubscriptionPlan):
        """Initialize user features based on plan"""
        try:
            features_key = f"user_features:{user_id}"
            features_data = {
                "plan_id": plan.plan_id,
                "tier": plan.tier.value,
                "features": plan.features.dict(),
                "updated_at": datetime.utcnow().isoformat()
            }

            await self.redis.setex(features_key, 86400 * 7, json.dumps(features_data))  # 7 days cache

        except Exception as e:
            logger.error(f"Error initializing user features: {e}")

    async def _update_user_features(self, subscription: UserSubscription, change_type: str):
        """Update user features after subscription change"""
        # This would update feature access in the feature gating system
        logger.info(f"Updating features for user {subscription.user_id} after {change_type}")

    async def _schedule_feature_downgrade(self, subscription: UserSubscription):
        """Schedule feature downgrade after cancellation"""
        # This would schedule the downgrade to happen at period end
        logger.info(f"Scheduling feature downgrade for user {subscription.user_id}")

    async def _track_subscription_analytics(self, subscription: UserSubscription, event_type: str):
        """Track subscription analytics"""
        try:
            analytics_key = f"subscription_analytics:{datetime.utcnow().strftime('%Y%m%d')}"
            analytics_data = await self.redis.hgetall(analytics_key)

            # Update counters
            counter_key = f"{event_type}_count"
            current_count = int(analytics_data.get(counter_key, 0))
            await self.redis.hset(analytics_key, counter_key, current_count + 1)

            # Set expiration
            await self.redis.expire(analytics_key, 86400 * 90)  # 90 days

        except Exception as e:
            logger.error(f"Error tracking subscription analytics: {e}")


class SubscriptionManagementService:
    """Main subscription management service"""

    def __init__(
        self,
        stripe_service: StripePaymentService,
        redis_client: redis.Redis
    ):
        self.stripe_service = stripe_service
        self.redis = redis_client
        self.plan_registry = PlanRegistry()
        self.lifecycle_manager = SubscriptionLifecycleManager(redis_client)

    async def create_subscription(
        self,
        user_id: str,
        email: str,
        name: str,
        plan_id: str,
        billing_interval: BillingInterval,
        payment_method_id: Optional[str] = None,
        coupon_code: Optional[str] = None
    ) -> Tuple[bool, UserSubscription, Optional[str]]:
        """Create a new subscription"""
        try:
            # Get plan
            plan = self.plan_registry.get_plan(plan_id)
            if not plan:
                return False, None, f"Plan {plan_id} not found"

            # Validate coupon if provided
            if coupon_code:
                coupon_valid, coupon_error = await self._validate_coupon(coupon_code, plan_id)
                if not coupon_valid:
                    return False, None, coupon_error

            # Create/get customer
            customer_profile = await self.stripe_service.initialize_customer_for_user(
                user_id=user_id,
                email=email,
                name=name
            )

            # Create subscription
            subscription = await self.stripe_service.create_subscription_with_trial(
                customer_id=customer_profile.stripe_customer_id,
                plan=plan,
                billing_interval=billing_interval,
                payment_method_id=payment_method_id
            )

            # Update subscription with our data
            subscription.user_id = user_id
            subscription.plan_id = plan_id
            subscription.features = plan.features

            # Handle subscription lifecycle
            await self.lifecycle_manager.handle_subscription_created(subscription, plan)

            # Store subscription
            await self._store_subscription(subscription)

            return True, subscription, None

        except Exception as e:
            logger.error(f"Error creating subscription: {e}")
            return False, None, str(e)

    async def change_plan(
        self,
        user_id: str,
        subscription_id: str,
        new_plan_id: str,
        new_billing_interval: Optional[BillingInterval] = None,
        proration_date: Optional[datetime] = None
    ) -> PlanChangeResult:
        """Change subscription plan"""
        try:
            # Get current subscription
            current_subscription = await self.get_user_subscription(user_id)
            if not current_subscription:
                return PlanChangeResult(
                    success=False,
                    error_message="No active subscription found"
                )

            # Get current and new plans
            current_plan = self.plan_registry.get_plan(current_subscription.plan_id)
            new_plan = self.plan_registry.get_plan(new_plan_id)

            if not current_plan or not new_plan:
                return PlanChangeResult(
                    success=False,
                    error_message="Invalid plan specified"
                )

            # Determine change type
            is_upgrade = self.plan_registry.is_upgrade(current_subscription.plan_id, new_plan_id)
            change_type = "upgrade" if is_upgrade else "downgrade"

            # Calculate proration
            proration_amount = await self._calculate_proration(
                current_subscription,
                new_plan,
                new_billing_interval or current_subscription.billing_interval,
                proration_date
            )

            # Update subscription in Stripe
            billing_interval = new_billing_interval or current_subscription.billing_interval
            price_id = self.stripe_service._get_price_id_for_plan(new_plan, billing_interval)

            updated_subscription = await self.stripe_service.subscription_service.update_subscription(
                subscription_id=current_subscription.stripe_subscription_id,
                price_id=price_id,
                proration_date=int(proration_date.timestamp()) if proration_date else None
            )

            # Update our records
            updated_subscription.user_id = user_id
            updated_subscription.plan_id = new_plan_id
            updated_subscription.features = new_plan.features

            # Create change record
            change_record = SubscriptionChange(
                user_id=user_id,
                subscription_id=subscription_id,
                change_type=change_type,
                from_plan_id=current_subscription.plan_id,
                to_plan_id=new_plan_id,
                from_interval=current_subscription.billing_interval,
                to_interval=billing_interval,
                proration_amount=proration_amount,
                effective_date=proration_date or datetime.utcnow(),
                reason="user_requested"
            )

            # Handle lifecycle
            await self.lifecycle_manager.handle_subscription_updated(
                current_subscription,
                updated_subscription,
                change_type
            )

            # Store updated subscription and change record
            await self._store_subscription(updated_subscription)
            await self._store_subscription_change(change_record)

            return PlanChangeResult(
                success=True,
                new_subscription=updated_subscription,
                proration_amount=proration_amount,
                change_record=change_record
            )

        except Exception as e:
            logger.error(f"Error changing plan: {e}")
            return PlanChangeResult(
                success=False,
                error_message=str(e)
            )

    async def cancel_subscription(
        self,
        user_id: str,
        subscription_id: str,
        at_period_end: bool = True,
        cancellation_reason: Optional[str] = None
    ) -> Tuple[bool, Optional[UserSubscription], Optional[str]]:
        """Cancel subscription"""
        try:
            # Get current subscription
            current_subscription = await self.get_user_subscription(user_id)
            if not current_subscription:
                return False, None, "No active subscription found"

            # Cancel in Stripe
            canceled_subscription = await self.stripe_service.subscription_service.cancel_subscription(
                subscription_id=current_subscription.stripe_subscription_id,
                at_period_end=at_period_end,
                cancellation_reason=cancellation_reason
            )

            # Update our records
            canceled_subscription.user_id = user_id

            # Handle lifecycle
            await self.lifecycle_manager.handle_subscription_canceled(
                canceled_subscription,
                cancellation_reason
            )

            # Store updated subscription
            await self._store_subscription(canceled_subscription)

            return True, canceled_subscription, None

        except Exception as e:
            logger.error(f"Error canceling subscription: {e}")
            return False, None, str(e)

    async def reactivate_subscription(
        self,
        user_id: str,
        subscription_id: str
    ) -> Tuple[bool, Optional[UserSubscription], Optional[str]]:
        """Reactivate a canceled subscription"""
        try:
            # Get current subscription
            current_subscription = await self.get_user_subscription(user_id)
            if not current_subscription:
                return False, None, "No subscription found"

            # Reactivate in Stripe
            reactivated_subscription = await self.stripe_service.subscription_service.reactivate_subscription(
                current_subscription.stripe_subscription_id
            )

            # Update our records
            reactivated_subscription.user_id = user_id

            # Handle lifecycle
            await self.lifecycle_manager.handle_subscription_updated(
                current_subscription,
                reactivated_subscription,
                "reactivated"
            )

            # Store updated subscription
            await self._store_subscription(reactivated_subscription)

            return True, reactivated_subscription, None

        except Exception as e:
            logger.error(f"Error reactivating subscription: {e}")
            return False, None, str(e)

    async def get_user_subscription(self, user_id: str) -> Optional[UserSubscription]:
        """Get user's current subscription"""
        try:
            # Try cache first
            cache_key = f"user_subscription:{user_id}"
            cached_data = await self.redis.get(cache_key)

            if cached_data:
                subscription_data = json.loads(cached_data)
                return UserSubscription(**subscription_data)

            # If not in cache, would query database
            # For now, return None
            return None

        except Exception as e:
            logger.error(f"Error getting user subscription: {e}")
            return None

    async def get_available_plans(
        self,
        user_id: Optional[str] = None
    ) -> List[SubscriptionPlan]:
        """Get available plans for user"""
        try:
            all_plans = self.plan_registry.get_all_plans()

            # Filter plans based on user context if needed
            if user_id:
                # Could implement user-specific plan filtering here
                pass

            return [plan for plan in all_plans if plan.is_active]

        except Exception as e:
            logger.error(f"Error getting available plans: {e}")
            return []

    async def check_trial_status(self, user_id: str) -> Dict[str, Any]:
        """Check trial status for user"""
        try:
            subscription = await self.get_user_subscription(user_id)

            if not subscription:
                return {"has_trial": False, "trial_used": False}

            if subscription.is_trial:
                days_remaining = subscription.trial_days_remaining or 0

                # Check if trial is ending soon
                if days_remaining <= 3:
                    await self.lifecycle_manager.handle_trial_ending_soon(subscription)

                return {
                    "has_trial": True,
                    "trial_active": True,
                    "days_remaining": days_remaining,
                    "trial_end": subscription.trial_end.isoformat() if subscription.trial_end else None
                }

            return {
                "has_trial": False,
                "trial_used": True,
                "trial_ended": subscription.trial_end.isoformat() if subscription.trial_end else None
            }

        except Exception as e:
            logger.error(f"Error checking trial status: {e}")
            return {"has_trial": False, "error": str(e)}

    async def apply_coupon(
        self,
        user_id: str,
        subscription_id: str,
        coupon_code: str
    ) -> Tuple[bool, Optional[str]]:
        """Apply coupon to subscription"""
        try:
            # Validate coupon
            coupon_valid, error_message = await self._validate_coupon(coupon_code)
            if not coupon_valid:
                return False, error_message

            # Apply coupon in Stripe
            # This would involve creating a discount on the subscription

            logger.info(f"Applied coupon {coupon_code} to subscription {subscription_id}")
            return True, None

        except Exception as e:
            logger.error(f"Error applying coupon: {e}")
            return False, str(e)

    async def _validate_coupon(
        self,
        coupon_code: str,
        plan_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Validate coupon code"""
        try:
            # This would check coupon validity, usage limits, etc.
            # For now, return True for demo purposes
            return True, None

        except Exception as e:
            logger.error(f"Error validating coupon: {e}")
            return False, str(e)

    async def _calculate_proration(
        self,
        current_subscription: UserSubscription,
        new_plan: SubscriptionPlan,
        new_billing_interval: BillingInterval,
        proration_date: Optional[datetime] = None
    ) -> Decimal:
        """Calculate proration amount for plan change"""
        try:
            # Get new price ID
            price_id = self.stripe_service._get_price_id_for_plan(new_plan, new_billing_interval)
            if not price_id:
                return Decimal('0')

            # Calculate using Stripe
            proration_amount = await self.stripe_service.calculate_proration_amount(
                current_subscription.stripe_subscription_id,
                price_id,
                proration_date
            )

            return proration_amount

        except Exception as e:
            logger.error(f"Error calculating proration: {e}")
            return Decimal('0')

    async def _store_subscription(self, subscription: UserSubscription):
        """Store subscription in cache and database"""
        try:
            # Store in cache
            cache_key = f"user_subscription:{subscription.user_id}"
            subscription_data = subscription.dict()

            # Convert datetime objects to ISO strings
            for field in ['start_date', 'current_period_start', 'current_period_end',
                         'trial_start', 'trial_end', 'canceled_at', 'ended_at',
                         'created_at', 'updated_at']:
                if hasattr(subscription, field) and getattr(subscription, field):
                    subscription_data[field] = getattr(subscription, field).isoformat()

            await self.redis.setex(
                cache_key,
                86400,  # 24 hours
                json.dumps(subscription_data, default=str)
            )

            # In a real implementation, also store in database

        except Exception as e:
            logger.error(f"Error storing subscription: {e}")

    async def _store_subscription_change(self, change: SubscriptionChange):
        """Store subscription change record"""
        try:
            change_key = f"subscription_change:{change.change_id}"
            change_data = change.dict()

            # Convert datetime objects
            for field in ['effective_date', 'created_at']:
                if hasattr(change, field) and getattr(change, field):
                    change_data[field] = getattr(change, field).isoformat()

            await self.redis.setex(
                change_key,
                86400 * 30,  # 30 days
                json.dumps(change_data, default=str)
            )

        except Exception as e:
            logger.error(f"Error storing subscription change: {e}")

    async def get_subscription_analytics(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> PaymentAnalytics:
        """Get subscription analytics for date range"""
        try:
            # This would aggregate data from stored analytics
            # For now, return mock data
            return PaymentAnalytics(
                period_start=start_date,
                period_end=end_date,
                total_revenue=Decimal('10000.00'),
                recurring_revenue=Decimal('9500.00'),
                one_time_revenue=Decimal('500.00'),
                new_subscriptions=25,
                canceled_subscriptions=5,
                total_active_customers=150,
                customers_by_plan={
                    "free": 50,
                    "basic": 75,
                    "pro": 20,
                    "enterprise": 5
                }
            )

        except Exception as e:
            logger.error(f"Error getting subscription analytics: {e}")
            return PaymentAnalytics(period_start=start_date, period_end=end_date)