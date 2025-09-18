-- TurtleTrading Database Initialization
-- This script sets up the initial database schema

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_expires TIMESTAMP WITH TIME ZONE
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Stock watchlists
CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist items
CREATE TABLE IF NOT EXISTS watchlist_items (
    id SERIAL PRIMARY KEY,
    watchlist_id INTEGER REFERENCES watchlists(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(watchlist_id, symbol)
);

-- Stock analysis cache
CREATE TABLE IF NOT EXISTS stock_analysis_cache (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    analysis_type VARCHAR(50) NOT NULL, -- 'technical', 'lstm', 'sentiment'
    timeframe VARCHAR(20) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(symbol, analysis_type, timeframe)
);

-- Market data cache
CREATE TABLE IF NOT EXISTS market_data_cache (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL, -- 'indices', 'movers', 'sentiment'
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(data_type)
);

-- News articles
CREATE TABLE IF NOT EXISTS news_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    content TEXT,
    url VARCHAR(1000) UNIQUE NOT NULL,
    source VARCHAR(255) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sentiment_score FLOAT DEFAULT 0,
    sentiment_polarity VARCHAR(20) DEFAULT 'neutral',
    relevance_score FLOAT DEFAULT 0,
    symbols TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User alerts
CREATE TABLE IF NOT EXISTS user_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'price', 'sentiment', 'technical'
    symbol VARCHAR(20) NOT NULL,
    condition_type VARCHAR(50) NOT NULL, -- 'above', 'below', 'crosses'
    threshold_value FLOAT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_triggered BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- LSTM model predictions history
CREATE TABLE IF NOT EXISTS lstm_predictions (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    prediction_date DATE NOT NULL,
    predicted_price FLOAT NOT NULL,
    actual_price FLOAT,
    confidence_score FLOAT,
    model_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, prediction_date, model_version)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_symbol ON watchlist_items(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_analysis_symbol ON stock_analysis_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_analysis_expires_at ON stock_analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_market_data_expires_at ON market_data_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_news_articles_symbols ON news_articles USING GIN(symbols);
CREATE INDEX IF NOT EXISTS idx_news_articles_sentiment ON news_articles(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_symbol ON user_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_user_alerts_is_active ON user_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_lstm_predictions_symbol ON lstm_predictions(symbol);
CREATE INDEX IF NOT EXISTS idx_lstm_predictions_date ON lstm_predictions(prediction_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables that need it
CREATE TRIGGER update_watchlists_updated_at BEFORE UPDATE ON watchlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_alerts_updated_at BEFORE UPDATE ON user_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM stock_analysis_cache WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM market_data_cache WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Insert default admin user (password: admin123)
INSERT INTO users (email, hashed_password, full_name, role, subscription_tier)
VALUES (
    'admin@turtletrading.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6XVkb5JHzy', -- bcrypt hash of 'admin123'
    'System Administrator',
    'admin',
    'premium'
) ON CONFLICT (email) DO NOTHING;

-- Insert test user (password: user123)
INSERT INTO users (email, hashed_password, full_name, role, subscription_tier)
VALUES (
    'user@turtletrading.com',
    '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash of 'user123'
    'Test User',
    'user',
    'free'
) ON CONFLICT (email) DO NOTHING;

-- Create default watchlist for test user
INSERT INTO watchlists (user_id, name, description, is_default)
SELECT id, 'My Watchlist', 'Default watchlist', true
FROM users WHERE email = 'user@turtletrading.com'
ON CONFLICT DO NOTHING;

-- Add some default stocks to watchlist
INSERT INTO watchlist_items (watchlist_id, symbol)
SELECT w.id, unnest(ARRAY['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'])
FROM watchlists w
JOIN users u ON w.user_id = u.id
WHERE u.email = 'user@turtletrading.com'
ON CONFLICT (watchlist_id, symbol) DO NOTHING;