/**
 * Backtest Results Component
 *
 * Comprehensive display of backtest results including performance metrics,
 * equity curve, trade analysis, and risk reports.
 */

import React, { useState } from 'react';
import type { BacktestResult } from '../../types';

interface BacktestResultsProps {
  result: BacktestResult;
  onNewBacktest: () => void;
}

const BacktestResults: React.FC<BacktestResultsProps> = ({ result, onNewBacktest }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'risk' | 'tearsheet'>('overview');

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatPercent = (value: number, decimals: number = 2): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const formatNumber = (value: number, decimals: number = 2): string => {
    return value.toFixed(decimals);
  };

  const getReturnColor = (value: number): string => {
    return value >= 0 ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400';
  };

  const performanceCards = [
    {
      title: 'Total Return',
      value: formatPercent(result.performance_metrics.total_return / 100),
      subvalue: formatPercent(result.performance_metrics.annualized_return / 100),
      subtitle: 'Annualized',
      color: getReturnColor(result.performance_metrics.total_return)
    },
    {
      title: 'Sharpe Ratio',
      value: formatNumber(result.performance_metrics.sharpe_ratio),
      subvalue: formatNumber(result.performance_metrics.sortino_ratio),
      subtitle: 'Sortino Ratio',
      color: 'text-gray-900 dark:text-gray-100'
    },
    {
      title: 'Max Drawdown',
      value: formatPercent(Math.abs(result.performance_metrics.max_drawdown) / 100),
      subvalue: `${result.performance_metrics.max_drawdown_duration} days`,
      subtitle: 'Duration',
      color: 'text-bear-600 dark:text-bear-400'
    },
    {
      title: 'Win Rate',
      value: formatPercent(result.performance_metrics.win_rate / 100),
      subvalue: `${result.performance_metrics.winning_trades}/${result.performance_metrics.total_trades}`,
      subtitle: 'Trades',
      color: getReturnColor(result.performance_metrics.win_rate - 50)
    }
  ];

  const benchmarkComparison = result.benchmark_comparison;
  const equityCurve = result.equity_curve;
  const trades = result.trade_log;
  const riskMetrics = result.risk_metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Backtest Results
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {result.configuration.strategy.name} • {result.configuration.start_date} to {result.configuration.end_date}
          </p>
        </div>
        <div className="space-x-3">
          <button
            onClick={onNewBacktest}
            className="btn btn-secondary"
          >
            New Backtest
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn-ghost"
          >
            📄 Export Report
          </button>
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {performanceCards.map((card, index) => (
          <div key={index} className="card">
            <div className="p-6">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                {card.title}
              </div>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {card.subvalue} <span className="text-xs">{card.subtitle}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Benchmark Comparison */}
      {benchmarkComparison && (
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              vs {benchmarkComparison.benchmark_symbol} Benchmark
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Excess Return</div>
                <div className={`text-lg font-semibold ${getReturnColor(benchmarkComparison.excess_return)}`}>
                  {formatPercent(benchmarkComparison.excess_return / 100)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Alpha</div>
                <div className={`text-lg font-semibold ${getReturnColor(benchmarkComparison.alpha)}`}>
                  {formatNumber(benchmarkComparison.alpha)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Beta</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatNumber(benchmarkComparison.beta)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Information Ratio</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatNumber(benchmarkComparison.information_ratio)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: '📊' },
            { key: 'trades', label: 'Trade Log', icon: '📝', badge: trades.length },
            { key: 'risk', label: 'Risk Analysis', icon: '⚠️' },
            { key: 'tearsheet', label: 'Tearsheet', icon: '📈' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full text-xs">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Equity Curve Chart Placeholder */}
            <div className="card">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Equity Curve
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl text-gray-400 mb-2">📈</div>
                    <p className="text-gray-600 dark:text-gray-400">
                      Equity curve visualization will be displayed here
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Final Value: {formatCurrency(equityCurve[equityCurve.length - 1]?.portfolio_value || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <div className="p-6">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Return Metrics
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">CAGR</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatPercent(result.performance_metrics.cagr / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Volatility</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatPercent(result.performance_metrics.volatility / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Calmar Ratio</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(result.performance_metrics.calmar_ratio)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Skewness</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(result.performance_metrics.skewness)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Kurtosis</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(result.performance_metrics.kurtosis)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="p-6">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Trade Statistics
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Profit Factor</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(result.performance_metrics.profit_factor)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Avg. Win</span>
                      <span className="font-medium text-bull-600 dark:text-bull-400">
                        {formatPercent(result.performance_metrics.avg_win / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Avg. Loss</span>
                      <span className="font-medium text-bear-600 dark:text-bear-400">
                        {formatPercent(result.performance_metrics.avg_loss / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Largest Win</span>
                      <span className="font-medium text-bull-600 dark:text-bull-400">
                        {formatPercent(result.performance_metrics.largest_win / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Largest Loss</span>
                      <span className="font-medium text-bear-600 dark:text-bear-400">
                        {formatPercent(result.performance_metrics.largest_loss / 100)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Trade Log ({trades.length} trades)
              </h3>

              {trades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">Symbol</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">Side</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">Entry</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">Exit</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">P&L</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">P&L %</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 50).map((trade, index) => (
                        <tr key={trade.trade_id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-3 px-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {trade.symbol}
                          </td>
                          <td className="py-3 px-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              trade.side === 'long'
                                ? 'bg-bull-100 text-bull-800 dark:bg-bull-900/20 dark:text-bull-200'
                                : 'bg-bear-100 text-bear-800 dark:bg-bear-900/20 dark:text-bear-200'
                            }`}>
                              {trade.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">
                            {formatCurrency(trade.entry_price)}
                            <div className="text-xs text-gray-500">
                              {new Date(trade.entry_date).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">
                            {trade.exit_price ? formatCurrency(trade.exit_price) : '-'}
                            {trade.exit_date && (
                              <div className="text-xs text-gray-500">
                                {new Date(trade.exit_date).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2 text-sm">
                            <span className={getReturnColor(trade.pnl)}>
                              {formatCurrency(trade.pnl)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-sm">
                            <span className={getReturnColor(trade.pnl_percent)}>
                              {formatPercent(trade.pnl_percent / 100)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">
                            {trade.holding_period_days}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {trades.length > 50 && (
                    <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                      Showing first 50 trades of {trades.length} total
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  No trades found in this backtest.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <div className="p-6">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Value at Risk
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">VaR 95%</span>
                      <span className="font-medium text-bear-600 dark:text-bear-400">
                        {formatPercent(riskMetrics.var_95 / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">VaR 99%</span>
                      <span className="font-medium text-bear-600 dark:text-bear-400">
                        {formatPercent(riskMetrics.var_99 / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">CVaR 95%</span>
                      <span className="font-medium text-bear-600 dark:text-bear-400">
                        {formatPercent(riskMetrics.cvar_95 / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">CVaR 99%</span>
                      <span className="font-medium text-bear-600 dark:text-bear-400">
                        {formatPercent(riskMetrics.cvar_99 / 100)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="p-6">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Portfolio Risk
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Max Leverage</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(riskMetrics.maximum_leverage)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Avg Leverage</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(riskMetrics.avg_leverage)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Market Correlation</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(riskMetrics.correlation_to_market)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Concentration Risk</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(riskMetrics.concentration_risk)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sector Exposure */}
            {Object.keys(riskMetrics.sector_exposure).length > 0 && (
              <div className="card">
                <div className="p-6">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Sector Exposure
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(riskMetrics.sector_exposure).map(([sector, exposure]) => (
                      <div key={sector} className="text-center">
                        <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {sector.replace('_', ' ')}
                        </div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatPercent(exposure)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tearsheet' && (
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Performance Tearsheet
              </h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl text-gray-400 mb-2">📊</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Comprehensive tearsheet visualization will be displayed here
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Including monthly returns heatmap, rolling performance, and drawdown analysis
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Runtime Information */}
      <div className="card">
        <div className="p-4">
          <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
            <div>
              Backtest ID: {result.backtest_id.slice(0, 8)}...{result.backtest_id.slice(-8)}
            </div>
            <div>
              Runtime: {formatNumber(result.total_runtime_seconds)} seconds
            </div>
            {result.warnings.length > 0 && (
              <div className="text-warning-600 dark:text-warning-400">
                ⚠️ {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BacktestResults;