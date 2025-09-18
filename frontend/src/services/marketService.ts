import { api } from './api';

// Market-related types
export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

export interface TopMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
}

export interface MarketOverview {
  indices: MarketIndex[];
  topGainers: TopMover[];
  topLosers: TopMover[];
  mostActive: TopMover[];
  vix: {
    value: number;
    change: number;
    changePercent: number;
  };
  marketStatus: 'open' | 'closed' | 'pre-market' | 'after-hours';
  lastUpdated: string;
}

export interface SectorPerformance {
  sector: string;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
}

export interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
  advanceDeclineRatio: number;
  newHighs: number;
  newLows: number;
}

// Market API service functions
export const marketService = {
  // Get market overview
  getMarketOverview: (): Promise<MarketOverview> =>
    api.get<MarketOverview>('/market/overview'),

  // Get specific market index
  getMarketIndex: (symbol: string): Promise<MarketIndex> =>
    api.get<MarketIndex>(`/market/indices/${symbol}`),

  // Get all major indices
  getMarketIndices: (): Promise<MarketIndex[]> =>
    api.get<MarketIndex[]>('/market/indices'),

  // Get top movers
  getTopMovers: (type: 'gainers' | 'losers' | 'active' = 'gainers'): Promise<TopMover[]> =>
    api.get<TopMover[]>(`/market/movers/${type}`),

  // Get sector performance
  getSectorPerformance: (): Promise<SectorPerformance[]> =>
    api.get<SectorPerformance[]>('/market/sectors'),

  // Get market breadth data
  getMarketBreadth: (): Promise<MarketBreadth> =>
    api.get<MarketBreadth>('/market/breadth'),

  // Get VIX volatility index
  getVIX: (): Promise<{ value: number; change: number; changePercent: number }> =>
    api.get('/market/vix'),

  // Get market status
  getMarketStatus: (): Promise<{ status: string; nextOpen?: string; nextClose?: string }> =>
    api.get('/market/status'),
};