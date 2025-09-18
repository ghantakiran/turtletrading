import React from 'react';

const About: React.FC = () => {
  const features = [
    {
      icon: '🤖',
      title: 'LSTM Neural Networks',
      description: 'Advanced deep learning models trained on 90+ days of market data to predict future price movements.',
    },
    {
      icon: '📊',
      title: 'Technical Analysis',
      description: '15+ technical indicators including RSI, MACD, Bollinger Bands, and custom weighted scoring.',
    },
    {
      icon: '💭',
      title: 'Sentiment Analysis',
      description: 'Real-time analysis of financial news and social media to gauge market sentiment.',
    },
    {
      icon: '⚡',
      title: 'Real-time Data',
      description: 'WebSocket-powered live market data with sub-second updates.',
    },
    {
      icon: '🎯',
      title: 'Multi-factor Analysis',
      description: 'Comprehensive analysis combining AI predictions, technical indicators, and market sentiment.',
    },
    {
      icon: '🔒',
      title: 'Enterprise Security',
      description: 'Bank-grade security with JWT authentication and encrypted data transmission.',
    },
  ];

  const teamMembers = [
    {
      name: 'TurtleTrading AI',
      role: 'AI Development Team',
      description: 'Specialized in financial AI and machine learning applications',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          🐢 TurtleTrading
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Advanced AI-powered stock market analysis platform that democratizes institutional-grade 
          trading tools for retail investors.
        </p>
      </div>

      {/* Mission */}
      <div className="card">
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Our Mission</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            To <strong>democratize institutional-grade market intelligence</strong> for every trader through 
            AI-driven insights and real-time analytics. We believe that advanced market analysis capabilities 
            should not be exclusive to Wall Street institutions.
          </p>
        </div>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
          Platform Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div key={index} className="card card-hover">
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technology Stack */}
      <div className="card">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
            Technology Stack
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                🚀 Backend
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li>• FastAPI - High-performance async Python framework</li>
                <li>• PostgreSQL - Enterprise-grade database</li>
                <li>• Redis - High-speed caching and sessions</li>
                <li>• TensorFlow - Machine learning and LSTM models</li>
                <li>• WebSocket - Real-time data streaming</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                💻 Frontend
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li>• React 18 - Modern UI framework</li>
                <li>• TypeScript - Type-safe development</li>
                <li>• Tailwind CSS - Custom design system</li>
                <li>• Vite - Lightning-fast build tool</li>
                <li>• React Query - Server state management</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* AI Models */}
      <div className="card">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
            AI Model Architecture
          </h2>
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-primary-100 dark:bg-primary-900 rounded-lg p-6 mb-4">
                  <h4 className="font-semibold text-primary-800 dark:text-primary-200">
                    Data Input
                  </h4>
                  <p className="text-sm text-primary-700 dark:text-primary-300 mt-2">
                    90-day lookback window with price, volume, and 15+ technical indicators
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-bull-100 dark:bg-bull-900 rounded-lg p-6 mb-4">
                  <h4 className="font-semibold text-bull-800 dark:text-bull-200">
                    LSTM Processing
                  </h4>
                  <p className="text-sm text-bull-700 dark:text-bull-300 mt-2">
                    Stacked LSTM layers with dropout regularization for time series prediction
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-warning-100 dark:bg-warning-900 rounded-lg p-6 mb-4">
                  <h4 className="font-semibold text-warning-800 dark:text-warning-200">
                    Prediction Output
                  </h4>
                  <p className="text-sm text-warning-700 dark:text-warning-300 mt-2">
                    1-30 day forecasts with confidence intervals and trend analysis
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Multi-Factor Scoring Algorithm
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600">50%</div>
                  <div className="text-gray-600 dark:text-gray-400">LSTM Signal</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-bull-600">30%</div>
                  <div className="text-gray-600 dark:text-gray-400">Technical Analysis</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-warning-600">10%</div>
                  <div className="text-gray-600 dark:text-gray-400">Sentiment Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">10%</div>
                  <div className="text-gray-600 dark:text-gray-400">Seasonality</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center">
          <div className="p-6">
            <div className="text-3xl font-bold text-primary-600 mb-2">99.9%</div>
            <div className="text-gray-600 dark:text-gray-400">Uptime</div>
          </div>
        </div>
        <div className="card text-center">
          <div className="p-6">
            <div className="text-3xl font-bold text-bull-600 mb-2">&lt;200ms</div>
            <div className="text-gray-600 dark:text-gray-400">API Response</div>
          </div>
        </div>
        <div className="card text-center">
          <div className="p-6">
            <div className="text-3xl font-bold text-warning-600 mb-2">65%+</div>
            <div className="text-gray-600 dark:text-gray-400">AI Accuracy</div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="card">
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Get Started</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Ready to experience institutional-grade trading analytics?
          </p>
          <div className="space-x-4">
            <button className="btn btn-primary">
              Start Free Trial
            </button>
            <button className="btn btn-secondary">
              View Documentation
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
        <p>&copy; 2025 TurtleTrading. Built with ❤️ for traders worldwide.</p>
        <p className="mt-2">
          Powered by FastAPI • React • TensorFlow • Real-time Data
        </p>
      </div>
    </div>
  );
};

export default About;