"""
SQLAlchemy database models for TurtleTrading platform
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class User(Base):
    """User model for authentication and profile management"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    portfolios = relationship("Portfolio", back_populates="user")
    alerts = relationship("Alert", back_populates="user")
    
    __table_args__ = (
        Index('ix_users_email_active', 'email', 'is_active'),
    )


class Stock(Base):
    """Stock symbol metadata and information"""
    __tablename__ = "stocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    sector = Column(String(100), nullable=True)
    industry = Column(String(100), nullable=True)
    market_cap = Column(Float, nullable=True)
    currency = Column(String(3), default="USD")
    exchange = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    price_history = relationship("PriceHistory", back_populates="stock")
    technical_indicators = relationship("TechnicalIndicator", back_populates="stock")
    predictions = relationship("Prediction", back_populates="stock")
    
    __table_args__ = (
        Index('ix_stocks_symbol_active', 'symbol', 'is_active'),
        Index('ix_stocks_sector', 'sector'),
    )


class PriceHistory(Base):
    """Historical price data for stocks"""
    __tablename__ = "price_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    open_price = Column(Float, nullable=False)
    high_price = Column(Float, nullable=False)
    low_price = Column(Float, nullable=False)
    close_price = Column(Float, nullable=False)
    volume = Column(Integer, nullable=False)
    adjusted_close = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    stock = relationship("Stock", back_populates="price_history")
    
    __table_args__ = (
        Index('ix_price_history_stock_date', 'stock_id', 'date'),
        Index('ix_price_history_date', 'date'),
    )


class TechnicalIndicator(Base):
    """Technical analysis indicators for stocks"""
    __tablename__ = "technical_indicators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    indicator_type = Column(String(50), nullable=False)  # RSI, MACD, SMA, etc.
    value = Column(Float, nullable=False)
    indicator_metadata = Column(JSON, nullable=True)  # Additional indicator-specific data
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    stock = relationship("Stock", back_populates="technical_indicators")
    
    __table_args__ = (
        Index('ix_technical_indicators_stock_date', 'stock_id', 'date'),
        Index('ix_technical_indicators_type', 'indicator_type'),
    )


class Prediction(Base):
    """LSTM and AI model predictions for stock prices"""
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id"), nullable=False)
    prediction_date = Column(DateTime(timezone=True), nullable=False)
    target_date = Column(DateTime(timezone=True), nullable=False)
    predicted_price = Column(Float, nullable=False)
    confidence_interval_lower = Column(Float, nullable=True)
    confidence_interval_upper = Column(Float, nullable=True)
    model_type = Column(String(50), nullable=False)  # LSTM, RandomForest, etc.
    model_version = Column(String(20), nullable=False)
    accuracy_score = Column(Float, nullable=True)
    prediction_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    stock = relationship("Stock", back_populates="predictions")
    
    __table_args__ = (
        Index('ix_predictions_stock_target', 'stock_id', 'target_date'),
        Index('ix_predictions_model', 'model_type', 'model_version'),
    )


class MarketData(Base):
    """Market indices and overall market data"""
    __tablename__ = "market_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), nullable=False)  # SPY, QQQ, VIX, etc.
    date = Column(DateTime(timezone=True), nullable=False)
    value = Column(Float, nullable=False)
    change = Column(Float, nullable=True)
    change_percent = Column(Float, nullable=True)
    volume = Column(Integer, nullable=True)
    market_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('ix_market_data_symbol_date', 'symbol', 'date'),
    )


class Portfolio(Base):
    """User portfolio tracking"""
    __tablename__ = "portfolios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    total_value = Column(Float, default=0.0)
    cash_balance = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="portfolios")
    holdings = relationship("PortfolioHolding", back_populates="portfolio")


class PortfolioHolding(Base):
    """Individual stock holdings in portfolios"""
    __tablename__ = "portfolio_holdings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id"), nullable=False)
    symbol = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False)
    average_cost = Column(Float, nullable=False)
    current_price = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="holdings")
    
    __table_args__ = (
        Index('ix_portfolio_holdings_portfolio_symbol', 'portfolio_id', 'symbol'),
    )


class Alert(Base):
    """User-defined price and indicator alerts"""
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    symbol = Column(String(20), nullable=False)
    alert_type = Column(String(50), nullable=False)  # price, rsi, volume, etc.
    condition = Column(String(20), nullable=False)  # above, below, crosses
    threshold_value = Column(Float, nullable=False)
    current_value = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    is_triggered = Column(Boolean, default=False)
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="alerts")
    
    __table_args__ = (
        Index('ix_alerts_user_active', 'user_id', 'is_active'),
        Index('ix_alerts_symbol_active', 'symbol', 'is_active'),
    )


class SentimentData(Base):
    """Sentiment analysis data from news and social media"""
    __tablename__ = "sentiment_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    source = Column(String(50), nullable=False)  # news, twitter, reddit, etc.
    sentiment_score = Column(Float, nullable=False)  # -1 to 1
    confidence = Column(Float, nullable=True)
    article_count = Column(Integer, default=1)
    headline = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    sentiment_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('ix_sentiment_data_symbol_date', 'symbol', 'date'),
        Index('ix_sentiment_data_source', 'source'),
    )


class ModelPerformance(Base):
    """Track AI model performance and metrics"""
    __tablename__ = "model_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_type = Column(String(50), nullable=False)
    model_version = Column(String(20), nullable=False)
    symbol = Column(String(20), nullable=True)
    evaluation_date = Column(DateTime(timezone=True), nullable=False)
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    mae = Column(Float, nullable=True)  # Mean Absolute Error
    rmse = Column(Float, nullable=True)  # Root Mean Square Error
    directional_accuracy = Column(Float, nullable=True)
    performance_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('ix_model_performance_model', 'model_type', 'model_version'),
        Index('ix_model_performance_date', 'evaluation_date'),
    )