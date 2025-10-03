"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Brain,
  Settings,
  Menu,
  Zap,
  Target,
  Activity,
  Wifi,
  WifiOff,
  Search,
  Bell,
  User,
  ChevronRight,
  Home,
  Star,
  BookOpen,
  Newspaper
} from 'lucide-react'
import { useMarketStore, useAuthStore, useUIStore } from '@/stores'

const navigation = [
  { name: 'Home', href: '/', icon: Home, current: false },
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3, current: false },
  { name: 'Stock Analysis', href: '/analysis/AAPL', icon: TrendingUp, current: false },
  { name: 'AI Analysis', href: '/analysis', icon: Brain, current: false },
  { name: 'Market News', href: '/news', icon: Newspaper, current: false },
  { name: 'Portfolio', href: '/portfolio', icon: Target, current: false },
  { name: 'Alerts', href: '/alerts', icon: Zap, current: false },
  { name: 'Settings', href: '/settings', icon: Settings, current: false },
]

function NavigationItem({ item, mobile = false }: { item: any; mobile?: boolean }) {
  const pathname = usePathname()
  const isActive = pathname === item.href

  const baseClasses = mobile
    ? "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
    : "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"

  const activeClasses = isActive
    ? "bg-primary text-primary-foreground"
    : "text-muted-foreground hover:text-foreground hover:bg-accent"

  return (
    <Link href={item.href} className={`${baseClasses} ${activeClasses}`}>
      <item.icon className="h-4 w-4" />
      <span>{item.name}</span>
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-primary rounded-lg -z-10"
          initial={false}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </Link>
  )
}

export function Navigation() {
  // Zustand stores
  const { isConnected, connectionStatus, marketIndices } = useMarketStore()
  const { isAuthenticated, user } = useAuthStore()
  const { notifications } = useUIStore()

  // Get market data for display
  const spyData = marketIndices['SPY']

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center space-x-1 bg-card/50 backdrop-blur-sm border rounded-lg p-1">
        {navigation.map((item) => (
          <div key={item.name} className="relative">
            <NavigationItem item={item} />
          </div>
        ))}
      </nav>

      {/* Mobile Navigation */}
      <Sheet>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="outline" size="icon" className="relative">
            <Menu className="h-4 w-4" />
            {notifications.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">{notifications.length}</span>
              </div>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-6">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    TurtleTrading
                  </h2>
                  <Badge variant="outline" className="text-xs mt-1">
                    <Zap className="h-3 w-3 mr-1" />
                    AI-Powered
                  </Badge>
                </div>
                <Badge
                  variant={isConnected ? "default" : "destructive"}
                  className={`gap-1 ${
                    isConnected
                      ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                      : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  }`}
                >
                  {isConnected ? (
                    <Wifi className="w-3 h-3" />
                  ) : (
                    <WifiOff className="w-3 h-3" />
                  )}
                  {isConnected ? 'Live' : 'Offline'}
                </Badge>
              </div>

              {/* Quick Stats */}
              {spyData && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">S&P 500</p>
                      <p className="text-xl font-bold">${spyData.value.toFixed(2)}</p>
                    </div>
                    <div className={`flex items-center gap-1 ${
                      spyData.change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {spyData.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span className="font-medium">
                        {spyData.change >= 0 ? '+' : ''}{spyData.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-2">
                  Navigation
                </h3>
                <div className="space-y-1">
                  {navigation.map((item) => (
                    <NavigationItem key={item.name} item={item} mobile />
                  ))}
                </div>
              </div>

              <Separator />

              {/* User Section */}
              {isAuthenticated && user ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
                    Account
                  </h3>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {user.subscription} Plan
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <User className="h-3 w-3" />
                      Profile
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Settings className="h-3 w-3" />
                      Settings
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
                    Account
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="gap-2">
                      Sign In
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      Sign Up
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Search className="h-3 w-3" />
                    Search
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 relative">
                    <Bell className="h-3 w-3" />
                    Alerts
                    {notifications.length > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-bold">{notifications.length}</span>
                      </div>
                    )}
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <Star className="h-3 w-3" />
                  Watchlist
                </Button>
              </div>

              {/* Market Status Footer */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Market Status</span>
                    <Badge
                      variant={isConnected ? "default" : "destructive"}
                      className={`gap-1 ${
                        isConnected
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-red-500/10 text-red-600'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`} />
                      {isConnected ? 'Live Data' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Status: {connectionStatus || (isConnected ? 'Connected' : 'Disconnected')}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}