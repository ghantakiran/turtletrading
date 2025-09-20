"""
Payment and Subscription Models for TurtleTrading Platform

Comprehensive data models for subscription management, payment processing,
usage tracking, and feature gating with Stripe integration.
"""

from enum import Enum
from datetime import datetime, date
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, validator
from decimal import Decimal


class PlanTier(str, Enum):
    """Subscription plan tiers"""
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class BillingInterval(str, Enum):
    """Billing frequency"""
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    LIFETIME = "lifetime"


class PaymentStatus(str, Enum):
    """Payment status"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"
    REFUNDED = "refunded"
    PARTIAL_REFUND = "partial_refund"


class SubscriptionStatus(str, Enum):
    """Subscription status"""
    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"
    INCOMPLETE = "incomplete"
    INCOMPLETE_EXPIRED = "incomplete_expired"
    PAUSED = "paused"


class UsageMetricType(str, Enum):
    """Types of usage metrics"""
    API_CALLS = "api_calls"
    NARRATIVES_GENERATED = "narratives_generated"
    ALERTS_SENT = "alerts_sent"
    PORTFOLIO_SYNC = "portfolio_sync"
    REAL_TIME_DATA = "real_time_data"
    ADVANCED_ANALYTICS = "advanced_analytics"
    BACKTESTS_RUN = "backtests_run"
    SYMBOLS_TRACKED = "symbols_tracked"
    WEBHOOKS_SENT = "webhooks_sent"
    STORAGE_GB = "storage_gb"


class FeatureFlag(str, Enum):
    """Feature flags for gating"""
    REAL_TIME_DATA = "real_time_data"
    ADVANCED_CHARTS = "advanced_charts"
    PORTFOLIO_ANALYTICS = "portfolio_analytics"
    CUSTOM_ALERTS = "custom_alerts"
    API_ACCESS = "api_access"
    WEBHOOK_INTEGRATIONS = "webhook_integrations"
    PRIORITY_SUPPORT = "priority_support"
    UNLIMITED_BACKTESTS = "unlimited_backtests"
    ADVANCED_SCREENER = "advanced_screener"
    INSTITUTION_DATA = "institution_data"
    WHITE_LABEL = "white_label"
    DEDICATED_ACCOUNT_MANAGER = "dedicated_account_manager"


class PaymentMethod(str, Enum):
    """Payment methods"""
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    BANK_TRANSFER = "bank_transfer"
    PAYPAL = "paypal"
    APPLE_PAY = "apple_pay"
    GOOGLE_PAY = "google_pay"


class CurrencyCode(str, Enum):
    """Supported currencies"""
    USD = "usd"
    EUR = "eur"
    GBP = "gbp"
    CAD = "cad"
    AUD = "aud"
    JPY = "jpy"


class ProrationMethod(str, Enum):
    """Proration calculation methods"""
    CREATE_PRORATIONS = "create_prorations"
    NONE = "none"
    ALWAYS_INVOICE = "always_invoice"


class TaxType(str, Enum):
    """Tax types"""
    VAT = "vat"
    GST = "gst"
    SALES_TAX = "sales_tax"
    NO_TAX = "no_tax"


class PlanFeatures(BaseModel):
    """Features included in a subscription plan"""
    # Core features
    real_time_data: bool = False
    advanced_charts: bool = False
    portfolio_analytics: bool = False
    custom_alerts: bool = False
    api_access: bool = False
    webhook_integrations: bool = False
    priority_support: bool = False

    # Usage limits
    max_api_calls_per_month: Optional[int] = None
    max_narratives_per_month: Optional[int] = None
    max_alerts_per_month: Optional[int] = None
    max_portfolios: Optional[int] = None
    max_symbols_tracked: Optional[int] = None
    max_backtests_per_month: Optional[int] = None

    # Advanced features
    unlimited_backtests: bool = False
    advanced_screener: bool = False
    institution_data: bool = False
    white_label: bool = False
    dedicated_account_manager: bool = False

    # Data retention
    data_retention_months: int = 12
    export_capabilities: bool = False

    # Support level
    support_response_time_hours: int = 72
    phone_support: bool = False

    # Customization
    custom_branding: bool = False
    custom_integrations: bool = False


class SubscriptionPlan(BaseModel):
    """Subscription plan definition"""
    plan_id: str
    name: str
    description: str
    tier: PlanTier

    # Pricing
    price_monthly: Decimal = Field(decimal_places=2)
    price_quarterly: Optional[Decimal] = Field(None, decimal_places=2)
    price_yearly: Optional[Decimal] = Field(None, decimal_places=2)
    price_lifetime: Optional[Decimal] = Field(None, decimal_places=2)
    currency: CurrencyCode = CurrencyCode.USD

    # Features
    features: PlanFeatures

    # Trial
    trial_period_days: int = 0

    # Stripe integration
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_quarterly: Optional[str] = None
    stripe_price_id_yearly: Optional[str] = None
    stripe_product_id: Optional[str] = None

    # Metadata
    is_active: bool = True
    is_popular: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('price_monthly', 'price_quarterly', 'price_yearly', 'price_lifetime')
    def validate_prices(cls, v):
        if v is not None and v < 0:
            raise ValueError('Price cannot be negative')
        return v


class UserSubscription(BaseModel):
    """User's active subscription"""
    subscription_id: str = Field(default_factory=lambda: f"sub_{datetime.utcnow().timestamp()}")
    user_id: str
    plan_id: str

    # Status
    status: SubscriptionStatus
    billing_interval: BillingInterval

    # Dates
    start_date: datetime
    current_period_start: datetime
    current_period_end: datetime
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    canceled_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    # Pricing
    amount: Decimal = Field(decimal_places=2)
    currency: CurrencyCode = CurrencyCode.USD

    # Stripe integration
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None

    # Trial
    is_trial: bool = False
    trial_days_remaining: Optional[int] = None

    # Proration
    proration_behavior: ProrationMethod = ProrationMethod.CREATE_PRORATIONS

    # Features (cached from plan)
    features: Optional[PlanFeatures] = None

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def is_active(self) -> bool:
        """Check if subscription is currently active"""
        return self.status in [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING
        ]

    @property
    def days_until_renewal(self) -> int:
        """Days until next billing cycle"""
        if self.current_period_end:
            delta = self.current_period_end - datetime.utcnow()
            return max(0, delta.days)
        return 0


class PaymentTransaction(BaseModel):
    """Payment transaction record"""
    transaction_id: str = Field(default_factory=lambda: f"txn_{datetime.utcnow().timestamp()}")
    user_id: str
    subscription_id: Optional[str] = None

    # Payment details
    amount: Decimal = Field(decimal_places=2)
    currency: CurrencyCode = CurrencyCode.USD
    payment_method: PaymentMethod
    status: PaymentStatus

    # Stripe details
    stripe_payment_intent_id: Optional[str] = None
    stripe_charge_id: Optional[str] = None
    stripe_invoice_id: Optional[str] = None

    # Transaction metadata
    description: str
    receipt_url: Optional[str] = None
    failure_reason: Optional[str] = None

    # Refund information
    refunded_amount: Decimal = Field(default=Decimal('0'), decimal_places=2)
    refund_reason: Optional[str] = None

    # Dates
    attempted_at: datetime = Field(default_factory=datetime.utcnow)
    succeeded_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None

    # Additional data
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UsageRecord(BaseModel):
    """Usage tracking record"""
    record_id: str = Field(default_factory=lambda: f"usage_{datetime.utcnow().timestamp()}")
    user_id: str
    subscription_id: Optional[str] = None

    # Metric details
    metric_type: UsageMetricType
    quantity: int
    unit_cost: Optional[Decimal] = Field(None, decimal_places=4)

    # Time information
    usage_date: date
    billing_period_start: date
    billing_period_end: date

    # Metadata
    description: Optional[str] = None
    resource_id: Optional[str] = None  # e.g., specific API endpoint, symbol, etc.
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Timestamps
    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class UsageLimit(BaseModel):
    """Usage limits for a plan/user"""
    limit_id: str = Field(default_factory=lambda: f"limit_{datetime.utcnow().timestamp()}")
    user_id: str
    subscription_id: Optional[str] = None

    # Limit details
    metric_type: UsageMetricType
    limit_value: int
    period_type: str = "monthly"  # monthly, daily, weekly

    # Current usage
    current_usage: int = 0
    reset_date: date

    # Enforcement
    enforce_limit: bool = True
    soft_limit_percentage: float = 0.8  # Warn at 80%

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def usage_percentage(self) -> float:
        """Current usage as percentage of limit"""
        if self.limit_value == 0:
            return 0.0
        return min(100.0, (self.current_usage / self.limit_value) * 100)

    @property
    def is_near_limit(self) -> bool:
        """Check if usage is near the soft limit"""
        return self.usage_percentage >= (self.soft_limit_percentage * 100)

    @property
    def is_over_limit(self) -> bool:
        """Check if usage has exceeded the limit"""
        return self.current_usage >= self.limit_value


