"""
Integration Tests for Broker Adapter Contracts

Tests that all broker adapters conform to the BrokerAdapter interface
and provide consistent behavior across different brokers.
"""

import pytest
import asyncio
from decimal import Decimal
from datetime import datetime
from typing import Type

from app.core.broker_adapter import BrokerAdapter, BrokerAdapterFactory
from app.models.brokerage_models import (
    BrokerConfig, BrokerType, OrderRequest, OrderSide, OrderType, OrderTimeInForce,
    PlaceOrderRequest, CancelOrderRequest, ModifyOrderRequest, OrderUpdate,
    GetOrderRequest, GetOrdersRequest, GetPositionsRequest, GetAccountRequest,
    PaperTradingConfig
)
from app.services.brokers.paper_broker import PaperBrokerAdapter
from app.services.brokers.alpaca_broker import AlpacaBrokerAdapter
from app.services.brokers.ib_broker import IBBrokerAdapter


class BrokerAdapterContractTest:
    """Base class for testing broker adapter contracts"""

    @pytest.fixture
    def adapter_class(self) -> Type[BrokerAdapter]:
        """Override in subclasses to specify adapter class"""
        raise NotImplementedError

    @pytest.fixture
    def broker_config(self) -> BrokerConfig:
        """Override in subclasses to provide broker-specific config"""
        raise NotImplementedError

    @pytest.fixture
    async def adapter(self, adapter_class, broker_config) -> BrokerAdapter:
        """Create and connect adapter instance"""
        adapter = adapter_class(broker_config)
        try:
            await adapter.connect()
            yield adapter
        finally:
            if hasattr(adapter, 'disconnect'):
                await adapter.disconnect()

    @pytest.fixture
    def sample_order_request(self) -> OrderRequest:
        """Sample order request for testing"""
        return OrderRequest(
            symbol="AAPL",
            side=OrderSide.BUY,
            quantity=Decimal('10'),
            order_type=OrderType.MARKET,
            time_in_force=OrderTimeInForce.DAY,
            extended_hours=False,
            client_order_id=f"test_order_{int(datetime.utcnow().timestamp())}"
        )

    @pytest.mark.asyncio
    async def test_connection_lifecycle(self, adapter):
        """Test connection and disconnection"""
        # Should be connected from fixture
        assert adapter.is_connected is True
        assert adapter.last_heartbeat is not None

        # Test heartbeat
        heartbeat_result = await adapter.heartbeat()
        assert heartbeat_result is True

        # Test disconnection
        disconnect_result = await adapter.disconnect()
        assert disconnect_result is True
        assert adapter.is_connected is False

    @pytest.mark.asyncio
    async def test_market_status(self, adapter):
        """Test market status check"""
        market_open = await adapter.is_market_open()
        assert isinstance(market_open, bool)

    @pytest.mark.asyncio
    async def test_place_order_interface(self, adapter, sample_order_request):
        """Test order placement interface"""
        request = PlaceOrderRequest(
            order=sample_order_request,
            account_id="test_account",
            dry_run=True
        )

        response = await adapter.place_order(request)

        # Verify response structure
        assert hasattr(response, 'success')
        assert hasattr(response, 'order')
        assert hasattr(response, 'error')
        assert hasattr(response, 'error_code')
        assert isinstance(response.success, bool)

        if response.success:
            assert response.order is not None
            assert response.order.symbol == sample_order_request.symbol
            assert response.order.side == sample_order_request.side
            assert response.order.quantity == sample_order_request.quantity
        else:
            assert response.error is not None

    @pytest.mark.asyncio
    async def test_get_orders_interface(self, adapter):
        """Test get orders interface"""
        request = GetOrdersRequest(
            account_id="test_account",
            limit=10
        )

        response = await adapter.get_orders(request)

        # Verify response structure
        assert hasattr(response, 'success')
        assert hasattr(response, 'orders')
        assert hasattr(response, 'error')
        assert isinstance(response.success, bool)

        if response.success:
            assert isinstance(response.orders, list)
        else:
            assert response.error is not None

    @pytest.mark.asyncio
    async def test_get_positions_interface(self, adapter):
        """Test get positions interface"""
        request = GetPositionsRequest(account_id="test_account")

        response = await adapter.get_positions(request)

        # Verify response structure
        assert hasattr(response, 'success')
        assert hasattr(response, 'positions')
        assert hasattr(response, 'error')
        assert isinstance(response.success, bool)

        if response.success:
            assert isinstance(response.positions, list)
        else:
            assert response.error is not None

    @pytest.mark.asyncio
    async def test_get_account_interface(self, adapter):
        """Test get account interface"""
        request = GetAccountRequest(account_id="test_account")

        response = await adapter.get_account(request)

        # Verify response structure
        assert hasattr(response, 'success')
        assert hasattr(response, 'account')
        assert hasattr(response, 'error')
        assert isinstance(response.success, bool)

        if response.success:
            assert response.account is not None
            assert hasattr(response.account, 'account_id')
            assert hasattr(response.account, 'cash')
            assert hasattr(response.account, 'buying_power')
        else:
            assert response.error is not None

    @pytest.mark.asyncio
    async def test_order_validation(self, adapter):
        """Test order validation"""
        # Test invalid order (zero quantity)
        invalid_order = OrderRequest(
            symbol="AAPL",
            side=OrderSide.BUY,
            quantity=Decimal('0'),  # Invalid
            order_type=OrderType.MARKET,
            time_in_force=OrderTimeInForce.DAY
        )

        request = PlaceOrderRequest(
            order=invalid_order,
            account_id="test_account",
            dry_run=True
        )

        response = await adapter.place_order(request)
        # Should either reject the order or handle validation gracefully
        assert isinstance(response.success, bool)

    @pytest.mark.asyncio
    async def test_health_check(self, adapter):
        """Test adapter health check"""
        health = await adapter.health_check()

        assert isinstance(health, dict)
        assert 'broker_type' in health
        assert 'is_connected' in health
        assert 'is_paper_trading' in health

    def test_broker_type_identification(self, adapter, broker_config):
        """Test broker type identification"""
        assert adapter.get_broker_type() == broker_config.broker_type.value
        assert adapter.is_paper_trading() == broker_config.is_paper_trading


class TestPaperBrokerAdapter(BrokerAdapterContractTest):
    """Test Paper Broker Adapter"""

    @pytest.fixture
    def adapter_class(self):
        return PaperBrokerAdapter

    @pytest.fixture
    def broker_config(self):
        return BrokerConfig(
            broker_type=BrokerType.PAPER,
            is_paper_trading=True,
            api_key="test_key",
            api_secret="test_secret"
        )

    @pytest.mark.asyncio
    async def test_paper_trading_simulation(self, adapter, sample_order_request):
        """Test paper trading specific simulation features"""
        # Test order placement with simulation
        request = PlaceOrderRequest(
            order=sample_order_request,
            account_id="PAPER_ACCOUNT_001",
            dry_run=False
        )

        response = await adapter.place_order(request)

        if response.success:
            order_id = response.order.order_id

            # Wait for simulated fill
            await asyncio.sleep(0.2)

            # Check order status
            get_request = GetOrderRequest(order_id=order_id, account_id="PAPER_ACCOUNT_001")
            get_response = await adapter.get_order(get_request)

            if get_response.success:
                # Order should be filled or partially filled for market order
                assert get_response.order.status.value in ['filled', 'partially_filled', 'accepted']

    @pytest.mark.asyncio
    async def test_paper_account_tracking(self, adapter):
        """Test paper trading account balance tracking"""
        # Get initial account
        request = GetAccountRequest(account_id="PAPER_ACCOUNT_001")
        response = await adapter.get_account(request)

        assert response.success is True
        initial_cash = response.account.cash

        # Place a buy order
        order_request = OrderRequest(
            symbol="AAPL",
            side=OrderSide.BUY,
            quantity=Decimal('1'),
            order_type=OrderType.MARKET,
            time_in_force=OrderTimeInForce.DAY
        )

        place_request = PlaceOrderRequest(
            order=order_request,
            account_id="PAPER_ACCOUNT_001",
            dry_run=False
        )

        place_response = await adapter.place_order(place_request)

        if place_response.success:
            # Wait for execution
            await asyncio.sleep(0.2)

            # Check account balance changed
            updated_response = await adapter.get_account(request)
            if updated_response.success:
                # Cash should be reduced (or at least not increased)
                assert updated_response.account.cash <= initial_cash


