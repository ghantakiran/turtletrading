import React, { useState } from 'react';
import { useMarketStore, useAuthStore } from '../../stores';

interface PortfolioHolding {
  symbol: string;
  shares: number;
  value: number;
  change: number;
  changePercent: number;
  allocation: number;
}

interface PortfolioData {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  holdings: PortfolioHolding[];
}

const PortfolioWidget: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [isLoading] = useState(false);

  // Mock portfolio data - would come from API/store in production
  const portfolioData: PortfolioData = {
    totalValue: 142750.85,
    dayChange: 3450.12,
    dayChangePercent: 2.48,
    totalReturn: 18750.85,
    totalReturnPercent: 15.12,
    holdings: [
      {
        symbol: 'AAPL',
        shares: 50,
        value: 8750.00,
        change: 125.50,
        changePercent: 1.45,
        allocation: 6.13
      },
      {
        symbol: 'MSFT',
        shares: 30,
        value: 12450.00,
        change: -85.30,
        changePercent: -0.68,
        allocation: 8.72
      },
      {
        symbol: 'GOOGL',
        shares: 25,
        value: 15200.00,
        change: 450.75,
        changePercent: 3.06,
        allocation: 10.65
      },
      {
        symbol: 'NVDA',
        shares: 40,
        value: 24800.00,
        change: 850.20,
        changePercent: 3.55,
        allocation: 17.38
      },
      {
        symbol: 'TSLA',
        shares: 35,
        value: 18650.00,
        change: -250.40,
        changePercent: -1.32,
        allocation: 13.07
      }
    ]
  };

  const topMovers = portfolioData.holdings
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 3);

  if (!isAuthenticated) {
    return (
      <div className="card h-full">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <svg className="h-12 w-12 text-secondary-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-lg font-medium text-secondary-200 mb-2">Portfolio Overview</h3>
          <p className="text-secondary-400">Sign in to view your portfolio</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card h-full">
        <div className="animate-pulse space-y-4">
          <div className="flex justify-between items-center">
            <div className="skeleton h-6 w-32"></div>
            <div className="skeleton h-4 w-16"></div>
          </div>
          <div className="skeleton h-8 w-40"></div>
          <div className="skeleton h-6 w-24"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="skeleton h-4 w-16"></div>
                <div className="skeleton h-4 w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full" data-testid="portfolio-widget">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-secondary-100">Portfolio</h2>
        </div>
        <button
          className="text-xs text-secondary-400 hover:text-secondary-100 transition-colors"
          data-testid="portfolio-view-all"
        >
          View All →
        </button>
      </div>

      {/* Portfolio Value */}
      <div className="mb-6">
        <div className="text-3xl font-bold text-secondary-100 mb-2" data-testid="portfolio-total-value">
          ${portfolioData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className={`flex items-center space-x-1 ${portfolioData.dayChangePercent >= 0 ? 'text-success-400' : 'text-error-400'}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={portfolioData.dayChangePercent >= 0 ? "M7 14l9-9 9 9" : "M17 10l-9 9-9-9"} />
            </svg>
            <span data-testid="portfolio-day-change">
              ${Math.abs(portfolioData.dayChange).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              ({portfolioData.dayChangePercent > 0 ? '+' : ''}{portfolioData.dayChangePercent.toFixed(2)}%)
            </span>
          </div>
          <div className="text-secondary-400">Today</div>
        </div>
        <div className="flex items-center space-x-2 text-sm mt-1">
          <div className="text-secondary-300">Total Return:</div>
          <div className={`${portfolioData.totalReturnPercent >= 0 ? 'text-success-400' : 'text-error-400'}`}>
            +${portfolioData.totalReturn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            (+{portfolioData.totalReturnPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Allocation Chart Preview */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-secondary-200">Allocation</h3>
          <button className="text-xs text-primary-400 hover:text-primary-300">View Chart</button>
        </div>
        <div className="h-2 bg-secondary-700 rounded-full overflow-hidden flex">
          {portfolioData.holdings.slice(0, 5).map((holding, index) => (
            <div
              key={holding.symbol}
              className={`h-full ${
                index === 0 ? 'bg-primary-500' :
                index === 1 ? 'bg-success-500' :
                index === 2 ? 'bg-warning-500' :
                index === 3 ? 'bg-error-500' : 'bg-secondary-400'
              }`}
              style={{ width: `${holding.allocation}%` }}
              title={`${holding.symbol}: ${holding.allocation.toFixed(1)}%`}
            />
          ))}
        </div>
      </div>

      {/* Top Movers */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-secondary-200">Top Movers</h3>
        </div>
        <div className="space-y-2" data-testid="portfolio-top-movers">
          {topMovers.map((holding) => (
            <div key={holding.symbol} className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-secondary-700 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-secondary-200">{holding.symbol}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-secondary-100">{holding.symbol}</div>
                  <div className="text-xs text-secondary-400">{holding.shares} shares</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-secondary-100">
                  ${holding.value.toLocaleString()}
                </div>
                <div className={`text-xs flex items-center ${holding.changePercent >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d={holding.changePercent >= 0 ? "M7 14l9-9 9 9" : "M17 10l-9 9-9-9"} />
                  </svg>
                  {holding.changePercent > 0 ? '+' : ''}{holding.changePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rebalance CTA */}
      <div className="pt-4 border-t border-secondary-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="h-5 w-5 text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-secondary-300">Portfolio needs rebalancing</span>
          </div>
          <button
            className="btn-primary py-2 px-4 text-sm"
            data-testid="portfolio-rebalance-btn"
          >
            Rebalance
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortfolioWidget;