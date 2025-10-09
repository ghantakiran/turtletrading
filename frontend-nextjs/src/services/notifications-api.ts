/**
 * Notifications API Service
 * Handles communication with notification endpoints
 */

export interface NotificationPreferences {
  priceAlerts: boolean
  syncNotifications: boolean
  newsAlerts: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
}

export interface SubscribeResponse {
  success: boolean
  subscriptionId?: string
  error?: string
}

export class NotificationsAPI {
  private baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(subscription: PushSubscriptionJSON): Promise<SubscribeResponse> {
    const response = await fetch(`${this.baseUrl}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to subscribe')
    }

    return await response.json()
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(endpoint: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/notifications/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to unsubscribe')
    }

    return await response.json()
  }

  /**
   * Send test notification
   */
  async sendTestNotification(type: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/notifications/send-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send test notification')
    }

    return await response.json()
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: NotificationPreferences): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/notifications/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update preferences')
    }

    return await response.json()
  }

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    const response = await fetch(`${this.baseUrl}/api/notifications/preferences`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch preferences')
    }

    return await response.json()
  }
}

// Singleton instance
export const notificationsAPI = new NotificationsAPI()
