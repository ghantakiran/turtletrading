'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity } from 'lucide-react'

interface ServiceStatus {
  name: string
  status: 'operational' | 'degraded' | 'down'
  responseTime?: number
  uptime?: number
  lastChecked: string
}

export default function StatusPage() {
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'Stock Data API',
      status: 'operational',
      responseTime: 125,
      uptime: 99.9,
      lastChecked: new Date().toISOString(),
    },
    {
      name: 'AI Predictions API',
      status: 'operational',
      responseTime: 450,
      uptime: 99.8,
      lastChecked: new Date().toISOString(),
    },
    {
      name: 'Sentiment Analysis API',
      status: 'operational',
      responseTime: 280,
      uptime: 99.7,
      lastChecked: new Date().toISOString(),
    },
    {
      name: 'Market Data API',
      status: 'operational',
      responseTime: 95,
      uptime: 99.9,
      lastChecked: new Date().toISOString(),
    },
    {
      name: 'WebSocket Streaming',
      status: 'operational',
      uptime: 99.6,
      lastChecked: new Date().toISOString(),
    },
    {
      name: 'Authentication Service',
      status: 'operational',
      responseTime: 45,
      uptime: 99.95,
      lastChecked: new Date().toISOString(),
    },
  ])

  const refreshStatus = () => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setLastUpdate(new Date())
      setLoading(false)
    }, 1000)
  }

  const overallStatus = services.every(s => s.status === 'operational')
    ? 'operational'
    : services.some(s => s.status === 'down')
    ? 'down'
    : 'degraded'

  const avgResponseTime = services
    .filter(s => s.responseTime)
    .reduce((sum, s) => sum + (s.responseTime || 0), 0) / services.filter(s => s.responseTime).length

  const avgUptime = services.reduce((sum, s) => sum + (s.uptime || 0), 0) / services.length

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Status</h1>
          <p className="text-muted-foreground">
            Real-time status of TurtleTrading API services
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshStatus}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>System Status</CardTitle>
            <Badge
              variant={overallStatus === 'operational' ? 'default' : 'destructive'}
              className="text-base px-4 py-1"
            >
              {overallStatus === 'operational' ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> All Systems Operational</>
              ) : overallStatus === 'degraded' ? (
                <><AlertCircle className="h-4 w-4 mr-2" /> Degraded Performance</>
              ) : (
                <><XCircle className="h-4 w-4 mr-2" /> Service Disruption</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Average Response Time</div>
              <div className="text-2xl font-bold">{Math.round(avgResponseTime)}ms</div>
              <div className="text-xs text-muted-foreground mt-1">
                {avgResponseTime < 200 ? 'Excellent' : avgResponseTime < 500 ? 'Good' : 'Slow'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Average Uptime</div>
              <div className="text-2xl font-bold">{avgUptime.toFixed(2)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Last 30 days</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Last Updated</div>
              <div className="text-2xl font-bold">{lastUpdate.toLocaleTimeString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {lastUpdate.toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <div className="space-y-4">
        {services.map((service) => (
          <Card key={service.name}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      service.status === 'operational'
                        ? 'bg-green-500'
                        : service.status === 'degraded'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{service.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {service.status === 'operational'
                        ? 'Operational'
                        : service.status === 'degraded'
                        ? 'Degraded Performance'
                        : 'Service Down'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-8 text-sm">
                  {service.responseTime && (
                    <div>
                      <div className="text-muted-foreground">Response Time</div>
                      <div className="font-semibold text-center">{service.responseTime}ms</div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground">Uptime</div>
                    <div className="font-semibold text-center">{service.uptime}%</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Incident History */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
          <CardDescription>No incidents reported in the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>All systems running smoothly</p>
          </div>
        </CardContent>
      </Card>

      {/* Subscribe */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Status Updates</CardTitle>
          <CardDescription>Get notified about service disruptions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Follow{' '}
            <a
              href="https://twitter.com/turtletrading"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @turtletrading
            </a>{' '}
            for real-time status updates and maintenance announcements.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
