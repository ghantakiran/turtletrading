/**
 * Marketplace Filters Component
 * Advanced filtering and search for widget marketplace
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetCategory, WidgetPermission } from '../sdk/WidgetSDK';
import { SearchFilters, SortOptions } from './WidgetMarketplace';

interface MarketplaceFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  sortBy: SortOptions;
  onSortChange: (sort: SortOptions) => void;
}

const MarketplaceFilters: React.FC<MarketplaceFiltersProps> = ({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  sortBy,
  onSortChange
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>(filters.priceRange || [0, 100]);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  const handlePriceRangeChange = useCallback((range: [number, number]) => {
    setPriceRange(range);
    handleFilterChange('priceRange', range);
  }, [handleFilterChange]);

  const clearFilters = useCallback(() => {
    onFiltersChange({});
    setPriceRange([0, 100]);
  }, [onFiltersChange]);

  const activeFilterCount = Object.keys(filters).length;

  return (
    <div className="marketplace-filters space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search widgets..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          data-testid="search-input"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            data-testid="clear-search"
          >
            <XIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Quick Filters and Sort */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Filters */}
          <QuickFilterButton
            active={filters.featured}
            onClick={() => handleFilterChange('featured', !filters.featured)}
            icon="⭐"
          >
            Featured
          </QuickFilterButton>

          <QuickFilterButton
            active={filters.verified}
            onClick={() => handleFilterChange('verified', !filters.verified)}
            icon="✓"
          >
            Verified
          </QuickFilterButton>

          <QuickFilterButton
            active={filters.free}
            onClick={() => handleFilterChange('free', !filters.free)}
            icon="🆓"
          >
            Free
          </QuickFilterButton>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showAdvancedFilters || activeFilterCount > 0
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
            data-testid="advanced-filters-toggle"
          >
            <FilterIcon className="w-4 h-4 mr-1" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary-500 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              data-testid="clear-filters"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Sort Options */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
          <select
            value={`${sortBy.field}-${sortBy.order}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as [SortOptions['field'], SortOptions['order']];
              onSortChange({ field, order });
            }}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            data-testid="sort-select"
          >
            <option value="downloads-desc">Most Downloads</option>
            <option value="rating-desc">Highest Rated</option>
            <option value="updated-desc">Recently Updated</option>
            <option value="name-asc">Name A-Z</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50"
            data-testid="advanced-filters"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  data-testid="category-filter"
                >
                  <option value="">All Categories</option>
                  {Object.values(WidgetCategory).map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Minimum Rating
                </label>
                <select
                  value={filters.rating || ''}
                  onChange={(e) => handleFilterChange('rating', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  data-testid="rating-filter"
                >
                  <option value="">Any Rating</option>
                  <option value="4">4+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="2">2+ Stars</option>
                  <option value="1">1+ Stars</option>
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price Range
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">$0</span>
                    <div className="flex-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={priceRange[1]}
                        onChange={(e) => handlePriceRangeChange([priceRange[0], Number(e.target.value)])}
                        className="w-full"
                        data-testid="price-range"
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">${priceRange[1]}</span>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    Free to ${priceRange[1]}
                  </div>
                </div>
              </div>

              {/* Compatibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Compatibility
                </label>
                <select
                  value={filters.compatibility?.[0] || ''}
                  onChange={(e) => handleFilterChange('compatibility', e.target.value ? [e.target.value] : undefined)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  data-testid="compatibility-filter"
                >
                  <option value="">All Versions</option>
                  <option value="1.0.0+">v1.0.0+</option>
                  <option value="1.1.0+">v1.1.0+</option>
                  <option value="2.0.0+">v2.0.0+</option>
                </select>
              </div>
            </div>

            {/* Permissions Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Required Permissions
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {Object.values(WidgetPermission).map(permission => (
                  <label key={permission} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.permissions?.includes(permission) || false}
                      onChange={(e) => {
                        const current = filters.permissions || [];
                        const updated = e.target.checked
                          ? [...current, permission]
                          : current.filter(p => p !== permission);
                        handleFilterChange('permissions', updated.length > 0 ? updated : undefined);
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      data-testid={`permission-${permission}`}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {permission.replace(/[_:]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Quick Filter Button Component
interface QuickFilterButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}

const QuickFilterButton: React.FC<QuickFilterButtonProps> = ({ active, onClick, icon, children }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      active
        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
    }`}
    data-testid={`quick-filter-${children?.toString().toLowerCase()}`}
  >
    <span className="mr-1">{icon}</span>
    {children}
  </button>
);

// Icons
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const FilterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
  </svg>
);

export default MarketplaceFilters;