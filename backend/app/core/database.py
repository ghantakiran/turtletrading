"""
Database configuration with async SQLAlchemy support
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import MetaData
import logging

from .config import settings

logger = logging.getLogger(__name__)

# Create async engine
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Naming convention for constraints
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

# Base class for models with custom metadata
metadata = MetaData(naming_convention=naming_convention)
Base = declarative_base(metadata=metadata)


async def get_db() -> AsyncSession:
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_database():
    """Initialize database tables"""
    try:
        # Import all models to ensure they are registered
        import app.models.database_models  # noqa
        
        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            
        logger.info("✅ Database tables created successfully")
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise


async def check_database_health() -> dict:
    """Check database connectivity and health"""
    try:
        async with AsyncSessionLocal() as session:
            # Simple query to check connectivity
            from sqlalchemy import text
            result = await session.execute(text("SELECT 1"))
            result.fetchone()
            
        return {
            "status": "healthy",
            "database": "postgresql",
            "connection": "active"
        }
        
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": "postgresql", 
            "connection": "failed",
            "error": str(e)
        }


async def close_database():
    """Close database connections"""
    await engine.dispose()
    logger.info("Database connections closed")