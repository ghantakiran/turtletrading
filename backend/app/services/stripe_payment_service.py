"""
Stripe Payment Integration Service for TurtleTrading Platform

Comprehensive Stripe integration for subscription management, payment processing,
webhook handling, and customer management.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import stripe
import redis.asyncio as redis
from decimal import Decimal

from ..models.payment_models import (
    UserSubscription, PaymentTransaction, CustomerProfile, Invoice,
    SubscriptionPlan, SubscriptionStatus, PaymentStatus, PaymentMethod,
    BillingInterval, CurrencyCode, ProrationMethod, WebhookEvent,
    InvoiceLineItem, SubscriptionChange, CouponCode
)

logger = logging.getLogger(__name__)


class StripeConfiguration:
    """Stripe configuration and setup"""

    def __init__(
        self,
        secret_key: str,
        publishable_key: str,
        webhook_secret: str,
        environment: str = "development"
    ):
        self.secret_key = secret_key
        self.publishable_key = publishable_key
        self.webhook_secret = webhook_secret
        self.environment = environment

        # Configure Stripe
        stripe.api_key = secret_key
        stripe.api_version = "2023-10-16"

        # Set up logging
        if environment == "development":
            stripe.log = "debug"


class StripeCustomerService:
    """Stripe customer management"""

    def __init__(self, config: StripeConfiguration):
        self.config = config

    async def create_customer(
        self,
        user_id: str,
        email: str,
        name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> CustomerProfile:
        """Create a new Stripe customer"""
        try:
            # Create customer in Stripe
            stripe_customer = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Customer.create(
                    email=email,
                    name=name,
                    metadata={
                        "user_id": user_id,
                        "platform": "turtletrading",
                        **(metadata or {})
                    }
                )
            )

            # Create customer profile
            customer_profile = CustomerProfile(
                user_id=user_id,
                stripe_customer_id=stripe_customer.id,
                email=email,
                full_name=name
            )

            logger.info(f"Created Stripe customer {stripe_customer.id} for user {user_id}")
            return customer_profile

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating customer: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating customer: {e}")
            raise

    async def update_customer(
        self,
        stripe_customer_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update Stripe customer information"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Customer.modify(
                    stripe_customer_id,
                    **updates
                )
            )

            logger.info(f"Updated Stripe customer {stripe_customer_id}")
            return True

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error updating customer: {e}")
            return False

    async def get_customer(self, stripe_customer_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve Stripe customer"""
        try:
            customer = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Customer.retrieve(stripe_customer_id)
            )

            return customer
        except stripe.error.StripeError as e:
            logger.error(f"Error retrieving customer {stripe_customer_id}: {e}")
            return None

    async def delete_customer(self, stripe_customer_id: str) -> bool:
        """Delete Stripe customer"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Customer.delete(stripe_customer_id)
            )

            logger.info(f"Deleted Stripe customer {stripe_customer_id}")
            return True

        except stripe.error.StripeError as e:
            logger.error(f"Error deleting customer: {e}")
            return False


class StripePaymentMethodService:
    """Stripe payment method management"""

    def __init__(self, config: StripeConfiguration):
        self.config = config

    async def create_setup_intent(
        self,
        customer_id: str,
        payment_method_types: List[str] = None
    ) -> Dict[str, Any]:
        """Create a SetupIntent for saving payment methods"""
        try:
            if not payment_method_types:
                payment_method_types = ["card"]

            setup_intent = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.SetupIntent.create(
                    customer=customer_id,
                    payment_method_types=payment_method_types,
                    usage="off_session"  # For subscriptions
                )
            )

            return {
                "client_secret": setup_intent.client_secret,
                "setup_intent_id": setup_intent.id
            }

        except stripe.error.StripeError as e:
            logger.error(f"Error creating setup intent: {e}")
            raise

    async def attach_payment_method(
        self,
        payment_method_id: str,
        customer_id: str
    ) -> bool:
        """Attach payment method to customer"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.PaymentMethod.attach(
                    payment_method_id,
                    customer=customer_id
                )
            )

            logger.info(f"Attached payment method {payment_method_id} to customer {customer_id}")
            return True

        except stripe.error.StripeError as e:
            logger.error(f"Error attaching payment method: {e}")
            return False

    async def detach_payment_method(self, payment_method_id: str) -> bool:
        """Detach payment method from customer"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.PaymentMethod.detach(payment_method_id)
            )

            logger.info(f"Detached payment method {payment_method_id}")
            return True

        except stripe.error.StripeError as e:
            logger.error(f"Error detaching payment method: {e}")
            return False

    async def set_default_payment_method(
        self,
        customer_id: str,
        payment_method_id: str
    ) -> bool:
        """Set default payment method for customer"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Customer.modify(
                    customer_id,
                    invoice_settings={
                        "default_payment_method": payment_method_id
                    }
                )
            )

            logger.info(f"Set default payment method {payment_method_id} for customer {customer_id}")
            return True

        except stripe.error.StripeError as e:
            logger.error(f"Error setting default payment method: {e}")
            return False

    async def list_payment_methods(
        self,
        customer_id: str,
        payment_method_type: str = "card"
    ) -> List[Dict[str, Any]]:
        """List customer's payment methods"""
        try:
            payment_methods = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.PaymentMethod.list(
                    customer=customer_id,
                    type=payment_method_type
                )
            )

            return [pm for pm in payment_methods.data]

        except stripe.error.StripeError as e:
            logger.error(f"Error listing payment methods: {e}")
            return []


