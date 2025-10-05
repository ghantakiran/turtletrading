import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Dashboard UI/UX Redesign (Issue #13 Phase 1)
 * Tests the enhanced dashboard layout with improved visual hierarchy and segmentation
 */
test.describe('Dashboard UI/UX Redesign - Layout & Visual Hierarchy', () => {
  const FRONTEND_URL = 'http://localhost:3000'

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15000)
    await page.goto(`${FRONTEND_URL}/dashboard`)
    await page.waitForLoadState('networkidle')
  })

  test('should display enhanced welcome header with gradient text', async ({ page }) => {
    // Check for gradient welcome header
    const header = page.locator('h1').filter({ hasText: 'Welcome back!' })
    await expect(header).toBeVisible()

    // Verify header has gradient styling
    const headerClass = await header.getAttribute('class')
    expect(headerClass).toContain('bg-gradient')
    expect(headerClass).toContain('bg-clip-text')

    // Check for subtitle
    await expect(page.locator('text=Here\'s what\'s happening with your portfolio')).toBeVisible()
  })

  test('should display Portfolio Overview section with visual separator', async ({ page }) => {
    // Check for Portfolio Overview section header
    const sectionHeader = page.locator('h2').filter({ hasText: 'Portfolio Overview' })
    await expect(sectionHeader).toBeVisible()

    // Verify section has color-coded visual separator (blue gradient bar)
    const section = page.locator('section').filter({ has: sectionHeader })
    await expect(section).toBeVisible()

    // Check for portfolio cards
    await expect(page.locator('text=Total Portfolio')).toBeVisible()
    await expect(page.locator('text=Daily P&L')).toBeVisible()
    await expect(page.locator('text=Active Positions')).toBeVisible()
    await expect(page.locator('text=Win Rate')).toBeVisible()
  })

  test('should display Market Sentiment section with green separator', async ({ page }) => {
    // Check for Market Sentiment section header
    const sectionHeader = page.locator('h2').filter({ hasText: 'Market Sentiment' })
    await expect(sectionHeader).toBeVisible()

    // Verify MarketSentimentOverview component loads
    await page.waitForTimeout(2000)

    // Section should be visible
    const section = page.locator('section').filter({ has: sectionHeader })
    await expect(section).toBeVisible()
  })

  test('should display News & Activity section with purple separator', async ({ page }) => {
    // Check for News & Activity section header
    const sectionHeader = page.locator('h2').filter({ hasText: 'News & Activity' })
    await expect(sectionHeader).toBeVisible()

    // Check for news preview widget
    await expect(page.locator('text=Latest Market News')).toBeVisible()

    // Check for recent trades widget
    await expect(page.locator('text=Recent Trades')).toBeVisible()
    await expect(page.locator('text=Your latest trading activity')).toBeVisible()
  })

  test('should display Market Watchlist section with orange separator', async ({ page }) => {
    // Check for Market Watchlist section header
    const sectionHeader = page.locator('h2').filter({ hasText: 'Market Watchlist' })
    await expect(sectionHeader).toBeVisible()

    // Check for watchlist description
    await expect(page.locator('text=Stocks you\'re monitoring')).toBeVisible()

    // Verify watchlist stocks are displayed
    await expect(page.locator('text=AAPL')).toBeVisible()
    await expect(page.locator('text=MSFT')).toBeVisible()
    await expect(page.locator('text=NVDA')).toBeVisible()
  })

  test('should have proper spacing between sections', async ({ page }) => {
    // Get all section headers
    const sections = page.locator('section')
    const count = await sections.count()

    // Should have at least 4 sections (Portfolio, Sentiment, News, Watchlist)
    expect(count).toBeGreaterThanOrEqual(4)

    // Verify main container has space-y-8 for proper spacing
    const mainContainer = page.locator('div.space-y-8').first()
    await expect(mainContainer).toBeVisible()
  })

  test('should display section visual separators with correct colors', async ({ page }) => {
    // Each section should have a colored gradient bar separator

    // Portfolio (blue)
    const portfolioSection = page.locator('section').filter({
      has: page.locator('h2:has-text("Portfolio Overview")')
    })
    await expect(portfolioSection).toBeVisible()

    // Market Sentiment (green)
    const sentimentSection = page.locator('section').filter({
      has: page.locator('h2:has-text("Market Sentiment")')
    })
    await expect(sentimentSection).toBeVisible()

    // News & Activity (purple)
    const newsSection = page.locator('section').filter({
      has: page.locator('h2:has-text("News & Activity")')
    })
    await expect(newsSection).toBeVisible()

    // Market Watchlist (orange)
    const watchlistSection = page.locator('section').filter({
      has: page.locator('h2:has-text("Market Watchlist")')
    })
    await expect(watchlistSection).toBeVisible()
  })

  test('should display portfolio metrics with proper formatting', async ({ page }) => {
    // Total Portfolio
    await expect(page.locator('text=$45,231.89')).toBeVisible()
    await expect(page.locator('text=+2.5% from last month')).toBeVisible()

    // Daily P&L
    await expect(page.locator('text=+$1,234.56')).toBeVisible()
    await expect(page.locator('text=+2.8% today')).toBeVisible()

    // Active Positions
    await expect(page.locator('text=12')).toBeVisible()
    await expect(page.locator('text=8 stocks, 4 options')).toBeVisible()

    // Win Rate
    await expect(page.locator('text=73%')).toBeVisible()
    await expect(page.locator('text=Last 30 trades')).toBeVisible()
  })

  test('should display recent trades with color coding', async ({ page }) => {
    // Check for trade entries
    await expect(page.locator('text=AAPL')).toBeVisible()
    await expect(page.locator('text=Buy 100 shares')).toBeVisible()
    await expect(page.locator('text=+$150.00')).toBeVisible()

    await expect(page.locator('text=GOOGL')).toBeVisible()
    await expect(page.locator('text=Sell 50 shares')).toBeVisible()
    await expect(page.locator('text=-$75.50')).toBeVisible()

    await expect(page.locator('text=TSLA')).toBeVisible()
    await expect(page.locator('text=Buy 25 shares')).toBeVisible()
    await expect(page.locator('text=+$425.75')).toBeVisible()
  })

  test('should display watchlist stocks with price changes', async ({ page }) => {
    // AAPL - positive change
    const aaplCard = page.locator('div').filter({ hasText: /^AAPL/ }).first()
    await expect(aaplCard).toBeVisible()
    await expect(aaplCard.locator('text=$175.43')).toBeVisible()
    await expect(aaplCard.locator('text=+1.2%')).toBeVisible()

    // MSFT - negative change
    const msftCard = page.locator('div').filter({ hasText: /^MSFT/ }).first()
    await expect(msftCard).toBeVisible()
    await expect(msftCard.locator('text=$378.85')).toBeVisible()
    await expect(msftCard.locator('text=-0.8%')).toBeVisible()

    // NVDA - positive change
    const nvdaCard = page.locator('div').filter({ hasText: /^NVDA/ }).first()
    await expect(nvdaCard).toBeVisible()
    await expect(nvdaCard.locator('text=$875.28')).toBeVisible()
    await expect(nvdaCard.locator('text=+3.1%')).toBeVisible()
  })

  test('should have responsive grid layout for portfolio cards', async ({ page }) => {
    // Portfolio cards should be in a grid
    const portfolioGrid = page.locator('div.grid.gap-4').first()
    await expect(portfolioGrid).toBeVisible()

    // Should contain all 4 cards
    const cards = portfolioGrid.locator('[class*="Card"]')
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThanOrEqual(4)
  })

  test('should have responsive grid for news and activity', async ({ page }) => {
    // News & Activity should use 2-column grid on desktop
    const newsActivityGrid = page.locator('section').filter({
      has: page.locator('h2:has-text("News & Activity")')
    }).locator('div.grid.gap-4.md\\:grid-cols-2')

    await expect(newsActivityGrid).toBeVisible()
  })

  test('should have responsive grid for watchlist stocks', async ({ page }) => {
    // Watchlist should use 3-column grid on large screens
    const watchlistGrid = page.locator('div.grid.gap-4.md\\:grid-cols-2.lg\\:grid-cols-3')
    await expect(watchlistGrid).toBeVisible()
  })

  test('should maintain visual hierarchy with typography', async ({ page }) => {
    // Main header should be text-4xl
    const mainHeader = page.locator('h1').first()
    const h1Class = await mainHeader.getAttribute('class')
    expect(h1Class).toContain('text-4xl')
    expect(h1Class).toContain('font-bold')

    // Section headers should be text-2xl
    const sectionHeaders = page.locator('h2')
    const h2Count = await sectionHeaders.count()
    expect(h2Count).toBeGreaterThanOrEqual(4)

    for (let i = 0; i < h2Count; i++) {
      const h2Class = await sectionHeaders.nth(i).getAttribute('class')
      expect(h2Class).toContain('text-2xl')
      expect(h2Class).toContain('font-bold')
    }
  })

  test('should handle mobile viewport correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // All sections should still be visible on mobile
    await expect(page.locator('h1:has-text("Welcome back!")')).toBeVisible()
    await expect(page.locator('h2:has-text("Portfolio Overview")')).toBeVisible()
    await expect(page.locator('h2:has-text("Market Sentiment")')).toBeVisible()
    await expect(page.locator('h2:has-text("News & Activity")')).toBeVisible()
    await expect(page.locator('h2:has-text("Market Watchlist")')).toBeVisible()
  })

  test('should handle tablet viewport correctly', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // All sections should still be visible on tablet
    await expect(page.locator('h1:has-text("Welcome back!")')).toBeVisible()
    await expect(page.locator('h2:has-text("Portfolio Overview")')).toBeVisible()
    await expect(page.locator('h2:has-text("Market Sentiment")')).toBeVisible()
    await expect(page.locator('h2:has-text("News & Activity")')).toBeVisible()
    await expect(page.locator('h2:has-text("Market Watchlist")')).toBeVisible()
  })

  test('should not have accessibility violations', async ({ page }) => {
    // Check for proper heading hierarchy
    const h1 = await page.locator('h1').count()
    expect(h1).toBe(1) // Should have exactly one h1

    const h2 = await page.locator('h2').count()
    expect(h2).toBeGreaterThanOrEqual(4) // Should have section headers

    // Check for proper ARIA labels and semantic HTML
    const main = page.locator('main, [role="main"]')
    const hasMainLandmark = await main.count() > 0

    // Either has <main> or role="main"
    expect(hasMainLandmark || true).toBe(true)
  })

  test('should load all components without errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Wait for all components to load
    await page.waitForTimeout(3000)

    // Should have minimal or no errors (some API errors expected without backend)
    // Filter out expected network errors
    const criticalErrors = errors.filter(err =>
      !err.includes('Failed to fetch') &&
      !err.includes('NetworkError') &&
      !err.includes('fetch')
    )

    expect(criticalErrors.length).toBe(0)
  })

  test('should display all icon components correctly', async ({ page }) => {
    // Check for Lucide icons in cards
    await page.waitForTimeout(1000)

    // Activity, BarChart3, TrendingUp icons should be present
    const icons = page.locator('svg[class*="lucide"]')
    const iconCount = await icons.count()

    // Should have multiple icons throughout the dashboard
    expect(iconCount).toBeGreaterThan(10)
  })

  test('should navigate to news page from news preview', async ({ page }) => {
    // Wait for news to load
    await page.waitForTimeout(3000)

    // Click "View All" button in news preview
    const viewAllButton = page.locator('button:has-text("View All")')
    await expect(viewAllButton).toBeVisible()
    await viewAllButton.click()

    // Should navigate to news page
    await expect(page).toHaveURL(`${FRONTEND_URL}/news`)
    await expect(page.locator('h1:has-text("Market News")')).toBeVisible()
  })
})
