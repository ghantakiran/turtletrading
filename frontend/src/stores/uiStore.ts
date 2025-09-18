import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  timestamp: string;
}

export interface Modal {
  id: string;
  type: 'alert' | 'confirm' | 'form' | 'custom';
  title: string;
  content: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCloseButton?: boolean;
}

export interface Theme {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
}

export interface LayoutSettings {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  panelLayout: 'single' | 'dual' | 'triple';
  showQuickStats: boolean;
  showNewsTicker: boolean;
  showMarketStatus: boolean;
}

export interface ChartSettings {
  defaultTimeframe: '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '5y';
  showVolume: boolean;
  showMovingAverages: boolean;
  candlestickStyle: 'candles' | 'line' | 'area';
  indicators: string[];
  autoRefresh: boolean;
  refreshInterval: number; // seconds
}

export interface UserPreferences {
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY';
  numberFormat: 'US' | 'EU';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timezone: string;
  language: 'en' | 'es' | 'fr' | 'de' | 'ja';
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundAlerts: boolean;
}

export interface UIState {
  // Theme and appearance
  theme: Theme;
  
  // Layout and panels
  layout: LayoutSettings;
  
  // Chart and visualization
  chartSettings: ChartSettings;
  
  // User preferences
  userPreferences: UserPreferences;
  
  // Navigation and routing
  currentPage: string;
  previousPage: string | null;
  breadcrumbs: string[];
  
  // Modals and dialogs
  modals: Modal[];
  
  // Notifications and alerts
  notifications: Notification[];
  
  // Loading states
  globalLoading: boolean;
  pageLoading: boolean;
  componentLoading: Record<string, boolean>;
  
  // Error states
  globalError: string | null;
  pageError: string | null;
  
  // Search and filters
  searchQuery: string;
  activeFilters: Record<string, any>;
  
  // Responsive design
  isMobile: boolean;
  isTablet: boolean;
  screenWidth: number;
  screenHeight: number;
  
  // Actions
  // Theme actions
  setTheme: (theme: Partial<Theme>) => void;
  toggleDarkMode: () => void;
  
  // Layout actions
  setLayout: (layout: Partial<LayoutSettings>) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  
  // Chart actions
  setChartSettings: (settings: Partial<ChartSettings>) => void;
  addChartIndicator: (indicator: string) => void;
  removeChartIndicator: (indicator: string) => void;
  
  // Preference actions
  setUserPreferences: (preferences: Partial<UserPreferences>) => void;
  
  // Navigation actions
  setCurrentPage: (page: string) => void;
  addBreadcrumb: (crumb: string) => void;
  clearBreadcrumbs: () => void;
  
  // Modal actions
  showModal: (modal: Omit<Modal, 'id'>) => void;
  hideModal: (id: string) => void;
  hideAllModals: () => void;
  
  // Notification actions
  showNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  hideNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Loading actions
  setGlobalLoading: (loading: boolean) => void;
  setPageLoading: (loading: boolean) => void;
  setComponentLoading: (component: string, loading: boolean) => void;
  
  // Error actions
  setGlobalError: (error: string | null) => void;
  setPageError: (error: string | null) => void;
  clearErrors: () => void;
  
  // Search and filter actions
  setSearchQuery: (query: string) => void;
  setFilter: (key: string, value: any) => void;
  clearFilters: () => void;
  
  // Responsive actions
  setScreenSize: (width: number, height: number) => void;
}

