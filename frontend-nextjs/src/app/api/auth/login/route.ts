import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

// Demo credentials for testing
const DEMO_USERS = {
  'admin@turtletrading.com': {
    password: 'Admin123!',
    user: {
      id: '1',
      email: 'admin@turtletrading.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      subscription: 'premium',
    }
  },
  'user@turtletrading.com': {
    password: 'User123!',
    user: {
      id: '2',
      email: 'user@turtletrading.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'user',
      subscription: 'free',
    }
  }
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-here-make-it-secure-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Check demo credentials
    const demoUser = DEMO_USERS[email as keyof typeof DEMO_USERS]
    if (!demoUser || demoUser.password !== password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Generate JWT tokens
    const now = Math.floor(Date.now() / 1000)
    const accessToken = await new SignJWT({
      sub: demoUser.user.id,
      email: demoUser.user.email,
      role: demoUser.user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + 24 * 60 * 60) // 24 hours
      .sign(JWT_SECRET)

    const refreshToken = await new SignJWT({
      sub: demoUser.user.id,
      type: 'refresh',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + 7 * 24 * 60 * 60) // 7 days
      .sign(JWT_SECRET)

    const response = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      user: demoUser.user
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}