"""
Scanner WebSocket Manager

Extends the WebSocket functionality to provide real-time scanner results,
alerts, and live streaming of scanner data.
"""

import asyncio
import json
from typing import Dict, Set, List, Optional, Any
from datetime import datetime
import logging

from ..services.websocket_manager import ConnectionManager
from ..core.scanner_engine import get_scanner_engine
from ..services.scanner_alert_system import get_alert_system
from ..services.scanner_aggregation_service import get_aggregation_service
from ..models.scanner_models import (
    SavedScanner, ScannerResponse, ScanResult, ScannerAlert,
    AggregatedScanResult, ScannerRunRequest
)

logger = logging.getLogger(__name__)


class ScannerSubscription:
    """Represents a scanner subscription for a WebSocket client"""

    def __init__(self, client_id: str, scanner_id: str, interval_seconds: int = 60):
        self.client_id = client_id
        self.scanner_id = scanner_id
        self.interval_seconds = interval_seconds
        self.last_run = None
        self.active = True
        self.created_at = datetime.utcnow()


class ScannerWebSocketManager:
    """
    Manages real-time WebSocket connections for scanner data streaming
    """

    def __init__(self, websocket_manager: ConnectionManager):
        self.websocket_manager = websocket_manager

        # Scanner subscriptions: client_id -> {scanner_id: ScannerSubscription}
        self.scanner_subscriptions: Dict[str, Dict[str, ScannerSubscription]] = {}

        # Alert subscriptions: client_id -> Set[scanner_id]
        self.alert_subscriptions: Dict[str, Set[str]] = {}

        # Aggregation subscriptions: client_id -> {config}
        self.aggregation_subscriptions: Dict[str, Dict[str, Any]] = {}

        # Background tasks
        self._scanner_tasks: Dict[str, asyncio.Task] = {}
        self._alert_handlers_registered = False

        # Scanner engine and services
        self.scanner_engine = get_scanner_engine()
        self.alert_system = get_alert_system()
        self.aggregation_service = get_aggregation_service()

    async def start_services(self):
        """Start scanner WebSocket services"""
        try:
            # Register alert handlers
            if not self._alert_handlers_registered:
                self.alert_system.add_alert_handler(self._handle_scanner_alert)
                self._alert_handlers_registered = True

            logger.info("Scanner WebSocket services started successfully")

        except Exception as e:
            logger.error(f"Failed to start scanner WebSocket services: {e}")

    async def stop_services(self):
        """Stop scanner WebSocket services"""
        try:
            # Cancel all scanner tasks
            for task in self._scanner_tasks.values():
                task.cancel()

            # Wait for tasks to complete
            if self._scanner_tasks:
                await asyncio.gather(*self._scanner_tasks.values(), return_exceptions=True)

            self._scanner_tasks.clear()

            logger.info("Scanner WebSocket services stopped successfully")

        except Exception as e:
            logger.error(f"Error stopping scanner WebSocket services: {e}")

    async def handle_message(self, client_id: str, message: Dict[str, Any]):
        """Handle incoming WebSocket messages for scanner functionality"""
        try:
            message_type = message.get("type")

            if message_type == "subscribe_scanner":
                await self._handle_subscribe_scanner(client_id, message)
            elif message_type == "unsubscribe_scanner":
                await self._handle_unsubscribe_scanner(client_id, message)
            elif message_type == "subscribe_alerts":
                await self._handle_subscribe_alerts(client_id, message)
            elif message_type == "unsubscribe_alerts":
                await self._handle_unsubscribe_alerts(client_id, message)
            elif message_type == "subscribe_aggregation":
                await self._handle_subscribe_aggregation(client_id, message)
            elif message_type == "run_scanner":
                await self._handle_run_scanner(client_id, message)
            elif message_type == "get_scanner_status":
                await self._handle_get_scanner_status(client_id, message)
            else:
                logger.warning(f"Unknown scanner message type: {message_type}")

        except Exception as e:
            logger.error(f"Error handling scanner WebSocket message: {e}")
            await self._send_error(client_id, f"Failed to handle message: {str(e)}")

    async def _handle_subscribe_scanner(self, client_id: str, message: Dict[str, Any]):
        """Handle scanner subscription request"""
        try:
            scanner_id = message.get("scanner_id")
            interval_seconds = message.get("interval_seconds", 60)

            if not scanner_id:
                await self._send_error(client_id, "scanner_id is required")
                return

            # Validate interval
            if interval_seconds < 30 or interval_seconds > 3600:
                await self._send_error(client_id, "interval_seconds must be between 30 and 3600")
                return

            # Create subscription
            if client_id not in self.scanner_subscriptions:
                self.scanner_subscriptions[client_id] = {}

            subscription = ScannerSubscription(client_id, scanner_id, interval_seconds)
            self.scanner_subscriptions[client_id][scanner_id] = subscription

            # Start scanner task
            task_key = f"{client_id}_{scanner_id}"
            if task_key in self._scanner_tasks:
                self._scanner_tasks[task_key].cancel()

            self._scanner_tasks[task_key] = asyncio.create_task(
                self._scanner_streaming_task(subscription)
            )

            # Send confirmation
            await self.websocket_manager.send_personal_message({
                "type": "scanner_subscription_confirmed",
                "scanner_id": scanner_id,
                "interval_seconds": interval_seconds,
                "timestamp": datetime.utcnow().isoformat()
            }, client_id)

            logger.info(f"Client {client_id} subscribed to scanner {scanner_id}")

        except Exception as e:
            logger.error(f"Error handling scanner subscription: {e}")
            await self._send_error(client_id, f"Failed to subscribe to scanner: {str(e)}")

    async def _handle_unsubscribe_scanner(self, client_id: str, message: Dict[str, Any]):
        """Handle scanner unsubscription request"""
        try:
            scanner_id = message.get("scanner_id")

            if not scanner_id:
                await self._send_error(client_id, "scanner_id is required")
                return

            # Remove subscription
            if (client_id in self.scanner_subscriptions and
                scanner_id in self.scanner_subscriptions[client_id]):

                del self.scanner_subscriptions[client_id][scanner_id]

                # Cancel task
                task_key = f"{client_id}_{scanner_id}"
                if task_key in self._scanner_tasks:
                    self._scanner_tasks[task_key].cancel()
                    del self._scanner_tasks[task_key]

                # Clean up empty subscription dict
                if not self.scanner_subscriptions[client_id]:
                    del self.scanner_subscriptions[client_id]

            # Send confirmation
            await self.websocket_manager.send_personal_message({
                "type": "scanner_unsubscription_confirmed",
                "scanner_id": scanner_id,
                "timestamp": datetime.utcnow().isoformat()
            }, client_id)

            logger.info(f"Client {client_id} unsubscribed from scanner {scanner_id}")

        except Exception as e:
            logger.error(f"Error handling scanner unsubscription: {e}")
            await self._send_error(client_id, f"Failed to unsubscribe from scanner: {str(e)}")

    async def _handle_subscribe_alerts(self, client_id: str, message: Dict[str, Any]):
        """Handle alert subscription request"""
        try:
            scanner_ids = message.get("scanner_ids", [])

            if not scanner_ids:
                await self._send_error(client_id, "scanner_ids is required")
                return

            # Add alert subscriptions
            if client_id not in self.alert_subscriptions:
                self.alert_subscriptions[client_id] = set()

            self.alert_subscriptions[client_id].update(scanner_ids)

            # Send confirmation
            await self.websocket_manager.send_personal_message({
                "type": "alert_subscription_confirmed",
                "scanner_ids": list(self.alert_subscriptions[client_id]),
                "timestamp": datetime.utcnow().isoformat()
            }, client_id)

            logger.info(f"Client {client_id} subscribed to alerts for scanners: {scanner_ids}")

        except Exception as e:
            logger.error(f"Error handling alert subscription: {e}")
            await self._send_error(client_id, f"Failed to subscribe to alerts: {str(e)}")

    async def _handle_unsubscribe_alerts(self, client_id: str, message: Dict[str, Any]):
        """Handle alert unsubscription request"""
        try:
            scanner_ids = message.get("scanner_ids", [])

            if client_id in self.alert_subscriptions:
                if scanner_ids:
                    # Remove specific scanner IDs
                    self.alert_subscriptions[client_id].difference_update(scanner_ids)
                else:
                    # Remove all alert subscriptions
                    self.alert_subscriptions[client_id].clear()

                # Clean up empty subscription set
                if not self.alert_subscriptions[client_id]:
                    del self.alert_subscriptions[client_id]

            # Send confirmation
            await self.websocket_manager.send_personal_message({
                "type": "alert_unsubscription_confirmed",
                "scanner_ids": scanner_ids,
                "timestamp": datetime.utcnow().isoformat()
            }, client_id)

            logger.info(f"Client {client_id} unsubscribed from alerts for scanners: {scanner_ids}")

        except Exception as e:
            logger.error(f"Error handling alert unsubscription: {e}")
            await self._send_error(client_id, f"Failed to unsubscribe from alerts: {str(e)}")

    async def _handle_subscribe_aggregation(self, client_id: str, message: Dict[str, Any]):
        """Handle aggregation subscription request"""
        try:
            scanner_ids = message.get("scanner_ids", [])
            interval_seconds = message.get("interval_seconds", 300)  # 5 minutes default

            if not scanner_ids:
                await self._send_error(client_id, "scanner_ids is required")
                return

            # Store aggregation subscription
            self.aggregation_subscriptions[client_id] = {
                "scanner_ids": scanner_ids,
                "interval_seconds": interval_seconds,
                "last_run": None
            }

            # Start aggregation task
            task_key = f"{client_id}_aggregation"
            if task_key in self._scanner_tasks:
                self._scanner_tasks[task_key].cancel()

            self._scanner_tasks[task_key] = asyncio.create_task(
                self._aggregation_streaming_task(client_id)
            )

            # Send confirmation
            await self.websocket_manager.send_personal_message({
                "type": "aggregation_subscription_confirmed",
                "scanner_ids": scanner_ids,
                "interval_seconds": interval_seconds,
                "timestamp": datetime.utcnow().isoformat()
            }, client_id)

            logger.info(f"Client {client_id} subscribed to aggregation for scanners: {scanner_ids}")

        except Exception as e:
            logger.error(f"Error handling aggregation subscription: {e}")
            await self._send_error(client_id, f"Failed to subscribe to aggregation: {str(e)}")

    async def _handle_run_scanner(self, client_id: str, message: Dict[str, Any]):
        """Handle ad-hoc scanner run request"""
        try:
            scanner_config = message.get("config")

            if not scanner_config:
                await self._send_error(client_id, "scanner config is required")
                return

            # Run scanner
            request = ScannerRunRequest(config=scanner_config, real_time=True)
            results = await self.scanner_engine.run_scan(scanner_config)

            # Send results
            await self.websocket_manager.send_personal_message({
                "type": "scanner_results",
                "scanner_id": "ad_hoc",
                "results": results.dict(),
                "timestamp": datetime.utcnow().isoformat()
            }, client_id)

        except Exception as e:
            logger.error(f"Error running ad-hoc scanner: {e}")
            await self._send_error(client_id, f"Failed to run scanner: {str(e)}")

    async def _handle_get_scanner_status(self, client_id: str, message: Dict[str, Any]):
        """Handle scanner status request"""
        try:
            # Get client's subscriptions
            scanner_subs = self.scanner_subscriptions.get(client_id, {})
            alert_subs = self.alert_subscriptions.get(client_id, set())
            agg_subs = self.aggregation_subscriptions.get(client_id, {})

            status = {
                "scanner_subscriptions": [
                    {
                        "scanner_id": sub.scanner_id,
                        "interval_seconds": sub.interval_seconds,
                        "active": sub.active,
                        "last_run": sub.last_run.isoformat() if sub.last_run else None,
                        "created_at": sub.created_at.isoformat()
                    }
                    for sub in scanner_subs.values()
                ],
                "alert_subscriptions": list(alert_subs),
                "aggregation_subscription": agg_subs if agg_subs else None,
                "active_tasks": len([k for k in self._scanner_tasks.keys() if k.startswith(client_id)])
            }

            await self.websocket_manager.send_personal_message({
                "type": "scanner_status",
                "status": status,
                "timestamp": datetime.utcnow().isoformat()
            }, client_id)

        except Exception as e:
            logger.error(f"Error getting scanner status: {e}")
            await self._send_error(client_id, f"Failed to get scanner status: {str(e)}")

    async def _scanner_streaming_task(self, subscription: ScannerSubscription):
        """Background task for streaming scanner results"""
        try:
            while subscription.active:
                try:
                    # TODO: Load scanner configuration from database
                    # For now, we'll use a mock configuration

                    # Mock scanner run
                    await asyncio.sleep(subscription.interval_seconds)

                    # Update last run time
                    subscription.last_run = datetime.utcnow()

                    # Send mock results
                    await self.websocket_manager.send_personal_message({
                        "type": "scanner_results",
                        "scanner_id": subscription.scanner_id,
                        "results": {
                            "scanner_id": subscription.scanner_id,
                            "scanner_name": f"Scanner {subscription.scanner_id}",
                            "scan_timestamp": datetime.utcnow().isoformat(),
                            "results": [],
                            "total_matches": 0,
                            "total_scanned": 0,
                            "scan_duration_ms": 100,
                            "filters_applied": 0,
                            "config_hash": "mock",
                            "cache_hit": False
                        },
                        "timestamp": datetime.utcnow().isoformat()
                    }, subscription.client_id)

                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error in scanner streaming task: {e}")
                    await asyncio.sleep(30)  # Wait before retrying

        except asyncio.CancelledError:
            pass
        finally:
            subscription.active = False

    async def _aggregation_streaming_task(self, client_id: str):
        """Background task for streaming aggregated results"""
        try:
            while client_id in self.aggregation_subscriptions:
                try:
                    config = self.aggregation_subscriptions[client_id]
                    interval = config["interval_seconds"]

                    await asyncio.sleep(interval)

                    # Update last run time
                    config["last_run"] = datetime.utcnow()

                    # TODO: Run actual aggregation
                    # For now, send mock aggregated results
                    await self.websocket_manager.send_personal_message({
                        "type": "aggregated_results",
                        "scanner_ids": config["scanner_ids"],
                        "results": [],
                        "timestamp": datetime.utcnow().isoformat()
                    }, client_id)

                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error in aggregation streaming task: {e}")
                    await asyncio.sleep(60)  # Wait before retrying

        except asyncio.CancelledError:
            pass

    async def _handle_scanner_alert(self, alert: ScannerAlert):
        """Handle scanner alerts and broadcast to subscribed clients"""
        try:
            # Find clients subscribed to this scanner's alerts
            alert_message = {
                "type": "scanner_alert",
                "alert": {
                    "alert_id": alert.alert_id,
                    "scanner_id": alert.scanner_id,
                    "scanner_name": alert.scanner_name,
                    "alert_type": alert.alert_type.value,
                    "symbol": alert.symbol,
                    "message": alert.message,
                    "condition": alert.condition,
                    "current_value": alert.current_value,
                    "threshold_value": alert.threshold_value,
                    "timestamp": alert.timestamp.isoformat(),
                    "priority": alert.priority
                },
                "timestamp": datetime.utcnow().isoformat()
            }

            # Send to subscribed clients
            for client_id, scanner_ids in self.alert_subscriptions.items():
                if alert.scanner_id in scanner_ids:
                    await self.websocket_manager.send_personal_message(alert_message, client_id)

        except Exception as e:
            logger.error(f"Error handling scanner alert broadcast: {e}")

    async def _send_error(self, client_id: str, error_message: str):
        """Send error message to client"""
        try:
            await self.websocket_manager.send_personal_message({
                "type": "error",
                "error": error_message,
                "timestamp": datetime.utcnow().isoformat()
            }, client_id)
        except Exception as e:
            logger.error(f"Failed to send error message to client {client_id}: {e}")

    def cleanup_client(self, client_id: str):
        """Clean up client subscriptions when disconnected"""
        try:
            # Cancel scanner tasks
            for task_key in list(self._scanner_tasks.keys()):
                if task_key.startswith(client_id):
                    self._scanner_tasks[task_key].cancel()
                    del self._scanner_tasks[task_key]

            # Remove subscriptions
            if client_id in self.scanner_subscriptions:
                del self.scanner_subscriptions[client_id]

            if client_id in self.alert_subscriptions:
                del self.alert_subscriptions[client_id]

            if client_id in self.aggregation_subscriptions:
                del self.aggregation_subscriptions[client_id]

            logger.info(f"Cleaned up scanner subscriptions for client {client_id}")

        except Exception as e:
            logger.error(f"Error cleaning up client {client_id}: {e}")

    def get_statistics(self) -> Dict[str, Any]:
        """Get scanner WebSocket statistics"""
        try:
            return {
                "total_scanner_subscriptions": sum(len(subs) for subs in self.scanner_subscriptions.values()),
                "total_alert_subscriptions": sum(len(subs) for subs in self.alert_subscriptions.values()),
                "total_aggregation_subscriptions": len(self.aggregation_subscriptions),
                "active_tasks": len(self._scanner_tasks),
                "connected_clients": len(set(
                    list(self.scanner_subscriptions.keys()) +
                    list(self.alert_subscriptions.keys()) +
                    list(self.aggregation_subscriptions.keys())
                ))
            }
        except Exception as e:
            logger.error(f"Error getting scanner WebSocket statistics: {e}")
            return {}


# Global scanner WebSocket manager instance
_scanner_websocket_manager: Optional[ScannerWebSocketManager] = None


def get_scanner_websocket_manager() -> Optional[ScannerWebSocketManager]:
    """Get the global scanner WebSocket manager"""
    return _scanner_websocket_manager


def initialize_scanner_websocket_manager(websocket_manager: ConnectionManager) -> ScannerWebSocketManager:
    """Initialize the global scanner WebSocket manager"""
    global _scanner_websocket_manager
    _scanner_websocket_manager = ScannerWebSocketManager(websocket_manager)
    return _scanner_websocket_manager