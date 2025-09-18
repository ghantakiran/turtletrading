import React, { useState, useEffect } from 'react';

interface MarketData {
  indices: {
    sp500: {
      current_value: number;
      change: number;
      change_percent: number;
    };
    nasdaq: {
      current_value: number;
      change: number;
      change_percent: number;
    };
    dow: {
      current_value: number;
      change: number;
      change_percent: number;
    };
  };
  market_sentiment: number;
  volatility: number;
  market_breadth: {
    advancing: number;
    declining: number;
    unchanged: number;
  };
}

const MarketOverview: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setLoading(true);
        
        const response = await fetch('http://127.0.0.1:8000/api/v1/market/overview');
        if (response.ok) {
          const data = await response.json();
          setMarketData(data);
        } else {
          // Mock data for demonstration
          setMarketData({
            indices: {
              sp500: { current_value: 4150.32, change: 25.67, change_percent: 0.62 },
              nasdaq: { current_value: 12890.15, change: -45.23, change_percent: -0.35 },
              dow: { current_value: 33890.45, change: 156.78, change_percent: 0.46 }
            },
            market_sentiment: 0.65,
            volatility: 23.45,
            market_breadth: {
              advancing: 1234,
              declining: 987,
              unchanged: 156
            }
          });
        }
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load market data');
        setLoading(false);
      }
    };

    fetchMarketData();
  }, []);

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
        <h2 className="text-lg font-semibold text-bear-800 mb-2">Error Loading Market Data</h2>
        <p className="text-bear-600">{error}</p>
      </div>
    );
  }

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.7) return { label: 'Extremely Bullish', color: 'text-bull-600' };
    if (sentiment > 0.6) return { label: 'Bullish', color: 'text-bull-500' };
    if (sentiment > 0.4) return { label: 'Neutral', color: 'text-gray-600' };
    if (sentiment > 0.3) return { label: 'Bearish', color: 'text-bear-500' };
    return { label: 'Extremely Bearish', color: 'text-bear-600' };
  };

  const getVolatilityLabel = (vix: number) => {
    if (vix > 30) return { label: 'High Fear', color: 'text-bear-600' };
    if (vix > 20) return { label: 'Moderate Fear', color: 'text-warning-600' };
    return { label: 'Low Fear', color: 'text-bull-600' };
  };

  const sentimentInfo = getSentimentLabel(marketData?.market_sentiment || 0);
  const volatilityInfo = getVolatilityLabel(marketData?.volatility || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Market Overview</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time market indices and sentiment analysis
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Market Status</p>
          <div className="flex items-center space-x-2">
            <span className="status-indicator status-online"></span>
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Open</span>
          </div>
        </div>
      </div>

      {/* Major Indices */}
      {marketData?.indices && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Major Indices</h2>
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                S&P 500
                <span className="ml-2 text-xs text-gray-500">SPX</span>
              </h3>
              <div className="market-price">
                {marketData.indices.sp500.current_value.toFixed(2)}
              </div>
              <div className={`text-lg ${
                marketData.indices.sp500.change >= 0 
                  ? 'market-change-positive' 
                  : 'market-change-negative'
              }`}>
                {marketData.indices.sp500.change >= 0 ? '+' : ''}
                {marketData.indices.sp500.change.toFixed(2)} 
                ({marketData.indices.sp500.change_percent.toFixed(2)}%)
              </div>
            </div>

            <div className="dashboard-card">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                NASDAQ
                <span className="ml-2 text-xs text-gray-500">IXIC</span>
              </h3>
              <div className="market-price">
                {marketData.indices.nasdaq.current_value.toFixed(2)}
              </div>
              <div className={`text-lg ${
                marketData.indices.nasdaq.change >= 0 
                  ? 'market-change-positive' 
                  : 'market-change-negative'
              }`}>
                {marketData.indices.nasdaq.change >= 0 ? '+' : ''}
                {marketData.indices.nasdaq.change.toFixed(2)} 
                ({marketData.indices.nasdaq.change_percent.toFixed(2)}%)
              </div>
            </div>

            <div className="dashboard-card">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                Dow Jones
                <span className="ml-2 text-xs text-gray-500">DJI</span>
              </h3>
              <div className="market-price">
                {marketData.indices.dow.current_value.toFixed(2)}
              </div>
              <div className={`text-lg ${
                marketData.indices.dow.change >= 0 
                  ? 'market-change-positive' 
                  : 'market-change-negative'
              }`}>
                {marketData.indices.dow.change >= 0 ? '+' : ''}
                {marketData.indices.dow.change.toFixed(2)} 
                ({marketData.indices.dow.change_percent.toFixed(2)}%)
              </div>
            </div>

            <div className="dashboard-card">
              <h3 className="text-lg font-semibold mb-3">VIX</h3>
              <div className="market-price text-warning-600">
                {marketData.volatility?.toFixed(2)}
              </div>
              <div className={`text-sm ${volatilityInfo.color}`}>
                {volatilityInfo.label}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Market Sentiment & Breadth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-4">Market Sentiment</h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className="market-price">{((marketData?.market_sentiment || 0) * 100).toFixed(1)}%</div>
                <div className={`text-lg ${sentimentInfo.color}`}>
                  {sentimentInfo.label}
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-bear-500 via-warning-500 to-bull-500 h-3 rounded-full relative"
                >
                  <div 
                    className="absolute top-0 w-4 h-4 bg-white border-2 border-gray-400 rounded-full transform -translate-y-0.5"
                    style={{ left: `${((marketData?.market_sentiment || 0) * 100) - 2}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Bearish</span>
                <span>Neutral</span>
                <span>Bullish</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-4">Market Breadth</h3>
            {marketData?.market_breadth && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Advancing</span>
                  <span className="text-bull-600 font-semibold">
                    {marketData.market_breadth.advancing.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Declining</span>
                  <span className="text-bear-600 font-semibold">
                    {marketData.market_breadth.declining.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Unchanged</span>
                  <span className="text-gray-600 font-semibold">
                    {marketData.market_breadth.unchanged.toLocaleString()}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">A/D Ratio</span>
                    <span className={`font-semibold ${
                      marketData.market_breadth.advancing > marketData.market_breadth.declining
                        ? 'text-bull-600'
                        : 'text-bear-600'
                    }`}>
                      {(marketData.market_breadth.advancing / marketData.market_breadth.declining).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sector Performance */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-xl font-semibold mb-4">Sector Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { sector: 'Technology', change: 1.2, color: 'text-bull-600' },
              { sector: 'Healthcare', change: 0.8, color: 'text-bull-600' },
              { sector: 'Financials', change: -0.5, color: 'text-bear-600' },
              { sector: 'Energy', change: 2.1, color: 'text-bull-600' },
              { sector: 'Consumer Disc.', change: -1.1, color: 'text-bear-600' },
              { sector: 'Industrials', change: 0.3, color: 'text-bull-600' },
              { sector: 'Materials', change: -0.2, color: 'text-bear-600' },
              { sector: 'Utilities', change: 0.1, color: 'text-bull-600' },
            ].map((sector) => (
              <div key={sector.sector} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {sector.sector}
                </div>
                <div className={`text-lg font-semibold ${sector.color}`}>
                  {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Market Summary */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-xl font-semibold mb-4">Market Summary</h3>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300">
              Markets are showing {sentimentInfo.label.toLowerCase()} sentiment with the VIX at {marketData?.volatility?.toFixed(2)}, 
              indicating {volatilityInfo.label.toLowerCase()}. The advance/decline ratio of{' '}
              {marketData?.market_breadth && (marketData.market_breadth.advancing / marketData.market_breadth.declining).toFixed(2)} 
              suggests {marketData?.market_breadth && marketData.market_breadth.advancing > marketData.market_breadth.declining ? 'broad market strength' : 'underlying weakness'}.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              Technology and Energy sectors are leading gains, while Consumer Discretionary and Financials 
              show weakness. Overall market conditions appear{' '}
              {(marketData?.market_sentiment || 0) > 0.6 ? 'favorable for risk-on strategies' : 'cautious with defensive positioning recommended'}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketOverview;