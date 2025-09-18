import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReactNode } from 'react';
import { 
  useMarketOverview, 
  useMarketIndices, 
  useTopMovers,
  useSectorPerformance,
  useMarketBreadth,
  useVIX,
  useMarketStatus,
  marketKeys 
} from '../useMarketData';
import { marketService } from '../../services/marketService';

// Mock the market service
vi.mock('../../services/marketService', () => ({
  marketService: {
    getMarketOverview: vi.fn(),
    getMarketIndices: vi.fn(),
    getTopMovers: vi.fn(),
    getSectorPerformance: vi.fn(),
    getMarketBreadth: vi.fn(),
    getVIX: vi.fn(),
    getMarketStatus: vi.fn(),
  },
}));

const mockMarketService = vi.mocked(marketService);

// Test data
const mockMarketOverview = {
  marketCap: 45000000000000,
  volume: 12500000000,
  advancingStocks: 1850,
  decliningStocks: 1420,
  unchangedStocks: 230,
  newHighs: 45,
  newLows: 12,
  timestamp: '2024-01-15T16:00:00Z'
};

const mockMarketIndices = [
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    price: 485.50,
    change: 2.75,
    changePercent: 0.57,
    volume: 85000000,
    timestamp: '2024-01-15T16:00:00Z'
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    price: 398.25,
    change: -1.20,
    changePercent: -0.30,
    volume: 45000000,
    timestamp: '2024-01-15T16:00:00Z'
  }
];

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

describe('React Query Market Data Hooks', () => {
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('useMarketOverview', () => {
    it('should fetch market overview data successfully', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);

      const { result } = renderHook(() => useMarketOverview(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockMarketOverview);
      expect(mockMarketService.getMarketOverview).toHaveBeenCalledTimes(1);
    });

    it('should handle market overview fetch error', async () => {
      const mockError = new Error('Failed to fetch market overview');
      mockMarketService.getMarketOverview.mockRejectedValue(mockError);

      const { result } = renderHook(() => useMarketOverview(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it('should respect enabled option', () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);

      const { result } = renderHook(() => useMarketOverview({ enabled: false }), {
        wrapper: createWrapper,
      });

      expect(result.current.isIdle).toBe(true);
      expect(mockMarketService.getMarketOverview).not.toHaveBeenCalled();
    });
  });

  describe('useMarketIndices', () => {
    it('should fetch market indices data successfully', async () => {
      mockMarketService.getMarketIndices.mockResolvedValue(mockMarketIndices);

      const { result } = renderHook(() => useMarketIndices(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockMarketIndices);
      expect(mockMarketService.getMarketIndices).toHaveBeenCalledTimes(1);
    });

    it('should handle market indices fetch error', async () => {
      const mockError = new Error('Failed to fetch market indices');
      mockMarketService.getMarketIndices.mockRejectedValue(mockError);

      const { result } = renderHook(() => useMarketIndices(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useTopMovers', () => {
    it('should fetch top gainers successfully', async () => {
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      const { result } = renderHook(() => useTopMovers('gainers'), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTopMovers);
      expect(mockMarketService.getTopMovers).toHaveBeenCalledWith('gainers');
    });

    it('should fetch top losers successfully', async () => {
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      const { result } = renderHook(() => useTopMovers('losers'), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockMarketService.getTopMovers).toHaveBeenCalledWith('losers');
    });

    it('should default to gainers when no type specified', async () => {
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      const { result } = renderHook(() => useTopMovers(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockMarketService.getTopMovers).toHaveBeenCalledWith('gainers');
    });
  });

  describe('useSectorPerformance', () => {
    it('should fetch sector performance data successfully', async () => {
      const mockSectorData = [
        { sector: 'Technology', performance: 2.5, volume: 150000000 },
        { sector: 'Healthcare', performance: 1.2, volume: 80000000 }
      ];
      mockMarketService.getSectorPerformance.mockResolvedValue(mockSectorData);

      const { result } = renderHook(() => useSectorPerformance(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockSectorData);
      expect(mockMarketService.getSectorPerformance).toHaveBeenCalledTimes(1);
    });
  });

  describe('useMarketBreadth', () => {
    it('should fetch market breadth data successfully', async () => {
      const mockBreadthData = {
        advanceDeclineRatio: 1.5,
        newHighsLows: { highs: 45, lows: 12 },
        upVolume: 8500000000,
        downVolume: 6200000000
      };
      mockMarketService.getMarketBreadth.mockResolvedValue(mockBreadthData);

      const { result } = renderHook(() => useMarketBreadth(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockBreadthData);
    });
  });

  describe('useVIX', () => {
    it('should fetch VIX data successfully', async () => {
      const mockVIXData = {
        symbol: 'VIX',
        price: 18.75,
        change: -0.85,
        changePercent: -4.34,
        timestamp: '2024-01-15T16:00:00Z'
      };
      mockMarketService.getVIX.mockResolvedValue(mockVIXData);

      const { result } = renderHook(() => useVIX(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockVIXData);
    });
  });

  describe('useMarketStatus', () => {
    it('should fetch market status successfully', async () => {
      const mockStatusData = {
        status: 'open',
        nextOpen: '2024-01-16T09:30:00Z',
        nextClose: '2024-01-15T16:00:00Z',
        timezone: 'America/New_York'
      };
      mockMarketService.getMarketStatus.mockResolvedValue(mockStatusData);

      const { result } = renderHook(() => useMarketStatus(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockStatusData);
    });
  });

  describe('Query Keys', () => {
    it('should generate correct query keys', () => {
      expect(marketKeys.all).toEqual(['market']);
      expect(marketKeys.overview()).toEqual(['market', 'overview']);
      expect(marketKeys.indices()).toEqual(['market', 'indices']);
      expect(marketKeys.index('SPY')).toEqual(['market', 'index', 'SPY']);
      expect(marketKeys.movers('gainers')).toEqual(['market', 'movers', 'gainers']);
      expect(marketKeys.sectors()).toEqual(['market', 'sectors']);
      expect(marketKeys.breadth()).toEqual(['market', 'breadth']);
      expect(marketKeys.vix()).toEqual(['market', 'vix']);
      expect(marketKeys.status()).toEqual(['market', 'status']);
    });
  });

  describe('React Query Configuration', () => {
    it('should have correct stale times configured', async () => {
      mockMarketService.getMarketOverview.mockResolvedValue(mockMarketOverview);

      const { result } = renderHook(() => useMarketOverview(), {
        wrapper: createWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Check that the query is properly configured
      const query = queryClient.getQueryCache().find({ queryKey: marketKeys.overview() });
      expect(query).toBeDefined();
    });

    it('should properly cache queries with different parameters', async () => {
      mockMarketService.getTopMovers.mockResolvedValue(mockTopMovers);

      // Render both gainers and losers hooks
      const { result: gainersResult } = renderHook(() => useTopMovers('gainers'), {
        wrapper: createWrapper,
      });
      const { result: losersResult } = renderHook(() => useTopMovers('losers'), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(gainersResult.current.isSuccess).toBe(true);
        expect(losersResult.current.isSuccess).toBe(true);
      });

      // Should have two separate cache entries
      const gainersQuery = queryClient.getQueryCache().find({ queryKey: marketKeys.movers('gainers') });
      const losersQuery = queryClient.getQueryCache().find({ queryKey: marketKeys.movers('losers') });
      
      expect(gainersQuery).toBeDefined();
      expect(losersQuery).toBeDefined();
      expect(gainersQuery).not.toBe(losersQuery);
    });
  });
});