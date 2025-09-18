import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  Clock,
  Globe,
  Zap,
  Eye,
  Star,
  RefreshCw,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import StockPriceCard from './StockPriceCard';
import TrendingStocksCarousel from './TrendingStocksCarousel';
import InteractiveChart from './InteractiveChart';
import MarketNewsFeed from './MarketNewsFeed';

// Market Indices Widget
const MarketIndicesWidget = () => {
  const indices = [
    {
      name: 'S&P 500',
      symbol: 'SPX',
      value: 4567.89,
      change: 23.45,
      changePercent: 0.52,
      volume: '3.2B'
    },
    {
      name: 'Dow Jones',
      symbol: 'DJI',
      value: 35123.45,
      change: -89.12,
      changePercent: -0.25,
      volume: '412M'
    },
    {
      name: 'NASDAQ',
      symbol: 'IXIC',
      value: 14567.23,
      change: 67.89,
      changePercent: 0.47,
      volume: '4.1B'
    },
    {
      name: 'Russell 2000',
      symbol: 'RUT',
      value: 2034.56,
      change: 12.34,
      changePercent: 0.61,
      volume: '1.8B'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-primary-500" />
          <span>Market Indices</span>
        </h3>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {indices.map((index) => (
          <div
            key={index.symbol}
            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {index.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {index.symbol}
              </span>
            </div>

            <div className="mb-2">
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {index.value.toLocaleString()}
              </span>
            </div>

            <div className={`flex items-center space-x-1 text-sm ${
              index.change >= 0
                ? 'text-bull-600 dark:text-bull-400'
                : 'text-bear-600 dark:text-bear-400'
            }`}>
              {index.change >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}</span>
              <span>({index.changePercent.toFixed(2)}%)</span>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Vol: {index.volume}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Market Stats Widget
const MarketStatsWidget = () => {
  const stats = [
    {
      title: 'Market Cap',
      value: '$45.2T',
      change: '+1.2%',
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-blue-500'
    },
    {
      title: 'Volume',
      value: '$127B',
      change: '+8.5%',
      icon: <Activity className="w-5 h-5" />,
      color: 'text-green-500'
    },
    {
      title: 'Advancing',
      value: '2,847',
      change: '+456',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-bull-500'
    },
    {
      title: 'Declining',
      value: '1,203',
      change: '-89',
      icon: <TrendingDown className="w-5 h-5" />,
      color: 'text-bear-500'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
        <Activity className="w-5 h-5 text-primary-500" />
        <span>Market Statistics</span>
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-2 ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stat.value}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {stat.title}
            </div>
            <div className={`text-sm font-medium ${
              stat.change.startsWith('+')
                ? 'text-bull-600 dark:text-bull-400'
                : 'text-bear-600 dark:text-bear-400'
            }`}>
              {stat.change}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Market Heat Map Widget
const MarketHeatMapWidget = () => {
  const sectors = [
    { name: 'Technology', change: 2.34, size: 28 },
    { name: 'Healthcare', change: 1.12, size: 15 },
    { name: 'Financials', change: -0.89, size: 13 },
    { name: 'Consumer Disc.', change: 0.67, size: 12 },
    { name: 'Communication', change: -1.23, size: 11 },
    { name: 'Industrials', change: 0.45, size: 10 },
    { name: 'Consumer Stap.', change: 0.23, size: 7 },
    { name: 'Energy', change: -2.45, size: 4 }
  ];

  const getColor = (change: number) => {
    if (change > 1.5) return 'bg-bull-500 text-white';
    if (change > 0.5) return 'bg-bull-400 text-white';
    if (change > 0) return 'bg-bull-300 text-gray-900';
    if (change > -0.5) return 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100';
    if (change > -1.5) return 'bg-bear-300 text-gray-900';
    return 'bg-bear-500 text-white';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
        <Globe className="w-5 h-5 text-primary-500" />
        <span>Sector Performance</span>
      </h3>

      <div className="grid grid-cols-4 gap-2">
        {sectors.map((sector) => (
          <div
            key={sector.name}
            className={`p-3 rounded-lg transition-all hover:scale-105 cursor-pointer ${getColor(sector.change)}`}
            style={{
              gridColumn: sector.size > 20 ? 'span 2' : 'span 1',
              gridRow: sector.size > 20 ? 'span 2' : 'span 1'
            }}
          >
            <div className="text-sm font-semibold mb-1">{sector.name}</div>
            <div className="text-lg font-bold">
              {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
            </div>
            <div className="text-xs opacity-80">
              {sector.size}% of market
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Economic Calendar Widget
const EconomicCalendarWidget = () => {
  const events = [
    {
      time: '8:30 AM',
      event: 'GDP Growth Rate',
      impact: 'high',
      actual: '2.4%',
      forecast: '2.1%',
      previous: '2.0%'
    },
    {
      time: '10:00 AM',
      event: 'Consumer Confidence',
      impact: 'medium',
      actual: null,
      forecast: '108.2',
      previous: '108.0'
    },
    {
      time: '2:00 PM',
      event: 'Fed Speech',
      impact: 'high',
      actual: null,
      forecast: null,
      previous: null
    }
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
        <Calendar className="w-5 h-5 text-primary-500" />
        <span>Economic Calendar</span>
      </h3>

      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {event.time}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {event.event}
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(event.impact)}`}>
                  {event.impact.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex space-x-4 text-xs">
              {event.actual && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Actual</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{event.actual}</div>
                </div>
              )}
              {event.forecast && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Forecast</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{event.forecast}</div>
                </div>
              )}
              {event.previous && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Previous</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{event.previous}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Dashboard Component
const MarketOverviewDashboard: React.FC = () => {
  const [refreshTime, setRefreshTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);

  // Sample data for components
  const featuredStocks = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 182.45,
      change: 2.34,
      changePercent: 1.30,
      volume: 67890000,
      marketCap: '2.87T',
      category: 'trending' as const,
      trend: 'up' as const
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corp',
      price: 342.67,
      change: -1.23,
      changePercent: -0.36,
      volume: 23456000,
      marketCap: '2.54T',
      category: 'trending' as const,
      trend: 'down' as const
    },
    // Add more stocks...
  ];

  const sampleChartData = [
    { timestamp: '2024-01-01', date: new Date(), open: 180, high: 185, low: 178, close: 183, volume: 1000000 },
    { timestamp: '2024-01-02', date: new Date(), open: 183, high: 187, low: 181, close: 186, volume: 1200000 },
    // Add more data points...
  ];

  const sampleNews = [
    {
      id: '1',
      title: 'Federal Reserve Signals Potential Rate Cut in Q2',
      summary: 'Fed officials hint at monetary policy adjustments amid economic uncertainty',
      source: 'Reuters',
      publishedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      sentiment: 'positive' as const,
      category: 'market' as const,
      relatedSymbols: ['SPY', 'QQQ'],
      importance: 'high' as const,
      readTime: 3,
      tags: ['federal-reserve', 'interest-rates']
    },
    // Add more news items...
  ];

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate data refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshTime(new Date());
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-3">
              <Zap className="w-8 h-8 text-primary-500" />
              <span>Market Overview</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Real-time market data and insights powered by AI
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Last updated</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {refreshTime.toLocaleTimeString()}
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Market Indices */}
      <div className="mb-8">
        <MarketIndicesWidget />
      </div>

      {/* Featured Stock */}
      <div className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <StockPriceCard
              symbol="AAPL"
              companyName="Apple Inc."
              price={182.45}
              change={2.34}
              changePercent={1.30}
              volume={67890000}
              marketCap="$2.87T"
              peRatio={28.45}
              high52Week={198.23}
              low52Week={124.17}
              dayHigh={184.32}
              dayLow={180.15}
              size="lg"
              showChart={true}
              chartData={sampleChartData}
            />
          </div>

          <div className="lg:col-span-2">
            <InteractiveChart
              data={sampleChartData}
              symbol="AAPL"
              height={400}
              showVolume={true}
            />
          </div>
        </div>
      </div>

      {/* Market Stats and Heat Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <MarketStatsWidget />
        <MarketHeatMapWidget />
      </div>

      {/* Trending Stocks */}
      <div className="mb-8">
        <TrendingStocksCarousel
          stocks={featuredStocks}
          category="trending"
          autoPlay={true}
          autoPlayInterval={5000}
        />
      </div>

      {/* News and Economic Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MarketNewsFeed
            news={sampleNews}
            title="Market News & Analysis"
            maxItems={8}
            onRefresh={handleRefresh}
            isLoading={isLoading}
          />
        </div>

        <div className="lg:col-span-1">
          <EconomicCalendarWidget />
        </div>
      </div>
    </div>
  );
};

export default MarketOverviewDashboard;