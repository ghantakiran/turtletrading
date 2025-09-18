import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Info,
  Filter,
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
  Eye,
  Calendar
} from 'lucide-react';

interface SectorData {
  sector: string;
  displayName: string;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  avgChange1Week: number;
  avgChange1Month: number;
  avgChange3Month: number;
  topStocks: {
    symbol: string;
    name: string;
    change: number;
    changePercent: number;
    marketCap: number;
  }[];
  description: string;
  icon: string;
}

interface SectorHeatmapProps {
  sectors: SectorData[];
  timeframe: 'day' | '1W' | '1M' | '3M';
  onTimeframeChange?: (timeframe: 'day' | '1W' | '1M' | '3M') => void;
  onSectorClick?: (sector: SectorData) => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

const SectorHeatmap: React.FC<SectorHeatmapProps> = ({
  sectors,
  timeframe,
  onTimeframeChange,
  onSectorClick,
  onRefresh,
  onExport
}) => {
  const [selectedSector, setSelectedSector] = useState<SectorData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooltipSector, setTooltipSector] = useState<SectorData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const getPerformanceValue = (sector: SectorData): number => {
    switch (timeframe) {
      case '1W': return sector.avgChange1Week;
      case '1M': return sector.avgChange1Month;
      case '3M': return sector.avgChange3Month;
      default: return sector.changePercent;
    }
  };

  const sortedSectors = useMemo(() => {
    return [...sectors].sort((a, b) => {
      const aValue = getPerformanceValue(a);
      const bValue = getPerformanceValue(b);
      return bValue - aValue; // Sort by performance descending
    });
  }, [sectors, timeframe]);

  const maxAbsChange = useMemo(() => {
    return Math.max(...sortedSectors.map(s => Math.abs(getPerformanceValue(s))));
  }, [sortedSectors, timeframe]);

  const getHeatmapColor = (changePercent: number): string => {
    const intensity = Math.min(Math.abs(changePercent) / maxAbsChange, 1);

    if (changePercent > 0) {
      // Green gradient for positive
      if (intensity > 0.8) return 'bg-green-600 text-white';
      if (intensity > 0.6) return 'bg-green-500 text-white';
      if (intensity > 0.4) return 'bg-green-400 text-white';
      if (intensity > 0.2) return 'bg-green-300 text-gray-900';
      return 'bg-green-100 text-gray-900';
    } else if (changePercent < 0) {
      // Red gradient for negative
      if (intensity > 0.8) return 'bg-red-600 text-white';
      if (intensity > 0.6) return 'bg-red-500 text-white';
      if (intensity > 0.4) return 'bg-red-400 text-white';
      if (intensity > 0.2) return 'bg-red-300 text-gray-900';
      return 'bg-red-100 text-gray-900';
    } else {
      return 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 1e12) return `$${(amount / 1e12).toFixed(1)}T`;
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    return `$${amount.toLocaleString()}`;
  };

  const formatVolume = (vol: number): string => {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
    return vol.toString();
  };

