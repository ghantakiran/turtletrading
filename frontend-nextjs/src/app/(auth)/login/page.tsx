import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your TurtleTrading account to access AI-powered stock analysis.',
}

export default function LoginPage() {
  return <LoginForm />
}