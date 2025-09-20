"""
SMS and Push Notification Service for TurtleTrading Alerting System

Handles SMS delivery via Twilio and push notifications via Firebase/APNs
with rate limiting, delivery tracking, and template support.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union
import aiohttp
import redis.asyncio as redis
from twilio.rest import Client as TwilioClient
from firebase_admin import messaging, credentials, initialize_app
import apple_push_notifications as apns

from ..models.alert_models import (
    Alert, AlertRule, SMSConfig, PushConfig, NotificationDelivery,
    DeliveryStatus, AlertSeverity, SMSTemplate, PushTemplate,
    SMSDeliveryStats, PushDeliveryStats, MobileRateLimitConfig
)

logger = logging.getLogger(__name__)


class SMSTemplateEngine:
    """Handles SMS message templating with character limits"""

    MAX_SMS_LENGTH = 160
    MAX_CONCATENATED_SMS = 1600  # 10 SMS parts

    def __init__(self):
        self.templates = {
            "default": "🐢 TurtleTrading Alert: {title} - {symbol} at {timestamp}",
            "price_alert": "📈 {symbol}: ${price} ({change}%) - {message}",
            "technical_alert": "📊 {symbol}: {indicator} signal - {message}",
            "critical_alert": "🚨 CRITICAL: {symbol} - {message}"
        }

    def render_sms(
        self,
        template_name: str,
        context: Dict[str, Any],
        max_length: Optional[int] = None
    ) -> str:
        """
        Render SMS message with character limit handling

        Args:
            template_name: Template identifier
            context: Template context data
            max_length: Maximum message length (default: 160)

        Returns:
            Formatted SMS message
        """
        max_len = max_length or self.MAX_SMS_LENGTH
        template = self.templates.get(template_name, self.templates["default"])

        try:
            message = template.format(**context)

            # Truncate if too long
            if len(message) > max_len:
                message = message[:max_len - 3] + "..."

            return message

        except KeyError as e:
            logger.warning(f"Missing template variable {e}, using fallback")
            return self._render_fallback_sms(context, max_len)

    def _render_fallback_sms(self, context: Dict[str, Any], max_length: int) -> str:
        """Fallback SMS template"""
        alert = context.get('alert', {})
        symbol = context.get('symbol', 'N/A')

        message = f"Alert: {alert.get('title', 'Trading Alert')} - {symbol}"

        if len(message) > max_length:
            message = message[:max_length - 3] + "..."

        return message


class PushTemplateEngine:
    """Handles push notification templating"""

    def __init__(self):
        self.templates = {
            "default": {
                "title": "TurtleTrading Alert",
                "body": "{alert_title} - {symbol}",
                "data": {
                    "alert_id": "{alert_id}",
                    "symbol": "{symbol}",
                    "type": "alert"
                }
            },
            "price_alert": {
                "title": "Price Alert: {symbol}",
                "body": "${price} ({change}%) - {message}",
                "data": {
                    "alert_id": "{alert_id}",
                    "symbol": "{symbol}",
                    "price": "{price}",
                    "type": "price_alert"
                }
            },
            "critical_alert": {
                "title": "🚨 Critical Alert",
                "body": "{symbol}: {message}",
                "data": {
                    "alert_id": "{alert_id}",
                    "symbol": "{symbol}",
                    "type": "critical_alert",
                    "priority": "high"
                }
            }
        }

    def render_push_notification(
        self,
        template_name: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Render push notification payload

        Returns:
            Dictionary with title, body, and data fields
        """
        template = self.templates.get(template_name, self.templates["default"])

        try:
            notification = {}

            # Render title
            notification["title"] = template["title"].format(**context)

            # Render body
            notification["body"] = template["body"].format(**context)

            # Render data payload
            notification["data"] = {}
            for key, value in template["data"].items():
                if isinstance(value, str) and "{" in value:
                    notification["data"][key] = value.format(**context)
                else:
                    notification["data"][key] = value

            return notification

        except KeyError as e:
            logger.warning(f"Missing push template variable {e}, using fallback")
            return self._render_fallback_push(context)

    def _render_fallback_push(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback push notification template"""
        alert = context.get('alert', {})
        symbol = context.get('symbol', 'N/A')

        return {
            "title": "TurtleTrading Alert",
            "body": f"{alert.get('title', 'Trading Alert')} - {symbol}",
            "data": {
                "alert_id": alert.get('alert_id', ''),
                "symbol": symbol,
                "type": "alert"
            }
        }


class MobileRateLimiter:
    """Rate limiting for SMS and push notifications"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def check_sms_rate_limit(
        self,
        user_id: str,
        phone_number: str,
        config: MobileRateLimitConfig
    ) -> Tuple[bool, int]:
        """Check SMS rate limits"""
        return await self._check_rate_limit(
            f"sms_rate_limit:user:{user_id}",
            f"sms_rate_limit:phone:{phone_number}",
            config.sms_per_hour,
            config.sms_per_day,
            "SMS"
        )

    async def check_push_rate_limit(
        self,
        user_id: str,
        device_token: str,
        config: MobileRateLimitConfig
    ) -> Tuple[bool, int]:
        """Check push notification rate limits"""
        return await self._check_rate_limit(
            f"push_rate_limit:user:{user_id}",
            f"push_rate_limit:device:{device_token}",
            config.push_per_hour,
            config.push_per_day,
            "Push"
        )

    async def _check_rate_limit(
        self,
        user_key: str,
        target_key: str,
        hourly_limit: int,
        daily_limit: int,
        notification_type: str
    ) -> Tuple[bool, int]:
        """Generic rate limit checking"""
        now = datetime.utcnow()
        hour_start = now - timedelta(hours=1)
        day_start = now - timedelta(days=1)

        # Check hourly limits
        user_hour_count = await self._get_count_in_window(user_key, hour_start)
        target_hour_count = await self._get_count_in_window(target_key, hour_start)

        if user_hour_count >= hourly_limit or target_hour_count >= hourly_limit:
            logger.warning(f"{notification_type} hourly rate limit exceeded")
            return False, 0

        # Check daily limits
        user_day_count = await self._get_count_in_window(user_key, day_start)
        target_day_count = await self._get_count_in_window(target_key, day_start)

        if user_day_count >= daily_limit or target_day_count >= daily_limit:
            logger.warning(f"{notification_type} daily rate limit exceeded")
            return False, 0

        remaining = min(
            hourly_limit - user_hour_count,
            daily_limit - user_day_count
        )

        return True, remaining

    async def record_sms_sent(self, user_id: str, phone_number: str):
        """Record SMS sent for rate limiting"""
        await self._record_notification_sent(
            f"sms_rate_limit:user:{user_id}",
            f"sms_rate_limit:phone:{phone_number}"
        )

    async def record_push_sent(self, user_id: str, device_token: str):
        """Record push notification sent for rate limiting"""
        await self._record_notification_sent(
            f"push_rate_limit:user:{user_id}",
            f"push_rate_limit:device:{device_token}"
        )

    async def _record_notification_sent(self, user_key: str, target_key: str):
        """Record notification sent for rate limiting"""
        timestamp = int(datetime.utcnow().timestamp())

        # Record for both keys
        for key in [user_key, target_key]:
            await self.redis.zadd(key, {str(timestamp): timestamp})
            await self.redis.expire(key, 86400)  # 24 hours TTL

    async def _get_count_in_window(self, key: str, start_time: datetime) -> int:
        """Get count of notifications in time window"""
        start_timestamp = int(start_time.timestamp())
        return await self.redis.zcount(key, start_timestamp, "+inf")


