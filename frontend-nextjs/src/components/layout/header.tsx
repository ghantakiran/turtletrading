"use client"

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Navigation } from './navigation'
import { AIInsightsModal } from '@/components/ai-insights-modal'
import {
  Activity,
  User,
  Settings,
  LogOut,
  Bell,
  Zap,
  Search,
  TrendingUp,
  TrendingDown,
  Menu,
  X,
  Plus,
  Star,
  WifiOff,
  Wifi
} from 'lucide-react'
import { useMarketStore, useAuthStore, useUIStore } from '@/stores'

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAIInsightsOpen, setIsAIInsightsOpen] = useState(false)

  // Zustand store hooks
  const { isConnected, connectionStatus, marketIndices } = useMarketStore()
  const { isAuthenticated, user, logout } = useAuthStore()
  const { notifications, showNotification } = useUIStore()

  // Mock popular stocks for search suggestions
  const popularStocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD']
  const filteredStocks = popularStocks.filter(stock =>
    stock.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5)

  // Market status logic
  const marketStatus = isConnected ? 'connected' : 'offline'
  const isMarketOpen = () => {
    const now = new Date()
    const hours = now.getHours()
    const day = now.getDay()
    // Simple market hours check (9:30 AM - 4 PM ET, weekdays)
    return day >= 1 && day <= 5 && hours >= 9 && hours <= 16
  }

  const handleSearch = (symbol?: string) => {
    const searchSymbol = symbol || searchQuery.trim().toUpperCase()
    if (searchSymbol) {
      router.push(`/stock/${searchSymbol}`)
      setSearchQuery('')
      setIsSearchFocused(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      showNotification({
        type: 'success',
        title: 'Logged Out',
        message: 'You have been successfully logged out'
      })
      router.push('/login')
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Logout Failed',
        message: 'Failed to logout. Please try again.'
      })
    }
  }

  // Get market data for display
  const spyData = marketIndices['SPY']
  const vixData = marketIndices['VIX']

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <motion.div
              className="flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    TurtleTrading
                  </h1>
                  <p className="text-xs text-muted-foreground">AI-Powered Platform</p>
                </div>
              </Link>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <Navigation />
            </div>

            {/* Search Bar - Desktop */}
            <div className="hidden md:block relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search stocks (e.g., AAPL, GOOGL)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  onKeyPress={handleKeyPress}
                  className="w-64 pl-10 pr-4 py-2 rounded-lg border bg-background/50 backdrop-blur-sm focus:w-80 transition-all duration-300"
                />
              </div>

              {/* Search Suggestions */}
              <AnimatePresence>
                {isSearchFocused && searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full mt-2 w-full bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden z-50"
                  >
                    {filteredStocks.map((stock) => (
                      <div
                        key={stock}
                        onClick={() => handleSearch(stock)}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{stock.slice(0, 2)}</span>
                          </div>
                          <span className="font-medium">{stock}</span>
                        </div>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                    {filteredStocks.length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        No results found
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Market Status & Data */}
              <div className="hidden lg:flex items-center gap-4">
                {/* Connection Status */}
                <Badge
                  variant={marketStatus === 'connected' ? 'default' : 'destructive'}
                  className={`gap-2 ${
                    marketStatus === 'connected'
                      ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                      : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  }`}
                >
                  {marketStatus === 'connected' ? (
                    <Wifi className="w-3 h-3" />
                  ) : (
                    <WifiOff className="w-3 h-3" />
                  )}
                  {marketStatus === 'connected' ? 'Live' : 'Offline'}
                </Badge>

                {/* S&P 500 */}
                {spyData && (
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground">SPY</span>
                    <span className="font-medium">${spyData.value.toFixed(2)}</span>
                    <span className={`flex items-center gap-1 ${
                      spyData.change >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {spyData.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {spyData.change >= 0 ? '+' : ''}{spyData.change.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* VIX */}
                {vixData && (
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground">VIX</span>
                    <span className="font-medium">${vixData.value.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="hidden sm:flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Watchlist
                </Button>

                <Button variant="outline" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {notifications.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-bold">{notifications.length}</span>
                    </div>
                  )}
                </Button>
              </div>

              {/* AI Insights Button */}
              <Button
                onClick={() => setIsAIInsightsOpen(true)}
                className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hidden sm:flex"
              >
                <Zap className="h-4 w-4" />
                AI Insights
              </Button>

              {/* User Menu or Login */}
              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar} alt={user.firstName} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <p className="w-[200px] truncate text-sm text-muted-foreground">
                          {user.email}
                        </p>
                        <Badge variant="secondary" className="text-xs w-fit">
                          {user.subscription}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="gap-2">
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600">
                      <LogOut className="h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" asChild>
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register">Sign Up</Link>
                  </Button>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              className="fixed top-0 right-0 h-full w-80 bg-background border-l shadow-lg z-50 md:hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Menu</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Mobile Search */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search stocks"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Mobile Navigation */}
                <Navigation mobile onItemClick={() => setIsMobileMenuOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* AI Insights Modal */}
      <AIInsightsModal open={isAIInsightsOpen} onOpenChange={setIsAIInsightsOpen} />
    </>
  )
}