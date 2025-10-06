'use client'

/**
 * LiveAlertsPanel Component
 * Displays real-time trading alerts and notifications
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, TrendingUp, TrendingDown, Activity, AlertTriangle, X } from 'lucide-react'
import useMarketStore from '@/stores/marketStore'
import { formatDistanceToNow } from 'date-fns'

export function LiveAlertsPanel() {
  const { alerts, removeAlert } = useMarketStore()

  // Show only recent alerts (limit to 5)
  const recentAlerts = alerts.slice(0, 5)

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
        return <Bell className="w-4 h-4" />
    }
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'anomaly':
      case 'regime_change':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'volume_spike':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'price_above':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'price_below':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getAlertMessage = (alert: any) => {
    const { type, symbol, condition } = alert

    switch (type) {
      case 'price_above':
        return `${symbol} price crossed above $${condition}`
      case 'price_below':
        return `${symbol} price dropped below $${condition}`
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
              <Bell className="w-5 h-5" />
              Live Alerts
            </CardTitle>
            <CardDescription>Real-time trading notifications</CardDescription>
          </div>
          {recentAlerts.length > 0 && (
            <Badge variant="secondary">{recentAlerts.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {recentAlerts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active alerts</p>
            <p className="text-xs mt-1">Alerts will appear here when triggered</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${getAlertColor(alert.type)}`}
              >
                <div className="mt-0.5">{getAlertIcon(alert.type)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{getAlertMessage(alert)}</p>
                      <p className="text-xs opacity-75 mt-0.5">
                        {alert.triggeredAt
                          ? formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })
                          : 'Just now'}
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

            {alerts.length > 5 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{alerts.length - 5} more alerts
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
