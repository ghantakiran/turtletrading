import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Flame, Eye, Volume2 } from 'lucide-react';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  trend: 'up' | 'down' | 'neutral';
  category: 'trending' | 'gainer' | 'loser' | 'active' | 'watched';
}

interface TrendingStocksCarouselProps {
  stocks: StockData[];
  title?: string;
  category?: 'trending' | 'gainers' | 'losers' | 'most-active' | 'most-watched';
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

const TrendingStocksCarousel: React.FC<TrendingStocksCarouselProps> = ({
  stocks,
  title,
  category = 'trending',
  autoPlay = false,
  autoPlayInterval = 5000
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemsPerView = 4;

  useEffect(() => {
    if (!autoPlay || isHovered) return;

    const interval = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, isHovered, currentIndex]);

  const nextSlide = () => {
    setCurrentIndex(prev =>
      prev + itemsPerView >= stocks.length ? 0 : prev + itemsPerView
    );
  };

  const prevSlide = () => {
    setCurrentIndex(prev =>
      prev === 0 ? Math.max(0, stocks.length - itemsPerView) : Math.max(0, prev - itemsPerView)
    );
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'gainers':
        return <TrendingUp className="w-5 h-5 text-bull-500" />;
      case 'losers':
        return <TrendingDown className="w-5 h-5 text-bear-500" />;
      case 'most-active':
        return <Volume2 className="w-5 h-5 text-blue-500" />;
      case 'most-watched':
        return <Eye className="w-5 h-5 text-purple-500" />;
      default:
        return <Flame className="w-5 h-5 text-orange-500" />;
    }
  };

  const getCategoryColor = () => {
    switch (category) {
      case 'gainers':
        return 'from-bull-500 to-bull-600';
      case 'losers':
        return 'from-bear-500 to-bear-600';
      case 'most-active':
        return 'from-blue-500 to-blue-600';
      case 'most-watched':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-orange-500 to-orange-600';
    }
  };

  const getDefaultTitle = () => {
    switch (category) {
      case 'gainers':
        return 'Top Gainers';
      case 'losers':
        return 'Top Losers';
      case 'most-active':
        return 'Most Active';
      case 'most-watched':
        return 'Most Watched';
      default:
        return 'Trending Now';
    }
  };

  const formatNumber = (num: number, decimals = 2): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const formatVolume = (vol: number): string => {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
    return vol.toString();
  };

  const visibleStocks = stocks.slice(currentIndex, currentIndex + itemsPerView);

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${getCategoryColor()} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getCategoryIcon()}
            <h2 className="text-2xl font-bold">{title || getDefaultTitle()}</h2>
            <div className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
              {stocks.length} stocks
            </div>
          </div>

          {/* Navigation Dots */}
          <div className="flex items-center space-x-2">
            {Array.from({ length: Math.ceil(stocks.length / itemsPerView) }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index * itemsPerView)}
                className={`w-2 h-2 rounded-full transition-all ${
                  Math.floor(currentIndex / itemsPerView) === index
                    ? 'bg-white'
                    : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative">
        {/* Navigation Buttons */}
        <button
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className={`
            absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full
            bg-white dark:bg-gray-700 shadow-lg border border-gray-200 dark:border-gray-600
            flex items-center justify-center transition-all hover:scale-110
            ${currentIndex === 0
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-600'
            }
          `}
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        <button
          onClick={nextSlide}
          disabled={currentIndex + itemsPerView >= stocks.length}
          className={`
            absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full
            bg-white dark:bg-gray-700 shadow-lg border border-gray-200 dark:border-gray-600
            flex items-center justify-center transition-all hover:scale-110
            ${currentIndex + itemsPerView >= stocks.length
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-600'
            }
          `}
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Stocks Grid */}
        <div
          ref={scrollContainerRef}
          className="p-6 overflow-hidden"
        >
          <div className="grid grid-cols-4 gap-4">
            {visibleStocks.map((stock, index) => (
              <div
                key={`${stock.symbol}-${index}`}
                className="group cursor-pointer"
              >
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all hover:shadow-lg hover:scale-105 bg-gray-50 dark:bg-gray-700/50">
                  {/* Stock Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold
                        bg-gradient-to-r ${getCategoryColor()}
                      `}>
                        {stock.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                          {stock.symbol}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[80px]">
                          {stock.name}
                        </p>
                      </div>
                    </div>

                    {/* Trend Indicator */}
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center
                      ${stock.change > 0 ? 'bg-bull-100 dark:bg-bull-900/20' : ''}
                      ${stock.change < 0 ? 'bg-bear-100 dark:bg-bear-900/20' : ''}
                      ${stock.change === 0 ? 'bg-gray-100 dark:bg-gray-800' : ''}
                    `}>
                      {stock.change > 0 && <TrendingUp className="w-3 h-3 text-bull-600" />}
                      {stock.change < 0 && <TrendingDown className="w-3 h-3 text-bear-600" />}
                      {stock.change === 0 && <div className="w-2 h-0.5 bg-gray-400 rounded"></div>}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-2">
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      ${formatNumber(stock.price)}
                    </p>
                    <div className={`
                      flex items-center space-x-1 text-sm font-medium
                      ${stock.change > 0 ? 'text-bull-600 dark:text-bull-400' : ''}
                      ${stock.change < 0 ? 'text-bear-600 dark:text-bear-400' : ''}
                      ${stock.change === 0 ? 'text-gray-600 dark:text-gray-400' : ''}
                    `}>
                      <span>{stock.change > 0 ? '+' : ''}${formatNumber(stock.change)}</span>
                      <span>({formatNumber(Math.abs(stock.changePercent))}%)</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Volume:</span>
                      <span className="font-medium">{formatVolume(stock.volume)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Market Cap:</span>
                      <span className="font-medium">{stock.marketCap}</span>
                    </div>
                  </div>

                  {/* Hover Actions */}
                  <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex space-x-1">
                      <button className="flex-1 px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 transition-colors">
                        View
                      </button>
                      <button className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        +Watch
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auto-play indicator */}
      {autoPlay && (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Auto-updating every {autoPlayInterval / 1000}s</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendingStocksCarousel;