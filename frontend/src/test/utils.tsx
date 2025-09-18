/**
 * Test Utilities for TurtleTrading Frontend
 * Common testing patterns and helpers for 100% coverage enforcement
 * Per IMPLEMENT_FROM_DOCS_FILLED.md requirements
 */

import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

// Custom render function with providers
interface CustomRenderOptions extends RenderOptions {
  initialEntries?: string[]
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

// Create test query client with disabled retries and cache
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Mock stock data for testing
export const mockStockData = {
  symbol: 'AAPL',
  current_price: 150.50,
  previous_close: 149.00,
  day_change: 1.50,
  day_change_percent: 1.01,
  volume: 75000000,
  market_cap: 2450000000000,
  pe_ratio: 28.5,
  fifty_two_week_high: 182.94,
  fifty_two_week_low: 124.17,
  timestamp: '2024-01-15T16:00:00Z'
}

// Mock technical indicators
export const mockTechnicalIndicators = {
  symbol: 'AAPL',
  rsi: 62.5,
  macd: {
    macd: 1.23,
    signal: 1.15,
    histogram: 0.08,
    trend: 1.0
  },
  bollinger_bands: {
    upper: 155.0,
    middle: 150.0,
    lower: 145.0,
    position: 0.5
  },
  stochastic: {
    k_percent: 75.0,
    d_percent: 72.0,
    signal: 1.0
  },
  adx: {
    adx: 35.0,
    plus_di: 25.0,
    minus_di: 15.0,
    trend_strength: 'Strong'
  },
  obv: 125000000,
  atr: 3.45,
  ema_20: 151.2,
  sma_50: 148.7,
  sma_200: 142.3,
  volume_sma: 70000000,
  technical_score: 0.65
}

// Mock LSTM prediction
export const mockLSTMPrediction = {
  symbol: 'AAPL',
  predictions: [
    { date: '2024-01-16', predicted_price: 152.30, confidence: 0.78 },
    { date: '2024-01-17', predicted_price: 153.80, confidence: 0.75 },
    { date: '2024-01-18', predicted_price: 155.10, confidence: 0.72 }
  ],
  model_accuracy: 0.82,
  trend_direction: 'bullish',
  confidence_interval: { lower: 145.0, upper: 165.0 }
}

// Mock sentiment data
export const mockSentimentData = {
  symbol: 'AAPL',
  overall_sentiment: 0.25,
  news_sentiment: 0.30,
  social_sentiment: 0.20,
  sentiment_sources: {
    financial_news: { count: 15, sentiment: 0.35 },
    twitter: { count: 250, sentiment: 0.18 },
    reddit: { count: 45, sentiment: 0.22 }
  },
  trending_keywords: ['earnings', 'iPhone', 'growth'],
  sentiment_trend: 'positive'
}

// Mock user data
export const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  name: 'Test User',
  is_premium: false,
  subscription_tier: 'free',
  created_at: '2024-01-01T00:00:00Z'
}

// Mock API responses
export const mockApiResponses = {
  login: {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: mockUser
  },
  stockPrice: mockStockData,
  technicalIndicators: mockTechnicalIndicators,
  lstmPrediction: mockLSTMPrediction,
  sentiment: mockSentimentData
}

// Helper to mock fetch responses
export function mockFetch(response: any, status: number = 200, ok: boolean = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(JSON.stringify(response)),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  })

  global.fetch = fetchMock
  return fetchMock
}

// Helper to mock WebSocket
export function mockWebSocket() {
  const websocketMock = {
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    url: 'ws://localhost:8000/ws',
    protocol: '',
    extensions: '',
    bufferedAmount: 0,
    binaryType: 'blob' as BinaryType,
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  }

  global.WebSocket = vi.fn().mockImplementation(() => websocketMock)
  return websocketMock
}

// Helper to mock localStorage
export function mockLocalStorage() {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }

  Object.defineProperty(window, 'localStorage', { value: localStorageMock })
  return localStorageMock
}

// Helper to wait for async operations
export function waitForNextTick() {
  return new Promise(resolve => process.nextTick(resolve))
}

// Helper to simulate user interactions
export const userInteractions = {
  clickButton: (button: HTMLElement) => {
    button.click()
  },

  fillInput: (input: HTMLInputElement, value: string) => {
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  },

  submitForm: (form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit', { bubbles: true }))
  }
}

// Helper to create mock intersection observer
export function mockIntersectionObserver() {
  const mockIntersectionObserver = vi.fn()
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null
  })
  window.IntersectionObserver = mockIntersectionObserver
  return mockIntersectionObserver
}

// Helper to create mock resize observer
export function mockResizeObserver() {
  const mockResizeObserver = vi.fn()
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null
  })
  window.ResizeObserver = mockResizeObserver
  return mockResizeObserver
}

// Test data generators
export const generateMockStockData = (symbol: string, price: number) => ({
  ...mockStockData,
  symbol,
  current_price: price,
  previous_close: price * 0.99,
  day_change: price * 0.01,
  day_change_percent: 1.0
})

export const generateMockWatchlist = (symbols: string[]) =>
  symbols.map(symbol => generateMockStockData(symbol, Math.random() * 200 + 50))

// Performance testing helpers
export const performanceHelpers = {
  measureRenderTime: async (renderFn: () => void) => {
    const start = performance.now()
    renderFn()
    const end = performance.now()
    return end - start
  },

  expectFastRender: (renderTime: number, maxTime: number = 16) => {
    expect(renderTime).toBeLessThan(maxTime)
  }
}

// Error boundary testing helpers
export const errorBoundaryHelpers = {
  triggerError: (component: any, error: Error) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    component.simulateError(error)
    spy.mockRestore()
  },

  expectErrorBoundary: (error: Error) => {
    expect(error).toBeInstanceOf(Error)
  }
}

// Export all utilities
export * from '@testing-library/react'
export * from '@testing-library/user-event'
export { vi } from 'vitest'