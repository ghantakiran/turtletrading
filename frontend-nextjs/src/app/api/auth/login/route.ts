import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Call backend authentication endpoint
    const backendResponse = await fetch(`${API_BASE_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: email,
        password: password,
      }),
    })

    if (!backendResponse.ok) {
      // Check for specific error cases
      if (backendResponse.status === 401) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      if (backendResponse.status === 422) {
        return NextResponse.json(
          { error: 'Invalid input format' },
          { status: 422 }
        )
      }

      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      )
    }

    const authData = await backendResponse.json()

    // Get user information with the token
    let userData = null
    try {
      const userResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (userResponse.ok) {
        userData = await userResponse.json()
      }
    } catch (error) {
      console.warn('Failed to fetch user data:', error)
    }

    // Transform backend response to frontend format
    const response = {
      access_token: authData.access_token,
      refresh_token: authData.refresh_token || authData.access_token, // Fallback if no refresh token
      token_type: authData.token_type || 'bearer',
      user: userData ? {
        id: userData.id || userData.user_id || '1',
        email: userData.email || email,
        firstName: userData.first_name || userData.firstName || '',
        lastName: userData.last_name || userData.lastName || '',
        role: userData.role || 'user',
        subscription: userData.subscription || 'free',
      } : {
        id: '1',
        email: email,
        firstName: '',
        lastName: '',
        role: 'user',
        subscription: 'free',
      }
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