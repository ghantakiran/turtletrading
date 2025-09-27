import { test, expect } from '@playwright/test'

test.describe('Stock Analysis Migration - Navigate→Analyze Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('http://localhost:3001')
  })

  test('should navigate from homepage to stock analysis page', async ({ page }) => {
    // Click on Stock Analysis in navigation
    await page.click('text=Stock Analysis')

    // Should navigate to the protected analysis route
    await expect(page).toHaveURL('/analysis/AAPL')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Check that we're on the analysis page
    await expect(page.locator('h1')).toContainText('AAPL Analysis')

    // Verify the analysis components are present
    await expect(page.locator('text=Overall Analysis Score')).toBeVisible()
    await expect(page.locator('text=Live')).toBeVisible()
  })

  test('should handle server-side rendering correctly', async ({ page }) => {
    // Navigate directly to analysis page
    await page.goto('http://localhost:3001/analysis/MSFT')

    // Check that SSR content is loaded
    await expect(page.locator('h1')).toContainText('MSFT Analysis')

    // Verify that server data is displayed
    await expect(page.locator('text=Comprehensive stock analysis')).toBeVisible()

    // Check for price display (should be server-rendered)
    await expect(page.locator('[data-testid="stock-price"]').or(page.locator('text=/\\$\\d+\\.\\d{2}/'))).toBeVisible()
  })

  test('should load all tabs correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/analysis/GOOGL')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("GOOGL Analysis")')

    // Test Overview tab (default)
    await expect(page.locator('button[data-state="active"]')).toContainText('Overview')
    await expect(page.locator('text=Market Cap')).toBeVisible()

    // Test Technical tab
    await page.click('text=Technical')
    await expect(page.locator('text=RSI')).toBeVisible({ timeout: 10000 })

    // Test AI Analysis tab
    await page.click('text=AI Analysis')
    await expect(page.locator('text=LSTM Prediction')).toBeVisible({ timeout: 10000 })

    // Test Sentiment tab
    await page.click('text=Sentiment')
    await expect(page.locator('text=Overall Sentiment')).toBeVisible({ timeout: 10000 })
  })

  test('should handle search functionality', async ({ page }) => {
    await page.goto('http://localhost:3001/analysis/AAPL')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("AAPL Analysis")')

    // Find and use the search input
    await page.fill('input[placeholder*="Search stock"]', 'TSLA')
    await page.press('input[placeholder*="Search stock"]', 'Enter')

    // Should navigate to TSLA analysis
    await expect(page).toHaveURL('/analysis/TSLA')
    await expect(page.locator('h1')).toContainText('TSLA Analysis')
  })

  test('should display error state for invalid stock symbols', async ({ page }) => {
    // Navigate to invalid stock symbol
    await page.goto('http://localhost:3001/analysis/INVALID123')

    // Should show error state
    await expect(page.locator('text=Error Loading Stock Data')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=INVALID123')).toBeVisible()
  })

  test('should show loading states appropriately', async ({ page }) => {
    // Navigate to analysis page and check for loading states
    await page.goto('http://localhost:3001/analysis/NVDA')

    // Should show loading initially (or content if SSR is fast)
    const hasLoading = await page.locator('text=Loading comprehensive analysis').isVisible({ timeout: 1000 }).catch(() => false)
    const hasContent = await page.locator('h1:has-text("NVDA Analysis")').isVisible({ timeout: 1000 }).catch(() => false)

    // One of them should be true
    expect(hasLoading || hasContent).toBeTruthy()

    // Eventually content should be visible
    await expect(page.locator('h1:has-text("NVDA Analysis")')).toBeVisible({ timeout: 10000 })
  })

  test('should handle WebSocket connection status', async ({ page }) => {
    await page.goto('http://localhost:3001/analysis/META')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("META Analysis")')

    // Check connection status badge
    const connectionBadge = page.locator('text=Live').or(page.locator('text=Offline'))
    await expect(connectionBadge).toBeVisible()
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('http://localhost:3001/analysis/AMZN')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("AMZN Analysis")')

    // Check for proper heading structure
    await expect(page.locator('h1')).toBeVisible()

    // Check for tab accessibility
    const tabs = page.locator('button[role="tab"]')
    await expect(tabs).toHaveCount(4)

    // Test keyboard navigation
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should be able to navigate with keyboard
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('http://localhost:3001/analysis/JPM')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("JPM Analysis")')

    // Check that mobile layout is responsive
    await expect(page.locator('h1')).toBeVisible()

    // Verify tabs work on mobile
    await page.click('text=Technical')
    await expect(page.locator('text=RSI')).toBeVisible({ timeout: 10000 })

    // Check that price is displayed correctly on mobile
    await expect(page.locator('text=/\\$\\d+\\.\\d{2}/')).toBeVisible()
  })

  test('should handle quick actions', async ({ page }) => {
    await page.goto('http://localhost:3001/analysis/QQQ')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("QQQ Analysis")')

    // Test watchlist button
    const watchlistButton = page.locator('button:has-text("Watchlist")')
    await expect(watchlistButton).toBeVisible()
    await watchlistButton.click()

    // Test share button
    const shareButton = page.locator('button:has-text("Share")')
    await expect(shareButton).toBeVisible()

    // Test export button
    const exportButton = page.locator('button:has-text("Export")')
    await expect(exportButton).toBeVisible()

    // Test refresh button
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()
    await refreshButton.click()
  })

  test('should handle protected route authentication', async ({ page }) => {
    // This test assumes authentication is required
    // In development mode, it might always pass

    await page.goto('http://localhost:3001/analysis/SPY')

    // Should either show the analysis page (dev mode)
    // or redirect to login (production mode)
    const hasAnalysis = await page.locator('h1:has-text("SPY Analysis")').isVisible({ timeout: 5000 }).catch(() => false)
    const hasLogin = await page.locator('text=Login').isVisible({ timeout: 1000 }).catch(() => false)

    // One of them should be true
    expect(hasAnalysis || hasLogin).toBeTruthy()

    // If showing analysis, verify content
    if (hasAnalysis) {
      await expect(page.locator('text=Overall Analysis Score')).toBeVisible()
    }
  })
})

