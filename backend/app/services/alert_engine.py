"""
Alert Engine Core

Central alert processing engine that handles alert generation, rule evaluation,
rate limiting, and delivery coordination.
"""

import asyncio
import uuid
from typing import Optional, List, Dict, Any, Set, Callable
from datetime import datetime, timedelta, time
from decimal import Decimal
import logging
from collections import defaultdict, deque
import json

from ..models.alert_models import (
    AlertRule, Alert, AlertCondition, AlertType, AlertSeverity, AlertStatus,
    AlertFrequency, ComparisonOperator, NotificationChannel, AlertRateLimit,
    AlertSystemConfig
)
from ..models.risk_models import Position, Portfolio
from ..services.stock_service import StockService

logger = logging.getLogger(__name__)


class AlertConditionEvaluator:
    """Evaluates individual alert conditions"""

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service

    async def evaluate_condition(
        self,
        condition: AlertCondition,
        symbol: str,
        current_data: Dict[str, Any],
        historical_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Optional[str], Optional[Any]]:
        """
        Evaluate a single alert condition

        Returns:
            (is_met, description, current_value)
        """
        try:
            field_value = await self._get_field_value(condition.field, symbol, current_data, historical_data)

            if field_value is None:
                return False, f"Field {condition.field} not available", None

            is_met = self._compare_values(field_value, condition.operator, condition.value)
            description = self._generate_condition_description(condition, field_value)

            return is_met, description, field_value

        except Exception as e:
            logger.error(f"Error evaluating condition {condition.field}: {e}")
            return False, f"Error evaluating condition: {str(e)}", None

    async def _get_field_value(
        self,
        field: str,
        symbol: str,
        current_data: Dict[str, Any],
        historical_data: Optional[Dict[str, Any]]
    ) -> Optional[Any]:
        """Get the current value for a field"""
        try:
            # Direct field access
            if field in current_data:
                return current_data[field]

            # Common field mappings
            field_map = {
                'price': 'current_price',
                'close': 'current_price',
                'volume': 'volume',
                'change': 'change',
                'change_percent': 'change_percent',
                'high': 'day_high',
                'low': 'day_low',
                'open': 'day_open'
            }

            mapped_field = field_map.get(field, field)
            if mapped_field in current_data:
                return current_data[mapped_field]

            # Technical indicators
            if field.startswith('sma_') or field.startswith('ema_') or field in ['rsi', 'macd', 'bb_upper', 'bb_lower']:
                technical_data = await self.stock_service.get_technical_indicators(symbol)
                if technical_data and field in technical_data:
                    return technical_data[field]

            # Historical comparisons
            if historical_data and field in historical_data:
                return historical_data[field]

            return None

        except Exception as e:
            logger.error(f"Error getting field value for {field}: {e}")
            return None

    def _compare_values(self, field_value: Any, operator: ComparisonOperator, threshold_value: Any) -> bool:
        """Compare field value against threshold using operator"""
        try:
            # Convert to Decimal for numeric comparisons
            if isinstance(field_value, (int, float, Decimal)):
                field_val = Decimal(str(field_value))
            else:
                field_val = field_value

            if operator == ComparisonOperator.EQUALS:
                return field_val == threshold_value

            elif operator == ComparisonOperator.NOT_EQUALS:
                return field_val != threshold_value

            elif operator == ComparisonOperator.GREATER_THAN:
                return field_val > Decimal(str(threshold_value))

            elif operator == ComparisonOperator.GREATER_THAN_OR_EQUAL:
                return field_val >= Decimal(str(threshold_value))

            elif operator == ComparisonOperator.LESS_THAN:
                return field_val < Decimal(str(threshold_value))

            elif operator == ComparisonOperator.LESS_THAN_OR_EQUAL:
                return field_val <= Decimal(str(threshold_value))

            elif operator == ComparisonOperator.BETWEEN:
                if isinstance(threshold_value, list) and len(threshold_value) == 2:
                    low, high = Decimal(str(threshold_value[0])), Decimal(str(threshold_value[1]))
                    return low <= field_val <= high

            elif operator == ComparisonOperator.NOT_BETWEEN:
                if isinstance(threshold_value, list) and len(threshold_value) == 2:
                    low, high = Decimal(str(threshold_value[0])), Decimal(str(threshold_value[1]))
                    return not (low <= field_val <= high)

            elif operator == ComparisonOperator.PERCENT_CHANGE:
                # Calculate percentage change from threshold
                if Decimal(str(threshold_value)) != 0:
                    pct_change = (field_val - Decimal(str(threshold_value))) / Decimal(str(threshold_value)) * 100
                    return abs(pct_change) >= Decimal(5)  # Default 5% change

            return False

        except Exception as e:
            logger.error(f"Error comparing values: {e}")
            return False

    def _generate_condition_description(self, condition: AlertCondition, current_value: Any) -> str:
        """Generate human-readable condition description"""
        try:
            field_name = condition.field.replace('_', ' ').title()
            operator_text = {
                ComparisonOperator.EQUALS: "equals",
                ComparisonOperator.NOT_EQUALS: "does not equal",
                ComparisonOperator.GREATER_THAN: "is greater than",
                ComparisonOperator.GREATER_THAN_OR_EQUAL: "is greater than or equal to",
                ComparisonOperator.LESS_THAN: "is less than",
                ComparisonOperator.LESS_THAN_OR_EQUAL: "is less than or equal to",
                ComparisonOperator.BETWEEN: "is between",
                ComparisonOperator.NOT_BETWEEN: "is not between",
                ComparisonOperator.PERCENT_CHANGE: "changed by more than",
            }.get(condition.operator, str(condition.operator))

            return f"{field_name} {operator_text} {condition.value} (current: {current_value})"

        except Exception as e:
            logger.error(f"Error generating condition description: {e}")
            return f"{condition.field} {condition.operator} {condition.value}"


