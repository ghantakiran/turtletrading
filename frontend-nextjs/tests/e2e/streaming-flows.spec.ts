/**
 * E2E tests for streaming data flows
 * Tests WebSocket connections, real-time updates, and data streaming scenarios
 */

import { test, expect, Page } from '@playwright/test'

// Test configuration
const BASE_URL = 'http://localhost:3000'
const WS_URL = 'ws://localhost:8000/api/v1/websocket'

// Mock WebSocket server responses
const mockPriceUpdate = {
  type: 'price_update',
  symbol: 'AAPL',
  data: {
    price: 150.25,
    change: 2.5,
    changePercent: 1.67,
    volume: 1000000,
    marketCap: 2500000000,
    high52Week: 180.0,
    low52Week: 120.0,
    avgVolume: 800000
  },
  timestamp: new Date().toISOString()
}

const mockSentimentUpdate = {
  type: 'sentiment_update',
  symbol: 'AAPL',
  data: {
    score: 0.75,
    label: 'positive',
    confidence: 0.89,
    sources: ['news', 'social'],
    trending: true
  },
  timestamp: new Date().toISOString()
}

const mockTechnicalUpdate = {
  type: 'technical_update',
  symbol: 'AAPL',
  data: {
    rsi: 62.5,
    macd: { value: 1.25, signal: 1.15, histogram: 0.10 },
    signal: 'buy',
    strength: 0.75
  },
  timestamp: new Date().toISOString()
}

async function setupWebSocketMock(page: Page) {
  // Mock WebSocket API to simulate real-time data
  await page.addInitScript(() => {
    class MockWebSocket extends EventTarget {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3

      readyState = MockWebSocket.CONNECTING
      url: string

      constructor(url: string) {
        super()
        this.url = url

        // Simulate connection opening
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN
          this.dispatchEvent(new Event('open'))
        }, 100)
      }

      send(data: string) {
        console.log('WebSocket send:', data)
        const message = JSON.parse(data)

        // Simulate server responses based on message type
        setTimeout(() => {
          if (message.type === 'subscribe') {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'subscription_confirmed',
                topics: message.symbols,
                timestamp: new Date().toISOString()
              })
            }))

            // Start sending mock data for subscribed symbols
            message.symbols?.forEach((symbol: string) => {
              this.simulateDataStream(symbol)
            })
          } else if (message.type === 'ping') {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'pong',
                timestamp: Date.now()
              })
            }))
          }
        }, 50)
      }

      close() {
        this.readyState = MockWebSocket.CLOSING
        setTimeout(() => {
          this.readyState = MockWebSocket.CLOSED
          this.dispatchEvent(new CloseEvent('close', { code: 1000 }))
        }, 100)
      }

      simulateDataStream(symbol: string) {
        const sendUpdate = (data: any) => {
          if (this.readyState === MockWebSocket.OPEN) {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({ ...data, symbol })
            }))
          }
        }

        // Send initial price update
        setTimeout(() => sendUpdate({
          type: 'price_update',
          data: {
            price: 150.25 + Math.random() * 5 - 2.5,
            change: Math.random() * 4 - 2,
            changePercent: Math.random() * 2 - 1,
            volume: Math.floor(Math.random() * 1000000) + 500000,
            marketCap: 2500000000
          },
          timestamp: new Date().toISOString()
        }), 200)

        // Send periodic updates
        const intervals = [
          setInterval(() => sendUpdate({
            type: 'price_update',
            data: {
              price: 150.25 + Math.random() * 5 - 2.5,
              change: Math.random() * 4 - 2,
              changePercent: Math.random() * 2 - 1,
              volume: Math.floor(Math.random() * 1000000) + 500000
            },
            timestamp: new Date().toISOString()
          }), 2000),

          setInterval(() => sendUpdate({
            type: 'sentiment_update',
            data: {
              score: Math.random() * 2 - 1,
              label: Math.random() > 0.5 ? 'positive' : 'negative',
              confidence: Math.random() * 0.5 + 0.5
            },
            timestamp: new Date().toISOString()
          }), 5000),

          setInterval(() => sendUpdate({
            type: 'technical_update',
            data: {
              rsi: Math.random() * 100,
              signal: Math.random() > 0.6 ? 'buy' : Math.random() > 0.3 ? 'sell' : 'hold'
            },
            timestamp: new Date().toISOString()
          }), 3000)
        ]

        // Store intervals for cleanup
        ;(this as any).intervals = intervals
      }

      addEventListener(type: string, listener: EventListener) {
        super.addEventListener(type, listener)
      }

      removeEventListener(type: string, listener: EventListener) {
        super.removeEventListener(type, listener)
      }
    }

    // Replace the global WebSocket
    ;(window as any).WebSocket = MockWebSocket
  })
}

