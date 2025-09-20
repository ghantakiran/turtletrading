"""
Email Notification Service for TurtleTrading Alerting System

This service handles email delivery for alerts with templates, rate limiting,
and delivery tracking. Supports both SMTP and async email delivery.
"""

import asyncio
import smtplib
import ssl
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict, List, Optional, Tuple, Any
import json
import logging
from pathlib import Path
import aiofiles
import redis.asyncio as redis
from jinja2 import Environment, FileSystemLoader, Template

from ..models.alert_models import (
    Alert, AlertRule, EmailConfig, EmailDelivery,
    EmailTemplate, DeliveryStatus, AlertSeverity,
    EmailDeliveryStats, EmailRateLimitConfig
)

logger = logging.getLogger(__name__)


class EmailTemplateEngine:
    """Handles email template rendering with Jinja2"""

    def __init__(self, template_dir: str = "templates/email"):
        self.template_dir = Path(template_dir)
        self.template_dir.mkdir(parents=True, exist_ok=True)
        self.env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=True
        )

    async def render_template(
        self,
        template_name: str,
        context: Dict[str, Any]
    ) -> Tuple[str, str]:
        """
        Render email template with context data

        Returns:
            Tuple of (subject, html_body)
        """
        try:
            template = self.env.get_template(f"{template_name}.html")
            html_content = template.render(**context)

            # Extract subject from template or use default
            subject_template = self.env.get_template(f"{template_name}_subject.txt")
            subject = subject_template.render(**context).strip()

            return subject, html_content

        except Exception as e:
            logger.error(f"Template rendering failed for {template_name}: {e}")
            # Fallback to basic template
            return await self._render_fallback_template(context)

    async def _render_fallback_template(self, context: Dict[str, Any]) -> Tuple[str, str]:
        """Fallback email template when primary template fails"""
        alert = context.get('alert', {})
        symbol = context.get('symbol', 'N/A')

        subject = f"TurtleTrading Alert: {alert.get('title', 'Alert Triggered')}"

        html_body = f"""
        <html>
        <body>
            <h2>TurtleTrading Alert</h2>
            <p><strong>Symbol:</strong> {symbol}</p>
            <p><strong>Alert:</strong> {alert.get('title', 'Alert Triggered')}</p>
            <p><strong>Message:</strong> {alert.get('message', 'No details available')}</p>
            <p><strong>Time:</strong> {alert.get('timestamp', datetime.utcnow().isoformat())}</p>
            <p><strong>Severity:</strong> {alert.get('severity', 'INFO')}</p>
            <hr>
            <p><small>This is an automated alert from TurtleTrading platform.</small></p>
        </body>
        </html>
        """

        return subject, html_body


