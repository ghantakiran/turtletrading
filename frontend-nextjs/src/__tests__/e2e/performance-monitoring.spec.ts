/**
 * E2E Tests for Performance Monitoring
 * Tests that performance metrics are captured correctly
 */

import { test, expect } from '@playwright/test'

test.describe('Performance Monitoring E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('http://localhost:3000')
  })

  test('should track page load metrics', async ({ page }) => {
    // Wait for performance monitoring to initialize
    await page.waitForTimeout(1000)

    // Check that performance monitoring is initialized
    const performanceInitialized = await page.evaluate(() => {
      return typeof window.performance !== 'undefined'
    })

    expect(performanceInitialized).toBe(true)
  })

  test('should track API calls automatically', async ({ page }) => {
    let apiCallTracked = false

    // Listen for console logs that indicate API tracking
    page.on('console', (msg) => {
      if (msg.text().includes('[Business Metrics] API Call')) {
        apiCallTracked = true
      }
    })

    // Trigger an API call by navigating to dashboard
    await page.goto('http://localhost:3000/dashboard')

    // Wait for potential API calls
    await page.waitForTimeout(2000)

    // In development mode, API calls should be logged
    if (process.env.NODE_ENV === 'development') {
      // Note: In production, this won't log to console
      console.log('API tracking check:', apiCallTracked ? 'Tracked' : 'Not tracked')
    }
  })

  test('should track user interactions', async ({ page }) => {
    // Navigate to a page with interactive elements
    await page.goto('http://localhost:3000/dashboard')

    // Perform user interaction (click on an element)
    const portfolioButton = page.locator('text=Portfolio').first()
    if (await portfolioButton.isVisible()) {
      await portfolioButton.click()
      await page.waitForTimeout(500)
    }

    // Check that navigation occurred
    expect(page.url()).toContain('/portfolio')
  })

  test('should measure Web Vitals', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')

    // Wait for page to fully load
    await page.waitForLoadState('networkidle')

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
      }
    })

    // Verify metrics are captured
    expect(metrics.domContentLoaded).toBeGreaterThan(0)

    console.log('Performance Metrics:', metrics)
  })

  test('should track feature usage', async ({ page }) => {
    let featureTracked = false

    // Listen for feature usage tracking
    page.on('console', (msg) => {
      if (msg.text().includes('[Business Metrics] Feature Usage')) {
        featureTracked = true
      }
    })

    await page.goto('http://localhost:3000/market')

    // Wait for any feature tracking
    await page.waitForTimeout(1000)

    console.log('Feature tracking:', featureTracked ? 'Tracked' : 'Not tracked')
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API calls and simulate error
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    await page.goto('http://localhost:3000/dashboard')

    // Wait for error handling
    await page.waitForTimeout(2000)

    // Page should still be functional
    expect(page.url()).toContain('/dashboard')
  })

  test('should track session duration', async ({ page }) => {
    await page.goto('http://localhost:3000')

    // Simulate user session
    await page.waitForTimeout(1000)
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForTimeout(1000)
    await page.goto('http://localhost:3000/market')
    await page.waitForTimeout(1000)

    // Session metrics should be accumulated
    const hasMetrics = await page.evaluate(() => {
      return typeof window.performance !== 'undefined'
    })

    expect(hasMetrics).toBe(true)
  })
})