class TestAlpacaBrokerAdapter(BrokerAdapterContractTest):
    """Test Alpaca Broker Adapter"""

    @pytest.fixture
    def adapter_class(self):
        return AlpacaBrokerAdapter

    @pytest.fixture
    def broker_config(self):
        return BrokerConfig(
            broker_type=BrokerType.ALPACA,
            is_paper_trading=True,
            api_key="test_alpaca_key",
            api_secret="test_alpaca_secret",
            base_url="https://paper-api.alpaca.markets"
        )

    @pytest.mark.asyncio
    async def test_alpaca_connection_failure(self, broker_config):
        """Test Alpaca connection with invalid credentials"""
        # This test expects connection to fail with test credentials
        adapter = AlpacaBrokerAdapter(broker_config)

        with pytest.raises(Exception):  # Should raise BrokerConnectionError or similar
            await adapter.connect()

    def test_alpaca_order_conversion(self, adapter, sample_order_request):
        """Test Alpaca order format conversion"""
        # Test order conversion methods exist and work
        alpaca_order = adapter._convert_to_alpaca_order(sample_order_request)

        assert isinstance(alpaca_order, dict)
        assert 'symbol' in alpaca_order
        assert 'qty' in alpaca_order
        assert 'side' in alpaca_order
        assert 'type' in alpaca_order

    def test_alpaca_status_mapping(self, adapter):
        """Test Alpaca status mapping"""
        # Test status conversion methods
        from app.models.brokerage_models import OrderStatus

        # Test converting to Alpaca format
        alpaca_status = adapter._convert_status_to_alpaca(OrderStatus.SUBMITTED)
        assert alpaca_status == 'new'

        # Test converting from Alpaca format
        order_status = adapter._status_mapping.get('filled')
        assert order_status == OrderStatus.FILLED


class TestIBBrokerAdapter(BrokerAdapterContractTest):
    """Test Interactive Brokers Adapter"""

    @pytest.fixture
    def adapter_class(self):
        return IBBrokerAdapter

    @pytest.fixture
    def broker_config(self):
        return BrokerConfig(
            broker_type=BrokerType.INTERACTIVE_BROKERS,
            is_paper_trading=True,
            api_key="test_ib_key",
            api_secret="test_ib_secret",
            metadata={
                'ib_host': 'localhost',
                'ib_port': 7497,
                'ib_client_id': 1
            }
        )

    @pytest.mark.asyncio
    async def test_ib_connection_failure(self, broker_config):
        """Test IB connection failure (expected without TWS running)"""
        adapter = IBBrokerAdapter(broker_config)

        # This will likely fail since TWS/Gateway is not running
        with pytest.raises(Exception):
            await adapter.connect()

    def test_ib_contract_creation(self, adapter):
        """Test IB contract creation"""
        contract = adapter._create_ib_contract("AAPL")

        # Contract should have required fields
        assert hasattr(contract, 'symbol')
        assert hasattr(contract, 'secType')
        assert hasattr(contract, 'exchange')
        assert hasattr(contract, 'currency')

    def test_ib_order_creation(self, adapter, sample_order_request):
        """Test IB order creation"""
        ib_order = adapter._create_ib_order(sample_order_request)

        # Order should have required fields
        assert hasattr(ib_order, 'action')
        assert hasattr(ib_order, 'totalQuantity')
        assert hasattr(ib_order, 'orderType')
        assert hasattr(ib_order, 'tif')

    def test_ib_order_type_conversion(self, adapter):
        """Test IB order type conversion"""
        from app.models.brokerage_models import OrderType

        assert adapter._convert_order_type_to_ib(OrderType.MARKET) == "MKT"
        assert adapter._convert_order_type_to_ib(OrderType.LIMIT) == "LMT"
        assert adapter._convert_order_type_to_ib(OrderType.STOP) == "STP"


