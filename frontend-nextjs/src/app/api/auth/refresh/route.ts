import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json()

    if (!refresh_token) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    // Call backend refresh token endpoint
    const backendResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refresh_token
      }),
    })

    if (!backendResponse.ok) {
      if (backendResponse.status === 401) {
        return NextResponse.json(
          { error: 'Invalid or expired refresh token' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      )
    }

    const tokenData = await backendResponse.json()

    // Transform backend response to frontend format
    const response = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refresh_token, // Keep old refresh token if new one not provided
      token_type: tokenData.token_type || 'bearer',
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Token refresh API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}