class StripeSubscriptionService:
    """Stripe subscription management"""

    def __init__(self, config: StripeConfiguration):
        self.config = config

    async def create_subscription(
        self,
        customer_id: str,
        price_id: str,
        payment_method_id: Optional[str] = None,
        trial_period_days: Optional[int] = None,
        proration_behavior: str = "create_prorations",
        metadata: Optional[Dict[str, Any]] = None
    ) -> UserSubscription:
        """Create a new subscription"""
        try:
            subscription_params = {
                "customer": customer_id,
                "items": [{"price": price_id}],
                "expand": ["latest_invoice.payment_intent"],
                "metadata": metadata or {}
            }

            if payment_method_id:
                subscription_params["default_payment_method"] = payment_method_id

            if trial_period_days:
                subscription_params["trial_period_days"] = trial_period_days

            subscription_params["proration_behavior"] = proration_behavior

            # Create subscription in Stripe
            stripe_subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Subscription.create(**subscription_params)
            )

            # Convert to our model
            user_subscription = await self._convert_stripe_subscription(stripe_subscription)

            logger.info(f"Created subscription {stripe_subscription.id} for customer {customer_id}")
            return user_subscription

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating subscription: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating subscription: {e}")
            raise

    async def update_subscription(
        self,
        subscription_id: str,
        price_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        proration_behavior: str = "create_prorations",
        proration_date: Optional[int] = None
    ) -> UserSubscription:
        """Update existing subscription"""
        try:
            update_params = {
                "proration_behavior": proration_behavior
            }

            if price_id:
                # Get current subscription to modify items
                current_sub = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: stripe.Subscription.retrieve(subscription_id)
                )

                update_params["items"] = [{
                    "id": current_sub["items"]["data"][0]["id"],
                    "price": price_id
                }]

            if payment_method_id:
                update_params["default_payment_method"] = payment_method_id

            if proration_date:
                update_params["proration_date"] = proration_date

            # Update subscription
            stripe_subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Subscription.modify(subscription_id, **update_params)
            )

            # Convert to our model
            user_subscription = await self._convert_stripe_subscription(stripe_subscription)

            logger.info(f"Updated subscription {subscription_id}")
            return user_subscription

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error updating subscription: {e}")
            raise

    async def cancel_subscription(
        self,
        subscription_id: str,
        at_period_end: bool = True,
        cancellation_reason: Optional[str] = None
    ) -> UserSubscription:
        """Cancel subscription"""
        try:
            if at_period_end:
                # Cancel at period end
                stripe_subscription = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: stripe.Subscription.modify(
                        subscription_id,
                        cancel_at_period_end=True,
                        metadata={"cancellation_reason": cancellation_reason or "user_requested"}
                    )
                )
            else:
                # Cancel immediately
                stripe_subscription = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: stripe.Subscription.cancel(subscription_id)
                )

            # Convert to our model
            user_subscription = await self._convert_stripe_subscription(stripe_subscription)

            logger.info(f"Canceled subscription {subscription_id} (at_period_end: {at_period_end})")
            return user_subscription

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error canceling subscription: {e}")
            raise

    async def reactivate_subscription(self, subscription_id: str) -> UserSubscription:
        """Reactivate a canceled subscription"""
        try:
            stripe_subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=False
                )
            )

            user_subscription = await self._convert_stripe_subscription(stripe_subscription)

            logger.info(f"Reactivated subscription {subscription_id}")
            return user_subscription

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error reactivating subscription: {e}")
            raise

    async def pause_subscription(
        self,
        subscription_id: str,
        pause_collection: Dict[str, Any]
    ) -> UserSubscription:
        """Pause subscription"""
        try:
            stripe_subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Subscription.modify(
                    subscription_id,
                    pause_collection=pause_collection
                )
            )

            user_subscription = await self._convert_stripe_subscription(stripe_subscription)

            logger.info(f"Paused subscription {subscription_id}")
            return user_subscription

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error pausing subscription: {e}")
            raise

    async def resume_subscription(self, subscription_id: str) -> UserSubscription:
        """Resume paused subscription"""
        try:
            stripe_subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Subscription.modify(
                    subscription_id,
                    pause_collection=""  # Remove pause
                )
            )

            user_subscription = await self._convert_stripe_subscription(stripe_subscription)

            logger.info(f"Resumed subscription {subscription_id}")
            return user_subscription

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error resuming subscription: {e}")
            raise

    async def get_subscription(self, subscription_id: str) -> Optional[UserSubscription]:
        """Retrieve subscription from Stripe"""
        try:
            stripe_subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Subscription.retrieve(subscription_id)
            )

            return await self._convert_stripe_subscription(stripe_subscription)

        except stripe.error.StripeError as e:
            logger.error(f"Error retrieving subscription {subscription_id}: {e}")
            return None

    async def _convert_stripe_subscription(self, stripe_sub: Any) -> UserSubscription:
        """Convert Stripe subscription to our model"""
        try:
            # Map Stripe status to our status
            status_mapping = {
                "active": SubscriptionStatus.ACTIVE,
                "trialing": SubscriptionStatus.TRIALING,
                "past_due": SubscriptionStatus.PAST_DUE,
                "canceled": SubscriptionStatus.CANCELED,
                "unpaid": SubscriptionStatus.UNPAID,
                "incomplete": SubscriptionStatus.INCOMPLETE,
                "incomplete_expired": SubscriptionStatus.INCOMPLETE_EXPIRED,
                "paused": SubscriptionStatus.PAUSED
            }

            # Determine billing interval from price
            price = stripe_sub.items.data[0].price
            interval_mapping = {
                "month": BillingInterval.MONTHLY,
                "year": BillingInterval.YEARLY,
                "quarter": BillingInterval.QUARTERLY
            }

            billing_interval = interval_mapping.get(
                price.recurring.interval,
                BillingInterval.MONTHLY
            )

            return UserSubscription(
                stripe_subscription_id=stripe_sub.id,
                stripe_customer_id=stripe_sub.customer,
                user_id=stripe_sub.metadata.get("user_id", ""),
                plan_id=stripe_sub.metadata.get("plan_id", ""),
                status=status_mapping.get(stripe_sub.status, SubscriptionStatus.ACTIVE),
                billing_interval=billing_interval,
                start_date=datetime.fromtimestamp(stripe_sub.start_date),
                current_period_start=datetime.fromtimestamp(stripe_sub.current_period_start),
                current_period_end=datetime.fromtimestamp(stripe_sub.current_period_end),
                trial_start=datetime.fromtimestamp(stripe_sub.trial_start) if stripe_sub.trial_start else None,
                trial_end=datetime.fromtimestamp(stripe_sub.trial_end) if stripe_sub.trial_end else None,
                canceled_at=datetime.fromtimestamp(stripe_sub.canceled_at) if stripe_sub.canceled_at else None,
                ended_at=datetime.fromtimestamp(stripe_sub.ended_at) if stripe_sub.ended_at else None,
                amount=Decimal(str(price.unit_amount / 100)),  # Convert cents to dollars
                currency=CurrencyCode(price.currency),
                is_trial=stripe_sub.status == "trialing",
                metadata=dict(stripe_sub.metadata)
            )

        except Exception as e:
            logger.error(f"Error converting Stripe subscription: {e}")
            raise


