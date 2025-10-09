/**
 * Unit tests for Notifications API Service
 * TDD approach - write tests first, then implement
 */

import { NotificationsAPI } from '@/services/notifications-api'

global.fetch = jest.fn()

describe('NotificationsAPI', () => {
  let api: NotificationsAPI

  beforeEach(() => {
    api = new NotificationsAPI()
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('subscribe', () => {
    test('should send subscription to server', async () => {
      const mockSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: {
          p256dh: 'test-key',
          auth: 'test-auth',
        },
      } as PushSubscriptionJSON

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, subscriptionId: 'sub-123' }),
      })

      const result = await api.subscribe(mockSubscription)

      expect(global.fetch).toHaveBeenCalledWith('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockSubscription),
      })

      expect(result.success).toBe(true)
      expect(result.subscriptionId).toBe('sub-123')
    })

    test('should handle server errors', async () => {
      const mockSubscription = {
        endpoint: 'https://test.com',
        keys: { p256dh: 'key', auth: 'auth' },
      } as PushSubscriptionJSON

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      })

      await expect(api.subscribe(mockSubscription)).rejects.toThrow()
    })

    test('should handle network errors', async () => {
      const mockSubscription = {
        endpoint: 'https://test.com',
        keys: { p256dh: 'key', auth: 'auth' },
      } as PushSubscriptionJSON

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      await expect(api.subscribe(mockSubscription)).rejects.toThrow('Network error')
    })
  })

  describe('unsubscribe', () => {
    test('should send unsubscribe request', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const result = await api.unsubscribe(endpoint)

      expect(global.fetch).toHaveBeenCalledWith('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      })

      expect(result.success).toBe(true)
    })
  })

  describe('sendTestNotification', () => {
    test('should request test notification', async () => {
      const type = 'test'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const result = await api.sendTestNotification(type)

      expect(global.fetch).toHaveBeenCalledWith('/api/notifications/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      expect(result.success).toBe(true)
    })
  })

  describe('updatePreferences', () => {
    test('should update notification preferences', async () => {
      const preferences = {
        priceAlerts: true,
        syncNotifications: false,
        newsAlerts: true,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const result = await api.updatePreferences(preferences)

      expect(global.fetch).toHaveBeenCalledWith('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })

      expect(result.success).toBe(true)
    })
  })

  describe('getPreferences', () => {
    test('should fetch notification preferences', async () => {
      const mockPreferences = {
        priceAlerts: true,
        syncNotifications: true,
        newsAlerts: false,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      })

      const result = await api.getPreferences()

      expect(global.fetch).toHaveBeenCalledWith('/api/notifications/preferences')
      expect(result).toEqual(mockPreferences)
    })
  })
})
