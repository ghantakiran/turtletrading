/**
 * Trading News Widget Component
 * Displays financial news with sentiment analysis and real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetInstance } from '../sdk/WidgetSDK';
import { WidgetConfiguration } from '../config/WidgetConfiguration';
import { themeManager } from '../config/WidgetTheme';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: number;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  symbols: string[];
  categories: string[];
  image?: string;
  author?: string;
}

interface TradingNewsData {
  articles: NewsArticle[];
  trending: string[];
  marketSentiment: {
    overall: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  timestamp: number;
}

interface TradingNewsWidgetProps {
  instance: WidgetInstance;
  config: WidgetConfiguration;
  onError?: (error: Error) => void;
  onResize?: (width: number, height: number) => void;
  className?: string;
  embedded?: boolean;
}

export const TradingNewsWidget: React.FC<TradingNewsWidgetProps> = ({
  instance,
  config,
  onError,
  onResize,
  className = '',
  embedded = false
}) => {
  const [data, setData] = useState<TradingNewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Get configuration values
  const maxArticles = config.values.maxArticles || 10;
  const refreshInterval = config.values.refreshInterval || 60000; // 1 minute
  const showSentiment = config.values.showSentiment !== false;
  const showImages = config.values.showImages !== false;
  const categories = config.values.categories || ['general', 'earnings', 'technology', 'crypto'];
  const sources = config.values.sources || ['all'];

  /**
   * Fetch trading news data
   */
  const fetchNewsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        limit: maxArticles.toString(),
        categories: categories.join(','),
        sources: sources.join(',')
      });

      if (selectedCategory !== 'all') {
        queryParams.set('category', selectedCategory);
      }

      const response = await fetch(`/api/v1/news/trading?${queryParams}`);

      if (!response.ok) {
        throw new Error('Failed to fetch news data');
      }

      const newsData = await response.json();

      // Transform API response to our format
      const transformedData: TradingNewsData = {
        articles: newsData.articles || generateMockArticles(),
        trending: newsData.trending || ['AAPL', 'TSLA', 'NVDA', 'MSFT'],
        marketSentiment: newsData.sentiment || {
          overall: 0.15,
          positive: 45,
          negative: 30,
          neutral: 25
        },
        timestamp: Date.now()
      };

      setData(transformedData);
      setLastUpdate(Date.now());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [maxArticles, categories, sources, selectedCategory, onError]);

  // Initial data fetch
  useEffect(() => {
    fetchNewsData();
  }, [fetchNewsData]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchNewsData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchNewsData, refreshInterval]);

  // Apply theme
  const theme = themeManager.getTheme(config.theme);
  const themeVars = theme ? themeManager.createCSSVariables(config.theme) : {};

  /**
   * Generate mock articles (fallback)
   */
  const generateMockArticles = (): NewsArticle[] => [
    {
      id: '1',
      title: 'Tech Stocks Rally on Strong Q3 Earnings',
      summary: 'Major technology companies reported better-than-expected earnings, driving the NASDAQ to new highs.',
      source: 'Financial Times',
      publishedAt: Date.now() - 1800000, // 30 minutes ago
      url: '#',
      sentiment: 'positive',
      sentimentScore: 0.8,
      symbols: ['AAPL', 'MSFT', 'GOOGL'],
      categories: ['earnings', 'technology'],
      author: 'Sarah Johnson'
    },
    {
      id: '2',
      title: 'Federal Reserve Hints at Rate Cut',
      summary: 'Fed officials suggest potential interest rate reduction in upcoming meeting, boosting market optimism.',
      source: 'Reuters',
      publishedAt: Date.now() - 3600000, // 1 hour ago
      url: '#',
      sentiment: 'positive',
      sentimentScore: 0.6,
      symbols: ['SPY', 'QQQ'],
      categories: ['monetary-policy', 'general'],
      author: 'Mike Chen'
    },
    {
      id: '3',
      title: 'Oil Prices Surge on Supply Concerns',
      summary: 'Crude oil futures jumped 3% amid geopolitical tensions affecting major oil-producing regions.',
      source: 'Bloomberg',
      publishedAt: Date.now() - 5400000, // 1.5 hours ago
      url: '#',
      sentiment: 'neutral',
      sentimentScore: 0.1,
      symbols: ['XOM', 'CVX'],
      categories: ['commodities', 'energy'],
      author: 'Lisa Wang'
    }
  ];

  /**
   * Format relative time
   */
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  /**
   * Get sentiment color
   */
  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive': return 'text-green-500';
      case 'negative': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  /**
   * Get sentiment icon
   */
  const getSentimentIcon = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive': return '📈';
      case 'negative': return '📉';
      default: return '➡️';
    }
  };

  /**
   * Filter articles by category
   */
  const filteredArticles = data?.articles.filter(article =>
    selectedCategory === 'all' || article.categories.includes(selectedCategory)
  ) || [];

  if (loading && !data) {
    return (
      <div
        className={`trading-news-widget ${className}`}
        style={{ ...themeVars, width: instance.size.width, height: instance.size.height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading news...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={`trading-news-widget ${className}`}
        style={{ ...themeVars, width: instance.size.width, height: instance.size.height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-red-500 text-sm font-medium mb-1">Error</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {error || 'Failed to load news'}
            </div>
            <button
              onClick={fetchNewsData}
              className="mt-2 px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`trading-news-widget bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}
      style={{
        ...themeVars,
        width: instance.size.width,
        height: instance.size.height
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Trading News
            </h3>
            {showSentiment && (
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Sentiment:</span>
                <div className={`text-xs font-medium ${
                  data.marketSentiment.overall > 0.2 ? 'text-green-500' :
                  data.marketSentiment.overall < -0.2 ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {data.marketSentiment.overall > 0.2 ? 'Bullish' :
                   data.marketSentiment.overall < -0.2 ? 'Bearish' : 'Neutral'}
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">
              {formatRelativeTime(lastUpdate)}
            </div>
            {loading && (
              <div className="w-3 h-3 border border-gray-300 border-t-primary-500 rounded-full animate-spin mt-1"></div>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex space-x-1 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trending Symbols */}
      {data.trending.length > 0 && (
        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Trending:</span>
            <div className="flex space-x-1">
              {data.trending.map(symbol => (
                <span
                  key={symbol}
                  className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                >
                  {symbol}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* News Articles */}
      <div className="overflow-auto" style={{ height: 'calc(100% - 120px)' }}>
        <AnimatePresence>
          {filteredArticles.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  No articles found
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Try selecting a different category
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {filteredArticles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <NewsArticleCard
                    article={article}
                    showSentiment={showSentiment}
                    showImages={showImages}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Sentiment Overview */}
      {showSentiment && !embedded && (
        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-300">
                  {data.marketSentiment.positive}% Positive
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-300">
                  {data.marketSentiment.negative}% Negative
                </span>
              </div>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {filteredArticles.length} articles
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

/**
 * News Article Card Component
 */
interface NewsArticleCardProps {
  article: NewsArticle;
  showSentiment: boolean;
  showImages: boolean;
}

const NewsArticleCard: React.FC<NewsArticleCardProps> = ({
  article,
  showSentiment,
  showImages
}) => {
  const handleClick = () => {
    if (article.url && article.url !== '#') {
      window.open(article.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="p-2 border border-gray-200 dark:border-gray-700 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      onClick={handleClick}
    >
      <div className="flex space-x-2">
        {showImages && article.image && (
          <div className="flex-shrink-0">
            <img
              src={article.image}
              alt=""
              className="w-12 h-12 rounded object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {article.source}
              </span>
              {showSentiment && (
                <div className="flex items-center space-x-1">
                  <span className="text-xs">
                    {getSentimentIcon(article.sentiment)}
                  </span>
                  <span className={`text-xs ${getSentimentColor(article.sentiment)}`}>
                    {article.sentiment}
                  </span>
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {formatRelativeTime(article.publishedAt)}
            </span>
          </div>

          {/* Title */}
          <h4 className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
            {article.title}
          </h4>

          {/* Summary */}
          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-1">
            {article.summary}
          </p>

          {/* Symbols */}
          {article.symbols.length > 0 && (
            <div className="flex items-center space-x-1">
              {article.symbols.slice(0, 3).map(symbol => (
                <span
                  key={symbol}
                  className="px-1 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded"
                >
                  {symbol}
                </span>
              ))}
              {article.symbols.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{article.symbols.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export default TradingNewsWidget;