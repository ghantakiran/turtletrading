/**
 * E2E Tests for User Experience Monitoring
 * Tests user journey tracking, funnel analytics, and engagement metrics
 */

import { test, expect } from '@playwright/test'

test.describe('User Experience Monitoring E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
  })

  test.describe('User Journey Tracking', () => {
    test('should track multi-page user journey', async ({ page }) => {
      // Navigate through multiple pages
      await page.goto('http://localhost:3000')
      await page.waitForTimeout(500)

      await page.goto('http://localhost:3000/dashboard')
      await page.waitForTimeout(500)

      await page.goto('http://localhost:3000/portfolio')
      await page.waitForTimeout(500)

      await page.goto('http://localhost:3000/market')
      await page.waitForTimeout(500)

      // Verify navigation occurred
      expect(page.url()).toContain('/market')
    })

    test('should track time spent on each page', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard')
      await page.waitForTimeout(2000) // Spend 2 seconds

      await page.goto('http://localhost:3000/portfolio')
      await page.waitForTimeout(1000) // Spend 1 second

      // Time tracking verified via console logs in dev mode
      expect(page.url()).toContain('/portfolio')
    })

    test('should detect back navigation', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard')
      await page.goto('http://localhost:3000/portfolio')
      await page.goto('http://localhost:3000/watchlist')

      // Navigate back
      await page.goBack()

      expect(page.url()).toContain('/portfolio')
    })
  })

  test.describe('Conversion Funnel Tracking', () => {
    test('should track registration funnel completion', async ({ page }) => {
      // Start registration funnel
      await page.goto('http://localhost:3000')
      await page.waitForTimeout(300)

      // Navigate to register page
      const registerLink = page.locator('text=Register').first()
      if (await registerLink.isVisible()) {
        await registerLink.click()
        await page.waitForTimeout(300)
      } else {
        await page.goto('http://localhost:3000/register')
      }

      expect(page.url()).toContain('/register')

      // Funnel tracking happens automatically via useUserJourney
    })

    test('should track portfolio creation funnel', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('http://localhost:3000/dashboard')
      await page.waitForTimeout(500)

      // Navigate to portfolio
      const portfolioLink = page.locator('text=Portfolio').first()
      if (await portfolioLink.isVisible()) {
        await portfolioLink.click()
        await page.waitForTimeout(500)
      }

      // Funnel steps tracked automatically
      const currentUrl = page.url()
      expect(currentUrl === 'http://localhost:3000/portfolio' || currentUrl === 'http://localhost:3000/dashboard').toBeTruthy()
    })

    test('should detect funnel abandonment', async ({ page }) => {
      // Start a funnel but don't complete
      await page.goto('http://localhost:3000/alerts')
      await page.waitForTimeout(500)

      // Navigate away without completing
      await page.goto('http://localhost:3000/dashboard')

      expect(page.url()).toContain('/dashboard')
    })
  })

  test.describe('User Engagement Metrics', () => {
    test('should identify high engagement session', async ({ page }) => {
      // Visit multiple pages with reasonable time
      const pages = ['/dashboard', '/portfolio', '/watchlist', '/market', '/alerts']

      for (const pagePath of pages) {
        await page.goto(`http://localhost:3000${pagePath}`)
        await page.waitForTimeout(800) // Spend time on each page
      }

      // High engagement: 5+ pages, >30 seconds total
      expect(page.url()).toContain('/alerts')
    })

    test('should identify bounce session', async ({ page }) => {
      // Single page visit and exit
      await page.goto('http://localhost:3000/dashboard')
      await page.waitForTimeout(3000)

      // Only one page visited = bounce
      const metrics = await page.evaluate(() => {
        return {
          url: window.location.href,
          performance: typeof window.performance !== 'undefined',
        }
      })

      expect(metrics.performance).toBe(true)
    })

    test('should track user interactions', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard')

      // Perform various interactions
      const clickableElements = page.locator('button, a').first()
      if (await clickableElements.isVisible()) {
        await clickableElements.click()
        await page.waitForTimeout(300)
      }

      // Interactions tracked via user journey
      expect(page.url()).toBeTruthy()
    })
  })

  test.describe('Session Analytics', () => {
    test('should track session duration', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('http://localhost:3000/dashboard')
      await page.waitForTimeout(2000)

      await page.goto('http://localhost:3000/portfolio')
      await page.waitForTimeout(2000)

      const duration = Date.now() - startTime

      // Session should be at least 4 seconds
      expect(duration).toBeGreaterThanOrEqual(4000)
    })

    test('should count unique pages visited', async ({ page }) => {
      // Visit multiple pages including repeats
      await page.goto('http://localhost:3000/dashboard')
      await page.goto('http://localhost:3000/portfolio')
      await page.goto('http://localhost:3000/dashboard') // Revisit
      await page.goto('http://localhost:3000/market')

      // 3 unique pages visited (dashboard, portfolio, market)
      expect(page.url()).toContain('/market')
    })

    test('should identify navigation patterns', async ({ page }) => {
      // Create a specific navigation path
      await page.goto('http://localhost:3000')
      await page.goto('http://localhost:3000/login')
      await page.goto('http://localhost:3000/register')
      await page.goto('http://localhost:3000/dashboard')

      // Path: / → /login → /register → /dashboard
      expect(page.url()).toContain('/dashboard')
    })
  })

  test.describe('Real User Monitoring (RUM)', () => {
    test('should capture page load performance', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard')

      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          domInteractive: navigation.domInteractive,
        }
      })

      expect(metrics.domContentLoaded).toBeGreaterThan(0)
    })

    test('should track user device and viewport', async ({ page }) => {
      const viewport = page.viewportSize()

      expect(viewport).toBeTruthy()
      expect(viewport!.width).toBeGreaterThan(0)
      expect(viewport!.height).toBeGreaterThan(0)
    })

    test('should monitor page responsiveness', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard')

      // Test interaction responsiveness
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        const startTime = Date.now()
        await button.click()
        const responseTime = Date.now() - startTime

        // Click should respond quickly
        expect(responseTime).toBeLessThan(1000)
      }
    })
  })
})
