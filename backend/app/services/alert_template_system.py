"""
Alert Template System for TurtleTrading Alerting System

Provides customizable templates for alerts across all notification channels
with support for personalization, localization, and dynamic content generation.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import yaml
import redis.asyncio as redis
from jinja2 import Environment, FileSystemLoader, Template, BaseLoader, DictLoader
import aiofiles

from ..models.alert_models import (
    Alert, AlertRule, AlertType, AlertSeverity, NotificationChannel,
    AlertTemplate, TemplateVariables, TemplateContext,
    WebhookTemplate, EmailTemplate, SMSTemplate, PushTemplate
)

logger = logging.getLogger(__name__)


class TemplateVariableExtractor:
    """Extracts and processes variables for template rendering"""

    @staticmethod
    def extract_market_variables(alert: Alert, rule: AlertRule) -> Dict[str, Any]:
        """Extract market-related template variables"""
        variables = {
            # Alert information
            "alert_id": alert.alert_id,
            "alert_title": alert.title,
            "alert_message": alert.message,
            "alert_severity": alert.severity.value,
            "alert_type": alert.alert_type.value if alert.alert_type else "UNKNOWN",
            "timestamp": alert.timestamp,
            "formatted_timestamp": alert.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "timestamp_iso": alert.timestamp.isoformat(),

            # Rule information
            "rule_id": rule.rule_id,
            "rule_name": rule.name,
            "rule_description": rule.description or "",

            # Symbol information
            "symbol": alert.symbol or "N/A",
            "symbol_name": alert.data.get("company_name", alert.symbol or "Unknown"),

            # User information
            "user_id": rule.user_id,
        }

        # Extract price information
        if "price" in alert.data:
            variables.update({
                "current_price": alert.data["price"],
                "formatted_price": f"${alert.data['price']:.2f}",
                "previous_close": alert.data.get("previous_close"),
                "price_change": alert.data.get("price_change"),
                "price_change_percent": alert.data.get("price_change_percent"),
                "formatted_change": TemplateVariableExtractor._format_price_change(
                    alert.data.get("price_change"),
                    alert.data.get("price_change_percent")
                )
            })

        # Extract technical indicators
        if "technical_indicators" in alert.data:
            indicators = alert.data["technical_indicators"]
            variables.update({
                "rsi": indicators.get("rsi"),
                "macd": indicators.get("macd"),
                "macd_signal": indicators.get("macd_signal"),
                "bollinger_upper": indicators.get("bollinger_upper"),
                "bollinger_lower": indicators.get("bollinger_lower"),
                "sma_20": indicators.get("sma_20"),
                "sma_50": indicators.get("sma_50"),
                "volume": indicators.get("volume"),
            })

        # Extract alert-specific data
        variables.update(alert.data)

        return variables

    @staticmethod
    def _format_price_change(change: Optional[float], change_percent: Optional[float]) -> str:
        """Format price change for display"""
        if change is None or change_percent is None:
            return "N/A"

        sign = "+" if change >= 0 else ""
        return f"{sign}${change:.2f} ({sign}{change_percent:.2f}%)"

    @staticmethod
    def extract_system_variables() -> Dict[str, Any]:
        """Extract system-wide template variables"""
        return {
            "platform_name": "TurtleTrading",
            "platform_url": "https://turtletrading.com",
            "support_email": "support@turtletrading.com",
            "current_year": datetime.utcnow().year,
            "generation_time": datetime.utcnow().isoformat(),
        }


class AlertTemplateManager:
    """Manages alert templates with caching and version control"""

    def __init__(
        self,
        template_dir: str = "templates/alerts",
        redis_client: Optional[redis.Redis] = None
    ):
        self.template_dir = Path(template_dir)
        self.template_dir.mkdir(parents=True, exist_ok=True)
        self.redis = redis_client

        # Template cache
        self.template_cache: Dict[str, AlertTemplate] = {}
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=True
        )

        # Built-in templates
        self.builtin_templates = self._load_builtin_templates()

    async def get_template(
        self,
        template_id: str,
        channel: NotificationChannel,
        user_id: Optional[str] = None
    ) -> Optional[AlertTemplate]:
        """
        Get template by ID and channel with user customization support

        Args:
            template_id: Template identifier
            channel: Notification channel
            user_id: User ID for personalized templates

        Returns:
            AlertTemplate if found, None otherwise
        """
        try:
            # Check cache first
            cache_key = f"{template_id}:{channel.value}:{user_id or 'default'}"
            if cache_key in self.template_cache:
                return self.template_cache[cache_key]

            # Try to load user-specific template
            if user_id:
                user_template = await self._load_user_template(
                    template_id, channel, user_id
                )
                if user_template:
                    self.template_cache[cache_key] = user_template
                    return user_template

            # Load default template
            default_template = await self._load_default_template(template_id, channel)
            if default_template:
                self.template_cache[cache_key] = default_template
                return default_template

            # Fallback to built-in template
            builtin_template = self.builtin_templates.get(f"{template_id}:{channel.value}")
            if builtin_template:
                self.template_cache[cache_key] = builtin_template
                return builtin_template

            logger.warning(f"Template not found: {template_id} for channel {channel.value}")
            return None

        except Exception as e:
            logger.error(f"Error loading template {template_id}: {e}")
            return None

    async def save_template(
        self,
        template: AlertTemplate,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Save template to storage

        Args:
            template: AlertTemplate to save
            user_id: User ID for user-specific templates

        Returns:
            bool: True if saved successfully
        """
        try:
            # Determine storage path
            if user_id:
                template_path = (
                    self.template_dir / "users" / user_id /
                    f"{template.template_id}_{template.channel.value}.yaml"
                )
            else:
                template_path = (
                    self.template_dir / "default" /
                    f"{template.template_id}_{template.channel.value}.yaml"
                )

            # Create directory if needed
            template_path.parent.mkdir(parents=True, exist_ok=True)

            # Save template
            template_data = template.dict()
            template_data['created_at'] = template.created_at.isoformat()
            template_data['updated_at'] = template.updated_at.isoformat()

            async with aiofiles.open(template_path, 'w') as f:
                await f.write(yaml.dump(template_data, default_flow_style=False))

            # Update cache
            cache_key = f"{template.template_id}:{template.channel.value}:{user_id or 'default'}"
            self.template_cache[cache_key] = template

            # Store in Redis if available
            if self.redis:
                redis_key = f"alert_template:{cache_key}"
                await self.redis.setex(
                    redis_key,
                    86400,  # 24 hours TTL
                    json.dumps(template_data, default=str)
                )

            logger.info(f"Saved template {template.template_id} for channel {template.channel.value}")
            return True

        except Exception as e:
            logger.error(f"Error saving template {template.template_id}: {e}")
            return False

    async def list_templates(
        self,
        channel: Optional[NotificationChannel] = None,
        user_id: Optional[str] = None
    ) -> List[AlertTemplate]:
        """List available templates"""
        templates = []

        try:
            # List default templates
            default_dir = self.template_dir / "default"
            if default_dir.exists():
                templates.extend(await self._scan_template_directory(default_dir))

            # List user-specific templates
            if user_id:
                user_dir = self.template_dir / "users" / user_id
                if user_dir.exists():
                    templates.extend(await self._scan_template_directory(user_dir))

            # Add built-in templates
            for template in self.builtin_templates.values():
                if template not in templates:
                    templates.append(template)

            # Filter by channel if specified
            if channel:
                templates = [t for t in templates if t.channel == channel]

            return templates

        except Exception as e:
            logger.error(f"Error listing templates: {e}")
            return []

    async def _load_user_template(
        self,
        template_id: str,
        channel: NotificationChannel,
        user_id: str
    ) -> Optional[AlertTemplate]:
        """Load user-specific template"""
        template_path = (
            self.template_dir / "users" / user_id /
            f"{template_id}_{channel.value}.yaml"
        )

        if template_path.exists():
            return await self._load_template_from_file(template_path)

        return None

    async def _load_default_template(
        self,
        template_id: str,
        channel: NotificationChannel
    ) -> Optional[AlertTemplate]:
        """Load default template"""
        template_path = (
            self.template_dir / "default" /
            f"{template_id}_{channel.value}.yaml"
        )

        if template_path.exists():
            return await self._load_template_from_file(template_path)

        return None

    async def _load_template_from_file(self, template_path: Path) -> Optional[AlertTemplate]:
        """Load template from YAML file"""
        try:
            async with aiofiles.open(template_path, 'r') as f:
                content = await f.read()
                template_data = yaml.safe_load(content)

            # Convert string dates back to datetime
            if 'created_at' in template_data:
                template_data['created_at'] = datetime.fromisoformat(template_data['created_at'])
            if 'updated_at' in template_data:
                template_data['updated_at'] = datetime.fromisoformat(template_data['updated_at'])

            return AlertTemplate(**template_data)

        except Exception as e:
            logger.error(f"Error loading template from {template_path}: {e}")
            return None

    async def _scan_template_directory(self, directory: Path) -> List[AlertTemplate]:
        """Scan directory for template files"""
        templates = []

        for template_file in directory.glob("*.yaml"):
            template = await self._load_template_from_file(template_file)
            if template:
                templates.append(template)

        return templates

    def _load_builtin_templates(self) -> Dict[str, AlertTemplate]:
        """Load built-in default templates"""
        templates = {}

        # Price alert templates
        templates["price_alert:WEBHOOK"] = AlertTemplate(
            template_id="price_alert",
            name="Price Alert",
            description="Alert for price threshold breaches",
            channel=NotificationChannel.WEBHOOK,
            content={
                "title": "Price Alert: {{ symbol }}",
                "message": "{{ symbol }} reached ${{ current_price }} ({{ formatted_change }})",
                "payload": {
                    "alert_type": "price_alert",
                    "symbol": "{{ symbol }}",
                    "current_price": "{{ current_price }}",
                    "price_change": "{{ price_change }}",
                    "price_change_percent": "{{ price_change_percent }}",
                    "timestamp": "{{ timestamp_iso }}"
                }
            },
            variables=["symbol", "current_price", "formatted_change", "price_change", "price_change_percent", "timestamp_iso"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        templates["price_alert:EMAIL"] = AlertTemplate(
            template_id="price_alert",
            name="Price Alert Email",
            description="Email template for price alerts",
            channel=NotificationChannel.EMAIL,
            content={
                "subject": "Price Alert: {{ symbol }} - {{ formatted_change }}",
                "html_body": """
                <h2>Price Alert: {{ symbol }}</h2>
                <p><strong>Current Price:</strong> {{ formatted_price }}</p>
                <p><strong>Change:</strong> {{ formatted_change }}</p>
                <p><strong>Time:</strong> {{ formatted_timestamp }}</p>
                <p><strong>Rule:</strong> {{ rule_name }}</p>
                <hr>
                <p><small>This alert was generated by TurtleTrading</small></p>
                """
            },
            variables=["symbol", "formatted_price", "formatted_change", "formatted_timestamp", "rule_name"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        templates["price_alert:SMS"] = AlertTemplate(
            template_id="price_alert",
            name="Price Alert SMS",
            description="SMS template for price alerts",
            channel=NotificationChannel.SMS,
            content={
                "message": "{{ symbol }}: {{ formatted_price }} ({{ formatted_change }}) - {{ rule_name }}"
            },
            variables=["symbol", "formatted_price", "formatted_change", "rule_name"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        templates["price_alert:PUSH"] = AlertTemplate(
            template_id="price_alert",
            name="Price Alert Push",
            description="Push notification for price alerts",
            channel=NotificationChannel.PUSH,
            content={
                "title": "Price Alert: {{ symbol }}",
                "body": "{{ formatted_price }} ({{ formatted_change }})",
                "data": {
                    "alert_type": "price_alert",
                    "symbol": "{{ symbol }}",
                    "price": "{{ current_price }}"
                }
            },
            variables=["symbol", "formatted_price", "formatted_change", "current_price"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Technical indicator templates
        templates["technical_alert:WEBHOOK"] = AlertTemplate(
            template_id="technical_alert",
            name="Technical Indicator Alert",
            description="Alert for technical indicator signals",
            channel=NotificationChannel.WEBHOOK,
            content={
                "title": "Technical Alert: {{ symbol }}",
                "message": "{{ alert_message }}",
                "payload": {
                    "alert_type": "technical_alert",
                    "symbol": "{{ symbol }}",
                    "indicator": "{{ indicator }}",
                    "signal": "{{ signal }}",
                    "current_price": "{{ current_price }}",
                    "rsi": "{{ rsi }}",
                    "macd": "{{ macd }}",
                    "timestamp": "{{ timestamp_iso }}"
                }
            },
            variables=["symbol", "alert_message", "indicator", "signal", "current_price", "rsi", "macd", "timestamp_iso"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        return templates


class AlertTemplateRenderer:
    """Renders alert templates with variable substitution"""

    def __init__(self, template_manager: AlertTemplateManager):
        self.template_manager = template_manager
        self.variable_extractor = TemplateVariableExtractor()

    async def render_alert(
        self,
        alert: Alert,
        rule: AlertRule,
        channel: NotificationChannel,
        template_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Render alert using appropriate template

        Args:
            alert: Alert to render
            rule: Rule that triggered the alert
            channel: Target notification channel
            template_id: Specific template ID (optional)
            user_id: User ID for personalized rendering

        Returns:
            Rendered template content
        """
        try:
            # Determine template ID
            if not template_id:
                template_id = self._determine_template_id(alert, rule)

            # Get template
            template = await self.template_manager.get_template(
                template_id, channel, user_id
            )

            if not template:
                logger.warning(f"No template found for {template_id} on {channel.value}")
                return None

            # Prepare template variables
            variables = self._prepare_template_variables(alert, rule, user_id)

            # Render template
            rendered_content = await self._render_template_content(
                template, variables
            )

            return rendered_content

        except Exception as e:
            logger.error(f"Error rendering alert template: {e}")
            return None

    def _determine_template_id(self, alert: Alert, rule: AlertRule) -> str:
        """Determine appropriate template ID based on alert type"""
        if alert.alert_type == AlertType.PRICE_THRESHOLD:
            return "price_alert"
        elif alert.alert_type == AlertType.TECHNICAL_INDICATOR:
            return "technical_alert"
        elif alert.alert_type == AlertType.VOLUME_SPIKE:
            return "volume_alert"
        elif alert.alert_type == AlertType.NEWS_SENTIMENT:
            return "sentiment_alert"
        else:
            return "general_alert"

    def _prepare_template_variables(
        self,
        alert: Alert,
        rule: AlertRule,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Prepare all template variables"""
        variables = {}

        # Extract market variables
        variables.update(
            self.variable_extractor.extract_market_variables(alert, rule)
        )

        # Extract system variables
        variables.update(
            self.variable_extractor.extract_system_variables()
        )

        # Add user-specific variables
        if user_id:
            variables.update({
                "user_id": user_id,
                "personalized": True
            })

        return variables

    async def _render_template_content(
        self,
        template: AlertTemplate,
        variables: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Render template content with variables"""
        rendered = {}

        try:
            # Create Jinja2 environment
            env = Environment(loader=DictLoader({}))

            # Render each content field
            for key, value in template.content.items():
                if isinstance(value, str):
                    # Render string template
                    jinja_template = env.from_string(value)
                    rendered[key] = jinja_template.render(**variables)
                elif isinstance(value, dict):
                    # Render nested dictionary
                    rendered[key] = await self._render_nested_dict(value, variables, env)
                else:
                    # Copy as-is
                    rendered[key] = value

            return rendered

        except Exception as e:
            logger.error(f"Error rendering template content: {e}")
            return template.content

    async def _render_nested_dict(
        self,
        data: Dict[str, Any],
        variables: Dict[str, Any],
        env: Environment
    ) -> Dict[str, Any]:
        """Recursively render nested dictionary"""
        rendered = {}

        for key, value in data.items():
            if isinstance(value, str):
                try:
                    template = env.from_string(value)
                    rendered[key] = template.render(**variables)
                except Exception as e:
                    logger.warning(f"Error rendering template field {key}: {e}")
                    rendered[key] = value
            elif isinstance(value, dict):
                rendered[key] = await self._render_nested_dict(value, variables, env)
            else:
                rendered[key] = value

        return rendered


class AlertTemplateSystem:
    """Complete alert template system"""

    def __init__(
        self,
        template_dir: str = "templates/alerts",
        redis_client: Optional[redis.Redis] = None
    ):
        self.template_manager = AlertTemplateManager(template_dir, redis_client)
        self.renderer = AlertTemplateRenderer(self.template_manager)

    async def initialize(self):
        """Initialize the template system"""
        # Create default template directories
        await self._create_default_templates()
        logger.info("Alert template system initialized")

    async def render_alert_for_channel(
        self,
        alert: Alert,
        rule: AlertRule,
        channel: NotificationChannel,
        user_id: Optional[str] = None,
        template_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Render alert for specific notification channel"""
        return await self.renderer.render_alert(
            alert, rule, channel, template_id, user_id
        )

    async def create_custom_template(
        self,
        template_id: str,
        name: str,
        channel: NotificationChannel,
        content: Dict[str, Any],
        description: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> bool:
        """Create custom template"""
        template = AlertTemplate(
            template_id=template_id,
            name=name,
            description=description or f"Custom {channel.value} template",
            channel=channel,
            content=content,
            variables=list(content.keys()),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        return await self.template_manager.save_template(template, user_id)

    async def get_available_templates(
        self,
        channel: Optional[NotificationChannel] = None,
        user_id: Optional[str] = None
    ) -> List[AlertTemplate]:
        """Get list of available templates"""
        return await self.template_manager.list_templates(channel, user_id)

    async def _create_default_templates(self):
        """Create default template directories and files"""
        try:
            # Create directory structure
            (self.template_manager.template_dir / "default").mkdir(parents=True, exist_ok=True)
            (self.template_manager.template_dir / "users").mkdir(parents=True, exist_ok=True)

            logger.info("Created default template directory structure")

        except Exception as e:
            logger.error(f"Error creating default templates: {e}")