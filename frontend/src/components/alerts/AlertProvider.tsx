import React, { useEffect, useRef } from 'react';
import { alertService } from '../../services/alertService';
import { useMarketStore } from '../../stores/marketStore';
import { useUIStore } from '../../stores/uiStore';
import { RegimeAlert } from './RegimeAlerts';

interface AlertProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({
  children,
  autoConnect = true
}) => {
  const { addAlert } = useMarketStore();
  const { showNotification } = useUIStore();
  const hasConnected = useRef(false);

  useEffect(() => {
    if (!autoConnect || hasConnected.current) return;

    // Set up alert listener
    const unsubscribeAlert = alertService.onAlert((alert: RegimeAlert) => {
      // Add alert to market store
      addAlert(alert);

      // Show toast notification for high-priority alerts
      if (alert.severity === 'high' || alert.severity === 'critical') {
        showNotification({
          type: alert.severity === 'critical' ? 'error' : 'warning',
          message: `${alert.symbol}: ${alert.title}`,
          description: alert.message,
          duration: alert.severity === 'critical' ? 0 : 5000 // Critical alerts don't auto-dismiss
        });
      }
    });

    // Set up connection status listener
    const unsubscribeConnection = alertService.onConnectionChange((connected: boolean) => {
      if (connected) {
        showNotification({
          type: 'success',
          message: 'Alert system connected',
          description: 'Real-time regime and anomaly alerts are now active',
          duration: 3000
        });
      } else {
        showNotification({
          type: 'warning',
          message: 'Alert system disconnected',
          description: 'Attempting to reconnect...',
          duration: 5000
        });
      }
    });

    // Connect to alert service
    alertService.connect();
    hasConnected.current = true;

    // Cleanup on unmount
    return () => {
      unsubscribeAlert();
      unsubscribeConnection();
      alertService.disconnect();
      hasConnected.current = false;
    };
  }, [autoConnect, addAlert, showNotification]);

  return <>{children}</>;
};

export default AlertProvider;