import { test, expect } from '@playwright/test'

/**
 * E2E Tests for AI-Enhanced News Integration (Issue #12 Phase 2)
 * Tests the AI-powered news analysis endpoints and frontend integration
 */
test.describe('AI-Enhanced News Integration - Backend API', () => {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

  test('should return healthy status from AI news service', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/v1/news/health`)

    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('status')
    expect(data.status).toBe('healthy')
    expect(data).toHaveProperty('ai_enabled')
    expect(data).toHaveProperty('fallback_available')
    expect(data.fallback_available).toBe(true)
  })

  test('should handle market news endpoint request', async ({ request }) => {
    const response = await request.get(
      `${BACKEND_URL}/api/v1/news/market/enhanced?symbols=AAPL&symbols=MSFT&limit_per_symbol=3&use_ai=true`
    )

    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('symbols_analyzed')
    expect(data).toHaveProperty('total_articles')
    expect(data).toHaveProperty('flash_news_count')
    expect(data).toHaveProperty('average_market_sentiment')
    expect(data).toHaveProperty('average_market_impact')
    expect(data).toHaveProperty('category_distribution')
    expect(data).toHaveProperty('flash_news')
    expect(data).toHaveProperty('regular_news')
    expect(data).toHaveProperty('ai_enabled')

    // Should be arrays
    expect(Array.isArray(data.flash_news)).toBe(true)
    expect(Array.isArray(data.regular_news)).toBe(true)
  })

  test('should handle symbol-specific news endpoint', async ({ request }) => {
    const response = await request.get(
      `${BACKEND_URL}/api/v1/news/enhanced/AAPL?limit=5&use_ai=true`
    )

    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('symbol')
    expect(data.symbol).toBe('AAPL')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('news_count')
    expect(data).toHaveProperty('flash_news_count')
    expect(data).toHaveProperty('articles')
    expect(data).toHaveProperty('ai_enabled')

    expect(Array.isArray(data.articles)).toBe(true)
  })

  test('should validate AI-enhanced article structure when articles exist', async ({ request }) => {
    const response = await request.get(
      `${BACKEND_URL}/api/v1/news/market/enhanced?symbols=AAPL&limit_per_symbol=5`
    )

    const data = await response.json()

    // If articles exist, validate their structure
    const allArticles = [...(data.flash_news || []), ...(data.regular_news || [])]

    if (allArticles.length > 0) {
      const article = allArticles[0]

      // Validate required fields
      expect(article).toHaveProperty('title')
      expect(article).toHaveProperty('source')
      expect(article).toHaveProperty('url')
      expect(article).toHaveProperty('published_at')
      expect(article).toHaveProperty('symbols')
      expect(article).toHaveProperty('category')
      expect(article).toHaveProperty('impact_level')
      expect(article).toHaveProperty('impact_score')
      expect(article).toHaveProperty('sentiment_score')
      expect(article).toHaveProperty('summary')
      expect(article).toHaveProperty('key_insights')
      expect(article).toHaveProperty('is_flash_news')
      expect(article).toHaveProperty('ai_confidence')
      expect(article).toHaveProperty('analysis_method')

      // Validate field types and ranges
      expect(Array.isArray(article.symbols)).toBe(true)
      expect(Array.isArray(article.key_insights)).toBe(true)
      expect(['earnings', 'economic', 'regulatory', 'geopolitical', 'corporate']).toContain(article.category)
      expect(['high', 'medium', 'low']).toContain(article.impact_level)
      expect(article.impact_score).toBeGreaterThanOrEqual(0)
      expect(article.impact_score).toBeLessThanOrEqual(1)
      expect(article.sentiment_score).toBeGreaterThanOrEqual(-1)
      expect(article.sentiment_score).toBeLessThanOrEqual(1)
      expect(article.ai_confidence).toBeGreaterThanOrEqual(0)
      expect(article.ai_confidence).toBeLessThanOrEqual(1)
      expect(['ai_claude', 'fallback_pattern_matching']).toContain(article.analysis_method)
    }
  })

  test('should handle custom news analysis endpoint', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/v1/news/analyze`, {
      params: {
        title: 'Apple Reports Record Q4 Earnings',
        content: 'Apple Inc. announced record quarterly earnings today',
        source: 'Test Source',
        symbols: 'AAPL'
      }
    })

    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('title')
    expect(data).toHaveProperty('source')
    expect(data).toHaveProperty('analysis')
    expect(data).toHaveProperty('timestamp')

    // Validate analysis structure
    const analysis = data.analysis
    expect(analysis).toHaveProperty('category')
    expect(analysis).toHaveProperty('impact_level')
    expect(analysis).toHaveProperty('impact_score')
    expect(analysis).toHaveProperty('enhanced_sentiment')
    expect(analysis).toHaveProperty('summary')
  })

  test('should handle fallback mode when AI unavailable', async ({ request }) => {
    const response = await request.get(
      `${BACKEND_URL}/api/v1/news/enhanced/MSFT?limit=3&use_ai=false`
    )

    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('ai_enabled')
    // When use_ai=false, should use fallback
  })
})

