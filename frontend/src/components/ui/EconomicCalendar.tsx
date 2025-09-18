import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Globe,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Star,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Bell,
  Eye,
  EyeOff
} from 'lucide-react';

interface EconomicEvent {
  id: string;
  time: Date;
  event: string;
  country: string;
  currency: string;
  importance: 'low' | 'medium' | 'high';
  category: 'employment' | 'inflation' | 'central_bank' | 'gdp' | 'manufacturing' | 'services' | 'trade' | 'housing' | 'consumer';
  actual?: number | string;
  forecast?: number | string;
  previous?: number | string;
  unit?: string;
  impact: 'bullish' | 'bearish' | 'neutral' | 'unknown';
  volatilityExpected: boolean;
  affectedSymbols: string[];
  description: string;
  isWatched: boolean;
}

interface EconomicCalendarProps {
  events: EconomicEvent[];
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  onEventWatch?: (eventId: string) => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

const EconomicCalendar: React.FC<EconomicCalendarProps> = ({
  events,
  selectedDate,
  onDateChange,
  onEventWatch,
  onRefresh,
  onExport
}) => {
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [filterImportance, setFilterImportance] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showPastEvents, setShowPastEvents] = useState(true);

  const countries = Array.from(new Set(events.map(e => e.country))).sort();
  const categories = Array.from(new Set(events.map(e => e.category))).sort();

