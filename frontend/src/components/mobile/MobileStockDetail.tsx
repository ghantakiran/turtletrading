/**
 * Mobile Stock Detail View
 * Optimized for mobile with swipe navigation, touch charts, and comprehensive stock analysis
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useStockData } from '@/hooks/useStockData';
import { useMarketStore } from '@/stores';
import { formatCurrency, formatPercentage } from '@/utils/format';
import {
  ArrowLeftIcon,
  ShareIcon,
  HeartIcon,
  BellIcon,
  ChartBarIcon,
  InformationCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { useOnlineStatus } from '@/utils/pwa';

interface TabData {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
}

interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume: number;
}

type TimeFrame = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';

export const MobileStockDetail: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useMarketStore();

  const [activeTab, setActiveTab] = useState(0);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1D');
  const [isInWatchlistState, setIsInWatchlistState] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);

  // Mock data - in real app, would come from useStockData
  const stockData = {
    symbol: symbol || '',
    name: getCompanyName(symbol || ''),
    price: 156.78,
    change: 3.45,
    changePercent: 2.25,
    volume: 1234567,
    marketCap: 2500000000000,
    pe: 28.5,
    dayHigh: 158.90,
    dayLow: 153.20,
    yearHigh: 182.94,
    yearLow: 124.17,
    avgVolume: 75000000,
    lastUpdate: Date.now()
  };

  const isPositive = stockData.change >= 0;

  useEffect(() => {
    if (symbol) {
      setIsInWatchlistState(isInWatchlist(symbol));
    }
  }, [symbol, isInWatchlist]);

  // Helper function to get company name
  function getCompanyName(symbol: string): string {
    const names: Record<string, string> = {
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft Corporation',
      'GOOGL': 'Alphabet Inc.',
      'AMZN': 'Amazon.com Inc.',
      'TSLA': 'Tesla Inc.',
      'META': 'Meta Platforms Inc.',
      'NVDA': 'NVIDIA Corporation',
      'SPY': 'SPDR S&P 500 ETF'
    };
    return names[symbol] || `${symbol} Corp.`;
  }

  // Generate mock chart data
  const generateChartData = useCallback((timeFrame: TimeFrame): ChartDataPoint[] => {
    const now = Date.now();
    const intervals = {
      '1D': { count: 390, interval: 60000 }, // 1 minute intervals
      '1W': { count: 168, interval: 3600000 }, // 1 hour intervals
      '1M': { count: 30, interval: 86400000 }, // 1 day intervals
      '3M': { count: 90, interval: 86400000 },
      '1Y': { count: 252, interval: 86400000 },
      '5Y': { count: 1260, interval: 86400000 }
    };

    const { count, interval } = intervals[timeFrame];
    const data: ChartDataPoint[] = [];
    let price = stockData.price;

    for (let i = count; i >= 0; i--) {
      const timestamp = now - (i * interval);
      price += (Math.random() - 0.5) * 2; // Random walk
      price = Math.max(price, 1); // Ensure positive price

      data.push({
        timestamp,
        price,
        volume: Math.floor(Math.random() * 1000000) + 500000
      });
    }

    return data;
  }, [stockData.price]);

  const [chartData, setChartData] = useState<ChartDataPoint[]>(() => generateChartData(timeFrame));

  useEffect(() => {
    setChartData(generateChartData(timeFrame));
  }, [timeFrame, generateChartData]);

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;

    // Only trigger if horizontal swipe is more significant than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right - go to previous stock
        navigateToStock('previous');
      } else {
        // Swipe left - go to next stock
        navigateToStock('next');
      }
    }
  };

  const navigateToStock = (direction: 'previous' | 'next') => {
    // Mock stock symbols for navigation
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'];
    const currentIndex = symbols.indexOf(symbol || '');

    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % symbols.length;
    } else {
      nextIndex = currentIndex === 0 ? symbols.length - 1 : currentIndex - 1;
    }

    navigate(`/stock/${symbols[nextIndex]}`, { replace: true });
  };

  const handleWatchlistToggle = () => {
    if (!symbol) return;

    if (isInWatchlistState) {
      removeFromWatchlist(0, symbol);
      setIsInWatchlistState(false);
      toast.success(`${symbol} removed from watchlist`);
    } else {
      addToWatchlist(0, symbol);
      setIsInWatchlistState(true);
      toast.success(`${symbol} added to watchlist`);
    }

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `${stockData.symbol} - ${stockData.name}`,
      text: `Check out ${stockData.symbol} trading at ${formatCurrency(stockData.price)} (${formatPercentage(stockData.changePercent)})`,
      url: window.location.href
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      toast.error('Failed to share');
    }
  };

  // Tab components
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Price Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Price Chart
          </h3>
          <div className="flex space-x-1">
            {(['1D', '1W', '1M', '3M', '1Y', '5Y'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                  timeFrame === tf
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Simple chart representation */}
        <div className="h-48 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Chart for {timeFrame} timeframe
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Key Metrics
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Market Cap</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              ${(stockData.marketCap / 1e12).toFixed(2)}T
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">P/E Ratio</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {stockData.pe}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Day High</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatCurrency(stockData.dayHigh)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Day Low</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatCurrency(stockData.dayLow)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">52W High</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatCurrency(stockData.yearHigh)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">52W Low</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatCurrency(stockData.yearLow)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const TechnicalTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Technical Indicators
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">RSI (14)</span>
            <span className="font-semibold text-gray-900 dark:text-white">67.3</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">MACD</span>
            <span className="font-semibold text-bull-500">+2.45</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Moving Avg (50)</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(154.32)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const NewsTab = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
            Latest Market Update for {stockData.symbol}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit...
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Reuters</span>
            <span>2 hours ago</span>
          </div>
        </div>
      ))}
    </div>
  );

  const tabs: TabData[] = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon, component: OverviewTab },
    { id: 'technical', label: 'Technical', icon: TrendingUpIcon, component: TechnicalTab },
    { id: 'news', label: 'News', icon: InformationCircleIcon, component: NewsTab }
  ];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="flex items-center justify-between p-4">
          <motion.button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </motion.button>

          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {stockData.symbol}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate px-2">
              {stockData.name}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <motion.button
              onClick={handleWatchlistToggle}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700"
              whileTap={{ scale: 0.95 }}
            >
              {isInWatchlistState ? (
                <HeartSolidIcon className="w-5 h-5 text-red-500" />
              ) : (
                <HeartIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </motion.button>

            <motion.button
              onClick={handleShare}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              whileTap={{ scale: 0.95 }}
            >
              <ShareIcon className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Price Information */}
        <div className="p-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(stockData.price)}
              </div>
              <div className={`flex items-center space-x-2 ${
                isPositive ? 'text-bull-500' : 'text-bear-500'
              }`}>
                {isPositive ? (
                  <TrendingUpIcon className="w-4 h-4" />
                ) : (
                  <TrendingDownIcon className="w-4 h-4" />
                )}
                <span className="font-medium">
                  {formatCurrency(Math.abs(stockData.change))} ({formatPercentage(Math.abs(stockData.changePercent))})
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Volume: {(stockData.volume / 1000000).toFixed(1)}M
              </div>
              <div className="flex items-center justify-end space-x-1 text-xs text-gray-500">
                <ClockIcon className="w-3 h-3" />
                <span>
                  {!isOnline ? 'Cached data' : 'Real-time'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-gray-200 dark:border-gray-700">
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(index)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === index
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-center space-x-1">
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {React.createElement(tabs[activeTab].component)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Hint */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-1 rounded-full text-xs opacity-50">
        Swipe left/right to navigate stocks
      </div>

      {/* Alert Button */}
      <motion.button
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center z-30"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.1 }}
        onClick={() => toast.success('Price alert feature coming soon!')}
      >
        <BellIcon className="w-6 h-6" />
      </motion.button>
    </div>
  );
};

export default MobileStockDetail;