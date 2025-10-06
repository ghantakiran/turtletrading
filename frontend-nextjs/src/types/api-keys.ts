/**
 * API Key Types and Interfaces
 */

export type APIKeyPermission =
  | 'market_data:read'
  | 'ai_insights:read'
  | 'portfolio:read'
  | 'portfolio:write'
  | 'alerts:read'
  | 'alerts:write'
  | 'news:read'

export type APIKeyStatus = 'active' | 'revoked' | 'expired'

export interface APIKey {
  id: string
  name: string
  key: string
  permissions: APIKeyPermission[]
  status: APIKeyStatus
  createdAt: string
  lastUsed?: string
  usageCount: number
  rateLimit: number
  currentUsage: number
}

export interface APIKeyCreateRequest {
  name: string
  permissions: APIKeyPermission[]
  rateLimit?: number
}

export interface APIKeyUsageStats {
  totalRequests: number
  requestsByEndpoint: Record<string, number>
  errorRate: number
  averageLatency: number
}

export const API_KEY_PERMISSIONS: Record<APIKeyPermission, string> = {
  'market_data:read': 'Read market data (stocks, indices, prices)',
  'ai_insights:read': 'Access AI predictions and sentiment analysis',
  'portfolio:read': 'View portfolio data',
  'portfolio:write': 'Create and modify portfolios',
  'alerts:read': 'View alerts and notifications',
  'alerts:write': 'Create and manage alerts',
  'news:read': 'Access news and flash news feed',
}

export const DEFAULT_RATE_LIMITS = {
  free: 1000, // 1000 requests/month
  developer: 50000, // 50k requests/month
  enterprise: 1000000, // 1M requests/month
}
