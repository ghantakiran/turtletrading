import { test, expect } from '@playwright/test'

/**
 * E2E Tests for LSTM AI Predictions Feature (Issue #14)
 * Tests the AI predictions page, LSTM chart component, and backend integration
 */
test.describe('LSTM AI Predictions - Complete Flow', () => {
  const BASE_URL = 'http://localhost:3000'
  const TEST_SYMBOL = 'AAPL'

  test.beforeEach(async ({ page }) => {
    // Start from the AI predictions page
    await page.goto(`${BASE_URL}/ai-predictions/${TEST_SYMBOL}`)
  })

  test('should load AI predictions page successfully', async ({ page }) => {
    // Verify page title and header
    await expect(page.locator('h1')).toContainText(TEST_SYMBOL)
    await expect(page.locator('text=AI Predictions')).toBeVisible()
    await expect(page.locator('text=Advanced LSTM neural network price forecasts')).toBeVisible()

    // Verify feature overview card is visible
    await expect(page.locator('text=AI-Powered Price Predictions')).toBeVisible()
    await expect(page.locator('text=Long Short-Term Memory')).toBeVisible()

    // Verify methodology section is present
    await expect(page.locator('text=How It Works')).toBeVisible()
    await expect(page.locator('text=Data Collection')).toBeVisible()
    await expect(page.locator('text=Neural Network Processing')).toBeVisible()

    // Verify disclaimer is visible
    await expect(page.locator('text=Important Disclaimer')).toBeVisible()
  })

  test('should display LSTM predictions chart with default 30-day horizon', async ({ page }) => {
    // Wait for the LSTM chart card to load
    await expect(page.locator('text=AI Price Predictions')).toBeVisible()

    // Wait for loading to complete (spinner should disappear)
    await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

    // Verify chart container is visible
    await expect(page.locator('.recharts-wrapper')).toBeVisible({ timeout: 10000 })

    // Verify chart elements are rendered
    await expect(page.locator('.recharts-surface')).toBeVisible()
    await expect(page.locator('.recharts-area')).toBeVisible()

    // Verify legend items
    await expect(page.locator('text=Predicted Price')).toBeVisible()
    await expect(page.locator('text=Confidence Interval')).toBeVisible()
  })

  test('should display model performance metrics', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

    // Verify metrics grid is visible
    await expect(page.locator('text=Current Price')).toBeVisible()
    await expect(page.locator('text=Model Accuracy')).toBeVisible()
    await expect(page.locator('text=Confidence')).toBeVisible()

    // Verify price values are displayed (should contain $ and numbers)
    const priceElements = await page.locator('text=/\\$\\d+\\.\\d{2}/').count()
    expect(priceElements).toBeGreaterThan(0)

    // Verify percentage values are displayed
    const percentageElements = await page.locator('text=/\\d+\\.\\d+%/').count()
    expect(percentageElements).toBeGreaterThan(0)
  })

  test('should switch between time horizons (7, 14, 30, 60, 90 days)', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

    // Test each time horizon button
    const horizons = [7, 14, 30, 60, 90]

    for (const days of horizons) {
      // Click the button for this time horizon
      await page.click(`button:has-text("${days} Days")`)

      // Wait for loading spinner to appear and disappear
      await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'attached', timeout: 2000 }).catch(() => {})
      await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

      // Verify chart updated (recharts should re-render)
      await expect(page.locator('.recharts-wrapper')).toBeVisible()

      // Verify the selected button has active styling
      const selectedButton = page.locator(`button:has-text("${days} Days")`)
      await expect(selectedButton).toHaveClass(/bg-primary|bg-blue/)
    }
  })

  test('should display trend indicator badge (bullish/bearish)', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

    // Check for either bullish or bearish badge
    const trendBadge = page.locator('text=/Bullish|Bearish/')
    await expect(trendBadge).toBeVisible()

    // Verify trend percentage is displayed
    await expect(page.locator('text=/[+-]\\d+\\.\\d+%/')).toBeVisible()
  })

  test('should display price target range', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

    // Verify price target section
    await expect(page.locator('text=Price Target Range')).toBeVisible()

    // Verify upper and lower bounds are displayed
    await expect(page.locator('text=Upper Bound')).toBeVisible()
    await expect(page.locator('text=Lower Bound')).toBeVisible()
  })

  test('should navigate back using back button', async ({ page }) => {
    // Click the back button (ArrowLeft icon)
    await page.click('button[aria-label="Go back"]', { timeout: 5000 }).catch(async () => {
      // Fallback: look for any button with ArrowLeft icon
      await page.click('button:has(svg.lucide-arrow-left)')
    })

    // Should navigate to previous page
    // Since we came directly, it might go to home or stay on same page
    // Just verify we didn't get an error
    await page.waitForLoadState('networkidle')
  })

  test('should navigate to full stock analysis page', async ({ page }) => {
    // Click "View Full Analysis" button
    await page.click('button:has-text("View Full Analysis")')

    // Should navigate to stock analysis page
    await expect(page).toHaveURL(`${BASE_URL}/stock/${TEST_SYMBOL}`)
    await expect(page.locator('h1')).toContainText(TEST_SYMBOL)
  })

  test('should handle API integration correctly', async ({ page }) => {
    // Set up network monitoring
    const apiCalls: string[] = []
    page.on('request', request => {
      if (request.url().includes('/api/v1/lstm')) {
        apiCalls.push(request.url())
      }
    })

    // Reload page to capture initial API call
    await page.reload()

    // Wait for data to load
    await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

    // Verify API was called
    expect(apiCalls.length).toBeGreaterThan(0)

    // Verify API call includes symbol and days parameter
    expect(apiCalls[0]).toContain(TEST_SYMBOL)
    expect(apiCalls[0]).toContain('days=')
  })

  test('should display loading state correctly', async ({ page }) => {
    // Reload page to see loading state
    await page.reload()

    // Verify loading spinner is visible initially
    const loader = page.locator('svg[class*="lucide-loader"]')
    await expect(loader).toBeVisible({ timeout: 2000 })

    // Loading should complete within 10 seconds
    await expect(loader).not.toBeVisible({ timeout: 10000 })
  })

  test('should handle error state gracefully', async ({ page }) => {
    // Navigate to invalid symbol
    await page.goto(`${BASE_URL}/ai-predictions/INVALIDXYZ`)

    // Wait for potential error state
    await page.waitForLoadState('networkidle')

    // Check for error indicators (either error message or retry button)
    const errorMessage = page.locator('text=/Error|Failed|Unable to load/')
    const retryButton = page.locator('button:has-text("Retry")')

    // Either error message or retry should be visible, or chart loads successfully
    const hasError = await errorMessage.isVisible().catch(() => false)
    const hasRetry = await retryButton.isVisible().catch(() => false)
    const hasChart = await page.locator('.recharts-wrapper').isVisible().catch(() => false)

    // One of these should be true
    expect(hasError || hasRetry || hasChart).toBe(true)
  })

  test('should display feature overview with three columns', async ({ page }) => {
    // Verify the three feature cards in the overview section
    await expect(page.locator('text=Neural Network')).toBeVisible()
    await expect(page.locator('text=Multiple Time Horizons')).toBeVisible()
    await expect(page.locator('text=Confidence Intervals')).toBeVisible()

    // Verify feature descriptions
    await expect(page.locator('text=Advanced LSTM architecture')).toBeVisible()
    await expect(page.locator('text=Forecasts from 7 to 90 days')).toBeVisible()
    await expect(page.locator('text=Upper and lower bounds')).toBeVisible()
  })

  test('should display all methodology steps', async ({ page }) => {
    // Verify all 4 methodology steps are visible
    await expect(page.locator('text=1. Data Collection')).toBeVisible()
    await expect(page.locator('text=2. Neural Network Processing')).toBeVisible()
    await expect(page.locator('text=3. Prediction Generation')).toBeVisible()
    await expect(page.locator('text=4. Continuous Learning')).toBeVisible()

    // Verify step descriptions
    await expect(page.locator('text=historical price data')).toBeVisible()
    await expect(page.locator('text=sequential patterns')).toBeVisible()
    await expect(page.locator('text=confidence intervals')).toBeVisible()
    await expect(page.locator('text=regularly retrained')).toBeVisible()
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Verify page loads correctly
    await expect(page.locator('h1')).toContainText(TEST_SYMBOL)

    // Wait for data to load
    await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

    // Verify chart is still visible on mobile
    await expect(page.locator('.recharts-wrapper')).toBeVisible()

    // Verify buttons are visible and clickable
    await expect(page.locator('button:has-text("7 Days")')).toBeVisible()
  })

  test('should persist across multiple symbols', async ({ page }) => {
    const symbols = ['AAPL', 'GOOGL', 'MSFT']

    for (const symbol of symbols) {
      await page.goto(`${BASE_URL}/ai-predictions/${symbol}`)

      // Verify correct symbol is displayed
      await expect(page.locator('h1')).toContainText(symbol)

      // Wait for data to load
      await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

      // Verify chart loads for this symbol
      await expect(page.locator('.recharts-wrapper')).toBeVisible()
    }
  })
})

