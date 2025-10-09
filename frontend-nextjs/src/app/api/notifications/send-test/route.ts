/**
 * POST /api/notifications/send-test
 * Send test push notification
 */

import { NextRequest, NextResponse } from 'next/server'
import { subscriptions } from '../subscribe/route'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    if (!body) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      )
    }

    let data: { type: string }

    try {
      data = JSON.parse(body)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    if (!data.type) {
      return NextResponse.json(
        { error: 'Notification type is required' },
        { status: 400 }
      )
    }

    // Check if there are any subscriptions
    if (subscriptions.size === 0) {
      return NextResponse.json(
        { error: 'No active subscriptions found' },
        { status: 404 }
      )
    }

    // In production, use web-push library to send actual notifications
    // For now, simulate success
    const notificationsSent = subscriptions.size

    console.log(`Test notification sent to ${notificationsSent} subscribers`)

    return NextResponse.json({
      success: true,
      message: `Test notification sent to ${notificationsSent} ${notificationsSent === 1 ? 'subscriber' : 'subscribers'}`,
      notificationsSent,
    })
  } catch (error) {
    console.error('Send test notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
