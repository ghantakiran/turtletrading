import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { marketService, MarketOverview, MarketIndex, TopMover, SectorPerformance, MarketBreadth } from '../services/marketService';

// Query keys for React Query
export const marketKeys = {
  all: ['market'] as const,
  overview: () => [...marketKeys.all, 'overview'] as const,
  indices: () => [...marketKeys.all, 'indices'] as const,
  index: (symbol: string) => [...marketKeys.all, 'index', symbol] as const,
  movers: (type: string) => [...marketKeys.all, 'movers', type] as const,
  sectors: () => [...marketKeys.all, 'sectors'] as const,
  breadth: () => [...marketKeys.all, 'breadth'] as const,
  vix: () => [...marketKeys.all, 'vix'] as const,
  status: () => [...marketKeys.all, 'status'] as const,
};

// Hook for getting market overview
export function useMarketOverview(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.overview(),
    queryFn: () => marketService.getMarketOverview(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false,
    retry: 2,
  });
}

// Hook for getting market indices
export function useMarketIndices(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.indices(),
    queryFn: () => marketService.getMarketIndices(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false,
  });
}

// Hook for getting specific market index
export function useMarketIndex(symbol: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.index(symbol),
    queryFn: () => marketService.getMarketIndex(symbol),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false && !!symbol,
  });
}

// Hook for getting top movers
export function useTopMovers(
  type: 'gainers' | 'losers' | 'active' = 'gainers',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: marketKeys.movers(type),
    queryFn: () => marketService.getTopMovers(type),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: options?.enabled !== false,
  });
}

// Hook for getting sector performance
export function useSectorPerformance(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.sectors(),
    queryFn: () => marketService.getSectorPerformance(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: options?.enabled !== false,
  });
}

// Hook for getting market breadth
export function useMarketBreadth(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.breadth(),
    queryFn: () => marketService.getMarketBreadth(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: options?.enabled !== false,
  });
}

// Hook for getting VIX data
export function useVIX(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.vix(),
    queryFn: () => marketService.getVIX(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false,
  });
}

// Hook for getting market status
export function useMarketStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.status(),
    queryFn: () => marketService.getMarketStatus(),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: options?.enabled !== false,
  });
}

// Hook for invalidating market data
export function useInvalidateMarketData() {
  const queryClient = useQueryClient();
  
  return {
    invalidateOverview: () => {
      queryClient.invalidateQueries({ queryKey: marketKeys.overview() });
    },
    invalidateIndices: () => {
      queryClient.invalidateQueries({ queryKey: marketKeys.indices() });
    },
    invalidateMovers: () => {
      queryClient.invalidateQueries({ queryKey: [...marketKeys.all, 'movers'] });
    },
    invalidateAllMarketData: () => {
      queryClient.invalidateQueries({ queryKey: marketKeys.all });
    },
    refetchOverview: () => {
      queryClient.refetchQueries({ queryKey: marketKeys.overview() });
    },
  };
}

// Hook for prefetching market data
export function usePrefetchMarketData() {
  const queryClient = useQueryClient();
  
  return {
    prefetchMarketOverview: () => {
      queryClient.prefetchQuery({
        queryKey: marketKeys.overview(),
        queryFn: () => marketService.getMarketOverview(),
        staleTime: 30 * 1000,
      });
    },
    prefetchTopMovers: (type: 'gainers' | 'losers' | 'active' = 'gainers') => {
      queryClient.prefetchQuery({
        queryKey: marketKeys.movers(type),
        queryFn: () => marketService.getTopMovers(type),
        staleTime: 60 * 1000,
      });
    },
  };
}

// Custom hook for real-time market updates
export function useRealTimeMarketUpdates(intervalMs: number = 30000) {
  const { invalidateOverview, invalidateIndices } = useInvalidateMarketData();
  
  // Set up polling for real-time updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      invalidateOverview();
      invalidateIndices();
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, [intervalMs, invalidateOverview, invalidateIndices]);
}