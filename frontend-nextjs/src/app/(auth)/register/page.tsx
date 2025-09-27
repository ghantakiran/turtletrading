import { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your TurtleTrading account to start using AI-powered stock analysis.',
}

export default function RegisterPage() {
  return <RegisterForm />
}