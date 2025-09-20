"""
Alert Analytics and Tracking Service for TurtleTrading Alerting System

Provides comprehensive analytics, metrics collection, and performance tracking
for the alerting system including user engagement and delivery analytics.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict, Counter
from dataclasses import dataclass, field
import redis.asyncio as redis
from enum import Enum

from ..models.alert_models import (
    Alert, AlertRule, AlertType, AlertSeverity, NotificationChannel,
    DeliveryStatus, AlertAnalytics, UserEngagementMetrics,
    AlertPerformanceMetrics, ChannelPerformanceMetrics
)

logger = logging.getLogger(__name__)


class MetricsPeriod(Enum):
    """Time periods for metrics aggregation"""
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


@dataclass
class AlertMetrics:
    """Core alert metrics"""
    total_alerts: int = 0
    alerts_by_type: Dict[str, int] = field(default_factory=dict)
    alerts_by_severity: Dict[str, int] = field(default_factory=dict)
    alerts_by_channel: Dict[str, int] = field(default_factory=dict)
    avg_processing_time_ms: float = 0.0
    delivery_success_rate: float = 0.0


@dataclass
class UserMetrics:
    """User engagement metrics"""
    user_id: str = ""
    total_rules: int = 0
    active_rules: int = 0
    total_alerts_received: int = 0
    alerts_acknowledged: int = 0
    alerts_dismissed: int = 0
    preferred_channels: List[str] = field(default_factory=list)
    avg_response_time_minutes: float = 0.0
    last_activity: Optional[datetime] = None


@dataclass
class ChannelMetrics:
    """Notification channel performance metrics"""
    channel: str = ""
    total_sent: int = 0
    successful_deliveries: int = 0
    failed_deliveries: int = 0
    avg_delivery_time_ms: float = 0.0
    bounce_rate: float = 0.0
    engagement_rate: float = 0.0


class AlertTracker:
    """Tracks individual alert lifecycle and performance"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def track_alert_created(self, alert: Alert, rule: AlertRule):
        """Track when an alert is created"""
        try:
            tracking_data = {
                "event": "alert_created",
                "alert_id": alert.alert_id,
                "rule_id": rule.rule_id,
                "user_id": rule.user_id,
                "alert_type": alert.alert_type.value if alert.alert_type else "unknown",
                "severity": alert.severity.value,
                "symbol": alert.symbol,
                "timestamp": alert.timestamp.isoformat(),
                "channels": [ch.value for ch in rule.channels]
            }

            # Store in alert timeline
            await self._store_alert_event(alert.alert_id, tracking_data)

            # Update metrics
            await self._update_creation_metrics(alert, rule)

            logger.debug(f"Tracked alert creation: {alert.alert_id}")

        except Exception as e:
            logger.error(f"Error tracking alert creation: {e}")

    async def track_alert_delivery(
        self,
        alert: Alert,
        channel: NotificationChannel,
        success: bool,
        delivery_time_ms: Optional[float] = None,
        error_message: Optional[str] = None
    ):
        """Track alert delivery attempt"""
        try:
            tracking_data = {
                "event": "alert_delivery",
                "alert_id": alert.alert_id,
                "channel": channel.value,
                "success": success,
                "delivery_time_ms": delivery_time_ms,
                "error_message": error_message,
                "timestamp": datetime.utcnow().isoformat()
            }

            # Store in alert timeline
            await self._store_alert_event(alert.alert_id, tracking_data)

            # Update delivery metrics
            await self._update_delivery_metrics(alert, channel, success, delivery_time_ms)

            logger.debug(f"Tracked delivery for {alert.alert_id} via {channel.value}: {success}")

        except Exception as e:
            logger.error(f"Error tracking alert delivery: {e}")

    async def track_user_interaction(
        self,
        alert_id: str,
        user_id: str,
        interaction_type: str,
        interaction_data: Optional[Dict[str, Any]] = None
    ):
        """Track user interaction with alert"""
        try:
            tracking_data = {
                "event": "user_interaction",
                "alert_id": alert_id,
                "user_id": user_id,
                "interaction_type": interaction_type,  # acknowledged, dismissed, clicked, etc.
                "interaction_data": interaction_data or {},
                "timestamp": datetime.utcnow().isoformat()
            }

            # Store in alert timeline
            await self._store_alert_event(alert_id, tracking_data)

            # Update user engagement metrics
            await self._update_user_engagement(user_id, interaction_type)

            logger.debug(f"Tracked user interaction: {user_id} {interaction_type} {alert_id}")

        except Exception as e:
            logger.error(f"Error tracking user interaction: {e}")

    async def get_alert_timeline(self, alert_id: str) -> List[Dict[str, Any]]:
        """Get complete timeline for an alert"""
        try:
            timeline_key = f"alert_timeline:{alert_id}"
            timeline_data = await self.redis.lrange(timeline_key, 0, -1)

            timeline = []
            for item in timeline_data:
                try:
                    event = json.loads(item)
                    timeline.append(event)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid timeline data for {alert_id}")

            return sorted(timeline, key=lambda x: x.get('timestamp', ''))

        except Exception as e:
            logger.error(f"Error getting alert timeline: {e}")
            return []

    async def _store_alert_event(self, alert_id: str, event_data: Dict[str, Any]):
        """Store event in alert timeline"""
        timeline_key = f"alert_timeline:{alert_id}"
        event_json = json.dumps(event_data, default=str)

        await self.redis.lpush(timeline_key, event_json)
        await self.redis.expire(timeline_key, 86400 * 30)  # 30 days retention

    async def _update_creation_metrics(self, alert: Alert, rule: AlertRule):
        """Update alert creation metrics"""
        now = datetime.utcnow()
        hour_key = f"metrics:alerts_created:{now.strftime('%Y%m%d%H')}"
        day_key = f"metrics:alerts_created:{now.strftime('%Y%m%d')}"

        # Update counters
        await self.redis.incr(hour_key)
        await self.redis.expire(hour_key, 86400 * 7)  # 7 days retention

        await self.redis.incr(day_key)
        await self.redis.expire(day_key, 86400 * 90)  # 90 days retention

        # Update type-specific metrics
        if alert.alert_type:
            type_key = f"metrics:alerts_by_type:{alert.alert_type.value}:{now.strftime('%Y%m%d')}"
            await self.redis.incr(type_key)
            await self.redis.expire(type_key, 86400 * 90)

        # Update severity metrics
        severity_key = f"metrics:alerts_by_severity:{alert.severity.value}:{now.strftime('%Y%m%d')}"
        await self.redis.incr(severity_key)
        await self.redis.expire(severity_key, 86400 * 90)

    async def _update_delivery_metrics(
        self,
        alert: Alert,
        channel: NotificationChannel,
        success: bool,
        delivery_time_ms: Optional[float]
    ):
        """Update delivery metrics"""
        now = datetime.utcnow()
        day_key = now.strftime('%Y%m%d')

        # Update channel-specific metrics
        channel_sent_key = f"metrics:channel_sent:{channel.value}:{day_key}"
        await self.redis.incr(channel_sent_key)
        await self.redis.expire(channel_sent_key, 86400 * 90)

        if success:
            channel_success_key = f"metrics:channel_success:{channel.value}:{day_key}"
            await self.redis.incr(channel_success_key)
            await self.redis.expire(channel_success_key, 86400 * 90)

            # Update delivery time
            if delivery_time_ms:
                delivery_time_key = f"metrics:delivery_time:{channel.value}:{day_key}"
                await self.redis.lpush(delivery_time_key, str(delivery_time_ms))
                await self.redis.ltrim(delivery_time_key, 0, 999)  # Keep last 1000 samples
                await self.redis.expire(delivery_time_key, 86400 * 30)
        else:
            channel_failed_key = f"metrics:channel_failed:{channel.value}:{day_key}"
            await self.redis.incr(channel_failed_key)
            await self.redis.expire(channel_failed_key, 86400 * 90)

    async def _update_user_engagement(self, user_id: str, interaction_type: str):
        """Update user engagement metrics"""
        now = datetime.utcnow()
        day_key = now.strftime('%Y%m%d')

        # Update user activity
        user_activity_key = f"metrics:user_activity:{user_id}:{day_key}"
        await self.redis.incr(user_activity_key)
        await self.redis.expire(user_activity_key, 86400 * 90)

        # Update interaction type metrics
        interaction_key = f"metrics:user_interactions:{interaction_type}:{day_key}"
        await self.redis.incr(interaction_key)
        await self.redis.expire(interaction_key, 86400 * 90)

        # Update last activity timestamp
        last_activity_key = f"metrics:user_last_activity:{user_id}"
        await self.redis.set(last_activity_key, now.isoformat())
        await self.redis.expire(last_activity_key, 86400 * 365)  # 1 year retention


