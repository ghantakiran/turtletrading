'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, TrendingUp, AlertCircle, Activity, RefreshCw } from 'lucide-react'
import { loadAPIRequests, getAnalyticsSummary, getUsageStats } from '@/lib/analytics/utils'
import { loadAPIKeys } from '@/lib/api-keys/utils'
import type { APIRequest } from '@/types/analytics'
import Link from 'next/link'

export default function AnalyticsPage() {
  const [requests, setRequests] = useState<APIRequest[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setLoading(true)
    const allRequests = loadAPIRequests()
    setRequests(allRequests)
    setLoading(false)
  }

  const apiKeys = loadAPIKeys()
  const summary = getAnalyticsSummary(requests, apiKeys.length)
  const stats = getUsageStats(requests)

  // Filter requests by period
  const filteredRequests = requests.filter(r => {
    const requestDate = new Date(r.timestamp)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24))

    if (selectedPeriod === 'day') return daysDiff < 1
    if (selectedPeriod === 'week') return daysDiff < 7
    if (selectedPeriod === 'month') return daysDiff < 30
    return true
  })

  const periodStats = getUsageStats(filteredRequests)

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">API Analytics</h1>
          <p className="text-muted-foreground mt-2">Track and analyze your API usage</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/developer/api-keys">
            <Button variant="outline" size="sm">Manage API Keys</Button>
          </Link>
        </div>
      </div>

      {/* Period Selector */}
      <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as 'day' | 'week' | 'month')} className="mb-6">
        <TabsList>
          <TabsTrigger value="day">Today</TabsTrigger>
          <TabsTrigger value="week">Last 7 Days</TabsTrigger>
          <TabsTrigger value="month">Last 30 Days</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodStats.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.requestsToday} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {periodStats.successfulRequests} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.avgResponseTime < 200 ? 'Excellent' : summary.avgResponseTime < 500 ? 'Good' : 'Needs improvement'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active API Keys</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeKeys}</div>
            <p className="text-xs text-muted-foreground mt-1">
              out of {summary.totalKeys} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Endpoints */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Top Endpoints</CardTitle>
          <CardDescription>Most frequently accessed API endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.topEndpoints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API requests yet</p>
              <p className="text-sm mt-2">Start using your API keys to see analytics</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summary.topEndpoints.map((endpoint, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground">
                        {endpoint.endpoint}
                      </span>
                      <Badge variant="secondary">{endpoint.count} requests</Badge>
                    </div>
                    <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${endpoint.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-sm font-medium text-muted-foreground">
                    {endpoint.percentage}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Errors */}
      {summary.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Recent Errors
            </CardTitle>
            <CardDescription>Latest failed API requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.recentErrors.map((error) => (
                <div
                  key={error.id}
                  className="flex items-start justify-between p-3 border border-destructive/20 rounded-lg bg-destructive/5"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge variant="destructive">{error.statusCode}</Badge>
                      <code className="text-sm">{error.endpoint}</code>
                    </div>
                    {error.errorMessage && (
                      <p className="text-sm text-muted-foreground">{error.errorMessage}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(error.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {requests.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No API Activity Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start making API requests to see analytics and usage statistics
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/developer/api-keys">
                  <Button>Manage API Keys</Button>
                </Link>
                <Link href="/docs">
                  <Button variant="outline">View Documentation</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
