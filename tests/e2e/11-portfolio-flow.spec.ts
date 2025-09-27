import { test, expect } from '@playwright/test'

test.describe('Portfolio Flow - Navigation and Interaction', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('http://localhost:3001')
  })

  test('should navigate to portfolio page from main navigation', async ({ page }) => {
    // Look for portfolio navigation link
    const portfolioLink = page.locator('a[href*="portfolio"], button:has-text("Portfolio")')
    
    if (await portfolioLink.count() > 0) {
      await portfolioLink.first().click()
      
      // Should navigate to portfolio page
      await expect(page).toHaveURL(/\/portfolio/)
      
      // Wait for page to load
      await page.waitForLoadState('networkidle')
      
      // Check that we're on the portfolio page
      await expect(page.locator('h1:has-text("Portfolio")')).toBeVisible()
    } else {
      // If no portfolio link, navigate directly
      await page.goto('http://localhost:3001/portfolio')
      await page.waitForLoadState('networkidle')
      
      // Check that we're on the portfolio page
      await expect(page.locator('h1:has-text("Portfolio")')).toBeVisible()
    }
  })

  test('should display portfolio overview with demo data', async ({ page }) => {
    // Navigate directly to portfolio page
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check for main portfolio elements
    await expect(page.locator('h1:has-text("Portfolio")')).toBeVisible()
    
    // Check for connection status indicator
    const connectionStatus = page.locator('text=Live Data, text=Offline')
    await expect(connectionStatus.first()).toBeVisible({ timeout: 10000 })
    
    // Check for portfolio actions
    await expect(page.locator('button:has-text("Export")')).toBeVisible()
    await expect(page.locator('button:has-text("Rebalance")')).toBeVisible()
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible()
  })

  test('should display portfolio tabs correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")', { timeout: 10000 })
    
    // Check for tab navigation
    const overviewTab = page.locator('button[role="tab"]:has-text("Overview")')
    const allocationTab = page.locator('button[role="tab"]:has-text("Allocation")')
    const transactionsTab = page.locator('button[role="tab"]:has-text("Transactions")')
    
    await expect(overviewTab).toBeVisible()
    await expect(allocationTab).toBeVisible()
    await expect(transactionsTab).toBeVisible()
    
    // Test Overview tab (default)
    await expect(overviewTab).toHaveAttribute('data-state', 'active')
    await expect(page.locator('text=Total Value')).toBeVisible({ timeout: 5000 })
  })

  test('should switch between tabs correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Test Allocation tab
    await page.click('button[role="tab"]:has-text("Allocation")')
    await expect(page.locator('text=Sector Allocation')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Asset Types')).toBeVisible()
    
    // Test Transactions tab
    await page.click('button[role="tab"]:has-text("Transactions")')
    await expect(page.locator('text=Recent Transactions')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Your trading history and activity')).toBeVisible()
    
    // Back to Overview tab
    await page.click('button[role="tab"]:has-text("Overview")')
    await expect(page.locator('text=Total Value')).toBeVisible()
  })

  test('should display portfolio metrics and P&L', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Check for P&L cards
    await expect(page.locator('text=Total Value')).toBeVisible()
    await expect(page.locator('text=Unrealized P&L')).toBeVisible()
    await expect(page.locator('text=Realized P&L')).toBeVisible()
    await expect(page.locator('text=Total Return')).toBeVisible()
    
    // Check for portfolio metrics in sidebar
    await expect(page.locator('text=Portfolio Metrics')).toBeVisible()
    await expect(page.locator('text=Beta')).toBeVisible()
    await expect(page.locator('text=Sharpe Ratio')).toBeVisible()
  })

  test('should display holdings with price information', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Check for holdings section
    await expect(page.locator('text=Holdings')).toBeVisible()
    
    // Check for stock symbols (using demo data)
    const symbols = ['AAPL', 'MSFT', 'GOOGL']
    for (const symbol of symbols) {
      await expect(page.locator(`text=${symbol}`)).toBeVisible({ timeout: 5000 })
    }
    
    // Check for shares and price information
    await expect(page.locator('text=shares')).toBeVisible()
    await expect(page.locator('text=Avg Cost')).toBeVisible()
  })

  test('should handle portfolio actions', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Test Export action
    const exportButton = page.locator('button:has-text("Export")')
    await expect(exportButton).toBeVisible()
    await exportButton.click()
    
    // Should open export dialog
    await expect(page.locator('text=Export Portfolio')).toBeVisible({ timeout: 5000 })
    
    // Close dialog
    await page.keyboard.press('Escape')
    
    // Test Rebalance action
    const rebalanceButton = page.locator('button:has-text("Rebalance")')
    await expect(rebalanceButton).toBeVisible()
    await rebalanceButton.click()
    
    // Should open rebalance dialog
    await expect(page.locator('text=Rebalance Portfolio')).toBeVisible({ timeout: 5000 })
    
    // Close dialog
    await page.keyboard.press('Escape')
    
    // Test Refresh action
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()
    await refreshButton.click()
    
    // Refresh should work without opening a dialog
  })

  test('should display allocation breakdown', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load and switch to allocation tab
    await page.waitForSelector('h1:has-text("Portfolio")')
    await page.click('button[role="tab"]:has-text("Allocation")')
    
    // Check sector allocation
    await expect(page.locator('text=Sector Allocation')).toBeVisible()
    await expect(page.locator('text=Technology')).toBeVisible()
    
    // Check asset types
    await expect(page.locator('text=Asset Types')).toBeVisible()
    await expect(page.locator('text=Stocks')).toBeVisible()
    
    // Check top holdings
    await expect(page.locator('text=Top Holdings')).toBeVisible()
    await expect(page.locator('text=Largest positions by portfolio weight')).toBeVisible()
  })

  test('should display transaction history', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load and switch to transactions tab
    await page.waitForSelector('h1:has-text("Portfolio")')
    await page.click('button[role="tab"]:has-text("Transactions")')
    
    // Check transaction history
    await expect(page.locator('text=Recent Transactions')).toBeVisible()
    await expect(page.locator('text=Your trading history and activity')).toBeVisible()
    
    // Check for BUY/SELL transactions in demo data
    await expect(page.locator('text=BUY')).toBeVisible()
  })

  test('should handle server-side rendering correctly', async ({ page }) => {
    // Navigate directly to portfolio page to test SSR
    await page.goto('http://localhost:3001/portfolio')
    
    // Check that server-side content is loaded
    await expect(page.locator('h1:has-text("Portfolio")')).toBeVisible()
    
    // Check for demo data warning (since backend isn't connected)
    const demoWarning = page.locator('text=Using Demo Data, text=Demo Data')
    const hasWarning = await demoWarning.count() > 0
    
    if (hasWarning) {
      await expect(demoWarning.first()).toBeVisible()
    }
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Check for proper heading structure
    await expect(page.locator('h1')).toBeVisible()
    
    // Check for tab accessibility
    const tabs = page.locator('button[role="tab"]')
    await expect(tabs).toHaveCount(3)
    
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
    
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Check that mobile layout is responsive
    await expect(page.locator('h1:has-text("Portfolio")')).toBeVisible()
    
    // Verify tabs work on mobile
    await page.click('button[role="tab"]:has-text("Allocation")')
    await expect(page.locator('text=Sector Allocation')).toBeVisible({ timeout: 10000 })
    
    // Check that portfolio metrics are displayed on mobile
    await page.click('button[role="tab"]:has-text("Overview")')
    await expect(page.locator('text=Total Value')).toBeVisible()
  })

  test('should handle loading states appropriately', async ({ page }) => {
    // Navigate to portfolio page and check for loading states
    await page.goto('http://localhost:3001/portfolio')
    
    // Should show loading initially (or content if SSR is fast)
    const hasLoading = await page.locator('text=Loading').isVisible({ timeout: 1000 }).catch(() => false)
    const hasContent = await page.locator('h1:has-text("Portfolio")').isVisible({ timeout: 1000 }).catch(() => false)
    
    // One of them should be true
    expect(hasLoading || hasContent).toBeTruthy()
    
    // Eventually content should be visible
    await expect(page.locator('h1:has-text("Portfolio")')).toBeVisible({ timeout: 10000 })
  })

  test('should display quick actions in sidebar', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Check for quick actions in sidebar
    await expect(page.locator('text=Quick Actions')).toBeVisible()
    await expect(page.locator('button:has-text("Add Position")')).toBeVisible()
    await expect(page.locator('button:has-text("Performance Analysis")')).toBeVisible()
    await expect(page.locator('button:has-text("Risk Analysis")')).toBeVisible()
  })

  test('should handle rebalancing workflow', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Click rebalance button
    await page.click('button:has-text("Rebalance")')
    
    // Should open rebalance dialog
    await expect(page.locator('text=Rebalance Portfolio')).toBeVisible()
    
    // Select a rebalancing strategy
    await page.click('button[role="combobox"]:near(text=Strategy)')
    await page.click('text=Risk Parity')
    
    // Should show strategy description
    await expect(page.locator('text=Risk Parity Strategy')).toBeVisible()
    await expect(page.locator('text=Allocate based on risk contribution')).toBeVisible()
    
    // Click rebalance button
    await page.click('button:has-text("Rebalance Portfolio")')
    
    // Dialog should close
    await expect(page.locator('text=Rebalance Portfolio')).toBeHidden({ timeout: 5000 })
  })

  test('should handle export workflow', async ({ page }) => {
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // Click export button
    await page.click('button:has-text("Export")')
    
    // Should open export dialog
    await expect(page.locator('text=Export Portfolio')).toBeVisible()
    
    // Select export format
    await page.click('button[role="combobox"]:near(text=Format)')
    await page.click('text=PDF Report')
    
    // Should show export contents
    await expect(page.locator('text=Export Contents')).toBeVisible()
    await expect(page.locator('text=Current holdings and positions')).toBeVisible()
    
    // Click export button
    await page.click('button:has-text("Export Data")')
    
    // Dialog should close
    await expect(page.locator('text=Export Portfolio')).toBeHidden({ timeout: 5000 })
  })
})