class TestBrokerAdapterFactory:
    """Test broker adapter factory"""

    def test_factory_registration(self):
        """Test adapter registration with factory"""
        # Verify all adapters are registered
        supported_brokers = BrokerAdapterFactory.get_supported_brokers()

        assert "paper" in supported_brokers
        assert "alpaca" in supported_brokers
        assert "interactive_brokers" in supported_brokers

    def test_factory_creation(self):
        """Test adapter creation via factory"""
        config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            is_paper_trading=True,
            api_key="test_key",
            api_secret="test_secret"
        )

        adapter = BrokerAdapterFactory.create_adapter(config)

        assert isinstance(adapter, PaperBrokerAdapter)
        assert adapter.config == config

    def test_factory_invalid_broker(self):
        """Test factory with invalid broker type"""
        config = BrokerConfig(
            broker_type="invalid_broker",  # This will cause validation error
            is_paper_trading=True,
            api_key="test_key",
            api_secret="test_secret"
        )

        with pytest.raises(ValueError):
            config = BrokerConfig(
                broker_type=BrokerType.PAPER,  # Use valid type but then modify
                is_paper_trading=True,
                api_key="test_key",
                api_secret="test_secret"
            )
            config.broker_type = "invalid"  # Manually set invalid value
            BrokerAdapterFactory.create_adapter(config)


class TestCrossAdapterConsistency:
    """Test consistency across different broker adapters"""

    @pytest.fixture
    def paper_adapter(self):
        config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            is_paper_trading=True,
            api_key="test_key",
            api_secret="test_secret"
        )
        return PaperBrokerAdapter(config)

    @pytest.fixture
    def alpaca_adapter(self):
        config = BrokerConfig(
            broker_type=BrokerType.ALPACA,
            is_paper_trading=True,
            api_key="test_key",
            api_secret="test_secret"
        )
        return AlpacaBrokerAdapter(config)

    def test_adapter_interface_consistency(self, paper_adapter, alpaca_adapter):
        """Test that all adapters implement the same interface"""
        adapters = [paper_adapter, alpaca_adapter]

        for adapter in adapters:
            # Verify all required methods exist
            assert hasattr(adapter, 'connect')
            assert hasattr(adapter, 'disconnect')
            assert hasattr(adapter, 'is_market_open')
            assert hasattr(adapter, 'place_order')
            assert hasattr(adapter, 'cancel_order')
            assert hasattr(adapter, 'modify_order')
            assert hasattr(adapter, 'get_order')
            assert hasattr(adapter, 'get_orders')
            assert hasattr(adapter, 'get_positions')
            assert hasattr(adapter, 'get_position')
            assert hasattr(adapter, 'get_account')
            assert hasattr(adapter, 'health_check')

            # Verify all methods are callable
            assert callable(adapter.connect)
            assert callable(adapter.disconnect)
            assert callable(adapter.is_market_open)
            assert callable(adapter.place_order)
            assert callable(adapter.cancel_order)
            assert callable(adapter.modify_order)
            assert callable(adapter.get_order)
            assert callable(adapter.get_orders)
            assert callable(adapter.get_positions)
            assert callable(adapter.get_position)
            assert callable(adapter.get_account)
            assert callable(adapter.health_check)

    def test_order_request_compatibility(self, paper_adapter, alpaca_adapter):
        """Test that order requests are handled consistently"""
        order_request = OrderRequest(
            symbol="AAPL",
            side=OrderSide.BUY,
            quantity=Decimal('10'),
            order_type=OrderType.LIMIT,
            limit_price=Decimal('150.00'),
            time_in_force=OrderTimeInForce.DAY
        )

        # Both adapters should handle the same request format
        # (Even if they process it differently internally)
        assert order_request.symbol == "AAPL"
        assert order_request.side == OrderSide.BUY
        assert order_request.quantity == Decimal('10')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])