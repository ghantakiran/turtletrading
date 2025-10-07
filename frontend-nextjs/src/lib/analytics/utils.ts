/**
 * Analytics Utilities
 * Tracking and analyzing API key usage
 */

import type { APIRequest, UsageStats, AnalyticsSummary } from '@/types/analytics'
import { ANALYTICS_STORAGE_KEY, MAX_STORED_REQUESTS } from '@/types/analytics'

/**
 * Create a new API request record
 */
export function createAPIRequest(params: {
  apiKeyId: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  statusCode: number
  responseTime: number
  errorMessage?: string
}): APIRequest {
  const success = params.statusCode >= 200 && params.statusCode < 400

  return {
    id: crypto.randomUUID(),
    apiKeyId: params.apiKeyId,
    endpoint: params.endpoint,
    method: params.method,
    timestamp: new Date().toISOString(),
    responseTime: params.responseTime,
    statusCode: params.statusCode,
    success,
    errorMessage: params.errorMessage,
  }
}

/**
 * Save API request to localStorage
 */
export function saveAPIRequest(request: APIRequest): void {
  if (typeof window === 'undefined') return

  try {
    const existing = loadAPIRequests()
    const updated = [request, ...existing].slice(0, MAX_STORED_REQUESTS)
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to save API request:', error)
  }
}

/**
 * Load all API requests from localStorage
 */
export function loadAPIRequests(): APIRequest[] {
  if (typeof window === 'undefined') return []

  try {
    const data = localStorage.getItem(ANALYTICS_STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data) as APIRequest[]
  } catch (error) {
    console.error('Failed to load API requests:', error)
    return []
  }
}

/**
 * Calculate usage statistics from requests
 */
export function getUsageStats(requests: APIRequest[]): UsageStats {
  if (requests.length === 0) {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsByEndpoint: {},
      requestsByDay: [],
      requestsByHour: [],
    }
  }

  const successfulRequests = requests.filter(r => r.success).length
  const failedRequests = requests.length - successfulRequests
  const totalResponseTime = requests.reduce((sum, r) => sum + r.responseTime, 0)
  const averageResponseTime = Math.round(totalResponseTime / requests.length)

  // Group by endpoint
  const requestsByEndpoint: Record<string, number> = {}
  requests.forEach(r => {
    requestsByEndpoint[r.endpoint] = (requestsByEndpoint[r.endpoint] || 0) + 1
  })

  // Group by day
  const dayGroups: Record<string, number> = {}
  requests.forEach(r => {
    const date = r.timestamp.split('T')[0]
    dayGroups[date] = (dayGroups[date] || 0) + 1
  })
  const requestsByDay = Object.entries(dayGroups)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Group by hour
  const hourGroups: Record<number, number> = {}
  requests.forEach(r => {
    const hour = new Date(r.timestamp).getHours()
    hourGroups[hour] = (hourGroups[hour] || 0) + 1
  })
  const requestsByHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourGroups[hour] || 0,
  }))

  return {
    totalRequests: requests.length,
    successfulRequests,
    failedRequests,
    averageResponseTime,
    requestsByEndpoint,
    requestsByDay,
    requestsByHour,
  }
}

/**
 * Calculate success rate as percentage
 */
export function calculateSuccessRate(requests: APIRequest[]): number {
  if (requests.length === 0) return 0
  const successful = requests.filter(r => r.success).length
  return Math.round((successful / requests.length) * 100)
}

/**
 * Calculate average response time
 */
export function calculateAverageResponseTime(requests: APIRequest[]): number {
  if (requests.length === 0) return 0
  const total = requests.reduce((sum, r) => sum + r.responseTime, 0)
  return Math.round(total / requests.length)
}

/**
 * Get top endpoints by usage
 */
export function getTopEndpoints(
  requests: APIRequest[],
  limit: number = 5
): Array<{ endpoint: string; count: number; percentage: number }> {
  if (requests.length === 0) return []

  const endpointCounts: Record<string, number> = {}
  requests.forEach(r => {
    endpointCounts[r.endpoint] = (endpointCounts[r.endpoint] || 0) + 1
  })

  return Object.entries(endpointCounts)
    .map(([endpoint, count]) => ({
      endpoint,
      count,
      percentage: Math.round((count / requests.length) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Get recent error requests
 */
export function getRecentErrors(requests: APIRequest[], limit: number = 10): APIRequest[] {
  return requests
    .filter(r => !r.success)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
}

/**
 * Filter requests by date range
 */
export function getRequestsByDateRange(
  requests: APIRequest[],
  startDate: string,
  endDate: string
): APIRequest[] {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()

  return requests.filter(r => {
    const timestamp = new Date(r.timestamp).getTime()
    return timestamp >= start && timestamp <= end
  })
}

/**
 * Filter requests by endpoint
 */
export function getRequestsByEndpoint(requests: APIRequest[], endpoint: string): APIRequest[] {
  return requests.filter(r => r.endpoint === endpoint)
}

/**
 * Remove requests older than specified days
 */
export function cleanupOldRequests(days: number = 30): void {
  if (typeof window === 'undefined') return

  try {
    const requests = loadAPIRequests()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const filtered = requests.filter(r => new Date(r.timestamp) >= cutoffDate)
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Failed to cleanup old requests:', error)
  }
}

/**
 * Generate comprehensive analytics summary
 */
export function getAnalyticsSummary(requests: APIRequest[], totalKeys: number): AnalyticsSummary {
  const stats = getUsageStats(requests)

  // Get unique API keys that made requests
  const uniqueKeys = new Set(requests.map(r => r.apiKeyId))
  const activeKeys = uniqueKeys.size

  // Get requests from today
  const today = new Date().toISOString().split('T')[0]
  const requestsToday = requests.filter(r => r.timestamp.startsWith(today)).length

  return {
    totalKeys,
    totalRequests: stats.totalRequests,
    activeKeys,
    requestsToday,
    avgResponseTime: stats.averageResponseTime,
    successRate: calculateSuccessRate(requests),
    topEndpoints: getTopEndpoints(requests, 5),
    recentErrors: getRecentErrors(requests, 10),
  }
}
