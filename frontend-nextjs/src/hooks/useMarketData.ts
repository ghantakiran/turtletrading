"use client";

import { useState, useEffect } from 'react';
import { apiService, StockData, MarketIndex, PortfolioData } from '@/services/api';

export function useMarketData() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchMarketData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [stocksData, indicesData, portfolioData] = await Promise.all([
        apiService.getTopStocks(),
        apiService.getMarketIndices(),
        apiService.getPortfolioData(),
      ]);

      setStocks(stocksData);
      setIndices(indicesData);
      setPortfolio(portfolioData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      console.error('Error fetching market data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchMarketData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    stocks,
    indices,
    portfolio,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchMarketData,
  };
}

export function useStockPrice(symbol: string) {
  const [data, setData] = useState<StockData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    const fetchStock = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const stockData = await apiService.getStockPrice(symbol);
        setData(stockData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStock();

    // Refresh every 10 seconds for individual stocks
    const interval = setInterval(fetchStock, 10000);
    return () => clearInterval(interval);
  }, [symbol]);

  return { data, isLoading, error };
}

export function useTechnicalAnalysis(symbol: string) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    const fetchTechnicalData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const technicalData = await apiService.getTechnicalAnalysis(symbol);
        setData(technicalData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch technical analysis');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTechnicalData();

    // Refresh every minute for technical analysis
    const interval = setInterval(fetchTechnicalData, 60000);
    return () => clearInterval(interval);
  }, [symbol]);

  return { data, isLoading, error };
}

export function useMarketSentiment() {
  const [sentiment, setSentiment] = useState<{
    score: number;
    trend: string;
    confidence: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const sentimentData = await apiService.getMarketSentiment();
        setSentiment(sentimentData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch market sentiment');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSentiment();

    // Refresh every 2 minutes for sentiment
    const interval = setInterval(fetchSentiment, 120000);
    return () => clearInterval(interval);
  }, []);

  return { sentiment, isLoading, error };
}