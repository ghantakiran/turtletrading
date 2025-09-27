'use client'

import { useEffect } from 'react'
import { User } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Menu,
  Activity,
  User as UserIcon,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  Bell,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle
} from 'lucide-react'
import { logoutAction } from '@/lib/auth/actions'
import { useMarketStore } from '@/stores/marketStore'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  user: User
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function AppHeader({ user, sidebarOpen, setSidebarOpen }: AppHeaderProps) {
  const {
    isConnected,
    connectionStatus,
    alerts,
    marketIndices,
    lastUpdate,
    setConnectionStatus,
    acknowledgeAlert
  } = useMarketStore()

  // Simulate connection status updates
  useEffect(() => {
    const interval = setInterval(() => {
      const statuses = ['connected', 'connecting', 'disconnected'] as const
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]
      setConnectionStatus(randomStatus)
    }, 30000) // Update every 30 seconds

    // Start with connected status
    setConnectionStatus('connected')

    return () => clearInterval(interval)
  }, [setConnectionStatus])

  const handleLogout = async () => {
    try {
      await logoutAction()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleAcknowledgeAlert = (alertId: string) => {
    acknowledgeAlert(alertId)
  }

  const activeAlerts = alerts.filter(alert => alert.isActive)
  const spyData = marketIndices['SPY']
  const vixData = marketIndices['VIX']

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-3 h-3 text-green-500" />
      case 'connecting':
        return <Clock className="w-3 h-3 text-yellow-500 animate-spin" />
      default:
        return <WifiOff className="w-3 h-3 text-red-500" />
    }
  }

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Live Market Data'
      case 'connecting':
        return 'Connecting...'
      default:
        return 'Offline'
    }
  }

  const getConnectionVariant = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'default'
      case 'connecting':
        return 'secondary'
      default:
        return 'destructive'
    }
  }

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold">TurtleTrading</h1>
            </div>
          </Link>
        </div>

        {/* Center - Market Status and Data */}
        <div className="hidden md:flex items-center gap-4">
          {/* Connection Status */}
          <Badge
            variant={getConnectionVariant() as any}
            className={cn(
              "gap-2 transition-colors",
              connectionStatus === 'connected' && "bg-green-500/10 text-green-700 dark:text-green-400",
              connectionStatus === 'connecting' && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
              connectionStatus === 'disconnected' && "bg-red-500/10 text-red-700 dark:text-red-400"
            )}
          >
            {getConnectionIcon()}
            {getConnectionText()}
          </Badge>

          {/* Market Data - S&P 500 */}
          {spyData && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">SPY</span>
              <span className="font-medium">${spyData.value.toFixed(2)}</span>
              <span className={cn(
                "flex items-center gap-1",
                spyData.change >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {spyData.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {spyData.change >= 0 ? '+' : ''}{spyData.change.toFixed(2)}
              </span>
            </div>
          )}

          {/* VIX */}
          {vixData && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">VIX</span>
              <span className="font-medium">{vixData.value.toFixed(2)}</span>
            </div>
          )}

          {/* Last Update */}
          {lastUpdate && (
            <div className="text-xs text-muted-foreground">
              Updated: {new Date(lastUpdate).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {activeAlerts.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">
                      {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
                    </span>
                  </div>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 border-b">
                <h4 className="font-semibold">Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  {activeAlerts.length} active alerts
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {activeAlerts.length > 0 ? (
                  activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 border-b"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {alert.symbol}
                          </Badge>
                          <span className="text-sm font-medium">
                            {alert.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Condition: {alert.condition}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No active notifications</p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {user.firstName[0]}{user.lastName[0]}
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
                  <UserIcon className="h-4 w-4" />
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
        </div>
      </div>
    </header>
  )
}