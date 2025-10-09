/**
 * Unit tests for Notification Types
 * TDD approach - testing notification creation functions
 */

import {
  NotificationType,
  NotificationPriority,
  createPriceAlertNotification,
  createSyncCompleteNotification,
  createNewsAlertNotification,
  createSystemNotification,
  createTestNotification,
} from '@/types/notifications'

describe('Notification Types', () => {
  describe('createPriceAlertNotification', () => {
    test('should create price alert for above target', () => {
      const notification = createPriceAlertNotification({
        symbol: 'AAPL',
        currentPrice: 150.25,
        targetPrice: 150.0,
        direction: 'above',
        changePercent: 2.5,
      })

      expect(notification.type).toBe(NotificationType.PRICE_ALERT)
      expect(notification.title).toBe('Price Alert: AAPL')
      expect(notification.body).toContain('AAPL is now above $150.25')
      expect(notification.body).toContain('+2.50%')
      expect(notification.priority).toBe(NotificationPriority.HIGH)
      expect(notification.data).toEqual({
        symbol: 'AAPL',
        currentPrice: 150.25,
        targetPrice: 150.0,
        direction: 'above',
      })
      expect(notification.requireInteraction).toBe(true)
      expect(notification.tag).toBe('price-alert-AAPL')
    })

    test('should create price alert for below target', () => {
      const notification = createPriceAlertNotification({
        symbol: 'TSLA',
        currentPrice: 200.0,
        targetPrice: 210.0,
        direction: 'below',
        changePercent: -5.2,
      })

      expect(notification.body).toContain('TSLA is now below $200.00')
      expect(notification.body).toContain('-5.20%')
      expect(notification.tag).toBe('price-alert-TSLA')
    })

    test('should create price alert without change percent', () => {
      const notification = createPriceAlertNotification({
        symbol: 'GOOGL',
        currentPrice: 140.5,
        targetPrice: 140.0,
        direction: 'above',
      })

      expect(notification.body).toBe('GOOGL is now above $140.50')
      expect(notification.body).not.toContain('%')
    })
  })

  describe('createSyncCompleteNotification', () => {
    test('should create sync complete notification without errors', () => {
      const notification = createSyncCompleteNotification({
        itemsSynced: 5,
        duration: 1234,
      })

      expect(notification.type).toBe(NotificationType.SYNC_COMPLETE)
      expect(notification.title).toBe('Sync Complete')
      expect(notification.body).toBe('Synced 5 items in 1.2s')
      expect(notification.priority).toBe(NotificationPriority.LOW)
      expect(notification.silent).toBe(true)
      expect(notification.tag).toBe('sync-complete')
    })

    test('should create sync complete notification with errors', () => {
      const notification = createSyncCompleteNotification({
        itemsSynced: 10,
        duration: 2500,
        errors: 2,
      })

      expect(notification.body).toBe('Synced 10 items in 2.5s (2 errors)')
      expect(notification.priority).toBe(NotificationPriority.NORMAL)
      expect(notification.silent).toBe(false)
    })

    test('should handle single item sync', () => {
      const notification = createSyncCompleteNotification({
        itemsSynced: 1,
        duration: 500,
      })

      expect(notification.body).toBe('Synced 1 item in 500ms')
    })

    test('should format duration under 1 second', () => {
      const notification = createSyncCompleteNotification({
        itemsSynced: 3,
        duration: 750,
      })

      expect(notification.body).toContain('750ms')
    })
  })

  describe('createNewsAlertNotification', () => {
    test('should create positive news alert', () => {
      const notification = createNewsAlertNotification({
        headline: 'Tech stocks rally on strong earnings',
        source: 'Bloomberg',
        url: 'https://example.com/news/1',
        sentiment: 'positive',
        symbols: ['AAPL', 'MSFT'],
      })

      expect(notification.type).toBe(NotificationType.NEWS_ALERT)
      expect(notification.title).toBe('📈 Bloomberg (AAPL, MSFT)')
      expect(notification.body).toBe('Tech stocks rally on strong earnings')
      expect(notification.priority).toBe(NotificationPriority.NORMAL)
      expect(notification.tag).toBe('news-https://example.com/news/1')
    })

    test('should create negative news alert', () => {
      const notification = createNewsAlertNotification({
        headline: 'Market concerns over inflation',
        source: 'Reuters',
        url: 'https://example.com/news/2',
        sentiment: 'negative',
      })

      expect(notification.title).toBe('📉 Reuters')
      expect(notification.title).not.toContain('(')
    })

    test('should create neutral news alert', () => {
      const notification = createNewsAlertNotification({
        headline: 'Fed maintains interest rates',
        source: 'CNBC',
        url: 'https://example.com/news/3',
        sentiment: 'neutral',
      })

      expect(notification.title).toBe('📰 CNBC')
    })

    test('should create news alert without sentiment', () => {
      const notification = createNewsAlertNotification({
        headline: 'Market update',
        source: 'WSJ',
        url: 'https://example.com/news/4',
      })

      expect(notification.title).toBe('📰 WSJ')
    })
  })

  describe('createSystemNotification', () => {
    test('should create system notification with default priority', () => {
      const notification = createSystemNotification(
        'System Update',
        'The application has been updated'
      )

      expect(notification.type).toBe(NotificationType.SYSTEM)
      expect(notification.title).toBe('System Update')
      expect(notification.body).toBe('The application has been updated')
      expect(notification.priority).toBe(NotificationPriority.NORMAL)
      expect(notification.tag).toBe('system')
    })

    test('should create system notification with custom priority', () => {
      const notification = createSystemNotification(
        'Critical Alert',
        'Action required',
        NotificationPriority.URGENT
      )

      expect(notification.priority).toBe(NotificationPriority.URGENT)
    })
  })

  describe('createTestNotification', () => {
    test('should create test notification', () => {
      const notification = createTestNotification()

      expect(notification.type).toBe(NotificationType.TEST)
      expect(notification.title).toBe('Test Notification')
      expect(notification.body).toBe('This is a test push notification from TurtleTrading')
      expect(notification.priority).toBe(NotificationPriority.NORMAL)
      expect(notification.data).toEqual({ test: true })
      expect(notification.tag).toBe('test')
    })
  })

  describe('Common notification properties', () => {
    test('all notifications should have required properties', () => {
      const notifications = [
        createPriceAlertNotification({
          symbol: 'TEST',
          currentPrice: 100,
          targetPrice: 100,
          direction: 'above',
        }),
        createSyncCompleteNotification({ itemsSynced: 1, duration: 1000 }),
        createNewsAlertNotification({
          headline: 'Test',
          source: 'Test',
          url: 'https://test.com',
        }),
        createSystemNotification('Test', 'Test'),
        createTestNotification(),
      ]

      notifications.forEach((notification) => {
        expect(notification).toHaveProperty('type')
        expect(notification).toHaveProperty('title')
        expect(notification).toHaveProperty('body')
        expect(notification).toHaveProperty('priority')
        expect(notification).toHaveProperty('icon')
        expect(notification).toHaveProperty('badge')
        expect(notification).toHaveProperty('tag')
        expect(notification).toHaveProperty('timestamp')
        expect(typeof notification.timestamp).toBe('number')
      })
    })

    test('all notifications should have valid icon paths', () => {
      const notification = createTestNotification()

      expect(notification.icon).toBe('/icons/icon-192x192.png')
      expect(notification.badge).toBe('/icons/badge-72x72.png')
    })
  })
})
