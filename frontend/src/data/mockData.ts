// Mock data for Yahoo Finance-inspired UI components

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  trend: 'up' | 'down' | 'neutral';
  category: 'trending' | 'gainer' | 'loser' | 'active' | 'watched';
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  author?: string;
  publishedAt: Date;
  imageUrl?: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  category: 'breaking' | 'earnings' | 'market' | 'company' | 'crypto' | 'economy';
  relatedSymbols: string[];
  importance: 'high' | 'medium' | 'low';
  readTime: number;
  isBreaking?: boolean;
  tags: string[];
}

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdate: Date;
}

export interface ChartDataPoint {
  time: string;
  price: number;
  volume?: number;
}

// Mock Market Indices Data
export const mockMarketIndices: MarketIndex[] = [
  {
    symbol: 'SPY',
    name: 'S&P 500',
    price: 4785.32,
    change: 23.45,
    changePercent: 0.49,
    lastUpdate: new Date()
  },
  {
    symbol: 'QQQ',
    name: 'NASDAQ',
    price: 408.67,
    change: -5.23,
    changePercent: -1.26,
    lastUpdate: new Date()
  },
  {
    symbol: 'DIA',
    name: 'Dow Jones',
    price: 378.42,
    change: 12.84,
    changePercent: 0.35,
    lastUpdate: new Date()
  },
  {
    symbol: 'IWM',
    name: 'Russell 2000',
    price: 198.76,
    change: -2.14,
    changePercent: -1.07,
    lastUpdate: new Date()
  }
];

// Mock Trending Stocks Data
export const mockTrendingStocks: StockData[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 193.75,
    change: 2.45,
    changePercent: 1.28,
    volume: 45672890,
    marketCap: '$3.01T',
    trend: 'up',
    category: 'trending'
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 415.26,
    change: -3.12,
    changePercent: -0.74,
    volume: 28934567,
    marketCap: '$3.09T',
    trend: 'down',
    category: 'trending'
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 875.43,
    change: 15.67,
    changePercent: 1.82,
    volume: 67823456,
    marketCap: '$2.16T',
    trend: 'up',
    category: 'gainer'
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    price: 142.87,
    change: -1.23,
    changePercent: -0.85,
    volume: 23456789,
    marketCap: '$1.80T',
    trend: 'down',
    category: 'trending'
  },
  {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    price: 487.92,
    change: 8.45,
    changePercent: 1.76,
    volume: 34567890,
    marketCap: '$1.24T',
    trend: 'up',
    category: 'gainer'
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    price: 167.23,
    change: -2.89,
    changePercent: -1.70,
    volume: 41234567,
    marketCap: '$1.73T',
    trend: 'down',
    category: 'loser'
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    price: 248.67,
    change: 12.34,
    changePercent: 5.22,
    volume: 78901234,
    marketCap: '$792B',
    trend: 'up',
    category: 'active'
  },
  {
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co.',
    price: 178.45,
    change: 1.23,
    changePercent: 0.69,
    volume: 15678901,
    marketCap: '$522B',
    trend: 'up',
    category: 'watched'
  }
];

// Mock Top Gainers
export const mockTopGainers: StockData[] = [
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    price: 156.78,
    change: 12.45,
    changePercent: 8.63,
    volume: 45672890,
    marketCap: '$253B',
    trend: 'up',
    category: 'gainer'
  },
  {
    symbol: 'COIN',
    name: 'Coinbase Global Inc.',
    price: 234.56,
    change: 18.67,
    changePercent: 8.65,
    volume: 23456789,
    marketCap: '$61B',
    trend: 'up',
    category: 'gainer'
  },
  {
    symbol: 'PLTR',
    name: 'Palantir Technologies',
    price: 43.21,
    change: 3.45,
    changePercent: 8.67,
    volume: 34567890,
    marketCap: '$95B',
    trend: 'up',
    category: 'gainer'
  },
  {
    symbol: 'MRVL',
    name: 'Marvell Technology',
    price: 87.54,
    change: 6.78,
    changePercent: 8.39,
    volume: 12345678,
    marketCap: '$75B',
    trend: 'up',
    category: 'gainer'
  }
];

