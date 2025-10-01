"""
Unit tests for database models and operations (TDD approach)

Tests database connectivity, model CRUD operations, and data integrity
for the TurtleTrading platform.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database_models import (
    User, Stock, PriceHistory, Portfolio, PortfolioHolding,
    Alert, TechnicalIndicator, Prediction, SentimentData
)


class TestUserModel:
    """Test User model CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_user(self, db_session: AsyncSession):
        """Test creating a new user."""
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hashed_password_here",
            full_name="Test User"
        )

        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.is_active is True
        assert user.created_at is not None

    @pytest.mark.asyncio
    async def test_read_user(self, db_session: AsyncSession):
        """Test reading a user from database."""
        # Create user
        user = User(
            email="read@example.com",
            username="readuser",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()

        # Read user
        result = await db_session.execute(
            select(User).where(User.email == "read@example.com")
        )
        found_user = result.scalar_one_or_none()

        assert found_user is not None
        assert found_user.email == "read@example.com"
        assert found_user.username == "readuser"

    @pytest.mark.asyncio
    async def test_update_user(self, db_session: AsyncSession):
        """Test updating user information."""
        user = User(
            email="update@example.com",
            username="updateuser",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()

        # Update user
        user.full_name = "Updated Name"
        user.is_verified = True
        await db_session.commit()
        await db_session.refresh(user)

        assert user.full_name == "Updated Name"
        assert user.is_verified is True

    @pytest.mark.asyncio
    async def test_delete_user(self, db_session: AsyncSession):
        """Test deleting a user."""
        user = User(
            email="delete@example.com",
            username="deleteuser",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        user_id = user.id

        # Delete user
        await db_session.delete(user)
        await db_session.commit()

        # Verify deletion
        result = await db_session.execute(
            select(User).where(User.id == user_id)
        )
        deleted_user = result.scalar_one_or_none()

        assert deleted_user is None


class TestStockModel:
    """Test Stock model operations."""

    @pytest.mark.asyncio
    async def test_create_stock(self, db_session: AsyncSession):
        """Test creating a stock entry."""
        stock = Stock(
            symbol="AAPL",
            name="Apple Inc.",
            exchange="NASDAQ",
            currency="USD",
            country="US",
            sector="Technology",
            industry="Consumer Electronics"
        )

        db_session.add(stock)
        await db_session.commit()
        await db_session.refresh(stock)

        assert stock.id is not None
        assert stock.symbol == "AAPL"
        assert stock.name == "Apple Inc."
        assert stock.exchange == "NASDAQ"

    @pytest.mark.asyncio
    async def test_stock_unique_symbol(self, db_session: AsyncSession):
        """Test that stock symbols must be unique."""
        stock1 = Stock(symbol="AAPL", name="Apple Inc.")
        stock2 = Stock(symbol="AAPL", name="Apple Duplicate")

        db_session.add(stock1)
        await db_session.commit()

        db_session.add(stock2)
        with pytest.raises(Exception):  # Should raise integrity error
            await db_session.commit()


class TestPriceHistoryModel:
    """Test PriceHistory model operations."""

    @pytest.mark.asyncio
    async def test_create_price_history(self, db_session: AsyncSession):
        """Test creating price history entry."""
        # First create a stock
        stock = Stock(symbol="AAPL", name="Apple Inc.")
        db_session.add(stock)
        await db_session.commit()

        # Create price history
        price_history = PriceHistory(
            stock_id=stock.id,
            date=datetime.now(timezone.utc),
            open=150.00,
            high=155.00,
            low=149.00,
            close=153.00,
            volume=50000000,
            adjusted_close=153.00
        )

        db_session.add(price_history)
        await db_session.commit()
        await db_session.refresh(price_history)

        assert price_history.id is not None
        assert price_history.stock_id == stock.id
        assert price_history.close == 153.00
        assert price_history.volume == 50000000


class TestPortfolioModel:
    """Test Portfolio and PortfolioHolding models."""

    @pytest.mark.asyncio
    async def test_create_portfolio(self, db_session: AsyncSession):
        """Test creating a portfolio."""
        # Create user first
        user = User(
            email="portfolio@example.com",
            username="portfoliouser",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()

        # Create portfolio
        portfolio = Portfolio(
            user_id=user.id,
            name="My Portfolio",
            cash_balance=10000.00,
            total_value=10500.00
        )

        db_session.add(portfolio)
        await db_session.commit()
        await db_session.refresh(portfolio)

        assert portfolio.id is not None
        assert portfolio.user_id == user.id
        assert portfolio.name == "My Portfolio"
        assert portfolio.cash_balance == 10000.00
        assert portfolio.total_value == 10500.00

    @pytest.mark.asyncio
    async def test_create_portfolio_holding(self, db_session: AsyncSession):
        """Test creating a portfolio holding."""
        # Create dependencies
        user = User(email="holding@example.com", username="holdinguser", hashed_password="pwd")
        stock = Stock(symbol="TSLA", name="Tesla Inc.")
        portfolio = Portfolio(
            user_id=user.id,
            name="Test Portfolio",
            cash_balance=10000.00,
            total_value=10000.00
        )

        db_session.add_all([user, stock])
        await db_session.commit()

        portfolio.user_id = user.id
        db_session.add(portfolio)
        await db_session.commit()

        # Create holding
        holding = PortfolioHolding(
            portfolio_id=portfolio.id,
            stock_id=stock.id,
            quantity=10,
            average_buy_price=250.00,
            current_price=255.00
        )

        db_session.add(holding)
        await db_session.commit()
        await db_session.refresh(holding)

        assert holding.id is not None
        assert holding.portfolio_id == portfolio.id
        assert holding.stock_id == stock.id
        assert holding.quantity == 10
        assert holding.average_buy_price == 250.00


class TestAlertModel:
    """Test Alert model operations."""

    @pytest.mark.asyncio
    async def test_create_price_alert(self, db_session: AsyncSession):
        """Test creating a price alert."""
        # Create dependencies
        user = User(email="alert@example.com", username="alertuser", hashed_password="pwd")
        stock = Stock(symbol="GOOGL", name="Alphabet Inc.")

        db_session.add_all([user, stock])
        await db_session.commit()

        # Create alert
        alert = Alert(
            user_id=user.id,
            stock_id=stock.id,
            alert_type="price",
            condition="above",
            threshold=2800.00,
            is_active=True
        )

        db_session.add(alert)
        await db_session.commit()
        await db_session.refresh(alert)

        assert alert.id is not None
        assert alert.user_id == user.id
        assert alert.stock_id == stock.id
        assert alert.alert_type == "price"
        assert alert.threshold == 2800.00
        assert alert.is_active is True


class TestTechnicalIndicatorModel:
    """Test TechnicalIndicator model operations."""

    @pytest.mark.asyncio
    async def test_create_technical_indicator(self, db_session: AsyncSession):
        """Test creating technical indicator data."""
        stock = Stock(symbol="MSFT", name="Microsoft Corporation")
        db_session.add(stock)
        await db_session.commit()

        indicator = TechnicalIndicator(
            stock_id=stock.id,
            date=datetime.now(timezone.utc),
            indicator_type="RSI",
            value=65.5,
            period=14
        )

        db_session.add(indicator)
        await db_session.commit()
        await db_session.refresh(indicator)

        assert indicator.id is not None
        assert indicator.stock_id == stock.id
        assert indicator.indicator_type == "RSI"
        assert indicator.value == 65.5
        assert indicator.period == 14


class TestPredictionModel:
    """Test LSTM Prediction model operations."""

    @pytest.mark.asyncio
    async def test_create_prediction(self, db_session: AsyncSession):
        """Test creating an LSTM prediction."""
        stock = Stock(symbol="NVDA", name="NVIDIA Corporation")
        db_session.add(stock)
        await db_session.commit()

        prediction = Prediction(
            stock_id=stock.id,
            prediction_date=datetime.now(timezone.utc),
            target_date=datetime.now(timezone.utc),
            predicted_price=850.00,
            confidence_score=0.85,
            model_version="v1.0"
        )

        db_session.add(prediction)
        await db_session.commit()
        await db_session.refresh(prediction)

        assert prediction.id is not None
        assert prediction.stock_id == stock.id
        assert prediction.predicted_price == 850.00
        assert prediction.confidence_score == 0.85


class TestSentimentDataModel:
    """Test SentimentData model operations."""

    @pytest.mark.asyncio
    async def test_create_sentiment_data(self, db_session: AsyncSession):
        """Test creating sentiment analysis data."""
        stock = Stock(symbol="AMZN", name="Amazon.com Inc.")
        db_session.add(stock)
        await db_session.commit()

        sentiment = SentimentData(
            stock_id=stock.id,
            date=datetime.now(timezone.utc),
            source="twitter",
            sentiment_score=0.75,
            volume=1500,
            positive_mentions=1000,
            negative_mentions=200,
            neutral_mentions=300
        )

        db_session.add(sentiment)
        await db_session.commit()
        await db_session.refresh(sentiment)

        assert sentiment.id is not None
        assert sentiment.stock_id == stock.id
        assert sentiment.source == "twitter"
        assert sentiment.sentiment_score == 0.75
        assert sentiment.positive_mentions == 1000


class TestDatabaseIntegrity:
    """Test database relationships and integrity constraints."""

    @pytest.mark.asyncio
    async def test_cascade_delete_portfolio(self, db_session: AsyncSession):
        """Test that deleting a portfolio cascades to holdings."""
        # Create test data
        user = User(email="cascade@example.com", username="cascadeuser", hashed_password="pwd")
        stock = Stock(symbol="FB", name="Meta Platforms Inc.")
        db_session.add_all([user, stock])
        await db_session.commit()

        portfolio = Portfolio(
            user_id=user.id,
            name="Delete Test",
            cash_balance=5000.00,
            total_value=5000.00
        )
        db_session.add(portfolio)
        await db_session.commit()

        holding = PortfolioHolding(
            portfolio_id=portfolio.id,
            stock_id=stock.id,
            quantity=5,
            average_buy_price=300.00
        )
        db_session.add(holding)
        await db_session.commit()

        portfolio_id = portfolio.id

        # Delete portfolio
        await db_session.delete(portfolio)
        await db_session.commit()

        # Verify holdings are also deleted (cascade)
        result = await db_session.execute(
            select(PortfolioHolding).where(PortfolioHolding.portfolio_id == portfolio_id)
        )
        orphaned_holdings = result.scalars().all()

        assert len(orphaned_holdings) == 0

    @pytest.mark.asyncio
    async def test_foreign_key_constraint(self, db_session: AsyncSession):
        """Test foreign key constraints are enforced."""
        # Try to create portfolio with non-existent user
        invalid_user_id = uuid4()
        portfolio = Portfolio(
            user_id=invalid_user_id,
            name="Invalid Portfolio",
            cash_balance=1000.00,
            total_value=1000.00
        )

        db_session.add(portfolio)
        with pytest.raises(Exception):  # Should raise foreign key constraint error
            await db_session.commit()


class TestDatabaseConnection:
    """Test database connection and basic operations."""

    @pytest.mark.asyncio
    async def test_database_connection(self, db_session: AsyncSession):
        """Test that database connection is working."""
        # Simple query to test connection
        result = await db_session.execute(select(User).limit(1))
        assert result is not None

    @pytest.mark.asyncio
    async def test_transaction_rollback(self, db_session: AsyncSession):
        """Test transaction rollback functionality."""
        user = User(
            email="rollback@example.com",
            username="rollbackuser",
            hashed_password="pwd"
        )

        db_session.add(user)
        await db_session.flush()  # Flush but don't commit

        user_id = user.id
        assert user_id is not None

        await db_session.rollback()

        # Verify user was not persisted
        result = await db_session.execute(
            select(User).where(User.id == user_id)
        )
        rolled_back_user = result.scalar_one_or_none()

        assert rolled_back_user is None


# Run tests with: pytest tests/unit/test_database.py -v
