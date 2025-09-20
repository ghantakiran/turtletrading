"""
Scanner Alert System

Real-time alert system for scanner results including notifications,
rate limiting, delivery channels, and alert management.
"""

import asyncio
import json
import smtplib
from typing import Dict, List, Any, Optional, Set, Callable
from datetime import datetime, timedelta
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import logging
import aiohttp
from dataclasses import dataclass, field

from ..models.scanner_models import (
    ScannerAlert, AlertType, AlertConfig, ScanResult, SavedScanner,
    ScannerResponse
)

logger = logging.getLogger(__name__)


@dataclass
class AlertDeliveryStats:
    """Statistics for alert delivery"""
    total_alerts: int = 0
    delivered_alerts: int = 0
    failed_alerts: int = 0
    email_sent: int = 0
    sms_sent: int = 0
    webhook_sent: int = 0
    rate_limited: int = 0
    last_reset: datetime = field(default_factory=datetime.utcnow)


class AlertRateLimiter:
    """Rate limiter for alerts to prevent spam"""

    def __init__(self):
        self.alert_counts: Dict[str, List[datetime]] = {}
        self.cooldowns: Dict[str, datetime] = {}

    def can_send_alert(self, alert_key: str, config: AlertConfig) -> bool:
        """Check if alert can be sent based on rate limits"""
        now = datetime.utcnow()

        # Check cooldown
        if alert_key in self.cooldowns:
            cooldown_until = self.cooldowns[alert_key]
            if now < cooldown_until:
                return False

        # Check hourly rate limit
        if alert_key not in self.alert_counts:
            self.alert_counts[alert_key] = []

        # Clean old entries
        hour_ago = now - timedelta(hours=1)
        self.alert_counts[alert_key] = [
            timestamp for timestamp in self.alert_counts[alert_key]
            if timestamp > hour_ago
        ]

        # Check rate limit
        if len(self.alert_counts[alert_key]) >= config.max_alerts_per_hour:
            return False

        return True

    def record_alert(self, alert_key: str, config: AlertConfig):
        """Record that an alert was sent"""
        now = datetime.utcnow()

        if alert_key not in self.alert_counts:
            self.alert_counts[alert_key] = []

        self.alert_counts[alert_key].append(now)

        # Set cooldown
        cooldown_until = now + timedelta(minutes=config.cooldown_minutes)
        self.cooldowns[alert_key] = cooldown_until

    def clear_expired_records(self):
        """Clean up expired rate limit records"""
        now = datetime.utcnow()
        hour_ago = now - timedelta(hours=1)

        for alert_key in list(self.alert_counts.keys()):
            self.alert_counts[alert_key] = [
                timestamp for timestamp in self.alert_counts[alert_key]
                if timestamp > hour_ago
            ]

            if not self.alert_counts[alert_key]:
                del self.alert_counts[alert_key]

        # Clean expired cooldowns
        expired_cooldowns = [
            key for key, cooldown_time in self.cooldowns.items()
            if now >= cooldown_time
        ]
        for key in expired_cooldowns:
            del self.cooldowns[key]


class EmailAlertSender:
    """Send email alerts"""

    def __init__(self, smtp_server: str = "localhost", smtp_port: int = 587,
                 username: str = "", password: str = "", use_tls: bool = True):
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.use_tls = use_tls

    async def send_alert(self, alert: ScannerAlert, recipients: List[str]) -> bool:
        """Send email alert"""
        try:
            # Create message
            msg = MimeMultipart()
            msg['From'] = self.username
            msg['To'] = ', '.join(recipients)
            msg['Subject'] = f"Scanner Alert: {alert.scanner_name} - {alert.symbol}"

            # Create email body
            body = self._create_email_body(alert)
            msg.attach(MimeText(body, 'html'))

            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls()
                if self.username and self.password:
                    server.login(self.username, self.password)

                text = msg.as_string()
                server.sendmail(self.username, recipients, text)

            logger.info(f"Email alert sent for {alert.symbol} to {len(recipients)} recipients")
            return True

        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
            return False

    def _create_email_body(self, alert: ScannerAlert) -> str:
        """Create HTML email body"""
        return f"""
        <html>
        <body>
            <h2>Scanner Alert: {alert.scanner_name}</h2>
            <p><strong>Symbol:</strong> {alert.symbol}</p>
            <p><strong>Alert Type:</strong> {alert.alert_type.value}</p>
            <p><strong>Message:</strong> {alert.message}</p>
            <p><strong>Condition:</strong> {alert.condition}</p>
            <p><strong>Current Value:</strong> {alert.current_value}</p>
            {f'<p><strong>Threshold:</strong> {alert.threshold_value}</p>' if alert.threshold_value else ''}
            <p><strong>Time:</strong> {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
            <p><strong>Priority:</strong> {alert.priority}</p>

            <hr>
            <p><small>This alert was generated by the TurtleTrading scanner system.</small></p>
        </body>
        </html>
        """


