-- TurtleTrading Database Schema
-- Per module specifications: Claude.StockAnalysis.md, Claude.MarketData.md, Claude.Authentication.md
-- Supports PostgreSQL with proper indexing and constraints

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Users and Authentication (Claude.Authentication.md)
-- ============================================================================

-- Users table for authentication and authorization
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER NOT NULL DEFAULT 0,

    -- Performance indexes
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for authentication performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_users_created_at ON users(created_at);

-- User sessions for tracking active sessions
CREATE TABLE user_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- Stock Data and Market Information (Claude.StockAnalysis.md)
-- ============================================================================

-- Stock symbols and metadata
CREATE TABLE stocks (
    symbol VARCHAR(20) PRIMARY KEY,
    company_name VARCHAR(255),
    sector VARCHAR(100),
    industry VARCHAR(100),
    market_cap BIGINT,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    exchange VARCHAR(50),
    country VARCHAR(50) NOT NULL DEFAULT 'US',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stocks_sector ON stocks(sector);
CREATE INDEX idx_stocks_industry ON stocks(industry);
CREATE INDEX idx_stocks_exchange ON stocks(exchange);
CREATE INDEX idx_stocks_active ON stocks(is_active) WHERE is_active = TRUE;

-- Historical price data
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    date DATE NOT NULL,
    open_price DECIMAL(12,4) NOT NULL CHECK (open_price > 0),
    high_price DECIMAL(12,4) NOT NULL CHECK (high_price > 0),
    low_price DECIMAL(12,4) NOT NULL CHECK (low_price > 0),
    close_price DECIMAL(12,4) NOT NULL CHECK (close_price > 0),
    volume BIGINT NOT NULL CHECK (volume >= 0),
    adjusted_close DECIMAL(12,4),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure high >= low and open, close between high and low
    CONSTRAINT price_consistency CHECK (
        high_price >= low_price AND
        high_price >= open_price AND
        high_price >= close_price AND
        low_price <= open_price AND
        low_price <= close_price
    ),

    -- Unique constraint for symbol and date
    UNIQUE(symbol, date)
);

-- Critical indexes for price queries
CREATE INDEX idx_price_history_symbol_date ON price_history(symbol, date DESC);
CREATE INDEX idx_price_history_date ON price_history(date DESC);
CREATE INDEX idx_price_history_volume ON price_history(volume);

-- Technical indicators storage
CREATE TABLE technical_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    date DATE NOT NULL,
    period VARCHAR(10) NOT NULL DEFAULT '1y',

    -- Core technical indicators per Claude.StockAnalysis.md
    rsi DECIMAL(5,2) CHECK (rsi >= 0 AND rsi <= 100),
    macd_line DECIMAL(8,4),
    macd_signal DECIMAL(8,4),
    macd_histogram DECIMAL(8,4),

    -- Bollinger Bands
    bb_upper DECIMAL(12,4),
    bb_middle DECIMAL(12,4),
    bb_lower DECIMAL(12,4),
    bb_position DECIMAL(6,3),

    -- Additional indicators
    adx DECIMAL(5,2) CHECK (adx >= 0 AND adx <= 100),
    obv DECIMAL(15,2),
    stoch_k DECIMAL(5,2) CHECK (stoch_k >= 0 AND stoch_k <= 100),
    stoch_d DECIMAL(5,2) CHECK (stoch_d >= 0 AND stoch_d <= 100),
    atr DECIMAL(8,4) CHECK (atr >= 0),

    -- Moving averages
    ema_20 DECIMAL(12,4),
    sma_50 DECIMAL(12,4),
    sma_200 DECIMAL(12,4),

    -- Weighted technical score (0-1)
    technical_score DECIMAL(6,3) CHECK (technical_score >= 0 AND technical_score <= 1),
    recommendation VARCHAR(10) CHECK (recommendation IN ('BUY', 'SELL', 'HOLD')),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symbol, date, period)
);

CREATE INDEX idx_technical_indicators_symbol_date ON technical_indicators(symbol, date DESC);
CREATE INDEX idx_technical_indicators_score ON technical_indicators(technical_score);
CREATE INDEX idx_technical_indicators_recommendation ON technical_indicators(recommendation);

