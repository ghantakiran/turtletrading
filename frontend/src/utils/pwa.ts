/**
 * PWA Utilities
 * Service Worker registration, offline detection, and PWA installation
 */

// PWA Installation and Service Worker Management
export class PWAManager {
  private static instance: PWAManager;
  private serviceWorker: ServiceWorkerRegistration | null = null;
  private isOnline = navigator.onLine;
  private onlineCallbacks: Array<(isOnline: boolean) => void> = [];
  private installPrompt: any = null;

  private constructor() {
    this.initializeEventListeners();
  }

  public static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager();
    }
    return PWAManager.instance;
  }

  /**
   * Initialize PWA and register service worker
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator)) {
        console.warn('PWA: Service Workers not supported');
        return false;
      }

      // Register service worker
      this.serviceWorker = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      console.log('PWA: Service Worker registered successfully');

      // Handle service worker updates
      this.handleServiceWorkerUpdates();

      // Setup periodic sync for background updates
      await this.setupBackgroundSync();

      return true;
    } catch (error) {
      console.error('PWA: Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * Handle service worker updates
   */
  private handleServiceWorkerUpdates(): void {
    if (!this.serviceWorker) return;

    this.serviceWorker.addEventListener('updatefound', () => {
      const newWorker = this.serviceWorker!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is available
          this.notifyUpdate();
        }
      });
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case 'BACK_ONLINE':
        this.setOnlineStatus(true);
        break;

      case 'CACHE_UPDATED':
        console.log('PWA: Cache updated for:', payload.url);
        break;

      case 'OFFLINE_READY':
        console.log('PWA: App is ready for offline use');
        break;

      default:
        console.log('PWA: Unknown message from service worker:', type);
    }
  }

  /**
   * Notify user about available update
   */
  private notifyUpdate(): void {
    const updateBanner = this.createUpdateBanner();
    document.body.appendChild(updateBanner);
  }

  /**
   * Create update notification banner
   */
  private createUpdateBanner(): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'pwa-update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #0ea5e9, #3b82f6);
      color: white;
      padding: 12px 16px;
      text-align: center;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transform: translateY(-100%);
      transition: transform 0.3s ease;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap;">
        <span>🚀 New version available!</span>
        <div style="display: flex; gap: 8px;">
          <button id="pwa-update-btn" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Update Now</button>
          <button id="pwa-dismiss-btn" style="
            background: none;
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Later</button>
        </div>
      </div>
    `;

    // Add event listeners
    const updateBtn = banner.querySelector('#pwa-update-btn') as HTMLButtonElement;
    const dismissBtn = banner.querySelector('#pwa-dismiss-btn') as HTMLButtonElement;

    updateBtn.addEventListener('click', () => {
      this.updateServiceWorker();
      banner.remove();
    });

    dismissBtn.addEventListener('click', () => {
      banner.style.transform = 'translateY(-100%)';
      setTimeout(() => banner.remove(), 300);
    });

    // Show banner with animation
    setTimeout(() => {
      banner.style.transform = 'translateY(0)';
    }, 100);

    return banner;
  }

  /**
   * Update service worker
   */
  public async updateServiceWorker(): Promise<void> {
    if (!this.serviceWorker?.waiting) return;

    // Send skip waiting message
    this.serviceWorker.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload page after update
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  /**
   * Setup background sync
   */
  private async setupBackgroundSync(): Promise<void> {
    if (!this.serviceWorker || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      return;
    }

    try {
      await this.serviceWorker.sync.register('background-sync-failed-requests');
      console.log('PWA: Background sync registered');
    } catch (error) {
      console.error('PWA: Background sync registration failed:', error);
    }
  }

  /**
   * Initialize event listeners for online/offline detection
   */
  private initializeEventListeners(): void {
    window.addEventListener('online', () => this.setOnlineStatus(true));
    window.addEventListener('offline', () => this.setOnlineStatus(false));

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event;
      this.showInstallPrompt();
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('PWA: App installed successfully');
      this.installPrompt = null;
    });
  }

  /**
   * Set online status and notify callbacks
   */
  private setOnlineStatus(isOnline: boolean): void {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      this.onlineCallbacks.forEach(callback => callback(isOnline));

      // Update UI indicator
      this.updateOnlineIndicator(isOnline);
    }
  }

  /**
   * Update online/offline indicator in UI
   */
  private updateOnlineIndicator(isOnline: boolean): void {
    // Remove existing indicator
    const existingIndicator = document.querySelector('.pwa-connection-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    if (!isOnline) {
      const indicator = document.createElement('div');
      indicator.className = 'pwa-connection-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
      `;

      indicator.innerHTML = '📡 You\'re offline - Some features may be limited';
      document.body.appendChild(indicator);

      // Add slide up animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideUp {
          from {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Show install prompt
   */
  private showInstallPrompt(): void {
    const installBanner = document.createElement('div');
    installBanner.className = 'pwa-install-banner';
    installBanner.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: white;
      color: #1f2937;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      max-width: 320px;
      z-index: 10000;
      border: 1px solid #e5e7eb;
    `;

    installBanner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">🐢</div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px;">Install TurtleTrading</div>
          <div style="font-size: 13px; color: #6b7280;">Get instant access and offline features</div>
        </div>
        <button id="pwa-install-close" style="
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #9ca3af;
        ">×</button>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button id="pwa-install-btn" style="
          background: #0ea5e9;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          flex: 1;
        ">Install</button>
        <button id="pwa-install-later" style="
          background: #f3f4f6;
          color: #374151;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">Not Now</button>
      </div>
    `;

    // Add event listeners
    const installBtn = installBanner.querySelector('#pwa-install-btn') as HTMLButtonElement;
    const laterBtn = installBanner.querySelector('#pwa-install-later') as HTMLButtonElement;
    const closeBtn = installBanner.querySelector('#pwa-install-close') as HTMLButtonElement;

    installBtn.addEventListener('click', () => {
      this.installApp();
      installBanner.remove();
    });

    laterBtn.addEventListener('click', () => {
      installBanner.remove();
    });

    closeBtn.addEventListener('click', () => {
      installBanner.remove();
    });

    document.body.appendChild(installBanner);

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (installBanner.parentNode) {
        installBanner.remove();
      }
    }, 10000);
  }

  /**
   * Install PWA
   */
  public async installApp(): Promise<boolean> {
    if (!this.installPrompt) {
      console.warn('PWA: No install prompt available');
      return false;
    }

    try {
      this.installPrompt.prompt();
      const result = await this.installPrompt.userChoice;

      if (result.outcome === 'accepted') {
        console.log('PWA: User accepted installation');
        return true;
      } else {
        console.log('PWA: User dismissed installation');
        return false;
      }
    } catch (error) {
      console.error('PWA: Installation failed:', error);
      return false;
    } finally {
      this.installPrompt = null;
    }
  }

  /**
   * Check if app is installed
   */
  public isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone ||
           document.referrer.includes('android-app://');
  }

  /**
   * Get online status
   */
  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Subscribe to online status changes
   */
  public onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
    this.onlineCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.onlineCallbacks.indexOf(callback);
      if (index > -1) {
        this.onlineCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Cache specific data
   */
  public async cacheData(url: string): Promise<boolean> {
    if (!this.serviceWorker) return false;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success);
      };

      this.serviceWorker!.active?.postMessage(
        {
          type: 'CACHE_STOCK_DATA',
          payload: { url }
        },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Get cache status
   */
  public async getCacheStatus(): Promise<any> {
    if (!this.serviceWorker) return null;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      this.serviceWorker!.active?.postMessage(
        { type: 'GET_CACHE_STATUS' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Clear all caches
   */
  public async clearCaches(): Promise<boolean> {
    if (!this.serviceWorker) return false;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success);
      };

      this.serviceWorker!.active?.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  }
}

// Utility functions
export const pwaManager = PWAManager.getInstance();

// Hook for React components
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(pwaManager.getOnlineStatus());

  useEffect(() => {
    const unsubscribe = pwaManager.onOnlineStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  return isOnline;
}

// PWA initialization
export async function initializePWA(): Promise<void> {
  try {
    await pwaManager.initialize();
    console.log('PWA: Initialization complete');
  } catch (error) {
    console.error('PWA: Initialization failed:', error);
  }
}

// Push notification utilities
export class PushNotificationManager {
  private static instance: PushNotificationManager;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  /**
   * Initialize push notifications
   */
  public async initialize(registration: ServiceWorkerRegistration): Promise<boolean> {
    this.registration = registration;

    if (!('Notification' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    if (!('PushManager' in window)) {
      console.warn('Push messaging not supported');
      return false;
    }

    return true;
  }

  /**
   * Request notification permission
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  }

  /**
   * Subscribe to push notifications
   */
  public async subscribe(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.registration) {
      console.error('Service worker not registered');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });

      console.log('Push notification subscription successful');
      return subscription;
    } catch (error) {
      console.error('Push notification subscription failed:', error);
      return null;
    }
  }

  /**
   * Get existing subscription
   */
  public async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) return null;

    try {
      return await this.registration.pushManager.getSubscription();
    } catch (error) {
      console.error('Failed to get push subscription:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  public async unsubscribe(): Promise<boolean> {
    const subscription = await this.getSubscription();

    if (subscription) {
      try {
        await subscription.unsubscribe();
        console.log('Push notification unsubscription successful');
        return true;
      } catch (error) {
        console.error('Push notification unsubscription failed:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Convert VAPID key
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }
}

export const pushNotificationManager = PushNotificationManager.getInstance();

// Import useState and useEffect for the hook
import { useState, useEffect } from 'react';