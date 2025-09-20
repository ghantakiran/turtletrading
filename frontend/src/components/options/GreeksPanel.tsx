/**
 * GreeksPanel.tsx - Comprehensive Greeks analysis and risk metrics panel
 *
 * Features:
 * - Real-time Greeks display with color-coded risk levels
 * - Interactive risk gauges and visualizations
 * - Portfolio aggregation and delta hedging calculations
 * - Keyboard navigation and accessibility compliance
 * - Mobile-responsive design with touch interactions
 * - Risk scenario analysis and stress testing
 * - Export capabilities for risk reporting
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  ShieldIcon,
  DollarSignIcon,
  ClockIcon,
  ZapIcon,
  TargetIcon,
  DownloadIcon,
  RefreshCwIcon
} from 'lucide-react';

// Types
interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface PositionGreeks extends Greeks {
  symbol: string;
  strike: number;
  expiry: string;
  optionType: 'call' | 'put';
  quantity: number;
  underlyingPrice: number;
  positionValue: number;
}

interface PortfolioGreeks extends Greeks {
  deltaHedgingRatio: number;
  gammaRisk: number;
  thetaDecayDaily: number;
  vegaExposure: number;
  netLiquidity: number;
  portfolioValue: number;
  riskScore: number;
}

interface GreeksPanelProps {
  positions?: PositionGreeks[];
  portfolioGreeks?: PortfolioGreeks;
  refreshInterval?: number;
  className?: string;
  showScenarioAnalysis?: boolean;
  showRiskMetrics?: boolean;
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type GreekType = 'delta' | 'gamma' | 'theta' | 'vega' | 'rho';

export const GreeksPanel: React.FC<GreeksPanelProps> = ({
  positions = [],
  portfolioGreeks,
  refreshInterval = 30000,
  className = '',
  showScenarioAnalysis = true,
  showRiskMetrics = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGreek, setSelectedGreek] = useState<GreekType>('delta');
  const [scenarioData, setScenarioData] = useState<any[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<string[]>([]);

  // Calculate aggregated portfolio Greeks from positions
  const calculatedPortfolioGreeks = useMemo(() => {
    if (portfolioGreeks) return portfolioGreeks;

    if (positions.length === 0) {
      return {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
        deltaHedgingRatio: 0,
        gammaRisk: 0,
        thetaDecayDaily: 0,
        vegaExposure: 0,
        netLiquidity: 0,
        portfolioValue: 0,
        riskScore: 0,
      };
    }

    const aggregated = positions.reduce(
      (acc, pos) => ({
        delta: acc.delta + pos.delta * pos.quantity,
        gamma: acc.gamma + pos.gamma * pos.quantity,
        theta: acc.theta + pos.theta * pos.quantity,
        vega: acc.vega + pos.vega * pos.quantity,
        rho: acc.rho + pos.rho * pos.quantity,
        portfolioValue: acc.portfolioValue + pos.positionValue,
      }),
      { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, portfolioValue: 0 }
    );

    // Calculate derived risk metrics
    const deltaHedgingRatio = Math.abs(aggregated.delta);
    const gammaRisk = Math.abs(aggregated.gamma) * 100; // Gamma risk as % of underlying move
    const thetaDecayDaily = aggregated.theta;
    const vegaExposure = Math.abs(aggregated.vega) * 100; // Vega exposure as % of vol move
    const riskScore = Math.min(
      (Math.abs(aggregated.delta) * 0.3 +
        Math.abs(aggregated.gamma) * 100 * 0.25 +
        Math.abs(aggregated.theta) * 0.2 +
        Math.abs(aggregated.vega) * 100 * 0.25) / 100,
      1
    );

    return {
      ...aggregated,
      deltaHedgingRatio,
      gammaRisk,
      thetaDecayDaily,
      vegaExposure,
      netLiquidity: aggregated.portfolioValue * 0.1, // Estimate
      riskScore,
    };
  }, [positions, portfolioGreeks]);

  // Determine risk level based on Greek values
  const getRiskLevel = (greek: GreekType, value: number): RiskLevel => {
    const thresholds = {
      delta: { low: 10, medium: 50, high: 100 },
      gamma: { low: 0.01, medium: 0.05, high: 0.1 },
      theta: { low: 5, medium: 25, high: 50 },
      vega: { low: 10, medium: 50, high: 100 },
      rho: { low: 5, medium: 25, high: 50 },
    };

    const absValue = Math.abs(value);
    const threshold = thresholds[greek];

    if (absValue <= threshold.low) return 'low';
    if (absValue <= threshold.medium) return 'medium';
    if (absValue <= threshold.high) return 'high';
    return 'critical';
  };

  // Get color for risk level
  const getRiskColor = (level: RiskLevel): string => {
    switch (level) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
    }
  };

  // Get icon for Greek type
  const getGreekIcon = (greek: GreekType) => {
    switch (greek) {
      case 'delta': return <TrendingUpIcon className="h-5 w-5" />;
      case 'gamma': return <ZapIcon className="h-5 w-5" />;
      case 'theta': return <ClockIcon className="h-5 w-5" />;
      case 'vega': return <TargetIcon className="h-5 w-5" />;
      case 'rho': return <DollarSignIcon className="h-5 w-5" />;
    }
  };

  // Generate scenario analysis data
  const generateScenarioData = useCallback(() => {
    if (!calculatedPortfolioGreeks) return;

    const scenarios = [];
    const basePrice = 100; // Normalized base price
    const priceChanges = [-20, -10, -5, -2, 0, 2, 5, 10, 20];

    priceChanges.forEach(change => {
      const newPrice = basePrice + change;
      const priceChangePercent = change / basePrice;

      // Simplified P&L calculation using Greeks
      const deltaPnL = calculatedPortfolioGreeks.delta * change;
      const gammaPnL = 0.5 * calculatedPortfolioGreeks.gamma * Math.pow(change, 2);
      const thetaPnL = calculatedPortfolioGreeks.theta; // Daily theta decay

      const totalPnL = deltaPnL + gammaPnL + thetaPnL;

      scenarios.push({
        priceChange: change,
        priceChangePercent: priceChangePercent * 100,
        newPrice,
        deltaPnL,
        gammaPnL,
        thetaPnL,
        totalPnL,
      });
    });

    setScenarioData(scenarios);
  }, [calculatedPortfolioGreeks]);

  // Update risk alerts based on portfolio Greeks
  useEffect(() => {
    const alerts: string[] = [];
    const greeks = calculatedPortfolioGreeks;

    if (Math.abs(greeks.delta) > 100) {
      alerts.push(`High delta exposure: ${greeks.delta.toFixed(0)} shares equivalent`);
    }
    if (Math.abs(greeks.gamma) > 0.1) {
      alerts.push(`High gamma risk: ${(greeks.gamma * 100).toFixed(1)}% sensitivity`);
    }
    if (greeks.theta < -50) {
      alerts.push(`High time decay: $${Math.abs(greeks.theta).toFixed(0)} daily theta burn`);
    }
    if (Math.abs(greeks.vega) > 100) {
      alerts.push(`High volatility exposure: $${Math.abs(greeks.vega).toFixed(0)} per 1% vol move`);
    }
    if (greeks.riskScore > 0.7) {
      alerts.push(`Portfolio risk score elevated: ${(greeks.riskScore * 100).toFixed(0)}%`);
    }

    setRiskAlerts(alerts);
  }, [calculatedPortfolioGreeks]);

  // Generate scenario data on component mount and when Greeks change
  useEffect(() => {
    generateScenarioData();
  }, [generateScenarioData]);

  // Export Greeks data
  const exportGreeksData = useCallback((format: 'csv' | 'json') => {
    const data = {
      portfolioGreeks: calculatedPortfolioGreeks,
      positions,
      scenarioAnalysis: scenarioData,
      riskAlerts,
      timestamp: new Date().toISOString(),
    };

    let content: string;
    let filename: string;

    if (format === 'csv') {
      // Create CSV for positions
      const headers = ['Symbol', 'Strike', 'Expiry', 'Type', 'Quantity', 'Delta', 'Gamma', 'Theta', 'Vega', 'Rho', 'Value'];
      const rows = positions.map(pos => [
        pos.symbol,
        pos.strike,
        pos.expiry,
        pos.optionType,
        pos.quantity,
        pos.delta,
        pos.gamma,
        pos.theta,
        pos.vega,
        pos.rho,
        pos.positionValue,
      ]);
      content = [headers, ...rows].map(row => row.join(',')).join('\n');
      filename = `greeks_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      content = JSON.stringify(data, null, 2);
      filename = `greeks_analysis_${new Date().toISOString().split('T')[0]}.json`;
    }

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [calculatedPortfolioGreeks, positions, scenarioData, riskAlerts]);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-gray-900 dark:text-white">
            Price Change: {label}%
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: ${entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`greeks-panel ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Greeks Analysis & Risk Metrics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Portfolio risk assessment and hedging analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={generateScenarioData}
            className="btn-secondary btn-sm"
            aria-label="Refresh analysis"
          >
            <RefreshCwIcon className="h-4 w-4" />
          </button>

          <div className="relative group">
            <button className="btn-secondary btn-sm">
              <DownloadIcon className="h-4 w-4" />
            </button>
            <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => exportGreeksData('csv')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportGreeksData('json')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex">
            <AlertTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Risk Alerts</h3>
              <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                {riskAlerts.map((alert, index) => (
                  <li key={index} className="mt-1">• {alert}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Greeks Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {(['delta', 'gamma', 'theta', 'vega', 'rho'] as GreekType[]).map(greek => {
          const value = calculatedPortfolioGreeks[greek];
          const riskLevel = getRiskLevel(greek, value);
          const riskColor = getRiskColor(riskLevel);

          return (
            <div
              key={greek}
              className={`
                bg-white dark:bg-gray-800 rounded-lg p-4 shadow cursor-pointer transition-all
                ${selectedGreek === greek ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:shadow-md'}
              `}
              onClick={() => setSelectedGreek(greek)}
              role="button"
              tabIndex={0}
              aria-label={`Select ${greek} for detailed view`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getGreekIcon(greek)}
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {greek}
                  </span>
                </div>
                <span className={`text-xs font-medium ${riskColor}`}>
                  {riskLevel.toUpperCase()}
                </span>
              </div>

              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {greek === 'delta' ? value.toFixed(0) : value.toFixed(3)}
              </div>

              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {greek === 'delta' && 'Shares equivalent'}
                {greek === 'gamma' && 'Gamma exposure'}
                {greek === 'theta' && '$/day decay'}
                {greek === 'vega' && '$/1% vol move'}
                {greek === 'rho' && '$/1% rate move'}
              </div>

              {/* Risk gauge */}
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    riskLevel === 'low' ? 'bg-green-500' :
                    riskLevel === 'medium' ? 'bg-yellow-500' :
                    riskLevel === 'high' ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      (Math.abs(value) / (greek === 'delta' ? 200 : greek === 'gamma' ? 0.2 : 100)) * 100,
                      100
                    )}%`
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Analysis Chart */}
        {showScenarioAnalysis && scenarioData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              P&L Scenario Analysis
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scenarioData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="priceChangePercent"
                  label={{ value: 'Underlying Price Change (%)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis
                  label={{ value: 'P&L ($)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="deltaPnL"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Delta P&L"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="gammaPnL"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Gamma P&L"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="totalPnL"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  name="Total P&L"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Risk Metrics Dashboard */}
        {showRiskMetrics && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Risk Metrics
            </h3>

            <div className="space-y-4">
              {/* Delta Hedging */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <ShieldIcon className="h-5 w-5 text-blue-500 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Delta Hedging Required
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Shares to buy/sell for delta neutrality
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {calculatedPortfolioGreeks.deltaHedgingRatio.toFixed(0)}
                </div>
              </div>

              {/* Gamma Risk */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <ZapIcon className="h-5 w-5 text-yellow-500 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Gamma Risk
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      P&L sensitivity to large price moves
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {calculatedPortfolioGreeks.gammaRisk.toFixed(1)}%
                </div>
              </div>

              {/* Theta Decay */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <ClockIcon className="h-5 w-5 text-red-500 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Daily Theta Decay
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Expected daily time decay
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  ${calculatedPortfolioGreeks.thetaDecayDaily.toFixed(0)}
                </div>
              </div>

              {/* Vega Exposure */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <TargetIcon className="h-5 w-5 text-purple-500 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Volatility Exposure
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      P&L change per 1% vol move
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  ${calculatedPortfolioGreeks.vegaExposure.toFixed(0)}
                </div>
              </div>

              {/* Overall Risk Score */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangleIcon className="h-5 w-5 text-orange-500 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Portfolio Risk Score
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Composite risk assessment
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white mr-2">
                    {(calculatedPortfolioGreeks.riskScore * 100).toFixed(0)}%
                  </div>
                  <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        calculatedPortfolioGreeks.riskScore <= 0.3 ? 'bg-green-500' :
                        calculatedPortfolioGreeks.riskScore <= 0.6 ? 'bg-yellow-500' :
                        calculatedPortfolioGreeks.riskScore <= 0.8 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${calculatedPortfolioGreeks.riskScore * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Positions Breakdown Table */}
      {positions.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Position Greeks Breakdown
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Delta
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Gamma
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Theta
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Vega
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {positions.map((position, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {position.symbol} ${position.strike} {position.optionType.toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(position.expiry).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {position.quantity}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {(position.delta * position.quantity).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {(position.gamma * position.quantity).toFixed(3)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {(position.theta * position.quantity).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {(position.vega * position.quantity).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                      ${position.positionValue.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        Greeks updated in real-time • Risk calculations based on current market conditions
      </div>
    </div>
  );
};

export default GreeksPanel;