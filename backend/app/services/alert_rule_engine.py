"""
Alert Rule Engine for TurtleTrading Alerting System

Orchestrates alert evaluation, processing, and delivery across all channels
including webhooks, email, SMS, and push notifications.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any, Tuple
from collections import defaultdict
import redis.asyncio as redis
from dataclasses import dataclass

from ..models.alert_models import (
    Alert, AlertRule, AlertType, AlertSeverity, NotificationChannel,
    ComparisonOperator, AlertCondition, AlertContext, DeliveryStatus,
    WebhookConfig, EmailConfig, SMSConfig, PushConfig,
    AlertRuleStats, AlertEngineMetrics
)
from .alert_engine import AlertEngine
from .webhook_delivery_service import WebhookDeliveryService
from .email_notification_service import EmailNotificationService
from .sms_push_notification_service import SMSNotificationService, PushNotificationService

logger = logging.getLogger(__name__)


@dataclass
class ProcessingStats:
    """Statistics for alert processing"""
    total_rules_evaluated: int = 0
    total_alerts_generated: int = 0
    total_notifications_sent: int = 0
    processing_time_ms: float = 0.0
    error_count: int = 0


class AlertScheduler:
    """Handles scheduling and timing of alert rule evaluations"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.active_schedules: Dict[str, asyncio.Task] = {}

    async def schedule_rule_evaluation(
        self,
        rule: AlertRule,
        engine: 'AlertRuleEngine'
    ):
        """Schedule periodic evaluation of an alert rule"""
        if rule.rule_id in self.active_schedules:
            # Cancel existing schedule
            self.active_schedules[rule.rule_id].cancel()

        # Create new scheduled task
        task = asyncio.create_task(
            self._periodic_evaluation(rule, engine)
        )
        self.active_schedules[rule.rule_id] = task

        logger.info(f"Scheduled rule {rule.rule_id} for evaluation every {rule.evaluation_interval}s")

    async def unschedule_rule(self, rule_id: str):
        """Unschedule a rule evaluation"""
        if rule_id in self.active_schedules:
            self.active_schedules[rule_id].cancel()
            del self.active_schedules[rule_id]
            logger.info(f"Unscheduled rule {rule_id}")

    async def _periodic_evaluation(
        self,
        rule: AlertRule,
        engine: 'AlertRuleEngine'
    ):
        """Periodically evaluate a rule"""
        try:
            while True:
                await asyncio.sleep(rule.evaluation_interval)

                # Check if rule is still active
                if not rule.is_active:
                    break

                # Evaluate rule
                await engine.evaluate_single_rule(rule)

        except asyncio.CancelledError:
            logger.info(f"Rule evaluation cancelled for {rule.rule_id}")
        except Exception as e:
            logger.error(f"Error in periodic evaluation for rule {rule.rule_id}: {e}")

    async def get_active_schedules(self) -> List[str]:
        """Get list of actively scheduled rule IDs"""
        return list(self.active_schedules.keys())

    async def cleanup_completed_tasks(self):
        """Clean up completed or cancelled tasks"""
        completed_rules = []
        for rule_id, task in self.active_schedules.items():
            if task.done():
                completed_rules.append(rule_id)

        for rule_id in completed_rules:
            del self.active_schedules[rule_id]
            logger.info(f"Cleaned up completed task for rule {rule_id}")


