import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockService, StockPrice, HistoricalData, TechnicalIndicators, StockAnalysis } from '../services/stockService';

// Query keys for React Query
export const stockKeys = {
  all: ['stocks'] as const,
  price: (symbol: string) => [...stockKeys.all, 'price', symbol] as const,
  prices: (symbols: string[]) => [...stockKeys.all, 'prices', symbols.sort().join(',')] as const,
  history: (symbol: string, period: string) => [...stockKeys.all, 'history', symbol, period] as const,
  technical: (symbol: string) => [...stockKeys.all, 'technical', symbol] as const,
  analysis: (symbol: string) => [...stockKeys.all, 'analysis', symbol] as const,
  search: (query: string) => [...stockKeys.all, 'search', query] as const,
};

// Hook for getting stock price
export function useStockPrice(symbol: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: stockKeys.price(symbol),
    queryFn: () => stockService.getStockPrice(symbol),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false && !!symbol,
    retry: (failureCount, error: any) => {
      // Don't retry for 404 errors (invalid symbol)
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

// Hook for getting multiple stock prices
export function useMultipleStockPrices(symbols: string[], options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: stockKeys.prices(symbols),
    queryFn: () => stockService.getMultipleStockPrices(symbols),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false && symbols.length > 0,
  });
}

// Hook for getting historical data
export function useStockHistory(
  symbol: string, 
  period: '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '2y' | '5y' = '1m',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: stockKeys.history(symbol, period),
    queryFn: () => stockService.getHistoricalData(symbol, period),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: options?.enabled !== false && !!symbol,
  });
}

// Hook for getting technical indicators
export function useTechnicalIndicators(symbol: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: stockKeys.technical(symbol),
    queryFn: () => stockService.getTechnicalIndicators(symbol),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: options?.enabled !== false && !!symbol,
  });
}

// Hook for comprehensive stock analysis
export function useStockAnalysis(symbol: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: stockKeys.analysis(symbol),
    queryFn: () => stockService.getStockAnalysis(symbol),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: options?.enabled !== false && !!symbol,
  });
}

// Hook for stock search
export function useStockSearch(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: stockKeys.search(query),
    queryFn: () => stockService.searchStocks(query),
    staleTime: 10 * 60 * 1000, // 10 minutes (search results don't change often)
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: options?.enabled !== false && query.length >= 1,
  });
}

// Hook for invalidating stock data (useful for real-time updates)
export function useInvalidateStockData() {
  const queryClient = useQueryClient();
  
  return {
    invalidateStock: (symbol: string) => {
      queryClient.invalidateQueries({ queryKey: stockKeys.price(symbol) });
      queryClient.invalidateQueries({ queryKey: stockKeys.technical(symbol) });
      queryClient.invalidateQueries({ queryKey: stockKeys.analysis(symbol) });
    },
    invalidateAllStocks: () => {
      queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
    refetchStock: (symbol: string) => {
      queryClient.refetchQueries({ queryKey: stockKeys.price(symbol) });
      queryClient.refetchQueries({ queryKey: stockKeys.technical(symbol) });
    },
  };
}

// Hook for prefetching stock data (for better UX)
export function usePrefetchStockData() {
  const queryClient = useQueryClient();
  
  return {
    prefetchStockPrice: (symbol: string) => {
      queryClient.prefetchQuery({
        queryKey: stockKeys.price(symbol),
        queryFn: () => stockService.getStockPrice(symbol),
        staleTime: 30 * 1000,
      });
    },
    prefetchStockAnalysis: (symbol: string) => {
      queryClient.prefetchQuery({
        queryKey: stockKeys.analysis(symbol),
        queryFn: () => stockService.getStockAnalysis(symbol),
        staleTime: 5 * 60 * 1000,
      });
    },
  };
}