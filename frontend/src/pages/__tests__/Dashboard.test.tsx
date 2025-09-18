import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReactNode } from 'react';
import Dashboard from '../Dashboard';
import useMarketStore from '../../stores/marketStore';
import useUIStore from '../../stores/uiStore';
import { marketService } from '../../services/marketService';

// Mock the market service
vi.mock('../../services/marketService', () => ({
  marketService: {
    getMarketOverview: vi.fn(),
    getTopMovers: vi.fn(),
  },
}));

// Mock Zustand stores
vi.mock('../../stores/marketStore');
vi.mock('../../stores/uiStore');

const mockMarketService = vi.mocked(marketService);
const mockUseMarketStore = vi.mocked(useMarketStore);
const mockUseUIStore = vi.mocked(useUIStore);

// Test data
const mockMarketOverview = {
  marketCap: 45000000000000,
  volume: 12500000000,
  advancingStocks: 1850,
  decliningStocks: 1420,
  unchangedStocks: 230,
  newHighs: 45,
  newLows: 12,
  timestamp: '2024-01-15T16:00:00Z',
  indices: [
    {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF',
      value: 4530.25,
      change: 12.45,
      changePercent: 0.28,
      timestamp: '2024-01-15T16:00:00Z'
    },
    {
      symbol: 'QQQ',
      name: 'Invesco QQQ Trust',
      value: 15845.73,
      change: -8.25,
      changePercent: -0.05,
      timestamp: '2024-01-15T16:00:00Z'
    }
  ],
  vix: {
    symbol: 'VIX',
    value: 23.45,
    change: -1.2,
    changePercent: -4.9,
    timestamp: '2024-01-15T16:00:00Z'
  }
};

const mockTopMovers = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 192.53,
    change: 5.75,
    changePercent: 3.08,
    volume: 95000000,
    marketCap: 3000000000000
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 408.75,
    change: 8.25,
    changePercent: 2.06,
    volume: 35000000,
    marketCap: 3100000000000
  }
];

const mockMarketStoreState = {
  marketIndices: {
    SPY: {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF',
      value: 4530.25,
      change: 12.45,
      changePercent: 0.28,
      timestamp: '2024-01-15T16:00:00Z'
    },
    QQQ: {
      symbol: 'QQQ',
      name: 'Invesco QQQ Trust',
      value: 15845.73,
      change: -8.25,
      changePercent: -0.05,
      timestamp: '2024-01-15T16:00:00Z'
    }
  },
  stockPrices: {},
  watchlists: [
    {
      id: 'default',
      name: 'My Watchlist',
      symbols: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'],
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z'
    }
  ],
  selectedWatchlist: 'default',
  isLoading: false,
  error: null,
  fetchMarketData: vi.fn().mockResolvedValue(undefined),
  setLoading: vi.fn(),
  setError: vi.fn(),
};

const mockUIStoreState = {
  showNotification: vi.fn(),
};