const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
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

      // Theme actions
      setTheme: (theme: Partial<Theme>) => {
        set((state) => ({
          theme: { ...state.theme, ...theme }
        }));
      },

      toggleDarkMode: () => {
        set((state) => ({
          theme: {
            ...state.theme,
            mode: state.theme.mode === 'dark' ? 'light' : 'dark'
          }
        }));
      },

      // Layout actions
      setLayout: (layout: Partial<LayoutSettings>) => {
        set((state) => ({
          layout: { ...state.layout, ...layout }
        }));
      },

      toggleSidebar: () => {
        set((state) => ({
          layout: {
            ...state.layout,
            sidebarCollapsed: !state.layout.sidebarCollapsed
          }
        }));
      },

      setSidebarWidth: (width: number) => {
        set((state) => ({
          layout: { ...state.layout, sidebarWidth: width }
        }));
      },

      // Chart actions
      setChartSettings: (settings: Partial<ChartSettings>) => {
        set((state) => ({
          chartSettings: { ...state.chartSettings, ...settings }
        }));
      },

      addChartIndicator: (indicator: string) => {
        set((state) => ({
          chartSettings: {
            ...state.chartSettings,
            indicators: state.chartSettings.indicators.includes(indicator)
              ? state.chartSettings.indicators
              : [...state.chartSettings.indicators, indicator]
          }
        }));
      },

      removeChartIndicator: (indicator: string) => {
        set((state) => ({
          chartSettings: {
            ...state.chartSettings,
            indicators: state.chartSettings.indicators.filter(i => i !== indicator)
          }
        }));
      },

      // Preference actions
      setUserPreferences: (preferences: Partial<UserPreferences>) => {
        set((state) => ({
          userPreferences: { ...state.userPreferences, ...preferences }
        }));
      },

      // Navigation actions
      setCurrentPage: (page: string) => {
        set((state) => ({
          currentPage: page,
          previousPage: state.currentPage
        }));
      },

      addBreadcrumb: (crumb: string) => {
        set((state) => ({
          breadcrumbs: [...state.breadcrumbs, crumb]
        }));
      },

      clearBreadcrumbs: () => {
        set({ breadcrumbs: [] });
      },

      // Modal actions
      showModal: (modal: Omit<Modal, 'id'>) => {
        const newModal: Modal = {
          ...modal,
          id: Date.now().toString()
        };
        set((state) => ({
          modals: [...state.modals, newModal]
        }));
      },

      hideModal: (id: string) => {
        set((state) => ({
          modals: state.modals.filter(m => m.id !== id)
        }));
      },

      hideAllModals: () => {
        set({ modals: [] });
      },

      // Notification actions
      showNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
        const newNotification: Notification = {
          ...notification,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          duration: notification.duration || 5000,
          dismissible: notification.dismissible !== false
        };
        
        set((state) => ({
          notifications: [...state.notifications, newNotification]
        }));

        // Auto-dismiss notification
        if (newNotification.duration && newNotification.duration > 0) {
          setTimeout(() => {
            get().hideNotification(newNotification.id);
          }, newNotification.duration);
        }
      },

      hideNotification: (id: string) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      // Loading actions
      setGlobalLoading: (loading: boolean) => {
        set({ globalLoading: loading });
      },

      setPageLoading: (loading: boolean) => {
        set({ pageLoading: loading });
      },

      setComponentLoading: (component: string, loading: boolean) => {
        set((state) => ({
          componentLoading: {
            ...state.componentLoading,
            [component]: loading
          }
        }));
      },

      // Error actions
      setGlobalError: (error: string | null) => {
        set({ globalError: error });
      },

      setPageError: (error: string | null) => {
        set({ pageError: error });
      },

      clearErrors: () => {
        set({ globalError: null, pageError: null });
      },

      // Search and filter actions
      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setFilter: (key: string, value: any) => {
        set((state) => ({
          activeFilters: { ...state.activeFilters, [key]: value }
        }));
      },

      clearFilters: () => {
        set({ activeFilters: {} });
      },

      // Responsive actions
      setScreenSize: (width: number, height: number) => {
        set({
          screenWidth: width,
          screenHeight: height,
          isMobile: width < 768,
          isTablet: width >= 768 && width < 1024
        });
      }
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist user preferences and settings
      partialize: (state) => ({
        theme: state.theme,
        layout: state.layout,
        chartSettings: state.chartSettings,
        userPreferences: state.userPreferences
      })
    }
  )
);

export default useUIStore;