class SMSNotificationService:
    """SMS notification service using Twilio"""

    def __init__(
        self,
        twilio_config: Dict[str, str],
        redis_client: redis.Redis
    ):
        self.twilio_config = twilio_config
        self.redis = redis_client
        self.template_engine = SMSTemplateEngine()
        self.rate_limiter = MobileRateLimiter(redis_client)

        # Initialize Twilio client
        self.twilio_client = TwilioClient(
            twilio_config['account_sid'],
            twilio_config['auth_token']
        )

        # SMS delivery stats
        self.stats = SMSDeliveryStats()

    async def send_alert_sms(
        self,
        alert: Alert,
        rule: AlertRule,
        sms_config: SMSConfig
    ) -> bool:
        """
        Send alert SMS with rate limiting and delivery tracking

        Returns:
            bool: True if SMS was sent successfully
        """
        try:
            # Check rate limits
            is_allowed, remaining = await self.rate_limiter.check_sms_rate_limit(
                rule.user_id, sms_config.phone_number, sms_config.rate_limit
            )

            if not is_allowed:
                logger.warning(f"SMS rate limit exceeded for user {rule.user_id}")
                await self._record_sms_failure(
                    alert, sms_config, "Rate limit exceeded"
                )
                return False

            # Prepare SMS content
            context = self._prepare_sms_context(alert, rule)
            message = self.template_engine.render_sms(
                sms_config.template or "default",
                context,
                sms_config.max_length
            )

            # Send SMS
            success = await self._send_sms_with_retries(
                alert, rule, sms_config, message
            )

            if success:
                await self.rate_limiter.record_sms_sent(
                    rule.user_id, sms_config.phone_number
                )
                self.stats.total_sent += 1
                self.stats.last_sent = datetime.utcnow()
            else:
                self.stats.total_failed += 1

            return success

        except Exception as e:
            logger.error(f"SMS sending failed for alert {alert.alert_id}: {e}")
            await self._record_sms_failure(alert, sms_config, str(e))
            return False

    async def _send_sms_with_retries(
        self,
        alert: Alert,
        rule: AlertRule,
        sms_config: SMSConfig,
        message: str
    ) -> bool:
        """Send SMS with retry logic"""
        max_retries = sms_config.max_retries or 2
        base_delay = 2.0

        for attempt in range(max_retries + 1):
            try:
                # Send SMS via Twilio
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    self._send_twilio_sms,
                    sms_config.phone_number,
                    message
                )

                if result:
                    await self._record_sms_success(alert, sms_config, result)
                    return True

            except Exception as e:
                logger.warning(f"SMS attempt {attempt + 1} failed: {e}")

                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    await asyncio.sleep(delay)
                else:
                    await self._record_sms_failure(alert, sms_config, str(e))

        return False

    def _send_twilio_sms(self, phone_number: str, message: str) -> Optional[str]:
        """Send SMS via Twilio (synchronous)"""
        try:
            message_obj = self.twilio_client.messages.create(
                body=message,
                from_=self.twilio_config['from_number'],
                to=phone_number
            )

            logger.info(f"SMS sent successfully to {phone_number}, SID: {message_obj.sid}")
            return message_obj.sid

        except Exception as e:
            logger.error(f"Twilio SMS error: {e}")
            return None

    def _prepare_sms_context(self, alert: Alert, rule: AlertRule) -> Dict[str, Any]:
        """Prepare context for SMS template"""
        return {
            "title": alert.title,
            "message": alert.message,
            "symbol": alert.symbol or "N/A",
            "timestamp": alert.timestamp.strftime("%H:%M"),
            "severity": alert.severity.value,
            "alert_id": alert.alert_id,
            "rule_name": rule.name,
            "price": alert.data.get("price", "N/A"),
            "change": alert.data.get("change_percent", "N/A"),
            "indicator": alert.data.get("indicator", "N/A")
        }

    async def _record_sms_success(
        self,
        alert: Alert,
        sms_config: SMSConfig,
        twilio_sid: str
    ):
        """Record successful SMS delivery"""
        delivery = NotificationDelivery(
            delivery_id=f"sms_{alert.alert_id}_{int(datetime.utcnow().timestamp())}",
            alert_id=alert.alert_id,
            channel="SMS",
            recipient=sms_config.phone_number,
            status=DeliveryStatus.DELIVERED,
            external_id=twilio_sid,
            delivered_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )

        await self._save_delivery_record(delivery)

    async def _record_sms_failure(
        self,
        alert: Alert,
        sms_config: SMSConfig,
        reason: str
    ):
        """Record SMS delivery failure"""
        delivery = NotificationDelivery(
            delivery_id=f"sms_failed_{alert.alert_id}_{int(datetime.utcnow().timestamp())}",
            alert_id=alert.alert_id,
            channel="SMS",
            recipient=sms_config.phone_number,
            status=DeliveryStatus.FAILED,
            failure_reason=reason,
            created_at=datetime.utcnow()
        )

        await self._save_delivery_record(delivery)

    async def _save_delivery_record(self, delivery: NotificationDelivery):
        """Save SMS delivery record"""
        try:
            key = f"sms_delivery:{delivery.delivery_id}"
            data = delivery.dict()

            # Convert datetime objects
            for field in ['created_at', 'delivered_at']:
                if hasattr(delivery, field) and getattr(delivery, field):
                    data[field] = getattr(delivery, field).isoformat()

            await self.redis.setex(
                key,
                86400 * 7,  # 7 days TTL
                json.dumps(data, default=str)
            )

        except Exception as e:
            logger.error(f"Failed to save SMS delivery record: {e}")


