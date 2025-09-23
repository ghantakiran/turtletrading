/**
 * Push Notification System
 * Comprehensive push notification management with stock alerts, market updates, and news
 */

import { pushNotificationManager } from './pwa';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  actions?: NotificationAction[];
  timestamp?: number;
}

export interface StockAlert {
  id: string;
  symbol: string;
  type: 'price' | 'percent' | 'volume' | 'technical';
  condition: 'above' | 'below' | 'crosses';
  value: number;
  enabled: boolean;
  frequency: 'once' | 'daily' | 'always';
  lastTriggered?: number;
  createdAt: number;
}

export interface MarketAlert {
  id: string;
  type: 'market_open' | 'market_close' | 'sector_move' | 'index_move';
  threshold?: number;
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  lastTriggered?: number;
}

export interface NewsAlert {
  id: string;
  keywords: string[];
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'any';
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily';
  lastTriggered?: number;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private vapidPublicKey = 'your-vapid-public-key-here'; // Replace with actual key
  private subscription: PushSubscription | null = null;
  private stockAlerts: Map<string, StockAlert> = new Map();
  private marketAlerts: Map<string, MarketAlert> = new Map();
  private newsAlerts: Map<string, NewsAlert> = new Map();
  private isInitialized = false;

  private constructor() {
    this.loadAlertsFromStorage();
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize push notification service
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications not supported');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const initialized = await pushNotificationManager.initialize(registration);

      if (initialized) {
        this.isInitialized = true;
        this.setupMessageListener();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  /**
   * Request notification permission and subscribe
   */
  public async requestPermissionAndSubscribe(): Promise<boolean> {
    try {
      const permission = await pushNotificationManager.requestPermission();

      if (permission === 'granted') {
        this.subscription = await pushNotificationManager.subscribe(this.vapidPublicKey);

        if (this.subscription) {
          // Send subscription to server
          await this.sendSubscriptionToServer(this.subscription);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }

  /**
   * Get current notification permission status
   */
  public getPermissionStatus(): NotificationPermission {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }

  /**
   * Check if notifications are enabled
   */
  public isEnabled(): boolean {
    return this.getPermissionStatus() === 'granted' && !!this.subscription;
  }

  /**
   * Create stock price alert
   */
  public async createStockAlert(alert: Omit<StockAlert, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const stockAlert: StockAlert = {
      ...alert,
      id,
      createdAt: Date.now()
    };

    this.stockAlerts.set(id, stockAlert);
    await this.saveAlertsToStorage();

    // Send alert to server for processing
    if (this.subscription) {
      await this.sendAlertToServer('stock', stockAlert);
    }

    return id;
  }

  /**
   * Create market alert
   */
  public async createMarketAlert(alert: Omit<MarketAlert, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    const marketAlert: MarketAlert = {
      ...alert,
      id
    };

    this.marketAlerts.set(id, marketAlert);
    await this.saveAlertsToStorage();

    if (this.subscription) {
      await this.sendAlertToServer('market', marketAlert);
    }

    return id;
  }

  /**
   * Create news alert
   */
  public async createNewsAlert(alert: Omit<NewsAlert, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    const newsAlert: NewsAlert = {
      ...alert,
      id
    };

    this.newsAlerts.set(id, newsAlert);
    await this.saveAlertsToStorage();

    if (this.subscription) {
      await this.sendAlertToServer('news', newsAlert);
    }

    return id;
  }

  /**
   * Update stock alert
   */
  public async updateStockAlert(id: string, updates: Partial<StockAlert>): Promise<boolean> {
    const alert = this.stockAlerts.get(id);
    if (!alert) return false;

    const updatedAlert = { ...alert, ...updates };
    this.stockAlerts.set(id, updatedAlert);
    await this.saveAlertsToStorage();

    if (this.subscription) {
      await this.sendAlertToServer('stock', updatedAlert);
    }

    return true;
  }

  /**
   * Delete alert
   */
  public async deleteAlert(type: 'stock' | 'market' | 'news', id: string): Promise<boolean> {
    let deleted = false;

    switch (type) {
      case 'stock':
        deleted = this.stockAlerts.delete(id);
        break;
      case 'market':
        deleted = this.marketAlerts.delete(id);
        break;
      case 'news':
        deleted = this.newsAlerts.delete(id);
        break;
    }

    if (deleted) {
      await this.saveAlertsToStorage();

      // Notify server to remove alert
      if (this.subscription) {
        await this.removeAlertFromServer(type, id);
      }
    }

    return deleted;
  }

  /**
   * Get all alerts
   */
  public getAllAlerts(): {
    stock: StockAlert[];
    market: MarketAlert[];
    news: NewsAlert[];
  } {
    return {
      stock: Array.from(this.stockAlerts.values()),
      market: Array.from(this.marketAlerts.values()),
      news: Array.from(this.newsAlerts.values())
    };
  }

  /**
   * Get alerts for specific symbol
   */
  public getAlertsForSymbol(symbol: string): StockAlert[] {
    return Array.from(this.stockAlerts.values()).filter(alert => alert.symbol === symbol);
  }

  /**
   * Show local notification (for testing/immediate feedback)
   */
  public async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!this.isEnabled()) {
      console.warn('Notifications not enabled');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/badge-72x72.png',
        image: payload.image,
        data: payload.data,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction || false,
        silent: payload.silent || false,
        actions: payload.actions || [],
        timestamp: payload.timestamp || Date.now(),
        vibrate: [200, 100, 200]
      });
    } catch (error) {
      console.error('Failed to show local notification:', error);
    }
  }

  /**
   * Test notification functionality
   */
  public async testNotification(): Promise<void> {
    await this.showLocalNotification({
      title: '🐢 TurtleTrading Test',
      body: 'Push notifications are working correctly!',
      tag: 'test-notification',
      data: { type: 'test' },
      actions: [
        {
          action: 'view',
          title: 'View App',
          icon: '/icons/view-action.png'
        }
      ]
    });
  }

  /**
   * Send stock price update notification
   */
  public async notifyStockPriceUpdate(symbol: string, price: number, change: number, changePercent: number): Promise<void> {
    const isPositive = change >= 0;
    const emoji = isPositive ? '📈' : '📉';
    const changeText = isPositive ? '+' : '';

    await this.showLocalNotification({
      title: `${emoji} ${symbol} Price Update`,
      body: `$${price.toFixed(2)} (${changeText}${changePercent.toFixed(2)}%)`,
      tag: `price-${symbol}`,
      data: {
        type: 'price_update',
        symbol,
        price,
        change,
        changePercent,
        url: `/stock/${symbol}`
      },
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icons/view-action.png'
        },
        {
          action: 'watchlist',
          title: 'Add to Watchlist',
          icon: '/icons/watchlist-action.png'
        }
      ]
    });
  }

  /**
   * Send market update notification
   */
  public async notifyMarketUpdate(title: string, body: string, data?: any): Promise<void> {
    await this.showLocalNotification({
      title: `📊 ${title}`,
      body,
      tag: 'market-update',
      data: {
        type: 'market_update',
        ...data
      },
      actions: [
        {
          action: 'view',
          title: 'View Market',
          icon: '/icons/market-action.png'
        }
      ]
    });
  }

  /**
   * Send news notification
   */
  public async notifyNews(headline: string, summary: string, url: string, symbol?: string): Promise<void> {
    await this.showLocalNotification({
      title: `📰 ${symbol ? `${symbol} News` : 'Market News'}`,
      body: headline,
      tag: `news-${symbol || 'market'}`,
      data: {
        type: 'news',
        symbol,
        url,
        headline,
        summary
      },
      actions: [
        {
          action: 'read',
          title: 'Read Article',
          icon: '/icons/read-action.png'
        },
        {
          action: 'share',
          title: 'Share',
          icon: '/icons/share-action.png'
        }
      ]
    });
  }

  /**
   * Unsubscribe from push notifications
   */
  public async unsubscribe(): Promise<boolean> {
    try {
      const success = await pushNotificationManager.unsubscribe();

      if (success) {
        this.subscription = null;
        // Clear all alerts
        this.stockAlerts.clear();
        this.marketAlerts.clear();
        this.newsAlerts.clear();
        await this.saveAlertsToStorage();
      }

      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private setupMessageListener(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data;

        switch (type) {
          case 'NOTIFICATION_CLICKED':
            this.handleNotificationClick(data);
            break;
          case 'NOTIFICATION_CLOSED':
            this.handleNotificationClose(data);
            break;
        }
      });
    }
  }

  private handleNotificationClick(data: any): void {
    const { action, notificationData } = data;

    switch (action) {
      case 'view':
        if (notificationData.url) {
          window.open(notificationData.url, '_blank');
        }
        break;
      case 'watchlist':
        // Handle watchlist addition
        if (notificationData.symbol) {
          this.addToWatchlistFromNotification(notificationData.symbol);
        }
        break;
      case 'share':
        // Handle sharing
        if (navigator.share && notificationData.headline) {
          navigator.share({
            title: notificationData.headline,
            url: notificationData.url
          });
        }
        break;
    }
  }

  private handleNotificationClose(data: any): void {
    // Track notification dismissal for analytics
    console.log('Notification dismissed:', data);
  }

  private addToWatchlistFromNotification(symbol: string): void {
    // This would integrate with the market store
    console.log('Adding to watchlist from notification:', symbol);
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  private async sendAlertToServer(type: string, alert: any): Promise<void> {
    try {
      await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          alert,
          subscription: this.subscription?.toJSON()
        })
      });
    } catch (error) {
      console.error('Failed to send alert to server:', error);
    }
  }

  private async removeAlertFromServer(type: string, id: string): Promise<void> {
    try {
      await fetch(`/api/v1/alerts/${type}/${id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to remove alert from server:', error);
    }
  }

  private async saveAlertsToStorage(): Promise<void> {
    try {
      const alerts = {
        stock: Array.from(this.stockAlerts.entries()),
        market: Array.from(this.marketAlerts.entries()),
        news: Array.from(this.newsAlerts.entries())
      };

      localStorage.setItem('push-notification-alerts', JSON.stringify(alerts));
    } catch (error) {
      console.error('Failed to save alerts to storage:', error);
    }
  }

  private loadAlertsFromStorage(): void {
    try {
      const stored = localStorage.getItem('push-notification-alerts');
      if (stored) {
        const alerts = JSON.parse(stored);

        this.stockAlerts = new Map(alerts.stock || []);
        this.marketAlerts = new Map(alerts.market || []);
        this.newsAlerts = new Map(alerts.news || []);
      }
    } catch (error) {
      console.error('Failed to load alerts from storage:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

// React hooks for push notifications
import { useState, useEffect } from 'react';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    if (isSupported) {
      setPermission(pushNotificationService.getPermissionStatus());
    }
  }, [isSupported]);

  const requestPermission = async () => {
    const success = await pushNotificationService.requestPermissionAndSubscribe();
    if (success) {
      setPermission('granted');
    }
    return success;
  };

  return {
    permission,
    isSupported,
    isEnabled: permission === 'granted',
    requestPermission
  };
}

export function useStockAlerts(symbol?: string) {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);

  useEffect(() => {
    const loadAlerts = () => {
      if (symbol) {
        setAlerts(pushNotificationService.getAlertsForSymbol(symbol));
      } else {
        setAlerts(pushNotificationService.getAllAlerts().stock);
      }
    };

    loadAlerts();

    // Refresh alerts when storage changes
    const handleStorageChange = () => loadAlerts();
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [symbol]);

  const createAlert = async (alert: Omit<StockAlert, 'id' | 'createdAt'>) => {
    const id = await pushNotificationService.createStockAlert(alert);
    setAlerts(prev => [...prev, { ...alert, id, createdAt: Date.now() }]);
    return id;
  };

  const updateAlert = async (id: string, updates: Partial<StockAlert>) => {
    const success = await pushNotificationService.updateStockAlert(id, updates);
    if (success) {
      setAlerts(prev => prev.map(alert =>
        alert.id === id ? { ...alert, ...updates } : alert
      ));
    }
    return success;
  };

  const deleteAlert = async (id: string) => {
    const success = await pushNotificationService.deleteAlert('stock', id);
    if (success) {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }
    return success;
  };

  return {
    alerts,
    createAlert,
    updateAlert,
    deleteAlert
  };
}