-- LSTM predictions storage
CREATE TABLE lstm_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,
    horizon_days INTEGER NOT NULL CHECK (horizon_days > 0 AND horizon_days <= 30),

    -- Prediction data as JSON for flexibility
    predictions JSONB NOT NULL,
    confidence_intervals JSONB NOT NULL,

    -- Model performance metrics
    model_accuracy DECIMAL(6,3) CHECK (model_accuracy >= 0 AND model_accuracy <= 1),
    directional_accuracy DECIMAL(6,3) CHECK (directional_accuracy >= 0 AND directional_accuracy <= 1),

    -- Model metadata
    model_version VARCHAR(50),
    training_date DATE,
    feature_count INTEGER,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symbol, prediction_date, horizon_days)
);

CREATE INDEX idx_lstm_predictions_symbol_date ON lstm_predictions(symbol, prediction_date DESC);
CREATE INDEX idx_lstm_predictions_horizon ON lstm_predictions(horizon_days);
CREATE INDEX idx_lstm_predictions_accuracy ON lstm_predictions(model_accuracy);

-- Analysis results (multi-factor analysis)
CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    period VARCHAR(10) NOT NULL DEFAULT '1y',

    -- Component scores per Claude.StockAnalysis.md (50% LSTM + 30% technical + 10% sentiment + 10% seasonality)
    technical_score DECIMAL(6,3) CHECK (technical_score >= 0 AND technical_score <= 1),
    lstm_score DECIMAL(6,3) CHECK (lstm_score >= 0 AND lstm_score <= 1),
    sentiment_score DECIMAL(6,3) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    seasonality_score DECIMAL(6,3) CHECK (seasonality_score >= 0 AND seasonality_score <= 2),

    -- Final weighted score and recommendation
    final_score DECIMAL(6,3) CHECK (final_score >= 0 AND final_score <= 1),
    recommendation VARCHAR(10) CHECK (recommendation IN ('BUY', 'SELL', 'HOLD')),
    confidence DECIMAL(6,3) CHECK (confidence >= 0 AND confidence <= 1),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symbol, analysis_date, period)
);

CREATE INDEX idx_analysis_results_symbol_date ON analysis_results(symbol, analysis_date DESC);
CREATE INDEX idx_analysis_results_final_score ON analysis_results(final_score);
CREATE INDEX idx_analysis_results_recommendation ON analysis_results(recommendation);

-- ============================================================================
-- Market Data and Sentiment (Claude.MarketData.md)
-- ============================================================================

-- Market indices tracking
CREATE TABLE market_indices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL, -- SPY, QQQ, DIA, IWM, VIX
    index_name VARCHAR(100) NOT NULL,
    current_value DECIMAL(12,4) NOT NULL CHECK (current_value > 0),
    change_percent DECIMAL(6,3) NOT NULL,
    volume BIGINT CHECK (volume >= 0),
    market_cap BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symbol, timestamp::date)
);

CREATE INDEX idx_market_indices_symbol_timestamp ON market_indices(symbol, timestamp DESC);
CREATE INDEX idx_market_indices_timestamp ON market_indices(timestamp DESC);

-- Market breadth analysis
CREATE TABLE market_breadth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,

    -- Breadth metrics per Claude.MarketData.md
    advancing INTEGER NOT NULL CHECK (advancing >= 0),
    declining INTEGER NOT NULL CHECK (declining >= 0),
    unchanged INTEGER NOT NULL CHECK (unchanged >= 0),
    ratio DECIMAL(8,3) CHECK (ratio >= 0), -- advancing/declining ratio
    new_highs INTEGER NOT NULL CHECK (new_highs >= 0),
    new_lows INTEGER NOT NULL CHECK (new_lows >= 0),

    -- Total market participation
    total_issues INTEGER GENERATED ALWAYS AS (advancing + declining + unchanged) STORED,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(date)
);

CREATE INDEX idx_market_breadth_date ON market_breadth(date DESC);
CREATE INDEX idx_market_breadth_ratio ON market_breadth(ratio);

-- Sentiment data storage
CREATE TABLE sentiment_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Sentiment scores per Claude.MarketData.md (-100 to +100)
    overall_score DECIMAL(6,2) CHECK (overall_score >= -100 AND overall_score <= 100),
    news_sentiment DECIMAL(6,2) CHECK (news_sentiment >= -100 AND news_sentiment <= 100),
    social_sentiment DECIMAL(6,2) CHECK (social_sentiment >= -100 AND social_sentiment <= 100),

    -- Confidence and metadata
    confidence DECIMAL(4,3) CHECK (confidence >= 0 AND confidence <= 1),
    trending_keywords JSONB,
    source_count INTEGER CHECK (source_count > 0),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symbol, date)
);

