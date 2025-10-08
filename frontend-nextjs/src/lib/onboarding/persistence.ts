/**
 * Onboarding Progress Persistence Utilities
 * Manages localStorage persistence for onboarding step completion
 */

const STORAGE_KEY = 'onboarding_progress'

/**
 * Saves completed steps to localStorage
 */
export function saveOnboardingProgress(completedSteps: Set<number>): void {
  try {
    const array = Array.from(completedSteps)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(array))
  } catch (error) {
    console.error('Failed to save onboarding progress:', error)
  }
}

/**
 * Loads completed steps from localStorage
 */
export function loadOnboardingProgress(): Set<number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return new Set<number>()
    }

    const array = JSON.parse(saved) as number[]
    return new Set(array)
  } catch (error) {
    console.error('Failed to load onboarding progress:', error)
    return new Set<number>()
  }
}

/**
 * Clears onboarding progress from localStorage
 */
export function resetOnboardingProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to reset onboarding progress:', error)
  }
}

/**
 * Calculates progress percentage
 */
export function getProgressPercentage(completedSteps: Set<number>, totalSteps: number): number {
  if (totalSteps === 0) {
    return 0
  }
  return Math.round((completedSteps.size / totalSteps) * 100)
}

/**
 * Checks if onboarding is complete
 */
export function isOnboardingComplete(completedSteps: Set<number>, totalSteps: number): boolean {
  return completedSteps.size === totalSteps
}
