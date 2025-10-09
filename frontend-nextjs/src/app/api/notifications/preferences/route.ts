/**
 * GET/PUT /api/notifications/preferences
 * Manage notification preferences
 */

import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for demo (replace with database in production)
const preferences = new Map<string, NotificationPreferences>()

interface NotificationPreferences {
  priceAlerts: boolean
  syncNotifications: boolean
  newsAlerts: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
}

// Default preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  priceAlerts: true,
  syncNotifications: true,
  newsAlerts: false,
}

export async function GET(request: NextRequest) {
  try {
    // In production, get user ID from auth token
    const userId = 'default-user'

    const userPreferences = preferences.get(userId) || DEFAULT_PREFERENCES

    return NextResponse.json(userPreferences)
  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.text()

    if (!body) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      )
    }

    let newPreferences: NotificationPreferences

    try {
      newPreferences = JSON.parse(body)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (
      typeof newPreferences.priceAlerts !== 'boolean' ||
      typeof newPreferences.syncNotifications !== 'boolean' ||
      typeof newPreferences.newsAlerts !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'Invalid preferences format' },
        { status: 400 }
      )
    }

    // Validate quiet hours if provided
    if (newPreferences.quietHoursStart || newPreferences.quietHoursEnd) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

      if (
        newPreferences.quietHoursStart &&
        !timeRegex.test(newPreferences.quietHoursStart)
      ) {
        return NextResponse.json(
          { error: 'Invalid quietHoursStart format (use HH:MM)' },
          { status: 400 }
        )
      }

      if (
        newPreferences.quietHoursEnd &&
        !timeRegex.test(newPreferences.quietHoursEnd)
      ) {
        return NextResponse.json(
          { error: 'Invalid quietHoursEnd format (use HH:MM)' },
          { status: 400 }
        )
      }
    }

    // In production, get user ID from auth token
    const userId = 'default-user'

    // Store preferences
    preferences.set(userId, newPreferences)

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
    })
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Export for testing/development
export { preferences }
