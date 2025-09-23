import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/outline';
import { NewspaperIcon, ChatBubbleLeftRightIcon, ClockIcon } from '@heroicons/react/24/solid';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  sentiment_score: number;
  published_at: string;
  url: string;
  ticker_symbols?: string[];
  confidence_score?: number;
  content_type: 'article' | 'tweet' | 'reddit_post';
}

interface NewsTapeProps {
  items: NewsItem[];
  autoScroll?: boolean;
  scrollSpeed?: number;
  showSentiment?: boolean;
  showTimestamp?: boolean;
  filterTickers?: string[];
  onItemClick?: (item: NewsItem) => void;
  className?: string;
}

const NewsTape: React.FC<NewsTapeProps> = ({
  items,
  autoScroll = true,
  scrollSpeed = 50,
  showSentiment = true,
  showTimestamp = true,
  filterTickers,
  onItemClick,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(autoScroll);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout>();

  // Filter items based on ticker symbols if provided
  const filteredItems = React.useMemo(() => {
    if (!filterTickers || filterTickers.length === 0) {
      return items;
    }
    return items.filter(item =>
      item.ticker_symbols?.some(ticker =>
        filterTickers.includes(ticker)
      )
    );
  }, [items, filterTickers]);

  // Auto-scroll functionality
  useEffect(() => {
    if (isPlaying && !isPaused && filteredItems.length > 0) {
      scrollIntervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % filteredItems.length);
      }, scrollSpeed * 1000);
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    }

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isPlaying, isPaused, filteredItems.length, scrollSpeed]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        handlePrevious();
      } else if (event.key === 'ArrowRight') {
        handleNext();
      } else if (event.key === ' ') {
        event.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % filteredItems.length);
  }, [filteredItems.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
  }, [filteredItems.length]);

  const handleItemClick = useCallback((item: NewsItem) => {
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 3000); // Resume after 3 seconds
    onItemClick?.(item);
  }, [onItemClick]);

  const getSentimentColor = (score: number): string => {
    if (score >= 0.3) return 'text-bull-500';
    if (score <= -0.3) return 'text-bear-500';
    return 'text-neutral-400';
  };

  const getSentimentBadge = (score: number): string => {
    if (score >= 0.5) return 'Very Positive';
    if (score >= 0.1) return 'Positive';
    if (score <= -0.5) return 'Very Negative';
    if (score <= -0.1) return 'Negative';
    return 'Neutral';
  };

  const getSourceIcon = (contentType: string) => {
    switch (contentType) {
      case 'article':
        return <NewspaperIcon className="h-4 w-4" />;
      case 'tweet':
        return <ChatBubbleLeftRightIcon className="h-4 w-4" />;
      case 'reddit_post':
        return <ChatBubbleLeftRightIcon className="h-4 w-4" />;
      default:
        return <NewspaperIcon className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (filteredItems.length === 0) {
    return (
      <div className={`bg-card rounded-lg p-4 ${className}`}>
        <div className="text-center text-muted-foreground">
          No news items available
        </div>
      </div>
    );
  }

  const currentItem = filteredItems[currentIndex];

  return (
    <div
      className={`news-tape bg-card rounded-lg border border-border ${className}`}
      role="region"
      aria-label="Live news feed"
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm font-medium">
            <div className="h-2 w-2 bg-bull-500 rounded-full animate-pulse"></div>
            <span>Live News Feed</span>
          </div>
          {filterTickers && filterTickers.length > 0 && (
            <div className="flex space-x-1">
              {filterTickers.map(ticker => (
                <span
                  key={ticker}
                  className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md font-mono"
                >
                  {ticker}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {filteredItems.length}
          </span>

          {/* Control buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePrevious}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              aria-label="Previous news item"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            <button
              onClick={handlePlayPause}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={handleNext}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              aria-label="Next news item"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollContainerRef}
        className="p-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className="flex items-start space-x-3 cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors"
          onClick={() => handleItemClick(currentItem)}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleItemClick(currentItem);
            }
          }}
        >
          {/* Source icon */}
          <div className="flex-shrink-0 mt-1">
            {getSourceIcon(currentItem.content_type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-medium line-clamp-2 leading-relaxed">
                {currentItem.title}
              </h3>

              {showSentiment && (
                <div className="flex-shrink-0 ml-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor(currentItem.sentiment_score)}`}
                    title={`Sentiment: ${getSentimentBadge(currentItem.sentiment_score)}`}
                  >
                    {getSentimentBadge(currentItem.sentiment_score)}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex items-center space-x-3 mt-2 text-xs text-muted-foreground">
              <span className="font-medium">{currentItem.source}</span>

              {showTimestamp && (
                <div className="flex items-center space-x-1">
                  <ClockIcon className="h-3 w-3" />
                  <span>{formatTimestamp(currentItem.published_at)}</span>
                </div>
              )}

              {currentItem.ticker_symbols && currentItem.ticker_symbols.length > 0 && (
                <div className="flex space-x-1">
                  {currentItem.ticker_symbols.slice(0, 3).map(ticker => (
                    <span
                      key={ticker}
                      className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono"
                    >
                      {ticker}
                    </span>
                  ))}
                  {currentItem.ticker_symbols.length > 3 && (
                    <span className="text-muted-foreground">
                      +{currentItem.ticker_symbols.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {currentItem.confidence_score && (
                <span
                  className="text-xs"
                  title={`Confidence: ${(currentItem.confidence_score * 100).toFixed(0)}%`}
                >
                  {(currentItem.confidence_score * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-4">
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className="bg-primary h-1 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${((currentIndex + 1) / filteredItems.length) * 100}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer with quick navigation */}
      <div className="border-t border-border p-2">
        <div className="flex justify-center space-x-1">
          {filteredItems.slice(0, 10).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentIndex
                  ? 'bg-primary'
                  : 'bg-muted hover:bg-muted-foreground/20'
              }`}
              aria-label={`Go to news item ${index + 1}`}
            />
          ))}
          {filteredItems.length > 10 && (
            <span className="text-xs text-muted-foreground px-2">
              +{filteredItems.length - 10} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsTape;