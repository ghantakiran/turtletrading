import React, { useState } from 'react';
import { useMarketStore } from '../../stores';

interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
  miniChart: number[];
}

interface SectorData {
  name: string;
  change: number;
  changePercent: number;
}

const MarketWidget: React.FC = () => {
  const { isConnected } = useMarketStore();
  const [isLoading] = useState(false);

  // Mock market data - would come from API/store in production
  const marketIndices: MarketIndex[] = [
    {
      symbol: 'SPY',
      name: 'S&P 500',
      value: 4530.25,
      change: 12.45,
      changePercent: 0.28,
      trend: 'up',
      miniChart: [4510, 4515, 4508, 4520, 4525, 4518, 4530]
    },
    {
      symbol: 'QQQ',
      name: 'NASDAQ',
      value: 15846.12,
      change: -23.67,
      changePercent: -0.15,
      trend: 'down',
      miniChart: [15870, 15860, 15875, 15850, 15840, 15855, 15846]
    },
    {
      symbol: 'DIA',
      name: 'Dow Jones',
      value: 34512.78,
      change: 89.34,
      changePercent: 0.26,
      trend: 'up',
      miniChart: [34450, 34480, 34465, 34490, 34505, 34500, 34512]
    },
    {
      symbol: 'IWM',
      name: 'Russell 2000',
      value: 1987.45,
      change: -8.92,
      changePercent: -0.45,
      trend: 'down',
      miniChart: [2000, 1995, 2002, 1990, 1985, 1992, 1987]
    }
  ];

  const sectorData: SectorData[] = [
    { name: 'Technology', change: 2.45, changePercent: 1.85 },
    { name: 'Healthcare', change: 1.23, changePercent: 0.92 },
    { name: 'Financials', change: -0.87, changePercent: -0.65 },
    { name: 'Energy', change: 3.45, changePercent: 2.78 },
    { name: 'Consumer', change: 0.56, changePercent: 0.34 },
    { name: 'Industrials', change: -1.23, changePercent: -0.98 },
    { name: 'Materials', change: 1.87, changePercent: 1.45 },
    { name: 'Utilities', change: -0.34, changePercent: -0.23 }
  ];

  const marketBreadth = {
    advancing: 1847,
    declining: 1253,
    unchanged: 124,
    advanceDeclineRatio: 1.47,
    newHighs: 89,
    newLows: 23
  };

  const fearGreedIndex = {
    value: 72,
    label: 'Greed',
    color: 'text-warning-400',
    bgColor: 'bg-warning-500'
  };

  const renderMiniChart = (data: number[], trend: string) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 60;
      const y = 20 - ((value - min) / range) * 15;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="w-16 h-6" viewBox="0 0 60 20">
        <polyline
          fill="none"
          stroke={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280'}
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Market Indices Loading */}
        <div className="card">
          <div className="animate-pulse space-y-4">
            <div className="skeleton h-6 w-32"></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="skeleton h-4 w-16"></div>
                  <div className="skeleton h-6 w-20"></div>
                  <div className="skeleton h-4 w-12"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="market-widget">
      {/* Market Indices */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-secondary-100">Market Indices</h2>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-error-500'}`}></div>
            <span className={`text-sm ${isConnected ? 'text-success-400' : 'text-error-400'}`}>
              {isConnected ? 'Live' : 'Delayed'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="market-indices">
          {marketIndices.map((index) => (
            <div key={index.symbol} className="bg-background-tertiary rounded-lg p-4 border border-secondary-600">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-secondary-400 uppercase">{index.symbol}</div>
                  <div className="text-sm font-medium text-secondary-200">{index.name}</div>
                </div>
                {renderMiniChart(index.miniChart, index.trend)}
              </div>
              <div className="text-lg font-bold text-secondary-100 mb-1">
                {index.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className={`flex items-center text-sm ${index.changePercent >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={index.changePercent >= 0 ? "M7 14l9-9 9 9" : "M17 10l-9 9-9-9"} />
                </svg>
                {index.change > 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent > 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sector Heatmap */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-secondary-100">Sector Performance</h3>
          <button className="text-xs text-primary-400 hover:text-primary-300">View Heatmap</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="sector-heatmap">
          {sectorData.map((sector) => (
            <div
              key={sector.name}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                sector.changePercent >= 1.5 ? 'bg-success-900/30 border-success-500/50 text-success-200' :
                sector.changePercent >= 0.5 ? 'bg-success-900/20 border-success-500/30 text-success-300' :
                sector.changePercent >= 0 ? 'bg-secondary-700 border-secondary-600 text-secondary-200' :
                sector.changePercent >= -0.5 ? 'bg-error-900/20 border-error-500/30 text-error-300' :
                'bg-error-900/30 border-error-500/50 text-error-200'
              }`}
            >
              <div className="text-sm font-medium truncate" title={sector.name}>
                {sector.name}
              </div>
              <div className="text-xs font-semibold">
                {sector.changePercent > 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Breadth & Fear/Greed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Breadth */}
        <div className="card">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Market Breadth</h3>
          <div className="space-y-4" data-testid="market-breadth">
            <div className="flex justify-between items-center">
              <span className="text-secondary-300">Advancing</span>
              <span className="text-success-400 font-medium">{marketBreadth.advancing.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-300">Declining</span>
              <span className="text-error-400 font-medium">{marketBreadth.declining.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-300">A/D Ratio</span>
              <span className="text-secondary-100 font-medium">{marketBreadth.advanceDeclineRatio.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-secondary-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-success-500"
                style={{ width: `${(marketBreadth.advancing / (marketBreadth.advancing + marketBreadth.declining)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-secondary-400">
              <span>New Highs: {marketBreadth.newHighs}</span>
              <span>New Lows: {marketBreadth.newLows}</span>
            </div>
          </div>
        </div>

        {/* Fear & Greed Index */}
        <div className="card">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Fear & Greed Index</h3>
          <div className="text-center" data-testid="fear-greed-index">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={fearGreedIndex.value > 75 ? '#ef4444' : fearGreedIndex.value > 50 ? '#f59e0b' : '#10b981'}
                  strokeWidth="8"
                  strokeDasharray={`${(fearGreedIndex.value / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${fearGreedIndex.color}`}>
                    {fearGreedIndex.value}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-lg font-semibold text-secondary-100 mb-1">
              {fearGreedIndex.label}
            </div>
            <div className="text-sm text-secondary-400">
              Current market sentiment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketWidget;