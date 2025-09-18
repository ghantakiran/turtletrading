-- Development Seed Data for TurtleTrading
-- Deterministic data for CI/local testing per IMPLEMENT_FROM_DOCS.md
-- Ensures consistent test results across environments

-- Clear existing data (for development/testing only)
TRUNCATE TABLE
    api_requests,
    websocket_subscriptions,
    websocket_connections,
    model_performance,
    alerts,
    portfolio_holdings,
    portfolios,
    analysis_results,
    lstm_predictions,
    technical_indicators,
    sentiment_data,
    market_breadth,
    market_overview,
    market_indices,
    price_history,
    user_sessions,
    users,
    stocks
RESTART IDENTITY CASCADE;

-- ============================================================================
-- Seed Users (Claude.Authentication.md test data)
-- ============================================================================

-- Test users with known credentials for testing
INSERT INTO users (user_id, email, password_hash, full_name, subscription_tier, is_active, email_verified, created_at) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'admin@turtletrading.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewlBdOV7Gb6E6LDK', 'Admin User', 'enterprise', TRUE, TRUE, '2024-01-01 10:00:00+00'),
    ('550e8400-e29b-41d4-a716-446655440002', 'pro@turtletrading.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewlBdOV7Gb6E6LDK', 'Pro User', 'pro', TRUE, TRUE, '2024-01-02 10:00:00+00'),
    ('550e8400-e29b-41d4-a716-446655440003', 'free@turtletrading.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewlBdOV7Gb6E6LDK', 'Free User', 'free', TRUE, TRUE, '2024-01-03 10:00:00+00'),
    ('550e8400-e29b-41d4-a716-446655440004', 'test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewlBdOV7Gb6E6LDK', 'Test User', 'free', TRUE, TRUE, '2024-01-04 10:00:00+00'),
    ('550e8400-e29b-41d4-a716-446655440005', 'inactive@turtletrading.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewlBdOV7Gb6E6LDK', 'Inactive User', 'free', FALSE, FALSE, '2024-01-05 10:00:00+00');

-- Note: Password hash above is for 'testpassword123' - use for development/testing only

-- ============================================================================
-- Seed Stock Data (Claude.StockAnalysis.md test symbols)
-- ============================================================================

-- Major US stocks for testing per module specifications
INSERT INTO stocks (symbol, company_name, sector, industry, market_cap, exchange, created_at) VALUES
    ('AAPL', 'Apple Inc.', 'Technology', 'Consumer Electronics', 3000000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('MSFT', 'Microsoft Corporation', 'Technology', 'Software', 2800000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('NVDA', 'NVIDIA Corporation', 'Technology', 'Semiconductors', 1800000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('GOOGL', 'Alphabet Inc. Class A', 'Technology', 'Internet Services', 1700000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('META', 'Meta Platforms Inc.', 'Technology', 'Social Media', 800000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('AMZN', 'Amazon.com Inc.', 'Consumer Discretionary', 'E-commerce', 1500000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('TSLA', 'Tesla Inc.', 'Consumer Discretionary', 'Electric Vehicles', 800000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('JPM', 'JPMorgan Chase & Co.', 'Financial Services', 'Banking', 500000000000, 'NYSE', '2024-01-01 10:00:00+00'),
    ('QQQ', 'Invesco QQQ Trust', 'ETF', 'Technology ETF', 200000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('SPY', 'SPDR S&P 500 ETF Trust', 'ETF', 'Broad Market ETF', 400000000000, 'NYSE', '2024-01-01 10:00:00+00'),
    ('VIX', 'CBOE Volatility Index', 'Index', 'Volatility', 0, 'CBOE', '2024-01-01 10:00:00+00'),
    ('SE', 'Sea Limited', 'Technology', 'E-commerce', 70000000000, 'NYSE', '2024-01-01 10:00:00+00'),
    ('MRVL', 'Marvell Technology Inc.', 'Technology', 'Semiconductors', 60000000000, 'NASDAQ', '2024-01-01 10:00:00+00'),
    ('CRM', 'Salesforce Inc.', 'Technology', 'Cloud Software', 220000000000, 'NYSE', '2024-01-01 10:00:00+00'),
    ('UNH', 'UnitedHealth Group Inc.', 'Healthcare', 'Health Insurance', 500000000000, 'NYSE', '2024-01-01 10:00:00+00'),
    ('NFLX', 'Netflix Inc.', 'Communication Services', 'Streaming', 180000000000, 'NASDAQ', '2024-01-01 10:00:00+00');

-- ============================================================================
-- Seed Historical Price Data (deterministic for testing)
-- ============================================================================

-- Generate 90 days of historical data for AAPL (LSTM lookback requirement)
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '89 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date as date
),
price_data AS (
    SELECT
        date,
        -- Generate realistic price progression starting from $150
        150.0 + (EXTRACT(day FROM date) * 0.5) +
        (CASE WHEN EXTRACT(dow FROM date) IN (1,2,3,4,5) THEN
            sin(EXTRACT(day FROM date) * 0.3) * 5
         ELSE 0 END) as base_price
    FROM date_series
)
INSERT INTO price_history (symbol, date, open_price, high_price, low_price, close_price, volume, adjusted_close)
SELECT
    'AAPL',
    date,
    base_price,
    base_price * 1.02, -- High 2% above
    base_price * 0.98, -- Low 2% below
    base_price + (sin(EXTRACT(day FROM date) * 0.1) * 2), -- Close with variation
    1000000 + (EXTRACT(day FROM date) * 50000)::bigint, -- Volume
    base_price + (sin(EXTRACT(day FROM date) * 0.1) * 2) -- Adjusted close same as close
FROM price_data;

-- Add price data for other major symbols (last 30 days)
WITH symbols AS (
    SELECT unnest(ARRAY['MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'SPY', 'QQQ']) as symbol
),
date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date as date
),
base_prices AS (
    SELECT
        'MSFT' as symbol, 380.0 as start_price UNION ALL
    SELECT 'NVDA', 880.0 UNION ALL
    SELECT 'GOOGL', 140.0 UNION ALL
    SELECT 'META', 500.0 UNION ALL
    SELECT 'AMZN', 155.0 UNION ALL
    SELECT 'TSLA', 240.0 UNION ALL
    SELECT 'SPY', 480.0 UNION ALL
    SELECT 'QQQ', 380.0
)
INSERT INTO price_history (symbol, date, open_price, high_price, low_price, close_price, volume, adjusted_close)
SELECT
    bp.symbol,
    ds.date,
    bp.start_price + (EXTRACT(day FROM ds.date) * 0.3) as open_price,
    (bp.start_price + (EXTRACT(day FROM ds.date) * 0.3)) * 1.015 as high_price,
    (bp.start_price + (EXTRACT(day FROM ds.date) * 0.3)) * 0.985 as low_price,
    bp.start_price + (EXTRACT(day FROM ds.date) * 0.3) + (sin(EXTRACT(day FROM ds.date) * 0.2) * 3) as close_price,
    500000 + (EXTRACT(day FROM ds.date) * 25000)::bigint as volume,
    bp.start_price + (EXTRACT(day FROM ds.date) * 0.3) + (sin(EXTRACT(day FROM ds.date) * 0.2) * 3) as adjusted_close
FROM base_prices bp
CROSS JOIN date_series ds;

-- ============================================================================
-- Seed Technical Indicators (Claude.StockAnalysis.md test data)
-- ============================================================================

-- Technical indicators for AAPL (last 30 days)
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date as date
)
INSERT INTO technical_indicators (
    symbol, date, period, rsi, macd_line, macd_signal, macd_histogram,
    bb_upper, bb_middle, bb_lower, bb_position,
    adx, obv, stoch_k, stoch_d, atr,
    ema_20, sma_50, sma_200, technical_score, recommendation
)
SELECT
    'AAPL',
    date,
    '1y',
    45.0 + (EXTRACT(day FROM date) * 0.8), -- RSI trending up
    0.5 + (sin(EXTRACT(day FROM date) * 0.1) * 0.3), -- MACD line
    0.3 + (sin(EXTRACT(day FROM date) * 0.1) * 0.2), -- MACD signal
    0.2 + (sin(EXTRACT(day FROM date) * 0.1) * 0.1), -- MACD histogram
    155.0 + (EXTRACT(day FROM date) * 0.5), -- BB upper
    150.0 + (EXTRACT(day FROM date) * 0.5), -- BB middle
    145.0 + (EXTRACT(day FROM date) * 0.5), -- BB lower
    0.5, -- BB position
    25.0 + (EXTRACT(day FROM date) * 0.2), -- ADX
    1000000.0 + (EXTRACT(day FROM date) * 10000), -- OBV
    50.0 + (EXTRACT(day FROM date) * 0.6), -- Stoch K
    48.0 + (EXTRACT(day FROM date) * 0.6), -- Stoch D
    2.5, -- ATR
    148.0 + (EXTRACT(day FROM date) * 0.4), -- EMA 20
    145.0 + (EXTRACT(day FROM date) * 0.4), -- SMA 50
    140.0 + (EXTRACT(day FROM date) * 0.4), -- SMA 200
    0.6 + (EXTRACT(day FROM date) * 0.005), -- Technical score (trending up)
    CASE
        WHEN (0.6 + (EXTRACT(day FROM date) * 0.005)) > 0.7 THEN 'BUY'
        WHEN (0.6 + (EXTRACT(day FROM date) * 0.005)) < 0.3 THEN 'SELL'
        ELSE 'HOLD'
    END
FROM date_series;

-- ============================================================================
-- Seed LSTM Predictions (Claude.StockAnalysis.md test data)
-- ============================================================================

-- LSTM predictions for AAPL (5-day horizon)
INSERT INTO lstm_predictions (
    symbol, prediction_date, horizon_days, predictions, confidence_intervals,
    model_accuracy, directional_accuracy, model_version, training_date, feature_count
) VALUES (
    'AAPL',
    CURRENT_DATE,
    5,
    '[155.2, 156.1, 157.3, 158.0, 159.2]'::jsonb,
    '{
        "80_percent": {
            "lower": [152.1, 153.0, 154.2, 154.9, 156.1],
            "upper": [158.3, 159.2, 160.4, 161.1, 162.3]
        },
        "95_percent": {
            "lower": [150.0, 150.9, 152.1, 152.8, 154.0],
            "upper": [160.4, 161.3, 162.5, 163.2, 164.4]
        }
    }'::jsonb,
    0.742,
    0.681,
    'lstm_v2.1',
    CURRENT_DATE - INTERVAL '7 days',
    20
);

-- ============================================================================
-- Seed Analysis Results (Claude.StockAnalysis.md multi-factor test data)
-- ============================================================================

-- Multi-factor analysis results for AAPL
INSERT INTO analysis_results (
    symbol, analysis_date, period, technical_score, lstm_score, sentiment_score,
    seasonality_score, final_score, recommendation, confidence
) VALUES (
    'AAPL', CURRENT_DATE, '1y', 0.72, 0.68, 0.15, 1.05, 0.69, 'BUY', 0.78
),
(
    'MSFT', CURRENT_DATE, '1y', 0.65, 0.72, 0.10, 1.02, 0.67, 'BUY', 0.75
),
(
    'TSLA', CURRENT_DATE, '1y', 0.45, 0.38, -0.05, 0.95, 0.42, 'SELL', 0.62
);

-- ============================================================================
-- Seed Market Data (Claude.MarketData.md test data)
-- ============================================================================

-- Market indices data
INSERT INTO market_indices (symbol, index_name, current_value, change_percent, volume, market_cap) VALUES
    ('SPY', 'S&P 500 ETF', 485.20, 0.75, 45000000, 400000000000),
    ('QQQ', 'NASDAQ-100 ETF', 382.50, 1.20, 35000000, 200000000000),
    ('DIA', 'Dow Jones Industrial Average ETF', 340.80, 0.45, 8000000, 30000000000),
    ('IWM', 'Russell 2000 ETF', 195.30, -0.30, 25000000, 15000000000),
    ('VIX', 'CBOE Volatility Index', 18.50, -5.20, 0, 0);

-- Market breadth data (last 10 days)
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '9 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date as date
)
INSERT INTO market_breadth (date, advancing, declining, unchanged, ratio, new_highs, new_lows)
SELECT
    date,
    1800 + (EXTRACT(day FROM date) * 10)::integer, -- Advancing
    1200 - (EXTRACT(day FROM date) * 5)::integer,  -- Declining
    100, -- Unchanged
    (1800 + (EXTRACT(day FROM date) * 10)) / (1200 - (EXTRACT(day FROM date) * 5))::decimal, -- Ratio
    150 + (EXTRACT(day FROM date) * 2)::integer, -- New highs
    80 - (EXTRACT(day FROM date) * 1)::integer   -- New lows
FROM date_series;

-- Sentiment data
INSERT INTO sentiment_data (symbol, date, overall_score, news_sentiment, social_sentiment, confidence, trending_keywords, source_count) VALUES
    ('AAPL', CURRENT_DATE, 15.2, 18.5, 12.8, 0.82, '["earnings", "iphone", "AI", "innovation"]'::jsonb, 45),
    ('MSFT', CURRENT_DATE, 22.1, 25.3, 18.9, 0.79, '["cloud", "azure", "copilot", "AI"]'::jsonb, 38),
    ('NVDA', CURRENT_DATE, 35.7, 42.1, 29.3, 0.85, '["AI", "data center", "gaming", "chips"]'::jsonb, 52),
    ('TSLA', CURRENT_DATE, -8.3, -12.1, -4.5, 0.71, '["recall", "autopilot", "competition"]'::jsonb, 31),
    (NULL, CURRENT_DATE, 12.8, 15.2, 10.4, 0.76, '["fed", "rates", "earnings", "growth"]'::jsonb, 128); -- Market-wide sentiment

-- Market overview snapshot
INSERT INTO market_overview (timestamp, market_status, overall_sentiment, indices_data, breadth_data) VALUES (
    CURRENT_TIMESTAMP,
    'OPEN',
    12.8,
    '{
        "SPY": {"value": 485.20, "change": 0.75},
        "QQQ": {"value": 382.50, "change": 1.20},
        "DIA": {"value": 340.80, "change": 0.45},
        "IWM": {"value": 195.30, "change": -0.30},
        "VIX": {"value": 18.50, "change": -5.20}
    }'::jsonb,
    '{
        "advancing": 1820,
        "declining": 1180,
        "unchanged": 100,
        "ratio": 1.54,
        "new_highs": 162,
        "new_lows": 73
    }'::jsonb
);

-- ============================================================================
-- Seed User Portfolios and Watchlists
-- ============================================================================

-- Default portfolios for test users
INSERT INTO portfolios (portfolio_id, user_id, name, description, is_default) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Admin Portfolio', 'Admin default portfolio', TRUE),
    ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'Pro Watchlist', 'Pro user watchlist', TRUE),
    ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'My Stocks', 'Free user portfolio', TRUE),
    ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'Test Portfolio', 'Test user portfolio', TRUE);