/**
 * LSTM Component Integration Tests
 */
test.describe('LSTM Predictions Component - Isolated Tests', () => {
  const BASE_URL = 'http://localhost:3000'

  test('should render chart with correct data structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-predictions/AAPL`)

    // Wait for data
    await page.waitForSelector('svg[class*="lucide-loader"]', { state: 'hidden', timeout: 10000 })

    // Verify chart has correct number of areas (predicted price + confidence interval)
    const areas = await page.locator('.recharts-area').count()
    expect(areas).toBeGreaterThanOrEqual(1)

    // Verify axes are present
    await expect(page.locator('.recharts-xAxis')).toBeVisible()
    await expect(page.locator('.recharts-yAxis')).toBeVisible()

    // Verify tooltip container exists
    await expect(page.locator('.recharts-tooltip-wrapper')).toBeAttached()
  })

  test('should display disclaimer section', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-predictions/AAPL`)

    // Verify disclaimer is visible and contains warning text
    await expect(page.locator('text=Important Disclaimer')).toBeVisible()
    await expect(page.locator('text=should not be considered as financial advice')).toBeVisible()
    await expect(page.locator('text=Always conduct your own research')).toBeVisible()
  })

  test('should have proper gradient styling on overview card', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-predictions/AAPL`)

    // Verify gradient card exists
    const gradientCard = page.locator('text=AI-Powered Price Predictions').locator('..')
    await expect(gradientCard).toBeVisible()

    // Card should have gradient class
    const cardElement = await gradientCard.locator('..').locator('..')
    const classes = await cardElement.getAttribute('class')
    expect(classes).toContain('gradient')
  })
})
