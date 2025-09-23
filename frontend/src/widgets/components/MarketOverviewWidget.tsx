/**
 * Market Overview Widget Component
 * Displays market indices, sector performance, and market breadth data
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetInstance } from '../sdk/WidgetSDK';
import { WidgetConfiguration } from '../config/WidgetConfiguration';
import { themeManager } from '../config/WidgetTheme';

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface SectorData {
  sector: string;
  change: number;
  changePercent: number;
  marketCap: number;
  topStock: string;
}

interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
  advanceDeclineRatio: number;
  newHighs: number;
  newLows: number;
}

interface MarketOverviewData {
  indices: MarketIndex[];
  sectors: SectorData[];
  breadth: MarketBreadth;
  marketStatus: 'open' | 'closed' | 'pre-market' | 'after-hours';
  timestamp: number;
}

interface MarketOverviewWidgetProps {
  instance: WidgetInstance;
  config: WidgetConfiguration;
  onError?: (error: Error) => void;
  onResize?: (width: number, height: number) => void;
  className?: string;
  embedded?: boolean;
}

export const MarketOverviewWidget: React.FC<MarketOverviewWidgetProps> = ({
  instance,
  config,
  onError,
  onResize,
  className = '',
  embedded = false
}) => {
  const [data, setData] = useState<MarketOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'indices' | 'sectors' | 'breadth'>('indices');
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Get configuration values
  const selectedIndices = config.values.indices || ['SPY', 'QQQ', 'IWM'];
  const layout = config.values.layout || 'grid';
  const refreshInterval = config.values.refreshInterval || 30000;
  const showSectors = config.values.showSectors !== false;
  const showBreadth = config.values.showBreadth !== false;

  /**
   * Fetch market overview data
   */
  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch market indices
      const indicesPromise = Promise.all(
        selectedIndices.map(async (symbol) => {
          const response = await fetch(`/api/v1/stocks/${symbol}/price`);
          if (!response.ok) throw new Error(`Failed to fetch ${symbol}`);
          const data = await response.json();
          return {
            symbol: data.symbol,
            name: getIndexName(data.symbol),
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            volume: data.volume
          };
        })
      );

      // Fetch market overview data
      const marketResponse = fetch('/api/v1/market/overview');

      const [indices, marketRes] = await Promise.all([indicesPromise, marketResponse]);

      let marketData: any = {};
      if (marketRes.ok) {
        marketData = await marketRes.json();
      }

      const transformedData: MarketOverviewData = {
        indices,
        sectors: marketData.sectors || generateMockSectors(),
        breadth: marketData.breadth || generateMockBreadth(),
        marketStatus: marketData.status || 'closed',
        timestamp: Date.now()
      };

      setData(transformedData);
      setLastUpdate(Date.now());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [selectedIndices, onError]);

  // Initial data fetch
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchMarketData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchMarketData, refreshInterval]);

  // Apply theme
  const theme = themeManager.getTheme(config.theme);
  const themeVars = theme ? themeManager.createCSSVariables(config.theme) : {};

  /**
   * Get index display name
   */
  const getIndexName = (symbol: string): string => {
    const names: Record<string, string> = {
      SPY: 'S&P 500',
      QQQ: 'NASDAQ',
      IWM: 'Russell 2000',
      VIX: 'Volatility Index',
      DIA: 'Dow Jones'
    };
    return names[symbol] || symbol;
  };

  /**
   * Generate mock sector data (fallback)
   */
  const generateMockSectors = (): SectorData[] => [
    { sector: 'Technology', change: 2.5, changePercent: 1.8, marketCap: 12500000000000, topStock: 'AAPL' },
    { sector: 'Healthcare', change: 1.2, changePercent: 0.9, marketCap: 8200000000000, topStock: 'JNJ' },
    { sector: 'Financials', change: -0.8, changePercent: -0.5, marketCap: 7800000000000, topStock: 'JPM' },
    { sector: 'Consumer Discretionary', change: 0.3, changePercent: 0.2, marketCap: 6100000000000, topStock: 'AMZN' }
  ];

  /**
   * Generate mock breadth data (fallback)
   */
  const generateMockBreadth = (): MarketBreadth => ({
    advancing: 2834,
    declining: 1456,
    unchanged: 210,
    advanceDeclineRatio: 1.95,
    newHighs: 342,
    newLows: 67
  });

  /**
   * Format large numbers
   */
  const formatLargeNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    return num.toString();
  };

  /**
   * Get market status display
   */
  const getMarketStatusDisplay = () => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      open: { label: 'Market Open', color: 'text-green-500' },
      closed: { label: 'Market Closed', color: 'text-red-500' },
      'pre-market': { label: 'Pre-Market', color: 'text-yellow-500' },
      'after-hours': { label: 'After Hours', color: 'text-blue-500' }
    };

    const status = data?.marketStatus || 'closed';
    return statusConfig[status] || statusConfig.closed;
  };

  if (loading && !data) {
    return (
      <div
        className={`market-overview-widget ${className}`}
        style={{ ...themeVars, width: instance.size.width, height: instance.size.height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading market data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={`market-overview-widget ${className}`}
        style={{ ...themeVars, width: instance.size.width, height: instance.size.height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-red-500 text-sm font-medium mb-1">Error</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {error || 'Failed to load market data'}
            </div>
            <button
              onClick={fetchMarketData}
              className="mt-2 px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const marketStatus = getMarketStatusDisplay();

  return (
    <motion.div
      className={`market-overview-widget bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}
      style={{
        ...themeVars,
        width: instance.size.width,
        height: instance.size.height
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Market Overview
            </h3>
            <p className={`text-xs ${marketStatus.color}`}>
              {marketStatus.label}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">
              {new Date(lastUpdate).toLocaleTimeString()}
            </div>
            {loading && (
              <div className="w-3 h-3 border border-gray-300 border-t-primary-500 rounded-full animate-spin mt-1"></div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('indices')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'indices'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Indices
        </button>
        {showSectors && (
          <button
            onClick={() => setActiveTab('sectors')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'sectors'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Sectors
          </button>
        )}
        {showBreadth && (
          <button
            onClick={() => setActiveTab('breadth')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'breadth'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Breadth
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 overflow-auto" style={{ height: 'calc(100% - 90px)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'indices' && (
            <motion.div
              key="indices"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}
            >
              {data.indices.map((index, i) => (
                <IndexCard key={index.symbol} index={index} layout={layout} />
              ))}
            </motion.div>
          )}

          {activeTab === 'sectors' && showSectors && (
            <motion.div
              key="sectors"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-2"
            >
              {data.sectors.map((sector, i) => (
                <SectorCard key={sector.sector} sector={sector} />
              ))}
            </motion.div>
          )}

          {activeTab === 'breadth' && showBreadth && (
            <motion.div
              key="breadth"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              <BreadthDisplay breadth={data.breadth} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/**
 * Index Card Component
 */
interface IndexCardProps {
  index: MarketIndex;
  layout: string;
}

const IndexCard: React.FC<IndexCardProps> = ({ index, layout }) => {
  const isPositive = index.change >= 0;
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500';

  if (layout === 'compact') {
    return (
      <div className="flex items-center justify-between py-1">
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-900 dark:text-white">
            {index.symbol}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-gray-900 dark:text-white">
            ${index.price.toFixed(2)}
          </div>
          <div className={`text-xs ${changeColor}`}>
            {isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border">
      <div className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
        {index.symbol}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {index.name}
      </div>
      <div className="text-sm font-bold text-gray-900 dark:text-white">
        ${index.price.toFixed(2)}
      </div>
      <div className={`text-xs ${changeColor} flex items-center space-x-1`}>
        <span>{isPositive ? '↗' : '↘'}</span>
        <span>{Math.abs(index.change).toFixed(2)}</span>
        <span>({isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%)</span>
      </div>
    </div>
  );
};

/**
 * Sector Card Component
 */
interface SectorCardProps {
  sector: SectorData;
}

const SectorCard: React.FC<SectorCardProps> = ({ sector }) => {
  const isPositive = sector.change >= 0;
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500';

  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-900 dark:text-white">
            {sector.sector}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Top: {sector.topStock}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-medium ${changeColor}`}>
            {isPositive ? '+' : ''}{sector.changePercent.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatLargeNumber(sector.marketCap)}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Market Breadth Display Component
 */
interface BreadthDisplayProps {
  breadth: MarketBreadth;
}

const BreadthDisplay: React.FC<BreadthDisplayProps> = ({ breadth }) => {
  const total = breadth.advancing + breadth.declining + breadth.unchanged;
  const advancingPercent = (breadth.advancing / total) * 100;
  const decliningPercent = (breadth.declining / total) * 100;

  return (
    <div className="space-y-3">
      {/* Advance/Decline Ratio */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            Advance/Decline
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Ratio: {breadth.advanceDeclineRatio.toFixed(2)}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${advancingPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>Advancing: {breadth.advancing}</span>
          <span>Declining: {breadth.declining}</span>
        </div>
      </div>

      {/* New Highs/Lows */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
          <div className="text-xs text-green-700 dark:text-green-400 font-medium">
            New Highs
          </div>
          <div className="text-lg font-bold text-green-800 dark:text-green-300">
            {breadth.newHighs}
          </div>
        </div>
        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <div className="text-xs text-red-700 dark:text-red-400 font-medium">
            New Lows
          </div>
          <div className="text-lg font-bold text-red-800 dark:text-red-300">
            {breadth.newLows}
          </div>
        </div>
      </div>
    </div>
  );
};

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  return num.toString();
}

export default MarketOverviewWidget;