class BillingAddress(BaseModel):
    """Billing address information"""
    line1: str
    line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str


class TaxInformation(BaseModel):
    """Tax information for billing"""
    tax_id: Optional[str] = None  # VAT number, etc.
    tax_type: TaxType = TaxType.NO_TAX
    tax_rate: Decimal = Field(default=Decimal('0'), decimal_places=4)
    tax_exempt: bool = False
    tax_exempt_reason: Optional[str] = None


class CustomerProfile(BaseModel):
    """Customer billing profile"""
    customer_id: str = Field(default_factory=lambda: f"cust_{datetime.utcnow().timestamp()}")
    user_id: str

    # Stripe customer
    stripe_customer_id: Optional[str] = None

    # Contact information
    email: str
    full_name: str
    company_name: Optional[str] = None
    phone: Optional[str] = None

    # Billing
    billing_address: Optional[BillingAddress] = None
    tax_information: Optional[TaxInformation] = None

    # Payment methods
    default_payment_method_id: Optional[str] = None

    # Preferences
    currency: CurrencyCode = CurrencyCode.USD
    email_receipts: bool = True
    email_marketing: bool = True

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Invoice(BaseModel):
    """Invoice record"""
    invoice_id: str = Field(default_factory=lambda: f"inv_{datetime.utcnow().timestamp()}")
    user_id: str
    customer_id: str
    subscription_id: Optional[str] = None

    # Invoice details
    invoice_number: str
    amount_due: Decimal = Field(decimal_places=2)
    amount_paid: Decimal = Field(default=Decimal('0'), decimal_places=2)
    amount_remaining: Decimal = Field(decimal_places=2)
    currency: CurrencyCode = CurrencyCode.USD

    # Status
    status: str  # draft, open, paid, void, uncollectible
    paid: bool = False

    # Dates
    created_at: datetime = Field(default_factory=datetime.utcnow)
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    # Stripe
    stripe_invoice_id: Optional[str] = None

    # Line items
    line_items: List['InvoiceLineItem'] = Field(default_factory=list)

    # Tax
    tax_amount: Decimal = Field(default=Decimal('0'), decimal_places=2)

    # URLs
    hosted_invoice_url: Optional[str] = None
    invoice_pdf_url: Optional[str] = None


