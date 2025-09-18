"""Initial database schema for TurtleTrading platform

Revision ID: 0001_initial_schema
Revises:
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # Users table
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('is_verified', sa.Boolean(), default=False, nullable=False),
        sa.Column('subscription_tier', sa.String(50), default='free', nullable=False),
        sa.Column('api_calls_today', sa.Integer(), default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )

    # Create indexes for users
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_username', 'users', ['username'])
    op.create_index('idx_users_subscription_tier', 'users', ['subscription_tier'])

    # Stocks table
    op.create_table('stocks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('symbol', sa.String(10), nullable=False),
        sa.Column('company_name', sa.String(255), nullable=False),
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('market_cap', sa.BigInteger(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('stock_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('symbol')
    )

    # Create indexes for stocks
    op.create_index('idx_stocks_symbol', 'stocks', ['symbol'])
    op.create_index('idx_stocks_sector', 'stocks', ['sector'])
    op.create_index('idx_stocks_industry', 'stocks', ['industry'])

    # Price history table
    op.create_table('price_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('stock_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('open_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('high_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('low_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('close_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('volume', sa.BigInteger(), nullable=False),
        sa.Column('adjusted_close', sa.Numeric(10, 2), nullable=True),
        sa.Column('data_source', sa.String(50), default='yfinance', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['stock_id'], ['stocks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stock_id', 'date', name='uq_price_history_stock_date')
    )

    # Create indexes for price_history
    op.create_index('idx_price_history_stock_date', 'price_history', ['stock_id', 'date'])
    op.create_index('idx_price_history_date', 'price_history', ['date'])

    # Technical indicators table
    op.create_table('technical_indicators',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('stock_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('rsi', sa.Numeric(5, 2), nullable=True),
        sa.Column('macd_line', sa.Numeric(10, 4), nullable=True),
        sa.Column('macd_signal', sa.Numeric(10, 4), nullable=True),
        sa.Column('macd_histogram', sa.Numeric(10, 4), nullable=True),
        sa.Column('ema_20', sa.Numeric(10, 2), nullable=True),
        sa.Column('sma_50', sa.Numeric(10, 2), nullable=True),
        sa.Column('sma_200', sa.Numeric(10, 2), nullable=True),
        sa.Column('stochastic_k', sa.Numeric(5, 2), nullable=True),
        sa.Column('stochastic_d', sa.Numeric(5, 2), nullable=True),
        sa.Column('bollinger_upper', sa.Numeric(10, 2), nullable=True),
        sa.Column('bollinger_lower', sa.Numeric(10, 2), nullable=True),
        sa.Column('bollinger_position', sa.Numeric(5, 4), nullable=True),
        sa.Column('adx', sa.Numeric(5, 2), nullable=True),
        sa.Column('obv', sa.BigInteger(), nullable=True),
        sa.Column('atr', sa.Numeric(10, 4), nullable=True),
        sa.Column('williams_r', sa.Numeric(6, 2), nullable=True),
        sa.Column('cci', sa.Numeric(8, 2), nullable=True),
        sa.Column('mfi', sa.Numeric(5, 2), nullable=True),
        sa.Column('roc', sa.Numeric(8, 4), nullable=True),
        sa.Column('technical_score', sa.Numeric(5, 4), nullable=True),
        sa.Column('recommendation', sa.String(20), nullable=True),
        sa.Column('indicators_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['stock_id'], ['stocks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stock_id', 'date', name='uq_technical_indicators_stock_date')
    )

    # Create indexes for technical_indicators
    op.create_index('idx_technical_indicators_stock_date', 'technical_indicators', ['stock_id', 'date'])
    op.create_index('idx_technical_indicators_recommendation', 'technical_indicators', ['recommendation'])

    # LSTM predictions table
    op.create_table('lstm_predictions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('stock_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prediction_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('target_date', sa.Date(), nullable=False),
        sa.Column('predicted_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('confidence_lower_80', sa.Numeric(10, 2), nullable=False),
        sa.Column('confidence_upper_80', sa.Numeric(10, 2), nullable=False),
        sa.Column('confidence_lower_95', sa.Numeric(10, 2), nullable=False),
        sa.Column('confidence_upper_95', sa.Numeric(10, 2), nullable=False),
        sa.Column('model_version', sa.String(50), nullable=False),
        sa.Column('model_accuracy', sa.Numeric(5, 4), nullable=True),
        sa.Column('directional_accuracy', sa.Numeric(5, 4), nullable=True),
        sa.Column('prediction_horizon_days', sa.Integer(), nullable=False),
        sa.Column('features_used', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('prediction_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['stock_id'], ['stocks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for lstm_predictions
    op.create_index('idx_lstm_predictions_stock_target', 'lstm_predictions', ['stock_id', 'target_date'])
    op.create_index('idx_lstm_predictions_prediction_date', 'lstm_predictions', ['prediction_date'])
    op.create_index('idx_lstm_predictions_model_version', 'lstm_predictions', ['model_version'])

    # Market data table
    op.create_table('market_data',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('index_name', sa.String(50), nullable=False),
        sa.Column('value', sa.Numeric(12, 2), nullable=False),
        sa.Column('change', sa.Numeric(12, 2), nullable=True),
        sa.Column('change_percent', sa.Numeric(8, 4), nullable=True),
        sa.Column('volume', sa.BigInteger(), nullable=True),
        sa.Column('market_breadth_advance', sa.Integer(), nullable=True),
        sa.Column('market_breadth_decline', sa.Integer(), nullable=True),
        sa.Column('vix_value', sa.Numeric(6, 2), nullable=True),
        sa.Column('market_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('date', 'index_name', name='uq_market_data_date_index')
    )

    # Create indexes for market_data
    op.create_index('idx_market_data_date_index', 'market_data', ['date', 'index_name'])
    op.create_index('idx_market_data_index_name', 'market_data', ['index_name'])

    # User portfolios table
    op.create_table('portfolios',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), default=False, nullable=False),
        sa.Column('total_value', sa.Numeric(15, 2), default=0, nullable=False),
        sa.Column('portfolio_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for portfolios
    op.create_index('idx_portfolios_user_id', 'portfolios', ['user_id'])
    op.create_index('idx_portfolios_user_default', 'portfolios', ['user_id', 'is_default'])

    # Portfolio holdings table
    op.create_table('portfolio_holdings',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('portfolio_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('stock_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity', sa.Numeric(15, 6), nullable=False),
        sa.Column('average_cost', sa.Numeric(10, 2), nullable=False),
        sa.Column('current_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('market_value', sa.Numeric(15, 2), nullable=True),
        sa.Column('unrealized_gain_loss', sa.Numeric(15, 2), nullable=True),
        sa.Column('holding_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['portfolio_id'], ['portfolios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['stock_id'], ['stocks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('portfolio_id', 'stock_id', name='uq_portfolio_holdings_portfolio_stock')
    )

    # Create indexes for portfolio_holdings
    op.create_index('idx_portfolio_holdings_portfolio', 'portfolio_holdings', ['portfolio_id'])
    op.create_index('idx_portfolio_holdings_stock', 'portfolio_holdings', ['stock_id'])

    # User alerts table
    op.create_table('alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('stock_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('alert_type', sa.String(50), nullable=False),  # 'price', 'technical', 'sentiment'
        sa.Column('condition', sa.String(20), nullable=False),   # 'above', 'below', 'crosses'
        sa.Column('target_value', sa.Numeric(15, 4), nullable=False),
        sa.Column('current_value', sa.Numeric(15, 4), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('is_triggered', sa.Boolean(), default=False, nullable=False),
        sa.Column('triggered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notification_sent', sa.Boolean(), default=False, nullable=False),
        sa.Column('alert_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['stock_id'], ['stocks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for alerts
    op.create_index('idx_alerts_user_active', 'alerts', ['user_id', 'is_active'])
    op.create_index('idx_alerts_stock_active', 'alerts', ['stock_id', 'is_active'])
    op.create_index('idx_alerts_triggered', 'alerts', ['is_triggered', 'triggered_at'])

    # Sentiment data table
    op.create_table('sentiment_data',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('stock_id', postgresql.UUID(as_uuid=True), nullable=True),  # NULL for market-wide sentiment
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('sentiment_source', sa.String(50), nullable=False),  # 'news', 'social', 'combined'
        sa.Column('sentiment_score', sa.Numeric(6, 4), nullable=False),  # -1.0 to 1.0
        sa.Column('confidence_score', sa.Numeric(5, 4), nullable=True),  # 0.0 to 1.0
        sa.Column('article_count', sa.Integer(), nullable=True),
        sa.Column('positive_mentions', sa.Integer(), nullable=True),
        sa.Column('negative_mentions', sa.Integer(), nullable=True),
        sa.Column('neutral_mentions', sa.Integer(), nullable=True),
        sa.Column('trending_keywords', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('sentiment_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['stock_id'], ['stocks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for sentiment_data
    op.create_index('idx_sentiment_data_stock_date', 'sentiment_data', ['stock_id', 'date'])
    op.create_index('idx_sentiment_data_date_source', 'sentiment_data', ['date', 'sentiment_source'])
    op.create_index('idx_sentiment_data_market_wide', 'sentiment_data', ['date'],
                   postgresql_where=sa.text('stock_id IS NULL'))

    # Model performance tracking table
    op.create_table('model_performance',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('model_version', sa.String(50), nullable=False),
        sa.Column('evaluation_date', sa.Date(), nullable=False),
        sa.Column('metric_name', sa.String(50), nullable=False),  # 'mae', 'mse', 'directional_accuracy'
        sa.Column('metric_value', sa.Numeric(10, 6), nullable=False),
        sa.Column('sample_size', sa.Integer(), nullable=False),
        sa.Column('evaluation_period_start', sa.Date(), nullable=False),
        sa.Column('evaluation_period_end', sa.Date(), nullable=False),
        sa.Column('performance_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for model_performance
    op.create_index('idx_model_performance_name_version', 'model_performance', ['model_name', 'model_version'])
    op.create_index('idx_model_performance_eval_date', 'model_performance', ['evaluation_date'])
    op.create_index('idx_model_performance_metric', 'model_performance', ['metric_name', 'evaluation_date'])


def downgrade() -> None:
    # Drop tables in reverse order to handle foreign key constraints
    op.drop_table('model_performance')
    op.drop_table('sentiment_data')
    op.drop_table('alerts')
    op.drop_table('portfolio_holdings')
    op.drop_table('portfolios')
    op.drop_table('market_data')
    op.drop_table('lstm_predictions')
    op.drop_table('technical_indicators')
    op.drop_table('price_history')
    op.drop_table('stocks')
    op.drop_table('users')

    # Drop UUID extension
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp"')