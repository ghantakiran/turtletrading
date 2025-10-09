/**
 * Unit tests for Conflict Resolver
 * TDD approach - write tests first, then implement
 */

import { ConflictResolver, ConflictStrategy } from '@/lib/sync/conflict-resolver'

describe('ConflictResolver', () => {
  let resolver: ConflictResolver

  beforeEach(() => {
    resolver = new ConflictResolver()
  })

  describe('Conflict Detection', () => {
    test('should detect conflict when timestamps differ', () => {
      const local = { id: 1, value: 'local', lastUpdated: 1000 }
      const remote = { id: 1, value: 'remote', lastUpdated: 2000 }

      const hasConflict = resolver.detectConflict(local, remote)
      expect(hasConflict).toBe(true)
    })

    test('should not detect conflict when data is identical', () => {
      const data = { id: 1, value: 'same', lastUpdated: 1000 }

      const hasConflict = resolver.detectConflict(data, data)
      expect(hasConflict).toBe(false)
    })

    test('should detect conflict when values differ', () => {
      const local = { id: 1, value: 'local' }
      const remote = { id: 1, value: 'remote' }

      const hasConflict = resolver.detectConflict(local, remote)
      expect(hasConflict).toBe(true)
    })

    test('should handle null values', () => {
      const local = { id: 1, value: null }
      const remote = { id: 1, value: 'remote' }

      const hasConflict = resolver.detectConflict(local, remote)
      expect(hasConflict).toBe(true)
    })
  })

  describe('Local Wins Strategy', () => {
    test('should return local data', async () => {
      const local = { id: 1, value: 'local' }
      const remote = { id: 1, value: 'remote' }

      const result = await resolver.resolve(local, remote, ConflictStrategy.LOCAL_WINS)
      expect(result).toEqual(local)
    })

    test('should preserve local timestamp', async () => {
      const local = { id: 1, value: 'local', lastUpdated: 1000 }
      const remote = { id: 1, value: 'remote', lastUpdated: 2000 }

      const result = await resolver.resolve(local, remote, ConflictStrategy.LOCAL_WINS)
      expect(result.lastUpdated).toBe(1000)
    })
  })

  describe('Remote Wins Strategy', () => {
    test('should return remote data', async () => {
      const local = { id: 1, value: 'local' }
      const remote = { id: 1, value: 'remote' }

      const result = await resolver.resolve(local, remote, ConflictStrategy.REMOTE_WINS)
      expect(result).toEqual(remote)
    })

    test('should preserve remote timestamp', async () => {
      const local = { id: 1, value: 'local', lastUpdated: 1000 }
      const remote = { id: 1, value: 'remote', lastUpdated: 2000 }

      const result = await resolver.resolve(local, remote, ConflictStrategy.REMOTE_WINS)
      expect(result.lastUpdated).toBe(2000)
    })
  })

  describe('Last Write Wins Strategy', () => {
    test('should return newer data based on timestamp', async () => {
      const local = { id: 1, value: 'local', lastUpdated: 1000 }
      const remote = { id: 1, value: 'remote', lastUpdated: 2000 }

      const result = await resolver.resolve(local, remote, ConflictStrategy.LAST_WRITE_WINS)
      expect(result).toEqual(remote)
    })

    test('should return local when local is newer', async () => {
      const local = { id: 1, value: 'local', lastUpdated: 3000 }
      const remote = { id: 1, value: 'remote', lastUpdated: 2000 }

      const result = await resolver.resolve(local, remote, ConflictStrategy.LAST_WRITE_WINS)
      expect(result).toEqual(local)
    })

    test('should default to remote when timestamps are equal', async () => {
      const local = { id: 1, value: 'local', lastUpdated: 2000 }
      const remote = { id: 1, value: 'remote', lastUpdated: 2000 }

      const result = await resolver.resolve(local, remote, ConflictStrategy.LAST_WRITE_WINS)
      expect(result).toEqual(remote)
    })

    test('should handle missing timestamps', async () => {
      const local = { id: 1, value: 'local' }
      const remote = { id: 1, value: 'remote' }

      const result = await resolver.resolve(local, remote, ConflictStrategy.LAST_WRITE_WINS)
      expect(result).toEqual(remote)
    })
  })

  describe('Merge Strategy', () => {
    test('should merge non-conflicting properties', async () => {
      const local = { id: 1, name: 'local-name', value: 'local' }
      const remote = { id: 1, name: 'local-name', description: 'remote-desc' }

      const result = await resolver.resolve(local, remote, ConflictStrategy.MERGE)
      expect(result.name).toBe('local-name')
      expect(result.description).toBe('remote-desc')
    })

    test('should prefer remote for conflicting properties', async () => {
      const local = { id: 1, value: 'local', lastUpdated: 1000 }
      const remote = { id: 1, value: 'remote', lastUpdated: 2000 }

      const result = await resolver.resolve(local, remote, ConflictStrategy.MERGE)
      expect(result.value).toBe('remote')
    })

    test('should merge nested objects', async () => {
      const local = { id: 1, meta: { author: 'local-author' } }
      const remote = { id: 1, meta: { timestamp: 2000 } }

      const result = await resolver.resolve(local, remote, ConflictStrategy.MERGE)
      expect(result.meta.author).toBe('local-author')
      expect(result.meta.timestamp).toBe(2000)
    })

    test('should merge arrays by concatenating unique values', async () => {
      const local = { id: 1, tags: ['tag1', 'tag2'] }
      const remote = { id: 1, tags: ['tag2', 'tag3'] }

      const result = await resolver.resolve(local, remote, ConflictStrategy.MERGE)
      expect(result.tags).toEqual(expect.arrayContaining(['tag1', 'tag2', 'tag3']))
      expect(result.tags.length).toBe(3)
    })
  })

  describe('Manual Strategy', () => {
    test('should call onConflict callback', async () => {
      const local = { id: 1, value: 'local' }
      const remote = { id: 1, value: 'remote' }
      const manualResolution = { id: 1, value: 'manual' }

      const onConflict = jest.fn().mockResolvedValue(manualResolution)
      resolver.onConflict(onConflict)

      const result = await resolver.resolve(local, remote, ConflictStrategy.MANUAL)
      expect(onConflict).toHaveBeenCalledWith(local, remote)
      expect(result).toEqual(manualResolution)
    })

    test('should throw error when no callback registered', async () => {
      const local = { id: 1, value: 'local' }
      const remote = { id: 1, value: 'remote' }

      await expect(
        resolver.resolve(local, remote, ConflictStrategy.MANUAL)
      ).rejects.toThrow('No manual conflict handler registered')
    })

    test('should support async conflict resolution', async () => {
      const local = { id: 1, value: 'local' }
      const remote = { id: 1, value: 'remote' }
      const manualResolution = { id: 1, value: 'resolved' }

      const onConflict = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return manualResolution
      })

      resolver.onConflict(onConflict)

      const result = await resolver.resolve(local, remote, ConflictStrategy.MANUAL)
      expect(result).toEqual(manualResolution)
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty objects', async () => {
      const local = {}
      const remote = {}

      const result = await resolver.resolve(local, remote, ConflictStrategy.MERGE)
      expect(result).toEqual({})
    })

    test('should handle complex nested structures', async () => {
      const local = {
        id: 1,
        nested: {
          deep: {
            value: 'local',
          },
        },
      }
      const remote = {
        id: 1,
        nested: {
          deep: {
            timestamp: 2000,
          },
        },
      }

      const result = await resolver.resolve(local, remote, ConflictStrategy.MERGE)
      expect(result.nested.deep.value).toBe('local')
      expect(result.nested.deep.timestamp).toBe(2000)
    })

    test('should handle array of objects', async () => {
      const local = { items: [{ id: 1, name: 'item1' }] }
      const remote = { items: [{ id: 2, name: 'item2' }] }

      const result = await resolver.resolve(local, remote, ConflictStrategy.MERGE)
      expect(result.items).toHaveLength(2)
    })
  })

  describe('Conflict Handler Management', () => {
    test('should register conflict handler', () => {
      const handler = jest.fn()
      resolver.onConflict(handler)

      expect(typeof handler).toBe('function')
    })

    test('should remove conflict handler', () => {
      const handler = jest.fn()
      resolver.onConflict(handler)
      resolver.offConflict()

      expect(async () => {
        await resolver.resolve({}, {}, ConflictStrategy.MANUAL)
      }).rejects.toThrow()
    })
  })
})