class InvoiceLineItem(BaseModel):
    """Line item on an invoice"""
    item_id: str = Field(default_factory=lambda: f"item_{datetime.utcnow().timestamp()}")
    description: str
    quantity: int = 1
    unit_amount: Decimal = Field(decimal_places=2)
    amount: Decimal = Field(decimal_places=2)

    # Period
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

    # Proration
    prorated: bool = False

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CouponCode(BaseModel):
    """Discount coupon"""
    coupon_id: str = Field(default_factory=lambda: f"coupon_{datetime.utcnow().timestamp()}")
    code: str
    name: str

    # Discount
    percent_off: Optional[Decimal] = Field(None, decimal_places=2)
    amount_off: Optional[Decimal] = Field(None, decimal_places=2)
    currency: Optional[CurrencyCode] = None

    # Validity
    valid_from: datetime = Field(default_factory=datetime.utcnow)
    valid_until: Optional[datetime] = None
    max_redemptions: Optional[int] = None
    times_redeemed: int = 0

    # Restrictions
    minimum_amount: Optional[Decimal] = Field(None, decimal_places=2)
    applies_to_plans: List[str] = Field(default_factory=list)
    first_time_customers_only: bool = False

    # Status
    active: bool = True

    # Stripe
    stripe_coupon_id: Optional[str] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SubscriptionChange(BaseModel):
    """Record of subscription changes"""
    change_id: str = Field(default_factory=lambda: f"change_{datetime.utcnow().timestamp()}")
    user_id: str
    subscription_id: str

    # Change details
    change_type: str  # upgrade, downgrade, cancel, reactivate, pause
    from_plan_id: Optional[str] = None
    to_plan_id: Optional[str] = None
    from_interval: Optional[BillingInterval] = None
    to_interval: Optional[BillingInterval] = None

    # Financial impact
    proration_amount: Optional[Decimal] = Field(None, decimal_places=2)
    credit_amount: Optional[Decimal] = Field(None, decimal_places=2)

    # Timing
    effective_date: datetime
    reason: Optional[str] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PaymentAnalytics(BaseModel):
    """Payment analytics and metrics"""
    period_start: datetime
    period_end: datetime

    # Revenue metrics
    total_revenue: Decimal = Field(decimal_places=2)
    recurring_revenue: Decimal = Field(decimal_places=2)
    one_time_revenue: Decimal = Field(decimal_places=2)

    # Subscription metrics
    new_subscriptions: int = 0
    canceled_subscriptions: int = 0
    upgraded_subscriptions: int = 0
    downgraded_subscriptions: int = 0

    # Customer metrics
    new_customers: int = 0
    churned_customers: int = 0
    total_active_customers: int = 0

    # Plan distribution
    customers_by_plan: Dict[str, int] = Field(default_factory=dict)
    revenue_by_plan: Dict[str, Decimal] = Field(default_factory=dict)

    # Payment metrics
    successful_payments: int = 0
    failed_payments: int = 0
    payment_success_rate: float = 0.0

    # Usage metrics
    usage_by_metric: Dict[str, int] = Field(default_factory=dict)

    # Financial metrics
    average_revenue_per_user: Decimal = Field(decimal_places=2)
    monthly_recurring_revenue: Decimal = Field(decimal_places=2)
    annual_recurring_revenue: Decimal = Field(decimal_places=2)
    churn_rate: float = 0.0

    # Generated at
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class FeatureAccess(BaseModel):
    """Feature access control"""
    user_id: str
    feature: FeatureFlag
    has_access: bool
    reason: str  # plan_included, trial, addon, limited, blocked

    # Limits for metered features
    daily_limit: Optional[int] = None
    monthly_limit: Optional[int] = None
    current_daily_usage: int = 0
    current_monthly_usage: int = 0

    # Expiration
    expires_at: Optional[datetime] = None

    # Metadata
    checked_at: datetime = Field(default_factory=datetime.utcnow)


class WebhookEvent(BaseModel):
    """Webhook event from payment provider"""
    event_id: str
    provider: str = "stripe"
    event_type: str

    # Data
    data: Dict[str, Any]

    # Processing
    processed: bool = False
    processed_at: Optional[datetime] = None
    processing_error: Optional[str] = None
    retry_count: int = 0

    # Timestamps
    received_at: datetime = Field(default_factory=datetime.utcnow)
    provider_timestamp: Optional[datetime] = None


class CreditBalance(BaseModel):
    """User credit balance"""
    user_id: str
    balance: Decimal = Field(default=Decimal('0'), decimal_places=2)
    currency: CurrencyCode = CurrencyCode.USD

    # Expiration
    expires_at: Optional[datetime] = None

    # Source
    source: str  # refund, proration, bonus, gift

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SubscriptionAddon(BaseModel):
    """Add-on to a subscription"""
    addon_id: str = Field(default_factory=lambda: f"addon_{datetime.utcnow().timestamp()}")
    subscription_id: str
    name: str
    description: str

    # Pricing
    price: Decimal = Field(decimal_places=2)
    currency: CurrencyCode = CurrencyCode.USD
    billing_interval: BillingInterval

    # Features
    features: Dict[str, Any] = Field(default_factory=dict)

    # Status
    active: bool = True

    # Dates
    added_at: datetime = Field(default_factory=datetime.utcnow)
    removed_at: Optional[datetime] = None


# Update Invoice model to include line items properly
Invoice.model_rebuild()