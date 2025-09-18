/**
 * Real-time Data Streaming E2E Tests
 * Per IMPLEMENT_FROM_DOCS_FILLED.md: docs/claude/tests/integration/real_time_data_flow.md
 * Tests WebSocket real-time data streaming functionality
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3001';
const WS_URL = process.env.VITE_WS_URL || 'ws://localhost:8000/ws';

interface MockWebSocketMessage {
  type: 'price_update' | 'subscription_ack' | 'heartbeat' | 'error';
  symbol?: string;
  price?: number;
  volume?: number;
  timestamp?: string;
  status?: string;
  message?: string;
}

// Helper functions
async function authenticateUser(page: Page): Promise<string> {
  const response = await page.request.post(`${API_BASE_URL}/api/v1/auth/token`, {
    data: {
      email: 'test@turtletrading.com',
      password: 'TestUser123!'
    }
  });

  if (response.ok()) {
    const authData = await response.json();
    return authData.access_token;
  }

  throw new Error('Authentication failed');
}

async function waitForWebSocketConnection(page: Page): Promise<void> {
  // Wait for WebSocket connection indicator
  await expect(page.locator('[data-testid="websocket-status"]')).toHaveText('Connected', { timeout: 10000 });
}

async function subscribeToSymbol(page: Page, symbol: string): Promise<void> {
  // Add symbol to watchlist (triggers WebSocket subscription)
  await page.locator('[data-testid="add-to-watchlist"]').click();
  await page.locator('[data-testid="symbol-input"]').fill(symbol);
  await page.locator('[data-testid="subscribe-button"]').click();
}

test.describe('Real-time Data Streaming', () => {
  test.beforeEach(async ({ page }) => {
    // Set up WebSocket mock
    await page.addInitScript(() => {
      // Mock WebSocket for consistent testing
      class MockWebSocket {
        url: string;
        readyState: number;
        onopen: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;

        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        private messageQueue: any[] = [];

        constructor(url: string) {
          this.url = url;
          this.readyState = MockWebSocket.CONNECTING;

          // Simulate connection opening
          setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) {
              this.onopen(new Event('open'));
            }
          }, 100);
        }

        send(data: string) {
          const message = JSON.parse(data);

          // Simulate subscription acknowledgment
          if (message.action === 'subscribe') {
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage(new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'subscription_ack',
                    status: 'subscribed',
                    symbols: message.symbols
                  })
                }));
              }
            }, 50);
          }
        }

        close() {
          this.readyState = MockWebSocket.CLOSED;
          if (this.onclose) {
            this.onclose(new CloseEvent('close'));
          }
        }

        // Method to simulate receiving messages (for testing)
        simulateMessage(message: any) {
          if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
            this.onmessage(new MessageEvent('message', {
              data: JSON.stringify(message)
            }));
          }
        }
      }

      // Replace global WebSocket
      (window as any).WebSocket = MockWebSocket;
      (window as any).mockWebSocket = null;

      // Store reference for test control
      const originalWebSocket = (window as any).WebSocket;
      (window as any).WebSocket = function(url: string) {
        const instance = new originalWebSocket(url);
        (window as any).mockWebSocket = instance;
        return instance;
      };
      (window as any).WebSocket.CONNECTING = 0;
      (window as any).WebSocket.OPEN = 1;
      (window as any).WebSocket.CLOSING = 2;
      (window as any).WebSocket.CLOSED = 3;
    });

    // Navigate to dashboard
    await page.goto(`${FRONTEND_URL}/dashboard`);
  });

  test('Happy Path: Real-time Price Streaming with Sub-100ms Latency', async ({ page }) => {
    /**
     * Given: Authenticated user subscribes to real-time price updates
     * When: Market data flows through WebSocket connection
     * Then: Frontend receives price updates within 100ms of market changes
     */

    // Arrange - Authenticate and set up
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);

    // Subscribe to AAPL updates
    await subscribeToSymbol(page, 'AAPL');

    // Wait for subscription confirmation
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText('AAPL subscribed');

    // Act - Simulate price update
    const updateStartTime = Date.now();
    await page.evaluate((startTime) => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'price_update',
          symbol: 'AAPL',
          price: 150.25,
          volume: 1000000,
          timestamp: new Date().toISOString(),
          test_start_time: startTime
        });
      }
    }, updateStartTime);

    // Assert - Price update received and displayed
    await expect(page.locator('[data-testid="stock-price-AAPL"]')).toContainText('150.25', { timeout: 5000 });

    // Verify latency requirement
    const displayTime = await page.evaluate(() => Date.now());
    const latency = displayTime - updateStartTime;
    expect(latency).toBeLessThan(100); // Sub-100ms requirement

    // Verify volume update
    await expect(page.locator('[data-testid="stock-volume-AAPL"]')).toContainText('1,000,000');

    // Verify timestamp display
    const timestampElement = page.locator('[data-testid="last-updated-AAPL"]');
    await expect(timestampElement).toBeVisible();
  });

  test('WebSocket Connection Drop and Reconnection', async ({ page }) => {
    /**
     * Given: Active WebSocket connection with subscriptions
     * When: Network interruption causes connection drop
     * Then: Automatic reconnection with subscription restoration
     */

    // Arrange
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);

    // Subscribe to multiple symbols
    await subscribeToSymbol(page, 'AAPL');
    await subscribeToSymbol(page, 'GOOGL');

    await expect(page.locator('[data-testid="subscribed-symbols"]')).toContainText('AAPL, GOOGL');

    // Act - Simulate connection drop
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.close();
      }
    });

    // Wait for disconnection indicator
    await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Reconnecting', { timeout: 2000 });

    // Simulate reconnection
    await page.evaluate(() => {
      // Trigger reconnection logic
      if ((window as any).webSocketManager) {
        (window as any).webSocketManager.reconnect();
      }
    });

    // Wait for reconnection
    await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Connected', { timeout: 10000 });

    // Assert - Subscriptions should be restored
    await expect(page.locator('[data-testid="subscribed-symbols"]')).toContainText('AAPL, GOOGL');

    // Verify data flow after reconnection
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'price_update',
          symbol: 'AAPL',
          price: 151.50,
          timestamp: new Date().toISOString()
        });
      }
    });

    await expect(page.locator('[data-testid="stock-price-AAPL"]')).toContainText('151.50');
  });

  test('High-Frequency Update Handling', async ({ page }) => {
    /**
     * Given: High-frequency market data (rapid updates)
     * When: WebSocket service processes rapid price changes
     * Then: UI updates efficiently without performance degradation
     */

    // Arrange
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);
    await subscribeToSymbol(page, 'SPY');

    // Act - Send rapid updates
    const updateCount = 20;
    const basePrice = 450.00;
    const startTime = Date.now();

    for (let i = 0; i < updateCount; i++) {
      await page.evaluate((i, basePrice) => {
        const mockWs = (window as any).mockWebSocket;
        if (mockWs) {
          mockWs.simulateMessage({
            type: 'price_update',
            symbol: 'SPY',
            price: basePrice + (i * 0.01),
            volume: 1000000 + (i * 10000),
            timestamp: new Date().toISOString()
          });
        }
      }, i, basePrice);

      // Small delay to simulate realistic timing
      await page.waitForTimeout(10);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Assert - Final price should be displayed
    const finalPrice = basePrice + ((updateCount - 1) * 0.01);
    await expect(page.locator('[data-testid="stock-price-SPY"]')).toContainText(finalPrice.toFixed(2));

    // Performance assertion
    expect(totalTime).toBeLessThan(1000); // Should handle 20 updates in under 1 second

    // Verify UI responsiveness
    await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Connected');

    // Check that the page is still responsive
    const clickTime = Date.now();
    await page.locator('[data-testid="dashboard-refresh"]').click();
    const clickResponseTime = Date.now() - clickTime;
    expect(clickResponseTime).toBeLessThan(500); // UI should remain responsive
  });

  test('Subscription Idempotency', async ({ page }) => {
    /**
     * Given: User sends multiple identical subscription requests
     * When: WebSocket handler processes duplicate subscriptions
     * Then: Maintain single subscription per symbol, no duplicate updates
     */

    // Arrange
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);

    // Act - Subscribe to same symbol multiple times
    for (let i = 0; i < 5; i++) {
      await subscribeToSymbol(page, 'GOOGL');
      await page.waitForTimeout(100);
    }

    // Assert - Only one subscription should exist
    const subscriptionCount = await page.locator('[data-testid="subscription-GOOGL"]').count();
    expect(subscriptionCount).toBe(1);

    // Send price update and verify only one update is received
    let updateReceived = false;

    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'price_update',
          symbol: 'GOOGL',
          price: 2750.00,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Verify single update received
    await expect(page.locator('[data-testid="stock-price-GOOGL"]')).toContainText('2750.00');

    // Check that no duplicate update indicators exist
    const duplicateIndicators = await page.locator('[data-testid="duplicate-update-warning"]').count();
    expect(duplicateIndicators).toBe(0);
  });

  test('WebSocket Message Validation and Error Handling', async ({ page }) => {
    /**
     * Given: WebSocket receives malformed or invalid messages
     * When: Message validation occurs
     * Then: Invalid messages are rejected gracefully without breaking the connection
     */

    // Arrange
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);

    // Act - Send various invalid messages
    const invalidMessages = [
      null,
      undefined,
      '',
      '{"invalid": "json"',
      '{"type": "invalid_type"}',
      '{"type": "price_update"}', // Missing required fields
      '{"type": "price_update", "symbol": "", "price": "not_a_number"}',
      '{"type": "price_update", "symbol": "AAPL", "price": -999999}' // Unrealistic price
    ];

    for (const invalidMessage of invalidMessages) {
      await page.evaluate((message) => {
        const mockWs = (window as any).mockWebSocket;
        if (mockWs) {
          try {
            if (typeof message === 'string') {
              mockWs.onmessage?.(new MessageEvent('message', { data: message }));
            } else {
              mockWs.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
            }
          } catch (e) {
            // Expected for invalid messages
          }
        }
      }, invalidMessage);
    }

    // Assert - Connection should remain stable
    await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Connected');

    // Verify error handling indicators
    const errorCount = await page.locator('[data-testid="websocket-error-count"]').textContent();
    expect(parseInt(errorCount || '0')).toBeGreaterThan(0);

    // Send valid message to ensure connection still works
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'price_update',
          symbol: 'AAPL',
          price: 150.00,
          volume: 1000000,
          timestamp: new Date().toISOString()
        });
      }
    });

    await expect(page.locator('[data-testid="stock-price-AAPL"]')).toContainText('150.00');
  });

  test('Market Hours and After-Hours Data Handling', async ({ page }) => {
    /**
     * Given: Market data during regular and after-hours trading
     * When: WebSocket receives updates with different market session indicators
     * Then: Display appropriate session indicators and handle data correctly
     */

    // Arrange
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);
    await subscribeToSymbol(page, 'AAPL');

    // Act - Send regular hours update
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'price_update',
          symbol: 'AAPL',
          price: 150.00,
          volume: 1000000,
          timestamp: new Date().toISOString(),
          market_session: 'regular',
          market_status: 'open'
        });
      }
    });

    // Assert regular hours display
    await expect(page.locator('[data-testid="market-status"]')).toContainText('Market Open');
    await expect(page.locator('[data-testid="after-hours-indicator"]')).not.toBeVisible();

    // Act - Send after-hours update
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'price_update',
          symbol: 'AAPL',
          price: 151.25,
          volume: 50000,
          timestamp: new Date().toISOString(),
          market_session: 'after_hours',
          market_status: 'closed'
        });
      }
    });

    // Assert after-hours display
    await expect(page.locator('[data-testid="market-status"]')).toContainText('After Hours');
    await expect(page.locator('[data-testid="after-hours-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="stock-price-AAPL"]')).toContainText('151.25');
  });

  test('Multi-Symbol Real-time Updates', async ({ page }) => {
    /**
     * Given: Multiple symbol subscriptions
     * When: Real-time updates arrive for different symbols
     * Then: Each symbol updates independently without interference
     */

    // Arrange
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);

    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];

    // Subscribe to multiple symbols
    for (const symbol of symbols) {
      await subscribeToSymbol(page, symbol);
    }

    // Wait for all subscriptions to be confirmed
    await expect(page.locator('[data-testid="total-subscriptions"]')).toContainText('5');

    // Act - Send simultaneous updates for all symbols
    const updates = symbols.map((symbol, index) => ({
      symbol,
      price: 100 + (index * 50),
      volume: 1000000 + (index * 100000)
    }));

    await page.evaluate((updates) => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        updates.forEach(update => {
          mockWs.simulateMessage({
            type: 'price_update',
            symbol: update.symbol,
            price: update.price,
            volume: update.volume,
            timestamp: new Date().toISOString()
          });
        });
      }
    }, updates);

    // Assert - All symbols should update correctly
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const expectedPrice = updates[i].price;
      await expect(page.locator(`[data-testid="stock-price-${symbol}"]`)).toContainText(expectedPrice.toString());
    }

    // Verify no cross-contamination between symbols
    await expect(page.locator('[data-testid="stock-price-AAPL"]')).not.toContainText('150'); // Should be 100
    await expect(page.locator('[data-testid="stock-price-GOOGL"]')).not.toContainText('100'); // Should be 150
  });

  test('WebSocket Heartbeat and Connection Health', async ({ page }) => {
    /**
     * Given: Established WebSocket connection
     * When: Heartbeat messages are exchanged
     * Then: Connection health is monitored and displayed
     */

    // Arrange
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);

    // Act - Simulate heartbeat messages
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        // Send heartbeat message
        mockWs.simulateMessage({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
          server_time: Date.now()
        });
      }
    });

    // Assert - Connection health indicators
    await expect(page.locator('[data-testid="connection-health"]')).toContainText('Good');
    await expect(page.locator('[data-testid="last-heartbeat"]')).toBeVisible();

    // Test connection latency display
    const latencyElement = page.locator('[data-testid="connection-latency"]');
    await expect(latencyElement).toBeVisible();

    const latencyText = await latencyElement.textContent();
    const latency = parseInt(latencyText?.match(/\d+/)?.[0] || '0');
    expect(latency).toBeLessThan(1000); // Should be reasonable latency
  });
});

