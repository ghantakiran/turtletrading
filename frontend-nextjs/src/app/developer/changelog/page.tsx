'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Rocket, Bug, Sparkles, Shield, Zap } from 'lucide-react'

const releases = [
  {
    version: 'v1.2.0',
    date: '2025-01-07',
    type: 'feature',
    changes: [
      {
        type: 'feature',
        icon: Rocket,
        title: 'TypeScript SDK Release',
        description: 'Official TypeScript/JavaScript SDK with React components',
      },
      {
        type: 'feature',
        icon: Sparkles,
        title: 'Usage Analytics Dashboard',
        description: 'Track API usage, success rates, and performance metrics',
      },
      {
        type: 'feature',
        icon: Shield,
        title: 'API Key Management',
        description: 'Generate, revoke, and manage API keys with permission scoping',
      },
    ],
  },
  {
    version: 'v1.1.0',
    date: '2025-01-01',
    type: 'feature',
    changes: [
      {
        type: 'feature',
        icon: Zap,
        title: 'Enhanced AI Predictions',
        description: 'Improved LSTM model accuracy with confidence intervals',
      },
      {
        type: 'feature',
        icon: Sparkles,
        title: 'Sentiment Analysis',
        description: 'Multi-source sentiment analysis from news and social media',
      },
      {
        type: 'improvement',
        icon: Rocket,
        title: 'Performance Optimization',
        description: 'Reduced API response times by 40% across all endpoints',
      },
    ],
  },
  {
    version: 'v1.0.0',
    date: '2024-12-15',
    type: 'major',
    changes: [
      {
        type: 'feature',
        icon: Rocket,
        title: 'Initial Release',
        description: 'TurtleTrading API v1 with stock data, technical analysis, and AI predictions',
      },
      {
        type: 'feature',
        icon: Shield,
        title: 'Authentication System',
        description: 'JWT-based authentication with secure API access',
      },
      {
        type: 'feature',
        icon: Zap,
        title: 'Real-time WebSocket',
        description: 'Live market data streaming via WebSocket connections',
      },
    ],
  },
  {
    version: 'v0.9.0-beta',
    date: '2024-12-01',
    type: 'beta',
    changes: [
      {
        type: 'feature',
        icon: Sparkles,
        title: 'Beta Release',
        description: 'Public beta testing with limited features',
      },
      {
        type: 'bug',
        icon: Bug,
        title: 'Bug Fixes',
        description: 'Fixed multiple issues from alpha testing',
      },
    ],
  },
]

const typeColors = {
  feature: 'bg-blue-100 text-blue-700 border-blue-200',
  improvement: 'bg-green-100 text-green-700 border-green-200',
  bug: 'bg-red-100 text-red-700 border-red-200',
  major: 'bg-purple-100 text-purple-700 border-purple-200',
  beta: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

export default function ChangelogPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Changelog</h1>
        <p className="text-muted-foreground">
          Track new features, improvements, and bug fixes to the TurtleTrading API
        </p>
      </div>

      {/* Current Version Badge */}
      <Card className="mb-8">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Current Version</div>
              <div className="text-2xl font-bold">{releases[0].version}</div>
            </div>
            <Badge className="text-base px-4 py-2">Latest</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Releases */}
      <div className="space-y-8">
        {releases.map((release, idx) => (
          <Card key={release.version}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{release.version}</CardTitle>
                  <CardDescription className="mt-1">
                    Released on {new Date(release.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={typeColors[release.type as keyof typeof typeColors]}
                >
                  {release.type === 'major' ? 'Major Release' :
                   release.type === 'feature' ? 'Feature Release' :
                   release.type === 'beta' ? 'Beta' : 'Update'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {release.changes.map((change, changeIdx) => {
                  const Icon = change.icon
                  return (
                    <div key={changeIdx} className="flex gap-4">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          change.type === 'feature'
                            ? 'bg-blue-100 text-blue-600'
                            : change.type === 'improvement'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold mb-1">{change.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {change.description}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscribe Section */}
      <Card className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle>Stay Updated</CardTitle>
          <CardDescription>Get notified about new API releases and features</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Follow our{' '}
            <a
              href="https://github.com/ghantakiran/turtletrading"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub repository
            </a>{' '}
            to stay informed about updates and releases.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
