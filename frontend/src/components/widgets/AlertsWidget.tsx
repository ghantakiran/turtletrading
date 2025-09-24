import React, { useState } from 'react';

interface Alert {
  id: string;
  symbol: string;
  type: 'price' | 'technical' | 'volume' | 'news' | 'sentiment';
  priority: 'low' | 'medium' | 'high' | 'critical';
  condition: string;
  currentValue: number | string;
  targetValue: number | string;
  triggered: boolean;
  createdAt: string;
  triggeredAt?: string;
  message: string;
}

interface AlertsKPI {
  totalAlerts: number;
  activeAlerts: number;
  triggeredToday: number;
  accuracy: number;
  avgResponseTime: number;
}

const AlertsWidget: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Mock alerts data - would come from API/store in production
  const alerts: Alert[] = [
    {
      id: '1',
      symbol: 'AAPL',
      type: 'price',
      priority: 'high',
      condition: 'above',
      currentValue: 235.50,
      targetValue: 240.00,
      triggered: false,
      createdAt: '2024-01-15T09:30:00Z',
      message: 'AAPL price target $240.00 reached'
    },
    {
      id: '2',
      symbol: 'TSLA',
      type: 'technical',
      priority: 'medium',
      condition: 'RSI oversold',
      currentValue: 28.5,
      targetValue: 30,
      triggered: true,
      createdAt: '2024-01-15T10:15:00Z',
      triggeredAt: '2024-01-15T11:23:00Z',
      message: 'TSLA RSI indicates oversold condition'
    },
    {
      id: '3',
      symbol: 'NVDA',
      type: 'volume',
      priority: 'critical',
      condition: 'volume spike',
      currentValue: '2.5M',
      targetValue: '2.0M',
      triggered: true,
      createdAt: '2024-01-15T08:45:00Z',
      triggeredAt: '2024-01-15T10:12:00Z',
      message: 'NVDA unusual volume activity detected'
    },
    {
      id: '4',
      symbol: 'GOOGL',
      type: 'news',
      priority: 'low',
      condition: 'earnings related',
      currentValue: 'positive',
      targetValue: 'negative',
      triggered: false,
      createdAt: '2024-01-15T07:30:00Z',
      message: 'GOOGL earnings sentiment shift detected'
    },
    {
      id: '5',
      symbol: 'SPY',
      type: 'sentiment',
      priority: 'medium',
      condition: 'fear index',
      currentValue: 75,
      targetValue: 80,
      triggered: false,
      createdAt: '2024-01-15T11:00:00Z',
      message: 'Market fear index approaching extreme levels'
    }
  ];

  const kpis: AlertsKPI = {
    totalAlerts: alerts.length,
    activeAlerts: alerts.filter(a => !a.triggered).length,
    triggeredToday: alerts.filter(a => a.triggered).length,
    accuracy: 87.5,
    avgResponseTime: 2.3
  };

  const categories = [
    { key: 'all', label: 'All', count: alerts.length },
    { key: 'price', label: 'Price', count: alerts.filter(a => a.type === 'price').length },
    { key: 'technical', label: 'Technical', count: alerts.filter(a => a.type === 'technical').length },
    { key: 'volume', label: 'Volume', count: alerts.filter(a => a.type === 'volume').length },
    { key: 'news', label: 'News', count: alerts.filter(a => a.type === 'news').length },
    { key: 'sentiment', label: 'Sentiment', count: alerts.filter(a => a.type === 'sentiment').length }
  ];

  const filteredAlerts = alerts.filter(alert => {
    const categoryMatch = selectedCategory === 'all' || alert.type === selectedCategory;
    const priorityMatch = selectedPriority === 'all' || alert.priority === selectedPriority;
    return categoryMatch && priorityMatch;
  });

  const getPriorityColor = (priority: string, triggered: boolean = false) => {
    const colors = {
      low: triggered ? 'bg-secondary-600 text-secondary-300' : 'bg-secondary-700 text-secondary-400',
      medium: triggered ? 'bg-warning-600 text-warning-200' : 'bg-warning-900/30 text-warning-400',
      high: triggered ? 'bg-error-600 text-error-200' : 'bg-error-900/30 text-error-400',
      critical: triggered ? 'bg-error-500 text-white animate-pulse' : 'bg-error-800 text-error-300'
    };
    return colors[priority as keyof typeof colors] || colors.low;
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      price: '💰',
      technical: '📊',
      volume: '📈',
      news: '📰',
      sentiment: '😊'
    };
    return icons[type as keyof typeof icons] || '⚠️';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="card h-full" data-testid="alerts-widget">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-secondary-100">Alerts</h2>
        </div>
        <button
          className="text-xs text-secondary-400 hover:text-secondary-100 transition-colors"
          data-testid="alerts-create-new"
        >
          + New Alert
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" data-testid="alerts-kpis">
        <div className="text-center">
          <div className="text-lg font-bold text-secondary-100">{kpis.totalAlerts}</div>
          <div className="text-xs text-secondary-400">Total</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-primary-400">{kpis.activeAlerts}</div>
          <div className="text-xs text-secondary-400">Active</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-success-400">{kpis.triggeredToday}</div>
          <div className="text-xs text-secondary-400">Today</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-warning-400">{kpis.accuracy}%</div>
          <div className="text-xs text-secondary-400">Accuracy</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-secondary-100">{kpis.avgResponseTime}s</div>
          <div className="text-xs text-secondary-400">Avg Time</div>
        </div>
      </div>

      {/* Categories */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2" data-testid="alert-categories">
          {categories.map(category => (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedCategory === category.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
              }`}
            >
              {category.label} ({category.count})
            </button>
          ))}
        </div>
      </div>

      {/* Priority Filter */}
      <div className="mb-4">
        <div className="flex gap-2" data-testid="priority-filters">
          {['all', 'critical', 'high', 'medium', 'low'].map(priority => (
            <button
              key={priority}
              onClick={() => setSelectedPriority(priority)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                selectedPriority === priority
                  ? 'bg-primary-500 text-white'
                  : 'bg-secondary-700 text-secondary-400 hover:bg-secondary-600'
              }`}
            >
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-secondary-400">
            <svg className="h-12 w-12 mx-auto mb-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p>No alerts match your filters</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                alert.triggered
                  ? 'bg-background-tertiary border-secondary-600'
                  : 'bg-background-secondary border-secondary-700 hover:border-secondary-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {/* Type Icon & Symbol */}
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getTypeIcon(alert.type)}</span>
                    <span className="font-medium text-secondary-100">{alert.symbol}</span>
                  </div>

                  {/* Alert Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-secondary-200 truncate">
                      {alert.message}
                    </div>
                    <div className="flex items-center space-x-2 mt-1 text-xs text-secondary-400">
                      <span>{alert.condition}</span>
                      <span>•</span>
                      <span>
                        {alert.currentValue} {alert.type === 'price' ? '→' : '/'} {alert.targetValue}
                      </span>
                      <span>•</span>
                      <span>{formatTime(alert.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Priority Chip & Status */}
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    getPriorityColor(alert.priority, alert.triggered)
                  }`}>
                    {alert.priority.toUpperCase()}
                  </span>
                  {alert.triggered ? (
                    <div className="flex items-center text-xs text-success-400">
                      <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Triggered
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-secondary-400">
                      <svg className="h-3 w-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                      </svg>
                      Monitoring
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-secondary-700">
                <div className="flex space-x-2">
                  <button className="text-xs text-secondary-400 hover:text-secondary-200 transition-colors">
                    Edit
                  </button>
                  <button className="text-xs text-error-400 hover:text-error-300 transition-colors">
                    Delete
                  </button>
                </div>
                {alert.triggered && alert.triggeredAt && (
                  <div className="text-xs text-secondary-400">
                    Triggered at {formatTime(alert.triggeredAt)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-4 border-t border-secondary-700 mt-4">
        <div className="flex items-center justify-between">
          <button
            className="text-sm text-secondary-400 hover:text-secondary-200 transition-colors"
            data-testid="alerts-view-history"
          >
            View Alert History
          </button>
          <button
            className="btn-primary py-2 px-4 text-sm"
            data-testid="alerts-manage-all"
          >
            Manage All
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertsWidget;