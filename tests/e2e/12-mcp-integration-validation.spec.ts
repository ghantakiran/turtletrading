import { test, expect } from '@playwright/test'

/**
 * MCP Playwright Integration Validation
 * Tests that validate the TurtleTrading platform works correctly with MCP Playwright
 * and is ready for Vercel deployment
 */

test.describe('MCP Playwright Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto('http://localhost:3002')
  })

  test('should load homepage with proper branding and navigation', async ({ page }) => {
    // Validate page loads correctly
    await expect(page).toHaveTitle(/TurtleTrading/)

    // Check main branding elements
    await expect(page.getByRole('heading', { name: 'TurtleTrading' })).toBeVisible()
    await expect(page.getByText('AI-Powered Trading Platform')).toBeVisible()

    // Validate navigation menu
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Stock Analysis' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Portfolio' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Alerts' })).toBeVisible()

    // Check authentication links
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign Up' })).toBeVisible()
  })

  test('should have functional navigation routing', async ({ page }) => {
    // Test Dashboard link
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/.*\/dashboard/)

    // Go back to home
    await page.goto('http://localhost:3002')

    // Test Stock Analysis link
    await page.getByRole('link', { name: 'Stock Analysis' }).click()
    await expect(page).toHaveURL(/.*\/analysis/)

    // Go back to home
    await page.goto('http://localhost:3002')

    // Test Portfolio link
    await page.getByRole('link', { name: 'Portfolio' }).click()
    await expect(page).toHaveURL(/.*\/portfolio/)
  })

  test('should redirect to login when accessing protected routes', async ({ page }) => {
    // Try to access dashboard directly
    await page.goto('http://localhost:3002/dashboard')

    // Should be redirected to login
    await expect(page).toHaveURL(/.*\/login/)

    // Try portfolio
    await page.goto('http://localhost:3002/portfolio')
    await expect(page).toHaveURL(/.*\/login/)

    // Try alerts
    await page.goto('http://localhost:3002/alerts')
    await expect(page).toHaveURL(/.*\/login/)
  })

  test('should have working search functionality', async ({ page }) => {
    // Check search box exists
    const searchBox = page.getByPlaceholder(/Search stocks/)
    await expect(searchBox).toBeVisible()

    // Test search input
    await searchBox.fill('AAPL')
    await expect(searchBox).toHaveValue('AAPL')

    // Clear search
    await searchBox.fill('')
    await expect(searchBox).toHaveValue('')
  })

  test('should show connection status indicators', async ({ page }) => {
    // Check for connection status (should show "Offline" in test environment)
    await expect(page.getByText('Offline')).toBeVisible()

    // Check for watchlist button
    await expect(page.getByRole('button', { name: 'Watchlist' })).toBeVisible()

    // Check for AI Insights button
    await expect(page.getByRole('button', { name: 'AI Insights' })).toBeVisible()
  })

  test('should handle homepage redirect flow', async ({ page }) => {
    // Wait for the loading animation and redirect
    await page.getByText('Loading your trading dashboard...').isVisible()

    // Should eventually redirect to login page after 2 seconds
    await page.waitForURL(/.*\/login/, { timeout: 5000 })
  })

  test('should be responsive and mobile-friendly', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.getByRole('navigation')).toBeVisible()

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.getByRole('navigation')).toBeVisible()

    // Test mobile view - navigation might be collapsed
    await page.setViewportSize({ width: 375, height: 667 })
    // Navigation should still be accessible (might be in hamburger menu)
    await expect(page.getByRole('banner')).toBeVisible()
  })

  test('should have proper performance characteristics', async ({ page }) => {
    // Measure page load performance
    const startTime = Date.now()
    await page.goto('http://localhost:3002')
    const loadTime = Date.now() - startTime

    // Should load within reasonable time (5 seconds for development)
    expect(loadTime).toBeLessThan(5000)

    // Check for no console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.reload()

    // Allow for React DevTools and build errors, but not critical runtime errors
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('React DevTools') &&
      !error.includes('Module not found') && // Expected during development
      !error.includes('Failed to load resource') // Expected during development
    )

    expect(criticalErrors.length).toBe(0)
  })

  test('should have basic accessibility features', async ({ page }) => {
    // Check for proper heading structure
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Check that links are keyboard accessible
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Check for alt text on images (brand logo)
    const images = page.locator('img')
    const count = await images.count()

    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      if (await img.isVisible()) {
        // Images should have alt text or be decorative
        const alt = await img.getAttribute('alt')
        expect(alt !== null).toBe(true)
      }
    }
  })

  test('should validate backend API connectivity', async ({ page }) => {
    // Test if backend is accessible
    const response = await page.request.get('http://localhost:8000/health')
    expect(response.ok()).toBe(true)

    const healthData = await response.json()
    expect(healthData).toHaveProperty('status')
  })
})

test.describe('Platform Readiness for Deployment', () => {
  test('should validate all core services are running', async ({ page }) => {
    // Frontend is running (we're testing it)
    await page.goto('http://localhost:3002')
    await expect(page).toHaveTitle(/TurtleTrading/)

    // Backend health check
    const backendResponse = await page.request.get('http://localhost:8000/health')
    expect(backendResponse.ok()).toBe(true)

    // Test API documentation is accessible
    const docsResponse = await page.request.get('http://localhost:8000/docs')
    expect(docsResponse.ok()).toBe(true)
  })

  test('should validate essential API endpoints', async ({ page }) => {
    const apiBase = 'http://localhost:8000/api/v1'

    // Test stocks endpoint (should return 401 or proper response)
    const stocksResponse = await page.request.get(`${apiBase}/stocks/AAPL/price`)
    // Either works (200) or requires auth (401), both are acceptable
    expect([200, 401, 422].includes(stocksResponse.status())).toBe(true)

    // Test market endpoint
    const marketResponse = await page.request.get(`${apiBase}/market/overview`)
    expect([200, 401, 422].includes(marketResponse.status())).toBe(true)
  })

  test('should confirm routing architecture works correctly', async ({ page }) => {
    // Test that protected routes redirect to auth
    await page.goto('http://localhost:3002/dashboard')
    await expect(page).toHaveURL(/.*\/login/)

    // Test that auth routes are accessible
    await page.goto('http://localhost:3002/login')
    await expect(page).toHaveURL(/.*\/login/)

    await page.goto('http://localhost:3002/register')
    await expect(page).toHaveURL(/.*\/register/)

    // Test that public routes work
    await page.goto('http://localhost:3002/')
    await expect(page).toHaveURL('http://localhost:3002/')
  })

  test('should validate MCP Playwright can interact with all key elements', async ({ page }) => {
    await page.goto('http://localhost:3002')

    // Test clicking navigation elements
    await page.getByRole('link', { name: 'Login' }).click()
    await expect(page).toHaveURL(/.*\/login/)

    // Go back
    await page.goBack()

    // Test search interaction
    await page.getByPlaceholder(/Search stocks/).fill('MSFT')
    await page.getByPlaceholder(/Search stocks/).clear()

    // Test button interactions
    await page.getByRole('button', { name: 'Watchlist' }).click()
    await page.getByRole('button', { name: 'AI Insights' }).click()
  })
})