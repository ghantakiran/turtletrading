/**
 * E2E Tests for Testing Dashboard
 * Tests dashboard UI with real deployment
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'https://turtletrading.vercel.app'

test.describe('Testing Dashboard Page', () => {
  test('should navigate to testing dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await expect(page.locator('h1', { hasText: /Testing Dashboard/i })).toBeVisible()
  })

  test('should display test results overview', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for data to load
    await page.waitForSelector('h2:has-text("Test Results")', { timeout: 10000 })

    // Check for test counts
    expect(await page.locator('text=/Total Tests/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/Passing/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/Failing/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/Coverage/i').count()).toBeGreaterThan(0)
  })

  test('should display coverage chart', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for coverage chart
    await page.waitForSelector('h2:has-text("Code Coverage")', { timeout: 10000 })

    // Check for coverage metrics
    expect(await page.locator('text=/Statements/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/Branches/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/Functions/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/Lines/i').count()).toBeGreaterThan(0)

    // Check for progress bars
    const progressBars = await page.locator('[role="progressbar"]').count()
    expect(progressBars).toBeGreaterThanOrEqual(4)
  })

  test('should display health status panel', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for health status
    await page.waitForSelector('h2:has-text("System Health")', { timeout: 10000 })

    // Check for service status
    expect(await page.locator('text=/Database/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/Cache/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/API/i').count()).toBeGreaterThan(0)
  })

  test('should display system metrics', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for system metrics
    await page.waitForSelector('h2:has-text("System Metrics")', { timeout: 10000 })

    // Check for metrics
    expect(await page.locator('text=/Uptime/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/Memory/i').count()).toBeGreaterThan(0)
    expect(await page.locator('text=/CPU/i').count()).toBeGreaterThan(0)
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Check that content is visible
    const heading = page.locator('h1', { hasText: /Testing Dashboard/i })
    await expect(heading).toBeVisible()
  })

  test('should have proper dark mode support', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Check for dark mode classes
    const body = page.locator('body')
    const hasDarkModeClasses = await body.evaluate((el) => {
      return el.querySelector('.dark\\:bg-gray-900, .dark\\:bg-gray-800, .dark\\:text-white') !== null
    })

    expect(hasDarkModeClasses).toBeTruthy()
  })

  test('should handle loading state gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // During initial load, check for loading or content
    const hasLoadingOrContent = await page.evaluate(() => {
      return (
        document.body.textContent?.includes('Loading') ||
        document.body.textContent?.includes('Test Results') ||
        document.body.textContent?.includes('Testing Dashboard')
      )
    })

    expect(hasLoadingOrContent).toBeTruthy()
  })
})

test.describe('Testing Dashboard Performance', () => {
  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto(`${BASE_URL}/testing`)
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const loadTime = Date.now() - startTime

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000)
  })
})