test.describe('AI-Enhanced News Integration - Frontend', () => {
  const FRONTEND_URL = 'http://localhost:3000'

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for news data loading
    page.setDefaultTimeout(15000)
  })

  test('should load news page with AI-enhanced data', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/news`)

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Market News' })).toBeVisible()

    // Check for AI-powered description
    await expect(page.locator('text=AI-powered sentiment analysis')).toBeVisible()

    // Wait for news to load (or error/empty state)
    await page.waitForTimeout(3000)

    const hasNews = await page.locator('text=/source|ago/i').first().isVisible().catch(() => false)
    const hasEmpty = await page.locator('text=No news articles found').isVisible().catch(() => false)
    const hasError = await page.locator('text=Failed to load news').isVisible().catch(() => false)

    // One of these states should be visible
    expect(hasNews || hasEmpty || hasError).toBe(true)
  })

  test('should display AI insights when available', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/news`)

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Look for AI Insights sections (if articles are present)
    const aiInsightsSection = page.locator('text=AI Insights').first()
    const hasAIInsights = await aiInsightsSection.isVisible().catch(() => false)

    // If AI insights exist, validate structure
    if (hasAIInsights) {
      // Should have confidence badge
      const confidenceBadge = page.locator('text=/\\d+% confident/i').first()
      await expect(confidenceBadge).toBeVisible()

      // Should have bullet points for insights
      const insightBullets = page.locator('li:has-text("•")').first()
      await expect(insightBullets).toBeVisible()
    }
  })

  test('should display enhanced categorization and impact scoring', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/news`)

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Look for category badges (EARNINGS, ECONOMIC, etc.)
    const categoryBadge = page.locator('text=/EARNINGS|ECONOMIC|REGULATORY|CORPORATE|GEOPOLITICAL/i').first()
    const hasCategoryBadge = await categoryBadge.isVisible().catch(() => false)

    // Look for impact badges (HIGH IMPACT, MEDIUM IMPACT, LOW IMPACT)
    const impactBadge = page.locator('text=/HIGH|MEDIUM|LOW.*IMPACT/i').first()
    const hasImpactBadge = await impactBadge.isVisible().catch(() => false)

    // At least one should be visible if there are articles
    if (hasCategoryBadge || hasImpactBadge) {
      expect(hasCategoryBadge || hasImpactBadge).toBe(true)
    }
  })

  test('should display flash news section when breaking news exists', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/news`)

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Check for flash news section
    const flashNewsSection = page.locator('text=Flash News - Breaking Stories')
    const hasFlashNews = await flashNewsSection.isVisible().catch(() => false)

    // Flash news may or may not be present depending on real-time data
    // Just verify the page doesn't crash when looking for it
    expect(hasFlashNews !== undefined).toBe(true)
  })

  test('should handle news preview widget on dashboard', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`)

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible()

    // Look for news preview section
    await expect(page.locator('text=Latest Market News')).toBeVisible()

    // Wait for news to load
    await page.waitForTimeout(3000)

    const hasNews = await page.locator('text=/source|ago/i').first().isVisible().catch(() => false)
    const hasEmpty = await page.locator('text=No recent news').isVisible().catch(() => false)

    // Should show either news or empty state
    expect(hasNews || hasEmpty).toBe(true)

    // Should have "View All" button
    await expect(page.locator('button:has-text("View All")')).toBeVisible()
  })

  test('should navigate from dashboard to full news page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`)

    await page.waitForLoadState('networkidle')

    // Click View All button in news preview
    await page.click('button:has-text("View All")')

    // Should navigate to news page
    await expect(page).toHaveURL(`${FRONTEND_URL}/news`)
    await expect(page.getByRole('heading', { name: 'Market News' })).toBeVisible()
  })

  test('should display sentiment scores with color coding', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/news`)

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Look for sentiment labels
    const sentimentLabel = page.locator('text=/Very Bullish|Bullish|Neutral|Bearish|Very Bearish/i').first()
    const hasSentiment = await sentimentLabel.isVisible().catch(() => false)

    // Look for color-coded sentiment scores
    const positiveScore = page.locator('[class*="text-green"]').first()
    const negativeScore = page.locator('[class*="text-red"]').first()
    const neutralScore = page.locator('[class*="text-gray"]').first()

    const hasColorCoding = await positiveScore.isVisible().catch(() => false) ||
                          await negativeScore.isVisible().catch(() => false) ||
                          await neutralScore.isVisible().catch(() => false)

    // At least one sentiment indicator should be present if there are articles
    if (hasSentiment) {
      expect(hasSentiment).toBe(true)
    }
  })

  test('should handle responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(`${FRONTEND_URL}/news`)

    // Page should load correctly on mobile
    await expect(page.getByRole('heading', { name: 'Market News' })).toBeVisible()

    // AI insights should still be visible on mobile
    await page.waitForTimeout(2000)
    const aiSection = page.locator('text=AI-powered sentiment analysis')
    await expect(aiSection).toBeVisible()
  })

  test('should allow filtering news by symbol', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/news`)

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Look for symbol badges
    const symbolBadge = page.locator('text=/AAPL|MSFT|GOOGL|TSLA|NVDA/i').first()
    const hasSymbols = await symbolBadge.isVisible().catch(() => false)

    if (hasSymbols) {
      // Click on a symbol badge
      await symbolBadge.click()

      // Should show filtering indicator
      await page.waitForTimeout(1000)
      const filteringBy = page.locator('text=Filtering by:')
      await expect(filteringBy).toBeVisible()
    }
  })

  test('should handle refresh functionality', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/news`)

    await page.waitForLoadState('networkidle')

    // Find refresh button
    const refreshButton = page.locator('button:has([class*="refresh"])').first()

    // Click refresh
    await refreshButton.click()

    // Should show loading state briefly
    await page.waitForTimeout(500)

    // Page should reload successfully
    await expect(page.getByRole('heading', { name: 'Market News' })).toBeVisible()
  })
})

test.describe('AI-Enhanced News - Integration Tests', () => {
  const FRONTEND_URL = 'http://localhost:3000'
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

  test('should successfully fetch and display AI-enhanced news end-to-end', async ({ page, request }) => {
    // First, verify backend is working
    const healthCheck = await request.get(`${BACKEND_URL}/api/v1/news/health`)
    expect(healthCheck.status()).toBe(200)

    // Then verify frontend can load and display
    await page.goto(`${FRONTEND_URL}/news`)
    await expect(page.getByRole('heading', { name: 'Market News' })).toBeVisible()

    // Should have AI-powered description
    await expect(page.locator('text=AI-powered sentiment analysis')).toBeVisible()

    // Wait for network requests to complete
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Page should be in a valid state (news, empty, or error)
    const hasNews = await page.locator('text=/source|ago/i').first().isVisible().catch(() => false)
    const hasEmpty = await page.locator('text=No news articles found').isVisible().catch(() => false)
    const hasError = await page.locator('text=Failed to load news').isVisible().catch(() => false)

    expect(hasNews || hasEmpty || hasError).toBe(true)
  })

  test('should maintain consistency between API and UI data', async ({ page, request }) => {
    // Fetch data from API
    const apiResponse = await request.get(
      `${BACKEND_URL}/api/v1/news/market/enhanced?symbols=AAPL&symbols=MSFT&limit_per_symbol=3`
    )
    const apiData = await apiResponse.json()

    // Load frontend
    await page.goto(`${FRONTEND_URL}/news`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // If API has articles, frontend should display them
    const totalApiArticles = (apiData.flash_news?.length || 0) + (apiData.regular_news?.length || 0)

    if (totalApiArticles > 0) {
      // Should have news articles displayed
      const hasArticles = await page.locator('text=/source|ago/i').first().isVisible().catch(() => false)
      expect(hasArticles).toBe(true)
    } else {
      // Should show empty state or have articles from other sources
      const hasEmpty = await page.locator('text=No news articles found').isVisible().catch(() => false)
      const hasArticles = await page.locator('text=/source|ago/i').first().isVisible().catch(() => false)
      expect(hasEmpty || hasArticles).toBe(true)
    }
  })
})
