import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-here-make-it-secure-in-production'
)

// Demo users for lookup
const DEMO_USERS = {
  '1': {
    id: '1',
    email: 'admin@turtletrading.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    subscription: 'premium',
  },
  '2': {
    id: '2',
    email: 'user@turtletrading.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'user',
    subscription: 'free',
  }
}

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json()

    if (!refresh_token) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    try {
      // Verify refresh token
      const { payload } = await jwtVerify(refresh_token, JWT_SECRET)

      if (!payload.sub || typeof payload.sub !== 'string' || payload.type !== 'refresh') {
        return NextResponse.json(
          { error: 'Invalid refresh token' },
          { status: 401 }
        )
      }

      // Get user data
      const user = DEMO_USERS[payload.sub as keyof typeof DEMO_USERS]
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // Generate new access token
      const now = Math.floor(Date.now() / 1000)
      const accessToken = await new SignJWT({
        sub: user.id,
        email: user.email,
        role: user.role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(now)
        .setExpirationTime(now + 24 * 60 * 60) // 24 hours
        .sign(JWT_SECRET)

      const response = {
        access_token: accessToken,
        refresh_token: refresh_token, // Keep same refresh token
        token_type: 'bearer',
      }

      return NextResponse.json(response, { status: 200 })

    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

  } catch (error) {
    console.error('Token refresh API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}