/**
 * Complete Stock Analysis Flow E2E Tests
 * Per IMPLEMENT_FROM_DOCS_FILLED.md: docs/claude/tests/integration/stock_analysis_flow.md
 * Tests the complete user journey from authentication to stock analysis results
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Test configuration
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3001';

interface TestUser {
  email: string;
  password: string;
  tier: 'free' | 'pro' | 'enterprise';
}

const testUsers: Record<string, TestUser> = {
  basic: {
    email: 'basic@turtletrading.com',
    password: 'BasicUser123!',
    tier: 'free'
  },
  pro: {
    email: 'pro@turtletrading.com',
    password: 'ProUser123!',
    tier: 'pro'
  }
};

// Helper functions
async function authenticateUser(page: Page, user: TestUser): Promise<string> {
  // Direct API authentication for reliable token
  const response = await page.request.post(`${API_BASE_URL}/api/v1/auth/token`, {
    data: {
      email: user.email,
      password: user.password
    }
  });

  if (response.ok()) {
    const authData = await response.json();
    return authData.access_token;
  }

  throw new Error(`Authentication failed for ${user.email}: ${response.status()}`);
}

async function navigateToStockAnalysis(page: Page, symbol: string): Promise<void> {
  await page.goto(`${FRONTEND_URL}/stock/${symbol}`);
  await page.waitForLoadState('networkidle');
}

async function waitForAnalysisResults(page: Page): Promise<void> {
  // Wait for analysis components to load
  await expect(page.locator('[data-testid="technical-indicators"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="lstm-prediction"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="sentiment-analysis"]')).toBeVisible({ timeout: 10000 });
}

test.describe('Complete Stock Analysis Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });

    // Mock external API calls for consistent testing
    await page.route('**/api/v1/stocks/*/analysis', async route => {
      const url = route.request().url();
      const symbol = url.match(/stocks\/([^\/]+)\/analysis/)?.[1] || 'AAPL';

      const mockAnalysis = {
        symbol,
        technical_score: 0.65,
        lstm_prediction: {
          predictions: [
            { date: '2024-01-16', predicted_price: 152.30, confidence: 0.78 },
            { date: '2024-01-17', predicted_price: 153.80, confidence: 0.75 }
          ],
          trend_direction: 'bullish',
          confidence_interval: { lower: 145.0, upper: 165.0 }
        },
        sentiment_score: 0.25,
        confidence: 0.75,
        recommendation: 'BUY',
        data_sources: {
          primary: 'yfinance',
          fallback_used: false
        },
        user_tier: 'pro',
        real_time_price: {
          current: 150.50,
          change: 1.50,
          change_percent: 1.01
        }
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAnalysis)
      });
    });
  });

  test('Happy Path: Complete Stock Analysis Flow for Pro User', async ({ page }) => {
    /**
     * Given: Authenticated pro user requests analysis for AAPL
     * When: Full analysis pipeline executes
     * Then: Return comprehensive analysis with 75%+ confidence scores
     */

    // Arrange - Authenticate pro user
    const user = testUsers.pro;
    const token = await authenticateUser(page, user);

    // Store token in localStorage for frontend use
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user_tier', 'pro');
    }, token);

    // Act - Navigate to stock analysis page
    await navigateToStockAnalysis(page, 'AAPL');

    // Wait for analysis to complete
    await waitForAnalysisResults(page);

    // Assert - Verify analysis components are displayed
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('AAPL');

    // Technical analysis section
    const technicalSection = page.locator('[data-testid="technical-indicators"]');
    await expect(technicalSection).toBeVisible();
    await expect(technicalSection.locator('[data-testid="rsi-value"]')).toBeVisible();
    await expect(technicalSection.locator('[data-testid="macd-value"]')).toBeVisible();
    await expect(technicalSection.locator('[data-testid="technical-score"]')).toContainText('65');

    // LSTM prediction section (pro user feature)
    const lstmSection = page.locator('[data-testid="lstm-prediction"]');
    await expect(lstmSection).toBeVisible();
    await expect(lstmSection.locator('[data-testid="prediction-chart"]')).toBeVisible();
    await expect(lstmSection.locator('[data-testid="trend-direction"]')).toContainText('bullish');

    // Sentiment analysis section
    const sentimentSection = page.locator('[data-testid="sentiment-analysis"]');
    await expect(sentimentSection).toBeVisible();
    await expect(sentimentSection.locator('[data-testid="sentiment-score"]')).toBeVisible();

    // Final recommendation
    const recommendationSection = page.locator('[data-testid="recommendation"]');
    await expect(recommendationSection).toBeVisible();
    await expect(recommendationSection.locator('[data-testid="recommendation-action"]')).toContainText('BUY');
    await expect(recommendationSection.locator('[data-testid="confidence-score"]')).toContainText('75');

    // Verify data sources information
    await expect(page.locator('[data-testid="data-source-primary"]')).toContainText('yfinance');
  });

  test('Data Source Failover: Primary API Unavailable', async ({ page }) => {
    /**
     * Given: Primary data source (yfinance) is unavailable
     * When: Stock analysis request attempts data retrieval
     * Then: Automatically fallback to Alpha Vantage and complete analysis
     */

    // Mock API failure scenario
    await page.route('**/api/v1/stocks/*/analysis', async route => {
      const mockAnalysisWithFailover = {
        symbol: 'TSLA',
        technical_score: 0.58,
        lstm_prediction: {
          predictions: [
            { date: '2024-01-16', predicted_price: 245.00, confidence: 0.65 }
          ],
          trend_direction: 'neutral'
        },
        sentiment_score: 0.15,
        confidence: 0.65,
        recommendation: 'HOLD',
        data_sources: {
          primary: 'alpha_vantage',
          fallback_used: true,
          failure_reason: 'yfinance_timeout'
        },
        warnings: ['Using fallback data source']
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAnalysisWithFailover)
      });
    });

    // Arrange
    const user = testUsers.basic;
    const token = await authenticateUser(page, user);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    // Act
    await navigateToStockAnalysis(page, 'TSLA');
    await waitForAnalysisResults(page);

    // Assert - Analysis still completes with fallback
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('TSLA');

    // Verify fallback warning is displayed
    await expect(page.locator('[data-testid="data-source-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-source-primary"]')).toContainText('alpha_vantage');
    await expect(page.locator('[data-testid="fallback-indicator"]')).toBeVisible();

    // Analysis should still be complete
    await expect(page.locator('[data-testid="technical-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendation-action"]')).toContainText('HOLD');
  });

  test('Timeout Scenario: LSTM Model Prediction Timeout', async ({ page }) => {
    /**
     * Given: LSTM model prediction takes longer than 30 seconds
     * When: Analysis request waits for prediction
     * Then: Return partial analysis without LSTM prediction, log timeout
     */

    // Mock LSTM timeout scenario
    await page.route('**/api/v1/stocks/*/analysis', async route => {
      const mockPartialAnalysis = {
        symbol: 'NVDA',
        technical_score: 0.72,
        lstm_prediction: {
          status: 'timeout',
          error: 'prediction_timeout_30s',
          message: 'LSTM prediction service timeout'
        },
        sentiment_score: 0.35,
        confidence: 0.68,
        recommendation: 'BUY',
        warnings: ['LSTM prediction unavailable due to timeout']
      };

      // Simulate delay before response
      await new Promise(resolve => setTimeout(resolve, 2000));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPartialAnalysis)
      });
    });

    // Arrange
    const user = testUsers.pro;
    const token = await authenticateUser(page, user);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user_tier', 'pro');
    }, token);

    // Act
    await navigateToStockAnalysis(page, 'NVDA');

    // Wait for analysis with timeout handling
    await page.waitForTimeout(3000);

    // Assert
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('NVDA');

    // Technical analysis should be available
    await expect(page.locator('[data-testid="technical-indicators"]')).toBeVisible();
    await expect(page.locator('[data-testid="technical-score"]')).toContainText('72');

    // Sentiment analysis should be available
    await expect(page.locator('[data-testid="sentiment-analysis"]')).toBeVisible();

    // LSTM section should show timeout error
    const lstmSection = page.locator('[data-testid="lstm-prediction"]');
    await expect(lstmSection.locator('[data-testid="lstm-error"]')).toBeVisible();
    await expect(lstmSection.locator('[data-testid="lstm-error"]')).toContainText('timeout');

    // Overall recommendation should still be available
    await expect(page.locator('[data-testid="recommendation-action"]')).toContainText('BUY');
  });

  test('Network Retry Logic: Temporary Network Failures', async ({ page }) => {
    /**
     * Given: Intermittent network failures during data retrieval
     * When: Stock analysis attempts external API calls
     * Then: Retry 3 times with exponential backoff, succeed on 3rd attempt
     */

    let attemptCount = 0;

    await page.route('**/api/v1/stocks/*/analysis', async route => {
      attemptCount++;

      if (attemptCount < 3) {
        // Fail first 2 attempts
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Network error' })
        });
        return;
      }

      // Succeed on 3rd attempt
      const mockSuccessAnalysis = {
        symbol: 'META',
        technical_score: 0.68,
        confidence: 0.70,
        recommendation: 'BUY',
        data_sources: {
          retry_attempts: 3,
          final_attempt_success: true
        }
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSuccessAnalysis)
      });
    });

    // Arrange
    const user = testUsers.basic;
    const token = await authenticateUser(page, user);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    // Act
    await navigateToStockAnalysis(page, 'META');

    // Assert - Should eventually succeed
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('META', { timeout: 15000 });
    await expect(page.locator('[data-testid="technical-score"]')).toContainText('68');
    await expect(page.locator('[data-testid="recommendation-action"]')).toContainText('BUY');
  });

  test('Analysis Caching: Repeated Requests Return Cached Data', async ({ page }) => {
    /**
     * Given: Multiple identical analysis requests within cache TTL
     * When: Same user requests same symbol analysis repeatedly
     * Then: Return cached results with consistent data
     */

    let requestCount = 0;

    await page.route('**/api/v1/stocks/*/analysis', async route => {
      requestCount++;

      const mockCachedAnalysis = {
        symbol: 'GOOGL',
        technical_score: 0.71,
        confidence: 0.74,
        recommendation: 'BUY',
        cache_hit: requestCount > 1,
        request_number: requestCount,
        cached_at: '2024-01-15T10:00:00Z'
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCachedAnalysis)
      });
    });

    // Arrange
    const user = testUsers.pro;
    const token = await authenticateUser(page, user);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user_tier', 'pro');
    }, token);

    // Act - Make first request
    await navigateToStockAnalysis(page, 'GOOGL');
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('GOOGL');

    const firstRecommendation = await page.locator('[data-testid="recommendation-action"]').textContent();
    const firstScore = await page.locator('[data-testid="technical-score"]').textContent();

    // Make second request by refreshing
    await page.reload();
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('GOOGL');

    const secondRecommendation = await page.locator('[data-testid="recommendation-action"]').textContent();
    const secondScore = await page.locator('[data-testid="technical-score"]').textContent();

    // Assert - Data should be consistent (cached)
    expect(firstRecommendation).toBe(secondRecommendation);
    expect(firstScore).toBe(secondScore);
    expect(requestCount).toBeGreaterThanOrEqual(2);
  });

  test('Free vs Pro User Feature Differences', async ({ page }) => {
    /**
     * Given: Free and Pro users request same analysis
     * When: Analysis is displayed
     * Then: Pro users see additional features (LSTM, advanced indicators)
     */

    // Test with free user first
    const freeUser = testUsers.basic;
    const freeToken = await authenticateUser(page, freeUser);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user_tier', 'free');
    }, freeToken);

    await navigateToStockAnalysis(page, 'AAPL');
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('AAPL');

    // Assert free user limitations
    await expect(page.locator('[data-testid="lstm-prediction"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="upgrade-prompt"]')).toBeVisible();
    await expect(page.locator('[data-testid="basic-technical-indicators"]')).toBeVisible();

    // Clear session and test with pro user
    await page.evaluate(() => localStorage.clear());

    const proUser = testUsers.pro;
    const proToken = await authenticateUser(page, proUser);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user_tier', 'pro');
    }, proToken);

    await page.reload();
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('AAPL');

    // Assert pro user features
    await expect(page.locator('[data-testid="lstm-prediction"]')).toBeVisible();
    await expect(page.locator('[data-testid="advanced-indicators"]')).toBeVisible();
    await expect(page.locator('[data-testid="upgrade-prompt"]')).not.toBeVisible();
  });

  test('Mobile Responsiveness: Analysis on Mobile Device', async ({ page }) => {
    /**
     * Given: Mobile device viewport
     * When: User accesses stock analysis
     * Then: Layout adapts for mobile with collapsible sections
     */

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const user = testUsers.pro;
    const token = await authenticateUser(page, user);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user_tier', 'pro');
    }, token);

    await navigateToStockAnalysis(page, 'AAPL');
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('AAPL');

    // Assert mobile layout adaptations
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="collapsible-sections"]')).toBeVisible();

    // Test collapsible technical indicators section
    const techSection = page.locator('[data-testid="technical-indicators-header"]');
    await techSection.click();
    await expect(page.locator('[data-testid="technical-indicators-content"]')).toBeVisible();

    // Test horizontal scrolling for charts
    const chartContainer = page.locator('[data-testid="mobile-chart-container"]');
    await expect(chartContainer).toHaveCSS('overflow-x', 'scroll');
  });

  test('Accessibility: Screen Reader and Keyboard Navigation', async ({ page }) => {
    /**
     * Given: User navigates with keyboard and screen reader
     * When: Accessing stock analysis page
     * Then: All elements are properly labeled and keyboard accessible
     */

    const user = testUsers.pro;
    const token = await authenticateUser(page, user);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await navigateToStockAnalysis(page, 'AAPL');
    await expect(page.locator('[data-testid="stock-symbol"]')).toContainText('AAPL');

    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Focus on first interactive element
    await page.keyboard.press('Tab'); // Move to next element
    await page.keyboard.press('Enter'); // Activate focused element

    // Assert ARIA labels and roles are present
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('[aria-label="Stock Analysis Dashboard"]')).toBeVisible();
    await expect(page.locator('[aria-label="Technical Indicators Chart"]')).toBeVisible();
    await expect(page.locator('[aria-label="LSTM Prediction Chart"]')).toBeVisible();
    await expect(page.locator('[aria-describedby="recommendation-description"]')).toBeVisible();

    // Test focus management
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focusedElement).toBeTruthy();
  });
});

