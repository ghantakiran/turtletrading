// API service for TurtleTrading platform
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  marketCap?: string;
  high?: number;
  low?: number;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface PortfolioData {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  winRate: number;
  sharpeRatio: number;
}

// Mock data for development
const mockStocks: StockData[] = [
  { symbol: 'AAPL', price: 175.43, change: 2.34, changePercent: 1.35, volume: '52.3M', marketCap: '$2.7T' },
  { symbol: 'NVDA', price: 445.67, change: -8.23, changePercent: -1.81, volume: '41.2M', marketCap: '$1.1T' },
  { symbol: 'MSFT', price: 412.89, change: 5.67, changePercent: 1.39, volume: '28.7M', marketCap: '$3.1T' },
  { symbol: 'GOOGL', price: 138.21, change: 1.45, changePercent: 1.06, volume: '33.1M', marketCap: '$1.7T' },
  { symbol: 'META', price: 298.34, change: -4.56, changePercent: -1.51, volume: '19.8M', marketCap: '$756B' },
  { symbol: 'TSLA', price: 248.50, change: 12.34, changePercent: 5.23, volume: '89.2M', marketCap: '$790B' },
];

const mockIndices: MarketIndex[] = [
  { name: 'S&P 500', value: 4897.32, change: 23.45, changePercent: 0.48 },
  { name: 'NASDAQ', value: 15234.67, change: -45.23, changePercent: -0.30 },
  { name: 'DOW', value: 37845.12, change: 156.78, changePercent: 0.42 },
  { name: 'Russell 2000', value: 2134.56, change: 8.92, changePercent: 0.42 },
];

const mockPortfolio: PortfolioData = {
  totalValue: 284750.85,
  dayChange: 12450.32,
  dayChangePercent: 4.58,
  winRate: 87.5,
  sharpeRatio: 2.4,
};

// Simulate API delay and add some randomness to data
const simulateApiCall = <T>(data: T): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data);
    }, 300 + Math.random() * 700); // Random delay between 300-1000ms
  });
};

// Add some realistic price fluctuations
const addPriceFluctuation = (stocks: StockData[]): StockData[] => {
  return stocks.map(stock => {
    const fluctuation = (Math.random() - 0.5) * 2; // -1 to +1 percent
    const newPrice = stock.price * (1 + fluctuation / 100);
    const newChange = newPrice - stock.price;
    const newChangePercent = (newChange / stock.price) * 100;

    return {
      ...stock,
      price: parseFloat(newPrice.toFixed(2)),
      change: parseFloat(newChange.toFixed(2)),
      changePercent: parseFloat(newChangePercent.toFixed(2)),
    };
  });
};

export const apiService = {
  // Stock data endpoints
  async getTopStocks(): Promise<StockData[]> {
    try {
      // Try real API first
      const response = await fetch(`${API_BASE_URL}/api/v1/market/movers`);
      if (response.ok) {
        const data = await response.json();
        return data.top_gainers || data;
      }
    } catch (error) {
      console.log('Using mock data for stocks');
    }

    // Fallback to mock data with realistic fluctuations
    return simulateApiCall(addPriceFluctuation(mockStocks));
  },

  async getStockPrice(symbol: string): Promise<StockData> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/stocks/${symbol}/price`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log(`Using mock data for ${symbol}`);
    }

    // Fallback to mock data
    const stock = mockStocks.find(s => s.symbol === symbol) || mockStocks[0];
    return simulateApiCall(addPriceFluctuation([stock])[0]);
  },

  // Market data endpoints
  async getMarketIndices(): Promise<MarketIndex[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/market/indices`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('Using mock data for market indices');
    }

    // Add small fluctuations to indices
    const fluctuatedIndices = mockIndices.map(index => ({
      ...index,
      value: index.value + (Math.random() - 0.5) * 50,
      change: index.change + (Math.random() - 0.5) * 10,
      changePercent: index.changePercent + (Math.random() - 0.5) * 0.2,
    }));

    return simulateApiCall(fluctuatedIndices);
  },

  // Portfolio data
  async getPortfolioData(): Promise<PortfolioData> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/portfolio/summary`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('Using mock data for portfolio');
    }

    // Add some variation to portfolio data
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    return simulateApiCall({
      ...mockPortfolio,
      totalValue: mockPortfolio.totalValue * (1 + variation),
      dayChange: mockPortfolio.dayChange * (1 + variation * 2),
      dayChangePercent: mockPortfolio.dayChangePercent * (1 + variation * 2),
    });
  },

  // Market sentiment
  async getMarketSentiment(): Promise<{ score: number; trend: string; confidence: number }> {
    const sentimentScore = Math.random() * 200 - 100; // -100 to +100
    const trend = sentimentScore > 10 ? 'bullish' : sentimentScore < -10 ? 'bearish' : 'neutral';
    const confidence = 60 + Math.random() * 40; // 60-100% confidence

    return simulateApiCall({
      score: parseFloat(sentimentScore.toFixed(1)),
      trend,
      confidence: parseFloat(confidence.toFixed(1)),
    });
  },

  // Technical indicators
  async getTechnicalAnalysis(symbol: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/stocks/${symbol}/technical`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log(`Using mock data for ${symbol} technical analysis`);
    }

    // Mock technical analysis data
    return simulateApiCall({
      rsi: 45 + Math.random() * 40, // 45-85 range
      macd: {
        macd: Math.random() * 4 - 2,
        signal: Math.random() * 4 - 2,
        histogram: Math.random() * 2 - 1,
      },
      bollingerBands: {
        upper: 180 + Math.random() * 20,
        middle: 175 + Math.random() * 10,
        lower: 170 + Math.random() * 10,
      },
      recommendation: Math.random() > 0.6 ? 'BUY' : Math.random() > 0.3 ? 'HOLD' : 'SELL',
      technicalScore: Math.random() * 100,
    });
  },
};

export default apiService;