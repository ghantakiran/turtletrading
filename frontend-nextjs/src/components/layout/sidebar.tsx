"use client"

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  BarChart3,
  Briefcase,
  Eye,
  LineChart,
  Bell,
  Globe,
  Newspaper,
  Settings,
  ChevronDown,
  ChevronRight,
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  Star,
  Zap
} from 'lucide-react'
import { useMarketStore, useAuthStore, useUIStore } from '@/stores'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  className?: string
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
  description?: string
}

const navigationItems: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: BarChart3, description: 'Market overview & insights' },
  { name: 'Portfolio', href: '/portfolio', icon: Briefcase, description: 'Your investments' },
  { name: 'Watchlist', href: '/watchlist', icon: Eye, description: 'Tracked stocks' },
  { name: 'Analytics', href: '/analytics', icon: LineChart, description: 'Advanced analysis' },
  { name: 'Alerts', href: '/alerts', icon: Bell, badge: 3, description: 'Price & indicator alerts' },
  { name: 'Market', href: '/market', icon: Globe, description: 'Market overview' },
  { name: 'News & Sentiment', href: '/sentiment', icon: Newspaper, description: 'AI sentiment analysis' },
  { name: 'Settings', href: '/settings', icon: Settings, description: 'Account settings' }
]

export function Sidebar({ isOpen = true, onClose, className = "" }: SidebarProps) {
  const pathname = usePathname()
  const [collapsedSections, setCollapsedSections] = useState<string[]>([])

  // Zustand store hooks
  const { isMobile } = useUIStore()
  const { watchlists, selectedWatchlist, marketIndices, stockPrices, isConnected } = useMarketStore()
  const { isAuthenticated, user } = useAuthStore()

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  const toggleSection = (section: string) => {
    setCollapsedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const currentWatchlist = watchlists.find(w => w.id === selectedWatchlist)

  // Don't render on mobile if not open
  if (isMobile && !isOpen) return null

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: isMobile ? -320 : 0 }}
        animate={{ x: 0 }}
        exit={{ x: isMobile ? -320 : 0 }}
        className={`
          fixed inset-y-0 left-0 z-50 w-80 bg-background/95 backdrop-blur-sm border-r shadow-lg
          lg:relative lg:translate-x-0
          ${className}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  TurtleTrading
                </div>
                <div className="text-xs text-muted-foreground">
                  AI Analytics
                </div>
              </div>
            </Link>
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="lg:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 px-4">
            {/* Navigation */}
            <nav className="py-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-3">
                Navigation
              </div>
              {navigationItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.name} href={item.href} onClick={isMobile ? onClose : undefined}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        group flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200
                        ${isActive(item.href)
                          ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                          : 'text-foreground/70 hover:text-foreground hover:bg-muted/50 border border-transparent'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 ${isActive(item.href) ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground group-hover:text-foreground/70">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                      {item.badge && (
                        <Badge variant="secondary" className="h-5 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </motion.div>
                  </Link>
                )
              })}
            </nav>

            <Separator className="my-4" />

            {/* Market Summary Section */}
            <div className="py-4">
              <Button
                variant="ghost"
                onClick={() => toggleSection('market')}
                className="flex items-center justify-between w-full h-auto p-3 text-left hover:bg-muted/50"
              >
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">Market Summary</div>
                    <div className="text-xs text-muted-foreground">
                      {isConnected ? 'Live data' : 'Offline'}
                    </div>
                  </div>
                </div>
                {collapsedSections.includes('market') ?
                  <ChevronRight className="h-4 w-4" /> :
                  <ChevronDown className="h-4 w-4" />
                }
              </Button>

              <AnimatePresence>
                {!collapsedSections.includes('market') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="mt-3 mx-3">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">S&P 500</span>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              ${marketIndices['SPY']?.value?.toFixed(2) || '4,530.12'}
                            </div>
                            <div className={`text-xs flex items-center gap-1 ${
                              (marketIndices['SPY']?.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {(marketIndices['SPY']?.change || 0) >= 0 ?
                                <TrendingUp className="h-3 w-3" /> :
                                <TrendingDown className="h-3 w-3" />
                              }
                              {marketIndices['SPY']?.changePercent?.toFixed(2) || '+0.45'}%
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">NASDAQ</span>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              ${marketIndices['QQQ']?.value?.toFixed(2) || '15,846.23'}
                            </div>
                            <div className={`text-xs flex items-center gap-1 ${
                              (marketIndices['QQQ']?.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {(marketIndices['QQQ']?.change || 0) >= 0 ?
                                <TrendingUp className="h-3 w-3" /> :
                                <TrendingDown className="h-3 w-3" />
                              }
                              {marketIndices['QQQ']?.changePercent?.toFixed(2) || '+0.73'}%
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">VIX</span>
                          <div className="text-right">
                            <div className="text-sm font-medium text-orange-500">
                              {marketIndices['VIX']?.value?.toFixed(2) || '23.45'}
                            </div>
                            <div className="text-xs text-muted-foreground">Fear & Greed</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Watchlist Section */}
            {currentWatchlist && currentWatchlist.symbols.length > 0 && (
              <div className="py-4">
                <Button
                  variant="ghost"
                  onClick={() => toggleSection('watchlist')}
                  className="flex items-center justify-between w-full h-auto p-3 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center space-x-3">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="font-medium">{currentWatchlist.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {currentWatchlist.symbols.length} stocks
                      </div>
                    </div>
                  </div>
                  {collapsedSections.includes('watchlist') ?
                    <ChevronRight className="h-4 w-4" /> :
                    <ChevronDown className="h-4 w-4" />
                  }
                </Button>

                <AnimatePresence>
                  {!collapsedSections.includes('watchlist') && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="mt-3 mx-3">
                        <CardContent className="p-3 space-y-2">
                          {currentWatchlist.symbols.slice(0, 6).map((symbol) => {
                            const stockData = stockPrices[symbol]
                            return (
                              <Link
                                key={symbol}
                                href={`/stock/${symbol}`}
                                onClick={isMobile ? onClose : undefined}
                              >
                                <motion.div
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="flex justify-between items-center py-2 px-3 text-sm hover:bg-muted/50 rounded-lg transition-colors"
                                >
                                  <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center">
                                      <span className="text-white text-xs font-bold">
                                        {symbol.slice(0, 1)}
                                      </span>
                                    </div>
                                    <span className="font-medium">{symbol}</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      ${stockData?.price?.toFixed(2) || '--'}
                                    </div>
                                    <div className={`text-xs flex items-center gap-1 ${
                                      (stockData?.changePercent || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                      {(stockData?.changePercent || 0) >= 0 ?
                                        <TrendingUp className="h-2 w-2" /> :
                                        <TrendingDown className="h-2 w-2" />
                                      }
                                      {stockData?.changePercent ?
                                        `${stockData.changePercent >= 0 ? '+' : ''}${stockData.changePercent.toFixed(2)}%` :
                                        '--'
                                      }
                                    </div>
                                  </div>
                                </motion.div>
                              </Link>
                            )
                          })}
                          {currentWatchlist.symbols.length > 6 && (
                            <div className="text-xs text-muted-foreground text-center py-2 border-t">
                              +{currentWatchlist.symbols.length - 6} more stocks
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <Separator className="my-4" />

            {/* AI Insights */}
            <div className="py-4">
              <Card className="mx-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-600/10 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">AI Insights</div>
                      <div className="text-xs text-muted-foreground">Powered by ML</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Market sentiment is bullish. 3 opportunities detected in your watchlist.
                  </p>
                  <Button size="sm" className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    View Analysis
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          {/* User Section */}
          {isAuthenticated && user && (
            <div className="p-4 border-t">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.firstName} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {user.subscription} Plan
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  )
}

export default Sidebar