"""
Alerting and Notification Models

Comprehensive data structures for alerts, webhooks, notifications,
and alert rule management.
"""

from pydantic import BaseModel, Field, validator, HttpUrl
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, time
from decimal import Decimal
from enum import Enum
import json


class AlertType(str, Enum):
    """Types of alerts in the system"""
    PRICE = "price"
    VOLUME = "volume"
    TECHNICAL = "technical"
    FUNDAMENTAL = "fundamental"
    NEWS = "news"
    RISK = "risk"
    PORTFOLIO = "portfolio"
    SCANNER = "scanner"
    SYSTEM = "system"
    CUSTOM = "custom"


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertStatus(str, Enum):
    """Alert processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    SENT = "sent"
    FAILED = "failed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class NotificationChannel(str, Enum):
    """Available notification channels"""
    EMAIL = "email"
    SMS = "sms"
    WEBHOOK = "webhook"
    PUSH = "push"
    WEBSOCKET = "websocket"
    SLACK = "slack"
    DISCORD = "discord"
    TELEGRAM = "telegram"


class ComparisonOperator(str, Enum):
    """Comparison operators for alert conditions"""
    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    GREATER_THAN_OR_EQUAL = ">="
    LESS_THAN = "<"
    LESS_THAN_OR_EQUAL = "<="
    BETWEEN = "between"
    NOT_BETWEEN = "not_between"
    CROSSES_ABOVE = "crosses_above"
    CROSSES_BELOW = "crosses_below"
    PERCENT_CHANGE = "percent_change"
    MOVING_AVERAGE = "moving_average"


class AlertFrequency(str, Enum):
    """Alert frequency settings"""
    ONCE = "once"
    EVERY_TRIGGER = "every_trigger"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class WebhookMethod(str, Enum):
    """HTTP methods for webhooks"""
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"


# Core Alert Models

class AlertCondition(BaseModel):
    """Individual alert condition"""
    field: str = Field(..., description="Field to monitor (e.g., 'price', 'volume', 'rsi')")
    operator: ComparisonOperator = Field(..., description="Comparison operator")
    value: Union[Decimal, str, List[Union[Decimal, str]]] = Field(..., description="Threshold value(s)")

    # Advanced condition parameters
    timeframe: Optional[str] = Field(None, description="Timeframe for condition (e.g., '1m', '5m', '1h')")
    lookback_periods: Optional[int] = Field(None, description="Number of periods to look back")
    percentage: Optional[bool] = Field(False, description="Whether value is a percentage")

    # Condition metadata
    description: Optional[str] = Field(None, description="Human-readable condition description")
    weight: Decimal = Field(Decimal(1.0), description="Weight of this condition in composite alerts")

    @validator('value')
    def validate_value(cls, v, values):
        operator = values.get('operator')
        if operator in [ComparisonOperator.BETWEEN, ComparisonOperator.NOT_BETWEEN]:
            if not isinstance(v, list) or len(v) != 2:
                raise ValueError(f"Operator {operator} requires exactly 2 values")
        return v


class AlertRule(BaseModel):
    """Alert rule definition"""
    rule_id: str = Field(..., description="Unique rule identifier")
    user_id: str = Field(..., description="User who created the rule")
    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(None, description="Rule description")

    # Alert configuration
    alert_type: AlertType = Field(..., description="Type of alert")
    severity: AlertSeverity = Field(AlertSeverity.MEDIUM, description="Alert severity")

    # Target specification
    symbol: Optional[str] = Field(None, description="Target symbol (if applicable)")
    symbols: Optional[List[str]] = Field(None, description="Multiple target symbols")
    portfolio_id: Optional[str] = Field(None, description="Target portfolio ID")

    # Conditions
    conditions: List[AlertCondition] = Field(..., description="Alert conditions", min_items=1)
    condition_logic: str = Field("AND", description="Logic operator for multiple conditions (AND/OR)")

    # Notification settings
    channels: List[NotificationChannel] = Field(..., description="Notification channels")
    frequency: AlertFrequency = Field(AlertFrequency.ONCE, description="Alert frequency")

    # Delivery configuration
    email_addresses: Optional[List[str]] = Field(None, description="Email recipients")
    phone_numbers: Optional[List[str]] = Field(None, description="SMS recipients")
    webhook_urls: Optional[List[str]] = Field(None, description="Webhook URLs")
    slack_channels: Optional[List[str]] = Field(None, description="Slack channels")

    # Scheduling
    active: bool = Field(True, description="Whether rule is active")
    start_time: Optional[time] = Field(None, description="Daily start time")
    end_time: Optional[time] = Field(None, description="Daily end time")
    timezone: str = Field("UTC", description="Timezone for scheduling")
    days_of_week: Optional[List[int]] = Field(None, description="Days of week (0=Monday)")

    # Rate limiting
    cooldown_minutes: int = Field(0, description="Cooldown period between alerts")
    max_alerts_per_hour: int = Field(100, description="Maximum alerts per hour")
    max_alerts_per_day: int = Field(1000, description="Maximum alerts per day")

    # Expiration
    expires_at: Optional[datetime] = Field(None, description="Rule expiration timestamp")

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    last_triggered: Optional[datetime] = Field(None, description="Last trigger timestamp")
    trigger_count: int = Field(0, description="Total number of triggers")

    # Advanced features
    template_id: Optional[str] = Field(None, description="Alert template ID")
    tags: Optional[List[str]] = Field(None, description="Rule tags")
    priority: int = Field(1, description="Rule priority (1-10)")


class Alert(BaseModel):
    """Individual alert instance"""
    alert_id: str = Field(..., description="Unique alert identifier")
    rule_id: str = Field(..., description="Source rule ID")
    user_id: str = Field(..., description="Target user ID")

    # Alert details
    alert_type: AlertType = Field(..., description="Type of alert")
    severity: AlertSeverity = Field(..., description="Alert severity")
    title: str = Field(..., description="Alert title")
    message: str = Field(..., description="Alert message")

    # Context
    symbol: Optional[str] = Field(None, description="Related symbol")
    current_value: Optional[Union[Decimal, str]] = Field(None, description="Current value that triggered alert")
    threshold_value: Optional[Union[Decimal, str]] = Field(None, description="Threshold that was crossed")
    condition_met: str = Field(..., description="Description of condition that was met")

    # Data payload
    data: Dict[str, Any] = Field(default_factory=dict, description="Additional alert data")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Alert metadata")

    # Status tracking
    status: AlertStatus = Field(AlertStatus.PENDING, description="Alert processing status")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Alert creation time")
    expires_at: Optional[datetime] = Field(None, description="Alert expiration time")

    # Delivery tracking
    delivery_attempts: int = Field(0, description="Number of delivery attempts")
    delivered_channels: List[str] = Field(default_factory=list, description="Successfully delivered channels")
    failed_channels: List[str] = Field(default_factory=list, description="Failed delivery channels")

    # User interaction
    acknowledged: bool = Field(False, description="Whether alert was acknowledged")
    acknowledged_at: Optional[datetime] = Field(None, description="Acknowledgment timestamp")
    acknowledged_by: Optional[str] = Field(None, description="User who acknowledged")

    # Actions
    actions_taken: List[str] = Field(default_factory=list, description="Automated actions taken")
    action_results: Dict[str, Any] = Field(default_factory=dict, description="Results of automated actions")


# Webhook Models

class WebhookConfig(BaseModel):
    """Webhook configuration"""
    webhook_id: str = Field(..., description="Unique webhook identifier")
    user_id: str = Field(..., description="Webhook owner")
    name: str = Field(..., description="Webhook name")
    description: Optional[str] = Field(None, description="Webhook description")

    # Endpoint configuration
    url: HttpUrl = Field(..., description="Webhook URL")
    method: WebhookMethod = Field(WebhookMethod.POST, description="HTTP method")
    headers: Dict[str, str] = Field(default_factory=dict, description="Custom headers")

    # Authentication
    auth_type: Optional[str] = Field(None, description="Authentication type (bearer, basic, api_key)")
    auth_token: Optional[str] = Field(None, description="Authentication token/key")
    auth_username: Optional[str] = Field(None, description="Username for basic auth")
    auth_password: Optional[str] = Field(None, description="Password for basic auth")

    # Request configuration
    timeout_seconds: int = Field(30, description="Request timeout in seconds")
    retry_count: int = Field(3, description="Number of retry attempts")
    retry_delay_seconds: int = Field(5, description="Delay between retries")

    # Content configuration
    content_type: str = Field("application/json", description="Content-Type header")
    template: Optional[str] = Field(None, description="Custom payload template")
    include_signature: bool = Field(True, description="Include HMAC signature")
    secret_key: Optional[str] = Field(None, description="Secret key for signature")

    # Filtering
    alert_types: Optional[List[AlertType]] = Field(None, description="Filter by alert types")
    severities: Optional[List[AlertSeverity]] = Field(None, description="Filter by severities")
    symbols: Optional[List[str]] = Field(None, description="Filter by symbols")

    # Status
    active: bool = Field(True, description="Whether webhook is active")
    verified: bool = Field(False, description="Whether webhook URL is verified")

    # Statistics
    total_deliveries: int = Field(0, description="Total delivery attempts")
    successful_deliveries: int = Field(0, description="Successful deliveries")
    failed_deliveries: int = Field(0, description="Failed deliveries")
    last_delivery_at: Optional[datetime] = Field(None, description="Last delivery timestamp")
    last_success_at: Optional[datetime] = Field(None, description="Last successful delivery")

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")


class WebhookDelivery(BaseModel):
    """Webhook delivery attempt record"""
    delivery_id: str = Field(..., description="Unique delivery identifier")
    webhook_id: str = Field(..., description="Target webhook ID")
    alert_id: str = Field(..., description="Source alert ID")

    # Request details
    url: str = Field(..., description="Target URL")
    method: str = Field(..., description="HTTP method used")
    headers: Dict[str, str] = Field(..., description="Request headers sent")
    payload: Dict[str, Any] = Field(..., description="Request payload")

    # Response details
    status_code: Optional[int] = Field(None, description="HTTP response status code")
    response_headers: Optional[Dict[str, str]] = Field(None, description="Response headers")
    response_body: Optional[str] = Field(None, description="Response body")

    # Timing
    started_at: datetime = Field(default_factory=datetime.utcnow, description="Request start time")
    completed_at: Optional[datetime] = Field(None, description="Request completion time")
    duration_ms: Optional[int] = Field(None, description="Request duration in milliseconds")

    # Status
    success: bool = Field(False, description="Whether delivery was successful")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    retry_attempt: int = Field(1, description="Retry attempt number")

    # Security
    signature: Optional[str] = Field(None, description="HMAC signature sent")


# Notification Models

class EmailNotification(BaseModel):
    """Email notification configuration"""
    notification_id: str = Field(..., description="Unique notification identifier")
    alert_id: str = Field(..., description="Source alert ID")

    # Recipients
    to_addresses: List[str] = Field(..., description="Recipient email addresses")
    cc_addresses: Optional[List[str]] = Field(None, description="CC recipients")
    bcc_addresses: Optional[List[str]] = Field(None, description="BCC recipients")

    # Content
    subject: str = Field(..., description="Email subject")
    html_body: Optional[str] = Field(None, description="HTML email body")
    text_body: Optional[str] = Field(None, description="Plain text email body")

    # Configuration
    template_id: Optional[str] = Field(None, description="Email template ID")
    priority: str = Field("normal", description="Email priority (low, normal, high)")

    # Tracking
    sent_at: Optional[datetime] = Field(None, description="Send timestamp")
    delivered_at: Optional[datetime] = Field(None, description="Delivery timestamp")
    opened_at: Optional[datetime] = Field(None, description="First open timestamp")
    clicked_at: Optional[datetime] = Field(None, description="First click timestamp")

    # Status
    status: AlertStatus = Field(AlertStatus.PENDING, description="Delivery status")
    error_message: Optional[str] = Field(None, description="Error message if failed")

    # Provider details
    provider: str = Field("smtp", description="Email provider used")
    message_id: Optional[str] = Field(None, description="Provider message ID")


class SMSNotification(BaseModel):
    """SMS notification configuration"""
    notification_id: str = Field(..., description="Unique notification identifier")
    alert_id: str = Field(..., description="Source alert ID")

    # Recipients
    phone_numbers: List[str] = Field(..., description="Recipient phone numbers")

    # Content
    message: str = Field(..., description="SMS message content", max_length=1600)

    # Configuration
    template_id: Optional[str] = Field(None, description="SMS template ID")

    # Tracking
    sent_at: Optional[datetime] = Field(None, description="Send timestamp")
    delivered_at: Optional[datetime] = Field(None, description="Delivery timestamp")

    # Status
    status: AlertStatus = Field(AlertStatus.PENDING, description="Delivery status")
    error_message: Optional[str] = Field(None, description="Error message if failed")

    # Provider details
    provider: str = Field("twilio", description="SMS provider used")
    message_id: Optional[str] = Field(None, description="Provider message ID")
    cost: Optional[Decimal] = Field(None, description="Message cost")


class PushNotification(BaseModel):
    """Push notification configuration"""
    notification_id: str = Field(..., description="Unique notification identifier")
    alert_id: str = Field(..., description="Source alert ID")

    # Recipients
    device_tokens: List[str] = Field(..., description="Device tokens")
    user_ids: Optional[List[str]] = Field(None, description="User IDs for targeting")

    # Content
    title: str = Field(..., description="Notification title")
    body: str = Field(..., description="Notification body")
    icon: Optional[str] = Field(None, description="Notification icon URL")
    image: Optional[str] = Field(None, description="Notification image URL")

    # Configuration
    badge: Optional[int] = Field(None, description="Badge count")
    sound: Optional[str] = Field(None, description="Notification sound")
    category: Optional[str] = Field(None, description="Notification category")

    # Data
    data: Dict[str, Any] = Field(default_factory=dict, description="Custom data payload")

    # Actions
    actions: Optional[List[Dict[str, str]]] = Field(None, description="Notification actions")

    # Tracking
    sent_at: Optional[datetime] = Field(None, description="Send timestamp")
    delivered_at: Optional[datetime] = Field(None, description="Delivery timestamp")
    opened_at: Optional[datetime] = Field(None, description="Open timestamp")

    # Status
    status: AlertStatus = Field(AlertStatus.PENDING, description="Delivery status")
    error_message: Optional[str] = Field(None, description="Error message if failed")

    # Provider details
    provider: str = Field("fcm", description="Push provider used (fcm, apns)")


# Template Models

class AlertTemplate(BaseModel):
    """Alert message template"""
    template_id: str = Field(..., description="Unique template identifier")
    user_id: Optional[str] = Field(None, description="Template owner (None for system templates)")
    name: str = Field(..., description="Template name")
    description: Optional[str] = Field(None, description="Template description")

    # Template configuration
    alert_type: AlertType = Field(..., description="Alert type this template applies to")
    channel: NotificationChannel = Field(..., description="Notification channel")

    # Content templates
    title_template: str = Field(..., description="Title template with variables")
    message_template: str = Field(..., description="Message template with variables")

    # Channel-specific templates
    email_subject_template: Optional[str] = Field(None, description="Email subject template")
    email_html_template: Optional[str] = Field(None, description="Email HTML template")
    sms_template: Optional[str] = Field(None, description="SMS message template")
    webhook_template: Optional[str] = Field(None, description="Webhook payload template")

    # Variables
    variables: List[str] = Field(default_factory=list, description="Available template variables")

    # Formatting
    include_timestamp: bool = Field(True, description="Include timestamp in messages")
    timestamp_format: str = Field("%Y-%m-%d %H:%M:%S UTC", description="Timestamp format")
    currency_format: str = Field("USD", description="Currency format for monetary values")

    # Status
    active: bool = Field(True, description="Whether template is active")
    system_template: bool = Field(False, description="Whether this is a system template")

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    usage_count: int = Field(0, description="Number of times template was used")


# Analytics Models

class AlertAnalytics(BaseModel):
    """Alert analytics and statistics"""
    user_id: str = Field(..., description="User identifier")
    period_start: datetime = Field(..., description="Analytics period start")
    period_end: datetime = Field(..., description="Analytics period end")

    # Alert statistics
    total_alerts: int = Field(0, description="Total alerts generated")
    alerts_by_type: Dict[str, int] = Field(default_factory=dict, description="Alerts by type")
    alerts_by_severity: Dict[str, int] = Field(default_factory=dict, description="Alerts by severity")
    alerts_by_symbol: Dict[str, int] = Field(default_factory=dict, description="Alerts by symbol")

    # Delivery statistics
    total_deliveries: int = Field(0, description="Total delivery attempts")
    successful_deliveries: int = Field(0, description="Successful deliveries")
    failed_deliveries: int = Field(0, description="Failed deliveries")
    delivery_rate: Decimal = Field(Decimal(0), description="Delivery success rate")

    # Channel statistics
    deliveries_by_channel: Dict[str, int] = Field(default_factory=dict, description="Deliveries by channel")
    success_by_channel: Dict[str, int] = Field(default_factory=dict, description="Successes by channel")

    # Response statistics
    acknowledged_alerts: int = Field(0, description="Acknowledged alerts")
    acknowledgment_rate: Decimal = Field(Decimal(0), description="Acknowledgment rate")
    avg_acknowledgment_time: Optional[Decimal] = Field(None, description="Average acknowledgment time (minutes)")

    # Performance statistics
    avg_delivery_time: Optional[Decimal] = Field(None, description="Average delivery time (seconds)")
    fastest_delivery: Optional[Decimal] = Field(None, description="Fastest delivery time (seconds)")
    slowest_delivery: Optional[Decimal] = Field(None, description="Slowest delivery time (seconds)")

    # Rule statistics
    active_rules: int = Field(0, description="Number of active rules")
    triggered_rules: int = Field(0, description="Number of rules that triggered")
    most_triggered_rule: Optional[str] = Field(None, description="Most triggered rule ID")

    # Generated at
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Analytics generation timestamp")


# Rate Limiting Models

class AlertRateLimit(BaseModel):
    """Rate limiting configuration and tracking"""
    user_id: str = Field(..., description="User identifier")
    rule_id: Optional[str] = Field(None, description="Specific rule ID (if rule-level)")

    # Limits
    max_alerts_per_minute: int = Field(10, description="Maximum alerts per minute")
    max_alerts_per_hour: int = Field(100, description="Maximum alerts per hour")
    max_alerts_per_day: int = Field(1000, description="Maximum alerts per day")

    # Current counts
    alerts_this_minute: int = Field(0, description="Alerts sent this minute")
    alerts_this_hour: int = Field(0, description="Alerts sent this hour")
    alerts_this_day: int = Field(0, description="Alerts sent today")

    # Tracking
    last_alert_at: Optional[datetime] = Field(None, description="Last alert timestamp")
    last_reset_minute: Optional[datetime] = Field(None, description="Last minute counter reset")
    last_reset_hour: Optional[datetime] = Field(None, description="Last hour counter reset")
    last_reset_day: Optional[datetime] = Field(None, description="Last day counter reset")

    # Status
    rate_limited: bool = Field(False, description="Whether currently rate limited")
    rate_limit_until: Optional[datetime] = Field(None, description="Rate limit expiration")

    # Violations
    violations_count: int = Field(0, description="Number of rate limit violations")
    last_violation_at: Optional[datetime] = Field(None, description="Last violation timestamp")


# System Models

class AlertSystemConfig(BaseModel):
    """Global alert system configuration"""
    # Processing configuration
    max_concurrent_deliveries: int = Field(100, description="Maximum concurrent deliveries")
    delivery_timeout_seconds: int = Field(30, description="Delivery timeout")
    max_retry_attempts: int = Field(3, description="Maximum retry attempts")
    retry_backoff_seconds: int = Field(5, description="Retry backoff delay")

    # Queue configuration
    alert_queue_size: int = Field(10000, description="Alert queue size")
    priority_queue_enabled: bool = Field(True, description="Enable priority queue")
    batch_processing_enabled: bool = Field(True, description="Enable batch processing")
    batch_size: int = Field(50, description="Batch processing size")

    # Rate limiting
    global_rate_limit_enabled: bool = Field(True, description="Enable global rate limiting")
    max_alerts_per_second: int = Field(100, description="Global alerts per second limit")

    # Storage configuration
    alert_retention_days: int = Field(90, description="Alert retention period")
    delivery_log_retention_days: int = Field(30, description="Delivery log retention")
    analytics_retention_days: int = Field(365, description="Analytics retention period")

    # Feature flags
    webhook_delivery_enabled: bool = Field(True, description="Enable webhook delivery")
    email_delivery_enabled: bool = Field(True, description="Enable email delivery")
    sms_delivery_enabled: bool = Field(True, description="Enable SMS delivery")
    push_delivery_enabled: bool = Field(True, description="Enable push delivery")

    # Security
    require_webhook_signature: bool = Field(True, description="Require webhook signatures")
    allow_insecure_webhooks: bool = Field(False, description="Allow HTTP webhooks")
    max_webhook_redirects: int = Field(3, description="Maximum webhook redirects")

    # Monitoring
    health_check_interval_seconds: int = Field(60, description="Health check interval")
    metrics_collection_enabled: bool = Field(True, description="Enable metrics collection")

    # Updated timestamp
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")