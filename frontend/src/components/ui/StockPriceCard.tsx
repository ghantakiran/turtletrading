import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StockPriceCardProps {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: string;
  peRatio?: number;
  high52Week?: number;
  low52Week?: number;
  dayHigh?: number;
  dayLow?: number;
  avgVolume?: number;
  dividend?: number;
  dividendYield?: number;
  size?: 'sm' | 'md' | 'lg';
  showChart?: boolean;
  chartData?: Array<{time: string, price: number}>;
}

const StockPriceCard: React.FC<StockPriceCardProps> = ({
  symbol,
  companyName,
  price,
  change,
  changePercent,
  volume,
  marketCap,
  peRatio,
  high52Week,
  low52Week,
  dayHigh,
  dayLow,
  avgVolume,
  dividend,
  dividendYield,
  size = 'md',
  showChart = false,
  chartData = []
}) => {
  const isPositive = change > 0;
  const isNeutral = change === 0;

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

  const getChangeIcon = () => {
    if (isPositive) return <TrendingUp className="w-4 h-4" />;
    if (isNeutral) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const getChangeColor = () => {
    if (isPositive) return 'text-bull-600 bg-bull-50 dark:text-bull-400 dark:bg-bull-900/20';
    if (isNeutral) return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800';
    return 'text-bear-600 bg-bear-50 dark:text-bear-400 dark:bg-bear-900/20';
  };

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
      shadow-lg hover:shadow-xl transition-all duration-300 ${sizeClasses[size]}
      hover:scale-[1.02] hover:border-primary-300 dark:hover:border-primary-600
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
            {symbol.slice(0, 2)}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {symbol}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
              {companyName}
            </p>
          </div>
        </div>

        {/* Real-time indicator */}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
        </div>
      </div>

      {/* Price Section */}
      <div className="mb-6">
        <div className="flex items-baseline space-x-4 mb-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            ${formatNumber(price)}
          </span>
          <div className={`
            flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold
            ${getChangeColor()}
          `}>
            {getChangeIcon()}
            <span>${formatNumber(Math.abs(change))}</span>
            <span>({formatNumber(Math.abs(changePercent))}%)</span>
          </div>
        </div>

        {/* Today's Range */}
        {dayLow && dayHigh && (
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Today's Range</span>
            <div className="flex items-center space-x-2 flex-1">
              <span>${formatNumber(dayLow)}</span>
              <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full relative">
                <div
                  className="absolute h-full bg-primary-500 rounded-full"
                  style={{
                    left: `${Math.max(0, ((price - dayLow) / (dayHigh - dayLow)) * 100 - 2)}%`,
                    width: '4px'
                  }}
                ></div>
              </div>
              <span>${formatNumber(dayHigh)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mini Chart */}
      {showChart && chartData.length > 0 && (
        <div className="mb-6">
          <div className="h-24 relative">
            <svg className="w-full h-full">
              <polyline
                fill="none"
                stroke={isPositive ? '#22c55e' : '#ef4444'}
                strokeWidth="2"
                points={chartData.map((point, index) => {
                  const x = (index / (chartData.length - 1)) * 100;
                  const minPrice = Math.min(...chartData.map(p => p.price));
                  const maxPrice = Math.max(...chartData.map(p => p.price));
                  const y = 100 - ((point.price - minPrice) / (maxPrice - minPrice)) * 100;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {volume && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Volume</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatVolume(volume)}
            </p>
          </div>
        )}

        {marketCap && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Market Cap</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {marketCap}
            </p>
          </div>
        )}

        {peRatio && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">P/E Ratio</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatNumber(peRatio)}
            </p>
          </div>
        )}

        {high52Week && low52Week && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">52W Range</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              ${formatNumber(low52Week)} - ${formatNumber(high52Week)}
            </p>
          </div>
        )}

        {dividend && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Dividend</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              ${formatNumber(dividend)} ({formatNumber(dividendYield || 0)}%)
            </p>
          </div>
        )}

        {avgVolume && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Volume</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatVolume(avgVolume)}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
          Trade
        </button>
        <button className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium">
          Add to Watchlist
        </button>
        <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default StockPriceCard;