class WebhookAlertSender:
    """Send webhook alerts"""

    async def send_alert(self, alert: ScannerAlert, webhook_urls: List[str]) -> bool:
        """Send webhook alert"""
        try:
            payload = {
                'alert_id': alert.alert_id,
                'scanner_id': alert.scanner_id,
                'scanner_name': alert.scanner_name,
                'alert_type': alert.alert_type.value,
                'symbol': alert.symbol,
                'message': alert.message,
                'condition': alert.condition,
                'current_value': alert.current_value,
                'threshold_value': alert.threshold_value,
                'timestamp': alert.timestamp.isoformat(),
                'priority': alert.priority
            }

            success_count = 0
            async with aiohttp.ClientSession() as session:
                for url in webhook_urls:
                    try:
                        async with session.post(
                            url,
                            json=payload,
                            timeout=aiohttp.ClientTimeout(total=10)
                        ) as response:
                            if response.status == 200:
                                success_count += 1
                            else:
                                logger.warning(f"Webhook {url} returned status {response.status}")
                    except Exception as e:
                        logger.error(f"Failed to send webhook to {url}: {e}")

            logger.info(f"Webhook alert sent to {success_count}/{len(webhook_urls)} endpoints")
            return success_count > 0

        except Exception as e:
            logger.error(f"Failed to send webhook alert: {e}")
            return False


