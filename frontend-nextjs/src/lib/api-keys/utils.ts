/**
 * API Key Utilities
 * Functions for generating, managing, and storing API keys
 */

import { APIKey, APIKeyCreateRequest, APIKeyStatus } from '@/types/api-keys'

/**
 * Generate a cryptographically random API key
 */
export function generateAPIKey(): string {
  const prefix = 'tt_' // TurtleTrading prefix
  const randomBytes = new Uint8Array(32)

  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomBytes)
  } else {
    // Fallback for SSR
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }
  }

  const key = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return `${prefix}${key}`
}

/**
 * Create a new API key
 */
export function createAPIKey(request: APIKeyCreateRequest): APIKey {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    name: request.name,
    key: generateAPIKey(),
    permissions: [...request.permissions], // Create new array
    status: 'active',
    createdAt: now,
    usageCount: 0,
    rateLimit: request.rateLimit || 1000,
    currentUsage: 0,
  }
}

/**
 * Mask API key for display
 */
export function maskAPIKey(key: string): string {
  if (key.length < 12) return key
  const prefix = key.substring(0, 8)
  const suffix = key.substring(key.length - 4)
  return `${prefix}${'•'.repeat(key.length - 12)}${suffix}`
}

/**
 * Validate API key format
 */
export function isValidAPIKey(key: string): boolean {
  return /^tt_[0-9a-f]{64}$/.test(key)
}

/**
 * Store API keys in localStorage
 */
export function saveAPIKeys(keys: APIKey[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('turtle_api_keys', JSON.stringify(keys))
  } catch (error) {
    console.error('Failed to save API keys:', error)
  }
}

/**
 * Load API keys from localStorage
 */
export function loadAPIKeys(): APIKey[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('turtle_api_keys')
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load API keys:', error)
    return []
  }
}

/**
 * Revoke an API key
 */
export function revokeAPIKey(keys: APIKey[], keyId: string): APIKey[] {
  return keys.map(key =>
    key.id === keyId
      ? { ...key, status: 'revoked' as APIKeyStatus }
      : key
  )
}

/**
 * Delete an API key
 */
export function deleteAPIKey(keys: APIKey[], keyId: string): APIKey[] {
  return keys.filter(key => key.id !== keyId)
}

/**
 * Update API key usage
 */
export function updateAPIKeyUsage(keys: APIKey[], keyId: string): APIKey[] {
  return keys.map(key =>
    key.id === keyId
      ? {
          ...key,
          usageCount: key.usageCount + 1,
          currentUsage: key.currentUsage + 1,
          lastUsed: new Date().toISOString(),
        }
      : key
  )
}

/**
 * Check if rate limit is exceeded
 */
export function isRateLimitExceeded(key: APIKey): boolean {
  return key.currentUsage >= key.rateLimit
}

/**
 * Get usage percentage
 */
export function getUsagePercentage(key: APIKey): number {
  return Math.round((key.currentUsage / key.rateLimit) * 100)
}

/**
 * Check if approaching rate limit (> 80%)
 */
export function isApproachingLimit(key: APIKey): boolean {
  return getUsagePercentage(key) > 80
}

/**
 * Reset monthly usage (would be called by a cron job in production)
 */
export function resetMonthlyUsage(keys: APIKey[]): APIKey[] {
  return keys.map(key => ({
    ...key,
    currentUsage: 0,
  }))
}