class StripeInvoiceService:
    """Stripe invoice management"""

    def __init__(self, config: StripeConfiguration):
        self.config = config

    async def create_invoice(
        self,
        customer_id: str,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Invoice:
        """Create a new invoice"""
        try:
            stripe_invoice = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Invoice.create(
                    customer=customer_id,
                    description=description,
                    metadata=metadata or {}
                )
            )

            return await self._convert_stripe_invoice(stripe_invoice)

        except stripe.error.StripeError as e:
            logger.error(f"Error creating invoice: {e}")
            raise

    async def finalize_invoice(self, invoice_id: str) -> Invoice:
        """Finalize a draft invoice"""
        try:
            stripe_invoice = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Invoice.finalize_invoice(invoice_id)
            )

            return await self._convert_stripe_invoice(stripe_invoice)

        except stripe.error.StripeError as e:
            logger.error(f"Error finalizing invoice: {e}")
            raise

    async def pay_invoice(self, invoice_id: str) -> PaymentTransaction:
        """Pay an invoice"""
        try:
            stripe_invoice = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Invoice.pay(invoice_id)
            )

            # Create payment transaction record
            payment_transaction = PaymentTransaction(
                user_id=stripe_invoice.metadata.get("user_id", ""),
                stripe_invoice_id=stripe_invoice.id,
                amount=Decimal(str(stripe_invoice.amount_paid / 100)),
                currency=CurrencyCode(stripe_invoice.currency),
                payment_method=PaymentMethod.CREDIT_CARD,  # Default
                status=PaymentStatus.SUCCEEDED if stripe_invoice.paid else PaymentStatus.FAILED,
                description=f"Invoice {stripe_invoice.number}",
                succeeded_at=datetime.utcnow() if stripe_invoice.paid else None
            )

            return payment_transaction

        except stripe.error.StripeError as e:
            logger.error(f"Error paying invoice: {e}")
            raise

    async def void_invoice(self, invoice_id: str) -> Invoice:
        """Void an invoice"""
        try:
            stripe_invoice = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Invoice.void_invoice(invoice_id)
            )

            return await self._convert_stripe_invoice(stripe_invoice)

        except stripe.error.StripeError as e:
            logger.error(f"Error voiding invoice: {e}")
            raise

    async def get_invoice(self, invoice_id: str) -> Optional[Invoice]:
        """Retrieve invoice from Stripe"""
        try:
            stripe_invoice = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Invoice.retrieve(invoice_id)
            )

            return await self._convert_stripe_invoice(stripe_invoice)

        except stripe.error.StripeError as e:
            logger.error(f"Error retrieving invoice {invoice_id}: {e}")
            return None

    async def list_customer_invoices(
        self,
        customer_id: str,
        limit: int = 10
    ) -> List[Invoice]:
        """List invoices for a customer"""
        try:
            stripe_invoices = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Invoice.list(
                    customer=customer_id,
                    limit=limit
                )
            )

            invoices = []
            for stripe_invoice in stripe_invoices.data:
                invoice = await self._convert_stripe_invoice(stripe_invoice)
                invoices.append(invoice)

            return invoices

        except stripe.error.StripeError as e:
            logger.error(f"Error listing invoices for customer {customer_id}: {e}")
            return []

    async def _convert_stripe_invoice(self, stripe_invoice: Any) -> Invoice:
        """Convert Stripe invoice to our model"""
        try:
            # Convert line items
            line_items = []
            for item in stripe_invoice.lines.data:
                line_item = InvoiceLineItem(
                    description=item.description or "",
                    quantity=item.quantity,
                    unit_amount=Decimal(str(item.amount / 100)),
                    amount=Decimal(str(item.amount / 100)),
                    period_start=datetime.fromtimestamp(item.period.start) if item.period else None,
                    period_end=datetime.fromtimestamp(item.period.end) if item.period else None,
                    prorated=item.proration,
                    metadata=dict(item.metadata) if item.metadata else {}
                )
                line_items.append(line_item)

            return Invoice(
                stripe_invoice_id=stripe_invoice.id,
                user_id=stripe_invoice.metadata.get("user_id", ""),
                customer_id=stripe_invoice.customer,
                subscription_id=stripe_invoice.subscription,
                invoice_number=stripe_invoice.number or "",
                amount_due=Decimal(str(stripe_invoice.amount_due / 100)),
                amount_paid=Decimal(str(stripe_invoice.amount_paid / 100)),
                amount_remaining=Decimal(str(stripe_invoice.amount_remaining / 100)),
                currency=CurrencyCode(stripe_invoice.currency),
                status=stripe_invoice.status,
                paid=stripe_invoice.paid,
                created_at=datetime.fromtimestamp(stripe_invoice.created),
                due_date=datetime.fromtimestamp(stripe_invoice.due_date) if stripe_invoice.due_date else None,
                paid_at=datetime.fromtimestamp(stripe_invoice.status_transitions.paid_at) if stripe_invoice.status_transitions.paid_at else None,
                line_items=line_items,
                tax_amount=Decimal(str(stripe_invoice.tax / 100)) if stripe_invoice.tax else Decimal('0'),
                hosted_invoice_url=stripe_invoice.hosted_invoice_url,
                invoice_pdf_url=stripe_invoice.invoice_pdf
            )

        except Exception as e:
            logger.error(f"Error converting Stripe invoice: {e}")
            raise


