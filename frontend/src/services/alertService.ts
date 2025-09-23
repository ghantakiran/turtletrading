import { RegimeAlert } from '../components/alerts/RegimeAlerts';
import { apiClient } from './apiClient';

export interface AlertSubscription {
  id: string;
  symbol: string;
  alertTypes: ('regime_change' | 'anomaly' | 'volatility_spike')[];
  minSeverity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  userId: string;
}

export interface AlertPreferences {
  enableSound: boolean;
  enablePush: boolean;
  enableEmail: boolean;
  autoAcknowledge: boolean;
  maxDisplayed: number;
  soundVolume: number;
}

class AlertService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions: AlertSubscription[] = [];
  private preferences: AlertPreferences = {
    enableSound: true,
    enablePush: true,
    enableEmail: false,
    autoAcknowledge: false,
    maxDisplayed: 10,
    soundVolume: 0.5
  };

  private alertCallbacks: ((alert: RegimeAlert) => void)[] = [];
  private connectionCallbacks: ((connected: boolean) => void)[] = [];

  constructor() {
    this.loadPreferences();
    this.loadSubscriptions();
  }

  // WebSocket connection management
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'}/ws/alerts`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Alert WebSocket connected');
        this.reconnectAttempts = 0;
        this.notifyConnectionStatus(true);
        this.sendSubscriptions();
      };

      this.ws.onmessage = (event) => {
        try {
          const alert: RegimeAlert = JSON.parse(event.data);
          this.handleIncomingAlert(alert);
        } catch (error) {
          console.error('Failed to parse alert message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Alert WebSocket disconnected');
        this.notifyConnectionStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Alert WebSocket error:', error);
        this.notifyConnectionStatus(false);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }

  // Alert handling
  private handleIncomingAlert(alert: RegimeAlert): void {
    // Check if alert matches any subscriptions
    const shouldShow = this.subscriptions.some(sub =>
      sub.enabled &&
      sub.symbol === alert.symbol &&
      sub.alertTypes.includes(alert.type) &&
      this.getSeverityLevel(alert.severity) >= this.getSeverityLevel(sub.minSeverity)
    );

    if (!shouldShow) return;

    // Play sound notification if enabled
    if (this.preferences.enableSound) {
      this.playAlertSound(alert.severity);
    }

    // Show browser notification if enabled
    if (this.preferences.enablePush && 'Notification' in window) {
      this.showBrowserNotification(alert);
    }

    // Notify all registered callbacks
    this.alertCallbacks.forEach(callback => callback(alert));
  }

  private getSeverityLevel(severity: string): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[severity as keyof typeof levels] || 1;
  }

  private playAlertSound(severity: RegimeAlert['severity']): void {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different frequencies for different severities
    const frequencies = { low: 440, medium: 554, high: 659, critical: 880 };
    oscillator.frequency.setValueAtTime(frequencies[severity], audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.preferences.soundVolume, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  private async showBrowserNotification(alert: RegimeAlert): Promise<void> {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }

    const notification = new Notification(`${alert.symbol} Alert`, {
      body: alert.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: alert.id,
      requireInteraction: alert.severity === 'critical'
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds unless critical
    if (alert.severity !== 'critical') {
      setTimeout(() => notification.close(), 5000);
    }
  }

  // Subscription management
  async addSubscription(subscription: Omit<AlertSubscription, 'id' | 'userId'>): Promise<AlertSubscription> {
    try {
      const response = await apiClient.post('/api/v1/alerts/subscriptions', subscription);
      const newSubscription = response.data;
      this.subscriptions.push(newSubscription);
      this.saveSubscriptions();
      this.sendSubscriptions();
      return newSubscription;
    } catch (error) {
      console.error('Failed to add subscription:', error);
      throw error;
    }
  }

  async removeSubscription(subscriptionId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/alerts/subscriptions/${subscriptionId}`);
      this.subscriptions = this.subscriptions.filter(sub => sub.id !== subscriptionId);
      this.saveSubscriptions();
      this.sendSubscriptions();
    } catch (error) {
      console.error('Failed to remove subscription:', error);
      throw error;
    }
  }

  async updateSubscription(subscriptionId: string, updates: Partial<AlertSubscription>): Promise<AlertSubscription> {
    try {
      const response = await apiClient.patch(`/api/v1/alerts/subscriptions/${subscriptionId}`, updates);
      const updatedSubscription = response.data;

      const index = this.subscriptions.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        this.subscriptions[index] = updatedSubscription;
        this.saveSubscriptions();
        this.sendSubscriptions();
      }

      return updatedSubscription;
    } catch (error) {
      console.error('Failed to update subscription:', error);
      throw error;
    }
  }

  getSubscriptions(): AlertSubscription[] {
    return [...this.subscriptions];
  }

  private sendSubscriptions(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        subscriptions: this.subscriptions.filter(sub => sub.enabled)
      }));
    }
  }

  // Preferences management
  updatePreferences(newPreferences: Partial<AlertPreferences>): void {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.savePreferences();
  }

  getPreferences(): AlertPreferences {
    return { ...this.preferences };
  }

  private savePreferences(): void {
    localStorage.setItem('alert_preferences', JSON.stringify(this.preferences));
  }

  private loadPreferences(): void {
    try {
      const saved = localStorage.getItem('alert_preferences');
      if (saved) {
        this.preferences = { ...this.preferences, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load alert preferences:', error);
    }
  }

  private saveSubscriptions(): void {
    localStorage.setItem('alert_subscriptions', JSON.stringify(this.subscriptions));
  }

  private loadSubscriptions(): void {
    try {
      const saved = localStorage.getItem('alert_subscriptions');
      if (saved) {
        this.subscriptions = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load alert subscriptions:', error);
    }
  }

  // Event listeners
  onAlert(callback: (alert: RegimeAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      this.alertCallbacks = this.alertCallbacks.filter(cb => cb !== callback);
    };
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.push(callback);
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyConnectionStatus(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => callback(connected));
  }

  // Utility methods
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async testAlert(symbol: string, type: RegimeAlert['type'], severity: RegimeAlert['severity']): Promise<void> {
    const testAlert: RegimeAlert = {
      id: `test-${Date.now()}`,
      type,
      symbol,
      timestamp: new Date(),
      severity,
      title: `Test ${type.replace('_', ' ')} Alert`,
      message: `This is a test alert for ${symbol}`,
      details: {
        confidence: 0.85,
        anomaly_score: type === 'anomaly' ? 2.5 : undefined
      },
      acknowledged: false
    };

    this.handleIncomingAlert(testAlert);
  }
}

export const alertService = new AlertService();
export default alertService;