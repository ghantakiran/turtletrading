import React, { useEffect } from 'react';
import { useMarketStore, useUIStore } from '../stores';
import { useMarketOverview, useTopMovers } from '../hooks/useMarketData';
import { useMultipleStockPrices } from '../hooks/useStockData';

const Dashboard: React.FC = () => {
  // Zustand stores
  const { 
    marketIndices, 
    stockPrices, 
    watchlists, 
    selectedWatchlist, 
    isLoading, 
    error,
    fetchMarketData,
    setLoading,
    setError 
  } = useMarketStore();
  
  const { showNotification } = useUIStore();

  // React Query hooks for server state
  const { 
    data: marketOverview, 
    isLoading: marketLoading, 
    error: marketError,
    refetch: refetchMarket 
  } = useMarketOverview();
  
  const { 
    data: topMovers, 
    isLoading: moversLoading 
  } = useTopMovers('gainers');

  // Get current watchlist
  const currentWatchlist = watchlists.find(w => w.id === selectedWatchlist);
  
  // Use real data from React Query when available, fallback to mock data
  const stocksToShow = topMovers || [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 175.23, change: 2.45, changePercent: 1.42 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.91, change: -1.23, changePercent: -0.32 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 891.14, change: 15.67, changePercent: 1.79 },
  ];

  useEffect(() => {
    // Fetch market data using Zustand store (kept for backwards compatibility)
    const loadData = async () => {
      try {
        await fetchMarketData();
        // React Query handles its own notifications through error boundaries
      } catch (err) {
        // Fallback notification for Zustand errors
        showNotification({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to refresh market data',
          duration: 5000
        });
      }
    };

    loadData();
  }, [fetchMarketData, showNotification]);

  // Show loading state if either Zustand or React Query is loading
  if (isLoading || marketLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading market data...
        </span>
      </div>
    );
  }

  // Show error state for critical errors
  if (error && !marketOverview) {
    return (
      <div className="card p-6 bg-bear-50 border-bear-200">
        <h2 className="text-lg font-semibold text-bear-800 mb-2">Error Loading Dashboard</h2>
        <p className="text-bear-600">{error}</p>
        {marketError && (
          <p className="text-bear-600 mt-2">
            Server Error: {marketError instanceof Error ? marketError.message : 'Unknown error'}
          </p>
        )}
        <button 
          onClick={() => refetchMarket()} 
          className="btn btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Market overview and your trading insights
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Last updated</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Market Indices */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold mb-3">S&P 500</h3>
          <div className="market-price">
            {marketOverview?.indices?.find(i => i.symbol === 'SPY')?.value?.toFixed(2) || 
             marketIndices['SPY']?.value?.toFixed(2) || '4,530.25'}
          </div>
          <div className={`text-sm ${
            ((marketOverview?.indices?.find(i => i.symbol === 'SPY')?.change) || 
             marketIndices['SPY']?.change || 12.45) >= 0 
              ? 'market-change-positive' 
              : 'market-change-negative'
          }`}>
            {((marketOverview?.indices?.find(i => i.symbol === 'SPY')?.change) || 
             marketIndices['SPY']?.change || 12.45) >= 0 ? '+' : ''}
            {((marketOverview?.indices?.find(i => i.symbol === 'SPY')?.change) || 
             marketIndices['SPY']?.change || 12.45)?.toFixed(2)} 
            ({((marketOverview?.indices?.find(i => i.symbol === 'SPY')?.changePercent) || 
             marketIndices['SPY']?.changePercent || 0.28)?.toFixed(2)}%)
          </div>
        </div>

        <div className="dashboard-card">
          <h3 className="text-lg font-semibold mb-3">NASDAQ</h3>
          <div className="market-price">
            {marketOverview?.indices?.find(i => i.symbol === 'QQQ')?.value?.toFixed(2) || 
             marketIndices['QQQ']?.value?.toFixed(2) || '15,845.73'}
          </div>
          <div className={`text-sm ${
            ((marketOverview?.indices?.find(i => i.symbol === 'QQQ')?.change) || 
             marketIndices['QQQ']?.change || -8.25) >= 0 
              ? 'market-change-positive' 
              : 'market-change-negative'
          }`}>
            {((marketOverview?.indices?.find(i => i.symbol === 'QQQ')?.change) || 
             marketIndices['QQQ']?.change || -8.25) >= 0 ? '+' : ''}
            {((marketOverview?.indices?.find(i => i.symbol === 'QQQ')?.change) || 
             marketIndices['QQQ']?.change || -8.25)?.toFixed(2)} 
            ({((marketOverview?.indices?.find(i => i.symbol === 'QQQ')?.changePercent) || 
             marketIndices['QQQ']?.changePercent || -0.05)?.toFixed(2)}%)
          </div>
        </div>

        <div className="dashboard-card">
          <h3 className="text-lg font-semibold mb-3">My Watchlist</h3>
          <div className="market-price text-primary-600">
            {currentWatchlist?.symbols.length || 5}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Stocks tracked
          </div>
        </div>

        <div className="dashboard-card">
          <h3 className="text-lg font-semibold mb-3">VIX</h3>
          <div className="market-price text-warning-600">
            {marketOverview?.vix?.value?.toFixed(2) || '23.45'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Volatility index
          </div>
        </div>
      </div>

      {/* Top Stocks */}
      <div className="card">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Top Movers</h2>
          <div className="space-y-3">
            {stocksToShow.map((stock) => (
              <div key={stock.symbol} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                    <span className="text-primary-600 dark:text-primary-400 font-semibold text-sm">
                      {stock.symbol.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{stock.symbol}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{stock.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    ${stock.price.toFixed(2)}
                  </div>
                  <div className={`text-sm ${
                    stock.change >= 0 ? 'market-change-positive' : 'market-change-negative'
                  }`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
            {moversLoading && (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading top movers...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="btn btn-primary">
              📊 Analyze Stock
            </button>
            <button className="btn btn-secondary">
              📈 View Market
            </button>
            <button className="btn btn-secondary">
              🔔 Set Alert
            </button>
            <button className="btn btn-secondary">
              📋 Portfolio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;