test.describe('WebSocket Error Scenarios', () => {
  test('Server Error Response Handling', async ({ page }) => {
    /**
     * Given: WebSocket server sends error response
     * When: Error message is received
     * Then: Display appropriate error message and maintain connection stability
     */

    // Arrange
    const token = await authenticateUser(page);
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, token);

    await page.reload();
    await waitForWebSocketConnection(page);

    // Act - Simulate server error
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'error',
          error_code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many subscription requests',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Assert
    await expect(page.locator('[data-testid="websocket-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="websocket-error"]')).toContainText('Too many subscription requests');

    // Connection should remain active
    await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Connected');
  });

  test('Authentication Error During WebSocket Connection', async ({ page }) => {
    /**
     * Given: Invalid or expired authentication token
     * When: WebSocket connection attempts authentication
     * Then: Show authentication error and redirect to login
     */

    // Arrange - Use invalid token
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'invalid_token');
    });

    await page.goto(`${FRONTEND_URL}/dashboard`);

    // Act - WebSocket connection should fail authentication
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'error',
          error_code: 'AUTHENTICATION_FAILED',
          message: 'Invalid or expired token',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Assert
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-redirect-button"]')).toBeVisible();

    // Click redirect should go to login page
    await page.locator('[data-testid="login-redirect-button"]').click();
    await expect(page.url()).toContain('/login');
  });
});