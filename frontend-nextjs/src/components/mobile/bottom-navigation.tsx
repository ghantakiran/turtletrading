'use client'

/**
 * Mobile Bottom Navigation Component
 * Provides touch-optimized navigation for mobile devices
 * Implements Material Design bottom navigation patterns
 */

import { useRouter, usePathname } from 'next/navigation'
import { Home, Eye, Bell, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavigationProps {
  alertCount?: number
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  testId: string
}

export function BottomNavigation({ alertCount = 0 }: BottomNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      testId: 'nav-icon-dashboard',
    },
    {
      label: 'Watchlist',
      href: '/watchlist',
      icon: Eye,
      testId: 'nav-icon-watchlist',
    },
    {
      label: 'Alerts',
      href: '/alerts',
      icon: Bell,
      testId: 'nav-icon-alerts',
    },
    {
      label: 'Portfolio',
      href: '/portfolio',
      icon: PieChart,
      testId: 'nav-icon-portfolio',
    },
  ]

  const handleNavigation = (href: string) => {
    router.push(href)
  }

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/')
  }

  const getBadgeDisplay = (count: number) => {
    if (count === 0) return null
    return count > 9 ? '9+' : count.toString()
  }

  return (
    <nav
      role="navigation"
      aria-label="Bottom navigation"
      className={cn(
        // Layout
        'fixed bottom-0 left-0 right-0 w-full z-50',
        // Styling
        'bg-white dark:bg-slate-900',
        'border-t border-gray-200 dark:border-slate-700',
        'shadow-lg',
        // Mobile only - hide on desktop
        'md:hidden',
        // Safe area for notched devices
        'pb-safe'
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          const showBadge = item.label === 'Alerts' && alertCount > 0

          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault()
                handleNavigation(item.href)
              }}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              tabIndex={0}
              className={cn(
                // Layout - minimum 44x44px touch target
                'flex flex-col items-center justify-center',
                'min-w-[44px] min-h-[44px]',
                'px-3 py-2',
                'rounded-lg',
                // Touch feedback
                'active:scale-95',
                'transition-all duration-200',
                // Focus visible
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                // Active state
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400',
                // Hover state
                'hover:bg-gray-100 dark:hover:bg-slate-800',
                // Relative for badge positioning
                'relative'
              )}
            >
              {/* Icon */}
              <Icon
                data-testid={item.testId}
                className={cn(
                  'w-6 h-6 mb-1',
                  'transition-colors duration-200',
                  active && 'text-blue-600 dark:text-blue-400'
                )}
              />

              {/* Label */}
              <span
                className={cn(
                  'text-xs font-medium',
                  'transition-colors duration-200',
                  active && 'text-blue-600 dark:text-blue-400'
                )}
              >
                {item.label}
              </span>

              {/* Badge for unread alerts */}
              {showBadge && (
                <span
                  role="status"
                  aria-label={`${alertCount} unread alerts`}
                  className={cn(
                    'absolute top-0 right-0',
                    'min-w-[20px] h-5 px-1',
                    'flex items-center justify-center',
                    'text-xs font-bold text-white',
                    'bg-red-500',
                    'rounded-full',
                    'border-2 border-white dark:border-slate-900'
                  )}
                >
                  {getBadgeDisplay(alertCount)}
                </span>
              )}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
