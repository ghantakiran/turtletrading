/**
 * Mock Analytics Data Generator
 * Generates realistic mock data for analytics dashboard testing and development
 */

import type { APIRequest } from '@/types/analytics'

export enum TimeRange {
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
}

const ENDPOINTS = [
  '/api/v1/stocks',
  '/api/v1/stocks/{symbol}',
  '/api/v1/stocks/{symbol}/price',
  '/api/v1/market/indices',
  '/api/v1/ai/predictions',
  '/api/v1/ai/sentiment',
  '/api/v1/portfolio',
  '/api/v1/alerts',
  '/api/v1/news',
]

const HTTP_METHODS: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'> = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
]

const SUCCESS_STATUS_CODES = [200, 201, 204]
const ERROR_STATUS_CODES = [400, 401, 403, 404, 429, 500, 502, 503]

const ERROR_MESSAGES = [
  'Invalid API key',
  'Rate limit exceeded',
  'Resource not found',
  'Invalid request parameters',
  'Internal server error',
  'Service unavailable',
  'Unauthorized access',
  'Bad request',
]

/**
 * Generates a random element from an array
 */
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Generates a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generates a random timestamp within the last N days
 */
function randomTimestamp(daysAgo: number): string {
  const now = Date.now()
  const range = daysAgo * 24 * 60 * 60 * 1000 // Convert days to milliseconds
  const randomTime = now - Math.random() * range
  return new Date(randomTime).toISOString()
}

/**
 * Generates a single mock API request
 */
export function generateMockRequest(daysAgo: number = 7): APIRequest {
  const isSuccess = Math.random() > 0.1 // 90% success rate
  const statusCode = isSuccess
    ? randomElement(SUCCESS_STATUS_CODES)
    : randomElement(ERROR_STATUS_CODES)

  const request: APIRequest = {
    id: `req_${Date.now()}_${randomInt(1000, 9999)}`,
    apiKeyId: `key_${randomInt(1, 5)}`,
    endpoint: randomElement(ENDPOINTS),
    method: randomElement(HTTP_METHODS),
    timestamp: randomTimestamp(daysAgo),
    responseTime: isSuccess ? randomInt(50, 300) : randomInt(200, 2000),
    statusCode,
    success: isSuccess,
  }

  if (!isSuccess) {
    request.errorMessage = randomElement(ERROR_MESSAGES)
  }

  return request
}

/**
 * Generates an array of mock API requests
 */
export function generateMockAnalytics(count: number, daysAgo: number = 30): APIRequest[] {
  if (count === 0) {
    return []
  }

  return Array.from({ length: count }, () => generateMockRequest(daysAgo))
}

/**
 * Generates mock analytics data for a specific time range
 */
export function generateMockAnalyticsForTimeRange(
  timeRange: TimeRange,
  count: number
): APIRequest[] {
  let daysAgo: number

  switch (timeRange) {
    case TimeRange.SEVEN_DAYS:
      daysAgo = 7
      break
    case TimeRange.THIRTY_DAYS:
      daysAgo = 30
      break
    case TimeRange.NINETY_DAYS:
      daysAgo = 90
      break
    default:
      daysAgo = 30
  }

  return generateMockAnalytics(count, daysAgo)
}

/**
 * Storage key for analytics data (must match ANALYTICS_STORAGE_KEY from types)
 */
const ANALYTICS_STORAGE_KEY = 'turtletrading_analytics'

/**
 * Seeds the analytics with mock data (for development/testing)
 */
export function seedMockAnalytics(count: number = 100): void {
  try {
    const mockData = generateMockAnalytics(count, 30)
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(mockData))
    console.log(`✅ Seeded ${count} mock API requests`)
  } catch (error) {
    console.error('Failed to seed mock analytics:', error)
  }
}

/**
 * Clears mock analytics data
 */
export function clearMockAnalytics(): void {
  try {
    localStorage.removeItem(ANALYTICS_STORAGE_KEY)
    console.log('✅ Cleared mock analytics data')
  } catch (error) {
    console.error('Failed to clear mock analytics:', error)
  }
}
