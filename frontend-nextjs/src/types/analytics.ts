/**
 * Analytics and Usage Tracking Types
 * For API key usage tracking and developer analytics dashboard
 */

export interface APIRequest {
  id: string
  apiKeyId: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  timestamp: string
  responseTime: number // milliseconds
  statusCode: number
  success: boolean
  errorMessage?: string
}

export interface UsageStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  requestsByEndpoint: Record<string, number>
  requestsByDay: Array<{ date: string; count: number }>
  requestsByHour: Array<{ hour: number; count: number }>
}

export interface Analytics {
  apiKeyId: string
  period: 'day' | 'week' | 'month' | 'year'
  startDate: string
  endDate: string
  stats: UsageStats
  requests: APIRequest[]
}

export interface AnalyticsSummary {
  totalKeys: number
  totalRequests: number
  activeKeys: number
  requestsToday: number
  avgResponseTime: number
  successRate: number
  topEndpoints: Array<{ endpoint: string; count: number; percentage: number }>
  recentErrors: APIRequest[]
}

export const ANALYTICS_STORAGE_KEY = 'turtletrading_analytics'
export const MAX_STORED_REQUESTS = 1000 // Limit localStorage size
export const CHART_COLORS = {
  success: '#10b981', // green
  error: '#ef4444', // red
  warning: '#f59e0b', // yellow
  info: '#3b82f6', // blue
  primary: '#8b5cf6', // purple
}