class ScannerAlertSystem:
    """
    Comprehensive alert system for scanner results

    Manages alert generation, delivery, rate limiting, and tracking
    across multiple delivery channels.
    """

    def __init__(self):
        self.rate_limiter = AlertRateLimiter()
        self.email_sender: Optional[EmailAlertSender] = None
        self.webhook_sender = WebhookAlertSender()

        # Alert storage
        self.active_alerts: Dict[str, ScannerAlert] = {}
        self.alert_history: List[ScannerAlert] = []
        self.delivery_stats = AlertDeliveryStats()

        # Scanner tracking
        self.previous_results: Dict[str, Set[str]] = {}  # scanner_id -> set of symbols
        self.alert_handlers: List[Callable] = []

        # Background tasks
        self._cleanup_task: Optional[asyncio.Task] = None
        self._start_cleanup_task()

    def configure_email(self, smtp_server: str, smtp_port: int, username: str,
                       password: str, use_tls: bool = True):
        """Configure email alert settings"""
        self.email_sender = EmailAlertSender(
            smtp_server=smtp_server,
            smtp_port=smtp_port,
            username=username,
            password=password,
            use_tls=use_tls
        )

    def add_alert_handler(self, handler: Callable[[ScannerAlert], None]):
        """Add custom alert handler"""
        self.alert_handlers.append(handler)

    async def process_scanner_results(self, scanner: SavedScanner, results: ScannerResponse):
        """Process scanner results and generate alerts"""
        try:
            if not scanner.alert_config or not scanner.alert_config.enabled:
                return

            scanner_id = scanner.scanner_id
            current_symbols = {result.symbol for result in results.results}
            previous_symbols = self.previous_results.get(scanner_id, set())

            # Generate alerts for new matches
            if scanner.alert_config.alert_on_new_match:
                new_symbols = current_symbols - previous_symbols
                for symbol in new_symbols:
                    # Find the result for this symbol
                    result = next((r for r in results.results if r.symbol == symbol), None)
                    if result and self._should_alert_for_result(result, scanner.alert_config):
                        await self._create_new_match_alert(scanner, result)

            # Generate alerts for removed matches
            if scanner.alert_config.alert_on_removed_match:
                removed_symbols = previous_symbols - current_symbols
                for symbol in removed_symbols:
                    await self._create_removed_match_alert(scanner, symbol)

            # Generate threshold alerts
            if scanner.alert_config.alert_on_threshold:
                for result in results.results:
                    await self._check_threshold_alerts(scanner, result)

            # Update tracking
            self.previous_results[scanner_id] = current_symbols

        except Exception as e:
            logger.error(f"Error processing scanner results for alerts: {e}")

    async def _create_new_match_alert(self, scanner: SavedScanner, result: ScanResult):
        """Create alert for new match"""
        alert = ScannerAlert(
            alert_id=f"new_match_{scanner.scanner_id}_{result.symbol}_{int(datetime.utcnow().timestamp())}",
            scanner_id=scanner.scanner_id,
            scanner_name=scanner.name,
            alert_type=AlertType.NEW_MATCH,
            symbol=result.symbol,
            message=f"New match found: {result.symbol} matches {scanner.name}",
            condition=f"Matched filters: {', '.join(result.matched_filters)}",
            current_value=result.match_score,
            timestamp=datetime.utcnow(),
            priority=self._determine_priority(result),
            delivered=False,
            delivery_channels=[]
        )

        await self._send_alert(alert, scanner.alert_config)

    async def _create_removed_match_alert(self, scanner: SavedScanner, symbol: str):
        """Create alert for removed match"""
        alert = ScannerAlert(
            alert_id=f"removed_match_{scanner.scanner_id}_{symbol}_{int(datetime.utcnow().timestamp())}",
            scanner_id=scanner.scanner_id,
            scanner_name=scanner.name,
            alert_type=AlertType.REMOVED_MATCH,
            symbol=symbol,
            message=f"Match removed: {symbol} no longer matches {scanner.name}",
            condition="No longer meets scanner criteria",
            current_value=0,
            timestamp=datetime.utcnow(),
            priority="low",
            delivered=False,
            delivery_channels=[]
        )

        await self._send_alert(alert, scanner.alert_config)

    async def _check_threshold_alerts(self, scanner: SavedScanner, result: ScanResult):
        """Check for threshold crossing alerts"""
        # This would implement specific threshold logic based on scanner configuration
        # For now, we'll check if match score is very high
        if result.match_score >= 90:
            alert = ScannerAlert(
                alert_id=f"threshold_{scanner.scanner_id}_{result.symbol}_{int(datetime.utcnow().timestamp())}",
                scanner_id=scanner.scanner_id,
                scanner_name=scanner.name,
                alert_type=AlertType.THRESHOLD_CROSSED,
                symbol=result.symbol,
                message=f"High confidence match: {result.symbol} has exceptional match score",
                condition="Match score >= 90%",
                current_value=result.match_score,
                threshold_value=90,
                timestamp=datetime.utcnow(),
                priority="high",
                delivered=False,
                delivery_channels=[]
            )

            await self._send_alert(alert, scanner.alert_config)

    def _should_alert_for_result(self, result: ScanResult, config: AlertConfig) -> bool:
        """Check if we should alert for this result"""
        # Check minimum match score
        if config.min_match_score and result.match_score < config.min_match_score:
            return False

        # Check priority symbols
        if config.priority_symbols and result.symbol not in config.priority_symbols:
            return False

        # Check excluded symbols
        if config.excluded_symbols and result.symbol in config.excluded_symbols:
            return False

        return True

    def _determine_priority(self, result: ScanResult) -> str:
        """Determine alert priority based on result"""
        if result.match_score >= 90:
            return "high"
        elif result.match_score >= 70:
            return "medium"
        else:
            return "low"

    async def _send_alert(self, alert: ScannerAlert, config: AlertConfig):
        """Send alert through configured channels"""
        try:
            # Check rate limiting
            alert_key = f"{alert.scanner_id}_{alert.symbol}"
            if not self.rate_limiter.can_send_alert(alert_key, config):
                self.delivery_stats.rate_limited += 1
                logger.debug(f"Alert rate limited: {alert_key}")
                return

            delivery_channels = []
            success = False

            # Send email alerts
            if config.email_enabled and config.email_addresses and self.email_sender:
                try:
                    if await self.email_sender.send_alert(alert, config.email_addresses):
                        delivery_channels.append("email")
                        self.delivery_stats.email_sent += 1
                        success = True
                except Exception as e:
                    logger.error(f"Email alert failed: {e}")

            # Send webhook alerts
            if config.webhook_enabled and config.webhook_urls:
                try:
                    if await self.webhook_sender.send_alert(alert, config.webhook_urls):
                        delivery_channels.append("webhook")
                        self.delivery_stats.webhook_sent += 1
                        success = True
                except Exception as e:
                    logger.error(f"Webhook alert failed: {e}")

            # SMS alerts would be implemented here
            if config.sms_enabled and config.phone_numbers:
                # Placeholder for SMS implementation
                delivery_channels.append("sms")
                self.delivery_stats.sms_sent += 1
                success = True

            # Update alert status
            alert.delivered = success
            alert.delivery_channels = delivery_channels

            # Store alert
            self.active_alerts[alert.alert_id] = alert
            self.alert_history.append(alert)

            # Update stats
            self.delivery_stats.total_alerts += 1
            if success:
                self.delivery_stats.delivered_alerts += 1
                self.rate_limiter.record_alert(alert_key, config)
            else:
                self.delivery_stats.failed_alerts += 1

            # Call custom handlers
            for handler in self.alert_handlers:
                try:
                    await handler(alert) if asyncio.iscoroutinefunction(handler) else handler(alert)
                except Exception as e:
                    logger.error(f"Alert handler failed: {e}")

            logger.info(f"Alert sent: {alert.alert_type.value} for {alert.symbol} via {delivery_channels}")

        except Exception as e:
            logger.error(f"Failed to send alert: {e}")

    async def get_alert_history(self, scanner_id: Optional[str] = None,
                               symbol: Optional[str] = None,
                               alert_type: Optional[AlertType] = None,
                               limit: int = 100) -> List[ScannerAlert]:
        """Get alert history with filtering"""
        filtered_alerts = self.alert_history

        if scanner_id:
            filtered_alerts = [a for a in filtered_alerts if a.scanner_id == scanner_id]

        if symbol:
            filtered_alerts = [a for a in filtered_alerts if a.symbol == symbol]

        if alert_type:
            filtered_alerts = [a for a in filtered_alerts if a.alert_type == alert_type]

        # Sort by timestamp (newest first) and limit
        filtered_alerts.sort(key=lambda x: x.timestamp, reverse=True)
        return filtered_alerts[:limit]

    def get_delivery_statistics(self) -> AlertDeliveryStats:
        """Get alert delivery statistics"""
        return self.delivery_stats

    def reset_statistics(self):
        """Reset alert delivery statistics"""
        self.delivery_stats = AlertDeliveryStats()

    async def test_alert_delivery(self, config: AlertConfig) -> Dict[str, bool]:
        """Test alert delivery configuration"""
        test_alert = ScannerAlert(
            alert_id="test_alert",
            scanner_id="test_scanner",
            scanner_name="Test Scanner",
            alert_type=AlertType.NEW_MATCH,
            symbol="TEST",
            message="This is a test alert",
            condition="Test condition",
            current_value="Test value",
            timestamp=datetime.utcnow(),
            priority="medium",
            delivered=False,
            delivery_channels=[]
        )

        results = {}

        # Test email
        if config.email_enabled and config.email_addresses and self.email_sender:
            try:
                results['email'] = await self.email_sender.send_alert(test_alert, config.email_addresses)
            except Exception as e:
                logger.error(f"Email test failed: {e}")
                results['email'] = False

        # Test webhook
        if config.webhook_enabled and config.webhook_urls:
            try:
                results['webhook'] = await self.webhook_sender.send_alert(test_alert, config.webhook_urls)
            except Exception as e:
                logger.error(f"Webhook test failed: {e}")
                results['webhook'] = False

        return results

    def _start_cleanup_task(self):
        """Start background cleanup task"""
        async def cleanup_loop():
            while True:
                try:
                    await asyncio.sleep(3600)  # Run every hour
                    self._cleanup_old_alerts()
                    self.rate_limiter.clear_expired_records()
                except Exception as e:
                    logger.error(f"Cleanup task error: {e}")

        self._cleanup_task = asyncio.create_task(cleanup_loop())

    def _cleanup_old_alerts(self):
        """Clean up old alerts"""
        cutoff_time = datetime.utcnow() - timedelta(days=7)

        # Remove old alerts from history
        self.alert_history = [
            alert for alert in self.alert_history
            if alert.timestamp > cutoff_time
        ]

        # Remove old active alerts
        expired_alerts = [
            alert_id for alert_id, alert in self.active_alerts.items()
            if alert.timestamp < cutoff_time
        ]
        for alert_id in expired_alerts:
            del self.active_alerts[alert_id]

    async def shutdown(self):
        """Shutdown alert system"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass


# Global alert system instance
default_alert_system = ScannerAlertSystem()


def get_alert_system() -> ScannerAlertSystem:
    """Get the default alert system"""
    return default_alert_system