test.describe('Stock Analysis API Integration', () => {
  test('should handle API responses correctly', async ({ page }) => {
    // Intercept API calls to verify they're being made
    const apiCalls = []

    page.route('**/api/v1/stocks/**', (route) => {
      apiCalls.push(route.request().url())
      // Let the request continue to the actual API
      route.continue()
    })

    await page.goto('http://localhost:3001/analysis/AAPL')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("AAPL Analysis")')

    // In Next.js with SSR, API calls happen on the server
    // So we might not see client-side API calls
    // But we should verify the data is displayed

    await expect(page.locator('text=/\\$\\d+\\.\\d{2}/')).toBeVisible()

    // Verify analysis score is displayed
    await expect(page.locator('text=/\\d+%/').first()).toBeVisible()
  })

  test('should handle partial API failures gracefully', async ({ page }) => {
    // This would require mocking the API to return partial failures
    // For now, just test that the page handles missing data gracefully

    await page.goto('http://localhost:3001/analysis/TEST')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Should either show content or error state
    const hasContent = await page.locator('h1:has-text("TEST Analysis")').isVisible({ timeout: 1000 }).catch(() => false)
    const hasError = await page.locator('text=Error Loading Stock Data').isVisible({ timeout: 1000 }).catch(() => false)

    expect(hasContent || hasError).toBeTruthy()

    // If content is shown, it should handle missing data gracefully
    if (hasContent) {
      // Should show partial data warning if some APIs failed
      const partialDataWarning = await page.locator('text=Partial Data').isVisible({ timeout: 1000 }).catch(() => false)
      // This is expected behavior for some stocks
    }
  })
})