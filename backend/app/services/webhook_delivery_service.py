"""
Webhook Delivery Service

Handles webhook delivery with advanced features including retries, signatures,
rate limiting, and delivery tracking.
"""

import asyncio
import aiohttp
import hashlib
import hmac
import json
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
import logging
import time
import base64

from ..models.alert_models import (
    Alert, AlertRule, WebhookConfig, WebhookDelivery, WebhookMethod,
    AlertStatus, NotificationChannel
)

logger = logging.getLogger(__name__)


class WebhookSigner:
    """Handles webhook signature generation and verification"""

    @staticmethod
    def generate_signature(payload: str, secret: str, algorithm: str = "sha256") -> str:
        """Generate HMAC signature for webhook payload"""
        try:
            signature = hmac.new(
                secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            return f"sha256={signature}"
        except Exception as e:
            logger.error(f"Error generating webhook signature: {e}")
            return ""

    @staticmethod
    def verify_signature(payload: str, signature: str, secret: str) -> bool:
        """Verify webhook signature"""
        try:
            expected_signature = WebhookSigner.generate_signature(payload, secret)
            return hmac.compare_digest(signature, expected_signature)
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False


class WebhookRateLimiter:
    """Rate limiter for webhook deliveries"""

    def __init__(self):
        self.webhook_counters: Dict[str, List[datetime]] = {}
        self.max_requests_per_minute = 60
        self.max_requests_per_hour = 1000

    def can_send_webhook(self, webhook_id: str) -> bool:
        """Check if webhook can be sent based on rate limits"""
        try:
            now = datetime.utcnow()

            if webhook_id not in self.webhook_counters:
                self.webhook_counters[webhook_id] = []

            # Clean old entries
            cutoff_hour = now - timedelta(hours=1)
            cutoff_minute = now - timedelta(minutes=1)

            self.webhook_counters[webhook_id] = [
                timestamp for timestamp in self.webhook_counters[webhook_id]
                if timestamp > cutoff_hour
            ]

            # Check limits
            recent_requests = [
                timestamp for timestamp in self.webhook_counters[webhook_id]
                if timestamp > cutoff_minute
            ]

            if len(recent_requests) >= self.max_requests_per_minute:
                return False

            if len(self.webhook_counters[webhook_id]) >= self.max_requests_per_hour:
                return False

            return True

        except Exception as e:
            logger.error(f"Error checking webhook rate limit: {e}")
            return True

    def record_webhook(self, webhook_id: str):
        """Record webhook send attempt"""
        try:
            now = datetime.utcnow()
            if webhook_id not in self.webhook_counters:
                self.webhook_counters[webhook_id] = []
            self.webhook_counters[webhook_id].append(now)
        except Exception as e:
            logger.error(f"Error recording webhook: {e}")


class WebhookPayloadBuilder:
    """Builds webhook payloads from alerts"""

    def build_payload(
        self,
        alert: Alert,
        rule: AlertRule,
        webhook_config: WebhookConfig,
        custom_template: Optional[str] = None
    ) -> Dict[str, Any]:
        """Build webhook payload"""
        try:
            if custom_template:
                return self._build_from_template(alert, rule, custom_template)
            elif webhook_config.template:
                return self._build_from_template(alert, rule, webhook_config.template)
            else:
                return self._build_default_payload(alert, rule)

        except Exception as e:
            logger.error(f"Error building webhook payload: {e}")
            return self._build_minimal_payload(alert)

    def _build_default_payload(self, alert: Alert, rule: AlertRule) -> Dict[str, Any]:
        """Build default webhook payload"""
        return {
            "id": alert.alert_id,
            "timestamp": alert.created_at.isoformat(),
            "type": "alert",
            "event": alert.alert_type.value,
            "severity": alert.severity.value,
            "alert": {
                "id": alert.alert_id,
                "rule_id": alert.rule_id,
                "title": alert.title,
                "message": alert.message,
                "symbol": alert.symbol,
                "current_value": str(alert.current_value) if alert.current_value else None,
                "threshold_value": str(alert.threshold_value) if alert.threshold_value else None,
                "condition_met": alert.condition_met,
                "created_at": alert.created_at.isoformat(),
                "expires_at": alert.expires_at.isoformat() if alert.expires_at else None,
                "data": alert.data,
                "metadata": alert.metadata
            },
            "rule": {
                "id": rule.rule_id,
                "name": rule.name,
                "description": rule.description,
                "type": rule.alert_type.value,
                "symbol": rule.symbol,
                "symbols": rule.symbols
            },
            "delivery": {
                "delivery_id": str(uuid.uuid4()),
                "channel": "webhook",
                "attempt": alert.delivery_attempts + 1
            }
        }

    def _build_from_template(self, alert: Alert, rule: AlertRule, template: str) -> Dict[str, Any]:
        """Build payload from custom template"""
        try:
            # Simple template variable replacement
            variables = {
                'alert_id': alert.alert_id,
                'rule_id': alert.rule_id,
                'title': alert.title,
                'message': alert.message,
                'symbol': alert.symbol or '',
                'current_value': str(alert.current_value) if alert.current_value else '',
                'threshold_value': str(alert.threshold_value) if alert.threshold_value else '',
                'condition_met': alert.condition_met,
                'severity': alert.severity.value,
                'alert_type': alert.alert_type.value,
                'created_at': alert.created_at.isoformat(),
                'rule_name': rule.name,
                'rule_description': rule.description or ''
            }

            # Replace variables in template
            processed_template = template
            for key, value in variables.items():
                processed_template = processed_template.replace(f"{{{key}}}", str(value))

            # Try to parse as JSON
            try:
                return json.loads(processed_template)
            except json.JSONDecodeError:
                # If not valid JSON, wrap in a data field
                return {"data": processed_template}

        except Exception as e:
            logger.error(f"Error processing template: {e}")
            return self._build_default_payload(alert, rule)

    def _build_minimal_payload(self, alert: Alert) -> Dict[str, Any]:
        """Build minimal payload for error cases"""
        return {
            "id": alert.alert_id,
            "timestamp": alert.created_at.isoformat(),
            "message": alert.message,
            "severity": alert.severity.value
        }


class WebhookDeliveryService:
    """
    Comprehensive webhook delivery service with advanced features
    """

    def __init__(self):
        self.signer = WebhookSigner()
        self.rate_limiter = WebhookRateLimiter()
        self.payload_builder = WebhookPayloadBuilder()

        # Webhook configurations
        self.webhook_configs: Dict[str, WebhookConfig] = {}

        # Delivery tracking
        self.delivery_history: List[WebhookDelivery] = []
        self.failed_deliveries: Dict[str, List[WebhookDelivery]] = {}

        # HTTP session
        self.session: Optional[aiohttp.ClientSession] = None

        # Configuration
        self.default_timeout = 30
        self.max_retries = 3
        self.retry_delays = [1, 3, 9]  # Exponential backoff

    async def start(self):
        """Start the webhook delivery service"""
        try:
            if self.session:
                await self.session.close()

            # Create HTTP session with reasonable defaults
            timeout = aiohttp.ClientTimeout(total=self.default_timeout)
            connector = aiohttp.TCPConnector(
                limit=100,  # Connection pool limit
                ttl_dns_cache=300,  # DNS cache TTL
                use_dns_cache=True
            )

            self.session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                headers={
                    'User-Agent': 'TurtleTrading-Webhook/1.0',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            )

            logger.info("Webhook delivery service started")

        except Exception as e:
            logger.error(f"Error starting webhook delivery service: {e}")
            raise

    async def stop(self):
        """Stop the webhook delivery service"""
        try:
            if self.session:
                await self.session.close()
                self.session = None

            logger.info("Webhook delivery service stopped")

        except Exception as e:
            logger.error(f"Error stopping webhook delivery service: {e}")

    def register_webhook(self, webhook_config: WebhookConfig):
        """Register a webhook configuration"""
        try:
            self.webhook_configs[webhook_config.webhook_id] = webhook_config
            logger.info(f"Registered webhook: {webhook_config.name} ({webhook_config.webhook_id})")

        except Exception as e:
            logger.error(f"Error registering webhook: {e}")

    def unregister_webhook(self, webhook_id: str):
        """Unregister a webhook configuration"""
        try:
            if webhook_id in self.webhook_configs:
                del self.webhook_configs[webhook_id]
                logger.info(f"Unregistered webhook: {webhook_id}")

        except Exception as e:
            logger.error(f"Error unregistering webhook: {e}")

    async def deliver_alert(self, alert: Alert, rule: AlertRule) -> bool:
        """
        Deliver alert to all configured webhooks for the rule

        Returns True if at least one webhook delivery succeeded
        """
        try:
            if not self.session:
                logger.error("Webhook delivery service not started")
                return False

            # Get webhook URLs from rule
            webhook_urls = rule.webhook_urls or []
            if not webhook_urls:
                return True  # No webhooks configured, consider success

            delivery_tasks = []

            for url in webhook_urls:
                # Find matching webhook config or create default
                webhook_config = self._find_webhook_config_for_url(url)
                if not webhook_config:
                    webhook_config = self._create_default_webhook_config(url)

                # Check rate limits
                if not self.rate_limiter.can_send_webhook(webhook_config.webhook_id):
                    logger.warning(f"Rate limit exceeded for webhook {webhook_config.webhook_id}")
                    continue

                # Create delivery task
                task = asyncio.create_task(
                    self._deliver_to_webhook(alert, rule, webhook_config)
                )
                delivery_tasks.append(task)

            if not delivery_tasks:
                return False

            # Execute deliveries concurrently
            results = await asyncio.gather(*delivery_tasks, return_exceptions=True)

            # Check results
            successful_deliveries = 0
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Webhook delivery exception: {result}")
                elif result:
                    successful_deliveries += 1

            return successful_deliveries > 0

        except Exception as e:
            logger.error(f"Error delivering alert via webhooks: {e}")
            return False

    async def _deliver_to_webhook(
        self,
        alert: Alert,
        rule: AlertRule,
        webhook_config: WebhookConfig
    ) -> bool:
        """Deliver alert to a specific webhook"""
        try:
            # Build payload
            payload = self.payload_builder.build_payload(alert, rule, webhook_config)
            payload_json = json.dumps(payload, default=str)

            # Prepare headers
            headers = self._prepare_headers(webhook_config, payload_json)

            # Create delivery record
            delivery = WebhookDelivery(
                delivery_id=str(uuid.uuid4()),
                webhook_id=webhook_config.webhook_id,
                alert_id=alert.alert_id,
                url=str(webhook_config.url),
                method=webhook_config.method.value,
                headers=headers,
                payload=payload,
                started_at=datetime.utcnow()
            )

            # Attempt delivery with retries
            success = await self._attempt_delivery_with_retries(
                delivery, webhook_config, payload_json, headers
            )

            # Update webhook statistics
            webhook_config.total_deliveries += 1
            webhook_config.last_delivery_at = datetime.utcnow()

            if success:
                webhook_config.successful_deliveries += 1
                webhook_config.last_success_at = datetime.utcnow()
            else:
                webhook_config.failed_deliveries += 1

            # Record delivery
            self.delivery_history.append(delivery)
            self.rate_limiter.record_webhook(webhook_config.webhook_id)

            return success

        except Exception as e:
            logger.error(f"Error delivering to webhook {webhook_config.webhook_id}: {e}")
            return False

    async def _attempt_delivery_with_retries(
        self,
        delivery: WebhookDelivery,
        webhook_config: WebhookConfig,
        payload_json: str,
        headers: Dict[str, str]
    ) -> bool:
        """Attempt webhook delivery with retry logic"""
        max_attempts = min(webhook_config.retry_count + 1, self.max_retries + 1)

        for attempt in range(1, max_attempts + 1):
            try:
                delivery.retry_attempt = attempt
                success = await self._send_webhook_request(
                    delivery, webhook_config, payload_json, headers
                )

                if success:
                    delivery.success = True
                    return True

                # Wait before retry (except on last attempt)
                if attempt < max_attempts:
                    delay = min(self.retry_delays[min(attempt - 1, len(self.retry_delays) - 1)],
                              webhook_config.retry_delay_seconds)
                    await asyncio.sleep(delay)

            except Exception as e:
                delivery.error_message = str(e)
                logger.error(f"Webhook delivery attempt {attempt} failed: {e}")

                if attempt < max_attempts:
                    delay = webhook_config.retry_delay_seconds
                    await asyncio.sleep(delay)

        delivery.success = False
        return False

    async def _send_webhook_request(
        self,
        delivery: WebhookDelivery,
        webhook_config: WebhookConfig,
        payload_json: str,
        headers: Dict[str, str]
    ) -> bool:
        """Send the actual webhook HTTP request"""
        try:
            start_time = time.time()

            # Prepare request parameters
            request_params = {
                'headers': headers,
                'timeout': aiohttp.ClientTimeout(total=webhook_config.timeout_seconds)
            }

            # Add payload for methods that support it
            if webhook_config.method in [WebhookMethod.POST, WebhookMethod.PUT, WebhookMethod.PATCH]:
                request_params['data'] = payload_json

            # Send request
            async with self.session.request(
                webhook_config.method.value,
                str(webhook_config.url),
                **request_params
            ) as response:
                # Record response details
                delivery.status_code = response.status
                delivery.response_headers = dict(response.headers)

                # Read response body (limited size)
                try:
                    response_text = await response.text()
                    if len(response_text) > 10000:  # Limit response size
                        response_text = response_text[:10000] + "... (truncated)"
                    delivery.response_body = response_text
                except Exception:
                    delivery.response_body = "Unable to read response body"

                # Calculate duration
                end_time = time.time()
                delivery.duration_ms = int((end_time - start_time) * 1000)
                delivery.completed_at = datetime.utcnow()

                # Check if successful (2xx status codes)
                success = 200 <= response.status < 300

                if not success:
                    delivery.error_message = f"HTTP {response.status}: {response.reason}"

                logger.info(
                    f"Webhook delivery {delivery.delivery_id}: "
                    f"HTTP {response.status} in {delivery.duration_ms}ms"
                )

                return success

        except asyncio.TimeoutError:
            delivery.error_message = "Request timeout"
            delivery.completed_at = datetime.utcnow()
            logger.warning(f"Webhook delivery {delivery.delivery_id} timed out")
            return False

        except Exception as e:
            delivery.error_message = str(e)
            delivery.completed_at = datetime.utcnow()
            logger.error(f"Webhook delivery {delivery.delivery_id} failed: {e}")
            return False

    def _prepare_headers(self, webhook_config: WebhookConfig, payload_json: str) -> Dict[str, str]:
        """Prepare HTTP headers for webhook request"""
        headers = {
            'Content-Type': webhook_config.content_type,
            'User-Agent': 'TurtleTrading-Webhook/1.0',
            'X-TurtleTrading-Delivery': str(uuid.uuid4()),
            'X-TurtleTrading-Timestamp': str(int(time.time()))
        }

        # Add custom headers
        headers.update(webhook_config.headers)

        # Add authentication headers
        if webhook_config.auth_type == "bearer" and webhook_config.auth_token:
            headers['Authorization'] = f"Bearer {webhook_config.auth_token}"
        elif webhook_config.auth_type == "api_key" and webhook_config.auth_token:
            headers['X-API-Key'] = webhook_config.auth_token
        elif webhook_config.auth_type == "basic" and webhook_config.auth_username and webhook_config.auth_password:
            credentials = base64.b64encode(
                f"{webhook_config.auth_username}:{webhook_config.auth_password}".encode()
            ).decode()
            headers['Authorization'] = f"Basic {credentials}"

        # Add signature if configured
        if webhook_config.include_signature and webhook_config.secret_key:
            signature = self.signer.generate_signature(payload_json, webhook_config.secret_key)
            headers['X-TurtleTrading-Signature'] = signature

        return headers

    def _find_webhook_config_for_url(self, url: str) -> Optional[WebhookConfig]:
        """Find webhook configuration for a URL"""
        for config in self.webhook_configs.values():
            if str(config.url) == url:
                return config
        return None

    def _create_default_webhook_config(self, url: str) -> WebhookConfig:
        """Create default webhook configuration for a URL"""
        return WebhookConfig(
            webhook_id=str(uuid.uuid4()),
            user_id="system",
            name=f"Auto-created for {url}",
            url=url,
            method=WebhookMethod.POST,
            timeout_seconds=self.default_timeout,
            retry_count=self.max_retries,
            retry_delay_seconds=5
        )

    async def verify_webhook(self, webhook_config: WebhookConfig) -> Tuple[bool, str]:
        """Verify webhook endpoint by sending a test request"""
        try:
            if not self.session:
                return False, "Webhook service not started"

            # Create test payload
            test_payload = {
                "type": "verification",
                "timestamp": datetime.utcnow().isoformat(),
                "webhook_id": webhook_config.webhook_id,
                "message": "TurtleTrading webhook verification"
            }

            payload_json = json.dumps(test_payload)
            headers = self._prepare_headers(webhook_config, payload_json)

            # Send verification request
            async with self.session.post(
                str(webhook_config.url),
                data=payload_json,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=webhook_config.timeout_seconds)
            ) as response:
                if 200 <= response.status < 300:
                    webhook_config.verified = True
                    return True, f"Webhook verified successfully (HTTP {response.status})"
                else:
                    return False, f"Webhook verification failed: HTTP {response.status}"

        except asyncio.TimeoutError:
            return False, "Webhook verification timed out"
        except Exception as e:
            return False, f"Webhook verification error: {str(e)}"

    def get_delivery_statistics(self, webhook_id: Optional[str] = None) -> Dict[str, Any]:
        """Get webhook delivery statistics"""
        try:
            if webhook_id:
                deliveries = [d for d in self.delivery_history if d.webhook_id == webhook_id]
            else:
                deliveries = self.delivery_history

            total_deliveries = len(deliveries)
            successful_deliveries = len([d for d in deliveries if d.success])
            failed_deliveries = total_deliveries - successful_deliveries

            success_rate = (successful_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0

            # Calculate average response time
            completed_deliveries = [d for d in deliveries if d.duration_ms is not None]
            avg_response_time = (
                sum(d.duration_ms for d in completed_deliveries) / len(completed_deliveries)
                if completed_deliveries else 0
            )

            return {
                'total_deliveries': total_deliveries,
                'successful_deliveries': successful_deliveries,
                'failed_deliveries': failed_deliveries,
                'success_rate': round(success_rate, 2),
                'average_response_time_ms': round(avg_response_time, 2),
                'registered_webhooks': len(self.webhook_configs)
            }

        except Exception as e:
            logger.error(f"Error getting delivery statistics: {e}")
            return {}

    def get_recent_deliveries(self, limit: int = 100) -> List[WebhookDelivery]:
        """Get recent webhook deliveries"""
        try:
            sorted_deliveries = sorted(
                self.delivery_history,
                key=lambda x: x.started_at,
                reverse=True
            )
            return sorted_deliveries[:limit]

        except Exception as e:
            logger.error(f"Error getting recent deliveries: {e}")
            return []

    def cleanup_old_deliveries(self, retention_days: int = 7):
        """Clean up old delivery records"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

            self.delivery_history = [
                delivery for delivery in self.delivery_history
                if delivery.started_at > cutoff_date
            ]

            logger.info(f"Cleaned up webhook delivery history older than {retention_days} days")

        except Exception as e:
            logger.error(f"Error cleaning up delivery history: {e}")


# Global webhook delivery service instance
_webhook_delivery_service: Optional[WebhookDeliveryService] = None


async def get_webhook_delivery_service() -> WebhookDeliveryService:
    """Get the global webhook delivery service"""
    global _webhook_delivery_service
    if _webhook_delivery_service is None:
        _webhook_delivery_service = WebhookDeliveryService()
        await _webhook_delivery_service.start()
    return _webhook_delivery_service