test.describe('Error Scenarios', () => {
  test('Invalid Stock Symbol: 404 Handling', async ({ page }) => {
    /**
     * Given: User requests analysis for invalid stock symbol
     * When: API returns 404
     * Then: Display appropriate error message with suggestions
     */

    await page.route('**/api/v1/stocks/INVALID/analysis', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'STOCK_NOT_FOUND',
          message: 'Stock symbol INVALID not found',
          suggestions: ['AAPL', 'GOOGL', 'MSFT']
        })
      });
    });

    const user = testUsers.basic;
    const token = await authenticateUser(page, user);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await navigateToStockAnalysis(page, 'INVALID');

    // Assert error handling
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('not found');
    await expect(page.locator('[data-testid="stock-suggestions"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-AAPL"]')).toBeVisible();
  });

  test('Server Error: 500 Handling with Retry Option', async ({ page }) => {
    /**
     * Given: Server experiences internal error
     * When: Analysis request fails with 500 error
     * Then: Show error message with retry option
     */

    let attemptCount = 0;

    await page.route('**/api/v1/stocks/*/analysis', async route => {
      attemptCount++;

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Analysis service temporarily unavailable'
        })
      });
    });

    const user = testUsers.basic;
    const token = await authenticateUser(page, user);

    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await navigateToStockAnalysis(page, 'AAPL');

    // Assert error handling
    await expect(page.locator('[data-testid="server-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Test retry functionality
    await page.locator('[data-testid="retry-button"]').click();
    expect(attemptCount).toBe(2); // Verify retry was attempted
  });
});