test.describe('Portfolio API Integration', () => {
  test('should handle API responses correctly', async ({ page }) => {
    // Intercept API calls to verify they're being made
    const apiCalls: string[] = []
    
    page.route('**/api/v1/portfolio/**', (route) => {
      apiCalls.push(route.request().url())
      // Let the request continue (or return mock data)
      route.continue()
    })
    
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Portfolio")')
    
    // In Next.js with SSR, API calls happen on the server
    // So we might not see client-side API calls
    // But we should verify the data is displayed
    
    await expect(page.locator('text=/\$[\d,]+/')).toBeVisible()
    
    // Verify portfolio value is displayed
    await expect(page.locator('text=Total Value')).toBeVisible()
  })
  
  test('should handle partial API failures gracefully', async ({ page }) => {
    // This would require mocking the API to return partial failures
    // For now, just test that the page handles missing data gracefully
    
    await page.goto('http://localhost:3001/portfolio')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Should either show content or error state
    const hasContent = await page.locator('h1:has-text("Portfolio")').isVisible({ timeout: 1000 }).catch(() => false)
    const hasError = await page.locator('text=Portfolio Unavailable').isVisible({ timeout: 1000 }).catch(() => false)
    
    expect(hasContent || hasError).toBeTruthy()
    
    // If content is shown, it should handle missing data gracefully
    if (hasContent) {
      // Should show demo data warning if real APIs fail
      const demoWarning = await page.locator('text=Using Demo Data').isVisible({ timeout: 1000 }).catch(() => false)
      // This is expected behavior when backend isn't available
    }
  })
})