CREATE INDEX idx_sentiment_data_symbol_date ON sentiment_data(symbol, date DESC);
CREATE INDEX idx_sentiment_data_overall_score ON sentiment_data(overall_score);
CREATE INDEX idx_sentiment_data_date ON sentiment_data(date DESC);

-- Market overview snapshots
CREATE TABLE market_overview (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Market status per Claude.MarketData.md
    market_status VARCHAR(20) NOT NULL CHECK (market_status IN ('OPEN', 'CLOSED', 'PRE_MARKET', 'AFTER_HOURS')),

    -- Aggregated sentiment
    overall_sentiment DECIMAL(6,2) CHECK (overall_sentiment >= -100 AND overall_sentiment <= 100),

    -- Market indices snapshot (JSON for flexibility)
    indices_data JSONB NOT NULL,
    breadth_data JSONB,

    UNIQUE(timestamp::date)
);

CREATE INDEX idx_market_overview_timestamp ON market_overview(timestamp DESC);
CREATE INDEX idx_market_overview_status ON market_overview(market_status);

-- ============================================================================
-- User Portfolios and Watchlists
-- ============================================================================

-- User portfolios
CREATE TABLE portfolios (
    portfolio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, name)
);

CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_portfolios_default ON portfolios(user_id, is_default) WHERE is_default = TRUE;

-- Portfolio holdings
CREATE TABLE portfolio_holdings (
    holding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    quantity DECIMAL(15,6) NOT NULL CHECK (quantity > 0),
    average_cost DECIMAL(12,4) NOT NULL CHECK (average_cost > 0),
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(portfolio_id, symbol)
);

CREATE INDEX idx_portfolio_holdings_portfolio_id ON portfolio_holdings(portfolio_id);
CREATE INDEX idx_portfolio_holdings_symbol ON portfolio_holdings(symbol);

-- User alerts
CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('price_above', 'price_below', 'volume_spike', 'rsi_oversold', 'rsi_overbought', 'macd_bullish', 'macd_bearish')),

    -- Alert parameters
    threshold_value DECIMAL(12,4),
    comparison_operator VARCHAR(10) CHECK (comparison_operator IN ('>', '<', '>=', '<=', '=')),

    -- Alert status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    triggered_at TIMESTAMP WITH TIME ZONE,

    -- Notification preferences
    notify_email BOOLEAN NOT NULL DEFAULT TRUE,
    notify_push BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_symbol ON alerts(symbol);
CREATE INDEX idx_alerts_active ON alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_alerts_type ON alerts(alert_type);

-- ============================================================================
-- WebSocket Connections and Subscriptions (Claude.MarketData.md)
-- ============================================================================

-- WebSocket connections tracking
CREATE TABLE websocket_connections (
    connection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL UNIQUE,
    connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_ping TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_websocket_connections_user_id ON websocket_connections(user_id);
CREATE INDEX idx_websocket_connections_client_id ON websocket_connections(client_id);
CREATE INDEX idx_websocket_connections_active ON websocket_connections(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_websocket_connections_last_ping ON websocket_connections(last_ping);

-- WebSocket subscriptions
CREATE TABLE websocket_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES websocket_connections(connection_id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    data_types JSONB NOT NULL, -- ['price', 'volume', 'technical', 'sentiment']
    subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(connection_id, symbol)
);

CREATE INDEX idx_websocket_subscriptions_connection_id ON websocket_subscriptions(connection_id);
CREATE INDEX idx_websocket_subscriptions_symbol ON websocket_subscriptions(symbol);

-- ============================================================================
-- Model Performance and Metrics
-- ============================================================================

-- Model performance tracking
CREATE TABLE model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE CASCADE,

    -- Performance metrics
    accuracy DECIMAL(6,3) CHECK (accuracy >= 0 AND accuracy <= 1),
    precision_score DECIMAL(6,3) CHECK (precision_score >= 0 AND precision_score <= 1),
    recall DECIMAL(6,3) CHECK (recall >= 0 AND recall <= 1),
    f1_score DECIMAL(6,3) CHECK (f1_score >= 0 AND f1_score <= 1),

    -- Trading-specific metrics
    directional_accuracy DECIMAL(6,3) CHECK (directional_accuracy >= 0 AND directional_accuracy <= 1),
    sharpe_ratio DECIMAL(8,4),
    max_drawdown DECIMAL(6,3),

    -- Evaluation period
    evaluation_start DATE NOT NULL,
    evaluation_end DATE NOT NULL,
    sample_size INTEGER CHECK (sample_size > 0),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_evaluation_period CHECK (evaluation_end >= evaluation_start)
);

CREATE INDEX idx_model_performance_model ON model_performance(model_name, model_version);
CREATE INDEX idx_model_performance_symbol ON model_performance(symbol);
CREATE INDEX idx_model_performance_accuracy ON model_performance(accuracy);

-- ============================================================================
-- Audit and Logging
-- ============================================================================

-- API request logs for rate limiting and analytics
CREATE TABLE api_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Partitioning by month for performance
    PARTITION BY RANGE (request_timestamp)
);

