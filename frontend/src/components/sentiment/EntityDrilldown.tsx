import React, { useState, useEffect, useMemo } from 'react';
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CalendarIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  UserIcon,
  MapPinIcon,
  TagIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon
} from '@heroicons/react/24/outline';

interface Entity {
  id: string;
  text: string;
  type: 'company' | 'ticker' | 'person' | 'organization' | 'location' | 'event' | 'product' | 'currency';
  ticker_symbol?: string;
  confidence_score: number;
  mention_count: number;
  sentiment_score: number;
  sentiment_trend: number[];
  relevance_score: number;
  last_mentioned: string;
  related_entities: string[];
}

interface FilterCriteria {
  searchQuery: string;
  entityTypes: string[];
  sentimentRange: [number, number];
  confidenceThreshold: number;
  dateRange: {
    start: string;
    end: string;
  };
  sortBy: 'relevance' | 'mentions' | 'sentiment' | 'recency';
  sortOrder: 'asc' | 'desc';
}

interface EntityDrilldownProps {
  entities: Entity[];
  onEntitySelect?: (entity: Entity) => void;
  onFilterChange?: (filters: FilterCriteria) => void;
  className?: string;
  showFilters?: boolean;
  maxResults?: number;
}

const EntityDrilldown: React.FC<EntityDrilldownProps> = ({
  entities,
  onEntitySelect,
  onFilterChange,
  className = '',
  showFilters = true,
  maxResults = 100
}) => {
  const [filters, setFilters] = useState<FilterCriteria>({
    searchQuery: '',
    entityTypes: [],
    sentimentRange: [-1, 1],
    confidenceThreshold: 0.3,
    dateRange: {
      start: '',
      end: ''
    },
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Entity type configuration
  const entityTypeConfig = {
    company: { icon: BuildingOfficeIcon, label: 'Companies', color: 'text-blue-500' },
    ticker: { icon: ChartBarIcon, label: 'Tickers', color: 'text-green-500' },
    person: { icon: UserIcon, label: 'People', color: 'text-purple-500' },
    organization: { icon: BuildingOfficeIcon, label: 'Organizations', color: 'text-orange-500' },
    location: { icon: MapPinIcon, label: 'Locations', color: 'text-red-500' },
    event: { icon: CalendarIcon, label: 'Events', color: 'text-yellow-500' },
    product: { icon: TagIcon, label: 'Products', color: 'text-pink-500' },
    currency: { icon: ChartBarIcon, label: 'Currencies', color: 'text-indigo-500' }
  };

  // Filter and sort entities
  const filteredEntities = useMemo(() => {
    let filtered = entities.filter(entity => {
      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!entity.text.toLowerCase().includes(query) &&
            !entity.ticker_symbol?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Entity type filter
      if (filters.entityTypes.length > 0 && !filters.entityTypes.includes(entity.type)) {
        return false;
      }

      // Sentiment range filter
      if (entity.sentiment_score < filters.sentimentRange[0] ||
          entity.sentiment_score > filters.sentimentRange[1]) {
        return false;
      }

      // Confidence threshold filter
      if (entity.confidence_score < filters.confidenceThreshold) {
        return false;
      }

      // Date range filter (simplified - would need actual implementation)
      if (filters.dateRange.start && filters.dateRange.end) {
        const entityDate = new Date(entity.last_mentioned);
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        if (entityDate < startDate || entityDate > endDate) {
          return false;
        }
      }

      return true;
    });

    // Sort entities
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (filters.sortBy) {
        case 'mentions':
          aValue = a.mention_count;
          bValue = b.mention_count;
          break;
        case 'sentiment':
          aValue = a.sentiment_score;
          bValue = b.sentiment_score;
          break;
        case 'recency':
          aValue = new Date(a.last_mentioned).getTime();
          bValue = new Date(b.last_mentioned).getTime();
          break;
        case 'relevance':
        default:
          aValue = a.relevance_score;
          bValue = b.relevance_score;
          break;
      }

      return filters.sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    return filtered.slice(0, maxResults);
  }, [entities, filters, maxResults]);

  // Update parent component when filters change
  useEffect(() => {
    onFilterChange?.(filters);
  }, [filters, onFilterChange]);

  const updateFilter = <K extends keyof FilterCriteria>(key: K, value: FilterCriteria[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      entityTypes: [],
      sentimentRange: [-1, 1],
      confidenceThreshold: 0.3,
      dateRange: { start: '', end: '' },
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  };

  const getSentimentIcon = (score: number) => {
    if (score > 0.1) return <ArrowTrendingUpIcon className="h-4 w-4 text-bull-500" />;
    if (score < -0.1) return <ArrowTrendingDownIcon className="h-4 w-4 text-bear-500" />;
    return <MinusIcon className="h-4 w-4 text-neutral-400" />;
  };

  const getSentimentColor = (score: number): string => {
    if (score >= 0.3) return 'bg-bull-500/10 text-bull-500 border-bull-500/20';
    if (score <= -0.3) return 'bg-bear-500/10 text-bear-500 border-bear-500/20';
    return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`entity-drilldown ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold">Entity Analysis</h2>
          <span className="px-2 py-1 bg-muted text-muted-foreground text-sm rounded-md">
            {filteredEntities.length} entities
          </span>
        </div>

        {showFilters && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md border transition-colors ${
                showFilterPanel ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
              <span>Filters</span>
            </button>

            {(filters.searchQuery || filters.entityTypes.length > 0 ||
              filters.confidenceThreshold > 0.3 || filters.dateRange.start) && (
              <button
                onClick={clearFilters}
                className="flex items-center space-x-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <XMarkIcon className="h-4 w-4" />
                <span>Clear</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && showFilterPanel && (
        <div className="p-4 bg-muted/50 border-b border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => updateFilter('searchQuery', e.target.value)}
                  placeholder="Search entities..."
                  className="pl-10 pr-4 py-2 w-full border border-border rounded-md bg-background"
                />
              </div>
            </div>

            {/* Entity Types */}
            <div>
              <label className="block text-sm font-medium mb-2">Entity Types</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {Object.entries(entityTypeConfig).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={filters.entityTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateFilter('entityTypes', [...filters.entityTypes, type]);
                          } else {
                            updateFilter('entityTypes', filters.entityTypes.filter(t => t !== type));
                          }
                        }}
                        className="rounded border-border"
                      />
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <span className="text-sm">{config.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Sentiment Range */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Sentiment Range ({filters.sentimentRange[0].toFixed(1)} to {filters.sentimentRange[1].toFixed(1)})
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={filters.sentimentRange[0]}
                  onChange={(e) => updateFilter('sentimentRange', [parseFloat(e.target.value), filters.sentimentRange[1]])}
                  className="w-full"
                />
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={filters.sentimentRange[1]}
                  onChange={(e) => updateFilter('sentimentRange', [filters.sentimentRange[0], parseFloat(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>

            {/* Confidence Threshold */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Min Confidence ({(filters.confidenceThreshold * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={filters.confidenceThreshold}
                onChange={(e) => updateFilter('confidenceThreshold', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium mb-2">Date Range</label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                />
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                />
              </div>
            </div>

            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <div className="space-y-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value as FilterCriteria['sortBy'])}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="relevance">Relevance</option>
                  <option value="mentions">Mentions</option>
                  <option value="sentiment">Sentiment</option>
                  <option value="recency">Recency</option>
                </select>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => updateFilter('sortOrder', e.target.value as 'asc' | 'desc')}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entity List */}
      <div className="flex-1 overflow-hidden">
        {filteredEntities.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No entities found matching your criteria</p>
              <button
                onClick={clearFilters}
                className="mt-2 text-primary hover:underline"
              >
                Clear filters to see all entities
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="space-y-2 p-4">
              {filteredEntities.map((entity) => {
                const EntityIcon = entityTypeConfig[entity.type]?.icon || TagIcon;
                const entityColor = entityTypeConfig[entity.type]?.color || 'text-gray-500';

                return (
                  <div
                    key={entity.id}
                    className={`p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                      selectedEntity?.id === entity.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedEntity(entity);
                      onEntitySelect?.(entity);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedEntity(entity);
                        onEntitySelect?.(entity);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <EntityIcon className={`h-5 w-5 mt-0.5 ${entityColor}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium truncate">{entity.text}</h3>
                            {entity.ticker_symbol && (
                              <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md font-mono">
                                {entity.ticker_symbol}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                            <span>{entity.mention_count} mentions</span>
                            <span>{(entity.confidence_score * 100).toFixed(0)}% confidence</span>
                            <span>{formatTimestamp(entity.last_mentioned)}</span>
                          </div>

                          {entity.related_entities.length > 0 && (
                            <div className="mt-2">
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-muted-foreground">Related:</span>
                                {entity.related_entities.slice(0, 3).map((related, index) => (
                                  <span
                                    key={index}
                                    className="px-1.5 py-0.5 bg-muted text-xs rounded"
                                  >
                                    {related}
                                  </span>
                                ))}
                                {entity.related_entities.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{entity.related_entities.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 ml-4">
                        {/* Sentiment indicator */}
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border ${getSentimentColor(entity.sentiment_score)}`}>
                          {getSentimentIcon(entity.sentiment_score)}
                          <span className="text-xs font-medium">
                            {entity.sentiment_score > 0 ? '+' : ''}{entity.sentiment_score.toFixed(2)}
                          </span>
                        </div>

                        {/* Mini trend chart */}
                        {entity.sentiment_trend.length > 0 && (
                          <div className="w-16 h-8">
                            <svg viewBox="0 0 64 32" className="w-full h-full">
                              <polyline
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1"
                                points={entity.sentiment_trend
                                  .map((value, index) => {
                                    const x = (index / (entity.sentiment_trend.length - 1)) * 60 + 2;
                                    const y = 30 - ((value + 1) / 2) * 28;
                                    return `${x},${y}`;
                                  })
                                  .join(' ')}
                                className={entity.sentiment_score > 0 ? 'text-bull-500' : entity.sentiment_score < 0 ? 'text-bear-500' : 'text-neutral-400'}
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityDrilldown;