/**
 * Unit tests for API Key Utilities
 */

import {
  generateAPIKey,
  createAPIKey,
  maskAPIKey,
  isValidAPIKey,
  revokeAPIKey,
  deleteAPIKey,
  updateAPIKeyUsage,
  isRateLimitExceeded,
  getUsagePercentage,
  isApproachingLimit,
  resetMonthlyUsage,
} from '../utils'
import { APIKey, APIKeyCreateRequest } from '@/types/api-keys'

describe('API Key Utilities', () => {
  describe('generateAPIKey', () => {
    it('should generate API key with tt_ prefix', () => {
      const key = generateAPIKey()
      expect(key).toMatch(/^tt_/)
    })

    it('should generate 64-character hex string after prefix', () => {
      const key = generateAPIKey()
      expect(key).toMatch(/^tt_[0-9a-f]{64}$/)
    })

    it('should generate unique keys', () => {
      const key1 = generateAPIKey()
      const key2 = generateAPIKey()
      expect(key1).not.toBe(key2)
    })

    it('should generate keys of consistent length', () => {
      const keys = Array.from({ length: 10 }, () => generateAPIKey())
      const lengths = keys.map(k => k.length)
      expect(new Set(lengths).size).toBe(1) // All same length
      expect(lengths[0]).toBe(67) // tt_ (3) + 64 hex chars
    })
  })

  describe('createAPIKey', () => {
    const request: APIKeyCreateRequest = {
      name: 'Test API Key',
      permissions: ['market_data:read', 'ai_insights:read'],
      rateLimit: 5000,
    }

    it('should create API key with all required fields', () => {
      const apiKey = createAPIKey(request)

      expect(apiKey).toHaveProperty('id')
      expect(apiKey).toHaveProperty('name', 'Test API Key')
      expect(apiKey).toHaveProperty('key')
      expect(apiKey).toHaveProperty('permissions')
      expect(apiKey).toHaveProperty('status', 'active')
      expect(apiKey).toHaveProperty('createdAt')
      expect(apiKey).toHaveProperty('usageCount', 0)
      expect(apiKey).toHaveProperty('rateLimit', 5000)
      expect(apiKey).toHaveProperty('currentUsage', 0)
    })

    it('should generate valid API key format', () => {
      const apiKey = createAPIKey(request)
      expect(isValidAPIKey(apiKey.key)).toBe(true)
    })

    it('should use default rate limit if not specified', () => {
      const keyWithoutLimit = createAPIKey({
        name: 'Test',
        permissions: ['market_data:read'],
      })
      expect(keyWithoutLimit.rateLimit).toBe(1000)
    })

    it('should copy permissions array', () => {
      const apiKey = createAPIKey(request)
      expect(apiKey.permissions).toEqual(request.permissions)
      expect(apiKey.permissions).not.toBe(request.permissions) // New array
    })

    it('should set status to active by default', () => {
      const apiKey = createAPIKey(request)
      expect(apiKey.status).toBe('active')
    })
  })

  describe('maskAPIKey', () => {
    it('should mask middle characters of API key', () => {
      const key = 'tt_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const masked = maskAPIKey(key)

      expect(masked).toContain('tt_12345')
      expect(masked).toContain('cdef')
      expect(masked).toContain('•')
      expect(masked.length).toBe(key.length)
    })

    it('should show first 8 and last 4 characters', () => {
      const key = 'tt_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const masked = maskAPIKey(key)

      expect(masked.substring(0, 8)).toBe('tt_12345')
      expect(masked.substring(masked.length - 4)).toBe('cdef')
    })

    it('should return original key if too short', () => {
      const shortKey = 'tt_short'
      expect(maskAPIKey(shortKey)).toBe(shortKey)
    })

    it('should handle empty string', () => {
      expect(maskAPIKey('')).toBe('')
    })
  })

  describe('isValidAPIKey', () => {
    it('should validate correct API key format', () => {
      const validKey = 'tt_' + '0'.repeat(64)
      expect(isValidAPIKey(validKey)).toBe(true)
    })

    it('should validate hex characters only', () => {
      const validKey = 'tt_' + 'abcdef0123456789'.repeat(4)
      expect(isValidAPIKey(validKey)).toBe(true)
    })

    it('should reject key without tt_ prefix', () => {
      const invalidKey = 'abc' + '0'.repeat(64)
      expect(isValidAPIKey(invalidKey)).toBe(false)
    })

    it('should reject key with wrong length', () => {
      const invalidKey = 'tt_' + '0'.repeat(32) // Too short
      expect(isValidAPIKey(invalidKey)).toBe(false)
    })

    it('should reject key with non-hex characters', () => {
      const invalidKey = 'tt_' + 'g'.repeat(64) // 'g' is not hex
      expect(isValidAPIKey(invalidKey)).toBe(false)
    })

    it('should reject empty string', () => {
      expect(isValidAPIKey('')).toBe(false)
    })
  })

  describe('revokeAPIKey', () => {
    const mockKeys: APIKey[] = [
      {
        id: '1',
        name: 'Key 1',
        key: 'tt_' + '0'.repeat(64),
        permissions: ['market_data:read'],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 10,
        rateLimit: 1000,
        currentUsage: 10,
      },
      {
        id: '2',
        name: 'Key 2',
        key: 'tt_' + '1'.repeat(64),
        permissions: ['ai_insights:read'],
        status: 'active',
        createdAt: '2024-01-02',
        usageCount: 5,
        rateLimit: 1000,
        currentUsage: 5,
      },
    ]

    it('should revoke specified API key', () => {
      const updated = revokeAPIKey(mockKeys, '1')
      expect(updated[0].status).toBe('revoked')
      expect(updated[1].status).toBe('active')
    })

    it('should not modify other keys', () => {
      const updated = revokeAPIKey(mockKeys, '1')
      expect(updated[1]).toEqual(mockKeys[1])
    })

    it('should handle non-existent key ID', () => {
      const updated = revokeAPIKey(mockKeys, '999')
      expect(updated).toEqual(mockKeys)
    })

    it('should return new array', () => {
      const updated = revokeAPIKey(mockKeys, '1')
      expect(updated).not.toBe(mockKeys)
    })
  })

  describe('deleteAPIKey', () => {
    const mockKeys: APIKey[] = [
      {
        id: '1',
        name: 'Key 1',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 0,
        rateLimit: 1000,
        currentUsage: 0,
      },
      {
        id: '2',
        name: 'Key 2',
        key: 'tt_' + '1'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-02',
        usageCount: 0,
        rateLimit: 1000,
        currentUsage: 0,
      },
    ]

    it('should remove specified API key', () => {
      const updated = deleteAPIKey(mockKeys, '1')
      expect(updated.length).toBe(1)
      expect(updated[0].id).toBe('2')
    })

    it('should handle non-existent key ID', () => {
      const updated = deleteAPIKey(mockKeys, '999')
      expect(updated).toEqual(mockKeys)
    })

    it('should handle empty array', () => {
      const updated = deleteAPIKey([], '1')
      expect(updated).toEqual([])
    })
  })

  describe('updateAPIKeyUsage', () => {
    const mockKeys: APIKey[] = [
      {
        id: '1',
        name: 'Key 1',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 10,
        rateLimit: 1000,
        currentUsage: 10,
      },
    ]

    it('should increment usage count', () => {
      const updated = updateAPIKeyUsage(mockKeys, '1')
      expect(updated[0].usageCount).toBe(11)
      expect(updated[0].currentUsage).toBe(11)
    })

    it('should update lastUsed timestamp', () => {
      const updated = updateAPIKeyUsage(mockKeys, '1')
      expect(updated[0].lastUsed).toBeDefined()
      expect(new Date(updated[0].lastUsed!).getTime()).toBeGreaterThan(0)
    })

    it('should not modify other keys', () => {
      const twoKeys = [
        ...mockKeys,
        { ...mockKeys[0], id: '2', usageCount: 5, currentUsage: 5 },
      ]
      const updated = updateAPIKeyUsage(twoKeys, '1')
      expect(updated[1].usageCount).toBe(5)
    })
  })

  describe('isRateLimitExceeded', () => {
    it('should return true when usage exceeds limit', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 1000,
        rateLimit: 1000,
        currentUsage: 1001,
      }
      expect(isRateLimitExceeded(key)).toBe(true)
    })

    it('should return true when usage equals limit', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 1000,
        rateLimit: 1000,
        currentUsage: 1000,
      }
      expect(isRateLimitExceeded(key)).toBe(true)
    })

    it('should return false when below limit', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 500,
        rateLimit: 1000,
        currentUsage: 500,
      }
      expect(isRateLimitExceeded(key)).toBe(false)
    })
  })

  describe('getUsagePercentage', () => {
    it('should calculate correct percentage', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 250,
        rateLimit: 1000,
        currentUsage: 250,
      }
      expect(getUsagePercentage(key)).toBe(25)
    })

    it('should round to nearest integer', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 333,
        rateLimit: 1000,
        currentUsage: 333,
      }
      expect(getUsagePercentage(key)).toBe(33)
    })

    it('should return 0 for zero usage', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 0,
        rateLimit: 1000,
        currentUsage: 0,
      }
      expect(getUsagePercentage(key)).toBe(0)
    })

    it('should return 100 for full usage', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 1000,
        rateLimit: 1000,
        currentUsage: 1000,
      }
      expect(getUsagePercentage(key)).toBe(100)
    })
  })

  describe('isApproachingLimit', () => {
    it('should return true when usage > 80%', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 850,
        rateLimit: 1000,
        currentUsage: 850,
      }
      expect(isApproachingLimit(key)).toBe(true)
    })

    it('should return false when usage <= 80%', () => {
      const key: APIKey = {
        id: '1',
        name: 'Key',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 800,
        rateLimit: 1000,
        currentUsage: 800,
      }
      expect(isApproachingLimit(key)).toBe(false)
    })
  })

  describe('resetMonthlyUsage', () => {
    const mockKeys: APIKey[] = [
      {
        id: '1',
        name: 'Key 1',
        key: 'tt_' + '0'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-01',
        usageCount: 500,
        rateLimit: 1000,
        currentUsage: 500,
      },
      {
        id: '2',
        name: 'Key 2',
        key: 'tt_' + '1'.repeat(64),
        permissions: [],
        status: 'active',
        createdAt: '2024-01-02',
        usageCount: 300,
        rateLimit: 1000,
        currentUsage: 300,
      },
    ]

    it('should reset currentUsage to 0 for all keys', () => {
      const updated = resetMonthlyUsage(mockKeys)
      expect(updated[0].currentUsage).toBe(0)
      expect(updated[1].currentUsage).toBe(0)
    })

    it('should not modify usageCount', () => {
      const updated = resetMonthlyUsage(mockKeys)
      expect(updated[0].usageCount).toBe(500)
      expect(updated[1].usageCount).toBe(300)
    })

    it('should handle empty array', () => {
      const updated = resetMonthlyUsage([])
      expect(updated).toEqual([])
    })
  })
})
