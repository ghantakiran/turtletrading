import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // For demo purposes, logout is always successful
    // In a real implementation, you might want to:
    // 1. Add the token to a blacklist
    // 2. Invalidate refresh tokens
    // 3. Log the logout event

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Logout API error:', error)
    // Even on error, allow logout for client cleanup
    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    )
  }
}