class EmailRateLimiter:
    """Rate limiting for email notifications"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def check_rate_limit(
        self,
        user_id: str,
        email_config: EmailRateLimitConfig
    ) -> Tuple[bool, int]:
        """
        Check if email sending is within rate limits

        Returns:
            Tuple of (is_allowed, remaining_count)
        """
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=email_config.window_minutes)

        # User-level rate limiting
        user_key = f"email_rate_limit:user:{user_id}"
        user_count = await self._get_request_count(user_key, window_start)

        if user_count >= email_config.max_per_user_per_window:
            return False, 0

        # Global rate limiting
        global_key = f"email_rate_limit:global"
        global_count = await self._get_request_count(global_key, window_start)

        if global_count >= email_config.max_global_per_window:
            return False, 0

        return True, email_config.max_per_user_per_window - user_count

    async def record_email_sent(self, user_id: str):
        """Record that an email was sent for rate limiting"""
        now = datetime.utcnow()
        timestamp = int(now.timestamp())

        # Record for user
        user_key = f"email_rate_limit:user:{user_id}"
        await self.redis.zadd(user_key, {str(timestamp): timestamp})
        await self.redis.expire(user_key, 3600)  # 1 hour TTL

        # Record globally
        global_key = f"email_rate_limit:global"
        await self.redis.zadd(global_key, {f"{user_id}:{timestamp}": timestamp})
        await self.redis.expire(global_key, 3600)  # 1 hour TTL

    async def _get_request_count(self, key: str, window_start: datetime) -> int:
        """Get count of requests within time window"""
        window_start_timestamp = int(window_start.timestamp())
        count = await self.redis.zcount(key, window_start_timestamp, "+inf")
        return count


class EmailNotificationService:
    """Main email notification service for alerts"""

    def __init__(
        self,
        smtp_config: Dict[str, Any],
        redis_client: redis.Redis,
        template_dir: str = "templates/email"
    ):
        self.smtp_config = smtp_config
        self.redis = redis_client
        self.template_engine = EmailTemplateEngine(template_dir)
        self.rate_limiter = EmailRateLimiter(redis_client)

        # Email delivery stats
        self.stats = EmailDeliveryStats()

    async def send_alert_email(
        self,
        alert: Alert,
        rule: AlertRule,
        email_config: EmailConfig
    ) -> bool:
        """
        Send alert email with proper rate limiting and error handling

        Returns:
            bool: True if email was sent successfully
        """
        try:
            # Check rate limits
            is_allowed, remaining = await self.rate_limiter.check_rate_limit(
                rule.user_id, email_config.rate_limit
            )

            if not is_allowed:
                logger.warning(f"Email rate limit exceeded for user {rule.user_id}")
                await self._record_delivery_failure(
                    alert, email_config, "Rate limit exceeded"
                )
                return False

            # Create email delivery record
            delivery = EmailDelivery(
                delivery_id=f"email_{alert.alert_id}_{int(datetime.utcnow().timestamp())}",
                alert_id=alert.alert_id,
                rule_id=rule.rule_id,
                user_id=rule.user_id,
                recipient=email_config.recipient,
                status=DeliveryStatus.PENDING,
                created_at=datetime.utcnow()
            )

            # Prepare email content
            success = await self._send_email_with_retries(
                alert, rule, email_config, delivery
            )

            if success:
                await self.rate_limiter.record_email_sent(rule.user_id)
                self.stats.total_sent += 1
                self.stats.last_sent = datetime.utcnow()
            else:
                self.stats.total_failed += 1

            return success

        except Exception as e:
            logger.error(f"Email sending failed for alert {alert.alert_id}: {e}")
            await self._record_delivery_failure(alert, email_config, str(e))
            return False

    async def _send_email_with_retries(
        self,
        alert: Alert,
        rule: AlertRule,
        email_config: EmailConfig,
        delivery: EmailDelivery
    ) -> bool:
        """Send email with retry logic"""
        max_retries = email_config.max_retries or 3
        base_delay = 1.0

        for attempt in range(max_retries + 1):
            try:
                success = await self._send_single_email(
                    alert, rule, email_config, delivery
                )

                if success:
                    delivery.status = DeliveryStatus.DELIVERED
                    delivery.delivered_at = datetime.utcnow()
                    await self._save_delivery_record(delivery)
                    return True

            except Exception as e:
                logger.warning(f"Email delivery attempt {attempt + 1} failed: {e}")
                delivery.attempts.append({
                    "attempt": attempt + 1,
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": str(e)
                })

                if attempt < max_retries:
                    # Exponential backoff
                    delay = base_delay * (2 ** attempt)
                    await asyncio.sleep(delay)
                else:
                    # Final failure
                    delivery.status = DeliveryStatus.FAILED
                    delivery.failure_reason = str(e)
                    await self._save_delivery_record(delivery)

        return False

    async def _send_single_email(
        self,
        alert: Alert,
        rule: AlertRule,
        email_config: EmailConfig,
        delivery: EmailDelivery
    ) -> bool:
        """Send a single email attempt"""
        # Prepare template context
        context = {
            "alert": {
                "title": alert.title,
                "message": alert.message,
                "severity": alert.severity.value,
                "timestamp": alert.timestamp.isoformat(),
                "alert_id": alert.alert_id
            },
            "rule": {
                "name": rule.name,
                "rule_id": rule.rule_id
            },
            "symbol": alert.symbol,
            "user_id": rule.user_id,
            "platform_url": self.smtp_config.get("platform_url", "https://turtletrading.com")
        }

        # Render email template
        template_name = email_config.template or "default_alert"
        subject, html_body = await self.template_engine.render_template(
            template_name, context
        )

        # Create email message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = self.smtp_config['from_email']
        msg['To'] = email_config.recipient
        msg['Reply-To'] = self.smtp_config.get('reply_to', self.smtp_config['from_email'])

        # Add custom headers
        msg['X-Alert-ID'] = alert.alert_id
        msg['X-Rule-ID'] = rule.rule_id
        msg['X-Delivery-ID'] = delivery.delivery_id

        # Add HTML content
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)

        # Send email via SMTP
        return await self._send_via_smtp(msg, email_config.recipient)

    async def _send_via_smtp(self, msg: MIMEMultipart, recipient: str) -> bool:
        """Send email via SMTP server"""
        try:
            # Use asyncio to run SMTP in thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None, self._send_smtp_sync, msg, recipient
            )
        except Exception as e:
            logger.error(f"SMTP sending failed: {e}")
            return False

    def _send_smtp_sync(self, msg: MIMEMultipart, recipient: str) -> bool:
        """Synchronous SMTP sending"""
        try:
            context = ssl.create_default_context()

            with smtplib.SMTP(
                self.smtp_config['host'],
                self.smtp_config['port']
            ) as server:
                if self.smtp_config.get('use_tls', True):
                    server.starttls(context=context)

                if self.smtp_config.get('username') and self.smtp_config.get('password'):
                    server.login(
                        self.smtp_config['username'],
                        self.smtp_config['password']
                    )

                text = msg.as_string()
                server.sendmail(
                    self.smtp_config['from_email'],
                    recipient,
                    text
                )

            logger.info(f"Email sent successfully to {recipient}")
            return True

        except Exception as e:
            logger.error(f"SMTP error: {e}")
            return False

    async def _save_delivery_record(self, delivery: EmailDelivery):
        """Save email delivery record to Redis"""
        try:
            key = f"email_delivery:{delivery.delivery_id}"
            data = delivery.dict()

            # Convert datetime objects to ISO strings
            for field in ['created_at', 'delivered_at']:
                if hasattr(delivery, field) and getattr(delivery, field):
                    data[field] = getattr(delivery, field).isoformat()

            await self.redis.setex(
                key,
                86400 * 7,  # 7 days TTL
                json.dumps(data, default=str)
            )

        except Exception as e:
            logger.error(f"Failed to save delivery record: {e}")

    async def _record_delivery_failure(
        self,
        alert: Alert,
        email_config: EmailConfig,
        reason: str
    ):
        """Record delivery failure"""
        delivery = EmailDelivery(
            delivery_id=f"email_failed_{alert.alert_id}_{int(datetime.utcnow().timestamp())}",
            alert_id=alert.alert_id,
            rule_id=alert.rule_id or "",
            user_id=alert.user_id or "",
            recipient=email_config.recipient,
            status=DeliveryStatus.FAILED,
            failure_reason=reason,
            created_at=datetime.utcnow()
        )

        await self._save_delivery_record(delivery)

    async def get_delivery_stats(self, user_id: Optional[str] = None) -> EmailDeliveryStats:
        """Get email delivery statistics"""
        if user_id:
            # Get user-specific stats
            pattern = f"email_delivery:*"
            keys = await self.redis.keys(pattern)

            user_stats = EmailDeliveryStats()

            for key in keys:
                try:
                    data = await self.redis.get(key)
                    if data:
                        delivery_data = json.loads(data)
                        if delivery_data.get('user_id') == user_id:
                            if delivery_data.get('status') == 'delivered':
                                user_stats.total_sent += 1
                            else:
                                user_stats.total_failed += 1

                except Exception as e:
                    logger.warning(f"Failed to parse delivery record {key}: {e}")

            return user_stats

        return self.stats

    async def cleanup_old_records(self, days_old: int = 30):
        """Clean up old delivery records"""
        try:
            pattern = "email_delivery:*"
            keys = await self.redis.keys(pattern)

            cutoff_date = datetime.utcnow() - timedelta(days=days_old)

            for key in keys:
                try:
                    data = await self.redis.get(key)
                    if data:
                        delivery_data = json.loads(data)
                        created_at = datetime.fromisoformat(
                            delivery_data.get('created_at', '')
                        )

                        if created_at < cutoff_date:
                            await self.redis.delete(key)

                except Exception as e:
                    logger.warning(f"Failed to process record {key} for cleanup: {e}")

            logger.info(f"Cleaned up email delivery records older than {days_old} days")

        except Exception as e:
            logger.error(f"Email cleanup failed: {e}")


async def create_default_email_templates(template_dir: str = "templates/email"):
    """Create default email templates for alerts"""
    template_path = Path(template_dir)
    template_path.mkdir(parents=True, exist_ok=True)

    # Default alert template
    default_template = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f8fafc; }
        .alert-box { border-left: 4px solid #ef4444; padding: 15px; background: white; margin: 15px 0; }
        .alert-box.info { border-left-color: #3b82f6; }
        .alert-box.warning { border-left-color: #f59e0b; }
        .alert-box.critical { border-left-color: #dc2626; }
        .footer { padding: 15px; text-align: center; color: #6b7280; font-size: 12px; }
        .button { display: inline-block; padding: 10px 20px; background: #1e40af; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐢 TurtleTrading Alert</h1>
        </div>

        <div class="content">
            <div class="alert-box {{ alert.severity|lower }}">
                <h2>{{ alert.title }}</h2>
                <p><strong>Symbol:</strong> {{ symbol or 'N/A' }}</p>
                <p><strong>Message:</strong> {{ alert.message }}</p>
                <p><strong>Time:</strong> {{ alert.timestamp }}</p>
                <p><strong>Severity:</strong> {{ alert.severity }}</p>
                <p><strong>Alert ID:</strong> {{ alert.alert_id }}</p>
            </div>

            <p>This alert was triggered by rule: <strong>{{ rule.name }}</strong></p>

            <p style="text-align: center;">
                <a href="{{ platform_url }}/alerts/{{ alert.alert_id }}" class="button">
                    View Alert Details
                </a>
            </p>
        </div>

        <div class="footer">
            <p>This is an automated alert from TurtleTrading AI-powered trading platform.</p>
            <p>If you no longer wish to receive these alerts, please update your notification preferences.</p>
        </div>
    </div>
</body>
</html>
    """

    # Default subject template
    default_subject = "🚨 TurtleTrading Alert: {{ alert.title }} - {{ symbol or 'Market' }}"

    async with aiofiles.open(template_path / "default_alert.html", "w") as f:
        await f.write(default_template.strip())

    async with aiofiles.open(template_path / "default_alert_subject.txt", "w") as f:
        await f.write(default_subject.strip())

    logger.info(f"Created default email templates in {template_path}")