class PushNotificationService:
    """Push notification service supporting Firebase and APNs"""

    def __init__(
        self,
        firebase_config: Optional[Dict[str, Any]] = None,
        apns_config: Optional[Dict[str, Any]] = None,
        redis_client: Optional[redis.Redis] = None
    ):
        self.redis = redis_client
        self.template_engine = PushTemplateEngine()
        self.rate_limiter = MobileRateLimiter(redis_client) if redis_client else None

        # Firebase setup
        self.firebase_app = None
        if firebase_config:
            try:
                cred = credentials.Certificate(firebase_config['service_account_path'])
                self.firebase_app = initialize_app(cred)
                logger.info("Firebase initialized successfully")
            except Exception as e:
                logger.error(f"Firebase initialization failed: {e}")

        # APNs setup
        self.apns_client = None
        if apns_config:
            try:
                self.apns_client = apns.APNSClient(
                    key=apns_config['key_path'],
                    key_id=apns_config['key_id'],
                    team_id=apns_config['team_id'],
                    bundle_id=apns_config['bundle_id'],
                    use_sandbox=apns_config.get('use_sandbox', False)
                )
                logger.info("APNs initialized successfully")
            except Exception as e:
                logger.error(f"APNs initialization failed: {e}")

        # Push delivery stats
        self.stats = PushDeliveryStats()

    async def send_alert_push(
        self,
        alert: Alert,
        rule: AlertRule,
        push_config: PushConfig
    ) -> bool:
        """
        Send alert push notification

        Returns:
            bool: True if push was sent successfully
        """
        try:
            # Check rate limits
            if self.rate_limiter:
                is_allowed, remaining = await self.rate_limiter.check_push_rate_limit(
                    rule.user_id, push_config.device_token, push_config.rate_limit
                )

                if not is_allowed:
                    logger.warning(f"Push rate limit exceeded for user {rule.user_id}")
                    await self._record_push_failure(
                        alert, push_config, "Rate limit exceeded"
                    )
                    return False

            # Prepare push notification content
            context = self._prepare_push_context(alert, rule)
            notification_data = self.template_engine.render_push_notification(
                push_config.template or "default",
                context
            )

            # Send based on platform
            success = False
            if push_config.platform.lower() == 'android':
                success = await self._send_firebase_push(
                    push_config.device_token, notification_data, alert
                )
            elif push_config.platform.lower() == 'ios':
                success = await self._send_apns_push(
                    push_config.device_token, notification_data, alert
                )

            if success and self.rate_limiter:
                await self.rate_limiter.record_push_sent(
                    rule.user_id, push_config.device_token
                )
                self.stats.total_sent += 1
                self.stats.last_sent = datetime.utcnow()
            else:
                self.stats.total_failed += 1

            return success

        except Exception as e:
            logger.error(f"Push notification failed for alert {alert.alert_id}: {e}")
            await self._record_push_failure(alert, push_config, str(e))
            return False

    async def _send_firebase_push(
        self,
        device_token: str,
        notification_data: Dict[str, Any],
        alert: Alert
    ) -> bool:
        """Send push notification via Firebase"""
        if not self.firebase_app:
            logger.error("Firebase not initialized")
            return False

        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=notification_data["title"],
                    body=notification_data["body"]
                ),
                data=notification_data["data"],
                token=device_token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='alerts'
                    )
                )
            )

            # Send asynchronously
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, messaging.send, message
            )

            logger.info(f"Firebase push sent successfully: {response}")
            await self._record_push_success(alert, device_token, response)
            return True

        except Exception as e:
            logger.error(f"Firebase push error: {e}")
            return False

    async def _send_apns_push(
        self,
        device_token: str,
        notification_data: Dict[str, Any],
        alert: Alert
    ) -> bool:
        """Send push notification via APNs"""
        if not self.apns_client:
            logger.error("APNs not initialized")
            return False

        try:
            payload = apns.Payload(
                alert=apns.PayloadAlert(
                    title=notification_data["title"],
                    body=notification_data["body"]
                ),
                sound="default",
                custom=notification_data["data"]
            )

            request = apns.NotificationRequest(
                device_token=device_token,
                message=payload
            )

            # Send asynchronously
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, self.apns_client.send_notification, request
            )

            if response.is_successful:
                logger.info(f"APNs push sent successfully")
                await self._record_push_success(alert, device_token, response.id)
                return True
            else:
                logger.error(f"APNs push failed: {response.description}")
                return False

        except Exception as e:
            logger.error(f"APNs push error: {e}")
            return False

    def _prepare_push_context(self, alert: Alert, rule: AlertRule) -> Dict[str, Any]:
        """Prepare context for push notification template"""
        return {
            "alert_title": alert.title,
            "message": alert.message,
            "symbol": alert.symbol or "N/A",
            "timestamp": alert.timestamp.isoformat(),
            "severity": alert.severity.value,
            "alert_id": alert.alert_id,
            "rule_name": rule.name,
            "price": alert.data.get("price", "N/A"),
            "change": alert.data.get("change_percent", "N/A"),
            "indicator": alert.data.get("indicator", "N/A")
        }

    async def _record_push_success(
        self,
        alert: Alert,
        device_token: str,
        external_id: str
    ):
        """Record successful push delivery"""
        if not self.redis:
            return

        delivery = NotificationDelivery(
            delivery_id=f"push_{alert.alert_id}_{int(datetime.utcnow().timestamp())}",
            alert_id=alert.alert_id,
            channel="PUSH",
            recipient=device_token,
            status=DeliveryStatus.DELIVERED,
            external_id=external_id,
            delivered_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )

        await self._save_delivery_record(delivery)

    async def _record_push_failure(
        self,
        alert: Alert,
        push_config: PushConfig,
        reason: str
    ):
        """Record push delivery failure"""
        if not self.redis:
            return

        delivery = NotificationDelivery(
            delivery_id=f"push_failed_{alert.alert_id}_{int(datetime.utcnow().timestamp())}",
            alert_id=alert.alert_id,
            channel="PUSH",
            recipient=push_config.device_token,
            status=DeliveryStatus.FAILED,
            failure_reason=reason,
            created_at=datetime.utcnow()
        )

        await self._save_delivery_record(delivery)

    async def _save_delivery_record(self, delivery: NotificationDelivery):
        """Save push delivery record"""
        if not self.redis:
            return

        try:
            key = f"push_delivery:{delivery.delivery_id}"
            data = delivery.dict()

            # Convert datetime objects
            for field in ['created_at', 'delivered_at']:
                if hasattr(delivery, field) and getattr(delivery, field):
                    data[field] = getattr(delivery, field).isoformat()

            await self.redis.setex(
                key,
                86400 * 7,  # 7 days TTL
                json.dumps(data, default=str)
            )

        except Exception as e:
            logger.error(f"Failed to save push delivery record: {e}")


