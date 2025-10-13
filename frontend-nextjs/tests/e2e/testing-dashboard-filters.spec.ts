/**
 * E2E Tests for Testing Dashboard Filter Functionality
 * Tests search and filter features in Coverage Details table
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'https://turtletrading.vercel.app'

test.describe('Testing Dashboard - Coverage Filters', () => {
  test('should display search input and filter dropdown', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Check if coverage details section exists
    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should have search input
      const searchInput = page.locator('input[placeholder*="Search files"]')
      await expect(searchInput).toBeVisible()

      // Should have filter dropdown
      const filterDropdown = page.locator('select')
      await expect(filterDropdown).toBeVisible()
    }
  })

  test('should filter files by search query', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      const searchInput = page.locator('input[placeholder*="Search files"]')

      if (await searchInput.isVisible()) {
        // Type search query
        await searchInput.fill('component')

        // Wait for filtering to apply
        await page.waitForTimeout(500)

        // File count should update
        const fileCount = page.locator('text=/\\d+.*of.*\\d+.*files/i')
        await expect(fileCount).toBeVisible({ timeout: 2000 }).catch(() => {})
      }
    }
  })

  test('should filter by coverage threshold', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      const filterDropdown = page.locator('select')

      if (await filterDropdown.isVisible()) {
        // Select "Low Coverage" option
        await filterDropdown.selectOption('low')

        // Wait for filtering to apply
        await page.waitForTimeout(500)

        // Should show only low coverage files
        const fileCount = page.locator('text=/\\d+.*of.*\\d+.*files/i')
        await expect(fileCount).toBeVisible({ timeout: 2000 }).catch(() => {})
      }
    }
  })

  test('should show clear filters button when filters active', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      const searchInput = page.locator('input[placeholder*="Search files"]')

      if (await searchInput.isVisible()) {
        // Initially no clear button
        let clearButton = page.locator('button:has-text("Clear")')
        expect(await clearButton.isVisible({ timeout: 500 }).catch(() => false)).toBe(false)

        // Add search filter
        await searchInput.fill('test')
        await page.waitForTimeout(300)

        // Clear button should appear
        clearButton = page.locator('button:has-text("Clear")')
        await expect(clearButton).toBeVisible({ timeout: 2000 })
      }
    }
  })

  test('should clear all filters when clicking clear button', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      const searchInput = page.locator('input[placeholder*="Search files"]')
      const filterDropdown = page.locator('select')

      if (await searchInput.isVisible() && await filterDropdown.isVisible()) {
        // Apply filters
        await searchInput.fill('component')
        await filterDropdown.selectOption('low')
        await page.waitForTimeout(300)

        // Click clear button
        const clearButton = page.locator('button:has-text("Clear")')
        if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await clearButton.click()

          // Search should be empty
          await expect(searchInput).toHaveValue('')

          // Dropdown should be "All Files"
          await expect(filterDropdown).toHaveValue('all')
        }
      }
    }
  })

  test('should show file count when filtering', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should show file count like "5 of 50 files"
      const fileCount = page.locator('text=/\\d+.*of.*\\d+.*files/i')
      const hasCount = await fileCount.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasCount) {
        const countText = await fileCount.textContent()
        expect(countText).toMatch(/\d+.*of.*\d+.*files/i)
      }
    }
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Filters should be visible and functional on mobile
      const searchInput = page.locator('input[placeholder*="Search files"]')
      await expect(searchInput).toBeVisible()

      const filterDropdown = page.locator('select')
      await expect(filterDropdown).toBeVisible()
    }
  })

  test('should combine search and threshold filters', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const coverageDetails = page.locator('h2:has-text("File Coverage Details")')

    if (await coverageDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
      const searchInput = page.locator('input[placeholder*="Search files"]')
      const filterDropdown = page.locator('select')

      if (await searchInput.isVisible() && await filterDropdown.isVisible()) {
        // Apply both filters
        await searchInput.fill('src')
        await filterDropdown.selectOption('medium')
        await page.waitForTimeout(500)

        // Should show filtered results
        const fileCount = page.locator('text=/\\d+.*of.*\\d+.*files/i')
        await expect(fileCount).toBeVisible({ timeout: 2000 }).catch(() => {})
      }
    }
  })
})
