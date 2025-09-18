import React, { useState, useEffect } from 'react';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Bookmark,
  Share2,
  Filter,
  Search,
  RefreshCw,
  Newspaper,
  AlertCircle,
  Zap,
  Building
} from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  author?: string;
  publishedAt: Date;
  imageUrl?: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  category: 'breaking' | 'earnings' | 'market' | 'company' | 'crypto' | 'economy';
  relatedSymbols: string[];
  importance: 'high' | 'medium' | 'low';
  readTime: number; // in minutes
  isBreaking?: boolean;
  tags: string[];
}

interface MarketNewsFeedProps {
  news: NewsItem[];
  onNewsItemClick?: (item: NewsItem) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  title?: string;
  compact?: boolean;
  showFilters?: boolean;
  maxItems?: number;
}

const MarketNewsFeed: React.FC<MarketNewsFeedProps> = ({
  news,
  onNewsItemClick,
  onRefresh,
  isLoading = false,
  title = "Market News",
  compact = false,
  showFilters = true,
  maxItems = 10
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set());

  const categories = [
    { value: 'all', label: 'All News', icon: <Newspaper className="w-4 h-4" /> },
    { value: 'breaking', label: 'Breaking', icon: <AlertCircle className="w-4 h-4" /> },
    { value: 'earnings', label: 'Earnings', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'market', label: 'Markets', icon: <Zap className="w-4 h-4" /> },
    { value: 'company', label: 'Companies', icon: <Building className="w-4 h-4" /> },
  ];

  const filteredNews = news.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.relatedSymbols.some(symbol => symbol.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSentiment = selectedSentiment === 'all' || item.sentiment === selectedSentiment;

    return matchesSearch && matchesCategory && matchesSentiment;
  }).slice(0, maxItems);

  const toggleBookmark = (itemId: string) => {
    const newBookmarks = new Set(bookmarkedItems);
    if (newBookmarks.has(itemId)) {
      newBookmarks.delete(itemId);
    } else {
      newBookmarks.add(itemId);
    }
    setBookmarkedItems(newBookmarks);
  };

  const getSentimentColor = (sentiment: NewsItem['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return 'text-bull-600 bg-bull-100 dark:text-bull-400 dark:bg-bull-900/20';
      case 'negative':
        return 'text-bear-600 bg-bear-100 dark:text-bear-400 dark:bg-bear-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
    }
  };

  const getCategoryIcon = (category: NewsItem['category']) => {
    switch (category) {
      case 'breaking':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'earnings':
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'market':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'company':
        return <Building className="w-4 h-4 text-purple-500" />;
      default:
        return <Newspaper className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-3">
            <Newspaper className="w-6 h-6 text-primary-500" />
            <span>{title}</span>
            {isLoading && (
              <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
            )}
          </h2>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        {showFilters && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search news, symbols, or topics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Category Filters */}
            <div className="flex items-center space-x-2 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {category.icon}
                  <span>{category.label}</span>
                </button>
              ))}
            </div>

            {/* Sentiment Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Sentiment:</span>
              {['all', 'positive', 'negative', 'neutral'].map((sentiment) => (
                <button
                  key={sentiment}
                  onClick={() => setSelectedSentiment(sentiment)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedSentiment === sentiment
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* News Feed */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
        {filteredNews.length === 0 ? (
          <div className="p-8 text-center">
            <Newspaper className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No news found matching your search.' : 'No news available.'}
            </p>
          </div>
        ) : (
          filteredNews.map((item) => (
            <div
              key={item.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
              onClick={() => onNewsItemClick?.(item)}
            >
              <div className={`flex ${compact ? 'space-x-3' : 'space-x-4'}`}>
                {/* Image */}
                {!compact && item.imageUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-24 h-18 object-cover rounded-lg bg-gray-200 dark:bg-gray-700"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(item.category)}

                      {item.isBreaking && (
                        <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                          BREAKING
                        </span>
                      )}

                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(item.sentiment)}`}>
                        {item.sentiment.toUpperCase()}
                      </span>

                      {item.importance === 'high' && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(item.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          bookmarkedItems.has(item.id)
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                      >
                        <Bookmark className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className={`font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2 ${
                    compact ? 'text-sm' : 'text-base'
                  }`}>
                    {item.title}
                  </h3>

                  {/* Summary */}
                  {!compact && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {item.summary}
                    </p>
                  )}

                  {/* Related Symbols */}
                  {item.relatedSymbols.length > 0 && (
                    <div className="flex items-center space-x-2 mb-2">
                      {item.relatedSymbols.slice(0, 3).map((symbol) => (
                        <span
                          key={symbol}
                          className="px-2 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-xs font-medium rounded"
                        >
                          {symbol}
                        </span>
                      ))}
                      {item.relatedSymbols.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{item.relatedSymbols.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(item.publishedAt)}</span>
                      </span>

                      <span>{item.source}</span>

                      {item.author && <span>by {item.author}</span>}

                      <span>{item.readTime} min read</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {filteredNews.length === maxItems && news.length > maxItems && (
        <div className="p-4 text-center border-t border-gray-200 dark:border-gray-700">
          <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
            Load More News
          </button>
        </div>
      )}
    </div>
  );
};

export default MarketNewsFeed;