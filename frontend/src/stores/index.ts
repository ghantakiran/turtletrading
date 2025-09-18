// Export all Zustand stores
export { default as useAuthStore } from './authStore';
export { default as useMarketStore } from './marketStore';
export { default as useUIStore } from './uiStore';

// Export types for easier importing
export type {
  User,
  AuthState,
  RegisterData,
  LoginResponse
} from './authStore';

export type {
  StockPrice,
  MarketIndex,
  TechnicalIndicators,
  AIAnalysis,
  MarketSentiment,
  Watchlist,
  Alert,
  MarketState
} from './marketStore';

export type {
  Notification,
  Modal,
  Theme,
  LayoutSettings,
  ChartSettings,
  UserPreferences,
  UIState
} from './uiStore';

// Store selectors for common operations
export const authSelectors = {
  isAuthenticated: (state: any) => state.isAuthenticated,
  user: (state: any) => state.user,
  isLoading: (state: any) => state.isLoading,
  error: (state: any) => state.error
};

export const marketSelectors = {
  stockPrice: (symbol: string) => (state: any) => state.stockPrices[symbol],
  watchlistSymbols: (state: any) => {
    const watchlist = state.watchlists.find((w: any) => w.id === state.selectedWatchlist);
    return watchlist?.symbols || [];
  },
  isConnected: (state: any) => state.isConnected,
  marketSentiment: (state: any) => state.marketSentiment
};

export const uiSelectors = {
  theme: (state: any) => state.theme,
  isDarkMode: (state: any) => state.theme.mode === 'dark',
  notifications: (state: any) => state.notifications,
  activeModals: (state: any) => state.modals,
  isLoading: (state: any) => state.globalLoading || state.pageLoading,
  isMobile: (state: any) => state.isMobile
};

// Combined store actions for complex operations
export const storeActions = {
  // Initialize application state
  initializeApp: async () => {
    const authStore = useAuthStore.getState();
    const marketStore = useMarketStore.getState();
    const uiStore = useUIStore.getState();

    try {
      // Try to refresh authentication if tokens exist
      if (authStore.refreshToken) {
        await authStore.refreshAuth();
      }

      // Initialize market data
      await marketStore.fetchMarketData();

      // Set up responsive design
      const updateScreenSize = () => {
        uiStore.setScreenSize(window.innerWidth, window.innerHeight);
      };
      
      updateScreenSize();
      window.addEventListener('resize', updateScreenSize);

      return true;
    } catch (error) {
      console.error('Failed to initialize app:', error);
      return false;
    }
  },

  // Handle authentication errors
  handleAuthError: (error: any) => {
    const authStore = useAuthStore.getState();
    const uiStore = useUIStore.getState();

    if (error.status === 401) {
      authStore.logout();
      uiStore.showNotification({
        type: 'error',
        title: 'Session Expired',
        message: 'Please log in again to continue.'
      });
    } else {
      uiStore.showNotification({
        type: 'error',
        title: 'Authentication Error',
        message: error.message || 'An authentication error occurred.'
      });
    }
  },

  // Handle market data updates
  handleMarketUpdate: (data: any) => {
    const marketStore = useMarketStore.getState();
    
    switch (data.type) {
      case 'stock_price':
        marketStore.updateStockPrice(data.payload);
        break;
      case 'market_index':
        marketStore.updateMarketIndex(data.payload);
        break;
      case 'technical_indicators':
        marketStore.updateTechnicalIndicators(data.payload);
        break;
      case 'ai_analysis':
        marketStore.updateAIAnalysis(data.payload);
        break;
      case 'market_sentiment':
        marketStore.updateMarketSentiment(data.payload);
        break;
    }
  },

  // Show success notification with consistent styling
  showSuccess: (message: string, title = 'Success') => {
    const uiStore = useUIStore.getState();
    uiStore.showNotification({
      type: 'success',
      title,
      message,
      duration: 3000
    });
  },

  // Show error notification with consistent styling
  showError: (message: string, title = 'Error') => {
    const uiStore = useUIStore.getState();
    uiStore.showNotification({
      type: 'error',
      title,
      message,
      duration: 5000
    });
  },

  // Logout with cleanup
  logout: () => {
    const authStore = useAuthStore.getState();
    const marketStore = useMarketStore.getState();
    const uiStore = useUIStore.getState();

    // Clear authentication
    authStore.logout();

    // Clear sensitive market data
    marketStore.setConnectionStatus('disconnected');

    // Clear notifications and modals
    uiStore.clearNotifications();
    uiStore.hideAllModals();

    // Show logout confirmation
    uiStore.showNotification({
      type: 'info',
      title: 'Logged Out',
      message: 'You have been successfully logged out.',
      duration: 3000
    });
  }
};

// Hook for using multiple stores together
export const useStores = () => {
  const auth = useAuthStore();
  const market = useMarketStore();
  const ui = useUIStore();

  return { auth, market, ui };
};