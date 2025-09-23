import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, TrendingUp, TrendingDown, Activity, X } from 'lucide-react';
import { useMarketStore } from '../../stores/marketStore';
import { useUIStore } from '../../stores/uiStore';

export interface RegimeAlert {
  id: string;
  type: 'regime_change' | 'anomaly' | 'volatility_spike';
  symbol: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  details: {
    from_regime?: string;
    to_regime?: string;
    confidence?: number;
    anomaly_score?: number;
    volatility_change?: number;
  };
  acknowledged: boolean;
}

interface RegimeAlertsProps {
  symbol?: string;
  showOnlyUnacknowledged?: boolean;
  maxDisplayed?: number;
  autoHide?: boolean;
  className?: string;
}

const severityConfig = {
  low: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: Activity
  },
  medium: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    icon: TrendingUp
  },
  high: {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: TrendingDown
  },
  critical: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: AlertTriangle
  }
};

export const RegimeAlerts: React.FC<RegimeAlertsProps> = ({
  symbol,
  showOnlyUnacknowledged = false,
  maxDisplayed = 5,
  autoHide = true,
  className = ''
}) => {
  const { alerts, addAlert, removeAlert, acknowledgeAlert } = useMarketStore();
  const { showNotification } = useUIStore();
  const [displayedAlerts, setDisplayedAlerts] = useState<RegimeAlert[]>([]);

  // Filter and sort alerts
  useEffect(() => {
    let filteredAlerts = alerts.filter((alert): alert is RegimeAlert => {
      // Type guard to ensure we're working with RegimeAlert
      if (!('type' in alert) || !['regime_change', 'anomaly', 'volatility_spike'].includes(alert.type)) {
        return false;
      }

      if (symbol && alert.symbol !== symbol) return false;
      if (showOnlyUnacknowledged && alert.acknowledged) return false;

      return true;
    });

    // Sort by timestamp (newest first) and severity
    filteredAlerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;

      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setDisplayedAlerts(filteredAlerts.slice(0, maxDisplayed));
  }, [alerts, symbol, showOnlyUnacknowledged, maxDisplayed]);

  // Auto-hide acknowledged alerts after delay
  useEffect(() => {
    if (!autoHide) return;

    const hideTimer = setTimeout(() => {
      setDisplayedAlerts(prev => prev.filter(alert => !alert.acknowledged));
    }, 3000);

    return () => clearTimeout(hideTimer);
  }, [displayedAlerts, autoHide]);

  const handleAcknowledge = (alertId: string) => {
    acknowledgeAlert(alertId);
    showNotification({
      type: 'success',
      message: 'Alert acknowledged',
      duration: 2000
    });
  };

  const handleDismiss = (alertId: string) => {
    removeAlert(alertId);
    showNotification({
      type: 'info',
      message: 'Alert dismissed',
      duration: 2000
    });
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderAlertContent = (alert: RegimeAlert) => {
    const config = severityConfig[alert.severity];
    const IconComponent = config.icon;

    return (
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 p-2 rounded-lg ${config.bgColor}`}>
          <IconComponent
            className={`h-5 w-5 ${config.color}`}
            aria-hidden="true"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {alert.title}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              {formatTimestamp(alert.timestamp)}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {alert.message}
          </p>

          {alert.details && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              {alert.details.from_regime && alert.details.to_regime && (
                <div>
                  Regime: {alert.details.from_regime} → {alert.details.to_regime}
                </div>
              )}
              {alert.details.confidence && (
                <div>
                  Confidence: {(alert.details.confidence * 100).toFixed(1)}%
                </div>
              )}
              {alert.details.anomaly_score && (
                <div>
                  Anomaly Score: {alert.details.anomaly_score.toFixed(2)}
                </div>
              )}
              {alert.details.volatility_change && (
                <div>
                  Volatility Change: {(alert.details.volatility_change * 100).toFixed(1)}%
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
              {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
            </span>

            <div className="flex space-x-2">
              {!alert.acknowledged && (
                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                  aria-label={`Acknowledge alert for ${alert.symbol}`}
                >
                  Acknowledge
                </button>
              )}
              <button
                onClick={() => handleDismiss(alert.id)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label={`Dismiss alert for ${alert.symbol}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (displayedAlerts.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {symbol ? `No alerts for ${symbol}` : 'No active alerts'}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-label="Regime and anomaly alerts">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Active Alerts
          {symbol && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
              for {symbol}
            </span>
          )}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {displayedAlerts.filter(a => !a.acknowledged).length} unacknowledged
        </span>
      </div>

      <div className="space-y-3">
        {displayedAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border transition-all duration-200 ${
              alert.acknowledged
                ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
                : `${severityConfig[alert.severity].bgColor} ${severityConfig[alert.severity].borderColor}`
            }`}
            role="alert"
            aria-live={alert.acknowledged ? 'off' : 'polite'}
          >
            {renderAlertContent(alert)}
          </div>
        ))}
      </div>

      {alerts.length > maxDisplayed && (
        <div className="text-center pt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {displayedAlerts.length} of {alerts.length} alerts
          </p>
        </div>
      )}
    </div>
  );
};

export default RegimeAlerts;