class AlertAnalyticsService:
    """Main analytics service for comprehensive alert system metrics"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.tracker = AlertTracker(redis_client)

    async def get_alert_metrics(
        self,
        period: MetricsPeriod,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> AlertMetrics:
        """Get aggregated alert metrics for a time period"""
        try:
            if not start_date:
                start_date = self._get_period_start(period)
            if not end_date:
                end_date = datetime.utcnow()

            metrics = AlertMetrics()

            # Get alert counts
            metrics.total_alerts = await self._get_metric_sum(
                "metrics:alerts_created", start_date, end_date, period
            )

            # Get alerts by type
            for alert_type in AlertType:
                count = await self._get_metric_sum(
                    f"metrics:alerts_by_type:{alert_type.value}",
                    start_date, end_date, period
                )
                if count > 0:
                    metrics.alerts_by_type[alert_type.value] = count

            # Get alerts by severity
            for severity in AlertSeverity:
                count = await self._get_metric_sum(
                    f"metrics:alerts_by_severity:{severity.value}",
                    start_date, end_date, period
                )
                if count > 0:
                    metrics.alerts_by_severity[severity.value] = count

            # Get channel metrics
            for channel in NotificationChannel:
                count = await self._get_metric_sum(
                    f"metrics:channel_sent:{channel.value}",
                    start_date, end_date, period
                )
                if count > 0:
                    metrics.alerts_by_channel[channel.value] = count

            # Calculate delivery success rate
            total_sent = sum(metrics.alerts_by_channel.values())
            if total_sent > 0:
                total_successful = 0
                for channel in NotificationChannel:
                    successful = await self._get_metric_sum(
                        f"metrics:channel_success:{channel.value}",
                        start_date, end_date, period
                    )
                    total_successful += successful

                metrics.delivery_success_rate = (total_successful / total_sent) * 100

            return metrics

        except Exception as e:
            logger.error(f"Error getting alert metrics: {e}")
            return AlertMetrics()

    async def get_user_metrics(
        self,
        user_id: str,
        period: MetricsPeriod,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> UserMetrics:
        """Get user engagement metrics"""
        try:
            if not start_date:
                start_date = self._get_period_start(period)
            if not end_date:
                end_date = datetime.utcnow()

            metrics = UserMetrics(user_id=user_id)

            # Get user activity
            metrics.total_alerts_received = await self._get_user_metric_sum(
                user_id, "metrics:user_activity", start_date, end_date, period
            )

            # Get interaction metrics
            metrics.alerts_acknowledged = await self._get_metric_sum(
                "metrics:user_interactions:acknowledged",
                start_date, end_date, period
            )

            metrics.alerts_dismissed = await self._get_metric_sum(
                "metrics:user_interactions:dismissed",
                start_date, end_date, period
            )

            # Get last activity
            last_activity_key = f"metrics:user_last_activity:{user_id}"
            last_activity_str = await self.redis.get(last_activity_key)
            if last_activity_str:
                metrics.last_activity = datetime.fromisoformat(last_activity_str)

            # Get preferred channels (top 3)
            channel_preferences = {}
            for channel in NotificationChannel:
                count = await self._get_user_channel_usage(user_id, channel.value, start_date, end_date)
                if count > 0:
                    channel_preferences[channel.value] = count

            metrics.preferred_channels = sorted(
                channel_preferences.keys(),
                key=lambda x: channel_preferences[x],
                reverse=True
            )[:3]

            return metrics

        except Exception as e:
            logger.error(f"Error getting user metrics for {user_id}: {e}")
            return UserMetrics(user_id=user_id)

    async def get_channel_performance(
        self,
        channel: NotificationChannel,
        period: MetricsPeriod,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> ChannelMetrics:
        """Get performance metrics for a notification channel"""
        try:
            if not start_date:
                start_date = self._get_period_start(period)
            if not end_date:
                end_date = datetime.utcnow()

            metrics = ChannelMetrics(channel=channel.value)

            # Get delivery counts
            metrics.total_sent = await self._get_metric_sum(
                f"metrics:channel_sent:{channel.value}",
                start_date, end_date, period
            )

            metrics.successful_deliveries = await self._get_metric_sum(
                f"metrics:channel_success:{channel.value}",
                start_date, end_date, period
            )

            metrics.failed_deliveries = await self._get_metric_sum(
                f"metrics:channel_failed:{channel.value}",
                start_date, end_date, period
            )

            # Calculate rates
            if metrics.total_sent > 0:
                metrics.bounce_rate = (metrics.failed_deliveries / metrics.total_sent) * 100

            # Get average delivery time
            metrics.avg_delivery_time_ms = await self._get_avg_delivery_time(
                channel.value, start_date, end_date
            )

            return metrics

        except Exception as e:
            logger.error(f"Error getting channel performance for {channel.value}: {e}")
            return ChannelMetrics(channel=channel.value)

    async def get_system_health_metrics(self) -> Dict[str, Any]:
        """Get overall system health metrics"""
        try:
            now = datetime.utcnow()
            today = now.strftime('%Y%m%d')
            yesterday = (now - timedelta(days=1)).strftime('%Y%m%d')

            # Get current day metrics
            today_alerts = await self.redis.get(f"metrics:alerts_created:{today}") or 0
            yesterday_alerts = await self.redis.get(f"metrics:alerts_created:{yesterday}") or 0

            # Calculate trends
            alert_trend = 0
            if int(yesterday_alerts) > 0:
                alert_trend = ((int(today_alerts) - int(yesterday_alerts)) / int(yesterday_alerts)) * 100

            # Get error rates
            total_errors = 0
            total_attempts = 0

            for channel in NotificationChannel:
                sent = await self.redis.get(f"metrics:channel_sent:{channel.value}:{today}") or 0
                failed = await self.redis.get(f"metrics:channel_failed:{channel.value}:{today}") or 0

                total_attempts += int(sent)
                total_errors += int(failed)

            error_rate = (total_errors / max(1, total_attempts)) * 100

            # Get active users (users with activity in last 24 hours)
            active_users = await self._count_active_users(24)

            return {
                "alerts_today": int(today_alerts),
                "alerts_yesterday": int(yesterday_alerts),
                "alert_trend_percent": round(alert_trend, 2),
                "error_rate_percent": round(error_rate, 2),
                "total_delivery_attempts": total_attempts,
                "failed_deliveries": total_errors,
                "active_users_24h": active_users,
                "system_status": "healthy" if error_rate < 5 else "degraded" if error_rate < 15 else "critical",
                "last_updated": now.isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting system health metrics: {e}")
            return {
                "system_status": "unknown",
                "error": str(e),
                "last_updated": datetime.utcnow().isoformat()
            }

    async def generate_analytics_report(
        self,
        period: MetricsPeriod,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate comprehensive analytics report"""
        try:
            start_date = self._get_period_start(period)
            end_date = datetime.utcnow()

            report = {
                "period": period.value,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "generated_at": end_date.isoformat()
            }

            # Overall alert metrics
            report["alert_metrics"] = (
                await self.get_alert_metrics(period, start_date, end_date)
            ).__dict__

            # Channel performance
            report["channel_performance"] = {}
            for channel in NotificationChannel:
                channel_metrics = await self.get_channel_performance(
                    channel, period, start_date, end_date
                )
                report["channel_performance"][channel.value] = channel_metrics.__dict__

            # User-specific metrics if requested
            if user_id:
                report["user_metrics"] = (
                    await self.get_user_metrics(user_id, period, start_date, end_date)
                ).__dict__

            # System health
            report["system_health"] = await self.get_system_health_metrics()

            return report

        except Exception as e:
            logger.error(f"Error generating analytics report: {e}")
            return {
                "error": str(e),
                "generated_at": datetime.utcnow().isoformat()
            }

    async def _get_metric_sum(
        self,
        metric_prefix: str,
        start_date: datetime,
        end_date: datetime,
        period: MetricsPeriod
    ) -> int:
        """Get sum of metric values over a time period"""
        total = 0
        current_date = start_date

        while current_date <= end_date:
            if period == MetricsPeriod.HOUR:
                key = f"{metric_prefix}:{current_date.strftime('%Y%m%d%H')}"
                current_date += timedelta(hours=1)
            else:  # DAY and longer periods use daily aggregation
                key = f"{metric_prefix}:{current_date.strftime('%Y%m%d')}"
                current_date += timedelta(days=1)

            value = await self.redis.get(key)
            if value:
                total += int(value)

        return total

    async def _get_user_metric_sum(
        self,
        user_id: str,
        metric_prefix: str,
        start_date: datetime,
        end_date: datetime,
        period: MetricsPeriod
    ) -> int:
        """Get sum of user-specific metric values"""
        total = 0
        current_date = start_date

        while current_date <= end_date:
            key = f"{metric_prefix}:{user_id}:{current_date.strftime('%Y%m%d')}"
            value = await self.redis.get(key)
            if value:
                total += int(value)
            current_date += timedelta(days=1)

        return total

    async def _get_user_channel_usage(
        self,
        user_id: str,
        channel: str,
        start_date: datetime,
        end_date: datetime
    ) -> int:
        """Get user's channel usage count"""
        # This would require tracking user-channel specific metrics
        # For now, return a placeholder implementation
        return 0

    async def _get_avg_delivery_time(
        self,
        channel: str,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """Get average delivery time for a channel"""
        try:
            current_date = start_date
            all_times = []

            while current_date <= end_date:
                key = f"metrics:delivery_time:{channel}:{current_date.strftime('%Y%m%d')}"
                times = await self.redis.lrange(key, 0, -1)

                for time_str in times:
                    try:
                        all_times.append(float(time_str))
                    except ValueError:
                        continue

                current_date += timedelta(days=1)

            if all_times:
                return sum(all_times) / len(all_times)

            return 0.0

        except Exception as e:
            logger.error(f"Error calculating average delivery time: {e}")
            return 0.0

    async def _count_active_users(self, hours: int) -> int:
        """Count users with activity in the last N hours"""
        try:
            # Get all user last activity keys
            pattern = "metrics:user_last_activity:*"
            keys = await self.redis.keys(pattern)

            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            active_count = 0

            for key in keys:
                last_activity_str = await self.redis.get(key)
                if last_activity_str:
                    try:
                        last_activity = datetime.fromisoformat(last_activity_str)
                        if last_activity > cutoff_time:
                            active_count += 1
                    except ValueError:
                        continue

            return active_count

        except Exception as e:
            logger.error(f"Error counting active users: {e}")
            return 0

    def _get_period_start(self, period: MetricsPeriod) -> datetime:
        """Get start date for a metrics period"""
        now = datetime.utcnow()

        if period == MetricsPeriod.HOUR:
            return now - timedelta(hours=1)
        elif period == MetricsPeriod.DAY:
            return now - timedelta(days=1)
        elif period == MetricsPeriod.WEEK:
            return now - timedelta(weeks=1)
        elif period == MetricsPeriod.MONTH:
            return now - timedelta(days=30)
        elif period == MetricsPeriod.QUARTER:
            return now - timedelta(days=90)
        elif period == MetricsPeriod.YEAR:
            return now - timedelta(days=365)
        else:
            return now - timedelta(days=1)

    async def cleanup_old_metrics(self, days_to_keep: int = 90):
        """Clean up old metrics data"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            cutoff_str = cutoff_date.strftime('%Y%m%d')

            # Get all metrics keys
            patterns = [
                "metrics:alerts_created:*",
                "metrics:alerts_by_type:*",
                "metrics:alerts_by_severity:*",
                "metrics:channel_*:*",
                "metrics:user_activity:*",
                "metrics:user_interactions:*"
            ]

            deleted_count = 0
            for pattern in patterns:
                keys = await self.redis.keys(pattern)

                for key in keys:
                    # Extract date from key
                    key_parts = key.split(":")
                    if len(key_parts) >= 3:
                        date_part = key_parts[-1]
                        if len(date_part) >= 8 and date_part[:8] < cutoff_str:
                            await self.redis.delete(key)
                            deleted_count += 1

            logger.info(f"Cleaned up {deleted_count} old metrics records")

        except Exception as e:
            logger.error(f"Error cleaning up old metrics: {e}")


async def start_analytics_cleanup_task(analytics_service: AlertAnalyticsService):
    """Start periodic cleanup task for analytics data"""
    while True:
        try:
            await asyncio.sleep(86400)  # Run daily
            await analytics_service.cleanup_old_metrics()
        except Exception as e:
            logger.error(f"Analytics cleanup task error: {e}")
            await asyncio.sleep(3600)  # Retry in 1 hour on error