// Mock News Data
export const mockNewsData: NewsItem[] = [
  {
    id: '1',
    title: 'Federal Reserve Signals Potential Rate Cuts Amid Economic Uncertainty',
    summary: 'The Federal Reserve indicated it may consider lowering interest rates in response to slowing economic indicators and global market volatility.',
    source: 'Financial Times',
    author: 'Sarah Johnson',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400',
    url: '#',
    sentiment: 'neutral',
    category: 'economy',
    relatedSymbols: ['SPY', 'QQQ', 'TLT'],
    importance: 'high',
    readTime: 4,
    isBreaking: true,
    tags: ['Federal Reserve', 'Interest Rates', 'Economy']
  },
  {
    id: '2',
    title: 'Apple Reports Record Q4 Earnings, iPhone Sales Exceed Expectations',
    summary: 'Apple Inc. exceeded analyst expectations with strong iPhone sales and services revenue growth in the fourth quarter.',
    source: 'Reuters',
    author: 'Michael Chen',
    publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    imageUrl: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400',
    url: '#',
    sentiment: 'positive',
    category: 'earnings',
    relatedSymbols: ['AAPL'],
    importance: 'high',
    readTime: 3,
    tags: ['Apple', 'Earnings', 'iPhone', 'Technology']
  },
  {
    id: '3',
    title: 'NVIDIA AI Chip Demand Continues to Drive Revenue Growth',
    summary: 'Strong demand for AI processors and data center solutions pushes NVIDIA to another record quarter.',
    source: 'Bloomberg',
    author: 'Lisa Wang',
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    url: '#',
    sentiment: 'positive',
    category: 'company',
    relatedSymbols: ['NVDA'],
    importance: 'medium',
    readTime: 2,
    tags: ['NVIDIA', 'AI', 'Semiconductors', 'Data Centers']
  },
  {
    id: '4',
    title: 'Market Volatility Increases as Investors Await Economic Data',
    summary: 'Stock markets show increased volatility ahead of key economic indicators including unemployment and inflation data.',
    source: 'Wall Street Journal',
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    url: '#',
    sentiment: 'negative',
    category: 'market',
    relatedSymbols: ['SPY', 'VIX', 'QQQ'],
    importance: 'medium',
    readTime: 3,
    tags: ['Market Volatility', 'Economic Data', 'S&P 500']
  },
  {
    id: '5',
    title: 'Tesla Announces New Gigafactory in Southeast Asia',
    summary: 'Tesla reveals plans for a new manufacturing facility to meet growing demand in Asian markets.',
    source: 'CNBC',
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    url: '#',
    sentiment: 'positive',
    category: 'company',
    relatedSymbols: ['TSLA'],
    importance: 'medium',
    readTime: 2,
    tags: ['Tesla', 'Manufacturing', 'Asia', 'Electric Vehicles']
  }
];

// Mock Chart Data
export const mockChartData: ChartDataPoint[] = [
  { time: '09:30', price: 193.25, volume: 1234567 },
  { time: '09:45', price: 193.45, volume: 987654 },
  { time: '10:00', price: 193.12, volume: 1345678 },
  { time: '10:15', price: 193.67, volume: 1123456 },
  { time: '10:30', price: 193.89, volume: 1456789 },
  { time: '10:45', price: 193.56, volume: 987123 },
  { time: '11:00', price: 193.75, volume: 1234890 },
  { time: '11:15', price: 194.12, volume: 1567890 },
  { time: '11:30', price: 193.98, volume: 1345123 },
  { time: '11:45', price: 194.23, volume: 1678901 },
  { time: '12:00', price: 194.01, volume: 1234567 },
  { time: '12:15', price: 193.87, volume: 1456123 },
  { time: '12:30', price: 194.15, volume: 1789012 },
  { time: '12:45', price: 194.34, volume: 1567234 },
  { time: '13:00', price: 194.12, volume: 1890123 },
  { time: '13:15', price: 193.95, volume: 1234567 },
  { time: '13:30', price: 194.28, volume: 1567890 },
  { time: '13:45', price: 194.45, volume: 1890234 },
  { time: '14:00', price: 194.23, volume: 1345678 },
  { time: '14:15', price: 194.56, volume: 1678901 },
  { time: '14:30', price: 194.78, volume: 1901234 },
  { time: '14:45', price: 194.45, volume: 1456789 },
  { time: '15:00', price: 194.67, volume: 1789012 },
  { time: '15:15', price: 194.89, volume: 2012345 },
  { time: '15:30', price: 194.56, volume: 1678901 },
  { time: '15:45', price: 194.75, volume: 1890123 }
];

// Mock Stock Price Card Data
export const mockStockCardData = {
  symbol: 'AAPL',
  companyName: 'Apple Inc.',
  price: 194.75,
  change: 1.50,
  changePercent: 0.78,
  volume: 47823456,
  marketCap: '$3.02T',
  peRatio: 29.85,
  high52Week: 199.62,
  low52Week: 164.08,
  dayHigh: 195.23,
  dayLow: 193.12,
  avgVolume: 52345678,
  dividend: 0.94,
  dividendYield: 0.48,
  chartData: mockChartData
};