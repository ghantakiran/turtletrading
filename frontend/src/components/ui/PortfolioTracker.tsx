import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  PieChart,
  BarChart3,
  DollarSign,
  Percent,
  Target,
  AlertTriangle,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Filter,
  Download,
  Settings,
  Calendar,
  Clock
} from 'lucide-react';

interface PortfolioHolding {
  id: string;
  symbol: string;
  companyName: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  weight: number;
  lastUpdated: Date;
  sector: string;
}

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercent: number;
  dayChange: number;
  dayChangePercent: number;
  cashBalance: number;
  dividendYield: number;
  positions: number;
}

interface PortfolioTrackerProps {
  portfolioName?: string;
  summary: PortfolioSummary;
  holdings: PortfolioHolding[];
  onAddPosition?: () => void;
  onEditPosition?: (holding: PortfolioHolding) => void;
  onRemovePosition?: (holdingId: string) => void;
  showAnalysis?: boolean;
}

const PortfolioTracker: React.FC<PortfolioTrackerProps> = ({
  portfolioName = "My Portfolio",
  summary,
  holdings,
  onAddPosition,
  onEditPosition,
  onRemovePosition,
  showAnalysis = true
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState<'symbol' | 'value' | 'return' | 'change'>('value');
  const [filterSector, setFilterSector] = useState<string>('all');

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change: number): string => {
    if (change > 0) return 'text-bull-600 dark:text-bull-400';
    if (change < 0) return 'text-bear-600 dark:text-bear-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getChangeBgColor = (change: number): string => {
    if (change > 0) return 'bg-bull-50 dark:bg-bull-900/20';
    if (change < 0) return 'bg-bear-50 dark:bg-bear-900/20';
    return 'bg-gray-50 dark:bg-gray-800';
  };

  const sectors = ['all', ...Array.from(new Set(holdings.map(h => h.sector)))];

  const filteredHoldings = holdings
    .filter(holding => filterSector === 'all' || holding.sector === filterSector)
    .sort((a, b) => {
      switch (sortBy) {
        case 'symbol':
          return a.symbol.localeCompare(b.symbol);
        case 'value':
          return b.marketValue - a.marketValue;
        case 'return':
          return b.totalReturnPercent - a.totalReturnPercent;
        case 'change':
          return b.dayChangePercent - a.dayChangePercent;
        default:
          return 0;
      }
    });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <PieChart className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">{portfolioName}</h2>
              <p className="text-primary-100 text-sm">
                Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
              <Download className="w-5 h-5" />
            </button>
            <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm text-primary-100">Total Value</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
            <div className={`text-sm ${summary.dayChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {formatPercent(summary.dayChangePercent)} today
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm text-primary-100">Total Return</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalReturn)}</div>
            <div className={`text-sm ${summary.totalReturnPercent >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {formatPercent(summary.totalReturnPercent)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-5 h-5" />
              <span className="text-sm text-primary-100">Positions</span>
            </div>
            <div className="text-2xl font-bold">{summary.positions}</div>
            <div className="text-sm text-primary-100">
              {formatPercent(summary.dividendYield)} div yield
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm text-primary-100">Cash</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary.cashBalance)}</div>
            <div className="text-sm text-primary-100">
              {((summary.cashBalance / summary.totalValue) * 100).toFixed(1)}% of portfolio
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Chart
              </button>
            </div>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="value">Sort by Value</option>
              <option value="symbol">Sort by Symbol</option>
              <option value="return">Sort by Return</option>
              <option value="change">Sort by Change</option>
            </select>

            {/* Sector Filter */}
            <select
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {sectors.map(sector => (
                <option key={sector} value={sector}>
                  {sector === 'all' ? 'All Sectors' : sector}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {showHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="text-sm">{showHidden ? 'Hide' : 'Show'} Details</span>
            </button>

            <button
              onClick={onAddPosition}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Position</span>
            </button>
          </div>
        </div>
      </div>

      {/* Holdings List */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Shares
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Current Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Market Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Day Change
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Return
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredHoldings.map((holding) => (
                <tr
                  key={holding.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {holding.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {holding.symbol}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                          {holding.companyName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {holding.sector}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {holding.shares.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-900 dark:text-gray-100">
                      {formatCurrency(holding.avgCost)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(holding.currentPrice)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(holding.marketValue)}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {holding.weight.toFixed(1)}% of portfolio
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`font-medium ${getChangeColor(holding.dayChange)}`}>
                      {formatCurrency(holding.dayChange)}
                    </div>
                    <div className={`text-sm ${getChangeColor(holding.dayChangePercent)}`}>
                      {formatPercent(holding.dayChangePercent)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`font-medium ${getChangeColor(holding.totalReturn)}`}>
                      {formatCurrency(holding.totalReturn)}
                    </div>
                    <div className={`text-sm ${getChangeColor(holding.totalReturnPercent)}`}>
                      {formatPercent(holding.totalReturnPercent)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onEditPosition?.(holding)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onRemovePosition?.(holding.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chart View */}
      {viewMode === 'chart' && (
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Allocation Chart */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Portfolio Allocation
              </h3>
              <div className="space-y-3">
                {filteredHoldings.slice(0, 5).map((holding, index) => (
                  <div key={holding.id} className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{
                        backgroundColor: `hsl(${(index * 60) % 360}, 70%, 50%)`
                      }}
                    ></div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {holding.symbol}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {holding.weight.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Top Performers
              </h3>
              <div className="space-y-3">
                {filteredHoldings
                  .sort((a, b) => b.totalReturnPercent - a.totalReturnPercent)
                  .slice(0, 5)
                  .map((holding) => (
                    <div key={holding.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {holding.symbol}
                        </span>
                      </div>
                      <div className={`text-sm font-medium ${getChangeColor(holding.totalReturnPercent)}`}>
                        {formatPercent(holding.totalReturnPercent)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Data as of {new Date().toLocaleString()}</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live Updates</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span>
              Portfolio Beta: <span className="font-medium">1.23</span>
            </span>
            <span>
              Sharpe Ratio: <span className="font-medium">1.45</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioTracker;