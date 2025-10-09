/**
 * Unit tests for Cache Manager with TTL
 * TDD approach - write tests first, then implement
 */

import { CacheManager } from '@/lib/cache/cache-manager'

describe('CacheManager', () => {
  let cacheManager: CacheManager

  beforeEach(async () => {
    cacheManager = new CacheManager()
    await cacheManager.clear()
  })

  afterEach(async () => {
    await cacheManager.clear()
  })

  describe('Initialization', () => {
    test('should create instance', () => {
      expect(cacheManager).toBeDefined()
      expect(cacheManager).toBeInstanceOf(CacheManager)
    })

    test('should initialize with empty cache', async () => {
      const size = await cacheManager.size()
      expect(size).toBe(0)
    })
  })

  describe('Set and Get', () => {
    test('should set and get a value', async () => {
      await cacheManager.set('key1', 'value1', 60000)

      const value = await cacheManager.get('key1')
      expect(value).toBe('value1')
    })

    test('should set and get complex objects', async () => {
      const complexObject = {
        id: 1,
        name: 'Test',
        nested: { value: 'nested' },
        array: [1, 2, 3],
      }

      await cacheManager.set('complex', complexObject, 60000)

      const retrieved = await cacheManager.get('complex')
      expect(retrieved).toEqual(complexObject)
    })

    test('should return null for non-existent key', async () => {
      const value = await cacheManager.get('non-existent')
      expect(value).toBeNull()
    })

    test('should overwrite existing value', async () => {
      await cacheManager.set('key1', 'value1', 60000)
      await cacheManager.set('key1', 'value2', 60000)

      const value = await cacheManager.get('key1')
      expect(value).toBe('value2')
    })
  })

  describe('TTL (Time To Live)', () => {
    test('should return value before expiration', async () => {
      await cacheManager.set('key1', 'value1', 1000) // 1 second TTL

      const value = await cacheManager.get('key1')
      expect(value).toBe('value1')
    })

    test('should return null after expiration', async () => {
      await cacheManager.set('key1', 'value1', 100) // 100ms TTL

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150))

      const value = await cacheManager.get('key1')
      expect(value).toBeNull()
    })

    test('should handle infinite TTL (0 or negative)', async () => {
      await cacheManager.set('key1', 'value1', 0)

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100))

      const value = await cacheManager.get('key1')
      expect(value).toBe('value1')
    })

    test('should update TTL on overwrite', async () => {
      await cacheManager.set('key1', 'value1', 100)
      await cacheManager.set('key1', 'value2', 60000) // New TTL

      await new Promise((resolve) => setTimeout(resolve, 150))

      const value = await cacheManager.get('key1')
      expect(value).toBe('value2') // Should still be there with new TTL
    })
  })

  describe('Has', () => {
    test('should return true for existing key', async () => {
      await cacheManager.set('key1', 'value1', 60000)

      const has = await cacheManager.has('key1')
      expect(has).toBe(true)
    })

    test('should return false for non-existent key', async () => {
      const has = await cacheManager.has('non-existent')
      expect(has).toBe(false)
    })

    test('should return false for expired key', async () => {
      await cacheManager.set('key1', 'value1', 100)

      await new Promise((resolve) => setTimeout(resolve, 150))

      const has = await cacheManager.has('key1')
      expect(has).toBe(false)
    })
  })

  describe('Delete', () => {
    test('should delete existing key', async () => {
      await cacheManager.set('key1', 'value1', 60000)
      await cacheManager.delete('key1')

      const value = await cacheManager.get('key1')
      expect(value).toBeNull()
    })

    test('should handle deleting non-existent key', async () => {
      await expect(cacheManager.delete('non-existent')).resolves.not.toThrow()
    })

    test('should delete multiple keys', async () => {
      await cacheManager.set('key1', 'value1', 60000)
      await cacheManager.set('key2', 'value2', 60000)

      await cacheManager.delete('key1')
      await cacheManager.delete('key2')

      const value1 = await cacheManager.get('key1')
      const value2 = await cacheManager.get('key2')

      expect(value1).toBeNull()
      expect(value2).toBeNull()
    })
  })

  describe('Clear', () => {
    test('should clear all cache entries', async () => {
      await cacheManager.set('key1', 'value1', 60000)
      await cacheManager.set('key2', 'value2', 60000)
      await cacheManager.set('key3', 'value3', 60000)

      await cacheManager.clear()

      const size = await cacheManager.size()
      expect(size).toBe(0)
    })

    test('should handle clearing empty cache', async () => {
      await expect(cacheManager.clear()).resolves.not.toThrow()
    })
  })

  describe('Prune', () => {
    test('should remove expired entries', async () => {
      await cacheManager.set('key1', 'value1', 100) // Will expire
      await cacheManager.set('key2', 'value2', 60000) // Won't expire

      await new Promise((resolve) => setTimeout(resolve, 150))

      const removed = await cacheManager.prune()

      expect(removed).toBe(1)

      const size = await cacheManager.size()
      expect(size).toBe(1)

      const value2 = await cacheManager.get('key2')
      expect(value2).toBe('value2')
    })

    test('should return 0 when no entries to prune', async () => {
      await cacheManager.set('key1', 'value1', 60000)

      const removed = await cacheManager.prune()
      expect(removed).toBe(0)
    })

    test('should handle pruning empty cache', async () => {
      const removed = await cacheManager.prune()
      expect(removed).toBe(0)
    })

    test('should prune multiple expired entries', async () => {
      await cacheManager.set('key1', 'value1', 100)
      await cacheManager.set('key2', 'value2', 100)
      await cacheManager.set('key3', 'value3', 100)
      await cacheManager.set('key4', 'value4', 60000)

      await new Promise((resolve) => setTimeout(resolve, 150))

      const removed = await cacheManager.prune()
      expect(removed).toBe(3)

      const size = await cacheManager.size()
      expect(size).toBe(1)
    })
  })

  describe('Size', () => {
    test('should return correct cache size', async () => {
      expect(await cacheManager.size()).toBe(0)

      await cacheManager.set('key1', 'value1', 60000)
      expect(await cacheManager.size()).toBe(1)

      await cacheManager.set('key2', 'value2', 60000)
      expect(await cacheManager.size()).toBe(2)

      await cacheManager.delete('key1')
      expect(await cacheManager.size()).toBe(1)
    })
  })

  describe('Keys', () => {
    test('should return all cache keys', async () => {
      await cacheManager.set('key1', 'value1', 60000)
      await cacheManager.set('key2', 'value2', 60000)
      await cacheManager.set('key3', 'value3', 60000)

      const keys = await cacheManager.keys()
      expect(keys).toHaveLength(3)
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toContain('key3')
    })

    test('should return empty array for empty cache', async () => {
      const keys = await cacheManager.keys()
      expect(keys).toEqual([])
    })

    test('should not include expired keys', async () => {
      await cacheManager.set('key1', 'value1', 100)
      await cacheManager.set('key2', 'value2', 60000)

      await new Promise((resolve) => setTimeout(resolve, 150))

      const keys = await cacheManager.keys()
      expect(keys).toHaveLength(1)
      expect(keys).toContain('key2')
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid key types gracefully', async () => {
      await expect(
        cacheManager.set(null as any, 'value', 60000)
      ).rejects.toThrow()
    })

    test('should handle invalid TTL values', async () => {
      await expect(
        cacheManager.set('key1', 'value', NaN)
      ).rejects.toThrow()
    })
  })
})