class AlertRateLimiter:
    """Manages rate limiting for alerts"""

    def __init__(self):
        self.user_limits: Dict[str, AlertRateLimit] = {}
        self.rule_limits: Dict[str, AlertRateLimit] = {}

    def can_send_alert(self, user_id: str, rule_id: Optional[str] = None) -> bool:
        """Check if alert can be sent based on rate limits"""
        try:
            now = datetime.utcnow()

            # Check user-level limits
            user_limit = self._get_or_create_user_limit(user_id)
            self._update_counters(user_limit, now)

            if self._is_rate_limited(user_limit):
                return False

            # Check rule-level limits if specified
            if rule_id:
                rule_limit = self._get_or_create_rule_limit(rule_id, user_id)
                self._update_counters(rule_limit, now)

                if self._is_rate_limited(rule_limit):
                    return False

            return True

        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            return True  # Allow on error to avoid blocking alerts

    def record_alert(self, user_id: str, rule_id: Optional[str] = None):
        """Record that an alert was sent"""
        try:
            now = datetime.utcnow()

            # Record for user
            user_limit = self._get_or_create_user_limit(user_id)
            user_limit.alerts_this_minute += 1
            user_limit.alerts_this_hour += 1
            user_limit.alerts_this_day += 1
            user_limit.last_alert_at = now

            # Record for rule
            if rule_id:
                rule_limit = self._get_or_create_rule_limit(rule_id, user_id)
                rule_limit.alerts_this_minute += 1
                rule_limit.alerts_this_hour += 1
                rule_limit.alerts_this_day += 1
                rule_limit.last_alert_at = now

        except Exception as e:
            logger.error(f"Error recording alert: {e}")

    def _get_or_create_user_limit(self, user_id: str) -> AlertRateLimit:
        """Get or create user rate limit record"""
        if user_id not in self.user_limits:
            self.user_limits[user_id] = AlertRateLimit(user_id=user_id)
        return self.user_limits[user_id]

    def _get_or_create_rule_limit(self, rule_id: str, user_id: str) -> AlertRateLimit:
        """Get or create rule rate limit record"""
        if rule_id not in self.rule_limits:
            self.rule_limits[rule_id] = AlertRateLimit(
                user_id=user_id,
                rule_id=rule_id,
                max_alerts_per_minute=5,  # Lower limits for individual rules
                max_alerts_per_hour=50,
                max_alerts_per_day=500
            )
        return self.rule_limits[rule_id]

    def _update_counters(self, limit: AlertRateLimit, now: datetime):
        """Update rate limit counters"""
        # Reset minute counter
        if limit.last_reset_minute is None or (now - limit.last_reset_minute).seconds >= 60:
            limit.alerts_this_minute = 0
            limit.last_reset_minute = now

        # Reset hour counter
        if limit.last_reset_hour is None or (now - limit.last_reset_hour).seconds >= 3600:
            limit.alerts_this_hour = 0
            limit.last_reset_hour = now

        # Reset day counter
        if limit.last_reset_day is None or (now - limit.last_reset_day).days >= 1:
            limit.alerts_this_day = 0
            limit.last_reset_day = now

    def _is_rate_limited(self, limit: AlertRateLimit) -> bool:
        """Check if rate limit is exceeded"""
        return (
            limit.alerts_this_minute >= limit.max_alerts_per_minute or
            limit.alerts_this_hour >= limit.max_alerts_per_hour or
            limit.alerts_this_day >= limit.max_alerts_per_day
        )


