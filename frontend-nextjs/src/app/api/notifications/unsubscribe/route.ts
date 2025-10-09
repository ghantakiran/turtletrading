/**
 * POST /api/notifications/unsubscribe
 * Unsubscribe from push notifications
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

    let data: { endpoint: string }

    try {
      data = JSON.parse(body)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    if (!data.endpoint) {
      return NextResponse.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      )
    }

    // Remove subscription (in production, delete from database)
    const deleted = subscriptions.delete(data.endpoint)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications',
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
