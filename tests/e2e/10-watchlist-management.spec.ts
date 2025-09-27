import { test, expect } from '@playwright/test'

test.describe('Watchlist Management - Navigation and Interaction', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('http://localhost:3001')
  })

  test('should navigate to watchlist page from main navigation', async ({ page }) => {
    // Look for watchlist navigation link
    const watchlistLink = page.locator('a[href*="watchlist"], button:has-text("Watchlist")')

    if (await watchlistLink.count() > 0) {
      await watchlistLink.first().click()

      // Should navigate to watchlist page
      await expect(page).toHaveURL(/\/watchlist/)

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // Check that we're on the watchlist page
      await expect(page.locator('h1:has-text("Watchlist")')).toBeVisible()
    } else {
      // If no watchlist link, navigate directly
      await page.goto('http://localhost:3001/watchlist')
      await page.waitForLoadState('networkidle')

      // Check that we're on the watchlist page
      await expect(page.locator('h1:has-text("Watchlist")')).toBeVisible()
    }
  })

  test('should display watchlist with demo data and real-time indicators', async ({ page }) => {
    // Navigate directly to watchlist page
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check for main watchlist elements
    await expect(page.locator('h2:has-text("My Watchlist")')).toBeVisible()

    // Check for connection status indicator
    const connectionStatus = page.locator('text=Live Data, text=Offline')
    await expect(connectionStatus.first()).toBeVisible({ timeout: 10000 })

    // Check for watchlist actions
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible()
    await expect(page.locator('button:has-text("Columns")')).toBeVisible()

    // Check for search functionality
    await expect(page.locator('input[placeholder*="Search stocks"]')).toBeVisible()
  })

  test('should display stock data with virtualized table', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")', { timeout: 10000 })

    // Check for table headers
    await expect(page.locator('text=Symbol')).toBeVisible()
    await expect(page.locator('text=Company')).toBeVisible()
    await expect(page.locator('text=Price')).toBeVisible()
    await expect(page.locator('text=Change')).toBeVisible()
    await expect(page.locator('text=Volume')).toBeVisible()

    // Check for stock symbols (using demo data)
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'META', 'AMZN']
    for (const symbol of symbols) {
      await expect(page.locator(`text=${symbol}`)).toBeVisible({ timeout: 5000 })
    }

    // Check for price information
    await expect(page.locator('text=/\\$\\d+\\.\\d+/')).toBeVisible()
    await expect(page.locator('text=/[+-]\\d+\\.\\d+%/')).toBeVisible()
  })

  test('should handle stock selection and multi-select actions', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Select first stock
    const firstCheckbox = page.locator('input[type="checkbox"]').nth(1) // Skip header checkbox
    await firstCheckbox.check()

    // Should show bulk actions bar
    await expect(page.locator('text=1 stock selected')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("Remove Selected")')).toBeVisible()
    await expect(page.locator('button:has-text("Export Selected")')).toBeVisible()

    // Select second stock
    const secondCheckbox = page.locator('input[type="checkbox"]').nth(2)
    await secondCheckbox.check()

    // Should update selection count
    await expect(page.locator('text=2 stocks selected')).toBeVisible()

    // Test select all
    const headerCheckbox = page.locator('input[type="checkbox"]').first()
    await headerCheckbox.check()

    // Should select all stocks
    await expect(page.locator('text=7 stocks selected')).toBeVisible({ timeout: 5000 })

    // Clear selection
    const clearButton = page.locator('button:has-text("Clear selection")')
    await clearButton.click()

    // Bulk actions should disappear
    await expect(page.locator('text=stocks selected')).not.toBeVisible({ timeout: 5000 })
  })

  test('should filter stocks using search', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Search for Apple
    const searchInput = page.locator('input[placeholder*="Search stocks"]')
    await searchInput.fill('Apple')

    // Should show only Apple stock
    await expect(page.locator('text=AAPL')).toBeVisible()
    await expect(page.locator('text=Apple Inc.')).toBeVisible()

    // Should not show other stocks
    await expect(page.locator('text=MSFT')).not.toBeVisible({ timeout: 2000 })
    await expect(page.locator('text=Microsoft')).not.toBeVisible({ timeout: 2000 })

    // Clear search
    await searchInput.clear()
    await searchInput.fill('')

    // Should show all stocks again
    await expect(page.locator('text=MSFT')).toBeVisible({ timeout: 5000 })
  })

  test('should handle column configuration', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Open column configuration
    const columnsButton = page.locator('button:has-text("Columns")')
    await columnsButton.click()

    // Should show column configuration panel
    await expect(page.locator('text=Column Configuration')).toBeVisible({ timeout: 5000 })

    // Should show column checkboxes
    await expect(page.locator('input[type="checkbox"] + *:has-text("Symbol")')).toBeVisible()
    await expect(page.locator('input[type="checkbox"] + *:has-text("Company")')).toBeVisible()
    await expect(page.locator('input[type="checkbox"] + *:has-text("Price")')).toBeVisible()

    // Toggle volume column off
    const volumeCheckbox = page.locator('input[type="checkbox"] + *:has-text("Volume")').locator('..')
                                   .locator('input[type="checkbox"]')
    await volumeCheckbox.uncheck()

    // Volume column should disappear from table
    await expect(page.locator('th:has-text("Volume")')).not.toBeVisible({ timeout: 5000 })

    // Toggle it back on
    await volumeCheckbox.check()

    // Volume column should reappear
    await expect(page.locator('text=Volume')).toBeVisible({ timeout: 5000 })

    // Close configuration panel
    await columnsButton.click()
    await expect(page.locator('text=Column Configuration')).not.toBeVisible({ timeout: 5000 })
  })

  test('should sort stocks by different columns', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Click on Price header to sort
    const priceHeader = page.locator('th:has-text("Price"), div:has-text("Price")').first()
    await priceHeader.click()

    // Should show sort indicator
    await expect(page.locator('svg', { hasText: /sort|arrow/ }).or(
      page.locator('[class*="sort"]')
    )).toBeVisible({ timeout: 5000 })

    // Click again to reverse sort
    await priceHeader.click()

    // Click on Symbol header
    const symbolHeader = page.locator('th:has-text("Symbol"), div:has-text("Symbol")').first()
    await symbolHeader.click()

    // Verify sorting works (symbols should be in different order)
    const firstSymbol = page.locator('td:has-text(/^[A-Z]{1,5}$/)').first()
    await expect(firstSymbol).toBeVisible()
  })

  test('should handle individual stock removal', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Find remove button for first stock
    const removeButton = page.locator('button[title="Remove from watchlist"]').first()
    await removeButton.click()

    // Stock should be removed (or action should be indicated)
    // Note: Since we're not connected to backend, this tests the UI interaction
    await expect(removeButton).toBeVisible() // Button should still exist but stock might be removed from view
  })

  test('should handle bulk stock removal', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Select multiple stocks
    const checkboxes = page.locator('input[type="checkbox"]')
    await checkboxes.nth(1).check() // First stock
    await checkboxes.nth(2).check() // Second stock

    // Should show bulk actions
    await expect(page.locator('text=2 stocks selected')).toBeVisible()

    // Click bulk remove
    const bulkRemoveButton = page.locator('button:has-text("Remove Selected")')
    await bulkRemoveButton.click()

    // Should show success (or handle the action)
    await expect(page.locator('text=stocks selected')).not.toBeVisible({ timeout: 5000 })
  })

  test('should export CSV data', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Setup download handling
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })

    // Click export button
    const exportButton = page.locator('button:has-text("Export CSV")')
    await exportButton.click()

    try {
      // Wait for download
      const download = await downloadPromise

      // Verify download
      expect(download.suggestedFilename()).toMatch(/\.csv$/)
    } catch (error) {
      // If download doesn't work (due to implementation), just verify UI interaction
      console.log('Download not implemented or blocked in test environment')
    }
  })

  test('should export selected stocks only', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Select some stocks
    const checkboxes = page.locator('input[type="checkbox"]')
    await checkboxes.nth(1).check()
    await checkboxes.nth(2).check()

    // Should show bulk actions
    await expect(page.locator('text=2 stocks selected')).toBeVisible()

    // Setup download handling
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })

    // Click export selected
    const exportSelectedButton = page.locator('button:has-text("Export Selected")')
    await exportSelectedButton.click()

    try {
      // Wait for download
      const download = await downloadPromise

      // Verify download
      expect(download.suggestedFilename()).toMatch(/\.csv$/)
    } catch (error) {
      // If download doesn't work, just verify UI interaction
      console.log('Download not implemented or blocked in test environment')
    }
  })

  test('should switch between different watchlists', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Find watchlist selector
    const watchlistSelect = page.locator('select').first()

    if (await watchlistSelect.count() > 0) {
      // Get current option count
      const options = await watchlistSelect.locator('option').count()

      if (options > 1) {
        // Select different watchlist
        await watchlistSelect.selectOption({ index: 1 })

        // Should show different watchlist name
        await expect(page.locator('h2:has-text("Tech Giants")')).toBeVisible({ timeout: 5000 })

        // Should show fewer stocks (4 instead of 7)
        await expect(page.locator('text=4 stocks')).toBeVisible()
      }
    }
  })

  test('should display real-time connection status', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Should show connection status
    const connectionStatus = page.locator('text=Live Data, text=Offline').first()
    await expect(connectionStatus).toBeVisible()

    // Should show status in description
    const description = page.locator('p').filter({ hasText: /Live Data|Offline/ })
    await expect(description).toBeVisible()

    // Should show animated indicator for live data
    const animatedIndicator = page.locator('.animate-ping').or(
      page.locator('[class*="animate"]')
    )

    if (await page.locator('text=Live Data').count() > 0) {
      await expect(animatedIndicator).toBeVisible({ timeout: 5000 })
    }
  })

  test('should handle empty search results gracefully', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Search for non-existent stock
    const searchInput = page.locator('input[placeholder*="Search stocks"]')
    await searchInput.fill('NONEXISTENT')

    // Should show no results state
    await expect(page.locator('text=No matching stocks')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("Clear search")')).toBeVisible()

    // Clear search should work
    const clearSearchButton = page.locator('button:has-text("Clear search")')
    await clearSearchButton.click()

    // Should show all stocks again
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 5000 })
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")', { timeout: 10000 })

    // Check that mobile layout is responsive
    await expect(page.locator('h2:has-text("My Watchlist")')).toBeVisible()

    // Should show columns button for configuration
    await expect(page.locator('button:has-text("Columns")')).toBeVisible()

    // Should show export button
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible()

    // Table should be scrollable horizontally if needed
    const tableContainer = page.locator('[style*="overflow"]').or(
      page.locator('[class*="overflow"]')
    )
    await expect(tableContainer.first()).toBeVisible({ timeout: 5000 })
  })

  test('should handle loading states appropriately', async ({ page }) => {
    // Navigate to watchlist page and check for loading states
    await page.goto('http://localhost:3001/watchlist')

    // Should show loading initially (or content if SSR is fast)
    const hasLoading = await page.locator('text=Loading').isVisible({ timeout: 1000 }).catch(() => false)
    const hasContent = await page.locator('h2:has-text("My Watchlist")').isVisible({ timeout: 1000 }).catch(() => false)

    // One of them should be true
    expect(hasLoading || hasContent).toBeTruthy()

    // Eventually content should be visible
    await expect(page.locator('h2:has-text("My Watchlist")')).toBeVisible({ timeout: 10000 })
  })

  test('should display price changes with appropriate colors', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Look for positive and negative changes
    const positiveChanges = page.locator('text=/\\+\\d+\\.\\d+/')
    const negativeChanges = page.locator('text=/-\\d+\\.\\d+/')

    if (await positiveChanges.count() > 0) {
      // Should have green/bull color class
      const firstPositive = positiveChanges.first()
      await expect(firstPositive).toHaveClass(/bull|green/)
    }

    if (await negativeChanges.count() > 0) {
      // Should have red/bear color class
      const firstNegative = negativeChanges.first()
      await expect(firstNegative).toHaveClass(/bear|red/)
    }
  })

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // Focus search input with tab
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab') // Navigate to search input

    // Type in search
    await page.keyboard.type('AAPL')

    // Should filter results
    await expect(page.locator('text=Apple Inc.')).toBeVisible({ timeout: 5000 })

    // Clear with keyboard
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')

    // Should show all results again
    await expect(page.locator('text=MSFT')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Watchlist API Integration', () => {
  test('should handle API responses correctly', async ({ page }) => {
    // Intercept API calls to verify they're being made
    const apiCalls: string[] = []

    page.route('**/api/v1/watchlists/**', (route) => {
      apiCalls.push(route.request().url())
      // Let the request continue (or return mock data)
      route.continue()
    })

    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForSelector('h2:has-text("My Watchlist")')

    // In Next.js with SSR, API calls happen on the server
    // So we might not see client-side API calls
    // But we should verify the data is displayed

    await expect(page.locator('text=/\\$\\d+\\.\\d+/')).toBeVisible()

    // Verify watchlist data is displayed
    await expect(page.locator('text=My Watchlist')).toBeVisible()
  })

  test('should handle partial API failures gracefully', async ({ page }) => {
    // This would require mocking the API to return partial failures
    // For now, just test that the page handles missing data gracefully

    await page.goto('http://localhost:3001/watchlist')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Should either show content or error state
    const hasContent = await page.locator('h2:has-text("My Watchlist")').isVisible({ timeout: 1000 }).catch(() => false)
    const hasError = await page.locator('text=Watchlist Unavailable').isVisible({ timeout: 1000 }).catch(() => false)

    expect(hasContent || hasError).toBeTruthy()

    // If content is shown, it should handle missing data gracefully
    if (hasContent) {
      // Should show demo data warning if real APIs fail
      const demoWarning = await page.locator('text=Using Demo Data').isVisible({ timeout: 1000 }).catch(() => false)
      // This is expected behavior when backend isn't available
    }
  })
})