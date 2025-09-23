/**
 * Stock Price Widget Component
 * Real-time stock price display with mini chart and configuration support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { WidgetInstance } from '../sdk/WidgetSDK';
import { WidgetConfiguration } from '../config/WidgetConfiguration';
import { themeManager } from '../config/WidgetTheme';

interface StockPriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  volume: number;
  marketCap: number;
  high: number;
  low: number;
  timestamp: number;
  chartData?: ChartPoint[];
}

interface ChartPoint {
  timestamp: number;
  price: number;
}

interface StockPriceWidgetProps {
  instance: WidgetInstance;
  config: WidgetConfiguration;
  onError?: (error: Error) => void;
  onResize?: (width: number, height: number) => void;
  className?: string;
  embedded?: boolean;
}

export const StockPriceWidget: React.FC<StockPriceWidgetProps> = ({
  instance,
  config,
  onError,
  onResize,
  className = '',
  embedded = false
}) => {
  const [data, setData] = useState<StockPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Get configuration values
  const symbol = config.values.symbol || 'AAPL';
  const refreshInterval = config.values.refreshInterval || 5000;
  const showChart = config.values.showChart !== false;
  const chartPeriod = config.values.chartPeriod || '1D';

  /**
   * Fetch stock price data
   */
  const fetchStockData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would call your API
      const response = await fetch(`/api/v1/stocks/${symbol}/price`);

      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${symbol}`);
      }

      const stockData = await response.json();

      // Fetch chart data if enabled
      let chartData: ChartPoint[] = [];
      if (showChart) {
        try {
          const chartResponse = await fetch(
            `/api/v1/stocks/${symbol}/history?period=${chartPeriod}&interval=5m`
          );
          if (chartResponse.ok) {
            const chartJson = await chartResponse.json();
            chartData = chartJson.data || [];
          }
        } catch (chartError) {
          console.warn('Failed to fetch chart data:', chartError);
        }
      }

      const transformedData: StockPriceData = {
        symbol: stockData.symbol,
        price: stockData.price,
        change: stockData.change,
        changePercent: stockData.changePercent,
        previousClose: stockData.previousClose,
        volume: stockData.volume,
        marketCap: stockData.marketCap,
        high: stockData.high,
        low: stockData.low,
        timestamp: Date.now(),
        chartData
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
  }, [symbol, showChart, chartPeriod, onError]);

  // Initial data fetch
  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchStockData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStockData, refreshInterval]);

  // Apply theme
  const theme = themeManager.getTheme(config.theme);
  const themeVars = theme ? themeManager.createCSSVariables(config.theme) : {};

  /**
   * Format price with appropriate decimal places
   */
  const formatPrice = (price: number): string => {
    return price.toFixed(2);
  };

  /**
   * Format change percentage
   */
  const formatChangePercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  /**
   * Format large numbers (market cap, volume)
   */
  const formatLargeNumber = (num: number): string => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toString();
  };

  /**
   * Get time since last update
   */
  const getTimeSinceUpdate = (): string => {
    if (!lastUpdate) return '';
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return 'Over 1h ago';
  };

  if (loading && !data) {
    return (
      <div
        className={`stock-price-widget ${className}`}
        style={{ ...themeVars, width: instance.size.width, height: instance.size.height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading {symbol}...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={`stock-price-widget ${className}`}
        style={{ ...themeVars, width: instance.size.width, height: instance.size.height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-red-500 text-sm font-medium mb-1">Error</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {error || `Failed to load ${symbol}`}
            </div>
            <button
              onClick={fetchStockData}
              className="mt-2 px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPositive = data.change >= 0;
  const changeColor = isPositive
    ? 'var(--widget-color-bull, #22c55e)'
    : 'var(--widget-color-bear, #ef4444)';

  return (
    <motion.div
      className={`stock-price-widget bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}
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
              {data.symbol}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Stock Price
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">
              {getTimeSinceUpdate()}
            </div>
            {loading && (
              <div className="w-3 h-3 border border-gray-300 border-t-primary-500 rounded-full animate-spin mt-1"></div>
            )}
          </div>
        </div>
      </div>

      {/* Price Display */}
      <div className="p-3">
        <div className="text-center mb-3">
          <motion.div
            className="text-2xl font-bold text-gray-900 dark:text-white"
            animate={{ scale: loading ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            ${formatPrice(data.price)}
          </motion.div>
          <div
            className="text-sm font-medium flex items-center justify-center space-x-1"
            style={{ color: changeColor }}
          >
            <span>{isPositive ? '↗' : '↘'}</span>
            <span>{formatPrice(Math.abs(data.change))}</span>
            <span>({formatChangePercent(data.changePercent)})</span>
          </div>
        </div>

        {/* Mini Chart */}
        {showChart && data.chartData && data.chartData.length > 0 && (
          <div className="mb-3">
            <MiniChart
              data={data.chartData}
              color={changeColor}
              height={60}
            />
          </div>
        )}

        {/* Additional Data */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">High:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                ${formatPrice(data.high)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Low:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                ${formatPrice(data.low)}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Volume:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatLargeNumber(data.volume)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Mkt Cap:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                ${formatLargeNumber(data.marketCap)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {!embedded && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Updated: {new Date(data.timestamp).toLocaleTimeString()}</span>
            <span>Refresh: {refreshInterval / 1000}s</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Mini Chart Component
 */
interface MiniChartProps {
  data: ChartPoint[];
  color: string;
  height: number;
}

const MiniChart: React.FC<MiniChartProps> = ({ data, color, height }) => {
  if (!data || data.length === 0) return null;

  const minPrice = Math.min(...data.map(d => d.price));
  const maxPrice = Math.max(...data.map(d => d.price));
  const priceRange = maxPrice - minPrice || 1;

  const width = 200; // Fixed width for mini chart
  const padding = 4;

  // Generate SVG path
  const path = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * (width - 2 * padding) + padding;
      const y = ((maxPrice - point.price) / priceRange) * (height - 2 * padding) + padding;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate area path for fill
  const areaPath = [
    path,
    `L ${width - padding} ${height - padding}`,
    `L ${padding} ${height - padding}`,
    'Z'
  ].join(' ');

  return (
    <div className="relative">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Area fill */}
        <path
          d={areaPath}
          fill={color}
          fillOpacity={0.1}
        />

        {/* Price line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default StockPriceWidget;