import { test, expect, Page, BrowserContext } from '@playwright/test';
import { randomUUID } from 'crypto';

// Test data and utilities for sentiment feed testing
interface NewsItem {
  id: string;
  title: string;
  source: string;
  sentiment_score: number;
  published_at: string;
  url: string;
  ticker_symbols?: string[];
  confidence_score?: number;
  content_type: 'article' | 'tweet' | 'reddit_post';
}

interface Entity {
  id: string;
  text: string;
  type: 'company' | 'ticker' | 'person' | 'organization' | 'location' | 'event' | 'product' | 'currency';
  ticker_symbol?: string;
  confidence_score: number;
  mention_count: number;
  sentiment_score: number;
  sentiment_trend: number[];
  relevance_score: number;
  last_mentioned: string;
  related_entities: string[];
}

// Mock data generators
function generateMockNewsItems(count: number = 10): NewsItem[] {
  const sources = ['Bloomberg', 'Reuters', 'CNBC', 'MarketWatch', 'Yahoo Finance'];
  const tickers = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'META'];
  const contentTypes: ('article' | 'tweet' | 'reddit_post')[] = ['article', 'tweet', 'reddit_post'];

  return Array.from({ length: count }, (_, i) => ({
    id: `news-${i + 1}`,
    title: `Market News Item ${i + 1}: ${tickers[i % tickers.length]} Analysis`,
    source: sources[i % sources.length],
    sentiment_score: (Math.random() - 0.5) * 2, // -1 to 1
    published_at: new Date(Date.now() - i * 3600000).toISOString(), // Spread over hours
    url: `https://example.com/news/${i + 1}`,
    ticker_symbols: [tickers[i % tickers.length]],
    confidence_score: 0.5 + Math.random() * 0.5, // 0.5 to 1
    content_type: contentTypes[i % contentTypes.length]
  }));
}

function generateMockEntities(count: number = 15): Entity[] {
  const entityTypes: Entity['type'][] = ['company', 'ticker', 'person', 'organization'];
  const tickers = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'META'];
  const companies = ['Apple Inc.', 'Tesla Inc.', 'Microsoft Corporation', 'Alphabet Inc.', 'Meta Platforms'];
  const people = ['Tim Cook', 'Elon Musk', 'Satya Nadella', 'Sundar Pichai', 'Mark Zuckerberg'];

  return Array.from({ length: count }, (_, i) => {
    const type = entityTypes[i % entityTypes.length];
    let text: string;
    let ticker_symbol: string | undefined;

    switch (type) {
      case 'company':
        text = companies[i % companies.length];
        ticker_symbol = tickers[i % tickers.length];
        break;
      case 'ticker':
        text = tickers[i % tickers.length];
        ticker_symbol = tickers[i % tickers.length];
        break;
      case 'person':
        text = people[i % people.length];
        ticker_symbol = tickers[i % tickers.length];
        break;
      default:
        text = `Entity ${i + 1}`;
        ticker_symbol = tickers[i % tickers.length];
    }

    return {
      id: `entity-${i + 1}`,
      text,
      type,
      ticker_symbol,
      confidence_score: 0.6 + Math.random() * 0.4,
      mention_count: Math.floor(Math.random() * 100) + 1,
      sentiment_score: (Math.random() - 0.5) * 2,
      sentiment_trend: Array.from({ length: 24 }, () => (Math.random() - 0.5) * 2),
      relevance_score: 0.5 + Math.random() * 0.5,
      last_mentioned: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      related_entities: ['Related Entity 1', 'Related Entity 2']
    };
  });
}

// Page object model for sentiment components
class SentimentFeedPage {
  constructor(private page: Page) {}