  const handleSectorHover = (sector: SectorData, event: React.MouseEvent) => {
    setTooltipSector(sector);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  const handleSectorLeave = () => {
    setTooltipSector(null);
  };

  const handleSectorClick = (sector: SectorData) => {
    setSelectedSector(sector);
    onSectorClick?.(sector);
  };

  // Calculate grid dimensions based on number of sectors
  const gridCols = Math.ceil(Math.sqrt(sortedSectors.length));
  const gridRows = Math.ceil(sortedSectors.length / gridCols);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden ${
      isFullscreen ? 'fixed inset-4 z-50' : ''
    }`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Sector Performance Heatmap</h2>
              <p className="text-orange-100">
                {timeframe === 'day' ? 'Today' : timeframe} performance • {sortedSectors.length} sectors
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onExport}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm text-orange-100">Best Performer</span>
            </div>
            <div className="text-lg font-bold">{sortedSectors[0]?.displayName || 'N/A'}</div>
            <div className="text-sm text-orange-200">
              +{getPerformanceValue(sortedSectors[0] || {} as SectorData).toFixed(2)}%
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingDown className="w-5 h-5" />
              <span className="text-sm text-orange-100">Worst Performer</span>
            </div>
            <div className="text-lg font-bold">{sortedSectors[sortedSectors.length - 1]?.displayName || 'N/A'}</div>
            <div className="text-sm text-orange-200">
              {getPerformanceValue(sortedSectors[sortedSectors.length - 1] || {} as SectorData).toFixed(2)}%
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm text-orange-100">Positive Sectors</span>
            </div>
            <div className="text-2xl font-bold">
              {sortedSectors.filter(s => getPerformanceValue(s) > 0).length}
            </div>
            <div className="text-sm text-orange-200">
              of {sortedSectors.length}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-5 h-5" />
              <span className="text-sm text-orange-100">Avg Change</span>
            </div>
            <div className="text-2xl font-bold">
              {(sortedSectors.reduce((sum, s) => sum + getPerformanceValue(s), 0) / sortedSectors.length).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Timeframe Controls */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Timeframe:</span>
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['day', '1W', '1M', '3M'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => onTimeframeChange?.(period)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    timeframe === period
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {period === 'day' ? 'Today' : period}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Performance Scale:</span>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 bg-red-600 rounded"></div>
                <span className="text-xs">Worst</span>
                <div className="w-4 h-4 bg-red-300 rounded"></div>
                <div className="w-4 h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                <div className="w-4 h-4 bg-green-300 rounded"></div>
                <div className="w-4 h-4 bg-green-600 rounded"></div>
                <span className="text-xs">Best</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="p-6">
        <div
          className={`grid gap-3 ${
            isFullscreen
              ? `grid-cols-${Math.min(gridCols + 2, 8)}`
              : `grid-cols-${Math.min(gridCols, 4)}`
          }`}
          style={{
            gridTemplateColumns: `repeat(${isFullscreen ? Math.min(gridCols + 2, 8) : Math.min(gridCols, 4)}, minmax(0, 1fr))`
          }}
        >
          {sortedSectors.map((sector) => {
            const performance = getPerformanceValue(sector);
            const isSelected = selectedSector?.sector === sector.sector;

            return (
              <div
                key={sector.sector}
                className={`
                  relative p-4 rounded-xl cursor-pointer transition-all duration-300 transform
                  ${getHeatmapColor(performance)}
                  ${isSelected ? 'ring-4 ring-primary-500 scale-105' : 'hover:scale-102 hover:shadow-lg'}
                  min-h-[120px] flex flex-col justify-between
                `}
                onClick={() => handleSectorClick(sector)}
                onMouseEnter={(e) => handleSectorHover(sector, e)}
                onMouseLeave={handleSectorLeave}
              >
                {/* Sector Icon & Name */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-2xl mb-1">{sector.icon}</div>
                    <h3 className={`font-bold text-sm leading-tight ${
                      Math.abs(performance) > 0.4 ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {sector.displayName}
                    </h3>
                  </div>
                  {sector.topStocks.length > 0 && (
                    <div className={`text-xs opacity-75 ${
                      Math.abs(performance) > 0.4 ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {sector.topStocks.length} stocks
                    </div>
                  )}
                </div>

                {/* Performance Metrics */}
                <div className="space-y-1">
                  <div className={`text-xl font-bold ${
                    Math.abs(performance) > 0.4 ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {performance >= 0 ? '+' : ''}{performance.toFixed(2)}%
                  </div>

                  <div className={`text-xs ${
                    Math.abs(performance) > 0.4 ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    Market Cap: {formatCurrency(sector.marketCap)}
                  </div>

                  <div className={`text-xs ${
                    Math.abs(performance) > 0.4 ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    Volume: {formatVolume(sector.volume)}
                  </div>
                </div>

                {/* Performance Indicator */}
                <div className={`absolute top-2 right-2 ${
                  Math.abs(performance) > 0.4 ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {performance > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : performance < 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : (
                    <div className="w-4 h-1 bg-current rounded opacity-50"></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Sector Details */}
      {selectedSector && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {selectedSector.icon} {selectedSector.displayName}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {selectedSector.description}
              </p>
            </div>
            <button
              onClick={() => setSelectedSector(null)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>

          {/* Performance Timeline */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Today</div>
              <div className={`text-lg font-bold ${
                selectedSector.changePercent >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'
              }`}>
                {selectedSector.changePercent >= 0 ? '+' : ''}{selectedSector.changePercent.toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">1 Week</div>
              <div className={`text-lg font-bold ${
                selectedSector.avgChange1Week >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'
              }`}>
                {selectedSector.avgChange1Week >= 0 ? '+' : ''}{selectedSector.avgChange1Week.toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">1 Month</div>
              <div className={`text-lg font-bold ${
                selectedSector.avgChange1Month >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'
              }`}>
                {selectedSector.avgChange1Month >= 0 ? '+' : ''}{selectedSector.avgChange1Month.toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">3 Months</div>
              <div className={`text-lg font-bold ${
                selectedSector.avgChange3Month >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'
              }`}>
                {selectedSector.avgChange3Month >= 0 ? '+' : ''}{selectedSector.avgChange3Month.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Top Stocks */}
          {selectedSector.topStocks.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Top Performing Stocks
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedSector.topStocks.slice(0, 6).map((stock) => (
                  <div
                    key={stock.symbol}
                    className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {stock.symbol}
                      </span>
                      <span className={`text-sm font-medium ${
                        stock.changePercent >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'
                      }`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {stock.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {formatCurrency(stock.marketCap)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltipSector && (
        <div
          className="fixed z-50 bg-gray-900 text-white p-3 rounded-lg shadow-xl pointer-events-none max-w-xs"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-semibold text-sm mb-1">
            {tooltipSector.displayName}
          </div>
          <div className="text-xs text-gray-300 mb-2">
            {tooltipSector.description}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">Change:</span>
              <span className={`ml-1 font-medium ${
                getPerformanceValue(tooltipSector) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {getPerformanceValue(tooltipSector) >= 0 ? '+' : ''}{getPerformanceValue(tooltipSector).toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-gray-400">Stocks:</span>
              <span className="ml-1">{tooltipSector.topStocks.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>{sortedSectors.length} sectors displayed</span>
            <span>
              {sortedSectors.filter(s => getPerformanceValue(s) > 0).length} positive, {' '}
              {sortedSectors.filter(s => getPerformanceValue(s) < 0).length} negative
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live data</span>
            </div>
            <span>Updated: {new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectorHeatmap;