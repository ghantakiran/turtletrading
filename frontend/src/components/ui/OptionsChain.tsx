import React, { useState } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Zap,
  BarChart3,
  Clock,
  Filter,
  RefreshCw,
  Download,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface OptionContract {
  contractName: string;
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  inTheMoney: boolean;
  intrinsicValue: number;
  timeValue: number;
  breakEven: number;
}

interface OptionsChainData {
  symbol: string;
  currentPrice: number;
  expirationDate: Date;
  calls: OptionContract[];
  puts: OptionContract[];
  impliedVolatilityRank: number;
  maxPain: number;
  totalCallVolume: number;
  totalPutVolume: number;
  putCallRatio: number;
}

interface OptionsChainProps {
  data: OptionsChainData;
  availableDates: Date[];
  onExpirationChange?: (date: Date) => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

const OptionsChain: React.FC<OptionsChainProps> = ({
  data,
  availableDates,
  onExpirationChange,
  onRefresh,
  onExport
}) => {
  const [selectedExpiration, setSelectedExpiration] = useState(data.expirationDate);
  const [showGreeks, setShowGreeks] = useState(false);
  const [filterITM, setFilterITM] = useState(false);
  const [sortBy, setSortBy] = useState<'strike' | 'volume' | 'openInterest' | 'iv'>('strike');
  const [minVolume, setMinVolume] = useState(0);
  const [strikeRange, setStrikeRange] = useState<{ min: number; max: number }>({
    min: data.currentPrice * 0.8,
    max: data.currentPrice * 1.2
  });

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

  const formatGreek = (greek: number): string => {
    return greek.toFixed(4);
  };

  const getMoneyness = (strike: number, currentPrice: number, isCall: boolean): string => {
    if (isCall) {
      if (strike < currentPrice) return 'ITM'; // In the Money
      if (strike === currentPrice) return 'ATM'; // At the Money
      return 'OTM'; // Out of the Money
    } else {
      if (strike > currentPrice) return 'ITM';
      if (strike === currentPrice) return 'ATM';
      return 'OTM';
    }
  };

  const getMoneynessColor = (moneyness: string): string => {
    switch (moneyness) {
      case 'ITM': return 'bg-bull-100 dark:bg-bull-900/20 text-bull-800 dark:text-bull-200';
      case 'ATM': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200';
      case 'OTM': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getVolumeIntensity = (volume: number, maxVolume: number): string => {
    const intensity = volume / maxVolume;
    if (intensity > 0.7) return 'bg-red-200 dark:bg-red-900/30';
    if (intensity > 0.4) return 'bg-yellow-200 dark:bg-yellow-900/30';
    if (intensity > 0.1) return 'bg-green-200 dark:bg-green-900/30';
    return '';
  };

  const filteredCalls = data.calls.filter(call => {
    return (!filterITM || call.inTheMoney) &&
           call.volume >= minVolume &&
           call.strike >= strikeRange.min &&
           call.strike <= strikeRange.max;
  });

  const filteredPuts = data.puts.filter(put => {
    return (!filterITM || put.inTheMoney) &&
           put.volume >= minVolume &&
           put.strike >= strikeRange.min &&
           put.strike <= strikeRange.max;
  });

  const maxCallVolume = Math.max(...filteredCalls.map(c => c.volume));
  const maxPutVolume = Math.max(...filteredPuts.map(p => p.volume));
  const maxVolume = Math.max(maxCallVolume, maxPutVolume);

  const daysToExpiration = Math.ceil((data.expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Target className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">{data.symbol} Options Chain</h2>
              <p className="text-purple-100">
                Current: {formatCurrency(data.currentPrice)} • Exp: {data.expirationDate.toLocaleDateString()}
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
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5" />
              <span className="text-sm text-purple-100">Days to Exp</span>
            </div>
            <div className="text-2xl font-bold">{daysToExpiration}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm text-purple-100">IV Rank</span>
            </div>
            <div className="text-2xl font-bold">{data.impliedVolatilityRank}%</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-5 h-5" />
              <span className="text-sm text-purple-100">Max Pain</span>
            </div>
            <div className="text-2xl font-bold">${data.maxPain}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-5 h-5" />
              <span className="text-sm text-purple-100">P/C Ratio</span>
            </div>
            <div className="text-2xl font-bold">{data.putCallRatio.toFixed(2)}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm text-purple-100">Total Volume</span>
            </div>
            <div className="text-lg font-bold">
              {(data.totalCallVolume + data.totalPutVolume).toLocaleString()}
            </div>
            <div className="text-xs text-purple-200">
              C: {data.totalCallVolume.toLocaleString()} • P: {data.totalPutVolume.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            {/* Expiration Date Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiration Date
              </label>
              <select
                value={selectedExpiration.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  setSelectedExpiration(newDate);
                  onExpirationChange?.(newDate);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {availableDates.map((date) => (
                  <option key={date.toISOString()} value={date.toISOString().split('T')[0]}>
                    {date.toLocaleDateString()} ({Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d)
                  </option>
                ))}
              </select>
            </div>

            {/* Strike Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Strike Range
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={strikeRange.min}
                  onChange={(e) => setStrikeRange(prev => ({ ...prev, min: Number(e.target.value) || 0 }))}
                  className="w-20 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={strikeRange.max}
                  onChange={(e) => setStrikeRange(prev => ({ ...prev, max: Number(e.target.value) || 1000 }))}
                  className="w-20 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Min Volume Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Volume
              </label>
              <input
                type="number"
                placeholder="0"
                value={minVolume || ''}
                onChange={(e) => setMinVolume(Number(e.target.value) || 0)}
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Toggles */}
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filterITM}
                onChange={(e) => setFilterITM(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">ITM Only</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showGreeks}
                onChange={(e) => setShowGreeks(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show Greeks</span>
            </label>
          </div>
        </div>
      </div>

      {/* Options Chain Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th colSpan={showGreeks ? 10 : 6} className="px-6 py-3 text-center text-sm font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
                CALLS
              </th>
              <th className="px-6 py-3 text-center text-sm font-bold text-gray-700 dark:text-gray-300">
                STRIKE
              </th>
              <th colSpan={showGreeks ? 10 : 6} className="px-6 py-3 text-center text-sm font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                PUTS
              </th>
            </tr>
            <tr>
              {/* Call Headers */}
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bid</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ask</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Change</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vol</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OI</th>
              {showGreeks && (
                <>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IV</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Delta</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gamma</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Theta</th>
                </>
              )}

              {/* Strike Header */}
              <th className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Price</th>

              {/* Put Headers */}
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bid</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ask</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Change</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vol</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OI</th>
              {showGreeks && (
                <>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IV</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Delta</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gamma</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Theta</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {/* Generate strike prices and match calls/puts */}
            {Array.from(new Set([...filteredCalls.map(c => c.strike), ...filteredPuts.map(p => p.strike)]))
              .sort((a, b) => b - a) // Sort strikes descending
              .map((strike) => {
                const call = filteredCalls.find(c => c.strike === strike);
                const put = filteredPuts.find(p => p.strike === strike);
                const isAtTheMoney = Math.abs(strike - data.currentPrice) < 0.01;

                return (
                  <tr
                    key={strike}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      isAtTheMoney ? 'bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-300 dark:border-yellow-600' : ''
                    }`}
                  >
                    {/* Call Data */}
                    {call ? (
                      <>
                        <td className={`px-3 py-2 text-sm text-center ${getVolumeIntensity(call.volume, maxVolume)}`}>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {call.bid.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {call.ask.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {call.lastPrice.toFixed(2)}
                            </span>
                            <div className={`text-xs ${call.changePercent >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'}`}>
                              {formatPercent(call.changePercent)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className={`font-medium ${call.change >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'}`}>
                            {call.change >= 0 ? '+' : ''}{call.change.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {call.volume.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className="text-gray-600 dark:text-gray-400">
                            {call.openInterest.toLocaleString()}
                          </span>
                        </td>
                        {showGreeks && (
                          <>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                {(call.impliedVolatility * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatGreek(call.delta)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatGreek(call.gamma)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatGreek(call.theta)}
                              </span>
                            </td>
                          </>
                        )}
                      </>
                    ) : (
                      // Empty call cells
                      <>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        {showGreeks && (
                          <>
                            <td className="px-3 py-2 text-sm text-center">-</td>
                            <td className="px-3 py-2 text-sm text-center">-</td>
                            <td className="px-3 py-2 text-sm text-center">-</td>
                            <td className="px-3 py-2 text-sm text-center">-</td>
                          </>
                        )}
                      </>
                    )}

                    {/* Strike Price */}
                    <td className={`px-4 py-2 text-center border-x-2 border-gray-300 dark:border-gray-600 ${
                      isAtTheMoney ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-gray-50 dark:bg-gray-700'
                    }`}>
                      <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                        {strike.toFixed(0)}
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                        getMoneynessColor(getMoneyness(strike, data.currentPrice, true))
                      }`}>
                        {getMoneyness(strike, data.currentPrice, true)}
                      </div>
                    </td>

                    {/* Put Data */}
                    {put ? (
                      <>
                        <td className={`px-3 py-2 text-sm text-center ${getVolumeIntensity(put.volume, maxVolume)}`}>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {put.bid.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {put.ask.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {put.lastPrice.toFixed(2)}
                            </span>
                            <div className={`text-xs ${put.changePercent >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'}`}>
                              {formatPercent(put.changePercent)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className={`font-medium ${put.change >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'}`}>
                            {put.change >= 0 ? '+' : ''}{put.change.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {put.volume.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className="text-gray-600 dark:text-gray-400">
                            {put.openInterest.toLocaleString()}
                          </span>
                        </td>
                        {showGreeks && (
                          <>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                {(put.impliedVolatility * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatGreek(put.delta)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatGreek(put.gamma)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatGreek(put.theta)}
                              </span>
                            </td>
                          </>
                        )}
                      </>
                    ) : (
                      // Empty put cells
                      <>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        <td className="px-3 py-2 text-sm text-center">-</td>
                        {showGreeks && (
                          <>
                            <td className="px-3 py-2 text-sm text-center">-</td>
                            <td className="px-3 py-2 text-sm text-center">-</td>
                            <td className="px-3 py-2 text-sm text-center">-</td>
                            <td className="px-3 py-2 text-sm text-center">-</td>
                          </>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>
              Showing {filteredCalls.length} calls, {filteredPuts.length} puts
            </span>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-200 dark:bg-green-900/30 rounded"></div>
                <span className="text-xs">Low Volume</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-200 dark:bg-yellow-900/30 rounded"></div>
                <span className="text-xs">Medium Volume</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-200 dark:bg-red-900/30 rounded"></div>
                <span className="text-xs">High Volume</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Real-time quotes</span>
            </div>
            <span>Last updated: {new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionsChain;