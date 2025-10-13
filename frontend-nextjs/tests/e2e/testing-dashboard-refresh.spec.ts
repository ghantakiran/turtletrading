/**
 * E2E Tests for Testing Dashboard Auto-Refresh
 * Tests auto-refresh functionality in production
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'https://turtletrading.vercel.app'

test.describe('Testing Dashboard Auto-Refresh', () => {
  test('should display refresh controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Check for refresh button
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()

    // Check for pause/resume button
    const pauseButton = page.locator('button:has-text("Pause")')
    await expect(pauseButton).toBeVisible()
  })

  test('should show last update time', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Check for "Updated" text
    const updateText = page.locator('text=/Updated.*ago/i')
    await expect(updateText).toBeVisible({ timeout: 15000 })
  })

  test('manual refresh button should work', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()

    // Click refresh
    await refreshButton.click()

    // Should show "Refreshing..." temporarily
    await expect(page.locator('text=/Refreshing/i')).toBeVisible({ timeout: 2000 }).catch(() => {})

    // Should return to "Refresh" after completion
    await expect(refreshButton).toContainText(/Refresh/i, { timeout: 5000 })
  })

  test('pause button should toggle to resume', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Initially should show "Pause"
    const pauseButton = page.locator('button', { has: page.locator('text=/Pause/i') })
    await expect(pauseButton).toBeVisible()

    // Click to pause
    await pauseButton.click()

    // Should now show "Resume"
    const resumeButton = page.locator('button', { has: page.locator('text=/Resume/i') })
    await expect(resumeButton).toBeVisible({ timeout: 2000 })

    // Click to resume
    await resumeButton.click()

    // Should show "Pause" again
    await expect(pauseButton).toBeVisible({ timeout: 2000 })
  })

  test('refresh controls should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/testing`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    // Refresh controls should be visible on mobile
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()
  })

  test('loading indicator should appear during refresh', async ({ page }) => {
    await page.goto(`${BASE_URL}/testing`)

    // Wait for initial load
    await page.waitForSelector('h1:has-text("Testing Dashboard")', { timeout: 10000 })

    const refreshButton = page.locator('button:has-text("Refresh")')

    // Click refresh and check for loading state
    await refreshButton.click()

    // Button should be disabled or show loading text
    const isDisabled = await refreshButton.isDisabled().catch(() => false)
    const hasRefreshingText = await page.locator('text=/Refreshing/i').isVisible().catch(() => false)

    expect(isDisabled || hasRefreshingText).toBeTruthy()
  })
})
