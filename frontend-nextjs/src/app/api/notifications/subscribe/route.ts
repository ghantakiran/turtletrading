/**
 * POST /api/notifications/subscribe
 * Subscribe to push notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

// In-memory storage for demo (replace with database in production)
const subscriptions = new Map<string, PushSubscriptionJSON>()

interface PushSubscriptionJSON {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.text()

    if (!body) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      )
    }

    let subscription: PushSubscriptionJSON

    try {
      subscription = JSON.parse(body)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate subscription data
    if (!subscription.endpoint) {
      return NextResponse.json(
        { error: 'Subscription endpoint is required' },
        { status: 400 }
      )
    }

    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return NextResponse.json(
        { error: 'Subscription keys (p256dh and auth) are required' },
        { status: 400 }
      )
    }

    // Generate subscription ID
    const subscriptionId = nanoid()

    // Store subscription (in production, save to database)
    subscriptions.set(subscriptionId, subscription)

    // Also store by endpoint for duplicate checking
    subscriptions.set(subscription.endpoint, subscription)

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to push notifications',
      subscriptionId,
    })
  } catch (error) {
    console.error('Subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Export subscriptions for testing/development
export { subscriptions }