class MobileNotificationService:
    """Combined service for SMS and push notifications"""

    def __init__(
        self,
        sms_service: Optional[SMSNotificationService] = None,
        push_service: Optional[PushNotificationService] = None
    ):
        self.sms_service = sms_service
        self.push_service = push_service

    async def send_mobile_alert(
        self,
        alert: Alert,
        rule: AlertRule,
        sms_config: Optional[SMSConfig] = None,
        push_config: Optional[PushConfig] = None
    ) -> Dict[str, bool]:
        """
        Send alert via SMS and/or push notification

        Returns:
            Dictionary with SMS and push delivery results
        """
        results = {"sms": False, "push": False}

        # Send SMS
        if sms_config and self.sms_service:
            try:
                results["sms"] = await self.sms_service.send_alert_sms(
                    alert, rule, sms_config
                )
            except Exception as e:
                logger.error(f"SMS sending failed: {e}")

        # Send push notification
        if push_config and self.push_service:
            try:
                results["push"] = await self.push_service.send_alert_push(
                    alert, rule, push_config
                )
            except Exception as e:
                logger.error(f"Push notification failed: {e}")

        return results

    async def get_delivery_stats(self) -> Dict[str, Any]:
        """Get combined delivery statistics"""
        stats = {}

        if self.sms_service:
            stats["sms"] = self.sms_service.stats.dict()

        if self.push_service:
            stats["push"] = self.push_service.stats.dict()

        return stats