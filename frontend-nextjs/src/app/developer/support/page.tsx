'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, MessageSquare, Mail, Github, FileQuestion, Lightbulb, Bug } from 'lucide-react'
import Link from 'next/link'

export default function SupportPage() {
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'question'>('question')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulate submission
    setFeedbackSubmitted(true)
    setTimeout(() => setFeedbackSubmitted(false), 3000)
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Developer Support</h1>
        <p className="text-muted-foreground">
          Get help, report issues, and request new features
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Help */}
        <div className="lg:col-span-2 space-y-6">
          {/* Support Resources */}
          <Card>
            <CardHeader>
              <CardTitle>Support Resources</CardTitle>
              <CardDescription>Find answers and get help</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Link href="/docs">
                <Button variant="outline" className="w-full justify-start h-auto py-4">
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 mt-1" />
                    <div className="text-left">
                      <div className="font-semibold">Documentation</div>
                      <div className="text-xs text-muted-foreground">
                        Comprehensive API guides and tutorials
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>

              <a
                href="https://github.com/ghantakiran/turtletrading/discussions"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full justify-start h-auto py-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 mt-1" />
                    <div className="text-left">
                      <div className="font-semibold">Community Forum</div>
                      <div className="text-xs text-muted-foreground">
                        Ask questions and share knowledge
                      </div>
                    </div>
                  </div>
                </Button>
              </a>

              <a
                href="https://github.com/ghantakiran/turtletrading/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full justify-start h-auto py-4">
                  <div className="flex items-start gap-3">
                    <Github className="h-5 w-5 mt-1" />
                    <div className="text-left">
                      <div className="font-semibold">GitHub Issues</div>
                      <div className="text-xs text-muted-foreground">
                        Report bugs and track development
                      </div>
                    </div>
                  </div>
                </Button>
              </a>

              <Link href="/developer/status">
                <Button variant="outline" className="w-full justify-start h-auto py-4">
                  <div className="flex items-start gap-3">
                    <FileQuestion className="h-5 w-5 mt-1" />
                    <div className="text-left">
                      <div className="font-semibold">API Status</div>
                      <div className="text-xs text-muted-foreground">
                        Check service health and uptime
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Feedback Form */}
          <Card>
            <CardHeader>
              <CardTitle>Submit Feedback</CardTitle>
              <CardDescription>Help us improve TurtleTrading API</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={feedbackType} onValueChange={(v) => setFeedbackType(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="question">
                    <FileQuestion className="h-4 w-4 mr-2" />
                    Question
                  </TabsTrigger>
                  <TabsTrigger value="feature">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Feature Request
                  </TabsTrigger>
                  <TabsTrigger value="bug">
                    <Bug className="h-4 w-4 mr-2" />
                    Bug Report
                  </TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmitFeedback} className="mt-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Subject</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={
                        feedbackType === 'bug'
                          ? 'Brief description of the issue'
                          : feedbackType === 'feature'
                          ? 'What feature would you like to see?'
                          : 'What do you need help with?'
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <textarea
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                      placeholder={
                        feedbackType === 'bug'
                          ? 'Steps to reproduce, expected vs actual behavior...'
                          : feedbackType === 'feature'
                          ? 'Describe the feature and how it would help you...'
                          : 'Provide details about your question...'
                      }
                      required
                    />
                  </div>

                  {feedbackType === 'bug' && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Environment</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Browser, SDK version, etc."
                      />
                    </div>
                  )}

                  <Button type="submit" className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    Submit {feedbackType === 'bug' ? 'Bug Report' : feedbackType === 'feature' ? 'Feature Request' : 'Question'}
                  </Button>

                  {feedbackSubmitted && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                      ✓ Thank you! Your feedback has been submitted.
                    </div>
                  )}
                </form>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Contact & FAQ */}
        <div className="space-y-6">
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Email Support</div>
                <a
                  href="mailto:support@turtletrading.com"
                  className="text-sm text-primary hover:underline"
                >
                  support@turtletrading.com
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Response within 24 hours
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Developer Chat</div>
                <a
                  href="https://discord.gg/turtletrading"
                  className="text-sm text-primary hover:underline"
                >
                  Join Discord Server
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Real-time community support
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">GitHub</div>
                <a
                  href="https://github.com/ghantakiran/turtletrading"
                  className="text-sm text-primary hover:underline"
                >
                  View Repository
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Issues and discussions
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle>Common Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">How do I get an API key?</div>
                <p className="text-xs text-muted-foreground">
                  Visit the{' '}
                  <Link href="/developer/api-keys" className="text-primary hover:underline">
                    API Keys page
                  </Link>{' '}
                  to generate your first key.
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">What are rate limits?</div>
                <p className="text-xs text-muted-foreground">
                  Free tier allows 1,000 requests/month. See{' '}
                  <Link href="/docs/rate-limits" className="text-primary hover:underline">
                    rate limits docs
                  </Link>
                  .
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Where can I find examples?</div>
                <p className="text-xs text-muted-foreground">
                  Check our{' '}
                  <Link href="/docs" className="text-primary hover:underline">
                    documentation
                  </Link>{' '}
                  for code examples in multiple languages.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Response Times */}
          <Card>
            <CardHeader>
              <CardTitle>Support Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <Badge variant="secondary">24h response</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discord</span>
                <Badge variant="secondary">Real-time</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GitHub Issues</span>
                <Badge variant="secondary">48h response</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
