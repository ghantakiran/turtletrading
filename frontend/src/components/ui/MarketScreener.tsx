import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  DollarSign,
  Percent,
  BarChart3,
  PieChart,
  Star,
  Plus,
  Download,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Eye,
  Heart,
  ExternalLink
} from 'lucide-react';

interface ScreenerStock {
  id: string;
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  peRatio: number;
  pbRatio: number;
  dividend: number;
  dividendYield: number;
  eps: number;
  beta: number;
  week52High: number;
  week52Low: number;
  rsi: number;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  analystRating: number;
  isWatched: boolean;
}

interface FilterCriteria {
  sector: string;
  marketCapMin: number;
  marketCapMax: number;
  priceMin: number;
  priceMax: number;
  peRatioMin: number;
  peRatioMax: number;
  dividendYieldMin: number;
  volumeMin: number;
  changeMin: number;
  changeMax: number;
  rsiMin: number;
  rsiMax: number;
}

interface MarketScreenerProps {
  stocks: ScreenerStock[];
  onWatchStock?: (symbol: string) => void;
  onViewStock?: (symbol: string) => void;
  onExportResults?: (results: ScreenerStock[]) => void;
}

const MarketScreener: React.FC<MarketScreenerProps> = ({
  stocks,
  onWatchStock,
  onViewStock,
  onExportResults
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [sortBy, setSortBy] = useState<keyof ScreenerStock>('marketCap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedPreset, setSelectedPreset] = useState<string>('all');

  const [filters, setFilters] = useState<FilterCriteria>({
    sector: 'all',
    marketCapMin: 0,
    marketCapMax: 10000000000000, // 10T
    priceMin: 0,
    priceMax: 10000,
    peRatioMin: 0,
    peRatioMax: 100,
    dividendYieldMin: 0,
    volumeMin: 0,
    changeMin: -100,
    changeMax: 100,
    rsiMin: 0,
    rsiMax: 100
  });

  const presets = [
    { id: 'all', name: 'All Stocks', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'large-cap', name: 'Large Cap', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'growth', name: 'Growth Stocks', icon: <Zap className="w-4 h-4" /> },
    { id: 'value', name: 'Value Stocks', icon: <Target className="w-4 h-4" /> },
    { id: 'dividend', name: 'Dividend Stocks', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'momentum', name: 'Momentum', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'oversold', name: 'Oversold (RSI < 30)', icon: <TrendingDown className="w-4 h-4" /> },
    { id: 'overbought', name: 'Overbought (RSI > 70)', icon: <TrendingUp className="w-4 h-4" /> }
  ];

  const sectors = ['all', ...Array.from(new Set(stocks.map(s => s.sector)))];

  const applyPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    switch (presetId) {
      case 'large-cap':
        setFilters(prev => ({ ...prev, marketCapMin: 10000000000 })); // 10B+
        break;
      case 'growth':
        setFilters(prev => ({ ...prev, peRatioMin: 20, changeMin: 5 }));
        break;
      case 'value':
        setFilters(prev => ({ ...prev, peRatioMax: 15, pbRatio: 1.5 }));
        break;
      case 'dividend':
        setFilters(prev => ({ ...prev, dividendYieldMin: 2 }));
        break;
      case 'momentum':
        setFilters(prev => ({ ...prev, changeMin: 10, rsiMin: 50 }));
        break;
      case 'oversold':
        setFilters(prev => ({ ...prev, rsiMax: 30 }));
        break;
      case 'overbought':
        setFilters(prev => ({ ...prev, rsiMin: 70 }));
        break;
      default:
        setFilters({
          sector: 'all',
          marketCapMin: 0,
          marketCapMax: 10000000000000,
          priceMin: 0,
          priceMax: 10000,
          peRatioMin: 0,
          peRatioMax: 100,
          dividendYieldMin: 0,
          volumeMin: 0,
          changeMin: -100,
          changeMax: 100,
          rsiMin: 0,
          rsiMax: 100
        });
    }
  };

  const filteredStocks = useMemo(() => {
    let filtered = stocks.filter(stock => {
      // Search filter
      const matchesSearch = searchTerm === '' ||
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.companyName.toLowerCase().includes(searchTerm.toLowerCase());

      // Apply all filters
      return matchesSearch &&
        (filters.sector === 'all' || stock.sector === filters.sector) &&
        stock.marketCap >= filters.marketCapMin &&
        stock.marketCap <= filters.marketCapMax &&
        stock.price >= filters.priceMin &&
        stock.price <= filters.priceMax &&
        stock.peRatio >= filters.peRatioMin &&
        stock.peRatio <= filters.peRatioMax &&
        stock.dividendYield >= filters.dividendYieldMin &&
        stock.volume >= filters.volumeMin &&
        stock.changePercent >= filters.changeMin &&
        stock.changePercent <= filters.changeMax &&
        stock.rsi >= filters.rsiMin &&
        stock.rsi <= filters.rsiMax;
    });

    // Sort results
    return filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;

      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [stocks, searchTerm, filters, sortBy, sortOrder]);

  const formatCurrency = (amount: number): string => {
    if (amount >= 1e12) return `$${(amount / 1e12).toFixed(1)}T`;
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const formatVolume = (vol: number): string => {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
    return vol.toString();
  };

  const getRecommendationColor = (recommendation: string): string => {
    switch (recommendation) {
      case 'Strong Buy': return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'Buy': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/10';
      case 'Hold': return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/10';
      case 'Sell': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/10';
      case 'Strong Sell': return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-700';
    }
  };

  const handleSort = (field: keyof ScreenerStock) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <SlidersHorizontal className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Stock Screener</h2>
              <p className="text-primary-100">
                {filteredStocks.length} stocks match your criteria
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onExportResults?.(filteredStocks)}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
            <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
          <input
            type="text"
            placeholder="Search stocks by symbol or company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
      </div>

      {/* Presets */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Quick Filters
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>{showFilters ? 'Hide' : 'Show'} Advanced Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPreset === preset.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {preset.icon}
              <span className="hidden sm:inline">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Advanced Filters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Sector Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sector
              </label>
              <select
                value={filters.sector}
                onChange={(e) => setFilters(prev => ({ ...prev, sector: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {sectors.map(sector => (
                  <option key={sector} value={sector}>
                    {sector === 'all' ? 'All Sectors' : sector}
                  </option>
                ))}
              </select>
            </div>

            {/* Market Cap Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Market Cap (Min)
              </label>
              <select
                value={filters.marketCapMin}
                onChange={(e) => setFilters(prev => ({ ...prev, marketCapMin: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value={0}>Any</option>
                <option value={300000000}>$300M+ (Small Cap)</option>
                <option value={2000000000}>$2B+ (Mid Cap)</option>
                <option value={10000000000}>$10B+ (Large Cap)</option>
                <option value={200000000000}>$200B+ (Mega Cap)</option>
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price Range ($)
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.priceMin || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceMin: Number(e.target.value) || 0 }))}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.priceMax === 10000 ? '' : filters.priceMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceMax: Number(e.target.value) || 10000 }))}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* P/E Ratio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                P/E Ratio (Max)
              </label>
              <input
                type="number"
                placeholder="Max P/E"
                value={filters.peRatioMax === 100 ? '' : filters.peRatioMax}
                onChange={(e) => setFilters(prev => ({ ...prev, peRatioMax: Number(e.target.value) || 100 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Dividend Yield */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Dividend Yield (%)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Min Yield"
                value={filters.dividendYieldMin || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, dividendYieldMin: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Change Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Day Change (%)
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.changeMin === -100 ? '' : filters.changeMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, changeMin: Number(e.target.value) || -100 }))}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.changeMax === 100 ? '' : filters.changeMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, changeMax: Number(e.target.value) || 100 }))}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* RSI Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                RSI Range
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.rsiMin || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, rsiMin: Number(e.target.value) || 0 }))}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.rsiMax === 100 ? '' : filters.rsiMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, rsiMax: Number(e.target.value) || 100 }))}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Volume Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Volume
              </label>
              <select
                value={filters.volumeMin}
                onChange={(e) => setFilters(prev => ({ ...prev, volumeMin: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value={0}>Any Volume</option>
                <option value={100000}>100K+</option>
                <option value={500000}>500K+</option>
                <option value={1000000}>1M+</option>
                <option value={5000000}>5M+</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('symbol')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Symbol</span>
                  {sortBy === 'symbol' && (
                    sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('price')}
                  className="flex items-center justify-end space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Price</span>
                  {sortBy === 'price' && (
                    sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('changePercent')}
                  className="flex items-center justify-end space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Change</span>
                  {sortBy === 'changePercent' && (
                    sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('marketCap')}
                  className="flex items-center justify-end space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Market Cap</span>
                  {sortBy === 'marketCap' && (
                    sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('peRatio')}
                  className="flex items-center justify-end space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>P/E</span>
                  {sortBy === 'peRatio' && (
                    sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('dividendYield')}
                  className="flex items-center justify-end space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Div Yield</span>
                  {sortBy === 'dividendYield' && (
                    sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('volume')}
                  className="flex items-center justify-end space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Volume</span>
                  {sortBy === 'volume' && (
                    sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-center">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rating
                </span>
              </th>
              <th className="px-6 py-3 text-center">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredStocks.map((stock) => (
              <tr
                key={stock.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      {stock.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {stock.symbol}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                        {stock.companyName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {stock.sector}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    ${stock.price.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`font-medium ${stock.change >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'}`}>
                    {stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}
                  </div>
                  <div className={`text-sm ${stock.changePercent >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-gray-900 dark:text-gray-100">
                    {formatCurrency(stock.marketCap)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-gray-900 dark:text-gray-100">
                    {stock.peRatio.toFixed(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-gray-900 dark:text-gray-100">
                    {stock.dividendYield.toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-gray-900 dark:text-gray-100">
                    {formatVolume(stock.volume)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRecommendationColor(stock.recommendation)}`}>
                    {stock.recommendation}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => onWatchStock?.(stock.symbol)}
                      className={`p-1 rounded transition-colors ${
                        stock.isWatched
                          ? 'text-yellow-500 hover:text-yellow-600'
                          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
                    >
                      {stock.isWatched ? <Star className="w-4 h-4 fill-current" /> : <Star className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => onViewStock?.(stock.symbol)}
                      className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Showing {filteredStocks.length} stocks</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Real-time data</span>
            </div>
          </div>
          <div>
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketScreener;