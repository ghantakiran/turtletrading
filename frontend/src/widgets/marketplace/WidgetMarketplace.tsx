/**
 * Widget Marketplace
 * Browse, search, and install widgets for dashboard customization
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetConfig, WidgetCategory, WidgetPermission } from '../sdk/WidgetSDK';

// Marketplace Types
export interface MarketplaceWidget {
  config: WidgetConfig;
  metadata: WidgetMetadata;
  stats: WidgetStats;
  reviews: WidgetReview[];
  versions: WidgetVersion[];
  screenshots: string[];
  isInstalled: boolean;
  canUpdate: boolean;
}

export interface WidgetMetadata {
  featured: boolean;
  verified: boolean;
  premium: boolean;
  price: number;
  currency: string;
  downloadCount: number;
  rating: number;
  reviewCount: number;
  lastUpdated: Date;
  compatibility: string[];
  size: number;
  license: 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'Proprietary';
  support: {
    email?: string;
    website?: string;
    documentation?: string;
    issues?: string;
  };
}

export interface WidgetStats {
  downloads: number;
  activeInstalls: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  performanceScore: number;
  securityScore: number;
}

export interface WidgetReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  createdAt: Date;
  helpful: number;
  verified: boolean;
}

export interface WidgetVersion {
  version: string;
  releaseDate: Date;
  changelog: string;
  breaking: boolean;
  size: number;
  downloadUrl: string;
}

export interface SearchFilters {
  category?: WidgetCategory;
  priceRange?: [number, number];
  rating?: number;
  verified?: boolean;
  featured?: boolean;
  free?: boolean;
  compatibility?: string[];
  permissions?: WidgetPermission[];
}

export interface SortOptions {
  field: 'name' | 'rating' | 'downloads' | 'updated' | 'price';
  order: 'asc' | 'desc';
}

// Widget Marketplace Component
interface WidgetMarketplaceProps {
  onInstall: (widget: MarketplaceWidget) => Promise<void>;
  onUninstall: (widgetId: string) => Promise<void>;
  onUpdate: (widgetId: string) => Promise<void>;
  installedWidgets: Set<string>;
  className?: string;
}

export const WidgetMarketplace: React.FC<WidgetMarketplaceProps> = ({
  onInstall,
  onUninstall,
  onUpdate,
  installedWidgets,
  className = ''
}) => {
  const [widgets, setWidgets] = useState<MarketplaceWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortBy, setSortBy] = useState<SortOptions>({ field: 'downloads', order: 'desc' });
  const [selectedWidget, setSelectedWidget] = useState<MarketplaceWidget | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Load widgets on mount
  useEffect(() => {
    loadWidgets();
  }, []);

  // Filter and sort widgets
  const filteredWidgets = useMemo(() => {
    let filtered = widgets.filter(widget => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = widget.config.name.toLowerCase().includes(query);
        const matchesDescription = widget.config.description.toLowerCase().includes(query);
        const matchesAuthor = widget.config.author.name.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription && !matchesAuthor) {
          return false;
        }
      }

      // Category filter
      if (filters.category && widget.config.category !== filters.category) {
        return false;
      }

      // Price filter
      if (filters.priceRange) {
        const [min, max] = filters.priceRange;
        if (widget.metadata.price < min || widget.metadata.price > max) {
          return false;
        }
      }

      // Rating filter
      if (filters.rating && widget.metadata.rating < filters.rating) {
        return false;
      }

      // Verified filter
      if (filters.verified && !widget.metadata.verified) {
        return false;
      }

      // Featured filter
      if (filters.featured && !widget.metadata.featured) {
        return false;
      }

      // Free filter
      if (filters.free && widget.metadata.price > 0) {
        return false;
      }

      // Permissions filter
      if (filters.permissions && filters.permissions.length > 0) {
        const hasAllPermissions = filters.permissions.every(permission =>
          widget.config.permissions.includes(permission)
        );
        if (!hasAllPermissions) {
          return false;
        }
      }

      return true;
    });

    // Sort widgets
    filtered.sort((a, b) => {
      const { field, order } = sortBy;
      let comparison = 0;

      switch (field) {
        case 'name':
          comparison = a.config.name.localeCompare(b.config.name);
          break;
        case 'rating':
          comparison = a.metadata.rating - b.metadata.rating;
          break;
        case 'downloads':
          comparison = a.metadata.downloadCount - b.metadata.downloadCount;
          break;
        case 'updated':
          comparison = a.metadata.lastUpdated.getTime() - b.metadata.lastUpdated.getTime();
          break;
        case 'price':
          comparison = a.metadata.price - b.metadata.price;
          break;
      }

      return order === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [widgets, searchQuery, filters, sortBy]);

  const loadWidgets = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would fetch from the API
      const mockWidgets = await loadMockWidgets();

      // Update installation status
      const widgetsWithStatus = mockWidgets.map(widget => ({
        ...widget,
        isInstalled: installedWidgets.has(widget.config.id),
        canUpdate: installedWidgets.has(widget.config.id) && hasUpdate(widget)
      }));

      setWidgets(widgetsWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load widgets');
    } finally {
      setLoading(false);
    }
  };

  const hasUpdate = (widget: MarketplaceWidget): boolean => {
    // Check if installed version is older than latest
    return widget.versions.length > 1;
  };

  const handleInstall = async (widget: MarketplaceWidget) => {
    try {
      await onInstall(widget);

      // Update local state
      setWidgets(prev => prev.map(w =>
        w.config.id === widget.config.id
          ? { ...w, isInstalled: true, canUpdate: false }
          : w
      ));
    } catch (error) {
      console.error('Installation failed:', error);
    }
  };

  const handleUninstall = async (widgetId: string) => {
    try {
      await onUninstall(widgetId);

      // Update local state
      setWidgets(prev => prev.map(w =>
        w.config.id === widgetId
          ? { ...w, isInstalled: false, canUpdate: false }
          : w
      ));
    } catch (error) {
      console.error('Uninstallation failed:', error);
    }
  };

  const handleUpdate = async (widgetId: string) => {
    try {
      await onUpdate(widgetId);

      // Update local state
      setWidgets(prev => prev.map(w =>
        w.config.id === widgetId
          ? { ...w, canUpdate: false }
          : w
      ));
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const openWidgetDetails = (widget: MarketplaceWidget) => {
    setSelectedWidget(widget);
    setShowDetails(true);
  };

  const closeWidgetDetails = () => {
    setSelectedWidget(null);
    setShowDetails(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Loading marketplace...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={loadWidgets}
          className="btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`widget-marketplace ${className}`} data-testid="widget-marketplace">
      {/* Header */}
      <div className="marketplace-header border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Widget Marketplace
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Discover and install widgets to customize your dashboard
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'text-gray-400'}`}
              data-testid="grid-view"
            >
              <GridIcon />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'text-gray-400'}`}
              data-testid="list-view"
            >
              <ListIcon />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <MarketplaceFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filteredWidgets.length} widget{filteredWidgets.length !== 1 ? 's' : ''} found
        </div>

        <div className="flex items-center space-x-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {installedWidgets.size} installed
          </span>
        </div>
      </div>

      {/* Widget Grid/List */}
      <div className={`marketplace-widgets ${
        viewMode === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          : 'space-y-4'
      }`}>
        <AnimatePresence>
          {filteredWidgets.map(widget => (
            <motion.div
              key={widget.config.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <WidgetCard
                widget={widget}
                viewMode={viewMode}
                onInstall={() => handleInstall(widget)}
                onUninstall={() => handleUninstall(widget.config.id)}
                onUpdate={() => handleUpdate(widget.config.id)}
                onViewDetails={() => openWidgetDetails(widget)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredWidgets.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <SearchIcon className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No widgets found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search terms or filters
          </p>
        </div>
      )}

      {/* Widget Details Modal */}
      <AnimatePresence>
        {showDetails && selectedWidget && (
          <WidgetDetailsModal
            widget={selectedWidget}
            onClose={closeWidgetDetails}
            onInstall={() => handleInstall(selectedWidget)}
            onUninstall={() => handleUninstall(selectedWidget.config.id)}
            onUpdate={() => handleUpdate(selectedWidget.config.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Widget Card Component
interface WidgetCardProps {
  widget: MarketplaceWidget;
  viewMode: 'grid' | 'list';
  onInstall: () => void;
  onUninstall: () => void;
  onUpdate: () => void;
  onViewDetails: () => void;
}

const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  viewMode,
  onInstall,
  onUninstall,
  onUpdate,
  onViewDetails
}) => {
  const { config, metadata, stats } = widget;

  if (viewMode === 'list') {
    return (
      <div className="widget-card-list flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mr-4">
          {config.previewUrl ? (
            <img src={config.previewUrl} alt={config.name} className="w-12 h-12 rounded" />
          ) : (
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded flex items-center justify-center">
              <span className="text-primary-600 dark:text-primary-400 font-medium">
                {config.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                {config.name}
              </h3>
              {metadata.featured && <FeaturedBadge />}
              {metadata.verified && <VerifiedBadge />}
            </div>

            <div className="flex items-center space-x-2">
              <RatingDisplay rating={metadata.rating} reviewCount={metadata.reviewCount} />
              <WidgetActions
                widget={widget}
                onInstall={onInstall}
                onUninstall={onUninstall}
                onUpdate={onUpdate}
                compact
              />
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
            {config.description}
          </p>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>{metadata.downloadCount.toLocaleString()} downloads</span>
              <span>by {config.author.name}</span>
              <span>{formatFileSize(metadata.size)}</span>
            </div>

            <button
              onClick={onViewDetails}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Widget Preview */}
      <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative group">
        {config.previewUrl ? (
          <img
            src={config.previewUrl}
            alt={config.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
              <span className="text-primary-600 dark:text-primary-400 text-xl font-bold">
                {config.name.charAt(0)}
              </span>
            </div>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={onViewDetails}
            className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100"
          >
            View Details
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex space-x-1">
          {metadata.featured && <FeaturedBadge />}
          {metadata.verified && <VerifiedBadge />}
          {metadata.premium && <PremiumBadge />}
        </div>
      </div>

      {/* Widget Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate pr-2">
            {config.name}
          </h3>
          <div className="text-right">
            {metadata.price > 0 ? (
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                ${metadata.price}
              </span>
            ) : (
              <span className="text-lg font-bold text-green-600">Free</span>
            )}
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
          {config.description}
        </p>

        <div className="flex items-center justify-between mb-3">
          <RatingDisplay rating={metadata.rating} reviewCount={metadata.reviewCount} />
          <span className="text-xs text-gray-500">
            {metadata.downloadCount.toLocaleString()} downloads
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            by {config.author.name}
          </div>

          <WidgetActions
            widget={widget}
            onInstall={onInstall}
            onUninstall={onUninstall}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </div>
  );
};

// Supporting Components
const FeaturedBadge = () => (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
    ⭐ Featured
  </span>
);

const VerifiedBadge = () => (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
    ✓ Verified
  </span>
);

const PremiumBadge = () => (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
    💎 Premium
  </span>
);

const RatingDisplay: React.FC<{ rating: number; reviewCount: number }> = ({ rating, reviewCount }) => (
  <div className="flex items-center space-x-1">
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map(star => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
    <span className="text-sm text-gray-600">({reviewCount})</span>
  </div>
);

const WidgetActions: React.FC<{
  widget: MarketplaceWidget;
  onInstall: () => void;
  onUninstall: () => void;
  onUpdate: () => void;
  compact?: boolean;
}> = ({ widget, onInstall, onUninstall, onUpdate, compact }) => {
  if (widget.isInstalled) {
    if (widget.canUpdate) {
      return (
        <button
          onClick={onUpdate}
          className={`btn-primary ${compact ? 'text-xs px-2 py-1' : ''}`}
          data-testid="update-widget"
        >
          Update
        </button>
      );
    }

    return (
      <button
        onClick={onUninstall}
        className={`btn-secondary ${compact ? 'text-xs px-2 py-1' : ''}`}
        data-testid="uninstall-widget"
      >
        Uninstall
      </button>
    );
  }

  return (
    <button
      onClick={onInstall}
      className={`btn-primary ${compact ? 'text-xs px-2 py-1' : ''}`}
      data-testid="install-widget"
    >
      Install
    </button>
  );
};

// Icons
const GridIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

// Utility functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Mock data loader (replace with real API)
const loadMockWidgets = async (): Promise<MarketplaceWidget[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return [
    {
      config: {
        id: 'stock-chart-pro',
        name: 'Stock Chart Pro',
        version: '2.1.0',
        description: 'Advanced stock charting with technical indicators and drawing tools',
        category: WidgetCategory.CHARTS,
        permissions: [WidgetPermission.READ_MARKET_DATA],
        settings: {},
        dimensions: { minWidth: 4, minHeight: 3, resizable: true },
        author: { name: 'ChartMaster', email: 'support@chartmaster.com', verified: true },
        entryPoint: '/widgets/stock-chart-pro/index.js',
        previewUrl: '/widgets/stock-chart-pro/preview.png'
      },
      metadata: {
        featured: true,
        verified: true,
        premium: false,
        price: 0,
        currency: 'USD',
        downloadCount: 15420,
        rating: 4.8,
        reviewCount: 324,
        lastUpdated: new Date('2024-01-15'),
        compatibility: ['1.0.0+'],
        size: 2500000,
        license: 'MIT',
        support: {
          email: 'support@chartmaster.com',
          documentation: 'https://docs.chartmaster.com'
        }
      },
      stats: {
        downloads: 15420,
        activeInstalls: 8230,
        averageRating: 4.8,
        ratingDistribution: { 5: 250, 4: 60, 3: 10, 2: 3, 1: 1 },
        performanceScore: 92,
        securityScore: 95
      },
      reviews: [],
      versions: [
        {
          version: '2.1.0',
          releaseDate: new Date('2024-01-15'),
          changelog: 'Added new technical indicators and improved performance',
          breaking: false,
          size: 2500000,
          downloadUrl: '/api/widgets/download/stock-chart-pro/2.1.0'
        }
      ],
      screenshots: ['/widgets/stock-chart-pro/screenshot1.png'],
      isInstalled: false,
      canUpdate: false
    }
    // Additional mock widgets would be added here...
  ];
};

// Import the filters and details modal components
import MarketplaceFilters from './MarketplaceFilters';
import WidgetDetailsModal from './WidgetDetailsModal';

export default WidgetMarketplace;