  const getImportanceColor = (importance: string): string => {
    switch (importance) {
      case 'high':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'low':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
    }
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'bullish':
        return 'text-bull-600 dark:text-bull-400';
      case 'bearish':
        return 'text-bear-600 dark:text-bear-400';
      case 'neutral':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-500 dark:text-gray-500';
    }
  };

  const getCategoryIcon = (category: string): React.ReactNode => {
    switch (category) {
      case 'employment':
        return <TrendingUp className="w-4 h-4" />;
      case 'inflation':
        return <TrendingUp className="w-4 h-4" />;
      case 'central_bank':
        return <Star className="w-4 h-4" />;
      case 'gdp':
        return <BarChart3 className="w-4 h-4" />;
      case 'manufacturing':
        return <Cog className="w-4 h-4" />;
      default:
        return <Globe className="w-4 h-4" />;
    }
  };

  const getFlagEmoji = (country: string): string => {
    const flagMap: Record<string, string> = {
      'United States': '🇺🇸',
      'United Kingdom': '🇬🇧',
      'Germany': '🇩🇪',
      'Japan': '🇯🇵',
      'Canada': '🇨🇦',
      'Australia': '🇦🇺',
      'Switzerland': '🇨🇭',
      'France': '🇫🇷',
      'Italy': '🇮🇹',
      'Spain': '🇪🇸',
      'China': '🇨🇳',
      'India': '🇮🇳',
      'Brazil': '🇧🇷',
      'Mexico': '🇲🇽',
      'South Korea': '🇰🇷',
      'Eurozone': '🇪🇺'
    };
    return flagMap[country] || '🌍';
  };

  const formatValue = (value: number | string | undefined, unit?: string): string => {
    if (value === undefined || value === null) return 'N/A';

    if (typeof value === 'number') {
      if (unit === '%') return `${value.toFixed(1)}%`;
      if (unit === 'K' || unit === 'M' || unit === 'B') return `${value.toLocaleString()}${unit}`;
      return value.toLocaleString();
    }

    return value.toString();
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);

    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }

    onDateChange?.(newDate);
  };

  const filteredEvents = events.filter(event => {
    const now = new Date();
    const eventDate = new Date(event.time);

    // Time filter
    if (!showPastEvents && eventDate < now) return false;

    // Date range filter based on view mode
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    let endDate: Date;
    switch (viewMode) {
      case 'day':
        endDate = new Date(startOfDay);
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'week':
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
        endDate = new Date(startOfWeek);
        endDate.setDate(endDate.getDate() + 7);
        if (eventDate < startOfWeek || eventDate >= endDate) return false;
        break;
      case 'month':
        const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
        endDate = new Date(startOfDay.getFullYear(), startOfDay.getMonth() + 1, 1);
        if (eventDate < startOfMonth || eventDate >= endDate) return false;
        break;
      default:
        endDate = new Date(startOfDay);
        endDate.setDate(endDate.getDate() + 1);
    }

    if (viewMode === 'day' && (eventDate < startOfDay || eventDate >= endDate)) return false;

    // Other filters
    return (
      (filterImportance === 'all' || event.importance === filterImportance) &&
      (filterCountry === 'all' || event.country === filterCountry) &&
      (filterCategory === 'all' || event.category === filterCategory)
    );
  }).sort((a, b) => a.time.getTime() - b.time.getTime());

  const groupedEvents = viewMode === 'week' || viewMode === 'month'
    ? filteredEvents.reduce((groups, event) => {
        const dateKey = event.time.toDateString();
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(event);
        return groups;
      }, {} as Record<string, EconomicEvent[]>)
    : { [selectedDate.toDateString()]: filteredEvents };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Calendar className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Economic Calendar</h2>
              <p className="text-blue-100">
                {filteredEvents.length} events • {selectedDate.toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onExport}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm text-blue-100">High Impact</span>
            </div>
            <div className="text-2xl font-bold">
              {filteredEvents.filter(e => e.importance === 'high').length}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm text-blue-100">Bullish</span>
            </div>
            <div className="text-2xl font-bold">
              {filteredEvents.filter(e => e.impact === 'bullish').length}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingDown className="w-5 h-5" />
              <span className="text-sm text-blue-100">Bearish</span>
            </div>
            <div className="text-2xl font-bold">
              {filteredEvents.filter(e => e.impact === 'bearish').length}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Globe className="w-5 h-5" />
              <span className="text-sm text-blue-100">Countries</span>
            </div>
            <div className="text-2xl font-bold">
              {new Set(filteredEvents.map(e => e.country)).size}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Date Navigation */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>

              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[200px] text-center">
                {viewMode === 'day' && selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {viewMode === 'week' && `Week of ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {viewMode === 'month' && selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>

              <button
                onClick={() => navigateDate('next')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4">
            <select
              value={filterImportance}
              onChange={(e) => setFilterImportance(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">All Impact</option>
              <option value="high">High Impact</option>
              <option value="medium">Medium Impact</option>
              <option value="low">Low Impact</option>
            </select>

            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">All Countries</option>
              {countries.map(country => (
                <option key={country} value={country}>
                  {getFlagEmoji(country)} {country}
                </option>
              ))}
            </select>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showPastEvents}
                onChange={(e) => setShowPastEvents(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show Past</span>
            </label>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="max-h-[600px] overflow-y-auto">
        {Object.entries(groupedEvents).length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No events found for the selected criteria.</p>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
            <div key={dateKey} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
              {/* Date Header (for week/month view) */}
              {(viewMode === 'week' || viewMode === 'month') && (
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(dateKey).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {dayEvents.length} events
                  </p>
                </div>
              )}

              {/* Events for this date */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {dayEvents.map((event) => {
                  const isPast = event.time < new Date();
                  const isWatched = event.isWatched;

                  return (
                    <div
                      key={event.id}
                      className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        isPast ? 'opacity-70' : ''
                      } ${isWatched ? 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500' : ''}`}
                    >
                      <div className="flex items-start space-x-4">
                        {/* Time & Country */}
                        <div className="flex-shrink-0 text-center">
                          <div className="text-2xl mb-1">{getFlagEmoji(event.country)}</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {event.time.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {event.currency}
                          </div>
                        </div>

                        {/* Event Details */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                {event.event}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {event.description}
                              </p>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getImportanceColor(event.importance)}`}>
                                  {event.importance.toUpperCase()}
                                </span>
                                {event.volatilityExpected && (
                                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                                    HIGH VOLATILITY
                                  </span>
                                )}
                                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                  {event.category.replace('_', ' ')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => onEventWatch?.(event.id)}
                                className={`p-1 rounded transition-colors ${
                                  isWatched
                                    ? 'text-blue-500 hover:text-blue-600'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                              >
                                <Bell className={`w-4 h-4 ${isWatched ? 'fill-current' : ''}`} />
                              </button>
                            </div>
                          </div>

                          {/* Data Values */}
                          <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="text-center">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Actual</div>
                              <div className={`text-sm font-semibold ${
                                event.actual !== undefined
                                  ? getImpactColor(event.impact)
                                  : 'text-gray-400 dark:text-gray-600'
                              }`}>
                                {formatValue(event.actual, event.unit)}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Forecast</div>
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {formatValue(event.forecast, event.unit)}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Previous</div>
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {formatValue(event.previous, event.unit)}
                              </div>
                            </div>
                          </div>

                          {/* Affected Symbols */}
                          {event.affectedSymbols.length > 0 && (
                            <div className="mt-4">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Affected symbols:</div>
                              <div className="flex flex-wrap gap-2">
                                {event.affectedSymbols.slice(0, 5).map((symbol) => (
                                  <span
                                    key={symbol}
                                    className="px-2 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-xs font-medium rounded"
                                  >
                                    {symbol}
                                  </span>
                                ))}
                                {event.affectedSymbols.length > 5 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    +{event.affectedSymbols.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Showing {filteredEvents.length} events</span>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-100 dark:bg-red-900/20 rounded"></div>
                <span className="text-xs">High Impact</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900/20 rounded"></div>
                <span className="text-xs">Medium Impact</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-100 dark:bg-green-900/20 rounded"></div>
                <span className="text-xs">Low Impact</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Real-time data</span>
            </div>
            <span>Last updated: {new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Import the missing Cog component or define it
const BarChart3: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const Cog: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default EconomicCalendar;