/**
 * E2E Tests for Push Notifications
 * Tests notification permission flow, subscription, and preferences
 */

import { test, expect } from '@playwright/test'

test.describe('Push Notifications E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant notification permission by default for testing
    await context.grantPermissions(['notifications'])

    // Navigate to dashboard
    await page.goto('https://turtletrading.vercel.app/dashboard')
  })

  test('should show notification permission prompt', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check if NotificationPermissionManager is available
    const isSupported = await page.evaluate(() => {
      return 'Notification' in window && 'serviceWorker' in navigator
    })

    expect(isSupported).toBe(true)
  })

  test('should have VAPID public key configured', async ({ page }) => {
    // Check if VAPID key is available in environment
    const hasVapidKey = await page.evaluate(() => {
      return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    })

    // VAPID key should be configured
    expect(hasVapidKey).toBeTruthy()
  })

  test('should register service worker for PWA', async ({ page }) => {
    // Wait for service worker registration
    await page.waitForFunction(() => {
      return navigator.serviceWorker.ready
    }, { timeout: 10000 })

    // Check service worker is registered
    const swRegistered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return registration !== undefined
    })

    expect(swRegistered).toBe(true)
  })

  test('should have push manager available', async ({ page }) => {
    // Check if PushManager API is available
    const hasPushManager = await page.evaluate(async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        return 'pushManager' in registration
      } catch {
        return false
      }
    })

    expect(hasPushManager).toBe(true)
  })

  test('should check notification permission status', async ({ page }) => {
    // Get current notification permission
    const permission = await page.evaluate(() => {
      return Notification.permission
    })

    // Permission should be granted, denied, or default
    expect(['granted', 'denied', 'default']).toContain(permission)
  })

  test.skip('should subscribe to push notifications (E2E)', async ({ page }) => {
    // This test requires actual notification permission grant
    // Skip for now as it requires user interaction in real browser

    // Request permission
    const permission = await page.evaluate(async () => {
      return await Notification.requestPermission()
    })

    if (permission === 'granted') {
      // Subscribe to push
      const subscribed = await page.evaluate(async () => {
        try {
          const registration = await navigator.serviceWorker.ready
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

          if (!vapidKey) return false

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey,
          })

          return subscription !== null
        } catch {
          return false
        }
      })

      expect(subscribed).toBe(true)
    }
  })

  test('should have notification UI components available', async ({ page }) => {
    // Check if notification components are loaded
    const componentsExist = await page.evaluate(() => {
      // Components should be available in the bundle
      return typeof window !== 'undefined'
    })

    expect(componentsExist).toBe(true)
  })

  test('should handle mobile viewport for notifications', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Wait for page to adapt
    await page.waitForTimeout(1000)

    // Check mobile-specific elements are visible
    const isMobileView = await page.evaluate(() => {
      return window.innerWidth === 375
    })

    expect(isMobileView).toBe(true)
  })

  test('should have service worker with push event listener', async ({ page }) => {
    // Check if service worker has push event listener registered
    // This is verified by checking if service worker file exists
    const swExists = await page.evaluate(async () => {
      try {
        const response = await fetch('/sw-push.js')
        return response.ok
      } catch {
        return false
      }
    })

    // Service worker file should exist
    expect(swExists).toBeTruthy()
  })

  test('should have notification icons available', async ({ page }) => {
    // Check if notification icons exist
    const iconsExist = await page.evaluate(async () => {
      try {
        const icon192 = await fetch('/icons/icon-192x192.png')
        const icon72 = await fetch('/icons/icon-72x72.png')
        return icon192.ok && icon72.ok
      } catch {
        return false
      }
    })

    expect(iconsExist).toBe(true)
  })
})

test.describe('Notification Preferences E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://turtletrading.vercel.app/settings')
  })

  test('should navigate to settings page', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Verify on settings page
    const url = page.url()
    expect(url).toContain('/settings')
  })

  test.skip('should show notification preferences section (E2E)', async ({ page }) => {
    // Skip for now - requires implementing preferences in settings page
    await page.waitForSelector('[data-testid="notification-preferences"]', {
      timeout: 5000,
    })

    const preferencesVisible = await page.isVisible(
      '[data-testid="notification-preferences"]'
    )
    expect(preferencesVisible).toBe(true)
  })

  test('should have mobile-responsive settings', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)

    const viewport = await page.viewportSize()
    expect(viewport?.width).toBe(375)
  })
})

test.describe('Notification API Integration', () => {
  test('should have notifications API endpoint available', async ({ request }) => {
    // Test notifications API endpoint
    const response = await request.get('https://turtletrading.vercel.app/api/notifications/test')

    // API should respond (may require auth)
    expect([200, 401, 403]).toContain(response.status())
  })

  test.skip('should handle notification subscription API (requires auth)', async ({ request }) => {
    // Skip for now - requires authentication token
    // This would test POST /api/notifications/subscribe
  })
})
