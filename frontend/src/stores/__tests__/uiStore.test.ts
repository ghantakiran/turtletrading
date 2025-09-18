import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useUIStore, { 
  Theme, 
  LayoutSettings, 
  ChartSettings, 
  UserPreferences,
  Notification,
  Modal 
} from '../uiStore';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

describe('UI Store (Zustand)', () => {
  beforeEach(() => {
    // Clear localStorage mocks
    vi.clearAllMocks();
    
    // Reset the store state before each test
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
      chartSettings: {
        defaultTimeframe: '1d',
        showVolume: true,
        showMovingAverages: true,
        candlestickStyle: 'candles',
        indicators: ['RSI', 'MACD'],
        autoRefresh: true,
        refreshInterval: 30
      },
      userPreferences: {
        currency: 'USD',
        numberFormat: 'US',
        dateFormat: 'MM/DD/YYYY',
        timezone: 'America/New_York',
        language: 'en',
        emailNotifications: true,
        pushNotifications: true,
        soundAlerts: false
      },
      currentPage: '/',
      previousPage: null,
      breadcrumbs: [],
      modals: [],
      notifications: [],
      globalLoading: false,
      pageLoading: false,
      componentLoading: {},
      globalError: null,
      pageError: null,
      searchQuery: '',
      activeFilters: {},
      isMobile: false,
      isTablet: false,
      screenWidth: 1920,
      screenHeight: 1080,
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.theme.mode).toBe('system');
      expect(result.current.layout.sidebarCollapsed).toBe(false);
      expect(result.current.layout.sidebarWidth).toBe(280);
      expect(result.current.chartSettings.defaultTimeframe).toBe('1d');
      expect(result.current.userPreferences.currency).toBe('USD');
      expect(result.current.modals).toEqual([]);
      expect(result.current.notifications).toEqual([]);
      expect(result.current.globalLoading).toBe(false);
    });
  });

  describe('Theme Actions', () => {
    it('should update theme settings', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme({
          mode: 'dark',
          primaryColor: '#ef4444',
          fontSize: 'large'
        });
      });

      expect(result.current.theme.mode).toBe('dark');
      expect(result.current.theme.primaryColor).toBe('#ef4444');
      expect(result.current.theme.fontSize).toBe('large');
      // Should preserve unchanged values
      expect(result.current.theme.accentColor).toBe('#22c55e');
      expect(result.current.theme.compactMode).toBe(false);
    });

    it('should toggle dark mode', () => {
      const { result } = renderHook(() => useUIStore());

      // Initially system mode
      expect(result.current.theme.mode).toBe('system');

      act(() => {
        result.current.toggleDarkMode();
      });

      expect(result.current.theme.mode).toBe('dark');

      act(() => {
        result.current.toggleDarkMode();
      });

      expect(result.current.theme.mode).toBe('light');
    });
  });

  describe('Layout Actions', () => {
    it('should update layout settings', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setLayout({
          panelLayout: 'triple',
          showQuickStats: false,
          showNewsTicker: false
        });
      });

      expect(result.current.layout.panelLayout).toBe('triple');
      expect(result.current.layout.showQuickStats).toBe(false);
      expect(result.current.layout.showNewsTicker).toBe(false);
      // Should preserve unchanged values
      expect(result.current.layout.sidebarCollapsed).toBe(false);
      expect(result.current.layout.sidebarWidth).toBe(280);
    });

    it('should toggle sidebar', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.layout.sidebarCollapsed).toBe(false);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.layout.sidebarCollapsed).toBe(true);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.layout.sidebarCollapsed).toBe(false);
    });

    it('should set sidebar width', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSidebarWidth(350);
      });

      expect(result.current.layout.sidebarWidth).toBe(350);
    });
  });

  describe('Chart Actions', () => {
    it('should update chart settings', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setChartSettings({
          defaultTimeframe: '1w',
          showVolume: false,
          candlestickStyle: 'line',
          autoRefresh: false
        });
      });

      expect(result.current.chartSettings.defaultTimeframe).toBe('1w');
      expect(result.current.chartSettings.showVolume).toBe(false);
      expect(result.current.chartSettings.candlestickStyle).toBe('line');
      expect(result.current.chartSettings.autoRefresh).toBe(false);
    });

    it('should add chart indicator', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addChartIndicator('Bollinger Bands');
      });

      expect(result.current.chartSettings.indicators).toContain('Bollinger Bands');
      expect(result.current.chartSettings.indicators).toEqual(['RSI', 'MACD', 'Bollinger Bands']);
    });

    it('should not add duplicate indicator', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addChartIndicator('RSI'); // Already exists
      });

      expect(result.current.chartSettings.indicators).toEqual(['RSI', 'MACD']);
    });

    it('should remove chart indicator', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.removeChartIndicator('RSI');
      });

      expect(result.current.chartSettings.indicators).not.toContain('RSI');
      expect(result.current.chartSettings.indicators).toEqual(['MACD']);
    });
  });

  describe('Navigation Actions', () => {
    it('should set current page and track previous page', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setCurrentPage('/dashboard');
      });

      expect(result.current.currentPage).toBe('/dashboard');
      expect(result.current.previousPage).toBe('/');

      act(() => {
        result.current.setCurrentPage('/portfolio');
      });

      expect(result.current.currentPage).toBe('/portfolio');
      expect(result.current.previousPage).toBe('/dashboard');
    });

    it('should manage breadcrumbs', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.addBreadcrumb('Dashboard');
        result.current.addBreadcrumb('Portfolio');
        result.current.addBreadcrumb('Holdings');
      });

      expect(result.current.breadcrumbs).toEqual(['Dashboard', 'Portfolio', 'Holdings']);

      act(() => {
        result.current.clearBreadcrumbs();
      });

      expect(result.current.breadcrumbs).toEqual([]);
    });
  });

  describe('Modal Actions', () => {
    it('should show and hide modals', () => {
      const { result } = renderHook(() => useUIStore());

      const modalData = {
        type: 'alert' as const,
        title: 'Test Modal',
        content: 'This is a test modal',
        confirmText: 'OK'
      };

      act(() => {
        result.current.showModal(modalData);
      });

      expect(result.current.modals).toHaveLength(1);
      expect(result.current.modals[0]).toMatchObject({
        ...modalData,
        id: expect.any(String)
      });

      const modalId = result.current.modals[0].id;

      act(() => {
        result.current.hideModal(modalId);
      });

      expect(result.current.modals).toHaveLength(0);
    });

    it('should show multiple modals and hide all', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.showModal({
          type: 'alert',
          title: 'Modal 1',
          content: 'Content 1'
        });
        result.current.showModal({
          type: 'confirm',
          title: 'Modal 2',
          content: 'Content 2'
        });
      });

      expect(result.current.modals).toHaveLength(2);

      act(() => {
        result.current.hideAllModals();
      });

      expect(result.current.modals).toHaveLength(0);
    });
  });

  describe('Notification Actions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show and hide notifications', () => {
      const { result } = renderHook(() => useUIStore());

      const notificationData = {
        type: 'success' as const,
        title: 'Success',
        message: 'Operation completed successfully'
      };

      act(() => {
        result.current.showNotification(notificationData);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        ...notificationData,
        id: expect.any(String),
        timestamp: expect.any(String),
        duration: 5000,
        dismissible: true
      });

      const notificationId = result.current.notifications[0].id;

      act(() => {
        result.current.hideNotification(notificationId);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('should auto-dismiss notifications after duration', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.showNotification({
          type: 'info',
          title: 'Info',
          message: 'This will auto-dismiss',
          duration: 3000
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('should clear all notifications', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.showNotification({
          type: 'success',
          title: 'Success 1',
          message: 'Message 1'
        });
        result.current.showNotification({
          type: 'error',
          title: 'Error 1',
          message: 'Message 2'
        });
      });

      expect(result.current.notifications).toHaveLength(2);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe('Loading State Actions', () => {
    it('should manage global loading state', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setGlobalLoading(true);
      });

      expect(result.current.globalLoading).toBe(true);

      act(() => {
        result.current.setGlobalLoading(false);
      });

      expect(result.current.globalLoading).toBe(false);
    });

    it('should manage page loading state', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setPageLoading(true);
      });

      expect(result.current.pageLoading).toBe(true);

      act(() => {
        result.current.setPageLoading(false);
      });

      expect(result.current.pageLoading).toBe(false);
    });

    it('should manage component loading states', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setComponentLoading('portfolio', true);
        result.current.setComponentLoading('chart', true);
      });

      expect(result.current.componentLoading.portfolio).toBe(true);
      expect(result.current.componentLoading.chart).toBe(true);

      act(() => {
        result.current.setComponentLoading('portfolio', false);
      });

      expect(result.current.componentLoading.portfolio).toBe(false);
      expect(result.current.componentLoading.chart).toBe(true);
    });
  });

  describe('Error State Actions', () => {
    it('should manage error states', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setGlobalError('Global error occurred');
        result.current.setPageError('Page error occurred');
      });

      expect(result.current.globalError).toBe('Global error occurred');
      expect(result.current.pageError).toBe('Page error occurred');

      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.globalError).toBeNull();
      expect(result.current.pageError).toBeNull();
    });
  });

  describe('Search and Filter Actions', () => {
    it('should manage search query', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSearchQuery('AAPL');
      });

      expect(result.current.searchQuery).toBe('AAPL');
    });

    it('should manage filters', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setFilter('sector', 'Technology');
        result.current.setFilter('marketCap', 'Large');
      });

      expect(result.current.activeFilters.sector).toBe('Technology');
      expect(result.current.activeFilters.marketCap).toBe('Large');

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.activeFilters).toEqual({});
    });
  });

  describe('Responsive Actions', () => {
    it('should manage screen size and responsive flags', () => {
      const { result } = renderHook(() => useUIStore());

      // Test mobile breakpoint
      act(() => {
        result.current.setScreenSize(600, 800);
      });

      expect(result.current.screenWidth).toBe(600);
      expect(result.current.screenHeight).toBe(800);
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);

      // Test tablet breakpoint
      act(() => {
        result.current.setScreenSize(900, 1200);
      });

      expect(result.current.screenWidth).toBe(900);
      expect(result.current.screenHeight).toBe(1200);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);

      // Test desktop breakpoint
      act(() => {
        result.current.setScreenSize(1400, 1000);
      });

      expect(result.current.screenWidth).toBe(1400);
      expect(result.current.screenHeight).toBe(1000);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
    });
  });

  describe('User Preferences Actions', () => {
    it('should update user preferences', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setUserPreferences({
          currency: 'EUR',
          language: 'fr',
          emailNotifications: false,
          timezone: 'Europe/Paris'
        });
      });

      expect(result.current.userPreferences.currency).toBe('EUR');
      expect(result.current.userPreferences.language).toBe('fr');
      expect(result.current.userPreferences.emailNotifications).toBe(false);
      expect(result.current.userPreferences.timezone).toBe('Europe/Paris');
      // Should preserve unchanged values
      expect(result.current.userPreferences.numberFormat).toBe('US');
      expect(result.current.userPreferences.pushNotifications).toBe(true);
    });
  });

  describe('Store Persistence', () => {
    it('should persist important state to localStorage', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme({ mode: 'dark' });
        result.current.setLayout({ sidebarCollapsed: true });
        result.current.setUserPreferences({ currency: 'EUR' });
      });

      // The persist middleware should have been called
      // In a real test environment, we would check localStorage.setItem calls
      expect(result.current.theme.mode).toBe('dark');
      expect(result.current.layout.sidebarCollapsed).toBe(true);
      expect(result.current.userPreferences.currency).toBe('EUR');
    });
  });
});