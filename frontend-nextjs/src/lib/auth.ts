import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

// Demo users for development
const DEMO_USERS = [
  {
    id: "1",
    email: "admin@turtletrading.com",
    password: "Admin123!",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    subscription: "premium",
  },
  {
    id: "2",
    email: "user@turtletrading.com",
    password: "User123!",
    firstName: "Demo",
    lastName: "User",
    role: "user",
    subscription: "free",
  }
]

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log('NextAuth authorize called with:', credentials)

        if (!credentials?.email || !credentials?.password) {
          console.log('Missing email or password')
          return null
        }

        console.log('Looking for user with email:', credentials.email)
        const user = DEMO_USERS.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        )

        if (user) {
          console.log('User found:', user)
          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            subscription: user.subscription,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        }

        console.log('No user found with matching credentials')
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.subscription = user.subscription
        token.firstName = user.firstName
        token.lastName = user.lastName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.subscription = token.subscription as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-here-make-it-secure-in-production",
  trustHost: true, // Important for Vercel deployment
}

declare module "next-auth" {
  interface User {
    role?: string
    subscription?: string
    firstName?: string
    lastName?: string
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      subscription: string
      firstName: string
      lastName: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    subscription?: string
    firstName?: string
    lastName?: string
  }
}