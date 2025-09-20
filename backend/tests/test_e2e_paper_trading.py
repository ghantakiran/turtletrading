"""
End-to-End Tests for Paper Trading Flow

Tests the complete paper trading workflow from order placement
through execution and account updates using the full stack.
"""

import pytest
import asyncio
from decimal import Decimal
from datetime import datetime
from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.main import app
from app.models.brokerage_models import (
    BrokerConfig, BrokerType, OrderSide, OrderType, OrderTimeInForce, OrderStatus,
    PaperTradingConfig
)


class TestPaperTradingE2E:
    """End-to-end tests for paper trading"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)

    @pytest.fixture
    async def async_client(self):
        """Create async test client"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            yield client

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers"""
        return {"Authorization": "Bearer test_token"}

    @pytest.fixture
    def paper_config(self):
        """Paper trading configuration"""
        return {
            "broker_type": "paper",
            "account_id": "PAPER_ACCOUNT_001"
        }

    def test_paper_trading_health_check(self, client):
        """Test brokerage service health check"""
        response = client.get("/api/v1/brokerage/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "brokerage"
        assert "paper" in data["supported_brokers"]

    def test_market_status_check(self, client, auth_headers):
        """Test market status endpoint"""
        response = client.get(
            "/api/v1/brokerage/market-status",
            headers=auth_headers,
            params={"broker_type": "paper"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "market_open" in data
        assert data["broker_type"] == "paper"
        assert isinstance(data["market_open"], bool)

    def test_get_account_info(self, client, auth_headers, paper_config):
        """Test getting account information"""
        response = client.get(
            "/api/v1/brokerage/account",
            headers=auth_headers,
            params=paper_config
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["account"] is not None

        account = data["account"]
        assert account["account_id"] == "PAPER_ACCOUNT_001"
        assert account["broker_type"] == "paper"
        assert "cash" in account
        assert "buying_power" in account
        assert "portfolio_value" in account

    def test_place_market_order(self, client, auth_headers, paper_config):
        """Test placing a market order"""
        order_data = {
            "order": {
                "symbol": "AAPL",
                "side": "buy",
                "quantity": "10",
                "order_type": "market",
                "time_in_force": "day",
                "extended_hours": False,
                "client_order_id": f"test_market_order_{int(datetime.utcnow().timestamp())}"
            },
            "account_id": paper_config["account_id"],
            "dry_run": False
        }

        response = client.post(
            "/api/v1/brokerage/orders",
            headers=auth_headers,
            json=order_data,
            params={"broker_type": paper_config["broker_type"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["order"] is not None

        order = data["order"]
        assert order["symbol"] == "AAPL"
        assert order["side"] == "buy"
        assert order["quantity"] == "10"
        assert order["order_type"] == "market"
        assert order["status"] in ["submitted", "accepted"]

        return order["order_id"]

    def test_place_limit_order(self, client, auth_headers, paper_config):
        """Test placing a limit order"""
        order_data = {
            "order": {
                "symbol": "MSFT",
                "side": "sell",
                "quantity": "5",
                "order_type": "limit",
                "limit_price": "300.00",
                "time_in_force": "gtc",
                "extended_hours": False,
                "client_order_id": f"test_limit_order_{int(datetime.utcnow().timestamp())}"
            },
            "account_id": paper_config["account_id"],
            "dry_run": False
        }

        response = client.post(
            "/api/v1/brokerage/orders",
            headers=auth_headers,
            json=order_data,
            params={"broker_type": paper_config["broker_type"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["order"] is not None

        order = data["order"]
        assert order["symbol"] == "MSFT"
        assert order["side"] == "sell"
        assert order["limit_price"] == "300.00"

        return order["order_id"]

    def test_order_idempotency(self, client, auth_headers, paper_config):
        """Test order idempotency with duplicate requests"""
        idempotency_key = f"test_idempotency_{int(datetime.utcnow().timestamp())}"

        order_data = {
            "order": {
                "symbol": "GOOGL",
                "side": "buy",
                "quantity": "2",
                "order_type": "market",
                "time_in_force": "day",
                "client_order_id": f"test_idem_order_{int(datetime.utcnow().timestamp())}"
            },
            "account_id": paper_config["account_id"],
            "dry_run": False
        }

        headers = {**auth_headers, "Idempotency-Key": idempotency_key}

        # First request
        response1 = client.post(
            "/api/v1/brokerage/orders",
            headers=headers,
            json=order_data,
            params={"broker_type": paper_config["broker_type"]}
        )

        # Second request with same idempotency key
        response2 = client.post(
            "/api/v1/brokerage/orders",
            headers=headers,
            json=order_data,
            params={"broker_type": paper_config["broker_type"]}
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        # Should return the same order
        order1 = response1.json()["order"]
        order2 = response2.json()["order"]
        assert order1["order_id"] == order2["order_id"]

    def test_cancel_order(self, client, auth_headers, paper_config):
        """Test canceling an order"""
        # First place an order
        order_id = self.test_place_limit_order(client, auth_headers, paper_config)

        # Then cancel it
        response = client.delete(
            f"/api/v1/brokerage/orders/{order_id}",
            headers=auth_headers,
            params={**paper_config}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["order"]["status"] in ["canceled", "cancelled"]

    def test_modify_order(self, client, auth_headers, paper_config):
        """Test modifying an order"""
        # First place a limit order
        order_id = self.test_place_limit_order(client, auth_headers, paper_config)

        # Then modify it
        modify_data = {
            "order_update": {
                "order_id": order_id,
                "limit_price": "310.00",
                "quantity": "8"
            },
            "account_id": paper_config["account_id"]
        }

        response = client.patch(
            f"/api/v1/brokerage/orders/{order_id}",
            headers=auth_headers,
            json=modify_data,
            params={"broker_type": paper_config["broker_type"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        order = data["order"]
        assert order["limit_price"] == "310.00"
        assert order["quantity"] == "8"

    def test_get_orders(self, client, auth_headers, paper_config):
        """Test getting orders list"""
        # Place a few orders first
        self.test_place_market_order(client, auth_headers, paper_config)
        self.test_place_limit_order(client, auth_headers, paper_config)

        # Get orders
        response = client.get(
            "/api/v1/brokerage/orders",
            headers=auth_headers,
            params={**paper_config, "limit": 10}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["orders"], list)
        assert len(data["orders"]) >= 2

    def test_get_positions(self, client, auth_headers, paper_config):
        """Test getting positions"""
        response = client.get(
            "/api/v1/brokerage/positions",
            headers=auth_headers,
            params=paper_config
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["positions"], list)

    @pytest.mark.asyncio
    async def test_order_execution_flow(self, async_client, auth_headers, paper_config):
        """Test complete order execution flow with fills"""
        # Place a market order
        order_data = {
            "order": {
                "symbol": "TSLA",
                "side": "buy",
                "quantity": "1",
                "order_type": "market",
                "time_in_force": "day",
                "client_order_id": f"test_exec_flow_{int(datetime.utcnow().timestamp())}"
            },
            "account_id": paper_config["account_id"],
            "dry_run": False
        }

        response = await async_client.post(
            "/api/v1/brokerage/orders",
            headers=auth_headers,
            json=order_data,
            params={"broker_type": paper_config["broker_type"]}
        )

        assert response.status_code == 200
        data = response.json()
        order_id = data["order"]["order_id"]

        # Wait for simulated execution
        await asyncio.sleep(0.3)

        # Check order status
        response = await async_client.get(
            f"/api/v1/brokerage/orders/{order_id}",
            headers=auth_headers,
            params=paper_config
        )

        assert response.status_code == 200
        data = response.json()

        if data["success"]:
            order = data["order"]
            # Market order should be filled quickly in paper trading
            assert order["status"] in ["filled", "partially_filled", "accepted"]

            if order["status"] == "filled":
                assert order["filled_quantity"] == order["quantity"]
                assert order["average_fill_price"] is not None

    def test_webhook_processing(self, client):
        """Test webhook processing for paper trading"""
        webhook_payload = {
            "event_type": "order_filled",
            "account_id": "PAPER_ACCOUNT_001",
            "data": {
                "order_id": "PAPER_12345678",
                "fill": {
                    "quantity": "10",
                    "price": "150.00"
                },
                "cumulative_filled_quantity": "10",
                "total_quantity": "10"
            }
        }

        response = client.post(
            "/api/v1/brokerage/webhooks/paper",
            json=webhook_payload
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "accepted"

    def test_order_validation_errors(self, client, auth_headers, paper_config):
        """Test order validation and error handling"""
        # Test invalid order (zero quantity)
        invalid_order = {
            "order": {
                "symbol": "AAPL",
                "side": "buy",
                "quantity": "0",  # Invalid
                "order_type": "market",
                "time_in_force": "day"
            },
            "account_id": paper_config["account_id"],
            "dry_run": False
        }

        response = client.post(
            "/api/v1/brokerage/orders",
            headers=auth_headers,
            json=invalid_order,
            params={"broker_type": paper_config["broker_type"]}
        )

        # Should either return error or handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_adapter_management(self, client, auth_headers):
        """Test broker adapter management endpoints"""
        # List adapters
        response = client.get(
            "/api/v1/brokerage/adapters",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "adapters" in data
        assert isinstance(data["adapters"], list)

        # Connect to paper adapter
        response = client.post(
            "/api/v1/brokerage/adapters/paper/connect",
            headers=auth_headers,
            params={"account_id": "PAPER_ACCOUNT_001"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "connected"
        assert data["broker_type"] == "paper"

    def test_concurrent_orders(self, client, auth_headers, paper_config):
        """Test placing multiple concurrent orders"""
        import threading
        import time

        results = []

        def place_order(symbol, quantity):
            order_data = {
                "order": {
                    "symbol": symbol,
                    "side": "buy",
                    "quantity": str(quantity),
                    "order_type": "market",
                    "time_in_force": "day",
                    "client_order_id": f"concurrent_{symbol}_{int(time.time())}"
                },
                "account_id": paper_config["account_id"],
                "dry_run": False
            }

            response = client.post(
                "/api/v1/brokerage/orders",
                headers=auth_headers,
                json=order_data,
                params={"broker_type": paper_config["broker_type"]}
            )

            results.append(response.status_code == 200)

        # Place multiple orders concurrently
        symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
        threads = []

        for i, symbol in enumerate(symbols):
            thread = threading.Thread(target=place_order, args=(symbol, i + 1))
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # All orders should succeed
        assert all(results)
        assert len(results) == len(symbols)

    def test_error_handling(self, client, auth_headers):
        """Test error handling for invalid requests"""
        # Test invalid broker type
        response = client.get(
            "/api/v1/brokerage/account",
            headers=auth_headers,
            params={"broker_type": "invalid", "account_id": "test"}
        )

        assert response.status_code == 500

        # Test missing parameters
        response = client.post(
            "/api/v1/brokerage/orders",
            headers=auth_headers,
            json={}
        )

        assert response.status_code == 422  # Validation error


class TestPaperTradingWebhooks:
    """Test webhook processing specifically for paper trading"""

    def test_order_fill_webhook(self, client):
        """Test order fill webhook processing"""
        webhook_data = {
            "event_type": "order_filled",
            "account_id": "PAPER_ACCOUNT_001",
            "data": {
                "order_id": "PAPER_TEST_001",
                "symbol": "AAPL",
                "side": "buy",
                "fill": {
                    "quantity": "10",
                    "price": "150.00"
                },
                "cumulative_filled_quantity": "10",
                "total_quantity": "10"
            }
        }

        response = client.post(
            "/api/v1/brokerage/webhooks/paper",
            json=webhook_data
        )

        assert response.status_code == 200

    def test_order_cancellation_webhook(self, client):
        """Test order cancellation webhook"""
        webhook_data = {
            "event_type": "order_cancelled",
            "account_id": "PAPER_ACCOUNT_001",
            "data": {
                "order_id": "PAPER_TEST_002",
                "reason": "User cancelled"
            }
        }

        response = client.post(
            "/api/v1/brokerage/webhooks/paper",
            json=webhook_data
        )

        assert response.status_code == 200

    def test_order_rejection_webhook(self, client):
        """Test order rejection webhook"""
        webhook_data = {
            "event_type": "order_rejected",
            "account_id": "PAPER_ACCOUNT_001",
            "data": {
                "order_id": "PAPER_TEST_003",
                "reason": "Insufficient funds"
            }
        }

        response = client.post(
            "/api/v1/brokerage/webhooks/paper",
            json=webhook_data
        )

        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])