CREATE INDEX idx_api_requests_user_id_timestamp ON api_requests(user_id, request_timestamp DESC);
CREATE INDEX idx_api_requests_endpoint ON api_requests(endpoint);
CREATE INDEX idx_api_requests_timestamp ON api_requests(request_timestamp DESC);

-- ============================================================================
-- Triggers for updated_at timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stocks_updated_at BEFORE UPDATE ON stocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolio_holdings_updated_at BEFORE UPDATE ON portfolio_holdings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for common queries
-- ============================================================================

-- Latest stock prices view
CREATE VIEW latest_stock_prices AS
SELECT DISTINCT ON (symbol)
    symbol,
    close_price as current_price,
    volume,
    date as price_date,
    (close_price - LAG(close_price) OVER (PARTITION BY symbol ORDER BY date)) / LAG(close_price) OVER (PARTITION BY symbol ORDER BY date) * 100 as change_percent
FROM price_history
ORDER BY symbol, date DESC;

-- Market overview summary view
CREATE VIEW market_summary AS
SELECT
    date,
    COUNT(CASE WHEN change_percent > 0 THEN 1 END) as advancing,
    COUNT(CASE WHEN change_percent < 0 THEN 1 END) as declining,
    COUNT(CASE WHEN change_percent = 0 THEN 1 END) as unchanged,
    AVG(change_percent) as avg_change,
    STDDEV(change_percent) as volatility
FROM (
    SELECT
        symbol,
        date,
        (close_price - LAG(close_price) OVER (PARTITION BY symbol ORDER BY date)) / LAG(close_price) OVER (PARTITION BY symbol ORDER BY date) * 100 as change_percent
    FROM price_history
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
) daily_changes
GROUP BY date
ORDER BY date DESC;

-- User portfolio performance view
CREATE VIEW portfolio_performance AS
SELECT
    p.portfolio_id,
    p.name as portfolio_name,
    p.user_id,
    COUNT(ph.holding_id) as holdings_count,
    SUM(ph.quantity * ph.average_cost) as total_cost,
    SUM(ph.quantity * COALESCE(lsp.current_price, ph.average_cost)) as current_value,
    (SUM(ph.quantity * COALESCE(lsp.current_price, ph.average_cost)) - SUM(ph.quantity * ph.average_cost)) / SUM(ph.quantity * ph.average_cost) * 100 as return_percent
FROM portfolios p
LEFT JOIN portfolio_holdings ph ON p.portfolio_id = ph.portfolio_id
LEFT JOIN latest_stock_prices lsp ON ph.symbol = lsp.symbol
GROUP BY p.portfolio_id, p.name, p.user_id;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts and authentication data per Claude.Authentication.md';
COMMENT ON TABLE stocks IS 'Stock symbols and metadata for all tracked securities';
COMMENT ON TABLE price_history IS 'Historical OHLCV price data for technical analysis';
COMMENT ON TABLE technical_indicators IS 'Calculated technical indicators per Claude.StockAnalysis.md (15+ indicators)';
COMMENT ON TABLE lstm_predictions IS 'LSTM model predictions with confidence intervals per Claude.StockAnalysis.md';
COMMENT ON TABLE analysis_results IS 'Multi-factor analysis results (50% LSTM + 30% technical + 10% sentiment + 10% seasonality)';
COMMENT ON TABLE sentiment_data IS 'Sentiment analysis data per Claude.MarketData.md';
COMMENT ON TABLE market_breadth IS 'Market breadth analysis per Claude.MarketData.md';
COMMENT ON TABLE websocket_connections IS 'WebSocket connection tracking per Claude.MarketData.md';
COMMENT ON TABLE model_performance IS 'LSTM and other model performance metrics';