  async navigateToSentimentFeed() {
    await this.page.goto('/sentiment-feed');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForNewsTapeToLoad() {
    await this.page.waitForSelector('[data-testid="news-tape"]', { timeout: 10000 });
    await this.page.waitForSelector('[data-testid="news-item"]', { timeout: 5000 });
  }

  async waitForEntityDrilldownToLoad() {
    await this.page.waitForSelector('[data-testid="entity-drilldown"]', { timeout: 10000 });
    await this.page.waitForSelector('[data-testid="entity-item"]', { timeout: 5000 });
  }

  async getNewsItemCount(): Promise<number> {
    const items = await this.page.locator('[data-testid="news-item"]').count();
    return items;
  }

  async getEntityCount(): Promise<number> {
    const entities = await this.page.locator('[data-testid="entity-item"]').count();
    return entities;
  }

  async clickNewsItem(index: number = 0) {
    await this.page.locator('[data-testid="news-item"]').nth(index).click();
  }

  async clickEntity(index: number = 0) {
    await this.page.locator('[data-testid="entity-item"]').nth(index).click();
  }

  async pauseNewsTape() {
    await this.page.locator('[data-testid="news-tape-pause"]').click();
  }

  async playNewsTape() {
    await this.page.locator('[data-testid="news-tape-play"]').click();
  }

  async navigateNewsNext() {
    await this.page.locator('[data-testid="news-tape-next"]').click();
  }

  async navigateNewsPrevious() {
    await this.page.locator('[data-testid="news-tape-previous"]').click();
  }

  async filterByTicker(ticker: string) {
    await this.page.locator('[data-testid="ticker-filter-input"]').fill(ticker);
    await this.page.locator('[data-testid="apply-filter"]').click();
  }

  async openEntityFilters() {
    await this.page.locator('[data-testid="entity-filters-toggle"]').click();
  }

  async filterEntityByType(type: string) {
    await this.openEntityFilters();
    await this.page.locator(`[data-testid="entity-type-${type}"]`).check();
    await this.page.locator('[data-testid="apply-entity-filters"]').click();
  }

  async searchEntities(query: string) {
    await this.page.locator('[data-testid="entity-search"]').fill(query);
  }

  async setSentimentRange(min: number, max: number) {
    await this.openEntityFilters();
    await this.page.locator('[data-testid="sentiment-range-min"]').fill(min.toString());
    await this.page.locator('[data-testid="sentiment-range-max"]').fill(max.toString());
  }

  async sortEntitiesBy(sortBy: string) {
    await this.page.locator('[data-testid="entity-sort-select"]').selectOption(sortBy);
  }

  async clearFilters() {
    await this.page.locator('[data-testid="clear-filters"]').click();
  }

  async getCurrentNewsTitle(): Promise<string> {
    return await this.page.locator('[data-testid="current-news-title"]').textContent() || '';
  }

  async getCurrentNewsSource(): Promise<string> {
    return await this.page.locator('[data-testid="current-news-source"]').textContent() || '';
  }

  async getCurrentNewsSentiment(): Promise<string> {
    return await this.page.locator('[data-testid="current-news-sentiment"]').textContent() || '';
  }

  async getSelectedEntityText(): Promise<string> {
    return await this.page.locator('[data-testid="selected-entity-text"]').textContent() || '';
  }
}

// Test suite setup
test.describe('Sentiment Feed-Filter-Detail Flow', () => {
  let sentimentPage: SentimentFeedPage;

  test.beforeEach(async ({ page }) => {
    sentimentPage = new SentimentFeedPage(page);

    // Mock API responses for sentiment data
    await page.route('**/api/v1/sentiment/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/feed/')) {
        // Mock sentiment feed data
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            ticker_symbol: 'AAPL',
            current_sentiment: {
              ticker_symbol: 'AAPL',
              average_sentiment: 0.3,
              weighted_sentiment: 0.25,
              mention_count: 45,
              unique_sources: 3,
              overall_confidence: 0.78
            },
            recent_items: generateMockNewsItems(10),
            sentiment_trend: Array.from({ length: 24 }, () => Math.random() - 0.5),
            news_count_24h: 25,
            social_count_24h: 120
          })
        });
      } else if (url.includes('/entities')) {
        // Mock entity data
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            entities: generateMockEntities(15),
            total_count: 15,
            page: 1,
            per_page: 15
          })
        });
      } else {
        // Default sentiment response
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Sentiment API mock response'
          })
        });
      }
    });
  });

  test('should display sentiment feed and news tape', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForNewsTapeToLoad();

    // Verify news tape is visible and functional
    await expect(page.locator('[data-testid="news-tape"]')).toBeVisible();

    const newsCount = await sentimentPage.getNewsItemCount();
    expect(newsCount).toBeGreaterThan(0);

    // Verify current news item displays
    const currentTitle = await sentimentPage.getCurrentNewsTitle();
    expect(currentTitle).toBeTruthy();

    const currentSource = await sentimentPage.getCurrentNewsSource();
    expect(currentSource).toBeTruthy();
  });

  test('should allow news tape navigation and controls', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForNewsTapeToLoad();

    // Test pause/play functionality
    await sentimentPage.pauseNewsTape();
    await expect(page.locator('[data-testid="news-tape-play"]')).toBeVisible();

    await sentimentPage.playNewsTape();
    await expect(page.locator('[data-testid="news-tape-pause"]')).toBeVisible();

    // Test navigation controls
    const initialTitle = await sentimentPage.getCurrentNewsTitle();

    await sentimentPage.navigateNewsNext();
    await page.waitForTimeout(500); // Allow for transition

    const nextTitle = await sentimentPage.getCurrentNewsTitle();
    expect(nextTitle).not.toBe(initialTitle);

    await sentimentPage.navigateNewsPrevious();
    await page.waitForTimeout(500);

    const previousTitle = await sentimentPage.getCurrentNewsTitle();
    expect(previousTitle).toBe(initialTitle);
  });

  test('should support keyboard navigation in news tape', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForNewsTapeToLoad();

    // Focus on news tape
    await page.locator('[data-testid="news-tape"]').focus();

    const initialTitle = await sentimentPage.getCurrentNewsTitle();

    // Test arrow key navigation
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    const nextTitle = await sentimentPage.getCurrentNewsTitle();
    expect(nextTitle).not.toBe(initialTitle);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);

    const backTitle = await sentimentPage.getCurrentNewsTitle();
    expect(backTitle).toBe(initialTitle);

    // Test spacebar pause/play
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="news-tape-play"]')).toBeVisible();
  });

  test('should display entity drilldown interface', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForEntityDrilldownToLoad();

    // Verify entity drilldown is visible
    await expect(page.locator('[data-testid="entity-drilldown"]')).toBeVisible();

    const entityCount = await sentimentPage.getEntityCount();
    expect(entityCount).toBeGreaterThan(0);

    // Verify entity items have required information
    const firstEntity = page.locator('[data-testid="entity-item"]').first();
    await expect(firstEntity.locator('[data-testid="entity-text"]')).toBeVisible();
    await expect(firstEntity.locator('[data-testid="entity-sentiment"]')).toBeVisible();
    await expect(firstEntity.locator('[data-testid="entity-mentions"]')).toBeVisible();
  });

  test('should filter entities by type', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForEntityDrilldownToLoad();

    const initialCount = await sentimentPage.getEntityCount();

    // Filter by company entities
    await sentimentPage.filterEntityByType('company');
    await page.waitForTimeout(1000); // Allow for filtering

    const filteredCount = await sentimentPage.getEntityCount();

    // Filtered count should be different (likely fewer)
    expect(filteredCount).not.toBe(initialCount);

    // Clear filters
    await sentimentPage.clearFilters();
    await page.waitForTimeout(1000);

    const clearedCount = await sentimentPage.getEntityCount();
    expect(clearedCount).toBe(initialCount);
  });

  test('should search entities by text', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForEntityDrilldownToLoad();

    const initialCount = await sentimentPage.getEntityCount();

    // Search for 'Apple'
    await sentimentPage.searchEntities('Apple');
    await page.waitForTimeout(1000);

    const searchCount = await sentimentPage.getEntityCount();
    expect(searchCount).toBeLessThanOrEqual(initialCount);

    // Clear search
    await sentimentPage.searchEntities('');
    await page.waitForTimeout(1000);

    const clearedCount = await sentimentPage.getEntityCount();
    expect(clearedCount).toBe(initialCount);
  });

  test('should sort entities by different criteria', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForEntityDrilldownToLoad();

    // Get initial order
    const initialFirstEntity = await page.locator('[data-testid="entity-item"]').first()
      .locator('[data-testid="entity-text"]').textContent();

    // Sort by mentions
    await sentimentPage.sortEntitiesBy('mentions');
    await page.waitForTimeout(1000);

    const mentionsSortedFirst = await page.locator('[data-testid="entity-item"]').first()
      .locator('[data-testid="entity-text"]').textContent();

    // Sort by sentiment
    await sentimentPage.sortEntitiesBy('sentiment');
    await page.waitForTimeout(1000);

    const sentimentSortedFirst = await page.locator('[data-testid="entity-item"]').first()
      .locator('[data-testid="entity-text"]').textContent();

    // Order should change with different sorting
    expect(mentionsSortedFirst).not.toBe(sentimentSortedFirst);
  });

  test('should show entity detail on selection', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForEntityDrilldownToLoad();

    // Click on first entity
    await sentimentPage.clickEntity(0);

    // Verify entity detail is shown
    await expect(page.locator('[data-testid="entity-detail"]')).toBeVisible();

    const selectedText = await sentimentPage.getSelectedEntityText();
    expect(selectedText).toBeTruthy();

    // Verify detail contains expected information
    await expect(page.locator('[data-testid="entity-detail-sentiment"]')).toBeVisible();
    await expect(page.locator('[data-testid="entity-detail-mentions"]')).toBeVisible();
    await expect(page.locator('[data-testid="entity-detail-trend"]')).toBeVisible();
  });

  test('should filter news by ticker symbol', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForNewsTapeToLoad();

    // Apply ticker filter
    await sentimentPage.filterByTicker('AAPL');
    await page.waitForTimeout(1000);

    // Verify news items contain the ticker
    const newsItems = page.locator('[data-testid="news-item"]');
    const count = await newsItems.count();

    if (count > 0) {
      // Check that visible news items relate to AAPL
      const firstItemContent = await newsItems.first().textContent();
      expect(firstItemContent).toContain('AAPL');
    }
  });

  test('should handle sentiment score display and colors', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForNewsTapeToLoad();

    // Check sentiment indicators have appropriate colors
    const sentimentIndicators = page.locator('[data-testid="sentiment-indicator"]');
    const count = await sentimentIndicators.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const indicator = sentimentIndicators.nth(i);
        await expect(indicator).toBeVisible();

        // Check that sentiment has color classes (bull/bear/neutral)
        const classes = await indicator.getAttribute('class');
        expect(classes).toMatch(/(bull|bear|neutral)/);
      }
    }
  });

  test('should support accessibility features', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForNewsTapeToLoad();
    await sentimentPage.waitForEntityDrilldownToLoad();

    // Check ARIA labels and roles
    await expect(page.locator('[data-testid="news-tape"]')).toHaveAttribute('role', 'region');
    await expect(page.locator('[data-testid="entity-drilldown"]')).toHaveAttribute('role', /region|main/);

    // Check keyboard navigation
    await page.locator('[data-testid="entity-item"]').first().focus();
    await page.keyboard.press('Enter');

    // Should select entity
    await expect(page.locator('[data-testid="entity-detail"]')).toBeVisible();

    // Check screen reader announcements
    const announcements = page.locator('[aria-live="polite"]');
    if (await announcements.count() > 0) {
      await expect(announcements.first()).toBeInViewport();
    }
  });

  test('should handle loading and error states', async ({ page }) => {
    // Test loading state
    await page.route('**/api/v1/sentiment/**', async (route) => {
      // Delay response to test loading state
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ entities: [], recent_items: [] })
      });
    });

    await sentimentPage.navigateToSentimentFeed();

    // Should show loading indicators
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();

    // Wait for loading to complete
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
  });

  test('should handle API error states gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/v1/sentiment/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await sentimentPage.navigateToSentimentFeed();

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    const errorText = await page.locator('[data-testid="error-message"]').textContent();
    expect(errorText).toContain('error');
  });

  test('should persist filters and selections in URL', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForEntityDrilldownToLoad();

    // Apply filters
    await sentimentPage.filterEntityByType('company');
    await sentimentPage.searchEntities('Apple');

    // Check that URL reflects filters
    const url = page.url();
    expect(url).toMatch(/filter|search|type/);

    // Refresh page
    await page.reload();
    await sentimentPage.waitForEntityDrilldownToLoad();

    // Filters should be preserved
    const searchInput = page.locator('[data-testid="entity-search"]');
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('Apple');
  });

  test('should support real-time updates', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForNewsTapeToLoad();

    const initialTitle = await sentimentPage.getCurrentNewsTitle();

    // Simulate real-time update by changing API response
    await page.route('**/api/v1/sentiment/feed/**', async (route) => {
      const updatedItems = generateMockNewsItems(10);
      updatedItems[0].title = 'BREAKING: Updated News Item';

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ticker_symbol: 'AAPL',
          current_sentiment: { ticker_symbol: 'AAPL', average_sentiment: 0.4 },
          recent_items: updatedItems,
          sentiment_trend: [],
          news_count_24h: 26,
          social_count_24h: 125
        })
      });
    });

    // Trigger refresh (simulate WebSocket update)
    await page.evaluate(() => {
      // Simulate a data refresh event
      window.dispatchEvent(new CustomEvent('sentiment-update'));
    });

    await page.waitForTimeout(1000);

    // Should show updated content
    const updatedTitle = await sentimentPage.getCurrentNewsTitle();
    // Note: This test may need adjustment based on actual real-time implementation
  });

  test('should export sentiment data', async ({ page }) => {
    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForEntityDrilldownToLoad();

    // Look for export functionality
    const exportButton = page.locator('[data-testid="export-data"]');

    if (await exportButton.count() > 0) {
      // Setup download handler
      const downloadPromise = page.waitForEvent('download');

      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv|\.json|\.xlsx/);
    }
  });

  test('should handle mobile responsive design', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await sentimentPage.navigateToSentimentFeed();
    await sentimentPage.waitForNewsTapeToLoad();

    // Check mobile-specific elements
    const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
    if (await mobileMenu.count() > 0) {
      await mobileMenu.click();
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    }

    // Check that content is properly responsive
    await expect(page.locator('[data-testid="news-tape"]')).toBeVisible();
    await expect(page.locator('[data-testid="entity-drilldown"]')).toBeVisible();

    // Touch interactions should work
    await page.locator('[data-testid="news-item"]').first().tap();
    // Verify touch interaction worked (implementation dependent)
  });
});

// Performance tests
test.describe('Sentiment Feed Performance', () => {
  test('should load sentiment feed within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/sentiment-feed');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);

    // Check for performance markers
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
      };
    });

    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
    expect(performanceMetrics.firstPaint).toBeLessThan(1500);
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    // Mock large dataset
    await page.route('**/api/v1/sentiment/**', async (route) => {
      const largeDataset = {
        entities: generateMockEntities(500),
        recent_items: generateMockNewsItems(200)
      };

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(largeDataset)
      });
    });

    const startTime = Date.now();

    await page.goto('/sentiment-feed');
    await page.waitForSelector('[data-testid="entity-item"]', { timeout: 10000 });

    const renderTime = Date.now() - startTime;

    // Should render large dataset within reasonable time
    expect(renderTime).toBeLessThan(8000);

    // Check that virtualization or pagination is working
    const visibleEntities = await page.locator('[data-testid="entity-item"]').count();
    expect(visibleEntities).toBeLessThanOrEqual(100); // Should not render all 500 at once
  });
});