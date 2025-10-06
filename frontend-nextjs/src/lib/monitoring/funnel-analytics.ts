/**
 * Funnel Analytics
 * Track conversion funnels and user flow optimization
 */

import * as Sentry from '@sentry/nextjs'

interface FunnelStep {
  step: string
  name: string
  path: string
}

interface FunnelDefinition {
  id: string
  steps: FunnelStep[]
  currentStep?: string
  stepsCompleted: string[]
  isCompleted: boolean
  startTime: number
  stepTimes: Record<string, number>
}

interface ConversionMetrics {
  conversionRate: number
  dropOffRate: number
  dropOffStep?: string
  progressPercentage: number
  totalTime: number
  avgTimePerStep: number
  isCompleted: boolean
}

class FunnelAnalyticsSystem {
  private funnels: Map<string, FunnelDefinition> = new Map()
  private activeFunnels: Map<string, FunnelDefinition> = new Map()

  /**
   * Define a new conversion funnel
   */
  defineFunnel(id: string, steps: FunnelStep[]): FunnelDefinition {
    const funnel: FunnelDefinition = {
      id,
      steps,
      stepsCompleted: [],
      isCompleted: false,
      startTime: 0,
      stepTimes: {},
    }

    this.funnels.set(id, funnel)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Funnel Analytics] Defined funnel: ${id}`, steps)
    }

    return funnel
  }

  /**
   * Track a funnel step
   */
  trackStep(funnelId: string, step: string) {
    const funnelDef = this.funnels.get(funnelId)
    if (!funnelDef) {
      console.warn(`[Funnel Analytics] Funnel not found: ${funnelId}`)
      return
    }

    // Get or create active funnel instance
    let activeFunnel = this.activeFunnels.get(funnelId)
    if (!activeFunnel) {
      activeFunnel = {
        ...funnelDef,
        startTime: Date.now(),
        stepsCompleted: [],
        stepTimes: {},
      }
      this.activeFunnels.set(funnelId, activeFunnel)
    }

    // Record step completion time
    const currentTime = Date.now()
    activeFunnel.stepTimes[step] = currentTime

    // Update current step
    if (activeFunnel.currentStep) {
      const previousStepTime = activeFunnel.stepTimes[activeFunnel.currentStep]
      const timeOnPreviousStep = currentTime - previousStepTime

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Funnel Analytics] Time on ${activeFunnel.currentStep}:`, timeOnPreviousStep)
      }
    }

    activeFunnel.currentStep = step

    // Add to completed steps if not already there
    if (!activeFunnel.stepsCompleted.includes(step)) {
      activeFunnel.stepsCompleted.push(step)
    }

    // Check if funnel is completed
    const allStepsCompleted = funnelDef.steps.every(s =>
      activeFunnel!.stepsCompleted.includes(s.step)
    )
    activeFunnel.isCompleted = allStepsCompleted

    // Send breadcrumb
    Sentry.addBreadcrumb({
      category: 'funnel',
      message: `Funnel step: ${funnelId} - ${step}`,
      level: 'info',
      data: {
        funnelId,
        step,
        isCompleted: activeFunnel.isCompleted,
        progress: `${activeFunnel.stepsCompleted.length}/${funnelDef.steps.length}`,
      },
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Funnel Analytics] ${funnelId}: ${step}`, {
        progress: `${activeFunnel.stepsCompleted.length}/${funnelDef.steps.length}`,
        isCompleted: activeFunnel.isCompleted,
      })
    }
  }

  /**
   * Get funnel state
   */
  getFunnel(funnelId: string): FunnelDefinition | undefined {
    return this.activeFunnels.get(funnelId)
  }

  /**
   * Get all defined funnels
   */
  getAllFunnels(): FunnelDefinition[] {
    return Array.from(this.funnels.values())
  }

  /**
   * Calculate conversion metrics
   */
  getConversionMetrics(funnelId: string): ConversionMetrics {
    const funnelDef = this.funnels.get(funnelId)
    const activeFunnel = this.activeFunnels.get(funnelId)

    if (!funnelDef || !activeFunnel) {
      return {
        conversionRate: 0,
        dropOffRate: 0,
        progressPercentage: 0,
        totalTime: 0,
        avgTimePerStep: 0,
        isCompleted: false,
      }
    }

    const totalSteps = funnelDef.steps.length
    const completedSteps = activeFunnel.stepsCompleted.length
    const progressPercentage = (completedSteps / totalSteps) * 100

    const conversionRate = activeFunnel.isCompleted ? 100 : 0
    const dropOffRate = activeFunnel.isCompleted ? 0 : 100 - progressPercentage

    // Find drop-off step (last incomplete step)
    let dropOffStep: string | undefined
    if (!activeFunnel.isCompleted && activeFunnel.currentStep) {
      dropOffStep = activeFunnel.currentStep
    }

    // Calculate time metrics
    const currentTime = Date.now()
    const totalTime = activeFunnel.startTime > 0 ? currentTime - activeFunnel.startTime : 0

    const stepTimes = Object.values(activeFunnel.stepTimes)
    const avgTimePerStep = stepTimes.length > 1
      ? (stepTimes[stepTimes.length - 1] - stepTimes[0]) / (stepTimes.length - 1)
      : 0

    return {
      conversionRate,
      dropOffRate,
      dropOffStep,
      progressPercentage,
      totalTime,
      avgTimePerStep,
      isCompleted: activeFunnel.isCompleted,
    }
  }

  /**
   * Export funnel data
   */
  exportFunnelData(funnelId: string) {
    const funnelDef = this.funnels.get(funnelId)
    const activeFunnel = this.activeFunnels.get(funnelId)
    const metrics = this.getConversionMetrics(funnelId)

    return {
      funnelId,
      steps: funnelDef?.steps || [],
      currentStep: activeFunnel?.currentStep,
      stepsCompleted: activeFunnel?.stepsCompleted || [],
      metrics,
    }
  }

  /**
   * Send funnel data to Sentry
   */
  sendToSentry(funnelId: string) {
    const data = this.exportFunnelData(funnelId)

    Sentry.setContext('funnel_analytics', {
      funnelId: data.funnelId,
      currentStep: data.currentStep,
      stepsCompleted: data.stepsCompleted,
      conversionRate: data.metrics.conversionRate,
      progressPercentage: data.metrics.progressPercentage,
      isCompleted: data.metrics.isCompleted,
    })

    if (data.metrics.isCompleted) {
      Sentry.setMeasurement('funnel.completion.time', data.metrics.totalTime, 'millisecond')
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Funnel Analytics] Sent to Sentry:', data)
    }
  }

  /**
   * Reset all funnels (for testing)
   */
  reset() {
    this.funnels.clear()
    this.activeFunnels.clear()
  }
}

// Export singleton instance
export const FunnelAnalytics = new FunnelAnalyticsSystem()
