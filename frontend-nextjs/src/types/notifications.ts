/**
 * Notification Types and Interfaces
 * Defines structured notification data for the push notification system
 */

export enum NotificationType {
  PRICE_ALERT = 'price_alert',
  SYNC_COMPLETE = 'sync_complete',
  NEWS_ALERT = 'news_alert',
  SYSTEM = 'system',
  TEST = 'test',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface NotificationPayload {
  type: NotificationType
  title: string
  body: string
  priority?: NotificationPriority
  data?: Record<string, any>
  icon?: string
  badge?: string
  image?: string
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  timestamp?: number
}

export interface PriceAlertData {
  symbol: string
  currentPrice: number
  targetPrice: number
  direction: 'above' | 'below'
  changePercent?: number
}

export interface SyncCompleteData {
  itemsSynced: number
  duration: number
  errors?: number
}

export interface NewsAlertData {
  headline: string
  source: string
  url: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  symbols?: string[]
}

/**
 * Create a price alert notification
 */
export function createPriceAlertNotification(data: PriceAlertData): NotificationPayload {
  const { symbol, currentPrice, targetPrice, direction, changePercent } = data

  const changeText = changePercent
    ? ` (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
    : ''

  return {
    type: NotificationType.PRICE_ALERT,
    title: `Price Alert: ${symbol}`,
    body: `${symbol} is now ${direction} $${currentPrice.toFixed(2)}${changeText}`,
    priority: NotificationPriority.HIGH,
    data: { symbol, currentPrice, targetPrice, direction },
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `price-alert-${symbol}`,
    requireInteraction: true,
    timestamp: Date.now(),
  }
}

/**
 * Create a sync complete notification
 */
export function createSyncCompleteNotification(data: SyncCompleteData): NotificationPayload {
  const { itemsSynced, duration, errors } = data

  const errorText = errors ? ` (${errors} errors)` : ''
  const durationText = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`

  return {
    type: NotificationType.SYNC_COMPLETE,
    title: 'Sync Complete',
    body: `Synced ${itemsSynced} ${itemsSynced === 1 ? 'item' : 'items'} in ${durationText}${errorText}`,
    priority: errors ? NotificationPriority.NORMAL : NotificationPriority.LOW,
    data: { itemsSynced, duration, errors },
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'sync-complete',
    silent: !errors,
    timestamp: Date.now(),
  }
}

/**
 * Create a news alert notification
 */
export function createNewsAlertNotification(data: NewsAlertData): NotificationPayload {
  const { headline, source, url, sentiment, symbols } = data

  const sentimentEmoji = sentiment === 'positive' ? '📈' : sentiment === 'negative' ? '📉' : '📰'
  const symbolText = symbols && symbols.length > 0 ? ` (${symbols.join(', ')})` : ''

  return {
    type: NotificationType.NEWS_ALERT,
    title: `${sentimentEmoji} ${source}${symbolText}`,
    body: headline,
    priority: NotificationPriority.NORMAL,
    data: { headline, source, url, sentiment, symbols },
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `news-${url}`,
    timestamp: Date.now(),
  }
}

/**
 * Create a system notification
 */
export function createSystemNotification(title: string, body: string, priority = NotificationPriority.NORMAL): NotificationPayload {
  return {
    type: NotificationType.SYSTEM,
    title,
    body,
    priority,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'system',
    timestamp: Date.now(),
  }
}

/**
 * Create a test notification
 */
export function createTestNotification(): NotificationPayload {
  return {
    type: NotificationType.TEST,
    title: 'Test Notification',
    body: 'This is a test push notification from TurtleTrading',
    priority: NotificationPriority.NORMAL,
    data: { test: true },
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'test',
    timestamp: Date.now(),
  }
}
