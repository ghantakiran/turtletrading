/**
 * Portfolio Performance Widget Component
 * Displays portfolio holdings, performance metrics, and allocation charts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetInstance } from '../sdk/WidgetSDK';
import { WidgetConfiguration } from '../config/WidgetConfiguration';
import { themeManager } from '../config/WidgetTheme';

interface PortfolioHolding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  dayChange: number;
  dayChangePercent: number;
  allocation: number;
  sector: string;
}

interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercent: number;
  dayChange: number;
  dayChangePercent: number;
  cash: number;
  diversification: {
    bySecctor: Record<string, number>;
    byAsset: Record<string, number>;
  };
}

interface PortfolioData {
  holdings: PortfolioHolding[];
  metrics: PortfolioMetrics;
  performanceHistory: PerformancePoint[];
  timestamp: number;
}

interface PerformancePoint {
  date: string;
  value: number;
  return: number;
}

interface PortfolioWidgetProps {
  instance: WidgetInstance;
  config: WidgetConfiguration;
  onError?: (error: Error) => void;
  onResize?: (width: number, height: number) => void;
  className?: string;
  embedded?: boolean;
}

export const PortfolioWidget: React.FC<PortfolioWidgetProps> = ({
  instance,
  config,
  onError,
  onResize,
  className = '',
  embedded = false
}) => {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'performance' | 'allocation'>('holdings');
  const [sortBy, setSortBy] = useState<'allocation' | 'return' | 'value'>('allocation');
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Get configuration values
  const portfolioId = config.values.portfolioId || 'default';
  const refreshInterval = config.values.refreshInterval || 30000;
  const showPerformanceChart = config.values.showPerformanceChart !== false;
  const showAllocation = config.values.showAllocation !== false;
  const maxHoldings = config.values.maxHoldings || 10;

  /**
   * Fetch portfolio data
   */
  const fetchPortfolioData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/portfolio/${portfolioId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const portfolioData = await response.json();

      // Transform API response or use mock data
      const transformedData: PortfolioData = portfolioData || generateMockPortfolio();

      setData(transformedData);
      setLastUpdate(Date.now());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));

      // Use mock data as fallback
      setData(generateMockPortfolio());
    } finally {
      setLoading(false);
    }
  }, [portfolioId, onError]);

  // Initial data fetch
  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchPortfolioData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPortfolioData, refreshInterval]);

  // Apply theme
  const theme = themeManager.getTheme(config.theme);
  const themeVars = theme ? themeManager.createCSSVariables(config.theme) : {};

  /**
   * Generate mock portfolio data
   */
  const generateMockPortfolio = (): PortfolioData => ({
    holdings: [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        shares: 100,
        avgCost: 150.00,
        currentPrice: 175.50,
        marketValue: 17550,
        totalReturn: 2550,
        totalReturnPercent: 17.0,
        dayChange: 2.25,
        dayChangePercent: 1.3,
        allocation: 35.2,
        sector: 'Technology'
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        shares: 50,
        avgCost: 280.00,
        currentPrice: 310.75,
        marketValue: 15537.50,
        totalReturn: 1537.50,
        totalReturnPercent: 11.0,
        dayChange: -1.50,
        dayChangePercent: -0.5,
        allocation: 31.1,
        sector: 'Technology'
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        shares: 25,
        avgCost: 120.00,
        currentPrice: 135.80,
        marketValue: 3395,
        totalReturn: 395,
        totalReturnPercent: 13.2,
        dayChange: 0.95,
        dayChangePercent: 0.7,
        allocation: 6.8,
        sector: 'Technology'
      },
      {
        symbol: 'JPM',
        name: 'JPMorgan Chase & Co.',
        shares: 30,
        avgCost: 140.00,
        currentPrice: 155.20,
        marketValue: 4656,
        totalReturn: 456,
        totalReturnPercent: 10.9,
        dayChange: -0.80,
        dayChangePercent: -0.5,
        allocation: 9.3,
        sector: 'Financials'
      },
      {
        symbol: 'JNJ',
        name: 'Johnson & Johnson',
        shares: 40,
        avgCost: 165.00,
        currentPrice: 162.90,
        marketValue: 6516,
        totalReturn: -84,
        totalReturnPercent: -1.3,
        dayChange: 0.40,
        dayChangePercent: 0.2,
        allocation: 13.1,
        sector: 'Healthcare'
      }
    ],
    metrics: {
      totalValue: 50000,
      totalCost: 45000,
      totalReturn: 5000,
      totalReturnPercent: 11.1,
      dayChange: 125.50,
      dayChangePercent: 0.25,
      cash: 2345.50,
      diversification: {
        bySecctor: {
          'Technology': 73.1,
          'Financials': 9.3,
          'Healthcare': 13.1,
          'Cash': 4.7
        },
        byAsset: {
          'Stocks': 95.3,
          'Cash': 4.7
        }
      }
    },
    performanceHistory: generateMockPerformance(),
    timestamp: Date.now()
  });

  /**
   * Generate mock performance history
   */
  const generateMockPerformance = (): PerformancePoint[] => {
    const points: PerformancePoint[] = [];
    const startValue = 45000;
    let currentValue = startValue;

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Simulate some volatility
      const change = (Math.random() - 0.5) * 1000;
      currentValue += change;

      points.push({
        date: date.toISOString().split('T')[0],
        value: currentValue,
        return: ((currentValue - startValue) / startValue) * 100
      });
    }

    return points;
  };

  /**
   * Format currency
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  /**
   * Format percentage
   */
  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  /**
   * Sort holdings
   */
  const sortedHoldings = data?.holdings
    .sort((a, b) => {
      switch (sortBy) {
        case 'allocation':
          return b.allocation - a.allocation;
        case 'return':
          return b.totalReturnPercent - a.totalReturnPercent;
        case 'value':
          return b.marketValue - a.marketValue;
        default:
          return 0;
      }
    })
    .slice(0, maxHoldings) || [];

  if (loading && !data) {
    return (
      <div
        className={`portfolio-widget ${className}`}
        style={{ ...themeVars, width: instance.size.width, height: instance.size.height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading portfolio...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        className={`portfolio-widget ${className}`}
        style={{ ...themeVars, width: instance.size.width, height: instance.size.height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-red-500 text-sm font-medium mb-1">Error</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {error || 'Failed to load portfolio'}
            </div>
            <button
              onClick={fetchPortfolioData}
              className="mt-2 px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isPositiveReturn = data.metrics.totalReturn >= 0;
  const isPositiveDayChange = data.metrics.dayChange >= 0;

  return (
    <motion.div
      className={`portfolio-widget bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}
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
              Portfolio
            </h3>
            <div className="flex items-center space-x-3 mt-1">
              <div className="text-xs">
                <span className="text-gray-500 dark:text-gray-400">Value: </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(data.metrics.totalValue)}
                </span>
              </div>
              <div className={`text-xs font-medium ${isPositiveReturn ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercent(data.metrics.totalReturnPercent)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">
              {new Date(lastUpdate).toLocaleTimeString()}
            </div>
            <div className={`text-xs font-medium ${isPositiveDayChange ? 'text-green-500' : 'text-red-500'}`}>
              {isPositiveDayChange ? '+' : ''}{formatCurrency(data.metrics.dayChange)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('holdings')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'holdings'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Holdings
        </button>
        {showPerformanceChart && (
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'performance'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Performance
          </button>
        )}
        {showAllocation && (
          <button
            onClick={() => setActiveTab('allocation')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'allocation'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Allocation
          </button>
        )}
      </div>

      {/* Content */}
      <div className="overflow-auto" style={{ height: 'calc(100% - 90px)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'holdings' && (
            <motion.div
              key="holdings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-2"
            >
              {/* Sort Controls */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {sortedHoldings.length} holdings
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-800"
                >
                  <option value="allocation">Sort by Allocation</option>
                  <option value="return">Sort by Return</option>
                  <option value="value">Sort by Value</option>
                </select>
              </div>

              {/* Holdings List */}
              <div className="space-y-1">
                {sortedHoldings.map((holding, index) => (
                  <HoldingCard key={holding.symbol} holding={holding} />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'performance' && showPerformanceChart && (
            <motion.div
              key="performance"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-3"
            >
              <PerformanceChart data={data.performanceHistory} />
            </motion.div>
          )}

          {activeTab === 'allocation' && showAllocation && (
            <motion.div
              key="allocation"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-3 space-y-4"
            >
              <AllocationChart data={data.metrics.diversification} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/**
 * Holding Card Component
 */
interface HoldingCardProps {
  holding: PortfolioHolding;
}

const HoldingCard: React.FC<HoldingCardProps> = ({ holding }) => {
  const isPositiveReturn = holding.totalReturn >= 0;
  const isPositiveDayChange = holding.dayChange >= 0;

  return (
    <div className="p-2 border border-gray-200 dark:border-gray-700 rounded text-xs">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-900 dark:text-white">
            {holding.symbol}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {holding.shares} shares
          </span>
        </div>
        <div className="text-right">
          <div className="font-medium text-gray-900 dark:text-white">
            ${holding.currentPrice.toFixed(2)}
          </div>
          <div className={`text-xs ${isPositiveDayChange ? 'text-green-500' : 'text-red-500'}`}>
            {isPositiveDayChange ? '+' : ''}{holding.dayChangePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-gray-500 dark:text-gray-400">
            Value: ${holding.marketValue.toLocaleString()}
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            {holding.allocation.toFixed(1)}% allocation
          </div>
        </div>
        <div className="text-right">
          <div className={`font-medium ${isPositiveReturn ? 'text-green-500' : 'text-red-500'}`}>
            {isPositiveReturn ? '+' : ''}${Math.abs(holding.totalReturn).toLocaleString()}
          </div>
          <div className={`text-xs ${isPositiveReturn ? 'text-green-500' : 'text-red-500'}`}>
            {formatPercent(holding.totalReturnPercent)}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Performance Chart Component
 */
interface PerformanceChartProps {
  data: PerformancePoint[];
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const minValue = Math.min(...data.map(d => d.value));
  const maxValue = Math.max(...data.map(d => d.value));
  const valueRange = maxValue - minValue || 1;

  const width = 300;
  const height = 120;
  const padding = 20;

  const path = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * (width - 2 * padding) + padding;
      const y = ((maxValue - point.value) / valueRange) * (height - 2 * padding) + padding;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const isPositive = data[data.length - 1].value >= data[0].value;

  return (
    <div>
      <div className="text-center mb-2">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          30-Day Performance
        </div>
        <div className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {formatPercent(data[data.length - 1].return)}
        </div>
      </div>

      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <path
          d={path}
          fill="none"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

/**
 * Allocation Chart Component
 */
interface AllocationChartProps {
  data: {
    bySecctor: Record<string, number>;
    byAsset: Record<string, number>;
  };
}

const AllocationChart: React.FC<AllocationChartProps> = ({ data }) => {
  const [view, setView] = useState<'sector' | 'asset'>('sector');
  const chartData = view === 'sector' ? data.bySecctor : data.byAsset;

  const colors = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6b7280'];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          Allocation
        </h4>
        <div className="flex space-x-1">
          <button
            onClick={() => setView('sector')}
            className={`px-2 py-1 text-xs rounded ${
              view === 'sector'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Sector
          </button>
          <button
            onClick={() => setView('asset')}
            className={`px-2 py-1 text-xs rounded ${
              view === 'asset'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Asset
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(chartData).map(([category, percentage], index) => (
          <div key={category} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-xs text-gray-700 dark:text-gray-300">
                {category}
              </span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatPercent(percent: number): string {
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
}

export default PortfolioWidget;