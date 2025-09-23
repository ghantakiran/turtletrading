/**
 * Mobile Watchlist Component
 * Optimized for mobile with swipe gestures, pull-to-refresh, and touch interactions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useMarketStore } from '@/stores';
import { useStockData } from '@/hooks/useStockData';
import { formatCurrency, formatPercentage } from '@/utils/format';
import {
  PlusIcon,
  TrashIcon,
  StarIcon,
  ChartBarIcon,
  BellIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '@/utils/pwa';

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  isFavorite: boolean;
  alerts: number;
}

interface SwipeState {
  x: number;
  isDragging: boolean;
  swipeDirection: 'left' | 'right' | null;
}

export const MobileWatchlist: React.FC = () => {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { watchlists, addToWatchlist, removeFromWatchlist, updateWatchlist } = useMarketStore();

  const [selectedWatchlist, setSelectedWatchlist] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [swipeStates, setSwipeStates] = useState<Map<string, SwipeState>>(new Map());
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // Refs for touch handling
  const containerRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const lastRefresh = useRef(Date.now());

  // Current watchlist data
  const currentWatchlist = watchlists[selectedWatchlist] || { symbols: [] };
  const watchlistItems: WatchlistItem[] = currentWatchlist.symbols.map(symbol => ({
    symbol,
    name: getCompanyName(symbol),
    price: 150.25, // Mock data - would come from useStockData
    change: 2.35,
    changePercent: 1.58,
    volume: 1234567,
    isFavorite: false,
    alerts: 0
  }));

  const filteredItems = watchlistItems.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // Pull to refresh handler
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || containerRef.current?.scrollTop !== 0) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - pullStartY.current);

    if (distance > 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance, 120)); // Max pull distance
    }
  }, [isPulling]);

  const handleTouchEnd = useCallback(() => {
    if (isPulling && pullDistance > 60) {
      handleRefresh();
    }
    setIsPulling(false);
    setPullDistance(0);
  }, [isPulling, pullDistance]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleRefresh = async () => {
    // Prevent too frequent refreshes
    if (Date.now() - lastRefresh.current < 2000) return;

    setIsRefreshing(true);
    lastRefresh.current = Date.now();

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Watchlist updated');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwipe = (symbol: string, direction: 'left' | 'right') => {
    if (direction === 'left') {
      // Show delete action
      setSwipeStates(prev => new Map(prev.set(symbol, {
        x: -80,
        isDragging: false,
        swipeDirection: 'left'
      })));
    } else if (direction === 'right') {
      // Show favorite action
      setSwipeStates(prev => new Map(prev.set(symbol, {
        x: 80,
        isDragging: false,
        swipeDirection: 'right'
      })));
    }
  };

  const resetSwipe = (symbol: string) => {
    setSwipeStates(prev => new Map(prev.set(symbol, {
      x: 0,
      isDragging: false,
      swipeDirection: null
    })));
  };

  const handlePan = (symbol: string, info: PanInfo) => {
    const { offset } = info;
    setSwipeStates(prev => new Map(prev.set(symbol, {
      x: Math.max(-100, Math.min(100, offset.x)),
      isDragging: true,
      swipeDirection: null
    })));
  };

  const handlePanEnd = (symbol: string, info: PanInfo) => {
    const { offset, velocity } = info;
    const threshold = 50;
    const swipeVelocity = Math.abs(velocity.x);

    if (Math.abs(offset.x) > threshold || swipeVelocity > 500) {
      handleSwipe(symbol, offset.x < 0 ? 'left' : 'right');
    } else {
      resetSwipe(symbol);
    }
  };

  const handleDeleteStock = (symbol: string) => {
    removeFromWatchlist(selectedWatchlist, symbol);
    resetSwipe(symbol);
    toast.success(`${symbol} removed from watchlist`);
  };

  const handleToggleFavorite = (symbol: string) => {
    // Implementation would update favorite status
    resetSwipe(symbol);
    toast.success(`${symbol} ${Math.random() > 0.5 ? 'added to' : 'removed from'} favorites`);
  };

  const handleStockPress = (symbol: string) => {
    // Reset any open swipes first
    resetSwipe(symbol);

    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    navigate(`/stock/${symbol}`);
  };

  const renderWatchlistItem = (item: WatchlistItem) => {
    const swipeState = swipeStates.get(item.symbol) || { x: 0, isDragging: false, swipeDirection: null };
    const isPositive = item.change >= 0;

    return (
      <motion.div
        key={item.symbol}
        className="relative overflow-hidden"
        layout
      >
        {/* Background Actions */}
        <div className="absolute inset-0 flex items-center justify-between">
          {/* Left Action (Favorite) */}
          <motion.div
            className="flex items-center justify-center w-20 h-full bg-yellow-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: swipeState.swipeDirection === 'right' ? 1 : 0 }}
          >
            <StarSolidIcon className="w-6 h-6 text-white" />
          </motion.div>

          {/* Right Action (Delete) */}
          <motion.div
            className="flex items-center justify-center w-20 h-full bg-red-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: swipeState.swipeDirection === 'left' ? 1 : 0 }}
          >
            <TrashIcon className="w-6 h-6 text-white" />
          </motion.div>
        </div>

        {/* Main Item */}
        <motion.div
          className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 relative z-10"
          animate={{ x: swipeState.x }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onPan={(_, info) => handlePan(item.symbol, info)}
          onPanEnd={(_, info) => handlePanEnd(item.symbol, info)}
          onTap={() => handleStockPress(item.symbol)}
          drag="x"
          dragConstraints={{ left: -100, right: 100 }}
          dragElastic={0.2}
        >
          <div className="p-4 flex items-center justify-between">
            {/* Stock Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                  {item.symbol}
                </h3>
                {item.alerts > 0 && (
                  <div className="flex items-center space-x-1">
                    <BellIcon className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs text-yellow-500">{item.alerts}</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {item.name}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-gray-500">
                  Vol: {(item.volume / 1000000).toFixed(1)}M
                </span>
                {!isOnline && (
                  <span className="text-xs text-orange-500 bg-orange-100 dark:bg-orange-900 px-2 py-0.5 rounded">
                    Cached
                  </span>
                )}
              </div>
            </div>

            {/* Price Info */}
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(item.price)}
              </div>
              <div className={`text-sm font-medium flex items-center justify-end space-x-1 ${
                isPositive ? 'text-bull-500' : 'text-bear-500'
              }`}>
                <span>{isPositive ? '↗' : '↘'}</span>
                <span>{formatCurrency(Math.abs(item.change))}</span>
                <span>({formatPercentage(Math.abs(item.changePercent))})</span>
              </div>
            </div>
          </div>

          {/* Quick Actions on Long Press */}
          <div className="absolute bottom-2 right-2 opacity-60">
            <ChartBarIcon className="w-4 h-4 text-gray-400" />
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        {/* Pull to Refresh Indicator */}
        <AnimatePresence>
          {isPulling && (
            <motion.div
              className="flex items-center justify-center py-2 bg-primary-50 dark:bg-primary-900"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: Math.min(pullDistance, 40),
                opacity: pullDistance > 30 ? 1 : 0.5
              }}
              exit={{ height: 0, opacity: 0 }}
            >
              <motion.div
                animate={{
                  rotate: pullDistance > 60 ? 180 : 0,
                  scale: pullDistance > 60 ? 1.2 : 1
                }}
                className="text-primary-600 dark:text-primary-400"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </motion.div>
              <span className="ml-2 text-sm text-primary-600 dark:text-primary-400">
                {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Title and Search */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Watchlists
            </h1>
            <div className="flex items-center space-x-2">
              <motion.button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                whileTap={{ scale: 0.95 }}
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </motion.button>
              <motion.button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 disabled:opacity-50"
                whileTap={{ scale: 0.95 }}
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0 }}
              >
                <ArrowPathIcon className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Search Bar */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-3"
              >
                <input
                  type="text"
                  placeholder="Search stocks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Watchlist Tabs */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {watchlists.map((list, index) => (
              <motion.button
                key={index}
                onClick={() => setSelectedWatchlist(index)}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedWatchlist === index
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                {list.name || `List ${index + 1}`}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        {/* Stock List */}
        <AnimatePresence>
          {filteredItems.length > 0 ? (
            <motion.div layout>
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.symbol}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {renderWatchlistItem(item)}
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 px-4"
            >
              <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <StarIcon className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No stocks found' : 'No stocks in watchlist'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Add some stocks to get started with tracking your investments'
                }
              </p>
              {!searchQuery && (
                <motion.button
                  onClick={() => navigate('/market')}
                  className="btn-primary flex items-center space-x-2"
                  whileTap={{ scale: 0.95 }}
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Browse Stocks</span>
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Add Button */}
      <motion.button
        onClick={() => navigate('/market')}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center z-30"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.1 }}
        animate={{
          boxShadow: ['0 4px 12px rgba(14, 165, 233, 0.3)', '0 8px 24px rgba(14, 165, 233, 0.4)', '0 4px 12px rgba(14, 165, 233, 0.3)']
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <PlusIcon className="w-6 h-6" />
      </motion.button>

      {/* Action Confirmation Toast */}
      <AnimatePresence>
        {swipeStates.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 left-4 right-4 bg-gray-900 dark:bg-gray-100 rounded-lg p-3 flex items-center justify-between z-40"
          >
            <span className="text-white dark:text-gray-900 text-sm">
              Swipe left to delete, right to favorite
            </span>
            <button
              onClick={() => setSwipeStates(new Map())}
              className="text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-gray-900"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileWatchlist;