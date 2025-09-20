/**
 * OptionsChain.tsx - Comprehensive options chain table component
 *
 * Features:
 * - Interactive options chain with calls/puts display
 * - Keyboard navigation with arrow keys and enter
 * - Sortable columns with accessibility
 * - Real-time data updates
 * - Mobile-responsive design
 * - WCAG accessibility compliance
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronUpIcon, ChevronDownIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

// Types
interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface OptionContract {
  strike: number;
  bid?: number;
  ask?: number;
  last?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  theoreticalPrice: number;
  greeks: Greeks;
  confidence: number;
}

interface OptionsChainEntry {
  strike: number;
  call?: OptionContract;
  put?: OptionContract;
}

interface OptionsChainData {
  symbol: string;
  expiry: string;
  underlyingPrice: number;
  options: OptionsChainEntry[];
  calculatedAt: string;
}

interface OptionsChainProps {
  symbol: string;
  expiry?: string;
  onOptionSelect?: (option: OptionContract, type: 'call' | 'put', strike: number) => void;
  refreshInterval?: number;
  className?: string;
}

type SortField = 'strike' | 'callVolume' | 'putVolume' | 'callIV' | 'putIV' | 'callDelta' | 'putDelta';
type SortDirection = 'asc' | 'desc';

export const OptionsChain: React.FC<OptionsChainProps> = ({
  symbol,
  expiry,
  onOptionSelect,
  refreshInterval = 30000,
  className = '',
}) => {
  const [data, setData] = useState<OptionsChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('strike');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: string } | null>(null);

  // Fetch options chain data
  const fetchOptionsChain = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        include_greeks: 'true',
        pricing_model: 'black_scholes',
        ...(expiry && { expiry }),
      });

      const response = await fetch(`/api/v1/options/${symbol}/chain?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const chainData = await response.json();
      setData(chainData);
    } catch (err) {
      console.error('Error fetching options chain:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch options chain');
    } finally {
      setLoading(false);
    }
  }, [symbol, expiry]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchOptionsChain();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchOptionsChain, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchOptionsChain, refreshInterval]);

  // Sort options chain data
  const sortedOptions = useMemo(() => {
    if (!data?.options) return [];

    return [...data.options].sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortField) {
        case 'strike':
          aVal = a.strike;
          bVal = b.strike;
          break;
        case 'callVolume':
          aVal = a.call?.volume || 0;
          bVal = b.call?.volume || 0;
          break;
        case 'putVolume':
          aVal = a.put?.volume || 0;
          bVal = b.put?.volume || 0;
          break;
        case 'callIV':
          aVal = a.call?.impliedVolatility || 0;
          bVal = b.call?.impliedVolatility || 0;
          break;
        case 'putIV':
          aVal = a.put?.impliedVolatility || 0;
          bVal = b.put?.impliedVolatility || 0;
          break;
        case 'callDelta':
          aVal = a.call?.greeks.delta || 0;
          bVal = b.call?.greeks.delta || 0;
          break;
        case 'putDelta':
          aVal = a.put?.greeks.delta || 0;
          bVal = b.put?.greeks.delta || 0;
          break;
        default:
          aVal = a.strike;
          bVal = b.strike;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data?.options, sortField, sortDirection]);

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle option selection
  const handleOptionClick = (option: OptionContract, type: 'call' | 'put', strike: number) => {
    setSelectedStrike(strike);
    onOptionSelect?.(option, type, strike);
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!data?.options) return;

    const { key } = e;
    const currentRow = focusedCell?.row || 0;
    const maxRow = sortedOptions.length - 1;

    switch (key) {
      case 'ArrowUp':
        e.preventDefault();
        setFocusedCell(prev => ({
          row: Math.max(0, currentRow - 1),
          col: prev?.col || 'strike',
        }));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedCell(prev => ({
          row: Math.min(maxRow, currentRow + 1),
          col: prev?.col || 'strike',
        }));
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        // Column navigation logic could be added here
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedCell) {
          const option = sortedOptions[focusedCell.row];
          if (focusedCell.col.includes('call') && option.call) {
            handleOptionClick(option.call, 'call', option.strike);
          } else if (focusedCell.col.includes('put') && option.put) {
            handleOptionClick(option.put, 'put', option.strike);
          }
        }
        break;
    }
  }, [focusedCell, sortedOptions, data?.options, handleOptionClick]);

  // Format number display
  const formatNumber = (value: number | undefined, decimals = 2): string => {
    if (value === undefined || value === null) return '--';
    return value.toFixed(decimals);
  };

  // Format percentage display
  const formatPercent = (value: number | undefined): string => {
    if (value === undefined || value === null) return '--';
    return `${(value * 100).toFixed(1)}%`;
  };

  // Format volume display
  const formatVolume = (value: number | undefined): string => {
    if (value === undefined || value === null) return '--';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  // Determine if strike is near the money
  const isNearMoney = (strike: number): boolean => {
    if (!data?.underlyingPrice) return false;
    const pctDiff = Math.abs((strike - data.underlyingPrice) / data.underlyingPrice);
    return pctDiff <= 0.05; // Within 5%
  };

  // Determine if strike is in the money
  const isInTheMoney = (strike: number, type: 'call' | 'put'): boolean => {
    if (!data?.underlyingPrice) return false;
    return type === 'call' ? strike < data.underlyingPrice : strike > data.underlyingPrice;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8" role="status" aria-label="Loading options chain">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading options chain...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4" role="alert">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading options chain</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={fetchOptionsChain}
              className="mt-2 btn-primary btn-sm"
              aria-label="Retry loading options chain"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8 text-gray-500 dark:text-gray-400">
        No options chain data available for {symbol}
      </div>
    );
  }

  return (
    <div className={`options-chain ${className}`} onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Options Chain - {data.symbol}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Expiry: {new Date(data.expiry).toLocaleDateString()} | Underlying: ${formatNumber(data.underlyingPrice)}
          </p>
        </div>
        <button
          onClick={fetchOptionsChain}
          className="btn-secondary btn-sm"
          aria-label="Refresh options chain data"
        >
          Refresh
        </button>
      </div>

      {/* Options Chain Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" role="table">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {/* Call Side Headers */}
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('callVolume')}
                  role="columnheader"
                  aria-sort={sortField === 'callVolume' ? sortDirection : 'none'}>
                Volume
                {sortField === 'callVolume' && (
                  sortDirection === 'asc' ? <ChevronUpIcon className="inline ml-1 h-4 w-4" /> : <ChevronDownIcon className="inline ml-1 h-4 w-4" />
                )}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('callIV')}
                  role="columnheader"
                  aria-sort={sortField === 'callIV' ? sortDirection : 'none'}>
                IV
                {sortField === 'callIV' && (
                  sortDirection === 'asc' ? <ChevronUpIcon className="inline ml-1 h-4 w-4" /> : <ChevronDownIcon className="inline ml-1 h-4 w-4" />
                )}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('callDelta')}
                  role="columnheader"
                  aria-sort={sortField === 'callDelta' ? sortDirection : 'none'}>
                Delta
                {sortField === 'callDelta' && (
                  sortDirection === 'asc' ? <ChevronUpIcon className="inline ml-1 h-4 w-4" /> : <ChevronDownIcon className="inline ml-1 h-4 w-4" />
                )}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Bid/Ask
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Calls
              </th>

              {/* Strike Column */}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 bg-gray-100 dark:bg-gray-600"
                  onClick={() => handleSort('strike')}
                  role="columnheader"
                  aria-sort={sortField === 'strike' ? sortDirection : 'none'}>
                Strike
                {sortField === 'strike' && (
                  sortDirection === 'asc' ? <ChevronUpIcon className="inline ml-1 h-4 w-4" /> : <ChevronDownIcon className="inline ml-1 h-4 w-4" />
                )}
              </th>

              {/* Put Side Headers */}
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Puts
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Bid/Ask
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('putDelta')}
                  role="columnheader"
                  aria-sort={sortField === 'putDelta' ? sortDirection : 'none'}>
                Delta
                {sortField === 'putDelta' && (
                  sortDirection === 'asc' ? <ChevronUpIcon className="inline ml-1 h-4 w-4" /> : <ChevronDownIcon className="inline ml-1 h-4 w-4" />
                )}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('putIV')}
                  role="columnheader"
                  aria-sort={sortField === 'putIV' ? sortDirection : 'none'}>
                IV
                {sortField === 'putIV' && (
                  sortDirection === 'asc' ? <ChevronUpIcon className="inline ml-1 h-4 w-4" /> : <ChevronDownIcon className="inline ml-1 h-4 w-4" />
                )}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('putVolume')}
                  role="columnheader"
                  aria-sort={sortField === 'putVolume' ? sortDirection : 'none'}>
                Volume
                {sortField === 'putVolume' && (
                  sortDirection === 'asc' ? <ChevronUpIcon className="inline ml-1 h-4 w-4" /> : <ChevronDownIcon className="inline ml-1 h-4 w-4" />
                )}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedOptions.map((option, index) => (
              <tr
                key={option.strike}
                className={`
                  hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                  ${selectedStrike === option.strike ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                  ${isNearMoney(option.strike) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                  ${focusedCell?.row === index ? 'ring-2 ring-blue-500' : ''}
                `}
                role="row"
              >
                {/* Call Side */}
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatVolume(option.call?.volume)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatPercent(option.call?.impliedVolatility)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatNumber(option.call?.greeks.delta, 3)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {option.call?.bid && option.call?.ask
                    ? `${formatNumber(option.call.bid)} / ${formatNumber(option.call.ask)}`
                    : '--'
                  }
                </td>
                <td
                  className={`
                    px-3 py-2 whitespace-nowrap text-sm font-medium cursor-pointer
                    ${option.call ? 'text-bull-600 hover:text-bull-700 dark:text-bull-400' : 'text-gray-400 dark:text-gray-600'}
                    ${isInTheMoney(option.strike, 'call') ? 'bg-bull-50 dark:bg-bull-900/20' : ''}
                  `}
                  onClick={() => option.call && handleOptionClick(option.call, 'call', option.strike)}
                  role="gridcell"
                  tabIndex={0}
                  aria-label={option.call ? `Call option at strike ${option.strike}, price ${formatNumber(option.call.theoreticalPrice)}` : 'No call option available'}
                >
                  {option.call ? formatNumber(option.call.theoreticalPrice) : '--'}
                </td>

                {/* Strike */}
                <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-center bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                  ${option.strike}
                  {isNearMoney(option.strike) && (
                    <span className="ml-1 text-xs text-yellow-600 dark:text-yellow-400" aria-label="Near the money">
                      ATM
                    </span>
                  )}
                </td>

                {/* Put Side */}
                <td
                  className={`
                    px-3 py-2 whitespace-nowrap text-sm font-medium cursor-pointer
                    ${option.put ? 'text-bear-600 hover:text-bear-700 dark:text-bear-400' : 'text-gray-400 dark:text-gray-600'}
                    ${isInTheMoney(option.strike, 'put') ? 'bg-bear-50 dark:bg-bear-900/20' : ''}
                  `}
                  onClick={() => option.put && handleOptionClick(option.put, 'put', option.strike)}
                  role="gridcell"
                  tabIndex={0}
                  aria-label={option.put ? `Put option at strike ${option.strike}, price ${formatNumber(option.put.theoreticalPrice)}` : 'No put option available'}
                >
                  {option.put ? formatNumber(option.put.theoreticalPrice) : '--'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {option.put?.bid && option.put?.ask
                    ? `${formatNumber(option.put.bid)} / ${formatNumber(option.put.ask)}`
                    : '--'
                  }
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatNumber(option.put?.greeks.delta, 3)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatPercent(option.put?.impliedVolatility)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatVolume(option.put?.volume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-200 dark:bg-yellow-900/20 rounded mr-2"></div>
          <span>Near the money (ATM)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-bull-200 dark:bg-bull-900/20 rounded mr-2"></div>
          <span>In the money (ITM)</span>
        </div>
        <div className="flex items-center">
          <span className="text-gray-500">Use arrow keys to navigate, Enter to select</span>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
        Last updated: {new Date(data.calculatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default OptionsChain;