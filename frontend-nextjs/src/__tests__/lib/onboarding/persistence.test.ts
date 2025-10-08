/**
 * Unit tests for onboarding persistence utility
 * TDD approach - tests written before implementation
 */

import {
  saveOnboardingProgress,
  loadOnboardingProgress,
  resetOnboardingProgress,
  getProgressPercentage,
  isOnboardingComplete,
} from '@/lib/onboarding/persistence'

describe('saveOnboardingProgress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should save completed steps to localStorage', () => {
    const completedSteps = new Set([1, 2, 3])
    saveOnboardingProgress(completedSteps)

    const saved = localStorage.getItem('onboarding_progress')
    expect(saved).toBeTruthy()
    expect(JSON.parse(saved!)).toEqual([1, 2, 3])
  })

  it('should save empty set as empty array', () => {
    const completedSteps = new Set<number>()
    saveOnboardingProgress(completedSteps)

    const saved = localStorage.getItem('onboarding_progress')
    expect(JSON.parse(saved!)).toEqual([])
  })

  it('should handle all steps completed', () => {
    const completedSteps = new Set([1, 2, 3, 4, 5])
    saveOnboardingProgress(completedSteps)

    const saved = localStorage.getItem('onboarding_progress')
    expect(JSON.parse(saved!)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('loadOnboardingProgress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should load completed steps from localStorage', () => {
    localStorage.setItem('onboarding_progress', JSON.stringify([1, 2, 3]))

    const loaded = loadOnboardingProgress()
    expect(loaded).toBeInstanceOf(Set)
    expect(loaded.size).toBe(3)
    expect(loaded.has(1)).toBe(true)
    expect(loaded.has(2)).toBe(true)
    expect(loaded.has(3)).toBe(true)
  })

  it('should return empty set when no data exists', () => {
    const loaded = loadOnboardingProgress()
    expect(loaded).toBeInstanceOf(Set)
    expect(loaded.size).toBe(0)
  })

  it('should handle corrupted data gracefully', () => {
    localStorage.setItem('onboarding_progress', 'invalid json')

    const loaded = loadOnboardingProgress()
    expect(loaded).toBeInstanceOf(Set)
    expect(loaded.size).toBe(0)
  })

  it('should handle all steps completed', () => {
    localStorage.setItem('onboarding_progress', JSON.stringify([1, 2, 3, 4, 5]))

    const loaded = loadOnboardingProgress()
    expect(loaded.size).toBe(5)
  })
})

describe('resetOnboardingProgress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should clear localStorage', () => {
    localStorage.setItem('onboarding_progress', JSON.stringify([1, 2, 3]))

    resetOnboardingProgress()

    const saved = localStorage.getItem('onboarding_progress')
    expect(saved).toBeNull()
  })

  it('should not error when nothing to reset', () => {
    expect(() => resetOnboardingProgress()).not.toThrow()
  })
})

describe('getProgressPercentage', () => {
  it('should calculate correct percentage', () => {
    const completedSteps = new Set([1, 2])
    const totalSteps = 5

    const percentage = getProgressPercentage(completedSteps, totalSteps)
    expect(percentage).toBe(40)
  })

  it('should return 0 for no completed steps', () => {
    const completedSteps = new Set<number>()
    const totalSteps = 5

    const percentage = getProgressPercentage(completedSteps, totalSteps)
    expect(percentage).toBe(0)
  })

  it('should return 100 for all completed steps', () => {
    const completedSteps = new Set([1, 2, 3, 4, 5])
    const totalSteps = 5

    const percentage = getProgressPercentage(completedSteps, totalSteps)
    expect(percentage).toBe(100)
  })

  it('should round to nearest integer', () => {
    const completedSteps = new Set([1])
    const totalSteps = 3

    const percentage = getProgressPercentage(completedSteps, totalSteps)
    expect(percentage).toBe(33) // 33.333... rounded to 33
  })
})

describe('isOnboardingComplete', () => {
  it('should return true when all steps completed', () => {
    const completedSteps = new Set([1, 2, 3, 4, 5])
    const totalSteps = 5

    const isComplete = isOnboardingComplete(completedSteps, totalSteps)
    expect(isComplete).toBe(true)
  })

  it('should return false when not all steps completed', () => {
    const completedSteps = new Set([1, 2, 3])
    const totalSteps = 5

    const isComplete = isOnboardingComplete(completedSteps, totalSteps)
    expect(isComplete).toBe(false)
  })

  it('should return false when no steps completed', () => {
    const completedSteps = new Set<number>()
    const totalSteps = 5

    const isComplete = isOnboardingComplete(completedSteps, totalSteps)
    expect(isComplete).toBe(false)
  })
})
