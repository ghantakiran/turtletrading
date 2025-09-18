import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
  high52Week: number;
  low52Week: number;
  avgVolume: number;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface TechnicalIndicators {
  symbol: string;
  rsi: number;
  macd: number;
  macdSignal: number;
  bollingerUpper: number;
  bollingerLower: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  adx: number;
  stochastic: number;
  timestamp: string;
}

export interface AIAnalysis {
  symbol: string;
  prediction: number;
  confidence: number;
  timeframe: '1d' | '7d' | '30d';
  direction: 'bullish' | 'bearish' | 'neutral';
  factors: string[];
  timestamp: string;
}

export interface MarketSentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  score: number; // -100 to 100
  newsCount: number;
  socialCount: number;
  timestamp: string;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketState {
  // Real-time data
  stockPrices: Record<string, StockPrice>;
  marketIndices: Record<string, MarketIndex>;
  technicalIndicators: Record<string, TechnicalIndicators>;
  aiAnalysis: Record<string, AIAnalysis>;
  marketSentiment: MarketSentiment | null;
  
  // User data
  watchlists: Watchlist[];
  selectedWatchlist: string | null;
  alerts: Alert[];
  
  // UI state
  isMarketOpen: boolean;
  lastUpdate: string | null;
  isLoading: boolean;
  error: string | null;
  
  // WebSocket connection
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Actions
  updateStockPrice: (data: StockPrice) => void;
  updateMarketIndex: (data: MarketIndex) => void;
  updateTechnicalIndicators: (data: TechnicalIndicators) => void;
  updateAIAnalysis: (data: AIAnalysis) => void;
  updateMarketSentiment: (data: MarketSentiment) => void;
  
  // Watchlist actions
  createWatchlist: (name: string) => void;
  deleteWatchlist: (id: string) => void;
  addToWatchlist: (watchlistId: string, symbol: string) => void;
  removeFromWatchlist: (watchlistId: string, symbol: string) => void;
  selectWatchlist: (id: string) => void;
  
  // Alert actions
  createAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
  deleteAlert: (id: string) => void;
  
  // Data fetching
  fetchStockData: (symbol: string) => Promise<void>;
  fetchMarketData: () => Promise<void>;
  
  // WebSocket actions
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
  
  // Utility actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export interface Alert {
  id: string;
  symbol: string;
  type: 'price_above' | 'price_below' | 'volume_spike' | 'rsi_overbought' | 'rsi_oversold';
  condition: number;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
}

const useMarketStore = create<MarketState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
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

    // Real-time data updates
    updateStockPrice: (data: StockPrice) => {
      set((state) => ({
        stockPrices: {
          ...state.stockPrices,
          [data.symbol]: data
        },
        lastUpdate: new Date().toISOString()
      }));
    },

    updateMarketIndex: (data: MarketIndex) => {
      set((state) => ({
        marketIndices: {
          ...state.marketIndices,
          [data.symbol]: data
        },
        lastUpdate: new Date().toISOString()
      }));
    },

    updateTechnicalIndicators: (data: TechnicalIndicators) => {
      set((state) => ({
        technicalIndicators: {
          ...state.technicalIndicators,
          [data.symbol]: data
        },
        lastUpdate: new Date().toISOString()
      }));
    },

    updateAIAnalysis: (data: AIAnalysis) => {
      set((state) => ({
        aiAnalysis: {
          ...state.aiAnalysis,
          [data.symbol]: data
        },
        lastUpdate: new Date().toISOString()
      }));
    },

    updateMarketSentiment: (data: MarketSentiment) => {
      set({
        marketSentiment: data,
        lastUpdate: new Date().toISOString()
      });
    },

    // Watchlist management
    createWatchlist: (name: string) => {
      const newWatchlist: Watchlist = {
        id: Date.now().toString(),
        name,
        symbols: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      set((state) => ({
        watchlists: [...state.watchlists, newWatchlist]
      }));
    },

    deleteWatchlist: (id: string) => {
      set((state) => ({
        watchlists: state.watchlists.filter(w => w.id !== id),
        selectedWatchlist: state.selectedWatchlist === id ? state.watchlists[0]?.id || null : state.selectedWatchlist
      }));
    },

    addToWatchlist: (watchlistId: string, symbol: string) => {
      set((state) => ({
        watchlists: state.watchlists.map(w => 
          w.id === watchlistId 
            ? { 
                ...w, 
                symbols: w.symbols.includes(symbol) ? w.symbols : [...w.symbols, symbol],
                updatedAt: new Date().toISOString()
              }
            : w
        )
      }));
    },

    removeFromWatchlist: (watchlistId: string, symbol: string) => {
      set((state) => ({
        watchlists: state.watchlists.map(w => 
          w.id === watchlistId 
            ? { 
                ...w, 
                symbols: w.symbols.filter(s => s !== symbol),
                updatedAt: new Date().toISOString()
              }
            : w
        )
      }));
    },

    selectWatchlist: (id: string) => {
      set({ selectedWatchlist: id });
    },

    // Alert management
    createAlert: (alertData: Omit<Alert, 'id' | 'createdAt'>) => {
      const newAlert: Alert = {
        ...alertData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      };
      
      set((state) => ({
        alerts: [...state.alerts, newAlert]
      }));
    },

    deleteAlert: (id: string) => {
      set((state) => ({
        alerts: state.alerts.filter(a => a.id !== id)
      }));
    },

    // Data fetching
    fetchStockData: async (symbol: string) => {
      set({ isLoading: true, error: null });
      
      try {
        // TODO: Replace with actual API call
        const response = await fetch(`/api/v1/stocks/${symbol}/price`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${symbol}`);
        }
        
        const data: StockPrice = await response.json();
        get().updateStockPrice(data);
        
        set({ isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : `Failed to fetch ${symbol}`,
          isLoading: false
        });
      }
    },

    fetchMarketData: async () => {
      set({ isLoading: true, error: null });
      
      try {
        // TODO: Replace with actual API calls
        const [indicesResponse, sentimentResponse] = await Promise.all([
          fetch('/api/v1/market/indices'),
          fetch('/api/v1/market/sentiment')
        ]);
        
        if (indicesResponse.ok) {
          const indices: MarketIndex[] = await indicesResponse.json();
          indices.forEach(index => get().updateMarketIndex(index));
        }
        
        if (sentimentResponse.ok) {
          const sentiment: MarketSentiment = await sentimentResponse.json();
          get().updateMarketSentiment(sentiment);
        }
        
        set({ isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch market data',
          isLoading: false
        });
      }
    },

    // WebSocket actions
    setConnectionStatus: (status) => {
      set({ 
        connectionStatus: status,
        isConnected: status === 'connected'
      });
    },

    subscribeToSymbol: (symbol: string) => {
      // TODO: Implement WebSocket subscription
      console.log(`Subscribing to ${symbol}`);
    },

    unsubscribeFromSymbol: (symbol: string) => {
      // TODO: Implement WebSocket unsubscription
      console.log(`Unsubscribing from ${symbol}`);
    },

    // Utility actions
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    }
  }))
);

export default useMarketStore;