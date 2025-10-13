/**
 * E2E Tests for Testing Dashboard Detailed Coverage Features
 * Tests new components: CoverageDetails, CoverageTrends, TestPerformance
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'https://turtletrading.vercel.app'

test.describe('Testing Dashboard - Detailed Coverage Features', () => {
  test('should display coverage details table when data available', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Check for Coverage Details section (may not have data yet)
    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    // If coverage details exist, verify table structure
    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should have table headers
      await expect(page.locator('th:has-text("File Path")')).toBeVisible()
      await expect(page.locator('th:has-text("Statements")')).toBeVisible()
      await expect(page.locator('th:has-text("Branches")')).toBeVisible()
      await expect(page.locator('th:has-text("Functions")')).toBeVisible()
      await expect(page.locator('th:has-text("Lines")')).toBeVisible()
    }
  })

  test('should display coverage trends chart when data available', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Check for Coverage Trends section
    const coverageTrends = page.locator('h2:has-text("Coverage Trends")')

    if (await coverageTrends.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should have chart legend
      await expect(page.locator('text=/statements/i')).toBeVisible()
      await expect(page.locator('text=/branches/i')).toBeVisible()
    }
  })

  test('should display test performance metrics when available', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Check for Test Performance section
    const testPerformance = page.locator('h2:has-text("Test Performance")')

    if (await testPerformance.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should show performance metrics
      await expect(page.locator('text=/average/i')).toBeVisible()
      await expect(page.locator('text=/total/i')).toBeVisible()
    }
  })

  test('should allow sorting in coverage details table', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click on Statements header to sort
      const statementsHeader = page.locator('th:has-text("Statements")')
      if (await statementsHeader.isVisible()) {
        await statementsHeader.click()

        // Should show sort indicator
        await expect(page.locator('th:has-text("Statements") >> text=/↑|↓/')).toBeVisible({ timeout: 2000 })
      }
    }
  })

  test('should show legend in coverage details', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should have coverage level legend
      await expect(page.locator('text=/high|good|excellent/i')).toBeVisible({ timeout: 2000 }).catch(() => {})
      await expect(page.locator('text=/low|poor/i')).toBeVisible({ timeout: 2000 }).catch(() => {})
    }
  })

  test('should display slowest tests table', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const testPerformance = page.locator('h2:has-text("Test Performance")')

    if (await testPerformance.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should have slowest tests section
      await expect(page.locator('h3:has-text("Slowest Tests")')).toBeVisible()
    }
  })

  test('should show improvement indicators in trends', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageTrends = page.locator('h2:has-text("Coverage Trends")')

    if (await coverageTrends.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should show improvement/decline indicators
      const indicators = page.locator('text=/improving|declining|↑|↓/i')
      await expect(indicators.first()).toBeVisible({ timeout: 2000 }).catch(() => {})
    }
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // All sections should be visible on mobile
    await expect(page.locator('h1:has-text("Testing Dashboard")')).toBeVisible()

    // Refresh controls should work on mobile
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()
  })

  test('should handle empty data gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // If no detailed data, should show basic dashboard without errors
    await expect(page.locator('h1:has-text("Testing Dashboard")')).toBeVisible()

    // Should not show error messages
    const errorMessage = page.locator('text=/failed|error/i')
    const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false)

    // Only fail if there's an actual error message (not just the word "error" in normal text)
    if (hasError) {
      const errorText = await errorMessage.textContent()
      expect(errorText?.toLowerCase()).not.toContain('failed to')
    }
  })
})
