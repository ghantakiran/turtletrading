import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'TurtleTrading dashboard with market insights and portfolio overview.',
}

export default async function DashboardPage() {
  redirect('/dashboard')
}