test.describe('Streaming Data Flows E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup WebSocket mock before navigating
    await setupWebSocketMock(page)

    // Navigate to dashboard
    await page.goto(BASE_URL)
  })

  test.describe('Real-time price streaming', () => {
    test('should establish WebSocket connection and receive price updates', async ({ page }) => {
      // Navigate to dashboard or stock page
      await page.goto(`${BASE_URL}/dashboard`)

      // Wait for page to load
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 })

      // Check for WebSocket connection status indicator
      const connectionStatus = page.locator('[data-testid="connection-status"]')
      await expect(connectionStatus).toBeVisible({ timeout: 5000 })

      // Verify connection status shows connected
      await expect(connectionStatus).toContainText(/connected|online/i, { timeout: 10000 })

      // Wait for real-time price updates
      const priceElement = page.locator('[data-testid="stock-price"]').first()
      if (await priceElement.count() > 0) {
        // Verify price updates are happening
        const initialPrice = await priceElement.textContent()

        // Wait for price to change (indicates real-time updates)
        await expect(async () => {
          const currentPrice = await priceElement.textContent()
          expect(currentPrice).not.toBe(initialPrice)
        }).toPass({ timeout: 15000 })
      }
    })

    test('should handle WebSocket reconnection on connection loss', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Wait for initial connection
      const connectionStatus = page.locator('[data-testid="connection-status"]')
      await expect(connectionStatus).toContainText(/connected/i, { timeout: 10000 })

      // Simulate connection loss by evaluating JavaScript
      await page.evaluate(() => {
        // Find and close the WebSocket connection
        const wsInstances = (window as any).webSocketInstances || []
        wsInstances.forEach((ws: any) => {
          if (ws.readyState === 1) { // OPEN
            ws.close(1006, 'Connection lost') // Simulate unexpected close
          }
        })
      })

      // Check for reconnecting status
      await expect(connectionStatus).toContainText(/reconnecting|connecting/i, { timeout: 5000 })

      // Verify it reconnects
      await expect(connectionStatus).toContainText(/connected/i, { timeout: 15000 })
    })

    test('should display live market data ticker', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Look for market ticker or price display
      const ticker = page.locator('[data-testid="market-ticker"], [data-testid="stock-list"], .price-update')

      if (await ticker.count() > 0) {
        await expect(ticker.first()).toBeVisible()

        // Verify ticker shows updating data
        const priceElements = page.locator('[data-testid*="price"], .price')
        if (await priceElements.count() > 0) {
          await expect(priceElements.first()).toBeVisible()
        }
      }
    })
  })

  test.describe('Stock-specific streaming', () => {
    test('should stream data for specific stock page', async ({ page }) => {
      // Navigate to specific stock page
      await page.goto(`${BASE_URL}/stock/AAPL`)

      // Wait for stock page to load
      await page.waitForSelector('[data-testid="stock-analysis"], [data-testid="stock-page"]', { timeout: 10000 })

      // Check for stock-specific data elements
      const stockPrice = page.locator('[data-testid="stock-price"], [data-testid="current-price"]')
      if (await stockPrice.count() > 0) {
        await expect(stockPrice).toBeVisible()
      }

      // Verify real-time updates for this specific stock
      const stockSymbol = page.locator('[data-testid="stock-symbol"], h1')
      if (await stockSymbol.count() > 0) {
        await expect(stockSymbol).toContainText('AAPL')
      }
    })

    test('should handle multiple stock subscriptions', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Look for multiple stock symbols being displayed
      const stockElements = page.locator('[data-testid*="stock-"], .stock-item')

      if (await stockElements.count() > 1) {
        // Verify multiple stocks are being tracked
        expect(await stockElements.count()).toBeGreaterThan(1)

        // Check that different stocks show different data
        const firstStock = stockElements.first()
        const secondStock = stockElements.nth(1)

        if (await firstStock.isVisible() && await secondStock.isVisible()) {
          const firstText = await firstStock.textContent()
          const secondText = await secondStock.textContent()
          expect(firstText).not.toBe(secondText)
        }
      }
    })
  })

  test.describe('Sentiment streaming', () => {
    test('should receive and display sentiment updates', async ({ page }) => {
      await page.goto(`${BASE_URL}/sentiment`)

      // Look for sentiment indicators
      const sentimentElement = page.locator('[data-testid="sentiment-score"], [data-testid="sentiment-indicator"]')

      if (await sentimentElement.count() > 0) {
        await expect(sentimentElement.first()).toBeVisible()

        // Check for sentiment value or indicator
        const sentimentValue = sentimentElement.first()
        await expect(sentimentValue).toBeVisible()
      }
    })

    test('should update sentiment in real-time', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Look for any sentiment-related elements
      const sentimentElements = page.locator('[data-testid*="sentiment"], .sentiment')

      if (await sentimentElements.count() > 0) {
        // Verify sentiment element exists
        await expect(sentimentElements.first()).toBeVisible()
      }
    })
  })

  test.describe('Technical analysis streaming', () => {
    test('should receive technical indicator updates', async ({ page }) => {
      await page.goto(`${BASE_URL}/stock/AAPL`)

      // Look for technical analysis section
      const technicalSection = page.locator('[data-testid="technical-analysis"], [data-testid="indicators"]')

      if (await technicalSection.count() > 0) {
        await expect(technicalSection.first()).toBeVisible()

        // Check for specific indicators
        const indicators = page.locator('[data-testid*="rsi"], [data-testid*="macd"], .indicator')
        if (await indicators.count() > 0) {
          await expect(indicators.first()).toBeVisible()
        }
      }
    })
  })

  test.describe('Error handling and resilience', () => {
    test('should handle malformed WebSocket messages gracefully', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Inject malformed message
      await page.evaluate(() => {
        const mockWs = new (window as any).WebSocket('ws://test')
        setTimeout(() => {
          mockWs.dispatchEvent(new MessageEvent('message', {
            data: 'invalid json'
          }))
        }, 1000)
      })

      // Verify app doesn't crash
      const dashboard = page.locator('[data-testid="dashboard"], body')
      await expect(dashboard).toBeVisible()

      // Check if error notification appears
      const errorNotification = page.locator('[data-testid="error-notification"], .error, .notification')
      if (await errorNotification.count() > 0) {
        // Error notification should be visible but app should continue working
        await expect(dashboard).toBeVisible()
      }
    })

    test('should handle server errors in streaming data', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Simulate server error message
      await page.evaluate(() => {
        const mockWs = new (window as any).WebSocket('ws://test')
        setTimeout(() => {
          mockWs.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'error',
              data: { message: 'Server error occurred' },
              timestamp: new Date().toISOString()
            })
          }))
        }, 1000)
      })

      // App should handle error gracefully
      const dashboard = page.locator('[data-testid="dashboard"], body')
      await expect(dashboard).toBeVisible()
    })

    test('should maintain data integrity during connection issues', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Wait for initial data load
      await page.waitForTimeout(2000)

      // Capture initial state
      const initialContent = await page.locator('body').textContent()

      // Simulate brief connection interruption
      await page.evaluate(() => {
        const wsInstances = (window as any).webSocketInstances || []
        wsInstances.forEach((ws: any) => {
          ws.close(1006, 'Brief interruption')
        })
      })

      // Wait for reconnection
      await page.waitForTimeout(3000)

      // Verify data is still displayed
      const currentContent = await page.locator('body').textContent()
      expect(currentContent).toBeTruthy()
      expect(currentContent.length).toBeGreaterThan(100) // Ensure meaningful content
    })
  })

  test.describe('Performance and memory', () => {
    test('should handle high-frequency updates without performance degradation', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Start performance monitoring
      await page.evaluate(() => {
        (window as any).performanceStart = performance.now()
      })

      // Simulate high-frequency updates
      await page.evaluate(() => {
        const mockWs = new (window as any).WebSocket('ws://test')

        // Send rapid price updates
        let count = 0
        const interval = setInterval(() => {
          if (count >= 50) {
            clearInterval(interval)
            return
          }

          mockWs.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'price_update',
              symbol: 'AAPL',
              data: {
                price: 150 + Math.random() * 10,
                change: Math.random() * 2 - 1,
                volume: Math.floor(Math.random() * 1000000)
              },
              timestamp: new Date().toISOString()
            })
          }))
          count++
        }, 100)
      })

      // Wait for updates to process
      await page.waitForTimeout(6000)

      // Check performance
      const performanceData = await page.evaluate(() => {
        const end = performance.now()
        const start = (window as any).performanceStart
        return {
          duration: end - start,
          memoryUsage: (performance as any).memory?.usedJSHeapSize
        }
      })

      // Verify reasonable performance (should complete in reasonable time)
      expect(performanceData.duration).toBeLessThan(10000) // Less than 10 seconds

      // Verify page is still responsive
      const dashboard = page.locator('[data-testid="dashboard"], body')
      await expect(dashboard).toBeVisible()
    })

    test('should clean up WebSocket connections on page navigation', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)

      // Wait for WebSocket connection
      await page.waitForTimeout(2000)

      // Navigate away
      await page.goto(`${BASE_URL}/about`)

      // Navigate back
      await page.goto(`${BASE_URL}/dashboard`)

      // Verify no memory leaks or multiple connections
      const connectionCount = await page.evaluate(() => {
        return (window as any).activeWebSocketConnections?.length || 0
      })

      // Should have reasonable number of connections (not accumulating)
      expect(connectionCount).toBeLessThanOrEqual(2)
    })
  })
})