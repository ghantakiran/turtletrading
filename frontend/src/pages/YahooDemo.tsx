import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Code, Palette, Zap, BarChart3 } from 'lucide-react';
import MarketOverviewDashboard from '@/components/ui/MarketOverviewDashboard';

const YahooDemo: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Interactive Charts",
      description: "Multi-timeframe candlestick, line, and area charts with volume indicators"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Real-time Data",
      description: "Live stock prices, market indices, and trending stocks carousel"
    },
    {
      icon: <Code className="w-6 h-6" />,
      title: "Modern Components",
      description: "TypeScript React components with responsive design and dark mode"
    },
    {
      icon: <Palette className="w-6 h-6" />,
      title: "Yahoo Finance UI",
      description: "Professionally styled components replicating Yahoo Finance design"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Yahoo Finance UI Demo
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Professional trading interface components
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <a
                href="https://finance.yahoo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Yahoo Finance</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">
              Professional Trading Interface
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-3xl mx-auto">
              Comprehensive Yahoo Finance-inspired UI components built with React, TypeScript, and Tailwind CSS.
              Features real-time data visualization, interactive charts, and modern design patterns.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg mx-auto mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-primary-100 text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Components Section */}
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Component Showcase
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Explore the complete suite of trading interface components designed to provide
              institutional-grade market analysis tools for retail investors.
            </p>
          </div>

          {/* Component Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              'Market Overview Dashboard',
              'Stock Price Cards',
              'Interactive Charts',
              'Trending Stocks Carousel',
              'Market News Feed',
              'Real-time Data',
              'Responsive Design',
              'Dark Mode'
            ].map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Main Dashboard Component */}
          <MarketOverviewDashboard />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-6 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Live Demo Active</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Built with</span>
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">React + TypeScript</span>
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              © 2025 TurtleTrading. Professional trading platform with AI-powered market analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YahooDemo;