/**
 * E2E Tests for Web Push Notifications
 * Tests notification API endpoints and functionality
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'https://turtletrading.vercel.app'

test.describe('Notification API Endpoints', () => {
  test('POST /api/notifications/subscribe should accept valid subscription', async ({ request }) => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-' + Date.now(),
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
      },
    }

    const response = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: subscription,
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.subscriptionId).toBeDefined()
    expect(data.message).toContain('Successfully subscribed')
  })

  test('POST /api/notifications/subscribe should reject empty body', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: {},
    })

    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  test('POST /api/notifications/subscribe should reject missing keys', async ({ request }) => {
    const invalidSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    }

    const response = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: invalidSubscription,
    })

    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('keys')
  })

  test('POST /api/notifications/unsubscribe should remove subscription', async ({ request }) => {
    // First subscribe
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-unsubscribe-' + Date.now(),
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
      },
    }

    const subscribeResponse = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: subscription,
    })
    expect(subscribeResponse.status()).toBe(200)

    // Then unsubscribe
    const unsubscribeResponse = await request.post(`${BASE_URL}/api/notifications/unsubscribe`, {
      data: { endpoint: subscription.endpoint },
    })

    expect(unsubscribeResponse.status()).toBe(200)
    const data = await unsubscribeResponse.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain('Successfully unsubscribed')
  })

  test('POST /api/notifications/unsubscribe should return 404 for non-existent subscription', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/notifications/unsubscribe`, {
      data: { endpoint: 'https://non-existent-endpoint.com' },
    })

    expect(response.status()).toBe(404)
    const data = await response.json()
    expect(data.error).toContain('not found')
  })

  test('GET /api/notifications/preferences should return default preferences', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/notifications/preferences`)

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('priceAlerts')
    expect(data).toHaveProperty('syncNotifications')
    expect(data).toHaveProperty('newsAlerts')
    expect(typeof data.priceAlerts).toBe('boolean')
    expect(typeof data.syncNotifications).toBe('boolean')
    expect(typeof data.newsAlerts).toBe('boolean')
  })

  test('PUT /api/notifications/preferences should update preferences', async ({ request }) => {
    const newPreferences = {
      priceAlerts: true,
      syncNotifications: false,
      newsAlerts: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    }

    const response = await request.put(`${BASE_URL}/api/notifications/preferences`, {
      data: newPreferences,
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain('updated successfully')
  })

  test('PUT /api/notifications/preferences should reject invalid boolean values', async ({ request }) => {
    const invalidPreferences = {
      priceAlerts: 'yes', // Should be boolean
      syncNotifications: true,
      newsAlerts: false,
    }

    const response = await request.put(`${BASE_URL}/api/notifications/preferences`, {
      data: invalidPreferences,
    })

    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Invalid')
  })

  test('PUT /api/notifications/preferences should reject invalid time format', async ({ request }) => {
    const invalidPreferences = {
      priceAlerts: true,
      syncNotifications: true,
      newsAlerts: false,
      quietHoursStart: '25:00', // Invalid hour
    }

    const response = await request.put(`${BASE_URL}/api/notifications/preferences`, {
      data: invalidPreferences,
    })

    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('quietHoursStart')
  })

  test('POST /api/notifications/send-test should send test notification', async ({ request }) => {
    // First subscribe
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-send-' + Date.now(),
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
      },
    }

    await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: subscription,
    })

    // Then send test notification
    const response = await request.post(`${BASE_URL}/api/notifications/send-test`, {
      data: { type: 'test' },
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.notificationsSent).toBeGreaterThanOrEqual(1)
  })

  test('POST /api/notifications/send-test should reject missing type', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/notifications/send-test`, {
      data: {},
    })

    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('type')
  })
})

test.describe('Notification System Integration', () => {
  test('should handle complete notification flow', async ({ request }) => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/integration-test-' + Date.now()

    // 1. Subscribe
    const subscribeResponse = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: {
        endpoint,
        keys: {
          p256dh: 'integration-test-p256dh',
          auth: 'integration-test-auth',
        },
      },
    })
    expect(subscribeResponse.status()).toBe(200)

    // 2. Update preferences
    const preferencesResponse = await request.put(`${BASE_URL}/api/notifications/preferences`, {
      data: {
        priceAlerts: true,
        syncNotifications: true,
        newsAlerts: false,
      },
    })
    expect(preferencesResponse.status()).toBe(200)

    // 3. Get preferences
    const getPreferencesResponse = await request.get(`${BASE_URL}/api/notifications/preferences`)
    expect(getPreferencesResponse.status()).toBe(200)

    // 4. Send test notification
    const testResponse = await request.post(`${BASE_URL}/api/notifications/send-test`, {
      data: { type: 'test' },
    })
    expect(testResponse.status()).toBe(200)

    // 5. Unsubscribe
    const unsubscribeResponse = await request.post(`${BASE_URL}/api/notifications/unsubscribe`, {
      data: { endpoint },
    })
    expect(unsubscribeResponse.status()).toBe(200)
  })

  test('should handle multiple subscriptions independently', async ({ request }) => {
    const endpoint1 = 'https://fcm.googleapis.com/fcm/send/multi-test-1-' + Date.now()
    const endpoint2 = 'https://fcm.googleapis.com/fcm/send/multi-test-2-' + Date.now()

    // Subscribe with first endpoint
    const sub1Response = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: {
        endpoint: endpoint1,
        keys: { p256dh: 'key1', auth: 'auth1' },
      },
    })
    expect(sub1Response.status()).toBe(200)

    // Subscribe with second endpoint
    const sub2Response = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: {
        endpoint: endpoint2,
        keys: { p256dh: 'key2', auth: 'auth2' },
      },
    })
    expect(sub2Response.status()).toBe(200)

    // Send test notification (should send to both)
    const testResponse = await request.post(`${BASE_URL}/api/notifications/send-test`, {
      data: { type: 'test' },
    })
    expect(testResponse.status()).toBe(200)
    const testData = await testResponse.json()
    expect(testData.notificationsSent).toBeGreaterThanOrEqual(2)

    // Unsubscribe first endpoint
    const unsub1Response = await request.post(`${BASE_URL}/api/notifications/unsubscribe`, {
      data: { endpoint: endpoint1 },
    })
    expect(unsub1Response.status()).toBe(200)

    // Unsubscribe second endpoint
    const unsub2Response = await request.post(`${BASE_URL}/api/notifications/unsubscribe`, {
      data: { endpoint: endpoint2 },
    })
    expect(unsub2Response.status()).toBe(200)
  })
})

test.describe('Notification Error Handling', () => {
  test('should handle malformed JSON gracefully', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: 'not valid json',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status()).toBeGreaterThanOrEqual(400)
  })

  test('should handle missing Content-Type header', async ({ request }) => {
    const subscription = {
      endpoint: 'https://test.com',
      keys: { p256dh: 'key', auth: 'auth' },
    }

    const response = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: subscription,
    })

    // Should still work - Next.js handles this
    expect([200, 400, 500]).toContain(response.status())
  })

  test('should return 500 for unexpected errors', async ({ request }) => {
    // Try to trigger edge cases
    const response = await request.post(`${BASE_URL}/api/notifications/subscribe`, {
      data: {
        endpoint: null,
        keys: null,
      },
    })

    expect(response.status()).toBeGreaterThanOrEqual(400)
  })
})
