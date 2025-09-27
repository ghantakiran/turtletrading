'use client'

import { User } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingUp,
  Brain,
  PieChart,
  Bell,
  Settings,
  BarChart3,
  Star,
  AlertTriangle,
  X
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AppSidebarProps {
  user: User
  open: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Market', href: '/market', icon: TrendingUp },
  { name: 'Analysis', href: '/analysis', icon: Brain },
  { name: 'Portfolio', href: '/portfolio', icon: PieChart },
  { name: 'Watchlist', href: '/watchlist', icon: Star },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Sentiment', href: '/sentiment', icon: BarChart3 },
]

export function AppSidebar({ user, open, setOpen, isMobile }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 transform border-r border-border bg-card/50 backdrop-blur-sm transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          !isMobile && "sticky translate-x-0"
        )}
      >
        {/* Mobile close button */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold">Navigation</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}

        <div className="flex flex-col h-full p-4">
          {/* Navigation links */}
          <nav className="flex-1 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => isMobile && setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                  {item.name === 'Alerts' && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      3
                    </Badge>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Market summary */}
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Market Summary
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>S&P 500</span>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="h-3 w-3" />
                  <span>+0.5%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>NASDAQ</span>
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>-0.2%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>VIX</span>
                <span className="text-muted-foreground">18.5</span>
              </div>
            </div>
          </div>

          {/* User info */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Signed in as
            </div>
            <div className="font-medium text-sm">
              {user.firstName} {user.lastName}
            </div>
            <Badge variant="outline" className="mt-1 text-xs">
              {user.subscription}
            </Badge>
          </div>
        </div>
      </aside>
    </>
  )
}