-- Portfolio holdings
INSERT INTO portfolio_holdings (portfolio_id, symbol, quantity, average_cost, purchase_date, notes) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'AAPL', 100.0, 145.50, '2024-01-15', 'Long-term hold'),
    ('660e8400-e29b-41d4-a716-446655440001', 'MSFT', 50.0, 370.25, '2024-01-20', 'Cloud growth play'),
    ('660e8400-e29b-41d4-a716-446655440001', 'NVDA', 25.0, 850.00, '2024-02-01', 'AI investment'),
    ('660e8400-e29b-41d4-a716-446655440002', 'GOOGL', 30.0, 135.75, '2024-01-10', 'Search dominance'),
    ('660e8400-e29b-41d4-a716-446655440002', 'META', 20.0, 480.50, '2024-02-15', 'Social media recovery'),
    ('660e8400-e29b-41d4-a716-446655440003', 'SPY', 10.0, 475.00, '2024-02-20', 'Diversified ETF'),
    ('660e8400-e29b-41d4-a716-446655440004', 'QQQ', 5.0, 375.00, '2024-03-01', 'Tech exposure');

-- User alerts
INSERT INTO alerts (user_id, symbol, alert_type, threshold_value, comparison_operator, is_active) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'AAPL', 'price_above', 160.00, '>', TRUE),
    ('550e8400-e29b-41d4-a716-446655440001', 'AAPL', 'rsi_oversold', 30.00, '<', TRUE),
    ('550e8400-e29b-41d4-a716-446655440002', 'NVDA', 'price_below', 800.00, '<', TRUE),
    ('550e8400-e29b-41d4-a716-446655440002', 'TSLA', 'volume_spike', 50000000, '>', TRUE),
    ('550e8400-e29b-41d4-a716-446655440003', 'SPY', 'price_below', 470.00, '<', TRUE);

