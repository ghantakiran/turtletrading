import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Test configuration
const FRONTEND_URL = 'http://localhost:3001'
const BACKEND_URL = 'http://localhost:8000'

// Test helper functions
async function navigateToAlerts(page: Page) {
  await page.goto(FRONTEND_URL)
  await page.click('nav >> text="Alerts"')
  await expect(page).toHaveTitle(/Alerts/)
}

async function createAlert(page: Page, alertData: {
  name: string
  symbol: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  conditions: Array<{
    type: string
    operator?: string
    value?: string | number
    threshold?: string | number
  }>
}) {
  // Open alert creation wizard
  await page.click('button >> text="New Alert"')
  await expect(page.locator('text="Create New Alert"')).toBeVisible()

  // Fill basic information
  await page.fill('input[name="name"]', alertData.name)
  await page.fill('input[name="symbol"]', alertData.symbol)

  if (alertData.description) {
    await page.fill('textarea[name="description"]', alertData.description)
  }

  if (alertData.priority) {
    await page.selectOption('select[name="priority"]', alertData.priority)
  }

  // Add conditions
  for (const condition of alertData.conditions) {
    await page.click('button >> text="Add Condition"')

    // Wait for condition form to appear
    await page.waitForSelector('select >> text="Condition Type"')

    // Configure condition
    const conditionSelectors = page.locator('select[value*="condition-type"]')
    const lastConditionSelector = conditionSelectors.last()
    await lastConditionSelector.selectOption(condition.type)

    if (condition.operator) {
      const operatorSelectors = page.locator('select[value*="operator"]')
      const lastOperatorSelector = operatorSelectors.last()
      await lastOperatorSelector.selectOption(condition.operator)
    }

    if (condition.value !== undefined) {
      const valueInputs = page.locator('input[placeholder="Enter value"]')
      const lastValueInput = valueInputs.last()
      await lastValueInput.fill(String(condition.value))
    }

    if (condition.threshold !== undefined) {
      const thresholdInputs = page.locator('input[placeholder="Enter threshold"]')
      const lastThresholdInput = thresholdInputs.last()
      await lastThresholdInput.fill(String(condition.threshold))
    }
  }

  // Submit form
  await page.click('button >> text="Create Alert"')

  // Wait for success notification or redirect
  await page.waitForSelector('text="Alert created successfully"', { timeout: 5000 })
}

async function simulateAlertTrigger(page: Page, alertId: string, triggerData: {
  value: number
  threshold: number
  message: string
}) {
  // Simulate server-side alert trigger via API call
  const response = await page.request.post(`${BACKEND_URL}/api/v1/alerts/${alertId}/trigger`, {
    data: {
      value: triggerData.value,
      threshold: triggerData.threshold,
      message: triggerData.message,
      triggeredAt: new Date().toISOString()
    }
  })

  expect(response.status()).toBe(200)
}

async function checkNotificationCenter(page: Page, expectedTriggers: number) {
  // Navigate to notification center
  await page.click('button:has-text("Notification Center")')

  // Wait for notifications to load
  await page.waitForSelector('[data-testid="notification-list"]', { timeout: 5000 })

  // Check notification count
  const notifications = await page.locator('[data-testid="notification-item"]').count()
  expect(notifications).toBe(expectedTriggers)
}

async function acknowledgeNotification(page: Page, notificationIndex: number = 0) {
  // Find notification and acknowledge it
  const notification = page.locator('[data-testid="notification-item"]').nth(notificationIndex)
  await notification.locator('button[title="Acknowledge"]').click()

  // Wait for acknowledgment confirmation
  await page.waitForSelector('text="Notification acknowledged"', { timeout: 3000 })
}

test.describe('Alerts E2E - Create→Trigger→Acknowledge Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up page with proper viewport
    await page.setViewportSize({ width: 1280, height: 720 })

    // Mock authentication if needed
    await page.goto(FRONTEND_URL)

    // Wait for page to be ready
    await page.waitForLoadState('networkidle')
  })

  test('Complete alert lifecycle: Create simple price alert', async ({ page }) => {
    // Step 1: Navigate to alerts page
    await test.step('Navigate to alerts page', async () => {
      await navigateToAlerts(page)
      await expect(page.locator('h1')).toContainText('Alerts')
    })

    // Step 2: Create a price alert
    await test.step('Create price alert', async () => {
      await createAlert(page, {
        name: 'AAPL Price Alert E2E Test',
        symbol: 'AAPL',
        description: 'E2E test alert for AAPL price monitoring',
        priority: 'high',
        conditions: [
          {
            type: 'price_above',
            operator: '>',
            value: 150
          }
        ]
      })

      // Verify alert appears in management tab
      await page.click('button:has-text("Alert Management")')
      await expect(page.locator('text="AAPL Price Alert E2E Test"')).toBeVisible()
    })

    // Step 3: Verify alert is active
    await test.step('Verify alert is active', async () => {
      // Check that toggle switch shows active state
      const alertRow = page.locator('[data-testid="alert-row"]', { hasText: 'AAPL Price Alert E2E Test' })
      const toggleSwitch = alertRow.locator('[role="switch"]')
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true')
    })

    // Step 4: Simulate alert trigger
    await test.step('Simulate alert trigger', async () => {
      // Get alert ID from the page (this would typically be available via data attributes)
      const alertId = await page.getAttribute('[data-testid="alert-row"]:has-text("AAPL Price Alert E2E Test")', 'data-alert-id') || 'test-alert-id'

      // Simulate trigger via mock API call
      await simulateAlertTrigger(page, alertId, {
        value: 151.25,
        threshold: 150,
        message: 'AAPL price is above $150 (current: $151.25)'
      })

      // Wait for real-time update (WebSocket or polling)
      await page.waitForTimeout(2000)
    })

    // Step 5: Check notification center
    await test.step('Check notification center for triggered alert', async () => {
      await checkNotificationCenter(page, 1)

      // Verify notification content
      const notification = page.locator('[data-testid="notification-item"]').first()
      await expect(notification).toContainText('AAPL Price Alert E2E Test')
      await expect(notification).toContainText('AAPL price is above $150')
      await expect(notification).toContainText('$151.25')

      // Check unread indicator
      await expect(notification.locator('.unread-indicator')).toBeVisible()
    })

    // Step 6: Acknowledge notification
    await test.step('Acknowledge notification', async () => {
      await acknowledgeNotification(page, 0)

      // Verify acknowledgment
      const notification = page.locator('[data-testid="notification-item"]').first()
      await expect(notification.locator('.unread-indicator')).not.toBeVisible()
      await expect(notification.locator('[data-status="acknowledged"]')).toBeVisible()
    })

    // Step 7: Verify statistics update
    await test.step('Verify statistics updated', async () => {
      await page.click('button:has-text("Statistics")')

      // Check that triggered count increased
      await expect(page.locator('[data-metric="triggered-today"]')).toContainText('1')
      await expect(page.locator('[data-metric="total-alerts"]')).toContainText('1')
    })
  })

  test('Complex multi-condition alert workflow', async ({ page }) => {
    await test.step('Navigate to alerts page', async () => {
      await navigateToAlerts(page)
    })

    await test.step('Create multi-condition alert', async () => {
      await createAlert(page, {
        name: 'TSLA Multi-Condition Alert',
        symbol: 'TSLA',
        description: 'Complex alert with multiple conditions',
        priority: 'critical',
        conditions: [
          {
            type: 'price_above',
            operator: '>',
            value: 200
          },
          {
            type: 'volume_spike',
            threshold: 1000000
          },
          {
            type: 'rsi_overbought',
            value: 70
          }
        ]
      })

      // Verify AND logic is set (default)
      await page.click('button:has-text("Alert Management")')
      const alertRow = page.locator('text="TSLA Multi-Condition Alert"')
      await expect(alertRow).toBeVisible()
    })

    await test.step('Test alert conditions', async () => {
      // Edit the alert to test it
      await page.click('[data-testid="alert-row"]:has-text("TSLA Multi-Condition Alert") >> button[title="Edit alert"]')

      // Wait for edit form to load
      await expect(page.locator('text="Edit Alert"')).toBeVisible()

      // Click test alert button
      await page.click('button:has-text("Test Alert")')

      // Wait for test results
      await page.waitForSelector('text="Test Results"', { timeout: 10000 })

      // Verify test results are displayed
      const testResults = page.locator('[data-testid="test-results"]')
      await expect(testResults).toBeVisible()
    })

    await test.step('Simulate partial trigger (not all conditions met)', async () => {
      // Close edit dialog first
      await page.click('button:has-text("Cancel")')

      const alertId = 'multi-condition-alert-id'

      // Simulate trigger where only some conditions are met
      await page.evaluate(async ({ alertId, data }) => {
        await fetch(`http://localhost:8000/api/v1/alerts/${alertId}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conditions: [
              { id: 'price', result: 'PASS', value: 205, threshold: 200 },
              { id: 'volume', result: 'FAIL', value: 800000, threshold: 1000000 },
              { id: 'rsi', result: 'PASS', value: 72, threshold: 70 }
            ],
            logic: 'AND',
            overall: 'FAIL'
          })
        })
      }, { alertId, data: {} })

      await page.waitForTimeout(1000)

      // Check that no notification was created (AND logic requires all conditions)
      await page.click('button:has-text("Notification Center")')
      await page.waitForTimeout(1000)

      // Should have no new notifications
      const notificationCount = await page.locator('[data-testid="notification-item"]').count()
      expect(notificationCount).toBe(0)
    })

    await test.step('Simulate full trigger (all conditions met)', async () => {
      const alertId = 'multi-condition-alert-id'

      // Simulate trigger where all conditions are met
      await page.evaluate(async ({ alertId }) => {
        await fetch(`http://localhost:8000/api/v1/alerts/${alertId}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conditions: [
              { id: 'price', result: 'PASS', value: 210, threshold: 200 },
              { id: 'volume', result: 'PASS', value: 1200000, threshold: 1000000 },
              { id: 'rsi', result: 'PASS', value: 75, threshold: 70 }
            ],
            logic: 'AND',
            overall: 'PASS',
            message: 'All conditions met for TSLA multi-condition alert'
          })
        })
      }, { alertId })

      await page.waitForTimeout(2000)

      // Now should have a notification
      await page.reload()
      await page.click('button:has-text("Notification Center")')

      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(1)
      await expect(page.locator('text="All conditions met for TSLA"')).toBeVisible()
    })
  })

  test('Alert management and bulk operations', async ({ page }) => {
    await test.step('Create multiple alerts', async () => {
      await navigateToAlerts(page)

      // Create first alert
      await createAlert(page, {
        name: 'Bulk Test Alert 1',
        symbol: 'MSFT',
        priority: 'medium',
        conditions: [{ type: 'price_above', value: 300 }]
      })

      // Create second alert
      await createAlert(page, {
        name: 'Bulk Test Alert 2',
        symbol: 'GOOGL',
        priority: 'low',
        conditions: [{ type: 'price_below', value: 2500 }]
      })

      // Create third alert
      await createAlert(page, {
        name: 'Bulk Test Alert 3',
        symbol: 'AMZN',
        priority: 'high',
        conditions: [{ type: 'volume_spike', threshold: 500000 }]
      })
    })

    await test.step('Filter alerts by priority', async () => {
      await page.click('button:has-text("Alert Management")')

      // Filter by high priority
      await page.selectOption('select[name="priority-filter"]', 'high')

      // Should show only high priority alert
      await expect(page.locator('[data-testid="alert-row"]')).toHaveCount(1)
      await expect(page.locator('text="Bulk Test Alert 3"')).toBeVisible()

      // Reset filter
      await page.selectOption('select[name="priority-filter"]', 'all')
      await expect(page.locator('[data-testid="alert-row"]')).toHaveCount(3)
    })

    await test.step('Search alerts by name', async () => {
      await page.fill('input[name="search"]', 'Bulk Test Alert 2')

      // Should show only matching alert
      await expect(page.locator('[data-testid="alert-row"]')).toHaveCount(1)
      await expect(page.locator('text="Bulk Test Alert 2"')).toBeVisible()

      // Clear search
      await page.fill('input[name="search"]', '')
      await expect(page.locator('[data-testid="alert-row"]')).toHaveCount(3)
    })

    await test.step('Toggle alert active status', async () => {
      const firstAlert = page.locator('[data-testid="alert-row"]').first()
      const toggleSwitch = firstAlert.locator('[role="switch"]')

      // Should start as active
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true')

      // Toggle to inactive
      await toggleSwitch.click()
      await page.waitForTimeout(500)
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'false')

      // Toggle back to active
      await toggleSwitch.click()
      await page.waitForTimeout(500)
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true')
    })

    await test.step('Delete alert', async () => {
      const initialCount = await page.locator('[data-testid="alert-row"]').count()

      // Delete first alert
      const firstAlert = page.locator('[data-testid="alert-row"]').first()
      await firstAlert.locator('button[title="Delete alert"]').click()

      // Confirm deletion in dialog
      await page.waitForSelector('text="Are you sure you want to delete this alert?"')
      await page.click('button:has-text("Delete")')

      // Verify alert was deleted
      await page.waitForTimeout(500)
      const newCount = await page.locator('[data-testid="alert-row"]').count()
      expect(newCount).toBe(initialCount - 1)
    })
  })

  test('Alert snoozing and muting', async ({ page }) => {
    await test.step('Create and trigger alert', async () => {
      await navigateToAlerts(page)

      await createAlert(page, {
        name: 'Snooze Test Alert',
        symbol: 'NFLX',
        conditions: [{ type: 'price_above', value: 400 }]
      })

      // Simulate trigger
      const alertId = 'snooze-test-alert-id'
      await simulateAlertTrigger(page, alertId, {
        value: 405,
        threshold: 400,
        message: 'NFLX price above $400'
      })

      await page.waitForTimeout(1000)
    })

    await test.step('Snooze alert from notification center', async () => {
      await page.click('button:has-text("Notification Center")')

      // Find notification and snooze it
      const notification = page.locator('[data-testid="notification-item"]').first()
      await notification.locator('button[title="More actions"]').click()

      // Click snooze option
      await page.click('text="Snooze 1 hour"')

      // Verify snooze confirmation
      await expect(page.locator('text="Alert snoozed for 1 hours"')).toBeVisible()

      // Check alert management shows snoozed status
      await page.click('button:has-text("Alert Management")')
      const alertRow = page.locator('text="Snooze Test Alert"')
      await expect(alertRow.locator('[title*="Snoozed until"]')).toBeVisible()
    })

    await test.step('Mute alert', async () => {
      await page.click('button:has-text("Notification Center")')

      const notification = page.locator('[data-testid="notification-item"]').first()
      await notification.locator('button[title="More actions"]').click()

      // Click mute option
      await page.click('text="Mute alert"')

      // Verify mute confirmation
      await expect(page.locator('text="Alert muted"')).toBeVisible()

      // Check alert management shows muted status
      await page.click('button:has-text("Alert Management")')
      const alertRow = page.locator('text="Snooze Test Alert"')
      await expect(alertRow.locator('[title="Muted"]')).toBeVisible()
    })
  })

  test('Drag and drop alert reordering', async ({ page }) => {
    await test.step('Create multiple alerts for reordering', async () => {
      await navigateToAlerts(page)

      const alerts = [
        { name: 'Alert A', symbol: 'AAPL' },
        { name: 'Alert B', symbol: 'MSFT' },
        { name: 'Alert C', symbol: 'GOOGL' }
      ]

      for (const alert of alerts) {
        await createAlert(page, {
          name: alert.name,
          symbol: alert.symbol,
          conditions: [{ type: 'price_above', value: 100 }]
        })
      }
    })

    await test.step('Reorder alerts using drag and drop', async () => {
      await page.click('button:has-text("Alert Management")')

      // Get initial order
      const initialOrder = await page.locator('[data-testid="alert-name"]').allTextContents()

      // Drag first alert to third position
      const firstAlert = page.locator('[data-testid="alert-row"]').first()
      const thirdAlert = page.locator('[data-testid="alert-row"]').nth(2)

      await firstAlert.dragTo(thirdAlert)
      await page.waitForTimeout(500)

      // Verify new order
      const newOrder = await page.locator('[data-testid="alert-name"]').allTextContents()
      expect(newOrder).not.toEqual(initialOrder)
    })
  })

  test('Keyboard shortcuts and accessibility', async ({ page }) => {
    await test.step('Test keyboard navigation', async () => {
      await navigateToAlerts(page)

      // Test Cmd/Ctrl + N for new alert
      await page.keyboard.press('Meta+n')
      await expect(page.locator('text="Create New Alert"')).toBeVisible()

      // Close wizard with Escape
      await page.keyboard.press('Escape')
      await expect(page.locator('text="Create New Alert"')).not.toBeVisible()
    })

    await test.step('Test tab navigation between tabs', async () => {
      // Test Cmd/Ctrl + 1-4 for tab switching
      await page.keyboard.press('Meta+1')
      await expect(page.locator('[aria-current="page"]')).toContainText('Alert Builder')

      await page.keyboard.press('Meta+2')
      await expect(page.locator('[aria-current="page"]')).toContainText('Notification Center')

      await page.keyboard.press('Meta+3')
      await expect(page.locator('[aria-current="page"]')).toContainText('Alert Management')

      await page.keyboard.press('Meta+4')
      await expect(page.locator('[aria-current="page"]')).toContainText('Statistics')
    })

    await test.step('Test screen reader compatibility', async () => {
      // Verify important elements have proper ARIA labels
      await expect(page.locator('main')).toHaveAttribute('role', 'main')
      await expect(page.locator('[role="tablist"]')).toBeVisible()
      await expect(page.locator('[role="tab"]')).toHaveCount(4)

      // Check form accessibility
      await page.keyboard.press('Meta+n') // Open new alert wizard
      await expect(page.locator('input[aria-label*="Alert Name"]')).toBeVisible()
      await expect(page.locator('input[aria-label*="Symbol"]')).toBeVisible()
    })
  })
})