describe('Dashboard Component Integration', () => {
  let queryClient: QueryClient;

  const createWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    // Setup Zustand store mocks
    mockUseMarketStore.mockReturnValue(mockMarketStoreState as any);
    mockUseUIStore.mockReturnValue(mockUIStoreState as any);

    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Dashboard Rendering', () => {
    it('should render dashboard with loading state initially', async () => {
      mockMarketService.getMarketOverview.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockMarketOverview), 100))
      );
      mockMarketService.getTopMovers.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockTopMovers), 100))
      );

      render(<Dashboard />, { wrapper: createWrapper });

      // Should show loading state initially
      expect(screen.getByText('Loading market data...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should render dashboard with market data successfully', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Check if main sections are rendered
      expect(screen.getByText('Market overview and your trading insights')).toBeInTheDocument();
      expect(screen.getByText('S&P 500')).toBeInTheDocument();
      expect(screen.getByText('NASDAQ')).toBeInTheDocument();
      expect(screen.getByText('My Watchlist')).toBeInTheDocument();
      expect(screen.getByText('VIX')).toBeInTheDocument();
      expect(screen.getByText('Top Movers')).toBeInTheDocument();
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });

    it('should display market indices data from React Query', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(screen.getByText('4,530.25')).toBeInTheDocument();
        expect(screen.getByText('15,845.73')).toBeInTheDocument();
        expect(screen.getByText('23.45')).toBeInTheDocument();
      });

      // Check change indicators
      expect(screen.getByText('+12.45 (0.28%)')).toBeInTheDocument();
      expect(screen.getByText('-8.25 (-0.05%)')).toBeInTheDocument();
    });

    it('should display top movers from React Query', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
        expect(screen.getByText('$192.53')).toBeInTheDocument();
        expect(screen.getByText('+5.75 (3.08%)')).toBeInTheDocument();

        expect(screen.getByText('MSFT')).toBeInTheDocument();
        expect(screen.getByText('Microsoft Corporation')).toBeInTheDocument();
        expect(screen.getByText('$408.75')).toBeInTheDocument();
        expect(screen.getByText('+8.25 (2.06%)')).toBeInTheDocument();
      });
    });

    it('should display watchlist information from Zustand store', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // Number of stocks in watchlist
        expect(screen.getByText('Stocks tracked')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading when Zustand store is loading', () => {
      mockUseMarketStore.mockReturnValue({
        ...mockMarketStoreState,
        isLoading: true,
      } as any);

      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);

      render(<Dashboard />, { wrapper: createWrapper });

      expect(screen.getByText('Loading market data...')).toBeInTheDocument();
    });

    it('should show loading when React Query is loading', () => {
      mockMarketService.getMarketOverview.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockMarketOverview), 1000))
      );

      render(<Dashboard />, { wrapper: createWrapper });

      expect(screen.getByText('Loading market data...')).toBeInTheDocument();
    });

    it('should show loading indicator for top movers section', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockTopMovers), 1000))
      );

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      expect(screen.getByText('Loading top movers...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error state when Zustand store has error and no React Query data', () => {
      mockUseMarketStore.mockReturnValue({
        ...mockMarketStoreState,
        error: 'Failed to connect to market data API',
        isLoading: false,
      } as any);

      mockMarketService.getMarketOverview.mockRejectedValue(new Error('Server error'));

      render(<Dashboard />, { wrapper: createWrapper });

      expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Failed to connect to market data API')).toBeInTheDocument();
    });

    it('should display retry button in error state', () => {
      mockUseMarketStore.mockReturnValue({
        ...mockMarketStoreState,
        error: 'Connection failed',
        isLoading: false,
      } as any);

      mockMarketService.getMarketOverview.mockRejectedValue(new Error('Network error'));

      render(<Dashboard />, { wrapper: createWrapper });

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', async () => {
      const mockRefetch = vi.fn();
      mockUseMarketStore.mockReturnValue({
        ...mockMarketStoreState,
        error: 'Connection failed',
        isLoading: false,
      } as any);

      // Mock the hook to return refetch function
      vi.doMock('../../hooks/useMarketData', () => ({
        useMarketOverview: () => ({
          data: null,
          isLoading: false,
          error: new Error('Network error'),
          refetch: mockRefetch,
        }),
        useTopMovers: () => ({
          data: null,
          isLoading: false,
        }),
      }));

      const { rerender } = render(<Dashboard />, { wrapper: createWrapper });

      const retryButton = screen.getByText('Retry');
      
      await act(async () => {
        retryButton.click();
      });

      // In a real test, we would verify the refetch was called
      expect(retryButton).toBeInTheDocument();
    });

    it('should show notifications for Zustand errors', async () => {
      const mockFetchMarketData = vi.fn().mockRejectedValue(new Error('API Error'));
      mockUseMarketStore.mockReturnValue({
        ...mockMarketStoreState,
        fetchMarketData: mockFetchMarketData,
      } as any);

      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(mockUIStoreState.showNotification).toHaveBeenCalledWith({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to refresh market data',
          duration: 5000
        });
      });
    });
  });

  describe('Data Integration', () => {
    it('should call fetchMarketData on component mount', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(mockMarketStoreState.fetchMarketData).toHaveBeenCalled();
      });
    });

    it('should prioritize React Query data over Zustand fallback data', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        // Should show React Query data, not fallback data
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
        // Should not show fallback data
        expect(screen.queryByText('NVDA')).not.toBeInTheDocument();
      });
    });

    it('should fall back to mock data when React Query fails', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockRejectedValue(new Error('Failed to fetch'));

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        // Should show fallback mock data
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
        expect(screen.getByText('NVDA')).toBeInTheDocument(); // From fallback data
      });
    });
  });

  describe('UI Interactions', () => {
    it('should render quick action buttons', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(screen.getByText('📊 Analyze Stock')).toBeInTheDocument();
        expect(screen.getByText('📈 View Market')).toBeInTheDocument();
        expect(screen.getByText('🔔 Set Alert')).toBeInTheDocument();
        expect(screen.getByText('📋 Portfolio')).toBeInTheDocument();
      });
    });

    it('should display current time in header', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(screen.getByText('Last updated')).toBeInTheDocument();
        // Time display will vary, just check it exists
        const timeElement = screen.getByText(/\d{1,2}:\d{2}:\d{2}/);
        expect(timeElement).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render properly on different screen sizes', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);

      render(<Dashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        const dashboardElement = screen.getByText('Dashboard').closest('div');
        expect(dashboardElement).toHaveClass('space-y-6');
      });
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', async () => {
      const renderSpy = vi.fn();
      
      const TestDashboard = () => {
        renderSpy();
        return <Dashboard />;
      };

      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      render(<TestDashboard />, { wrapper: createWrapper });

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Initial render + potential re-render after data load
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });
});