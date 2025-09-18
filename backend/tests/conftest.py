"""
Test configuration and fixtures for TurtleTrading backend
"""

import asyncio
import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db, Base
from app.core.config import settings


# Set test environment
os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["ASYNC_DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["ALLOWED_HOSTS"] = "localhost,127.0.0.1,0.0.0.0,testserver"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Test database engine
test_engine = create_async_engine(
    "sqlite+aiosqlite:///./test.db",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

TestSessionLocal = sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async with test_engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
    async with TestSessionLocal() as session:
        yield session
        
    # Clean up - drop all tables after test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def get_test_db() -> AsyncGenerator[AsyncSession, None]:
    """Override dependency for test database."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test HTTP client."""

    # Override database dependency
    app.dependency_overrides[get_db] = get_test_db

    # Use transport parameter for newer HTTPX versions
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        yield ac

    # Clean up overrides
    app.dependency_overrides.clear()


@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    from unittest.mock import MagicMock
    
    mock_client = MagicMock()
    mock_client.ping.return_value = True
    mock_client.get.return_value = None
    mock_client.set.return_value = True
    mock_client.delete.return_value = 1
    mock_client.keys.return_value = []
    
    return mock_client


@pytest.fixture
def sample_stock_data():
    """Sample stock data for testing."""
    return {
        "symbol": "AAPL",
        "price": 150.25,
        "change": 2.50,
        "change_percent": 1.69,
        "volume": 50000000,
        "market_cap": 2500000000000,
    }


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "email": "test@example.com",
        "full_name": "Test User",
        "password": "testpassword123",
    }


@pytest.fixture
def auth_headers():
    """Sample authentication headers."""
    return {"Authorization": "Bearer test_token"}


@pytest.fixture
def mock_external_api():
    """Mock external API responses."""
    from unittest.mock import patch
    
    with patch("yfinance.Ticker") as mock_ticker:
        mock_ticker.return_value.info = {
            "symbol": "AAPL",
            "longName": "Apple Inc.",
            "currentPrice": 150.25,
            "marketCap": 2500000000000,
        }
        mock_ticker.return_value.history.return_value.to_dict.return_value = {
            "Close": {0: 150.25},
            "Volume": {0: 50000000},
        }
        yield mock_ticker


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Set up test environment variables."""
    original_env = os.environ.copy()
    
    # Set test-specific environment variables
    os.environ.update({
        "TESTING": "true",
        "DEBUG": "true",
        "SECRET_KEY": "test-secret-key-for-testing-only",
        "REDIS_URL": "redis://localhost:6379/1",  # Use different DB for tests
        "CACHE_TTL": "60",
    })
    
    yield
    
    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


class TestClient:
    """Helper class for making authenticated test requests."""
    
    def __init__(self, client: AsyncClient):
        self.client = client
        self.token = None
    
    async def login(self, email: str, password: str) -> str:
        """Login and store authentication token."""
        response = await self.client.post(
            "/api/v1/auth/token",
            data={"username": email, "password": password}
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            return self.token
        raise Exception(f"Login failed: {response.text}")
    
    def get_headers(self) -> dict:
        """Get authorization headers."""
        if not self.token:
            raise Exception("Not authenticated. Call login() first.")
        return {"Authorization": f"Bearer {self.token}"}
    
    async def get(self, url: str, **kwargs):
        """Make authenticated GET request."""
        headers = kwargs.pop("headers", {})
        headers.update(self.get_headers())
        return await self.client.get(url, headers=headers, **kwargs)
    
    async def post(self, url: str, **kwargs):
        """Make authenticated POST request."""
        headers = kwargs.pop("headers", {})
        headers.update(self.get_headers())
        return await self.client.post(url, headers=headers, **kwargs)
    
    async def put(self, url: str, **kwargs):
        """Make authenticated PUT request."""
        headers = kwargs.pop("headers", {})
        headers.update(self.get_headers())
        return await self.client.put(url, headers=headers, **kwargs)
    
    async def delete(self, url: str, **kwargs):
        """Make authenticated DELETE request."""
        headers = kwargs.pop("headers", {})
        headers.update(self.get_headers())
        return await self.client.delete(url, headers=headers, **kwargs)


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> TestClient:
    """Create an authenticated test client."""
    return TestClient(client)