class AlertEngine:
    """
    Core alert processing engine
    """

    def __init__(self, stock_service: StockService):
        self.stock_service = stock_service
        self.condition_evaluator = AlertConditionEvaluator(stock_service)
        self.rate_limiter = AlertRateLimiter()

        # Configuration
        self.config = AlertSystemConfig()

        # Active rules
        self.active_rules: Dict[str, AlertRule] = {}
        self.rule_cooldowns: Dict[str, datetime] = {}

        # Processing queues
        self.alert_queue: asyncio.Queue = asyncio.Queue(maxsize=self.config.alert_queue_size)
        self.priority_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)

        # Delivery handlers
        self.delivery_handlers: Dict[NotificationChannel, Callable] = {}

        # Background tasks
        self._processing_task: Optional[asyncio.Task] = None
        self._monitoring_task: Optional[asyncio.Task] = None
        self._running = False

        # Statistics
        self.stats = {
            'alerts_generated': 0,
            'alerts_delivered': 0,
            'alerts_failed': 0,
            'rules_evaluated': 0,
            'conditions_checked': 0
        }

    async def start(self):
        """Start the alert engine"""
        try:
            if self._running:
                logger.warning("Alert engine already running")
                return

            self._running = True

            # Start background tasks
            self._processing_task = asyncio.create_task(self._process_alerts())
            self._monitoring_task = asyncio.create_task(self._monitor_rules())

            logger.info("Alert engine started successfully")

        except Exception as e:
            logger.error(f"Error starting alert engine: {e}")
            raise

    async def stop(self):
        """Stop the alert engine"""
        try:
            self._running = False

            # Cancel background tasks
            if self._processing_task:
                self._processing_task.cancel()
            if self._monitoring_task:
                self._monitoring_task.cancel()

            # Wait for tasks to complete
            if self._processing_task:
                try:
                    await self._processing_task
                except asyncio.CancelledError:
                    pass

            if self._monitoring_task:
                try:
                    await self._monitoring_task
                except asyncio.CancelledError:
                    pass

            logger.info("Alert engine stopped")

        except Exception as e:
            logger.error(f"Error stopping alert engine: {e}")

    def register_delivery_handler(self, channel: NotificationChannel, handler: Callable):
        """Register a delivery handler for a notification channel"""
        self.delivery_handlers[channel] = handler
        logger.info(f"Registered delivery handler for {channel}")

    async def add_rule(self, rule: AlertRule):
        """Add an alert rule to the engine"""
        try:
            if rule.active:
                self.active_rules[rule.rule_id] = rule
                logger.info(f"Added active alert rule: {rule.name} ({rule.rule_id})")
            else:
                logger.info(f"Added inactive alert rule: {rule.name} ({rule.rule_id})")

        except Exception as e:
            logger.error(f"Error adding alert rule {rule.rule_id}: {e}")

    async def remove_rule(self, rule_id: str):
        """Remove an alert rule from the engine"""
        try:
            if rule_id in self.active_rules:
                del self.active_rules[rule_id]
                logger.info(f"Removed alert rule: {rule_id}")

            if rule_id in self.rule_cooldowns:
                del self.rule_cooldowns[rule_id]

        except Exception as e:
            logger.error(f"Error removing alert rule {rule_id}: {e}")

    async def update_rule(self, rule: AlertRule):
        """Update an existing alert rule"""
        try:
            if rule.active:
                self.active_rules[rule.rule_id] = rule
            elif rule.rule_id in self.active_rules:
                del self.active_rules[rule.rule_id]

            rule.updated_at = datetime.utcnow()
            logger.info(f"Updated alert rule: {rule.name} ({rule.rule_id})")

        except Exception as e:
            logger.error(f"Error updating alert rule {rule.rule_id}: {e}")

    async def evaluate_rules_for_symbol(self, symbol: str, market_data: Dict[str, Any]):
        """Evaluate all rules for a specific symbol"""
        try:
            relevant_rules = [
                rule for rule in self.active_rules.values()
                if self._rule_applies_to_symbol(rule, symbol)
            ]

            for rule in relevant_rules:
                await self._evaluate_rule(rule, symbol, market_data)

        except Exception as e:
            logger.error(f"Error evaluating rules for symbol {symbol}: {e}")

    async def evaluate_rules_for_portfolio(self, portfolio: Portfolio):
        """Evaluate portfolio-specific rules"""
        try:
            portfolio_rules = [
                rule for rule in self.active_rules.values()
                if rule.portfolio_id == portfolio.portfolio_id
            ]

            portfolio_data = self._prepare_portfolio_data(portfolio)

            for rule in portfolio_rules:
                await self._evaluate_portfolio_rule(rule, portfolio, portfolio_data)

        except Exception as e:
            logger.error(f"Error evaluating portfolio rules: {e}")

    async def generate_alert(
        self,
        rule: AlertRule,
        symbol: Optional[str] = None,
        current_value: Optional[Any] = None,
        condition_met: str = "",
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Alert:
        """Generate a new alert"""
        try:
            alert = Alert(
                alert_id=str(uuid.uuid4()),
                rule_id=rule.rule_id,
                user_id=rule.user_id,
                alert_type=rule.alert_type,
                severity=rule.severity,
                title=self._generate_alert_title(rule, symbol, current_value),
                message=self._generate_alert_message(rule, symbol, current_value, condition_met),
                symbol=symbol,
                current_value=current_value,
                condition_met=condition_met,
                data=additional_data or {},
                metadata={
                    'rule_name': rule.name,
                    'generated_at': datetime.utcnow().isoformat(),
                    'source': 'alert_engine'
                }
            )

            # Set expiration if configured
            if rule.alert_type in [AlertType.PRICE, AlertType.TECHNICAL]:
                alert.expires_at = datetime.utcnow() + timedelta(hours=1)
            elif rule.alert_type == AlertType.NEWS:
                alert.expires_at = datetime.utcnow() + timedelta(hours=24)

            self.stats['alerts_generated'] += 1
            return alert

        except Exception as e:
            logger.error(f"Error generating alert: {e}")
            raise

    async def queue_alert(self, alert: Alert, priority: bool = False):
        """Queue alert for delivery"""
        try:
            queue = self.priority_queue if priority else self.alert_queue

            if queue.full():
                logger.warning(f"Alert queue full, dropping alert {alert.alert_id}")
                return

            await queue.put(alert)
            logger.debug(f"Queued alert {alert.alert_id} for delivery")

        except Exception as e:
            logger.error(f"Error queuing alert {alert.alert_id}: {e}")

    # Private methods

    async def _process_alerts(self):
        """Background task to process alert queue"""
        try:
            while self._running:
                try:
                    # Check priority queue first
                    try:
                        alert = await asyncio.wait_for(self.priority_queue.get(), timeout=1.0)
                        await self._deliver_alert(alert)
                        continue
                    except asyncio.TimeoutError:
                        pass

                    # Check regular queue
                    try:
                        alert = await asyncio.wait_for(self.alert_queue.get(), timeout=1.0)
                        await self._deliver_alert(alert)
                    except asyncio.TimeoutError:
                        pass

                except Exception as e:
                    logger.error(f"Error in alert processing loop: {e}")
                    await asyncio.sleep(1)

        except asyncio.CancelledError:
            pass

    async def _monitor_rules(self):
        """Background task to monitor and evaluate rules"""
        try:
            while self._running:
                try:
                    # This would integrate with real-time market data
                    # For now, just sleep
                    await asyncio.sleep(60)

                except Exception as e:
                    logger.error(f"Error in rule monitoring loop: {e}")
                    await asyncio.sleep(5)

        except asyncio.CancelledError:
            pass

    def _rule_applies_to_symbol(self, rule: AlertRule, symbol: str) -> bool:
        """Check if a rule applies to a specific symbol"""
        if rule.symbol and rule.symbol == symbol:
            return True
        if rule.symbols and symbol in rule.symbols:
            return True
        return False

    async def _evaluate_rule(self, rule: AlertRule, symbol: str, market_data: Dict[str, Any]):
        """Evaluate a single rule for a symbol"""
        try:
            # Check if rule is in cooldown
            if rule.rule_id in self.rule_cooldowns:
                cooldown_until = self.rule_cooldowns[rule.rule_id]
                if datetime.utcnow() < cooldown_until:
                    return

            # Check rate limits
            if not self.rate_limiter.can_send_alert(rule.user_id, rule.rule_id):
                return

            # Check time restrictions
            if not self._is_within_time_window(rule):
                return

            # Evaluate conditions
            condition_results = []
            for condition in rule.conditions:
                is_met, description, current_value = await self.condition_evaluator.evaluate_condition(
                    condition, symbol, market_data
                )
                condition_results.append((is_met, description, current_value))

            # Apply condition logic
            if rule.condition_logic.upper() == "AND":
                rule_triggered = all(result[0] for result in condition_results)
            else:  # OR
                rule_triggered = any(result[0] for result in condition_results)

            if rule_triggered:
                # Generate alert
                met_conditions = [desc for is_met, desc, _ in condition_results if is_met]
                condition_text = "; ".join(met_conditions)

                # Get current value from first met condition
                current_value = next(
                    (val for is_met, _, val in condition_results if is_met),
                    None
                )

                alert = await self.generate_alert(
                    rule=rule,
                    symbol=symbol,
                    current_value=current_value,
                    condition_met=condition_text,
                    additional_data=market_data
                )

                # Queue for delivery
                await self.queue_alert(alert, rule.severity in [AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY])

                # Update rule tracking
                rule.last_triggered = datetime.utcnow()
                rule.trigger_count += 1

                # Set cooldown
                if rule.cooldown_minutes > 0:
                    self.rule_cooldowns[rule.rule_id] = datetime.utcnow() + timedelta(minutes=rule.cooldown_minutes)

                # Record for rate limiting
                self.rate_limiter.record_alert(rule.user_id, rule.rule_id)

                self.stats['rules_evaluated'] += 1

        except Exception as e:
            logger.error(f"Error evaluating rule {rule.rule_id}: {e}")

    async def _evaluate_portfolio_rule(self, rule: AlertRule, portfolio: Portfolio, portfolio_data: Dict[str, Any]):
        """Evaluate a portfolio-specific rule"""
        try:
            # Similar to symbol rule evaluation but with portfolio data
            # This would include portfolio-level metrics like total value, P&L, etc.
            pass

        except Exception as e:
            logger.error(f"Error evaluating portfolio rule {rule.rule_id}: {e}")

    def _prepare_portfolio_data(self, portfolio: Portfolio) -> Dict[str, Any]:
        """Prepare portfolio data for rule evaluation"""
        return {
            'total_value': portfolio.total_value,
            'total_pnl': portfolio.total_pnl,
            'total_pnl_percent': portfolio.total_pnl_percent,
            'cash_balance': portfolio.cash_balance,
            'position_count': len(portfolio.positions),
            'largest_position': max(pos.market_value for pos in portfolio.positions) if portfolio.positions else 0
        }

    def _is_within_time_window(self, rule: AlertRule) -> bool:
        """Check if current time is within rule's time window"""
        try:
            if not rule.start_time and not rule.end_time:
                return True

            now = datetime.utcnow().time()
            current_day = datetime.utcnow().weekday()

            # Check days of week
            if rule.days_of_week and current_day not in rule.days_of_week:
                return False

            # Check time window
            if rule.start_time and rule.end_time:
                if rule.start_time <= rule.end_time:
                    return rule.start_time <= now <= rule.end_time
                else:  # Overnight window
                    return now >= rule.start_time or now <= rule.end_time
            elif rule.start_time:
                return now >= rule.start_time
            elif rule.end_time:
                return now <= rule.end_time

            return True

        except Exception as e:
            logger.error(f"Error checking time window: {e}")
            return True

    async def _deliver_alert(self, alert: Alert):
        """Deliver an alert through configured channels"""
        try:
            rule = self.active_rules.get(alert.rule_id)
            if not rule:
                logger.warning(f"Rule not found for alert {alert.alert_id}")
                return

            delivery_tasks = []

            for channel in rule.channels:
                if channel in self.delivery_handlers:
                    handler = self.delivery_handlers[channel]
                    task = asyncio.create_task(self._deliver_via_channel(alert, rule, channel, handler))
                    delivery_tasks.append(task)

            # Wait for all deliveries to complete
            if delivery_tasks:
                results = await asyncio.gather(*delivery_tasks, return_exceptions=True)

                successful_channels = []
                failed_channels = []

                for i, result in enumerate(results):
                    channel = rule.channels[i]
                    if isinstance(result, Exception):
                        failed_channels.append(channel.value)
                        logger.error(f"Delivery failed for channel {channel}: {result}")
                    elif result:
                        successful_channels.append(channel.value)
                    else:
                        failed_channels.append(channel.value)

                alert.delivered_channels = successful_channels
                alert.failed_channels = failed_channels
                alert.delivery_attempts += 1

                if successful_channels:
                    alert.status = AlertStatus.SENT
                    self.stats['alerts_delivered'] += 1
                else:
                    alert.status = AlertStatus.FAILED
                    self.stats['alerts_failed'] += 1

        except Exception as e:
            logger.error(f"Error delivering alert {alert.alert_id}: {e}")
            alert.status = AlertStatus.FAILED
            self.stats['alerts_failed'] += 1

    async def _deliver_via_channel(
        self,
        alert: Alert,
        rule: AlertRule,
        channel: NotificationChannel,
        handler: Callable
    ) -> bool:
        """Deliver alert via a specific channel"""
        try:
            return await handler(alert, rule)
        except Exception as e:
            logger.error(f"Error in delivery handler for {channel}: {e}")
            return False

    def _generate_alert_title(self, rule: AlertRule, symbol: Optional[str], current_value: Optional[Any]) -> str:
        """Generate alert title"""
        try:
            if symbol:
                return f"{rule.name}: {symbol}"
            else:
                return rule.name
        except Exception as e:
            logger.error(f"Error generating alert title: {e}")
            return "Alert"

    def _generate_alert_message(
        self,
        rule: AlertRule,
        symbol: Optional[str],
        current_value: Optional[Any],
        condition_met: str
    ) -> str:
        """Generate alert message"""
        try:
            parts = []

            if symbol:
                parts.append(f"Symbol: {symbol}")

            if current_value is not None:
                parts.append(f"Current value: {current_value}")

            if condition_met:
                parts.append(f"Condition: {condition_met}")

            if rule.description:
                parts.append(rule.description)

            return " | ".join(parts) if parts else "Alert triggered"

        except Exception as e:
            logger.error(f"Error generating alert message: {e}")
            return "Alert triggered"

    def get_statistics(self) -> Dict[str, Any]:
        """Get engine statistics"""
        return {
            **self.stats,
            'active_rules': len(self.active_rules),
            'queue_size': self.alert_queue.qsize(),
            'priority_queue_size': self.priority_queue.qsize(),
            'running': self._running
        }


# Global alert engine instance
_alert_engine: Optional[AlertEngine] = None


def get_alert_engine() -> AlertEngine:
    """Get the global alert engine"""
    global _alert_engine
    if _alert_engine is None:
        from ..services.stock_service import get_stock_service
        _alert_engine = AlertEngine(get_stock_service())
    return _alert_engine