class StripePaymentService:
    """Main Stripe payment service integrating all components"""

    def __init__(self, config: StripeConfiguration):
        self.config = config
        self.customer_service = StripeCustomerService(config)
        self.payment_method_service = StripePaymentMethodService(config)
        self.subscription_service = StripeSubscriptionService(config)
        self.invoice_service = StripeInvoiceService(config)

    async def initialize_customer_for_user(
        self,
        user_id: str,
        email: str,
        name: str
    ) -> CustomerProfile:
        """Initialize complete customer setup for new user"""
        try:
            # Create customer
            customer_profile = await self.customer_service.create_customer(
                user_id=user_id,
                email=email,
                name=name,
                metadata={"platform": "turtletrading"}
            )

            logger.info(f"Initialized customer for user {user_id}")
            return customer_profile

        except Exception as e:
            logger.error(f"Error initializing customer for user {user_id}: {e}")
            raise

    async def create_subscription_with_trial(
        self,
        customer_id: str,
        plan: SubscriptionPlan,
        billing_interval: BillingInterval,
        payment_method_id: Optional[str] = None
    ) -> UserSubscription:
        """Create subscription with trial if applicable"""
        try:
            # Get the appropriate price ID
            price_id = self._get_price_id_for_plan(plan, billing_interval)
            if not price_id:
                raise ValueError(f"No price ID found for plan {plan.plan_id} with interval {billing_interval}")

            # Create subscription
            subscription = await self.subscription_service.create_subscription(
                customer_id=customer_id,
                price_id=price_id,
                payment_method_id=payment_method_id,
                trial_period_days=plan.trial_period_days if plan.trial_period_days > 0 else None,
                metadata={
                    "plan_id": plan.plan_id,
                    "tier": plan.tier.value,
                    "billing_interval": billing_interval.value
                }
            )

            return subscription

        except Exception as e:
            logger.error(f"Error creating subscription with trial: {e}")
            raise

    def _get_price_id_for_plan(
        self,
        plan: SubscriptionPlan,
        billing_interval: BillingInterval
    ) -> Optional[str]:
        """Get Stripe price ID for plan and billing interval"""
        mapping = {
            BillingInterval.MONTHLY: plan.stripe_price_id_monthly,
            BillingInterval.QUARTERLY: plan.stripe_price_id_quarterly,
            BillingInterval.YEARLY: plan.stripe_price_id_yearly
        }
        return mapping.get(billing_interval)

    async def handle_failed_payment(
        self,
        subscription_id: str,
        invoice_id: str,
        error_message: str
    ) -> Dict[str, Any]:
        """Handle failed payment scenarios"""
        try:
            # Get subscription details
            subscription = await self.subscription_service.get_subscription(subscription_id)
            if not subscription:
                return {"success": False, "error": "Subscription not found"}

            # Retry payment if appropriate
            retry_result = await self._retry_payment(invoice_id)

            if not retry_result["success"]:
                # If retry fails, handle dunning management
                await self._handle_dunning_management(subscription, error_message)

            return retry_result

        except Exception as e:
            logger.error(f"Error handling failed payment: {e}")
            return {"success": False, "error": str(e)}

    async def _retry_payment(self, invoice_id: str) -> Dict[str, Any]:
        """Retry payment for an invoice"""
        try:
            # Attempt to pay the invoice again
            payment_transaction = await self.invoice_service.pay_invoice(invoice_id)

            return {
                "success": payment_transaction.status == PaymentStatus.SUCCEEDED,
                "payment_transaction": payment_transaction
            }

        except Exception as e:
            logger.error(f"Error retrying payment for invoice {invoice_id}: {e}")
            return {"success": False, "error": str(e)}

    async def _handle_dunning_management(
        self,
        subscription: UserSubscription,
        error_message: str
    ):
        """Handle dunning management for failed payments"""
        try:
            # Implement dunning logic here
            # This could include:
            # - Sending email notifications
            # - Temporarily suspending service
            # - Scheduling retry attempts
            # - Eventually canceling subscription

            logger.info(f"Handling dunning for subscription {subscription.subscription_id}")

            # For now, just log the failure
            # In production, you would implement sophisticated dunning management

        except Exception as e:
            logger.error(f"Error in dunning management: {e}")

    async def calculate_proration_amount(
        self,
        subscription_id: str,
        new_price_id: str,
        proration_date: Optional[datetime] = None
    ) -> Decimal:
        """Calculate proration amount for subscription change"""
        try:
            proration_timestamp = int(proration_date.timestamp()) if proration_date else None

            # Use Stripe's upcoming invoice to calculate proration
            upcoming_invoice = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Invoice.upcoming(
                    subscription=subscription_id,
                    subscription_items=[{
                        "id": subscription_id,  # This would be the subscription item ID
                        "price": new_price_id
                    }],
                    proration_date=proration_timestamp
                )
            )

            return Decimal(str(upcoming_invoice.amount_due / 100))

        except stripe.error.StripeError as e:
            logger.error(f"Error calculating proration: {e}")
            return Decimal('0')

    async def get_payment_methods_for_customer(
        self,
        customer_id: str
    ) -> List[Dict[str, Any]]:
        """Get all payment methods for a customer"""
        try:
            return await self.payment_method_service.list_payment_methods(customer_id)
        except Exception as e:
            logger.error(f"Error getting payment methods for customer {customer_id}: {e}")
            return []

    async def health_check(self) -> Dict[str, Any]:
        """Health check for Stripe integration"""
        try:
            # Test Stripe API connectivity
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Account.retrieve()
            )

            return {
                "status": "healthy",
                "stripe_connected": True,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Stripe health check failed: {e}")
            return {
                "status": "unhealthy",
                "stripe_connected": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }