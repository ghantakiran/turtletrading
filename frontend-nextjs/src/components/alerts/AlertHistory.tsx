'use client'

/**
 * AlertHistory Component
 * Displays historical alerts and allows filtering
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, TrendingUp, Activity, AlertTriangle, X, Filter } from 'lucide-react'
import useMarketStore from '@/stores/marketStore'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

export function AlertHistory() {
  const { alerts, removeAlert } = useMarketStore()
  const [filter, setFilter] = useState<'all' | 'triggered' | 'active'>('all')

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'all') return true
    if (filter === 'triggered') return alert.triggeredAt
    if (filter === 'active') return alert.isActive && !alert.triggeredAt
    return true
  })

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'price_above':
      case 'price_below':
        return <TrendingUp className="w-4 h-4" />
      case 'volume_spike':
        return <Activity className="w-4 h-4" />
      case 'anomaly':
      case 'regime_change':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <History className="w-4 h-4" />
    }
  }

  const getAlertBadgeVariant = (alert: any): "default" | "secondary" | "destructive" | "outline" => {
    if (alert.triggeredAt) return 'destructive'
    if (alert.isActive) return 'default'
    return 'secondary'
  }

  const getAlertMessage = (alert: any) => {
    const { type, symbol, condition } = alert

    switch (type) {
      case 'price_above':
        return `${symbol} crossed above $${condition}`
      case 'price_below':
        return `${symbol} dropped below $${condition}`
      case 'volume_spike':
        return `${symbol} volume spike detected`
      case 'rsi_overbought':
        return `${symbol} is overbought (RSI > 70)`
      case 'rsi_oversold':
        return `${symbol} is oversold (RSI < 30)`
      case 'regime_change':
        return `Market regime change detected for ${symbol}`
      case 'anomaly':
        return `Unusual activity detected in ${symbol}`
      case 'volatility_spike':
        return `${symbol} volatility spike`
      default:
        return `Alert triggered for ${symbol}`
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Alert History
            </CardTitle>
            <CardDescription>View and manage your alert history</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'triggered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('triggered')}
            >
              Triggered
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('active')}
            >
              Active
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredAlerts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No alerts found</p>
            <p className="text-xs mt-1">
              {filter === 'triggered' ? 'No alerts have been triggered' : 'Create alerts to see them here'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="mt-0.5">{getAlertIcon(alert.type)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{getAlertMessage(alert)}</p>
                        <Badge variant={getAlertBadgeVariant(alert)} className="text-xs">
                          {alert.triggeredAt ? 'Triggered' : alert.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {alert.triggeredAt
                          ? `Triggered ${formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}`
                          : `Created ${formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}`}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                      onClick={() => removeAlert(alert.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
