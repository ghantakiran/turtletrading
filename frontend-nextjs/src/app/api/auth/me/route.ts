import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    try {
      // Verify JWT token
      const { payload } = await jwtVerify(token, JWT_SECRET)

      if (!payload.sub || typeof payload.sub !== 'string') {
        return NextResponse.json(
          { error: 'Invalid token format' },
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

      return NextResponse.json(user, { status: 200 })

    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

  } catch (error) {
    console.error('User info API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}