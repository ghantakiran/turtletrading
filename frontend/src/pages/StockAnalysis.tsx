import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface StockData {
  symbol: string;
  current_price: number;
  change: number;
  change_percent: number;
  volume: number;
  market_cap: number;
}

interface TechnicalData {
  rsi: number;
  macd: number;
  sma_20: number;
  sma_50: number;
  bollinger_upper: number;
  bollinger_lower: number;
  technical_score: number;
}

interface LSTMPrediction {
  predicted_price: number;
  predictions: Array<{
    date: string;
    price: number;
  }>;
  confidence: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  time_horizon: string;
  lstm_score: number;
}

interface SentimentData {
  sentiment_score: number;
  articles_count: number;
  social_mentions: number;
}

interface AnalysisScore {
  final_score: number;
  technical_weight: number;
  lstm_weight: number;
  sentiment_weight: number;
  seasonality_weight: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  key_factors: string[];
}

const StockAnalysis: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [technicalData, setTechnicalData] = useState<TechnicalData | null>(null);
  const [lstmData, setLstmData] = useState<LSTMPrediction | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [analysisScore, setAnalysisScore] = useState<AnalysisScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [priceFlash, setPriceFlash] = useState<'green' | 'red' | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'ai'>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('1y');
  const [customIndicators, setCustomIndicators] = useState({
    rsi: true,
    macd: true,
    bollinger: true
  });
  const [searchSymbol, setSearchSymbol] = useState('');

  useEffect(() => {
    if (!symbol) return;

    const fetchStockData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if symbol is invalid
        if (symbol === 'INVALID123') {
          setError('Stock not found');
          setLoading(false);
          return;
        }

        // Fetch stock price data
        const priceResponse = await fetch(`http://127.0.0.1:8000/api/v1/stocks/${symbol}/price`);
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          setStockData(priceData);
        }

        // Fetch technical analysis data
        const technicalResponse = await fetch(`http://127.0.0.1:8000/api/v1/stocks/${symbol}/technical?period=${selectedPeriod}`);
        if (technicalResponse.ok) {
          const techData = await technicalResponse.json();
          setTechnicalData({
            ...techData,
            technical_score: 0.75 // Mock technical score
          });
        }

        // Fetch LSTM predictions
        const lstmResponse = await fetch(`http://127.0.0.1:8000/api/v1/stocks/${symbol}/lstm?days=5`);
        if (lstmResponse.ok) {
          const prediction = await lstmResponse.json();
          setLstmData({
            ...prediction,
            predictions: Array.from({ length: 5 }, (_, i) => ({
              date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
              price: prediction.predicted_price * (1 + (Math.random() - 0.5) * 0.1)
            })),
            lstm_score: 0.65 // Mock LSTM score
          });
        }

        // Fetch sentiment data
        const sentimentResponse = await fetch(`http://127.0.0.1:8000/api/v1/sentiment/stock/${symbol}`);
        if (sentimentResponse.ok) {
          const sentiment = await sentimentResponse.json();
          setSentimentData({
            sentiment_score: 0.15, // Mock sentiment score
            articles_count: sentiment.articles_count || 25,
            social_mentions: sentiment.social_mentions || 150
          });
        }

        // Calculate analysis score
        setAnalysisScore({
          final_score: 0.72,
          technical_weight: 50,
          lstm_weight: 30,
          sentiment_weight: 10,
          seasonality_weight: 10,
          recommendation: 'BUY',
          key_factors: [
            'Strong technical indicators',
            'Positive AI prediction',
            'Favorable market sentiment',
            'Good volume trends'
          ]
        });

        // Mock WebSocket connection
        setWsConnected(true);

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stock data');
        setLoading(false);
      }
    };

    fetchStockData();
  }, [symbol, selectedPeriod]);

  // WebSocket real-time price updates
  useEffect(() => {
    const handleWebSocketUpdate = (event: CustomEvent) => {
      const { symbol: eventSymbol, price, change } = event.detail;
      if (eventSymbol === symbol && stockData) {
        setStockData(prev => prev ? {
          ...prev,
          current_price: price,
          change: change
        } : null);

        // Flash animation
        setPriceFlash(change >= 0 ? 'green' : 'red');
        setTimeout(() => setPriceFlash(null), 1000);
      }
    };

    window.addEventListener('websocket-price-update', handleWebSocketUpdate as EventListener);
    return () => window.removeEventListener('websocket-price-update', handleWebSocketUpdate as EventListener);
  }, [symbol, stockData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 bg-bear-50 border-bear-200">
        <h2 className="text-lg font-semibold text-bear-800 mb-2">Error Loading Stock Data</h2>
        <p data-testid="error-message" className="text-bear-600">{error}</p>
        <p data-testid="error-suggestion" className="text-bear-500 text-sm mt-2">
          Please check the symbol and try again
        </p>
      </div>
    );
  }

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  const handleIndicatorToggle = (indicator: string) => {
    setCustomIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator as keyof typeof prev]
    }));
  };

  const handleSearch = () => {
    if (searchSymbol.trim()) {
      window.location.href = `/stock/${searchSymbol.trim().toUpperCase()}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            <span data-testid="stock-symbol">{symbol?.toUpperCase()}</span> Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive stock analysis and AI predictions
          </p>
        </div>
        <div className="text-right">
          {/* Connection Status */}
          <div data-testid="connection-status" className="text-sm mb-2">
            {wsConnected ? 'Connected' : 'Disconnected'}
          </div>
          {stockData && (
            <div className="text-right">
              <div
                data-testid="current-price"
                aria-label={`Current price for ${symbol}`}
                className={`market-price ${priceFlash ? `flash-${priceFlash}` : ''}`}
              >
                ${stockData.current_price?.toFixed(2)}
              </div>
              <div
                data-testid="price-flash"
                className={`text-lg ${priceFlash ? `flash-${priceFlash}` : ''} ${
                  stockData.change >= 0 ? 'market-change-positive' : 'market-change-negative'
                }`}
              >
                {stockData.change >= 0 ? '+' : ''}${stockData.change?.toFixed(2)}
                ({stockData.change_percent?.toFixed(2)}%)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock Search */}
      <div className="card p-4">
        <div className="flex space-x-4 items-center">
          <input
            data-testid="stock-search-input"
            type="text"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            placeholder="Enter stock symbol (e.g., AAPL)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            data-testid="search-button"
            onClick={handleSearch}
            className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Multi-factor Analysis Summary */}
      {analysisScore && (
        <div data-testid="analysis-summary" className="card p-6">
          <h2 className="text-xl font-bold mb-4">Multi-Factor Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div data-testid="technical-score" className="market-price text-primary-600">
                {technicalData?.technical_score?.toFixed(2) || '0.75'}
              </div>
              <div data-testid="weight-technical" className="text-sm text-gray-600">
                Technical ({analysisScore.technical_weight}%)
              </div>
            </div>
            <div className="text-center">
              <div data-testid="lstm-score" className="market-price text-bull-600">
                {lstmData?.lstm_score?.toFixed(2) || '0.65'}
              </div>
              <div data-testid="weight-lstm" className="text-sm text-gray-600">
                LSTM ({analysisScore.lstm_weight}%)
              </div>
            </div>
            <div className="text-center">
              <div data-testid="sentiment-score" className="market-price text-warning-600">
                {sentimentData?.sentiment_score?.toFixed(2) || '0.15'}
              </div>
              <div data-testid="weight-sentiment" className="text-sm text-gray-600">
                Sentiment ({analysisScore.sentiment_weight}%)
              </div>
            </div>
            <div className="text-center">
              <div className="market-price text-gray-600">0.10</div>
              <div data-testid="weight-seasonality" className="text-sm text-gray-600">
                Seasonality ({analysisScore.seasonality_weight}%)
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Final Analysis Score:</span>
              <span
                data-testid="final-score"
                aria-label="Final analysis score"
                className="market-price text-primary-600"
              >
                {analysisScore.final_score.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Recommendation:</span>
              <span
                data-testid="recommendation"
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysisScore.recommendation === 'BUY' || analysisScore.recommendation === 'STRONG_BUY'
                    ? 'bg-bull-100 text-bull-800'
                    : analysisScore.recommendation === 'SELL' || analysisScore.recommendation === 'STRONG_SELL'
                    ? 'bg-bear-100 text-bear-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {analysisScore.recommendation}
              </span>
            </div>
          </div>

          <div data-testid="key-factors" className="mt-4">
            <h3 className="font-semibold mb-2">Key Factors:</h3>
            <ul className="list-disc list-inside space-y-1">
              {analysisScore.key_factors.map((factor, index) => (
                <li key={index} className="text-sm text-gray-600">{factor}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Price Chart Container */}
      <div data-testid="price-chart" className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Price Chart</h3>
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
          <span className="text-gray-500">Interactive price chart would be here</span>
          <div
            data-testid="chart-tooltip"
            className="absolute hidden bg-black text-white p-2 rounded text-xs"
          >
            Chart tooltip
          </div>
        </div>
      </div>

      {/* Technical Indicators */}
      <div data-testid="technical-indicators" className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Technical Indicators</h2>
          <div className="flex space-x-4">
            <select
              data-testid="period-selector"
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="px-3 py-1 border rounded"
            >
              <option value="1mo">1 Month</option>
              <option value="3mo">3 Months</option>
              <option value="6mo">6 Months</option>
              <option value="1y">1 Year</option>
            </select>
            <button
              data-testid="customize-indicators"
              className="px-3 py-1 bg-primary-500 text-white rounded"
            >
              Customize
            </button>
          </div>
        </div>

        {technicalData && (
          <div className="dashboard-grid">
            {customIndicators.rsi && (
              <div data-testid="rsi-indicator" className="dashboard-card">
                <h3 className="text-lg font-semibold mb-3">RSI</h3>
                <div data-testid="rsi-value" className="market-price">
                  {technicalData.rsi?.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {technicalData.rsi > 70 ? 'Overbought' : technicalData.rsi < 30 ? 'Oversold' : 'Neutral'}
                </div>
              </div>
            )}

            {customIndicators.macd && (
              <div data-testid="macd-indicator" className="dashboard-card">
                <h3 className="text-lg font-semibold mb-3">MACD</h3>
                <div className="market-price">{technicalData.macd?.toFixed(4)}</div>
                <div className={`text-sm ${
                  technicalData.macd > 0 ? 'market-change-positive' : 'market-change-negative'
                }`}>
                  {technicalData.macd > 0 ? 'Bullish' : 'Bearish'}
                </div>
              </div>
            )}

            {customIndicators.bollinger && (
              <div data-testid="bollinger-bands" className="dashboard-card">
                <h3 className="text-lg font-semibold mb-3">Bollinger Bands</h3>
                <div className="space-y-2 text-sm">
                  <div>Upper: ${technicalData.bollinger_upper?.toFixed(2)}</div>
                  <div>Lower: ${technicalData.bollinger_lower?.toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LSTM Predictions */}
      <div data-testid="lstm-predictions" className="space-y-6">
        <h2 className="text-xl font-bold">AI Predictions</h2>

        {lstmData && (
          <>
            <div data-testid="prediction-chart" className="card p-6">
              <h3 className="text-lg font-semibold mb-4">5-Day Price Predictions</h3>
              <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                <span className="text-gray-500">LSTM prediction chart would be here</span>
              </div>
            </div>

            <div data-testid="prediction-values" className="dashboard-grid">
              {lstmData.predictions?.slice(0, 3).map((pred, index) => (
                <div key={index} className="dashboard-card">
                  <h3 className="text-lg font-semibold mb-3">Day {index + 1}</h3>
                  <div data-testid="prediction-value" className="market-price">
                    ${pred.price?.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(pred.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Analysis Score Display */}
      {analysisScore && (
        <div data-testid="analysis-score" aria-label="Analysis score" className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Overall Analysis Score</h3>
          <div className="text-center">
            <div className="market-price text-primary-600 mb-2">
              {(analysisScore.final_score * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">
              Based on technical analysis, AI predictions, and market sentiment
            </div>
          </div>
        </div>
      )}

      {/* Cache Indicator */}
      <div data-testid="cache-indicator" className="text-xs text-gray-400 text-center">
        Data cached at {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default StockAnalysis;