class AlertDeliveryOrchestrator:
    """Orchestrates alert delivery across all notification channels"""

    def __init__(
        self,
        webhook_service: Optional[WebhookDeliveryService] = None,
        email_service: Optional[EmailNotificationService] = None,
        sms_service: Optional[SMSNotificationService] = None,
        push_service: Optional[PushNotificationService] = None
    ):
        self.webhook_service = webhook_service
        self.email_service = email_service
        self.sms_service = sms_service
        self.push_service = push_service

    async def deliver_alert(
        self,
        alert: Alert,
        rule: AlertRule,
        delivery_configs: Dict[str, Any]
    ) -> Dict[str, bool]:
        """
        Deliver alert across all configured channels

        Args:
            alert: Alert to deliver
            rule: Rule that triggered the alert
            delivery_configs: Channel-specific delivery configurations

        Returns:
            Dictionary mapping channel names to delivery success status
        """
        delivery_results = {}
        delivery_tasks = []

        # Prepare delivery tasks for each channel
        for channel in rule.channels:
            if channel == NotificationChannel.WEBHOOK:
                webhook_config = delivery_configs.get('webhook')
                if webhook_config and self.webhook_service:
                    task = self._deliver_webhook(alert, rule, webhook_config)
                    delivery_tasks.append(('webhook', task))

            elif channel == NotificationChannel.EMAIL:
                email_config = delivery_configs.get('email')
                if email_config and self.email_service:
                    task = self._deliver_email(alert, rule, email_config)
                    delivery_tasks.append(('email', task))

            elif channel == NotificationChannel.SMS:
                sms_config = delivery_configs.get('sms')
                if sms_config and self.sms_service:
                    task = self._deliver_sms(alert, rule, sms_config)
                    delivery_tasks.append(('sms', task))

            elif channel == NotificationChannel.PUSH:
                push_config = delivery_configs.get('push')
                if push_config and self.push_service:
                    task = self._deliver_push(alert, rule, push_config)
                    delivery_tasks.append(('push', task))

        # Execute all delivery tasks concurrently
        if delivery_tasks:
            tasks = [task for _, task in delivery_tasks]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Map results back to channels
            for i, (channel, _) in enumerate(delivery_tasks):
                result = results[i]
                if isinstance(result, Exception):
                    logger.error(f"Delivery failed for {channel}: {result}")
                    delivery_results[channel] = False
                else:
                    delivery_results[channel] = result
        else:
            logger.warning(f"No delivery services configured for alert {alert.alert_id}")

        return delivery_results

    async def _deliver_webhook(
        self,
        alert: Alert,
        rule: AlertRule,
        webhook_config: WebhookConfig
    ) -> bool:
        """Deliver via webhook"""
        try:
            return await self.webhook_service.deliver_alert(alert, rule)
        except Exception as e:
            logger.error(f"Webhook delivery failed: {e}")
            return False

    async def _deliver_email(
        self,
        alert: Alert,
        rule: AlertRule,
        email_config: EmailConfig
    ) -> bool:
        """Deliver via email"""
        try:
            return await self.email_service.send_alert_email(alert, rule, email_config)
        except Exception as e:
            logger.error(f"Email delivery failed: {e}")
            return False

    async def _deliver_sms(
        self,
        alert: Alert,
        rule: AlertRule,
        sms_config: SMSConfig
    ) -> bool:
        """Deliver via SMS"""
        try:
            return await self.sms_service.send_alert_sms(alert, rule, sms_config)
        except Exception as e:
            logger.error(f"SMS delivery failed: {e}")
            return False

    async def _deliver_push(
        self,
        alert: Alert,
        rule: AlertRule,
        push_config: PushConfig
    ) -> bool:
        """Deliver via push notification"""
        try:
            return await self.push_service.send_alert_push(alert, rule, push_config)
        except Exception as e:
            logger.error(f"Push delivery failed: {e}")
            return False


class AlertRuleEngine:
    """
    Main alert rule engine that orchestrates the entire alerting system
    including rule evaluation, alert generation, and multi-channel delivery
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        webhook_service: Optional[WebhookDeliveryService] = None,
        email_service: Optional[EmailNotificationService] = None,
        sms_service: Optional[SMSNotificationService] = None,
        push_service: Optional[PushNotificationService] = None
    ):
        self.redis = redis_client
        self.alert_engine = AlertEngine(redis_client)
        self.scheduler = AlertScheduler(redis_client)
        self.delivery_orchestrator = AlertDeliveryOrchestrator(
            webhook_service, email_service, sms_service, push_service
        )

        # Active rules cache
        self.active_rules: Dict[str, AlertRule] = {}
        self.user_rules: Dict[str, List[str]] = defaultdict(list)

        # Metrics and stats
        self.metrics = AlertEngineMetrics()
        self.processing_stats = ProcessingStats()

    async def start_engine(self):
        """Start the alert rule engine"""
        logger.info("Starting Alert Rule Engine...")

        # Load active rules from database/cache
        await self._load_active_rules()

        # Schedule periodic maintenance
        asyncio.create_task(self._periodic_maintenance())

        logger.info(f"Alert Rule Engine started with {len(self.active_rules)} active rules")

    async def stop_engine(self):
        """Stop the alert rule engine"""
        logger.info("Stopping Alert Rule Engine...")

        # Cancel all scheduled evaluations
        for rule_id in list(self.active_rules.keys()):
            await self.scheduler.unschedule_rule(rule_id)

        # Clear caches
        self.active_rules.clear()
        self.user_rules.clear()

        logger.info("Alert Rule Engine stopped")

    async def add_rule(self, rule: AlertRule) -> bool:
        """
        Add a new alert rule to the engine

        Args:
            rule: AlertRule to add

        Returns:
            bool: True if rule was added successfully
        """
        try:
            # Validate rule
            if not await self._validate_rule(rule):
                return False

            # Store rule
            await self._store_rule(rule)

            # Add to active rules cache
            self.active_rules[rule.rule_id] = rule
            self.user_rules[rule.user_id].append(rule.rule_id)

            # Schedule evaluation if active
            if rule.is_active:
                await self.scheduler.schedule_rule_evaluation(rule, self)

            logger.info(f"Added rule {rule.rule_id} for user {rule.user_id}")
            self.metrics.total_rules += 1
            return True

        except Exception as e:
            logger.error(f"Failed to add rule {rule.rule_id}: {e}")
            return False

    async def update_rule(self, rule: AlertRule) -> bool:
        """Update an existing alert rule"""
        try:
            if rule.rule_id not in self.active_rules:
                logger.warning(f"Rule {rule.rule_id} not found for update")
                return False

            # Unschedule old rule
            await self.scheduler.unschedule_rule(rule.rule_id)

            # Update rule
            await self._store_rule(rule)
            self.active_rules[rule.rule_id] = rule

            # Reschedule if active
            if rule.is_active:
                await self.scheduler.schedule_rule_evaluation(rule, self)

            logger.info(f"Updated rule {rule.rule_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to update rule {rule.rule_id}: {e}")
            return False

    async def delete_rule(self, rule_id: str) -> bool:
        """Delete an alert rule"""
        try:
            if rule_id not in self.active_rules:
                return False

            rule = self.active_rules[rule_id]

            # Unschedule rule
            await self.scheduler.unschedule_rule(rule_id)

            # Remove from caches
            del self.active_rules[rule_id]
            if rule_id in self.user_rules[rule.user_id]:
                self.user_rules[rule.user_id].remove(rule_id)

            # Remove from storage
            await self._delete_rule_storage(rule_id)

            logger.info(f"Deleted rule {rule_id}")
            self.metrics.total_rules -= 1
            return True

        except Exception as e:
            logger.error(f"Failed to delete rule {rule_id}: {e}")
            return False

    async def evaluate_single_rule(self, rule: AlertRule) -> List[Alert]:
        """Evaluate a single rule and process any generated alerts"""
        try:
            start_time = datetime.utcnow()

            # Evaluate rule conditions
            alerts = await self.alert_engine.evaluate_rule(rule)

            # Process each generated alert
            processed_alerts = []
            for alert in alerts:
                success = await self._process_alert(alert, rule)
                if success:
                    processed_alerts.append(alert)

            # Update stats
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self.processing_stats.total_rules_evaluated += 1
            self.processing_stats.total_alerts_generated += len(alerts)
            self.processing_stats.processing_time_ms += processing_time

            if processed_alerts:
                logger.info(f"Rule {rule.rule_id} generated {len(processed_alerts)} alerts")

            return processed_alerts

        except Exception as e:
            logger.error(f"Error evaluating rule {rule.rule_id}: {e}")
            self.processing_stats.error_count += 1
            return []

    async def evaluate_market_event(
        self,
        event_type: str,
        event_data: Dict[str, Any],
        symbols: Optional[List[str]] = None
    ) -> List[Alert]:
        """
        Evaluate all relevant rules for a market event

        Args:
            event_type: Type of market event (price_change, technical_signal, etc.)
            event_data: Event data including prices, indicators, etc.
            symbols: List of symbols affected by the event

        Returns:
            List of generated alerts
        """
        try:
            relevant_rules = await self._get_relevant_rules(event_type, symbols)
            all_alerts = []

            # Evaluate relevant rules concurrently
            if relevant_rules:
                tasks = [
                    self.evaluate_single_rule(rule)
                    for rule in relevant_rules
                ]

                results = await asyncio.gather(*tasks, return_exceptions=True)

                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        rule_id = relevant_rules[i].rule_id
                        logger.error(f"Rule evaluation failed for {rule_id}: {result}")
                    else:
                        all_alerts.extend(result)

            return all_alerts

        except Exception as e:
            logger.error(f"Error evaluating market event {event_type}: {e}")
            return []

    async def _process_alert(self, alert: Alert, rule: AlertRule) -> bool:
        """Process a generated alert including delivery"""
        try:
            # Get delivery configurations
            delivery_configs = await self._get_delivery_configs(rule)

            # Deliver alert
            delivery_results = await self.delivery_orchestrator.deliver_alert(
                alert, rule, delivery_configs
            )

            # Update delivery status
            successful_deliveries = sum(1 for success in delivery_results.values() if success)
            total_deliveries = len(delivery_results)

            if successful_deliveries > 0:
                self.processing_stats.total_notifications_sent += successful_deliveries
                self.metrics.total_alerts_sent += 1

            # Store alert with delivery results
            await self._store_alert_result(alert, rule, delivery_results)

            logger.info(
                f"Alert {alert.alert_id} delivered: "
                f"{successful_deliveries}/{total_deliveries} channels successful"
            )

            return successful_deliveries > 0

        except Exception as e:
            logger.error(f"Error processing alert {alert.alert_id}: {e}")
            return False

    async def _validate_rule(self, rule: AlertRule) -> bool:
        """Validate alert rule configuration"""
        try:
            # Check required fields
            if not rule.rule_id or not rule.user_id or not rule.name:
                logger.error("Rule missing required fields")
                return False

            # Validate conditions
            if not rule.conditions:
                logger.error("Rule must have at least one condition")
                return False

            # Validate channels
            if not rule.channels:
                logger.error("Rule must have at least one notification channel")
                return False

            # Validate evaluation interval
            if rule.evaluation_interval < 1:
                logger.error("Evaluation interval must be at least 1 second")
                return False

            return True

        except Exception as e:
            logger.error(f"Rule validation error: {e}")
            return False

    async def _load_active_rules(self):
        """Load active rules from storage"""
        try:
            # In a real implementation, this would load from database
            # For now, we'll load from Redis cache
            pattern = "alert_rule:*"
            keys = await self.redis.keys(pattern)

            for key in keys:
                try:
                    rule_data = await self.redis.get(key)
                    if rule_data:
                        rule_dict = json.loads(rule_data)
                        rule = AlertRule(**rule_dict)

                        if rule.is_active:
                            self.active_rules[rule.rule_id] = rule
                            self.user_rules[rule.user_id].append(rule.rule_id)

                            # Schedule evaluation
                            await self.scheduler.schedule_rule_evaluation(rule, self)

                except Exception as e:
                    logger.warning(f"Failed to load rule from {key}: {e}")

            logger.info(f"Loaded {len(self.active_rules)} active rules")

        except Exception as e:
            logger.error(f"Failed to load active rules: {e}")

    async def _store_rule(self, rule: AlertRule):
        """Store rule in Redis"""
        key = f"alert_rule:{rule.rule_id}"
        data = rule.dict()

        # Convert datetime objects
        for field in ['created_at', 'updated_at']:
            if hasattr(rule, field) and getattr(rule, field):
                data[field] = getattr(rule, field).isoformat()

        await self.redis.setex(
            key,
            86400 * 30,  # 30 days TTL
            json.dumps(data, default=str)
        )

    async def _delete_rule_storage(self, rule_id: str):
        """Delete rule from storage"""
        key = f"alert_rule:{rule_id}"
        await self.redis.delete(key)

    async def _get_relevant_rules(
        self,
        event_type: str,
        symbols: Optional[List[str]] = None
    ) -> List[AlertRule]:
        """Get rules relevant to a market event"""
        relevant_rules = []

        for rule in self.active_rules.values():
            if not rule.is_active:
                continue

            # Check if rule matches event type
            rule_symbols = rule.symbols or []

            if symbols:
                # Check if rule applies to any of the affected symbols
                if rule_symbols and not any(symbol in rule_symbols for symbol in symbols):
                    continue
            elif rule_symbols:
                # Event has no specific symbols, but rule is symbol-specific
                continue

            relevant_rules.append(rule)

        return relevant_rules

    async def _get_delivery_configs(self, rule: AlertRule) -> Dict[str, Any]:
        """Get delivery configurations for a rule"""
        # In a real implementation, this would load user-specific configs
        # For now, return mock configurations
        configs = {}

        if NotificationChannel.WEBHOOK in rule.channels:
            configs['webhook'] = WebhookConfig(
                webhook_id=f"webhook_{rule.user_id}",
                url="https://api.example.com/webhooks/alerts",
                secret="webhook_secret"
            )

        if NotificationChannel.EMAIL in rule.channels:
            configs['email'] = EmailConfig(
                recipient=f"user_{rule.user_id}@example.com",
                template="default_alert"
            )

        # Add other channel configs as needed

        return configs

    async def _store_alert_result(
        self,
        alert: Alert,
        rule: AlertRule,
        delivery_results: Dict[str, bool]
    ):
        """Store alert processing result"""
        result = {
            "alert_id": alert.alert_id,
            "rule_id": rule.rule_id,
            "user_id": rule.user_id,
            "timestamp": alert.timestamp.isoformat(),
            "delivery_results": delivery_results,
            "processed_at": datetime.utcnow().isoformat()
        }

        key = f"alert_result:{alert.alert_id}"
        await self.redis.setex(
            key,
            86400 * 7,  # 7 days TTL
            json.dumps(result)
        )

    async def _periodic_maintenance(self):
        """Periodic maintenance tasks"""
        while True:
            try:
                # Clean up completed scheduler tasks
                await self.scheduler.cleanup_completed_tasks()

                # Update metrics
                await self._update_metrics()

                # Sleep for 5 minutes
                await asyncio.sleep(300)

            except Exception as e:
                logger.error(f"Maintenance task error: {e}")
                await asyncio.sleep(60)  # Shorter sleep on error

    async def _update_metrics(self):
        """Update engine metrics"""
        try:
            self.metrics.active_rules = len(self.active_rules)
            self.metrics.total_users = len(self.user_rules)
            self.metrics.last_evaluation = datetime.utcnow()

            # Store metrics in Redis
            metrics_data = self.metrics.dict()
            for field in ['last_evaluation']:
                if hasattr(self.metrics, field) and getattr(self.metrics, field):
                    metrics_data[field] = getattr(self.metrics, field).isoformat()

            await self.redis.setex(
                "alert_engine_metrics",
                3600,  # 1 hour TTL
                json.dumps(metrics_data, default=str)
            )

        except Exception as e:
            logger.error(f"Failed to update metrics: {e}")

    async def get_engine_status(self) -> Dict[str, Any]:
        """Get current engine status and statistics"""
        active_schedules = await self.scheduler.get_active_schedules()

        return {
            "engine_metrics": self.metrics.dict(),
            "processing_stats": {
                "total_rules_evaluated": self.processing_stats.total_rules_evaluated,
                "total_alerts_generated": self.processing_stats.total_alerts_generated,
                "total_notifications_sent": self.processing_stats.total_notifications_sent,
                "avg_processing_time_ms": (
                    self.processing_stats.processing_time_ms /
                    max(1, self.processing_stats.total_rules_evaluated)
                ),
                "error_count": self.processing_stats.error_count
            },
            "active_rules": len(self.active_rules),
            "active_schedules": len(active_schedules),
            "users_with_rules": len(self.user_rules)
        }

    async def get_user_rules(self, user_id: str) -> List[AlertRule]:
        """Get all rules for a specific user"""
        user_rule_ids = self.user_rules.get(user_id, [])
        return [
            self.active_rules[rule_id]
            for rule_id in user_rule_ids
            if rule_id in self.active_rules
        ]