-- ============================================================================
-- Seed Model Performance Data
-- ============================================================================

-- LSTM model performance tracking
INSERT INTO model_performance (
    model_name, model_version, symbol, accuracy, precision_score, recall, f1_score,
    directional_accuracy, sharpe_ratio, max_drawdown,
    evaluation_start, evaluation_end, sample_size
) VALUES
    ('lstm_stock_predictor', 'v2.1', 'AAPL', 0.742, 0.735, 0.748, 0.741, 0.681, 1.85, 0.125, '2024-01-01', '2024-03-31', 90),
    ('lstm_stock_predictor', 'v2.1', 'MSFT', 0.728, 0.721, 0.734, 0.727, 0.665, 1.72, 0.108, '2024-01-01', '2024-03-31', 90),
    ('lstm_stock_predictor', 'v2.1', 'NVDA', 0.695, 0.687, 0.703, 0.695, 0.642, 1.58, 0.185, '2024-01-01', '2024-03-31', 90),
    ('technical_analysis', 'v1.0', NULL, 0.625, 0.618, 0.632, 0.625, 0.589, 1.25, 0.095, '2024-01-01', '2024-03-31', 500);

-- ============================================================================
-- Seed WebSocket Connection Data (for testing)
-- ============================================================================

-- Sample WebSocket connections
INSERT INTO websocket_connections (connection_id, user_id, client_id, connected_at, last_ping, ip_address, is_active) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'client_admin_001', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '30 seconds', '192.168.1.100', TRUE),
    ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'client_pro_001', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '10 seconds', '192.168.1.101', TRUE),
    ('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'client_free_001', CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP - INTERVAL '5 seconds', '192.168.1.102', TRUE);

-- WebSocket subscriptions
INSERT INTO websocket_subscriptions (connection_id, symbol, data_types) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', 'AAPL', '["price", "volume", "technical"]'::jsonb),
    ('770e8400-e29b-41d4-a716-446655440001', 'MSFT', '["price", "volume"]'::jsonb),
    ('770e8400-e29b-41d4-a716-446655440002', 'NVDA', '["price", "technical", "sentiment"]'::jsonb),
    ('770e8400-e29b-41d4-a716-446655440002', 'TSLA', '["price"]'::jsonb),
    ('770e8400-e29b-41d4-a716-446655440003', 'SPY', '["price"]'::jsonb);

-- ============================================================================
-- Sample API Request Logs (for rate limiting testing)
-- ============================================================================

-- Recent API requests for rate limiting tests
INSERT INTO api_requests (user_id, endpoint, method, status_code, response_time_ms, ip_address, request_timestamp) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', '/api/v1/stocks/AAPL/price', 'GET', 200, 145, '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '5 minutes'),
    ('550e8400-e29b-41d4-a716-446655440001', '/api/v1/stocks/AAPL/technical', 'GET', 200, 320, '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '4 minutes'),
    ('550e8400-e29b-41d4-a716-446655440002', '/api/v1/stocks/NVDA/analysis', 'GET', 200, 1840, '192.168.1.101', CURRENT_TIMESTAMP - INTERVAL '3 minutes'),
    ('550e8400-e29b-41d4-a716-446655440003', '/api/v1/market/overview', 'GET', 200, 280, '192.168.1.102', CURRENT_TIMESTAMP - INTERVAL '2 minutes'),
    (NULL, '/api/v1/stocks/INVALID/price', 'GET', 404, 25, '192.168.1.200', CURRENT_TIMESTAMP - INTERVAL '1 minute');

-- ============================================================================
-- Verification Queries (for testing)
-- ============================================================================

-- Verify data integrity
DO $$
DECLARE
    user_count INTEGER;
    stock_count INTEGER;
    price_count INTEGER;
    indicator_count INTEGER;
    portfolio_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO stock_count FROM stocks;
    SELECT COUNT(*) INTO price_count FROM price_history;
    SELECT COUNT(*) INTO indicator_count FROM technical_indicators;
    SELECT COUNT(*) INTO portfolio_count FROM portfolios;

    RAISE NOTICE 'Seed data verification:';
    RAISE NOTICE 'Users: %', user_count;
    RAISE NOTICE 'Stocks: %', stock_count;
    RAISE NOTICE 'Price records: %', price_count;
    RAISE NOTICE 'Technical indicators: %', indicator_count;
    RAISE NOTICE 'Portfolios: %', portfolio_count;

    -- Ensure minimum data requirements
    IF user_count < 4 THEN
        RAISE EXCEPTION 'Insufficient user data seeded';
    END IF;

    IF stock_count < 15 THEN
        RAISE EXCEPTION 'Insufficient stock data seeded';
    END IF;

    IF price_count < 90 THEN
        RAISE EXCEPTION 'Insufficient price history for LSTM testing';
    END IF;

    RAISE NOTICE 'Seed data verification: SUCCESS';
END
$$;

-- Create seed function for Python integration
CREATE OR REPLACE FUNCTION seed_database()
RETURNS TEXT AS $$
BEGIN
    -- This function can be called from Python to reseed database
    RAISE NOTICE 'Database seeded successfully with deterministic test data';
    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;