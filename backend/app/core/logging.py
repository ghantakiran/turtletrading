"""
Structured logging configuration for the TurtleTrading application
"""

import sys
import json
import uuid
from typing import Dict, Any, Optional
from loguru import logger
from app.core.config import settings
import contextvars


# Request context variables for structured logging
request_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("request_id", default=None)
user_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("user_id", default=None)
client_ip_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("client_ip", default=None)


def structured_formatter(record: Dict[str, Any]) -> str:
    """Format log record as structured JSON"""
    # Base log record
    log_record = {
        "timestamp": record["time"].isoformat(),
        "level": record["level"].name,
        "logger": record["name"],
        "module": record.get("module", "unknown"),
        "function": record.get("function", "unknown"),
        "line": record.get("line", 0),
        "message": record["message"],
        "process_id": record.get("process", {}).get("id"),
        "thread_id": record.get("thread", {}).get("id"),
    }
    
    # Add request context if available
    request_id = request_id_var.get()
    if request_id:
        log_record["request_id"] = request_id
        
    user_id = user_id_var.get()
    if user_id:
        log_record["user_id"] = user_id
        
    client_ip = client_ip_var.get()
    if client_ip:
        log_record["client_ip"] = client_ip
    
    # Add exception info if present
    if record["exception"]:
        log_record["exception"] = {
            "type": record["exception"].type.__name__ if record["exception"].type else None,
            "value": str(record["exception"].value) if record["exception"].value else None,
            "traceback": record["exception"].traceback if record["exception"].traceback else None
        }
    
    # Add extra fields from the record
    extra_fields = record.get("extra", {})
    if extra_fields:
        log_record.update(extra_fields)
    
    return json.dumps(log_record, default=str)


def console_formatter(record: Dict[str, Any]) -> str:
    """Format log record for console output with colors"""
    request_id = request_id_var.get()
    request_info = f"[req:{request_id[:8]}]" if request_id else ""
    
    user_id = user_id_var.get()
    user_info = f"[user:{user_id}]" if user_id else ""
    
    context_info = f"{request_info}{user_info}".strip()
    context_str = f" {context_info}" if context_info else ""
    
    return (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan>"
        f"<yellow>{context_str}</yellow> - "
        "<level>{message}</level>"
    )


def setup_logging():
    """Configure structured logging with loguru"""
    
    # Remove default logger
    logger.remove()
    
    # Console logging with colors and context
    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        colorize=True,
        format=console_formatter,
        backtrace=settings.DEBUG,
        diagnose=settings.DEBUG
    )
    
    # Structured JSON file logging
    logger.add(
        settings.LOG_FILE,
        level="DEBUG",
        rotation=settings.LOG_ROTATION,
        retention=settings.LOG_RETENTION,
        compression="zip",
        format=structured_formatter,
        enqueue=True,  # Thread-safe logging
        serialize=False  # We handle JSON formatting manually
    )
    
    # Error-only log file with detailed information
    logger.add(
        "error.log",
        level="ERROR",
        rotation="1 week",
        retention="1 month", 
        compression="zip",
        format=structured_formatter,
        backtrace=True,
        diagnose=True,
        enqueue=True
    )
    
    # Performance/metrics log file
    logger.add(
        "performance.log",
        level="INFO",
        filter=lambda record: record["extra"].get("log_type") == "performance",
        rotation="1 day",
        retention="7 days",
        compression="zip",
        format=structured_formatter,
        enqueue=True
    )
    
    return logger


def get_logger(name: str = None):
    """Get a logger instance with optional name"""
    if name:
        return logger.bind(logger=name)
    return logger


def set_request_context(request_id: str = None, user_id: str = None, client_ip: str = None):
    """Set request context variables for structured logging"""
    if request_id:
        request_id_var.set(request_id)
    if user_id:
        user_id_var.set(user_id)
    if client_ip:
        client_ip_var.set(client_ip)


def clear_request_context():
    """Clear all request context variables"""
    request_id_var.set(None)
    user_id_var.set(None)
    client_ip_var.set(None)


def log_api_request(method: str, path: str, status_code: int, duration: float, **kwargs):
    """Log API request with structured format"""
    logger.bind(
        log_type="api_request",
        method=method,
        path=path,
        status_code=status_code,
        duration_ms=round(duration * 1000, 2),
        **kwargs
    ).info(f"{method} {path} - {status_code} ({duration:.3f}s)")


def log_database_query(query_type: str, table: str, duration: float, **kwargs):
    """Log database query with performance metrics"""
    logger.bind(
        log_type="database",
        query_type=query_type,
        table=table,
        duration_ms=round(duration * 1000, 2),
        **kwargs
    ).debug(f"DB Query: {query_type} on {table} ({duration:.3f}s)")


def log_external_api_call(service: str, endpoint: str, status_code: int, duration: float, **kwargs):
    """Log external API call with performance metrics"""
    logger.bind(
        log_type="external_api",
        service=service,
        endpoint=endpoint,
        status_code=status_code,
        duration_ms=round(duration * 1000, 2),
        **kwargs
    ).info(f"External API: {service} {endpoint} - {status_code} ({duration:.3f}s)")


def log_websocket_event(event_type: str, client_id: str, **kwargs):
    """Log WebSocket events"""
    logger.bind(
        log_type="websocket",
        event_type=event_type,
        client_id=client_id,
        **kwargs
    ).info(f"WebSocket {event_type}: {client_id}")


def log_ml_prediction(model_type: str, symbol: str, confidence: float, duration: float, **kwargs):
    """Log ML prediction events"""
    logger.bind(
        log_type="ml_prediction",
        model_type=model_type,
        symbol=symbol,
        confidence=confidence,
        duration_ms=round(duration * 1000, 2),
        **kwargs
    ).info(f"ML Prediction: {model_type} for {symbol} (confidence: {confidence:.2f}, {duration:.3f}s)")


def log_performance_metric(metric_name: str, value: float, unit: str = None, **kwargs):
    """Log performance metrics"""
    logger.bind(
        log_type="performance",
        metric_name=metric_name,
        value=value,
        unit=unit,
        **kwargs
    ).info(f"Performance: {metric_name} = {value} {unit or ''}")


# Export the configured logger
structured_logger = setup_logging()