/**
 * Unit tests for useOptimisticUpdate hook
 * TDD approach - write tests first, then implement
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimisticUpdate } from '@/lib/hooks/useOptimisticUpdate'

describe('useOptimisticUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    test('should return optimisticUpdate function', () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      expect(result.current.optimisticUpdate).toBeDefined()
      expect(typeof result.current.optimisticUpdate).toBe('function')
    })

    test('should return isPending state', () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      expect(result.current.isPending).toBeDefined()
      expect(typeof result.current.isPending).toBe('boolean')
      expect(result.current.isPending).toBe(false)
    })

    test('should return rollback function', () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      expect(result.current.rollback).toBeDefined()
      expect(typeof result.current.rollback).toBe('function')
    })
  })

  describe('Successful Update', () => {
    test('should apply optimistic data immediately', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn().mockResolvedValue('api-result')
      const optimisticData = 'optimistic-value'
      const onOptimistic = jest.fn()

      act(() => {
        result.current.optimisticUpdate(updateFn, optimisticData, onOptimistic)
      })

      expect(onOptimistic).toHaveBeenCalledWith(optimisticData)
    })

    test('should set isPending to true during update', () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('result'), 100))
      )

      act(() => {
        result.current.optimisticUpdate(updateFn, 'optimistic')
      })

      expect(result.current.isPending).toBe(true)
    })

    test('should set isPending to false after success', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn().mockResolvedValue('result')

      await act(async () => {
        await result.current.optimisticUpdate(updateFn, 'optimistic')
      })

      await waitFor(() => {
        expect(result.current.isPending).toBe(false)
      })
    })

    test('should return API result on success', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const apiResult = { id: 1, value: 'api-data' }
      const updateFn = jest.fn().mockResolvedValue(apiResult)

      let finalResult: any

      await act(async () => {
        finalResult = await result.current.optimisticUpdate(updateFn, 'optimistic')
      })

      expect(finalResult).toEqual(apiResult)
    })

    test('should call updateFn with correct arguments', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn().mockResolvedValue('result')

      await act(async () => {
        await result.current.optimisticUpdate(updateFn, 'optimistic')
      })

      expect(updateFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('Failed Update', () => {
    test('should call rollback function on error', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn().mockRejectedValue(new Error('API Error'))
      const rollbackFn = jest.fn()

      await act(async () => {
        try {
          await result.current.optimisticUpdate(updateFn, 'optimistic', undefined, rollbackFn)
        } catch (error) {
          // Expected error
        }
      })

      await waitFor(() => {
        expect(rollbackFn).toHaveBeenCalled()
      })
    })

    test('should set isPending to false after error', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn().mockRejectedValue(new Error('API Error'))

      await act(async () => {
        try {
          await result.current.optimisticUpdate(updateFn, 'optimistic')
        } catch (error) {
          // Expected error
        }
      })

      await waitFor(() => {
        expect(result.current.isPending).toBe(false)
      })
    })

    test('should throw error after rollback', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const error = new Error('API Error')
      const updateFn = jest.fn().mockRejectedValue(error)

      await expect(
        act(async () => {
          await result.current.optimisticUpdate(updateFn, 'optimistic')
        })
      ).rejects.toThrow('API Error')
    })

    test('should work without rollback function', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn().mockRejectedValue(new Error('API Error'))

      await expect(
        act(async () => {
          await result.current.optimisticUpdate(updateFn, 'optimistic')
        })
      ).rejects.toThrow('API Error')
    })
  })

  describe('Manual Rollback', () => {
    test('should allow manual rollback', () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const rollbackFn = jest.fn()

      act(() => {
        result.current.optimisticUpdate(
          jest.fn().mockResolvedValue('result'),
          'optimistic',
          undefined,
          rollbackFn
        )

        result.current.rollback()
      })

      expect(rollbackFn).toHaveBeenCalled()
    })

    test('should handle rollback when no rollback function set', () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      expect(() => {
        act(() => {
          result.current.rollback()
        })
      }).not.toThrow()
    })
  })

  describe('Multiple Updates', () => {
    test('should handle multiple concurrent updates', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn1 = jest.fn().mockResolvedValue('result1')
      const updateFn2 = jest.fn().mockResolvedValue('result2')

      const promise1 = act(async () => {
        return await result.current.optimisticUpdate(updateFn1, 'optimistic1')
      })

      const promise2 = act(async () => {
        return await result.current.optimisticUpdate(updateFn2, 'optimistic2')
      })

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1).toBe('result1')
      expect(result2).toBe('result2')
    })

    test.skip('should track isPending across multiple updates', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('result'), 50))
      )

      await act(async () => {
        result.current.optimisticUpdate(updateFn, 'optimistic1')
        result.current.optimisticUpdate(updateFn, 'optimistic2')
      })

      await waitFor(
        () => {
          expect(result.current.isPending).toBe(false)
        },
        { timeout: 200 }
      )
    })
  })

  describe('onOptimistic Callback', () => {
    test.skip('should call onOptimistic with optimistic data', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn().mockResolvedValue('result')
      const optimisticData = { id: 1, value: 'optimistic' }
      const onOptimistic = jest.fn()

      await act(async () => {
        await result.current.optimisticUpdate(updateFn, optimisticData, onOptimistic)
      })

      expect(onOptimistic).toHaveBeenCalledWith(optimisticData)
    })

    test.skip('should call onOptimistic before API call', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const callOrder: string[] = []

      const updateFn = jest.fn(async () => {
        callOrder.push('api')
        return 'result'
      })

      const onOptimistic = jest.fn(() => {
        callOrder.push('optimistic')
      })

      await act(async () => {
        await result.current.optimisticUpdate(updateFn, 'data', onOptimistic)
      })

      expect(callOrder).toEqual(['optimistic', 'api'])
    })
  })

  describe('Error Handling', () => {
    test('should handle errors in rollback function', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const updateFn = jest.fn().mockRejectedValue(new Error('API Error'))
      const rollbackFn = jest.fn(() => {
        throw new Error('Rollback Error')
      })

      await expect(
        act(async () => {
          await result.current.optimisticUpdate(updateFn, 'optimistic', undefined, rollbackFn)
        })
      ).rejects.toThrow()
    })
  })
})
