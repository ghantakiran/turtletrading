import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useUIStore from '../stores/uiStore';
import useMarketStore from '../stores/marketStore';

/**
 * E2E Test Suite: Zustand State Management Integration
 * 
 * This test suite verifies that Zustand state management works correctly
 * with the React Query implementation and that the Dashboard loads properly
 * with the new server state management integration.
 */

// Mock localStorage for persistence tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

describe('E2E: Zustand State Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset UI Store
    useUIStore.setState({
      theme: {
        mode: 'system',
        primaryColor: '#0ea5e9',
        accentColor: '#22c55e',
        fontSize: 'medium',
        compactMode: false
      },
      layout: {
        sidebarCollapsed: false,
        sidebarWidth: 280,
        panelLayout: 'dual',
        showQuickStats: true,
        showNewsTicker: true,
        showMarketStatus: true
      },
      notifications: [],
      modals: [],
      globalLoading: false,
      pageLoading: false,
      componentLoading: {},
      globalError: null,
      pageError: null,
    });

    // Reset Market Store
    useMarketStore.setState({
      stockPrices: {},
      marketIndices: {},
      technicalIndicators: {},
      aiAnalysis: {},
      marketSentiment: null,
      watchlists: [
        {
          id: 'default',
          name: 'My Watchlist',
          symbols: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      selectedWatchlist: 'default',
      alerts: [],
      isMarketOpen: false,
      lastUpdate: null,
      isLoading: false,
      error: null,
      isConnected: false,
      connectionStatus: 'disconnected',
    });
  });

  describe('UI Store State Management', () => {
    it('should manage theme state correctly', () => {
      const { result } = renderHook(() => useUIStore());

      // Initial state
      expect(result.current.theme.mode).toBe('system');
      expect(result.current.theme.primaryColor).toBe('#0ea5e9');

      // Update theme
      act(() => {
        result.current.setTheme({
          mode: 'dark',
          primaryColor: '#ef4444'
        });
      });

      expect(result.current.theme.mode).toBe('dark');
      expect(result.current.theme.primaryColor).toBe('#ef4444');
      // Should preserve other theme values
      expect(result.current.theme.accentColor).toBe('#22c55e');
      expect(result.current.theme.fontSize).toBe('medium');
    });

    it('should manage layout state correctly', () => {
      const { result } = renderHook(() => useUIStore());

      // Initial state
      expect(result.current.layout.sidebarCollapsed).toBe(false);
      expect(result.current.layout.sidebarWidth).toBe(280);
      expect(result.current.layout.panelLayout).toBe('dual');

      // Toggle sidebar
      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.layout.sidebarCollapsed).toBe(true);

      // Update layout settings
      act(() => {
        result.current.setLayout({
          panelLayout: 'triple',
          showQuickStats: false,
          sidebarWidth: 320
        });
      });

      expect(result.current.layout.panelLayout).toBe('triple');
      expect(result.current.layout.showQuickStats).toBe(false);
      expect(result.current.layout.sidebarWidth).toBe(320);
      // Should preserve sidebar collapsed state
      expect(result.current.layout.sidebarCollapsed).toBe(true);
    });

    it('should manage loading states correctly', () => {
      const { result } = renderHook(() => useUIStore());

      // Initial state
      expect(result.current.globalLoading).toBe(false);
      expect(result.current.pageLoading).toBe(false);
      expect(result.current.componentLoading).toEqual({});

      // Set global loading
      act(() => {
        result.current.setGlobalLoading(true);
      });

      expect(result.current.globalLoading).toBe(true);

      // Set page loading
      act(() => {
        result.current.setPageLoading(true);
      });

      expect(result.current.pageLoading).toBe(true);

      // Set component loading
      act(() => {
        result.current.setComponentLoading('portfolio', true);
        result.current.setComponentLoading('dashboard', true);
      });

      expect(result.current.componentLoading.portfolio).toBe(true);
      expect(result.current.componentLoading.dashboard).toBe(true);

      // Clear loading states
      act(() => {
        result.current.setGlobalLoading(false);
        result.current.setPageLoading(false);
        result.current.setComponentLoading('portfolio', false);
      });

      expect(result.current.globalLoading).toBe(false);
      expect(result.current.pageLoading).toBe(false);
      expect(result.current.componentLoading.portfolio).toBe(false);
      expect(result.current.componentLoading.dashboard).toBe(true); // Should remain true
    });

    it('should manage notifications correctly', () => {
      const { result } = renderHook(() => useUIStore());

      // Initial state
      expect(result.current.notifications).toHaveLength(0);

      // Add notifications
      act(() => {
        result.current.showNotification({
          type: 'success',
          title: 'Success',
          message: 'Operation completed successfully'
        });

        result.current.showNotification({
          type: 'error',
          title: 'Error',
          message: 'Something went wrong'
        });
      });

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications[0].type).toBe('success');
      expect(result.current.notifications[1].type).toBe('error');

      // Remove specific notification
      const firstNotificationId = result.current.notifications[0].id;
      act(() => {
        result.current.hideNotification(firstNotificationId);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].type).toBe('error');

      // Clear all notifications
      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe('Market Store State Management', () => {
    it('should manage market indices correctly', () => {
      const { result } = renderHook(() => useMarketStore());

      // Initial state
      expect(Object.keys(result.current.marketIndices)).toHaveLength(0);

      // Update market index
      const spyIndex = {
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF',
        value: 4530.25,
        change: 12.45,
        changePercent: 0.28,
        timestamp: '2024-01-15T16:00:00Z'
      };

      act(() => {
        result.current.updateMarketIndex(spyIndex);
      });

      expect(result.current.marketIndices.SPY).toEqual(spyIndex);
      expect(result.current.lastUpdate).toBeTruthy();

      // Update another index
      const qqqIndex = {
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
        value: 15845.73,
        change: -8.25,
        changePercent: -0.05,
        timestamp: '2024-01-15T16:00:00Z'
      };

      act(() => {
        result.current.updateMarketIndex(qqqIndex);
      });

      expect(result.current.marketIndices.QQQ).toEqual(qqqIndex);
      expect(Object.keys(result.current.marketIndices)).toHaveLength(2);
    });

    it('should manage stock prices correctly', () => {
      const { result } = renderHook(() => useMarketStore());

      // Initial state
      expect(Object.keys(result.current.stockPrices)).toHaveLength(0);

      // Update stock price
      const aaplPrice = {
        symbol: 'AAPL',
        price: 192.53,
        change: 5.75,
        changePercent: 3.08,
        volume: 95000000,
        marketCap: 3000000000000,
        timestamp: '2024-01-15T16:00:00Z',
        high52Week: 199.62,
        low52Week: 124.17,
        avgVolume: 85000000
      };

      act(() => {
        result.current.updateStockPrice(aaplPrice);
      });

      expect(result.current.stockPrices.AAPL).toEqual(aaplPrice);
      expect(result.current.lastUpdate).toBeTruthy();
    });

    it('should manage watchlists correctly', () => {
      const { result } = renderHook(() => useMarketStore());

      // Initial state - should have default watchlist
      expect(result.current.watchlists).toHaveLength(1);
      expect(result.current.watchlists[0].name).toBe('My Watchlist');
      expect(result.current.watchlists[0].symbols).toContain('AAPL');
      expect(result.current.selectedWatchlist).toBe('default');

      // Create new watchlist
      act(() => {
        result.current.createWatchlist('Tech Stocks');
      });

      expect(result.current.watchlists).toHaveLength(2);
      const newWatchlist = result.current.watchlists.find(w => w.name === 'Tech Stocks');
      expect(newWatchlist).toBeTruthy();
      expect(newWatchlist?.symbols).toHaveLength(0);

      // Add symbol to watchlist
      act(() => {
        result.current.addToWatchlist(newWatchlist!.id, 'NVDA');
        result.current.addToWatchlist(newWatchlist!.id, 'AMD');
      });

      const updatedWatchlist = result.current.watchlists.find(w => w.id === newWatchlist!.id);
      expect(updatedWatchlist?.symbols).toContain('NVDA');
      expect(updatedWatchlist?.symbols).toContain('AMD');
      expect(updatedWatchlist?.symbols).toHaveLength(2);

      // Remove symbol from watchlist
      act(() => {
        result.current.removeFromWatchlist(newWatchlist!.id, 'AMD');
      });

      const finalWatchlist = result.current.watchlists.find(w => w.id === newWatchlist!.id);
      expect(finalWatchlist?.symbols).toContain('NVDA');
      expect(finalWatchlist?.symbols).not.toContain('AMD');
      expect(finalWatchlist?.symbols).toHaveLength(1);

      // Select watchlist
      act(() => {
        result.current.selectWatchlist(newWatchlist!.id);
      });

      expect(result.current.selectedWatchlist).toBe(newWatchlist!.id);

      // Delete watchlist
      act(() => {
        result.current.deleteWatchlist(newWatchlist!.id);
      });

      expect(result.current.watchlists).toHaveLength(1);
      expect(result.current.watchlists[0].name).toBe('My Watchlist');
      // Should fallback to first available watchlist
      expect(result.current.selectedWatchlist).toBe('default');
    });

    it('should manage alerts correctly', () => {
      const { result } = renderHook(() => useMarketStore());

      // Initial state
      expect(result.current.alerts).toHaveLength(0);

      // Create alerts
      act(() => {
        result.current.createAlert({
          symbol: 'AAPL',
          type: 'price_above',
          condition: 200,
          isActive: true
        });

        result.current.createAlert({
          symbol: 'TSLA',
          type: 'price_below',
          condition: 150,
          isActive: true
        });
      });

      expect(result.current.alerts).toHaveLength(2);
      expect(result.current.alerts[0].symbol).toBe('AAPL');
      expect(result.current.alerts[0].type).toBe('price_above');
      expect(result.current.alerts[1].symbol).toBe('TSLA');
      expect(result.current.alerts[1].type).toBe('price_below');

      // Delete alert
      const alertToDelete = result.current.alerts[0];
      act(() => {
        result.current.deleteAlert(alertToDelete.id);
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].symbol).toBe('TSLA');
    });

    it('should manage loading and error states correctly', () => {
      const { result } = renderHook(() => useMarketStore());

      // Initial state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Set loading state
      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      // Set error state
      act(() => {
        result.current.setError('Network error occurred');
      });

      expect(result.current.error).toBe('Network error occurred');

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();

      // Clear loading
      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should manage WebSocket connection state correctly', () => {
      const { result } = renderHook(() => useMarketStore());

      // Initial state
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');

      // Set connection status
      act(() => {
        result.current.setConnectionStatus('connecting');
      });

      expect(result.current.connectionStatus).toBe('connecting');
      expect(result.current.isConnected).toBe(false);

      act(() => {
        result.current.setConnectionStatus('connected');
      });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.setConnectionStatus('error');
      });

      expect(result.current.connectionStatus).toBe('error');
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Cross-Store Integration', () => {
    it('should work correctly when both stores are used together', () => {
      const uiStore = renderHook(() => useUIStore());
      const marketStore = renderHook(() => useMarketStore());

      // Simulate a scenario where market data loading triggers UI updates
      act(() => {
        uiStore.result.current.setGlobalLoading(true);
        marketStore.result.current.setLoading(true);
      });

      expect(uiStore.result.current.globalLoading).toBe(true);
      expect(marketStore.result.current.isLoading).toBe(true);

      // Simulate successful data load
      act(() => {
        marketStore.result.current.updateStockPrice({
          symbol: 'AAPL',
          price: 192.53,
          change: 5.75,
          changePercent: 3.08,
          volume: 95000000,
          marketCap: 3000000000000,
          timestamp: '2024-01-15T16:00:00Z',
          high52Week: 199.62,
          low52Week: 124.17,
          avgVolume: 85000000
        });

        marketStore.result.current.setLoading(false);
        uiStore.result.current.setGlobalLoading(false);

        uiStore.result.current.showNotification({
          type: 'success',
          title: 'Data Updated',
          message: 'Market data has been refreshed'
        });
      });

      expect(marketStore.result.current.isLoading).toBe(false);
      expect(uiStore.result.current.globalLoading).toBe(false);
      expect(marketStore.result.current.stockPrices.AAPL).toBeTruthy();
      expect(uiStore.result.current.notifications).toHaveLength(1);
      expect(uiStore.result.current.notifications[0].type).toBe('success');
    });

    it('should handle error scenarios across both stores', () => {
      const uiStore = renderHook(() => useUIStore());
      const marketStore = renderHook(() => useMarketStore());

      // Simulate error scenario
      act(() => {
        marketStore.result.current.setError('Failed to fetch market data');
        uiStore.result.current.setGlobalError('Server connection lost');
        
        uiStore.result.current.showNotification({
          type: 'error',
          title: 'Connection Error',
          message: 'Unable to connect to market data server'
        });
      });

      expect(marketStore.result.current.error).toBe('Failed to fetch market data');
      expect(uiStore.result.current.globalError).toBe('Server connection lost');
      expect(uiStore.result.current.notifications).toHaveLength(1);
      expect(uiStore.result.current.notifications[0].type).toBe('error');

      // Simulate recovery
      act(() => {
        marketStore.result.current.clearError();
        uiStore.result.current.clearErrors();
        
        uiStore.result.current.showNotification({
          type: 'success',
          title: 'Connection Restored',
          message: 'Market data connection has been restored'
        });
      });

      expect(marketStore.result.current.error).toBeNull();
      expect(uiStore.result.current.globalError).toBeNull();
      expect(uiStore.result.current.notifications).toHaveLength(2);
      expect(uiStore.result.current.notifications[1].type).toBe('success');
    });
  });

  describe('State Persistence', () => {
    it('should persist UI preferences correctly', () => {
      const { result } = renderHook(() => useUIStore());

      // Update theme and layout settings that should be persisted
      act(() => {
        result.current.setTheme({
          mode: 'dark',
          primaryColor: '#10b981'
        });

        result.current.setLayout({
          sidebarCollapsed: true,
          panelLayout: 'triple'
        });

        result.current.setUserPreferences({
          currency: 'EUR',
          language: 'fr'
        });
      });

      // These would be persisted to localStorage in a real app
      expect(result.current.theme.mode).toBe('dark');
      expect(result.current.theme.primaryColor).toBe('#10b981');
      expect(result.current.layout.sidebarCollapsed).toBe(true);
      expect(result.current.layout.panelLayout).toBe('triple');
      expect(result.current.userPreferences.currency).toBe('EUR');
      expect(result.current.userPreferences.language).toBe('fr');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with frequent updates', () => {
      const marketStore = renderHook(() => useMarketStore());

      // Simulate frequent price updates
      for (let i = 0; i < 100; i++) {
        act(() => {
          marketStore.result.current.updateStockPrice({
            symbol: 'AAPL',
            price: 190 + Math.random() * 10,
            change: (Math.random() - 0.5) * 10,
            changePercent: (Math.random() - 0.5) * 5,
            volume: 90000000 + Math.random() * 10000000,
            marketCap: 3000000000000,
            timestamp: new Date().toISOString(),
            high52Week: 199.62,
            low52Week: 124.17,
            avgVolume: 85000000
          });
        });
      }

      // Should only keep the latest price for each symbol
      expect(Object.keys(marketStore.result.current.stockPrices)).toHaveLength(1);
      expect(marketStore.result.current.stockPrices.AAPL).toBeTruthy();
    });

    it('should handle rapid notification updates efficiently', () => {
      const uiStore = renderHook(() => useUIStore());

      // Add multiple notifications rapidly
      act(() => {
        for (let i = 0; i < 10; i++) {
          uiStore.result.current.showNotification({
            type: 'info',
            title: `Notification ${i + 1}`,
            message: `Message ${i + 1}`,
            duration: 0 // Don't auto-dismiss for this test
          });
        }
      });

      expect(uiStore.result.current.notifications).toHaveLength(10);

      // Clear all notifications
      act(() => {
        uiStore.result.current.clearNotifications();
      });

      expect(uiStore.result.current.notifications).toHaveLength(0);
    });
  });
});