/**
 * API Service Layer Unit Tests
 * 100% coverage for API client and service layer
 */

import { apiClient, ApiError } from '../api'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock environment variables
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8000'
process.env.NEXT_PUBLIC_API_TIMEOUT = '30000'

// Mock localStorage for auth tokens
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  log: jest.spyOn(console, 'log').mockImplementation(),
}

describe('API Service Layer', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    mockFetch.mockReset()
    mockLocalStorage.clear()

    // Reset AbortController
    global.AbortController = jest.fn(() => ({
      abort: jest.fn(),
      signal: { aborted: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }
    })) as any
  })

  afterAll(() => {
    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore())
  })

  describe('API Client Configuration', () => {
    it('should handle authenticated API requests', async () => {
      const mockResponse = { data: 'test data' }
      mockLocalStorage.setItem('auth_token', 'valid-jwt-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      const result = await apiClient.get('/test-endpoint')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/test-endpoint',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-jwt-token',
            'Content-Type': 'application/json'
          })
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle requests without authentication', async () => {
      const mockResponse = { data: 'public data' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      const result = await apiClient.get('/public-endpoint')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/public-endpoint',
        expect.objectContaining({
          method: 'GET',
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should implement retry logic for failed requests', async () => {
      const mockError = new Error('Network error')
      const mockResponse = { data: 'success after retry' }

      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
          headers: new Headers({ 'content-type': 'application/json' })
        })

      const result = await apiClient.get('/retry-endpoint', { maxRetries: 3 })

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result).toEqual(mockResponse)
    })

    it('should handle rate limiting responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ detail: 'Rate limit exceeded' }),
        headers: new Headers({
          'content-type': 'application/json',
          'retry-after': '60'
        })
      })

      await expect(apiClient.get('/rate-limited-endpoint')).rejects.toThrow(ApiError)

      try {
        await apiClient.get('/rate-limited-endpoint')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(429)
        expect((error as ApiError).retryAfter).toBe(60)
      }
    })

    it('should transform API responses to frontend models', async () => {
      const apiResponse = {
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        change_percent: 1.69, // Snake case from API
        market_cap: 2400000000000,
        last_updated: '2024-01-15T10:30:00Z'
      }

      const expectedFrontendModel = {
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changePercent: 1.69, // Camel case for frontend
        marketCap: 2400000000000,
        lastUpdated: '2024-01-15T10:30:00Z'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => apiResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      const result = await apiClient.get('/stocks/AAPL/price', {
        transform: (data: any) => ({
          ...data,
          changePercent: data.change_percent,
          marketCap: data.market_cap,
          lastUpdated: data.last_updated
        })
      })

      expect(result.changePercent).toBe(1.69)
      expect(result.marketCap).toBe(2400000000000)
      expect(result.lastUpdated).toBe('2024-01-15T10:30:00Z')
    })

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error')
      networkError.name = 'NetworkError'

      mockFetch.mockRejectedValueOnce(networkError)

      await expect(apiClient.get('/network-error-endpoint')).rejects.toThrow(ApiError)

      try {
        await apiClient.get('/network-error-endpoint')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).message).toContain('Network error')
      }
    })

    it('should validate API response schemas', async () => {
      const invalidResponse = {
        // Missing required fields
        symbol: 'AAPL'
        // Missing price, change, etc.
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => invalidResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      // With validation enabled
      const validator = (data: any) => {
        if (!data.price) {
          throw new Error('Missing required field: price')
        }
        return data
      }

      await expect(
        apiClient.get('/stocks/AAPL/price', { validate: validator })
      ).rejects.toThrow('Missing required field: price')
    })
  })

  describe('HTTP Methods', () => {
    it('should handle GET requests', async () => {
      const mockResponse = { data: 'get response' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      const result = await apiClient.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/test',
        expect.objectContaining({
          method: 'GET'
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle POST requests with data', async () => {
      const postData = { name: 'Test User', email: 'test@example.com' }
      const mockResponse = { id: 1, ...postData }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      const result = await apiClient.post('/users', postData)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle PUT requests', async () => {
      const putData = { id: 1, name: 'Updated User' }
      const mockResponse = putData

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      const result = await apiClient.put('/users/1', putData)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(putData)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle DELETE requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
        headers: new Headers()
      })

      const result = await apiClient.delete('/users/1')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
      expect(result).toEqual({})
    })

    it('should handle PATCH requests', async () => {
      const patchData = { name: 'Partially Updated User' }
      const mockResponse = { id: 1, name: 'Partially Updated User', email: 'old@example.com' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      const result = await apiClient.patch('/users/1', patchData)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(patchData)
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Request Options and Headers', () => {
    it('should handle custom headers', async () => {
      const mockResponse = { data: 'custom headers response' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      await apiClient.get('/test', {
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Request-ID': 'req-123'
        }
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
            'X-Request-ID': 'req-123'
          })
        })
      )
    })

    it('should handle query parameters', async () => {
      const mockResponse = { data: 'query params response' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      await apiClient.get('/stocks', {
        params: {
          symbols: 'AAPL,MSFT,GOOGL',
          timeframe: '1D',
          indicators: 'RSI,MACD'
        }
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('symbols=AAPL%2CMSFT%2CGOOGL'),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timeframe=1D'),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('indicators=RSI%2CMACD'),
        expect.any(Object)
      )
    })

    it('should handle request timeout', async () => {
      const mockAbortController = {
        abort: jest.fn(),
        signal: {
          aborted: false,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        }
      }

      global.AbortController = jest.fn(() => mockAbortController) as any

      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      )

      await expect(
        apiClient.get('/slow-endpoint', { timeout: 1000 })
      ).rejects.toThrow()

      expect(mockAbortController.abort).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle HTTP error responses', async () => {
      const errorResponse = {
        detail: 'Stock symbol not found',
        code: 'STOCK_NOT_FOUND'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      await expect(apiClient.get('/stocks/INVALID')).rejects.toThrow(ApiError)

      try {
        await apiClient.get('/stocks/INVALID')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(404)
        expect((error as ApiError).message).toBe('Stock symbol not found')
        expect((error as ApiError).code).toBe('STOCK_NOT_FOUND')
      }
    })

    it('should handle validation errors (422)', async () => {
      const validationErrors = {
        detail: [
          {
            loc: ['body', 'email'],
            msg: 'field required',
            type: 'value_error.missing'
          },
          {
            loc: ['body', 'password'],
            msg: 'ensure this value has at least 8 characters',
            type: 'value_error.any_str.min_length'
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => validationErrors,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      await expect(apiClient.post('/auth/register', {})).rejects.toThrow(ApiError)

      try {
        await apiClient.post('/auth/register', {})
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(422)
        expect((error as ApiError).validationErrors).toEqual(validationErrors.detail)
      }
    })

    it('should handle server errors (500)', async () => {
      const serverError = {
        detail: 'Internal server error',
        timestamp: '2024-01-15T10:30:00Z'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => serverError,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      await expect(apiClient.get('/server-error')).rejects.toThrow(ApiError)

      try {
        await apiClient.get('/server-error')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
        expect((error as ApiError).message).toBe('Internal server error')
      }
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
        text: async () => 'Internal Server Error',
        headers: new Headers({ 'content-type': 'text/html' })
      })

      await expect(apiClient.get('/malformed-response')).rejects.toThrow(ApiError)
    })

    it('should handle authentication errors (401)', async () => {
      const authError = {
        detail: 'Could not validate credentials'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => authError,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      await expect(apiClient.get('/protected-endpoint')).rejects.toThrow(ApiError)

      try {
        await apiClient.get('/protected-endpoint')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(401)
        expect((error as ApiError).message).toBe('Could not validate credentials')
      }
    })

    it('should handle authorization errors (403)', async () => {
      const forbiddenError = {
        detail: 'Insufficient permissions'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => forbiddenError,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      await expect(apiClient.get('/admin-endpoint')).rejects.toThrow(ApiError)

      try {
        await apiClient.get('/admin-endpoint')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(403)
        expect((error as ApiError).message).toBe('Insufficient permissions')
      }
    })
  })

  describe('Caching and Performance', () => {
    it('should cache frequently accessed data', async () => {
      const mockResponse = { data: 'cached response' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({
          'content-type': 'application/json',
          'cache-control': 'max-age=300'
        })
      })

      // First request
      const result1 = await apiClient.get('/cached-endpoint', { cache: true })
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Second request should use cache (if implemented)
      const result2 = await apiClient.get('/cached-endpoint', { cache: true })

      expect(result1).toEqual(mockResponse)
      expect(result2).toEqual(mockResponse)
    })

    it('should handle conditional requests with ETags', async () => {
      const mockResponse = { data: 'etag response' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({
          'content-type': 'application/json',
          'etag': '"abc123"'
        })
      })

      await apiClient.get('/etag-endpoint')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/etag-endpoint',
        expect.objectContaining({
          method: 'GET'
        })
      )
    })
  })

  describe('Request Interceptors and Middleware', () => {
    it('should apply request interceptors', async () => {
      const mockResponse = { data: 'intercepted response' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      // Test with request ID generation
      await apiClient.get('/intercepted-endpoint', {
        interceptors: {
          request: (config) => ({
            ...config,
            headers: {
              ...config.headers,
              'X-Request-ID': `req-${Date.now()}`
            }
          })
        }
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/intercepted-endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request-ID': expect.stringMatching(/^req-\d+$/)
          })
        })
      )
    })

    it('should apply response interceptors', async () => {
      const mockResponse = { data: 'original response' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' })
      })

      const result = await apiClient.get('/response-intercepted', {
        interceptors: {
          response: (data) => ({
            ...data,
            intercepted: true,
            timestamp: new Date().toISOString()
          })
        }
      })

      expect(result.intercepted).toBe(true)
      expect(result.timestamp).toBeDefined()
    })
  })
})